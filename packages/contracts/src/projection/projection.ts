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
import { PROJECTION_SCHEMA_VERSION, assertProjectionSchemaVersion } from './schema.js'
import type { ProjectionSchemaVersion } from './schema.js'
import { parseTeamRootProjection } from './root.js'
import type { TeamRootProjectionDto, TeamRootProjectionInput } from './root.js'
import { parseTemplateProjection } from './template.js'
import type { TemplateProjectionDto, TemplateProjectionInput } from './template.js'
import { parseMemberProjection } from './member.js'
import type { MemberProjectionDto, MemberProjectionInput } from './member.js'
import { parseLedgerSummary } from './ledger.js'
import type { LedgerSummaryDto, LedgerSummaryInput } from './ledger.js'

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
 * The whole read-only view of one TeamSession (projection contract v1).
 */
export interface TeamProjectionDto {
  /** The projection schema version; v1 projections carry `1`. */
  readonly schemaVersion: ProjectionSchemaVersion
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
}

/**
 * Producer input for {@link createTeamProjection}: all fields except
 * `schemaVersion` (stamped by the factory). Input records must not carry
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
  assertNoUnknownFields(record, TEAM_PROJECTION_FIELDS, 'TeamProjection')
  for (const field of TEAM_PROJECTION_FIELDS) {
    assertFieldPresent(record, field, 'TeamProjection')
  }
  assertProjectionSchemaVersion(record['schemaVersion'])
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
    parseMemberProjection(item),
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

  return deepFreeze({
    schemaVersion: record['schemaVersion'] as ProjectionSchemaVersion,
    teamSessionId,
    blueprint,
    generation,
    generatedAt,
    root,
    templates,
    members,
    ledger: parseLedgerSummary(record['ledger']),
  })
}

/**
 * Parse and validate a TeamProjectionDto from an untrusted value.
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
 * @returns the frozen projection stamped with the v1 projection schema
 *   version.
 */
export function createTeamProjection(input: TeamProjectionInput): TeamProjectionDto {
  const record: RemoteSafeRecord = {
    schemaVersion: PROJECTION_SCHEMA_VERSION,
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
