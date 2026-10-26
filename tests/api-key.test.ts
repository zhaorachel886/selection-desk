import {afterEach,expect,it,vi} from 'vitest';
import {mkdtempSync,mkdirSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ApiKeyStore} from '../src/main/api-key';
const dirs:string[]=[];
afterEach(()=>{for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true})});
function fixture(available=true){mkdirSync('tests/.tmp',{recursive:true});const dir=mkdtempSync(join(process.cwd(),'tests/.tmp/key-'));dirs.push(dir);const crypto={isEncryptionAvailable:()=>available,encryptString:vi.fn((s:string)=>Buffer.from(s.split('').reverse().join(''))),decryptString:vi.fn((b:Buffer)=>b.toString().split('').reverse().join(''))};return {dir,crypto,store:new ApiKeyStore(dir,crypto)}}
it('encrypts the stored key, reloads it and can remove it',()=>{
 const {dir,crypto,store}=fixture();store.save('test-key-placeholder');expect(readFileSync(join(dir,'model-key.enc'),'utf8')).not.toContain('test-key-placeholder');
 expect(new ApiKeyStore(dir,crypto).load()).toBe('test-key-placeholder');store.clear();expect(store.load()).toBe('');
});
it('does not fall back to plaintext when OS encryption is unavailable',()=>{
 const {store,crypto}=fixture(false);expect(()=>store.save('test-only')).toThrow('KEY_ENCRYPTION_UNAVAILABLE');expect(crypto.encryptString).not.toHaveBeenCalled();
});
it('reports unreadable credentials without exposing data',()=>{
 const {dir,crypto,store}=fixture();writeFileSync(join(dir,'model-key.enc'),'private');crypto.decryptString.mockImplementation(()=>{throw Error('private credential')});expect(()=>store.load()).toThrow('KEY_READ_FAILED');
});
