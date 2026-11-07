import { describe, expect, it } from 'vitest';
import { articleExercises, inlineExercises } from '../../src/data/exercises/inline';
import { exerciseTypes } from '../../src/domain/exercises/types';
import { validateDefinitions } from '../../src/domain/exercises/validate';
import { readFileSync, readdirSync } from 'node:fs';
import { missions } from '../../src/data/missions';
import { concepts } from '../../src/data/concepts';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { initialAnswer } from '../../src/domain/quiz/state';

describe('Учебные задания', () => {
  it('18 заданий, по три на тему, все десять типов', () => {
    validateDefinitions(inlineExercises);
    expect(inlineExercises).toHaveLength(18);
    expect([...new Set(inlineExercises.map(item => item.type))].sort()).toEqual([...exerciseTypes].sort());
    for (const [topic, ids] of Object.entries(articleExercises)) {
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) expect(inlineExercises.find(item => item.id === id)?.topicId).toBe(topic);
    }
  });
  it('шесть статей по 800–1200 слов, по три ссылки на упражнения', () => {
    expect(readdirSync('src/content/articles').filter(file => file.endsWith('.mdx'))).toHaveLength(6);
    for (const mission of missions) {
      const source = readFileSync(`src/content/articles/${mission.slug}.mdx`, 'utf8');
      const prose = source.replace(/^---[\s\S]*?---/u, '').replace(/^import .+$/gmu, '').replace(/<[^>]+>/gu, '').replace(/\[([^\]]+)\]\([^)]+\)/gu, '$1');
      const words = prose.match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];
      expect(words.length, mission.slug).toBeGreaterThanOrEqual(800);
      expect(words.length, mission.slug).toBeLessThanOrEqual(1200);
      expect([...source.matchAll(/<Exercise id="([^"]+)"/gu)].map(match => match[1])).toEqual(articleExercises[mission.id]);
      for (const concept of concepts.filter(item => item.articleId === mission.id)) {
        expect(articleExercises[mission.id]).toContain(concept.exerciseId);
        expect(source).toContain(`## ${concept.section}`);
        expect(concept.action.length).toBeGreaterThan(5);
        expect(concept.criterion.length).toBeGreaterThan(0);
      }
    }
  });
  it('реальный банк даёт допустимые выборки на 100 seed', () => {
    validateDefinitions(quizBank);
    for (let seed = 0; seed < 100; seed++) expect(selectQuiz(quizBank, seed)).toHaveLength(12);
  });
  it('каждая концепция ссылается на существующие строки оценивания своего упражнения', () => {
    expect(new Set(concepts.map(item => item.conceptId)).size).toBe(concepts.length);
    for (const concept of concepts) {
      const def = inlineExercises.find(item => item.id === concept.exerciseId)!;
      expect(def.topicId, concept.conceptId).toBe(concept.articleId);
      const answer = def.type === 'ContextBudget' ? def.fragments.map(item => item.id) : initialAnswer(def);
      const keys = evaluate(def, answer).breakdown.map(row => row.id);
      const referenced = concept.criterion.split(',');
      expect(new Set(referenced).size).toBe(referenced.length);
      for (const key of referenced) expect(keys, concept.conceptId).toContain(key);
    }
  });
  it('банк содержит 14 повторно используемых заданий и 10 новых, по четыре на тему', () => {
    // Ignore only presentation text and identity; retain all scoring and scenario data.
    const signature = ({ id, topicId, instruction, ...content }: (typeof quizBank)[number]) => JSON.stringify(content);
    const originals = new Set(inlineExercises.map(signature));
    expect(quizBank.filter(def => originals.has(signature(def)))).toHaveLength(14);
    expect(quizBank.filter(def => !originals.has(signature(def)))).toHaveLength(10);
    for (const mission of missions) expect(quizBank.filter(def => def.topicId === mission.id)).toHaveLength(4);
  });
});
