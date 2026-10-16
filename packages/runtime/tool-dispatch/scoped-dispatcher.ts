/**
 * Alpha.5 PR1 (plan §4, design §4.1) — the STABLE SCOPED DISPATCHER and its
 * assembly state machine.
 *
 * THE MACHINE (PR0 froze the transitions; this is the runtime that walks
 * them, design §4.1 verbatim order):
 *
 *   UNBOUND → PREPARING → ACTIVE → DRAINING → TOMBSTONED → RELEASED
 *
 *  - PREPARING — the Guard is installed FIRST, the inherited-name mask
 *    SECOND, the stable Dispatcher Definition LAST (`install.ts` owns that
 *    order); a required Service that is not READY fails the assembly — a
 *    Cordis fiber that merely sits PENDING is NOT "assembled" (NEG-8 in the
 *    PoC: missing services surface as a silent PENDING fiber with an empty
 *    tool surface, which looks like success from the outside).
 *    Any failure goes `PREPARING → UNBOUND` and the Agent is NOT published;
 *  - ACTIVE — the registered ToolDefinition shape never changes. A policy /
 *    binding CHANGE flips an immutable REVISION inside the Binding
 *    ({@link ScopedDispatcher.revise}); the name is never unloaded to "let
 *    the native body come back" (NEG-1 is exactly that shape);
 *  - DRAINING — NEW calls and new Asks are refused from the first instant
 *    (`beginCall` refuses, the Guard refuses), in-flight calls are
 *    cancellation-requested, and the mask STAYS;
 *  - TOMBSTONED — stale references to the old Agent object keep meeting the
 *    same refusal (late callbacks, deferred result projection);
 *  - RELEASED — reachable ONLY when the Dispatcher's OWN counter of
 *    outstanding calls/leases is zero.
 *
 * THE SELF-COUNT IS THE POINT (plan §4: "必须记录自己持有的 lease/token 数，
 * 而非仅检查 Cordis Dispose 已返回"). `dispose()` returning is an upstream
 * fact about upstream bookkeeping; it proves nothing about a body that is
 * still running, a promise that has not settled, or a ToolRuntime that
 * re-resolved a late dispatch. So this object counts what IT handed out,
 * refuses to reach RELEASED while its own count is non-zero, and reports the
 * refusal as the §5 `EXECUTION_TERMINATION_UNCONFIRMED` error with
 * `sideEffectUnknown: true` — never as a silent "released".
 *
 * Purity: no `node:*`, no I/O, no timers, no DSH import. The caller (the
 * live glue / the install) owns the seams, the timers and the mask; this
 * module owns the ordering law.
 *
 * @module @dsh-agent-team/runtime/tool-dispatch/scoped-dispatcher
 */

import {
  BINDING_TRANSITIONS,
  type BindingState,
  type GovernanceError,
  type GovernanceResult,
  type ToolBinding,
} from '../../domain/tool-governance/src/index.js'
import {
  createGovernedSurface,
  guardDecision,
  type GovernedUnverifiedReason,
  type GuardExecView,
  type GovernedOrigin,
  type GovernedSurface,
  type GuardVerdict,
  type InheritedSurfaceBinding,
} from './closed-world-guard.js'

/** One outstanding call the Dispatcher handed out (self-counted). */
export interface CallToken {
  readonly callId: string
  readonly toolName: string
  /** Flipped by `requestCancellation` — the body's own abort signal source. */
  cancellationRequested: boolean
}

/** The observations this Dispatcher emits (the evidence channel). */
export type DispatcherObservation = Readonly<Record<string, unknown>> & { readonly event: string }

/**
 * What the name resolves to AT THE MOMENT OF THE CALL, as read through the
 * Host's public `tools.get(name, scope)` seam.
 *
 * The Resolver is an assembly-supplied function, held by the Dispatcher, so
 * the definition check sits on the decision path itself and no caller can
 * forget to perform it. An assembly that cannot supply one gets
 * `{ ok: false }` for every call, which is a REFUSAL: PR1 Gate R2 forbids
 * "could not read the definition, so assume the Body did not change".
 */
export type DefinitionProbe =
  | { readonly ok: true; readonly fingerprint: string }
  | { readonly ok: false; readonly detail: string }

/** Options of {@link createScopedDispatcher}. */
export interface ScopedDispatcherOptions {
  readonly agentScopeKey: string
  readonly trustedIdentities: readonly string[]
  /** The generations ACTIVE calls are validated against (re-read per call). */
  policyGeneration?: number
  authorityGeneration?: number
  readonly nativeProviderId?: string
  /** The assembly's explicit trusted native list (see `GovernedSurfaceOptions`). */
  readonly nativeNames?: readonly string[]
  /** Read the CURRENT definition of one name at the public seam (F2). */
  readonly resolveDefinition?: (name: string) => DefinitionProbe
  /**
   * How many public seams a correct assembly must have armed before it may
   * publish (the Guard plus its waterfall edges). The install declares each as
   * it arms it; a shortfall is an assembly failure, never a degraded Guard
   * (PR1 Gate R3). Default 5 = guard + pre-execute + execute + post-execute +
   * result.
   */
  readonly requiredSeams?: number
  readonly onObserve?: (observation: DispatcherObservation) => void
}

/** The handle the assembly installs and later drains. */
export interface ScopedDispatcher {
  readonly surface: GovernedSurface
  readonly state: () => BindingState
  readonly active: () => boolean
  /** The Guard body to register on the public `tools.guard` seam. */
  readonly guard: (exec: GuardExecView) => string | undefined
  /** The per-call verdict (exposed for tests and the dispatcher body path). */
  readonly decide: (exec: GuardExecView) => GuardVerdict
  /**
   * Seam bookkeeping (PR1 Gate R3). `armSeam` is called by the install for each
   * public seam it successfully registers; `publish` refuses while the count is
   * short, so a Guard that silently lost an edge cannot present itself as an
   * assembled one — and a permanently short count is a failure the caller sees,
   * not a `RELEASED` that quietly happens anyway.
   */
  readonly armSeam: (seam: string) => void
  readonly disarmSeam: (seam: string) => void
  readonly seamsArmed: () => readonly string[]
  readonly requiredSeams: () => number
  readonly beginAssembly: () => GovernanceResult<void>
  readonly failAssembly: (reason: string) => GovernanceResult<void>
  readonly publish: () => GovernanceResult<void>
  readonly beginDrain: () => GovernanceResult<void>
  readonly tombstone: () => GovernanceResult<void>
  readonly release: () => GovernanceResult<{ readonly releasedWithZeroInFlight: true }>
  readonly beginCall: (callId: string, toolName: string) => GovernanceResult<CallToken>
  readonly endCall: (token: CallToken) => void
  /**
   * End the lease one EXECUTION holds, by its callId. The result edge
   * (`tools/post-execute`) sees the execution, not the token this Dispatcher
   * handed out, so it ends by identity. An unknown callId is a no-op: the
   * result edge also fires for calls that never reached dispatch (a Guard
   * denial, for instance), and those never took a lease.
   */
  /**
   * End one lease by its callId, with the REASON that authorises it:
   *  - `'refused'` — a Gate of ours turned this call away, so its Body
   *    provably never ran. This ends the lease in ANY state: it is not evidence
   *    we are accepting from the host, it is a fact we created, and a call we
   *    refused must not be the reason a teardown can never finish.
   *  - `'settled'` (default) — the host says the call settled. Accepted ONLY
   *    while ACTIVE: after the drain began, a callback crossing that boundary
   *    cannot be authenticated as "the Body returned before the state changed"
   *    (PR1 Gate R4), so it is recorded and refused, and the half-state stands.
   */
  readonly endCallById: (
    callId: string,
    reason?: 'refused' | 'settled',
  ) => { readonly ended: boolean; readonly state: BindingState }
  /**
   * A result exists for this call (the `tools/post-execute` edge). This is
   * DIAGNOSTIC ONLY and never ends a lease: on the pinned registry a result can
   * be in hand while the Body is still alive, so treating it as termination is
   * the NEG-1 hazard again. The lease ends at `tools/result`, the edge the
   * registry dispatches after the Body settled.
   */
  readonly noteResultObserved: (callId: string) => void
  /**
   * The caller (the assembly, which owns the clock) says it stopped waiting for
   * a drain to settle. The lane reads no timer, so the decision is handed in:
   * from here `release()` refuses permanently and the mask and Guard stay
   * armed — the half-state is `EXECUTION_TERMINATION_UNCONFIRMED` FOREVER,
   * which is the safe side of "never disarms on an unproven termination".
   */
  readonly noteDrainGiveUp: (reason: string) => GovernanceResult<void>
  readonly drainGiveUpReason: () => string | null
  readonly requestCancellation: () => void
  readonly inFlight: () => number
  readonly outstandingCallIds: () => readonly string[]
  /** The host told us its dispose returned — recorded, NEVER sufficient. */
  readonly noteHostDisposeReturned: () => void
  readonly hostDisposeReturned: () => boolean
  /** The ONLY state in which lifting the inherited-name mask is legal. */
  readonly maskMayLift: () => boolean
  readonly bindInheritedSurface: (
    names: readonly string[],
    resolved: Readonly<Record<string, string>>,
    trusted: Readonly<Record<string, string>>,
  ) => InheritedSurfaceBinding
  /**
   * The call EDGE re-check (the residual round's R-b posture). The pinned
   * registry resolves the Body of a call INSIDE its innermost step — after the
   * Guard stage and after every `tools/execute` listener — so a legal
   * re-registration in that last gap can put a Body on the wire that no public
   * seam ever saw. Nothing can refuse it there (the exact seam gap is recorded
   * in the PR1-residual §12 in PoC-1 form), so this lane refuses it as early as
   * it CAN be refused: at the settled edge of the very call that carried it.
   * The verification is withdrawn on the spot, so the exposure is bounded at one
   * call and can never repeat without an explicit re-bind by the assembly.
   */
  readonly noteCallEdgeDefinition: (name: string) => {
    readonly checked: boolean
    readonly moved: boolean
    readonly detail: string
  }
  readonly bind: (input: {
    readonly name: string
    readonly origin: GovernedOrigin
    readonly binding: ToolBinding
    readonly verified?: boolean
    readonly unverifiedReason?: GovernedUnverifiedReason
  }) => GovernanceResult<void>
  /** Binding CHANGE = a new immutable revision under the same identity. */
  readonly revise: (
    name: string,
    change: {
      readonly policyGeneration?: number
      readonly authorityGeneration?: number
      readonly assurance?: ToolBinding['assurance']
      readonly verified?: boolean
    },
  ) => GovernanceResult<void>
  /**
   * Re-validation after a `tools/change` event: a diagnosis plus a
   * DOWNGRADE, never a grant. Names that appeared are reported (and stay
   * outside the closed world); names whose CURRENT definition no longer matches
   * what their Binding pinned are REVISED DOWN to unverified, which is the
   * "refuse + re-bind" half of PR1 Gate R2 and the only way a drifted name gets
   * verified again — an explicit re-bind by the trusted assembly.
   */
  readonly revalidateSurface: (
    observedNames: readonly string[],
    identities?: Readonly<Record<string, string>>,
  ) => {
    readonly added: readonly string[]
    readonly removed: readonly string[]
    readonly unverified: readonly string[]
    readonly drifted: readonly string[]
  }
  readonly policyGeneration: () => number
  readonly authorityGeneration: () => number
}

const unverified = (code: GovernanceError['code'], message: string, sideEffectUnknown = false): GovernanceResult<never> => ({
  ok: false,
  error: sideEffectUnknown ? { code, message, sideEffectUnknown: true } : { code, message },
})

/** Create one Team Agent's Dispatcher (per-agent closure, zero module state). */
export function createScopedDispatcher(options: ScopedDispatcherOptions): ScopedDispatcher {
  const surface = createGovernedSurface({
    agentScopeKey: options.agentScopeKey,
    nativeProviderId: options.nativeProviderId,
    nativeNames: options.nativeNames,
    policyGeneration: options.policyGeneration ?? 0,
    authorityGeneration: options.authorityGeneration ?? 0,
  })
  const observe = options.onObserve ?? ((): void => {})

  let status: BindingState = 'UNBOUND'
  let policyGeneration = options.policyGeneration ?? 0
  let authorityGeneration = options.authorityGeneration ?? 0
  const tokens = new Map<string, CallToken>()
  const seams = new Set<string>()
  const requiredSeams = options.requiredSeams ?? 5
  const resultsObserved = new Set<string>()
  let hostDisposeReturned = false
  let drainGiveUpReason: string | null = null

  const transition = (to: BindingState, event: string): GovernanceResult<void> => {
    // The transition LAW is PR0's frozen table (REUSE, not a second machine):
    // an illegal order — unmask-before-drain, release-with-in-flight,
    // re-activate-from-draining — comes back as a typed refusal, never a
    // throw and never a silent acceptance.
    const allowed = BINDING_TRANSITIONS[status]
    if (!allowed.includes(to)) {
      const detail = `'${status}' may only advance to: ${allowed.join(', ') || 'none'}`
      observe({ event: 'dispatcher-transition-refused', from: status, to, detail })
      return unverified('TOOL_BINDING_UNVERIFIED', `dispatcher state ${status} → ${to} is not a legal transition (${detail})`)
    }
    status = to
    observe({ event, to })
    return { ok: true, value: undefined }
  }

  /**
   * THE ONE CHANGE CHANNEL (design §4.1): a Binding change is a new immutable
   * REVISION under the same stable identity, never an unload. It is defined
   * here, once, because PR1 Gate R2 found the public `revise` with NO production
   * caller — a change channel nobody calls is a change channel that does not
   * exist. Both live paths now go through it: the per-call definition-drift
   * detector (which withdraws the verification it just invalidated) and the
   * `tools/change` revalidation.
   */
  const reviseImpl = (
    name: string,
    change: {
      readonly policyGeneration?: number
      readonly authorityGeneration?: number
      readonly assurance?: ToolBinding['assurance']
      readonly verified?: boolean
      readonly unverifiedReason?: GovernedUnverifiedReason
    },
  ): GovernanceResult<void> => {
    const entry = surface.entryOf(name)
    if (entry === undefined) {
      return unverified('TEAM_TOOL_UNGOVERNED', `revise("${name}"): the name is not governed`)
    }
    const next: ToolBinding = Object.freeze({
      ...entry.binding,
      revision: entry.revision + 1,
      ...(change.policyGeneration === undefined ? {} : { policyGeneration: change.policyGeneration }),
      ...(change.authorityGeneration === undefined ? {} : { authorityGeneration: change.authorityGeneration }),
      ...(change.assurance === undefined ? {} : { assurance: change.assurance }),
    })
    const verified = change.verified ?? entry.verified
    const outcome = surface.bind({
      name,
      origin: entry.origin,
      binding: next,
      verified,
      // A revision that lands UNVERIFIED states why. In this lane a revision is
      // only ever downgraded because the definition moved, unless the caller
      // (the call-edge re-check below) says otherwise.
      ...(verified ? {} : { unverifiedReason: change.unverifiedReason ?? 'definition-drift' }),
    })
    if (!outcome.ok) {
      observe({ event: 'dispatcher-revise-refused', tool: name, detail: outcome.error.message })
      return outcome
    }
    if (change.policyGeneration !== undefined) policyGeneration = change.policyGeneration
    if (change.authorityGeneration !== undefined) authorityGeneration = change.authorityGeneration
    observe({ event: 'dispatcher-binding-revised', tool: name, revision: next.revision, verified, unloaded: false })
    return { ok: true, value: undefined }
  }

  /** Withdraw a Binding's verification as a new immutable revision. */
  const reviseEntry = (name: string): GovernanceResult<void> => reviseImpl(name, { verified: false })

  /**
   * The R-b call-edge posture, in one place: after a call SETTLED, look the name
   * up again through the same public seam and, if what it resolves to now is not
   * what this Binding pinned, withdraw the verification NOW — not at some later
   * call that already had to re-read it. `moved` is the honest word for "the
   * Body this call ran may not have been the one the Guard validated"; the seam
   * that would let this lane refuse earlier is recorded as missing in the
   * PR1-residual §12 (PoC-1 format).
   */
  const noteCallEdgeDefinition = (name: string): { checked: boolean; moved: boolean; detail: string } => {
    const entry = surface.entryOf(name)
    if (entry === undefined) return { checked: false, moved: false, detail: `no Binding for "${name}" on this surface` }
    if (!entry.verified) return { checked: false, moved: false, detail: `the Binding for "${name}" is already unverified` }
    const probe = readDefinition(name)
    if (!probe.ok) {
      const revised = reviseImpl(name, { verified: false, unverifiedReason: 'definition-unreadable' })
      observe({
        event: 'dispatcher-definition-change-at-call-edge',
        tool: name,
        moved: true,
        reason: 'definition-unreadable',
        pinned: entry.binding.definitionIdentity,
        downgraded: revised.ok,
      })
      return { checked: true, moved: true, detail: probe.detail }
    }
    if (probe.fingerprint === entry.binding.definitionIdentity) {
      return { checked: true, moved: false, detail: 'the settled edge still resolves the Definition this Binding pinned' }
    }
    const revised = reviseImpl(name, { verified: false, unverifiedReason: 'definition-drift' })
    observe({
      event: 'dispatcher-definition-change-at-call-edge',
      tool: name,
      moved: true,
      reason: 'definition-drift',
      pinned: entry.binding.definitionIdentity,
      current: probe.fingerprint,
      downgraded: revised.ok,
      note: 'the definition moved between the Guard stage and this call edge; the verification is withdrawn at THIS call, so at most one Body ran un-validated and none can follow it without an explicit re-bind',
    })
    return { checked: true, moved: true, detail: `pinned=${entry.binding.definitionIdentity} now=${probe.fingerprint}` }
  }

  const readDefinition = (name: string): DefinitionProbe => {
    const resolver = options.resolveDefinition
    if (resolver === undefined) {
      return { ok: false, detail: 'the assembly installed no tools.get resolver, so no definition identity is readable at a public seam' }
    }
    try {
      const probe = resolver(name)
      if (probe.ok === true && typeof probe.fingerprint === 'string' && probe.fingerprint.length > 0) return probe
      if (probe.ok === false && typeof probe.detail === 'string') return probe
      return { ok: false, detail: 'the definition resolver returned neither a fingerprint nor a reason' }
    } catch (error) {
      return { ok: false, detail: `the definition resolver threw: ${String((error as Error)?.message ?? error)}` }
    }
  }

  const decide = (exec: GuardExecView): GuardVerdict => {
    // The definition read happens HERE, on the decision path, once per call:
    // a Binding verifies a BODY, and only the registry knows which body the
    // name resolves to right now.
    const entry = surface.entryOf(exec.name)
    const probe = readDefinition(exec.name)
    const drifted =
      entry !== undefined && entry.verified && probe.ok && probe.fingerprint !== entry.binding.definitionIdentity
    const verdict = guardDecision({
      exec,
      scope: { agentScopeKey: options.agentScopeKey, trustedIdentities: options.trustedIdentities },
      surface,
      active: status === 'ACTIVE',
      policyGeneration,
      authorityGeneration,
      definition: probe,
    })
    if (drifted && entry !== undefined) {
      // Refuse AND downgrade, in that order: the verdict the caller sees names
      // the precise fact (the definition drifted), while the downgrade makes it
      // permanent — the old verification is burned and only an explicit re-bind
      // by the trusted assembly restores it (PR1 Gate R2's re-binding flow, and
      // the reason `revise` is not dead code).
      const revised = reviseEntry(exec.name)
      observe({
        event: 'dispatcher-definition-drift',
        tool: exec.name,
        pinned: entry.binding.definitionIdentity,
        current: probe.ok ? probe.fingerprint : null,
        downgraded: revised.ok,
      })
    }
    return verdict
  }

  const guard = (exec: GuardExecView): string | undefined => {
    const verdict = decide(exec)
    if (verdict.kind === 'abstain') return undefined
    observe({
      event: 'guard-denial',
      tool: exec.name,
      reason: verdict.reason,
      code: verdict.error.code,
      state: status,
    })
    return verdict.error.message
  }

  return {
    surface,
    state: () => status,
    active: () => status === 'ACTIVE',
    guard,
    decide,
    armSeam: (seam) => {
      seams.add(seam)
      observe({ event: 'dispatcher-seam-armed', seam, armed: seams.size, required: requiredSeams })
    },
    disarmSeam: (seam) => {
      seams.delete(seam)
      observe({ event: 'dispatcher-seam-disarmed', seam, armed: seams.size })
    },
    seamsArmed: () => [...seams].sort(),
    requiredSeams: () => requiredSeams,
    beginAssembly: () => transition('PREPARING', 'dispatcher-preparing'),
    failAssembly: (reason) => {
      const outcome = transition('UNBOUND', 'dispatcher-assembly-failed')
      if (outcome.ok) observe({ event: 'dispatcher-assembly-failed', reason, published: false })
      return outcome
    },
    publish: () => {
      // R3: the machine may not open for traffic on a partial assembly. A
      // missing seam means a whole class of calls is unwatched, and that is a
      // failure the caller must see — never a smaller Guard that still claims
      // to be the Guard.
      if (seams.size < requiredSeams) {
        const missing = requiredSeams - seams.size
        observe({ event: 'dispatcher-publish-refused', armed: [...seams].sort(), required: requiredSeams })
        return unverified(
          'TOOL_BINDING_UNVERIFIED',
          `cannot publish: ${missing} of ${requiredSeams} required public seam(s) are not armed (armed: ${[...seams].sort().join(', ') || 'none'}) — a partial assembly is a failed assembly`,
        )
      }
      return transition('ACTIVE', 'dispatcher-active')
    },
    beginDrain: () => {
      const outcome = transition('DRAINING', 'dispatcher-draining')
      if (!outcome.ok) return outcome
      // REFUSE NEW CALLS FIRST, then request cancellation of the in-flight
      // ones (design §4.1 DRAINING). The mask is deliberately untouched.
      for (const token of tokens.values()) token.cancellationRequested = true
      observe({ event: 'dispatcher-drain-inflight', outstanding: tokens.size, mask: 'KEPT' })
      return { ok: true, value: undefined }
    },
    tombstone: () => transition('TOMBSTONED', 'dispatcher-tombstoned'),
    release: () => {
      if (drainGiveUpReason !== null) {
        observe({ event: 'dispatcher-release-refused', reason: 'drain-given-up', detail: drainGiveUpReason })
        return unverified(
          'EXECUTION_TERMINATION_UNCONFIRMED',
          `cannot release: the drain was given up (${drainGiveUpReason}) without proof that every Body terminated; the mask and Guard stay armed and this Dispatcher never reports RELEASED`,
          true,
        )
      }
      if (tokens.size > 0) {
        // The self-count is the whole point: an upstream dispose that already
        // RETURNED does not settle a body that has not finished.
        observe({ event: 'dispatcher-release-refused', outstanding: [...tokens.keys()], hostDisposeReturned })
        return unverified(
          'EXECUTION_TERMINATION_UNCONFIRMED',
          `cannot release: ${tokens.size} self-counted call lease(s) are still outstanding (${[...tokens.keys()].join(', ')})${hostDisposeReturned ? ' — the host dispose RETURNED, which is not termination evidence' : ''}`,
          true,
        )
      }
      const outcome = transition('RELEASED', 'dispatcher-released')
      if (!outcome.ok) return outcome
      observe({ event: 'dispatcher-released', hostDisposeReturned, maskLiftable: true })
      return { ok: true, value: { releasedWithZeroInFlight: true } }
    },
    beginCall: (callId, toolName) => {
      if (status !== 'ACTIVE') {
        return unverified('ADAPTER_DRAINING', `dispatcher is ${status}; new calls (including Asks) are refused: ${toolName}`)
      }
      const existing = tokens.get(callId)
      if (existing !== undefined) {
        return unverified('TOOL_BINDING_UNVERIFIED', `callId "${callId}" already holds an outstanding lease (no double entry)`)
      }
      const token: CallToken = { callId, toolName, cancellationRequested: false }
      tokens.set(callId, token)
      observe({ event: 'dispatcher-call-begin', callId, tool: toolName, inFlight: tokens.size })
      return { ok: true, value: token }
    },
    endCall: (token) => {
      const current = tokens.get(token.callId)
      if (current === undefined || current !== token) return
      tokens.delete(token.callId)
      observe({ event: 'dispatcher-call-end', callId: token.callId, tool: token.toolName, inFlight: tokens.size })
    },
    endCallById: (callId, reason = 'settled') => {
      const current = tokens.get(callId)
      if (current === undefined) return { ended: false, state: status }
      if (reason === 'refused') {
        // Our own refusal is the one termination we can prove: the Body was
        // never reached. The lease ends and the drain may finish.
        tokens.delete(callId)
        resultsObserved.delete(callId)
        observe({ event: 'dispatcher-call-refused', callId, tool: current.toolName, state: status, inFlight: tokens.size })
        return { ended: true, state: status }
      }
      if (status !== 'ACTIVE') {
        // A settled callback that arrives after the drain began is NOT
        // termination evidence for this Dispatcher: from the first instant of
        // DRAINING the assembly owns the termination decision, and a callback
        // crossing that boundary cannot be authenticated as "the Body returned
        // before the state changed". The lease stays, the mask stays.
        observe({ event: 'dispatcher-late-settled-after-teardown', callId, tool: current.toolName, state: status })
        return { ended: false, state: status }
      }
      tokens.delete(callId)
      resultsObserved.delete(callId)
      observe({ event: 'dispatcher-call-end', callId, tool: current.toolName, inFlight: tokens.size })
      return { ended: true, state: status }
    },
    noteResultObserved: (callId) => {
      if (!tokens.has(callId)) return
      resultsObserved.add(callId)
      observe({ event: 'dispatcher-result-observed', callId, inFlight: tokens.size, note: 'a result exists; the Body return is not yet proven, so the lease stays' })
    },
    noteDrainGiveUp: (reason) => {
      drainGiveUpReason = typeof reason === 'string' && reason.length > 0 ? reason : 'the caller stopped waiting'
      observe({
        event: 'dispatcher-drain-given-up',
        detail: drainGiveUpReason,
        outstanding: [...tokens.keys()],
        resultObservedButUnproven: [...resultsObserved].filter((id) => tokens.has(id)),
        mask: 'KEPT',
      })
      return { ok: true, value: undefined }
    },
    drainGiveUpReason: () => drainGiveUpReason,
    requestCancellation: () => {
      for (const token of tokens.values()) token.cancellationRequested = true
      observe({ event: 'dispatcher-cancellation-requested', outstanding: tokens.size })
    },
    inFlight: () => tokens.size,
    outstandingCallIds: () => [...tokens.keys()],
    noteHostDisposeReturned: () => {
      hostDisposeReturned = true
      observe({ event: 'dispatcher-host-dispose-returned', outstanding: tokens.size })
    },
    hostDisposeReturned: () => hostDisposeReturned,
    maskMayLift: () => status === 'RELEASED',
    bindInheritedSurface: (names, resolved, trusted) => {
      const result = surface.bindInheritedSurface(names, resolved, trusted)
      // LOUD, by construction: whatever was observed but could not be trusted
      // is reported the moment the surface is taken, not at first call.
      observe({
        event: 'dispatcher-bind-inherited',
        surface: names.length,
        verified: result.verifiedBound,
        unverified: result.unverified,
      })
      if (result.shadowed.length > 0) {
        // R-a gets its own event: these are names the assembly BELIEVED were
        // native, each with the two identities that said otherwise.
        observe({
          event: 'dispatcher-native-shadowed',
          names: result.shadowed.map((row) => row.name),
          detail: result.shadowed.map((row) => `${row.name}: trusted=${row.trusted} resolved=${row.resolved}`).join(', '),
        })
      }
      if (result.nativeUnreadable.length > 0) {
        observe({
          event: 'dispatcher-native-unreadable',
          names: result.nativeUnreadable,
          detail: 'the trusted (global) side of the definition read was unavailable for these names',
        })
      }
      return result
    },
    bind: ({ name, origin, binding, verified = true, unverifiedReason }) => {
      const outcome = surface.bind({
        name,
        origin,
        binding,
        verified,
        ...(unverifiedReason === undefined ? {} : { unverifiedReason }),
      })
      if (!outcome.ok) observe({ event: 'dispatcher-bind-refused', tool: name, code: outcome.error.code })
      return outcome.ok ? { ok: true, value: undefined } : outcome
    },
    revise: (name, change) => reviseImpl(name, change),
    noteCallEdgeDefinition,
    revalidateSurface: (observedNames, identities) => {
      const observed = new Set(observedNames)
      const governed = new Set(surface.names())
      const added = [...observed].filter((n) => !governed.has(n)).sort()
      const removed = [...governed].filter((n) => !observed.has(n)).sort()
      const drifted: string[] = []
      if (identities !== undefined) {
        for (const name of governed) {
          if (!observed.has(name)) continue
          const entry = surface.entryOf(name)
          const fingerprint = identities[name]
          if (entry === undefined || typeof fingerprint !== 'string') continue
          if (fingerprint === entry.binding.definitionIdentity) continue
          const revised = reviseEntry(name)
          if (revised.ok) drifted.push(name)
        }
        if (drifted.length > 0) {
          observe({ event: 'dispatcher-revalidate-drift', drifted, note: 'definitions no longer match their Bindings; the old verification is withdrawn and only an explicit re-bind restores it' })
        }
      }
      const unverifiedNames: string[] = [...drifted].sort()
      for (const name of added) {
        // A `tools/change` event may ONLY re-diagnose. It never binds (that
        // would let a hot registration govern itself) and it never allows:
        // the added name stays OUTSIDE the closed world, so every call to it
        // is denied `TEAM_TOOL_UNGOVERNED` until the trusted assembly binds
        // it. `removed` is recorded for the Coverage diff only — removing a
        // governed name never re-admits the native body.
        unverifiedNames.push(name)
      }
      observe({ event: 'dispatcher-surface-revalidated', added, removed, drifted, state: status })
      return { added, removed, unverified: unverifiedNames.sort(), drifted: drifted.sort() }
    },
    policyGeneration: () => policyGeneration,
    authorityGeneration: () => authorityGeneration,
  }
}
