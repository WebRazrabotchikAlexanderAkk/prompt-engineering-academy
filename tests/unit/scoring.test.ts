import { describe, expect, it } from 'vitest';
import { evaluate, isEmpty, simulatorTier } from '../../src/domain/scoring/evaluate';
import { normalizeBlank, acceptsBlank, wordCount, matchesConcept } from '../../src/domain/scoring/text';
import type { ExerciseDefinition } from '../../src/domain/exercises/types';

const base = { id: 'fixture', topicId: 'llm' as const, instruction: 'Проверьте ответ', hint: 'Вспомните принцип', explanation: 'Объяснение решения' };
describe('Формулы оценки', () => {
  it('SCR-001: лишний выбор обнуляет, неполный правильный даёт долю', () => {
    const def: ExerciseDefinition = { ...base, type: 'MultipleChoice', multiple: true, options: [{ id: 'a', text: 'А' }, { id: 'b', text: 'Б' }, { id: 'c', text: 'В' }], correct: ['a', 'b'] };
    expect(evaluate(def, ['a']).score).toBe(.5);
    expect(evaluate(def, ['a', 'c']).score).toBe(0);
    expect(evaluate(def, ['a', 'b']).score).toBe(1);
  });
  it('SCR-002: порядок оценивается по относительным парам', () => {
    const def: ExerciseDefinition = { ...base, type: 'OrderSteps', items: ['a', 'b', 'c'].map(id => ({ id, text: id })), correctOrder: ['a', 'b', 'c'] };
    expect(evaluate(def, ['a', 'c', 'b']).score).toBeCloseTo(2 / 3);
    expect(evaluate(def, ['c', 'b', 'a']).score).toBe(0);
  });
  it('IV-13: ошибочное выделение уменьшает результат, но не ниже нуля', () => {
    const def: ExerciseDefinition = { ...base, type: 'SpotTheHallucination', reference: 'Справка', source: 'https://example.org', claims: [{ id: 'a', text: 'A', falseClaim: true, reason: 'A' }, { id: 'b', text: 'B', falseClaim: true, reason: 'B' }, { id: 'c', text: 'C', falseClaim: false, reason: 'C' }] };
    expect(evaluate(def, ['a', 'c']).score).toBe(0);
    expect(evaluate(def, ['a']).score).toBe(.5);
  });
  it('IV-13: четыре неподтверждённых фрагмента, три верных и один лишний дают ровно половину', () => {
    const def: ExerciseDefinition = { ...base, type: 'SpotTheHallucination', reference: 'Справка для всех утверждений', source: 'https://example.org', claims: [
      ...['a', 'b', 'c', 'd'].map(id => ({ id, text: id, falseClaim: true, reason: 'Не подтверждено' })),
      { id: 'e', text: 'e', falseClaim: false, reason: 'Подтверждено' },
    ] };
    expect(evaluate(def, ['a', 'b', 'c', 'e']).score).toBe(.5);
    expect(evaluate(def, ['a', 'b', 'c', 'd']).score).toBe(1);
    expect(evaluate(def, ['e']).score).toBe(0);
  });
  it('IV-14: неверное место не считается лишним блоком второй раз', () => {
    const def: ExerciseDefinition = { ...base, type: 'PromptBuilder', blocks: ['a', 'b', 'c'].map(id => ({ id, text: id })), slots: [{ id: 's1', label: 'Задача', correctBlock: 'a' }, { id: 's2', label: 'Формат', correctBlock: 'b' }] };
    expect(evaluate(def, { s1: 'a' }).score).toBe(.5);
    expect(evaluate(def, { s1: 'b', s2: 'a' }).score).toBe(0);
    expect(evaluate(def, { s1: 'a', s2: 'c' }).score).toBe(0);
  });
  it('IV-14: четыре места, три верных блока и один лишний дают половину; пропуск не сдвигает места', () => {
    const def: ExerciseDefinition = { ...base, type: 'PromptBuilder', blocks: ['a', 'b', 'c', 'd', 'x'].map(id => ({ id, text: id })), slots: ['a', 'b', 'c', 'd'].map((id, index) => ({ id: `s${index + 1}`, label: id, correctBlock: id })) };
    const extra = evaluate(def, { s1: 'a', s2: 'b', s3: 'c', s4: 'x' });
    expect(extra.score).toBe(.5);
    expect(extra.breakdown.at(-1)?.reason).toBe('forbidden');
    expect(evaluate(def, { s2: 'b', s3: 'c', s4: 'd' }).score).toBe(.75);
    expect(evaluate(def, { s1: 'b', s2: 'a', s3: 'c', s4: 'd' }).score).toBe(.5);
  });
  it('IV-15: все оптимальные наборы принимаются, превышение равно нулю', () => {
    const def: ExerciseDefinition = { ...base, type: 'ContextBudget', budget: 5, fragments: [{ id: 'a', text: 'A', cost: 5, utility: 10 }, { id: 'b', text: 'B', cost: 5, utility: 10 }, { id: 'c', text: 'C', cost: 1, utility: 0, distractor: true, penalty: 3 }] };
    expect(evaluate(def, ['a']).score).toBe(1);
    expect(evaluate(def, ['b']).score).toBe(1);
    expect(evaluate(def, ['a', 'b']).score).toBe(0);
    expect(evaluate(def, ['c']).score).toBe(0);
  });
  it('IV-15: полезность восемь минус штраф два при оптимуме десять даёт 0.6', () => {
    const def: ExerciseDefinition = { ...base, type: 'ContextBudget', budget: 10, fragments: [
      { id: 'a', text: 'A', cost: 5, utility: 5 }, { id: 'b', text: 'B', cost: 5, utility: 5 },
      { id: 'c', text: 'C', cost: 10, utility: 10 }, { id: 'd', text: 'D', cost: 6, utility: 8 },
      { id: 'x', text: 'X', cost: 4, utility: 0, distractor: true, penalty: 2 },
    ] };
    expect(evaluate(def, ['d', 'x']).score).toBe(.6);
    expect(evaluate(def, ['a', 'b']).score).toBe(1);
    expect(evaluate(def, ['c']).score).toBe(1);
    expect(evaluate(def, ['c', 'a']).score).toBe(0);
    expect(isEmpty([])).toBe(true);
  });
  it('IV-06: почти полный балл остаётся частичным, несмотря на округление подписи', () => {
    const def: ExerciseDefinition = { ...base, type: 'CaseStudy', initialPrompt: 'Плохо', example: 'составь список', criteria: [
      { id: 'major', label: 'Действие', weight: .99999, checks: [{ kind: 'any', concepts: [{ text: 'составь' }] }] },
      { id: 'minor', label: 'Форма', weight: .00001, checks: [{ kind: 'any', concepts: [{ text: 'список' }] }] },
    ] };
    expect(evaluate(def, 'составь').score).toBe(.99999);
    expect(evaluate(def, 'составь').status).toBe('partial');
  });
  it('IV-09: рубрика принимает регистр, ё/е и основу, но не чужое слово или неразрешённую опечатку', () => {
    const def: ExerciseDefinition = { ...base, type: 'CaseStudy', initialPrompt: 'Напиши', example: 'РОЛЬ: редактор. Форматирование ёлки.', criteria: [
      { id: 'role', label: 'Роль', weight: .5, checks: [{ kind: 'any', concepts: [{ text: 'роль' }] }] },
      { id: 'format', label: 'Формат', weight: .5, checks: [{ kind: 'any', concepts: [{ text: 'формат', stem: true }] }] },
    ] };
    const full = evaluate(def, def.example);
    expect(full.score).toBe(1);
    expect(evaluate(def, 'роль редактора. Форматирование елки.').score).toBe(1);
    expect(evaluate(def, 'контроль. Форматирование елки.').breakdown.find(row => row.id === 'role')?.met).toBe(false);
    expect(evaluate(def, 'ролб. Форматирование елки.').score).toBe(.5);
    expect(evaluate(def, def.example).breakdown).toEqual(full.breakdown);
  });
  it('IV-10: запрет в том же предложении подавляет понятие, в другом нет; веса независимы', () => {
    const def: ExerciseDefinition = { ...base, type: 'CaseStudy', initialPrompt: 'Плохо', example: 'Нужен список. Без секретов.', criteria: [
      { id: 'list', label: 'Список', weight: .25, checks: [{ kind: 'any', concepts: [{ text: 'список', negative: ['не используй список'] }] }] },
      { id: 'safe', label: 'Безопасность', weight: .75, checks: [{ kind: 'absent', concepts: [{ text: 'секрет' }] }] },
    ] };
    expect(evaluate(def, 'Не используй список. Секрет.').score).toBe(0);
    expect(evaluate(def, 'Нужен список. Секрет.').score).toBe(.25);
    expect(evaluate(def, 'Не используй список. Без секретов.').score).toBe(.75);
    expect(evaluate(def, 'Не используй список. Нужен список.').score).toBe(1);
  });
  it('IV-11: подряд повторённое слово не увеличивает длину, короткий ввод не пуст', () => {
    const def: ExerciseDefinition = { ...base, type: 'CaseStudy', initialPrompt: 'Плохо', example: 'роль контекст задача', criteria: [
      { id: 'length', label: 'Длина', weight: .5, checks: [{ kind: 'minWords', count: 3 }] },
      { id: 'role', label: 'Роль', weight: .5, checks: [{ kind: 'any', concepts: [{ text: 'роль' }] }] },
    ] };
    expect(wordCount('роль роль контекст')).toBe(2);
    expect(wordCount('роль контекст задача')).toBe(3);
    expect(isEmpty('роль')).toBe(false);
    expect(evaluate(def, 'роль роль контекст').score).toBe(.5);
    expect(evaluate(def, def.example).score).toBe(1);
    expect(evaluate(def, 'роль').breakdown.find(row => row.id === 'length')?.reason).toBe('tooShort');
  });
  it('IV-12: границы уровней симулятора не совпадают со статусом полного ответа', () => {
    expect([0, .3999, .4, .7999, .8, 1].map(simulatorTier)).toEqual(['weak', 'weak', 'partial', 'partial', 'strong', 'strong']);
    const def: ExerciseDefinition = { ...base, type: 'PromptSimulator', scenario: 'Сценарий', example: 'роль контекст формат', responses: { weak: 'Слабый', partial: 'Частичный', strong: 'Сильный' }, consequences: [], criteria: [
      { id: 'role', label: 'Роль', weight: .8, checks: [{ kind: 'any', concepts: [{ text: 'роль' }] }] },
      { id: 'format', label: 'Формат', weight: .2, checks: [{ kind: 'any', concepts: [{ text: 'формат' }] }] },
    ] };
    expect(evaluate(def, 'роль').score).toBe(.8);
    expect(evaluate(def, 'роль').status).toBe('partial');
  });
  it('детерминирован и не меняет вход', () => {
    const def = Object.freeze({ ...base, type: 'TrueFalse' as const, correct: false });
    expect(evaluate(def, false)).toEqual(evaluate(def, false));
    expect(evaluate(def, false).status).toBe('correct');
  });
});
describe('Явная нормализация текста', () => {
  it('нормализует пробелы, ё и конечную пунктуацию', () => { expect(normalizeBlank('  Ёж   идёт! ')).toBe('еж идет'); });
  it('DEC-032: допускает одну замену буквы, но не вставку и не перестановку', () => {
    const accepted = { text: 'контекст', allowTypo: true };
    expect(acceptsBlank('кантекст', accepted)).toBe(true);
    expect(acceptsBlank('контексты', accepted)).toBe(false);
    expect(acceptsBlank('контескт', accepted)).toBe(false);
    expect(acceptsBlank('кантекрт', accepted)).toBe(false);
    expect(acceptsBlank('кантекст', { text: 'контекст' })).toBe(false);
  });
  it('не считает числа и последовательные повторы словами', () => { expect(wordCount('Текст текст 123 текст-набросок ! пример')).toBe(3); });
  it('не ищет подстроку в чужом слове, но принимает явную основу', () => {
    expect(matchesConcept('Неформатный текст', { text: 'формат' })).toBe(false);
    expect(matchesConcept('Форматирование результата', { text: 'формат', stem: true })).toBe(true);
  });
  it('отрицание действует в том же предложении; фраза не пересекает границу', () => {
    const concept = { text: 'список', negative: ['не используй список'] };
    expect(matchesConcept('Не используй список', concept)).toBe(false);
    expect(matchesConcept('Не используй список. Нужен список.', concept)).toBe(true);
    expect(matchesConcept('Верни краткий. Список готов.', { text: 'краткий список' })).toBe(false);
  });
});
