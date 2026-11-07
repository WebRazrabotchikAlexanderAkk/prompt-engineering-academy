import { test, expect } from '@playwright/test';
import { quizBank } from '../../src/data/quiz/bank';
import { getExercise } from '../../src/data/exercises/inline';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt } from '../../src/domain/quiz/state';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

const base = 'Ты менеджер поддержки. Сообщи клиенту о задержке заказа. Новая дата доставки 20 октября.';
const positive = `${base} Напиши письмо до 120 слов. Не обещай скидку.`;

for (const width of [360, 1440]) test(`ограничения письма ${width}px: оба условия обязательны, отдельные предложения принимаются`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/articles/role-context-constraints/');
  const exercise = page.locator('[data-exercise-type="CaseStudy"]');
  await exercise.scrollIntoViewIfNeeded();
  await exercise.getByRole('textbox').fill(`${base} Напиши письмо до 120 слов.`);
  await exercise.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(exercise.getByText('Частично верно: 75%', { exact: true })).toBeVisible();
  await exercise.getByRole('textbox').fill(positive);
  await exercise.getByRole('button', { name: 'Отправить окончательный ответ', exact: true }).click();
  await expect(exercise.getByText('Верно: 100%', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await exercise.scrollIntoViewIfNeeded();
  await expect(exercise.getByText('Первый результат: 75%. Окончательный: 100%.', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('ограничения письма в тесте: отдельные предложения дают полный балл без раннего раскрытия', async ({ page }) => {
  let seed = 1;
  let selected = selectQuiz(quizBank, seed);
  while (!selected.some(def => def.id === 'quiz-context-2') && seed < 1000) selected = selectQuiz(quizBank, ++seed);
  const attempt = createAttempt(selected, seed, 'support-limits');
  attempt.position = attempt.ids.indexOf('quiz-context-2');
  expect(attempt.position).toBeGreaterThanOrEqual(0);
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  await page.goto('/quiz/');
  const exercise = page.locator('[data-exercise-type="CaseStudy"]');
  await exercise.getByRole('textbox').fill(positive);
  await exercise.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  await expect(page.getByText('Верно: 100%', { exact: true })).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(saved.active.primary['quiz-context-2'].result.score).toBe(1);
  await page.reload();
  for (let count = 1; count < 12; count++) await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат', exact: true })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: false }).first()).toContainText('8.33%');
  await expect(page.getByText('Финальный результат', { exact: false }).first()).toContainText('8.33%');
});

test('письмо версии 2: отмена сохраняет 75%, подтверждение открывает новую рубрику', async ({ page }) => {
  const definition = getExercise('context-2');
  const first = evaluate(definition, positive);
  first.score = .75;
  first.status = 'partial';
  first.breakdown = first.breakdown.map(row => row.id === 'limit' ? { ...row, met: false, earned: 0, reason: 'missing' } : row);
  const state = { ...defaultProgress(), inline: {
    'context-2': { first, correctionUsed: false, rubricVersion: 2 },
  } };
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state });
  await page.goto('/articles/role-context-constraints/');
  const island = page.locator('astro-island').filter({ has: page.getByRole('heading', { name: definition.instruction, exact: true }) });
  await island.scrollIntoViewIfNeeded();
  const warning = page.getByRole('region', { name: 'Изменённая рубрика' });
  await expect(warning).toContainText('Первый результат: 75%');
  page.once('dialog', dialog => dialog.dismiss());
  await warning.getByRole('button', { name: 'Начать упражнение заново' }).click();
  await expect(warning).toContainText('Первый результат: 75%');
  page.once('dialog', dialog => dialog.accept());
  await warning.getByRole('button', { name: 'Начать упражнение заново' }).click();
  const exercise = page.locator('[data-exercise-type="CaseStudy"]');
  await exercise.getByRole('textbox').fill(positive);
  await exercise.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(exercise.getByText('Верно: 100%', { exact: true })).toBeVisible();
});
