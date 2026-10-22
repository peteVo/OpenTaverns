# Wildways simulation report

**Run date:** 2026-10-21
**Method:** 1,000 seeded headless matches, 250 each at 2, 3, 4 and 5 players; seeds 1–250 at each count. All seats used the same bounded public-information bot. Decision timings are summed simulation time divided by committed turns. Shared victories count once for every winner in seat-win totals.

## Results by player count

| Players | Turns/game | Final score | Habitat | Trail | Stream | Milestones | Seat wins by seat | Start-seat wins / 250 | Markers used / available | Control changes/game | Decision ms/turn |
|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|
| 2 | 36 | 63.43 | 37.78 | 10.56 | 9.75 | 5.34 | 130, 124 | 125 (50.0%) | 4,000 / 4,000 | 16.28 | 0.87 |
| 3 | 45 | 53.87 | 31.76 | 9.35 | 8.60 | 4.17 | 83, 88, 79 | 93 (37.2%) | 5,980 / 6,000 | 24.51 | 1.06 |
| 4 | 52 | 48.33 | 28.12 | 8.61 | 8.36 | 3.25 | 62, 62, 63, 64 | 68 (27.2%) | 7,988 / 8,000 | 32.91 | 1.24 |
| 5 | 60 | 45.41 | 26.60 | 8.14 | 8.05 | 2.62 | 52, 52, 53, 55, 39 | 61 (24.4%) | 9,940 / 10,000 | 40.91 | 1.49 |

All 1,000 matches completed with 0 invalid actions, 0 invariant violations and 0 deadlocks. Control changes count affected pre-existing components whose leader sets change; one placement can affect several components. Total measured simulation time was about 58.2 seconds, summed across matches. The configured turn counts were met in every game.

Seat-win totals include shared-win credits, so a row can sum above 250. Win credits by offset from the round's starting seat were:

| Players | Initiative-position win credits (starting position first) |
|---:|---|
| 2 | 125, 129 |
| 3 | 93, 79, 78 |
| 4 | 68, 67, 51, 65 |
| 5 | 61, 60, 44, 40, 46 |

The starting-seat draw counts by seat index were `[132, 118]`, `[92, 77, 81]`, `[71, 61, 60, 58]` and `[58, 52, 41, 53, 46]` for 2–5 players. The player in the starting seat won or shared victory in 125, 93, 68 and 61 games. These results suggest a modest start-seat advantage at 3–5 players (37.2%, 27.2% and 24.4% of games, versus a one-seat share of 33.3%, 25% and 20%). The 2-player result was 50%. This is a signal to monitor, not a balance conclusion.

## Milestone claims

Counts are claims out of the number of matches in which that milestone was selected. Only two milestones are selected per match, so denominators differ.

| Milestone | 2 players | 3 players | 4 players | 5 players |
|---|---:|---:|---:|---:|
| Great Grove | 52 / 69 (75%) | 63 / 69 (91%) | 68 / 69 (99%) | 65 / 69 (94%) |
| Open Range | 75 / 95 (79%) | 83 / 95 (87%) | 89 / 95 (94%) | 91 / 95 (96%) |
| High Pass | 60 / 86 (70%) | 74 / 86 (86%) | 81 / 86 (94%) | 83 / 86 (97%) |
| Trailblazer | 36 / 85 (42%) | 46 / 85 (54%) | 48 / 85 (56%) | 58 / 85 (68%) |
| Watershed | 33 / 86 (38%) | 47 / 86 (55%) | 54 / 86 (63%) | 60 / 86 (70%) |
| Two Horizons | 62 / 79 (78%) | 62 / 79 (78%) | 53 / 79 (67%) | 42 / 79 (53%) |

Habitat milestones were claimed more often than route milestones in these bot games, especially with two players. Route-milestone claims increased with player count. Each estimate has only 69–95 selected opportunities per player count and depends on this bot's choices.

## Balance and evidence limits

The 2-player games produced higher average scores than the 5-player games, while route scoring averaged about 8–11 points per player and habitat scoring about 27–38. Smaller matches give each player more turns and fewer rivals; these results do not by themselves establish an imbalance. Players used nearly all eight markers; the remaining markers mostly occurred in larger matches where a player had fewer useful influence placements.

Seat-win credits were close across fixed seats. Initiative-position results vary more, with the starting position ahead in 3–5 player games. The sample is useful for catching engine failures and obvious heuristic skews, but the same deterministic heuristic controlled every seat. It does not establish human balance, match duration, or whether players prefer habitat or route strategies. Human playtesting is still needed before changing scoring values.
