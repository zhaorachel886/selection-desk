import { describe, expect, it } from 'vitest';
import { TaskManager } from '../src/main/tasks';
import type { AnswerProvider, Conversation, GenerateRequest, ProviderEvent, SelectionSnapshot } from '../src/shared/types';

const selection: SelectionSnapshot = { selectionId: 's', text: 'Public example', sourceApp: 'test', capturedAt: 1 };
class ControlledProvider implements AnswerProvider {
  calls: Array<{ request: GenerateRequest; signal: AbortSignal; emit:(event:ProviderEvent)=>void; resolve:()=>void; reject:(e:Error)=>void }> = [];
  async check() { return { connected:true }; }
  generate(request:GenerateRequest, signal:AbortSignal, emit:(event:ProviderEvent)=>void):Promise<void> {
    return new Promise((resolve,reject)=>this.calls.push({request,signal,emit,resolve,reject}));
  }
  event(index:number,type:ProviderEvent['type'],text?:string) {
    const call=this.calls[index]; call.emit({conversationId:call.request.conversationId,requestId:call.request.requestId,type,text});
  }
  async dispose() { for(const call of this.calls) call.resolve(); }
}
function fixture(initial:Conversation[]=[], visible=new Set<string>()) {
  const provider=new ControlledProvider();
  const manager=new TaskManager(provider,initial,()=>{},()=>visible);
  return {provider,manager};
}
function record(index:number):Conversation {
  return {id:`c${index}`,selection,action:'ask',targetLanguage:'中文',turns:[{id:`t${index}`,question:'Question',answer:'Answer',state:'done'}],state:'done',updatedAt:index,draft:''};
}

describe('independent conversation tasks',()=>{
  it('retranslates in the same record with the new language and ignores old output',async()=>{
    const {manager,provider}=fixture();const c=manager.create(selection,'translate','中文');
    const first=manager.send(c.id,'','translate');provider.event(0,'delta','旧译文');provider.calls[0].resolve();await first;
    manager.draft(c.id,'保留追问草稿');const previousTime=manager.get(c.id)!.updatedAt;
    const background=manager.create(selection,'ask','中文');const pendingBackground=manager.send(background.id,'后台问题');
    const switched=manager.setLanguage(c.id,'英文');
    expect(provider.calls).toHaveLength(3);
    expect(provider.calls[2].request).toMatchObject({conversationId:c.id,action:'translate',targetLanguage:'英文',question:'',history:[]});
    expect(provider.calls[2].request.requestId).not.toBe(provider.calls[0].request.requestId);
    expect(manager.get(c.id)).toMatchObject({state:'running',targetLanguage:'英文',draft:'保留追问草稿',turns:[{answer:''}]});
    expect(manager.get(c.id)!.updatedAt).toBeGreaterThan(previousTime);
    expect(provider.calls[1].signal.aborted).toBe(false);
    provider.event(0,'delta','迟到旧内容');provider.event(0,'completed');
    expect(manager.get(c.id)?.state).toBe('running');
    provider.event(2,'delta','New translation');provider.calls[2].resolve();await switched;
    provider.event(1,'delta','后台回答');provider.calls[1].resolve();await pendingBackground;
    expect(manager.get(c.id)?.turns).toHaveLength(1);
    expect(manager.get(c.id)?.turns[0].answer).toBe('New translation');
    expect(manager.list().filter(item=>item.turns.length)).toHaveLength(2);
    expect(manager.get(background.id)?.turns[0].answer).toBe('后台回答');
  });
  it('does not request or reorder when choosing the current translation language',async()=>{
    const {manager,provider}=fixture();const c=manager.create(selection,'translate','中文');
    const first=manager.send(c.id,'','translate');provider.event(0,'delta','译文');provider.calls[0].resolve();await first;
    const before=manager.get(c.id);await manager.setLanguage(c.id,'中文');
    expect(provider.calls).toHaveLength(1);expect(manager.get(c.id)).toEqual(before);
  });
  it('rejects language changes while generating without changing or aborting the request',async()=>{
    const {manager,provider}=fixture();const c=manager.create(selection,'translate','中文');
    const pending=manager.send(c.id,'','translate');provider.event(0,'delta','部分译文');
    expect(()=>manager.setLanguage(c.id,'英文')).toThrow(/正在/);
    expect(manager.get(c.id)).toMatchObject({targetLanguage:'中文',turns:[{answer:'部分译文'}]});
    expect(provider.calls).toHaveLength(1);expect(provider.calls[0].signal.aborted).toBe(false);
    manager.stop(c.id);provider.calls[0].resolve();await pending;
    const switched=manager.setLanguage(c.id,'英文');expect(provider.calls[1].request.targetLanguage).toBe('英文');
    provider.calls[1].reject(Error('API_TIMEOUT'));await switched;
    expect(manager.get(c.id)).toMatchObject({state:'error',targetLanguage:'英文'});
    const retried=manager.send(c.id,'',undefined,true);
    expect(provider.calls[2].request).toMatchObject({action:'translate',targetLanguage:'英文'});
    provider.calls[2].resolve();await retried;expect(manager.get(c.id)?.turns).toHaveLength(1);
  });
  it('treats a custom followup after translation as a question instead of repeating the translation',async()=>{
    const {manager,provider}=fixture();const c=manager.create(selection,'translate','中文');
    const first=manager.send(c.id,'','translate');provider.event(0,'delta','译文');provider.calls[0].resolve();await first;
    const second=manager.send(c.id,'为什么？');expect(provider.calls[1].request.action).toBe('ask');expect(provider.calls[1].request.history.some(t=>t.content==='译文')).toBe(true);
    provider.calls[1].resolve();await second;
  });
  it('keeps connection progress on its own running turn and clears it after output or stop',async()=>{
    const {manager,provider}=fixture();const a=manager.create(selection,'ask','中文');const b=manager.create(selection,'ask','中文');
    const pa=manager.send(a.id,'A'),pb=manager.send(b.id,'B');
    provider.event(0,'status','正在重连 Codex');
    expect(manager.get(a.id)?.turns[0].progress).toBe('正在重连 Codex');
    expect(manager.get(b.id)?.turns[0].progress).toBeUndefined();
    provider.event(0,'delta','answer');expect(manager.get(a.id)?.turns[0].progress).toBeUndefined();
    provider.event(1,'status','正在连接');manager.stop(b.id);expect(manager.get(b.id)?.turns[0].progress).toBeUndefined();
    provider.calls.forEach(c=>c.resolve());await Promise.all([pa,pb]);
  });
  it('creates idle selections without requesting answers or creating history',()=>{
    const {manager,provider}=fixture(); const c=manager.create(selection,'ask','中文');
    expect(c.turns).toEqual([]); expect(provider.calls).toHaveLength(0);
    c.selection.text='modified'; expect(manager.get(c.id)?.selection.text).toBe(selection.text);
    manager.list()[0].draft='modified'; expect(manager.get(c.id)?.draft).toBe('');
  });
  it('routes concurrent answers independently and stops only the chosen request',async()=>{
    const {manager,provider}=fixture(); const a=manager.create(selection,'ask','中文');const b=manager.create(selection,'ask','英文');
    const pa=manager.send(a.id,'A'); const pb=manager.send(b.id,'B');
    provider.event(0,'delta','part A'); provider.event(1,'delta','part B');
    manager.draft(a.id,'next question'); manager.stop(a.id);
    expect(provider.calls[0].signal.aborted).toBe(true); expect(provider.calls[1].signal.aborted).toBe(false);
    provider.event(0,'delta','late'); provider.event(0,'completed'); provider.event(1,'delta',' final');provider.event(1,'completed');
    provider.calls.forEach(c=>c.resolve()); await Promise.all([pa,pb]);
    expect(manager.get(a.id)).toMatchObject({state:'stopped',draft:'next question',turns:[{answer:'part A'}]});
    expect(manager.get(b.id)).toMatchObject({state:'done',turns:[{answer:'part B final'}]});
  });
  it('retries with a new request identity and ignores all old terminal events',async()=>{
    const {manager,provider}=fixture();const c=manager.create(selection,'ask','中文');
    const first=manager.send(c.id,'first');provider.event(0,'delta','partial');manager.stop(c.id);
    const retry=manager.send(c.id,'ignored','ask',true);provider.event(0,'completed');provider.calls[0].resolve();await first;
    expect(manager.get(c.id)?.state).toBe('running');
    expect(provider.calls[1].request.question).toBe('first');expect(provider.calls[1].request.requestId).not.toBe(provider.calls[0].request.requestId);
    provider.event(1,'delta','fresh');provider.event(1,'completed');provider.calls[1].resolve();await retry;
    expect(manager.get(c.id)?.turns).toHaveLength(1);expect(manager.get(c.id)?.turns[0].answer).toBe('fresh');
  });
  it('snapshots request inputs, retains drafts and rejects duplicate sends',async()=>{
    const {manager,provider}=fixture();const c=manager.create(selection,'ask','中文');manager.draft(c.id,'first');
    const pending=manager.send(c.id,'first','explain');manager.draft(c.id,'next');
    expect(()=>manager.setLanguage(c.id,'英文')).toThrow();
    await expect(manager.send(c.id,'duplicate')).rejects.toThrow(/正在/);
    expect(provider.calls[0].request).toMatchObject({action:'explain',targetLanguage:'中文',question:'first'});
    provider.event(0,'delta','answer');provider.event(0,'completed');provider.calls[0].resolve();await pending;
    expect(manager.get(c.id)?.draft).toBe('next');
    const followup=manager.send(c.id,'followup','ask');expect(provider.calls[1].request.history).toEqual([{role:'user',content:'first'},{role:'assistant',content:'answer'}]);
    provider.event(1,'completed');provider.calls[1].resolve();await followup;
    expect(manager.get(c.id)?.turns).toHaveLength(2);
  });
  it('settles failure once without leaking provider exception contents',async()=>{
    const {manager,provider}=fixture();const c=manager.create(selection,'ask','中文');const p=manager.send(c.id,'question');
    provider.event(0,'delta','partial');provider.calls[0].reject(new Error('SECRET selected text'));
    await p;expect(manager.get(c.id)).toMatchObject({state:'error',turns:[{answer:'partial',state:'error'}]});
    expect(manager.get(c.id)?.turns[0].error).not.toContain('SECRET');
    provider.event(0,'completed');expect(manager.get(c.id)?.state).toBe('error');
  });
  it('does not reorder history when receiving output or editing a draft',async()=>{
    const {manager,provider}=fixture([record(1),record(2)]);const p=manager.send('c1','new question');const timestamp=manager.get('c1')!.updatedAt;
    manager.draft('c2','draft');provider.event(0,'delta','answer');manager.stop('c1');provider.calls[0].resolve();await p;
    expect(manager.get('c1')?.updatedAt).toBe(timestamp);expect(manager.list().map(c=>c.id)).toEqual(['c1','c2']);
  });
  it('evicts the oldest unprotected history on first send only',async()=>{
    const visible=new Set(['c0']);const {manager,provider}=fixture(Array.from({length:100},(_,i)=>record(i)),visible);
    const c=manager.create(selection,'ask','中文');expect(manager.list().filter(c=>c.turns.length)).toHaveLength(100);
    const p=manager.send(c.id,'new');expect(manager.get('c0')).toBeDefined();expect(manager.get('c1')).toBeUndefined();
    expect(manager.list().filter(c=>c.turns.length)).toHaveLength(100);provider.event(0,'completed');provider.calls[0].resolve();await p;
  });
  it('rejects new history if every existing record is protected without aborting anything',async()=>{
    const initial=Array.from({length:100},(_,i)=>record(i));const {manager,provider}=fixture(initial,new Set(initial.map(c=>c.id)));
    const c=manager.create(selection,'ask','中文');manager.draft(c.id,'keep');await expect(manager.send(c.id,'new')).rejects.toThrow(/100/);
    expect(manager.get(c.id)).toMatchObject({state:'idle',draft:'keep',turns:[]});expect(provider.calls).toHaveLength(0);
  });
  it('explicit removal aborts only that task and shutdown preserves interrupted partial answers',async()=>{
    const {manager,provider}=fixture();const a=manager.create(selection,'ask','中文');const b=manager.create(selection,'ask','中文');
    const pa=manager.send(a.id,'a');const pb=manager.send(b.id,'b');provider.event(1,'delta','partial');manager.remove(a.id);
    expect(manager.get(a.id)).toBeUndefined();expect(provider.calls[0].signal.aborted).toBe(true);expect(provider.calls[1].signal.aborted).toBe(false);
    await manager.dispose();await Promise.all([pa,pb]);expect(manager.get(b.id)).toMatchObject({state:'interrupted',turns:[{answer:'partial',state:'interrupted'}]});
    await expect(manager.send(b.id,'after close')).rejects.toThrow();
  });
});
