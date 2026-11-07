import { expect, it } from 'vitest';
import { missionStatus } from '../../src/domain/progress/route';

it('статус миссии учитывает только первые отправки её трёх заданий', () => {
  expect(missionStatus('llm', [])).toBe('Доступно');
  expect(missionStatus('llm', ['llm-1'])).toBe('В процессе · 1 из 3');
  expect(missionStatus('llm', ['llm-1', 'llm-1', 'tokens-1', 'unknown'])).toBe('В процессе · 1 из 3');
  expect(missionStatus('llm', ['llm-1', 'llm-2', 'llm-3'])).toBe('Пройдено · 3 из 3');
});
