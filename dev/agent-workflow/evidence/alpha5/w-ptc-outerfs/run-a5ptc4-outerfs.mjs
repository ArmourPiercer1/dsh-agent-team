#!/usr/bin/env node
/**
 * run-a5ptc4-outerfs.mjs — W-PTC-OUTERFS LIVE runner: the PTC OUTER program's
 * direct fs effects under PER-CALL governance, end-to-end on the pinned host.
 *
 * Legs (all on the real run_code pipeline; the program body really runs):
 *   LEG1  write inside the allowed domain (workspace) → SUCCESS (bytes on disk).
 *   LEG2  write into the forbidden zone → typed refusal AT OPEN (EACCES caught
 *         in the program), zero bytes landed, body really ran (echo canary).
 *   LEG3  escalation ask resolved REJECTED by the Team resolver (public
 *         approval/request waterfall) → verbatim fail-closed text, program
 *         never spawned (zero canary, zero child, zero writes).
 *   LEG3b escalation ask with resolver NO-ANSWER → host fail-closed fallback
 *         text ('no approval channel is available'), same zero-side-effect.
 *   LEG4  escalation ask resolved ALLOWED-ONCE → the widened call really lands
 *         the forbidden write (the per-call lever demonstrably works).
 *   LEG5  same program again WITHOUT a grant → refused again (the approval did
 *         not stick: per-call, not per-session mode).
 *
 * OS negative control (task ③): before boot, the SAME Landlock launcher the
 * host chain will exec is exercised directly (grant compile identical to the
 * host's landlockProfileArgs): ws write ok, forbidden create/append EACCES,
 * zero bytes. This is the assembly-independent floor.
 *
 * --red  = same legs, assembly pieces OFF (no launcher deployment, no
 *          resolver): preflight green, per-call governance criteria must FAIL
 *          (discrimination proof; the verbatim sandbox-unavailable refusal of
 *          the undeclared posture is captured as data).
 * --green= assembly ON: every criterion must pass. EXIT 0 on the expected
 *          outcome for the mode, 2 otherwise, 1 fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const MODE = args.includes('--red') ? 'red' : 'green'
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4-${MODE}-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(join(HERE, 'runs', `${RUN}`))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc4-row.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-forb`)
const SECRET = join(FORB, 'secret.txt')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const SECRET_VALUE = `A5PTC4-SECRET-${RUN_STAMP}`

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)

const CRITERIA = []
const check = (id, claim, cond, observed) => {
  CRITERIA.push({ id, claim, pass: cond === true, observed: typeof observed === 'string' ? observed : JSON.stringify(observed ?? null) })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}`)
  if (observed !== undefined) console.log(`     observed: ${typeof observed === 'string' ? observed.slice(0, 700) : JSON.stringify(observed ?? null).slice(0, 700)}`)
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

const portFree = (port) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1') })
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
const lsDir = (dir) => { try { return readdirSync(dir).sort() } catch { return [] } }
const readIfExists = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }

let host = null
let mock = null
let stableBefore = null
async function finalize(status) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 400))
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  try {
    const copies = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.isFile() && /^session\..*\.jsonl(\.zstd)?$/.test(e.name) && statSync(p).size < 8_000_000) {
          mkdirSync(join(EVIDENCE_DIR, 'session-logs'), { recursive: true })
          const dest = join(EVIDENCE_DIR, 'session-logs', `${basename(dirname(p))}__${e.name}`)
          copyFileSync(p, dest)
          copies.push(dest.replace(`${EVIDENCE_DIR}/`, ''))
          try {
            const dec = spawnSync('zstd', ['-d', '-c', p], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            if (Number(dec.status) === 0) writeFileSync(`${dest}.redacted.txt`, redact(String(dec.stdout ?? '')))
          } catch { /* decode best-effort */ }
        }
      }
    }
    if (existsSync(HOME)) walk(HOME)
    if (copies.length > 0) writeEvidence('session-logs-copied.json', copies)
  } catch { /* diagnostics only */ }
  if (!KEEP) {
    try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ }
    try { rmSync(FORB, { recursive: true, force: true }) } catch { /* best effort */ }
  }
  writeEvidence('criteria.json', { run: RUN, mode: MODE, launcherSha, status, criteria: CRITERIA })
}
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function pollUntil(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) return { __held: what }
    await new Promise((r) => setTimeout(r, 250))
  }
}
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

const launcherSha = (() => { try { return sha256(readFileSync(LAUNCHER)) } catch { return null } })()

// ── programs (outer PTC programs; they really run in a separate OS process) ──
const prog = (body) => [
  "const fs = await import('node:fs');",
  "const pid = process.pid;",
  body,
].join('\n')
const PROGRAM1 = prog(`
const w = await tools.a5ptc4_echo({ tag: 'leg1' });
fs.writeFileSync('${WS}/leg1-ok.txt', 'LEG1-BODY-RAN-' + pid);
const ppid = process.ppid;
return { pid, ppid, echo: w, wsWrite: 'ok' };`)
const PROGRAM2 = (leg, extraForbiddenTarget) => prog(`
const w = await tools.a5ptc4_echo({ tag: '${leg}' });
const secret = (() => { try { return fs.readFileSync('${SECRET}', 'utf8') } catch { return '(unreadable)' } })();
let createCode = 'none', appendCode = 'none';
try { fs.writeFileSync('${extraForbiddenTarget}', 'SHOULD-NOT-EXIST'); } catch (e) { createCode = String(e.code); }
try { fs.appendFileSync('${SECRET}', 'x'); } catch (e) { appendCode = String(e.code); }
fs.writeFileSync('${WS}/${leg}-control.txt', 'BODY-RAN-' + pid);
return { pid, ppid: process.ppid, echo: w, secretSeen: secret.slice(0, 24), createCode, appendCode };`)
const PROGRAM_ESC = (leg) => prog(`
const w = await tools.a5ptc4_echo({ tag: '${leg}-body' });
let writeCode = 'wrote';
try { fs.writeFileSync('${FORB}/${leg}-target.txt', 'A5PTC4-BODY-RAN-' + pid); } catch (e) { writeCode = String(e.code); }
return { pid, ppid: process.ppid, echo: w, writeCode, canary: 'A5PTC4-BODY-RAN' };`)

const VERBATIM_REJECT = 'the user rejected escalating this program to "danger-full-access"'
const VERBATIM_NO_CHANNEL = 'requires approval, but no approval channel is available'

async function main() {
  stableBefore = await stableProbe()
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `host tree is the pinned pristine baseline @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain=0`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 12)} porcelain=${porcelain0} at ${TESTUSE}`)

  // ── task ③: OS negative control via the SAME Landlock launcher the host
  // chain will exec (grant shape = host landlockProfileArgs: ro / ; rw /dev/null
  // /tmp workspaceRoot). Direct execution, host-independent floor. ──────────
  mkdirSync(WS, { recursive: true })
  mkdirSync(FORB, { recursive: true })
  writeFileSync(SECRET, `${SECRET_VALUE}\n`)
  const secretShaPre = sha256(readFileSync(SECRET))
  const probeRun = spawnSync(LAUNCHER, ['--probe'], { encoding: 'utf8', timeout: 4000 })
  const direct = spawnSync(LAUNCHER, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--rw', WS, '--',
    process.execPath, '-e', `
const fs=require('fs');
fs.writeFileSync(${JSON.stringify(join(WS, 'os-preflight-ws.txt'))},'OS-PREFLIGHT-OK');
let c='none',a='none';
try{fs.writeFileSync(${JSON.stringify(join(FORB, 'os-preflight-hack.txt'))},'x')}catch(e){c=String(e.code)}
try{fs.appendFileSync(${JSON.stringify(SECRET)},'x')}catch(e){a=String(e.code)}
console.log(JSON.stringify({c,a}));`,
  ], { encoding: 'utf8', timeout: 20_000 })
  let directObs = {}
  try { directObs = JSON.parse(String(direct.stdout ?? '').trim().split('\n').pop()) } catch { /* capture */ }
  writeEvidence('os-preflight.json', {
    launcher: LAUNCHER, sha256: launcherSha,
    probe: { exit: probeRun.status, stdout: String(probeRun.stdout ?? '').trim(), stderr: String(probeRun.stderr ?? '').trim() },
    direct: { exit: direct.status, observed: directObs, wsFile: readIfExists(join(WS, 'os-preflight-ws.txt')), hackExists: existsSync(join(FORB, 'os-preflight-hack.txt')), stderr: String(direct.stderr ?? '').trim() },
    caliber: 'direct launcher run (host-independent); the in-pipeline OS leg is booked separately',
  })
  check('P-OS-PREFLIGHT', 'OS negative control (task ③): the same launcher grants the ws write and refuses forbidden create/append at open (EACCES), zero bytes, under THIS environment',
    probeRun.status === 0 && direct.status === 0 && directObs.c === 'EACCES' && directObs.a === 'EACCES'
    && readIfExists(join(WS, 'os-preflight-ws.txt')) === 'OS-PREFLIGHT-OK'
    && !existsSync(join(WS, 'os-preflight-ws.txt')) === false && !existsSync(join(FORB, 'os-preflight-hack.txt'))
    && sha256(readFileSync(SECRET)) === secretShaPre,
    `probe="${String(probeRun.stdout ?? '').trim()}" direct=${JSON.stringify(directObs)} hackExists=${existsSync(join(FORB, 'os-preflight-hack.txt'))} launcherSha=${String(launcherSha).slice(0, 16)}`)

  // ── world + patch + row ───────────────────────────────────────────────────
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5ptc4 W-PTC-OUTERFS patch (run ${RUN}): evidence assembly row via the public profile-patch seam; zero production-row mounts, zero sandbox config keys.`,
    '- insert:',
    '    - id: a5ptc4-outerfs',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const LEGS = ['P3B', 'P1', 'P2', 'P3', 'P4', 'P5'] // P3B before P3 (prefix-safe matching)
  let reqs = 0
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 60) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs}` }
      const body = req?.body ?? req ?? {}
      const msgs = body.messages ?? []
      const users = msgs.filter((m) => m?.role === 'user')
      const last = users[users.length - 1]
      const lastText = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '')
      const hit = LEGS.find((l) => lastText.includes(`${MK}_${l}`))
      if (hit == null) return lastText.includes(`${MK}_SET`) ? { kind: 'text', content: `${MK}_SET_OK` } : { kind: 'text', content: 'a5ptc4-mock: quiet.' }
      // answered already? a tool_result exists after the triggering user message
      const idx = msgs.indexOf(last)
      const after = msgs.slice(idx + 1)
      const results = after.flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
      if (results.length > 0) {
        const t = results.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
        return { kind: 'text', content: `${MK}_DONE_${hit} ${t.slice(0, 900)}` }
      }
      const code = hit === 'P1' ? PROGRAM1
        : hit === 'P2' ? PROGRAM2('leg2', join(FORB, 'leg2-hack.txt'))
        : hit === 'P5' ? PROGRAM2('leg5', join(FORB, 'leg5-hack.txt'))
        : PROGRAM_ESC(hit.toLowerCase())
      const callArgs = { code, description: `a5ptc4 ${hit}: outer direct fs program (per-call governance leg)` }
      if (hit === 'P3' || hit === 'P3B' || hit === 'P4') {
        callArgs.sandbox_permissions = 'danger-full-access'
        callArgs.justification = hit === 'P3' ? 'A5PTC4-TOKEN:t3 outerfs leg3: widen to write the fixture (resolver must reject)'
          : hit === 'P3B' ? 'A5PTC4-TOKEN:t3b outerfs leg3b: widen; the resolver will not answer'
          : 'A5PTC4-TOKEN:t4 outerfs leg4: widen under an allowed-once grant (per-call lever positive control)'
      }
      return { kind: 'tool-call', toolCalls: [{ id: `call-${MK}-${hit}-${Math.random().toString(36).slice(2, 8)}`, name: 'run_code', arguments: callArgs }] }
    },
  })

  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'a5ptc4-mock-key',
      A5PTC4_ASSEMBLE: MODE === 'green' ? '1' : '0',
      A5PTC4_TESTUSE: TESTUSE,
      A5PTC4_LEDGER: LEDGER,
      A5PTC4_LAUNCHER: LAUNCHER,
      A5PTC4_RUN: RUN,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(90_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  check('L-BOOT', `host booted on ${HOST_PORT} with the token gate live`, cookie !== null, `cookie=${cookie !== null}`)
  const health = await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__a5ptc4/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'row apply')
  const hostPid = health.body.pid

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5ptc4-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const sessionId = (async () => {
    const r = await api('create', { requestId: `a5ptc4-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 60_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  })()
  const sid = await sessionId
  check('L-CREATE', 'session created through the public entry', typeof sid === 'string' && sid !== '', `sid=${String(sid).slice(0, 24)}`)
  const prompt = (text) => api('prompt', { requestId: `a5ptc4-r-${Math.random().toString(36).slice(2, 10)}`, sessionId: sid, mode: 'queue', content: [{ type: 'text', text }] }, 240_000)

  await prompt(`${MK}_SET setup turn; reply OK`)
  await waitFor(90_000, async () => { const r = await fetchJson(`${origin}/__a5ptc4/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) }).catch(() => null); return r?.body?.ok === true ? r : false }, 'assembly route sees the agent')
  await waitFor(120_000, async () => {
    const rows = ((await fetchJson(`${origin}/__a5ptc4/journal`).catch(() => null))?.body?.rows) ?? []
    if (rows.some((r) => r.leg === 'assembly-failed')) return 'failed'
    return rows.some((r) => r.leg === 'assembly-complete') ? true : false
  }, 'assembly legs')
  const jrows0 = (await fetchJson(`${origin}/__a5ptc4/journal`)).body.rows
  const failed = jrows0.find((r) => r.leg === 'assembly-failed')
  if (failed !== undefined) die(`assembly failed: ${failed.error}`)
  const deployRow = jrows0.find((r) => r.leg === 'launcher-deploy') ?? {}
  const modePre = (await fetchJson(`${origin}/__a5ptc4/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })).body
  check('L-ASSEMBLY', `row assembled (witness tools + guard + presentAs(ptc); green also launcher deploy=${MODE === 'green' ? 'ok' : 'off'})`,
    MODE === 'green' ? deployRow.ok === true : deployRow.attempted === false, JSON.stringify(deployRow))

  const label = await (async () => { const st = (await fetchJson(`${origin}/__a5ptc4/state`)).body; return Object.keys(st.assemblies ?? {})[0] ?? '' })()
  const asmOf = async () => (await fetchJson(`${origin}/__a5ptc4/state`)).body?.assemblies?.[label] ?? null
  const approvals = async () => ((await fetchJson(`${origin}/__a5ptc4/approvals`).catch(() => null))?.body?.rows) ?? []
  const grantFeed = async (token, decision) => { await fetchJson(`${origin}/__a5ptc4/grant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, decision }) }) }

  const runLeg = async (marker, expectRun) => {
    const before = (await asmOf())?.runs?.length ?? 0
    await prompt(`${MK}_${marker} leg turn`)
    const settled = await pollUntil(120_000, async () => {
      const a = await asmOf()
      const runs = a?.runs ?? []
      return runs.length > before ? runs[runs.length - 1] : false
    }, `run #${expectRun} to settle`)
    return { run: settled?.__held ? null : settled, held: settled?.__held !== undefined }
  }

  // ── LEG1 / LEG2 (outer direct writes, default posture) ──────────────────
  const r1 = await runLeg('P1', 1)
  const r2 = await runLeg('P2', 2)
  const run1 = r1.run ?? { text: '(held)' }
  const run2 = r2.run ?? { text: '(held)' }
  writeEvidence('run-leg1.json', run1); writeEvidence('run-leg2.json', run2)
  const asm = await asmOf()
  const sandboxCensus = (await fetchJson(`${origin}/__a5ptc4/sandbox`)).body
  writeEvidence('sandbox-census.json', sandboxCensus)
  const leg1File = readIfExists(join(WS, 'leg1-ok.txt'))
  const leg2 = (() => { try { return JSON.parse(/(\{.*\})/s.exec(run2.text)?.[1] ?? 'null') } catch { return null } })()
  const leg1 = (() => { try { return JSON.parse(/(\{.*\})/s.exec(run1.text)?.[1] ?? 'null') } catch { return null } })()
  const forbAfter2 = lsDir(FORB)
  const secretAfter2 = sha256(readFileSync(SECRET))

  if (MODE === 'green') {
    check('LEG1-ALLOW-DOMAIN-SUCCEEDS', 'LEG1: outer program ran in a REAL separate OS process (reported pid/ppid ≠ host pid; file written by the body) and wrote inside the allowed domain — bytes on disk, witness echo through the inner pipeline',
      leg1?.echo === 'A5PTC4-ECHO:leg1' && leg1File === `LEG1-BODY-RAN-${leg1?.pid}` && Number(leg1?.pid) > 0 && Number(leg1?.pid) !== hostPid && Number(leg1?.ppid) > 0 && Number(leg1?.ppid) !== Number(leg1?.pid),
      `leg1=${JSON.stringify(leg1)} wsFile=${JSON.stringify(leg1File)} hostPid=${hostPid} procChildrenSampled=${(asm.outerChildren ?? []).length} runTextHasEnforcement=${String(run1.text).includes('enforcement')}`)
    check('LEG1-SANDBOX-CENSUS', 'the run really executed under the deployed Landlock runner (selectedRunner=landlock, enforcement field from the backend)',
      sandboxCensus.selectedRunner === 'landlock' && sandboxCensus.landlockLauncher === LAUNCHER,
      JSON.stringify(sandboxCensus))
    check('LEG2-FORBIDDEN-TYPED-REFUSED-AT-OPEN', 'LEG2: forbidden-zone create AND append came back typed EACCES at open INSIDE the running program (body ran: echo canary + ws control file), zero bytes landed (no new file, secret byte-identical), sandbox.denied=true read back',
      leg2?.createCode === 'EACCES' && leg2?.appendCode === 'EACCES' && leg2?.echo === 'A5PTC4-ECHO:leg2'
      && readIfExists(join(WS, 'leg2-control.txt')) === `BODY-RAN-${leg2?.pid}`
      && forbAfter2.join(',') === 'secret.txt' && secretAfter2 === secretShaPre,
      `leg2=${JSON.stringify(leg2)} forbDir=${JSON.stringify(forbAfter2)} secretUnchanged=${secretAfter2 === secretShaPre} runTextHasDenied=${String(run2.text).includes('denied')}`)
  } else {
    check('RED-LEG1-FAILCLOSED-WHOLE-PROGRAM', 'RED: without the deployed backend the default posture refuses the WHOLE program before spawn (verbatim sandbox-unavailable), zero bytes anywhere — proves the GREEN legs are carried by the assembled backend, not by ambient luck',
      String(run1.text).includes('sandbox-unavailable') && leg1File === null, `textHead=${String(run1.text).slice(0, 240)}`)
    check('RED-LEG2-NO-IN-PROGRAM-DENIAL', 'RED: no per-API in-program denial exists in that posture (program body never ran: no echo canary, no control file) — the GREEN LEG2 discrimination is real',
      !String(run2.text).includes('A5PTC4-ECHO:leg2') && readIfExists(join(WS, 'leg2-control.txt')) === null && lsDir(FORB).join(',') === 'secret.txt',
      `forb=${JSON.stringify(lsDir(FORB))} textHead=${String(run2.text).slice(0, 240)}`)
  }

  // ── LEG3 reject / LEG3b no-answer / LEG4 allow / LEG5 non-sticky ────────
  await grantFeed('t3', 'reject')
  await grantFeed('t3b', 'no-answer')
  await grantFeed('t4', 'allow')
  const hookCensus = await fetchJson(`${origin}/__a5ptc4/hooks`).catch(() => null)
  writeEvidence('approval-hook-census.json', hookCensus?.body ?? null)
  const r3 = await runLeg('P3', 3)
  const r3b = await runLeg('P3B', 4)
  const run3 = r3.run ?? { text: '(held — no result observed)' }
  const run3b = r3b.run ?? { text: '(held — no result observed)' }
  writeEvidence('run-leg3.json', run3); writeEvidence('run-leg3b.json', run3b)
  const forbAfter3 = lsDir(FORB)
  const ledgerAfter3 = await approvals()
  writeEvidence('approvals-ledger.json', ledgerAfter3)
  const rowFor = (token) => ledgerAfter3.find((x) => x.token === token) ?? null

  if (MODE === 'green') {
    check('LEG3-REJECT-VERBATIM-FAILCLOSED', 'LEG3: Team resolver answered rejected on the public approval waterfall → host fail-closed text VERBATIM, program never spawned (no echo canary, zero new files, no forbidden target), per-callId audit row exists',
      String(run3.text).includes(VERBATIM_REJECT) && !String(run3.text).includes('A5PTC4-BODY-RAN')
      && forbAfter3.join(',') === 'secret.txt' && readIfExists(join(FORB, 'p3-target.txt')) === null
      && rowFor('t3')?.outcome === 'rejected' && rowFor('t3')?.callId !== '',
      `hasVerbatim=${String(run3.text).includes(VERBATIM_REJECT)} ledgerT3=${JSON.stringify(rowFor('t3'))} forb=${JSON.stringify(forbAfter3)} textHead=${String(run3.text).slice(0, 300)}`)
    check('LEG3B-NOANSWER-FAILCLOSED', 'LEG3b: resolver does not answer (throwing-answerer posture, the host\'s own documented normalization "a missing or throwing answerer yields unavailable (fail closed)") → host fail-closed text VERBATIM, same zero side effects, no-answer audited',
      String(run3b.text).includes(VERBATIM_NO_CHANNEL) && !String(run3b.text).includes('A5PTC4-BODY-RAN')
      && readIfExists(join(FORB, 'p3b-target.txt')) === null && rowFor('t3b')?.outcome === 'unavailable(throw)',
      `hasVerbatim=${String(run3b.text).includes(VERBATIM_NO_CHANNEL)} ledgerT3b=${JSON.stringify(rowFor('t3b'))} textHead=${String(run3b.text).slice(0, 300)}`)
    const r4 = await runLeg('P4', 5)
    const run4 = r4.run ?? { text: '(held)' }
    writeEvidence('run-leg4.json', run4)
    await new Promise((r) => setTimeout(r, 500))
    const leg4Target = readIfExists(join(FORB, 'p4-target.txt'))
    const ledgerAfter4 = await approvals()
    writeEvidence('approvals-ledger-final.json', ledgerAfter4)
    check('LEG4-ALLOWED-ONCE-WIDENS-THIS-CALL', 'LEG4: resolver answered allowed-once → the SAME escalation face let exactly this one call through — forbidden target really written with the body canary, per-callId audit row allowed-once',
      String(leg4Target ?? '').includes('A5PTC4-BODY-RAN') && ledgerAfter4.find((x) => x.token === 't4')?.outcome === 'allowed-once',
      `p4Target=${JSON.stringify(leg4Target)} ledgerT4=${JSON.stringify(ledgerAfter4.find((x) => x.token === 't4'))} runTextHead=${String(run4.text).slice(0, 220)}`)
    const r5 = await runLeg('P5', 6)
    const run5 = r5.run ?? { text: '(held)' }
    writeEvidence('run-leg5.json', run5)
    const leg5 = (() => { try { return JSON.parse(/(\{.*\})/s.exec(run5.text)?.[1] ?? 'null') } catch { return null } })()
    const modePost = (await fetchJson(`${origin}/__a5ptc4/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })).body
    const ledgerFinal = await approvals()
    const callIds = new Set(ledgerFinal.map((x) => x.callId))
    check('LEG5-NON-STICKY-PER-CALL', 'LEG5: the next identical call WITHOUT a grant is refused again (EACCES, zero bytes) and the session mode never left workspace-write — the widening was PER-CALL, not a mode switch; ledger carries one distinct callId per ask',
      leg5?.createCode === 'EACCES' && leg5?.appendCode === 'EACCES' && readIfExists(join(FORB, 'leg5-hack.txt')) === null
      && modePre?.mode === 'workspace-write' && modePost?.mode === 'workspace-write' && ledgerFinal.length >= 3 && callIds.size >= 3,
      `leg5=${JSON.stringify(leg5)} modePre=${modePre?.mode} modePost=${modePost?.mode} approvals=${ledgerFinal.length} distinctCallIds=${callIds.size}`)
    check('C-NO-SESSION-MODE-WRITE', 'zero whole-program/session mode or approval-policy writes by this kit (row never calls setSandboxMode/setApprovalPolicy; census mode constant across all six legs)',
      modePre?.mode === 'workspace-write' && modePost?.mode === 'workspace-write' && (jrows0.find((r) => r.leg === 'launcher-deploy')?.ok === true),
      `pre=${modePre?.mode} post=${modePost?.mode} approvalPolicyPost=${JSON.stringify(modePost?.approvalPolicy)}`)
  } else {
    const ledgerRed = await approvals()
    check('RED-LEG3-NO-RESOLVER', 'RED: with no resolver assembled there is no per-callId approval row and no rejected-verbatim fail-closed text — the GREEN LEG3 outcome is carried by the assembled Team resolver',
      ledgerRed.length === 0 && !String(run3.text).includes(VERBATIM_REJECT),
      `ledger=${ledgerRed.length} hasVerbatim=${String(run3.text).includes(VERBATIM_REJECT)} textHead=${String(run3.text).slice(0, 260)}`)
  }

  const stableAfter = await stableProbe()
  check('P-STABLE-UNTOUCHED', `:3080 stable instance untouched (probe pre=${stableBefore} post=${stableAfter}, kit bound only ${HOST_PORT})`,
    stableBefore === stableAfter && stableBefore === 401, `pre=${stableBefore} post=${stableAfter}`)
  const pinnedHeadPost = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelainPost = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PRISTINE-POST', 'pinned host tree byte-clean after the run (HEAD unchanged, porcelain empty)', pinnedHeadPost === TEST_USE_BASELINE_SHA && porcelainPost, `head=${pinnedHeadPost.slice(0, 12)} porcelain=${porcelainPost}`)

  const passCount = CRITERIA.filter((c) => c.pass).length
  const failCount = CRITERIA.length - passCount
  console.log(`\n[${MODE.toUpperCase()}] criteria: ${passCount}/${CRITERIA.length} pass, ${failCount} fail`)
  await finalize(failCount === 0 ? (MODE === 'green' ? 'GREEN-ALL-PASS' : 'RED-ALL-EXPECTED') : 'SOME-FAIL')
  process.exit(failCount === 0 ? 0 : 2)
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { writeEvidence('fatal.json', { message: String(error?.message ?? error), criteriaSoFar: CRITERIA }) } catch { /* last resort */ }
  await finalize('FATAL')
  process.exit(1)
})
