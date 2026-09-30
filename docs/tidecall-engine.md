# Tidecall engine

Tidecall is an original 3–6 player prediction and trick-taking game. Its rules package is independent of rooms, HTTP, React and clocks. There is no early elimination.

## Cards, dealing and rounds

The 52-card deck has Wave, Wind, Reef and Sun, each ranked 1–13. IDs are `SUIT-rank`. The ten-round hand arc is **3, 4, 5, 6, 7, 7, 6, 5, 4, 3**, centralized in `config`. Each round reshuffles a complete deck with the server-owned seeded integer generator. Undealt cards never enter a client projection. Initial dealer is seeded randomly; dealer rotates clockwise; the player after the dealer leads first. Subsequent tricks are led by their winner.

## Tides

| Tide | Winner rule |
| --- | --- |
| Calm Water | Highest lead-suit rank; no dominant suit |
| High Tide | Wave dominant, highest eligible rank |
| Tailwind | Wind dominant, highest eligible rank |
| Reefline | Reef dominant, highest eligible rank |
| Sunbreak | Sun dominant, highest eligible rank |
| Undertow | Lowest lead-suit rank; no dominant suit |
| Crosscurrent | Wave for tricks 1 through ceil(hand size / 2), Reef afterward |
| Shifting Current | First trick has no dominant suit; previous winning card’s suit dominates the next |

The first eight rounds use one shuffled Tide deck; the final two use the beginning of a second shuffle. Future order stays private. Every Tide is structured domain data. Follow-suit is mandatory under **all** Tides. Without the lead suit, any card may be played. If any dominant-suit card is present, that suit is eligible to win; otherwise only the lead suit is eligible. Rank then determines the winner.

## Phase machine

`DEALING → TIDE_REVEAL → FORECAST_REQUIRED → FORECAST_REVEAL → COMPASS_REQUIRED → COMPASS_REVEAL → TRICK_PLAY ↔ TRICK_RESOLUTION → ROUND_SCORING → next deal / MATCH_OVER`.

Presentation phases advance automatically after two seconds or when the dealer explicitly advances. Round scoring has a 25-second review window; earlier scores remain inspectable. Rules transitions are authoritative and do not depend on CSS or animation completion.

## Forecast and Compass

Forecast is an integer 0 through dealt hand size. Selection stays in tab-local session storage until an explicit lock. Each player locks independently. The engine publishes every Forecast together when all have locked or the server supplies missing defaults. Before reveal the public view contains only locked status. Public Forecast Balance reports tricks available, sum called, and difference.

Each player has one Compass per match. Eligible players privately lock Keep, −1 or +1 within bounds after Forecast reveal. Used tokens automatically Keep. Decisions remain private until all arrive or timeout. Only adjustments consume the token. The public reveal announces only actual adjustments, avoiding a noisy Keep event per player.

## Scores and victory

**Exact: 12 + 3 × Forecast. Miss: −4 × absolute error.** Exact zero earns 12. Forecast two and win two earns 18; forecast three and win two loses 4. Round records explain the calculation and cumulative score for every player. Highest match score wins; most exact rounds breaks a tie; a remaining tie is shared victory.

Three scoring candidates were compared on the same 80 seeded matches (20 per count). The 10/+2/−5 candidate produced mean 27.28 and a 19.13 winning margin; 12/+3/−4 produced mean 47.87 and a 21.08 margin; 15/+2/−3 produced mean 63.37 and a 21.83 margin. The selected middle candidate gives larger exact calls more value while one missed trick remains recoverable. Conditional zero forecasts perform well when the hand supports them. An unconditional zero player won only 1/30, 1/30, 0/30 and 2/30 against informed bots at 3/4/5/6 seats. Bot outcomes are evidence, not proof of human balance. Reproduce with `node scripts/tidecall-scoring.mjs`; raw results are in [scoring analysis](tidecall-scoring-analysis.txt).

## Privacy and authority

`project(game, viewer)` explicitly constructs public players without hand, private Forecast or Compass decision fields. Only `self` receives that viewer’s hand, locked choices and currently legal card IDs. Spectators receive `self: null`. No projection contains undealt cards, RNG, seed, Tide order or action log. Even the next trick’s dominant suit is withheld during dealing. History contains played cards and revealed results, never pending secret choices. Historical hands are not exposed after the match; the result provides scores and public trick records.

Clients send intentions. The server derives the actor from the session cookie and validates a strict game-specific runtime schema. Engine validation checks phase, round, turn, card ownership, follow-suit, Forecast bounds, immutable lock and token availability. Unknown outcome-setting actions are rejected. Round and trick identifiers reject delayed decisions; transport match identifiers reject prior-match actions. Independent locks can arrive at the same revision, while card and presentation actions enforce the current revision. Existing per-seat action IDs and latest-tab control prevent duplicates.

## Reconnect, timers and bots

Every state includes a fresh private projection. Browser reload restores the same seat via HttpOnly cookie; tab-local unlocked Forecast/card/Compass selection is scoped by room, match, seat, round and trick. Opening the shared Rules sheet changes no decision. A disconnect grants 30 seconds once per decision window.

| Pace | Forecast | Compass | Card |
| --- | ---: | ---: | ---: |
| Relaxed (default) | 180s | 120s | 90s |
| Standard | 90s | 60s | 45s |
| Fast | 45s | 30s | 20s |

Timeout Forecast uses a private hand-strength estimate; Compass always Keeps; card timeout selects lowest legal rank then stable suit order. Bot takeover is an explicit host action for an Away seat and preserves identity, hand, score, Forecast, token and round. Bot decisions use only their own projected view. Strength estimates account for ranks, suit length, voids, dominance, rank inversion, hand size and player count. Card play seeks plausible wins when below Forecast and legal losses at or above it. Seeded deals and deterministic decision variation keep simulations reproducible. Bots are deliberately heuristic rather than exhaustive game-theoretic players.

## Rematch

The host may Play Again only after MATCH_OVER. Every human seat must be connected or explicitly replaced with a bot. The same table, host, player IDs, credentials and spectators remain. Deck, dealer, scores, Forecasts, Compass and round reset. Production generates a fresh seed and every rematch gets a fresh transport match ID; explicit development seeds remain reproducible. Accepted action IDs are retained so an old retry stays a duplicate.

## Serialization, replay and invariants

`gameVersion: 1` JSON includes phase, players/hands/scores, round, dealer, deck, Tide order, original Forecasts, Compass locks, trick, completed tricks, prior rounds, random state, public history and validated action log. `serializeGame`, `restoreGame` and `replayGame` support snapshots and deterministic reconstruction. Settled history records are immutable; actions copy mutable state and append records without repeatedly cloning old logs.

Invariants run after every accepted action and during simulations: all 52 active cards exist exactly once across undealt deck, hands and played cards; IDs/suits/ranks are valid; hand sizes match resolved/pending plays; identities and dealer are valid; Forecasts remain within bounds; tricks won equal resolved tricks; each completed trick has one card per player and the correct winner; scores agree with round records; pending phase has a valid current player; MATCH_OVER has winners and refuses gameplay.

## Simulation and QA

`npm run simulate -- --game tidecall --games 1000 --players 4 --seed 1` reports completion, score, exact rate, error distribution, Compass directions/improvement, Tide statistics, seating wins and failures. Failures include seed, round, trick, phase and action number.

The release run completed **250 matches at each count**, seeds 1000–1249 (3 seats), 1250–1499 (4), 1500–1749 (5), 1750–1999 (6): 1,000 total, zero deadlocks, invariant failures, illegal actions or privacy failures.

| Seats | Average score | Exact rate | Compass improved / used | Seating wins (ties count for each winner) |
| --- | ---: | ---: | --- | --- |
| 3 | 36.24 | 39.67% | 343 / 561 | 82, 80, 92 |
| 4 | 44.17 | 45.41% | 575 / 952 | 65, 70, 64, 53 |
| 5 | 48.60 | 48.94% | 723 / 1250 | 46, 54, 49, 48, 59 |
| 6 | 52.57 | 52.02% | 880 / 1500 | 43, 48, 39, 51, 47, 36 |

Zero is viable but unconditional zero is weak. Most misses are one trick. Bots frequently adjust downward in crowded games because their independent estimates overcall total tricks; this is a documented heuristic limitation. There is no severe seating concentration or Tide that prevents completion. Compare human feedback before changing balance solely for bot rates. Four-, five-, and six-seat raw metrics are stored alongside this guide.

Development scenarios cover dealing, Tide/Forecast/Compass reveals and locks, normal/partial/follow-suit/void tricks, Undertow, dominance, Crosscurrent switch, Shifting, final trick/round, seven-card hand, six-card table, scoring, result and reconnect. They are rejected in production. Browser tests cover mixed private sessions, full ten-round match, retry/stale/old-match rejection, spectator privacy, reconnect, host rematch, safe timers, latest-tab control, Away takeover, Rules, keyboard, portrait/landscape and reduced motion.

Tables still live in process memory, as in the existing platform. Server restart loses a table; durable restart recovery is a platform follow-up. No new runtime dependency, voice system, 3D renderer or separate Rules UI was added.
