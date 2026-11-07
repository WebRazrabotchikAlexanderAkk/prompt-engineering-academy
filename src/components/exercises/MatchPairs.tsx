import { useId, useState } from 'react';
import type { EditorProps } from './editors';
import { DragAdapter, DragItem, DragItemView, DropTarget } from './DragAdapter';
import styles from './MatchPairs.module.css';

function DescriptionView({ text, disabled, selected, onAssign }: { text: string; disabled: boolean; selected: boolean; onAssign?: () => void }) {
  return <button type="button" className={styles.assign} disabled={disabled} aria-label={`Назначить описание: ${text}`} aria-pressed={selected} onClick={onAssign}>{text}</button>;
}

/** Navigation is local UI state; both input paths commit the same answer map. */
export function MatchPairs({ definition: def, answer, onChange, disabled }: EditorProps<'MatchPairs'>) {
  const [selected, setSelected] = useState(def.left[0]!.id);
  const [message, setMessage] = useState('');
  const current = def.left.find(item => item.id === selected) ?? def.left[0]!;
  const mapping = answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
  const summaryTitle = useId();
  const place = (source: string, target: string) => {
    if (disabled || !def.left.some(item => item.id === target) || (source && !def.right.some(item => item.id === source))) return;
    const next = Object.fromEntries(Object.entries(mapping).filter(([key, value]) => key !== target && (!source || value !== source)));
    if (source) next[target] = source;
    onChange(next);
    setMessage(source ? `Выбранный элемент помещён: ${def.left.find(item => item.id === target)!.text}.` : 'Место очищено.');
  };
  const description = (id: string) => def.right.find(item => item.id === id)?.text;
  return <DragAdapter disabled={disabled} onMove={place} autoScroll={false} exactPreview renderPreview={id => <DragItemView><DescriptionView text={description(id) ?? ''} disabled={disabled} selected={mapping[current.id] === id} /></DragItemView>}>
    <p className={styles.instruction}>Выберите механизм, затем его описание. Можно также перетащить описание в текущую ячейку. Проверка выполняется после отправки ответа.</p>
    <div className={styles.navigation} role="group" aria-label="Механизмы для сопоставления">
      {def.left.map(item => <button type="button" key={item.id} disabled={disabled} aria-label={`Механизм: ${item.text}`} aria-pressed={current.id === item.id} onClick={() => setSelected(item.id)}>{item.text}</button>)}
    </div>
    <div className={styles.workspace}>
      <div className={styles.current}>
        <div className={styles.titleReserve}><h4>{current.text}</h4>{def.left.map(item => <span key={item.id} className={styles.hidden} aria-hidden="true">{item.text}</span>)}</div>
        <DropTarget id={current.id} disabled={disabled}>
          <div className={styles.descriptionReserve}>
            <p className={!mapping[current.id] ? styles.visible : styles.hidden} aria-hidden={!!mapping[current.id]}>Выберите или перетащите описание сюда</p>
            {def.right.map(item => <p key={item.id} className={mapping[current.id] === item.id ? styles.visible : styles.hidden} aria-hidden={mapping[current.id] !== item.id}>{item.text}</p>)}
          </div>
        </DropTarget>
        <button type="button" disabled={disabled || !mapping[current.id]} onClick={() => place('', current.id)} aria-label={`Убрать текущее описание: ${current.text}`}>Убрать связь</button>
      </div>
      <div className={styles.bank} role="group" aria-label="Доступные описания">
        <h4>Доступные описания</h4>
        {def.right.map(item => {
          const assigned = def.left.find(left => mapping[left.id] === item.id);
          return <div key={item.id} className={styles.card} data-assigned={assigned ? 'true' : 'false'}>
            <DragItem id={item.id} disabled={disabled} label={`Перетащить описание: ${item.text}`}>
              <DescriptionView text={item.text} disabled={disabled} selected={mapping[current.id] === item.id} onAssign={() => place(item.id, current.id)} />
            </DragItem>
            <small>{assigned ? `Назначено: ${assigned.text}` : 'Не назначено'}</small>
          </div>;
        })}
      </div>
    </div>
    <section className={styles.summary} aria-labelledby={summaryTitle}>
      <h4 id={summaryTitle}>Ваши пары</h4>
      <ul>{def.left.map(item => <li key={item.id}><div><strong>{item.text}</strong><span>{description(mapping[item.id] ?? '') ?? 'Не назначено'}</span></div><button type="button" disabled={disabled || !mapping[item.id]} aria-label={`Убрать пару: ${item.text}`} onClick={() => place('', item.id)}>Убрать</button></li>)}</ul>
    </section>
    <p className={styles.instruction}>Назначено {def.left.filter(item => !!mapping[item.id]).length} из {def.left.length}.</p>
    <p className={styles.status} role="status">{message}</p>
  </DragAdapter>;
}
