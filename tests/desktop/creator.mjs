import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from '@playwright/test';

const folder = await mkdtemp(path.join(os.tmpdir(), 'pcag-desktop-'));
const profile = await mkdtemp(path.join(os.tmpdir(), 'pcag-desktop-profile-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
let app;
try {
  app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], env });
  await app.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, folder);
  const page = await app.firstWindow();
  await page.getByRole('button', { name: /Create a new project/ }).click();
  await page.getByLabel('Project name').fill('Desktop Test');
  await page.getByRole('button', { name: 'Select project folder' }).click();
  await page.getByRole('button', { name: 'Create project', exact: true }).click();
  await page.getByText('Desktop Test').first().waitFor();
  const manifest = JSON.parse(await readFile(path.join(folder, 'workspace.json'), 'utf8'));
  assert.equal(manifest.project.name, 'Desktop Test');
  assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await page.getByRole('treeitem', { name: 'Background' }).waitFor();
  assert.ok(await page.getByRole('treeitem', { name: 'Background' }).locator('img').evaluate(async image => {
    if (!(image instanceof HTMLImageElement)) return false;
    await image.decode();
    return image.naturalWidth > 0;
  }));
  const outside = path.join(profile, 'outside.png');
  const selected = path.join(folder, 'backgrounds', 'another.png');
  await copyFile(path.join(folder, 'backgrounds', 'blank.png'), outside);
  await copyFile(path.join(folder, 'backgrounds', 'blank.png'), selected);
  await app.evaluate(({ dialog }, { image, backgrounds }) => {
    dialog.showOpenDialog = async options => {
      if (options.defaultPath !== backgrounds) throw new Error('Background picker did not start in the project backgrounds folder.');
      return { canceled: false, filePaths: [image] };
    };
  }, { image: outside, backgrounds: path.join(folder, 'backgrounds') });
  await page.getByRole('button', { name: 'Browse backgrounds…' }).click();
  await page.getByRole('alert').filter({ hasText: 'backgrounds folder' }).waitFor();
  assert.equal(await page.getByLabel('Scene background').inputValue(), 'backgrounds/blank.png');
  await app.evaluate(({ dialog }, image) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [image] }); }, selected);
  await page.getByRole('button', { name: 'Browse backgrounds…' }).click();
  await page.getByLabel('Scene background').evaluate(async element => {
    const input = element;
    for (let attempt = 0; attempt < 50 && input.value !== 'backgrounds/another.png'; attempt++) await new Promise(resolve => setTimeout(resolve, 100));
  });
  assert.equal(await page.getByLabel('Scene background').inputValue(), 'backgrounds/another.png');
  assert.equal(JSON.parse(await readFile(path.join(folder, 'workspace.json'), 'utf8')).project.rooms[0].backgroundPath, 'backgrounds/another.png');
  await page.getByRole('button', { name: 'Undo' }).click();
  assert.equal(await page.getByLabel('Scene background').inputValue(), 'backgrounds/blank.png');
  assert.ok((await stat(selected)).isFile());
  await page.getByRole('button', { name: 'Redo' }).click();
  assert.equal(await page.getByLabel('Scene background').inputValue(), 'backgrounds/another.png');
  await page.getByRole('button', { name: 'Project', exact: true }).click();
  const zipPath = path.join(folder, 'player.zip');
  await app.evaluate(({ session }, target) => {
    session.defaultSession.on('will-download', (_event, item) => item.setSavePath(target));
  }, zipPath);
  await page.getByRole('button', { name: 'Export player ZIP' }).click();
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await stat(zipPath).then(value => value.size > 0).catch(() => false)) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok((await stat(zipPath)).size > 0);
  const recent = await page.evaluate(() => window.pcagDesktop.invoke('recent-folder'));
  assert.equal(recent.root, folder);
  await assert.rejects(page.evaluate(root => window.pcagDesktop.invoke('read', root, '../outside'), recent.root), /Invalid project path/);
  console.log('Electron creator created a local project through the Node bridge.');
} finally {
  await app?.close();
  await rm(folder, { recursive: true, force: true });
  await rm(profile, { recursive: true, force: true });
}
