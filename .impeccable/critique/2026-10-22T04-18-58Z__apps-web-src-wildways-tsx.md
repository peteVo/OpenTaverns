---
target: Wildways implementation review; 29/40 initial assessment, final two-fix disposition ship, no final rescore
total_score: 29
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
target_identity: "file:E:\\Projects\\OpenTaverns\\apps\\web\\src\\Wildways.tsx"
target_fingerprint: "sha256:3cffd7f7f516d9cabb818d62bd779114694de79c98fda5fb5004c26df4f3598f"
target_path: "E:\\Projects\\OpenTaverns\\apps\\web\\src\\Wildways.tsx"
timestamp: 2026-10-22T04-18-58Z
slug: apps-web-src-wildways-tsx
---
# Wildways design review

**Review date:** 2026-10-22
**Scope:** Wildways table UI, map legibility, placement flow, themes, responsive states and Rules interaction. This is a release review of the available implementation and browser evidence, not a physical-device or assistive-technology certification.

## Independent heuristic review

An independent review of the initial interface scored 29/40 across Nielsen's ten heuristics:

| Heuristic | Score / 4 |
| --- | ---: |
| Visibility of system status | 3 |
| Match between system and real world | 3 |
| User control and freedom | 4 |
| Consistency and standards | 3 |
| Error prevention | 3 |
| Recognition rather than recall | 3 |
| Flexibility and efficiency | 2 |
| Aesthetic and minimalist design | 2 |
| Help users recognize, diagnose and recover from errors | 3 |
| Help and documentation | 3 |
| **Total** | **29 / 40** |

The review found a strong nature-atlas identity, useful placement preview and cancel behavior, and clear lobby invitation flow. It identified several friction points: an initial map zoom of about 61%, dense side panels, possible confusion between projected points and awarded points, weak contrast in dark mode, and insufficient guidance for a new player's first turn. The 29/40 is the initial assessment; the final implementation was not rescored against all ten heuristics.

## Changes and browser evidence

The subsequent implementation pass set the opening map to 125% zoom, tightened supporting copy, separated potential from awarded points, added first-turn guidance, corrected light/dark contrast, raised mobile controls to at least 44px targets, and added a fixed placement confirmation tray. These address the review's main usability concerns while retaining the map's patterns, tile geometry and game palette.

The browser review covered six viewport sizes: 1440×1000, 390×844, 320×740, 360×800, 768×1000 and 740×360. English, German and Vietnamese were checked in light and dark themes. The run reported no page errors or document-level overflow. UI checks covered staged placement, rotation, marker selection, Rules focus preservation, real CDP pinch interaction, orientation changes and a delayed opening-bot response. Two multiplayer checks covered complete 2–5 player games, security, takeover and long-map navigation. Browser interaction and saved Playwright screenshots were used; no live overlay was injected into the browser.

Contrast was measured before the visual fixes and prompted corrections. The initial dark placement confirmation measured 1.44:1, the active-player rail 1.04:1, and the map 1.58:1; the light muted text measured 4.36:1. Those initial values are findings, not final-state measurements. Final browser assertions measure representative dark-theme text/control states against 4.5:1 for normal text and 3:1 for large text. Light muted text was recalculated at 4.81:1. These sampled checks passed; they do not certify every possible state or replace assistive-technology testing.

An installed Impeccable binary at version 0.1.16 scanned `Wildways.tsx`, `Home.tsx` and `WildwaysTile.tsx` and reported zero findings for each. This is supplementary evidence; it does not replace the heuristic review or browser inspection. The review did not find an `.impeccable/critique/ignore.md` file.

## Final review and disposition

The final visual review requested two fixes: the long shared-victory map opened at an unreadable 9% zoom, and several interface controls used inconsistent Unicode icons. The implementation now opens long maps at a minimum 70% zoom centered near the latest tile. **Fit map** explicitly shows the whole landscape; **Latest** returns to readable detail. Rotation, network and Milestone controls use authored SVG icons; player sigils remain intentional ownership identifiers.

The reviewer inspected the final captures and returned **ship** at this two-fix scope: both fixes resolved, no observed regressions, remaining findings clear. This is not a new full heuristic score. A fresh reviewer spawn was unavailable because the session reached its agent limit, so the existing independent Assessment B review context performed the final check. Assessment A and B had initially worked independently.

After the last map/icon changes, the five Wildways UI/multiplayer checks passed again in 23.9 seconds. The clean full development browser sweep passed 46 checks with three intentional skips, including the real turn-clock checks. The full sweep preceded the final isolated map/icon refinements; the five-check rerun covers their final state. See [release validation](wildways-release-validation.md) for production, engine and simulation evidence.

## Final captures

- [Collection](images/wildways/collection.png) and [desktop landscape](images/wildways/landscape-desktop.png).
- [Phone placement preview](images/wildways/phone-preview.png) and [dark desktop](images/wildways/dark-desktop.png).
- [Phone results](images/wildways/phone-results.png) and [shared victory at readable zoom](images/wildways/shared-victory.png).
- [Vietnamese at 320px](images/wildways/vietnamese-320.png) and [German Rules](images/wildways/german-rules.png).

## Remaining evidence limits

- Verify touch behavior on physical phones/tablets and test keyboard/screen-reader flows with assistive technology.
- Human-playtest 2–5 player games. Bot simulations are useful for engine failures and heuristic behavior, not human balance or playtime conclusions; see [the simulation report](WILDWAYS_SIMULATION.md).

The design system context is in [`DESIGN.md`](../DESIGN.md), and the game interaction and rules are documented in [`wildways-engine.md`](wildways-engine.md).
