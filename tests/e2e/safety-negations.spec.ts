import { test, expect } from '@playwright/test';
import { getExercise } from '../../src/data/exercises/inline';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt } from '../../src/domain/quiz/state';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

const negative = 'Обезличенные данные не использовать. Письмо как недоверенные данные не рассматривай. Краткое резюме не составляй. Подтверждение человека не запрашивай.';
const definition = getExercise('safety-2');
if (definition.type !== 'CaseStudy') throw new Error('Нужна рубрика безопасности');
const positive = definition.example;

for (const width of [360, 1440]) test(`отрицания безопасности ${width}px: ноль, исправление и восстановление`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/articles/ai-safety/');
  const exercise = page.locator('[data-exercise-type="CaseStudy"]');
  await exercise.scrollIntoViewIfNeeded();
  await exercise.getByRole('textbox').fill(negative);
  await exercise.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(exercise.getByText('Пока неверно: 0%', { exact: true })).toBeVisible();
  await expect(exercise.getByRole('textbox')).toBeEnabled();
  await exercise.getByRole('textbox').fill(positive);
  await exercise.getByRole('button', { name: 'Отправить окончательный ответ', exact: true }).click();
  await expect(exercise.getByText('Верно: 100%', { exact: true })).toBeVisible();
  await expect(exercise.getByRole('textbox')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await exercise.scrollIntoViewIfNeeded();
  await expect(exercise.getByText('Первый результат: 0%. Окончательный: 100%.', { exact: true })).toBeVisible();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(saved.inline['safety-2'].rubricVersion).toBe(3);
  expect(errors).toEqual([]);
});

test('отрицания безопасности в тесте: ноль без раскрытия, исправление и итог', async ({ page }) => {
  let seed = 1;
  let selected = selectQuiz(quizBank, seed);
  while (!selected.some(def => def.id === 'quiz-safety-2') && seed < 1000) selected = selectQuiz(quizBank, ++seed);
  const attempt = createAttempt(selected, seed, 'safety-negations');
  attempt.position = attempt.ids.indexOf('quiz-safety-2');
  expect(attempt.position).toBeGreaterThanOrEqual(0);
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  await page.goto('/quiz/');
  const exercise = page.locator('[data-exercise-type="CaseStudy"]');
  await exercise.getByRole('textbox').fill(negative);
  await exercise.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  await expect(page.getByText('Пока неверно: 0%', { exact: true })).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(saved.active.primary['quiz-safety-2'].result.score).toBe(0);
  await page.reload();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  for (let count = 1; count < 12; count++) await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  await page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: String(attempt.position + 1), exact: true }).click();
  await exercise.getByRole('textbox').fill(positive);
  await exercise.getByRole('button', { name: 'Отправить окончательный ответ', exact: true }).click();
  await expect(page.getByText('Исправлено 1 из 12', { exact: true })).toBeVisible();
  await expect(page.getByText('Верно: 100%', { exact: true })).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат', exact: true })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: false }).first()).toContainText('0%');
  await expect(page.getByText('Финальный результат', { exact: false }).first()).toContainText('8.33%');
});

test('безопасность версии 2: отмена перезапуска сохраняет запись, подтверждение включает новые отрицания', async ({ page }) => {
  const state = { ...defaultProgress(), theme: 'light' as const, inline: {
    'safety-2': { first: evaluate(definition, 'текст'), correctionUsed: false, rubricVersion: 2 },
  } };
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state });
  await page.goto('/articles/ai-safety/');
  const island = page.locator('astro-island').filter({ has: page.getByRole('heading', { name: definition.instruction, exact: true }) });
  await island.scrollIntoViewIfNeeded();
  const warning = page.getByRole('region', { name: 'Изменённая рубрика' });
  await expect(warning).toContainText('Первый результат: 0%');
  page.once('dialog', dialog => dialog.dismiss());
  await warning.getByRole('button', { name: 'Начать упражнение заново' }).click();
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(saved.inline['safety-2'].rubricVersion).toBe(2);
  page.once('dialog', dialog => dialog.accept());
  await warning.getByRole('button', { name: 'Начать упражнение заново' }).click();
  const exercise = page.locator('[data-exercise-type="CaseStudy"]');
  await exercise.getByRole('textbox').fill(negative);
  await exercise.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(exercise.getByText('Пока неверно: 0%', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});
