# Werewolf release validation — 2026-10-13

## Completed gates

| Gate | Result |
| --- | --- |
| Full unit/integration suite | 228 passing tests across all five engines, storage and restart |
| Typecheck / lint / production build | Passed |
| Production Edge browser suite | 21 applicable checks passed; development-only cases skipped |
| Development Edge browser suite | 26 passed initially; two test-harness failures corrected and each passed on focused rerun |
| Werewolf hidden-information browser match | 18 independently authenticated desktop/phone seats plus spectator reached victory and fresh rematch |
| Real Werewolf clock / disconnect / takeover | Padded window did not close early; clock advanced, grace extended, same seat/character became a bot, old credential needed spectator join |
| Production Werewolf security rerun | Forged moderator, actor, role and vote-weight intentions rejected; debug clock route absent |
| Werewolf simulations | 1,100 complete matches across 8–18 seats, Classic and Classic Plus; zero deadlocks, invariant failures or unresolved action failures |
| Cross-game simulation samples | Ten completed matches each for Hearthlands, Saigon Grid, Blackout and Tidecall |
| Visual QA | Three rendered critique/refinement passes, final expanded character fixtures, desktop and phone; crowded widths 320/375/414/768 |

The two corrected harness failures were an existing production-only debug-route expectation used in development, and a Werewolf rejection check resolving on an unrelated state broadcast. The latter now waits specifically for rejection and checks the newer-tab message. The former uses the explicitly selected run mode. Neither correction weakens production access checks.

## Saved visual evidence

- [18-seat desktop village](images/qa/werewolf-village-desktop-final.png)
- [320px village and full-name disclosure](images/qa/werewolf-eighteen-mobile-final.png)
- [Private Seer reveal](images/qa/werewolf-role-mobile-final.png)
- [Private Witch decision](images/qa/werewolf-witch-mobile-final.png)
- [Completed truth layout](images/qa/werewolf-truth-desktop-final.png)
- [Shared phone Rules](images/qa/werewolf-rules-mobile-final.png)

Scenario screenshots are development fixtures, not records of human matches. The automated 18-seat match validates real authenticated transport using per-seat bot intentions and an authorized development clock advance. The separate clock test uses actual elapsed server time.

## Scope and remaining limits

Classic's eight characters and Sheriff are implemented. The supported expansion set is Defender and Village Idiot; other expansion characters are not exposed as unfinished options. Little Girl peeking, election tie defaults, timeout reactions and the poisoned-Hunter interpretation are explicit in the [engine guide](werewolf-engine.md) and Rules.

No 18-person human playtest or exhaustive hardware/screen-reader certification was performed. Larger-count bot matches favor wolves; these heuristics do not reproduce human discussion. Published Classic rules remain intact. This remains a single authoritative server with a private persistent data directory, as documented for the platform.
