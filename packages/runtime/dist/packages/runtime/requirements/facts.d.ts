/**
 * pre-alpha3 PR-E (plan §E.5) — the durable RequirementAuthority facts.
 *
 * The new durable facts of the requirement / recovery model. They land in the
 * TeamLedger under the FROZEN `compatibility` category (the category already
 * exists — the closed 8-category set is UNCHANGED; PR-E reuses it, exactly as
 * PR-C's `capability-runtime-event` did — NO new ledger category). Writing
 * through `ledger.put` advances `durableGeneration` (the storage S1-A hook).
 *
 * The four facts:
 *
 * - `optional-requirement-accepted` — the durable human consent to run
 *   degraded with one OPTIONAL requirement unmet (the DegradationConsent).
 *   SURVIVES restart (authority negative #10).
 * - `template-availability-set` — the durable template disable/enable (a
 *   template was disabled or re-enabled). SURVIVES restart.
 * - `recovery-incident-opened` — a recovery incident OPENED (a scope became
 *   blocked: a required requirement went down).
 * - `recovery-incident-closed` — a recovery incident CLOSED (the fresh
 *   evaluation PASSed + materialization satisfied; normal resumes at the next
 *   boundary). This is the DURABLE RECORD of the exit — but recovery itself
 *   remains DERIVED (no durable "recovery" flag; the closed fact is the
 *   incident's history, not a live state).
 *
 * The fact vocabulary is runtime-owned (mirrored on the client, the same
 * pattern as every other fact type) — contracts deliberately carries no
 * fact-type vocabulary.
 *
 * Pure module: no I/O beyond the injected `ledger` port (allocateSequence +
 * put) and the injected clock; no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/facts
 */
/** The durable fact type: the human accepted (consented to) an optional-requirement degradation. */
export declare const OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE = "optional-requirement-accepted";
/** The durable fact type: a template's availability was set (disabled / enabled). */
export declare const TEMPLATE_AVAILABILITY_SET_FACT_TYPE = "template-availability-set";
/** The durable fact type: a recovery incident opened (a required requirement went down). */
export declare const RECOVERY_INCIDENT_OPENED_FACT_TYPE = "recovery-incident-opened";
/** The durable fact type: a recovery incident closed (fresh evaluation PASS + materialization). */
export declare const RECOVERY_INCIDENT_CLOSED_FACT_TYPE = "recovery-incident-closed";
/** Every PR-E requirement fact type. */
export declare const REQUIREMENT_FACT_TYPES: {
    readonly optionalRequirementAccepted: "optional-requirement-accepted";
    readonly templateAvailabilitySet: "template-availability-set";
    readonly recoveryIncidentOpened: "recovery-incident-opened";
    readonly recoveryIncidentClosed: "recovery-incident-closed";
};
/** A closed PR-E requirement fact type. */
export type RequirementFactType = (typeof REQUIREMENT_FACT_TYPES)[keyof typeof REQUIREMENT_FACT_TYPES];
/** Every fact-type value, for closed-set membership tests. */
export declare const REQUIREMENT_FACT_TYPE_VALUES: readonly string[];
/** Guard: is `value` a closed PR-E requirement fact type? */
export declare function isRequirementFactType(value: unknown): value is RequirementFactType;
/**
 * The ledger category every PR-E requirement fact lands in (the FROZEN
 * `compatibility` category — NO new category). This is the single source the
 * host projection-source and the client mirror read (the closed
 * fact-type → category table).
 */
export declare const REQUIREMENT_FACT_CATEGORY = "compatibility";
/** The closed payload fields of `optional-requirement-accepted`. */
export declare const OPTIONAL_REQUIREMENT_ACCEPTED_FIELDS: readonly string[];
/** The durable optional-requirement-accepted payload (the DegradationConsent). */
export interface OptionalRequirementAccepted {
    readonly requirementId: string;
    readonly generation: number;
    readonly consentedAt: number;
    readonly consentedBy: string;
    /** The scope identity the consent was granted for (`team` / `template:<id>`); absent on legacy rows. */
    readonly scopeKey?: string;
    /** The bound blueprint's content hash the consent was granted against; absent on legacy rows. */
    readonly contentHash?: string;
}
/** The closed payload fields of `template-availability-set`. */
export declare const TEMPLATE_AVAILABILITY_SET_FIELDS: readonly string[];
/** The durable template-availability-set payload. */
export interface TemplateAvailabilitySet {
    readonly templateId: string;
    readonly available: boolean;
    readonly at: number;
}
/** The closed payload fields of `recovery-incident-opened`. */
export declare const RECOVERY_INCIDENT_OPENED_FIELDS: readonly string[];
/** The durable recovery-incident-opened payload. */
export interface RecoveryIncidentOpened {
    /** The scope key that became blocked (`team` / `template:<id>`). */
    readonly scope: string;
    /** The FATAL requirementIds in that scope. */
    readonly requirementIds: readonly string[];
    readonly openedAt: number;
}
/** The closed payload fields of `recovery-incident-closed`. */
export declare const RECOVERY_INCIDENT_CLOSED_FIELDS: readonly string[];
/** The durable recovery-incident-closed payload. */
export interface RecoveryIncidentClosed {
    readonly scope: string;
    readonly requirementIds: readonly string[];
    readonly closedAt: number;
}
/** Parse a fail-closed `optional-requirement-accepted` payload. */
export declare function parseOptionalRequirementAccepted(payload: unknown, path: string): OptionalRequirementAccepted;
/** Parse a fail-closed `template-availability-set` payload. */
export declare function parseTemplateAvailabilitySet(payload: unknown, path: string): TemplateAvailabilitySet;
/** Parse a fail-closed `recovery-incident-opened` payload. */
export declare function parseRecoveryIncidentOpened(payload: unknown, path: string): RecoveryIncidentOpened;
/** Parse a fail-closed `recovery-incident-closed` payload. */
export declare function parseRecoveryIncidentClosed(payload: unknown, path: string): RecoveryIncidentClosed;
/** Build a deep-frozen `optional-requirement-accepted` payload. */
export declare function optionalRequirementAcceptedPayload(args: {
    readonly requirementId: string;
    readonly generation: number;
    readonly consentedAt: number;
    readonly consentedBy: string;
    /** Finding J (2026-10-01) — the consent key: the granted scope (omit-when-absent, legacy rows). */
    readonly scopeKey?: string;
    /** Finding J (2026-10-01) — the consent key: the bound blueprint content hash (omit-when-absent, legacy rows). */
    readonly contentHash?: string;
}): OptionalRequirementAccepted;
/** Build a deep-frozen `template-availability-set` payload. */
export declare function templateAvailabilitySetPayload(args: {
    readonly templateId: string;
    readonly available: boolean;
    readonly at: number;
}): TemplateAvailabilitySet;
/** Build a deep-frozen `recovery-incident-opened` payload. */
export declare function recoveryIncidentOpenedPayload(args: {
    readonly scope: string;
    readonly requirementIds: readonly string[];
    readonly openedAt: number;
}): RecoveryIncidentOpened;
/** Build a deep-frozen `recovery-incident-closed` payload. */
export declare function recoveryIncidentClosedPayload(args: {
    readonly scope: string;
    readonly requirementIds: readonly string[];
    readonly closedAt: number;
}): RecoveryIncidentClosed;
/**
 * Durably write ONE requirement fact (one `ledger` row). Mirrors
 * `writeCapabilityRuntimeEvent`: `allocateSequence` (atomic on the domain
 * write chain) then `put` (idempotent on identical bytes). Writing through
 * `put` advances `durableGeneration`. A failure PROPAGATES (no silent drop).
 *
 * @param ledger - the OPENED TeamDomain `ledger` repository (allocate + put).
 * @param rootSessionId - the root the row is stamped with.
 * @param factType - the closed PR-E requirement fact type.
 * @param payload - the closed payload (already deep-frozen by the builder).
 *   Typed `object` (not `Record<string, unknown>`) because the closed payload
 *   builders return typed readonly shapes (interfaces carry no implicit index
 *   signature); the shape is already validated by the fail-closed parser.
 * @param now - the production ISO-8601 clock (`createdAt` stamp).
 */
export declare function writeRequirementFact(ledger: {
    allocateSequence(): Promise<number>;
    put(entry: Record<string, unknown>): Promise<unknown>;
}, rootSessionId: string, factType: RequirementFactType, payload: object, now: () => string): Promise<void>;
//# sourceMappingURL=facts.d.ts.map