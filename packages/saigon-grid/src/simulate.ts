import { applyAction, board, createGame, districts, economy, ownsDistrict, project, validateGame, type Action, type Game, type View } from './index.js';

export function nextBotAction(game: View, actor: string, actionsThisTurn = 0): Action | null {
  const self = game.players.find(p => p.id === actor)!;
  if (self.eliminated) return null;
  if (game.trade?.to === actor && game.phase !== 'AUCTION') {
    const trade = game.trade;
    const proposer = game.players.find(p => p.id === trade.from)!;
    if (proposer.credits < trade.give.credits || self.credits < trade.receive.credits || trade.give.assets.some(id => game.holdings.find(h => h.space === id)?.owner !== trade.from) || trade.receive.assets.some(id => game.holdings.find(h => h.space === id)?.owner !== actor)) return { type: 'REJECT_TRADE', trade: trade.id };
    const receives = trade.give.credits + trade.give.assets.reduce((n, id) => n + board[id]!.price!, 0);
    const gives = trade.receive.credits + trade.receive.assets.reduce((n, id) => n + board[id]!.price!, 0);
    return receives >= gives * 1.05 ? { type: 'ACCEPT_TRADE', trade: trade.id, revision: trade.revision } : { type: 'REJECT_TRADE', trade: trade.id };
  }
  if (game.phase === 'AUCTION') {
    const auction = game.auction!;
    if (!auction.active.includes(actor) || auction.leader === actor) return null;
    const space = board[auction.asset]!;
    const strategic = space.district && game.holdings.filter(h => board[h.space]?.district === space.district && h.owner === actor).length;
    const ceiling = Math.min(self.credits - 100, Math.round(space.price! * (strategic ? 1.2 : .85)));
    if (auction.minimum <= ceiling) return { type: 'BID', amount: Math.min(ceiling, Math.max(auction.minimum, auction.bid + 25)), revision: auction.revision };
    return { type: 'WITHDRAW', revision: auction.revision };
  }
  if (game.phase === 'DEBT_RESOLUTION' && game.debt?.debtor === actor) {
    const developed = game.holdings.filter(h => h.owner === actor && h.development).sort((a,b) => a.development - b.development);
    if (developed.length) return { type: 'SELL_DEVELOPMENT', asset: developed.at(-1)!.space };
    const loan = game.holdings.filter(h => h.owner === actor && !h.loan).sort((a,b) => board[b.space]!.price! - board[a.space]!.price!)[0];
    if (loan) return { type: 'TAKE_LOAN', asset: loan.space };
    return { type: 'DECLARE_INSOLVENT' };
  }
  if (game.active !== actor) return null;
  if (game.phase === 'ROLL_REQUIRED') return self.reviewTurns && (self.reviewPasses || self.credits > 300) ? self.reviewPasses ? { type: 'USE_REVIEW_PASS' } : { type: 'PAY_REVIEW' } : { type: 'ROLL' };
  if (game.phase === 'PURCHASE_DECISION') { const space = board[game.pendingAsset!]!; const peers = game.holdings.filter(h => board[h.space]?.district === space.district && h.owner === actor).length; return self.credits >= space.price! + (peers ? 60 : 120) ? { type: 'PURCHASE' } : { type: 'DECLINE' }; }
  if (game.phase !== 'MAIN_ACTION') return null;
  if (actionsThisTurn < 2) {
    const candidate = game.holdings.find(h => h.owner === actor && board[h.space]?.district && ownsDistrict(game, actor, board[h.space]!.district!) && h.development < 4 && (h.development === 3 ? game.landmarkSupply > 0 : game.developmentSupply > 0) && game.holdings.filter(other => board[other.space]?.district === board[h.space]!.district).every(other => !other.loan) && h.development === Math.min(...game.holdings.filter(other => board[other.space]?.district === board[h.space]!.district).map(other => other.development)) && self.credits > economy.developmentCost[board[h.space]!.district!]! + 120);
    if (candidate) return { type: 'DEVELOP', asset: candidate.space };
  }
  if (game.trade?.from === actor) return { type: 'END_TURN' };
  if (actionsThisTurn < 1 && !game.trade) {
    const wanted = game.holdings.find(h => h.owner && h.owner !== actor && board[h.space]?.district && game.holdings.filter(other => board[other.space]?.district === board[h.space]!.district && other.owner === actor).length >= 1 && h.development === 0);
    if (wanted && self.credits > Math.round(board[wanted.space]!.price! * 1.45) + 100) return { type: 'PROPOSE_TRADE', to: wanted.owner!, give: { credits: Math.round(board[wanted.space]!.price! * 1.3), assets: [] }, receive: { credits: 0, assets: [wanted.space] } };
  }
  return { type: 'END_TURN' };
}

export function simulate(seed: number, count = 4, maxActions = 20000) {
  const started = performance.now();
  let game: Game = createGame(Array.from({ length: count }, (_, i) => ({ id: `bot${i}`, name: `Bot ${i + 1}` })), seed);
  let actions = 0, auctions = 0, trades = 0, bankruptcies = 0, developments = 0, actionsThisTurn = 0, lastTurn = 0;
  let cashSamples = 0, cashTotal = 0, insolvencyTurnTotal = 0;
  const completedDistricts = new Set<string>();
  while (game.phase !== 'GAME_OVER' && actions < maxActions) {
    if (game.turn !== lastTurn) { lastTurn = game.turn; actionsThisTurn = 0; }
    const actor = game.phase === 'AUCTION' ? game.auction!.active.find(id => id !== game.auction!.leader)! : game.active;
    const action = nextBotAction(project(game), actor, actionsThisTurn);
    if (!action) throw Error(`Seed ${seed}, revision ${game.revision}, phase ${game.phase}: bot could not act.`);
    try { game = applyAction(game, actor, action); validateGame(game); }
    catch (error) { throw Error(`Seed ${seed}, revision ${game.revision}, phase ${game.phase}, active ${game.active}, ${actor}, players ${JSON.stringify(game.players.map(p => ({ id:p.id, credits:p.credits, eliminated:p.eliminated })))}, position ${game.players.find(p => p.id === actor)?.position}, ${JSON.stringify(action)}: ${(error as Error).message}`); }
    auctions += action.type === 'DECLINE' ? 1 : 0;
    trades += action.type === 'ACCEPT_TRADE' ? 1 : 0;
    bankruptcies += action.type === 'DECLARE_INSOLVENT' ? 1 : 0;
    developments += action.type === 'DEVELOP' ? 1 : 0;
    if (['DEVELOP','PROPOSE_TRADE'].includes(action.type)) actionsThisTurn++;
    if (action.type === 'DECLARE_INSOLVENT') insolvencyTurnTotal += game.turn;
    for (const p of game.players) for (const district of districts) if (ownsDistrict(game, p.id, district)) completedDistricts.add(`${p.id}:${district}`);
    if (game.turn !== lastTurn) { const activePlayers = game.players.filter(p => !p.eliminated); cashTotal += activePlayers.reduce((sum,p) => sum + p.credits, 0) / activePlayers.length; cashSamples++; }
    actions++;
  }
  if (game.phase !== 'GAME_OVER') throw Error(`Seed ${seed}: no winner after ${actions} actions and ${game.turn} turns. ${game.players.map(p => `${p.name}: ${p.credits} Credits, ${game.holdings.filter(h => h.owner === p.id).length} Holdings, ${game.holdings.filter(h => h.owner === p.id).reduce((n,h) => n + h.development, 0)} Developments, ${p.eliminated ? 'out' : 'active'}`).join('; ')}`);
  const purchases = game.ledger.filter(entry => entry.reason === 'HOLDING_PURCHASE' || entry.reason === 'AUCTION_PURCHASE');
  const auctionPurchases = purchases.filter(entry => entry.reason === 'AUCTION_PURCHASE');
  const usageFees = game.ledger.filter(entry => entry.reason === 'USAGE_FEE');
  return { seed, actions, turns: game.turn, auctions, trades, bankruptcies, acquisitions: purchases.length, developments, winner: game.winner,
    districtCompletions: completedDistricts.size, averageCash: Math.round(cashTotal / Math.max(1,cashSamples)), auctionValuePercent: auctionPurchases.length ? Math.round(100 * auctionPurchases.reduce((sum,entry) => sum + entry.amount / board[entry.asset!]!.price!, 0) / auctionPurchases.length) : 0,
    usageFeeTotal: usageFees.reduce((sum,entry) => sum + entry.amount, 0), averageInsolvencyTurn: bankruptcies ? Math.round(insolvencyTurnTotal / bankruptcies) : 0, durationMs: Math.round(performance.now() - started),
    acquisitionByAsset: Object.fromEntries(board.filter(space => space.price).map(space => [space.name, purchases.filter(entry => entry.asset === space.id).length])),
  };
}

if (process.argv[1]?.endsWith('simulate.ts')) {
  const games = Number(process.argv[process.argv.indexOf('--games') + 1]) || 100;
  const players = Number(process.argv[process.argv.indexOf('--players') + 1]) || 4;
  const seed = Number(process.argv[process.argv.indexOf('--seed') + 1]) || 1;
  const results = Array.from({ length: games }, (_, i) => simulate(seed + i, players));
  const average = (key: 'turns' | 'auctions' | 'trades' | 'bankruptcies' | 'acquisitions' | 'developments') => Math.round(results.reduce((sum,r) => sum + r[key], 0) / results.length);
  console.log(`Saigon Grid: ${games}/${games} complete\nAverage turns ${average('turns')} · auctions ${average('auctions')} · trades ${average('trades')} · insolvencies ${average('bankruptcies')} · acquisitions ${average('acquisitions')} · Developments ${average('developments')}`);
}
