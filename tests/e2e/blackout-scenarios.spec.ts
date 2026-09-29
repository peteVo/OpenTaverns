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

test('public and private snapshots survive reconnect in every meaningful phase', async ({ page }) => {
  const scenarios = ['ROLE_REVEAL_TEST', 'INCIDENT_TEST', 'BRIEFING_TEST', 'ASSIGNMENT_TEST', 'SECRET_ACTION_OPERATOR', 'WAITING_TEST', 'RESOLUTION_TEST', 'AUDIT_TEST', 'FINAL_ROUND', 'OPERATOR_WIN', 'DISRUPTOR_WIN'];
  for (const scenario of scenarios) {
    const code = await openScenario(page, scenario);
    const before = (await state(page, code)).game;
    await page.reload();
    await expect(page.locator('.bo-game')).toBeVisible();
    const after = (await state(page, code)).game;
    expect(after.phase, scenario).toBe(before.phase);
    expect(after.round, scenario).toBe(before.round);
    expect(after.stability, scenario).toEqual(before.stability);
    expect(after.crisis, scenario).toBe(before.crisis);
    expect(after.lead, scenario).toBe(before.lead);
    expect(after.orders, scenario).toEqual(before.orders);
    expect(after.self, scenario).toEqual(before.self);
    expect(after.truth, scenario).toEqual(before.truth);
  }
});

test('a retried assignment action is acknowledged once without duplicate history', async ({ page }) => {
  const code = await openScenario(page, 'ASSIGNMENT_TEST');
  const ids = (await state(page, code)).seats.map((seat: { id: string }) => seat.id);
  const acknowledged = await page.evaluate(({ code, teams }) => new Promise<boolean>((resolve, reject) => {
    const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws?table=${code}`);
    const id = crypto.randomUUID();
    const message = JSON.stringify({ type: 'GAME_ACTION', id, action: { type: 'SET_TEAMS', teams } });
    let retried = false;
    const timer = setTimeout(() => { socket.close(); reject(Error('Assignment retry did not finish.')); }, 5000);
    socket.onopen = () => socket.send(message);
    socket.onmessage = event => {
      const data = JSON.parse(event.data);
      if (data.type === 'STATE' && data.state.game?.orders?.[0]?.responders.length === 2 && !retried) { retried = true; socket.send(message); }
      if (data.type === 'ACTION_ACK' && data.id === id) { clearTimeout(timer); socket.close(); resolve(true); }
      if (data.type === 'ACTION_REJECTED') { clearTimeout(timer); socket.close(); reject(Error(data.error)); }
    };
  }), { code, teams: [ids.slice(0, 2), ids.slice(2, 4)] });
  expect(acknowledged).toBe(true);
  const game = (await state(page, code)).game;
  expect(game.history.filter((entry: { text: string }) => entry.text.includes('assigned') && entry.text.includes('to '))).toHaveLength(1);
});
