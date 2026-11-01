import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Smoke tests for the core editor. They drive the public RpImageEditor API
 * in a real browser and assert on exported pixels, so they guard the
 * single-image behaviour that must not change across refactors.
 *
 * Test image: 800×600, left half red (#ff0000), right half blue (#0000ff).
 */

const FIXTURE = 'file://' + path.join(__dirname, 'fixture.html');

async function setup(page: Page, config: Record<string, unknown> = {}) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FIXTURE);
  await page.evaluate((cfg) => (window as any).harness.create(cfg), config);
  return errors;
}

const exportInfo = (page: Page) => page.evaluate(() => (window as any).harness.exportInfo());
const pixelAt = (page: Page, fx: number, fy: number) =>
  page.evaluate(([x, y]) => (window as any).harness.pixelAt(x, y), [fx, fy]);
const count = (page: Page, rect: [number, number, number, number], kind: 'red' | 'blue') =>
  page.evaluate(([r, k]) => (window as any).harness.countPixels(...(r as number[]), k), [rect, kind] as const);
const call = (page: Page, method: string, ...args: unknown[]) =>
  page.evaluate(([m, a]) => (window as any).harness.editor[m as string](...(a as unknown[])), [method, args] as const);

/** Export sizes can be off by a pixel from float rounding in getResult(). */
function expectSize(info: { width: number; height: number }, w: number, h: number, tol = 2) {
  expect(Math.abs(info.width - w), `width ${info.width} vs ${w}`).toBeLessThanOrEqual(tol);
  expect(Math.abs(info.height - h), `height ${info.height} vs ${h}`).toBeLessThanOrEqual(tol);
}

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

function expectColor(actual: number[], expected: number[], tol = 8) {
  actual.forEach((v, i) => expect(Math.abs(v - expected[i]), `channel ${i}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tol));
}

/** Freehand stroke across the blue half of the image, in draw mode. */
async function drawStrokeOnBlueHalf(page: Page) {
  await call(page, 'setMode', 'draw');
  const r = await page.evaluate(() => (window as any).harness.imageScreenRect());
  const y = r.top + r.height * 0.5;
  await page.mouse.move(r.left + r.width * 0.6, y);
  await page.mouse.down();
  for (let i = 1; i <= 20; i++) {
    await page.mouse.move(r.left + r.width * (0.6 + 0.3 * (i / 20)), y);
  }
  await page.mouse.up();
}

const STROKE_BAND: [number, number, number, number] = [0.62, 0.45, 0.88, 0.55];

test('loads and exports unchanged image at native resolution', async ({ page }) => {
  const errors = await setup(page);
  const info = await exportInfo(page);
  expect(info).toMatchObject({ format: 'png', fileType: 'image/png' });
  expectSize(info, 800, 600);
  expect([info.naturalWidth, info.naturalHeight]).toEqual([info.width, info.height]);
  expect(info.blobSize).toBeGreaterThan(0);
  expectColor(await pixelAt(page, 0.25, 0.5), RED);
  expectColor(await pixelAt(page, 0.75, 0.5), BLUE);
  expect(errors).toEqual([]);
});

test('emits image:loaded and initial history state', async ({ page }) => {
  await setup(page);
  const events = await page.evaluate(() => (window as any).harness.events);
  const loaded = events.find((e: any) => e.name === 'image:loaded');
  expect(loaded.payload).toEqual({ width: 800, height: 600, downscaled: false });
});

test('jpeg export honours format', async ({ page }) => {
  await setup(page, { exportFormat: 'jpeg', exportQuality: 0.9 });
  const info = await exportInfo(page);
  expect(info).toMatchObject({ format: 'jpeg', fileType: 'image/jpeg' });
  expectSize(info, 800, 600);
});

test('rotateRight turns the image 90° clockwise', async ({ page }) => {
  await setup(page);
  await call(page, 'rotateRight');
  const info = await exportInfo(page);
  expectSize(info, 600, 800);
  // Left (red) half ends up on top after a clockwise turn.
  expectColor(await pixelAt(page, 0.5, 0.25), RED);
  expectColor(await pixelAt(page, 0.5, 0.75), BLUE);
});

test('four rotations return to the original orientation', async ({ page }) => {
  await setup(page);
  for (let i = 0; i < 4; i++) await call(page, 'rotateRight');
  const info = await exportInfo(page);
  expectSize(info, 800, 600);
  expectColor(await pixelAt(page, 0.25, 0.5), RED);
});

test('flipHorizontal mirrors the image', async ({ page }) => {
  await setup(page);
  await call(page, 'flipHorizontal');
  await exportInfo(page);
  expectColor(await pixelAt(page, 0.25, 0.5), BLUE);
  expectColor(await pixelAt(page, 0.75, 0.5), RED);
});

test('grayscale filter desaturates the export', async ({ page }) => {
  await setup(page);
  await call(page, 'applyFilterPreset', 'grayscale');
  await exportInfo(page);
  const [r, g, b] = await pixelAt(page, 0.25, 0.5);
  expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(4);
});

test('default crop keeps the centre 80% of the image', async ({ page }) => {
  await setup(page);
  await call(page, 'setMode', 'crop');
  await page.getByRole('button', { name: 'Apply Crop' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).harness.editor.getMode())).toBe('move');
  const info = await exportInfo(page);
  expectSize(info, 640, 480);
  expectColor(await pixelAt(page, 0.2, 0.5), RED);
  expectColor(await pixelAt(page, 0.8, 0.5), BLUE);
});

test('freehand stroke is exported, undone and redone', async ({ page }) => {
  await setup(page);
  await exportInfo(page);
  expect(await count(page, STROKE_BAND, 'red')).toBe(0);

  await drawStrokeOnBlueHalf(page);
  await call(page, 'setMode', 'move');
  await exportInfo(page);
  expect(await count(page, STROKE_BAND, 'red')).toBeGreaterThan(50);

  await call(page, 'undo');
  await exportInfo(page);
  expect(await count(page, STROKE_BAND, 'red')).toBe(0);

  await call(page, 'redo');
  await exportInfo(page);
  expect(await count(page, STROKE_BAND, 'red')).toBeGreaterThan(50);
});

test('annotation follows the image through a rotation', async ({ page }) => {
  await setup(page);
  await drawStrokeOnBlueHalf(page);
  await call(page, 'setMode', 'move');
  await call(page, 'rotateRight');
  const info = await exportInfo(page);
  expectSize(info, 600, 800);
  // Horizontal stroke on the right half becomes vertical in the bottom half.
  expect(await count(page, [0.45, 0.62, 0.55, 0.88], 'red')).toBeGreaterThan(50);
});

test('reset restores the original after rotate, filter and drawing', async ({ page }) => {
  await setup(page);
  await drawStrokeOnBlueHalf(page);
  await call(page, 'setMode', 'move');
  await call(page, 'rotateRight');
  await call(page, 'applyFilterPreset', 'grayscale');
  await call(page, 'reset');
  const info = await exportInfo(page);
  expectSize(info, 800, 600);
  expectColor(await pixelAt(page, 0.25, 0.5), RED);
  expect(await count(page, STROKE_BAND, 'red')).toBe(0);
});

test('undo of a rotation restores the previous orientation', async ({ page }) => {
  await setup(page);
  await call(page, 'rotateRight');
  await call(page, 'undo');
  const info = await exportInfo(page);
  expectSize(info, 800, 600);
  expectColor(await pixelAt(page, 0.25, 0.5), RED);
});

// Known bug in 1.5.10: undo restores the canvas but not the editor's
// cumulativeRotation, so the second rotate goes to 180° instead of 90°.
// Fixed by moving editor state into history snapshots; drop test.fail then.
test('rotating again after undoing a rotation uses the right angle', async ({ page }) => {
  test.fail();
  await setup(page);
  await call(page, 'rotateRight');
  await call(page, 'undo');
  await call(page, 'rotateRight');
  const info = await exportInfo(page);
  // One net clockwise turn.
  expectSize(info, 600, 800);
  expectColor(await pixelAt(page, 0.5, 0.25), RED);
});

test('destroy removes the editor DOM', async ({ page }) => {
  await setup(page);
  await call(page, 'destroy');
  const children = await page.evaluate(() => document.getElementById('host')!.children.length);
  expect(children).toBe(0);
});
