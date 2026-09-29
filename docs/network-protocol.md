# Network protocol

All HTTP and WebSocket traffic uses one origin. The server issues a random 256-bit `ot_session` cookie with `HttpOnly` and `SameSite=Lax`; HTTPS requests also set `Secure`. The browser never reads the token.

## HTTP

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/tables` | Create a Hearthlands or Saigon Grid table with display name and game ID; optional seed/scenario in development only |
| `POST` | `/api/tables/:code/join` | Claim or restore a seat, or enter as spectator |
| `GET` | `/api/tables/:code` | Current projected room for this session |
| `POST` | `/api/tables/:code/bots` | Host adds a bot or replaces an Away seat; Saigon Grid permits Away takeover during play |
| `POST` | `/api/tables/:code/start` | Host starts Hearthlands with 3–6 or Saigon Grid with 2–6 connected seats |
| `GET` | `/health` | Liveness |

Creation has `{ "name": "Minh", "gameId": "saigon-grid" }`; join has `{ "name": "Linh", "spectator": false }`. A room view includes code, invitation URL, game ID, host ID, self ID or null, spectator flag, seat connection states, and that game's projection when started. Eliminated Saigon Grid players receive the spectator projection. A room code is not an authentication secret; the cookie is the seat credential.

## WebSocket

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
