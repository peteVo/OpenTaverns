export const suits = ['WAVE', 'WIND', 'REEF', 'SUN'] as const;
export type Suit = typeof suits[number];
export type Card = { id: string; suit: Suit; rank: number };
export const config = { handSizes: [3,4,5,6,7,7,6,5,4,3], scoring: { exact: 12, perTrick: 3, miss: 4 } };
export type Tide = { id: string; name: string; rule: 'HIGH' | 'LOW' | 'SWITCH' | 'SHIFT'; dominant: Suit | null; second: Suit | null; description: string };
export const tides: Tide[] = [
  { id: 'CALM', name: 'Calm Water', rule: 'HIGH', dominant: null, second: null, description: 'No dominant suit. Highest card in the lead suit wins.' },
  { id: 'HIGH', name: 'High Tide', rule: 'HIGH', dominant: 'WAVE', second: null, description: 'Wave is dominant. Highest eligible card wins.' },
  { id: 'TAILWIND', name: 'Tailwind', rule: 'HIGH', dominant: 'WIND', second: null, description: 'Wind is dominant. Highest eligible card wins.' },
  { id: 'REEFLINE', name: 'Reefline', rule: 'HIGH', dominant: 'REEF', second: null, description: 'Reef is dominant. Highest eligible card wins.' },
  { id: 'SUNBREAK', name: 'Sunbreak', rule: 'HIGH', dominant: 'SUN', second: null, description: 'Sun is dominant. Highest eligible card wins.' },
  { id: 'UNDERTOW', name: 'Undertow', rule: 'LOW', dominant: null, second: null, description: 'No dominant suit. Lowest card in the lead suit wins.' },
  { id: 'CROSSCURRENT', name: 'Crosscurrent', rule: 'SWITCH', dominant: 'WAVE', second: 'REEF', description: 'Wave dominates the first half; Reef the second. Follow the lead suit.' },
  { id: 'SHIFTING', name: 'Shifting Current', rule: 'SHIFT', dominant: null, second: null, description: 'The last winning card’s suit dominates the next trick. First trick: none.' },
];
export type Phase = 'DEALING' | 'TIDE_REVEAL' | 'FORECAST_REQUIRED' | 'FORECAST_REVEAL' | 'COMPASS_REQUIRED' | 'COMPASS_REVEAL' | 'TRICK_PLAY' | 'TRICK_RESOLUTION' | 'ROUND_SCORING' | 'MATCH_OVER';
export type Pacing = 'RELAXED' | 'STANDARD' | 'FAST';
export type Played = { player: string; card: Card };
export type Trick = { number: number; lead: string; current: string; cards: Played[]; dominant: Suit | null; winner: string | null };
export type Player = { id: string; name: string; connected: boolean; hand: Card[]; forecast: number | null; compassDecision: -1 | 0 | 1 | null; compassUsed: boolean; tricks: number; score: number; exactRounds: number };
export type RoundScore = { player: string; forecast: number; originalForecast: number; won: number; error: number; delta: number; total: number; compass: -1 | 0 | 1 };
export type RoundRecord = { round: number; handSize: number; dealer: string; tide: Tide; tricks: Trick[]; scores: RoundScore[] };
export type Action =
  | { type: 'LOCK_FORECAST'; round: number; value: number }
  | { type: 'LOCK_COMPASS'; round: number; adjustment: -1 | 0 | 1 }
  | { type: 'PLAY_CARD'; round: number; trick: number; card: string }
  | { type: 'ADVANCE'; round: number; phase: Phase }
  | { type: 'TIMEOUT' };
export type Game = { gameVersion: 1; revision: number; startSeed: number; random: number; pacing: Pacing; phase: Phase; round: number; dealerIndex: number; players: Player[]; deck: Card[]; tideOrder: Tide[]; tide: Tide; handSize: number; trick: Trick; completed: Trick[]; rounds: RoundRecord[]; originalForecasts: Record<string, number>; history: { round: number; text: string }[]; actionLog: { actor: string; action: Action }[]; winners: string[] };
export type PublicPlayer = Omit<Player, 'hand' | 'forecast' | 'compassDecision'> & { handCount: number; forecast: number | null; forecastLocked: boolean; compassLocked: boolean };
export type View = { gameVersion: 1; revision: number; phase: Phase; round: number; maxRounds: number; handSize: number; pacing: Pacing; dealer: string; players: PublicPlayer[]; tide: Tide | null; trick: Trick; completed: Trick[]; rounds: RoundRecord[]; history: Game['history']; balance: { available: number; forecast: number; difference: number } | null; self: { hand: Card[]; forecast: number | null; compassDecision: -1 | 0 | 1 | null; legalCards: string[] } | null; winners: string[] };
function need(ok: unknown, message: string): asserts ok { if (!ok) throw Error(message); }
export function createDeck(): Card[] { return suits.flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ id: `${suit}-${i+1}`, suit, rank: i+1 }))); }
function random(game: Pick<Game, 'random'>) { game.random = (game.random+0x6d2b79f5)>>>0; let value = game.random; value = Math.imul(value ^ value>>>15,value|1); value ^= value+Math.imul(value ^ value>>>7,value|61); return ((value ^ value>>>14)>>>0)/4294967296; }
function shuffle<T>(game: Pick<Game, 'random'>, items: T[]): T[] { const copy = [...items]; for (let i = copy.length-1; i > 0; i--) { const j = Math.floor(random(game) * (i+1)); [copy[i],copy[j]] = [copy[j]!,copy[i]!]; } return copy; }
function event(game: Game, text: string) { game.history.push({ round: game.round, text }); }
export function getDominant(tide: Tide, trick: number, handSize: number, previous: Suit | null): Suit | null { return tide.rule === 'SHIFT' ? previous : tide.rule === 'SWITCH' ? trick <= Math.ceil(handSize/2) ? tide.dominant : tide.second : tide.dominant; }
export function resolveTrick(cards: Played[], tide: Tide, dominant: Suit | null): Played {
  need(cards.length > 0, 'A trick needs a lead card.');
  const eligibleSuit = dominant && cards.some(p => p.card.suit === dominant) ? dominant : cards[0]!.card.suit;
  return cards.filter(p => p.card.suit === eligibleSuit).reduce((winner, item) => tide.rule === 'LOW' ? item.card.rank < winner.card.rank ? item : winner : item.card.rank > winner.card.rank ? item : winner);
}
export function getLegalCards(hand: Card[], played: Played[]): Card[] { const lead = played[0]?.card.suit; const matching = hand.filter(card => card.suit === lead); return matching.length ? matching : hand; }
export function canPlayCard(hand: Card[], played: Played[], card: string) { return getLegalCards(hand, played).some(item => item.id === card); }
export function calculateScore(forecast: number, won: number, scoring = config.scoring): number { return forecast === won ? scoring.exact + forecast * scoring.perTrick : -Math.abs(forecast-won) * scoring.miss; }
export function getWinners(players: Pick<Player,'id'|'score'|'exactRounds'>[]): string[] { const best = [...players].sort((a,b)=>b.score-a.score||b.exactRounds-a.exactRounds)[0]!; return players.filter(p=>p.score===best.score&&p.exactRounds===best.exactRounds).map(p=>p.id); }
// Hand-strength estimate uses only the owner's cards and the public Tide.
export function estimateForecast(hand: Card[], tide: Tide, players: number, handSize: number): number {
  const lengths = Object.fromEntries(suits.map(s => [s, hand.filter(c => c.suit === s).length]));
  const voids = suits.filter(s => !lengths[s]).length;
  const strength = hand.reduce((sum, c) => {
    const rank = tide.rule === 'LOW' ? 14-c.rank : c.rank;
    const dominant = tide.rule === 'SWITCH' ? c.suit === tide.dominant || c.suit === tide.second : c.suit === tide.dominant;
    const power = rank/13;
    const probability = dominant ? .12 + Math.pow(power, Math.max(1, players/3))*.65 + voids*.03 : Math.pow(power, Math.max(1.5, players-1))*.78;
    return sum + Math.min(.95, probability + Math.max(0, (lengths[c.suit] || 0)-2)*.025);
  }, 0);
  return Math.max(0, Math.min(handSize, Math.round(strength)));
}
function newTrick(game: Game, number: number, lead: string, previous: Suit | null) { game.trick = { number, lead, current: lead, cards: [], dominant: getDominant(game.tide, number, game.handSize, previous), winner: null }; }
function deal(game: Game) {
  game.handSize = config.handSizes[game.round-1]!;
  game.deck = shuffle(game, createDeck()); game.tide = game.tideOrder[game.round-1]!;
  game.players.forEach(p => { p.hand = []; p.forecast = null; p.compassDecision = null; p.tricks = 0; });
  for (let count = 0; count < game.handSize; count++) for (let offset = 1; offset <= game.players.length; offset++) game.players[(game.dealerIndex+offset)%game.players.length]!.hand.push(game.deck.pop()!);
  game.originalForecasts = {}; game.completed = [];
  newTrick(game, 1, game.players[(game.dealerIndex+1)%game.players.length]!.id, null);
  game.phase = 'DEALING'; event(game, `Round ${game.round}: ${game.handSize} cards dealt to each player.`);
}
export function createGame(seats: { id: string; name: string }[], seed = 1, pacing: Pacing = 'RELAXED'): Game {
  need(seats.length >= 3 && seats.length <= 6 && new Set(seats.map(p => p.id)).size === seats.length, 'Tidecall needs 3–6 distinct players.');
  const rng = { random: seed >>> 0 };
  const dealerIndex = Math.floor(random(rng)*seats.length);
  const order = [...shuffle(rng,tides), ...shuffle(rng,tides)].slice(0,config.handSizes.length);
  const game: Game = { gameVersion: 1, revision: 0, startSeed: seed, random: rng.random, pacing, phase: 'DEALING', round: 1, dealerIndex, players: seats.map(p => ({ ...p, connected: true, hand: [], forecast: null, compassDecision: null, compassUsed: false, tricks: 0, score: 0, exactRounds: 0 })), deck: [], tideOrder: order, tide: order[0]!, handSize: 3, trick: {} as Trick, completed: [], rounds: [], originalForecasts: {}, history: [], actionLog: [], winners: [] };
  deal(game); validateGame(game); return game;
}
function revealForecasts(game: Game) { game.originalForecasts = Object.fromEntries(game.players.map(p => [p.id,p.forecast!])); game.phase = 'FORECAST_REVEAL'; event(game, `Forecasts revealed together: ${game.players.map(p => `${p.name} ${p.forecast}`).join(' · ')}.`); }
function revealCompass(game: Game) {
  for (const p of game.players) { const adjustment = p.compassDecision || 0; if (adjustment) { p.forecast! += adjustment; p.compassUsed = true; event(game, `${p.name} used Compass: ${game.originalForecasts[p.id]} → ${p.forecast}.`); } }
  game.phase = 'COMPASS_REVEAL';
}
function scoreRound(game: Game) {
  const scores = game.players.map(p => { const error = Math.abs(p.forecast!-p.tricks); const delta = calculateScore(p.forecast!,p.tricks); p.score += delta; if (!error) p.exactRounds++; return { player: p.id, forecast: p.forecast!, originalForecast: game.originalForecasts[p.id]!, won: p.tricks, error, delta, total: p.score, compass: p.compassDecision || 0 } as RoundScore; });
  game.rounds.push({ round: game.round, handSize: game.handSize, dealer: game.players[game.dealerIndex]!.id, tide: game.tide, tricks: structuredClone(game.completed), scores });
  game.phase = 'ROUND_SCORING'; event(game, `Round ${game.round} scored. Exact: +${config.scoring.exact} + ${config.scoring.perTrick} per forecast trick; miss: −${config.scoring.miss} per trick apart.`);
}
function advance(game: Game) {
  switch (game.phase) {
    case 'DEALING': game.phase = 'TIDE_REVEAL'; event(game, `${game.tide.name}: ${game.tide.description}`); break;
    case 'TIDE_REVEAL': game.phase = 'FORECAST_REQUIRED'; break;
    case 'FORECAST_REVEAL': game.phase = 'COMPASS_REQUIRED'; game.players.forEach(p => { if (p.compassUsed) p.compassDecision = 0; }); if (game.players.every(p => p.compassDecision !== null)) revealCompass(game); break;
    case 'COMPASS_REVEAL': game.phase = 'TRICK_PLAY'; break;
    case 'TRICK_RESOLUTION': if (game.completed.length === game.handSize) scoreRound(game); else { const last = game.completed.at(-1)!; const winningSuit = last.cards.find(c => c.player === last.winner)!.card.suit; newTrick(game, last.number+1,last.winner!,winningSuit); game.phase = 'TRICK_PLAY'; } break;
    case 'ROUND_SCORING': if (game.round === config.handSizes.length) { game.winners = getWinners(game.players); game.phase = 'MATCH_OVER'; event(game, `Match complete. ${game.players.filter(p => game.winners.includes(p.id)).map(p => p.name).join(' & ')} won.`); } else { game.round++; game.dealerIndex = (game.dealerIndex+1)%game.players.length; deal(game); } break;
    default: throw Error('This phase is waiting for player decisions.');
  }
}
function play(game: Game, actor: string, cardId: string) {
  need(game.phase === 'TRICK_PLAY' && game.trick.current === actor, 'Wait for your card turn.');
  const p = game.players.find(p => p.id === actor)!;
  need(canPlayCard(p.hand,game.trick.cards,cardId), 'Play a card from your hand and follow the lead suit when possible.');
  const card = p.hand.splice(p.hand.findIndex(c => c.id === cardId),1)[0]!;
  game.trick.cards.push({ player: actor, card }); event(game, `${p.name} played ${card.suit} ${card.rank}.`);
  if (game.trick.cards.length === game.players.length) { const winner = resolveTrick(game.trick.cards,game.tide,game.trick.dominant).player; game.trick.winner = winner; game.players.find(p => p.id === winner)!.tricks++; game.completed.push(structuredClone(game.trick)); game.phase = 'TRICK_RESOLUTION'; event(game, `${game.players.find(p => p.id === winner)!.name} took trick ${game.trick.number}.`); }
  else game.trick.current = game.players[(game.players.findIndex(p => p.id === actor)+1)%game.players.length]!.id;
}
export function applyAction(original: Game, actor: string, action: Action): Game {
  need(original.phase !== 'MATCH_OVER', 'This match is over.');
  const game: Game = { ...structuredClone({ ...original, actionLog: [], history: [], rounds: [], completed: [], tideOrder: [] }), actionLog: [...original.actionLog], history: [...original.history], rounds: [...original.rounds], completed: [...original.completed], tideOrder: original.tideOrder };
  const player = game.players.find(p => p.id === actor);
  need(player || actor === '@system' && action.type === 'TIMEOUT', 'Unknown player.');
  if (action.type !== 'TIMEOUT') need(action.round === game.round, 'That decision belongs to a different round.');
  switch (action.type) {
    case 'LOCK_FORECAST': need(game.phase === 'FORECAST_REQUIRED' && player!.forecast === null, 'Your Forecast is already locked or the window closed.'); need(Number.isInteger(action.value) && action.value >= 0 && action.value <= game.handSize, 'Forecast must be between zero and your dealt hand size.'); player!.forecast = action.value; if (game.players.every(p => p.forecast !== null)) revealForecasts(game); break;
    case 'LOCK_COMPASS': need(game.phase === 'COMPASS_REQUIRED' && !player!.compassUsed && player!.compassDecision === null, 'Compass is unavailable or already locked.'); need([-1,0,1].includes(action.adjustment) && player!.forecast!+action.adjustment >= 0 && player!.forecast!+action.adjustment <= game.handSize, 'Compass adjusts by one within Forecast bounds.'); player!.compassDecision = action.adjustment; if (game.players.every(p => p.compassDecision !== null)) revealCompass(game); break;
    case 'PLAY_CARD': need(action.trick === game.trick.number, 'That card belongs to an earlier trick.'); play(game,actor,action.card); break;
    case 'ADVANCE': need(actor === game.players[game.dealerIndex]!.id && action.phase === game.phase, 'Only the current dealer can advance this presentation.'); advance(game); break;
    case 'TIMEOUT': need(actor === '@system', 'Only the server can apply timeouts.'); if (game.phase === 'FORECAST_REQUIRED') { game.players.forEach(p => { if (p.forecast === null) p.forecast = estimateForecast(p.hand,game.tide,game.players.length,game.handSize); }); revealForecasts(game); } else if (game.phase === 'COMPASS_REQUIRED') { game.players.forEach(p => { if (p.compassDecision === null) p.compassDecision = 0; }); revealCompass(game); } else if (game.phase === 'TRICK_PLAY') { const p = game.players.find(p => p.id === game.trick.current)!; const card = [...getLegalCards(p.hand,game.trick.cards)].sort((a,b) => a.rank-b.rank || suits.indexOf(a.suit)-suits.indexOf(b.suit))[0]!; play(game,p.id,card.id); } else advance(game); break;
    default: throw Error('Unknown Tidecall action.');
  }
  game.revision++; game.actionLog.push({ actor, action: structuredClone(action) }); validateGame(game); return game;
}
export function project(game: Game, viewer: string | null = null): View {
  const p = game.players.find(p => p.id === viewer);
  const forecastsRevealed = !['DEALING','TIDE_REVEAL','FORECAST_REQUIRED'].includes(game.phase);
  const compassRevealed = ['COMPASS_REVEAL','TRICK_PLAY','TRICK_RESOLUTION','ROUND_SCORING','MATCH_OVER'].includes(game.phase);
  return structuredClone({ gameVersion: 1, revision: game.revision, phase: game.phase, round: game.round, maxRounds: config.handSizes.length, handSize: game.handSize, pacing: game.pacing, dealer: game.players[game.dealerIndex]!.id, players: game.players.map(p => ({ id: p.id, name: p.name, connected: p.connected, tricks: p.tricks, score: p.score, exactRounds: p.exactRounds, handCount: p.hand.length, compassUsed: p.compassUsed, forecast: forecastsRevealed ? p.forecast : null, forecastLocked: p.forecast !== null, compassLocked: compassRevealed ? p.compassDecision !== null : false })), tide: game.phase === 'DEALING' ? null : game.tide, trick: game.phase === 'DEALING' ? { ...game.trick, dominant: null } : game.trick, completed: game.completed, rounds: game.rounds, history: game.history, balance: forecastsRevealed ? { available: game.handSize, forecast: game.players.reduce((n,p) => n+p.forecast!,0), difference: game.players.reduce((n,p) => n+p.forecast!,0)-game.handSize } : null, self: p ? { hand: p.hand, forecast: p.forecast, compassDecision: p.compassDecision, legalCards: game.phase === 'TRICK_PLAY' && game.trick.current === p.id ? getLegalCards(p.hand,game.trick.cards).map(c => c.id) : [] } : null, winners: game.winners } as View);
}
export function validateGame(game: Game) {
  need(game.gameVersion === 1 && game.players.length >= 3 && game.players.length <= 6, 'Invalid game version or seat count.');
  need(game.round >= 1 && game.round <= config.handSizes.length && game.handSize === config.handSizes[game.round-1], 'Invalid round.');
  const cards = [...game.deck,...game.players.flatMap(p => p.hand),...game.completed.flatMap(t => t.cards.map(p => p.card)),...(game.phase === 'TRICK_PLAY' ? game.trick.cards.map(p => p.card) : [])];
  need(cards.length === 52 && new Set(cards.map(c => c.id)).size === 52 && cards.every(c => suits.includes(c.suit) && c.rank >= 1 && c.rank <= 13 && c.id === `${c.suit}-${c.rank}`), 'Deck conservation failed.');
  need(new Set(game.players.map(p => p.id)).size === game.players.length && !!game.players[game.dealerIndex], 'Invalid identities or dealer.');
  need(game.players.reduce((n,p) => n+p.tricks,0) === game.completed.length, 'Trick count mismatch.');
  for (const p of game.players) { need(p.forecast === null || Number.isInteger(p.forecast) && p.forecast >= 0 && p.forecast <= game.handSize, 'Invalid Forecast.'); need(p.hand.length === game.handSize-game.completed.length-(game.phase === 'TRICK_PLAY' && game.trick.cards.some(c => c.player === p.id) ? 1 : 0), 'Invalid hand size.'); need(p.score === game.rounds.reduce((n,r) => n+r.scores.find(s => s.player === p.id)!.delta,0), 'Invalid cumulative score.'); }
  for (const trick of game.completed) need(trick.cards.length === game.players.length && new Set(trick.cards.map(c => c.player)).size === game.players.length && resolveTrick(trick.cards,game.tide,trick.dominant).player === trick.winner, 'Invalid completed trick.');
  need(new Set(game.trick.cards.map(c => c.player)).size === game.trick.cards.length && game.trick.cards.length <= game.players.length && game.players.some(p => p.id === game.trick.current), 'Invalid pending trick.');
  need(game.phase !== 'MATCH_OVER' || game.winners.length > 0, 'Match requires a winner.');
}
export function serializeGame(game: Game) { return JSON.stringify(game); }
export function restoreGame(text: string): Game { const game = JSON.parse(text) as Game; validateGame(game); return game; }
export function replayGame(game: Game) { let result = createGame(game.players.map(({id,name}) => ({id,name})),game.startSeed,game.pacing); for (const item of game.actionLog) result = applyAction(result,item.actor,item.action); return result; }
