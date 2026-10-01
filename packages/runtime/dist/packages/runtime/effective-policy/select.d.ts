/**
 * The deterministic overlay/override selection from the durable `overrides`
 * store into the policy resolver's overlay slots (step 8 input half) — the
 * frozen P8-S4B selection, relocated verbatim (pre-alpha3 PR-B) from
 * `activation/checks.ts` into the canonical read plane so the ONE assembly
 * entry imports its building blocks without a module cycle. The
 * `activation` package re-exports it unchanged (API surface intact).
 *
 * Mapping (closed, documented ruling):
 * - `kind: 'autonomy-overlay'`, `scope: 'team'` → the `templateOverlay`
 *   slot;
 * - `kind: 'autonomy-overlay'`, `scope: 'instance'` (this instance) → the
 *   `instanceOverlay` slot;
 * - `kind: 'human-override'` → the `humanOverride` slot (the instance-
 *   scoped slot's LATEST event wins over the team-scoped slot's LATEST
 *   event, per the policy contract; a slot whose latest event is a RESET
 *   TOMBSTONE — an empty values set, the audit-preserving reset, PR-A /
 *   ADR-05 — has NO effective value for that slot and the precedence
 *   falls to the team slot, which falls to the lower layers when IT is a
 *   tombstone; an OLDER event of the same slot is never resurrected —
 *   the pre-reset history is audit-only);
 * - multiple candidates for one slot: the HIGHEST `generation` wins, ties
 *   broken by the LEXICOGRAPHICALLY SMALLEST `recordId` (deterministic;
 *   multi-overlay composition is owned by the later governance work).
 *
 * The stored `values` payload passes through UNTOUCHED: the policy resolver
 * re-validates it (a malformed stored payload fails closed in step 8).
 *
 * @param overrides - the durable governance override records (all teams).
 * @param rootSessionId - the team (root) session id.
 * @param instanceId - the instance being activated.
 * @returns the selected overlay slots (absent when no candidate exists).
 */
import type { AutonomyOverlayRecord, HumanOverrideRecord } from '../../domain/policy/src/index.js';
import type { GovernanceOverrideRecord } from '../../storage/schema/index.js';
export declare function selectPolicyOverrides(overrides: readonly GovernanceOverrideRecord[], rootSessionId: string, instanceId: string): {
    readonly templateOverlay?: AutonomyOverlayRecord;
    readonly instanceOverlay?: AutonomyOverlayRecord;
    readonly humanOverride?: HumanOverrideRecord;
    /**
     * The LATEST durable event of each human-override slot (tombstone
     * included) — the staleness anchor of the canonical read counts every
     * slot commit the read reflects (a reset tombstone is such a commit
     * even though it contributes no value).
     */
    readonly humanSlotEvents?: {
        readonly instance?: GovernanceOverrideRecord;
        readonly team?: GovernanceOverrideRecord;
    };
};
//# sourceMappingURL=select.d.ts.map