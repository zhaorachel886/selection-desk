import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import type HookType from 'selection-hook';
import { SelectionStore, ConsentBroker } from '../core/selection';
import { Conversations } from '../core/conversations';
import { startLocalServer } from '../server/http';
import { CodexProvider } from '../providers/codex';
import { ApiProvider } from '../providers/api';
import type { Action, AnswerProvider, AppState, ProviderId, Selection } from '../shared/types';
import { Preferences } from './preferences';
import { actionSchema } from './validation';

export async function launchDesktop(prefs: Preferences) {
  let win!: BrowserWindow;
  let tray: Tray;
  let quitting = false;
  let view: AppState['view'] = 'settings';
  let beforeConsent: AppState['view'] = 'toolbar';
  let hookStatus = '正在启动';
  let connectionStatus = '尚未检查回答来源';
  let hook: HookType | undefined;
  let windowReady: Promise<void>;
  let revealGeneration = 0;
  let publishTimer: ReturnType<typeof setTimeout> | undefined;
  const providers = new Map<ProviderId, AnswerProvider>();
  const store = new SelectionStore();
  const cwd = join(app.getPath('userData'), 'agent-sandbox');
  mkdirSync(cwd, { recursive: true });
  function provider(id: ProviderId) {
    let instance = providers.get(id);
    if (!instance) {
      const settings = prefs.settings();
      instance = id === 'codex' ? new CodexProvider({ command: settings.codexPath, cwd }) : new ApiProvider({ baseUrl: settings.apiBaseUrl, model: settings.apiModel, apiKey: prefs.apiKey() });
      providers.set(id, instance);
    }
    return instance;
  }
  const conversations = new Conversations(provider, publish);
  const broker = new ConsentBroker(store, () => {
    if (broker.list().length) {
      if (view !== 'consent') beforeConsent = view;
      view = 'consent'; reveal();
    } else if (view === 'consent') { view = beforeConsent; resize(); }
    publish();
  });
  function state(): AppState {
    return { selection: store.current(), pendingSelection: conversations.pending(), conversation: conversations.current(), shareRequests: broker.list(), settings: prefs.settings(), hasApiKey: !!prefs.apiKey(), hookStatus, connectionStatus, view };
  }
  function publish() {
    if (publishTimer || !win || win.isDestroyed()) return;
    publishTimer = setTimeout(() => { publishTimer = undefined; if (!win.isDestroyed()) win.webContents.send('desk:state', state()); }, 35);
  }
  function resize() {
    if (!win || win.isDestroyed()) return;
    const sizes = view === 'toolbar' ? [390, 104] : view === 'settings' ? [470, 670] : [440, 540];
    const area = screen.getDisplayMatching(win.getBounds()).workArea;
    win.setMinimumSize(320, view === 'toolbar' ? 100 : 300);
    win.setSize(Math.min(sizes[0], area.width), Math.min(sizes[1], area.height));
    const b = win.getBounds();
    win.setPosition(Math.max(area.x, Math.min(b.x, area.x + area.width - b.width)), Math.max(area.y, Math.min(b.y, area.y + area.height - b.height)));
  }
  function reveal(focus = false) {
    if (!win || win.isDestroyed()) createWindow();
    const target = win;
    const generation = ++revealGeneration;
    void windowReady.then(() => {
      if (generation !== revealGeneration || target.isDestroyed() || target !== win) return;
      resize(); publish(); focus ? target.show() : target.showInactive();
    }).catch(() => { connectionStatus = '浮窗加载失败，请从托盘重新打开。'; });
  }
  function show(nextView: AppState['view'], focus = false) {
    view = broker.list().length ? 'consent' : nextView;
    reveal(focus);
  }
  function accept(text: string, program: string, point?: Selection['point'], method?: string) {
    if (win && !win.isDestroyed() && win.isFocused() && method !== 'manual-clipboard') return;
    const selection = store.capture(text, program, prefs.settings().excludedApps, point, method);
    if (!selection) { if (!conversations.current()?.pinned) { conversations.clear(); revealGeneration++; if (win && !win.isDestroyed()) win.hide(); } publish(); return; }
    const pinned = conversations.current()?.pinned;
    conversations.select(selection, prefs.settings().provider);
    if (!pinned && view !== 'settings') {
      view = broker.list().length ? 'consent' : 'toolbar';
      const pos = point || screen.getCursorScreenPoint();
      if (!win || win.isDestroyed()) createWindow();
      win.setPosition(Math.round(pos.x + 8), Math.round(pos.y + 12)); reveal();
    }
    publish();
  }
  async function copyShortcut() {
    // Explicit user-copy fallback only; never simulate Ctrl+C here.
    try {
      const text = await clipboard.readText();
      if (!text.trim()) { connectionStatus = '请先复制文字，再按取词快捷键。'; show('settings'); return; }
      if (view === 'settings') view = 'toolbar';
      accept(text, '手动复制', screen.getCursorScreenPoint(), 'manual-clipboard');
    } catch { connectionStatus = '暂时无法读取剪贴板，请重新复制后重试。'; show('settings'); }
  }
  function startHook() {
    hook?.stop();
    try {
      const Hook = require('selection-hook') as typeof HookType;
      if (!hook) {
        hook = new Hook();
        hook.on('text-selection', (event: any) => {
          if (/^(Selection Desk|electron)(\.exe)?$/i.test(event.programName)) return;
          const raw = event.endBottom;
          const point = raw && Number.isFinite(raw.x) && Number.isFinite(raw.y) && raw.x !== -99999 && raw.y !== -99999 ? screen.screenToDipPoint(raw) : screen.getCursorScreenPoint();
          accept(event.text, event.programName || '未知应用', point, String(event.method));
        });
        hook.on('error', () => { hookStatus = '自动取词异常；可手动复制后按快捷键'; publish(); });
      }
      const settings = prefs.settings();
      const started = hook.start({ enableClipboard: settings.clipboardFallback, debug: false, enableMouseMoveEvent: false, globalFilterMode: Hook.FilterMode.EXCLUDE_LIST, globalFilterList: ['Selection Desk.exe', 'electron.exe', ...settings.excludedApps] });
      hookStatus = started ? '已启动（真实应用兼容性待验收）' : '自动取词不可用；请手动复制后按快捷键';
    } catch { hookStatus = '原生取词模块不可用；请手动复制后按快捷键'; }
    publish();
  }
  const renderer = join(__dirname, '../renderer/index.html');
  const rendererUrl = pathToFileURL(renderer).href;
  function dismiss() {
    revealGeneration++;
    conversations.clear(); store.clear(); broker.dispose(); view = 'toolbar';
    if (publishTimer) clearTimeout(publishTimer); publishTimer = undefined;
    if (win && !win.isDestroyed()) win.destroy();
  }
  function createWindow() {
    const created = new BrowserWindow({ width: 470, height: 670, minWidth: 320, minHeight: 300, frame: false, show: false, alwaysOnTop: true, skipTaskbar: true, backgroundColor: '#f7fafc', webPreferences: { preload: join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, devTools: !app.isPackaged } });
    win = created;
    created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    created.webContents.on('will-navigate', event => event.preventDefault());
    created.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    created.on('close', event => { if (!quitting) { event.preventDefault(); dismiss(); } });
    created.webContents.on('before-input-event', (_event, input) => { if (input.key === 'Escape' && input.type === 'keyDown') dismiss(); });
    windowReady = created.loadFile(renderer);
  }
  const trusted = (event: Electron.IpcMainInvokeEvent) => !!win && !win.isDestroyed() && event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === rendererUrl;
  ipcMain.handle('desk:state', event => { if (!trusted(event)) throw new Error('UNAUTHORIZED'); return state(); });
  ipcMain.handle('desk:action', async (event, input: unknown) => {
    if (!trusted(event)) return { ok: false, message: 'UNAUTHORIZED' };
    const parsed = actionSchema.safeParse(input);
    if (!parsed.success) return { ok: false, message: '请检查输入内容、程序名和服务地址。' };
    const action = parsed.data as Action;
    try {
      switch (action.type) {
        case 'translate': {
          const current = conversations.current();
          if (!current || !current.messages.length && Date.now() - current.selection.capturedAt >= 60_000) throw new Error('选区已过期，请重新选择文字。');
          if (current.status === 'running') throw new Error('请先停止当前回答。');
          show('conversation');
          const promise = conversations.ask(`请将所选原文翻译为${prefs.settings().targetLanguage}，保留代码、专有名词和原文格式。只输出译文。`);
          void promise.catch(error => { connectionStatus = error.message; publish(); }); break;
        }
        case 'open-question': show('conversation'); break;
        case 'ask': {
          if (!conversations.current()) throw new Error('请重新选择文字。');
          // Validation errors are reflected in IPC; provider failures are retained in conversation state.
          if (conversations.current()?.status === 'running') throw new Error('请先停止当前回答。');
          const current = conversations.current()!;
          if (!current.messages.length && Date.now() - current.selection.capturedAt >= 60_000) throw new Error('选区已过期，请重新选择文字。');
          show('conversation'); void conversations.ask(action.text).catch(error => { connectionStatus = error.message; publish(); }); break;
        }
        case 'stop': conversations.stop(); break;
        case 'retry': void conversations.retry(); break;
        case 'pin': conversations.pin(action.value); break;
        case 'use-pending': conversations.usePending(prefs.settings().provider); show('conversation'); break;
        case 'copy': await clipboard.writeText(action.text); break;
        case 'consent': broker.resolve(action.requestId, action.allow); break;
        case 'close': dismiss(); break;
        case 'settings': show('settings'); break;
        case 'back': show(conversations.current() ? 'conversation' : 'toolbar'); break;
        case 'clear-key': prefs.save(prefs.settings(), ''); providers.get('api')?.dispose(); providers.delete('api'); break;
        case 'check-provider':
          connectionStatus = '正在检查连接…'; publish();
          try { connectionStatus = await provider(prefs.settings().provider).check(); }
          catch (error) { connectionStatus = error instanceof Error ? error.message : '连接失败'; }
          publish(); break;
        case 'save-settings': {
          const old = prefs.settings();
          if (action.settings.provider === 'api' && !action.settings.apiModel.trim()) throw new Error('请填写模型名称。');
          if (old.shortcut !== action.settings.shortcut && !globalShortcut.register(action.settings.shortcut, copyShortcut)) throw new Error('快捷键不可用，请选择其他组合。');
          try { prefs.save(action.settings, action.apiKey); }
          catch (error) { if (old.shortcut !== action.settings.shortcut) globalShortcut.unregister(action.settings.shortcut); throw error; }
          if (old.shortcut !== action.settings.shortcut) globalShortcut.unregister(old.shortcut);
          const changedSource = old.provider !== action.settings.provider || old.codexPath !== action.settings.codexPath || old.apiBaseUrl !== action.settings.apiBaseUrl || old.apiModel !== action.settings.apiModel || action.apiKey !== undefined;
          if (changedSource) { conversations.clear(); store.clear(); } else conversations.stop();
          for (const instance of providers.values()) instance.dispose(); providers.clear();
          if (old.startAtLogin !== action.settings.startAtLogin) app.setLoginItemSettings({ openAtLogin: action.settings.startAtLogin });
          startHook(); connectionStatus = '设置已保存；来源变更从新选区会话生效'; publish();
          return { ok: true, message: '设置已保存。' };
        }
        case 'export-connector': {
          if (action.transport === 'stdio' && process.env.PORTABLE_EXECUTABLE_FILE) throw new Error('单文件便携版请导出本机 HTTP 配置；stdio 桥接请使用安装版。');
          const choice = await dialog.showSaveDialog(win, { title: '保存连接配置（请勿提交到公共仓库）', defaultPath: `selection-desk-${action.client}.${action.client === 'Codex' ? 'toml' : 'json'}`, filters: [{ name: '连接配置', extensions: [action.client === 'Codex' ? 'toml' : 'json'] }] });
          if (choice.canceled || !choice.filePath) return { ok: true };
          const token = prefs.token(action.client);
          const executable = process.execPath;
          const args = [join(app.getAppPath(), 'dist', 'bridge', 'cli.cjs')];
          const env = { ELECTRON_RUN_AS_NODE: '1', SELECTION_DESK_TOKEN: token };
          const config = action.transport === 'stdio' ? { command: executable, args, env } : { type: action.client === 'WorkBuddy' ? 'streamableHttp' : 'streamable-http', url: 'http://127.0.0.1:18765/mcp', headers: { Authorization: `Bearer ${token}` } };
          let content: string;
          if (action.client === 'Codex') {
            content = '[mcp_servers.selection_desk]\n' + (action.transport === 'stdio' ? `command = ${JSON.stringify(executable)}\nargs = ${JSON.stringify(args)}\nenv = { ELECTRON_RUN_AS_NODE = "1", SELECTION_DESK_TOKEN = "${token}" }\n` : `url = "http://127.0.0.1:18765/mcp"\nhttp_headers = { Authorization = "Bearer ${token}" }\n`);
          } else content = JSON.stringify({ mcpServers: { selection_desk: config } }, null, 2);
          writeFileSync(choice.filePath, content, { encoding: 'utf8', mode: 0o600 });
          return { ok: true, message: '连接配置已导出，包含本机访问凭据，请妥善保存。' };
        }
      }
      publish(); return { ok: true };
    } catch (error) { return { ok: false, message: error instanceof Error ? error.message : '操作失败，请重试。' }; }
  });
  const server = await startLocalServer({ port: 18765, authenticate: token => prefs.authenticate(token), broker });
  const pixels = Buffer.alloc(16 * 16 * 4);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const i = (y * 16 + x) * 4; const line = x > 3 && x < 12 && [4, 7, 10].includes(y); pixels.set(line ? [255, 255, 255, 255] : [22, 104, 116, 255], i); }
  tray = new Tray(nativeImage.createFromBitmap(pixels, { width: 16, height: 16 }));
  tray.setToolTip('Selection Desk · 划词助手');
  tray.setContextMenu(Menu.buildFromTemplate([{ label: '设置', click: () => show('settings', true) }, { label: '使用已复制的文字', click: copyShortcut }, { type: 'separator' }, { label: '退出', click: () => app.quit() }]));
  tray.on('click', () => show(conversations.current() ? 'conversation' : 'settings', true));
  app.on('second-instance', () => show('settings', true));
  app.on('window-all-closed', () => {});
  const openSettings = process.argv.includes('--settings') || !prefs.loaded && !process.argv.includes('--background');
  if (openSettings) { createWindow(); await windowReady!; if (!win.isDestroyed()) win.showInactive(); }
  else view = 'toolbar';
  if (!globalShortcut.register(prefs.settings().shortcut, copyShortcut)) { connectionStatus = '取词快捷键被占用，请在设置中更换。'; publish(); }
  startHook();
  const expiryTimer = setInterval(() => {
    conversations.pending();
    const current = conversations.current();
    if (!store.current() && current && !current.messages.length) { conversations.clear(); if (view === 'toolbar') { revealGeneration++; if (win && !win.isDestroyed()) win.hide(); } publish(); }
  }, 1000);
  app.on('before-quit', () => {
    quitting = true; clearInterval(expiryTimer); if (publishTimer) clearTimeout(publishTimer);
    globalShortcut.unregisterAll(); broker.dispose(); conversations.stop();
    for (const instance of providers.values()) instance.dispose();
    hook?.stop(); hook?.cleanup(); tray.destroy(); void server.close();
  });
}
