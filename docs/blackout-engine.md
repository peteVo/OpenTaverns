# Blackout engine and table guide

Blackout is an original 5–10 player hidden-role game about an abstract fictional city. The package at `packages/blackout` owns its rules, incident data, roles, projections, bots, scenarios, replay, tests, and in-game Rules text. Infrastructure is a game track; it describes no real utility operation.

## Roles and city

Each seat receives one secret faction and one unique public profession, dealt independently from server-owned seeded shuffles. Operators know only their own faction. Disruptors know the other Disruptors. The configured counts are 5: 3/2, 6: 4/2, 7: 4/3, 8: 5/3, 9: 6/3, 10: 6/4 (Operator/Disruptor). No one is eliminated before game over.

Power, Water, Transit, and Comms start at Stability 3, bounded from 0 to 5. Crisis starts at 0 and reaches a configured maximum of 5. The city loses immediately after a resolution if Crisis reaches 5 or two systems are Offline at 0. Otherwise Operators win after Round 8. Both Work Orders resolve before this check.

## Round state machine

`ROLE_REVEAL` occurs once, then each round follows `INCIDENT_REVEAL → BRIEFING → ASSIGNMENT → SECRET_ACTION → RESOLUTION → AUDIT_VOTE` (when affordable) `→ ROUND_END`. `GAME_OVER` rejects gameplay actions. The Shift Lead rotates by seat at round end. Everyone can discuss throughout, including unassigned players.

The deterministic shuffled deck contains 12 structured fictional Incidents; eight are used per match. Each has two distinct target systems and a small strain modifier. An order's team size and base progress requirement come from a central player-count table. Team sizes are 2+2, 3+2, 3+3, 3+3, 4+3, and 4+4 for 5 through 10 players. A player can be on at most one team. Only the Shift Lead can publish and lock assignments. The server validates IDs, capacity, and phase.

Assigned players independently lock **Stabilize** (+1 progress), **Diagnose** (0 progress and +1 shared Insight), or **Interfere** (−1 progress, Disruptors only). A lock is immutable. An idle or disconnected seat defaults to Stabilize for either faction when its response window ends. Total progress includes public profession bonuses. Success raises its system by one. Failure lowers its system by one and raises Crisis by one, subject to a public protective profession use. Diagnose can therefore make an innocent team fail.

Insight persists across rounds. After resolution, if an Audit is affordable, every player privately votes for any previously resolved unaudited Work Order or to save Insight. A strict majority of all seats for one order spends two Insight, normally, and publishes exactly its Interfere count. A tie or split saves Insight. Votes are revealed only after all required ballots arrive or the window expires. An Audit never names the actor.

## Public professions

Every ability has one public use per match and works for either faction. Four specialists (Grid Engineer, Water Planner, Transit Controller, Network Coordinator) add one progress to their matching system. Dispatcher and Logistics Lead add one to either order. Systems Architect prevents one Stability loss; Crisis Liaison prevents one Crisis increase. Auditor lowers Audit cost by one for the current round. Forecast Analyst publicly uses an ability during Briefing but receives the next Incident preview privately. The engine checks phase, target, and single use. Ability state survives serialization and reconnect.

## Privacy and transport

The server retains the full `Game`, including factions, incident order, locked responses, Audit ballots, and action log. `project(game, viewerId)` creates a new `View` for each socket and HTTP GET. Public player records contain profession, connection, confirmation, and ability use, never faction. Public orders contain assigned IDs and the IDs that have locked, never action values. The `self` field contains only the viewer's faction, Disruptor allies, current prompt, locked response, ability use, and possible private forecast. Spectators have `self: null`. Local suspicion notes stay in browser storage and are never submitted. The completed match exposes `truth` with factions and a round-by-round action timeline to all viewers.

The room server authenticates seats with an HttpOnly session cookie and applies each action under one controlling WebSocket per seat. Client action IDs make retries idempotent. Stale revisions reject lead/assignment/phase transitions; independent role confirmations, secret responses, and votes can arrive against a newer revision because the engine validates each seat and phase. The server never accepts `TIMEOUT` from clients. Default Relaxed timing is generous; Standard and Fast are selectable at table creation. A disconnect extends one pending window by 30 seconds. Reconnect restores the viewer's private projection; an unfinished response selection is retained in that browser tab's session storage until locked. The host may replace an Away seat with a bot using the same ID, faction, and profession.

## Determinism, bots, and QA

State includes `gameVersion: 1`, seeded random state and deck, phase, players, systems, Crisis, Insight, assignments, locks, votes, ability uses, timeline, and validated action log. `replayGame` reconstructs the same state from initial seats, seed, and actions. Invariants run after every accepted action and during headless simulation. Bots see their own projection, not the internal game state. Their faction-aware heuristics are intended for QA and abandoned seats, not human-quality deception.

Run `npm run simulate -- --game blackout --games 1000 --players 10`; use `--seed N` to reproduce a range. The 2026-09-29 run completed 1,000 games for every count from five through ten with no deadlock or invariant failure. Operator bot wins were 34%, 30%, 33%, 45%, 39%, and 32%, respectively. These figures expose a modest Disruptor advantage under current bot heuristics; they do not measure human balance. Simulation also reports rounds, Crisis, Offline samples, Interfere, Diagnose, Audits, and ability uses.

Development-only scenarios in `src/scenarios.ts` cover role reveal, assignment, both factions' private action, waiting, resolution, Audit, critical and Offline systems, final round, both victories, and reconnect. Production rejects scenario and explicit seed inputs. Browser QA exercises desktop and phone surfaces, including the private Rules sheet and a ten-seat live table.
