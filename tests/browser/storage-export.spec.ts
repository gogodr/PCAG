import { copyFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { expect, test } from '@playwright/test';
import { readWorkspaceArchive, writeWorkspaceArchive } from './workspace-archive';
import { installFolderPicker } from './folder-picker';

function storedZipFiles(data: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  let offset = 0;
  while (data.readUInt32LE(offset) === 0x04034b50) {
    const size = data.readUInt32LE(offset + 18);
    const nameLength = data.readUInt16LE(offset + 26);
    const extraLength = data.readUInt16LE(offset + 28);
    const name = data.toString('utf8', offset + 30, offset + 30 + nameLength);
    const start = offset + 30 + nameLength + extraLength;
    files.set(name, data.subarray(start, start + size));
    offset = start + size;
  }
  expect(data.readUInt32LE(offset)).toBe(0x02014b50);
  return files;
}

test('project export, reopen, invalid-file preservation, and independent HTTP player export', async ({ page, baseURL }, testInfo) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  const sample = JSON.parse(await readFile(new URL('../../examples/reference-adventure/project.json', import.meta.url), 'utf8'));
  const alternateBackground = sample.assets.find((asset: { path: string }) => asset.path === 'backgrounds/scene_1/bg.png').id;
  await installFolderPicker(page, Array.from({ length: 4 }, () => `import-${crypto.randomUUID()}`));
  const importFile = async (name: string, buffer: Buffer) => {
    await page.getByRole('button', { name: 'Open another project' }).click();
    await page.getByRole('button', { name: 'Import a PCAG project file' }).click();
    await page.getByLabel('PCAG project file').setInputFiles({ name, mimeType: 'application/octet-stream', buffer });
    await page.getByRole('button', { name: 'Select project folder' }).click();
    await page.getByRole('button', { name: 'Import project', exact: true }).click();
  };
  await page.goto(baseURL);
  await expect(page.getByRole('status')).toContainText('Project checks passed.');
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByLabel('Scene background').selectOption(alternateBackground);
  await page.getByRole('button', { name: 'Add element' }).click();
  await page.getByRole('menu', { name: 'Add element type' }).getByRole('menuitem', { name: 'Hotspot' }).click();
  await page.getByLabel('Element name').press('Enter');
  await page.getByRole('button', { name: 'Project', exact: true }).click();

  const saveEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export project' }).click();
  const saved = await saveEvent;
  expect(saved.suggestedFilename()).toBe('project.pcag');
  const savedBytes = await readFile(await saved.path());
  const savedWorkspace = readWorkspaceArchive(savedBytes);
  const savedProject = savedWorkspace.project;
  expect(savedProject.rooms[0].hotspots[0].name).toBe('Hotspot');
  expect(savedProject.rooms[0].hotspots[0].id).toMatch(/^id_/);

  await page.getByLabel('Project name').fill('Unsaved change');
  await importFile('project.pcag', savedBytes);
  await expect(page.getByLabel('Project name')).toHaveValue('New name');
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await expect(page.getByLabel('Scene background')).toHaveValue(alternateBackground);
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const damaged = Buffer.from(savedBytes);
  damaged[damaged.length - 1] = damaged[damaged.length - 1]! ^ 1;
  await importFile('damaged.pcag', damaged);
  await expect(page.getByRole('alert').filter({ hasText: 'integrity check failed' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to current project' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('New name');
  await importFile('bad.pcag', Buffer.from('{broken'));
  await expect(page.getByRole('alert').filter({ hasText: 'Current project was kept' }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Back to current project' }).click();
  await expect(page.getByLabel('Project name')).toHaveValue('New name');
  const unmapped = structuredClone(savedWorkspace);
  unmapped.project.assets[1].path = 'backgrounds/unavailable.png';
  await importFile('unmapped.pcag', writeWorkspaceArchive(unmapped));
  await expect(page.getByRole('alert').filter({ hasText: 'missing from the workspace files' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to current project' }).click();

  const exportEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export player ZIP' }).click();
  const exported = await exportEvent;
  expect(exported.suggestedFilename()).toBe('pcag-player.zip');
  const zipPath = await exported.path();
  await copyFile(zipPath, testInfo.outputPath('pcag-player.zip'));
  const files = storedZipFiles(await readFile(zipPath));
  expect(files.has('index.html')).toBe(true);
  expect(files.has('backgrounds/scene_1/bg.png')).toBe(true);
  const exportedProject = JSON.parse(files.get('project.json')!.toString('utf8'));
  expect({ ...exportedProject, assets: exportedProject.assets.toSorted((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)) })
    .toEqual({ ...savedProject, assets: savedProject.assets.toSorted((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)) });

  const server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0]!).replace(/^\//, '') || 'index.html';
    const body = files.get(path);
    if (!body) { response.writeHead(404).end(); return; }
    const type = path.endsWith('.js') ? 'text/javascript' : path.endsWith('.css') ? 'text/css' : path.endsWith('.png') ? 'image/png' : path.endsWith('.json') ? 'application/json' : 'text/html';
    response.writeHead(200, { 'content-type': type }).end(body);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Export test server has no port.');
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await expect(page.getByRole('status').first()).toHaveText('Game view ready.');
    const canvas = page.locator('#stage canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Exported canvas has no box.');
    await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
    await expect(page.locator('#observation')).toHaveText('You see Hotspot.');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
