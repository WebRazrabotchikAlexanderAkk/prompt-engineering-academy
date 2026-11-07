// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ProgressPanel from '../../src/islands/ProgressPanel';
import { defaultProgress, createProgressStore, type Progress } from '../../src/storage/progress';
import { inlineExercises, articleExercises } from '../../src/data/exercises/inline';
import { missions } from '../../src/data/missions';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { emptyGame, gameReducer, xpTotal, rewards, type GameEvent } from '../../src/domain/gamification/catalog';
import { createAttempt, quizReducer } from '../../src/domain/quiz/state';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';

const mocked = vi.hoisted(() => ({ progress: null as Progress | null }));
vi.mock('../../src/storage/useProgress', () => ({ useProgress: () => mocked.progress, useStorageWarning: () => '' }));
beforeEach(() => { mocked.progress = defaultProgress(); });
afterEach(cleanup);

it('показывает 0–18 принятых упражнений, не считает повторы и тест, сохраняет тему после сброса', () => {
  let raw: string | null = null;
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
  const store = createProgressStore(storage);
  mocked.progress = store.getSnapshot();
  const { rerender } = render(<ProgressPanel expanded />);
  let savedCount = 0;
  for (const [target, percent] of [[0, 0], [1, 6], [3, 17], [9, 50], [17, 94], [18, 100]] as const) {
    for (const definition of inlineExercises.slice(savedCount, target)) store.saveInline(definition.id, { first: evaluate(definition, null), correctionUsed: false });
    savedCount = target;
    mocked.progress = store.getSnapshot(); rerender(<ProgressPanel expanded />);
    expect(screen.getByText(/Прогресс курса:/).textContent).toContain(`${target} из 18 · ${percent}%`);
  }
  const first = inlineExercises[0]!;
  store.saveInline(first.id, { first: evaluate(first, null), final: evaluate(first, false), correctionUsed: true });
  store.saveInline('unknown', { first: evaluate(first, null), correctionUsed: false });
  expect(Object.keys(store.getSnapshot().inline)).toHaveLength(18);
  expect(xpTotal(store.getSnapshot().gamification)).toBe(360);

  const selected = selectQuiz(quizBank, 1);
  let attempt = createAttempt(selected, 1, 'progress-boundary');
  for (const definition of selected) attempt = quizReducer(attempt, { type: 'skip', id: definition.id }, selected);
  store.saveQuiz(attempt, selected);
  attempt = quizReducer(attempt, { type: 'finish' }, selected);
  store.saveQuiz(attempt, selected);
  mocked.progress = store.getSnapshot(); rerender(<ProgressPanel expanded />);
  expect(screen.getByText(/Прогресс курса:/).textContent).toContain('18 из 18 · 100%');
  expect(createProgressStore(storage).getSnapshot().inline).toEqual(store.getSnapshot().inline);

  store.setTheme('light'); store.reset();
  mocked.progress = store.getSnapshot(); rerender(<ProgressPanel expanded />);
  expect(screen.getByText(/Прогресс курса:/).textContent).toContain('0 из 18 · 0%');
  expect(store.getSnapshot()).toMatchObject({ theme: 'light', inline: {}, active: null, latest: null, best: null });
  expect(store.getSnapshot().gamification).toEqual(emptyGame());
  expect(createProgressStore(storage).getSnapshot()).toEqual(store.getSnapshot());
});

it.each([
  [90, 5, 0, true, null, [false, false, false]],
  [100, 6, 0, true, null, [true, false, false]],
  [290, 10, 3, true, [0, 0], [true, false, false]],
  [300, 11, 3, true, [0, 0], [true, true, false]],
  [490, 17, 5, true, [70, 70], [true, true, false]],
  [500, 15, 5, true, [60, 70], [true, true, true]],
] as const)('эмблемы на границе %s XP', (expectedXp, inlineCount, articleCount, primary, final, unlocked) => {
  const spreadIds = missions.map(item => articleExercises[item.id][0]!);
  const inlineIds = inlineCount <= 6 ? spreadIds.slice(0, inlineCount) : inlineExercises.slice(0, inlineCount).map(item => item.id);
  let game = emptyGame();
  for (const exerciseId of inlineIds) game = gameReducer(game, { type: 'inlineSubmitted', exerciseId });
  for (const articleId of missions.slice(0, articleCount).map(item => item.id)) game = gameReducer(game, { type: 'articleCompleted', articleId });
  if (primary) game = gameReducer(game, { type: 'quizPrimaryCompleted' });
  if (final) game = gameReducer(game, { type: 'quizFinalCompleted', firstPercent: final[0], finalPercent: final[1], results: [], definitions: [] } satisfies GameEvent);
  expect(xpTotal(game)).toBe(expectedXp);
  mocked.progress = { ...defaultProgress(), gamification: game };
  render(<ProgressPanel expanded />);
  expect(rewards.map(item => item.threshold)).toEqual([100, 300, 500]);
  for (const [index, reward] of rewards.entries()) {
    const row = screen.getByText(new RegExp(reward.title)).closest('li');
    expect(row?.textContent).toContain(unlocked[index] ? 'Открыто' : `Нужно ${reward.threshold} XP`);
  }
});
