import { expect, it } from 'vitest';
import { presentQuestion } from '../../src/domain/quiz/presentation';
import { createAttempt } from '../../src/domain/quiz/state';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { quizBank } from '../../src/data/quiz/bank';
import { fixtures } from '../fixtures/exercises';
import { evaluate } from '../../src/domain/scoring/evaluate';

it('новая попытка включает версию представления, старая сохраняет прежний порядок', () => {
  const attempt = createAttempt(selectQuiz(quizBank, 1), 1, 'new');
  expect(attempt.presentationVersion).toBe(1);
  const def = fixtures[0]!.definition;
  expect(presentQuestion(def, { seed: 1 })).toBe(def);
});

it('перемешивание повторяемо, меняется между попытками и не меняет эталоны/оценки', () => {
  for (const fixture of fixtures) {
    const original = JSON.stringify(fixture.definition);
    const outputs = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const state = { seed, presentationVersion: 1 as const };
      const display = presentQuestion(fixture.definition, state);
      expect(presentQuestion(fixture.definition, state)).toEqual(display);
      const evaluated = evaluate(display, fixture.answer);
      const canonical = evaluate(fixture.definition, fixture.answer);
      expect({ ...evaluated, breakdown: Object.fromEntries(evaluated.breakdown.map(row => [row.id, row])) })
        .toEqual({ ...canonical, breakdown: Object.fromEntries(canonical.breakdown.map(row => [row.id, row])) });
      outputs.add(JSON.stringify(display));
      if (display.type === 'PromptBuilder' && fixture.definition.type === 'PromptBuilder') expect(display.slots).toEqual(fixture.definition.slots);
      if (display.type === 'OrderSteps' && fixture.definition.type === 'OrderSteps') expect(display.correctOrder).toEqual(fixture.definition.correctOrder);
    }
    expect(JSON.stringify(fixture.definition)).toBe(original);
    if (['MultipleChoice', 'MatchPairs', 'PromptBuilder', 'ContextBudget'].includes(fixture.definition.type)) expect(outputs.size).toBeGreaterThan(1);
    else expect(outputs.size).toBe(1);
  }
});
