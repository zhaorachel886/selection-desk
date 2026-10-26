import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/main/command-validation';

describe('renderer command boundary', () => {
  it('rejects a command with an unknown operation', () => {
    expect(() => parseCommand({ type:'execute', command:'calc.exe' })).toThrow();
  });
  it('rejects extra fields instead of forwarding them into the main process', () => {
    expect(() => parseCommand({ type:'close', shell:'powershell' })).toThrow();
  });
  it('rejects non-string or oversized text', () => {
    expect(() => parseCommand({ type:'send', conversationId:'c1', question:42 })).toThrow();
    expect(() => parseCommand({ type:'send', conversationId:'c1', question:'x'.repeat(100_001) })).toThrow();
  });
  it('returns only the allowed fields of a valid command', () => {
    expect(parseCommand({ type:'send', conversationId:'c1', question:'解释这段' }))
      .toEqual({ type:'send', conversationId:'c1', question:'解释这段' });
  });
  it('rejects invalid preference values and additional properties', () => {
    const preferences={targetLanguage:'auto',shortcut:'Ctrl+Shift+Space',startAtLogin:false,codexPath:'codex'};
    expect(() => parseCommand({ type:'save-settings', preferences:{...preferences,targetLanguage:'日文'} })).toThrow();
    expect(() => parseCommand({ type:'save-settings', preferences:{...preferences,secret:'x'} })).toThrow();
  });
  it('allows automatic Codex discovery and copies a specific question without accepting raw text',()=>{
    const preferences={targetLanguage:'auto',shortcut:'Control+Alt+D',startAtLogin:false,codexPath:''};
    expect(parseCommand({type:'save-settings',preferences})).toEqual({type:'save-settings',preferences});
    expect(parseCommand({type:'copy-question',conversationId:'c1',turnId:'t1'})).toEqual({type:'copy-question',conversationId:'c1',turnId:'t1'});
    expect(()=>parseCommand({type:'copy-question',conversationId:'c1',turnId:'t1',text:'injected'})).toThrow();
  });
});
