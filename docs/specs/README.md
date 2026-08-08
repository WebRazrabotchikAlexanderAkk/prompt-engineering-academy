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

Обязательные требования не копируются полностью в каждую спецификацию. Их владелец — [../REQUIREMENTS.md](../REQUIREMENTS.md); спецификации объясняют дизайн и ссылаются на requirement IDs.

## Порядок согласования

1. `00` — общие границы.
2. `01` — после решения `OPEN-UX-001` и `OPEN-UX-002`.
3. `02` — после решения `OPEN-ARCH-001` и `OPEN-DND-001`.
4. `03` — после стабилизации публичного exercise contract.
5. `04` — после решения `OPEN-GAM-001`.
6. `05` — после решения `OPEN-REL-001`.

