import { describe, expect, it } from 'vitest';
import { applyAction, board, calculateUsageFee, cityEvents, civicEvents, createGame, economy, ownsDistrict, project, validateGame, type Game } from './index.js';
import { createScenario, scenarioNames } from './scenarios.js';

const seats = [{ id: 'a', name: 'An' }, { id: 'b', name: 'Bình' }];
const fresh = () => createGame(seats, 42);
function decision(asset = 1) { const game = fresh(); game.phase = 'PURCHASE_DECISION'; game.pendingAsset = asset; return game; }
function action(game: Game, actor: string, value: Parameters<typeof applyAction>[2]) { return applyAction(game, actor, value); }

describe('Saigon Grid board and money', () => {
  it('has an original 28-stop circuit with verified proper names and two Companies', () => {
    expect(board).toHaveLength(28);
    expect(board.map(s => s.name)).toContain('Bến Xe Miền Đông');
    expect(board.map(s => s.name)).toContain('Bến Xe Miền Tây');
    expect(board.filter(s => s.kind === 'company').map(s => s.name)).toEqual(['Water', 'Electricity']);
    expect(new Set(board.map(s => s.id)).size).toBe(28);
  });
  it('uses the same seeded dice and pays Central Exchange on wrap', () => {
    const first = fresh(); first.players[0]!.position = 27;
    const second = structuredClone(first);
    const a = action(first, 'a', { type: 'ROLL' });
    const b = action(second, 'a', { type: 'ROLL' });
    expect(a.dice).toEqual(b.dice);
    expect(a.players[0]!.position).toBe(b.players[0]!.position);
    expect(a.ledger.some(entry => entry.reason === 'CENTRAL_EXCHANGE' && entry.recipient === 'a' && entry.amount === economy.exchangePayout)).toBe(true);
  });
  it('buys an unowned street with integer Credits', () => {
    const game = action(decision(), 'a', { type: 'PURCHASE' });
    expect(game.holdings.find(h => h.space === 1)?.owner).toBe('a');
    expect(game.players[0]!.credits).toBe(economy.startingCredits - board[1]!.price!);
    expect(game.ledger.at(-1)?.reason).toBe('HOLDING_PURCHASE');
  });
  it('rejects a purchase without enough Credits', () => {
    const game = decision(); game.players[0]!.credits = 0;
    expect(() => action(game, 'a', { type: 'PURCHASE' })).toThrow('Not enough Credits');
  });
  it('declining starts an auction; the only remaining bidder wins', () => {
    let game = action(decision(), 'a', { type: 'DECLINE' });
    expect(game.phase).toBe('AUCTION');
    expect(game.auction?.eligible).toEqual(['a','b']);
    game = action(game, 'b', { type: 'BID', amount: 40, revision: game.auction!.revision });
    expect(() => action(game, 'a', { type: 'BID', amount: 50, revision: 0 })).toThrow('Auction changed');
    game = action(game, 'a', { type: 'WITHDRAW', revision: game.auction!.revision });
    expect(game.holdings.find(h => h.space === 1)?.owner).toBe('b');
    expect(game.players[1]!.credits).toBe(economy.startingCredits - 40);
    expect(game.phase).toBe('MAIN_ACTION');
  });
  it('all bidders may withdraw; the Holding remains unowned', () => {
    let game = action(decision(), 'a', { type: 'DECLINE' });
    game = action(game, 'a', { type: 'WITHDRAW', revision: 0 });
    game = action(game, 'b', { type: 'WITHDRAW', revision: 1 });
    expect(game.auction).toBeNull();
    expect(game.holdings.find(h => h.space === 1)?.owner).toBeNull();
  });
  it('rejects bids above cash and duplicate buy decisions', () => {
    const game = action(decision(), 'a', { type: 'DECLINE' });
    expect(() => action(game, 'b', { type: 'BID', amount: 999999, revision: 0 })).toThrow('Bid exceeds');
    expect(() => action(game, 'a', { type: 'PURCHASE' })).toThrow('No Holding');
  });
});

describe('portfolios and obligations', () => {
  it('calculates base, complete District, Development, Landmark, and loan fees centrally', () => {
    const game = fresh();
    for (const id of [1,3,5]) game.holdings.find(h => h.space === id)!.owner = 'a';
    expect(ownsDistrict(game,'a','Central Core')).toBe(true);
    expect(calculateUsageFee(game,1).amount).toBe(board[1]!.baseFee! * 2);
    game.holdings.find(h => h.space === 1)!.development = 1;
    expect(calculateUsageFee(game,1).amount).toBe(board[1]!.baseFee! * economy.feeMultipliers[1]);
    game.holdings.find(h => h.space === 1)!.development = 4;
    expect(calculateUsageFee(game,1).amount).toBe(board[1]!.baseFee! * economy.feeMultipliers[4]);
    game.holdings.find(h => h.space === 1)!.development = 0;
    game.holdings.find(h => h.space === 1)!.loan = true;
    expect(calculateUsageFee(game,1).amount).toBe(0);
  });
  it('scales Transit Hubs and Companies using the dice', () => {
    const game = fresh();
    for (const id of [9,24,4,16]) game.holdings.find(h => h.space === id)!.owner = 'a';
    game.dice = [3,4];
    expect(calculateUsageFee(game,9).amount).toBe(economy.hubFees[1]);
    expect(calculateUsageFee(game,4).amount).toBe(7 * economy.companyMultipliers[1]);
  });
  it('enforces complete District ownership, even building, and finite supply', () => {
    let game = fresh(); game.phase = 'MAIN_ACTION'; game.holdings.find(h => h.space === 1)!.owner = 'a';
    expect(() => action(game,'a',{ type:'DEVELOP',asset:1 })).toThrow('Control the whole District');
    for (const id of [1,3,5]) game.holdings.find(h => h.space === id)!.owner = 'a';
    game = action(game,'a',{ type:'DEVELOP',asset:1 });
    expect(game.developmentSupply).toBe(economy.developments - 1);
    expect(() => action(game,'a',{ type:'DEVELOP',asset:1 })).toThrow('evenly');
    game = action(game,'a',{ type:'DEVELOP',asset:3 });
    game = action(game,'a',{ type:'DEVELOP',asset:5 });
    expect(() => action(game,'a',{ type:'SELL_DEVELOPMENT',asset:1 })).not.toThrow();
    validateGame(game);
  });
  it('takes and repays a Secured Loan, with the premium charged', () => {
    let game = fresh(); game.phase = 'MAIN_ACTION'; game.holdings.find(h => h.space === 1)!.owner = 'a';
    game = action(game,'a',{ type:'TAKE_LOAN',asset:1 });
    expect(game.holdings.find(h => h.space === 1)?.loan).toBe(true);
    expect(game.players[0]!.credits).toBe(900 + 90);
    game = action(game,'a',{ type:'REPAY_LOAN',asset:1 });
    expect(game.players[0]!.credits).toBe(900 + 90 - 99);
    expect(game.holdings.find(h => h.space === 1)?.loan).toBe(false);
  });
  it('keeps loans inside the owner’s turn', () => {
    const game = fresh(); game.phase = 'MAIN_ACTION'; game.holdings.find(h => h.space === 3)!.owner = 'b';
    expect(() => action(game,'b',{ type:'TAKE_LOAN',asset:3 })).toThrow('only on your turn');
  });
  it('transfers a trade atomically and rejects a stale Holding', () => {
    let game = fresh(); game.phase = 'MAIN_ACTION'; game.holdings.find(h => h.space === 1)!.owner = 'a'; game.holdings.find(h => h.space === 3)!.owner = 'b';
    game = action(game,'a',{ type:'PROPOSE_TRADE',to:'b',give:{credits:20,assets:[1]},receive:{credits:0,assets:[3]} });
    const accepted = action(game,'b',{ type:'ACCEPT_TRADE',trade:game.trade!.id,revision:game.trade!.revision });
    expect(accepted.holdings.find(h => h.space === 1)?.owner).toBe('b');
    expect(accepted.holdings.find(h => h.space === 3)?.owner).toBe('a');
    expect(accepted.players[0]!.credits).toBe(880);
    const changed = structuredClone(game); changed.holdings.find(h => h.space === 1)!.owner = 'b';
    expect(() => action(changed,'b',{ type:'ACCEPT_TRADE',trade:changed.trade!.id,revision:changed.trade!.revision })).toThrow('changed hands');
  });
  it('blocks trade acceptance while bids are reserved', () => {
    let game = fresh(); game.phase = 'MAIN_ACTION';
    game = action(game,'a',{ type:'PROPOSE_TRADE',to:'b',give:{credits:100,assets:[]},receive:{credits:0,assets:[]} });
    game.phase = 'AUCTION'; game.auction = { asset:1,eligible:['a','b'],active:['a','b'],withdrawn:[],bid:100,leader:'a',minimum:110,revision:1 };
    expect(() => action(game,'b',{ type:'ACCEPT_TRADE',trade:game.trade!.id,revision:game.trade!.revision })).toThrow('Finish the auction');
  });
  it('resolves debt through a loan, then eliminates an insolvent player', () => {
    let game = fresh(); game.phase = 'DEBT_RESOLUTION'; game.debt = { debtor:'a',creditor:'b',amount:80,reason:'USAGE_FEE' }; game.players[0]!.credits = 0; game.holdings.find(h => h.space === 1)!.owner = 'a';
    game = action(game,'a',{ type:'TAKE_LOAN',asset:1 });
    expect(game.debt).toBeNull(); expect(game.phase).toBe('MAIN_ACTION'); expect(game.players[1]!.credits).toBe(980);
    game.phase = 'DEBT_RESOLUTION'; game.debt = { debtor:'a',creditor:'b',amount:400,reason:'USAGE_FEE' };
    game = action(game,'a',{ type:'DECLARE_INSOLVENT' });
    expect(game.players[0]!.eliminated).toBe(true);
    expect(game.holdings.find(h => h.space === 1)?.owner).toBe('b');
    expect(game.winner).toBe('b');
    expect(game.phase).toBe('GAME_OVER');
  });
  it('round trips versioned state with auction, trade, debt, decks, and RNG', () => {
    const game = fresh(); game.auction = { asset:1,eligible:['a','b'],active:['a','b'],withdrawn:[],bid:0,leader:null,minimum:10,revision:0 }; game.trade = { id:1,from:'a',to:'b',give:{credits:10,assets:[]},receive:{credits:0,assets:[]},revision:2 }; game.debt = { debtor:'a',creditor:null,amount:5,reason:'FEE' }; game.cityDeck = ['night-market']; game.civicDeck = ['grant'];
    expect(JSON.parse(JSON.stringify(game))).toEqual(game);
    expect(game.gameVersion).toBe(1);
    expect(project(game)).not.toHaveProperty('rng');
    expect(project(game)).not.toHaveProperty('cityDeck');
  });
  it('keeps every event effect structured rather than text-parsed', () => {
    expect([...cityEvents,...civicEvents].every(card => card.effect.type && card.title && card.text)).toBe(true);
    expect(new Set([...cityEvents,...civicEvents].map(card => card.id)).size).toBe(cityEvents.length + civicEvents.length);
  });
  it('resolves every City and Civic Event effect from its structured card', () => {
    const roll = action(fresh(),'a',{ type:'ROLL' }).dice!;
    for (const card of [...cityEvents,...civicEvents]) {
      const city = cityEvents.includes(card);
      const stop = city ? 2 : 6;
      const game = fresh(); game.players[0]!.position = (stop - roll[0] - roll[1] + 28) % 28;
      if (city) game.cityDeck = [card.id]; else game.civicDeck = [card.id];
      if (card.effect.type === 'REPAIRS') { game.holdings.find(h => h.space === 1)!.owner = 'a'; game.holdings.find(h => h.space === 1)!.development = 1; game.developmentSupply--; }
      const result = action(game,'a',{ type:'ROLL' });
      expect(result.lastEvent?.id).toBe(card.id);
      if (card.effect.type === 'CREDITS') { const amount = Math.abs(card.effect.amount); expect(result.ledger.some(entry => entry.amount === amount && entry.reason.endsWith('_EVENT'))).toBe(true); }
      if (card.effect.type === 'MOVE') expect(result.players[0]!.position).toBe(card.effect.to);
      if (card.effect.type === 'REVIEW') expect(result.players[0]).toMatchObject({ position:7, reviewTurns:1 });
      if (card.effect.type === 'PASS') expect(result.players[0]!.reviewPasses).toBe(1);
      if (card.effect.type === 'REPAIRS') { const amount = card.effect.perDevelopment; expect(result.ledger.some(entry => entry.reason === 'CITY_EVENT' && entry.amount === amount)).toBe(true); }
    }
  });
  it('lets a player pay to leave Review and returns assets to Treasury on Insolvency', () => {
    let game = createScenario('REVIEW_TEST',seats,42);
    game = action(game,'a',{ type:'PAY_REVIEW' });
    expect(game.players[0]!.reviewTurns).toBe(0);
    game.phase = 'DEBT_RESOLUTION'; game.players[0]!.credits = 0;
    game.debt = { debtor:'a',creditor:null,amount:500,reason:'FEE' };
    game.holdings.find(h => h.space === 1)!.owner = 'a'; game.holdings.find(h => h.space === 1)!.loan = true;
    game = action(game,'a',{ type:'DECLARE_INSOLVENT' });
    expect(game.holdings.find(h => h.space === 1)).toMatchObject({ owner:null, loan:false });
    expect(game.phase).toBe('GAME_OVER');
  });
  it('ships valid developer scenarios for auction, trade, development, Review, debt, and late play', () => {
    for (const name of scenarioNames) expect(() => validateGame(createScenario(name, seats, 7))).not.toThrow();
  });
});
