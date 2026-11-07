import { missions, type TopicId } from '../../data/missions';
import type { ExerciseDefinition } from '../exercises/types';
import type { QuizAttempt } from '../quiz/state';

/** Final topic means, weakest first; equal means follow the course route. */
export function recommendTopics(attempt: QuizAttempt, definitions: ExerciseDefinition[]): TopicId[] {
  const topicById = new Map(definitions.map(definition => [definition.id, definition.topicId]));
  return missions.map((mission, order) => ({
    id: mission.id,
    order,
    score: attempt.ids.filter(id => topicById.get(id) === mission.id)
      .reduce((sum, id) => sum + (attempt.corrections[id] ?? attempt.primary[id])!.result.score, 0) / 2,
  })).filter(item => item.score < 1)
    .sort((a, b) => a.score - b.score || a.order - b.order)
    .map(item => item.id);
}
