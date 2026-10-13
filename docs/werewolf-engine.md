# Werewolf engine

Werewolf is OpenTaverns' fifth module, for 8–18 seats. It follows **The Werewolves of Miller's Hollow** Classic rules rather than inventing a new Werewolf variant. All prose, SVG illustrations and interface art in this repository are original.

## Sources and supported rules

The baseline is Zygomatic's [English Classic rules, ©2023](https://cdn.svc.asmodee.net/production-zygomatic/uploads/2025/03/LMELG01EN_RULES-2023_WEB.pdf), linked by the [publisher](https://www.zygomatic-games.com/game/the-werewolves-of-millers-hollow/). Classic implements Simple Villager, Werewolf, Seer, Witch, Hunter, Cupid, Little Girl and Thief, plus the public Sheriff office. Basic follows the count chart: two wolves at 8–11, three at 12–17, four at 18, one Seer and remaining Simple Villagers. Powers includes the Classic special characters; Thief makes the dealt composition uncertain.

Classic Plus adds only **Defender and Village Idiot**, verified against the [English New Moon rules, ©2019](https://cdn.svc.asmodee.net/production-asmodeeca/uploads/2023/07/WerewolvesNewMoon_EN_Rules.pdf). At eight seats, its Powers composition exchanges Thief and Little Girl for these two characters. Other New Moon and Characters expansion roles are not implemented. Custom permits the ten supported characters and clearly labels death-role concealment as a variant. Setup checks count, card inventory, unique special characters, wolf count and timing limits. Power guidance is qualitative, not a claim of measured human balance.

## Layered identity and phases

Each stable seat has a current character, original character, alignment, life state, Lover link, private knowledge and power usage. Sheriff is a separate office. Thief swaps its character with a private spare; alignment and available powers change accordingly. The enlarged shuffled pool contains two extra Simple Villager cards; either spare may be any character. Two wolf spares force a swap.

The state machine is role reveal → Sheriff election → night → death resolution → dawn → discussion → simultaneous vote → vote result → next night. Tied executions enter a Sheriff decision where an eligible Sheriff exists. Death resolution may reenter itself as reactions cause further deaths. There is no single active player abstraction imposed on simultaneous votes or pack intentions.

Night always contains seven equal, padded windows: Thief, Cupid, Lovers, Defender, Seer, Werewolves, Witch. Empty or first-night-only windows remain padded on later nights. Their identities and private window numbers are absent from public snapshots. They never finish early because all secret actors submitted. The public revision stays fixed within night; public narration never lists pending roles. Settings disclose the schedule and duration, so someone familiar with the rules can infer the scheduled window from elapsed time, but not whether its character is present or has acted.

## Decisions and resolution

- Seer learns another living seat's exact character privately at the window boundary.
- Wolves see their living pack and its intentions. Intentions can change until lock. A unanimous victim is selected at timeout, including an unlocked last intention; disagreement or a missing intention gives no victim. Wolves cannot eat pack members.
- Witch sees the selected wolf victim and submits one immutable combined heal/poison decision. Each potion is single-use; both can be spent together, including on self. Healing cancels only the wolf attack.
- Cupid chooses two different Lovers, possibly self. Lovers learn partner identity, not character. They retain their powers and cannot vote to execute their partner.
- Defender may protect self, cannot repeat a target on consecutive nights, and blocks only wolf attacks. Little Girl cannot be shielded by Defender. Skipping a night clears consecutive protection.
- Village Idiot is pardoned on village execution, publicly revealed and permanently loses voting rights. No Lover dies from the pardon. If the Idiot held the Sheriff office it is abolished; other death causes still kill.
- Public votes remain private until all eligible votes arrive or timeout. Sheriff weighs two on execution votes and decides an execution tie, without targeting a Lover. Without a deciding choice, a tie eliminates nobody.

## Explicit digital decisions

Physical Little Girl peeking is replaced by an optional uncertain clue of up to three identities containing a wolf, without identifying which one. A seeded one-in-three exposure chance redirects the wolf victim to her. This is an adaptation, not an exact reproduction of physical peeking; late-game clues may shrink.

Hunter's final shot is mandatory on elimination. The Classic dawn paragraph's eliminated-Hunter reaction is applied to poison as well as wolf, execution and Lover deaths. The role's shorter description specifically enumerates the latter three: this poison behavior is an explicit edition interpretation. A missing Hunter decision fires at the first living seat in stable seat order after the response/grace period. This disclosed deterministic fallback prevents disconnects from deleting a mandatory reaction. Sheriff timeout similarly selects the first living successor. Cupid timeout links the first two living seats; forced Thief timeout takes the first spare. Seer does nothing, Witch spends nothing, Defender protects nobody and Little Girl stays asleep on timeout.

The physical rules do not specify a Sheriff election tie procedure. Online elections use one runoff; a repeated tie falls back to the first tied seat in stable order. An entirely abstaining election appoints the first living seat. Discussion is unlimited by default; the living discussion chair or unanimous readiness proceeds to voting. Nobody receives secret moderator powers.

## Death queue and victory

Wolf and poison deaths enter one deterministic queue. Each death is recorded once, propagates Lover death, queues a Hunter shot if necessary and vacates a dying Sheriff's office. All pending deaths drain before reactions; reactions can create more deaths. The complete queue and reaction list must be empty before victory.

There is **no parity victory**. Village wins by eliminating every wolf; wolves win by eliminating every Villager. Dead faction members share their side's victory, except mixed-team Lovers who have their own objective. A mixed pair wins only alive together as the last two seats. An empty village yields No Winner. All gameplay actions are rejected after completion.

## Privacy and transport

`project(game, viewerId)` is the only client state boundary. Spectators receive no `self`. Live public state omits current hidden characters, alignment, spares, RNG, responses, ballots, pack intentions, death causes and action history. Character reveals on death do not reveal knowledge or potions. A player gets only their own character, powers, Lover identity, accumulated knowledge and authorized prompt; living wolves additionally receive living pack information. Dead players get no new night prompt or pack information, except their own queued final reaction. They may still read their own historical knowledge.

Client actions carry `matchId` and the private/public prompt `window`. Strict server schemas reject actor injection, forced roles, outcomes, clocks and moderator TIMEOUT. Session cookies choose actors; the latest connected tab controls a seat. UUID retries are acknowledged once and retained on disk. Prompt identity rejects delayed choices without rejecting independent simultaneous arrivals through a global revision race.

Snapshots serialize RNG, spares, powers, pending reactions, intentions and votes. Atomic platform saves happen before broadcasts. Restarts retain seat cookies and private state, mark humans Away and pause clocks until seated reconnect. Disconnect grace extends a deadline once. Bot takeover keeps the seat, character, faction, relationships, office and knowledge. Rematch keeps the Table and seats but creates a fresh production seed and match identifier, clears previous secrets and deals again.

## Bots, replay and QA

Bots receive only their own projection. They coordinate as an entitled pack, investigate unknown seats, preserve a Lover, use limited potions and vote from available evidence. They are deterministic QA heuristics, not substitutes for human discussion. Full post-game truth contains original/current characters, transformations, deaths, decisions and revealed ballots with day/phase metadata. `replayGame` reconstructs validated actions from the initial seed and settings. Live spectators never receive this log.

Run `npm run simulate -- --game werewolf --games 1000 --players 12`; add `--ruleset CLASSIC_PLUS` for the supported additions. Simulation checks role-card inventories, layered alignment, seat order, relationships, life/death inventory, reactions, terminal queues and spectator redaction after every action. Errors report seed, day, phase, step and action number. [Recorded simulation results](werewolf-simulation.json) cover both rulesets and every supported player count. Bot win rates are diagnostic, not human balance estimates.

Development fixtures cover all private characters and major public/death/end states. The loopback-only development clock advance route additionally requires the server management key and same origin. It is absent in production. The 18-seat browser test uses this clock facility to advance padded windows; gameplay decisions still travel through independently authenticated seats. Production schema tests separately reject debugging and forged moderator actions.

See [role interactions](werewolf-role-interactions.md) and [visual QA](werewolf-visual-audit.md).

### Balance reading

The recorded run alternates Basic and Powers over 50 seeds for each ruleset/player-count cell (1,100 matches total). Classic wolf wins range from 40% at 11 seats to 78% at 18; Plus reaches 80% at 18. This flags a strong pack advantage in the current bot matchup at the largest count. Pack bots coordinate perfectly from entitled information while Village bots cannot share deductions or conduct human discussion. These are not human win-rate estimates, and Classic composition/rules have not been changed to force bot parity. Average days range from 3.0 (8-seat Classic) to 8.14 (18-seat Plus); every match terminates. Custom setup guidance warns about strong information powers and uncertain Thief composition. Human balance feedback remains a release limitation.
