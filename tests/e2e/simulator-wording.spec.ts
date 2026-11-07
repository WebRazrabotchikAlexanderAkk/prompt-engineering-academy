import { test, expect } from '@playwright/test';
import { getExercise } from '../../src/data/exercises/inline';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt } from '../../src/domain/quiz/state';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

const announcement = 'Составь краткое объявление о встрече во вторник в 15:00 по теме план обучения. Укажи, что место пока неизвестно.';
const wrongTopic = 'Составь краткое объявление о встрече во вторник в 15:00. Тема – праздничный концерт. Место неизвестно.';
const partialExample = 'Приглашаем на встречу. Перед публикацией сверьте детали с исходными данными.';

for (const width of [360, 1440]) test(`объявление ${width}px: подмена темы даёт 75%, исправление даёт 100%`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/articles/how-llms-work/');
  const simulator = page.locator('[data-exercise-type="PromptSimulator"]');
  await simulator.scrollIntoViewIfNeeded();
  await simulator.getByRole('textbox').fill(wrongTopic);
  await simulator.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(simulator.getByText('Частично верно: 75%', { exact: true })).toBeVisible();
  await expect(simulator.getByText(partialExample, { exact: true })).toBeVisible();
  await simulator.getByRole('textbox').fill(announcement);
  await simulator.getByRole('button', { name: 'Отправить окончательный ответ', exact: true }).click();
  await expect(simulator.getByText('Верно: 100%', { exact: true })).toBeVisible();
  await expect(simulator.getByText('Уровень примера: сильный.', { exact: true })).toBeVisible();
  await expect(simulator.getByRole('textbox')).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await simulator.scrollIntoViewIfNeeded();
  await expect(simulator.getByText('Верно: 100%', { exact: true })).toBeVisible();
  await expect(simulator.getByRole('textbox')).toHaveValue('');
  expect(errors).toEqual([]);
});

for (const { answer, score, total, exampleLevel } of [
  { answer: announcement, score: 100, total: '8.33%', exampleLevel: 'сильный' },
  { answer: wrongTopic, score: 75, total: '6.25%', exampleLevel: 'частичный' },
]) test(`объявление в тесте: ${score}% и пример показываются после финала`, async ({ page }) => {
  let seed = 1;
  let selected = selectQuiz(quizBank, seed);
  while (!selected.some(def => def.id === 'quiz-context-3') && seed < 1000) selected = selectQuiz(quizBank, ++seed);
  const attempt = createAttempt(selected, seed, 'announcement-wording');
  attempt.position = attempt.ids.indexOf('quiz-context-3');
  expect(attempt.position).toBeGreaterThanOrEqual(0);
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  await page.goto('/quiz/');
  const simulator = page.locator('[data-exercise-type="PromptSimulator"]');
  await simulator.getByRole('textbox').fill(answer);
  await simulator.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Итоговый результат', exact: true })).toHaveCount(0);
  await expect(page.getByText('Верно: 100%', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Частично верно: 75%', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Подготовленный пример', { exact: true })).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(saved.active.primary['quiz-context-3'].result.score).toBe(score / 100);
  await page.reload();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  for (let count = 1; count < 12; count++) await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат', exact: true })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: false }).first()).toContainText(total);
  await expect(page.getByText('Финальный результат', { exact: false }).first()).toContainText(total);
  await page.getByText(`Вопрос ${attempt.position + 1} · ${score}%`, { exact: true }).click();
  await expect(simulator.getByText(`Уровень примера: ${exampleLevel}.`, { exact: true })).toBeVisible();
  if (score === 75) await expect(simulator.getByText(partialExample, { exact: true })).toBeVisible();
});

test('обновлённое объявление: отмена перезапуска сохраняет старые баллы, подтверждение открывает новую рубрику', async ({ page }) => {
  const definition = getExercise('llm-3');
  const first = evaluate(definition, 'Составь объявление: встреча во вторник в 15:00, тема – план обучения.');
  const state = { ...defaultProgress(), theme: 'light' as const, inline: {
    'llm-3': { first, correctionUsed: false, rubricVersion: 3 },
  } };
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state });
  await page.goto('/articles/how-llms-work/');
  const island = page.locator('astro-island').filter({ has: page.getByRole('heading', { name: definition.instruction, exact: true }) });
  await island.scrollIntoViewIfNeeded();
  const warning = page.getByRole('region', { name: 'Изменённая рубрика' });
  const restart = warning.getByRole('button', { name: 'Начать упражнение заново', exact: true });
  await expect(restart).toBeEnabled();
  await expect(warning).toContainText('Первый результат: 50%');
  page.once('dialog', dialog => dialog.dismiss());
  await restart.click();
  await page.reload();
  await island.scrollIntoViewIfNeeded();
  await expect(restart).toBeEnabled();
  await expect(warning).toContainText('Первый результат: 50%');
  page.once('dialog', dialog => dialog.accept());
  await restart.click();
  const simulator = page.locator('[data-exercise-type="PromptSimulator"]');
  await simulator.getByRole('textbox').fill(announcement);
  await simulator.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  await expect(simulator.getByText('Верно: 100%', { exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(saved.inline['llm-3'].rubricVersion).toBe(4);
});
