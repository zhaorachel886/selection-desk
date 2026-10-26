import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, safeStorage, screen, session, Tray } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import SelectionHook, { type MouseEventData, type TextSelectionData } from 'selection-hook';
import { HistoryStore } from './history';
import { PreferenceStore } from './preferences';
import { TaskManager } from './tasks';
import { parseCommand } from './command-validation';
import { placeNearSelection, type Rectangle } from './window-placement';
import { WindowSizeStore, fitWindowSize } from './window-size';
import { CodexProvider } from '../providers/codex';
import { ApiProvider,apiEndpoint,type ApiFetch } from '../providers/api';
import { ProviderRouter } from '../providers/router';
import { ApiKeyStore } from './api-key';
import { DEFAULT_API_URL,DEFAULT_API_MODEL } from '../shared/types';
import { apiErrorMessage } from '../shared/api-errors';
import type { AppCommand, AppSnapshot, CommandResult, Conversation, Preferences, SelectionSnapshot, View } from '../shared/types';

type Role='toolbar'|'temporary'|'pinned';
type Panel={window:BrowserWindow;role:Role;view:View;conversationId:string|null;previous:View};
const panelWidth=380,panelHeight=510,toolbarWidth=226,toolbarHeight=40;
const safeError=(error:unknown)=>error instanceof Error&&/^[\u3400-\u9fff\w ，。；：、！？·（）]{1,100}$/.test(error.message)?error.message:'操作失败，请重试';
function targetLanguage(text:string,preferred:Preferences['targetLanguage']):'中文'|'英文'{
  if(preferred!=='auto')return preferred;
  const chinese=(text.match(/[\u3400-\u9fff]/g)||[]).length;
  const letters=(text.match(/[A-Za-z]/g)||[]).length;
  return chinese>=letters?'英文':'中文';
}
function pointFrom(event:TextSelectionData):{x:number;y:number}{
  const point=event.endBottom;
  return point&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&point.x!==SelectionHook.INVALID_COORDINATE&&point.y!==SelectionHook.INVALID_COORDINATE?
    screen.screenToDipPoint(point):screen.getCursorScreenPoint();
}

export async function launchDesktop(){
  const dataDir=app.getPath('userData');
  mkdirSync(dataDir,{recursive:true});
  const agentDir=join(dataDir,'agent-sandbox');mkdirSync(agentDir,{recursive:true});
  const prefsStore=new PreferenceStore(dataDir);let preferences=prefsStore.load();
  const sizeStore=new WindowSizeStore(dataDir);let preferredSize=sizeStore.load();
  const history=new HistoryStore(dataDir);
  let recovered:Conversation[]=[];
  let historyError='';let saveEnabled=true;
  try{recovered=history.load();historyError=history.warning||''}
  catch{historyError='本地记录无法读取；旧文件已保留，请检查数据目录。';saveEnabled=false}
  const codex=new CodexProvider(preferences.codexPath,agentDir,()=>session.defaultSession.resolveProxy('https://chatgpt.com'));
  const keyStore=new ApiKeyStore(dataDir,safeStorage);let apiKey='',keyWarning='';
  try{apiKey=keyStore.load()}catch{keyWarning=apiErrorMessage('KEY_READ_FAILED')}
  const apiFetch:ApiFetch=(url,init)=>session.defaultSession.fetch(url,init);
  const provider=new ProviderRouter(codex,()=>preferences.source||'codex',()=>({baseUrl:preferences.apiBaseUrl||DEFAULT_API_URL,model:preferences.apiModel||DEFAULT_API_MODEL,apiKey}),apiFetch);
  let testProvider:ApiProvider|undefined;
  function keyForAddress(baseUrl:string,entered?:string){
    if(entered?.trim())return entered.trim();
    if(apiKey&&apiEndpoint(baseUrl)!==apiEndpoint(preferences.apiBaseUrl||DEFAULT_API_URL))throw Error('API_NEW_ENDPOINT_KEY');
    return apiKey;
  }
  const panels=new Map<number,Panel>();
  let toolbar:Panel|undefined,temporary:Panel|undefined,pinned:Panel|undefined;
  let selection:SelectionSnapshot|null=null;
  let connection='尚未检查连接';
  let selectionStatus='正在启动自动取词';
  let publishTimer:ReturnType<typeof setTimeout>|undefined;
  let saveTimer:ReturnType<typeof setTimeout>|undefined;
  let hook:SelectionHook|undefined;
  let tray:Tray;
  const renderer=join(__dirname,'../renderer/index.html');
  const appIcon=nativeImage.createFromPath(join(__dirname,'../assets/shiju.png'));
  if(appIcon.isEmpty())throw Error('拾句图标无法加载，请重新安装应用。');
  const rendererUrl=pathToFileURL(renderer).href;
  const protectedIds=()=>new Set([temporary?.conversationId,pinned?.conversationId].filter((id):id is string=>!!id));
  const tasks=new TaskManager(provider,recovered,changed,protectedIds);
  function snapshot(panel:Panel):AppSnapshot{
    return {view:panel.view,selection,conversationId:panel.conversationId,
      conversations:tasks.list(),pinnedId:pinned?.conversationId||null,preferences:{...preferences},
      connection:historyError||keyWarning||connection,selectionStatus,hasApiKey:!!apiKey};
  }
  function save(){if(!saveEnabled)return;try{history.save(tasks.list())}catch{historyError='本地记录保存失败，请检查磁盘与数据目录';publish()}}
  function changed(){publish();if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=undefined;save()},500)}
  function publish(){if(publishTimer)return;publishTimer=setTimeout(()=>{
    publishTimer=undefined;
    for(const panel of panels.values())if(!panel.window.isDestroyed())panel.window.webContents.send('desk:state',snapshot(panel));
  },30)}
  function destroy(panel:Panel|undefined){if(!panel||panel.window.isDestroyed())return;panel.window.destroy()}
  function place(panel:Panel,origin?:Rectangle){
    const win=panel.window;
    const source=origin||selection?.bounds||{...screen.getCursorScreenPoint(),width:1,height:1};
    const display=screen.getDisplayNearestPoint({x:source.x,y:source.y});
    const size=panel.role==='toolbar'?{width:toolbarWidth,height:toolbarHeight}:fitWindowSize(preferredSize,display.workArea);
    const area=display.workArea;
    if(panel.role!=='toolbar'){win.setMinimumSize(Math.min(320,area.width-16),Math.min(300,area.height-16));win.setMaximumSize(area.width-16,area.height-16)}
    if(panel.role==='toolbar')win.setSize(Math.min(size.width,area.width-16),Math.min(size.height,area.height-16));
    else win.setContentSize(size.width,size.height);
    const position=placeNearSelection(source,area,win.getBounds());
    win.setPosition(position.x,position.y);
  }
  function create(role:Role):Panel{
    const win=new BrowserWindow({width:role==='toolbar'?toolbarWidth:panelWidth,height:role==='toolbar'?toolbarHeight:panelHeight,
      title:'拾句',icon:appIcon,frame:false,show:false,alwaysOnTop:true,skipTaskbar:true,transparent:role==='toolbar',backgroundColor:'#ffffff',hasShadow:true,
      resizable:role!=='toolbar',webPreferences:{preload:join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:!app.isPackaged}});
    const panel:Panel={window:win,role,view:role==='toolbar'?'toolbar':'conversation',conversationId:null,previous:'conversation'};
    panels.set(win.id,panel);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    win.on('resized',()=>{if(panel.role==='toolbar'||win.isDestroyed())return;
      const [width,height]=win.getContentSize();preferredSize={width,height};
      try{sizeStore.save(preferredSize)}catch{connection='窗口大小未能保存，下次启动将使用原大小';publish()}
    });
    win.webContents.on('will-navigate',event=>event.preventDefault());
    win.webContents.session.setPermissionRequestHandler((_webContents,_permission,callback)=>callback(false));
    win.on('closed',()=>{
      panels.delete(win.id);if(toolbar===panel)toolbar=undefined;if(temporary===panel)temporary=undefined;if(pinned===panel)pinned=undefined;
      const item=panel.conversationId&&tasks.get(panel.conversationId);
      if(item&&!item.turns.length&&![...panels.values()].some(other=>other.conversationId===item.id))tasks.remove(item.id);
      publish();
    });
    win.on('blur',()=>{if(panel.role==='temporary')setTimeout(()=>{if(!win.isDestroyed()&&!win.isFocused()&&panel.role==='temporary')destroy(panel)},120)});
    void win.loadFile(renderer).then(()=>{if(!win.isDestroyed())win.webContents.send('desk:state',snapshot(panel))}).catch(()=>{selectionStatus='界面加载失败，请重新启动拾句';destroy(panel)});
    return panel;
  }
  function show(panel:Panel,focus=true){
    if(panel.window.isDestroyed())return;
    place(panel);publish();
    void panel.window.webContents.executeJavaScript('document.readyState').catch(()=>{}).then(()=>{
      if(panel.window.isDestroyed())return;
      focus?panel.window.show():panel.window.showInactive();
    });
  }
  function showToolbar(){destroy(toolbar);toolbar=create('toolbar');place(toolbar);publish();
    toolbar.window.once('ready-to-show',()=>{if(toolbar&&!toolbar.window.isDestroyed())toolbar.window.showInactive()});
    setTimeout(()=>{if(toolbar&&!toolbar.window.isDestroyed()&&!toolbar.window.isVisible())toolbar.window.showInactive()},500);
  }
  function showTemporary(view:View,conversationId:string|null){
    destroy(toolbar);destroy(temporary);
    temporary=create('temporary');temporary.view=view;temporary.conversationId=conversationId;
    show(temporary);return temporary;
  }
  function accept(text:string,sourceApp:string,point?:{x:number;y:number}){
    const clean=text.trim();if(!clean||clean.length>100_000)return;
    const anchor=point||screen.getCursorScreenPoint();
    selection={selectionId:randomUUID(),text:clean,sourceApp,capturedAt:Date.now(),bounds:{x:anchor.x,y:anchor.y,width:1,height:1}};
    showToolbar();
  }
  async function copyShortcut(){const text=await clipboard.readText();
    if(!text.trim()){selectionStatus='剪贴板没有文字，请先复制再按快捷键';publish();return}
    accept(text,'手动复制',screen.getCursorScreenPoint());
  }
  function startHook(){
    try{
      hook=new SelectionHook();
      hook.on('text-selection',(event:TextSelectionData)=>{
        if(/^(electron|拾句|划词助手|selection desk)(\.exe)?$/i.test(event.programName))return;
        if([...panels.values()].some(panel=>panel.window.isFocused()))return;
        accept(event.text,event.programName||'未知应用',pointFrom(event));
      });
      hook.on('mouse-down',(event:MouseEventData)=>{
        if(event.button!==0)return;
        const point=screen.screenToDipPoint({x:event.x,y:event.y});
        for(const panel of [toolbar,temporary]){
          if(!panel||panel.window.isDestroyed()||!panel.window.isVisible())continue;
          const bounds=panel.window.getBounds();
          if(point.x<bounds.x||point.x>bounds.x+bounds.width||point.y<bounds.y||point.y>bounds.y+bounds.height)destroy(panel);
        }
      });
      hook.on('error',()=>{selectionStatus='自动取词异常；可以复制后按快捷键';publish()});
      const started=hook.start({enableClipboard:true,debug:false,enableMouseMoveEvent:false,
        globalFilterMode:SelectionHook.FilterMode.EXCLUDE_LIST,
        globalFilterList:['electron.exe','拾句.exe','划词助手.exe','Selection Desk.exe']});
      selectionStatus=started?'自动取词已启动；具体应用兼容性需要实测':'自动取词不可用；可以复制后按快捷键';
    }catch{selectionStatus='自动取词模块不可用；可以复制后按快捷键'}
    publish();
  }
  function run(id:string,question:string,action?:'translate'|'explain'|'polish',retry=false){
    const item=tasks.get(id);if(!item)throw Error('找不到这条问答');
    if(item.state==='running')throw Error('这条回答正在生成');
    if(!retry&&!question.trim()&&action!=='translate')throw Error('请输入问题');
    void tasks.send(id,question,action,retry).catch(error=>{connection=safeError(error);publish()});
  }
  function trusted(event:Electron.IpcMainInvokeEvent):Panel|undefined{
    const panel=panels.get(event.sender.id);
    return panel&&event.sender===panel.window.webContents&&event.senderFrame===event.sender.mainFrame&&event.senderFrame.url===rendererUrl?panel:undefined;
  }
  ipcMain.handle('desk:state',event=>{const panel=trusted(event);if(!panel)throw Error('UNAUTHORIZED');return snapshot(panel)});
  ipcMain.handle('desk:command',async(event,input:unknown):Promise<CommandResult>=>{
    const panel=trusted(event);if(!panel)return {ok:false,message:'未经授权的操作'};
    let command:AppCommand;
    try{command=parseCommand(input)}catch{return {ok:false,message:'输入无效，请重试'}}
    try{
      switch(command.type){
        case 'open':{
          if(!selection||Date.now()-selection.capturedAt>60_000)throw Error('选中文字已过期，请重新选取');
          const created=tasks.create(selection,command.action,targetLanguage(selection.text,preferences.targetLanguage));
          const destination=showTemporary('conversation',created.id);
          if(command.action==='translate')run(created.id,'','translate');
          destination.window.focus();break;
        }
        case 'send':run(command.conversationId,command.question);break;
        case 'quick':run(command.conversationId,command.action==='explain'?'请解释选中文字':'请润色选中文字',command.action);break;
        case 'draft':tasks.draft(command.conversationId,command.text);break;
        case 'stop':tasks.stop(command.conversationId);break;
        case 'retry':run(command.conversationId,'',undefined,true);break;
        case 'language':tasks.setLanguage(command.conversationId,command.language);break;
        case 'pin':{
          if(!tasks.get(command.conversationId))throw Error('找不到这条问答');
          if(panel===pinned){
            if(temporary&&temporary!==panel)destroy(temporary);
            pinned=undefined;temporary=panel;panel.role='temporary';
          }else{
            if(pinned&&pinned!==panel)destroy(pinned);
            if(temporary===panel)temporary=undefined;
            pinned=panel;panel.role='pinned';
          }
          publish();break;
        }
        case 'open-record':{
          if(!tasks.get(command.conversationId))throw Error('找不到这条记录');
          panel.view='conversation';panel.conversationId=command.conversationId;publish();break;
        }
        case 'delete-record':{
          tasks.remove(command.conversationId);
          for(const displayed of panels.values())if(displayed.conversationId===command.conversationId){displayed.conversationId=null;displayed.view='history'}
          publish();break;
        }
        case 'copy-answer': case 'copy-question':{
          const turn=tasks.get(command.conversationId)?.turns.find(turn=>turn.id===command.turnId);
          const text=command.type==='copy-question'?turn?.question:turn?.answer;
          if(!text)throw Error(command.type==='copy-question'?'暂无可复制的问题':'暂无可复制的回答');await clipboard.writeText(text);break;
        }
        case 'copy-original':{
          const text=panel.conversationId?tasks.get(panel.conversationId)?.selection.text:selection?.text;
          if(!text)throw Error('暂无可复制的原文');await clipboard.writeText(text);destroy(toolbar);break;
        }
        case 'close':destroy(panel);break;
        case 'history':{
          if(panel.role==='pinned')showTemporary('history',null);
          else{panel.previous=panel.view;panel.view='history';publish()}
          break;
        }
        case 'settings':{
          if(panel.role==='pinned')showTemporary('settings',null);
          else{panel.previous=panel.view;panel.view='settings';publish()}
          break;
        }
        case 'back':if(!panel.conversationId)destroy(panel);else{panel.view=panel.previous;publish()}break;
        case 'clear-history':tasks.clear();for(const displayed of panels.values())if(displayed.role!=='toolbar'){displayed.conversationId=null;displayed.view='history'}publish();break;
        case 'check-connection':{
          connection='正在检查 Codex 连接…';publish();
          const status=await codex.check();connection=status.connected?'Codex 已登录；回答服务在提问时验证':status.reason||'Codex 连接不可用';publish();break;
        }
        case 'test-api':{
          if(testProvider)throw Error('正在测试，请稍候');
          const entered=keyForAddress(command.apiBaseUrl,command.apiKey);
          const api=new ApiProvider({baseUrl:command.apiBaseUrl,model:command.apiModel,apiKey:entered},apiFetch);testProvider=api;
          connection='正在用公开短句测试回答…';publish();const began=Date.now();let first:number|undefined;
          try{await api.generate({conversationId:'public-api-test',requestId:randomUUID(),selection:{selectionId:'public',text:'The sky is blue.',sourceApp:'公开连接测试',capturedAt:Date.now()},action:'translate',targetLanguage:'中文',question:'',history:[]},new AbortController().signal,e=>{if(e.type==='delta')first??=Date.now()});
            connection=`测试通过，首字 ${((first!-began)/1000).toFixed(1)} 秒，总计 ${((Date.now()-began)/1000).toFixed(1)} 秒`;
          }catch(error){connection=apiErrorMessage(error instanceof Error?error.message:'')||(error instanceof Error&&error.message==='TIMEOUT'?'测试超时，请检查网络后重试':'测试未完成，请检查设置后重试');throw error}
          finally{await api.dispose();testProvider=undefined;publish()}
          return {ok:true,message:connection};
        }
        case 'clear-api-key':keyStore.clear();apiKey='';keyWarning='';connection='API Key 已清除';publish();return {ok:true,message:'API Key 已清除'};
        case 'save-settings':{
          const previous=preferences;
          const nextKey=keyForAddress(command.preferences.apiBaseUrl||DEFAULT_API_URL,command.apiKey);
          if(command.preferences.source==='api'){
            apiEndpoint(command.preferences.apiBaseUrl||DEFAULT_API_URL);
            if(!nextKey)throw Error('API_KEY_MISSING');
          }
          if(command.preferences.shortcut!==previous.shortcut&&!globalShortcut.register(command.preferences.shortcut,copyShortcut))throw Error('快捷键不可用，请换一个组合');
          try{
            if(command.apiKey)keyStore.save(nextKey);
            try{prefsStore.save(command.preferences)}catch(error){if(command.apiKey){if(apiKey)keyStore.save(apiKey);else keyStore.clear()}throw error}
          }catch(error){if(command.preferences.shortcut!==previous.shortcut)globalShortcut.unregister(command.preferences.shortcut);throw error}
          if(command.preferences.shortcut!==previous.shortcut)globalShortcut.unregister(previous.shortcut);
          preferences=command.preferences;codex.setCommand(preferences.codexPath);
          if(command.apiKey){apiKey=nextKey;keyWarning=''}
          connection='设置已保存，回答来源在下次请求时生效';
          if(app.isPackaged&&previous.startAtLogin!==preferences.startAtLogin)app.setLoginItemSettings({
            openAtLogin:preferences.startAtLogin,path:process.env.PORTABLE_EXECUTABLE_FILE||process.execPath,
          });
          publish();break;
        }
      }
      return {ok:true};
    }catch(error){return {ok:false,message:apiErrorMessage(error instanceof Error?error.message:'')||safeError(error)}}
  });
  tray=new Tray(appIcon.resize({width:24,height:24}));
  tray.setToolTip('拾句');
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'使用已复制文字',click:copyShortcut},
    {label:'恢复最近问答',click:()=>{
      const latest=tasks.list().find(item=>item.turns.length);
      showTemporary(latest?'conversation':'history',latest?.id||null);
    }},
    {label:'近期记录',click:()=>showTemporary('history',null)},
    {label:'设置',click:()=>showTemporary('settings',null)},
    {type:'separator'},
    {label:'退出',click:()=>app.quit()},
  ]));
  tray.on('click',()=>{
    const latest=tasks.list().find(item=>item.turns.length);
    showTemporary(latest?'conversation':'history',latest?.id||null);
  });
  app.on('second-instance',()=>showTemporary('history',null));
  app.on('window-all-closed',()=>{});
  const shortcutReady=globalShortcut.register(preferences.shortcut,copyShortcut);
  startHook();
  if(!shortcutReady){selectionStatus+='；快捷键被占用，请在设置中更换';publish()}
  if(!process.argv.includes('--background'))showTemporary(historyError?'settings':'history',null);
  app.on('before-quit',()=>{
    if(publishTimer)clearTimeout(publishTimer);if(saveTimer)clearTimeout(saveTimer);
    globalShortcut.unregisterAll();hook?.stop();hook?.cleanup();
    for(const panel of panels.values())destroy(panel);
    void tasks.dispose();void testProvider?.dispose();save();tray.destroy();
  });
}
