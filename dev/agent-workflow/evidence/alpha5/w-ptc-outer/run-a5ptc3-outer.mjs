#!/usr/bin/env node
/**
 * run-a5ptc3-outer.mjs — W-PTC-OUTER runner (PR#290 review comment 6230116007).
 *
 * The question, in the reviewer's words: does the PTC program — calling NO registered
 * tool — get its DIRECT outer-program effects (filesystem / subprocess / network)
 * actually refused, and where the runtime does not expose a capability, is that proven
 * from the measured allowed-API surface with a reachable control path?
 *
 * PHASE REALM (zero port, zero host, separate process; runs FIRST on pristine fixtures)
 *   The host's OWN built PTC child entry (public `./process` export) driven over the
 *   host's OWN inherited control channel (fd 7 + DSH_SUBPROCESS_CONTROL), twice:
 *     confined   — execve'd by the TRACKED Landlock pre-launcher under a
 *                  workspace-write-SHAPED grant (write only inside the workspace);
 *     unconfined — the same child the host hands over when the file policy is off.
 *   Per-API truth table with the runner's own independent census (file existence,
 *   secret hash, decoy-listener connection count).
 *
 * PHASE LIVE (real host on port 3184, self-proved free; DSH_HOME = tests/homes/<run>;
 * deployment-default sandbox mode workspace-write — the judgment leg switches nothing)
 *   LEG A  the bypass program driven into `run_code` by the mock model in a world that
 *          registers ZERO tools: verbatim typed outcome, /proc sampling for an outer OS
 *          child, independent zero-side-effect census, guard census (outer only).
 *   LEG B  the public per-call widening face (`sandbox_permissions` + `justification`)
 *          on the same program: does the outer file domain widen unattended?
 *   LEG C  DISCLOSED CONTROL ARM: the public per-session `setSandboxMode` write path in
 *          THIS test world only (host's own typed prescription, zero OS-enforcement
 *          caliber), re-running the same program against ITS OWN target paths so the
 *          per-API truth table also exists at transport level while Leg A's targets stay
 *          pristine forever.
 *
 * EXIT 0 = every criterion passed · 2 = a criterion failed (RED, booked honestly) · 1 = fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, join, resolve } from 'node:path'
import os from 'node:os'
import * as zlib from 'node:zlib'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'
import { buildBypassProgram, classifyOutcome } from './a5ptc3-bypass-program.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const SKIP_LIVE = args.includes('--realm-only')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc3-outer-${STAMP}`
const EVIDENCE_DIR = resolve(argValue('evidence-dir', join(HERE, 'runs', `outer-${STAMP}`)))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve([
  argValue('testuse', ''),
  join(WORKTREE, 'tests', 'deepseek-harness-test-use'),
  '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use',
].filter((p) => p !== '' && existsSync(p))[0] ?? '')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const CHILD_ENTRY = join(TESTUSE, 'packages', 'ptc-runtime', 'ptc-runtime-node', 'lib', 'process.js')
const ROW_PATH = join(HERE, 'a5ptc3-outer-row.mjs')
const PROBE = join(HERE, 'probe-a5ptc3-realm.mjs')
const LAUNCHER = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const LIVE_FORBIDDEN = join(HOME, 'live-forbidden')
const REALM_ROOT = join(EVIDENCE_DIR, 'realm-world')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')

const launcherSha = spawnSync('sha256sum', [LAUNCHER], { encoding: 'utf8' }).stdout.trim().split(/\s+/)[0] ?? ''
const sha256File = (p) => { try { return createHash('sha256').update(readFileSync(p)).digest('hex') } catch { return null } }
/**
 * MACHINE-MEASURED host identity, sampled inside this run (pre and post). This is the
 * row TESTUSE-WINDOW-AUDIT asked for: the build whose behavior is being claimed, proven
 * by hashes taken by this runner — not asserted from a previous round's notes.
 */
function collectHostIdentity(when) {
  const porcelain = gitAt(TESTUSE, 'status', '--porcelain')
  return {
    when,
    collectedAt: new Date().toISOString(),
    covers: 'TESTUSE-WINDOW-AUDIT retest item for the ptc-chain canonical round @05:08:09 (same build identity, re-measured inside this run)',
    testUsePath: TESTUSE,
    testUseHead: gitAt(TESTUSE, 'rev-parse', 'HEAD'),
    testUseBranch: gitAt(TESTUSE, 'rev-parse', '--abbrev-ref', 'HEAD'),
    testUsePorcelainLines: porcelain === '' ? 0 : porcelain.split('\n').length,
    testUsePorcelainRaw: porcelain,
    pinFromTestsPaths: TEST_USE_BASELINE_SHA,
    pinMatchesHead: gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA,
    clientCommitHashEnv: CLIENT_COMMIT_HASH,
    launcher: { path: LAUNCHER, sha256: sha256File(LAUNCHER), bytes: (() => { try { return statSync(LAUNCHER).size } catch { return null } })() },
    childEntry: { path: CHILD_ENTRY, sha256: sha256File(CHILD_ENTRY) },
    hostBin: { path: HOST_BIN, sha256: sha256File(HOST_BIN) },
    ptcRuntimeLibDir: join(TESTUSE, 'packages', 'ptc-runtime', 'ptc-runtime-node', 'lib'),
    node: { version: process.version, execPath: process.execPath },
    kernel: os.release(),
    abiProbe: null,
    runnerBranchHead: gitAt(WORKTREE, 'rev-parse', 'HEAD'),
    runnerBranch: gitAt(WORKTREE, 'rev-parse', '--abbrev-ref', 'HEAD'),
    run: RUN,
  }
}

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)

const CRITERIA = []
const check = (id, claim, cond, observed) => {
  CRITERIA.push({ id, claim, pass: cond === true, observed })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}${observed === undefined ? '' : ` [${observed}]`}`)
}
const info = (id, note, value) => { CRITERIA.push({ id, claim: note, informational: true, observed: value }); console.log(`INFO ${id} — ${note} [${value}]`) }
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }

const portFree = (port) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1') })
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
const sha = (p) => { try { return createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16) } catch (e) { return String((e && e.code) ?? e) } }
const exists = (p) => { try { return statSync(p).isFile() } catch { return false } }
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')

// ── decoy listeners (kit-owned targets for the direct-`net` API; ephemeral ports,
//    never a DSH instance port) ─────────────────────────────────────────────────
const decoys = new Map()
async function openDecoy(label) {
  const srv = createServer((sock) => {
    const d = decoys.get(label)
    d.connections += 1
    sock.on('data', (c) => { d.bytes += c.length; d.received = (d.received + String(c)).slice(0, 200) })
    sock.on('error', () => { d.errors += 1 })
    sock.on('close', () => { d.closes += 1 })
  })
  await new Promise((res) => srv.listen(0, '127.0.0.1', res))
  const port = srv.address().port
  decoys.set(label, { label, port, connections: 0, bytes: 0, received: '', errors: 0, closes: 0 })
  return port
}
const decoySnapshot = (label) => { const d = decoys.get(label); return d === undefined ? null : { ...d } }

let host = null
let mock = null
let hostIdentityPre = null
let abiVerdict = null
let stableBefore = null
async function finalize(status) {
  try {
    const reqs = mock?.requests ?? []
    writeEvidence('mock-decisions.json', reqs.map((rec, i) => {
      const blob = JSON.stringify(rec?.body ?? rec ?? {})
      return {
        seq: i + 1,
        userTextHead: ((rec?.body?.messages ?? []).filter((m) => m?.role === 'user').slice(-1)[0]?.content ?? '').toString().slice(0, 140),
        toolResults: (rec?.body?.messages ?? []).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : []).length,
        toolNamesOffered: (rec?.body?.tools ?? []).map((t) => t?.function?.name ?? t?.name).filter(Boolean),
        reply: rec?.reply ?? rec?.sent ?? null,
        blobHasRunCode: blob.includes('run_code'),
      }
    }))
  } catch { /* capture only */ }
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 400))
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  try {
    const post = collectHostIdentity('post')
    post.abiProbe = abiVerdict
    post.identityUnchanged = post.testUseHead === hostIdentityPre?.testUseHead && post.launcher.sha256 === hostIdentityPre?.launcher.sha256 && post.childEntry.sha256 === hostIdentityPre?.childEntry.sha256
    writeEvidence('host-identity-post.json', post)
  } catch { /* capture only */ }
  try {
    const copies = []
    const walk = async (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) await walk(p)
        else if (e.isFile() && /^session\..*\.jsonl(\.zstd)?$/.test(e.name) && statSync(p).size < 8_000_000) {
          mkdirSync(join(EVIDENCE_DIR, 'session-logs'), { recursive: true })
          // Two sessions both store `session.v4.jsonl.zstd`; key the copy by its dir.
          const dest = join(EVIDENCE_DIR, 'session-logs', `${basename(dirname(p))}__${e.name}`)
          copyFileSync(p, dest)
          copies.push(dest.replace(`${EVIDENCE_DIR}/`, ''))
          try {
            // The host appends ONE ZSTD FRAME PER EVENT. Node's one-shot decoder stops
            // after the first frame (measured: 298 of 34055 bytes), so decode the whole
            // multi-frame stream with the zstd CLI and keep a redacted text copy.
            const dec = spawnSync('zstd', ['-d', '-c', p], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            if (Number(dec.status) === 0) {
              writeFileSync(`${dest}.redacted.txt`, redact(String(dec.stdout ?? '')))
              writeFileSync(`${dest}.event-shapes.json`, JSON.stringify([...new Set(String(dec.stdout ?? '').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l)?.type ?? '?' } catch { return 'unparsable' } }))], null, 2))
            } else {
              writeFileSync(`${dest}.decode-failed.txt`, String(dec.stderr ?? 'zstd failed').slice(0, 2000))
            }
          } catch (err) { writeFileSync(`${dest}.decode-failed.txt`, String(err?.message ?? err)) }
        }
      }
    }
    if (existsSync(HOME)) await walk(HOME)
    if (copies.length > 0) writeEvidence('session-logs-copied.json', copies)
  } catch { /* diagnostics only */ }
  if (!KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
  writeEvidence('criteria.json', { run: RUN, status, launcherSha, criteria: CRITERIA })
}

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
async function fetchJson(url, init, timeoutMs = 30_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
const bodyOf = (rec) => (rec !== null && typeof rec === 'object' ? ('body' in rec ? (rec.body ?? null) : rec) : null)
const messagesOf = (req) => bodyOf(req)?.messages ?? []
const turnText = (req) => messagesOf(req).map((m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join(' ')
// The mock must read the CURRENT instruction, not the accumulated transcript: the
// earlier setup turn is still in history and would otherwise re-trigger its own reply.
const lastUserText = (req) => {
  const users = messagesOf(req).filter((m) => m?.role === 'user')
  const m = users[users.length - 1]
  return m === undefined ? '' : (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))
}
const newToolResults = (req) => {
  const out = []
  for (const m of messagesOf(req)) {
    if (Array.isArray(m?.content)) for (const b of m.content) {
      if (b?.type !== 'tool_result') continue
      const c = b.content
      out.push(typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? ''))
    }
  }
  return out
}
/** Wait until the around-seam has recorded at least `minRuns` outer runs; returns the
 * assembly snapshot even on timeout (a leg that never completes is DATA, not a crash). */
async function awaitAsm(baseUrl, label, minRuns, ms) {
  const deadline = Date.now() + ms
  for (;;) {
    const st = await fetchJson(`${baseUrl}/__a5ptc3/state`).catch(() => null)
    const a0 = st?.body?.assemblies?.[label] ?? null
    if ((a0?.runs ?? []).length >= minRuns) return a0
    if (Date.now() >= deadline) return a0 ?? null
    await new Promise((rr) => setTimeout(rr, 250))
  }
}
/** Tool results produced by the CURRENT turn only (history keeps earlier turns'). */
const resultsAfterLastUser = (req) => {
  const ms = messagesOf(req)
  let last = -1
  ms.forEach((m, i) => { if (m?.role === 'user') last = i })
  return ms.slice(last + 1).flatMap((m) => (Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])).length
}
const toolCall = (name, a) => ({ kind: 'tool-call', toolCalls: [{ id: `call-${Math.random().toString(36).slice(2, 10)}`, name, arguments: a }] })

/** Per-API truth table: what the program recorded + what the runner independently saw. */
function truthTable(programResult, census) {
  const api = programResult?.api ?? {}
  return [
    { api: 'fs READ (private forbidden fixture)', probe: 'read_forbidden', observed: api.read_forbidden ?? null, classified: classifyOutcome(api.read_forbidden), sideEffect: `file bytes ${census.secretUnchanged === true ? 'unchanged' : 'MODIFIED'}; read success/failure is the classified column (a PASS-THROUGH here means the content WAS disclosed to the program)` },
    { api: 'fs WRITE (forbidden zone)', probe: 'write_forbidden', observed: api.write_forbidden ?? null, classified: classifyOutcome(api.write_forbidden), sideEffect: census.writeTargetExists ? 'FILE CREATED' : 'no file created' },
    { api: 'fs WRITE via direct spawn (forbidden zone)', probe: 'spawn_write_forbidden', observed: api.spawn_write_forbidden ?? null, classified: Number(api.spawn_write_forbidden?.status) === 0 ? 'PASS-THROUGH' : 'CHILD-REFUSED', sideEffect: census.childTargetExists ? 'FILE CREATED BY CHILD' : 'no file created by child' },
    { api: 'child_process.spawn (direct)', probe: 'spawn_direct', observed: api.spawn_direct ?? null, classified: api.spawn_direct?.ok === true ? 'PASS-THROUGH' : 'ERROR', sideEffect: String(api.spawn_direct?.stdoutHead ?? '').includes('A5PTC3-SPAWN-RAN') ? 'child really ran' : 'no child evidence' },
    { api: 'fs READ of an out-of-workspace path the profile SHAPE leaves readable', probe: 'read_outside_readable', observed: api.read_outside_readable ?? null, classified: classifyOutcome(api.read_outside_readable), sideEffect: 'read-only probe, no write' },
    { api: 'net.connect (decoy listener)', probe: 'net_connect', observed: api.net_connect ?? null, classified: classifyOutcome(api.net_connect), sideEffect: `listener connections=${String(census.listenerConnections)} bytes=${String(census.listenerBytes)}` },
    { api: 'fs WRITE (in-workspace CONTROL)', probe: 'write_control', observed: api.write_control ?? null, classified: classifyOutcome(api.write_control), sideEffect: census.controlWriteExists ? 'control file really written' : 'control NOT written' },
  ]
}

const SECRET_TEXT = (run) => `SYNTHETIC-SECRET ${run} — never meant to cross the domain\n`

async function main() {
  stableBefore = await stableProbe()
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy (self-probe)`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `host is the pinned pristine tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} and porcelain-clean`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 10)} porcelain=${porcelain0} at ${TESTUSE}`)
  check('P-CHILD-ENTRY', "the host's own PTC child entry exists (public ./process export)", exists(CHILD_ENTRY), CHILD_ENTRY.replace(TESTUSE, '<TESTUSE>'))
  check('P-LAUNCHER', 'the trusted pre-launcher is the TRACKED file (sha recorded)', launcherSha.length === 64 && exists(LAUNCHER), `sha256=${launcherSha.slice(0, 16)}…`)
  hostIdentityPre = collectHostIdentity('pre')
  writeEvidence('host-identity.json', hostIdentityPre)
  check('P-HOST-IDENTITY', 'MACHINE-MEASURED host identity for this round (build under claim, sampled by this runner): test-use HEAD sha + porcelain count + launcher sha256 + child-entry sha256 + node/kernel, written to host-identity.json', hostIdentityPre.testUseHead === TEST_USE_BASELINE_SHA && hostIdentityPre.testUsePorcelainLines === 0 && (hostIdentityPre.launcher.sha256 ?? '').length === 64 && (hostIdentityPre.childEntry.sha256 ?? '').length === 64, `head=${hostIdentityPre.testUseHead?.slice(0, 12)} porcelain=${hostIdentityPre.testUsePorcelainLines} launcher=${hostIdentityPre.launcher.sha256?.slice(0, 12)} childEntry=${hostIdentityPre.childEntry.sha256?.slice(0, 12)} node=${hostIdentityPre.node.version} kernel=${hostIdentityPre.kernel} runnerBranch=${hostIdentityPre.runnerBranch}@${hostIdentityPre.runnerBranchHead?.slice(0, 8)}`)

  // ═══════════════════════ PHASE REALM (zero port / zero host) ═════════════════
  // One fixture subtree PER ARM; the CONFINED arm runs FIRST on pristine fixtures so
  // the zero-side-effect census can never be polluted by the other arm's writes.
  async function runRealmArm(arm) {
    const root = join(REALM_ROOT, arm)
    const ws = join(root, 'ws'); const forbidden = join(root, 'forbidden'); const rw = join(root, 'rw')
    mkdirSync(ws, { recursive: true }); mkdirSync(forbidden, { recursive: true }); mkdirSync(rw, { recursive: true })
    const secret = SECRET_TEXT(`${RUN}-${arm}`)
    const paths = {
      secretRead: join(forbidden, 'secret.txt'),
      writeTarget: join(forbidden, 'write-target.txt'),
      writeTargetChild: join(forbidden, 'child-target.txt'),
      controlWrite: join(ws, 'control-write.txt'),
      controlRead: join(ws, 'control-read.txt'),
      marker: join(ws, 'body-marker.txt'),
      outsideReadable: '/etc/hostname',
      listenPort: await openDecoy(`realm-${arm}`),
      controlPort: 0,
    }
    writeFileSync(paths.secretRead, secret)
    writeFileSync(paths.controlRead, 'CONTROL-READ\n')
    const programFile = join(EVIDENCE_DIR, `realm-program-${arm}-${RUN}.mjs`)
    writeFileSync(programFile, buildBypassProgram(paths, `${RUN}-${arm}`))
    const specFile = join(EVIDENCE_DIR, `realm-spec-${arm}-${RUN}.json`)
    writeFileSync(specFile, JSON.stringify({ run: `${RUN}-${arm}`, childEntry: CHILD_ENTRY, workspace: ws, rwScratch: rw, programFile, paths, launcher: LAUNCHER }, null, 2) + '\n')
    // ASYNC on purpose: a blocking spawnSync would freeze this process's event loop
    // and the decoy listener could never accept — the connection census would lie.
    const probe = await new Promise((res) => {
      const c = spawn(process.execPath, [PROBE, '--testuse', TESTUSE, '--launcher', LAUNCHER, '--python', 'python3', '--paths', specFile, '--out-dir', EVIDENCE_DIR, '--arms', arm], { stdio: ['ignore', 'pipe', 'pipe'] })
      let so = ''; let se = ''
      c.stdout.on('data', (d) => { so += d }); c.stderr.on('data', (d) => { se += d })
      const timer = setTimeout(() => { try { c.kill() } catch { /* gone */ } }, 300_000)
      c.on('close', (code) => { clearTimeout(timer); res({ status: code, stdout: so, stderr: se }) })
    })
    const file = join(EVIDENCE_DIR, `realm-${RUN}-${arm}.json`)
    const result = (() => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null } })()
    writeFileSync(join(EVIDENCE_DIR, `realm-probe-${arm}.log`), `${String(probe.stdout ?? '')}\n--- stderr ---\n${String(probe.stderr ?? '').slice(0, 4000)}`)
    if (result === null) die(`realm probe (${arm}) produced no result (exit ${String(probe.status)}): ${String(probe.stdout ?? '').slice(0, 500)} ${String(probe.stderr ?? '').slice(0, 500)}`)
    const snap = decoySnapshot(`realm-${arm}`)
    const census = {
      arm,
      secretUnchanged: sha(paths.secretRead) === createHash('sha256').update(secret).digest('hex').slice(0, 16),
      writeTargetExists: exists(paths.writeTarget),
      childTargetExists: exists(paths.writeTargetChild),
      controlWriteExists: exists(paths.controlWrite),
      markerExists: exists(paths.marker),
      listenerConnections: snap?.connections ?? 0,
      listenerBytes: snap?.bytes ?? 0,
      listenerReceived: snap?.received ?? '',
    }
    const armResult = result.arms?.[arm] ?? null
    return { abi: result.abi, launcherSha: result.launcherSha, armResult, census, programResult: armResult?.programResult ?? null, table: truthTable(armResult?.programResult ?? null, census), decoy: snap }
  }

  const confinedRun = await runRealmArm('confined')
  abiVerdict = confinedRun.abi ?? null
  hostIdentityPre = { ...hostIdentityPre, abiProbe: abiVerdict }
  writeEvidence('host-identity.json', hostIdentityPre)
  const unconfinedRun = await runRealmArm('unconfined')
  writeEvidence('realm-truth-table.json', {
    caliber: 'FIXTURE/OS plane: the host’s own built PTC child entry (public ./process export) over its own inherited control channel (fd 7 + DSH_SUBPROCESS_CONTROL); the confined arm is execve’d by the TRACKED Landlock pre-launcher under a workspace-write-SHAPED grant. NOT through ToolRuntime / Team guard / the host’s sandbox service. Zero port bound, zero DSH_HOME.',
    order: 'CONFINED arm ran FIRST on pristine fixtures; each arm has its own fixture subtree and its own decoy listener',
    grantShape: 'write only inside the session workspace + /tmp + /dev; read base narrowed to what node needs to boot (the host’s own profile is read-PERMISSIVE: sandbox-local/src/profiles.ts landlockProfileArgs readOnly ["/"])',
    abi: confinedRun.abi, launcherSha: confinedRun.launcherSha,
    confined: { why: confinedRun.armResult?.why ?? null, kitRc: confinedRun.armResult?.rc ?? null, launcherRc: confinedRun.armResult?.launcherVerdict?.rc ?? null, childStderr: confinedRun.armResult?.confinedChildStderr ?? null, census: confinedRun.census, rows: confinedRun.table, policy: confinedRun.armResult?.policy ?? null },
    unconfined: { why: unconfinedRun.armResult?.why ?? null, kitRc: unconfinedRun.armResult?.rc ?? null, argv: unconfinedRun.armResult?.argv ?? null, realm: unconfinedRun.programResult?.realm ?? null, census: unconfinedRun.census, rows: unconfinedRun.table },
  })

  const uniRes = unconfinedRun.programResult
  const confRes = confinedRun.programResult
  check('R-UNCONFINED-BOOTS', 'REALM control arm: the host’s own PTC child entry boots over the inherited control channel and the program body really runs (in-workspace marker + control write exist)', uniRes?.bodyStarted === true && unconfinedRun.census.markerExists === true && unconfinedRun.census.controlWriteExists === true, `why=${unconfinedRun.armResult?.why ?? '-'} rc=${String(unconfinedRun.armResult?.rc ?? '-')} pid=${String(uniRes?.realm?.pid ?? '-')} marker=${unconfinedRun.census.markerExists} control=${unconfinedRun.census.controlWriteExists}`)
  const surface = uniRes?.realm ?? null
  const imports = surface?.imports ?? {}
  check('R-API-SURFACE', 'allowed-API inventory measured INSIDE the real outer realm: dynamic import of node:fs / node:child_process / node:net all SUCCEED — the “capability not exposed” branch does NOT apply, the direct bypass is reachable by design (the runtime’s own instructions advertise await import)', imports['node:fs']?.ok === true && imports['node:child_process']?.ok === true && imports['node:net']?.ok === true, `imports=${JSON.stringify(Object.fromEntries(Object.entries(imports).map(([k, v]) => [k, v?.ok === true ? `ok(${v.exportCount})` : `ERR:${v.code ?? v.msg ?? '?'}`])))} globalCount=${String(surface?.globalCount ?? '-')} typeofRequire=${String(surface?.typeof?.require ?? '-')} typeofProcess=${String(surface?.typeof?.process ?? '-')}`)
  info('R-API-GLOBALS', 'realm globalThis inventory', JSON.stringify(surface?.globals ?? []).slice(0, 400))
  info('R-ENV-CENSUS', 'realm process.env inventory (host scrubs the environment before the program runs)', JSON.stringify(surface?.envKeys ?? []))
  const uniRow = (k) => unconfinedRun.table.find((r) => r.probe === k) ?? {}
  check('R-UNCONFINED-PASSTHROUGH', 'REALM control arm per-API truth: the unconfined outer program REACHES the forbidden zone (read + write), spawns a real child, and connects to the decoy listener — the reachable control path really runs', uniRow('read_forbidden').classified === 'PASS-THROUGH' && uniRow('write_forbidden').classified === 'PASS-THROUGH' && uniRow('spawn_direct').classified === 'PASS-THROUGH' && uniRow('net_connect').classified === 'PASS-THROUGH' && unconfinedRun.census.listenerConnections >= 1 && unconfinedRun.census.childTargetExists === true, `read=${uniRow('read_forbidden').classified} write=${uniRow('write_forbidden').classified} spawn=${uniRow('spawn_direct').classified} net=${uniRow('net_connect').classified} childWrote=${unconfinedRun.census.childTargetExists} listenerConns=${String(unconfinedRun.census.listenerConnections)}`)

  check('R-CONFINED-BOOTS', 'REALM confined arm: the SAME child entry boots under a REAL Landlock domain (program result present, launcher rc recorded)', confRes?.bodyStarted === true, `why=${confinedRun.armResult?.why ?? '-'} kitRc=${String(confinedRun.armResult?.rc ?? '-')} launcherRc=${String(confinedRun.armResult?.launcherVerdict?.rc ?? '-')} stderr=${String(confinedRun.armResult?.confinedChildStderr ?? '').slice(0, 140)}`)
  const confRow = (k) => confinedRun.table.find((r) => r.probe === k) ?? {}
  check('R-CONFINED-WRITE-OSDENIED', 'OS CALIBER: direct fs write into the forbidden zone is refused by the kernel (EACCES) and NO file is created', confRow('write_forbidden').classified === 'OS-DENIED' && confinedRun.census.writeTargetExists === false, `${JSON.stringify(confRow('write_forbidden').observed)} exists=${confinedRun.census.writeTargetExists}`)
  check('R-CONFINED-SPAWN-WRITE-OSDENIED', 'OS CALIBER: the direct spawn itself SUCCEEDS (execve of a granted path is not the refused effect) but the child’s write into the forbidden zone is refused too — the domain is inherited across fork/execve', confRow('spawn_write_forbidden').classified === 'CHILD-REFUSED' && confinedRun.census.childTargetExists === false && confRow('spawn_direct').classified === 'PASS-THROUGH', `spawnDirect=${JSON.stringify(confRow('spawn_direct').observed)} childWrite=${JSON.stringify(confRow('spawn_write_forbidden').observed)} childTarget=${confinedRun.census.childTargetExists}`)
  check('R-CONFINED-CONTROL-RUNS', 'the confined domain is SELECTIVE, not a blanket failure: the in-workspace control write and the body marker really happen', confinedRun.census.controlWriteExists === true && confinedRun.census.markerExists === true && confRow('write_control').classified === 'PASS-THROUGH', `control=${confinedRun.census.controlWriteExists} marker=${confinedRun.census.markerExists}`)
  info('R-CONFINED-READ', 'confined arm: direct fs READ of the private fixture (grant narrowed HERE; the host’s own workspace-write profile is read-PERMISSIVE — profiles.ts readOnly ["/"])', JSON.stringify(confRow('read_forbidden').observed) + ` secretUnchanged=${confinedRun.census.secretUnchanged}`)
  info('R-CONFINED-READ-SHAPE', 'confined arm: read of an out-of-workspace path the workspace-write SHAPE leaves readable (/etc/hostname)', JSON.stringify(confRow('read_outside_readable').observed))
  info('R-CONFINED-NET', 'confined arm: direct net connect to the decoy listener (Landlock ABI 4 grants no network right; network is not a file effect)', JSON.stringify(confRow('net_connect').observed) + ` listenerConns=${String(confinedRun.census.listenerConnections)} bytes=${String(confinedRun.census.listenerBytes)} received=${JSON.stringify(confinedRun.census.listenerReceived)}`)

  // ═════════════════════════ PHASE LIVE (real host) ════════════════════════════
  if (SKIP_LIVE) { console.log('--realm-only: LIVE phase skipped'); return }
  mkdirSync(WS, { recursive: true }); mkdirSync(LIVE_FORBIDDEN, { recursive: true })
  const liveSecretPath = join(LIVE_FORBIDDEN, 'secret.txt')
  writeFileSync(liveSecretPath, SECRET_TEXT(RUN))
  writeFileSync(join(WS, 'README.txt'), 'a5ptc3 outer-bypass world workspace\n')
  const livePort = await openDecoy('live')
  const livePaths = {
    secretRead: liveSecretPath,
    writeTarget: join(LIVE_FORBIDDEN, 'write-target.txt'),
    writeTargetChild: join(LIVE_FORBIDDEN, 'child-target.txt'),
    controlWrite: join(WS, 'control-write.txt'),
    controlRead: join(WS, 'control-read.txt'),
    marker: join(WS, 'body-marker.txt'),
    outsideReadable: '/etc/hostname',
    listenPort: livePort,
    controlPort: 0,
  }
  const cPaths = { ...livePaths, writeTarget: join(LIVE_FORBIDDEN, 'write-target-legc.txt'), writeTargetChild: join(LIVE_FORBIDDEN, 'child-target-legc.txt'), marker: join(WS, 'body-marker-legc.txt'), controlWrite: join(WS, 'control-write-legc.txt') }
  const PROGRAM_A = buildBypassProgram(livePaths, `${RUN}-legA`)
  const PROGRAM_B = buildBypassProgram(livePaths, `${RUN}-legB`)
  const PROGRAM_C = buildBypassProgram(cPaths, `${RUN}-legC`)
  writeEvidence('program-legA.source.js', PROGRAM_A)

  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# ${RUN} W-PTC-OUTER patch: outer-bypass row via the PUBLIC profile-patch seam; zero production rows mounted.`,
    '- insert:',
    '    - id: a5ptc3-outer-row',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const LEG_BY_MARKER = {
    _A: { program: PROGRAM_A, description: 'a5ptc3 legA: direct outer bypass attempts, no tool calls', extra: {} },
    _C: { program: PROGRAM_C, description: 'a5ptc3 legC: disclosed control arm after the per-session public mode switch', extra: {} },
    _B: { program: PROGRAM_B, description: 'a5ptc3 legB: the same attempts with the public per-call widening face requested', extra: { sandbox_permissions: 'danger-full-access', justification: 'a5ptc3 negative control: does the public widening face let the outer program through unattended?' } },
  }
  let reqs = 0
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 30) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs}` }
      const t = lastUserText(req)
      const fresh = resultsAfterLastUser(req)
      if (t.includes('setup turn') && fresh === 0) return { kind: 'text', content: `${MK}_SET_OK` }
      if (/call run_code exactly once/.test(t) && fresh === 0) {
        const key = Object.keys(LEG_BY_MARKER).find((k) => t.includes(`${MK}${k}`))
        if (key === undefined) return { kind: 'text', content: `${MK}_QUIET no leg marker matched` }
        const leg = LEG_BY_MARKER[key]
        return toolCall('run_code', { code: leg.program, description: leg.description, ...leg.extra })
      }
      return { kind: 'text', content: `${MK}_DONE received ${fresh} fresh tool result(s)` }
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
      DEEPSEEK_API_KEY: 'a5ptc3-mock-key',
      A5PTC3_TESTUSE: TESTUSE,
      A5PTC3_LEDGER: LEDGER,
      A5PTC3_RUN: RUN,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(120_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  check('L-BOOT', `host booted on ${HOST_PORT} behind the token gate`, cookie !== null, `cookie=${cookie !== null}`)
  await waitFor(30_000, async () => { const h = await fetchJson(`${origin}/__a5ptc3/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'row apply')

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5ptc3-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const prompt = (sessionId, text) => api('prompt', { requestId: `a5ptc3-r-${Math.random().toString(36).slice(2, 10)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] })
  const assemble = () => fetchJson(`${origin}/__a5ptc3/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId }) }, 30_000)

  const created = await api('create', { requestId: `a5ptc3-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 60_000)
  const sessionId = created.body?.result?.value?.sessionId ?? created.body?.value?.sessionId ?? null
  check('L-CREATE', 'session created through the public entry (cwd = the world workspace)', typeof sessionId === 'string' && sessionId !== '', `sid=${String(sessionId).slice(0, 24)}`)
  await prompt(sessionId, `${MK}_SET setup turn; reply OK`)
  await waitFor(90_000, async () => { const r = await assemble().catch(() => null); return r?.body?.ok === true ? r : false }, 'agent visible to the assembly route')
  await waitFor(120_000, async () => {
    const rows = ((await fetchJson(`${origin}/__a5ptc3/journal`).catch(() => null))?.body?.rows) ?? []
    if (rows.some((r) => r.leg === 'assembly-failed')) return 'failed'
    return rows.some((r) => r.leg === 'assembly-complete') ? true : false
  }, 'assembly legs complete')
  const jrows = ((await fetchJson(`${origin}/__a5ptc3/journal`)).body.rows) ?? []
  const failedRow = jrows.find((r) => r.leg === 'assembly-failed')
  if (failedRow !== undefined) die(`assembly failed: ${failedRow.error}`)

  const st0 = await fetchJson(`${origin}/__a5ptc3/state`)
  const label0 = Object.keys(st0.body?.assemblies ?? {})[0]
  const asm0 = st0.body?.assemblies?.[label0] ?? {}
  check('A-MODE-DEFAULT', 'LEG A precondition, measured through the PUBLIC read: the world runs the deployment default workspace-write (this row never calls setSandboxMode)', asm0.modeCensus?.pre?.mode === 'workspace-write' && asm0.runtimeCensus?.runtimeSandboxMode === 'workspace-write', `pre=${String(asm0.modeCensus?.pre?.mode)} deploymentDefault=${String(asm0.modeCensus?.deploymentDefault)}`)
  check('A-WITNESS-ONLY', 'the world’s only registered tool is a never-referenced witness; the bypass program body contains no `tools.` reference at all', asm0.toolSurface?.witnessTool === 'a5ptc3_witness' && !PROGRAM_A.includes('tools.'), JSON.stringify(asm0.toolSurface ?? {}))

  // ── LEG A: default workspace-write, direct outer bypass ────────────────────
  const preA = { secretSha: sha(liveSecretPath), conns: decoySnapshot('live')?.connections ?? 0 }
  const resA = await prompt(sessionId, `${MK}_A call run_code exactly once with the bypass program, then answer DONE`)
  writeFileSync(join(EVIDENCE_DIR, 'legA-prompt-turn.redacted.txt'), redact(typeof resA.body === 'string' ? resA.body : JSON.stringify(resA.body ?? '')).slice(0, 200_000))
  const asmA = (await awaitAsm(origin, label0, 1, 150_000)) ?? die('LEG A: no run_code result ever reached the around-seam')
  const runA = asmA.runs[0] ?? {}
  const postModeA = await fetchJson(`${origin}/__a5ptc3/mode/${label0}`).catch(() => null)
  const censusA = {
    secretUnchanged: sha(liveSecretPath) === preA.secretSha,
    writeTargetExists: exists(livePaths.writeTarget),
    childTargetExists: exists(livePaths.writeTargetChild),
    controlWriteExists: exists(livePaths.controlWrite),
    markerExists: exists(livePaths.marker),
    listenerConnections: (decoySnapshot('live')?.connections ?? 0) - preA.conns,
    listenerBytes: decoySnapshot('live')?.bytes ?? 0,
  }
  writeEvidence('legA-state.json', { run: runA, modePost: postModeA?.body ?? null, census: censusA, guardRows: asmA.guardRows ?? [], outerChildren: asmA.outerChildren ?? [], runtimeCensus: asmA.runtimeCensus, modeCensus: asmA.modeCensus, toolSurface: asmA.toolSurface, throwCensus: asmA.throwCensus, legs: asmA.legs })
  const refusal = String(runA.text ?? '')
  check('A-TYPED-REFUSAL-BEFORE-EXECUTION', 'LEG A verbatim outcome: run_code answers with the host’s typed fail-closed refusal (sandbox-unavailable / “refusing to run the command unconfined” / File sandbox: workspace-write) — the outer program never starts', /sandbox-unavailable/.test(refusal) && /refusing to run the command unconfined/i.test(refusal) && /File sandbox: workspace-write/.test(refusal), refusal.slice(0, 420))
  check('A-ZERO-SIDE-EFFECTS', 'LEG A independent census: no write target, no child write, no listener connection, secret hash unchanged — and even the IN-WORKSPACE control write did not happen, so the refusal is whole-program (fail-closed before spawn), not a per-API decision', censusA.writeTargetExists === false && censusA.childTargetExists === false && censusA.listenerConnections === 0 && censusA.secretUnchanged === true && censusA.controlWriteExists === false && censusA.markerExists === false, JSON.stringify(censusA))
  check('A-NO-OUTER-OS-CHILD', 'LEG A /proc sampler: no OS child process for the outer PTC program ever existed (confinement is decided BEFORE spawn)', (asmA.outerChildren ?? []).length === 0 && (runA.children ?? []).length === 0, `outerChildren=${JSON.stringify(asmA.outerChildren ?? [])} samples=${String(runA.sampled ?? 0)} inFlight=${JSON.stringify(runA.children ?? [])}`)
  check('A-GUARD-OUTER-ONLY', 'the guard saw the OUTER run_code dispatch and NOTHING else: zero inner re-entry and zero calls to the registered witness tool (the bypass really went around the governed edge)', (asmA.guardRows ?? []).filter((g) => g.name === 'run_code').length >= 1 && (asmA.guardRows ?? []).every((g) => g.inner === false) && (asmA.guardRows ?? []).some((g) => g.name === 'run_code') && !(asmA.guardRows ?? []).some((g) => g.name === 'a5ptc3_witness'), JSON.stringify(asmA.guardRows ?? []))
  check('A-MODE-UNCHANGED-AFTER-A', 'mode after LEG A is still workspace-write through the public read (no silent widening on the refused path)', postModeA?.body?.post === 'workspace-write' && postModeA?.body?.writeCallsByThisRow === 0, JSON.stringify(postModeA?.body ?? {}))
  info('A-SEAM-CENSUS', 'public-seam inventory for taking the outer transport over (reserved-name throws at both faces; PTC-runtime service-slot replaceability)', JSON.stringify(asmA.throwCensus ?? {}))

  // ── LEG C: DISCLOSED control arm (per-session public switch, zero OS caliber).
  // Runs BEFORE the per-call widening leg on purpose: a widening request that parks
  // would otherwise queue-block this arm's turn and cost the disclosure its data.
  const switchRes = await fetchJson(`${origin}/__a5ptc3/switch/${label0}`, { method: 'POST' }).catch(() => null)
  const postModeC = await fetchJson(`${origin}/__a5ptc3/mode/${label0}`).catch(() => null)
  writeEvidence('legC-mode-switch.json', { switchRoute: switchRes?.body ?? null, modeAfter: postModeC?.body ?? null, disclosure: 'test-world per-session public write path (session.append("sandbox/mode")); the host’s own typed refusal prescribes exactly this switch. NO OS-enforcement caliber is claimed for it: in that mode the host wraps NOTHING around the outer process (index.ts confines only when mode !== danger-full-access).' })
  const resC = await prompt(sessionId, `${MK}_C call run_code exactly once with the bypass program, then answer DONE`)
  writeFileSync(join(EVIDENCE_DIR, 'legC-prompt-turn.redacted.txt'), redact(typeof resC.body === 'string' ? resC.body : JSON.stringify(resC.body ?? '')).slice(0, 200_000))
  const asmC = (await awaitAsm(origin, label0, 2, 120_000)) ?? {}
  const runC = (asmC.runs ?? []).slice(-1)[0] ?? {}
  const legCLanded = (asmC.runs ?? []).length >= 2
  const censusC = {
    markerExists: exists(cPaths.marker),
    writeTargetExists: exists(cPaths.writeTarget),
    childTargetExists: exists(cPaths.writeTargetChild),
    listenerConnections: decoySnapshot('live')?.connections ?? 0,
    listenerBytes: decoySnapshot('live')?.bytes ?? 0,
    controlWriteExists: exists(cPaths.controlWrite),
    legATargetsStillPristine: exists(livePaths.writeTarget) === false && exists(livePaths.writeTargetChild) === false && exists(livePaths.marker) === false && sha(liveSecretPath) === preA.secretSha,
  }
  const parsedC = (() => { const m = /A5PTC3-BYPASS (\{.*\})/.exec(String(runC.text ?? '')); try { return m === null ? null : JSON.parse(m[1]) } catch { return null } })()
  writeEvidence('legC-state.json', { landedWithinWindow: legCLanded, run: runC, census: censusC, programResult: parsedC, modeAfter: postModeC?.body ?? null, outerChildren: asmC.outerChildren ?? [], rows: parsedC === null ? null : truthTable(parsedC, { ...censusC, secretUnchanged: sha(liveSecretPath) === preA.secretSha }) })
  info('C-DISCLOSED-TRUTH-TABLE', 'LEG C (DISCLOSED: mode = per-session public switch, ZERO OS-enforcement caliber) per-API outcome at transport level — proves the transport really reaches execution when nothing is confined, so LEG A’s silence is the confinement decision and not a dead transport', JSON.stringify(Object.fromEntries((parsedC === null ? [] : truthTable(parsedC, { ...censusC, secretUnchanged: sha(liveSecretPath) === preA.secretSha })).map((row) => [row.probe, row.classified]))) + ` marker=${censusC.markerExists} writeTarget=${censusC.writeTargetExists} childWrote=${censusC.childTargetExists} conns=${censusC.listenerConnections} outerChildren=${(asmC.outerChildren ?? []).length}`)
  check('C-TRANSPORT-REACHES-EXECUTION', 'DISCLOSED control arm: with the per-session public switch (zero OS caliber, its own -legc target paths) the SAME program body really executes end-to-end — so LEG A’s typed refusal is the confinement decision, not an inert transport', legCLanded === true && censusC.markerExists === true && censusC.controlWriteExists === true && (parsedC?.bodyStarted === true || String(runC.text ?? '').includes('A5PTC3-BYPASS')), `landed=${legCLanded} marker=${censusC.markerExists} parsed=${parsedC !== null} text=${String(runC.text ?? '').slice(0, 160)}`)
  check('C-LEG-A-TARGETS-PRISTINE', 'LEG A’s forbidden-zone targets are STILL untouched after the disclosed control arm ran on its own paths (the zero-side-effect proof is durable)', censusC.legATargetsStillPristine === true, JSON.stringify(censusC))

  // ── LEG B: public per-call widening face, on its OWN default-mode session ────
  // A widening request may PARK (human approval) rather than answer; on a separate
  // session that park cannot queue-block the legs above, and the mode under test is
  // the untouched deployment default rather than the mode LEG C switched to.
  const createdB = await api('create', { requestId: `a5ptc3-cb-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 60_000)
  const sessionIdB = createdB.body?.result?.value?.sessionId ?? createdB.body?.value?.sessionId ?? null
  await prompt(sessionIdB, `${MK}_SET setup turn; reply OK`)
  await waitFor(90_000, async () => { const rr = await fetchJson(`${origin}/__a5ptc3/assemble`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sessionIdB }) }, 30_000).catch(() => null); return rr?.body?.ok === true ? rr : false }, 'second session visible to the assembly route')
  await waitFor(120_000, async () => {
    const stx = await fetchJson(`${origin}/__a5ptc3/state`).catch(() => null)
    const labels = Object.keys(stx?.body?.assemblies ?? {}).filter((l) => l !== label0)
    return labels.length > 0 ? labels[0] : false
  }, 'second assembly registered')
  const stB0 = await fetchJson(`${origin}/__a5ptc3/state`)
  const labelB = Object.keys(stB0.body?.assemblies ?? {}).find((l) => l !== label0) ?? null
  const asmB0 = stB0.body?.assemblies?.[labelB ?? ''] ?? {}
  const resB = await prompt(sessionIdB, `${MK}_B call run_code exactly once with the escalation arguments, then answer DONE`)
  writeFileSync(join(EVIDENCE_DIR, 'legB-prompt-turn.redacted.txt'), redact(typeof resB.body === 'string' ? resB.body : JSON.stringify(resB.body ?? '')).slice(0, 200_000))
  const asmB = (await awaitAsm(origin, labelB ?? '', 1, 90_000)) ?? {}
  const runB = (asmB.runs ?? []).slice(-1)[0] ?? {}
  const legBLanded = (asmB.runs ?? []).length >= 1
  const postModeB = await fetchJson(`${origin}/__a5ptc3/mode/${labelB}`).catch(() => null)
  const censusB = {
    markerExists: exists(livePaths.marker),
    writeTargetExists: exists(livePaths.writeTarget),
    childTargetExists: exists(livePaths.writeTargetChild),
    secretUnchanged: sha(liveSecretPath) === preA.secretSha,
    listenerConnections: decoySnapshot('live')?.connections ?? 0,
  }
  writeEvidence('legB-requested-arguments.json', {
    note: 'the guard sees exec.args={} for the reserved transport, so what was ASKED is booked from the mock’s own wire record',
    toolCalls: (mock?.requests ?? []).flatMap((rec) => (rec?.reply?.toolCalls ?? []).map((t) => ({ name: t?.name, argumentKeys: Object.keys(t?.arguments ?? {}).sort(), sandbox_permissions: t?.arguments?.sandbox_permissions ?? null, justificationHead: String(t?.arguments?.justification ?? '').slice(0, 120) }))),
  })
  writeEvidence('legB-state.json', { landedWithinWindow: legBLanded, label: labelB, run: runB, modePre: asmB0.modeCensus ?? null, modePost: postModeB?.body ?? null, guardRows: asmB.guardRows ?? [], outerChildren: asmB.outerChildren ?? [], census: censusB })
  info('B-OUTCOME', 'LEG B typed outcome for the per-call widening face (landed = an answer came back; not landed = the widening request never reached execution inside the window — booked either way, with the session log as mechanism evidence)', `landed=${legBLanded} modePre=${String(asmB0.modeCensus?.pre?.mode)} modePost=${String(postModeB?.body?.post)} text=${String(runB.text ?? '').slice(0, 260)}`)
  check('B-WIDENING-IS-GATED', 'LEG B: the per-call sandbox_permissions+justification face does NOT hand the outer program a wider file domain unattended — zero writes anywhere, secret unchanged, zero listener traffic beyond what earlier legs caused, no outer OS child in that session, and its mode never left workspace-write', censusB.markerExists === false && censusB.writeTargetExists === false && censusB.childTargetExists === false && censusB.secretUnchanged === true && (asmB.outerChildren ?? []).length === 0 && postModeB?.body?.post === 'workspace-write' && postModeB?.body?.writeCallsByThisRow === 0, `landed=${legBLanded} census=${JSON.stringify(censusB)} outerChildren=${JSON.stringify(asmB.outerChildren ?? [])} mode=${String(postModeB?.body?.post)} writes=${String(postModeB?.body?.writeCallsByThisRow)}`)

}

let exitCode = 1
main()
  .then(async () => { await finalize('GREEN') })
  .catch(async (error) => { console.error(error); await finalize('RED') })
  .finally(async () => {
    const stableAfter = await stableProbe()
    check('P-STABLE-UNTOUCHED', 'the :3080 stable dev instance was never touched (equal probe pre/post; this kit binds only port 3184 + ephemeral decoy listeners)', stableAfter === stableBefore, `pre=${stableBefore} post=${stableAfter}`)
    check('P-PRISTINE', 'the test-use runtime stayed pristine (porcelain empty, HEAD unmoved)', gitAt(TESTUSE, 'status', '--porcelain') === '' && gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA, `porcelain=${gitAt(TESTUSE, 'status', '--porcelain') === ''} head=${gitAt(TESTUSE, 'rev-parse', 'HEAD').slice(0, 10)}`)
    const portGone = await portFree(HOST_PORT)
    check('P-PORT-RELEASED', `port ${HOST_PORT} released after teardown`, portGone, `free=${portGone}`)
    if (!KEEP) check('P-WORLD-DELETED', `test world tests/homes/${RUN} deleted at teardown`, !existsSync(HOME), `exists=${existsSync(HOME)}`)
    writeEvidence('criteria.json', { run: RUN, launcherSha, criteria: CRITERIA })
    const failing = CRITERIA.filter((c) => !c.pass && !c.informational).length
    const judged = CRITERIA.filter((c) => !c.informational).length
    exitCode = failing === 0 ? 0 : 2
    console.log(`\n== ${judged - failing}/${judged} criteria pass; failing=${failing}`)
    process.exitCode = exitCode
    void exitCode
  })
