# Stops every dev process for this project (see dev-stop.ps1), then wipes
# build artifacts so the next `npm run build` / `npm run dev:*` starts
# from a guaranteed-fresh state — no stale dist/ folder, no stale
# incremental-build cache left over from a previous, possibly-orphaned
# compiler process.

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $here

Write-Host "Stopping dev processes..."
& (Join-Path $here "dev-stop.ps1")

Write-Host "`nRemoving build artifacts..."
$paths = @(
    (Join-Path $repoRoot "apps\api\dist"),
    (Join-Path $repoRoot "apps\api\dist-test"),
    (Join-Path $repoRoot "apps\api\tsconfig.tsbuildinfo"),
    (Join-Path $repoRoot "apps\web\dist"),
    (Join-Path $repoRoot "packages\shared-types\dist")
)
foreach ($path in $paths) {
    if (Test-Path $path) {
        Remove-Item -Recurse -Force $path
        Write-Host "  removed $path"
    }
}

Write-Host "`nClean. Run 'npm run build' or 'npm run dev:api' / 'npm run dev:web' to start fresh."
