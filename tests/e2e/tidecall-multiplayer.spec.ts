import { test, expect, type Page } from '@playwright/test';
import { nextBotAction } from '../../packages/tidecall/src/simulate';
import type { Action, View } from '../../packages/tidecall/src/index';
type Room={code:string;matchId:string;self:string|null;host:string;game:View;seats:{id:string;connected:boolean;bot:boolean}[]};
type WireWindow=Window & {tcWire?:WebSocket};
const state=(page:Page,code:string):Promise<Room>=>page.evaluate(async code=>(await(await fetch(`/api/tables/${code}`)).json()),code);
async function wire(page:Page,code:string){await page.evaluate(code=>new Promise<void>((resolve,reject)=>{const target=window as WireWindow;target.tcWire?.close();const ws=new WebSocket(`${location.origin.replace(/^http/,'ws')}/ws?table=${code}`);target.tcWire=ws;ws.onopen=()=>resolve();ws.onerror=()=>reject(Error('Socket failed'));}),code);}
async function raw(page:Page,room:Room,action:Action|object,id=crypto.randomUUID(),revision?:number,matchId=room.matchId){return page.evaluate(({action,id,revision,matchId})=>new Promise<{type:string;error?:string}>(resolve=>{const ws=(window as WireWindow).tcWire!; const listener=(event:MessageEvent)=>{const m=JSON.parse(event.data);if(['STATE','ACTION_ACK','ACTION_REJECTED'].includes(m.type)){ws.removeEventListener('message',listener);resolve(m);}};ws.addEventListener('message',listener);ws.send(JSON.stringify({type:'GAME_ACTION',id,action,expectedRevision:revision,matchId}));}),{action,id,revision,matchId});}

test('six independent seats finish ten rounds with private locks, retries, reconnect and safe rematch',async({browser})=>{
  test.setTimeout(180000);
  const contexts=await Promise.all(Array.from({length:7},()=>browser.newContext({viewport:{width:390,height:844}})));
  try{
    const pages=await Promise.all(contexts.map(c=>c.newPage()));const host=pages[0]!;await host.goto('/');
    await host.getByRole('button',{name:/Choose Tidecall/}).click();await host.getByPlaceholder('What should friends call you?').fill('Captain');await host.getByRole('button',{name:/Create a table/}).click();await expect(host.locator('.tc-lobby')).toBeVisible();const code=host.url().split('/').pop()!;
    await host.screenshot({path:'test-results/tidecall-lobby-mobile.png',fullPage:true});
    for(let i=1;i<7;i++){const page=pages[i]!;await page.goto(`/t/${code}`);await page.getByPlaceholder('What should friends call you?').fill(`Crew ${i}`);if(i===6)await page.getByRole('checkbox',{name:'Watch as spectator'}).check();await page.getByRole('button',{name:/Join table/}).click();await expect(page.locator('.tc-lobby')).toBeVisible();}
    await expect.poll(async()=>(await state(host,code)).seats.filter(s=>s.connected).length).toBe(6);await host.getByRole('button',{name:/Begin Tidecall/}).click();await expect(host.locator('.tc-game-heading')).toBeVisible();
    for(const page of pages)await wire(page,code);
    const spectator=pages[6]!;expect((await state(spectator,code)).game.self).toBeNull();
    let firstLock=false,firstCompass=false,firstCard=false;let steps=0;let room=await state(host,code);
    while(room.game.phase!=='MATCH_OVER'&&steps++<1000){
      const choices=await Promise.all(pages.slice(0,6).map(async(page)=>{const r=await state(page,code);return{page,room:r,action:nextBotAction(r.game,r.self!)};}));const choice=choices.find(c=>c.action);expect(choice).toBeDefined();const {page,action}=choice!;
      if(action!.type==='LOCK_FORECAST'&&!firstLock){
        const id=crypto.randomUUID();const before=await state(page,code);await raw(page,before,action!,id);const after=await state(page,code);expect(after.game.self!.forecast).toBe((action as Extract<Action,{type:'LOCK_FORECAST'}>).value);expect((await raw(page,after,action!,id)).type).toBe('ACTION_ACK');expect((await state(page,code)).game.revision).toBe(after.game.revision);
        const pub=(await state(spectator,code)).game;expect(pub.players.every(p=>p.forecast===null)).toBe(true);expect(pub.balance).toBeNull();expect(pub).not.toHaveProperty('deck');expect(pub).not.toHaveProperty('actionLog');
        await contexts[0]!.setOffline(true);await contexts[0]!.setOffline(false);await host.reload();await expect(host.locator('.tc-game-heading')).toBeVisible();expect((await state(host,code)).game.self!.forecast).toBe(after.game.self!.forecast);await wire(host,code);firstLock=true;
      }else if(action!.type==='LOCK_COMPASS'&&!firstCompass){
        const before=await state(page,code);await raw(page,before,action!);const pub=(await state(spectator,code)).game;expect(pub.players.every(p=>!p.compassUsed)).toBe(true);expect(pub.players.every(p=>!('compassDecision'in p))).toBe(true);await page.reload();await expect(page.locator('.tc-game-heading')).toBeVisible();expect((await state(page,code)).game.self!.compassDecision).not.toBeNull();await wire(page,code);firstCompass=true;
      }else if(action!.type==='PLAY_CARD'&&!firstCard){
        const before=await state(page,code);const id=crypto.randomUUID();expect((await raw(page,before,action!,crypto.randomUUID(),before.game.revision-1)).type).toBe('ACTION_REJECTED');await raw(page,before,action!,id,before.game.revision);const after=await state(page,code);expect(after.game.self!.hand).toHaveLength(before.game.self!.hand.length-1);expect((await raw(page,after,action!,id)).type).toBe('ACTION_ACK');expect((await state(page,code)).game.revision).toBe(after.game.revision);await page.reload();await expect(page.locator('.tc-game-heading')).toBeVisible();expect((await state(page,code)).game.self!.hand).toEqual(after.game.self!.hand);await wire(page,code);firstCard=true;
      }else await raw(page,choice!.room,action!,crypto.randomUUID(),action!.type==='PLAY_CARD'||action!.type==='ADVANCE'?choice!.room.game.revision:undefined);
      room=await state(host,code);
    }
    expect(room.game.phase).toBe('MATCH_OVER');expect(room.game.rounds).toHaveLength(10);expect(room.game.winners.length).toBeGreaterThan(0);expect((await state(spectator,code)).game.self).toBeNull();
    expect((await raw(spectator,room,{type:'LOCK_FORECAST',round:1,value:0})).type).toBe('ACTION_REJECTED');
    expect((await pages[1]!.request.post(`/api/tables/${code}/rematch`,{data:{}})).ok()).toBe(false);
    const oldMatch=room.matchId;expect((await host.request.post(`/api/tables/${code}/rematch`,{data:{}})).ok()).toBe(true);await expect.poll(async()=>(await state(host,code)).game.round).toBe(1);room=await state(host,code);expect(room.matchId).not.toBe(oldMatch);expect(room.game.players.every(p=>p.score===0&&!p.compassUsed)).toBe(true);expect((await raw(host,room,{type:'LOCK_FORECAST',round:1,value:0},crypto.randomUUID(),undefined,oldMatch)).type).toBe('ACTION_REJECTED');
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});

test('Tidecall production refuses debug state and client forged outcomes',async({page})=>{
  test.skip(!!process.env.OPENTAVERNS_E2E_SCENARIOS);
  await page.goto('/');for(const scenario of ['NORMAL_TRICK','MATCH_OVER'])expect((await page.request.post('/api/tables',{data:{gameId:'tidecall',name:'Attacker',scenario}})).ok()).toBe(false);
  const r=await(await page.request.post('/api/tables',{data:{gameId:'tidecall',name:'Host'}})).json();expect((await page.request.get(`/api/debug/tables/${r.code}`)).status()).toBe(404);await wire(page,r.code);await page.request.post(`/api/tables/${r.code}/bots`,{data:{}});await page.request.post(`/api/tables/${r.code}/bots`,{data:{}});await page.request.post(`/api/tables/${r.code}/start`,{data:{}});
  const room=await state(page,r.code);for(const action of [{type:'TIMEOUT'},{type:'SET_SCORE',value:100},{type:'LOCK_FORECAST',round:1,value:0,actor:room.seats[1]!.id}])expect((await raw(page,room,action)).type).toBe('ACTION_REJECTED');
});

test('FAST server timers safely forecast, keep Compass and play a legal card',async({page})=>{
  test.setTimeout(160000);await page.goto('/');const r=await(await page.request.post('/api/tables',{data:{gameId:'tidecall',name:'Idle Captain',pacing:'FAST'}})).json();await wire(page,r.code);await page.request.post(`/api/tables/${r.code}/bots`,{data:{}});await page.request.post(`/api/tables/${r.code}/bots`,{data:{}});expect((await page.request.post(`/api/tables/${r.code}/start`,{data:{}})).ok()).toBe(true);
  await expect.poll(async()=>(await state(page,r.code)).game.phase,{timeout:12000}).toBe('FORECAST_REQUIRED');
  const before=await state(page,r.code);expect(before.game.self!.forecast).toBeNull();
  await expect.poll(async()=>(await state(page,r.code)).game.self!.forecast,{timeout:55000,intervals:[1000]}).not.toBeNull();
  await expect.poll(async()=>(await state(page,r.code)).game.phase,{timeout:10000}).toBe('COMPASS_REQUIRED');
  await expect.poll(async()=>(await state(page,r.code)).game.self!.compassDecision,{timeout:40000,intervals:[1000]}).toBe(0);
  expect((await state(page,r.code)).game.players.find(p=>p.id===before.self)!.compassUsed).toBe(false);
  await expect.poll(async()=>(await state(page,r.code)).game.self!.hand.length,{timeout:45000,intervals:[1000]}).toBeLessThan(before.game.self!.hand.length);
  const after=await state(page,r.code);expect(after.game.completed.flatMap(t=>t.cards).concat(after.game.trick.cards).some(c=>c.player===before.self)).toBe(true);
});

test('Away bot takeover preserves the seat and private hand; latest tab controls once',async({browser})=>{
  const hostContext=await browser.newContext();const awayContext=await browser.newContext();
  try{const host=await hostContext.newPage();const away=await awayContext.newPage();await host.goto('/');await away.goto('/');const r=await(await host.request.post('/api/tables',{data:{gameId:'tidecall',name:'Host'}})).json();await host.goto(`/t/${r.code}`);const joined=await(await away.request.post(`/api/tables/${r.code}/join`,{data:{name:'Away'}})).json();await away.goto(`/t/${r.code}`);await wire(host,r.code);await wire(away,r.code);await host.request.post(`/api/tables/${r.code}/bots`,{data:{}});expect((await host.request.post(`/api/tables/${r.code}/start`,{data:{}})).ok()).toBe(true);await expect.poll(async()=>(await state(host,r.code)).game.phase,{timeout:15000}).toBe('FORECAST_REQUIRED');
    const old=await state(host,r.code);const other=await hostContext.newPage();await other.goto(`/t/${r.code}`);await expect(other.locator('.tc-game-heading')).toBeVisible();expect((await raw(host,old,{type:'LOCK_FORECAST',round:1,value:1})).error).toContain('newer tab');await other.close();await wire(host,r.code);
    const hand=(await state(away,r.code)).game.self!.hand;await awayContext.setOffline(true);await expect.poll(async()=>(await state(host,r.code)).seats.find(s=>s.id===joined.self)!.connected).toBe(false);const response=await host.request.post(`/api/tables/${r.code}/bots`,{data:{replaceSeatId:joined.self}});expect(response.ok()).toBe(true);const after=await state(host,r.code);expect(after.seats.find(s=>s.id===joined.self)!.bot).toBe(true);expect(after.game.players.find(p=>p.id===joined.self)!.handCount).toBe(hand.length);expect(after.game.players.find(p=>p.id===joined.self)!.score).toBe(0);expect(after.game.players.find(p=>p.id===joined.self)!.compassUsed).toBe(false);expect(after.game.self!.hand).toEqual(old.game.self!.hand);expect(after.game.players.every(p=>!('hand'in p))).toBe(true);
  }finally{await hostContext.close();await awayContext.close();}
});
