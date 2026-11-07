import { articleExercises, inlineExercises } from '../data/exercises/inline';
import { quizBank } from '../data/quiz/bank';
import type { ExerciseAnswer, ExerciseDefinition, ExerciseResult } from '../domain/exercises/types';
import { emptyGame, gameReducer, xpCatalog, achievements, rewards, xpTotal, type GameState } from '../domain/gamification/catalog';
import { percentages, type QuizAttempt, type Submission } from '../domain/quiz/state';
import { consistentAttempt } from './validation';
import { CONTENT_VERSION, rubricVersion } from '../data/contentVersion';

export const PROGRESS_KEY = 'pea.progress.v1';
export type Theme = 'dark' | 'light';
export interface AwardNotification { id: string; title: string; kind: 'achievement' | 'reward' }
export interface InlineRecord { first: ExerciseResult; final?: ExerciseResult; correctionUsed: boolean; rubricVersion?: number }
export interface Progress { version: 1; theme: Theme; inline: Record<string, InlineRecord>; active: QuizAttempt | null; latest: QuizAttempt | null; best: { first: number; final: number } | null; gamification: GameState }
export const defaultProgress = (): Progress => ({ version: 1, theme: 'dark', inline: {}, active: null, latest: null, best: null, gamification: emptyGame() });
type StoragePort = Pick<Storage, 'getItem' | 'setItem'>;
const knownInline = new Set(Object.values(articleExercises).flat());
export function cleanResult(result: ExerciseResult): ExerciseResult {
  return { exerciseId: result.exerciseId, topicId: result.topicId, score: result.score, status: result.status, breakdown: result.breakdown.map(item => ({ id: item.id, met: item.met, earned: item.earned, weight: item.weight, reason: item.reason })) };
}
function cleanFinal(attempt: QuizAttempt, definitions: ExerciseDefinition[]): QuizAttempt {
  const project = (entries: Record<string, Submission>) => Object.fromEntries(Object.entries(entries).map(([id, item]) => {
    const type = definitions.find(def => def.id === id)?.type;
    const preserve = type && !['CaseStudy', 'PromptSimulator', 'FillTheBlank'].includes(type);
    return [id, { skipped: item.skipped, result: cleanResult(item.result), answer: preserve ? item.answer : null }];
  }));
  return { ...attempt, drafts: {}, primary: project(attempt.primary), corrections: project(attempt.corrections) };
}
function validResult(value: unknown): value is ExerciseResult {
  const item = value as ExerciseResult;
  return !!item && typeof item.exerciseId === 'string' && typeof item.topicId === 'string' && typeof item.score === 'number' && Number.isFinite(item.score) && item.score >= 0 && item.score <= 1 && item.status === (item.score === 1 ? 'correct' : item.score === 0 ? 'incorrect' : 'partial') && Array.isArray(item.breakdown) && item.breakdown.every(row => !!row && typeof row.id === 'string' && typeof row.met === 'boolean' && Number.isFinite(row.earned) && Number.isFinite(row.weight) && row.earned >= 0 && row.weight >= 0 && row.earned <= row.weight && ['matched', 'missing', 'wrong', 'forbidden', 'tooShort', 'overBudget'].includes(row.reason)) && new Set(item.breakdown.map(row => row.id)).size === item.breakdown.length;
}
function validAnswer(value: unknown): value is ExerciseAnswer {
  return value === null || typeof value === 'string' || typeof value === 'boolean'
    || (Array.isArray(value) ? value.every(item => typeof item === 'string')
      : typeof value === 'object' && Object.values(value).every(item => typeof item === 'string'));
}
function projectAnswer(value: ExerciseAnswer): ExerciseAnswer {
  return Array.isArray(value) ? [...value] : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)) : value;
}
function projectAttempt(item: QuizAttempt): QuizAttempt {
  const submissions = (entries: Record<string, Submission>) => Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, {
    answer: projectAnswer(entry.answer), skipped: entry.skipped,
    result: { ...cleanResult(entry.result), breakdown: entry.result.breakdown.map(row => ({ ...cleanResult({ ...entry.result, breakdown: [row] }).breakdown[0]!, ...(typeof row.quote === 'string' ? { quote: row.quote } : {}) })) },
  }]));
  return {
    id: item.id, seed: item.seed, contentVersion: item.contentVersion, ids: [...item.ids], phase: item.phase, position: item.position,
    ...(item.presentationVersion === 1 ? { presentationVersion: 1 as const } : {}),
    drafts: Object.fromEntries(Object.entries(item.drafts).filter(([id]) => item.ids.includes(id)).map(([id, answer]) => [id, projectAnswer(answer)])),
    primary: submissions(item.primary), corrections: submissions(item.corrections),
  };
}
function validAttempt(value: unknown): value is QuizAttempt {
  const item = value as QuizAttempt;
  if (item?.presentationVersion !== undefined && item.presentationVersion !== 1) return false;
  if (!item || typeof item.id !== 'string' || !Number.isInteger(item.seed) || !Number.isInteger(item.contentVersion) || !Array.isArray(item.ids) || item.ids.length !== 12 || new Set(item.ids).size !== 12 || !item.ids.every(id => typeof id === 'string') || !['primaryInProgress', 'correctionInProgress', 'finalComplete'].includes(item.phase) || !Number.isInteger(item.position) || item.position < 0 || item.position >= 12 || !item.drafts || !item.primary || !item.corrections) return false;
  if (typeof item.drafts !== 'object' || Array.isArray(item.drafts) || !Object.entries(item.drafts).every(([id, answer]) => !item.ids.includes(id) || validAnswer(answer))) return false;
  for (const entries of [item.primary, item.corrections]) {
    if (typeof entries !== 'object' || Array.isArray(entries)) return false;
    for (const [id, entry] of Object.entries(entries)) if (!item.ids.includes(id) || !entry || !validAnswer(entry.answer) || !validResult(entry.result) || entry.result.exerciseId !== id || typeof entry.skipped !== 'boolean') return false;
  }
  return (item.phase === 'primaryInProgress' || item.ids.every(id => item.primary[id])) && consistentAttempt(item, quizBank);
}
function parse(raw: string): Progress {
  const input = JSON.parse(raw) as Progress;
  if (!input || input.version !== 1 || !['dark', 'light'].includes(input.theme) || !input.inline || typeof input.inline !== 'object' || Array.isArray(input.inline)) throw Error('Invalid root');
  const state = defaultProgress(); state.theme = input.theme;
  for (const [id, record] of Object.entries(input.inline)) {
    if (!knownInline.has(id)) continue;
    if (!record || !validResult(record.first) || (record.final !== undefined && !validResult(record.final)) || typeof record.correctionUsed !== 'boolean') throw Error('Invalid inline');
    const definition = inlineExercises.find(def => def.id === id)!;
    if (record.first.exerciseId !== id || record.first.topicId !== definition.topicId || record.correctionUsed !== (record.final !== undefined)
      || (record.correctionUsed && record.first.score === 1) || (record.final && (record.final.exerciseId !== id || record.final.topicId !== definition.topicId))) throw Error('Inconsistent inline');
    if (record.rubricVersion !== undefined && (!Number.isInteger(record.rubricVersion) || record.rubricVersion < 1)) throw Error('Invalid rubric version');
    state.inline[id] = { first: cleanResult(record.first), ...(record.final ? { final: cleanResult(record.final) } : {}), correctionUsed: record.correctionUsed, ...(record.rubricVersion !== undefined ? { rubricVersion: record.rubricVersion } : {}) };
  }
  for (const key of ['active', 'latest'] as const) {
    if (input[key] !== null && input[key] !== undefined) {
      if (!validAttempt(input[key]) || (key === 'latest' ? input[key]!.phase !== 'finalComplete' : input[key]!.phase === 'finalComplete')) throw Error('Invalid attempt');
      const attempt = projectAttempt(input[key]!);
      state[key] = key === 'latest' ? cleanFinal(attempt, attempt.contentVersion === CONTENT_VERSION ? quizBank : []) : attempt;
    }
  }
  if (input.best) {
    if (![input.best.first, input.best.final].every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100)) throw Error('Invalid best');
    state.best = { first: input.best.first, final: input.best.final };
  }
  if (input.gamification?.catalogVersion === 1 && Array.isArray(input.gamification.awardedXpKeys) && Array.isArray(input.gamification.unlockedAchievementIds)) state.gamification = { catalogVersion: 1, awardedXpKeys: [...new Set(input.gamification.awardedXpKeys.filter(key => Object.hasOwn(xpCatalog, key)))], unlockedAchievementIds: [...new Set(input.gamification.unlockedAchievementIds.filter(id => achievements.some(item => item.id === id)))] };
  return state;
}
export function createProgressStore(storage?: StoragePort) {
  let state = defaultProgress();
  let warning = storage ? '' : 'Браузер не разрешает сохранение. Прогресс доступен только пока открыта страница.';
  let persistent = !!storage;
  let notifications: readonly AwardNotification[] = [];
  const listeners = new Set<() => void>();
  const closed = new Set<string>();
  try { const raw = storage?.getItem(PROGRESS_KEY); if (raw) state = parse(raw); }
  catch { warning = 'Локальные данные недоступны или повреждены. Используется новое состояние в памяти.'; persistent = false; }
  if (state.latest) closed.add(state.latest.id);
  const update = (next: Progress) => {
    const newAchievements = achievements.filter(item => next.gamification.unlockedAchievementIds.includes(item.id) && !state.gamification.unlockedAchievementIds.includes(item.id));
    const previousXp = xpTotal(state.gamification); const nextXp = xpTotal(next.gamification);
    const newRewards = rewards.filter(item => previousXp < item.threshold && nextXp >= item.threshold);
    if (newAchievements.length || newRewards.length) notifications = [...notifications,
      ...newAchievements.map(item => ({ id: item.id, title: item.title, kind: 'achievement' as const })),
      ...newRewards.map(item => ({ id: item.id, title: item.title, kind: 'reward' as const })),
    ];
    state = next;
    if (persistent) { try { storage!.setItem(PROGRESS_KEY, JSON.stringify(next)); } catch { persistent = false; warning = 'Браузер не разрешает сохранение. Прогресс доступен только пока открыта страница; удаление старых данных не подтверждено.'; } }
    else if (!warning) warning = 'Прогресс доступен только в памяти этой страницы.';
    listeners.forEach(listener => listener());
  };
  return {
    getSnapshot: () => state,
    getWarning: () => warning,
    getNotifications: () => notifications,
    dismissNotification(id: string) {
      notifications = notifications.filter(item => item.id !== id);
      listeners.forEach(listener => listener());
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setTheme(theme: Theme) { update({ ...state, theme }); return persistent; },
    reset() { if (state.active) closed.add(state.active.id); notifications = []; update({ ...defaultProgress(), theme: state.theme }); },
    discardActive() { if (state.active) closed.add(state.active.id); update({ ...state, active: null }); },
    restartOutdatedInline(id: string) {
      const def = inlineExercises.find(item => item.id === id);
      const record = state.inline[id];
      if (!def || !record || record.first.score === 1 || record.correctionUsed || (record.rubricVersion ?? 1) === rubricVersion(def)) return false;
      const inline = { ...state.inline }; delete inline[id];
      update({ ...state, inline });
      return true;
    },
    saveInline(id: string, record: InlineRecord) {
      if (!knownInline.has(id)) return;
      const version = rubricVersion(inlineExercises.find(item => item.id === id)!);
      const previous = state.inline[id];
      if (previous && (previous.rubricVersion ?? 1) !== version) return;
      const inline = { ...state.inline, [id]: { first: cleanResult(record.first), ...(record.final ? { final: cleanResult(record.final) } : {}), correctionUsed: record.correctionUsed, rubricVersion: version } };
      let gamification = gameReducer(state.gamification, { type: 'inlineSubmitted', exerciseId: id });
      for (const [articleId, ids] of Object.entries(articleExercises)) if (ids.every(key => inline[key])) gamification = gameReducer(gamification, { type: 'articleCompleted', articleId });
      update({ ...state, inline, gamification });
    },
    saveQuiz(attempt: QuizAttempt, definitions: ExerciseDefinition[]) {
      if (closed.has(attempt.id)) return;
      let gamification = state.gamification;
      if (Object.keys(attempt.primary).length === 12) gamification = gameReducer(gamification, { type: 'quizPrimaryCompleted' });
      const result = percentages(attempt);
      if (!result) { update({ ...state, active: attempt, gamification }); return; }
      closed.add(attempt.id);
      gamification = gameReducer(gamification, { type: 'quizFinalCompleted', firstPercent: result.first, finalPercent: result.final, results: attempt.ids.map(id => (attempt.corrections[id] ?? attempt.primary[id])!.result), definitions });
      update({ ...state, active: null, latest: cleanFinal(attempt, definitions), best: { first: Math.max(result.first, state.best?.first ?? 0), final: Math.max(result.final, state.best?.final ?? 0) }, gamification });
    },
  };
}
let singleton: ReturnType<typeof createProgressStore> | undefined;
export function browserStore() {
  if (singleton) return singleton;
  try { singleton = createProgressStore(window.localStorage); } catch { singleton = createProgressStore(); }
  return singleton;
}
