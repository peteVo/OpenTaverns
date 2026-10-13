# Saigon Grid engine

`packages/saigon-grid` owns the game rules and has no browser or socket dependency. `createGame(seats, seed)` starts a deterministic 2–6 player match; `applyAction(game, playerId, action)` validates and applies one authoritative action. The server serializes actions per room, sends each client a public `projectGame` view, and keeps the RNG state and shuffled City/Civic Event decks private. `gameVersion: 1` is stored with every state. See [architecture](architecture.md), [network protocol](network-protocol.md), and [security](security.md) for the room boundary.

The 28-stop [board and full rules](saigon-grid.md) define streets, four game Districts, two Transit Hubs, Electricity, Water, City/Civic Events, Municipal Review, and Central Exchange. Players buy unclaimed Holdings or open untimed auctions. Auctions, trades, and loan operations recheck Credits, ownership, phase, and revision at application time. District ownership enables even Development through three pieces and one Landmark per street, subject to shared supply. A debt phase allows sales, Secured Loans, and trades before an explicit Insolvency decision. The last solvent player wins.

`validateGame` checks phase obligations, turn order, auction/trade references, ownership, loan and development constraints, finite balances, and piece supply. The server checks session ownership, origins, idempotency keys, and action rate limits before invoking the engine. The bot uses the same public actions as a person; it has no private deck knowledge. Development-only named scenarios in `scenarios.ts` are unavailable from production routes.

Checks from the repository root:

```sh
npm test
npm run test:e2e
npm run test:e2e -- --development tests/e2e/saigon-scenarios.spec.ts
npm run simulate -- --game saigon-grid --games 1000
```

The rule tests cover buying, auction resolution, bids and revisions, trades, Districts, Developments, Landmarks, Hubs, Companies, Review, both event decks, debt, Insolvency, and projection. Browser checks cover two-tab auctions, reconnect, spectators, bots, mobile decisions, and the result dialog. The 1,000-game seeded bot batch reported in [Saigon Grid rules](saigon-grid.md) completed without deadlocks or invariant failures. Rooms restore from durable snapshots after restart; see [table storage](table-storage.md).
