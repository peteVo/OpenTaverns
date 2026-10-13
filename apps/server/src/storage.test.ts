import { afterEach, expect, test } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { TableStore } from './storage';

const root = resolve('.test-data');
mkdirSync(root, { recursive: true });
const directories: string[] = [];
function directory() { const path = mkdtempSync(resolve(root,'storage-')); directories.push(path); return path; }
afterEach(()=>{for(const path of directories.splice(0)) if(path.startsWith(root+sep)) rmSync(path,{recursive:true,force:true});});
test('atomic snapshots preserve secret payloads and deletion across reopening',()=>{
  const path=directory(); const first=new TableStore<{code:string;game:object;seenActions:string[]}>(path);
  const key=first.adminKey; const table={code:'ABC234',game:{privateHand:['WAVE-13'],response:'INTERFERE',rng:[1,2,3]},seenActions:['seat:retry-id']};
  first.save(table); first.close(); const second=new TableStore<typeof table>(path);
  expect(second.load()).toEqual([table]); expect(second.adminKey).toBe(key);
  second.save({...table,seenActions:['second']}); expect(second.load()[0]?.seenActions).toEqual(['second']);
  second.delete(table.code); second.close(); const third=new TableStore<typeof table>(path);expect(third.load()).toEqual([]);third.close();
});
test('storage refuses traversal, a concurrent server and corrupt snapshots',()=>{
  const path=directory(); const store=new TableStore<{code:string}>(path);
  expect(()=>store.save({code:'../bad'})).toThrow();expect(()=>new TableStore(path)).toThrow('Another server');
  writeFileSync(resolve(path,'ABC234.json'),'broken'); expect(()=>store.load()).toThrow();
  writeFileSync(resolve(path,'ABC234.json'),JSON.stringify({version:9,table:{code:'ABC234'}}));expect(()=>store.load()).toThrow('Unsupported');store.close();
});
test('stale process locks are recovered without discarding snapshots',()=>{
  const path=directory();writeFileSync(resolve(path,'server.lock'),'2147483647');const store=new TableStore<{code:string}>(path);store.save({code:'ABC234'});expect(readFileSync(resolve(path,'server.lock'),'utf8')).toBe(String(process.pid));store.close();
});
test('an interrupted replacement leaves the previously saved state intact',()=>{
  const path=directory();const store=new TableStore<{code:string;revision:number}>(path);store.save({code:'ABC234',revision:1});
  mkdirSync(resolve(path,'ABC234.json.tmp'));expect(()=>store.save({code:'ABC234',revision:2})).toThrow();expect(store.load()).toEqual([{code:'ABC234',revision:1}]);store.close();
});
