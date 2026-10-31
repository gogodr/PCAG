import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from '@playwright/test';

const folder = await mkdtemp(path.join(os.tmpdir(), 'pcag-state-'));
const profile = await mkdtemp(path.join(os.tmpdir(), 'pcag-state-profile-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  await app.evaluate(({ dialog }, selected) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] }); }, folder);
  const page = await app.firstWindow();
  await page.getByRole('button', { name: /Create a new project/ }).click();
  await page.getByLabel('Project name').fill('State round trip');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByRole('treeitem', { name: 'SceneState' }).click();
  await page.getByRole('button', { name: 'Add variable' }).click();
  await page.getByLabel('Variable name').fill('roomVisited');
  await page.getByLabel('Variable name').press('Enter');
  await page.getByRole('group', { name: 'Variable roomVisited' }).getByLabel('Variable value').selectOption('true');
  await page.getByRole('treeitem', { name: 'GameState' }).click();
  await page.getByRole('button', { name: 'Add variable' }).click();
  await page.getByLabel('Variable name').fill('playerName');
  await page.getByLabel('Variable name').press('Enter');
  await page.getByRole('group', { name: 'Variable playerName' }).getByLabel('Variable type').selectOption('Text');
  await page.getByRole('group', { name: 'Variable playerName' }).getByLabel('Variable value').fill('Ari');
  await page.getByRole('group', { name: 'Variable playerName' }).getByLabel('Variable default value').fill('Guest');
  await page.getByRole('button', { name: 'Add scene' }).click();
  await page.getByLabel('Scene name').fill('Second scene');
  await page.getByLabel('Scene name').press('Enter');
  await page.getByRole('treeitem', { name: 'SceneState' }).click();
  assert.equal(await page.getByRole('group', { name: /Variable/ }).count(), 0);
  await page.getByRole('treeitem', { name: 'GameState' }).click();
  assert.equal(await page.getByRole('group', { name: 'Variable playerName' }).getByLabel('Variable value').inputValue(), 'Ari');

  let manifest;
  for (let attempt = 0; attempt < 50; attempt++) {
    manifest = JSON.parse(await readFile(path.join(folder, 'workspace.json'), 'utf8'));
    if (manifest.project.gameState?.playerName?.value === 'Ari' && manifest.project.rooms.length === 2) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.deepEqual(manifest.project.gameState, { playerName: { value: 'Ari', defaultValue: 'Guest' } });
  assert.deepEqual(manifest.project.rooms[0].sceneState, { roomVisited: { value: true, defaultValue: false } });
  assert.deepEqual(manifest.project.rooms[1].sceneState, {});

  await page.reload();
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByLabel('Select scene').selectOption({ label: 'Scene 1' });
  await page.getByRole('treeitem', { name: 'SceneState' }).click();
  assert.equal(await page.getByRole('group', { name: 'Variable roomVisited' }).getByLabel('Variable value').inputValue(), 'true');
  await page.getByRole('treeitem', { name: 'GameState' }).click();
  assert.equal(await page.getByRole('group', { name: 'Variable playerName' }).getByLabel('Variable value').inputValue(), 'Ari');
  assert.equal(await page.getByRole('group', { name: 'Variable playerName' }).getByLabel('Variable default value').inputValue(), 'Guest');
  console.log('Electron SceneState and GameState round trip passed.');
} finally {
  await app?.close();
  await rm(folder, { recursive: true, force: true });
  await rm(profile, { recursive: true, force: true });
}
