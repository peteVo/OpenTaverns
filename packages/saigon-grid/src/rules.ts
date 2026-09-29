export const rules = {
    title: 'Saigon Grid city guide', summary: 'Travel the circuit, manage Holdings and Credits, and remain the last solvent player.',
    quick: ['Roll two dice and move around 28 city stops.', 'Buy an unclaimed Holding or open an auction.', 'Complete Districts, develop evenly, negotiate, and manage Secured Loans.', 'Resolve debt before declaring Insolvency; the last solvent player wins.'],
    sections: [
      { id: 'turns', title: 'Turns and the circuit', paragraphs: ['Each turn pays 20 Credits plus 2% of available Credits in city upkeep. Passing Central Exchange earns 100 Credits.', 'A third consecutive double sends you to Municipal Review.'] },
      { id: 'holdings', title: 'Holdings and auctions', paragraphs: ['Unclaimed streets, Transit Hubs, and Companies can be purchased at their reference price. Declining a Holding opens an untimed auction.', 'Bids must meet the minimum and fit available Credits. Players can withdraw; the auction ends when only the leader remains.'] },
      { id: 'districts', title: 'Districts and development', paragraphs: ['Owning every street in a District doubles its base Usage Fee and permits even development.', 'Build three Development levels, then convert to a Landmark. Shared pieces are limited; selling returns half the level cost.'] },
      { id: 'exchange', title: 'Hubs, Companies, and trades', paragraphs: ['Transit Hubs collect higher Usage Fees when you own both. Electricity and Water scale with the dice and how many Companies you own.', 'Trade Credits and undeveloped Holdings. Offers are checked again when accepted and settle atomically.'] },
      { id: 'debt', title: 'Loans, debt, and Review', paragraphs: ['A Secured Loan advances half a Holding’s price; repay it with a 10% fee. A loaned Holding collects no Usage Fee.', 'When short of Credits, sell Developments, borrow, or trade. Insolvency is explicit. Municipal Review can be left by doubles, a permit, or a fee.'] },
      { id: 'victory', title: 'Victory and reconnect', paragraphs: ['The last solvent player wins. The final ledger shows the city’s Holdings, Districts, auctions, trades, and Usage Fees.', 'A refresh reclaims your seat. The newest tab controls it; spectators see public Holdings and history.'] },
    ],
  };
