import { runBridge } from './index';
const token = process.env.SELECTION_DESK_TOKEN || '';
const baseUrl = process.env.SELECTION_DESK_URL || 'http://127.0.0.1:18765';
if (!/^[a-f0-9]{64}$/.test(token) || baseUrl !== 'http://127.0.0.1:18765') {
  process.stderr.write('Export the Selection Desk stdio connector again from Settings.\n');
  process.exit(1);
}
runBridge(baseUrl, token).then(server => {
  process.stdin.on('end', () => { void server.close().finally(() => process.exit(0)); });
}).catch(() => {
  process.stderr.write('Selection Desk bridge could not start.\n');
  process.exit(1);
});
