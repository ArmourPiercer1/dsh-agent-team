/**
 * TeamBindingReconciler — bidirectional SessionBinding integrity over the
 * durable TeamDomain stores (TaskDoc §11.5 P4-T3; Architecture §15.3).
 *
 * The check is the frozen bidirectional pair:
 *
 * ```text
 * MemberInstance.childSessionId
 *   <->
 * SessionBinding(childSessionId -> rootSessionId, instanceId)
 * ```
 *
 * plus the root pair (TeamSession record <-> `team-root` binding row) and
 * the child-session uniqueness claim (invariant 23: a child session is
 * never shared between members).
 *
 * Semantics, per the frozen docs:
 *
 * - **Read-only**: the reconciler only reads stored records and produces
 *   typed diagnostics; it never rewrites, deletes, or "fixes" anything.
 *   When TeamDomain is self-contradictory the correct behavior is to
 *   **fail closed for new Team work** and **not guess which side is more
 *   likely right** (Architecture §15.3). Convergence is driven by the
 *   diagnostics (Development Plan §17.3 "roll forward / reconcile",
 *   §17.4 "no committed MemberInstance + diagnosable orphan").
 * - **Per-team scope**: one report per team root session id — the unit a
 *   cold hydration (Architecture §36.1) or a fork reconciliation
 *   (Architecture §35.2/§35.3) reconciles. A scope root with no team
 *   artifacts at all yields a trivially consistent empty report (an
 *   ordinary fork simply has no team to reconcile).
 * - **Deterministic**: diagnostics are sorted by
 *   (code, sessionId, instanceId); identical stored state always yields
 *   an identical report (byte-stable for evidence comparison).
 *
 * Diagnostic direction naming (see `diagnostics.ts`):
 *
 * - backward direction broken (record without binding) →
 *   `missing-member-binding` (the "missing child" crash window);
 * - forward direction broken (binding without record) →
 *   `orphan-member-binding` (the "diagnosable orphan");
 * - both sides present but disagreeing on the child →
 *   `member-child-mismatch`;
 * - the child bound under the wrong root / instance / kind →
 *   `child-bound-to-other-root` / `child-bound-to-other-instance` /
 *   `binding-kind-conflict`;
 * - one child claimed by several records → `duplicate-child-claim`;
 * - root-level wrong root: artifacts under a root without a TeamSession →
 *   `team-session-missing`; TeamSession without its root binding →
 *   `missing-root-binding`; root bound with the wrong kind →
 *   `root-binding-kind-conflict`.
 *
 * Durable state only: no live Agent, no DSH runtime call, no side effect
 * outside the injected repositories.
 *
 * @module @dsh-agent-team/storage/bindings/reconciler
 */
import type { TeamDomainRepositories } from '../repositories/index.js';
import type { BindingDiagnostic, BindingDiagnosticCode } from './diagnostics.js';
/**
 * One bidirectional-integrity report for one team root.
 *
 * `consistent` is `true` exactly when no diagnostic was found. `byCode`
 * counts diagnostics per code (only codes with at least one occurrence
 * are present).
 */
export interface TeamBindingReconciliationReport {
    /** The reconciliation scope root (team root session id). */
    readonly rootSessionId: string;
    /** `true` when no integrity violation was found. */
    readonly consistent: boolean;
    /** Whether a TeamSession record exists for the scope root. */
    readonly teamSessionPresent: boolean;
    /** The number of MemberInstanceRecords checked for the scope team. */
    readonly memberRecordsChecked: number;
    /** The number of `team-member` binding rows checked for the scope team. */
    readonly memberBindingsChecked: number;
    /** Every diagnostic found, sorted by (code, sessionId, instanceId). */
    readonly diagnostics: readonly BindingDiagnostic[];
    /** Diagnostic counts per code (only non-zero codes present). */
    readonly byCode: Partial<Record<BindingDiagnosticCode, number>>;
}
/**
 * Reconcile the SessionBinding integrity of one team (one root session).
 *
 * Pure read: throws only for malformed input ids or malformed/non-
 * canonical stored rows (the repository-layer `RECORD_INVALID` /
 * `SEAM_FAILURE` classification passes through unchanged).
 *
 * @param repositories - the open TeamDomain repositories (injected).
 * @param rootSessionId - the team root session id to reconcile.
 * @returns the frozen, deterministic reconciliation report.
 * @throws `RECORD_INVALID` (contracts code preserved) for a malformed root
 *   session id; the repository errors for malformed stored rows.
 */
export declare function reconcileTeamBindings(repositories: TeamDomainRepositories, rootSessionId: string): TeamBindingReconciliationReport;
//# sourceMappingURL=reconciler.d.ts.map