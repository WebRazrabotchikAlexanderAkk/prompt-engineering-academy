import { useId, type ReactNode } from 'react';
import type { ExerciseAnswer, ExerciseDefinition, ExerciseMode, ExerciseResult } from '../../domain/exercises/types';
import { AnswerEditor } from './editors';
import { Feedback } from './Feedback';
import styles from './ExerciseShell.module.css';

const labels = { MultipleChoice: 'Выбор ответа', MatchPairs: 'Соедините пары', FillTheBlank: 'Заполните пропуски', TrueFalse: 'Верно или неверно', OrderSteps: 'Порядок шагов', CaseStudy: 'Улучшите промпт', PromptSimulator: 'Симулятор ответа', SpotTheHallucination: 'Найдите галлюцинацию', PromptBuilder: 'Конструктор промпта', ContextBudget: 'Бюджет контекста' };
export interface ShellProps { definition: ExerciseDefinition; answer: ExerciseAnswer; onChange: (answer: ExerciseAnswer) => void; mode: ExerciseMode; disabled: boolean; result?: ExerciseResult; final?: boolean; correction?: boolean; children?: ReactNode }
export function ExerciseShell({ definition, answer, onChange, mode, disabled, result, final = false, correction = false, children }: ShellProps) {
  const title = useId();
  return <section className={styles.shell} aria-labelledby={title} data-exercise-type={definition.type}>
    <p className={styles.kind}>{labels[definition.type]}</p>
    <h3 id={title}>{definition.instruction}</h3>
    {correction ? <p className={styles.warning}>Последняя попытка. Новый результат заменит первый, даже если станет хуже.</p> : null}
    {definition.type === 'PromptSimulator' ? <p className={styles.note}>Учебная симуляция: заранее подготовленный пример, выбранный по результатам проверки вашего промпта</p> : null}
    <AnswerEditor definition={definition} answer={answer} onChange={onChange} disabled={disabled} />
    {children}
    {result && (mode === 'inline' || final) ? <Feedback definition={definition} result={result} final={final} answer={answer} /> : null}
  </section>;
}
