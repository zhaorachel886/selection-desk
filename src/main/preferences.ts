import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Preferences } from '../shared/types';
import {DEFAULT_API_URL,DEFAULT_API_MODEL} from '../shared/types';

export const defaults:Preferences={targetLanguage:'auto',shortcut:'Control+Alt+D',startAtLogin:false,codexPath:'',source:'codex',apiBaseUrl:DEFAULT_API_URL,apiModel:DEFAULT_API_MODEL};
export class PreferenceStore {
  readonly path:string;
  constructor(private directory:string){this.path=join(directory,'preferences.json')}
  load():Preferences {
    if(!existsSync(this.path))return {...defaults};
    try{
      const value:unknown=JSON.parse(readFileSync(this.path,'utf8'));
      if(!value||typeof value!=='object')return {...defaults};
      const data=value as Partial<Preferences>;
      return {targetLanguage:['auto','中文','英文'].includes(data.targetLanguage||'')?data.targetLanguage!:defaults.targetLanguage,
        shortcut:typeof data.shortcut==='string'&&data.shortcut?data.shortcut:defaults.shortcut,
        startAtLogin:data.startAtLogin===true,codexPath:typeof data.codexPath==='string'?data.codexPath:'',source:data.source==='api'?'api':'codex',
        apiBaseUrl:typeof data.apiBaseUrl==='string'&&data.apiBaseUrl?data.apiBaseUrl:DEFAULT_API_URL,apiModel:typeof data.apiModel==='string'&&data.apiModel?data.apiModel:DEFAULT_API_MODEL};
    }catch{return {...defaults}}
  }
  save(value:Preferences){mkdirSync(this.directory,{recursive:true});const temp=this.path+'.tmp';writeFileSync(temp,JSON.stringify(value),'utf8');renameSync(temp,this.path)}
}
