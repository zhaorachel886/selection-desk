import {afterEach,expect,it} from 'vitest';
import {mkdirSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {PreferenceStore} from '../src/main/preferences';
import {DEFAULT_API_URL,DEFAULT_API_MODEL} from '../src/shared/types';
const directories:string[]=[];
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true})});
function fixture(){mkdirSync('tests/.tmp',{recursive:true});const directory=mkdtempSync(join(process.cwd(),'tests/.tmp/prefs-'));directories.push(directory);return {directory,store:new PreferenceStore(directory)}}
it('adds API defaults to old settings without switching the source',()=>{
 const {directory,store}=fixture();writeFileSync(join(directory,'preferences.json'),JSON.stringify({targetLanguage:'英文',shortcut:'Control+Alt+K',startAtLogin:false,codexPath:'codex'}));
 expect(store.load()).toMatchObject({source:'codex',apiBaseUrl:DEFAULT_API_URL,apiModel:DEFAULT_API_MODEL,targetLanguage:'英文',shortcut:'Control+Alt+K'});
});
it('preserves an explicitly selected API across reloads',()=>{
 const {directory,store}=fixture();store.save({...store.load(),source:'api',apiBaseUrl:'https://example.com/v1',apiModel:'public-model'});
 expect(new PreferenceStore(directory).load()).toMatchObject({source:'api',apiBaseUrl:'https://example.com/v1',apiModel:'public-model'});
});
