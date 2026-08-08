# Prompt Engineering Academy Implementation Plan

> **Для agentic workers:** при отдельном разрешении на реализацию использовать `superpowers:subagent-driven-development` или `superpowers:executing-plans`; выполнять задачи последовательно с review gates. Этот документ не является разрешением на изменение кода, commit, push или deploy.

**Goal:** построить статический интерактивный образовательный портал из шести статей, десяти типов упражнений и двухфазного итогового теста.

**Architecture:** Astro отвечает за статические страницы и MDX; автономные React-острова обслуживают inline-упражнения, а один React-остров — весь тест. Scoring и прогресс реализуются чистыми TypeScript-модулями; persistence изолирован в versioned localStorage adapter.

**Tech Stack:** Astro, React, TypeScript, Vitest, React component testing, Playwright, accessibility tooling после актуальной проверки зависимостей.

## Global constraints

- Выполнять все MUST из [REQUIREMENTS.md](REQUIREMENTS.md).
- Не реализовывать OPEN-область до принятия соответствующего решения из [DECISIONS.md](DECISIONS.md).
- Нет backend, БД, регистрации, настоящего AI и secrets.
- Все поведения доступны с клавиатуры; drag имеет кнопочную альтернативу.
- Любая implementation task начинается с failing/absent-behaviour test и заканчивается свежей проверкой.
- Commit/push/deploy выполняются только по отдельному прямому запросу пользователя.

## Планируемая карта файлов

| Область | Ответственность |
|---|---|
| `src/content/articles/*.mdx` | Шесть статей и inline references |
| `src/data/exercises/*` | 18 inline definitions |
| `src/data/quiz/*` | Bank из 24 definitions |
| `src/domain/exercises/*` | Discriminated unions и validation |
| `src/domain/scoring/*` | Детерминированные evaluators |
| `src/domain/quiz/*` | Selection и state transitions |
| `src/domain/progress/*` | Completion и recommendations |
| `src/domain/gamification/*` | XP/achievements/rewards после решения |
| `src/storage/*` | Versioned localStorage adapter |
| `src/components/exercises/*` | ExerciseShell и 10 editors |
| `src/components/quiz/*` | Runner, review, result |
| `src/islands/*` | InlineExerciseIsland и QuizIsland |
| `src/pages/*` | Главная, статьи, quiz, about |
| `src/styles/*` | Tokens/themes/styles после CSS decision |
| `tests/unit/*` | Scoring, selection, storage, ranks |
| `tests/component/*` | 10×2 mode matrix и accessibility states |
| `tests/e2e/*` | User journeys, responsive, recovery, release smoke |

## Phase 0 — Decision gates

**Goal:** не кодировать отложенные решения как случайные предположения.

### Task 0.1 — Закрыть component architecture decision

**Documents:** `docs/DECISIONS.md`, `docs/specs/02-exercise-system.md`, `docs/TECH_SPEC.md`.

- [ ] Получить подтверждение composition + typed contract или отдельное требование о наследовании.
- [ ] Перевести `OPEN-ARCH-001` в `ACCEPTED` и обновить ссылки.
- [ ] Проверить, что component plan использует только утверждённый вариант.

**Validation:** `OPEN-ARCH-001` отсутствует среди blockers и ни один документ не содержит противоположной архитектуры.

### Task 0.2 — Закрыть visual/CSS decisions

**Documents:** `docs/DECISIONS.md`, `docs/specs/01-experience.md`.

- [ ] Утвердить палитру, типографику, карточки, SVG-style и motion.
- [ ] Утвердить plain CSS/CSS Modules или другой подход.
- [ ] Зафиксировать reset behaviour для theme preference.

**Validation:** обе темы имеют проверяемые tokens/contrast states; `OPEN-UX-001/002` закрыты.

### Task 0.3 — Закрыть DnD и gamification decisions

**Documents:** `docs/DECISIONS.md`, specs `02` и `04`.

- [ ] Актуально проверить и выбрать DnD средство либо собственную реализацию.
- [ ] Утвердить XP formula, achievement catalog и reward catalog.
- [ ] Для каждого игрового правила записать event, повторяемость и acceptance example.

**Validation:** `OPEN-DND-001` и `OPEN-GAM-001` закрыты, catalogs однозначно тестируемы.

## Phase 1 — Project foundation

**Demo:** статический Astro shell открывает главную, пустые article routes, quiz placeholder и about; typecheck/build проходят.

### Task 1.1 — Scaffold Astro + React + TypeScript

**Files:** создать package manifest, Astro/TypeScript configs, `src/pages`, `src/layouts`, `src/islands` и test configs.

- [ ] До установки проверить реальные Node.js и npm executables и версии.
- [ ] Создать минимальный Astro project с React и MDX integrations.
- [ ] Включить strict TypeScript и команды typecheck/build/test.
- [ ] Добавить failing smoke expectation для обязательных routes.
- [ ] Создать routes/layouts и довести smoke test до PASS.

**Validation:** typecheck PASS; production build PASS; четыре категории routes доступны в preview.

### Task 1.2 — Создать design tokens и темы

**Dependencies:** Task 0.2, Task 1.1.

- [ ] Добавить tests theme toggle/persistence/contrast states.
- [ ] Создать утверждённые semantic tokens и light/dark mappings.
- [ ] Реализовать first-load и persisted preference.
- [ ] Проверить reduced motion и 360/768/1440 layouts shell.

**Validation:** `UX-001`, `UX-002`, `UX-AC-004/005` PASS.

## Phase 2 — Exercise domain and scoring

**Demo:** fixtures всех десяти типов валидируются и получают детерминированный score без React.

### Task 2.1 — Domain types и validation

**Files:** `src/domain/exercises/*`, `tests/unit/exercise-validation.*`, fixtures.

**Produces:** `ExerciseDefinition`, `ExerciseAnswer`, `ExerciseResult`, `ExerciseMode`, definition validator.

- [ ] Создать invalid fixtures для каждого правила validation.
- [ ] Подтвердить RED из-за отсутствующих validators.
- [ ] Реализовать discriminated union и validation.
- [ ] Подтвердить PASS valid fixtures и FAIL invalid fixtures с exercise ID.

### Task 2.2 — Basic scoring

**Files:** `src/domain/scoring/*`, unit tests.

- [ ] Добавить boundary tables для MultipleChoice, MatchPairs, FillTheBlank, TrueFalse и OrderSteps.
- [ ] Подтвердить RED.
- [ ] Реализовать pure evaluators и normalization.
- [ ] Проверить determinism, immutability и score range 0–1.

**Validation:** `SCR-001`–`SCR-003` PASS.

### Task 2.3 — Advanced/custom scoring

**Files:** advanced evaluator modules и tests.

- [ ] Создать fixtures weak/partial/full и invalid config для пяти типов.
- [ ] Реализовать CaseStudy rubric, simulator tier, hallucination penalty, builder breakdown и ContextBudget utility.
- [ ] Проверить отсутствие network/storage dependencies.

**Validation:** `SCR-004`, `SCR-005`, `EX-007`, `EX-008`, `EX-AC-003/004` PASS.

## Phase 3 — Exercise UI library

**Demo:** gallery отображает десять компонентов в inline и quiz wrappers; все выполняются keyboard-only.

### Task 3.1 — Shared shell and mode adapters

**Dependencies:** Task 0.1, Phase 2.

**Produces:** `ExerciseShell`, inline adapter, quiz adapter, common feedback and result views.

- [ ] Создать component tests states/modes/focus/live regions.
- [ ] Реализовать общий shell и composition contract.
- [ ] Проверить, что quiz primary adapter не раскрывает result.

### Task 3.2 — Five basic editors

- [ ] Для каждого типа сначала добавить interaction/accessibility tests.
- [ ] Реализовать editor без бизнес-scoring внутри UI.
- [ ] Проверить inline/quiz parameterized matrix.

### Task 3.3 — Five advanced/custom editors

- [ ] Добавить tests свободного ввода, claim selection, block builder и budget state.
- [ ] Реализовать пять editors и подготовленные simulator responses.
- [ ] Проверить disclosure текста об эвристической оценке.

### Task 3.4 — DnD and alternatives

**Dependencies:** Task 0.3.

- [ ] Добавить keyboard/button/touch-oriented tests до drag implementation.
- [ ] Реализовать утверждённый drag layer как дополнительный input path.
- [ ] Проверить, что отключение drag не меняет достижимый result.

**Validation Phase 3:** `EX-001`–`EX-008`, `A11Y-001`, `EX-AC-001/002/005` PASS.

## Phase 4 — Content and learning route

**Demo:** шесть статей доступны с главной, содержат 18 работающих inline exercises и сохраняют completion.

### Task 4.1 — Content collections and cross-reference validation

- [ ] Создать tests exact topic/slug set, word range и 3 IDs per article.
- [ ] Реализовать metadata schema и ID cross-reference validation.
- [ ] Проверить, что unknown ID останавливает build.

### Task 4.2 — Six article missions

- [ ] Исследовать актуальные первичные источники по каждой теме.
- [ ] Написать шесть MDX-статей в согласованной структуре.
- [ ] Разместить ссылки рядом с важными утверждениями.
- [ ] Добавить 18 definitions и inline references.
- [ ] Выполнить word-count, source relevance и editorial review.

### Task 4.3 — Route map and completion

- [ ] Добавить E2E свободной навигации и completion после трёх attempts.
- [ ] Реализовать главную карту/каталог и article navigation.
- [ ] Добавить SVG/CSS-схемы с text alternatives.
- [ ] Проверить, что wrong answer не блокирует чтение.

**Validation:** `NAV-001`–`NAV-004`, `CNT-001`–`CNT-006`, `CNT-AC-001`–`CNT-AC-006` PASS.

## Phase 5 — Quiz, persistence and recommendations

**Demo:** пользователь проходит две фазы теста, reload сохраняет состояние, result показывает два балла и рекомендации.

### Task 5.1 — Bank and seeded selector

- [ ] Создать 24 definitions и validation/property tests.
- [ ] Реализовать seeded selection с инвариантами.
- [ ] Проверить множество seed и невозможную bank fixture.

### Task 5.2 — Quiz reducer and two-phase flow

- [ ] Написать transition tests всех разрешённых/запрещённых переходов.
- [ ] Реализовать reducer, first snapshot, correction eligibility и finalization.
- [ ] Проверить immutable primary state и one-correction limit.

### Task 5.3 — Versioned storage adapter

- [ ] Добавить tests valid, unknown fields, corrupt JSON, unsupported version и thrown storage.
- [ ] Реализовать load/save/reset/recovery через единственный adapter.
- [ ] Проверить отсутствие full history.

### Task 5.4 — Quiz UI and recommendations

- [ ] Добавить E2E primary secrecy, hint, correction, answer key и threshold.
- [ ] Реализовать QuizIsland, progress, review и result.
- [ ] Реализовать topic recommendations из result breakdown.
- [ ] Проверить reload на каждой фазе.

**Validation:** обязательные `QUIZ-001`–`QUIZ-003`, `QUIZ-005`–`QUIZ-008`, `PRG-001`–`PRG-003` и `QPG-AC-001`–`QPG-AC-007` PASS; отклонение от ориентира `QUIZ-004` документировано.

## Phase 6 — Gamification

**Demo:** утверждённые XP, достижения и награды детерминированно разблокируются и восстанавливаются после reload.

### Task 6.1 — Gamification domain

**Dependencies:** закрытый `OPEN-GAM-001`, Phase 5.

- [ ] Создать test case для каждой catalog entry.
- [ ] Реализовать pure event-to-state rules и rank boundaries.
- [ ] Проверить запрет повторного начисления там, где он указан.

### Task 6.2 — Gamification UI and persistence

- [ ] Добавить component/E2E tests locked/unlocked/reward/reload.
- [ ] Реализовать XP summary, achievement/reward UI и success motion.
- [ ] Проверить reduced motion и storage recovery.

**Validation:** `GAM-001`, `GAM-002`, `QPG-AC-008` PASS.

## Phase 7 — Quality, documentation and release

**Demo:** clean production build и опубликованный GitHub Pages URL проходят полный smoke flow.

### Task 7.1 — Full local quality gates

- [ ] Выполнить typecheck, content validation, unit, component, E2E и accessibility suites.
- [ ] Исправлять только подтверждённые defects; не расширять scope.
- [ ] Провести manual Edge и responsive review.
- [ ] Сформировать requirement-to-test evidence.

### Task 7.2 — Final README

- [ ] Добавить точные prerequisites, commands, architecture и walkthrough.
- [ ] Проверить README на clean checkout.
- [ ] Удалить устаревшую формулировку «код ещё не создан».

### Task 7.3 — GitHub Pages release

**Dependencies:** закрытый `OPEN-REL-001`, отдельное разрешение на Git/GitHub actions.

- [ ] Инициализировать/опубликовать repository только после разрешения.
- [ ] Настроить утверждённый base path и deployment method.
- [ ] Проверить production URL, direct routes, reload и console.
- [ ] Зафиксировать deployed revision и rollback method.

**Validation:** все gates из spec `05` PASS; опубликованный URL соответствует release revision.

## Итоговая traceability-проверка

- [ ] Каждый MUST из REQUIREMENTS связан минимум с одной задачей и тестом.
- [ ] Нет реализованного OPEN без решения.
- [ ] Нет возможного улучшения в MVP без нового requirement.
- [ ] Все документы отражают фактическое поведение.
- [ ] Git status и внешние действия соответствуют последнему разрешению пользователя.
