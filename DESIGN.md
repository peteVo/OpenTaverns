# OpenTaverns design

**Creative north star:** a contemporary place for friends to open a shared table. The platform frames each game; the game becomes the main object. The two games have distinct visual languages while sharing an invitation, wordmark, clear controls, and player identity.

## Platform system

- **Genre:** atmospheric tabletop editorial. A compact marquee introduces the collection; game selection uses an asymmetric two-volume shelf, not matching feature cards. Tables use a workbench layout. Rules read as a long document.
- **Signature move:** each volume shows its own board grammar before a table is created. Hearthlands uses paths and Sites; Saigon Grid uses a street circuit and a river trace.
- **Typography:** Fraunces (roman, 500) for display and game values; DM Sans (400–800) for instructions, controls, labels, and long text. Vietnamese proper names must render with their full diacritics. No decorative italic headlines.
- **Shared colors:** charcoal `#262e29`, warm paper `#e9e6d9`, copper `#c58056`, and focus `#bd743b`. Accent is reserved for invitations, current action, and selection.
- **Spacing:** 4-point increments, generally 8/12/16/24/32/48/64. Board geometry may use exact pixel measurements to keep its cells aligned.
- **Controls:** flat rectangles, visible labels, minimum 44px touch targets for primary actions, visible keyboard focus. The invitation always offers QR and a copyable link.
- **Motion:** only respond to state changes and presses. Animations are under 220ms and absent when reduced motion is requested. No ambient floating or glow.
- **Mobile:** game context and the next action must be visible without reading tiny text. The board may pan within its own bounded area; a changing location label shows the current stop.

## Game identities

| | Hearthlands | Saigon Grid |
| --- | --- | --- |
| Character | Illustrated landscape, tactile routes | Metropolitan cartography, street circuit |
| Palette | Mineral ground, terrain greens, ochre, clay | Blue-green transit ink, civic cream, rust |
| Main object | 19-region SVG map with keyboard-accessible Sites and Links | 28-stop city circuit with public portfolios and a district summary center |
| Actions | Construction and Materials beside the map | Purchase, auction, trade, and debt beside the circuit |

## Design boundaries

No fake wood, parchment, neon, fintech dashboards, casino styling, generic matched cards, gradients, or glass containers. Districts use names and marks as well as color. The board itself is the artwork; avoid a logo-only dead center. Use containment only for actual objects such as a Chronicle, trade offer, Holding, or invitation.
