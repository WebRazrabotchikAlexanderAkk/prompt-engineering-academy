import { articleExercises } from '../../data/exercises/inline';
import type { ExerciseDefinition, ExerciseResult } from '../exercises/types';
export interface GameState { catalogVersion: 1; awardedXpKeys: string[]; unlockedAchievementIds: string[] }
export const emptyGame = (): GameState => ({ catalogVersion: 1, awardedXpKeys: [], unlockedAchievementIds: [] });
export const achievements = [
  { id: 'ach-first-signal', title: 'Первый сигнал' }, { id: 'ach-first-mission', title: 'Контур запущен' }, { id: 'ach-route-complete', title: 'Сеть собрана' }, { id: 'ach-correction-protocol', title: 'Протокол коррекции' }, { id: 'ach-trust-threshold', title: 'Порог доверия' }, { id: 'ach-context-guardian', title: 'Хранитель контекста' }, { id: 'ach-precision-architecture', title: 'Точная архитектура' },
];
export const rewards = [{ id: 'reward-sensor-module', threshold: 100, title: 'Сенсорный модуль' }, { id: 'reward-context-circuit', threshold: 300, title: 'Контекстный контур' }, { id: 'reward-architecture-key', threshold: 500, title: 'Ключ архитектуры' }];
export const xpCatalog: Record<string, number> = {
  ...Object.fromEntries(Object.values(articleExercises).flat().map(id => [`inline:first-submit:${id}`, 10])),
  ...Object.fromEntries(Object.keys(articleExercises).map(id => [`article:complete:${id}`, 30])),
  'quiz:primary:first': 40, 'quiz:final:first': 60, 'quiz:threshold:70': 70, 'quiz:threshold:85': 50, 'quiz:threshold:95': 50, 'quiz:correction-gain:10': 30,
};
export type GameEvent = { type: 'inlineSubmitted'; exerciseId: string } | { type: 'articleCompleted'; articleId: string } | { type: 'quizPrimaryCompleted' } | { type: 'quizFinalCompleted'; firstPercent: number; finalPercent: number; results: ExerciseResult[]; definitions: ExerciseDefinition[] };
export function xpTotal(state: GameState): number { return [...new Set(state.awardedXpKeys)].reduce((sum, key) => sum + (Object.hasOwn(xpCatalog, key) ? xpCatalog[key]! : 0), 0); }
export function gameReducer(state: GameState, event: GameEvent): GameState {
  const keys = new Set(state.awardedXpKeys.filter(key => Object.hasOwn(xpCatalog, key)));
  const unlocked = new Set(state.unlockedAchievementIds.filter(id => achievements.some(item => item.id === id)));
  const award = (key: string) => { if (Object.hasOwn(xpCatalog, key)) keys.add(key); };
  if (event.type === 'inlineSubmitted') award(`inline:first-submit:${event.exerciseId}`);
  if (event.type === 'articleCompleted') award(`article:complete:${event.articleId}`);
  if (event.type === 'quizPrimaryCompleted') award('quiz:primary:first');
  if ([...keys].some(key => key.startsWith('inline:'))) unlocked.add('ach-first-signal');
  if ([...keys].some(key => key.startsWith('article:'))) unlocked.add('ach-first-mission');
  if ([...keys].filter(key => key.startsWith('article:')).length === 6) unlocked.add('ach-route-complete');
  if (event.type === 'quizFinalCompleted') {
    award('quiz:final:first');
    for (const threshold of [70, 85, 95]) if (event.finalPercent >= threshold) award(`quiz:threshold:${threshold}`);
    if (Math.round(event.finalPercent * 100) - Math.round(event.firstPercent * 100) >= 1000) { award('quiz:correction-gain:10'); unlocked.add('ach-correction-protocol'); }
    if (event.finalPercent >= 70) unlocked.add('ach-trust-threshold');
    if (event.finalPercent >= 95) unlocked.add('ach-precision-architecture');
    if (event.results.some(result => result.score === 1 && event.definitions.some(def => def.id === result.exerciseId && def.type === 'ContextBudget'))) unlocked.add('ach-context-guardian');
  }
  return { catalogVersion: 1, awardedXpKeys: [...keys], unlockedAchievementIds: [...unlocked] };
}
export function rank(score: number): string { return score < 50 ? 'Исследователь промптов' : score < 70 ? 'Практик' : score < 85 ? 'Prompt Engineer' : score < 95 ? 'Продвинутый Prompt Engineer' : 'Архитектор промптов'; }
