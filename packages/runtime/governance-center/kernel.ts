/**
 * `governance-center/kernel` — the GovernanceKernel skeleton (U6 PR1;
 * center-assembly-architecture §3 component 3, §5 lifecycle state machine;
 * U6-SLICE-PLAN PR1: "Kernel = §5 state machine … driven by the existing
 * dispatcher lifecycle ports; one-shot grant consume via
 * `consumeForExecution` port").
 *
 * INERT-BY-CONSTRUCTION (PR1): nothing in this file enforces anything. It
 * OWNS the two things the center must own and nothing else:
 *
 *  - THE APPROVAL TABLE (sup-a §5 condition 1: "The center must maintain
 *    its own approval table. The caller (a Family) cannot approve itself
 *    into it"): entries are written only through the kernel-OWNER surface
 *    (`addApprovalEntry` / `replaceApprovalEntry`). What a Family-facing
 *    consumer receives is `familyFace()` — a surface that carries NO
 *    decide/approve/consume/register method at all, pinned by test.
 *  - THE ONE-SHOT GRANT CONSUME POINT (§ CI-06: only the center consumes a
 *    Grant). PR1 does NOT re-implement grant logic: consumption is composed
 *    through the INJECTED `grantConsume` port — in production that port's
 *    implementation is the existing tool-admission `consumeForExecution`
 *    face, injected by the trusted assembly point, never imported here.
 *    The kernel-side law it adds is only: exactly one attempt per grant id
 *    reaches the port (replay never re-arms the effect).
 *
 * STATE MACHINE (§5, slice-plan PR1 names):
 *
 *     PREPARING ─publish()→ ACTIVE ─beginDrain()→ DRAINING
 *        │                       │                    │ tombstone()
 *        │ fail(code)            │ fail(code)         ▼
 *        └──────────────→ FAILED ←───────      TOMBSTONED ─release()→ RELEASED
 *                                                 ▲   (only at a self-counted
 *                                                 └──── inflight zero — CI-08)
 *
 * Illegal transitions are typed refusals that change nothing (the CI-08 law
 * that `pa-mount-registry` already proves at the mount level, applied to the
 * kernel's own lifecycle). `release()` refuses while the injected lifecycle
 * port still counts in-flight work, and FAILED/RELEASED are terminal.
 *
 * NO EXECUTION, NO I/O, NO CLOCKS: the kernel is pure decision state; the
 * rows/listeners that feed it live in the live glue.
 *
 * @module governance-center/kernel
 */

import type { GovernedFamilyRegistry } from './registry.js'

export const KERNEL_STATES = ['PREPARING', 'ACTIVE', 'DRAINING', 'TOMBSTONED', 'RELEASED', 'FAILED'] as const
export type KernelState = (typeof KERNEL_STATES)[number]

export type KernelFailureCode =
  | 'ILLEGAL_TRANSITION'
  | 'LEASE_OPEN'
  | 'IDENTITY_UNVERIFIED'
  | 'IDENTITY_MISMATCH'
  | 'NOT_VERIFIED_SOURCE'
  | 'GRANT_REPLAY'
  | 'NO_CONSUME_PORT'
  | 'DUP_APPROVAL_ENTRY'
  | 'NO_APPROVAL_ENTRY'
  | 'STALE_GENERATION'

export type TransitionResult =
  | { readonly ok: true; readonly state: KernelState }
  | { readonly ok: false; readonly code: KernelFailureCode; readonly detail: string }

/** The three-state verdict (§4 "三态输出 allow / refuse / defer"). */
export type KernelVerdict = {
  readonly outcome: 'allow' | 'refuse' | 'defer'
  readonly code: KernelFailureCode | 'KERNEL_NOT_ACTIVE' | 'NO_APPROVAL_ENTRY' | 'OK'
  readonly detail: string
  readonly generation: number
}

export type CallFacts = {
  readonly nativeName: string
  /**
   * The definition-identity OBSERVATION for this call, produced by the
   * HostSurfaceAdapter from the Host's own scoped resolution (CI-04: an
   * identity the caller self-attests is not an identity). Absent = unreadable.
   */
  readonly definitionIdentity?: string
}

export type ApprovalEntry = {
  readonly nativeName: string
  readonly definitionIdentity: string
  readonly addedGeneration: number
}

/** The one port PR1 needs from the existing admission lane (§5 one-shot). */
export type GrantConsumePort = {
  /** Production implementation: tool-admission `consumeForExecution`. */
  readonly consumeForExecution: (
    grant: unknown,
    facts: Readonly<Record<string, unknown>>,
  ) => Promise<{ readonly ok: boolean; readonly reason?: string }>
}

/** The lifecycle feedback the dispatcher already counts (injected, opaque). */
export type DispatcherLifecyclePort = {
  /** In-flight calls the owning dispatcher still counts for this assembly. */
  readonly inflight: () => number
}

export type KernelPorts = {
  readonly grantConsume?: GrantConsumePort
  readonly lifecycle?: DispatcherLifecyclePort
}

/** What a Family consumer may hold: nothing but a marker in PR1. */
export type FamilyFace = Readonly<Record<string, never>>

export type GovernanceKernel = {
  readonly state: () => KernelState
  readonly publish: () => TransitionResult
  readonly beginDrain: () => TransitionResult
  readonly tombstone: () => TransitionResult
  readonly release: () => TransitionResult
  readonly fail: (code: string) => TransitionResult
  /** Kernel-OWNER surface (composition center only): bind a name to an identity. */
  readonly addApprovalEntry: (entry: { readonly nativeName: string; readonly definitionIdentity: string }) =>
    | { readonly ok: true; readonly generation: number }
    | { readonly ok: false; readonly code: KernelFailureCode; readonly detail: string }
  /** Kernel-OWNER surface: rebind with an expected-generation freshness check. */
  readonly replaceApprovalEntry: (entry: {
    readonly nativeName: string
    readonly definitionIdentity: string
    readonly expectedGeneration: number
  }) =>
    | { readonly ok: false; readonly code: KernelFailureCode; readonly detail: string }
    | { readonly ok: true; readonly generation: number }
  readonly approvalFor: (nativeName: string) => ApprovalEntry | undefined
  /** The ONLY verdict face; PR1 uses it for shadow accounting, never flow. */
  readonly decide: (call: CallFacts) => KernelVerdict
  /** One-shot consume through the injected port; replay NEVER reaches it twice. */
  readonly consumeOnce: (
    grant: unknown,
    grantId: string,
    facts?: Readonly<Record<string, unknown>>,
  ) => Promise<{ readonly ok: boolean; readonly code?: KernelFailureCode; readonly detail?: string; readonly portCalled: boolean }>
  /** The surface handed to a Family: no verdict, no authority (CI-06). */
  readonly familyFace: () => FamilyFace
}

const LEGAL: Readonly<Record<KernelState, readonly KernelState[]>> = {
  PREPARING: ['ACTIVE', 'FAILED'],
  ACTIVE: ['DRAINING', 'FAILED'],
  DRAINING: ['TOMBSTONED', 'FAILED'],
  TOMBSTONED: ['RELEASED'],
  RELEASED: [],
  FAILED: [],
}

export function createGovernanceKernel(deps: {
  readonly registry: GovernedFamilyRegistry
  readonly ports?: KernelPorts
}): GovernanceKernel {
  let state: KernelState = 'PREPARING'
  let failureDetail: string | undefined
  const entries = new Map<string, ApprovalEntry>()
  const consumedGrantIds = new Set<string>()

  const transition = (to: KernelState, detail: string): TransitionResult => {
    if (!LEGAL[state].includes(to)) {
      return {
        ok: false,
        code: 'ILLEGAL_TRANSITION',
        detail: `${state} -> ${to} is not a legal lifecycle transition (${detail}); state unchanged`,
      }
    }
    state = to
    return { ok: true, state }
  }

  function decide(call: CallFacts): KernelVerdict {
    const generation = deps.registry.generation()
    // STATE FIRST: while the kernel is not ACTIVE it has no opinion worth
    // enforcing — the same order the proven guard uses ("STATE FIRST" arm).
    if (state !== 'ACTIVE') {
      return { outcome: 'refuse', code: 'KERNEL_NOT_ACTIVE', detail: `kernel state is ${state}${failureDetail === undefined ? '' : ` (${failureDetail})`}`, generation }
    }
    // Candidate provenance (condition 9 / CI-11): a dynamically added,
    // never-revalidated source has no execution trust.
    const candidate = deps.registry.candidateFor(call.nativeName)
    if (candidate !== undefined && candidate.state === 'not_verified') {
      return { outcome: 'refuse', code: 'NOT_VERIFIED_SOURCE', detail: `'${call.nativeName}' comes from a dynamic source and has not been re-validated`, generation }
    }
    // No approval entry = no kernel opinion: DEFER. PR1 runs shadow, where
    // defer means "today's center path owns this call" (conditions 1+3).
    const entry = entries.get(call.nativeName)
    if (entry === undefined) {
      return { outcome: 'defer', code: 'NO_APPROVAL_ENTRY', detail: `no center approval entry for '${call.nativeName}'`, generation }
    }
    // CI-04: an unprovable current identity is a refusal, never a pass.
    if (call.definitionIdentity === undefined) {
      return { outcome: 'refuse', code: 'IDENTITY_UNVERIFIED', detail: `the current Definition for '${call.nativeName}' could not be read, so its identity is unprovable`, generation }
    }
    if (call.definitionIdentity !== entry.definitionIdentity) {
      return { outcome: 'refuse', code: 'IDENTITY_MISMATCH', detail: `the Definition currently visible for '${call.nativeName}' is not the one the approval entry bound`, generation }
    }
    return { outcome: 'allow', code: 'OK', detail: 'identity matches the center approval entry', generation }
  }

  async function consumeOnce(
    grant: unknown,
    grantId: string,
    facts: Readonly<Record<string, unknown>> = {},
  ): Promise<{ readonly ok: boolean; readonly code?: KernelFailureCode; readonly detail?: string; readonly portCalled: boolean }> {
    if (typeof grantId !== 'string' || grantId.length === 0) {
      return { ok: false, code: 'GRANT_REPLAY', detail: 'consumeOnce requires a non-empty grant id', portCalled: false }
    }
    // The one-shot law the kernel holds: an id already presented NEVER
    // re-arms — without touching the port (the port's own ledger stays the
    // authority; this only guarantees the kernel never double-presents).
    if (consumedGrantIds.has(grantId)) {
      return { ok: false, code: 'GRANT_REPLAY', detail: `grant '${grantId}' was already presented for consumption`, portCalled: false }
    }
    const port = deps.ports?.grantConsume
    if (port === undefined) {
      return { ok: false, code: 'NO_CONSUME_PORT', detail: 'no grantConsume port injected — PR1 ships no grant authority of its own', portCalled: false }
    }
    const result = await port.consumeForExecution(grant, facts)
    if (result.ok) consumedGrantIds.add(grantId)
    return { ok: result.ok, detail: result.reason, portCalled: true }
  }

  return {
    state: () => state,
    publish: () => transition('ACTIVE', 'publish PREPARING -> ACTIVE'),
    beginDrain: () => transition('DRAINING', 'begin drain'),
    tombstone: () => transition('TOMBSTONED', 'tombstone after drain'),
    release() {
      const inflight = deps.ports?.lifecycle?.inflight() ?? 0
      if (inflight > 0) {
        // CI-08: release only at a self-counted zero, never because a
        // disposer callback fired.
        return { ok: false, code: 'LEASE_OPEN', detail: `${String(inflight)} call(s) still in flight; release refuses while the lease is open` }
      }
      return transition('RELEASED', 'release at a self-counted zero')
    },
    fail(code: string) {
      const result = transition('FAILED', `fail(${code})`)
      if (result.ok) failureDetail = code
      return result
    },
    addApprovalEntry({ nativeName, definitionIdentity }) {
      if (typeof nativeName !== 'string' || nativeName.length === 0) {
        return { ok: false, code: 'NO_APPROVAL_ENTRY', detail: 'an approval entry needs a native name' }
      }
      if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
        return { ok: false, code: 'IDENTITY_UNVERIFIED', detail: 'an approval entry binds a real definition identity, never an empty one' }
      }
      if (entries.has(nativeName)) {
        return { ok: false, code: 'DUP_APPROVAL_ENTRY', detail: `'${nativeName}' already has an approval entry; replace it with an expected generation instead` }
      }
      const generation = deps.registry.generation()
      entries.set(nativeName, Object.freeze({ nativeName, definitionIdentity, addedGeneration: generation }))
      return { ok: true, generation }
    },
    replaceApprovalEntry({ nativeName, definitionIdentity, expectedGeneration }) {
      const current = entries.get(nativeName)
      if (current === undefined) {
        return { ok: false, code: 'NO_APPROVAL_ENTRY', detail: `no approval entry for '${nativeName}' to replace` }
      }
      if (expectedGeneration !== deps.registry.generation()) {
        return {
          ok: false,
          code: 'STALE_GENERATION',
          detail: `replace expects generation ${String(expectedGeneration)} but the registry stands at ${String(deps.registry.generation())}`,
        }
      }
      entries.set(nativeName, Object.freeze({ nativeName, definitionIdentity, addedGeneration: current.addedGeneration }))
      return { ok: true, generation: deps.registry.generation() }
    },
    approvalFor: (nativeName) => entries.get(nativeName),
    decide,
    consumeOnce,
    familyFace() {
      // PR1: a Family holds NO authority surface at all. Freezing an empty
      // object keeps the seat visible for PR2's pure-plan channel without
      // ever handing out decide/approve/consume (CI-06; condition 7).
      return Object.freeze({})
    },
  }
}
