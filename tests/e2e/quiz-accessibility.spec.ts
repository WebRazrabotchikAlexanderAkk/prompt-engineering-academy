import { test, expect, type Page, type Locator } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { quizBank } from '../../src/data/quiz/bank';
import { createAttempt } from '../../src/domain/quiz/state';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 80; step++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}

for (const theme of ['Тёмная', 'Светлая']) {
  test(`тест: клавиатура и доступность четырёх состояний, ${theme}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto('/quiz/');
    await page.getByRole('button', { name: theme, exact: true }).click();
    const audit = async (state: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations, state).toEqual([]);
      await page.screenshot({ path: join(tmpdir(), `pea-quiz-${theme === 'Тёмная' ? 'dark' : 'light'}-${state}.png`) });
    };
    await audit('intro');
    const start = page.getByRole('button', { name: 'Начать тест', exact: true });
    await tabTo(page, start);
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Первый проход', exact: true })).toBeFocused();
    // OrderSteps already has a non-empty initial permutation. Choose an empty editor
    // through the real keyboard navigation without replacing the random quiz.
    for (let position = 1; await page.locator('[data-exercise-type="OrderSteps"]').count(); position++) {
      expect(position).toBeLessThan(12);
      const next = page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: String(position + 1), exact: true });
      await tabTo(page, next);
      await page.keyboard.press('Enter');
      await expect(page.getByText(`Открыт вопрос ${position + 1} из 12.`, { exact: true })).toBeVisible();
    }
    await audit('primary');
    await tabTo(page, page.getByRole('button', { name: 'Отправить ответ', exact: true }));
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status').filter({ hasText: 'Пустая отправка' })).toBeFocused();
    await expect(page.getByText('Обработано 0 из 12', { exact: true })).toBeVisible();
    for (let index = 0; index < 12; index++) {
      await tabTo(page, page.getByRole('button', { name: 'Пропустить вопрос', exact: true }));
      await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('heading', { name: 'Одна возможность исправить' })).toBeFocused();
    await expect(page.getByText('Исправлено 0 из 12', { exact: true })).toBeVisible();
    await expect(page.getByText('Первичный результат', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Финальный результат', { exact: true })).toHaveCount(0);
    await audit('correction');
    await tabTo(page, page.getByRole('button', { name: 'Завершить без остальных исправлений' }));
    page.once('dialog', dialog => dialog.accept());
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeFocused();
    await expect(page.getByText('Первичный результат', { exact: false }).first()).toContainText('0%');
    await expect(page.getByText('Финальный результат', { exact: false }).first()).toContainText('0%');
    await audit('final');
    expect(errors).toEqual([]);
  });
}

test('начальный порядок шагов является ответом, а не пустой отправкой', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const question = selected.find(item => item.type === 'OrderSteps');
  expect(question).toBeDefined();
  const attempt = createAttempt(selected, 42, 'initial-order-accessibility');
  attempt.position = attempt.ids.indexOf(question!.id);
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt },
  });
  await page.goto('/quiz/');
  await expect(page.locator('[data-exercise-type="OrderSteps"]')).toBeVisible();
  await tabTo(page, page.getByRole('button', { name: 'Отправить ответ', exact: true }));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Пустая отправка' })).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).active.primary, PROGRESS_KEY);
  expect(saved[question!.id].answer).toEqual(attempt.drafts[question!.id]);
  expect(saved[question!.id].skipped).toBe(false);
});
