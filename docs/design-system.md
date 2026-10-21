# Design system notes

The canonical design reference is [DESIGN.md](../DESIGN.md). It retains the original Fraunces/DM Sans pairing and all six game identities, and now records the shared `--ot-*` platform tokens and task-first home page. Platform tokens are in `apps/web/src/platform.css`; Rules and invitation-copy patterns are in `apps/web/src/rules.css`. Tidecall's game-local tokens remain in root `tokens.css` under `--color-tc-*`, `--font-tc-*`, and related `tc` names.

Treat `DESIGN.md` token frontmatter as the concise shared reference. Game-specific boards and palettes remain owned by their renderer stylesheets. There is no localization framework; English is the current UI language. Diacritic coverage and robustness to longer names are typography/layout concerns, not evidence of localization support.
