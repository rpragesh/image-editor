/**
 * Build script — emits the runtime stylesheet consumed by hosts that
 * `import '@rageshpikalmunde/rp-image-editor/styles'`. The single source
 * of truth is `src/ui/styles.ts`; we read the compiled CJS output so
 * there's no duplication.
 */
const fs = require('fs');
const path = require('path');

const stylesModulePath = path.join(
  __dirname,
  '..',
  'dist',
  'cjs',
  'ui',
  'styles.js',
);

if (!fs.existsSync(stylesModulePath)) {
  console.error(
    '[build-css] Compiled styles module not found — run build:cjs first.',
  );
  process.exit(1);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { RP_IE_CSS } = require(stylesModulePath);

const distDir = path.join(__dirname, '..', 'dist', 'styles');
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(
  path.join(distDir, 'rp-image-editor.css'),
  RP_IE_CSS.trim() + '\n',
);
console.log('CSS built: dist/styles/rp-image-editor.css');

// Module type markers for ESM and CJS directories
const esmDir = path.join(__dirname, '..', 'dist', 'esm');
const cjsDir = path.join(__dirname, '..', 'dist', 'cjs');
fs.mkdirSync(esmDir, { recursive: true });
fs.mkdirSync(cjsDir, { recursive: true });
fs.writeFileSync(
  path.join(esmDir, 'package.json'),
  JSON.stringify({ type: 'module' }, null, 2),
);
fs.writeFileSync(
  path.join(cjsDir, 'package.json'),
  JSON.stringify({ type: 'commonjs' }, null, 2),
);
console.log(
  'Module type markers written: dist/esm/package.json, dist/cjs/package.json',
);
