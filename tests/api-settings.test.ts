import {expect,it} from 'vitest';
import {parseCommand} from '../src/main/command-validation';
const preferences={targetLanguage:'auto',shortcut:'Control+Alt+D',startAtLogin:false,codexPath:'',source:'api',apiBaseUrl:'https://open.bigmodel.cn/api/paas/v4',apiModel:'glm-4-flash'};
it('accepts API settings and an optional write-only key outside preferences',()=>{
 expect(parseCommand({type:'save-settings',preferences,apiKey:'test-only'})).toEqual({type:'save-settings',preferences,apiKey:'test-only'});
 expect(()=>parseCommand({type:'save-settings',preferences:{...preferences,apiKey:'not-here'}})).toThrow();
});
it('validates a public test without changing saved preferences',()=>{
 const test={type:'test-api',apiBaseUrl:preferences.apiBaseUrl,apiModel:preferences.apiModel,apiKey:'test-only'};
 expect(parseCommand(test)).toEqual(test);expect(()=>parseCommand({...test,question:'unexpected user data'})).toThrow();
 expect(()=>parseCommand({type:'save-settings',preferences:{...preferences,source:'unknown'}})).toThrow();
});
