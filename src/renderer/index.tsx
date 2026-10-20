import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Action, AppState, Settings } from '../shared/types';
import './style.css';

function App() {
  const [state, setState] = useState<AppState>();
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [question, setQuestion] = useState('');
  const composing = useRef(false);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const questionContext = state?.conversation?.id ?? state?.selection?.id;
  useEffect(() => { setQuestion(''); }, [questionContext]);
  useEffect(() => {
    let active = true;
    let received = false;
    const unsubscribe = window.desktop.onState(next => { received = true; if (active) setState(next); });
    window.desktop.getState().then(next => { if (active && !received) setState(next); }).catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; unsubscribe(); };
  }, []);
  useEffect(() => { messagesEnd.current?.scrollIntoView({ block: 'end' }); }, [state?.conversation?.messages]);
  async function act(action: Action) {
    setError(''); setNotice('');
    try {
      const result = await window.desktop.dispatch(action);
      if (!result.ok) { setError(result.message || '操作未完成，请重试。'); return false; }
      if (result.message) setNotice(result.message);
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return false; }
  }
  const conversation = state?.conversation;
  const running = conversation?.status === 'running';
  async function send() { const submitted = question; const text = submitted.trim(); if (text && !running && await act({ type: 'ask', text })) setQuestion(current => current === submitted ? '' : current); }
  return <main className={state?.view === 'toolbar' ? 'shell compact' : 'shell'}>
    <header className="titlebar"><span className="brand"><span className="mark" aria-hidden="true">▥</span> Selection Desk</span><nav aria-label="窗口操作">
      {conversation && state?.view === 'conversation' && <button aria-pressed={conversation.pinned} title="固定当前会话" onClick={() => void act({ type: 'pin', value: !conversation.pinned })}>{conversation.pinned ? '已固定' : '固定'}</button>}
      {state?.view !== 'settings' && <button title="设置" onClick={() => void act({ type: 'settings' })}>设置</button>}
      {state?.view === 'settings' && <button title="返回会话或选区" onClick={() => void act({ type: 'back' })}>返回</button>}
      <button aria-label="关闭浮窗" title="关闭浮窗" onClick={() => void act({ type: 'close' })}>×</button>
    </nav></header>
    {error && <div className="alert error" role="alert">{error}</div>}
    {notice && <div className="alert" role="status">{notice}</div>}
    {!state && <p className="empty">{error ? '无法加载，请重新打开浮窗。' : '正在连接桌面服务…'}</p>}
    {state?.view === 'toolbar' && <section className="toolbar" aria-label="选区操作"><button className="primary" disabled={!state.selection} onClick={() => void act({ type: 'translate' })}>翻译</button><button disabled={!state.selection} onClick={() => void act({ type: 'open-question' })}>提问</button><span className="selection-hint" title={state.selection?.program}>{state.selection ? `${state.selection.text.length} 字 · ${state.selection.program || '当前选区'}` : '选中文字后开始'}</span></section>}
    {state?.view === 'conversation' && <>
      <div className="context-row"><span>{conversation?.provider === 'api' ? '模型 API' : 'Codex'}<span className="dot">·</span>{state.settings.targetLanguage}</span><span>{running ? '正在生成' : '本地会话'}</span></div>
      {(conversation?.selection || state.selection) && <details className="source"><summary>所选原文 <span>{(conversation?.selection || state.selection)?.program}</span></summary><p>{(conversation?.selection || state.selection)?.text}</p></details>}
      {state.pendingSelection && <div className="pending"><span>已捕获新选区 · {state.pendingSelection.text.length} 字</span><button onClick={() => void act({ type: 'use-pending' })}>使用新选区</button></div>}
      <section className="messages" aria-label="对话记录" aria-busy={running}>
        {!conversation?.messages.length && <p className="empty">围绕选区提问，回答会显示在这里。</p>}
        {conversation?.messages.map((message, index) => <article className={`message ${message.role}`} key={index}><div className="message-label">{message.role === 'user' ? '你' : '回答'}{message.role === 'assistant' && message.content && <button aria-label="复制回答" onClick={() => void act({ type: 'copy', text: message.content })}>复制</button>}</div><p>{message.content || (running ? '正在准备回答…' : '暂无内容')}</p></article>)}
        {conversation?.error && <div className="alert error" role="alert">{conversation.error}</div>}
        {conversation?.status === 'cancelled' && <p className="status">已停止生成，可以继续提问。</p>}
        <div ref={messagesEnd} />
      </section>
      <form className="composer" onSubmit={event => { event.preventDefault(); void send(); }}><label className="sr-only" htmlFor="question">围绕选区提问</label><textarea id="question" placeholder="围绕选区提问…" value={question} onChange={event => setQuestion(event.target.value)} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && !composing.current && event.keyCode !== 229) { event.preventDefault(); void send(); } }} /><div className="composer-actions"><span>Enter 发送 · Shift + Enter 换行</span><div>{conversation && !running && (conversation.status === 'error' || conversation.status === 'cancelled') && <button type="button" onClick={() => void act({ type: 'retry' })}>重试</button>}{running ? <button type="button" onClick={() => void act({ type: 'stop' })}>停止</button> : <button className="primary" disabled={!question.trim()} type="submit">发送</button>}</div></div></form>
    </>}
    {state && (state.view === 'settings' || state.view === 'consent') && <SettingsPanel state={state} act={act} hidden={state.view !== 'settings'} />}
    {state?.view === 'consent' && <section className="consent"><h1>确认分享选区</h1>{state.shareRequests.length === 0 && <p>当前没有待确认的请求。</p>}{state.shareRequests.map(request => <article key={request.id}><h2>{request.client}</h2><p>请求读取以下原文，仅授权本次请求。</p><pre className="consent-text">{request.selection.text}</pre><div className="consent-actions"><button onClick={() => void act({ type: 'consent', requestId: request.id, allow: false })}>拒绝</button><button className="primary" onClick={() => void act({ type: 'consent', requestId: request.id, allow: true })}>允许本次读取</button></div></article>)}</section>}
  </main>;
}

function SettingsPanel({ state, act, hidden }: { state: AppState; act: (action: Action) => Promise<boolean>; hidden: boolean }) {
  const [draft, setDraft] = useState<Settings>(state.settings);
  const [key, setKey] = useState('');
  const [transport, setTransport] = useState<'http' | 'stdio'>('http');
  function field<K extends keyof Settings>(name: K, value: Settings[K]) { setDraft(current => ({ ...current, [name]: value })); }
  return <form className="settings" hidden={hidden} onSubmit={event => { event.preventDefault(); const settings = { ...draft, excludedApps: draft.excludedApps.map(app => app.trim()).filter(Boolean) }; void act({ type: 'save-settings', settings, ...(key.trim() ? { apiKey: key.trim() } : {}) }).then(ok => { if (ok) setKey(''); }); }}>
    <h1>设置</h1><fieldset><legend>回答来源</legend><label>来源<select value={draft.provider} onChange={event => field('provider', event.target.value as Settings['provider'])}><option value="codex">Codex</option><option value="api">OpenAI 兼容模型 API</option></select></label><label>翻译目标语言<input required value={draft.targetLanguage} onChange={event => field('targetLanguage', event.target.value)} /></label>
    {draft.provider === 'codex' ? <label>Codex 程序路径<input required value={draft.codexPath} onChange={event => field('codexPath', event.target.value)} spellCheck={false} /></label> : <><label>API 地址<input type="url" required value={draft.apiBaseUrl} onChange={event => field('apiBaseUrl', event.target.value)} spellCheck={false} /></label><label>模型名称<input required value={draft.apiModel} onChange={event => field('apiModel', event.target.value)} spellCheck={false} /></label><label>API 密钥<input type="password" autoComplete="new-password" value={key} placeholder={state.hasApiKey ? '已保存，留空保留' : '输入密钥'} onChange={event => setKey(event.target.value)} /></label>{state.hasApiKey && <button type="button" onClick={() => void act({ type: 'clear-key' })}>清除已保存的密钥</button>}</>}
    <div className="setting-actions"><button className="primary" type="submit">保存设置</button><button type="button" onClick={() => void act({ type: 'check-provider' })}>检查已保存的来源</button></div><p className="status" role="status">{state.connectionStatus}</p></fieldset>
    <fieldset><legend>取词与窗口</legend><label>取词快捷键<input required value={draft.shortcut} onChange={event => field('shortcut', event.target.value)} spellCheck={false} /></label><label>排除的程序（每行一个）<textarea value={draft.excludedApps.join('\n')} onChange={event => field('excludedApps', event.target.value.split('\n'))} placeholder="例如 password-manager.exe" /></label><label className="check"><input type="checkbox" checked={draft.clipboardFallback} onChange={event => field('clipboardFallback', event.target.checked)} />允许剪贴板后备取词</label><p className="hint">可能暂时读写剪贴板；优先使用直接取词。</p><label className="check"><input type="checkbox" checked={draft.startAtLogin} onChange={event => field('startAtLogin', event.target.checked)} />开机启动</label><p className="status">取词状态：{state.hookStatus}</p></fieldset>
    <fieldset><legend>连接其他客户端</legend><p className="hint">导出连接配置。客户端读取选区时，每次都需在浮窗确认。</p><label>连接方式<select value={transport} onChange={event => setTransport(event.target.value as 'http' | 'stdio')}><option value="http">本机 HTTP</option><option value="stdio">stdio 桥接</option></select></label><div className="connector-buttons">{(['Codex', 'WorkBuddy', '千问办公'] as const).map(client => <button key={client} type="button" onClick={() => void act({ type: 'export-connector', client, transport })}>导出 {client}</button>)}</div></fieldset>
    <div className="settings-footer"><button className="primary" type="submit">保存设置</button><span>选区仅在内存中保留 60 秒</span></div>
  </form>;
}
createRoot(document.getElementById('root')!).render(<App />);
