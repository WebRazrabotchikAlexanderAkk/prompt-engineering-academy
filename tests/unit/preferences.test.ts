import { describe, expect, it } from 'vitest';
import { createPreferences, THEME_KEY } from '../../src/storage/preferences';

describe('Тема хранится отдельно от учебного прогресса', () => {
  it('восстанавливает выбор и не ломается без хранилища', () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const preferences = createPreferences(storage);
    expect(preferences.load()).toBe('dark');
    expect(preferences.save('light')).toBe(true);
    expect(createPreferences(storage).load()).toBe('light');
    expect(JSON.parse(values.get(THEME_KEY)!).theme).toBe('light');
    expect(createPreferences({ getItem() { throw Error(); }, setItem() { throw Error(); } }).save('dark')).toBe(false);
  });
  it('отклоняет неизвестные значения', () => {
    expect(createPreferences({ getItem: () => 'unknown', setItem() {} }).load()).toBe('dark');
  });
});
