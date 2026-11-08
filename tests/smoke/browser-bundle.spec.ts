import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Checks the published <script>-tag build (packages/core/dist/browser),
 * which CDN users load without a bundler. Requires `npm run build:core`.
 */

const BUNDLE = path.join(__dirname, '../../packages/core/dist/browser/rp-image-editor.min.js');
const FIXTURE = 'file://' + path.join(__dirname, 'browser-bundle.html');

test.beforeAll(() => {
  if (!fs.existsSync(BUNDLE)) {
    throw new Error(`Missing ${BUNDLE}. Run \`npm run build:core\` before the smoke tests.`);
  }
});

test('CDN bundle exposes the global API and exports at native size', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FIXTURE);

  const result = await page.evaluate(async () => {
    const g = (window as any).RpImageEditor;
    const editor = new g.RpImageEditor(document.getElementById('host'), { exportFormat: 'png' });
    await editor.loadImage((window as any).makeTestImage(640, 480).toDataURL('image/png'));
    const r = await editor.getResult();
    return {
      api: ['RpImageEditor', 'openEditorModal', 'getLocalePack', 'processImage'].map((k) => typeof g[k]),
      width: r.width,
      height: r.height,
    };
  });

  expect(result.api).toEqual(['function', 'function', 'function', 'function']);
  expect([result.width, result.height]).toEqual([640, 480]);
  expect(errors).toEqual([]);
});

test('CDN bundle uses a page-level heic2any global for HEIC files', async ({ page }) => {
  await page.goto(FIXTURE);

  const outcome = await page.evaluate(async () => {
    const g = (window as any).RpImageEditor;
    const heic = new File([new Uint8Array([0, 1, 2])], 'photo.heic', { type: 'image/heic' });

    // Without the global: a clear error telling the page what to load.
    let missing = '';
    try {
      await g.processImage(heic, null);
    } catch (e) {
      missing = (e as Error).message;
    }

    // With a stand-in global converter: it is called and its JPEG is used.
    let called = 0;
    (window as any).heic2any = async () => {
      called++;
      const c = (window as any).makeTestImage(40, 30) as HTMLCanvasElement;
      return new Promise<Blob>((res) => c.toBlob((b) => res(b!), 'image/jpeg'));
    };
    const ok = await g.processImage(heic, null);
    return { missing, called, width: ok.info.processedWidth, converted: ok.info.wasHeicConverted };
  });

  expect(outcome.missing).toContain('heic2any is not loaded');
  expect(outcome.called).toBe(1);
  expect(outcome.converted).toBe(true);
  expect(outcome.width).toBe(40);
});
