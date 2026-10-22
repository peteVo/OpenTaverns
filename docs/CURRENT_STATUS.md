# Current status

**Evidence checked:** 2026-10-22. This release includes Wildways, the seventh game, alongside the six previously released games. Its baseline was `2c7f3ab` (`design: revamp collection and responsive game interfaces`). These are local validation results, not evidence of remote deployment.

## Implemented

- Seven registered games: Hearthlands, Saigon Grid, Blackout, Tidecall, Werewolf, Mosaic and Wildways. Each game keeps its own headless rules package and renderer, integrated through the shared table, server and Rules UI.
- Wildways provides a shared seeded landscape, public three-tile market, habitat and route networks, Survey Marker influence, public Milestones, previews, bots and simulations. See [Wildways rules and engine](wildways-engine.md).
- The platform provides the shared browser client and authoritative HTTP/WebSocket server, cookie-backed seats, spectators, table codes/invites/QR, action validation, viewer projections, retry protection, reconnect, bot takeover, rematches, and atomic local table snapshots. Runtime rooms remain single-process; see [architecture](ARCHITECTURE.md) and [table storage](table-storage.md).

## Wildways release evidence

- `npm test` passed 346/346 tests, including 75 Wildways tests. Typecheck, lint and production build passed, including a final lint check after the map/icon refinements.
- The clean full development Edge suite passed 46 checks with 3 intentional skips in 7.4 minutes. It covered the seven-game browser regression suite and Wildways' actual 60-second timeout, atomic fallback and one-time disconnect grace.
- Production security checks passed (2), and Wildways production-mode checks passed (2). The post-final-map/icon targeted UI and multiplayer run passed all 5 checks in 23.9 seconds.
- The 2026-10-21 [Wildways simulation report](WILDWAYS_SIMULATION.md) records 1,000 complete bot matches, 250 each at 2–5 players using seeds 1–250, with zero invalid actions, deadlocks or invariant violations. Results are bot evidence, not a human balance claim.
- Desktop and mobile captures are linked from the [README](../README.md#opentaverns). The [Wildways design review](wildways-design-review.md) and [release validation record](wildways-release-validation.md) describe the visual and browser evidence. Physical devices, assistive-technology certification and human playtesting remain unverified.

## Existing limits

- Runtime rooms and WebSocket connections belong to one server process. Do not run multiple instances against one data directory or scale horizontally without shared storage and coordinated room actions.
- Saved state is private and disk-backed. Ephemeral hosting storage loses it; backups are operator-managed. Human seats need their existing browser cookies to reclaim them.
- Bots are QA and seat-filling heuristics, not substitutes for human playtests or evidence of human balance.
- Browser evidence uses Edge on Windows at browser-sized viewports. Physical phones/tablets, assistive-technology certification and human testing are not established by the recorded checks.
- Cross-computer clean installation and deployment were not exercised in this release work. E2E currently pins the Microsoft Edge channel.

## Remaining checks

1. Verify map navigation, touch targets, focus and Rules behavior on physical phones and tablets.
2. Complete assistive-technology evaluation and human Wildways matches across 2–5 players; track playtime, Milestone frequency and strategy variety before changing balance.
3. Exercise a clean install on a second computer and verify the deployment uses a persistent disk and one server instance.

## Starting a new Codex session

Read `AGENTS.md`, `README.md`, this file, `docs/DECISIONS.md` and `docs/ARCHITECTURE.md`. Then inspect `git status --short --branch`, recent commits, and the relevant game/server/client files. Treat release reports as dated evidence, not proof that today's checkout has just passed those commands.
