// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ExerciseShell } from '../../src/components/exercises/ExerciseShell';
import { evaluate } from '../../src/domain/scoring/evaluate';
import type { ExerciseAnswer, ExerciseDefinition, ExerciseType } from '../../src/domain/exercises/types';
import { fixtures } from '../fixtures/exercises';

afterEach(cleanup);

const partialTypes: Exclude<ExerciseType, 'TrueFalse'>[] = [
  'MultipleChoice', 'MatchPairs', 'FillTheBlank', 'OrderSteps', 'CaseStudy',
  'PromptSimulator', 'SpotTheHallucination', 'PromptBuilder', 'ContextBudget',
];

function partialCase(type: Exclude<ExerciseType, 'TrueFalse'>): { definition: ExerciseDefinition; answer: ExerciseAnswer } {
  const source = fixtures.find(item => item.definition.type === type)!.definition;
  switch (source.type) {
    case 'MultipleChoice': return { definition: { ...source, correct: ['a', 'b'], options: [...source.options, { id: 'c', text: 'C' }] }, answer: ['a'] };
    case 'MatchPairs': return { definition: source, answer: { a: 'y' } };
    case 'FillTheBlank': return { definition: { ...source, blanks: [...source.blanks, { id: 'b', label: 'Второй термин', accepted: [{ text: 'роль' }] }] }, answer: { a: 'Контекст!' } };
    case 'OrderSteps': return { definition: { ...source, items: [...source.items, { id: 'c', text: 'C' }], correctOrder: ['a', 'b', 'c'] }, answer: ['a', 'c', 'b'] };
    case 'CaseStudy': case 'PromptSimulator': return { definition: source, answer: 'составь' };
    case 'SpotTheHallucination': return { definition: { ...source, claims: [...source.claims, { id: 'c', text: 'Ещё одна ошибка', falseClaim: true, reason: 'Не совпадает со справкой' }] }, answer: ['a'] };
    case 'PromptBuilder': return { definition: source, answer: { task: 'a' } };
    case 'ContextBudget': return { definition: { ...source, fragments: [...source.fragments, { id: 'c', text: 'Неполные данные', cost: 3, utility: 5 }] }, answer: ['c'] };
  }
  throw new Error(`Неподдерживаемый тип: ${type}`);
}

it.each(partialTypes)('%s: частичная оценка видна в статье и скрыта до финала теста', type => {
  const { definition, answer } = partialCase(type);
  const result = evaluate(definition, answer);
  expect(result.status).toBe('partial');
  expect(result.score).toBeGreaterThan(0);
  expect(result.score).toBeLessThan(1);
  render(<ExerciseShell definition={definition} answer={answer} onChange={() => {}} mode="inline" disabled={false} result={result} correction />);
  expect(screen.getByText(/Частично верно/)).toBeTruthy();
  expect(screen.getByText(definition.hint)).toBeTruthy();
  expect(screen.queryByText(definition.explanation)).toBeNull();
  cleanup();
  render(<ExerciseShell definition={definition} answer={answer} onChange={() => {}} mode="quiz" disabled result={result} correction />);
  expect(screen.queryByText(/Частично верно/)).toBeNull();
  expect(screen.queryByText(definition.explanation)).toBeNull();
  cleanup();
  render(<ExerciseShell definition={definition} answer={answer} onChange={() => {}} mode="quiz" disabled result={result} final />);
  expect(screen.getByText(/Частично верно/)).toBeTruthy();
  expect(screen.getByText(definition.explanation)).toBeTruthy();
});
