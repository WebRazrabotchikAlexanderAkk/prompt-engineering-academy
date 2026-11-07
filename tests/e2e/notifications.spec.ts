import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Locator } from '@playwright/test';

async function expectSeparate(panel: Locator, control: Locator) {
  const first = await panel.boundingBox();
  const second = await control.boundingBox();
  expect(first, 'Уведомление имеет видимые границы').not.toBeNull();
  expect(second, 'Проверяемый элемент имеет видимые границы').not.toBeNull();
  expect(first && second && (
    first.x + first.width <= second.x || second.x + second.width <= first.x ||
    first.y + first.height <= second.y || second.y + second.height <= first.y
  ), 'Уведомление не перекрывает элемент ни по одной стороне').toBeTruthy();
}

for (const height of [900, 600]) for (const reduced of [false, true]) test(`награда не перекрывает упражнение и шапку: 360×${height}, уменьшение движения ${reduced}`, async ({ page }) => {
  await page.setViewportSize({ width: 360, height });
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.goto('/articles/how-llms-work/');
  const exercise = page.locator('[data-exercise-type="TrueFalse"]');
  await exercise.scrollIntoViewIfNeeded();
  await exercise.getByRole('radio', { name: 'Верно', exact: true }).check();
  await exercise.getByRole('button', { name: 'Проверить ответ' }).click();
  const host = page.getByRole('complementary', { name: 'Уведомления о наградах' });
  await expect(host.locator('[data-award="ach-first-signal"]')).toBeVisible();
  await expect(exercise.getByRole('status')).toBeFocused();
  await expectSeparate(host, exercise.getByRole('status'));
  await expectSeparate(host, exercise.getByRole('button', { name: 'Отправить окончательный ответ' }));
  expect(await host.evaluate(element => getComputedStyle(element).position)).toBe('static');
  expect(await host.evaluate(element => element.parentElement?.previousElementSibling?.tagName)).toBe('ASTRO-ISLAND');
  await page.evaluate(() => scrollTo(0, 0));
  for (const control of await page.locator('header').getByRole('button').all()) await expectSeparate(host, control);
  for (const control of await page.locator('header').getByRole('link').all()) await expectSeparate(host, control);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const theme of ['Светлая', 'Тёмная']) test(`контраст уведомления во время анимации: ${theme}`, async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/articles/how-llms-work/');
  await expect(page).toHaveTitle(/Как работают LLM/);
  await page.getByRole('button', { name: theme, exact: true }).click();
  const exercise = page.locator('[data-exercise-type="TrueFalse"]');
  await exercise.scrollIntoViewIfNeeded();
  await exercise.getByRole('radio', { name: 'Верно', exact: true }).check();
  await exercise.getByRole('button', { name: 'Проверить ответ' }).click();
  const notice = page.locator('[data-award="ach-first-signal"]');
  await expect(notice).toBeVisible();
  // Restart the real CSS animation, then freeze specific frames, without sleeps
  // or disabling motion in the accessibility audit.
  await notice.evaluate(element => {
    const node = element as HTMLElement;
    node.style.animationName = 'none';
    void node.offsetWidth;
    node.style.animationName = '';
    const animation = node.getAnimations()[0];
    if (!animation) throw Error('Анимация уведомления отсутствует');
    animation.pause(); animation.currentTime = 0;
  });
  for (const time of [0, 80, 160, 240, 319]) {
    await notice.evaluate((element, at) => { element.getAnimations()[0]!.currentTime = at; }, time);
    expect(await notice.evaluate(element => getComputedStyle(element).opacity), `Кадр ${time} мс`).toBe('1');
    const result = await new AxeBuilder({ page }).include('[aria-label="Уведомления о наградах"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(result.violations, `Кадр ${time} мс`).toEqual([]);
  }
  await page.screenshot({ path: join(tmpdir(), `pea-award-motion-${theme === 'Светлая' ? 'light' : 'dark'}.png`) });
  expect(errors).toEqual([]);
});

for (const reduced of [false, true]) test(`новая награда, закрытие, reload; уменьшение движения: ${reduced}`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await page.setViewportSize({ width: reduced ? 360 : 1440, height: 900 });
  await page.goto('/articles/how-llms-work/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  if (reduced) await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  const host = page.getByRole('complementary', { name: 'Уведомления о наградах' });
  await expect(host.locator('[data-award]')).toHaveCount(0);
  const exercise = page.locator('[data-exercise-type="TrueFalse"]');
  await exercise.scrollIntoViewIfNeeded();
  await exercise.getByRole('radio', { name: 'Верно', exact: true }).check();
  await exercise.getByRole('button', { name: 'Проверить ответ' }).click();
  const notice = host.locator('[data-award="ach-first-signal"]');
  await expect(notice).toContainText('Первый сигнал');
  expect(await notice.evaluate(el => getComputedStyle(el).animationName === 'none')).toBe(reduced);
  if (!reduced) expect(await notice.evaluate(el => getComputedStyle(el).animationDuration)).toBe('0.32s');
  await expect(exercise.getByRole('status')).toBeFocused();
  await expectSeparate(host, exercise.getByRole('status'));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const axe = await new AxeBuilder({ page }).include('[aria-label="Уведомления о наградах"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page.screenshot({ path: join(tmpdir(), `pea-award-${reduced ? 'light-mobile' : 'dark-desktop'}.png`) });
  const close = host.getByRole('button', { name: 'Закрыть уведомление' });
  await close.focus(); await page.keyboard.press('Enter');
  await expect(notice).toHaveCount(0);
  await expect(exercise.getByRole('status')).toBeFocused();
  await exercise.getByRole('radio', { name: 'Неверно', exact: true }).check();
  await exercise.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  await expect(host.locator('[data-award]')).toHaveCount(0);
  await page.reload();
  await exercise.scrollIntoViewIfNeeded();
  await expect(exercise.getByText('Первый результат:', { exact: false })).toContainText('100%');
  await expect(host.locator('[data-award]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
