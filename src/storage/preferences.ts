import { browserStore, createProgressStore, PROGRESS_KEY, type Theme } from './progress';
export type { Theme } from './progress';
export const THEME_KEY = PROGRESS_KEY;
export function createPreferences(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  const store = createProgressStore(storage);
  return { load: (): Theme => store.getSnapshot().theme, save: (theme: Theme) => store.setTheme(theme) };
}
export function browserPreferences() {
  const store = browserStore();
  return { load: (): Theme => store.getSnapshot().theme, save: (theme: Theme) => store.setTheme(theme) };
}
