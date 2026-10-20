import { app, dialog, safeStorage } from 'electron';
import { resolve, isAbsolute } from 'node:path';
import { Preferences } from './preferences';
import { launchDesktop } from './desktop';

app.setName('Selection Desk');
// Text-only overlays do not need a hardware GPU context kept alive in the tray.
app.disableHardwareAcceleration();
if (process.env.SELECTION_DESK_DATA_DIR && isAbsolute(process.env.SELECTION_DESK_DATA_DIR)) app.setPath('userData', resolve(process.env.SELECTION_DESK_DATA_DIR));
app.setAppUserModelId('io.selectiondesk.desktop');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.whenReady().then(async () => {
    const prefs = new Preferences(app.getPath('userData'), safeStorage);
    await launchDesktop(prefs);
  }).catch(error => {
    dialog.showErrorBox('Selection Desk 无法启动', error instanceof Error ? error.message : '请检查设置和本机端口。');
    app.exit(1);
  });
}
