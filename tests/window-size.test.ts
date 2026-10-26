import {afterEach,expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {WindowSizeStore,fitWindowSize} from '../src/main/window-size';
const dirs:string[]=[];
afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true})});
function store(){mkdirSync('tests/.tmp',{recursive:true});const dir=mkdtempSync(join(process.cwd(),'tests/.tmp/size-'));dirs.push(dir);return {dir,value:new WindowSizeStore(dir)}}
it('remembers a resized window after reopening the store',()=>{
 const {dir,value}=store();expect(value.load()).toEqual({width:380,height:510});
 value.save({width:640,height:720});expect(new WindowSizeStore(dir).load()).toEqual({width:640,height:720});
});
it('falls back on invalid saved dimensions and does not persist them',()=>{
 const {dir,value}=store();writeFileSync(join(dir,'window-size.json'),JSON.stringify({width:NaN,height:-1}));
 expect(value.load()).toEqual({width:380,height:510});expect(()=>value.save({width:Infinity,height:500})).toThrow();
});
it('keeps minimum controls usable but fits smaller monitor work areas',()=>{
 expect(fitWindowSize({width:100,height:100},{width:1200,height:800})).toEqual({width:320,height:300});
 expect(fitWindowSize({width:1400,height:1000},{width:400,height:500})).toEqual({width:384,height:484});
 expect(fitWindowSize({width:380,height:510},{width:300,height:250})).toEqual({width:284,height:234});
});
