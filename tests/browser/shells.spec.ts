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
      await expect(page.getByRole('status')).toHaveText('Ready for a story. No adventure is loaded yet.');
      await expect(page.locator('#stage canvas')).toBeVisible();
      await expect(page.locator('#stage canvas')).toHaveAttribute('width', '960');
    }
    await page.screenshot({ path: testInfo.outputPath(`${app}.png`), fullPage: true });
    expect(errors).toEqual([]);
  });
}
