import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [360, 616, 800, 1280, 1440]) test(`упражнение ${width}px: ширина по содержимому, доступность и отсутствие переполнения`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/articles/how-llms-work/');
  const editor = page.locator('[data-exercise-type="MatchPairs"]');
  await editor.scrollIntoViewIfNeeded();
  await expect(editor.locator('[data-drag-id]').first()).toBeEnabled();
  const geometry = await editor.evaluate(el => {
    const article = el.closest('article')!;
    const paragraph = article.querySelector(':scope > p')!;
    const target = el.querySelector('[data-drop-id]')!;
    const bank = el.querySelector('[aria-label="Доступные описания"]')!;
    return { block: el.getBoundingClientRect().width, text: paragraph.getBoundingClientRect().width, target: target.getBoundingClientRect().toJSON(), bank: bank.getBoundingClientRect().toJSON(), overflow: document.documentElement.scrollWidth > innerWidth };
  });
  expect(geometry.overflow).toBe(false);
  if (width >= 1280) {
    expect(geometry.block).toBeCloseTo(1000, 0);
    expect(geometry.text).toBeLessThanOrEqual(672);
    expect(geometry.bank.width).toBeGreaterThan(geometry.target.width);
  }
  if (width <= 616) expect(geometry.bank.y).toBeGreaterThan(geometry.target.y + geometry.target.height);
  if (width >= 800) expect(geometry.bank.x).toBeGreaterThan(geometry.target.x + geometry.target.width);
  const names = await editor.locator('[data-drag-id]').evaluateAll(nodes => nodes.map(el => el.getAttribute('aria-label')));
  expect(new Set(names).size).toBe(names.length);
  expect(await editor.locator('h4[aria-hidden]').count()).toBe(0);
  for (const handle of await editor.locator('[data-drag-id]').all()) {
    const box = await handle.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  const audit = await new AxeBuilder({ page }).include('[data-exercise-type="MatchPairs"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(audit.violations).toEqual([]);
});

test('статья 360px: увеличенный до 200% текст не создаёт горизонтальную прокрутку', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/articles/how-llms-work/');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.locator('[data-exercise-type="MatchPairs"]').scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Светлая', exact: true })).toBeEnabled();
});
