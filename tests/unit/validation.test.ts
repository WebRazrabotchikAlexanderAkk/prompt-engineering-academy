import { describe, expect, it } from 'vitest';
import { validateDefinitions } from '../../src/domain/exercises/validate';
import { fixtures } from '../fixtures/exercises';
import { evaluate, evaluators } from '../../src/domain/scoring/evaluate';
import { exerciseTypes } from '../../src/domain/exercises/types';

describe('Контракты всех десяти типов', () => {
  it('принимает контрольные задания, эталоны получают полный балл', () => {
    validateDefinitions(fixtures.map(item => item.definition));
    expect(Object.keys(evaluators).sort()).toEqual([...exerciseTypes].sort());
    expect(fixtures.map(item => item.definition.type).sort()).toEqual([...exerciseTypes].sort());
    for (const { definition, answer } of fixtures) expect(evaluate(definition, answer).score, definition.type).toBe(1);
  });
  it.each(exerciseTypes)('отклоняет %s без подсказки и сообщает ID', type => {
    const { definition } = fixtures.find(item => item.definition.type === type)!;
    expect(() => validateDefinitions([{ ...definition, hint: '' }])).toThrow(definition.id);
  });
  it('отклоняет неизвестный тип, тему, дубликат и несериализуемые поля', () => {
    const def = fixtures[0]!.definition;
    for (const value of [{ ...def, type: 'unknown' }, { ...def, topicId: 'unknown' }, { ...def, fn: () => 1 }, { ...def, date: new Date() }]) expect(() => validateDefinitions([value])).toThrow();
    expect(() => validateDefinitions([def, def])).toThrow('duplicate');
  });
  it('не принимает плохой исходник или плохой эталон CaseStudy', () => {
    const definition = fixtures.find(item => item.definition.type === 'CaseStudy')!.definition;
    expect(() => validateDefinitions([{ ...definition, initialPrompt: '' }])).toThrow();
    expect(() => validateDefinitions([{ ...definition, initialPrompt: 'Составь список из трёх пунктов' }])).toThrow();
    expect(() => validateDefinitions([{ ...definition, example: 'Привет' }])).toThrow();
  });
  it('не принимает недостижимый бюджет и некорректный штраф', () => {
    const def = fixtures.find(item => item.definition.type === 'ContextBudget')!.definition;
    expect(() => validateDefinitions([{ ...def, budget: 0 }])).toThrow();
    expect(() => validateDefinitions([{ ...def, fragments: [{ id: 'x', text: 'X', cost: 100, utility: 1 }] }])).toThrow();
    expect(() => validateDefinitions([{ ...def, fragments: [{ id: 'x', text: 'X', cost: 1, utility: 0, distractor: true, penalty: 0 }] }])).toThrow();
  });
});
