/**
 * TeamProjectionDto — the frozen v1 projection contract (P8-T1): the whole
 * read-only view of one TeamSession that the P8-T2 read service produces
 * from TeamDomain (+ an optional live overlay) and the client renders
 * (Development Plan §21).
 *
 * Frozen facts (frozen 20260829 plan docs; invariant numbers refer to
 * Architecture §42):
 *
 * - **Source**: TeamDomain (invariant 41) + an optional live overlay
 *   (DevPlan §21.2). The projection NEVER scans Root+child Session logs
 *   and never carries session-log facts.
 * - **Identity**: `teamSessionId` IS the root DSH session id (invariant
 *   9); the projection binds exactly one immutable blueprint snapshot
 *   (invariant 10, embedded ref).
 * - **Generation**: `generation` is the WHOLE-projection monotonic
 *   generation (DevPlan §21.4): it starts at 1 and only increases; a
 *   client applying an incoming projection MUST reject a stale overwrite
 *   (`isStaleTeamProjection` below is the frozen guard).
 * - **Root**: the identity + admission view (root.ts) — NO lifecycle field
 *   (Architecture §8.6).
 * - **Templates**: exactly ONE leader template (invariant 13) and the
 *   member templates (invariant 17) of the bound snapshot.
 * - **Members**: every MemberInstance plus the LeaderInstance as one
 *   unified row (invariant 14, member.ts); `instanceId` is unique within
 *   the team (invariant 18); each non-leader row references an existing
 *   member template; the leader row references the leader template.
 * - **Ledger**: the summary only (ledger.ts, UI §27).
 *
 * The v1 freeze covers every field of every embedded record; adding a
 * field is a new projection schema version (schema.ts track), never a
 * silent edit of this v1.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/projection
 */

import {
  assertFieldPresent,
  assertNoUnknownFields,
  assertPlainRecord,
  parseIso8601TimestampField,
} from '../dto/common.js'
import { parseBlueprintSnapshotRef } from '../dto/blueprint-snapshot.js'
import type { BlueprintSnapshotRef } from '../dto/blueprint-snapshot.js'
import { parseTeamSessionId } from '../ids/session-id.js'
import type { TeamSessionId } from '../ids/session-id.js'
import { assertPositiveInteger } from '../ids/common.js'
import { LEADER_INSTANCE_ID } from '../identity.js'
import { assertNoLegacyFields } from '../legacy-vocabulary.js'
import { teamContractError } from '../errors.js'
import { canonicalJsonStringify, deepFreeze } from '../remote-safe.js'
import type { RemoteSafeRecord } from '../remote-safe.js'
import { toRecord } from './common.js'
import {
  PROJECTION_SCHEMA_VERSION,
  PROJECTION_SCHEMA_VERSION_V2,
  assertProjectionSchemaVersion,
} from './schema.js'
import type { ProjectionSchemaVersion, ProjectionSchemaVersionV2 } from './schema.js'
import { parseTeamRootProjection } from './root.js'
import type { TeamRootProjectionDto, TeamRootProjectionInput } from './root.js'
import { parseTemplateProjection } from './template.js'
import type { TemplateProjectionDto, TemplateProjectionInput } from './template.js'
import { parseMemberProjection } from './member.js'
import type { MemberProjectionDto, MemberProjectionInput } from './member.js'
import { parseLedgerSummary } from './ledger.js'
import type { LedgerSummaryDto, LedgerSummaryInput } from './ledger.js'
import { parseDisposedMemberHistory } from './disposed-history.js'
import type {
  DisposedMemberHistoryDto,
  DisposedMemberHistoryInput,
} from './disposed-history.js'
import { MEMBER_LIFECYCLE_STATES } from '../dto/member-instance-record.js'

/** The exact frozen fields of a TeamProjectionDto (v1). */
export const TEAM_PROJECTION_FIELDS: readonly string[] = [
  'schemaVersion',
  'teamSessionId',
  'blueprint',
  'generation',
  'generatedAt',
  'root',
  'templates',
  'members',
  'ledger',
]

/**
 * The top-level projection fields of schema version 2 (S7-R2, repairs
 * R2-2..R2-6): the v1 set plus the DURATIONAL-optional additive key
 * `disposedHistory` (R2-6, D14 — the retained-history bundle of every
 * DISPOSED member; see disposed-history.ts). A v2 record may carry exactly
 * the v1 key set — every additive key is optional (absent, never
 * own-undefined; the key is ABSENT when the team has no DISPOSED member, so
 * the default projection is byte-identical to the pre-repair shape). The
 * member-level v2 additions live in `MEMBER_PROJECTION_FIELDS_V2`.
 */
export const TEAM_PROJECTION_FIELDS_V2: readonly string[] = [
  ...TEAM_PROJECTION_FIELDS,
  'disposedHistory',
]

/**
 * The whole read-only view of one TeamSession (projection contract v1).
 */
export interface TeamProjectionDto {
  /**
   * The projection schema version: v1 carries `1`; the additive S7-R2
   * repairs stamp `2` (R2-2..R2-6; v1 semantics immutable — see schema.ts).
   */
  readonly schemaVersion: ProjectionSchemaVersion | ProjectionSchemaVersionV2
  /** The TeamSession id — which IS the root DSH session id (invariant 9). */
  readonly teamSessionId: TeamSessionId
  /** The immutable blueprint snapshot the TeamSession binds (invariant 10). */
  readonly blueprint: BlueprintSnapshotRef
  /** The whole-projection monotonic generation (>= 1, DevPlan §21.4). */
  readonly generation: number
  /** When this projection was produced, ISO-8601. */
  readonly generatedAt: string
  /** The TeamSession identity + admission view (no lifecycle, §8.6). */
  readonly root: TeamRootProjectionDto
  /** The templates of the bound snapshot: exactly one leader (invariant 13). */
  readonly templates: readonly TemplateProjectionDto[]
  /** Every member plus the LeaderInstance (invariant 14). */
  readonly members: readonly MemberProjectionDto[]
  /** The TeamLedger summary (UI §27). */
  readonly ledger: LedgerSummaryDto
  /**
   * S7-R2 (R2-6, D14): the retained-history bundle of EVERY DISPOSED member
   * (schema version 2 only — the v1 field set rejects the key). DURATIONAL-
   * optional: ABSENT when the team has no DISPOSED member (the live view
   * (BQ-04) semantics are unchanged); PRESENT (non-empty) exactly when one
   * exists. The bundle's instance ids are exactly the DISPOSED member rows
   * (validated cross-field at parse).
   */
  readonly disposedHistory?: readonly DisposedMemberHistoryDto[]
}

/**
 * Producer input for {@link createTeamProjection}: all fields except
 * `schemaVersion` (stamped by the factory from the optional
 * `input.schemaVersion`, defaulting to v1). Input records must not carry
 * own `undefined` keys (lossless-JSON discipline).
 */
export interface TeamProjectionInput {
  /** The TeamSession id (root DSH session id). */
  teamSessionId: TeamSessionId
  /** The immutable blueprint snapshot. */
  blueprint: BlueprintSnapshotRef
  /** The whole-projection generation (>= 1). */
  generation: number
  /** When this projection is produced, ISO-8601. */
  generatedAt: string
  /** The root view (or a plain record for it). */
  root: TeamRootProjectionInput
  /** The template rows (or plain records for them). */
  templates: readonly TemplateProjectionInput[]
  /** The member rows (or plain records for them). */
  members: readonly MemberProjectionInput[]
  /** The ledger summary (or a plain record for it). */
  ledger: LedgerSummaryInput
  /**
   * S7-R2 (R2-6, D14): the retained-history bundle of every DISPOSED member
   * (stamped only for schema version 2 — a v1 projection never carries the
   * key; ABSENT when there is no DISPOSED member).
   */
  disposedHistory?: readonly DisposedMemberHistoryInput[]
  /**
   * The projection schema version to stamp (S7-R2): `2` for the additive
   * repair fields (R2-2..R2-6); defaults to `1` (v1).
   */
  schemaVersion?: 1 | 2
}

function assertDtoArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be an array, got ${typeof value}`,
      { field },
    )
  }
  return value as unknown[]
}

function assertCrossFieldInvariant(condition: boolean, reason: string, message: string): void {
  if (!condition) {
    throw teamContractError('MALFORMED_DTO', message, { reason })
  }
}

function validateTeamProjection(record: RemoteSafeRecord): TeamProjectionDto {
  assertNoLegacyFields(record, 'TeamProjection')
  // R2-2 (S7-R2): the field set and the per-member parse version follow the
  // record's own schema version (v1 set for `1`, the additive v2 set for
  // `2`). `assertProjectionSchemaVersion` accepts the supported [1, 2].
  const fields =
    record['schemaVersion'] === 2 ? TEAM_PROJECTION_FIELDS_V2 : TEAM_PROJECTION_FIELDS
  assertNoUnknownFields(record, fields, 'TeamProjection')
  for (const field of fields) {
    // R2-6 (S7-R2): `disposedHistory` is DURATIONAL-optional (absent when
    // the team has no DISPOSED member) — admitted by the v2 set, exempt
    // from the presence loop.
    if (field !== 'disposedHistory') {
      assertFieldPresent(record, field, 'TeamProjection')
    }
  }
  assertProjectionSchemaVersion(record['schemaVersion'])
  const schemaVersion: 1 | 2 = record['schemaVersion'] === 2 ? 2 : 1
  const teamSessionId = parseTeamSessionId(record['teamSessionId'])
  const generation = assertPositiveInteger(record['generation'], 'generation')
  const generatedAt = parseIso8601TimestampField(record['generatedAt'])
  const blueprint = parseBlueprintSnapshotRef(record['blueprint'])
  const root = parseTeamRootProjection(record['root'])
  assertCrossFieldInvariant(
    root.teamSessionId === teamSessionId,
    'ROOT_TEAM_SESSION_MISMATCH',
    'root.teamSessionId must equal the projection teamSessionId (invariant 9)',
  )
  const templates = assertDtoArray(record['templates'], 'templates').map((item) =>
    parseTemplateProjection(item),
  )
  const members = assertDtoArray(record['members'], 'members').map((item) =>
    parseMemberProjection(item, schemaVersion),
  )

  // Invariant 13: exactly one leader template.
  const leaderTemplates = templates.filter((template) => template.kind === 'leader')
  assertCrossFieldInvariant(
    leaderTemplates.length === 1,
    leaderTemplates.length === 0 ? 'LEADER_TEMPLATE_MISSING' : 'LEADER_TEMPLATE_NOT_UNIQUE',
    `templates must contain exactly one leader template, got ${leaderTemplates.length}`,
  )
  // Length is 1 (asserted above); the assertion operator documents that.
  const leaderTemplateId = leaderTemplates[0]!.templateId
  const memberTemplateIds = new Set(
    templates.filter((template) => template.kind === 'member').map((template) => template.templateId),
  )
  const seenTemplateIds = new Set<string>()
  for (const template of templates) {
    assertCrossFieldInvariant(
      !seenTemplateIds.has(template.templateId),
      'TEMPLATE_ID_DUPLICATE',
      `templateId ${template.templateId} appears more than once in templates`,
    )
    seenTemplateIds.add(template.templateId)
  }

  // Invariants 14/17/18: leader instance exactly once, instance ids unique,
  // every non-leader member references an existing member template.
  const seenInstanceIds = new Set<string>()
  let leaderInstance: MemberProjectionDto | null = null
  for (const member of members) {
    assertCrossFieldInvariant(
      !seenInstanceIds.has(member.instanceId),
      'INSTANCE_ID_DUPLICATE',
      `instanceId ${member.instanceId} appears more than once in members`,
    )
    seenInstanceIds.add(member.instanceId)
    if (member.instanceId === LEADER_INSTANCE_ID) {
      assertCrossFieldInvariant(
        leaderInstance === null,
        'LEADER_INSTANCE_DUPLICATE',
        'the LeaderInstance (inst-leader) appears more than once in members',
      )
      leaderInstance = member
      assertCrossFieldInvariant(
        member.templateId === leaderTemplateId,
        'LEADER_TEMPLATE_MISMATCH',
        `the LeaderInstance must reference the leader template (${leaderTemplateId}), got ${member.templateId}`,
      )
    } else {
      assertCrossFieldInvariant(
        memberTemplateIds.has(member.templateId),
        'UNKNOWN_MEMBER_TEMPLATE',
        `member ${member.instanceId} references unknown member template ${member.templateId}`,
      )
    }
  }
  assertCrossFieldInvariant(
    leaderInstance !== null,
    'LEADER_INSTANCE_MISSING',
    'members must contain exactly one LeaderInstance (inst-leader)',
  )

  // R2-6 (S7-R2, D14): the additive v2 retained-history bundle. The v1
  // field set rejected the key above, so its presence implies schema
  // version 2. DURATIONAL-optional semantics: ABSENT when no DISPOSED
  // member exists; PRESENT means non-empty, and the bundle must be EXACTLY
  // the set of DISPOSED member rows (live view (BQ-04) semantics unchanged
  // — the member rows themselves are untouched).
  let disposedHistory: readonly DisposedMemberHistoryDto[] | undefined
  if (record['disposedHistory'] !== undefined) {
    const entries = assertDtoArray(record['disposedHistory'], 'disposedHistory').map((item) =>
      parseDisposedMemberHistory(item),
    )
    if (entries.length === 0) {
      throw teamContractError(
        'MALFORMED_DTO',
        'disposedHistory must be non-empty when present (a team with no DISPOSED member carries no key)',
        { field: 'disposedHistory', reason: 'DISPOSED_HISTORY_EMPTY' },
      )
    }
    const disposedIds = new Set(
      members
        .filter((member) => member.lifecycle === MEMBER_LIFECYCLE_STATES.DISPOSED)
        .map((member) => member.instanceId),
    )
    const seen = new Set<string>()
    for (const entry of entries) {
      if (seen.has(entry.instanceId)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `disposedHistory carries duplicate instance id ${entry.instanceId}`,
          { field: 'disposedHistory', reason: 'DISPOSED_HISTORY_DUPLICATE_INSTANCE' },
        )
      }
      seen.add(entry.instanceId)
      if (!disposedIds.has(entry.instanceId)) {
        throw teamContractError(
          'MALFORMED_DTO',
          `disposedHistory entry ${entry.instanceId} does not reference a DISPOSED member row`,
          { field: 'disposedHistory', reason: 'DISPOSED_HISTORY_UNKNOWN_INSTANCE' },
        )
      }
    }
    assertCrossFieldInvariant(
      seen.size === disposedIds.size,
      'DISPOSED_HISTORY_INCOMPLETE',
      `disposedHistory must cover every DISPOSED member row exactly once (bundle: ${entries.length}, DISPOSED rows: ${disposedIds.size})`,
    )
    disposedHistory = entries
  }

  return deepFreeze({
    schemaVersion: schemaVersion,
    teamSessionId,
    blueprint,
    generation,
    generatedAt,
    root,
    templates,
    members,
    ledger: parseLedgerSummary(record['ledger']),
    ...(disposedHistory !== undefined ? { disposedHistory } : {}),
  })
}

/**
 * Parse and validate a TeamProjectionDto from an untrusted value. The
 * schema version is read from the record itself: v1 records parse through
 * the v1 field sets, v2 records (S7-R2, R2-2..R2-6) through the additive
 * v2 field sets.
 * @param value - the unknown input (e.g. a value decoded from the wire).
 * @returns the frozen projection.
 * @throws `MALFORMED_DTO`, `SCHEMA_VERSION_MISMATCH`,
 *   `SCHEMA_VERSION_UNSUPPORTED`, `LEGACY_MEMBER_ID_REJECTED`,
 *   `INVALID_ROOT_SESSION_ID`, or the field/cross-field codes of the
 *   embedded records.
 */
export function parseTeamProjection(value: unknown): TeamProjectionDto {
  return validateTeamProjection(assertPlainRecord(value, 'TeamProjection'))
}

/**
 * Build a fresh TeamProjectionDto from producer input (already branded
 * ids; input records must not carry own `undefined` keys). The result is
 * validated through the same pipeline as `parseTeamProjection`.
 * @param input - the projection fields.
 * @returns the frozen projection stamped with the requested projection
 *   schema version (v1 by default; v2 for the additive S7-R2 repair
 *   fields).
 */
export function createTeamProjection(input: TeamProjectionInput): TeamProjectionDto {
  const record: RemoteSafeRecord = {
    schemaVersion:
      input.schemaVersion === 2 ? PROJECTION_SCHEMA_VERSION_V2 : PROJECTION_SCHEMA_VERSION,
    teamSessionId: input.teamSessionId,
    blueprint: {
      blueprintId: input.blueprint.blueprintId,
      revision: input.blueprint.revision,
      contentHash: input.blueprint.contentHash,
    },
    generation: input.generation,
    generatedAt: input.generatedAt,
    root: toRecord(input.root),
    templates: input.templates.map((template) => toRecord(template)),
    members: input.members.map((member) => toRecord(member)),
    ledger: toRecord(input.ledger),
  }
  // R2-6 (S7-R2, D14): the additive retained-history bundle. Stamped only
  // for schema version 2 (a v1 projection never carries the key) and only
  // when the producer derived bundles (ABSENT when no DISPOSED member
  // exists — the default projection stays byte-identical).
  if (input.schemaVersion === 2 && input.disposedHistory !== undefined) {
    record['disposedHistory'] = input.disposedHistory.map((entry) => toRecord(entry))
  }
  return validateTeamProjection(record)
}

/**
 * Serialize a projection to canonical JSON (keys in ascending order;
 * deterministic for deeply-equal values).
 * @param projection - the projection to serialize.
 * @returns the canonical JSON text.
 */
export function serializeTeamProjection(projection: TeamProjectionDto): string {
  return canonicalJsonStringify(projection)
}

/**
 * Deserialize a canonical JSON projection back into a validated, frozen
 * projection.
 * @param json - the canonical JSON text.
 * @returns the parsed projection.
 * @throws `MALFORMED_DTO` when the text is not valid JSON, plus the
 *   validation codes a malformed projection triggers.
 */
export function deserializeTeamProjection(json: string): TeamProjectionDto {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw teamContractError(
      'MALFORMED_DTO',
      `TeamProjection JSON is not valid: ${error instanceof Error ? error.message : String(error)}`,
      {},
    )
  }
  return parseTeamProjection(value)
}

/**
 * Stale-overwrite guard (DevPlan §21.4): the whole-projection generation is
 * monotonic per team. A client applying an incoming projection must reject
 * it when it would not advance the generation it already holds.
 *
 * @param current - the projection the client already holds.
 * @param incoming - the incoming projection.
 * @returns `true` when `incoming` is stale: same TeamSession AND
 *   `incoming.generation <= current.generation`. A projection of a
 *   different teamSessionId is never comparable and is NOT stale (the
 *   guard is per-team; the client keys projections by teamSessionId).
 */
export function isStaleTeamProjection(
  current: TeamProjectionDto,
  incoming: TeamProjectionDto,
): boolean {
  if (current.teamSessionId !== incoming.teamSessionId) {
    return false
  }
  return incoming.generation <= current.generation
}
