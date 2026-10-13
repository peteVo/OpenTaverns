# Werewolf implementation plan

Continue the existing platform: five game packages, one table/session server, shared Rules, projections and durable snapshots. Scope reaches the new package, server dispatch/setup/timers/rematch, client selection/setup/village surface, Rules registration, bots/simulation, fixtures/tests and documentation. Existing game engines and saved tables remain intact.

1. Verify Classic against publisher English `LMELG01EN_RULES-2023_WEB.pdf` (©2023, linked by Zygomatic in October 2026). Record differences and digital decisions.
2. Build typed Classic roles, seeded distribution, padded private night schedule, layered Lovers/Sheriff identity, queued deaths/reactions and boundary-only victory.
3. Test every Classic role and high-risk chains, privacy, stale actions, serialization/replay and generated complete matches before expansion roles.
4. Integrate authoritative transport, host setup validation, 8–18 seats, clocks/grace, bots, persistence and fresh-role rematch.
5. Build a warm village circle by day and a quiet private-action surface by night. Retain Fraunces/DM Sans, flat accessible controls and the shared Rules sheet. Original SVG silhouettes, no commercial artwork or horror effects.
6. Implement only fully verified optional expansion roles, with isolated rulesets, interactions, tests and bot support.
7. Run 1,000 varied matches, malicious/private/reconnect browser checks, two desktop/mobile screenshot refinement passes, cross-game regression and release documentation.

## Classic decisions to encode

- No parity victory. Village needs no living wolves and at least one living Villager; wolves need no living Villagers and at least one living wolf. An empty village has no winning side. Mixed-team Lovers win only when both survive alone; they do not share faction victories.
- Wolf selection requires unanimous agreement; disagreement at timeout gives no victim. Ordinary wolves cannot target pack members.
- Seer sees the target's character, not just faction. Lovers learn partner identity, not partner role. Lovers cannot vote to eliminate one another.
- Witch can use both one-use potions in one night and can target herself. Healing removes wolf attack, not poison or lover death.
- Thief adds two Simple Villager cards before shuffling the entire role pool; leftover cards are private choices. Two wolf spares require taking one.
- Sheriff is an office, not a role; double village vote and an explicit deciding choice on ties. The dying Sheriff appoints a successor.
- Hunter reacts to wolf/village/lover deaths. Poison treatment will be recorded explicitly from verified sources rather than guessed.
- Little Girl uses a labelled digital adaptation: optional uncertain glimpse of several possible pack members, seeded exposure risk redirecting the wolf victim, never a free Seer.
- Night windows use a fixed padded schedule independent of role presence. Public phase, timer and revision do not identify pending roles; private choices close at window boundaries.
- Digital election tie, safe timeouts and optional non-Classic role concealment are documented separately from physical rules. Default discussion has no limit.

## Art direction

A village register becomes a social circle: small lit houses around a shared square, stable seating, no avatar wall. Day uses warm limewash, olive ink and restrained ochre; night uses indigo/slate and candle cream. Each role has an original silhouette built from the same illustrated village vocabulary. Night prompts are deliberately private and collapsible. Death extinguishes a window, without graphic imagery. Motion communicates day/night change and selection only, with reduced-motion parity.
