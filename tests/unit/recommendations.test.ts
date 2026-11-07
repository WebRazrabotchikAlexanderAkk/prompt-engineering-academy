import { expect, it } from 'vitest';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt, type Submission } from '../../src/domain/quiz/state';
import { quizBank } from '../../src/data/quiz/bank';
import { missions } from '../../src/data/missions';
import { recommendTopics } from '../../src/domain/progress/recommendations';

it('советует только слабые финальные темы, сортирует равные по маршруту', () => {
  const selected = selectQuiz(quizBank, 42);
  const attempt = createAttempt(selected, 42, 'recommendations');
  attempt.phase = 'finalComplete';
  const scores = [0, .5, 0, .5, 0, 1, 1, 1, 1, 1, 1, 1];
  for (const [topicIndex, mission] of missions.entries()) {
    const definitions = selected.filter(item => item.topicId === mission.id);
    for (const [questionIndex, definition] of definitions.entries()) {
      const score = scores[topicIndex * 2 + questionIndex]!;
      attempt.primary[definition.id] = {
        answer: null, skipped: false,
        result: { exerciseId: definition.id, topicId: mission.id, score, status: score === 1 ? 'correct' : score === 0 ? 'incorrect' : 'partial', breakdown: [] },
      } satisfies Submission;
    }
  }
  expect(recommendTopics(attempt, selected)).toEqual(missions.slice(0, 3).map(item => item.id));
  const secondTopic = selected.find(item => item.topicId === missions[1]!.id && attempt.primary[item.id]!.result.score === 0)!;
  attempt.corrections[secondTopic.id] = {
    ...attempt.primary[secondTopic.id]!,
    result: { ...attempt.primary[secondTopic.id]!.result, score: 1, status: 'correct' },
  };
  expect(recommendTopics(attempt, selected)).toEqual([missions[0]!.id, missions[2]!.id, missions[1]!.id]);
  for (const item of selected) attempt.primary[item.id] = {
    ...attempt.primary[item.id]!,
    result: { ...attempt.primary[item.id]!.result, score: 1, status: 'correct' },
  };
  attempt.corrections = {};
  expect(recommendTopics(attempt, selected)).toEqual([]);
});
