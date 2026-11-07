import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { articleExercises, inlineExercises } from '../../src/data/exercises/inline';
import { missions } from '../../src/data/missions';
import { evaluate } from '../../src/domain/scoring/evaluate';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

test('три принятых ответа завершают миссию; статус переживает reload и очищается сбросом', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Практические задания', exact: true })).toBeVisible();
  const card = page.locator('#missions > ol > li').first();
  await expect(card).toContainText('Доступно');
  await page.goto('/articles/how-llms-work/');
  await expect(page.getByText('Практическое задание 1 из 6', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Следующее задание', exact: true })).toBeVisible();
  const truth = page.locator('[data-exercise-type="TrueFalse"]');
  await truth.scrollIntoViewIfNeeded();
  await truth.getByRole('radio', { name: 'Верно', exact: true }).check();
  await truth.getByRole('button', { name: 'Проверить ответ' }).click();
  await page.goto('/');
  await expect(card).toContainText('В процессе · 1 из 3');
  await page.goto('/articles/how-llms-work/');
  const pairs = page.locator('[data-exercise-type="MatchPairs"]');
  await pairs.scrollIntoViewIfNeeded();
  await pairs.getByRole('button', { name: 'Механизм: Генерация', exact: true }).click();
  await pairs.getByRole('button', { name: 'Назначить описание: Выбор продолжения на основе предыдущего текста', exact: true }).click();
  await pairs.getByRole('button', { name: 'Проверить ответ' }).click();
  const simulator = page.locator('[data-exercise-type="PromptSimulator"]');
  await simulator.scrollIntoViewIfNeeded();
  await simulator.getByRole('textbox').fill('Подготовь объявление.');
  await simulator.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(page.getByText('Практическое задание выполнено.', { exact: false })).toBeVisible();
  await page.goto('/');
  await expect(card).toContainText('Пройдено · 3 из 3');
  await page.reload();
  await expect(card).toContainText('Пройдено · 3 из 3');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Сбросить учебный прогресс' }).click();
  await expect(card).toContainText('Доступно');
});

test('учебные схемы читаются в обеих темах на трёх ширинах', async ({ page }) => {
  for (const slug of ['prompt-structure', 'tokens-context']) {
    await page.goto(`/articles/${slug}/`);
    const diagram = page.locator('figure[data-learning-diagram]');
    await expect(diagram).toHaveCount(1);
    await expect(diagram.locator('figcaption')).not.toBeEmpty();
    for (const theme of ['Светлая', 'Тёмная']) {
      await page.getByRole('button', { name: theme, exact: true }).click();
      for (const width of [360, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        await diagram.scrollIntoViewIfNeeded();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      const result = await new AxeBuilder({ page }).include('figure[data-learning-diagram]').analyze();
      expect(result.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
    }
  }
});

test('узлы маршрута: текущий и завершённый зелёные, остальные доступны, сброс восстанавливает начало', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  for (const theme of ['dark', 'light'] as const) {
    const progress = { ...defaultProgress(), theme };
    for (const topicId of [missions[0]!.id, missions[2]!.id]) {
      for (const id of articleExercises[topicId]) {
        const definition = inlineExercises.find(item => item.id === id)!;
        progress.inline[id] = { first: evaluate(definition, null), correctionUsed: false };
      }
    }
    await page.goto('/');
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: PROGRESS_KEY, state: progress });
    await page.reload();
    await expect(page).toHaveTitle(/Prompt Engineering Academy/);
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const nodes = page.locator('#missions .number');
    const statuses = page.locator('#missions .status');
    const states = ['completed', 'current', 'completed', 'available', 'available', 'available'];
    for (const [index, state] of states.entries()) {
      await expect(nodes.nth(index)).toHaveAttribute('data-route-state', state);
      await expect(statuses.nth(index)).toHaveAttribute('data-route-state', state);
    }
    await expect(statuses.nth(1)).toHaveText('Доступно · Рекомендуется');
    for (const width of [360, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('#missions').scrollIntoViewIfNeeded();
      const palette = await page.locator('#missions').evaluate(element => {
        const root = getComputedStyle(document.documentElement);
        const token = (name: string) => {
          const hex = root.getPropertyValue(name).trim().slice(1);
          return `rgb(${[0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
        };
        return {
          primaryFill: token('--accent-primary-fill'), primaryText: token('--accent-primary'), secondary: token('--accent-secondary'), info: token('--info'),
          nodes: Array.from(element.querySelectorAll('.number')).map(node => getComputedStyle(node).backgroundColor),
          statuses: Array.from(element.querySelectorAll('.status')).map(node => getComputedStyle(node).color),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(palette.nodes).toEqual(states.map(state => state === 'available' ? palette.secondary : palette.primaryFill));
      expect(palette.statuses).toEqual(states.map(state => state === 'available' ? palette.info : palette.primaryText));
      expect(palette.overflow).toBe(false);
      const links = page.locator('#missions ol li > a');
      await expect(links).toHaveCount(6);
      for (const [index, mission] of missions.entries()) await expect(links.nth(index)).toHaveAttribute('href', `/articles/${mission.slug}/`);
      const audit = await new AxeBuilder({ page }).include('#missions').analyze();
      expect(audit.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
      await page.screenshot({ path: join(tmpdir(), `pea-route-${theme}-${width}.png`) });
    }
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Сбросить учебный прогресс' }).click();
    await expect(nodes.first()).toHaveAttribute('data-route-state', 'current');
    for (const node of await nodes.all().then(items => items.slice(1))) await expect(node).toHaveAttribute('data-route-state', 'available');
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  }
  expect(errors).toEqual([]);
});
