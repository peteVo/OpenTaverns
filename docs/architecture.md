# Architecture

## Boundaries

The room server knows codes, seats, host privilege, spectators, cookie sessions, connections, and one selected game ID. Hearthlands owns Regions, Materials, private hands, and Renown. Saigon Grid owns its city circuit, Holdings, Credits, auctions, trades, and obligations. Each browser renders a projected snapshot and submits a typed action to the selected game's headless `applyAction` engine. Rejected actions leave the original state unchanged.

Room actions are processed sequentially on one Node event loop. This makes trade acceptance atomic for one server instance. Client-supplied IDs select an existing game object or recipient; they never supply random results or authoritative balances.

## Determinism and saves

Hearthlands `createGame(players, seed)` derives terrain, production marks, and Exchanges from a server-owned world seed. A separate 128-bit private key drives an HMAC-SHA-256 counter stream for the Chronicle shuffle, production, and random transfers. In development, an explicit debug seed deterministically derives both streams. Hearthlands `serializeGame`, `restoreGame`, and `replayGame` support snapshots and replay from its validated action history.

Saigon Grid uses a serializable seeded random state for dice and shuffled event decks. Its `gameVersion: 1` state includes all rules data required to resume a match, including auctions, trades, debt, ownership, and supply. The public projection omits the random state and undrawn decks. Connection presence is transport metadata and does not affect either game's rules.

The present room registry is in memory. A durable store can write the serialized room/game after each accepted action, using a transaction or per-room lock. Keep the room server single-instance until a shared store and cross-instance coordination exist.

## State delivery

Hearthlands `project(game, viewerId)` gives everyone the same board, turn, public totals, achievements, offers, remaining deck count, and events. It adds exact inventory and unrevealed cards only for that viewer. The deck order, private random key/counter, and action log stay on the server. After game over, remaining hidden Legacy cards and final Renown become public. Saigon Grid `project(game)` gives all viewers the same public portfolios and ledger, while withholding random state and undrawn event decks.

The server broadcasts a fresh projection after each accepted action or connection change. This is intentionally simple for a small table; measured traffic can justify deltas later.

## Adding a game

Add a game package with metadata, serializable state, an authoritative action function, a viewer-specific projection, and a client renderer. Extend the server's game ID dispatch. The platform's room/session messages remain about participants and actions, without assuming hexes, materials, cards, or turns.
