/**
 * Bundles packages/core/src into tests/smoke/.bundle/ so the smoke tests
 * always run against the current source (not the committed demo bundle).
 */
const path = require('path');
const esbuild = require('esbuild');

module.exports = async () => {
  const root = path.resolve(__dirname, '..', '..');
  await esbuild.build({
    entryPoints: [path.join(root, 'packages/core/src/index.ts')],
    bundle: true,
    format: 'iife',
    globalName: 'RpImageEditor',
    target: 'es2020',
    sourcemap: true,
    outfile: path.join(__dirname, '.bundle/rp-image-editor.bundle.js'),
    logLevel: 'warning',
  });
};
