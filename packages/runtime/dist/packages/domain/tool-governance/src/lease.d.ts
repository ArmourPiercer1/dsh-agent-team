/**
 * `ExecutionLease` — the authorization scope of an EXECUTING instance
 * (design §4.2: 后台执行实例、进程树/远端 Job + scope + 取消语义;
 * "不会扩大原 Grant").
 *
 * THE TWO FACTS THIS KEEPS APART (design §4.3, §3.6):
 *
 *  1. a Grant says what an operation MAY do; a Lease says what an ALIVE
 *     execution instance currently IS. Grant invalidation and lease
 *     termination are recorded SEPARATELY ("Grant 失效与 Lease 的终止保证要
 *     分开记录").
 *  2. `cancel requested ≠ terminated`. A cancellation request moves the lease
 *     to `cancelling`; only a settlement — a confirmation the provider owes —
 *     moves it to `terminated`. A settlement that cannot confirm moves it to
 *     `termination-unconfirmed`, which is exactly where the §5 error
 *     `EXECUTION_TERMINATION_UNCONFIRMED` belongs: the side effect may still
 *     be happening. `terminated` is absorbing: once confirmed, the lease
 *     never reopens.
 *
 * A lease never widens its grant: its scope IS the granted effect set (the
 * equality is checked by both the constructor and the parser — narrowing
 * happens per-effect at execution, not by rewriting the lease).
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/lease
 */
import { type RequestedEffectSet } from './effects.js';
import type { MemberRef, OperationGrant } from './grant.js';
import { type ParseResult } from './parse-util.js';
/** What kind of execution instance a lease holds (design §4.2). */
export declare const EXECUTION_LEASE_KINDS: readonly ["background-instance", "process-tree", "remote-job"];
/** One execution-instance kind. */
export type ExecutionLeaseKind = (typeof EXECUTION_LEASE_KINDS)[number];
/** The lease lifecycle (cancellation is a REQUEST; settlement decides). */
export declare const LEASE_STATUSES: readonly ["active", "cancelling", "termination-unconfirmed", "terminated"];
/** One lease status. */
export type LeaseStatus = (typeof LEASE_STATUSES)[number];
/** One execution lease (deep-frozen by the parser/constructor). */
export interface ExecutionLease {
    readonly leaseId: string;
    readonly grantId: string;
    /** The canonical fingerprint of the GRANTED effect set this lease may not exceed. */
    readonly grantFingerprint: string;
    readonly bindingId: string;
    readonly member: MemberRef;
    readonly realmId: string;
    readonly executionKind: ExecutionLeaseKind;
    readonly scope: RequestedEffectSet;
    readonly status: LeaseStatus;
}
/** A lease lifecycle outcome — typed, never thrown. */
export type LeaseAdvance = {
    readonly ok: true;
    readonly lease: ExecutionLease;
} | {
    readonly ok: false;
    readonly problems: readonly {
        code: string;
        path: string;
        detail: string;
    }[];
};
/** Open a lease for a consumed grant with the grant's own effect scope.
 *  Parses like every other constructor in the lane (`ParseResult` shape);
 *  the LIFECYCLE advances below carry the lease under `.lease`. */
export declare function openExecutionLease(input: {
    readonly leaseId: string;
    readonly grant: OperationGrant;
    readonly executionKind: ExecutionLeaseKind;
    readonly scope: RequestedEffectSet;
}): ParseResult<ExecutionLease>;
/**
 * Strictly parse a raw lease record against the §4.2 shape. The scope must
 * carry the granted fingerprint verbatim — a widened (or re-spelled) scope is
 * `lease-extends-grant`, because the grant fingerprint is the only anchor a
 * dormant lease can be checked against without the live grant.
 */
export declare function parseExecutionLease(raw: unknown): ParseResult<ExecutionLease>;
/**
 * REQUEST a cancellation (kill requested ≠ terminated, design §3.6). Legal
 * from any non-terminal status; the terminal `terminated` refuses with
 * `lease-terminal`.
 */
export declare function requestLeaseCancellation(lease: ExecutionLease): LeaseAdvance;
/**
 * Settle a lease's termination from the provider's confirmation.
 * `confirmed: false` records the HONEST state `termination-unconfirmed` —
 * the §5 error `EXECUTION_TERMINATION_UNCONFIRMED` is the caller's surface
 * for it. `terminated` never reopens.
 */
export declare function settleLeaseTermination(lease: ExecutionLease, confirmed: boolean): LeaseAdvance;
//# sourceMappingURL=lease.d.ts.map