import {expect,it,vi} from 'vitest';
import {ProviderRouter} from '../src/providers/router';
import type {AnswerProvider,GenerateRequest} from '../src/shared/types';
const request:GenerateRequest={conversationId:'c',requestId:'r',selection:{selectionId:'s',text:'Public',sourceApp:'test',capturedAt:1},action:'translate',question:'',history:[]};
it('uses the selected API without falling back to Codex on failure',async()=>{
 const codex:AnswerProvider={check:vi.fn(),generate:vi.fn(),dispose:vi.fn()};const fetcher=vi.fn(async()=>new Response('private',{status:401}));
 const router=new ProviderRouter(codex,()=> 'api',()=>({baseUrl:'https://example.com/v1',model:'glm-4-flash',apiKey:'test-only'}),fetcher);
 await expect(router.generate(request,new AbortController().signal,()=>{})).rejects.toThrow('API_AUTH_FAILED');expect(codex.generate).not.toHaveBeenCalled();await router.dispose();
});
it('does not touch API credentials when Codex is selected',async()=>{
 const codex:AnswerProvider={check:vi.fn(),generate:vi.fn(async()=>{}),dispose:vi.fn()};const settings=vi.fn(()=>{throw Error('Credentials must not be read')});
 const router=new ProviderRouter(codex,()=> 'codex',settings,vi.fn());await router.generate(request,new AbortController().signal,()=>{});expect(settings).not.toHaveBeenCalled();expect(codex.generate).toHaveBeenCalledOnce();await router.dispose();
});
