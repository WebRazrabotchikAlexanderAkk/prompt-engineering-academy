import { missions } from '../../data/missions';
import { evaluate, optimalBudget } from '../scoring/evaluate';
import { exerciseTypes, type ExerciseDefinition } from './types';

function jsonValue(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype) return false;
  seen.add(value);
  const valid = Object.values(value).every(item => jsonValue(item, seen));
  seen.delete(value);
  return valid;
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** Authoring boundary: reports an exercise ID rather than rendering a broken editor. */
export function validateDefinitions(input: unknown): asserts input is ExerciseDefinition[] {
  if (!Array.isArray(input)) throw new Error('Exercise bank must be an array');
  const ids = new Set<string>();
  for (const raw of input) {
    const def = raw as ExerciseDefinition;
    const fail = (message: string): never => { throw new Error(`[${def?.id ?? 'unknown'}] ${message}`); };
    const require = (condition: unknown, message: string) => { if (!condition) fail(message); };
    require(jsonValue(raw), 'Payload must be serializable plain JSON');
    require(raw && typeof raw === 'object', 'Missing definition');
    for (const key of ['id', 'instruction', 'hint', 'explanation'] as const) require(text(def[key]), `Missing ${key}`);
    require(!ids.has(def.id), 'duplicate ID'); ids.add(def.id);
    require(exerciseTypes.includes(def.type), 'Unknown type');
    require(missions.some(mission => mission.id === def.topicId), 'Unknown topic');
    const options = (items: unknown): string[] => {
      require(Array.isArray(items) && items.length > 0, 'Empty item list');
      const list = items as { id: string; text?: string; label?: string }[];
      require(list.every(item => item && text(item.id) && text(item.text ?? item.label)), 'Invalid item');
      const keys = list.map(item => item.id);
      require(new Set(keys).size === keys.length, 'Duplicate item key');
      return keys;
    };
    const distinctSubset = (values: unknown, allowed: string[]) => Array.isArray(values) && values.length > 0 && new Set(values).size === values.length && values.every(id => allowed.includes(id));
    try {
      switch (def.type) {
        case 'MultipleChoice': {
          const keys = options(def.options);
          require(typeof def.multiple === 'boolean' && distinctSubset(def.correct, keys), 'Invalid correct set');
          require(def.multiple || def.correct.length === 1, 'Single choice needs one correct answer');
          break;
        }
        case 'MatchPairs': {
          const left = options(def.left); const right = options(def.right);
          require(def.pairs && Object.keys(def.pairs).length === left.length && left.every(id => right.includes(def.pairs[id]!)), 'Invalid pair map');
          require(new Set(Object.values(def.pairs)).size === left.length, 'Ambiguous pairs');
          break;
        }
        case 'FillTheBlank':
          options(def.blanks);
          require(def.blanks.every(blank => Array.isArray(blank.accepted) && blank.accepted.length && blank.accepted.every(answer => text(answer.text) && (answer.allowTypo === undefined || typeof answer.allowTypo === 'boolean'))), 'Missing accepted answers');
          break;
        case 'TrueFalse': require(typeof def.correct === 'boolean', 'Invalid boolean answer'); break;
        case 'OrderSteps': {
          const keys = options(def.items);
          require(keys.length >= 2 && distinctSubset(def.correctOrder, keys) && def.correctOrder.length === keys.length, 'Invalid reference order');
          break;
        }
        case 'CaseStudy':
        case 'PromptSimulator': {
          options(def.criteria);
          require(def.criteria.every(criterion => positive(criterion.weight)), 'Nonpositive rubric weight');
          require(Math.abs(def.criteria.reduce((sum, criterion) => sum + criterion.weight, 0) - 1) < 1e-9, 'Rubric weights must sum to one');
          for (const criterion of def.criteria) {
            require(Array.isArray(criterion.checks) && criterion.checks.length, 'Missing rubric checks');
            for (const check of criterion.checks) {
              require(['any', 'all', 'absent', 'minWords'].includes(check.kind), 'Unknown rubric check');
              if (check.kind === 'minWords') require(Number.isInteger(check.count) && check.count > 0, 'Invalid word count');
              else require(Array.isArray(check.concepts) && check.concepts.length && check.concepts.every(concept => text(concept.text) && (concept.stem === undefined || typeof concept.stem === 'boolean') && (concept.negative === undefined || (Array.isArray(concept.negative) && concept.negative.every(text)))), 'Invalid concept');
            }
          }
          require(text(def.example) && evaluate(def, def.example).score === 1, 'Example must receive score=1');
          if (def.type === 'CaseStudy') {
            require(text(def.initialPrompt) && evaluate(def, def.initialPrompt).score < 1, 'Invalid initialPrompt');
            require(/улучш/iu.test(def.instruction) && /промпт|исходн/iu.test(def.instruction), 'Instruction must ask to improve the initial prompt');
          } else {
            require(text(def.scenario), 'Missing scenario');
            require(def.responses && Object.keys(def.responses).length === 3 && ['weak', 'partial', 'strong'].every(key => text(def.responses[key as keyof typeof def.responses])), 'Three prepared responses required');
            require(Array.isArray(def.consequences) && def.consequences.every(item => def.criteria.some(criterion => criterion.id === item.criterionId) && typeof item.met === 'boolean' && text(item.text)), 'Invalid consequences');
            // At least two always-applicable explanations, selected in authored order.
            const covered = def.criteria.filter(criterion => [true, false].every(met => def.consequences.some(item => item.criterionId === criterion.id && item.met === met)));
            require(covered.length >= 2, 'Insufficient explanations for possible criterion outcomes');
          }
          break;
        }
        case 'SpotTheHallucination':
          options(def.claims);
          require(text(def.reference) && /^https?:\/\//u.test(def.source), 'Reference and web source required');
          require(def.claims.some(claim => claim.falseClaim) && def.claims.every(claim => typeof claim.falseClaim === 'boolean' && text(claim.reason)), 'Invalid claims');
          break;
        case 'PromptBuilder': {
          const keys = options(def.blocks); options(def.slots);
          require(distinctSubset(def.slots.map(slot => slot.correctBlock), keys), 'Invalid required blocks');
          break;
        }
        case 'ContextBudget':
          options(def.fragments);
          require(Number.isInteger(def.budget) && def.budget > 0, 'Invalid budget');
          require(def.fragments.every(item => Number.isInteger(item.cost) && item.cost > 0 && Number.isFinite(item.utility) && item.utility >= 0 && (item.distractor ? item.utility === 0 && positive(item.penalty) : item.penalty === undefined || item.penalty === 0)), 'Invalid fragment');
          require(optimalBudget(def).utility > 0, 'No reachable useful answer');
          break;
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith(`[${def.id}]`)) throw error;
      fail('Malformed type payload');
    }
  }
}
