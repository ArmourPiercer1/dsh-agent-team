/**
 * TeamRootProjectionDto — the TeamSession identity + admission view carried
 * by the projection root (Architecture §14.3 category A + §28 + §34.1).
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - `teamSessionId` IS the root DSH session id (invariant 9); it must equal
 *   the top-level projection `teamSessionId` (validated by the top-level
 *   parser).
 * - **NO lifecycle field** (Architecture §8.6): a TeamSession has no
 *   Member-style lifecycle; its identity and admission are the frozen root
 *   facts. The negative surface is asserted by the P8-T1 tests.
 * - `policyState` is the current PolicyState name: opaque to the contract
 *   (policy states are blueprint-defined), label-validated only.
 * - `compatibility` is the frozen CompatibilitySummaryDto (states.ts
 *   vocabulary for `status`).
 * - `creationBudgetConsumed` is the count of root creations consumed by
 *   handoff into this session (>= 0; the handoff rule of Architecture
 *   §34.1 — a handoff may continue the session only while the budget is not
 *   exhausted).
 * - `handoffSourceSessionId` is the generic DSH session id of the session a
 *   handoff continued from (Architecture §34.1); key absent for a session
 *   that was created fresh (DURATIONAL-optional discipline: absent key,
 *   never an own `undefined` key).
 *
 * The root is an embedded value: the enclosing versioned record owns the
 * schema version, so the root carries none of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/root
 */
import { LABEL_MAX_LENGTH, assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField, parseLabelLikeField, parseWorkspaceField, } from '../dto/common.js';
import { parseSessionId, parseTeamSessionId } from '../ids/session-id.js';
import { assertNoLegacyFields } from '../legacy-vocabulary.js';
import { deepFreeze } from '../remote-safe.js';
import { assertNonNegativeInteger, toRecord } from './common.js';
import { parseCompatibilitySummary } from './compatibility.js';
import { parseAdmissionStateField } from './states.js';
/** The exact frozen fields of a TeamRootProjectionDto. */
export const TEAM_ROOT_PROJECTION_FIELDS = [
    'teamSessionId',
    'defaultWorkspace',
    'createdAt',
    'policyState',
    'admission',
    'compatibility',
    'creationBudgetConsumed',
    'handoffSourceSessionId',
];
function validateTeamRootProjection(record) {
    assertNoLegacyFields(record, 'TeamRootProjection');
    assertNoUnknownFields(record, TEAM_ROOT_PROJECTION_FIELDS, 'TeamRootProjection');
    for (const field of TEAM_ROOT_PROJECTION_FIELDS) {
        if (field !== 'defaultWorkspace' && field !== 'handoffSourceSessionId') {
            assertFieldPresent(record, field, 'TeamRootProjection');
        }
    }
    const base = {
        teamSessionId: parseTeamSessionId(record['teamSessionId']),
        createdAt: parseIso8601TimestampField(record['createdAt']),
        policyState: parseLabelLikeField(record['policyState'], 'policyState', LABEL_MAX_LENGTH),
        admission: parseAdmissionStateField(record['admission'], 'admission'),
        compatibility: parseCompatibilitySummary(record['compatibility']),
        creationBudgetConsumed: assertNonNegativeInteger(record['creationBudgetConsumed'], 'creationBudgetConsumed'),
    };
    const defaultWorkspace = record['defaultWorkspace'] === undefined
        ? {}
        : { defaultWorkspace: parseWorkspaceField(record['defaultWorkspace'], 'defaultWorkspace') };
    const handoffSourceSessionId = record['handoffSourceSessionId'] === undefined
        ? {}
        : { handoffSourceSessionId: parseSessionId(record['handoffSourceSessionId']) };
    return deepFreeze({ ...base, ...defaultWorkspace, ...handoffSourceSessionId });
}
/**
 * Parse and validate a TeamRootProjectionDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen root view.
 * @throws `MALFORMED_DTO`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, `INVALID_SESSION_ID`, or the field-specific
 *   codes of the embedded summary.
 */
export function parseTeamRootProjection(value) {
    return validateTeamRootProjection(assertPlainRecord(value, 'TeamRootProjection'));
}
/**
 * Build a fresh TeamRootProjectionDto from producer input (already branded
 * ids; the input must not carry own `undefined` keys).
 * @param input - the root fields.
 * @returns the frozen root view, validated through the same pipeline as
 *   `parseTeamRootProjection`.
 */
export function createTeamRootProjection(input) {
    const record = {
        teamSessionId: input.teamSessionId,
        createdAt: input.createdAt,
        policyState: input.policyState,
        admission: input.admission,
        compatibility: toRecord(input.compatibility),
        creationBudgetConsumed: input.creationBudgetConsumed,
    };
    if (input.defaultWorkspace !== undefined)
        record['defaultWorkspace'] = input.defaultWorkspace;
    if (input.handoffSourceSessionId !== undefined) {
        record['handoffSourceSessionId'] = input.handoffSourceSessionId;
    }
    return validateTeamRootProjection(record);
}
//# sourceMappingURL=root.js.map