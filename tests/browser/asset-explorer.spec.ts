import { expect, test } from '@playwright/test';
import { installFolderPicker, readProjectFile } from './folder-picker';

const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=', 'base64');

test('asset explorer imports, previews, copies, moves, and persists files', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  const folder = `assets-${crypto.randomUUID()}`;
  await installFolderPicker(page, [folder]);
  const fresh = new URL(baseURL); fresh.search = '?fresh=1';
  await page.goto(fresh.href);
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.getByLabel('Project name').fill('Asset test');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Import files' })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Asset preview' }).getByRole('button', { name: 'Add folder' })).toHaveCount(0);
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'images' }).click();
  await expect(page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: '..' })).toHaveCount(0);
  await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 300 } });
  await page.getByRole('menuitem', { name: 'New folder' }).click();
  await expect(page.getByLabel('File or folder name')).toHaveValue('New Folder');
  await expect(page.getByLabel('File or folder name')).toBeFocused();
  expect(await page.getByLabel('File or folder name').evaluate(input => (input as HTMLInputElement).selectionEnd)).toBe('New Folder'.length);
  await page.getByLabel('File or folder name').fill('characters');
  await page.getByLabel('File or folder name').press('Enter');
  await expect(page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'characters' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Asset path' }).getByRole('button', { name: 'characters' })).toHaveCount(0);
  await page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'characters' }).click({ button: 'right' });
  await expect(page.getByRole('navigation', { name: 'Asset path' }).getByRole('button', { name: 'images' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'characters' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Copy' }).click();

  await page.getByRole('region', { name: 'Folder contents' }).evaluate((element, bytes) => {
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(bytes), character => character.charCodeAt(0))], 'hero.png', { type: 'image/png' }));
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  }, pixel.toString('base64'));
  await expect(page.getByRole('button', { name: 'hero.png' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Asset preview' }).getByRole('img', { name: 'hero.png' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Asset preview' }).getByRole('button', { name: 'Remove' })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Asset preview' }).getByRole('heading', { name: 'hero.png' })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Asset preview' }).locator('p.subtle')).toHaveCount(0);
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/hero.png').catch(() => new Uint8Array())).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'hero.png' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  expect(await page.getByLabel('File or folder name').evaluate(input => (input as HTMLInputElement).selectionEnd)).toBe('hero'.length);
  await page.getByLabel('File or folder name').press('Enter');

  await page.getByRole('button', { name: 'hero.png' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy' }).click();
  await page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'characters' }).click();
  await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 300 } });
  await page.getByRole('menuitem', { name: 'Paste' }).click();
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/characters/hero.png').catch(() => new Uint8Array())).length).toBeGreaterThan(0);
  await page.getByRole('navigation', { name: 'Asset path' }).getByRole('button', { name: 'images' }).click();
  await page.getByRole('button', { name: 'hero.png' }).dragTo(page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'characters' }));
  await expect(page.getByRole('alert')).toContainText('already used');

  await page.getByRole('button', { name: 'hero.png' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Copy' }).click();
  for (const number of [2, 3]) {
    await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 300 } });
    await page.getByRole('menuitem', { name: 'Paste' }).click();
    await expect.poll(async () => (await readProjectFile(page, folder, `images/hero(${number}).png`).catch(() => null)) !== null).toBe(true);
  }

  await page.getByRole('button', { name: 'hero.png' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Cut' }).click();
  await page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'characters' }).click();
  await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 300 } });
  await expect(page.getByRole('menuitem', { name: 'Paste' })).toBeEnabled();
  await page.getByRole('menuitem', { name: 'Paste' }).click();
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/characters/hero(2).png').catch(() => null)) !== null).toBe(true);
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/hero.png').catch(() => null)) === null).toBe(true);
  await page.getByRole('navigation', { name: 'Asset path' }).getByRole('button', { name: 'images' }).click();
  await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 300 } });
  await expect(page.getByRole('menuitem', { name: 'Import files' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Import files' }).click();
  await page.getByLabel('Asset files').setInputFiles({ name: 'second.png', mimeType: 'image/png', buffer: pixel });
  await expect(page.getByRole('button', { name: 'second.png' })).toBeVisible();
  await page.getByRole('button', { name: 'second.png' }).dragTo(page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'characters' }));
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/characters/second.png').catch(() => new Uint8Array())).length).toBeGreaterThan(0);
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/second.png').catch(() => null)) === null).toBe(true);
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'images' }).click({ button: 'right' });
  await expect(page.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  fresh.search = '';
  await page.goto(fresh.href);
  await expect(page.getByLabel('Project name')).toHaveValue('Asset test');
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'images' }).click();
  await expect(page.getByRole('button', { name: 'hero(2).png' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'hero(3).png' })).toBeVisible();
});
