import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { missions } from '../../src/data/missions';
import { route } from '../../src/domain/navigation';

describe('Основа портала', () => {
  it('содержит шесть разных миссий в утверждённом порядке', () => {
    expect(missions.map(m => m.slug)).toEqual(['how-llms-work', 'hallucinations', 'prompt-structure', 'role-context-constraints', 'tokens-context', 'ai-safety']);
    expect(new Set(missions.map(m => m.id)).size).toBe(6);
  });
  it('учитывает путь публикации без двойных разделителей', () => {
    expect(route('/quiz/', '/academy/')).toBe('/academy/quiz/');
    expect(route('/', '/')).toBe('/');
    expect(route('articles/tokens-context/', '/academy')).toBe('/academy/articles/tokens-context/');
  });
  it('содержит обязательные статические маршруты', () => {
    for (const page of ['index.astro', 'articles/[slug].astro', 'quiz.astro', 'about.astro']) {
      expect(readFileSync(`src/pages/${page}`, 'utf8')).toContain('Layout');
    }
  });
});
