// Privacy-preserving feasibility probe: never prints selected text or key events.
const Hook = require('selection-hook');
const hook = new Hook();
const result = { platform: process.platform, arch: process.arch, nativeLoaded: true, started: false, selections: 0, methods: {}, durationMs: 5000 };
hook.on('text-selection', event => { result.selections++; result.methods[event.method] = (result.methods[event.method] || 0) + 1; });
hook.on('error', () => { result.nativeError = true; });
try { result.started = hook.start({ enableClipboard: false, debug: false, enableMouseMoveEvent: false }); }
catch { result.nativeError = true; }
setTimeout(() => { hook.stop(); hook.cleanup(); console.log(JSON.stringify(result, null, 2)); process.exitCode = result.started ? 0 : 1; }, result.durationMs);
