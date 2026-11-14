/**
 * Build script to bundle the editor for the GitHub Pages demo.
 * Produces: docs/rp-image-editor.bundle.js (IIFE, global = RpImageEditor)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const DEMO = path.join(ROOT, 'demo');

// Ensure docs/demo directories exist
fs.mkdirSync(DOCS, { recursive: true });
fs.mkdirSync(DEMO, { recursive: true });

// Bundle with esbuild
console.log('Bundling editor for demo...');
execSync(
  [
    'npx esbuild',
    'packages/core/src/index.ts',
    '--bundle',
    '--format=iife',
    '--global-name=RpImageEditor',
    '--sourcemap',
    '--minify',
    '--target=es2020',
    '--outfile=docs/rp-image-editor.bundle.js',
  ].join(' '),
  { cwd: ROOT, stdio: 'inherit' }
);

// Mirror to demo/ so `npx serve demo` always uses the latest bundle
fs.copyFileSync(
  path.join(DOCS, 'rp-image-editor.bundle.js'),
  path.join(DEMO, 'rp-image-editor.bundle.js'),
);
fs.copyFileSync(
  path.join(DOCS, 'rp-image-editor.bundle.js.map'),
  path.join(DEMO, 'rp-image-editor.bundle.js.map'),
);

// Mirror sample image (if present) both ways so the "Try with sample" button
// on the demo page works in both `demo/` (local `npx serve`) and `docs/`
// (GitHub Pages). Drop any of the accepted filenames below into either folder;
// it will be synced. The runtime loader probes the same list in order.
const SAMPLE_CANDIDATES = ['sample.png', 'sample.jpg', 'sample.jpeg', 'sample.webp'];
let mirroredSample = null;
for (const name of SAMPLE_CANDIDATES) {
  const inDemo = path.join(DEMO, name);
  const inDocs = path.join(DOCS, name);
  if (fs.existsSync(inDemo)) {
    fs.copyFileSync(inDemo, inDocs);
    mirroredSample = 'docs/' + name;
    break;
  } else if (fs.existsSync(inDocs)) {
    fs.copyFileSync(inDocs, inDemo);
    mirroredSample = 'demo/' + name;
    break;
  }
}
if (mirroredSample) {
  console.log('Demo sample mirrored: ' + mirroredSample);
} else {
  console.log('Note: no sample image found in demo/ or docs/. Drop one of ['
    + SAMPLE_CANDIDATES.join(', ') + '] in to enable the "Try with sample" button.');
}

// demo/ is the source for the site's static files; mirror them to docs/.
// Search-engine verification files (Google Search Console: google*.html,
// Bing: BingSiteAuth.xml) are dropped into demo/ and published as-is.
const verification = fs.readdirSync(DEMO).filter((f) => /^google[0-9a-f]+\.html$/.test(f) || f === 'BingSiteAuth.xml');
for (const name of ['index.html', 'social-card.png', 'demo.gif', ...verification]) {
  const src = path.join(DEMO, name);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DOCS, name));
}

// Search-landing pages (React / Angular / annotation guides) and sitemap.xml.
require('./site-pages.js');

console.log('Demo bundle built: docs/rp-image-editor.bundle.js');
console.log('Demo bundle mirrored: demo/rp-image-editor.bundle.js');
