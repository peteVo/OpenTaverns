import { applyAction, createGame, project, tides, validateGame, type Game, type Phase } from './index.js';
import { nextBotAction } from './simulate.js';
export const scenarioNames = ['DEALING_TEST','TIDE_REVEAL_TEST','FORECAST_TEST','FORECAST_LOCKED','FORECAST_REVEAL','COMPASS_TEST','COMPASS_LOCKED','COMPASS_REVEAL','NORMAL_TRICK','PARTIAL_TRICK','FOLLOW_SUIT_TEST','DOMINANT_SUIT_TEST','UNDERTOW_TEST','CROSSCURRENT_SWITCH','SHIFTING_TEST','FINAL_TRICK','TRICK_RESOLUTION','ROUND_SCORE','MATCH_OVER','RECONNECT_WITH_HAND','SIX_PLAYER_TRICK','SEVEN_CARD_HAND','FINAL_ROUND','VOID_IN_LEAD_SUIT'] as const;
export function createScenario(name: typeof scenarioNames[number], seats: {id: string; name: string}[], seed = 42): Game {
  let game = createGame(seats,seed);
  game.dealerIndex = game.players.length-1; game.trick.lead = seats[0]!.id; game.trick.current = seats[0]!.id;
  const tideId = name === 'UNDERTOW_TEST' ? 'UNDERTOW' : name === 'CROSSCURRENT_SWITCH' ? 'CROSSCURRENT' : name === 'SHIFTING_TEST' ? 'SHIFTING' : name === 'DOMINANT_SUIT_TEST' ? 'HIGH' : 'CALM';
  game.tide = tides.find(t => t.id === tideId)!; game.tideOrder[0] = game.tide; game.trick.dominant = game.tide.dominant;
  const targets: Partial<Record<typeof name,Phase>> = { DEALING_TEST: 'DEALING', TIDE_REVEAL_TEST: 'TIDE_REVEAL', FORECAST_TEST: 'FORECAST_REQUIRED', FORECAST_LOCKED: 'FORECAST_REQUIRED', FORECAST_REVEAL: 'FORECAST_REVEAL', COMPASS_TEST: 'COMPASS_REQUIRED', COMPASS_LOCKED: 'COMPASS_REQUIRED', COMPASS_REVEAL: 'COMPASS_REVEAL', TRICK_RESOLUTION: 'TRICK_RESOLUTION', ROUND_SCORE: 'ROUND_SCORING', MATCH_OVER: 'MATCH_OVER' };
  const target = targets[name] || 'TRICK_PLAY';
  const targetRound = name === 'SEVEN_CARD_HAND' ? 5 : name === 'FINAL_ROUND' ? 10 : 1;
  let steps = 0;
  while ((game.phase !== target || game.round < targetRound) && steps++ < 1000) { const choice = game.players.map(p => ({actor:p.id,action:nextBotAction(project(game,p.id),p.id)})).find(c => c.action); if (!choice?.action) throw Error('Scenario deadlock.'); game = applyAction(game,choice.actor,choice.action); }
  if (name === 'FORECAST_LOCKED') game = applyAction(game,seats[0]!.id,{type:'LOCK_FORECAST',round:game.round,value:1});
  if (name === 'COMPASS_LOCKED') game = applyAction(game,seats[0]!.id,{type:'LOCK_COMPASS',round:game.round,adjustment:0});
  if (['FINAL_TRICK','CROSSCURRENT_SWITCH'].includes(name)) { const number = name === 'FINAL_TRICK' ? game.handSize : Math.ceil(game.handSize/2)+1; while (game.trick.number < number || game.phase !== 'TRICK_PLAY') { const choice = game.players.map(p => ({actor:p.id,action:nextBotAction(project(game,p.id),p.id)})).find(c => c.action)!; game = applyAction(game,choice.actor,choice.action!); } }
  if (['PARTIAL_TRICK','FOLLOW_SUIT_TEST'].includes(name)) { const actor = game.trick.current; game = applyAction(game,actor,nextBotAction(project(game,actor),actor)!); }
  if (name === 'SIX_PLAYER_TRICK') while (game.phase === 'TRICK_PLAY') { const actor=game.trick.current; game=applyAction(game,actor,nextBotAction(project(game,actor),actor)!); }
  if (name === 'VOID_IN_LEAD_SUIT') {
    const host=game.players[0]!;
    const suit=game.deck.find(c=>!host.hand.some(h=>h.suit===c.suit))!.suit;
    const index=game.deck.findIndex(c=>c.suit===suit);
    const lead=game.players[1]!; [lead.hand[0],game.deck[index]]=[game.deck[index]!,lead.hand[0]!];
    game.dealerIndex=0;game.trick.lead=lead.id;game.trick.current=lead.id;
    game=applyAction(game,lead.id,{type:'PLAY_CARD',round:game.round,trick:game.trick.number,card:lead.hand[0]!.id});
    while(game.trick.current!==host.id) {const actor=game.trick.current;game=applyAction(game,actor,nextBotAction(project(game,actor),actor)!);}
  }
  validateGame(game); return game;
}
