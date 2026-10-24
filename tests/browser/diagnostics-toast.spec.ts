import { expect, test } from '@playwright/test';

test('diagnostics appear as stackable, dismissible, temporary toasts', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  await page.clock.install();
  await page.goto(baseURL);
  const stack = page.getByLabel('Notifications');
  await expect(stack.getByRole('status')).toContainText('Project checks passed.');
  await expect(stack.getByRole('status')).toHaveCSS('animation-name', 'toast-in');
  const box = await stack.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x + box!.width).toBeGreaterThan(viewport!.width - 50);
  expect(box!.y + box!.height).toBeGreaterThan(viewport!.height - 50);
  await stack.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(stack.getByRole('status')).toHaveCSS('animation-name', 'toast-out');
  await page.clock.fastForward(220);
  await expect(stack).toHaveCount(0);

  await page.getByLabel('Project name').fill('');
  await page.getByLabel('Target width').fill('0');
  await expect(stack.getByRole('alert').first()).toBeVisible();
  const count = await stack.getByRole('alert').count();
  expect(count).toBeGreaterThanOrEqual(2);
  await stack.getByRole('button').first().click();
  await page.clock.fastForward(220);
  await expect(stack.getByRole('alert')).toHaveCount(count - 1);
  await page.clock.fastForward(5_220);
  await expect(stack).toHaveCount(0);
});

test('the same error appears again after dismissal and timeout', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  await page.clock.install();
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByRole('button', { name: 'Add scene' }).click();
  const name = page.getByLabel('Scene name');
  await name.fill('');
  const stack = page.getByLabel('Notifications');
  const error = stack.getByRole('alert').filter({ hasText: 'Enter a scene name.' });

  await name.press('Enter');
  await expect(error).toHaveCount(1);
  await error.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.clock.fastForward(220);
  await expect(error).toHaveCount(0);

  await name.press('Enter');
  await expect(error).toHaveCount(1);
  await page.clock.fastForward(5_220);
  await expect(error).toHaveCount(0);

  await name.press('Enter');
  await expect(error).toHaveCount(1);
});
