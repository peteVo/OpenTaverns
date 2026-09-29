import { applyAction, createGame, project, validateGame, type Action, type Game, type View } from './index.js';
import { config, nextRandom, type Profession, type Response } from './data.js';

function chance(view: View, actor: string) { let seed = view.revision + view.round * 7919; for (const char of actor) seed = nextRandom(seed + char.charCodeAt(0)); return seed % 100; }
export function nextBotAction(view: View, actor: string): Action | null {
  const self = view.self; if (!self) return null;
  const isLead = view.lead === actor;
  if (view.phase === 'ROLE_REVEAL') return self.confirmed ? null : { type: 'CONFIRM_ROLE' };
  if (view.phase === 'INCIDENT_REVEAL') return isLead ? { type: 'ACK_INCIDENT' } : null;
  if (view.phase === 'BRIEFING') {
    if (!self.abilityUsed && view.players.find(player => player.id === actor)?.profession === 'Forecast Analyst' && view.round < config.rounds) return { type: 'USE_ABILITY' };
    return isLead ? { type: 'START_ASSIGNMENT' } : null;
  }
  if (view.phase === 'ASSIGNMENT') {
    const profession = view.players.find(player => player.id === actor)?.profession as Profession;
    if (!self.abilityUsed) {
      const speciality: Partial<Record<Profession, string>> = { 'Grid Engineer': 'POWER', 'Water Planner': 'WATER', 'Transit Controller': 'TRANSIT', 'Network Coordinator': 'COMMS' };
      const index = speciality[profession] ? view.orders?.findIndex(order => order.system === speciality[profession]) : 0;
      if (profession !== 'Forecast Analyst' && (profession === 'Auditor' || index === 0 || index === 1)) return { type: 'USE_ABILITY', order: profession === 'Auditor' ? undefined : index };
    }
    if (!isLead || !view.orders) return null;
    if (view.orders.some(order => order.responders.length !== order.teamSize)) {
      const rotated = [...view.players.slice(view.round % view.players.length), ...view.players.slice(0, view.round % view.players.length)].map(player => player.id);
      const first = view.orders[0].teamSize;
      return { type: 'SET_TEAMS', teams: [rotated.slice(0, first), rotated.slice(first, first + view.orders[1].teamSize)] };
    }
    return { type: 'LOCK_ASSIGNMENT' };
  }
  if (view.phase === 'SECRET_ACTION') {
    if (!self.assignedOrder || self.lockedResponse) return null;
    const order = view.orders?.find(item => item.id === self.assignedOrder);
    if (!order) return null;
    const risk = chance(view, actor);
    let response: Response = 'STABILIZE';
    if (self.faction === 'DISRUPTOR') response = risk < (view.crisis >= 3 || view.stability[order.system] <= 1 ? 73 : 31) ? 'INTERFERE' : risk > 89 && view.insight < 2 ? 'DIAGNOSE' : 'STABILIZE';
    else if (view.crisis < 3 && view.stability[order.system] > 1 && view.insight < 2 && risk < 27) response = 'DIAGNOSE';
    return { type: 'LOCK_RESPONSE', response };
  }
  if (view.phase === 'RESOLUTION') return isLead ? { type: 'ADVANCE_RESOLUTION' } : null;
  if (view.phase === 'AUDIT_VOTE') {
    if (self.voted) return null;
    const failed = view.orders?.find(order => order.success === false && !order.audited);
    return { type: 'CAST_AUDIT_VOTE', choice: self.faction === 'DISRUPTOR' && chance(view, actor) < 55 ? null : failed?.id ?? null };
  }
  if (view.phase === 'ROUND_END') return isLead ? { type: 'END_ROUND' } : null;
  return null;
}
export function simulate(seed: number, playerCount = 7) {
  let game: Game = createGame(Array.from({ length: playerCount }, (_, index) => ({ id: `P${index}`, name: `Player ${index + 1}` })), seed);
  let actions = 0, interferes = 0, diagnoses = 0, audits = 0, abilityUses = 0, offline = 0;
  while (game.phase !== 'GAME_OVER' && actions < 4000) {
    const choice = game.players.map(player => ({ actor: player.id, action: nextBotAction(project(game, player.id), player.id) })).find(item => item.action);
    if (!choice?.action) throw Error(`Seed ${seed}, round ${game.round}, phase ${game.phase}, action ${actions}: no bot action.`);
    if (choice.action.type === 'LOCK_RESPONSE') { interferes += Number(choice.action.response === 'INTERFERE'); diagnoses += Number(choice.action.response === 'DIAGNOSE'); }
    if (choice.action.type === 'USE_ABILITY') abilityUses++;
    const before = game.insight;
    game = applyAction(game, choice.actor, choice.action);
    if (before > game.insight) audits++;
    offline += Object.values(game.stability).filter(value => value === 0).length;
    validateGame(game);
    if (game.phase !== 'GAME_OVER') { const publicState = JSON.stringify(project(game)); if (publicState.includes('faction') || publicState.includes('INTERFERE') || publicState.includes('lockedResponse')) throw Error(`Seed ${seed}: secret leaked in public projection.`); }
    actions++;
  }
  if (game.phase !== 'GAME_OVER') throw Error(`Seed ${seed}, round ${game.round}, phase ${game.phase}: no winner after ${actions} actions.`);
  return { seed, players: playerCount, winner: game.winner!, rounds: game.round, crisis: game.crisis, actions, interferes, diagnoses, audits, abilityUses, offlineSamples: offline };
}
