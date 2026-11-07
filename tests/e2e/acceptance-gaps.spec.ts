import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inlineExercises } from '../../src/data/exercises/inline';
import { missions } from '../../src/data/missions';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt, quizReducer } from '../../src/domain/quiz/state';
import { optimalBudget } from '../../src/domain/scoring/evaluate';
import type { ExerciseAnswer, ExerciseDefinition } from '../../src/domain/exercises/types';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

function correctAnswer(def: ExerciseDefinition): ExerciseAnswer {
  switch (def.type) {
    case 'MultipleChoice': return def.correct;
    case 'MatchPairs': return def.pairs;
    case 'FillTheBlank': return Object.fromEntries(def.blanks.map(blank => [blank.id, blank.accepted[0]!.text]));
    case 'TrueFalse': return def.correct;
    case 'OrderSteps': return def.correctOrder;
    case 'CaseStudy': case 'PromptSimulator': return def.example;
    case 'SpotTheHallucination': return def.claims.filter(claim => claim.falseClaim).map(claim => claim.id);
    case 'PromptBuilder': return Object.fromEntries(def.slots.map(slot => [slot.id, slot.correctBlock]));
    case 'ContextBudget': return optimalBudget(def).ids;
  }
}

test('IV-16: текст встроенного упражнения не сохраняется до и после исправления', async ({ page }) => {
  const definition = inlineExercises.find(item => item.id === 'hall-3')!;
  if (definition.type !== 'CaseStudy') throw Error('Нужна текстовая рубрика');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto('/articles/hallucinations/');
  await expect(page).toHaveTitle(/Prompt Engineering Academy/);
  const exercise = page.locator('[data-exercise-type="CaseStudy"]').filter({ has: page.getByRole('heading', { name: definition.instruction, exact: true }) });
  await exercise.scrollIntoViewIfNeeded();
  const editor = exercise.getByRole('textbox', { name: 'Улучшенная версия промпта' });
  const unique = 'контрольная строка приватности 918273';
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  await editor.fill(unique);
  await exercise.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(exercise.getByText('Ответ принят.', { exact: false })).toBeVisible();
  const first = (await read()).inline[definition.id];
  expect(first.first.score).toBeLessThan(1);
  expect(first.correctionUsed).toBe(false);
  expect(JSON.stringify(await read())).not.toContain(unique);
  await page.reload();
  await exercise.scrollIntoViewIfNeeded();
  await expect(editor).toHaveValue('');
  await expect(exercise.getByText('Предыдущий текст не сохранялся.', { exact: false })).toBeVisible();
  await editor.fill(definition.example);
  await exercise.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  await expect(exercise.getByText('Упражнение завершено.', { exact: false })).toBeVisible();
  const final = (await read()).inline[definition.id];
  expect(final.first).toEqual(first.first);
  expect(final.final.score).toBe(1);
  expect(final.correctionUsed).toBe(true);
  expect(JSON.stringify(await read())).not.toContain(unique);
  await page.reload();
  await exercise.scrollIntoViewIfNeeded();
  await expect(editor).toHaveValue('');
  await expect(editor).toBeDisabled();
  await expect(exercise.getByText('Сохранён только результат проверки.', { exact: false })).toBeVisible();
  await page.screenshot({ path: join(tmpdir(), 'pea-inline-text-restored-final.png') });
  expect(errors).toEqual([]);
});

test('IV-19: общий сброс удаляет активный текст и сохраняет тему', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const definition = selected.find(item => item.type === 'CaseStudy')!;
  const attempt = createAttempt(selected, 42, 'reset-browser');
  attempt.position = attempt.ids.indexOf(definition.id);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, {
    key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt },
  });
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  await page.goto('/quiz/');
  const unique = 'уникальный черновик для сброса 827364';
  await page.getByRole('textbox', { name: 'Улучшенная версия промпта' }).fill(unique);
  await expect.poll(async () => (await read()).active.drafts[definition.id]).toBe(unique);
  await page.goto('/');
  await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Сбросить учебный прогресс' }).click();
  await expect.poll(async () => (await read()).active).toBeNull();
  expect(JSON.stringify(await read())).not.toContain(unique);
  expect((await read()).theme).toBe('light');
  await page.goto('/quiz/');
  await expect(page.getByRole('button', { name: 'Начать тест', exact: true })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: join(tmpdir(), 'pea-quiz-after-progress-reset.png') });
  expect(errors).toEqual([]);
});

test('IV-21: итог показывает только две слабые темы, затем ни одной при полном результате', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const weakFirst = new Set(selected.filter(item => item.topicId === missions[0]!.id).map(item => item.id));
  const weakSecond = selected.find(item => item.topicId === missions[1]!.id)!.id;
  let attempt = createAttempt(selected, 42, 'two-weak-topics');
  for (const def of selected) attempt = quizReducer(attempt,
    weakFirst.has(def.id) || def.id === weakSecond ? { type: 'skip', id: def.id } : { type: 'submit', id: def.id, answer: correctAnswer(def) }, selected);
  expect(attempt.phase).toBe('correctionInProgress');
  attempt = quizReducer(attempt, { type: 'finish' }, selected);
  expect(attempt.phase).toBe('finalComplete');
  let perfect = createAttempt(selected, 43, 'all-perfect');
  for (const def of selected) perfect = quizReducer(perfect, { type: 'submit', id: def.id, answer: correctAnswer(def) }, selected);
  expect(perfect.phase).toBe('finalComplete');
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, {
    key: PROGRESS_KEY, state: { ...defaultProgress(), latest: attempt },
  });
  await page.goto('/quiz/');
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  const recommendations = page.getByRole('heading', { name: 'Что повторить' }).locator('..');
  await expect(recommendations.locator('li a')).toHaveText([missions[0]!.title, missions[1]!.title]);
  await recommendations.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await expect.poll(async () => (await recommendations.boundingBox())?.y ?? 999).toBeLessThan(500);
  await page.screenshot({ path: join(tmpdir(), 'pea-two-weak-topic-recommendations.png') });
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: PROGRESS_KEY, state: { ...defaultProgress(), latest: perfect },
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  await expect(recommendations.getByText('Все темы выполнены без ошибок.')).toBeVisible();
  await expect(recommendations.locator('li a')).toHaveCount(0);
  await recommendations.evaluate(element => element.scrollIntoView({ block: 'center' }));
  await expect.poll(async () => (await recommendations.boundingBox())?.y ?? 999).toBeLessThan(500);
  await page.screenshot({ path: join(tmpdir(), 'pea-perfect-topic-recommendations.png') });
  expect(errors).toEqual([]);
});
