import { test, expect } from '@playwright/test';

test('imports and maps a character sheet, tracks references, and preserves mappings after reload', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Import library image').setInputFiles('examples/foundation/explorer.png');
  await expect(page.getByLabel('Selected asset')).toHaveValue(/asset_/);
  for (const mode of ['idle', 'walk', 'talk']) {
    await page.getByText(`${mode[0].toUpperCase() + mode.slice(1)} animation`, { exact: true }).click();
    await page.getByLabel(`${mode} sprite sheet`, { exact: true }).selectOption({ label: 'explorer.png' });
  }
  await page.getByLabel('Character name', { exact: true }).fill('Robin');
  await page.getByLabel('Character height', { exact: true }).fill('110');
  await expect(page.getByRole('button', { name: 'Delete unused asset', exact: true })).toBeDisabled();
  await page.getByLabel('Selected asset').selectOption({ label: 'Starter explorer sprite sheet' });
  await expect(page.getByRole('button', { name: 'Delete unused asset', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Delete unused asset', exact: true }).click();
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('Character name', { exact: true })).toHaveValue('Robin');
  await page.getByRole('button', { name: 'Playtest', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
  await expect(page.getByLabel('Playable character Robin')).toHaveAttribute('data-mode', 'idle');
});

test('authors an image layer and protects its shared asset until the layer is removed', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Import library image').setInputFiles('examples/foundation/study.png');
  await expect(page.getByLabel('Selected asset')).toHaveValue(/asset_/);
  await page.getByRole('button', { name: 'Add image layer', exact: true }).click();
  await page.getByLabel('Element name', { exact: true }).fill('Study painting');
  await page.getByLabel('Layer depth').selectOption('front');
  await expect(page.getByRole('button', { name: 'Select layer Study painting', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete unused asset', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await page.getByRole('button', { name: 'Delete element', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Delete unused asset', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Select layer Study painting', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Select layer Study painting', exact: true })).toBeVisible();
});
