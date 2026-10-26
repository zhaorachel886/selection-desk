import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const electron=join(root,'node_modules','electron','cli.js');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(process.execPath,[electron,'.',...process.argv.slice(2)],{cwd:root,stdio:'inherit',windowsHide:false,env});
child.on('exit',code=>{process.exitCode=code??0});
