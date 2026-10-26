import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal } from 'react-dom';
import type { AppCommand, AppSnapshot, CommandResult, Conversation, Preferences } from '../shared/types';
import { DEFAULT_API_URL,DEFAULT_API_MODEL } from '../shared/types';
import './styles.css';

type IconName = 'translate'|'spark'|'copy'|'pin'|'history'|'close'|'arrow'|'back'|'retry'|'edit'|'chevron'|'check'|'trash'|'settings';
const paths:Record<IconName,string> = {
 translate:'M3 5h10M8 3v2m3 0c0 6-3 8-7 10m1-7c1 3 4 6 7 7m2 5 4-11 4 11m-6-4h5',
 spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Zm7-1v4m-2-2h4',
 copy:'M9 8h10a1 1 0 0 1 1 1v11H8V9a1 1 0 0 1 1-1ZM16 8V3H3v14h5',
 pin:'M8 3h8l-1 7 3 3v2H6v-2l3-3-1-7Zm4 12v7',history:'M3 10a9 9 0 1 1 2 8M3 4v6h6m3-4v6l4 2',
 close:'m6 6 12 12M6 18 18 6',arrow:'M12 19V5m-6 6 6-6 6 6',back:'m14 6-6 6 6 6',
 retry:'M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5m-4 6a8 8 0 0 0 14 5l3-3m0 5v-5h-5',
 edit:'m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z',chevron:'m6 9 6 6 6-6',check:'m5 12 4 4L19 6',
 trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
 settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM10 2h4l1 3 3 1 3 2-1 4 1 4-3 2-3 1-1 3h-4l-1-3-3-1-3-2 1-4-1-4 3-2 3-1 1-3Z'
};
function Icon({name}:{name:IconName}) { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]}/></svg>; }
function IconButton({name,label,onClick,active=false,disabled=false}:{name:IconName;label:string;onClick:()=>void;active?:boolean;disabled?:boolean}) {
 return <button type="button" className={`iconbtn${active?' is-pinned':''}`} title={label} aria-label={label} aria-pressed={name==='pin'?active:undefined} disabled={disabled} onClick={onClick}><Icon name={name}/></button>;
}
type Send = (command:AppCommand)=>Promise<CommandResult>;

function Quote({text}:{text:string}) {
 const [expanded,setExpanded]=useState(false),[overflow,setOverflow]=useState(false);
 const el=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  const node=el.current;if(!node)return;
  const measure=()=>{if(!expanded)setOverflow(node.scrollHeight>node.clientHeight+1);};
  measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();
 },[text,expanded]);
 return <div className={`quote${expanded?' expanded':''}`}><div ref={el} className="quote-text">{text}</div>{(overflow||expanded)&&<button onClick={()=>setExpanded(!expanded)} aria-expanded={expanded}>{expanded?'收起':'展开'}</button>}</div>;
}

function LanguagePicker({conversation,send}:{conversation:Conversation;send:Send}) {
 const [position,setPosition]=useState<{left:number;top:number}|null>(null);
 const trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const choices=['中文','英文'] as const;
 const close=useCallback((focus=false)=>{setPosition(null);if(focus)trigger.current?.focus();},[]);
 const open=()=>{const box=trigger.current?.getBoundingClientRect();if(box)setPosition({left:Math.max(4,Math.min(box.left,innerWidth-132)),top:Math.max(4,Math.min(box.bottom+4,innerHeight-78))});};
 useEffect(()=>{
  if(!position)return;
  menu.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
  const outside=(e:PointerEvent)=>{if(!menu.current?.contains(e.target as Node)&&!trigger.current?.contains(e.target as Node))close();};
  const reposition=()=>close();
  document.addEventListener('pointerdown',outside);window.addEventListener('resize',reposition);document.addEventListener('scroll',reposition,true);
  return()=>{document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',reposition);document.removeEventListener('scroll',reposition,true);};
 },[position,close]);
 return <div className="language"><span>自动识别</span><span aria-hidden="true">→</span><button ref={trigger} className="language-trigger" aria-haspopup="menu" aria-expanded={!!position} onClick={()=>position?close():open()} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();open();}}}>{conversation.targetLanguage}<Icon name="chevron"/></button>
 {position&&createPortal(<div ref={menu} className="language-menu" role="menu" aria-label="目标语言" style={position} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close(true);return;}
  const buttons=Array.from(menu.current?.querySelectorAll('button')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
  if(e.key==='Tab')close();
 }}>{choices.map(language=><button key={language} role="menuitemradio" aria-checked={conversation.targetLanguage===language} onClick={()=>{close(true);if(language!==conversation.targetLanguage)void send({type:'language',conversationId:conversation.id,language});}}>{language}{language===conversation.targetLanguage&&<Icon name="check"/>}</button>)}</div>,document.body)}</div>;
}

function Composer({conversation,send}:{conversation:Conversation;send:Send}) {
 const [draft,setDraft]=useState(conversation.draft),[pending,setPending]=useState(false);
 const text=useRef<HTMLTextAreaElement>(null),composing=useRef(false),draftRef=useRef(draft);
 const running=conversation.state==='running';
 useLayoutEffect(()=>{const node=text.current;if(node){node.style.height='28px';node.style.height=`${Math.min(108,Math.max(28,node.scrollHeight))}px`;}},[draft]);
 const submit=async()=>{
  if(pending)return;
  if(running){setPending(true);await send({type:'stop',conversationId:conversation.id});setPending(false);return;}
  const question=draft.trim();if(!question||composing.current)return;
  const submitted=draft;setPending(true);
  const result=await send({type:'send',conversationId:conversation.id,question});
  if(result.ok&&draftRef.current===submitted){draftRef.current='';setDraft('');void send({type:'draft',conversationId:conversation.id,text:''});}
  setPending(false);
 };
 return <div className="composer-wrap"><div className="composer"><textarea ref={text} aria-label="问题或追问" placeholder={conversation.turns.length?'继续追问…':'输入问题…'} value={draft} rows={1} onChange={e=>{draftRef.current=e.target.value;setDraft(e.target.value);void send({type:'draft',conversationId:conversation.id,text:e.target.value});}} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!composing.current&&e.keyCode!==229){e.preventDefault();if(!running)void submit();}}}/><button className={`send-stop${running?' is-stop':''}`} aria-label={running?'停止生成':'发送问题'} title={running?'停止生成':'发送问题'} disabled={pending||(!running&&!draft.trim())} onClick={()=>void submit()}>{running?<span className="stop-square"/>:<Icon name="arrow"/>}</button></div></div>;
}

function ConversationView({conversation,send}:{conversation:Conversation;send:Send}) {
 const scroll=useRef<HTMLDivElement>(null),follow=useRef(true);
 const latest=conversation.turns.at(-1);
 useLayoutEffect(()=>{const node=scroll.current;if(node&&follow.current)node.scrollTop=node.scrollHeight;},[latest?.answer,conversation.turns.length]);
 return <><div ref={scroll} className="window-content" onScroll={()=>{const node=scroll.current;if(node)follow.current=node.scrollHeight-node.scrollTop-node.clientHeight<48;}}><Quote text={conversation.selection.text}/>
 {conversation.action==='translate'&&<LanguagePicker conversation={conversation} send={send}/>}
 {conversation.turns.length===0&&<div className="quick-actions"><button className="chip" onClick={()=>void send({type:'quick',conversationId:conversation.id,action:'explain'})}><Icon name="spark"/>解释</button><button className="chip" onClick={()=>void send({type:'quick',conversationId:conversation.id,action:'polish'})}><Icon name="edit"/>润色</button></div>}
 {conversation.turns.map((turn,index)=><section className="turn" key={turn.id} aria-label={`第 ${index+1} 次问答`}>
 {!!turn.question.trim()&&<div className="user-message"><span>{turn.question}</span><IconButton name="copy" label="复制问题" onClick={()=>void send({type:'copy-question',conversationId:conversation.id,turnId:turn.id})}/></div>}
 <div className={`assistant-text${turn.state==='running'?' streaming':''}`} aria-busy={turn.state==='running'} aria-label={turn.state==='running'&&!turn.answer?'正在生成':undefined}>{(turn.answer||'').split(/\n\s*\n/).map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div>
 {turn.state==='running'&&!turn.answer&&turn.progress?.includes('重连')&&<div className="detail-note" role="status">{turn.progress}</div>}
 {turn.state==='stopped'&&<div className="detail-note">已停止生成，已收到的内容已保留。</div>}
 {turn.state==='interrupted'&&<div className="error-box">上次生成因程序退出而中断，可重新生成。</div>}
 {turn.state==='error'&&<div className="error-box" role="alert">{turn.error||'生成失败，请检查 Codex 连接后重试。'}</div>}
 <div className="answer-actions">{turn.answer&&<IconButton name="copy" label={conversation.action==='translate'&&index===0?'复制译文':'复制回答'} onClick={()=>void send({type:'copy-answer',conversationId:conversation.id,turnId:turn.id})}/>}{index===conversation.turns.length-1&&turn.state!=='running'&&<IconButton name="retry" label={turn.state==='error'||turn.state==='interrupted'?'重试':'重新生成'} disabled={conversation.state==='running'} onClick={()=>void send({type:'retry',conversationId:conversation.id})}/>}</div>
 </section>)}
 </div><Composer conversation={conversation} send={send}/></>;
}

function relativeTime(time:number,now:number) { const seconds=Math.max(0,Math.floor((now-time)/1000));return seconds<60?'刚刚':seconds<3600?`${Math.floor(seconds/60)} 分钟前`:seconds<86400?`${Math.floor(seconds/3600)} 小时前`:seconds<604800?`${Math.floor(seconds/86400)} 天前`:new Date(time).toLocaleDateString('zh-CN',{month:'numeric',day:'numeric'}); }
type Confirmation={text:string;command:AppCommand};
function Confirm({value,onCancel,onConfirm}:{value:Confirmation;onCancel:()=>void;onConfirm:()=>void}) {
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{dialog.current?.showModal();},[]);
 return <dialog ref={dialog} onCancel={e=>{e.preventDefault();onCancel();}}><div className="confirm-body">{value.text}</div><div className="confirm-actions"><button className="outline" autoFocus onClick={onCancel}>取消</button><button className="danger" onClick={onConfirm}>确认删除</button></div></dialog>;
}
function History({snapshot,send,confirm}:{snapshot:AppSnapshot;send:Send;confirm:(v:Confirmation)=>void}) {
 const [now,setNow]=useState(Date.now());useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 const records=snapshot.conversations.filter(c=>c.turns.length).sort((a,b)=>b.updatedAt-a.updatedAt);
 return <><div className="history-list">{!records.length&&<div className="empty">暂无近期记录</div>}{records.map(c=>{const title=c.turns[0]?.question&&c.action==='ask'?c.turns[0].question:c.selection.text;return <div className="history-row" key={c.id}><button className="history-open" onClick={()=>void send({type:'open-record',conversationId:c.id})}><span className="history-title" title={title}>{title}</span><time className="history-time" dateTime={new Date(c.updatedAt).toISOString()} title={new Date(c.updatedAt).toLocaleString('zh-CN')}>{relativeTime(c.updatedAt,now)}</time></button><IconButton name="trash" label="删除这条记录" onClick={()=>{const command:AppCommand={type:'delete-record',conversationId:c.id};if(c.state==='running')confirm({text:'这条记录正在生成。删除将停止该任务，并移除本工具中的这条记录。',command});else void send(command);}}/></div>;})}</div><div className="history-bottom"><span>{records.length} / 100</span><button disabled={!records.length} onClick={()=>confirm({text:records.some(c=>c.state==='running')?'清空本工具的全部记录？正在生成的任务将停止。此操作不影响 Codex 已有聊天。':'清空本工具的全部记录？此操作不影响 Codex 已有聊天。',command:{type:'clear-history'}})}>清空记录</button></div></>;
}

function Settings({snapshot,send}:{snapshot:AppSnapshot;send:Send}) {
 const [form,setForm]=useState<Preferences>({source:'codex',apiBaseUrl:DEFAULT_API_URL,apiModel:DEFAULT_API_MODEL,...snapshot.preferences}),[busy,setBusy]=useState(false),[checking,setChecking]=useState(false),[keyText,setKeyText]=useState('');
 const update=<K extends keyof Preferences>(key:K,value:Preferences[K])=>setForm(previous=>({...previous,[key]:value}));
 const save=async()=>{setBusy(true);const result=await send({type:'save-settings',preferences:form,...(keyText.trim()?{apiKey:keyText.trim()}:{})});if(result.ok)setKeyText('');setBusy(false);};
 const check=async()=>{setChecking(true);await send(form.source==='api'?{type:'test-api',apiBaseUrl:form.apiBaseUrl||DEFAULT_API_URL,apiModel:form.apiModel||DEFAULT_API_MODEL,...(keyText.trim()?{apiKey:keyText.trim()}:{})}:{type:'check-connection'});setChecking(false);};
 return <form className="settings-form" onSubmit={e=>{e.preventDefault();void save();}}><div className="settings-body"><section className="setting-section"><h2 className="setting-label">回答来源</h2>
 <label className="setting-row">使用来源<select aria-label="回答来源" value={form.source} disabled={checking||busy} onChange={e=>update('source',e.target.value as Preferences['source'])}><option value="codex">Codex</option><option value="api">智谱／兼容 API</option></select></label>
 {form.source==='api'?<>
 <label className="stacked-field">API 地址<input type="url" required value={form.apiBaseUrl} disabled={checking||busy} onChange={e=>update('apiBaseUrl',e.target.value)} spellCheck={false}/></label>
 <p className="setting-help">已预填智谱地址；填写基础地址即可，不必添加 chat/completions。</p>
 <label className="stacked-field">模型名称<input required value={form.apiModel} disabled={checking||busy} onChange={e=>update('apiModel',e.target.value)} spellCheck={false}/></label>
 <label className="stacked-field">API Key<input type="password" autoComplete="off" value={keyText} disabled={checking||busy} onChange={e=>setKeyText(e.target.value)} placeholder={snapshot.hasApiKey?'已保存，留空保留':'输入 API Key'} spellCheck={false}/></label>
 <div className="api-check-actions"><button className="outline" type="button" disabled={checking||busy} onClick={()=>void check()}>{checking?'测试中…':'测试回答'}</button>{snapshot.hasApiKey&&<button className="outline" type="button" disabled={checking||busy} onClick={async()=>{const result=await send({type:'clear-api-key'});if(result.ok)setKeyText('')}}>清除 Key</button>}</div>
 <p className="setting-help">测试会发送固定公开短句并显示耗时，不保存当前修改。Key 使用 Windows 本机加密保存。</p>
 </>:<>
 <button className="outline" type="button" disabled={checking||busy} onClick={()=>void check()}>{checking?'检查中…':'检查已保存的 Codex 登录'}</button>
 <details className="advanced-settings"><summary>程序路径（高级）</summary><label className="stacked-field">Codex 程序路径<input value={form.codexPath} disabled={checking||busy} onChange={e=>update('codexPath',e.target.value)} placeholder="自动查找 Codex" spellCheck={false}/></label><p className="setting-help">通常留空即可。修改路径后先保存，再检查登录。</p></details>
 </>}
 <p className="setting-help connection-note" role="status">{snapshot.connection||'尚未检查连接'}</p>
 </section><section className="setting-section"><h2 className="setting-label">翻译偏好</h2><label className="setting-row">默认目标语言<select value={form.targetLanguage} onChange={e=>update('targetLanguage',e.target.value as Preferences['targetLanguage'])}><option value="auto">自动（中英互译）</option><option value="中文">中文</option><option value="英文">英文</option></select></label></section><section className="setting-section"><h2 className="setting-label">使用偏好</h2><label className="setting-row">复制后调用快捷键<input className="shortcut" value={form.shortcut} onChange={e=>update('shortcut',e.target.value)} placeholder="Control+Alt+D" spellCheck={false}/></label><label className="setting-row">开机启动<input type="checkbox" checked={form.startAtLogin} onChange={e=>update('startAtLogin',e.target.checked)}/></label><p className="setting-help">自动取词失败时，先复制文字，再按快捷键调用。</p><p className="setting-help" role="status">{snapshot.selectionStatus||'取词服务状态尚未报告'}</p></section></div><div className="dialog-bottom"><span>设置保存在本机</span><button className="primary" disabled={busy||checking} type="submit">{busy?'保存中…':'保存设置'}</button></div></form>;
}

function App() {
 const [snapshot,setSnapshot]=useState<AppSnapshot|null>(null),[notice,setNotice]=useState(''),[confirmation,setConfirmation]=useState<Confirmation|null>(null);
 const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const showNotice=useCallback((message:string)=>{clearTimeout(timer.current);setNotice(message);timer.current=setTimeout(()=>setNotice(''),6500);},[]);
 useEffect(()=>{
  if(!window.desk){showNotice('桌面连接不可用，请通过拾句启动。');return;}
  let received=false,live=true;
  const unsubscribe=window.desk.onState(state=>{received=true;if(live)setSnapshot(state);});
  window.desk.getState().then(state=>{if(live&&!received)setSnapshot(state);}).catch(()=>showNotice('无法读取桌面状态，请重新启动拾句。'));
  return()=>{live=false;unsubscribe();clearTimeout(timer.current);};
 },[showNotice]);
 const send=useCallback<Send>(async command=>{
  try {const result=await window.desk.command(command);if(!result.ok)showNotice(result.message||'操作未完成，请重试。');else if(result.message)showNotice(result.message);else if(command.type==='copy-answer'||command.type==='copy-question'||command.type==='copy-original')showNotice('已复制');else if(command.type==='save-settings')showNotice('设置已保存');return result;}
  catch {const result={ok:false,message:'桌面连接中断，请重新启动拾句。'};showNotice(result.message);return result;}
 },[showNotice]);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!e.defaultPrevented&&!document.querySelector('[role="menu"]')&&!document.querySelector('dialog[open]'))void send({type:'close'});};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[send]);
 if(!snapshot)return <main className="panel"><p className="empty" role="status">{notice||'正在连接桌面服务…'}</p></main>;
 if(snapshot.view==='toolbar')return <div className="toolbar" role="toolbar" aria-label="划词操作">{notice?<button className="toolbar-notice" title={notice} onClick={()=>setNotice('')} role="status">{notice}</button>:<><button onClick={()=>void send({type:'open',action:'translate'})}><Icon name="translate"/>翻译</button><button onClick={()=>void send({type:'open',action:'ask'})}><Icon name="spark"/>问 AI</button><button onClick={()=>void send({type:'copy-original'})}><Icon name="copy"/>复制</button></>}</div>;
 const conversation=snapshot.conversations.find(c=>c.id===snapshot.conversationId);
 const title=snapshot.view==='history'?'近期记录':snapshot.view==='settings'?'设置':conversation?.action==='translate'?'翻译':'问 AI';
 return <main className={`panel view-${snapshot.view}`}><header className="window-head"><div className="window-title">{snapshot.view==='history'||snapshot.view==='settings'?<IconButton name="back" label="返回" onClick={()=>void send({type:'back'})}/>:<Icon name={conversation?.action==='translate'?'translate':'spark'}/>}<span>{title}</span></div><div className="window-actions">{snapshot.view==='conversation'&&<IconButton name="history" label="近期记录" onClick={()=>void send({type:'history'})}/>}<IconButton name="settings" label="设置" onClick={()=>void send({type:'settings'})}/>{conversation&&snapshot.view==='conversation'&&<IconButton name="pin" label={snapshot.pinnedId===conversation.id?'取消固定':'固定浮窗'} active={snapshot.pinnedId===conversation.id} onClick={()=>void send({type:'pin',conversationId:conversation.id})}/>}<IconButton name="close" label="收起窗口" onClick={()=>void send({type:'close'})}/></div></header>
 {snapshot.view==='conversation'&&(conversation?<ConversationView key={conversation.id} conversation={conversation} send={send}/>:<div className="empty">选中文字，或复制后按快捷键开始。</div>)}
 {snapshot.view==='history'&&<History snapshot={snapshot} send={send} confirm={setConfirmation}/>}
 {snapshot.view==='settings'&&<Settings snapshot={snapshot} send={send}/>}
 {notice&&<div className="notice" role="status"><span>{notice}</span><IconButton name="close" label="关闭提示" onClick={()=>setNotice('')}/></div>}
 {confirmation&&<Confirm value={confirmation} onCancel={()=>setConfirmation(null)} onConfirm={()=>{void send(confirmation.command);setConfirmation(null);}}/>}</main>;
}

createRoot(document.getElementById('root')!).render(<App/>);
