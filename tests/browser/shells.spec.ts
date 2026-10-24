import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const sample = JSON.parse(await readFile(new URL('../../examples/reference-adventure/project.json', import.meta.url), 'utf8'));
const alternateBackground = sample.assets.find((asset: { path: string }) => asset.path === 'backgrounds/scene_1/bg.png').id;
const originalBackground = sample.rooms[0].backgroundAssetId;

for (const app of ['creator', 'player'] as const) {
  test(`${app} shell boots without browser errors`, async ({ page, baseURL }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`Failed request: ${request.url()}`));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });

    if (!baseURL) throw new Error('The test project must specify its creator baseURL.');
    const url = new URL(baseURL);
    if (app === 'player') url.port = String(Number(url.port) + 1);
    await page.goto(url.href);
    await expect(page).toHaveTitle(app === 'creator' ? 'PCAG Creator' : 'PCAG Player');
    if (app === 'creator') {
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Project');
      await expect(page.getByRole('status')).toContainText('Project checks passed.');
      await expect(page.getByLabel('Project name')).toHaveValue('New name');
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'PCAG Creator home' })).toBeFocused();
    } else {
      await expect(page.getByRole('status')).toHaveText('Game view ready.');
      await expect(page.locator('#stage canvas')).toBeVisible();
      await expect(page.locator('#stage canvas')).toHaveAttribute('width', '1600');
    }
    await page.screenshot({ path: testInfo.outputPath(`${app}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('player fits and centers a 16:9 game inside a resized embed', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  const url = new URL(baseURL);
  url.port = String(Number(url.port) + 1);
  await page.setContent('<iframe title="Adventure" style="width:640px;height:520px;border:0"></iframe>');
  await page.locator('iframe').evaluate((element, src) => { element.setAttribute('src', src); }, url.href);
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('status')).toHaveText('Game view ready.');
  await expect(frame.locator('header, footer, h1')).toHaveCount(0);
  for (const width of [640, 360]) {
    await page.locator('iframe').evaluate((element, size) => { element.style.width = `${size}px`; }, width);
    await expect.poll(async () => frame.locator('#stage canvas').evaluate(element => {
      const box = element.getBoundingClientRect();
      return { width: Math.round(box.width), height: Math.round(box.height), center: Math.round(box.y + box.height / 2) };
    })).toEqual({ width, height: Math.round(width * 9 / 16), center: 260 });
  }
});

test('creator identifies a missing background field; player refuses invalid content', async ({ page, baseURL }, testInfo) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  await page.route(/\/project(?:-[\w-]+)?\.json(?:\?.*)?$/, async route => {
    if (route.request().resourceType() !== 'fetch') { await route.continue(); return; }
    const response = await route.fetch();
    const project = await response.json();
    project.rooms[0].backgroundAssetId = 'image_missing';
    await route.fulfill({ response, json: project });
  });
  await page.goto(baseURL);
  const diagnostic = page.getByRole('alert').filter({ hasText: 'Background image' });
  await expect(diagnostic).toContainText('image_missing');
  await expect(diagnostic).toContainText('/rooms/0/backgroundAssetId');
  await expect(diagnostic).toContainText('room_lake');
  await page.screenshot({ path: testInfo.outputPath('creator-invalid.png'), fullPage: true });
  const url = new URL(baseURL); url.port = String(Number(url.port) + 1);
  await page.goto(url.href);
  await expect(page.getByRole('alert')).toContainText('/rooms/0/backgroundAssetId');
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('creator scene editor changes a background and keeps hotspot tools hidden', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  await page.goto(baseURL);
  await expect(page.getByRole('status')).toContainText('Project checks passed.');
  await page.getByRole('button', { name: 'Scenes', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: 'Background' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'Add element' }).click();
  await page.getByRole('menu', { name: 'Add element type' }).getByRole('menuitem', { name: 'Hotspot' }).click();
  await page.getByLabel('Element name').press('Enter');
  await expect(page.getByRole('complementary', { name: 'Inspector' })).toContainText('Hotspot');
  await expect(page.getByLabel('Scene background')).toHaveCount(0);
  await page.getByRole('treeitem', { name: 'Background' }).click();
  await page.getByLabel('Scene background').selectOption(alternateBackground);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Scene background')).toHaveValue(originalBackground);
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByLabel('Scene background')).toHaveValue(alternateBackground);
  await expect(page.locator('.scene-canvas .layout')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Inspector' }).getByRole('combobox')).toHaveCount(1);
  await expect(page.getByLabel('View text')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Preview room' })).toHaveCount(0);
});

test('standalone player runs the same View hotspot interaction', async ({ page, baseURL }) => {
  if (!baseURL) throw new Error('Missing test baseURL.');
  await page.route(/\/project(?:-[\w-]+)?\.json(?:\?.*)?$/, async route => {
    if (route.request().resourceType() !== 'fetch') { await route.continue(); return; }
    const response = await route.fetch();
    const project = await response.json();
    project.rooms[0].hotspots.push({ id: 'hotspot_test', name: 'Test hotspot', bounds: { x: 1060, y: 140, width: 100, height: 100 }, inspect: 'A test observation.' });
    await route.fulfill({ response, json: project });
  });
  const url = new URL(baseURL); url.port = String(Number(url.port) + 1);
  await page.goto(url.href);
  await expect(page.getByRole('status').first()).toHaveText('Game view ready.');
  const canvas = page.locator('#stage canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Player canvas has no box.');
  await canvas.click({ position: { x: box.width * 1110 / 1600, y: box.height * 190 / 900 } });
  await expect(page.locator('#observation')).toHaveText('A test observation.');
});
