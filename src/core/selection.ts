import { randomUUID } from 'node:crypto';
import type { Selection, ShareRequest } from '../shared/types';

export class SelectionStore {
  private value?: Selection;
  constructor(private readonly now = Date.now) {}
  capture(text: string, program: string, excluded: string[] = [], point?: Selection['point'], method?: string): Selection | undefined {
    this.value = undefined;
    if (!text.trim() || text.length > 100_000 || excluded.some(x => x.trim() && program.toLowerCase().includes(x.trim().toLowerCase()))) return;
    this.value = { id: randomUUID(), text, program, capturedAt: this.now(), point, method };
    return structuredClone(this.value);
  }
  current(): Selection | undefined {
    if (this.value && this.now() - this.value.capturedAt >= 60_000) this.value = undefined;
    return this.value ? structuredClone(this.value) : undefined;
  }
  clear() { this.value = undefined; }
}

type Pending = { view: ShareRequest; finish: (error?: string) => void };
export class ConsentBroker {
  private requests = new Map<string, Pending>();
  constructor(private readonly store: SelectionStore, private readonly changed: () => void) {}
  list(): ShareRequest[] { return [...this.requests.values()].map(x => structuredClone(x.view)); }
  request(client: string, signal?: AbortSignal): Promise<Selection> {
    const selection = this.store.current();
    if (!selection) return Promise.reject(new Error('NO_SELECTION'));
    if (signal?.aborted) return Promise.reject(new Error('CANCELLED'));
    if (this.requests.size >= 8) return Promise.reject(new Error('TOO_MANY_REQUESTS'));
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const expiresAt = Math.min(selection.capturedAt + 60_000, Date.now() + 25_000);
      const cancel = () => finish('CANCELLED');
      const timer = setTimeout(() => finish('CONSENT_TIMEOUT'), Math.max(0, expiresAt - Date.now()));
      timer.unref();
      const finish = (error?: string) => {
        if (!this.requests.delete(id)) return;
        clearTimeout(timer); signal?.removeEventListener('abort', cancel);
        if (!error && (Date.now() >= expiresAt || this.store.current()?.id !== selection.id)) error = 'STALE_SELECTION';
        if (error) reject(new Error(error)); else resolve(structuredClone(selection));
        this.changed();
      };
      this.requests.set(id, { view: { id, client, selection, expiresAt }, finish });
      signal?.addEventListener('abort', cancel, { once: true });
      this.changed();
    });
  }
  resolve(id: string, allow: boolean) { this.requests.get(id)?.finish(allow ? undefined : 'SHARE_DENIED'); }
  dispose() { for (const request of [...this.requests.values()]) request.finish('CANCELLED'); }
}
