/**
 * EffectiveConfigEntry / EffectiveConfigDto — the per-member effective
 * configuration view of the projection (UI §18.2 example: Model, Workspace,
 * Bash/Web permission rows, Autonomy overlay — each with provenance).
 *
 * Design facts (frozen 20260829 plan docs):
 *
 * - Every effective value carries its RESOLVED provenance: `source` (which
 *   factor of the §19.6 effective-policy intersection produced it) and
 *   `state` (the frozen UI §18.3 state of the value). The projection is a
 *   VIEW: it carries the resolved result, never the resolver.
 * - `value` is an opaque display string, or `null` when the factor produced
 *   no value (e.g. a denied permission: source + state are meaningful, the
 *   value is absent as null — never as an absent key: `value` is a required
 *   key of the entry).
 * - `permissions` is the map lane: permission name -> entry. Keys are
 *   validated opaque names (non-empty, <= 128, no control characters); the
 *   map may be empty.
 * - The four lanes model / workspace / permissions / autonomy cover the
 *   §18.2 example exactly; adding a lane is a projection contract change
 *   (a new schema version), never a silent field addition.
 *
 * Both types are embedded values: the enclosing versioned record owns the
 * schema version, so neither carries one of its own (same discipline as
 * BlueprintSnapshotRef).
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/projection/effective-config
 */

import {
  LABEL_MAX_LENGTH,
  assertFieldPresent,
  assertNoUnknownFields,
  assertPlainRecord,
  parseLabelLikeField,
} from '../dto/common.js'
import { hasControlChars } from '../ids/common.js'
import { teamContractError } from '../errors.js'
import { deepFreeze } from '../remote-safe.js'
import type { RemoteSafeRecord } from '../remote-safe.js'

/** Max length of an opaque effective-config value (display string). */
export const EFFECTIVE_CONFIG_VALUE_MAX_LENGTH = 512

// --- source vocabulary -----------------------------------------------------------

/**
 * The frozen sources of an effective configuration value: the factors of
 * the §19.6 effective-policy intersection, in the order the UI §18.2
 * example renders them.
 */
export const EFFECTIVE_CONFIG_SOURCES = {
  /** Inherited from the bound blueprint snapshot. */
  blueprint: 'blueprint',
  /** Set by the member's template. */
  member_template: 'member-template',
  /** Set at instance creation (e.g. the locked workspace). */
  instance_creation: 'instance-creation',
  /** Resolved by the current PolicyState. */
  policy_state: 'policy-state',
  /** Resolved by the autonomy overlay. */
  autonomy_overlay: 'autonomy-overlay',
  /** Set by an explicit human override. */
  explicit_human_override: 'explicit-human-override',
  /** Set by an external hard policy (winning over every Team factor). */
  external_hard_policy: 'external-hard-policy',
  /** Resolved from the runtime capability set (e.g. model availability). */
  capability: 'capability',
} as const

/** The frozen effective-config source type. */
export type EffectiveConfigSource =
  (typeof EFFECTIVE_CONFIG_SOURCES)[keyof typeof EFFECTIVE_CONFIG_SOURCES]

/** Every source value, for membership checks. */
export const EFFECTIVE_CONFIG_SOURCE_VALUES: readonly string[] = Object.values(
  EFFECTIVE_CONFIG_SOURCES,
)

/** Is `value` one of the frozen effective-config sources? */
export function isEffectiveConfigSource(value: unknown): value is EffectiveConfigSource {
  return typeof value === 'string' && EFFECTIVE_CONFIG_SOURCE_VALUES.includes(value)
}

/**
 * Parse an effective-config source field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen source.
 */
export function parseEffectiveConfigSourceField(raw: unknown, field: string): EffectiveConfigSource {
  if (!isEffectiveConfigSource(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${EFFECTIVE_CONFIG_SOURCE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}

// --- state vocabulary (UI §18.3) ----------------------------------------------------

/** The frozen states of an effective configuration value (UI §18.3). */
export const EFFECTIVE_CONFIG_STATES = {
  /** The value flows from the inherited source unmodified. */
  inherited: 'inherited',
  /** The value was overridden by a closer source. */
  overridden: 'overridden',
  /** The value is suppressed (hidden from the effective set). */
  suppressed: 'suppressed',
  /** The value is currently unavailable (source not resolvable). */
  unavailable: 'unavailable',
  /** The value is denied by a winning policy factor. */
  denied: 'denied',
  /** The value is locked (e.g. the workspace after first run). */
  locked: 'locked',
  /** The change is accepted but applies at the next boundary. */
  pending_next_boundary: 'pending-next-boundary',
  /** The value is degraded (operating with reduced capability). */
  degraded: 'degraded',
} as const

/** The frozen effective-config state type. */
export type EffectiveConfigState =
  (typeof EFFECTIVE_CONFIG_STATES)[keyof typeof EFFECTIVE_CONFIG_STATES]

/** Every state value, for membership checks. */
export const EFFECTIVE_CONFIG_STATE_VALUES: readonly string[] = Object.values(
  EFFECTIVE_CONFIG_STATES,
)

/** Is `value` one of the frozen effective-config states? */
export function isEffectiveConfigState(value: unknown): value is EffectiveConfigState {
  return typeof value === 'string' && EFFECTIVE_CONFIG_STATE_VALUES.includes(value)
}

/**
 * Parse an effective-config state field from an untrusted value.
 * @throws `MALFORMED_DTO` when the value is not a frozen state.
 */
export function parseEffectiveConfigStateField(raw: unknown, field: string): EffectiveConfigState {
  if (!isEffectiveConfigState(raw)) {
    throw teamContractError(
      'MALFORMED_DTO',
      `${field} must be one of ${EFFECTIVE_CONFIG_STATE_VALUES.join(' | ')}, got ${JSON.stringify(raw)}`,
      { field },
    )
  }
  return raw
}

// --- entry -------------------------------------------------------------------------

/** The exact frozen fields of an EffectiveConfigEntry. */
export const EFFECTIVE_CONFIG_ENTRY_FIELDS: readonly string[] = ['value', 'source', 'state']

/**
 * The exact frozen fields of an EffectiveConfigEntry under projection v2
 * (S7-R2, repair R2-2): the v1 core plus the ADDITIVE optional
 * provenance fields (UI §18.1: `suppressed?`, `unavailable?`, `deniedBy?`,
 * "when change takes effect" = `effectiveFrom`, plus `locked?`). Every
 * additive field is DURATIONAL-optional: the KEY is absent when the fact
 * does not hold (never an own `undefined` key). v1 records remain valid
 * through the v1 field set above.
 */
export const EFFECTIVE_CONFIG_ENTRY_FIELDS_V2: readonly string[] = [
  'value',
  'source',
  'state',
  'suppressed',
  'unavailable',
  'deniedBy',
  'effectiveFrom',
  'locked',
]

/** Max length of the v2 `deniedBy` provenance string (opaque reason). */
export const EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH = 128

/**
 * One resolved effective configuration value with its provenance.
 */
export interface EffectiveConfigEntry {
  /**
   * The resolved display value, or `null` when the factor produced no value
   * (required key — never absent: absence is reserved for the DURATIONAL
   * optional fields of the enclosing records).
   */
  readonly value: string | null
  /** The frozen source that produced the value (or the denial). */
  readonly source: EffectiveConfigSource
  /** The frozen state of the value (UI §18.3). */
  readonly state: EffectiveConfigState
}

/**
 * The projection v2 effective-config entry (S7-R2, repair R2-2): the v1
 * core plus the additive optional provenance fields. A v2 entry is
 * structurally a supertype of the v1 entry (every v1 consumer reading
 * `value` / `source` / `state` keeps working).
 */
export interface EffectiveConfigEntryV2 {
  /** The resolved display value (v1 semantics). */
  readonly value: string | null
  /** The frozen source that produced the value (or the denial). */
  readonly source: EffectiveConfigSource
  /** The frozen state of the value (UI §18.3). */
  readonly state: EffectiveConfigState
  /**
   * A stored autonomy overlay is currently SUPPRESSED for this cell
   * (§19.4 non-destructive: stored but hidden from the effective set).
   * Key absent when nothing is suppressed.
   */
  readonly suppressed?: boolean
  /**
   * The value is currently unavailable (capability absent or unusable).
   * Key absent when available.
   */
  readonly unavailable?: boolean
  /**
   * Who/what denied the value: the frozen denial reason (opaque
   * lossless-JSON string, ≤ 128 chars, no control characters). Key
   * absent when the value is not denied.
   */
  readonly deniedBy?: string
  /**
   * The step boundary at which a pending change takes effect
   * (UI §18.1 "when change takes effect"): a positive safe integer.
   * Key absent when the value is not pending or when the pending
   * change is boundary-based without a step (documented per producer).
   */
  readonly effectiveFrom?: number
  /**
   * The value is locked (e.g. the workspace after first run, W2). Key
   * absent when not locked.
   */
  readonly locked?: boolean
}

/**
 * Parse and validate an EffectiveConfigEntry from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen entry.
 * @throws `MALFORMED_DTO` for a malformed container, field set, or value.
 */
export function parseEffectiveConfigEntry(
  value: unknown,
  schemaVersion: 1 | 2 = 1,
): EffectiveConfigEntry | EffectiveConfigEntryV2 {
  const record = assertPlainRecord(value, 'EffectiveConfigEntry')
  if (schemaVersion === 2) {
    assertNoUnknownFields(record, EFFECTIVE_CONFIG_ENTRY_FIELDS_V2, 'EffectiveConfigEntry')
    for (const field of EFFECTIVE_CONFIG_ENTRY_FIELDS) {
      assertFieldPresent(record, field, 'EffectiveConfigEntry')
    }
  } else {
    // v1 path — byte-identical frozen behavior (P8-T1).
    assertNoUnknownFields(record, EFFECTIVE_CONFIG_ENTRY_FIELDS, 'EffectiveConfigEntry')
    for (const field of EFFECTIVE_CONFIG_ENTRY_FIELDS) {
      assertFieldPresent(record, field, 'EffectiveConfigEntry')
    }
  }
  const rawValue = record['value']
  let parsedValue: string | null
  if (rawValue === null) {
    parsedValue = null
  } else {
    if (
      typeof rawValue !== 'string' ||
      rawValue.length === 0 ||
      rawValue.length > EFFECTIVE_CONFIG_VALUE_MAX_LENGTH ||
      hasControlChars(rawValue)
    ) {
      throw teamContractError(
        'MALFORMED_DTO',
        `EffectiveConfigEntry value must be null or a non-empty string of at most ${EFFECTIVE_CONFIG_VALUE_MAX_LENGTH} chars without control characters`,
        { field: 'value' },
      )
    }
    parsedValue = rawValue
  }
  const core = {
    value: parsedValue,
    source: parseEffectiveConfigSourceField(record['source'], 'source'),
    state: parseEffectiveConfigStateField(record['state'], 'state'),
  }
  if (schemaVersion === 2) {
    // The additive v2 provenance fields (all DURATIONAL-optional).
    let suppressed: boolean | undefined
    if (record['suppressed'] !== undefined) {
      if (typeof record['suppressed'] !== 'boolean') {
        throw teamContractError(
          'MALFORMED_DTO',
          'EffectiveConfigEntry suppressed must be a boolean',
          { field: 'suppressed' },
        )
      }
      suppressed = record['suppressed'] as boolean
    }
    let unavailable: boolean | undefined
    if (record['unavailable'] !== undefined) {
      if (typeof record['unavailable'] !== 'boolean') {
        throw teamContractError(
          'MALFORMED_DTO',
          'EffectiveConfigEntry unavailable must be a boolean',
          { field: 'unavailable' },
        )
      }
      unavailable = record['unavailable'] as boolean
    }
    let deniedBy: string | undefined
    if (record['deniedBy'] !== undefined) {
      const rawDeniedBy = record['deniedBy']
      if (
        typeof rawDeniedBy !== 'string' ||
        rawDeniedBy.length === 0 ||
        rawDeniedBy.length > EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH ||
        hasControlChars(rawDeniedBy)
      ) {
        throw teamContractError(
          'MALFORMED_DTO',
          `EffectiveConfigEntry deniedBy must be a non-empty string of at most ${EFFECTIVE_CONFIG_DENIED_BY_MAX_LENGTH} chars without control characters`,
          { field: 'deniedBy' },
        )
      }
      deniedBy = rawDeniedBy
    }
    let effectiveFrom: number | undefined
    if (record['effectiveFrom'] !== undefined) {
      const rawEffectiveFrom = record['effectiveFrom']
      if (
        typeof rawEffectiveFrom !== 'number' ||
        !Number.isSafeInteger(rawEffectiveFrom) ||
        rawEffectiveFrom < 1
      ) {
        throw teamContractError(
          'MALFORMED_DTO',
          'EffectiveConfigEntry effectiveFrom must be a safe integer >= 1',
          { field: 'effectiveFrom' },
        )
      }
      effectiveFrom = rawEffectiveFrom
    }
    let locked: boolean | undefined
    if (record['locked'] !== undefined) {
      if (typeof record['locked'] !== 'boolean') {
        throw teamContractError(
          'MALFORMED_DTO',
          'EffectiveConfigEntry locked must be a boolean',
          { field: 'locked' },
        )
      }
      locked = record['locked'] as boolean
    }
    return deepFreeze({
      ...core,
      ...(suppressed !== undefined ? { suppressed } : {}),
      ...(unavailable !== undefined ? { unavailable } : {}),
      ...(deniedBy !== undefined ? { deniedBy } : {}),
      ...(effectiveFrom !== undefined ? { effectiveFrom } : {}),
      ...(locked !== undefined ? { locked } : {}),
    })
  }
  return deepFreeze(core)
}

// --- the four-lane container ----------------------------------------------------------

/** The exact frozen lanes of an EffectiveConfigDto (UI §18.2 example). */
export const EFFECTIVE_CONFIG_FIELDS: readonly string[] = [
  'model',
  'workspace',
  'permissions',
  'autonomy',
]

/**
 * The per-member effective configuration view: the four frozen lanes.
 * `permissions` maps validated permission names to entries (the map may be
 * empty).
 */
export interface EffectiveConfigDto {
  /** The effective model selection. */
  readonly model: EffectiveConfigEntry
  /** The effective workspace (locked after first run: state `locked`). */
  readonly workspace: EffectiveConfigEntry
  /** Permission name -> effective entry. */
  readonly permissions: { readonly [permissionName: string]: EffectiveConfigEntry }
  /** The effective autonomy overlay. */
  readonly autonomy: EffectiveConfigEntry
}

/**
 * The projection v2 four-lane effective config (S7-R2, repair R2-2): the
 * same frozen lanes as v1, with v2 entries (additive optional provenance
 * fields). Structurally a supertype of the v1 DTO.
 */
export interface EffectiveConfigDtoV2 {
  /** The effective model selection. */
  readonly model: EffectiveConfigEntryV2
  /** The effective workspace (locked after first run: state `locked`). */
  readonly workspace: EffectiveConfigEntryV2
  /** Permission name -> effective entry. */
  readonly permissions: { readonly [permissionName: string]: EffectiveConfigEntryV2 }
  /** The effective autonomy overlay. */
  readonly autonomy: EffectiveConfigEntryV2
}

/**
 * Parse and validate an EffectiveConfigDto from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen effective config.
 * @throws `MALFORMED_DTO` for a malformed container, lane set, permission
 *   key, or entry.
 */
export function parseEffectiveConfigDto(
  value: unknown,
  schemaVersion: 1 | 2 = 1,
): EffectiveConfigDto | EffectiveConfigDtoV2 {
  const record = assertPlainRecord(value, 'EffectiveConfig')
  assertNoUnknownFields(record, EFFECTIVE_CONFIG_FIELDS, 'EffectiveConfig')
  for (const field of EFFECTIVE_CONFIG_FIELDS) {
    assertFieldPresent(record, field, 'EffectiveConfig')
  }
  const permissionsRecord = assertPlainRecord(record['permissions'], 'EffectiveConfig.permissions')
  const permissions: {
    [permissionName: string]: EffectiveConfigEntry | EffectiveConfigEntryV2
  } = {}
  for (const name of Object.keys(permissionsRecord)) {
    parseLabelLikeField(name, `permissions['${name}']`, LABEL_MAX_LENGTH)
    permissions[name] = parseEffectiveConfigEntry(permissionsRecord[name], schemaVersion)
  }
  return deepFreeze({
    model: parseEffectiveConfigEntry(record['model'], schemaVersion),
    workspace: parseEffectiveConfigEntry(record['workspace'], schemaVersion),
    permissions,
    autonomy: parseEffectiveConfigEntry(record['autonomy'], schemaVersion),
  })
}
