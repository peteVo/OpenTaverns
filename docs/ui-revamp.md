# OpenTaverns UI revamp

The platform now puts table creation and joining in the first screen, with a six-game collection below it. Each game retains its own board, palette and rules. Shared controls use the foundation in [DESIGN.md](../DESIGN.md) and [design-system.md](design-system.md).

## Improvements

- **Platform:** task-first entry, invitation-specific joining, keyboard submission, duplicate-submit protection, a skip link, explicit loading/error states, and direct How to Play access for every game.
- **Shared table UI:** reliable invitation copying with announced success and a selected-text fallback; readable Rules with current-section tracking, native focus behavior, 44px controls and full-width phone presentation; clearer host-register loading and refresh states.
- **Hearthlands:** quieter board workbench, larger zoom controls, readable resource fields and full player names.
- **Saigon Grid:** selected-stop/tab semantics, clearer lobby readiness, wrapping controls and a bounded 430px phone map with selected-location context.
- **Blackout:** selected-team semantics, readable assignment controls, two columns at 360–390px and one below 360px, clearer readiness and larger phase metadata.
- **Tidecall:** a readable four-column phone hand for seven-card rounds and a named Forecast choice group.
- **Werewolf:** the current decision precedes the village on phones; crowded villages use a roster at narrow widths.
- **Mosaic:** larger palette marks, explicit Commission selection, clearer projected scoring and narrow-screen rosters.

No engine, server validation, multiplayer protocol, scoring, victory condition, or simulation source was changed. No dependency was added. Existing game themes and local preview state remain in place.

## Before and after

These captures show the original `60eb5a7` homepage and the final built UI, with fonts settled and entrance animations completed. They were opened and checked after capture.

| Viewport | Before | After |
| --- | --- | --- |
| Desktop, 1440px | [Before](images/revamp/home-before-1440.png) | [After](images/revamp/home-after-1440.png) |
| Phone, 390px | [Before](images/revamp/home-before-390.png) | [After](images/revamp/home-after-390.png) |

Two game refinement passes and the final matrix are retained locally under ignored `.test-data/revamp`. The final matrix covers all six games at 320, 390, 768 and 1440px, including private decisions, auctions, crowded seats, Mosaic previews, final scoring, Rules and the dark studio.

## Validation

| Check | Result |
| --- | --- |
| Baseline tests / typecheck / lint / build | 271 tests passed; all other checks passed |
| Baseline production Edge suite | 24 passed, 11 development-only skips |
| Final `npm test` | 271 passed, including storage/restart |
| Final typecheck / lint / production build | Passed |
| Clean `npm run test:e2e -- --development` | 38 passed, 3 skipped |
| Production-only security checks, isolated production server | 2 passed |
| Final screenshot matrix | Passed separately |
| Six-game touch landscape smoke check, 740×360 | Passed separately; six captures |

The three clean-run skips were two production-only checks and the opt-in capture matrix, each exercised separately. New regressions cover touch joining, Rules focus return and landscape, keyboard/history behavior, denied clipboard access and duplicate submissions. The landscape smoke check uses synthesized touch to place a Hearthlands site, bid in Saigon Grid, select Blackout/Tidecall/Werewolf choices, and stage adjacent Mosaic tiles. The broader suite exercises multiplayer, hidden information, reconnect, bots, latest-tab control, rematches, timers, management deletion and all six games. Earlier stale title/heading expectations and an oversized full-page management capture were corrected before the clean run.

Targeted live homepage measurements for ten text/control selectors ranged from **5.39:1 to 10.52:1** contrast. This is a measured sample, not whole-app accessibility certification. Main JavaScript gzip size changed from 100.23 kB to 102.07 kB (+1.84 kB).

## Impeccable review and limits

Audit, independent critique, adaptation, hardening, polish and design-system documentation informed implementation. Critique assessments A (`/root/server_review`) and B (`/root/client_tests_review`) ran independently; the baseline informal score was 28/40. The independent finish reviewer approved the supplied visual scope with no required fixes; a separate source review found no actionable behavioral regression.

The context launcher initially could not initialize its engine. Engine 0.1.16 was subsequently installed in the repository's ignored test cache and the detector ran. No live overlay was injected because browser evaluation was read-only. The final scan reported 12 heuristic warnings (six font, six side-tab) and 792 token-coverage advisories (350 colors, 440 sizes, two radii). The pinned Fraunces identity accounts for font false positives; the concise shared reference deliberately does not enumerate every legacy game-local literal. Game styles remain their palette/geometry source of truth. This is not a clean-detector claim.

Physical phones, Safari/Firefox, screen readers and mid-range-device performance remain unverified. English is the existing interface language; Vietnamese names and longer German names were exercised, but no German/Vietnamese translation system was introduced or claimed.
