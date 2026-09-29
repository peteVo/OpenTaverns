import { applyAction, canBuildLodge, canBuildTrail, canPay, costs, createGame, exchangeRatio, longestRoute, materials, materialFor, project, renown, total, validateGame, type Action, type View } from './index.js';

function bestSite(game: View, candidates: number[]) {
  return candidates.sort((a, b) => scoreSite(game, b) - scoreSite(game, a))[0]!;
}
function scoreSite(game: View, id: number) {
  const regions = game.sites[id]!.regions.map(i => game.regions[i]!);
  const variety = new Set(regions.map(r => materialFor(r.terrain)).filter(Boolean)).size;
  return regions.reduce((n, r) => n + (r.value ? 11 - Math.abs(5 - r.value) : 0), 0) + variety * 3;
}
export function nextBotAction(game: View, actionsThisTurn: number): Action {
  const p = game.players.find(p => p.id === game.active)!;
  const ownState = game.private;
  if (!ownState) throw Error('A bot needs its own private hand.');
  const hand = ownState.inventory;
  if (game.phase === 'SETUP_FORWARD' || game.phase === 'SETUP_REVERSE') {
    if (game.setupSite === null) return { type: 'SETUP_LODGE', site: bestSite(game, game.sites.filter(s => canBuildLodge(game, p.id, s.id, true)).map(s => s.id)) };
    return { type: 'SETUP_TRAIL', link: game.sites[game.setupSite]!.links.find(i => canBuildTrail(game, p.id, i, game.setupSite!))! };
  }
  if (game.phase === 'PRODUCTION_REQUIRED') return { type: 'ROLL' };
  if (game.phase === 'DISCARD_REQUIRED') {
    const amount = Math.floor(total(hand) / 2); const picked = { Timber: 0, Stone: 0, Provisions: 0, Textiles: 0, Metal: 0 };
    let remaining = amount;
    for (const m of [...materials].sort((a,b) => hand[b] - hand[a])) { picked[m] = Math.min(hand[m], remaining); remaining -= picked[m]; }
    return { type: 'DISCARD', materials: picked };
  }
  if (game.phase === 'ROVER_MOVE_REQUIRED') {
    const target = game.regions.filter(r => r.id !== game.rover).sort((a,b) => b.sites.filter(i => game.sites[i]!.owner && game.sites[i]!.owner !== p.id).length - a.sites.filter(i => game.sites[i]!.owner && game.sites[i]!.owner !== p.id).length)[0]!;
    return { type: 'MOVE_ROVER', region: target.id };
  }
  if (game.phase === 'ROVER_TARGET_REQUIRED') return { type: 'TARGET_ROVER', player: game.roverTargets[0] ?? null };
  if (game.phase === 'WAYFARE' && actionsThisTurn > 0) return { type: 'END_WAYFARE' };
  if (actionsThisTurn >= 5) return game.phase === 'WAYFARE' ? { type: 'END_WAYFARE' } : { type: 'END_TURN' };
  const own = game.sites.filter(s => s.owner === p.id);
  const hall = own.find(s => s.structure === 'Lodge');
  const lodgeCandidates = game.sites.filter(s => canBuildLodge(game, p.id, s.id)).map(s => s.id);
  if (hall && p.hallsLeft && canPay(hand, costs.Hall) && (actionsThisTurn < 3 || !lodgeCandidates.length)) return { type: 'UPGRADE_HALL', site: hall.id };
  if (p.lodgesLeft && lodgeCandidates.length && canPay(hand, costs.Lodge)) return { type: 'BUILD_LODGE', site: bestSite(game, lodgeCandidates) };
  if (game.phase === 'MAIN_ACTION') {
    const playable = ownState.cards.find(c => c.boughtTurn < game.turn && c.kind !== 'Legacy' && (c.kind !== 'Survey' || p.trailsLeft > 0));
    if (playable && !game.playedCard) {
      const scarce = [...materials].sort((a,b) => hand[a] - hand[b])[0]!;
      if (playable.kind === 'Harvest' || playable.kind === 'Levy') return { type: 'PLAY_CHRONICLE', card: playable.id, material: scarce };
      if (playable.kind === 'Scout') return { type: 'PLAY_CHRONICLE', card: playable.id, region: game.regions.find(r => r.id !== game.rover)!.id };
      const free = game.links.find(l => canBuildTrail(game, p.id, l.id));
      if (free) return { type: 'PLAY_CHRONICLE', card: playable.id, links: [free.id] };
    }
  }
  const trailCandidates = game.links.filter(l => canBuildTrail(game, p.id, l.id));
  if (p.trailsLeft && trailCandidates.length && canPay(hand, costs.Trail) && actionsThisTurn < 3) {
    trailCandidates.sort((a,b) => {
      const score = (l: typeof a) => [l.a,l.b].reduce((n, sid) => n + (canBuildLodge(game, p.id, sid) ? scoreSite(game, sid) : 0), 0);
      return score(b) - score(a);
    });
    return { type: 'BUILD_TRAIL', link: trailCandidates[0]!.id };
  }
  if (game.phase === 'MAIN_ACTION') {
    const wants = hall && p.hallsLeft ? costs.Hall : costs.Lodge;
    for (const m of materials) if (hand[m] < wants[m] && game.supply[m]) {
      const give = materials.find(g => g !== m && hand[g] >= exchangeRatio(game, p.id, g) + (wants[g] || 0));
      if (give) return { type: 'SUPPLY_EXCHANGE', give, receive: m };
    }
    if (game.deckCount && canPay(hand, costs.Chronicle) && actionsThisTurn < 2) return { type: 'BUY_CHRONICLE' };
    return { type: 'END_TURN' };
  }
  return { type: 'END_WAYFARE' };
}

export function simulate(seed: number, count = 6, maxActions = 12000) {
  let game = createGame(Array.from({ length: count }, (_, i) => ({ id: `bot${i}`, name: `Bot ${i + 1}` })), seed);
  let actions = 0, actionsThisTurn = 0, lastTurn = -1, lastActive = '';
  while (game.phase !== 'GAME_OVER' && actions < maxActions) {
    if (game.turn !== lastTurn || game.active !== lastActive) { actionsThisTurn = 0; lastTurn = game.turn; lastActive = game.active; }
    const actor = game.phase === 'DISCARD_REQUIRED' ? game.discards[0]! : game.active;
    const action = nextBotAction(project(game, actor), actionsThisTurn);
    try { game = applyAction(game, actor, action); validateGame(game); }
    catch (error) { throw Error(`Seed ${seed}, event ${game.eventNumber}, turn ${game.turn}, ${actor}, ${JSON.stringify(action)}: ${(error as Error).message}`); }
    if (['BUILD_TRAIL','BUILD_LODGE','UPGRADE_HALL','SUPPLY_EXCHANGE','BUY_CHRONICLE','PLAY_CHRONICLE'].includes(action.type)) actionsThisTurn++;
    actions++;
  }
  if (game.phase !== 'GAME_OVER') throw Error(`Seed ${seed}: no winner after ${actions} actions / ${game.turn} turns; ${game.players.map(p => `${p.id}: ${renown(game,p.id)} renown, ${game.sites.filter(s => s.owner===p.id).length} sites, ${game.links.filter(l => l.owner===p.id).length} trails, ${JSON.stringify(p.inventory)}`).join('; ')}`);
  return { seed, count, actions, turns: game.turn, winner: game.winner, route: longestRoute(game, game.winner!) };
}
if (process.argv[1]?.endsWith('simulate.ts')) {
  const games = Number(process.argv[process.argv.indexOf('--games') + 1]) || 100;
  const players = Number(process.argv[process.argv.indexOf('--players') + 1]) || 6;
  const startSeed = Number(process.argv[process.argv.indexOf('--seed') + 1]) || 1;
  const results = Array.from({ length: games }, (_, i) => simulate(i + startSeed, players));
  console.log(`OpenTaverns / Hearthlands simulation\nGames completed: ${results.length}/${games}\nAverage turns: ${Math.round(results.reduce((n, r) => n + r.turns, 0) / games)}\nShortest game: ${Math.min(...results.map(r => r.turns))}\nLongest game: ${Math.max(...results.map(r => r.turns))}`);
}
