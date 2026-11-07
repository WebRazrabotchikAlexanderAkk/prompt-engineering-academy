import { test, expect } from '@playwright/test';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';
import { getExercise } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('устаревшая рубрика: отмена сохраняет результат, подтверждение открывает новую попытку', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const def = getExercise('safety-2');
  const state = { ...defaultProgress(), inline: { [def.id]: { first: evaluate(def, 'текст'), correctionUsed: false } } };
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: PROGRESS_KEY, state });
  await page.goto('/articles/ai-safety/');
  await expect(page).toHaveTitle(/Безопасность/);
  // The React heading is replaced during hydration of an outdated record.
  // The Astro host stays mounted and scrolling it activates client:visible.
  const island = page.locator('astro-island').filter({ has: page.getByRole('heading', { name: def.instruction, exact: true }) });
  await expect(island).toHaveCount(1);
  await island.scrollIntoViewIfNeeded();
  const warning = page.getByRole('region', { name: 'Изменённая рубрика' });
  const restart = warning.getByRole('button', { name: 'Начать упражнение заново' });
  await expect(restart).toBeEnabled();
  await expect(warning).toContainText('Первый результат: 0%');
  await warning.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), 'pea-rubric-migration.png') });
  page.once('dialog', dialog => dialog.dismiss());
  await warning.getByRole('button', { name: 'Начать упражнение заново' }).click();
  await page.reload();
  await island.scrollIntoViewIfNeeded();
  await expect(restart).toBeEnabled();
  await expect(warning).toBeVisible();
  await expect(warning).toContainText('Первый результат: 0%');
  page.once('dialog', dialog => dialog.accept());
  await warning.getByRole('button', { name: 'Начать упражнение заново' }).click();
  await expect(warning).toHaveCount(0);
  const exercise = page.locator('[data-exercise-type="CaseStudy"]');
  await exercise.getByRole('textbox').fill('Не используй обезличенные данные.');
  await exercise.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(exercise.getByText('Пока неверно: 0%', { exact: true })).toBeVisible();
  await page.reload();
  await island.scrollIntoViewIfNeeded();
  await expect(exercise.getByRole('button', { name: 'Отправить окончательный ответ' })).toBeEnabled();
  await expect(exercise.getByRole('button', { name: 'Отправить окончательный ответ' })).toBeVisible();
  await expect(warning).toHaveCount(0);
  expect(errors).toEqual([]);
});
