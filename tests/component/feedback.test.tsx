// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Feedback } from '../../src/components/exercises/Feedback';
import { ExerciseShell } from '../../src/components/exercises/ExerciseShell';
import { fixtures } from '../fixtures/exercises';
import { evaluate } from '../../src/domain/scoring/evaluate';
import type { ExerciseDefinition } from '../../src/domain/exercises/types';
afterEach(cleanup);

it('конструктор различает пропуск, неверное место и лишний блок без сохранённого ответа', () => {
  const fixture = fixtures.find(f => f.definition.type === 'PromptBuilder')!.definition;
  if (fixture.type !== 'PromptBuilder') throw new Error('fixture');
  const def = { ...fixture, blocks: [...fixture.blocks, { id: 'extra', text: 'Лишний' }] };
  for (const [answer, text] of [
    [{ task: 'a' }, 'Формат: Место не заполнено.'],
    [{ task: 'b' }, 'Задача: Обязательный блок поставлен не на своё место.'],
    [{ task: 'extra' }, 'Задача: Выбран лишний блок: он не входит в обязательный набор.'],
  ] as const) {
    render(<Feedback definition={def} result={evaluate(def, answer)} answer={{}} final />);
    expect(screen.getByText(text)).toBeTruthy();
    cleanup();
  }
});

it('бюджет объясняет выбор, стоимость, штраф и ноль при превышении, включая восстановление', () => {
  const def = fixtures.find(f => f.definition.type === 'ContextBudget')!.definition;
  render(<Feedback definition={def} result={evaluate(def, ['a', 'b'])} answer={[]} final />);
  expect(screen.getByText('Выбрано: Данные; Шум.')).toBeTruthy();
  expect(screen.getByText('Стоимость: 6 из 5. Полезность: 10. Штрафы: 3.')).toBeTruthy();
  expect(screen.getByText('Лимит превышен: результат равен 0 независимо от полезности.')).toBeTruthy();
});
it('бюджет показывает вычисление в пределах лимита', () => {
  const def = fixtures.find(f => f.definition.type === 'ContextBudget')!.definition;
  render(<Feedback definition={def} result={evaluate(def, ['b'])} answer={['b']} final />);
  expect(screen.getByText('Расчёт: max(0, (0 − 3) / 10) = 0%.')).toBeTruthy();
});
it.each(['inline', 'quiz'] as const)('бюджет не раскрывает расчёт до полного разбора: %s', mode => {
  const def = fixtures.find(f => f.definition.type === 'ContextBudget')!.definition;
  render(<ExerciseShell definition={def} result={evaluate(def, ['b'])} answer={['b']} onChange={() => {}} disabled mode={mode} />);
  expect(screen.queryByText(/Полезность:/)).toBeNull();
  expect(screen.queryByText(/Оптимальная полезность/)).toBeNull();
});
it('разбор галлюцинаций восстанавливает выделения из критериев, а не из пустого редактора', () => {
  const def = fixtures.find(f => f.definition.type === 'SpotTheHallucination')!.definition;
  render(<Feedback definition={def} result={evaluate(def, ['a', 'b'])} answer={[]} final />);
  expect(screen.getByText(/Встреча в среду · Вы выделили/)).toBeTruthy();
  expect(screen.getByText(/Встреча во вторник · Вы выделили/)).toBeTruthy();
});
it('симулятор подписывает уровень только в полном разборе', () => {
  const fixture = fixtures.find(f => f.definition.type === 'PromptSimulator')!;
  render(<Feedback definition={fixture.definition} result={evaluate(fixture.definition, fixture.answer)} answer={fixture.answer} final />);
  expect(screen.getByText('Уровень примера: сильный.')).toBeTruthy();
});
it('IV-12: один уровень симулятора даёт разные пояснения по выполненным критериям', () => {
  const def: ExerciseDefinition = {
    id: 'simulator-breakdown', topicId: 'llm', type: 'PromptSimulator', instruction: 'Составьте запрос',
    hint: 'Проверьте условия', explanation: 'Разбор', scenario: 'Сценарий', example: 'роль формат',
    responses: { weak: 'Слабый пример', partial: 'Один подготовленный частичный ответ', strong: 'Сильный пример' },
    criteria: [
      { id: 'role', label: 'Роль', weight: .5, checks: [{ kind: 'any', concepts: [{ text: 'роль' }] }] },
      { id: 'format', label: 'Формат', weight: .5, checks: [{ kind: 'any', concepts: [{ text: 'формат' }] }] },
    ],
    consequences: [
      { criterionId: 'role', met: true, text: 'Роль задана' },
      { criterionId: 'role', met: false, text: 'Роли нет' },
      { criterionId: 'format', met: true, text: 'Формат задан' },
      { criterionId: 'format', met: false, text: 'Формата нет' },
    ],
  };
  const first = evaluate(def, 'роль');
  const second = evaluate(def, 'формат');
  expect(first.score).toBe(.5);
  expect(second.score).toBe(.5);
  render(<Feedback definition={def} result={first} answer="роль" final />);
  expect(screen.getByText('Уровень примера: частичный.')).toBeTruthy();
  expect(screen.getByText('Роль задана')).toBeTruthy();
  expect(screen.getByText('Формата нет')).toBeTruthy();
  expect(screen.queryByText('Роли нет')).toBeNull();
  cleanup();
  render(<Feedback definition={def} result={second} answer="формат" final />);
  expect(screen.getByText('Уровень примера: частичный.')).toBeTruthy();
  expect(screen.getByText('Роли нет')).toBeTruthy();
  expect(screen.getByText('Формат задан')).toBeTruthy();
  expect(screen.queryByText('Роль задана')).toBeNull();
});
