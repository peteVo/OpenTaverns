import { test, expect, type Page } from '@playwright/test';
import WebSocket from 'ws';
import { nextBotAction } from '../../packages/hearthlands/src/simulate.js';
import { canPay, costs, emptyInventory, materials, type Action, type View } from '../../packages/hearthlands/src/index.js';

type State = { seats: { id: string; connected: boolean }[]; game: View | null };
const stateKey = (game: View) => JSON.stringify([game.eventNumber, game.phase, game.turn, game.active, game.setupIndex, game.setupSite, game.wayfareIndex, game.offer?.id, game.winner]);

async function playInBrowser(page: Page, action: Action) {
  if (action.type === 'ROLL') { await page.getByRole('button', { name: 'Play', exact: true }).click(); await page.getByRole('button', { name: /Draw production/ }).click(); return; }
  if (action.type === 'BUILD_TRAIL' || action.type === 'BUILD_LODGE' || action.type === 'UPGRADE_HALL') {
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    const choice = action.type === 'BUILD_TRAIL' ? ['Lay a Trail', `Place Trail on Link ${action.link + 1}`] : action.type === 'BUILD_LODGE' ? ['Raise a Lodge', `Place Lodge at Site ${action.site + 1}`] : ['Raise a Hall', `Upgrade Hall at Site ${action.site + 1}`];
    await page.getByRole('button', { name: new RegExp(choice[0]!) }).click();
    if (action.type === 'BUILD_TRAIL') { await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: 'test-results/construction-mobile.png', fullPage: true }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390); }
    await page.getByRole('button', { name: choice[1]!, exact: true }).click();
    return;
  }
  if (action.type === 'SUPPLY_EXCHANGE') {
    await page.getByRole('button', { name: 'Exchange', exact: true }).click();
    await page.getByRole('combobox', { name: 'Give Material' }).selectOption(action.give);
    await page.getByRole('combobox', { name: 'Receive Material' }).selectOption(action.receive);
    await page.getByRole('button', { name: 'Exchange with supply' }).click();
    return;
  }
  if (action.type === 'PLAY_CHRONICLE') {
    await page.getByRole('button', { name: 'Chronicles', exact: true }).click();
    if (action.material) await page.getByRole('combobox', { name: 'Material for Harvest / Levy' }).selectOption(action.material);
    await page.locator('.chronicle-card button:not(:disabled)').first().click();
    if (action.region !== undefined) await page.getByRole('button', { name: new RegExp(`Move Rover to .* Region ${action.region + 1}$`) }).click();
    if (action.links) {
      for (const link of action.links) await page.getByRole('button', { name: `Place Trail on Link ${link + 1}`, exact: true }).click();
      if (action.links.length === 1) await page.getByRole('button', { name: 'Place one Survey Trail', exact: true }).click();
    }
  }
}

test('six seated players complete a real server match and see results', async ({ browser }) => {
  test.setTimeout(300000);
  const url = test.info().project.use.baseURL as string;
  const socketOrigin = `${url.startsWith('https:') ? 'wss' : 'ws'}://${new URL(url).host}`;
  const contexts = await Promise.all(Array.from({ length: 6 }, () => browser.newContext({ viewport: { width: 1280, height: 900 } })));
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
  let host = pages[0]!;
  const errors: string[] = [];
  host.on('pageerror', error => errors.push(error.message));
  await host.goto('/');
  await host.getByPlaceholder('What should friends call you?').fill('Player 1');
  await host.getByRole('button', { name: /Create a table/ }).click();
  await expect(host.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  const code = new URL(host.url()).pathname.split('/').pop()!;
  for (let i = 1; i < 6; i++) {
    const page = pages[i]!;
    await page.goto(`/t/${code}`);
    await page.getByPlaceholder('What should friends call you?').fill(`Player ${i + 1}`);
    await page.getByRole('button', { name: /Join table/ }).click();
    await expect(page.getByRole('heading', { name: 'Pull up a chair.' })).toBeVisible();
  }
  const latest: (State | null)[] = Array(6).fill(null);
  const connectSeat = async (i: number) => {
    const cookie = (await contexts[i]!.cookies(url)).find(c => c.name === 'ot_session')!;
    const ws = new WebSocket(`${socketOrigin}/ws?table=${code}`, { headers: { Cookie: `ot_session=${cookie.value}`, Origin: url } });
    ws.on('message', data => { const message = JSON.parse(data.toString()); if (message.type === 'STATE') latest[i] = message.state; });
    await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
    return ws;
  };
  const sockets = await Promise.all(contexts.map((_, i) => connectSeat(i)));
  const renewSeat = async (i: number) => { await new Promise<void>(resolve => { sockets[i]!.once('close', resolve); sockets[i]!.close(); }); sockets[i] = await connectSeat(i); };
  await host.getByRole('button', { name: /Begin Hearthlands/ }).click();
  await expect(host.getByRole('heading', { name: /Place a Lodge/ })).toBeVisible();
  await expect.poll(() => latest[0]?.game?.phase).toBe('SETUP_FORWARD');
  for (let i = 1; i < 6; i++) await pages[i]!.close();

  const ids = latest[0]!.seats.map(s => s.id);
  await new Promise<void>(resolve => { sockets[5]!.once('close', () => resolve()); sockets[5]!.close(); });
  await expect.poll(async () => (await (await contexts[0]!.request.get(`${url}/api/tables/${code}`)).json() as State).seats[5]!.connected).toBe(false);
  const returning = await contexts[5]!.newPage();
  await returning.goto(`/t/${code}`);
  await expect(returning.getByRole('heading', { name: /Place a Lodge/ })).toBeVisible();
  expect((await (await contexts[5]!.request.get(`${url}/api/tables/${code}`)).json()).self).toBe(ids[5]);
  await returning.close();
  sockets[5] = await connectSeat(5);

  let game = latest[0]!.game!;
  let lastTurn = -1, lastActive = '', actionsThisTurn = 0, actions = 0, checkedMain = false, checkedRover = false, checkedTrade = false, checkedChronicle = false;
  const uiUsed = new Set<string>();
  while (game.phase !== 'GAME_OVER' && actions < 12000) {
    game = (await (await contexts[0]!.request.get(`${url}/api/tables/${code}`)).json() as State).game!;
    if (game.turn !== lastTurn || game.active !== lastActive) { actionsThisTurn = 0; lastTurn = game.turn; lastActive = game.active; }
    const actor = game.phase === 'DISCARD_REQUIRED' ? game.discards[0]! : game.active;
    const seat = ids.indexOf(actor);
    if (!checkedRover && seat > 0 && game.phase === 'ROVER_MOVE_REQUIRED') {
      await new Promise<void>(resolve => { sockets[seat]!.once('close', () => resolve()); sockets[seat]!.close(); });
      await expect.poll(async () => (await (await contexts[0]!.request.get(`${url}/api/tables/${code}`)).json() as State).seats[seat]!.connected).toBe(false);
      const roverPage = await contexts[seat]!.newPage();
      await roverPage.goto(`/t/${code}`);
      await expect(roverPage.getByRole('heading', { name: 'Move the Rover' })).toBeVisible();
      await roverPage.setViewportSize({ width: 390, height: 844 });
      await roverPage.screenshot({ path: 'test-results/rover-mobile.png', fullPage: true });
      expect(await roverPage.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await roverPage.close();
      sockets[seat] = await connectSeat(seat);
      const resumed: State = await (await contexts[seat]!.request.get(`${url}/api/tables/${code}`)).json();
      expect(resumed.game?.phase).toBe('ROVER_MOVE_REQUIRED');
      expect(resumed.game?.active).toBe(actor);
      expect(resumed.game?.private).toBeTruthy();
      checkedRover = true;
    }
    let current: State = await (await contexts[seat]!.request.get(`${url}/api/tables/${code}`)).json();
    if (!checkedMain && seat === 0 && current.game?.phase === 'MAIN_ACTION') {
      await host.close();
      await new Promise<void>(resolve => { sockets[0]!.once('close', () => resolve()); sockets[0]!.close(); });
      await expect.poll(async () => (await (await contexts[1]!.request.get(`${url}/api/tables/${code}`)).json()).host).toBe(ids[1]);
      host = await contexts[0]!.newPage();
      host.on('pageerror', error => errors.push(error.message));
      await host.goto(`/t/${code}`);
      await expect(host.getByRole('heading', { name: 'Build, exchange, play a card, or pass' })).toBeVisible();
      sockets[0] = await connectSeat(0);
      await host.reload();
      await expect(host.getByRole('heading', { name: 'Build, exchange, play a card, or pass' })).toBeVisible();
      expect((await (await contexts[0]!.request.get(`${url}/api/tables/${code}`)).json()).self).toBe(ids[0]);
      const button = host.getByRole('button', { name: /Draw Chronicle/ });
      await expect(button).toBeVisible();
      if (current.game.deckCount && canPay(current.game.private!.inventory, costs.Chronicle)) await expect(button).toBeEnabled();
      else await expect(button).toBeDisabled();
      await host.setViewportSize({ width: 390, height: 844 });
      await host.screenshot({ path: 'test-results/main-mobile.png', fullPage: true });
      expect(await host.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await host.evaluate(() => (window as Window & { __tableSocket?: WebSocket }).__tableSocket?.close());
      await expect(host.getByText('Reconnecting to the table…')).toBeVisible();
      await host.screenshot({ path: 'test-results/reconnecting-mobile.png', fullPage: true });
      await expect(host.getByText('Reconnecting to the table…')).toBeHidden({ timeout: 15000 });
      await host.setViewportSize({ width: 1280, height: 900 });
      await renewSeat(0);
      checkedMain = true;
    }
    if (!checkedTrade && seat === 0 && current.game?.phase === 'MAIN_ACTION') {
      const other: State = await (await contexts[1]!.request.get(`${url}/api/tables/${code}`)).json();
      const give = materials.find(m => current.game!.private!.inventory[m] > 0)!;
      const receive = materials.find(m => m !== give && other.game!.private!.inventory[m] > 0) ?? materials.find(m => other.game!.private!.inventory[m] > 0)!;
      expect(give).toBeTruthy(); expect(receive).toBeTruthy();
      const offered = emptyInventory(), requested = emptyInventory(); offered[give] = 1; requested[receive] = 1;
      const hostBefore = { ...current.game.private!.inventory }, friendBefore = { ...other.game!.private!.inventory };
      const offerView = await new Promise<View>((resolve, reject) => {
        const ws = sockets[0]!;
        const timer = setTimeout(() => { ws.off('message', receiveState); reject(Error('Offer was not broadcast.')); }, 5000);
        const receiveState = (data: WebSocket.RawData) => {
          const message = JSON.parse(data.toString());
          if (message.type !== 'STATE' && message.type !== 'ACTION_REJECTED') return;
          clearTimeout(timer); ws.off('message', receiveState);
          if (message.type === 'ACTION_REJECTED') reject(Error(message.error)); else resolve(message.state.game);
        };
        ws.on('message', receiveState);
        ws.send(JSON.stringify({ type: 'GAME_ACTION', id: crypto.randomUUID(), action: { type: 'OFFER', to: ids[1], offered, requested } }));
      });
      const offer = offerView.offer!.id;
      await host.getByRole('button', { name: 'Exchange', exact: true }).click();
      await expect(host.locator('.offer-note')).toBeVisible();
      await host.setViewportSize({ width: 390, height: 844 });
      await host.screenshot({ path: 'test-results/exchange-mobile.png', fullPage: true });
      expect(await host.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      await host.setViewportSize({ width: 1280, height: 900 });
      const trade = await new Promise<{ state: View; error: string }>((resolve, reject) => {
        const ws = sockets[1]!;
        let state: View | null = null, error = '';
        const timer = setTimeout(() => { ws.off('message', receiveTrade); reject(Error('Trade race did not settle.')); }, 5000);
        const receiveTrade = (data: WebSocket.RawData) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'STATE' && message.state.game?.eventNumber > offerView.eventNumber) state = message.state.game;
          if (message.type === 'ACTION_REJECTED') error = message.error;
          if (state && error) { clearTimeout(timer); ws.off('message', receiveTrade); resolve({ state, error }); }
        };
        ws.on('message', receiveTrade);
        for (let i = 0; i < 2; i++) ws.send(JSON.stringify({ type: 'GAME_ACTION', id: crypto.randomUUID(), action: { type: 'ACCEPT_OFFER', offer } }));
      });
      expect(trade.error).toContain('no longer open');
      expect(trade.state.offer).toBeNull();
      expect(trade.state.eventNumber).toBe(offerView.eventNumber + 1);
      current = await (await contexts[0]!.request.get(`${url}/api/tables/${code}`)).json();
      const settledOther: State = await (await contexts[1]!.request.get(`${url}/api/tables/${code}`)).json();
      expect(current.game!.private!.inventory[give]).toBe(hostBefore[give] - (give === receive ? 0 : 1));
      expect(current.game!.private!.inventory[receive]).toBe(hostBefore[receive] + (give === receive ? 0 : 1));
      expect(settledOther.game!.private!.inventory[give]).toBe(friendBefore[give] + (give === receive ? 0 : 1));
      expect(settledOther.game!.private!.inventory[receive]).toBe(friendBefore[receive] - (give === receive ? 0 : 1));
      await host.getByRole('button', { name: 'Play', exact: true }).click();
      checkedTrade = true;
    }
    if (!checkedChronicle && current.game?.phase === 'MAIN_ACTION' && current.game.private?.cards.length) {
      const page = seat === 0 ? host : await contexts[seat]!.newPage();
      if (seat !== 0) await page.goto(`/t/${code}`);
      await page.getByRole('button', { name: 'Chronicles', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Chronicle Cards' })).toBeVisible();
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'test-results/chronicle-mobile.png', fullPage: true });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      if (seat === 0) { await page.setViewportSize({ width: 1280, height: 900 }); await page.getByRole('button', { name: 'Play', exact: true }).click(); }
      else { await page.close(); await renewSeat(seat); }
      checkedChronicle = true;
    }
    const action = nextBotAction(current.game!, actionsThisTurn);
    const useUI = ['ROLL', 'BUILD_TRAIL', 'BUILD_LODGE', 'UPGRADE_HALL', 'SUPPLY_EXCHANGE', 'PLAY_CHRONICLE'].includes(action.type) && !uiUsed.has(action.type);
    const actionPage = useUI ? seat === 0 ? host : await contexts[seat]!.newPage() : null;
    if (actionPage && seat === 0) { await host.reload(); await expect(host.locator('.connection-banner')).toBeHidden(); }
    if (actionPage && seat !== 0) { await actionPage.goto(`/t/${code}`); await expect(actionPage.locator('.game-shell')).toBeVisible(); await expect(actionPage.locator('.connection-banner')).toBeHidden(); }
    if (!actionPage) await renewSeat(seat);
    const ws = sockets[seat]!;
    const beforeAction = stateKey(current.game!);
    game = await new Promise<View>((resolve, reject) => {
      const timer = setTimeout(() => { ws.off('message', receive); reject(Error(`No state after ${JSON.stringify(action)}`)); }, 20000);
      const receive = (data: WebSocket.RawData) => {
        const message = JSON.parse(data.toString());
        if (message.type !== 'STATE' && message.type !== 'ACTION_REJECTED') return;
        if (message.type === 'STATE' && stateKey(message.state.game) === beforeAction) return;
        clearTimeout(timer); ws.off('message', receive);
        if (message.type === 'ACTION_REJECTED') reject(Error(`${JSON.stringify(action)}: ${message.error}`));
        else resolve(message.state.game);
      };
      ws.on('message', receive);
      if (actionPage) void playInBrowser(actionPage, action).catch(error => { clearTimeout(timer); ws.off('message', receive); reject(error); });
      else ws.send(JSON.stringify({ type: 'GAME_ACTION', id: crypto.randomUUID(), action } satisfies { type: 'GAME_ACTION'; id: string; action: Action }));
    });
    if (actionPage) { uiUsed.add(action.type); if (seat !== 0) await actionPage.close(); else if (action.type === 'BUILD_TRAIL') await actionPage.setViewportSize({ width: 1280, height: 900 }); await renewSeat(seat); }
    if (['BUILD_TRAIL','BUILD_LODGE','UPGRADE_HALL','SUPPLY_EXCHANGE','BUY_CHRONICLE','PLAY_CHRONICLE'].includes(action.type)) actionsThisTurn++;
    actions++;
  }
  expect(game.phase, `Match stalled after ${actions} actions`).toBe('GAME_OVER');
  expect(checkedMain).toBe(true);
  expect(checkedRover).toBe(true);
  expect(checkedTrade).toBe(true);
  expect(checkedChronicle).toBe(true);
  for (const type of ['ROLL', 'BUILD_TRAIL', 'BUILD_LODGE', 'PLAY_CHRONICLE']) expect(uiUsed.has(type), `${type} was never exercised in the browser`).toBe(true);
  expect(game.winner).toBeTruthy();
  await expect(host.getByRole('dialog')).toBeVisible();
  await expect(host.getByRole('heading', { name: /wins Hearthlands/ })).toBeVisible();
  await host.screenshot({ path: 'test-results/victory-desktop.png', fullPage: true });
  await host.setViewportSize({ width: 390, height: 844 });
  await expect(host.getByRole('dialog')).toBeVisible();
  await host.screenshot({ path: 'test-results/victory-mobile.png', fullPage: true });
  const overflow = await host.evaluate(() => ({ width: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'fixed').slice(0, 12).map(el => `${el.tagName.toLowerCase()}.${String(el.className)}: ${Math.round(el.getBoundingClientRect().right)}`) }));
  expect(overflow.width, overflow.elements.join('\n')).toBeLessThanOrEqual(390);
  await host.setViewportSize({ width: 320, height: 640 });
  await host.screenshot({ path: 'test-results/victory-narrow.png', fullPage: true });
  expect(await host.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await host.getByRole('button', { name: /View final table/ }).click();
  await expect(host.getByRole('dialog')).toBeHidden();
  await host.getByRole('button', { name: 'Results' }).click();
  await expect(host.getByRole('dialog')).toBeVisible();
  expect(errors).toEqual([]);
  for (const ws of sockets) ws.close();
  for (const context of contexts) await context.close();
});
