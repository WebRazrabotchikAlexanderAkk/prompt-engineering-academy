import { describe, expect, it } from 'vitest';
import { achievements, emptyGame, gameReducer, xpTotal, xpCatalog, rank, type GameEvent } from '../../src/domain/gamification/catalog';
import { articleExercises } from '../../src/data/exercises/inline';
import { fixtures } from '../fixtures/exercises';
import { evaluate } from '../../src/domain/scoring/evaluate';
import type { ExerciseDefinition, ExerciseResult } from '../../src/domain/exercises/types';

const finalEvent = (firstPercent: number, finalPercent: number, results: ExerciseResult[] = [], definitions: ExerciseDefinition[] = []): GameEvent =>
  ({ type: 'quizFinalCompleted', firstPercent, finalPercent, results, definitions });
describe('Награды', () => {
  it('каталог ограничен 660 XP, события идемпотентны', () => {
    let state = emptyGame();
    for (const exerciseId of Object.values(articleExercises).flat()) { state = gameReducer(state, { type: 'inlineSubmitted', exerciseId }); state = gameReducer(state, { type: 'inlineSubmitted', exerciseId }); }
    for (const articleId of Object.keys(articleExercises)) state = gameReducer(state, { type: 'articleCompleted', articleId });
    state = gameReducer(state, { type: 'quizPrimaryCompleted' });
    state = gameReducer(state, { type: 'quizFinalCompleted', firstPercent: 80, finalPercent: 95, results: [], definitions: [] });
    expect(xpTotal(state)).toBe(660);
    expect(Object.values(xpCatalog).reduce((a, b) => a + b, 0)).toBe(660);
    expect(xpTotal(gameReducer(state, { type: 'inlineSubmitted', exerciseId: 'unknown' }))).toBe(660);
  });
  it.each([
    [0, 'Исследователь промптов'], [49.99, 'Исследователь промптов'],
    [50, 'Практик'], [69.99, 'Практик'], [70, 'Prompt Engineer'],
    [84.99, 'Prompt Engineer'], [85, 'Продвинутый Prompt Engineer'],
    [94.99, 'Продвинутый Prompt Engineer'], [95, 'Архитектор промптов'],
    [100, 'Архитектор промптов'],
  ] as const)('ранг на %s%%', (score, expected) => expect(rank(score)).toBe(expected));

  it('первые задания и статьи открывают достижения по известным ID только один раз', () => {
    const exerciseId = articleExercises.llm[0]!;
    const unknown = gameReducer(emptyGame(), { type: 'inlineSubmitted', exerciseId: 'unknown' });
    expect(unknown.unlockedAchievementIds).toEqual([]);
    const first = gameReducer(emptyGame(), { type: 'inlineSubmitted', exerciseId });
    expect(first.unlockedAchievementIds).toEqual(['ach-first-signal']);
    expect(xpTotal(first)).toBe(10);
    expect(gameReducer(first, { type: 'inlineSubmitted', exerciseId })).toEqual(first);

    let route = gameReducer(emptyGame(), { type: 'articleCompleted', articleId: 'unknown' });
    expect(route.unlockedAchievementIds).toEqual([]);
    const articleIds = Object.keys(articleExercises);
    for (const articleId of articleIds.slice(0, 5)) route = gameReducer(route, { type: 'articleCompleted', articleId });
    expect(route.unlockedAchievementIds).toEqual(['ach-first-mission']);
    expect(xpTotal(route)).toBe(150);
    route = gameReducer(route, { type: 'articleCompleted', articleId: articleIds[5]! });
    expect(route.unlockedAchievementIds).toEqual(['ach-first-mission', 'ach-route-complete']);
    expect(xpTotal(route)).toBe(180);
    expect(gameReducer(route, { type: 'articleCompleted', articleId: articleIds[5]! })).toEqual(route);
  });

  it.each([
    [69.99, 60, false, false], [70, 130, true, false],
    [84.99, 130, true, false], [85, 180, true, false],
    [94.99, 180, true, false], [95, 230, true, true],
  ] as const)('финальный порог %s%% начисляет %s XP', (score, xp, trust, precision) => {
    const state = gameReducer(emptyGame(), finalEvent(score, score));
    expect(xpTotal(state)).toBe(xp);
    expect(state.unlockedAchievementIds.includes('ach-trust-threshold')).toBe(trust);
    expect(state.unlockedAchievementIds.includes('ach-precision-architecture')).toBe(precision);
    expect(gameReducer(state, finalEvent(score, score))).toEqual(state);
    expect(gameReducer(emptyGame(), { type: 'quizPrimaryCompleted' }).unlockedAchievementIds).toEqual([]);
  });

  it('улучшение 9.99 пункта не открывает протокол; 10 пунктов открывают однократно', () => {
    const below = gameReducer(emptyGame(), finalEvent(80, 89.99));
    expect(below.awardedXpKeys).not.toContain('quiz:correction-gain:10');
    expect(below.unlockedAchievementIds).not.toContain('ach-correction-protocol');
    const at = gameReducer(emptyGame(), finalEvent(80, 90));
    expect(at.awardedXpKeys).toContain('quiz:correction-gain:10');
    expect(at.unlockedAchievementIds).toContain('ach-correction-protocol');
    expect(xpTotal(at) - xpTotal(below)).toBe(30);
    expect(gameReducer(at, finalEvent(80, 90))).toEqual(at);
  });

  it('Хранитель контекста требует точный результат ContextBudget на финале', () => {
    const definition = fixtures.find(item => item.definition.type === 'ContextBudget')!.definition;
    const perfect = evaluate(definition, ['a']);
    expect(perfect.score).toBe(1);
    const near = gameReducer(emptyGame(), finalEvent(0, 70, [{ ...perfect, score: .99999 }], [definition]));
    expect(near.unlockedAchievementIds).not.toContain('ach-context-guardian');
    const unrelated = gameReducer(emptyGame(), finalEvent(0, 70, [perfect], [fixtures[0]!.definition]));
    expect(unrelated.unlockedAchievementIds).not.toContain('ach-context-guardian');
    const exact = gameReducer(emptyGame(), finalEvent(0, 70, [perfect], [definition]));
    expect(exact.unlockedAchievementIds).toContain('ach-context-guardian');
    expect(gameReducer(exact, finalEvent(0, 70, [perfect], [definition])).unlockedAchievementIds).toEqual(exact.unlockedAchievementIds);
    expect(achievements.map(item => item.id).sort()).toEqual([
      'ach-first-signal', 'ach-first-mission', 'ach-route-complete', 'ach-correction-protocol',
      'ach-trust-threshold', 'ach-context-guardian', 'ach-precision-architecture',
    ].sort());
  });
});
