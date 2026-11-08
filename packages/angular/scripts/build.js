/**
 * Builds the Angular wrapper with ng-packagr (Angular Package Format, Ivy
 * partial compilation), so it works in AOT/production builds of Angular 15+.
 *
 * The toolchain lives in ./tools with its own lockfile, outside the npm
 * workspace: Angular 15's compiler needs TypeScript 4.9, while the rest of the
 * repo uses 5.x. It is installed on first build.
 *
 * Output: dist/ (with its own package.json). Publish from there:
 *   npm publish packages/angular/dist
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOOLS = path.join(ROOT, 'tools');
const NG_PACKAGR = path.join(TOOLS, 'node_modules', 'ng-packagr', 'cli', 'main.js');

if (!fs.existsSync(NG_PACKAGR)) {
  console.log('Installing Angular build tools (packages/angular/tools)...');
  execSync('npm ci --no-audit --no-fund', { cwd: TOOLS, stdio: 'inherit' });
}

fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
execSync(`node "${NG_PACKAGR}" -p ng-package.json -c tsconfig.lib.json`, { cwd: ROOT, stdio: 'inherit' });
