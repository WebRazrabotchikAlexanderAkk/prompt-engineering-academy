import { test, expect } from '@playwright/test';
import { quizBank } from '../../src/data/quiz/bank';
import { createAttempt } from '../../src/domain/quiz/state';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { presentQuestion } from '../../src/domain/quiz/presentation';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

test('порядок вариантов сохраняется при reload, коррекции и финальном разборе', async ({ page }) => {
  const selected = selectQuiz(quizBank, 42);
  const question = selected.find(item => item.type === 'MultipleChoice')!;
  const attempt = createAttempt(selected, 42, 'order-regression');
  const position = attempt.ids.indexOf(question.id);
  attempt.position = position;
  const display = presentQuestion(question, attempt);
  if (display.type !== 'MultipleChoice') throw Error('Нужен вопрос с вариантами');
  const labels = display.options.map(item => item.text);
  await page.addInitScript(({ key, state }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
  }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  await page.goto('/quiz/');
  const editor = page.locator('[data-exercise-type="MultipleChoice"]');
  await expect(editor.locator('label')).toHaveText(labels);
  await page.reload();
  await expect(editor.locator('label')).toHaveText(labels);
  for (let index = 0; index < 12; index++) await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Одна возможность исправить' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Вопросы теста' }).getByRole('button', { name: String(position + 1), exact: true }).click();
  await expect(editor.locator('label')).toHaveText(labels);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Завершить без остальных исправлений' }).click();
  const review = page.locator('details').nth(position);
  await review.locator('summary').click();
  await expect(review.locator('label')).toHaveText(labels);
  await page.reload();
  await review.locator('summary').click();
  await expect(review.locator('label')).toHaveText(labels);
});
