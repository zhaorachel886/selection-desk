import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {version}=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))throw Error('Invalid package version');
const directory=process.argv[2]?resolve(process.argv[2]):join(root,'release',version);
const expected=[`Shiju-${version}-x64.exe`,`Shiju-Setup-${version}-x64.exe`].sort();
const executables=(await readdir(directory)).filter(name=>name.endsWith('.exe')).sort();
if(JSON.stringify(executables)!==JSON.stringify(expected))throw Error('Expected exactly the Shiju installer and portable executable');
const rows=[];
for(const name of expected){
  const path=join(directory,name);
  if(!(await stat(path)).isFile())throw Error(`Not a regular file: ${name}`);
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(path))hash.update(chunk);
  rows.push(`${hash.digest('hex')}  ${name}`);
}
const destination=join(directory,'SHA256SUMS.txt');
await writeFile(destination+'.tmp',rows.join('\n')+'\n','utf8');
await rename(destination+'.tmp',destination);
console.log(`Checksums generated for ${expected.length} executables: ${destination}`);
