import type { TopicId } from '../../data/missions';

export const exerciseTypes = ['MultipleChoice', 'MatchPairs', 'FillTheBlank', 'TrueFalse', 'OrderSteps', 'CaseStudy', 'PromptSimulator', 'SpotTheHallucination', 'PromptBuilder', 'ContextBudget'] as const;
export type ExerciseType = (typeof exerciseTypes)[number];
export interface Option { id: string; text: string }
export interface AcceptedAnswer { text: string; allowTypo?: boolean }
export interface Concept { text: string; stem?: boolean; negative?: string[] }
export type RubricCheck =
  | { kind: 'any' | 'all' | 'absent'; concepts: Concept[] }
  | { kind: 'minWords'; count: number };
export interface Criterion { id: string; label: string; weight: number; checks: RubricCheck[] }
interface Base { id: string; topicId: TopicId; instruction: string; hint: string; explanation: string }
interface Rubric { criteria: Criterion[]; example: string }
export type ExerciseDefinition = Base & (
  | { type: 'MultipleChoice'; multiple: boolean; options: Option[]; correct: string[] }
  | { type: 'MatchPairs'; left: Option[]; right: Option[]; pairs: Record<string, string> }
  | { type: 'FillTheBlank'; blanks: { id: string; label: string; accepted: AcceptedAnswer[] }[] }
  | { type: 'TrueFalse'; correct: boolean }
  | { type: 'OrderSteps'; items: Option[]; correctOrder: string[] }
  | ({ type: 'CaseStudy'; initialPrompt: string } & Rubric)
  | ({ type: 'PromptSimulator'; scenario: string; responses: { weak: string; partial: string; strong: string }; consequences: { criterionId: string; met: boolean; text: string }[] } & Rubric)
  | { type: 'SpotTheHallucination'; reference: string; source: string; claims: (Option & { falseClaim: boolean; reason: string })[] }
  | { type: 'PromptBuilder'; blocks: Option[]; slots: { id: string; label: string; correctBlock: string }[] }
  | { type: 'ContextBudget'; budget: number; fragments: (Option & { cost: number; utility: number; distractor?: boolean; penalty?: number })[] }
);
export type ExerciseAnswer = string | boolean | string[] | Record<string, string> | null;
export type ExerciseMode = 'inline' | 'quiz';
export type Reason = 'matched' | 'missing' | 'wrong' | 'forbidden' | 'tooShort' | 'overBudget';
export interface Breakdown { id: string; met: boolean; earned: number; weight: number; reason: Reason; quote?: string }
export interface ExerciseResult { exerciseId: string; topicId: TopicId; score: number; status: 'correct' | 'partial' | 'incorrect'; breakdown: Breakdown[] }
export type DefinitionOf<T extends ExerciseType> = Extract<ExerciseDefinition, { type: T }>;
