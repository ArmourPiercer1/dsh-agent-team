/**
 * GovernanceOverrideRecord — the `overrides` store record
 * (Architecture §14.3 category D, storage-level v1).
 *
 * The store distinguishes the four kinds of governance state the
 * architecture forbids to conflate:
 *
 * - **autonomy-overlay × team scope** — a template-level autonomy overlay
 *   (`kind: 'autonomy-overlay'`, `scope: 'team'`), owned by the agent
 *   authority (`origin: 'leader' | 'member'`);
 * - **autonomy-overlay × instance scope** — a member-level autonomy
 *   overlay (`kind: 'autonomy-overlay'`, `scope: 'instance'`,
 *   `instanceId` present), owned by the agent authority;
 * - **human-override × team scope** — a human override of the TeamSession
 *   (`kind: 'human-override'`, `scope: 'team'`), no agent origin;
 * - **human-override × instance scope** — a human override of one
 *   MemberInstance (`kind: 'human-override'`, `scope: 'instance'`),
 *   no agent origin.
 *
 * Cross-field rules make the distinction untraceable-proof:
 * `origin` is REQUIRED exactly for `autonomy-overlay` (agent autonomy
 * mutations are attributable to the agent authority) and FORBIDDEN for
 * `human-override` (human overrides are not agent acts); `instanceId` is
 * required exactly for `scope: 'instance'`. An agent autonomy mutation
 * therefore can never masquerade as a human override and there is no
 * untraceable patch (Architecture §14.3 D).
 *
 * `values` is the lossless-JSON payload (per-cell policy values); its
 * semantic validation belongs to the P3 policy domain, not to storage.
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/schema/override
 */

import {
  assertNoLegacyFields,
  assertRemoteSafeJsonValue,
  canonicalJsonStringify,
  deepFreeze,
  parseInstanceId,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import type { InstanceId, RootSessionId, RemoteSafeRecord } from '../../contracts/src/index.js'
import { assertFieldPresent, assertNoUnknownFields, assertPlainRecord, parseIso8601TimestampField } from '../../contracts/src/dto/common.js'
import { teamDomainError } from './errors.js'
import { FIELD_ID_MAX_LENGTH, assertHygienicStringField, assertPositiveIntField } from './field-rules.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from './stores.js'

/** The two frozen governance override kinds (autonomy vs human). */
export const GOVERNANCE_OVERRIDE_KINDS = {
  /** An agent autonomy mutation (overlay), attributable to the agent authority. */
  AUTONOMY_OVERLAY: 'autonomy-overlay',
  /** A human override, never attributable to an agent. */
  HUMAN_OVERRIDE: 'human-override',
} as const

/** One of the two frozen governance override kinds. */
export type GovernanceOverrideKind = (typeof GOVERNANCE_OVERRIDE_KINDS)[keyof typeof GOVERNANCE_OVERRIDE_KINDS]

/** The two frozen governance scopes (team session vs member instance). */
export const GOVERNANCE_OVERRIDE_SCOPES = {
  /** Scoped to the TeamSession (template-level state). */
  TEAM: 'team',
  /** Scoped to one MemberInstance. */
  INSTANCE: 'instance',
} as const

/** One of the two frozen governance scopes. */
export type GovernanceOverrideScope = (typeof GOVERNANCE_OVERRIDE_SCOPES)[keyof typeof GOVERNANCE_OVERRIDE_SCOPES]

/** The two frozen agent-authority origins for autonomy overlays. */
export const GOVERNANCE_OVERRIDE_ORIGINS = {
  /** The mutation originated from the LeaderInstance authority. */
  LEADER: 'leader',
  /** The mutation originated from a member authority. */
  MEMBER: 'member',
} as const

/** One of the two frozen agent-authority origins. */
export type GovernanceOverrideOrigin = (typeof GOVERNANCE_OVERRIDE_ORIGINS)[keyof typeof GOVERNANCE_OVERRIDE_ORIGINS]

/** The exact frozen fields of a GovernanceOverrideRecord (v1). */
export const GOVERNANCE_OVERRIDE_FIELDS: readonly string[] = [
  'schemaVersion',
  'kind',
  'recordId',
  'scope',
  'rootSessionId',
  'instanceId',
  'origin',
  'values',
  'generation',
  'updatedAt',
]

/**
 * The `overrides` store record: one durable governance override.
 */
export interface GovernanceOverrideRecord {
  /** Record shape version; v1 records carry `1`. */
  readonly schemaVersion: number
  /** Autonomy overlay (agent) vs human override. */
  readonly kind: GovernanceOverrideKind
  /** The override's own identity (overlayId/overrideId of the policy layer). */
  readonly recordId: string
  /** TeamSession scope vs MemberInstance scope. */
  readonly scope: GovernanceOverrideScope
  /** The TeamSession (root session id) the override belongs to. */
  readonly rootSessionId: RootSessionId
  /** The targeted MemberInstance id; present exactly when scope is `instance`. */
  readonly instanceId?: InstanceId
  /** The agent authority the mutation is attributable to; present exactly when kind is `autonomy-overlay`. */
  readonly origin?: GovernanceOverrideOrigin
  /** The lossless-JSON payload (per-cell policy values). */
  readonly values: RemoteSafeRecord
  /** Record version/generation counter (starts at 1). */
  readonly generation: number
  /** Last modification time, ISO-8601. */
  readonly updatedAt: string
}

/**
 * The identity components of an override row (the store key inputs).
 */
export interface GovernanceOverrideIdentity {
  readonly kind: GovernanceOverrideKind
  readonly recordId: string
  readonly scope: GovernanceOverrideScope
  readonly rootSessionId: string
  readonly instanceId?: string
}

function isGovernanceOverrideKind(value: unknown): value is GovernanceOverrideKind {
  return value === GOVERNANCE_OVERRIDE_KINDS.AUTONOMY_OVERLAY || value === GOVERNANCE_OVERRIDE_KINDS.HUMAN_OVERRIDE
}

function isGovernanceOverrideScope(value: unknown): value is GovernanceOverrideScope {
  return value === GOVERNANCE_OVERRIDE_SCOPES.TEAM || value === GOVERNANCE_OVERRIDE_SCOPES.INSTANCE
}

function isGovernanceOverrideOrigin(value: unknown): value is GovernanceOverrideOrigin {
  return value === GOVERNANCE_OVERRIDE_ORIGINS.LEADER || value === GOVERNANCE_OVERRIDE_ORIGINS.MEMBER
}

/**
 * The stable store key of an override row: the canonical JSON of the
 * identity components (sorted keys; `instanceId` omitted when absent).
 * @param identity - the identity components.
 * @returns the canonical JSON key string.
 */
export function governanceOverrideKey(identity: GovernanceOverrideIdentity): string {
  const record: RemoteSafeRecord = {
    kind: identity.kind,
    recordId: identity.recordId,
    rootSessionId: identity.rootSessionId,
    scope: identity.scope,
  }
  if (identity.instanceId !== undefined) record['instanceId'] = identity.instanceId
  return canonicalJsonStringify(record)
}

/**
 * Parse and validate a governance override record from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen record.
 * @throws `RECORD_INVALID` (storage-level, with field/problem details) for
 *   any rule violation, plus contracts codes (preserved via
 *   `normalizeValidationError`) for malformed session/instance ids.
 */
export function parseGovernanceOverride(value: unknown): GovernanceOverrideRecord {
  const record = assertPlainRecord(value, 'GovernanceOverride')
  assertNoLegacyFields(record, 'GovernanceOverride')
  assertNoUnknownFields(record, GOVERNANCE_OVERRIDE_FIELDS, 'GovernanceOverride')
  for (const field of GOVERNANCE_OVERRIDE_FIELDS) {
    if (field !== 'instanceId' && field !== 'origin') assertFieldPresent(record, field, 'GovernanceOverride')
  }
  if (record['schemaVersion'] !== TEAM_DOMAIN_SCHEMA_VERSION) {
    throw teamDomainError(
      'RECORD_INVALID',
      `GovernanceOverride schemaVersion must be ${TEAM_DOMAIN_SCHEMA_VERSION}, got ${JSON.stringify(record['schemaVersion'])}`,
      { field: 'schemaVersion', expected: TEAM_DOMAIN_SCHEMA_VERSION, found: record['schemaVersion'] },
    )
  }
  const kind = record['kind']
  if (!isGovernanceOverrideKind(kind)) {
    throw teamDomainError(
      'RECORD_INVALID',
      `GovernanceOverride kind must be '${GOVERNANCE_OVERRIDE_KINDS.AUTONOMY_OVERLAY}' or '${GOVERNANCE_OVERRIDE_KINDS.HUMAN_OVERRIDE}', got ${JSON.stringify(kind)}`,
      { field: 'kind', problem: 'bad-kind' },
    )
  }
  const recordId = assertHygienicStringField(record['recordId'], 'recordId', FIELD_ID_MAX_LENGTH)
  const scope = record['scope']
  if (!isGovernanceOverrideScope(scope)) {
    throw teamDomainError(
      'RECORD_INVALID',
      `GovernanceOverride scope must be '${GOVERNANCE_OVERRIDE_SCOPES.TEAM}' or '${GOVERNANCE_OVERRIDE_SCOPES.INSTANCE}', got ${JSON.stringify(scope)}`,
      { field: 'scope', problem: 'bad-scope' },
    )
  }
  const rootSessionId = parseRootSessionId(record['rootSessionId'])
  let instanceId: InstanceId | undefined
  if (scope === GOVERNANCE_OVERRIDE_SCOPES.INSTANCE) {
    if (record['instanceId'] === undefined) {
      throw teamDomainError(
        'RECORD_INVALID',
        "GovernanceOverride with scope 'instance' requires instanceId",
        { field: 'instanceId', problem: 'instanceId-required-for-instance-scope' },
      )
    }
    instanceId = parseInstanceId(record['instanceId'])
  } else if (record['instanceId'] !== undefined) {
    throw teamDomainError(
      'RECORD_INVALID',
      "GovernanceOverride with scope 'team' must not carry instanceId",
      { field: 'instanceId', problem: 'instanceId-forbidden-for-team-scope' },
    )
  }
  let origin: GovernanceOverrideOrigin | undefined
  if (kind === GOVERNANCE_OVERRIDE_KINDS.AUTONOMY_OVERLAY) {
    if (record['origin'] === undefined || !isGovernanceOverrideOrigin(record['origin'])) {
      throw teamDomainError(
        'RECORD_INVALID',
        `GovernanceOverride of kind 'autonomy-overlay' requires origin 'leader' or 'member' (agent autonomy mutations are never untraceable)`,
        { field: 'origin', problem: 'origin-required-for-autonomy-overlay' },
      )
    }
    origin = record['origin']
  } else if (record['origin'] !== undefined) {
    throw teamDomainError(
      'RECORD_INVALID',
      "GovernanceOverride of kind 'human-override' must not carry origin (human overrides are not agent acts)",
      { field: 'origin', problem: 'origin-forbidden-for-human-override' },
    )
  }
  const values = assertPlainRecord(record['values'], 'values')
  const generation = assertPositiveIntField(record['generation'], 'generation')
  const updatedAt = parseIso8601TimestampField(record['updatedAt'])
  const result: RemoteSafeRecord = {
    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
    kind,
    recordId,
    scope,
    rootSessionId,
    values,
    generation,
    updatedAt,
  }
  if (instanceId !== undefined) result['instanceId'] = instanceId
  if (origin !== undefined) result['origin'] = origin
  assertRemoteSafeJsonValue(result)
  return deepFreeze(result) as unknown as GovernanceOverrideRecord
}

/**
 * Serialize a record to its stable canonical JSON form (sorted keys).
 * @param record - the record.
 * @returns the canonical JSON text.
 */
export function serializeGovernanceOverride(record: GovernanceOverrideRecord): string {
  return canonicalJsonStringify(record)
}

/**
 * Deserialize canonical JSON back into a validated, frozen record.
 * @param json - the canonical JSON text.
 * @returns the parsed record.
 * @throws `RECORD_INVALID` (problem `malformed-json`) when the text is not
 *   valid JSON, plus the validation codes a malformed record triggers.
 */
export function deserializeGovernanceOverride(json: string): GovernanceOverrideRecord {
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch (error) {
    throw teamDomainError(
      'RECORD_INVALID',
      `GovernanceOverride JSON is not valid: ${error instanceof Error ? error.message : String(error)}`,
      { problem: 'malformed-json' },
    )
  }
  return parseGovernanceOverride(value)
}
