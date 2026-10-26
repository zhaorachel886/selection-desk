import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Conversation, SelectionSnapshot, TaskState, Turn } from '../shared/types';

const states = new Set<TaskState>(['idle','running','done','stopped','error','interrupted']);
function validText(value:unknown,max=100_000):value is string { return typeof value==='string' && value.length<=max }
function isSelection(value:unknown):value is SelectionSnapshot {
  if(!value || typeof value!=='object')return false;
  const s=value as Partial<SelectionSnapshot>;
  return validText(s.selectionId,100)&&validText(s.text)&&validText(s.sourceApp,200)&&Number.isFinite(s.capturedAt);
}
function isTurn(value:unknown):value is Turn {
  if(!value || typeof value!=='object')return false;
  const t=value as Partial<Turn>;
  return validText(t.id,100)&&validText(t.question)&&validText(t.answer,2_000_000)&&states.has(t.state as TaskState)&&
    (t.error===undefined||validText(t.error,300));
}
function isConversation(value:unknown):value is Conversation {
  if(!value || typeof value!=='object')return false;
  const c=value as Partial<Conversation>;
  return validText(c.id,100)&&isSelection(c.selection)&&['translate','ask','explain','polish'].includes(c.action as string)&&
    (c.targetLanguage==='中文'||c.targetLanguage==='英文')&&Array.isArray(c.turns)&&c.turns.length>0&&c.turns.length<=1000&&
    c.turns.every(isTurn)&&new Set(c.turns.map(t=>t.id)).size===c.turns.length&&states.has(c.state as TaskState)&&
    Number.isFinite(c.updatedAt)&&validText(c.draft,10_000);
}
function decode(raw:string):Conversation[] {
  const payload:unknown=JSON.parse(raw);
  if(!payload || typeof payload!=='object')throw Error('invalid');
  const file=payload as {version?:unknown;conversations?:unknown};
  if(file.version!==1 || !Array.isArray(file.conversations) || file.conversations.length>100 || !file.conversations.every(isConversation) ||
    new Set(file.conversations.map(c=>c.id)).size!==file.conversations.length)throw Error('invalid');
  return structuredClone(file.conversations);
}
export class HistoryStore {
  warning?:string;
  private readonly main:string;
  private readonly backup:string;
  constructor(private readonly directory:string){this.main=join(directory,'history.json');this.backup=join(directory,'history.backup.json')}
  load():Conversation[] {
    this.warning=undefined;
    if(!existsSync(this.main)&&!existsSync(this.backup))return [];
    for(const file of [this.main,this.backup]){
      if(!existsSync(file))continue;
      try {
        const records=decode(readFileSync(file,'utf8'));
        if(file===this.backup)this.warning='主记录不可用，已从备份恢复';
        return records.map(c=>{
          if(c.state==='running')c.state='interrupted';
          for(const t of c.turns){delete t.progress;if(t.state==='running')t.state='interrupted';}
          return c;
        });
      }catch { /* A second validated snapshot may be recoverable. */ }
    }
    throw Error('本地记录损坏，无法读取主文件或备份');
  }
  save(conversations:Conversation[]):void {
    const records=structuredClone(conversations.filter(c=>c.turns.length));
    for(const c of records)for(const t of c.turns)delete t.progress;
    const serialized=JSON.stringify({version:1,conversations:records});
    try{decode(serialized)}catch{throw Error('本地记录格式无效，未覆盖已有记录')}
    mkdirSync(this.directory,{recursive:true});
    const temp=join(this.directory,`history-${randomUUID()}.tmp`);
    const backupTemp=join(this.directory,`backup-${randomUUID()}.tmp`);
    try {
      // A corrupt current file must never replace the last good backup.
      if(existsSync(this.main)){
        const previous=readFileSync(this.main,'utf8');
        let valid=false;
        try {decode(previous);valid=true}catch{ /* Preserve any existing good backup. */ }
        if(valid){
          writeFileSync(backupTemp,previous,'utf8');renameSync(backupTemp,this.backup);
        }
      }
      writeFileSync(temp,serialized,'utf8');
      renameSync(temp,this.main);
    }finally{
      if(existsSync(temp))rmSync(temp);
      if(existsSync(backupTemp))rmSync(backupTemp);
    }
  }
}
