import type { Breakdown, DefinitionOf, ExerciseAnswer, ExerciseDefinition, ExerciseResult, ExerciseType } from '../exercises/types';
import { acceptsBlank, matchingSentence, wordCount } from './text';

const selected = (answer: ExerciseAnswer): string[] => Array.isArray(answer) ? [...new Set(answer)] : [];
const fields = (answer: ExerciseAnswer): Record<string, string> => answer && typeof answer === 'object' && !Array.isArray(answer) ? answer : {};
const row = (id: string, met: boolean, weight: number): Breakdown => ({ id, met, weight, earned: met ? weight : 0, reason: met ? 'matched' : 'wrong' });
type Evaluated = { score: number; breakdown: Breakdown[] };
type Evaluator<T extends ExerciseType> = (def: DefinitionOf<T>, answer: ExerciseAnswer) => Evaluated;

function rubric(def: DefinitionOf<'CaseStudy'> | DefinitionOf<'PromptSimulator'>, answer: ExerciseAnswer): Evaluated {
  const text = typeof answer === 'string' ? answer : '';
  const breakdown = def.criteria.map(criterion => {
    let reason: Breakdown['reason'] = 'matched';
    let quote: string | undefined;
    for (const check of criterion.checks) {
      if (check.kind === 'minWords') {
        if (wordCount(text) < check.count) reason = 'tooShort';
      } else {
        const matches = check.concepts.map(concept => matchingSentence(text, concept, check.kind !== 'absent'));
        const met = check.kind === 'any' ? matches.some(Boolean) : check.kind === 'all' ? matches.every(Boolean) : !matches.some(Boolean);
        if (!met) reason = check.kind === 'absent' ? 'forbidden' : 'missing';
        quote ??= matches.find(Boolean);
      }
    }
    const result = row(criterion.id, reason === 'matched', criterion.weight);
    return { ...result, reason, ...(quote ? { quote } : {}) };
  });
  // Avoid a sum such as .1+.2+.7 classifying a fully satisfied rubric as partial.
  return { score: breakdown.every(item => item.met) ? 1 : breakdown.reduce((sum, item) => sum + item.earned, 0), breakdown };
}

export function optimalBudget(def: DefinitionOf<'ContextBudget'>): { utility: number; ids: string[] } {
  const choices = new Map<number, { utility: number; ids: string[] }>([[0, { utility: 0, ids: [] }]]);
  for (const fragment of def.fragments.filter(item => !item.distractor)) {
    for (const [cost, choice] of [...choices]) {
      const nextCost = cost + fragment.cost;
      const nextUtility = choice.utility + fragment.utility;
      if (nextCost <= def.budget && nextUtility > (choices.get(nextCost)?.utility ?? -1)) choices.set(nextCost, { utility: nextUtility, ids: [...choice.ids, fragment.id] });
    }
  }
  return [...choices.values()].reduce((best, item) => item.utility > best.utility ? item : best, { utility: 0, ids: [] as string[] });
}

export const evaluators: { [T in ExerciseType]: Evaluator<T> } = {
  MultipleChoice(def, answer) {
    const choices = selected(answer);
    const extras = choices.some(id => !def.correct.includes(id));
    const score = extras || (!def.multiple && choices.length !== 1) ? 0 : choices.length / def.correct.length;
    return { score, breakdown: def.options.map(option => row(option.id, choices.includes(option.id) === def.correct.includes(option.id), 1 / def.options.length)) };
  },
  MatchPairs(def, answer) {
    const mapping = fields(answer);
    const values = Object.values(mapping).filter(Boolean);
    const breakdown = def.left.map(item => row(item.id, mapping[item.id] === def.pairs[item.id] && values.filter(value => value === mapping[item.id]).length === 1, 1 / def.left.length));
    return { score: breakdown.filter(item => item.met).length / def.left.length, breakdown };
  },
  FillTheBlank(def, answer) {
    const mapping = fields(answer);
    const breakdown = def.blanks.map(blank => row(blank.id, blank.accepted.some(accepted => acceptsBlank(mapping[blank.id] ?? '', accepted)), 1 / def.blanks.length));
    return { score: breakdown.filter(item => item.met).length / def.blanks.length, breakdown };
  },
  TrueFalse(def, answer) { const met = answer === def.correct; return { score: Number(met), breakdown: [row('answer', met, 1)] }; },
  OrderSteps(def, answer) {
    const order = selected(answer);
    const count = def.correctOrder.length * (def.correctOrder.length - 1) / 2;
    const breakdown: Breakdown[] = [];
    for (let left = 0; left < def.correctOrder.length; left++) {
      for (let right = left + 1; right < def.correctOrder.length; right++) {
        const first = def.correctOrder[left]!; const second = def.correctOrder[right]!;
        breakdown.push(row(`${first}:${second}`, order.includes(first) && order.includes(second) && order.indexOf(first) < order.indexOf(second), 1 / count));
      }
    }
    return { score: breakdown.filter(item => item.met).length / count, breakdown };
  },
  CaseStudy: rubric,
  PromptSimulator: rubric,
  SpotTheHallucination(def, answer) {
    const choices = selected(answer);
    const positives = def.claims.filter(claim => claim.falseClaim).map(claim => claim.id);
    const correct = choices.filter(id => positives.includes(id)).length;
    const wrong = choices.length - correct;
    return { score: Math.max(0, (correct - wrong) / positives.length), breakdown: def.claims.map(claim => row(claim.id, choices.includes(claim.id) === claim.falseClaim, 1 / def.claims.length)) };
  },
  PromptBuilder(def, answer) {
    const mapping = fields(answer);
    const required = def.slots.map(slot => slot.correctBlock);
    const values = Object.values(mapping).filter(Boolean);
    const extras = values.filter(id => !required.includes(id)).length;
    const breakdown = def.slots.map(slot => {
      const block = mapping[slot.id];
      const entry = row(slot.id, block === slot.correctBlock && values.filter(id => id === slot.correctBlock).length === 1, 1 / def.slots.length);
      return { ...entry, reason: entry.met ? 'matched' as const : !block ? 'missing' as const : !required.includes(block) ? 'forbidden' as const : 'wrong' as const };
    });
    return { score: Math.max(0, (breakdown.filter(item => item.met).length - extras) / def.slots.length), breakdown };
  },
  ContextBudget(def, answer) {
    const choices = selected(answer);
    const fragments = def.fragments.filter(fragment => choices.includes(fragment.id));
    const cost = fragments.reduce((sum, item) => sum + item.cost, 0);
    const utility = fragments.reduce((sum, item) => sum + item.utility - (item.distractor ? item.penalty ?? 0 : 0), 0);
    const optimum = optimalBudget(def).utility;
    const score = cost > def.budget ? 0 : Math.max(0, utility / optimum);
    return { score, breakdown: fragments.map(fragment => ({ ...row(fragment.id, !fragment.distractor && cost <= def.budget, fragment.utility / optimum), reason: cost > def.budget ? 'overBudget' : fragment.distractor ? 'forbidden' : 'matched' })) };
  },
};

export function evaluate(def: ExerciseDefinition, answer: ExerciseAnswer): ExerciseResult {
  // The discriminant was validated at the content boundary. Keep the indexed dispatch local.
  const evaluator = evaluators[def.type] as (definition: ExerciseDefinition, value: ExerciseAnswer) => Evaluated;
  const result = evaluator(def, answer);
  const score = Math.max(0, Math.min(1, result.score));
  return { exerciseId: def.id, topicId: def.topicId, score, status: score === 1 ? 'correct' : score === 0 ? 'incorrect' : 'partial', breakdown: result.breakdown };
}

export function simulatorTier(score: number): 'weak' | 'partial' | 'strong' { return score < .4 ? 'weak' : score < .8 ? 'partial' : 'strong'; }

export function isEmpty(answer: ExerciseAnswer): boolean {
  if (answer === null) return true;
  if (typeof answer === 'boolean') return false;
  if (typeof answer === 'string') return answer.trim().length === 0;
  if (Array.isArray(answer)) return answer.length === 0;
  return Object.values(answer).every(value => !value.trim());
}
