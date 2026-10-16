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
      if (!outcome.ok) throw new Error(`${mode}: install refused: ${outcome.error.code} ${outcome.error.message}`)
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

  const results = {}
  for (const mode of MODES) results[mode] = await arm(mode)
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
  // F2 ALONE, ISOLATED: with no `tools/change` channel at all, the per-call
  // definition read is the only thing that could refuse, and it must.
  check('RW-F2-ISOLATED', 'with the tools/change channel unavailable, the per-call definition read alone refuses a Body re-registered after validation (typed definition-drift, no fallback)',
    noChange.v2 === 0 && noChange.v1 === 0 && noChange.changeChannel === 'unavailable'
      && noChange.decisionInWindowReason === 'definition-drift' && noChange.verifiedAfter === false,
    `v1=${String(noChange.v1)} v2=${String(noChange.v2)} decideInWindow=${String(noChange.decisionInWindowKind)}/${String(noChange.decisionInWindowReason)} driftPerCall=${String(noChange.driftPerCall)} verifiedAfter=${String(noChange.verifiedAfter)} text=${noChange.text.slice(0, 90)}`)
  // THE SAME WINDOW with the diagnostic channel present: the outcome must not
  // depend on it (a `tools/change` event is not a safety mechanism).
  check('RW-PRE-EXECUTE-COVERED', 'the pre-execute window is covered: no Body of either version runs, with or without the tools/change channel',
    guarded.v2 === 0 && guarded.v1 === 0 && noChange.v2 === 0 && guarded.verifiedAfter === false,
    `withChange v1=${String(guarded.v1)} v2=${String(guarded.v2)} verifiedAfter=${String(guarded.verifiedAfter)} | noChange v1=${String(noChange.v1)} v2=${String(noChange.v2)}`)
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
  check('RW-RESIDUAL-RECORDED', 'boundary recorded: a re-registration after our door is invisible to every public seam before the late resolution (PoC-1 seam gap); exactly one un-validated Body ran, and the NEXT call is refused — the exposure is one call, never a standing state',
    after.v2 === 1 && after.v1 === 0 && after.secondCallV2 === 1 && after.verifiedAfter === false,
    `v1=${String(after.v1)} v2=${String(after.v2)} verifiedAfter=${String(after.verifiedAfter)} secondCall(v2=${String(after.secondCallV2)} text="${after.secondCallText?.slice(0, 70)}") obs=${after.obsTail.join('>')}`)

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
