import type { ExerciseDefinition } from '../domain/exercises/types';

export const CONTENT_VERSION = 7;
export function rubricVersion(def: ExerciseDefinition): number {
  if (def.id === 'llm-3') return 4;
  if (['safety-2', 'context-2'].includes(def.id)) return 3;
  if (['structure-1', 'tokens-3'].includes(def.id)) return 2;
  return def.type === 'CaseStudy' || def.type === 'PromptSimulator' ? 2 : 1;
}
