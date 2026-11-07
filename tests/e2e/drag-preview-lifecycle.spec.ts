import { test, expect } from '@playwright/test';

test('копия описания не занимает место даже между обновлением содержимого и стилями библиотеки', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/articles/how-llms-work/');
  const editor = page.locator('[data-exercise-type="MatchPairs"]');
  await editor.scrollIntoViewIfNeeded();
  await expect(editor.locator('[data-drag-id]').first()).toBeEnabled();
  // Model the React/library boundary: content exists but the library has not
  // applied data-dnd-dragging or has already removed its temporary stylesheet.
  // This must be safe independently of which update runs first.
  const geometry = await editor.evaluate(el => {
    const overlay = el.querySelector('[data-dnd-overlay]')!;
    const before = { h: el.getBoundingClientRect().height, document: document.documentElement.scrollHeight, y: scrollY };
    const copy = document.createElement('div'); copy.textContent = 'Доступные модели инструкции и материалы'; copy.setAttribute('aria-hidden', 'true');
    overlay.replaceChildren(copy);
    const during = { h: el.getBoundingClientRect().height, document: document.documentElement.scrollHeight, y: scrollY, position: getComputedStyle(overlay).position };
    overlay.replaceChildren();
    return { before, during };
  });
  expect(geometry.during.h, JSON.stringify(geometry)).toBe(geometry.before.h);
  expect(geometry.during.position).toBe('fixed');
  expect(geometry.during.document).toBe(geometry.before.document);
  expect(geometry.during.y).toBe(geometry.before.y);
});

for (const width of [360, 680, 1280, 1440]) test(`покадровая прокрутка ${width}px: назначение, замена и отмена`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto('/articles/how-llms-work/');
  const editor = page.locator('[data-exercise-type="MatchPairs"]');
  const target = editor.locator('[data-drop-id]');
  await target.evaluate(el => window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 40));
  await expect(editor.locator('[data-drag-id]').first()).toHaveAttribute('aria-roledescription', 'draggable');
  for (const [index, cancel] of [[0, false], [1, false], [0, true]] as const) {
    const source = editor.locator('[data-drag-id]').nth(index);
    const start = await source.boundingBox(); const end = await target.boundingBox();
    if (!start || !end || start.y < 0 || start.y + start.height > 1000 || end.y < 0 || end.y + end.height > 1000) throw Error('Источник или цель не помещаются в окне');
    const visibleDescription = target.locator('p[aria-hidden="false"]');
    const expectedDescription = cancel ? await visibleDescription.innerText() : await editor.getByRole('button', { name: /^Назначить описание:/ }).nth(index).innerText();
    await page.evaluate(() => {
      const state = window as unknown as { dragFrames: number[]; stopFrames: boolean };
      state.dragFrames = [scrollY]; state.stopFrames = false;
      const tick = () => { state.dragFrames.push(scrollY); if (!state.stopFrames) requestAnimationFrame(tick); }; tick();
    });
    await page.mouse.move(start.x + 22, start.y + 22); await page.mouse.down();
    await page.mouse.move(start.x + 32, start.y + 22, { steps: 5 });
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 20 });
    if (cancel) await page.keyboard.press('Escape');
    await page.mouse.up(); await expect(source).toBeFocused();
    await expect(visibleDescription).toHaveText(expectedDescription);
    const frames = await page.evaluate(() => {
      const state = window as unknown as { dragFrames: number[]; stopFrames: boolean }; state.stopFrames = true;
      return [...state.dragFrames, scrollY];
    });
    expect(Math.max(...frames) - Math.min(...frames)).toBeLessThanOrEqual(2);
  }
});
