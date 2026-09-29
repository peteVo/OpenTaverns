import { test, expect, type Page } from '@playwright/test';

test.skip(process.env.OPENTAVERNS_E2E_SCENARIOS !== '1', 'Development-only scenario QA.');

async function openScenario(page: Page, scenario: string) {
  await page.goto('/');
  const room = await page.evaluate(async scenario => {
    const response = await fetch('/api/tables', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Minh', gameId: 'saigon-grid', scenario, seed: 42 }) });
    if (!response.ok) throw Error(await response.text());
    return response.json();
  }, scenario);
  await page.goto(`/t/${room.code}`);
  await expect(page.locator('.grid-space')).toHaveCount(28);
  return room.code as string;
}
async function state(page: Page, code: string) { return page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()), code); }

test('late Saigon Grid states render and their decisions work', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  let code = await openScenario(page, 'FULL_DISTRICT_TEST');
  await page.getByRole('button', { name: 'portfolio', exact: true }).click();
  await expect(page.getByText('complete District').first()).toBeVisible();
  await page.screenshot({ path: 'test-results/qa-grid-district-desktop.png', fullPage: true });
  await page.locator('.grid-holding').filter({ hasText: 'Nguyễn Huệ' }).getByRole('button', { name: 'Develop' }).click();
  await expect.poll(async () => (await state(page,code)).game.developmentSupply).toBe(23);

  code = await openScenario(page, 'TRADE_TEST');
  await page.getByRole('button', { name: 'trade', exact: true }).click();
  await expect(page.locator('.grid-trade-offer')).toBeVisible();
  await page.screenshot({ path: 'test-results/qa-grid-trade-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'play', exact: true }).click();
  await page.getByRole('button', { name: /Finish your turn/ }).click();
  await expect.poll(async () => (await state(page,code)).game.trade).toBeNull();
  expect((await state(page,code)).game.holdings.find((h: { space: number }) => h.space === 1).owner).not.toBe((await state(page,code)).self);

  code = await openScenario(page, 'REVIEW_TEST');
  await expect(page.getByRole('heading', { name: 'Municipal Review' })).toBeVisible();
  await page.screenshot({ path: 'test-results/qa-grid-review-desktop.png', fullPage: true });
  await page.getByRole('button', { name: /Pay 50 Cr/ }).click();
  await expect.poll(async () => (await state(page,code)).game.players[0].reviewTurns).toBe(0);

  code = await openScenario(page, 'DEBT_TEST');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'You can raise Credits.' })).toBeVisible();
  expect((await page.getByRole('button', { name: 'Inspect recovery options' }).boundingBox())!.y).toBeLessThan(844);
  await page.screenshot({ path: 'test-results/qa-grid-debt-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Inspect recovery options' }).click();
  await page.locator('.grid-holding').filter({ hasText: 'Nguyễn Huệ' }).getByRole('button', { name: /Loan/ }).click();
  await expect.poll(async () => (await state(page,code)).game.phase).toBe('MAIN_ACTION');

  code = await openScenario(page, 'INSOLVENCY_TEST');
  await page.getByRole('button', { name: 'Declare Insolvency' }).click();
  await expect(page.getByRole('dialog', { name: 'Saigon Grid match result' })).toBeVisible();
  expect((await state(page,code)).game.phase).toBe('GAME_OVER');
  const result = (await state(page,code)).game;
  expect(result.holdings.filter((h: { owner: string | null }) => h.owner === result.winner)).toHaveLength(3);
  await page.screenshot({ path: 'test-results/qa-grid-result-mobile-pass1.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Saigon Grid match result' })).toBeHidden();
  await page.getByRole('button', { name: 'Results' }).click();
  await expect(page.getByRole('dialog', { name: 'Saigon Grid match result' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: 'test-results/qa-grid-result-desktop-pass1.png', fullPage: true });
  expect(errors).toEqual([]);
});
