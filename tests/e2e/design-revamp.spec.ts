import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const phase = process.env.OPENTAVERNS_REVAMP_PHASE;
if (phase) test.use({ baseURL: 'http://127.0.0.1:3103' });

test('representative design review captures for all six games', async ({ page }) => {
  test.skip(!phase); test.setTimeout(180000);
  const directory = `.test-data/revamp/${phase}`;
  mkdirSync(directory, { recursive: true });
  const scenes = [
    ['saigon-grid','AUCTION_TEST'], ['saigon-grid','DEBT_TEST'],
    ['blackout','ASSIGNMENT_TEST'], ['blackout','SECRET_ACTION_OPERATOR'], ['blackout','AUDIT_TEST'],
    ['tidecall','FORECAST_TEST'], ['tidecall','SEVEN_CARD_HAND'], ['tidecall','ROUND_SCORE'],
    ['werewolf','ROLE_REVEAL'], ['werewolf','WITCH_SAVE'], ['werewolf','VILLAGE_VOTE'], ['werewolf','EIGHTEEN_PLAYERS'],
    ['mosaic','EMPTY_BOARD'], ['mosaic','FINAL_SCORING'],
  ];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440,390,320,768]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 900 });
    await page.goto('/'); await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${directory}/home-${width}.png`, fullPage: true, animations: 'disabled' });
    const response = await page.request.post('/api/tables', { data: { name: 'Nguyễn Huệ', gameId: 'hearthlands', seed: 42 } });
    const room = await response.json();
    await page.goto(`/t/${room.code}`); await expect(page.locator('.lobby')).toBeVisible();
    await page.screenshot({ path: `${directory}/lobby-${width}.png`, fullPage: true, animations: 'disabled' });
    await page.request.post(`/api/tables/${room.code}/bots`, { data: {} });
    await page.request.post(`/api/tables/${room.code}/bots`, { data: {} });
    await page.request.post(`/api/tables/${room.code}/start`, { data: {} });
    await expect(page.locator('.board')).toBeVisible();
    await page.screenshot({ path: `${directory}/hearthlands-${width}.png`, fullPage: true, animations: 'disabled' });
    for (const [gameId,scenario] of scenes) {
      if ([320,768].includes(width) && !['AUCTION_TEST','ASSIGNMENT_TEST','SEVEN_CARD_HAND','EIGHTEEN_PLAYERS','EMPTY_BOARD'].includes(scenario!)) continue;
      const result = await page.request.post('/api/tables', { data: { name: 'Cách Mạng Tháng Tám', gameId, scenario, pacing: 'RELAXED' } });
      expect(result.ok()).toBe(true);
      const table = await result.json();
      await page.goto(`/t/${table.code}`);
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator('body')).not.toContainText('Opening ');
      if (scenario === 'EMPTY_BOARD') {
        await page.locator('.mx-palette').first().click();
        await page.locator('.mx-cell').nth(12).click();
        await page.locator('.mx-cell').nth(13).click();
        await expect(page.locator('.mx-cell-staged')).toHaveCount(2);
      }
      await page.screenshot({ path: `${directory}/${gameId}-${scenario}-${width}.png`, fullPage: true, animations: 'disabled' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (scenario === 'EMPTY_BOARD') {
        await page.getByRole('button', { name: 'Rules', exact: true }).first().click();
        await expect(page.getByRole('dialog', { name: 'Mosaic rules' })).toBeVisible();
        await page.screenshot({ path: `${directory}/rules-${width}.png`, fullPage: true, animations: 'disabled' });
        await page.keyboard.press('Escape');
        await expect(page.locator('.mx-cell-staged')).toHaveCount(2);
        await page.getByRole('button', { name: 'Use dark studio' }).click();
        await page.screenshot({ path: `${directory}/mosaic-dark-${width}.png`, fullPage: true, animations: 'disabled' });
        await page.getByRole('button', { name: 'Use light studio' }).click();
      }
    }
  }
  expect(errors).toEqual([]);
});

test('entry supports keyboard submission, Rules without creation, and browser history', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('What should friends call you?').fill('Nguyễn Huệ');
  await page.getByRole('button', { name: 'How to play', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Hearthlands field notes rules' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await page.getByRole('navigation', { name: 'Rules sections' }).getByRole('button', { name: 'Opening placement' }).click();
  await expect(page.getByRole('dialog', { name: 'Hearthlands field notes rules' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');
  await page.getByRole('button', { name: 'Close rules' }).click();
  await expect(page.getByRole('heading', { name: /Good games/ })).toBeVisible();
  await page.getByPlaceholder('What should friends call you?').press('Enter');
  await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const tableUrl = page.url();
  await page.goBack();
  await expect(page.getByRole('heading', { name: /Good games/ })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  expect(page.url()).toBe(tableUrl);
});

test('invitation copy has a keyboard-accessible fallback when clipboard fails', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder('What should friends call you?').fill('Host');
  await page.getByRole('button', { name: /Create a table/ }).click();
  await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(Error('Clipboard denied')) } }));
  await page.getByRole('button', { name: 'Copy link', exact: true }).click();
  const fallback = page.getByRole('textbox', { name: 'Invitation link, selected for copying' });
  await expect(fallback).toBeFocused();
  await expect(fallback).toHaveValue(/\/t\/[A-Z0-9]{6}$/);
  await expect(page.getByRole('status')).toContainText('copy it manually');
});

test('repeated form submission creates only one table', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const ready = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/tables', async route => { requests++; await ready; await route.continue(); });
  await page.goto('/');
  await page.getByPlaceholder('What should friends call you?').fill('Host');
  await page.locator('.entry-form').evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  await expect.poll(() => requests).toBe(1);
  await expect(page.locator('.entry-form button[name=create]')).toBeDisabled();
  release();
  await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  expect(requests).toBe(1);
});
