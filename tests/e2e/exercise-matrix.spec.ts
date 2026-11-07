import { test, expect, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inlineExercises } from '../../src/data/exercises/inline';
import { quizBank } from '../../src/data/quiz/bank';
import { missions } from '../../src/data/missions';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt } from '../../src/domain/quiz/state';
import type { ExerciseDefinition, ExerciseType } from '../../src/domain/exercises/types';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

const types: ExerciseType[] = ['MultipleChoice', 'MatchPairs', 'FillTheBlank', 'TrueFalse', 'OrderSteps', 'CaseStudy', 'PromptSimulator', 'SpotTheHallucination', 'PromptBuilder', 'ContextBudget'];

async function auditState(page: import('@playwright/test').Page, state: string) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations, state).toEqual([]);
}

async function setChecked(control: Locator, checked: boolean) {
  if (await control.isChecked() === checked) return;
  await expect(control).toBeEnabled();
  await control.focus();
  await control.press('Space');
  if (checked) await expect(control).toBeChecked(); else await expect(control).not.toBeChecked();
}
async function setSelect(control: Locator, value: string) {
  const values = await control.locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value));
  const index = values.indexOf(value);
  if (index < 0) throw Error(`Нет варианта ${value}`);
  await control.focus();
  await control.press('Home');
  for (let step = 0; step < index; step++) await control.press('ArrowDown');
  await control.press('Tab');
  await expect(control).toHaveValue(value);
}
async function setText(control: Locator, value: string) {
  await control.focus();
  await control.press('ControlOrMeta+A');
  await control.press('Backspace');
  await control.pressSequentially(value);
  await expect(control).toHaveValue(value);
}
async function arrangeOrder(editor: Locator, target: string[]) {
  for (const [desiredIndex, id] of target.entries()) {
    for (;;) {
      const current = await editor.locator('[data-drag-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-drag-id')));
      const index = current.indexOf(id);
      if (index <= desiredIndex) break;
      const up = editor.locator(`[data-drag-id="${id}"]`).locator('..').getByRole('button', { name: `Поднять шаг ${index + 1}` });
      await up.focus(); await up.press('Enter');
    }
  }
  await expect.poll(() => editor.locator('[data-drag-id]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-drag-id')))).toEqual(target);
}
async function answerByKeyboard(editor: Locator, def: ExerciseDefinition, correct: boolean) {
  switch (def.type) {
    case 'MultipleChoice': {
      const wrong = def.options.find(item => !def.correct.includes(item.id))!;
      for (const option of def.options) await setChecked(editor.getByRole(def.multiple ? 'checkbox' : 'radio', { name: option.text, exact: true }), correct ? def.correct.includes(option.id) : option.id === wrong.id);
      break;
    }
    case 'MatchPairs': {
      for (const [index, item] of def.left.entries()) {
        const value = correct ? def.pairs[item.id]! : index === 0 ? def.right.find(right => right.id !== def.pairs[item.id])!.id : '';
        await editor.getByRole('button', { name: `Механизм: ${item.text}`, exact: true }).press('Enter');
        if (value) await editor.getByRole('button', { name: `Назначить описание: ${def.right.find(right => right.id === value)!.text}`, exact: true }).press('Enter');
        else if (await editor.getByRole('button', { name: `Убрать текущее описание: ${item.text}`, exact: true }).isEnabled()) await editor.getByRole('button', { name: `Убрать текущее описание: ${item.text}`, exact: true }).press('Enter');
      }
      break;
    }
    case 'FillTheBlank': {
      for (const [index, blank] of def.blanks.entries()) await setText(editor.getByRole('textbox', { name: blank.label, exact: true }), correct ? blank.accepted[0]!.text : index === 0 ? 'неверный ответ' : '');
      break;
    }
    case 'TrueFalse': await setChecked(editor.getByRole('radio', { name: (correct ? def.correct : !def.correct) ? 'Верно' : 'Неверно', exact: true }), true); break;
    case 'OrderSteps': await arrangeOrder(editor, correct ? def.correctOrder : [...def.correctOrder].reverse()); break;
    case 'CaseStudy': await setText(editor.getByRole('textbox', { name: 'Улучшенная версия промпта' }), correct ? def.example : 'Помоги'); break;
    case 'PromptSimulator': await setText(editor.getByRole('textbox', { name: 'Ваш промпт для заданной ситуации' }), correct ? def.example : 'Помоги'); break;
    case 'SpotTheHallucination': {
      const verified = def.claims.find(claim => !claim.falseClaim)!;
      for (const claim of def.claims) await setChecked(editor.getByRole('checkbox', { name: claim.text, exact: true }), correct ? claim.falseClaim : claim.id === verified.id);
      break;
    }
    case 'PromptBuilder': {
      for (const [index, slot] of def.slots.entries()) {
        const value = correct ? slot.correctBlock : index === 0 ? def.blocks.find(block => block.id !== slot.correctBlock)!.id : '';
        await setSelect(editor.getByRole('combobox', { name: slot.label, exact: true }), value);
      }
      break;
    }
    case 'ContextBudget': {
      const wrong = def.fragments.find(fragment => fragment.distractor)!;
      const wanted = correct ? new Set(def.fragments.filter(fragment => !fragment.distractor).map(fragment => fragment.id)) : new Set([wrong.id]);
      for (const fragment of def.fragments) await setChecked(editor.getByRole('checkbox', { name: new RegExp(fragment.text) }), wanted.has(fragment.id));
      break;
    }
  }
}
async function keyboardSubmit(editor: Locator, name: string) {
  const submit = editor.getByRole('button', { name, exact: true });
  await submit.focus(); await submit.press('Enter');
}
function quizFixture(type: ExerciseType) {
  for (let seed = 1; seed < 1000; seed++) {
    const selected = selectQuiz(quizBank, seed);
    const definition = selected.find(item => item.type === type);
    if (!definition) continue;
    const attempt = createAttempt(selected, seed, `matrix-${type}-${seed}`);
    attempt.position = attempt.ids.indexOf(definition.id);
    return { definition, attempt };
  }
  throw Error(`Не найден тип ${type}`);
}

for (const type of types) test(`${type}: встроенное упражнение, клавиатура, исправление и восстановление`, async ({ page }) => {
  const def = inlineExercises.find(item => item.type === type)!;
  const mission = missions.find(item => item.id === def.topicId)!;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/articles/${mission.slug}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(mission.title);
  const editor = page.locator(`[data-exercise-type="${type}"]`).filter({ has: page.getByRole('heading', { name: def.instruction, exact: true }) });
  await editor.scrollIntoViewIfNeeded();
  await expect(editor.getByRole('button', { name: 'Проверить ответ' })).toBeEnabled();
  await auditState(page, `${type} inline: без ответа`);
  await answerByKeyboard(editor, def, false);
  await keyboardSubmit(editor, 'Проверить ответ');
  const readRecord = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).inline[id], { key: PROGRESS_KEY, id: def.id });
  await expect.poll(async () => (await readRecord())?.first?.score).toBeLessThan(1);
  const first = await readRecord();
  await expect(editor.getByText(def.hint, { exact: true })).toBeVisible();
  await expect(editor.getByText(def.explanation, { exact: true })).toHaveCount(0);
  await expect(editor.getByRole('status').filter({ hasText: 'Ответ принят' })).toBeFocused();
  await auditState(page, `${type} inline: подсказка и исправление`);
  await answerByKeyboard(editor, def, true);
  await keyboardSubmit(editor, 'Отправить окончательный ответ');
  await expect.poll(async () => (await readRecord())?.final?.score).toBe(1);
  const final = await readRecord();
  expect(final.first).toEqual(first.first);
  expect(final.correctionUsed).toBe(true);
  await expect(editor.getByText(def.explanation, { exact: true })).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Отправить окончательный ответ' })).toHaveCount(0);
  expect(await editor.locator('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)').count()).toBe(0);
  await auditState(page, `${type} inline: полный разбор`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (type === 'PromptSimulator') await editor.screenshot({ path: join(tmpdir(), 'pea-matrix-inline-final.png') });
  await page.keyboard.press('Control+Home');
  await page.reload();
  // Re-enter the exercise viewport to activate client:visible after reload.
  await editor.scrollIntoViewIfNeeded();
  await expect(editor.getByText(def.explanation, { exact: true })).toBeVisible();
  expect(await readRecord()).toEqual(final);
  expect(errors).toEqual([]);
});

for (const type of types) test(`${type}: тест, клавиатура, скрытые баллы и одно исправление`, async ({ page }) => {
  const { definition: def, attempt } = quizFixture(type);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  await page.goto('/quiz/');
  await expect(page.getByRole('heading', { name: 'Первый проход' })).toBeVisible();
  const editor = page.locator(`[data-exercise-type="${type}"]`);
  await expect(editor).toBeVisible();
  await auditState(page, `${type} quiz: первый проход`);
  await answerByKeyboard(editor, def, false);
  await keyboardSubmit(editor, 'Отправить ответ');
  const readActive = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).active, PROGRESS_KEY);
  await expect.poll(async () => (await readActive())?.primary?.[def.id]?.result?.score).toBeLessThan(1);
  const first = (await readActive()).primary[def.id];
  await expect(page.getByText('Первичный результат', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Финальный результат', { exact: true })).toHaveCount(0);
  await expect(page.getByText(def.explanation, { exact: true })).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Вопросы теста' });
  await nav.getByRole('button', { name: `${attempt.position + 1} · отправлен`, exact: true }).click();
  expect(await editor.locator('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)').count()).toBe(0);
  await nav.getByRole('button', { name: /^\d+$/ }).first().click();
  for (let remaining = 0; remaining < 11; remaining++) {
    await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).focus();
    await page.keyboard.press('Enter');
  }
  await expect(page.getByRole('heading', { name: 'Одна возможность исправить' })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: true })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: String(attempt.position + 1), exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(page.getByText(`Подсказка: ${def.hint}`, { exact: true })).toBeVisible();
  await auditState(page, `${type} quiz: исправление`);
  await answerByKeyboard(editor, def, true);
  await keyboardSubmit(editor, 'Отправить окончательный ответ');
  await expect.poll(async () => (await readActive())?.corrections?.[def.id]?.result?.score).toBe(1);
  await expect(page.getByText('Финальный результат', { exact: true })).toHaveCount(0);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  const latest = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).latest, PROGRESS_KEY);
  expect(latest.primary[def.id].result).toEqual(first.result);
  expect(latest.corrections[def.id].result.score).toBe(1);
  const review = page.locator('details').nth(attempt.position);
  await review.locator('summary').click();
  await expect(review.getByText(def.explanation, { exact: true })).toBeVisible();
  await auditState(page, `${type} quiz: финальный разбор`);
  expect(await review.locator('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)').count()).toBe(0);
  if (type === 'PromptSimulator') await review.screenshot({ path: join(tmpdir(), 'pea-matrix-quiz-final.png') });
  expect(errors).toEqual([]);
});
