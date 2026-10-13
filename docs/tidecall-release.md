# Tidecall release candidate — 2026-10-01

## Validation

- Unit tests: 149 passed, including 63 Tidecall checks.
- Typecheck, lint and production build passed.
- 1,000 seeded Tidecall matches completed across 3–6 seats: zero deadlocks, invariant failures, illegal plays or projection failures. Balance metrics and scoring comparison are in [the engine record](tidecall-engine.md).
- Existing-game simulations: 50 matches each for Hearthlands, Saigon Grid and Blackout completed.
- Production browser tests: 19 passed across the four games. Two initial harness failures were corrected to follow current host ownership after reconnect and explicitly close an Away player's socket; both targeted reruns passed. Six development-only cases were skipped in production, then passed against the development server.
- Six independent phone contexts plus a spectator completed all ten rounds. Verified private locks, duplicate action IDs, stale revisions, reconnect, host-only rematch, fresh match identity, spectator rejection, latest-tab control and Away bot takeover.
- Real FAST server deadlines safely generated Forecasts, kept Compass and played a legal card. Production rejected scenario/debug access, forged outcomes and client TIMEOUT actions.
- Desktop/mobile scenario review covered all 24 Tidecall fixtures, lobby, collection, shared Rules, keyboard input, reduced motion, narrow and landscape screens. Two substantial screenshot critique/refinement passes plus the crowded six-player refinement are documented in [visual QA](tidecall-visual-audit.md).

## Known platform limits

Update, 2026-10-13: [durable table storage and host management](table-storage.md) now replace the process-restart limitation described below. The paragraph records the original release checkpoint.

Tables remain process-memory state: restarting the server loses active tables. Bots use public information and their own hands with modest heuristics; they are suitable for filling seats and QA, not a substitute for human strategy. No new persistence or sound subsystem was introduced.
