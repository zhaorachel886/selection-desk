import { randomUUID } from 'node:crypto';
import {apiErrorMessage} from '../shared/api-errors';
import type { Action, AnswerProvider, Conversation, GenerateRequest, ProviderEvent, SelectionSnapshot, Turn } from '../shared/types';

const clone = <T>(value:T):T => structuredClone(value);
const publicError = (code?:string) => ({ NOT_LOGGED_IN:'请先登录 Codex', CODEX_NOT_FOUND:'未找到 Codex，请检查设置中的路径', TIMEOUT:'Codex 请求超时，请检查网络或系统代理后重试', CONNECTION_CLOSED:'Codex 连接已中断，请检查网络后重试', PROXY_RESOLVE_FAILED:'无法读取系统代理，请检查网络设置后重试', PROXY_UNSUPPORTED:'当前系统代理类型不受支持，请使用 HTTP 或 HTTPS 代理', EMPTY_RESPONSE:'Codex 没有返回正文，请重试', CONFIG_READ_FAILED:'无法读取 Codex 配置，请检查登录与安装状态', THREAD_START_FAILED:'Codex 未能创建问答，请检查配置后重试', TURN_START_FAILED:'Codex 未能开始回答，请重试', UNSUPPORTED_TOOL:'Codex 请求了工具操作，当前仅支持文本回答' } as Record<string,string>)[code||''] || '回答失败，请检查 Codex 连接后重试';
type Active = { requestId:string; controller:AbortController; turnId:string };
export class TaskManager {
  private items = new Map<string,Conversation>();
  private active = new Map<string,Active>();
  private lastTime = 0;
  private closed = false;
  constructor(private provider:AnswerProvider, initial:Conversation[], private changed:()=>void, private protectedIds:()=>Set<string>) {
    for(const item of initial){this.items.set(item.id,clone(item));this.lastTime=Math.max(this.lastTime,item.updatedAt)}
  }
  list():Conversation[]{return [...this.items.values()].sort((a,b)=>b.updatedAt-a.updatedAt).map(clone)}
  get(id:string):Conversation|undefined { const c=this.items.get(id);return c&&clone(c) }
  create(selection:SelectionSnapshot,action:Action,targetLanguage:'中文'|'英文'):Conversation {
    if(this.closed)throw new Error('应用正在退出');
    const item:Conversation={id:randomUUID(),selection:clone(selection),action,targetLanguage,turns:[],state:'idle',updatedAt:Date.now(),draft:''};
    this.items.set(item.id,item);this.changed();return clone(item);
  }
  draft(id:string,text:string){const c=this.must(id);c.draft=text;this.changed()}
  setLanguage(id:string,language:'中文'|'英文'):Promise<void>{
    if(this.closed)throw new Error('应用正在退出');
    const c=this.must(id);
    if(c.action!=='translate')throw new Error('仅翻译问答可切换目标语言');
    if(c.targetLanguage===language)return Promise.resolve();
    if(this.active.has(id))throw new Error('这条回答正在生成，请先停止或等待完成后切换语言');
    c.targetLanguage=language;
    return this.send(id,'','translate',c.turns.length>0);
  }
  async send(id:string,question:string,action?:Action,retry=false):Promise<void>{
    if(this.closed)throw new Error('应用正在退出');
    const c=this.must(id);
    if(this.active.has(id))throw new Error('这条回答正在生成');
    if(!retry&&!question.trim()&&action!=='translate'&&c.action!=='translate')throw new Error('请输入问题');
    if(retry&&!c.turns.length)throw new Error('没有可重试的回答');
    if(!c.turns.length){
      const records=[...this.items.values()].filter(x=>x.turns.length);
      if(records.length>=100){
        const protectedIds=this.protectedIds();
        const evict=records.filter(x=>x.id!==id&&!protectedIds.has(x.id)&&!this.active.has(x.id)).sort((a,b)=>a.updatedAt-b.updatedAt)[0];
        if(!evict)throw new Error('最近 100 条记录都在使用，请先关闭或结束部分问答');
        this.items.delete(evict.id);
      }
    }
    const effectiveAction=retry?c.action:(action??(c.turns.length?'ask':c.action));
    const current=retry?c.turns[c.turns.length-1]:undefined;
    const prompt=retry?current!.question:question.trim();
    const history=c.turns.slice(0,retry?-1:undefined).flatMap(t=>[
      {role:'user' as const,content:t.question},...(t.answer?[{role:'assistant' as const,content:t.answer}]:[])]);
    const turn:Turn={id:randomUUID(),question:prompt,answer:'',state:'running'};
    if(retry)c.turns[c.turns.length-1]=turn;else c.turns.push(turn);
    c.action=effectiveAction;c.state='running';
    c.updatedAt=this.lastTime=Math.max(Date.now(),this.lastTime+1);
    const requestId=randomUUID(),controller=new AbortController();
    this.active.set(id,{requestId,controller,turnId:turn.id});
    const request:GenerateRequest={conversationId:id,requestId,selection:clone(c.selection),action:effectiveAction,question:prompt,history,targetLanguage:c.targetLanguage};
    this.changed();
    const update=(event:ProviderEvent)=>{
      const running=this.active.get(id);
      if(!running||running.requestId!==event.requestId||event.conversationId!==id||controller.signal.aborted)return;
      const current=this.items.get(id);
      const target=current?.turns.find(t=>t.id===running.turnId);
      if(!current||!target)return;
      if(event.type==='status'&&event.text){target.progress=event.text;this.changed()}
      if(event.type==='delta'&&event.text){delete target.progress;target.answer+=event.text;this.changed()}
      if(event.type==='completed'){delete target.progress;target.state=current.state='done';this.active.delete(id);this.changed()}
      if(event.type==='failed'){delete target.progress;target.state=current.state='error';target.error=apiErrorMessage(event.errorCode)||publicError(event.errorCode);this.active.delete(id);this.changed()}
    };
    try {
      await this.provider.generate(request,controller.signal,update);
      if(this.active.get(id)?.requestId===requestId)update({conversationId:id,requestId,type:'completed'});
    } catch(error) {
      if(this.active.get(id)?.requestId===requestId)update({conversationId:id,requestId,type:'failed',errorCode:error instanceof Error?error.message:'回答失败，可重试'});
    }
  }
  stop(id:string){const c=this.items.get(id),active=this.active.get(id);if(!c||!active)return;
    this.active.delete(id);active.controller.abort();c.state='stopped';const turn=c.turns.find(t=>t.id===active.turnId);if(turn){turn.state='stopped';delete turn.progress}this.changed()}
  remove(id:string){this.stop(id);if(this.items.delete(id))this.changed()}
  clear(){for(const id of [...this.items.keys()])this.remove(id)}
  async dispose(){if(this.closed)return;this.closed=true;
    for(const [id,active] of this.active){active.controller.abort();const c=this.items.get(id);if(c){c.state='interrupted';const t=c.turns.find(x=>x.id===active.turnId);if(t)t.state='interrupted'}}
    this.active.clear();this.changed();await this.provider.dispose()}
  private must(id:string):Conversation{const c=this.items.get(id);if(!c)throw new Error('找不到这条问答');return c}
}
