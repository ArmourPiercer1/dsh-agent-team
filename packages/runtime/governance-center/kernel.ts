/**
 * `governance-center/kernel` — the GovernanceKernel (U6 PR1; FIX-K remediation
 * 2026-10-26; center-assembly-architecture §3 component 3, §5 lifecycle state
 * machine; U6-SLICE-PLAN PR1: "Kernel = §5 state machine … driven by the
 * existing dispatcher lifecycle ports; one-shot grant consume via
 * `consumeForExecution` port").
 *
 * INERT-BY-CONSTRUCTION: nothing in this file enforces anything. It OWNS the
 * two things the center must own and nothing else:
 *
 *  - THE APPROVAL TABLE (sup-a §5 condition 1: "The center must maintain
 *    its own approval table. The caller (a Family) cannot approve itself
 *    into it"): entries are written only through the kernel-OWNER surface
 *    (`addApprovalEntry` / `replaceApprovalEntry` / `dropApprovalsForFamily`).
 *    What a Family-facing consumer receives is `familyFace()` — a surface
 *    that carries NO decide/approve/consume/register method at all, pinned
 *    by test.
 *  - THE ONE-SHOT GRANT CONSUME POINT (§ CI-06: only the center consumes a
 *    Grant). PR1 does NOT re-implement grant logic: consumption is composed
 *    through the INJECTED `grantConsume` port — in production that port's
 *    implementation is the existing tool-admission `consumeForExecution`
 *    face, injected by the trusted assembly point, never imported here.
 *    The kernel-side law it adds is only: exactly one ATTEMPT per grant id
 *    reaches the port (replay never re-arms the effect).
 *
 * FIX-K (external audit, 2026-10-26) closed four safety gaps on this
 * surface; each is law now, each is test-pinned by
 * `test/u6-fixk-kernel-safety.test.ts` (RED-first on the pre-fix code):
 *
 *  K1 REVOKE-BINDING — every approval entry is bound to its OWNING
 *    candidate: (familyId, registeredGeneration, source digest) snapshotted
 *    from the registry at bind time. `decide()` re-validates that binding
 *    against the LIVE registry on every call: an owner that is tombstoned or
 *    gone refuses `CANDIDATE_REVOKED`; a re-registration (new generation, or
 *    a re-digest) refuses `STALE_GENERATION`; a never-revalidated dynamic
 *    source refuses `NOT_VERIFIED_SOURCE` (condition 9, unchanged).
 *    `dropApprovalsForFamily(familyId)` is the owner-surface act the trusted
 *    assembly point runs alongside `registry.revoke` so a revoked family's
 *    entries are REMOVED, not merely dead; a re-registration NEVER
 *    resurrects them — a fresh owner-surface add/replace is required. There
 *    is deliberately no registry→kernel event edge (the registry's public
 *    surface is pinned closed, and the lane adds no new edges); the
 *    per-decide re-validation is the fail-closed backstop that holds even
 *    when a caller forgets the drop.
 *  K2 SYNCHRONOUS CONSUME RESERVATION — `consumeOnce()` reserves the grant
 *    id in an in-flight set BEFORE the port `await`: a second call while the
 *    first is in flight refuses `GRANT_IN_FLIGHT` without touching the port,
 *    so exactly ONE presentation can ever reach it. The burn is
 *    OUTCOME-INDEPENDENT: once presented, the id is burned — a port refusal,
 *    and even a port throw, do not re-arm it (any later attempt gets
 *    `GRANT_REPLAY`). Justification: the port is the grant authority and its
 *    ledger is not observable from the kernel; a "failed" presentation may
 *    have committed there already (or may still commit after a timeout), so
 *    any re-presentation risks the exact double-consume the one-shot law
 *    exists to prevent. Fail closed: the PRESENTATION, not its outcome, is
 *    the one-shot event.
 *  K3 COUNTED RELEASE ONLY — `release()` never reports a zero it did not
 *    count: with no injected lifecycle port it refuses
 *    `LIFECYCLE_PORT_MISSING` and its detail records `UNCOUNTED` — in every
 *    mode. The FACTORY is stricter for `mode: 'enforcing'`: building one
 *    without the lifecycle port THROWS. `'shadow'` (the default, and the
 *    only mode PR1 ships) may run without the port but still gets no free
 *    clean-zero at release.
 *  K4 SCOPE KEYING — the entries Map is keyed by (scopeKey, nativeName);
 *    `CallFacts` carries the `scopeKey` of the HostSurfaceAdapter's scoped
 *    resolution. A call whose scope is not established refuses
 *    `SCOPE_UNVERIFIED` — there is no name-only authority anywhere in the
 *    table. Combined with the K1 source binding, the same native name in a
 *    different scope, or re-claimed by a different family/source, is never
 *    covered by an approval minted elsewhere.
 *
 * STATE MACHINE (§5, slice-plan PR1 names):
 *
 *     PREPARING ─publish()→ ACTIVE ─beginDrain()→ DRAINING
 *        │                       │                    │ tombstone()
 *        │ fail(code)            │ fail(code)         ▼
 *        └──────────────→ FAILED ←───────      TOMBSTONED ─release()→ RELEASED
 *                                                 ▲   (only at a SELF-COUNTED
 *                                                 └──── inflight zero — CI-08;
 *                                                       K3: no port ⇒ UNCOUNTED)
 *
 * Illegal transitions are typed refusals that change nothing (the CI-08 law
 * that `pa-mount-registry` already proves at the mount level, applied to the
 * kernel's own lifecycle). FAILED/RELEASED are terminal.
 *
 * NO EXECUTION, NO I/O, NO CLOCKS: the kernel is pure decision state; the
 * rows/listeners that feed it live in the live glue.
 *
 * @module governance-center/kernel
 */

import type { GovernedFamilyRegistry, RegisteredCandidate } from './registry.js'

export const KERNEL_STATES = ['PREPARING', 'ACTIVE', 'DRAINING', 'TOMBSTONED', 'RELEASED', 'FAILED'] as const
export type KernelState = (typeof KERNEL_STATES)[number]

/** What lifecycle accountability this kernel instance was BUILT for
 *  (FIX-K K3). `'shadow'` is the PR1 posture (observe, never flow);
 *  `'enforcing'` is reserved for the PR2+ lane and REQUIRES the lifecycle
 *  port at construction — the factory throws without it. */
export type KernelMode = 'shadow' | 'enforcing'

export type KernelFailureCode =
  | 'ILLEGAL_TRANSITION'
  | 'LEASE_OPEN'
  | 'LIFECYCLE_PORT_MISSING'
  | 'IDENTITY_UNVERIFIED'
  | 'IDENTITY_MISMATCH'
  | 'NOT_VERIFIED_SOURCE'
  | 'SCOPE_UNVERIFIED'
  | 'CANDIDATE_REVOKED'
  | 'NO_CANDIDATE'
  | 'GRANT_REPLAY'
  | 'GRANT_IN_FLIGHT'
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
   * The agent scope this call is resolved IN — the key half of every
   * approval (FIX-K K4; the HostSurfaceAdapter's scoped resolution).
   * Absent/empty ⇒ the kernel has no scope to point an opinion at ⇒ refuse
   * `SCOPE_UNVERIFIED`.
   */
  readonly scopeKey?: string
  /**
   * The definition-identity OBSERVATION for this call, produced by the
   * HostSurfaceAdapter from the Host's own scoped resolution (CI-04: an
   * identity the caller self-attests is not an identity). Absent = unreadable.
   */
  readonly definitionIdentity?: string
}

export type ApprovalEntry = {
  readonly scopeKey: string
  readonly nativeName: string
  readonly definitionIdentity: string
  /** The owning candidate this entry is BOUND to (FIX-K K1). */
  readonly familyId: string
  /** The owner's `registeredGeneration` at bind time; drift ⇒ STALE_GENERATION. */
  readonly boundGeneration: number
  /** The owner's source digest at bind time; re-digest ⇒ STALE_GENERATION. */
  readonly boundSourceDigest: string
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

export type EntryWriteResult =
  | { readonly ok: true; readonly generation: number }
  | { readonly ok: false; readonly code: KernelFailureCode; readonly detail: string }

export type GovernanceKernel = {
  readonly state: () => KernelState
  /** The mode the factory built this kernel for (FIX-K K3). */
  readonly mode: () => KernelMode
  readonly publish: () => TransitionResult
  readonly beginDrain: () => TransitionResult
  readonly tombstone: () => TransitionResult
  readonly release: () => TransitionResult
  readonly fail: (code: string) => TransitionResult
  /**
   * Kernel-OWNER surface (composition center only): bind (scopeKey,
   * nativeName) to a definition identity AND to the live registry candidate
   * that claims it (FIX-K K1 + K4). Without a live claiming candidate there
   * is nothing to bind — `NO_CANDIDATE`.
   */
  readonly addApprovalEntry: (entry: {
    readonly scopeKey: string
    readonly nativeName: string
    readonly definitionIdentity: string
    readonly familyId: string
  }) => EntryWriteResult
  /** Kernel-OWNER surface: rebind with an expected-generation freshness
   *  check. Re-binds the entry to the CURRENT live candidate — that is the
   *  reviewed owner act that re-approves a re-registered family (FIX-K K1). */
  readonly replaceApprovalEntry: (entry: {
    readonly scopeKey: string
    readonly nativeName: string
    readonly definitionIdentity: string
    readonly familyId: string
    readonly expectedGeneration: number
  }) => EntryWriteResult
  /** Kernel-OWNER surface: the deterministic drop the assembly point runs
   *  next to `registry.revoke` (FIX-K K1). Returns how many entries were
   *  removed; a re-registration never resurrects them. */
  readonly dropApprovalsForFamily: (familyId: string) => number
  /** The owner-side read; a binding that no longer validates reads as gone. */
  readonly approvalFor: (scopeKey: string, nativeName: string) => ApprovalEntry | undefined
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

/** The key law (FIX-K K4): (scopeKey, nativeName), never name alone.
 *  `\u0000` cannot occur in either half (schema-validated names,
 *  `teamRoot:instanceId` scopes), so the concatenation is injective. */
function entryKey(scopeKey: string, nativeName: string): string {
  return `${scopeKey}\u0000${nativeName}`
}

export function createGovernanceKernel(deps: {
  readonly registry: GovernedFamilyRegistry
  readonly ports?: KernelPorts
  readonly mode?: KernelMode
}): GovernanceKernel {
  const mode: KernelMode = deps.mode ?? 'shadow'
  // FIX-K K3: an enforcing kernel without a lifecycle port could only ever
  // release on an uncounted zero — refuse to build it at all (fail-fast at
  // the trusted assembly point, before any state exists).
  if (mode === 'enforcing' && deps.ports?.lifecycle === undefined) {
    throw new Error('LIFECYCLE_PORT_MISSING: an enforcing GovernanceKernel requires the injected DispatcherLifecyclePort (FIX-K K3) — release() may only count real in-flight work')
  }
  let state: KernelState = 'PREPARING'
  let failureDetail: string | undefined
  const entries = new Map<string, ApprovalEntry>()
  const consumedGrantIds = new Set<string>()
  // FIX-K K2: ids currently inside `port.consumeForExecution`. Reserved
  // SYNCHRONOUSLY before the first await, so the one-shot law is race-free.
  const inFlightGrantIds = new Set<string>()

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

  /** The live candidate bound by `familyId` that claims `nativeName`
   *  exactly, or undefined when no LIVE registration answers to that pair. */
  const liveCandidateFor = (familyId: string, nativeName: string): RegisteredCandidate | undefined =>
    deps.registry.view().candidates.find(
      (c) => c.familyId === familyId && c.state !== 'tombstoned' && c.contribution.visibility.nativeNames.includes(nativeName),
    )

  /** Whether an entry's source binding still validates against the LIVE
   *  registry (FIX-K K1): `'ok'` only for the same family, the same
   *  registration generation, and the same source digest. */
  const bindingState = (
    entry: ApprovalEntry,
    current: RegisteredCandidate | undefined,
  ): 'ok' | 'revoked' | 'stale' => {
    if (current === undefined) return 'revoked'
    if (current.familyId !== entry.familyId) return 'revoked'
    if (current.registeredGeneration !== entry.boundGeneration) return 'stale'
    if (current.contribution.source.digest !== entry.boundSourceDigest) return 'stale'
    return 'ok'
  }

  function decide(call: CallFacts): KernelVerdict {
    const generation = deps.registry.generation()
    // STATE FIRST: while the kernel is not ACTIVE it has no opinion worth
    // enforcing — the same order the proven guard uses ("STATE FIRST" arm).
    if (state !== 'ACTIVE') {
      return { outcome: 'refuse', code: 'KERNEL_NOT_ACTIVE', detail: `kernel state is ${state}${failureDetail === undefined ? '' : ` (${failureDetail})`}`, generation }
    }
    // Candidate provenance (condition 9 / CI-11): a dynamically added,
    // never-revalidated source has no execution trust — scope-independent law.
    const candidate = deps.registry.candidateFor(call.nativeName)
    if (candidate !== undefined && candidate.state === 'not_verified') {
      return { outcome: 'refuse', code: 'NOT_VERIFIED_SOURCE', detail: `'${call.nativeName}' comes from a dynamic source and has not been re-validated`, generation }
    }
    // FIX-K K4: no scope, no scoped opinion — refuse; never a name-only allow.
    if (typeof call.scopeKey !== 'string' || call.scopeKey.length === 0) {
      return { outcome: 'refuse', code: 'SCOPE_UNVERIFIED', detail: `the call for '${call.nativeName}' carries no scopeKey — its scoped resolution is unproven, so no scoped approval can apply`, generation }
    }
    // No approval entry for THIS (scope, name) = no kernel opinion: DEFER.
    // PR1 runs shadow, where defer means "today's center path owns this
    // call" (conditions 1+3).
    const entry = entries.get(entryKey(call.scopeKey, call.nativeName))
    if (entry === undefined) {
      return { outcome: 'defer', code: 'NO_APPROVAL_ENTRY', detail: `no center approval entry for '${call.nativeName}' in scope '${call.scopeKey}'`, generation }
    }
    // FIX-K K1: an entry is authority only while its bound candidate IS the
    // live owner — tombstoned/missing ⇒ CANDIDATE_REVOKED, re-registered or
    // re-digested ⇒ STALE_GENERATION. This runs on EVERY decide, so a revoke
    // invalidates even entries nobody dropped.
    const binding = bindingState(entry, candidate)
    if (binding === 'revoked') {
      return { outcome: 'refuse', code: 'CANDIDATE_REVOKED', detail: `the approval entry for '${call.nativeName}' is bound to family '${entry.familyId}' (generation ${String(entry.boundGeneration)}), which no longer holds a live claim on this name`, generation }
    }
    if (binding === 'stale') {
      return { outcome: 'refuse', code: 'STALE_GENERATION', detail: `the approval entry for '${call.nativeName}' is bound to generation ${String(entry.boundGeneration)} of family '${entry.familyId}', but that family is now live at generation ${String(candidate?.registeredGeneration ?? -1)} — a re-registration never inherits the old approval`, generation }
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
    // The one-shot law the kernel holds: an id already PRESENTED NEVER
    // re-arms — without touching the port (the port's own ledger stays the
    // authority; this only guarantees the kernel never double-presents).
    if (consumedGrantIds.has(grantId)) {
      return { ok: false, code: 'GRANT_REPLAY', detail: `grant '${grantId}' was already presented for consumption`, portCalled: false }
    }
    // FIX-K K2: a presentation currently inside the port is ALREADY the one
    // presentation of this id — refuse without touching the port. This check
    // and the reservation below run synchronously, before any await, so two
    // concurrent calls can never both reach the port.
    if (inFlightGrantIds.has(grantId)) {
      return { ok: false, code: 'GRANT_IN_FLIGHT', detail: `grant '${grantId}' is already in flight to the consume port; a second presentation is refused`, portCalled: false }
    }
    const port = deps.ports?.grantConsume
    if (port === undefined) {
      return { ok: false, code: 'NO_CONSUME_PORT', detail: 'no grantConsume port injected — PR1 ships no grant authority of its own', portCalled: false }
    }
    inFlightGrantIds.add(grantId) // synchronous reservation, before the first await (FIX-K K2)
    try {
      const result = await port.consumeForExecution(grant, facts)
      // FIX-K K2, OUTCOME-INDEPENDENT burn: the presentation happened; a
      // port-side refusal is not observable proof that the grant is
      // unconsumed THERE, so the kernel NEVER re-presents.
      consumedGrantIds.add(grantId)
      return { ok: result.ok, detail: result.reason, portCalled: true }
    } catch (error) {
      // Unknown outcome is the worst case, so it burns too (fail closed);
      // the caller still sees the port's error exactly as the port threw it.
      consumedGrantIds.add(grantId)
      throw error
    } finally {
      inFlightGrantIds.delete(grantId)
    }
  }

  return {
    state: () => state,
    mode: () => mode,
    publish: () => transition('ACTIVE', 'publish PREPARING -> ACTIVE'),
    beginDrain: () => transition('DRAINING', 'begin drain'),
    tombstone: () => transition('TOMBSTONED', 'tombstone after drain'),
    release() {
      // STATE FIRST: an illegal release stays an ILLEGAL_TRANSITION refusal
      // regardless of ports (the transition matrix is the outermost law).
      if (!LEGAL[state].includes('RELEASED')) {
        return {
          ok: false,
          code: 'ILLEGAL_TRANSITION',
          detail: `${state} -> RELEASED is not a legal lifecycle transition (release); state unchanged`,
        }
      }
      // FIX-K K3: with no lifecycle port the in-flight count is UNCOUNTED.
      // Never report a clean zero that was never counted — refuse, in every
      // mode (shadow included: shadow just never claims release-complete).
      const lifecycle = deps.ports?.lifecycle
      if (lifecycle === undefined) {
        return { ok: false, code: 'LIFECYCLE_PORT_MISSING', detail: 'no lifecycle port injected: in-flight is UNCOUNTED — release() reports no zero it did not count (FIX-K K3)' }
      }
      const inflight = lifecycle.inflight()
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
    addApprovalEntry({ scopeKey, nativeName, definitionIdentity, familyId }) {
      if (typeof scopeKey !== 'string' || scopeKey.length === 0) {
        // FIX-K K4: an unscoped entry would be name-only authority — refuse.
        return { ok: false, code: 'SCOPE_UNVERIFIED', detail: 'an approval entry is scoped; an unscoped (name-only) entry cannot be created' }
      }
      if (typeof nativeName !== 'string' || nativeName.length === 0) {
        return { ok: false, code: 'NO_APPROVAL_ENTRY', detail: 'an approval entry needs a native name' }
      }
      if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
        return { ok: false, code: 'IDENTITY_UNVERIFIED', detail: 'an approval entry binds a real definition identity, never an empty one' }
      }
      const key = entryKey(scopeKey, nativeName)
      if (entries.has(key)) {
        return { ok: false, code: 'DUP_APPROVAL_ENTRY', detail: `'${nativeName}' already has an approval entry in scope '${scopeKey}'; replace it with an expected generation instead` }
      }
      // FIX-K K1: bind to the OWNING candidate. No live registration of
      // `familyId` claiming this name ⇒ nothing to bind (fail closed).
      const candidate = typeof familyId === 'string' && familyId.length > 0
        ? liveCandidateFor(familyId, nativeName)
        : undefined
      if (candidate === undefined) {
        return { ok: false, code: 'NO_CANDIDATE', detail: `no live candidate '${String(familyId)}' claims '${nativeName}' — an approval entry must bind to a registered candidate (FIX-K K1)` }
      }
      const generation = deps.registry.generation()
      entries.set(key, Object.freeze({
        scopeKey,
        nativeName,
        definitionIdentity,
        familyId: candidate.familyId,
        boundGeneration: candidate.registeredGeneration,
        boundSourceDigest: candidate.contribution.source.digest,
        addedGeneration: generation,
      }))
      return { ok: true, generation }
    },
    replaceApprovalEntry({ scopeKey, nativeName, definitionIdentity, familyId, expectedGeneration }) {
      if (typeof scopeKey !== 'string' || scopeKey.length === 0) {
        return { ok: false, code: 'SCOPE_UNVERIFIED', detail: 'an approval entry is scoped; an unscoped (name-only) replace cannot apply' }
      }
      const key = entryKey(scopeKey, nativeName)
      const current = entries.get(key)
      if (current === undefined) {
        return { ok: false, code: 'NO_APPROVAL_ENTRY', detail: `no approval entry for '${nativeName}' in scope '${scopeKey}' to replace` }
      }
      if (expectedGeneration !== deps.registry.generation()) {
        return {
          ok: false,
          code: 'STALE_GENERATION',
          detail: `replace expects generation ${String(expectedGeneration)} but the registry stands at ${String(deps.registry.generation())}`,
        }
      }
      if (typeof definitionIdentity !== 'string' || definitionIdentity.length === 0) {
        return { ok: false, code: 'IDENTITY_UNVERIFIED', detail: 'an approval entry binds a real definition identity, never an empty one' }
      }
      // The replace re-binds to the CURRENT live candidate — this is the
      // reviewed owner act that re-approves a re-registered family (FIX-K
      // K1); without a live claim there is nothing new to bind.
      const candidate = typeof familyId === 'string' && familyId.length > 0
        ? liveCandidateFor(familyId, nativeName)
        : undefined
      if (candidate === undefined) {
        return { ok: false, code: 'NO_CANDIDATE', detail: `no live candidate '${String(familyId)}' claims '${nativeName}' — replace has nothing to re-bind to (FIX-K K1)` }
      }
      entries.set(key, Object.freeze({
        scopeKey,
        nativeName,
        definitionIdentity,
        familyId: candidate.familyId,
        boundGeneration: candidate.registeredGeneration,
        boundSourceDigest: candidate.contribution.source.digest,
        addedGeneration: current.addedGeneration,
      }))
      return { ok: true, generation: deps.registry.generation() }
    },
    dropApprovalsForFamily(familyId: string) {
      // FIX-K K1: the deterministic drop. Removal, not tombstoning — a
      // re-registration of the same family earns a NEW generation and must
      // earn a NEW entry (no resurrection).
      let dropped = 0
      for (const [key, entry] of entries) {
        if (entry.familyId === familyId) {
          entries.delete(key)
          dropped += 1
        }
      }
      return dropped
    },
    approvalFor(scopeKey: string, nativeName: string) {
      const entry = entries.get(entryKey(scopeKey, nativeName))
      if (entry === undefined) return undefined
      // A dead binding reads as gone on the owner surface too — the table
      // never presents a revoked/stale entry as live authority.
      return bindingState(entry, deps.registry.candidateFor(nativeName)) === 'ok' ? entry : undefined
    },
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
