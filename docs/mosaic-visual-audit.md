# Mosaic visual QA

Hallmark critique: **Philosophy 5 / Hierarchy 4 / Execution 4 / Specificity 5 / Restraint 5 / Variety 5**.

## Direction and preserved system

The locked `DESIGN.md` supplies Fraunces roman / DM Sans, flat controls, 4-point spacing and restrained state motion. Mosaic's Workbench puts the personal composition first, rather than reusing another game's map, night diagram or village circle. Five original SVG marks and surface hatching distinguish mechanically equal families. A pale ceramic studio and fired-charcoal studio retain the same tile colors, with dark marks on Ochre for contrast.

## Actual render → critique → refinement

1. **First functioning browser render:** desktop 1440×1000 and phone 390×844, plus 320/360/768 layouts. Covered lobby, market, empty/mid/late boards, selected Palette, one/two previews, invalid adjacency, score highlights, Rules, dark studio, opponent inspection and results. Critique: global disabled-button opacity washed out committed ceramics; score/objectives were distant on phones; confirmation could sit below the initial viewport. First refinement restored full-opacity read-only ceramics, improved Ochre symbol contrast, moved projected total alongside the board, added a compact Commission summary and tried a sticky confirmation.
2. **Second browser render:** confirmed clearer tiles and progress, but the sticky confirmation covered staged tile labels and some controls. Second substantial refinement removed the sticky overlay, composed a compact phone grid at a maximum 310px while preserving ≥44px cells, tightened the masthead/status/preview spacing and kept confirmation in natural document flow. Undo, order and Cancel remain unobstructed.
3. **Final rendered verification:** confirmed touch geometry, tile contrast, full controls, Rules/reload staging persistence, keyboard placement, themes and opponent access. A real turn also succeeded with `crypto.randomUUID` unavailable, exercising the shared HTTP-phone fallback. Score selection returns the phone view to contributing cells; server rejection text appears beside the pending action. Named scoring fixtures are tested to contain their advertised formation, rather than just any legal board.

## Evidence

- [Desktop composition](images/qa/mosaic-desktop-final.png)
- [Phone two-tile preview](images/qa/mosaic-preview-mobile-final.png)
- [320px layout](images/qa/mosaic-narrow-final.png)
- [Dark phone studio](images/qa/mosaic-dark-mobile-final.png)
- [Rainbow explanation](images/qa/mosaic-rainbow-mobile-final.png)
- [Shared phone Rules](images/qa/mosaic-rules-mobile-final.png)
- [Final scoring](images/qa/mosaic-results-final.png)

Full-page screenshots include content below the viewport; they do not imply everything fits on one screen. Phone play uses natural page scrolling, with no internal board pan or required dragging. Primary controls have minimum 44px targets. Cells announce coordinates, family, commitment/preview and legal placement. Family identity uses marks as well as color. Native Rules retain focus/scroll behavior, and reduced-motion preferences preserve all information without tile travel. Automated checks assert no horizontal overflow or page errors and verify an entirely non-drag placement path.

The tests use Edge on Windows with responsive viewports. Physical Android/iPhone devices, assistive-technology certification and a timed human playtest have not been performed. No raster or third-party artwork was introduced.
