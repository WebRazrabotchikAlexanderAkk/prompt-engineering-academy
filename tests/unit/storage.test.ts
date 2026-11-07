import { describe, expect, it } from 'vitest';
import { createProgressStore, defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';
import { quizBank } from '../../src/data/quiz/bank';
import { createAttempt, quizReducer } from '../../src/domain/quiz/state';
import { fixtures } from '../fixtures/exercises';
import { evaluate } from '../../src/domain/scoring/evaluate';

function memoryStorage() { const values = new Map<string, string>(); return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }
describe('Сохранение и приватность', () => {
  it('недоступное хранилище сразу предупреждает о работе только в памяти', () => {
    const store = createProgressStore();
    expect(store.getWarning()).toContain('Браузер не разрешает сохранение.');
    expect(store.getSnapshot()).toEqual(defaultProgress());
    store.setTheme('light');
    expect(store.getSnapshot().theme).toBe('light');
    expect(store.getWarning()).toContain('Прогресс доступен только пока открыта страница.');
  });
  it('последняя попытка и независимые максимумы обновляются по разным завершённым тестам', () => {
    const storage = memoryStorage(); const store = createProgressStore(storage);
    const basic = fixtures.find(item => item.definition.type === 'TrueFalse')!.definition;
    const definitions = Array.from({ length: 12 }, (_, index) => ({ ...basic, id: `score-${index}` }));
    let first = createAttempt(definitions, 1, 'score-first');
    for (const [index, definition] of definitions.entries()) first = quizReducer(first, { type: 'submit', id: definition.id, answer: index === 0 ? true : false }, definitions);
    first = quizReducer(first, { type: 'finish' }, definitions);
    store.saveQuiz(first, definitions);
    expect(store.getSnapshot().latest?.id).toBe('score-first');
    expect(store.getSnapshot().best).toEqual({ first: 91.67, final: 91.67 });

    let second = createAttempt(definitions, 2, 'score-second');
    for (const definition of definitions) second = quizReducer(second, { type: 'submit', id: definition.id, answer: true }, definitions);
    expect(store.getSnapshot().latest?.id).toBe('score-first');
    store.saveQuiz(second, definitions);
    expect(store.getSnapshot().latest?.id).toBe('score-first');
    expect(store.getSnapshot().best).toEqual({ first: 91.67, final: 91.67 });
    for (const definition of definitions) second = quizReducer(second, { type: 'submit', id: definition.id, answer: false }, definitions);
    store.saveQuiz(second, definitions);
    expect(store.getSnapshot().latest?.id).toBe('score-second');
    expect(store.getSnapshot().best).toEqual({ first: 91.67, final: 100 });
    expect(JSON.parse(storage.values.get(PROGRESS_KEY)!).best).toEqual({ first: 91.67, final: 100 });
  });
  it('восстановление отбрасывает неизвестные поля вложенной попытки', () => {
    const storage = memoryStorage(); const questions = quizBank.slice(0, 12);
    const question = questions[0]!;
    const attempt = createAttempt(questions, 1, 'nested');
    const submitted = quizReducer(attempt, { type: 'skip', id: question.id }, questions);
    const raw = { ...defaultProgress(), active: { ...submitted, extra: 'лишний секрет', primary: { ...submitted.primary, [question.id]: { ...submitted.primary[question.id], extra: 'лишний секрет', result: { ...submitted.primary[question.id]!.result, extra: 'лишний секрет' } } } } };
    storage.values.set(PROGRESS_KEY, JSON.stringify(raw));
    const store = createProgressStore(storage);
    expect(store.getSnapshot().active?.id).toBe('nested');
    expect(JSON.stringify(store.getSnapshot())).not.toContain('лишний секрет');
    store.setTheme('light');
    expect(storage.values.get(PROGRESS_KEY)).not.toContain('лишний секрет');
  });
  it('восстановление завершённой попытки повторно очищает текст и черновики', () => {
    const storage = memoryStorage(); const questions = quizBank.slice(0, 12);
    const textQuestion = questions.find(def => def.type === 'CaseStudy' || def.type === 'PromptSimulator')!;
    let attempt = createAttempt(questions, 1, 'final');
    attempt = quizReducer(attempt, { type: 'draft', id: textQuestion.id, answer: 'личный текст' }, questions);
    for (const question of questions) attempt = quizReducer(attempt, { type: 'skip', id: question.id }, questions);
    attempt = quizReducer(attempt, { type: 'finish' }, questions);
    storage.values.set(PROGRESS_KEY, JSON.stringify({ ...defaultProgress(), latest: attempt }));
    const store = createProgressStore(storage);
    expect(store.getSnapshot().latest?.id).toBe('final');
    expect(store.getSnapshot().latest?.drafts).toEqual({});
    expect(store.getSnapshot().latest?.primary[textQuestion.id]?.answer).toBeNull();
    expect(JSON.stringify(store.getSnapshot())).not.toContain('личный текст');
  });
  it('невалидный вложенный ответ безопасно отклоняется', () => {
    const storage = memoryStorage(); const attempt = createAttempt(quizBank.slice(0, 12), 1, 'bad-answer');
    storage.values.set(PROGRESS_KEY, JSON.stringify({ ...defaultProgress(), active: { ...attempt, drafts: { [attempt.ids[0]!]: { field: { nested: true } } } } }));
    const store = createProgressStore(storage);
    expect(store.getSnapshot().active).toBeNull();
    expect(store.getWarning()).not.toBe('');
  });
  it('inline никогда не сохраняет текст и цитаты', () => {
    const storage = memoryStorage(); const store = createProgressStore(storage);
    const def = fixtures.find(item => item.definition.type === 'CaseStudy')!.definition;
    store.saveInline('llm-1', { first: { ...evaluate(def, 'секрет'), breakdown: [{ id: 'task', met: true, earned: 1, weight: 1, reason: 'matched', quote: 'секрет' }] }, correctionUsed: false });
    expect(storage.values.get(PROGRESS_KEY)).not.toContain('секрет');
  });
  it('финал удаляет текст, поздняя запись не возвращает его, reset сохраняет тему', () => {
    const storage = memoryStorage(); const store = createProgressStore(storage);
    const def = fixtures.find(item => item.definition.type === 'CaseStudy')!.definition;
    const questions = Array.from({ length: 12 }, (_, index) => ({ ...def, id: `q${index}` }));
    let attempt = createAttempt(questions, 1, 'secret-attempt');
    attempt = quizReducer(attempt, { type: 'draft', id: 'q0', answer: 'секрет' }, questions);
    store.saveQuiz(attempt, questions);
    expect(storage.values.get(PROGRESS_KEY)).toContain('секрет');
    const stale = attempt;
    for (const question of questions) attempt = quizReducer(attempt, { type: 'skip', id: question.id }, questions);
    attempt = quizReducer(attempt, { type: 'finish' }, questions);
    store.saveQuiz(attempt, questions);
    store.saveQuiz(stale, questions);
    expect(storage.values.get(PROGRESS_KEY)).not.toContain('секрет');
    expect(store.getSnapshot().active).toBeNull();
    store.setTheme('light'); store.reset();
    expect(store.getSnapshot().theme).toBe('light');
    expect(store.getSnapshot().latest).toBeNull();
  });
  it('IV-19: общий сброс удаляет активный текст из памяти и хранилища, но сохраняет тему', () => {
    const storage = memoryStorage(); const store = createProgressStore(storage);
    const definition = fixtures.find(item => item.definition.type === 'CaseStudy')!.definition;
    const questions = Array.from({ length: 12 }, (_, index) => ({ ...definition, id: `reset-${index}` }));
    let attempt = createAttempt(questions, 18, 'active-with-text');
    attempt = quizReducer(attempt, { type: 'draft', id: questions[0]!.id, answer: 'уникальный текст 918273' }, questions);
    store.saveQuiz(attempt, questions);
    expect(JSON.stringify(store.getSnapshot())).toContain('уникальный текст 918273');
    expect(storage.values.get(PROGRESS_KEY)).toContain('уникальный текст 918273');
    store.setTheme('light');
    store.reset();
    expect(store.getSnapshot().active).toBeNull();
    expect(store.getSnapshot().theme).toBe('light');
    expect(JSON.stringify(store.getSnapshot())).not.toContain('уникальный текст 918273');
    expect(storage.values.get(PROGRESS_KEY)).not.toContain('уникальный текст 918273');
  });
  it('повреждённое и недоступное хранилище не ломает работу', () => {
    const storage = memoryStorage(); storage.values.set(PROGRESS_KEY, '{broken');
    const store = createProgressStore(storage); expect(store.getSnapshot().inline).toEqual({}); expect(store.getWarning()).toBeTruthy();
    const blocked = createProgressStore({ getItem() { throw Error(); }, setItem() { throw Error(); } });
    blocked.setTheme('light'); expect(blocked.getSnapshot().theme).toBe('light'); expect(blocked.getWarning()).toBeTruthy();
  });
});
