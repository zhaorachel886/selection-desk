import { afterEach, expect, it } from 'vitest';
import { createServer, type Server, type RequestListener } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiProvider } from '../src/providers/api';
import { CodexProvider } from '../src/providers/codex';
const servers: Server[] = [];
afterEach(async () => { for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>(r => s.close(() => r())); } });
async function server(handler: RequestListener) { const s=createServer(handler); servers.push(s); await new Promise<void>(r=>s.listen(0,'127.0.0.1',r)); return `http://127.0.0.1:${(s.address() as any).port}/v1`; }
function request(onEvent: any = () => {}) { return { sessionId:'s', selection:{id:'a',text:'selected',program:'test',capturedAt:Date.now()},messages:[{role:'user' as const,content:'translate'}],signal:new AbortController().signal,onEvent }; }
it('rejects insecure remote endpoints before transmitting a secret', async()=>{ const p=new ApiProvider({baseUrl:'http://example.com/v1',model:'m',apiKey:'secret'}); await expect(p.check()).rejects.toThrow(/HTTPS/); });
it('decodes split UTF8 SSE and requires completion',async()=>{ const baseUrl=await server((_q,r)=>{r.writeHead(200,{'content-type':'text/event-stream'});const b=Buffer.from('data: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: [DONE]\n\n');r.write(b.subarray(0,45));setTimeout(()=>r.end(b.subarray(45)),10);});const p=new ApiProvider({baseUrl,model:'m',apiKey:'secret'});let text='';await p.answer(request((e:any)=>{if(e.type==='delta')text+=e.text;}));expect(text).toBe('你好');});
it('fails a truncated stream and redacts server error bodies',async()=>{let count=0;const baseUrl=await server((_q,r)=>{if(count++===0){r.writeHead(200);r.end('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n');}else {r.writeHead(401);r.end('secret user content');}});const p=new ApiProvider({baseUrl,model:'m',apiKey:'secret'});await expect(p.answer(request())).rejects.toThrow(/完成/);await expect(p.answer(request())).rejects.toThrow('HTTP 401');});
it('does not follow redirects and cancels an in-flight stream',async()=>{let redirected=0;const target=await server((_q,r)=>{redirected++;r.end();});const baseUrl=await server((q,r)=>{if(q.url?.endsWith('/models')){r.writeHead(302,{location:target});r.end();}else{r.writeHead(200);r.write(': waiting\n\n');}});const p=new ApiProvider({baseUrl,model:'m',apiKey:'secret'});await expect(p.check()).rejects.toThrow(/连接/);expect(redirected).toBe(0);const controller=new AbortController();const pending=p.answer({...request(),signal:controller.signal});setTimeout(()=>controller.abort(),30);await expect(pending).rejects.toThrow(/停止/);p.dispose();});
it('rejects a command string instead of invoking a shell',async()=>{const p=new CodexProvider({command:'codex & echo unsafe',cwd:process.cwd()});await expect(p.check()).rejects.toThrow();p.dispose();});
it('uses ephemeral read-only Codex threads, streams only agent text and rejects approvals',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'providers-'));const command=join(dir,'fake.cjs');
 writeFileSync(command,`const readline=require('node:readline');const send=x=>process.stdout.write(JSON.stringify(x)+'\\n');readline.createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);if(m.method==='initialize')send({id:m.id,result:{}});if(m.method==='account/read')send({id:m.id,result:{account:{type:'chatgpt'},requiresOpenaiAuth:true}});if(m.method==='config/read')send({id:m.id,result:{config:{mcp_servers:{inherited:{enabled:true}}}}});if(m.method==='thread/start'){if(m.params.config['features.shell_tool']!==false||!m.params.ephemeral||m.params.sandbox!=='read-only'||m.params.approvalPolicy!=='never')process.exit(2);send({id:m.id,result:{thread:{id:'isolated'}}});}if(m.method==='turn/start'){send({id:m.id,result:{turn:{id:'t'}}});send({method:'item/agentMessage/delta',params:{threadId:'isolated',delta:'你好'}});if(m.params.input[0].text.includes('approval'))send({id:99,method:'item/commandExecution/requestApproval',params:{threadId:'isolated'}});else send({method:'turn/completed',params:{threadId:'isolated',turn:{id:'t',status:'completed'}}});}});`);
 const p=new CodexProvider({command,cwd:dir});try{expect(await p.check()).toContain('可用');let text='';await p.answer(request((e:any)=>{if(e.type==='delta')text+=e.text;}));expect(text).toBe('你好');const req=request();req.messages[0].content='approval';await expect(p.answer(req)).rejects.toThrow(/授权/);}finally{p.dispose();await new Promise(r=>setTimeout(r,100));rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
});


it('stops Codex while initialize is pending and reports process exit',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'providers-'));const command=join(dir,'waiting.cjs');
 writeFileSync(command,`process.stdin.resume();setTimeout(()=>{},10000);`);
 const p=new CodexProvider({command,cwd:dir});const controller=new AbortController();const pending=p.answer({...request(),signal:controller.signal});setTimeout(()=>controller.abort(),30);await expect(pending).rejects.toThrow();p.dispose();
 writeFileSync(command,`process.exit(0);`);await expect(p.check()).rejects.toThrow(/断开/);p.dispose();await new Promise(r=>setTimeout(r,100));rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:100});
});
