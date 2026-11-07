// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import MissionStatus from '../../src/islands/MissionStatus';
import { missions } from '../../src/data/missions';
import { articleExercises, inlineExercises } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { defaultProgress, type Progress } from '../../src/storage/progress';

const mocked = vi.hoisted(() => ({ progress: null as Progress | null }));
vi.mock('../../src/storage/useProgress', () => ({ useProgress: () => mocked.progress }));
beforeEach(() => { mocked.progress = defaultProgress(); });
afterEach(cleanup);

function submit(ids: readonly string[]) {
  for (const id of ids) {
    const definition = inlineExercises.find(item => item.id === id)!;
    mocked.progress!.inline[id] = { first: evaluate(definition, null), correctionUsed: false };
  }
}

it('первый незавершённый раздел текущий, остальные доступны', () => {
  const { container } = render(<>{missions.map(mission => <MissionStatus key={mission.id} id={mission.id} />)}</>);
  expect(Array.from(container.children).map(node => node.getAttribute('data-route-state'))).toEqual(['current', 'available', 'available', 'available', 'available', 'available']);
  expect(Array.from(container.children).map(node => node.textContent)).toEqual(['Доступно · Рекомендуется', ...Array(5).fill('Доступно')]);
});

it('завершение не требует верного ответа и продвигает текущий узел', () => {
  const { container, rerender } = render(<>{missions.map(mission => <MissionStatus key={mission.id} id={mission.id} />)}</>);
  submit(articleExercises[missions[0]!.id].slice(0, 1));
  rerender(<>{missions.map(mission => <MissionStatus key={mission.id} id={mission.id} />)}</>);
  expect(container.firstElementChild).toHaveAttribute('data-route-state', 'current');
  expect(container.firstElementChild).toHaveTextContent('В процессе · 1 из 3');
  submit(articleExercises[missions[0]!.id]);
  rerender(<>{missions.map(mission => <MissionStatus key={mission.id} id={mission.id} />)}</>);
  expect(Array.from(container.children).map(node => node.getAttribute('data-route-state'))).toEqual(['completed', 'current', 'available', 'available', 'available', 'available']);
  expect(container.firstElementChild).toHaveTextContent('Пройдено · 3 из 3');
});

it('свободный порядок сохраняет первый незавершённый узел, после всех отправок текущих нет', () => {
  submit(articleExercises[missions[2]!.id]);
  const { container, rerender } = render(<>{missions.map(mission => <MissionStatus key={mission.id} id={mission.id} />)}</>);
  expect(Array.from(container.children).map(node => node.getAttribute('data-route-state'))).toEqual(['current', 'available', 'completed', 'available', 'available', 'available']);
  submit(inlineExercises.map(item => item.id));
  rerender(<>{missions.map(mission => <MissionStatus key={mission.id} id={mission.id} />)}</>);
  expect(Array.from(container.children).map(node => node.getAttribute('data-route-state'))).toEqual(Array(6).fill('completed'));
  mocked.progress = defaultProgress();
  rerender(<>{missions.map(mission => <MissionStatus key={mission.id} id={mission.id} />)}</>);
  expect(Array.from(container.children).map(node => node.getAttribute('data-route-state'))).toEqual(['current', 'available', 'available', 'available', 'available', 'available']);
});

it('номер и текст имеют одно состояние и сохраняют scoped class Astro', () => {
  submit(articleExercises[missions[0]!.id]);
  const { container } = render(<><MissionStatus id={missions[0]!.id} number={1} class="number" data-astro-cid-example="" /><MissionStatus id={missions[0]!.id} class="status" /></>);
  expect(container.firstElementChild).toHaveAttribute('data-route-state', 'completed');
  expect(container.firstElementChild).toHaveAttribute('class', 'number');
  expect(container.firstElementChild).toHaveAttribute('data-astro-cid-example', '');
  expect(container.firstElementChild).toHaveTextContent('1');
  expect(container.lastElementChild).toHaveAttribute('data-route-state', 'completed');
  expect(container.lastElementChild).toHaveTextContent('Пройдено · 3 из 3');
});

it('сохраняет className после нормализации интеграцией React при гидратации', () => {
  const { container } = render(<MissionStatus id={missions[0]!.id} number={1} className="number" data-astro-cid-example="" />);
  expect(container.firstElementChild).toHaveAttribute('class', 'number');
  expect(container.firstElementChild).toHaveAttribute('data-astro-cid-example', '');
});
