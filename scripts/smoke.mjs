import { _electron as electron } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=join(root,'.runtime','smoke-userdata');
await mkdir(dataDir,{recursive:true});
const env={...process.env,SELECTION_DESK_DATA_DIR:dataDir};delete env.ELECTRON_RUN_AS_NODE;
const packaged=process.env.SELECTION_DESK_EXECUTABLE;
const app=await electron.launch({executablePath:packaged||undefined,args:packaged?[]:['.'],cwd:root,timeout:30000,env});
try{
  const page=await app.firstWindow({timeout:15000});
  await page.getByText('近期记录').first().waitFor({timeout:10000});
  const state=await page.evaluate(()=>window.desk.getState());
  if(state.view!=='history'||!Array.isArray(state.conversations))throw Error('Wrong initial desktop state');
  console.log('Selection service:',state.selectionStatus);
  await page.screenshot({path:join(root,'.runtime','smoke-history.png')});
  await page.getByRole('button',{name:'设置'}).click();
  await page.getByRole('heading',{name:'回答来源',exact:true}).waitFor({timeout:5000});
  await page.screenshot({path:join(root,'.runtime','smoke-settings.png')});
  console.log('Desktop smoke passed: history, IPC state, settings');
}finally{await app.close()}
