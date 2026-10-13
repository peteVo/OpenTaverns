import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import { parse, serialize } from 'cookie';
import { z } from 'zod';
import { applyAction, createGame, project, validateGame, type Action, type Game, type RandomState, type View } from '@opentaverns/hearthlands';
import { TableStore } from './storage';
import { nextBotAction } from '@opentaverns/hearthlands/simulate';
import * as grid from '@opentaverns/saigon-grid';
import { nextBotAction as nextGridBotAction } from '@opentaverns/saigon-grid/simulate';
import { createScenario, scenarioNames } from '@opentaverns/saigon-grid/scenarios';
import * as blackout from '@opentaverns/blackout';
import { nextBotAction as nextBlackoutBotAction } from '@opentaverns/blackout/simulate';
import { createScenario as createBlackoutScenario, scenarioNames as blackoutScenarioNames } from '@opentaverns/blackout/scenarios';
import * as tidecall from '@opentaverns/tidecall';
import { nextBotAction as nextTidecallBotAction } from '@opentaverns/tidecall/simulate';
import { createScenario as createTidecallScenario, scenarioNames as tidecallScenarioNames } from '@opentaverns/tidecall/scenarios';

type Seat = { id: string; name: string; token?: string; connected: boolean; bot: boolean };
type Room = { matchId: string; code: string; inviteUrl: string; gameId: 'hearthlands' | 'saigon-grid' | 'blackout' | 'tidecall'; host: string; seats: Seat[]; spectators: Map<string, string>; game: Game | grid.Game | blackout.Game | tidecall.Game | null; sockets: Map<string, Set<WebSocket>>; controllers: Map<string, WebSocket>; seenActions: Set<string>; created: number; seed: number; debugSeed: boolean; botTurn: string; botActionsThisTurn: number; botsRunning: boolean; deadlineAt: number | null; graceUsed: boolean; pacing: blackout.Pacing; paused: boolean; resumeMs: number | null };
type SavedRoom = Omit<Room, 'sockets' | 'controllers' | 'botsRunning' | 'spectators' | 'seenActions' | 'paused' | 'resumeMs'> & { spectators: [string, string][]; seenActions: string[]; savedAt: number };
const rooms = new Map<string, Room>();
const development = process.argv.includes('--development');
const port = Number(process.argv.find(arg => arg.startsWith('--port='))?.slice(7) || process.env.PORT || 3000);
const store = new TableStore<SavedRoom>(resolve(process.env.OPENTAVERNS_DATA_DIR || fileURLToPath(new URL('../../../data', import.meta.url))), process.env.OPENTAVERNS_ADMIN_KEY);
process.once('exit', () => store.close());
for (const saved of store.load()) {
  if (!['hearthlands','saigon-grid','blackout','tidecall'].includes(saved.gameId) || !saved.seats.some(s => s.id === saved.host) || !Number.isFinite(saved.savedAt)) throw Error(`Invalid saved table ${saved.code}.`);
  if (saved.game) {
    if (saved.gameId === 'tidecall') tidecall.validateGame(saved.game as tidecall.Game);
    else if (saved.gameId === 'blackout') blackout.validateGame(saved.game as blackout.Game);
    else if (saved.gameId === 'saigon-grid') grid.validateGame(saved.game as grid.Game);
    else validateGame(saved.game as Game);
  }
  const seats = saved.seats.map(s => ({ ...s, connected: s.bot }));
  if (saved.game) for (const player of saved.game.players) player.connected = seats.find(s => s.id === player.id)?.bot ?? false;
  rooms.set(saved.code, { ...saved, seats, spectators: new Map(saved.spectators), seenActions: new Set(saved.seenActions), sockets: new Map(), controllers: new Map(), botsRunning: false, paused: !!saved.game, resumeMs: saved.deadlineAt ? Math.max(30000, saved.deadlineAt - saved.savedAt) : null, deadlineAt: null });
}
function persist(room: Room) {
  try { store.save({ matchId: room.matchId, code: room.code, inviteUrl: room.inviteUrl, gameId: room.gameId, host: room.host, seats: room.seats, game: room.game,
    spectators: [...room.spectators], seenActions: [...room.seenActions], created: room.created, seed: room.seed, debugSeed: room.debugSeed,
    botTurn: room.botTurn, botActionsThisTurn: room.botActionsThisTurn, deadlineAt: room.paused && room.resumeMs ? Date.now() + room.resumeMs : room.deadlineAt,
    graceUsed: room.graceUsed, pacing: room.pacing, savedAt: Date.now() }); }
  catch (error) { console.error('Table storage failed; stopping before acknowledging unsaved state.', error); process.exit(1); }
}
function validAdminKey(value: string) { const candidate = Buffer.from(value); const expected = Buffer.from(store.adminKey); return candidate.length === expected.length && timingSafeEqual(candidate, expected); }
function isAdmin(req: IncomingMessage) { return validAdminKey(parse(req.headers.cookie || '').ot_admin || ''); }
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
const blackoutActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CONFIRM_ROLE') }), z.object({ type: z.literal('ACK_INCIDENT') }), z.object({ type: z.literal('START_ASSIGNMENT') }),
  z.object({ type: z.literal('SET_TEAMS'), teams: z.tuple([z.array(z.string()).max(10), z.array(z.string()).max(10)]) }), z.object({ type: z.literal('LOCK_ASSIGNMENT') }),
  z.object({ type: z.literal('LOCK_RESPONSE'), response: z.enum(['STABILIZE','DIAGNOSE','INTERFERE']) }),
  z.object({ type: z.literal('USE_ABILITY'), order: z.union([z.literal(0),z.literal(1)]).optional() }),
  z.object({ type: z.literal('ADVANCE_RESOLUTION') }), z.object({ type: z.literal('CAST_AUDIT_VOTE'), choice: z.string().regex(/^R[1-8][AB]$/).nullable() }),
  z.object({ type: z.literal('END_ROUND') }),
]);
const messageSchema = z.object({ type: z.literal('GAME_ACTION'), id: z.uuid(), expectedRevision: numberSchema.optional(), matchId: z.string().optional(), action: z.unknown() }).strict();
const tidecallActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('LOCK_FORECAST'), round: numberSchema, value: numberSchema }).strict(),
  z.object({ type: z.literal('LOCK_COMPASS'), round: numberSchema, adjustment: z.union([z.literal(-1),z.literal(0),z.literal(1)]) }).strict(),
  z.object({ type: z.literal('PLAY_CARD'), round: numberSchema, trick: numberSchema, card: z.string().regex(/^(WAVE|WIND|REEF|SUN)-(1[0-3]|[1-9])$/) }).strict(),
  z.object({ type: z.literal('ADVANCE'), round: numberSchema, phase: z.enum(['DEALING','TIDE_REVEAL','FORECAST_REVEAL','COMPASS_REVEAL','TRICK_RESOLUTION','ROUND_SCORING']) }).strict(),
]);
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
function roomView(room: Room, sessionToken: string): { matchId: string; code: string; inviteUrl: string; gameId: string; host: string; self: string | null; spectator: boolean; seats: { id: string; name: string; connected: boolean; bot: boolean }[]; game: View | grid.View | blackout.View | tidecall.View | null; deadlineAt: number | null } {
  if (rooms.get(room.code) !== room) throw Error('The host deleted this table.');
  const seat = viewer(room, sessionToken);
  const eliminated = room.gameId === 'saigon-grid' && (room.game as grid.Game | null)?.players.find(p => p.id === seat?.id)?.eliminated;
  return { matchId: room.matchId, code: room.code, inviteUrl: room.inviteUrl, gameId: room.gameId, host: room.host, self: eliminated ? null : seat?.id ?? null, spectator: !seat || !!eliminated, seats: room.seats.map(({ id, name, connected, bot }) => ({ id, name, connected, bot })), game: room.game ? room.gameId === 'tidecall' ? tidecall.project(room.game as tidecall.Game, seat?.id ?? null) : room.gameId === 'saigon-grid' ? grid.project(room.game as grid.Game) : room.gameId === 'blackout' ? blackout.project(room.game as blackout.Game, seat?.id ?? null) : project(room.game as Game, seat?.id) : null, deadlineAt: room.deadlineAt };
}
const phaseSeconds: Record<blackout.Pacing, number[]> = { RELAXED: [240,240,480,240,180,180,120,180], STANDARD: [120,120,240,120,90,90,60,90], FAST: [60,60,90,60,45,45,35,45] };
const timedPhases: blackout.Phase[] = ['ROLE_REVEAL','INCIDENT_REVEAL','BRIEFING','ASSIGNMENT','SECRET_ACTION','RESOLUTION','AUDIT_VOTE','ROUND_END'];
function setDeadline(room: Room) { if (!room.game) return; if (room.gameId === 'tidecall') { const phase = room.game.phase; const decisions = room.pacing === 'RELAXED' ? [180,120,90] : room.pacing === 'STANDARD' ? [90,60,45] : [45,30,20]; const seconds = phase === 'MATCH_OVER' ? null : phase === 'FORECAST_REQUIRED' ? decisions[0]! : phase === 'COMPASS_REQUIRED' ? decisions[1]! : phase === 'TRICK_PLAY' ? decisions[2]! : phase === 'ROUND_SCORING' ? 25 : 2; room.deadlineAt = seconds === null ? null : Date.now()+seconds*1000; room.graceUsed = false; return; } if (room.gameId !== 'blackout') return; const index = timedPhases.indexOf(room.game.phase as blackout.Phase); room.deadlineAt = index < 0 ? null : Date.now() + phaseSeconds[room.pacing][index]! * 1000; room.graceUsed = false; }
function broadcast(room: Room) {
  if (rooms.get(room.code) !== room) return;
  persist(room);
  for (const [sessionToken, sockets] of room.sockets) {
    const message = JSON.stringify({ type: 'STATE', state: roomView(room, sessionToken) });
    for (const ws of sockets) if (ws.readyState === WebSocket.OPEN) ws.send(message);
  }
}
function reconnect(room: Room, sessionToken: string, connected: boolean) {
  if (rooms.get(room.code) !== room) return;
  const seat = viewer(room, sessionToken); if (!seat) return;
  if (connected && room.paused) { room.paused = false; if (room.resumeMs) room.deadlineAt = Date.now() + room.resumeMs; room.resumeMs = null; }
  seat.connected = connected;
  if (!connected && (room.gameId === 'blackout' || room.gameId === 'tidecall') && room.deadlineAt && !room.graceUsed) { room.deadlineAt += 30000; room.graceUsed = true; }
  if (room.game) { const p = room.game.players.find(p => p.id === seat.id); if (p) p.connected = connected; }
  if (connected && !room.seats.find(s => s.id === room.host)?.connected) room.host = seat.id;
  if (!connected && room.host === seat.id) { const next = room.seats.find(s => !s.bot && s.connected && s.id !== seat.id); if (next) room.host = next.id; }
  broadcast(room);
}
async function runBotTurns(room: Room) {
  if (room.botsRunning || room.paused || rooms.get(room.code) !== room) return;
  room.botsRunning = true;
  let actor = '';
  let actions = 0;
  try {
    while (rooms.get(room.code) === room && !room.paused && room.game && room.game.phase !== 'GAME_OVER' && actions < 100) {
      actions++;
      if (room.gameId === 'tidecall') {
        const game = room.game as tidecall.Game;
        if (!['FORECAST_REQUIRED','COMPASS_REQUIRED','TRICK_PLAY'].includes(game.phase)) return;
        const choice = room.seats.filter(s => s.bot).map(s => ({ actor: s.id, action: nextTidecallBotAction(tidecall.project(game,s.id),s.id) })).find(c => c.action);
        if (!choice?.action) return;
        actor = choice.actor; room.game = tidecall.applyAction(game,actor,choice.action);
        if (room.game.phase !== game.phase || (room.game as tidecall.Game).trick.current !== game.trick.current) setDeadline(room);
        broadcast(room); await new Promise(resolve => setTimeout(resolve, 220)); continue;
      }
      if (room.gameId === 'blackout') {
        const game = room.game as blackout.Game;
        const choice = room.seats.filter(seat => seat.bot).map(seat => ({ actor: seat.id, action: nextBlackoutBotAction(blackout.project(game, seat.id), seat.id) })).find(item => item.action);
        if (!choice?.action) return;
        actor = choice.actor;
        room.game = blackout.applyAction(game, actor, choice.action);
        if (room.game.phase !== game.phase) setDeadline(room);
        broadcast(room);
        await new Promise(resolve => setTimeout(resolve, 20));
        continue;
      }
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
    if (actions >= 100 && room.game?.phase !== 'GAME_OVER') {
      if (room.gameId === 'blackout') setTimeout(() => void runBotTurns(room), 0);
      else console.error(`Bot action limit reached at table ${room.code}.`);
    }
  } catch (error) { console.error(`Bot ${actor} failed at table ${room.code}:`, error); }
  finally { room.botsRunning = false; }
}
async function api(req: IncomingMessage, res: ServerResponse, url: URL) {
  try {
    if (['POST','DELETE'].includes(req.method || '') && !sameOrigin(req)) { send(res, 403, { error: 'This request came from another site.' }); return; }
    if (url.pathname.startsWith('/api/admin/')) {
      if (url.pathname === '/api/admin/login' && req.method === 'POST') {
        const input = z.object({ key: z.string().max(200) }).strict().parse(await body(req));
        if (!validAdminKey(input.key)) { send(res, 403, { error: 'The host management key is incorrect.' }); return; }
        res.setHeader('set-cookie', serialize('ot_admin', store.adminKey, { httpOnly: true, sameSite: 'strict', path: '/api/admin', secure: req.headers['x-forwarded-proto'] === 'https', maxAge: 60 * 60 * 24 * 30 }));
        send(res, 200, { ok: true }); return;
      }
      if (!isAdmin(req)) { send(res, 403, { error: 'Open the private management link printed by the server, or enter its management key.' }); return; }
      if (url.pathname === '/api/admin/logout' && req.method === 'POST') { res.setHeader('set-cookie', serialize('ot_admin', '', { httpOnly: true, sameSite: 'strict', path: '/api/admin', maxAge: 0 })); send(res, 200, { ok: true }); return; }
      if (url.pathname === '/api/admin/tables' && req.method === 'GET') {
        send(res, 200, { tables: [...rooms.values()].sort((a,b) => b.created-a.created).map(r => ({ code: r.code, gameId: r.gameId, host: r.seats.find(s => s.id === r.host)?.name, seats: r.seats.length, connected: r.seats.filter(s => s.connected && !s.bot).length, bots: r.seats.filter(s => s.bot).length, spectators: r.spectators.size, phase: r.game?.phase || 'LOBBY', created: r.created, paused: r.paused })) }); return;
      }
      const deletion = url.pathname.match(/^\/api\/admin\/tables\/([A-Z0-9]{6})$/i);
      if (deletion && req.method === 'DELETE') {
        const room = roomFor(deletion[1]!); store.delete(room.code); rooms.delete(room.code);
        for (const sockets of room.sockets.values()) for (const ws of sockets) { ws.send(JSON.stringify({ type: 'TABLE_DELETED', code: room.code })); ws.close(1000, 'Table deleted by the server host'); }
        send(res, 200, { ok: true }); return;
      }
      send(res, 404, { error: 'Management request not found.' }); return;
    }
    const sessionToken = session(req, res);
    if (req.method === 'POST' && url.pathname === '/api/tables') {
      const input = z.object({ name: z.string(), gameId: z.enum(['hearthlands', 'saigon-grid', 'blackout', 'tidecall']), seed: z.number().int().min(0).max(0xffffffff).optional(), scenario: z.string().optional(), pacing: z.enum(['RELAXED','STANDARD','FAST']).optional() }).parse(await body(req));
      const name = safeName(input.name); if (!name) throw Error('Enter a display name.');
      if (input.seed !== undefined && !development) throw Error('A custom seed is available only in development.');
      if (input.scenario && (!development || input.gameId === 'hearthlands' || input.gameId === 'saigon-grid' && !scenarioNames.includes(input.scenario as typeof scenarioNames[number]) || input.gameId === 'blackout' && !blackoutScenarioNames.includes(input.scenario as typeof blackoutScenarioNames[number]) || input.gameId === 'tidecall' && !tidecallScenarioNames.includes(input.scenario as typeof tidecallScenarioNames[number]))) throw Error('That scenario is available only for its game in development.');
      let roomCode = code(); while (rooms.has(roomCode)) roomCode = code();
      const seat = { id: id(), name, token: sessionToken, connected: false, bot: false };
      const room: Room = { matchId: id(), code: roomCode, inviteUrl: inviteUrl(req, roomCode), gameId: input.gameId, host: seat.id, seats: [seat], spectators: new Map(), game: null, sockets: new Map(), controllers: new Map(), seenActions: new Set(), created: Date.now(), seed: input.seed ?? randomInt(0, 0x100000000), debugSeed: input.seed !== undefined, botTurn: '', botActionsThisTurn: 0, botsRunning: false, deadlineAt: null, graceUsed: false, pacing: input.pacing ?? 'RELAXED', paused: false, resumeMs: null };
      if (input.scenario) {
        const botCount = input.gameId === 'blackout' ? 4 : input.gameId === 'tidecall' ? input.scenario === 'SIX_PLAYER_TRICK' ? 5 : 3 : 1;
        for (let index = 0; index < botCount; index++) room.seats.push({ id: id(), name: input.gameId === 'tidecall' ? `Navigator ${index+1}` : input.gameId === 'blackout' ? `Relief ${index + 1}` : 'Courier 1', connected: true, bot: true });
        room.game = input.gameId === 'tidecall' ? createTidecallScenario(input.scenario as typeof tidecallScenarioNames[number], room.seats.map(({id,name}) => ({id,name})), room.seed) : input.gameId === 'blackout' ? createBlackoutScenario(input.scenario as typeof blackoutScenarioNames[number], room.seats.map(({ id, name }) => ({ id, name })), room.seed) : createScenario(input.scenario as typeof scenarioNames[number], room.seats.map(({ id, name }) => ({ id, name })), room.seed);
        room.game.players[0]!.connected = false; setDeadline(room);
        if (input.gameId === 'tidecall') room.deadlineAt = null; // Development snapshots stay still until an action.
      }
      rooms.set(roomCode, room); persist(room); send(res, 201, roomView(room, sessionToken)); return;
    }
    const match = url.pathname.match(/^\/api\/tables\/([A-Z0-9]{6})(?:\/(join|start|bots|rematch))?$/i);
    if (!match) { send(res, 404, { error: 'Table not found.' }); return; }
    const room = roomFor(match[1]!);
    if (req.method === 'GET' && !match[2]) { if (!viewer(room, sessionToken) && !room.spectators.has(sessionToken)) throw Error('Join this table first.'); send(res, 200, roomView(room, sessionToken)); return; }
    if (req.method === 'POST' && match[2] === 'join') {
      const input = z.object({ name: z.string(), spectator: z.boolean().optional() }).parse(await body(req));
      const name = safeName(input.name); if (!name) throw Error('Enter a display name.');
      let seat = viewer(room, sessionToken);
      if (!seat && !room.game && !input.spectator && room.seats.length < (room.gameId === 'blackout' ? 10 : 6)) { seat = { id: id(), name, token: sessionToken, connected: false, bot: false }; room.seats.push(seat); }
      else if (!seat) room.spectators.set(sessionToken, name);
      if (seat && room.sockets.get(sessionToken)?.size) reconnect(room, sessionToken, true);
      broadcast(room); send(res, 200, roomView(room, sessionToken)); return;
    }
    if (req.method === 'POST' && match[2] === 'bots') {
      const seat = viewer(room, sessionToken); if (!seat || room.host !== seat.id) throw Error('Only the host can manage bot players.');
      const input = z.object({ replaceSeatId: z.string().optional() }).strict().parse(await body(req));
      if (room.game && (!input.replaceSeatId || room.gameId === 'hearthlands')) throw Error('Only an Away Saigon Grid, Blackout or Tidecall player may become a bot during a match.');
      if (input.replaceSeatId) {
        const index = room.seats.findIndex(s => s.id === input.replaceSeatId);
        const away = room.seats[index];
        if (!away || away.bot || away.connected || away.id === room.host) throw Error('Choose an Away player to replace.');
        if (away.token) { room.sockets.delete(away.token); room.controllers.delete(away.token); }
        room.seats[index] = { id: room.game ? away.id : id(), name: room.game ? away.name : room.gameId === 'blackout' ? `Relief ${room.seats.filter(s => s.bot).length + 1}` : room.gameId === 'saigon-grid' ? `Courier ${room.seats.filter(s => s.bot).length + 1}` : `Wayfarer ${room.seats.filter(s => s.bot).length + 1}`, connected: true, bot: true };
        if (room.game) { const player = room.game.players.find(p => p.id === away.id); if (player) player.connected = true; }
      } else {
        if (room.seats.length >= (room.gameId === 'blackout' ? 10 : 6)) throw Error('The table is full.');
        room.seats.push({ id: id(), name: room.gameId === 'blackout' ? `Relief ${room.seats.filter(s => s.bot).length + 1}` : room.gameId === 'saigon-grid' ? `Courier ${room.seats.filter(s => s.bot).length + 1}` : `Wayfarer ${room.seats.filter(s => s.bot).length + 1}`, connected: true, bot: true });
      }
      broadcast(room); send(res, 200, roomView(room, sessionToken)); if (room.game) void runBotTurns(room); return;
    }
    if (req.method === 'POST' && match[2] === 'start') {
      const seat = viewer(room, sessionToken); if (!seat || room.host !== seat.id) throw Error('Only the host can start.');
      if (room.game) throw Error('This match has already started.');
      if (room.seats.length < (room.gameId === 'blackout' ? 5 : room.gameId === 'saigon-grid' ? 2 : 3) || room.seats.length > (room.gameId === 'blackout' ? 10 : 6)) throw Error(`${room.gameId === 'blackout' ? 'Blackout needs 5–10' : room.gameId === 'saigon-grid' ? 'Saigon Grid needs 2–6' : room.gameId === 'tidecall' ? 'Tidecall needs 3–6' : 'Hearthlands needs 3–6'} players.`);
      if (room.seats.some(s => !s.bot && !s.connected)) throw Error('Wait for every player to connect or replace an Away player with a bot.');
      room.game = room.gameId === 'tidecall' ? tidecall.createGame(room.seats.map(({id,name}) => ({id,name})),room.seed,room.pacing) : room.gameId === 'blackout' ? blackout.createGame(room.seats.map(({ id, name }) => ({ id, name })), room.seed, room.pacing) : room.gameId === 'saigon-grid' ? grid.createGame(room.seats.map(({ id, name }) => ({ id, name })), room.seed) : createGame(room.seats.map(({ id, name }) => ({ id, name })), room.seed, room.debugSeed ? undefined : privateRandom());
      for (const p of room.game.players) p.connected = room.seats.find(s => s.id === p.id)!.connected;
      setDeadline(room);
      broadcast(room); send(res, 200, roomView(room, sessionToken)); void runBotTurns(room); return;
    }
    if (req.method === 'POST' && match[2] === 'rematch') {
      const seat = viewer(room, sessionToken); if (!seat || room.host !== seat.id) throw Error('Only the host can begin a rematch.');
      if (room.gameId !== 'tidecall' || room.game?.phase !== 'MATCH_OVER') throw Error('Finish this Tidecall match first.');
      if (room.seats.some(s => !s.bot && !s.connected)) throw Error('Reconnect every Away player or explicitly replace their seat with a bot.');
      room.seed = room.debugSeed ? room.seed : randomInt(0,0x100000000);
      room.matchId = id();
      room.game = tidecall.createGame(room.seats.map(({id,name}) => ({id,name})),room.seed,room.pacing);
      // Retain action IDs across matches so a retry from the previous match stays a duplicate.
      setDeadline(room); broadcast(room); send(res,200,roomView(room,sessionToken)); return;
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
    const resumeBots = room.paused;
    sockets.add(ws); reconnect(room, sessionToken, true);
    room.controllers.set(sessionToken, ws);
    ws.send(JSON.stringify({ type: 'STATE', state: roomView(room, sessionToken) }));
    if (resumeBots) void runBotTurns(room);
    ws.on('message', data => {
      try {
        const message = messageSchema.parse(JSON.parse(data.toString()));
        if (rooms.get(room.code) !== room) throw Error('The host deleted this table.');
        const seat = viewer(room, sessionToken);
        if (!seat) throw Error('Spectators cannot play.');
        if (!room.game) throw Error('The match has not started.');
        if (room.controllers.get(sessionToken) !== ws) throw Error('A newer tab controls this seat.');
        const actionKey = `${seat.id}:${message.id}`;
        if (room.seenActions.has(actionKey)) { ws.send(JSON.stringify({ type: 'ACTION_ACK', id: message.id })); return; }
        if (room.gameId === 'tidecall') {
          if (message.matchId !== room.matchId) throw Error('That action belongs to a previous match.');
          const action = tidecallActionSchema.parse(message.action) as tidecall.Action;
          const game = room.game as tidecall.Game;
          const independent = ['LOCK_FORECAST','LOCK_COMPASS'].includes(action.type);
          if (!independent && message.expectedRevision !== undefined && message.expectedRevision !== game.revision) throw Error('The table changed. Review the latest state and try again.');
          room.game = tidecall.applyAction(game,seat.id,action);
          if (room.game.phase !== game.phase || (room.game as tidecall.Game).trick.current !== game.trick.current) setDeadline(room);
        } else if (room.gameId === 'blackout') {
          const action = blackoutActionSchema.parse(message.action) as blackout.Action;
          const game = room.game as blackout.Game;
          const independent = ['CONFIRM_ROLE','LOCK_RESPONSE','CAST_AUDIT_VOTE'].includes(action.type);
          if (!independent && message.expectedRevision !== undefined && message.expectedRevision !== game.revision) throw Error('The table changed. Review the latest state and try again.');
          room.game = blackout.applyAction(game, seat.id, action);
          if (room.game.phase !== game.phase) setDeadline(room);
        } else if (room.gameId === 'saigon-grid') {
          const action = gridActionSchema.parse(message.action) as grid.Action;
          if (message.expectedRevision !== undefined && message.expectedRevision !== (room.game as grid.Game).revision) throw Error('The table changed. Review the latest state and try again.');
          room.game = grid.applyAction(room.game as grid.Game, seat.id, action);
        } else room.game = applyAction(room.game as Game, seat.id, actionSchema.parse(message.action) as Action);
        room.seenActions.add(actionKey);
        if (development) console.log(JSON.stringify({ tableId: room.code, gameId: room.gameId, playerId: seat.id, actionId: message.id, gameRevision: room.gameId === 'blackout' ? (room.game as blackout.Game).revision : room.gameId === 'saigon-grid' ? (room.game as grid.Game).revision : undefined, phase: room.game.phase, eventType: 'GAME_ACTION' }));
        broadcast(room);
        void runBotTurns(room);
      } catch (error) { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ACTION_REJECTED', error: error instanceof z.ZodError ? 'That action was malformed.' : error instanceof Error ? error.message : 'Invalid action.' })); }
    });
    ws.on('close', () => { sockets.delete(ws); if (room.controllers.get(sessionToken) === ws) { const next = [...sockets].at(-1); if (next) room.controllers.set(sessionToken, next); else room.controllers.delete(sessionToken); } if (!sockets.size) { room.sockets.delete(sessionToken); reconnect(room, sessionToken, false); } });
  });
});
server.listen(port, '0.0.0.0', () => { console.log(`OpenTaverns server listening on http://localhost:${port}`); console.log(`Host management (private): http://localhost:${port}/manage#key=${encodeURIComponent(store.adminKey)}`); console.log(`Table storage: ${store.directory} (${rooms.size} restored)`); });
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (!alive.has(ws)) { ws.terminate(); continue; }
    alive.delete(ws); ws.ping();
  }
}, 30000);
const blackoutClock = setInterval(() => {
  for (const room of rooms.values()) {
    if (room.paused) continue;
    if (room.gameId === 'tidecall' && room.deadlineAt && Date.now() >= room.deadlineAt && room.game && room.game.phase !== 'MATCH_OVER') {
      try { room.game = tidecall.applyAction(room.game as tidecall.Game,'@system',{type:'TIMEOUT'}); setDeadline(room); broadcast(room); void runBotTurns(room); }
      catch (error) { room.deadlineAt = null; console.error(`Tidecall timeout failed at table ${room.code}:`,error); }
      continue;
    }
    if (room.gameId !== 'blackout' || !room.deadlineAt || Date.now() < room.deadlineAt || !room.game || room.game.phase === 'GAME_OVER') continue;
    try { room.game = blackout.applyAction(room.game as blackout.Game, '@system', { type: 'TIMEOUT' }); setDeadline(room); broadcast(room); void runBotTurns(room); }
    catch (error) { room.deadlineAt = null; console.error(`Blackout timeout failed at table ${room.code}:`, error); }
  }
}, 1000);
const alive = new WeakSet<WebSocket>();
server.on('close', () => { clearInterval(heartbeat); clearInterval(blackoutClock); });
function shutdown() { for (const ws of wss.clients) ws.terminate(); server.close(); server.closeAllConnections(); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
