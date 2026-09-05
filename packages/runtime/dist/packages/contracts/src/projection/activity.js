/**
 * Activity DTOs of the projection family (P8-T1): the durable per-member
 * activity summary and the per-member LIVE activity overlay.
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - The Durable side (MemberActivitySummaryDto) is a summary of TeamDomain
 *   activity facts (invariant 41): status (the closed P6-T2 progress set),
 *   subject/summary/lastAction text, correlation id, last progress
 *   timestamp, and the open live-work intervals. Every field is a
 *   DURATIONAL-optional field: absent key when the durable fact does not
 *   exist (never an own `undefined` key). A member with no durable activity
 *   facts omits the whole `activity` key on its member projection.
 * - The Live side (MemberLiveActivityDto) is the non-durable overlay of the
 *   current page state (UI §24 residency + current turn activity): it is
 *   ALWAYS the present key `liveActivity` on the member projection, with
 *   value `null` when the live source has no facts for that member (the
 *   nullable overlay, DevPlan §21.2). Residency is the one required field:
 *   a present overlay always says where the agent lives.
 * - The projection NEVER carries session-log facts: activity here is a
 *   TeamDomain summary, never a scan of Root+child Session logs (DevPlan
 *   §21.2).
 *
 * Both types are embedded values: the enclosing versioned record owns the
 * schema version, so neither carries one of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/activity
 */
import { assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField, } from '../dto/common.js';
import { teamContractError } from '../errors.js';
import { deepFreeze } from '../remote-safe.js';
import { parseOpaqueField } from './common.js';
import { parseProgressValueField, parseResidencyStateField } from './states.js';
/** Max length of an activity correlation id (opaque string). */
export const ACTIVITY_CORRELATION_MAX_LENGTH = 128;
/** Max length of an activity text field (subject, lastAction, currentAction). */
export const ACTIVITY_TEXT_MAX_LENGTH = 256;
/** Max length of an activity summary field. */
export const ACTIVITY_SUMMARY_MAX_LENGTH = 512;
// --- open work interval ----------------------------------------------------------------
/** The exact frozen fields of an ActivityIntervalSummary. */
export const ACTIVITY_INTERVAL_FIELDS = ['correlation', 'openedAt'];
/**
 * Parse and validate an ActivityIntervalSummary from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen interval summary.
 * @throws `MALFORMED_DTO` for a malformed container, field set, or value.
 */
export function parseActivityInterval(value) {
    const record = assertPlainRecord(value, 'ActivityInterval');
    assertNoUnknownFields(record, ACTIVITY_INTERVAL_FIELDS, 'ActivityInterval');
    return deepFreeze({
        correlation: parseOpaqueField(record['correlation'], 'correlation', ACTIVITY_CORRELATION_MAX_LENGTH),
        openedAt: parseIso8601TimestampField(record['openedAt']),
    });
}
// --- durable activity summary ---------------------------------------------------------
/** The exact frozen fields of a MemberActivitySummaryDto (all optional). */
export const MEMBER_ACTIVITY_SUMMARY_FIELDS = [
    'status',
    'subject',
    'summary',
    'lastAction',
    'correlation',
    'lastProgressAt',
    'openIntervals',
];
/**
 * Parse and validate a MemberActivitySummaryDto from an untrusted value.
 * All fields are optional; a present field must be valid.
 * @param value - the unknown input.
 * @returns the frozen summary (possibly empty).
 * @throws `MALFORMED_DTO` for a malformed container, unknown field, or
 *   invalid present field.
 */
export function parseMemberActivitySummary(value) {
    const record = assertPlainRecord(value, 'MemberActivitySummary');
    assertNoUnknownFields(record, MEMBER_ACTIVITY_SUMMARY_FIELDS, 'MemberActivitySummary');
    const status = record['status'] === undefined
        ? {}
        : { status: parseProgressValueField(record['status'], 'status') };
    const subject = record['subject'] === undefined
        ? {}
        : { subject: parseOpaqueField(record['subject'], 'subject', ACTIVITY_TEXT_MAX_LENGTH) };
    const summary = record['summary'] === undefined
        ? {}
        : { summary: parseOpaqueField(record['summary'], 'summary', ACTIVITY_SUMMARY_MAX_LENGTH) };
    const lastAction = record['lastAction'] === undefined
        ? {}
        : { lastAction: parseOpaqueField(record['lastAction'], 'lastAction', ACTIVITY_TEXT_MAX_LENGTH) };
    const correlation = record['correlation'] === undefined
        ? {}
        : {
            correlation: parseOpaqueField(record['correlation'], 'correlation', ACTIVITY_CORRELATION_MAX_LENGTH),
        };
    const lastProgressAt = record['lastProgressAt'] === undefined
        ? {}
        : { lastProgressAt: parseIso8601TimestampField(record['lastProgressAt']) };
    let openIntervals = {};
    if (record['openIntervals'] !== undefined) {
        if (!Array.isArray(record['openIntervals'])) {
            throw teamContractError('MALFORMED_DTO', `openIntervals must be an array, got ${typeof record['openIntervals']}`, { field: 'openIntervals' });
        }
        openIntervals = {
            openIntervals: record['openIntervals'].map((item) => parseActivityInterval(item)),
        };
    }
    return deepFreeze({ ...status, ...subject, ...summary, ...lastAction, ...correlation, ...lastProgressAt, ...openIntervals });
}
// --- live activity overlay --------------------------------------------------------------
/** The exact frozen fields of a MemberLiveActivityDto (residency required). */
export const MEMBER_LIVE_ACTIVITY_FIELDS = [
    'residency',
    'currentAction',
    'lastActivityAt',
    'runningSince',
    'admittedWorkCorrelation',
];
/**
 * Parse and validate a MemberLiveActivityDto from an untrusted value.
 * `residency` is required; the rest are optional live facts.
 * @param value - the unknown input.
 * @returns the frozen live overlay.
 * @throws `MALFORMED_DTO` for a malformed container, unknown field, missing
 *   residency, or invalid field.
 */
export function parseMemberLiveActivity(value) {
    const record = assertPlainRecord(value, 'MemberLiveActivity');
    assertNoUnknownFields(record, MEMBER_LIVE_ACTIVITY_FIELDS, 'MemberLiveActivity');
    const base = {
        residency: parseResidencyStateField(record['residency'], 'residency'),
    };
    const currentAction = record['currentAction'] === undefined
        ? {}
        : { currentAction: parseOpaqueField(record['currentAction'], 'currentAction', ACTIVITY_TEXT_MAX_LENGTH) };
    const lastActivityAt = record['lastActivityAt'] === undefined
        ? {}
        : { lastActivityAt: parseIso8601TimestampField(record['lastActivityAt']) };
    const runningSince = record['runningSince'] === undefined
        ? {}
        : { runningSince: parseIso8601TimestampField(record['runningSince']) };
    const admittedWorkCorrelation = record['admittedWorkCorrelation'] === undefined
        ? {}
        : {
            admittedWorkCorrelation: parseOpaqueField(record['admittedWorkCorrelation'], 'admittedWorkCorrelation', ACTIVITY_CORRELATION_MAX_LENGTH),
        };
    return deepFreeze({ ...base, ...currentAction, ...lastActivityAt, ...runningSince, ...admittedWorkCorrelation });
}
//# sourceMappingURL=activity.js.map