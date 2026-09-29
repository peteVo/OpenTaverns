import { createGame, validateGame, type Game } from './index.js';

export const scenarioNames = ['AUCTION_TEST', 'TRADE_TEST', 'FULL_DISTRICT_TEST', 'DEVELOPMENT_TEST', 'REVIEW_TEST', 'DEBT_TEST', 'INSOLVENCY_TEST', 'LATE_GAME_TEST'] as const;
export type ScenarioName = typeof scenarioNames[number];

/** Development-only fixtures. Never expose this entry point from a production route. */
export function createScenario(name: ScenarioName, seats: { id: string; name: string }[], seed = 1): Game {
  const game = createGame(seats, seed);
  const [first, second] = seats;
  const own = (asset: number, owner = first!.id) => { game.holdings.find(h => h.space === asset)!.owner = owner; };
  if (name === 'AUCTION_TEST') {
    game.phase = 'AUCTION';
    game.auction = { asset: 1, eligible: seats.map(s => s.id), active: seats.map(s => s.id), withdrawn: [], bid: 0, leader: null, minimum: 10, revision: 0 };
  } else if (name === 'TRADE_TEST') {
    game.phase = 'MAIN_ACTION'; own(1); own(3, second!.id);
    game.trade = { id: game.nextTradeId++, from: first!.id, to: second!.id, give: { credits: 40, assets: [1] }, receive: { credits: 0, assets: [3] }, revision: 1 };
  } else if (name === 'FULL_DISTRICT_TEST' || name === 'DEVELOPMENT_TEST') {
    game.phase = 'MAIN_ACTION'; for (const asset of [1,3,5]) own(asset);
    if (name === 'DEVELOPMENT_TEST') { for (const asset of [1,3,5]) game.holdings.find(h => h.space === asset)!.development = 1; game.developmentSupply -= 3; }
  } else if (name === 'REVIEW_TEST') {
    game.players[0]!.position = 7; game.players[0]!.reviewTurns = 1;
  } else if (name === 'DEBT_TEST' || name === 'INSOLVENCY_TEST') {
    game.phase = 'DEBT_RESOLUTION'; game.players[0]!.credits = 0;
    game.debt = { debtor: first!.id, creditor: name === 'DEBT_TEST' ? null : second!.id, amount: name === 'DEBT_TEST' ? 80 : 500, reason: 'USAGE_FEE' };
    if (name === 'DEBT_TEST') own(1);
    else { own(1); own(3, second!.id); own(5, second!.id); }
  } else if (name === 'LATE_GAME_TEST') {
    game.phase = 'MAIN_ACTION'; for (const asset of [1,3,5,8,10,12,9,4]) own(asset); for (const asset of [15,17,19,16,24]) own(asset, second!.id);
    for (const asset of [1,3,5]) game.holdings.find(h => h.space === asset)!.development = 2;
    game.developmentSupply -= 6;
    game.players[0]!.credits = 1100; game.players[1]!.credits = 900;
  }
  validateGame(game);
  return game;
}
