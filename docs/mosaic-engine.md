# Mosaic engine

Mosaic is an original 2–4 player tile-drafting and spatial-pattern game. Its paired persistent market, direct ordered placement and shared pattern objectives are independent from commercial factory/pattern-line games. Text, ceramic marks, layouts and artwork are original. Rules live in `packages/mosaic`; React only stages intentions and renders shared scoring functions.

## Supply and draft

The bag contains exactly 100 unique tiles: twenty each of Tide, Fern, Ember, Ochre and Orchid. Families are mechanically equal. Seeded shuffling, Commission selection and initial initiative use serialized server-owned random state. Neither seed, RNG nor future bag order is projected to players or spectators.

Five public market slots each hold an offer with a unique ID and two tile identities. A completed turn consumes exactly one pair. The selected slot receives a fresh offer ID and two bag tiles while more turns remain. Other offers persist. The final match turn leaves its slot empty: four unused offers and the remaining bag still belong to the conserved pool. Two/three/four players finish with 40/60/80 board tiles, eight market tiles and 52/32/12 bag tiles. No tiles are generated, discarded or returned.

## Connected placement and transaction

Boards have 25 cells, addressed by row/column 0–4. The first tile may go anywhere on an empty board. Each later tile must touch an occupied cell above, below, left or right. The action orders its two placements; the second can connect to the first newly placed tile. Diagonals do not connect. Committed tiles never move.

`DRAFT_AND_PLACE` includes round, global turn, revision, offer and two ordered tile/row/column placements. The transport adds UUID and match identity. Strict schemas validate shape; the engine checks actor, phase, exact offer/tile ownership, distinct tiles/cells, empty cells, sequential adjacency and current turn identity. All validation happens before mutation. A rejection consumes nothing and places nothing. Accepted state is saved before broadcasting.

Authoritative phases are **DRAFTING** and **GAME_OVER**. Local preview is not a server phase. Preview order, editing, Undo, Reverse and Cancel affect this device only. Session storage scopes preview to Table, match and turn. Rules/reload preserve it while that turn remains current. A new turn or match resets it. The preview and final score use the same pure evaluator.

## Rounds and victory

There are exactly ten rounds, one turn per player per round. First-round initiative is selected from the seed. The starting seat moves one step clockwise each round; seats remain stable. Everyone finishes with ten committed turns, twenty tiles and five empty cells. No eleventh round starts.

Final standings sort by total, then number of rainbow squares, then completed Commissions. Fully equal results share victory. Scores are derived from boards; no mutable score ledger can drift from them.

| Category | Exact scoring |
| --- | --- |
| Connections | 2 per same-family orthogonal pair, counted once |
| Straight runs | Each maximal horizontal/vertical run of 3/4/5 earns 3/6/10 extra points |
| Rainbow squares | 5 for each filled 2×2 with four distinct families; overlaps count |
| Gallery Commissions | Each selected objective scores once per player at completion |

Crossing runs score independently in their two directions. A five-tile line is one run, without shorter overlapping bonuses. Connection points still apply within a run. Sixteen possible square positions are scanned independently.

## Gallery Commissions

Two distinct objectives are selected at match start. Everyone can complete both; another player's completion never removes an objective.

| Objective | Points | Predicate |
| --- | ---: | --- |
| Ribbon | 8 | At least one matching straight run of length ≥4 |
| Four Corners | 10 | Cells 0,4,20,24 filled with four distinct families |
| Centerpiece | 8 | Center 12 and neighbors 7,11,13,17 filled with ≥3 families |
| Bridge | 10 | One matching-family orthogonal component touches left and right |
| Cascade | 10 | One matching-family orthogonal component touches top and bottom |
| Spectrum | 8 | At least four families each represented by ≥3 tiles |

Component searches never follow diagonals or cross different families. Progress and contributing cell lists support the UI's score inspector. In-play totals are **Projected**, including objectives currently satisfied; the final total is evaluated from the completed board.

## Multiplayer, privacy and recovery

The existing OpenTaverns server owns sessions, Table, host, spectators, action IDs, latest-tab control, match IDs, deadlines and storage. Mosaic owns tiles, placement, scoring and initiative. Server dispatch contains small explicit game branches and a shared player-count table; no universal board-game framework was added.

All boards, market, active player, history, Commissions and projected scores are public. Projection is explicit and omits bag order, seed, RNG and replay log. Spectators cannot mutate state. Cookie identity selects the actor; client actor, score, outcome and refill fields are rejected. Offer IDs plus round/turn/revision reject stale moves. UUID retry acknowledgements do not apply a turn twice, including after process restart.

Relaxed/Standard/Fast turns allow 300/180/60 seconds. A disconnect extends a deadline by thirty seconds once. On expiry the engine chooses the first available Palette and first legal cells in stable order. This documented neutral fallback never takes staged client choices. Explicit host bot takeover retains the same ID, name, board and turn count. Restarts restore snapshots and pause progression until a seated human reconnects; downtime does not consume the turn clock.

Play Again keeps Table, seats, host and spectators. Boards, bag, market, Commissions and turns reset under a fresh production seed and match ID. Development seeds intentionally reproduce a match. Full serialization and validated action replay are supported.

The shared browser action sender also supports HTTP phone contexts without `crypto.randomUUID`, using `crypto.getRandomValues` to generate an RFC 4122 version-four ID. A browser test submits an actual Mosaic turn with the UUID convenience API unavailable.

## Bots and simulations

One Standard bot uses only the public projection. For each of five offers and two orders, it keeps two first-cell candidates and two second-cell candidates, evaluating at most forty complete placements. Candidates combine exact score, future runs, partial rainbow opportunities, Commission progress, frontier flexibility and public market competition. The search is bounded; no hidden draw inspection or cheating difficulty exists.

`npm run simulate -- --game mosaic --games 1000 --players 4` runs complete matches. Diagnostics include score distribution/category contributions, patterns, objective completion, stable-seat and initiative wins, decision time and failures with seed/round/turn/player/revision. [Recorded results](mosaic-simulation.json) cover 1,002 matches: 334 each at two, three and four seats.

## Invariants and testing

Every engine action checks: 100 unique known tile IDs in exactly one location; correct family inventory; five market slots and distinct offers; two distinct objectives; stable unique seats; exactly two board tiles per completed turn; connected boards; ten-turn maximum; turn counts matching round progress; initiative and active seat; history/revision/log agreement; and final standings derived from the finished boards.

Tests cover maximal-run boundaries/crosses, overlapping rainbow squares, all Commissions, non-diagonal path predicates, tie breakers/shared victory, invalid atomic transactions, hidden supply, complete matches for all seat counts, timeout fallback, serialization/replay and valid developer fixtures. Server tests restart a populated Mosaic table and retry the same transaction. Browser tests cover independent participants, spectators, reloading, duplicates, hostile payloads, latest tabs, populated-board takeover, rematch and private bag redaction.

## Balance reading

The Standard bot favors matching clusters and runs. In the recorded batch, average total is about 70–71, with around 35–36 connection points, 23–24 run points, 1 rainbow point and 10–11 Commission points. Rainbow squares are infrequent under this heuristic and deserve human feedback; this does not prove the category is useless for people choosing different objectives or denying opponents. Four Corners is the hardest bot objective (roughly 7–10% completion); Centerpiece/Ribbon complete very often. Tile-family draft counts are closely distributed.

First-round initiative wins are 179/163 at two seats and 108/69/87/88 at four, including shared results. This is a diagnostic signal, not proof of human first-seat advantage: rotating initiative distributes subsequent first picks and bot play lacks human drafting intent. The requested scoring/objective values remain intact; one batch is insufficient reason to alter them. Playtime of 15–25 minutes remains a design target rather than a measured human result.

See [visual QA](mosaic-visual-audit.md) and [release validation](mosaic-release-validation.md).
