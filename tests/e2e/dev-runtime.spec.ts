import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('проверка типов и сборка не подменяют React работающего сервера разработки', async ({ page, browser }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/articles/how-llms-work/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Как работают LLM');
  execFileSync(process.execPath, ['scripts/astro.mjs', 'check'], { timeout: 90_000, stdio: 'pipe' });
  execFileSync(process.execPath, ['scripts/astro.mjs', 'build'], { timeout: 90_000, stdio: 'pipe' });
  const devRuntime = readFileSync('node_modules/.vite-dev/deps/react_jsx-dev-runtime.js', 'utf8');
  expect(devRuntime).toContain('react-jsx-dev-runtime.development.js');
  expect(devRuntime).not.toContain('exports.jsxDEV = void 0');
  // A new visitor must not reuse modules from the browser HTTP cache.
  const context = await browser.newContext();
  const visitor = await context.newPage();
  visitor.on('pageerror', error => errors.push(error.message));
  await visitor.goto(new URL('/articles/how-llms-work/', page.url()).href);
  const exercise = visitor.locator('[data-exercise-type="TrueFalse"]');
  await exercise.scrollIntoViewIfNeeded();
  await expect(visitor.locator('astro-island[ssr]').filter({ has: exercise })).toHaveCount(0);
  await exercise.getByRole('radio', { name: 'Верно', exact: true }).check();
  await exercise.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(exercise.getByText('Пока неверно', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
  await context.close();
});

test('до подключения обработчиков упражнение не принимает ответ', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${baseURL}/articles/how-llms-work/`);
  const exercise = page.locator('[data-exercise-type="TrueFalse"]');
  await expect(exercise.getByRole('radio', { name: 'Верно', exact: true })).toBeDisabled();
  await expect(exercise.getByRole('button', { name: 'Проверить ответ' })).toBeDisabled();
  await context.close();
});
