import type { ExerciseDefinition } from '../exercises/types';
import type { QuizAttempt } from './state';
import { shuffle } from './selection';

/** Display-only permutation; answers and evaluation continue to use stable IDs. */
export function presentQuestion(definition: ExerciseDefinition, attempt: Pick<QuizAttempt, 'seed' | 'presentationVersion'>): ExerciseDefinition {
  // Attempts created before this feature keep their original display order.
  if (attempt.presentationVersion !== 1) return definition;
  let seed = attempt.seed >>> 0;
  for (const char of definition.id) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619) >>> 0;
  switch (definition.type) {
    case 'MultipleChoice': return { ...definition, options: shuffle(definition.options, seed) };
    case 'MatchPairs': return { ...definition, right: shuffle(definition.right, seed) };
    case 'PromptBuilder': return { ...definition, blocks: shuffle(definition.blocks, seed) };
    case 'ContextBudget': return { ...definition, fragments: shuffle(definition.fragments, seed) };
    default: return definition;
  }
}
