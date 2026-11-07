import { articleExercises } from '../../data/exercises/inline';
import type { TopicId } from '../../data/missions';

export function missionStatus(id: TopicId, submittedIds: string[]): string {
  const submitted = new Set(submittedIds);
  const count = articleExercises[id].filter(exerciseId => submitted.has(exerciseId)).length;
  return count === 0 ? 'Доступно' : count === 3 ? 'Пройдено · 3 из 3' : `В процессе · ${count} из 3`;
}
