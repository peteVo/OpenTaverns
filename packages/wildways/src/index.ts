import type { Action, Component, Coord, Direction, Game, Habitat, MarkerMode, Milestone, MilestoneId, Orientation, PlaceAction, PlacedTile, Player, Preview, Score, Tile, View } from './types.js';
export type * from './types.js';
export const habitats: Habitat[] = ['Forest', 'Meadow', 'Highland'];
export const routes = ['Trail', 'Stream'] as const;
export const config = { markers: 8, minimumNetwork: 3, turnsByPlayers: { 2: 18, 3: 15, 4: 13, 5: 12 } as Record<number, number> };
export const milestoneDefinitions: Record<MilestoneId, { points: number; category: MarkerMode; description: string }> = {
  'Great Grove': { points: 8, category: 'habitat', description: 'Uniquely lead a Forest of at least seven tiles.' },
  'Open Range': { points: 8, category: 'habitat', description: 'Uniquely lead a Meadow of at least seven tiles.' },
  'High Pass': { points: 8, category: 'habitat', description: 'Uniquely lead a Highland of at least six tiles with a landmark.' },
  Trailblazer: { points: 8, category: 'route', description: 'Uniquely lead a Trail of at least six tiles.' },
  Watershed: { points: 8, category: 'route', description: 'Uniquely lead a Stream of at least six tiles.' },
  'Two Horizons': { points: 10, category: 'route', description: 'Uniquely lead two habitats of different types, each at least four tiles.' },
};
const need: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw Error(message); };
const steps: Coord[] = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
const key = ({ x, y }: Coord) => `${x},${y}`;
const neighbors = (p: Coord) => steps.map(d => ({ x: p.x + d.x, y: p.y + d.y }));
const limits = (count: number) => { const turns = config.turnsByPlayers[count]; need(turns, 'Wildways needs 2–5 players.'); return turns; };
export const rotateTile = (orientation: Orientation, delta = 1): Orientation => ((orientation + delta % 4 + 4) % 4) as Orientation;
export const portsOf = (tile: Tile, orientation: Orientation): Direction[] => tile.ports.map(p => ((p + orientation) % 4) as Direction).sort();
export function createTileDeck(): Tile[] {
  const shapes: Direction[][] = [[0], [1], [0, 1], [1, 2], [0, 2], [1, 3], [0, 1, 2], [1, 2, 3]];
  const names: Record<Habitat, string[]> = { Forest: ['Ancient Grove', 'Hidden Spring'], Meadow: ['Old Bridge', 'Standing Stones'], Highland: ['Stone Arch', 'Hilltop Observatory'] };
  return habitats.flatMap(habitat => ([null, 'Trail', 'Stream'] as const).flatMap(route => Array.from({ length: 8 }, (_, i) => ({ id: `${habitat.toLowerCase()}-${route?.toLowerCase() ?? 'plain'}-${i + 1}`, habitat, route, ports: route ? [...shapes[i]!] : [], landmark: (!route && i < 2) || (route && i === 4) ? names[habitat][route === 'Stream' ? 1 : 0]! : null }))));
}
export const startingTile = (): PlacedTile => ({ id: 'origin', habitat: 'Meadow', route: null, ports: [], landmark: null, x: 0, y: 0, orientation: 0, marker: null });
const catalog = new Map(createTileDeck().map(tile => [tile.id, tile]));
export function getLegalPlacements(board: PlacedTile[]): Coord[] {
  const occupied = new Set(board.map(key)); const free = new Map<string, Coord>();
  for (const tile of board) for (const p of neighbors(tile)) if (!occupied.has(key(p))) free.set(key(p), p);
  return [...free.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}
export function getNetworkInfluence(tiles: PlacedTile[], layer: MarkerMode) { const influence: Record<string, number> = {}; for (const tile of tiles) if (tile.marker?.mode === layer) influence[tile.marker.owner] = (influence[tile.marker.owner] || 0) + 1; return influence; }
export function resolveNetworkControl(influence: Record<string, number>) { const highest = Math.max(0, ...Object.values(influence)); return highest > 0 ? Object.keys(influence).filter(id => influence[id] === highest).sort() : []; }
function components(board: PlacedTile[], layer: MarkerMode): Component[] {
  const positions = new Map(board.map(tile => [key(tile), tile])); const visited = new Set<string>(); const result: Component[] = [];
  for (const first of board) {
    if (visited.has(first.id) || (layer === 'route' && !first.route)) continue;
    const tiles: PlacedTile[] = [first]; visited.add(first.id);
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i]!;
      for (const direction of [0, 1, 2, 3] as Direction[]) {
        const d = steps[direction]!; const next = positions.get(key({ x: tile.x + d.x, y: tile.y + d.y }));
        if (!next || visited.has(next.id)) continue;
        const connected = layer === 'habitat' ? tile.habitat === next.habitat : tile.route === next.route && !!tile.route && portsOf(tile, tile.orientation).includes(direction) && portsOf(next, next.orientation).includes(((direction + 2) % 4) as Direction);
        if (connected) { visited.add(next.id); tiles.push(next); }
      }
    }
    const ids = tiles.map(tile => tile.id).sort(); const landmarks = tiles.filter(tile => tile.landmark).length;
    const influence = getNetworkInfluence(tiles, layer), leaders = resolveNetworkControl(influence);
    const potential = (layer === 'habitat' ? 2 : 3) * tiles.length + (layer === 'habitat' ? 3 : 2) * landmarks;
    const value = tiles.length >= config.minimumNetwork ? potential : 0;
    result.push({ id: `${layer}:${ids[0]}`, layer, kind: layer === 'habitat' ? first.habitat : first.route!, tiles: ids, landmarks, influence, leaders, potential, value, awards: Object.fromEntries(leaders.map(id => [id, Math.floor(value / leaders.length)])) });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
export const getHabitatComponents = (board: PlacedTile[]) => components(board, 'habitat');
export const getRouteComponents = (board: PlacedTile[]) => components(board, 'route');
export const getComponents = (board: PlacedTile[]) => [...getHabitatComponents(board), ...getRouteComponents(board)];
export function calculateScores(board: PlacedTile[], players: Pick<Player, 'id'>[], milestones: Milestone[], networks = getComponents(board)): Record<string, Score> {
  return Object.fromEntries(players.map(player => {
    const score: Score = { habitat: 0, trail: 0, stream: 0, milestones: 0, network: 0, total: 0, uniqueNetworks: 0, milestoneCount: 0 };
    for (const network of networks) {
      const field = network.layer === 'habitat' ? 'habitat' : network.kind === 'Trail' ? 'trail' : 'stream'; score[field] += network.awards[player.id] || 0;
      if (network.value > 0 && network.leaders.length === 1 && network.leaders[0] === player.id) score.uniqueNetworks++;
    }
    for (const milestone of milestones) if (milestone.claimedBy === player.id) { score.milestones += milestoneDefinitions[milestone.id].points; score.milestoneCount++; }
    score.network = score.habitat + score.trail + score.stream; score.total = score.network + score.milestones;
    return [player.id, score];
  }));
}
export function qualifiesMilestone(id: MilestoneId, actor: string, networks: Component[]) {
  const owned = networks.filter(c => c.leaders.length === 1 && c.leaders[0] === actor);
  if (id === 'Two Horizons') return new Set(owned.filter(c => c.layer === 'habitat' && c.tiles.length >= 4).map(c => c.kind)).size >= 2;
  const kind = ({ 'Great Grove': 'Forest', 'Open Range': 'Meadow', 'High Pass': 'Highland', Trailblazer: 'Trail', Watershed: 'Stream' } as const)[id];
  return owned.some(c => c.kind === kind && c.tiles.length >= (id === 'Great Grove' || id === 'Open Range' ? 7 : 6) && (id !== 'High Pass' || c.landmarks > 0));
}
type PublicState = Pick<Game, 'players' | 'board' | 'market' | 'phase' | 'active' | 'round' | 'turn' | 'revision' | 'milestones'>;
export function validatePlacement(state: PublicState, actor: string, action: PlaceAction) {
  need(state.phase === 'PLACING', 'This match has finished.'); need(state.active === actor, 'Wait for your turn.');
  const fields = ['type', 'round', 'turn', 'revision', 'offer', 'tile', 'x', 'y', 'orientation', 'marker'];
  need(action && Object.keys(action).every(field => fields.includes(field)) && action.type === 'PLACE_LANDSCAPE_TILE', 'Submit one landscape placement.');
  need(action.revision === state.revision && action.round === state.round && action.turn === state.turn, 'That turn or market selection is stale.');
  need(Number.isSafeInteger(action.x) && Number.isSafeInteger(action.y), 'Use whole-number map coordinates.');
  need(Number.isInteger(action.orientation) && action.orientation >= 0 && action.orientation < 4, 'Choose one of four tile orientations.');
  need(action.marker === null || action.marker === 'habitat' || action.marker === 'route', 'Choose Habitat Survey, Route Survey, or no marker.');
  const offer = state.market.find(offer => offer?.id === action.offer); need(offer && offer.tile.id === action.tile, 'That landscape tile is no longer offered.');
  need(!state.board.some(tile => tile.x === action.x && tile.y === action.y), 'That map location is occupied.');
  need(state.board.some(tile => Math.abs(tile.x - action.x) + Math.abs(tile.y - action.y) === 1), 'Place beside an existing tile, along an edge.');
  const player = state.players.find(p => p.id === actor); need(player, 'This seat is not in the match.');
  if (action.marker) { need(player.markersLeft > 0, 'All eight Survey Markers are already deployed.'); need(action.marker !== 'route' || offer.tile.route, 'Route Survey needs a Trail or Stream tile.'); }
  return offer;
}
export function previewTurn(state: PublicState, actor: string, action: PlaceAction): Preview {
  const offer = validatePlacement(state, actor, action);
  const board = [...state.board, { ...offer.tile, ports: [...offer.tile.ports], x: action.x, y: action.y, orientation: action.orientation, marker: action.marker ? { owner: actor, mode: action.marker } : null }];
  const networks = getComponents(board), claims: MilestoneId[] = [];
  const milestones = state.milestones.map(m => { if (!m.claimedBy && qualifiesMilestone(m.id, actor, networks)) { claims.push(m.id); return { ...m, claimedBy: actor, claimedTurn: state.turn }; } return { ...m }; });
  const old = getComponents(state.board); let controlChanges = 0;
  for (const component of old) { const after = networks.find(n => n.layer === component.layer && n.tiles.includes(component.tiles[0]!)); if (after && after.leaders.join(',') !== component.leaders.join(',')) controlChanges++; }
  return { board, components: networks, scores: calculateScores(board, state.players, milestones, networks), milestones, claims, controlChanges };
}
function random(game: Pick<Game, 'rng'>) { game.rng = (game.rng + 0x6D2B79F5) >>> 0; let x = game.rng; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
export function shuffleTileDeck<T>(game: Pick<Game, 'rng'>, items: T[]) { const list = [...items]; for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random(game) * (i + 1)); [list[i], list[j]] = [list[j]!, list[i]!]; } return list; }
function draw(game: Game, slot: number) { const tile = game.bag.pop(); need(tile, 'The landscape supply is exhausted.'); return { id: `offering-${game.serial++}`, slot, tile }; }
export function createGame(seats: { id: string; name: string }[], seed: number): Game {
  limits(seats.length); need(new Set(seats.map(p => p.id)).size === seats.length && seats.every(p => p.id && p.name), 'Choose unique seats with display names.'); need(Number.isSafeInteger(seed), 'Use an integer seed.');
  const colors = ['#a34d38', '#2d6980', '#626a36', '#8b5977', '#9a702a']; const sigils = ['◆', '●', '▲', '■', '✦'];
  const game: Game = { gameVersion: 1, seed, rng: seed >>> 0, players: seats.map((seat, index) => ({ ...seat, seat: index, connected: true, color: colors[index]!, sigil: sigils[index]!, markersLeft: 8, turns: 0 })), board: [startingTile()], bag: [], market: [], milestones: [], phase: 'PLACING', round: 1, turn: 1, startingSeat: 0, active: null, revision: 0, serial: 1, history: [], actionLog: [], winners: [] };
  game.bag = shuffleTileDeck(game, createTileDeck()); game.startingSeat = Math.floor(random(game) * seats.length); game.active = game.players[game.startingSeat]!.id;
  game.milestones = [(['Great Grove', 'Open Range', 'High Pass'] as MilestoneId[])[Math.floor(random(game) * 3)]!, (['Trailblazer', 'Watershed', 'Two Horizons'] as MilestoneId[])[Math.floor(random(game) * 3)]!].map(id => ({ id, claimedBy: null, claimedTurn: null }));
  game.market = [0, 1, 2].map(slot => draw(game, slot)); validateGame(game); return game;
}
export function fallbackAction(state: Pick<View, 'market' | 'board' | 'round' | 'turn' | 'revision'>): PlaceAction {
  const offer = state.market.find(offer => offer !== null); need(offer, 'No market offering remains.'); const target = getLegalPlacements(state.board)[0]; need(target, 'No legal placement remains.');
  return { type: 'PLACE_LANDSCAPE_TILE', round: state.round, turn: state.turn, revision: state.revision, offer: offer.id, tile: offer.tile.id, ...target, orientation: 0, marker: null };
}
export function calculateStandings(state: Pick<Game, 'board' | 'players' | 'milestones'>) {
  const scores = calculateScores(state.board, state.players, state.milestones);
  const sorted = state.players.map(player => ({ player: player.id, ...scores[player.id]! })).sort((a, b) => b.total - a.total || b.milestoneCount - a.milestoneCount || b.uniqueNetworks - a.uniqueNetworks);
  const best = sorted[0]!; return sorted.map(score => ({ ...score, winner: score.total === best.total && score.milestoneCount === best.milestoneCount && score.uniqueNetworks === best.uniqueNetworks }));
}
export function applyAction(original: Game, actor: string, intention: Action): Game {
  let action: PlaceAction;
  if (intention?.type === 'TIMEOUT') { need(actor === '@system' && Object.keys(intention).length === 1, 'Only the server controls deadlines.'); action = fallbackAction(original); actor = original.active!; } else action = intention as PlaceAction;
  const preview = previewTurn(original, actor, action); const game = structuredClone(original); const player = game.players.find(p => p.id === actor)!;
  game.board = preview.board; player.turns++; if (action.marker) player.markersLeft--;
  game.market[game.market.findIndex(offer => offer?.id === action.offer)] = null; game.milestones = preview.milestones;
  game.history.push({ turn: game.turn, actor, tile: action.tile, x: action.x, y: action.y, orientation: action.orientation, marker: action.marker, claims: preview.claims, controlChanges: preview.controlChanges, text: `${player.name} placed ${game.board.at(-1)!.habitat}${action.marker ? ` · ${action.marker === 'habitat' ? 'Habitat' : 'Route'} Survey` : ''}${preview.claims.length ? ` · ${preview.claims.join(' and ')} claimed` : ''}.` });
  game.actionLog.push({ actor: intention.type === 'TIMEOUT' ? '@system' : actor, action: structuredClone(intention) }); game.revision++;
  const count = game.history.length, rounds = limits(game.players.length);
  if (count === game.players.length * rounds) { game.phase = 'GAME_OVER'; game.active = null; game.winners = calculateStandings(game).filter(p => p.winner).map(p => p.player); }
  else { game.market[actionSlot(original, action.offer)] = draw(game, actionSlot(original, action.offer)); game.turn++; game.round = Math.floor(count / game.players.length) + 1; game.active = game.players[(game.startingSeat + game.round - 1 + count % game.players.length) % game.players.length]!.id; }
  validateGame(game); return game;
}
function actionSlot(game: Game, offer: string) { const slot = game.market.findIndex(item => item?.id === offer); need(slot >= 0, 'That market slot is unavailable.'); return slot; }
export function project(game: Game, viewerId?: string | null): View {
  void viewerId;
  const networks = getComponents(game.board), scores = calculateScores(game.board, game.players, game.milestones, networks);
  return structuredClone({ gameVersion: game.gameVersion, players: game.players.map(p => ({ ...p, score: scores[p.id]! })), board: game.board, market: game.market, milestones: game.milestones, phase: game.phase, round: game.round, turn: game.turn, startingSeat: game.startingSeat, active: game.active, revision: game.revision, history: game.history, winners: game.winners, remainingTiles: game.bag.length, components: networks });
}
export function validateGame(game: Game) {
  const count = game.players?.length; const rounds = limits(count); need(game.gameVersion === 1 && new Set(game.players.map(p => p.id)).size === count, 'Invalid Wildways version or seats.');
  need(Number.isSafeInteger(game.seed) && Number.isInteger(game.rng) && game.rng >= 0 && game.rng <= 0xffffffff, 'Invalid random state.');
  need(game.market.length === 3 && game.market.every((offer, slot) => !offer || offer.slot === slot), 'Invalid market slots.');
  const offers = game.market.filter(offer => offer !== null); need(new Set(offers.map(o => o.id)).size === offers.length, 'Duplicate market offering.');
  const origin = game.board.filter(tile => tile.id === 'origin'); const neutral = origin[0]; need(origin.length === 1 && neutral?.x === 0 && neutral.y === 0 && neutral.orientation === 0 && neutral.habitat === 'Meadow' && neutral.route === null && neutral.ports.length === 0 && neutral.landmark === null && neutral.marker === null, 'The neutral starting tile must remain unchanged.');
  const all = [...game.bag, ...offers.map(o => o.tile), ...game.board.filter(tile => tile.id !== 'origin')]; need(all.length === 72 && new Set(all.map(t => t.id)).size === 72, 'Tile conservation failed.');
  for (const tile of all) { const expected = catalog.get(tile.id); need(expected && tile.habitat === expected.habitat && tile.route === expected.route && tile.landmark === expected.landmark && JSON.stringify(tile.ports) === JSON.stringify(expected.ports), 'Unknown tile identity or geometry.'); }
  need(new Set(game.board.map(key)).size === game.board.length, 'Two tiles occupy one coordinate.');
  for (const tile of game.board) { need(Number.isSafeInteger(tile.x) && Number.isSafeInteger(tile.y) && Number.isInteger(tile.orientation) && tile.orientation >= 0 && tile.orientation < 4, 'Invalid map coordinate or orientation.'); if (tile.marker) need(game.players.some(p => p.id === tile.marker!.owner) && (tile.marker.mode === 'habitat' || tile.marker.mode === 'route' && !!tile.route), 'Invalid Survey Marker.'); }
  const occupied = new Map(game.board.map(tile => [key(tile), tile])); const seen = new Set<string>(['0,0']), queue = [{ x: 0, y: 0 }];
  for (let i = 0; i < queue.length; i++) for (const point of neighbors(queue[i]!)) if (occupied.has(key(point)) && !seen.has(key(point))) { seen.add(key(point)); queue.push(point); }
  need(seen.size === game.board.length, 'The landscape is disconnected.');
  const placed = game.board.length - 1; need(placed === game.revision && placed === game.history.length && placed === game.actionLog.length && game.players.reduce((n, p) => n + p.turns, 0) === placed, 'Invalid turn history.');
  need(Number.isSafeInteger(game.serial) && game.serial === 4 + placed - (game.phase === 'GAME_OVER' ? 1 : 0) && offers.every(offer => /^offering-[1-9]\d*$/.test(offer.id) && Number(offer.id.slice(9)) < game.serial), 'Invalid market offering sequence.');
  need(new Set(game.history.map(event => event.tile)).size === placed, 'Duplicate tile in placement history.');
  need(Number.isInteger(game.startingSeat) && game.startingSeat >= 0 && game.startingSeat < count, 'Invalid starting seat.');
  for (const [seat, player] of game.players.entries()) { const used = game.board.filter(t => t.marker?.owner === player.id).length; const ownHistory = game.history.filter(e => e.actor === player.id); need(player.seat === seat && Number.isInteger(player.turns) && player.turns >= 0 && player.turns <= rounds && player.markersLeft === 8 - used && used <= 8 && player.turns === ownHistory.length, 'Survey Marker supply or seat turns do not match.'); }
  need(game.milestones.length === 2 && new Set(game.milestones.map(m => m.id)).size === 2 && game.milestones.every(m => m.id in milestoneDefinitions) && game.milestones.filter(m => milestoneDefinitions[m.id].category === 'habitat').length === 1, 'Choose one Habitat and one Network Milestone.');
  for (const m of game.milestones) { if (m.claimedBy) need(game.players.some(p => p.id === m.claimedBy) && Number.isInteger(m.claimedTurn) && m.claimedTurn! > 0 && m.claimedTurn! <= placed && game.history[m.claimedTurn! - 1]?.actor === m.claimedBy && game.history[m.claimedTurn! - 1]?.claims.includes(m.id), 'Invalid Milestone claim.'); else need(m.claimedTurn === null, 'Unclaimed Milestone has a claim turn.'); }
  for (const [index, event] of game.history.entries()) { const round = Math.floor(index / count); const expectedActor = game.players[(game.startingSeat + round + index % count) % count]!.id; const tile = game.board.find(t => t.id === event.tile); need(event.turn === index + 1 && event.actor === expectedActor && tile && tile.x === event.x && tile.y === event.y && tile.orientation === event.orientation && tile.marker?.owner === (event.marker ? event.actor : undefined) && (tile.marker?.mode ?? null) === event.marker, 'Invalid placement history or initiative.'); }
  const networks = getComponents(game.board); need(networks.filter(c => c.layer === 'habitat').reduce((n, c) => n + c.tiles.length, 0) === game.board.length && networks.filter(c => c.layer === 'route').reduce((n, c) => n + c.tiles.length, 0) === game.board.filter(t => t.route).length, 'Network partition failed.');
  if (game.phase === 'PLACING') { const round = Math.floor(placed / count) + 1; need(placed < rounds * count && offers.length === 3 && game.turn === placed + 1 && game.round === round && !game.winners.length && game.active === game.players[(game.startingSeat + round - 1 + placed % count) % count]!.id, 'Invalid current turn.'); }
  else need(game.phase === 'GAME_OVER' && placed === rounds * count && game.round === rounds && game.turn === placed && offers.length === 2 && game.active === null && JSON.stringify(game.winners) === JSON.stringify(calculateStandings(game).filter(p => p.winner).map(p => p.player)), 'Invalid final scoring or match length.');
}
export const serializeGame = (game: Game) => JSON.stringify(game);
export function restoreGame(text: string) { const game = JSON.parse(text) as Game; validateGame(game); return game; }
export function replayGame(seats: { id: string; name: string }[], seed: number, log: Game['actionLog']) { let game = createGame(seats, seed); for (const event of log) game = applyAction(game, event.actor, event.action); return game; }
