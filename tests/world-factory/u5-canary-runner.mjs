#!/usr/bin/env node
/**
 * u5-canary-runner.mjs — the U5 real-Host Canary suite runner (tier C2).
 *
 * One process = one RUN record. Suites:
 *   core            one World, one boot: token-gate, positive-control,
 *                   error-return-with-effect, planted-defect-detected,
 *                   oracle-blinding-divergence, leak-check
 *   core-restart    core + stop/boot again on the SAME World (persistence)
 *   negatives       wrong-scope-no-effect | start-failure-classified |
 *                   timeout-classified | interrupt-classified (own World each)
 *
 * Ownership discipline comes from tests/kits/rc2-real-host-smoke/run-control
 * (+ run-budget): this process is the OWNER of the child host and the mock;
 * every failure path unwinds into the finally; only the owned child handle is
 * ever killed; an independent watchdog bounds the child's wall lifetime
 * (9.5 min — the package rule is every run ≤ 10 min).
 *
 * Verdict honesty (plan U5 bullet 5): the timeout world ENDS TIMEOUT and the
 * bad-config world ENDS START_FAILED — those tokens are the demonstrated
 * classification; the summary line and exit code can never print/return PASS
 * while any case is non-PASS. The green signal for G3 is the CORE suite.
 *
 * Host-start budget: every `startHost()` (boot attempt, successful or not) is
 * appended to the shared JSONL ledger BEFORE the spawn. At startup the runner
 * refuses to begin if the ledger already holds --max-host-starts entries.
 *
 * Usage:
 *   node tests/world-factory/u5-canary-runner.mjs --suite core --line r1 \
 *     --evidence <dir> [--run-record <json>] [--budget-ledger <jsonl>] \
 *     [--max-host-starts 15] [--keep-home]
 *
 * Opt-in only: nothing under vitest roots collects this; live Host work runs
 * only when a human/agent invokes this file explicitly.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRunControl } from '../kits/rc2-real-host-smoke/run-control.mjs'
import { portInUse } from '../characterization/lib/util.mjs'
import {
  CANARY_PLUGIN_SRC,
  TestWorldFactory,
  apiPrompt,
  apiSessionCancel,
  apiSessionCreate,
  authenticate,
  homesCensus,
  scrubProviderEnv,
  stableInstanceProbe,
} from './lib/world-factory.mjs'
import { pidAlive } from './lib/port-lease.mjs'
import { createOracle, oraclePaths } from './lib/oracle.mjs'
import { createRunRecord, exitCodeFor, formatSummary } from './lib/run-record.mjs'
import { findIssuedResult, makeCanaryDecide, resultClaimsRan } from './lib/mock-script.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
const RUN_LIFETIME_MS = 9.5 * 60_000
const CASE_WAIT_MS = 90_000

export const SUITE_CASES = {
  core: ['token-gate', 'positive-control', 'error-return-with-effect', 'planted-defect-detected', 'oracle-blinding-divergence', 'leak-check'],
  'core-restart': ['token-gate', 'positive-control', 'error-return-with-effect', 'planted-defect-detected', 'oracle-blinding-divergence', 'restart-persistence', 'leak-check'],
  negatives: ['wrong-scope-no-effect', 'start-failure-classified', 'timeout-classified', 'interrupt-classified'],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')

export function parseArgs(argv) {
  const out = { suite: 'core', line: 'x', evidence: null, runRecord: null, budgetLedger: null, maxHostStarts: 15, keepHome: false, only: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--suite') out.suite = String(argv[++i])
    else if (a === '--line') out.line = String(argv[++i])
    else if (a === '--evidence') out.evidence = String(argv[++i])
    else if (a === '--run-record') out.runRecord = String(argv[++i])
    else if (a === '--budget-ledger') out.budgetLedger = String(argv[++i])
    else if (a === '--max-host-starts') out.maxHostStarts = Number(argv[++i])
    else if (a === '--keep-home') out.keepHome = true
    else if (a === '--only') out.only = String(argv[++i])
    else throw new Error(`unknown argument: ${a}`)
  }
  if (!Object.keys(SUITE_CASES).includes(out.suite)) throw new Error(`unknown suite: ${out.suite}`)
  if (out.evidence === null) throw new Error('--evidence is required (raw logs/RUN records live outside git)')
  if (!Number.isInteger(out.maxHostStarts) || out.maxHostStarts < 1) throw new Error('bad --max-host-starts')
  if (out.only !== null && !SUITE_CASES[out.suite].includes(out.only)) throw new Error(`--only ${out.only} is not a case of suite ${out.suite}`)
  return out
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed (exit ${String(r.status)})`)
  return String(r.stdout).trim()
}

async function probeNoToken(origin) {
  const res = await fetch(`${origin}/`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) }).catch(() => null)
  return res === null ? 'unreachable' : res.status
}

function readAuthorityBinding(repoRoot) {
  const pointerPath = 'dev/engineering/current-authority.json'
  try {
    const text = readFileSync(join(repoRoot, pointerPath), 'utf8')
    const pointer = JSON.parse(text)
    let snapshotDigest = 'snapshot-unreadable'
    try {
      snapshotDigest = sha256Text(readFileSync(join(repoRoot, 'dev', 'engineering', 'authority-snapshots', `${pointer.snapshot_version}.json`), 'utf8'))
    } catch {
      /* keep sentinel */
    }
    return { pointerPath, pointer, pointerSha256: sha256Text(text), snapshotDigest }
  } catch (error) {
    return { pointerPath, error: String(error?.message ?? error) }
  }
}

/** Poll until predicate() true, deadline, or abort. */
async function waitUntil(predicate, { timeoutMs, intervalMs = 400, signal = undefined }) {
  const started = Date.now()
  for (;;) {
    let hit = false
    try {
      hit = predicate() === true
    } catch {
      hit = false
    }
    if (hit) return { hit: true, waitedMs: Date.now() - started }
    if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
    if (signal?.aborted === true) return { hit: false, waitedMs: Date.now() - started, aborted: true }
    await sleep(intervalMs)
  }
}

function findFirstKey(value, key) {
  if (value === null || typeof value !== 'object') return undefined
  if (!Array.isArray(value) && typeof value[key] === 'string') return value[key]
  for (const inner of Object.values(value)) {
    const got = findFirstKey(inner, key)
    if (got !== undefined) return got
  }
  return undefined
}

function readLedgerRows(path) {
  try {
    return readFileSync(path, 'utf8')
      .split('\n')
      .filter((l) => l.trim() !== '')
      .map((l) => {
        try {
          return JSON.parse(l)
        } catch {
          return { leg: 'UNPARSEABLE' }
        }
      })
  } catch {
    return []
  }
}

function summarizeObs(obs) {
  return {
    markerFiles: obs.channels.markers.files,
    ledgerLegsForTag: obs.channels.ledger.forTag,
    hostAlive: obs.channels.processes.hostAlive,
    hostLogTagHits: obs.channels.hostLog.tagLineHits,
  }
}

function diffCensus(pre, post) {
  const changed = []
  for (const [name, mtime] of Object.entries(post)) {
    if (!(name in pre)) changed.push(`${name}:+created`)
    else if (pre[name] !== mtime) changed.push(`${name}:~touched`)
  }
  for (const name of Object.keys(pre)) if (!(name in post)) changed.push(`${name}:-removed`)
  return changed
}

/**
 * Boot helper: create World + mock + start host through the SHARED launcher,
 * binding the owned child into run-control BEFORE awaiting (s1-h0-m1 capture
 * pattern). Returns { world, nonce, queue, issued, boot } once booted.
 */
async function bootWorld({ factory, record, rc, worldOpts, phase }) {
  const world = await factory.createWorld(worldOpts)
  record.record.bindings.worldIds.push(world.id)
  const nonce = Math.random().toString(36).slice(2, 8)
  const queue = []
  const issued = []
  const decide = makeCanaryDecide({ queue, nonce, onCallIssued: (e) => issued.push(e), control: { budget: rc.budget, runControl: rc } })
  await world.startMock({ decide })
  record.logHostStart({ world: world.id, phase })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  const boot = await startPromise
  record.record.boots = (record.record.boots ?? []).concat([{ phase, world: world.id, port: boot.port, logPath: boot.logPath }])
  return { world, nonce, queue, issued, boot }
}

/** Wait for the queued script entry to be issued by decide(). */
async function waitForIssue(issued, countBefore, { timeoutMs = CASE_WAIT_MS, signal } = {}) {
  const w = await waitUntil(() => issued.length > countBefore, { timeoutMs, signal })
  return { ok: w.hit, call: issued[issued.length - 1] ?? null, waitedMs: w.waitedMs }
}

/** Leak check: nothing this World owned survived teardown. */
async function evaluateLeak({ world, receipts, factory }) {
  const checks = {}
  checks.ownedPidsDead = (receipts.killedPids ?? []).every((k) => !pidAlive(k.pid ?? k))
  const stillBound = []
  for (const port of [...new Set(receipts.releasedPorts ?? [])]) {
    if (await portInUse(port)) stillBound.push(port)
  }
  checks.portsReleased = stillBound.length === 0
  checks.stillBound = stillBound
  checks.homeReleased = receipts.homeDeleted !== null || (receipts.notes ?? []).some((n) => String(n).includes('kept as evidence'))
  // No lease file naming this world survives (scan, not path guess).
  const heldLease = (() => {
    try {
      for (const name of readdirSync(factory.leaseRoot)) {
        if (!name.endsWith('.lease')) continue
        try {
          const l = JSON.parse(readFileSync(join(factory.leaseRoot, name), 'utf8'))
          if (l.world === world.id) return name
        } catch {
          /* unreadable — not ours to claim */
        }
      }
    } catch {
      /* no lease root = none held */
    }
    return null
  })()
  checks.leasesReleased = heldLease === null
  checks.heldLease = heldLease
  checks.notes = receipts.notes ?? []
  const conjuncts = ['ownedPidsDead', 'portsReleased', 'homeReleased', 'leasesReleased']
  return { ok: conjuncts.every((k) => checks[k] === true), detail: checks }
}

// ─────────────────────────────────────────────────────────────────────────────
// core: one World, one boot (plus optional restart leg)
// ─────────────────────────────────────────────────────────────────────────────
async function runCore({ factory, record, rc, log, line, suite, worlds, keepHome }) {
  const ctx = await bootWorld({ factory, record, rc, worldOpts: { line }, phase: 'boot1' })
  worlds.push(ctx.world)
  const { world, nonce, queue, issued } = ctx
  const origin = `http://127.0.0.1:${ctx.boot.port}`
  const oracle = createOracle({ ...oraclePaths(world), hostLogPath: ctx.boot.logPath })

  const noToken = await probeNoToken(origin)
  record.addCase('token-gate', noToken === 401 ? 'PASS' : 'FAIL', { status: noToken })
  record.record.boot1Evidence = {
    ledgerRowsAfterBoot: world.ledgerRows(),
    patchFile: (() => {
      try {
        return readFileSync(join(world.instance.profileDir, 'cordis.patch.yml'), 'utf8').slice(0, 800)
      } catch (error) {
        return `<unreadable: ${String(error?.message ?? error)}>`
      }
    })(),
  }

  const cookie = await authenticate(origin, world.token)
  const createRes = await apiSessionCreate(origin, cookie, world.workspaceDir, `u5${nonce}`)
  if (createRes.status !== 200) throw new Error(`session/create ${String(createRes.status)}: ${JSON.stringify(createRes.body ?? '').slice(0, 300)}`)
  const sessionId = findFirstKey(createRes.body, 'sessionId')
  if (typeof sessionId !== 'string') throw new Error('sessionId missing from session/create response')
  record.record.session = { sessionId, workspace: world.workspaceDir }
  console.log(`U5-IN-RUN ${world.id} ${world.home} ${String(world.instance?.child?.pid ?? '?')}`)

  // ---- positive control -------------------------------------------------------
  {
    const tag = `pos-${nonce}`
    const before = issued.length
    queue.push({ mode: 'ok', tag })
    const promptRes = await apiPrompt(origin, cookie, sessionId, `u5 positive control ${tag}`, `u5${nonce}`)
    const issue = await waitForIssue(issued, before, { signal: rc.signal })
    const resultWait = issue.ok
      ? await waitUntil(() => findIssuedResult(world.mock.requests, issue.call.callId).found, { timeoutMs: CASE_WAIT_MS, signal: rc.signal })
      : { hit: false, waitedMs: 0 }
    const result = issue.ok ? findIssuedResult(world.mock.requests, issue.call.callId) : { found: false }
    const obs = oracle.observe({ tag })
    const effect = oracle.effect(obs, { returnedRan: result.found && resultClaimsRan(result.text), resultErrored: result.found && result.isError })
    if (resultWait.hit) rc.budget.noteWaitHit()
    else rc.budget.noteWaitMiss('positive-control')
    record.addCase('positive-control', effect.effect && resultWait.hit && !result.isError ? 'PASS' : 'FAIL', {
      tag,
      promptStatus: promptRes.status,
      promptBodyHead: JSON.stringify(promptRes.body ?? '').slice(0, 200),
      toolCallIssued: issue.ok,
      resultRoundTripped: resultWait.hit,
      resultErrored: result.found && result.isError,
      effect: { effect: effect.effect, basis: effect.basis, marker: effect.marker, bodyRan: effect.bodyRan },
      observation: summarizeObs(obs),
      waitedMs: resultWait.waitedMs,
      ...(effect.effect === false ? { mockDigest: world.mockRequestDigest(), ledgerRows: world.ledgerRows() } : {}),
    })
  }

  // ---- error-return-with-effect ----------------------------------------------
  {
    const tag = `err-${nonce}`
    const before = issued.length
    queue.push({ mode: 'error-after-effect', tag })
    await apiPrompt(origin, cookie, sessionId, `u5 error-after-effect ${tag}`, `u5${nonce}`)
    const issue = await waitForIssue(issued, before, { signal: rc.signal })
    const resultWait = issue.ok
      ? await waitUntil(() => findIssuedResult(world.mock.requests, issue.call.callId).found, { timeoutMs: CASE_WAIT_MS, signal: rc.signal })
      : { hit: false, waitedMs: 0 }
    const result = issue.ok ? findIssuedResult(world.mock.requests, issue.call.callId) : { found: false, isError: false }
    const obs = oracle.observe({ tag })
    // Oracle input deliberately carries NO successful claim: return said error.
    const effect = oracle.effect(obs, { returnedRan: false, resultErrored: result.isError === true })
    if (!resultWait.hit) rc.budget.noteWaitMiss('error-after-effect')
    record.addCase('error-return-with-effect', effect.effect && resultWait.hit && result.isError ? 'PASS' : 'FAIL', {
      tag,
      oracleReportedEffectDespiteError: effect.effect,
      resultErrored: result.isError === true,
      resultTextHead: result.found === true ? String(result.text).slice(0, 160) : null,
      observation: summarizeObs(obs),
    })
  }

  // ---- planted defect + oracle blinding divergence ----------------------------
  {
    const tag = `def-${nonce}`
    const before = issued.length
    queue.push({ mode: 'defect', tag })
    await apiPrompt(origin, cookie, sessionId, `u5 planted defect ${tag}`, `u5${nonce}`)
    const issue = await waitForIssue(issued, before, { signal: rc.signal })
    const resultWait = issue.ok
      ? await waitUntil(() => findIssuedResult(world.mock.requests, issue.call.callId).found, { timeoutMs: CASE_WAIT_MS, signal: rc.signal })
      : { hit: false, waitedMs: 0 }
    const result = issue.ok ? findIssuedResult(world.mock.requests, issue.call.callId) : { found: false }
    const returnedRan = result.found && resultClaimsRan(result.text)
    const obs = oracle.observe({ tag })
    const sound = oracle.effect(obs, { returnedRan })
    const blinded = createOracle({ ...oraclePaths(world), hostLogPath: ctx.boot.logPath }, { broken: 'ignore-marker' }).effect(obs, { returnedRan })
    const caught = sound.effect === false && returnedRan === true
    record.addCase('planted-defect-detected', caught ? 'PASS' : 'FAIL', {
      tag,
      toolClaimedRan: returnedRan,
      soundOracleEffect: sound.effect,
      note: 'defect mode lies (ran:true, writes nothing); a sound Oracle must report NO effect — a PASS here IS the fault-planting RED',
      observation: summarizeObs(obs),
      resultWaitedMs: resultWait.waitedMs,
    })
    record.addCase('oracle-blinding-divergence', sound.effect !== blinded.effect && blinded.effect === true ? 'PASS' : 'FAIL', {
      soundEffect: sound.effect,
      blindedEffect: blinded.effect,
      note: 'the ignore-marker Oracle variant turns the planted defect GREEN — proving the sound Oracle is what catches it (fault-planting sensitivity)',
    })
  }

  // ---- optional restart leg ----------------------------------------------------
  if (suite === 'core-restart') {
    const boot1Files = oracle.observe({ tag: `pos-${nonce}` }).channels.markers.files.slice()
    if (world.instance?.logPath !== undefined) copyFileSync(world.instance.logPath, join(world.logDir, 'boot1-instance.log'))
    await rc.stopChild()
    rc.dispose()
    await world.stopHost()
    const boot2 = await bootWorldRestart({ factory, record, rc, world, nonce, queue, issued })
    const origin2 = `http://127.0.0.1:${boot2.port}`
    const cookie2 = await authenticate(origin2, world.token)
    const create2 = await apiSessionCreate(origin2, cookie2, world.workspaceDir, `u5r${nonce}`)
    const sessionId2 = findFirstKey(create2.body, 'sessionId')
    const tag2 = `re2-${nonce}`
    const before2 = issued.length
    queue.push({ mode: 'ok', tag: tag2 })
    await apiPrompt(origin2, cookie2, sessionId2, `u5 restart leg ${tag2}`, `u5r${nonce}`)
    const issue2 = await waitForIssue(issued, before2, { signal: rc.signal })
    if (issue2.ok) await waitUntil(() => findIssuedResult(world.mock.requests, issue2.call.callId).found, { timeoutMs: CASE_WAIT_MS, signal: rc.signal })
    const oracle2 = createOracle({ ...oraclePaths(world), hostLogPath: boot2.logPath })
    const obs2 = oracle2.observe({ tag: tag2 })
    const effect2 = oracle2.effect(obs2, { returnedRan: true })
    const obs1again = oracle2.observe({ tag: `pos-${nonce}` })
    const persisted = boot1Files.length > 0 && boot1Files.every((f) => obs1again.channels.markers.files.includes(f))
    record.addCase('restart-persistence', effect2.effect && persisted ? 'PASS' : 'FAIL', {
      boot1MarkersBefore: boot1Files,
      boot1MarkersAfter: obs1again.channels.markers.files,
      newWriteAfterRestart: effect2.effect,
      sameWorld: world.id,
      samePortReused: boot2.port === ctx.boot.port,
    })
  }

  // ---- teardown + leak check ---------------------------------------------------
  await rc.stopChild()
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  record.addCase('leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
}

/** Restart boot: reuse the World (held port lease) with a fresh boot phase. */
async function bootWorldRestart({ factory, record, rc, world, nonce, queue, issued }) {
  record.logHostStart({ world: world.id, phase: 'boot2-restart' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  const boot = await startPromise
  record.record.boots.push({ phase: 'boot2', world: world.id, port: boot.port, logPath: boot.logPath })
  void nonce
  void queue
  void issued
  return boot
}

// ─────────────────────────────────────────────────────────────────────────────
// negatives: own World per classification probe
// ─────────────────────────────────────────────────────────────────────────────

/** wrong scope: canary mounted but NOT registered; a scripted call must not effect. */
async function caseWrongScope({ factory, record, rc, line, worlds, keepHome }) {
  let ctx = null
  try {
    ctx = await bootWorld({ factory, record, rc, worldOpts: { line: `${line}sc`, visible: false }, phase: 'scope-boot' })
    worlds.push(ctx.world)
    const { world, nonce, queue, issued, boot } = ctx
    const origin = `http://127.0.0.1:${boot.port}`
    const cookie = await authenticate(origin, world.token)
    const createRes = await apiSessionCreate(origin, cookie, world.workspaceDir, `u5${nonce}`)
    const sessionId = findFirstKey(createRes.body, 'sessionId')
    const tag = `scope-${nonce}`
    const before = issued.length
    // The model asks for a tool the scope never registered (forced): the host
    // must answer without the effect ever existing.
    queue.push({ mode: 'ok', tag, forced: true })
    await apiPrompt(origin, cookie, sessionId, `u5 wrong-scope ${tag}`, `u5${nonce}`)
    const issue = await waitForIssue(issued, before, { signal: rc.signal })
    const resultWait = issue.ok
      ? await waitUntil(() => findIssuedResult(world.mock.requests, issue.call.callId).found, { timeoutMs: CASE_WAIT_MS, signal: rc.signal })
      : { hit: false }
    const result = issue.ok ? findIssuedResult(world.mock.requests, issue.call.callId) : { found: false, isError: false }
    const oracle = createOracle(oraclePaths(world))
    const obs = oracle.observe({ tag })
    const effect = oracle.effect(obs, { returnedRan: false })
    const rows = readLedgerRows(world.ledgerPath)
    const registered = rows.some((r) => r.leg === 'register' && r.ok === true)
    const skipped = rows.some((r) => r.leg === 'register-skipped')
    const ok = !effect.effect && !registered && skipped && issue.ok && resultWait.hit && result.isError
    record.addCase('wrong-scope-no-effect', ok ? 'PASS' : 'FAIL', {
      tag,
      toolVisibleInScope: false,
      toolCallIssuedByModel: issue.ok,
      hostReturnedErrorToModel: result.found === true && result.isError === true,
      effectReported: effect.effect,
      markerFiles: obs.channels.markers.files,
      registerSkippedRow: skipped,
    })
  } catch (error) {
    record.addCase('wrong-scope-no-effect', 'FAIL', { error: String(error?.message ?? error) })
  } finally {
    if (ctx !== null) await teardownAndNote({ ctx, record, caseId: 'wrong-scope-no-effect', keepHome, rc })
  }
}

/** start failure: mount row without the plugin file -> boot must fail -> START_FAILED */
async function caseStartFailure({ factory, record, rc, line, worlds, keepHome }) {
  const world = await factory.createWorld({ line: `${line}sf`, badMount: 'corrupt-patch' })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  try {
    const nonce = Math.random().toString(36).slice(2, 8)
    const queue = []
    const decide = makeCanaryDecide({ queue, nonce, control: { budget: rc.budget, runControl: rc } })
    await world.startMock({ decide })
    record.logHostStart({ world: world.id, phase: 'start-failure-attempt' })
    rc.arm()
    const startPromise = world.startHost({ bootTimeoutMs: 60_000 })
    const child = world.instance?.child ?? null
    if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
    await startPromise
    // If we get here the bad mount still booted — the control itself failed.
    record.addCase('start-failure-classified', 'FAIL', { reason: 'host booted despite missing plugin file' })
  } catch (error) {
    const tail = world.instance?.logPath !== undefined ? readTail(world.instance.logPath) : ''
    record.addCase('start-failure-classified', 'START_FAILED', {
      classification: 'START_FAILED',
      note: 'bad config (mounted row, missing plugin file): boot failed as designed; the verdict token names the class, it is NOT a pass',
      errorHead: String(error?.message ?? error).split('\n').slice(0, 3).join(' | '),
      logTail: tail.split('\n').slice(-6).join('\n'),
    })
  } finally {
    try {
      await rc.stopChild()
    } catch {
      /* idempotent */
    }
    const receipts = await world.teardown({ keepHome })
    rc.dispose()
    const leak = await evaluateLeak({ world, receipts, factory })
    record.record['start-failure-classified.cleanup'] = leak.detail
  }
}

/** timeout: tool outlives the CASE budget -> verdict TIMEOUT (truthfully). */
async function caseTimeout({ factory, record, rc, line, worlds, keepHome }) {
  let ctx = null
  try {
    ctx = await bootWorld({ factory, record, rc, worldOpts: { line: `${line}to` }, phase: 'timeout-boot' })
    worlds.push(ctx.world)
    const { world, nonce, queue, issued, boot } = ctx
    const origin = `http://127.0.0.1:${boot.port}`
    const cookie = await authenticate(origin, world.token)
    const createRes = await apiSessionCreate(origin, cookie, world.workspaceDir, `u5${nonce}`)
    const sessionId = findFirstKey(createRes.body, 'sessionId')
    const tag = `to-${nonce}`
    const before = issued.length
    rc.budget.beginScenario('timeout-case')
    queue.push({ mode: 'sleep', tag, sleepMs: 30_000 })
    await apiPrompt(origin, cookie, sessionId, `u5 timeout ${tag}`, `u5${nonce}`)
    await waitForIssue(issued, before, { signal: rc.signal })
    const caseBudgetMs = 6_000
    const resultWait = await waitUntil(() => findIssuedResult(world.mock.requests, issued[before]?.callId).found, { timeoutMs: caseBudgetMs })
    rc.budget.endScenario()
    const oracle = createOracle({ ...oraclePaths(world), hostLogPath: boot.logPath })
    const obs = oracle.observe({ tag })
    record.addCase('timeout-classified', resultWait.hit === false ? 'TIMEOUT' : 'FAIL', {
      classification: 'TIMEOUT',
      caseBudgetMs,
      toolSleepMs: 30_000,
      preMarkerBeforeVerdict: obs.channels.markers.files.includes(`${tag}.pre`),
      postMarkerBeforeVerdict: obs.channels.markers.files.includes(`${tag}.post`),
      note: 'tool exceeded its case budget; verdict TIMEOUT is the classification itself (never recoloured to PASS)',
    })
  } catch (error) {
    record.addCase('timeout-classified', 'FAIL', { error: String(error?.message ?? error) })
  } finally {
    if (ctx !== null) await teardownAndNote({ ctx, record, caseId: 'timeout-classified', keepHome, rc })
  }
}

/** interrupt: cancel mid-call through the public session/cancel seam. */
async function caseInterrupt({ factory, record, rc, line, worlds, keepHome }) {
  let ctx = null
  try {
    ctx = await bootWorld({ factory, record, rc, worldOpts: { line: `${line}it` }, phase: 'interrupt-boot' })
    worlds.push(ctx.world)
    const { world, nonce, queue, issued, boot } = ctx
    const origin = `http://127.0.0.1:${boot.port}`
    const cookie = await authenticate(origin, world.token)
    const createRes = await apiSessionCreate(origin, cookie, world.workspaceDir, `u5${nonce}`)
    const sessionId = findFirstKey(createRes.body, 'sessionId')
    const tag = `it-${nonce}`
    const before = issued.length
    rc.budget.beginScenario('interrupt-case')
    queue.push({ mode: 'sleep', tag, sleepMs: 15_000 })
    await apiPrompt(origin, cookie, sessionId, `u5 interrupt ${tag}`, `u5${nonce}`)
    await waitForIssue(issued, before, { signal: rc.signal })
    const oracle = createOracle({ ...oraclePaths(world), hostLogPath: boot.logPath })
    // Wait until the effect has STARTED (pre marker) so the cancel lands mid-call.
    const pre = await waitUntil(() => oracle.observe({ tag }).channels.markers.files.includes(`${tag}.pre`), { timeoutMs: 30_000 })
    const cancelRes = await apiSessionCancel(origin, cookie, sessionId, `u5${nonce}`)
    const cancelAccepted = cancelRes.status === 200 && JSON.stringify(cancelRes.body ?? '').includes('true')
    // Observe the outcome window: does the cancelled call still complete?
    const completion = await waitUntil(() => findIssuedResult(world.mock.requests, issued[before]?.callId).found, { timeoutMs: 18_000 })
    rc.budget.endScenario()
    const result = completion.hit ? findIssuedResult(world.mock.requests, issued[before].callId) : { found: false, isError: false }
    const interrupted = cancelAccepted && (!result.found || result.isError)
    record.addCase('interrupt-classified', interrupted ? 'PASS' : 'FAIL', {
      classification: interrupted ? (result.found ? 'CANCELLED_TOOL_RESULT_ERROR' : 'CANCELLED_RESULT_NEVER_RETURNED') : 'COMPLETED_DESPITE_CANCEL',
      cancelHttpStatus: cancelRes.status,
      cancelAccepted,
      preMarkerSeenBeforeCancel: pre.hit,
      resultReturned: result.found,
      resultErrored: result.found === true && result.isError === true,
      note: 'PASS here = the public session/cancel seam interrupted the in-flight call as designed (the executed negative control itself passed), classification recorded',
    })
  } catch (error) {
    record.addCase('interrupt-classified', 'FAIL', { error: String(error?.message ?? error) })
  } finally {
    if (ctx !== null) await teardownAndNote({ ctx, record, caseId: 'interrupt-classified', keepHome, rc })
  }
}

async function teardownAndNote({ ctx, record, caseId, keepHome, rc }) {
  try {
    await rc.stopChild()
  } catch {
    /* idempotent */
  }
  const receipts = await ctx.world.teardown({ keepHome })
  rc.dispose()
  record.record[`${caseId}.cleanup`] = {
    homeDeleted: receipts.homeDeleted,
    releasedPorts: receipts.releasedPorts,
    killedPids: receipts.killedPids.map((k) => k.pid),
    notes: receipts.notes,
  }
}

function readTail(logPath, lines = 12) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-lines).join('\n')
  } catch {
    return '<unreadable>'
  }
}

export async function runSuite(opts) {
  const { suite, line, evidence, runRecord: runRecordPath, budgetLedger, maxHostStarts, keepHome, only = null } = opts
  mkdirSync(evidence, { recursive: true })
  const selected = only !== null ? [only] : SUITE_CASES[suite]
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence })
  const runId = `u5-${suite}-${line}-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const log = (msg) => console.log(`[${suite}] ${msg}`)

  const teamSha = git(['rev-parse', 'HEAD'], REPO_ROOT)
  const hostBaseStartup = factory.assertHostBase('startup')
  const record = createRunRecord({
    runId,
    suite,
    selectedCases: selected,
    ledgerPath: budgetLedger,
    bindings: {
      teamSha,
      hostSha: hostBaseStartup.head,
      hostPorcelainEmptyAtStartup: true,
      authority: readAuthorityBinding(REPO_ROOT),
      canaryPluginSha256: sha256Text(readFileSync(CANARY_PLUGIN_SRC, 'utf8')),
      worldIds: [],
      leaseRoot: factory.leaseRoot,
      hostTree: factory.hostTree,
      provider: { kind: 'mock-deepseek', base: 'injected http://127.0.0.1:<leased-port>' },
      profileDisclosure: 'World profiles disable ONLY the two deepseekLlmApiExtensions metadata contributors (session-log-deepseek, plugin-package-inventory-deepseek) through their own public config.enabled flag — s1-h0-m1 noext precedent; on fresh unauthenticated homes they fail every model request with REQUEST_EXTENSION before dispatch (measured u5dbg run; reported as a product observation, not hidden). Tools, Guard, dispatch, registry rows otherwise untouched.',
    },
  })

  const rc = createRunControl({
    log,
    writeEvidence: (name, content) => {
      const p = join(evidence, `${runId}.${name}`)
      writeFileSync(p, JSON.stringify(content, null, 2) + '\n')
    },
    limits: {
      childLifetimeMs: RUN_LIFETIME_MS,
      totalRequests: 80,
      perSessionRequests: 30,
      perScenarioRequests: 20,
      sameStateRepeats: 5,
      consecutiveMisses: 3,
    },
  })
  const uninstall = rc.installSignalHandlers()
  const hardWatchdog = setTimeout(() => rc.requestAbort('hard run watchdog: 9.5 min exceeded'), RUN_LIFETIME_MS)
  hardWatchdog.unref?.()

  const stablePre = await stableInstanceProbe()
  const homesPre = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const scrubbed = scrubProviderEnv()

  // Host-start budget gate (fail-closed BEFORE any spawn).
  if (record.ledgerStartCount() >= maxHostStarts) {
    for (const id of selected) {
      record.addCase(id, 'REFUSED', { reason: `host-start budget ledger already holds ${String(record.ledgerStartCount())} >= ${maxHostStarts} starts` })
    }
    clearTimeout(hardWatchdog)
    uninstall()
    const rec = record.finalize()
    if (runRecordPath !== null) record.write(runRecordPath)
    return rec
  }

  const worlds = []
  try {
    if (suite === 'core' || suite === 'core-restart') {
      await runCore({ factory, record, rc, log, line, suite, worlds, keepHome })
    } else {
      if (selected.includes('wrong-scope-no-effect')) await caseWrongScope({ factory, record, rc, line, worlds, keepHome })
      if (selected.includes('start-failure-classified')) await caseStartFailure({ factory, record, rc, line, worlds, keepHome })
      if (selected.includes('timeout-classified')) await caseTimeout({ factory, record, rc, line, worlds, keepHome })
      if (selected.includes('interrupt-classified')) await caseInterrupt({ factory, record, rc, line, worlds, keepHome })
    }
  } catch (error) {
    log(`suite unwind: ${String(error?.message ?? error)}`)
    record.record.suiteError = String(error?.stack ?? error).split('\n').slice(0, 6).join(' | ')
    const last = worlds[worlds.length - 1]
    if (last !== undefined) record.record.unwindDigest = { mock: last.mockRequestDigest(), ledger: last.ledgerRows() }
  } finally {
    // Owner's cleanup: every world this runner created, torn down in order.
    for (const world of worlds) {
      try {
        await world.teardown({ keepHome })
      } catch (error) {
        log(`teardown(${world.id}) failed: ${String(error?.message ?? error)}`)
      }
    }
    try {
      await rc.stopChild()
    } catch {
      /* idempotent */
    }
    rc.dispose()
  }

  clearTimeout(hardWatchdog)
  // Post-checks: host base still pristine; :3080 unchanged; sibling homes net.
  let hostBasePost = null
  try {
    hostBasePost = factory.assertHostBase('post')
  } catch (error) {
    record.addCase('host-base-pristine-post', 'FAIL', { error: String(error?.message ?? error) })
  }
  const stablePost = await stableInstanceProbe()
  const homesPost = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  record.record.globalPostChecks = {
    hostBasePost,
    stableInstance: { pre: stablePre, post: stablePost, unchanged: stablePre.status === stablePost.status && stablePre.reachable === stablePost.reachable },
    envScrubbedKeys: scrubbed,
    homesCensusChanges: diffCensus(homesPre, homesPost),
  }
  if (stablePre.status !== stablePost.status || stablePre.reachable !== stablePost.reachable) {
    record.addCase('stable-instance-unchanged', 'FAIL', { pre: stablePre, post: stablePost })
  } else {
    record.addCase('stable-instance-unchanged', 'PASS', { status: stablePost.status, note: `read-only probe of :3080 before/after (${String(stablePost.status)})` })
  }
  const rec = record.finalize()
  if (runRecordPath !== null) record.write(runRecordPath)
  uninstall()
  return rec
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const rec = await runSuite(opts)
  console.log(formatSummary(rec))
  process.exit(exitCodeFor(rec))
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`FATAL: ${String(error?.stack ?? error)}`)
    process.exit(2)
  })
}
