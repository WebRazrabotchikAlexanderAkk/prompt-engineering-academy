import { expect, it } from 'vitest';
import { inlineExercises } from '../../src/data/exercises/inline';
import { quizBank } from '../../src/data/quiz/bank';
import { evaluate, simulatorTier } from '../../src/domain/scoring/evaluate';
import { matchesConcept } from '../../src/domain/scoring/text';

const rubrics = [...inlineExercises, ...quizBank].filter(def => def.type === 'CaseStudy' || def.type === 'PromptSimulator');

const announcementRubrics = rubrics.filter(def => ['llm-3', 'quiz-context-3'].includes(def.id));

it('отрицание неизвестного места в объявлении не меняет рубрику проверки заметки', () => {
  const def = rubrics.find(item => item.id === 'hall-3')!;
  const answer = 'Проверь заметку, раздели факты и предположения, укажи источники, если подтверждения нет, напиши нет данных, не указывай что место пока неизвестно.';
  expect(evaluate(def, answer).score).toBe(1);
});

it.each(announcementRubrics)('$id: краткое объявление с пока неизвестным местом выполняет все критерии', def => {
  for (const answer of [
    'Составь краткое объявление о встрече во вторник в 15:00 по теме план обучения. Укажи, что место пока неизвестно.',
    'Составь краткий текст объявления: встреча во вторник в 15:00, тема – план обучения. Отметь: место пока не указано.',
    'Составь краткое объявление о встрече по плану обучения во вторник в 15:00. Место неизвестно.',
    'Составь краткое объявление о встрече во вторник в 15:00. Обсудим план обучения. Место неизвестно.',
  ]) {
    expect(evaluate(def, answer).score, answer).toBe(1);
  }
});

for (const def of announcementRubrics) it.each([
  ['пропущена тема', 'во вторник в 15:00'],
  ['подменена тема', 'во вторник в 15:00, тема – праздничный концерт'],
  ['отрицается нужная тема', 'во вторник в 15:00, тема – концерт, а не план обучения'],
  ['неверный день', 'в среду в 15:00, тема – план обучения'],
  ['неверное время', 'во вторник в 16:00, тема – план обучения'],
  ['пропущен день', 'в 15:00, тема – план обучения'],
  ['пропущено время', 'во вторник, тема – план обучения'],
])(`${def.id}: %s оставляет 75% и не подставляет тему в пример`, (_reason, details) => {
  if (def.type !== 'PromptSimulator') throw new Error('Нужен симулятор объявления');
  const answer = `Составь краткое объявление о встрече ${details}. Место неизвестно.`;
  const result = evaluate(def, answer);
  expect(result.score, answer).toBe(.75);
  expect(result.breakdown.find(row => row.id === 'context')?.met).toBe(false);
  expect(def.responses[simulatorTier(result.score)]).not.toMatch(/план[ауе]? обучения|праздничный концерт/iu);
});

it.each(announcementRubrics)('$id: исходный случай с двумя предложениями различает подменённую и верную тему', def => {
  const base = 'Подготовь объявление о встрече: во вторник в 15:00. Напиши два предложения. Место неизвестно. Тема:';
  expect(evaluate(def, `${base} праздничный концерт.`).score).toBe(.75);
  expect(evaluate(def, `${base} план обучения.`).score).toBe(1);
});

it.each(announcementRubrics)('$id: отрицание краткости и неизвестного места не выполняет критерии объявления', def => {
  for (const answer of [
    'Составь объявление: встреча во вторник в 15:00, тема – план обучения. Не пиши краткое объявление. Не указывай, что место пока неизвестно.',
    'Составь объявление: встреча во вторник в 15:00, тема – план обучения. Не пиши краткий текст объявления. Не сообщай, что место пока не указано.',
  ]) {
    const result = evaluate(def, answer);
    expect(result.score).toBe(.5);
    expect(result.breakdown.find(row => row.id === 'format')?.met).toBe(false);
    expect(result.breakdown.find(row => row.id === 'unknown')?.met).toBe(false);
  }
});

it('отрицание обезличивания не выполняет критерий; отдельное положительное предложение выполняет', () => {
  const def = rubrics.find(item => item.id === 'safety-2')!;
  const met = (answer: string) => evaluate(def, answer).breakdown.find(row => row.id === 'data')!.met;
  expect(met('Не используй обезличенные данные.')).toBe(false);
  expect(met('Не используй обезличенные данные. Используй вымышленные данные.')).toBe(true);
});

it('каждое опубликованное положительное понятие имеет проверяемые отрицания', () => {
  for (const def of rubrics) for (const criterion of def.criteria) for (const check of criterion.checks) {
    if (check.kind !== 'any' && check.kind !== 'all') continue;
    for (const concept of check.concepts) {
      expect(concept.negative?.length, `${def.id}/${criterion.id}`).toBeGreaterThan(0);
      for (const negative of concept.negative ?? []) {
        expect(matchesConcept(`${concept.text}, ${negative}`, concept)).toBe(false);
        expect(matchesConcept(`${negative}. ${concept.text}.`, concept)).toBe(true);
      }
    }
  }
});

it.each(rubrics)('$id: эталон, регистр и ё/е не меняют полный результат; исходник неполный', def => {
  expect(evaluate(def, def.example).score).toBe(1);
  expect(evaluate(def, def.example.toUpperCase().replaceAll('Ё', 'Е')).score).toBe(1);
  if (def.type === 'CaseStudy') expect(evaluate(def, def.initialPrompt).score).toBeLessThan(1);
});

it('реальные понятия не совпадают с фрагментом постороннего слова', () => {
  for (const def of rubrics) for (const criterion of def.criteria) for (const check of criterion.checks) {
    if (check.kind === 'minWords') continue;
    for (const concept of check.concepts) {
      expect(matchesConcept(`сверх${concept.text}постфикс`, concept), `${def.id}/${criterion.id}/${concept.text}`).toBe(false);
    }
  }
});

it('опубликованный минимум слов: 11 не проходит, 12 проходит, запрещённая фраза обнуляет критерий', () => {
  const def = rubrics.find(item => item.id === 'hall-3')!;
  const criterion = def.criteria.find(item => item.id === 'safe')!;
  const isolated = { ...def, criteria: [{ ...criterion, weight: 1 }] };
  const words = 'один два три четыре пять шесть семь восемь девять десять одиннадцать двенадцать';
  expect(evaluate(isolated, words.split(' ').slice(0, 11).join(' ')).score).toBe(0);
  expect(evaluate(isolated, words).score).toBe(1);
  expect(evaluate(isolated, `${words}. Добавь любые красивые цифры.`).score).toBe(0);
});
