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
import type { GovernedFamilyRegistry } from './registry.js';
export declare const KERNEL_STATES: readonly ["PREPARING", "ACTIVE", "DRAINING", "TOMBSTONED", "RELEASED", "FAILED"];
export type KernelState = (typeof KERNEL_STATES)[number];
/** What lifecycle accountability this kernel instance was BUILT for
 *  (FIX-K K3). `'shadow'` is the PR1 posture (observe, never flow);
 *  `'enforcing'` is reserved for the PR2+ lane and REQUIRES the lifecycle
 *  port at construction — the factory throws without it. */
export type KernelMode = 'shadow' | 'enforcing';
export type KernelFailureCode = 'ILLEGAL_TRANSITION' | 'LEASE_OPEN' | 'LIFECYCLE_PORT_MISSING' | 'IDENTITY_UNVERIFIED' | 'IDENTITY_MISMATCH' | 'NOT_VERIFIED_SOURCE' | 'SCOPE_UNVERIFIED' | 'CANDIDATE_REVOKED' | 'NO_CANDIDATE' | 'GRANT_REPLAY' | 'GRANT_IN_FLIGHT' | 'NO_CONSUME_PORT' | 'DUP_APPROVAL_ENTRY' | 'NO_APPROVAL_ENTRY' | 'STALE_GENERATION';
export type TransitionResult = {
    readonly ok: true;
    readonly state: KernelState;
} | {
    readonly ok: false;
    readonly code: KernelFailureCode;
    readonly detail: string;
};
/** The three-state verdict (§4 "三态输出 allow / refuse / defer"). */
export type KernelVerdict = {
    readonly outcome: 'allow' | 'refuse' | 'defer';
    readonly code: KernelFailureCode | 'KERNEL_NOT_ACTIVE' | 'NO_APPROVAL_ENTRY' | 'OK';
    readonly detail: string;
    readonly generation: number;
};
export type CallFacts = {
    readonly nativeName: string;
    /**
     * The agent scope this call is resolved IN — the key half of every
     * approval (FIX-K K4; the HostSurfaceAdapter's scoped resolution).
     * Absent/empty ⇒ the kernel has no scope to point an opinion at ⇒ refuse
     * `SCOPE_UNVERIFIED`.
     */
    readonly scopeKey?: string;
    /**
     * The definition-identity OBSERVATION for this call, produced by the
     * HostSurfaceAdapter from the Host's own scoped resolution (CI-04: an
     * identity the caller self-attests is not an identity). Absent = unreadable.
     */
    readonly definitionIdentity?: string;
};
export type ApprovalEntry = {
    readonly scopeKey: string;
    readonly nativeName: string;
    readonly definitionIdentity: string;
    /** The owning candidate this entry is BOUND to (FIX-K K1). */
    readonly familyId: string;
    /** The owner's `registeredGeneration` at bind time; drift ⇒ STALE_GENERATION. */
    readonly boundGeneration: number;
    /** The owner's source digest at bind time; re-digest ⇒ STALE_GENERATION. */
    readonly boundSourceDigest: string;
    readonly addedGeneration: number;
};
/** The one port PR1 needs from the existing admission lane (§5 one-shot). */
export type GrantConsumePort = {
    /** Production implementation: tool-admission `consumeForExecution`. */
    readonly consumeForExecution: (grant: unknown, facts: Readonly<Record<string, unknown>>) => Promise<{
        readonly ok: boolean;
        readonly reason?: string;
    }>;
};
/** The lifecycle feedback the dispatcher already counts (injected, opaque). */
export type DispatcherLifecyclePort = {
    /** In-flight calls the owning dispatcher still counts for this assembly. */
    readonly inflight: () => number;
};
export type KernelPorts = {
    readonly grantConsume?: GrantConsumePort;
    readonly lifecycle?: DispatcherLifecyclePort;
};
/** What a Family consumer may hold: nothing but a marker in PR1. */
export type FamilyFace = Readonly<Record<string, never>>;
export type EntryWriteResult = {
    readonly ok: true;
    readonly generation: number;
} | {
    readonly ok: false;
    readonly code: KernelFailureCode;
    readonly detail: string;
};
export type GovernanceKernel = {
    readonly state: () => KernelState;
    /** The mode the factory built this kernel for (FIX-K K3). */
    readonly mode: () => KernelMode;
    readonly publish: () => TransitionResult;
    readonly beginDrain: () => TransitionResult;
    readonly tombstone: () => TransitionResult;
    readonly release: () => TransitionResult;
    readonly fail: (code: string) => TransitionResult;
    /**
     * Kernel-OWNER surface (composition center only): bind (scopeKey,
     * nativeName) to a definition identity AND to the live registry candidate
     * that claims it (FIX-K K1 + K4). Without a live claiming candidate there
     * is nothing to bind — `NO_CANDIDATE`.
     */
    readonly addApprovalEntry: (entry: {
        readonly scopeKey: string;
        readonly nativeName: string;
        readonly definitionIdentity: string;
        readonly familyId: string;
    }) => EntryWriteResult;
    /** Kernel-OWNER surface: rebind with an expected-generation freshness
     *  check. Re-binds the entry to the CURRENT live candidate — that is the
     *  reviewed owner act that re-approves a re-registered family (FIX-K K1). */
    readonly replaceApprovalEntry: (entry: {
        readonly scopeKey: string;
        readonly nativeName: string;
        readonly definitionIdentity: string;
        readonly familyId: string;
        readonly expectedGeneration: number;
    }) => EntryWriteResult;
    /** Kernel-OWNER surface: the deterministic drop the assembly point runs
     *  next to `registry.revoke` (FIX-K K1). Returns how many entries were
     *  removed; a re-registration never resurrects them. */
    readonly dropApprovalsForFamily: (familyId: string) => number;
    /** The owner-side read; a binding that no longer validates reads as gone. */
    readonly approvalFor: (scopeKey: string, nativeName: string) => ApprovalEntry | undefined;
    /** The ONLY verdict face; PR1 uses it for shadow accounting, never flow. */
    readonly decide: (call: CallFacts) => KernelVerdict;
    /** One-shot consume through the injected port; replay NEVER reaches it twice. */
    readonly consumeOnce: (grant: unknown, grantId: string, facts?: Readonly<Record<string, unknown>>) => Promise<{
        readonly ok: boolean;
        readonly code?: KernelFailureCode;
        readonly detail?: string;
        readonly portCalled: boolean;
    }>;
    /** The surface handed to a Family: no verdict, no authority (CI-06). */
    readonly familyFace: () => FamilyFace;
};
export declare function createGovernanceKernel(deps: {
    readonly registry: GovernedFamilyRegistry;
    readonly ports?: KernelPorts;
    readonly mode?: KernelMode;
}): GovernanceKernel;
//# sourceMappingURL=kernel.d.ts.map