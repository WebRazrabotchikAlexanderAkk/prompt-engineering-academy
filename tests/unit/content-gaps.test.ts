import { expect, it } from 'vitest';
import { getExercise } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { rubricVersion, CONTENT_VERSION } from '../../src/data/contentVersion';
import { createProgressStore, defaultProgress } from '../../src/storage/progress';

it('изменение одного условия проверяется отдельно от названий частей запроса', () => {
  const def = getExercise('structure-1');
  expect(evaluate(def, { task: 'задача', format: 'формат', experiment: 'длину' }).score).toBe(1);
  expect(evaluate(def, { task: 'задача', format: 'формат', experiment: 'все' }).score).toBeCloseTo(2 / 3);
});

it('краткая справка сохраняет условие и неопределённость; усиленное обещание не принимается', () => {
  const def = getExercise('tokens-3');
  expect(evaluate(def, ['o1', 'o3']).score).toBe(1);
  expect(evaluate(def, ['o1']).score).toBe(.5);
  expect(evaluate(def, ['o1', 'o3', 'o4']).score).toBe(0);
  expect(evaluate(def, ['o2', 'o3']).score).toBe(0);
});

it.each(['structure-1', 'tokens-3'])('%s: старая незавершённая попытка требует адресного перезапуска', id => {
  const def = getExercise(id);
  const first = { exerciseId: id, topicId: def.topicId, score: 0, status: 'incorrect' as const, breakdown: [] };
  const state = { ...defaultProgress(), inline: { [id]: { first, correctionUsed: false } } };
  const store = createProgressStore({ getItem: () => JSON.stringify(state), setItem() {} });
  expect(rubricVersion(def)).toBe(2);
  expect(CONTENT_VERSION).toBe(7);
  expect(store.getSnapshot().inline[id]?.first).toEqual(first);
  expect(store.restartOutdatedInline(id)).toBe(true);
  expect(store.getSnapshot().inline[id]).toBeUndefined();
});
