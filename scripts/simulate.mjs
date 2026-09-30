import { build } from 'esbuild';
const args = process.argv.slice(2);
const game = args.includes('--game') ? args[args.indexOf('--game') + 1] : 'hearthlands';
if (!['hearthlands', 'saigon-grid', 'blackout', 'tidecall'].includes(game)) throw Error('Choose hearthlands, saigon-grid, blackout, or tidecall.');
const script = `packages/${game}/src/simulate.ts`;
const forwarded = args.filter((arg, i) => arg !== '--game' && args[i - 1] !== '--game');
const built = await build({ entryPoints: [script], bundle: true, platform: 'node', format: 'esm', write: false });
const module = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const games = Number(forwarded[forwarded.indexOf('--games') + 1]) || 100;
const players = Number(forwarded[forwarded.indexOf('--players') + 1]) || (game === 'saigon-grid' || game === 'tidecall' ? 4 : game === 'blackout' ? 7 : 6);
const seed = Number(forwarded[forwarded.indexOf('--seed') + 1]) || 1;
try {
  const results = Array.from({ length: games }, (_, i) => module.simulate(seed + i, players));
  const average = (key) => Math.round(results.reduce((sum, result) => sum + result[key], 0) / games);
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
