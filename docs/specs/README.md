# Предметные спецификации

## Комплект

1. [00 — Product Overview and Architecture](00-overview.md)
2. [01 — Experience, Visual System and Accessibility](01-experience.md)
3. [02 — Exercise Component System](02-exercise-system.md)
4. [03 — Learning Content and Route](03-content-route.md)
5. [04 — Quiz, Progress and Gamification](04-quiz-progress-gamification.md)
6. [05 — Quality, Documentation and Release](05-quality-release.md)

## Зависимости

```text
00 -> 01
00 -> 02
01 -> 02
00 + 02 -> 03
01 + 02 + 03 -> 04
00 + 01 + 02 + 03 + 04 -> 05
```

Подробное правило имеет одного владельца: spec 02 – формулы упражнений; spec 04 – переходы теста, общий прогресс и хранение; TECH_SPEC – технические границы; TEST_PLAN – входы, ожидания и доказательства проверок. Остальные документы дают краткое описание и ссылки. Старые общие критерии принимаются по связанным подробным сценариям, без дублирования тестовой реализации.

Обязательные требования не копируются полностью в каждую спецификацию. Их владелец — [../REQUIREMENTS.md](../REQUIREMENTS.md); спецификации объясняют дизайн и ссылаются на requirement IDs.

## Порядок согласования

1. `00` — общие границы.
2. `01` — visual system, reset theme preference и styling architecture утверждены в `DEC-019`–`DEC-021`.
3. `02` — component architecture утверждена в `DEC-018`, DnD contract утверждён в `DEC-022`.
4. `03` — после стабилизации публичного exercise contract.
5. `04` – геймификация DEC-023, тест и хранение DEC-024–DEC-030, уточнения перемешивания и прогресса DEC-032/033.
6. `05` – параметры выпуска утверждены в `DEC-036`, `OPEN-REL-001` закрыт; публикация выполняется только по отдельному запросу.
