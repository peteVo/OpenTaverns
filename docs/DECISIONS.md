# Decision record

This log records decisions visible in the current code and documentation. **Confirmed** means the implementation or an explicit project document establishes the choice. **Inferred** labels a likely rationale that the repository does not state as a historical fact.

## Separate, headless game packages — confirmed

**Decision:** Keep each game's rules in `packages/<game>` and integrate it through explicit server dispatch and a game-specific client renderer.

**Evidence/reason:** The six packages export independent engine, projection, Rules and bot/simulation code. This keeps game validation out of React and lets bots/tests use the same rules. The code proves the boundary; the maintainability rationale is inferred. The cost is a small amount of explicit per-game dispatch in the shared server.

## Server-authoritative actions and privacy projections — confirmed

**Decision:** Clients send proposed actions; the server validates them and sends public or viewer-specific state projections.

**Evidence/reason:** Implemented in game engines, server message handlers and projections; also described in `docs/security.md`. This prevents clients from deciding outcomes or receiving private information they do not own. It requires each game to maintain its own clear projection rules.

## Shared table transport, game-owned rules — confirmed

**Decision:** Reuse sessions, table codes, WebSockets, reconnect, spectators, persistence, bot seat management and the shared Rules presentation. Keep game mechanics and game-specific renderers inside each module.

**Evidence/reason:** Shared logic is in `apps/server` and `apps/web`; domain behavior is in game packages. The architecture avoids a universal game framework and allows sequential, economic, simultaneous, card and hidden-role games to use one table lifecycle. The trade-off is explicit integration work when adding a game.

## JSON snapshots on one authoritative server — confirmed

**Decision:** Store each table as an atomic versioned JSON file in `OPENTAVERNS_DATA_DIR`, with a lock allowing only one server process per data directory.

**Evidence/reason:** `apps/server/src/storage.ts` and `docs/table-storage.md`. This keeps friend-table hosting simple and recovers tables after process restarts. Synchronous file writes and single-process operation limit throughput and horizontal scaling; shared transactional storage and room coordination are prerequisites for multiple instances.

## No account service — confirmed

**Decision:** Use opaque browser seat credentials and display names; do not require player accounts.

**Evidence/reason:** Session handling and `docs/security.md`; the public product description says no account is needed. This reduces join friction but means the existing browser credential is needed to reclaim a seat after restart/device changes.

## Structured Rules content and one responsive presentation — confirmed

**Decision:** Each game supplies its own structured rules; the shared client presents it in the same in-game Rules sheet.

**Evidence/reason:** Game `rules.ts` exports and `apps/web/src/Rules.tsx`/Rules components. This avoids separate rule overlays and leaves mechanics owned by each game. The cost is maintaining game-specific content alongside the engine.

## Single-instance deployment — confirmed

**Decision:** Deploy one server instance with persistent storage; do not scale horizontally.

**Evidence/reason:** `docs/table-storage.md`, `docs/security.md`, and `render.yaml`. WebSocket clients and rooms are process-local, and the directory lock prevents concurrent writers. Horizontal scale requires coordinated rooms, retries and persistence, which are not implemented.

## Decisions not recorded

The repository does not establish historical rationale for individual game balance, styling choices beyond `DESIGN.md`, or the choice of Render as the only production platform. Do not add explanations for those as remembered fact; cite implementation evidence and mark inference if later needed.
