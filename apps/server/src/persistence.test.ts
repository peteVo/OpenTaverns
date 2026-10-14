import { afterAll, beforeAll, expect, test } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocket } from 'ws';
import { build } from 'esbuild';

const root=resolve('.test-data');mkdirSync(root,{recursive:true});const directory=mkdtempSync(resolve(root,'restart-'));
const base='http://127.0.0.1:3106'; const key='restart-test-only-abcdefghijklmnopqrstuvwxyz0123456789';
let server: ChildProcess;const sockets=new Set<WebSocket>();let output='';
async function start(){output='';server=spawn(process.execPath,[resolve(directory,'server.mjs'),'--port=3106','--development'],{stdio:['ignore','pipe','pipe'],env:{...process.env,OPENTAVERNS_DATA_DIR:directory,OPENTAVERNS_ADMIN_KEY:key}});server.stdout!.on('data',chunk=>{output+=chunk.toString().replace(/#key=[^\s]+/g,'#key=REDACTED');});server.stderr!.on('data',chunk=>{output+=chunk;});for(let i=0;i<150;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(`${base}/health`)).ok)return;}catch{ /* Waiting for startup. */ }await delay(100);}throw Error('Server did not start: '+output);}
async function stop(){for(const ws of sockets)ws.terminate();sockets.clear();if(server?.exitCode===null){const exited=once(server,'exit');server.kill();await exited;}}
async function call(path:string,cookie='',method='GET',data?:object){const response=await fetch(base+path,{method,headers:{cookie,...(data?{'content-type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});return{response,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]||cookie};}
async function wire(code:string,cookie:string){const ws=new WebSocket(`${base.replace('http','ws')}/ws?table=${code}`,{headers:{cookie}});sockets.add(ws);await once(ws,'open');await delay(40);return ws;}
async function action(ws:WebSocket,value:object,matchId:string,id:string=crypto.randomUUID()){const received=new Promise<{type:string;error?:string}>(resolve=>{const listener=(data:Buffer)=>{const message=JSON.parse(data.toString());if(['STATE','ACTION_ACK','ACTION_REJECTED'].includes(message.type)){ws.off('message',listener);resolve(message);}};ws.on('message',listener);});ws.send(JSON.stringify({type:'GAME_ACTION',matchId,id,action:value}));return received;}
beforeAll(async()=>{await build({entryPoints:['apps/server/src/index.ts'],bundle:true,platform:'node',format:'esm',external:['ws','zod','cookie'],outfile:resolve(directory,'server.mjs')});await start();},20000);afterAll(async()=>{await stop();if(directory.startsWith(root+sep))rmSync(directory,{recursive:true,force:true});});

test('all six games, private locks, cookies and retries survive process restart',async()=>{
  const fixtures=[];
  for(const gameId of ['hearthlands','saigon-grid','blackout','tidecall','werewolf','mosaic']){
    const created=await call('/api/tables','','POST',{name:'Host',gameId,seed:42,pacing:'FAST'});expect(created.response.status).toBe(201);const code=created.data.code as string;const cookies=[created.cookie];
    const count=gameId==='mosaic'?2:gameId==='werewolf'?8:gameId==='blackout'?5:3;
    for(let i=1;i<count;i++)cookies.push((await call(`/api/tables/${code}/join`,'','POST',{name:`Player ${i}`})).cookie);
    const connections=[];for(const cookie of cookies)connections.push(await wire(code,cookie));
    expect((await call(`/api/tables/${code}/start`,cookies[0],'POST',{})).response.ok).toBe(true);
    const before=await call(`/api/tables/${code}`,cookies[0]);let retryId:string|undefined;let retryAction:object|undefined;let retryCookie=created.cookie;
    if(gameId==='hearthlands'){expect((await action(connections[0]!,{type:'SETUP_LODGE',site:0},before.data.matchId)).type).toBe('STATE');}
    if(gameId==='werewolf'){await action(connections[0]!,{type:'CONFIRM_ROLE',window:before.data.game.window},before.data.matchId);}
    if(gameId==='blackout'){await action(connections[0]!,{type:'CONFIRM_ROLE'},before.data.matchId);}
    if(gameId==='mosaic'){const g=before.data.game;const index=g.players.findIndex((p:{id:string})=>p.id===g.active);retryCookie=cookies[index]!;const pair=g.market[0];retryAction={type:'DRAFT_AND_PLACE',revision:g.revision,round:g.round,turn:g.turn,offer:pair.id,placements:pair.tiles.map((t:{id:string},i:number)=>({tile:t.id,row:0,col:i}))};retryId=crypto.randomUUID();expect((await action(connections[index]!,retryAction,before.data.matchId,retryId)).type).toBe('STATE');}
    if(gameId==='tidecall'){
      await expect.poll(async()=>(await call(`/api/tables/${code}`,cookies[0])).data.game.phase,{timeout:10000}).toBe('FORECAST_REQUIRED'); retryId=crypto.randomUUID();expect((await action(connections[0]!,{type:'LOCK_FORECAST',round:1,value:2},before.data.matchId,retryId)).type).toBe('STATE');
      expect((await call(`/api/tables/${code}`,cookies[0])).data.game.self.forecast).toBe(2);
    }
    const spectator=(await call(`/api/tables/${code}/join`,'','POST',{name:'Watcher',spectator:true})).cookie;
    fixtures.push({code,cookies,spectator,gameId,retryId,retryAction,retryCookie,matchId:before.data.matchId,game:(await call(`/api/tables/${code}`,cookies[0])).data.game});
  }
  for(const [gameId,scenario] of [['blackout','WAITING_TEST'],['tidecall','COMPASS_LOCKED'],['werewolf','WITCH_SAVE']]){
    const created=await call('/api/tables','','POST',{name:'Private lock',gameId,scenario,seed:42});expect(created.response.ok).toBe(true);
    const spectator=(await call(`/api/tables/${created.data.code}/join`,'','POST',{name:'Watcher',spectator:true})).cookie;
    fixtures.push({code:created.data.code,cookies:[created.cookie],spectator,gameId,retryId:undefined,retryAction:undefined,retryCookie:created.cookie,matchId:created.data.matchId,game:created.data.game});
  }
  await stop();await start();await delay(2200);
  for(const fixture of fixtures){
    const restored=await call(`/api/tables/${fixture.code}`,fixture.cookies[0]);expect(restored.response.ok).toBe(true);expect(restored.data.matchId).toBe(fixture.matchId);
    expect(restored.data.seats.every((s:{connected:boolean;bot:boolean})=>s.connected===s.bot)).toBe(true);
    const expected=structuredClone(fixture.game);for(const p of expected.players)p.connected=restored.data.seats.find((s:{id:string})=>s.id===p.id).bot;
    expect(restored.data.game).toEqual(expected);
    const spectator=await call(`/api/tables/${fixture.code}`,fixture.spectator);expect(spectator.response.ok).toBe(true);expect(spectator.data.self).toBeNull();
    if(fixture.gameId==='blackout'||fixture.gameId==='tidecall'||fixture.gameId==='werewolf'){expect(spectator.data.game.self).toBeNull();expect(restored.data.deadlineAt).toBeNull();}
    if(fixture.retryId){const ws=await wire(fixture.code,fixture.retryCookie);expect((await action(ws,fixture.retryAction||{type:'LOCK_FORECAST',round:1,value:2},fixture.matchId,fixture.retryId)).type).toBe('ACTION_ACK');expect((await call(`/api/tables/${fixture.code}`,fixture.cookies[0])).data.deadlineAt).toBeGreaterThan(Date.now()+25000);}
  }
},40000);

test('only the server host can list and delete; deleted tables stay deleted after restart',async()=>{
  expect((await call('/api/admin/tables')).response.status).toBe(403);
  expect((await call('/api/admin/login','','POST',{key:'wrong'})).response.status).toBe(403);
  const login=await call('/api/admin/login','','POST',{key});expect(login.response.ok).toBe(true);expect(login.response.headers.get('set-cookie')).toContain('HttpOnly');
  const listed=await call('/api/admin/tables',login.cookie);expect(listed.data.tables).toHaveLength(9);
  const text=JSON.stringify(listed.data);for(const forbidden of ['token','faction','forecast','rng','actionLog','hand'])expect(text).not.toContain(`"${forbidden}"`);
  const code=listed.data.tables.find((t:{gameId:string})=>t.gameId==='tidecall').code;
  expect((await call(`/api/admin/tables/${code}`,'','DELETE')).response.status).toBe(403);
  const cross=await fetch(`${base}/api/admin/tables/${code}`,{method:'DELETE',headers:{cookie:login.cookie,origin:'https://another.example'}});expect(cross.status).toBe(403);
  expect((await call(`/api/admin/tables/${code}`,login.cookie,'DELETE')).response.ok).toBe(true);
  await stop();await start();expect((await call('/api/admin/tables',login.cookie)).data.tables).toHaveLength(8);
  expect((await call(`/api/tables/${code}/join`,'','POST',{name:'Late'})).response.ok).toBe(false);
  const saved=JSON.parse(readFileSync(resolve(directory,`${(await call('/api/admin/tables',login.cookie)).data.tables[0].code}.json`),'utf8'));expect(saved.version).toBe(1);
},20000);
