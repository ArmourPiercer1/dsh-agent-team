/**
 * TeamSessionRecordDto — the TeamDomain record of a TeamSession
 * (Architecture §14.3 category A).
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **TeamSessionId = RootSessionId** (invariant 9): the record's
 *   `rootSessionId` field IS the TeamSession id; no separate TeamSession
 *   UUID is minted (§8.2).
 * - **One Root Session -> 0 or 1 TeamSession** (invariant 8) — enforced by
 *   {@link import('../uniqueness.js').assertTeamSessionUnique}.
 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
 *   (invariant 10); the snapshot ref is embedded, not replaced in place.
 * - The record is the durable sidecar authority's (TeamDomain's, invariant
 *   41) row for the session; TeamSession has no Member-style lifecycle
 *   (§8.6) — hence no lifecycle field here.
 *
 * The v1 record freezes the identity core of category A
 * (rootSessionId, blueprint snapshot, default workspace, creation
 * timestamp, version/generation). Category A's remaining fields
 * (PolicyState, overrides, admission state, ledger refs, handoff provenance)
 * are added by later versions with their owning tasks — the freeze rule in
 * CHANGELOG.md governs how. P8-S7-R4 adds the first of them: the
 * one-shot handoff provenance field `handoffSourceSessionId` (optional;
 * present exactly for teams created through a Start-Team-from-Here
 * handoff — Architecture §34, BQ-16).
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/dto/team-session-record
 */
import { TEAM_CONTRACT_SCHEMA_VERSION, assertSchemaVersion } from '../schema-version.js';
import { parseRootSessionId, parseSessionId } from '../ids/session-id.js';
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField, parseWorkspaceField, } from './common.js';
import { parseBlueprintSnapshotRef } from './blueprint-snapshot.js';
import { assertNoLegacyFields } from '../legacy-vocabulary.js';
import { assertPositiveInteger } from '../ids/common.js';
import { teamContractError } from '../errors.js';
import { canonicalJsonStringify, deepFreeze } from '../remote-safe.js';
/** The exact frozen fields of a TeamSessionRecordDto (v1). */
export const TEAM_SESSION_RECORD_FIELDS = [
    'schemaVersion',
    'rootSessionId',
    'blueprint',
    'defaultWorkspace',
    'createdAt',
    'generation',
    'handoffSourceSessionId',
];
function validateTeamSessionRecord(record) {
    assertNoLegacyFields(record, 'TeamSessionRecord');
    assertNoUnknownFields(record, TEAM_SESSION_RECORD_FIELDS, 'TeamSessionRecord');
    for (const field of TEAM_SESSION_RECORD_FIELDS) {
        if (field !== 'defaultWorkspace' && field !== 'handoffSourceSessionId') {
            assertFieldPresent(record, field, 'TeamSessionRecord');
        }
    }
    assertSchemaVersion(record['schemaVersion']);
    const base = {
        schemaVersion: record['schemaVersion'],
        rootSessionId: parseRootSessionId(record['rootSessionId']),
        blueprint: parseBlueprintSnapshotRef(record['blueprint']),
        createdAt: parseIso8601TimestampField(record['createdAt']),
        generation: assertPositiveInteger(record['generation'], 'generation'),
    };
    // An absent optional field must not become an own `undefined` key: the
    // frozen DTO is a lossless-JSON value (remote-safe.ts rejects undefined).
    const withWorkspace = record['defaultWorkspace'] === undefined
        ? base
        : {
            ...base,
            defaultWorkspace: parseWorkspaceField(record['defaultWorkspace'], 'defaultWorkspace'),
        };
    return deepFreeze(record['handoffSourceSessionId'] === undefined
        ? withWorkspace
        : {
            ...withWorkspace,
            handoffSourceSessionId: parseSessionId(record['handoffSourceSessionId']),
        });
}
/**
 * Parse and validate a TeamSessionRecordDto from an untrusted value.
 * @param value - the unknown input (e.g. a decoded TeamDomain row).
 * @returns the frozen record.
 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, or the blueprint id-specific codes.
 */
export function parseTeamSessionRecord(value) {
    return validateTeamSessionRecord(assertPlainRecord(value, 'TeamSessionRecord'));
}
/**
 * Build a fresh TeamSessionRecordDto (generation 1 creation path).
 * @param input - the identity fields; ids must already be branded.
 * @returns the frozen record with `schemaVersion` stamped to the v1 version.
 */
export function createTeamSessionRecord(input) {
    const record = {
        schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
        rootSessionId: input.rootSessionId,
        blueprint: {
            blueprintId: input.blueprint.blueprintId,
            revision: input.blueprint.revision,
            contentHash: input.blueprint.contentHash,
        },
        createdAt: input.createdAt,
        generation: input.generation,
    };
    if (input.defaultWorkspace !== undefined) {
        record['defaultWorkspace'] = input.defaultWorkspace;
    }
    if (input.handoffSourceSessionId !== undefined) {
        record['handoffSourceSessionId'] = input.handoffSourceSessionId;
    }
    return validateTeamSessionRecord(record);
}
/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export function serializeTeamSessionRecord(record) {
    return canonicalJsonStringify(record);
}
/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed record triggers.
 */
export function deserializeTeamSessionRecord(json) {
    let value;
    try {
        value = JSON.parse(json);
    }
    catch (error) {
        throw teamContractError('MALFORMED_DTO', `TeamSessionRecord JSON is not valid: ${error instanceof Error ? error.message : String(error)}`, {});
    }
    return parseTeamSessionRecord(value);
}
//# sourceMappingURL=team-session-record.js.map