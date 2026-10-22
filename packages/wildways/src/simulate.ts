import { applyAction, calculateScores, config, getComponents, getLegalPlacements, portsOf, previewTurn, project, validateGame, createGame, type PlaceAction, type View, type Coord, type Tile, type Orientation } from './index.js';
import type { Score } from './types.js';

function stableTie(view: View, action: PlaceAction): number {
  const text = `${view.revision}|${action.offer}|${action.tile}|${action.x},${action.y}|${action.orientation}|${action.marker ?? '-'}`;
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function nearbyValue(tile: Tile, cell: Coord, orientation: Orientation, byCoord: Map<string, View['board'][number]>): number {
  const ports = portsOf(tile, orientation);
  const neighbors = [
    { x: cell.x, y: cell.y - 1, edge: 0, opposite: 2 },
    { x: cell.x + 1, y: cell.y, edge: 1, opposite: 3 },
    { x: cell.x, y: cell.y + 1, edge: 2, opposite: 0 },
    { x: cell.x - 1, y: cell.y, edge: 3, opposite: 1 }
  ];
  let value = 0;
  for (const next of neighbors) {
    const old = byCoord.get(`${next.x},${next.y}`);
    if (!old) continue;
    if (old.habitat === tile.habitat) value += 3;
    if (tile.route && old.route === tile.route && ports.includes(next.edge as 0 | 1 | 2 | 3) && portsOf(old, old.orientation).includes(next.opposite as 0 | 1 | 2 | 3)) value += 4;
  }
  if (tile.landmark) value += 1.5;
  return value;
}

/** Bounded public-information bot: cheaply rank layouts, then precisely preview a small set. */
export function nextBotAction(view: View, actor: string): PlaceAction | null {
  if (view.phase !== 'PLACING' || view.active !== actor) return null;
  const player = view.players.find(item => item.id === actor);
  if (!player) return null;
  const byCoord = new Map(view.board.map(placed => [`${placed.x},${placed.y}`, placed]));
  const frontier = getLegalPlacements(view.board);
  const options = new Map<string, { offer: string; tile: Tile; cell: Coord; orientation: Orientation; rank: number }[]>();
  for (const offer of view.market) if (offer) for (const orientation of [0, 1, 2, 3] as const) for (const tile of [offer.tile])
    for (const cell of frontier) {
      const list = options.get(offer.id) ?? [];
      list.push({ offer: offer.id, tile, cell, orientation, rank: nearbyValue(tile, cell, orientation, byCoord) });
      options.set(offer.id, list);
    }
  const shortlist = [...options.values()].flatMap(layouts => layouts
    .sort((a, b) => b.rank - a.rank || a.cell.x - b.cell.x || a.cell.y - b.cell.y || a.orientation - b.orientation || a.tile.id.localeCompare(b.tile.id)
    ).slice(0, 3));
  const oldScores = Object.fromEntries(view.players.map(item => [item.id, item.score.total]));
  const oldPotential = new Map(getComponents(view.board).map(component => [component.id, component.potential * (component.leaders.length === 1 && component.leaders[0] === actor ? 1 : component.leaders.includes(actor) ? 0.45 : 0)]));
  const remainingTurns = config.turnsByPlayers[view.players.length]! - player.turns;
  let best: { action: PlaceAction; value: number; tie: number } | null = null;
  for (const layout of shortlist) {
    const markers: PlaceAction['marker'][] = [null, 'habitat', ...(layout.tile.route ? ['route' as const] : [])];
    for (const marker of markers) {
      if (marker && player.markersLeft <= 0) continue;
      const action: PlaceAction = { type: 'PLACE_LANDSCAPE_TILE', round: view.round, turn: view.turn, revision: view.revision, offer: layout.offer, tile: layout.tile.id, x: layout.cell.x, y: layout.cell.y, orientation: layout.orientation, marker };
      let preview;
      try { preview = previewTurn(view, actor, action); } catch { continue; }
      const ownGain = (preview.scores[actor]?.total ?? 0) - oldScores[actor]!;
      const strongestRivalGain = Math.max(0, ...view.players.filter(item => item.id !== actor).map(rival => (preview.scores[rival.id]?.total ?? 0) - oldScores[rival.id]!));
      const potentialGain = preview.components.reduce((sum, component) => {
        const ownership = component.leaders.length === 1 && component.leaders[0] === actor ? 1 : component.leaders.includes(actor) ? 0.45 : 0;
        return sum + Math.max(0, component.potential * ownership - (oldPotential.get(component.id) ?? 0));
      }, 0);
      const markerReserveCost = marker ? (player.markersLeft <= Math.ceil(remainingTurns / 3) ? 1.4 : 0.35) : 0;
      const value = ownGain - strongestRivalGain * 0.65 + potentialGain * 0.035 + preview.claims.reduce((sum, id) => sum + (id === 'Two Horizons' ? 10 : 8), 0) + (marker ? 0.18 : 0) - markerReserveCost;
      const tie = stableTie(view, action);
      if (!best || value > best.value || (value === best.value && tie < best.tie)) best = { action, value, tie };
    }
  }
  return best?.action ?? null;
}

export function simulate(seed: number, playerCount = 4) {
  const started = performance.now();
  const seats = Array.from({ length: playerCount }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}` }));
  let game = createGame(seats, seed);
  let controlChanges = 0;
  let markersUsed = 0;
  let invalidActions = 0;
  while (game.phase !== 'GAME_OVER') {
    try {
      const view = project(game);
      if ('bag' in view || 'seed' in view || 'rng' in view || 'actionLog' in view) throw Error('Private game state leaked into the bot view.');
      const actor = game.active!;
      const action = nextBotAction(view, actor);
      if (!action) throw Error('Bot did not find a legal move.');
      const preview = previewTurn(view, actor, action);
      controlChanges += preview.controlChanges;
      if (action.marker) markersUsed++;
      game = applyAction(game, actor, action);
      validateGame(game);
    } catch (error) {
      invalidActions++;
      throw Error(`Wildways simulation failed: seed=${seed}, turn=${game.turn}, active=${game.active}, revision=${game.revision}; ${(error as Error).message}`);
    }
  }
  const scores = calculateScores(game.board, game.players, game.milestones);
  const scoreList: Score[] = game.players.map(player => scores[player.id]!);
  return {
    game,
    turns: game.history.length,
    durationMs: performance.now() - started,
    scores: scoreList,
    winners: game.winners.map(id => game.players.findIndex(player => player.id === id)),
    startingSeat: game.startingSeat,
    milestones: game.milestones.map(({ id, claimedBy }) => ({ id, claimedBy })),
    controlChanges,
    markersUsed,
    invalidActions,
    invariantViolations: 0
  };
}
