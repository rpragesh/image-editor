import { test, expect, Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';

/**
 * openMultiEditorModal: thumbnail strip, per-image editors and undo,
 * lazy loading, discard prompt and the per-image export.
 */

const FIXTURE = 'file://' + path.join(__dirname, 'fixture.html');
const SIZES = [
  [800, 600],
  [400, 300],
  [640, 480],
];

async function openMulti(page: Page, theme: 'dark' | 'light' = 'dark') {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(FIXTURE);
  await page.evaluate(
    ({ sizes, variant }) => {
      const w = window as any;
      document.getElementById('host')!.style.display = 'none';
      w.multiResult = 'pending';
      w.RpImageEditor.openMultiEditorModal({
        images: sizes.map(([a, b]: number[]) => w.harness.makeTestImage(a, b)),
        config: { theme: { variant } },
      }).then((r: any) => {
        w.multiResult = r === null ? null : r.map((x: any) => ({
          index: x.index, edited: x.edited, width: x.result.width, height: x.result.height,
        }));
      });
    },
    { sizes: SIZES, variant: theme },
  );
  await expect(page.locator('.rp-ie-strip')).toBeVisible();
  return errors;
}

const thumb = (page: Page, i: number) => page.locator('.rp-ie-thumb').nth(i);
const visibleShell = (page: Page) => page.locator('.rp-ie-multi__pane:not(.rp-ie-multi__pane--hidden)');
const result = (page: Page) => page.evaluate(() => (window as any).multiResult);

test('strip shows every image and switches between them', async ({ page }) => {
  const errors = await openMulti(page);
  await expect(page.locator('.rp-ie-thumb')).toHaveCount(3);
  await expect(thumb(page, 0)).toHaveAttribute('aria-current', 'true');
  await expect(thumb(page, 0)).toHaveAttribute('aria-label', 'Image 1 of 3');
  // Only the first image is loaded up front.
  await expect(page.locator('.rp-ie-multi__pane')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Previous image' })).toBeDisabled();

  await thumb(page, 2).click();
  await expect(thumb(page, 2)).toHaveAttribute('aria-current', 'true');
  await expect(visibleShell(page).locator('.rp-ie-image-counter')).toHaveText(/3\s*\/\s*3/);
  await expect(page.getByRole('button', { name: 'Next image' })).toBeDisabled();
  await expect(page.locator('.rp-ie-multi__pane')).toHaveCount(2);

  await page.getByRole('button', { name: 'Previous image' }).click();
  await expect(thumb(page, 1)).toHaveAttribute('aria-current', 'true');
  expect(errors).toEqual([]);
});

test('each image keeps its own edits and undo; Apply exports all of them', async ({ page }) => {
  await openMulti(page);
  // Rotate image 1.
  await visibleShell(page).locator('.rp-ie-rail').getByRole('button', { name: 'Crop', exact: true }).click();
  await visibleShell(page).getByRole('group', { name: 'Rotate & flip' }).getByRole('button', { name: 'Rotate Right' }).click();
  await expect(thumb(page, 0)).toHaveClass(/rp-ie-thumb--edited/);
  await expect(thumb(page, 0)).toHaveAttribute('aria-label', 'Image 1 of 3, edited');

  // Image 2 starts clean.
  await thumb(page, 1).click();
  await expect(thumb(page, 1)).toHaveAttribute('aria-current', 'true');
  await expect(visibleShell(page).getByRole('button', { name: /^Undo/ })).toBeDisabled();

  // Back on image 1, its undo history is still there.
  await thumb(page, 0).click();
  await expect(thumb(page, 0)).toHaveAttribute('aria-current', 'true');
  await expect(visibleShell(page).getByRole('button', { name: /^Undo/ })).toBeEnabled();

  await visibleShell(page).locator('.rp-ie-apply').click();
  await expect.poll(() => result(page)).not.toBe('pending');
  expect(await result(page)).toEqual([
    { index: 0, edited: true, width: 600, height: 800 },
    { index: 1, edited: false, width: 400, height: 300 },
    // Never opened: exported anyway, untouched.
    { index: 2, edited: false, width: 640, height: 480 },
  ]);
  await expect(page.locator('.rp-ie-modal')).toHaveCount(0);
});

test('undoing every edit clears the edited mark', async ({ page }) => {
  await openMulti(page);
  await page.keyboard.press('r');
  await expect(thumb(page, 0)).toHaveClass(/rp-ie-thumb--edited/);
  await visibleShell(page).getByRole('button', { name: /^Undo/ }).click();
  await expect(thumb(page, 0)).not.toHaveClass(/rp-ie-thumb--edited/);
});

test('Close without edits closes right away', async ({ page }) => {
  await openMulti(page);
  await thumb(page, 1).click();
  await expect(thumb(page, 1)).toHaveAttribute('aria-current', 'true');
  await visibleShell(page).locator('[data-role="close"]').click();
  await expect.poll(() => result(page)).toBeNull();
  await expect(page.locator('.rp-ie-modal')).toHaveCount(0);
});

test('Close with edits asks first; Keep editing and Escape go back, Discard closes', async ({ page }) => {
  await openMulti(page);
  await page.keyboard.press('r');
  await expect(thumb(page, 0)).toHaveClass(/rp-ie-thumb--edited/);

  await visibleShell(page).locator('[data-role="close"]').click();
  const dialog = page.getByRole('alertdialog', { name: 'Discard changes to 1 image?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep editing' })).toBeFocused();
  // Tab stays inside the prompt.
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('.rp-ie-confirm'))).toBe(true);
  }
  await dialog.getByRole('button', { name: 'Keep editing' }).click();
  await expect(dialog).toHaveCount(0);
  expect(await result(page)).toBe('pending');

  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await result(page)).toBe('pending');

  await visibleShell(page).locator('[data-role="close"]').click();
  await dialog.getByRole('button', { name: 'Discard' }).click();
  await expect.poll(() => result(page)).toBeNull();
});

test('a broken image is marked and skipped', async ({ page }) => {
  page.on('console', () => {});
  await page.goto(FIXTURE);
  await page.evaluate(() => {
    const w = window as any;
    document.getElementById('host')!.style.display = 'none';
    w.multiResult = 'pending';
    w.RpImageEditor.openMultiEditorModal({
      images: [w.harness.makeTestImage(800, 600), 'data:image/png;base64,bm90IGFuIGltYWdl'],
    }).then((r: any) => { w.multiResult = r && r.map((x: any) => x.index); });
  });
  await expect(page.locator('.rp-ie-strip')).toBeVisible();
  await thumb(page, 1).click();
  await expect(thumb(page, 1)).toHaveClass(/rp-ie-thumb--failed/);
  await expect(thumb(page, 0)).toHaveAttribute('aria-current', 'true');
  await visibleShell(page).locator('.rp-ie-apply').click();
  await expect.poll(() => result(page)).toEqual([0]);
});

for (const theme of ['dark', 'light'] as const) {
  for (const [device, viewport] of [
    ['desktop', { width: 1280, height: 800 }],
    ['phone', { width: 390, height: 844 }],
  ] as const) {
    test(`multi-image: no WCAG violations, ${theme}, ${device}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openMulti(page, theme);
      await page.keyboard.press('r');
      await expect(thumb(page, 0)).toHaveClass(/rp-ie-thumb--edited/);
      const axe = async (label: string) => {
        const r = await new AxeBuilder({ page })
          .include('.rp-ie-modal')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`), label).toEqual([]);
      };
      await axe('strip');
      // The strip and Close stay on screen.
      const box = await page.locator('.rp-ie-strip').boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      await visibleShell(page).locator('[data-role="close"]').click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await axe('discard prompt');
    });
  }
}

test('zoom never goes below 100% (fit)', async ({ page }) => {
  await page.goto(FIXTURE);
  await page.evaluate(() => (window as any).harness.create({}, [800, 600]));
  const zoom = () => page.evaluate(() => (window as any).harness.editor.fabricCanvas.getZoom());
  expect(await zoom()).toBe(1);
  await expect(page.locator('#host').locator('[data-quick-id="zoomOut"]')).toBeDisabled();
  await page.evaluate(() => (window as any).harness.editor.setZoom(0.5));
  expect(await zoom()).toBe(1);
  const canvas = await page.locator('#host .upper-canvas').boundingBox();
  await page.mouse.move(canvas!.x + canvas!.width / 2, canvas!.y + canvas!.height / 2);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(100);
  expect(await zoom()).toBe(1);
});
