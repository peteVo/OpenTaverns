export const rules = {
    title: 'Hearthlands field notes', summary: 'Build a connected frontier network and reach 9 Renown on your turn.',
    quick: ['Place two Lodges and their Trails in forward, then reverse seat order.', 'Draw a production mark on your turn; nearby Lodges and Halls collect Materials.', 'Build connected Trails, spaced Lodges, and upgraded Halls.', 'Use Exchanges and Chronicle Cards; reach 9 Renown to win.'],
    sections: [
      { id: 'setup', title: 'Opening placement', paragraphs: ['Each player places one Lodge at an empty Site and a Trail on an adjacent Link. The order reverses for the second placement. Lodges cannot sit beside another occupied Site.', 'Your second Lodge grants one Material from each neighboring productive Region, up to the shared supply.'] },
      { id: 'production', title: 'Production and Rover', paragraphs: ['A turn begins with a mark from 1–10. Matching Regions produce one Material per Lodge or two per Hall unless the Rover blocks them.', 'A 10 wakes the Rover. Large hands discard half; the active player relocates the Rover and may take one random Material from a neighboring rival.'] },
      { id: 'build', title: 'Construction and exchange', paragraphs: ['Trails extend your network. Lodges connect to a Trail and must respect spacing. Halls upgrade your own Lodges.', 'Exchange with players or supply. A generic Exchange improves supply trades to 3:1; a matching specialized Exchange makes them 2:1.'] },
      { id: 'chronicles', title: 'Chronicles', paragraphs: ['Scout moves the Rover, Survey lays Trails, Harvest grants Materials, Levy collects a category, and hidden Legacy adds Renown.', 'A card bought this turn cannot be played until a later turn.'] },
      { id: 'victory', title: 'Renown and victory', paragraphs: ['Lodges, Halls, hidden Legacies, Great Route, and Vanguard award Renown. Reach 9 Renown on your own turn to win.', 'At five or six seats, Wayfare gives each player one construction choice after every full round.'] },
      { id: 'reconnect', title: 'Reconnect and privacy', paragraphs: ['Refresh or reopen the invitation to reclaim your seat with its browser session. The latest tab controls it.', 'Your exact Materials and unrevealed Chronicle Cards stay private until the match ends.'] },
    ],
  };
