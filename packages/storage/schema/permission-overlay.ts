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
 *   It is pinned to {@link PERMISSION_OVERLAY_SCHEMA_VERSION}, the version of
 *   THIS row type — deliberately NOT the `team_domain` domain version: the
 *   overlay store is its own durable domain (see "Durable placement" below),
 *   so coupling this stamp to `TEAM_DOMAIN_SCHEMA_VERSION` would drag a
 *   future `team_domain` bump into overlay rows and vice versa.
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
 * ## Durable placement (open plan-level decision, PR1 interim)
 *
 * The plan asks for "TeamDomain schema". Joining the frozen `team_domain`
 * unit is NOT an additive move at this base: its nine-store table set
 * (`schema/stores.ts` `TEAM_DOMAIN_STORES`) is what the seam spec declares,
 * and the public StorageDomain rejects both a same-version table-set change
 * (`malformed-medium`) and a version bump without migration
 * (`version-mismatch`) against every already-persisted `team_domain` medium.
 * Rather than change the boot semantics of existing durable worlds (a
 * plan-level schema-migration decision), PR1 registers the overlay store as
 * its OWN Team-owned durable domain — one domain, one table, L1 version at
 * open, L3 stamp per row — opened through the SAME public
 * {@link StorageDomainSeam}. The domain/table names are literalized ONLY
 * here, so the placement flip is a one-file change. See the PR body.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/permission-overlay
 */

import {
  INSTANCE_ID_MAX_LENGTH,
  SESSION_ID_MAX_LENGTH,
  assertNoLegacyFields,
  canonicalJsonStringify,
  deepFreeze,
  parseInstanceId,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import {
  assertFieldPresent,
  assertNoUnknownFields,
  assertPlainRecord,
  parseIso8601TimestampField,
  parseLabelLikeField,
  parseWorkspaceField,
} from '../../contracts/src/dto/common.js'
import { teamDomainError } from './errors.js'
import type { StorageDomainSpec } from './seam.js'
import { UNIT_NAME_PATTERN } from './stores.js'

// ---------------------------------------------------------------------------
// Durable placement (the ONLY literalization site — see the header)
// ---------------------------------------------------------------------------

/** The durable domain the overlay store lives in (public unit-name rule). */
export const PERMISSION_OVERLAY_DOMAIN_NAME = 'team_permission_overlay'

/** The single table of that domain: the append-only snapshot rows. */
export const PERMISSION_OVERLAY_STORE = 'permission_overlays'

/**
 * The schema version of THIS row type (L1 of the overlay domain and L3 of
 * each row). No migration path is built in: a medium at another version
 * rejects at open, exactly like `team_domain`'s own policy.
 */
export const PERMISSION_OVERLAY_SCHEMA_VERSION = 1

/** The supported row/domain versions of the overlay store (no migration). */
export const SUPPORTED_PERMISSION_OVERLAY_SCHEMA_VERSIONS: readonly number[] = [1]

/**
 * The seam spec the overlay store opens with: one domain, one declared
 * table. Fresh array per call (the seam may hold on to it).
 * @returns the seam spec.
 */
export function createPermissionOverlaySeamSpec(): StorageDomainSpec {
  assertOverlayUnitName(PERMISSION_OVERLAY_DOMAIN_NAME, 'domain')
  assertOverlayUnitName(PERMISSION_OVERLAY_STORE, 'table')
  return {
    name: PERMISSION_OVERLAY_DOMAIN_NAME,
    version: PERMISSION_OVERLAY_SCHEMA_VERSION,
    tables: [PERMISSION_OVERLAY_STORE],
  }
}

/**
 * Mirror of the public unit-name rule for the overlay domain/table (the same
 * rule `team_domain` mirrors in `stores.ts`), checked before it crosses the
 * seam so a typo fails at the module boundary, not in the backend.
 */
function assertOverlayUnitName(value: string, kind: 'domain' | 'table'): string {
  if (!UNIT_NAME_PATTERN.test(value)) {
    throw teamDomainError(
      'RECORD_INVALID',
      `permission overlay ${kind} name '${value}' violates the public unit-name rule`,
      { kind, problem: 'invalid-unit-name' },
    )
  }
  return value
}

// ---------------------------------------------------------------------------
// The closed vocabulary and field sets (ADR §2)
// ---------------------------------------------------------------------------

/**
 * The effect vocabulary an overlay rule may carry, by VALUE identical to the
 * Alpha.2 resolver lane set. This module does NOT import the resolver: the
 * row is a carrier, and the merge/precedence semantics are PR2
 * (`EffectivePermissionAssembler`) and PR3 (`GovernanceMutationService`).
 * `permission-overlay-validation.test.ts` pins the correspondence at type
 * level (type-only import, zero runtime edge).
 */
export const PERMISSION_OVERLAY_EFFECT_VALUES = ['allow', 'ask', 'deny'] as const

/** One overlay rule effect. */
export type PermissionOverlayEffect = (typeof PERMISSION_OVERLAY_EFFECT_VALUES)[number]

/** Is `value` one of the three closed effects? */
export function isPermissionOverlayEffect(value: unknown): value is PermissionOverlayEffect {
  return typeof value === 'string' && (PERMISSION_OVERLAY_EFFECT_VALUES as readonly string[]).includes(value)
}

/** The exact fields of the identity section (ADR §2). */
export const PERMISSION_OVERLAY_IDENTITY_FIELDS: readonly string[] = ['teamSessionId', 'memberInstanceId']

/** The exact fields of the state section (ADR §2). */
export const PERMISSION_OVERLAY_STATE_FIELDS: readonly string[] = ['rules']

/** The exact fields of the metadata section (ADR §2). */
export const PERMISSION_OVERLAY_METADATA_FIELDS: readonly string[] = ['generation', 'previousSnapshotId']

/** The exact fields of the provenance section (ADR §2). */
export const PERMISSION_OVERLAY_PROVENANCE_FIELDS: readonly string[] = ['actor', 'mutationId', 'timestamp', 'reason']

/** The exact fields of one overlay rule. */
export const PERMISSION_OVERLAY_RULE_FIELDS: readonly string[] = ['operation', 'resource', 'effect']

/** The four semantic sections a caller submits (the mutation payload shape). */
export const PERMISSION_OVERLAY_INPUT_SECTIONS: readonly string[] = [
  'identity',
  'state',
  'metadata',
  'provenance',
]

/** The full stored row: the four sections plus the two mechanical fields. */
export const PERMISSION_OVERLAY_SNAPSHOT_FIELDS: readonly string[] = [
  'schemaVersion',
  'snapshotId',
  ...PERMISSION_OVERLAY_INPUT_SECTIONS,
]

/** Structural bound of one overlay rule set (carrier bound, not a policy). */
export const PERMISSION_OVERLAY_MAX_RULES = 256

/** Structural bound of the audit `reason` text. */
export const PERMISSION_OVERLAY_MAX_REASON_LENGTH = 512

/**
 * The separator inside a derived snapshot key. The public session-id grammar
 * does not forbid `#`, so the store rejects that character in an identity
 * component (see {@link permissionOverlaySnapshotKey}) rather than ship an
 * ambiguous key form.
 */
export const PERMISSION_OVERLAY_KEY_SEPARATOR = '#'

/**
 * The widest a generation number can render as: a generation is a SAFE
 * integer >= 1 (see the metadata gate), so the largest legal value is
 * `Number.MAX_SAFE_INTEGER` = `9007199254740991` = 16 characters.
 */
const MAX_GENERATION_DIGITS = String(Number.MAX_SAFE_INTEGER).length

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
export const PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH =
  SESSION_ID_MAX_LENGTH +
  PERMISSION_OVERLAY_KEY_SEPARATOR.length +
  INSTANCE_ID_MAX_LENGTH +
  PERMISSION_OVERLAY_KEY_SEPARATOR.length +
  MAX_GENERATION_DIGITS

// ---------------------------------------------------------------------------
// The record types
// ---------------------------------------------------------------------------

/** The ADR §2 `identity` section. */
export interface PermissionOverlayIdentity {
  /** The TeamSession (its root session id, contracts invariant 9). */
  readonly teamSessionId: string
  /** The MemberInstance the overlay belongs to. */
  readonly memberInstanceId: string
}

/** One overlay rule (a carrier record: no matcher or precedence logic). */
export interface PermissionOverlayRule {
  /** The canonical operation class token the rule speaks about. */
  readonly operation: string
  /** The resource the rule speaks about (never interpreted here). */
  readonly resource: string
  /** The effect the rule carries. */
  readonly effect: PermissionOverlayEffect
}

/** The ADR §2 `state` section: the overlay rules of this snapshot. */
export interface PermissionOverlayState {
  /** The full rule set of this snapshot (a full snapshot, never a delta). */
  readonly rules: readonly PermissionOverlayRule[]
}

/** The ADR §2 `metadata` section. */
export interface PermissionOverlayMetadata {
  /** The monotonic overlay generation (current authority = highest). */
  readonly generation: number
  /** The snapshot this one replaces; `null` exactly at generation 1. */
  readonly previousSnapshotId: string | null
}

/** The ADR §2 `provenance` section (audit data, never precedence). */
export interface PermissionOverlayProvenance {
  /** Who the mutation is attributed to (carrier; no authority meaning). */
  readonly actor: string
  /** The mutation this snapshot was produced by (ADR §5 one-per-mutation). */
  readonly mutationId: string
  /** When, ISO-8601. */
  readonly timestamp: string
  /** The audit reason (may be empty; bounded). */
  readonly reason: string
}

/** One stored PermissionOverlaySnapshot row. */
export interface PermissionOverlaySnapshot {
  /** The row-type schema version (L3). */
  readonly schemaVersion: number
  /** The derived identity of this snapshot (row key / chain target). */
  readonly snapshotId: string
  /** ADR §2 identity. */
  readonly identity: PermissionOverlayIdentity
  /** ADR §2 state. */
  readonly state: PermissionOverlayState
  /** ADR §2 metadata. */
  readonly metadata: PermissionOverlayMetadata
  /** ADR §2 provenance. */
  readonly provenance: PermissionOverlayProvenance
}

/** The caller-submitted shape: the four ADR sections, nothing else. */
export interface PermissionOverlaySnapshotInput {
  /** ADR §2 identity. */
  readonly identity: { readonly teamSessionId: string; readonly memberInstanceId: string }
  /** ADR §2 state. */
  readonly state: { readonly rules: readonly PermissionOverlayRule[] }
  /** ADR §2 metadata. */
  readonly metadata: { readonly generation: number; readonly previousSnapshotId: string | null }
  /** ADR §2 provenance. */
  readonly provenance: PermissionOverlayProvenance
}

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

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
export function permissionOverlaySnapshotKey(
  teamSessionId: string,
  memberInstanceId: string,
  generation: number,
): string {
  for (const [field, value] of [
    ['teamSessionId', teamSessionId],
    ['memberInstanceId', memberInstanceId],
  ] as const) {
    if (value.includes(PERMISSION_OVERLAY_KEY_SEPARATOR)) {
      throw teamDomainError(
        'RECORD_INVALID',
        `PermissionOverlaySnapshot ${field} must not contain '${PERMISSION_OVERLAY_KEY_SEPARATOR}' (the derived row key would be ambiguous)`,
        { field, problem: 'key-separator-in-identity' },
      )
    }
  }
  return `${teamSessionId}${PERMISSION_OVERLAY_KEY_SEPARATOR}${memberInstanceId}${PERMISSION_OVERLAY_KEY_SEPARATOR}${String(generation)}`
}

// ---------------------------------------------------------------------------
// Structural validation (the four sections)
// ---------------------------------------------------------------------------

function invalid(message: string, details: Record<string, unknown>): never {
  throw teamDomainError('RECORD_INVALID', message, details)
}

function parseIdentity(value: unknown): PermissionOverlayIdentity {
  const record = assertPlainRecord(value, 'PermissionOverlaySnapshot.identity')
  assertNoLegacyFields(record, 'PermissionOverlaySnapshot.identity')
  assertNoUnknownFields(record, PERMISSION_OVERLAY_IDENTITY_FIELDS, 'PermissionOverlaySnapshot.identity')
  for (const field of PERMISSION_OVERLAY_IDENTITY_FIELDS) {
    assertFieldPresent(record, field, 'PermissionOverlaySnapshot.identity')
  }
  // The contracts id grammars are the authority (a TeamSession id IS the root
  // session id per invariant 9; the MemberInstance id is the `inst-` form).
  return {
    teamSessionId: String(parseRootSessionId(record['teamSessionId'])),
    memberInstanceId: String(parseInstanceId(record['memberInstanceId'])),
  }
}

function parseState(value: unknown): PermissionOverlayState {
  const record = assertPlainRecord(value, 'PermissionOverlaySnapshot.state')
  assertNoLegacyFields(record, 'PermissionOverlaySnapshot.state')
  assertNoUnknownFields(record, PERMISSION_OVERLAY_STATE_FIELDS, 'PermissionOverlaySnapshot.state')
  assertFieldPresent(record, 'rules', 'PermissionOverlaySnapshot.state')
  const rawRules = record['rules']
  if (!Array.isArray(rawRules)) {
    invalid('PermissionOverlaySnapshot.state.rules must be an array of overlay rules', {
      field: 'state.rules',
      problem: 'rules-not-an-array',
    })
  }
  if (rawRules.length > PERMISSION_OVERLAY_MAX_RULES) {
    invalid(
      `PermissionOverlaySnapshot.state.rules carries ${String(rawRules.length)} rules; the structural bound is ${String(PERMISSION_OVERLAY_MAX_RULES)}`,
      { field: 'state.rules', problem: 'rule-set-over-bound', found: rawRules.length },
    )
  }
  const rules: PermissionOverlayRule[] = []
  const seen = new Set<string>()
  for (const [index, rawRule] of rawRules.entries()) {
    const rule = assertPlainRecord(rawRule, `PermissionOverlaySnapshot.state.rules[${String(index)}]`)
    assertNoLegacyFields(rule, `PermissionOverlaySnapshot.state.rules[${String(index)}]`)
    assertNoUnknownFields(rule, PERMISSION_OVERLAY_RULE_FIELDS, `PermissionOverlaySnapshot.state.rules[${String(index)}]`)
    for (const field of PERMISSION_OVERLAY_RULE_FIELDS) {
      assertFieldPresent(rule, field, `PermissionOverlaySnapshot.state.rules[${String(index)}]`)
    }
    const effect = rule['effect']
    if (!isPermissionOverlayEffect(effect)) {
      invalid(
        `PermissionOverlaySnapshot rule ${String(index)} effect must be one of ${PERMISSION_OVERLAY_EFFECT_VALUES.join(', ')}; got ${JSON.stringify(effect)}`,
        { field: `state.rules[${String(index)}].effect`, problem: 'effect-outside-closed-set' },
      )
    }
    const parsed: PermissionOverlayRule = {
      // A canonical operation-class token (label grammar: non-empty, no
      // control chars, <= 128). Nothing here interprets it.
      operation: parseLabelLikeField(rule['operation'], `state.rules[${String(index)}].operation`, 128),
      // The resource text (non-empty, <= 1024, no control chars). Exact /
      // subtree / exec-fingerprint MATCHING is PR3 (design §4/§5) — the
      // overlay row only carries the string.
      resource: parseWorkspaceField(rule['resource'], `state.rules[${String(index)}].resource`)!,
      effect,
    }
    const pair = `${parsed.operation}\u0000${parsed.resource}`
    if (seen.has(pair)) {
      // Two rules for the same (operation, resource) make the row itself
      // ambiguous, which is a structural defect — resolving WHICH one wins is
      // PR2/PR3 semantics and is deliberately NOT decided here.
      invalid(
        `PermissionOverlaySnapshot carries two rules for operation ${JSON.stringify(parsed.operation)} / resource ${JSON.stringify(parsed.resource)}`,
        { field: 'state.rules', problem: 'duplicate-rule-pair' },
      )
    }
    seen.add(pair)
    rules.push(parsed)
  }
  return { rules }
}

function parseMetadata(value: unknown): PermissionOverlayMetadata {
  const record = assertPlainRecord(value, 'PermissionOverlaySnapshot.metadata')
  assertNoLegacyFields(record, 'PermissionOverlaySnapshot.metadata')
  assertNoUnknownFields(record, PERMISSION_OVERLAY_METADATA_FIELDS, 'PermissionOverlaySnapshot.metadata')
  for (const field of PERMISSION_OVERLAY_METADATA_FIELDS) {
    assertFieldPresent(record, field, 'PermissionOverlaySnapshot.metadata')
  }
  const generation = record['generation']
  if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 1) {
    invalid(
      `PermissionOverlaySnapshot metadata.generation must be a safe integer >= 1 (the first generation is 1); got ${JSON.stringify(generation)}`,
      { field: 'metadata.generation', problem: 'generation-not-a-positive-integer' },
    )
  }
  const previous = record['previousSnapshotId']
  if (previous !== null) {
    if (typeof previous !== 'string' || previous.length === 0 || previous.length > PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH) {
      invalid(
        `PermissionOverlaySnapshot metadata.previousSnapshotId must be null or a non-empty string of at most ${String(PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH)} chars`,
        { field: 'metadata.previousSnapshotId', problem: 'previous-snapshot-id-malformed' },
      )
    }
  }
  if (generation === 1 && previous !== null) {
    invalid(
      `PermissionOverlaySnapshot generation 1 is the first snapshot of its chain and must carry previousSnapshotId null; got ${JSON.stringify(previous)}`,
      { field: 'metadata.previousSnapshotId', problem: 'first-generation-previous-snapshot-id', generation },
    )
  }
  if (generation > 1 && previous === null) {
    invalid(
      `PermissionOverlaySnapshot generation ${String(generation)} must name the snapshot it replaces (previousSnapshotId); got null`,
      { field: 'metadata.previousSnapshotId', problem: 'missing-previous-snapshot-id', generation },
    )
  }
  return { generation, previousSnapshotId: previous === null ? null : previous }
}

function parseProvenance(value: unknown): PermissionOverlayProvenance {
  const record = assertPlainRecord(value, 'PermissionOverlaySnapshot.provenance')
  assertNoLegacyFields(record, 'PermissionOverlaySnapshot.provenance')
  assertNoUnknownFields(record, PERMISSION_OVERLAY_PROVENANCE_FIELDS, 'PermissionOverlaySnapshot.provenance')
  for (const field of PERMISSION_OVERLAY_PROVENANCE_FIELDS) {
    assertFieldPresent(record, field, 'PermissionOverlaySnapshot.provenance')
  }
  const reason = record['reason']
  if (
    typeof reason !== 'string' ||
    reason.length > PERMISSION_OVERLAY_MAX_REASON_LENGTH ||
    [...reason].some((character) => character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f)
  ) {
    invalid(
      `PermissionOverlaySnapshot provenance.reason must be a string of at most ${String(PERMISSION_OVERLAY_MAX_REASON_LENGTH)} chars without control characters (empty is allowed)`,
      { field: 'provenance.reason', problem: 'reason-out-of-bounds' },
    )
  }
  return {
    // actor and mutationId are CARRIED attributes of the mutation (ADR §2/§7).
    // Their MEANING — Leader vs Human, envelope coverage, whether a Human
    // change exceeds the Leader's recovery range — is PR3's
    // GovernanceMutationService and is never consulted here.
    actor: parseLabelLikeField(record['actor'], 'provenance.actor', 128),
    mutationId: parseLabelLikeField(record['mutationId'], 'provenance.mutationId', 128),
    timestamp: parseIso8601TimestampField(record['timestamp']),
    reason,
  }
}

// ---------------------------------------------------------------------------
// Build / parse / canonicalize
// ---------------------------------------------------------------------------

/**
 * Build one validated snapshot row from the caller's four ADR §2 sections.
 * Stamps the mechanical fields (`schemaVersion`, derived `snapshotId`).
 * @param input - the identity/state/metadata/provenance sections.
 * @returns the deeply frozen snapshot.
 * @throws a contracts `MALFORMED_DTO` / id code for a malformed section or
 *   field (normalized into `RECORD_INVALID` by the repository boundary), or
 *   `RECORD_INVALID` for the storage-level structural rules above.
 */
export function createPermissionOverlaySnapshot(input: PermissionOverlaySnapshotInput): PermissionOverlaySnapshot {
  const record = assertPlainRecord(input, 'PermissionOverlaySnapshotInput')
  assertNoLegacyFields(record, 'PermissionOverlaySnapshotInput')
  assertNoUnknownFields(record, PERMISSION_OVERLAY_INPUT_SECTIONS, 'PermissionOverlaySnapshotInput')
  for (const section of PERMISSION_OVERLAY_INPUT_SECTIONS) {
    assertFieldPresent(record, section, 'PermissionOverlaySnapshotInput')
  }
  const identity = parseIdentity(record['identity'])
  const state = parseState(record['state'])
  const metadata = parseMetadata(record['metadata'])
  const provenance = parseProvenance(record['provenance'])
  return deepFreeze({
    schemaVersion: PERMISSION_OVERLAY_SCHEMA_VERSION,
    snapshotId: permissionOverlaySnapshotKey(identity.teamSessionId, identity.memberInstanceId, metadata.generation),
    identity,
    state,
    metadata,
    provenance,
  })
}

/**
 * Parse and validate an untrusted value (a decoded row) into a snapshot.
 * @param value - the unknown value.
 * @returns the deeply frozen snapshot.
 * @throws `RECORD_INVALID` for a foreign `schemaVersion`, an unknown or
 *   missing field, or a structural defect; the contracts codes for a
 *   malformed section.
 */
export function parsePermissionOverlaySnapshot(value: unknown): PermissionOverlaySnapshot {
  const record = assertPlainRecord(value, 'PermissionOverlaySnapshot')
  assertNoLegacyFields(record, 'PermissionOverlaySnapshot')
  assertNoUnknownFields(record, PERMISSION_OVERLAY_SNAPSHOT_FIELDS, 'PermissionOverlaySnapshot')
  for (const field of PERMISSION_OVERLAY_SNAPSHOT_FIELDS) {
    assertFieldPresent(record, field, 'PermissionOverlaySnapshot')
  }
  const schemaVersion = record['schemaVersion']
  if (schemaVersion !== PERMISSION_OVERLAY_SCHEMA_VERSION) {
    throw teamDomainError(
      'RECORD_INVALID',
      `PermissionOverlaySnapshot schemaVersion must be ${String(PERMISSION_OVERLAY_SCHEMA_VERSION)} (the overlay row type version), got ${JSON.stringify(schemaVersion)}`,
      { field: 'schemaVersion', expected: PERMISSION_OVERLAY_SCHEMA_VERSION, found: schemaVersion },
    )
  }
  const identity = parseIdentity(record['identity'])
  const state = parseState(record['state'])
  const metadata = parseMetadata(record['metadata'])
  const provenance = parseProvenance(record['provenance'])
  const derivedId = permissionOverlaySnapshotKey(identity.teamSessionId, identity.memberInstanceId, metadata.generation)
  if (record['snapshotId'] !== derivedId) {
    throw teamDomainError(
      'RECORD_INVALID',
      `PermissionOverlaySnapshot snapshotId ${JSON.stringify(record['snapshotId'])} does not match its derived identity/generation ${JSON.stringify(derivedId)}`,
      { field: 'snapshotId', expected: derivedId, problem: 'snapshot-id-not-derived' },
    )
  }
  return deepFreeze({
    schemaVersion: PERMISSION_OVERLAY_SCHEMA_VERSION,
    snapshotId: derivedId,
    identity,
    state,
    metadata,
    provenance,
  })
}

/**
 * Serialize a snapshot to its canonical JSON form (sorted keys, array order
 * preserved) — the byte form the store keeps and re-verifies on every read.
 * @param snapshot - the snapshot.
 * @returns the canonical JSON text.
 */
export function serializePermissionOverlaySnapshot(snapshot: PermissionOverlaySnapshot): string {
  return canonicalJsonStringify(snapshot)
}

/**
 * Deserialize canonical JSON into a validated, frozen snapshot.
 * @param json - the canonical JSON text.
 * @returns the snapshot.
 * @throws `RECORD_INVALID` (problem `malformed-json`) for invalid JSON, plus
 *   whatever {@link parsePermissionOverlaySnapshot} rejects.
 */
export function deserializePermissionOverlaySnapshot(json: string): PermissionOverlaySnapshot {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw teamDomainError(
      'RECORD_INVALID',
      `PermissionOverlaySnapshot JSON is not valid: ${error instanceof Error ? error.message : String(error)}`,
      { problem: 'malformed-json' },
    )
  }
  return parsePermissionOverlaySnapshot(value)
}
