import type {AnswerProvider,GenerateRequest,ProviderEvent} from '../shared/types';
import {taskInstruction} from './instructions';
export interface ApiOptions{baseUrl:string;model:string;apiKey:string}
export type ApiFetch=(url:string,init?:RequestInit)=>Promise<Response>;
const fail=(code:string)=>new Error(code);
export function apiEndpoint(baseUrl:string):string{
  try{
    const url=new URL(baseUrl.trim());
    if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol))throw 0;
    if(url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw 0;
    return url.toString().replace(/\/+$/,'').replace(/\/chat\/completions$/,'')+'/chat/completions';
  }catch{throw fail('API_ENDPOINT_INVALID')}
}
export function apiMessages(r:GenerateRequest){
  return [{role:'system',content:taskInstruction(r)},
    {role:'user',content:`以下是选区资料：\n${JSON.stringify({selection:r.selection.text})}`},
    ...r.history.filter(m=>m.content.trim()).map(m=>({role:m.role,content:m.content})),
    ...(r.question.trim()?[{role:'user',content:r.question}]:[])];
}
export class ApiProvider implements AnswerProvider{
  private active=new Set<AbortController>();
  constructor(private options:ApiOptions,private fetcher:ApiFetch=fetch,private limits={idleMs:45000,totalMs:120000}){}
  async check(){return {connected:false,reason:'请使用公开文本测试回答'}}
  async generate(request:GenerateRequest,signal:AbortSignal,emit:(event:ProviderEvent)=>void):Promise<void>{
    if(signal.aborted)throw fail('INTERRUPTED');
    const url=apiEndpoint(this.options.baseUrl);
    if(!this.options.apiKey.trim())throw fail('API_KEY_MISSING');
    if(!this.options.model.trim())throw fail('API_MODEL_MISSING');
    const controller=new AbortController();this.active.add(controller);let timedOut=false,idle:ReturnType<typeof setTimeout>;
    const expire=()=>{timedOut=true;controller.abort()},touch=()=>{clearTimeout(idle);idle=setTimeout(expire,this.limits.idleMs)};
    const abort=()=>controller.abort();signal.addEventListener('abort',abort,{once:true});
    const total=setTimeout(expire,this.limits.totalMs);touch();let reader:ReadableStreamDefaultReader<Uint8Array>|undefined;
    let answer='',complete=false;
    const frame=(raw:string)=>{
      const data=raw.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if(!data.trim())return;
      if(data.trim()==='[DONE]'){complete=true;return}
      let parsed:any;try{parsed=JSON.parse(data)}catch{throw fail('API_RESPONSE_INVALID')}
      if(parsed.error)throw fail('API_SERVICE_ERROR');
      const choice=parsed.choices?.[0];if(!choice)return;
      if(choice.delta?.tool_calls?.length)throw fail('UNSUPPORTED_TOOL');
      const text=choice.delta?.content;
      if(typeof text==='string'&&text){answer+=text;if(answer.length>2_000_000)throw fail('API_RESPONSE_INVALID');emit({conversationId:request.conversationId,requestId:request.requestId,type:'delta',text})}
      if(choice.finish_reason==='length')throw fail('API_OUTPUT_LIMIT');
      if(choice.finish_reason==='content_filter')throw fail('API_CONTENT_FILTER');
      if(choice.finish_reason==='stop')complete=true;
    };
    try{
      emit({conversationId:request.conversationId,requestId:request.requestId,type:'status',text:'正在等待模型回答…'});
      const response=await this.fetcher(url,{method:'POST',redirect:'error',credentials:'omit',signal:controller.signal,
        headers:{Authorization:`Bearer ${this.options.apiKey.trim()}`,'Content-Type':'application/json',Accept:'text/event-stream'},
        body:JSON.stringify({model:this.options.model.trim(),stream:true,messages:apiMessages(request)})});
      if(!response.ok){await response.body?.cancel().catch(()=>{});throw fail(response.status===401||response.status===403?'API_AUTH_FAILED':response.status===429?'API_RATE_LIMIT':response.status===400||response.status===404?'API_MODEL_OR_ENDPOINT':'API_SERVICE_ERROR')}
      if(!response.body)throw fail('API_RESPONSE_INVALID');
      reader=response.body.getReader();const decoder=new TextDecoder();let buffer='';
      while(!complete){const chunk=await reader.read();touch();buffer+=decoder.decode(chunk.value,{stream:!chunk.done});
        if(buffer.length>2_000_000)throw fail('API_RESPONSE_INVALID');
        let split:RegExpExecArray|null;
        while(!complete&&(split=/\r?\n\r?\n/.exec(buffer))){frame(buffer.slice(0,split.index));buffer=buffer.slice(split.index+split[0].length)}
        if(chunk.done){if(buffer.trim()&&!complete)frame(buffer);break}
      }
      if(!complete)throw fail('API_STREAM_INTERRUPTED');
      if(!answer.trim())throw fail('EMPTY_RESPONSE');
    }catch(error){
      if(controller.signal.aborted)throw fail(timedOut?'API_TIMEOUT':'INTERRUPTED');
      if(error instanceof Error&&/^(API_|EMPTY_RESPONSE|UNSUPPORTED_TOOL)/.test(error.message))throw error;
      throw fail('API_NETWORK_ERROR');
    }finally{clearTimeout(idle!);clearTimeout(total);signal.removeEventListener('abort',abort);if(reader)await reader.cancel().catch(()=>{});this.active.delete(controller)}
  }
  async dispose(){for(const controller of this.active)controller.abort();this.active.clear()}
}
