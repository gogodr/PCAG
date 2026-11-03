import assert from 'node:assert/strict';
import { _electron as electron } from '@playwright/test';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ['.'], env });
try {
  const editor = await app.firstWindow();
  await editor.goto(new URL('../../dist/creator/index.html?sample', import.meta.url).href);
  await editor.getByRole('button', { name: 'Scenes', exact: true }).click();
  const opened = app.waitForEvent('window');
  await editor.getByRole('button', { name: 'Play scene' }).click();
  const scene = await opened;
  await scene.getByText('Game view ready.').waitFor({ timeout: 15_000 });
  await scene.getByRole('checkbox', { name: 'Debug walk path' }).waitFor();
  assert.equal(await scene.locator('.preview-stage canvas').count(), 1);
  assert.equal(await editor.getByRole('tree', { name: 'Scene element tree' }).count(), 1);
  await scene.getByRole('button', { name: 'Close preview' }).click();
  assert.equal(scene.isClosed(), true);
} finally {
  await app.close();
}
