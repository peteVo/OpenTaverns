# Current status

**Evidence checked:** repository source and documentation as inspected 2026-10-20. The latest relevant application commit is `54ef83e` (`feat: release Mosaic ceramic studio and validated six-game integration`). This is a local codebase snapshot; it does not establish what is currently on the remote.

## Implemented

- Six registered games: Hearthlands, Saigon Grid, Blackout, Tidecall, Werewolf, and Mosaic. Each has a package under `packages/` with engine tests, structured rules, bot and simulation support.
- A shared browser client and authoritative Node HTTP/WebSocket server, with cookie-backed seats, spectators, table codes/invites/QR, strict action validation, per-viewer projections, retry protection, reconnect, bot takeover, rematches, and shared Rules UI. Confirm implementation details in `apps/server/src/index.ts`, `apps/web/src/`, and each game's package.
- Versioned atomic JSON table snapshots under `data/` by default, a single-process data-directory lock, and a private host register at `/manage`. Restart recovery is implemented; multi-instance room coordination is not.
- Responsive game-specific interfaces, bots and headless simulation commands. E2E scenarios are opt-in and not enabled in production.

## Validation evidence

The latest repository release record is [`mosaic-release-validation.md`](mosaic-release-validation.md), dated 2026-10-14. It records 271 passing tests, typecheck, lint, production build, 23 applicable production Edge checks, development visual/multiplayer checks, and 1,002 Mosaic simulations, plus selected cross-game checks. These are historical recorded results, not checks run while preparing this document. Earlier game-specific evidence is linked from each engine and release document.

No application source was changed for this documentation task. No tests, typecheck, lint, build, or browser checks were run as part of it.

## Limits and unverified areas

- Runtime rooms and WebSocket connections belong to one server process. Do not run multiple instances against one data directory or scale horizontally without shared storage and coordinated room actions.
- Saved state is private and disk-backed. Ephemeral hosting storage loses it; backups are operator-managed. Human seats also need their existing browser cookies to reclaim them.
- Bots are QA/seat-filling heuristics, not substitutes for human playtests or evidence of human balance.
- Recorded browser evidence uses Edge on Windows at browser-sized viewports. Physical phones, assistive-technology certification, and human balance/playtime testing are not established by those records.
- Cross-computer clean installation and deployment were not exercised during this documentation update. E2E currently pins the Microsoft Edge channel.
- No other reproducible open blocker or bug is established by the inspected evidence. Treat further claims as unverified until reproduced.

## Useful next checks

1. On the second computer, clone/checkout this branch, use Node.js 20.19+ or 22.12+ and `npm ci`, then run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
2. Run `npm run dev`, create a table, and join it from a second browser/device. Verify LAN firewall/address handling if using a phone.
3. For deployment, confirm the host provides a persistent disk and a single instance; follow the checked-in `render.yaml` and README deployment section.
4. Run relevant game simulations and E2E scenarios when changing game rules, transport, persistence, or UI. Update this file only from observed results.

## Starting a new Codex session

Read `AGENTS.md`, `README.md`, this file, `docs/DECISIONS.md`, and `docs/ARCHITECTURE.md`. Then inspect `git status --short --branch`, recent commits, and the relevant game/server/client files. Treat release reports as dated evidence, not proof that today's checkout has just passed those commands.
