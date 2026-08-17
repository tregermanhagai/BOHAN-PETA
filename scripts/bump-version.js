// Bumps the patch number (the third segment) in apps/web/package.json —
// that's the version the footer displays (Footer.tsx imports it directly).
// Not semver-as-usual (patch != "bugfix release"); it's just an ascending
// build counter, incremented once per push, e.g. 0.1.0 -> 0.1.1 -> 0.1.2 ...
const fs = require("node:fs");
const path = require("node:path");

const pkgPath = path.join(__dirname, "..", "apps", "web", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

const parts = pkg.version.split(".").map(Number);
if (parts.length !== 3 || parts.some(Number.isNaN)) {
  throw new Error(`Unexpected version format in ${pkgPath}: "${pkg.version}"`);
}
parts[2] += 1;
const nextVersion = parts.join(".");

pkg.version = nextVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log(`apps/web version bumped to ${nextVersion}`);
