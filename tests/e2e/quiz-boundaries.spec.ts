import { test, expect } from '@playwright/test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt, percentages, quizReducer } from '../../src/domain/quiz/state';
import { optimalBudget } from '../../src/domain/scoring/evaluate';
import type { ExerciseDefinition, ExerciseAnswer } from '../../src/domain/exercises/types';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

function nonemptyAnswer(def: ExerciseDefinition): ExerciseAnswer {
  switch (def.type) {
    case 'MultipleChoice': return [def.options[0]!.id];
    case 'MatchPairs': return { [def.left[0]!.id]: def.right[0]!.id };
    case 'FillTheBlank': return { [def.blanks[0]!.id]: 'пример' };
    case 'TrueFalse': return true;
    case 'OrderSteps': return def.correctOrder;
    case 'CaseStudy': case 'PromptSimulator': return 'Помоги';
    case 'SpotTheHallucination': return [def.claims[0]!.id];
    case 'PromptBuilder': return { [def.slots[0]!.id]: def.blocks[0]!.id };
    case 'ContextBudget': return [def.fragments[0]!.id];
  }
}

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

test('IV-01–02: пропуск остаётся заблокированным, другой черновик переживает навигацию и reload', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const textQuestion = selected.find(item => item.type === 'CaseStudy')!;
  expect(textQuestion).toBeDefined();
  const attempt = createAttempt(selected, 42, 'skip-and-draft');
  const textPosition = attempt.ids.indexOf(textQuestion.id);
  const skippedPosition = (textPosition + 1) % 12;
  attempt.position = textPosition;
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, {
    key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt },
  });
  await page.goto('/quiz/');
  const navigation = page.getByRole('navigation', { name: 'Вопросы теста' });
  const draft = 'Составь проверяемый список с источниками';
  await page.getByRole('textbox', { name: 'Улучшенная версия промпта' }).fill(draft);
  await navigation.getByRole('button', { name: String(skippedPosition + 1), exact: true }).click();
  await page.getByRole('button', { name: 'Пропустить вопрос' }).click();
  await navigation.getByRole('button', { name: `${skippedPosition + 1} · отправлен`, exact: true }).click();
  await expect(page.getByText('Ответ сохранён и недоступен для изменения в этой фазе.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отправить ответ' })).toHaveCount(0);
  await expect(page.getByText('Первичный результат', { exact: true })).toHaveCount(0);
  await navigation.getByRole('button', { name: String(textPosition + 1), exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Улучшенная версия промпта' })).toHaveValue(draft);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Улучшенная версия промпта' })).toHaveValue(draft);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).active, PROGRESS_KEY);
  expect(saved.primary[selected[skippedPosition]!.id]).toMatchObject({ skipped: true, result: { score: 0, status: 'incorrect' } });
  expect(saved.drafts[textQuestion.id]).toBe(draft);
  expect(saved.ids).toEqual(attempt.ids);
});

test('IV-03: двенадцатый правильный ответ открывает 100/100 и не повторяет награду после reload', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const last = selected.find(item => item.type === 'TrueFalse')!;
  expect(last).toBeDefined();
  let attempt = createAttempt(selected, 42, 'twelve-correct');
  for (const def of selected.filter(item => item.id !== last.id)) {
    attempt = quizReducer(attempt, { type: 'submit', id: def.id, answer: correctAnswer(def) }, selected);
    expect(attempt.primary[def.id]?.result.score, def.id).toBe(1);
  }
  attempt.position = attempt.ids.indexOf(last.id);
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, {
    key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt },
  });
  await page.goto('/quiz/');
  await expect(page.getByText('Обработано 11 из 12')).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: true })).toHaveCount(0);
  await page.getByRole('radio', { name: last.correct ? 'Верно' : 'Неверно', exact: true }).check();
  await page.getByRole('button', { name: 'Отправить ответ' }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: false }).first()).toContainText('100%');
  await expect(page.getByText('Финальный результат', { exact: false }).first()).toContainText('100%');
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(before.active).toBeNull();
  expect(before.latest.id).toBe(attempt.id);
  expect(before.gamification.awardedXpKeys).toContain('quiz:final:first');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(after.gamification).toEqual(before.gamification);
  expect(after.latest).toEqual(before.latest);
});

test('досрочный финал с пятью оставшимися исправлениями требует подтверждения', async ({ page }) => {
  const selected = selectQuiz(quizBank, 29);
  let attempt = createAttempt(selected, 29, 'five-remaining');
  for (const def of selected) attempt = quizReducer(attempt, { type: 'skip', id: def.id }, selected);
  for (const def of selected.slice(0, 7)) attempt = quizReducer(attempt, { type: 'submit', id: def.id, answer: nonemptyAnswer(def) }, selected);
  expect(attempt.phase).toBe('correctionInProgress');
  expect(Object.keys(attempt.corrections)).toHaveLength(7);
  const expected = percentages(quizReducer(attempt, { type: 'finish' }, selected))!;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  await page.goto('/quiz/');
  await expect(page).toHaveURL(/\/quiz\/$/);
  await expect(page.getByRole('heading', { name: 'Одна возможность исправить' })).toBeVisible();
  await expect(page.getByText('Исправлено 7 из 12', { exact: true })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Финальный результат', { exact: true })).toHaveCount(0);
  const before = await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY);
  let prompt = '';
  page.once('dialog', dialog => { prompt = dialog.message(); return dialog.dismiss(); });
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  expect(prompt).toContain('Осталось исправлений: 5');
  expect(prompt).toContain('сохранятся исходные баллы');
  await expect(page.getByText('Исправлено 7 из 12', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY)).toBe(before);
  await page.screenshot({ path: join(tmpdir(), 'pea-quiz-five-remaining-before.png') });

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: false }).first()).toContainText(`${expected.first}%`);
  await expect(page.getByText('Финальный результат', { exact: false }).first()).toContainText(`${expected.final}%`);
  const latest = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).latest, PROGRESS_KEY);
  expect(Object.keys(latest.corrections)).toHaveLength(7);
  for (const def of selected.slice(7)) expect(latest.primary[def.id].result.score).toBe(0);
  await page.screenshot({ path: join(tmpdir(), 'pea-quiz-five-remaining-final.png') });
  expect(errors).toEqual([]);
});

test('IV-19: отмена нового теста сохраняет активную попытку, подтверждение создаёт другую', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/quiz/');
  await expect(page).toHaveTitle(/Prompt Engineering Academy/);
  await page.getByRole('button', { name: 'Начать тест', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  const read = () => page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY);
  const before = await read();
  const first = JSON.parse(before!).active;
  await page.screenshot({ path: join(tmpdir(), 'pea-active-quiz-before-restart.png') });
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  expect(await read()).toBe(before);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Начать заново' }).click();
  await expect(page.getByText('Обработано 0 из 12', { exact: true })).toBeVisible();
  const next = JSON.parse((await read())!).active;
  expect(next.id).not.toBe(first.id);
  expect(next.seed).not.toBe(first.seed);
  expect(next.primary).toEqual({});
  await page.screenshot({ path: join(tmpdir(), 'pea-active-quiz-after-restart.png') });
  await page.reload();
  await expect(page.getByText('Обработано 0 из 12', { exact: true })).toBeVisible();
  expect(JSON.parse((await read())!).active.id).toBe(next.id);
  expect(errors).toEqual([]);
});

test('IV-17–18: текстовый черновик восстанавливается, но финал стирает текст после reload', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const definition = selected.find(item => item.type === 'CaseStudy')!;
  expect(definition).toBeDefined();
  const attempt = createAttempt(selected, 42, 'privacy-browser');
  const position = attempt.ids.indexOf(definition.id);
  attempt.position = position;
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, {
    key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt },
  });
  const unique = 'контрольная строка приватности 918273';
  const answer = `${definition.example}. ${unique}`;
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  const editor = page.getByRole('textbox', { name: 'Улучшенная версия промпта' });
  await page.goto('/quiz/');
  await editor.fill(answer);
  await expect.poll(async () => (await read()).active.drafts[definition.id]).toBe(answer);
  const another = (position + 1) % 12;
  await page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: String(another + 1), exact: true }).click();
  await page.reload();
  await expect(page.getByText(`Открыт вопрос ${another + 1} из 12.`, { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: String(position + 1), exact: true }).click();
  await expect(editor).toHaveValue(answer);
  await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
  await expect.poll(async () => (await read()).active.primary[definition.id]?.answer).toBe(answer);
  expect(JSON.stringify(await read())).toContain(unique);
  for (let index = 0; index < 11; index++) await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Одна возможность исправить' })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  const saved = await read();
  expect(saved.active).toBeNull();
  expect(saved.latest.primary[definition.id].answer).toBeNull();
  expect(JSON.stringify(saved)).not.toContain(unique);
  expect(JSON.stringify(saved.latest)).not.toContain('"quote"');
  const review = page.locator('details').nth(position);
  await review.locator('summary').click();
  await expect(review.getByRole('textbox', { name: 'Улучшенная версия промпта' })).toHaveValue(answer);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  await review.locator('summary').click();
  await expect(review.getByRole('textbox', { name: 'Улучшенная версия промпта' })).toHaveValue('');
  expect(JSON.stringify(await read())).not.toContain(unique);
});
