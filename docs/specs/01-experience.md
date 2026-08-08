# 01 — Experience, Visual System and Accessibility

## Назначение

Определить пользовательские потоки, состояния интерфейса, responsive и accessibility contract. Цвета, шрифты и CSS-подход не фиксируются до `OPEN-UX-001` и `OPEN-UX-002`.

## Experience principles

- Практика находится внутри учебного повествования, а не вынесена в конец статьи.
- Рекомендуемый маршрут заметен, но не создаёт locks.
- Ошибка воспринимается как обучающий сигнал, а не наказание.
- Игровые элементы помогают ориентироваться и не скрывают содержание.
- Состояние всегда выражается текстом/иконкой, а не только цветом.

## Главная страница

Обязательные зоны:

1. Название и краткое обещание продукта.
2. Общий прогресс и XP summary.
3. Карта шести миссий в рекомендуемом порядке.
4. На каждой карточке: номер, тема, краткая цель, статус и переход.
5. Доступный переход к итоговому тесту.
6. Переключатель темы.

Карточки не блокируются. Незавершённая предыдущая миссия может быть отмечена рекомендацией, но не отключает ссылку.

## Страница статьи

- Читаемая колонка текста.
- Видимый заголовок, цель и прогресс статьи.
- Три упражнения после соответствующих смысловых блоков.
- Ссылки на источники рядом с утверждениями.
- Переходы к предыдущей/следующей миссии и главной.
- Статус завершения после трёх попыток.

## Страница теста

Состояния UI:

1. Introduction и запуск.
2. Primary answering.
3. Primary summary без answer key.
4. Correction answering.
5. Final result, answer key и recommendations.

Progress indicator показывает позицию и фазу, но не раскрывает правильность до разрешённого состояния.

## Exercise visual states

Каждый компонент предоставляет согласованные состояния:

- ready;
- edited;
- submitted;
- correct;
- partial;
- incorrect;
- hint available;
- correction;
- reviewed;
- disabled только когда transition запрещён.

Тексты labels должны быть понятны без знания внутреннего типа компонента.

## Темы

Обязательно две темы и сохранение выбора. До `OPEN-UX-001` запрещено фиксировать конкретные palette tokens как окончательные.

Минимальный semantic token contract:

- page/background/surface;
- text primary/secondary;
- accent;
- success/warning/error/info;
- border/focus;
- overlay;
- elevation.

Обе темы должны сохранять различимость состояний и контраст AA.

## Геймификация в UI

Отображаются:

- XP summary;
- достижения и locked/unlocked state;
- награды;
- прогресс миссий;
- итоговый ранг;
- короткая success animation.

Точные labels, числа и условия принадлежат `OPEN-GAM-001`. Motion не должен задерживать навигацию и отключается/сокращается при `prefers-reduced-motion`.

## Responsive

| Контрольная ширина | Ожидаемое поведение |
|---:|---|
| 360 px | Один столбец, touch targets, альтернативы drag-and-drop, без horizontal overflow |
| 768 px | Умеренно широкая статья, карта адаптируется без потери порядка |
| 1440 px | Ограниченная читаемая колонка; свободное пространство не растягивает строки |

Контрольные ширины не являются единственными breakpoint: layout должен быть fluid между ними.

## Accessibility contract

- Один логический `h1`, последовательная heading hierarchy.
- Skip link к основному содержимому.
- Нативные buttons, links, radios, checkboxes и inputs, где применимо.
- Focus visible и предсказуем после state transition.
- Status announcements через подходящие live regions.
- Keyboard-only выполнение всех упражнений.
- Touch targets не меньше принятого AA-подхода после визуального решения.
- Drag-and-drop имеет selection + move controls.
- Не использовать motion как единственный носитель информации.

## Критерии приёмки

| ID | Критерий | Проверка |
|---|---|---|
| UX-AC-001 | Все маршруты доступны с главной без locks. | E2E новой сессии открывает 6 статей, quiz и about. |
| UX-AC-002 | Все exercise states имеют текстовый признак и keyboard path. | Component accessibility matrix проходит для 10 типов. |
| UX-AC-003 | Нет horizontal overflow/перекрытия CTA на 360, 768 и 1440 px. | Automated viewport screenshots + manual review. |
| UX-AC-004 | Светлая и тёмная темы проходят contrast audit. | axe/contrast report без critical/serious failures. |
| UX-AC-005 | Reduced motion не скрывает результат и не задерживает действия. | E2E с reduced-motion media emulation. |

## Возможные улучшения

Не добавлять дополнительные игровые экраны или визуальные режимы без нового решения.

