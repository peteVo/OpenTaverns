import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomInt } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { parse, serialize } from 'cookie';
import { z } from 'zod';
import { applyAction, createGame, project, type Action, type Game, type RandomState, type View } from '@opentaverns/hearthlands';
import { nextBotAction } from '@opentaverns/hearthlands/simulate';
import * as grid from '@opentaverns/saigon-grid';
import { nextBotAction as nextGridBotAction } from '@opentaverns/saigon-grid/simulate';
import { createScenario, scenarioNames } from '@opentaverns/saigon-grid/scenarios';

type Seat = { id: string; name: string; token?: string; connected: boolean; bot: boolean };
type Room = { code: string; inviteUrl: string; gameId: 'hearthlands' | 'saigon-grid'; host: string; seats: Seat[]; spectators: Map<string, string>; game: Game | grid.Game | null; sockets: Map<string, Set<WebSocket>>; controllers: Map<string, WebSocket>; seenActions: Set<string>; created: number; seed: number; debugSeed: boolean; botTurn: string; botActionsThisTurn: number; botsRunning: boolean };
const rooms = new Map<string, Room>();
const development = process.argv.includes('--development');
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || process.env.PORT || 3000);
const codeAlphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const token = () => randomBytes(32).toString('base64url');
const id = () => randomBytes(12).toString('hex');
const privateRandom = (): RandomState => { const bytes = randomBytes(16); return [0, 4, 8, 12].map(i => bytes.readUInt32LE(i)) as RandomState; };
const code = () => Array.from({ length: 6 }, () => codeAlphabet[randomInt(codeAlphabet.length)]).join('');
const safeName = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 24) : '';
const inventorySchema = z.object({ Timber: z.number().int().nonnegative(), Stone: z.number().int().nonnegative(), Provisions: z.number().int().nonnegative(), Textiles: z.number().int().nonnegative(), Metal: z.number().int().nonnegative() }).strict();
const materialSchema = z.enum(['Timber', 'Stone', 'Provisions', 'Textiles', 'Metal']);
const numberSchema = z.number().int().nonnegative();
const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('SETUP_LODGE'), site: numberSchema }), z.object({ type: z.literal('SETUP_TRAIL'), link: numberSchema }),
  z.object({ type: z.literal('ROLL') }), z.object({ type: z.literal('DISCARD'), materials: inventorySchema }),
  z.object({ type: z.literal('MOVE_ROVER'), region: numberSchema }), z.object({ type: z.literal('TARGET_ROVER'), player: z.string().nullable() }),
  z.object({ type: z.literal('BUILD_TRAIL'), link: numberSchema }), z.object({ type: z.literal('BUILD_LODGE'), site: numberSchema }),
  z.object({ type: z.literal('UPGRADE_HALL'), site: numberSchema }), z.object({ type: z.literal('BUY_CHRONICLE') }),
  z.object({ type: z.literal('PLAY_CHRONICLE'), card: numberSchema, material: materialSchema.optional(), region: numberSchema.optional(), links: z.array(numberSchema).optional() }),
  z.object({ type: z.literal('OFFER'), to: z.string(), offered: inventorySchema, requested: inventorySchema }),
  z.object({ type: z.literal('ACCEPT_OFFER'), offer: numberSchema }), z.object({ type: z.literal('REJECT_OFFER'), offer: numberSchema }), z.object({ type: z.literal('CANCEL_OFFER'), offer: numberSchema }),
  z.object({ type: z.literal('SUPPLY_EXCHANGE'), give: materialSchema, receive: materialSchema }), z.object({ type: z.literal('END_TURN') }), z.object({ type: z.literal('END_WAYFARE') }),
]);
const gridSideSchema = z.object({ credits: z.number().int().nonnegative(), assets: z.array(numberSchema).max(28) }).strict();
const gridActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ROLL') }), z.object({ type: z.literal('PURCHASE') }), z.object({ type: z.literal('DECLINE') }),
  z.object({ type: z.literal('BID'), amount: z.number().int().positive(), revision: numberSchema }), z.object({ type: z.literal('WITHDRAW'), revision: numberSchema }),
  z.object({ type: z.literal('END_TURN') }), z.object({ type: z.literal('DEVELOP'), asset: numberSchema }), z.object({ type: z.literal('SELL_DEVELOPMENT'), asset: numberSchema }),
  z.object({ type: z.literal('TAKE_LOAN'), asset: numberSchema }), z.object({ type: z.literal('REPAY_LOAN'), asset: numberSchema }),
  z.object({ type: z.literal('PROPOSE_TRADE'), to: z.string(), give: gridSideSchema, receive: gridSideSchema }),
  z.object({ type: z.literal('COUNTER_TRADE'), trade: numberSchema, give: gridSideSchema, receive: gridSideSchema }),
  z.object({ type: z.literal('ACCEPT_TRADE'), trade: numberSchema, revision: numberSchema }), z.object({ type: z.literal('REJECT_TRADE'), trade: numberSchema }), z.object({ type: z.literal('CANCEL_TRADE'), trade: numberSchema }),
  z.object({ type: z.literal('PAY_REVIEW') }), z.object({ type: z.literal('USE_REVIEW_PASS') }), z.object({ type: z.literal('DECLARE_INSOLVENT') }),
]);
const messageSchema = z.object({ type: z.literal('GAME_ACTION'), id: z.uuid(), expectedRevision: numberSchema.optional(), action: z.unknown() }).strict();
const send = (res: ServerResponse, status: number, data: unknown) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(data)); };
function sameOrigin(req: IncomingMessage) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const remote = req.socket.remoteAddress;
    const devProxy = development && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote || '');
    const proxyHost = devProxy ? req.headers['x-forwarded-host'] : undefined;
    const forwardedHost = (Array.isArray(proxyHost) ? proxyHost[0] : proxyHost)?.split(',')[0]?.trim();
    return new URL(origin).host.toLowerCase() === (forwardedHost || req.headers.host || '').toLowerCase();
  } catch { return false; }
}
function session(req: IncomingMessage, res?: ServerResponse) {
  const existing = parse(req.headers.cookie || '').ot_session;
  if (existing && /^[A-Za-z0-9_-]{43}$/.test(existing)) return existing;
  const fresh = token();
  if (res) res.setHeader('set-cookie', serialize('ot_session', fresh, { httpOnly: true, sameSite: 'lax', path: '/', secure: req.headers['x-forwarded-proto'] === 'https', maxAge: 60 * 60 * 24 * 90 }));
  return fresh;
}
async function body(req: IncomingMessage) {
  let input = '';
  for await (const chunk of req) { input += chunk; if (input.length > 16000) throw Error('Request is too large.'); }
  try { return JSON.parse(input) as unknown; } catch { throw Error('Invalid request.'); }
}
function roomFor(codeValue: string) { const room = rooms.get(codeValue.toUpperCase()); if (!room) throw Error('No table has that code.'); return room; }
function viewer(room: Room, sessionToken: string) { return room.seats.find(s => !s.bot && s.token === sessionToken) ?? null; }
function inviteUrl(req: IncomingMessage, codeValue: string) {
  const origin = req.headers.origin || `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers['x-forwarded-host'] || req.headers.host || 'localhost'}`;
  const url = new URL(origin);
  if (['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname)) {
    const addresses = Object.entries(networkInterfaces()).flatMap(([name, entries]) => /wsl|hyper-v|virtual|vmware|virtualbox|docker|loopback/i.test(name) ? [] : entries ?? []);
    const lanAddress = addresses.find(info => info.family === 'IPv4' && !info.internal && (/^(10|192\.168)\./.test(info.address) || /^172\.(1[6-9]|2\d|3[01])\./.test(info.address)));
    if (lanAddress) url.hostname = lanAddress.address;
  }
  url.pathname = `/t/${codeValue}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}
function roomView(room: Room, sessionToken: string): { code: string; inviteUrl: string; gameId: string; host: string; self: string | null; spectator: boolean; seats: { id: string; name: string; connected: boolean; bot: boolean }[]; game: View | grid.View | null } {
  const seat = viewer(room, sessionToken);
  const eliminated = room.gameId === 'saigon-grid' && (room.game as grid.Game | null)?.players.find(p => p.id === seat?.id)?.eliminated;
  return { code: room.code, inviteUrl: room.inviteUrl, gameId: room.gameId, host: room.host, self: eliminated ? null : seat?.id ?? null, spectator: !seat || !!eliminated, seats: room.seats.map(({ id, name, connected, bot }) => ({ id, name, connected, bot })), game: room.game ? room.gameId === 'saigon-grid' ? grid.project(room.game as grid.Game) : project(room.game as Game, seat?.id) : null };
}
function broadcast(room: Room) {
  for (const [sessionToken, sockets] of room.sockets) {
    const message = JSON.stringify({ type: 'STATE', state: roomView(room, sessionToken) });
    for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.send(message);
  }
}
function reconnect(room: Room, sessionToken: string, connected: boolean) {
  const seat = viewer(room, sessionToken); if (!seat) return;
  seat.connected = connected;
  if (room.game) { const p = room.game.players.find(p => p.id === seat.id); if (p) p.connected = connected; }
  if (connected && !room.seats.find(s => s.id === room.host)?.connected) room.host = seat.id;
  if (!connected && room.host === seat.id) { const next = room.seats.find(s => !s.bot && s.connected && s.id !== seat.id); if (next) room.host = next.id; }
  broadcast(room);
}
async function runBotTurns(room: Room) {
  if (room.botsRunning) return;
  room.botsRunning = true;
  let actor = '';
  let actions = 0;
  try {
    while (room.game && room.game.phase !== 'GAME_OVER' && actions < 100) {
      actions++;
      if (room.gameId === 'saigon-grid') {
        const game = room.game as grid.Game;
        actor = game.trade && game.phase !== 'AUCTION' && room.seats.find(s => s.id === game.trade?.to)?.bot ? game.trade.to : game.phase === 'AUCTION' ? game.auction!.active.find(id => id !== game.auction!.leader && room.seats.find(s => s.id === id)?.bot) || '' : game.active;
        if (!room.seats.find(s => s.id === actor)?.bot) return;
        const turn = `${game.turn}:${game.active}`;
        if (room.botTurn !== turn) { room.botTurn = turn; room.botActionsThisTurn = 0; }
        const action = nextGridBotAction(grid.project(game), actor, room.botActionsThisTurn);
        if (!action) return;
        room.game = grid.applyAction(game, actor, action);
        if (['DEVELOP', 'PROPOSE_TRADE'].includes(action.type)) room.botActionsThisTurn++;
        broadcast(room);
        await new Promise(resolve => setTimeout(resolve, 80));
        continue;
      }
      const game = room.game as Game;
      actor = game.phase === 'DISCARD_REQUIRED' ? game.discards[0]! : game.active;
      if (!room.seats.find(s => s.id === actor)?.bot) return;
      const turn = `${game.turn}:${game.active}`;
      if (room.botTurn !== turn) { room.botTurn = turn; room.botActionsThisTurn = 0; }
      const action = nextBotAction(project(game, actor), room.botActionsThisTurn);
      room.game = applyAction(game, actor, action);
      if (['BUILD_TRAIL', 'BUILD_LODGE', 'UPGRADE_HALL', 'SUPPLY_EXCHANGE', 'BUY_CHRONICLE', 'PLAY_CHRONICLE'].includes(action.type)) room.botActionsThisTurn++;
      broadcast(room);
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    if (actions >= 100 && room.game?.phase !== 'GAME_OVER') console.error(`Bot action limit reached at table ${room.code}.`);
  } catch (error) { console.error(`Bot ${actor} failed at table ${room.code}:`, error); }
  finally { room.botsRunning = false; }
}
async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  try {
    if (req.method === 'POST' && !sameOrigin(req)) { send(res, 403, { error: 'This request came from another site.' }); return; }
    const sessionToken = session(req, res);
    if (req.method === 'POST' && url.pathname === '/api/tables') {
      const input = z.object({ name: z.string(), gameId: z.enum(['hearthlands', 'saigon-grid']), seed: z.number().int().min(0).max(0xffffffff).optional(), scenario: z.enum(scenarioNames).optional() }).parse(await body(req));
      const name = safeName(input.name); if (!name) throw Error('Enter a display name.');
      if (input.seed !== undefined && !development) throw Error('A custom seed is available only in development.');
      if (input.scenario && (!development || input.gameId !== 'saigon-grid')) throw Error('A Saigon Grid scenario is available only in development.');
      let roomCode = code(); while (rooms.has(roomCode)) roomCode = code();
      const seat = { id: id(), name, token: sessionToken, connected: false, bot: false };
      const room: Room = { code: roomCode, inviteUrl: inviteUrl(req, roomCode), gameId: input.gameId, host: seat.id, seats: [seat], spectators: new Map(), game: null, sockets: new Map(), controllers: new Map(), seenActions: new Set(), created: Date.now(), seed: input.seed ?? randomInt(0, 0x100000000), debugSeed: input.seed !== undefined, botTurn: '', botActionsThisTurn: 0, botsRunning: false };
      if (input.scenario) { const botSeat: Seat = { id: id(), name: 'Courier 1', connected: true, bot: true }; room.seats.push(botSeat); room.game = createScenario(input.scenario, room.seats.map(({ id, name }) => ({ id, name })), room.seed); room.game.players[0]!.connected = false; }
      rooms.set(roomCode, room); send(res, 201, roomView(room, sessionToken)); return;
    }
    const match = url.pathname.match(/^\/api\/tables\/([A-Z0-9]{6})(?:\/(join|start|bots))?$/i);
    if (!match) { send(res, 404, { error: 'Table not found.' }); return; }
    const room = roomFor(match[1]!);
    if (req.method === 'GET' && !match[2]) { if (!viewer(room, sessionToken) && !room.spectators.has(sessionToken)) throw Error('Join this table first.'); send(res, 200, roomView(room, sessionToken)); return; }
    if (req.method === 'POST' && match[2] === 'join') {
      const input = z.object({ name: z.string(), spectator: z.boolean().optional() }).parse(await body(req));
      const name = safeName(input.name); if (!name) throw Error('Enter a display name.');
      let seat = viewer(room, sessionToken);
      if (!seat && !room.game && !input.spectator && room.seats.length < 6) { seat = { id: id(), name, token: sessionToken, connected: false, bot: false }; room.seats.push(seat); }
      else if (!seat) room.spectators.set(sessionToken, name);
      if (seat && room.sockets.get(sessionToken)?.size) reconnect(room, sessionToken, true);
      broadcast(room); send(res, 200, roomView(room, sessionToken)); return;
    }
    if (req.method === 'POST' && match[2] === 'bots') {
      const seat = viewer(room, sessionToken); if (!seat || room.host !== seat.id) throw Error('Only the host can manage bot players.');
      const input = z.object({ replaceSeatId: z.string().optional() }).strict().parse(await body(req));
      if (room.game && (!input.replaceSeatId || room.gameId !== 'saigon-grid')) throw Error('Only an Away Saigon Grid player may become a bot during a match.');
      if (input.replaceSeatId) {
        const index = room.seats.findIndex(s => s.id === input.replaceSeatId);
        const away = room.seats[index];
        if (!away || away.bot || away.connected || away.id === room.host) throw Error('Choose an Away player to replace.');
        if (away.token) { room.sockets.delete(away.token); room.controllers.delete(away.token); }
        room.seats[index] = { id: room.game ? away.id : id(), name: room.game ? away.name : room.gameId === 'saigon-grid' ? `Courier ${room.seats.filter(s => s.bot).length + 1}` : `Wayfarer ${room.seats.filter(s => s.bot).length + 1}`, connected: true, bot: true };
        if (room.game) { const player = room.game.players.find(p => p.id === away.id); if (player) player.connected = true; }
      } else {
        if (room.seats.length >= 6) throw Error('The table is full.');
        room.seats.push({ id: id(), name: room.gameId === 'saigon-grid' ? `Courier ${room.seats.filter(s => s.bot).length + 1}` : `Wayfarer ${room.seats.filter(s => s.bot).length + 1}`, connected: true, bot: true });
      }
      broadcast(room); send(res, 200, roomView(room, sessionToken)); if (room.game) void runBotTurns(room); return;
    }
    if (req.method === 'POST' && match[2] === 'start') {
      const seat = viewer(room, sessionToken); if (!seat || room.host !== seat.id) throw Error('Only the host can start.');
      if (room.game) throw Error('This match has already started.');
      if (room.seats.length < (room.gameId === 'saigon-grid' ? 2 : 3) || room.seats.length > 6) throw Error(`${room.gameId === 'saigon-grid' ? 'Saigon Grid needs 2–6' : 'Hearthlands needs 3–6'} players.`);
      if (room.seats.some(s => !s.bot && !s.connected)) throw Error('Wait for every player to connect or replace an Away player with a bot.');
      room.game = room.gameId === 'saigon-grid' ? grid.createGame(room.seats.map(({ id, name }) => ({ id, name })), room.seed) : createGame(room.seats.map(({ id, name }) => ({ id, name })), room.seed, room.debugSeed ? undefined : privateRandom());
      for (const p of room.game.players) p.connected = room.seats.find(s => s.id === p.id)!.connected;
      broadcast(room); send(res, 200, roomView(room, sessionToken)); void runBotTurns(room); return;
    }
    send(res, 405, { error: 'That request is unavailable.' });
  } catch (error) { send(res, 400, { error: error instanceof z.ZodError ? 'Check the details you entered.' : error instanceof Error ? error.message : 'Request failed.' }); }
}
const dist = resolve(fileURLToPath(new URL('../../web/dist', import.meta.url)));
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/health') { send(res, 200, { status: 'ok' }); return; }
  if (url.pathname.startsWith('/api/debug/')) {
    const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '') && ['localhost', '127.0.0.1'].includes(url.hostname);
    const match = url.pathname.match(/^\/api\/debug\/tables\/([A-Z0-9]{6})$/i);
    if (!development || !local || !match) { send(res, 404, { error: 'Not found.' }); return; }
    const room = rooms.get(match[1]!.toUpperCase());
    if (!room) { send(res, 404, { error: 'Table not found.' }); return; }
    send(res, 200, { code: room.code, host: room.host, seed: room.seed, seats: room.seats.map(({ id, name, connected, bot }) => ({ id, name, connected, bot })), connections: [...room.sockets.values()].reduce((n, sockets) => n + sockets.size, 0), game: room.game });
    return;
  }
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  const requested = resolve(dist, '.' + decodeURIComponent(url.pathname));
  const path = requested === dist || requested.startsWith(dist + sep) ? requested : dist;
  try { let file = path; try { if (!(await stat(path)).isFile()) file = resolve(dist, 'index.html'); } catch { file = resolve(dist, 'index.html'); } const data = await readFile(file); res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { res.writeHead(404); res.end('Run the web development server on port 5173 or build the client.'); }
});
const wss = new WebSocketServer({ noServer: true, maxPayload: 16000 });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  if (url.pathname !== '/ws' || !sameOrigin(req)) { socket.destroy(); return; }
  const room = rooms.get((url.searchParams.get('table') || '').toUpperCase());
  const sessionToken = parse(req.headers.cookie || '').ot_session;
  if (!room || !sessionToken || (!viewer(room, sessionToken) && !room.spectators.has(sessionToken))) { socket.destroy(); return; }
  wss.handleUpgrade(req, socket, head, ws => {
    alive.add(ws); ws.on('pong', () => alive.add(ws));
    let sockets = room.sockets.get(sessionToken);
    if (!sockets) { sockets = new Set(); room.sockets.set(sessionToken, sockets); }
    sockets.add(ws); reconnect(room, sessionToken, true);
    room.controllers.set(sessionToken, ws);
    ws.send(JSON.stringify({ type: 'STATE', state: roomView(room, sessionToken) }));
    ws.on('message', data => {
      try {
        const message = messageSchema.parse(JSON.parse(data.toString()));
        const seat = viewer(room, sessionToken);
        if (!seat) throw Error('Spectators cannot play.');
        if (!room.game) throw Error('The match has not started.');
        if (room.controllers.get(sessionToken) !== ws) throw Error('A newer tab controls this seat.');
        const actionKey = `${seat.id}:${message.id}`;
        if (room.seenActions.has(actionKey)) { ws.send(JSON.stringify({ type: 'ACTION_ACK', id: message.id })); return; }
        if (room.gameId === 'saigon-grid') {
          const action = gridActionSchema.parse(message.action) as grid.Action;
          if (message.expectedRevision !== undefined && message.expectedRevision !== (room.game as grid.Game).revision) throw Error('The table changed. Review the latest state and try again.');
          room.game = grid.applyAction(room.game as grid.Game, seat.id, action);
        } else room.game = applyAction(room.game as Game, seat.id, actionSchema.parse(message.action) as Action);
        room.seenActions.add(actionKey);
        if (development) console.log(JSON.stringify({ tableId: room.code, gameId: room.gameId, playerId: seat.id, actionId: message.id, gameRevision: room.gameId === 'saigon-grid' ? (room.game as grid.Game).revision : undefined, phase: room.game.phase, eventType: 'GAME_ACTION' }));
        broadcast(room);
        void runBotTurns(room);
      } catch (error) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ACTION_REJECTED', error: error instanceof z.ZodError ? 'That action was malformed.' : error instanceof Error ? error.message : 'Invalid action.' })); }
    });
    ws.on('close', () => { sockets.delete(ws); if (room.controllers.get(sessionToken) === ws) { const next = [...sockets].at(-1); if (next) room.controllers.set(sessionToken, next); else room.controllers.delete(sessionToken); } if (!sockets.size) { room.sockets.delete(sessionToken); reconnect(room, sessionToken, false); } });
  });
});
server.listen(port, '0.0.0.0', () => console.log(`OpenTaverns server listening on http://localhost:${port}`));
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (!alive.has(ws)) { ws.terminate(); continue; }
    alive.delete(ws); ws.ping();
  }
}, 30000);
const alive = new WeakSet<WebSocket>();
server.on('close', () => clearInterval(heartbeat));
function shutdown() { for (const ws of wss.clients) ws.terminate(); server.close(); server.closeAllConnections(); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
