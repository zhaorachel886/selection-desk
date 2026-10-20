import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('dist/renderer', { recursive: true });
await build({ entryPoints: ['src/main/index.ts'], outfile: 'dist/main/index.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron', 'selection-hook'], sourcemap: true });
await build({ entryPoints: ['src/main/preload.ts'], outfile: 'dist/main/preload.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22', external: ['electron'] });
await build({ entryPoints: ['src/bridge/index.ts'], outfile: 'dist/bridge/index.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22' });
await build({ entryPoints: ['src/bridge/cli.ts'], outfile: 'dist/bridge/cli.cjs', bundle: true, platform: 'node', format: 'cjs', target: 'node22' });
await build({ entryPoints: ['src/renderer/index.tsx'], outfile: 'dist/renderer/app.js', bundle: true, platform: 'browser', format: 'iife', target: 'chrome130', minify: true, define: { 'process.env.NODE_ENV': '"production"' } });
await copyFile('src/renderer/index.html', 'dist/renderer/index.html');
