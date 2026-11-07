import { test, expect, type Page, type Locator } from '@playwright/test';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt, quizReducer } from '../../src/domain/quiz/state';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inlineExercises } from '../../src/data/exercises/inline';
import { missions } from '../../src/data/missions';

const types = ['MatchPairs', 'OrderSteps', 'PromptBuilder'] as const;
type DragType = typeof types[number];

for (const type of types) test(`${type}: статья 360px, касание, исправление и восстановление`, async ({ page }) => {
  const def = inlineExercises.find(item => item.type === type)!;
  const mission = missions.find(item => item.id === def.topicId)!;
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 360, height: 900 });
  await page.goto(`/articles/${mission.slug}/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(mission.title);
  const island = page.locator('astro-island').filter({ has: page.getByRole('heading', { name: def.instruction, exact: true }) });
  await island.scrollIntoViewIfNeeded();
  const editor = island.locator(`[data-exercise-type="${type}"]`);
  const handles = editor.locator('[data-drag-id]');
  await expect(handles.first()).toBeEnabled();
  const sourceId = await (type === 'PromptBuilder' ? handles.last() : handles.first()).getAttribute('data-drag-id');
  if (!sourceId) throw Error('Нет идентификатора перетаскивания');
  const source = editor.locator(`[data-drag-id="${sourceId}"]`);
  const original = await handles.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-drag-id')!));
  let orderIndex = 1;
  if (type === 'OrderSteps' && evaluate(def, [original[1]!, original[0]!, ...original.slice(2)]).score === 1) orderIndex = 2;
  const ordered = original.filter(id => id !== sourceId); ordered.splice(orderIndex, 0, sourceId);
  const keys = def.type === 'MatchPairs' ? def.left.map(item => item.id) : def.type === 'PromptBuilder' ? def.slots.map(item => item.id) : [];
  const firstAnswer = type === 'OrderSteps' ? ordered : { [keys[0]!]: sourceId };
  expect(evaluate(def, firstAnswer).score).toBeLessThan(1);
  const firstTarget = type === 'MatchPairs' ? editor.locator('[data-drop-id]').first() : type === 'OrderSteps' ? handles.nth(orderIndex).locator('..').locator('..') : editor.getByRole('combobox').first().locator('..').locator('..');
  await (type === 'MatchPairs' ? firstTarget : source).evaluate(node => node.scrollIntoView({ block: 'start' }));
  const targetBox = await firstTarget.boundingBox();
  expect(targetBox && targetBox.y >= 0 && targetBox.y + targetBox.height <= 900).toBeTruthy();
  await drag(page, source, firstTarget, true);
  await expect(source).toBeFocused();
  await editor.getByRole('button', { name: 'Проверить ответ', exact: true }).click();
  const readRecord = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).inline[id], { key: PROGRESS_KEY, id: def.id });
  const first = await readRecord();
  expect(first.first).toEqual(evaluate(def, firstAnswer));
  expect(first.correctionUsed).toBe(false);
  const awards = page.getByRole('complementary', { name: 'Уведомления о наградах' });
  while (await awards.getByRole('button').count()) await awards.getByRole('button').click();
  await expect(editor.getByRole('button', { name: 'Отправить окончательный ответ' })).toBeEnabled();
  await expect(source).toBeEnabled();
  const secondAnswer = type === 'OrderSteps' ? [sourceId, ...ordered.filter(id => id !== sourceId)] : { [keys[1]!]: sourceId };
  if (def.type === 'MatchPairs') await editor.getByRole('button', { name: `Механизм: ${def.left[1]!.text}`, exact: true }).click();
  const secondTarget = type === 'MatchPairs' ? editor.locator('[data-drop-id]').first() : type === 'OrderSteps' ? handles.first().locator('..').locator('..') : editor.getByRole('combobox').nth(1).locator('..').locator('..');
  await (type === 'MatchPairs' ? secondTarget : source).evaluate(node => node.scrollIntoView({ block: 'start' }));
  if (type === 'OrderSteps') await secondTarget.scrollIntoViewIfNeeded();
  await drag(page, source, secondTarget, true);
  await expect(source).toBeFocused();
  await editor.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  const final = await readRecord();
  expect(final.first).toEqual(first.first);
  expect(final.final).toEqual(evaluate(def, secondAnswer));
  expect(final.correctionUsed).toBe(true);
  for (const control of await editor.locator('button, select').all()) await expect(control).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: join(tmpdir(), `pea-inline-touch-${type}.png`) });
  await page.reload();
  await island.scrollIntoViewIfNeeded();
  await expect(editor.getByText('Первый результат:', { exact: false })).toBeVisible();
  for (const control of await editor.locator('button, select').all()) await expect(control).toBeDisabled();
  expect(await readRecord()).toEqual(final);
  expect(errors).toEqual([]);
});
function fixture(type: DragType) {
  for (let seed = 1; seed < 100; seed++) {
    const selected = selectQuiz(quizBank, seed);
    const definition = selected.find(item => item.type === type);
    if (!definition) continue;
    const attempt = createAttempt(selected, seed, `drag-${type}`);
    attempt.position = attempt.ids.indexOf(definition.id);
    return { definition, attempt };
  }
  throw Error(`Не найдено задание ${type}`);
}
async function drag(page: Page, source: Locator, target: Locator | null, touch: boolean, cancel = false) {
  await source.scrollIntoViewIfNeeded();
  const start = await source.boundingBox(); const end = target ? await target.boundingBox() : { x: 1, y: 250, width: 2, height: 2 };
  if (!start || !end) throw Error('Нет координат переноса');
  const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  const to = { x: end.x + end.width / 2, y: end.y + end.height / 2 };
  const session = touch ? await page.context().newCDPSession(page) : null;
  if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] });
  else { await page.mouse.move(from.x, from.y); await page.mouse.down(); }
  // A deliberate long press is part of the touch gesture, not a page-readiness wait.
  await page.waitForTimeout(300);
  for (let step = 1; step <= 20; step++) {
    const point = { x: from.x + (to.x - from.x) * step / 20, y: from.y + (to.y - from.y) * step / 20 };
    if (session) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
    else await page.mouse.move(point.x, point.y);
  }
  if (cancel) await page.keyboard.press('Escape');
  if (session) { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await session.detach(); }
  else await page.mouse.up();
  await expect(page.locator('[data-dnd-placeholder]')).toHaveCount(0);
  await expect(source).toHaveCount(1);
}

for (const type of types) for (const touch of [false, true]) test(`${type}: ${touch ? 'касание' : 'мышь'}, ответ и оценка`, async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const { definition: def, attempt } = fixture(type);
  await page.setViewportSize({ width: 1200, height: 1600 });
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  await page.goto('/quiz/');
  const editor = page.locator(`[data-exercise-type="${type}"]`);
  await expect(editor).toBeVisible();
  const draft = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).active.drafts[id], { key: PROGRESS_KEY, id: def.id });
  const handles = editor.locator('[data-drag-id]');
  await expect(handles.first()).toBeEnabled();
  const sourceId = await handles.first().getAttribute('data-drag-id');
  if (!sourceId) throw Error('У элемента отсутствует идентификатор перетаскивания');
  const source = editor.locator(`[data-drag-id="${sourceId}"]`);
  const target = type === 'MatchPairs' ? editor.locator('[data-drop-id]').first() : type === 'OrderSteps' ? handles.nth(1).locator('..').locator('..') : editor.getByRole('combobox').first().locator('..').locator('..');
  const initial = await draft();
  if (!touch) {
    await drag(page, source, target, false, true);
    expect(await draft()).toEqual(initial);
    await expect(source).toBeFocused();
    await drag(page, source, null, false);
    expect(await draft()).toEqual(initial);
    await expect(source).toBeFocused();
  }
  const expected = type === 'OrderSteps' ? [initial[1], initial[0], ...initial.slice(2)]
    : { [def.type === 'MatchPairs' ? def.left[0]!.id : def.type === 'PromptBuilder' ? def.slots[0]!.id : '']: sourceId };
  await drag(page, source, target, touch);
  await expect.poll(draft).toEqual(expected);
  await expect(source).toBeFocused();
  await expect(editor.getByRole('status').first()).toContainText(type === 'OrderSteps' ? 'Элемент перемещён' : 'Выбранный элемент помещён');
  await page.screenshot({ path: join(tmpdir(), `pea-drag-${type}-${touch ? 'touch' : 'mouse'}.png`) });
  await editor.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
  const saved = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).active.primary[id], { key: PROGRESS_KEY, id: def.id });
  expect(saved.answer).toEqual(expected);
  expect(saved.result).toEqual(evaluate(def, expected));
  await page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: `${attempt.position + 1} · отправлен`, exact: true }).click();
  for (const handle of await handles.all()) await expect(handle).toBeDisabled();
  for (const select of await editor.getByRole('combobox').all()) await expect(select).toBeDisabled();
  expect(await draft()).toEqual(expected);
  if (!touch) {
    // Reset only this isolated browser profile, then reach the same answer with
    // drag handles disabled and keyboard controls, not selectOption/click.
    await page.evaluate(key => localStorage.removeItem(key), PROGRESS_KEY);
    await page.reload();
    await expect(handles.first()).toBeEnabled();
    await handles.evaluateAll(nodes => nodes.forEach(node => { (node as HTMLButtonElement).disabled = true; }));
    if (type === 'OrderSteps') {
      const down = editor.getByRole('button', { name: 'Опустить шаг 1', exact: true });
      await down.focus(); await page.keyboard.press('Enter');
    } else if (def.type === 'MatchPairs') {
      const assign = editor.getByRole('button', { name: `Назначить описание: ${def.right.find(item => item.id === sourceId)!.text}`, exact: true });
      await assign.focus(); await assign.press('Enter');
    } else {
      const select = editor.getByRole('combobox').first();
      const values = await select.locator('option').evaluateAll(nodes => nodes.map(node => (node as HTMLOptionElement).value));
      await select.focus(); await page.keyboard.press('Home');
      for (let index = 0; index < values.indexOf(sourceId); index++) await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Tab');
    }
    await expect.poll(draft).toEqual(expected);
    const submit = editor.getByRole('button', { name: 'Отправить ответ', exact: true });
    await submit.focus(); await page.keyboard.press('Enter');
    const keyboardSaved = await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)!).active.primary[id], { key: PROGRESS_KEY, id: def.id });
    expect(keyboardSaved).toEqual(saved);
  }
  expect(errors).toEqual([]);
});

for (const type of types) test(`${type}: исправление снова разрешает перенос, финал блокирует`, async ({ page }) => {
  const { definition: def, attempt } = fixture(type);
  const selected = attempt.ids.map(id => quizBank.find(item => item.id === id)!);
  let correction = attempt;
  for (const id of attempt.ids) correction = quizReducer(correction, { type: 'skip', id }, selected);
  correction = quizReducer(correction, { type: 'navigate', position: attempt.position }, selected);
  await page.setViewportSize({ width: 1200, height: 1600 });
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: correction } });
  await page.goto('/quiz/');
  await expect(page.getByRole('heading', { name: 'Одна возможность исправить' })).toBeVisible();
  const editor = page.locator(`[data-exercise-type="${type}"]`);
  const handles = editor.locator('[data-drag-id]');
  await expect(handles.first()).toBeEnabled();
  const id = await handles.first().getAttribute('data-drag-id');
  if (!id) throw Error('У элемента отсутствует идентификатор перетаскивания');
  const source = editor.locator(`[data-drag-id="${id}"]`);
  const target = type === 'MatchPairs' ? editor.locator('[data-drop-id]').first() : type === 'OrderSteps' ? handles.nth(1).locator('..').locator('..') : editor.getByRole('combobox').first().locator('..').locator('..');
  await drag(page, source, target, false);
  const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).active, PROGRESS_KEY);
  expect(state.primary).toEqual(correction.primary);
  expect(state.drafts[def.id]).not.toEqual(correction.drafts[def.id]);
  await editor.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  await page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: `${attempt.position + 1} · отправлен`, exact: true }).click();
  for (const handle of await handles.all()) await expect(handle).toBeDisabled();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  const review = page.locator('details').nth(attempt.position);
  await review.locator('summary').click();
  for (const control of await review.locator('button, select').all()) await expect(control).toBeDisabled();
  const latest = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).latest, PROGRESS_KEY);
  expect(Object.keys(latest.primary).sort()).toEqual(Object.keys(correction.primary).sort());
  for (const question of selected) {
    const before = correction.primary[question.id]!;
    const after = latest.primary[question.id];
    expect(after.result).toEqual(before.result);
    expect(after.skipped).toBe(before.skipped);
    if (['CaseStudy', 'PromptSimulator', 'FillTheBlank'].includes(question.type)) expect(after.answer).toBeNull();
    else expect(after.answer).toEqual(before.answer);
  }
  expect(latest.drafts).toEqual({});
  expect(latest.corrections[def.id].answer).toEqual(state.drafts[def.id]);
});
