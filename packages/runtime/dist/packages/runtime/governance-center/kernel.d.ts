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
import type { GovernedFamilyRegistry } from './registry.js';
export declare const KERNEL_STATES: readonly ["PREPARING", "ACTIVE", "DRAINING", "TOMBSTONED", "RELEASED", "FAILED"];
export type KernelState = (typeof KERNEL_STATES)[number];
export type KernelFailureCode = 'ILLEGAL_TRANSITION' | 'LEASE_OPEN' | 'IDENTITY_UNVERIFIED' | 'IDENTITY_MISMATCH' | 'NOT_VERIFIED_SOURCE' | 'GRANT_REPLAY' | 'NO_CONSUME_PORT' | 'DUP_APPROVAL_ENTRY' | 'NO_APPROVAL_ENTRY' | 'STALE_GENERATION';
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
     * The definition-identity OBSERVATION for this call, produced by the
     * HostSurfaceAdapter from the Host's own scoped resolution (CI-04: an
     * identity the caller self-attests is not an identity). Absent = unreadable.
     */
    readonly definitionIdentity?: string;
};
export type ApprovalEntry = {
    readonly nativeName: string;
    readonly definitionIdentity: string;
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
export type GovernanceKernel = {
    readonly state: () => KernelState;
    readonly publish: () => TransitionResult;
    readonly beginDrain: () => TransitionResult;
    readonly tombstone: () => TransitionResult;
    readonly release: () => TransitionResult;
    readonly fail: (code: string) => TransitionResult;
    /** Kernel-OWNER surface (composition center only): bind a name to an identity. */
    readonly addApprovalEntry: (entry: {
        readonly nativeName: string;
        readonly definitionIdentity: string;
    }) => {
        readonly ok: true;
        readonly generation: number;
    } | {
        readonly ok: false;
        readonly code: KernelFailureCode;
        readonly detail: string;
    };
    /** Kernel-OWNER surface: rebind with an expected-generation freshness check. */
    readonly replaceApprovalEntry: (entry: {
        readonly nativeName: string;
        readonly definitionIdentity: string;
        readonly expectedGeneration: number;
    }) => {
        readonly ok: false;
        readonly code: KernelFailureCode;
        readonly detail: string;
    } | {
        readonly ok: true;
        readonly generation: number;
    };
    readonly approvalFor: (nativeName: string) => ApprovalEntry | undefined;
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
}): GovernanceKernel;
//# sourceMappingURL=kernel.d.ts.map