# Wildways rules and engine

Wildways is a 2–5 player game on a shared landscape. Players select from three public tile offers, place a tile beside the existing map and may use one of their Survey Markers to influence a habitat or route network. A match ends after a fixed number of turns per player. This guide describes the engine and server behavior as of 2026-10-22.

## Tiles, map and turns

The map begins with a neutral Meadow origin at `(0, 0)`. It is separate from the drawable supply and cannot carry a marker. It participates in Meadow connectivity and contributes a tile to the region value. The drawable deck contains 72 unique tiles: for each of Forest, Meadow and Highland there are 8 plain tiles, 8 Trail tiles and 8 Stream tiles. Each habitat therefore has 24 tiles. For each route and habitat, its eight tiles comprise two termini (one port each), two bends, two straight pieces and two three-port junctions. Plain tiles have no ports. There are 12 landmarks, four per habitat: two on plain tiles, one on a Trail tile and one on a Stream tile.

Port directions are numbered clockwise in quarter turns: `0` north, `1` east, `2` south and `3` west. Rotating a tile adds the orientation modulo four to each printed port. Every port on one tile belongs to the same route network internally. A route component connects only across an edge where neighboring tiles have the same route kind and both expose ports facing each other. A missing match simply ends the route at that edge.

Coordinates are integer `(x, y)` pairs, including negative values. Every new tile must occupy an empty coordinate orthogonally adjacent to an existing tile. Port layout and route matching do not restrict where a tile may be placed; they determine route connectivity and scoring only. Habitat components join all edge-touching tiles of the same habitat regardless of route or port geometry. Route components can span different habitat types when matching ports of the same route kind meet.

At the start of a turn, three public market offers are available. A player chooses one offer, its orientation and a legal coordinate, then chooses Habitat Survey, Route Survey or no marker. A Habitat Survey influences the new tile's habitat component; a Route Survey influences its Trail or Stream component and requires a route tile. Each player starts with eight markers. A tile holds at most one marker; markers are never moved or recovered. The action is atomic: the server validates the complete intention, previews its consequences, then commits the placement, marker, milestone claims, history and revision together. The chosen offer slot refills after a committed move while turns remain. On the final move, no refill occurs, leaving the other two offers in the market.

| Players | Turns per player | Total placements |
| ---: | ---: | ---: |
| 2 | 18 | 36 |
| 3 | 15 | 45 |
| 4 | 13 | 52 |
| 5 | 12 | 60 |

The starting seat is seeded. Seats proceed clockwise and the starting seat shifts one seat clockwise each round.

## Influence, control and scoring

For each habitat component and route component, the engine counts markers by owner. The highest positive count leads; a unique leader controls the component, while tied positive leaders share control. A component without markers has no leader. Merging components combines their marker counts and recalculates control.

Habitat components score at three or more tiles: each tile is worth 2 points and each landmark adds 3. Route components score at three or more route tiles: each tile is worth 3 points and each landmark adds 2. A unique leader receives the full component value. Tied leaders each receive the component value divided by the number of leaders, rounded down; any remainder is unawarded. Unclaimed components award no points. For example, a five-tile habitat component with one landmark has value `2 × 5 + 3 × 1 = 13`. With two tied leaders, each receives `floor(13 / 2) = 6` points. For example, a Forest Trail tile with an east-facing port joins a Meadow Trail tile with a west-facing port: the Trail is connected while the two habitats stay separate. A Trail and Stream never connect, even when their ports face.

Each match selects one Habitat Milestone and one Network Milestone:

| Milestone | Condition | Points |
| --- | --- | ---: |
| Great Grove | Uniquely lead a Forest component of at least 7 tiles | 8 |
| Open Range | Uniquely lead a Meadow component of at least 7 tiles | 8 |
| High Pass | Uniquely lead a Highland component of at least 6 tiles with a landmark | 8 |
| Trailblazer | Uniquely lead a Trail component of at least 6 tiles | 8 |
| Watershed | Uniquely lead a Stream component of at least 6 tiles | 8 |
| Two Horizons | Uniquely lead habitat components of two different types, each at least 4 tiles | 10 |

After a committed move, the engine checks the active player against unclaimed Milestones. Ties do not qualify; a claim is permanent if later control changes. The total is habitat, Trail and Stream awards plus claimed Milestones. Final standings break ties by Milestone count and then by uniquely controlled scoring networks; remaining ties share victory.

## Engine API, randomness and validation

`packages/wildways/src/index.ts` is deterministic and browser-independent. Its principal exports include `createGame(seats, seed)`, `applyAction(game, actor, action)`, `project(game, viewerId?)`, `validateGame(game)`, `previewTurn(view, actor, action)`, `fallbackAction(view)`, scoring and component helpers, and serialization/replay helpers. `config.turnsByPlayers` gives match length; `config.markers` is eight and `config.minimumNetwork` is three. `createGame` initializes player seats, origin, supply, market, initiative and the two selected Milestones, then validates the state.

The seeded generator stores its evolving state as an unsigned 32-bit integer and uses Mulberry32-style integer mixing. The deck is shuffled with Fisher–Yates; the same seed and seat order reproduce the same supply, starting seat and selected Milestones. The generator state, seed, future bag order, market-offer serial and action log are server state. `project` omits the seed, RNG state, bag order, serial and action log; it returns only the remaining tile count and public market, board, components, scores, Milestones and event history. Wildways has no private hand.

`validateGame` checks the supported seat count, version and unique player IDs; seed and 32-bit RNG range; market size, slot positions and unique offer IDs; the unchanged neutral origin; conservation and uniqueness of all 72 catalog tiles and their habitat, route, landmark and port geometry; unique board coordinates; safe-integer coordinates and valid orientations; marker owners, modes and route eligibility; orthogonal connectivity of the full board; equality of placement count, revision, history, action-log length and aggregate player turns; offering serial sequence; unique placement-history tile IDs; starting-seat range; seat order, per-player turn counts and marker supply; exactly two distinct selected Milestones with one habitat category and one network category; claim ownership, turn and matching history claim; event turn order, expected actor, tile location, orientation and marker; complete habitat and route component partitions; and current-phase or game-over round, offer count, active seat and final winner list. It also enforces the expected final placement count and scoring state after the last turn.

The simulation bot's `nextBotAction(view, actor)` uses public information only. It ranks legal layouts cheaply, keeps at most three per offered tile (nine layouts across the three offers), then evaluates exact `previewTurn` results for each available marker choice on those layouts. Its valuation includes immediate own score gain, strongest rival gain, changes in controlled component potential, Milestone claims and marker-reserve cost; deterministic hashing breaks exact ties. This is a bounded heuristic, not a human strategy model.

## Server and network boundary

The client submits only a `PLACE_LANDSCAPE_TILE` intention containing `round`, `turn`, `revision`, `offer`, `tile`, `x`, `y`, `orientation` and `marker`. It does not submit tile geometry, board state, marker ownership, scores, Milestone claims or refill results. The engine verifies the active seat, phase, freshness fields, offer and tile identity, coordinate, adjacency and marker availability/eligibility before applying the move. `TIMEOUT` is accepted only from server actor `@system` and resolves through the same deterministic fallback path.

The server adds a table `matchId`, UUID action ID and expected room revision. UUID retries are acknowledged without applying twice; stale or malformed intentions do not change the match, and messages for an earlier match are rejected. The latest WebSocket tab controls a seat; spectators cannot submit actions. Timed tables follow Mosaic pacing: 300 seconds Relaxed, 180 seconds Standard and 60 seconds Fast. A disconnect extends the current deadline by 30 seconds once per deadline. Restored human seats start Away and the timed match remains paused until a player reconnects. The host can replace an Away seat with a bot during a match; takeover preserves player identity, markers and score.

Board geometry, market contents, player identities and scores are public, including to spectators. Saved tables retain game state, seed, retry IDs, seats, bot flags and deadlines. A host rematch reuses the table, seats and spectators, creates a fresh production seed and `matchId`, and keeps accepted action IDs registered across matches.

The Wildways UI translates common engine and server error messages into German or Vietnamese through `localizeWildwaysError`; English messages remain unchanged, including unrecognized messages, so unknown errors fall back to the server's English text. Rules and control labels are also available in English, German and Vietnamese.

## Simulation evidence

Run the headless suite with `npm run simulate -- --game wildways --games 100 --players 4`. The recorded 1,000-match seeded bot run, its method, results and limitations are documented in [Wildways simulation results](WILDWAYS_SIMULATION.md). All seats in that run used the same heuristic bot, so the results are engine and bot evidence, not a claim about human balance or player experience.

## Interface

The lazy Wildways renderer stages one complete tile placement locally. Its nature-atlas map supports pan, zoom, fit-to-board, connected-network inspection and legal-coordinate selection. Tile choice, rotation, marker choice and projected score remain local until the player confirms; a committed tile cannot be undone. The shared Rules sheet can open without discarding the staged move. Desktop layout places the map beside score and network inspection; narrow screens stack market, map, controls and score panels. Light and dark themes preserve habitat and route patterns, player sigils and marker shapes. Theme and language preferences are local to the browser.
