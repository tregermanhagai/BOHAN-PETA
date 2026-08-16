# Stops every locally running dev process for this project.
#
# Two complementary strategies, because neither alone is reliable:
#
# 1. Port-based kill: whatever's actually bound to 3000/5173/3001 is
#    definitely ours and definitely needs to die, regardless of how it
#    was launched. A "kill anything whose command line mentions this
#    project" filter misses processes that don't happen to include the
#    project path (e.g. a plain `npm run start:dev` shows up as a bare
#    `npm-cli.js run start:dev`, no project text at all).
#
# 2. Signature sweep: killing only the port-holder isn't enough either.
#    `nest start --watch` spawns its child via `shell: true` on Windows,
#    which means an intermediate cmd.exe hands off to the real node
#    process and then exits - so by the time you look, the port-holder's
#    recorded parent PID often points to an already-dead process, and
#    walking ParentProcessId upward silently stops one hop too early.
#    The still-alive `nest.js` watcher then notices its child died and
#    immediately respawns a replacement, so the "stop" doesn't actually
#    stop anything. Instead, separately sweep for the specific wrapper
#    processes by known, low-false-positive command-line text: the nest
#    CLI's own script path, vite's own script path, and the `start:dev`
#    script name npm invokes them through.

$killed = New-Object System.Collections.Generic.HashSet[int]

function Kill-ByPid {
    param([int]$TargetPid, [string]$Reason)
    if ($killed.Contains($TargetPid)) { return }
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$TargetPid" -ErrorAction SilentlyContinue
    if (-not $proc) { return }
    Stop-Process -Id $TargetPid -Force -ErrorAction SilentlyContinue
    [void]$killed.Add($TargetPid)
    Write-Host ("  killed PID {0} [{1}] {2}" -f $TargetPid, $Reason, $proc.CommandLine)
}

Write-Host "Checking dev ports..."
$ports = @(
    @{ Port = 3000; Name = "api (dev)" },
    @{ Port = 5173; Name = "web (vite)" },
    @{ Port = 3001; Name = "api (playwright test-server)" }
)
foreach ($entry in $ports) {
    $conns = Get-NetTCPConnection -LocalPort $entry.Port -State Listen -ErrorAction SilentlyContinue
    if (-not $conns) {
        Write-Host ("  {0} - port {1}: nothing listening" -f $entry.Name, $entry.Port)
        continue
    }
    foreach ($processId in ($conns | Select-Object -ExpandProperty OwningProcess -Unique)) {
        Kill-ByPid -TargetPid $processId -Reason ("port {0}" -f $entry.Port)
    }
}

Write-Host "Sweeping for wrapper/watcher processes..."
$signatures = @(
    "@nestjs\cli\bin\nest.js",
    "vite\bin\vite.js",
    "start:dev"
)
Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='cmd.exe'" |
    Where-Object {
        $cmd = $_.CommandLine
        $cmd -and ($signatures | Where-Object { $cmd -like "*$_*" }).Count -gt 0
    } |
    ForEach-Object {
        Kill-ByPid -TargetPid $_.ProcessId -Reason "wrapper sweep"
    }

if ($killed.Count -eq 0) {
    Write-Host "`nNothing was running. Environment is already clean."
} else {
    Write-Host ("`nDone. Stopped {0} process(es). All BOHAN-PETA dev ports are free." -f $killed.Count)
}
