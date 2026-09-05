/**
 * SessionBindingDto — the TeamDomain association between a DSH Session id
 * and Team root/member identity (Architecture §14.3 category C).
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **Any relevant DSH Session must be resolvable to
 *   `ordinary | team-root | team-member`** (§14.3 C). This is the vNext
 *   replacement for the legacy projection's event-scan heuristics: the
 *   binding is a durable TeamDomain fact, not a session-event vocabulary.
 * - **A member binding provides `childSessionId -> rootSessionId ->
 *   instanceId`** (§14.3 C): from a child session you recover the exact
 *   composite member identity (invariant 18) — never a label, never a
 *   legacy `memberId`.
 * - **TeamSessionId = RootSessionId** (invariant 9): in a `team-root`
 *   binding the `sessionId` IS the TeamSession id; no second field.
 * - **Every MemberInstance binds exactly one durable child Session**
 *   (invariant 23) — uniqueness enforced by
 *   {@link import('../uniqueness.js').assertChildSessionBindingUnique}.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/dto/session-binding
 */
import { assertSchemaVersion } from '../schema-version.js';
import { parseChildSessionId, parseRootSessionId, parseSessionId, } from '../ids/session-id.js';
import { parseInstanceId } from '../ids/instance-id.js';
import { assertNoUnknownFields, assertPlainRecord, } from './common.js';
import { assertNoLegacyFields } from '../legacy-vocabulary.js';
import { teamContractError } from '../errors.js';
import { canonicalJsonStringify, deepFreeze } from '../remote-safe.js';
/** The three frozen binding kinds (Architecture §14.3 C). */
export const SESSION_BINDING_KINDS = {
    /** An ordinary DSH session: no Team binding. */
    ORDINARY: 'ordinary',
    /** The root DSH session of a TeamSession (its id IS the TeamSessionId). */
    TEAM_ROOT: 'team-root',
    /** The durable child DSH session of one MemberInstance. */
    TEAM_MEMBER: 'team-member',
};
const FIELDS_BY_KIND = {
    ordinary: ['schemaVersion', 'kind', 'sessionId'],
    'team-root': ['schemaVersion', 'kind', 'sessionId'],
    'team-member': ['schemaVersion', 'kind', 'sessionId', 'rootSessionId', 'instanceId'],
};
function isSessionBindingKind(value) {
    return (value === SESSION_BINDING_KINDS.ORDINARY ||
        value === SESSION_BINDING_KINDS.TEAM_ROOT ||
        value === SESSION_BINDING_KINDS.TEAM_MEMBER);
}
function validateSessionBinding(record) {
    assertNoLegacyFields(record, 'SessionBinding');
    const kind = record['kind'];
    if (!isSessionBindingKind(kind)) {
        throw teamContractError('MALFORMED_DTO', `SessionBinding.kind must be one of ordinary | team-root | team-member, got ${JSON.stringify(kind)}`, { field: 'kind' });
    }
    assertNoUnknownFields(record, FIELDS_BY_KIND[kind], 'SessionBinding');
    assertSchemaVersion(record['schemaVersion']);
    if (kind === SESSION_BINDING_KINDS.ORDINARY) {
        return deepFreeze({
            schemaVersion: record['schemaVersion'],
            kind,
            sessionId: parseSessionId(record['sessionId']),
        });
    }
    if (kind === SESSION_BINDING_KINDS.TEAM_ROOT) {
        return deepFreeze({
            schemaVersion: record['schemaVersion'],
            kind,
            sessionId: parseRootSessionId(record['sessionId']),
        });
    }
    return deepFreeze({
        schemaVersion: record['schemaVersion'],
        kind,
        sessionId: parseChildSessionId(record['sessionId']),
        rootSessionId: parseRootSessionId(record['rootSessionId']),
        instanceId: parseInstanceId(record['instanceId']),
    });
}
/**
 * Parse and validate a SessionBindingDto from an untrusted value.
 * @param value - the unknown input (e.g. a decoded TeamDomain row).
 * @returns the frozen binding row.
 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_SESSION_ID`, `INVALID_ROOT_SESSION_ID`,
 *   `INVALID_CHILD_SESSION_ID`, or `INVALID_INSTANCE_ID`.
 */
export function parseSessionBinding(value) {
    return validateSessionBinding(assertPlainRecord(value, 'SessionBinding'));
}
/**
 * Serialize a binding row to its stable canonical JSON form (sorted keys).
 * @param binding - the binding row.
 * @returns the canonical JSON text.
 */
export function serializeSessionBinding(binding) {
    return canonicalJsonStringify(binding);
}
/**
 * Deserialize canonical JSON back into a validated, frozen binding row.
 * @param json - the canonical JSON text.
 * @returns the parsed binding row.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed row triggers.
 */
export function deserializeSessionBinding(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        throw teamContractError('MALFORMED_DTO', `SessionBinding JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, {});
    }
    return parseSessionBinding(value);
}
//# sourceMappingURL=session-binding.js.map