import { expect, test } from '@playwright/test';
import { installFolderPicker, readProjectFile } from './folder-picker';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=', 'base64');
const images = [
  { name: 'art.jpeg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
  { name: 'icon.png', mimeType: 'image/png', buffer: png },
  { name: 'vector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/></svg>') },
  { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) },
  { name: 'tile.webp', mimeType: 'image/webp', buffer: Buffer.from('RIFF0000WEBP') },
];
const audio = [
  { name: 'theme.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('ID3sound') },
  { name: 'step.wav', mimeType: 'audio/wav', buffer: Buffer.from('RIFF0000WAVE') },
  { name: 'wind.ogg', mimeType: 'audio/ogg', buffer: Buffer.from('OggSsound') },
];
const animation = [
  { name: 'walk.mp4', mimeType: 'video/mp4', buffer: Buffer.from('0000ftypisom0000') },
  { name: 'walk.webm', mimeType: 'video/webm', buffer: Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from('webm')]) },
  { name: 'walk.mov', mimeType: 'video/quicktime', buffer: Buffer.from('0000ftypqt  0000') },
  { name: 'walk.gif', mimeType: 'image/gif', buffer: Buffer.from('R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=', 'base64') },
];

test('all supported formats import into roots and subfolders and reopen', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  const folder = `formats-${crypto.randomUUID()}`;
  await installFolderPicker(page, [folder]);
  const fresh = new URL(baseURL); fresh.search = '?fresh=1';
  await page.goto(fresh.href);
  await page.getByRole('button', { name: 'Create a new project' }).click();
  await page.getByLabel('Project name').fill('Formats');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  for (const root of ['backgrounds', 'images', 'sounds', 'music', 'animation', 'video']) {
    const payloads = root === 'backgrounds' || root === 'images' ? images : root === 'animation' || root === 'video' ? animation : audio;
    await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: root }).click();
    await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 350 } });
    await page.getByRole('menuitem', { name: 'Import files' }).click();
    await page.getByLabel('Asset files').setInputFiles(payloads);
    for (const file of payloads) await expect.poll(async () => (await readProjectFile(page, folder, `${root}/${file.name}`).catch(() => null)) !== null).toBe(true);
    await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 350 } });
    await page.getByRole('menuitem', { name: 'New folder' }).click();
    await page.getByLabel('File or folder name').fill('nested');
    await page.getByLabel('File or folder name').press('Enter');
    await page.getByRole('region', { name: 'Folder contents' }).getByRole('button', { name: 'nested' }).click();
    await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 350 } });
    await page.getByRole('menuitem', { name: 'Import files' }).click();
    await page.getByLabel('Asset files').setInputFiles(payloads);
    for (const file of payloads) await expect.poll(async () => (await readProjectFile(page, folder, `${root}/nested/${file.name}`).catch(() => null)) !== null).toBe(true);
  }
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'images' }).click();
  await page.getByRole('region', { name: 'Folder contents' }).click({ button: 'right', position: { x: 250, y: 350 } });
  await page.getByRole('menuitem', { name: 'Import files' }).click();
  await page.getByLabel('Asset files').setInputFiles({ name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') });
  await expect(page.getByRole('alert')).toContainText('contents do not match');
  await expect.poll(async () => (await readProjectFile(page, folder, 'images/unsafe.svg').catch(() => null)) === null).toBe(true);
  fresh.search = '';
  await page.goto(fresh.href);
  await expect(page.getByLabel('Project name')).toHaveValue('Formats');
  await page.getByRole('button', { name: 'Assets', exact: true }).click();
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'images' }).click();
  await expect(page.getByRole('button', { name: 'vector.svg' })).toBeVisible();
  await page.getByRole('complementary', { name: 'Asset folders' }).getByRole('button', { name: 'video' }).click();
  await expect(page.getByRole('button', { name: 'walk.mp4' })).toBeVisible();
  await page.getByRole('button', { name: 'walk.mp4' }).click();
  await expect(page.getByRole('complementary', { name: 'Asset preview' }).locator('video[aria-label="walk.mp4"]')).toBeVisible();
});
