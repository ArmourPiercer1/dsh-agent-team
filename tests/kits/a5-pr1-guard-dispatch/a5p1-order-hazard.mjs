#!/usr/bin/env node
/**
 * a5p1-order-hazard.mjs — Alpha.5 PR1 NEG-1 leg: the teardown-ORDER hazard,
 * measured on the pinned 0.2.0-rc.2 Host registry, with and without the PR1
 * ordered teardown in the loop.
 *
 * WHY THIS LEG EXISTS. The PoC measured, against the real pinned registry
 * (`dev/agent-workflow/evidence/alpha5-adapter-p0/01-routing/p01-runner.mjs`,
 * result `p01-result.json`), that a call which has not yet reached its Body
 * re-resolves its Definition AT DISPATCH TIME. The disposer order therefore
 * decides behaviour all by itself:
 *
 *   L3-hazard  lift `restrict` FIRST, then drop the adapter -> NATIVE body ran (count 1)
 *   L3-safe    keep `restrict`, drop the adapter only        -> native count 0
 *
 * That pair is why design §4.1 refuses to treat the mask as a teardown
 * resource: whoever lifts it first wins, and the loser is a native body. This
 * leg re-runs both arms UNCHANGED as the PROTECTION CONTROLS — if they stop
 * reproducing, the harness has gone blind and the PR1 arm proves nothing — and
 * then adds the PR1 arms, where the mask is owned by the Scoped Dispatcher's
 * `disposeOrdered` (refuse new calls → drain on the SELF count → tombstone →
 * release → lift).
 *
 * TWO PR1 ARMS, because "in flight" has two halves:
 *   pr1-parked  the call is parked at the pre-execute fence, i.e. admitted and
 *               counted but NOT inside a Body yet. Cancelling it there is the
 *               clean outcome: it is refused, nothing runs, nothing resolved
 *               to native.
 *   pr1-body    the call is INSIDE the Team Body. The teardown must WAIT for
 *               the self-count, keep the mask while it waits, and only then
 *               finish. The Body completes; the native body never appears.
 *
 * THE COUNTERS ARE THE EVIDENCE (plan §1.2: return text alone is not a safety
 * proof): every body invocation appends an observation, and the criteria read
 * the counters — never the prose.
 *
 * MECHANISM NOTE: the registry fixture is the PoC's
 * `00-baseline/p00-fixture.mjs`, which mounts ToolRuntime from the PREBUILT
 * public libs of `tests/deepseek-harness-test-use` (never modified, never
 * patched — docs/TEST_METHODS.md §3) through the established junction
 * pattern. Importing it is a pointer to that proven harness, not a copy.
 *
 * Usage: node a5p1-order-hazard.mjs [--out <file.json>]
 * EXIT: 0 = all criteria pass, 2 = a criterion failed, 1 = fatal.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(KIT_ROOT())
const FIXTURE_URL = pathToFileURL(
  join(REPO_ROOT, 'dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline/p00-fixture.mjs'),
).href
const LANE_URL = pathToFileURL(join(REPO_ROOT, 'packages/runtime/dist/packages/runtime/tool-dispatch/index.js')).href

function KIT_ROOT() {
  // tests/kits/a5-pr1-guard-dispatch -> repo root
  return join(HERE, '..', '..', '..')
}

const OUT_ARG = (() => {
  const i = process.argv.indexOf('--out')
  return i === -1 ? null : resolve(process.argv[i + 1])
})()

const criteria = []
function check(id, name, ok, detail) {
  criteria.push({ id, name, ok: ok === true, detail: String(detail ?? '').slice(0, 500) })
  console.log(`${ok === true ? 'PASS' : 'FAIL'} ${id}: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 300)}`}`)
}

function makeGate() {
  let release = null
  const promise = new Promise((r) => { release = () => r() })
  return { promise, release: () => release() }
}

async function main() {
  const { makeFixture, countingTool } = await import(FIXTURE_URL)
  const { installScopedToolGuard } = await import(LANE_URL)

  /**
   * One arm on a fresh registry (counters are never shared between arms).
   * @param {'hazard' | 'safe' | 'pr1-parked' | 'pr1-body'} order
   */
  async function arm(order) {
    const f = await makeFixture()
    const native = countingTool(f.obs, 'grep', 'NATIVE.grep')
    f.ctx.tools.register(native)
    const A = await f.mintScope('A')
    const inner = A.scope.ctx
    if (typeof inner.tools.schemas !== 'function') throw new Error('pinned registry exposes no tools.schemas(scope)')

    const bodyGate = order === 'pr1-body' ? makeGate() : null
    // Every field here is measured against `bodyReturned` (below), never against
    // a marker in the kit's own control flow: what the arm needs to know is
    // WHERE each result-side edge sits relative to the Body's own return.
    const edgeOrder = {
      postExecutedFired: false,
      postExecutedAfterBodyReturn: null,
      postExecutedWhileBodyParked: null,
      released: false,
    }
    // `bodyReturned` is the fact every R4 measurement turns on: WHEN did the
    // Body actually return, as seen from the Body itself. The wrapper sits
    // outside the fixture's gate so it flips only after the parked Body's own
    // `return` — not when it wakes up.
    let bodyReturned = false
    const adapter = countingTool(f.obs, 'grep', 'ADAPTER.grep', {})
    // THE PARK IS OWNED BY THE WRAPPER, NOT BY THE FIXTURE'S `opts.gate`.
    // Measured while re-casting this arm for R4: the fixture's gate did NOT keep
    // the Body open (the obs tail at the park point read
    // `wrapper-enter -> body -> wrapper-return`), so the old `pr1-body` arm let
    // the call COMPLETE before its teardown, and its "seam limit" observation
    // was vacuous. The wrapper below parks the Body before its own `return`,
    // which is the only shape that can measure "a result edge while the Body is
    // still alive" at all. The fixture's counting Body still runs inside it.
    let wrapperCalls = 0
    if (bodyGate !== null) {
      const innerExecute = adapter.execute
      adapter.execute = async (args, exec) => {
        wrapperCalls += 1
        f.obs.push({ event: 'wrapper-enter', name: 'grep', identity: 'ADAPTER.grep' })
        const out = await innerExecute(args, exec)
        await bodyGate.promise
        bodyReturned = true
        f.obs.push({ event: 'wrapper-return', name: 'grep', identity: 'ADAPTER.grep' })
        return out
      }
    }
    const lift = inner.tools.restrict({ deny: ['grep'] })
    const disposeAdapter = inner.tools.register(adapter)

    let maskLifts = 0
    let handle = null
    if (order.startsWith('pr1')) {
      // The assembly's trusted native list, read the way production reads it:
      // the Host's GLOBAL view (no scope). `grep` is registered globally by the
      // fixture, so it is native-eligible; the Agent-scoped adapter that shadows
      // it under the same name is NOT, and the definition this arm pins is the
      // one the scope actually resolves (the shadowing adapter) — which is what
      // makes the body swap in the R2 family visible at all.
      let nativeNames = []
      try {
        const globalSchemas = inner.tools.schemas()
        if (Array.isArray(globalSchemas)) {
          nativeNames = globalSchemas.map((row) => row?.name).filter((n) => typeof n === 'string' && n.length > 0)
        }
      } catch {
        nativeNames = []
      }
      const outcome = installScopedToolGuard({
        agentCtx: inner,
        runtimeAgent: A.key,
        agentScopeKey: 'A',
        trustedIdentities: ['A'],
        nativeNames,
        maskedNames: ['grep'],
        maskPort: { lift: () => { maskLifts += 1; lift() } },
      })
      if (!outcome.ok) throw new Error(`installScopedToolGuard refused: ${outcome.error.code} ${outcome.error.message}`)
      handle = outcome.value
      const published = handle.publish()
      if (!published.ok) throw new Error(`publish refused: ${published.error.code} ${published.error.message}`)
    }
    const resolutionBefore = f.resolution('grep', A.key)

    // Park the call at the pre-execute fence: the dispatch that follows the
    // park is where the Definition is re-resolved — the NEG-1 window.
    const fence = order === 'pr1-parked' ? makeGate() : null
    let reachedFence = false
    if (fence !== null) {
      let armed = true
      inner.on('tools/pre-execute', (exec, next) => {
        if (exec.name === 'grep' && armed) {
          armed = false
          reachedFence = true
          return fence.promise.then(() => next())
        }
        return next()
      })
    }

    // What the two result-side edges say, against the Body's own marker:
    // `post-execute` may fire while the Body is still parked (the seam limit
    // the PR1 Gate R4 fix exists for); `tools/result` must not.
    const settledProbe = { fired: false, bodyReturnedAtSettled: null, inFlightAtSettled: null }
    inner.on('tools/result', (exec) => {
      if (order !== 'pr1-body') return
      settledProbe.fired = true
      settledProbe.bodyReturnedAtSettled = bodyReturned
      settledProbe.inFlightAtSettled = handle === null ? null : handle.dispatcher.inFlight()
    })
    if (order === 'pr1-body') {
      inner.on('tools/post-execute', (exec, result, next) => {
        if (edgeOrder.postExecutedFired === false) {
          edgeOrder.postExecutedFired = true
          edgeOrder.postExecutedAfterBodyReturn = bodyReturned
          edgeOrder.postExecutedWhileBodyParked = bodyReturned === false
        }
        return next()
      })
    }
    let parkProbe = null
    const inflight = f.run('grep', A.key)
    // DETERMINISTIC PARK, never a sleep lottery: wait until the call has
    // actually reached the point the arm is about to tear down around — the
    // fence for `pr1-parked`, the Team Body for `pr1-body`. An arm that never
    // reached its park point is invalid, not green.
    const tick = () => new Promise((r) => setTimeout(r, 5))
    const deadline = Date.now() + 20_000
    if (order === 'pr1-body') {
      while (f.counters('ADAPTER.grep') === 0) {
        if (Date.now() >= deadline) throw new Error('pr1-body: the Team Body never started')
        await tick()
      }
      parkProbe = {
        bodyReturnedAlready: bodyReturned,
        wrapperCalls,
        inFlight: handle === null ? null : handle.dispatcher.inFlight(),
        counters: f.counters('ADAPTER.grep'),
        obsTail: f.obs.slice(-6).map((o) => o.event ?? String(o.action ?? '')),
      }
    } else if (order === 'pr1-parked') {
      while (!reachedFence) {
        if (Date.now() >= deadline) throw new Error('pr1-parked: the call never reached the pre-execute fence')
        await tick()
      }
      // The self-count is taken at THIS door (the outermost one), so a call
      // parked here is outstanding and the drain below cannot reach RELEASED.
    }

    let teardown = null
    let leaseProbe = null
    let refusedWhileDraining = null
    // SEAM MEASUREMENT: does the result edge (`tools/post-execute`) fire while
    // the Team Body is still parked? If it does, no public seam can give a
    // Body-spanning lease on this host version — which is exactly what the
    // NEG1-SEAM criterion below records instead of pretending away.
    if (order === 'hazard') {
      // THE PROTECTION CONTROL (the PoC's L3-hazard, no PR1 in the loop):
      // the ordinary disposer order. If this stops reproducing, the harness
      // cannot see the hazard and the other arms prove nothing.
      lift()
      maskLifts += 1
      disposeAdapter()
    } else if (order === 'safe') {
      // THE REVERSE ORDER (the PoC's L3-safe): adapter out, mask kept.
      disposeAdapter()
    } else {
      // PR1: the ordered teardown runs WHILE the call is still outstanding.
      handle.dispatcher.noteHostDisposeReturned()
      // Captured BEFORE the teardown call, because the ordering claim is about
      // what the Dispatcher's own counter said at that instant.
      leaseProbe = {
        bodyReturnedAlready: bodyReturned,
        inFlight: handle.dispatcher.inFlight(),
        outstanding: handle.dispatcher.outstandingCallIds(),
        stateBefore: handle.dispatcher.state(),
      }
      teardown = handle.disposeOrdered()
      refusedWhileDraining = handle.dispatcher.guard({ name: 'grep', agentIdentity: 'A' })
      // The fence arm MUST be held by the lease: the parked call took it at
      // the outer door, so the drain cannot reach RELEASED and the mask stays
      // down. (The body arm is the measured seam limit — see NEG1-SEAM.)
      if (order === 'pr1-parked' && (maskLifts !== 0 || teardown.ok)) {
        throw new Error(`the mask lifted while a call stood between its outer door and its result (arm=${order} state=${handle.dispatcher.state()} inFlight=${String(handle.dispatcher.inFlight())} teardownOk=${String(teardown.ok)})`)
      }
    }

    edgeOrder.released = true
    const nativeBeforeRelease = f.counters('NATIVE.grep')
    fence?.release()
    bodyGate?.release()
    const res = await inflight
    let secondTeardown = null
    if (order === 'pr1-parked') {
      // The fence arm's call was REFUSED, so its lease ended at the refusal:
      // once the parked call is out of the way the drain must finish and the
      // mask must lift exactly once. That is the property that keeps this arm
      // honest — a teardown that never completes would make the mask claim
      // trivially true.
      secondTeardown = handle.disposeOrdered()
      if (!secondTeardown.ok) throw new Error(`the ordered teardown must finish once the count is zero: ${secondTeardown.error?.message ?? ''} | OBS=${JSON.stringify(handle.observations().slice(-10).map((o) => o.event))} | OUT=${JSON.stringify(handle.dispatcher.outstandingCallIds())}`)
    } else if (order === 'pr1-body') {
      // PR1 Gate R4: the Body returned AFTER the drain began, and its settled
      // callback crossed that boundary. It is refused as termination evidence,
      // so the half-state stands: still TOMBSTONED, still masked, still armed.
      secondTeardown = handle.disposeOrdered()
    }

    return {
      order,
      resolutionBefore,
      native: f.counters('NATIVE.grep'),
      adapter: f.counters('ADAPTER.grep'),
      nativeBeforeRelease,
      maskLifts,
      edgeOrder,
      inFlightAtTeardown: teardown === null ? null : teardown.ok,
      parkProbe,
      leaseProbe,
      settledProbe,
      bodyReturned,
      secondTeardownCode: secondTeardown === null ? null : (secondTeardown.ok ? 'OK' : secondTeardown.error.code),
      lateSettledObserved: handle === null ? null : handle.observations().some((o) => String(o.event) === 'dispatcher-late-settled-after-teardown'),
      finalState: handle === null ? null : handle.dispatcher.state(),
      teardownRefusalCode: teardown !== null && !teardown.ok ? teardown.error.code : null,
      refusedWhileDraining: refusedWhileDraining === null ? null : String(refusedWhileDraining).slice(0, 160),
      text: String(res?.text ?? res?.threw ?? '').slice(0, 200),
      bodies: f.obs.filter((o) => o.event === 'body').map((o) => o.identity),
    }
  }

  const hazard = await arm('hazard')
  const safe = await arm('safe')
  const parked = await arm('pr1-parked')
  const inBody = await arm('pr1-body')

  check('NEG1-CONTROL', 'without PR1, lift-then-unload still hands the call to the native body (protection control)',
    hazard.native === 1, `native=${String(hazard.native)} bodies=${hazard.bodies.join(',')}`)
  check('NEG1-SAFE', 'without PR1, the reverse order keeps the native body out (protection control)',
    safe.native === 0, `native=${String(safe.native)} bodies=${safe.bodies.join(',')}`)
  // THE DISCLOSED BOUNDARY, asserted rather than glossed: a call parked at
  // pre-execute is NOT leased (that edge's next() resolves before the Body —
  // measured above), so the drain may reach RELEASED around it. What protects
  // it is the pre-execute/dispatch STATE GATE, which is why no body of any
  // kind runs. Recorded in the PR's unfinished-capability section.
  check('NEG1-PARKED', 'PR1: a call resuming at the fence meets the state gate; no body of ANY kind runs (lease boundary disclosed)',
    parked.native === 0 && parked.adapter === 0 && parked.text.includes('not ACTIVE'),
    `native=${String(parked.native)} adapter=${String(parked.adapter)} teardown=${String(parked.teardownRefusalCode ?? 'clean')} text=${parked.text.slice(0, 110)}`)
  check('NEG1-BODY', 'PR1: a call already inside the Team Body drains; the teardown waits and the native body never appears',
    inBody.native === 0 && inBody.adapter === 1,
    `native=${String(inBody.native)} adapter=${String(inBody.adapter)} bodies=${inBody.bodies.join(',')}`)
  // The strong property is asserted INSIDE the parked arm (it throws if the
  // first teardown lifted anything); here the accounting closes: one lift per
  // Agent, ever, and only after the state reached RELEASED.
  check('NEG1-MASK', 'PR1: the mask survives a refused teardown, lifts exactly once when the drain legitimately finishes, and never on an unproven termination',
    parked.maskLifts === 1
      && inBody.maskLifts === 0
      && inBody.nativeBeforeRelease === 0
      && parked.teardownRefusalCode === 'EXECUTION_TERMINATION_UNCONFIRMED'
      && inBody.teardownRefusalCode === 'EXECUTION_TERMINATION_UNCONFIRMED',
    `parkedLifts=${String(parked.maskLifts)} parkedFirstTeardown=${String(parked.teardownRefusalCode)} bodyLifts=${String(inBody.maskLifts)} bodyFirstTeardown=${String(inBody.teardownRefusalCode)} nativeBeforeRelease=${String(inBody.nativeBeforeRelease)}`)
  // THE SEAM ORDER, MEASURED — AND A CORRECTION ON THE RECORD (PR1 Gate R4).
  // The first version of this kit recorded `post-execute fires while the Body is
  // parked` as a disclosed seam LIMIT. That measurement was VACUOUS: the arm's
  // park did not actually hold the Body open (the obs tail read
  // `wrapper-enter -> body -> wrapper-return` before the teardown ran), so the
  // call had already completed and any edge order it reported was meaningless.
  // With the park made real, the pinned registry says the opposite: neither
  // `tools/post-execute` nor `tools/result` fires while the Body is alive — both
  // come after it returned — while the Dispatcher's own lease is still held for
  // the whole window. The law follows the measurement: `post-execute` only
  // RECORDS that a result is in hand, and the lease ends at `tools/result`, the
  // registry's final emit edge (dispatched after materialization and content
  // finalization, on the success AND the error path).
  check('NEG1-SEAM', 'measured seam order: the Body is still alive across the whole drain window (lease = 1) and BOTH result-side edges fire only after it returned',
    inBody.edgeOrder.postExecutedFired === true
      && inBody.edgeOrder.postExecutedAfterBodyReturn === true
      && inBody.edgeOrder.postExecutedWhileBodyParked === false
      && inBody.leaseProbe?.bodyReturnedAlready === false
      && (inBody.leaseProbe?.inFlight ?? 0) >= 1
      && inBody.settledProbe?.fired === true
      && inBody.settledProbe?.bodyReturnedAtSettled === true
      && inBody.bodyReturned === true,
    `postExecutedFired=${String(inBody.edgeOrder.postExecutedFired)} postExecutedAfterBodyReturn=${String(inBody.edgeOrder.postExecutedAfterBodyReturn)} inFlightAtTeardown=${String(inBody.leaseProbe?.inFlight)} bodyReturnedAtTeardown=${String(inBody.leaseProbe?.bodyReturnedAlready)} bodyReturnedAtSettled=${String(inBody.settledProbe?.bodyReturnedAtSettled)}`)
  // THE NEVER-DISARM LAW (PR1 Gate R4, the half-state): a Body that came back
  // after the drain began cannot reopen the release. The Dispatcher stays
  // TOMBSTONED with its mask and Guard armed, the late callback is recorded and
  // refused, and no arm of the run hands the native Body another chance.
  check('NEG1-R4', 'PR1: a Body returning after the drain began leaves the half-state armed — refused release, mask kept, late callback recorded',
    inBody.secondTeardownCode === 'EXECUTION_TERMINATION_UNCONFIRMED'
      && inBody.finalState === 'TOMBSTONED'
      && inBody.lateSettledObserved === true
      && inBody.maskLifts === 0
      && inBody.native === 0
      && inBody.adapter === 1,
    `secondTeardown=${String(inBody.secondTeardownCode)} finalState=${String(inBody.finalState)} lateSettledRecorded=${String(inBody.lateSettledObserved)} lifts=${String(inBody.maskLifts)} native=${String(inBody.native)} adapter=${String(inBody.adapter)}`)
  check('NEG1-STABLE', 'PR1: the governed name resolves to the Team Definition before the drain (stable shape, no unload)',
    parked.resolutionBefore === 'ADAPTER.grep' && inBody.resolutionBefore === 'ADAPTER.grep',
    `parked=${parked.resolutionBefore} body=${inBody.resolutionBefore}`)
  check('NEG1-LEAK', 'an outstanding call stops the teardown: unconfirmed termination, never a release',
    parked.teardownRefusalCode === 'EXECUTION_TERMINATION_UNCONFIRMED'
      && (parked.refusedWhileDraining ?? '').includes('not ACTIVE')
      && (parked.text ?? '').includes('not ACTIVE'),
    `code=${String(parked.teardownRefusalCode)} guardSays=${String(parked.refusedWhileDraining).slice(0, 80)} resumed=${String(parked.text).slice(0, 60)}`)

  const result = { runStamp: new Date().toISOString(), criteria, arms: { hazard, safe, parked, inBody } }
  const text = JSON.stringify(result, null, 2)
  if (OUT_ARG !== null) writeFileSync(OUT_ARG, text)
  console.log(text)
  process.exitCode = criteria.filter((c) => !c.ok).length === 0 ? 0 : 2
}

main().catch((error) => {
  console.log(`FATAL ${error instanceof Error ? error.stack : String(error)}`)
  if (OUT_ARG !== null) writeFileSync(OUT_ARG, JSON.stringify({ fatal: String(error), criteria }, null, 2))
  process.exitCode = 1
})
