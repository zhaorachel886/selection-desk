import { app, dialog } from 'electron';
import { isAbsolute, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { launchDesktop } from './desktop';

// Keep the existing profile directory when changing the display name.
const dataDir=process.env.SELECTION_DESK_DATA_DIR;
const profileDir=dataDir&&isAbsolute(dataDir)?resolve(dataDir):resolve(app.getPath('appData'),'划词助手');
mkdirSync(profileDir,{recursive:true});
app.setPath('userData',profileDir);
app.setName('拾句');
app.disableHardwareAcceleration();
app.setAppUserModelId('io.selectiondesk.desktop');
if(!app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(launchDesktop).catch(error=>{
  dialog.showErrorBox('拾句启动失败',error instanceof Error?error.message:'请重新启动应用。');app.exit(1);
});
