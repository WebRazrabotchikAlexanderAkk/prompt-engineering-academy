// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { ExerciseShell } from '../../src/components/exercises/ExerciseShell';
import { fixtures, wrongAnswers } from '../fixtures/exercises';
import { evaluate } from '../../src/domain/scoring/evaluate';
import type { ExerciseAnswer, ExerciseType } from '../../src/domain/exercises/types';
afterEach(cleanup);

function changeOneAnswer(type: ExerciseType) {
  switch (type) {
    case 'MultipleChoice': fireEvent.click(screen.getByLabelText('A')); break;
    case 'MatchPairs': fireEvent.click(screen.getByRole('button', { name: 'Назначить описание: Y' })); break;
    case 'FillTheBlank': fireEvent.change(screen.getByLabelText('Вставьте термин'), { target: { value: 'Контекст!' } }); break;
    case 'TrueFalse': fireEvent.click(screen.getByLabelText('Неверно')); break;
    case 'OrderSteps': fireEvent.click(screen.getByRole('button', { name: 'Опустить шаг 1' })); break;
    case 'CaseStudy': fireEvent.change(screen.getByLabelText('Улучшенная версия промпта'), { target: { value: 'Составь список' } }); break;
    case 'PromptSimulator': fireEvent.change(screen.getByLabelText('Ваш промпт для заданной ситуации'), { target: { value: 'Составь список' } }); break;
    case 'SpotTheHallucination': fireEvent.click(screen.getByLabelText('Встреча в среду')); break;
    case 'PromptBuilder': fireEvent.change(screen.getByLabelText('Задача'), { target: { value: 'a' } }); break;
    case 'ContextBudget': fireEvent.click(screen.getByLabelText(/Данные/)); break;
  }
}

describe('Общий интерфейс упражнений', () => {
  it.each(fixtures.flatMap(item => ['inline', 'quiz'].map(mode => ({ ...item, mode: mode as 'inline' | 'quiz' }))))('$definition.type в режиме $mode', ({ definition, answer, mode }) => {
    const change = vi.fn();
    const { rerender, container } = render(<ExerciseShell definition={definition} answer={wrongAnswers[definition.type]} onChange={change} mode={mode} disabled={false} />);
    expect(screen.getByText(definition.instruction)).toBeTruthy();
    expect(screen.queryByText(definition.explanation)).toBeNull();
    changeOneAnswer(definition.type);
    expect(change).toHaveBeenCalledTimes(1);

    const first = evaluate(definition, wrongAnswers[definition.type]);
    expect(first.score).toBeLessThan(1);
    rerender(<ExerciseShell definition={definition} answer={wrongAnswers[definition.type]} onChange={change} mode={mode} disabled={false} result={first} correction />);
    expect(screen.getByText(/Последняя попытка/)).toBeTruthy();
    expect(screen.queryByText(definition.explanation)).toBeNull();
    if (mode === 'inline') {
      expect(screen.getByText(definition.hint)).toBeTruthy();
      expect(screen.getByText(/Пока неверно|Частично верно/)).toBeTruthy();
    } else {
      expect(screen.queryByText(definition.hint)).toBeNull();
      expect(screen.queryByText(/Пока неверно|Частично верно/)).toBeNull();
    }

    rerender(<ExerciseShell definition={definition} answer={answer} onChange={change} mode={mode} disabled result={evaluate(definition, answer)} final />);
    expect(screen.getByText(definition.explanation)).toBeTruthy();
    expect(container.querySelectorAll('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)')).toHaveLength(0);
  });
  it('исходный промпт CaseStudy виден до ответа', () => {
    const definition = fixtures.find(item => item.definition.type === 'CaseStudy')!.definition;
    render(<ExerciseShell definition={definition} answer="" onChange={() => {}} mode="inline" disabled={false} />);
    expect(screen.getByText('Помоги мне')).toBeTruthy();
    expect(screen.getByLabelText('Улучшенная версия промпта')).toBeTruthy();
  });
  it('quiz не раскрывает результат даже при переданном результате без final', () => {
    const { definition, answer } = fixtures[0]!;
    render(<ExerciseShell definition={definition} answer={answer} onChange={() => {}} mode="quiz" disabled result={evaluate(definition, answer)} />);
    expect(screen.queryByText(definition.explanation)).toBeNull();
    expect(screen.queryByText(/Верно/)).toBeNull();
  });
  it('в финале показывает объяснение', () => {
    const { definition, answer } = fixtures[0]!;
    render(<ExerciseShell definition={definition} answer={answer} onChange={() => {}} mode="quiz" disabled result={evaluate(definition, answer)} final />);
    expect(screen.getByText(definition.explanation)).toBeTruthy();
  });
  it('выбор работает через обычную кнопку ввода', () => {
    const { definition } = fixtures[0]!; const change = vi.fn();
    render(<ExerciseShell definition={definition} answer={[]} onChange={change} mode="inline" disabled={false} />);
    fireEvent.click(screen.getByLabelText('A'));
    expect(change).toHaveBeenCalledWith(['a']);
  });
  it.each(['PromptBuilder'] as const)('%s: промежуточный вариант при выборе стрелками не очищает ранее занятое место', type => {
    const definition = fixtures.find(item => item.definition.type === type)!.definition;
    function Editor() {
      const [answer, setAnswer] = useState<ExerciseAnswer>({});
      return <ExerciseShell definition={definition} answer={answer} onChange={setAnswer} mode="inline" disabled={false} />;
    }
    render(<Editor />);
    const [first, second] = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const firstValue = 'a';
    const secondValue = 'b';
    fireEvent.change(first!, { target: { value: firstValue } }); fireEvent.blur(first!);
    fireEvent.change(second!, { target: { value: firstValue } });
    fireEvent.change(second!, { target: { value: secondValue } }); fireEvent.blur(second!);
    expect(first!.value).toBe(firstValue);
    expect(second!.value).toBe(secondValue);
  });
});
