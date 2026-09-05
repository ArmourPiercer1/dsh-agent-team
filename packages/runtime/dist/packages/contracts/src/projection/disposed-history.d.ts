/**
 * DisposedMemberHistoryDto — the retained-history bundle of one DISPOSED
 * member (S7-R2 R2-6, repair D14 / UI-D14): one entry of the additive v2
 * `disposedHistory` top-level key of the whole-team projection.
 *
 * Design facts (frozen 20260829 plan docs + the S7-R2 repair scope):
 *
 * - The bundle is the DISCOVERABILITY layer for disposed history: it names
 *   every DISPOSED member, anchors its retained timeline (the durable
 *   creation stamp + the dispose stamp derived from the lifecycle facts),
 *   and DIGESTS the member's share of the TeamLedger — per-category counts
 *   over the eight frozen ledger categories plus the first/last attributed
 *   sequence. It does NOT duplicate fact payloads: the full facts stay on
 *   the TeamLedger (invariant 41) and remain reachable through the frozen
 *   `team.getLedgerPage` pagination (BQ-16) — the digest's sequence span is
 *   the client's navigation anchor into that page stream.
 * - The bundle is DURATIONAL-optional at the projection TOP LEVEL: the
 *   `disposedHistory` key is ABSENT when the team has no DISPOSED member
 *   (the default projection is byte-identical to the pre-repair shape —
 *   the live view (BQ-04) semantics are unchanged) and PRESENT (non-empty)
 *   exactly when at least one DISPOSED member exists. An empty array is
 *   malformed (fabricated presence).
 * - Cross-field (validated at the enclosing TeamProjection parse): the
 *   bundle's instance ids are EXACTLY the DISPOSED member rows of
 *   `members` — every DISPOSED row has one entry, every entry references a
 *   DISPOSED row, no duplicates. The LeaderInstance can never appear
 *   (it has no lifecycle and therefore cannot be DISPOSED).
 * - `factCount` equals the sum of `byCategory` (mirrors the frozen ledger
 *   summary invariant). Attribution is the CLOSED read-port rule (runtime
 *   `projection-source.ts`): a root ledger entry is attributed to a member
 *   when one of its closed addressing keys — `instanceId`,
 *   `targetInstanceId`, `recipientInstanceId`, `deliveredToInstanceId` —
 *   names the member. Team-level facts (policy / compatibility / team
 *   session) carry no instance key and are therefore never attributed.
 * - `firstSequence` / `lastSequence` form a DURATIONAL-optional PAIR: both
 *   ABSENT together iff `factCount` is 0, both PRESENT together otherwise
 *   (a positive sequence span, `firstSequence <= lastSequence`).
 *
 * The bundle is an embedded value: the enclosing versioned record owns the
 * schema version, so the bundle carries none of its own.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/disposed-history
 */
import type { ChildSessionId } from '../ids/session-id.js';
import type { InstanceId } from '../ids/instance-id.js';
import type { TemplateId } from '../ids/template-id.js';
import type { LedgerCategoryCounts } from './ledger.js';
/** The exact frozen fields of a DisposedMemberHistoryDto. */
export declare const DISPOSED_MEMBER_HISTORY_FIELDS: readonly string[];
/**
 * The DURATIONAL-optional keys of a DisposedMemberHistoryDto: ABSENT when
 * the fact is not carried (never an own-`undefined` key).
 */
export declare const DISPOSED_MEMBER_HISTORY_OPTIONAL_FIELDS: readonly string[];
/**
 * The retained-history bundle of one DISPOSED member (schema version 2,
 * S7-R2 R2-6 / D14).
 */
export interface DisposedMemberHistoryDto {
    /** The DISPOSED member's stable instance id (unique in the team, invariant 18). */
    readonly instanceId: InstanceId;
    /** The member's human-facing label (durable verbatim from the row). */
    readonly label: string;
    /** The static template identity (NOT a runtime identity, invariant 19). */
    readonly templateId: TemplateId;
    /**
     * The durable child session (invariant 23) — the address of the member's
     * retained child-session history. Required: every DISPOSED row is a
     * MemberInstance (the LeaderInstance has no lifecycle and cannot be
     * DISPOSED).
     */
    readonly childSessionId: ChildSessionId;
    /** Opaque grouping metadata (invariant 20); ABSENT when not set. */
    readonly groupId?: string;
    /** The instance creation timestamp, ISO-8601 (durable from the row). */
    readonly createdAt: string;
    /**
     * The dispose timestamp: the LATEST `at` stamp of a
     * `member-lifecycle-changed` fact with `to: 'DISPOSED'` for this member
     * (ISO-8601). ABSENT when the durable ledger carries no such derivable
     * stamp (the key is dropped, never `undefined`).
     */
    readonly disposedAt?: string;
    /**
     * The number of root-ledger entries attributed to this member under the
     * closed addressing rule; EQUALS the sum of `byCategory` (frozen
     * invariant, mirrored from the ledger summary).
     */
    readonly factCount: number;
    /**
     * Per-category counts of the attributed entries over the EIGHT frozen
     * ledger categories (every category key REQUIRED, zero counts explicit).
     */
    readonly byCategory: LedgerCategoryCounts;
    /**
     * The lowest attributed ledger sequence; ABSENT together with
     * `lastSequence` iff `factCount` is 0.
     */
    readonly firstSequence?: number;
    /**
     * The highest attributed ledger sequence; ABSENT together with
     * `firstSequence` iff `factCount` is 0. The pair is the client's
     * navigation span into `team.getLedgerPage` (BQ-16).
     */
    readonly lastSequence?: number;
}
/**
 * Producer input for {@link createDisposedMemberHistory} (input records
 * must not carry own `undefined` keys — lossless-JSON discipline).
 */
export interface DisposedMemberHistoryInput {
    /** The DISPOSED member's stable instance id. */
    instanceId: InstanceId;
    /** The member's human-facing label. */
    label: string;
    /** The static template identity. */
    templateId: TemplateId;
    /** The durable child session (required for a DISPOSED row). */
    childSessionId: ChildSessionId;
    /** Opaque grouping metadata; ABSENT when not set. */
    groupId?: string;
    /** The instance creation timestamp, ISO-8601. */
    createdAt: string;
    /** The derived dispose timestamp, ISO-8601; ABSENT when not derivable. */
    disposedAt?: string;
    /** The attributed fact count (equals the sum of `byCategory`). */
    factCount: number;
    /** Per-category counts of the attributed entries (all eight keys). */
    byCategory: LedgerCategoryCounts;
    /** The lowest attributed sequence; ABSENT iff `factCount` is 0. */
    firstSequence?: number;
    /** The highest attributed sequence; ABSENT iff `factCount` is 0. */
    lastSequence?: number;
}
/**
 * Parse and validate a DisposedMemberHistoryDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen bundle entry.
 * @throws `MALFORMED_DTO` for a malformed container, field set, field value,
 *   category key set, a `factCount` / sum-of-categories mismatch, a split or
 *   inverted sequence span, or a span that disagrees with `factCount`;
 *   `LEGACY_MEMBER_ID_REJECTED`, `INVALID_INSTANCE_ID`, `INVALID_TEMPLATE_ID`,
 *   or `INVALID_CHILD_SESSION_ID` for the embedded identity fields.
 */
export declare function parseDisposedMemberHistory(value: unknown): DisposedMemberHistoryDto;
/**
 * Build a fresh DisposedMemberHistoryDto from producer input (already
 * branded ids; the input must not carry own `undefined` keys).
 * @param input - the bundle fields.
 * @returns the frozen bundle entry (validated through the same pipeline as
 *   `parseDisposedMemberHistory`).
 */
export declare function createDisposedMemberHistory(input: DisposedMemberHistoryInput): DisposedMemberHistoryDto;
//# sourceMappingURL=disposed-history.d.ts.map