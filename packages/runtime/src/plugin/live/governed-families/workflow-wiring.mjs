/**
 * A5M2 B-ORCHESTRATION EXECUTION CONSUMER (record 47 workflow ALWAYS /
 * record 48 ralph conditional by capture presence) — the real wiring arm
 * the frozen adapters (workflow-adapters.mjs @a749cd4cb + fail-closed
 * cancel 9826881c) were waiting for. Root 637842 correction honored:
 * the real tool source is the FIXED HOST's own registration — the host
 * plugin registers the workflow tool via `ctx.tools.register(defineTool(…))`
 * (tool-workflow/src/index.ts:329 @639ed01539; ralph at
 * tool-ralph/src/index.ts:411) — so this consumer captures the REAL
 * native + the ORIGINAL exec off the scoped tools face (agentCtx.tools.get)
 * and governs OUTERMOST per Plan B: one PA admission per call before the
 * original body (which itself calls ctx.workflowEngine.start :282/:433/
 * :445) is entered. Child-level governance is NOT claimed here — the
 * exact source breakpoints: the public engine run face is
 * result/cancel/dispose (workflow/workflow/src/runtime-types.ts:40-48)
 * and the ONLY child census in the pinned source is the settled
 * agentsStarted invariant check (workflow/workflow/src/invariant.ts:53-
 * 54); the production non-PTC engine is not shipped in the pinned venue
 * (only workflow-ptc + test stubs) — so per-child independent admission
 * stays the NAMED engine/CENTER obligation (workflow-adapters.mjs:149-150),
 * carried truthfully on every minted manifest, never papered over.
 *
 * Sibling law (subagent-wiring.mjs, the proven shape): the `admit` seat
 * is OWNED here (the real PA walk occupies it — the plane's own
 * paAdmit funnel, the aa522 unique-consumption law); parse through the
 * domain's CANONICAL parser and ride ITS value; re-check the world AFTER
 * the await; funnel bytes pass through VERBATIM; mount =
 * agentCtx.tools.register per definition with rollback; dispose = drain
 * FIRST (adapter semantics verbatim), then reversed disposers, exactly
 * once, idempotent. Zero-flip: ralph rows only appear when a REAL
 * capture+delegate is handed in (host-preset-off worlds → the adapter's
 * own honest DECLARED row, untouched law).
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/workflow-wiring
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import {
  A5_B_ORCHESTRATION_ADAPTER_REVISION,
  A5_B_ORCHESTRATION_RECORD_SPECS,
  createWorkflowAdapterAssembly,
} from './workflow-adapters.mjs'

export const A5_B_ORCH_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_ORCH_WIRE_INPUT_INVALID',
  ADMISSION_SEAT_OWNED: 'P_B_ORCH_WIRE_ADMISSION_SEAT_OWNED',
  PA_ABSENT: 'P_B_ORCH_WIRE_PA_ABSENT',
  DISPOSED: 'P_B_ORCH_WIRE_DISPOSED',
  CALL_ID_ABSENT: 'P_B_ORCH_WIRE_CALL_ID_ABSENT',
  REALM_ABSENT: 'P_B_ORCH_WIRE_REALM_ABSENT',
  CANCELLED: 'P_B_ORCH_WIRE_CANCELLED',
  EFFECTS_UNPARSABLE: 'P_B_ORCH_WIRE_EFFECTS_UNPARSABLE',
  PA_FAULT: 'P_B_ORCH_WIRE_PA_FAULT',
  DENIED: 'P_B_ORCH_WIRE_DENIED',
  CHILD_GOVERNANCE_UNGOVERNED: 'P_B_ORCH_WIRE_CHILD_GOVERNANCE_UNGOVERNED',
  MOUNT_ALREADY_PLACED: 'P_B_ORCH_WIRE_MOUNT_ALREADY_PLACED',
  PLACEMENT_CONFLICT: 'P_B_ORCH_WIRE_PLACEMENT_CONFLICT',
})

const CODES = A5_B_ORCH_WIRING_CODES

// THE CHILD-GOVERNANCE STATE is a RUNTIME FACT now, not a constant: the
// seat reads the governed-provider face (input.governedProvider) at every
// admit — a missing or inactive provider (an unpaired world, or a
// mis-deployed one where the engines still route global spawn) keeps EVERY
// call fail-closed with P_B_ORCH_WIRE_CHILD_GOVERNANCE_UNGOVERNED: the
// safety posture of c6a50abfa outlives the constant — it moved into the
// drift gate. The provider pairing (team-governed-provider.mjs) opens the
// seat ONLY for worlds whose engines route to it (the arm registers the
// provider and isActive answers its registered+ routed state).

const refuse = (code, detail) => ({ ok: false, code, detail })
const refuseAssembly = (code, message) => Object.freeze({ ok: false, code, message })
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

function deepFreeze (value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

/** THE RAW EFFECT REQUEST (closed, sibling law): the invoked tool itself
 *  — `tool-invoke` ONLY, resource null. The WALK rides the domain
 *  parser's canonicalized value, never a self-invented envelope. */
const rawEffectsFor = (toolName) => [{ kind: 'tool-invoke', toolName, resource: null }]

/** The truthful per-call target manifest mint: this family makes NO
 *  external address claim (a workflow/ralph call targets an engine RUN).
 *  The child-governance line is the MEASURED chain, not an assertion:
 *  every agent() child starts via the subagents SERVICE —
 *  workflow-ptc/src/host.ts:197-207 `startChild` calls
 *  `this.subagents.start(provider, {prompt, parent, signal, agentOptions?})`
 *  with NO admission callback between the decision and the start and NO
 *  toolFilter/scope passed; the child is a DISTINCT agent scope, so this
 *  plane's governed definitions (scoped registrations shadow globals,
 *  core/tools/src/index.ts:804) do NOT ride onto the child — the child's
 *  own tool calls answer the host GLOBAL face, not the rows. Cancel
 *  convergence is REAL at this seam (the child inherits the run
 *  controller signal, host.ts:202; run.cancel reaches children,
 *  workflow/src/runtime-types.ts:45-46); the only child census is the
 *  settled agentsStarted invariant (workflow/src/invariant.ts:53-54).
 *  Therefore per-child admission AT THE START MOMENT has no existing
 *  governance entry reachable from this tool seam — carried as the
 *  measured gap, never claimed closed, never papered over by the
 *  native's own authority. */
const mintTargetManifest = (name) => deepFreeze({
  addressClaim: null,
  record: A5_B_ORCHESTRATION_RECORD_SPECS[name]?.recordIndex,
  childGovernance: 'MEASURED GAP, NOT CLAIMED: children start via the subagents SERVICE (workflow-ptc/src/host.ts:197-207 startChild -> subagents.start with parent+signal, no admission callback, no toolFilter); children are distinct agent scopes so the plane rows do not ride them (core/tools/src/index.ts:804 scoped shadow is per-scope); cancel convergence via the inherited run signal IS real (host.ts:202, runtime-types.ts:45-46); the settled agentsStarted invariant is the only child census (invariant.ts:53-54)',
})

/**
 * Assembly-time wiring factory: mounts the frozen adapter VERBATIM and
 * occupies its required `admit` seat with the real PA walk.
 */
export function createBOrchestrationExecutionWiring (input = {}) {
  if (!isRecord(input)) return refuseAssembly(CODES.INPUT_INVALID, 'the wiring factory takes one input record')
  if (typeof input.admit === 'function' || 'admit' in input) {
    return refuseAssembly(CODES.ADMISSION_SEAT_OWNED, 'the admit seat is OWNED by this wiring (the real PA walk occupies it) — the adapter inputs minus admit, never admit itself')
  }
  if (typeof input.pa !== 'function') {
    return refuseAssembly(CODES.PA_ABSENT, 'pa is REQUIRED — this wiring ships NO unadmitted path (the plane paAdmit funnel rides the call)')
  }
  // The adapter REFUSES a missing admit (L10) — it is built ONCE with the
  // owned seat via a holder closed over the wiring state (the seat is the
  // real PA walk installed right below).
  const seat = { admit: () => refuse(CODES.ADMISSION_SEAT_OWNED, 'the seat was not installed — unreachable in a built wiring') }
  const assemblyWithSeat = createWorkflowAdapterAssembly({
    providerId: input.providerId,
    captured: input.captured,
    liveNative: input.liveNative,
    workflowDelegates: input.workflowDelegates,
    liveWorkflowDelegates: input.liveWorkflowDelegates,
    placementFeed: input.placementFeed,
    admit: (envelope) => seat.admit(envelope),
  })
  if (assemblyWithSeat.ok !== true) return assemblyWithSeat
  return buildWiring(input, assemblyWithSeat, seat)
}

function buildWiring (input, assembly, seat) {
  const pa = input.pa
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const state = { disposed: false, mountDisposers: null, walks: 0 }
  const closePlan = (callId) => { try { pa.closePlan?.(callId) } catch { /* funnel best-effort, sibling law */ } }
  const gp = isRecord(input.governedProvider) ? input.governedProvider : null
  const governedProviderLive = () => gp !== null
    && typeof gp.isActive === 'function' && gp.isActive() === true
    && gp.activeCalls instanceof WeakMap

  seat.admit = async (envelope) => {
    if (!governedProviderLive()) {
      // DRIFT GATE (pairing C, center card): the seat opens ONLY when the
      // Team-governed provider is REGISTERED and ROUTED (isActive is the
      // arm's real readback). An unpaired or mis-deployed world — engines
      // still resolving the global spawn name — stays exactly as the
      // c6a50abfa block left it: zero PA, zero body, masked and unreachable.
      return refuse(CODES.CHILD_GOVERNANCE_UNGOVERNED, 'the execution arm is FAIL-CLOSED: the Team-governed SubagentProvider is not registered-and-routed on this mount (root audit of 07bb0c95) — children would ride the parent preset generation WITHOUT this member\'s shadow/guard/deny layer (activationFence knows only root/durable-member childSessionIds; a fresh UUID has no row and passes; agentSetup never runs; child policy natively answers never), so ZERO calls enter, ZERO PA is consumed, and the masked native stays unreachable')
    }
    if (state.disposed) return refuse(CODES.DISPOSED, 'the wiring is disposed — no PA walk opens, no body entry, committed runs stay committed')
    const { name, recordIndex, familyId, classified, exec } = envelope
    const plan = classified?.plan
    if (classified?.ok !== true || !isRecord(plan) || typeof plan.parametersFingerprint !== 'string') {
      return refuse(CODES.INPUT_INVALID, 'the admit seat takes the adapter\'s own classified plan (the frozen parametersFingerprint is the walk identity)')
    }
    const callId = typeof exec?.callId === 'string' && exec.callId.length > 0 ? exec.callId : null
    if (callId === null) return refuse(CODES.CALL_ID_ABSENT, 'exec.callId is absent — the walk pairs on the live call id; a minted stand-in is refused')
    const signal = exec.signal
    if (signal?.aborted === true) return refuse(CODES.CANCELLED, 'the signal was already aborted before the walk opened — zero body entry')
    const fed = input.placementFeed(name)
    const realmId = isRecord(fed) && typeof fed.realmId === 'string' && fed.realmId.length > 0 ? fed.realmId : null
    if (realmId === null) return refuse(CODES.REALM_ABSENT, `the placement feed answered no realmId for '${name}' — the walk's realm identity is a placement fact, never a guess`)
    const parsed = parseRequestedEffectSet(rawEffectsFor(name))
    if (parsed?.ok !== true) {
      return refuse(CODES.EFFECTS_UNPARSABLE, `the domain parser refused the effect request for '${name}': ${String(parsed?.detail ?? parsed?.code ?? 'unparsable')}`)
    }
    const payload = deepFreeze({
      realmId,
      callId,
      parametersFingerprint: plan.parametersFingerprint,
      requestedEffects: parsed.value,
      toolName: name,
      family: {
        familyId,
        recordIndex,
        adapterRevision: A5_B_ORCHESTRATION_ADAPTER_REVISION,
        providerIdentity: assembly.providerId,
        targetManifest: mintTargetManifest(name),
      },
    })
    const walk = signal === undefined ? payload : Object.freeze({ ...payload, signal })
    state.walks += 1
    observe({ event: 'b-orchestration:wire:open', name, callId })
    let opened
    try {
      opened = await pa(walk)
    } catch (error) {
      closePlan(callId)
      observe({ event: 'b-orchestration:wire:fault', name, callId })
      return refuse(CODES.PA_FAULT, `the PA walk THREW and is never treated as an authorization: ${String(error?.message ?? error).slice(0, 180)}`)
    }
    if (state.disposed) {
      closePlan(callId)
      observe({ event: 'b-orchestration:wire:dropped', name, callId, detail: 'mount-torn-during-walk' })
      return refuse(CODES.DISPOSED, 'the wiring was disposed while PA was being asked; the answer is dropped and nothing enters the body')
    }
    if (opened?.cancelled === true) return refuse(CODES.CANCELLED, `the PA walk answered this invocation cancelled (call ${callId}): zero consumption, zero body entry`)
    if (signal?.aborted === true) return refuse(CODES.CANCELLED, `the signal aborted while PA was being asked (call ${callId}): this leg enters nothing`)
    if (opened?.kind !== 'allow') {
      // the funnel's OWN bytes ride VERBATIM — nothing appended, no recode
      return refuse(CODES.DENIED, String(opened?.detail ?? opened?.reason ?? `the PA walk did not answer allow for call ${callId}`))
    }
    // THE PAIRED HAND-OFF (provider PIN 1's source of truth): the admitted
    // call becomes the GOVERNED CONTEXT for children of THIS parent Agent —
    // the provider refuses any child whose parent carries no entry here.
    if (gp !== null && isRecord(exec.agent)) {
      gp.activeCalls.set(exec.agent, { callId, parametersFingerprint: plan.parametersFingerprint, realmId, toolName: name, ordinal: 0, providerIdentity: assembly.providerId })
    }
    return Object.freeze({ ok: true })
  }

  const dispose = () => {
    if (state.disposed) return Object.freeze({ event: 'b-orchestration:wire:dispose', semantics: 'already disposed — nothing re-runs' })
    state.disposed = true
    assembly.drain() // NEW-CALL PROHIBITION FIRST (adapter semantics verbatim)
    const run = state.mountDisposers === null ? [] : [...state.mountDisposers].reverse()
    state.mountDisposers = null
    for (const d of run) {
      try {
        if (typeof d === 'function') d()
        else if (typeof d?.dispose === 'function') d.dispose()
      } catch { /* best-effort, exactly once each, sibling law */ }
    }
    return Object.freeze({ event: 'b-orchestration:wire:dispose', disposers: run.length, semantics: 'new-call prohibition + placed definitions disposed; committed engine runs stay committed (drain settles/cancels nothing)' })
  }

  return Object.freeze({
    ok: true,
    familyId: assembly.familyId,
    adapterRevision: assembly.adapterRevision,
    providerId: assembly.providerId,
    definitions: assembly.definitions,
    placementNames: assembly.placementNames,
    rows: assembly.rows,
    declared: assembly.declared,
    rowOf: assembly.rowOf,
    inFlight: assembly.inFlight,
    walks: () => state.walks,
    familyRegistrations: () => assembly.familyRegistrations().map((registration) => Object.freeze({
      ...registration,
      entry: Object.freeze({ ...registration.entry }),
    })),
    mount: (agentCtx) => {
      if (state.disposed) return refuseAssembly(CODES.DISPOSED, 'mount after dispose is refused — the wiring is closed')
      if (state.mountDisposers !== null) {
        return refuseAssembly(CODES.MOUNT_ALREADY_PLACED, 'already placed — a second mount would re-register every name and orphan the first mount\'s disposers; dispose first or use a new wiring')
      }
      if (typeof agentCtx?.tools?.register !== 'function') {
        return refuseAssembly(CODES.INPUT_INVALID, 'mount needs the agent context tools.register face — placement goes through the REAL scoped tools surface, nothing else')
      }
      const disposers = []
      for (const definition of assembly.definitions) {
        try {
          disposers.push(agentCtx.tools.register(definition))
        } catch (error) {
          for (const d of disposers.reverse()) {
            try {
              if (typeof d === 'function') d()
              else if (typeof d?.dispose === 'function') d.dispose()
            } catch { /* rollback best-effort: the mount fails closed regardless */ }
          }
          observe({ event: 'b-orchestration:wire:placement-refused', name: definition.name })
          return Object.freeze({ ok: false, code: CODES.PLACEMENT_CONFLICT, name: definition.name, message: String(error?.message ?? error) })
        }
      }
      state.mountDisposers = disposers
      observe({ event: 'b-orchestration:wire:placed', names: assembly.placementNames })
      return Object.freeze({ ok: true, dispose: () => dispose() })
    },
    dispose: () => dispose(),
  })
}
