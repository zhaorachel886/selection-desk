export type Action = 'translate' | 'ask' | 'explain' | 'polish';
export type TaskState = 'idle' | 'running' | 'done' | 'stopped' | 'error' | 'interrupted';
export interface SelectionSnapshot { selectionId:string; text:string; sourceApp:string; capturedAt:number; bounds?:{x:number;y:number;width:number;height:number} }
export interface Turn { id:string; question:string; answer:string; state:TaskState; error?:string; progress?:string }
export interface Conversation { id:string; selection:SelectionSnapshot; action:Action; targetLanguage:'中文'|'英文'; turns:Turn[]; state:TaskState; updatedAt:number; draft:string }
export interface GenerateRequest { conversationId:string; requestId:string; selection:SelectionSnapshot; action:Action; question:string; history:Array<{role:'user'|'assistant';content:string}>; targetLanguage?:'中文'|'英文' }
export interface ProviderEvent { conversationId:string; requestId:string; type:'delta'|'completed'|'failed'|'status'; text?:string; errorCode?:string }
export interface AnswerProvider { check():Promise<{connected:boolean;reason?:string}>; generate(request:GenerateRequest,signal:AbortSignal,emit:(event:ProviderEvent)=>void):Promise<void>; dispose():Promise<void> }
export const DEFAULT_API_URL='https://open.bigmodel.cn/api/paas/v4';
export const DEFAULT_API_MODEL='glm-4-flash';
export interface Preferences { targetLanguage:'auto'|'中文'|'英文'; shortcut:string; startAtLogin:boolean; codexPath:string;source?:'codex'|'api';apiBaseUrl?:string;apiModel?:string }
export type View = 'toolbar'|'conversation'|'history'|'settings';
export interface AppSnapshot { view:View; selection:SelectionSnapshot|null; conversationId:string|null; conversations:Conversation[]; pinnedId:string|null; preferences:Preferences; connection:string; selectionStatus:string;hasApiKey?:boolean }
export type AppCommand =
 | {type:'open';action:'translate'|'ask'}
 | {type:'send';conversationId:string;question:string}
 | {type:'quick';conversationId:string;action:'explain'|'polish'}
 | {type:'draft';conversationId:string;text:string}
 | {type:'stop'|'retry'|'pin';conversationId:string}
 | {type:'language';conversationId:string;language:'中文'|'英文'}
 | {type:'open-record'|'delete-record';conversationId:string}
 | {type:'copy-answer'|'copy-question';conversationId:string;turnId:string}
 | {type:'copy-original'|'close'|'history'|'back'|'settings'|'check-connection'|'clear-history'}
 | {type:'save-settings';preferences:Preferences;apiKey?:string}
 | {type:'test-api';apiBaseUrl:string;apiModel:string;apiKey?:string}
 | {type:'clear-api-key'};
export interface CommandResult { ok:boolean;message?:string }
export interface DesktopAPI { getState():Promise<AppSnapshot>;command(action:AppCommand):Promise<CommandResult>;onState(cb:(state:AppSnapshot)=>void):()=>void }
declare global { interface Window { desk:DesktopAPI } }
