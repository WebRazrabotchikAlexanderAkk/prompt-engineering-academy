import { describe, expect, it } from 'vitest';
import { createProgressStore } from '../../src/storage/progress';
import { inlineExercises } from '../../src/data/exercises/inline';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { quizBank } from '../../src/data/quiz/bank';
import { createAttempt, quizReducer } from '../../src/domain/quiz/state';

describe('Уведомления новых наград', () => {
  const submit = (store: ReturnType<typeof createProgressStore>, index = 0) => {
    const def = inlineExercises[index]!;
    store.saveInline(def.id, { first: evaluate(def, null), correctionUsed: false });
  };
  it('объявляет только новый переход, закрытие не меняет прогресс, reload молчит', () => {
    let raw: string | null = null;
    const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } };
    const store = createProgressStore(storage);
    submit(store);
    expect(store.getNotifications().map(item => item.id)).toEqual(['ach-first-signal']);
    const state = store.getSnapshot();
    store.dismissNotification('ach-first-signal');
    expect(store.getSnapshot()).toBe(state);
    submit(store);
    store.setTheme('light');
    expect(store.getNotifications()).toEqual([]);
    expect(createProgressStore(storage).getNotifications()).toEqual([]);
    expect(raw).not.toContain('notifications');
  });
  it('работает в памяти; сброс очищает очередь и разрешает новое получение', () => {
    const store = createProgressStore();
    submit(store); store.setTheme('light'); store.reset();
    expect(store.getNotifications()).toEqual([]);
    expect(store.getSnapshot().theme).toBe('light');
    submit(store);
    expect(store.getNotifications()).toHaveLength(1);
  });
  it('сохраняет несколько новых наград и не дублирует пороговые эмблемы', () => {
    const store = createProgressStore();
    inlineExercises.forEach((_def, index) => submit(store, index));
    const ids = store.getNotifications().map(item => item.id);
    expect(ids).toContain('ach-route-complete');
    expect(ids).toContain('reward-sensor-module');
    expect(ids).toContain('reward-context-circuit');
    expect(new Set(ids).size).toBe(ids.length);
    submit(store);
    expect(store.getNotifications().map(item => item.id)).toEqual(ids);
  });
  it('итоговое начисление объявляется только после завершения теста', () => {
    const store = createProgressStore(); const questions = quizBank.slice(0, 12);
    let attempt = createAttempt(questions, 1, 'notice');
    for (const question of questions) attempt = quizReducer(attempt, { type: 'skip', id: question.id }, questions);
    store.saveQuiz(attempt, questions);
    expect(store.getNotifications()).toEqual([]);
    attempt = quizReducer(attempt, { type: 'finish' }, questions);
    store.saveQuiz(attempt, questions);
    expect(store.getNotifications().map(item => item.id)).toEqual(['reward-sensor-module']);
    store.dismissNotification('reward-sensor-module');
    store.saveQuiz(attempt, questions);
    expect(store.getNotifications()).toEqual([]);
  });
});
