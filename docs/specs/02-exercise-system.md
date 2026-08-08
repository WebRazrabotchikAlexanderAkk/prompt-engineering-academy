# 02 — Exercise Component System

## Назначение

Определить единый typed contract, state model и scoring всех 10 типов. Спецификация не управляет выборкой итогового теста и глобальным прогрессом.

## Архитектурное решение

Предлагается React composition:

- общий ExerciseShell;
- type-specific answer editor;
- type-specific evaluator;
- общие feedback/result элементы;
- mode adapter для inline/quiz.

Это решение ожидает подтверждения `OPEN-ARCH-001`; буквальная class hierarchy не создаётся до решения.

## Общий contract

Каждая definition обязана иметь:

- стабильный уникальный ID;
- один из 10 discriminant types;
- topic ID;
- instruction;
- type payload;
- scoring config;
- hint и explanation;
- accessibility labels для нестандартных controls.

Каждый evaluator возвращает normalized score 0–1, status и объяснимый breakdown.

## Режимы

| Поведение | Inline | Quiz |
|---|---|---|
| State owner | Локальный остров | Quiz reducer |
| Проверка | Немедленно после submit | Скрыта до завершения первичной фазы |
| Retry | После объяснения | Одна correction попытка для eligible answers |
| Общий балл | Нет | Есть |
| Persistence event | Completion | Full attempt snapshot |

## Типы и scoring

### MultipleChoice

- Single: точный вариант = 1, иначе 0.
- Multi: любой неправильный выбранный вариант = 0.
- Только часть правильных без неправильных = selectedCorrect / totalCorrect.
- Полный балл требует точного множества.

### MatchPairs

- Score = correct pairs / total pairs.
- Пара считается правильной только при точном соответствии.
- Full score требует всех пар без ошибки.

### FillTheBlank

- Score = accepted blanks / total blanks.
- Нормализация: trim, collapse whitespace, lowercase, `ё`→`е`, разрешённая terminal punctuation.
- Синоним засчитывается только если включён в accepted answers.
- Typo tolerance выключен по умолчанию и задаётся явно для слова достаточной длины.

### TrueFalse

- Только 1 или 0.
- Explanation обязательно объясняет принцип, а не повторяет label.

### OrderSteps

- Частичный score основан на доле пар элементов в правильном относительном порядке.
- Full score требует точной последовательности.
- Начальный display order перемешивается и сохраняется в попытке.

### CaseStudy

- Свободный текст проверяется scenario-specific rubric.
- Rubric содержит weighted criteria, сумма weights = 1.
- Каждый criterion использует детерминированные checks и возвращает breakdown.
- UI сообщает, что оценка учебная и эвристическая.

### PromptSimulator

- Prompt оценивается детерминированной rubric.
- Диапазон результата выбирает один подготовленный response tier: weak, partial или strong.
- Одинаковый prompt/config всегда даёт один tier.
- Никакого AI/network request.

### SpotTheHallucination

- Выбираются смысловые claim fragments, а не произвольные координаты текста.
- Correct selection добавляет равную долю.
- False positive уменьшает результат по заданной конфигурации.
- Score ограничен диапазоном 0–1; full требует точного набора.

### PromptBuilder

- Оцениваются выбранные blocks, их category/slot и требуемый порядок, если он задан.
- Breakdown отделяет missing, misplaced и extra blocks.
- Full требует выполнения всех требований без лишних blocks.

### ContextBudget

- Каждый fragment имеет token cost, educational utility и признак distractor.
- При total cost выше budget score = 0.
- В пределах budget score нормализуется относительно оптимальной utility.
- Distractors уменьшают utility по конфигурации.
- Full требует оптимального набора без превышения.

## Feedback rules

- Inline explanation доступен после submit.
- Quiz primary phase не получает status/explanation.
- Между фазами hint не содержит готового answer key.
- После correction доступны breakdown, exact answer и full explanation.
- Error/partial/correct не обозначаются только цветом.

## Interaction rules

- Каждый editor поддерживает keyboard path.
- MatchPairs, OrderSteps и PromptBuilder имеют buttons для выбора/перемещения.
- Touch path не требует hover.
- Focus после submit переходит к feedback heading/status, затем пользователь может вернуться к editor.

Конкретная DnD технология остаётся `OPEN-DND-001`.

## Configuration validation

Build/test должны отклонять:

- duplicate ID;
- неизвестный type/topic;
- пустой correct set;
- rubric с неверной суммой weights;
- ContextBudget без достижимого допустимого ответа;
- MatchPairs с неоднозначными duplicate keys;
- missing hint/explanation;
- quiz item без serializable payload.

## Критерии приёмки

| ID | Критерий | Проверка |
|---|---|---|
| EX-AC-001 | Все 10 types зарегистрированы и имеют evaluator. | Registry test сравнивает exact expected type set. |
| EX-AC-002 | Один definition работает в inline и quiz wrapper. | Parameterized component tests для 10 types. |
| EX-AC-003 | Каждый evaluator детерминирован и возвращает 0–1. | Повторный вызов с fixtures даёт deep-equal result; boundary property tests. |
| EX-AC-004 | Scoring соответствует `SCR-001`–`SCR-005`. | Traceability matrix связывает каждый SCR ID с unit tests. |
| EX-AC-005 | Drag-dependent types полностью выполняются без drag. | Keyboard/button E2E на MatchPairs, OrderSteps, PromptBuilder. |
| EX-AC-006 | Invalid definitions не доходят до production UI. | Validation suite FAIL для каждого invalid fixture и PASS для bank/content data. |

## Возможные улучшения

Новые типы упражнений не добавляются в MVP без отдельной specification change.

