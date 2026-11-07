import { useEffect, useId, useState } from 'react';
import type { DefinitionOf, ExerciseAnswer, ExerciseDefinition, ExerciseType } from '../../domain/exercises/types';
import { DragAdapter, DragItem, DropTarget } from './DragAdapter';
import styles from './editors.module.css';
import { MatchPairs } from './MatchPairs';
export { MatchPairs } from './MatchPairs';

export interface EditorProps<T extends ExerciseType = ExerciseType> { definition: DefinitionOf<T>; answer: ExerciseAnswer; onChange: (answer: ExerciseAnswer) => void; disabled: boolean }
const asList = (answer: ExerciseAnswer): string[] => Array.isArray(answer) ? answer : [];
const asMap = (answer: ExerciseAnswer): Record<string, string> => answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
const toggle = (items: string[], id: string) => items.includes(id) ? items.filter(item => item !== id) : [...items, id];

export function MultipleChoice({ definition: def, answer, onChange, disabled }: EditorProps<'MultipleChoice'>) {
  const name = useId();
  return <div className={styles.stack}>{def.options.map(option => <label className={styles.choice} key={option.id}><input type={def.multiple ? 'checkbox' : 'radio'} name={name} checked={asList(answer).includes(option.id)} disabled={disabled} onChange={() => onChange(def.multiple ? toggle(asList(answer), option.id) : [option.id])} />{option.text}</label>)}</div>;
}
export function TrueFalse({ answer, onChange, disabled }: EditorProps<'TrueFalse'>) {
  const name = useId();
  return <div className={styles.stack}>{[true, false].map(value => <label className={styles.choice} key={String(value)}><input type="radio" name={name} checked={answer === value} disabled={disabled} onChange={() => onChange(value)} />{value ? 'Верно' : 'Неверно'}</label>)}</div>;
}
export function FillTheBlank({ definition: def, answer, onChange, disabled }: EditorProps<'FillTheBlank'>) {
  return <div className={styles.stack}>{def.blanks.map(blank => <label key={blank.id} className={styles.stack}>{blank.label}<input value={asMap(answer)[blank.id] ?? ''} disabled={disabled} onChange={event => onChange({ ...asMap(answer), [blank.id]: event.target.value })} autoComplete="off" /></label>)}</div>;
}
export function OrderSteps({ definition: def, answer, onChange, disabled }: EditorProps<'OrderSteps'>) {
  const [message, setMessage] = useState('');
  const order = asList(answer);
  const move = (id: string, index: number) => {
    if (disabled || !order.includes(id) || !Number.isInteger(index) || index < 0 || index >= order.length) return;
    const next = order.filter(item => item !== id); next.splice(index, 0, id); onChange(next);
    setMessage(`Элемент перемещён на позицию ${index + 1}.`);
  };
  return <DragAdapter disabled={disabled} onMove={(source, target) => move(source, Number(target.replace('position-', '')))}><div className={styles.stack}>{order.map((id, index) => <DropTarget key={id} id={`position-${index}`} disabled={disabled}><DragItem id={id} disabled={disabled}><span className={styles.grow}>{index + 1}. {def.items.find(item => item.id === id)?.text}</span><div className={styles.actions}><button type="button" disabled={disabled || index === 0} onClick={() => move(id, index - 1)} aria-label={`Поднять шаг ${index + 1}`}>Выше</button><button type="button" disabled={disabled || index === order.length - 1} onClick={() => move(id, index + 1)} aria-label={`Опустить шаг ${index + 1}`}>Ниже</button></div></DragItem></DropTarget>)}</div><p role="status">{message}</p></DragAdapter>;
}
/** A single semantic placement command handles both select/button and gesture input. */
function PlacementEditor({ left, right, answer, onChange, disabled, horizontal = false }: { left: { id: string; text: string }[]; right: { id: string; text: string }[]; answer: ExerciseAnswer; onChange: (answer: ExerciseAnswer) => void; disabled: boolean; horizontal?: boolean }) {
  const [message, setMessage] = useState('');
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (!horizontal || typeof window.matchMedia !== 'function') return;
    // Same breakpoint as the placement columns in editors.module.css.
    const media = window.matchMedia('(min-width: 800px)');
    const update = () => setWide(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [horizontal]);
  const mapping = asMap(answer);
  const place = (source: string, target: string, commit = true) => {
    if (disabled || !left.some(item => item.id === target) || (source && !right.some(item => item.id === source))) return;
    // Arrow keys emit change for every intermediate option. Keep other places
    // intact until the select loses focus, then enforce the one-to-one mapping.
    const next = Object.fromEntries(Object.entries(mapping).filter(([key, value]) => key !== target && (!commit || !source || value !== source)));
    if (source) next[target] = source;
    onChange(next);
    if (commit) setMessage(source ? 'Выбранный элемент помещён в указанное место.' : 'Место очищено.');
  };
  return <DragAdapter disabled={disabled} onMove={place} autoScroll={!horizontal || !wide}><div className={horizontal ? styles.pairsPlacement : styles.stack}><div className={styles.bank}>{right.map(item => <DragItem key={item.id} id={item.id} disabled={disabled}><span>{item.text}</span></DragItem>)}</div><div className={styles.stack}>{left.map(item => <DropTarget key={item.id} id={item.id} disabled={disabled}><label className={styles.stack}>{item.text}<select disabled={disabled} value={mapping[item.id] ?? ''} onChange={event => place(event.target.value, item.id, false)} onBlur={event => place(event.currentTarget.value, item.id)}><option value="">Не выбрано</option>{right.map(option => <option key={option.id} value={option.id}>{option.text}</option>)}</select></label></DropTarget>)}</div></div><p role="status">{message}</p></DragAdapter>;
}
export function PromptBuilder({ definition: def, ...props }: EditorProps<'PromptBuilder'>) { return <PlacementEditor left={def.slots.map(slot => ({ id: slot.id, text: slot.label }))} right={def.blocks} {...props} />; }
function RubricEditor({ definition: def, answer, onChange, disabled }: EditorProps<'CaseStudy' | 'PromptSimulator'>) {
  return <div className={styles.stack}>
    {def.type === 'CaseStudy' ? <div className={styles.reference}><strong>Исходный промпт</strong><p>{def.initialPrompt}</p></div> : <p>{def.scenario}</p>}
    <p className={styles.note}>Учебная проверка по заданным правилам, а не понимание текста настоящей моделью. Иные формулировки допустимы, но словарь проверки ограничен.</p>
    <ul>{def.criteria.map(criterion => <li key={criterion.id}>{criterion.label} · {Math.round(criterion.weight * 100)}%{criterion.checks.filter(check => check.kind === 'minWords').map(check => ` · минимум ${check.kind === 'minWords' ? check.count : 0} слов`)}</li>)}</ul>
    <label className={styles.stack}>{def.type === 'CaseStudy' ? 'Улучшенная версия промпта' : 'Ваш промпт для заданной ситуации'}<textarea value={typeof answer === 'string' ? answer : ''} disabled={disabled} onChange={event => onChange(event.target.value)} /></label>
  </div>;
}
export const CaseStudy = RubricEditor;
export const PromptSimulator = RubricEditor;
export function SpotTheHallucination({ definition: def, answer, onChange, disabled }: EditorProps<'SpotTheHallucination'>) {
  return <div className={styles.stack}><div className={styles.reference}><strong>Справка для проверки</strong><p>{def.reference}</p><a href={def.source} target="_blank" rel="noopener noreferrer">Материал по теме проверки фактов</a><p>Ответ проверяется по справке выше. Внешняя ссылка объясняет подход к проверке, а не подтверждает факты учебного сценария.</p></div><p>Отметьте утверждения, которые не подтверждаются справкой.</p>{def.claims.map(claim => <label className={styles.choice} key={claim.id}><input type="checkbox" checked={asList(answer).includes(claim.id)} disabled={disabled} onChange={() => onChange(toggle(asList(answer), claim.id))} />{claim.text}</label>)}</div>;
}
export function ContextBudget({ definition: def, answer, onChange, disabled }: EditorProps<'ContextBudget'>) {
  const cost = def.fragments.filter(item => asList(answer).includes(item.id)).reduce((sum, item) => sum + item.cost, 0);
  return <div className={styles.stack}><p>Учебные единицы, не токены конкретной модели. Бюджет: {def.budget}.</p><p role="status">Занято: {cost}. Осталось: {Math.max(0, def.budget - cost)}.{cost > def.budget ? ' Лимит превышен. Если отправить этот набор, результат будет 0 баллов.' : ''}</p>{def.fragments.map(fragment => <label className={styles.choice} key={fragment.id}><input type="checkbox" checked={asList(answer).includes(fragment.id)} disabled={disabled} onChange={() => onChange(toggle(asList(answer), fragment.id))} /><span>{fragment.text}<small>Стоимость: {fragment.cost}</small></span></label>)}</div>;
}
export const editors = { MultipleChoice, MatchPairs, FillTheBlank, TrueFalse, OrderSteps, CaseStudy, PromptSimulator, SpotTheHallucination, PromptBuilder, ContextBudget };
export function AnswerEditor(props: EditorProps) {
  const Editor = editors[props.definition.type] as (props: { definition: ExerciseDefinition; answer: ExerciseAnswer; onChange: (answer: ExerciseAnswer) => void; disabled: boolean }) => React.ReactNode;
  return <Editor {...props} />;
}
