import { createHmac } from 'node:crypto';
import { costs, emptyInventory, exchangeRatio, materials, type Inventory, type Material } from './client.js';
export { costs, emptyInventory, exchangeRatio, materials } from './client.js';
export type { Inventory, Material } from './client.js';

export type Terrain = 'Woodlands' | 'Highlands' | 'Farmland' | 'Meadows' | 'Ironlands' | 'Badlands';
export type Chronicle = 'Scout' | 'Legacy' | 'Survey' | 'Harvest' | 'Levy';
export type Phase = 'SETUP_FORWARD' | 'SETUP_REVERSE' | 'PRODUCTION_REQUIRED' | 'DISCARD_REQUIRED' | 'ROVER_MOVE_REQUIRED' | 'ROVER_TARGET_REQUIRED' | 'MAIN_ACTION' | 'WAYFARE' | 'GAME_OVER';
export type Player = { id: string; name: string; color: string; sigil: string; inventory: Inventory; cards: { id: number; kind: Chronicle; boughtTurn: number }[]; playedScouts: number; trailsLeft: number; lodgesLeft: number; hallsLeft: number; connected: boolean };
export type Region = { id: number; q: number; r: number; x: number; y: number; terrain: Terrain; value: number | null; sites: number[] };
export type Site = { id: number; x: number; y: number; regions: number[]; links: number[]; owner?: string; structure?: 'Lodge' | 'Hall' };
export type Link = { id: number; a: number; b: number; owner?: string };
export type Exchange = { site: number; material?: Material };
export type Offer = { id: number; from: string; to: string; offered: Inventory; requested: Inventory };
export type PublicEvent = { number: number; text: string };
export type RandomState = [number, number, number, number];
export type Game = { seed: number; rng: RandomState; initialRng: RandomState; rngCounter: number; eventNumber: number; actionHistory: { actor: string; action: Action }[]; players: Player[]; regions: Region[]; sites: Site[]; links: Link[]; exchanges: Exchange[]; rover: number; supply: Inventory; deck: Chronicle[]; nextCardId: number; phase: Phase; active: string; setupOrder: string[]; setupIndex: number; setupSite: number | null; turn: number; lastProduction: number | null; discards: string[]; roverTargets: string[]; offer: Offer | null; routeOwner: string | null; vanguardOwner: string | null; winner: string | null; events: PublicEvent[]; wayfareIndex: number; wayfareUsed: boolean; playedCard: boolean };
export type Action =
  | { type: 'SETUP_LODGE'; site: number }
  | { type: 'SETUP_TRAIL'; link: number }
  | { type: 'ROLL' }
  | { type: 'DISCARD'; materials: Inventory }
  | { type: 'MOVE_ROVER'; region: number }
  | { type: 'TARGET_ROVER'; player: string | null }
  | { type: 'BUILD_TRAIL'; link: number }
  | { type: 'BUILD_LODGE'; site: number }
  | { type: 'UPGRADE_HALL'; site: number }
  | { type: 'BUY_CHRONICLE' }
  | { type: 'PLAY_CHRONICLE'; card: number; material?: Material; region?: number; links?: number[] }
  | { type: 'OFFER'; to: string; offered: Inventory; requested: Inventory }
  | { type: 'ACCEPT_OFFER'; offer: number }
  | { type: 'REJECT_OFFER'; offer: number }
  | { type: 'CANCEL_OFFER'; offer: number }
  | { type: 'SUPPLY_EXCHANGE'; give: Material; receive: Material }
  | { type: 'END_TURN' }
  | { type: 'END_WAYFARE' };

export const total = (inventory: Inventory) => materials.reduce((n, m) => n + inventory[m], 0);
export const canPay = (have: Inventory, cost: Inventory) => materials.every(m => have[m] >= cost[m]);
const terrainMaterial: Partial<Record<Terrain, Material>> = { Woodlands: 'Timber', Highlands: 'Stone', Farmland: 'Provisions', Meadows: 'Textiles', Ironlands: 'Metal' };
export const materialFor = (terrain: Terrain) => terrainMaterial[terrain];
export const playerColors = ['#be593e', '#437b73', '#b68a38', '#636c9a', '#915d7a', '#638344'];
export const playerSigils = ['◆', '✦', '●', '✚', '▲', '■'];

function seedState(seed: number): RandomState {
  let x = seed >>> 0;
  return Array.from({ length: 4 }, () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0)) as RandomState;
}
function randomBelow(game: Game, count: number): number {
  const key = Buffer.allocUnsafe(16);
  game.rng.forEach((part, i) => key.writeUInt32BE(part, i * 4));
  const limit = Math.floor(4294967296 / count) * count;
  let value: number;
  do value = createHmac('sha256', key).update(String(game.rngCounter++)).digest().readUInt32BE(0);
  while (value >= limit);
  return value % count;
}
function shuffle<T>(game: Game, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomBelow(game, i + 1);
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}
const pointKey = (x: number, y: number) => `${Math.round(x * 1e5)},${Math.round(y * 1e5)}`;

export function createGame(names: { id: string; name: string }[], seed: number, privateRandom?: RandomState): Game {
  if (names.length < 3 || names.length > 6) throw Error('Hearthlands needs 3–6 players.');
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff || (privateRandom && privateRandom.every(n => n === 0))) throw Error('Invalid world or private random seed.');
  const players = names.map((p, i): Player => ({ ...p, color: playerColors[i]!, sigil: playerSigils[i]!, inventory: emptyInventory(), cards: [], playedScouts: 0, trailsLeft: 18, lodgesLeft: 6, hallsLeft: 4, connected: true }));
  const game: Game = { seed, rng: seedState(seed), initialRng: seedState(seed), rngCounter: 0, eventNumber: 0, actionHistory: [], players, regions: [], sites: [], links: [], exchanges: [], rover: 0, supply: Object.fromEntries(materials.map(m => [m, names.length > 4 ? 36 : 24])) as Inventory, deck: [], nextCardId: 1, phase: 'SETUP_FORWARD', active: players[0]!.id, setupOrder: [...players.map(p => p.id), ...players.map(p => p.id).reverse()], setupIndex: 0, setupSite: null, turn: 0, lastProduction: null, discards: [], roverTargets: [], offer: null, routeOwner: null, vanguardOwner: null, winner: null, events: [], wayfareIndex: 0, wayfareUsed: false, playedCard: false };
  const terrains: Terrain[] = ['Badlands', ...Array(4).fill('Woodlands'), ...Array(4).fill('Farmland'), ...Array(4).fill('Meadows'), ...Array(3).fill('Highlands'), ...Array(3).fill('Ironlands')];
  const values = [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9];
  shuffle(game, terrains); shuffle(game, values);
  const siteIds = new Map<string, number>();
  const linkIds = new Map<string, number>();
  let valueIndex = 0;
  for (let r = -2; r <= 2; r++) for (let q = -2; q <= 2; q++) {
    if (Math.abs(q + r) > 2) continue;
    const x = Math.sqrt(3) * (q + r / 2), y = 1.5 * r;
    const terrain = terrains[game.regions.length]!;
    const region: Region = { id: game.regions.length, q, r, x, y, terrain, value: terrain === 'Badlands' ? null : values[valueIndex++]!, sites: [] };
    for (let corner = 0; corner < 6; corner++) {
      const angle = Math.PI * (corner * 60 - 30) / 180;
      const sx = x + Math.cos(angle), sy = y + Math.sin(angle);
      const key = pointKey(sx, sy);
      let site = siteIds.get(key);
      if (site === undefined) { site = game.sites.length; siteIds.set(key, site); game.sites.push({ id: site, x: sx, y: sy, regions: [], links: [] }); }
      region.sites.push(site);
      game.sites[site]!.regions.push(region.id);
    }
    game.regions.push(region);
    for (let corner = 0; corner < 6; corner++) {
      const a = region.sites[corner]!, b = region.sites[(corner + 1) % 6]!;
      const key = [a, b].sort((u, v) => u - v).join(':');
      if (!linkIds.has(key)) { const id = game.links.length; linkIds.set(key, id); game.links.push({ id, a, b }); game.sites[a]!.links.push(id); game.sites[b]!.links.push(id); }
    }
  }
  const perimeter = game.sites.filter(s => s.regions.length === 1).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  const exchangeTypes: (Material | undefined)[] = [undefined, ...materials, undefined, undefined, undefined];
  shuffle(game, exchangeTypes);
  game.exchanges = exchangeTypes.map((material, i) => ({ site: perimeter[Math.floor((i + 0.5) * perimeter.length / exchangeTypes.length)]!.id, material }));
  game.rover = game.regions.find(r => r.terrain === 'Badlands')!.id;
  if (privateRandom) { game.rng = [...privateRandom]; game.rngCounter = 0; }
  game.initialRng = [...game.rng];
  game.deck = shuffle(game, [...Array(12).fill('Scout'), ...Array(5).fill('Legacy'), ...Array(3).fill('Survey'), ...Array(3).fill('Harvest'), ...Array(3).fill('Levy')] as Chronicle[]);
  event(game, 'A new Hearthlands table opened.');
  return game;
}

function event(game: Game, text: string) { game.events.push({ number: ++game.eventNumber, text }); if (game.events.length > 120) game.events.shift(); }
const player = (game: Game, id: string) => { const p = game.players.find(p => p.id === id); if (!p) throw Error('You are not seated at this table.'); return p; };
const site = (game: Pick<Game, 'sites'>, id: number) => { const s = game.sites[id]; if (!s || s.id !== id) throw Error('That Site does not exist.'); return s; };
const link = (game: Pick<Game, 'links'>, id: number) => { const l = game.links[id]; if (!l || l.id !== id) throw Error('That Link does not exist.'); return l; };
const region = (game: Game, id: number) => { const r = game.regions[id]; if (!r || r.id !== id) throw Error('That Region does not exist.'); return r; };
const neighbor = (l: Link, id: number) => l.a === id ? l.b : l.a;
const adjacent = (game: Pick<Game, 'sites' | 'links'>, s: Site) => s.links.map(id => site(game, neighbor(link(game, id), s.id)));
const spend = (game: Game, p: Player, cost: Inventory) => { if (!canPay(p.inventory, cost)) throw Error('You do not have the Materials for that action.'); for (const m of materials) { p.inventory[m] -= cost[m]; game.supply[m] += cost[m]; } };
const grant = (game: Game, p: Player, m: Material, quantity: number) => { const amount = Math.min(quantity, game.supply[m]); game.supply[m] -= amount; p.inventory[m] += amount; return amount; };
const isActive = (game: Game, id: string) => { if (game.active !== id) throw Error('Wait for your turn.'); };
const phase = (game: Game, ...allowed: Phase[]) => { if (!allowed.includes(game.phase)) throw Error('That action is unavailable in the current phase.'); };
const noOffer = (game: Game) => { if (game.offer) throw Error('Resolve the open exchange first.'); };
const atSite = (l: Link, id: number) => l.a === id || l.b === id;

export function canBuildLodge(game: Pick<Game, 'sites' | 'links'>, id: string, siteId: number, setup = false): boolean {
  const s = game.sites[siteId]; if (!s || s.owner || s.structure || adjacent(game, s).some(n => n.owner)) return false;
  if (setup) return true;
  return s.links.some(i => game.links[i]!.owner === id);
}
export function canBuildTrail(game: Pick<Game, 'sites' | 'links'>, id: string, linkId: number, setupSite?: number): boolean {
  const l = game.links[linkId]; if (!l || l.owner) return false;
  if (setupSite !== undefined) return atSite(l, setupSite);
  return [l.a, l.b].some(sid => { const s = game.sites[sid]!; return s.owner === id || (!s.owner && s.links.some(i => game.links[i]!.owner === id)); });
}
export function longestRoute(game: Game, id: string): number {
  const owned = game.links.filter(l => l.owner === id);
  let best = 0;
  function walk(sid: number, used: Set<number>, length: number) {
    best = Math.max(best, length);
    if (length && game.sites[sid]!.owner && game.sites[sid]!.owner !== id) return;
    for (const l of owned) if (!used.has(l.id) && atSite(l, sid)) { used.add(l.id); walk(neighbor(l, sid), used, length + 1); used.delete(l.id); }
  }
  for (const l of owned) { walk(l.a, new Set(), 0); walk(l.b, new Set(), 0); }
  return best;
}
function achievementOwner(game: Game, previous: string | null, scores: (id: string) => number, minimum: number): string | null {
  const ranked = game.players.map(p => ({ id: p.id, score: scores(p.id) })).sort((a, b) => b.score - a.score);
  if (!ranked[0] || ranked[0].score < minimum) return null;
  if (ranked[1]?.score === ranked[0].score) return previous && scores(previous) === ranked[0].score ? previous : null;
  return ranked[0].id;
}
export const publicRenown = (game: Game, id: string) => game.sites.reduce((n, s) => n + (s.owner === id ? s.structure === 'Hall' ? 2 : 1 : 0), 0) + (game.routeOwner === id ? 2 : 0) + (game.vanguardOwner === id ? 2 : 0);
export const renown = (game: Game, id: string) => publicRenown(game, id) + player(game, id).cards.filter(c => c.kind === 'Legacy').length;
function updateAchievements(game: Game) {
  const oldRoute = game.routeOwner, oldVanguard = game.vanguardOwner;
  game.routeOwner = achievementOwner(game, oldRoute, id => longestRoute(game, id), 5);
  game.vanguardOwner = achievementOwner(game, oldVanguard, id => player(game, id).playedScouts, 3);
  if (oldRoute !== game.routeOwner && game.routeOwner) event(game, `${player(game, game.routeOwner).name} claimed the Great Route.`);
  if (oldVanguard !== game.vanguardOwner && game.vanguardOwner) event(game, `${player(game, game.vanguardOwner).name} claimed the Vanguard.`);
  if (game.phase !== 'GAME_OVER' && renown(game, game.active) >= 9) { game.winner = game.active; game.phase = 'GAME_OVER'; game.offer = null; event(game, `${player(game, game.active).name} won with ${renown(game, game.active)} Renown.`); }
}

function buildTrail(game: Game, p: Player, id: number, free = false) {
  const l = link(game, id);
  if (!p.trailsLeft) throw Error('You have no Trails left.');
  if (!canBuildTrail(game, p.id, id)) throw Error('This Link must connect to your network without passing through a rival Site.');
  if (!free) spend(game, p, costs.Trail);
  l.owner = p.id; p.trailsLeft--; event(game, `${p.name} laid a Trail.`);
}
function buildLodge(game: Game, p: Player, id: number) {
  const s = site(game, id);
  if (!p.lodgesLeft) throw Error('You have no Lodges left.');
  if (!canBuildLodge(game, p.id, id)) throw Error('A Lodge needs your Trail and space from other occupied Sites.');
  spend(game, p, costs.Lodge); s.owner = p.id; s.structure = 'Lodge'; p.lodgesLeft--; event(game, `${p.name} raised a Lodge.`);
}
function moveRover(game: Game, id: number) {
  region(game, id); if (id === game.rover) throw Error('Move the Rover to a different Region.');
  game.rover = id;
  game.roverTargets = game.players.filter(p => p.id !== game.active && game.regions[id]!.sites.some(s => game.sites[s]!.owner === p.id) && total(p.inventory) > 0).map(p => p.id);
  game.phase = game.roverTargets.length ? 'ROVER_TARGET_REQUIRED' : 'MAIN_ACTION';
  event(game, `${player(game, game.active).name} moved the Rover.`);
}
function advance(game: Game) {
  const index = game.players.findIndex(p => p.id === game.active);
  if (index === game.players.length - 1 && game.players.length >= 5 && !game.wayfareUsed) {
    game.phase = 'WAYFARE'; game.wayfareIndex = 0; game.active = game.players[0]!.id; game.wayfareUsed = true;
    event(game, 'Wayfare begins: each player may construct once or pass.'); updateAchievements(game); return;
  }
  game.active = game.players[(index + 1) % game.players.length]!.id;
  if (index === game.players.length - 1) game.wayfareUsed = false;
  game.phase = 'PRODUCTION_REQUIRED'; game.turn++; game.lastProduction = null; game.playedCard = false;
  event(game, `${player(game, game.active).name}'s turn began.`);
  updateAchievements(game);
}

export function applyAction(game: Game, actor: string, action: Action): Game {
  // Clone before every mutation: an invalid action cannot partially alter authoritative state.
  const next: Game = structuredClone(game);
  if (next.phase === 'GAME_OVER') throw Error('The match has ended.');
  const p = player(next, actor);
  if (action.type === 'SETUP_LODGE') {
    phase(next, 'SETUP_FORWARD', 'SETUP_REVERSE'); isActive(next, actor);
    if (next.setupSite !== null) throw Error('Place your connected Trail next.');
    if (!p.lodgesLeft || !canBuildLodge(next, actor, action.site, true)) throw Error('Choose an open Site with no neighboring Lodge.');
    const s = site(next, action.site); s.owner = actor; s.structure = 'Lodge'; p.lodgesLeft--; next.setupSite = s.id; event(next, `${p.name} placed a Lodge.`);
  } else if (action.type === 'SETUP_TRAIL') {
    phase(next, 'SETUP_FORWARD', 'SETUP_REVERSE'); isActive(next, actor);
    if (next.setupSite === null) throw Error('Place your Lodge first.');
    if (!p.trailsLeft || !canBuildTrail(next, actor, action.link, next.setupSite)) throw Error('Choose an open Link connected to your new Lodge.');
    const l = link(next, action.link); l.owner = actor; p.trailsLeft--; event(next, `${p.name} placed a Trail.`);
    if (next.setupIndex >= next.players.length) {
      for (const rid of site(next, next.setupSite).regions) { const m = materialFor(region(next, rid).terrain); if (m) grant(next, p, m, 1); }
    }
    next.setupSite = null; next.setupIndex++;
    if (next.setupIndex === next.players.length) next.phase = 'SETUP_REVERSE';
    if (next.setupIndex === next.setupOrder.length) { next.phase = 'PRODUCTION_REQUIRED'; next.active = next.players[0]!.id; next.turn = 1; event(next, 'The journey begins.'); }
    else next.active = next.setupOrder[next.setupIndex]!;
    updateAchievements(next);
  } else if (action.type === 'ROLL') {
    phase(next, 'PRODUCTION_REQUIRED'); isActive(next, actor);
    const value = randomBelow(next, 10) + 1; next.lastProduction = value;
    event(next, `${p.name} drew production ${value === 10 ? '— Rover!' : value + '.'}`);
    if (value === 10) {
      next.discards = next.players.filter(q => total(q.inventory) > 8).map(q => q.id);
      next.phase = next.discards.length ? 'DISCARD_REQUIRED' : 'ROVER_MOVE_REQUIRED';
    } else {
      for (const r of next.regions) if (r.value === value && r.id !== next.rover) {
        const m = materialFor(r.terrain); if (!m) continue;
        for (const sid of r.sites) { const s = next.sites[sid]!; if (s.owner) grant(next, player(next, s.owner), m, s.structure === 'Hall' ? 2 : 1); }
      }
      next.phase = 'MAIN_ACTION';
    }
  } else if (action.type === 'DISCARD') {
    phase(next, 'DISCARD_REQUIRED');
    if (!next.discards.includes(actor)) throw Error('You do not need to discard.');
    const count = Math.floor(total(p.inventory) / 2);
    if (!validInventory(action.materials) || total(action.materials) !== count || !canPay(p.inventory, action.materials)) throw Error(`Discard exactly ${count} Materials you hold.`);
    spend(next, p, action.materials); next.discards = next.discards.filter(id => id !== actor); event(next, `${p.name} discarded ${count} Materials.`);
    if (!next.discards.length) next.phase = 'ROVER_MOVE_REQUIRED';
  } else if (action.type === 'MOVE_ROVER') {
    phase(next, 'ROVER_MOVE_REQUIRED'); isActive(next, actor); moveRover(next, action.region);
  } else if (action.type === 'TARGET_ROVER') {
    phase(next, 'ROVER_TARGET_REQUIRED'); isActive(next, actor);
    if (action.player !== null && !next.roverTargets.includes(action.player)) throw Error('That player is not beside the Rover.');
    if (action.player) { const victim = player(next, action.player); const pool = materials.flatMap(m => Array(victim.inventory[m]).fill(m) as Material[]); const stolen = pool[randomBelow(next, pool.length)]!; victim.inventory[stolen]--; p.inventory[stolen]++; event(next, `${p.name} took a hidden Material from ${victim.name}.`); }
    next.phase = 'MAIN_ACTION'; next.roverTargets = [];
  } else if (action.type === 'ACCEPT_OFFER' || action.type === 'REJECT_OFFER' || action.type === 'CANCEL_OFFER') {
    phase(next, 'MAIN_ACTION'); const offer = next.offer;
    if (!offer || offer.id !== action.offer) throw Error('That exchange is no longer open.');
    if (action.type === 'CANCEL_OFFER') { if (offer.from !== actor) throw Error('Only the proposer can cancel.'); next.offer = null; event(next, `${p.name} withdrew an exchange.`); }
    else { if (offer.to !== actor) throw Error('This exchange is not addressed to you.');
      if (action.type === 'ACCEPT_OFFER') {
        const proposer = player(next, offer.from);
        if (!canPay(proposer.inventory, offer.offered) || !canPay(p.inventory, offer.requested)) throw Error('One player no longer has the required Materials.');
        for (const m of materials) { proposer.inventory[m] += offer.requested[m] - offer.offered[m]; p.inventory[m] += offer.offered[m] - offer.requested[m]; }
        event(next, `${p.name} accepted ${proposer.name}'s exchange.`);
      } else event(next, `${p.name} declined an exchange.`);
      next.offer = null;
    }
  } else {
    phase(next, 'MAIN_ACTION', 'WAYFARE'); isActive(next, actor);
    if (action.type === 'BUILD_TRAIL') { noOffer(next); buildTrail(next, p, action.link); updateAchievements(next); if (next.phase === 'WAYFARE') finishWayfare(next); }
    else if (action.type === 'BUILD_LODGE') { noOffer(next); buildLodge(next, p, action.site); updateAchievements(next); if (next.phase === 'WAYFARE') finishWayfare(next); }
    else if (action.type === 'UPGRADE_HALL') { noOffer(next); const s = site(next, action.site); if (s.owner !== actor || s.structure !== 'Lodge' || !p.hallsLeft) throw Error('Upgrade one of your Lodges with an available Hall.'); spend(next, p, costs.Hall); s.structure = 'Hall'; p.hallsLeft--; p.lodgesLeft++; event(next, `${p.name} raised a Hall.`); updateAchievements(next); if (next.phase === 'WAYFARE') finishWayfare(next); }
    else if (action.type === 'END_WAYFARE') { phase(next, 'WAYFARE'); finishWayfare(next); }
    else { phase(next, 'MAIN_ACTION');
      if (action.type === 'SUPPLY_EXCHANGE') { noOffer(next); if (action.give === action.receive || !materials.includes(action.give) || !materials.includes(action.receive)) throw Error('Choose two different Materials.'); const ratio = exchangeRatio(next, actor, action.give); if (p.inventory[action.give] < ratio || !next.supply[action.receive]) throw Error('That supply exchange is unavailable.'); p.inventory[action.give] -= ratio; next.supply[action.give] += ratio; grant(next, p, action.receive, 1); event(next, `${p.name} exchanged ${ratio} ${action.give} for 1 ${action.receive}.`); }
      else if (action.type === 'OFFER') { noOffer(next); if (action.to === actor || !next.players.some(q => q.id === action.to) || !validInventory(action.offered) || !validInventory(action.requested) || !total(action.offered) || !total(action.requested) || !canPay(p.inventory, action.offered)) throw Error('Choose a player and Materials you can offer and request.'); next.offer = { id: next.eventNumber + 1, from: actor, to: action.to, offered: action.offered, requested: action.requested }; event(next, `${p.name} proposed an exchange to ${player(next, action.to).name}.`); }
      else if (action.type === 'BUY_CHRONICLE') { noOffer(next); if (!next.deck.length) throw Error('The Chronicle deck is empty.'); spend(next, p, costs.Chronicle); const kind = next.deck.pop()!; p.cards.push({ id: next.nextCardId++, kind, boughtTurn: next.turn }); event(next, `${p.name} drew a Chronicle Card.`); updateAchievements(next); }
      else if (action.type === 'PLAY_CHRONICLE') { noOffer(next); if (next.playedCard) throw Error('Only one Chronicle Card may be played each turn.'); const card = p.cards.find(c => c.id === action.card); if (!card || card.boughtTurn >= next.turn || card.kind === 'Legacy') throw Error('That Chronicle Card cannot be played now.');
        if (card.kind === 'Scout') { if (action.region === undefined) throw Error('Choose a Region for the Scout.'); moveRover(next, action.region); p.playedScouts++; }
        else if (card.kind === 'Survey') {
          const links = action.links;
          if (!links || links.length < 1 || links.length > 2 || (links.length === 2 && ![link(next, links[0]!).a, link(next, links[0]!).b].some(siteId => atSite(link(next, links[1]!), siteId)))) throw Error('Survey lays one or two connected Trails.');
          for (const id of links) buildTrail(next, p, id, true);
        }
        else if (card.kind === 'Harvest') { if (!action.material || !materials.includes(action.material)) throw Error('Choose a Material.'); for (let i = 0; i < 2; i++) grant(next, p, action.material, 1); }
        else if (card.kind === 'Levy') { if (!action.material || !materials.includes(action.material)) throw Error('Choose a Material.'); for (const other of next.players) if (other.id !== actor) { const count = other.inventory[action.material]; other.inventory[action.material] = 0; p.inventory[action.material] += count; } }
        p.cards = p.cards.filter(c => c.id !== card.id); next.playedCard = true; event(next, `${p.name} played ${card.kind}.`); updateAchievements(next);
      } else if (action.type === 'END_TURN') { noOffer(next); advance(next); }
      else throw Error('Unknown action.');
    }
  }
  validateGame(next);
  next.actionHistory.push({ actor, action });
  return next;
}
function finishWayfare(game: Game) {
  game.wayfareIndex++;
  if (game.wayfareIndex < game.players.length) game.active = game.players[game.wayfareIndex]!.id;
  else { game.active = game.players[0]!.id; game.phase = 'PRODUCTION_REQUIRED'; game.turn++; game.lastProduction = null; game.playedCard = false; game.wayfareUsed = false; event(game, `${player(game, game.active).name}'s turn began.`); }
  updateAchievements(game);
}
export function validInventory(value: unknown): value is Inventory {
  return !!value && typeof value === 'object' && materials.every(m => Number.isSafeInteger((value as Inventory)[m]) && (value as Inventory)[m] >= 0) && Object.keys(value).length === materials.length;
}
export function validateGame(game: Game): void {
  if (game.regions.length !== 19 || game.sites.length !== 54 || game.links.length !== 72) throw Error('Invalid world topology.');
  if (![game.rng, game.initialRng].every(state => Array.isArray(state) && state.length === 4 && state.some(n => n !== 0) && state.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff))) throw Error('Invalid random state.');
  if (!Number.isSafeInteger(game.rngCounter) || game.rngCounter < 0) throw Error('Invalid random counter.');
  if (!['SETUP_FORWARD','SETUP_REVERSE','PRODUCTION_REQUIRED','DISCARD_REQUIRED','ROVER_MOVE_REQUIRED','ROVER_TARGET_REQUIRED','MAIN_ACTION','WAYFARE','GAME_OVER'].includes(game.phase)) throw Error('Invalid phase.');
  if (new Set(game.players.map(p => p.id)).size !== game.players.length) throw Error('Duplicate player.');
  if (!game.players.some(p => p.id === game.active) || !game.regions[game.rover]) throw Error('Invalid active player or Rover.');
  if (!validInventory(game.supply) || game.players.some(p => !validInventory(p.inventory) || [p.trailsLeft, p.lodgesLeft, p.hallsLeft].some(n => n < 0))) throw Error('Invalid Material or piece count.');
  const initialSupply = game.players.length > 4 ? 36 : 24;
  if (materials.some(m => game.supply[m] + game.players.reduce((n, p) => n + p.inventory[m], 0) !== initialSupply)) throw Error('Material supply is not conserved.');
  if (game.sites.some(s => s.owner && !game.players.some(p => p.id === s.owner)) || game.links.some(l => l.owner && !game.players.some(p => p.id === l.owner))) throw Error('Unknown structure owner.');
  for (const p of game.players) if (game.links.filter(l => l.owner === p.id).length + p.trailsLeft !== 18 || game.sites.filter(s => s.owner === p.id && s.structure === 'Lodge').length + p.lodgesLeft !== 6 || game.sites.filter(s => s.owner === p.id && s.structure === 'Hall').length + p.hallsLeft !== 4) throw Error('Piece count mismatch.');
  const ids = game.players.flatMap(p => p.cards.map(c => c.id)); if (new Set(ids).size !== ids.length) throw Error('Duplicate Chronicle Card.');
}

export function project(game: Game, viewer?: string) {
  const own = game.players.find(p => p.id === viewer);
  return {
    seed: game.phase === 'GAME_OVER' ? game.seed : null, eventNumber: game.eventNumber, regions: game.regions, sites: game.sites, links: game.links, exchanges: game.exchanges, rover: game.rover,
    players: game.players.map(p => ({ id: p.id, name: p.name, color: p.color, sigil: p.sigil, materialCount: total(p.inventory), chronicleCount: p.cards.length, playedScouts: p.playedScouts, trailsLeft: p.trailsLeft, lodgesLeft: p.lodgesLeft, hallsLeft: p.hallsLeft, connected: p.connected, publicRenown: publicRenown(game, p.id), finalRenown: game.phase === 'GAME_OVER' ? renown(game, p.id) : undefined, revealedCards: game.phase === 'GAME_OVER' ? p.cards.map(c => c.kind) : undefined })),
    phase: game.phase, active: game.active, setupSite: game.setupSite, setupIndex: game.setupIndex, turn: game.turn, lastProduction: game.lastProduction, discards: game.discards, roverTargets: game.roverTargets, offer: game.offer, supply: game.supply, deckCount: game.deck.length, playedCard: game.playedCard, routeOwner: game.routeOwner, vanguardOwner: game.vanguardOwner, winner: game.winner, events: game.events,
    private: own ? { inventory: own.inventory, cards: own.cards, renown: renown(game, own.id) } : null,
  };
}
export type View = ReturnType<typeof project>;
export const serializeGame = (game: Game) => JSON.stringify(game);
export function restoreGame(serialized: string): Game { const game = JSON.parse(serialized) as Game; validateGame(game); return game; }
export function replayGame(names: { id: string; name: string }[], seed: number, history: Game['actionHistory'], privateRandom?: RandomState): Game {
  return history.reduce((game, item) => applyAction(game, item.actor, item.action), createGame(names, seed, privateRandom));
}
