# Werewolf role interactions

All roles have separate life state, alignment and optional Lover/Sheriff layers. Every death source removes a seat once. Healing and Defender protection apply to wolf attacks only. Death reveals character in Classic; private knowledge remains private until game over.

| Character | Timing / power | Wolf / poison / Hunter / Lover deaths | Execution | Sheriff / identity interaction |
| --- | --- | --- | --- | --- |
| Simple Villager | Discussion and voting | Dies normally | Dies | May hold office; normal succession |
| Werewolf | Private pack agreement each night | Cannot be targeted by own pack; other sources kill | Dies | Office is independent; a mixed Lover pair has its own objective |
| Seer | Exact character investigation at night | Dies normally; no future discoveries | Dies | Seeing a character does not expose the office holder's other private state |
| Witch | One heal and one poison; may use both or target self | Self heal stops wolf attack, not poison or linked death | Dies | Potions remain secret even when character is revealed |
| Hunter | Mandatory final shot on elimination | Queues shot after all pending deaths, including poison under documented dawn interpretation | Queues shot | Hunter shot precedes that Hunter's succession; new death chains finish before victory |
| Cupid | First-night two-person link | Cupid is otherwise an ordinary Villager; may be a Lover | Dies | Link does not replace character, alignment or office |
| Little Girl | Risky uncertain digital glimpse | Exposure redirects wolf attack; Defender cannot protect her; Witch may heal her | Dies | No exact role or labelled wolf identity from glimpse |
| Thief | First-night optional swap; mandatory between two wolves | Powers and alignment follow new character | Dies | Original/current roles appear only in completed truth; office survives transformation |
| Defender | Self or other protection; no consecutive repeat | Blocks wolf death except Little Girl; other sources unaffected | Dies | Protection is private; timeout skips protection |
| Village Idiot | Public execution pardon | Dies normally; propagates Lover death | Survives, revealed, loses vote permanently; no Lover death | Sheriff office abolished on pardon, without succession |

## Important chains covered by tests

- Wolf and poison target the same seat: one death and one set of reactions.
- Witch heals and poisons self: poison still kills.
- Defender shelters Hunter, Witch poisons Hunter: poison kills and Hunter shoots.
- Seer dies as Hunter's Lover: Hunter reacts before checking whether wolves have won.
- Hunter shoots the last wolf who is Sheriff: successor selection completes before Village victory.
- Sheriff dies alongside intended successor: only still-living seats may be selected.
- Mixed Lovers survive as the last two: Lovers victory has priority over faction conditions.
- Everyone dies in a chain: no winning faction.
- Pardoned Idiot remains alive as a Lover and cannot vote again, even after reconnect.
- Dead wolf reconnects: no live pack intentions or new private night prompt.
- Mandatory Hunter timeout: stable first-living target can cause a new Sheriff/lover chain; it must finish.

`packages/werewolf/src/engine.test.ts` tests authorized/unauthorized prompts, stale windows, limited powers, serialization, replay, inventory and complete seeded matches. The server restart suite restores an ordinary dealt Werewolf table and an active Witch prompt. Browser tests use independent cookie contexts, simultaneous projections, duplicate IDs, fresh-match rejection and production strict schemas.
