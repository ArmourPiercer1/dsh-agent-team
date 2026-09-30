/**
 * P7-T2 — the mutation module's PURE KERNELS (pre-alpha3 PR-F, plan
 * §F.2: the `MutationService` class + its step-boundary machinery moved
 * to {@link ./internal/mutation-service.js} — the test-world kernel — and
 * this file keeps only the exported pure kernels the PRODUCTION
 * governance authority
 * ({@link @dsh-agent-team/runtime/governance}) reuses, so the intake
 * boundary and the durable write path speak ONE vocabulary):
 *
 * - {@link checkExternalHardFacts} — the external-hard-facts check of one
 *   policy cell (invariant 35, §19.2/§19.5);
 * - {@link normalizePolicyEntry} — the exact structural validation of one
 *   policy entry (the frozen domain validator's rules, this module's
 *   closed error code);
 * - {@link normalizeStateView} — the exact structural validation of one
 *   PolicyState target.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 *
 * @module @dsh-agent-team/runtime/mutation/service
 */
import type { CapabilityName, ExternalPolicyFacts, PolicyEntry, PolicyStateView, TeamSessionId } from '../../domain/policy/src/index.js';
/**
 * The external hard facts check of ONE policy cell value — the pure
 * kernel of {@link MutationService.checkExternalHard} (invariant 35,
 * §19.2/§19.5: an escalation beyond the external hard facts is rejected
 * for EVERY origin, human override included). `deny` values pass (a
 * tightening never escapes the hard facts).
 *
 * Exported kernel (pre-alpha3 PR-A): the production governance authority
 * (packages/runtime/governance) reuses it for its write-time checks, so
 * the intake service and the durable write path speak ONE vocabulary.
 *
 * @param teamSessionId - the team being checked (error context).
 * @param capability - the cell capability.
 * @param value - the normalized cell value.
 * @param external - the external hard facts (read by the caller).
 * @throws {@link MutationError} `EXTERNAL_HARD_REJECTED` (beyond the hard
 *   facts) or `MALFORMED_MUTATION_INPUT` (malformed facts from the reader).
 */
export declare function checkExternalHardFacts(teamSessionId: TeamSessionId, capability: CapabilityName, value: PolicyEntry, external: ExternalPolicyFacts): void;
/**
 * Validate + normalize one policy entry — the EXACT structural rules of
 * the frozen domain validator (a `deny` entry carries no extra fields; an
 * `allow` entry carries only kind+items, a non-empty array of unique
 * non-empty strings), normalized to a fresh deep-freezable copy under
 * this module's error code. Exported kernel: the production governance
 * authority (packages/runtime/governance, pre-alpha3 PR-A) reuses it for
 * its write-time cell validation (one closed error surface).
 */
export declare function normalizePolicyEntry(raw: unknown, field: string): PolicyEntry;
/**
 * Validate + normalize one PolicyState target — the EXACT structural
 * rules of the frozen domain validator (id-like `stateId`; closed
 * capability keys; a cell may only carry `locked` (boolean) and `value`
 * (policy entry)), normalized to a fresh deep-freezable copy. Exported
 * kernel: the production governance authority (packages/runtime/governance,
 * pre-alpha3 PR-A) reuses it for its PolicyState target validation.
 */
export declare function normalizeStateView(raw: unknown, field: string): PolicyStateView;
//# sourceMappingURL=service.d.ts.map