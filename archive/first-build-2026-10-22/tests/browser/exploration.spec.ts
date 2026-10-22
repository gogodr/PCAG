import { test, expect } from '@playwright/test';
import legacy from '../../examples/foundation/project-v1.json' with { type: 'json' };

test('visible actor walks, observes without approach, and uses keyboard destinations', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/'); await page.getByRole('button', { name: 'Playtest', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
  const actor = page.getByLabel('Playable character Alex');
  await expect(actor).toHaveAttribute('data-x', '160.00');
  const scene = page.getByLabel('Walk destination.', { exact: false });
  await expect.poll(async () => scene.evaluate(e => {
    const bounds = e.getBoundingClientRect(), canvas = e.querySelector('canvas')!.getBoundingClientRect();
    return Math.abs(bounds.top - canvas.top) + Math.abs(bounds.left - canvas.left) + Math.abs(bounds.height - canvas.height) + Math.abs(bounds.width - canvas.width);
  })).toBeLessThan(2);
  await scene.focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Enter');
  await expect(actor).toHaveAttribute('data-x', '180.00');
  await page.getByRole('button', { name: 'View', exact: true }).click();
  await page.getByRole('button', { name: 'View The window', exact: true }).click();
  await expect(page.locator('.pcag-caption')).toContainText('Alex: Beyond the hills');
  await expect(actor).toHaveAttribute('data-x', '180.00'); await expect(actor).toHaveAttribute('data-mode', 'talk');
  await page.getByRole('button', { name: 'Walk to A folded note', exact: true }).focus();
  await page.getByRole('button', { name: 'View A folded note', exact: true }).click();
  await expect(page.locator('.pcag-caption')).toContainText('Every adventure begins'); await expect(actor).toHaveAttribute('data-x', '180.00');
  const rect = (await scene.boundingBox())!;
  await page.mouse.click(rect.x + rect.width * .8, rect.y + rect.height * .92);
  await expect(actor).toHaveAttribute('data-mode', 'walk');
  await expect(actor).toHaveAttribute('data-x', '768.00', { timeout: 8000 });
  await expect(actor).toHaveAttribute('data-mode', 'idle');
  await page.mouse.click(rect.x + rect.width * .6, rect.y + rect.height * .2);
  await expect(page.locator('.pcag-caption')).toHaveText("Alex: I can't reach that.");
  expect(errors).toEqual([]);
});

test('exits transition at arrival, return correctly, and cancel before transition', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Playtest', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
  const player = page.getByRole('region', { name: 'Adventure player' });
  await page.getByRole('button', { name: 'Exit To the hall', exact: true }).click();
  await expect(player).toHaveAttribute('data-room-id', 'room_study');
  await expect(player).toHaveAttribute('data-room-id', 'room_hall', { timeout: 9000 });
  await expect(page.getByLabel('Playable character Alex')).toHaveAttribute('data-x', '150.00');
  await page.getByRole('button', { name: 'Exit Back to the study', exact: true }).click();
  await expect(player).toHaveAttribute('data-room-id', 'room_study');
  await page.getByRole('button', { name: 'Exit To the hall', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByLabel('Playable character Alex')).toHaveAttribute('data-mode', 'idle');
  await page.waitForTimeout(4800);
  await expect(player).toHaveAttribute('data-room-id', 'room_study');
});

test('authors two connected rooms and obstacle geometry through the creator', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'New project', exact: true }).click();
  await page.getByRole('button', { name: 'Add room', exact: false }).click();
  await page.getByLabel('Room name', { exact: true }).fill('Courtyard');
  async function draw(name: string, from: [number, number], to: [number, number]) {
    await page.getByRole('button', { name, exact: true }).click();
    const r = (await page.getByTestId('room-canvas').boundingBox())!;
    await page.mouse.move(r.x + r.width * from[0], r.y + r.height * from[1]); await page.mouse.down();
    await page.mouse.move(r.x + r.width * to[0], r.y + r.height * to[1]); await page.mouse.up();
  }
  await draw('Exit', [.02, .7], [.12, .94]);
  await page.getByLabel('Element name', { exact: true }).fill('Back inside');
  await page.getByLabel('Destination room').selectOption({ label: 'First room' });
  await page.getByRole('button', { name: 'Edit room First room', exact: true }).click();
  await draw('Obstacle', [.42, .7], [.6, .79]);
  await expect(page.getByLabel('Element name', { exact: true })).toHaveValue('Obstacle');
  await draw('Exit', [.88, .7], [.98, .94]);
  await page.getByLabel('Element name', { exact: true }).fill('Outside');
  await page.getByLabel('Destination room').selectOption({ label: 'Courtyard' });
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  await page.reload(); await expect(page.getByRole('button', { name: 'Edit room Courtyard', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Playtest', exact: true }).click();
  await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Exit Outside', exact: true }).click();
  await expect(page.locator('.pcag-player-heading strong')).toHaveText('Courtyard', { timeout: 9000 });
  await page.getByRole('button', { name: 'Exit Back inside', exact: true }).click();
  await expect(page.locator('.pcag-player-heading strong')).toHaveText('First room');
});

test('legacy projects remain editable and original save is preserved during explicit setup', async ({ page }) => {
  await page.addInitScript(data => localStorage.setItem('pcag.project.v1', JSON.stringify(data)), legacy);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Playtest', exact: true })).toBeDisabled();
  await expect(page.getByLabel('Object name')).toHaveValue('A folded note');
  await page.getByRole('button', { name: 'Use starter character', exact: true }).click();
  await page.getByRole('button', { name: 'Draw ground', exact: true }).click();
  const r = (await page.getByTestId('room-canvas').boundingBox())!;
  await page.mouse.move(r.x + 1, r.y + r.height * .7); await page.mouse.down();
  await page.mouse.move(r.x + r.width - 1, r.y + r.height - 1); await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Playtest', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  const stored = await page.evaluate(() => ({ v1: localStorage.getItem('pcag.project.v1'), v2: localStorage.getItem('pcag.project.v2') }));
  expect(JSON.parse(stored.v1!)).toEqual(legacy); expect(JSON.parse(stored.v2!).formatVersion).toBe(2);
  await page.getByRole('button', { name: 'Playtest', exact: true }).click(); await expect(page.locator('[data-ready="true"]')).toHaveCount(1);
});

test('invalid animation frames prevent preview with actionable feedback', async ({ page }) => {
  await page.goto('/');
  await page.getByText('Walk animation', { exact: true }).click();
  await page.getByLabel('walk first frame', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Playtest', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('frames outside its sprite sheet');
  await expect(page.locator('canvas')).toHaveCount(0);
});
