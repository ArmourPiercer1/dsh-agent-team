/**
 * Alpha.5 PR2 (plan §5, design §4.2/§4.3) — THE OPERATION ADMISSION KERNEL.
 *
 * THE POSITION (design §4.3, verbatim order):
 *
 *   per-call canonical effects → Team Admission + existing ApprovalCase →
 *   single-use OperationGrant → … → monotonic Guard → actual Dispatcher
 *
 * Admission sits BEFORE the body and decides exactly one of the three frozen
 * arms (PR0 `OperationAdmissionDecision`): `admitted` (carries the grant),
 * `requires-approval` (carries the WHOLE immutable effect set — the approver
 * legally covers all effects or none), `denied` (typed §5 error). There is no
 * arm meaning "run first, decide later", and the Guard stays the final
 * un-bypassable refusal BEHIND this door: a permission here never replaces the
 * Guard, and the Guard's abstention never replaces this decision.
 *
 * THE PER-CALL ORDER (each leg is pinned by `a5p2-admission-kernel`):
 *
 *  1. H1 clock gate (clock.ts) — before ANY authorization/expiry use; a
 *     non-finite clock denies with ZERO side effects: no probe, no plan, no
 *     mint, no ledger touch (`body = 0`).
 *  2. Identity/Realm/binding-legality checks (binding ACTIVE, realm of every
 *     effect = the call's Realm, generations current) — the same typed facts
 *     PR1's Guard established, same §5 codes.
 *  3. H2 assurance runtime verification (assurance-runtime.ts) — BEFORE any
 *     hard-profile consumption: the level never redeems alone; the record
 *     must be real and probe-matched. A denied assurance never reaches mint.
 *  4. The expansion plane (PR0 planes, realm-filtered): decided `deny` or
 *     `undetermined` poisons the WHOLE set (plan §5: 禁止批准包含确定 deny /
 *     undetermined Effect 的请求); every effect `allow` → mint and admit;
 *     anything else → the ONE logical ApprovalCase (approval-case.ts).
 *  5. Mint is LAST and only for a decided call: the ledger registers the
 *     grant; consumption stays a SEPARATE edge (`consumeForExecution`), so
 *     "admitted but never executed" cannot fake a spent approval, and
 *     "executed twice" is the one thing the ledger makes impossible.
 *
 * WHAT THE KERNEL NEVER DOES: no clock of its own (the host injects one per
 * call, gated by H1); no model-visible role or grant (every identity field is
 * a server-derived parameter — 无模型输入可信角色/Grant); no auto-narrowing,
 * no retry, no fallback (design §4.3: stale = refusal, full stop); no durable
 * store of its own (the ledger is the assembly's, the approval case stays in
 * Alpha.4's Control plane behind the caller-supplied plan/case identity).
 *
 * Purity: no `node:*`, no I/O, no timers. The `async` shape is the frozen
 * `OperationAdmission` seam, nothing more.
 *
 * @module @dsh-agent-team/runtime/tool-admission/admission-kernel
 */
import { type AdmissionRequest, type ExecutionLease, type ExecutionLeaseKind, type GovernanceResult, type OperationAdmission, type OperationGrant, type AssuranceDimension, type AssuranceRequirement, type GrantCallContext, type ToolPolicyDocument } from '../../domain/tool-governance/src/index.js';
import type { SubtreeContains } from '../../domain/authority-envelope/src/index.js';
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js';
import type { RuntimeAuthority } from '../governance/runtime-authority.js';
import { type AssuranceProbe } from './assurance-runtime.js';
import { type EffectSetApprovalPlan, type PresentedApproval } from './approval-case.js';
import { type GrantLedger } from './grant-mint.js';
/** Which assurance demand the call derives from Policy, per dimension. */
export type RequiredAssuranceReader = (request: AdmissionRequest) => Readonly<Partial<Record<AssuranceDimension, AssuranceRequirement>>>;
/** Kernel wiring. Everything here is TRUSTED INPUT: the assembly, not the
 *  model, supplies documents, generations, clock and ledger. */
export interface AdmissionKernelOptions {
    /** The host wall clock, injected per call (never read by this lane). */
    readonly clock: () => number;
    readonly authorityGeneration: () => number;
    readonly documents: () => AuthorityEnvelopeDocuments;
    readonly policyDocument: () => ToolPolicyDocument;
    /** The rung whose ask this is — derived server-side (the Member ask). */
    readonly beneficiaryAuthority: RuntimeAuthority;
    readonly assuranceProbe: AssuranceProbe;
    readonly requiredAssurance: RequiredAssuranceReader;
    readonly ledger: GrantLedger;
    readonly subtreeContains?: SubtreeContains;
    /**
     * One-shot grant expiry policy: `null` (default) = no expiry (PR0: NEVER an
     * expiry at zero). A finite reader returns a FUTURE finite instant; anything
     * else fails the mint closed (the parser refuses non-finite stamps).
     */
    readonly grantExpiry?: (issuedAt: number) => number | null;
    readonly onObserve?: (event: Readonly<Record<string, unknown>> & {
        readonly event: string;
    }) => void;
}
/** The call fields the consumption edge needs (clock added by the kernel). */
export type ExecutionCallFields = Omit<GrantCallContext, 'now'> & {
    /** The host's CURRENT cancellation view at the execution edge. */
    readonly cancelRequested?: boolean;
    /** When present, a lease is opened for the consumed grant (background/
     *  process-tree/remote-job); it never widens the grant (PR0 lease law). */
    readonly executionKind?: ExecutionLeaseKind;
    readonly leaseId?: string;
};
export interface AdmissionKernel extends OperationAdmission {
    /** The plan behind a `requires-approval` decision (case identity + rungs). */
    readonly planApproval: (request: AdmissionRequest) => GovernanceResult<EffectSetApprovalPlan>;
    /** After the Alpha.4 case resolves: re-verify PER EFFECT, then mint. */
    readonly issueApprovedGrant: (request: AdmissionRequest, approval: PresentedApproval) => Promise<GovernanceResult<OperationGrant>>;
    /** THE execution edge: finite clock → validate → consume (one-shot) →
     *  optional lease. Cancel-first refuses with ZERO ledger change. */
    readonly consumeForExecution: (grant: OperationGrant, call: ExecutionCallFields) => GovernanceResult<{
        readonly grant: OperationGrant;
        readonly lease: ExecutionLease | null;
    }>;
    /** Lease lifecycle pass-throughs (cancellation ≠ termination, PR0 law). */
    readonly requestCancellation: (lease: ExecutionLease) => GovernanceResult<ExecutionLease>;
    readonly settleTermination: (lease: ExecutionLease, confirmed: boolean) => GovernanceResult<ExecutionLease>;
}
/** The deterministic grantId: the same call identity mints the same id, so a
 *  double mint registers against the SAME id (refused) — no replay surface. */
export declare function grantIdForCall(request: AdmissionRequest, authorityGeneration: number): string;
/**
 * Create the kernel for one Team Agent assembly (per-closure state: only the
 * ledger, and only because consumption has to live SOMEWHERE in-process until
 * PR7's durable store lands behind the same view).
 */
export declare function createAdmissionKernel(options: AdmissionKernelOptions): AdmissionKernel;
//# sourceMappingURL=admission-kernel.d.ts.map