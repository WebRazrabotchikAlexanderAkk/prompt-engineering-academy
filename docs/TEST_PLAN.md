# Test Plan

## 1. Цель

Доказать выполнение всех MUST-требований Prompt Engineering Academy локально и, после отдельного разрешения, на GitHub Pages. GitHub Actions для тестов не обязателен.

## 2. Принципы

- Тестировать наблюдаемое поведение и чистые contracts, а не внутреннюю разметку.
- Scoring и state machines проверять преимущественно unit tests.
- Компоненты проверять в обоих режимах.
- Основные пользовательские маршруты проверять production build через E2E.
- Accessibility включает automated scan и ручной keyboard review.
- Каждый defect получает regression test до исправления.

## 3. Уровни

| Уровень | Объект | Инструмент | Критерий выхода |
|---|---|---|---|
| Static | TypeScript, MDX, data references | typecheck/content validation | 0 errors |
| Unit | scoring, selector, reducer, storage, ranks | Vitest | Все tests PASS |
| Component | 10 editors × 2 modes, focus/status | React component testing | Matrix PASS |
| E2E | articles, quiz, persistence, responsive | Playwright | Chromium/Firefox/WebKit PASS |
| Accessibility | semantics, contrast, keyboard, motion | axe + manual | 0 critical/serious; checklist PASS |
| Release | static build и GitHub Pages | preview/remote smoke | Все обязательные routes и flow PASS |

## 4. Test data

- Stable fixtures для каждого типа: zero, partial, full и invalid config.
- Seed fixtures для quiz selection: минимум один обычный, один boundary и один impossible-bank case.
- Storage fixtures: valid current, unknown fields, corrupt JSON, unsupported version, storage exception.
- Content fixtures: unknown exercise ID, duplicate ID, missing source metadata, word-count below/above range.
- Не использовать реальные credentials или персональные данные.

## 5. Scoring matrix

| Case ID | Тип | Сценарий | Ожидание |
|---|---|---|---|
| SC-MC-01 | Single MC | Correct | 1 |
| SC-MC-02 | Single MC | Incorrect | 0 |
| SC-MC-03 | Multi MC | Exact set | 1 |
| SC-MC-04 | Multi MC | Correct subset, no wrong | selected/total |
| SC-MC-05 | Multi MC | Any wrong selected | 0 |
| SC-MP-01 | MatchPairs | 3 of 4 correct | 0.75 |
| SC-FB-01 | FillBlank | Case/space/е-ё variants | Accepted |
| SC-FB-02 | FillBlank | Unlisted synonym/typo | Rejected |
| SC-TF-01 | TrueFalse | Correct/incorrect | 1/0 only |
| SC-OS-01 | OrderSteps | Partial relative order | 0<score<1 |
| SC-CS-01 | CaseStudy | Same input twice | Deep-equal result |
| SC-PS-01 | PromptSimulator | Weak/partial/strong fixtures | Expected tier |
| SC-SH-01 | Hallucination | True + false marks | Penalized, >=0 |
| SC-PB-01 | PromptBuilder | Missing/misplaced/extra | Separate breakdown |
| SC-CB-01 | ContextBudget | Optimal under budget | 1 |
| SC-CB-02 | ContextBudget | Over budget | 0 |

## 6. Quiz selection and flow

| Case ID | Проверка | Ожидание |
|---|---|---|
| QZ-SEL-01 | Каждый seed | 12 unique, 2/topic, >=7 types, >=2 advanced, >=1 ContextBudget |
| QZ-SEL-02 | Same seed/bank | Одинаковый order |
| QZ-SEL-03 | Impossible bank | Явная error, attempt не создан |
| QZ-FLOW-01 | Primary answers | Нет status/explanation/answer key |
| QZ-FLOW-02 | Primary complete | First score immutable, hints доступны |
| QZ-FLOW-03 | Correction | Только partial/incorrect, ровно один submit |
| QZ-FLOW-04 | Final complete | First/final видимы, exact answers и explanations доступны |
| QZ-FLOW-05 | Threshold | 69.99 fail, 70 pass |
| QZ-FLOW-06 | Recommendations | Только слабые темы из fixture |

## 7. Persistence

| Case ID | Сценарий | Ожидание |
|---|---|---|
| ST-01 | Theme reload | Выбор сохранён |
| ST-02 | Article completion reload | Статус сохранён |
| ST-03 | Quiz reload в каждой фазе | IDs, order, answers и phase не меняются |
| ST-04 | Unknown fields | Игнорируются |
| ST-05 | Corrupt JSON | Safe default, UI работает |
| ST-06 | Storage throws | Non-persistent mode, UI работает |
| ST-07 | Reset cancel | Данные сохраняются |
| ST-08 | Reset confirm | Утверждённые данные очищаются |
| ST-09 | Schema inspection | Нет полной истории attempts |

## 8. Content

| Case ID | Проверка | Ожидание |
|---|---|---|
| CT-01 | Metadata | Exact six topics/slugs |
| CT-02 | Word count | 800–1200 на статью |
| CT-03 | Inline references | 3 unique per article, 18 total |
| CT-04 | ID cross-reference | Все IDs существуют и topic совпадает |
| CT-05 | Sources | Важные claims имеют соседнюю релевантную ссылку |
| CT-06 | Wrong inline answer | Чтение и completion не блокируются |
| CT-07 | External links | Link checker получает допустимый HTTP response; manual review подтверждает релевантность |
| CT-08 | Quiz content mix | Фактическое соотношение адаптированных/новых задач зафиксировано; дословные повторы обоснованы |

## 9. Component/accessibility matrix

Для каждого из 10 types проверить:

- render inline и quiz;
- answer input;
- partial/full/zero state, если применимо;
- disabled/forbidden transitions;
- focus после submit;
- live announcement;
- text label состояния;
- keyboard-only completion;
- touch-friendly alternative для drag types;
- отсутствие преждевременного quiz feedback.

## 10. Responsive/browser matrix

| Среда | Проверка |
|---|---|
| Chromium 360/768/1440 | Full core E2E + screenshots |
| Firefox desktop | Core navigation, article, quiz, storage |
| WebKit mobile profile | Touch layout, alternatives, theme, quiz |
| Edge current | Manual smoke на Windows |

Обязательные признаки PASS: нет horizontal overflow, controls не перекрыты, текст читаем, focus видим, primary CTA достижим.

## 11. End-to-end journeys

### E2E-01 — Учебный маршрут

Открыть главную → открыть любую незавершённую статью → ошибиться в первом упражнении → продолжить → попытаться остальные → вернуться на главную → увидеть completion.

### E2E-02 — Двухфазный тест

Запустить тест → ответить на 12 → проверить отсутствие feedback → завершить primary → увидеть first score/hints → исправить eligible → завершить → увидеть final score, answer key, recommendations и rank.

### E2E-03 — Восстановление

Начать тест → ответить частично → reload → сравнить IDs/order/answers/phase → завершить.

### E2E-04 — Сброс

Создать прогресс → отменить reset → проверить сохранение → подтвердить reset → проверить очищенное состояние.

### E2E-05 — Keyboard/accessibility

Пройти representative inline и drag-dependent quiz item без мыши → проверить focus order, announcements и отсутствие serious axe violations.

### E2E-06 — Published smoke

На GitHub Pages открыть главную напрямую → article URL напрямую → reload → quiz → выполнить один interaction → проверить assets/console.

## 12. Requirement traceability

Перед релизом создать матрицу, где каждая строка MUST requirement содержит:

- requirement ID;
- test/manual case ID;
- последний результат PASS/FAIL;
- дату;
- revision/commit;
- ссылку на evidence при наличии.

Критерий: 100% MUST requirements имеют свежий PASS на одной release revision; SHOULD имеют зафиксированный результат и объяснение отклонений.

## 13. Entry criteria

- Затронутые OPEN decisions закрыты.
- Test executable и зависимости разрешаются.
- Production-like fixture data доступно без секретов.
- Минимальный representative test проходит до полного suite.

## 14. Exit criteria

- Все MUST requirement cases PASS.
- Нет critical/serious accessibility defects.
- Нет открытых defects уровня blocker/major.
- Production build и preview PASS.
- Для релиза remote smoke PASS на утверждённом URL.

## 15. Возможные улучшения — не обязательны

- CI test workflow.
- Расширенная visual regression matrix.
- Проверка custom domain и analytics, если они будут отдельно одобрены.
