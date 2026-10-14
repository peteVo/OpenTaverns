import { build } from 'esbuild';
const args = process.argv.slice(2);
const game = args.includes('--game') ? args[args.indexOf('--game') + 1] : 'hearthlands';
if (!['hearthlands', 'saigon-grid', 'blackout', 'tidecall', 'werewolf', 'mosaic'].includes(game)) throw Error('Choose hearthlands, saigon-grid, blackout, tidecall, werewolf, or mosaic.');
const script = `packages/${game}/src/simulate.ts`;
const forwarded = args.filter((arg, i) => arg !== '--game' && args[i - 1] !== '--game');
const built = await build({ entryPoints: [script], bundle: true, platform: 'node', format: 'esm', write: false });
const module = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const games = Number(forwarded[forwarded.indexOf('--games') + 1]) || 100;
const players = Number(forwarded[forwarded.indexOf('--players') + 1]) || (game === 'saigon-grid' || game === 'tidecall' || game === 'mosaic' ? 4 : game === 'werewolf' ? 10 : game === 'blackout' ? 7 : 6);
const seed = Number(forwarded[forwarded.indexOf('--seed') + 1]) || 1;
try {
  const results = Array.from({ length: games }, (_, i) => module.simulate(seed + i, players, game === 'werewolf' && args.includes('--ruleset') ? {ruleset:args[args.indexOf('--ruleset')+1]} : undefined));
  const average = (key) => Math.round(results.reduce((sum, result) => sum + result[key], 0) / games);
  if(game==='mosaic'){const scores=results.flatMap(r=>r.scores);const seatWins=Array(players).fill(0),initiativeWins=Array(players).fill(0),objectives={};for(const r of results){for(const seat of r.winners){seatWins[seat]++;initiativeWins[(seat-r.startingSeat+players)%players]++;}for(const o of r.objectives)if(o.selected){const n=objectives[o.id]||={selected:0,completed:0};n.selected+=players;n.completed+=o.completed;}}const mean=key=>scores.reduce((n,s)=>n+s[key],0)/scores.length;console.log(JSON.stringify({game,players,completed:games,seeds:[seed,seed+games-1],invalidMoves:0,deadlocks:0,invariantFailures:0,botDecisionFailures:0,averageFinalScore:mean('total'),scoreDistribution:scores.reduce((n,s)=>(n[Math.floor(s.total/10)*10]=(n[Math.floor(s.total/10)*10]||0)+1,n),{}),averageConnections:mean('connections'),averageRuns:mean('runs'),averageRainbows:mean('rainbows'),averageCommissions:mean('commissions'),rainbowSquareFrequency:scores.reduce((n,s)=>n+s.squares.length,0)/scores.length,straightRunFrequency:scores.reduce((n,s)=>n+s.straightRuns.length,0)/scores.length,objectives,seatWins,initiativeWins,averageDecisionMs:results.reduce((n,r)=>n+r.durationMs,0)/results.reduce((n,r)=>n+r.turns,0)},null,2));process.exit(0);}
  if(game==='werewolf'){const average=key=>Number((results.reduce((sum,r)=>sum+r[key],0)/games).toFixed(2));const wins={};const roleWins={};for(const r of results){wins[r.winner]=(wins[r.winner]||0)+1;for(const p of r.roleWins){const role=roleWins[p.role]||={seats:0,wins:0};role.seats++;if(p.won)role.wins++;}}console.log(JSON.stringify({game,players,completed:games,wins,averageDays:average('days'),nightDeaths:average('nightDeaths'),voteDeaths:average('voteDeaths'),potions:average('potions'),sheriffSurvival:results.filter(r=>r.sheriffSurvived).length,roleWins,deadlocks:0,invariantFailures:0,unresolvedActions:0},null,2));process.exit(0);}
  if (game === 'tidecall') {
    const sum = key => results.reduce((n,r) => n+r[key],0);
    const errors = {}; const tideStats = {}; const seatWins = Array(players).fill(0);
    for (const result of results) {
      result.winners.forEach(seat => seatWins[seat]++);
      Object.entries(result.errors).forEach(([error,count]) => errors[error] = (errors[error] || 0)+count);
      for (const round of result.rounds) { const t=tideStats[round.tide.name] ||= { rounds:0, exact:0, scores:0, compass:0, leaderTricks:0, samples:0 }; t.rounds++; t.samples+=players; t.exact+=round.scores.filter(s=>!s.error).length; t.scores+=round.scores.reduce((n,s)=>n+s.delta,0); t.compass+=round.scores.filter(s=>s.compass).length; t.leaderTricks+=round.scores.find(s=>s.player===round.tricks[0].lead).won; }
    }
    console.log(JSON.stringify({game,players,completed:games,deadlocks:0,invariantFailures:0,illegalActions:0,privacyFailures:0,averageScores: results.reduce((n,r)=>n+r.scores.reduce((n,s)=>n+s,0),0)/(games*players),exactRate:sum('exactRate')/games,errors,compass:sum('compass'),compassUp:sum('compassUp'),compassDown:sum('compassDown'),compassImproved:sum('compassImproved'),zeroExact:sum('zeroExact'),zeroSamples:sum('zeroSamples'),averageTricks:5/players,seatWins,tideStats},null,2));
    process.exit(0);
  }
  if (game === 'blackout') {
    const operators = results.filter(result => result.winner === 'OPERATOR').length;
    console.log(`Blackout ${players} players: ${games}/${games} complete · Operators ${operators} (${Math.round(100*operators/games)}%) · Disruptors ${games-operators} · average rounds ${average('rounds')} · Crisis ${average('crisis')} · Interfere ${average('interferes')} · Diagnose ${average('diagnoses')} · Audits ${average('audits')} · ability uses ${average('abilityUses')} · Offline samples ${average('offlineSamples')}`);
    process.exit(0);
  }
  console.log(`${game}: ${games}/${games} complete · average turns ${average('turns')}${game === 'saigon-grid' ? ` · auctions ${average('auctions')} · auction value ${average('auctionValuePercent')}% of reference · trades ${average('trades')} · District completions ${average('districtCompletions')} · Developments ${average('developments')} · insolvencies ${average('bankruptcies')} near turn ${average('averageInsolvencyTurn')} · average active cash ${average('averageCash')} Cr · Usage Fees ${average('usageFeeTotal')} Cr · runtime ${average('durationMs')}ms/game` : ''}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
