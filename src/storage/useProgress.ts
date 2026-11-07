import { useSyncExternalStore } from 'react';
import { browserStore, defaultProgress } from './progress';
const serverSnapshot = defaultProgress();
const subscribe = (listener: () => void) => browserStore().subscribe(listener);
const snapshot = () => browserStore().getSnapshot();
export function useProgress() { return useSyncExternalStore(subscribe, snapshot, () => serverSnapshot); }
export function useStorageWarning() { return useSyncExternalStore(subscribe, () => browserStore().getWarning(), () => ''); }
