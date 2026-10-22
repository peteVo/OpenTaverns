---
name: OpenTaverns
description: A shared online table for seven games, framed by a quiet editorial platform.
colors:
  paper: "#f3f0e7"
  surface: "#fbf9f2"
  ink: "#263b31"
  muted: "#53665b"
  line: "#b9c0b2"
  forest: "#263e33"
  copper: "#b96842"
  focus: "#97502f"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(3.3rem, 6.4vw, 6rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  flat: "2px"
  card: "9px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  6: "24px"
  8: "32px"
  12: "48px"
components:
  button-primary:
    backgroundColor: "#dfb58c"
    textColor: "#20372c"
    rounded: "{rounded.flat}"
    height: "52px"
  rules-dialog:
    backgroundColor: "#f4f1e8"
    textColor: "#26312b"
    rounded: "{rounded.flat}"
    width: "min(980px, calc(100vw - 28px))"
---

# Design System: OpenTaverns

## Overview

**Creative North Star: “A shared table, with seven distinct game worlds.”**

OpenTaverns is a contemporary place for friends to open a shared table. The platform gives the collection a calm, editorial frame; each game remains the main visual object and keeps its own palette and board language. The home page puts the practical task first: choose a game, create a table, or join with an invitation, followed by an asymmetric shelf that previews all seven games.

Fraunces brings a bookish display voice, while DM Sans keeps instructions and controls direct. The shared interface uses warm paper, forest ink, flat controls, and clear focus states. Game-specific themes remain local to each game. The shared platform stays in English; Wildways provides its own English, German and Vietnamese rules and table controls. Long names and proper-name diacritics should remain legible.

**Key Characteristics:**
- Task-first table entry, then an asymmetric seven-volume collection shelf.
- One typography pairing and shared control language across seven separate game identities.
- Game boards and game-specific color systems stay visually distinct.

## Colors

The shared platform palette pairs warm paper and forest ink with a restrained copper accent; individual games add their own colors in their local styles.

### Primary
- **Forest** (`{colors.forest}`): Shared dark surface for table entry and selected platform elements.
- **Copper** (`{colors.copper}`): Selection and small emphasis, including the selected game outline.

### Neutral
- **Warm Paper** (`{colors.paper}`) and **Soft Surface** (`{colors.surface}`): Main page and form surfaces.
- **Forest Ink** (`{colors.ink}`) and **Muted Green** (`{colors.muted}`): Main text and supporting copy.
- **Sage Line** (`{colors.line}`): Dividers and quiet boundaries.
- **Focus Brown** (`{colors.focus}`): Visible keyboard focus outline.

## Typography

**Display Font:** Fraunces (Georgia, serif)
**Body Font:** DM Sans (sans-serif)

**Character:** Fraunces gives game names, major headings, and selected values an editorial character. DM Sans carries instructions, navigation, labels, and longer reading comfortably.

### Hierarchy
- **Display** (500, responsive clamp, tight 1.02 line height): Home headline and large game titles.
- **Headline / title** (Fraunces 500): Section headings and game-specific titles; use the local game's established scale.
- **Body** (DM Sans 400, generally 1rem, 1.5–1.65 line height): Instructions, rules, descriptions, and form text.
- **Label** (DM Sans 600–800, generally .8–.9rem): Navigation, controls, status, and compact metadata.

**The Two-Voice Rule.** Use Fraunces for display and game values; use DM Sans for instructions and controls. Avoid decorative italic headlines.

## Layout

The home page uses the original dark green (`#262e29`) welcome and footer with warm light text, followed by a lighter game collection. It keeps the wide two-column welcome and table-entry stage, then a six-column asymmetric game shelf: Hearthlands and Saigon Grid receive wider spans, while Mosaic and Wildways span the shelf; the remaining volumes sit between them. At 760px and below, the stage stacks and the shelf becomes one column. Content uses fluid side padding, with a 1600px platform maximum and 1440px collection maximum. Entry-panel button styles apply only to their direct controls so the nested Rules dialog retains its own readable palette and focus treatment.

The shared spacing steps are 4, 8, 12, 16, 24, 32, and 48px. Game boards may use exact pixel geometry to preserve aligned cells and map positions. On game tables, context and actions sit beside the board on wide screens and flow vertically on phones; board panning stays bounded to the board area.

## Elevation & Depth

The platform is flat by default. Contrast, borders, spacing, and selected outlines establish hierarchy; dialogs use a shadow to separate the active document from its backdrop. State transitions are short (180ms shared token), and reduced-motion preferences suppress optional movement.

## Shapes

Platform controls and collection volumes use nearly square corners (2px); Tidecall's card-like objects retain their game-specific rounded corners (9px token). Use borders and tonal surfaces to group actual controls or game objects. Keep keyboard focus visible with a 3px outline and offset.

## Components

### Buttons and fields
- **Primary action:** Full-width warm accent in the homepage entry panel, with dark text and a 52px minimum height.
- **Secondary actions:** Flat, labeled controls with clear borders or underlined link treatment. Primary actions, inputs, navigation links, and rules controls provide at least 44px target height where styled by the shared platform.
- **Fields:** Warm light surface, dark text, near-square border, and clear label. Preserve legible placeholders and visible focus.

### Home collection volumes
Each volume previews its own game grammar and palette before a table is opened. Keep selection explicit and provide a separate “How to play” entry for every game. The collection is asymmetric rather than seven matching feature cards.

### Rules document
Rules open in a native `<dialog>` as a full reading surface with section navigation, quick rules, and game-specific accent colors. On narrow screens the section navigation becomes a horizontal strip and the rules text remains in a vertically scrolling document.

### Invitation copy
Invitation UI offers a copyable link and QR code where the invitation surface supports both. If clipboard access is unavailable, provide a selectable text field fallback and a readable status message.

### Seven game identities
- **Hearthlands:** Illustrated landscape and tactile routes; mineral ground, terrain greens, ochre, and clay. The 19-region map and construction/material actions define its table.
- **Saigon Grid:** Metropolitan cartography and a street circuit; blue-green transit ink, civic cream, and rust. A 28-stop circuit frames public portfolios and district context.
- **Blackout:** Civic night-shift schematic with public system nodes and discrete private role/action controls.
- **Tidecall:** Printed navigation table with ivory paper, sea contours, copper accents, original SVG suits, and clear card corners. The table and private hand carry the composition.
- **Werewolf:** Stable village circle with original line-drawn houses and quiet character silhouettes; warm limewash/olive by day and slate-indigo/candle cream at night. Keep private roles private until a permitted reveal.
- **Mosaic:** Intimate ceramic studio centered on the personal 5×5 composition; paired Palettes and a narrow score/Gallery rail. Tile families use original marks and hatching as well as color.
- **Wildways:** Nature atlas of a growing shared map. Forest, Meadow and Highland tiles use distinct silhouettes and textures; Trail and Stream ports have separate patterns. Player sigils and marker shapes accompany color so connected networks and changing control remain legible. The `.wy` renderer owns its light/dark nature palette, `.wy-dark` theme and `--w-*` tokens; localized English, German and Vietnamese rules and table controls stay inside the game surface.

## Do's and Don'ts

### Do:
- **Do** preserve each game's local visual identity when changing shared platform styles.
- **Do** keep primary actions and important touch controls at least 44px high.
- **Do** use text, symbols, or patterns alongside color for game-state distinctions.
- **Do** keep rules readable as a document and invitations copyable, with a text-selection fallback.
- **Do** ensure long names and Vietnamese diacritics render cleanly in the chosen fonts.

### Don't:
- **Don't** flatten the seven games into a single palette or matching-card collection.
- **Don't** use fake wood, parchment, neon, casino styling, gradients, or glass containers in the shared platform.
- **Don't** hide roles, choices, or status distinctions behind color alone.
- **Don't** use ambient floating or glow; motion should respond to interface state and respect reduced-motion settings.
