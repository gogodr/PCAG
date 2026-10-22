import { expect, test } from '@playwright/test';

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
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Every adventurestarts somewhere.');
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
