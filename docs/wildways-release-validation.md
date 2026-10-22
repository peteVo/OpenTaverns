# Wildways release validation

**Date:** 2026-10-22. Local working tree in `E:\Projects\OpenTaverns`; no push, deployment or public release was performed.

## Delivered

Wildways is the seventh OpenTaverns game: a competitive 2–5 player shared landscape with a conserved 72-tile supply, three persistent market offers, rotated route ports, independent habitat and route graphs, eight permanent Survey Markers per seat, majority/tied control, landmark scoring, two public Milestone races and deterministic final tiebreaks. Its package owns the rules, public projection, replay, scenarios, bots and invariants. Existing game engines were not modified.

The existing room server supplies sessions, spectators, strict intention validation, UUID retries, match/revision checks, latest-tab control, reconnect grace, durable saves, bot takeover and rematches. A late start/rematch HTTP response can no longer overwrite a newer Wildways WebSocket revision.

The illustrated atlas supports staged tile/rotation/location/marker selection, exact local previews, network inspection, public scores and claims, accessible coordinate buttons, pan, native wheel/pinch zoom, fit-all and latest-tile focus, mobile confirmation, localized rules/common errors and EN/DE/VI controls. Light/dark themes use habitat patterns and player sigils as well as color. Large maps open at a readable scale near the latest placement; **Fit map** remains an explicit whole-landscape overview.

## Executed checks

| Check | Observed result |
| --- | --- |
| Baseline before Wildways | 271 tests; typecheck, lint and production build passed |
| `npm test` | 346 passed in nine files, including 75 Wildways tests and seven-game restart recovery |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed; game remains a separate lazy client chunk; no new runtime library |
| `node scripts/test-e2e.mjs --development` | 46 passed, three intentionally skipped, in a clean full seven-game Edge run |
| `node scripts/test-e2e.mjs --development wildways-ui wildways-multiplayer` | Five passed in 23.9 seconds after the final map/icon refinements |
| Production-only security checks | Two passed: Tidecall/Werewolf debug and forged privileged actions |
| Production Wildways touch and takeover/security checks | Two passed, including inaccessible debug/scenario endpoints |
| Headless Wildways matches | 1,000 completed: 250 each at 2, 3, 4 and 5 seats; zero invalid actions, deadlocks or invariant violations |

The full browser run covers all prior games plus Wildways complete 2–5 seat matches, malicious intentions, stale/repeated/old-match actions, spectators, reconnects, latest-tab policy, bot takeover, full map navigation, FAST fallback and exactly one disconnect grace per deadline. The actual FAST timer was awaited; its fallback conserved tiles, committed one complete placement and spent no Survey Marker.

Wildways UI checks exercise native touch selection, rotation, marker choice, Rules focus return without draft loss, CDP pinch, portrait/landscape changes, confirmation and the delayed opening-bot response regression. Deterministic fixtures demonstrate habitat merges, Trail/Stream networks, influence ties, claimed Milestones, midgame, large landscapes, final scoring and a valid shared victory. The shared-victory fixture intentionally uses legal fallback moves with no markers; it is a scoring tie fixture rather than a competitive bot strategy sample.

## Visual review and performance

Browser captures cover 1440×1000, 390×844, 320×740, 360×800, 768×1000 and 740×360. All three languages and both themes were rendered. Checks reject document overflow and clipped map/tray controls, and measure representative dark-theme text/control contrast. Captures and iteration history are described in [the design review](wildways-design-review.md); selected final captures are stored under `docs/images/wildways/`.

The five-player performance probe opens a completed 61-tile landscape, performs native mouse pan and wheel zoom, verifies no game mutation, and records 39 animation-frame intervals: median **7.0ms**, 95th percentile **20.9ms**. This is a local headless Edge sample, not a device-independent frame-rate guarantee. The measured JSON remains in ignored `.test-data/wildways/performance-five-player.json`.

The final review returned **ship** for its two requested fixes: readable long-map zoom and consistent authored SVG controls, with neither issue remaining and no observed regressions. The initial 29/40 heuristic assessment was not rescored. The full browser sweep preceded these isolated refinements; the final five-check rerun verifies their resulting UI and multiplayer behavior. See the [desktop landscape](images/wildways/landscape-desktop.png), [phone preview](images/wildways/phone-preview.png), [shared victory](images/wildways/shared-victory.png) and [complete review record](wildways-design-review.md).

The [simulation report](WILDWAYS_SIMULATION.md) records scores, marker use, control changes, claim rates and seat/initiative outcomes. It exposes a modest starting-position signal at 3–5 seats and differing objective claim rates. These bot results do not establish human balance or match duration.

## Failures investigated

The first broad browser run found one transient browser fetch failure in Tidecall and two races in new Wildways test setup. The helpers now wait for server state and ignore presence broadcasts when waiting for an action outcome. The performance probe also refreshes host identity after navigation, since normal host transfer can occur during reconnect. Targeted reruns and a clean full run passed; no existing game engine was changed to accommodate these tests.

A sandboxed unit run could not reach its local restart server's health endpoint. The standard test command subsequently passed with local network permission. Earlier restricted-workspace runs used Vitest's runner config loader; the normal `npm test` command now passes in the authorized workspace.

## Remaining evidence limits

Physical iOS/Android devices, VoiceOver/TalkBack/NVDA certification, long network outages on real mobile links, multi-instance hosting and human balance/playtime are unverified. Unknown server errors retain their original English fallback. Existing dependency advisories were not upgraded as part of this game implementation. Runtime tables remain single-process and require persistent storage and existing browser cookies for seat recovery.
