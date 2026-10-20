import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from '../server/http';

export async function runBridge(baseUrl: string, token: string) {
  const server = createMcpServer(async signal => {
    let response: Response;
    try {
      response = await fetch(baseUrl + '/v1/selection', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.any([AbortSignal.timeout(28_000), ...(signal ? [signal] : [])]), redirect: 'error' });
    } catch { throw new Error('DESKTOP_UNAVAILABLE: 请启动 Selection Desk，并在浮窗确认本次分享。'); }
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'SELECTION_UNAVAILABLE');
    return body;
  });
  await server.connect(new StdioServerTransport());
  return server;
}
