// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import AwardNotifications from '../../src/islands/AwardNotifications';
import { createProgressStore } from '../../src/storage/progress';
import { articleExercises, inlineExercises } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';

const mocked = vi.hoisted(() => ({ store: null as ReturnType<typeof createProgressStore> | null }));
vi.mock('../../src/storage/progress', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/storage/progress')>(),
  browserStore: () => mocked.store!,
}));
beforeEach(() => { mocked.store = createProgressStore(); });
afterEach(() => { cleanup(); document.body.replaceChildren(); });

function pageStructure() {
  const main = document.createElement('main');
  const exerciseIsland = document.createElement('astro-island');
  const source = document.createElement('button'); source.textContent = 'Проверить ответ';
  exerciseIsland.append(source); main.append(exerciseIsland); document.body.append(main);
  const notificationIsland = document.createElement('astro-island');
  const container = document.createElement('div'); notificationIsland.append(container); document.body.append(notificationIsland);
  return { main, exerciseIsland, source, container };
}
function notifyFirst() {
  const definition = inlineExercises[0]!;
  act(() => mocked.store!.saveInline(definition.id, { first: evaluate(definition, null), correctionUsed: false }));
}

it('создаёт уведомление после вызвавшего упражнения вне управляемой React-ветки и убирает контейнер после закрытия', () => {
  const { exerciseIsland, source, container } = pageStructure();
  source.focus(); render(<AwardNotifications />, { container });
  const announcement = screen.getByRole('status');
  notifyFirst();
  expect(screen.getByRole('status')).toBe(announcement);
  expect(announcement.textContent).toContain('Первый сигнал');
  const host = screen.getByRole('complementary', { name: 'Уведомления о наградах' });
  const portal = host.parentElement!;
  expect(portal.previousElementSibling).toBe(exerciseIsland);
  expect(container.contains(host)).toBe(false);
  expect(document.activeElement).toBe(source);
  const close = screen.getByRole('button', { name: 'Закрыть уведомление' }); close.focus(); fireEvent.click(close);
  expect(portal.isConnected).toBe(false);
  expect(document.activeElement).toBe(source);
  expect(screen.getByRole('status')).toBe(announcement);
  expect(announcement.textContent).toBe('');
});

it('сохраняет место для очереди, не переносит фокус и очищает портал при размонтировании', () => {
  const { source, container } = pageStructure();
  source.focus(); const view = render(<AwardNotifications />, { container });
  act(() => {
    for (const id of Object.values(articleExercises)[0]!) {
      const definition = inlineExercises.find(item => item.id === id)!;
      mocked.store!.saveInline(id, { first: evaluate(definition, null), correctionUsed: false });
    }
  });
  expect(mocked.store!.getNotifications().length).toBeGreaterThan(1);
  const portal = screen.getByRole('complementary', { name: 'Уведомления о наградах' }).parentElement!;
  const next = screen.getByRole('button', { name: 'Следующее уведомление' }); next.focus(); fireEvent.click(next);
  expect(screen.getByRole('complementary', { name: 'Уведомления о наградах' }).parentElement).toBe(portal);
  expect(document.activeElement).toBe(next);
  view.unmount(); expect(portal.isConnected).toBe(false);
});

it('при отсутствии контекста размещает уведомление внутри main', () => {
  const { main, container } = pageStructure();
  render(<AwardNotifications />, { container });
  document.body.focus(); notifyFirst();
  const host = screen.getByRole('complementary', { name: 'Уведомления о наградах' });
  expect(host.parentElement?.parentElement).toBe(main);
});
