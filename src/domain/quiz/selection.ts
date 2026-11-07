import { missions } from '../../data/missions';
import type { ExerciseDefinition } from '../exercises/types';

export function shuffle<T>(values: readonly T[], seed: number): T[] {
  let state = seed >>> 0;
  const random = () => { state += 0x6d2b79f5; let n = state; n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61); return ((n ^ n >>> 14) >>> 0) / 4294967296; };
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [result[i], result[j]] = [result[j]!, result[i]!]; }
  return result;
}
const advanced = new Set(['CaseStudy', 'PromptSimulator', 'SpotTheHallucination', 'PromptBuilder']);
export function selectQuiz(bank: ExerciseDefinition[], seed: number): ExerciseDefinition[] {
  if (bank.length !== 24 || new Set(bank.map(item => item.id)).size !== 24) throw new Error('Банк должен содержать 24 уникальных задания.');
  const groups = missions.map(mission => {
    const group = bank.filter(item => item.topicId === mission.id);
    if (group.length !== 4) throw new Error(`Для темы ${mission.id} нужно четыре задания.`);
    const pairs: ExerciseDefinition[][] = [];
    group.forEach((first, index) => group.slice(index + 1).forEach(second => pairs.push([first, second])));
    return shuffle(pairs, seed + mission.id.length);
  });
  // Exhaustive bounded search: at most 6^6 combinations. No probabilistic failure.
  function search(index: number, chosen: ExerciseDefinition[]): ExerciseDefinition[] | undefined {
    if (index === groups.length) {
      const types = new Set(chosen.map(item => item.type));
      return types.size >= 7 && [...types].filter(type => advanced.has(type)).length >= 2 && types.has('ContextBudget') ? chosen : undefined;
    }
    for (const pair of groups[index]!) { const result = search(index + 1, [...chosen, ...pair]); if (result) return result; }
    return undefined;
  }
  const chosen = search(0, []);
  if (!chosen) throw new Error('Банк не позволяет собрать тест с нужным разнообразием.');
  return shuffle(chosen, seed);
}
