import { describe, expect, test } from 'vitest';
import { applyAction, calculateScores, calculateStandings, config, createGame, createTileDeck, fallbackAction, getComponents, getHabitatComponents, getLegalPlacements, getRouteComponents, portsOf, previewTurn, project, qualifiesMilestone, replayGame, restoreGame, rotateTile, serializeGame, validateGame, type PlacedTile, type Tile } from './index.js';
import { nextBotAction, simulate } from './simulate.js';
import { createScenario, scenarioMatches, scenarioNames } from './scenarios.js';

const seats = (n = 4) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}` }));
let fixtureSerial = 0;
const fixture = (habitat: Tile['habitat'], route: Tile['route'] = null, ports: Tile['ports'] = [], landmark: string | null = null, id = `${habitat}-${route ?? 'plain'}-${++fixtureSerial}`): PlacedTile => ({ id, habitat, route, ports, landmark, x: 0, y: 0, orientation: 0, marker: null });
const linked = (tiles: PlacedTile[]) => tiles.map((tile, i) => ({ ...tile, x: i, y: 0 }));
const component = (layer: 'habitat' | 'route', kind: Tile['habitat'] | NonNullable<Tile['route']>, size: number, leaders = ['a'], landmarks = 0) => ({ id: `${layer}-${kind}`, layer, kind, tiles: Array.from({ length: size }, (_, i) => `t${i}`), landmarks, influence: Object.fromEntries(leaders.map(id => [id, 1])), leaders, potential: size, value: size * 2 + landmarks, awards: Object.fromEntries(leaders.map(id => [id, Math.floor((size * 2 + landmarks) / leaders.length)])) });

describe('Tile supply and geometry', () => {
  test('deck has 72 unique drawable IDs with balanced habitat and route counts', () => {
    const deck = createTileDeck();
    expect(deck).toHaveLength(72);
    expect(new Set(deck.map(tile => tile.id)).size).toBe(72);
    for (const habitat of ['Forest', 'Meadow', 'Highland'] as const) {
      expect(deck.filter(tile => tile.habitat === habitat)).toHaveLength(24);
      expect(deck.filter(tile => tile.habitat === habitat && !tile.route)).toHaveLength(8);
      expect(deck.filter(tile => tile.habitat === habitat && tile.route === 'Trail')).toHaveLength(8);
      expect(deck.filter(tile => tile.habitat === habitat && tile.route === 'Stream')).toHaveLength(8);
      for (const route of ['Trail', 'Stream'] as const) {
        const shapes = deck.filter(tile => tile.habitat === habitat && tile.route === route).map(tile => {
          const ports = [...tile.ports].sort((a, b) => a - b);
          return ports.length === 1 ? 'terminus' : ports.length === 3 ? 'junction' : ports[0]! % 2 === ports[1]! % 2 ? 'straight' : 'bend';
        });
        expect(shapes).toEqual(expect.arrayContaining(['terminus', 'bend', 'straight', 'junction']));
      }
    }
  });
  test.each([0, 1, 2, 3] as const)('rotation %i keeps port count and direction validity', orientation => {
    const tile = createTileDeck().find(tile => tile.route === 'Trail' && tile.ports.length === 3)!;
    const ports = portsOf(tile, orientation);
    expect(ports).toHaveLength(3);
    expect(new Set(ports).size).toBe(3);
    expect(ports.every(port => port >= 0 && port <= 3)).toBe(true);
  });
  test.each([[0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2]] as const)('rotating orientation %i by %i wraps in four directions', (orientation, delta) => {
    expect(rotateTile(orientation, delta)).toBe((orientation + delta) % 4);
  });
  test('empty board has one legal starting-adjacent coordinate at the origin', () => {
    const game = createGame(seats(2), 2);
    expect(game.board).toHaveLength(1);
    expect(game.board[0]).toMatchObject({ x: 0, y: 0 });
    expect(getLegalPlacements(game.board).length).toBe(4);
  });
  test('legal frontier supports negative coordinates and excludes occupied cells', () => {
    const board = linked([fixture('Forest'), fixture('Meadow')]);
    board[0] = { ...board[0]!, x: -4, y: -2 };
    board[1] = { ...board[1]!, x: -3, y: -2 };
    const legal = getLegalPlacements(board);
    expect(legal).toContainEqual({ x: -5, y: -2 });
    expect(legal).toContainEqual({ x: -3, y: -1 });
    expect(legal).not.toContainEqual({ x: -3, y: -2 });
    expect(legal).toContainEqual({ x: -4, y: -1 });
  });
});

describe('Habitat and route graphs', () => {
  test.each(['Forest', 'Meadow', 'Highland'] as const)('%s tiles connect orthogonally and split from other habitats', habitat => {
    const other = habitat === 'Meadow' ? 'Forest' : 'Meadow';
    const groups = getHabitatComponents([{ ...fixture(habitat), x: 0, y: 0 }, { ...fixture(habitat), x: 1, y: 0 }, { ...fixture(other), x: 2, y: 0 }]);
    expect(groups.filter(group => group.kind === habitat).map(group => group.tiles.length)).toContain(2);
    expect(groups.some(group => group.kind === other && group.tiles.length === 1)).toBe(true);
  });
  test('diagonal habitat tiles remain separate components', () => {
    const groups = getHabitatComponents([{ ...fixture('Forest'), x: 0, y: 0 }, { ...fixture('Forest'), x: 1, y: 1 }]);
    expect(groups).toHaveLength(2);
  });
  test('same route type joins only through matching facing ports', () => {
    const board = [{ ...fixture('Meadow', 'Trail', [1], null, 'a'), x: 0, y: 0 }, { ...fixture('Forest', 'Trail', [3], null, 'b'), x: 1, y: 0 }];
    expect(getRouteComponents(board).filter(group => group.kind === 'Trail')).toHaveLength(1);
  });
  test('unmatched termini and cross-type ports do not connect networks', () => {
    const board = [{ ...fixture('Meadow', 'Trail', [1], null, 'a'), x: 0, y: 0 }, { ...fixture('Forest', 'Trail', [0], null, 'b'), x: 1, y: 0 }, { ...fixture('Highland', 'Stream', [3], null, 'c'), x: 0, y: 1 }];
    const groups = getRouteComponents(board);
    expect(groups.filter(group => group.kind === 'Trail')).toHaveLength(2);
    expect(groups.filter(group => group.kind === 'Stream')).toHaveLength(1);
  });
  test('cycles and junctions count each tile once', () => {
    const board = [
      { ...fixture('Forest', 'Stream', [1, 2], null, 'a'), x: 0, y: 0 }, { ...fixture('Meadow', 'Stream', [1, 3], null, 'b'), x: 1, y: 0 },
      { ...fixture('Highland', 'Stream', [0, 3], null, 'c'), x: 1, y: 1 }, { ...fixture('Forest', 'Stream', [0, 1], null, 'd'), x: 0, y: 1 }
    ];
    expect(getRouteComponents(board).find(group => group.kind === 'Stream')!.tiles).toHaveLength(4);
  });
  test('landmarks travel with their tile into both graph layers', () => {
    const board = linked([fixture('Forest', 'Trail', [1, 3], 'Stone Arch'), fixture('Forest', 'Trail', [1, 3])]);
    expect(getHabitatComponents(board)[0]!.landmarks).toBe(1);
    expect(getRouteComponents(board)[0]!.landmarks).toBe(1);
  });
  test('all graph components are exposed through combined component helper', () => {
    const board = linked([fixture('Meadow', 'Stream', [1, 3])]);
    expect(getComponents(board)).toHaveLength(2);
  });
});

describe('Influence, scoring, and milestones', () => {
  test('a region under three tiles has no final value and has zero potential below threshold', () => {
    const board = linked([fixture('Meadow'), fixture('Meadow')]);
    expect(getHabitatComponents(board)[0]!.value).toBe(0);
    expect(getHabitatComponents(board)[0]!.potential).toBe(4);
  });
  test('habitat score formula adds two per tile and three per landmark', () => {
    const board = linked([fixture('Forest', null, [], 'A'), fixture('Forest'), fixture('Forest', null, [], 'B')]);
    const group = getHabitatComponents(board)[0]!;
    expect(group.value).toBe(12);
    expect(group.landmarks).toBe(2);
  });
  test.each(['Trail', 'Stream'] as const)('%s score formula adds three per tile and two per landmark', route => {
    const board = linked([fixture('Forest', route, [1, 3], 'A'), fixture('Meadow', route, [1, 3]), fixture('Highland', route, [1, 3])]);
    expect(getRouteComponents(board)[0]!.value).toBe(11);
  });
  test('unique control receives full value, tied leaders split down, nonleaders get zero', () => {
    const tiles = linked(Array.from({ length: 5 }, () => fixture('Forest')));
    const unique = getHabitatComponents(tiles.map((tile, i) => ({ ...tile, marker: { owner: i < 3 ? 'a' : 'b', mode: 'habitat' as const } })))[0]!;
    expect(unique.leaders).toEqual(['a']);
    expect(unique.awards.a).toBe(unique.value);
    const tied = getHabitatComponents(tiles.map((tile, i) => ({ ...tile, marker: { owner: ['a', 'b', 'a', 'b', 'c'][i]!, mode: 'habitat' as const } })))[0]!;
    expect(tied.leaders).toEqual(['a', 'b']);
    expect(tied.awards.a).toBe(Math.floor(tied.value / 2));
    expect(tied.awards.c ?? 0).toBe(0);
  });
  test('unmarked network has no leaders or awards', () => {
    const group = getHabitatComponents(linked([fixture('Highland'), fixture('Highland'), fixture('Highland')]))[0]!;
    expect(group.leaders).toEqual([]);
    expect(Object.values(group.awards).reduce((sum, value) => sum + value, 0)).toBe(0);
  });
  test.each([
    ['Great Grove', component('habitat', 'Forest', 7)],
    ['Open Range', component('habitat', 'Meadow', 7)],
    ['High Pass', component('habitat', 'Highland', 6, ['a'], 1)],
    ['Trailblazer', component('route', 'Trail', 6)],
    ['Watershed', component('route', 'Stream', 6)]
  ] as const)('%s qualifies exactly at its size and landmark threshold', (id, exact) => {
    expect(qualifiesMilestone(id, 'a', [exact])).toBe(true);
    expect(qualifiesMilestone(id, 'a', [{ ...exact, tiles: exact.tiles.slice(0, exact.tiles.length - 1) }])).toBe(false);
    expect(qualifiesMilestone(id, 'a', [{ ...exact, tiles: [...exact.tiles, 'extra'] }])).toBe(true);
  });
  test.each([
    ['Great Grove', component('habitat', 'Forest', 7)],
    ['Open Range', component('habitat', 'Meadow', 7)],
    ['High Pass', component('habitat', 'Highland', 6, ['a'], 1)],
    ['Trailblazer', component('route', 'Trail', 6)],
    ['Watershed', component('route', 'Stream', 6)]
  ] as const)('%s requires a unique influence leader', (id, exact) => {
    expect(qualifiesMilestone(id, 'a', [{ ...exact, leaders: ['a', 'b'] }])).toBe(false);
    expect(qualifiesMilestone(id, 'b', [exact])).toBe(false);
  });
  test('High Pass requires a landmark even above the tile threshold', () => {
    expect(qualifiesMilestone('High Pass', 'a', [component('habitat', 'Highland', 7)])).toBe(false);
  });
  test('Two Horizons requires two distinct habitat components of different types', () => {
    const board = [...linked(Array.from({ length: 4 }, () => fixture('Forest'))), ...Array.from({ length: 4 }, (_, i) => ({ ...fixture('Meadow'), x: 0, y: i + 3 }))];
    expect(qualifiesMilestone('Two Horizons', 'a', getComponents(board))).toBe(false);
    expect(qualifiesMilestone('Two Horizons', 'a', [component('habitat', 'Forest', 4), component('habitat', 'Meadow', 4)])).toBe(true);
    expect(qualifiesMilestone('Two Horizons', 'a', [component('habitat', 'Forest', 4), component('habitat', 'Forest', 4)])).toBe(false);
    expect(qualifiesMilestone('Two Horizons', 'a', [component('habitat', 'Forest', 4), component('habitat', 'Meadow', 4, ['a', 'b'])])).toBe(false);
  });
  test('score breakdown sums habitat, trails, streams and permanently earned milestones', () => {
    const game = createGame(seats(2), 99);
    const scores = calculateScores(game.board, game.players, game.milestones);
    for (const score of Object.values(scores)) expect(score.total).toBe(score.habitat + score.trail + score.stream + score.milestones);
  });
  test('final ties compare milestone count, then uniquely controlled scoring networks', () => {
    const players = createGame(seats(2), 99).players;
    const milestoneBoard = linked(Array.from({ length: 4 }, () => fixture('Forest'))).map((tile, i) => ({ ...tile, marker: i === 0 ? { owner: 'p0', mode: 'habitat' as const } : null }));
    const byMilestone = calculateStandings({ board: milestoneBoard, players, milestones: [{ id: 'Great Grove', claimedBy: 'p1', claimedTurn: 1 }] });
    expect(byMilestone[0]!.player).toBe('p1');
    expect(byMilestone[0]!.winner).toBe(true);
    const board = [
      ...linked(Array.from({ length: 6 }, () => fixture('Forest'))).map(tile => ({ ...tile, marker: { owner: 'p0', mode: 'habitat' as const } })),
      ...Array.from({ length: 3 }, (_, i) => ({ ...fixture('Meadow'), x: i, y: 2, marker: i === 0 ? { owner: 'p1', mode: 'habitat' as const } : null })),
      ...Array.from({ length: 3 }, (_, i) => ({ ...fixture('Highland'), x: i + 4, y: 2, marker: i === 0 ? { owner: 'p1', mode: 'habitat' as const } : null }))
    ];
    const byNetworks = calculateStandings({ board, players, milestones: [] });
    expect(byNetworks[0]!.player).toBe('p1');
    expect(byNetworks[0]!.total).toBe(byNetworks[1]!.total);
    expect(byNetworks[0]!.uniqueNetworks).toBe(2);
    expect(calculateStandings({ board: [fixture('Meadow')], players, milestones: [] }).every(score => score.winner)).toBe(true);
  });
});

describe('Atomic game actions, privacy, and persistence', () => {
  test('seed repeats initial board, market, and initiative', () => {
    expect(createGame(seats(3), 51)).toEqual(createGame(seats(3), 51));
  });
  test('turn limits and marker budget are configured centrally', () => {
    expect(config.turnsByPlayers).toEqual({ 2: 18, 3: 15, 4: 13, 5: 12 });
    expect(config.markers).toBe(8);
  });
  test('projection excludes private seed, RNG, bag order, action log and serial', () => {
    const game = createGame(seats(2), 23), view = project(game);
    for (const key of ['seed', 'rng', 'bag', 'actionLog', 'serial']) expect(view).not.toHaveProperty(key);
  });
  test('public view supports bot decision, foreign turns wait', () => {
    const game = createGame(seats(3), 23), view = project(game);
    expect(nextBotAction(view, game.active!)).toBeTruthy();
    expect(nextBotAction(view, seats(3).find(seat => seat.id !== game.active)!.id)).toBeNull();
  });
  test('valid placement commits once and advances revision and active seat', () => {
    const game = createGame(seats(2), 4), view = project(game), action = fallbackAction(view);
    const next = applyAction(game, game.active!, action);
    expect(next.board).toHaveLength(game.board.length + 1);
    expect(next.revision).toBe(game.revision + 1);
    expect(next.active).not.toBe(game.active);
  });
  test('invalid actor, stale action and invented tile reject atomically', () => {
    const game = createGame(seats(2), 7), action = fallbackAction(project(game)), before = serializeGame(game);
    expect(() => applyAction(game, 'spectator', action)).toThrow();
    expect(() => applyAction(game, game.active!, { ...action, revision: action.revision - 1 })).toThrow();
    expect(() => applyAction(game, game.active!, { ...action, tile: 'forged' })).toThrow();
    expect(serializeGame(game)).toBe(before);
  });
  test.each(['diagonal', 'occupied', 'disconnected', 'marker-budget', 'wrong-rotation'] as const)('rejects invalid %s action without changing state', reason => {
    const game = createGame(seats(2), 17), action = fallbackAction(project(game));
    let invalid = action;
    if (reason === 'wrong-rotation') invalid = { ...action, orientation: 9 as never };
    if (reason === 'diagonal') invalid = { ...action, x: 1, y: 1 };
    if (reason === 'occupied') invalid = { ...action, x: 0, y: 0 };
    if (reason === 'disconnected') invalid = { ...action, x: 100, y: -100 };
    if (reason === 'marker-budget') { game.players.find(player => player.id === game.active)!.markersLeft = 0; invalid = { ...action, marker: 'habitat' }; }
    const before = serializeGame(game);
    expect(() => applyAction(game, game.active!, invalid)).toThrow();
    expect(serializeGame(game)).toBe(before);
  });
  test('serialize/restore preserve state and action replay is deterministic', () => {
    const start = createGame(seats(2), 41);
    const one = applyAction(start, start.active!, fallbackAction(project(start)));
    expect(restoreGame(serializeGame(one))).toEqual(one);
    expect(replayGame(seats(2), 41, one.actionLog)).toEqual(one);
  });
  test('saved origin validation ignores object key order while checking its exact fields', () => {
    const game = createGame(seats(2), 71);
    game.board[0] = { y: 0, x: 0, orientation: 0, marker: null, landmark: null, ports: [], route: null, habitat: 'Meadow', id: 'origin' };
    expect(() => validateGame(game)).not.toThrow();
    game.board[0]!.x = 1;
    expect(() => validateGame(game)).toThrow('starting tile');
  });
  test('saved market serial must be the exact next offering sequence value', () => {
    const game = createGame(seats(2), 72);
    game.serial++;
    expect(() => validateGame(game)).toThrow('offering sequence');
  });
  test('saved placement history cannot reuse a tile identity', () => {
    const first = createGame(seats(2), 73);
    const second = applyAction(first, first.active!, fallbackAction(project(first)));
    const third = applyAction(second, second.active!, fallbackAction(project(second)));
    third.history[1]!.tile = third.history[0]!.tile;
    expect(() => validateGame(third)).toThrow('Duplicate tile in placement history');
  });
  test('preview cannot mutate the live game and exposes scoring delta', () => {
    const game = createGame(seats(2), 21), before = serializeGame(game), view = project(game), action = fallbackAction(view);
    expect(previewTurn(view, game.active!, action).board).toHaveLength(game.board.length + 1);
    expect(serializeGame(game)).toBe(before);
  });
});

describe('Seeded matches and conserved scenarios', () => {
  test.each([2, 3, 4, 5])('%i players complete a whole invariant-checked match', playerCount => {
    const result = simulate(2026 + playerCount, playerCount);
    expect(result.turns).toBe(config.turnsByPlayers[playerCount as 2 | 3 | 4 | 5]! * playerCount);
    expect(result.invalidActions).toBe(0);
    expect(result.invariantViolations).toBe(0);
    expect(result.scores).toHaveLength(playerCount);
    expect(result.winners.length).toBeGreaterThan(0);
    expect(result.game.history.map(event => event.actor)).toEqual(result.game.history.map((_, index) => {
      const round = Math.floor(index / playerCount), seat = (result.startingSeat + round + index % playerCount) % playerCount;
      return result.game.players[seat]!.id;
    }));
  }, 30000);
  test.each(scenarioNames)('scenario %s is reachable, conserved, and serializable', name => {
    const game = createScenario(name, seats(4));
    validateGame(game);
    expect(scenarioMatches(name, game)).toBe(true);
    expect(restoreGame(serializeGame(game))).toEqual(game);
    if (name === 'MILESTONE_RACE') {
      const claimed = game.milestones.filter(milestone => milestone.claimedBy);
      expect(claimed.length).toBeGreaterThan(0);
      for (const milestone of claimed) expect(game.history[milestone.claimedTurn! - 1]!.claims).toContain(milestone.id);
    }
  }, 30000);
});
