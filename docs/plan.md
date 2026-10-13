# Implementation plan

1. Put topology, seeded randomness, state transitions, projections, and invariants in a React-free Hearthlands package.
2. Give the platform server room codes, opaque cookie sessions, serialized actions, reconnectable WebSockets, host transfer, spectator access, and an event history.
3. Build a board-first client with create/join, lobby, game actions, contextual rules, responsive controls, and separate Hearthlands styling.
4. Verify rule flows, privacy, 5–6 player turns, builds, browser layouts, then document deployment and remaining limits.

Release candidate status (2026-09-27): these four milestones are implemented and verified. The rules suite has 28 passing checks. The production-style Edge suite has six passing browser scenarios, including a complete six-seat match, direct browser actions, security and reconnection checks, and desktop/mobile screenshot review. Bot simulations finished 1000/1000 six-player games and 100/100 five-player games with invariants checked after every action. That checkpoint's in-memory limit was subsequently addressed by [durable table storage](table-storage.md); the server remains single-instance.

Creative north star: a contemporary illustrated map laid out on a shared evening table. The board is the signature composition. Warm charcoal, ivory, copper, and terrain inks provide structure; expressive serif headlines pair with legible sans interface text. Motion communicates placement and turn changes. Mobile keeps the map primary and moves controls to a low action rail. Avoid fantasy ornament, dashboard cards, glass, and glowing gradients.

Second-game release candidate (2026-09-29): the platform presents Hearthlands and Saigon Grid as distinct volumes. The Saigon Grid rules, server dispatch, bots, and client are implemented. The 48 rules tests, typecheck, lint, production build, 12 normal Edge browser tests, and development-only late-game scenario test pass. Visual critique and repair captures for both games, the platform, auctions, debt, and the result are recorded in [the design audit](design-audit.md). The seeded 1,000-game Saigon Grid simulation batch and 2/3/5/6-player samples completed. Process-local rooms remain the documented deployment limit.
