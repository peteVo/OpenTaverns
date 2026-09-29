import { describe, expect, it } from 'vitest';
import { applyAction, balance, config, createGame, professions, project, replayGame, validateGame, type Game } from './index.js';
import { simulate } from './simulate.js';
import { createScenario, scenarioNames } from './scenarios.js';
const seats = (count = 7) => Array.from({ length: count }, (_, i) => ({ id: `P${i}`, name: `Player ${i}` }));
const start = (count = 7) => createGame(seats(count), 42);
const timed = (game: Game) => applyAction(game, '@system', { type: 'TIMEOUT' });
const assignment = (count = 7) => timed(timed(timed(start(count))));
function secret(count = 7) { const game = timed(assignment(count)); expect(game.phase).toBe('SECRET_ACTION'); return game; }

describe('Blackout rules and privacy', () => {
  it.each([5,6,7,8,9,10])('%i players have configured roles, unique public professions, and two valid teams', count => {
    const game = start(count); validateGame(game);
    expect(game.players.filter(player => player.faction === 'DISRUPTOR')).toHaveLength(balance[count]!.disruptors);
    expect(new Set(game.players.map(player => player.profession)).size).toBe(count);
    expect(game.orders.map(order => order.teamSize)).toEqual(balance[count]!.teams);
  });
  it('keeps faction, deck, and private responses out of live public and spectator projections', () => {
    let game = secret(); const operator = game.players.find(player => player.faction === 'OPERATOR' && game.orders.some(order => order.responders.includes(player.id)))!;
    game = applyAction(game, operator.id, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' });
    const publicText = JSON.stringify(project(game));
    expect(publicText).not.toMatch(/"faction"|"locked"|"random"|"incidentDeck"|"actionLog"|DIAGNOSE/);
    expect(project(game, operator.id).self?.lockedResponse).toBe('DIAGNOSE');
    for (const player of game.players.filter(p => p.id !== operator.id)) expect(project(game, player.id).self?.lockedResponse).not.toBe('DIAGNOSE');
    expect(project(game).self).toBeNull();
    const disruptor = game.players.find(p => p.faction === 'DISRUPTOR')!;
    expect(project(game, disruptor.id).self?.allies).toHaveLength(balance[7]!.disruptors - 1);
    expect(project(game, operator.id).self?.allies).toEqual([]);
  });
  it('blocks forged roles, non-lead assignments, overfilled teams, duplicate response, and Operator interference', () => {
    let game = assignment(); const lead = game.players[0]!.id;
    expect(() => applyAction(game, game.players[1]!.id, { type: 'SET_TEAMS', teams: [[],[]] })).toThrow();
    expect(() => applyAction(game, lead, { type: 'SET_TEAMS', teams: [[lead,lead],[]] })).toThrow();
    expect(() => applyAction(game, lead, { type: 'SET_TEAMS', teams: [game.players.slice(0,5).map(p => p.id),[]] })).toThrow();
    expect(() => applyAction(game, lead, { type: 'LOCK_ASSIGNMENT' })).toThrow();
    game = timed(game);
    const operator = game.players.find(p => p.faction === 'OPERATOR' && game.orders.some(order => order.responders.includes(p.id)))!;
    expect(() => applyAction(game, operator.id, { type: 'LOCK_RESPONSE', response: 'INTERFERE' })).toThrow();
    const after = applyAction(game, operator.id, { type: 'LOCK_RESPONSE', response: 'STABILIZE' });
    expect(() => applyAction(after, operator.id, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' })).toThrow();
    expect(() => applyAction(game, '@system', { type: 'SET_TEAMS', teams: [[],[]] })).toThrow();
  });
  it('resolves both orders together and turns Diagnose into shared Insight', () => {
    let game = secret(); const first = game.orders[0].responders[0]!;
    game = applyAction(game, first, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' });
    game = timed(game);
    expect(game.phase).toBe('RESOLUTION'); expect(game.insight).toBe(1);
    expect(game.orders[0].success).toBe(true); expect(game.orders[1].success).toBe(true);
  });
  it('an innocent Diagnose can cause a failure while an Audit reports zero Interference', () => {
    let game = secret(5); const [a,b] = game.orders[0].responders;
    game = applyAction(game, a!, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' });
    game = applyAction(game, b!, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' });
    game = timed(game); expect(game.orders[0].success).toBe(false); expect(game.insight).toBe(2);
    game = applyAction(game, game.players[0]!.id, { type: 'ADVANCE_RESOLUTION' });
    expect(game.phase).toBe('AUDIT_VOTE');
    for (const player of game.players) game = applyAction(game, player.id, { type: 'CAST_AUDIT_VOTE', choice: 'R1A' });
    expect(game.timeline[0]!.orders[0]!.auditedInterference).toBe(0); expect(game.insight).toBe(0);
  });
  it('keeps votes private until reveal and saves Insight on a tie', () => {
    let game = secret(5); game.insight = 2; game = timed(game); game = timed(game);
    game = applyAction(game, 'P0', { type: 'CAST_AUDIT_VOTE', choice: 'R1A' });
    expect(JSON.stringify(project(game))).not.toContain('"choice":"R1A"');
    for (const id of ['P1','P2']) game = applyAction(game, id, { type: 'CAST_AUDIT_VOTE', choice: 'R1B' });
    for (const id of ['P3','P4']) game = applyAction(game, id, { type: 'CAST_AUDIT_VOTE', choice: null });
    expect(game.phase).toBe('ROUND_END'); expect(game.insight).toBe(2);
  });
  it('can Audit an earlier resolved order without exposing its private actions', () => {
    let game = secret(5); game.insight = 2;
    game = timed(game); game = timed(game); game = timed(game); game = timed(game);
    expect(game.round).toBe(2);
    game = timed(game); game = timed(game); game = timed(game); game = timed(game);
    game = applyAction(game, game.players[game.leadIndex]!.id, { type: 'ADVANCE_RESOLUTION' });
    expect(game.phase).toBe('AUDIT_VOTE');
    expect(project(game).auditChoices.map(order => order.id)).toContain('R1A');
    expect(JSON.stringify(project(game).auditChoices)).not.toContain('STABILIZE');
    for (const player of game.players) game = applyAction(game, player.id, { type: 'CAST_AUDIT_VOTE', choice: 'R1A' });
    expect(game.timeline[0]!.orders[0]!.auditedInterference).toBe(0);
  });
  it('tests every profession in its valid phase, rejects reuse and invalid phase, and survives reconnect serialization', () => {
    const game = assignment(10);
    for (const profession of professions) {
      let copy = structuredClone(game);
      const player = copy.players.find(p => p.profession === profession)!;
      if (profession === 'Forecast Analyst') {
        expect(() => applyAction(copy, player.id, { type: 'USE_ABILITY' })).toThrow();
        copy.phase = 'BRIEFING'; copy = applyAction(copy, player.id, { type: 'USE_ABILITY' });
        expect(project(copy, player.id).self?.forecast).not.toBeNull();
        expect(project(copy).self).toBeNull();
      } else {
        const matching = { 'Grid Engineer': 'POWER', 'Water Planner': 'WATER', 'Transit Controller': 'TRANSIT', 'Network Coordinator': 'COMMS' }[profession as 'Grid Engineer'];
        const index = matching ? copy.orders.findIndex(order => order.system === matching) : 0;
        if (index < 0) continue;
        const action = { type: 'USE_ABILITY' as const, order: profession === 'Auditor' ? undefined : index };
        expect(() => applyAction(start(10), player.id, action)).toThrow();
        copy = applyAction(copy, player.id, action);
        expect(() => applyAction(copy, player.id, action)).toThrow();
        expect(copy.players.find(p => p.id === player.id)?.abilityUsed).toBe(true);
        const restored = JSON.parse(JSON.stringify(copy)) as Game;
        expect(project(restored, player.id).self?.abilityUsed).toBe(true);
      }
    }
  });
  it('applies profession protection and Auditor discount to resolution for either faction', () => {
    for (const profession of ['Systems Architect', 'Crisis Liaison'] as const) {
      let game = assignment(10);
      const holder = game.players.find(player => player.profession === profession)!;
      const system = game.orders[0].system;
      game = applyAction(game, holder.id, { type: 'USE_ABILITY', order: 0 });
      game = timed(game);
      const responder = game.orders[0].responders[0]!;
      game = applyAction(game, responder, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' });
      game.orders[0].required = game.orders[0].teamSize;
      game = timed(game);
      expect(game.orders[0].success).toBe(false);
      expect(game.stability[system]).toBe(profession === 'Systems Architect' ? 3 : 2);
      expect(game.crisis).toBe(profession === 'Crisis Liaison' ? 0 : 1);
    }
    let game = assignment(10);
    const auditor = game.players.find(player => player.profession === 'Auditor')!;
    game = applyAction(game, auditor.id, { type: 'USE_ABILITY' });
    game = timed(game);
    game = applyAction(game, game.orders[0].responders[0]!, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' });
    game = timed(game);
    expect(game.insight).toBe(1);
    game = applyAction(game, game.players[0]!.id, { type: 'ADVANCE_RESOLUTION' });
    expect(game.phase).toBe('AUDIT_VOTE');
    for (const player of game.players) game = applyAction(game, player.id, { type: 'CAST_AUDIT_VOTE', choice: 'R1A' });
    expect(game.insight).toBe(0);
  });
  it('applies Crisis and Offline victories, round-eight Operator victory, and rejects postgame actions', () => {
    let game = secret(); game.crisis = config.maxCrisis - 1;
    const disruptor = game.players.find(p => p.faction === 'DISRUPTOR' && game.orders.some(o => o.responders.includes(p.id)))!;
    game = applyAction(game, disruptor.id, { type: 'LOCK_RESPONSE', response: 'INTERFERE' }); game = timed(game);
    expect(game.winner).toBe('DISRUPTOR'); expect(project(game).truth).not.toBeNull();
    expect(() => applyAction(game, disruptor.id, { type: 'CONFIRM_ROLE' })).toThrow();
    const operatorWin = createScenario('OPERATOR_WIN', seats(), 23);
    expect(operatorWin.winner).toBe('OPERATOR'); expect(operatorWin.round).toBe(8);
    let offline = secret(); offline.stability.POWER = 0; offline.stability.WATER = 1;
    offline.orders[0].system = 'WATER'; offline.orders[0].required = offline.orders[0].teamSize; offline.orders[1].system = 'TRANSIT';
    offline = applyAction(offline, offline.orders[0].responders[0]!, { type: 'LOCK_RESPONSE', response: 'DIAGNOSE' });
    const end = timed(offline); expect(end.stability.WATER).toBe(0); expect(end.winner).toBe('DISRUPTOR');
  });
  it('safe timeout fills missing responses and complete history replays identically', () => {
    let game = secret(); game = timed(game);
    expect(game.orders.every(order => order.responders.every(id => order.locked[id] === 'STABILIZE'))).toBe(true);
    const replayed = replayGame(seats(), 42, game.actionLog);
    expect(replayed).toEqual(game);
  });
  it.each(scenarioNames)('%s scenario is valid and private', name => {
    const game = createScenario(name, seats(), 4); validateGame(game);
    if (game.phase !== 'GAME_OVER') expect(JSON.stringify(project(game))).not.toMatch(/"faction"|"locked"|"actionLog"/);
  });
  it.each([5,6,7,8,9,10])('%i bot seats finish seeded games without deadlock', count => {
    for (let seed = 1; seed <= 10; seed++) expect(['OPERATOR','DISRUPTOR']).toContain(simulate(seed, count).winner);
  });
});
