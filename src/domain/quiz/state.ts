import type { ExerciseAnswer, ExerciseDefinition, ExerciseResult } from '../exercises/types';
import { evaluate, isEmpty } from '../scoring/evaluate';
import { shuffle } from './selection';
import { CONTENT_VERSION } from '../../data/contentVersion';

export interface Submission { answer: ExerciseAnswer; result: ExerciseResult; skipped: boolean }
export interface QuizAttempt {
  id: string;
  seed: number;
  contentVersion: number;
  presentationVersion?: 1;
  ids: string[];
  phase: 'primaryInProgress' | 'correctionInProgress' | 'finalComplete';
  position: number;
  drafts: Record<string, ExerciseAnswer>;
  primary: Record<string, Submission>;
  corrections: Record<string, Submission>;
}
export type QuizAction = { type: 'draft' | 'submit'; id: string; answer: ExerciseAnswer } | { type: 'skip'; id: string } | { type: 'navigate'; position: number } | { type: 'finish' };
export function initialAnswer(def: ExerciseDefinition, seed = 1): ExerciseAnswer {
  if (def.type === 'OrderSteps') return shuffle(def.items.map(item => item.id), seed);
  if (def.type === 'CaseStudy' || def.type === 'PromptSimulator') return '';
  if (def.type === 'TrueFalse') return null;
  if (['MatchPairs', 'FillTheBlank', 'PromptBuilder'].includes(def.type)) return {};
  return [];
}
export function createAttempt(questions: ExerciseDefinition[], seed: number, id: string): QuizAttempt {
  if (questions.length !== 12 || new Set(questions.map(item => item.id)).size !== 12) throw new Error('Нужно 12 уникальных вопросов.');
  return { id, seed, contentVersion: CONTENT_VERSION, presentationVersion: 1, ids: questions.map(item => item.id), phase: 'primaryInProgress', position: 0, drafts: Object.fromEntries(questions.map((item, index) => [item.id, initialAnswer(item, seed + index)])), primary: {}, corrections: {} };
}
export function eligibleIds(state: QuizAttempt): string[] { return state.ids.filter(id => state.primary[id] && state.primary[id]!.result.score < 1); }
export function quizReducer(state: QuizAttempt, action: QuizAction, definitions: ExerciseDefinition[]): QuizAttempt {
  if (state.phase === 'finalComplete') return state;
  if (action.type === 'navigate') {
    const position = action.position;
    if (!Number.isInteger(position) || position < 0 || position >= state.ids.length || position === state.position) return state;
    if (state.phase === 'correctionInProgress' && !eligibleIds(state).includes(state.ids[position]!)) return state;
    return { ...state, position };
  }
  if (action.type === 'finish') return state.phase === 'correctionInProgress' ? { ...state, phase: 'finalComplete' } : state;
  const def = definitions.find(item => item.id === action.id);
  if (!def || !state.ids.includes(action.id)) return state;
  const correcting = state.phase === 'correctionInProgress';
  if (correcting ? !eligibleIds(state).includes(action.id) || state.corrections[action.id] : state.primary[action.id]) return state;
  if (action.type === 'draft') return { ...state, drafts: { ...state.drafts, [action.id]: action.answer } };
  if (action.type === 'skip' && correcting) return state;
  if (action.type === 'submit' && isEmpty(action.answer)) return state;
  const skipped = action.type === 'skip';
  const answer = skipped ? state.drafts[action.id] ?? null : action.answer;
  const result: ExerciseResult = skipped ? { exerciseId: def.id, topicId: def.topicId, score: 0, status: 'incorrect', breakdown: [] } : evaluate(def, answer);
  const submission = { answer, result, skipped };
  const next = { ...state, drafts: { ...state.drafts, [action.id]: answer }, primary: correcting ? state.primary : { ...state.primary, [action.id]: submission }, corrections: correcting ? { ...state.corrections, [action.id]: submission } : state.corrections };
  if (!correcting && Object.keys(next.primary).length === 12) next.phase = eligibleIds(next).length ? 'correctionInProgress' : 'finalComplete';
  if (correcting && eligibleIds(next).every(id => next.corrections[id])) next.phase = 'finalComplete';
  if (next.phase !== 'finalComplete') {
    const pending = next.ids.findIndex(id => next.phase === 'primaryInProgress' ? !next.primary[id] : eligibleIds(next).includes(id) && !next.corrections[id]);
    if (pending >= 0) next.position = pending;
  }
  return next;
}
export function percent(scores: number[]): number { return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length * 100 + Number.EPSILON) * 100) / 100; }
export function percentages(state: QuizAttempt): { first: number; final: number } | null {
  if (state.phase !== 'finalComplete') return null;
  return { first: percent(state.ids.map(id => state.primary[id]!.result.score)), final: percent(state.ids.map(id => (state.corrections[id] ?? state.primary[id])!.result.score)) };
}
