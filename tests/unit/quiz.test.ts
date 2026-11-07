import { describe, expect, it } from 'vitest';
import { createAttempt, percent, quizReducer, percentages } from '../../src/domain/quiz/state';
import { selectQuiz, shuffle } from '../../src/domain/quiz/selection';
import { fixtures, wrongAnswers } from '../fixtures/exercises';
import { missions } from '../../src/data/missions';
import type { ExerciseDefinition } from '../../src/domain/exercises/types';

const basic = fixtures.find(item => item.definition.type === 'TrueFalse')!;
const questions = Array.from({ length: 12 }, (_, index) => ({ ...basic.definition, id: `q${index}` }));
describe('Две фазы теста', () => {
  it('IV-05: досрочный финал оставляет пять неисправленных результатов, последняя коррекция завершает автоматически', () => {
    let state = createAttempt(questions, 29, 'early-finish');
    expect(quizReducer(state, { type: 'finish' }, questions)).toBe(state);
    for (const item of questions) state = quizReducer(state, { type: 'skip', id: item.id }, questions);
    expect(state.phase).toBe('correctionInProgress');
    for (const item of questions.slice(0, 7)) state = quizReducer(state, { type: 'submit', id: item.id, answer: false }, questions);
    expect(Object.keys(state.corrections)).toHaveLength(7);
    expect(percentages(state)).toBeNull();
    const early = quizReducer(state, { type: 'finish' }, questions);
    expect(early.phase).toBe('finalComplete');
    expect(Object.keys(early.corrections)).toHaveLength(7);
    expect(percentages(early)).toEqual({ first: 0, final: 58.33 });
    for (const item of questions.slice(7)) state = quizReducer(state, { type: 'submit', id: item.id, answer: false }, questions);
    expect(state.phase).toBe('finalComplete');
    expect(percentages(state)).toEqual({ first: 0, final: 100 });
  });
  it.each(fixtures)('$definition.type: неверная первая попытка и одно исправление', ({ definition, answer }) => {
    const definitions = Array.from({ length: 12 }, (_, index) => ({ ...definition, id: `${definition.id}-${index}` }));
    let state = createAttempt(definitions, 17, `matrix-${definition.id}`);
    state = quizReducer(state, { type: 'submit', id: definitions[0]!.id, answer: wrongAnswers[definition.type] }, definitions);
    const first = state.primary[definitions[0]!.id];
    expect(first?.result.score).toBeLessThan(1);
    expect(quizReducer(state, { type: 'submit', id: definitions[0]!.id, answer }, definitions)).toBe(state);
    for (const item of definitions.slice(1)) state = quizReducer(state, { type: 'submit', id: item.id, answer }, definitions);
    expect(state.phase).toBe('correctionInProgress');
    expect(percentages(state)).toBeNull();
    state = quizReducer(state, { type: 'submit', id: definitions[0]!.id, answer }, definitions);
    expect(state.primary[definitions[0]!.id]).toEqual(first);
    expect(state.corrections[definitions[0]!.id]?.result.score).toBe(1);
    expect(state.phase).toBe('finalComplete');
    expect(percentages(state)?.first).toBeLessThan(100);
    expect(percentages(state)?.final).toBe(100);
    expect(quizReducer(state, { type: 'submit', id: definitions[0]!.id, answer: wrongAnswers[definition.type] }, definitions)).toBe(state);
  });
  it.each(fixtures)('$definition.type: правильный первый ответ завершает без исправления', ({ definition, answer }) => {
    const definitions = Array.from({ length: 12 }, (_, index) => ({ ...definition, id: `${definition.id}-${index}` }));
    let state = createAttempt(definitions, 17, `direct-${definition.id}`);
    for (const item of definitions) state = quizReducer(state, { type: 'submit', id: item.id, answer }, definitions);
    expect(state.phase).toBe('finalComplete');
    expect(Object.keys(state.corrections)).toHaveLength(0);
    expect(percentages(state)).toEqual({ first: 100, final: 100 });
  });
  it('округляет сырую среднюю оценку один раз и принимает половину вверх', () => {
    expect(percent([...Array(11).fill(1), 0])).toBe(91.67);
    expect(percent(Array(12).fill(.69994))).toBe(69.99);
    expect(percent(Array(12).fill(.69995))).toBe(70);
    expect(percent(Array(12).fill(.7))).toBe(70);
  });
  it('исправление заменяет оценку даже при ухудшении; первый результат неизменен', () => {
    const definition: ExerciseDefinition = {
      id: 'pair', topicId: 'llm', type: 'MatchPairs', instruction: 'Соедините пары', hint: 'Проверьте связи', explanation: 'Сравните все пары',
      left: ['a', 'b', 'c', 'd'].map(id => ({ id, text: id })),
      right: ['w', 'x', 'y', 'z'].map(id => ({ id, text: id })),
      pairs: { a: 'w', b: 'x', c: 'y', d: 'z' },
    };
    const definitions = Array.from({ length: 12 }, (_, index) => ({ ...definition, id: `pair-${index}` }));
    let state = createAttempt(definitions, 1, 'downward-correction');
    for (const [index, item] of definitions.entries()) state = quizReducer(state, {
      type: 'submit', id: item.id, answer: index === 0 ? { a: 'w', b: 'x', c: 'y' } : definition.pairs,
    }, definitions);
    expect(state.phase).toBe('correctionInProgress');
    expect(percentages(state)).toBeNull();
    const firstSubmission = state.primary['pair-0'];
    expect(firstSubmission?.result.score).toBe(.75);
    state = quizReducer(state, { type: 'submit', id: 'pair-0', answer: { a: 'w' } }, definitions);
    expect(state.phase).toBe('finalComplete');
    expect(state.primary['pair-0']).toEqual(firstSubmission);
    expect(state.corrections['pair-0']?.result.score).toBe(.25);
    expect(percentages(state)).toEqual({ first: 97.92, final: 93.75 });
    expect(quizReducer(state, { type: 'submit', id: 'pair-0', answer: definition.pairs }, definitions)).toBe(state);
  });
  it('пропуск равен нулю; оба результата только после финала', () => {
    let state = createAttempt(questions, 42, 'test');
    state = quizReducer(state, { type: 'submit', id: 'q0', answer: null }, questions);
    expect(Object.keys(state.primary)).toHaveLength(0);
    for (const question of questions) state = quizReducer(state, { type: 'skip', id: question.id }, questions);
    expect(state.phase).toBe('correctionInProgress');
    expect(percentages(state)).toBeNull();
    const first = state.primary;
    state = quizReducer(state, { type: 'submit', id: 'q0', answer: false }, questions);
    expect(state.primary).toEqual(first);
    const once = state;
    state = quizReducer(state, { type: 'submit', id: 'q0', answer: true }, questions);
    expect(state).toBe(once);
    state = quizReducer(state, { type: 'finish' }, questions);
    expect(percentages(state)).toEqual({ first: 0, final: 8.33 });
  });
  it('все правильные сразу завершают тест, отправки неизменяемы', () => {
    let state = createAttempt(questions, 1, 'full');
    state = quizReducer(state, { type: 'submit', id: 'q0', answer: false }, questions);
    expect(quizReducer(state, { type: 'skip', id: 'q0' }, questions)).toBe(state);
    for (const question of questions.slice(1)) state = quizReducer(state, { type: 'submit', id: question.id, answer: false }, questions);
    expect(state.phase).toBe('finalComplete');
    expect(percentages(state)).toEqual({ first: 100, final: 100 });
  });
  it('IV-07: завершённая попытка отвергает все события, включая позднюю навигацию', () => {
    let state = createAttempt(questions, 3, 'immutable-final');
    for (const question of questions) state = quizReducer(state, { type: 'submit', id: question.id, answer: false }, questions);
    expect(state.phase).toBe('finalComplete');
    const id = questions[0]!.id;
    for (const action of [
      { type: 'navigate', position: 1 },
      { type: 'draft', id, answer: true },
      { type: 'submit', id, answer: true },
      { type: 'skip', id },
      { type: 'finish' },
    ] as const) expect(quizReducer(state, action, questions)).toBe(state);
  });
  it('IV-02: в фазе исправления навигация не открывает уже правильный вопрос', () => {
    let state = createAttempt(questions, 3, 'eligible-navigation');
    state = quizReducer(state, { type: 'submit', id: 'q0', answer: true }, questions);
    for (const question of questions.slice(1)) state = quizReducer(state, { type: 'submit', id: question.id, answer: false }, questions);
    expect(state.phase).toBe('correctionInProgress');
    expect(state.position).toBe(0);
    expect(quizReducer(state, { type: 'navigate', position: 1 }, questions)).toBe(state);
    expect(quizReducer(state, { type: 'navigate', position: 0 }, questions)).toBe(state);
  });
  it('IV-02: уже исправленный вопрос остаётся доступен для просмотра, но не для новой отправки', () => {
    let state = createAttempt(questions, 3, 'corrected-review');
    for (const [index, question] of questions.entries()) state = quizReducer(state, {
      type: 'submit', id: question.id, answer: index < 2 ? true : false,
    }, questions);
    expect(state.phase).toBe('correctionInProgress');
    state = quizReducer(state, { type: 'submit', id: 'q0', answer: false }, questions);
    expect(state.position).toBe(1);
    const review = quizReducer(state, { type: 'navigate', position: 0 }, questions);
    expect(review.position).toBe(0);
    expect(quizReducer(review, { type: 'submit', id: 'q0', answer: true }, questions)).toBe(review);
  });
});
describe('Детерминированная выборка', () => {
  const bank: ExerciseDefinition[] = missions.flatMap((mission, topic) => Array.from({ length: 4 }, (_, offset) => ({ ...fixtures[(topic * 4 + offset) % 10]!.definition, id: `${mission.id}-${offset}`, topicId: mission.id })));
  it('сохраняет все инварианты на разных seed', () => {
    for (let seed = 0; seed < 100; seed++) {
      const selected = selectQuiz(bank, seed);
      expect(selected).toHaveLength(12);
      expect(new Set(selected.map(item => item.type)).size).toBeGreaterThanOrEqual(7);
      expect(selected.some(item => item.type === 'ContextBudget')).toBe(true);
      for (const mission of missions) expect(selected.filter(item => item.topicId === mission.id)).toHaveLength(2);
      expect(selectQuiz(bank, seed)).toEqual(selected);
    }
  });
  it('не меняет банк и явно отклоняет невозможный набор', () => {
    const copy = JSON.stringify(bank); selectQuiz(bank, 42); expect(JSON.stringify(bank)).toBe(copy);
    expect(() => selectQuiz(questions, 1)).toThrow();
    expect(shuffle(['a', 'b', 'c'], 1)).toEqual(shuffle(['a', 'b', 'c'], 1));
  });
});
