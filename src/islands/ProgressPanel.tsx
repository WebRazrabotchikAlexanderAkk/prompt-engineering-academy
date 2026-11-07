import { articleExercises } from '../data/exercises/inline';
import { achievements, rewards, xpTotal } from '../domain/gamification/catalog';
import { useProgress, useStorageWarning } from '../storage/useProgress';
import { browserStore } from '../storage/progress';
import styles from './ProgressPanel.module.css';
export default function ProgressPanel({ articleId, expanded = false }: { articleId?: keyof typeof articleExercises; expanded?: boolean }) {
  const progress = useProgress(); const warning = useStorageWarning();
  const ids = articleId ? articleExercises[articleId] : Object.values(articleExercises).flat();
  const count = ids.filter(id => progress.inline[id]).length;
  const xp = xpTotal(progress.gamification);
  return <section className={styles.panel} aria-label={articleId ? 'Прогресс практического задания' : 'Учебный прогресс'}>
    <div className={styles.summary}><div><span>{articleId ? 'Выполнено упражнений' : 'Прогресс курса'}: {count} из {ids.length} · {Math.round(count / ids.length * 100)}%</span><progress value={count} max={ids.length} aria-label="Выполненные упражнения" /></div><strong className={styles.xp}>{xp} XP</strong></div>
    {articleId && count === ids.length ? <p>Практическое задание выполнено. Ошибки можно использовать для дальнейшей практики.</p> : null}
    {expanded ? <><details><summary>Достижения и награды</summary><ul>{achievements.map(item => <li key={item.id}>{progress.gamification.unlockedAchievementIds.includes(item.id) ? 'Получено' : 'Пока не получено'}: {item.title}</li>)}</ul><ul>{rewards.map(item => <li key={item.id}>{xp >= item.threshold ? 'Открыто' : `Нужно ${item.threshold} XP`}: {item.title}</li>)}</ul></details><button type="button" onClick={() => { if (window.confirm('Сбросить весь учебный прогресс, результаты и награды? Тема останется прежней.')) browserStore().reset(); }}>Сбросить учебный прогресс</button></> : null}
    {warning ? <p role="status" className={styles.warning}>{warning}</p> : null}
  </section>;
}
