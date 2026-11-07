import { describe, expect, it } from 'vitest';
import { createProgressStore, defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';
import { validStoredAnswer } from '../../src/storage/validation';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt, quizReducer, type QuizAttempt } from '../../src/domain/quiz/state';
import { fixtures } from '../fixtures/exercises';
import { evaluate, optimalBudget } from '../../src/domain/scoring/evaluate';
import type { ExerciseAnswer, ExerciseDefinition } from '../../src/domain/exercises/types';

const questions = selectQuiz(quizBank, 42);
const fresh = () => createAttempt(questions, 42, 'validation');
function correctAnswer(def: ExerciseDefinition): ExerciseAnswer {
  switch (def.type) {
    case 'MultipleChoice': return def.correct;
    case 'TrueFalse': return def.correct;
    case 'MatchPairs': return def.pairs;
    case 'FillTheBlank': return Object.fromEntries(def.blanks.map(blank => [blank.id, blank.accepted[0]!.text]));
    case 'OrderSteps': return def.correctOrder;
    case 'CaseStudy': case 'PromptSimulator': return def.example;
    case 'SpotTheHallucination': return def.claims.filter(item => item.falseClaim).map(item => item.id);
    case 'PromptBuilder': return Object.fromEntries(def.slots.map(slot => [slot.id, slot.correctBlock]));
    case 'ContextBudget': return optimalBudget(def).ids;
  }
}
function correction() {
  let state = fresh();
  for (const question of questions) state = quizReducer(state, { type: 'skip', id: question.id }, questions);
  return state;
}
function restore(attempt: QuizAttempt, latest = false) {
  const state = { ...defaultProgress(), [latest ? 'latest' : 'active']: attempt };
  return createProgressStore({ getItem: key => key === PROGRESS_KEY ? JSON.stringify(state) : null, setItem() {} });
}
describe('Строгое восстановление попыток', () => {
  it('старые причины конструктора восстанавливаются без изменения баллов', () => {
    const def = questions.find(item => item.type === 'PromptBuilder');
    if (!def || def.type !== 'PromptBuilder') throw new Error('Builder required');
    const answer = { [def.slots[0]!.id]: def.slots[0]!.correctBlock };
    const state = quizReducer(fresh(), { type: 'submit', id: def.id, answer }, questions);
    for (const row of state.primary[def.id]!.result.breakdown) if (!row.met) row.reason = 'wrong';
    const reader = restore(state);
    expect(reader.getWarning()).toBe('');
    expect(reader.getSnapshot().active?.primary[def.id]?.result).toEqual(state.primary[def.id]!.result);
    state.primary[def.id]!.result.score = 1;
    expect(restore(state).getWarning()).not.toBe('');
  });
  it('реальные правильные ответы всех типов восстанавливаются на каждом шаге и в очищенном финале', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const selected = selectQuiz(quizBank, seed);
      let state = createAttempt(selected, seed, `valid-${seed}`);
      let raw = '';
      const port = { getItem: () => raw || null, setItem: (_key: string, value: string) => { raw = value; } };
      const writer = createProgressStore(port);
      for (const def of selected) {
        seen.add(def.type);
        state = quizReducer(state, { type: 'submit', id: def.id, answer: correctAnswer(def) }, selected);
        writer.saveQuiz(state, selected);
        const reader = createProgressStore(port);
        expect(reader.getWarning(), `${seed}/${def.id}`).toBe('');
        expect((reader.getSnapshot().active ?? reader.getSnapshot().latest)?.id).toBe(state.id);
      }
    }
    expect(seen.size).toBe(10);
  });
  it('восстанавливает каждое исправление, в том числе последний переход в финал', () => {
    let state = correction(); let raw = '';
    const port = { getItem: () => raw || null, setItem: (_key: string, value: string) => { raw = value; } };
    const writer = createProgressStore(port);
    for (const def of questions) {
      state = quizReducer(state, { type: 'submit', id: def.id, answer: correctAnswer(def) }, questions);
      writer.saveQuiz(state, questions);
      const reader = createProgressStore(port);
      expect(reader.getWarning(), def.id).toBe('');
      expect((reader.getSnapshot().active ?? reader.getSnapshot().latest)?.phase).toBe(state.phase);
    }
  });
  it.each([
    ['исправление до первого прохода', (s: QuizAttempt) => { s.corrections[s.ids[0]!] = correction().primary[s.ids[0]!]!; }],
    ['первый проход уже закончен', (s: QuizAttempt) => { s.primary = correction().primary; }],
    ['преждевременная коррекция', (s: QuizAttempt) => { s.phase = 'correctionInProgress'; }],
    ['неизвестное задание текущей версии', (s: QuizAttempt) => { s.ids[0] = 'unknown'; }],
    ['пропавший черновик', (s: QuizAttempt) => { delete s.drafts[s.ids[0]!]; }],
    ['неподходящий тип ответа', (s: QuizAttempt) => { const id = questions.find(q => q.type === 'MultipleChoice')!.id; s.drafts[id] = true; }],
    ['несуществующий вариант', (s: QuizAttempt) => { const id = questions.find(q => q.type === 'MultipleChoice')!.id; s.drafts[id] = ['unknown']; }],
    ['дублированный вариант', (s: QuizAttempt) => { const q = questions.find(q => q.type === 'MultipleChoice')!; if (q.type === 'MultipleChoice') s.drafts[q.id] = [q.options[0]!.id, q.options[0]!.id]; }],
  ])('отклоняет: %s', (_, mutate) => {
    const state = fresh(); mutate(state);
    const store = restore(state);
    expect(store.getSnapshot().active).toBeNull();
    expect(store.getWarning()).not.toBe('');
  });
  it('пропуск не может иметь балл или содержать разбор', () => {
    const state = correction(); const first = state.primary[state.ids[0]!]!;
    first.result.score = 1; first.result.status = 'correct';
    expect(restore(state).getSnapshot().active).toBeNull();
  });
  it('исправление правильного ответа и пропуск в коррекции запрещены', () => {
    const state = correction(); const id = state.ids[0]!;
    state.corrections[id] = structuredClone(state.primary[id]!);
    expect(restore(state).getSnapshot().active).toBeNull();
    const def = questions[0]!;
    const answer = correctAnswer(def);
    state.primary[id] = { answer, result: evaluate(def, answer), skipped: false };
    state.corrections[id] = structuredClone(state.primary[id]!);
    state.drafts[id] = answer;
    expect(restore(state).getSnapshot().active).toBeNull();
  });
  it('порядок свойств карты ответа не меняет смысл отправки', () => {
    const selected = quizBank.slice(0, 12);
    const def = selected.find(q => q.type === 'MatchPairs')!;
    const answer = correctAnswer(def) as Record<string, string>;
    const state = quizReducer(createAttempt(selected, 1, 'map-order'), { type: 'submit', id: def.id, answer }, selected);
    state.drafts[def.id] = Object.fromEntries(Object.entries(answer).reverse());
    expect(restore(state).getWarning()).toBe('');
  });
  it('полностью использованные коррекции не могут оставаться активными', () => {
    let state = correction();
    for (const def of questions) state = quizReducer(state, { type: 'submit', id: def.id, answer: correctAnswer(def) }, questions);
    state.phase = 'correctionInProgress';
    expect(restore(state).getSnapshot().active).toBeNull();
  });
  it('не принимает отрицательные веса даже для другой версии контента', () => {
    const state = correction(); state.contentVersion = 1;
    const first = state.primary[state.ids[0]!]!;
    first.skipped = false;
    first.result.breakdown = [{ id: 'old', met: false, earned: -1, weight: -1, reason: 'wrong' }];
    expect(restore(state).getSnapshot().active).toBeNull();
  });
  it('подменённый балл распознаётся по сохранённому ответу', () => {
    const question = questions.find(q => q.type === 'MultipleChoice')!;
    if (question.type !== 'MultipleChoice') throw Error();
    const answer = [question.correct[0]!];
    const state = quizReducer(fresh(), { type: 'submit', id: question.id, answer }, questions);
    state.primary[question.id]!.result.score = .125; state.primary[question.id]!.result.status = 'partial';
    expect(restore(state).getSnapshot().active).toBeNull();
  });
  it('сохраняет допустимую коррекцию и досрочный финал', () => {
    const state = correction();
    expect(restore(state).getSnapshot().active).toEqual(state);
    const final = quizReducer(state, { type: 'finish' }, questions);
    expect(restore(final, true).getSnapshot().latest?.phase).toBe('finalComplete');
  });
  it('другая версия контента сохраняет исторические агрегаты без переоценки', () => {
    const state = quizReducer(correction(), { type: 'finish' }, questions);
    state.contentVersion = 1;
    const old = structuredClone(state.primary[state.ids[0]!]!);
    const oldId = state.ids[0]!; delete state.primary[oldId]; state.ids[0] = 'retired-question';
    state.primary['retired-question'] = { ...old, result: { ...old.result, exerciseId: 'retired-question' } };
    const restored = restore(state, true).getSnapshot().latest;
    expect(restored?.contentVersion).toBe(1);
    expect(restored?.primary['retired-question']?.result.score).toBe(0);
  });
});
describe('Типы и идентификаторы ответов', () => {
  it.each(fixtures)('принимает корректный ответ $definition.type', fixture => {
    expect(validStoredAnswer(fixture.definition, fixture.answer)).toBe(true);
  });
  it('запрещает неполную последовательность, повтор пары и неизвестный пропуск', () => {
    expect(validStoredAnswer(fixtures.find(f => f.definition.type === 'OrderSteps')!.definition, ['a'])).toBe(false);
    expect(validStoredAnswer(fixtures.find(f => f.definition.type === 'MatchPairs')!.definition, { a: 'x', b: 'x' })).toBe(false);
    expect(validStoredAnswer(fixtures.find(f => f.definition.type === 'FillTheBlank')!.definition, { unknown: 'текст' })).toBe(false);
  });
  it('не принимает противоречивую запись inline', () => {
    const def = quizBank.find(q => q.type === 'TrueFalse')!;
    const state = { ...defaultProgress(), inline: { 'llm-1': { first: evaluate(def, false), correctionUsed: true } } };
    const store = createProgressStore({ getItem: () => JSON.stringify(state), setItem() {} });
    expect(store.getSnapshot().inline).toEqual({});
    expect(store.getWarning()).not.toBe('');
  });
});
