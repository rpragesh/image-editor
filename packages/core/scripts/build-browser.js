/**
 * Build script — emits a self-contained browser bundle for <script>-tag / CDN
 * use (no bundler needed):
 *
 *   dist/browser/rp-image-editor.min.js      (IIFE, global = RpImageEditor)
 *   dist/browser/rp-image-editor.min.js.map
 *
 * Fabric.js is bundled in. Styles are injected at runtime, so no separate CSS
 * file is required.
 *
 * heic2any (~1.3 MB) is NOT bundled. The bundle uses a global `heic2any` if
 * the page loads one, so only sites that need HEIC/HEIF pay for it:
 *
 *   <script src="https://unpkg.com/heic2any@0.0.4/dist/heic2any.js"></script>  (optional)
 *   <script src="https://unpkg.com/@rageshpikalmunde/rp-image-editor"></script>
 *   <script>
 *     RpImageEditor.openEditorModal({ image: file }).then(r => ...);
 *   </script>
 */
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));

/** Replace `import('heic2any')` with a shim that reads the page global. */
const heicGlobalShim = {
  name: 'heic2any-global',
  setup(build) {
    build.onResolve({ filter: /^heic2any$/ }, () => ({ path: 'heic2any', namespace: 'heic-shim' }));
    build.onLoad({ filter: /.*/, namespace: 'heic-shim' }, () => ({
      loader: 'js',
      contents: `export default function heic2any(options) {
  var fn = typeof globalThis !== 'undefined' ? globalThis.heic2any : undefined;
  if (typeof fn !== 'function') {
    throw new Error('heic2any is not loaded. Add <script src="https://unpkg.com/heic2any@0.0.4/dist/heic2any.js"></script> before the editor bundle to enable HEIC support');
  }
  return fn(options);
}`,
    }));
  },
};

esbuild
  .build({
    entryPoints: [path.join(ROOT, 'src', 'index.ts')],
    outfile: path.join(ROOT, 'dist', 'browser', 'rp-image-editor.min.js'),
    bundle: true,
    format: 'iife',
    globalName: 'RpImageEditor',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    sourcemap: true,
    legalComments: 'none',
    plugins: [heicGlobalShim],
    banner: {
      js: `/*! ${pkg.name} v${pkg.version} | ${pkg.license} | ${pkg.homepage} */`,
    },
    logLevel: 'info',
  })
  .catch(() => process.exit(1));
