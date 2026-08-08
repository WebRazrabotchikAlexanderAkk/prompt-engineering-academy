# 05 — Quality, Documentation and Release

## Назначение

Определить доказательства готовности, документацию и публикацию. Подробные test cases находятся в [../TEST_PLAN.md](../TEST_PLAN.md).

## Quality gates

### Gate 1 — Static validation

- TypeScript typecheck PASS.
- Astro/MDX/content validation PASS.
- Нет duplicate IDs, missing sources и invalid definitions.

### Gate 2 — Unit/component

- Все scoring boundary tests PASS.
- Все state machine tests PASS.
- Все 10 types проходят inline/quiz component matrix.

### Gate 3 — E2E/accessibility

- Главный учебный маршрут PASS.
- Двухфазный quiz PASS.
- Reload/recovery/reset PASS.
- Keyboard-only и axe checks PASS.
- Chromium, Firefox и WebKit PASS; Edge manual smoke PASS.

### Gate 4 — Production build

- Build exit code 0.
- Static preview открывает главную, шесть статей, quiz и about.
- Direct URL/reload не ломает route/assets.
- Base path соответствует GitHub Pages настройке.

### Gate 5 — Published verification

- Публичный repository доступен.
- Pages URL соответствует утверждённому commit.
- На опубликованном URL выполняется smoke flow.
- Console не содержит uncaught errors.

## Documentation requirements

README после реализации содержит:

- назначение и аудиторию;
- технологии и причины выбора;
- архитектуру Astro/React islands;
- список 10 компонентов;
- точные prerequisites и команды;
- запуск development и production preview;
- команды typecheck/unit/component/E2E/accessibility;
- walkthrough: статья → inline → quiz → result;
- опубликованный URL;
- ограничения симуляции без настоящего AI.

## GitHub Pages

`OPEN-REL-001` должен определить:

- owner/account;
- repository URL;
- base path;
- source branch/artifact;
- manual или deployment workflow;
- проверяемый rollback/redeploy процесс.

GitHub Actions не обязателен для тестов. Решение о deployment workflow принимается отдельно и не выводится из этого требования автоматически.

## Release checklist

- [ ] Все MUST requirements имеют PASS evidence.
- [ ] Все реализованные OPEN decisions переведены в ACCEPTED.
- [ ] Возможные улучшения не попали в MVP без решения.
- [ ] Нет secrets и персональных данных.
- [ ] README проверен на чистом checkout.
- [ ] Production build проверен локально.
- [ ] Published URL проверен после deploy.
- [ ] Git status/commit соответствует разрешённому release scope.

## Критерии приёмки

| ID | Критерий | Проверка |
|---|---|---|
| QR-AC-001 | Каждый MUST requirement связан минимум с одним test/manual case и evidence. | Traceability report без пустых строк. |
| QR-AC-002 | Все quality gates PASS на одной утверждённой revision. | Сохранённые свежие outputs с revision ID. |
| QR-AC-003 | README позволяет запуск без дополнительных устных шагов. | Clean-checkout walkthrough другим пользователем/изолированной средой. |
| QR-AC-004 | Published Pages поддерживает main/article/quiz direct URLs и reload. | Remote smoke checklist на окончательном base path. |
| QR-AC-005 | В repository отсутствуют secrets и локальные данные. | Secret scan + git file inventory + manual config review. |

## Возможные улучшения

Analytics, custom domain и CI test workflow не входят в обязательную приёмку до отдельного решения.

