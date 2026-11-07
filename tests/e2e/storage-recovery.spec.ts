import { test, expect } from '@playwright/test';
import { quizBank } from '../../src/data/quiz/bank';
import { selectQuiz } from '../../src/domain/quiz/selection';
import { createAttempt } from '../../src/domain/quiz/state';
import { defaultProgress, PROGRESS_KEY } from '../../src/storage/progress';

test('отказ getter localStorage сообщает о работе в памяти до первого действия', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Storage denied', 'SecurityError'); } });
  });
  await page.goto('/quiz/');
  await expect(page.getByText('Браузер не разрешает сохранение.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Начать тест', exact: true }).click();
  await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Браузер не разрешает сохранение.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Начать тест', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const operation of ['getItem', 'setItem'] as const) {
  test(`отказ ${operation} оставляет тест работоспособным в памяти`, async ({ page }) => {
    await page.addInitScript(({ method, key }) => {
      const original = Storage.prototype[method];
      Object.defineProperty(Storage.prototype, method, { configurable: true, value: function (this: Storage, ...args: string[]) {
        if (args[0] === key) throw new DOMException('Storage denied', 'SecurityError');
        return Reflect.apply(original, this, args);
      } });
    }, { method: operation, key: PROGRESS_KEY });
    await page.goto('/quiz/');
    await page.getByRole('button', { name: 'Начать тест', exact: true }).click();
    await expect(page.getByText(operation === 'getItem' ? 'Локальные данные недоступны или повреждены.' : 'Браузер не разрешает сохранение.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
    await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Начать тест', exact: true })).toBeVisible();
  });
}

test('невозможная фаза отклоняется с предупреждением, новый тест работает в памяти', async ({ page }) => {
  const attempt = createAttempt(selectQuiz(quizBank, 42), 42, 'invalid-phase');
  attempt.phase = 'correctionInProgress';
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt } });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/quiz/');
  await expect(page.getByText('Локальные данные недоступны или повреждены.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Начать тест', exact: true }).click();
  await expect(page.getByText('Обработано 0 из 12', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Пропустить вопрос', exact: true }).click();
  await expect(page.getByText('Обработано 1 из 12', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('другая версия контента не продолжается молча и разрешает начать новую попытку', async ({ page }) => {
  const attempt = createAttempt(selectQuiz(quizBank, 42), 42, 'old-content');
  attempt.contentVersion = 1;
  await page.addInitScript(({ key, state }) => { if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state)); }, { key: PROGRESS_KEY, state: { ...defaultProgress(), active: attempt, best: { first: 70, final: 85 } } });
  await page.goto('/quiz/');
  await expect(page.getByText('Версия учебных заданий изменилась.', { exact: false })).toBeVisible();
  await expect(page.getByText('Лучшие завершённые результаты:', { exact: false })).toContainText('85%');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Начать новый тест', exact: true }).click();
  await expect(page.getByText('Обработано 0 из 12', { exact: true })).toBeVisible();
  await expect(page.getByText('Лучшие завершённые результаты:', { exact: false })).toContainText('85%');
});
