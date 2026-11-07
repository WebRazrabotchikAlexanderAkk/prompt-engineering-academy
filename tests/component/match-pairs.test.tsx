// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ExerciseShell } from '../../src/components/exercises/ExerciseShell';
import { fixtures } from '../fixtures/exercises';
import type { ExerciseAnswer } from '../../src/domain/exercises/types';

afterEach(cleanup);
const def = fixtures.find(item => item.definition.type === 'MatchPairs')!.definition;
function Example({ disabled = false }: { disabled?: boolean }) {
  const [answer, onChange] = useState<ExerciseAnswer>({});
  return <><ExerciseShell definition={def} answer={answer} onChange={onChange} mode="inline" disabled={disabled} /><output data-testid="answer">{JSON.stringify(answer)}</output></>;
}
describe('Одна пара за раз', () => {
  it('имеет один реальный заголовок текущего механизма и различимые рукоятки', () => {
    const { container } = render(<Example />);
    expect(container.querySelectorAll('h4[aria-hidden]')).toHaveLength(0);
    expect(screen.getByRole('heading', { name: /^A$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Перетащить описание: X$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Перетащить описание: Y$/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Механизм: B' }));
    expect(screen.queryByRole('heading', { name: /^A$/ })).toBeNull();
    expect(screen.getByRole('heading', { name: /^B$/ })).toBeTruthy();
  });
  it('переключение механизма не меняет ответ, назначение и очистка сохраняют однозначные пары', () => {
    render(<Example />);
    fireEvent.click(screen.getByRole('button', { name: 'Назначить описание: Y' }));
    expect(screen.getByTestId('answer').textContent).toBe('{"a":"y"}');
    fireEvent.click(screen.getByRole('button', { name: 'Механизм: B' }));
    expect(screen.getByTestId('answer').textContent).toBe('{"a":"y"}');
    fireEvent.click(screen.getByRole('button', { name: 'Назначить описание: Y' }));
    expect(screen.getByTestId('answer').textContent).toBe('{"b":"y"}');
    fireEvent.click(screen.getByRole('button', { name: 'Механизм: A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Назначить описание: X' }));
    expect(screen.getByTestId('answer').textContent).toBe('{"b":"y","a":"x"}');
    fireEvent.click(screen.getByRole('button', { name: 'Убрать пару: B' }));
    expect(screen.getByTestId('answer').textContent).toBe('{"a":"x"}');
    expect(screen.getByText('Место очищено.')).toBeTruthy();
  });
  it('отправленный ответ блокирует все действия, но показывает сводку всех механизмов', () => {
    const { container } = render(<Example disabled />);
    expect(container.querySelectorAll('button:not(:disabled)')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Ваши пары' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Механизм: A' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
