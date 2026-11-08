import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';

/**
 * Shell UI checks: accessibility (axe-core, WCAG 2.2 AA rules), layout
 * at phone width, keyboard support and the modal's focus handling.
 */

const FIXTURE = 'file://' + path.join(__dirname, 'fixture.html');
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function openModal(page: Page, theme: 'dark' | 'light' = 'dark') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FIXTURE);
  await page.evaluate((variant) => {
    const w = window as any;
    const img = w.harness.makeTestImage(800, 600);
    w.modalResult = 'pending';
    w.RpImageEditor.openEditorModal({
      image: img,
      config: { theme: { variant }, currentImageIndex: 2, totalImages: 5 },
    }).then((r: unknown) => { w.modalResult = r === null ? null : 'applied'; });
  }, theme);
  await expect(page.locator('.rp-ie-modal canvas').first()).toBeVisible();
  await page.waitForTimeout(300);
  return errors;
}

const tool = (page: Page, name: string) =>
  page.locator('.rp-ie-rail').getByRole('button', { name, exact: true });

async function expectNoAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .include('.rp-ie-modal')
    .withTags(WCAG_TAGS)
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`,
  );
  expect(summary, `${label} axe violations`).toEqual([]);
}

for (const theme of ['dark', 'light'] as const) {
  for (const [device, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`no WCAG violations: ${theme} theme, ${device}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const errors = await openModal(page, theme);
      await expectNoAxeViolations(page, 'select');
      for (const name of ['Draw', 'Crop', 'Filters', 'Adjust']) {
        await tool(page, name).click();
        await expectNoAxeViolations(page, name);
      }
      expect(errors).toEqual([]);
    });
  }
}

test('settings panel only shows for tools that have settings', async ({ page }) => {
  await openModal(page);
  await expect(page.locator('.rp-ie-props')).toBeHidden();
  await tool(page, 'Draw').click();
  await expect(page.locator('.rp-ie-props')).toBeVisible();
  await tool(page, 'Select').click();
  await expect(page.locator('.rp-ie-props')).toBeHidden();
});

test('crop panel holds rotate and flip', async ({ page }) => {
  await openModal(page);
  await tool(page, 'Crop').click();
  const group = page.getByRole('group', { name: 'Rotate & flip' });
  for (const name of ['Rotate Left', 'Rotate Right', 'Flip H', 'Flip V']) {
    await expect(group.getByRole('button', { name })).toBeVisible();
  }
});

test('filter tiles preview the photo', async ({ page }) => {
  await openModal(page);
  await tool(page, 'Filters').click();
  const previews = page.locator('.rp-ie-filter-preview');
  await expect(previews.first()).toBeVisible();
  expect(await previews.count()).toBe(7);
  const src = await previews.nth(1).getAttribute('src');
  expect(src?.startsWith('data:image/jpeg')).toBe(true);
});

test('phone: every header control fits and Close is reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openModal(page);
  const offscreen = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.rp-ie-topbar button')]
      .filter((b) => b.offsetParent)
      .filter((b) => {
        const r = b.getBoundingClientRect();
        return r.left < 0 || r.right > window.innerWidth;
      })
      .map((b) => b.getAttribute('aria-label') || b.textContent),
  );
  expect(offscreen).toEqual([]);
  const close = page.locator('[data-role="close"]');
  await expect(close).toBeVisible();
  const box = await close.boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
  // All nine tools are reachable in the bottom bar (by scrolling).
  expect(await page.locator('.rp-ie-rail .rp-ie-tile').count()).toBe(9);
});

test('focus stays inside the editor and returns to the opener on close', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => {
    const b = document.createElement('button');
    b.id = 'opener';
    b.textContent = 'Open';
    document.body.prepend(b);
  });
  await page.focus('#opener');
  await page.evaluate(() => {
    const w = window as any;
    w.RpImageEditor.openEditorModal({ image: w.harness.makeTestImage(800, 600) });
  });
  await expect(page.locator('.rp-ie-modal canvas').first()).toBeVisible();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.rp-ie-modal'))).toBe(true);
  }
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('.rp-ie-modal'))).toBe(true);
  await page.locator('[data-role="close"]').click();
  await expect(page.locator('.rp-ie-modal')).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('opener');
});

test('keyboard: Escape cancels crop, then clears selection, then closes', async ({ page }) => {
  await openModal(page);
  const mode = () => page.evaluate(() => document.querySelector('.rp-ie-tile--active')?.getAttribute('aria-label'));
  await tool(page, 'Crop').click();
  await page.keyboard.press('Escape');
  expect(await mode()).toBe('Select');
  expect(await page.evaluate(() => (window as any).modalResult)).toBe('pending');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => (window as any).modalResult)).toBeNull();
});

test('keyboard: arrow keys move the crop box', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => (window as any).harness.create({}, [800, 600]));
  const rect = () =>
    page.evaluate(() => {
      const c = (window as any).harness.editor.fabricCanvas;
      const r = c.getObjects().find((o: any) => o._rpCropRect);
      return { left: Math.round(r.left), top: Math.round(r.top) };
    });
  await page.evaluate(() => (window as any).harness.editor.setMode('crop'));
  await page.locator('#host button:visible').first().focus();
  // Opening the Crop panel resizes the canvas; wait for the box to settle.
  let prev = '';
  await expect.poll(async () => {
    const key = JSON.stringify(await rect());
    const stable = key === prev;
    prev = key;
    return stable;
  }).toBe(true);
  const before = await rect();
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('ArrowDown');
  const after = await rect();
  expect(after.left).toBe(before.left - 10);
  expect(after.top).toBe(before.top + 1);
});

test('keyboard: Delete removes the selected annotation', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => (window as any).harness.create({}, [800, 600]));
  const count = () =>
    page.evaluate(() =>
      (window as any).harness.editor.fabricCanvas.getObjects().filter((o: any) => o._rpAnnotation).length,
    );
  await page.evaluate(() => (window as any).harness.editor.setMode('text'));
  // Place a text annotation by clicking the image, then leave edit mode.
  const box = await page.locator('#host .upper-canvas').boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.keyboard.type('Hi');
  await page.evaluate(() => {
    const c = (window as any).harness.editor.fabricCanvas;
    const t = c.getActiveObject();
    t?.exitEditing?.();
    c.setActiveObject(t);
  });
  expect(await count()).toBeGreaterThan(0);
  await page.locator('#host button:visible').first().focus();
  const before = await count();
  await page.keyboard.press('Delete');
  expect(await count()).toBe(before - 1);
});

test('header controls never overlap or overflow, 320–1440px', async ({ page }) => {
  for (const width of [1440, 1024, 834, 700, 641, 640, 390, 320]) {
    await page.setViewportSize({ width, height: 800 });
    await openModal(page);
    const problems = await page.evaluate(() => {
      // The fixture's fixed-width inline host is not part of the modal.
      document.getElementById('host')!.style.display = 'none';
      const boxes = [...document.querySelectorAll<HTMLElement>('.rp-ie-topbar button, .rp-ie-image-counter, .rp-ie-brand__title')]
        .map((e) => ({ n: (e.getAttribute('aria-label') || e.textContent || '').trim(), r: e.getBoundingClientRect() }))
        .filter((b) => b.r.width > 0);
      const out: string[] = [];
      boxes.forEach((a, i) => boxes.slice(i + 1).forEach((c) => {
        if (a.r.left < c.r.right - 1 && c.r.left < a.r.right - 1 && a.r.top < c.r.bottom - 1 && c.r.top < a.r.bottom - 1) out.push(`${a.n} overlaps ${c.n}`);
      }));
      boxes.filter((b) => b.r.right > innerWidth + 1 || b.r.left < -1).forEach((b) => out.push(`${b.n} off-screen`));
      if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls sideways');
      return out;
    });
    expect(problems, `at ${width}px`).toEqual([]);
  }
});
