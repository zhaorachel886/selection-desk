import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { HistoryStore } from '../src/main/history';
import type { Conversation } from '../src/shared/types';
const directories:string[]=[];const safeRoot=resolve(process.cwd(),'tests','.tmp');mkdirSync(safeRoot,{recursive:true});
function fixture(){const directory=mkdtempSync(join(safeRoot,'selection-history-test-'));directories.push(directory);return {directory,store:new HistoryStore(directory)};}
function record():Conversation{return {id:'c1',selection:{selectionId:'s',text:'Public example',sourceApp:'test',capturedAt:1},action:'ask',targetLanguage:'中文',turns:[{id:'t1',question:'Question',answer:'Partial',state:'running'}],state:'running',updatedAt:1,draft:'draft'};}
afterEach(()=>{for(const path of directories.splice(0)){if(!resolve(path).startsWith(safeRoot+sep))throw Error('Unsafe test cleanup');rmSync(path,{recursive:true,force:true});}});
describe('history storage',()=>{
  it('returns empty for a fresh install, saves no idle selections, restores interrupted work without sending',()=>{
    const {store}=fixture();expect(store.load()).toEqual([]);const c=record();store.save([c,{...c,id:'idle',state:'idle',turns:[]}]);
    expect(store.load()).toEqual([{...c,state:'interrupted',turns:[{...c.turns[0],state:'interrupted'}]}]);expect(c.state).toBe('running');
  });
  it('recovers the prior valid snapshot when the current file is corrupt and reports it',()=>{
    const {store,directory}=fixture();store.save([record()]);store.save([{...record(),draft:'latest'}]);writeFileSync(join(directory,'history.json'),'{broken');
    expect(store.load()[0].draft).toBe('draft');expect(store.warning).toMatch(/备份/);
    store.save([{...record(),draft:'recovered'}]);expect(JSON.parse(readFileSync(join(directory,'history.backup.json'),'utf8')).conversations[0].draft).toBe('draft');
  });
  it('does not turn malformed records into an empty history or leak content in errors',()=>{
    const {store,directory}=fixture();writeFileSync(join(directory,'history.json'),JSON.stringify({version:1,conversations:[{id:'SECRET'}]}));
    expect(()=>store.load()).toThrow(/记录/);expect(()=>store.load()).not.toThrow(/SECRET/);
  });
  it('rejects unsupported versions, duplicate identities and excessive persisted records',()=>{
    const {store,directory}=fixture();for(const payload of [{version:99,conversations:[]},{version:1,conversations:[record(),record()]},{version:1,conversations:Array.from({length:101},(_,i)=>({...record(),id:`c${i}`}))}]){
      writeFileSync(join(directory,'history.json'),JSON.stringify(payload));expect(()=>store.load()).toThrow();
    }
  });
  it('keeps the last successful save if preparing another snapshot fails',()=>{
    const {store,directory}=fixture();store.save([record()]);const malformed={...record(),updatedAt:NaN};expect(()=>store.save([malformed])).toThrow();
    expect(store.load()[0].updatedAt).toBe(1);expect(readdirSync(directory).filter(p=>p.endsWith('.tmp'))).toEqual([]);
  });
});
