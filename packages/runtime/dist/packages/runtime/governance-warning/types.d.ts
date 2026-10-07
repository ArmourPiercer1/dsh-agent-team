/**
 * A4-PR6 (stage 6.0) — the GovernanceWarning vocabulary, FROZEN.
 *
 * What this module is: the closed vocabulary for the ONE non-blocking
 * governance diagnostic Alpha.4 admits — the envelope-consistency warning
 * (spec §15). It is a DIAGNOSTIC about the three-way relation between the
 * blueprint's declared leader envelope, the Team hard envelope and the
 * effective evaluation; it is NOT authority, NOT a ControlRequest, and NOT a
 * status the Team waits in (spec §15.0, ADR A5-10; the warning mints no
 * `ControlRequest` row, no leg, and no entry in the decision vocabulary —
 * pinned by `packages/runtime/test/a4p6-governance-warning.test.ts`).
 *
 * THREE action vocabularies exist in this lane and they are DISTINCT sets
 * (the coordination ruling on the vocabulary-drift class):
 *
 * - {@link INTERVENTION_ACTIONS} (`intervention/types.ts`) — the REVIEWER
 *   plane: `allow | deny | escalate`. `acknowledge` never enters it.
 * - {@link CONTROL_DECISION_VALUES} (`control/types.ts`) — the decision
 *   plane written to durable decision rows. `acknowledge` never enters it.
 * - {@link GOVERNANCE_WARNING_ACTIONS} (this module) — the WARNING plane:
 *   exactly `acknowledge`. A warning ack changes reminder state only; it
 *   never affects the authority evaluator and never clears
 *   `migration-required` (plan §6.A, A5-10).
 *
 * The shared rendering surface (`InterventionItem.legalActions`) is a UNION
 * of the plane-specific vocabularies, never a fourth global vocabulary
 * (stated again at the widened type in `intervention/types.ts`).
 *
 * Pure vocabulary module: no I/O, no imports from the plugin layer, no
 * imports from `intervention/**` (the intervention-lane import law runs the
 * other direction).
 *
 * @module @dsh-agent-team/runtime/governance-warning/types
 */
/**
 * The two durable fact types this lane writes (append-only ledger history):
 *
 * - `governance-warning-observed` — one observation of a mismatch /
 *   undetermined diagnostic, bound to a config+runtime fingerprint
 *   (spec §15.4). Dedup is FINGERPRINT-keyed: a repeat observation updates
 *   count/time in the folded projection, it does not mint a second warning.
 * - `governance-warning-acknowledged` — the acknowledgement of a warning
 *   FINGERPRINT by a principal (spec §15.5). Reminder state only.
 */
export declare const GOVERNANCE_WARNING_FACT_TYPES: Readonly<{
    readonly OBSERVED: "governance-warning-observed";
    readonly ACKNOWLEDGED: "governance-warning-acknowledged";
}>;
/** One of the warning fact-type values. */
export type GovernanceWarningFactType = (typeof GOVERNANCE_WARNING_FACT_TYPES)[keyof typeof GOVERNANCE_WARNING_FACT_TYPES];
/** Every warning fact-type value, for closed-set membership checks. */
export declare const GOVERNANCE_WARNING_FACT_TYPE_VALUES: readonly string[];
/**
 * The consistency verdicts of the envelope-consistency diagnostic
 * (spec §15.3). Only `mismatch` and `undetermined` mint warnings;
 * `consistent` writes NOTHING durable (pinned 6.A).
 *
 * `undetermined` absorbs: a comparison that cannot decide (unreadable
 * canonicalisation context, undetermined matcher cell) must never be
 * reported as `consistent` (A5-2's absorbing-cell law, mirrored here).
 */
export declare const GOVERNANCE_WARNING_VERDICTS: Readonly<{
    readonly CONSISTENT: "consistent";
    readonly MISMATCH: "mismatch";
    readonly UNDETERMINED: "undetermined";
}>;
/** One of the closed consistency verdicts. */
export type GovernanceWarningVerdict = (typeof GOVERNANCE_WARNING_VERDICTS)[keyof typeof GOVERNANCE_WARNING_VERDICTS];
/** The verdicts that mint a warning (everything except `consistent`). */
export declare const GOVERNANCE_WARNING_MINTING_VERDICTS: readonly GovernanceWarningVerdict[];
/**
 * The closed warning KINDS. Alpha.4 has exactly one kind — the
 * envelope-consistency diagnostic (spec §15). The source-kind slot in the
 * intervention projection (`governance-warning`) maps 1:1 onto this.
 */
export declare const GOVERNANCE_WARNING_KINDS: Readonly<{
    readonly ENVELOPE_CONSISTENCY: "envelope-consistency";
}>;
/** One of the closed warning kinds. */
export type GovernanceWarningKind = (typeof GOVERNANCE_WARNING_KINDS)[keyof typeof GOVERNANCE_WARNING_KINDS];
/**
 * The WARNING-plane action vocabulary: exactly `acknowledge`.
 *
 * It is NOT a reviewer action (it never resolves an approval case) and NOT a
 * decision value (it never lands in a `ControlDecisionRecord`). The v8 wire
 * `intervention.act` admits the UNION of this set with the reviewer actions
 * and routes by the item's SOURCE KIND server-side; the item's plane decides
 * which entry point the action reaches (6.B).
 */
export declare const GOVERNANCE_WARNING_ACTIONS: Readonly<{
    readonly ACKNOWLEDGE: "acknowledge";
}>;
/** One of the closed warning-plane actions. */
export type GovernanceWarningAction = (typeof GOVERNANCE_WARNING_ACTIONS)[keyof typeof GOVERNANCE_WARNING_ACTIONS];
/** Every warning-plane action value, for closed-set membership checks. */
export declare const GOVERNANCE_WARNING_ACTION_VALUES: readonly string[];
/**
 * The inputs that bind a warning fingerprint (spec §15.4). Two stages:
 *
 * - CONFIGURATION stage (create/publish diagnostic, no filesystem): the
 *   blueprint content hash + the normalized envelope documents + the
 *   diagnostic kind + the validation scope. Canonicalisation-dependent
 *   matchers are compared STRUCTURALLY, and a subtree relation that cannot
 *   be decided from the declaration alone yields `undetermined`, never a
 *   fabricated `consistent`.
 * - TEAM-START / RUNTIME stage: additionally the concrete TeamSession id and
 *   the canonicalisation-dependent matchers resolved in the real
 *   workspace/provider context.
 *
 * The fingerprint is the dedup key AND the acknowledgement key: acknowledgement
 * binds the fingerprint, and any drift in these inputs produces a different
 * fingerprint and therefore an unacknowledged warning (spec §15.5).
 */
export interface GovernanceWarningFingerprintInput {
    /** Which diagnostic produced the verdict (Alpha.4: envelope-consistency). */
    readonly kind: GovernanceWarningKind;
    /** Configuration (`create/publish`) or concrete-team (`start/runtime`) stage. */
    readonly stage: 'configuration' | 'runtime';
    /** The bound blueprint's content hash, when the team stage has one. */
    readonly blueprintContentHash?: string;
    /** The bound blueprint's schema version (orthogonal to the wire version). */
    readonly blueprintSchemaVersion?: number;
    /** The normalized leader (permission-mutation) envelope, canonically serialized. */
    readonly leaderEnvelope: string;
    /** The normalized Team hard envelope, canonically serialized. */
    readonly teamHardEnvelope: string;
    /** The concrete TeamSession (runtime stage only). */
    readonly teamSessionId?: string;
    /** The workspace/provider canonicalisation identity (runtime stage only). */
    readonly canonicalizationContext?: string;
}
/**
 * The folded durable warning, as the source adapter publishes it (6.A/6.B).
 * Every field is derived from ledger history; nothing here is accepted as
 * input by any write path, and nothing here is authority (spec §14.2).
 */
export interface GovernanceWarningSnapshot {
    /** Derived, fingerprint-stable: `warn-<fingerprint-prefix>` (never random). */
    readonly warningId: string;
    /** The intervention identity the client acts on: `int-warn-<warningId>`. */
    readonly interventionId: string;
    readonly teamSessionId: string;
    readonly kind: GovernanceWarningKind;
    /** The dedup + acknowledgement key (spec §15.4). */
    readonly fingerprint: string;
    /** Always a minting verdict — a `consistent` diagnostic has no snapshot. */
    readonly verdict: 'mismatch' | 'undetermined';
    /** How many times this fingerprint has been observed since acknowledgement. */
    readonly observationCount: number;
    readonly firstObservedAt: string;
    readonly lastObservedAt: string;
    /** Acknowledgement is reminder state ONLY (spec §15.5). */
    readonly acknowledged: boolean;
    readonly acknowledgedBy?: string;
    readonly acknowledgedAt?: string;
    readonly acknowledgementNote?: string;
}
/**
 * The closed start-gate outcomes:
 *
 * - `open` — start proceeds (this includes the v1/v2 BRIDGE window: PR6
 *   keeps today's bridge behaviour; PR7 7.2 replaces it, plan:603).
 * - `warning-required` — the durable Team root EXISTS and stays NOT LIVE;
 *   the Leader does not start. Acknowledgement re-enters the SAME gate
 *   through the existing `ensureRootLive` / open path — never bypasses it.
 * - `corrupt` — start blocked; NOT acknowledgeable (unreadable/corrupt
 *   authority documents fail closed, plan:602).
 * - `migration-required` — reserved for the v1/v2 cutover (PR7 7.2).
 *   **No acknowledgement clears this outcome, in PR6 or after** (plan:594).
 *   The arm exists, is unit-pinned as ack-immune, and is UNREACHABLE in PR6
 *   (the bridge keeps v1/v2 start alive) — disclosed.
 */
export declare const GOVERNANCE_START_STATUSES: Readonly<{
    readonly OPEN: "open";
    readonly WARNING_REQUIRED: "warning-required";
    readonly CORRUPT: "corrupt";
    readonly MIGRATION_REQUIRED: "migration-required";
}>;
/** The closed set of corruption reasons for the `corrupt` outcome. */
export declare const GOVERNANCE_START_CORRUPT_REASONS: Readonly<{
    readonly AUTHORITY_DOCUMENT_UNREADABLE: "authority-document-unreadable";
    readonly AUTHORITY_DOCUMENT_CORRUPT: "authority-document-corrupt";
}>;
/** One of the closed corrupt-gate reasons. */
export type GovernanceStartCorruptReason = (typeof GOVERNANCE_START_CORRUPT_REASONS)[keyof typeof GOVERNANCE_START_CORRUPT_REASONS];
/** One outcome of the Team-start governance gate. */
export type GovernanceStartOutcome = {
    readonly status: 'open';
} | {
    readonly status: 'warning-required';
    readonly interventionId: string;
    readonly warningId: string;
} | {
    readonly status: 'corrupt';
    readonly reason: GovernanceStartCorruptReason;
} | {
    readonly status: 'migration-required';
};
/**
 * The ONE port the plugin layer consumes for the start gate (frozen shape,
 * ruling PR6-D). Supplied by `root.ts`; consumed ONLY at the two
 * `team.create` sites and the `ensureRootLive` path. `activation/checks.ts`
 * and `admission/requirement-gate.ts` are NOT control points (plan §6.A —
 * they gate nothing on this path; pinned structurally by the 6.A tests).
 */
export type GovernanceStartCheck = (teamSessionId: string) => Promise<GovernanceStartOutcome>;
/** One acknowledgement, as recorded durably (fingerprint-bound, spec §15.5). */
export interface GovernanceWarningAcknowledgement {
    readonly warningId: string;
    readonly fingerprint: string;
    /** Server-derived caller principal id (Remote principal derivation, 6.B). */
    readonly acknowledgedBy: string;
    readonly acknowledgedAt: string;
    readonly note?: string;
}
/** Input for an acknowledgement request, before principal derivation. */
export interface GovernanceWarningAcknowledgeInput {
    readonly teamSessionId: string;
    /** The projected identity `int-warn-<warningId>` (validated, never trusted). */
    readonly interventionId: string;
    /** The server-derived caller principal (never client-supplied). */
    readonly callerPrincipalId: string;
    readonly note?: string;
}
/** The outcome of an acknowledgement request (closed set). */
export type GovernanceWarningAcknowledgeOutcome = {
    readonly kind: 'acknowledged';
    readonly acknowledgement: GovernanceWarningAcknowledgement;
} | {
    readonly kind: 'already-acknowledged';
    readonly acknowledgement: GovernanceWarningAcknowledgement;
} | {
    readonly kind: 'not-found';
} | {
    readonly kind: 'not-acknowledgeable';
    readonly reason: 'migration-required' | 'corrupt';
};
/**
 * The structural view of one envelope rule the comparator consumes. Declared
 * locally (structural typing) so this lane holds no import edge into the
 * domain grammar or the plugin plane; the caller canonicalises.
 */
export interface GovernanceEnvelopeRuleView {
    readonly operationClass: string;
    /** The closed effect lane of the rule. */
    readonly effect: 'deny' | 'ask' | 'allow';
    /** The closed matcher kinds. */
    readonly matcherKind: 'exact' | 'subtree' | 'fingerprint';
    /** The canonical matcher key (already canonically serialized). */
    readonly matcherKey: string;
}
/** One envelope in comparator form. */
export interface GovernanceEnvelopeView {
    readonly rules: readonly GovernanceEnvelopeRuleView[];
}
/** The verdict plus the witnesses that produced it (diagnostics, never authority). */
export interface GovernanceConsistencyResult {
    readonly verdict: GovernanceWarningVerdict;
    /**
     * A canonical fingerprint of the compared inputs (the CONFIGURATION-stage
     * fingerprint material — the caller binds stage/team/content-hash inputs
     * around it for the durable fingerprint).
     */
    readonly fingerprintMaterial: string;
    /** Human-readable witnesses for the log/UI detail block (capped). */
    readonly witnesses: readonly string[];
}
/**
 * Containment injection: does `parentKey` (a subtree matcher) cover
 * `pointKey`? Provided by the caller (canonical-path containment at runtime;
 * declaration-conservative at configuration stage). `undefined` = the
 * relation is UNDECIDABLE for this pair → the comparator absorbs it into
 * `undetermined` — it never guesses.
 */
export type EnvelopeContains = (parentKey: string, pointKey: string) => boolean | undefined;
//# sourceMappingURL=types.d.ts.map