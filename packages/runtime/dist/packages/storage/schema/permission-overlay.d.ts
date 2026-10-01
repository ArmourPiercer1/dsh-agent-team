/**
 * PermissionOverlaySnapshot — the durable row of the permission overlay
 * store (Alpha.3 Dynamic Permission Governance, PR1 "PermissionOverlay
 * Foundation"; ADR §2).
 *
 * ADR §2 is the shape authority and this module implements it literally:
 *
 *   identity:   teamSessionId, memberInstanceId
 *   state:      permission overlay rules
 *   metadata:   generation, previousSnapshotId
 *   provenance: actor, mutationId, timestamp, reason
 *
 * plus the two MECHANICAL row fields the durable layer needs and the ADR
 * sketch does not list, because it describes the mutation payload rather
 * than the stored row (documented deviation, not an extension):
 *
 * - `schemaVersion` — the L3 row stamp every TeamDomain-owned record carries
 *   (`OperationRecord`, `GovernanceOverride`, `CompatibilityState`,
 *   `LedgerEntry`, `SchemaMetaStamp`, `BlueprintRegistryRecord` all do it).
 *   It is pinned to `TEAM_DOMAIN_SCHEMA_VERSION`, the version of the domain
 *   this row lives in — the same value the other nine stores' rows carry.
 * - `snapshotId` — the address `metadata.previousSnapshotId` points at, and
 *   the durable row key. It is DERIVED
 *   (`<teamSessionId>#<memberInstanceId>#<generation>`), never caller
 *   supplied, so a snapshot can never claim an identity that its own
 *   generation does not give it.
 *
 * ## Append-only full snapshots; no event replay
 *
 * Each row is a COMPLETE snapshot of the overlay state at one generation
 * (ADR §2 "append-only full snapshots"), never a delta. Current authority is
 * the HIGHEST generation; every other row is audit-only. Nothing here
 * replays rows to rebuild state (design §3.3: "Do not introduce replay-based
 * authority … execution permission must depend on current durable snapshot")
 * — the repository reads the highest generation directly.
 *
 * ## What this module checks, and what it must never check
 *
 * Validation here is STRUCTURAL ONLY: section anatomy, closed field sets, id
 * grammars, generation shape, chain-link shape, provenance field shapes. It
 * deliberately does not ask:
 *
 * - WHO is calling (ADR §7 human-vs-Leader is provenance, not precedence);
 * - whether a MutationEnvelope covers the change (ADR §6, PR3);
 * - whether a rule set is an EXPANSION or a TIGHTENING (ADR §6 lane
 *   arithmetic, PR3), or how layers merge (ADR §4, PR2).
 *
 * A structurally perfect but semantically forbidden snapshot (e.g. a Leader
 * deny→allow expansion with no envelope) therefore PASSES this gate and is
 * stored. That is required, not incidental: the future
 * `GovernanceMutationService` is the sole mutation authority (ADR §1) and it
 * must be the thing that refuses, so that the refusal is auditable at the
 * authority layer instead of being silently duplicated in storage.
 *
 * ## Durable placement (coordinator ruling 2026-10-01: the TeamDomain route)
 *
 * The overlay rows live in `team_domain`, the single Team control-plane
 * domain: `permission_overlays` is its TENTH declared store. That is a
 * same-version ADDITION, not a schema-version change — the pinned upstream
 * backend initializes a declared-but-missing table EMPTY inside one version
 * (`storage-json format.ts` L77-85; `storage-sqlite index.ts` L110-131 at
 * baseline `46a7f68b09`), so no migration, no version bump, and no world
 * reset is involved, and the nine existing stores keep their rows untouched.
 * The store name is declared once, in `schema/stores.ts`
 * (`TEAM_PERMISSION_OVERLAY_STORE`), which this module re-exports as
 * {@link PERMISSION_OVERLAY_STORE}; the L2 stamp bootstrap for a medium that
 * predates the store lives in `repositories/team-domain.ts`. This module
 * names NO domain of its own: an earlier round of this PR gave the store a
 * standalone `team_permission_overlay` domain, which the coordinator ruling
 * withdrew (history only, not in the final tree).
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/permission-overlay
 */
/**
 * The store these rows live in: the tenth declared table of `team_domain`.
 * The name is declared ONCE, in `schema/stores.ts`; this is a re-export, so
 * the store name has exactly one literalization site in the repo.
 */
export declare const PERMISSION_OVERLAY_STORE = "permission_overlays";
/**
 * The row version (L3) of an overlay snapshot: the version of the domain the
 * row lives in, exactly like the rows of the other nine stores. A row at any
 * other version rejects at read (`RECORD_INVALID`); no migration path is
 * built in, per the domain's version policy.
 */
export declare const PERMISSION_OVERLAY_SCHEMA_VERSION = 2;
/**
 * The effect vocabulary an overlay rule may carry, by VALUE identical to the
 * Alpha.2 resolver lane set. This module does NOT import the resolver: the
 * row is a carrier, and the merge/precedence semantics are PR2
 * (`EffectivePermissionAssembler`) and PR3 (`GovernanceMutationService`).
 * `permission-overlay-validation.test.ts` pins the correspondence at type
 * level (type-only import, zero runtime edge).
 */
export declare const PERMISSION_OVERLAY_EFFECT_VALUES: readonly ["allow", "ask", "deny"];
/** One overlay rule effect. */
export type PermissionOverlayEffect = (typeof PERMISSION_OVERLAY_EFFECT_VALUES)[number];
/** Is `value` one of the three closed effects? */
export declare function isPermissionOverlayEffect(value: unknown): value is PermissionOverlayEffect;
/** The exact fields of the identity section (ADR §2). */
export declare const PERMISSION_OVERLAY_IDENTITY_FIELDS: readonly string[];
/** The exact fields of the state section (ADR §2). */
export declare const PERMISSION_OVERLAY_STATE_FIELDS: readonly string[];
/** The exact fields of the metadata section (ADR §2). */
export declare const PERMISSION_OVERLAY_METADATA_FIELDS: readonly string[];
/** The exact fields of the provenance section (ADR §2). */
export declare const PERMISSION_OVERLAY_PROVENANCE_FIELDS: readonly string[];
/** The exact fields of one overlay rule. */
export declare const PERMISSION_OVERLAY_RULE_FIELDS: readonly string[];
/** The four semantic sections a caller submits (the mutation payload shape). */
export declare const PERMISSION_OVERLAY_INPUT_SECTIONS: readonly string[];
/** The full stored row: the four sections plus the two mechanical fields. */
export declare const PERMISSION_OVERLAY_SNAPSHOT_FIELDS: readonly string[];
/** Structural bound of one overlay rule set (carrier bound, not a policy). */
export declare const PERMISSION_OVERLAY_MAX_RULES = 256;
/** Structural bound of the audit `reason` text. */
export declare const PERMISSION_OVERLAY_MAX_REASON_LENGTH = 512;
/**
 * The separator inside a derived snapshot key. The public session-id grammar
 * does not forbid `#`, so the store rejects that character in an identity
 * component (see {@link permissionOverlaySnapshotKey}) rather than ship an
 * ambiguous key form.
 */
export declare const PERMISSION_OVERLAY_KEY_SEPARATOR = "#";
/**
 * The bound of the DERIVED snapshot id / `previousSnapshotId` reference —
 * DERIVED from the component maxima so it can never drift away from them.
 *
 * A snapshotId is not free-form text; it is derived by
 * {@link permissionOverlaySnapshotKey} as
 *
 *     teamSessionId + SEP + memberInstanceId + SEP + generation
 *
 * so its maximum length is exactly the sum of the component maxima:
 *
 * | component                                     | bound | source                       |
 * | --------------------------------------------- | ----- | ---------------------------- |
 * | the longest legal TeamSession id               | 255   | `SESSION_ID_MAX_LENGTH`       |
 * | the separator                                   | 1     | `PERMISSION_OVERLAY_KEY_SEPARATOR` |
 * | the longest legal MemberInstance id (`inst-` + 32) | 37 | `INSTANCE_ID_MAX_LENGTH`      |
 * | the separator                                   | 1     | `PERMISSION_OVERLAY_KEY_SEPARATOR` |
 * | the widest legal generation                     | 16    | `MAX_GENERATION_DIGITS`       |
 * | **total**                                       | **310** |                             |
 *
 * A hand-picked bound BELOW this sum is a latent contract break, not a
 * tightening: a legal max-length identity would append generation 1 (whose
 * `previousSnapshotId` is null) and then be unable to append generation 2,
 * because generation 2's reference names generation 1's key — a row that IS
 * durable — and would be rejected by its own length bound. The chain could
 * never advance past its first snapshot for that identity.
 */
export declare const PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH: number;
/** The ADR §2 `identity` section. */
export interface PermissionOverlayIdentity {
    /** The TeamSession (its root session id, contracts invariant 9). */
    readonly teamSessionId: string;
    /** The MemberInstance the overlay belongs to. */
    readonly memberInstanceId: string;
}
/** One overlay rule (a carrier record: no matcher or precedence logic). */
export interface PermissionOverlayRule {
    /** The canonical operation class token the rule speaks about. */
    readonly operation: string;
    /** The resource the rule speaks about (never interpreted here). */
    readonly resource: string;
    /** The effect the rule carries. */
    readonly effect: PermissionOverlayEffect;
}
/** The ADR §2 `state` section: the overlay rules of this snapshot. */
export interface PermissionOverlayState {
    /** The full rule set of this snapshot (a full snapshot, never a delta). */
    readonly rules: readonly PermissionOverlayRule[];
}
/** The ADR §2 `metadata` section. */
export interface PermissionOverlayMetadata {
    /** The monotonic overlay generation (current authority = highest). */
    readonly generation: number;
    /** The snapshot this one replaces; `null` exactly at generation 1. */
    readonly previousSnapshotId: string | null;
}
/** The ADR §2 `provenance` section (audit data, never precedence). */
export interface PermissionOverlayProvenance {
    /** Who the mutation is attributed to (carrier; no authority meaning). */
    readonly actor: string;
    /** The mutation this snapshot was produced by (ADR §5 one-per-mutation). */
    readonly mutationId: string;
    /** When, ISO-8601. */
    readonly timestamp: string;
    /** The audit reason (may be empty; bounded). */
    readonly reason: string;
}
/** One stored PermissionOverlaySnapshot row. */
export interface PermissionOverlaySnapshot {
    /** The row-type schema version (L3). */
    readonly schemaVersion: number;
    /** The derived identity of this snapshot (row key / chain target). */
    readonly snapshotId: string;
    /** ADR §2 identity. */
    readonly identity: PermissionOverlayIdentity;
    /** ADR §2 state. */
    readonly state: PermissionOverlayState;
    /** ADR §2 metadata. */
    readonly metadata: PermissionOverlayMetadata;
    /** ADR §2 provenance. */
    readonly provenance: PermissionOverlayProvenance;
}
/** The caller-submitted shape: the four ADR sections, nothing else. */
export interface PermissionOverlaySnapshotInput {
    /** ADR §2 identity. */
    readonly identity: {
        readonly teamSessionId: string;
        readonly memberInstanceId: string;
    };
    /** ADR §2 state. */
    readonly state: {
        readonly rules: readonly PermissionOverlayRule[];
    };
    /** ADR §2 metadata. */
    readonly metadata: {
        readonly generation: number;
        readonly previousSnapshotId: string | null;
    };
    /** ADR §2 provenance. */
    readonly provenance: PermissionOverlayProvenance;
}
/**
 * The derived snapshot id / durable row key of one (identity, generation)
 * position: `<teamSessionId>#<memberInstanceId>#<generation>`.
 *
 * Derivation (instead of a caller-supplied id) is what makes
 * `previousSnapshotId` a real compare-and-swap term: a writer cannot name a
 * predecessor that its own generation does not imply.
 * @param teamSessionId - the TeamSession identity.
 * @param memberInstanceId - the MemberInstance identity.
 * @param generation - the snapshot generation.
 * @returns the snapshot id, which is also the row key.
 * @throws `RECORD_INVALID` (problem `key-separator-in-identity`) when an id
 *   component contains the key separator.
 */
export declare function permissionOverlaySnapshotKey(teamSessionId: string, memberInstanceId: string, generation: number): string;
/**
 * Build one validated snapshot row from the caller's four ADR §2 sections.
 * Stamps the mechanical fields (`schemaVersion`, derived `snapshotId`).
 * @param input - the identity/state/metadata/provenance sections.
 * @returns the deeply frozen snapshot.
 * @throws a contracts `MALFORMED_DTO` / id code for a malformed section or
 *   field (normalized into `RECORD_INVALID` by the repository boundary), or
 *   `RECORD_INVALID` for the storage-level structural rules above.
 */
export declare function createPermissionOverlaySnapshot(input: PermissionOverlaySnapshotInput): PermissionOverlaySnapshot;
/**
 * Parse and validate an untrusted value (a decoded row) into a snapshot.
 * @param value - the unknown value.
 * @returns the deeply frozen snapshot.
 * @throws `RECORD_INVALID` for a foreign `schemaVersion`, an unknown or
 *   missing field, or a structural defect; the contracts codes for a
 *   malformed section.
 */
export declare function parsePermissionOverlaySnapshot(value: unknown): PermissionOverlaySnapshot;
/**
 * Serialize a snapshot to its canonical JSON form (sorted keys, array order
 * preserved) — the byte form the store keeps and re-verifies on every read.
 * @param snapshot - the snapshot.
 * @returns the canonical JSON text.
 */
export declare function serializePermissionOverlaySnapshot(snapshot: PermissionOverlaySnapshot): string;
/**
 * Deserialize canonical JSON into a validated, frozen snapshot.
 * @param json - the canonical JSON text.
 * @returns the snapshot.
 * @throws `RECORD_INVALID` (problem `malformed-json`) for invalid JSON, plus
 *   whatever {@link parsePermissionOverlaySnapshot} rejects.
 */
export declare function deserializePermissionOverlaySnapshot(json: string): PermissionOverlaySnapshot;
//# sourceMappingURL=permission-overlay.d.ts.map