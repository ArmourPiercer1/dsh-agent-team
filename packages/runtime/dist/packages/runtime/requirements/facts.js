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
import { deepFreeze, teamContractError } from '../../contracts/src/index.js';
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js';
// ---------------------------------------------------------------------------
// fact types
// ---------------------------------------------------------------------------
/** The durable fact type: the human accepted (consented to) an optional-requirement degradation. */
export const OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE = 'optional-requirement-accepted';
/** The durable fact type: a template's availability was set (disabled / enabled). */
export const TEMPLATE_AVAILABILITY_SET_FACT_TYPE = 'template-availability-set';
/** The durable fact type: a recovery incident opened (a required requirement went down). */
export const RECOVERY_INCIDENT_OPENED_FACT_TYPE = 'recovery-incident-opened';
/** The durable fact type: a recovery incident closed (fresh evaluation PASS + materialization). */
export const RECOVERY_INCIDENT_CLOSED_FACT_TYPE = 'recovery-incident-closed';
/** Every PR-E requirement fact type. */
export const REQUIREMENT_FACT_TYPES = {
    optionalRequirementAccepted: OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE,
    templateAvailabilitySet: TEMPLATE_AVAILABILITY_SET_FACT_TYPE,
    recoveryIncidentOpened: RECOVERY_INCIDENT_OPENED_FACT_TYPE,
    recoveryIncidentClosed: RECOVERY_INCIDENT_CLOSED_FACT_TYPE,
};
/** Every fact-type value, for closed-set membership tests. */
export const REQUIREMENT_FACT_TYPE_VALUES = Object.values(REQUIREMENT_FACT_TYPES);
/** Guard: is `value` a closed PR-E requirement fact type? */
export function isRequirementFactType(value) {
    return typeof value === 'string' && REQUIREMENT_FACT_TYPE_VALUES.includes(value);
}
/**
 * The ledger category every PR-E requirement fact lands in (the FROZEN
 * `compatibility` category — NO new category). This is the single source the
 * host projection-source and the client mirror read (the closed
 * fact-type → category table).
 */
export const REQUIREMENT_FACT_CATEGORY = 'compatibility';
// ---------------------------------------------------------------------------
// closed payload shapes
// ---------------------------------------------------------------------------
/** The closed payload fields of `optional-requirement-accepted`. */
export const OPTIONAL_REQUIREMENT_ACCEPTED_FIELDS = [
    'requirementId',
    'generation',
    'consentedAt',
    'consentedBy',
    // Finding J (2026-10-01, ADR-12) — the ADDITIVE consent key fields (the
    // scope + blueprint content hash the consent binds to). Absent on legacy
    // rows (written before the keying); a keyed evaluation treats a legacy row
    // as NOT consented (fail-closed — it must be re-granted).
    'scopeKey',
    'contentHash',
];
/** The closed payload fields of `template-availability-set`. */
export const TEMPLATE_AVAILABILITY_SET_FIELDS = ['templateId', 'available', 'at'];
/** The closed payload fields of `recovery-incident-opened`. */
export const RECOVERY_INCIDENT_OPENED_FIELDS = ['scope', 'requirementIds', 'openedAt'];
/** The closed payload fields of `recovery-incident-closed`. */
export const RECOVERY_INCIDENT_CLOSED_FIELDS = ['scope', 'requirementIds', 'closedAt'];
// ---------------------------------------------------------------------------
// fail-closed row parsers (present-but-wrong-type = malformed; corrupted = absent)
// ---------------------------------------------------------------------------
function assertNonEmptyString(value, field, path) {
    if (typeof value !== 'string' || value.length === 0) {
        throw teamContractError('MALFORMED_DTO', `${path}.${field} must be a non-empty string`, { path, field });
    }
    return value;
}
function assertInt(value, field, path) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
        throw teamContractError('MALFORMED_DTO', `${path}.${field} must be a non-negative integer`, { path, field });
    }
    return value;
}
function assertBool(value, field, path) {
    if (typeof value !== 'boolean') {
        throw teamContractError('MALFORMED_DTO', `${path}.${field} must be a boolean`, { path, field });
    }
    return value;
}
function assertStringArray(value, field, path) {
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
        throw teamContractError('MALFORMED_DTO', `${path}.${field} must be an array of strings`, { path, field });
    }
    return [...value];
}
/** Parse a fail-closed `optional-requirement-accepted` payload. */
export function parseOptionalRequirementAccepted(payload, path) {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw teamContractError('MALFORMED_DTO', `${path} must be a plain object`, { path });
    }
    const record = payload;
    const out = {
        requirementId: assertNonEmptyString(record.requirementId, 'requirementId', path),
        generation: assertInt(record.generation, 'generation', path),
        consentedAt: assertInt(record.consentedAt, 'consentedAt', path),
        consentedBy: assertNonEmptyString(record.consentedBy, 'consentedBy', path),
    };
    // Finding J (2026-10-01) — the ADDITIVE consent key fields: absent on
    // legacy rows (a legacy row is legal — it is honored fail-closed by the
    // keyed matching); present-but-wrong-type = malformed (fail closed).
    if (record.scopeKey !== undefined) {
        out.scopeKey = assertNonEmptyString(record.scopeKey, 'scopeKey', path);
    }
    if (record.contentHash !== undefined) {
        out.contentHash = assertNonEmptyString(record.contentHash, 'contentHash', path);
    }
    return deepFreeze(out);
}
/** Parse a fail-closed `template-availability-set` payload. */
export function parseTemplateAvailabilitySet(payload, path) {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw teamContractError('MALFORMED_DTO', `${path} must be a plain object`, { path });
    }
    const record = payload;
    return deepFreeze({
        templateId: assertNonEmptyString(record.templateId, 'templateId', path),
        available: assertBool(record.available, 'available', path),
        at: assertInt(record.at, 'at', path),
    });
}
/** Parse a fail-closed `recovery-incident-opened` payload. */
export function parseRecoveryIncidentOpened(payload, path) {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw teamContractError('MALFORMED_DTO', `${path} must be a plain object`, { path });
    }
    const record = payload;
    return deepFreeze({
        scope: assertNonEmptyString(record.scope, 'scope', path),
        requirementIds: assertStringArray(record.requirementIds, 'requirementIds', path),
        openedAt: assertInt(record.openedAt, 'openedAt', path),
    });
}
/** Parse a fail-closed `recovery-incident-closed` payload. */
export function parseRecoveryIncidentClosed(payload, path) {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw teamContractError('MALFORMED_DTO', `${path} must be a plain object`, { path });
    }
    const record = payload;
    return deepFreeze({
        scope: assertNonEmptyString(record.scope, 'scope', path),
        requirementIds: assertStringArray(record.requirementIds, 'requirementIds', path),
        closedAt: assertInt(record.closedAt, 'closedAt', path),
    });
}
// ---------------------------------------------------------------------------
// pure payload builders (omit-when-absent, deep-frozen)
// ---------------------------------------------------------------------------
/** Build a deep-frozen `optional-requirement-accepted` payload. */
export function optionalRequirementAcceptedPayload(args) {
    return parseOptionalRequirementAccepted({
        requirementId: args.requirementId,
        generation: args.generation,
        consentedAt: args.consentedAt,
        consentedBy: args.consentedBy,
        ...(args.scopeKey !== undefined ? { scopeKey: args.scopeKey } : {}),
        ...(args.contentHash !== undefined ? { contentHash: args.contentHash } : {}),
    }, 'optional-requirement-accepted');
}
/** Build a deep-frozen `template-availability-set` payload. */
export function templateAvailabilitySetPayload(args) {
    return parseTemplateAvailabilitySet({ templateId: args.templateId, available: args.available, at: args.at }, 'template-availability-set');
}
/** Build a deep-frozen `recovery-incident-opened` payload. */
export function recoveryIncidentOpenedPayload(args) {
    return parseRecoveryIncidentOpened({ scope: args.scope, requirementIds: [...args.requirementIds], openedAt: args.openedAt }, 'recovery-incident-opened');
}
/** Build a deep-frozen `recovery-incident-closed` payload. */
export function recoveryIncidentClosedPayload(args) {
    return parseRecoveryIncidentClosed({ scope: args.scope, requirementIds: [...args.requirementIds], closedAt: args.closedAt }, 'recovery-incident-closed');
}
// ---------------------------------------------------------------------------
// the writer (mirrors writeCapabilityRuntimeEvent: allocateSequence then put)
// ---------------------------------------------------------------------------
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
export async function writeRequirementFact(ledger, rootSessionId, factType, payload, now) {
    if (!isRequirementFactType(factType)) {
        throw teamContractError('MALFORMED_DTO', `unknown requirement fact type '${factType}'`, { factType });
    }
    const sequence = await ledger.allocateSequence();
    await ledger.put({
        schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
        sequence,
        rootSessionId,
        factType,
        payload,
        createdAt: now(),
    });
}
//# sourceMappingURL=facts.js.map