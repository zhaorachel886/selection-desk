import { contextBridge, ipcRenderer } from 'electron';
import type { Action, AppState, DesktopBridge } from '../shared/types';
const desktop: DesktopBridge = {
  getState: () => ipcRenderer.invoke('desk:state'),
  dispatch: (action: Action) => ipcRenderer.invoke('desk:action', action),
  onState: (callback: (state: AppState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, value: AppState) => callback(value);
    ipcRenderer.on('desk:state', listener);
    return () => ipcRenderer.removeListener('desk:state', listener);
  }
};
contextBridge.exposeInMainWorld('desktop', desktop);
