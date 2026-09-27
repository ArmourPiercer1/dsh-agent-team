/**
 * Typed output value mirrors of the Remote contract v1.
 *
 * These are the `data` shapes the dispatcher wraps in the success result.
 * They mirror — at the value level (deviation D-1) — the durable DTOs and
 * service results the backing ports return (design note §3 table, "Output
 * value (data)"). Deep validation is deliberately NOT repeated here (D-4):
 * the backing services own their invariants; the remote layer (a) checks
 * the top-level shape of the whole-projection DTO, (b) normalizes closed
 * wire fields (e.g. ledger `operationId` → `string | null`), and (c)
 * lossless-JSON-checks every value before the reply is built.
 *
 * `RemoteSafeRecord` marks "a lossless-JSON-checked value whose deep shape
 * is owned by the backing service".
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/contracts/types
 */
import type { RemoteSafeRecord } from './remote-safe.js';
/** `catalog.list` value: `{ blueprints: [{ blueprintId, revisions }] }`. */
export interface RemoteCatalogListValue {
    readonly blueprints: readonly RemoteSafeRecord[];
}
/** `catalog.get` value: `{ blueprint: <resolved TeamBlueprint> }`. */
export interface RemoteCatalogGetValue {
    readonly blueprint: RemoteSafeRecord;
}
/** `intent.probe` value: `{ compatibility: <CompatibilityResult> }`. */
export interface RemoteIntentProbeValue {
    readonly compatibility: RemoteSafeRecord;
}
/** The root-binding path of a `team.create` outcome (P5-T5). */
export type RemoteTeamCreatePath = 'fresh-root' | 'cold-root';
/**
 * `team.create` value: `{ path, durable, bind }` — the root-binding result
 * (`RootBindingDurableState` | null + the bind result).
 */
export interface RemoteTeamCreateValue {
    readonly path: RemoteTeamCreatePath;
    readonly durable: RemoteSafeRecord | null;
    readonly bind: RemoteSafeRecord;
}
/**
 * The whole-projection value — the exact P8-T1 `TeamProjectionDto` (v1)
 * mirrored at the value level: the nine frozen top-level fields
 * (`TEAM_PROJECTION_FIELDS`), nested values pass-through (D-4).
 */
export interface RemoteProjectionValue {
    /** The projection schema version; v1 projections carry `1`. */
    readonly schemaVersion: number;
    /** The TeamSession id — which IS the root DSH session id (invariant 9). */
    readonly teamSessionId: string;
    /** The immutable blueprint snapshot the TeamSession binds. */
    readonly blueprint: RemoteSafeRecord;
    /** The whole-projection monotonic generation (>= 1). */
    readonly generation: number;
    /** Projection creation time, ISO-8601. */
    readonly generatedAt: string;
    /** The root (TeamSession + TeamDomain) projection. */
    readonly root: RemoteSafeRecord;
    /** The member template projections (ordered). */
    readonly templates: readonly RemoteSafeRecord[];
    /** The member instance projections (ordered). */
    readonly members: readonly RemoteSafeRecord[];
    /** The ledger summary (frozen `LedgerSummaryDto` shape). */
    readonly ledger: RemoteSafeRecord;
}
/**
 * The contract-v6 whole-projection value: the nine frozen v1 fields PLUS
 * the two additive freshness fields (team-view-sync-complete, Phase 2
 * frozen decisions):
 *
 * - `durableGeneration` — the DURABLE whole-projection generation, always
 *   equal to `generation` (named explicitly so the client freshness
 *   identity reads as the frozen PAIR `{ durableGeneration, liveToken }`);
 * - `liveToken` — a deterministic opaque string over the SEMANTIC live
 *   state (the sorted per-member `{ instanceId, residency }` pairs;
 *   `lastActivityAt`/`now()`/`generatedAt` are EXCLUDED) — it changes only
 *   when the semantic live state changes, never on host restart bookkeeping
 *   alone, and is NEVER folded into the durable generation.
 *
 * Contract versions <= 5 keep serving the exact frozen
 * {@link RemoteProjectionValue} shape (the v6 fields are absent on the
 * wire; v1-v5 are unchanged).
 */
export interface RemoteProjectionValueV6 extends RemoteProjectionValue {
    /** The durable whole-projection generation (always `=== generation`). */
    readonly durableGeneration: number;
    /** The deterministic opaque semantic-live-state token (non-empty). */
    readonly liveToken: string;
}
/** `team.getProjection` value: `{ projection }`. */
export interface RemoteTeamGetProjectionValue {
    readonly projection: RemoteProjectionValue;
}
/**
 * `team.getReadState` value (contract v6, v6-only method): the
 * authoritative per-session read-state answer over the host's durable
 * TeamDomain rows (the frozen closed wire shape):
 *
 * - `relation` — `team-root` (the session IS a TeamSession root),
 *   `team-member` (the session is a member's bound child session — a
 *   DISPOSED member still resolves here, marked `disposed`), or `none`
 *   (only a successful read that positively confirms no affiliation may
 *   answer `none`; every storage/integrity failure fails CLOSED with a
 *   typed error instead);
 * - `teamSessionId` — the owning TeamSession id (null for `none`);
 * - `memberInstanceId` — the owning member instance (null unless
 *   `team-member`);
 * - `disposed` — true only for a `team-member` whose durable lifecycle is
 *   the terminal `DISPOSED` state;
 * - `durableGeneration` — the owning TeamSession's durable generation
 *   (null for `none`).
 */
export interface RemoteTeamGetReadStateValue {
    readonly relation: 'team-root' | 'team-member' | 'none';
    readonly teamSessionId: string | null;
    readonly memberInstanceId: string | null;
    readonly disposed: boolean;
    readonly durableGeneration: number | null;
}
/**
 * One durable ledger fact row (the storage `LedgerEntry` mirror, closed
 * wire shape: `operationId` is `string | null`, never absent).
 */
export interface RemoteLedgerEntryValue {
    readonly schemaVersion: number;
    readonly sequence: number;
    readonly rootSessionId: string;
    readonly factType: string;
    readonly payload: RemoteSafeRecord;
    readonly operationId: string | null;
    readonly createdAt: string;
}
/**
 * `team.getLedgerPage` value — remote-level pagination (deviation D-5):
 * a stable page of ledger entries after `afterSequence` with the cursor
 * for the next page.
 */
export interface RemoteLedgerPageValue {
    readonly entries: readonly RemoteLedgerEntryValue[];
    /** The last included sequence (cursor for the next page) or `null`. */
    readonly nextAfterSequence: number | null;
    /** The total fact-entry count of the ledger. */
    readonly total: number;
}
/**
 * The admission outcome value (the P6-T2 `TeamRuntimeActionOutcome`
 * mirror, closed wire shape).
 */
export interface RemoteAdmissionOutcomeValue {
    readonly status: 'executed';
    readonly action: string;
    readonly rootSessionId: string;
    readonly callerRole: string;
    readonly targetInstanceId: string | null;
    readonly effect: RemoteSafeRecord;
    readonly requestToken: string;
}
/** `member.create` / `member.send` / `member.followup` value. */
export interface RemoteMemberOutcomeValue {
    readonly outcome: RemoteAdmissionOutcomeValue;
}
/** `member.archive` value (the P7-T3 `ArchiveMemberResult` mirror). */
export interface RemoteMemberArchiveValue {
    readonly member: RemoteSafeRecord;
    readonly steps: readonly RemoteSafeRecord[];
    readonly settledCommitted: boolean;
    readonly drained: boolean;
    readonly residencyDropped: boolean;
}
/** `member.restore` value (the P7-T3 `RestoreMemberResult` mirror). */
export interface RemoteMemberRestoreValue {
    readonly member: RemoteSafeRecord;
    readonly steps: readonly RemoteSafeRecord[];
}
/** `member.dispose` value (the P7-T3 `DisposeMemberResult` mirror). */
export interface RemoteMemberDisposeValue {
    readonly member: RemoteSafeRecord;
    readonly steps: readonly RemoteSafeRecord[];
    readonly drained: boolean;
    readonly residencyDropped: boolean;
}
/** `override.get` value: the stored record for the addressed cell or null. */
export interface RemoteOverrideGetValue {
    readonly override: RemoteSafeRecord | null;
}
/** `override.set` value: the durable stored mutation record. */
export interface RemoteOverrideSetValue {
    readonly record: RemoteSafeRecord;
}
/** `override.reset` value: whether a record was revoked. */
export interface RemoteOverrideResetValue {
    readonly removed: boolean;
}
/** `policyState.get` value: the current policy state view. */
export interface RemotePolicyStateGetValue {
    readonly state: RemoteSafeRecord;
}
/** `policyState.set` value: the durable policy-state transition record. */
export interface RemotePolicyStateSetValue {
    readonly transition: RemoteSafeRecord;
}
/** `compatibility.get` value: the current compatibility verdict. */
export interface RemoteCompatibilityGetValue {
    readonly verdict: RemoteSafeRecord;
}
/** `compatibility.ack` value: the verdict after the ack. */
export interface RemoteCompatibilityAckValue {
    readonly verdict: RemoteSafeRecord;
}
/** `compatibility.reprobe` value: the fresh probe outcome (with trigger). */
export interface RemoteCompatibilityReprobeValue {
    readonly probe: RemoteSafeRecord;
}
/**
 * `handoff.prepare` value — the read-only source-surface summary (deviation
 * D-6): what a handoff would freeze, without any durable write.
 */
export interface RemoteHandoffPrepareValue {
    readonly summary: RemoteSafeRecord;
    readonly sourceSessionId: string;
}
/**
 * `handoff.create` value: the closed `HandoffOperationState` union (always
 * carries `replayed`).
 */
export interface RemoteHandoffCreateValue {
    readonly state: RemoteSafeRecord;
}
/**
 * `legacy.inspect` value: the closed `LegacyTeamInspection` union
 * (`status: 'legacy-team' | 'native-fallback'`).
 */
export interface RemoteLegacyInspectValue {
    readonly inspection: RemoteSafeRecord;
}
/** The top-level fields of the P8-T1 whole-projection DTO (mirror). */
export declare const REMOTE_PROJECTION_FIELDS: readonly string[];
/**
 * The top-level fields of the contract-v6 whole-projection value: the nine
 * frozen v1 fields plus the two additive v6 freshness fields
 * (`durableGeneration`, `liveToken`).
 */
export declare const REMOTE_PROJECTION_FIELDS_V6: readonly string[];
/** The top-level fields of the storage `LedgerEntry` (mirror). */
export declare const REMOTE_LEDGER_ENTRY_FIELDS: readonly string[];
//# sourceMappingURL=types.d.ts.map