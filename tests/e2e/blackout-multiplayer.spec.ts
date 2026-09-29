import { test, expect, type Page } from '@playwright/test';

const state = (page: Page, code: string) => page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()), code);
async function rejectedRawAction(page: Page, code: string, action: object) {
  return page.evaluate(({ code, action }) => new Promise<string>((resolve, reject) => {
    const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws?table=${code}`);
    const timer = setTimeout(() => { socket.close(); reject(Error('No action rejection arrived.')); }, 5000);
    socket.onopen = () => socket.send(JSON.stringify({ type: 'GAME_ACTION', id: crypto.randomUUID(), action }));
    socket.onmessage = event => { const message = JSON.parse(event.data); if (message.type === 'ACTION_REJECTED') { clearTimeout(timer); socket.close(); resolve(message.error); } };
    socket.onerror = () => { clearTimeout(timer); reject(Error('WebSocket failed.')); };
  }), { code, action });
}

test('ten seats complete a private simultaneous response, audit, and reconnect', async ({ browser }) => {
  test.setTimeout(150000);
  const contexts = await Promise.all(Array.from({ length: 11 }, (_, index) => browser.newContext({ viewport: index % 2 ? { width: 390, height: 844 } : { width: 1280, height: 800 } })));
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    const host = pages[0]!;
    await host.goto('/');
    await host.getByRole('button', { name: /Choose Blackout/ }).click();
    await host.getByPlaceholder('What should friends call you?').fill('Player 1');
    await host.getByRole('button', { name: /Create a table/ }).click();
    await expect(host.locator('.bo-lobby')).toBeVisible();
    const code = new URL(host.url()).pathname.split('/').pop()!;
    for (let index = 1; index < 10; index++) {
      const page = pages[index]!;
      await page.goto(`/t/${code}`);
      await page.getByPlaceholder('What should friends call you?').fill(`Player ${index + 1}`);
      await page.getByRole('button', { name: /Join table/ }).click();
      await expect(page.locator('.bo-lobby')).toBeVisible();
    }
    await expect.poll(async () => (await state(host, code)).seats.filter((seat: { connected: boolean }) => seat.connected).length).toBe(10);
    await expect(host.getByRole('button', { name: /Begin Blackout/ })).toBeEnabled();
    await host.getByRole('button', { name: /Begin Blackout/ }).click();
    for (const [index, page] of pages.slice(0, 10).entries()) {
      await expect(page.getByRole('dialog', { name: 'Your private Blackout role' })).toBeVisible();
      await page.getByRole('button', { name: /I understand/ }).click();
      if (index === 0) { await page.reload(); expect((await state(page, code)).game.self.confirmed).toBe(true); }
    }
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('INCIDENT_REVEAL');
    const spectator = pages[10]!;
    await spectator.goto(`/t/${code}`);
    await spectator.getByPlaceholder('What should friends call you?').fill('Observer');
    await spectator.getByRole('checkbox', { name: 'Watch as spectator' }).check();
    await spectator.getByRole('button', { name: /Join table/ }).click();
    const publicState = (await state(spectator, code)).game;
    expect(publicState.self).toBeNull();
    expect(publicState.truth).toBeNull();
    expect(publicState.players[0]).not.toHaveProperty('faction');
    expect(publicState).not.toHaveProperty('incidentDeck');
    await host.getByRole('button', { name: /Open the briefing/ }).click();
    await host.getByRole('button', { name: /Assign responders/ }).click();
    const draft = host.locator('.bo-team-picks button');
    await expect(draft).toHaveCount(10);
    for (let index = 0; index < 8; index++) await draft.nth(index).click();
    await host.getByRole('button', { name: 'Publish teams' }).click();
    await expect.poll(async () => (await state(host, code)).game.orders.map((order: { responders: string[] }) => order.responders.length)).toEqual([4, 4]);
    await host.getByRole('button', { name: /Lock assignments/ }).click();
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('SECRET_ACTION');
    const beforeReload = (await state(host, code)).self;
    await host.locator('.bo-response-choices').getByRole('button', { name: /Diagnose/ }).click();
    await host.reload();
    await expect(host.locator('.bo-response-choices').getByRole('button', { name: /Diagnose/ })).toHaveAttribute('aria-pressed', 'true');
    expect((await state(host, code)).self).toBe(beforeReload);
    for (let index = 0; index < 8; index++) {
      const page = pages[index]!;
      if (index === 4) await page.locator('.bo-response-choices').getByRole('button', { name: /Diagnose/ }).click();
      else if (index !== 0) await page.locator('.bo-response-choices').getByRole('button', { name: /Stabilize/ }).click();
      await page.getByRole('button', { name: /Lock response/ }).click();
      if (index === 0) {
        await page.reload();
        expect((await state(page, code)).game.self.lockedResponse).toBe('DIAGNOSE');
        const spectatorView = (await state(spectator, code)).game;
        expect(spectatorView.orders[0].lockedPlayers).toHaveLength(1);
        expect(spectatorView.orders[0]).not.toHaveProperty('locked');
        expect(spectatorView.truth).toBeNull();
        expect((await state(pages[1]!, code)).game.self).not.toHaveProperty('lockedResponse', 'DIAGNOSE');
      }
    }
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('RESOLUTION');
    expect((await state(host, code)).game.insight).toBe(2);
    await host.getByRole('button', { name: /Open Audit vote/ }).click();
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('AUDIT_VOTE');
    for (let index = 0; index < 9; index++) {
      await pages[index]!.getByRole('button', { name: /Audit / }).first().click();
      if (index === 0) { await host.reload(); expect((await state(host, code)).game.self.voted).toBe(true); }
      const live = (await state(spectator, code)).game;
      expect(live.voteProgress).toBe(index + 1);
      expect(live.history.at(-1).text).toMatch(/locked an Audit vote/);
      expect(JSON.stringify(live)).not.toMatch(/vote revealed/i);
    }
    await pages[9]!.getByRole('button', { name: /Audit / }).first().click();
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('ROUND_END');
    expect((await state(host, code)).game.auditResults).toHaveLength(1);
    await host.getByRole('button', { name: /Begin next shift/ }).click();
    await expect.poll(async () => (await state(host, code)).game.round).toBe(2);
  } finally { await Promise.all(contexts.map(context => context.close())); }
});

test('a newer tab controls one seat and an Away responder becomes a bot', async ({ browser }) => {
  test.setTimeout(90000);
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  try {
    const host = await hostContext.newPage();
    const guest = await guestContext.newPage();
    const spectator = await spectatorContext.newPage();
    await host.goto('/');
    await host.getByRole('button', { name: /Choose Blackout/ }).click();
    await host.getByPlaceholder('What should friends call you?').fill('Host');
    await host.getByRole('button', { name: /Create a table/ }).click();
    await expect(host.locator('.bo-lobby')).toBeVisible();
    const code = new URL(host.url()).pathname.split('/').pop()!;
    await guest.goto(`/t/${code}`);
    await guest.getByPlaceholder('What should friends call you?').fill('Guest');
    await guest.getByRole('button', { name: /Join table/ }).click();
    await expect(guest.locator('.bo-lobby')).toBeVisible();
    for (let count = 3; count <= 5; count++) {
      await host.getByRole('button', { name: /Add a bot/ }).click();
      await expect.poll(async () => (await state(host, code)).seats.length).toBe(count);
    }
    const guestId = (await state(guest, code)).self;
    await host.getByRole('button', { name: /Begin Blackout/ }).click();
    await host.getByRole('button', { name: /I understand/ }).click();
    await guest.getByRole('button', { name: /I understand/ }).click();
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('INCIDENT_REVEAL');
    await host.getByRole('button', { name: /Open the briefing/ }).click();
    await host.getByRole('button', { name: /Assign responders/ }).click();
    for (let index = 0; index < 4; index++) await host.locator('.bo-team-picks button').nth(index).click();
    await host.getByRole('button', { name: 'Publish teams' }).click();
    await expect.poll(async () => (await state(host, code)).game.orders[0].responders.length).toBe(2);
    await host.getByRole('button', { name: /Lock assignments/ }).click();
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('SECRET_ACTION');
    const privateFaction = (await state(guest, code)).game.self.faction;
    const newer = await guestContext.newPage();
    await newer.goto(`/t/${code}`);
    await expect(newer.locator('.bo-response-choices')).toBeVisible();
    expect((await state(newer, code)).game.self.faction).toBe(privateFaction);
    await guest.locator('.bo-response-choices').getByRole('button', { name: /Stabilize/ }).click();
    await guest.getByRole('button', { name: /Lock response/ }).click();
    await expect(guest.getByRole('alert')).toContainText('newer tab');
    expect((await state(newer, code)).game.self.lockedResponse).toBeNull();
    await spectator.goto(`/t/${code}`);
    await spectator.getByPlaceholder('What should friends call you?').fill('Observer');
    await spectator.getByRole('checkbox', { name: 'Watch as spectator' }).check();
    await spectator.getByRole('button', { name: /Join table/ }).click();
    expect((await state(spectator, code)).game.self).toBeNull();
    await guestContext.close();
    await expect.poll(async () => (await state(host, code)).seats.find((seat: { id: string }) => seat.id === guestId).connected).toBe(false);
    await host.getByRole('button', { name: 'Replace with bot' }).click();
    await expect.poll(async () => (await state(host, code)).seats.find((seat: { id: string }) => seat.id === guestId).bot).toBe(true);
    expect((await state(host, code)).seats.find((seat: { id: string }) => seat.id === guestId).id).toBe(guestId);
    await host.locator('.bo-response-choices').getByRole('button', { name: /Stabilize/ }).click();
    await host.getByRole('button', { name: /Lock response/ }).click();
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('RESOLUTION');
  } finally { await Promise.allSettled([hostContext.close(), guestContext.close(), spectatorContext.close()]); }
});

test('the server rejects forged phase advancement, assignments, and spectator actions', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const spectatorContext = await browser.newContext();
  try {
    const host = await hostContext.newPage(), spectator = await spectatorContext.newPage();
    await host.goto('/'); await host.getByRole('button', { name: /Choose Blackout/ }).click();
    await host.getByPlaceholder('What should friends call you?').fill('Host');
    await host.getByRole('button', { name: /Create a table/ }).click();
    await expect(host.locator('.bo-lobby')).toBeVisible();
    const code = new URL(host.url()).pathname.split('/').pop()!;
    for (let index = 0; index < 4; index++) { await host.getByRole('button', { name: /Add a bot/ }).click(); await expect.poll(async () => (await state(host, code)).seats.length).toBe(index + 2); }
    await host.getByRole('button', { name: /Begin Blackout/ }).click();
    await host.getByRole('button', { name: /I understand/ }).click();
    await expect.poll(async () => (await state(host, code)).game.phase).toBe('INCIDENT_REVEAL');
    expect(await rejectedRawAction(host, code, { type: 'TIMEOUT' })).toMatch(/malformed/i);
    expect((await state(host, code)).game.phase).toBe('INCIDENT_REVEAL');
    await host.getByRole('button', { name: /Open the briefing/ }).click();
    await host.getByRole('button', { name: /Assign responders/ }).click();
    const hostId = (await state(host, code)).self;
    expect(await rejectedRawAction(host, code, { type: 'SET_TEAMS', teams: [[hostId, hostId], []] })).toMatch(/one valid assignment/i);
    expect((await state(host, code)).game.orders[0].responders).toHaveLength(0);
    await spectator.goto(`/t/${code}`);
    await spectator.getByPlaceholder('What should friends call you?').fill('Observer');
    await spectator.getByRole('checkbox', { name: 'Watch as spectator' }).check();
    await spectator.getByRole('button', { name: /Join table/ }).click();
    expect(await rejectedRawAction(spectator, code, { type: 'LOCK_ASSIGNMENT' })).toMatch(/Spectators cannot play/i);
  } finally { await Promise.all([hostContext.close(), spectatorContext.close()]); }
});
