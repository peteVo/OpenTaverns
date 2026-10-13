# Tidecall visual QA

## Direction and audit

Hallmark and frontend-master were inspected before UI work. The existing collection, invitation/QR, Rules sheet, session flow and game identities were retained. Tidecall adds a Map / Diagram composition: a printed navigation table, ivory cards, deep-sea contour lines, restrained copper emphasis, Fraunces display and DM Sans instructions. Original Wave/Wind/Reef/Sun SVG marks have distinct patterns and readable text/ranks. The table and private hand are the primary objects, not analytics panels.

## First functioning render

Real Edge screenshots covered desktop 1440×960 and phone 390×844: dealing; Tide reveal; Forecast selection, lock and reveal; Compass decision, lock and reveal; normal/partial/follow-suit tricks; dominant suit; Undertow; Crosscurrent switch; Shifting Current; final trick; resolution; score; match result; reconnect; shared Rules. Runtime errors and root overflow were checked.

Critique: the empty Forecast table had too much vertical space. The private hand appeared after the action and below the first phone viewport. Mobile contextual Tide rules wrapped awkwardly. More than three played cards could collide with the winner caption.

## Refinement pass 1

Moved the hand before decisions and shortened waiting/reveal tables. Kept normal trick play central. Tightened phone spacing and made Tide help a single-line control. Introduced a dedicated multi-row arrangement for crowded phone tricks. Rendered and checked the same desktop and phone states again; local selections survived opening Rules and reload.

## Refinement pass 2

Corrected cascade precedence in crowded-trick height and public Compass indicators. Gave winner cards and captions separate space. Added a concise public Compass adjustment recap, then short collection toward the winner after the readable winner mark. Reduced motion retains the cards and information without spatial animation. Reviewed actual new screenshots, including result and Rules. The app now has a compact phone crew and tactile hand while desktop retains the broad navigation table.

The expanded six-player render exposed long-name truncation and a winner badge crowded against the final caption. A final refinement gave names their own line, kept score/call/token compact below them, and increased row spacing with the badge contained inside its row. The resulting six-card table has separate player labels, winning-card mark and caption. Seven-card hands scroll within the hand surface while preserving readable corners and the explicit commit button.

## Release checks

Expanded the scenario suite to include six-player resolution, seven-card hand, final round and an actual void in the lead suit. Collection and lobby screenshots cover desktop and phone; both use the shared Rules sheet. Browser layout checks also cover widths 320, 375, 414 and 768. A landscape 844×390 reduced-motion render verifies keyboard selection, explicit Play and Escape from Rules. The full multiplayer test uses six private contexts plus a spectator, finishes ten rounds and rematches without rejoining.

The suit symbols, text and rank corners remain usable without color. Forecast buttons and cards have keyboard semantics and focus; mobile uses select then Play, preventing a scroll from submitting a card. Rules use native dialog focus and preserve unlocked choices. Unavailable cards state why they cannot be played. Pending hand/Forecast/Compass data is projected only to its owner, rather than hidden by frontend styling.

Screenshots selected for the README and this audit live in `docs/images/qa/tidecall-*-final.png`. Test screenshots and intermediate passes are ignored artifacts in `test-results`.

## Hallmark critique

Philosophy 5 / Hierarchy 4 / Execution 4 / Specificity 5 / Restraint 4 / Variety 5. The current Tide is explicit, the table is central, and the hand has physical card grammar. There are no enterprise metrics, hacker frames, neon, casino trim, fake browser chrome, large illustration dependencies or dashboard card grids. Colors/fonts are named scoped tokens; public numbers are actual game state. The three motion primitives are arrival/reveal, card selection lift and winner collection. The two substantial refinement passes addressed information placement and crowded resolution, rather than only decoration.

This game module added no persistence, offline mode or sound subsystem. The platform subsequently added [durable table storage](table-storage.md).
