# Saigon Grid

Saigon Grid is an original 2–6 player economic strategy game on a 28-stop circuit inspired by Ho Chi Minh City streets and transport. The last solvent player wins. A table can include human players, Courier bots, and spectators. A host can replace an Away Saigon Grid seat with a bot without changing its Credits, Holdings, loans, position, or pending obligations.

## Standard rules

Everyone begins with 900 Credits. Two server-controlled dice move the active player. Passing **Central Exchange** earns 100 Credits. Each new turn pays city upkeep to the Treasury: 20 Credits plus 2% of available Credits, rounded down. Extra rolls from doubles do not pay upkeep again. A third consecutive double sends the player to **Municipal Review**.

An unowned Holding can be bought for its reference price or declined. A decline immediately opens an **untimed auction**. Bids must meet the displayed minimum and fit the bidder's Credits. A bidder can withdraw until only the leader remains. If everyone withdraws before a bid, the Holding stays unowned. Bids and trades use revisions; the server checks all mutations again when received. The newest tab controls a seat, while older tabs are read-only mirrors.

Owning every street in a game **District** doubles its base Usage Fee and permits development. Build and sell evenly across a District. Levels 1–3 use Development pieces; level 4 is a Landmark. The Treasury starts with 24 Development pieces and 8 Landmarks. A Landmark conversion returns three Development pieces to supply. Usage Fee multipliers are 1, 2, 4, 7, and 12. The district cost per level is 80, 100, 120, or 140 Credits. Sale refunds half the level cost.

The first and second **Transit Hubs** owned charge 35 and 85 Credits respectively. **Electricity** and **Water** charge dice sum ×5 if their owner controls one Company or ×12 if the owner controls both. A Holding under a **Secured Loan** earns no Usage Fee. Loans advance half its price; repayment costs that amount plus 10%. A District cannot be developed while any of its streets is under loan.

Players can propose, accept, decline, counter, and cancel trades of Credits and undeveloped Holdings. Offers are checked at acceptance and execute atomically. Loans stay attached to a transferred Holding. Auction bids reserve purchasing power: trades cannot be accepted during an auction.

When a player cannot pay, the game enters **Debt Resolution**. The player may sell Developments, take eligible Secured Loans, or trade. The game does not liquidate automatically. **Insolvency** transfers the player's remaining Holdings to a player creditor or returns them to Treasury, removes the seat from turn order, and makes that player a spectator. Municipal Review can be left with a permit, a 50 Credit fee, doubles, or after three failed attempts. City and Civic Events have structured effects, with original text and public history.

When one solvent player remains, the final ledger shows the winner, final Credits and Holdings, completed Districts, turns, auctions, trades, and highest Usage Fee. Players can close and reopen the result to inspect the final city.

## Board names and source check

District labels are game groupings, not municipal boundaries. Street spellings and diacritics were checked against Ho Chi Minh City government sources: [city center streets](https://congbao.hochiminhcity.gov.vn/tin-tuc-tong-hop/Danh-muc-cac-tuyen-duong-cam-do-xe-tren-dia-ban-quan-1--quan-3), [central and inner-city streets](https://csgt-congan.hochiminhcity.gov.vn/wps/portal/Home/trang-chu/noi-dung-chi-tiet/tin-giao-thong/doi3_21042025), [airport corridor](https://congbao.hochiminhcity.gov.vn/tin-tuc-tong-hop/bao-cao-%C4%91e-xuat-chu-truong-%C4%91au-tu-du-an-chieu-sang-trang-tri-cho-truc-duong-truong-son-tran-quoc-hoan-hoang-van-thu-nguyen-van-troi-nam-ky-khoi-nghia-nhanh-vo-van-kiet-ham-chui-cau-khanh-hoi-cot-co-thu-ngu), [eastern streets](https://csgt-congan.hochiminhcity.gov.vn/wps/portal/Home/trang-chu/noi-dung-chi-tiet/tin-giao-thong/d3_02092026_27826), and [both bus stations](https://congbao.hochiminhcity.gov.vn/tin-tuc-tong-hop/Bo-sung-Quyet-dinh-so-74-2011-QD-UBND-cua-UBND-thanh-pho-ve-gia-dich-vu-xe-ra--vao-ben-xe-o-to-tai-Ben-xe-Mien-Dong--).

The four Districts are Central Core, Inner City, Airport Axis, and Eastern Gateway. They are economic sets for this game; they are not official administrative districts.

## Implementation and checks

`packages/saigon-grid` contains the deterministic authoritative engine, projected public view, structured events, bot policy, simulations, and rule tests. The common server owns rooms, sessions, WebSocket transport, reconnect, bot seats, and spectator projection. The game state has `gameVersion: 1` and serializes as JSON, including decks, RNG, debt, auctions, trades, and ownership. The client renders a dedicated city workbench and never decides dice results or validates its own bids as authoritative.

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:e2e`, and `npm run simulate -- --game saigon-grid --games 1000`. Development-only named scenarios can be checked with `npm run test:e2e -- --development tests/e2e/saigon-scenarios.spec.ts`. They remain unavailable from production routes. Rooms are still process-local; a server restart ends a match.

The final four-player simulation batch completed 1,000/1,000 seeded matches without a deadlock or invariant failure. It averaged 291 turns, 12 auctions, 10 accepted trades, 3 completed Districts, 6 Developments, and 3 Insolvencies per match. Additional batches completed 20/20 matches at each of 2, 3, 5, and 6 players. These are bot-policy samples for finding rules failures, not a guarantee that human match pacing or balance will match them.
