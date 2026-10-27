import {expect,it} from 'vitest';
import {apiMessages} from '../src/providers/api';
import {buildPrompt} from '../src/providers/codex';
import type {Action,GenerateRequest} from '../src/shared/types';
const make=(action:Action):GenerateRequest=>({conversationId:'c',requestId:'r',selection:{selectionId:'s',text:'Public sample: 12 items on Friday.',sourceApp:'fixture',capturedAt:1},action,question:'',history:[],targetLanguage:'英文'});
const policy=(provider:string,r:GenerateRequest)=>provider==='api'?apiMessages(r)[0].content:buildPrompt(r).split('\n')[0];
for(const provider of ['api','codex']){
 it(`${provider}: polish preserves language, facts and voice without boilerplate`,()=>{
  const p=policy(provider,make('polish'));
  for(const word of ['原文语言','事实','数字','语气','只输出','不添加'])expect(p).toContain(word);
 });
 it(`${provider}: translation preserves structure and does not add explanations`,()=>{
  const p=policy(provider,make('translate'));
  for(const word of ['英文','只输出译文','段落','数字','不添加'])expect(p).toContain(word);
 });
 it(`${provider}: ask prioritizes the current question without forcing short answers`,()=>{
  const r={...make('ask'),question:'请分五点详细比较',history:[{role:'assistant' as const,content:'Earlier public answer'}]};
  const p=policy(provider,r);
  for(const word of ['当前问题','长度','不确定','Markdown'])expect(p).toContain(word);
  const serialized=provider==='api'?JSON.stringify(apiMessages(r)):buildPrompt(r);
  expect(serialized).toContain(r.question);expect(serialized).toContain('Earlier public answer');
 });
}
it('both providers use the same action policy and distinguish source text from user instructions',()=>{
 for(const action of ['translate','explain','polish','ask'] as const){
  const r=make(action),api=policy('api',r),codex=policy('codex',r);
  expect(api).toBe(codex);expect(api).toContain('选区');expect(api).toContain('当前问题');
 }
});
