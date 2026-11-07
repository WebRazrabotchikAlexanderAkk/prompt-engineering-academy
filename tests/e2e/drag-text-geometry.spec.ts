import { test, expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const width of [360, 1280, 1912]) for (const theme of ['light', 'dark']) {
  test(`пары ${width}px ${theme}: копия сохраняет геометрию текста при захвате`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 1800 });
    await page.goto('/articles/how-llms-work/');
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    const editor = page.locator('[data-exercise-type="MatchPairs"]');
    await editor.scrollIntoViewIfNeeded();
    await expect(editor.locator('[data-drag-id]').first()).toHaveAttribute('aria-roledescription', 'draggable');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveTitle(/Как работают LLM/);
    await expect(page.locator('astro-error-overlay')).toHaveCount(0);

    // Check every description, including a source already assigned by button.
    for (const index of [0, 1, 2]) {
      const source = editor.locator('[data-drag-id]').nth(index);
      if (index === 1) await editor.getByRole('button', { name: /^Назначить описание:/ }).nth(index).click();
      const descriptionBefore = await editor.locator('[data-drop-id] p[aria-hidden="false"]').innerText();
      const scrollBefore = await page.evaluate(() => scrollY);
      const start = await source.boundingBox();
      if (!start) throw Error('Ручка не найдена');
      await page.mouse.move(start.x + 22, start.y + 22);
      await page.mouse.down();
      await page.mouse.move(start.x + 36, start.y + 22, { steps: 5 });
      const overlay = editor.locator('[data-dnd-overlay][data-dnd-dragging]');
      await expect(overlay).toBeVisible();
      const geometry = await editor.evaluate((el, index) => {
        const row = el.querySelectorAll('[data-drag-id]')[index]!.parentElement!;
        const label = row.querySelector('button:not([data-drag-id])')!;
        const overlay = el.querySelector('[data-dnd-overlay]')!;
        const copyLabel = overlay.querySelector('button:last-child') ?? overlay.firstElementChild!;
        const read = (node: Element, container: Element) => {
          const range = document.createRange(); range.selectNodeContents(node);
          const text = range.getBoundingClientRect(); const box = container.getBoundingClientRect();
          const css = getComputedStyle(node);
          return { x: text.x - box.x, y: text.y - box.y, width: text.width, height: text.height,
            lines: [...range.getClientRects()].map(rect => ({ x: rect.x - box.x, y: rect.y - box.y, width: rect.width, height: rect.height })),
            font: [css.fontFamily, css.fontSize, css.fontWeight, css.lineHeight, css.letterSpacing],
            outerWidth: box.width, outerHeight: box.height };
        };
        return { source: read(label, row), preview: read(copyLabel, overlay),
          inert: !!copyLabel.closest('[inert][aria-hidden="true"]'),
          registeredHandles: overlay.querySelectorAll('[data-drag-id], [aria-roledescription="draggable"]').length };
      }, index);
      if (width === 1912 && theme === 'dark' && index === 2) {
        await page.mouse.move(100, 100, { steps: 10 });
        await page.screenshot({ path: join(tmpdir(), 'pea-drag-text-fixed.png') });
      }
      await page.keyboard.press('Escape'); await page.mouse.up();
      await expect(source).toBeFocused();
      await expect(editor.locator('[data-dnd-overlay][data-dnd-dragging]')).toHaveCount(0);
      await expect(editor.locator('[data-drop-id] p[aria-hidden="false"]')).toHaveText(descriptionBefore);
      expect(Math.abs(await page.evaluate(() => scrollY) - scrollBefore)).toBeLessThanOrEqual(2);
      for (const key of ['x', 'y', 'width', 'height', 'outerWidth', 'outerHeight'] as const) {
        expect(Math.abs(geometry.preview[key] - geometry.source[key]), `${key}: ${JSON.stringify(geometry)}`).toBeLessThanOrEqual(1);
      }
      expect(geometry.preview.font).toEqual(geometry.source.font);
      expect(geometry.preview.lines).toEqual(geometry.source.lines);
      expect(geometry.inert).toBe(true);
      expect(geometry.registeredHandles).toBe(0);
    }
    expect(errors).toEqual([]);
  });
}
