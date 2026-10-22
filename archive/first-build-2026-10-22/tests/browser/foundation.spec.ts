import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { unzipSync } from 'fflate';

test('authors a new scene, draws an object, backs up, saves, and reopens', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Adventure title').fill('A new beginning');
  await page.getByLabel('Room name', { exact: true }).fill('The workshop');
  await page.getByLabel('Import background file').setInputFiles('examples/foundation/study.png');
  await expect(page.getByRole('status').last()).toContainText('Background imported');
  await page.getByRole('button', { name: 'Draw hotspot', exact: false }).click();
  const bounds = (await page.getByTestId('room-canvas').boundingBox())!;
  await page.mouse.move(bounds.x + bounds.width * .3, bounds.y + bounds.height * .3);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * .5, bounds.y + bounds.height * .5);
  await page.mouse.up();
  await page.getByLabel('Object name').fill('A brass compass');
  await page.getByLabel('When inspected').fill('It points toward a story yet to be told.');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await expect(page.getByText('Saved in browser', { exact: true })).toBeVisible();
  const backup = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const backupFile = await (await backup).path();
  const saved = JSON.parse(await readFile(backupFile!, 'utf8'));
  expect(saved.rooms[0].hotspots).toHaveLength(1);
  expect(saved.rooms[0].hotspots[0].name).toBe('A brass compass');
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByLabel('Open project file').setInputFiles(backupFile!);
  await expect(page.getByLabel('Object name')).toHaveValue('A brass compass');
  await page.getByLabel('Object name').fill('An unsaved rename');
  await page.getByRole('button', { name: 'Reopen saved' }).click();
  await expect(page.getByLabel('Object name')).toHaveValue('A brass compass');
  await page.reload();
  await expect(page.getByLabel('Adventure title')).toHaveValue('A new beginning');
  await page.getByRole('button', { name: 'Playtest' }).click();
  await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'View A brass compass', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.pcag-caption')).toHaveText('Alex: It points toward a story yet to be told.');
});

test('preview restarts cleanly, supports sound startup, and preserves authored text', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const inspection = await page.getByLabel('When inspected').inputValue();
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'Playtest' }).click();
    await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
    await expect(page.locator('canvas')).toHaveCount(1);
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('button', { name: 'View A folded note', exact: true }).click();
    await expect(page.locator('.pcag-caption')).toHaveText(`Alex: ${inspection}`);
    await page.getByRole('button', { name: 'Restart', exact: false }).click();
    await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
    await expect(page.locator('.pcag-caption')).toContainText('Look around');
    await page.getByRole('button', { name: 'Edit scene' }).click();
    await expect(page.locator('canvas')).toHaveCount(0);
    await expect(page.getByLabel('When inspected')).toHaveValue(inspection);
  }
  await page.getByRole('button', { name: 'Playtest' }).click();
  await page.getByRole('button', { name: 'Test sound', exact: true }).click();
  await expect(page.locator('.pcag-caption')).toHaveText('Alex: Sound is ready.');
  expect(errors).toEqual([]);
});

test('invalid edits and imports cannot overwrite a healthy saved project', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  const saved = await page.evaluate(() => localStorage.getItem('pcag.project.v2'));
  await page.locator('#field-x').fill('959');
  await expect(page.getByRole('button', { name: 'Save project', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Keep A folded note inside the room.', exact: false }).click();
  await expect(page.locator('#field-x')).toBeFocused();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save project', exact: true })).toBeEnabled();
  await page.getByLabel('Open project file').setInputFiles({ name: 'broken.pcag.json', mimeType: 'application/json', buffer: Buffer.from('{"formatVersion":999}') });
  await expect(page.getByRole('alert')).toContainText('not supported');
  expect(await page.evaluate(() => localStorage.getItem('pcag.project.v2'))).toBe(saved);
  await expect(page.getByLabel('Object name')).toHaveValue('A folded note');
  const corruptImage = JSON.parse(saved!);
  corruptImage.assets[0].dataUrl = 'data:image/png;base64,aGVsbG8=';
  await page.getByLabel('Open project file').setInputFiles({ name: 'corrupt.pcag.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(corruptImage)) });
  await expect(page.getByRole('alert')).toContainText('could not be opened');
  expect(await page.evaluate(() => localStorage.getItem('pcag.project.v2'))).toBe(saved);
});

test('exports a standalone game that works at a nested static URL without the creator', async ({ page, browser }) => {
  await page.goto('/');
  await page.getByLabel('When inspected').fill('The export remembers this clue.');
  await page.getByRole('button', { name: 'Edit room The hall', exact: true }).click();
  await page.getByLabel('Room width', { exact: true }).fill('640');
  await page.getByRole('button', { name: 'Floor', exact: true }).click();
  await page.locator('#field-width').fill('640');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export game', exact: false }).click();
  const download = await downloaded;
  const archive = unzipSync(await readFile((await download.path())!));
  expect(Object.keys(archive)).not.toContain('editor.json');
  const server = createServer((request, response) => {
    const prefix = '/games/my-adventure/';
    const path = request.url?.startsWith(prefix) ? request.url.slice(prefix.length).split('?')[0] || 'index.html' : '';
    const content = archive[path];
    if (!content) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.json') ? 'application/json' : 'text/html');
    response.end(content);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Static server did not start.');
  const context = await browser.newContext();
  try {
    const player = await context.newPage();
    const errors: string[] = [];
    player.on('pageerror', e => errors.push(e.message));
    await player.goto(`http://127.0.0.1:${address.port}/games/my-adventure/`);
    await expect(player.locator('[data-ready="true"]')).toHaveCount(1);
    await player.getByRole('button', { name: 'View', exact: true }).click();
    await player.getByRole('button', { name: 'View A folded note', exact: true }).click();
    await expect(player.locator('.pcag-caption')).toHaveText('Alex: The export remembers this clue.');
    await expect(player).toHaveTitle('The quiet study');
    await player.setViewportSize({ width: 1100, height: 800 });
    await expect.poll(async () => player.locator('.pcag-viewport').evaluate(e => {
      const bounds = e.getBoundingClientRect(), canvas = e.querySelector('canvas')!.getBoundingClientRect();
      return Math.abs(bounds.top - canvas.top) + Math.abs(bounds.left - canvas.left) + Math.abs(bounds.width - canvas.width) + Math.abs(bounds.height - canvas.height);
    })).toBeLessThan(2);
    await player.getByRole('button', { name: 'Exit To the hall', exact: true }).click();
    await expect(player.locator('.pcag-player')).toHaveAttribute('data-room-id', 'room_hall', { timeout: 9000 });
    await expect(player.getByLabel('Playable character Alex')).toHaveAttribute('data-x', '150.00');
    await expect.poll(async () => player.locator('.pcag-viewport').evaluate(e => {
      const bounds = e.getBoundingClientRect(), canvas = e.querySelector('canvas')!.getBoundingClientRect();
      return Math.abs(bounds.top - canvas.top) + Math.abs(bounds.left - canvas.left) + Math.abs(bounds.width - canvas.width) + Math.abs(bounds.height - canvas.height);
    })).toBeLessThan(2);
    await player.getByRole('button', { name: 'Exit Back to the study', exact: true }).click();
    await expect(player.locator('.pcag-player')).toHaveAttribute('data-room-id', 'room_study');
    expect(errors).toEqual([]);
  } finally { await context.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
