/** Capture the live creator with sample data for visual review. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.env.PCAG_CREATOR_URL ?? 'http://127.0.0.1:5173/?sample=1';
const out = 'docs/design/previews-v2';
await mkdir(out, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await page.goto(url.replace(/\?sample=1$/, ''));
  await page.locator('.welcome-intro').waitFor();
  await page.screenshot({ path: join(out, 'live-welcome.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(out, 'live-welcome-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(url);
  await page.locator('.app-shell').waitFor();
  const nav = page.getByRole('navigation', { name: 'Editor views' });
  for (const view of ['Project', 'Assets', 'Characters', 'Scenes', 'Animations']) {
    await nav.getByRole('button', { name: view, exact: true }).click();
    await page.getByRole('heading', { name: view, exact: true, level: 1 }).waitFor();
    if (view === 'Animations') await page.locator('.animation-view:not([hidden])').waitFor();
    await page.screenshot({ path: join(out, `live-${view.toLowerCase()}.png`) });
    console.log(`Captured ${view}`);
  }
} finally {
  await browser.close();
}
