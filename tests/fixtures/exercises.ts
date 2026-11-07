import type { ExerciseAnswer, ExerciseDefinition, ExerciseType } from '../../src/domain/exercises/types';
const common = { topicId: 'llm' as const, instruction: 'Проверьте принцип', hint: 'Сопоставьте условия задачи.', explanation: 'Важна проверяемая и конкретная формулировка.' };
const criteria = [
  { id: 'task', label: 'Указано действие', weight: .5, checks: [{ kind: 'any' as const, concepts: [{ text: 'составь' }] }] },
  { id: 'format', label: 'Указан формат', weight: .5, checks: [{ kind: 'all' as const, concepts: [{ text: 'список' }, { text: 'трёх пунктов' }] }] },
];
export const fixtures: { definition: ExerciseDefinition; answer: ExerciseAnswer }[] = [
  { definition: { ...common, id: 'mc', type: 'MultipleChoice', multiple: true, options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correct: ['a'] }, answer: ['a'] },
  { definition: { ...common, id: 'mp', type: 'MatchPairs', left: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], right: [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }], pairs: { a: 'y', b: 'x' } }, answer: { a: 'y', b: 'x' } },
  { definition: { ...common, id: 'fb', type: 'FillTheBlank', blanks: [{ id: 'a', label: 'Вставьте термин', accepted: [{ text: 'контекст' }] }] }, answer: { a: 'Контекст!' } },
  { definition: { ...common, id: 'tf', type: 'TrueFalse', correct: false }, answer: false },
  { definition: { ...common, id: 'os', type: 'OrderSteps', items: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], correctOrder: ['a', 'b'] }, answer: ['a', 'b'] },
  { definition: { ...common, id: 'cs', type: 'CaseStudy', instruction: 'Улучшите исходный промпт. Напишите полную версию.', initialPrompt: 'Помоги мне', criteria, example: 'Составь список из трёх пунктов' }, answer: 'Составь список из трёх пунктов' },
  { definition: { ...common, id: 'sim', type: 'PromptSimulator', scenario: 'Нужен краткий список действий', criteria, example: 'Составь список из трёх пунктов', responses: { weak: 'Нужны уточнения', partial: 'Пример списка', strong: '1. Цель. 2. Данные. 3. Проверка.' }, consequences: [
    { criterionId: 'task', met: true, text: 'Указано действие.' }, { criterionId: 'task', met: false, text: 'Действие не указано.' },
    { criterionId: 'format', met: true, text: 'Формат определён.' }, { criterionId: 'format', met: false, text: 'Формат не определён.' },
  ] }, answer: 'Составь список из трёх пунктов' },
  { definition: { ...common, id: 'hall', type: 'SpotTheHallucination', reference: 'Встреча во вторник', source: 'https://example.org', claims: [{ id: 'a', text: 'Встреча в среду', falseClaim: true, reason: 'Не совпадает со справкой' }, { id: 'b', text: 'Встреча во вторник', falseClaim: false, reason: 'Совпадает со справкой' }] }, answer: ['a'] },
  { definition: { ...common, id: 'builder', type: 'PromptBuilder', blocks: [{ id: 'a', text: 'Составь план' }, { id: 'b', text: 'Список' }], slots: [{ id: 'task', label: 'Задача', correctBlock: 'a' }, { id: 'format', label: 'Формат', correctBlock: 'b' }] }, answer: { task: 'a', format: 'b' } },
  { definition: { ...common, id: 'budget', type: 'ContextBudget', budget: 5, fragments: [{ id: 'a', text: 'Данные', cost: 5, utility: 10 }, { id: 'b', text: 'Шум', cost: 1, utility: 0, distractor: true, penalty: 3 }] }, answer: ['a'] },
];

export const wrongAnswers: Record<ExerciseType, ExerciseAnswer> = {
  MultipleChoice: ['b'], MatchPairs: { a: 'x' }, FillTheBlank: { a: 'ошибка' },
  TrueFalse: true, OrderSteps: ['b', 'a'], CaseStudy: 'Помоги',
  PromptSimulator: 'Помоги', SpotTheHallucination: ['b'],
  PromptBuilder: { task: 'b' }, ContextBudget: ['b'],
};
