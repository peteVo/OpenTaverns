import { build } from 'esbuild';
const args = process.argv.slice(2);
const game = args.includes('--game') ? args[args.indexOf('--game') + 1] : 'hearthlands';
if (!['hearthlands', 'saigon-grid'].includes(game)) throw Error('Choose hearthlands or saigon-grid.');
const script = `packages/${game}/src/simulate.ts`;
const forwarded = args.filter((arg, i) => arg !== '--game' && args[i - 1] !== '--game');
const built = await build({ entryPoints: [script], bundle: true, platform: 'node', format: 'esm', write: false });
const module = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const games = Number(forwarded[forwarded.indexOf('--games') + 1]) || 100;
const players = Number(forwarded[forwarded.indexOf('--players') + 1]) || (game === 'saigon-grid' ? 4 : 6);
const seed = Number(forwarded[forwarded.indexOf('--seed') + 1]) || 1;
try {
  const results = Array.from({ length: games }, (_, i) => module.simulate(seed + i, players));
  const average = (key) => Math.round(results.reduce((sum, result) => sum + result[key], 0) / games);
  console.log(`${game}: ${games}/${games} complete · average turns ${average('turns')}${game === 'saigon-grid' ? ` · auctions ${average('auctions')} · auction value ${average('auctionValuePercent')}% of reference · trades ${average('trades')} · District completions ${average('districtCompletions')} · Developments ${average('developments')} · insolvencies ${average('bankruptcies')} near turn ${average('averageInsolvencyTurn')} · average active cash ${average('averageCash')} Cr · Usage Fees ${average('usageFeeTotal')} Cr · runtime ${average('durationMs')}ms/game` : ''}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
