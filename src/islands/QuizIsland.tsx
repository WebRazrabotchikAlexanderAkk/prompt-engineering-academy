import { createContext, useContext, useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { quizBank } from '../data/quiz/bank';
import { CONTENT_VERSION } from '../data/contentVersion';
import { missions } from '../data/missions';
import { createAttempt, eligibleIds, percentages, quizReducer, type QuizAction, type QuizAttempt } from '../domain/quiz/state';
import { selectQuiz } from '../domain/quiz/selection';
import { presentQuestion } from '../domain/quiz/presentation';
import { isEmpty } from '../domain/scoring/evaluate';
import { rank } from '../domain/gamification/catalog';
import { recommendTopics } from '../domain/progress/recommendations';
import { ExerciseShell } from '../components/exercises/ExerciseShell';
import { browserStore } from '../storage/progress';
import { useProgress, useStorageWarning } from '../storage/useProgress';
import { route } from '../domain/navigation';
import styles from './QuizIsland.module.css';

type Action = QuizAction | { type: 'restore'; attempt: QuizAttempt | null };
const QuizContext = createContext<{ state: QuizAttempt; dispatch: Dispatch<Action> } | null>(null);
function reducer(state: QuizAttempt | null, action: Action) { return action.type === 'restore' ? action.attempt : state ? quizReducer(state, action, quizBank) : state; }
export default function QuizIsland() {
  const progress = useProgress(); const warning = useStorageWarning();
  const [state, dispatch] = useReducer(reducer, null);
  const [ready, setReady] = useState(false); const [error, setError] = useState('');
  useEffect(() => { const saved = browserStore().getSnapshot(); dispatch({ type: 'restore', attempt: saved.active ?? saved.latest }); setReady(true); }, []);
  useEffect(() => { if (state && ready) browserStore().saveQuiz(state, quizBank); }, [state, ready]);
  const start = () => {
    if (state && state.phase !== 'finalComplete' && !window.confirm('Удалить текущую попытку и её ответы? Прогресс статей, награды и завершённые результаты сохранятся.')) return;
    try {
      const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
      const attempt = createAttempt(selectQuiz(quizBank, seed), seed, crypto.randomUUID());
      browserStore().discardActive(); dispatch({ type: 'restore', attempt }); setError('');
    } catch { setError('Не удалось собрать тест. Учебные статьи остаются доступны.'); }
  };
  const incompatible = state && (state.contentVersion !== CONTENT_VERSION || state.ids.some(id => !quizBank.some(item => item.id === id)));
  return <div className={styles.quiz}>
    {warning ? <p className={styles.warning} role="status">{warning}</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {!ready ? <p>Восстанавливаем локальный прогресс…</p> : incompatible ? <><p>Версия учебных заданий изменилась. Эту попытку нельзя продолжить или разобрать. Сохранённые лучшие результаты не изменены.</p><button onClick={start}>Начать новый тест</button></> : state ? <QuizContext value={{ state, dispatch }}>{state.phase === 'finalComplete' ? <QuizResult /> : <QuizRunner />}<button onClick={start}>Начать заново</button></QuizContext> : <button className={styles.primary} onClick={start}>Начать тест</button>}
    {progress.best ? <p>Лучшие завершённые результаты: первичный {progress.best.first}%, финальный {progress.best.final}%. Это независимые максимумы, не обязательно одна попытка.</p> : null}
  </div>;
}
function QuizRunner() {
  const { state, dispatch } = useContext(QuizContext)!;
  const correcting = state.phase === 'correctionInProgress';
  const eligible = eligibleIds(state);
  const visibleIds = correcting ? eligible : state.ids;
  const id = state.ids[state.position]!;
  const definition = presentQuestion(quizBank.find(item => item.id === id)!, state);
  const locked = correcting ? !!state.corrections[id] || !eligible.includes(id) : !!state.primary[id];
  const answer = state.drafts[id] ?? null;
  const done = correcting ? Object.keys(state.corrections).length : Object.keys(state.primary).length;
  const max = correcting ? eligible.length : 12;
  const [notice, setNotice] = useState(''); const status = useRef<HTMLParagraphElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); setNotice(''); }, [id, state.phase]);
  const submit = () => {
    if (isEmpty(answer)) { setNotice('Заполните ответ. Пустая отправка не считается пропуском.'); status.current?.focus(); return; }
    dispatch({ type: 'submit', id, answer }); setNotice('Ответ сохранён. Результат будет доступен в финале.');
  };
  return <>
    <h2 ref={heading} tabIndex={-1}>{correcting ? 'Одна возможность исправить' : 'Первый проход'}</h2>
    <p>{correcting ? `Исправлено ${done} из ${max}` : `Обработано ${done} из 12`}</p>
    <progress aria-label={correcting ? 'Прогресс исправлений' : 'Прогресс первого прохода'} value={done} max={max} />
    <nav className={styles.navigation} aria-label="Вопросы теста">{visibleIds.map(questionId => <button key={questionId} aria-current={id === questionId ? 'step' : undefined} onClick={() => dispatch({ type: 'navigate', position: state.ids.indexOf(questionId) })}>{state.ids.indexOf(questionId) + 1}{(correcting ? state.corrections[questionId] : state.primary[questionId]) ? ' · отправлен' : ''}</button>)}</nav>
    <p>Открыт вопрос {state.position + 1} из 12.</p>
    {correcting ? <p>Подсказка: {definition.hint}</p> : null}
    {!locked && !correcting && done === 11 ? <p>Следующая отправка или пропуск завершит первую фазу.</p> : null}
    <ExerciseShell key={id} definition={definition} answer={answer} onChange={answer => dispatch({ type: 'draft', id, answer })} mode="quiz" disabled={locked} correction={correcting && !locked}>
      {locked ? <p>Ответ сохранён и недоступен для изменения в этой фазе.</p> : <div className={styles.actions}><button className={styles.primary} onClick={submit}>{correcting ? 'Отправить окончательный ответ' : 'Отправить ответ'}</button>{!correcting ? <button onClick={() => dispatch({ type: 'skip', id })}>Пропустить вопрос</button> : null}</div>}
      <p ref={status} tabIndex={-1} role="status">{notice}</p>
    </ExerciseShell>
    {correcting ? <button onClick={() => { if (window.confirm(`Осталось исправлений: ${max - done}. Для них сохранятся исходные баллы. Завершённую попытку нельзя изменить. Завершить тест?`)) dispatch({ type: 'finish' }); }}>Завершить без остальных исправлений</button> : null}
  </>;
}
function QuizResult() {
  const { state } = useContext(QuizContext)!;
  const result = percentages(state)!;
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const recommendations = recommendTopics(state, quizBank).map(id => missions.find(mission => mission.id === id)!);
  return <section>
    <h2 ref={heading} tabIndex={-1}>Итоговый результат</h2>
    <div className={styles.results}><p>Первичный результат<strong>{result.first}%</strong></p><p>Финальный результат<strong>{result.final}%</strong></p></div>
    <p>{result.final >= 70 ? 'Тест пройден' : 'Порог 70% пока не достигнут'}. Ранг: {rank(result.final)}.</p>
    <h3>Что повторить</h3>{recommendations.length ? <ul>{recommendations.map(mission => <li key={mission.id}><a href={route(`/articles/${mission.slug}/`)}>{mission.title}</a></li>)}</ul> : <p>Все темы выполнены без ошибок.</p>}
    <h3>Разбор заданий</h3>{state.ids.map((id, index) => { const definition = presentQuestion(quizBank.find(item => item.id === id)!, state); const submission = (state.corrections[id] ?? state.primary[id])!; return <details key={id}><summary>Вопрос {index + 1} · {Math.round(submission.result.score * 10000) / 100}%{state.primary[id]?.skipped ? ' · был пропущен' : ''}</summary>{submission.answer === null ? <p>Введённый текст не хранится после завершения и перезагрузки.</p> : null}<ExerciseShell definition={definition} answer={submission.answer} onChange={() => {}} mode="quiz" disabled final result={submission.result} /></details>; })}
  </section>;
}
