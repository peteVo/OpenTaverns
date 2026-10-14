import { applyAction, calculateScore, createGame, fallbackAction, project, type Game } from './index.js';
import { nextBotAction } from './simulate.js';
export const scenarioNames = ['EMPTY_BOARD', 'FIRST_PLACEMENT', 'SELECTED_PALETTE', 'ONE_STAGED_TILE', 'INVALID_PLACEMENT', 'MATCHING_RUN', 'RAINBOW_SQUARE', 'COMMISSION_COMPLETE', 'MIDGAME', 'NEARLY_FULL', 'FINAL_SCORING', 'TIED_GAME', 'REMATCH', 'RECONNECT'] as const;
export type ScenarioName = typeof scenarioNames[number];
export function createScenario(name: ScenarioName, seats: { id: string; name: string }[]): Game {
  const turns = ['FINAL_SCORING', 'TIED_GAME'].includes(name) ? seats.length * 10 : name === 'NEARLY_FULL' ? seats.length * 9 : ['MIDGAME', 'MATCHING_RUN', 'RAINBOW_SQUARE', 'COMMISSION_COMPLETE'].includes(name) ? seats.length * 6 : 0;
  for (let seed = 42; seed < 1000; seed++) {
    let game = createGame(seats, seed);
    if (turns < seats.length * 10 && (game.startingSeat + Math.floor(turns / seats.length)) % seats.length !== 0) continue;
    for (let i = 0; i < turns; i++) game = applyAction(game, game.active!, name === 'TIED_GAME' ? fallbackAction(game) : nextBotAction(project(game), game.active!)!);
    const score=calculateScore(game.players[0]!.board,game.commissions);
    if(name==='MATCHING_RUN'&&!score.straightRuns.length||name==='RAINBOW_SQUARE'&&!score.squares.length||name==='COMMISSION_COMPLETE'&&!score.gallery.some(g=>g.complete))continue;
    if (name !== 'TIED_GAME' || game.winners.length > 1) return game;
  }
  throw Error('No valid scenario found.');
}
