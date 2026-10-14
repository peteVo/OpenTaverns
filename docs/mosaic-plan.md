# Mosaic implementation plan

Baseline: five existing games, 228 passing tests, typecheck/lint/build passing. Shared table cookies, projections, latest-tab control, UUID retries, atomic saves, Rules and rematch are reused. No localization or shared theme switch is currently implemented.

1. Add `packages/mosaic` with pure scoring, validated sequential two-tile transactions, deterministic bag/market/initiative, projection, replay and invariants. Server phases are DRAFTING and GAME_OVER; local staging is not authoritative.
2. Extend existing server dispatch, strict schemas, 2–4 seat limits, clocks/grace, takeover, restart and rematch. Register one lazy web renderer and shared rules content. Do not touch the other engines.
3. Add bounded public-information bots, complete match/security/scoring tests and 1,000 varied simulations.
4. Build the personal composition first: paired ceramic offers, large touch grid, staged order/undo/score delta, inspectable formations and opponent boards.
5. Render desktop/tablet/390/360/320 phones; critique and make at least two substantial refinement passes. Finish cross-game browser/regression checks and documentation.

## Exact rules decisions

Ten rounds, one two-tile turn per seat each round. Initial initiative is seeded; each round shifts its first seat clockwise. The market has five slots with fresh offer IDs on refill. The final consumed offer is not refilled because no drafting remains; four unused offers and the bag stay conserved at game over. There is no tile discard or extra supply.

Actions identify round, global turn, game revision, offer and ordered tile/cell pairs. All validation precedes any mutation. Scores are derived from boards: matching orthogonal edges ×2, maximal runs of 3/4/5 ×3/6/10, distinct-family 2×2 squares ×5, and the two original specified Commissions once each. Ties use square count, completed Commission count, then shared victory.

Relaxed turns allow five minutes, Standard three, Fast one. One platform reconnect grace is reused; deadline fallback drafts the first offer and uses the first legal cells in stable order. Explicit host bot replacement keeps the seat and board. Pending local choices use match/turn identity and survive Rules/reload without claiming server storage.

## Hallmark preflight and art direction

`DESIGN.md` is the locked family system: Fraunces roman / DM Sans, 4-point spacing, flat readable controls, CSS/SVG and short state motion. Macrostructure: **Workbench**, with the personal mosaic as the dominant object. Navigation: the existing compact game masthead; no marketing footer inside gameplay. Audience: friends on phones. Job: draft two tiles, compose, confirm. Tone: quiet contemporary ceramic studio.

Signature: five distinct geometric tile marks and fine surface hatching, inset into a precise grout grid. Tide uses nested waves, Fern a paired stem, Ember a split flame, Ochre a four-point sun, Orchid offset petals. Light uses chalk/ink with restrained colored ceramics; dark uses fired-charcoal and cream labels while retaining tile colors. No borrowed tile motifs, pattern lines, factories, penalties, marble textures or dashboard cards.

Scope: engine package, local workspace exports, server dispatch/tests, lazy client/selection/Rules, simulation runner, browser fixtures/tests and docs. Existing saved data and private game projections are preserved.
