# Technical Specification

## 1. Архитектурная цель

Создать полностью статический Astro-сайт, в котором обычный учебный текст не требует клиентского runtime, inline-упражнения гидратируются как автономные React-острова, а итоговый тест работает внутри одного React-острова с общим состоянием.

Binding requirements: [REQUIREMENTS.md](REQUIREMENTS.md). Решения и открытые вопросы: [DECISIONS.md](DECISIONS.md).

## 2. Технологии

Обязательно:

- Astro — страницы, layouts, routing, MDX и static build.
- React — интерактивные упражнения и тест.
- TypeScript strict mode — контракты, scoring, storage и content data.
- Vitest — unit tests.
- React component testing — поведение компонентов.
- Playwright – E2E и accessibility flows в Microsoft Edge для приёмки MVP; остальные браузеры исключены решением DEC-MVP-BROWSER-001.
- DnD interaction dependencies: текущая линия `@dnd-kit/react` и необходимые напрямую импортируемые API `@dnd-kit/dom`; версии фиксируются точно после свежей проверки официальных релизов. Это interaction dependencies, а не styling dependencies.

Установленные версии зафиксированы в `package.json` и `package-lock.json`; воспроизводимая установка выполняется командой `npm ci`. Прямые версии стека сохранены; при итоговой приёмке совместимые косвенные зависимости обновлены для исключения четырёх выявленных уязвимых диапазонов.

Полная среда проекта учитывает требования компонентных проверок `jsdom`: Node.js `^22.22.2 || ^24.15.0 || >=26.0.0`. Рекомендуемая проверенная ветка – 24.x, фактически использована 24.16.0. Минимум одного Astro не является достаточным контрактом всего проекта. Проверка зависимостей сверяет не только lock, но и реальные установленные версии; после обновления lock требуется `npm ci` перед окончательной приёмкой.

Необязательная панель разработки Astro отключена только для этого проекта через `devToolbar.enabled: false`. Установленная версия панели обращается к `localStorage` без обработки отказа и мешала сценарию запрещённого хранилища. Это не отключает диагностику типов, консоль браузера или проверки ошибок страницы и не меняет поведение опубликованной статической сборки, где панели разработки нет.

## 3. Фактическая структура приложения

Структура сверена с реализованным приложением. Общие редакторы и оценивание используются в обоих режимах; отдельные каталоги UI для теста и наград не требуются.

```text
src/
├── components/
│   └── exercises/        # Общий shell, registry, редакторы, разбор, DragAdapter
├── content/
│   └── articles/         # 6 MDX-статей
├── data/
│   ├── exercises/        # Inline definitions
│   └── quiz/             # Bank из 24 definitions
├── domain/
│   ├── exercises/        # Discriminated unions и result contracts
│   ├── scoring/          # Чистые evaluator functions
│   ├── progress/         # Completion и recommendations
│   ├── quiz/             # Выборка, перемешивание и переходы состояний
│   └── gamification/     # Pure milestone XP/achievement/reward rules
├── islands/              # InlineExerciseIsland, QuizIsland, маршрут, прогресс и уведомления
├── layouts/              # Astro layouts
├── pages/                # Главная, статьи, тест, about
├── storage/              # Versioned localStorage adapter
└── styles/
    ├── tokens.css        # Semantic tokens и light/dark mappings
    └── global.css        # Reset, base, focus и MDX typography
tests/
├── unit/
├── component/
├── e2e/
└── fixtures/
```

## 4. Границы подсистем

### Astro shell

- Владеет статическими маршрутами, metadata, layout и MDX.
- Передаёт React-островам serializable exercise definitions и идентификаторы.
- Не владеет scoring или состоянием попытки.

### Exercise domain

- Владеет общей discriminated union для 10 типов.
- Владеет нормализацией ответов, scoring и breakdown.
- Не зависит от React, DOM, localStorage или конкретной страницы.

### React exercise library

- Использует function components и React composition согласно `DEC-018`.
- Общий `ExerciseShell` владеет повторяемой рамкой взаимодействия и feedback presentation.
- Type-specific editors собирают ответы, а registry сопоставляет discriminant type с editor и evaluator.
- Визуализирует definition и собирает answer.
- Получает режим `inline` или `quiz` через общий публичный контракт.
- Возвращает единый result shape.
- Не записывает глобальный прогресс напрямую.
- Не содержит пользовательской class hierarchy `BaseExercise`; scoring остаётся в Exercise domain.

### Quiz application

- Является одним React-деревом.
- Использует Context + useReducer для state machine.
- Формирует попытку через deterministic seeded selector.
- Делегирует оценивание Exercise domain.

### Gamification domain

- Чистый event-to-state reducer обрабатывает только утверждённые события из `DEC-023` и spec `04`.
- Stable award keys обеспечивают idempotency; неизвестные и duplicate keys не увеличивают XP.
- `xpTotal` вычисляется из валидных award keys и versioned catalog, rewards — из XP thresholds; эти derived values не являются независимыми источниками истины.
- Score-зависимые события принимаются только после `finalComplete`. Gamification не меняет quiz score, rank или доступность маршрутов и не зависит от React, DOM либо localStorage.

### Storage adapter

- Единственная подсистема, напрямую обращающаяся к localStorage.
- Выполняет version validation, parse, migration/reset и обработку исключений.
- Не сохраняет полную историю попыток.

### Styling boundary

- Корневой Astro layout является единственной точкой global imports и импортирует `tokens.css` и `global.css` ровно по одному разу.
- Astro components держат локальные правила в scoped `<style>`.
- React UI components с локальными стилями импортируют colocated `*.module.css`; module classes являются внутренней деталью component. Logic-only modules не создают пустые CSS Modules.
- Theme switch меняет `data-theme` на корневом элементе; React state не хранит копии palette values.
- Static source validation проверяет `src/**/*.{css,astro,ts,tsx}` и запрещает palette literals вне `tokens.css`, случайный `is:global`, global CSS imports из React и любые дополнительные styling dependencies; их allowlist для MVP пуст.

### DnD boundary

- Локальный `DragAdapter` — единственная граница между DnD library и editor. Он переводит mouse/touch gestures в те же semantic commands, что и button/keyboard path, и не владеет canonical answer state.
- Conceptual commands: `OrderSteps.moveItem(itemId, targetIndex)`, `MatchPairs.connectPair(leftId, rightId)`, `PromptBuilder.placeBlock(blockId, slotId, targetIndex)`.
- Один DnD context/область создаётся на экземпляр упражнения; глобальный application provider не создаётся.
- Invalid/cancelled drop не изменяет answer; после переноса восстанавливается логически связанный focus, а изменения объявляются по-русски через live region.
- После `submit`/`review` отправленный/current draft становится immutable и disabled согласно state model. Если state machine разрешает inline retry или quiz correction, она открывает новый editable draft, для которого DnD и alternatives снова работают; quiz feedback раскрывается только на разрешённой фазе. Scoring engine получает только итоговый answer и не зависит от DnD, DOM или React.

## 5. Контракты данных

### ExerciseDefinition

Discriminated union с общими полями:

- уникальный `id`;
- `type` из 10 разрешённых значений;
- `topicId` одной из шести тем;
- prompt/instruction;
- параметры конкретного типа;
- scoring configuration;
- hint;
- explanation;
- source/reference metadata при необходимости.

CaseStudy type payload обязательно содержит `initialPrompt` по spec 02; общий механизм рубрики не делает это поле обязательным для PromptSimulator. Метаданные контента поддерживают перечень концепций и связи с упражнениями по spec 03.

Каждый variant содержит только релевантные поля. Data validation отклоняет неизвестный `type`, дубликат ID, отсутствующий topic и невозможную scoring configuration.

### ExerciseResult

Общие поля:

- exercise ID и topic ID;
- normalized score от 0 до 1;
- `correct`, `partial` или `incorrect`;
- breakdown по элементам/критериям;
- runtime answer snapshot; постоянное сохранение использует отдельную очищенную проекцию по spec 04;
- номер фазы и признак correction.

### QuizAttempt

Содержит:

- уникальный локальный attempt ID;
- seed;
- 12 exercise ID в сохранённом порядке;
- текущую фазу и позицию;
- первичные answers/results;
- correction answers/results;
- первичный и финальный итог;
- timestamps, необходимые для восстановления, но не для аналитики.

### PersistedProgress

Versioned root object с:

- theme preference;
- inline attempts/completion;
- article completion;
- active quiz attempt;
- latest first/final score;
- best first/final score;
- `gamification.catalogVersion`;
- `gamification.awardedXpKeys`;
- `gamification.unlockedAchievementIds`.

`xpTotal` и unlocked reward IDs выводятся из persisted keys и catalog. Полная история gamification events и quiz attempts не сохраняется.

## 6. Режимы упражнения

### Inline

- Локальное состояние React-острова.
- Немедленный результат и минимальная подсказка, одна коррекция при score<1; полный разбор после окончательной попытки по spec 02.
- Повтор не влияет на итоговый тестовый балл.
- Наружу отправляется completion event для progress adapter.

### Quiz

- Компонент контролируется Quiz application.
- Первая фаза не раскрывает результат; оба балла и полный разбор скрыты до finalComplete. Пропуск даёт incorrect/0 через quiz adapter.
- Correction phase получает только eligible questions.
- Answer key доступен после финализации.

Согласно `DEC-018`, общий component API строится на typed contracts и composition. Формулировка исходной задачи о наследовании означает переиспользование shell, state behavior и result contract, а не обязательный `class extends`.

## 7. Scoring

Все evaluator functions:

- детерминированы;
- не изменяют входные данные;
- возвращают score 0–1 и breakdown;
- тестируются таблицами boundary cases;
- не выполняют network или storage operations.

Точные правила принадлежат [specs/02-exercise-system.md](specs/02-exercise-system.md), а не дублируются здесь.

## 8. Выборка теста

Selector принимает bank и seed и возвращает валидный набор или явную configuration error. Он обязан обеспечить `QUIZ-001`–`QUIZ-003`. Если банк не позволяет собрать набор, тест не стартует и показывает безопасное диагностическое сообщение без частично созданной попытки.

## 9. Сохранение и восстановление

- Все writes проходят через adapter.
- Сохранение происходит после значимого state transition, включая изменение черновика активного теста, а не на каждом render.
- Runtime state не сериализуется целиком: явные projections для inline, active quiz и final review исключают текст и цитаты там, где они запрещены DEC-030. Причины breakdown сохраняются кодами и восстанавливаются из контента.
- При finalComplete активное сохранение заменяется очищенным final review до следующей записи; generic autosave не должен записать старый runtime текст обратно. Поздние записи отменяются/проверяют attempt ID и фазу.
- Источник точных полей, сроков хранения, версий контента и best/latest: spec 04.
- Операция общего reset очищает учебные поля, но переносит текущую theme preference в новый default progress state (`DEC-020`).
- Parse/schema error приводит к безопасному default state и пользовательскому сообщению о сбросе локальных данных.
- Storage exception не блокирует чтение статей; пользователь получает предупреждение, что прогресс не сохранится. Запрет доступа к самому `window.localStorage` отображается сразу после загрузки интерактивного интерфейса, до первого изменения ответа; работа продолжается в памяти страницы.
- Неизвестные поля игнорируются для forward compatibility.

## 10. Ошибки и безопасные состояния

| Ситуация | Требуемое поведение |
|---|---|
| Неизвестный exercise ID в MDX | Build/content validation завершается ошибкой до публикации |
| Некорректная definition | Unit/schema validation FAIL с ID задания |
| Невозможная quiz selection | Тест не начинается; показывается понятное сообщение |
| Повреждённый localStorage | Данные сбрасываются безопасно; страница продолжает работать |
| localStorage недоступен | Портал работает без persistence и предупреждает пользователя |
| Ошибка одного React-острова | Остальной статический текст остаётся читаемым |

## 11. Доступность и responsive

- Семантические controls используются вместо clickable div.
- Каждый DnD flow дублируется selection/move buttons и keyboard-friendly path; touch не требует hover.
- Focus не теряется после проверки, перемещения и смены шага.
- Live regions объявляют результат без преждевременного раскрытия quiz answer.
- Motion учитывает `prefers-reduced-motion`.
- Layout проверяется на 360, 768 и 1440 px.
- Palette roles, typography, geometry и motion limits берутся из `DEC-019` и spec `01`, а не задаются локально отдельными компонентами.
- Matrix background реализуется отдельным декоративным слоем только с цифрами `0–9`: он скрыт от accessibility tree, не принимает pointer events и становится статичным при reduced motion.

Визуальные детали утверждены в `DEC-019`, reset theme preference — в `DEC-020`, styling architecture — в `DEC-021`, DnD contract — в `DEC-022`.

## 12. Безопасность и приватность

- Не собирать персональные данные.
- Не отправлять ответы пользователя на внешние сервисы.
- Не хранить secrets в client bundle.
- Внешние ссылки при target=_blank имеют rel=noopener; href допускает только обычные web-адреса, без javascript:/data:. Проверка QA-TECH-03.
- Пользовательский ввод выводится как текст, а не как raw HTML.

## 13. Build и публикация

- Output полностью статический.
- Все внутренние ссылки и assets учитывают GitHub Pages base path.
- Production preview проверяется до deploy.
- Способ публикации утверждён в `DEC-036`: сборка проверенного commit `main` с base path `/prompt-engineering-academy/` вручную размещается в корне `gh-pages`; пользовательский deployment workflow не входит в утверждённый выпуск. Точный порядок и откат – spec `05`.

## Технические правила и доказательства

Эта таблица связывает обязательные правила разделов 1–13 с проверками TEST_PLAN, не копируя сценарии. Для принятия требуются все указанные проверки; NOT RUN/BLOCKED не являются доказательством. Изменение технического правила требует обновить эту связь.

| ID | Правило / раздел-владелец | Проверки TEST_PLAN |
|---|---|---|
| TQ-01 | Статический сайт и стек без серверного исполнения, §1/2/13 | QA-RULE-12, QA-TECH-05 |
| TQ-02 | Владельцы подсистем, composition/registry и единый contract, §4/5 | CMP-ARCH-01, CMP-ARCH-02, CMP-ARCH-03, QA-TECH-04 |
| TQ-03 | Чистота scoring, неизменяемые входы и валидные definitions, §5/7 | QA-RULE-05, QA-RULE-06, QA-TECH-04, QA-TECH-05 |
| TQ-04 | Styling boundary, §4; визуальный владелец spec 01 | VIS-01, VIS-02, VIS-03, VIS-04, VIS-05, VIS-06, VIS-07, VIS-08, VIS-09 |
| TQ-05 | Локальный DragAdapter, команды, блокировка и альтернативы, §4 | DND-001, DND-002, DND-003, DND-004, DND-005, DND-006, DND-007, DND-008, DND-009 |
| TQ-06 | Фазы, права редактирования, раскрытие и focus, §6/11 | IV-01, IV-02, IV-03, IV-04, IV-05, IV-07, QA-RULE-07, QA-TECH-06 |
| TQ-07 | Детерминированная выборка и неизменный эталон, §8 / spec 04 | QZ-SEL-01, QZ-SEL-02, QZ-SEL-03, QA-RULE-17 |
| TQ-08 | Versioned projections, ошибки, сброс и поздние записи, §9 | IV-16, IV-17, IV-18, IV-19, IV-20, QA-RULE-09, QA-RULE-10 |
| TQ-09 | Изоляция сбоев и отклонение невалидного контента, §10 | QA-TECH-02, QA-TECH-05 |
| TQ-10 | Приватность, безопасный вывод и ссылки, §12 | QA-RULE-12, IV-18, QA-TECH-01, QA-TECH-03 |
| TQ-11 | Доступность, темы, размеры и движение, §11 / spec 01 | QA-RULE-15, QA-TECH-06, VIS-02, VIS-04, VIS-05, VIS-08 |
| TQ-12 | Документация, base path и разрешённая публикация, §13 / spec 05 | QA-RULE-12, QA-RULE-13, QA-RULE-14 |

## Защита режима разработки

- В `astro.config.mjs` каталог промежуточных файлов Vite разделён по командам Astro: `node_modules/.vite-dev`, `.vite-sync`, `.vite-build`. Проверка типов использует синхронизацию в режиме сборки и не должна перезаписывать React работающего сервера разработки.
- Элементы ввода и отправка встроенного упражнения отключены до подключения обработчиков React. Это предотвращает потерю ответа, введённого в ещё неактивную серверную разметку. Ленивая загрузка при появлении упражнения на экране сохраняется.
- Проверки: `DEV-RUNTIME-01` и `DEV-RUNTIME-02` в `docs/TEST_PLAN.md`.

## 14. Возможные улучшения — не MVP

- Server persistence, accounts, real AI и cross-device sync не предусматриваются архитектурой MVP.
- Analytics и custom domain не добавляются до отдельного решения.
- Полная история попыток не входит в storage schema.
