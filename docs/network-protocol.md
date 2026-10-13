# Network protocol

All HTTP and WebSocket traffic uses one origin. The server issues a random 256-bit `ot_session` cookie with `HttpOnly` and `SameSite=Lax`; HTTPS requests also set `Secure`. The browser never reads the token.

## HTTP

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/tables` | Create a table for any registered game with display name and game ID; optional seed/scenario in development only |
| `POST` | `/api/tables/:code/join` | Claim or restore a seat, or enter as spectator |
| `GET` | `/api/tables/:code` | Current projected room for this session |
| `POST` | `/api/tables/:code/bots` | Host adds a bot or replaces an Away seat during play |
| `POST` | `/api/tables/:code/start` | Host starts Hearthlands/Tidecall with 3–6, Saigon Grid with 2–6, or Blackout with 5–10 connected seats |
| `POST` | `/api/tables/:code/rematch` | Host starts a fresh finished Tidecall match in the same Table |
| `GET` | `/health` | Liveness |

Creation has `{ "name": "Minh", "gameId": "saigon-grid" }`; join has `{ "name": "Linh", "spectator": false }`. A room view includes code, invitation URL, game ID, host ID, self ID or null, spectator flag, seat connection states, and that game's projection when started. Eliminated Saigon Grid players receive the spectator projection. A room code is not an authentication secret; the cookie is the seat credential.

## Tidecall additions

Create with `gameId: "tidecall"` and optional `pacing: "RELAXED" | "STANDARD" | "FAST"`. Start needs 3–6 connected seats. Away bot takeover works during a match and retains the same seat. `POST /api/tables/:code/rematch` is host-only, requires a finished Tidecall game and connected human seats, and preserves the Table and spectators.

Room views include `matchId` and `deadlineAt`. Tidecall gameplay messages must include that match ID. Actions are `LOCK_FORECAST {round,value}`, `LOCK_COMPASS {round,adjustment}`, `PLAY_CARD {round,trick,card}`, and dealer `ADVANCE {round,phase}`. Server-only TIMEOUT is absent from the client schema. Forecast/Compass locks allow independent arrivals without a global-revision race; card/presentation actions enforce `expectedRevision`. Strict schemas reject client actor, scores, deck and outcome fields. An old match ID is rejected even if its round/trick numbers happen to match the new game.

## WebSocket

Durable room snapshots retain session credentials and accepted action IDs across restart. Restored human seats become Away and timed games wait for a seated reconnect. Server-host table deletion sends `TABLE_DELETED {code}` before closing the socket; clients stop retrying and show a closed-table view. Protected management routes are documented in [table storage](table-storage.md).

Connect to `/ws?table=CODE` using the same origin and browser cookie. The server rejects unknown rooms, missing sessions, and cross-origin upgrades. Messages are JSON and limited to 16 KiB.

Client to server:

```json
{"type":"GAME_ACTION","id":"ab10ad4a-4819-4c13-b942-40cd38ab7650","action":{"type":"BUILD_TRAIL","link":12}}
```

The action schema is selected by the room's game ID and validated at runtime with Zod. A UUID identifies each submitted intention; repeats from the same seat are acknowledged without applying twice. Saigon Grid messages may include `expectedRevision`; bids and trades also carry their local auction/trade revision. The server derives the player from the cookie and seat; it never accepts an actor ID in the message. The newest WebSocket tab controls the seat, while older tabs receive state without write permission.

Server to client:

- `STATE`: a fresh public room projection plus the viewer's private section, if seated.
- `ACTION_REJECTED`: understandable error text for an invalid or stale action.
- `ACTION_ACK`: a duplicate action ID was already applied.

On reconnect, the browser fetches its current projection and opens a new WebSocket. Its cookie reclaims the seat and pending action. A disconnected seat remains in the room; the host privilege transfers to another connected seat. State updates include `eventNumber` for debugging and stale-message investigation.
