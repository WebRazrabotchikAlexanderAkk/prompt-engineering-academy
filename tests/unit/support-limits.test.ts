import { expect, it } from 'vitest';
import { getExercise } from '../../src/data/exercises/inline';
import { quizBank } from '../../src/data/quiz/bank';
import { evaluate } from '../../src/domain/scoring/evaluate';

const definitions = [getExercise('context-2'), quizBank.find(def => def.id === 'quiz-context-2')!];
const base = 'Ты менеджер поддержки. Сообщи клиенту о задержке заказа. Новая дата доставки 20 октября.';
const accepted = [
  'Напиши письмо до 120 слов. Не обещай скидку.',
  'Не обещай скидку. Напиши письмо до 120 слов.',
  'Напиши не более 120 слов, без обещания скидки.',
  'Без обещания скидки, максимум 120 слов.',
  'Письмо не длиннее 120 слов. Скидку не обещай.',
  'Не превышай 120 слов. Не обещать скидку.',
  'Напиши письмо до 120 слов без обещания скидки.',
];
const rejected = [
  'Напиши письмо до 120 слов.',
  'Не обещай скидку.',
  'Напиши до 150 слов. Не обещай скидку.',
  'Не ограничивай длину до 120 слов. Не обещай скидку.',
  'Напиши до 120 слов. Не пиши без обещания скидки.',
  'Напиши до 120 слов. Не требуй не обещать скидку.',
];

for (const def of definitions) {
  it.each(accepted)(`${def.id}: равнозначные ограничения «%s» дают полный балл`, limits => {
    const result = evaluate(def, `${base} ${limits}`);
    expect(result.score).toBe(1);
    expect(result.breakdown.find(row => row.id === 'limit')?.met).toBe(true);
  });
  it.each(rejected)(`${def.id}: неполные или отменённые ограничения «%s» не выполняют критерий`, limits => {
    const result = evaluate(def, `${base} ${limits}`);
    expect(result.score).toBe(.75);
    expect(result.breakdown.find(row => row.id === 'limit')?.met).toBe(false);
  });
}
