import { applyAction, createGame, estimateForecast, getLegalCards, project, resolveTrick, validateGame, type Action, type View } from './index.js';

export function nextBotAction(view: View, actor: string): Action | null {
  const me = view.players.find(p => p.id === actor); if (!me || !view.self || view.phase === 'MATCH_OVER') return null;
  const round = view.round;
  if (view.phase === 'FORECAST_REQUIRED' && view.self.forecast === null) return { type: 'LOCK_FORECAST', round, value: estimateForecast(view.self.hand,view.tide!,view.players.length,view.handSize) };
  if (view.phase === 'COMPASS_REQUIRED' && !me.compassUsed && view.self.compassDecision === null) {
    const estimate = estimateForecast(view.self.hand,view.tide!,view.players.length,view.handSize);
    const total = view.balance!.forecast;
    const direction = Math.sign(estimate-view.self.forecast! || (view.self.forecast! > 0 && total > view.handSize+1 ? -1 : total < view.handSize-1 ? 1 : 0));
    const adjusted = view.self.forecast!+direction;
    // Save the one token for the long middle rounds; use only public totals.
    const adjustment = view.round >= 3 && direction && adjusted >= 0 && adjusted <= view.handSize ? direction as -1 | 1 : 0;
    return { type: 'LOCK_COMPASS', round, adjustment };
  }
  if (view.phase === 'TRICK_PLAY' && view.trick.current === actor) {
    const needed = me.forecast!-me.tricks > 0;
    const legal = getLegalCards(view.self.hand,view.trick.cards);
    const low = view.tide!.rule === 'LOW';
    const strength = (card: typeof legal[number]) => (card.suit === view.trick.dominant ? 20 : 0)+(low ? 14-card.rank : card.rank);
    const sorted = [...legal].sort((a,b) => strength(a)-strength(b) || ((a.rank+view.round+view.trick.number)%3)-((b.rank+view.round+view.trick.number)%3) || a.id.localeCompare(b.id));
    const winners = sorted.filter(card => resolveTrick([...view.trick.cards,{player: actor,card}],view.tide!,view.trick.dominant).player === actor);
    const losers = sorted.filter(card => !winners.includes(card));
    const card = needed ? view.trick.cards.length ? winners[0] || sorted[0]! : sorted.at(-1)! : losers[0] || sorted[0]!;
    return { type: 'PLAY_CARD', round, trick: view.trick.number, card: card.id };
  }
  if (actor === view.dealer && ['DEALING','TIDE_REVEAL','FORECAST_REVEAL','COMPASS_REVEAL','TRICK_RESOLUTION','ROUND_SCORING'].includes(view.phase)) return { type: 'ADVANCE', round, phase: view.phase };
  return null;
}
export function simulate(seed: number, players = 4, zeroSeat: number | null = null) {
  let game = createGame(Array.from({length: players},(_,i) => ({ id: `p${i}`, name: `Sailor ${i+1}` })),seed);
  let actions = 0;
  try {
    while (game.phase !== 'MATCH_OVER' && actions < 1000) {
      const player = game.phase === 'FORECAST_REQUIRED' ? game.players.find(p => p.forecast === null) : game.phase === 'COMPASS_REQUIRED' ? game.players.find(p => p.compassDecision === null) : game.players.find(p => p.id === (game.phase === 'TRICK_PLAY' ? game.trick.current : game.players[game.dealerIndex]!.id));
      const next = player ? { actor: player.id, action: zeroSeat !== null && player.id === `p${zeroSeat}` && game.phase === 'FORECAST_REQUIRED' ? { type: 'LOCK_FORECAST', round: game.round, value: 0 } as Action : zeroSeat !== null && player.id === `p${zeroSeat}` && game.phase === 'COMPASS_REQUIRED' ? {type:'LOCK_COMPASS',round:game.round,adjustment:0} as Action : nextBotAction(project(game,player.id),player.id) } : null; if (!next?.action) throw Error('Deadlock: no legal bot continuation.');
      game = applyAction(game,next.actor,next.action); actions++; validateGame(game);
      const publicView = project(game); if (publicView.self !== null || 'deck' in publicView || 'random' in publicView || publicView.players.some(p => 'hand' in p || 'compassDecision' in p)) throw Error('Privacy projection failed.');
    }
    if (game.phase !== 'MATCH_OVER') throw Error('Action limit.');
    const scores = game.rounds.flatMap(r => r.scores);
    const errors: Record<number,number> = {}; scores.forEach(s => { errors[s.error] = (errors[s.error] || 0)+1; });
    const tideStats = Object.fromEntries(game.rounds.map(r => [r.tide.id,{ exact: r.scores.filter(s => !s.error).length, samples: r.scores.length, score: r.scores.reduce((n,s) => n+s.delta,0), compass: r.scores.filter(s => s.compass).length, leaderTricks: r.scores.find(s => s.player === r.tricks[0]!.lead)!.won }]));
    return { seed, players, actions, winners: game.winners.map(id => game.players.findIndex(p => p.id === id)), scores: game.players.map(p => p.score), exactRate: scores.filter(s => !s.error).length/scores.length, errors, compass: scores.filter(s => s.compass).length, compassUp: scores.filter(s => s.compass > 0).length, compassDown: scores.filter(s => s.compass < 0).length, compassImproved: scores.filter(s => s.compass && s.error < Math.abs(s.originalForecast-s.won)).length, zeroExact: scores.filter(s => !s.forecast && !s.error).length, zeroSamples: scores.filter(s => !s.forecast).length, tideStats, rounds: game.rounds };
  } catch (error) { throw Error(`Tidecall seed=${seed} round=${game.round} trick=${game.trick.number} phase=${game.phase} action=${actions}: ${(error as Error).message}`); }
}
