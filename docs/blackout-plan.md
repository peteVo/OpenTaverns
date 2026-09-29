# Blackout implementation plan

Baseline (2026-09-29): Hearthlands and Saigon Grid pass 48 rule tests, typecheck, lint, and production build. The server already authenticates seats, applies actions serially, enforces one controlling tab, and sends a viewer-specific room projection. Its lobby cap and bot runner assume at most six sequential players; these are the platform seams Blackout must change.

1. Add a deterministic `packages/blackout` engine with 5–10 secret factions, independent public professions, structured Incidents, two Work Orders, simultaneous locked responses, Insight/Audit voting, Crisis/Stability victory, redacted projections, replay, invariants, bots, and scenarios.
2. Extend room creation/start/seat cap, action validation, private projection, phase-aware bot actions, and safe timeout handling in the existing server. Keep Blackout rules in its package.
3. Add a separate lazy-loaded Blackout client and a third asymmetric collection volume. Add one shared structured Rules sheet; the three games supply their own content.
4. Test privacy, malicious actions, reconnect/multi-tab, bot takeover, 5–10 player simulations, both older games, desktop/mobile browser flows, and two screenshot critique/fix passes.

Art direction: a civic night-shift field sheet. Near-black slate, weathered cream, signal amber, and muted coral; a four-line city circuit bends and breaks as systems weaken. Large Fraunces headlines express incident stakes; compact DM Sans labels and tabular numerals keep actions precise. The schematic is a game object, not a dashboard. Motion only marks reveal, lock, and changed stability; reduced motion disables it.

Rules choices: Disruptors know one another; Operators know only themselves. Responses lock once and cannot be changed. An Audit needs a strict majority of all seats for one Work Order; ties and abstentions save Insight. A timed-out response defaults to Stabilize for either faction. Profession abilities are public uses with the Forecast preview itself private. Default Relaxed pacing leaves discussion generous but eventually advances abandoned rooms safely.
