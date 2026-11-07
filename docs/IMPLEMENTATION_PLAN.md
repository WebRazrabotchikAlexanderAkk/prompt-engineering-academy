# Prompt Engineering Academy Implementation Plan

## Завершение локального MVP, 2026-10-10

Текущая задача пользователя: самостоятельно завершить платформу, исправить подтверждённые ошибки и сверить результат с исходным заданием. Интервью остановлено. Git-запись и внешняя публикация остаются отдельным этапом по DEC-036.

- [x] Повторно сверить исходную задачу: 6 статей, 18 встроенных заданий, 10 типов, банк 24, итоговый тест 12 вопросов, общая архитектура двух режимов.
- [x] Исправить зелёные состояния текущего и завершённого узла маршрута; доступность остальных разделов не ограничивать.
- [x] Показывать предупреждение при запрете доступа к хранилищу до первого действия; проверить работу без сохранения.
- [x] Устранить повтор минимального числа слов и ошибку согласования в описании токена; оценивание не менять.
- [x] Добавить воспроизводимые проверки изоляции сбоя одного острова, безопасного вывода текста, чтения без JavaScript и границ оценивания/хранения.
- [x] Завершить пятый цикл GAM-005: убрать перекрытие пояснения и кнопки исправления уведомлением о награде; проверить обе высоты узкого экрана и оба режима движения. Цикл 6 устранил диагностику типов, без изменения поведения.
- [x] Вынести рабочую область итогового теста из колонки вводной прозы; проверить вопрос и финальный разбор на 360/768/1440 в обеих темах.
- [x] Исключить четыре предупреждения косвенных зависимостей совместимыми обновлениями; прямой стек не менять, подтвердить чистую установку.
- [x] Исправить выявленный независимым обзором контракт Node.js и синхронизировать основную установку по lock; усилить проверку фактических версий, 10/10 адресных и 273/273 полного модульного набора.
- [x] По подтверждённому стеку отключить необязательную панель разработки Astro, которая не обрабатывала запрет хранилища; сохранить строгую проверку ошибок страницы.
- [x] Завершить последний полный повтор после синхронизации основной установки: 273/273 модульных/компонентных, 100/100 браузерных, готовая сборка 1/1; статическая проверка дважды успешна после раскрытого файлового отказа среды.
- [x] Завершить визуальную ведомость, проверить инструкцию запуска в чистой изолированной копии, оформить актуальный протокол приёмки: [FINAL_ACCEPTANCE.md](FINAL_ACCEPTANCE.md).
- [ ] Отдельный этап: публикация и проверка GitHub Pages после прямого запроса пользователя.

Разделы ниже сохраняют историю реализации и проверки. Их прежние числа и открытые отметки не являются текущим статусом; текущий результат находится в [FINAL_ACCEPTANCE.md](FINAL_ACCEPTANCE.md), включая пределы проверки и неустановленную причину единичного файлового отказа. Следующий отдельный этап – внешний выпуск.

## Изменение по пользовательской приёмке, 2026-10-08

- [x] DEC-038: расширить упражнения до 1000px, сохранить колонку чтения 70ch, ориентировать компоновку MatchPairs на ширину компонента.
- [x] Один реальный заголовок механизма, разные подписи рукояток, сохранённые кнопки и клавиатура.
- [x] Устранить зависимость положения временной копии от динамических стилей библиотеки; добавить тест промежуточного состояния и покадровых переносов.
- [x] Итоговая техническая перепроверка DEC-038: типы без диагностик, 248/248 модульных/компонентных тестов, 9 страниц, 18/18 браузерных сценариев, затем 15/15 усиленных повторных проверок переноса; протокол в IMPLEMENTATION_AUDIT.
- Историческое ограничение доказательств: точная причина прежнего скачка на 79px не установлена по покадровой записи исходного жеста. Не выдавать защиту промежуточного состояния за доказательство этой прошлой причины. Текущая геометрия после DEC-039 проверена отдельно и принята пользователем.

- [x] DEC-037: заменить MatchPairs интерфейсом «Одна пара за раз» в общем редакторе статей и итогового теста.
- [x] Сохранить оценщик, формат сохранённого ответа и единственное исправление; обновить тесты под кнопочную навигацию и назначение.
- [x] Использовать локальный DragAdapter и библиотечную копию DragOverlay без автопрокрутки MatchPairs; не менять другие типы.
- [x] Проверить типы, модульные/компонентные тесты, сборку, перенос и обе фазы проверки; правила приёмки в EX-AC-017 и DND-SCROLL-01/02/03.
- [x] Пользователь принял исправление основного интерфейса после DEC-039: «Правки приняты замечаний нет». Это не даёт разрешение на публикацию.

> **Для agentic workers:** при отдельном разрешении на реализацию использовать `superpowers:subagent-driven-development` или `superpowers:executing-plans`; выполнять задачи последовательно с review gates. Этот документ не является разрешением на изменение кода, commit, push или deploy.

**Goal:** построить статический интерактивный образовательный портал из шести статей, десяти типов упражнений и двухфазного итогового теста.

**Architecture:** Astro отвечает за статические страницы и MDX; автономные React-острова обслуживают inline-упражнения, а один React-остров — весь тест. Scoring и прогресс реализуются чистыми TypeScript-модулями; persistence изолирован в versioned localStorage adapter.

**Tech Stack:** Astro, React, TypeScript, Vitest, React component testing, Playwright, accessibility tooling после актуальной проверки зависимостей.

## Global constraints

### Актуальный остаток после решения о браузерах, 2026-09-23

Проверка других браузеров исключена из MVP по DEC-MVP-BROWSER-001. Исторические статусы ниже не заменяют актуальную сверку в `IMPLEMENTATION_AUDIT.md`. Уже проверенные сборки, ссылки, редакционные правки и основные сценарии теста не повторять без затрагивающих их изменений.

1. **GAM-005, Task 6.2 – уведомления новых достижений реализованы 2026-09-24.** Единая очередь новых достижений/эмблем, закрытие, возврат фокуса, отсутствие повторения после перезагрузки, статичный вариант при уменьшении движения. Проверки и их пределы приведены в актуальной сверке.
2. **EX-006 – перетаскивание, закрыто в проверенном объёме.** Проверены мышь/эмулированное касание, отмена, фокус, сообщения и блокировка перетаскивания для трёх типов с клавиатурной альтернативой в тесте. На 2026-09-26 дополнительно пройден полный цикл встроенного упражнения каждого типа при 360 px, включая исправление и перезагрузку: адресный набор 12/12. Физический сенсорный экран не проверялся. Подробности в `IMPLEMENTATION_AUDIT.md`.
3. **Адресные пробелы SCR/QUIZ проверены в указанном объёме.** На 2026-09-26 проверены числовые границы, прогресс, сброс, рекомендации, все десять типов в двух режимах на уровне компонента и в браузере с клавиатурой, независимые latest/best, точные примеры IV-09–IV-15, частичный 0,99999, досрочный финал, браузерная смена активного теста, очистка текста после финала, встроенного исправления и общего сброса, а также две разные слабые темы и результат без ошибок. Код приложения в адресном проходе не менялся. Свежий полный `npm run check`: 217/217, 87 файлов без диагностик, 9 страниц. Полный Edge: сначала 61/62 из-за непостоянного результата геометрии уведомления, затем адресно 3/3 и повтор полного набора 62/62. Пределы доказательств и карта IV-01–IV-21 приведены в `IMPLEMENTATION_AUDIT.md`; все возможные сочетания браузерных состояний не объявлены проверенными.
4. **Следующий шаг:** завершить визуальную приёмку и доступность оставшихся состояний, уведомлений, уменьшения движения и сравнение с эталоном; проверить требования к стилям и технические ограничения. Отдельно исследовать непостоянный результат геометрической проверки уведомления; не считать успешный повтор доказательством его устранения и не начинать автоматический новый цикл исправления GAM-005 без решения пользователя.
5. Проверить инструкцию запуска на чистой копии, окончательно свести критерии и результаты.
6. После локальной приёмки и отдельного запроса на точный объём внешних действий – публикация по `DEC-036` и проверка опубликованного адреса.

Дополнение 2026-09-24: третий и четвёртый циклы отдельно разрешены пользователем. Проверка пустого ответа исправлена; потеря контраста устранена удалением анимации прозрачности, движение 320 мс и уменьшение движения сохранены. Проверены пять кадров в обеих темах; общий последовательный запуск Edge – 24/24. Следующий этап – EX-006, перетаскивание. Подробности и пределы проверки в `IMPLEMENTATION_AUDIT.md`.

### Фактическое состояние на 2026-09-21

Подробная сверка каждого требования, доказательств и остатка: [IMPLEMENTATION_AUDIT.md](IMPLEMENTATION_AUDIT.md). Старые незакрытые пункты ниже являются планом приёмки, а не утверждением об отсутствии кода.

| Этап | Фактическое состояние |
|---|---|
| 0. Решения | Локальная архитектура и параметры публикации утверждены; внешний выпуск остаётся отдельным действием |
| 1. Основа | Реализована; проверка типов и сборка работают |
| 2. Оценивание | Реализовано; полная матрица граничных случаев ещё не принята |
| 3. Упражнения | 10 типов реализованы; полная проверка перетаскивания и состояний остаётся |
| 4. Контент и маршрут | 6 статей, 18 упражнений, живые статусы и схемы; редакционная проверка не завершена |
| 5. Тест и хранение | Реализованы основные сценарии, устойчивое перемешивание и строгая проверка восстановления; полная матрица остальных критериев этапа остаётся в сверке |
| 6. Награды | Каталог и расчёт реализованы; анимация новых достижений и полная матрица не завершены |
| 7. Приёмка и релиз | Частичные локальные доказательства; полная приёмка и публикация не выполнены |

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
| `src/domain/gamification/*` | XP/achievements/rewards по DEC-023 |
| `src/storage/*` | Versioned localStorage adapter |
| `src/components/exercises/*` | ExerciseShell и 10 editors |
| `src/components/quiz/*` | Runner, review, result |
| `src/islands/*` | InlineExerciseIsland и QuizIsland |
| `src/pages/*` | Главная, статьи, quiz, about |
| `src/styles/tokens.css` | Semantic variables и light/dark mappings |
| `src/styles/global.css` | Reset, base, focus и MDX typography |
| `tests/unit/*` | Scoring, selection, storage, ranks |
| `tests/component/*` | 10×2 mode matrix и accessibility states |
| `tests/e2e/*` | User journeys, responsive, recovery, release smoke |

## Перенос интервью перед реализацией

Решения DEC-024–DEC-031 перенесены в требования, spec 02 (упражнения), spec 04 (тест и хранение) и проверки IV-01–IV-21. Основная реализация создана; полное исполнение всех перечисленных проверок ещё не завершено. Текущее покрытие указано в сверке реализации.

- Phase 2: рубрики, нормализация и формулы spec 02; IV-09–IV-15 и QA-RULE-01–QA-RULE-06.
- Phase 3: ввод, попытки и раскрытие spec 02; IV-07/08, QA-RULE-07/08.
- Phase 4: подготовить справки, эталоны, три ответа каждого симулятора и применимые пояснения; проверить достижимость score=1 и альтернативные решения.
- Phase 5: реализовать пропуск, неизменяемые отправки, одну коррекцию с заменой, оба балла только в финале; IV-01–IV-06 и IV-21.
- Phase 5 storage: отдельные проекции active/inline/final, очистка текста и восстановление; IV-16–IV-20.
- Phase 6: повторно проверить существующий каталог наград на округлённых итогах и однократность автоматических переходов.
- Параметры публикации утверждены в `DEC-036`; интервью не разрешает commit/push/deploy.

## Phase 0 — Decision gates

**Goal:** не кодировать отложенные решения как случайные предположения.

### Task 0.1 — Зафиксировать component architecture decision — завершено

**Documents:** `docs/DECISIONS.md`, `docs/specs/02-exercise-system.md`, `docs/TECH_SPEC.md`.

- [x] Получено подтверждение composition + typed contract без буквального наследования классов.
- [x] `OPEN-ARCH-001` переведён в `RESOLVED`; принято `DEC-018`, обновлены ссылки.
- [x] Component plan использует общий shell, специализированные editors и pure evaluators через registry.

**Validation:** `OPEN-ARCH-001` отсутствует среди blockers; `DEC-018` и `EX-009` однозначно фиксируют утверждённую архитектуру.

### Task 0.2 — Закрыть visual/CSS decisions — завершено

**Documents:** `docs/DECISIONS.md`, `docs/specs/01-experience.md`.

- [x] Утвердить палитру, типографику, surfaces, SVG/icon style и motion; принято `DEC-019`, `OPEN-UX-001` закрыт.
- [x] Утвердить global tokens/base + Astro scoped styles + React CSS Modules; принято `DEC-021`, `OPEN-UX-002` закрыт.
- [x] Зафиксировать reset behaviour: theme preference сохраняется; принято `DEC-020`, `OPEN-UX-003` закрыт.

**Validation:** `OPEN-UX-001/002/003` находятся среди `RESOLVED`; `DEC-019`–`DEC-021` и `UX-AC-006`–`UX-AC-011` однозначно задают visual, reset и styling contracts.

### Task 0.3 — Закрыть DnD decision gate — завершено

**Documents:** `docs/DECISIONS.md`, `docs/REQUIREMENTS.md`, `docs/TECH_SPEC.md`, specs `02` и `docs/TEST_PLAN.md`.

- [x] Актуально проверить и выбрать DnD средство: принято `DEC-022`; свежая проверка официальных релизов и точная фиксация версий обязательны перед установкой.

**Validation:** `OPEN-DND-001` находится среди `RESOLVED` по `DEC-022`; DnD contract и `DND-001`–`DND-009` зафиксированы.

### Task 0.4 — Закрыть gamification decision gate — завершено

**Documents:** `docs/DECISIONS.md`, `docs/REQUIREMENTS.md`, spec `04`.

- [x] Утвердить milestone XP formula, achievement catalog и reward catalog; принято `DEC-023`.
- [x] Для каждого игрового правила записать stable ID, event, повторяемость, persistence и acceptance example.

**Validation:** `OPEN-GAM-001` находится среди `RESOLVED` по `DEC-023`; `GAM-001`–`GAM-005`, catalogs и `GM-*` cases однозначно задают поведение.

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

- [ ] Добавить tests theme toggle/persistence/contrast states и сохранения темы при progress reset.
- [ ] Добавить source-contract test для style ownership и запрещённых palette/dependency patterns.
- [ ] Создать `tokens.css`, `global.css`, scoped Astro styles и React CSS Modules по `DEC-021`.
- [ ] Реализовать first-load и persisted preference.
- [ ] Проверить reduced motion и 360/768/1440 layouts shell.

**Validation:** `UX-001`–`UX-005`, `UX-AC-004`–`UX-AC-011` PASS.

## Phase 2 — Exercise domain and scoring

**Demo:** fixtures всех десяти типов валидируются и получают детерминированный score без React.

### Task 2.1 — Domain types и validation

**Files:** `src/domain/exercises/*`, `tests/unit/exercise-validation.*`, fixtures.

**Produces:** `ExerciseDefinition`, `ExerciseAnswer`, `ExerciseResult`, `ExerciseMode`, definition validator.

- [ ] Создать invalid fixtures для каждого правила validation, включая обязательный initialPrompt CaseStudy и SC-CS-02.
- [ ] Подтвердить RED из-за отсутствующих validators.
- [ ] Реализовать discriminated union и validation.
- [ ] Подтвердить PASS valid fixtures и FAIL invalid fixtures с exercise ID.

### Task 2.2 — Basic scoring

**Files:** `src/domain/scoring/*`, unit tests.

- [ ] Добавить boundary tables для MultipleChoice, MatchPairs, FillTheBlank, TrueFalse и OrderSteps.
- [ ] Подтвердить RED.
- [ ] Реализовать pure evaluators и normalization.
- [ ] Проверить determinism, immutability и score range 0–1.

**Validation:** `SCR-001`–`SCR-003`, QA-RULE-01/02 и SC-OS-01 PASS.

### Task 2.3 — Advanced/custom scoring

**Files:** advanced evaluator modules и tests.

- [ ] Создать fixtures weak/partial/full и invalid config для пяти типов.
- [ ] Реализовать CaseStudy rubric, simulator tier, hallucination penalty, builder breakdown и ContextBudget utility.
- [ ] Проверить отсутствие network/storage dependencies.

**Validation:** `SCR-004/005`, `EX-007/008/011/012` в части чистых вычислений, `EX-AC-003/004/012/014/015` в части evaluator, IV-09–IV-15 и QA-RULE-03–QA-RULE-06 PASS. Интерфейсные части принимаются на Phase 3/4.

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
- [ ] Реализовать пять editors и подготовленные simulator responses; CaseStudy показывает плохой исходник и инструкцию улучшения по SC-CS-02.
- [ ] Проверить disclosure текста об эвристической оценке.

### Task 3.4 — DnD and alternatives

**Dependencies:** Task 0.3.

- [ ] Добавить keyboard/button/touch-oriented tests до drag implementation.
- [ ] Реализовать локальный `DragAdapter` на утверждённой линии `@dnd-kit/react` + `@dnd-kit/dom` как дополнительный input path после tests.
- [ ] Проверить эквивалентность answer/result для DnD и button/keyboard paths, включая invalid/cancelled drop, focus, live announcements и disabled state.

**Validation Phase 3:** `EX-001`–`EX-013`, `EX-AC-001`–`EX-AC-016`, IV-07/08, QA-RULE-07/08, DND-001–DND-009 PASS на контрольных данных. Полный контент и восстановление проверяются на Phase 4/5; доступность компонентов по QA-RULE-15.

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
- [ ] Составить таблицу концепция → упражнение → проверяемый элемент по spec 03; выполнить CT-09, включая сверку перечня с текстом каждой статьи.

### Task 4.3 — Route map and completion

- [ ] Добавить E2E свободной навигации и completion после трёх attempts.
- [ ] Реализовать главную карту/каталог и article navigation; общий прогресс по spec 04, QA-RULE-18.
- [ ] Добавить SVG/CSS-схемы с text alternatives.
- [ ] Проверить, что wrong answer не блокирует чтение.

**Validation:** `NAV-001`–`NAV-004`, `CNT-001`–`CNT-007`, `CNT-AC-001`–`CNT-AC-007`, `PRG-005` и QA-RULE-18 в части расчёта/показа PASS. Сохранение проверяется после Phase 5.

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

- [ ] Добавить tests valid, unknown fields, corrupt JSON, unsupported version, thrown storage и reset с сохранением theme preference.
- [ ] Реализовать load/save/reset/recovery через единственный adapter.
- [ ] Проверить отсутствие full history.

### Task 5.4 — Quiz UI and recommendations

- [ ] Добавить E2E primary secrecy, hint, correction, answer key и threshold.
- [ ] Реализовать QuizIsland, progress, review и result; визуальную полосу и текст текущей фазы по spec 01, проверить QZ-PROGRESS-01.
- [ ] Реализовать topic recommendations из result breakdown.
- [ ] Проверить reload на каждой фазе.

**Validation:** обязательные `QUIZ-001`–`QUIZ-003`, `QUIZ-005`–`QUIZ-009`, `PRG-001`–`PRG-005`, `SCR-006`, `QPG-AC-001`–`QPG-AC-007`, `QPG-AC-014`–`QPG-AC-019`, IV-01–IV-06, IV-16–IV-21, QA-RULE-09/10/17/18 PASS; отклонение от ориентира `QUIZ-004` документировано.

## Phase 6 — Gamification

**Demo:** утверждённые XP, достижения и награды детерминированно разблокируются и восстанавливаются после reload.

### Task 6.1 — Gamification domain

**Dependencies:** завершённый Task 0.4 (`DEC-023`), Phase 5.

- [ ] Создать parameterized test для каждой XP/achievement/reward catalog entry и подтвердить максимальные `660 XP`.
- [ ] Реализовать pure event-to-state reducer, stable award keys, derived XP/rewards и rank boundaries.
- [ ] Проверить idempotency, score-dependent gate `finalComplete`, unknown keys и отсутствие полной event history.

### Task 6.2 — Gamification UI and persistence

- [ ] Добавить component/E2E tests locked/unlocked/reward/reload.
- [ ] Реализовать XP summary, achievement/reward UI и success motion.
- [ ] Проверить free navigation, reduced motion, reset/theme и storage recovery без повторного unlock после reload.

**Validation:** `GAM-001`–`GAM-005`, `QPG-AC-008`–`QPG-AC-013` и все `GM-*` cases PASS.

## Phase 7 — Quality, documentation and release

**Demo:** clean production build и опубликованный GitHub Pages URL проходят полный smoke flow.

### Task 7.1 — Full local quality gates

Текущий статус на 2026-09-27: `npm run check` проверил 89 файлов без диагностик, 246/246 модульных и компонентных тестов, 9 страниц сборки. Свежий Edge-набор – 64/64, браузерная проверка готовой сборки во вложенном пути – 1/1; 37 снимков сохранены вне проекта. Автоматические проверки доступности и клавиатуры входят в этот набор. Полная ручная ведомость VIS-01–VIS-09, самостоятельная остановка проверочного сервера в Windows, чистый checkout и затронутые технические правила ещё требуют закрытия. Подробности и ограничения – в `IMPLEMENTATION_AUDIT.md`.

- [x] Выполнить typecheck, content validation, unit, component, E2E и автоматические accessibility suites; ручная ведомость остаётся отдельной задачей.
- [ ] Исправлять только подтверждённые defects; не расширять scope.
- [ ] Провести manual Edge и responsive review.
- [ ] Сформировать requirement-to-test evidence и проверить все технические правила TQ-01–TQ-12 из TECH_SPEC по связанным сценариям TEST_PLAN.

### Task 7.2 — Final README

- [x] Добавить точные prerequisites, commands, architecture и walkthrough.
- [ ] Проверить README на clean checkout.
- [x] Удалить устаревшую формулировку «код ещё не создан».

### Task 7.3 — GitHub Pages release

**Dependencies:** `OPEN-REL-001` закрыт через `DEC-036`; нужны закрытая локальная приёмка и отдельный прямой запрос на внешние действия.

- [ ] Проверить существующий repository/remote и согласовать точный объём внешних действий; повторная инициализация не нужна.
- [ ] Собрать проверенный commit `main` с base path `/prompt-engineering-academy/`, подготовить готовые файлы и `.nojekyll` для корня `gh-pages`.
- [ ] Проверить production URL, direct routes, reload и console.
- [ ] Зафиксировать исходный commit `main` и опубликованный commit `gh-pages`; при откате создавать новый commit с файлами предыдущего проверенного выпуска, не переписывая историю.

**Validation:** все gates из spec `05` PASS; опубликованный URL соответствует release revision.

## Итоговая traceability-проверка

- [ ] Каждый MUST из REQUIREMENTS связан минимум с одной задачей и тестом.
- [ ] Нет реализованного OPEN без решения.
- [ ] Нет возможного улучшения в MVP без нового requirement.
- [ ] Все документы отражают фактическое поведение.
- [ ] Git status и внешние действия соответствуют последнему разрешению пользователя.
