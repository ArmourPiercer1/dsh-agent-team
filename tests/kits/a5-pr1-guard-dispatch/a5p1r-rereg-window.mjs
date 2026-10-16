#!/usr/bin/env node
/**
 * a5p1r-rereg-window.mjs — Alpha.5 PR1-residual R-b: the Guard-validation →
 * late-Body-resolution window, driven by a LEGAL concurrent re-registration,
 * measured on the pinned 0.2.0-rc.2 registry with a DETERMINISTIC PARK.
 *
 * WHY THIS RUNNER EXISTS (the round's R-b instruction, and the rule it may not
 * bend): a same-scope plugin that re-registers a tool the ordinary way
 * (`dispose()` the old registration, then `register()` the new Definition) is
 * NOT the "malicious Host rewriting registry memory" adversary class the design
 * excludes. It is an ordinary, supported Host action, so the window between
 * "the Guard validated the Definition" and "the registry resolved the Definition
 * it will actually call" is IN SCOPE and has to be MEASURED, not argued away.
 * The threat model is not re-worded anywhere in this round; what changed is that
 * the ordinary-re-registration class now has a measurement and a posture.
 *
 * THE PINNED REGISTRY'S OWN ORDER (`packages/core/tools/src/index.ts` at the
 * pinned SHA, and re-measured by these arms — never assumed):
 *
 *   createExecution        → `get(name, agent)`   (an EARLY resolution, kept
 *                            only to capture the definition-owned finalizer)
 *   `tools/pre-execute`    → waterfall  (a fence here provably holds the call)
 *   `this.guardReason()`   → the Guard stage runs AFTER pre-execute
 *   `tools/execute`        → waterfall  (our inner door sits inside this)
 *   `dispatchToolBody`     → `resolveExecution()` → `tool.execute(...)`
 *                                             ← the LATE resolution: the Body
 *
 * The two resolutions bracket every seam this lane can reach, so the arms ask
 * exactly one question per arm: does a Body the Guard never validated run?
 *
 * ARMS (every park is a real fence the arm waits on, never a sleep):
 *
 *   control-no-pr1                lane NOT in the loop. If the re-registered
 *                                 Body does not run here, the harness is blind.
 *   guarded-pre-execute           lane in the loop, the legal re-registration
 *                                 lands while the call is parked at
 *                                 `tools/pre-execute`, i.e. BEFORE the Guard.
 *   guarded-pre-execute-no-change the same with the `tools/change` channel
 *                                 unavailable, so a refusal can only come from
 *                                 the per-call definition read (F2) itself.
 *   inner-before-ours             a normal plugin's `tools/execute` listener
 *                                 that re-registers, mounted BEFORE our door.
 *   inner-after-ours              the same plugin mounted AFTER our door.
 *
 * EVIDENCE = BODY COUNTERS PER IDENTITY. `V1` is the Definition the assembly
 * pinned, `V2` the one a legal re-registration installed afterwards. A `V2`
 * counter of 1 means an un-validated Body ran; a `V1` counter of 1 means a
 * withdrawn verification was still waved through. Neither is judged from prose.
 *
 * Usage: node a5p1r-rereg-window.mjs [--out <file.json>]
 * EXIT: 0 = all criteria pass, 2 = a criterion failed, 1 = fatal.
 */
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')
const FIXTURE_URL = pathToFileURL(
  join(REPO_ROOT, 'dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline/p00-fixture.mjs'),
).href
const LANE_URL = pathToFileURL(join(REPO_ROOT, 'packages/runtime/dist/packages/runtime/tool-dispatch/index.js')).href

const OUT_ARG = (() => {
  const i = process.argv.indexOf('--out')
  return i === -1 ? null : resolve(process.argv[i + 1])
})()

const criteria = []
function check (id, name, ok, detail) {
  criteria.push({ id, name, ok: ok === true, detail: String(detail ?? '').slice(0, 600) })
  console.log(`${ok === true ? 'PASS' : 'FAIL'} ${id}: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 320)}`}`)
}

function makeGate () {
  let release = null
  const promise = new Promise((r) => { release = () => r() })
  return { promise, release: () => release() }
}

const tick = () => new Promise((r) => setTimeout(r, 5))

async function main () {
  const { makeFixture, countingTool } = await import(FIXTURE_URL)
  const { installScopedToolGuard } = await import(LANE_URL)

  const MODES = ['control-no-pr1', 'guarded-pre-execute', 'guarded-pre-execute-no-change', 'inner-before-ours', 'inner-after-ours']
  // B3 (user ruling (ii)): the arms that measure the after-door cancellation
  // itself, its limits and its side effects. Each is its own Host fixture, so no
  // arm can contaminate another's counters.
  const B3_MODES = [
    'guarded-after-body-zero',
    'guarded-after-no-change',
    'guarded-after-abort-inside-body',
    'guarded-after-two-names',
    'guarded-after-multi-call',
    'guarded-after-mcp-resync',
    'guarded-after-hooks',
    'guarded-after-change-inert',
    // G-g support contract §3 (G-4): the SWALLOW injection — a second, distinct way
    // to make a live subscription silent (the inert arm disposes; this one never does).
    'guarded-after-change-swallow',
  ]

  /** @param {typeof MODES[number]} mode */
  async function arm (mode) {
    const f = await makeFixture()
    const A = await f.mintScope('A')
    const inner = A.scope.ctx

    // The Definition this Agent's own scope contributes under `grep`, and the
    // replacement a LEGAL re-registration installs. Two identities, one name.
    const v1 = countingTool(f.obs, 'grep', 'V1')
    let disposeVariant = inner.tools.register(v1)
    let reRegisterCount = 0
    const reRegister = () => {
      disposeVariant()
      disposeVariant = inner.tools.register(countingTool(f.obs, 'grep', 'V2'))
      reRegisterCount += 1
      f.obs.push({ event: 'action', at: Date.now(), action: 'legal-re-register', name: 'grep', from: 'V1', to: 'V2' })
    }

    // The `tools/change` channel can be made unavailable the way a Host without
    // it would be: the registration throws, and the install records it and
    // carries on (it is a diagnostic, not one of the required seams). Without
    // this arm a refusal here could not be attributed to F2.
    const noChange = mode === 'guarded-pre-execute-no-change'
    const onEvent = (event, listener) => {
      if (noChange && event === 'tools/change') throw new Error('fixture: no tools/change channel on this Host')
      return inner.on(event, listener)
    }
    // The view the lane is installed on: the SAME public `tools` service, and an
    // `on` that may or may not carry the `tools/change` diagnostic.
    const ctxView = { tools: inner.tools, on: onEvent }

    // A normal third-party plugin's `tools/execute` listener that re-registers
    // on the ordinary path. WHERE it is mounted relative to the lane's own door
    // is the only difference between the last two arms: listeners run in
    // registration order, so mounting before the install puts it ahead of our
    // door and mounting after puts it behind every check the lane owns.
    const mountThirdParty = () => {
      onEvent('tools/execute', (exec, next) => {
        if (exec.name !== 'grep') return next()
        f.obs.push({ event: 'action', at: Date.now(), action: 'third-party-execute-listener', order: mode })
        reRegister()
        return next()
      })
    }
    if (mode === 'inner-before-ours') mountThirdParty()

    let handle = null
    if (mode !== 'control-no-pr1') {
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
        agentCtx: ctxView,
        runtimeAgent: A.key,
        agentScopeKey: 'A',
        trustedIdentities: ['A'],
        nativeNames,
        // `grep` is this arm's OWN Team Definition, so the arm takes the
        // documented explicit-bind path below. This runner is about the
        // validate→resolve window; same-name attribution is measured by
        // `a5p1-order-hazard.mjs`'s R1R-SHADOW arm.
        assemblyOwnedNames: ['grep'],
      })
      if (!outcome.ok) {
        if (!noChange) throw new Error(`${mode}: install refused: ${outcome.error.code} ${outcome.error.message}`)
        // ②: since the B3 ruling this Host is DECLARED UNSUPPORTED instead of
        // being delivered with the notification hole closed over. That refusal is
        // this arm's outcome, and it is measured as one: nothing installs, nothing
        // runs, nothing is silently downgraded.
        const stray = await f.run('grep', A.key)
        return {
          mode,
          installRefused: true,
          refuseCode: String(outcome.error.code),
          refuseMessage: String(outcome.error.message),
          changeChannel: 'unavailable',
          reRegistrations: 0,
          v1: f.counters('V1'),
          v2: f.counters('V2'),
          text: String(stray?.text ?? stray?.threw ?? '').slice(0, 160),
          verifiedBefore: null,
          verifiedAfter: null,
          decisionInWindowKind: null,
          decisionInWindowReason: null,
          resolutionInWindow: f.resolution('grep', A.key),
          state: null,
          driftPerCall: 0,
          driftViaChange: 0,
          innerDoorDenials: [],
          callEdgeWithdrawal: 0,
          laneEvents: [],
          secondCallV2: null,
          secondCallText: null,
          obsTail: f.obs.slice(-10).map((o) => (o.event === 'body' ? `body:${o.identity}` : String(o.action ?? o.event))),
        }
      }
      handle = outcome.value
      const bound = handle.bindOwnTools(['grep'])
      if (!bound.ok) throw new Error(`${mode}: bindOwnTools refused: ${bound.error.code} ${bound.error.message}`)
      const published = handle.publish()
      if (!published.ok) throw new Error(`${mode}: publish refused: ${published.error.code} ${published.error.message}`)
    }

    // Park the call at `tools/pre-execute` on a real fence.
    const fence = makeGate()
    let reachedFence = false
    onEvent('tools/pre-execute', (exec, next) => {
      if (exec.name !== 'grep' || reachedFence) return next()
      reachedFence = true
      return fence.promise.then(() => next())
    })
    if (mode === 'inner-after-ours') mountThirdParty()

    const entryBefore = handle === null ? null : { ...handle.dispatcher.surface.entryOf('grep')?.binding }
    const verifiedBefore = handle === null ? null : handle.dispatcher.surface.entryOf('grep')?.verified ?? null
    // The per-call verdict AT THE PINNED Definition, before anything moves: the
    // arm is only meaningful if the call was governed-and-verified going in.
    const decideBefore = handle === null ? null : handle.dispatcher.decide({ name: 'grep', agentIdentity: 'A' })

    const inflight = f.run('grep', A.key)
    // (the residual arm asks a SECOND question after the first call settles: the
    // posture claim is "the exposure is one call", and the only honest way to
    // state that is to place the next call and watch it be refused.)
    let second = null
    const deadline = Date.now() + 20_000
    while (!reachedFence) {
      if (Date.now() >= deadline) throw new Error(`${mode}: the call never reached the pre-execute fence`)
      await tick()
    }
    // THE LEGAL RE-REGISTRATION, inside the parked window (for the two inner
    // arms the re-registration is performed by the plugin's own listener).
    if (mode === 'guarded-pre-execute' || mode === 'guarded-pre-execute-no-change' || mode === 'control-no-pr1') reRegister()
    const decisionInWindow = handle === null ? null : handle.dispatcher.decide({ name: 'grep', agentIdentity: 'A' })
    const resolutionInWindow = f.resolution('grep', A.key)
    fence.release()
    const res = await inflight

    if (mode === 'inner-after-ours') {
      second = await f.run('grep', A.key)
    }

    const obs = f.obs.map((o) => (o.event === 'body' ? `body:${o.identity}` : String(o.action ?? o.event)))
    const laneObs = handle === null ? [] : handle.observations().map((o) => String(o.event))
    const has = (e) => laneObs.filter((x) => x === e).length
    return {
      mode,
      reRegistrations: reRegisterCount,
      pinnedBefore: entryBefore?.definitionIdentity ?? null,
      verifiedBefore,
      decideBeforeKind: decideBefore?.kind ?? null,
      decisionInWindowKind: decisionInWindow?.kind ?? null,
      decisionInWindowReason: decisionInWindow?.reason ?? null,
      resolutionInWindow,
      v1: f.counters('V1'),
      v2: f.counters('V2'),
      state: handle === null ? null : handle.dispatcher.state(),
      verifiedAfter: handle === null ? null : handle.dispatcher.surface.entryOf('grep')?.verified ?? null,
      text: String(res?.text ?? res?.threw ?? '').slice(0, 240),
      driftPerCall: handle === null ? null : has('dispatcher-definition-drift'),
      driftViaChange: handle === null ? null : has('dispatcher-revalidate-drift'),
      innerDoorDenials: handle === null ? null : handle.observations().filter((o) => String(o.event) === 'dispatcher-definition-drift').map((o) => `drift:${String(o.tool)}`),
      callEdgeWithdrawal: handle === null ? null : has('dispatcher-definition-change-at-call-edge'),
      laneEvents: handle === null ? [] : [...new Set(handle.observations().map((o) => String(o.event)))],
      // The posture claim, measured: after the one un-validated Body, the NEXT
      // call is refused and no second Body runs.
      secondCallV2: second === null ? null : f.counters('V2'),
      secondCallText: second === null ? null : String(second?.text ?? second?.threw ?? '').slice(0, 200),
      changeChannel: noChange ? 'unavailable' : 'available',
      obsTail: obs.slice(-10),
    }
  }

  /**
   * The B3 arms. The mechanism under test is the one the pinned Host advertises
   * to a wrapper — "wrappers may change only `exec.signal`" — used to CANCEL a
   * call whose Definition moves after the lane's last check, so that the Host's
   * own before-dispatch refusal (`index.ts:1572`, ahead of `resolveExecution` at
   * `:1578`) is what stops the Body. These arms exist to prove three separate
   * things, and each criterion names one: nothing un-validated runs; nothing
   * that legitimately ran is re-labelled; nothing innocent is touched.
   */
  async function armB3 (mode) {
    const f = await makeFixture()
    const A = await f.mintScope('A')
    const inner = A.scope.ctx

    const bodyGate = makeGate()
    const holdGate = makeGate()
    // A CALLER-owned signal. NOTE (measured, runs/probe-cancel.mjs): on this Host
    // a cancellation raised by the caller while the Body is in flight does NOT
    // surface at the result edge for a direct `ctx.tools.execute()` call, so this
    // arm does not rest on it — the lane's own inside-body case is what is
    // measured here, and the caller path is disclosed in the seam record.
    const names = mode === 'guarded-after-two-names' ? ['grep', 'read'] : ['grep']
    /** Live registrations by name, so a re-registration is a real dispose+register. */
    const live = new Map()
    const put = (name, identity, opts) => {
      live.get(name)?.()
      live.set(name, inner.tools.register(countingTool(f.obs, name, identity, opts ?? {})))
    }
    let reRegisterCount = 0
    const reRegisterName = (name) => {
      put(name, name === 'grep' ? 'V2' : 'R2')
      reRegisterCount += 1
      f.obs.push({ event: 'action', at: Date.now(), action: 'legal-re-register', name, to: name === 'grep' ? 'V2' : 'R2' })
    }
    put('grep', 'V1', mode === 'guarded-after-abort-inside-body' ? { gate: bodyGate.promise } : {})
    if (names.includes('read')) put('read', 'R1')

    // The inert-channel arm subscribes and then never receives anything: the
    // disposer is real, the Host is healthy, and the notification simply stops
    // arriving. Undetectable at assembly time — which is why the call edge has to
    // be the one that says so.
    let cutChange = false
    const changeDisposers = []
    // G-4 (G-g support contract §3): the SWALLOW injection. The `on` the lane gets is
    // wrapped: the `tools/change` subscription is ACCEPTED, its disposer is real and
    // never called — the subscription entry stays in the Host's listener table for the
    // whole run — but what sits at that entry is a proxy that forwards nothing to the
    // lane's handler. From the lane's view this is indistinguishable from the inert
    // injection (subscription succeeded, nothing arrives, the channel stays 'armed');
    // the injections differ on the Host side: nothing here is ever disposed. The kit's
    // OWN control subscription (after the install) proves the registry really does emit
    // `tools/change` during the run, so the arm cannot silently degrade into the
    // never-emits-anywhere configuration: emission happens, delivery to THIS
    // subscription is swallowed.
    const swallow = { proxyEmissions: 0, controlEvents: 0 }
    const onEvent = (event, listener) => {
      if (event === 'tools/change' && mode === 'guarded-after-change-swallow') {
        const proxy = () => { swallow.proxyEmissions += 1 }
        return inner.on(event, proxy)
      }
      const dispose = inner.on(event, listener)
      if (event === 'tools/change' && mode === 'guarded-after-change-inert') changeDisposers.push(dispose)
      return dispose
    }

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
      agentCtx: { tools: inner.tools, on: onEvent },
      runtimeAgent: A.key,
      agentScopeKey: 'A',
      trustedIdentities: ['A'],
      nativeNames,
      assemblyOwnedNames: [...names],
    })
    if (!outcome.ok) throw new Error(`${mode}: install refused: ${outcome.error.code} ${outcome.error.message}`)
    const handle = outcome.value
    const bound = handle.bindOwnTools([...names])
    if (!bound.ok) throw new Error(`${mode}: bindOwnTools refused: ${bound.error.code} ${bound.error.message}`)
    const published = handle.publish()
    if (!published.ok) throw new Error(`${mode}: publish refused: ${published.error.code} ${published.error.message}`)
    // G-4 control: the kit's own genuine subscription on the same Host — if the
    // registry emits at all, this counter moves. The swallow arm's loud predicate
    // requires it to have moved while the lane stayed 'armed'.
    if (mode === 'guarded-after-change-swallow') inner.on('tools/change', () => { swallow.controlEvents += 1 })

    // Result edges, observed from outside the lane: a cancelled call must still
    // be a call that the rest of the system can see.
    const edge = { post: [], result: [] }
    // `tools/post-execute` is a WATERFALL whose value is the decision (`:176`),
    // so an observer here must forward `next()` and hand its value back: a
    // listener that returns nothing replaces the decision with `undefined` and
    // the registry then fails inside its own post-execute handling. (That is how
    // this arm first read the outcome as a crash instead of an abort.)
    onEvent('tools/post-execute', (exec, result, next) => {
      edge.post.push({ callId: String(exec?.callId ?? '?'), code: String(result?.error?.info?.code ?? 'none') })
      return next()
    })
    onEvent('tools/result', (exec, result) => {
      edge.result.push({ callId: String(exec?.callId ?? '?'), code: String(result?.error?.info?.code ?? 'none') })
    })

    // A third-party plugin's `tools/execute` listener, mounted AFTER the lane's
    // door: the only place a legal re-registration can land that no public seam
    // can see before the registry resolves the Body. It also holds the calls
    // there, so "after the door" is a fence rather than a race.
    let movedOnce = false
    onEvent('tools/execute', (exec, next) => {
      if (!names.includes(exec.name)) return next()
      // In the two-names arm only ONE name moves: the neighbour must be left
      // alone, which is the whole point of that arm.
      if (mode === 'guarded-after-two-names' && exec.name !== 'grep') return next()
      f.obs.push({ event: 'action', at: Date.now(), action: 'third-party-execute-listener', name: exec.name, mode })
      if (mode === 'guarded-after-no-change') return next()
      if (mode === 'guarded-after-abort-inside-body') {
        // Let the Body START, then move its Definition while it runs: the
        // cancellation can only arrive after the side effect began.
        const running = next()
        const started = Date.now() + 20_000
        const waitBody = async () => {
          while (f.counters('V1') < 1) {
            if (Date.now() >= started) throw new Error(`${mode}: the Body never started`)
            await tick()
          }
          reRegisterName('grep')
          bodyGate.release()
          return await running
        }
        return waitBody()
      }
      if (movedOnce && mode !== 'guarded-after-two-names') return next()
      movedOnce = true
      if (mode === 'guarded-after-multi-call') {
        return holdGate.promise.then(() => {
          if (reRegisterCount === 0) reRegisterName('grep')
          return next()
        })
      }
      if (mode === 'guarded-after-mcp-resync') {
        // The MCP `syncTools` shape: the previous generation is disposed and a
        // new one registered, all at once.
        for (const name of names) reRegisterName(name)
        return next()
      }
      reRegisterName(exec.name)
      return next()
    })

    // Park at pre-execute so the calls are in flight before anything moves.
    let parked = 0
    const wantParked = mode === 'guarded-after-multi-call' ? 2 : 1
    onEvent('tools/pre-execute', (exec, next) => {
      if (!names.includes(exec.name) || parked >= wantParked) return next()
      parked += 1
      return holdGate.promise.then(() => next())
    })

    const verifiedBefore = handle.dispatcher.surface.entryOf('grep')?.verified ?? null
    // G-1a (P1): the read BEFORE any injection is the whole externally observable
    // fact about the channel at assembly time. 'armed' here is the exact same shape
    // a healthy delivering arm reads at the same instant — the silent configuration
    // is indistinguishable at assembly, and that is now a named criterion, not a
    // records field.
    const channelBeforeInjection = typeof handle.changeChannelStatus === 'function' ? handle.changeChannelStatus() : 'unknown'
    if (mode === 'guarded-after-change-inert') for (const dispose of changeDisposers) dispose()
    const calls = []
    if (mode === 'guarded-after-multi-call') {
      calls.push(f.run('grep', A.key), f.run('grep', A.key))
    } else if (mode === 'guarded-after-two-names') {
      calls.push(f.run('grep', A.key), f.run('read', A.key))
    } else {
      calls.push(f.run('grep', A.key))
    }

    const deadline = Date.now() + 20_000
    while (parked < wantParked) {
      if (Date.now() >= deadline) throw new Error(`${mode}: the calls never reached the pre-execute fence (parked=${String(parked)})`)
      await tick()
    }
    holdGate.release()
    const settled = await Promise.all(calls)
    const first = settled[0] ?? null
    // The CALL-EDGE settled read: the verified state at the moment the moved call
    // settled, before any later probe or re-bind touched the run. This is the value
    // the LOUD criteria have always meant ("the verification is withdrawn at THIS
    // call"); G-2 adds a re-bind later in the same run, so it keeps its own field.
    const verifiedAtCallEdge = handle.dispatcher.surface.entryOf('grep')?.verified ?? null
    // The exposure the P2/P3 predicates name is the one the FIRST call made; the
    // G-2/G-4 probes below run later in the same arm, so the V2 counter is read
    // here, before they can move it.
    const v2AfterFirstCall = f.counters('V2')
    // (the residual arm asks a SECOND question after the first call settles — and
    // since the G-g probes, so do both SILENT arms: the posture is only honest if
    // the next call is placed and seen refused, then re-bound, then seen run.)
    const second = (mode === 'guarded-after-body-zero' || mode === 'guarded-after-change-inert' || mode === 'guarded-after-change-swallow')
      ? await f.run('grep', A.key)
      : null
    const secondCallBodies = second === null ? null : second.bodies.filter((o) => o.event === 'body').length
    const secondCallRefused = second !== null && secondCallBodies === 0
      && (second.isError === true || second.threw !== undefined)
      && /definition drift/.test(String(second.text ?? second.threw ?? ''))
    const v2AfterSecond = second === null ? null : f.counters('V2')

    // A re-bind is the documented way back; measure that it still is one.
    let verifiedBeforeRebind = null
    let rebind = null
    let third = null
    if (mode === 'guarded-after-mcp-resync' || mode === 'guarded-after-change-inert' || mode === 'guarded-after-change-swallow') {
      // G-2 (P4): the recovery path — refused next call, explicit re-bind, executed
      // third call — is measured INSIDE the silent arms themselves, never
      // extrapolated from a delivered configuration.
      verifiedBeforeRebind = handle.dispatcher.surface.entryOf('grep')?.verified ?? null
      rebind = handle.bindOwnTools([...names])
      third = rebind.ok === true ? await f.run('grep', A.key) : null
    }
    const verifiedAfterRebind = rebind === null ? null : (handle.dispatcher.surface.entryOf('grep')?.verified ?? null)
    const thirdCallBodies = third === null ? null : third.bodies.filter((o) => o.event === 'body').length
    const thirdCallExecuted = third !== null && thirdCallBodies >= 1
      && third.bodies.some((o) => o.event === 'body' && String(o.identity ?? '') === 'V2')
    let teardown = null
    let teardownState = null
    if (mode === 'guarded-after-body-zero') {
      const gone = handle.disposeOrdered()
      teardown = { ok: gone.ok === true, code: gone.ok === true ? null : String(gone.error?.code ?? '') }
      teardownState = handle.dispatcher.state()
    }

    // Read the lane's NEW surface defensively: this harness must still produce
    // evidence when it is pointed at a build that has no such surface (that is
    // what a RED run against the previous build is), instead of dying on it.
    const watches = typeof handle.pendingCalls === 'function' ? handle.pendingCalls() : []
    const channelStatus = typeof handle.changeChannelStatus === 'function' ? handle.changeChannelStatus() : 'unknown'
    const laneObs = handle.observations()
    const count = (event) => laneObs.filter((o) => String(o.event) === event).length
    const issued = laneObs.filter((o) => String(o.event) === 'dispatcher-change-abort-issued')
      .flatMap((o) => (Array.isArray(o.calls) ? o.calls.map((c) => `${String(c.tool)}:${String(c.callId)}`) : []))
    const terminated = laneObs.filter((o) => String(o.event) === 'dispatcher-call-terminated-after-body-start')
    return {
      mode,
      reRegistrations: reRegisterCount,
      verifiedBefore,
      v1: f.counters('V1'),
      v2: f.counters('V2'),
      r1: f.counters('R1'),
      code: first?.code ?? null,
      text: String(first?.text ?? first?.threw ?? '').slice(0, 240),
      changeAbortIssued: count('dispatcher-change-abort-issued'),
      cancelledBeforeBody: count('dispatcher-call-cancelled-before-body'),
      terminatedAfterBodyStart: terminated.length,
      terminatedSideEffectPossible: terminated.filter((o) => o.sideEffectPossible === true).length,
      completedAfterAbort: count('dispatcher-call-completed-after-abort'),
      executedUnvalidated: count('dispatcher-call-executed-unvalidated'),
      abortIssuedCalls: issued,
      watchedNames: watches.map((row) => String(row.name)),
      pendingAfter: watches.map((row) => String(row.callId)),
      changeChannel: channelStatus,
      verifiedAfter: handle.dispatcher.surface.entryOf('grep')?.verified ?? null,
      secondCallV2: v2AfterSecond,
      secondCallText: second === null ? null : String(second?.text ?? second?.threw ?? '').slice(0, 160),
      // G-g support-contract probes (G-1a/G-2/G-4): assembly-time install facts the
      // arm implied by throwing but never recorded, the pre-injection channel read,
      // the call-edge verified state, the per-probe V2 counter moves, and the
      // filtered event-stream counts the contract's predicate group names.
      installOk: true,
      publishedOk: true,
      channelBeforeInjection,
      verifiedAtCallEdge,
      v2AfterFirstCall,
      secondCallBodies,
      secondCallRefused,
      verifiedBeforeRebind,
      verifiedAfterRebind,
      thirdCallBodies,
      thirdCallExecuted,
      swallowProxyEmissions: mode === 'guarded-after-change-swallow' ? swallow.proxyEmissions : null,
      swallowControlEvents: mode === 'guarded-after-change-swallow' ? swallow.controlEvents : null,
      callEdgeDrift: laneObs.filter((o) => String(o.event) === 'dispatcher-definition-change-at-call-edge' && String(o.reason) === 'definition-drift').length,
      bindingRevisedUnverified: laneObs.filter((o) => String(o.event) === 'dispatcher-binding-revised' && o.verified === false).length,
      executedUnvalidatedAlarms: laneObs.filter((o) => String(o.event) === 'dispatcher-call-executed-unvalidated' && o.severity === 'alarm').length,
      rebindOk: rebind === null ? null : rebind.ok === true,
      rebindError: rebind === null || rebind.ok ? null : `${String(rebind.error?.code)} ${String(rebind.error?.message)}`.slice(0, 200),
      thirdCallV2: third === null ? null : f.counters('V2'),
      teardown,
      teardownState,
      edges: edge,
      laneEvents: [...new Set(laneObs.map((o) => String(o.event)))],
      obsTail: f.obs.slice(-12).map((o) => (o.event === 'body' ? `body:${o.identity}` : String(o.action ?? o.event))),
    }
  }

  const results = {}
  for (const mode of MODES) results[mode] = await arm(mode)
  for (const mode of B3_MODES) results[mode] = await armB3(mode)
  const control = results['control-no-pr1']
  const guarded = results['guarded-pre-execute']
  const noChange = results['guarded-pre-execute-no-change']
  const before = results['inner-before-ours']
  const after = results['inner-after-ours']

  // CONTROL: the hazard is real and this harness can see it. Without the lane a
  // legal re-registration inside the parked window decides the Body.
  check('RW-CONTROL', 'without the lane, a legal re-registration inside the parked window decides which Body runs (protection control)',
    control.reRegistrations === 1 && control.v2 === 1 && control.v1 === 0,
    `v1=${String(control.v1)} v2=${String(control.v2)} resolution=${control.resolutionInWindow} text=${control.text.slice(0, 60)}`)
  // THE CHANNEL IS A CAPABILITY (②/⑧). This arm's Host cannot subscribe to
  // `tools/change` at all. Before the B3 ruling the lane installed anyway and
  // filed that as a diagnostic; the ruling made the promise, so the assembly is
  // now REFUSED with a typed reason that names the channel — and nothing of the
  // Team's runs on a lane that cannot keep the promise.
  check('RW-NO-CHANGE-CHANNEL-UNSUPPORTED', 'a Host whose tools/change subscription is refused is declared unsupported at assembly time (typed IO_POLICY_UNSUPPORTED naming the channel), with no Body of the governed name running behind a lane that never armed',
    noChange.installRefused === true && noChange.refuseCode === 'IO_POLICY_UNSUPPORTED' && /tools\/change/.test(String(noChange.refuseMessage))
      && /unsupported/.test(String(noChange.refuseMessage)) && noChange.changeChannel === 'unavailable',
    `refused=${String(noChange.installRefused)} code=${String(noChange.refuseCode)} message=${String(noChange.refuseMessage).slice(0, 150)}`)
  // THE SAME WINDOW with the diagnostic channel present: the outcome must not
  // depend on it (a `tools/change` event is not a safety mechanism).
  check('RW-PRE-EXECUTE-COVERED', 'the pre-execute window is covered: no Body of either version runs, and the verification is withdrawn',
    guarded.v2 === 0 && guarded.v1 === 0 && guarded.verifiedAfter === false,
    `withChange v1=${String(guarded.v1)} v2=${String(guarded.v2)} verifiedAfter=${String(guarded.verifiedAfter)} | noChange arm refused=${String(noChange.installRefused)}`)
  // THE INNER DOOR: a re-registration that lands after the Guard stage but
  // before our own `tools/execute` door must still be refused before the Body.
  check('RW-INNER-DOOR', 'a re-registration between the Guard stage and our inner door is refused at that door: the un-validated Body never runs',
    before.v2 === 0 && before.v1 === 0 && /dispatch door/.test(before.text),
    `v1=${String(before.v1)} v2=${String(before.v2)} innerDoorDenials=${JSON.stringify(before.innerDoorDenials)} verifiedAfter=${String(before.verifiedAfter)} text=${before.text.slice(0, 110)}`)
  // THE BOUNDARY, RECORDED NOT CLAIMED: a plugin that mounted after our door
  // re-registers where no public seam can see it before the registry's late
  // resolution. This criterion asserts the HONEST fact — the Body ran, the lane
  // says so, and the verification is withdrawn at that same call so no later
  // call repeats it. It is the seam record, never a pass claim.
  // THE POSTURE, RESTATED (B3, user ruling (ii)). This criterion used to assert
  // `v2 === 1`: "exactly one un-validated Body ran, then the verification is
  // withdrawn there, so the exposure is one call". THAT CLAIM IS RETRACTED. The
  // public notification reaches the last gap and the Host refuses a raised signal
  // at `index.ts:1572`, before it resolves anything at `:1578`, so the required
  // outcome is that nothing runs — asserted below as body count zero.
  const zero = results['guarded-after-body-zero']
  check('RW-AFTER-DOOR-BODY-ZERO', 'B3 (ii): a re-registration after our dispatch door cancels the call before its Body — body count 0, the Host\'s own ABORTED_BEFORE_DISPATCH, the lane\'s own attribution event, and the next call still refused',
    zero.v1 === 0 && zero.v2 === 0 && zero.secondCallV2 === 0 && zero.cancelledBeforeBody >= 1 && zero.changeAbortIssued >= 1
      && /aborted before dispatch/.test(zero.text) && zero.verifiedAfter === false && zero.executedUnvalidated === 0,
    `v1=${String(zero.v1)} v2=${String(zero.v2)} code=${String(zero.code)} issued=${JSON.stringify(zero.abortIssuedCalls)} verifiedAfter=${String(zero.verifiedAfter)} obs=${zero.obsTail.join('>')}`)
  check('RW-TEARDOWN-NO-LEAK', 'the cancellation leaves no watch behind and the ordered teardown still reaches its lawful end (an abort is not used to declare a lease finished)',
    zero.pendingAfter.length === 0 && zero.teardownState !== null && (zero.teardown.ok === true || zero.teardownState === 'TOMBSTONED'),
    `pendingAfter=${JSON.stringify(zero.pendingAfter)} teardown=${JSON.stringify(zero.teardown)} state=${String(zero.teardownState)}`)
  const still = results['guarded-after-no-change']
  // G-1b (P7): the false-positive guard was a RECORDS field (`executedUnvalidated: 0`
  // in runs/kit-r1r-fix1/rereg-window.json) but not a PREDICATE. It is one now: a
  // call whose definition did not move must produce zero EXECUTED-UNVALIDATED alarms.
  check('RW-AFTER-NO-CHANGE', 'positive control (P7): with nothing moving the signal wrapper is inert — the Body runs, no cancellation event is raised, no un-validated alarm is raised, verification stands',
    still.v1 === 1 && still.v2 === 0 && still.changeAbortIssued === 0 && still.cancelledBeforeBody === 0 && still.executedUnvalidated === 0 && still.verifiedAfter === true
      && still.text.startsWith('ran:grep@V1'),
    `v1=${String(still.v1)} v2=${String(still.v2)} text=${still.text.slice(0, 40)} issued=${String(still.changeAbortIssued)} unvalidated=${String(still.executedUnvalidated)} verifiedAfter=${String(still.verifiedAfter)}`)
  const cancel = results['guarded-after-abort-inside-body']
  check('RW-ABORT-INSIDE-BODY-IS-TERMINATION', '④ a cancellation that arrives while the Body is running is TERMINATION, not a cancellation: the Body ran (side effect real, its value still carried) and is never re-labelled as un-executed',
    cancel.v1 === 1 && cancel.code === 'ABORTED' && cancel.terminatedAfterBodyStart >= 1 && cancel.terminatedSideEffectPossible >= 1
      && cancel.cancelledBeforeBody === 0,
    `v1=${String(cancel.v1)} code=${String(cancel.code)} terminated=${String(cancel.terminatedAfterBodyStart)}/${String(cancel.terminatedSideEffectPossible)} cancelledBeforeBody=${String(cancel.cancelledBeforeBody)} text=${cancel.text.slice(0, 70)}`)
  const iso = results['guarded-after-two-names']
  check('RW-ISOLATION-NEIGHBOUR-TOOL', 'isolation: a move on one name cancels only the calls that carried that name — the neighbour tool\'s Body runs and the abort set names nothing else',
    iso.r1 === 1 && iso.v1 === 0 && iso.v2 === 0 && iso.abortIssuedCalls.length >= 1 && iso.abortIssuedCalls.every((row) => row.startsWith('grep:')),
    `r1=${String(iso.r1)} v1=${String(iso.v1)} v2=${String(iso.v2)} issued=${JSON.stringify(iso.abortIssuedCalls)} watched=${JSON.stringify(iso.watchedNames)}`)
  const multi = results['guarded-after-multi-call']
  check('RW-MULTI-CALL-ALL-CANCELLED', 'isolation, other direction: every concurrent call of the moved name is cancelled, not only the one that happened to observe the change',
    multi.v2 === 0 && multi.abortIssuedCalls.length >= 2
      && multi.cancelledBeforeBody + multi.terminatedAfterBodyStart + multi.completedAfterAbort >= 2,
    `v1=${String(multi.v1)} v2=${String(multi.v2)} cancelled=${String(multi.cancelledBeforeBody)} terminated=${String(multi.terminatedAfterBodyStart)} late=${String(multi.completedAfterAbort)} issued=${JSON.stringify(multi.abortIssuedCalls)}`)
  const mcp = results['guarded-after-mcp-resync']
  check('RW-MCP-RESYNC-CANCELS-AND-REBIND-RESTORES', 'an MCP whole-generation withdraw+re-register cancels the in-flight calls it moved, and the documented re-bind by the trusted assembly restores the name',
    mcp.v1 === 0 && mcp.cancelledBeforeBody >= 1 && mcp.verifiedBeforeRebind === false && mcp.rebindOk === true && mcp.thirdCallV2 === 1 && mcp.verifiedAfter === true,
    `v1=${String(mcp.v1)} cancelled=${String(mcp.cancelledBeforeBody)} withdrawnThenRestored=${String(mcp.verifiedBeforeRebind)}->${String(mcp.verifiedAfter)} rebindOk=${String(mcp.rebindOk)} thirdCallV2=${String(mcp.thirdCallV2)} rebindErr=${String(mcp.rebindError)}`)
  const inert = results['guarded-after-change-inert']
  // P2's full conjunct set per the G-g support contract §4.1: the moved Body runs
  // (nothing could cancel it), the alarm says so with the channel still unproven,
  // NOTHING was cancelled, and the verification is withdrawn at that call edge.
  // (`v2AfterFirstCall`/`verifiedAtCallEdge` are the reads at that instant; the arm
  // now runs the G-2 recovery probes afterwards, so the end-of-run fields moved on.)
  check('RW-CHANGE-INERT-LOUD', '②⑦ a subscribed-but-silent channel is reported, not covered up: the moved Body does run (nothing can cancel it), and the call edge calls it EXECUTED UNVERIFIED with the channel still unproven, zero cancellation events, and the verification withdrawn at that edge',
    inert.v2AfterFirstCall === 1 && inert.executedUnvalidated >= 1 && inert.changeAbortIssued === 0 && inert.cancelledBeforeBody === 0 && inert.changeChannel === 'armed' && inert.verifiedAtCallEdge === false,
    `v2(first)=${String(inert.v2AfterFirstCall)} unvalidated=${String(inert.executedUnvalidated)} issued=${String(inert.changeAbortIssued)} cancelled=${String(inert.cancelledBeforeBody)} channel=${String(inert.changeChannel)} verifiedAtCallEdge=${String(inert.verifiedAtCallEdge)}`)
  // G-1a (P1): the silent configuration's INDIFFERENTIABILITY at assembly time, named.
  // install.ok && publish.ok && the pre-injection changeChannelStatus is 'armed' — the
  // same externally observable shape the delivering arm shows at the same instant.
  check('RW-INERT-ASSEMBLY-INDISTINGUISHABLE', 'P1/G-1a: the silent configuration is indistinguishable at assembly: install.ok, publish.ok, and the pre-injection changeChannelStatus read is "armed" — exactly the shape the delivering arm shows there',
    inert.installOk === true && inert.publishedOk === true && inert.channelBeforeInjection === 'armed',
    `installOk=${String(inert.installOk)} publishedOk=${String(inert.publishedOk)} channelBeforeInjection=${String(inert.channelBeforeInjection)}`)
  // G-3 (P6, task-commissioned): "delivered ⇒ proven" is ASSERTED, not merely recorded.
  // The body-zero arm injects one real registry change with the subscription live — the
  // delivery flips the status to 'proven'; the reverse half (never-delivered arms stay
  // 'armed' to the end of the run) is the paired conjunct, so both halves of P6 stand
  // here and in the unit legs.
  const swallowArm = results['guarded-after-change-swallow']
  check('RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY', 'P6/G-3: one real registry change delivered on a live subscription flips changeChannelStatus to "proven", while every never-delivered arm still reads "armed" at the end of its run',
    zero.changeChannel === 'proven' && inert.changeChannel === 'armed' && swallowArm.changeChannel === 'armed',
    `delivered=${String(zero.changeChannel)} inert=${String(inert.changeChannel)} swallow=${String(swallowArm.changeChannel)}`)
  // G-2 (P4, the hard precondition for closure): the full recovery path inside the
  // SAME silent arm — the drifted name's next call is REFUSED with no new Body, the
  // documented explicit re-bind restores it, and the third call EXECUTES with the
  // verification restored. Never extrapolatable from a delivered configuration.
  check('RW-CHANGE-INERT-PINNED-UNTIL-REBIND', 'P4/G-2: inside the silent arm itself the drifted name stays pinned until an explicit re-bind — the next call is refused with no new Body (v2 count unmoved), bindOwnTools restores execution and verification',
    inert.secondCallRefused === true && inert.secondCallV2 === inert.v2AfterFirstCall && inert.rebindOk === true
      && inert.thirdCallExecuted === true && inert.verifiedAfter === true && inert.verifiedAtCallEdge === false,
    `secondRefused=${String(inert.secondCallRefused)} secondV2=${String(inert.secondCallV2)} v2(first)=${String(inert.v2AfterFirstCall)} rebindOk=${String(inert.rebindOk)} thirdExec=${String(inert.thirdCallExecuted)} edge=${String(inert.verifiedAtCallEdge)} afterRebind=${String(inert.verifiedAfter)} rebindErr=${String(inert.rebindError)}`)
  // G-4: the swallow injection — subscription accepted, never disposed, emission not
  // forwarded — must produce the SAME loud evidence as the inert injection, plus the
  // event-stream counts the contract pins: the call edge records the definition-drift
  // downgrade, the Binding revision says verified=false, zero cancellation events, the
  // alarm severity, and the control subscription proves the registry really emitted
  // while this lane stayed 'armed'.
  check('RW-CHANGE-SWALLOWED-LOUD', 'P1-P3/G-4: a live-but-swallowed subscription behaves exactly like the silent channel — the moved Body runs and is loudly reported EXECUTED UNVERIFIED; the call edge records definition-drift and a Binding revised to unverified; zero cancellation events; the channel stays "armed" while the registry demonstrably emits',
    swallowArm.v2AfterFirstCall === 1 && swallowArm.executedUnvalidated >= 1 && swallowArm.executedUnvalidatedAlarms >= 1
      && swallowArm.changeAbortIssued === 0 && swallowArm.cancelledBeforeBody === 0
      && swallowArm.callEdgeDrift >= 1 && swallowArm.bindingRevisedUnverified >= 1
      && swallowArm.changeChannel === 'armed' && swallowArm.verifiedAtCallEdge === false
      && swallowArm.swallowControlEvents >= 1 && swallowArm.swallowProxyEmissions >= 1,
    `v2(first)=${String(swallowArm.v2AfterFirstCall)} unvalidated=${String(swallowArm.executedUnvalidated)} alarms=${String(swallowArm.executedUnvalidatedAlarms)} issued=${String(swallowArm.changeAbortIssued)} cancelled=${String(swallowArm.cancelledBeforeBody)} callEdgeDrift=${String(swallowArm.callEdgeDrift)} bindingRevised=${String(swallowArm.bindingRevisedUnverified)} control=${String(swallowArm.swallowControlEvents)} proxy=${String(swallowArm.swallowProxyEmissions)} channel=${String(swallowArm.changeChannel)}`)
  check('RW-CHANGE-SWALLOWED-PINNED-UNTIL-REBIND', 'G-4×G-2: the swallow arm measures the same full recovery path inside itself — next call refused with no new Body, explicit re-bind restores execution and verification — no extrapolation from any delivered configuration',
    swallowArm.secondCallRefused === true && swallowArm.secondCallV2 === swallowArm.v2AfterFirstCall && swallowArm.rebindOk === true
      && swallowArm.thirdCallExecuted === true && swallowArm.verifiedAfter === true,
    `secondRefused=${String(swallowArm.secondCallRefused)} secondV2=${String(swallowArm.secondCallV2)} v2(first)=${String(swallowArm.v2AfterFirstCall)} rebindOk=${String(swallowArm.rebindOk)} thirdExec=${String(swallowArm.thirdCallExecuted)}`)
  const hooks = results['guarded-after-hooks']
  check('RW-HOOKS-RESULT-IDENTITY', 'the cancelled call still reaches both result edges under its own callId with the Host\'s own code (hooks, telemetry and the durable session log see a call, not a hole)',
    hooks.cancelledBeforeBody >= 1 && hooks.edges.post.length >= 1 && hooks.edges.result.length >= 1
      && hooks.edges.post.every((row) => row.code === 'ABORTED_BEFORE_DISPATCH')
      && hooks.edges.result.every((row) => row.code === 'ABORTED_BEFORE_DISPATCH')
      && hooks.edges.post[0]?.callId === hooks.edges.result[0]?.callId,
    `edges=${JSON.stringify(hooks.edges)} cancelled=${String(hooks.cancelledBeforeBody)}`)

  const result = { runStamp: new Date().toISOString(), criteria, arms: results }
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
