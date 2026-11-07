# 05 — Quality, Documentation and Release

## Назначение

Определить доказательства готовности, документацию и публикацию. Подробные test cases находятся в [../TEST_PLAN.md](../TEST_PLAN.md).

Каждый gate использует матрицу раздела 12 TEST_PLAN.md. PASS документа о покрытии не означает PASS приложения. Доказательства, статусы и параметры фиксируются по каждому связанному case; внешнее разрешение и успешный локальный build не взаимозаменяемы.

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
- Microsoft Edge: основные E2E и ручная проверка пройдены; другие браузеры не входят в обязательную приёмку MVP (DEC-MVP-BROWSER-001).

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

Параметры утверждены в `DEC-036`; `OPEN-REL-001` закрыт:

- Репозиторий: `https://github.com/WebRazrabotchikAlexanderAkk/prompt-engineering-academy`.
- Стандартный адрес сайта: `https://WebRazrabotchikAlexanderAkk.github.io/prompt-engineering-academy/`; base path – `/prompt-engineering-academy/`. Фактический адрес подтверждается в настройках Pages перед выпуском.
- Источник сборки – один проверенный commit ветки `main`. Готовые файлы размещаются в корне отдельной ветки `gh-pages`; источник Pages – эта ветка, папка `/(root)`.
- Выпуск выполняется вручную после проверки состава и сборки. Пользовательский GitHub Actions workflow не добавляется. GitHub запускает собственный служебный процесс развёртывания при публикации из ветки; это не меняет выбранный ручной способ ([документация GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)).
- Готовый артефакт содержит `.nojekyll`, чтобы GitHub Pages отдавал предварительно собранные файлы без обработки Jekyll. Перед отправкой проверяются base path, прямые маршруты и ресурсы ([документация GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)).
- Перед каждым обновлением сохраняется идентификатор текущего проверенного commit в `gh-pages`. При ошибке новый commit в `gh-pages` восстанавливает содержимое предыдущей проверенной версии без переписывания истории. Для первого выпуска без предыдущей версии сайт временно снимается с публикации ([документация GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/unpublishing-a-github-pages-site)).

Выбор параметров не разрешает commit, push, настройку Pages или публикацию. Для этих внешних действий нужен отдельный прямой запрос пользователя. Повторный выпуск и откат проходят ту же проверку фактического адреса.

## Release checklist

- [ ] Все MUST requirements и технические правила TQ-01–TQ-12 имеют PASS evidence по связанным сценариям TEST_PLAN.
- [ ] Все затронутые запросы решений имеют RESOLVED и ссылку на принятое ACCEPTED решение; нет затронутого OPEN.
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
