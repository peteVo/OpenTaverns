export const families = ['Tide', 'Fern', 'Ember', 'Ochre', 'Orchid'] as const;
export type Family = typeof families[number];
export type Tile = { id: string; family: Family };
export type Board = (Tile | null)[];
export type Placement = { tile: string; row: number; col: number };
export type Palette = { id: string; slot: number; tiles: [Tile, Tile] };
export const config = { size: 5, rounds: 10, market: 5, familyTiles: 20, connection: 2, runs: { 3: 3, 4: 6, 5: 10 }, rainbow: 5 } as const;
export const commissionDefinitions = {
  Ribbon: { points: 8, requirement: 'A matching straight run of four or more.' },
  'Four Corners': { points: 10, requirement: 'Four filled corners, all different families.' },
  Centerpiece: { points: 8, requirement: 'Fill the center cross with at least three families.' },
  Bridge: { points: 10, requirement: 'One matching connected group reaches left and right.' },
  Cascade: { points: 10, requirement: 'One matching connected group reaches top and bottom.' },
  Spectrum: { points: 8, requirement: 'At least three tiles in each of four families.' }
} as const;
export type Commission = keyof typeof commissionDefinitions;
export const commissions = Object.keys(commissionDefinitions) as Commission[];
export type Player = { id: string; name: string; seat: number; connected: boolean; board: Board; turns: number };
export type DraftAction = { type: 'DRAFT_AND_PLACE'; round: number; turn: number; revision: number; offer: string; placements: [Placement, Placement] };
export type Action = DraftAction | { type: 'TIMEOUT' };
export type Game = { gameVersion: 1; seed: number; rng: number; players: Player[]; bag: Tile[]; market: (Palette | null)[]; commissions: Commission[]; phase: 'DRAFTING' | 'GAME_OVER'; round: number; turn: number; startingSeat: number; active: string | null; revision: number; serial: number; history: { round: number; player: string; offer: string; placements: [Placement, Placement] }[]; actionLog: { actor: string; action: Action }[]; winners: string[] };
export const emptyBoard = (): Board => Array(25).fill(null);
function need(value: unknown, message: string): asserts value { if (!value) throw Error(message); }
export function cellIndex(row: number, col: number) { need(Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < 5 && col >= 0 && col < 5, 'Choose a cell inside the 5×5 board.'); return row * 5 + col; }
export function neighbors(cell: number) { const row = Math.floor(cell / 5), col = cell % 5; return [row > 0 ? cell - 5 : -1, row < 4 ? cell + 5 : -1, col > 0 ? cell - 1 : -1, col < 4 ? cell + 1 : -1].filter(i => i >= 0); }
export function getLegalPlacementCells(board: Board) { const empty = !board.some(Boolean); return board.flatMap((tile, i) => !tile && (empty || neighbors(i).some(n => board[n])) ? [i] : []); }
export function stageTile(board: Board, tile: Tile, row: number, col: number) { const index = cellIndex(row, col); need(!board[index], 'That cell is already occupied.'); need(getLegalPlacementCells(board).includes(index), 'Place beside an existing tile, not diagonally.'); const next = board.slice(); next[index] = tile; return next; }
export function matchingPairs(board: Board): [number, number][] { return board.flatMap((tile, i) => tile ? [i % 5 < 4 ? i + 1 : -1, i < 20 ? i + 5 : -1].filter(n => n >= 0 && board[n]?.family === tile.family).map(n => [i, n] as [number, number]) : []); }
export function findMaximalRuns(board: Board) {
  const result: { cells: number[]; family: Family; points: number }[] = [];
  for (const vertical of [false, true]) for (let line = 0; line < 5; line++) {
    let cells: number[] = []; let family: Family | null = null;
    const flush = () => { if (cells.length >= 3) result.push({ cells, family: family!, points: config.runs[cells.length as 3 | 4 | 5] }); cells = []; };
    for (let offset = 0; offset <= 5; offset++) { const index = vertical ? offset * 5 + line : line * 5 + offset; const next = offset < 5 ? board[index]?.family ?? null : null; if (next !== family || !next) flush(); if (next) cells.push(index); family = next; }
  }
  return result;
}
export function findRainbowSquares(board: Board) { const squares: number[][] = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const i = r * 5 + c, cells = [i, i + 1, i + 5, i + 6]; if (cells.every(i => board[i]) && new Set(cells.map(i => board[i]!.family)).size === 4) squares.push(cells); } return squares; }
export function matchingComponents(board: Board) {
  const seen = new Set<number>(); const groups: number[][] = [];
  for (let i = 0; i < 25; i++) if (board[i] && !seen.has(i)) { const cells = [i]; seen.add(i); for (let j = 0; j < cells.length; j++) for (const next of neighbors(cells[j]!)) if (!seen.has(next) && board[next]?.family === board[i]!.family) { seen.add(next); cells.push(next); } groups.push(cells); }
  return groups;
}
export function evaluateCommission(board: Board, id: Commission) {
  let cells: number[] = []; let complete = false; let progress = '';
  if (id === 'Ribbon') { cells = findMaximalRuns(board).sort((a, b) => b.cells.length - a.cells.length)[0]?.cells || []; complete = cells.length >= 4; progress = `${cells.length}/4 in a straight run`; }
  if (id === 'Four Corners') { cells = [0, 4, 20, 24]; const filled = cells.filter(i => board[i]); const distinct = new Set(filled.map(i => board[i]!.family)).size; complete = filled.length === 4 && distinct === 4; progress = `${filled.length}/4 corners · ${distinct}/4 families`; }
  if (id === 'Centerpiece') { cells = [12, 7, 11, 13, 17]; const filled = cells.filter(i => board[i]); const distinct = new Set(filled.map(i => board[i]!.family)).size; complete = filled.length === 5 && distinct >= 3; progress = `${filled.length}/5 cells · ${distinct}/3 families`; }
  if (id === 'Bridge' || id === 'Cascade') { const coordinate = (i: number) => id === 'Bridge' ? i % 5 : Math.floor(i / 5); const groups = matchingComponents(board); cells = groups.find(g => g.some(i => coordinate(i) === 0) && g.some(i => coordinate(i) === 4)) || groups.sort((a, b) => (Math.max(...b.map(coordinate)) - Math.min(...b.map(coordinate))) - (Math.max(...a.map(coordinate)) - Math.min(...a.map(coordinate))))[0] || []; complete = cells.some(i => coordinate(i) === 0) && cells.some(i => coordinate(i) === 4); progress = cells.length ? `Matching group spans ${Math.max(...cells.map(coordinate)) - Math.min(...cells.map(coordinate)) + 1}/5 ${id === 'Bridge' ? 'columns' : 'rows'}` : 'No matching group yet'; }
  if (id === 'Spectrum') { const qualifying = families.filter(f => board.filter(t => t?.family === f).length >= 3); cells = board.flatMap((tile, i) => tile && qualifying.includes(tile.family) ? [i] : []); complete = qualifying.length >= 4; progress = `${qualifying.length}/4 families with three tiles`; }
  return { id, complete, points: complete ? commissionDefinitions[id].points : 0, cells, progress };
}
export function calculateScore(board: Board, objectives: Commission[]) {
  const pairs = matchingPairs(board), straightRuns = findMaximalRuns(board), squares = findRainbowSquares(board), gallery = objectives.map(id => evaluateCommission(board, id));
  const connections = pairs.length * config.connection, runs = straightRuns.reduce((n, r) => n + r.points, 0), rainbows = squares.length * config.rainbow, commissions = gallery.reduce((n, c) => n + c.points, 0);
  return { connections, runs, rainbows, commissions, total: connections + runs + rainbows + commissions, pairs, straightRuns, squares, gallery };
}
export function calculateStandings(players: { id: string; board: Board }[], objectives: Commission[]) {
  const scores = players.map(p => ({ player: p.id, ...calculateScore(p.board, objectives) })).sort((a, b) => b.total - a.total || b.squares.length - a.squares.length || b.gallery.filter(g => g.complete).length - a.gallery.filter(g => g.complete).length);
  const first = scores[0]!; return scores.map(s => ({ ...s, winner: s.total === first.total && s.squares.length === first.squares.length && s.gallery.filter(g => g.complete).length === first.gallery.filter(g => g.complete).length }));
}
export function createTileBag(): Tile[] { return families.flatMap(family => Array.from({ length: 20 }, (_, i) => ({ id: `${family}-${i + 1}`, family }))); }
function random(game: Game) { game.rng = (game.rng + 0x6D2B79F5) >>> 0; let x = game.rng; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }
function shuffle<T>(game: Game, list: T[]) { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(random(game) * (i + 1)); [list[i], list[j]] = [list[j]!, list[i]!]; } return list; }
function drawPalette(game: Game, slot: number): Palette { need(game.bag.length >= 2, 'The tile supply is exhausted.'); return { id: `palette-${game.serial++}`, slot, tiles: [game.bag.pop()!, game.bag.pop()!] }; }
export function createGame(seats: { id: string; name: string }[], seed: number): Game {
  need(seats.length >= 2 && seats.length <= 4 && new Set(seats.map(s => s.id)).size === seats.length, 'Mosaic needs 2–4 unique seats.');
  const game: Game = { gameVersion: 1, seed, rng: seed >>> 0, players: seats.map((s, seat) => ({ ...s, seat, connected: true, board: emptyBoard(), turns: 0 })), bag: [], market: [], commissions: [], phase: 'DRAFTING', round: 1, turn: 1, startingSeat: 0, active: null, revision: 0, serial: 1, history: [], actionLog: [], winners: [] };
  game.bag = shuffle(game, createTileBag()); game.commissions = shuffle(game, [...commissions]).slice(0, 2); game.startingSeat = Math.floor(random(game) * seats.length); game.active = game.players[game.startingSeat]!.id; game.market = Array.from({ length: 5 }, (_, slot) => drawPalette(game, slot)); validateGame(game); return game;
}
export function previewPlacement(board: Board, offer: Palette, placements: Placement[]) {
  need(placements.length <= 2 && new Set(placements.map(p => p.tile)).size === placements.length, 'Place each selected tile only once.'); let next = board;
  for (const p of placements) { const tile = offer.tiles.find(t => t.id === p.tile); need(tile, 'Both tiles must belong to the selected Palette.'); next = stageTile(next, tile, p.row, p.col); } return next;
}
export function fallbackAction(game: Pick<Game, 'market' | 'players' | 'active' | 'round' | 'turn' | 'revision'>): DraftAction {
  const offer = game.market.find(Boolean)!; let board = game.players.find(p => p.id === game.active)!.board; const placements = offer.tiles.map(tile => { const i = getLegalPlacementCells(board)[0]!; const p = { tile: tile.id, row: Math.floor(i / 5), col: i % 5 }; board = stageTile(board, tile, p.row, p.col); return p; }) as [Placement, Placement];
  return { type: 'DRAFT_AND_PLACE', round: game.round, turn: game.turn, revision: game.revision, offer: offer.id, placements };
}
export function applyAction(original: Game, actor: string, intention: Action): Game {
  need(original.phase === 'DRAFTING', 'This match has finished.'); let action: DraftAction;
  if (intention.type === 'TIMEOUT') { need(actor === '@system', 'Only the server controls deadlines.'); action = fallbackAction(original); actor = original.active!; } else action = intention;
  need(action.type === 'DRAFT_AND_PLACE' && actor === original.active, 'Wait for your turn.'); need(action.revision === original.revision && action.round === original.round && action.turn === original.turn, 'That turn or Palette selection is stale.');
  const offer = original.market.find(p => p?.id === action.offer); need(offer, 'That Palette is no longer available.'); need(action.placements.length === 2, 'Place exactly two tiles.');
  const player = original.players.find(p => p.id === actor)!; const board = previewPlacement(player.board, offer, action.placements);
  const game = structuredClone(original); const next = game.players.find(p => p.id === actor)!; next.board = board; next.turns++; game.market[offer.slot] = null; game.history.push({ round: game.round, player: actor, offer: offer.id, placements: structuredClone(action.placements) }); game.actionLog.push({ actor: intention.type === 'TIMEOUT' ? '@system' : actor, action: structuredClone(intention) }); game.revision++;
  if (game.history.length === game.players.length * 10) { game.phase = 'GAME_OVER'; game.active = null; game.winners = calculateStandings(game.players, game.commissions).filter(s => s.winner).map(s => s.player); }
  else { game.market[offer.slot] = drawPalette(game, offer.slot); game.turn++; game.round = Math.floor(game.history.length / game.players.length) + 1; const seat = (game.startingSeat + game.round - 1 + game.history.length % game.players.length) % game.players.length; game.active = game.players[seat]!.id; }
  validateGame(game); return game;
}
export function project(game: Game) { return { gameVersion: game.gameVersion, players: game.players.map(p => ({ ...p, score: calculateScore(p.board, game.commissions) })), market: game.market, commissions: game.commissions, remainingTiles: game.bag.length, phase: game.phase, round: game.round, turn: game.turn, active: game.active, revision: game.revision, startingSeat: game.startingSeat, history: game.history, winners: game.winners, standings: game.phase === 'GAME_OVER' ? calculateStandings(game.players, game.commissions) : [] }; }
export type View = ReturnType<typeof project>;
export function validateGame(game: Game) {
  need(game.gameVersion === 1 && game.players.length >= 2 && game.players.length <= 4 && new Set(game.players.map(p => p.id)).size === game.players.length, 'Invalid game version or seats.');
  need(game.market.length === 5 && game.commissions.length === 2 && new Set(game.commissions).size === 2 && game.commissions.every(id => commissions.includes(id)), 'Invalid market or Commissions.');
  const tiles = [...game.bag, ...game.market.flatMap(p => p?.tiles || []), ...game.players.flatMap(p => p.board.filter((t): t is Tile => t !== null))];
  need(tiles.length === 100 && new Set(tiles.map(t => t.id)).size === 100, 'Tile conservation failed.'); const catalogue = new Map(createTileBag().map(t => [t.id, t.family])); for (const t of tiles) need(catalogue.get(t.id) === t.family, 'Unknown tile identity or family.');
  const offers = game.market.filter((p): p is Palette => !!p); need(new Set(offers.map(p => p.id)).size === offers.length && offers.every(p => p.tiles.length === 2 && game.market[p.slot] === p), 'Invalid Palette.');
  for (const [seat, p] of game.players.entries()) { const cells = p.board.flatMap((t, i) => t ? [i] : []); need(p.seat === seat && p.board.length === 25 && p.turns >= 0 && p.turns <= 10 && cells.length === p.turns * 2 && p.turns === game.history.filter(h => h.player === p.id).length, 'Board or turn inventory mismatch.'); const seen = new Set<number>(); const queue = cells.slice(0, 1); for (let i = 0; i < queue.length; i++) { const c = queue[i]!; if (seen.has(c)) continue; seen.add(c); queue.push(...neighbors(c).filter(n => p.board[n] && !seen.has(n))); } need(seen.size === cells.length, 'A mosaic is disconnected.'); }
  need(game.revision === game.history.length && game.actionLog.length === game.history.length && game.round >= 1 && game.round <= 10, 'Invalid revision or round.');
  if (game.phase === 'DRAFTING') { need(offers.length === 5 && game.turn === game.history.length + 1 && game.round === Math.floor(game.history.length / game.players.length) + 1 && !game.winners.length, 'Invalid drafting phase.'); const order = (game.startingSeat + game.round - 1 + game.history.length % game.players.length) % game.players.length; need(game.active === game.players[order]!.id, 'Invalid initiative.'); for (const [i, p] of game.players.entries()) { const completed = Math.floor(game.history.length / game.players.length); const offset = (i - (game.startingSeat + game.round - 1) % game.players.length + game.players.length) % game.players.length; need(p.turns === completed + (offset < game.history.length % game.players.length ? 1 : 0), 'Unequal drafting turns.'); } }
  else need(game.phase === 'GAME_OVER' && game.round === 10 && game.turn === game.players.length * 10 && game.players.every(p => p.turns === 10) && offers.length === 4 && game.active === null && JSON.stringify(game.winners) === JSON.stringify(calculateStandings(game.players, game.commissions).filter(s => s.winner).map(s => s.player)), 'Invalid final result.');
}
export const serializeGame = (game: Game) => JSON.stringify(game);
export function restoreGame(text: string) { const game = JSON.parse(text) as Game; validateGame(game); return game; }
export function replayGame(seats: { id: string; name: string }[], seed: number, log: Game['actionLog']) { let game = createGame(seats, seed); for (const e of log) game = applyAction(game, e.actor, e.action); return game; }
