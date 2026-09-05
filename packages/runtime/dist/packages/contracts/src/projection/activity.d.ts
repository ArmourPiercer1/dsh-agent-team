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
import type { ProgressValue, ResidencyState } from './states.js';
/** Max length of an activity correlation id (opaque string). */
export declare const ACTIVITY_CORRELATION_MAX_LENGTH = 128;
/** Max length of an activity text field (subject, lastAction, currentAction). */
export declare const ACTIVITY_TEXT_MAX_LENGTH = 256;
/** Max length of an activity summary field. */
export declare const ACTIVITY_SUMMARY_MAX_LENGTH = 512;
/** The exact frozen fields of an ActivityIntervalSummary. */
export declare const ACTIVITY_INTERVAL_FIELDS: readonly string[];
/**
 * One open live-work interval (started, not yet closed): the correlation
 * id of the admitted work and the interval start.
 */
export interface ActivityIntervalSummary {
    /** Opaque correlation id of the admitted work. */
    readonly correlation: string;
    /** Interval start, ISO-8601. */
    readonly openedAt: string;
}
/**
 * Parse and validate an ActivityIntervalSummary from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen interval summary.
 * @throws `MALFORMED_DTO` for a malformed container, field set, or value.
 */
export declare function parseActivityInterval(value: unknown): ActivityIntervalSummary;
/** The exact frozen fields of a MemberActivitySummaryDto (all optional). */
export declare const MEMBER_ACTIVITY_SUMMARY_FIELDS: readonly string[];
/**
 * The durable per-member activity summary (a TeamDomain fact, invariant
 * 41). Every field is a DURATIONAL-optional field (absent key when the
 * fact does not exist).
 */
export interface MemberActivitySummaryDto {
    /** The last durable progress value (closed P6-T2 set). */
    readonly status?: ProgressValue;
    /** What the member is working on (<= 256 chars). */
    readonly subject?: string;
    /** A short human summary (<= 512 chars). */
    readonly summary?: string;
    /** The last durable action label (<= 256 chars). */
    readonly lastAction?: string;
    /** Opaque correlation id of the last durable progress fact. */
    readonly correlation?: string;
    /** Last durable progress timestamp, ISO-8601. */
    readonly lastProgressAt?: string;
    /** Open live-work intervals (no duplicates; order preserved). */
    readonly openIntervals?: readonly ActivityIntervalSummary[];
}
/**
 * Parse and validate a MemberActivitySummaryDto from an untrusted value.
 * All fields are optional; a present field must be valid.
 * @param value - the unknown input.
 * @returns the frozen summary (possibly empty).
 * @throws `MALFORMED_DTO` for a malformed container, unknown field, or
 *   invalid present field.
 */
export declare function parseMemberActivitySummary(value: unknown): MemberActivitySummaryDto;
/** The exact frozen fields of a MemberLiveActivityDto (residency required). */
export declare const MEMBER_LIVE_ACTIVITY_FIELDS: readonly string[];
/**
 * The non-durable live overlay of one member: where the agent lives right
 * now (residency) and what it is doing in the current turn. Always the
 * present key `liveActivity` on the member projection; the value is `null`
 * when the live source has no facts (the nullable overlay).
 */
export interface MemberLiveActivityDto {
    /** The frozen residency state (UI §24). */
    readonly residency: ResidencyState;
    /** What the agent is doing right now (<= 256 chars). */
    readonly currentAction?: string;
    /** Last live activity timestamp, ISO-8601. */
    readonly lastActivityAt?: string;
    /** Start of the current live run, ISO-8601. */
    readonly runningSince?: string;
    /** Correlation id of the currently admitted live work. */
    readonly admittedWorkCorrelation?: string;
}
/**
 * Parse and validate a MemberLiveActivityDto from an untrusted value.
 * `residency` is required; the rest are optional live facts.
 * @param value - the unknown input.
 * @returns the frozen live overlay.
 * @throws `MALFORMED_DTO` for a malformed container, unknown field, missing
 *   residency, or invalid field.
 */
export declare function parseMemberLiveActivity(value: unknown): MemberLiveActivityDto;
//# sourceMappingURL=activity.d.ts.map