import { afterEach, expect, it } from 'vitest';
import { request } from 'node:http';
import { startLocalServer } from '../src/server/http';
import { SelectionStore, ConsentBroker } from '../src/core/selection';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const closers: (() => Promise<void> | void)[] = [];
afterEach(async () => { for (const close of closers.splice(0).reverse()) await close(); });
async function setup() {
  const store = new SelectionStore(); store.capture('authorized words', 'test');
  const broker = new ConsentBroker(store, () => {});
  const server = await startLocalServer({ port: 0, authenticate: token => token === 'a'.repeat(64) ? 'Codex' : token === 'b'.repeat(64) ? 'WorkBuddy' : undefined, broker });
  closers.push(() => server.close(), () => broker.dispose());
  return { url: `http://127.0.0.1:${server.port}`, broker };
}
async function until(fn: () => boolean) { for (let i = 0; i < 100 && !fn(); i++) await new Promise(resolve => setTimeout(resolve, 5)); expect(fn()).toBe(true); }
it('rejects unauthenticated callers, cross-origin web requests, and forged hosts', async () => {
  const { url } = await setup();
  expect((await fetch(url + '/health')).status).toBe(401);
  expect((await fetch(url + '/health', { headers: { Authorization: 'Bearer ' + 'a'.repeat(64), Origin: 'https://hostile.example' } })).status).toBe(403);
  const status = await new Promise<number | undefined>(resolve => {
    const req = request(url + '/health', { headers: { Authorization: 'Bearer ' + 'a'.repeat(64), Host: 'hostile.example' } }, response => { response.resume(); resolve(response.statusCode); });
    req.end();
  });
  expect(status).toBe(403);
});
it('returns only the specifically approved snapshot through authenticated HTTP', async () => {
  const { url, broker } = await setup();
  const response = fetch(url + '/v1/selection', { method: 'POST', headers: { Authorization: 'Bearer ' + 'a'.repeat(64) } });
  await until(() => broker.list().length === 1);
  expect(broker.list()[0].client).toBe('Codex');
  broker.resolve(broker.list()[0].id, true);
  expect((await (await response).json()).text).toBe('authorized words');
});
it('serves independent MCP clients with a real SDK handshake and consent denial', async () => {
  const { url, broker } = await setup();
  const a = new Client({ name: 'untrusted-display-name', version: '1' });
  const b = new Client({ name: 'other', version: '1' });
  await a.connect(new StreamableHTTPClientTransport(new URL(url + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + 'a'.repeat(64) } } }));
  await b.connect(new StreamableHTTPClientTransport(new URL(url + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + 'b'.repeat(64) } } }));
  closers.push(() => a.close(), () => b.close());
  expect((await a.listTools()).tools.map(t => t.name)).toEqual(['get_selection']);
  const first = a.callTool({ name: 'get_selection', arguments: {} });
  const second = b.callTool({ name: 'get_selection', arguments: {} });
  await until(() => broker.list().length === 2);
  const ar = broker.list().find(x => x.client === 'Codex')!;
  const br = broker.list().find(x => x.client === 'WorkBuddy')!;
  broker.resolve(ar.id, true); broker.resolve(br.id, false);
  expect((await first).isError).not.toBe(true);
  const denied = await second;
  expect(denied.isError).toBe(true);
  expect(JSON.stringify(denied)).not.toContain('authorized words');
});
