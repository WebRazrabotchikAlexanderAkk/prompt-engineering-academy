import { test, expect } from '@playwright/test';
import { missions } from '../../src/data/missions';
import { PROGRESS_KEY, defaultProgress } from '../../src/storage/progress';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt } from '../../src/domain/quiz/state';

test('QA-TECH-02: исключение одного острова не повреждает статью и другие упражнения', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let injected = false;
  await page.route('**/src/islands/InlineExerciseIsland.tsx*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = 'function InlineExerciseIsland({ definition }) {';
    expect(source).toContain(marker);
    injected = true;
    await route.fulfill({ response, body: source.replace(marker,
      `${marker}\nif (definition.id === 'llm-1') throw new Error('QA-TECH-02 intentional island failure');`) });
  });
  await page.goto('/articles/how-llms-work/');
  await page.locator('[data-exercise-type="TrueFalse"]').scrollIntoViewIfNeeded();
  await expect.poll(() => injected).toBe(true);
  await expect.poll(() => errors.some(message => message.includes('intentional island failure'))).toBe(true);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Как работают LLM');
  await expect(page.locator('main article')).toContainText('Что делать с неизвестным');
  await expect(page.getByRole('link', { name: 'Следующее задание' })).toBeVisible();
  const pairs = page.locator('[data-exercise-type="MatchPairs"]');
  await pairs.scrollIntoViewIfNeeded();
  await pairs.getByRole('button', { name: 'Назначить описание: Выбор продолжения на основе предыдущего текста' }).click();
  await pairs.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(pairs.locator('[role="status"][tabindex="-1"]')).toContainText('Ответ принят');
  const simulator = page.locator('[data-exercise-type="PromptSimulator"]');
  await simulator.scrollIntoViewIfNeeded();
  await simulator.getByRole('textbox').fill('Составь краткое объявление');
  await simulator.getByRole('button', { name: 'Проверить ответ' }).click();
  await expect(simulator.locator('[role="status"][tabindex="-1"]')).toContainText('Ответ принят');
  const progress = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PROGRESS_KEY);
  expect(progress.inline['llm-1']).toBeUndefined();
  expect(progress.inline['llm-2'].first.score).toBeGreaterThan(0);
  expect(progress.inline['llm-3'].first.score).toBeGreaterThan(0);
  expect(errors.filter(message => !message.includes('intentional island failure'))).toEqual([]);
});

test('QA-TECH-03/05: статическая проза и безопасные внешние ссылки без JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  let checked = 0;
  for (const mission of missions) {
    await page.goto(`/articles/${mission.slug}/`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(mission.title);
    expect((await page.locator('main article').innerText()).length).toBeGreaterThan(1000);
    for (const link of await page.locator('a[href]').all()) {
      const href = await link.getAttribute('href');
      expect(href).not.toMatch(/^\s*(javascript|data):/i);
      if (/^https?:/i.test(href!)) {
        checked++;
        if (await link.getAttribute('target') === '_blank')
          expect((await link.getAttribute('rel') ?? '').split(/\s+/)).toContain('noopener');
      }
    }
  }
  expect(checked).toBeGreaterThanOrEqual(6);
  await context.close();
});

test('QA-TECH-01: HTML-подобный ввод остаётся текстом в черновике и финальном разборе', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const definition = selected.find(item => item.type === 'CaseStudy')!;
  if (definition.type !== 'CaseStudy') throw new Error('Нужна текстовая рубрика');
  const attempt = createAttempt(selected, 42, 'safe-text');
  attempt.position = attempt.ids.indexOf(definition.id);
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  const errors: string[] = []; const unexpected: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('qa-unsafe-marker')) unexpected.push(request.url()); });
  const input = `${definition.example} <img src="/qa-unsafe-marker" onerror="window.qaUnsafe=1">`;
  await page.goto('/quiz/');
  await page.getByRole('textbox', { name: 'Улучшенная версия промпта' }).fill(input);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Улучшенная версия промпта' })).toHaveValue(input);
  await page.getByRole('button', { name: 'Отправить ответ', exact: true }).click();
  for (let index = 0; index < 11; index++) await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
  const review = page.locator('details').nth(attempt.position);
  await review.locator('summary').click();
  await expect(review.getByRole('textbox')).toHaveValue(input);
  await expect(page.locator('img[src*="qa-unsafe-marker"]')).toHaveCount(0);
  expect(await page.evaluate(() => 'qaUnsafe' in window)).toBe(false);
  expect(unexpected).toEqual([]);
  await page.reload();
  await review.locator('summary').click();
  await expect(review.getByRole('textbox')).toHaveValue('');
  expect(await page.evaluate(key => localStorage.getItem(key), PROGRESS_KEY)).not.toContain('qa-unsafe-marker');
  expect(errors).toEqual([]);
});
