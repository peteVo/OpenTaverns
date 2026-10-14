import { applyAction, calculateScore, commissions, getLegalPlacementCells, matchingComponents, neighbors, project, stageTile, validateGame, createGame, type Board, type Commission, type DraftAction, type Tile, type View } from './index.js';
function potential(board: Board, objectives: Commission[]) {
  let value = 0;
  for (let i = 0; i < 25; i++) { const tile = board[i]; if (!tile) continue; value += neighbors(i).filter(n => !board[n]).length * .06;
    for (const stride of [1, 5]) { if (stride === 1 && i % 5 > 2 || stride === 5 && i >= 15) continue; const cells = [i, i + stride, i + stride * 2]; if (cells.filter(c => board[c]?.family === tile.family).length === 2 && cells.some(c => !board[c])) value += .35; }
  }
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { const i = r * 5 + c, tiles = [board[i], board[i + 1], board[i + 5], board[i + 6]].filter(Boolean) as Tile[]; if (tiles.length === 3 && new Set(tiles.map(t => t.family)).size === 3) value += .8; }
  if (objectives.includes('Centerpiece')) value += [12, 7, 11, 13, 17].filter(i => board[i]).length * .3;
  if (objectives.includes('Four Corners')) value += new Set([0, 4, 20, 24].filter(i => board[i]).map(i => board[i]!.family)).size * .45;
  if (objectives.includes('Spectrum')) { const counts = new Map<string, number>(); for (const tile of board) if (tile) counts.set(tile.family, (counts.get(tile.family) || 0) + 1); value += [...counts.values()].reduce((n, count) => n + Math.min(3, count) * .12, 0); }
  for (const id of objectives.filter(id => id === 'Bridge' || id === 'Cascade')) { const span = matchingComponents(board).map(cells => { const coordinates = cells.map(i => id === 'Bridge' ? i % 5 : Math.floor(i / 5)); return (Math.max(...coordinates) - Math.min(...coordinates)) * .3 + (coordinates.includes(0) || coordinates.includes(4) ? .1 : 0); }); value += Math.max(0, ...span); }
  return value;
}
function candidates(board: Board, tile: Tile, objectives: Commission[]) {
  return getLegalPlacementCells(board).map(cell => { const next = stageTile(board, tile, Math.floor(cell / 5), cell % 5); const matches = neighbors(cell).filter(n => board[n]?.family === tile.family).length; const centrality = (4 - Math.abs(Math.floor(cell / 5) - 2) - Math.abs(cell % 5 - 2)) * .03; return { cell, board: next, value: matches * 2 + potential(next, objectives) + centrality }; }).sort((a, b) => b.value - a.value || a.cell - b.cell).slice(0, 2);
}
export function nextBotAction(view: View, id: string): DraftAction | null {
  if (view.phase !== 'DRAFTING' || view.active !== id) return null;
  const player = view.players.find(p => p.id === id)!; let best: { value: number; action: DraftAction } | null = null;
  const opponentNeeds = new Map<string, number>(); for (const p of view.players.filter(p => p.id !== id)) for (const tile of p.board) if (tile) opponentNeeds.set(tile.family, (opponentNeeds.get(tile.family) || 0) + 1);
  for (const offer of view.market) if (offer) for (const tiles of [offer.tiles, [offer.tiles[1], offer.tiles[0]]]) for (const first of candidates(player.board, tiles[0]!, view.commissions)) for (const second of candidates(first.board, tiles[1]!, view.commissions)) {
    const score = calculateScore(second.board, view.commissions); const competition = offer.tiles.reduce((n, t) => n + (opponentNeeds.get(t.family) || 0), 0) * .008;
    const value = score.total + potential(second.board, view.commissions) + competition;
    if (!best || value > best.value) best = { value, action: { type: 'DRAFT_AND_PLACE', round: view.round, turn: view.turn, revision: view.revision, offer: offer.id, placements: [{ tile: tiles[0]!.id, row: Math.floor(first.cell / 5), col: first.cell % 5 }, { tile: tiles[1]!.id, row: Math.floor(second.cell / 5), col: second.cell % 5 }] } };
  }
  return best?.action || null;
}
export function simulate(seed: number, count = 4) {
  const started = performance.now(); let game = createGame(Array.from({ length: count }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}` })), seed);
  while (game.phase !== 'GAME_OVER') { try { const view = project(game); if ('bag' in view || 'seed' in view || 'rng' in view) throw Error('Future supply leaked.'); const action = nextBotAction(view, game.active!); if (!action) throw Error('Bot decision failed.'); game = applyAction(game, game.active!, action); validateGame(game); if (game.history.length > count * 10) throw Error('Deadlock.'); } catch (error) { throw Error(`seed ${seed}, round ${game.round}, turn ${game.turn}, player ${game.active}, revision ${game.revision}: ${(error as Error).message}`); } }
  const scores = game.players.map(p => calculateScore(p.board, game.commissions)); return { game, scores, winners: game.winners.map(id => game.players.findIndex(p => p.id === id)), startingSeat: game.startingSeat, turns: game.history.length, durationMs: performance.now() - started, objectives: commissions.map(id => ({ id, selected: game.commissions.includes(id), completed: scores.filter(s => s.gallery.some(g => g.id === id && g.complete)).length })) };
}
