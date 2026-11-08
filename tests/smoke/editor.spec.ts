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

async function setup(page: Page, config: Record<string, unknown> = {}, size: [number, number] = [800, 600]) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FIXTURE);
  await page.evaluate(([cfg, sz]) => (window as any).harness.create(cfg, sz), [config, size] as const);
  return errors;
}

const exportInfo = (page: Page) => page.evaluate(() => (window as any).harness.exportInfo());
const pixelAt = (page: Page, fx: number, fy: number) =>
  page.evaluate(([x, y]) => (window as any).harness.pixelAt(x, y), [fx, fy]);
const count = (page: Page, rect: [number, number, number, number], kind: 'red' | 'blue') =>
  page.evaluate(([r, k]) => (window as any).harness.countPixels(...(r as number[]), k), [rect, kind] as const);
const call = (page: Page, method: string, ...args: unknown[]) =>
  page.evaluate(([m, a]) => (window as any).harness.editor[m as string](...(a as unknown[])), [method, args] as const);

/** Full-image exports must match exactly; pass `tol` where geometry legitimately rounds (crop). */
function expectSize(info: { width: number; height: number }, w: number, h: number, tol = 0) {
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

test('odd-sized image exports at exact native size, also after rotation', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => (window as any).harness.create({}, [1234, 777]));
  expectSize(await exportInfo(page), 1234, 777);
  await call(page, 'rotateRight');
  expectSize(await exportInfo(page), 777, 1234);
});

test('exportPixelRatio scales the native size', async ({ page }) => {
  await setup(page, { exportPixelRatio: 2 });
  expectSize(await exportInfo(page), 1600, 1200);
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
  expectSize(info, 640, 480, 2);
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

// Regression: up to 1.5.11 undo restored the canvas but not the editor's
// cumulativeRotation, so the second rotate went to 180° instead of 90°.
test('rotating again after undoing a rotation uses the right angle', async ({ page }) => {
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

/* ── Keyboard shortcuts ─────────────────────────────────────────── */

/** Mount a second editor in its own host; returns it as window.second. */
async function mountSecondEditor(page: Page) {
  await page.evaluate(async () => {
    const h = (window as any).harness;
    const host = document.createElement('div');
    host.id = 'host2';
    host.style.cssText = 'width:600px;height:400px;position:relative';
    document.body.appendChild(host);
    const second = new (window as any).RpImageEditor.RpImageEditor(host, { exportFormat: 'png' });
    await second.loadImage(h.makeTestImage());
    (window as any).second = second;
  });
}

/** Export size of window.harness.editor (first) or window.second. */
async function sizeOf(page: Page, which: 'first' | 'second') {
  return page.evaluate(async (w) => {
    const ed = w === 'first' ? (window as any).harness.editor : (window as any).second;
    const r = await ed.getResult();
    return { width: r.width, height: r.height };
  }, which);
}

/** Poll until an editor's export reaches the expected size (rotation is async). */
async function expectSizeSoon(page: Page, which: 'first' | 'second', w: number, h: number) {
  await expect.poll(() => sizeOf(page, which)).toEqual({ width: w, height: h });
}

/** Press a key and give an async rotate time to settle. */
async function pressAndSettle(page: Page, key: string) {
  await page.keyboard.press(key);
  await page.waitForTimeout(150);
}

test('shortcut R rotates a single editor with focus on the page body', async ({ page }) => {
  await setup(page);
  await page.keyboard.press('r');
  await expectSizeSoon(page, 'first', 600, 800);
});

test('with two editors, only the most recently active one handles shortcuts', async ({ page }) => {
  await setup(page);
  await mountSecondEditor(page);

  // Newest editor is active.
  await page.keyboard.press('r');
  await expectSizeSoon(page, 'second', 600, 800);
  expectSize(await sizeOf(page, 'first'), 800, 600);

  // Clicking into the first editor makes it the active one.
  await page.locator('#host .upper-canvas').dispatchEvent('pointerdown');
  await page.keyboard.press('r');
  await expectSizeSoon(page, 'first', 600, 800);
  expectSize(await sizeOf(page, 'second'), 600, 800);
});

test('destroying the active editor hands shortcuts to the remaining one', async ({ page }) => {
  await setup(page);
  await mountSecondEditor(page);
  await page.evaluate(() => (window as any).second.destroy());
  await page.keyboard.press('r');
  await expectSizeSoon(page, 'first', 600, 800);
});

test("keyboardShortcutsScope 'editor' ignores keys from outside the editor", async ({ page }) => {
  await setup(page, { keyboardShortcutsScope: 'editor' });
  await pressAndSettle(page, 'r');
  expectSize(await exportInfo(page), 800, 600);

  // Focus a control inside the editor: shortcuts work again.
  await page.locator('#host button:visible:not([disabled])').first().focus();
  expect(await page.evaluate(() => document.getElementById('host')!.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('r');
  await expectSizeSoon(page, 'first', 600, 800);
});

/* ── Undo/redo of image-level edits ─────────────────────────────── */

async function applyDefaultCrop(page: Page) {
  await call(page, 'setMode', 'crop');
  await page.getByRole('button', { name: 'Apply Crop' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).harness.editor.getMode())).toBe('move');
}

const effects = (page: Page) => page.evaluate(() => (window as any).harness.editor.getImageEffects());

test('undo of a crop restores the full image, and rotating afterwards uses it', async ({ page }) => {
  await setup(page);
  await applyDefaultCrop(page);
  expectSize(await exportInfo(page), 640, 480, 2);

  await call(page, 'undo');
  expectSize(await exportInfo(page), 800, 600);

  await call(page, 'rotateRight');
  expectSize(await exportInfo(page), 600, 800);
  expectColor(await pixelAt(page, 0.5, 0.25), RED);
});

test('redo of a crop re-applies it', async ({ page }) => {
  await setup(page);
  await applyDefaultCrop(page);
  await call(page, 'undo');
  await call(page, 'redo');
  expectSize(await exportInfo(page), 640, 480, 2);
});

test('undo/redo of a filter restores pixels and the reported preset', async ({ page }) => {
  await setup(page);
  await call(page, 'applyFilterPreset', 'grayscale');
  await call(page, 'undo');
  expect((await effects(page)).preset).toBe('none');
  await exportInfo(page);
  expectColor(await pixelAt(page, 0.25, 0.5), RED);

  await call(page, 'redo');
  expect((await effects(page)).preset).toBe('grayscale');
  await exportInfo(page);
  const [r, g, b] = await pixelAt(page, 0.25, 0.5);
  expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(4);
});

test('undo of a flip restores the original orientation', async ({ page }) => {
  await setup(page);
  await call(page, 'flipHorizontal');
  await call(page, 'undo');
  await exportInfo(page);
  expectColor(await pixelAt(page, 0.25, 0.5), RED);
  expectColor(await pixelAt(page, 0.75, 0.5), BLUE);
});

test('redo of an undone rotation rotates again', async ({ page }) => {
  await setup(page);
  await call(page, 'rotateRight');
  await call(page, 'undo');
  await call(page, 'redo');
  expectSize(await exportInfo(page), 600, 800);
  expectColor(await pixelAt(page, 0.5, 0.25), RED);
});

test('step-by-step undo through crop, rotate and filter', async ({ page }) => {
  await setup(page);
  await applyDefaultCrop(page);
  await call(page, 'rotateRight');
  await call(page, 'applyFilterPreset', 'grayscale');

  await call(page, 'undo'); // filter
  expect((await effects(page)).preset).toBe('none');
  expectSize(await exportInfo(page), 480, 640, 2);
  expectColor(await pixelAt(page, 0.5, 0.2), RED);

  await call(page, 'undo'); // rotate
  expectSize(await exportInfo(page), 640, 480, 2);

  await call(page, 'undo'); // crop
  expectSize(await exportInfo(page), 800, 600);
  expectColor(await pixelAt(page, 0.25, 0.5), RED);
});

test('drawing survives rotate + undo at its original position', async ({ page }) => {
  await setup(page);
  await drawStrokeOnBlueHalf(page);
  await call(page, 'setMode', 'move');
  await call(page, 'rotateRight');
  await call(page, 'undo');
  expectSize(await exportInfo(page), 800, 600);
  expect(await count(page, STROKE_BAND, 'red')).toBeGreaterThan(50);
});

test('history snapshots do not embed the image', async ({ page }) => {
  await setup(page, {}, [1600, 1200]);
  await call(page, 'rotateRight');
  await drawStrokeOnBlueHalf(page);
  await call(page, 'setMode', 'move');
  const sizes = await page.evaluate(() => {
    const h = (window as any).harness.editor.historyModule;
    return [...h.undoStack, ...h.redoStack].map((e: any) => e.canvas.length + e.extraKey.length);
  });
  expect(sizes.length).toBeGreaterThanOrEqual(3);
  // A 1600×1200 PNG data URL is far larger; snapshots should be a few KB.
  for (const s of sizes) expect(s).toBeLessThan(20_000);
});

/* ── Flip and filters combined with rotate/crop ─────────────────── */

// Regression: up to 1.5.11 rotating rebuilt the image without its flip.
test('rotating a flipped image keeps it flipped, with annotations aligned', async ({ page }) => {
  await setup(page);
  await drawStrokeOnBlueHalf(page);
  await call(page, 'setMode', 'move');
  await call(page, 'flipHorizontal');
  await call(page, 'rotateRight');
  expectSize(await exportInfo(page), 600, 800);
  // Flipped: blue on the left, which a clockwise turn puts on top.
  expectColor(await pixelAt(page, 0.2, 0.1), BLUE);
  expectColor(await pixelAt(page, 0.5, 0.9), RED);
  // The stroke was on the blue half, so it is now vertical in the top half.
  expect(await count(page, [0.45, 0.12, 0.55, 0.38], 'red')).toBeGreaterThan(50);

  // Sample above the stroke (y = 0.3), which now runs across the left half.
  await call(page, 'rotateRight');
  expectSize(await exportInfo(page), 800, 600);
  expectColor(await pixelAt(page, 0.25, 0.3), RED);

  await call(page, 'undo');
  await call(page, 'undo');
  await exportInfo(page);
  expectColor(await pixelAt(page, 0.25, 0.3), BLUE);
  expect(await count(page, [0.12, 0.45, 0.38, 0.55], 'red')).toBeGreaterThan(50);
});

test('cropping a flipped image keeps it flipped', async ({ page }) => {
  await setup(page);
  await call(page, 'flipHorizontal');
  await applyDefaultCrop(page);
  expectSize(await exportInfo(page), 640, 480, 2);
  expectColor(await pixelAt(page, 0.2, 0.5), BLUE);
  expectColor(await pixelAt(page, 0.8, 0.5), RED);

  await call(page, 'rotateRight');
  expectSize(await exportInfo(page), 480, 640, 2);
  expectColor(await pixelAt(page, 0.5, 0.2), BLUE);
});

// Regression: up to 1.5.11 crop baked the filter in and then re-applied it.
test('cropping with a filter active applies the filter only once', async ({ page }) => {
  await setup(page);
  await call(page, 'applyFilterPreset', 'sepia');
  await exportInfo(page);
  const before = await pixelAt(page, 0.25, 0.5);
  await applyDefaultCrop(page);
  await exportInfo(page);
  expectColor(await pixelAt(page, 0.2, 0.5), before, 3);

  // Removing the filter afterwards gives back the untouched pixels.
  await call(page, 'applyFilterPreset', 'none');
  await exportInfo(page);
  expectColor(await pixelAt(page, 0.2, 0.5), RED);
});
