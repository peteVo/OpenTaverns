import { describe, expect, it } from 'vitest';
import { applyAction, canBuildLodge, canBuildTrail, createGame, emptyInventory, exchangeRatio, longestRoute, materials, project, replayGame, restoreGame, serializeGame, type Game, type Inventory, type RandomState } from './index.js';

const names = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `Player ${i + 1}` }));
function setup(n = 3, seed = 482913, privateRandom?: RandomState) {
  let game = createGame(names(n), seed, privateRandom);
  while (game.phase === 'SETUP_FORWARD' || game.phase === 'SETUP_REVERSE') {
    const actor = game.active;
    const site = game.sites.find(s => canBuildLodge(game, actor, s.id, true));
    expect(site).toBeDefined();
    game = applyAction(game, actor, { type: 'SETUP_LODGE', site: site!.id });
    const link = game.sites[site!.id]!.links.find(id => canBuildTrail(game, actor, id, site!.id));
    expect(link).toBeDefined();
    game = applyAction(game, actor, { type: 'SETUP_TRAIL', link: link! });
  }
  return game;
}
const full = (n = 10): Inventory => Object.fromEntries(materials.map(m => [m, n])) as Inventory;
function setHand(game: Game, id: string, hand: Inventory) { const p = game.players.find(p => p.id === id)!; for (const m of materials) game.supply[m] -= hand[m] - p.inventory[m]; p.inventory = hand; }

describe('world and setup', () => {
  it('builds a connected, deterministic 19 region graph', () => {
    const a = createGame(names(3), 482913), b = createGame(names(3), 482913);
    expect(a.regions).toHaveLength(19); expect(a.sites).toHaveLength(54); expect(a.links).toHaveLength(72);
    expect(a.regions).toEqual(b.regions); expect(a.exchanges).toEqual(b.exchanges); expect(a.deck).toEqual(b.deck);
    for (const r of a.regions) expect(r.sites).toHaveLength(6);
    for (const l of a.links) { expect(a.sites[l.a]!.links).toContain(l.id); expect(a.sites[l.b]!.links).toContain(l.id); }
  });
  it('separates public world generation from private game randomness', () => {
    const a = createGame(names(3), 482913, [1, 2, 3, 4]);
    const b = createGame(names(3), 482913, [5, 6, 7, 8]);
    expect(a.regions).toEqual(b.regions); expect(a.exchanges).toEqual(b.exchanges);
    expect(a.initialRng).not.toEqual(b.initialRng); expect(a.deck).not.toEqual(b.deck);
    expect(project(a).seed).toBeNull();
    expect(replayGame(names(3), 482913, [], a.initialRng)).toEqual(a);
  });
  it('replays a private-key production draw from the validated history', () => {
    const game = setup(3, 482913, [1, 2, 3, 4]);
    const rolled = applyAction(game, 'p0', { type: 'ROLL' });
    expect(replayGame(names(3), 482913, rolled.actionHistory, rolled.initialRng)).toEqual(rolled);
    expect(JSON.stringify(project(rolled))).not.toContain('rngCounter');
  });
  for (const n of [3, 5, 6]) it(`completes snake setup for ${n} players`, () => {
    const g = setup(n); expect(g.phase).toBe('PRODUCTION_REQUIRED'); expect(g.turn).toBe(1);
    expect(g.players.every(p => p.lodgesLeft === 4 && p.trailsLeft === 16)).toBe(true);
    expect(g.sites.filter(s => s.owner)).toHaveLength(n * 2);
    expect(restoreGame(serializeGame(g))).toEqual(g);
    expect(replayGame(names(n), 482913, g.actionHistory)).toEqual(g);
  });
  it('rejects an illegal setup placement without mutating state', () => {
    const g = createGame(names(3), 3), before = serializeGame(g);
    expect(() => applyAction(g, 'p1', { type: 'SETUP_LODGE', site: 0 })).toThrow('Wait');
    expect(serializeGame(g)).toBe(before);
  });
  it('grants second-Lodge starting Materials and keeps Sites spaced', () => {
    const g = setup();
    for (const p of g.players) {
      const second = g.sites.filter(s => s.owner === p.id)[1]!;
      const expected = second.regions.map(id => g.regions[id]!.terrain).filter(t => t !== 'Badlands').length;
      expect(totalHand(p.inventory)).toBe(expected);
    }
    for (const s of g.sites.filter(s => s.owner)) for (const id of s.links) {
      const l = g.links[id]!;
      expect(g.sites[l.a === s.id ? l.b : l.a]!.owner).toBeUndefined();
    }
  });
});

const totalHand = (hand: Inventory) => materials.reduce((n, m) => n + hand[m], 0);

describe('actions and privacy', () => {
  it('validates turn, phase, cost, and ownership', () => {
    const g = setup();
    expect(() => applyAction(g, 'p1', { type: 'ROLL' })).toThrow('Wait');
    expect(() => applyAction(g, 'p0', { type: 'BUILD_TRAIL', link: 1 })).toThrow('phase');
    const rolled = applyAction(g, 'p0', { type: 'ROLL' });
    expect(() => applyAction(rolled, 'p1', { type: 'END_TURN' })).toThrow();
    expect(() => applyAction(rolled, 'p0', { type: 'UPGRADE_HALL', site: g.sites.find(s => s.owner === 'p1')!.id })).toThrow();
  });
  it('produces beside matching regions and stops at supply depletion', () => {
    const g = setup(); g.rng = [0, 0, 0, 2]; g.rngCounter = 0;
    const value = 1;
    const s = g.sites.find(s => s.owner === 'p0' && s.regions.some(r => g.regions[r]!.id !== g.rover))!;
    const r = g.regions[s.regions.find(r => g.regions[r]!.id !== g.rover)!]!;
    r.value = value; const material = ({ Woodlands: 'Timber', Highlands: 'Stone', Farmland: 'Provisions', Meadows: 'Textiles', Ironlands: 'Metal' } as const)[r.terrain as Exclude<typeof r.terrain, 'Badlands'>];
    if (material) { const extra = g.supply[material] - 1; g.supply[material] = 1; g.players[1]!.inventory[material] += extra; const before = g.players[0]!.inventory[material]; const next = applyAction(g, 'p0', { type: 'ROLL' }); expect(next.players[0]!.inventory[material] - before).toBeLessThanOrEqual(1); expect(next.supply[material]).toBeGreaterThanOrEqual(0); }
  });
  it('keeps hidden hands and deck out of public projections', () => {
    const g = setup(); g.supply.Metal -= 3 - g.players[0]!.inventory.Metal; g.players[0]!.inventory.Metal = 3; g.players[0]!.cards.push({ id: 77, kind: 'Legacy', boughtTurn: 0 });
    const publicState = project(g);
    expect(publicState.private).toBeNull(); expect(publicState.seed).toBeNull(); expect(JSON.stringify(publicState)).not.toContain('Legacy'); expect(JSON.stringify(publicState)).not.toContain('"rng"');
    expect(project(g, 'p1').private?.cards).toEqual([]);
    expect(project(g, 'p0').private?.cards[0]?.kind).toBe('Legacy');
  });
  it('settles an exchange once, atomically', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; setHand(g, 'p0', full(4)); setHand(g, 'p1', full(4));
    const offered = emptyInventory(), requested = emptyInventory(); offered.Timber = 2; requested.Metal = 1;
    g = applyAction(g, 'p0', { type: 'OFFER', to: 'p1', offered, requested });
    const offer = g.offer!.id; const paid = applyAction(g, 'p1', { type: 'ACCEPT_OFFER', offer });
    expect(paid.players[0]!.inventory.Timber).toBe(2); expect(paid.players[1]!.inventory.Metal).toBe(3);
    expect(() => applyAction(paid, 'p1', { type: 'ACCEPT_OFFER', offer })).toThrow('no longer');
  });
  it('uses the best owned exchange ratio', () => {
    const g = setup(); g.exchanges[0]!.site = g.sites.find(s => s.owner === 'p0')!.id; g.exchanges[0]!.material = 'Timber';
    expect(exchangeRatio(g, 'p0', 'Timber')).toBe(2); expect(exchangeRatio(g, 'p0', 'Stone')).toBe(4);
  });
  it('charges construction costs, consumes stock, and rejects rival upgrades', () => {
    let g = setup();
    let trailId: number | undefined;
    for (let seed = 1; seed <= 50 && trailId === undefined; seed++) {
      g = setup(3, seed);
      trailId = g.links.find(l => {
        if (!canBuildTrail(g, 'p0', l.id)) return false;
        const after = structuredClone(g); after.links[l.id]!.owner = 'p0';
        return after.sites.some(s => canBuildLodge(after, 'p0', s.id));
      })?.id;
    }
    expect(trailId).toBeDefined();
    g.phase = 'MAIN_ACTION'; setHand(g, 'p0', full(5));
    const before = { ...g.players[0]!.inventory };
    g = applyAction(g, 'p0', { type: 'BUILD_TRAIL', link: trailId! });
    expect(g.players[0]!.trailsLeft).toBe(15);
    expect(g.players[0]!.inventory.Timber).toBe(before.Timber - 1);
    expect(g.players[0]!.inventory.Stone).toBe(before.Stone - 1);
    const lodge = g.sites.find(s => canBuildLodge(g, 'p0', s.id))!;
    g = applyAction(g, 'p0', { type: 'BUILD_LODGE', site: lodge.id });
    expect(g.players[0]!.lodgesLeft).toBe(3);
    expect(g.players[0]!.inventory.Provisions).toBe(before.Provisions - 1);
    expect(g.players[0]!.inventory.Textiles).toBe(before.Textiles - 1);
    expect(() => applyAction(g, 'p0', { type: 'UPGRADE_HALL', site: g.sites.find(s => s.owner === 'p1')!.id })).toThrow();
    g = applyAction(g, 'p0', { type: 'UPGRADE_HALL', site: lodge.id });
    expect(g.sites[lodge.id]!.structure).toBe('Hall');
    expect(g.players[0]!.lodgesLeft).toBe(4);
    expect(g.players[0]!.hallsLeft).toBe(3);
    expect(g.players[0]!.inventory.Metal).toBe(before.Metal - 2);
  });
  it('doubles Hall production and blocks production under the Rover', () => {
    const g = setup(); g.rng = [0, 0, 0, 2]; g.rngCounter = 0;
    const site = g.sites.find(s => s.owner === 'p0' && s.regions.some(id => id !== g.rover && g.regions[id]!.terrain !== 'Badlands'))!;
    const rid = site.regions.find(id => id !== g.rover && g.regions[id]!.terrain !== 'Badlands')!;
    for (const r of g.regions) if (r.value === 1) r.value = 9;
    g.regions[rid]!.value = 1;
    const material = ({ Woodlands: 'Timber', Highlands: 'Stone', Farmland: 'Provisions', Meadows: 'Textiles', Ironlands: 'Metal' } as const)[g.regions[rid]!.terrain as Exclude<typeof g.regions[number]['terrain'], 'Badlands'>];
    site.structure = 'Hall'; g.players[0]!.hallsLeft--; g.players[0]!.lodgesLeft++;
    const before = g.players[0]!.inventory[material];
    const produced = applyAction(g, 'p0', { type: 'ROLL' });
    expect(produced.players[0]!.inventory[material]).toBe(before + 2);
    g.rover = rid;
    const blocked = applyAction(g, 'p0', { type: 'ROLL' });
    expect(blocked.players[0]!.inventory[material]).toBe(before);
  });
  it('rejects bad offers and lets recipients decline or proposers cancel', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; setHand(g, 'p0', full(2));
    const offered = emptyInventory(), requested = emptyInventory(); offered.Timber = 1; requested.Stone = 1;
    expect(() => applyAction(g, 'p0', { type: 'OFFER', to: 'p0', offered, requested })).toThrow();
    const before = serializeGame(g);
    g = applyAction(g, 'p0', { type: 'OFFER', to: 'p1', offered, requested });
    expect(() => applyAction(g, 'p2', { type: 'ACCEPT_OFFER', offer: g.offer!.id })).toThrow();
    g = applyAction(g, 'p1', { type: 'REJECT_OFFER', offer: g.offer!.id });
    expect(g.offer).toBeNull();
    expect(g.players[0]!.inventory.Timber).toBe(JSON.parse(before).players[0].inventory.Timber);
    g = applyAction(g, 'p0', { type: 'OFFER', to: 'p1', offered, requested });
    g = applyAction(g, 'p0', { type: 'CANCEL_OFFER', offer: g.offer!.id });
    expect(g.offer).toBeNull();
  });
  it('plays Survey only on a connected pair of legal Trails', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; g.turn = 2;
    g.players[0]!.cards.push({ id: 1, kind: 'Survey', boughtTurn: 1 });
    const legal = g.links.filter(l => canBuildTrail(g, 'p0', l.id));
    const pair = legal.flatMap(a => legal.filter(b => a.id !== b.id && ![a.a, a.b].some(id => id === b.a || id === b.b)).map(b => [a.id, b.id]));
    expect(pair.length).toBeGreaterThan(0);
    expect(() => applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: 1, links: pair[0]! })).toThrow('connected');
    const first = legal.find(a => legal.some(b => a.id !== b.id && [a.a, a.b].some(id => id === b.a || id === b.b)))!;
    const second = legal.find(b => first.id !== b.id && [first.a, first.b].some(id => id === b.a || id === b.b))!;
    const stock = g.players[0]!.trailsLeft;
    g = applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: 1, links: [first.id, second.id] });
    expect(g.players[0]!.trailsLeft).toBe(stock - 2);
    expect(g.players[0]!.cards).toEqual([]);
  });
  it('plays Harvest and Levy without creating Materials', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; g.turn = 2;
    g.players[0]!.cards.push({ id: 1, kind: 'Harvest', boughtTurn: 1 }, { id: 2, kind: 'Levy', boughtTurn: 1 });
    setHand(g, 'p1', { Timber: 2, Stone: 0, Provisions: 0, Textiles: 0, Metal: 0 });
    setHand(g, 'p2', { Timber: 1, Stone: 0, Provisions: 0, Textiles: 0, Metal: 0 });
    const before = g.players[0]!.inventory.Timber;
    g = applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: 1, material: 'Timber' });
    expect(g.players[0]!.inventory.Timber).toBe(before + 2);
    expect(() => applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: 2, material: 'Timber' })).toThrow('one');
    g.turn++; g.playedCard = false;
    g = applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: 2, material: 'Timber' });
    expect(g.players[0]!.inventory.Timber).toBe(before + 5);
    expect(g.players[1]!.inventory.Timber + g.players[2]!.inventory.Timber).toBe(0);
  });
  it('lets a Scout claim Vanguard and transfers it only when overtaken', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; g.turn = 2;
    g.players[0]!.playedScouts = 2;
    g.players[0]!.cards.push({ id: 1, kind: 'Scout', boughtTurn: 1 });
    const region = g.regions.find(r => r.id !== g.rover && r.sites.every(id => !g.sites[id]!.owner))!;
    g = applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: 1, region: region.id });
    expect(g.rover).toBe(region.id);
    expect(g.vanguardOwner).toBe('p0');
    g.players[1]!.playedScouts = 3;
    g = applyAction(g, 'p0', { type: 'END_TURN' });
    expect(g.vanguardOwner).toBe('p0');
    g.phase = 'MAIN_ACTION'; g.players[1]!.cards.push({ id: 2, kind: 'Scout', boughtTurn: 1 });
    g = applyAction(g, 'p1', { type: 'PLAY_CHRONICLE', card: 2, region: g.regions.find(r => r.id !== g.rover && r.sites.every(id => !g.sites[id]!.owner))!.id });
    expect(g.vanguardOwner).toBe('p1');
  });
  it('applies generic and specialized supply rates', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; setHand(g, 'p0', full(4));
    const own = g.sites.find(s => s.owner === 'p0')!.id;
    g.exchanges[0] = { site: own };
    const before = { ...g.players[0]!.inventory };
    g = applyAction(g, 'p0', { type: 'SUPPLY_EXCHANGE', give: 'Timber', receive: 'Metal' });
    expect(g.players[0]!.inventory.Timber).toBe(before.Timber - 3);
    expect(g.players[0]!.inventory.Metal).toBe(before.Metal + 1);
    g.exchanges[0] = { site: own, material: 'Stone' };
    g = applyAction(g, 'p0', { type: 'SUPPLY_EXCHANGE', give: 'Stone', receive: 'Provisions' });
    expect(g.players[0]!.inventory.Stone).toBe(before.Stone - 2);
  });
  it('runs one construction or pass per player in six-player Wayfare', () => {
    let g = setup(6); g.phase = 'MAIN_ACTION'; g.active = g.players[5]!.id;
    g = applyAction(g, g.active, { type: 'END_TURN' });
    expect(g.phase).toBe('WAYFARE'); expect(g.active).toBe('p0');
    for (let i = 0; i < 6; i++) g = applyAction(g, g.active, { type: 'END_WAYFARE' });
    expect(g.phase).toBe('PRODUCTION_REQUIRED'); expect(g.active).toBe('p0');
  });
  it('requires discard, relocation, and a legal Rover target', () => {
    let g = setup();
    g.rng = [0, 0, 0, 8]; g.rngCounter = 0;
    setHand(g, 'p1', full(2));
    g = applyAction(g, 'p0', { type: 'ROLL' }); expect(g.phase).toBe('DISCARD_REQUIRED');
    expect(() => applyAction(g, 'p0', { type: 'MOVE_ROVER', region: 0 })).toThrow();
    const discarded = emptyInventory(); discarded.Timber = 2; discarded.Stone = 2; discarded.Provisions = 1;
    g = applyAction(g, 'p1', { type: 'DISCARD', materials: discarded });
    expect(g.phase).toBe('ROVER_MOVE_REQUIRED');
    const target = g.regions.find(r => r.id !== g.rover && r.sites.some(s => g.sites[s]!.owner === 'p1'))!;
    g = applyAction(g, 'p0', { type: 'MOVE_ROVER', region: target.id });
    expect(g.roverTargets).toContain('p1');
    expect(() => applyAction(g, 'p0', { type: 'TARGET_ROVER', player: 'not-a-player' })).toThrow();
    g = applyAction(g, 'p0', { type: 'TARGET_ROVER', player: 'p1' }); expect(g.phase).toBe('MAIN_ACTION');
  });
  it('keeps newly bought Chronicles unplayable until another turn', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; setHand(g, 'p0', full()); g.deck.push('Harvest');
    g = applyAction(g, 'p0', { type: 'BUY_CHRONICLE' }); const card = g.players[0]!.cards.at(-1)!;
    expect(() => applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: card.id, material: 'Timber' })).toThrow('cannot be played');
    g.turn++; g = applyAction(g, 'p0', { type: 'PLAY_CHRONICLE', card: card.id, material: 'Timber' });
    expect(g.players[0]!.cards.some(c => c.id === card.id)).toBe(false);
  });
  it('ends at nine Renown and rejects later actions', () => {
    let g = setup(); g.phase = 'MAIN_ACTION'; setHand(g, 'p0', full());
    g.players[0]!.cards = Array.from({ length: 6 }, (_, i) => ({ id: i + 1, kind: 'Legacy', boughtTurn: 0 })); g.nextCardId = 7; g.deck.push('Legacy');
    g = applyAction(g, 'p0', { type: 'BUY_CHRONICLE' });
    expect(g.phase).toBe('GAME_OVER'); expect(g.winner).toBe('p0');
    expect(project(g).players[0]!.revealedCards).toContain('Legacy');
    expect(() => applyAction(g, 'p0', { type: 'END_TURN' })).toThrow('ended');
  });
  it('checks victory when a player receives the turn', () => {
    let g = setup(); g.phase = 'MAIN_ACTION';
    g.players[1]!.cards = Array.from({ length: 7 }, (_, i) => ({ id: i + 1, kind: 'Legacy', boughtTurn: 0 }));
    g = applyAction(g, 'p0', { type: 'END_TURN' });
    expect(g.active).toBe('p1'); expect(g.phase).toBe('GAME_OVER'); expect(g.winner).toBe('p1');
  });
});

describe('achievements', () => {
  const route = (g: Game, ids: number[], owner = 'p0') => { for (const id of ids) g.links[id]!.owner = owner; g.players.find(p => p.id === owner)!.trailsLeft -= ids.length; };
  const boundary = (g: Game, regionId: number) => {
    const hex = g.regions[regionId]!.sites;
    return hex.map((s, i) => g.sites[s]!.links.find(id => { const l = g.links[id]!; return [l.a,l.b].includes(hex[(i+1)%6]!); })!);
  };
  it('counts branches by exact edge-simple traversal', () => {
    const g = createGame(names(3), 4);
    const center = g.sites.find(s => s.links.length === 3)!;
    const [a,b,c] = center.links;
    route(g, [a!,b!,c!]);
    expect(longestRoute(g, 'p0')).toBe(2);
    g.sites[center.id]!.owner = 'p1'; g.sites[center.id]!.structure = 'Lodge'; g.players[1]!.lodgesLeft--;
    expect(longestRoute(g, 'p0')).toBe(1);
  });
  it('counts loops without reusing an edge', () => {
    const g = createGame(names(3), 5);
    const ids = boundary(g, 0);
    route(g, ids); expect(longestRoute(g, 'p0')).toBe(6);
  });
  it('keeps a tied Great Route holder and transfers when overtaken', () => {
    let g = createGame(names(3), 5); g.phase = 'MAIN_ACTION';
    route(g, boundary(g, 0), 'p0');
    g = applyAction(g, 'p0', { type: 'END_TURN' });
    expect(g.routeOwner).toBe('p0');
    route(g, boundary(g, 18), 'p1'); g.phase = 'MAIN_ACTION';
    g = applyAction(g, 'p1', { type: 'END_TURN' });
    expect(g.routeOwner).toBe('p0');
    const extension = g.links.find(l => !l.owner && [l.a,l.b].some(id => g.regions[18]!.sites.includes(id)))!;
    route(g, [extension.id], 'p1'); g.phase = 'MAIN_ACTION';
    g = applyAction(g, 'p2', { type: 'END_TURN' });
    expect(g.routeOwner).toBe('p1');
  });
});
