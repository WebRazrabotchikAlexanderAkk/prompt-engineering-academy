import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { browserStore, type AwardNotification } from '../storage/progress';
import styles from './AwardNotifications.module.css';

const empty: readonly AwardNotification[] = [];
const subscribe = (listener: () => void) => browserStore().subscribe(listener);
const snapshot = () => browserStore().getNotifications();

export default function AwardNotifications() {
  const notifications = useSyncExternalStore(subscribe, snapshot, () => empty);
  const current = notifications[0];
  const queued = !!current;
  const [destination, setDestination] = useState<HTMLElement | null>(null);
  const host = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const sourceIsland = useRef<Element | null>(null);
  useEffect(() => {
    const remember = () => {
      const element = document.activeElement;
      if (element instanceof HTMLElement && element !== document.body && !host.current?.contains(element)) {
        previousFocus.current = element;
        sourceIsland.current = element.closest('main astro-island');
      }
    };
    remember(); document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, []);
  useLayoutEffect(() => {
    if (!queued) { setDestination(null); return; }
    const main = document.querySelector('main');
    if (!main) return;
    const container = document.createElement('div');
    container.className = styles.slot!;
    const activeIsland = document.activeElement?.closest('main astro-island');
    const source = activeIsland ?? (sourceIsland.current?.isConnected ? sourceIsland.current : null);
    // The boundary is Astro's static markup, outside the other React root.
    if (source) source.after(container); else main.append(container);
    setDestination(container);
    return () => container.remove();
  }, [queued]);
  return <>
    <div className={styles.announcement} role="status" aria-live="polite" aria-atomic="true">
      {current ? `${current.kind === 'achievement' ? 'Достижение получено' : 'Эмблема открыта'}: ${current.title}. Доступно в вашем прогрессе${notifications.length > 1 ? ` · Ещё: ${notifications.length - 1}` : ''}` : ''}
    </div>
    {current && destination ? createPortal(<aside ref={host} className={styles.host} aria-label="Уведомления о наградах">
      <div key={current.id} className={styles.notice} data-award={current.id}>
        <span className={styles.label}>{current.kind === 'achievement' ? 'Достижение получено' : 'Эмблема открыта'}</span>
        <strong>{current.title}</strong>
        <span className={styles.hint}>Доступно в вашем прогрессе{notifications.length > 1 ? ` · Ещё: ${notifications.length - 1}` : ''}</span>
      </div>
      <button className={styles.close} type="button" onClick={() => {
      browserStore().dismissNotification(current.id);
      if (notifications.length === 1 && previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true });
    }}>
      {notifications.length > 1 ? 'Следующее уведомление' : 'Закрыть уведомление'}
      </button>
    </aside>, destination) : null}
  </>;
}
