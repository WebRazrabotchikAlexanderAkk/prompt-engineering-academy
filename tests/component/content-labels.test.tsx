// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ExerciseShell } from '../../src/components/exercises/ExerciseShell';
import { getExercise } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';

afterEach(cleanup);

it('минимум слов показан один раз рядом с критерием, оценивание не меняется', () => {
  render(<ExerciseShell definition={getExercise('hall-3')} answer="" onChange={() => {}} mode="inline" disabled={false} />);
  const criterion = screen.getByText(/Исключите выдумывание красивых цифр/);
  expect(criterion.textContent?.match(/минимум 12 слов/g)).toHaveLength(1);
});

it('описание токена грамматически согласовано с единственным числом', () => {
  const definition = getExercise('tokens-2');
  if (definition.type !== 'MatchPairs') throw new Error('Ожидается соединение пар');
  expect(definition.right.find(option => option.id === 'r2')?.text)
    .toBe('Единица, получаемая при разбиении текста токенизатором');
});

it.each(['inline', 'quiz'] as const)('QA-TECH-01: цитата из ответа отображается как текст в режиме %s', mode => {
  const definition = getExercise('hall-3');
  const payload = '<img src="qa-unsafe-marker" onerror="alert(1)"> Раздели факты и предположения.';
  const result = evaluate(definition, payload);
  const { container } = render(<ExerciseShell definition={definition} answer={payload} result={result}
    onChange={() => {}} mode={mode} disabled final />);
  expect(container.querySelector('blockquote')?.textContent).toContain('<img');
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('[onerror]')).toBeNull();
});
