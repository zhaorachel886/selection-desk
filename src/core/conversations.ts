import { randomUUID } from 'node:crypto';
import type { AnswerProvider, Conversation, ProviderId, Selection } from '../shared/types';

export class Conversations {
  private value?: Conversation;
  private next?: Selection;
  private active?: AbortController;
  private generation = 0;
  constructor(private readonly provider: (id: ProviderId) => AnswerProvider, private readonly changed: () => void) {}
  current(): Conversation | undefined { return this.value ? structuredClone(this.value) : undefined; }
  pending(): Selection | undefined {
    if (this.next && Date.now() - this.next.capturedAt >= 60_000) { this.next = undefined; this.changed(); }
    return this.next ? structuredClone(this.next) : undefined;
  }
  select(selection: Selection, provider: ProviderId) {
    if (this.value?.pinned) { this.next = selection; this.changed(); return; }
    this.stop(); this.next = undefined;
    this.value = { id: randomUUID(), selection: structuredClone(selection), messages: [], status: 'idle', pinned: false, provider };
    this.changed();
  }
  pin(pinned: boolean) { if (this.value) this.value.pinned = pinned; this.changed(); }
  usePending(provider: ProviderId) {
    if (!this.next) return;
    if (Date.now() - this.next.capturedAt >= 60_000) { this.next = undefined; this.changed(); throw new Error('新选区已过期，请重新选择。'); }
    const next = this.next; this.pin(false); this.select(next, provider);
  }
  clear() { this.stop(); this.value = undefined; this.next = undefined; this.changed(); }
  async ask(text: string) {
    if (!this.value) throw new Error('请先选择文字。');
    if (this.value.status === 'running') throw new Error('请先停止当前回答。');
    if (!text.trim() || text.length > 20_000) throw new Error('请输入不超过 20000 字的问题。');
    if (!this.value.messages.length && Date.now() - this.value.selection.capturedAt >= 60_000) throw new Error('选区已过期，请重新选择文字。');
    // Discard interrupted turns before a different question, so partial assistant output is never treated as completed context.
    if (this.value.status === 'error' || this.value.status === 'cancelled') this.removeLastTurn();
    this.value.messages.push({ role: 'user', content: text });
    await this.run();
  }
  async retry() {
    if (!this.value || !['error', 'cancelled'].includes(this.value.status)) return;
    if (this.value.messages.at(-1)?.role === 'assistant') this.value.messages.pop();
    await this.run();
  }
  private removeLastTurn() {
    if (!this.value) return;
    if (this.value.messages.at(-1)?.role === 'assistant') this.value.messages.pop();
    if (this.value.messages.at(-1)?.role === 'user') this.value.messages.pop();
  }
  private async run() {
    const value = this.value!;
    const messages = structuredClone(value.messages);
    value.messages.push({ role: 'assistant', content: '' });
    value.status = 'running'; value.error = undefined;
    const generation = ++this.generation;
    const controller = new AbortController(); this.active = controller;
    this.changed();
    try {
      await this.provider(value.provider).answer({ sessionId: value.id, selection: value.selection, messages, signal: controller.signal, onEvent: event => {
        if (generation !== this.generation || controller.signal.aborted) return;
        if (event.type === 'delta') value.messages[value.messages.length - 1].content += event.text;
        this.changed();
      } });
      if (generation !== this.generation) return;
      if (!value.messages.at(-1)?.content.trim()) throw new Error('服务没有返回回答，请重试。');
      value.status = 'idle';
    } catch (error) {
      if (generation !== this.generation) return;
      value.status = controller.signal.aborted ? 'cancelled' : 'error';
      value.error = error instanceof Error ? error.message : '回答失败，请检查连接后重试。';
    } finally {
      if (generation === this.generation) { this.active = undefined; this.changed(); }
    }
  }
  stop() {
    this.generation++; this.active?.abort(); this.active = undefined;
    if (this.value?.status === 'running') this.value.status = 'cancelled';
    this.changed();
  }
}
