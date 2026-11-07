import { useEffect, useRef, type ReactNode, type Ref } from 'react';
import { DragDropProvider, DragOverlay, useDraggable, useDroppable } from '@dnd-kit/react';
import { AutoScroller, defaultPreset, Feedback, PointerSensor } from '@dnd-kit/dom';
import styles from './DragAdapter.module.css';

// Keep the stock plugins, reducing only edge-scroll speed. Do not add CSS
// smooth scrolling: successive library scroll steps would restart it each frame.
const dragPlugins = defaultPreset.plugins.map(plugin => plugin === AutoScroller
  ? AutoScroller.configure({ acceleration: 6 })
  : plugin === Feedback ? Feedback.configure({ feedback: 'clone' })
  : plugin);
const stationaryDragPlugins = dragPlugins.filter(plugin => plugin !== dragPlugins[defaultPreset.plugins.indexOf(AutoScroller)]);

/** Gesture adapter only; editors own canonical answers and semantic commands. */
export function DragAdapter({ children, disabled, onMove, autoScroll = true, renderPreview, exactPreview = false }: { children: ReactNode; disabled: boolean; onMove: (source: string, target: string) => void; autoScroll?: boolean; renderPreview?: (id: string) => ReactNode; exactPreview?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<() => void>(() => {});
  useEffect(() => () => pendingFocus.current(), []);
  return <div ref={root}><DragDropProvider plugins={autoScroll ? dragPlugins : stationaryDragPlugins} sensors={[PointerSensor]} onDragStart={() => pendingFocus.current()} onDragEnd={event => {
    if (disabled) return;
    const { source, target } = event.operation;
    if (!source) return;
    if (!event.canceled && target) onMove(String(source.id), String(target.id));
    pendingFocus.current();
    const container = root.current;
    if (!container) return;
    const sourceId = String(source.id);
    let frame = 0;
    // Dropping moves the live DOM node again. Focusing before cleanup loses focus.
    // Observe completion rather than guessing the library's animation duration.
    const restore = () => {
      if (container.querySelector('[data-dnd-placeholder], [data-dnd-dragging], [data-dnd-dropping]')) return;
      observer.disconnect();
      frame = requestAnimationFrame(() => {
        const handles = container.querySelectorAll<HTMLButtonElement>(`[data-drag-id="${CSS.escape(sourceId)}"]`);
        Array.from(handles).find(handle => !handle.disabled && !handle.closest('[inert], [aria-hidden="true"]'))?.focus({ preventScroll: true });
      });
    };
    const observer = new MutationObserver(restore);
    observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-dnd-dragging', 'data-dnd-dropping', 'data-dnd-placeholder'] });
    pendingFocus.current = () => { observer.disconnect(); cancelAnimationFrame(frame); };
    frame = requestAnimationFrame(restore);
  }}>{children}{renderPreview ? <DragOverlay dropAnimation={null} className={exactPreview ? `${styles.preview} ${styles.exactPreview}` : styles.preview}>{source => <div inert aria-hidden="true">{renderPreview(String(source.id))}</div>}</DragOverlay> : null}</DragDropProvider></div>;
}
/** Pure visual row: the preview registers no drag sensors. */
export function DragItemView({ children, disabled = false, id, label, itemRef, handleRef }: { children: ReactNode; disabled?: boolean; id?: string; label?: string; itemRef?: Ref<HTMLDivElement>; handleRef?: Ref<HTMLButtonElement> }) {
  return <div ref={itemRef} className={styles.item}><button ref={handleRef} data-drag-id={id} type="button" disabled={disabled} className={styles.handle} aria-label={label}><svg viewBox="0 0 20 20" width="20" height="20" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M6 4h1m6 0h1M6 10h1m6 0h1M6 16h1m6 0h1" /></svg></button>{children}</div>;
}
export function DragItem({ id, disabled, children, label = 'Перетащить элемент; для клавиатуры используйте кнопки рядом' }: { id: string; disabled: boolean; children: ReactNode; label?: string }) {
  const { ref, handleRef } = useDraggable({ id, disabled });
  return <DragItemView itemRef={ref} handleRef={handleRef} id={id} disabled={disabled} label={label}>{children}</DragItemView>;
}
export function DropTarget({ id, disabled, children }: { id: string; disabled: boolean; children: ReactNode }) {
  const { ref, isDropTarget } = useDroppable({ id, disabled });
  return <div ref={ref} data-drop-id={id} className={isDropTarget ? styles.targetActive : styles.target}>{children}</div>;
}
