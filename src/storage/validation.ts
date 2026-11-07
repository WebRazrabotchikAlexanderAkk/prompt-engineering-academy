import type { ExerciseAnswer, ExerciseDefinition, ExerciseResult } from '../domain/exercises/types';
import type { QuizAttempt, Submission } from '../domain/quiz/state';
import { evaluate, isEmpty } from '../domain/scoring/evaluate';
import { CONTENT_VERSION } from '../data/contentVersion';

const record = (value: ExerciseAnswer): value is Record<string, string> => !!value && typeof value === 'object' && !Array.isArray(value);
const unique = (values: string[]) => new Set(values).size === values.length;
function sameAnswer(first: ExerciseAnswer, second: ExerciseAnswer): boolean {
  if (record(first) && record(second)) return Object.keys(first).length === Object.keys(second).length && Object.entries(first).every(([key, value]) => Object.hasOwn(second, key) && second[key] === value);
  return JSON.stringify(first) === JSON.stringify(second);
}

export function validStoredAnswer(def: ExerciseDefinition, answer: ExerciseAnswer): boolean {
  const list = (ids: string[]) => Array.isArray(answer) && unique(answer) && answer.every(id => ids.includes(id));
  const mapping = (keys: string[], values?: string[]) => record(answer) && Object.entries(answer).every(([key, value]) => keys.includes(key) && typeof value === 'string' && (!values || values.includes(value))) && (!values || unique(Object.values(answer)));
  switch (def.type) {
    case 'TrueFalse': return answer === null || typeof answer === 'boolean';
    case 'CaseStudy': case 'PromptSimulator': return typeof answer === 'string';
    case 'FillTheBlank': return mapping(def.blanks.map(item => item.id));
    case 'MatchPairs': return mapping(def.left.map(item => item.id), def.right.map(item => item.id));
    case 'PromptBuilder': return mapping(def.slots.map(item => item.id), def.blocks.map(item => item.id));
    case 'MultipleChoice': return list(def.options.map(item => item.id)) && (def.multiple || (answer as string[]).length <= 1);
    case 'OrderSteps': return list(def.items.map(item => item.id)) && (answer as string[]).length === def.items.length;
    case 'SpotTheHallucination': return list(def.claims.map(item => item.id));
    case 'ContextBudget': return list(def.fragments.map(item => item.id));
  }
}

/** Compare only persisted, non-text result fields. Never correct a stored score silently. */
function sameResult(actual: ExerciseResult, expected: ExerciseResult, legacyBuilder = false): boolean {
  return actual.exerciseId === expected.exerciseId && actual.topicId === expected.topicId && actual.score === expected.score && actual.status === expected.status
    && actual.breakdown.length === expected.breakdown.length && unique(actual.breakdown.map(row => row.id))
    && actual.breakdown.every(row => expected.breakdown.some(other => row.id === other.id && row.met === other.met && row.earned === other.earned && row.weight === other.weight && (row.reason === other.reason || legacyBuilder && row.reason === 'wrong' && ['missing', 'forbidden'].includes(other.reason))));
}

function validSubmission(def: ExerciseDefinition, submission: Submission, final: boolean): boolean {
  if (submission.result.topicId !== def.topicId) return false;
  const text = ['CaseStudy', 'PromptSimulator', 'FillTheBlank'].includes(def.type);
  const erased = final && text && submission.answer === null;
  if (!erased && !validStoredAnswer(def, submission.answer)) return false;
  if (submission.skipped) return submission.result.score === 0 && submission.result.breakdown.length === 0;
  if (!erased) return !isEmpty(submission.answer) && sameResult(submission.result, evaluate(def, submission.answer), def.type === 'PromptBuilder');
  // The text was intentionally erased. Validate its persisted rubric, not a fictitious empty answer.
  const criteria = def.type === 'FillTheBlank' ? def.blanks.map(blank => ({ id: blank.id, weight: 1 / def.blanks.length }))
    : def.type === 'CaseStudy' || def.type === 'PromptSimulator' ? def.criteria : [];
  const rows = submission.result.breakdown;
  if (rows.length !== criteria.length || !unique(rows.map(row => row.id)) || !rows.every(row => criteria.some(criterion => row.id === criterion.id && row.weight === criterion.weight) && row.earned === (row.met ? row.weight : 0) && (row.met ? row.reason === 'matched' : row.reason !== 'matched'))) return false;
  const score = rows.every(row => row.met) ? 1 : rows.reduce((sum, row) => sum + row.earned, 0);
  return Math.abs(score - submission.result.score) < 1e-12;
}

/** Input has already passed structural JSON validation. */
export function consistentAttempt(attempt: QuizAttempt, bank: ExerciseDefinition[]): boolean {
  if (!attempt.id.trim() || attempt.seed < 0 || attempt.seed > 0xffffffff || attempt.contentVersion < 1) return false;
  const primary = Object.keys(attempt.primary);
  const corrections = Object.keys(attempt.corrections);
  const eligible = attempt.ids.filter(id => attempt.primary[id] && attempt.primary[id]!.result.score < 1);
  if (attempt.phase === 'primaryInProgress') {
    if (primary.length >= 12 || corrections.length) return false;
  } else if (primary.length !== 12) return false;
  if (attempt.phase === 'correctionInProgress' && (!eligible.length || corrections.length === eligible.length)) return false;
  if (corrections.some(id => !eligible.includes(id) || attempt.corrections[id]!.skipped)) return false;
  if ([...Object.values(attempt.primary), ...Object.values(attempt.corrections)].some(entry => entry.skipped && (entry.result.score !== 0 || entry.result.breakdown.length))) return false;
  // Another content version is shown as incompatible by the UI. Keep historical scores intact.
  if (attempt.contentVersion !== CONTENT_VERSION) return true;
  const definitions = attempt.ids.map(id => bank.find(def => def.id === id));
  if (definitions.some(def => !def)) return false;
  const known = definitions as ExerciseDefinition[];
  const types = new Set(known.map(def => def.type));
  const topics = new Set(known.map(def => def.topicId));
  if (topics.size !== 6 || [...topics].some(topic => known.filter(def => def.topicId === topic).length !== 2) || types.size < 7 || !types.has('ContextBudget') || ['CaseStudy', 'PromptSimulator', 'SpotTheHallucination', 'PromptBuilder'].filter(type => types.has(type as ExerciseDefinition['type'])).length < 2) return false;
  const final = attempt.phase === 'finalComplete';
  for (const def of known) {
    if (!final && (!Object.hasOwn(attempt.drafts, def.id) || !validStoredAnswer(def, attempt.drafts[def.id]!))) return false;
    const first = attempt.primary[def.id]; const correction = attempt.corrections[def.id];
    if (first && !validSubmission(def, first, final)) return false;
    if (correction && !validSubmission(def, correction, final)) return false;
    const locked = correction ?? (attempt.phase === 'primaryInProgress' || first?.result.score === 1 ? first : undefined);
    if (!final && locked && !sameAnswer(attempt.drafts[def.id]!, locked.answer)) return false;
  }
  return true;
}
