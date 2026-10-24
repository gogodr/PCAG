import { expect, test } from '@playwright/test';
import { installFolderPicker, readProjectFile } from './folder-picker';

test('landing choices create a local folder project that persists after reload', async ({ page, baseURL }, testInfo) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  const folder = `pcag-test-${crypto.randomUUID()}`;
  await installFolderPicker(page, [folder, folder, folder]);
  const fresh = new URL(baseURL);
  fresh.search = '?fresh=1';
  await page.goto(fresh.href);
  await expect(page.getByRole('navigation', { name: 'Editor views' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create a new project' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import a PCAG project file' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue a local project' })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('project-landing.png'), fullPage: true });

  await page.getByRole('button', { name: 'Create a new project' }).click();
  await expect(page.getByLabel('Project name')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create project' })).toBeDisabled();
  await page.getByLabel('Project name').fill('Forest trail');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await expect(page.getByText(`Project folder: ${folder}`)).toBeVisible();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Forest trail');
  await expect(page.getByRole('navigation', { name: 'Editor views' })).toBeVisible();
  await expect.poll(async () => new TextDecoder().decode(await readProjectFile(page, folder, 'workspace.json'))).toContain('Forest trail');
  expect((await readProjectFile(page, folder, 'backgrounds/blank.png')).length).toBeGreaterThan(0);

  await page.getByLabel('Project name').fill('Forest path');
  await expect.poll(async () => new TextDecoder().decode(await readProjectFile(page, folder, 'workspace.json'))).toContain('Forest path');
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page.getByRole('button', { name: /images/ }).click();
  await page.getByLabel('Asset files').setInputFiles({ name: 'marker.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=', 'base64') });
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/marker.png').catch(() => new Uint8Array())).length).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'marker.png' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Rename' }).click();
  await page.getByLabel('File or folder name').fill('sign.png');
  await page.getByLabel('File or folder name').press('Enter');
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/sign.png').catch(() => new Uint8Array())).length).toBeGreaterThan(0);
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/marker.png').catch(() => null)) === null).toBe(true);

  fresh.search = '';
  await page.goto(fresh.href);
  await expect(page.getByLabel('Project name')).toHaveValue('Forest path');
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'images' }).click();
  await expect(page.getByRole('button', { name: 'sign.png' })).toBeVisible();
  await page.getByRole('button', { name: 'sign.png' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/sign.png').catch(() => null)) === null).toBe(true);
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  await page.getByRole('button', { name: 'Open another project' }).click();
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.getByLabel('Project name').fill('Should not overwrite');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose an empty project folder');
  await page.getByRole('button', { name: /All options/ }).click();
  await page.getByRole('button', { name: 'Continue a local project' }).click();
  await expect(page.getByLabel('Project name')).toHaveCount(0);
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Continue project' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('Forest path');
  await expect(page.getByRole('heading', { name: 'Project actions' })).toBeVisible();
  await page.getByRole('button', { name: 'Close project' }).click();
  await expect(page.getByRole('button', { name: 'Create a new project' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Editor views' })).toHaveCount(0);
  expect(new TextDecoder().decode(await readProjectFile(page, folder, 'workspace.json'))).toContain('Forest path');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Continue a local project' })).toBeVisible();
});

test('assets are scanned from the project folder and omitted from the local manifest', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  const folder = `pcag-scan-${crypto.randomUUID()}`;
  await installFolderPicker(page, [folder]);
  const fresh = new URL(baseURL);
  fresh.search = '?fresh=1';
  await page.goto(fresh.href);
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.getByLabel('Project name').fill('Disk assets');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Create project' }).click();

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=', 'base64');
  await page.evaluate(async ({ folder, image }) => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
    const images = await root.getDirectoryHandle('images');
    const nested = await images.getDirectoryHandle('external', { create: true });
    const file = await nested.getFileHandle('outside.png', { create: true });
    const writable = await file.createWritable();
    await writable.write(new Uint8Array(image));
    await writable.close();
  }, { folder, image: [...png] });

  await page.getByLabel('Project name').fill('Disk assets updated');
  await expect.poll(async () => JSON.parse(new TextDecoder().decode(await readProjectFile(page, folder, 'workspace.json'))).project.name).toBe('Disk assets updated');
  expect([...(await readProjectFile(page, folder, 'images/external/outside.png'))]).toEqual([...png]);
  const manifest = JSON.parse(new TextDecoder().decode(await readProjectFile(page, folder, 'workspace.json')));
  expect(manifest.format).toBe('pcag-local-project');
  expect(manifest).not.toHaveProperty('files');
  expect(manifest).not.toHaveProperty('folders');
  expect(manifest.project).not.toHaveProperty('assets');

  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'images' }).click();
  await expect(page.getByRole('button', { name: 'external' })).toBeVisible();
  await page.getByRole('button', { name: 'external' }).click();
  await expect(page.getByRole('button', { name: 'outside.png' })).toBeVisible();

  await page.evaluate(async folder => {
    const root = await (await navigator.storage.getDirectory()).getDirectoryHandle(folder);
    const images = await root.getDirectoryHandle('images');
    const nested = await images.getDirectoryHandle('external');
    await nested.removeEntry('outside.png');
  }, folder);
  await page.getByRole('button', { name: 'Refresh' }).click();
  await expect(page.getByRole('button', { name: 'outside.png' })).toHaveCount(0);
});
