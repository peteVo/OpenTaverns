import { build } from 'esbuild';
const built = await build({entryPoints:['packages/tidecall/src/simulate.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {simulate} = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const matches = [3,4,5,6].flatMap(n => Array.from({length:20},(_,i) => simulate(700+i,n)));
for (const parameters of [{exact:10,perTrick:2,miss:5},{exact:12,perTrick:3,miss:4},{exact:15,perTrick:2,miss:3}]) {
  const value = s => s.error ? -s.error*parameters.miss : parameters.exact+s.forecast*parameters.perTrick;
  const totals = matches.flatMap(m => Array.from({length:m.players},(_,i)=>m.rounds.reduce((n,r)=>n+value(r.scores[i]),0)));
  const records = matches.flatMap(m=>m.rounds.flatMap(r=>r.scores));
  const average = records => records.reduce((n,s)=>n+value(s),0)/records.length;
  const margins = matches.map(m=>{ const scores=Array.from({length:m.players},(_,i)=>m.rounds.reduce((n,r)=>n+value(r.scores[i]),0)).sort((a,b)=>b-a);return scores[0]-scores[1]; });
  console.log(JSON.stringify({parameters,matches:matches.length,mean:totals.reduce((n,s)=>n+s,0)/totals.length,range:[Math.min(...totals),Math.max(...totals)],meanWinningMargin:margins.reduce((n,s)=>n+s,0)/margins.length,zeroMean:average(records.filter(s=>s.forecast===0)),nonzeroMean:average(records.filter(s=>s.forecast>0)),oneMissCost:parameters.miss,exactZero:parameters.exact,exactThree:parameters.exact+3*parameters.perTrick,compassImproved:matches.reduce((n,m)=>n+m.compassImproved,0),compassUsed:matches.reduce((n,m)=>n+m.compass,0)}));
}
for (const players of [3,4,5,6]) {
  const results = Array.from({length:30},(_,i)=>simulate(900+i,players,0));
  console.log(JSON.stringify({policy:'always zero at seat 0 vs informed forecasts',players,matches:results.length,wins:results.filter(r=>r.winners.includes(0)).length,meanScore:results.reduce((n,r)=>n+r.scores[0],0)/results.length}));
}
