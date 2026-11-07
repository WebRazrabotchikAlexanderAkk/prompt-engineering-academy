import { test, expect } from '@playwright/test';

for (const width of [360, 680]) test(`пары ${width}px: подъём, перенос и отпускание не меняют прокрутку`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/articles/how-llms-work/');
  const editor = page.locator('[data-exercise-type="MatchPairs"]');
  const target = editor.locator('[data-drop-id]');
  const source = editor.locator('[data-drag-id]').first();
  await target.evaluate(node => node.scrollIntoView({ block: 'start' }));
  // Inline islands hydrate only after entering the viewport. Do not send the
  // gesture to the disabled server-rendered handle before its sensor exists.
  await expect(source).toBeEnabled();
  await expect(source).toHaveAttribute('aria-roledescription', 'draggable');
  const start = await source.boundingBox(); const end = await target.boundingBox();
  if (!start || !end) throw Error('Нет координат переноса');
  const positions: number[] = [await page.evaluate(() => scrollY)];
  await page.mouse.move(start.x + 22, start.y + 22); await page.mouse.down();
  await page.mouse.move(start.x + 32, start.y + 22, { steps: 5 });
  positions.push(await page.evaluate(() => scrollY));
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
  positions.push(await page.evaluate(() => scrollY));
  await page.mouse.up();
  await expect(source).toBeFocused();
  await expect(editor.getByRole('status').first()).toContainText('Выбранный элемент помещён');
  positions.push(await page.evaluate(() => scrollY));
  expect(Math.max(...positions) - Math.min(...positions)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
