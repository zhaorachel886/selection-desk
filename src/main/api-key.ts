import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync,rmSync} from 'node:fs';
import {join} from 'node:path';
type CryptoStore={isEncryptionAvailable():boolean;encryptString(value:string):Buffer;decryptString(value:Buffer):string};
export class ApiKeyStore{
  private file:string;
  constructor(private directory:string,private crypto:CryptoStore){this.file=join(directory,'model-key.enc')}
  load():string{
    if(!existsSync(this.file))return '';
    try{return this.crypto.decryptString(readFileSync(this.file))}catch{throw Error('KEY_READ_FAILED')}
  }
  save(value:string){
    if(!this.crypto.isEncryptionAvailable())throw Error('KEY_ENCRYPTION_UNAVAILABLE');
    const encrypted=this.crypto.encryptString(value);mkdirSync(this.directory,{recursive:true});
    writeFileSync(this.file+'.tmp',encrypted);renameSync(this.file+'.tmp',this.file);
  }
  clear(){rmSync(this.file,{force:true})}
}
