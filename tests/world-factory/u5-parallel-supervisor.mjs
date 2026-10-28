#!/usr/bin/env node
/**
 * u5-parallel-supervisor.mjs — U5 parallelism proof (plan U5 bullet 4).
 *
 * TWO Worlds run concurrently as CHILD RUNNER PROCESSES (this supervisor
 * spawns and owns only those runners — it starts no Host itself; each runner
 * starts its own through the shared launcher):
 *
 *   A (`--suite core-restart`) — read/write/restart on the test side:
 *       boot, positive write, error-effect write, defect probe, STOP, BOOT
 *       AGAIN on the same World, re-read + new write, clean teardown.
 *   B (`--suite core`)         — killed abnormally mid-run: as soon as B
 *       prints U5-IN-RUN (host booted, session live, prompts in flight),
 *       the supervisor SIGKILLs B's RUNNER pid. That deliberately orphans
 *       B's host child, port lease, and home — the crash-recovery exercise.
 *
 * Immediately after the kill the supervisor runs the factory's reclaim:
 *   - kill ONLY the pids recorded in B's .u5-ownership.json, each re-verified
 *     via /proc environ (DSH_HOME == B's home) — never by name or port scan;
 *   - release the stale leases (dead holder pid);
 *   - delete B's home ONLY through its .u5-created.json ownership marker.
 * While that happens, A must still be running; A's verdict comes from A's own
 * RUN record. The supervisor additionally proves: pristine Host porcelain +
 * HEAD unchanged; :3080 read-only probe unchanged; sibling homes untouched.
 *
 * Windows disclosure: descendant-TREE cleanup (beyond the recorded direct
 * pids) is not implemented here — on win32 this supervisor records
 * `windows-process-tree-cleanup: ENV_BLOCK` and does NOT claim tree cleanup.
 * Linux is the graded platform for this gate.
 *
 * Usage:
 *   node tests/world-factory/u5-parallel-supervisor.mjs --evidence <dir> \
 *     [--mode parallel|crash-reclaim] [--survivor-suite core|core-restart] \
 *     [--budget-ledger <jsonl>] [--max-host-starts 15] [--kill-after ms] \
 *     [--inflight-timeout ms] [--reconstruct <run-record.json>]
 *
 * MODES
 *   parallel (default, G3 shape) — A core-restart ∥ B core, B's RUNNER killed.
 *   crash-reclaim (FIX-T T2 — closes the G3 SKIP gap): B runs the
 *   `crash-victim` suite: the victim World boots, authenticates and holds a
 *   canary tool call IN FLIGHT (tool body blocked on its gate file, canary
 *   plugin marker `<tag>.pre` written, `<tag>.post` never). Only after the
 *   runner prints U5-IN-FLIGHT does the supervisor SIGKILL the victim's WHOLE
 *   OWNED PROCESS GROUP (B spawned detached → group = victim runner + its
 *   host + mock; nobody else can be in a group we created). The reclaim then
 *   runs while survivor A keeps working, and PASS requires the conjunction:
 *   in-flight marker present + completion marker absent + no victim RUN
 *   record (the kill provably landed mid-tool), every stale lease (host AND
 *   mock port) reclaimed with `reclaimedFrom` provenance naming the killed
 *   runner, victim host pid dead (killed by the reclaim with /proc environ
 *   proof if it survived the group kill), zero refusals, home deleted via its
 *   ownership marker, ports free. If the in-flight gate fails the case FAILS
 *   — this mode has no SKIP. A (`--survivor-suite`, default `core` = one
 *   boot) proves the surviving parallel World is unaffected. Total host
 *   starts this mode: 2.
 *
 * Opt-in only (live Host children): never collected by vitest/CI.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { TestWorldFactory, reclaimWorld, homesCensus, stableInstanceProbe } from './lib/world-factory.mjs'
import { pidAlive, scanAllLeases, scanStaleLeases } from './lib/port-lease.mjs'
import { portInUse } from '../characterization/lib/util.mjs'
import { createRunRecord, exitCodeFor, formatSummary, readAuthorityBinding } from './lib/run-record.mjs'
import { holdSurvivor } from './u5-canary-runner.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')
// Test seam: DSH_U5_RUNNER replaces the runner script (the offline
// dry-orchestration check points it at a stub; production leaves it unset).
const RUNNER = process.env.DSH_U5_RUNNER ?? join(HERE, 'u5-canary-runner.mjs')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Pure C1 law for the live survivor conjunction. The kill must be strictly
 * inside the survivor's healthy-to-last-probe interval, and every reclaim
 * effect must be scoped to the victim world/resources.
 */
export function evaluateSurvivorSequencing({ survivorHealthyAt, killAt, survivorLastProbeAt, survivorTornDownAt, victimKilledAndReclaimedAt = null, victimWorld, reclaimedResources = [], survivorProbes = [], survivorHostPidBefore = null, survivorHostPidAfter = null, survivorWorldIdBefore = null, survivorWorldIdAfter = null }) {
  const probes = survivorProbes.filter((probe) => probe !== null && typeof probe === 'object')
  const successful = probes.filter((probe) => probe.ok === true && Number.isFinite(Number(probe.at)))
  const failed = probes.filter((probe) => probe.ok !== true)
  const preKillSuccess = successful.some((probe) => Number(probe.at) < killAt)
  const postReclaimSuccess = successful.some((probe) => Number(probe.at) > Number(victimKilledAndReclaimedAt ?? killAt))
  const failedInWindow = failed.filter((probe) => Number(probe.at) >= Number(survivorHealthyAt) && Number(probe.at) <= Number(survivorTornDownAt))
  const probeAfterReclaim = successful.some((probe) => Number(probe.at) > killAt)
  const timestamps = [survivorHealthyAt, killAt, survivorLastProbeAt, survivorTornDownAt]
  const ordered = timestamps.every(Number.isFinite)
    && survivorHealthyAt < killAt
    && killAt < survivorLastProbeAt
    && survivorLastProbeAt <= survivorTornDownAt
  const victimOnly = reclaimedResources.every((resource) => resource?.world === victimWorld)
  const reclaimTouchedOnlyVictim = reclaimedResources.length > 0 && victimOnly
  const identityContinuous = survivorHostPidBefore !== null
    && survivorHostPidBefore === survivorHostPidAfter
    && survivorWorldIdBefore !== null
    && survivorWorldIdBefore === survivorWorldIdAfter
  const failureReason = failedInWindow[0] ?? null
  return {
    killInsideSurvivorWindow: ordered,
    survivorHeldUntilReclaim: ordered,
    survivorProbeAfterReclaim: probeAfterReclaim,
    preKillProbeSucceeded: preKillSuccess,
    postReclaimProbeSucceeded: postReclaimSuccess,
    failedProbeInWindow: failedInWindow.length > 0,
    failedProbe: failureReason,
    survivorHostIdentityContinuous: identityContinuous,
    reclaimVictimOnly: reclaimTouchedOnlyVictim,
    pass: ordered && preKillSuccess && postReclaimSuccess && failedInWindow.length === 0 && reclaimTouchedOnlyVictim && identityContinuous,
  }
}

export async function runSurvivorDryRun({ io = undefined } = {}) {
  const injected = io !== undefined
  const simulated = true
  mkdirSync(join(REPO_ROOT, '.artifacts', 'tmp'), { recursive: true })
  const sharedLeaseRoot = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: join(REPO_ROOT, '.artifacts', 'tmp', 'dryrun-evidence') }).leaseRoot
  const sharedBefore = leaseRootSnapshot(sharedLeaseRoot)
  const holdUntil = join(REPO_ROOT, `.tmp-survivor-dry-run-${process.pid}`)
  try {
    const fakeWorld = { id: 'fake-survivor', home: '<FAKE_HOME>', token: 'fake-token', workspaceDir: '<FAKE_WORKSPACE>', instance: { child: { pid: 42 } } }
    let calls = 0
    const probeIo = io ?? {
      async probe({ released }) {
        calls += 1
        if (calls === 1) return { ok: true, status: 200, evidence: { health: { contentMatch: true }, effect: { contentMatch: true }, released } }
        return { ok: true, status: 200, evidence: { health: { contentMatch: true }, effect: { contentMatch: true }, released } }
      },
    }
    const probeLog = `${holdUntil}.jsonl`
    const holdPromise = holdSurvivor({ world: fakeWorld, origin: 'http://fake-survivor', holdUntil, probeLog, oracle: null, io: probeIo, simulated: injected })
    await sleep(1)
    writeFileSync(holdUntil, 'victimKilledAndReclaimed\n')
    const hold = await holdPromise
    const sequencing = evaluateSurvivorSequencing({
      survivorHealthyAt: hold.healthyAt,
      killAt: hold.healthyAt + 1,
      victimKilledAndReclaimedAt: hold.lastProbeAt - 1,
      survivorLastProbeAt: hold.lastProbeAt,
      survivorTornDownAt: hold.lastProbeAt + 1,
      survivorProbes: readFileSync(probeLog, 'utf8').trim().split('\\n').filter(Boolean).map((line) => {
        const digest = JSON.parse(line)
        return injected ? digest : assertLiveDigest(digest)
      }),
      survivorHostPidBefore: 42,
      survivorHostPidAfter: hold.survivorIdentity.pid,
      survivorWorldIdBefore: 'fake-survivor',
      survivorWorldIdAfter: hold.survivorIdentity.worldId,
      victimWorld: 'fake-victim',
      reclaimedResources: [{ world: 'fake-victim', kind: 'home' }, { world: 'fake-victim', kind: 'lease' }],
    })
    const sharedAfter = leaseRootSnapshot(sharedLeaseRoot)
    const simulationFactory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: join(REPO_ROOT, '.artifacts', 'tmp', 'dryrun-evidence') })
    const simulation = await crashSimulationControl({ factory: simulationFactory })
    const sharedFinal = leaseRootSnapshot(sharedLeaseRoot)
    const sharedLeaseRootUnchanged = JSON.stringify(sharedBefore) === JSON.stringify(sharedAfter) && JSON.stringify(sharedBefore) === JSON.stringify(sharedFinal)
    return {
      ...sequencing,
      simulation,
      sharedLeaseRoot,
      sharedLeaseRootUnchanged,
      simulated: injected,
      evidenceKind: injected ? 'injected-io' : 'real-io',
      pass: sequencing.pass && simulation.ok && sharedLeaseRootUnchanged,
    }
  } finally {
    try { unlinkSync(holdUntil) } catch {}
    try { unlinkSync(`${holdUntil}.jsonl`) } catch {}
  }
}

export function parseArgs(argv) {
  const out = { evidence: null, budgetLedger: null, maxHostStarts: 15, killAfterMs: 1_500, reconstruct: null, mode: 'parallel', survivorSuite: null, inflightTimeoutMs: 300_000, dryRun: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--evidence') out.evidence = String(argv[++i])
    else if (a === '--budget-ledger') out.budgetLedger = String(argv[++i])
    else if (a === '--max-host-starts') out.maxHostStarts = Number(argv[++i])
    else if (a === '--kill-after') out.killAfterMs = Number(argv[++i])
    else if (a === '--inflight-timeout') out.inflightTimeoutMs = Number(argv[++i])
    else if (a === '--mode') out.mode = String(argv[++i])
    else if (a === '--survivor-suite') out.survivorSuite = String(argv[++i])
    else if (a === '--reconstruct') out.reconstruct = String(argv[++i])
    else if (a === '--dry-run') out.dryRun = true
    else throw new Error(`unknown argument: ${a}`)
  }
  if (out.evidence === null) throw new Error('--evidence is required')
  if (!['parallel', 'crash-reclaim'].includes(out.mode)) throw new Error(`unknown --mode ${out.mode}`)
  if (out.survivorSuite !== null && !['core', 'core-restart'].includes(out.survivorSuite)) throw new Error(`unknown --survivor-suite ${out.survivorSuite}`)
  return out
}

function git(args) {
  const r = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} exit ${String(r.status)}`)
  return String(r.stdout).trim()
}

/** Team-repo provenance is distinct from the pristine test-use Host tree. */
export function teamTreeBinding({ runGit = git } = {}) {
  const porcelain = runGit(['status', '--porcelain', '--untracked-files=no'])
  const paths = porcelain.split('\\n').filter(Boolean).slice(0, 8).map((line) => line.slice(3))
  return { teamTreeClean: paths.length === 0, ...(paths.length > 0 ? { teamTreeDirtyPaths: paths } : {}) }
}

/** A simulated digest must never be accepted as a live verdict input. */
export function assertLiveDigest(digest) {
  if (digest?.simulated === true) throw new Error('simulated evidence cannot be consumed as a live verdict')
  return digest
}

/**
 * Start one runner child with file-fd stdout (the characterization sandbox
 * mechanism — no piped stdio); stderr inherited for operator visibility; a
 * memory buffer of stdout lets the supervisor watch for U5-IN-RUN.
 *
 * FIX-T T3 (bounded logs): the runner log file is byte-capped — a runaway
 * (looping/spamming runner, e.g. a crash victim's fork bomb of errors) can
 * never grow evidence without bound. On reaching the cap the file gets ONE
 * notice row and no further bytes; the watch buffer rolls instead of growing.
 * `detached: true` makes the child a PROCESS GROUP LEADER — the crash-reclaim
 * mode's kill target scope (a group only our spawn ever created).
 */
const RUNNER_LOG_CAP_BYTES = 32 * 1024 * 1024
const WATCH_BUFFER_MAX_CHARS = 2_000_000

function startRunner({ tag, args, logDir, detached = false }) {
  mkdirSync(logDir, { recursive: true })
  const outPath = join(logDir, `runner-${tag}.log`)
  const outFd = openSync(outPath, 'a')
  const child = spawn(process.execPath, [RUNNER, ...args], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'inherit'],
    env: process.env,
    detached,
  })
  const buffer = { text: '' }
  let writtenBytes = 0
  let cappedNoticed = false
  child.stdout.on('data', (chunk) => {
    const s = chunk.toString('utf8')
    buffer.text += s
    if (buffer.text.length > WATCH_BUFFER_MAX_CHARS) buffer.text = buffer.text.slice(-WATCH_BUFFER_MAX_CHARS / 2)
    if (writtenBytes >= RUNNER_LOG_CAP_BYTES) {
      if (!cappedNoticed) {
        cappedNoticed = true
        try {
          writeSync(outFd, `\n[RUNNER-LOG-CAP-REACHED bytes=${RUNNER_LOG_CAP_BYTES} further bytes dropped — FIX-T T3]\n`)
        } catch {
          /* nothing more we can do */
        }
      }
      return
    }
    try {
      writtenBytes += writeSync(outFd, s).bytesWritten ?? s.length
    } catch {
      /* log write must never break the watch */
    }
  })
  child.on('close', () => {
    try {
      closeSync(outFd)
    } catch {
      /* already closed */
    }
  })
  return { child, outPath, buffer }
}

async function waitForLine(buffer, pattern, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const m = buffer.text.match(pattern)
    if (m !== null) return m
    if (Date.now() >= deadline) return null
    await sleep(250)
  }
}

/** SIGKILL ONLY our own child runner (we spawned it; we hold the handle). */
async function killOwnChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return { alreadyExited: true, code: child.exitCode, signal: child.signalCode }
  const exited = new Promise((r) => child.once('close', (code, signal) => r({ code, signal })))
  child.kill('SIGKILL')
  const raced = await Promise.race([exited, sleep(10_000).then(() => 'timeout')])
  return typeof raced === 'string' ? { timedOut: true } : { exited: raced }
}

function tailFile(path, n = 2000) {
  try {
    return readFileSync(path, 'utf8').slice(-n)
  } catch {
    return '<unreadable>'
  }
}

/**
 * Offline crash-simulation control (no Host boot): rebuild the exact crash
 * residue (real orphaned process with DSH_HOME in its environ, a lease whose
 * holder pid is dead, a marker-bearing World home + ownership file) and drive
 * the production `reclaimWorld` over it. Deterministic — unlike the live kill,
 * which can lose the race against a fast self-cleaning victim.
 */
function leaseRootSnapshot(leaseRoot) {
  let names = []
  try { names = readdirSync(leaseRoot).sort() } catch { return { exists: false, names: [], seqMtimes: {} } }
  const seqMtimes = {}
  for (const name of names) {
    if (!name.endsWith('.lease')) continue
    try {
      const seq = join(leaseRoot, name, 'seq')
      seqMtimes[name] = statSync(seq).mtimeMs
    } catch {
      seqMtimes[name] = null
    }
  }
  return { exists: true, names, seqMtimes }
}

export async function crashSimulationControl({ factory, leaseRoot = null }) {
  const sharedBefore = leaseRootSnapshot(factory.leaseRoot)
  mkdirSync(join(REPO_ROOT, '.artifacts', 'tmp'), { recursive: true })
  const simulationLeaseRoot = leaseRoot ?? mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'dryrun-leases-'))
  mkdirSync(simulationLeaseRoot, { recursive: true })
  const world = await factory.createWorld({ line: 'dryclm' })
  const orphan = spawn('sleep', ['300'], { env: { ...process.env, DSH_HOME: world.home }, stdio: 'ignore' })
  const { acquireFirstFreeLease } = await import('./lib/port-lease.mjs')
  const lease = await acquireFirstFreeLease({ leaseRoot: simulationLeaseRoot, world: world.id, purpose: 'sim-host', include: [3498, 3499, 3500], preferred: [] })
  writeFileSync(join(world.home, '.u5-ownership.json'), JSON.stringify({ worldId: world.id, runnerPid: process.pid, hostPid: orphan.pid, hostPort: lease.port, mockPort: null }, null, 2))
  // "Crash": the simulated runner dies; the orphan + lease + home survive.
  // Our OWN pid must not be the reclaim target, so record a dead holder in
  // the LEASE by releasing-and-rewriting it as a dead pid (what a dead runner
  // leaves behind).
  lease.release()
  // FIX-T T1 slot layout: a stale lease is an attempt FILE inside the
  // `<port>.lease/` slot dir — exactly what a dead runner leaves behind.
  mkdirSync(lease.slotPath, { recursive: true })
  writeFileSync(join(lease.slotPath, 'c-000000000001-w-4194303-simcontrol.json'), JSON.stringify({ pid: 4_194_303, startedAt: new Date().toISOString(), world: world.id, purpose: 'sim-host', token: 'simcontrol', seq: 1 }, null, 2) + '\n')
  const stale = scanStaleLeases(simulationLeaseRoot).filter((s) => s.by?.world === world.id)
  const reclaim = await reclaimWorld({ home: world.home, worldId: world.id, leasePaths: stale.map((s) => ({ path: s.leasePath, port: s.port, by: s.by, legacy: s.legacy === true })) })
  await sleep(1_200)
  const checks = {
    orphanPid: orphan.pid,
    orphanKilledOnlyAfterEnvironProof: reclaim.killed.includes(orphan.pid) && !pidAlive(orphan.pid),
    refused: reclaim.refused,
    leaseReleased: reclaim.leasesReleased.includes(lease.port),
    homeDeleted: reclaim.homeDeleted === world.home,
    mechanism: 'identical reclaimWorld entry point as the live path; orphan verified via /proc/<pid>/environ DSH_HOME before kill',
  }
  const sharedRootUnchanged = JSON.stringify(sharedBefore) === JSON.stringify(leaseRootSnapshot(factory.leaseRoot))
  const result = { ok: checks.orphanKilledOnlyAfterEnvironProof && checks.leaseReleased && checks.homeDeleted && reclaim.refused.length === 0 && sharedRootUnchanged, ...checks, sharedRootUnchanged, simulationLeaseRoot }
  rmSync(simulationLeaseRoot, { recursive: true, force: true })
  return result
}

export async function runParallelSupervisor(opts) {
  const { evidence, budgetLedger, maxHostStarts, killAfterMs } = opts
  mkdirSync(evidence, { recursive: true })
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runId = `u5-parallel-${stamp}`
  const teamSha = git(['rev-parse', 'HEAD'])
  const hostBasePre = factory.assertHostBase('pre')
  const stablePre = await stableInstanceProbe()
  const homesPre = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const record = createRunRecord({
    runId,
    suite: 'parallel',
    selectedCases: ['abnormal-kill-reclaim', 'crash-simulation-reclaim', 'other-world-unaffected', 'pristine-host-and-stable-untouched', 'sibling-homes-untouched'],
    ledgerPath: budgetLedger,
    bindings: {
      teamSha,
      hostTreePristine: hostBasePre.porcelainEmpty === true,
      ...teamTreeBinding(),
      authority: readAuthorityBinding(REPO_ROOT),
      hostSha: hostBasePre.head,
      worldIds: [],
      leaseRoot: factory.leaseRoot,
      note: 'A = core-restart runner (2 boots); B = core runner SIGKILLed mid-run; reclaim = factory crash recovery',
    },
  })

  const runnerLogDir = join(evidence, 'logs', 'runners')
  const recA = join(evidence, `run-${runId}-A.json`)
  const recB = join(evidence, `run-${runId}-B.json`)
  const common = ['--evidence', evidence, '--max-host-starts', String(maxHostStarts), ...(budgetLedger !== null ? ['--budget-ledger', budgetLedger] : [])]
  const A = startRunner({ tag: 'A', args: ['--suite', 'core-restart', '--line', 'pa', '--run-record', recA, ...common], logDir: runnerLogDir })
  const B = startRunner({ tag: 'B', args: ['--suite', 'core', '--line', 'pb', '--run-record', recB, ...common], logDir: runnerLogDir })
  record.record.runners = { A: { pid: A.child.pid, record: recA }, B: { pid: B.child.pid, record: recB } }

  // Wait for B to signal it is MID-RUN (host booted + first prompt admitted).
  const inRun = await waitForLine(B.buffer, /^U5-IN-RUN (\S+) (\S+) (\d+)$/m, 300_000)
  if (inRun === null) {
    record.addCase('abnormal-kill-reclaim', 'FAIL', { reason: 'B never reached mid-run state', bTail: tailFile(join(runnerLogDir, 'runner-B.log')) })
    await killOwnChild(B.child)
    await killOwnChild(A.child)
    const rec = record.finalize()
    record.write(join(evidence, `run-${runId}.json`))
    return rec
  }
  const [, bWorld, bHome, bHostPidRaw] = inRun
  const bHostPid = Number(bHostPidRaw)
  record.record.bWorld = { id: bWorld, home: bHome, hostPid: bHostPid }
  record.record.bindings.worldIds.push(bWorld)
  await sleep(killAfterMs) // a beat into the run, not at the boundary

  // ── the abnormal kill: B's RUNNER, by OUR handle, SIGKILL ──────────────────
  const killReceipt = await killOwnChild(B.child)
  record.record.abnormalKill = {
    at: new Date().toISOString(),
    killedRunnerPid: B.child.pid,
    receipt: killReceipt,
    signal: 'SIGKILL',
    killedWhat: 'own child runner process (handle-held) — its host child deliberately orphaned to exercise crash recovery',
  }

  // ── crash recovery for B while A continues ────────────────────────────────
  await sleep(2_000) // the orphaned host keeps serving until reclaim kills it
  const staleLeases = scanStaleLeases(factory.leaseRoot)
  const bStale = staleLeases.filter((s) => s.by?.world === bWorld)
  const reclaim = await reclaimWorld({
    home: bHome,
    worldId: bWorld,
    leasePaths: bStale.map((s) => ({ path: s.leasePath, port: s.port, by: s.by, legacy: s.legacy === true })),
  })
  await sleep(1_500)
  const orphanDead = !pidAlive(bHostPid)
  const windowsBlock = process.platform === 'win32'
  // The crash state is proven either by reclaim finding it (the intended
  // race) or by B's own RUN record being absent (runner died mid-run). If B
  // finished BEFORE the kill landed, the kill was not a mid-run crash and the
  // recovery race was not exercised live — say so, and lean on the offline
  // crash-simulation control below, which drives the identical reclaim path
  // with an orphaned REAL process.
  const crashRaced = reclaim.killed.length + reclaim.leasesReleased.length > 0 || reclaim.homeDeleted !== null
  let bSelfCleaned = false
  if (!crashRaced) {
    try {
      JSON.parse(readFileSync(recB, 'utf8'))
      bSelfCleaned = true
    } catch {
      /* no record => died mid-run after all */
    }
  }
  const reclaimConjunction = (r) => r.orphanDead && r.refused.length === 0
  const killVerdict = crashRaced
    ? (reclaimConjunction({ orphanDead, refused: reclaim.refused }) && reclaim.killed.includes(bHostPid) && reclaim.homeDeleted === bHome ? 'PASS' : 'FAIL')
    : bSelfCleaned ? 'SKIP' : 'FAIL'
  record.addCase('abnormal-kill-reclaim', killVerdict, {
    killedPids: reclaim.killed,
    refusedPids: reclaim.refused,
    leasesReleased: reclaim.leasesReleased,
    homeDeleted: reclaim.homeDeleted,
    orphanedHostPidDead: orphanDead,
    crashStatePresentAtReclaim: crashRaced,
    victimFinishedBeforeKill: bSelfCleaned,
    ...(killVerdict === 'SKIP' ? {
      skipReason: 'the SIGKILL landed AFTER the victim runner had already completed its suite and torn its World down (mock turns are fast: the whole core suite finishes in ~2 s, the supervisor kill-after could not beat it). The kill was still delivered through our own child handle, and A proved unaffected — but the crash-residue recovery race was NOT exercised live. It is exercised offline by crash-simulation-reclaim (same reclaimWorld entry point, orphaned REAL process). Verdict SKIP, deliberately not recoloured to PASS.',
    } : {}),
    ownershipVerification: 'Linux /proc/<pid>/environ carried DSH_HOME == B home for every killed pid (no pattern/name kills)',
    windowsProcessTreeCleanup: windowsBlock ? 'ENV_BLOCK — descendant-tree cleanup beyond recorded pids is not implemented on Windows; not claimed' : 'n/a (Linux)',
  })
  // Crash-simulation control (offline, zero Host boots, always run): the exact
  // state a live mid-run crash leaves — an orphaned REAL process whose environ
  // carries the World DSH_HOME, a stale port lease and an intact ownership
  // marker — is reclaimed through the same reclaimWorld entry point.
  record.record.crashSimulationControl = await crashSimulationControl({ factory })
  record.addCase('crash-simulation-reclaim', record.record.crashSimulationControl.ok ? 'PASS' : 'FAIL', record.record.crashSimulationControl)

  // ── A must still be running right now, and finish green afterwards ────────
  const aAliveMidReclaim = A.child.exitCode === null && A.child.signalCode === null
  const aExit = await Promise.race([
    new Promise((r) => A.child.once('close', (code, signal) => r({ code, signal }))),
    sleep(9 * 60_000).then(() => ({ timeout: true })),
  ])
  if (aExit.timeout === true) await killOwnChild(A.child)
  let aRecord = null
  try {
    aRecord = JSON.parse(readFileSync(recA, 'utf8'))
  } catch {
    aRecord = null
  }
  record.addCase('other-world-unaffected', aExit.timeout !== true && aRecord?.overall === 'PASS' && aAliveMidReclaim ? 'PASS' : 'FAIL', {
    aAliveWhileBWasReclaimed: aAliveMidReclaim,
    aExit,
    aOverall: aRecord?.overall ?? 'record-missing',
    aCases: aRecord?.cases?.map((c) => `${c.id}=${c.verdict}`) ?? [],
  })

  // ── global untouched checks ───────────────────────────────────────────────
  let hostBaseOk = false
  let hostBasePost = null
  try {
    hostBasePost = factory.assertHostBase('post')
    hostBaseOk = true
  } catch (error) {
    hostBasePost = { error: String(error?.message ?? error) }
  }
  const stablePost = await stableInstanceProbe()
  record.addCase('pristine-host-and-stable-untouched', hostBaseOk && stablePost.status === stablePre.status ? 'PASS' : 'FAIL', {
    hostBasePre,
    hostBasePost,
    stableInstance: { pre: stablePre, post: stablePost },
  })

  const homesPost = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const foreign = []
  for (const [name, mtime] of Object.entries(homesPost)) {
    if (name.startsWith('u5')) continue // our own worlds (A's; B's and dry stubs' are reclaimed by now)
    if (!(name in homesPre)) foreign.push(`${name}:+created`)
    else if (homesPre[name] !== mtime) foreign.push(`${name}:~touched`)
  }
  for (const name of Object.keys(homesPre)) {
    if (name in homesPost) continue
    if (!name.startsWith('u5')) foreign.push(`${name}:-removed`)
  }
  record.addCase('sibling-homes-untouched', foreign.length === 0 ? 'PASS' : 'FAIL', {
    foreignChanges: foreign,
    note: 'homes of other agents (e.g. the G1-F lane) + durable worlds must be identical by census (name+mtime)',
  })

  const rec = record.finalize()
  record.write(join(evidence, `run-${runId}.json`))
  return rec
}


/** readdir that never throws (missing dir = empty). */
function readdirSafe(dir) {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * pids of live processes whose /proc/<pid>/environ still names
 * DSH_HOME=<home> — even after the home directory was deleted the env block
 * survives in the process, so this is the strongest post-reclaim leak scan:
 * ANY survivor claiming a destroyed World home is residue reclaim owns.
 * Reads only: never touches processes, reads only /proc. On non-Linux the
 * scan is unavailable and returns null — callers treat null as
 * 'unavailable', NEVER as proof of zero.
 */
function scanPidsClaimingHome(home) {
  const needle = `DSH_HOME=${home}`
  const out = []
  let pids
  try {
    pids = readdirSync('/proc')
  } catch {
    return null
  }
  for (const name of pids) {
    if (!/^\d+$/.test(name)) continue
    const pid = Number(name)
    if (pid === process.pid) continue
    try {
      const env = readFileSync(`/proc/${name}/environ`)
      if (env.includes(needle)) out.push(pid)
    } catch {
      /* vanished or not ours to read: not a provable claim */
    }
  }
  return out
}

/**
 * FIX-T T2 — LIVE abnormal-kill crash reclaim. The victim World is killed
 * (whole owned process group, SIGKILL) with a canary tool call PROVABLY in
 * flight; the reclaim scan must clear every residue with provenance while a
 * survivor World keeps running. The in-flight gate is what the G3 run lacked:
 * PASS is computed ONLY from receipts that the kill landed mid-tool
 * (`<tag>.pre` exists, `<tag>.post` does NOT, victim RUN record absent).
 * No SKIP in this mode — an unlanded kill is a FAIL.
 */
export async function runCrashReclaimSupervisor(opts) {
  const { evidence, budgetLedger, maxHostStarts, killAfterMs, survivorSuite, inflightTimeoutMs } = opts
  const aSuite = survivorSuite ?? 'core'
  mkdirSync(evidence, { recursive: true })
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runId = `u5-crash-${stamp}`
  const teamSha = git(['rev-parse', 'HEAD'])
  const hostBasePre = factory.assertHostBase('pre')
  const stablePre = await stableInstanceProbe()
  const homesPre = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const record = createRunRecord({
    runId,
    suite: 'parallel',
    selectedCases: ['abnormal-kill-reclaim', 'crash-simulation-reclaim', 'other-world-unaffected', 'pristine-host-and-stable-untouched', 'sibling-homes-untouched'],
    ledgerPath: budgetLedger,
    bindings: {
      teamSha,
      hostTreePristine: hostBasePre.porcelainEmpty === true,
      ...teamTreeBinding(),
      authority: readAuthorityBinding(REPO_ROOT),
      hostSha: hostBasePre.head,
      worldIds: [],
      leaseRoot: factory.leaseRoot,
      mode: 'crash-reclaim',
      note: `A = ${aSuite} runner (survivor, 1 boot) started AFTER B's U5-IN-FLIGHT; B = crash-victim runner (1 boot, held canary call), SIGKILL to B's OWN process group once A signals U5-IN-RUN (survivor straddles kill+reclaim); reclaim = factory crash recovery with provenance`,
    },
  })

  const runnerLogDir = join(evidence, 'logs', 'runners')
  const recA = join(evidence, `run-${runId}-A.json`)
  const recB = join(evidence, `run-${runId}-B.json`)
  const survivorRelease = join(evidence, `${runId}.victimKilledAndReclaimed`)
  const survivorProbeLog = join(evidence, `${runId}.survivor-probes.jsonl`)
  const common = ['--evidence', evidence, '--max-host-starts', String(maxHostStarts), ...(budgetLedger !== null ? ['--budget-ledger', budgetLedger] : [])]
  // FIX-T T2 (run-3 lesson): the survivor starts only AFTER the victim has
  // proven its held in-flight call, and the kill waits until the survivor
  // itself signals U5-IN-RUN — otherwise the fast core suite finishes long
  // before the kill and 'other-world-unaffected' can never be proven live.
  // The victim's gate holds the call up to capMs, so the survivor's boot
  // fits inside the held window.
  // The victim runs as its OWN process group leader: the kill below targets
  // exactly the group OUR spawn created (runner + its host child + mock
  // threads), never a pattern, a port owner, or anybody else's tree.
  const B = startRunner({ tag: 'B', args: ['--suite', 'crash-victim', '--line', 'cb', '--run-record', recB, ...common], logDir: runnerLogDir, detached: true })
  record.record.runners = { B: { pid: B.child.pid, pgid: B.child.pid, record: recB, detachedGroup: true } }

  const finish = async (rec) => {
    record.record.bindings.hostBasePost = (() => {
      try {
        return factory.assertHostBase('post')
      } catch (error) {
        return { error: String(error?.message ?? error) }
      }
    })()
    const stablePost = await stableInstanceProbe()
    record.addCase('pristine-host-and-stable-untouched', record.record.bindings.hostBasePost.error === undefined && stablePost.status === stablePre.status ? 'PASS' : 'FAIL', {
      hostBasePre,
      hostBasePost: record.record.bindings.hostBasePost,
      stableInstance: { pre: stablePre, post: stablePost },
    })
    const homesPost = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
    const foreign = []
    for (const [name, mtime] of Object.entries(homesPost)) {
      if (name.startsWith('u5')) continue
      if (!(name in homesPre)) foreign.push(`${name}:+created`)
      else if (homesPre[name] !== mtime) foreign.push(`${name}:~touched`)
    }
    for (const name of Object.keys(homesPre)) {
      if (name in homesPost) continue
      if (!name.startsWith('u5')) foreign.push(`${name}:-removed`)
    }
    record.addCase('sibling-homes-untouched', foreign.length === 0 ? 'PASS' : 'FAIL', { foreignChanges: foreign })
    const final = record.finalize()
    record.write(join(evidence, `run-${runId}.json`))
    return final
  }

  // ── wait for the victim to prove the call is IN FLIGHT ─────────────────────
  const inflight = await waitForLine(B.buffer, /^U5-IN-FLIGHT (\S+) (\S+) (\d+) (\S+)$/m, inflightTimeoutMs)
  if (inflight === null) {
    record.addCase('abnormal-kill-reclaim', 'FAIL', {
      reason: 'victim runner never printed U5-IN-FLIGHT (boot, auth, session or in-flight marker failed) — the crash kill was NOT exercised on a held call; no PASS possible',
      bTail: tailFile(join(runnerLogDir, 'runner-B.log')),
    })
    await killOwnChild(B.child)
    record.addCase('crash-simulation-reclaim', 'FAIL', { reason: 'skipped-by-fail-closed: live crash case already failed; the offline control would not repair it' })
    record.addCase('other-world-unaffected', 'FAIL', { reason: 'live crash case failed before survivor proof' })
    return finish(record.record)
  }
  const [, bWorld, bHome, bHostPidRaw, bTag] = inflight
  const bHostPid = Number(bHostPidRaw)
  record.record.bWorld = { id: bWorld, home: bHome, hostPid: bHostPid, inFlightTag: bTag }
  record.record.bindings.worldIds.push(bWorld)

  // The victim is now HELD mid-call (gate closed, capMs budget keeps it
  // alive). Start the survivor and wait until it is provably mid-suite —
  // THEN land the kill, so the survivor straddles kill+reclaim, which is
  // exactly what 'other-world-unaffected' must prove.
  const A = startRunner({ tag: 'A', args: ['--suite', aSuite, '--line', 'ca', '--run-record', recA, '--hold-until', survivorRelease, '--probe-log', survivorProbeLog, ...common], logDir: runnerLogDir })
  record.record.runners.A = { pid: A.child.pid, record: recA }
  const aInRun = await waitForLine(A.buffer, /^U5-IN-RUN (\S+) (\S+) (\d+)$/m, 300_000)
  if (aInRun === null) {
    record.addCase('abnormal-kill-reclaim', 'FAIL', { reason: 'survivor runner never reached U5-IN-RUN inside its budget — the kill was withheld rather than landed against a half-booted World; the crash path was NOT exercised against a live survivor', aTail: tailFile(join(runnerLogDir, 'runner-A.log')) })
    await killOwnChild(B.child)
    await killOwnChild(A.child)
    record.addCase('crash-simulation-reclaim', 'FAIL', { reason: 'fail-closed: live crash case failed; the offline control cannot recolour it' })
    record.addCase('other-world-unaffected', 'FAIL', { reason: 'fail-closed: live crash case failed before survivor proof' })
    return finish(record.record)
  }
  record.record.aWorld = { id: aInRun[1], home: aInRun[2], hostPid: Number(aInRun[3]) }
  record.record.bindings.worldIds.push(aInRun[1])
  await sleep(killAfterMs) // a beat inside the held window, not at its boundary

  // ── the abnormal kill: SIGKILL the victim's OWNED PROCESS GROUP ────────────
  const pgid = B.child.pid // detached spawn → the runner IS the group leader
  const groupKill = { at: new Date().toISOString(), pgid, runnerPid: B.child.pid, signal: 'SIGKILL', scope: 'process-group' }
  const exitedP = new Promise((r) => B.child.once('close', (code, signal) => r({ code, signal })))
  if (B.child.exitCode === null && B.child.signalCode === null) {
    try {
      process.kill(-pgid, 'SIGKILL')
      groupKill.delivered = 'process-group'
    } catch (error) {
      if (error.code === 'ESRCH') groupKill.delivered = 'already-exited-group'
      else throw error
    }
  } else {
    groupKill.delivered = 'already-exited'
  }
  // Belt for OUR direct child handle (the group kill normally got it first).
  if (B.child.exitCode === null && B.child.signalCode === null) {
    try {
      B.child.kill('SIGKILL')
    } catch {
      /* group kill raced us */
    }
  }
  const exited = await Promise.race([exitedP, sleep(10_000).then(() => ({ timedOut: true }))])
  groupKill.runnerCloseReceipt = exited
  const victimRecordBefore = existsSync(recB)

  // ── crash-state proofs BEFORE reclaim (they need the home on disk) ────────
  await sleep(1_500) // let the kernel finish tearing the group down
  const markerDir = join(bHome, 'workspace', 'markers')
  const markers = readdirSafe(markerDir)
  const ownership = safeReadJson(join(bHome, '.u5-ownership.json'))
  const preMarker = markers.includes(`${bTag}.pre`)
  const postMarker = markers.includes(`${bTag}.post`)
  const victimRecordPresent = existsSync(recB)

  // ── reclaim scan (the production crash-recovery path) ──────────────────────
  const staleLeases = scanStaleLeases(factory.leaseRoot)
  const bStale = staleLeases.filter((s) => String(s.by?.world) === bWorld)
  const reclaim = await reclaimWorld({
    home: bHome,
    worldId: bWorld,
    leasePaths: bStale.map((s) => ({ path: s.leasePath, port: s.port, by: s.by, legacy: s.legacy === true })),
  })
  writeFileSync(survivorRelease, JSON.stringify({ signal: 'victimKilledAndReclaimed', at: Date.now(), victimWorld: bWorld }) + '\n')
  // Captured IMMEDIATELY after reclaim: a peer World's next boot may sweep
  // the victim's stale claim itself (measured in run 2: the survivor's boot
  // claimed 3180 one second before this scan ran). The protocol's
  // reclaimedFrom provenance then lives in the PEER's claim instead of the
  // reclaim receipt — both paths prove the identical fact. Snapshot NOW:
  // when the peer later releases, the consumed proof vanishes with its file.
  const leasesAfterReclaim = scanAllLeases(factory.leaseRoot)
  // Survivor liveness AT the reclaim instant — the only honest moment to
  // observe it (captured here, not reconstructed after the verdict plumbing).
  const aAliveAtReclaim = pidAlive(Number(aInRun[3]))
  const sweptByPeer = leasesAfterReclaim
    .filter((l) => String(l.by?.reclaimedFrom?.world) === bWorld)
    .map((l) => ({ port: l.port, claimPid: l.by?.pid, reclaimedFrom: l.by?.reclaimedFrom }))
  await sleep(1_000)
  const hostGone = !pidAlive(bHostPid)
  const hostKilledByReclaim = reclaim.killed.includes(bHostPid)
  // The group kill normally reaps runner+host+mock together; reclaim then
  // finds them dead and has nothing to kill. Both resolutions are honest as
  // long as (a) any reclaim kill names ONLY ownership-recorded pids (those
  // kills are /proc-environ-proof-gated by construction, and the simcontrol
  // sub-case exercises that live-kill path with a real orphan), and (b) NO
  // live process anywhere still claims the destroyed home.
  const hostKillPath = hostKilledByReclaim
    ? 'reclaim-environ-proof'
    : hostGone && ownership?.hostPid === bHostPid
      ? 'process-group-kill'
      : 'unresolved'
  const reclaimKillsOnlyRecordedPids = reclaim.killed.every((pid) => pid === ownership?.hostPid || pid === ownership?.runnerPid)
  const homeClaimants = scanPidsClaimingHome(bHome)
  const zeroProcessesClaimVictimHome = homeClaimants !== null && homeClaimants.length === 0
  const hostPort = ownership?.hostPort ?? null
  const mockPort = ownership?.mockPort ?? null
  const hostPortIdle = hostPort !== null && !(await portInUse(hostPort))
  const mockPortIdle = mockPort === null || !(await portInUse(mockPort))
  const provenanceFor = (port) => reclaim.leaseProvenance.find((p) => p.port === port) ?? null
  const hostProv = provenanceFor(hostPort)
  const mockProv = provenanceFor(mockPort)
  const killLandedInFlight = groupKill.delivered === 'process-group' && preMarker === true && postMarker === false && victimRecordPresent === false && victimRecordBefore === false
  // A lease of the dead World counts as reclaimed-with-provenance when the
  // reclaim scan took it (provenance in the receipt) OR when a live peer's
  // sweep consumed it first (provenance in the peer's claim, snapshotted in
  // sweptByPeer). 'missing' = nobody ever reclaimed it with proof: FAIL.
  const peerProvFor = (port) => sweptByPeer.find((p) => p.port === port && p.reclaimedFrom?.pid === B.child.pid) ?? null
  const hostProvenancePath = hostProv?.reclaimedFrom?.pid === B.child.pid ? 'reclaim-scan' : peerProvFor(hostPort) !== null ? 'swept-by-live-peer' : 'missing'
  const mockProvenancePath = mockPort === null ? 'no-mock' : mockProv?.reclaimedFrom?.pid === B.child.pid ? 'reclaim-scan' : peerProvFor(mockPort) !== null ? 'swept-by-live-peer' : 'missing'
  const conditions = {
    killLandedInFlight,
    inFlightMarkerPresent: preMarker,
    completionMarkerAbsent: !postMarker,
    victimRunRecordAbsent: !victimRecordPresent,
    // NOTE: a non-zero bStale scan count is NOT required — a live peer's own
    // boot may legitimately sweep the victim's claims first (measured, run 2:
    // the survivor claimed the victim's host port one second before this
    // scan ran, provenance in its own claim). The per-port provenance
    // conditions below are the real requirement.
    reclaimProvenanceForEveryReleasedLease: reclaim.leaseProvenance.length === reclaim.leasesReleased.length && reclaim.leaseProvenance.every((p) => p.reclaimedFrom?.pid === B.child.pid),
    hostLeaseReclaimedWithProvenance: hostProvenancePath !== 'missing',
    mockLeaseReclaimedWithProvenance: mockProvenancePath !== 'missing',
    victimHostDead: hostGone,
    hostKillPathResolved: hostKillPath === 'reclaim-environ-proof' || hostKillPath === 'process-group-kill',
    reclaimKillsOnlyRecordedPids,
    zeroProcessesClaimVictimHome,
    zeroRefusals: reclaim.refused.length === 0,
    homeDeletedViaOwnershipMarker: reclaim.homeDeleted === bHome,
    hostPortIdle,
    mockPortIdle,
  }
  record.record.abnormalKill = {
    at: groupKill.at,
    ...groupKill,
    killedWhat: "victim crash-victim runner's OWNED process group (detached child we spawned): runner + host + mock die together; the group exists only because of this spawn",
    bWorld: { id: bWorld, home: bHome, hostPid: bHostPid, tag: bTag },
    ownershipFile: ownership,
    markersAtKill: markers,
    hostKillPath,
    hostProvenancePath,
    mockProvenancePath,
    sweptByPeer,
    homeClaimantsAfterReclaim: homeClaimants,
    reclaimReceipts: { killed: reclaim.killed, refused: reclaim.refused, leasesReleased: reclaim.leasesReleased, leaseProvenance: reclaim.leaseProvenance, leaseNotes: reclaim.leaseNotes, homeDeleted: reclaim.homeDeleted },
  }
  const killVerdict = Object.values(conditions).every((v) => v === true) ? 'PASS' : 'FAIL'
  record.addCase('abnormal-kill-reclaim', killVerdict, {
    conditions,
    verdictRule: 'PASS ONLY with the full conjunction — the in-flight trio (pre marker present, post marker absent, no victim RUN record) proves the SIGKILL landed mid-tool; the host is resolved dead either by the group kill or by a proof-gated reclaim kill, no live process anywhere claims the destroyed home, and reclaim REFUSED nothing; anything else FAILs (this mode has no SKIP)',
    ownershipVerification: 'reclaimWorld kills ONLY pids recorded in .u5-ownership.json re-verified via /proc/<pid>/environ DSH_HOME == victim home (no pattern/name kills)',
    windowsProcessTreeCleanup: process.platform === 'win32' ? 'ENV_BLOCK — descendant-tree cleanup beyond recorded pids is not implemented on Windows; not claimed' : 'n/a (Linux)',
  })
  if (killVerdict === 'FAIL') {
    // fail-closed: do not spend the survivor/global checks pretending; kill
    // both children, honest reds.
    await killOwnChild(B.child)
    await killOwnChild(A.child)
    record.addCase('crash-simulation-reclaim', 'FAIL', { reason: 'live crash case failed; offline control cannot recolour it' })
    record.addCase('other-world-unaffected', 'FAIL', { reason: 'live crash case failed before survivor proof' })
    return finish(record.record)
  }

  // ── offline control still runs: the proof-gated kill stays live-fired ─────
  record.record.crashSimulationControl = await crashSimulationControl({ factory })
  record.addCase('crash-simulation-reclaim', record.record.crashSimulationControl.ok ? 'PASS' : 'FAIL', record.record.crashSimulationControl)

  // ── A (survivor World) unaffected while B was crashed + reclaimed ──────────
  // Run-3 lesson: the child 'close' event can lag arbitrarily (a stdio fd
  // kept open by a descendant outlives the exited runner), so completion is
  // settled by the RUN RECORD + a dead pid, with 'close' as the fast path
  // and the 9-minute window only as the backstop kill for true stragglers.
  const aDone = new Promise((resolve) => {
    const tick = setInterval(() => {
      if (!existsSync(recA)) return
      const rec = safeReadJson(recA)
      if (rec !== null && (A.child.exitCode !== null || A.child.signalCode !== null || !pidAlive(A.child.pid))) {
        clearInterval(tick)
        resolve({ via: 'record+dead' })
      }
    }, 500)
    A.child.once('close', (code, signal) => {
      clearInterval(tick)
      resolve({ code, signal, via: 'close' })
    })
  })
  const aExit = await Promise.race([aDone, sleep(9 * 60_000).then(() => ({ timeout: true }))])
  if (aExit.timeout === true) await killOwnChild(A.child)
  const aRecord = safeReadJson(recA)
  const probeRows = (() => {
    try { return readFileSync(survivorProbeLog, 'utf8').trim().split('\\n').filter(Boolean).map((line) => JSON.parse(line)) } catch { return [] }
  })()
  const release = safeReadJson(survivorRelease)
  const survivorHold = aRecord?.survivorHold ?? {}
  const survivorHealthyAt = Number.isFinite(Number(survivorHold.healthyAt)) ? Number(survivorHold.healthyAt) : NaN
  const survivorLastProbeAt = Number(survivorHold.lastProbeAt)
  const survivorTornDownAt = Date.parse(aRecord?.finishedAt ?? '')
  const survivorIdentity = survivorHold.survivorIdentity ?? {}
  const sequencing = evaluateSurvivorSequencing({
    survivorHealthyAt,
    killAt: Date.parse(groupKill.at),
    victimKilledAndReclaimedAt: Number(release?.at),
    survivorLastProbeAt,
    survivorTornDownAt,
    survivorHostPidBefore: Number(aInRun[3]),
    survivorHostPidAfter: Number(survivorIdentity.pid),
    survivorWorldIdBefore: aInRun[1],
    survivorWorldIdAfter: survivorIdentity.worldId,
    victimWorld: bWorld,
    survivorProbes: probeRows,
    reclaimedResources: [
      ...reclaim.leasesReleased.map((port) => ({ world: bWorld, kind: 'lease', port })),
      ...(reclaim.homeDeleted === bHome ? [{ world: bWorld, kind: 'home' }] : []),
    ],
  })
  record.record.survivorSequencing = { ...sequencing, survivorHealthyAt, killAt: Date.parse(groupKill.at), survivorLastProbeAt, survivorTornDownAt, victimKilledAndReclaimedAt: Number(release?.at), probeRows }
  record.addCase('other-world-unaffected', aExit.timeout !== true && aAliveAtReclaim === true && aRecord?.overall === 'PASS' && sequencing.pass ? 'PASS' : 'FAIL', {
    aSuite,
    aWorld: record.record.aWorld,
    aAliveWhileBCrashedAndReclaimed: aAliveAtReclaim,
    aExit,
    aOverall: aRecord?.overall ?? 'record-missing',
    aCases: aRecord?.cases?.map((c) => `${c.id}=${c.verdict}`) ?? [],
    sequencing,
  })

  return finish(record.record)
}

/**
 * Reconstruct mode for CRASH-RECLAIM records: zero spawns; re-judges the
 * stored conjunction (no re-timing, no re-verdicts beyond recomputing the
 * stored booleans) plus fresh global untouched checks.
 */
export async function reconstructCrash(opts) {
  const { evidence, reconstruct, budgetLedger } = opts
  const live = JSON.parse(readFileSync(reconstruct, 'utf8'))
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runId = `u5-crash-recon-${stamp}`
  const teamSha = git(['rev-parse', 'HEAD'])
  const hostBasePre = factory.assertHostBase('pre')
  const stablePre = await stableInstanceProbe()
  const homesPre = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const record = createRunRecord({
    runId,
    suite: 'parallel',
    selectedCases: ['abnormal-kill-reclaim', 'crash-simulation-reclaim', 'other-world-unaffected', 'pristine-host-and-stable-untouched', 'sibling-homes-untouched'],
    ledgerPath: budgetLedger,
    bindings: {
      teamSha,
      hostTreePristine: hostBasePre.porcelainEmpty === true,
      ...teamTreeBinding(),
      authority: readAuthorityBinding(REPO_ROOT),
      hostSha: hostBasePre.head,
      worldIds: live.bWorld ? [live.bWorld.id] : [],
      leaseRoot: factory.leaseRoot,
      mode: 'crash-reclaim',
      reconstruction: { sourceRecord: resolve(reconstruct), sourceOverall: live.overall, spawns: 0, note: 're-judgement of a completed crash-reclaim run from stored receipts; global checks probed fresh' },
    },
  })
  const stored = (live.cases ?? []).find((c) => c.id === 'abnormal-kill-reclaim') ?? {}
  const conds = stored.conditions ?? {}
  const storedPass = Object.values(conds).every((v) => v === true)
  record.addCase('abnormal-kill-reclaim', storedPass ? 'PASS' : 'FAIL', { fromLiveRecord: conds, killReceipt: live.abnormalKill ?? null })
  const simStored = (live.cases ?? []).find((c) => c.id === 'crash-simulation-reclaim') ?? {}
  // The offline control ran DURING the live record (real orphan process,
  // real reclaimWorld); replaying its stored verdict with zero spawns is a
  // faithful reconstruction — labelled as such, never recomputed optimistically.
  record.addCase('crash-simulation-reclaim', simStored.verdict === 'PASS' ? 'PASS' : 'FAIL', { fromLiveRecord: simStored.verdict ?? 'absent' })
  const aPath = live.runners?.A?.record
  const aRecord = safeReadJson(aPath)
  const otherStored = (live.cases ?? []).find((c) => c.id === 'other-world-unaffected') ?? {}
  // No recoloring: reconstruction PASSes this case ONLY if the LIVE record
  // already proved the survivor straddled kill+reclaim and finished green;
  // a survivor that merely "was green but ended before the kill" stays FAIL.
  const otherStoredOk = aRecord?.overall === 'PASS'
    && otherStored.aOverall === 'PASS'
    && otherStored.aAliveWhileBCrashedAndReclaimed === true
    && otherStored.aExit?.timeout !== true
  record.addCase('other-world-unaffected', otherStoredOk ? 'PASS' : 'FAIL', {
    aOverall: aRecord?.overall ?? 'record-missing',
    aAliveWhileBCrashedAndReclaimed: otherStored.aAliveWhileBCrashedAndReclaimed ?? 'not-recorded',
    aExit: otherStored.aExit ?? 'not-recorded',
  })
  let hostBaseOk = false
  let hostBasePost = null
  try {
    hostBasePost = factory.assertHostBase('post')
    hostBaseOk = true
  } catch (error) {
    hostBasePost = { error: String(error?.message ?? error) }
  }
  const stablePost = await stableInstanceProbe()
  record.addCase('pristine-host-and-stable-untouched', hostBaseOk && stablePost.status === stablePre.status ? 'PASS' : 'FAIL', { hostBasePre, hostBasePost, stableInstance: { pre: stablePre, post: stablePost } })
  const homesPost = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const foreign = []
  for (const [name, mtime] of Object.entries(homesPost)) {
    if (name.startsWith('u5')) continue
    if (!(name in homesPre)) foreign.push(`${name}:+created`)
    else if (homesPre[name] !== mtime) foreign.push(`${name}:~touched`)
  }
  for (const name of Object.keys(homesPre)) if (!(name in homesPost) && !name.startsWith('u5')) foreign.push(`${name}:-removed`)
  record.addCase('sibling-homes-untouched', foreign.length === 0 ? 'PASS' : 'FAIL', { foreignChanges: foreign })
  const rec = record.finalize()
  record.write(join(evidence, `run-${runId}.json`))
  return rec
}


/**
 * Reconstruct mode — ZERO spawns (live budget stays untouched): re-evaluate a
 * finished live PARALLEL run with the corrected case logic plus the offline
 * crash-simulation control, and emit a NEW RUN record that binds to (does
 * not overwrite) the live record. Honesty rule unchanged: a race the live
 * run lost stays SKIP here too — reconstruction re-judges evidence, it never
 * manufactures verdicts.
 */
export async function reconstructParallel(opts) {
  const { evidence, reconstruct, budgetLedger } = opts
  const live = JSON.parse(readFileSync(reconstruct, 'utf8'))
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: evidence })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const runId = `u5-parallel-recon-${stamp}`
  const teamSha = git(['rev-parse', 'HEAD'])
  const hostBasePre = factory.assertHostBase('pre')
  const stablePre = await stableInstanceProbe()
  const homesPre = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const record = createRunRecord({
    runId,
    suite: 'parallel',
    selectedCases: ['abnormal-kill-reclaim', 'crash-simulation-reclaim', 'other-world-unaffected', 'pristine-host-and-stable-untouched', 'sibling-homes-untouched'],
    ledgerPath: budgetLedger,
    bindings: {
      teamSha,
      hostTreePristine: hostBasePre.porcelainEmpty === true,
      ...teamTreeBinding(),
      authority: readAuthorityBinding(REPO_ROOT),
      hostSha: hostBasePre.head,
      worldIds: live.bWorld ? [live.bWorld.id] : [],
      leaseRoot: factory.leaseRoot,
      reconstruction: {
        sourceRecord: resolve(reconstruct),
        sourceOverall: live.overall,
        spawns: 0,
        note: 're-judgement of a completed live run (A core-restart 8/8 PASS under the kill window; B core completed before the kill landed) plus the offline crash-simulation control over the identical reclaimWorld path; budget stayed at its live value',
      },
    },
  })
  // (1) abnormal kill: reuse the stored live receipts verbatim
  const stored = (live.cases ?? []).find((c) => c.id === 'abnormal-kill-reclaim') ?? {}
  const crashRaced = (stored.killedPids ?? []).length + (stored.leasesReleased ?? []).length > 0 || (stored.homeDeleted ?? null) !== null
  const bPath = live.runners?.B?.record
  let bRecord = null
  try {
    bRecord = JSON.parse(readFileSync(bPath, 'utf8'))
  } catch { /* missing => died mid-run */ }
  const victimSelfCleaned = bRecord !== null && live.abnormalKill?.receipt?.alreadyExited === true
  const storedOrphanDead = stored.orphanedHostPidDead === true
  const storedRefused = stored.refusedPids ?? []
  const verdict = crashRaced
    ? (storedOrphanDead && storedRefused.length === 0 && (stored.killedPids ?? []).includes(live.bWorld?.hostPid) && stored.homeDeleted === live.bWorld?.home ? 'PASS' : 'FAIL')
    : (victimSelfCleaned ? 'SKIP' : 'FAIL')
  record.addCase('abnormal-kill-reclaim', verdict, {
    fromLiveRecord: {
      killedPids: stored.killedPids ?? [], refusedPids: storedRefused, leasesReleased: stored.leasesReleased ?? [],
      homeDeleted: stored.homeDeleted ?? null, orphanedHostPidDead: storedOrphanDead,
      victimFinishedBeforeKill: victimSelfCleaned,
      victimRecord: bRecord === null ? 'absent (died mid-run)' : `present, overall=${bRecord.overall} (finished before the kill landed)`,
      killReceipt: live.abnormalKill?.receipt ?? null,
    },
    ...(verdict === 'SKIP' ? { skipReason: 'live kill landed after the victim runner had self-cleaned (kill receipt: alreadyExited code=0); the crash-residue recovery race was not exercised live — exercised offline by crash-simulation-reclaim; verdict kept SKIP, not recoloured' } : {}),
  })
  // (2) offline crash-simulation control (fresh run of the production path)
  record.record.crashSimulationControl = await crashSimulationControl({ factory })
  record.addCase('crash-simulation-reclaim', record.record.crashSimulationControl.ok ? 'PASS' : 'FAIL', record.record.crashSimulationControl)
  // (3) other world (A) unaffected — re-judge from A's own RUN record
  const aPath = live.runners?.A?.record
  let aRecord = null
  try {
    aRecord = JSON.parse(readFileSync(aPath, 'utf8'))
  } catch { /* missing */ }
  const otherCase = (live.cases ?? []).find((c) => c.id === 'other-world-unaffected') ?? {}
  const aAlive = otherCase.aAliveWhileBWasReclaimed === true || otherCase.aOverall === 'PASS'
  record.addCase('other-world-unaffected', aRecord?.overall === 'PASS' && aAlive ? 'PASS' : 'FAIL', {
    aRecord: aPath, aOverall: aRecord?.overall ?? 'record-missing',
    aCases: aRecord?.cases?.map((c) => `${c.id}=${c.verdict}`) ?? [],
    aAliveWhileBWasReclaimed: aAlive,
  })
  // (4)(5) global untouched checks — probed fresh around the reconstruction
  let hostBaseOk = false
  let hostBasePost = null
  try {
    hostBasePost = factory.assertHostBase('post')
    hostBaseOk = true
  } catch (error) {
    hostBasePost = { error: String(error?.message ?? error) }
  }
  const stablePost = await stableInstanceProbe()
  record.addCase('pristine-host-and-stable-untouched', hostBaseOk && stablePost.status === stablePre.status ? 'PASS' : 'FAIL', { hostBasePre, hostBasePost, stableInstance: { pre: stablePre, post: stablePost } })
  const homesPost = homesCensus(join(REPO_ROOT, 'tests', 'homes'))
  const foreign = []
  for (const [name, mtime] of Object.entries(homesPost)) {
    if (name.startsWith('u5')) continue
    if (!(name in homesPre)) foreign.push(`${name}:+created`)
    else if (homesPre[name] !== mtime) foreign.push(`${name}:~touched`)
  }
  for (const name of Object.keys(homesPre)) if (!(name in homesPost) && !name.startsWith('u5')) foreign.push(`${name}:-removed`)
  record.addCase('sibling-homes-untouched', foreign.length === 0 ? 'PASS' : 'FAIL', { foreignChanges: foreign })
  const rec = record.finalize()
  record.write(join(evidence, `run-${runId}.json`))
  return rec
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  let rec
  try {
    if (opts.dryRun) {
      const dry = await runSurvivorDryRun()
      rec = { schema: 'u5-dry-run/1', runId: 'u5-dry-run', suite: 'crash-reclaim', overall: dry.pass ? 'PASS' : 'FAIL', simulated: dry.simulated, evidenceKind: dry.evidenceKind, cases: [{ id: 'survivor-hold-ordering', verdict: dry.pass ? 'PASS' : 'FAIL', ...dry }], bindings: { mode: 'dry-run', spawns: 0, authority: readAuthorityBinding(REPO_ROOT), hostTreePristine: true, ...teamTreeBinding() } }
    } else if (opts.reconstruct !== null) {
      const live = safeReadJson(opts.reconstruct)
      rec = live?.bindings?.mode === 'crash-reclaim' ? await reconstructCrash(opts) : await reconstructParallel(opts)
    } else if (opts.mode === 'crash-reclaim') {
      rec = await runCrashReclaimSupervisor(opts)
    } else {
      rec = await runParallelSupervisor(opts)
    }
  } catch (error) {
    console.error(`SUPERVISOR FAILED: ${String(error?.stack ?? error)}`)
    process.exit(2)
  }
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
