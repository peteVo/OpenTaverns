# Hearthlands rules

## World and setup

The board has 19 Regions, 54 Sites, and 72 Links. Four each of Woodlands, Farmland, and Meadows; three each of Highlands and Ironlands; and one Badlands are seeded onto the map. The 18 productive Regions receive two copies each of production marks 1–9. The Rover begins on Badlands. Perimeter Exchanges are seeded: four generic and one specialized for each Material.

Three to six players place a Lodge at an empty Site with no occupied neighboring Site, then a Trail on an adjacent empty Link. Play goes from first seat to last, then returns from last to first. Each player's second Lodge grants one of each adjacent Region's Material, up to the remaining shared supply. No construction costs apply during setup.

## Turns

The current player draws one uniformly random mark from 1–10. Marks 1–9 produce on matching unblocked Regions. Each adjacent Lodge receives one matching Material; each Hall receives two. Shared supply is finite: 24 of each Material for three or four players, 36 for five or six. When a Material runs short, production is paid in deterministic Region and Site order until exhausted.

A 10 wakes the Rover. Every hand above eight Materials discards half its cards, rounded down. After all required discards, the current player moves the Rover to a different Region. The Rover blocks normal production there. The player may choose one adjacent opponent who holds Materials; the server randomly transfers one hidden Material from that hand. The player may also take nothing.

In the main phase, players may build repeatedly while they can pay, exchange with another player, exchange with shared supply, draw Chronicle Cards, play at most one eligible Chronicle Card, and end the turn. A newly drawn card cannot be played until a later turn. Open player offers must be settled or canceled before the current player continues. Accepting an offer transfers both sides' Materials atomically. Supply ratios are 4:1, 3:1 with a generic owned Exchange, or 2:1 for the matching specialized Exchange; the best available ratio applies.

For five or six players, **Wayfare** follows each full round. In seat order, each player may build one Trail, Lodge, or Hall at normal cost, or pass. There is no production draw, exchange, or Chronicle play during Wayfare.

## Construction

| Piece | Cost | Rule | Stock |
| --- | --- | --- | ---: |
| Trail | 1 Timber + 1 Stone | Empty Link connected to your network; a rival occupied Site interrupts extension | 18 |
| Lodge | 1 Timber + 1 Stone + 1 Provisions + 1 Textiles | Empty Site joined to your Trail and not neighboring any occupied Site | 6 |
| Hall | 2 Provisions + 2 Metal | Upgrade your own Lodge; returns that Lodge to stock | 4 |
| Chronicle Card | 1 Provisions + 1 Textiles + 1 Metal | Draw top card from finite seeded deck | — |

## Chronicle Cards

- **Scout:** Move the Rover immediately and increase played Scout count by one. The Rover may take one random Material afterward.
- **Legacy:** Unplayable hidden card worth one Renown while held; revealed after game over.
- **Survey:** Lay one or two connected Trails at no Material cost, still subject to piece stock and placement rules.
- **Harvest:** Take up to two of one chosen Material from shared supply.
- **Levy:** Collect all cards of one chosen Material category from every opponent.

The deck contains 12 Scouts, 5 Legacies, and 3 each of Survey, Harvest, and Levy. Card order is seeded and secret. Players may play one non-Legacy card per turn, and only if bought before that turn.

## Achievements and victory

The **Great Route** is the longest edge-simple connected Trail path. Branches, loops, and all possible traversals are considered exactly. Rival structures stop a traversal at their Site. A route of at least five Links qualifies. The unique leader holds Great Route; a tied current holder keeps it until overtaken, while a new tie without a holder earns nothing.

The **Vanguard** follows played Scouts. At least three are needed; ties follow the same incumbent rule. Both achievements are worth two Renown and can transfer.

Lodges are worth one Renown, Halls two, held Legacies one hidden Renown each, and each achievement two. A player reaching 9 Renown on their own turn wins immediately. The match then rejects further actions and reveals final standings and remaining hidden cards.
