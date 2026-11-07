import { test, expect } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('конструктор объясняет три ошибки только в полном разборе и после перезагрузки', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/articles/prompt-structure/');
  const builder = page.locator('[data-exercise-type="PromptBuilder"]');
  await builder.scrollIntoViewIfNeeded();
  await builder.getByRole('combobox', { name: 'Контекст', exact: true }).selectOption('o2');
  await builder.getByRole('combobox', { name: 'Задача', exact: true }).selectOption('o5');
  await builder.getByRole('button', { name: 'Проверить ответ' }).click();
  const review = builder.getByRole('region', { name: 'Разбор мест конструктора' });
  await expect(review).toHaveCount(0);
  await builder.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  await expect(review).toContainText('Контекст: Обязательный блок поставлен не на своё место.');
  await expect(review).toContainText('Задача: Выбран лишний блок');
  await expect(review).toContainText('Формат: Место не заполнено.');
  const before = await review.innerText();
  await page.reload();
  await expect(review).toHaveText(before, { useInnerText: true });
  await review.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), 'pea-builder-review.png') });
  expect(errors).toEqual([]);
});

test('расчёт бюджета и выделения сохраняются в полном разборе после перезагрузки', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/articles/tokens-context/');
  const budget = page.locator('[data-exercise-type="ContextBudget"]');
  await budget.scrollIntoViewIfNeeded();
  await budget.getByRole('checkbox').last().check();
  await budget.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(budget.getByRole('region', { name: 'Расчёт выбранного бюджета' })).toHaveCount(0);
  await budget.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  const calculation = budget.getByRole('region', { name: 'Расчёт выбранного бюджета' });
  await expect(calculation).toContainText('Штрафы: 5');
  await expect(calculation).toContainText('= 0%');
  const before = await calculation.innerText();
  await page.reload();
  await expect(calculation).toHaveText(before, { useInnerText: true });

  await page.goto('/articles/hallucinations/');
  const hall = page.locator('[data-exercise-type="SpotTheHallucination"]');
  await hall.scrollIntoViewIfNeeded();
  await expect(hall.getByRole('link', { name: 'Материал по теме проверки фактов' })).toBeVisible();
  await hall.getByRole('checkbox').first().check();
  await hall.getByRole('button', { name: 'Проверить ответ' }).click();
  await hall.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  const selected = hall.getByRole('listitem').filter({ hasText: '· Вы выделили ·' });
  await expect(selected).toHaveCount(1);
  const selectedText = await selected.innerText();
  await page.reload();
  await expect(selected).toHaveText(selectedText, { useInnerText: true });
  expect(errors).toEqual([]);
});
