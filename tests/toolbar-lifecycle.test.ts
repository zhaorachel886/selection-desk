import {EventEmitter} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';

const env=vi.hoisted(()=>({windows:[] as any[],hook:null as any,app:null as any,directory:''}));
vi.mock('selection-hook',async()=>{
  const {EventEmitter}=await import('node:events');
  class Hook extends EventEmitter{
    static INVALID_COORDINATE=-99999;static FilterMode={EXCLUDE_LIST:2};
    constructor(){super();env.hook=this;}start(){return true}stop(){}cleanup(){}
  }
  return{default:Hook};
});
vi.mock('electron',async()=>{
  const {EventEmitter}=await import('node:events');
  class Window extends EventEmitter{
    id:number;visible=false;destroyed=false;focused=false;bounds={x:0,y:0,width:226,height:40};
    webContents:any;showInactive=vi.fn(()=>{this.visible=true});hide=vi.fn(()=>{this.visible=false;this.focused=false});
    constructor(public options:any){super();this.id=env.windows.length+1;env.windows.push(this);this.bounds.width=options.width;this.bounds.height=options.height;
      this.webContents=Object.assign(new EventEmitter(),{id:this.id,setWindowOpenHandler:vi.fn(),session:{setPermissionRequestHandler:vi.fn()},send:vi.fn(),executeJavaScript:async()=> 'complete'});
    }
    isDestroyed(){return this.destroyed}isVisible(){return this.visible}isFocused(){return this.focused}
    destroy(){this.destroyed=true;this.visible=false;this.emit('closed')}
    finishLoad!:()=>void;
    loadFile=vi.fn(()=>new Promise<void>(resolve=>{this.finishLoad=resolve;}));setMinimumSize=vi.fn();setMaximumSize(){}setSize(){}setContentSize(w:number,h:number){this.bounds.width=w;this.bounds.height=h}
    setPosition(x:number,y:number){this.bounds.x=x;this.bounds.y=y}getBounds(){return this.bounds}
    getContentSize(){return[380,510]}show(){this.visible=true}focus(){this.focused=true}
  }
  class Tray{setToolTip(){}setContextMenu(){}on(){}destroy(){}}
  const app=Object.assign(new EventEmitter(),{getPath:()=>env.directory,isPackaged:false});env.app=app;
  return{app,BrowserWindow:Window,Tray,clipboard:{readText:()=>''},globalShortcut:{register:()=>true,unregister(){},unregisterAll(){}},ipcMain:{handle(){}},Menu:{buildFromTemplate:()=>[]},nativeImage:{createFromPath:()=>({isEmpty:()=>false,resize:()=>({})})},safeStorage:{},screen:{screenToDipPoint:(p:any)=>p,getCursorScreenPoint:()=>({x:600,y:400}),getDisplayNearestPoint:(p:any)=>({workArea:p.x<0?{x:-1200,y:0,width:1200,height:800}:{x:0,y:0,width:1920,height:1080}})},session:{defaultSession:{resolveProxy:async()=> 'DIRECT',fetch:vi.fn()}}};
});
import {launchDesktop} from '../src/main/desktop';
const select=(text='Public fixture',x=500)=>env.hook.emit('text-selection',{text,programName:'public-test.exe',posLevel:2,startTop:{x:0,y:0},endBottom:{x:0,y:0},mousePosEnd:{x,y:300}});
const toolbar=()=>env.windows.filter(w=>w.options.transparent);
beforeEach(()=>{vi.useFakeTimers();env.windows.length=0;env.directory=mkdtempSync(join(tmpdir(),'shiju-toolbar-'));env.app.removeAllListeners();});
afterEach(async()=>{env.app.emit('before-quit');await Promise.resolve();vi.clearAllTimers();vi.useRealTimers();rmSync(env.directory,{recursive:true,force:true});});
describe('native toolbar lifetime with isolated window doubles',()=>{
  it('preloads once, reuses the ready toolbar and places it near mouse-only selections',async()=>{
    await launchDesktop();expect(toolbar()).toHaveLength(1);const win=toolbar()[0];expect(win.visible).toBe(false);
    win.emit('ready-to-show');select();expect(win.showInactive).toHaveBeenCalledTimes(1);
    expect(win.bounds).toMatchObject({x:388,y:244});
    env.hook.emit('mouse-down',{button:0,x:100,y:100});expect(win.visible).toBe(false);expect(win.destroyed).toBe(false);
    select('Next public fixture',700);expect(toolbar()).toHaveLength(1);expect(win.loadFile).toHaveBeenCalledTimes(1);
    expect(win.showInactive).toHaveBeenCalledTimes(2);expect(win.bounds.x).toBe(588);
    await vi.advanceTimersByTimeAsync(1000);expect(win.showInactive).toHaveBeenCalledTimes(2);
  });
  it('never resurrects a dismissed toolbar when its first page finishes loading',async()=>{
    await launchDesktop();select();const win=toolbar()[0];
    env.hook.emit('mouse-down',{button:0,x:100,y:100});win.emit('ready-to-show');
    await vi.advanceTimersByTimeAsync(1000);expect(win.visible).toBe(false);expect(win.showInactive).not.toHaveBeenCalled();
  });
  it('uses the newest selection if several arrive while the toolbar is loading',async()=>{
    await launchDesktop();select('First',500);select('Second',800);expect(toolbar()).toHaveLength(1);
    const win=toolbar()[0];win.emit('ready-to-show');expect(win.bounds.x).toBe(688);expect(win.showInactive).toHaveBeenCalledTimes(1);
  });
  it('recreates an unusable toolbar after its renderer exits',async()=>{
    await launchDesktop();const previous=toolbar()[0];previous.emit('ready-to-show');select();
    previous.webContents.emit('render-process-gone',{}, {reason:'crashed'});expect(previous.destroyed).toBe(true);
    select('Recover at latest selection',900);expect(toolbar()).toHaveLength(2);
    const next=toolbar()[1];previous.emit('ready-to-show');expect(next.visible).toBe(false);
    next.emit('ready-to-show');expect(next.visible).toBe(true);expect(next.bounds.x).toBe(788);
  });
  it('reveals the toolbar when its page loads even if ready-to-show never arrives',async()=>{
    await launchDesktop();select();const win=toolbar()[0];expect(win.visible).toBe(false);
    win.finishLoad();await Promise.resolve();expect(win.visible).toBe(true);
    expect(win.showInactive).toHaveBeenCalledTimes(1);expect(win.bounds.x).toBe(388);
    win.emit('ready-to-show');expect(win.showInactive).toHaveBeenCalledTimes(1);
  });
  it('does not show after a delayed page load if the selection has been dismissed',async()=>{
    await launchDesktop();select();const win=toolbar()[0];env.hook.emit('mouse-down',{button:0,x:100,y:100});
    win.finishLoad();await Promise.resolve();expect(win.visible).toBe(false);expect(win.showInactive).not.toHaveBeenCalled();
  });
  it('uses transparent native backing and clears the default minimum before sizing toolbar content',async()=>{
    await launchDesktop();const win=toolbar()[0];win.finishLoad();await Promise.resolve();select();
    expect(win.options.backgroundColor).toBe('#00000000');expect(win.options.hasShadow).toBe(false);
    expect(win.options.useContentSize).toBe(true);expect(win.setMinimumSize).toHaveBeenCalledWith(1,1);
    expect(win.bounds.height).toBe(38);
  });
  it('keeps a cross-display selection on the display containing its final anchor',async()=>{
    await launchDesktop();const win=toolbar()[0];win.finishLoad();await Promise.resolve();
    env.hook.emit('text-selection',{text:'Public cross-display selection',programName:'public-test.exe',posLevel:3,startTop:{x:-400,y:100},endBottom:{x:400,y:200},mousePosEnd:{x:400,y:200}});
    expect(win.visible).toBe(true);expect(win.bounds.x).toBeGreaterThanOrEqual(8);
    expect(win.bounds.x+win.bounds.width).toBeLessThanOrEqual(1920-8);
  });
});
