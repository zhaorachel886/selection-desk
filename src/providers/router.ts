import type {AnswerProvider,GenerateRequest,ProviderEvent} from '../shared/types';
import {ApiProvider,type ApiOptions,type ApiFetch} from './api';
export class ProviderRouter implements AnswerProvider{
  private active=new Set<ApiProvider>();
  constructor(private codex:AnswerProvider,private source:()=>string,private options:()=>ApiOptions,private fetcher:ApiFetch){}
  async check(){return this.source()==='api'?{connected:false,reason:'请使用公开文本测试回答'}:this.codex.check()}
  async generate(request:GenerateRequest,signal:AbortSignal,emit:(e:ProviderEvent)=>void){
    if(this.source()!=='api')return this.codex.generate(request,signal,emit);
    const api=new ApiProvider({...this.options()},this.fetcher);this.active.add(api);
    try{await api.generate(request,signal,emit)}finally{this.active.delete(api);await api.dispose()}
  }
  async dispose(){await this.codex.dispose();await Promise.all([...this.active].map(p=>p.dispose()));this.active.clear()}
}
