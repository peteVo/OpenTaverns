import { test, expect, type Page } from '@playwright/test';

test.skip(process.env.OPENTAVERNS_E2E_SCENARIOS !== '1', 'Development-only Blackout visual scenarios.');
async function openScenario(page: Page, scenario: string) {
  await page.goto('/');
  const room = await page.evaluate(async scenario => {
    const response = await fetch('/api/tables', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Minh', gameId: 'blackout', scenario, seed: 42 }) });
    if (!response.ok) throw Error(await response.text()); return response.json();
  }, scenario);
  await page.goto(`/t/${room.code}`);
  await expect(page.locator('.bo-game')).toBeVisible();
  return room.code as string;
}
const state = (page: Page, code: string) => page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()), code);

test('Blackout phase surfaces remain private and legible on desktop and phone', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: /Choose Blackout/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/blackout-platform-desktop-pass1.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/blackout-platform-mobile-pass1.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /Choose Blackout/ }).click();
  await page.getByPlaceholder('What should friends call you?').fill('Minh');
  await page.getByRole('button', { name: /Create a table/ }).click();
  await expect(page.getByRole('heading', { name: /Every shift/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/blackout-lobby-desktop-pass1.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/blackout-lobby-mobile-pass1.png', fullPage: true });
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  expect((await page.getByRole('dialog', { name: 'Blackout operations manual rules' }).boundingBox())?.width).toBeGreaterThanOrEqual(390);
  await page.screenshot({ path: 'test-results/blackout-rules-lobby-mobile-pass2.png' });
  await page.keyboard.press('Escape');

  let code = await openScenario(page, 'ROLE_REVEAL_TEST');
  await expect(page.getByRole('dialog', { name: 'Your private Blackout role' })).toBeVisible();
  await page.screenshot({ path: 'test-results/blackout-role-mobile-pass1.png', fullPage: true });
  const publicState = await page.evaluate(async code => { const other = await fetch(`/api/tables/${code}`); return other.json(); }, code);
  expect(publicState.game.self?.faction).toMatch(/OPERATOR|DISRUPTOR/);
  await page.getByRole('button', { name: /I understand/ }).click();
  await expect(page.getByRole('dialog', { name: 'Your private Blackout role' })).toBeHidden();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Blackout operations manual rules' })).toBeVisible();
  await page.keyboard.press('Escape');

  code = await openScenario(page, 'INCIDENT_TEST');
  await page.screenshot({ path: 'test-results/blackout-incident-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'ASSIGNMENT_TEST');
  await page.screenshot({ path: 'test-results/blackout-assignment-mobile-pass1.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/blackout-assignment-desktop-pass1.png', fullPage: true });

  code = await openScenario(page, 'SECRET_ACTION_OPERATOR');
  await expect(page.locator('.bo-response-choices').getByRole('button', { name: /Diagnose/ })).toBeVisible();
  await expect(page.locator('.bo-response-choices').getByRole('button', { name: /Interfere/ })).toHaveCount(0);
  await page.locator('.bo-response-choices').getByRole('button', { name: /Diagnose/ }).click();
  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await page.screenshot({ path: 'test-results/blackout-rules-action-desktop-pass2.png' });
  await page.keyboard.press('Escape');
  await expect(page.locator('.bo-response-choices').getByRole('button', { name: /Diagnose/ })).toHaveAttribute('aria-pressed','true');
  await page.reload();
  await expect(page.locator('.bo-response-choices').getByRole('button', { name: /Diagnose/ })).toHaveAttribute('aria-pressed','true');
  await page.screenshot({ path: 'test-results/blackout-operator-desktop-pass1.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/blackout-operator-mobile-pass1.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: /Lock response/ }).click();
  await expect.poll(async () => (await state(page, code)).game.self.lockedResponse).toBe('DIAGNOSE');

  code = await openScenario(page, 'SECRET_ACTION_DISRUPTOR');
  await expect(page.locator('.bo-response-choices').getByRole('button', { name: /Interfere/ })).toBeVisible();
  await page.screenshot({ path: 'test-results/blackout-disruptor-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'WAITING_TEST');
  await page.screenshot({ path: 'test-results/blackout-waiting-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'RESOLUTION_TEST');
  await page.screenshot({ path: 'test-results/blackout-resolution-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'AUDIT_TEST');
  await page.screenshot({ path: 'test-results/blackout-audit-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'POWER_CRITICAL');
  await page.screenshot({ path: 'test-results/blackout-critical-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'SYSTEM_OFFLINE');
  await page.screenshot({ path: 'test-results/blackout-offline-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'OPERATOR_WIN');
  await page.getByRole('button', { name: 'The truth', exact: true }).click();
  await page.screenshot({ path: 'test-results/blackout-operator-win-mobile-pass1.png', fullPage: true });
  code = await openScenario(page, 'DISRUPTOR_WIN');
  await page.getByRole('button', { name: 'The truth', exact: true }).click();
  await page.screenshot({ path: 'test-results/blackout-disruptor-win-mobile-pass1.png', fullPage: true });
  expect(errors).toEqual([]);
});
