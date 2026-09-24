#!/usr/bin/env node
/**
 * lifecycle-probe.mjs — U3 characterization probe re-measurement (plan §11
 * "附加 — U3 characterization 探针复测" / u8-brief).
 *
 * Re-runs the P2-T2 `agent-lifecycle` probe group (fresh create / member
 * cold resume / ordinary root cold resume / ordering trace, 3 boots + the
 * empty-home negative control) against the upgraded pristine host
 * (0.1.7-rc.1 @ 46a7f68b09) and records the DIFF against the P2-T2
 * baseline (0.1.5-rc.2 @ fb2c4b9e69, dev/agent-workflow/evidence/P2-T2/run/):
 * per-check pass/fail + the exact failing assertion text.
 *
 * Scope discipline (per brief):
 *   - the probe module is driven UNMODIFIED through the shared harness lib
 *     (tests/characterization/lib/*);
 *   - the probe in this worktree was already re-pinned for 0.1.7 in
 *     commit 5546f6d (U2+U3+U4+U5: the expected ordering subsequence now
 *     uses the serial `agent/created` payload `source` instead of the
 *     removed `agent/session-start` event) — the re-measurement validates
 *     that re-pin on the real host;
 *   - the fixture `tests/characterization/fixtures/host-version.json` is
 *     still pinned at fb2c4b9e69 (0.1.5): the pin drift is RECORDED HERE
 *     ONLY — NOT re-recorded (re-recording is a separate follow-up per
 *     the brief / §4.2 two-pin precedent);
 *   - own world (tests/homes/u8-017rc1-probe-<stamp>), own port (3492
 *     preferred, first-free fallback in 3491–3495), own report dir
 *     (u8/lifecycle-probe/); :3080/:3180 read-only pre/post probes;
 *     test-use must be pristine @ 46a7f68b09 before and after.
 *
 * No model calls happen in this probe (it listens for session/agent
 * events and drives the public session seams) — no mock model needed.
 *
 * Usage: node lifecycle-probe.mjs
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import http from 'node:http'
import net from 'node:net'

// ── frozen facts ────────────────────────────────────────────────────────────
const MAIN_REPO = '/home/user/dsh-plugins/dsh-agent-team'
const WORKTREE = join(MAIN_REPO, '.worktrees', 'dsh-017rc1-upgrade')
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const HOST_PIN = '46a7f68b0922371ce7144b668b90e377d8e799f4' // DSH 0.1.7-rc.1 release point
const WORKTREE_PIN = 'adad20c00c75413f4c1fa1fe6832fb0fad746f6c' // task/dsh-017rc1-upgrade @ U7
const BASELINE_SHA = 'fb2c4b9e698e30edb738bca4cf0618587db7d203' // the fixture pin (0.1.5-rc.2) — recorded, NOT re-recorded

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(MAIN_REPO, 'tests', 'homes', `u8-017rc1-probe-${RUN_STAMP}`)
const U8_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'dsh-017rc1-upgrade', 'u8')
const PROBE_DIR = join(U8_DIR, 'lifecycle-probe')
const BASELINE_DIR = join(U8_DIR, '..', '..', 'P2-T2', 'run') // dev/agent-workflow/evidence/P2-T2/run

const PORT_PREFERENCE = [3492, 3493, 3494, 3495, 3491] // 3496–3499 reserved (vertical mock/MCP band)

// ── logging / evidence ──────────────────────────────────────────────────────
const RUN_LOG = join(PROBE_DIR, 'kit.log')
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try { writeFileSync(RUN_LOG, line + '\n', { flag: 'a' }) } catch { /* best-effort */ }
}
function writeEvidence(name, content) {
  const p = join(PROBE_DIR, name)
  const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  writeFileSync(p, text)
  return p
}
let fatalError = null
function dieFatal(msg) {
  fatalError = msg
  log(`FATAL: ${msg}`)
}

// ── small helpers ───────────────────────────────────────────────────────────
function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port })
    const done = (v) => { try { sock.destroy() } catch { /* closed */ } resolve(v) }
    sock.once('connect', () => done(true))
    sock.once('error', () => done(false))
    setTimeout(() => done(false), 2000)
  })
}
function probeStableInstance(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/', timeout: 5000 }, (res) => {
      res.resume()
      res.on('end', () => resolve({ port, status: res.statusCode }))
    })
    req.on('timeout', () => { req.destroy(); resolve({ port, status: -1, note: 'timeout' }) })
    req.on('error', (e) => resolve({ port, status: 0, error: e.code ?? e.message }))
  })
}
function gitProbe(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  return { status: r.status, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() }
}
function firstLine(t) {
  return String(t ?? '').split('\n')[0] ?? ''
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  rmSync(PROBE_DIR, { recursive: true, force: true })
  rmSync(HOME, { recursive: true, force: true })
  mkdirSync(PROBE_DIR, { recursive: true })
  writeFileSync(RUN_LOG, '', { flag: 'w' })
  log(`U3 agent-lifecycle probe re-measurement — stamp ${RUN_STAMP}`)
  log(`host=${TESTUSE} @ ${HOST_PIN}; worktree @ ${WORKTREE_PIN}; world=${HOME}`)

  // ── preflight ─────────────────────────────────────────────────────────
  const head = gitProbe(TESTUSE, ['rev-parse', 'HEAD'])
  const porcelain = gitProbe(TESTUSE, ['status', '--porcelain'])
  const wtHead = gitProbe(WORKTREE, ['rev-parse', 'HEAD'])
  if (head.stdout !== HOST_PIN) return finish(dieMsg(`test-use HEAD is not ${HOST_PIN} (got ${head.stdout})`))
  if (porcelain.stdout !== '') return finish(dieMsg(`test-use tree not pristine: ${firstLine(porcelain.stdout)}`))
  if (wtHead.stdout !== WORKTREE_PIN) return finish(dieMsg(`worktree HEAD is not ${WORKTREE_PIN} (got ${wtHead.stdout})`))
  log('preflight: test-use pristine @ 46a7f68b09; worktree @ adad20c')

  const preStable = { p3080: await probeStableInstance(3080), p3180: await probeStableInstance(3180) }
  writeEvidence('pre-stable-probe.json', preStable)

  const port = await (async () => {
    for (const p of PORT_PREFERENCE) if (!(await portInUse(p))) return p
    return null
  })()
  if (port === null) return finish(dieMsg(`no free port in ${JSON.stringify(PORT_PREFERENCE)}`))
  log(`port=${port}`)

  // ── harness wiring (shared lib, unmodified probe) ─────────────────────
  const lib = (rel) => pathToFileURL(join(WORKTREE, 'tests', 'characterization', rel)).href
  const { createHarnessContext } = await import(lib('lib/harness-core.mjs'))
  const { buildPublicSurface } = await import(lib('lib/public-surface.mjs'))
  log('building the live public-exports surface against the 0.1.7 tree …')
  const surface = buildPublicSurface(TESTUSE)
  log(`surface: ${surface.size} packages`)
  writeEvidence('surface-package-count.json', { packages: surface.size })

  const config = {
    hostTree: TESTUSE,
    dshHome: HOME,
    port,
    backupPort: 3500,
    reportDir: PROBE_DIR,
    logDir: join(PROBE_DIR, 'logs'),
    fixturePath: join(WORKTREE, 'tests', 'characterization', 'fixtures', 'host-version.json'),
    surface,
    clientCommitHash: HOST_PIN.slice(0, 10),
  }
  const ctx = createHarnessContext(config)

  // Structured capture of every check (the probe destructures ctx.check at
  // run start, so the wrap must land BEFORE run(ctx)).
  const checks = []
  const origCheck = ctx.check.bind(ctx)
  ctx.check = (passed, message) => {
    const ok = origCheck(Boolean(passed), message)
    checks.push({ passed: ok, message: String(message).slice(0, 2000) })
    return ok
  }

  const probeModule = await import(pathToFileURL(join(WORKTREE, 'tests', 'characterization', 'probes', 'agent-lifecycle', 'index.mjs')).href)
  log(`probe group: ${probeModule.default.name} — ${probeModule.default.description}`)

  // ── run the group (3 boots + empty-home negative control) ─────────────
  const startedAt = new Date().toISOString()
  let probeError = null
  try {
    await probeModule.default.run(ctx)
  } catch (e) {
    probeError = e
    log(`probe group threw: ${firstLine(String(e?.stack ?? e))}`)
  }
  const finishedAt = new Date().toISOString()
  // Defensive: the group's try/finally stops its own instances; verify.
  if (ctx.instance.child !== undefined) {
    try { await ctx.instance.stop() } catch (e) { log(`defensive instance stop: ${firstLine(String(e?.message ?? e))}`) }
  }
  const portFreeAfter = await (async () => { for (let i = 0; i < 50 && (await portInUse(port)); i += 1) await new Promise((r) => setTimeout(r, 500)); return !(await portInUse(port)) })()

  const failures = [...ctx.failures]
  writeEvidence('checks.json', checks)
  writeEvidence('failures.json', { probeError: probeError === null ? null : String(probeError?.stack ?? probeError).slice(0, 4000), failures })

  // ── fixture pin drift (RECORDED ONLY — not re-recorded per brief) ─────
  let fixtureSha = null
  try { fixtureSha = JSON.parse(readFileSync(config.fixturePath, 'utf8')).upstreamSha ?? null } catch { /* absent */ }
  const pinDrift = {
    fixtureSha,
    liveSha: HOST_PIN,
    drift: fixtureSha !== HOST_PIN,
    baselineFixtureSha: BASELINE_SHA,
    action: 'RECORDED ONLY — fixture re-recording is a separate post-upgrade follow-up (brief: 本轮只复测记录，不重录 fixture; §4.2 two-pin precedent)',
    note: 'the characterization `fixture` section (run by the full harness, not by this single-group re-measurement) would flag pin drift on 0.1.7; the public-surface build above used the LIVE 0.1.7 tree, so the probe ran against the live surface, not the stale fixture.',
  }
  writeEvidence('fixture-pin-drift.json', pinDrift)

  // ── baseline diff (P2-T2 run, 0.1.5-rc.2) ─────────────────────────────
  const diff = computeBaselineDiff(checks)
  writeEvidence('baseline-diff.json', diff)

  const postStable = { p3080: await probeStableInstance(3080), p3180: await probeStableInstance(3180) }
  writeEvidence('post-stable-probe.json', postStable)
  const headAfter = gitProbe(TESTUSE, ['rev-parse', 'HEAD'])
  const porcelainAfter = gitProbe(TESTUSE, ['status', '--porcelain'])

  const passed = checks.filter((c) => c.passed).length
  const verdict = probeError !== null || failures.length > 0 ? 'FAIL' : 'PASS'
  const summary = {
    task: 'U3 agent-lifecycle probe re-measurement on 0.1.7-rc.1 (plan §11 附加)',
    runStamp: RUN_STAMP,
    hostPin: HOST_PIN,
    worktreePin: WORKTREE_PIN,
    world: HOME,
    worldRetained: true,
    port,
    probeGroup: 'agent-lifecycle',
    probeSourceCommitNote: 'probe re-pinned for 0.1.7 in worktree commit 5546f6d (U2+U3+U4+U5): expected subsequence uses agent/created+source (agent/session-start removed in 0.1.7)',
    startedAt,
    finishedAt,
    checks,
    passed,
    total: checks.length,
    failed: failures,
    probeError: probeError === null ? null : String(probeError?.stack ?? probeError).slice(0, 4000),
    pinDrift,
    baseline: diff.baseline,
    diff: diff.diff,
    stablePrePost: { pre: preStable, post: postStable, unchanged: JSON.stringify(preStable) === JSON.stringify(postStable) },
    portFreeAfter,
    testUseAfter: { head: headAfter.stdout, pristine: porcelainAfter.stdout === '' },
    verdict,
  }
  writeEvidence('summary.json', summary)
  log(`VERDICT ${verdict} — ${passed}/${checks.length} checks passed; failures=${failures.length}`)
  return finish(fatalError !== null || failures.length > 0 || probeError !== null ? 1 : 0)
}

function dieMsg(msg) {
  dieFatal(msg)
  return 1
}

/**
 * Diff the re-measured checks against the P2-T2 baseline run log. Messages
 * carry volatile parts (random session ids, the raw event trace) — normalize
 * both sides before set comparison; the diff table in the summary reports
 * preserved / changed-message / added / removed / new-failure buckets.
 */
function computeBaselineDiff(currentChecks) {
  const normalize = (msg) => {
    let m = String(msg)
    m = m.replace(/p2t2-(root|member|late|probe)-[0-9a-f]{6,8}/g, 'p2t2-$1')
    // Keep the expected-phase list (it is the re-pin signal: 0.1.5 listed
    // event:agent/session-start, the 0.1.7 re-pin lists event:agent/created
    // with source) but drop the volatile matched count and the raw trace.
    m = m.replace(/matched \d+\/\d+ of /, 'matched ')
    m = m.replace(/; trace: .*$/, '')
    m = m.replace(/resumed length \d+ >= fresh length \d+/g, 'resumed length N >= fresh length M')
    m = m.replace(/length recorded \(\d+\)/g, 'length recorded (N)')
    m = m.replace(/\(rootLive=(true|false)\)/, '(rootLive=…)')
    return m
  }
  let baseline = { source: BASELINE_DIR, available: false, total: 0, passed: 0, failed: 0, ok: null, messages: [] }
  try {
    const runLog = readFileSync(join(BASELINE_DIR, 'run-log.txt'), 'utf8')
    const lines = runLog.split('\n').filter((l) => /PASS |FAIL /.test(l))
    const msgs = []
    let passed = 0
    let failed = 0
    for (const l of lines) {
      const m = /^\[\d{4}-[^\]]+\]\s+(PASS|FAIL) (.*)$/.exec(l)
      if (m === null) continue
      if (m[1] === 'PASS') passed += 1
      else failed += 1
      msgs.push(m[2].trim())
    }
    let ok = null
    try { ok = JSON.parse(readFileSync(join(BASELINE_DIR, 'summary.json'), 'utf8')).ok } catch { /* absent */ }
    baseline = {
      source: BASELINE_DIR,
      available: true,
      total: msgs.length,
      passed,
      failed,
      ok,
      note: 'P2-T2 baseline: 0.1.5-rc.2 @ fb2c4b9e69, full harness (all sections), recorded 2026-08-29 on the pre-upgrade dev machine',
      messages: msgs.map(normalize),
    }
  } catch {
    baseline.available = false
  }
  const cur = currentChecks.map((c) => ({ passed: c.passed, norm: normalize(c.message), raw: c.message }))
  const baseSet = new Map()
  for (const m of baseline.messages) {
    if (!baseSet.has(m)) baseSet.set(m, { count: 0, passed: true })
    baseSet.get(m).count += 1
  }
  const curSet = new Map()
  for (const c of cur) {
    const e = curSet.get(c.norm) ?? { count: 0, passed: c.passed, raw: c.raw }
    e.count += 1
    if (c.passed === false) e.passed = false
    curSet.set(c.norm, e)
  }
  const preserved = []
  const changedToFail = []
  const added = []
  for (const [norm, e] of curSet) {
    if (baseSet.has(norm)) {
      if (e.passed) preserved.push({ message: e.raw.slice(0, 300) })
      else changedToFail.push({ message: e.raw.slice(0, 600) })
    } else {
      added.push({ passed: e.passed, message: e.raw.slice(0, 300) })
    }
  }
  const removed = [...baseSet.keys()].filter((n) => !curSet.has(n)).map((n) => n.slice(0, 300))
  return {
    baseline,
    diff: {
      note: 'normalized set comparison; "added" entries usually reflect the 0.1.7 re-pin message wording (agent/created+source replaces agent/session-start in the expected-subsequence text), not new checks',
      preservedCount: preserved.length,
      preserved,
      changedToFailCount: changedToFail.length,
      changedToFail,
      addedCount: added.length,
      added,
      removedCount: removed.length,
      removed,
    },
  }
}

async function finish(exitCode) {
  try {
    if (fatalError !== null && !existsSync(join(PROBE_DIR, 'summary.json'))) {
      writeEvidence('fatal.json', { fatal: fatalError })
    }
  } catch { /* best-effort */ }
  process.exit(exitCode)
}

main().catch((e) => {
  const msg = String(e?.stack ?? e)
  try {
    log(`FATAL uncaught: ${msg}`)
    writeFileSync(join(PROBE_DIR, 'fatal.json'), JSON.stringify({ msg: msg.slice(0, 4000) }, null, 2))
  } catch { /* best-effort */ }
  process.exit(1)
})
