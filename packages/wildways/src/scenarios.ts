import { applyAction, createGame, fallbackAction, getComponents, getHabitatComponents, getRouteComponents, project, validateGame, type Game } from './index.js';
import { nextBotAction } from './simulate.js';

export const scenarioNames = [
  'INITIAL', 'FIRST_PLACEMENT', 'HABITAT_MERGE', 'TRAIL_NETWORK', 'STREAM_NETWORK',
  'INFLUENCE_TIE', 'MILESTONE_RACE', 'MIDGAME', 'LARGE_LANDSCAPE', 'FINAL_SCORING', 'SHARED_VICTORY'
] as const;
export type ScenarioName = typeof scenarioNames[number];

const turnsFor: Record<ScenarioName, number> = {
  INITIAL: 0,
  FIRST_PLACEMENT: 1,
  HABITAT_MERGE: 18,
  TRAIL_NETWORK: 30,
  STREAM_NETWORK: 30,
  INFLUENCE_TIE: 30,
  MILESTONE_RACE: Number.MAX_SAFE_INTEGER,
  MIDGAME: 24,
  LARGE_LANDSCAPE: 40,
  FINAL_SCORING: Number.MAX_SAFE_INTEGER,
  SHARED_VICTORY: Number.MAX_SAFE_INTEGER
};

function hasHabitatMerge(game: Game): boolean {
  let prefix = [game.board.find(tile => tile.id === 'origin')!];
  for (const event of game.history) {
    const tile = game.board.find(placed => placed.id === event.tile)!;
    const adjacent = prefix.filter(old => old.habitat === tile.habitat && Math.abs(old.x - tile.x) + Math.abs(old.y - tile.y) === 1);
    if (adjacent.length >= 2) {
      const groups = getHabitatComponents(prefix);
      const componentIds = new Set(adjacent.map(old => groups.find(group => group.tiles.includes(old.id))!.id));
      if (componentIds.size >= 2) return true;
    }
    prefix = [...prefix, tile];
  }
  return false;
}

/** True only when a legal state actually demonstrates the named condition. */
export function scenarioMatches(name: ScenarioName, game: Game): boolean {
  if (name === 'INITIAL') return game.history.length === 0 && game.board.length === 1;
  if (name === 'FIRST_PLACEMENT') return game.history.length === 1;
  if (name === 'HABITAT_MERGE') return hasHabitatMerge(game);
  if (name === 'TRAIL_NETWORK') return getRouteComponents(game.board).some(component => component.kind === 'Trail' && component.tiles.length >= 3);
  if (name === 'STREAM_NETWORK') return getRouteComponents(game.board).some(component => component.kind === 'Stream' && component.tiles.length >= 3);
  if (name === 'INFLUENCE_TIE') return getComponents(game.board).some(component => component.leaders.length > 1);
  if (name === 'MILESTONE_RACE') return game.milestones.some(milestone => milestone.claimedBy !== null);
  if (name === 'MIDGAME') return game.phase === 'PLACING' && game.history.length >= 20 && game.history.length < 40;
  if (name === 'LARGE_LANDSCAPE') return game.board.length >= 40;
  if (name === 'FINAL_SCORING') return game.phase === 'GAME_OVER';
  return game.phase === 'GAME_OVER' && game.winners.length > 1;
}

/** Build fixtures only from legal seeded play; no tile is fabricated or removed. */
export function createScenario(name: ScenarioName, seats: { id: string; name: string }[], seed = 7301): Game {
  const target = turnsFor[name];
  for (let offset = 0; offset < 300; offset++) {
    let game = createGame(seats, seed + offset);
    while (game.phase !== 'GAME_OVER' && game.history.length < target) {
      const view = project(game);
      const action = name === 'SHARED_VICTORY' ? fallbackAction(view) : nextBotAction(view, game.active!);
      if (!action) throw new Error(`No legal bot action while building ${name} at seed ${game.seed}.`);
      game = applyAction(game, game.active!, action);
    }
    if (!scenarioMatches(name, game)) continue;
    validateGame(game);
    return game;
  }
  throw new Error(`Could not build a conserved ${name} scenario from 300 legal seeds starting at ${seed}.`);
}
