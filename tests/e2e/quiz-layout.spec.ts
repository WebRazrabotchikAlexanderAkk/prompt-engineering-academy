import { expect, test } from '@playwright/test';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt, quizReducer } from '../../src/domain/quiz/state';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

for (const width of [360, 768, 1440]) for (const theme of ['light', 'dark'] as const)
  test(`тест ${width}px ${theme}: широкая рабочая область вопроса и финального разбора`, async ({ page }) => {
    const selected = selectQuiz(quizBank, 42);
    const pair = selected.find(definition => definition.type === 'MatchPairs')!;
    const active = createAttempt(selected, 42, 'quiz-layout');
    active.position = active.ids.indexOf(pair.id);
    let final = createAttempt(selected, 42, 'quiz-layout-final');
    for (const definition of selected) final = quizReducer(final, { type: 'skip', id: definition.id }, selected);
    final = quizReducer(final, { type: 'finish' }, selected);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    }, { key: PROGRESS_KEY, state: { ...defaultProgress(), theme, active } });
    await page.goto('/quiz/');
    const editor = page.locator('[data-exercise-type="MatchPairs"]');
    await editor.scrollIntoViewIfNeeded();
    await expect(editor.getByRole('button', { name: 'Проверить ответ' })).toHaveCount(0);
    await expect(editor.locator('[data-drag-id]').first()).toBeEnabled();
    const dimensions = await editor.evaluate(element => ({
      block: element.getBoundingClientRect().width,
      text: document.querySelector('main .prose p')!.getBoundingClientRect().width,
      target: element.querySelector('[data-drop-id]')!.getBoundingClientRect().toJSON(),
      bank: element.querySelector('[aria-label="Доступные описания"]')!.getBoundingClientRect().toJSON(),
    }));
    if (width === 1440) {
      expect(dimensions.block).toBeCloseTo(1000, 0);
      expect(dimensions.text).toBeLessThanOrEqual(672);
      expect(dimensions.bank.x).toBeGreaterThan(dimensions.target.x + dimensions.target.width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
      key: PROGRESS_KEY, state: { ...defaultProgress(), theme, latest: final },
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Итоговый результат' })).toBeVisible();
    await page.locator('details').nth(active.position).locator('summary').click();
    const reviewed = page.locator('details[open] [data-exercise-type="MatchPairs"]');
    if (width === 1440) expect((await reviewed.boundingBox())!.width).toBeCloseTo(1000, 0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
