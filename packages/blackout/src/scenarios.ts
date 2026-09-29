import { applyAction, createGame, validateGame, type Game } from './index.js';
import { balance } from './data.js';

export const scenarioNames = ['ROLE_REVEAL_TEST', 'INCIDENT_TEST', 'BRIEFING_TEST', 'ASSIGNMENT_TEST', 'SECRET_ACTION_OPERATOR', 'SECRET_ACTION_DISRUPTOR', 'WAITING_TEST', 'RESOLUTION_TEST', 'AUDIT_TEST', 'POWER_CRITICAL', 'SYSTEM_OFFLINE', 'TWO_SYSTEMS_NEAR_OFFLINE', 'FINAL_ROUND', 'OPERATOR_WIN', 'DISRUPTOR_WIN', 'RECONNECT_SECRET_ACTION'] as const;
export type ScenarioName = typeof scenarioNames[number];
/** Development-only fixtures; never expose through a production route. */
export function createScenario(name: ScenarioName, seats: { id: string; name: string }[], seed = 1): Game {
  let game = createGame(seats, seed);
  if (name === 'SECRET_ACTION_OPERATOR' || name === 'SECRET_ACTION_DISRUPTOR') {
    const desired = name === 'SECRET_ACTION_OPERATOR' ? 'OPERATOR' : 'DISRUPTOR';
    if (game.players[0]!.faction !== desired) { const other = game.players.find(player => player.faction === desired)!; other.faction = game.players[0]!.faction; game.players[0]!.faction = desired; }
  }
  const timed = () => { game = applyAction(game, '@system', { type: 'TIMEOUT' }); };
  if (name !== 'ROLE_REVEAL_TEST') timed();
  if (!['ROLE_REVEAL_TEST','INCIDENT_TEST'].includes(name)) timed();
  if (!['ROLE_REVEAL_TEST','INCIDENT_TEST','BRIEFING_TEST'].includes(name)) timed();
  if (['SECRET_ACTION_OPERATOR', 'SECRET_ACTION_DISRUPTOR', 'WAITING_TEST', 'RECONNECT_SECRET_ACTION', 'RESOLUTION_TEST', 'AUDIT_TEST', 'POWER_CRITICAL', 'SYSTEM_OFFLINE', 'TWO_SYSTEMS_NEAR_OFFLINE'].includes(name)) timed();
  if (name === 'WAITING_TEST') game.orders.find(order => order.responders.includes(seats[0]!.id))!.locked[seats[0]!.id] = 'STABILIZE';
  if (name === 'RESOLUTION_TEST' || name === 'AUDIT_TEST') timed();
  if (name === 'AUDIT_TEST') { game.insight = 2; timed(); }
  if (name === 'POWER_CRITICAL' || name === 'TWO_SYSTEMS_NEAR_OFFLINE') game.stability.POWER = 1;
  if (name === 'SYSTEM_OFFLINE') game.stability.POWER = 0;
  if (name === 'TWO_SYSTEMS_NEAR_OFFLINE') game.stability.WATER = 1;
  if (name === 'FINAL_ROUND' || name === 'OPERATOR_WIN') {
    while (game.round < 8 && game.phase !== 'GAME_OVER') timed();
    if (name === 'OPERATOR_WIN') while (game.phase !== 'GAME_OVER') timed();
  }
  if (name === 'DISRUPTOR_WIN') { game.phase = 'GAME_OVER'; game.crisis = 5; game.winner = 'DISRUPTOR'; }
  if (game.players.filter(player => player.faction === 'DISRUPTOR').length !== balance[seats.length]!.disruptors) throw Error('Scenario broke faction balance.');
  validateGame(game);
  return game;
}
