// Run after npm run build: node tests/renderer-consent.mjs
import { _electron as electron } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const fixture = resolve('.local/renderer-consent');
await mkdir(fixture, { recursive: true });
const state = {
  view: 'settings', settings: { provider: 'api', targetLanguage: '简体中文', clipboardFallback: false,
    shortcut: 'CommandOrControl+Shift+Space', excludedApps: [], startAtLogin: false,
    codexPath: 'codex', apiBaseUrl: 'https://example.invalid/v1', apiModel: 'test-model' },
  shareRequests: [], hasApiKey: false, hookStatus: 'fixture', connectionStatus: 'fixture'
};
await writeFile(resolve(fixture, 'preload.cjs'), `const {contextBridge}=require('electron');
let state=${JSON.stringify(state)}, listener; const actions=[];
contextBridge.exposeInMainWorld('desktop',{getState:async()=>state,onState:fn=>{listener=fn;return()=>{listener=undefined}},dispatch:async action=>{actions.push(action);return {ok:true}}});
contextBridge.exposeInMainWorld('fixture',{push:next=>{state=next;listener?.(next)},actions:()=>actions});`);
await writeFile(resolve(fixture, 'main.cjs'), `const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const win=new BrowserWindow({show:false,webPreferences:{preload:${JSON.stringify(resolve(fixture, 'preload.cjs'))},contextIsolation:true,nodeIntegration:false}});win.loadFile(${JSON.stringify(resolve('dist/renderer/index.html'))});});`);
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [resolve(fixture, 'main.cjs')], env });
try {
  const page = await app.firstWindow();
  await page.getByLabel('翻译目标语言').fill('English draft');
  await page.getByLabel('API 密钥', { exact: true }).fill('unsaved-fixture-secret');
  const consent = { ...state, view: 'consent', shareRequests: [{ id: 'one', client: 'Fixture client', selection: { id: 's', text: 'Exact shared text', program: 'Fixture', capturedAt: Date.now() }, expiresAt: Date.now() + 10000 }] };
  await page.evaluate(next => window.fixture.push(next), consent);
  await page.getByRole('heading', { name: '确认分享选区' }).waitFor();
  assert.equal(await page.getByLabel('API 密钥', { exact: true }).isVisible(), false);
  assert.equal(await page.locator('.settings').evaluate(form => getComputedStyle(form).display), 'none');
  await page.getByRole('button', { name: '拒绝', exact: true }).click();
  await page.evaluate(next => window.fixture.push(next), state);
  assert.equal(await page.getByLabel('翻译目标语言').inputValue(), 'English draft');
  assert.equal(await page.getByLabel('API 密钥', { exact: true }).inputValue(), 'unsaved-fixture-secret');
  const actions = await page.evaluate(() => window.fixture.actions());
  assert.deepEqual(actions, [{ type: 'consent', requestId: 'one', allow: false }]);
  console.log('PASS: consent preserves settings draft and key; hidden settings inaccessible; key never dispatched.');
} finally { await app.close(); }
