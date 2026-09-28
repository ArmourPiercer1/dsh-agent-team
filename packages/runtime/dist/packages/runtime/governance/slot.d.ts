/**
 * pre-alpha3 PR-A — the PURE slot kernel of the production governance
 * mutation authority (no ports, no I/O; every failure is a typed
 * {@link MutationError}).
 *
 * The kernel owns the rules the service applies BEFORE and AROUND the
 * durable commit:
 *
 * - **slot closure by authority** (ADR-04 precedence, Architecture
 *   §19.4/§19.5): leader -> team-scope `autonomy-overlay` (origin
 *   leader), member -> own instance-scope `autonomy-overlay` (origin
 *   member), operator -> `human-override` (team or instance scope, never
 *   an origin). The slot is CLOSED by the authority — a leader cannot
 *   issue an instance-scope overlay (the P7-T2 frozen scope rule; the
 *   forked remote path that admitted leader-instance-scope overlays is
 *   typed-rejected by this kernel), a member cannot issue team scope or
 *   overlay another instance (the reset hole the PR closes), and no
 *   agent authority can issue a human override (traceability,
 *   Architecture §14.3 D).
 * - **closed cell vocabulary + PolicyEntry shapes** (the frozen domain
 *   structural rules, one error surface).
 * - **write-time envelope** (agent origins; invariants 36/37) — the
 *   FROZEN P7-T2 envelope kernels reused verbatim: a member is checked
 *   against its OWN cell envelope, a leader against the intersection of
 *   every registered member's cell envelope (skipped when no member is
 *   registered — the documented P7-T2 ruling). `deny` entries always
 *   pass (tightening never escalates).
 * - **write-time external hard facts** (EVERY origin, human included —
 *   the ADR-04 absolute ceiling; the forked remote path checked NOTHING
 *   here, so this PR is the tightening that closes the hole): a grant of
 *   an absent capability, a hard-denied capability, or items beyond the
 *   hard allow-list is rejected before any durable write.
 * - **desired-state no-op**: a set whose merged slot values equal the
 *   current slot winner's values commits NOTHING (no record, no
 *   generation bump).
 * - **reset as tombstone**: a higher-generation full-slot record with an
 *   EMPTY `values` set (never a storage delete — the audit trail keeps
 *   the revocation as a fact, and the frozen slot selection then
 *   contributes nothing for the slot, which is exactly "no override").
 *
 * @module @dsh-agent-team/runtime/governance/slot
 */
import { type CapabilityName, type MemberIdentity, type PolicyEntry } from '../../domain/policy/src/index.js';
import type { BlueprintPolicyEnvelope, ExternalPolicyFacts, TemplatePolicy } from '../../domain/policy/src/index.js';
import { selectSlotWinner, type MutationAuthority, type OverrideRecordView } from '../mutation/override-admission.js';
/** One closed policy slot (the kind/scope/instance the authority can act on). */
export interface GovernanceSlot {
    /** autonomy-overlay vs human-override (closed by the authority kind). */
    readonly kind: 'autonomy-overlay' | 'human-override';
    /** Present exactly when kind is 'autonomy-overlay' (traceability). */
    readonly origin?: 'leader' | 'member';
    /** team-scope vs instance-scope (closed by the authority rules). */
    readonly scope: 'team' | 'instance';
    /** Present exactly when scope is 'instance' (the addressed member). */
    readonly instanceId?: string;
}
/**
 * Close the policy slot by the acting authority (the ADR-04 / §20.3
 * authority->record mapping, with the scope rules the forked paths
 * disagreed on resolved to the FROZEN P7-T2 semantics):
 *
 * - `operator` -> `human-override`, the requested scope (team or
 *   instance; instance requires a clean target instance id);
 * - `leader`   -> `autonomy-overlay` origin leader, TEAM scope only
 *   (an instance-scope request is `UNAUTHORIZED_MUTATION` — per-instance
 *   tightening is the human override channel's, which outranks leader
 *   overlays by ADR-04 precedence anyway);
 * - `member`   -> `autonomy-overlay` origin member, INSTANCE scope
 *   targeting the member's OWN instance only (a team-scope request or a
 *   foreign instance is `UNAUTHORIZED_MUTATION` — the reset hole this
 *   PR closes).
 *
 * @throws {@link MutationError} `UNAUTHORIZED_MUTATION` (scope closed
 *   against the authority), `MALFORMED_MUTATION_INPUT` (bad id shapes).
 */
export declare function slotOf(authority: MutationAuthority, scope: 'team' | 'instance', instanceId: unknown): GovernanceSlot;
/**
 * Validate the closed cell vocabulary + the PolicyEntry shapes (the
 * frozen domain structural rules, one error surface).
 * @param cells - the requested cell changes (non-empty).
 * @returns the validated cells (capability -> normalized entry).
 */
export declare function assertCells(cells: Record<string, unknown>): Record<CapabilityName, PolicyEntry>;
/**
 * The write-time ENVELOPE check of the agent-origin cells (invariants
 * 36/37). Reuses the FROZEN P7-T2 envelope kernels verbatim — a member is
 * checked against its own cell envelope; a leader against the
 * intersection of every registered member's cell envelope (skipped when
 * no member is registered — the documented P7-T2 ruling). `deny` cells
 * always pass (tightening never escalates).
 *
 * @throws {@link MutationError} `MEMBER_SELF_ESCALATION` /
 *   `LEADER_OUT_OF_ENVELOPE`.
 */
export declare function checkCellsAgainstEnvelope(cells: Readonly<Record<CapabilityName, PolicyEntry>>, teamSessionId: string, origin: 'leader' | 'member', member: MemberIdentity | undefined, registeredMembers: readonly MemberIdentity[], blueprint: BlueprintPolicyEnvelope, templateFor: (teamSessionId: string, member: MemberIdentity) => TemplatePolicy): void;
/**
 * The write-time EXTERNAL HARD FACTS check (EVERY origin, human
 * included — invariant 35; the absolute ceiling no Team layer can
 * bypass). Reuses the exported P7-T2 kernel cell by cell.
 *
 * @throws {@link MutationError} `EXTERNAL_HARD_REJECTED`.
 */
export declare function checkCellsExternalHard(cells: Readonly<Record<CapabilityName, PolicyEntry>>, teamSessionId: string, external: ExternalPolicyFacts): void;
/** The slot identity (merge / winner domain). */
export interface SlotIdentity {
    readonly kind: GovernanceSlot['kind'];
    readonly scope: 'team' | 'instance';
    readonly rootSessionId: string;
    readonly instanceId?: string;
}
/** The slot identity of a closed slot + team. */
export declare function slotIdentityOf(slot: GovernanceSlot, rootSessionId: string): SlotIdentity;
/**
 * The frozen slot winner (reused verbatim from the admission kernel):
 * highest `generation`, ties -> lexicographically smallest `recordId`.
 */
export { selectSlotWinner };
/**
 * Whether the requested cells are a NO-OP against the current slot
 * winner: the merged full-slot values (winner + cells) equal the
 * winner's values byte for byte (canonical JSON comparison — the
 * PolicyEntry shapes are closed, so canonical equality IS semantic
 * equality). No winner can never be a no-op (a set with cells always
 * changes an empty slot).
 */
export declare function isNoChange(winner: OverrideRecordView | null, cells: Readonly<Record<CapabilityName, PolicyEntry>>): boolean;
/**
 * Merge the winner's values with the requested cells (the full slot
 * re-issue, v1 one-record-per-slot ruling).
 */
export declare function mergedSlotValues(winner: OverrideRecordView | null, cells: Readonly<Record<CapabilityName, PolicyEntry>>): Record<string, PolicyEntry>;
/**
 * The deterministic record id of one slot re-issue (the server-side
 * minting the remote contract never carries from clients): the
 * capability set (sorted, `+`-joined — a single capability keeps the
 * legacy `ovr-<cap>-...` shape), the scope target, and the CURRENT
 * winner generation (the new record lands at `generation + 1`).
 */
export declare function mintRecordId(capabilities: readonly string[], scope: 'team' | 'instance', instanceId: string | undefined, winnerGeneration: number): string;
/**
 * Build the storage record of one full-slot RE-ISSUE (the storage layer
 * re-validates the shape on put; identical bytes are idempotent,
 * different bytes at the same identity raise `RECORD_DUPLICATE`).
 */
export declare function buildReissueRecord(args: {
    readonly slot: GovernanceSlot;
    readonly rootSessionId: string;
    readonly recordId: string;
    readonly values: Record<string, PolicyEntry>;
    readonly winnerGeneration: number;
    readonly updatedAt: string;
}): Record<string, unknown>;
/**
 * Build the storage record of a RESET TOMBSTONE: the same slot
 * identity (kind/origin preserved — a member tombstone stays a member
 * tombstone, an operator's stays an operator's), the EMPTY values set,
 * the winner generation + 1. The tombstone wins the slot by generation;
 * the frozen read-side selection then contributes nothing for the slot.
 */
export declare function buildTombstoneRecord(args: {
    readonly slot: GovernanceSlot;
    readonly rootSessionId: string;
    readonly recordId: string;
    readonly winnerGeneration: number;
    readonly updatedAt: string;
}): Record<string, unknown>;
//# sourceMappingURL=slot.d.ts.map