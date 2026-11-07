// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { InlineRecord } from '../../src/storage/progress';
import InlineExerciseIsland from '../../src/islands/InlineExerciseIsland';
import { rubricVersion } from '../../src/data/contentVersion';
import { fixtures } from '../fixtures/exercises';

const storage = vi.hoisted(() => ({ inline: {} as Record<string, InlineRecord> }));
vi.mock('../../src/storage/useProgress', () => ({
  useProgress: () => storage,
  useStorageWarning: () => '',
}));
vi.mock('../../src/storage/progress', () => ({
  browserStore: () => ({ saveInline: (id: string, record: InlineRecord) => {
    const definition = fixtures.find(item => item.definition.id === id)!.definition;
    storage.inline[id] = { ...record, rubricVersion: rubricVersion(definition) };
  } }),
}));
vi.mock('../../src/components/exercises/editors', async () => {
  const { fixtures, wrongAnswers } = await import('../fixtures/exercises');
  return { AnswerEditor: ({ definition, onChange, disabled }: {
    definition: (typeof fixtures)[number]['definition']; onChange: (answer: (typeof fixtures)[number]['answer']) => void; disabled: boolean;
  }) => {
    const correct = fixtures.find(item => item.definition.type === definition.type)!;
    return <div>
      <button disabled={disabled} onClick={() => onChange(wrongAnswers[definition.type])}>Ввести ошибочный ответ</button>
      <button disabled={disabled} onClick={() => onChange(correct.answer)}>Ввести правильный ответ</button>
    </div>;
  } };
});
afterEach(() => { cleanup(); storage.inline = {}; });

it.each(fixtures.filter(item => item.definition.type !== 'OrderSteps'))('$definition.type inline: пустая отправка не расходует попытку', ({ definition }) => {
  render(<InlineExerciseIsland definition={definition} />);
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  expect(storage.inline[definition.id]).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Проверить ответ' })).toBeTruthy();
  expect(screen.getByRole('status').textContent).toMatch(/Попытка не потрачена|Выберите хотя бы один фрагмент/);
});

it.each(fixtures)('$definition.type inline: первая ошибка, подсказка и одно исправление', ({ definition }) => {
  const { rerender } = render(<InlineExerciseIsland definition={definition} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ввести ошибочный ответ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  expect(storage.inline[definition.id]?.first.score).toBeLessThan(1);
  rerender(<InlineExerciseIsland definition={definition} />);
  expect(screen.getByText(definition.hint)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Отправить окончательный ответ' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Ввести правильный ответ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Отправить окончательный ответ' }));
  rerender(<InlineExerciseIsland definition={definition} />);
  expect(storage.inline[definition.id]?.first.score).toBeLessThan(1);
  expect(storage.inline[definition.id]?.final?.score).toBe(1);
  expect(storage.inline[definition.id]?.correctionUsed).toBe(true);
  expect(screen.getByText(definition.explanation)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Отправить окончательный ответ' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Ввести правильный ответ' }).hasAttribute('disabled')).toBe(true);
});

it.each(fixtures)('$definition.type inline: правильный первый ответ сразу завершает', ({ definition }) => {
  const { rerender } = render(<InlineExerciseIsland definition={definition} />);
  fireEvent.click(screen.getByRole('button', { name: 'Ввести правильный ответ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  rerender(<InlineExerciseIsland definition={definition} />);
  expect(storage.inline[definition.id]?.first.score).toBe(1);
  expect(storage.inline[definition.id]?.correctionUsed).toBe(false);
  expect(screen.getByText(definition.explanation)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Отправить окончательный ответ' })).toBeNull();
});
