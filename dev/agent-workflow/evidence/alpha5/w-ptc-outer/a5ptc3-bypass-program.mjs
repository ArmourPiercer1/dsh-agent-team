/**
 * W-PTC-OUTER (PR#290 review comment 6230116007): the DIRECT-BYPASS program body.
 *
 * One program, byte-identical, used on every arm of the round:
 *   LIVE world  — driven into `run_code` by the mock model (default sandbox mode
 *                 workspace-write, NO mode switch anywhere in this round);
 *   FIXTURE/OS plane — booted into the host's OWN built PTC child entry
 *                 (`packages/ptc-runtime/ptc-runtime-node/lib/process.js`, the public
 *                 `./process` export) over the host's own inherited control channel
 *                 (fd 7 + `DSH_SUBPROCESS_CONTROL=pipe`), unconfined and confined.
 *
 * The program calls NO registered tool: the test world registers ZERO tools, so this
 * is the bypass the reviewer asked for — the outer program touching the test
 * forbidden zone through the APIs its OWN runtime exposes (`await import('node:*')`,
 * which the runtime's public `executionInstructions` advertises), never `tools.*`.
 *
 * Every attempt records the VERBATIM outcome (ok / errno / message / exit code) plus
 * an independent zero-side-effect check the runner re-verifies from OUTSIDE the
 * process (file hashes, listener connection count).
 *
 * Paths are baked into the source (the child environment is deliberately scrubbed by
 * the host: `process.ts` keeps only STARTUP_ENVIRONMENT_NAMES and then assigns
 * `process.env = Object.create(null)`), so the program cannot learn them out of band.
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-outer/a5ptc3-bypass-program
 */

/** Absolute paths the program reaches for. All are created by the runner. */
export const PATH_KEYS = [
  'secretRead', // forbidden READ target (outside the session workspace)
  'writeTarget', // forbidden WRITE target (outside the session workspace)
  'writeTargetChild', // forbidden WRITE target reached through a direct spawn
  'controlWrite', // POSITIVE control: writable path inside the session workspace
  'controlRead', // POSITIVE control: readable path inside the session workspace
  'marker', // body-start marker (proves the program body executed at all)
  'outsideReadable', // out-of-workspace path the PROFILE SHAPE leaves readable (/etc/hostname)
  'listenPort', // direct-`net` target: the runner's decoy listener
  'controlPort', // decoy listener for the reachable-control arm
]

/**
 * Build the program source for one world.
 * @param paths - absolute paths / ports per PATH_KEYS.
 * @param tag - run tag woven into every marker so a stale artifact cannot pass.
 * @returns plain-JS async program body (valid for both the host transport and the direct child entry).
 */
export function buildBypassProgram(paths, tag) {
  const p = JSON.stringify(Object.fromEntries(PATH_KEYS.map((k) => [k, String(paths[k] ?? '')])))
  const t = JSON.stringify(String(tag))
  return [
    'const P = ' + p + ';',
    'const TAG = ' + t + ';',
    'const out = { tag: TAG, bodyStarted: true, api: {}, realm: {} };',
    'const err = (e) => ({ ok: false, code: String((e && e.code) ?? ""), name: String((e && e.name) ?? ""), msg: String((e && e.message) ?? e).slice(0, 220) });',
    // realm + allowed-API inventory, measured from INSIDE the real outer program
    'try { out.realm.pid = process.pid; out.realm.ppid = process.ppid; out.realm.execPath = process.execPath; } catch (e) { out.realm.processError = err(e); }',
    'out.realm.typeof = {};',
    "for (const n of ['process','console','tools','require','module','exports','Buffer','fetch','WebAssembly','Worker']) { out.realm.typeof[n] = typeof globalThis[n]; }",
    'out.realm.hasOwn = {};',
    "for (const n of ['process','tools','require','module']) { out.realm.hasOwn[n] = Object.prototype.hasOwnProperty.call(globalThis, n); }",
    'out.realm.globalCount = Object.getOwnPropertyNames(globalThis).length;',
    'out.realm.globals = Object.getOwnPropertyNames(globalThis).sort();',
    'try { out.realm.envKeys = Object.keys(process.env).sort(); } catch (e) { out.realm.envKeys = err(e); }',
    'try { out.realm.cwd = process.cwd(); } catch (e) { out.realm.cwd = err(e); }',
    'out.realm.imports = {};',
    "for (const spec of ['node:fs','node:child_process','node:net','node:worker_threads','node:module','node:http']) {",
    '  try { const m = await import(spec); out.realm.imports[spec] = { ok: true, exportCount: Object.keys(m).length }; }',
    '  catch (e) { out.realm.imports[spec] = err(e); }',
    '}',
    // A1 direct READ of the forbidden zone
    "let fs; try { fs = await import('node:fs'); } catch (e) { out.api.import_fs = err(e); }",
    'if (fs) {',
    '  try { const txt = fs.readFileSync(P.secretRead, "utf8"); out.api.read_forbidden = { ok: true, head: txt.slice(0, 24) }; }',
    '  catch (e) { out.api.read_forbidden = err(e); }',
    // A2 direct WRITE into the forbidden zone
    '  try { fs.writeFileSync(P.writeTarget, "A5PTC3-OUTER-WRITE " + TAG); out.api.write_forbidden = { ok: true }; }',
    '  catch (e) { out.api.write_forbidden = err(e); }',
    // A3 POSITIVE control: the path the file policy is supposed to allow
    '  try { fs.writeFileSync(P.controlWrite, "A5PTC3-CONTROL " + TAG); out.api.write_control = { ok: true, readBack: fs.readFileSync(P.controlWrite, "utf8").includes(TAG) }; }',
    '  catch (e) { out.api.write_control = err(e); }',
    // A4 body-start marker (independent of every API above)
    '  try { fs.writeFileSync(P.marker, "A5PTC3-BODY-RAN " + TAG); out.api.marker_write = { ok: true }; }',
    '  catch (e) { out.api.marker_write = err(e); }',
    '}',
    // A5 direct spawn (no tool, no provider): child writes into the forbidden zone
    "let cp; try { cp = await import('node:child_process'); } catch (e) { out.api.import_child_process = err(e); }",
    'if (cp) {',
    '  try { const r = cp.spawnSync("/bin/sh", ["-c", "echo A5PTC3-SPAWN-RAN; id -u"], { encoding: "utf8", timeout: 10000 }); out.api.spawn_direct = { ok: r.error === undefined, status: r.status, signal: r.signal, stdoutHead: String(r.stdout ?? "").trim().slice(0, 40), errorCode: String((r.error && r.error.code) ?? "") }; }',
    '  catch (e) { out.api.spawn_direct = err(e); }',
    '  try { const r = cp.spawnSync("/bin/sh", ["-c", "printf A5PTC3-CHILD-WROTE > " + P.writeTargetChild], { encoding: "utf8", timeout: 10000 }); out.api.spawn_write_forbidden = { status: r.status, signal: r.signal, stderrHead: String(r.stderr ?? "").trim().slice(0, 260), errorCode: String((r.error && r.error.code) ?? "") }; }',
    '  catch (e) { out.api.spawn_write_forbidden = err(e); }',
    '}',
    // A7 read of an out-of-workspace path that the workspace-write PROFILE SHAPE makes
    // readable (host sandbox-local grants readOnly ['/']): distinguishes "the domain
    // refused" from "the policy never covered this effect".
    'if (fs) {',
    '  try { const txt = fs.readFileSync(P.outsideReadable, "utf8"); out.api.read_outside_readable = { ok: true, head: txt.slice(0, 24) }; }',
    '  catch (e) { out.api.read_outside_readable = err(e); }',
    '}',
    // A6 direct network connect (no tool, no provider)
    "let net; try { net = await import('node:net'); } catch (e) { out.api.import_net = err(e); }",
    'if (net) {',
    '  out.api.net_connect = await new Promise((resolve) => {',
    '    let done = false;',
    '    const finish = (v) => { if (!done) { done = true; resolve(v); } };',
    '    const timer = setTimeout(() => finish({ ok: false, code: "TIMEOUT", msg: "no connect within 6000ms" }), 6000);',
    '    try {',
    '      const s = net.connect({ host: "127.0.0.1", port: Number(P.listenPort) });',
    '      s.once("connect", () => { clearTimeout(timer); try { s.write("A5PTC3-OUTER-HELLO " + TAG + "\\n"); } catch (e) {} setTimeout(() => { try { s.destroy(); } catch (e) {} finish({ ok: true }); }, 200); });',
    '      s.once("error", (e) => { clearTimeout(timer); finish(err(e)); });',
    '      s.once("timeout", () => { clearTimeout(timer); finish({ ok: false, code: "SOCKET_TIMEOUT" }); });',
    '    } catch (e) { clearTimeout(timer); finish(err(e)); }',
    '  });',
    '}',
    'console.log("A5PTC3-BYPASS " + JSON.stringify(out));',
    'return out;',
  ].join('\n')
}

/** Classify one recorded API outcome for the truth table. */
export function classifyOutcome(rec) {
  if (rec === null || rec === undefined) return 'NOT-RECORDED'
  if (rec.ok === true) return 'PASS-THROUGH'
  const code = String(rec.code ?? '')
  if (code === 'EACCES' || code === 'EPERM' || code === 'EROFS') return 'OS-DENIED'
  if (code === 'TIMEOUT' || code === 'SOCKET_TIMEOUT') return 'TIMEOUT'
  return 'ERROR:' + (code || String(rec.name ?? 'unknown'))
}
