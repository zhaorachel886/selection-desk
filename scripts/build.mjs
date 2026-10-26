import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
import { join } from 'node:path';

const root=process.cwd();
await mkdir(join(root,'dist','main'),{recursive:true});
await mkdir(join(root,'dist','renderer'),{recursive:true});
await mkdir(join(root,'dist','assets'),{recursive:true});
await copyFile(join(root,'assets','branding','shiju.png'),join(root,'dist','assets','shiju.png'));
await build({entryPoints:[join(root,'src','main','index.ts')],outfile:join(root,'dist','main','index.cjs'),
  platform:'node',format:'cjs',target:'node22',bundle:true,external:['electron','selection-hook'],logLevel:'warning'});
await build({entryPoints:[join(root,'src','main','preload.ts')],outfile:join(root,'dist','main','preload.cjs'),
  platform:'node',format:'cjs',target:'node22',bundle:true,external:['electron'],logLevel:'warning'});
await build({entryPoints:[join(root,'src','renderer','index.tsx')],outfile:join(root,'dist','renderer','index.js'),
  platform:'browser',format:'iife',target:'chrome140',bundle:true,logLevel:'warning'});
await copyFile(join(root,'src','renderer','index.html'),join(root,'dist','renderer','index.html'));
