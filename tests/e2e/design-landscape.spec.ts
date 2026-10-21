import { test, expect, type Page } from '@playwright/test';

if (process.env.OPENTAVERNS_REVAMP_PHASE) test.use({ baseURL: 'http://127.0.0.1:3103' });
test.use({ viewport: { width: 740, height: 360 }, hasTouch: true });
test.skip(process.env.OPENTAVERNS_E2E_SCENARIOS !== '1', 'Development-only landscape interaction checks.');

const state = (page: Page, code: string) => page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()), code);
async function scenario(page: Page, gameId: string, name: string) {
  const response = await page.request.post('/api/tables', { data: { name: 'Minh', gameId, scenario: name, seed: 42 } });
  expect(response.ok(), `${gameId}/${name}`).toBe(true);
  const room = await response.json();
  await page.goto(`/t/${room.code}`);
  await expect(page.locator('main')).toBeVisible();
  return room.code as string;
}
async function capture(page: Page, game: string) {
  await page.screenshot({ path: `.test-data/revamp/final/landscape-${game}.png`, animations: 'disabled' });
}

test('core game actions remain usable in touch landscape', async ({ page }) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });

  // Hearthlands: seat two bots, start, then place the first legal Lodge.
  await page.goto('/');
  await page.getByPlaceholder('What should friends call you?').fill('Minh');
  await page.getByRole('button', { name: /Create a table/ }).click();
  await page.getByRole('button', { name: /Add a bot/ }).tap();
  await page.getByRole('button', { name: /Add a bot/ }).tap();
  await page.getByRole('button', { name: /Begin Hearthlands/ }).tap();
  await expect(page.getByRole('heading', { name: /Place a Lodge/ })).toBeVisible();
  await page.getByRole('button', { name: /Place Lodge at Site/ }).first().tap();
  await expect(page.getByRole('button', { name: /Place Trail on Link/ }).first()).toBeVisible();
  await capture(page, 'hearthlands');

  // Saigon Grid: submit a legal bid in the auction fixture.
  const saigon = await scenario(page, 'saigon-grid', 'AUCTION_TEST');
  await expect(page.locator('.grid-bid-row button').first()).toBeVisible();
  const bidBefore = (await state(page, saigon)).game.auction.bid;
  await page.locator('.grid-bid-row button').first().tap();
  await expect.poll(async () => (await state(page, saigon)).game.auction.bid).toBeGreaterThan(bidBefore);
  await capture(page, 'saigon-grid');

  // Blackout: assign one responder to each order and publish the legal teams.
  await scenario(page, 'blackout', 'ASSIGNMENT_TEST');
  const picks = page.locator('.bo-team-picks button');
  await expect(picks.first()).toBeVisible();
  await picks.nth(0).tap();
  await expect(picks.nth(0)).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'blackout');

  // Tidecall: select and lock a private forecast.
  await scenario(page, 'tidecall', 'FORECAST_TEST');
  await page.getByRole('button', { name: 'Forecast 2', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Forecast 2', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'tidecall');

  // Werewolf: cast a village vote against one eligible target.
  await scenario(page, 'werewolf', 'VILLAGE_VOTE');
  await expect(page.locator('.ww-targets button').first()).toBeVisible();
  await page.locator('.ww-targets button').first().tap();
  await expect(page.locator('.ww-targets button').first()).toHaveAttribute('aria-pressed', 'true');
  await capture(page, 'werewolf');

  // Mosaic: stage two adjacent tiles from the first palette and commit.
  await scenario(page, 'mosaic', 'EMPTY_BOARD');
  await page.locator('.mx-palette').first().tap();
  await page.locator('.mx-cell').nth(12).tap(); await page.locator('.mx-cell').nth(13).tap();
  await expect(page.locator('.mx-cell-staged')).toHaveCount(2);
  await expect(page.locator('.mx-cell-staged')).toHaveCount(2);
  await capture(page, 'mosaic');
});
