import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { PROGRESS_KEY } from '../../src/storage/progress';
import { missions } from '../../src/data/missions';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('главная, темы, размеры и доступность', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Управляйте AI осознанно');
  await expect(page.locator('#missions ol > li')).toHaveCount(6);
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations.filter(item => ['critical', 'serious'].includes(item.impact ?? ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('неверный inline, единственное исправление, восстановление и reset темы', async ({ page }) => {
  await page.goto('/articles/how-llms-work/');
  const exercise = page.locator('[data-exercise-type="TrueFalse"]');
  await exercise.scrollIntoViewIfNeeded();
  await exercise.getByRole('radio', { name: 'Верно', exact: true }).check();
  await exercise.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(exercise.getByText('Пока неверно', { exact: false })).toBeVisible();
  await exercise.getByRole('radio', { name: 'Неверно', exact: true }).check();
  await exercise.getByRole('button', { name: 'Отправить окончательный ответ' }).click();
  await expect(exercise.getByRole('radio', { name: 'Неверно', exact: true })).toBeDisabled();
  await page.reload();
  await exercise.scrollIntoViewIfNeeded();
  await expect(exercise.getByText('Первый результат:', { exact: false })).toHaveText('Первый результат: 0%. Окончательный: 100%.');
  await page.goto('/');
  await expect(page.getByText('Прогресс курса:', { exact: false })).toContainText('1 из 18');
  await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  const beforeReset = await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY);
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Сбросить учебный прогресс' }).click();
  await expect(page.getByText('Прогресс курса:', { exact: false })).toContainText('1 из 18');
  expect(await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY)).toBe(beforeReset);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Сбросить учебный прогресс' }).click();
  await expect(page.getByText('Прогресс курса:', { exact: false })).toContainText('0 из 18');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const resetState = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(resetState).toMatchObject({ theme: 'light', inline: {}, active: null, latest: null, best: null, gamification: { awardedXpKeys: [], unlockedAchievementIds: [] } });
  await page.reload();
  await expect(page.getByText('Прогресс курса:', { exact: false })).toContainText('0 из 18');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('12 пропусков, скрытые баллы, исправления и финал после подтверждения', async ({ page }) => {
  await page.goto('/quiz/');
  await page.getByRole('button', { name: 'Начать тест', exact: true }).click();
  for (let count = 0; count < 12; count++) {
    await expect(page.getByText(`Обработано ${count} из 12`, { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  }
  await expect(page.getByText('Исправлено 0 из 12', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Исправлено 0 из 12', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  await expect(page.getByText('Исправлено 0 из 12', { exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  await expect(page.getByText('Первичный результат', { exact: false }).first()).toContainText('0%');
  await expect(page.getByText('Финальный результат', { exact: false }).first()).toContainText('0%');
  await expect(page.getByRole('heading', { name: 'Что повторить' }).locator('..').locator('li a')).toHaveText(missions.map(mission => mission.title));
  await page.screenshot({ path: join(tmpdir(), 'pea-recommendations-final.png') });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
});

test('кнопки перемещения и выбор пар доступны без drag', async ({ page }) => {
  await page.goto('/articles/how-llms-work/');
  const pairs = page.locator('[data-exercise-type="MatchPairs"]');
  await pairs.scrollIntoViewIfNeeded();
  for (const [term, text] of [['Генерация', 'Выбор продолжения на основе предыдущего текста'], ['Контекст', 'Доступные модели инструкции и материалы'], ['Проверка факта', 'Сопоставление утверждения с первоисточником']]) {
    await pairs.getByRole('button', { name: `Механизм: ${term}`, exact: true }).click();
    await pairs.getByRole('button', { name: `Назначить описание: ${text}`, exact: true }).click();
  }
  await pairs.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(pairs.getByText('Верно:', { exact: false })).toContainText('100%');
  await page.goto('/articles/prompt-structure/');
  const order = page.locator('[data-exercise-type="OrderSteps"]');
  await order.scrollIntoViewIfNeeded();
  await order.getByRole('button', { name: 'Опустить шаг 1' }).click();
  await expect(order.getByRole('status').filter({ hasText: 'позицию 2' })).toHaveCount(1);
});
