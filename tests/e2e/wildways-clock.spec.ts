import { test, expect, type Page } from '@playwright/test';
import { fallbackAction, getLegalPlacements } from '@opentaverns/wildways';
import type { Action, View } from '@opentaverns/wildways/client';

type Room = { code: string; matchId: string; self: string | null; host: string; game: View; deadlineAt: number | null; seats: { id: string; connected: boolean; bot: boolean }[] };
type WireWindow = Window & { wildwaysClockWire?: WebSocket };
const state = (page: Page, code: string): Promise<Room> => page.evaluate(async code => (await (await fetch(`/api/tables/${code}`)).json()), code);
async function wire(page: Page, code: string) {
  await page.evaluate(code => new Promise<void>((resolve, reject) => {
    const target = window as WireWindow;
    target.wildwaysClockWire?.close();
    const socket = new WebSocket(`${location.origin.replace(/^http/, 'ws')}/ws?table=${code}`);
    target.wildwaysClockWire = socket;
    socket.onmessage = event => { if (JSON.parse(event.data).type === 'STATE') { socket.onmessage = null; resolve(); } };
    socket.onerror = () => reject(Error('Wildways WebSocket failed'));
  }), code);
}
async function send(page: Page, room: Room, action: Action, id = crypto.randomUUID()) {
  return page.evaluate(({ action, id, matchId, revision }) => new Promise<{ type: string; error?: string }>(resolve => {
    const socket = (window as WireWindow).wildwaysClockWire!;
    const listener = (event: MessageEvent) => {
      const message = JSON.parse(event.data);
      if (['ACTION_ACK', 'ACTION_REJECTED'].includes(message.type) || (message.type === 'STATE' && (message.state?.game?.revision ?? -1) > revision)) {
        socket.removeEventListener('message', listener);
        resolve(message);
      }
    };
    socket.addEventListener('message', listener);
    socket.send(JSON.stringify({ type: 'GAME_ACTION', id, matchId, expectedRevision: revision, action }));
  }), { action, id, matchId: room.matchId, revision: room.game.revision });
}

test('FAST Wildways timeout commits one deterministic complete move without spending a marker', async ({ page }) => {
  test.setTimeout(95000);
  await page.goto('/');
  const created = await page.request.post('/api/tables', { data: { name: 'Idle Surveyor', gameId: 'wildways', pacing: 'FAST' } });
  expect(created.ok()).toBe(true);
  const code = (await created.json()).code as string;
  await wire(page, code);
  expect((await page.request.post(`/api/tables/${code}/bots`, { data: {} })).ok()).toBe(true);
  expect((await page.request.post(`/api/tables/${code}/start`, { data: {} })).ok()).toBe(true);
  await expect.poll(async () => (await state(page, code)).game.active === (await state(page, code)).self, { timeout: 12000 }).toBe(true);

  const before = await state(page, code);
  expect(before.deadlineAt).not.toBeNull();
  const ownerBefore = before.game.players.find(player => player.id === before.self)!;
  const expected = fallbackAction(before.game);
  const expectedCoordinate = getLegalPlacements(before.game.board)[0]!;
  expect({ x: expected.x, y: expected.y }).toEqual(expectedCoordinate);
  const conservationBefore = before.game.remainingTiles + before.game.market.filter(Boolean).length + before.game.board.length - 1;

  await expect.poll(async () => {
    const current = await state(page, code);
    return current.game.players.find(player => player.id === before.self)!.turns;
  }, { timeout: 72000, intervals: [1000] }).toBe(ownerBefore.turns + 1);

  const after = await state(page, code);
  const ownerAfter = after.game.players.find(player => player.id === before.self)!;
  const timeoutTurn = after.game.history.find(event => event.turn === before.game.turn);
  expect(timeoutTurn).toBeDefined();
  expect(timeoutTurn!.actor).toBe(before.self);
  expect(timeoutTurn!.tile).toBe(expected.tile);
  expect(timeoutTurn!.x).toBe(expected.x);
  expect(timeoutTurn!.y).toBe(expected.y);
  expect(timeoutTurn!.orientation).toBe(0);
  expect(timeoutTurn!.marker).toBeNull();
  expect(ownerAfter.turns).toBe(ownerBefore.turns + 1);
  expect(ownerAfter.markersLeft).toBe(ownerBefore.markersLeft);
  const placed = after.game.board.find(tile => tile.id === expected.tile)!;
  expect({ x: placed.x, y: placed.y, orientation: placed.orientation, marker: placed.marker }).toEqual({ x: expected.x, y: expected.y, orientation: 0, marker: null });
  expect(after.game.revision).toBeGreaterThanOrEqual(before.game.revision + 1);
  const conservationAfter = after.game.remainingTiles + after.game.market.filter(Boolean).length + after.game.board.length - 1;
  expect(conservationAfter).toBe(conservationBefore);
});

test('Wildways grants one disconnect grace per deadline and reconnect preserves placed landscape and markers', async ({ browser }) => {
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  try {
    const [host, guest] = await Promise.all(contexts.map(context => context.newPage()));
    await Promise.all([host.goto('/'), guest.goto('/')]);
    const created = await host.request.post('/api/tables', { data: { name: 'Host', gameId: 'wildways', pacing: 'FAST' } });
    expect(created.ok()).toBe(true);
    const code = (await created.json()).code as string;
    expect((await guest.request.post(`/api/tables/${code}/join`, { data: { name: 'Guest' } })).ok()).toBe(true);
    await Promise.all([wire(host, code), wire(guest, code)]);
    expect((await host.request.post(`/api/tables/${code}/start`, { data: {} })).ok()).toBe(true);

    let room = await state(host, code);
    const activePage = room.game.active === room.self ? host : guest;
    const activeRoom = await state(activePage, code);
    const offer = activeRoom.game.market.find(item => item !== null)!;
    const coordinate = getLegalPlacements(activeRoom.game.board)[0]!;
    const placement: Action = {
      type: 'PLACE_LANDSCAPE_TILE', round: activeRoom.game.round, turn: activeRoom.game.turn,
      revision: activeRoom.game.revision, offer: offer.id, tile: offer.tile.id,
      ...coordinate, orientation: 0, marker: 'habitat',
    };
    expect((await send(activePage, activeRoom, placement)).type).toBe('STATE');
    room = await state(host, code);
    const placedTile = room.game.board.find(tile => tile.id === offer.tile.id)!;
    expect(placedTile.marker?.owner).toBe(activeRoom.self);
    expect(placedTile.marker?.mode).toBe('habitat');
    const turnsAfterMove = room.game.turn;

    const disconnectPage = room.game.active === room.self ? host : guest;
    const reconnectPage = disconnectPage === host ? host : guest;
    const beforeDisconnect = await state(disconnectPage, code);
    const baseDeadline = beforeDisconnect.deadlineAt!;
    expect(beforeDisconnect.game.turn).toBe(turnsAfterMove);
    await disconnectPage.evaluate(() => (window as WireWindow).wildwaysClockWire!.close());
    await expect.poll(async () => (await state(disconnectPage, code)).seats.find(seat => seat.id === beforeDisconnect.self)!.connected).toBe(false);
    const firstDisconnect = await state(disconnectPage, code);
    expect(firstDisconnect.deadlineAt).toBe(baseDeadline + 30000);

    await wire(reconnectPage, code);
    await expect.poll(async () => (await state(reconnectPage, code)).seats.find(seat => seat.id === beforeDisconnect.self)!.connected).toBe(true);
    room = await state(reconnectPage, code);
    expect(room.deadlineAt).toBe(baseDeadline + 30000);
    expect(room.game.turn).toBe(turnsAfterMove);
    expect(room.game.board.find(tile => tile.id === placedTile.id)).toEqual(placedTile);
    expect(room.game.players.find(player => player.id === activeRoom.self)!.markersLeft).toBe(7);

    await reconnectPage.evaluate(() => (window as WireWindow).wildwaysClockWire!.close());
    await expect.poll(async () => (await state(reconnectPage, code)).seats.find(seat => seat.id === beforeDisconnect.self)!.connected).toBe(false);
    const secondDisconnect = await state(reconnectPage, code);
    expect(secondDisconnect.deadlineAt).toBe(baseDeadline + 30000);
    expect(secondDisconnect.game.turn).toBe(turnsAfterMove);
    expect(secondDisconnect.game.board.find(tile => tile.id === placedTile.id)).toEqual(placedTile);

    await wire(reconnectPage, code);
    await expect.poll(async () => (await state(reconnectPage, code)).seats.find(seat => seat.id === beforeDisconnect.self)!.connected).toBe(true);
    room = await state(reconnectPage, code);
    expect(room.deadlineAt).toBe(baseDeadline + 30000);
    expect(room.game.turn).toBe(turnsAfterMove);
    expect(room.game.board.find(tile => tile.id === placedTile.id)).toEqual(placedTile);
    expect(room.game.players.find(player => player.id === activeRoom.self)!.markersLeft).toBe(7);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
