import {afterEach,expect,it,vi} from 'vitest';
import {ApiProvider} from '../src/providers/api';
import type {GenerateRequest,ProviderEvent} from '../src/shared/types';
const providers:ApiProvider[]=[];
afterEach(async()=>{for(const p of providers.splice(0))await p.dispose()});
const request:GenerateRequest={conversationId:'c',requestId:'r',selection:{selectionId:'s',text:'Public example',sourceApp:'test',capturedAt:1},action:'ask',question:'Why?',history:[{role:'user',content:'Earlier?'},{role:'assistant',content:'Earlier answer'}]};
const options={baseUrl:'https://open.bigmodel.cn/api/paas/v4/',model:'glm-4-flash',apiKey:'test-only-placeholder'};
function fixture(body:string,status=200){const fetcher=vi.fn(async()=>new Response(body,{status}));const p=new ApiProvider(options,fetcher);providers.push(p);return {p,fetcher}}
function frame(content:string){return `data: ${JSON.stringify({choices:[{delta:{content}}]})}\r\n\r\n`}
it('posts structured history and renders chunks before the response has finished',async()=>{
 let stream!:ReadableStreamDefaultController<Uint8Array>;const fetcher=vi.fn(async()=>new Response(new ReadableStream({start(c){stream=c}})));
 const p=new ApiProvider(options,fetcher);providers.push(p);const events:ProviderEvent[]=[];
 const pending=p.generate(request,new AbortController().signal,e=>events.push(e));
 await vi.waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(1));
 const bytes=new TextEncoder().encode(frame('公开回答'));
 stream.enqueue(bytes.slice(0,bytes.length-5));stream.enqueue(bytes.slice(bytes.length-5));
 await vi.waitFor(()=>expect(events.filter(e=>e.type==='delta').map(e=>e.text).join('')).toBe('公开回答'));
 const [url,init]=fetcher.mock.calls[0] as unknown as [string,RequestInit];
 expect(url).toBe('https://open.bigmodel.cn/api/paas/v4/chat/completions');
 const sent=JSON.parse(String(init.body));expect(sent.stream).toBe(true);expect(sent.model).toBe('glm-4-flash');
 expect(sent.messages.map((m:any)=>m.content)).toContain('Earlier answer');expect(sent.messages.at(-1).content).toBe('Why?');
 stream.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));stream.close();await pending;
});
it('does not mistake a truncated stream for success',async()=>{
 const {p}=fixture(frame('partial'));
 await expect(p.generate(request,new AbortController().signal,()=>{})).rejects.toThrow('API_STREAM_INTERRUPTED');
});
it.each([[401,'API_AUTH_FAILED'],[429,'API_RATE_LIMIT'],[503,'API_SERVICE_ERROR']])('sanitizes HTTP %i errors',async(status,code)=>{
 const {p}=fixture('private diagnostic and credential',status);await expect(p.generate(request,new AbortController().signal,()=>{})).rejects.toThrow(code);
});
it('rejects an empty completed answer and malformed SSE',async()=>{
 for(const [body,code] of [['data: [DONE]\n\n','EMPTY_RESPONSE'],['data: bad-json\n\n','API_RESPONSE_INVALID']]){
  const {p}=fixture(body);await expect(p.generate(request,new AbortController().signal,()=>{})).rejects.toThrow(code);
 }
});
it('aborts only the requested fetch and forwards cancellation',async()=>{
 const fetcher=vi.fn((_url:string,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(new Error('private aborted diagnostic')),{once:true})}));
 const p=new ApiProvider(options,fetcher);providers.push(p);const a=new AbortController(),b=new AbortController();
 const one=p.generate(request,a.signal,()=>{}).catch(e=>e.message),two=p.generate({...request,requestId:'two'},b.signal,()=>{}).catch(e=>e.message);
 a.abort();expect(await one).toBe('INTERRUPTED');expect(fetcher.mock.calls[1][1]?.signal?.aborted).toBe(false);b.abort();expect(await two).toBe('INTERRUPTED');
});
it('blocks credentials in URLs and unencrypted remote endpoints before making requests',async()=>{
 for(const baseUrl of ['https://user:secret@example.com/v1','http://example.com/v1','https://example.com/v1?key=secret']){
  const fetcher=vi.fn();const p=new ApiProvider({...options,baseUrl},fetcher);providers.push(p);
  await expect(p.generate(request,new AbortController().signal,()=>{})).rejects.toThrow('API_ENDPOINT_INVALID');expect(fetcher).not.toHaveBeenCalled();
 }
});
it('reports an API timeout without exposing the network error',async()=>{
 const fetcher=(_url:string,init?:RequestInit)=>new Promise<Response>((_resolve,reject)=>{init?.signal?.addEventListener('abort',()=>reject(Error('private diagnostic')))});
 const p=new ApiProvider(options,fetcher,{idleMs:10,totalMs:100});providers.push(p);
 await expect(p.generate(request,new AbortController().signal,()=>{})).rejects.toThrow('API_TIMEOUT');
});
