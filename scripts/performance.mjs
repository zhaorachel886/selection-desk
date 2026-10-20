import { _electron as electron } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
await mkdir('.local', { recursive: true });
const env = { ...process.env, SELECTION_DESK_DATA_DIR: resolve('.local/performance-profile') };
delete env.ELECTRON_RUN_AS_NODE;
const instance = await electron.launch({ args: ['.', '--background'], env, timeout: 30000 });
try {
  await instance.evaluate(({ app }) => app.whenReady());
  const samples = [];
  const duration = Number(process.env.SELECTION_DESK_PERF_SECONDS || 300);
  for (let second = 0; second <= duration; second += 10) {
    const processes = await instance.evaluate(({ app }) => app.getAppMetrics().map(p => ({ type: p.type, workingSetMB: Math.round(p.memory.workingSetSize / 1024), cpuPercent: p.cpu.percentCPUUsage })));
    const sample = { second, processes, workingSetMB: processes.reduce((sum, p) => sum + p.workingSetMB, 0), cpuPercent: processes.reduce((sum, p) => sum + p.cpuPercent, 0) };
    samples.push(sample);
    if (second % 60 === 0) console.log(JSON.stringify(sample));
    if (second < duration) await new Promise(resolve => setTimeout(resolve, 10000));
  }
  const settled = samples.slice(1);
  const result = { timestamp: new Date().toISOString(), durationSeconds: duration, measurement: 'Electron getAppMetrics; Playwright inspector attached; background launch without renderer; Codex not started', samples, meanCpuPercent: settled.reduce((s, x) => s + x.cpuPercent, 0) / settled.length, finalWorkingSetMB: samples.at(-1).workingSetMB };
  await writeFile('.local/performance-result.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ meanCpuPercent: result.meanCpuPercent, finalWorkingSetMB: result.finalWorkingSetMB }));
} finally { await instance.close(); }
