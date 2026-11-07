// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import InlineExerciseIsland from '../../src/islands/InlineExerciseIsland';
import { inlineExercises } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { rubricVersion } from '../../src/data/contentVersion';

const state = vi.hoisted(() => ({ inline: {} as Record<string, unknown> }));
vi.mock('../../src/storage/useProgress', () => ({ useProgress: () => state, useStorageWarning: () => '' }));
afterEach(() => { cleanup(); state.inline = {}; });
const definition = inlineExercises.find(item => item.id === 'llm-1')!;

it('explains empty editors for restored completed inline results', () => {
  state.inline[definition.id] = { first: evaluate(definition, false), correctionUsed: false, rubricVersion: rubricVersion(definition) };
  render(<InlineExerciseIsland definition={definition} />);
  expect(screen.getByText(/Сохранён только результат проверки/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Проверить ответ' })).toBeNull();
});
it('does not show restored-result notice for a new exercise', () => {
  render(<InlineExerciseIsland definition={definition} />);
  expect(screen.queryByText(/Сохранён только результат проверки/)).toBeNull();
});
