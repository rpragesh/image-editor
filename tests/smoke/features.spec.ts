import { test, expect, Page } from '@playwright/test';
import path from 'path';

/**
 * Feature sweep driven through the UI, the way a user works: click a tool,
 * use the canvas or the settings panel, then check the exported pixels.
 * Annotations are drawn in pure green so they're easy to find on the
 * red|blue test image.
 */

const FIXTURE = 'file://' + path.join(__dirname, 'fixture.html');
const GREEN = '#00ff00';

async function setup(page: Page, config: Record<string, unknown> = {}, size: [number, number] = [800, 600]) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FIXTURE);
  await page.evaluate(
    ([cfg, sz]) => (window as any).harness.create(cfg, sz),
    [{ defaultBrushColor: GREEN, defaultTextColor: GREEN, defaultShapeColor: GREEN, ...config }, size] as const,
  );
  return errors;
}

const host = (page: Page) => page.locator('#host');
const tool = (page: Page, name: string) => host(page).locator('.rp-ie-rail').getByRole('button', { name, exact: true });
const btn = (page: Page, name: string | RegExp) => host(page).getByRole('button', { name, exact: typeof name === 'string' }).first();

async function imageRect(page: Page) {
  let prev = '';
  let rect: any;
  await expect
    .poll(async () => {
      rect = await page.evaluate(() => (window as any).harness.imageScreenRect());
      const key = JSON.stringify(rect);
      const stable = key === prev;
      prev = key;
      return stable;
    })
    .toBe(true);
  return rect as { left: number; top: number; width: number; height: number };
}

/** Screen point at a fraction of the image. */
async function at(page: Page, fx: number, fy: number) {
  const r = await imageRect(page);
  return { x: r.left + r.width * fx, y: r.top + r.height * fy };
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const a = await at(page, ...from);
  const b = await at(page, ...to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(a.x + ((b.x - a.x) * i) / 12, a.y + ((b.y - a.y) * i) / 12);
  await page.mouse.up();
}

/** Export, then count pixels by colour class in a fractional rect of the export. */
async function exportAndCount(page: Page, rect: [number, number, number, number] = [0, 0, 1, 1]) {
  const info = await page.evaluate(() => (window as any).harness.exportInfo());
  const counts = await page.evaluate(([x0f, y0f, x1f, y1f]) => {
    const ctx = (window as any).harness._lastExport as CanvasRenderingContext2D;
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    const x0 = Math.floor(x0f * W), y0 = Math.floor(y0f * H);
    const d = ctx.getImageData(x0, y0, Math.max(1, Math.ceil(x1f * W) - x0), Math.max(1, Math.ceil(y1f * H) - y0)).data;
    const c = { green: 0, red: 0, blue: 0, other: 0 };
    for (let i = 0; i < d.length; i += 4) {
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
      if (g > 180 && r < 90 && b < 90) c.green++;
      else if (r > 200 && g < 60 && b < 60) c.red++;
      else if (b > 200 && r < 60 && g < 60) c.blue++;
      else c.other++;
    }
    return c;
  }, rect);
  return { ...info, ...counts };
}

const pixel = (page: Page, fx: number, fy: number) =>
  page.evaluate(([x, y]) => (window as any).harness.pixelAt(x, y), [fx, fy]);

/* ------------------------------------------------------------------ */

test('Draw: stroke via the UI, colour from a swatch, width from the slider', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Draw').click();
  await drag(page, [0.55, 0.3], [0.9, 0.3]);
  let r = await exportAndCount(page, [0.5, 0.2, 1, 0.4]);
  expect(r.green).toBeGreaterThan(200);

  // Thicker stroke → more green pixels.
  const slider = host(page).getByRole('slider', { name: 'Brush Size' });
  await slider.fill('30');
  await drag(page, [0.55, 0.7], [0.9, 0.7]);
  const thick = await exportAndCount(page, [0.5, 0.6, 1, 0.8]);
  expect(thick.green).toBeGreaterThan(r.green * 2);

  // A palette swatch changes the colour of the next stroke.
  const swatches = host(page).locator('.rp-ie-swatch');
  expect(await swatches.count()).toBeGreaterThan(1);
  await swatches.nth(1).click();
  const color = await page.evaluate(() => (window as any).harness.editor.fabricCanvas.freeDrawingBrush.color);
  expect(color.toLowerCase()).not.toBe(GREEN);
  expect(errors).toEqual([]);
});

test('Text: click to place, type, export shows it; undo removes it', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Text').click();
  const p = await at(page, 0.7, 0.5);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.type('HELLO WORLD');
  await page.evaluate(() => {
    const c = (window as any).harness.editor.fabricCanvas;
    c.getActiveObject()?.exitEditing?.();
    c.discardActiveObject();
    c.requestRenderAll();
  });
  const r = await exportAndCount(page);
  expect(r.green).toBeGreaterThan(50);
  const texts = await page.evaluate(() =>
    (window as any).harness.editor.fabricCanvas.getObjects().filter((o: any) => o._rpAnnotation).map((o: any) => o.text),
  );
  // Typing replaces the "Text" placeholder.
  expect(texts).toEqual(['HELLO WORLD']);

  // One Undo removes the whole text edit.
  await btn(page, /^Undo/).click();
  await expect.poll(async () => (await exportAndCount(page)).green).toBe(0);
  expect(errors).toEqual([]);
});

for (const shape of ['Rectangle', 'Square', 'Circle', 'Ellipse', 'Arrow'] as const) {
  test(`Shapes: ${shape} by dragging`, async ({ page }) => {
    const errors = await setup(page);
    await tool(page, 'Shapes').click();
    await host(page).getByRole('button', { name: shape, exact: true }).click();
    await drag(page, [0.55, 0.25], [0.9, 0.75]);
    const r = await exportAndCount(page, [0.5, 0.15, 0.95, 0.85]);
    expect(r.green, `${shape} pixels`).toBeGreaterThan(100);
    expect(errors).toEqual([]);
  });
}

test('Shapes: line path by clicking points, Enter to finish', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Shapes').click();
  await host(page).getByRole('button', { name: 'Line Path', exact: true }).click();
  for (const [fx, fy] of [[0.55, 0.3], [0.75, 0.6], [0.9, 0.3]] as const) {
    const p = await at(page, fx, fy);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(350); // not a double-click
  }
  await page.keyboard.press('Enter');
  const r = await exportAndCount(page, [0.5, 0.2, 0.95, 0.7]);
  expect(r.green).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('Callout: click places a callout that is exported', async ({ page }) => {
  const errors = await setup(page);
  const before = await exportAndCount(page);
  await tool(page, 'Callout').click();
  const p = await at(page, 0.7, 0.6);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(200);
  await page.evaluate(() => {
    const c = (window as any).harness.editor.fabricCanvas;
    c.getActiveObject()?.exitEditing?.();
    c.discardActiveObject();
    c.requestRenderAll();
  });
  const parts = await page.evaluate(() =>
    (window as any).harness.editor.fabricCanvas.getObjects().filter((o: any) => o._rpAnnotation).map((o: any) => o._rpType),
  );
  expect(parts.some((t: string) => String(t).startsWith('callout'))).toBe(true);
  const after = await exportAndCount(page);
  expect(after.other + after.green).toBeGreaterThan(before.other + before.green + 100);
  expect(errors).toEqual([]);
});

test('Eraser: clicking an annotation removes it', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Draw').click();
  await host(page).getByRole('slider', { name: 'Brush Size' }).fill('30');
  await drag(page, [0.55, 0.5], [0.9, 0.5]);
  expect((await exportAndCount(page)).green).toBeGreaterThan(200);
  await tool(page, 'Eraser').click();
  await drag(page, [0.6, 0.5], [0.85, 0.5]);
  await expect.poll(async () => (await exportAndCount(page)).green).toBeLessThan(20);
  expect(errors).toEqual([]);
});

test('Filters: every preset changes the export as expected', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Filters').click();
  const tiles = host(page).locator('.rp-ie-filter-tile');
  const seen = new Set<string>();
  for (const name of ['Sepia', 'Vintage', 'Cool', 'Warm', 'Invert', 'B & W']) {
    await tiles.filter({ hasText: name }).click();
    await exportAndCount(page);
    const red = await pixel(page, 0.25, 0.5);
    seen.add(red.slice(0, 3).join(','));
    if (name === 'Invert') expect(red.slice(0, 3)).toEqual([0, 255, 255]);
    if (name === 'B & W') expect(Math.abs(red[0] - red[1]) + Math.abs(red[1] - red[2])).toBeLessThan(6);
  }
  expect(seen.size, 'each preset looks different').toBe(6);
  await tiles.filter({ hasText: 'Original' }).click();
  await exportAndCount(page);
  expect((await pixel(page, 0.25, 0.5)).slice(0, 3)).toEqual([255, 0, 0]);
  expect(errors).toEqual([]);
});

test('Adjust: brightness, contrast, saturation and blur sliders affect the export', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Adjust').click();
  const check = async (name: string, value: string, test: (px: number[]) => boolean) => {
    await host(page).getByRole('slider', { name }).fill(value);
    await exportAndCount(page);
    const px = await pixel(page, 0.25, 0.5);
    expect(test(px), `${name}=${value} → ${px}`).toBe(true);
    await host(page).getByRole('slider', { name }).fill('0');
  };
  await check('Brightness', '-60', (p) => p[0] < 200);
  await check('Saturation', '-100', (p) => p[1] > 30 && Math.abs(p[1] - p[2]) < 10);
  await check('Contrast', '-80', (p) => p[0] < 230 && p[1] > 20);
  // Each slider release is one undo step.
  await host(page).getByRole('slider', { name: 'Brightness' }).fill('-60');
  await exportAndCount(page);
  expect((await pixel(page, 0.25, 0.5))[0]).toBeLessThan(200);
  await btn(page, /^Undo/).click();
  await expect.poll(async () => { await exportAndCount(page); return (await pixel(page, 0.25, 0.5))[0]; }).toBe(255);

  await host(page).getByRole('slider', { name: 'Blur' }).fill('60');
  await exportAndCount(page);
  const edge = await pixel(page, 0.5, 0.5); // red|blue border gets mixed
  expect(edge[0] > 20 && edge[2] > 20, `blurred edge ${edge}`).toBe(true);
  expect(errors).toEqual([]);
});

test('Crop via the panel: 1:1 then Apply Crop exports a square', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Crop').click();
  await host(page).locator('.rp-ie-chip', { hasText: /^1:1$/ }).click();
  await host(page).getByRole('button', { name: 'Apply Crop' }).click();
  const r = await exportAndCount(page);
  expect(Math.abs(r.width - r.height)).toBeLessThanOrEqual(2);
  expect(r.width).toBeLessThan(800);
  await expect(host(page).locator('.rp-ie-tile--active')).toHaveAttribute('aria-label', 'Select');
  expect(errors).toEqual([]);
});

test('Crop by dragging a corner handle, then Apply Crop', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Crop').click();
  await imageRect(page);
  const corner = await page.evaluate(() => {
    const c = (window as any).harness.editor.fabricCanvas;
    const r = c.getObjects().find((o: any) => o._rpCropRect);
    r.setCoords();
    const br = r.oCoords.br;
    const el = c.upperCanvasEl.getBoundingClientRect();
    return { x: el.left + br.x, y: el.top + br.y };
  });
  await page.mouse.move(corner.x, corner.y);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(corner.x - 12 * i, corner.y - 8 * i);
  await page.mouse.up();
  await host(page).getByRole('button', { name: 'Apply Crop' }).click();
  const r = await exportAndCount(page);
  // Default box keeps 80% (640×480); dragging inwards must make it smaller.
  expect(r.width).toBeLessThan(620);
  expect(r.height).toBeLessThan(465);
  expect(errors).toEqual([]);
});

test('Flip vertical moves a top annotation to the bottom', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Draw').click();
  await host(page).getByRole('slider', { name: 'Brush Size' }).fill('20');
  await drag(page, [0.55, 0.15], [0.9, 0.15]);
  await tool(page, 'Crop').click();
  await host(page).getByRole('group', { name: 'Rotate & flip' }).getByRole('button', { name: 'Flip V' }).click();
  await tool(page, 'Select').click();
  const top = await exportAndCount(page, [0, 0, 1, 0.3]);
  const bottom = await exportAndCount(page, [0, 0.7, 1, 1]);
  expect(top.green).toBeLessThan(10);
  expect(bottom.green).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('Zoom in, pan and draw: export is always the whole image with the stroke in place', async ({ page }) => {
  const errors = await setup(page);
  await btn(page, /^Zoom In/).click();
  await btn(page, /^Zoom In/).click();
  expect(await page.evaluate(() => (window as any).harness.editor.fabricCanvas.getZoom())).toBeGreaterThan(1.2);
  // Pan in Select mode.
  const before = await page.evaluate(() => (window as any).harness.editor.fabricCanvas.viewportTransform[4]);
  const c = await host(page).locator('.upper-canvas').boundingBox();
  await page.mouse.move(c!.x + c!.width / 2, c!.y + c!.height / 2);
  await page.mouse.down();
  await page.mouse.move(c!.x + c!.width / 2 + 60, c!.y + c!.height / 2, { steps: 6 });
  await page.mouse.up();
  const after = await page.evaluate(() => (window as any).harness.editor.fabricCanvas.viewportTransform[4]);
  expect(after).not.toBe(before);

  await tool(page, 'Draw').click();
  await drag(page, [0.6, 0.5], [0.8, 0.5]);
  // Zoom is view-only: even while zoomed in, the whole image is exported.
  const zoomed = await exportAndCount(page, [0.55, 0.4, 0.85, 0.6]);
  expect([zoomed.width, zoomed.height]).toEqual([800, 600]);
  expect(zoomed.green).toBeGreaterThan(100);
  // Edges that are scrolled out of view are still in the export.
  for (const [fx, fy, color] of [[0.02, 0.02, [255, 0, 0]], [0.98, 0.98, [0, 0, 255]]] as const) {
    expect((await pixel(page, fx, fy)).slice(0, 3), `pixel ${fx},${fy}`).toEqual(color);
  }

  await page.locator('#host button').first().focus();
  await page.keyboard.press('0'); // fit = 100%
  const r = await exportAndCount(page, [0.55, 0.4, 0.85, 0.6]);
  expect(r.width).toBe(800);
  expect(r.height).toBe(600);
  expect(r.green).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('Text: a box left empty is removed', async ({ page }) => {
  await setup(page);
  await tool(page, 'Text').click();
  const p = await at(page, 0.5, 0.5);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Backspace');
  await page.evaluate(() => (window as any).harness.editor.fabricCanvas.getActiveObject()?.exitEditing?.());
  await expect
    .poll(() => page.evaluate(() => (window as any).harness.editor.fabricCanvas.getObjects().filter((o: any) => o._rpAnnotation).length))
    .toBe(0);
  await expect(host(page).getByRole('button', { name: /^Undo/ }).first()).toBeDisabled();
});

test('Reset button undoes everything done through the UI', async ({ page }) => {
  const errors = await setup(page);
  await tool(page, 'Draw').click();
  await drag(page, [0.55, 0.5], [0.9, 0.5]);
  await tool(page, 'Filters').click();
  await host(page).locator('.rp-ie-filter-tile', { hasText: 'Invert' }).click();
  await btn(page, /^Reset/).click();
  // Reset may confirm first.
  const confirm = page.getByRole('button', { name: /^(Reset|Confirm|Yes)/ }).last();
  if (await confirm.isVisible().catch(() => false)) await confirm.click().catch(() => {});
  await expect.poll(async () => {
    const r = await exportAndCount(page);
    return r.green === 0 && (await pixel(page, 0.25, 0.5)).slice(0, 3).join(',') === '255,0,0';
  }).toBe(true);
  expect(errors).toEqual([]);
});

test('Undo and redo buttons step through UI edits', async ({ page }) => {
  await setup(page);
  await tool(page, 'Shapes').click();
  await host(page).getByRole('button', { name: 'Rectangle', exact: true }).click();
  await drag(page, [0.55, 0.25], [0.9, 0.75]);
  expect((await exportAndCount(page)).green).toBeGreaterThan(100);
  await btn(page, /^Undo/).click();
  await expect.poll(async () => (await exportAndCount(page)).green).toBe(0);
  await btn(page, /^Redo/).click();
  await expect.poll(async () => (await exportAndCount(page)).green).toBeGreaterThan(100);
});

test('disabledFeatures hides those tools and controls', async ({ page }) => {
  await setup(page, { disabledFeatures: ['filters', 'crop', 'callout', 'zoom'] });
  const tools = await host(page).locator('.rp-ie-rail .rp-ie-tile').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
  expect(tools).not.toContain('Filters');
  expect(tools).not.toContain('Crop');
  expect(tools).not.toContain('Callout');
  expect(tools).toContain('Draw');
  await expect(host(page).locator('[data-quick-id="zoomIn"]')).toHaveCount(0);
});

test('language: German labels', async ({ page }) => {
  const errors = await setup(page, { language: 'de' });
  await expect(tool(page, 'Zuschneiden')).toBeVisible();
  await tool(page, 'Zuschneiden').click();
  await expect(host(page).getByRole('group', { name: 'Drehen & spiegeln' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('fullscreen button toggles without errors', async ({ page }) => {
  const errors = await setup(page);
  await btn(page, /^Fullscreen/).click();
  await page.waitForTimeout(300);
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen());
  await page.waitForTimeout(300);
  const r = await exportAndCount(page);
  expect(r.width).toBe(800);
  expect(errors).toEqual([]);
});

test('multi-image: annotations on an image you switched away from are exported', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => {
    const w = window as any;
    document.getElementById('host')!.style.display = 'none';
    w.multi = 'pending';
    w.RpImageEditor.openMultiEditorModal({
      images: [w.harness.makeTestImage(800, 600), w.harness.makeTestImage(400, 300)],
      config: { defaultBrushColor: '#00ff00' },
    }).then(async (r: any) => {
      const out = [];
      for (const x of r) {
        const img = new Image();
        img.src = x.result.base64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let green = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 180 && d[i] < 90 && d[i + 2] < 90) green++;
        out.push({ edited: x.edited, w: x.result.width, green });
      }
      w.multi = out;
    });
  });
  const pane = page.locator('.rp-ie-multi__pane:not(.rp-ie-multi__pane--hidden)');
  await expect(page.locator('.rp-ie-strip')).toBeVisible();
  await pane.locator('.rp-ie-rail').getByRole('button', { name: 'Draw', exact: true }).click();
  await page.waitForTimeout(300);
  const box = await pane.locator('.upper-canvas').boundingBox();
  await page.mouse.move(box!.x + box!.width * 0.4, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.locator('.rp-ie-thumb').nth(1).click();
  await expect(page.locator('.rp-ie-thumb').nth(1)).toHaveAttribute('aria-current', 'true');
  await page.locator('.rp-ie-multi__pane:not(.rp-ie-multi__pane--hidden) .rp-ie-apply').click();
  await expect.poll(() => page.evaluate(() => (window as any).multi)).not.toBe('pending');
  const res = await page.evaluate(() => (window as any).multi);
  expect(res[0].edited).toBe(true);
  expect(res[0].w).toBe(800);
  expect(res[0].green).toBeGreaterThan(200);
  expect(res[1]).toEqual({ edited: false, w: 400, green: 0 });
});

test('multi-image: an Adjust-only edit counts as an edit', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => {
    const w = window as any;
    document.getElementById('host')!.style.display = 'none';
    w.RpImageEditor.openMultiEditorModal({ images: [w.harness.makeTestImage(800, 600), w.harness.makeTestImage(400, 300)] });
  });
  const pane = page.locator('.rp-ie-multi__pane:not(.rp-ie-multi__pane--hidden)');
  await expect(page.locator('.rp-ie-strip')).toBeVisible();
  await pane.locator('.rp-ie-rail').getByRole('button', { name: 'Adjust', exact: true }).click();
  await pane.getByRole('slider', { name: 'Brightness' }).fill('40');
  await expect(page.locator('.rp-ie-thumb').first()).toHaveClass(/rp-ie-thumb--edited/);
  await pane.locator('[data-role="close"]').click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('opening panels and resizing never create undo steps by themselves', async ({ page }) => {
  await setup(page);
  for (const name of ['Draw', 'Select', 'Filters', 'Select', 'Text', 'Select']) {
    await tool(page, name).click();
    await imageRect(page);
  }
  await page.evaluate(() => { document.getElementById('host')!.style.width = '700px'; });
  await imageRect(page);
  // Something that saves without changing anything visible.
  await page.evaluate(() => (window as any).harness.editor.historyModule.saveState());
  await expect(host(page).getByRole('button', { name: /^Undo/ }).first()).toBeDisabled();
});

test('a resize while typing (e.g. phone keyboard) keeps the text undoable in one step', async ({ page }) => {
  await setup(page);
  await tool(page, 'Text').click();
  const p = await at(page, 0.5, 0.5);
  await page.mouse.click(p.x, p.y);
  await page.keyboard.type('Hi');
  await page.evaluate(() => { document.getElementById('host')!.style.height = '500px'; });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).harness.editor.fabricCanvas.getActiveObject()?.exitEditing?.());
  const count = () => page.evaluate(() => (window as any).harness.editor.fabricCanvas.getObjects().filter((o: any) => o._rpAnnotation).length);
  expect(await count()).toBe(1);
  await host(page).getByRole('button', { name: /^Undo/ }).first().click();
  await expect.poll(count).toBe(0);
  await expect(host(page).getByRole('button', { name: /^Undo/ }).first()).toBeDisabled();
});
