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
- Playwright — E2E, Chromium/Firefox/WebKit и accessibility flows.

Конкретные версии фиксируются при scaffolding после проверки актуальных официальных release requirements.

## 3. Предполагаемая структура приложения

Это целевая структура, а не созданный код:

```text
src/
├── components/
│   ├── exercises/        # 10 React-компонентов и общий shell
│   ├── quiz/             # Quiz runner, progress, review, result
│   └── gamification/     # XP, achievements, rewards, rank UI
├── content/
│   └── articles/         # 6 MDX-статей
├── data/
│   ├── exercises/        # Inline definitions
│   └── quiz/             # Bank из 24 definitions
├── domain/
│   ├── exercises/        # Discriminated unions и result contracts
│   ├── scoring/          # Чистые evaluator functions
│   ├── progress/         # Completion и recommendations
│   └── gamification/     # Правила после OPEN-GAM-001
├── islands/              # InlineExerciseIsland и QuizIsland
├── layouts/              # Astro layouts
├── pages/                # Главная, статьи, тест, about
├── storage/              # Versioned localStorage adapter
└── styles/               # После OPEN-UX-002
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

- Визуализирует definition и собирает answer.
- Получает режим `inline` или `quiz` через общий публичный контракт.
- Возвращает единый result shape.
- Не записывает глобальный прогресс напрямую.

### Quiz application

- Является одним React-деревом.
- Использует Context + useReducer для state machine.
- Формирует попытку через deterministic seeded selector.
- Делегирует оценивание Exercise domain.

### Storage adapter

- Единственная подсистема, напрямую обращающаяся к localStorage.
- Выполняет version validation, parse, migration/reset и обработку исключений.
- Не сохраняет полную историю попыток.

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

Каждый variant содержит только релевантные поля. Data validation отклоняет неизвестный `type`, дубликат ID, отсутствующий topic и невозможную scoring configuration.

### ExerciseResult

Общие поля:

- exercise ID и topic ID;
- normalized score от 0 до 1;
- `correct`, `partial` или `incorrect`;
- breakdown по элементам/критериям;
- serializable answer snapshot;
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
- XP/achievement/reward state после решения `OPEN-GAM-001`.

## 6. Режимы упражнения

### Inline

- Локальное состояние React-острова.
- Немедленная проверка и объяснение.
- Повтор не влияет на итоговый тестовый балл.
- Наружу отправляется completion event для progress adapter.

### Quiz

- Компонент контролируется Quiz application.
- Первая фаза не раскрывает результат.
- Correction phase получает только eligible questions.
- Answer key доступен после финализации.

`OPEN-ARCH-001`: окончательно подтвердить composition и typed contract вместо class inheritance. До решения не создавать иерархию классов.

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
- Сохранение происходит после значимого state transition, а не на каждом render.
- Parse/schema error приводит к безопасному default state и пользовательскому сообщению о сбросе локальных данных.
- Storage exception не блокирует чтение статей; пользователь получает предупреждение, что прогресс не сохранится.
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
- Каждый drag flow дублируется selection/move buttons.
- Focus не теряется после проверки, перемещения и смены шага.
- Live regions объявляют результат без преждевременного раскрытия quiz answer.
- Motion учитывает `prefers-reduced-motion`.
- Layout проверяется на 360, 768 и 1440 px.

Визуальные детали остаются `OPEN-UX-001`; организация стилей — `OPEN-UX-002`; DnD средство — `OPEN-DND-001`.

## 12. Безопасность и приватность

- Не собирать персональные данные.
- Не отправлять ответы пользователя на внешние сервисы.
- Не хранить secrets в client bundle.
- Внешние ссылки используют безопасные атрибуты при открытии новой вкладки.
- Пользовательский ввод выводится как текст, а не как raw HTML.

## 13. Build и публикация

- Output полностью статический.
- Все внутренние ссылки и assets учитывают GitHub Pages base path.
- Production preview проверяется до deploy.
- Способ deploy остаётся `OPEN-REL-001`; отсутствие test workflow не запрещает отдельный deployment workflow после одобрения.

## 14. Возможные улучшения — не MVP

- Server persistence, accounts, real AI и cross-device sync не предусматриваются архитектурой MVP.
- Analytics и custom domain не добавляются до отдельного решения.
- Полная история попыток не входит в storage schema.

