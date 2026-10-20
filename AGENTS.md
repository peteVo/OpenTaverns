# Agent guide

OpenTaverns is a browser-based multiplayer table for six games. Preserve the existing platform and game boundaries; do not create a second app or replace a completed game while adding another.

## Read first

1. This file and `README.md` for commands and product scope.
2. `docs/CURRENT_STATUS.md` and `docs/DECISIONS.md` for evidence, limitations, and established choices.
3. `docs/ARCHITECTURE.md`, then the relevant game engine guide and source.
4. Check `git status --short --branch` and inspect the recent history before editing. Preserve pre-existing changes.

## Repository map

- `apps/server/src/index.ts`: authoritative HTTP/WebSocket server, sessions, game dispatch, persistence and bots.
- `apps/server/src/storage.ts`: atomic per-table disk snapshots and host key.
- `apps/web/src/`: collection, shared table/Rules/management UI and game renderers.
- `packages/<game>/src/`: headless rules, public/private projections, bots, simulations, scenarios and engine tests.
- `tests/e2e/`: real browser multiplayer, security and UI checks.
- `docs/`: architecture, operations, game rules and release evidence.
- `data/`: private runtime table state; do not inspect, copy, publish, or commit it unless the task specifically requires safe local diagnosis.

## Commands

Use the repository root and npm workspaces:

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
npm run simulate -- --game mosaic --games 100 --players 4
```

`npm run dev` starts the API/WebSocket server on port 3000 and Vite on port 5173. E2E uses installed Microsoft Edge. Development scenario checks are opt-in with `npm run test:e2e -- --development`.

## Engineering constraints

- Keep game rules in that game's headless package. Treat the server as authoritative; validate every client intention at the server boundary.
- Preserve explicit per-viewer projections. Never send hidden cards, roles, choices, random state, credentials, or private notes to unauthorized clients and rely on CSS to conceal them.
- Follow existing validation, idempotency, revisions, latest-tab, reconnect, bot-takeover, serialization, and invariant patterns.
- Keep the six games working. Update package/workspace exports, server dispatch, UI registration, Rules, tests, simulations, and docs when a real change crosses those boundaries.
- Keep dependencies small. Use the project's existing React/CSS/SVG and Node/TypeScript conventions.
- For interface work, inspect rendered desktop and narrow/mobile states, correct concrete visual problems, and report any unverified hardware/accessibility checks.

## Private files and completion

Never commit `.env`, credentials, host-management keys, `data/` snapshots, private browser credentials, generated `dist/`, or unrelated user changes. Do not stage everything. Before finishing, inspect the diff and run relevant tests plus typecheck/lint/build for application changes. Report commands actually run and any check you could not perform.
