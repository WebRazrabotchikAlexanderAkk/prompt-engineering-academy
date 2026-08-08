# 04 — Quiz, Progress and Gamification

## Назначение

Определить state machines итогового теста, прогресса и игровой модели. Scoring конкретного ответа принадлежит Exercise System.

## Question bank

- 24 unique definitions.
- Ровно четыре на каждую из шести тем.
- Рекомендуемый состав: 12 адаптаций inline-концепций и 12 новых application scenarios.
- Data validation выполняется до запуска теста.

## Selection algorithm

Вход: полный bank и seed. Выход: 12 уникальных ID в сохранённом порядке.

Инварианты:

- ровно два задания на тему;
- минимум семь разных exercise types;
- минимум два advanced types;
- минимум один ContextBudget;
- нет duplicate ID;
- внутренние варианты/элементы перемешиваются только там, где порядок не является ответом.

Если инварианты невыполнимы, попытка не создаётся.

## Quiz state machine

Разрешённые состояния:

1. `notStarted`.
2. `primaryInProgress`.
3. `primaryComplete`.
4. `correctionInProgress`.
5. `finalComplete`.

Переходы однонаправленные в пределах попытки. Reload восстанавливает точное состояние и order. Новая полная попытка создаёт новый attempt ID/seed.

## Primary phase

- Все 12 заданий требуют answer/явного пропуска согласно UI decision.
- Не показываются correct/partial/incorrect, explanation или answer key.
- После завершения фиксируются immutable primary answers/results и first score.
- Отображаются общая первичная сводка и hints для eligible items.

Hint не должен содержать точный правильный вариант или готовую последовательность.

## Correction phase

- Доступна только для primary results со status partial/incorrect.
- Разрешён ровно один новый submit на eligible item.
- Primary snapshot не изменяется.
- После завершения вычисляются final results и final score.
- Затем доступны exact answers, full explanations и topic recommendations.

## Результаты

- First и final percentages видимы отдельно.
- Passed = final percentage >= 70.
- Recommendations сортируются по слабым topic scores; темы без ошибок не предлагаются как слабые.
- Rank определяется `GAM-002`.

## Progress model

Хранится:

- theme;
- inline exercise attempts/completion;
- article completion;
- active attempt;
- latest first/final;
- best first/final;
- gamification state после решения `OPEN-GAM-001`.

Не хранится полная история прошлых attempts.

## Storage recovery

- Root schema имеет version.
- Unknown fields игнорируются.
- Поддерживаемая старая версия мигрируется только явной migration function.
- Unknown/повреждённая версия сбрасывается к safe default.
- localStorage exception переводит приложение в non-persistent mode без потери текущей читаемости.

## Reset

- Reset action требует подтверждения.
- Cancel ничего не меняет.
- Confirm удаляет progress, active attempt, scores и gamification state.
- Theme reset behaviour должно быть явно зафиксировано вместе с final reset copy в Experience spec; до решения тест проверяет только согласованное поведение.

## XP, достижения и награды

Функциональная область подтверждена, но точная модель остаётся `OPEN-GAM-001`.

До реализации требуется каталог, где каждая запись содержит:

- стабильный ID;
- пользовательское название/описание;
- точное событие и условие;
- значение XP или вид награды;
- правило повторного начисления;
- persistence fields;
- acceptance example.

Нельзя придумывать числа или награды во время реализации без утверждённого каталога.

## Ranks

| Final score | Ранг |
|---:|---|
| <50 | Исследователь промптов |
| 50–<70 | Практик |
| 70–<85 | Prompt Engineer |
| 85–<95 | Продвинутый Prompt Engineer |
| 95–100 | Архитектор промптов |

## Критерии приёмки

| ID | Критерий | Проверка |
|---|---|---|
| QPG-AC-001 | Bank и каждая selection выполняют все инварианты. | Schema + property tests на множестве seed. |
| QPG-AC-002 | Reload не меняет active attempt, order, phase и answers. | E2E snapshot before/after reload. |
| QPG-AC-003 | Primary snapshot остаётся неизменным после correction. | Reducer/unit test сравнивает deep snapshot. |
| QPG-AC-004 | В correction нет второй попытки и нет correct primary items. | State-transition tests и E2E. |
| QPG-AC-005 | Threshold и ranks корректны на всех границах. | Boundary table unit tests. |
| QPG-AC-006 | Corrupt/blocked storage не ломает UI. | Storage fixtures + E2E exception injection. |
| QPG-AC-007 | Reset cancel/confirm различаются и проверяемы. | E2E два последовательных сценария. |
| QPG-AC-008 | Каждое утверждённое XP/achievement/reward правило имеет deterministic test. | После закрытия OPEN-GAM-001 каталог-to-test traceability = 100%. |

## Возможные улучшения

Full attempt history, accounts и cloud sync не входят в MVP.

