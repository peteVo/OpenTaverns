# OpenTaverns

OpenTaverns is a browser table for friends with two original games. **Hearthlands** is a 3–6 player illustrated frontier strategy game about connected routes, construction, and Renown. **Saigon Grid** is a 2–6 player city strategy game about streets, auctions, development, negotiation, debt, and Insolvency. Players create or join with a table code, invitation link, or QR code and a display name. No account is needed.

![Hearthlands board on desktop](docs/images/hearthlands-desktop.png)

[See the mobile table](docs/images/hearthlands-mobile.png).

![Saigon Grid city circuit on desktop](docs/images/qa/grid-board-desktop-pass2.png)

[See the Saigon Grid phone board](docs/images/qa/grid-board-mobile-final.png) and [match result](docs/images/qa/qa-grid-result-mobile-pass2.png).

## Start locally

Requirements: Node.js 20+ and npm.

```sh
npm ci
npm run dev
```

Open `http://localhost:5173`. The web development server forwards API and WebSocket traffic to the authoritative server on port 3000. Choose a game and create a table, then open the invitation in separate browser profiles or devices. The host can add bots in the lobby.

For local diagnosis, the development server exposes full table state at `http://localhost:3000/api/debug/tables/CODE`. It is disabled in production and restricted to loopback access.

For a production-style local run:

```sh
npm run build
npm start -w @opentaverns/server
```

Open `http://localhost:3000`. The server serves the built client and WebSockets from one origin.

## Play over local Wi-Fi

Run `npm run dev` on the host computer. Open `http://HOST_IP:5173` from devices on the same Wi-Fi. If the host creates from `localhost`, the invitation replaces that hostname with a private LAN address when one is available. Allow ports 5173 and 3000 through the host firewall if needed. Keep the host computer awake during the match.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Web client and game server |
| `npm run build` | Typecheck and build the production client/server |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | ESLint |
| `npm test` | Rules tests |
| `npm run test:e2e` | Real Edge browser checks; requires Microsoft Edge |
| `npm run simulate -- --games 1000` | Six-player bot simulations |
| `npm run simulate -- --games 100 --players 5 --seed 482913` | Reproduce a simulation range |
| `npm run simulate -- --game saigon-grid --games 1000` | Saigon Grid bot simulations |

## How Hearthlands works

The world has 19 hexagonal Regions, 54 Sites, and 72 Links. Each player places a Lodge and connected Trail in seat order, then repeats in reverse order. The second Lodge grants one Material from each adjacent productive Region, subject to shared supply.

On a turn, the active player draws from a ten-mark production wheel. Marks 1–9 produce the matching Regions; Lodges receive one Material and Halls two. A 10 wakes the Rover. Hands above eight discard half, rounded down; the active player moves the Rover and may take one random Material from an eligible neighboring player. The Rover blocks its Region.

The active player may build, exchange with the supply or another player, draw a Chronicle Card, and play one previously drawn Chronicle Card. A five or six-player round ends with **Wayfare**: each player may construct one piece or pass, without another production draw. Trails must connect to a player's network, Lodges must connect to a Trail and cannot neighbor an occupied Site, and Halls upgrade an owned Lodge. Ownership and costs are checked by the server.

| Purchase | Timber | Stone | Provisions | Textiles | Metal |
| --- | ---: | ---: | ---: | ---: | ---: |
| Trail | 1 | 1 | 0 | 0 | 0 |
| Lodge | 1 | 1 | 1 | 1 | 0 |
| Hall | 0 | 0 | 2 | 0 | 2 |
| Chronicle Card | 0 | 0 | 1 | 1 | 1 |

Supply exchanges are 4:1 by default, 3:1 with a generic Exchange, or 2:1 for a matching specialized Exchange. A Lodge is worth one Renown; a Hall is worth two. Great Route and Vanguard each add two. Legacy Chronicle Cards add hidden Renown. Reach **9 Renown** on your own turn to win.

See [the full Hearthlands rules](docs/hearthlands-engine.md) for placement, actions, cards, achievements, and ties.

## How Saigon Grid works

Players travel a 28-stop metropolitan circuit, buy real Ho Chi Minh City street names as Holdings, compete in open auctions, complete Districts, add Developments and Landmarks, trade, and manage Credits and Secured Loans. The two Transit Hubs are **Bến Xe Miền Đông** and **Bến Xe Miền Tây**; the Companies are **Electricity** and **Water**. The last solvent player wins. The rules are original to Saigon Grid, and its Districts are game groupings rather than administrative claims. See the [Saigon Grid rules and verified names](docs/saigon-grid.md) and [engine guide](docs/saigon-grid-engine.md).

## Architecture

- `packages/hearthlands`: deterministic, headless TypeScript rules, topology, projections, replay, invariants, tests, and bots that act from their own projected view.
- `packages/saigon-grid`: separate deterministic, headless city rules, transactions, events, scenarios, invariants, tests, and bots.
- `apps/server`: shared room and session management, runtime message validation, game dispatch, authoritative actions, WebSocket state delivery, and static hosting.
- `apps/web`: collection, shared table flow, and separate React renderers for both games. The client proposes actions; it never decides their validity.
- `tests/e2e`: multi-browser create/join, a complete six-seat match through victory, refresh and disconnect recovery, host transfer, trade races, security checks, and desktop/mobile screenshots.

The server sends Hearthlands inventory and unrevealed Chronicle Cards only to their owner. Saigon Grid portfolios and its ledger are public; its random state and event decks stay server-side. Spectators receive no private state. Hearthlands keeps an ordered action history for replay. Both rule states serialize as JSON, which permits a future durable store without changing the rules packages.

See [architecture](docs/architecture.md), [network protocol](docs/network-protocol.md), and [security](docs/security.md).

## Accessibility and mobile

Board Sites, Links, and Rover Regions offer mouse, touch, and keyboard activation, with legal positions highlighted. Materials have labels and distinct silhouettes. Players have colors, sigils, and names. Focus styles and reduced-motion preferences are respected. On phones, the board scrolls within its own surface and the action rail moves below it.

The included web manifest and icon support standalone installation where the browser permits it. Multiplayer requires a live connection; offline play is not provided.

## Deploy

The repository includes `render.yaml` for a single [Render web service](https://render.com/docs/web-services). Connect the repository in Render and deploy the Blueprint, or create one Node web service manually with build command `npm ci && npm run build`, start command `npm start -w @opentaverns/server`, and health path `/health`. Render supports [public WebSocket connections](https://render.com/docs/websocket), so the same HTTPS origin serves the app, API, and `wss` connection. The server binds `0.0.0.0` and reads Render's `PORT` automatically. Choose an always-on single instance for matches; a process restart currently loses in-memory tables.

Do not scale this version to multiple instances: rooms are process-local, and a WebSocket reconnect may reach a different instance. Add shared room persistence and distributed action serialization before doing that. Secure `HttpOnly`, `SameSite=Lax` cookies are issued on HTTPS; the server checks request origins. No CORS configuration is required for the single-origin deployment.

## Current limits and next steps

Tables live in server memory, so a server restart or replacement ends ongoing games. Offline play, a full replay viewer, and sound are not included. The immediate next engineering step for durable public play is shared persistence plus restart recovery. The two rules packages remain separate from room/session code.
