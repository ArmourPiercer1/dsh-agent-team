/* ROOT round-75 one-time NO-BOOT probe: resolve + load exports ONLY.
   Nothing is called: no launchChromium, no openBrowserWorker, no server,
   no worker, no browser. */
const L = '@deepseek-ai/dsh-experimental-browser-use-stagehand-native/src/launch.ts';
const W = '@deepseek-ai/dsh-experimental-browser-use-stagehand-native/src/worker-client.ts';
const l0 = import.meta.resolve(L);
const w0 = import.meta.resolve(W);
console.log('RESOLVE_LAUNCH=' + l0);
console.log('RESOLVE_WORKER=' + w0);
const lm = await import(L);
const wm = await import(W);
console.log('TYPE_launchChromium=' + typeof lm.launchChromium);
console.log('TYPE_openBrowserWorker=' + typeof wm.openBrowserWorker);
console.log('PROBE_DONE_NO_BOOT');
