# Mosaic release validation — 2026-10-14

## Baseline

The repository started clean with five implemented games. All 228 existing tests, typecheck, lint and production build passed before Mosaic. No existing game engines were rewritten. One later restricted-worker filesystem failure prevented Vitest/Vite from resolving local files; authorized validation outside that worker succeeded. This was an environment failure, not a passing test result or a game regression.

## Release gates

| Gate | Evidence |
| --- | --- |
| Unit/integration suite | 271 passing tests across six games, storage and restart |
| Mosaic engine | 43 tests covering supply, atomic rejection, patterns, objectives, ties, initiative, full matches, replay and semantically valid fixtures |
| Typecheck, lint, production build | Passed |
| Full production Edge regression | 23 applicable checks passed; 10 development-only checks skipped |
| Mosaic multiplayer | Independent two/three/four-seat full matches; duplicate retry, reload, spectator redaction, rematch, old match rejection |
| Hostile clients and takeover | Forged actors/tiles/scores/commissions/refills/outcomes, partial/oversized turns and invalid coordinates rejected; latest-tab control and populated-board takeover passed |
| Process restart | All six games retained state; Mosaic kept its populated board/market and acknowledged the original turn retry without a second placement |
| Simulation | 1,002 complete matches, 334 per supported count; zero illegal moves, deadlocks, invariant failures or bot decision failures |
| Cross-game simulations | Ten complete matches for each of the five existing games |
| Visual QA | Actual desktop/phone/tablet/narrow screenshots with two substantial refinement passes and final verification; named score fixtures contain their advertised pattern |
| HTTP-phone UUID fallback | A real staged UI turn confirmed with `crypto.randomUUID` unavailable |

Focused browser runs passed actual elapsed FAST Mosaic timeout and the existing eighteen-seat Werewolf multiplayer flow. A separate mixed-table rematch check proves a bot opening turn starts immediately, after the previous bot loop has settled. Full screenshot runs assert no horizontal overflow or browser exceptions, ≥44px board cells, Rules/refresh preview preservation, keyboard placement, edit/Undo/order, theme changes and opponent inspection.

## Honest limits

Screenshots and multiplayer contexts use Edge on Windows, including phone-sized viewports. No physical Android/iPhone, screen-reader certification or timed human playtest was performed. Approximate 15–25 minute playtime is a target. Bot results favor clusters/runs and find relatively few rainbow squares; this is documented diagnostic evidence, not a claim of human balance. The exact requested scoring and six Commissions remain intact.

One robust Standard bot is supplied; optional difficulty variants and drag-and-drop are omitted. Tap and keyboard play are complete. There is no shared platform localization system to extend; Mosaic uses the existing English convention and fonts that support player-name diacritics. No external runtime library or commercial artwork was added.

The platform remains single-server and requires its private persistent data directory for restart/deployment recovery. See [exact engine rules](mosaic-engine.md), [simulation results](mosaic-simulation.json), and [screenshot critique](mosaic-visual-audit.md).
