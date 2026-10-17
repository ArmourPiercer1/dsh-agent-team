const P = {"secretRead":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-ptc-outer/tests/homes/a5ptc3-outer-2026-10-17T06-53-28Z/live-forbidden/secret.txt","writeTarget":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-ptc-outer/tests/homes/a5ptc3-outer-2026-10-17T06-53-28Z/live-forbidden/write-target.txt","writeTargetChild":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-ptc-outer/tests/homes/a5ptc3-outer-2026-10-17T06-53-28Z/live-forbidden/child-target.txt","controlWrite":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-ptc-outer/tests/homes/a5ptc3-outer-2026-10-17T06-53-28Z/ws/control-write.txt","controlRead":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-ptc-outer/tests/homes/a5ptc3-outer-2026-10-17T06-53-28Z/ws/control-read.txt","marker":"/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/alpha5-ptc-outer/tests/homes/a5ptc3-outer-2026-10-17T06-53-28Z/ws/body-marker.txt","outsideReadable":"/etc/hostname","listenPort":"41005","controlPort":"0"};
const TAG = "a5ptc3-outer-2026-10-17T06-53-28Z-legA";
const out = { tag: TAG, bodyStarted: true, api: {}, realm: {} };
const err = (e) => ({ ok: false, code: String((e && e.code) ?? ""), name: String((e && e.name) ?? ""), msg: String((e && e.message) ?? e).slice(0, 220) });
try { out.realm.pid = process.pid; out.realm.ppid = process.ppid; out.realm.execPath = process.execPath; } catch (e) { out.realm.processError = err(e); }
out.realm.typeof = {};
for (const n of ['process','console','tools','require','module','exports','Buffer','fetch','WebAssembly','Worker']) { out.realm.typeof[n] = typeof globalThis[n]; }
out.realm.hasOwn = {};
for (const n of ['process','tools','require','module']) { out.realm.hasOwn[n] = Object.prototype.hasOwnProperty.call(globalThis, n); }
out.realm.globalCount = Object.getOwnPropertyNames(globalThis).length;
out.realm.globals = Object.getOwnPropertyNames(globalThis).sort();
try { out.realm.envKeys = Object.keys(process.env).sort(); } catch (e) { out.realm.envKeys = err(e); }
try { out.realm.cwd = process.cwd(); } catch (e) { out.realm.cwd = err(e); }
out.realm.imports = {};
for (const spec of ['node:fs','node:child_process','node:net','node:worker_threads','node:module','node:http']) {
  try { const m = await import(spec); out.realm.imports[spec] = { ok: true, exportCount: Object.keys(m).length }; }
  catch (e) { out.realm.imports[spec] = err(e); }
}
let fs; try { fs = await import('node:fs'); } catch (e) { out.api.import_fs = err(e); }
if (fs) {
  try { const txt = fs.readFileSync(P.secretRead, "utf8"); out.api.read_forbidden = { ok: true, head: txt.slice(0, 24) }; }
  catch (e) { out.api.read_forbidden = err(e); }
  try { fs.writeFileSync(P.writeTarget, "A5PTC3-OUTER-WRITE " + TAG); out.api.write_forbidden = { ok: true }; }
  catch (e) { out.api.write_forbidden = err(e); }
  try { fs.writeFileSync(P.controlWrite, "A5PTC3-CONTROL " + TAG); out.api.write_control = { ok: true, readBack: fs.readFileSync(P.controlWrite, "utf8").includes(TAG) }; }
  catch (e) { out.api.write_control = err(e); }
  try { fs.writeFileSync(P.marker, "A5PTC3-BODY-RAN " + TAG); out.api.marker_write = { ok: true }; }
  catch (e) { out.api.marker_write = err(e); }
}
let cp; try { cp = await import('node:child_process'); } catch (e) { out.api.import_child_process = err(e); }
if (cp) {
  try { const r = cp.spawnSync("/bin/sh", ["-c", "echo A5PTC3-SPAWN-RAN; id -u"], { encoding: "utf8", timeout: 10000 }); out.api.spawn_direct = { ok: r.error === undefined, status: r.status, signal: r.signal, stdoutHead: String(r.stdout ?? "").trim().slice(0, 40), errorCode: String((r.error && r.error.code) ?? "") }; }
  catch (e) { out.api.spawn_direct = err(e); }
  try { const r = cp.spawnSync("/bin/sh", ["-c", "printf A5PTC3-CHILD-WROTE > " + P.writeTargetChild], { encoding: "utf8", timeout: 10000 }); out.api.spawn_write_forbidden = { status: r.status, signal: r.signal, stderrHead: String(r.stderr ?? "").trim().slice(0, 260), errorCode: String((r.error && r.error.code) ?? "") }; }
  catch (e) { out.api.spawn_write_forbidden = err(e); }
}
if (fs) {
  try { const txt = fs.readFileSync(P.outsideReadable, "utf8"); out.api.read_outside_readable = { ok: true, head: txt.slice(0, 24) }; }
  catch (e) { out.api.read_outside_readable = err(e); }
}
let net; try { net = await import('node:net'); } catch (e) { out.api.import_net = err(e); }
if (net) {
  out.api.net_connect = await new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const timer = setTimeout(() => finish({ ok: false, code: "TIMEOUT", msg: "no connect within 6000ms" }), 6000);
    try {
      const s = net.connect({ host: "127.0.0.1", port: Number(P.listenPort) });
      s.once("connect", () => { clearTimeout(timer); try { s.write("A5PTC3-OUTER-HELLO " + TAG + "\n"); } catch (e) {} setTimeout(() => { try { s.destroy(); } catch (e) {} finish({ ok: true }); }, 200); });
      s.once("error", (e) => { clearTimeout(timer); finish(err(e)); });
      s.once("timeout", () => { clearTimeout(timer); finish({ ok: false, code: "SOCKET_TIMEOUT" }); });
    } catch (e) { clearTimeout(timer); finish(err(e)); }
  });
}
console.log("A5PTC3-BYPASS " + JSON.stringify(out));
return out;