import { _electron as electron, chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const dataDir=join(root,'.runtime','selection-smoke');await mkdir(dataDir,{recursive:true});
const env={...process.env,SELECTION_DESK_DATA_DIR:dataDir};delete env.ELECTRON_RUN_AS_NODE;
const desktop=await electron.launch({args:['.'],cwd:root,timeout:30000,env});
desktop.on('close',()=>console.log('Desktop process closed'));
let chrome;
try{
  await desktop.firstWindow();
  await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().forEach(window=>window.hide()));
  chrome=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:false,
    args:['--no-first-run','--no-default-browser-check']});
  const page=await chrome.newPage({viewport:{width:900,height:600}});
  await page.setContent('<!doctype html><html><body><p style="font:24px Arial;margin:80px">Public Alpha Beta Gamma selection example.</p></body></html>');
  await page.bringToFront();
  const point=await page.getByText('Public Alpha Beta').evaluate(element=>{
    const box=element.getBoundingClientRect(),scale=window.devicePixelRatio;
    return {x:Math.round((window.screenX+box.x+25)*scale),y:Math.round((window.screenY+window.outerHeight-window.innerHeight+box.y+12)*scale)};
  });
  console.log('Native click point:',point);
  execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'scripts','native-doubleclick.ps1'),String(point.x),String(point.y)],{windowsHide:true});
  console.log('Selected in Chrome:',await page.evaluate(()=>String(window.getSelection())));
  let toolbar;
  for(let i=0;i<40;i++){
    for(const candidate of desktop.windows()){
      try{const state=await candidate.evaluate(()=>window.desk?.getState());if(state?.view==='toolbar'&&state.selection?.text){const native=await desktop.browserWindow(candidate);if(await native.evaluate(window=>window.isVisible())){toolbar=candidate;break}}}catch{}
    }
    if(toolbar)break;await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!toolbar){
    const windows=[];for(const candidate of desktop.windows())try{windows.push(await candidate.evaluate(()=>window.desk?.getState()))}catch{}
    console.log('Desktop window states:',windows.map(state=>({view:state?.view,selectionStatus:state?.selectionStatus,selected:!!state?.selection})));
    try{console.log('Native windows:',await desktop.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(w=>({visible:w.isVisible(),destroyed:w.isDestroyed()}))))}catch(error){console.log('Native window query failed:',String(error).slice(0,200))}
    throw Error('Chrome text selection did not open toolbar');
  }
  const state=await toolbar.evaluate(()=>window.desk.getState());
  console.log('Chrome selection:',state.selection.text,'source:',state.selection.sourceApp);
  await toolbar.getByRole('button',{name:'问 AI'}).click();
  let panel;
  for(let i=0;i<40;i++){
    for(const candidate of desktop.windows()){
      try{const next=await candidate.evaluate(()=>window.desk?.getState());if(next?.view==='conversation'&&next.conversationId){panel=candidate;break}}catch{}
    }
    if(panel)break;await new Promise(resolve=>setTimeout(resolve,250));
  }
  if(!panel)throw Error('Ask AI did not open a native conversation window');
  const conversation=await panel.evaluate(()=>window.desk.getState());
  if(conversation.conversations.find(c=>c.id===conversation.conversationId)?.turns.length!==0)throw Error('Ask AI generated without a question');
  console.log('Chrome selection smoke passed: toolbar and idle Ask AI window');
}finally{await chrome?.close();await desktop.close()}
