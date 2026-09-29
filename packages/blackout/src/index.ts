import { balance, config, factions, incidents, professions, shuffled, systems, type Faction, type Incident, type Profession, type Response, type System } from './data.js';
export { balance, config, factions, incidents, professions, systems } from './data.js';
export type { Faction, Profession, Response, System, Incident } from './data.js';

export type Phase = 'ROLE_REVEAL' | 'INCIDENT_REVEAL' | 'BRIEFING' | 'ASSIGNMENT' | 'SECRET_ACTION' | 'RESOLUTION' | 'AUDIT_VOTE' | 'ROUND_END' | 'GAME_OVER';
export type Pacing = 'RELAXED' | 'STANDARD' | 'FAST';
export type Player = { id: string; name: string; connected: boolean; faction: Faction; profession: Profession; confirmed: boolean; abilityUsed: boolean; previewRound: number | null };
export type Order = { id: string; system: System; required: number; teamSize: number; outcomes: { success: { stability: number; crisis: number }; failure: { stability: number; crisis: number } }; responders: string[]; locked: Record<string, Response>; bonus: number; shield: boolean; crisisGuard: boolean; progress: number | null; success: boolean | null; audited: boolean };
export type RoundRecord = { round: number; lead: string; incident: string; orders: { id: string; system: System; responders: string[]; actions: { player: string; action: Response }[]; progress: number; required: number; success: boolean; auditedInterference: number | null }[]; abilities: { player: string; profession: Profession; order: string | null }[]; votes: { player: string; choice: string | null }[] };
export type Action =
  | { type: 'CONFIRM_ROLE' } | { type: 'ACK_INCIDENT' } | { type: 'START_ASSIGNMENT' }
  | { type: 'SET_TEAMS'; teams: [string[], string[]] } | { type: 'LOCK_ASSIGNMENT' }
  | { type: 'LOCK_RESPONSE'; response: Response }
  | { type: 'USE_ABILITY'; order?: number }
  | { type: 'ADVANCE_RESOLUTION' } | { type: 'CAST_AUDIT_VOTE'; choice: string | null }
  | { type: 'END_ROUND' } | { type: 'TIMEOUT' };
export type Game = { gameVersion: 1; revision: number; startSeed: number; random: number; pacing: Pacing; phase: Phase; round: number; leadIndex: number; players: Player[]; stability: Record<System, number>; crisis: number; insight: number; incidentDeck: Incident[]; incidentIndex: number; orders: [Order, Order]; votes: Record<string, string | null>; auditDiscount: number; history: { round: number; text: string }[]; timeline: RoundRecord[]; actionLog: { actor: string; action: Action }[]; winner: Faction | null };
export type PublicPlayer = Pick<Player, 'id' | 'name' | 'connected' | 'profession' | 'confirmed' | 'abilityUsed'>;
export type PublicOrder = Omit<Order, 'locked'> & { lockedPlayers: string[] };
export type View = { gameVersion: 1; revision: number; phase: Phase; round: number; maxRounds: number; pacing: Pacing; lead: string; players: PublicPlayer[]; stability: Record<System, number>; crisis: number; insight: number; auditCost: number; incident: Incident | null; orders: [PublicOrder, PublicOrder] | null; history: Game['history']; auditChoices: { id: string; system: System; round: number; responders: string[] }[]; auditResults: { order: string; interference: number }[]; voteProgress: number; self: { faction: Faction; allies: string[]; confirmed: boolean; abilityUsed: boolean; voted: boolean; lockedResponse: Response | null; assignedOrder: string | null; forecast: Incident | null } | null; winner: Faction | null; truth: { players: { id: string; faction: Faction; profession: Profession }[]; timeline: RoundRecord[] } | null };
function need(condition: unknown, message: string): asserts condition { if (!condition) throw Error(message); }
function event(game: Game, text: string) { game.history.push({ round: game.round, text }); }
function lead(game: Game) { return game.players[game.leadIndex]!.id; }
function orderFor(game: Game, id: string) { return game.orders.find(order => order.responders.includes(id)); }
function record(game: Game) { return game.timeline.find(item => item.round === game.round)!; }
function work(game: Game, id: string) { return game.timeline.flatMap(item => item.orders).find(order => order.id === id); }
function newOrders(game: Game): [Order, Order] {
  const incident = game.incidentDeck[game.incidentIndex]!;
  const teams = balance[game.players.length]!.teams;
  const make = (index: 0 | 1): Order => { const item = incident.orders[index]; return { id: `R${game.round}${index === 0 ? 'A' : 'B'}`, system: item.system, required: Math.min(teams[index], balance[game.players.length]!.progress[index] + (game.players.length === 5 ? 0 : item.strain)), teamSize: teams[index], outcomes: structuredClone(config.outcomes), responders: [], locked: {}, bonus: 0, shield: false, crisisGuard: false, progress: null, success: null, audited: false }; };
  return [make(0), make(1)];
}
export function createGame(seats: { id: string; name: string }[], seed = 1, pacing: Pacing = 'RELAXED'): Game {
  need(!!balance[seats.length] && new Set(seats.map(s => s.id)).size === seats.length, 'Blackout needs 5–10 distinct players.');
  const roleDeck = shuffled([...Array(balance[seats.length]!.disruptors).fill('DISRUPTOR'), ...Array(seats.length - balance[seats.length]!.disruptors).fill('OPERATOR')] as Faction[], seed);
  const professionDeck = shuffled(professions, roleDeck.seed);
  const incidentDeck = shuffled(incidents, professionDeck.seed);
  const players = seats.map((seat, index) => ({ ...seat, connected: true, faction: roleDeck.items[index]!, profession: professionDeck.items[index]!, confirmed: false, abilityUsed: false, previewRound: null }));
  const game: Game = { gameVersion: 1, revision: 0, startSeed: seed, random: incidentDeck.seed, pacing, phase: 'ROLE_REVEAL', round: 1, leadIndex: 0, players, stability: { POWER: 3, WATER: 3, TRANSIT: 3, COMMS: 3 }, crisis: 0, insight: 0, incidentDeck: incidentDeck.items, incidentIndex: 0, orders: [] as unknown as [Order, Order], votes: {}, auditDiscount: 0, history: [], timeline: [], actionLog: [], winner: null };
  game.orders = newOrders(game);
  game.timeline.push({ round: 1, lead: lead(game), incident: game.incidentDeck[0]!.title, orders: [], abilities: [], votes: [] });
  event(game, 'The night shift assembled. Private roles are ready.');
  validateGame(game);
  return game;
}
function assign(game: Game, teams: [string[], string[]]) {
  const all = teams.flat();
  need(new Set(all).size === all.length && all.every(id => game.players.some(player => player.id === id)), 'A responder can hold only one valid assignment.');
  teams.forEach((team, index) => need(team.length <= game.orders[index]!.teamSize, 'That Work Order is full.'));
  game.orders.forEach((order, index) => { order.responders = [...teams[index]!]; });
}
function resolve(game: Game) {
  const timeline = record(game);
  for (const order of game.orders) {
    const actions = order.responders.map(player => ({ player, action: order.locked[player]! }));
    const progress = actions.reduce((sum, item) => sum + (item.action === 'STABILIZE' ? 1 : item.action === 'INTERFERE' ? -1 : 0), order.bonus);
    order.progress = progress; order.success = progress >= order.required;
    game.insight += actions.filter(item => item.action === 'DIAGNOSE').length;
    const outcome = order.success ? order.outcomes.success : order.outcomes.failure;
    if (!order.shield || outcome.stability > 0) game.stability[order.system] = Math.max(0, Math.min(config.maxStability, game.stability[order.system] + outcome.stability));
    if (!order.crisisGuard || outcome.crisis < 0) game.crisis = Math.max(0, Math.min(config.maxCrisis, game.crisis + outcome.crisis));
    timeline.orders.push({ id: order.id, system: order.system, responders: [...order.responders], actions, progress, required: order.required, success: order.success, auditedInterference: null });
    event(game, `${order.system} response ${order.success ? 'held' : 'failed'}. Stability ${game.stability[order.system]}; Crisis ${game.crisis}.`);
  }
  if (game.crisis >= config.maxCrisis || systems.filter(system => game.stability[system] === 0).length >= 2) { game.phase = 'GAME_OVER'; game.winner = 'DISRUPTOR'; event(game, 'The city fell into Blackout. Disruptors win.'); }
  else game.phase = 'RESOLUTION';
}
function finishAudit(game: Game) {
  record(game).votes = game.players.map(player => ({ player: player.id, choice: game.votes[player.id] ?? null }));
  const counts = new Map<string, number>();
  for (const vote of Object.values(game.votes)) if (vote) counts.set(vote, (counts.get(vote) || 0) + 1);
  const winning = [...counts].find(([, count]) => count > game.players.length / 2)?.[0];
  const cost = config.auditCost - game.auditDiscount;
  if (winning && game.insight >= cost) {
    const target = work(game, winning)!;
    const count = target.actions.filter(action => action.action === 'INTERFERE').length;
    target.auditedInterference = count;
    const current = game.orders.find(order => order.id === winning); if (current) current.audited = true;
    game.insight -= cost;
    event(game, `Audit of ${target.system} ${target.id}: ${count} Interference ${count === 1 ? 'action' : 'actions'} detected.`);
  } else event(game, 'No Work Order gained a majority. Insight was saved.');
  event(game, `Audit vote revealed: ${game.players.map(player => `${player.name} ${game.votes[player.id] ?? 'SAVE'}`).join(' · ')}.`);
  game.phase = 'ROUND_END';
}
function nextRound(game: Game) {
  if (game.round >= config.rounds) { game.phase = 'GAME_OVER'; game.winner = 'OPERATOR'; event(game, 'The final shift held. Operators win.'); return; }
  game.round++; game.leadIndex = (game.leadIndex + 1) % game.players.length; game.incidentIndex++; game.orders = newOrders(game); game.votes = {}; game.auditDiscount = 0;
  game.timeline.push({ round: game.round, lead: lead(game), incident: game.incidentDeck[game.incidentIndex]!.title, orders: [], abilities: [], votes: [] });
  game.phase = 'INCIDENT_REVEAL'; event(game, `Round ${game.round} began. ${game.players[game.leadIndex]!.name} is Shift Lead.`); event(game, `Incident revealed: ${game.incidentDeck[game.incidentIndex]!.title}.`);
}
function useAbility(game: Game, actor: string, index: number | undefined) {
  const player = game.players.find(item => item.id === actor)!;
  need(!player.abilityUsed, 'This profession ability was already used.');
  const profession = player.profession;
  if (profession === 'Forecast Analyst') {
    need(game.phase === 'BRIEFING' && game.incidentIndex + 1 < game.incidentDeck.length, 'Forecast can be used during briefing before the final round.');
    player.previewRound = game.round + 1;
  } else {
    need(game.phase === 'ASSIGNMENT', 'Use this ability before response teams lock.');
    if (profession === 'Auditor') { game.auditDiscount = 1; }
    else {
      need(index === 0 || index === 1, 'Choose a Work Order.');
      const order = game.orders[index]!;
      const speciality: Partial<Record<Profession, System>> = { 'Grid Engineer': 'POWER', 'Water Planner': 'WATER', 'Transit Controller': 'TRANSIT', 'Network Coordinator': 'COMMS' };
      if (speciality[profession]) { need(order.system === speciality[profession], 'This profession supports its matching system.'); order.bonus++; }
      else if (profession === 'Dispatcher' || profession === 'Logistics Lead') order.bonus++;
      else if (profession === 'Systems Architect') order.shield = true;
      else if (profession === 'Crisis Liaison') order.crisisGuard = true;
    }
  }
  player.abilityUsed = true;
  record(game).abilities.push({ player: actor, profession, order: index === undefined ? null : game.orders[index]!.id });
  event(game, `${player.name} used ${profession}${index === undefined ? '' : ` for ${game.orders[index]!.system}`}.`);
}
function timeout(game: Game) {
  if (game.phase === 'ROLE_REVEAL') { game.players.forEach(player => { player.confirmed = true; }); game.phase = 'INCIDENT_REVEAL'; event(game, `Incident revealed: ${game.incidentDeck[game.incidentIndex]!.title}.`); }
  else if (game.phase === 'INCIDENT_REVEAL') game.phase = 'BRIEFING';
  else if (game.phase === 'BRIEFING') game.phase = 'ASSIGNMENT';
  else if (game.phase === 'ASSIGNMENT') { const ids = game.players.map(player => player.id); assign(game, [ids.slice(0, game.orders[0].teamSize), ids.slice(game.orders[0].teamSize, game.orders[0].teamSize + game.orders[1].teamSize)]); game.phase = 'SECRET_ACTION'; }
  else if (game.phase === 'SECRET_ACTION') { for (const order of game.orders) for (const id of order.responders) order.locked[id] ??= 'STABILIZE'; resolve(game); }
  else if (game.phase === 'RESOLUTION') game.phase = game.insight >= config.auditCost - game.auditDiscount ? 'AUDIT_VOTE' : 'ROUND_END';
  else if (game.phase === 'AUDIT_VOTE') { for (const player of game.players) if (!(player.id in game.votes)) game.votes[player.id] = null; finishAudit(game); }
  else if (game.phase === 'ROUND_END') nextRound(game);
  event(game, 'The shift advanced after its response window expired.');
}
export function applyAction(input: Game, actor: string, action: Action): Game {
  need(input.phase !== 'GAME_OVER', 'This match has ended.');
  const game = structuredClone(input);
  const player = game.players.find(item => item.id === actor);
  if (action.type === 'TIMEOUT') { need(actor === '@system', 'Only the server can advance a timed-out phase.'); timeout(game); }
  else {
    need(!!player, 'Only a player can act.');
    if (action.type === 'CONFIRM_ROLE') { need(game.phase === 'ROLE_REVEAL' && !player.confirmed, 'Your role is already confirmed.'); player.confirmed = true; if (game.players.every(item => item.confirmed)) { game.phase = 'INCIDENT_REVEAL'; event(game, `Incident revealed: ${game.incidentDeck[game.incidentIndex]!.title}.`); } }
    else if (action.type === 'ACK_INCIDENT') { need(game.phase === 'INCIDENT_REVEAL' && actor === lead(game), 'Only the Shift Lead can open briefing.'); game.phase = 'BRIEFING'; }
    else if (action.type === 'START_ASSIGNMENT') { need(game.phase === 'BRIEFING' && actor === lead(game), 'Only the Shift Lead can assign responders.'); game.phase = 'ASSIGNMENT'; }
    else if (action.type === 'SET_TEAMS') { need(game.phase === 'ASSIGNMENT' && actor === lead(game), 'Only the Shift Lead assigns responders.'); assign(game, action.teams); event(game, `${player.name} assigned ${game.orders.map(order => `${order.responders.map(id => game.players.find(item => item.id === id)?.name).join(', ')} to ${order.system}`).join('; ')}.`); }
    else if (action.type === 'LOCK_ASSIGNMENT') { need(game.phase === 'ASSIGNMENT' && actor === lead(game) && game.orders.every(order => order.responders.length === order.teamSize), 'Fill both Work Orders before locking.'); game.phase = 'SECRET_ACTION'; event(game, `${player.name} locked the response teams.`); }
    else if (action.type === 'LOCK_RESPONSE') {
      need(game.phase === 'SECRET_ACTION', 'Responses are not open.'); const order = orderFor(game, actor);
      need(!!order && !order.locked[actor], 'You have no unlocked response.');
      need(action.response === 'STABILIZE' || action.response === 'DIAGNOSE' || (action.response === 'INTERFERE' && player.faction === 'DISRUPTOR'), 'That response is unavailable to your faction.');
      order.locked[actor] = action.response; event(game, `${player.name} locked a private response.`);
      if (game.orders.every(item => item.responders.every(id => !!item.locked[id]))) resolve(game);
    }
    else if (action.type === 'USE_ABILITY') useAbility(game, actor, action.order);
    else if (action.type === 'ADVANCE_RESOLUTION') { need(game.phase === 'RESOLUTION' && actor === lead(game), 'Only the Shift Lead can open the Audit window.'); game.phase = game.insight >= config.auditCost - game.auditDiscount ? 'AUDIT_VOTE' : 'ROUND_END'; }
    else if (action.type === 'CAST_AUDIT_VOTE') {
      need(game.phase === 'AUDIT_VOTE' && !(actor in game.votes), 'Your Audit vote is already locked.');
      need(action.choice === null || !!work(game, action.choice) && work(game, action.choice)!.auditedInterference === null, 'Choose an unaudited resolved Work Order.');
      game.votes[actor] = action.choice; event(game, `${player.name} locked an Audit vote.`);
      if (Object.keys(game.votes).length === game.players.length) finishAudit(game);
    }
    else if (action.type === 'END_ROUND') { need(game.phase === 'ROUND_END' && actor === lead(game), 'Only the Shift Lead can close the round.'); nextRound(game); }
  }
  game.revision++;
  game.actionLog.push({ actor, action });
  validateGame(game);
  return game;
}
export function project(game: Game, viewerId: string | null = null): View {
  const self = game.players.find(player => player.id === viewerId);
  const assigned = self ? orderFor(game, self.id) : undefined;
  const publicOrders = game.phase === 'ROLE_REVEAL' ? null : game.orders.map(({ locked, ...order }) => ({ ...order, lockedPlayers: Object.keys(locked) })) as [PublicOrder, PublicOrder];
  return {
    gameVersion: 1, revision: game.revision, phase: game.phase, round: game.round, maxRounds: config.rounds, pacing: game.pacing, lead: lead(game),
    players: game.players.map(({ id, name, connected, profession, confirmed, abilityUsed }) => ({ id, name, connected, profession, confirmed, abilityUsed })),
    stability: { ...game.stability }, crisis: game.crisis, insight: game.insight, auditCost: config.auditCost - game.auditDiscount,
    incident: game.phase === 'ROLE_REVEAL' ? null : game.incidentDeck[game.incidentIndex]!, orders: publicOrders,
    history: game.history.map(item => ({ ...item })), auditChoices: game.timeline.flatMap(round => round.orders.filter(order => order.auditedInterference === null).map(order => ({ id: order.id, system: order.system, round: round.round, responders: [...order.responders] }))), auditResults: game.timeline.flatMap(round => round.orders.filter(order => order.auditedInterference !== null).map(order => ({ order: order.id, interference: order.auditedInterference! }))),
    voteProgress: Object.keys(game.votes).length,
    self: self ? { faction: self.faction, allies: self.faction === 'DISRUPTOR' ? game.players.filter(player => player.faction === 'DISRUPTOR' && player.id !== self.id).map(player => player.id) : [], confirmed: self.confirmed, abilityUsed: self.abilityUsed, voted: self.id in game.votes, lockedResponse: assigned?.locked[self.id] ?? null, assignedOrder: assigned?.id ?? null, forecast: self.previewRound === game.round + 1 ? game.incidentDeck[game.incidentIndex + 1] ?? null : null } : null,
    winner: game.winner, truth: game.phase === 'GAME_OVER' ? { players: game.players.map(({ id, faction, profession }) => ({ id, faction, profession })), timeline: structuredClone(game.timeline) } : null,
  };
}
export function validateGame(game: Game) {
  need(game.gameVersion === 1 && Number.isSafeInteger(game.revision) && game.revision >= 0, 'Invalid game version or revision.');
  need(!!balance[game.players.length] && game.players.filter(player => player.faction === 'DISRUPTOR').length === balance[game.players.length]!.disruptors, 'Invalid faction distribution.');
  need(new Set(game.players.map(player => player.id)).size === game.players.length && new Set(game.players.map(player => player.profession)).size === game.players.length && game.players.every(player => factions.includes(player.faction) && professions.includes(player.profession)), 'Invalid player identities.');
  need(game.leadIndex >= 0 && game.leadIndex < game.players.length && game.round >= 1 && game.round <= config.rounds, 'Invalid round or Shift Lead.');
  need(game.crisis >= 0 && game.crisis <= config.maxCrisis && game.insight >= 0 && systems.every(system => Number.isInteger(game.stability[system]) && game.stability[system] >= 0 && game.stability[system] <= config.maxStability), 'Invalid city tracks.');
  need(game.orders.length === 2 && game.incidentDeck.length >= config.rounds && game.incidentIndex === game.round - 1, 'Invalid Incident state.');
  const responders = game.orders.flatMap(order => order.responders);
  need(new Set(responders).size === responders.length && responders.every(id => game.players.some(player => player.id === id)), 'Invalid responder assignments.');
  for (const order of game.orders) {
    need(order.responders.length <= order.teamSize && order.required >= 1 && order.required <= order.teamSize && order.bonus >= 0 && JSON.stringify(order.outcomes) === JSON.stringify(config.outcomes), 'Invalid Work Order.');
    for (const [id, response] of Object.entries(order.locked)) { const player = game.players.find(item => item.id === id); need(!!player && order.responders.includes(id) && (response === 'STABILIZE' || response === 'DIAGNOSE' || response === 'INTERFERE' && player.faction === 'DISRUPTOR'), 'Invalid private response.'); }
  }
  if (['SECRET_ACTION', 'RESOLUTION', 'AUDIT_VOTE', 'ROUND_END'].includes(game.phase)) need(game.orders.every(order => order.responders.length === order.teamSize), 'Locked Work Orders need complete teams.');
  if (game.phase === 'GAME_OVER') need(game.winner !== null, 'A finished match needs a winner.');
  if (game.phase === 'AUDIT_VOTE') need(game.insight >= config.auditCost - game.auditDiscount, 'An Audit vote needs Insight.');
  need(Object.keys(game.votes).every(id => game.players.some(player => player.id === id)), 'Invalid Audit vote.');
}
export function replayGame(seats: { id: string; name: string }[], seed: number, actions: Game['actionLog'], pacing: Pacing = 'RELAXED'): Game {
  return actions.reduce((game, entry) => applyAction(game, entry.actor, entry.action), createGame(seats, seed, pacing));
}
