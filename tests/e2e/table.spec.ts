import { test, expect, type Page } from '@playwright/test';

async function rejected(page: Page, code: string, action: unknown) {
  return page.evaluate(({ code, action }) => new Promise<string>((resolve, reject) => {
    const ws = new WebSocket(`ws://${location.host}/ws?table=${code}`);
    const timer = setTimeout(() => { ws.close(); reject(Error('No action rejection arrived.')); }, 3000);
    ws.onopen = () => ws.send(JSON.stringify({ type: 'GAME_ACTION', id: crypto.randomUUID(), action }));
    ws.onmessage = event => { const message = JSON.parse(event.data); if (message.type === 'ACTION_REJECTED') { clearTimeout(timer); ws.close(); resolve(message.error); } };
  }), { code, action });
}

test('home fits desktop and narrow mobile', async ({ browser }) => {
  for (const width of [1440, 1280, 800, 390, 320]) {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/'); await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Good games/ })).toBeVisible();
    await expect(page.locator('.game-shelf')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect(errors).toEqual([]);
    if ([1440, 390, 320].includes(width)) await page.screenshot({ path: `test-results/home-${width}.png`, fullPage: true });
    await context.close();
  }
});

test('host can add bots and they finish setup and turns automatically', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByPlaceholder('What should friends call you?').fill('Host');
  await page.getByRole('button', { name: /Create a table/ }).click();
  await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const code = new URL(page.url()).pathname.split('/').pop()!;
  await page.getByRole('button', { name: 'Add a bot' }).click();
  await page.getByRole('button', { name: 'Add a bot' }).click();
  await expect(page.getByText('Wayfarer 1')).toBeVisible();
  await expect(page.getByText('Wayfarer 2')).toBeVisible();
  await expect(page.getByRole('button', { name: /Begin Hearthlands/ })).toBeEnabled();
  const hostId = await page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).self, code);
  await page.getByRole('button', { name: /Begin Hearthlands/ }).click();
  await page.locator('.site-selectable').first().click();
  await page.locator('.link-selectable').first().click();
  await expect.poll(() => page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game.setupIndex, code)).toBe(5);
  await page.locator('.site-selectable').first().click();
  await page.locator('.link-selectable').first().click();
  await expect(page.getByRole('button', { name: /Draw production/ })).toBeVisible();
  await page.getByRole('button', { name: /Draw production/ }).click();
  let game = await page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game, code);
  if (game.phase === 'ROVER_MOVE_REQUIRED') {
    await page.locator('.region-selectable').first().click();
    game = await page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game, code);
  }
  if (game.phase === 'ROVER_TARGET_REQUIRED') {
    await page.getByRole('button', { name: 'Take nothing' }).click();
    await expect.poll(() => page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game.phase, code)).toBe('MAIN_ACTION');
    game = await page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game, code);
  }
  expect(game.phase).toBe('MAIN_ACTION');
  const beforeEnd = game.eventNumber;
  await page.getByRole('button', { name: /End turn/ }).click();
  await expect.poll(async () => page.evaluate(async ({ code, hostId }) => {
    const game = (await (await fetch(`/api/tables/${code}`)).json()).game;
    return game.active === hostId && game.turn > 1 && game.eventNumber > 0;
  }, { code, hostId }), { timeout: 15000 }).toBe(true);
  game = await page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game, code);
  expect(game.eventNumber).toBeGreaterThan(beforeEnd + 1);
  expect(errors).toEqual([]);
  await page.close();
});

test('host can replace an Away seat with a bot', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const friendContext = await browser.newContext();
  const host = await hostContext.newPage();
  const friend = await friendContext.newPage();
  await host.goto('/');
  await host.getByPlaceholder('What should friends call you?').fill('Host');
  await host.getByRole('button', { name: /Create a table/ }).click();
  await expect(host.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  expect(await host.evaluate(() => window.scrollY)).toBe(0);
  const code = new URL(host.url()).pathname.split('/').pop()!;
  await friend.goto(`/t/${code}`);
  await friend.getByPlaceholder('What should friends call you?').fill('Away soon');
  await friend.getByRole('button', { name: /Join table/ }).click();
  await expect(friend.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const denied = await friend.evaluate(async code => {
    const response = await fetch(`/api/tables/${code}/bots`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    return { status: response.status, body: await response.json() };
  }, code);
  expect(denied.status).toBe(400);
  expect(denied.body.error).toContain('Only the host');
  await friend.close();
  await expect.poll(() => host.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).seats[1].connected, code)).toBe(false);
  await host.setViewportSize({ width: 1425, height: 801 });
  await host.screenshot({ path: 'test-results/lobby-away-final-1425.png' });
  await host.getByRole('button', { name: 'Replace with bot' }).click();
  await expect(host.getByText('Wayfarer 1')).toBeVisible();
  await host.getByRole('button', { name: 'Add a bot' }).click();
  await expect(host.getByText('3 / 6')).toBeVisible();
  await host.screenshot({ path: 'test-results/lobby-bots-final-1425.png' });
  await expect(host.getByRole('button', { name: /Begin Hearthlands/ })).toBeEnabled();
  await host.setViewportSize({ width: 390, height: 844 });
  expect(await host.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await host.screenshot({ path: 'test-results/lobby-bots-mobile-390.png', fullPage: true });
  await host.setViewportSize({ width: 1425, height: 801 });
  await host.getByRole('button', { name: /Begin Hearthlands/ }).click();
  await expect(host.getByRole('heading', { name: /Place a Lodge/ })).toBeVisible();
  await hostContext.close();
  await friendContext.close();
});

test('three friends start, play setup, refresh, and keep a spectator private', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 4 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })));
  await contexts[0]!.addInitScript(() => {
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        super(url, protocols);
        (window as Window & { __tableSocket?: WebSocket }).__tableSocket = this;
      }
    };
  });
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const errors: string[] = []; for (const page of pages) page.on('pageerror', error => errors.push(error.message));
  const [host, friend1, friend2, spectator] = pages;
  await host!.goto('/'); await host!.getByPlaceholder('What should friends call you?').fill('Minh'); await host!.getByRole('button', { name: /Create a table/ }).click();
  await expect(host!.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const code = new URL(host!.url()).pathname.split('/').pop()!;
  const invite = (await host!.locator('.invitation code').textContent())!;
  expect(new URL(invite).pathname).toBe(`/t/${code}`);
  await expect(host!.locator('.invitation-qr svg title')).toHaveText('Scan to open this table');
  await host!.screenshot({ path: 'test-results/lobby.png', fullPage: true });
  await host!.setViewportSize({ width: 390, height: 844 });
  expect(await host!.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(host!.locator('.invitation-qr svg')).toBeVisible();
  await host!.screenshot({ path: 'test-results/lobby-mobile.png', fullPage: true });
  await host!.setViewportSize({ width: 1280, height: 900 });
  for (const [page, name] of [[friend1!, 'Anna'], [friend2!, 'Phat']] as const) {
    await page.goto(`/t/${code}`); await page.getByPlaceholder('What should friends call you?').fill(name); await page.getByRole('button', { name: /Join table/ }).click();
    await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  }
  await expect(host!.getByText('3 / 6')).toBeVisible();
  await host!.getByRole('button', { name: /Begin Hearthlands/ }).click();
  await expect(host!.getByText('Place a Lodge, then a connected Trail')).toBeVisible();
  await host!.getByRole('button', { name: /TABLE/ }).click();
  await expect(host!.locator('.invite-dialog .invitation-qr svg')).toBeVisible();
  await expect(host!.locator('.invite-dialog>code')).toHaveText(invite);
  await host!.screenshot({ path: 'test-results/invitation-dialog.png' });
  await host!.getByRole('button', { name: 'Close invitation' }).click();
  await host!.evaluate(() => (window as Window & { __tableSocket?: WebSocket }).__tableSocket?.close());
  await expect(host!.locator('.connection-banner')).toBeVisible();
  await host!.locator('.site-selectable .site-hit').first().click();
  await expect(host!.locator('.link-selectable').first()).toBeVisible();
  await host!.screenshot({ path: 'test-results/setup-lodge-placed.png' });
  await expect.poll(() => host!.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game.setupSite, code)).not.toBeNull();
  const order = [host!, friend1!, friend2!, friend2!, friend1!, host!];
  for (const [index, page] of order.entries()) {
    if (index > 0) {
      await expect(page.locator('.site-selectable').first()).toBeVisible();
      if (index === 1) { const hit = page.locator('.site-selectable .site-hit').first(); const box = (await hit.boundingBox())!; expect(box.width).toBeGreaterThan(40); await hit.click({ position: { x: box.width - 3, y: box.height / 2 } }); }
      else await page.locator('.site-selectable').first().click();
      await expect(page.locator('.link-selectable').first()).toBeVisible();
    }
    if (index === 0) { await page.locator('.link-selectable').first().focus(); await page.keyboard.press('Enter'); }
    else await page.locator('.link-selectable').first().click();
  }
  await expect(host!.getByRole('button', { name: /Draw production/ })).toBeVisible();
  await host!.screenshot({ path: 'test-results/board-desktop.png', fullPage: true });
  for (const width of [800, 390, 320]) {
    await host!.setViewportSize({ width, height: 844 });
    expect(await host!.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    if (width === 390) { await host!.screenshot({ path: 'test-results/board-mobile.png', fullPage: true }); const beforeZoom = (await host!.locator('.board').boundingBox())!.width; await host!.getByRole('button', { name: 'Zoom in' }).click(); expect((await host!.locator('.board').boundingBox())!.width).toBeGreaterThan(beforeZoom); }
  }
  const before = await host!.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).self, code);
  await host!.reload();
  await expect(host!.getByRole('button', { name: /Draw production/ })).toBeVisible();
  const after = await host!.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).self, code);
  expect(after).toBe(before);
  const duplicate = await host!.evaluate(code => new Promise<string>(resolve => { const ws = new WebSocket(`ws://${location.host}/ws?table=${code}`); const id = crypto.randomUUID(); ws.onopen = () => { const message = JSON.stringify({ type: 'GAME_ACTION', id, action: { type: 'ROLL' } }); ws.send(message); ws.send(message); }; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'ACTION_ACK' || m.type === 'ACTION_REJECTED') { resolve(m.type); ws.close(); } }; }), code);
  expect(duplicate).toBe('ACTION_ACK');
  await spectator!.goto(`/t/${code}`); await spectator!.getByPlaceholder('What should friends call you?').fill('Observer'); await spectator!.getByRole('checkbox', { name: 'Watch as spectator' }).check(); await spectator!.getByRole('button', { name: /Join table/ }).click();
  await expect(spectator!.getByText('Watching the table. Private hands stay private.')).toBeVisible();
  await spectator!.screenshot({ path: 'test-results/spectator-desktop.png', fullPage: true });
  const state = await spectator!.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()).game, code);
  expect(state.private).toBeNull(); expect(state.seed).toBeNull(); expect(JSON.stringify(state)).not.toContain('"deck"');
  expect(await spectator!.evaluate(async code => (await fetch(`/api/debug/tables/${code}`)).status, code)).toBe(process.env.OPENTAVERNS_E2E_SCENARIOS?200:404);
  const rejection = await spectator!.evaluate(code => new Promise<string>(resolve => { const ws = new WebSocket(`ws://${location.host}/ws?table=${code}`); ws.onopen = () => ws.send(JSON.stringify({ type: 'GAME_ACTION', id: crypto.randomUUID(), action: { type: 'ROLL' } })); ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'ACTION_REJECTED') { resolve(m.error); ws.close(); } }; }), code);
  expect(rejection).toContain('Spectators cannot play');
  expect(errors).toEqual([]);
  for (const context of contexts) await context.close();
});

test('host privilege transfers after a lobby disconnect', async ({ browser }) => {
  const hostContext = await browser.newContext(); const friendContext = await browser.newContext();
  const host = await hostContext.newPage(), friend = await friendContext.newPage();
  await host.goto('/'); await host.getByPlaceholder('What should friends call you?').fill('Host'); await host.getByRole('button', { name: /Create a table/ }).click();
  await expect(host.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const code = new URL(host.url()).pathname.split('/').pop()!;
  await friend.goto(`/t/${code}`); await friend.getByPlaceholder('What should friends call you?').fill('Friend'); await friend.getByRole('button', { name: /Join table/ }).click();
  await expect(friend.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  await host.close();
  await expect.poll(() => friend.evaluate(async code => { const r = await (await fetch(`/api/tables/${code}`)).json(); return r.host === r.self; }, code)).toBe(true);
  await hostContext.close(); await friendContext.close();
});

test('six browser seats can enter one match', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 7 }, (_, i) => browser.newContext({ viewport: { width: i === 5 ? 390 : 1280, height: 844 } })));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const host = pages[0]!;
  await host.goto('/'); await host.getByPlaceholder('What should friends call you?').fill('Seat 1'); await host.getByRole('button', { name: /Create a table/ }).click();
  await expect(host.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const code = new URL(host.url()).pathname.split('/').pop()!;
  for (let i = 1; i < 6; i++) { const page = pages[i]!; await page.goto(`/t/${code}`); await page.getByPlaceholder('What should friends call you?').fill(`Seat ${i + 1}`); await page.getByRole('button', { name: /Join table/ }).click(); await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible(); }
  await expect(host.getByText('6 / 6')).toBeVisible();
  const observer = pages[6]!; await observer.goto(`/t/${code}`); await observer.getByPlaceholder('What should friends call you?').fill('Extra'); await observer.getByRole('button', { name: /Join table/ }).click();
  await expect(observer.getByText('You are watching as a spectator.')).toBeVisible();
  await host.getByRole('button', { name: /Begin Hearthlands/ }).click();
  await expect(host.getByRole('heading', { name: /Place a Lodge/ })).toBeVisible();
  for (const index of [0, 1, 2, 3, 4, 5, 5, 4, 3, 2, 1, 0]) {
    const page = pages[index]!;
    await expect(page.locator('.site-selectable').first()).toBeVisible();
    await page.locator('.site-selectable').first().click();
    await expect(page.locator('.link-selectable').first()).toBeVisible();
    await page.locator('.link-selectable').first().click();
  }
  await expect(host.getByRole('button', { name: /Draw production/ })).toBeVisible();
  await pages[5]!.screenshot({ path: 'test-results/board-mobile-native.png', fullPage: true });
  const room = await host.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()), code);
  expect(room.game.players).toHaveLength(6); expect(room.seats).toHaveLength(6);
  for (const context of contexts) await context.close();
});

test('server rejects forged actions, identity, and cross-site requests', async ({ browser }) => {
  const contexts = await Promise.all(Array.from({ length: 3 }, () => browser.newContext()));
  const pages = await Promise.all(contexts.map(c => c.newPage()));
  const [host, friend, third] = pages;
  await host!.goto('/'); await host!.getByPlaceholder('What should friends call you?').fill('Host'); await host!.getByRole('button', { name: /Create a table/ }).click();
  await expect(host!.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const code = new URL(host!.url()).pathname.split('/').pop()!;
  for (const [page, name] of [[friend!, 'Friend'], [third!, 'Third']] as const) {
    await page.goto(`/t/${code}`); await page.getByPlaceholder('What should friends call you?').fill(name); await page.getByRole('button', { name: /Join table/ }).click();
    await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  }
  const crossSite = await contexts[0]!.request.post(`/api/tables/${code}/start`, { headers: { Origin: 'https://elsewhere.example' }, data: {} });
  expect(crossSite.status()).toBe(403);
  await host!.getByRole('button', { name: /Begin Hearthlands/ }).click();
  await expect(host!.getByRole('heading', { name: /Place a Lodge/ })).toBeVisible();
  const before = (await (await contexts[0]!.request.get(`/api/tables/${code}`)).json()).game;
  expect(await rejected(friend!, code, { type: 'SETUP_LODGE', site: 0, actor: before.active })).toContain('Wait for your turn');
  expect(await rejected(host!, code, { type: 'ROLL', value: 1 })).toContain('phase');
  expect(await rejected(host!, code, { type: 'SETUP_LODGE', site: 999 })).toContain('open Site');
  expect(await rejected(host!, code, { type: 'INJECT_EVENT', text: 'I win' })).toContain('malformed');
  const after = (await (await contexts[0]!.request.get(`/api/tables/${code}`)).json()).game;
  expect(after).toEqual(before);
  const stranger = await browser.newContext();
  await stranger.addCookies([{ name: 'ot_session', value: 'A'.repeat(43), domain: '127.0.0.1', path: '/' }]);
  expect((await stranger.request.get(`/api/tables/${code}`)).status()).toBe(400);
  await stranger.close();
  for (const context of contexts) await context.close();
});
