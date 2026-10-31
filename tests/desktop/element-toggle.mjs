import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from '@playwright/test';

const folder = await mkdtemp(path.join(os.tmpdir(), 'pcag-element-toggle-'));
const profile = await mkdtemp(path.join(os.tmpdir(), 'pcag-element-profile-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, folder);
  const page = await app.firstWindow();
  const errors = [];
  page.on('crash', () => errors.push('Renderer crashed.'));
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('button', { name: /Create a new project/ }).click();
  await page.getByLabel('Project name').fill('Element toggle test');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByRole('button', { name: 'Add element' }).click();
  await page.getByRole('menuitem', { name: 'Box element' }).click();
  await page.getByLabel('Element name').press('Enter');
  await page.getByRole('button', { name: 'Disable Element' }).click();
  await page.getByRole('button', { name: 'Enable Element' }).waitFor();
  let manifest;
  for (let attempt = 0; attempt < 50; attempt++) {
    manifest = JSON.parse(await readFile(path.join(folder, 'workspace.json'), 'utf8'));
    if (manifest.project.rooms[0].elements[0]?.enabled === false) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(manifest.project.rooms[0].elements[0].enabled, false);
  const backgroundPath = manifest.project.rooms[0].backgroundPath;
  const legacyMedia = { path: backgroundPath, kind: 'image', width: 100, height: 100, scale: 1, loop: true, reverse: false };
  manifest.project.rooms[0].elements.push(
    { id: 'legacy_image_a', name: 'Legacy image A', type: 'image', bounds: { x: 100, y: 100, width: 140, height: 60 }, media: legacyMedia },
    { id: 'legacy_image_b', name: 'Legacy image B', type: 'image', bounds: { x: 300, y: 100, width: 80, height: 120 }, media: legacyMedia },
  );
  await writeFile(path.join(folder, 'workspace.json'), JSON.stringify(manifest));
  await page.reload();
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByRole('button', { name: 'Enable Element' }).waitFor();
  await page.getByRole('treeitem', { name: 'Legacy image A' }).click();
  assert.equal(await page.getByLabel('Element width').inputValue(), '140');
  assert.equal(await page.getByLabel('Element height').inputValue(), '60');
  await page.getByRole('button', { name: 'Disable Legacy image A' }).click();
  for (let attempt = 0; attempt < 50; attempt++) {
    manifest = JSON.parse(await readFile(path.join(folder, 'workspace.json'), 'utf8'));
    if (manifest.project.rooms[0].elements[1]?.enabled === false) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(manifest.project.rooms[0].elements[1].enabled, false);
  assert.deepEqual(manifest.project.rooms[0].elements.slice(1).map(element => element.bounds), [
    { x: 100, y: 100, width: 140, height: 60 }, { x: 300, y: 100, width: 80, height: 120 },
  ]);
  assert.ok(manifest.project.rooms[0].elements.slice(1).every(element => !('scale' in element.media)));
  assert.deepEqual(errors, []);
  console.log('Electron element disable and legacy project reload passed.');
} finally {
  await app?.close();
  await rm(folder, { recursive: true, force: true });
  await rm(profile, { recursive: true, force: true });
}
