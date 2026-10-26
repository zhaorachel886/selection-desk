import type { AppCommand, Preferences } from '../shared/types';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('无效操作');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error('无效操作');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, fields: string[]) {
  if (Object.keys(value).length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) throw new Error('无效操作');
}
function string(value: unknown, max: number, allowEmpty = false): string {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) throw new Error('无效输入');
  return value;
}
function id(value: unknown): string {
  const result = string(value, 100);
  if (!/^[\w-]+$/.test(result)) throw new Error('无效标识');
  return result;
}
export function parseCommand(value: unknown): AppCommand {
  const command = object(value);
  const type = command.type;
  switch (type) {
    case 'copy-original': case 'close': case 'history': case 'back':
    case 'settings': case 'check-connection': case 'clear-history': case 'clear-api-key':
      exact(command, ['type']); return { type };
    case 'open':
      exact(command, ['type','action']);
      if (command.action !== 'translate' && command.action !== 'ask') throw new Error('无效操作');
      return { type, action:command.action };
    case 'quick':
      exact(command, ['type','conversationId','action']);
      if (command.action !== 'explain' && command.action !== 'polish') throw new Error('无效操作');
      return { type, conversationId:id(command.conversationId), action:command.action };
    case 'send':
      exact(command, ['type','conversationId','question']);
      return { type, conversationId:id(command.conversationId), question:string(command.question,100_000) };
    case 'draft':
      exact(command, ['type','conversationId','text']);
      return { type, conversationId:id(command.conversationId), text:string(command.text,10_000,true) };
    case 'language':
      exact(command, ['type','conversationId','language']);
      if (command.language !== '中文' && command.language !== '英文') throw new Error('无效语言');
      return { type, conversationId:id(command.conversationId), language:command.language };
    case 'stop': case 'retry': case 'pin': case 'open-record': case 'delete-record':
      exact(command, ['type','conversationId']);
      return { type, conversationId:id(command.conversationId) };
    case 'copy-answer': case 'copy-question':
      exact(command, ['type','conversationId','turnId']);
      return { type, conversationId:id(command.conversationId), turnId:id(command.turnId) };
    case 'save-settings': {
      exact(command, ['type','preferences',...(Object.hasOwn(command,'apiKey')?['apiKey']:[])]);
      const p = object(command.preferences);
      exact(p, ['targetLanguage','shortcut','startAtLogin','codexPath',...['source','apiBaseUrl','apiModel'].filter(k=>Object.hasOwn(p,k))]);
      if (!['auto','中文','英文'].includes(String(p.targetLanguage)) || typeof p.startAtLogin !== 'boolean') throw new Error('无效设置');
      const preferences: Preferences = { targetLanguage:p.targetLanguage as Preferences['targetLanguage'], shortcut:string(p.shortcut,100), startAtLogin:p.startAtLogin, codexPath:string(p.codexPath,500,true) };
      if(Object.hasOwn(p,'source')){if(p.source!=='api'&&p.source!=='codex')throw Error('无效来源');preferences.source=p.source}
      if(Object.hasOwn(p,'apiBaseUrl'))preferences.apiBaseUrl=string(p.apiBaseUrl,1000);
      if(Object.hasOwn(p,'apiModel'))preferences.apiModel=string(p.apiModel,150);
      return { type, preferences,...(Object.hasOwn(command,'apiKey')?{apiKey:string(command.apiKey,4096)}:{}) };
    }
    case 'test-api':
      exact(command,['type','apiBaseUrl','apiModel',...(Object.hasOwn(command,'apiKey')?['apiKey']:[])]);
      return {type,apiBaseUrl:string(command.apiBaseUrl,1000),apiModel:string(command.apiModel,150),...(Object.hasOwn(command,'apiKey')?{apiKey:string(command.apiKey,4096)}:{})};
    default: throw new Error('无效操作');
  }
}
