import { useEffect, useRef, useState } from 'react';
import type { ExerciseDefinition, ExerciseResult } from '../domain/exercises/types';
import { evaluate, isEmpty } from '../domain/scoring/evaluate';
import { initialAnswer } from '../domain/quiz/state';
import { ExerciseShell } from '../components/exercises/ExerciseShell';
import { browserStore } from '../storage/progress';
import { useProgress, useStorageWarning } from '../storage/useProgress';
import styles from './InlineExerciseIsland.module.css';
import { rubricVersion } from '../data/contentVersion';

export default function InlineExerciseIsland({ definition }: { definition: ExerciseDefinition }) {
  const progress = useProgress(); const warning = useStorageWarning();
  const record = progress.inline[definition.id];
  const [answer, setAnswer] = useState(() => initialAnswer(definition));
  const [runtimeResult, setRuntimeResult] = useState<ExerciseResult>();
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const feedback = useRef<HTMLParagraphElement>(null);
  const submittedHere = useRef(false);
  const final = !!record && (record.first.score === 1 || record.correctionUsed);
  const correction = !!record && !final;
  const outdated = !!record && (record.rubricVersion ?? 1) !== rubricVersion(definition);
  useEffect(() => {
    if (!record) { setAnswer(initialAnswer(definition)); setRuntimeResult(undefined); setNotice(''); submittedHere.current = false; }
  }, [record, definition]);
  const submit = () => {
    if (!ready || final || outdated) return;
    if (isEmpty(answer)) { setNotice(definition.type === 'ContextBudget' ? 'Выберите хотя бы один фрагмент' : 'Заполните ответ. Попытка не потрачена.'); feedback.current?.focus(); return; }
    const result = evaluate(definition, answer); submittedHere.current = true; setRuntimeResult(result);
    browserStore().saveInline(definition.id, record ? { ...record, final: result, correctionUsed: true } : { first: result, correctionUsed: false });
    setNotice(record || result.score === 1 ? 'Упражнение завершено. Ниже доступен полный разбор.' : 'Ответ принят. Ниже результат и подсказка; доступно одно исправление.');
    requestAnimationFrame(() => feedback.current?.focus());
  };
  if (outdated) return <section aria-label="Изменённая рубрика" className={styles.warning}>
    <h3>{definition.instruction}</h3>
    <p>Правила оценки этого упражнения обновились. Сохранённые баллы не пересчитывались.</p>
    <p>Первый результат: {Math.round(record.first.score * 10000) / 100}%.{record.final ? ` Окончательный: ${Math.round(record.final.score * 10000) / 100}%.` : ''}</p>
    {final ? <p>Упражнение уже завершено по прежним правилам. Его результат и отметка прохождения сохранены.</p> : <><p>Продолжить старую попытку нельзя. Можно начать это упражнение заново по новым правилам.</p><button disabled={!ready} onClick={() => {
      if (window.confirm('Начать это упражнение заново? Его прежний результат будет удалён, а отметка прохождения восстановится после нового ответа. Остальные упражнения, результаты теста, тема и награды сохранятся.')) browserStore().restartOutdatedInline(definition.id);
    }}>Начать упражнение заново</button></>}
    {warning ? <p>{warning}</p> : null}
  </section>;
  return <ExerciseShell definition={definition} mode="inline" answer={answer} onChange={setAnswer} disabled={!ready || final} correction={correction} final={final} result={runtimeResult ?? record?.final ?? record?.first}>
    {final && !submittedHere.current ? <p>Сохранён только результат проверки. Прежний ввод не восстанавливается, поэтому поля выше пустые и недоступны. Упражнение завершено; баллы и разбор приведены ниже.</p> : null}
    {correction && !submittedHere.current && ['CaseStudy', 'PromptSimulator', 'FillTheBlank'].includes(definition.type) ? <p>Предыдущий текст не сохранялся. Введите исправленный ответ заново.</p> : null}
    {!final ? <button className={styles.submit} disabled={!ready} onClick={submit}>{correction ? 'Отправить окончательный ответ' : 'Проверить ответ'}</button> : null}
    <p ref={feedback} tabIndex={-1} role="status">{notice}</p>
    {record?.correctionUsed ? <p>Первый результат: {Math.round(record.first.score * 10000) / 100}%. Окончательный: {Math.round((record.final?.score ?? record.first.score) * 10000) / 100}%.</p> : null}
    {warning ? <p className={styles.warning}>{warning}</p> : null}
  </ExerciseShell>;
}
