import { test, expect, type Page } from '@playwright/test';

async function state(page: Page, code: string) { return page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()), code); }

test('the collection, Saigon lobby, and city board work on desktop and phones', async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const guestContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  const errors: string[] = [];
  for (const page of [host,guest]) page.on('pageerror', error => errors.push(error.message));
  await host.goto('/'); await host.waitForLoadState('networkidle');
  await expect(host.getByText('Choose tonight\'s world.')).toBeVisible();
  await host.screenshot({ path: 'test-results/grid-platform-desktop-pass2.png', fullPage: true });
  await host.setViewportSize({ width: 390, height: 844 });
  expect(await host.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await host.screenshot({ path: 'test-results/grid-platform-mobile-pass2.png', fullPage: true });
  await host.setViewportSize({ width: 1440, height: 900 });
  await host.getByRole('button', { name: /Choose Saigon Grid/ }).click();
  await host.getByPlaceholder('What should friends call you?').fill('Minh');
  await host.getByRole('button', { name: /Create a table/ }).click();
  await expect(host.getByRole('heading', { name: /city is yours/ })).toBeVisible();
  const code = new URL(host.url()).pathname.split('/').pop()!;
  expect((await state(host, code)).gameId).toBe('saigon-grid');
  await expect(host.locator('.grid-invitation svg title')).toHaveText('Scan to join Saigon Grid');
  await host.screenshot({ path: 'test-results/grid-lobby-desktop-pass2.png', fullPage: true });
  await host.setViewportSize({ width: 390, height: 844 });
  expect(await host.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await host.screenshot({ path: 'test-results/grid-lobby-mobile-pass2.png', fullPage: true });
  await host.setViewportSize({ width: 1440, height: 900 });
  await guest.goto(`/t/${code}`);
  await guest.getByPlaceholder('What should friends call you?').fill('Linh');
  await guest.getByRole('button', { name: /Join table/ }).click();
  await expect(host.getByText('2 / 6')).toBeVisible();
  await host.getByRole('button', { name: /Begin Saigon Grid/ }).click();
  await expect(host.locator('.grid-board .grid-space')).toHaveCount(28);
  await expect(guest.locator('.grid-board .grid-space')).toHaveCount(28);
  await host.screenshot({ path: 'test-results/grid-board-desktop-pass2.png', fullPage: true });
  await host.setViewportSize({ width: 390, height: 844 });
  expect(await host.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect.poll(() => host.locator('.grid-map-scroll').evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await host.screenshot({ path: 'test-results/grid-board-mobile-pass2.png', fullPage: true });
  await host.setViewportSize({ width: 1440, height: 900 });
  await host.getByRole('button', { name: 'Invite' }).click();
  await expect(host.getByRole('dialog', { name: 'Table invitation' })).toBeVisible();
  await expect(host.getByRole('button', { name: 'Close invitation' })).toBeFocused();
  await host.keyboard.press('Escape');
  await expect(host.getByRole('dialog', { name: 'Table invitation' })).toBeHidden();
  await host.getByRole('button', { name: 'portfolio', exact: true }).click();
  await expect(host.getByRole('heading', { name: 'Holdings' })).toBeVisible();
  await host.getByRole('button', { name: 'trade', exact: true }).click();
  await expect(host.getByRole('heading', { name: 'Across the city' })).toBeVisible();
  await host.getByRole('button', { name: 'rules', exact: true }).click();
  await expect(host.getByRole('heading', { name: 'How the city plays' })).toBeVisible();
  expect(errors).toEqual([]);
  await hostContext.close(); await guestContext.close();
});

test('an unclaimed Holding reaches a multiplayer auction and completes', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const [host, guest] = pages;
  await host!.goto('/'); await host!.getByRole('button', { name: /Choose Saigon Grid/ }).click(); await host!.getByPlaceholder('What should friends call you?').fill('Host'); await host!.getByRole('button', { name: /Create a table/ }).click();
  await expect(host!.getByRole('heading', { name: /city is yours/ })).toBeVisible();
  const code = new URL(host!.url()).pathname.split('/').pop()!;
  await guest!.goto(`/t/${code}`); await guest!.getByPlaceholder('What should friends call you?').fill('Guest'); await guest!.getByRole('button', { name: /Join table/ }).click();
  await expect(guest!.getByRole('heading', { name: /city is yours/ })).toBeVisible();
  await expect.poll(async () => (await state(host!, code)).seats.map((seat: { connected: boolean }) => seat.connected), { timeout: 20000 }).toEqual([true, true]);
  await expect(host!.getByRole('button', { name: /Begin Saigon Grid/ })).toBeEnabled({ timeout: 20000 });
  await host!.getByRole('button', { name: /Begin Saigon Grid/ }).click();
  const ids = (await state(host!, code)).seats.map((seat: { id: string }) => seat.id);
  let reached = false;
  for (let i = 0; i < 40; i++) {
    const room = await state(host!, code);
    const page = room.game.active === ids[0] ? host! : guest!;
    if (room.game.phase === 'PURCHASE_DECISION') { await page.getByRole('button', { name: 'Send to auction' }).click(); reached = true; break; }
    if (room.game.phase === 'ROLL_REQUIRED') await page.getByRole('button', { name: 'Roll the dice' }).click();
    else if (room.game.phase === 'MAIN_ACTION') await page.getByRole('button', { name: /Finish your turn|Take your extra roll/ }).click();
    else throw Error(`Unexpected phase ${room.game.phase}`);
    await expect.poll(async () => (await state(host!,code)).game.revision).toBeGreaterThan(room.game.revision);
  }
  expect(reached).toBe(true);
  await expect(host!.locator('.grid-auction')).toBeVisible();
  await expect(host!.locator('.grid-bid-row')).toBeInViewport();
  await host!.screenshot({ path: 'test-results/grid-auction-desktop-pass3.png', fullPage: true });
  const before = await state(host!,code);
  await host!.locator('.grid-bid-row button').first().click();
  await expect.poll(async () => (await state(host!,code)).game.auction?.bid).toBeGreaterThan(0);
  await guest!.getByRole('button', { name: 'Withdraw from auction' }).click();
  await expect.poll(async () => (await state(host!,code)).game.phase).toBe('MAIN_ACTION');
  const after = await state(host!,code);
  expect(after.game.holdings.find((h: { space: number }) => h.space === before.game.auction.asset).owner).toBe(ids[0]);
  await Promise.all(contexts.map(c => c.close()));
});

test('Saigon Grid reconnects, replaces an Away seat, and gives spectators a public view', async ({ browser }) => {
  const [hostContext, guestContext, spectatorContext] = await Promise.all([browser.newContext(), browser.newContext(), browser.newContext()]);
  const host = await hostContext.newPage(), guest = await guestContext.newPage(), spectator = await spectatorContext.newPage();
  await host.goto('/'); await host.getByRole('button', { name: /Choose Saigon Grid/ }).click(); await host.getByPlaceholder('What should friends call you?').fill('Host'); await host.getByRole('button', { name: /Create a table/ }).click();
  await expect(host.getByRole('heading', { name: /city is yours/ })).toBeVisible();
  const code = new URL(host.url()).pathname.split('/').pop()!;
  await guest.goto(`/t/${code}`); await guest.getByPlaceholder('What should friends call you?').fill('Guest'); await guest.getByRole('button', { name: /Join table/ }).click();
  await expect(guest.getByRole('heading', { name: /city is yours/ })).toBeVisible();
  await expect(host.getByRole('button', { name: /Begin Saigon Grid/ })).toBeEnabled({ timeout: 20000 });
  await host.getByRole('button', { name: /Begin Saigon Grid/ }).click();
  await expect(host.locator('.grid-space')).toHaveCount(28);
  const before = await state(host, code);
  await host.reload(); await expect(host.locator('.grid-space')).toHaveCount(28);
  expect((await state(host,code)).self).toBe(before.self);
  await guestContext.close();
  await expect.poll(async () => (await state(host,code)).seats[1].connected).toBe(false);
  await host.getByRole('button', { name: 'Replace Guest with bot' }).click();
  await expect.poll(async () => (await state(host,code)).seats[1].bot).toBe(true);
  expect((await state(host,code)).seats[1].id).toBe(before.seats[1].id);
  await spectator.goto(`/t/${code}`); await spectator.getByPlaceholder('What should friends call you?').fill('Observer'); await spectator.getByRole('checkbox', { name: 'Watch as spectator' }).check(); await spectator.getByRole('button', { name: /Join table/ }).click();
  await expect(spectator.locator('.grid-space')).toHaveCount(28);
  const publicState = await state(spectator, code);
  expect(publicState.self).toBeNull(); expect(publicState.spectator).toBe(true); expect(publicState.game).not.toHaveProperty('rng');
  await hostContext.close(); await spectatorContext.close();
});

test('a host can begin Saigon Grid with a Courier bot', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: /Choose Saigon Grid/ }).click();
  await page.getByPlaceholder('What should friends call you?').fill('Minh');
  await page.getByRole('button', { name: /Create a table/ }).click();
  await expect(page.getByRole('heading', { name: /city is yours/ })).toBeVisible();
  const code = new URL(page.url()).pathname.split('/').pop()!;
  await page.getByRole('button', { name: /Add a Courier bot/ }).click();
  await expect(page.getByText('2 / 6')).toBeVisible();
  expect((await state(page,code)).seats[1].bot).toBe(true);
  await page.getByRole('button', { name: /Begin Saigon Grid/ }).click();
  await expect(page.locator('.grid-space')).toHaveCount(28);
  expect((await state(page,code)).game.players).toHaveLength(2);
});
