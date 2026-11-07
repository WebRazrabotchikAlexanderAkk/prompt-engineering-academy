import type { DefinitionOf, ExerciseAnswer, ExerciseDefinition, ExerciseResult } from '../../domain/exercises/types';
import { optimalBudget, simulatorTier } from '../../domain/scoring/evaluate';
import styles from './Feedback.module.css';

const reasons = { matched: 'Критерий выполнен', missing: 'Нужное понятие не найдено', wrong: 'Есть ошибка', forbidden: 'Обнаружен лишний или запрещённый элемент', tooShort: 'Недостаточно слов', overBudget: 'Превышен бюджет' };
export function Feedback({ definition: def, result, final, answer }: { definition: ExerciseDefinition; result: ExerciseResult; final: boolean; answer: ExerciseAnswer }) {
  return <div className={styles.feedback}>
    <p className={styles[result.status]}>{result.status === 'correct' ? 'Верно' : result.status === 'partial' ? 'Частично верно' : 'Пока неверно'}: {Math.round(result.score * 10000) / 100}%</p>
    {!final ? <p>{def.hint}</p> : <><p>{def.explanation}</p><AnswerKey definition={def} />
      {def.type === 'CaseStudy' || def.type === 'PromptSimulator' ? <ul>{def.criteria.map(criterion => { const entry = result.breakdown.find(item => item.id === criterion.id); return <li key={criterion.id}>{criterion.label}: {entry ? reasons[entry.reason] : 'Не выполнено'}; вес {criterion.weight}, начислено {entry?.earned ?? 0}.{entry?.quote ? <blockquote>{entry.quote}</blockquote> : null}</li>; })}</ul> : null}
      {def.type === 'SpotTheHallucination' ? <ul>{def.claims.map(claim => { const row = result.breakdown.find(item => item.id === claim.id); const selected = row ? row.met === claim.falseClaim : Array.isArray(answer) && answer.includes(claim.id); return <li key={claim.id}>{claim.text} · {selected ? 'Вы выделили' : 'Вы не выделили'} · {claim.falseClaim ? 'Не подтверждено' : 'Подтверждено'}. {claim.reason}</li>; })}</ul> : null}
      {def.type === 'ContextBudget' ? <BudgetCalculation definition={def} result={result} /> : null}
      {def.type === 'PromptBuilder' ? <section aria-label="Разбор мест конструктора"><ul>{def.slots.map(slot => {
        const row = result.breakdown.find(item => item.id === slot.id);
        const messages = { matched: 'Блок на правильном месте.', missing: 'Место не заполнено.', forbidden: 'Выбран лишний блок: он не входит в обязательный набор.', wrong: 'Обязательный блок поставлен не на своё место.' };
        return <li key={slot.id}>{slot.label}: {row && row.reason in messages ? messages[row.reason as keyof typeof messages] : 'Ответ не оценивался.'}</li>;
      })}</ul><p>В старых сохранениях пропуски и лишние блоки могли быть записаны как ошибка места без уточнения причины.</p></section> : null}
    </>}
    {def.type === 'PromptSimulator' ? <div className={styles.example}><strong>Подготовленный пример</strong>{final ? <p>Уровень примера: {{ weak: 'слабый', partial: 'частичный', strong: 'сильный' }[simulatorTier(result.score)]}.</p> : null}<p>{def.responses[simulatorTier(result.score)]}</p>{final ? <ul>{def.consequences.filter(consequence => result.breakdown.some(item => item.id === consequence.criterionId && item.met === consequence.met)).slice(0, 3).map((item, index) => <li key={index}>{item.text}</li>)}</ul> : null}</div> : null}
  </div>;
}
function BudgetCalculation({ definition: def, result }: { definition: DefinitionOf<'ContextBudget'>; result: ExerciseResult }) {
  // Persisted row IDs retain the selection without retaining user-authored text.
  const selected = def.fragments.filter(fragment => result.breakdown.some(row => row.id === fragment.id));
  if (!selected.length) return <p>Выбор не был оценён: отправленный набор отсутствует. Расчёт выбора недоступен.</p>;
  const cost = selected.reduce((sum, item) => sum + item.cost, 0);
  const utility = selected.reduce((sum, item) => sum + item.utility, 0);
  const penalties = selected.reduce((sum, item) => sum + (item.distractor ? item.penalty ?? 0 : 0), 0);
  const optimum = optimalBudget(def).utility;
  return <section aria-label="Расчёт выбранного бюджета">
    <p>Выбрано: {selected.map(item => item.text).join('; ')}.</p>
    <p>Стоимость: {cost} из {def.budget}. Полезность: {utility}. Штрафы: {penalties}.</p>
    {cost > def.budget ? <p>Лимит превышен: результат равен 0 независимо от полезности.</p> : <p>Расчёт: max(0, ({utility} − {penalties}) / {optimum}) = {Math.round(result.score * 10000) / 100}%.</p>}
  </section>;
}
function AnswerKey({ definition: def }: { definition: ExerciseDefinition }) {
  switch (def.type) {
    case 'TrueFalse': return <p>Правильный ответ: {def.correct ? 'верно' : 'неверно'}.</p>;
    case 'MultipleChoice': return <p>Правильный набор: {def.options.filter(item => def.correct.includes(item.id)).map(item => item.text).join('; ')}.</p>;
    case 'MatchPairs': return <ul>{def.left.map(item => <li key={item.id}>{item.text} → {def.right.find(right => right.id === def.pairs[item.id])?.text}</li>)}</ul>;
    case 'FillTheBlank': return <ul>{def.blanks.map(blank => <li key={blank.id}>{blank.label}: {blank.accepted.map(item => item.text).join(' / ')}</li>)}</ul>;
    case 'OrderSteps': return <ol>{def.correctOrder.map(id => <li key={id}>{def.items.find(item => item.id === id)?.text}</li>)}</ol>;
    case 'CaseStudy': case 'PromptSimulator': return <div className={styles.example}><strong>Один из вариантов улучшения</strong><p>{def.example}</p><p>Допустимы другие формулировки.</p></div>;
    case 'PromptBuilder': return <ul>{def.slots.map(slot => <li key={slot.id}>{slot.label}: {def.blocks.find(block => block.id === slot.correctBlock)?.text}</li>)}</ul>;
    case 'ContextBudget': { const optimum = optimalBudget(def); return <><p>Оптимальная полезность: {optimum.utility}. Один оптимальный набор: {def.fragments.filter(item => optimum.ids.includes(item.id)).map(item => item.text).join('; ')}. Равноценные решения допустимы.</p><ul>{def.fragments.map(item => <li key={item.id}>{item.text}: стоимость {item.cost}, полезность {item.utility}, штраф {item.penalty ?? 0}.</li>)}</ul></>; }
    case 'SpotTheHallucination': return null;
  }
}
