import { contextBridge, ipcRenderer } from 'electron';
import type { AppSnapshot, DesktopAPI } from '../shared/types';

const api:DesktopAPI={
  getState:()=>ipcRenderer.invoke('desk:state'),
  command:action=>ipcRenderer.invoke('desk:command',action),
  onState:callback=>{
    const listener=(_event:Electron.IpcRendererEvent,state:AppSnapshot)=>callback(state);
    ipcRenderer.on('desk:state',listener);
    return()=>ipcRenderer.removeListener('desk:state',listener);
  },
};
contextBridge.exposeInMainWorld('desk',api);
