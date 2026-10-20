import { describe, expect, it } from 'vitest';
import { SelectionStore, ConsentBroker } from '../src/core/selection';
import { Conversations } from '../src/core/conversations';
import type { AnswerProvider, AnswerRequest, Selection } from '../src/shared/types';

describe('selection lifecycle', () => {
  it('expires snapshots at 60 seconds and rejects empty or excluded captures', () => {
    let now = 1000;
    const store = new SelectionStore(() => now);
    expect(store.capture('hello', 'browser')?.text).toBe('hello');
    now = 61000;
    expect(store.current()).toBeUndefined();
    expect(store.capture(' ', 'browser')).toBeUndefined();
    expect(store.capture('private', 'KeePass.exe', ['keepass'])).toBeUndefined();
    expect(store.current()).toBeUndefined();
  });
  it('does not allow a consumer to change the cached snapshot', () => {
    const store = new SelectionStore();
    const item = store.capture('original', 'test')!;
    item.text = 'mutated';
    expect(store.current()?.text).toBe('original');
  });
});

describe('per-client sharing', () => {
  it('waits for consent and does not resolve another client request', async () => {
    const store = new SelectionStore(); store.capture('hello', 'test');
    const broker = new ConsentBroker(store, () => {});
    const a = broker.request('Codex'); const b = broker.request('WorkBuddy');
    expect(broker.list()).toHaveLength(2);
    const [first, second] = broker.list();
    broker.resolve(first.id, true);
    expect((await a).text).toBe('hello');
    expect(broker.list().map(x => x.id)).toEqual([second.id]);
    const rejected = expect(b).rejects.toThrow('SHARE_DENIED');
    broker.resolve(second.id, false); await rejected;
    broker.dispose();
  });
  it('never returns an old selection after it has been replaced', async () => {
    const store = new SelectionStore(); store.capture('first', 'test');
    const broker = new ConsentBroker(store, () => {});
    const result = broker.request('Codex');
    const rejected = expect(result).rejects.toThrow('STALE_SELECTION');
    store.capture('second', 'test');
    broker.resolve(broker.list()[0].id, true);
    await rejected; broker.dispose();
  });
  it('cleans an aborted sharing request', async () => {
    const store = new SelectionStore(); store.capture('first', 'test');
    const broker = new ConsentBroker(store, () => {});
    const abort = new AbortController();
    const result = broker.request('Codex', abort.signal);
    const rejected = expect(result).rejects.toThrow('CANCELLED');
    abort.abort(); await rejected;
    expect(broker.list()).toEqual([]); broker.dispose();
  });
});

describe('conversation isolation', () => {
  const selection = (id: string): Selection => ({ id, text: id, program: 'test', capturedAt: Date.now() });
  function setup() {
    const calls: AnswerRequest[] = [];
    const releases: (() => void)[] = [];
    const provider: AnswerProvider = { id: 'codex', check: async () => 'ok', dispose() {}, answer: async req => {
      calls.push(req); await new Promise<void>(resolve => releases.push(resolve));
    } };
    return { service: new Conversations(() => provider, () => {}), calls, releases };
  }
  it('ignores late streamed output after selection is changed', async () => {
    const { service, calls, releases } = setup();
    service.select(selection('one'), 'codex');
    const first = service.ask('question');
    service.select(selection('two'), 'codex');
    expect(calls[0].signal.aborted).toBe(true);
    calls[0].onEvent({ type: 'delta', text: 'late private answer' });
    releases[0](); await first;
    expect(service.current()?.selection.id).toBe('two');
    expect(service.current()?.messages).toEqual([]);
  });
  it('keeps pinned context and allows explicit switch to pending selection', () => {
    const { service } = setup();
    service.select(selection('one'), 'codex'); service.pin(true);
    service.select(selection('two'), 'codex');
    expect(service.current()?.selection.id).toBe('one');
    expect(service.pending()?.id).toBe('two');
    service.usePending('codex');
    expect(service.current()?.selection.id).toBe('two');
  });
  it('expires unbound pending text without deleting the pinned conversation', () => {
    const { service } = setup();
    service.select(selection('one'), 'codex'); service.pin(true);
    service.select({ ...selection('private pending'), capturedAt: Date.now() - 60_001 }, 'codex');
    expect(service.pending()).toBeUndefined();
    expect(service.current()?.selection.text).toBe('one');
  });
  it('retries without duplicating the user message and removes cancelled partial output from model context', async () => {
    const { service, calls, releases } = setup();
    service.select(selection('one'), 'codex');
    const first = service.ask('hello');
    calls[0].onEvent({ type: 'delta', text: 'partial' });
    service.stop(); releases[0](); await first;
    const retry = service.retry();
    expect(calls[1].messages).toEqual([{ role: 'user', content: 'hello' }]);
    calls[1].onEvent({ type: 'delta', text: 'complete' }); releases[1](); await retry;
    expect(service.current()?.messages).toEqual([{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'complete' }]);
  });
});
