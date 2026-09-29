# Visual audit and refinement log

The audit used the existing screen captures and current React/CSS implementation before the second game was added. The sources were `apps/web/src/main.tsx`, `apps/web/src/style.css`, and `DESIGN.md`.

## Baseline findings

| Severity | Hallmark tell / surface | Where | Concrete correction |
| --- | --- | --- | --- |
| Major | Default-attractor sameness: one large Hearthlands graphic represented the entire platform | Homepage hero, `main.tsx` HomeMap and `style.css` home-stage | Replace the graphic with a restrained collection marker; present both game grammars in the game shelf. |
| Major | Icon-tile sameness risk for adding a second game | Single game selection in the homepage form | Make the two game volumes asymmetric and visibly different before the form. |
| Major | Weak interaction hierarchy on phones | Hearthlands board and action rail | Keep the board bounded, make the turn instruction prominent, reduce nested action containers. |
| Major | Dead-center risk for a metropolitan circuit | Saigon Grid board concept | Use the center for district control, current location, and auction context. |
| Minor | Eyebrow overuse and crowded uppercase labels | Home, lobby, and game HUD | Reserve small labels for genuinely useful status and collection metadata. |
| Minor | Board and cards compete for attention | Hearthlands action rail | Use lighter, flatter controls; keep the illustrated board dominant. |

**Baseline count:** 0 critical · 4 major · 2 minor.

## Browser pass 1 — desktop and 390px phone

Screenshots: [platform](images/qa/grid-platform-desktop-pass1.png), [lobby](images/qa/grid-lobby-desktop-pass1.png), and [city board](images/qa/grid-board-mobile-pass1.png).

- The old hex graphic was cropped on both homepage widths. Replaced it with a typographic collection marker.
- The two game volumes were the same height and layout. Made Hearthlands wider and taller; Saigon Grid now reads as a compact urban volume.
- The lobby's small diagonal route marks left a large empty area. Replaced them with a legible street-circuit illustration.
- The Saigon Grid phone view opened on the opposite side of the board from the active token. The board now pans to the current stop and responds to viewport changes.
- The board center was a slogan. It now shows current auction or purchase context and district control.

## Browser pass 2 — rebuilt platform and both games

The [desktop platform](images/qa/grid-platform-desktop-pass2.png) and [phone platform](images/qa/grid-platform-mobile-pass2.png) keep the entire collection marker visible and give the games different scale and layout. The [Saigon Grid lobby](images/qa/grid-lobby-mobile-pass2.png) keeps its invitation and QR code readable at 390px. The [desktop city board](images/qa/grid-board-desktop-pass2.png) uses the center for district control and current action context. A two-browser auction also reached its owner and resolved.

The [phone city board](images/qa/grid-board-mobile-pass2.png) still opened away from the active token when the viewport changed after a match started. Centering now responds to resize; the [next capture](images/qa/grid-board-mobile-pass3.png) brought Central Exchange into view. That pass exposed clipped center text inside the pannable board. The [latest capture](images/qa/grid-board-mobile-pass4.png) uses the board center as a street-map motif at phone width; the turn heading and current-stop label carry the actionable text outside the pan area.

The Hearthlands [construction](images/qa/hearth-construction-mobile-pass2.png), [main turn](images/qa/hearth-main-mobile-pass2.png), and [result](images/qa/hearth-victory-mobile-pass2.png) remained usable during a complete six-player server match. Its board remains the focus, while flatter action controls and a shorter phone board window expose the next action sooner. The disabled action labels were too faint in the main-turn capture, so the last refinement keeps their text legible while retaining the disabled state.

The [auction capture](images/qa/grid-auction-desktop-pass3.png) showed its bid controls below the visible action rail because the tutorial and wallet filled the space above them. The auction now opens directly beneath the panel tabs; available Credits and bid consequences remain inside the auction panel. The browser test checks that the bid row is in the viewport.

## Final browser pass

The [revised auction](images/qa/grid-auction-desktop-pass4.png) presents its price, bidder state, available Credits, and three bid choices together in the first viewport. The [Hearthlands phone action rail](images/qa/hearth-main-mobile-pass3.png) keeps unavailable actions legible. The [Saigon Grid phone board](images/qa/grid-board-mobile-final.png) opens on the active stop and has no clipped center text. The combined Edge suite includes a complete Hearthlands match and Saigon Grid auction, reconnect, spectator, and bot replacement flows.

## Late-game browser pass — scenarios and result

Development-only scenarios exposed [District development](images/qa/qa-grid-district-desktop.png), [trade](images/qa/qa-grid-trade-desktop.png), [Municipal Review](images/qa/qa-grid-review-desktop.png), debt, and Insolvency in a real Edge browser. The first [phone debt capture](images/qa/qa-grid-debt-mobile.png) showed the tutorial and tall board pushing recovery actions below the first screen. The tutorial now appears only during the opening roll, and the action panel precedes the board on phones during auctions, purchases, and debt. The [second debt capture](images/qa/qa-grid-debt-mobile-pass2.png) shows the recovery and Insolvency controls without scrolling.

The first [phone](images/qa/qa-grid-result-mobile-pass1.png) and [desktop](images/qa/qa-grid-result-desktop-pass1.png) result captures proved the dialog fit but had an empty winner portfolio from the fixture. The scenario now transfers three Holdings into a completed District on Insolvency. The final [phone](images/qa/qa-grid-result-mobile-pass2.png) and [desktop](images/qa/qa-grid-result-desktop-pass2.png) result captures show the last solvent player, portfolio, District, match totals, and a way back to the final city. Escape closes the dialog; Results reopens it. No horizontal overflow or page errors appeared in the scenario browser test.
