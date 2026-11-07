import { expect, it } from 'vitest';
import { createProgressStore, defaultProgress } from '../../src/storage/progress';
import { getExercise } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';

it.each([false, true])('объявление версии 3: завершено=%s, прежние баллы и остальные данные сохраняются', completed => {
  const def = getExercise('llm-3');
  let raw = '';
  const port = { getItem: () => raw || null, setItem: (_key: string, value: string) => { raw = value; } };
  const store = createProgressStore(port);
  store.setTheme('light');
  store.saveInline('llm-1', { first: evaluate(getExercise('llm-1'), false), correctionUsed: false });
  const first = evaluate(def, 'Составь объявление: встреча во вторник в 15:00, тема – план обучения.');
  store.saveInline(def.id, { first, correctionUsed: completed, ...(completed ? { final: first } : {}) });
  const legacy = JSON.parse(raw);
  legacy.inline[def.id].rubricVersion = 3;
  legacy.best = { first: 50, final: 70 };
  raw = JSON.stringify(legacy);
  const restored = createProgressStore(port);
  const before = structuredClone(restored.getSnapshot());
  expect(before.inline[def.id]?.first.score).toBe(.5);
  expect(restored.restartOutdatedInline(def.id)).toBe(!completed);
  if (completed) {
    expect(restored.getSnapshot()).toEqual(before);
  } else {
    expect(restored.getSnapshot().inline[def.id]).toBeUndefined();
    expect(restored.getSnapshot().inline['llm-1']).toEqual(before.inline['llm-1']);
    restored.saveInline(def.id, { first: evaluate(def, 'Составь краткое объявление: встреча во вторник в 15:00, тема – план обучения. Укажи, что место пока неизвестно.'), correctionUsed: false });
    expect(createProgressStore(port).getSnapshot().inline[def.id]).toMatchObject({ rubricVersion: 4, first: { score: 1 } });
  }
  expect(restored.getSnapshot().best).toEqual(before.best);
  expect(restored.getSnapshot().theme).toBe('light');
  expect(restored.getSnapshot().gamification).toEqual(before.gamification);
});

it('перезапуск удаляет только незавершённую старую рубрику, новая версия сохраняется без повторной награды', () => {
  const def = getExercise('safety-2');
  let raw = '';
  const port = { getItem: () => raw || null, setItem: (_key: string, value: string) => { raw = value; } };
  const store = createProgressStore(port);
  store.setTheme('light');
  store.saveInline(def.id, { first: evaluate(def, 'текст'), correctionUsed: false });
  const legacy = JSON.parse(raw);
  delete legacy.inline[def.id].rubricVersion;
  legacy.best = { first: 50, final: 70 };
  raw = JSON.stringify(legacy);
  const restored = createProgressStore(port);
  const game = restored.getSnapshot().gamification;
  restored.saveInline(def.id, { first: evaluate(def, 'текст'), correctionUsed: true, final: evaluate(def, 'иной текст') });
  expect(restored.getSnapshot().inline[def.id]?.correctionUsed).toBe(false);
  expect(restored.restartOutdatedInline(def.id)).toBe(true);
  expect(restored.getSnapshot().inline[def.id]).toBeUndefined();
  expect(restored.getSnapshot().best).toEqual(legacy.best);
  expect(restored.getSnapshot().theme).toBe('light');
  expect(restored.getSnapshot().gamification).toEqual(game);
  restored.saveInline(def.id, { first: evaluate(def, 'текст'), correctionUsed: false });
  expect(createProgressStore(port).getSnapshot().inline[def.id]?.rubricVersion).toBe(3);
  expect(restored.getSnapshot().gamification).toEqual(game);
  expect(restored.restartOutdatedInline(def.id)).toBe(false);
});

it('завершённый исторический результат и незатронутый тип не перезапускаются', () => {
  const def = getExercise('safety-2');
  const other = getExercise('llm-1');
  const state = { ...defaultProgress(), inline: {
    [def.id]: { first: evaluate(def, def.type === 'CaseStudy' ? def.example : ''), correctionUsed: false },
    [other.id]: { first: evaluate(other, true), correctionUsed: false },
  } };
  const store = createProgressStore({ getItem: () => JSON.stringify(state), setItem() {} });
  const before = structuredClone(store.getSnapshot());
  expect(before.inline[def.id]?.first.score).toBe(1);
  expect(store.restartOutdatedInline(def.id)).toBe(false);
  expect(store.restartOutdatedInline(other.id)).toBe(false);
  expect(store.getSnapshot()).toEqual(before);
});

it.each([false, true])('безопасность версии 2: завершено=%s, старые оценки сохраняются без пересчёта', completed => {
  const def = getExercise('safety-2');
  const first = evaluate(def, 'текст');
  if (completed) {
    first.score = 1;
    first.status = 'correct';
    first.breakdown = first.breakdown.map(row => ({ ...row, met: true, earned: row.weight, reason: 'matched' }));
  }
  let raw = JSON.stringify({ ...defaultProgress(), theme: 'light', best: { first: 50, final: 70 }, inline: {
    [def.id]: { first, correctionUsed: false, rubricVersion: 2 },
  } });
  const store = createProgressStore({ getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } });
  const before = structuredClone(store.getSnapshot());
  expect(before.inline[def.id]?.first).toEqual(first);
  expect(store.restartOutdatedInline(def.id)).toBe(!completed);
  if (completed) expect(store.getSnapshot()).toEqual(before);
  else {
    expect(store.getSnapshot().inline[def.id]).toBeUndefined();
    store.saveInline(def.id, { first: evaluate(def, 'Обезличенные данные не использовать.'), correctionUsed: false });
    expect(createProgressStore({ getItem: () => raw, setItem() {} }).getSnapshot().inline[def.id]).toMatchObject({ rubricVersion: 3, first: { score: 0 } });
  }
  expect(store.getSnapshot().theme).toBe(before.theme);
  expect(store.getSnapshot().best).toEqual(before.best);
});

it.each([false, true])('письмо версии 2: завершено=%s, прежние баллы не пересчитываются', completed => {
  const def = getExercise('context-2');
  if (def.type !== 'CaseStudy') throw new Error('Нужна рубрика письма');
  const first = evaluate(def, def.example);
  if (!completed) {
    first.score = .75;
    first.status = 'partial';
    first.breakdown = first.breakdown.map(row => row.id === 'limit' ? { ...row, met: false, earned: 0, reason: 'missing' } : row);
  }
  const state = { ...defaultProgress(), theme: 'light' as const, best: { first: 50, final: 70 }, inline: {
    [def.id]: { first, correctionUsed: false, rubricVersion: 2 },
  } };
  const store = createProgressStore({ getItem: () => JSON.stringify(state), setItem() {} });
  const before = structuredClone(store.getSnapshot());
  expect(before.inline[def.id]?.first.score).toBe(completed ? 1 : .75);
  expect(store.restartOutdatedInline(def.id)).toBe(!completed);
  if (completed) expect(store.getSnapshot()).toEqual(before);
  else {
    expect(store.getSnapshot().inline[def.id]).toBeUndefined();
    store.saveInline(def.id, { first: evaluate(def, def.example), correctionUsed: false });
    expect(store.getSnapshot().inline[def.id]).toMatchObject({ rubricVersion: 3, first: { score: 1 } });
  }
  expect(store.getSnapshot().theme).toBe(before.theme);
  expect(store.getSnapshot().best).toEqual(before.best);
});
