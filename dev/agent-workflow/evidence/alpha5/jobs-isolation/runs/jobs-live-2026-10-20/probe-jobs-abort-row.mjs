#!/usr/bin/env node
/**
 * probe-jobs-abort-row.mjs — the #349 merge-release LIVE face for the FOUR
 * jobs abort boundaries at head 515b3805 (reviewer batch 2026-10-20).
 *
 * WHAT IS REAL HERE: this row mounts inside the booted production world and
 * drives the COMMITTED-DIST bridge (`createGovernedJobsBridge`, byte-identical
 * to src per the #338 dist-mirror law) over the COMMITTED-DIST live assembly
 * (`createLiveJobsGatewayAssembly`) against the HOST'S OWN jobs registry
 * (`ctx.get('jobs')` = the real LocalJobRegistry @639ed01539 — the same object
 * the production bridge resolves through `deps.jobs`). Jobs are REAL: each is
 * registered through the registry's public `start()` and its producer spawns
 * a REAL bash process; kill/reap ride the real `kill()` cancel hook.
 *
 * WHAT IS PROBE-LOCAL (disclosed, not hidden): the assembly is a FRESH
 * instance over a probe-local MemberInstance row store (the viewer pair the
 * probe itself declares); no in-world Team attribution record is created for
 * the probe jobs, so every leg crosses the Team fence through the DISCLOSED
 * `corded:false` pass-through (zero records — the round-B law). The four legs
 * are about the bridge↔svc abort contract; the owner-fence arms are unit-pinned
 * elsewhere and are NOT claimed by this kit.
 *
 * The recorder wraps the REAL service by delegation (counts + per-leg hostile
 * wrappers), never mutates it. Process-level unhandledRejection/uncaughtException
 * collectors go in at mount; every leg asserts ZERO hits over its own window
 * and the run asserts zero over the whole batch (collector-only: a hit makes
 * the batch RED, it does not crash the host).
 *
 * Legs (each = one parent-order boundary):
 *  L1  entry precheck early-exit      — pre-aborted signal: ZERO svc.wait,
 *       ZERO svc.read (drain ledger = full per-leg svc call snapshot).
 *  L2  construction-phase SYNC abort  — abort fires inside the svc.wait call
 *       (hostile wrapper over the REAL svc.wait): typed wait-aborted, both
 *       promises pre-consumed (the REAL rejections prove the .catch no-ops),
 *       abort listener removed on the early return (listenerCount 0).
 *  L3  abort while wait hangs         — real sleep-40 job, abort at +300 ms:
 *       typed wait-aborted, svc.read stays ZERO; L3b = abort landing exactly
 *       as the REAL wait resolves (wrapper aborts in the resolve continuation
 *       — either racing arm wins, the read-before re-check law must hold:
 *       read stays ZERO); L3c positive control: un-aborted wait→read returns
 *       the job's own token bytes.
 *  L4  no-wait arm, same law          — pre-aborted no-wait call: svc.read
 *       ZERO, typed wait-aborted (the entry precheck is arm-independent; the
 *       RECORDED annotation stands: this is INTENTIONALLY STRONGER than the
 *       native host no-wait path — the native read is synchronous and has no
 *       await point; the plane's precheck is a disclosed strengthening).
 *       L4b positive control: un-aborted no-wait read returns the bytes.
 *
 * Mounted ONLY through the public profile-patch seam (the batch's patch file).
 * Config via env: DSH_A5JOBS_WORKTREE (committed-dist root),
 * DSH_A5JOBS_RESULT_DIR (host-side copy of the receipt), DSH_A5JOBS_HEAD.
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5jobs-jobs-abort-probe'
export const inject = ['jobs', 'webServer']

const CALLER = 'a5jobs-abort-caller'

export async function apply(ctx) {
  const unhandled = []
  const uncaught = []
  process.on('unhandledRejection', (reason) => {
    unhandled.push({ at: Date.now(), reason: String(reason?.message ?? reason) })
  })
  process.on('uncaughtException', (err) => {
    // collector-only on purpose: the batch grades a hit RED without crashing
    // the world mid-run (the hit is recorded with its message verbatim).
    uncaught.push({ at: Date.now(), error: String(err?.message ?? err) })
  })
  let lastReceipt = null
  const webServer = ctx.get('webServer')
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__a5jobs-abort/health',
    handler: (_req, res) => {
      let jobsPresent = false
      try { jobsPresent = ctx.get('jobs') !== null && ctx.get('jobs') !== undefined } catch { /* honest false */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, jobsPresent, node: process.version, pid: process.pid }))
    },
  }, 'a5jobs abort probe health route'))
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__a5jobs-abort/run',
    handler: async (_req, res) => {
      try {
        lastReceipt = await runLegs(ctx, unhandled, uncaught)
      } catch (error) {
        lastReceipt = { ok: false, fatal: String(error?.stack ?? error), legs: [], collector: { unhandled, uncaught } }
      }
      try {
        const dir = process.env.DSH_A5JOBS_RESULT_DIR
        if (typeof dir === 'string' && dir !== '') {
          mkdirSync(dir, { recursive: true })
          writeFileSync(join(dir, 'receipt-hostcopy.json'), JSON.stringify(lastReceipt, null, 2))
        }
      } catch { /* the HTTP body is the authoritative transport */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(lastReceipt))
    },
  }, 'a5jobs abort probe run route'))
}

async function runLegs(ctx, unhandled, uncaught) {
  const worktree = process.env.DSH_A5JOBS_WORKTREE
  if (typeof worktree !== 'string' || worktree === '') throw new Error('DSH_A5JOBS_WORKTREE is required')
  const distLive = join(worktree, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live')
  const { createGovernedJobsBridge } = await import(pathToFileURL(join(distLive, 'plane-effect-backends.mjs')).href)
  const { createLiveJobsGatewayAssembly, jobsBridgeScopeKey } = await import(pathToFileURL(join(distLive, 'jobs-gateway-assembly.mjs')).href)

  const svc = ctx.get('jobs')
  if (svc === null || svc === undefined) throw new Error('the host jobs registry service is absent')
  let controllerAttached = false
  try {
    svc.attachController('a5jobs-abort-probe')
    controllerAttached = true
  } catch { /* servesOwner may already be satisfied by the world's tool rows */ }

  const ROOT = 'a5jobs-abort-probe-root'
  const VIEWER = { rootSessionId: ROOT, instanceId: 'a5jobs-abort-probe-inst' }
  // RULING-X consumer law (96e199b9): the probe consumes the lane's ONE
  // derivation through the row re-export (the same edge the production entry
  // rides) - the kit's 515b-era raw literal migrated in this one line.
  const scopeKey = jobsBridgeScopeKey({ realmId: 'a5jobs-abort-probe-realm', rootSessionId: ROOT, instanceId: VIEWER.instanceId })
  // PROBE-LOCAL identity rows (disclosed): the viewer pair this batch declares.
  const teamRoot = { repositories: { memberInstances: { list: (k) => (k === ROOT ? [{ instanceId: VIEWER.instanceId }] : []) } } }
  const asm = createLiveJobsGatewayAssembly({ teamRoot, rootSessionId: ROOT })
  const plane = { placementFeed: (n) => ({ definitionIdentity: `a5jobs-abort-${String(n)}@probe-v1` }) }

  const counts = { wait: 0, read: 0, kill: 0, list: 0, start: 0 }
  let waitOverride = null
  const svcR = {
    start: (spec) => { counts.start += 1; return svc.start(spec) },
    wait: (...a) => { counts.wait += 1; return waitOverride !== null ? waitOverride(svc, a) : svc.wait(...a) },
    read: (...a) => { counts.read += 1; return svc.read(...a) },
    kill: (...a) => { counts.kill += 1; return svc.kill(...a) },
    list: (...a) => { counts.list += 1; return svc.list(...a) },
  }
  const bridge = createGovernedJobsBridge({
    scopeKey,
    viewer: VIEWER,
    gatewayRow: () => asm,
    planeRow: () => plane,
    jobsService: () => svcR,
  })

  const spawned = []
  const createdJobs = []
  const STAMP = process.env.DSH_A5JOBS_STAMP ?? 'nosstamp'
  const tok = (n) => `A5ABORT_${STAMP.replace(/[^A-Za-z0-9]/g, '')}_TOK${n}`
  function realJob(label, script) {
    const id = svcR.start({
      kind: 'a5abort',
      label,
      run: (handle) => {
        const child = spawn('bash', ['-c', `echo A5ABORT_SPAWNMARK_${STAMP.replace(/[^A-Za-z0-9]/g, '')} ${label}; ${script}`], { stdio: ['ignore', 'pipe', 'pipe'] })
        spawned.push(child)
        child.stdout.on('data', (d) => { handle.append(String(d)) })
        child.stderr.on('data', (d) => { handle.append(String(d)) })
        const done = new Promise((res) => child.on('exit', (code, sig) => {
          res(sig !== null ? { status: 'killed', detail: `signal ${sig}` } : code === 0 ? { status: 'completed' } : { status: 'failed', detail: `exit ${code}` })
        }))
        return { done, cancel: () => { try { child.kill('SIGKILL') } catch { /* gone */ } } }
      },
    })
    createdJobs.push(id)
    return id
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const legs = []
  function snap() { return { ...counts, unhandled: unhandled.length, uncaught: uncaught.length } }
  // Listener-IDENTITY tracking (stronger than a count, and portable where
  // AbortSignal has no listenerCount): shadow the two methods on THIS signal
  // instance only (no class mutation), recording every abort listener added
  // and removed. The BRIDGE's listener is the first one added (it goes in
  // before svc.wait is called — the ROOT-close(1) shape), so "the bridge's
  // listener came back off" is asserted by NAME, not by arithmetic.
  function trackListeners(ac) {
    const sig = ac.signal
    const additions = []
    const removals = []
    const origAdd = EventTarget.prototype.addEventListener.bind(sig)
    const origRemove = EventTarget.prototype.removeEventListener.bind(sig)
    sig.addEventListener = (type, fn, opts) => { if (type === 'abort') additions.push(fn); return origAdd(type, fn, opts) }
    sig.removeEventListener = (type, fn, opts) => { if (type === 'abort') removals.push(fn); return origRemove(type, fn, opts) }
    return {
      signal: sig,
      bridgeListenerRemoved: () => additions.length > 0 && removals.includes(additions[0]),
      listenerNeverAdded: () => additions.length === 0,
    }
  }
  // Each leg declares its OWN complete check set (a builder over the observed
  // text and the per-leg call delta): positive-control legs assert bytes,
  // refusal legs assert the typed wait-aborted word — never one shape for all.
  function record(id, boundary, before, ret, buildChecks) {
    const after = snap()
    const d = { wait: after.wait - before.wait, read: after.read - before.read, kill: after.kill - before.kill, list: after.list - before.list }
    const text = String(ret?.text ?? '')
    const checks = buildChecks(text, d)
    const ok = Object.values(checks).every((v) => v === true)
    legs.push({ id, boundary, countsDelta: d, ledgerSnapshot: { before, after }, text: text.slice(0, 300), checks, ok })
    return { d, text, ok }
  }
  const typed = (text) => text.startsWith('refused: wait-aborted')

  // ── L1 entry precheck early-exit ──────────────────────────────────────────
  {
    const ac = new AbortController()
    ac.abort(new Error('entry-pre-abort'))
    const t1 = trackListeners(ac)
    const before = snap()
    const ret = await bridge.jobOutput({ job_id: 'a5abort-nonexistent', wait: true, timeout_ms: 5_000 }, CALLER, t1.signal)
    record('L1', 'entry-precheck-early-exit', before, ret, (text, d) => ({
      typedWaitAborted: typed(text),
      zeroWait: d.wait === 0,
      zeroRead: d.read === 0,
      zeroHostCallsAll: d.kill === 0 && d.list === 0,
      listenerNeverAdded: t1.listenerNeverAdded(),
      collectorZeroDelta: snap().unhandled === before.unhandled && snap().uncaught === before.uncaught,
    }))
  }

  // ── L2 construction-phase synchronous abort (hostile over the REAL svc) ──
  {
    const jobId = realJob('L2-never-sleep-past-abort', 'sleep 30; echo never')
    await sleep(150) // the real process is up; the job is running
    const ac = new AbortController()
    const before = snap()
    const t2 = trackListeners(ac)
    waitOverride = (real, args) => {
      // abort fires INSIDE the svc.wait call, before the real wait body runs
      ac.abort(new Error('sync-during-call'))
      return real.wait(...args)
    }
    let ret
    try { ret = await bridge.jobOutput({ job_id: jobId, wait: true, timeout_ms: 20_000 }, CALLER, t2.signal) } finally { waitOverride = null }
    record('L2', 'construction-sync-abort', before, ret, (text, d) => ({
      typedWaitAborted: typed(text),
      svcWaitActuallyCalled: d.wait === 1,
      zeroRead: d.read === 0,
      bridgeListenerRemovedOnEarlyReturn: t2.bridgeListenerRemoved(),
      preConsumedRealRejections: snap().unhandled === before.unhandled,
    }))
  }

  // ── L3 abort while wait hangs (+ L3b settle-edge re-check, L3c positive) ──
  let settledJobId = null
  const tok3 = tok(3)
  {
    const jobId = realJob('L3-hang', 'sleep 40; echo never-3')
    await sleep(200)
    const ac = new AbortController()
    const before = snap()
    const t3 = trackListeners(ac)
    const timer = setTimeout(() => { ac.abort(new Error('mid-wait-cancel-3')) }, 300)
    const ret = await bridge.jobOutput({ job_id: jobId, wait: true, timeout_ms: 25_000 }, CALLER, t3.signal)
    clearTimeout(timer)
    record('L3', 'abort-mid-wait', before, ret, (text, d) => ({
      typedWaitAborted: typed(text),
      svcWaitCalled: d.wait === 1,
      zeroRead: d.read === 0,
      bridgeListenerRemovedOnRaceExit: t3.bridgeListenerRemoved(),
      collectorZeroDelta: snap().unhandled === before.unhandled,
    }))
    try { svc.kill(jobId, CALLER, 'L3 reap') } catch { /* honest leak check happens in reapAll */ }
  }
  {
    // L3b: abort lands exactly as the REAL wait resolves (wrapper aborts in
    // the resolve continuation); whichever racing arm wins, read-before holds.
    const jobId = realJob('L3b-settle-edge', `sleep 0.4; echo ${tok(31)}`)
    await sleep(1200) // let the real job settle; wait resolves immediately
    const ac = new AbortController()
    const before = snap()
    waitOverride = (real, args) => real.wait(...args).then((v) => { ac.abort(new Error('settle-edge')); return v })
    let ret
    try { ret = await bridge.jobOutput({ job_id: jobId, wait: true, timeout_ms: 20_000 }, CALLER, ac.signal) } finally { waitOverride = null }
    record('L3b', 'abort-at-wait-settled-read-before', before, ret, (text, d) => ({
      typedWaitAborted: typed(text),
      svcWaitCalled: d.wait === 1,
      zeroRead: d.read === 0,
      collectorZeroDelta: snap().unhandled === before.unhandled,
    }))
  }
  {
    // L3c positive control: un-aborted wait→read returns the job's bytes.
    const jobId = realJob('L3c-positive', `sleep 0.5; echo ${tok3}`)
    await sleep(1300)
    const ac = new AbortController()
    const before = snap()
    const ret = await bridge.jobOutput({ job_id: jobId, wait: true, timeout_ms: 10_000 }, CALLER, ac.signal)
    settledJobId = jobId
    record('L3c', 'positive-control-wait-read', before, ret, (text, d) => ({
      notRefused: !text.startsWith('refused:'),
      svcWaitCalled: d.wait === 1,
      readHappened: d.read === 1,
      bytesObserved: text.includes(tok3),
    }))
  }

  // ── L4 no-wait arm, same law (+ L4b positive) ────────────────────────────
  {
    const ac = new AbortController()
    ac.abort(new Error('pre-abort-no-wait'))
    const t4 = trackListeners(ac)
    const before = snap()
    const ret = await bridge.jobOutput({ job_id: settledJobId ?? 'a5abort-nonexistent' }, CALLER, t4.signal)
    record('L4', 'no-wait-arm-preabort', before, ret, (text, d) => ({
      typedWaitAborted: typed(text),
      zeroWait: d.wait === 0,
      zeroRead: d.read === 0,
      listenerNeverAdded: t4.listenerNeverAdded(),
    }))
  }
  {
    // Fresh UNREAD settled job: the host read is cursor-once-only (the first
    // delivery of a job's bytes advances the model cursor; a second read of
    // the SAME job legitimately answers "(no new output)" — that is the host
    // once-only law, NOT a bridge defect). The no-wait positive needs its own
    // bytes, exactly like the unit-face positive does.
    const tok4 = tok(4)
    const jobId = realJob('L4b-positive', `sleep 0.4; echo ${tok4}`)
    await sleep(1300)
    const before = snap()
    const ret = await bridge.jobOutput({ job_id: jobId }, CALLER, undefined)
    record('L4b', 'no-wait-positive-read', before, ret, (text, d) => ({
      notRefused: !text.startsWith('refused:'),
      zeroWait: d.wait === 0,
      readHappened: d.read === 1,
      bytesObserved: text.includes(tok4),
    }))
  }

  // ── OBSERVATION-ONLY (root round-D finding, cited not asserted):
  // whole-feed disappearance (plane.placementFeed missing ENTIRELY) takes
  // ensureDefinitions' early return (plane-effect-backends.mjs:960) BEFORE
  // the withdrawal-invalidate loop - the registered map and the store rows
  // survive. This leg OBSERVES that residual (no assertion of correctness,
  // no fix attempted): after the whole feed vanishes, does a fresh admit
  // still pin through the stale truth? Recorded verbatim into the receipt.
  let wholeFeedObservation = null
  try {
    const feed = plane.placementFeed
    await bridge.jobList(CALLER) // baseline: pins alive through the real feed
    const probeJobId = 'a5abort-observe-wholefeed'
    delete plane.placementFeed
    await bridge.jobList(CALLER) // ensureDefinitions now early-returns
    const took = asm.attributeBackgroundJob({ hostJobId: probeJobId, owner: VIEWER, scopeKey })
    wholeFeedObservation = {
      finding: 'whole-feed disappearance vs per-entry withdrawal - root-classed: WITHDRAWAL-CLAIM INCOMPLETENESS / future-producer HARDENING, NOT a live exploit (a5PlaneValue assigns once at agent-bindings:2487, never nulled at teardown; production reachability UNPROVEN)',
      cite: 'plane-effect-backends.mjs:960 early return precedes the :966-:975 invalidate loop',
      attributedAfterWholeFeedGone: took.ok === true,
      stalePinnedIdentity: took && took.ok === true ? (took.job?.pinnedIdentity ?? null) : null,
      interpretation: took.ok === true
        ? 'withdrawal claim incomplete: in this synthetic whole-feed-gone shape a fresh admit still rides the pre-disappearance pin (pin/admission assertion ONLY - explicitly NOT a C-BIND cancellation proof)'
        : 'fail-closed observed: the whole-feed-disappeared path refused the fresh admit',
      observationOnly: true, asserted: false,
    }
    plane.placementFeed = feed // restore (observation must not perturb teardown)
  } catch (error) {
    wholeFeedObservation = { error: String(error?.message ?? error), observationOnly: true, asserted: false }
  }

  // ── reap: kill every live job through the REAL svc, SIGKILL stragglers ───
  const reap = []
  for (const jobId of createdJobs) {
    try { reap.push(String(svc.kill(jobId, CALLER, 'a5jobs live batch reap'))) } catch (error) { reap.push(`already-gone (${String(error?.message ?? error).slice(0, 80)})`) }
  }
  for (const child of spawned) { try { child.kill('SIGKILL') } catch { /* gone */ } }
  await sleep(400)
  const aliveAfter = spawned.filter((c) => c.exitCode === null && c.signalCode === null).length

  const legsOk = legs.every((l) => l.ok === true)
  return {
    ok: legsOk && unhandled.length === 0 && uncaught.length === 0,
    head: process.env.DSH_A5JOBS_HEAD ?? null,
    world: { pid: process.pid, home: process.env.DSH_HOME ?? null, node: process.version },
    observationWholeFeed: wholeFeedObservation,
    assembly: { realBridge: 'committed-dist plane-effect-backends.mjs', realAssembly: 'committed-dist jobs-gateway-assembly.mjs', realSvc: 'ctx.get(jobs) @639ed01539', controllerAttached, probeLocal: 'fresh assembly over probe-local identity rows; every leg crosses via disclosed corded:false pass-through (zero Team records)' },
    calls: counts,
    legs,
    collector: { unhandled, uncaught },
    reap,
    aliveAfter,
  }
}
