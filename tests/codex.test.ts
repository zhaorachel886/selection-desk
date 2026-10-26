import { afterEach, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, sep } from 'node:path';
import { CodexProvider, resolveCodex } from '../src/providers/codex';
import type { GenerateRequest, ProviderEvent } from '../src/shared/types';

const providers:CodexProvider[]=[],directories:string[]=[];
vi.mock('node:child_process',async importOriginal=>{const actual=await importOriginal<typeof import('node:child_process')>();return {...actual,execFileSync:vi.fn(actual.execFileSync)};});
afterEach(async()=>{await Promise.all(providers.splice(0).map(p=>p.dispose()));vi.unstubAllEnvs();vi.mocked(execFileSync).mockReset();await new Promise(r=>setTimeout(r,150));for(const dir of directories.splice(0)){if(!resolve(dir).startsWith(resolve('tests/.tmp')+sep))throw Error('Unexpected fixture directory');rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}});
function fakeCodex(expectedProxy:string|null,mode='answer'){
  mkdirSync('tests/.tmp',{recursive:true});const dir=mkdtempSync(join(process.cwd(),'tests/.tmp/codex-'));directories.push(dir);
  const command=join(dir,'fake.cjs');
  writeFileSync(command,`const rl=require('node:readline');const send=m=>process.stdout.write(JSON.stringify(m)+String.fromCharCode(10));
rl.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize'){if((process.env.HTTPS_PROXY||null)!==${JSON.stringify(expectedProxy)})send({id:m.id,error:{code:-32603,message:'proxy not inherited'}});else send({id:m.id,result:{}});}
if(m.method==='account/read')send({id:m.id,result:{account:{type:'chatgpt'},requiresOpenaiAuth:true}});
if(m.method==='config/read')send({id:m.id,result:{config:{}}});
if(m.method==='thread/start')send({id:m.id,result:{thread:{id:'thread'}}});
if(m.method==='turn/start'){if(${JSON.stringify(mode)}==='translation-low'&&m.params.effort!=='low'||${JSON.stringify(mode)}==='inherited-effort'&&Object.hasOwn(m.params,'effort')){send({id:m.id,error:{code:-32602,message:'incorrect effort'}});return;}send({id:m.id,result:{turn:{id:'turn'}}});send({method:'turn/started',params:{threadId:'thread',turn:{id:'turn'}}});
if(${JSON.stringify(mode)}==='retry')send({method:'error',params:{threadId:'thread',willRetry:true,error:{message:'Reconnecting... 1/5',additionalDetails:'private transport diagnostic',codexErrorInfo:{responseStreamDisconnected:{httpStatusCode:null}}}}});
if(${JSON.stringify(mode)}!=='empty')send({method:'item/agentMessage/delta',params:{threadId:'thread',itemId:'answer',delta:'测试回答'}});
send({method:'turn/completed',params:{threadId:'thread',turn:{id:'turn',status:'completed'}}});}});`);
  return {dir,command};
}
function clearProxy(){for(const key of ['HTTPS_PROXY','https_proxy','HTTP_PROXY','http_proxy','ALL_PROXY','all_proxy'])vi.stubEnv(key,'');}
function request():GenerateRequest{return {conversationId:'public',requestId:'turn',selection:{selectionId:'public',text:'Public test',sourceApp:'test',capturedAt:1},action:'ask',question:'Explain',history:[]};}
it('passes the Windows resolved proxy to the actual Codex child process',async()=>{
  clearProxy();const f=fakeCodex('http://127.0.0.1:7897');const resolve=vi.fn(async()=> 'PROXY 127.0.0.1:7897; DIRECT');
  const p=new CodexProvider(f.command,f.dir,resolve);providers.push(p);
  expect(await p.check()).toEqual({connected:true});expect(resolve).toHaveBeenCalledTimes(1);
});
it('preserves explicit proxy environment instead of overriding it with system settings',async()=>{
  clearProxy();vi.stubEnv('HTTPS_PROXY','http://127.0.0.1:8080');const f=fakeCodex('http://127.0.0.1:8080');
  const resolve=vi.fn(async()=> 'PROXY 127.0.0.1:7897');const p=new CodexProvider(f.command,f.dir,resolve);providers.push(p);
  expect(await p.check()).toEqual({connected:true});expect(resolve).not.toHaveBeenCalled();
});
it('keeps direct access when Windows returns DIRECT',async()=>{
  clearProxy();const f=fakeCodex(null);const p=new CodexProvider(f.command,f.dir,async()=> 'DIRECT');providers.push(p);
  expect(await p.check()).toEqual({connected:true});
});
it('reports reconnecting without exposing the service diagnostic as user text',async()=>{
  clearProxy();const f=fakeCodex(null,'retry');const p=new CodexProvider(f.command,f.dir);providers.push(p);const events:ProviderEvent[]=[];
  await p.generate(request(),new AbortController().signal,e=>events.push(e));
  expect(events.some(e=>e.type==='status'&&e.text?.includes('重连'))).toBe(true);
  expect(JSON.stringify(events)).not.toContain('private transport diagnostic');
  expect(events.filter(e=>e.type==='delta').map(e=>e.text).join('')).toBe('测试回答');
});
it('rejects a completed turn with no answer instead of showing blank success',async()=>{
  clearProxy();const f=fakeCodex(null,'empty');const p=new CodexProvider(f.command,f.dir);providers.push(p);
  await expect(p.generate(request(),new AbortController().signal,()=>{})).rejects.toThrow('EMPTY_RESPONSE');
});
it('uses low reasoning for translation without changing the inherited effort for questions',async()=>{
  clearProxy();const translation=fakeCodex(null,'translation-low'),question=fakeCodex(null,'inherited-effort');
  const p=new CodexProvider(translation.command,translation.dir),q=new CodexProvider(question.command,question.dir);providers.push(p,q);
  await p.generate({...request(),action:'translate'},new AbortController().signal,()=>{});
  await q.generate(request(),new AbortController().signal,()=>{});
});
it.skipIf(process.platform!=='win32')('respects PATH order instead of replacing the installed CLI with a later desktop binary',()=>{
  const f=fakeCodex(null);const npmLauncher=join(f.dir,'codex.cmd'),npmJs=join(f.dir,'node_modules/@openai/codex/bin/codex.js'),desktopBinary=join(f.dir,'desktop-codex.exe');
  mkdirSync(join(f.dir,'node_modules/@openai/codex/bin'),{recursive:true});for(const file of [npmLauncher,npmJs,desktopBinary])writeFileSync(file,'');
  vi.mocked(execFileSync).mockReturnValue([join(f.dir,'codex'),npmLauncher,desktopBinary].join(String.fromCharCode(10)));
  expect(resolveCodex('')).toEqual({file:process.execPath,args:[npmJs,'app-server']});
  expect(resolveCodex(desktopBinary)).toEqual({file:desktopBinary,args:['app-server']});
});
it.skipIf(process.platform!=='win32').each(['optional-package','legacy-vendor'])('launches the npm native binary directly to avoid the unhidden grandchild (%s)',layout=>{
  const f=fakeCodex(null),packageRoot=join(f.dir,'node_modules/@openai/codex');
  const entry=join(packageRoot,'bin/codex.js');
  const platformRoot=join(f.dir,`node_modules/@openai/codex-win32-${process.arch}`);
  const vendorRoot=layout==='optional-package'?join(platformRoot,'vendor'):join(packageRoot,'vendor');
  const binary=join(vendorRoot,`${process.arch==='arm64'?'aarch64':'x86_64'}-pc-windows-msvc/bin/codex.exe`);
  mkdirSync(join(packageRoot,'bin'),{recursive:true});mkdirSync(join(binary,'..'),{recursive:true});
  writeFileSync(join(packageRoot,'package.json'),JSON.stringify({name:'@openai/codex'}));writeFileSync(entry,'');writeFileSync(binary,'');
  if(layout==='optional-package')writeFileSync(join(platformRoot,'package.json'),'{}');
  expect(resolveCodex(entry)).toEqual({file:binary,args:['app-server']});
  expect(resolveCodex(join(f.dir,'codex.cmd'))).toEqual({file:binary,args:['app-server']});
});
