# 00 — Product Overview and Architecture

## Назначение

Управляющая спецификация Prompt Engineering Academy. Она определяет границы системы и владельцев решений, но не повторяет scoring, тексты статей или release checklist.

## Scope MVP

- Русскоязычный статический образовательный портал.
- Аудитория с базовым опытом AI.
- Шесть статей-миссий и 18 inline-упражнений.
- Десять переиспользуемых типов упражнений.
- Итоговый тест из 12 заданий, выбранных из банка 24.
- Локальный прогресс, две темы и доступность WCAG 2.2 AA.
- XP, достижения, награды и ранги.
- Публичный GitHub Pages сайт.

Вне scope: `OUT-001`–`OUT-005` из [../DECISIONS.md](../DECISIONS.md).

## Системные границы

| Подсистема | Владеет | Не владеет |
|---|---|---|
| Astro shell | Страницы, layouts, MDX, metadata, static build | Scoring и состояние теста |
| React exercise library | UI десяти типов и сбор ответа | Глобальное сохранение и маршруты |
| Exercise domain | Types, normalization, scoring, result breakdown | DOM, React и storage |
| Quiz application | State machine, selection, две фазы, result view | Правила конкретного evaluator |
| Progress/gamification | Completion, recommendations, XP state | Контент статей и rendering упражнения |
| Storage adapter | Версия, parse, read/write/recovery | Бизнес-решения о прохождении |

## Архитектурный поток

1. Astro строит страницу и передаёт exercise definition React-острову.
2. Exercise UI собирает answer и вызывает чистый evaluator.
3. Inline shell показывает локальную обратную связь и отправляет completion event.
4. Quiz shell сохраняет result в reducer state без преждевременного раскрытия.
5. Progress domain обновляет completion/recommendations/gamification.
6. Storage adapter сериализует разрешённый versioned state.

## Страницы

- `/` — маршрут курса и каталог.
- Шесть статических article routes.
- `/quiz` — тест и результат.
- `/about` — краткая информация.

Точные slug выбираются при content scaffolding, но должны оставаться стабильными после публикации.

## Владелец данных

- Проза: MDX files.
- Exercise definitions: TypeScript data modules.
- Quiz bank: TypeScript data modules.
- Runtime progress: React state + storage adapter.
- Подтверждённые решения: `docs/DECISIONS.md`.

## Cross-cutting constraints

- Никакого backend/runtime server.
- Никаких secrets и AI network calls.
- Все interactive states доступны с клавиатуры.
- Все acceptance criteria имеют автоматическую или ручную проверку.
- Открытое решение нельзя заменять предположением.

## Критерии приёмки спецификации

| ID | Критерий | Проверка |
|---|---|---|
| OV-AC-001 | Все требования `CORE-001`–`CORE-004` имеют владельца в таблице подсистем или release spec. | Traceability review не находит requirement без владельца. |
| OV-AC-002 | Каждая runtime-сущность имеет одного владельца записи. | Architecture review не находит два модуля, напрямую записывающих один state. |
| OV-AC-003 | Production runtime не требует server process. | Static build обслуживается generic static server и проходит smoke test. |
| OV-AC-004 | Все открытые решения перечислены в DECISIONS и не представлены как принятые. | Сравнить `OPEN-*` ссылки по всем документам; orphan/hidden open decisions отсутствуют. |

## Возможные улучшения

Только перечисленные в REQUIREMENTS разделом «Возможные улучшения»; они не меняют эту архитектуру без новой спецификации.

