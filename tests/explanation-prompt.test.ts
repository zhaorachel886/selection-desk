import {expect,it} from 'vitest';
import {apiMessages} from '../src/providers/api';
import {buildPrompt} from '../src/providers/codex';
import type {GenerateRequest} from '../src/shared/types';
const request:GenerateRequest={conversationId:'c',requestId:'r',selection:{selectionId:'s',text:'Public example',sourceApp:'test',capturedAt:1},action:'explain',question:'请解释选中文字',history:[]};
it.each(['api','codex'])('%s asks for a direct, short explanation without repeating the selection',provider=>{
 const prompt=provider==='api'?apiMessages(request)[0].content:buildPrompt(request);
 expect(prompt).toContain('直接解释');expect(prompt).toContain('不要复述');expect(prompt).toContain('2～3');expect(prompt).toContain('追问');
});
