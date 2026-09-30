# Tidecall implementation

Baseline: 86 existing tests, typecheck, lint, production build pass (2026-10-01). Keep all three engines and renderers intact.

1. Pure deterministic package: 52 cards, eight Tides, ten-round arc, simultaneous private Forecast and Compass, legal tricks, scoring, replay and conservation invariants.
2. Server dispatch: per-seat projection, round-scoped intentions, existing action IDs/controllers/reconnect grace, pacing, bot takeover and host rematch with connected-seat policy.
3. Lazy client: tactile navigation table, deliberate select/commit hand, simultaneous reveal, score explanations, inspectable history and shared Rules.
4. Compare scoring candidates; simulate at least 1,000 games across 3–6 seats. Add engine, privacy, malicious-client, reconnect, network retry and rematch checks.
5. Render desktop/portrait/landscape; critique and fix twice; cross-game regression and documentation.

## Exact rule decisions

Crosscurrent uses Wave through ceil(hand-size / 2) tricks, then Reef. Shifting Current uses the winning card's suit for the next trick. Undertow selects the lowest rank within the lead suit. All ordinary Tides choose highest eligible rank. First lead follows a seeded initial dealer; dealer rotates every round.

Forecasts lock immutably. Compass decisions lock immutably, stay private until all eligible players respond, and consume the match token only on an adjustment. Used tokens automatically Keep. Timeouts forecast using the hand heuristic, Keep Compass, and play the lowest legal card by rank then suit. No seat elimination.

Short DEALING/TIDE_REVEAL/FORECAST_REVEAL/COMPASS_REVEAL/TRICK_RESOLUTION phases preserve readable presentation. Dealer can advance them; the server also advances them automatically. Round scoring remains inspectable before the next deal. Final ties use exact rounds then shared victory.

Rematch is host-controlled after MATCH_OVER. All human seats must be connected or explicitly replaced with bots. Same table, host, seats, cookies and spectators; fresh production seed, fully reset match.

## Hallmark art direction

Creative north star: an elegant navigation table where water, weather and prediction shape each decision.

Macrostructure: Map / Diagram, designed as an app. Custom atmospheric printed nautical palette: ivory paper, deep sea table, copper Sun, sea-blue Wave, pale sage Wind, clay Reef. Fraunces display and existing DM Sans body. Signature move: a tide compass centered within a contour-line table; played cards converge around it, with the winner marked before collection. Original SVG suit motifs repeat as restrained printed patterns. No dashboard blocks, pirate imagery, casino trim or glowing frames.

Desktop has a spatial trick table and overlapped hand. Phone has compact public seating, central trick, and a readable horizontal hand with a separate commit action. Motion: deal/reveal opacity, selected-card lift, winner collection transform; reduced motion disables spatial travel. Rules preserve local unlocked selections.
