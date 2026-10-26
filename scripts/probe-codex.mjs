import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root=process.cwd(),directory=join(root,'.runtime','codex-probe');
await mkdir(directory,{recursive:true});
await build({entryPoints:[join(root,'src','providers','codex.ts')],outfile:join(directory,'provider.mjs'),bundle:true,platform:'node',format:'esm'});
const {CodexProvider}=await import(pathToFileURL(join(directory,'provider.mjs')).href);
const provider=new CodexProvider('',directory);
const status=await provider.check();
console.log('Connection:',status);
if(!status.connected)process.exitCode=1;
else{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),120000);
  let answer='';
  try{
    const request={conversationId:'public-probe',requestId:'public-probe-turn',selection:{selectionId:'public',text:'Hello, world.',sourceApp:'probe',capturedAt:Date.now()},action:'translate',question:'',history:[],targetLanguage:'中文'};
    await provider.generate(request,controller.signal,event=>{if(event.type==='delta')answer+=event.text||''});
    console.log('Translation:',answer);
    if(!answer.trim())process.exitCode=1;
  }catch(error){console.error('Generation:',error instanceof Error?error.message:'failed');process.exitCode=1}
  finally{clearTimeout(timer)}
}
await provider.dispose();
