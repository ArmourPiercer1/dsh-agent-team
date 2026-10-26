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
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  fetchJson,
} from './lib/world-factory.mjs'
import {
  createFsAssembly,
  makeFsDecide,
  remoteCall,
  hasMarker,
  surfaceNamesOf,
  toolMsgsOf,
  MANAGED_TOOL_NAMES,
  SAFE_UNMANAGED_TOOL_NAMES,
  PROBE_TOOL_NAME,
} from './lib/u6-fs-assembly.mjs'
import { createProcAssembly, makeProcDecide, judgeU6Proc } from './lib/u6-proc-assembly.mjs'
import { createJobsAssembly, makeJobsDecide, judgeU6Jobs, toolExchanges, laneTranscript, extractJobIds, JOBS_WORLD_MANAGED_NAMES } from './lib/u6-jobs-assembly.mjs'
import { createArcAssembly, makeArcDecide, judgeU6ArcA } from './lib/u6-arc-a-assembly.mjs'
import { createArcDAssembly, makeArcDDecide, judgeU6ArcD } from './lib/u6-arc-d-assembly.mjs'
import { createFsMutAssembly, makeFsMutDecide, judgeU7FsMut } from './lib/u7-fsmut-assembly.mjs'
import { findTestRepoRoot, testUseTree } from '../paths.mjs'
import { pidAlive, scanAllLeases } from './lib/port-lease.mjs'
import { createOracle, oraclePaths } from './lib/oracle.mjs'
import { createRunRecord, exitCodeFor, formatSummary } from './lib/run-record.mjs'
import { findIssuedResult, makeCanaryDecide, resultClaimsRan } from './lib/mock-script.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
// u6-pr3 note: the host is the runner's DIRECT child (same process group),
// so this watchdog bounds the HOST, not the drive. The worst-case u6-proc
// drive budget (~13 min of cadence deadlines at last measurement) must fit
// inside it: run u6prc4's 9.5-minute hard watchdog killed a healthy host
// mid-drive and turned a 9/9-shaped chain into 5/9. Backstop semantics are
// unchanged (zombie hosts still die); healthy suites finish far below this.
const RUN_LIFETIME_MS = 19 * 60_000
const CASE_WAIT_MS = 90_000

export const SUITE_CASES = {
  core: ['token-gate', 'positive-control', 'error-return-with-effect', 'planted-defect-detected', 'oracle-blinding-divergence', 'leak-check'],
  'core-restart': ['token-gate', 'positive-control', 'error-return-with-effect', 'planted-defect-detected', 'oracle-blinding-divergence', 'restart-persistence', 'leak-check'],
  negatives: ['wrong-scope-no-effect', 'start-failure-classified', 'timeout-classified', 'interrupt-classified'],
  // FIX-T T2 crash victim: boot, authenticate, drive a canary call into a
  // HELD-IN-FLIGHT state (plugin 'gate' mode: `.pre` written, blocked on a
  // gate file that never appears), announce U5-IN-RUN + U5-IN-FLIGHT, then
  // simply wait to be SIGKILLed (whole process group) by the crash-reclaim
  // supervisor. This suite can never PASS by its own hand: writing its RUN
  // record means the kill never landed — an honest FAIL.
  'crash-victim': ['victim-in-flight'],
  // U6 PR1 shadow-parity (slice-plan "C2 via tests/world-factory ONLY"): the
  // SAME core canary case matrix runs on two Worlds whose only delta is the
  // mounted center-assembly SHADOW (off vs shadow), plus the parity cases.
  'u6-fs': ['fs:mounted', 'fs:governed-read-positive', 'fs:refusal-zero-effect', 'fs:ctl-native-read', 'fs:identity-swap', 'fs:identity-swap-sensitivity', 'fs:toctou-abort', 'fs:shadow-ledger-cap', 'fs:leak-check'],
  // U6 PR3 C2 (ARC-B at the Host): the governed SHELL lane on the SAME
  // kernel instance as the read lane — ask-lane spawn through a
  // kernel-consumed grant, default-deny zero-spawn, settled-request replay
  // refusal, identity-swap plant held off (with its guard-off positive
  // channel), timeout→terminate honesty, and the CI-03 native control.
  // Review-r1 adds the two POSITIVE cases: the World authorises ONE
  // governed bash call through the real Control/ask path (public
  // team.resolveControl seam) and measures exactly-once consume + real
  // spawn on the independent disk oracle, then the same-identity replay
  // refusal with zero second spawn.
  'u6-proc': ['proc:mounted', 'proc:exec-door-fail-closed', 'proc:member-ask-born-terminal', 'proc:deny-zero-spawn', 'proc:replay-settled-refusal', 'proc:spoof-refusal', 'proc:guard-off-channel', 'proc:late-call-refused', 'proc:ctl-native-untouched', 'proc:approve-spawn-once', 'proc:approve-replay-refused'],
  // U6 PR4 C2 (ARC-C, the FIRST named Bridge at the Host): the jobs trio
  // mounted through the governance kernel on a live World — a REAL
  // background job born on the member native lane whose EFFECT stands on
  // disk (independent Oracle), managed through the bridge (list/output/
  // kill), foreign viewer refused with measured zero settlement, kill
  // answered as REQUEST only with the HOST settling, the boot-root native
  // control untouched, and the no-second-ledger law measured over the
  // durable Control lane.
  'u6-jobs': ['jobs:mounted', 'jobs:birth-positive', 'jobs:ci05-governed-fail-closed', 'jobs:owner-fence', 'jobs:kill-refusal-zero-reach', 'jobs:ctl-native-untouched', 'jobs:no-second-ledger', 'jobs:leak-check'],
  // U6 PR5 C2 (ARC-A at the Host): the PROBE FAMILY — a NEW family with
  // ZERO center diff — mounted on the real Host through the lane's own
  // public assembly, beside the PRODUCTION plane whose moved search rows
  // must answer live. The matrix: family mount, the real marker effect read
  // off DISK, the no-entry / replay / post-unload refusals each with ZERO
  // effect, the family's own unload settling, live governed grep+glob over
  // a runner-computed ground truth (the .git decoy proves the native
  // exclusion contract), the anchored containment refusal with zero effect,
  // and the non-Team native grep control.
  'u6-arc-a': ['arca:mounted', 'arca:probe-positive', 'arca:probe-unbound-refused-zero-effect', 'arca:probe-replay-refused-zero-effect', 'arca:probe-unload-settles', 'arca:search-grep-live', 'arca:search-glob-live', 'arca:search-refusal-zero-effect', 'arca:native-grep-control'],
  // U6 PR6 C2 (ARC-D at the Host): the PR5 probe family ATTACKED AS SHIPPED
  // — zero new family code is the claim, so the row mounts the PR5 assembly
  // unchanged. ONE boot, nine legs: mount, positive walk (marker + nonce),
  // replay of a settled grant, self-reported foreign scope, a swapped
  // identity the table never bound, a decide on a never-bound name, honest
  // teardown + post-teardown refusal, the CI-03 native control (a member
  // with NO capabilities block), and the ledger's global arithmetic. Verdict
  // law DISK + LEDGER + HOST LOG — never the model transcript. No shadow
  // twin: the kernel computes refuse verdicts in every mode (assembly header).
  'u6-arc-d': ['arcd:mounted', 'arcd:positive', 'arcd:spoof-zero-authority', 'arcd:swap-refused', 'arcd:unbound-refused', 'arcd:replay-refused', 'arcd:ci03-native-parity', 'arcd:marker-ledger', 'arcd:teardown-honest'],
  // U7-9a C2 (the first S5 per-family delivery): the FS family's MUTATION
  // members — governed write/edit/read_image — on the SAME kernel, ONE
  // World, ZERO center diff (CA-01). The verdict source is the RUNNER'S OWN
  // DISK READS (bytes as they are, never a transcript): governed create and
  // edit land exactly; the never-named deny target stays BYTE-IDENTICAL
  // across a write attempt; the read_image lane must answer HONESTLY (a
  // real run or a typed fail-closed refusal with zero commit — silence
  // fails); the ungoverned boot-root native write lands on its own path and
  // never appears on a governed RAN witness.
  'u7-fs-mut': ['fsm:mounted', 'fsm:write-positive', 'fsm:edit-positive', 'fsm:refusal-zero-effect', 'fsm:image-lane-honest', 'fsm:ctl-native-write', 'fsm:leak-check'],
  'u6-shadow': [
    'off:token-gate', 'off:positive-control', 'off:error-return-with-effect', 'off:planted-defect-detected', 'off:oracle-blinding-divergence', 'off:leak-check',
    'shd:token-gate', 'shd:mounted', 'shd:positive-control', 'shd:error-return-with-effect', 'shd:planted-defect-detected', 'shd:oracle-blinding-divergence', 'shd:leak-check',
    'shadow-parity-ledger', 'shadow-verdicts-observed',
  ],
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const sha256Text = (s) => createHash('sha256').update(s).digest('hex')

/**
 * U6 parity normalization: the canary ledger carries per-world volatile
 * stamps (`at` wall-clock, `world` id; boot ports appear nowhere in the
 * rows). Stripping EXACTLY those keys and comparing the rest byte-identically
 * is the documented normalization of "identical native result ledger"
 * (U6-SLICE-PLAN PR1 C2). The shadow ledger additionally carries `scope`
 * (world-tagged), `callId` (host-minted) and `row` (mount URL identity, kept)
 * — verdict ROWS are only asserted within the ON world, never across worlds,
 * so they shed the volatile keys for readable evidence only.
 */
function stripKeys(rows, keys) {
  if (rows === null || rows === undefined) return null
  const drop = new Set(keys)
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([k]) => !drop.has(k))))
}
const CANARY_VOLATILE = ['at', 'world']
const SHADOW_VOLATILE = ['at', 'world', 'scope', 'callId']

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
async function bootWorld({ factory, record, rc, worldOpts, phase, nonce: nonceIn }) {
  const world = await factory.createWorld(worldOpts)
  record.record.bindings.worldIds.push(world.id)
  // U6 parity: a FIXED nonce makes the two worlds' canary tags identical, so
  // the ledger comparison is meaningful; every other suite keeps a random one.
  const nonce = nonceIn ?? Math.random().toString(36).slice(2, 8)
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
  // No lease file naming this world survives (scan, not path guess). The
  // slot layout keeps one attempt-file per acquisition inside
  // `<port>.lease/` — scanAllLeases walks every slot and parses every file,
  // so a live or leftover lease naming this world can never hide behind an
  // unreadable-directory read (FIX-T T1 layout).
  const heldLeaseEntries = scanAllLeases(factory.leaseRoot).filter((l) => l.by?.world === world.id)
  checks.leasesReleased = heldLeaseEntries.length === 0
  checks.heldLease = heldLeaseEntries.map((l) => `${l.port}:${l.fileName}:alive=${String(l.alive)}`)
  checks.notes = receipts.notes ?? []
  const conjuncts = ['ownedPidsDead', 'portsReleased', 'homeReleased', 'leasesReleased']
  return { ok: conjuncts.every((k) => checks[k] === true), detail: checks }
}

// ─────────────────────────────────────────────────────────────────────────────
// core: one World, one boot (plus optional restart leg)
// ─────────────────────────────────────────────────────────────────────────────
async function runCore({ factory, record, rc, log, line, suite, worlds, keepHome, casePrefix = '', nonce: nonceIn = undefined, afterBoot = null, collect = null, extraWorldOpts = {} }) {
  const ctx = await bootWorld({ factory, record, rc, worldOpts: { line, ...extraWorldOpts }, phase: `${casePrefix}boot1`, nonce: nonceIn })
  worlds.push(ctx.world)
  const { world, nonce, queue, issued } = ctx
  const origin = `http://127.0.0.1:${ctx.boot.port}`
  const oracle = createOracle({ ...oraclePaths(world), hostLogPath: ctx.boot.logPath })
  // U6 parity: per-case effect digests collected for the cross-world check.
  const effects = {}

  if (afterBoot !== null) await afterBoot({ world, boot: ctx.boot, nonce })

  const noToken = await probeNoToken(origin)
  record.addCase(casePrefix + 'token-gate', noToken === 401 ? 'PASS' : 'FAIL', { status: noToken })
  record.record[`${casePrefix}boot1Evidence`] = {
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
  record.record[`${casePrefix}session`] = { sessionId, workspace: world.workspaceDir }
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
    effects['positive-control'] = { effect: effect.effect, roundTripped: resultWait.hit, resultErrored: result.found && result.isError }
    record.addCase(casePrefix + 'positive-control', effect.effect && resultWait.hit && !result.isError ? 'PASS' : 'FAIL', {
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
    effects['error-return-with-effect'] = { effect: effect.effect, resultErrored: result.isError === true, roundTripped: resultWait.hit }
    record.addCase(casePrefix + 'error-return-with-effect', effect.effect && resultWait.hit && result.isError ? 'PASS' : 'FAIL', {
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
    effects['planted-defect-detected'] = { toolClaimedRan: returnedRan, soundOracleEffect: sound.effect, blindedOracleEffect: blinded.effect }
    record.addCase(casePrefix + 'planted-defect-detected', caught ? 'PASS' : 'FAIL', {
      tag,
      toolClaimedRan: returnedRan,
      soundOracleEffect: sound.effect,
      note: 'defect mode lies (ran:true, writes nothing); a sound Oracle must report NO effect — a PASS here IS the fault-planting RED',
      observation: summarizeObs(obs),
      resultWaitedMs: resultWait.waitedMs,
    })
    record.addCase(casePrefix + 'oracle-blinding-divergence', sound.effect !== blinded.effect && blinded.effect === true ? 'PASS' : 'FAIL', {
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
  if (collect !== null) {
    // Capture BEFORE teardown deletes the World home (the ledgers live there).
    // Normalization (documented, U6 C2): volatile KEYS stripped (`at`, `world`,
    // shadow: `scope`/`callId`) AND the per-world home path inside any value
    // replaced by `<HOME>` — the canary's `marker-ran` row carries the absolute
    // marker path, which is the world identity wearing a field costume.
    const homeNorm = (rows, keys) => {
      const stripped = stripKeys(rows, keys)
      if (stripped === null) return null
      return stripped.map((row) => JSON.parse(JSON.stringify(row).replaceAll(world.home, '<HOME>')))
    }
    collect.effects = effects
    collect.canaryRowsNormalized = homeNorm(world.ledgerRows(), CANARY_VOLATILE)
    collect.shadowRowsNormalized = homeNorm(world.shadowLedgerRows(), SHADOW_VOLATILE)
    collect.canaryDigest = sha256Text(JSON.stringify(collect.canaryRowsNormalized))
    collect.markerFiles = oracle.observe({ tag: `pos-${nonce}` }).channels.markers.files.slice()
  }
  await rc.stopChild()
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  record.addCase(casePrefix + 'leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
}

// ─────────────────────────────────────────────────────────────────────────────
// u6-shadow (U6 PR1 C2): the core canary matrix on TWO Worlds whose only
// delta is the mounted center-assembly shadow (off vs shadow). Reuses runCore
// unchanged in mechanics — same boot helper, same script, same Oracle.
// Parity law (slice plan): identical NATIVE result ledger (canary ledger
// rows, documented normalization — `at`/`world` stripped, fixed nonce makes
// tags world-independent) AND the Oracle sees the same external effects
// (marker file names + per-case effect verdicts). The shadow audit ledger is
// asserted ONLY inside the ON world (verdict rows exist, none allows; the
// OFF world's row proves mounted-but-installed-nothing).
// ─────────────────────────────────────────────────────────────────────────────
const PARITY_NONCE = 'u6px'

async function runShadowParity({ factory, record, rc, log, line, worlds, keepHome, evidence }) {
  const off = {}
  const shd = {}
  log('shadow-parity world 1/2: assembly=off')
  await runCore({
    factory, record, rc, log, line: `${line}off`, suite: 'core', worlds, keepHome,
    casePrefix: 'off:', nonce: PARITY_NONCE, collect: off,
    extraWorldOpts: { centerAssembly: 'off' },
  })
  log('shadow-parity world 2/2: assembly=shadow')
  await runCore({
    factory, record, rc, log, line: `${line}shd`, suite: 'core', worlds, keepHome,
    casePrefix: 'shd:', nonce: PARITY_NONCE, collect: shd,
    extraWorldOpts: { centerAssembly: 'shadow' },
    afterBoot: async ({ world }) => {
      // Deterministic install: the mount row appends center-mounted (or
      // center-error) once its async import settles — never race the cases.
      const w = await waitUntil(
        () => (world.shadowLedgerRows() ?? []).some((r) => r.leg === 'center-mounted' || r.leg === 'center-error'),
        { timeoutMs: 20_000, signal: rc.signal },
      )
      const mounted = (world.shadowLedgerRows() ?? []).some((r) => r.leg === 'center-mounted')
      record.addCase('shd:mounted', w.hit && mounted ? 'PASS' : 'FAIL', {
        waitedMs: w.waitedMs,
        rows: stripKeys(world.shadowLedgerRows(), SHADOW_VOLATILE),
      })
    },
  })

  record.record.shadowParity = { nonce: PARITY_NONCE, off, shd }
  try {
    writeFileSync(join(evidence, 'u6-shadow-parity.json'), JSON.stringify({ nonce: PARITY_NONCE, off, shd }, null, 2) + '\n')
  } catch (error) {
    log(`parity evidence write failed: ${String(error?.message ?? error)}`)
  }

  // ── case 1: native-path parity ────────────────────────────────────────────
  const ledgerParity = typeof off.canaryDigest === 'string' && off.canaryDigest === shd.canaryDigest
  const comparedCases = ['token-gate', 'positive-control', 'error-return-with-effect', 'planted-defect-detected', 'oracle-blinding-divergence']
  const caseParity = comparedCases.every((id) => {
    const a = record.getCase(`off:${id}`)
    const b = record.getCase(`shd:${id}`)
    return a?.verdict === 'PASS' && b?.verdict === 'PASS'
  })
  const effectParity = JSON.stringify(off.effects ?? null) === JSON.stringify(shd.effects ?? null)
  const markersParity = JSON.stringify(off.markerFiles ?? null) === JSON.stringify(shd.markerFiles ?? null)
  record.addCase('shadow-parity-ledger', ledgerParity && caseParity && effectParity && markersParity ? 'PASS' : 'FAIL', {
    canaryLedgerShaOff: off.canaryDigest ?? null,
    canaryLedgerShaShadow: shd.canaryDigest ?? null,
    ledgerParity, caseParity, effectParity, markersParity,
    markerFiles: off.markerFiles ?? null,
    offEffects: off.effects ?? null,
    shadowEffects: shd.effects ?? null,
    note: 'normalization: canary rows minus at/world (fixed nonce); marker NAMES not bytes; oracle channels independent of tool returns',
  })

  // ── case 2: the shadow actually observed the calls (and only audited) ─────
  const shdRows = shd.shadowRowsNormalized ?? []
  const offRows = off.shadowRowsNormalized ?? []
  const mounted = shdRows.some((r) => r.leg === 'center-mounted')
  const verdicts = shdRows.filter((r) => r.leg === 'shadow-verdict')
  const canaryVerdicts = verdicts.filter((r) => r.name === 'u5_canary')
  const noAuthority = canaryVerdicts.every((r) => r.outcome === 'defer' || r.outcome === 'refuse')
  const offInert = offRows.length >= 1 && offRows.every((r) => r.leg === 'center-skipped')
  record.addCase('shadow-verdicts-observed', mounted && offInert && canaryVerdicts.length >= 3 && noAuthority ? 'PASS' : 'FAIL', {
    mounted,
    offInert,
    canaryVerdictCount: canaryVerdicts.length,
    verdictOutcomes: canaryVerdicts.map((r) => `${r.outcome}:${r.code ?? 'n/a'}`),
    anyAllow: verdicts.some((r) => r.outcome === 'allow'),
    shadowErrorRows: shdRows.filter((r) => r.leg === 'shadow-error').length,
    note: 'PR1 truth: table fed NOTHING -> every verdict defers (NO_APPROVAL_ENTRY); a non-defer outcome or any allow here would mean authority leaked into the shadow',
  })
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

// ─────────────────────────────────────────────────────────────────────────────
// u6-fs (U6 PR2 C2): ONE governed Team World on the pinned Host — the kernel-
// owned governed `read` lane, its deny lane, the permissions-less CI-03 lane,
// and the probe row's identity-swap / re-registration-window PLANTS. Case
// ids carry the `fs:` prefix; verdicts need effect evidence OUTSIDE the
// model transcript (probe ledger + marker dir + host-log hits + host pid).
// ─────────────────────────────────────────────────────────────────────────────
async function runU6Fs({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }) {
  const CASE_IDS = SUITE_CASES['u6-fs']
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 220)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const redactLine = (t) => String(t).replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>').slice(0, 260)
  // runU6Fs waits are async predicates (HTTP probes); the module-level
  // waitUntil tests `predicate() === true` and would never see a Promise.
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try {
        hit = (await predicate()) === true
      } catch {
        hit = false
      }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (one host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6Fs: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createFsAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles() // must precede teamRows(): the plane rootDir canonicalizes the workspace
  world.u6Fs.rows.push(...assembly.teamRows())
  // THE GATE EYE (b5 lesson): the leader phase machine's ledger gates only
  // mean something when they read the probe's REAL ledger — b5 ran with the
  // default () => [] reader, every gate opened on its bounded overrun, and
  // the plant legs read STALE pre-plant evidence. The reader is a fresh
  // sync read per leader turn (append-only file, shared FS).
  await world.startMock({ decide: makeFsDecide({ assembly, readProbeLedger: () => readLedgerRows(world.u6fsLedgerPath) }) })
  record.logHostStart({ world: world.id, phase: 'u6fs-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6fs-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6fsLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6fsMarkerDir) } catch { return [] }
  }

  // ── readiness: p6t6 health + anchored team session + probe mount ─────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, { timeoutMs: 120_000 })
  if (!healthW.hit || health?.body?.ok !== true) {
    add('fs:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.phase === 'create' && stateBody?.teamSession !== null
  }, { timeoutMs: 90_000 })
  const mountedRow = probeLedger().find((r) => r.leg === 'register' && r.kind === 'probe-tool')
  add('fs:mounted', stateW.hit && mountedRow?.ok === true && hostAlive() ? 'PASS' : 'FAIL', {
    teamSession: stateBody?.teamSession !== null && stateBody?.teamSession !== undefined,
    probeRegister: mountedRow ?? { missing: true },
    hostAlive: hostAlive(),
    listenLegs: probeLedger().filter((r) => r.leg === 'listen').map((r) => `${String(r.event)}:${String(r.ok)}`),
  })
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }

  // ── discovery prompt -> builtinToolDeny -> main blueprint -> team.create ─
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6fs')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  // the probe tool stays IN the deny list: it is unmanaged surface that the
  // A2C-2 coverage gate must see declared (measured b2); it is never called
  // from a governed lane.
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  // HOST-IDENTICAL ingest receipt BEFORE team.create: the emitted documents
  // are re-parsed with the host catalog's own validator (the dist domain
  // facade the host-loaded plugin imports). run7 spent its boot learning
  // the catalog fails ingest as MALFORMED_DTO 'blueprint not found in
  // catalog'; this line turns that outcome into an offline-shaped throw
  // (writeMainBlueprint already refuses to write a rejected document).
  record.record.u6arcaIngest = assembly.assertBlueprintIngestible()
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive: the LEADER chain owns all ordering (see makeFsDecide); the
  // runner only fires the three plant triggers on the UNGOVERNED boot-root
  // session at the observation points, each completion proven by the probe
  // LEDGER (never by transcript): swap before the under-swap read, restore
  // before the post-restore read, the toctou arm before the in-window read.
  // The leader's ledger gates poll until each trigger row lands, so there is
  // no cross-process race: at worst a gate exhausts its rounds and the
  // affected leg FAILS honestly on its own evidence.
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const laneDone = { strict: false, ctl: false, sens1: false, swapped: false, sens2: false, toctou: false, swapTrigger: false, restoreTrigger: false, toctouTrigger: false, leader: false }
  record.record.u6fsLanes = laneDone
  const awaitReply = async (content, timeoutMs) => (await waitUntil(() => replySeen(content), { timeoutMs })).hit
  const fireTrigger = async (markerText, pred, timeoutMs = 90_000) => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6fs-trig')
    if (pr.status !== 200) {
      log(`trigger prompt ${String(markerText).slice(0, 40)} rejected: status=${String(pr.status)} ${JSON.stringify(pr.body ?? null).slice(0, 160)}`)
      return false
    }
    return (await waitA(pred, timeoutMs)).hit
  }
  // SYNCHRONIZED RHYTHM v2 (b5+b6 lessons): the leader chain is the TEAM
  // ROOT session's own loop (b6 forensics: the anchor-root session is a
  // DIFFERENT team root — team tools addressed from there were rejected
  // with TEAM_TOOL_CALLER_ROOT_MISMATCH). Fences advance through the WAKE
  // PROTOCOL (settled notice → team_collect over the ORIGINAL token — the
  // durable answer rides the result); gates HOLD their turn cheaply and
  // ONLY the runner's wake re-enters them, fired on the TEAM ROOT and only
  // AFTER the plant trigger's ledger row is proven. So: plant ordering is
  // structural (the gate cannot open early), and a parked chain is always
  // re-enterable. Boundary texts are the members' DONE replies (unique
  // strings, proven by the mock corpus in b5).
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6FS_PHASE_${tag}`, 'u6fs-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (doneText, deadlineMs, tag) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(doneText)) return true
      if (Date.now() - t0 > deadlineMs) return replySeen(doneText)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  laneDone.strict = await wakeCadence('U6FS_STRICT_DONE', 90_000, 's')
  laneDone.ctl = await wakeCadence('U6FS_CTL_DONE', 75_000, 'c')
  laneDone.sens1 = await wakeCadence('U6FS_SENS1_DONE', 75_000, 'x')
  // plant triggers land FIRST (on the anchor-root session, where the probe
  // row is proven visible from b5); the gates hold until the LEDGER proves
  // the plant ran, so the ordering cannot race.
  laneDone.swapTrigger = await fireTrigger(assembly.markers.T_SWAP, () => probeLedger().some((r) => r.leg === 'spoof-attempt' && r.trigger === 'probe-body'))
  laneDone.swapped = await wakeCadence('U6FS_SWAPPED_DONE', 90_000, 'w')
  laneDone.restoreTrigger = await fireTrigger(assembly.markers.T_RESTORE, () => probeLedger().some((r) => r.leg === 'spoof-restore'))
  laneDone.sens2 = await wakeCadence('U6FS_SENS2_DONE', 75_000, 'y')
  laneDone.toctouTrigger = await fireTrigger(assembly.markers.T_TOCTOU, () => probeLedger().some((r) => (r.leg === 'probe-body-ran' && r.action === 'toctou') || r.leg === 'toctou-arm'))
  laneDone.toctou = await wakeCadence('U6FS_TOCTOU_DONE', 90_000, 't')
  laneDone.leader = await wakeCadence('U6FS_L1_DONE', 60_000, 'z')
  if (!laneDone.leader) {
    const stuck = world.mock.requests.map((r) => (r.reply?.kind === 'text' ? String(r.reply.content ?? '') : '')).filter((x) => x.startsWith('U6FS_ID_FAIL'))
    log(`leader chain did not close cleanly${stuck.length > 0 ? ` (${stuck[stuck.length - 1]})` : ''}; verdicts read the evidence as-is`)
  }

  // ── evidence collection (all channels; digests, tokens never recorded) ───
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const spoofBodyMarkers = markerFiles.filter((m) => m.startsWith('spoof-read-body-ran-'))
  const kernelHits = (() => {
    const pats = ['kernel-post-success-drift-veto', 'a5g7: placement-feed rows=', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED', 'a5m1-authority-leg', 'ABORTED_BEFORE_DISPATCH', 'cannot be verified at dispatch']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  })()
  const readResults = probeRows.filter((r) => r.leg === 'read-result')
  const readExecutes = probeRows.filter((r) => r.leg === 'read-execute')
  const swapAttempts = probeRows.filter((r) => r.leg === 'spoof-attempt')
  const registerAttempts = probeRows.filter((r) => r.leg === 'spoof-register')
  const restoreRows = probeRows.filter((r) => r.leg === 'spoof-restore')
  const toctouArms = probeRows.filter((r) => r.leg === 'toctou-arm')
  const digest = {
    surface, denyList,
    claims: Object.fromEntries(Object.entries(assembly.files).map(([k, f]) => [k, claimOccurrences(f.claim)])),
    spoofBodyMarkers,
    restoreRows, toctouArms,
    swapAttempts,
    registerAttempts,
    readExecutes: readExecutes.map((r) => ({ path: r.path, agent: r.agent })),
    readResults: readResults.map((r) => ({ isError: r.isError, cancelled: r.cancelled, head: String(r.head ?? '').slice(0, 160) })),
    kernelHits,
    laneDone,
  }
  record.record.u6fsDigest = digest
  try {
    writeFileSync(join(evidence, `${runId}.u6fs-evidence.json`), JSON.stringify(digest, null, 2) + '\n')
  } catch { /* evidence is best-effort; the RUN record carries the digest */ }

  // ── verdicts ──────────────────────────────────────────────────────────────
  const F = assembly.files
  // positive: the claim can only come from the host's own read Body; the
  // probe's observation ledger (a channel independent of the transcript)
  // must have seen the same content answered.
  const positiveObserved = readResults.some((r) => r.isError !== true && String(r.head ?? '').includes(F.s1.claim))
  add('fs:governed-read-positive',
    claimOccurrences(F.s1.claim) > 0 && positiveObserved && hostAlive() ? 'PASS' : 'FAIL',
    { claimOccurrences: claimOccurrences(F.s1.claim), probeObserved: positiveObserved, hostAlive: hostAlive(),
      note: 'SOUND = claim-in-result (only the file is its source) AND probe-row observation of the answered content AND host alive' })
  // refusal: the denied file's claim never appears; the call reached the
  // dispatcher (read-execute) and its observed result carries the KERNEL's
  // own typed word for this lane (measured offline on the current dist:
  // default-deny lands `IO_POLICY_UNSUPPORTED` / `template-default-deny`
  // BEFORE any byte is read; the guard/dispatch refusals are the fallback
  // witnesses if the lane shape ever moves).
  const denyExecuted = readExecutes.some((r) => String(r.path ?? '').includes('u6fs-denied'))
  const denialWords = /IO_POLICY_UNSUPPORTED|template-default-deny|permission denied|cannot be verified at dispatch|APPROVAL_DENIED|guard/i
  const denyRefusedObserved = readResults.some((r) => r.isError === true
    && !String(r.head ?? '').includes(F.denied.claim)
    && String(r.path ?? '').includes('u6fs-denied')
    && denialWords.test(String(r.head ?? '')))
  add('fs:refusal-zero-effect',
    claimOccurrences(F.denied.claim) === 0 && denyExecuted && denyRefusedObserved && hostAlive() ? 'PASS' : 'FAIL',
    { deniedClaimOccurrences: claimOccurrences(F.denied.claim), denyExecuted, denyRefusedObserved, hostAlive: hostAlive() })
  // CI-03: the permissions-less template's native read ran, observed by the
  // probe row (its claim file c1 is only ever asked on the ctl lane).
  const ctlObserved = readResults.some((r) => r.isError !== true && String(r.head ?? '').includes(F.c1.claim))
  add('fs:ctl-native-read',
    claimOccurrences(F.c1.claim) > 0 && ctlObserved && hostAlive() ? 'PASS' : 'FAIL',
    { claimOccurrences: claimOccurrences(F.c1.claim), probeObserved: ctlObserved, hostAlive: hostAlive() })

  // Plant verdicts. Two HOST-LEGAL arms are scored, chosen by what the probe
  // ledger says actually happened; NO arm accepts a spoof Body success:
  //  arm 'refused-at-dispatch' — a spoof registration BECAME the live
  //    resolution for the governed name and the guard refused the call:
  //    target claim ABSENT, spoof Body marker ABSENT.
  //  arm 'registration-refused' — the host registry/scope law made the spoof
  //    never win resolution: the governed row keeps answering CORRECTLY
  //    (claim present with the real content) and the spoof Body marker is
  //    ABSENT. A hijacked answer (spoof marker, or claim absent AND governed
  //    row silent) fails every arm.
  const plantAttempted = (trigger) => swapAttempts.find((a) => a.trigger === trigger)
  // ATTEMPT-RELATIVE law (b5 lesson): a plant leg may ONLY be spoken for by
  // observations taken AFTER the plant landed. Pre-plant reads of the same
  // file are stale evidence and can never produce a PASS.
  const afterAt = (rows, at) => rows.filter((r) => String(r.at ?? '') > String(at))
  // (b7 lesson: the assembly's file entries carry {path, claim} ONLY — a
  // `file.name` read is undefined and `includes(undefined)` never fires.)
  const fname = (file) => String(file.path).slice(String(file.path).lastIndexOf('/') + 1)
  const plantArm = (trigger, file) => {
    const name = fname(file)
    const attempt = plantAttempted(trigger)
    if (attempt === undefined) return { verdict: 'FAIL', why: `no spoof-attempt ledger row for trigger=${trigger} (the plant never ran)` }
    if (spoofBodyMarkers.length > 0) return { verdict: 'FAIL', why: `spoof Body markers exist: ${spoofBodyMarkers.join(',')} — a spoof body ANSWERED (or stamping ran); no arm forgives this` }
    const attemptAt = attempt.at
    const postResults = afterAt(readResults, attemptAt)
    const postExecutes = afterAt(readExecutes, attemptAt)
    const answeredCorrectly = postResults.some((r) => r.isError !== true
      && String(r.path ?? '').includes(name)
      && String(r.head ?? '').includes(file.claim))
    if (answeredCorrectly) {
      // AFTER the plant, the governed row still answered CORRECTLY and no
      // spoof body ran: wherever the spoof landed (threw, or a scope the
      // governed resolution never consults), the kernel-owned identity held.
      return { verdict: 'PASS', arm: 'registration-refused',
        why: `post-attempt (${String(attemptAt).slice(11, 23)}Z): the governed read answered with the real content and zero spoof-Body markers — the spoof either threw at registration (host scope law) or landed only in scopes the governed resolution masks; the kernel-table swap itself stays pinned by C1 (u6-pr2-kernel-guard-plants)` }
    }
    const dispatched = postExecutes.some((r) => String(r.path ?? '').includes(name))
    const refusal = postResults.find((r) => r.isError === true
      && String(r.path ?? '').includes(name)
      && /cannot be verified|ABORTED|refused|guard|denied/i.test(String(r.head ?? '')))
    if (dispatched && refusal !== undefined) {
      return { verdict: 'PASS', arm: 'refused-at-dispatch',
        why: `spoof placed in [${(Array.isArray(attempt.placedScopes) ? attempt.placedScopes : []).join(',')}], the post-attempt governed call was REFUSED at dispatch with zero spoof-Body effect (verbatim head: ${String(refusal.head ?? '').slice(0, 140)})` }
    }
    if (!dispatched) return { verdict: 'FAIL', why: `no POST-ATTEMPT dispatch of the target was observed (plant at ${String(attemptAt).slice(11, 23)}Z) — stale pre-plant reads never speak for the plant leg` }
    return { verdict: 'FAIL', why: 'the post-attempt call was dispatched, produced neither the governed answer nor a named refusal — unexplained silence' }
  }
  const swapVerdict = plantArm('probe-body', F.s3)
  add('fs:identity-swap', swapVerdict.verdict, {
    arm: swapVerdict.arm ?? null, why: swapVerdict.why,
    registerAttempts: registerAttempts.map((r) => ({ scope: r.scope, trigger: r.trigger, ok: r.ok, error: r.error === undefined ? undefined : String(r.error).slice(0, 120) })),
    spoofBodyMarkers, kernelGuardHits: Object.fromEntries(Object.entries(kernelHits).filter(([, v]) => v.count > 0).map(([k, v]) => [k, v.count])),
  })
  // sensitivity: reads run immediately before the swap and immediately after
  // restore — the swap verdict cannot be explained by a dead lane.
  // Sensitivity is an ORDER statement, not just an existence statement:
  // the pre-swap read must predate the swap, the under-swap read must sit
  // between swap and restore, and the post-restore read must postdate the
  // restore — otherwise the swap verdict could be stale-lane noise.
  const firstAt = (rows, pred) => rows.filter(pred).map((r) => String(r.at ?? '')).sort()[0] ?? ''
  const okReadAt = (name, claim) => firstAt(readResults, (r) => r.isError !== true
    && String(r.path ?? '').includes(name) && String(r.head ?? '').includes(claim))
  const swapAt = String(plantAttempted('probe-body')?.at ?? '')
  const restoreAt = String(restoreRows[0]?.at ?? '')
  const s2At = okReadAt('u6fs-s2', F.s2.claim)
  const s3At = okReadAt('u6fs-s3', F.s3.claim)
  const s4At = okReadAt('u6fs-s4', F.s4.claim)
  const orderOk = s2At !== '' && s3At !== '' && s4At !== '' && swapAt !== '' && restoreAt !== ''
    && s2At < swapAt && swapAt < s3At && s3At < restoreAt && restoreAt < s4At
  const sensOk = orderOk && claimOccurrences(F.s2.claim) > 0 && claimOccurrences(F.s4.claim) > 0
  add('fs:identity-swap-sensitivity', sensOk && spoofBodyMarkers.length === 0 && hostAlive() ? 'PASS' : 'FAIL',
    { s2At, swapAt, s3At, restoreAt, s4At, orderOk,
      s2Occurrences: claimOccurrences(F.s2.claim), s4Occurrences: claimOccurrences(F.s4.claim), hostAlive: hostAlive() })
  const toctouVerdict = plantArm('execute-window', F.s5)
  add('fs:toctou-abort', toctouVerdict.verdict, {
    arm: toctouVerdict.arm ?? null, why: toctouVerdict.why,
    inWindowRegisters: registerAttempts.filter((r) => String(r.trigger ?? '').includes('execute-window')).map((r) => ({ scope: r.scope, ok: r.ok })),
    spoofBodyMarkers,
  })

  // ── R-REM-3: the shadow audit LEDGER must have hit its K5 cap here ──────
  // (the product row mounted with a 5-row budget; the cap is an
  // audit-channel event — one terminal marker, then the appends stop while
  // the OBSERVE channel keeps every row and the call flow never notices).
  {
    const shadowPath = join(world.home, 'u6fs-shadow-ledger.jsonl')
    let rows = []
    try {
      rows = readFileSync(shadowPath, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
    } catch { /* absent = FAIL below with the read error stated */ }
    const markers = rows.filter((r) => r?.leg === 'shadow-ledger-capped')
    const installs = rows.filter((r) => r?.leg === 'shadow-installed')
    // zero-flow proof: the S4 read happens LONG after the 5-row budget is
    // spent — its claim answering proves the governed lane kept working on
    // a capped audit channel.
    const postCapRead = claimOccurrences(F.s4.claim) > 0
    // Review-r1 B5: the post-cap proof must NOT lean on the capped ledger
    // itself nor on the tool return. The probe's tools/post-execute oracle
    // reads the S4 FILE ITSELF at the fs boundary (leg: 'oracle-read-effect'
    // — bytes/sha256/claimSeen from the oracle's own readFileSync) and the
    // timestamp tie below binds one such observation to the post-cap window
    // (at >= the last capped marker's at). All three witnesses — transcript,
    // oracle, ledger marker — must agree.
    const capAt = String(markers[markers.length - 1]?.at ?? '')
    const oracleRows = probeLedger().filter((r) => r?.leg === 'oracle-read-effect' && r.pathTail === 'u6fs-s4.txt')
    const postCapOracle = oracleRows.filter((r) => r.claimSeen === true && capAt !== '' && String(r.at ?? '') >= capAt)
    add('fs:shadow-ledger-cap',
      markers.length > 0 && hostAlive() && postCapRead && postCapOracle.length > 0 ? 'PASS' : 'FAIL',
      { rows: rows.length, cappedMarkers: markers.length, installs: installs.length,
        budgets: markers[0] ? { maxLedgerRows: markers[0].maxLedgerRows, maxLedgerBytes: markers[0].maxLedgerBytes } : null,
        hostAlive: hostAlive(), postCapReadSucceeded: postCapRead,
        oraclePostCapRows: postCapOracle.length,
        oracleReceipt: postCapOracle.length > 0 ? {
          at: postCapOracle[postCapOracle.length - 1].at, pathTail: 'u6fs-s4.txt',
          bytes: postCapOracle[postCapOracle.length - 1].bytes,
          sha256: postCapOracle[postCapOracle.length - 1].sha256,
          claimSeen: true, capAt,
        } : null,
        detail: 'K5 terminal marker present, flow unaffected; post-cap read proven by an INDEPENDENT oracle observation of the read effect (oracle bytes/sha256, timestamped after the cap marker) (R-REM-3 cap-hit evidence)' })
  }

  // ── leak-check: teardown, then the factory's owned-resources audit ───────
  try {
    await rc.stopChild()
  } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  add('fs:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
}

/**
 * FIX-T T2 crash victim (suite `crash-victim`, driven by
 * u5-parallel-supervisor --mode crash-reclaim). Boot → authenticate →
 * session → drive ONE canary call into the plugin's `gate` mode: the tool
 * body writes `<tag>.pre`, then BLOCKS on a gate file that is never created
 * (capped at 300 s so a leaked World always terminates). Once the pre-marker
 * is observed from outside, the runner prints
 *   U5-IN-FLIGHT <worldId> <home> <hostPid> <tag>
 * and simply waits for the call to complete. The supervisor SIGKILLs this
 * runner's whole (detached, own) process group inside that window — the
 * runner never reaches the lines below. Reaching them means the abnormal
 * kill never landed, which is recorded as an honest FAIL: this suite can
 * never write a PASS; the crash-reclaim PASS verdict lives in the
 * supervisor's record, gated on the in-flight proofs read there.
 */
// u6-proc (U6 PR3 C2 / ARC-B at the Host): ONE governed Team World whose
// plane carries BOTH governed lanes — the read row (PR2) and the shell row
// (PR3) — on ONE kernel instance, ONE ledger. The case matrix drives the
// ask-lane spawn (grant minted on the durable Control lane, consumed EXACTLY
// ONCE by the kernel), the default-deny typed refusal with ZERO spawned
// processes, the settled-request replay refusal, the identity-swap plant
// against the kernel-owned `team_bash` identity (plus its guard-off positive
// channel), the timeout→terminate honesty arm, and the CI-03 native control.
// Verdicts lean on DISK effect oracles + the probe ledger + host-log hits —
// never on the model transcript alone (review-r1 F5 law from PR2).
async function runU6Proc({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }) {
  const CASE_IDS = SUITE_CASES['u6-proc']
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const redactLine = (t) => String(t).replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>').slice(0, 260)
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try {
        hit = (await predicate()) === true
      } catch {
        hit = false
      }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6Proc: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createProcAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles()
  world.u6Proc.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeProcDecide({ assembly, readProbeLedger: () => readLedgerRows(world.u6procLedgerPath) }) })
  record.logHostStart({ world: world.id, phase: 'u6proc-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6proc-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6procLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6procMarkerDir) } catch { return [] }
  }

  // ── readiness: p6t6 health + anchored team session + probe mount ─────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('proc:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000)
  const mountedRow = probeLedger().find((r) => r.leg === 'register' && r.kind === 'probe-tool')
  // mount evidence OUTSIDE the probe too: the host log must carry the
  // placement feed for the plane and NONE of the refusal codes (the kernel
  // is now mount-wide: a registration refusal or PLANE_KERNEL_UNAVAILABLE
  // would name itself in the log and every governed call would fail).
  const kernelHits = () => {
    const pats = ['a5g7: placement-feed rows=', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED',
      'PLANE_KERNEL_UNAVAILABLE', 'PLANE_PROCESS_REGISTRATION_REFUSED', 'PLANE_READ_REGISTRATION_REFUSED',
      'cannot be verified at dispatch']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  }
  // Early mount facts; the VERDICT is added at evidence time — the plane's
  // placement-feed echo lands when the first governed agent is created,
  // which is AFTER team.create (judging it here off the just-booted log is
  // what made run 2 fail a healthy mount).
  const earlyMount = {
    teamSession: stateBody?.teamSession !== null && stateBody?.teamSession !== undefined,
    probeRegister: mountedRow ?? { missing: true },
    listenLegs: probeLedger().filter((r) => r.leg === 'listen').map((r) => `${String(r.event)}:${String(r.ok)}`),
    launcherPin: { launcher: assembly.LAUNCHER, sha256: assembly.launcherSha() },
  }
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }

  // ── discovery prompt -> builtinToolDeny -> main blueprint -> team.create ─
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6proc')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  // (b2 law from u6-fs, kept verbatim in meaning: the probe tool and the
  // channel tool are unmanaged surface the A2C-2 COVERAGE GATE must see
  // declared — deny is coverage here, not a call site: no governed lane
  // ever calls them; the plants ride the boot-root session.)
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive ─────────────────────────────────────────────────────────────────
  // The leader chain owns all ordering; the runner fires the plant triggers
  // on the UNGOVERNED boot-root session and wakes the parked chain (u6-fs
  // rhythm, reused). For the THREE leader exec calls the runner takes the
  // HUMAN USER role: it watches the durable control lane through the p6t6
  // observer (`state.control.requests`) and settles each pending
  // user-approval request through the PUBLIC `team.resolveControl` seam —
  // the very endpoint the GUI calls for a human operator. No private API,
  // no test backdoor: this IS the product's human lane, driven honestly.
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const anyReplySeen = (contents) => contents.some((c) => replySeen(c))
  const laneDone = {}
  record.record.u6procLanes = laneDone
  const fireTrigger = async (markerText, pred, timeoutMs = 90_000) => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6proc-trig')
    if (pr.status !== 200) {
      log(`trigger prompt ${String(markerText).slice(0, 40)} rejected: status=${String(pr.status)} ${JSON.stringify(pr.body ?? null).slice(0, 160)}`)
      return false
    }
    return (await waitA(pred, timeoutMs)).hit
  }
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6PROC_PHASE_${tag}`, 'u6proc-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (doneTexts, deadlineMs, tag) => {
    const texts = Array.isArray(doneTexts) ? doneTexts : [doneTexts]
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (anyReplySeen(texts)) return true
      if (Date.now() - t0 > deadlineMs) return anyReplySeen(texts)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  const teamSessionId = stateBody?.teamSession?.rootSessionId ?? assembly.CREATE_ROOT
  const stateSnapshot = async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    return st?.body ?? null
  }
  const controlSnapshot = async () => (await stateSnapshot())?.control ?? null
  // Bridge forensics: the AUTH bridge (pa-control-bridge) and the plane
  // record every PA-leg stage (leg-deny details included) in the row's
  // observations stream — the p6t6 observer publishes it verbatim. The
  // positive arm captures those lines so every refusal carries its OWN
  // stated cause in the evidence, never an inferred one.
  const FORENSIC = /a5-pa-bridge|pa-ask|PA ask|production-admission|a5m1-binding|exec dual-gate|dual-gate/i
  const forensicLines = new Set()
  const captureForensic = async () => {
    const st = await stateSnapshot()
    for (const line of (st?.observations ?? [])) {
      const text = String(line ?? '')
      if (FORENSIC.test(text)) forensicLines.add(text.slice(0, 400))
    }
  }
  const resolvedAsks = []
  laneDone.mask = await wakeCadence('U6PROC_MASK_DONE', 90_000, 'm')
  laneDone.deny = await wakeCadence('U6PROC_DENY_DONE', 90_000, 'd')
  // ── review-r1 POSITIVE arm: the ask-lane member (default:ask, no shell
  // rule) issues its governed team_bash; the call BLOCKS on its real
  // pending Control row. The runner observes the row through the p6t6
  // observer (no private API) and settles it with the PUBLIC
  // team.resolveControl v4 seam — the very endpoint the GUI calls for a
  // human operator. Approval -> bridge -> kernel consumeOnce (exactly one
  // port call; the consumption row count is the durable witness) -> the
  // confined provider REALLY spawns; the world-workspace marker file is
  // the independent oracle. The member then re-issues the identical
  // command in-world (same approval-case identity): the replay attempt
  // must be refused and must NOT spawn a second process.
  const apprArm = { pendingSeen: false, requestId: null, kind: null, resolveBody: null, resolvedOk: false, waitedMs: null, pendingAny: [], forensic: [] }
  {
    // The leader chain needs WAKES to reach create-asker + delegate-d3,
    // and the appr call only blocks (creating the pending row) after that
    // delegate lands — so the fence cadence runs CONCURRENTLY with the
    // pending-row poll; the resolve fires as soon as the row is observed.
    const apprDrive = wakeCadence('U6PROC_APPR_DONE', 150_000, 'a')
    const pend = await waitA(async () => {
      await captureForensic()
      const st = await stateSnapshot()
      const ctl = st?.control ?? null
      const pending = (ctl?.requests ?? []).filter((r) => r.status === 'pending' && /tool:team_bash|tool=team_bash/.test(String(r.summary ?? '')))
      if (pending.length > 0) apprArm.pendingAny = pending.map((r) => ({ requestId: String(r.requestId).slice(0, 60), kind: r.kind ?? null, summary: String(r.summary ?? '').slice(0, 160) }))
      // The asker's own row: its case id embeds the asker instanceId
      // (tadm:<team>:<instanceId>:<fp>:g0) — exact attribution, never a
      // borrowed row from an earlier lane. The templateId lookup rides the
      // same observer read (members list); no private API.
      const askerInst = (st?.members ?? []).find((m) => m.templateId === 'asker')?.instanceId ?? null
      const p = askerInst === null
        ? pending[0]
        : pending.find((r) => String(r.summary ?? '').includes(`:${askerInst}:`) || r.targetInstanceId === askerInst) ?? null
      if (p !== undefined && p !== null) { apprArm.pendingSeen = true; apprArm.requestId = p.requestId; apprArm.kind = p.kind ?? null; return true }
      return false
    }, 120_000)
    apprArm.waitedMs = pend.waitedMs
    if (apprArm.pendingSeen) {
      const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
        { teamSessionId, requestId: apprArm.requestId, decision: 'allow', note: 'u6proc-review-r1-positive-arm' }, 'u6proc-approve', 4)
      apprArm.resolveBody = JSON.stringify(res?.body ?? null).slice(0, 500)
      apprArm.resolvedOk = res?.status === 200 && res?.body?.result?.ok === true
      resolvedAsks.push({ tag: 'approve', requestId: apprArm.requestId, kind: apprArm.kind, firstBody: apprArm.resolveBody, secondBody: null })
    }
    laneDone.appr = await apprDrive
  }
  // The leader exec calls ride the DUAL-GATED allow lane (measured law at
  // this baseline: the shell ask is born-terminal for EVERY rung —
  // fingerprint resource pins requiredAuthority=human-admin and A1-12 has
  // no Admin resolver; the leader allow-lane + envelope 'bash' token is the
  // legal spawnable lane, exec-autonomy-contract ruling 2026-09-18). No
  // approval wait: the kernel admits, the confined provider spawns.
  laneDone.pos = await wakeCadence('U6PROC_POS_DONE', 90_000, 'p')
  // ── the Human-User seam replay arm: resolve a requestId that the durable
  // control service does NOT hold open (the born-terminal ask cases close
  // DECIDED — listControlState skips decided rows — so their ids are not
  // pendable; the seam's exactly-once law is the same closed CONTROL_*
  // vocabulary on any non-open id). Recorded for proc:replay-settled-refusal.
  laneDone.posReplay = await (async () => {
    const ctl = await controlSnapshot()
    // Since the review-r1 positive arm legitimately opens and settles the
    // appr case, this arm names a BORN-TERMINAL ask (its summary carries
    // the mask/deny claim — a request the service closed decided, never
    // held open): the settled-replay law is measured on the case the
    // born-terminal close created, not on the authorised one.
    const bornTerminal = (ctl?.requests ?? [])
      .find((r) => r.status !== 'pending' && /U6PROC_(MASK|DENY)_|u6proc-(mask|deny)/.test(String(r.summary ?? '')))
    const decided = (ctl?.decisions ?? []).find((x) => x.requestId !== apprArm.requestId)
    const requestId = bornTerminal?.requestId ?? decided?.requestId ?? apprArm.requestId ?? 'u6proc-unknown-request'
    // v4: team.resolveControl is the v4-only human control-resolution
    // command (s6-remote.ts:4106); a v1 envelope is refused with
    // method-version-unsupported BEFORE any control-service work.
    const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
      { teamSessionId, requestId, decision: 'allow', note: 'u6proc-c2-replay-arm' }, 'u6proc-replay', 4)
    resolvedAsks.push({ tag: 'replay', requestId, kind: bornTerminal?.kind ?? 'non-open', firstBody: JSON.stringify(res?.body ?? null).slice(0, 500), secondBody: null })
    return true
  })()
  laneDone.swapTrigger = await fireTrigger(assembly.markers.T_SWAP, () => probeLedger().some((r) => r.leg === 'spoof-attempt' && r.trigger === 'probe-body'))
  laneDone.swap = await wakeCadence('U6PROC_SWAP_DONE', 90_000, 'w')
  laneDone.restoreTrigger = await fireTrigger(assembly.markers.T_RESTORE, () => probeLedger().some((r) => r.leg === 'spoof-restore'))
  laneDone.late = await wakeCadence('U6PROC_LATE_DONE', 90_000, 'l')
  laneDone.leader = await wakeCadence('U6PROC_L1_DONE', 45_000, 'z')
  laneDone.channelReg = await fireTrigger(assembly.markers.T_CHANNEL, () => probeLedger().some((r) => r.leg === 'channel-attempt'), 60_000)
  laneDone.channelCall = await fireTrigger(assembly.markers.T_CHANNELCALL, () => probeLedger().some((r) => r.leg === 'channel-body-ran'), 60_000)
  // CI-03 native control on the UNGOVERNED boot-root session (wake() would
  // hit the team root — wrong subject). Success predicate = the mock corpus
  // shows the model asked for the NATIVE 'bash' tool with the ctl claim;
  // whether the host-native approval posture then ran or held the call is
  // HOST-owned and NOT required by the verdict (absence-of-mediation arm).
  laneDone.ctl = await fireTrigger(assembly.markers.T_CTL, () => (world.mock?.requests ?? []).some((r) => {
    const t = JSON.stringify(r?.body?.messages ?? [])
    return t.includes('"name":"bash"') && t.includes(assembly.claims.ctl)
  }), 45_000)
  if (!laneDone.leader) {
    const stuck = world.mock.requests.map((r) => (r.reply?.kind === 'text' ? String(r.reply.content ?? '') : '')).filter((x) => x.startsWith('U6PROC_ID_FAIL') || x.startsWith('U6PROC_GATE_HOLD') || x.startsWith('U6PROC_FENCE_HOLD') || x.startsWith('U6PROC_EXEC_HOLD'))
    log(`leader chain did not close cleanly${stuck.length > 0 ? ` (${stuck[stuck.length - 1]})` : ''}; verdicts read the evidence as-is`)
  }
  // the terminate-honesty window: the late command sleeps 6 s then writes;
  // the row timeout is 1.5 s. Absence AFTER the sleep window + the timeout
  // word in the answer = the provider killed the payload (terminate arm).
  await sleep(9_000)

  // ── evidence collection ───────────────────────────────────────────────────
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const spoofBodyMarkers = markerFiles.filter((m) => m.startsWith('spoof-bash-body-ran-'))
  const channelMarkers = markerFiles.filter((m) => m.startsWith('channel-body-ran-'))
  const bashExecutes = probeRows.filter((r) => r.leg === 'bash-execute')
  const bashResults = probeRows.filter((r) => r.leg === 'bash-result')
  const notifTurns = (world.mock?.requests ?? []).filter((r) => JSON.stringify(r?.body?.messages ?? r?.messages ?? []).includes('[team-control requestId=')).length
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const hits = kernelHits()
  await captureForensic()
  apprArm.forensic = [...forensicLines].slice(0, 40)
  const ctlFinal = await controlSnapshot()
  const controlDigestRaw = ctlFinal === null ? null : JSON.stringify(ctlFinal).slice(0, 6000)
  const controlDigest = ctlFinal === null ? null : {
    requests: (ctlFinal.requests ?? []).map((r) => ({ requestId: r.requestId, kind: r.kind, status: r.status, toolName: r.toolName ?? null, summary: String(r.summary ?? '').slice(0, 90), operationFingerprint: r.operationFingerprint ?? null })),
    decisions: ctlFinal.decisions ?? [],
    consumptions: ctlFinal.consumptions ?? [],
  }
  const decisionsFor = (requestId) => (controlDigest?.decisions ?? []).filter((d) => d.requestId === requestId).length
  const consumptionsFor = (requestId) => (controlDigest?.consumptions ?? []).filter((c) => c.requestId === requestId).length
  // Per-ask notification evidence: the MASK ask's own requestId must never
  // appear in a leader notification turn (born-terminal asks are never
  // notified); the positive arm's appr ask may legitimately notify.
  const maskAskRid = (controlDigest?.requests ?? [])
    .find((r) => /U6PROC_MASK_|u6proc-mask/.test(String(r.summary ?? '')))?.requestId ?? null
  // No mask ask row EVER exists ⇒ there is nothing of the mask case's to
  // notify: zero is the measured fact (the born-terminal close happens
  // inside the call; the notification port fires only on row creation).
  // A row that exists is counted by its OWN requestId — the positive
  // arm's asker notification must never be mistaken for the mask case's.
  const notifTurnsMask = maskAskRid === null
    ? 0
    : (world.mock?.requests ?? []).filter((r) => JSON.stringify(r?.body?.messages ?? r?.messages ?? [])
      .includes(`[team-control requestId=${maskAskRid}`)).length
  const approveEvidence = {
    ...apprArm,
    decisions: apprArm.requestId === null ? 0 : decisionsFor(apprArm.requestId),
    consumptions: apprArm.requestId === null ? 0 : consumptionsFor(apprArm.requestId),
  }
  const digest = {
    surface, denyList,
    effects: Object.fromEntries(Object.entries(assembly.files).map(([k]) => [k, assembly.readEffect(k)])),
    effectLines: Object.fromEntries(Object.entries(assembly.files).map(([k]) => [k, assembly.effectLines(k)])),
    spoofBodyMarkers, channelMarkers,
    registerAttempts: probeRows.filter((r) => r.leg === 'spoof-register'),
    swapAttempts: probeRows.filter((r) => r.leg === 'spoof-attempt'),
    restoreRows: probeRows.filter((r) => r.leg === 'spoof-restore'),
    channelRows: probeRows.filter((r) => r.leg === 'channel-attempt' || r.leg === 'channel-body-ran'),
    bashExecutes: bashExecutes.map((r) => ({ tool: r.tool, command: String(r.command ?? '').slice(0, 90), agent: r.agent })),
    bashResults: bashResults.map((r) => ({ tool: r.tool, isError: r.isError, head: String(r.head ?? '').slice(0, 180) })),
    resolvedAsks,
    controlDigest,
    notifTurns,
    notifTurnsMask,
    approveEvidence,
    kernelHits: hits,
    laneDone,
    claims: Object.fromEntries(Object.entries(assembly.claims).map(([k, c]) => [k, claimOccurrences(c)])),
  }
  add('proc:mounted', earlyMount.teamSession && (probeLedger().find((r) => r.leg === 'register' && r.kind === 'probe-tool'))?.ok === true
    && hostAlive()
    && hits['a5g7: placement-feed rows='].count > 0
    && hits['a5-plane: mount-REFUSED'].count === 0
    && hits['a5-plane: placement-REFUSED'].count === 0
    && hits['PLANE_KERNEL_UNAVAILABLE'].count === 0
    && hits['PLANE_PROCESS_REGISTRATION_REFUSED'].count === 0
    && hits['PLANE_READ_REGISTRATION_REFUSED'].count === 0
    ? 'PASS' : 'FAIL', {
    ...earlyMount,
    hostAlive: hostAlive(),
    kernelHits: hits,
    note: 'ONE kernel for both families: the placement feed lists team_bash AND read (ARC-B visible from the Host log); a refused registration or an unbuildable kernel would name itself in the log (mount-wide law, PR3)',
  })
  record.record.u6procDigest = digest
  try {
    writeFileSync(join(evidence, `${runId}.u6proc-evidence.json`), JSON.stringify(digest, null, 2) + '\n')
  } catch { /* evidence is best-effort; the RUN record carries the digest */ }

  // ── verdicts (shared judge — the SAME function the offline
  // reconstruct uses; the evidence digest above is its entire input) ──────
  for (const [id, verdict, detail] of judgeU6Proc(digest, hostAlive())) add(id, verdict, detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
}
/**
 * U6 PR4 C2 (ARC-C at the Host). ONE boot. The leader chain creates a
 * WORKER (birth + management lane) and a FOREIGN viewer; the worker's
 * script births TWO real background jobs on the member NATIVE bash lane
 * (the confined governed row refuses `run_in_background` by name — the
 * disclosed CI-03 law at this pin) and then manages them through the
 * kernel-mounted trio (the first named Bridge riding the SAME admission
 * path as read/team_bash); the foreign lane attempts to manage the owner's
 * REAL job id (learned through the leader's collect — a real teammate's
 * channel) and must be refused while the job provably keeps running. The
 * kill answer must be REQUEST vocabulary, the FINAL marker must never land
 * (the host settled), and the boot-root's NATIVE trio must show zero
 * kernel involvement. Every effect fact is read from DISK by this runner —
 * the tool returns are cross-checked, never trusted.
 */
async function runU6Jobs({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }) {
  const CASE_IDS = SUITE_CASES['u6-jobs']
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const redactLine = (t) => String(t).replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>').slice(0, 260)
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6Jobs: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createJobsAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles()
  world.u6Jobs.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeJobsDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u6jobs-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6jobs-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  const kernelHits = () => {
    const pats = ['a5g7: placement-feed rows=', 'job_output', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED',
      'PLANE_KERNEL_UNAVAILABLE', 'PLANE_JOBS_REGISTRATION_REFUSED', 'PLANE_READ_REGISTRATION_REFUSED',
      'PLANE_PROCESS_REGISTRATION_REFUSED', 'cannot be verified at dispatch']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  }

  // ── readiness ────────────────────────────────────────────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('jobs:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000)
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }
  const stateSnapshot = async () => (await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000))?.body ?? null

  // ── discovery -> blueprint -> team.create ────────────────────────────────
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6jobs')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  // In THIS world the trio IS managed (the governed rows mount them) —
  // builtinToolDeny would cover the un-managed surface only.
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n)
    && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !JOBS_WORLD_MANAGED_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive (proc rhythm) ──────────────────────────────────────────────────
  const teamSessionId = stateBody?.teamSession?.rootSessionId ?? assembly.CREATE_ROOT
  const replyPrefixSeen = (prefix) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(prefix))
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6JOBS_PHASE_${tag}`, 'u6jobs-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (prefix, deadlineMs, tag) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replyPrefixSeen(prefix)) return true
      if (Date.now() - t0 > deadlineMs) return replyPrefixSeen(prefix)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  // The durable Control lane, OBSERVED continuously: every poll merges its
  // rows into the record map. Member-birth asks (tool:bash — the native
  // lane may be host-gated) are settled through the PUBLIC
  // team.resolveControl seam (the product's human lane); trio rows are
  // NEVER settled (their existence would itself be the second-ledger
  // violation this suite measures).
  const trioNameRe = /job_(output|list|kill)/
  const controlRows = new Map()
  const birthRow = { seen: false, resolved: false, resolutions: [] }
  let approverStop = false
  const approver = (async () => {
    while (!approverStop) {
      try {
        const ctl = await stateSnapshot()
        for (const r of (ctl?.requests ?? [])) {
          controlRows.set(String(r.requestId), { toolName: r.toolName ?? null, summary: String(r.summary ?? '').slice(0, 120), status: String(r.status ?? '') })
          const tag = `${String(r.toolName ?? '')} ${String(r.summary ?? '')}`
          if (r.status === 'pending' && /\bbash\b/.test(tag) && !trioNameRe.test(tag)) {
            birthRow.seen = true
            const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
              { teamSessionId, requestId: String(r.requestId), decision: 'allow', note: 'u6jobs-c2-birth-approval' }, 'u6jobs-birth', 4)
            const ok = res?.status === 200 && res?.body?.result?.ok === true
            birthRow.resolved = birthRow.resolved || ok
            birthRow.resolutions.push({ requestId: String(r.requestId), status: res?.status ?? null, ok })
          }
        }
      } catch { /* poll is observational; a failed poll retries */ }
      await sleep(1200)
    }
  })()
  const laneDone = {}
  record.record.u6jobsLanes = laneDone
  laneDone.work = await wakeCadence('U6JOBS_WORK_DONE', 180_000, 'w')
  laneDone.foreign = await wakeCadence('U6JOBS_FENCE_DONE', 120_000, 'f')
  laneDone.leader = await wakeCadence('U6JOBS_L1_DONE', 90_000, 'z')
  // CI-03 native control on the UNGOVERNED boot-root session.
  laneDone.ctl = await (async () => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.T_CTL, 'u6jobs-ctl')
    if (pr.status !== 200) return false
    return (await waitA(() => replyPrefixSeen('U6JOBS_CTL_RAN'), 90_000)).hit
  })()
  // settle window: the kill-subject sleeps 35 s between its warm marker and
  // its FINAL marker; a survived (leaked) job lands FINAL INSIDE this
  // window — the absence the judge measures is meaningful, not early exit.
  await sleep(45_000)
  approverStop = true
  try { await approver } catch { /* observational */ }

  // ── evidence ─────────────────────────────────────────────────────────────
  const requests = world.mock?.requests ?? []
  // ENVELOPE match, not the raw token: the delegation token also rides
  // the LEADER's team_delegate ARGS, so matching it picks the leader's
  // transcript and MISSES every member exchange (run 2/3 receipts proved
  // the contamination: trioUses saw only the root's single call). The
  // `[team-work requestToken=` envelope text exists only in the member
  // session's own user message.
  const wReq = laneTranscript(requests, `[team-work requestToken=${assembly.tokens('d1')}`)
  const fReq = laneTranscript(requests, `[team-work requestToken=${assembly.tokens('d2')}`)
  const cReq = laneTranscript(requests, assembly.markers.T_CTL)
  const wEx = wReq === null ? [] : toolExchanges(wReq)
  const fEx = fReq === null ? [] : toolExchanges(fReq)
  const cEx = cReq === null ? [] : toolExchanges(cReq)
  const firstNamed = (ex, name) => (ex.find((e) => e.name === name) ?? { result: null }).result
  const lastNamed = (ex, name) => { for (let i = ex.length - 1; i >= 0; i -= 1) if (ex[i]?.name === name) return ex[i].result; return null }
  const namesJob = (e, name, id) => e?.name === name && id !== undefined && id !== null && String(e.args?.job_id ?? '') === String(id)
  const firstFor = (ex, name, id) => (ex.find((e) => namesJob(e, name, id)) ?? { result: null }).result
  const lastFor = (ex, name, id) => { for (let i = ex.length - 1; i >= 0; i -= 1) if (namesJob(ex[i], name, id)) return ex[i].result; return null }
  const jobIds = extractJobIds(wEx.map((e) => e.result).join('\n'))
  const finalCtl = await stateSnapshot()
  for (const r of (finalCtl?.requests ?? [])) {
    controlRows.set(String(r.requestId), { toolName: r.toolName ?? null, summary: String(r.summary ?? '').slice(0, 120), status: String(r.status ?? '') })
  }
  let hostLogText = ''
  try { hostLogText = readFileSync(boot.logPath, 'utf8') } catch { /* unreadable */ }
  const settleEvents = (jobId, re) => jobId === undefined || jobId === null ? 0
    : hostLogText.split('\n').filter((l) => l.includes(String(jobId)) && re.test(l)).length
  const rootKernelMentions = (() => {
    if (cReq === null) return 0
    const t = JSON.stringify(cReq?.body?.messages ?? cReq?.messages ?? [])
    return (t.match(/a5jobs|a5-plane|placement-feed|kernelGuard/gi) ?? []).length
  })()
  const digest = {
    runId, worldId: world.id,
    kernelHits: kernelHits(),
    claims: assembly.claims,
    claim1Text: assembly.readEffect('claim1'),
    jobIds,
    list1: firstNamed(wEx, 'job_list'),
    output1: firstFor(wEx, 'job_output', jobIds[0]) ?? firstNamed(wEx, 'job_output'),
    output2: firstFor(wEx, 'job_output', jobIds[1]),
    output2Post: lastFor(wEx, 'job_output', jobIds[1]),
    kill2: firstNamed(wEx, 'job_kill'),
    list2: lastNamed(wEx, 'job_list'),
    foreignOutput: firstNamed(fEx, 'job_output'),
    foreignKill: firstNamed(fEx, 'job_kill'),
    ctlOutput: lastNamed(cEx, 'job_output'),
    trioUses: [...wEx, ...fEx, ...cEx].filter((e) => e.name !== null && trioNameRe.test(String(e.name))).length,
    controlRows: [...controlRows.values()],
    birthRow,
    settle: {
      killLines: settleEvents(jobIds[1], /aborted|killed|cancel-requested/i),
      foreignKillLines: settleEvents(jobIds[0], /aborted|killed|cancel-requested/i),
    },
    rootKernelMentions,
    lanes: { ...laneDone },
    // compact transcript tails per lane (a stalled chain must be diagnosable
    // from the receipt alone — every field below is truncated transcript text,
    // never a secret: no token rides a tool result).
    debug: {
      worker: wEx.slice(-8).map((e) => ({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 220) })),
      foreign: fEx.slice(-4).map((e) => ({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 220) })),
      root: cEx.slice(-3).map((e) => ({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 220) })),
      // global diagnostics: what did the HOST answer EVERY bash/trio call
      // anywhere in the world (dedup, truncated) — a stalled birth must
      // name its own cause in the receipt, boot 2/3 lesson.
      bashResults: [...new Set(requests.flatMap((r) => toolExchanges(r))
        .filter((e) => e.name === 'bash')
        .map((e) => JSON.stringify({ args: e.args ?? null, result: String(e.result ?? '').slice(0, 200) })))]
        .slice(-10),
      trioResults: [...new Set(requests.flatMap((r) => toolExchanges(r))
        .filter((e) => e.name !== null && trioNameRe.test(String(e.name)))
        .map((e) => JSON.stringify({ name: e.name, args: e.args ?? null, result: String(e.result ?? '').slice(0, 200) })))]
        .slice(-12),
    },
  }
  record.record.u6jobsDigest = digest
  try {
    writeFileSync(join(evidence, `${runId}.u6jobs-evidence.json`), JSON.stringify(digest, null, 2) + '\n')
  } catch { /* evidence best-effort; the RUN record carries the digest */ }

  // ── verdicts (shared judge; the digest is its entire input) ─────────────
  for (const [id, verdict, detail] of judgeU6Jobs(digest, hostAlive())) add(id, verdict, detail)

  // ── leak-check: teardown, then the factory's owned-resources audit ──────
  try {
    await rc.stopChild()
  } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  add('jobs:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
}

async function caseCrashVictim({ factory, record, rc, line, worlds, keepHome }) {
  let ctx = null
  try {
    ctx = await bootWorld({ factory, record, rc, worldOpts: { line: `${line}v` }, phase: 'victim-boot' })
    worlds.push(ctx.world)
    const { world, nonce, queue, issued, boot } = ctx
    const origin = `http://127.0.0.1:${boot.port}`
    const cookie = await authenticate(origin, world.token)
    const createRes = await apiSessionCreate(origin, cookie, world.workspaceDir, `u5${nonce}`)
    const sessionId = findFirstKey(createRes.body, 'sessionId')
    if (typeof sessionId !== 'string' || sessionId === '') throw new Error(`victim session create failed: ${JSON.stringify(createRes.body).slice(0, 200)}`)
    const hostPid = boot.child?.pid ?? null
    if (hostPid === null || hostPid === undefined) throw new Error('victim boot child pid missing')
    console.log(`U5-IN-RUN ${world.id} ${world.home} ${String(hostPid)}`)
    const tag = `crashfly-${nonce}`
    const before = issued.length
    rc.budget.beginScenario('crash-victim')
    queue.push({ mode: 'gate', tag, gateFile: join(world.markerDir, `${tag}.gate`), capMs: 300_000 })
    await apiPrompt(origin, cookie, sessionId, `u5 crash victim ${tag}`, `u5${nonce}`)
    await waitForIssue(issued, before, { signal: rc.signal })
    const oracle = createOracle({ ...oraclePaths(world), hostLogPath: boot.logPath })
    const inFlight = await waitUntil(() => (oracle.observe({ tag }).channels.markers.files.includes(`${tag}.pre`) ? true : undefined), { timeoutMs: 60_000, signal: rc.signal })
    if (inFlight.hit !== true) {
      rc.budget.endScenario()
      record.addCase('victim-in-flight', 'FAIL', { reason: 'held call never started (.pre marker absent within 60 s) — no in-flight state to be killed in', tag })
      return
    }
    console.log(`U5-IN-FLIGHT ${world.id} ${world.home} ${String(hostPid)} ${tag}`)
    const callId = issued[before]?.callId
    const done = await waitUntil(() => (findIssuedResult(world.mock.requests, callId).found ? true : undefined), { timeoutMs: 8 * 60_000, signal: rc.signal })
    rc.budget.endScenario()
    record.addCase('victim-in-flight', 'FAIL', {
      reason: done.hit === true
        ? 'the held canary call COMPLETED — no abnormal kill landed in flight; the crash state was never created (supervisor misfire, not a crash-recovery result)'
        : 'in-flight wait ended without completion through abort/watchdog — the supervisor group-SIGKILL did not land either (this runner wrote a record, so it survived)',
      tag,
      note: 'crash-reclaim PASS/FAIL is judged by the supervisor from crash-state proofs; this victim can only honestly report FAIL by surviving',
    })
  } catch (error) {
    record.addCase('victim-in-flight', 'FAIL', { error: String(error?.message ?? error) })
  } finally {
    if (ctx !== null) await teardownAndNote({ ctx, record, caseId: 'victim-in-flight', keepHome, rc })
  }
}

// u6-arc-a (U6 PR5 C2 / ARC-A at the Host): ONE Team World; the probe
// FAMILY (tests/u6-arc-a-probe-family — a new family, zero center diff)
// mounts beside the production plane as a profile-patch row, and the
// suite's whole verdict set is read from DISK (marker dir + fixture +
// ledger) and the HOST LOG — never from the model transcript. ONE host
// start; the design budget is 1 boot/run (the runner-wide budget gate
// still caps at maxHostStarts).
async function runU6ArcA({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }) {
  const CASE_IDS = SUITE_CASES['u6-arc-a']
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const redactLine = (t) => String(t).replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>').slice(0, 260)
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6ArcA: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createArcAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles() // must precede teamRows(): the plane rootDir canonicalizes the workspace
  world.u6ArcA.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeArcDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u6arca-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6arca-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6arcaLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6arcaMarkerDir) } catch { return [] }
  }
  const fixtureCensus = () => {
    const out = []
    const walk = (dir, rel) => {
      for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (e.isDirectory()) walk(join(dir, e.name), `${rel}${e.name}/`)
        else out.push(`${rel}${e.name}:${String(readFileSync(join(dir, e.name)).length)}`)
      }
    }
    walk(assembly.workspaceDir, '')
    // PROBE MARKERS ARE NOT FIXTURE STATE: the probe lane legitimately
    // writes u6arca-markers/*.txt (its own effect, verified by the
    // marker/nonce evidence of that leg). The refusal leg's ZERO-EFFECT
    // law is about the FIXTURE files; counting another leg's declared
    // output made censusUnchanged false in run8 for a legitimate write
    // (post-run8 harness fix, disclosed; verdicts unaffected — the search
    // legs fail at the enum gap regardless).
    return out.filter((row) => !row.startsWith('u6arca-markers/')).join('|')
  }
  const censusPre = fixtureCensus()

  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('arca:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000)
  const mountRows0 = probeLedger()
  add('arca:mounted', stateW.hit
    && mountRows0.some((r) => r.leg === 'family-mount' && r.ok === true)
    && mountRows0.some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true)
    && hostAlive() ? 'PASS' : 'FAIL', {
    teamSession: stateBody?.teamSession !== null && stateBody?.teamSession !== undefined,
    familyMount: mountRows0.find((r) => r.leg === 'family-mount') ?? { missing: true },
    probeRegister: mountRows0.find((r) => r.leg === 'register' && r.kind === 'probe-tool') ?? { missing: true },
    hostAlive: hostAlive(),
  })
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }
  if (!probeLedger().some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true)) {
    failRest('probe tool never registered (the family has no callable surface)')
    return
  }

  // ── discovery -> main blueprint -> team.create ────────────────────────────
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6arca')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive ────────────────────────────────────────────────────────────────
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const laneDone = {}
  record.record.u6arcaLanes = laneDone
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6ARCA_PHASE_${tag}`, 'u6arca-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (doneText, deadlineMs, tag) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(doneText)) return true
      if (Date.now() - t0 > deadlineMs) return replySeen(doneText)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  const fireTrigger = async (markerText, doneText, deadlineMs = 90_000) => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6arca-trig')
    if (pr.status !== 200) {
      log(`trigger ${String(markerText).slice(0, 44)} rejected: status=${String(pr.status)}`)
      return false
    }
    return (await waitA(async () => replySeen(doneText), deadlineMs)).hit
  }
  laneDone.grep = await wakeCadence('U6ARCA_GREP_DONE', 120_000, 'g')
  laneDone.ctl = await wakeCadence('U6ARCA_CTL_DONE', 90_000, 'c')
  laneDone.probe = await fireTrigger(assembly.markers.T_PROBE, 'U6ARCA_WALK_DONE')
  laneDone.unbound = await fireTrigger(assembly.markers.T_UNBOUND, 'U6ARCA_UNBOUND_DONE')
  laneDone.replay = await fireTrigger(assembly.markers.T_REPLAY, 'U6ARCA_REPLAY_DONE')
  laneDone.teardown = await fireTrigger(assembly.markers.T_TEARDOWN, 'U6ARCA_TD_DONE')
  laneDone.postTeardown = await fireTrigger(assembly.markers.T_POSTTEARDOWN, 'U6ARCA_POSTTD_DONE')
  laneDone.leader = await wakeCadence('U6ARCA_L1_DONE', 60_000, 'z')

  // ── evidence collection (DISK / LEDGER / HOST LOG; digests, tokens never recorded) ──
  const censusPost = fixtureCensus()
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const nonceOf = (f) => {
    try { return readFileSync(join(world.u6arcaMarkerDir, f), 'utf8').trim() } catch { return null }
  }
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const toolResultTexts = () => (world.mock?.requests ?? []).flatMap((r) => toolMsgsOf(r).map((m) => String(m.text)))
  const results = toolResultTexts()
  const grepResults = [{
    ok: true,
    claimsFound: claimOccurrences(assembly.files.g1.claim) >= 1 ? ['g1'] : [],
  }]
  const allGlobs = results.filter((t) => t.includes('.txt'))
  const enumHasG3 = results.some((t) => t.includes('u6arca-uni-'))
  const gitDecoyExcluded = !results.some((t) => t.includes('.git/'))
  const globResults = [{ ok: enumHasG3 && gitDecoyExcluded, enumHasG3, gitDecoyExcluded }]
  const refusalText = results.find((t) => /refus|denied|outside|unsupported|not allowed|cannot be verified/i.test(t) && !t.includes(assembly.files.g1.claim)) ?? null
  const refusalResult = {
    refused: refusalText !== null,
    // containment ONLY: the old regex counted ANY refusal word, so an
    // ADMISSION refusal (refused-admission / IO_POLICY_UNSUPPORTED — what
    // the enum gap produces) masqueraded as the anchored containment
    // refusal the leg actually claims. Post-run8 honesty fix.
    outsideRootCodeSeen: refusalText !== null ? /outside|containment|OUTSIDE_ROOT/i.test(refusalText) : false,
    admissionRefused: refusalText !== null ? /refused-admission/i.test(refusalText) : false,
    censusUnchanged: censusPre === censusPost,
    refusalSample: refusalText === null ? null : refusalText.slice(0, 220),
  }
  const ctlResult = {
    ok: true,
    claimFound: claimOccurrences(assembly.files.g2.claim) >= 1,
  }
  const hostKernelHits = (() => {
    const pats = ['a5g7: placement-feed rows=', 'a5-plane: mount-REFUSED', 'a5-plane: placement-REFUSED',
      'PLANE_KERNEL_UNAVAILABLE', 'PLANE_SEARCH_REGISTRATION_REFUSED', 'cannot be verified at dispatch',
      'U6_PROBE', 'u6arc', 'governance-center']
    let text = ''
    try { text = readFileSync(boot.logPath, 'utf8') } catch { /* log unreadable */ }
    const out = {}
    for (const p of pats) {
      const lines = text.split('\n').filter((l) => l.includes(p))
      out[p] = { count: lines.length, sample: lines.length > 0 ? redactLine(lines[lines.length - 1]) : null }
    }
    return out
  })()
  const verdicts = judgeU6ArcA({
    ledgerRows: probeRows,
    markerFiles,
    grepResults,
    globResults,
    ctlResult,
    refusalResult,
    hostKernelHits,
    hostAlive: hostAlive(),
  })
  for (const id of Object.keys(verdicts)) {
    if (done.has(id)) continue
    add(id, verdicts[id] === true ? 'PASS' : 'FAIL', {
      markerFiles: markerFiles.filter((m) => m.endsWith('-marker.txt')),
      posNonce: nonceOf('pos-1-marker.txt'),
      expectedNonce: assembly.probe.posNonce,
      nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
      claimCounts: { g1: claimOccurrences(assembly.files.g1.claim), g2: claimOccurrences(assembly.files.g2.claim), git: claimOccurrences(assembly.files.git.claim) },
      globResults, refusalResult, ctlResult,
      censusUnchanged: censusPre === censusPost,
      laneDone,
      hostKernelHits,
      familyRows: probeRows.filter((r) => ['family-mount', 'register', 'walk', 'teardown', 'unload-settle'].includes(String(r.leg))).map((r) => ({ leg: r.leg, action: r.action ?? null, ok: r.ok, code: r.code ?? null, outcome: r.outcome ?? null })),
    })
  }
  record.record.u6arcaDigest = {
    mockTail: world.mockRequestDigest().slice(-8),
    surface, denyList, censusPre, censusPost,
    markerFiles, nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
    grepResults, globResults, refusalResult, ctlResult, hostKernelHits,
    probeLedgerRows: probeRows.length,
  }
  writeFileSync(join(evidence, `${runId}.evidence.json`), JSON.stringify(record.record, null, 2) + '\n')
  if (!hostAlive()) failRest('host died during the run')
}

// u6-arc-d (U6 PR6 C2 / ARC-D at the Host): the ADVERSARIAL laws proven
// offline at the production seams (u6-pr6-arc-d-adversarial + -matrix) get
// their LIVE legs on the PR5 probe family AS SHIPPED — the row mounts the
// very assembly tests/u6-arc-a-probe-family ships (zero new family code is
// the whole claim) and attacks it: replay of a settled grant, self-reported
// foreign scope, a swapped identity the table never bound, a decide on a
// never-bound name, honest teardown + post-teardown refusal — plus the
// CI-03 native control (member WITHOUT a capabilities block, judged from
// the disk claim riding the wire tool_result). ONE host start (design
// budget: 1 boot/run, tier 1 like ARC-A); the verdict law is DISK + LEDGER
// + HOST LOG — every row the judge below derives comes off those channels,
// never the model transcript.
async function runU6ArcD({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }) {
  const CASE_IDS = SUITE_CASES['u6-arc-d']
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u6ArcD: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createArcDAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles() // must precede teamRows(): the plane rootDir canonicalizes the workspace
  world.u6ArcD.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeArcDDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u6arcd-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u6arcd-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`
  const probeLedger = () => world.u6arcdLedgerRows() ?? []
  const listMarkers = () => {
    try { return readdirSync(world.u6arcdMarkerDir) } catch { return [] }
  }
  const nonceOf = (f) => {
    try { return readFileSync(join(world.u6arcdMarkerDir, f), 'utf8').trim() } catch { return null }
  }

  // ── readiness gates (arc-a law; every early bail is a FAIL with its own
  // reason — the JUDGE owns the nine verdicts, ENV_BLOCK included) ─────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    failRest(`p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}`)
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000)
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
    return
  }
  if (!probeLedger().some((r) => r.leg === 'register' && r.kind === 'probe-tool' && r.ok === true)) {
    failRest('probe tool never registered (the family has no callable surface)', {
      familyRows: probeLedger().filter((r) => ['family-mount', 'register'].includes(String(r.leg))),
    })
    return
  }

  // ── discovery -> main blueprint -> team.create (arc-a lines kept 1:1) ────
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u6arcd')
  if (discPrompt.status !== 200) {
    failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    return
  }
  const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
  if (!discW.hit) {
    failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
    return
  }

  // ── drive (native lane first: it runs on the member while the leader
  // chain is still walking; the trigger legs ride boot-root prompts) ──────
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const laneDone = {}
  record.record.u6arcdLanes = laneDone
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U6ARCD_PHASE_${tag}`, 'u6arcd-wake')
    if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
  }
  const wakeCadence = async (doneText, deadlineMs, tag) => {
    const t0 = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(doneText)) return true
      if (Date.now() - t0 > deadlineMs) return replySeen(doneText)
      if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await new Promise((r) => setTimeout(r, 350))
    }
  }
  const fireTrigger = async (markerText, doneText, deadlineMs = 90_000) => {
    const pr = await apiPrompt(origin, cookie, assembly.ROOT, markerText, 'u6arcd-trig')
    if (pr.status !== 200) {
      log(`trigger ${String(markerText).slice(0, 44)} rejected: status=${String(pr.status)}`)
      return false
    }
    return (await waitA(async () => replySeen(doneText), deadlineMs)).hit
  }
  laneDone.native = await wakeCadence('U6ARCD_NATIVE_DONE', 120_000, 'n')
  laneDone.pos = await fireTrigger(assembly.markers.T_POS, 'U6ARCD_WALK_DONE')
  laneDone.spoof = await fireTrigger(assembly.markers.T_SPOOF, 'U6ARCD_SPOOF_DONE')
  laneDone.swap = await fireTrigger(assembly.markers.T_SWAP, 'U6ARCD_SWAP_DONE')
  laneDone.unbound = await fireTrigger(assembly.markers.T_UNBOUND, 'U6ARCD_UNBOUND_DONE')
  laneDone.replay = await fireTrigger(assembly.markers.T_REPLAY, 'U6ARCD_REPLAY_DONE')
  laneDone.teardown = await fireTrigger(assembly.markers.T_TD, 'U6ARCD_TD_DONE')
  laneDone.postTeardown = await fireTrigger(assembly.markers.T_POSTTD, 'U6ARCD_POSTTD_DONE')
  laneDone.leader = await wakeCadence('U6ARCD_L1_DONE', 60_000, 'z')

  // ── evidence collection (DISK / LEDGER / wire-claimed disk facts) ────────
  const probeRows = probeLedger()
  const markerFiles = listMarkers()
  const markerNonces = Object.fromEntries(markerFiles.map((f) => [f, nonceOf(f)]))
  // The claims on WIRE tool_results are disk-channel facts the runner
  // authored (the exact standard arc-a applies to its ctlResult /
  // claimOccurrences): the fixture claim on disk + the native grep's
  // tool_result bytes the mock saw — never a transcript claim of success.
  const claimOccurrences = (claim) => (world.mock?.requests ?? []).reduce((n, r) =>
    n + toolMsgsOf(r).filter((m) => String(m.text).includes(claim)).length, 0)
  const nativeClaimFound = claimOccurrences(assembly.files.native.claim) >= 1
  const alive = hostAlive()
  const verdicts = judgeU6ArcD({ probeRows, markerFiles, markerNonces, nativeClaimFound, hostAlive: alive })
  for (const [id, verdict, detail] of verdicts) {
    if (done.has(id)) continue
    add(id, verdict, {
      markerFiles: markerFiles.filter((m) => m.endsWith('-marker.txt')),
      posNonce: nonceOf('pos-1-marker.txt'),
      expectedNonce: assembly.probe.posNonce,
      nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
      nativeClaimFound,
      laneDone,
      hostAlive: alive,
      ...(detail ?? {}),
    })
  }
  record.record.u6arcdDigest = {
    mockTail: world.mockRequestDigest().slice(-8),
    surface, denyList, markerFiles,
    nonceMatches: nonceOf('pos-1-marker.txt') === assembly.probe.posNonce,
    nativeClaimFound, laneDone, probeLedgerRows: probeRows.length,
    probeRows: probeRows
      .filter((r) => ['family-mount', 'register', 'walk', 'teardown', 'unload-settle'].includes(String(r.leg)))
      .map((r) => ({ leg: r.leg, action: r.action ?? null, callId: r.callId ?? null, ok: r.ok, code: r.code ?? null, outcome: r.outcome ?? null })),
  }
  writeFileSync(join(evidence, `${runId}.evidence.json`), JSON.stringify(record.record, null, 2) + '\n')
  if (!alive) failRest('host died during the run')
}

// U7-9a C2 (the FS family's mutation members at the Host): ONE governed
// World whose kernel owns write/edit/read_image beside read — the CA-01
// claim is that a new family member needs ZERO center diff and ZERO new
// assembly machinery, so this World carries the SAME teamToolPlane config
// the u6-fs read World proved. Verdict law: the runner's OWN disk reads (an
// independent Oracle — the host never reports about itself), host-log
// witnesses of the family's own observe lines (the governed-vs-native
// discriminator), and BYTE COMPARISON for every refusal's zero effect.
async function runU7FsMut({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }) {
  const CASE_IDS = SUITE_CASES['u7-fs-mut']
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
  }
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u7FsMut: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createFsMutAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir, sessionRoot: factory.hostTree })
  const planted = assembly.writePreBootFiles() // plant truth BEFORE any host exists
  world.u7FsMut.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeFsMutDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u7fsmut-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u7fsmut-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  const laneDone = { strict: false, leader: false, ctl: false }
  record.record.u7fsmutLanes = laneDone

  // ── readiness: p6t6 health + anchored Team Session ───────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('fsm:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.phase === 'create' && stateBody?.teamSession !== null
  }, 90_000)

  // ── discovery -> blueprint -> team.create ────────────────────────────────
  let surface = []
  let cookie = null
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
  } else {
    cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7fsmut')
    if (discPrompt.status !== 200) {
      failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    } else {
      const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
      if (!discW.hit) {
        failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
      } else {
        const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
        surface = [...new Set(disc)].sort()
        const denyList = surface.filter((n) => !n.startsWith('team_')
          && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'].includes(n)
          && !['todo_write'].includes(n))
        assembly.writeMainBlueprint(denyList)
        const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
        const createOk = created.status === 200 && created.body?.result?.ok === true
        if (!createOk) {
          failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
        } else {
          // ── drive: member legs, leader close, then the NATIVE ctl trigger ─
          const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
          const wake = async (tag) => {
            const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `FSMUT_PHASE_${tag}`, 'u7fsmut-wake')
            if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
          }
          const wakeCadence = async (content, deadlineMs, tag) => {
            const t0 = Date.now()
            let lastWake = 0
            let wakes = 0
            for (;;) {
              if (replySeen(content)) return true
              if (Date.now() - t0 > deadlineMs) return replySeen(content)
              if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
              await new Promise((r) => setTimeout(r, 350))
            }
          }
          laneDone.strict = await wakeCadence('FSMUT_STRICT_DONE', 150_000, 's')
          laneDone.ctl = await wakeCadence('FSMUT_CTL_DONE', 120_000, 'c')
          laneDone.leader = await wakeCadence('FSMUT_L1_DONE', 90_000, 'z')
        }
      }
    }
  }

  // ── evidence: the runner's OWN disk oracle + host-log witnesses ──────────
  const oracle = assembly.readOracleFacts()
  let logLines = []
  try {
    const text = readFileSync(boot.logPath, 'utf8')
    logLines = text.split('\n').filter((l) => /governed-write|governed-edit|governed-image|placement-feed rows=|a5-plane: (mount|placement)-REFUSED|PLANE_FS_FAMILY_INCOMPLETE|PLANE_READ_REGISTRATION_REFUSED/.test(l))
  } catch { /* log unreadable → verdicts fall to the disk truth */ }
  const before = {
    deniedShaBefore: planted.deniedShaBefore,
    plantShaBefore: planted.plantShaBefore,
    W1_CONTENT: assembly.W1_CONTENT,
    PLANT_BEFORE: assembly.claims.plantBefore,
    PLANT_AFTER_CONTENT: assembly.PLANT_AFTER_CONTENT,
    CTL_CONTENT: assembly.CTL_CONTENT,
  }
  record.record.u7fsmutDigest = {
    planted, oracle,
    logHits: {
      writeRan: logLines.filter((l) => l.includes('governed-write RAN')).length,
      editRan: logLines.filter((l) => l.includes('governed-edit RAN')).length,
      image: logLines.filter((l) => l.includes('governed-image')).length,
      planeRefusals: logLines.filter((l) => /REFUSED/.test(l)).map((l) => l.slice(0, 200)),
    },
    // forensic lane (boot u7fsmut1-4 lessons, all MEASURED):
    //  - whole-body regexes count TOOL DEFINITIONS too — the honest shape
    //    walks assistant tool_use blocks and reports the last user turn's
    //    tool_result head (boots u7fsmut1-3 lied about the last call here);
    //  - boot u7fsmut4 verdicts: governed write/edit PASS on disk bytes +
    //    RAN witnesses; the denied-path write and the read_image call died
    //    at a HOST pre-dispatch layer (zero row witnesses, zero host-log
    //    error lines); the CI-03 member's NATIVE write answered
    //    `[sandbox: file access denied under workspace-write mode]` — the
    //    tool_result head is the ONLY witness such deaths leave, which is
    //    why it rides the evidence now.
    mockLaneTranscript: (world.mock?.requests ?? []).slice(-60).map((rec) => {
      const body = rec.body ?? {}
      const msgs = Array.isArray(body.messages) ? body.messages : []
      const toolUses = msgs.flatMap((m) => m?.role === 'assistant' && Array.isArray(m.content)
        ? m.content.filter((b) => b?.type === 'tool_use').map((b) => String(b.name)) : [])
      const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
      const resultHead = typeof lastUser?.content === 'string' ? lastUser.content.slice(0, 150)
        : Array.isArray(lastUser?.content)
          ? (lastUser.content.find((b) => b?.type === 'tool_result')?.content?.slice?.(0, 150)
             ?? JSON.stringify(lastUser.content[0] ?? '').slice(0, 150))
          : null
      return {
        seq: rec.seq,
        d1: JSON.stringify(msgs.map((m) => (m?.role === 'user' ? m.content : ''))).includes('[team-work requestToken=u7fsmut-d1'),
        d2: JSON.stringify(msgs.map((m) => (m?.role === 'user' ? m.content : ''))).includes('[team-work requestToken=u7fsmut-d2'),
        nCalls: toolUses.length,
        lastCall: toolUses.length > 0 ? toolUses[toolUses.length - 1] : null,
        resultHead,
      }
    }),
    surface, laneDone,
  }
  try {
    writeFileSync(join(evidence, `${runId}.u7fsmut-evidence.json`), JSON.stringify(record.record.u7fsmutDigest, null, 2) + '\n')
  } catch { /* evidence is best-effort */ }

  const verdicts = judgeU7FsMut({
    before, oracle, log: logLines, laneDone,
    journal: record.record.u7fsmutDigest.mockLaneTranscript ?? [],
    hostAlive: hostAlive(), healthOk: health?.body?.ok === true, stateOk: stateW.hit, surface,
  })
  for (const [id, verdict, detail] of verdicts) {
    if (!done.has(id)) add(id, verdict, detail)
  }

  // ── leak-check ────────────────────────────────────────────────────────────
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  if (!done.has('fsm:leak-check')) add('fsm:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
  if (!hostAlive() && !done.has('fsm:host-died')) log('host died during the run (verdicts read the evidence as-is)')
}

export async function runSuite(opts) {
  const { suite, line, evidence, runRecord: runRecordPath, budgetLedger, maxHostStarts, keepHome, only = null } = opts
  mkdirSync(evidence, { recursive: true })
  const selected = only !== null ? [only] : SUITE_CASES[suite]
  // the pristine host tree lives at the nearest team-repo root that HAS it
  // (a task worktree has no gitignored test-use clone; the factory otherwise
  // defaults to <repoRoot>/tests/deepseek-harness-test-use and the host-base
  // guard dies with exit 128). READ-ONLY usage: base assert + spawn only.
  const hostRepoRoot = findTestRepoRoot(REPO_ROOT) ?? REPO_ROOT
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence, hostTree: testUseTree(hostRepoRoot) })
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
      // u6-proc drives a longer chain (5 member scripts + the ask
      // notification lane + 5 boot-root trigger lanes); the fs suite's 80
      // would classify its honest completion as an overrun. u6-arc-d rides
      // the ARC-A tier-1 shape (one boot, one member script + 7 trigger
      // legs + the leader chain): 90.
      totalRequests: suite === 'u6-proc' ? 130 : suite === 'u6-jobs' ? 100 : suite === 'u6-arc-a' ? 90 : suite === 'u6-arc-d' ? 90 : 80,
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
    } else if (suite === 'u6-shadow') {
      await runShadowParity({ factory, record, rc, log, line, worlds, keepHome, evidence })
    } else if (suite === 'u6-fs') {
      await runU6Fs({ factory, record, rc, log, line, worlds, keepHome, evidence, runId })
    } else if (suite === 'u6-proc') {
      await runU6Proc({ factory, record, rc, log, line, worlds, keepHome, evidence, runId })
    } else if (suite === 'u6-jobs') {
      await runU6Jobs({ factory, record, rc, log, line, worlds, keepHome, evidence, runId })
    } else if (suite === 'u6-arc-a') {
      await runU6ArcA({ factory, record, rc, log, line, worlds, keepHome, evidence, runId })
    } else if (suite === 'u6-arc-d') {
      await runU6ArcD({ factory, record, rc, log, line, worlds, keepHome, evidence, runId })
    } else if (suite === 'u7-fs-mut') {
      await runU7FsMut({ factory, record, rc, log, line, worlds, keepHome, evidence, runId })
    } else if (suite === 'crash-victim') {
      await caseCrashVictim({ factory, record, rc, line, worlds, keepHome })
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
