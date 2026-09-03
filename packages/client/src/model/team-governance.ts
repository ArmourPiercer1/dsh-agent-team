/**
 * P9-T8 (S5-C) — pure model for the config/governance command flows
 * (plan P9-S5 S5-C + Gate P9-G5; UI doc §10/§18/§19/§21):
 *
 * - the closed re-probe trigger set (the five frozen DevPlan §20.1
 *   triggers — the ONLY wire-legal `compatibility.reprobe` inputs);
 * - the compatibility badge mapping (the four frozen AdmissionStates →
 *   UI §10.2 marks) and the two wire-value parsers for the TWO distinct
 *   compatibility shapes on the frozen contract v1 wire: the durable
 *   `compatibility.get` state (aggregate `counts` block) and the
 *   re-derived verdict (`compatibility.ack` / `compatibility.reprobe`
 *   results, flat counters; the reprobe verdict carries the trigger);
 * - the frozen Remote param builders (`override.get/set/reset`,
 *   `policyState.get/set`, `compatibility.get/ack/reprobe`) — the
 *   human actor convention `{ kind: 'human' }`;
 * - the policy-state display mapping (state id shown verbatim — the
 *   state id is an open blueprint-defined vocabulary; cell rows for the
 *   `policyState.get` view) and the §19 hard-policy display rule
 *   (never pretend an override beats a hard policy);
 * - the per-member effective-config lane rows (UI §18.1/§18.3: value /
 *   effective state / source / v2 additive flags, the DISTINCT state
 *   words — never unified "Disabled").
 *
 * G5 outcome parsing: the typed-outcome parser is the shared
 * `parseMemberCommandOutcome` (team-member-commands) — the remote typed
 * result is preserved verbatim (`code`, `message`, the `requestToken`
 * echo), never exception-ified, and no optimistic authority patch is
 * ever applied. This module adds no second parser.
 *
 * Wire gap (recorded divergence, frozen contract v1): `compatibility.ack`
 * requires a `requirementId`, but the frozen `compatibility.get` exposes
 * AGGREGATE counts only — the durable per-requirement rows are not on
 * the wire and there is no compatibility fact in the ledger. The ack
 * param builder + parser are implemented and tested here; the UI renders
 * the ack control DISABLED with the explicit reason (UI §38: no grey
 * button without a reason).
 *
 * Pure module: no React, no I/O, no crypto. Erasable TS only.
 * @module @dsh-agent-team/client/model/team-governance
 */

import {
  ADMISSION_STATES,
  EFFECTIVE_CONFIG_STATES,
  type AdmissionState,
  type EffectiveConfigEntryV2,
  type EffectiveConfigState,
} from '../../../contracts/src/index.js'
import {
  REMOTE_PROBE_TRIGGER_VALUES,
  type RemoteProbeTrigger,
  type RemoteCapability,
  type RemoteCompatibilityAckParams,
  type RemoteCompatibilityGetParams,
  type RemoteCompatibilityReprobeParams,
  type RemoteLosslessRecord,
  type RemoteMutationScope,
  type RemoteOverrideGetParams,
  type RemoteOverrideResetParams,
  type RemoteOverrideSetParams,
  type RemotePolicyEntry,
  type RemotePolicyStateGetParams,
  type RemotePolicyStateSetParams,
  type RemotePolicyStateViewValue,
  type RemoteSafeRecord,
} from '../../../remote/src/index.js'

// --- the closed re-probe trigger set (DevPlan §20.1) --------------------------

/** The five frozen re-probe triggers (wire-legal closed set; the frozen
 * `REMOTE_PROBE_TRIGGER_VALUES` vocabulary, re-exported under the local
 * name for the S5-C surface). */
export const GOVERNANCE_REPROBE_TRIGGERS: readonly RemoteProbeTrigger[] =
  REMOTE_PROBE_TRIGGER_VALUES

/** One wire-legal re-probe trigger. */
export type GovernanceReprobeTrigger = RemoteProbeTrigger

/** Closed-set membership test for a re-probe trigger. */
export function isReprobeTrigger(
  value: unknown,
): value is GovernanceReprobeTrigger {
  return (
    typeof value === 'string' &&
    (GOVERNANCE_REPROBE_TRIGGERS as readonly string[]).includes(value)
  )
}

/**
 * The human "Recheck" (§10.4: the user repaired the environment and asks
 * for a new generation) mapped to the closed trigger vocabulary: a
 * repaired environment is a capability-topology change, which is
 * `CAPABILITY_GENERATION_CHANGE`. The other four triggers are
 * lifecycle-driven and never human-initiated on this surface.
 */
export const HUMAN_RECHECK_TRIGGER: GovernanceReprobeTrigger =
  'CAPABILITY_GENERATION_CHANGE'

// --- the compatibility badge (UI §10.2) ---------------------------------------

/** The badge mark per frozen AdmissionState. */
export type CompatibilityBadgeMark = 'pass' | 'warning' | 'fatal'

/** The frozen AdmissionState → badge mark map (UI §10.2 semantics). */
export const COMPATIBILITY_BADGE_MARKS: Record<AdmissionState, CompatibilityBadgeMark> = {
  [ADMISSION_STATES.OPEN]: 'pass',
  [ADMISSION_STATES.DEGRADED_ACKNOWLEDGED]: 'warning',
  [ADMISSION_STATES.BLOCKED_WARNING]: 'warning',
  [ADMISSION_STATES.BLOCKED_FATAL]: 'fatal',
}

/** The resolved badge for a frozen status (null when the status is not one of the four). */
export interface CompatibilityBadge {
  readonly state: AdmissionState
  readonly mark: CompatibilityBadgeMark
}

/**
 * Resolve the UI §10.2 badge for a status string (the rendered status is
 * ALWAYS the projection's `snapshot.compatibility.status` — G5(d); this
 * only maps it to a mark).
 * @param status - the admission status string.
 * @returns the badge, or `null` when the string is outside the frozen
 *   four-state vocabulary (the UI then renders the raw status verbatim).
 */
export function compatibilityBadge(status: string): CompatibilityBadge | null {
  for (const state of Object.values(ADMISSION_STATES)) {
    if (state === status) {
      return { state, mark: COMPATIBILITY_BADGE_MARKS[state] }
    }
  }
  return null
}

// --- the two compatibility wire shapes ----------------------------------------

/**
 * The `compatibility.get` durable-state wire value (aggregate ONLY —
 * the production handler `compatibilityCurrentOf`; the per-requirement
 * rows are NOT exposed on contract v1).
 */
export interface CompatibilityStateWire {
  readonly status: string
  readonly generation: number
  readonly environmentFingerprint: string
  readonly recordedAt: string
  readonly pass: number
  readonly warning: number
  readonly fatal: number
  readonly unackedWarning: number
  readonly staleAcknowledgement: number
}

/**
 * The re-derived verdict wire value (`compatibility.ack` /
 * `compatibility.reprobe` results): flat counters; the reprobe verdict
 * carries the producing trigger, the ack verdict does not.
 */
export interface CompatibilityVerdictWire extends CompatibilityStateWire {
  /** `staleAcknowledgement` is absent from the verdict shape. */
  readonly trigger: string | null
}

function asRecord(value: unknown, label: string): RemoteSafeRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`GOVERNANCE_MALFORMED: ${label} must be an object`)
  }
  return value as RemoteSafeRecord
}

function requireString(
  value: RemoteSafeRecord,
  field: string,
): string {
  const raw = value[field]
  if (typeof raw !== 'string') {
    throw new Error(`GOVERNANCE_MALFORMED: ${field} must be a string`)
  }
  return raw
}

function requireInt(value: RemoteSafeRecord, field: string): number {
  const raw = value[field]
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) {
    throw new Error(`GOVERNANCE_MALFORMED: ${field} must be a safe integer`)
  }
  return raw
}

function parseCounts(value: RemoteSafeRecord): {
  pass: number
  warning: number
  fatal: number
  unackedWarning: number
  staleAcknowledgement: number
} {
  const raw = value['counts']
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('GOVERNANCE_MALFORMED: counts must be an object')
  }
  const counts = raw as RemoteSafeRecord
  const counter = (key: string): number => {
    const cell = counts[key]
    if (typeof cell !== 'number' || !Number.isSafeInteger(cell)) {
      throw new Error(`GOVERNANCE_MALFORMED: counts.${key} must be a safe integer`)
    }
    return cell
  }
  return {
    pass: counter('pass'),
    warning: counter('warning'),
    fatal: counter('fatal'),
    unackedWarning: counter('unackedWarning'),
    staleAcknowledgement: counter('staleAcknowledgement'),
  }
}

/**
 * Parse the `compatibility.get` success value (the durable aggregate
 * state). Throws `Error` with a stable `GOVERNANCE_MALFORMED:` prefix on
 * a structurally malformed value (the UI renders the message verbatim
 * as a local channel note — never a typed Remote error).
 */
export function parseCompatibilityStateValue(
  value: unknown,
): CompatibilityStateWire {
  const record = asRecord(value, 'value')
  const counts = parseCounts(record)
  return {
    status: requireString(record, 'status'),
    generation: requireInt(record, 'generation'),
    environmentFingerprint: requireString(record, 'environmentFingerprint'),
    recordedAt: requireString(record, 'recordedAt'),
    ...counts,
  }
}

/**
 * Parse the `compatibility.ack` / `compatibility.reprobe` success value
 * (the re-derived verdict; flat counters, optional trigger).
 */
export function parseCompatibilityVerdictValue(
  value: unknown,
): CompatibilityVerdictWire {
  const record = asRecord(value, 'value')
  const triggerRaw = record['trigger']
  return {
    status: requireString(record, 'status'),
    generation: requireInt(record, 'generation'),
    environmentFingerprint: requireString(record, 'environmentFingerprint'),
    recordedAt: requireString(record, 'recordedAt'),
    pass: requireInt(record, 'pass'),
    warning: requireInt(record, 'warning'),
    fatal: requireInt(record, 'fatal'),
    unackedWarning: requireInt(record, 'unackedWarning'),
    staleAcknowledgement: 0,
    trigger: typeof triggerRaw === 'string' ? triggerRaw : null,
  }
}

// --- the frozen Remote param builders (S5-C) ----------------------------------

/**
 * Build the `override.get` params (read: the Explicit Human Override
 * record of one capability at one scope; `scope`/`targetInstanceId`
 * travel together — target present iff scope is `'instance'`).
 */
export function overrideGetParams(
  teamSessionId: string,
  capability: RemoteCapability,
  scope?: RemoteMutationScope,
  targetInstanceId?: string,
): RemoteOverrideGetParams {
  return {
    teamSessionId,
    capability,
    ...(scope !== undefined ? { scope } : {}),
    ...(scope !== undefined && targetInstanceId !== undefined
      ? { targetInstanceId }
      : {}),
  }
}

/**
 * Build the `override.set` params (the §19 override editor: it edits
 * ONLY the Explicit Human Override layer — never the Blueprint).
 */
export function overrideSetParams(
  teamSessionId: string,
  capability: RemoteCapability,
  value: RemotePolicyEntry,
  scope?: RemoteMutationScope,
  targetInstanceId?: string,
): RemoteOverrideSetParams {
  return {
    teamSessionId,
    capability,
    value,
    actor: { kind: 'human' },
    ...(scope !== undefined ? { scope } : {}),
    ...(scope !== undefined && targetInstanceId !== undefined
      ? { targetInstanceId }
      : {}),
  }
}

/** Build the `override.reset` params (removes the override; the value is recomputed from the lower layers). */
export function overrideResetParams(
  teamSessionId: string,
  capability: RemoteCapability,
  scope?: RemoteMutationScope,
  targetInstanceId?: string,
): RemoteOverrideResetParams {
  return {
    teamSessionId,
    capability,
    actor: { kind: 'human' },
    ...(scope !== undefined ? { scope } : {}),
    ...(scope !== undefined && targetInstanceId !== undefined
      ? { targetInstanceId }
      : {}),
  }
}

/** Build the `policyState.get` params. */
export function policyStateGetParams(
  teamSessionId: string,
): RemotePolicyStateGetParams {
  return { teamSessionId }
}

/**
 * Build the `policyState.set` params. The target is the frozen
 * `PolicyStateView` mirror: the current `stateId` (from the projection —
 * never invented locally) plus the cell map to commit.
 */
export function policyStateSetParams(
  teamSessionId: string,
  stateId: string,
  cells?: Readonly<Partial<Record<RemoteCapability, {
    readonly locked?: boolean
    readonly value?: RemotePolicyEntry
  }>>>,
): RemotePolicyStateSetParams {
  // The frozen param schema accepts a PARTIAL cell map (provided keys are
  // validated against the closed capability set); the TS mirror over-
  // constrains `cells` to the full record, so the cast carries the wire truth.
  const target: RemotePolicyStateViewValue = cells !== undefined
    ? ({ stateId, cells: { ...cells } } as RemotePolicyStateViewValue)
    : { stateId }
  return { teamSessionId, target, actor: { kind: 'human' } }
}

/** Build the `compatibility.get` params. */
export function compatibilityGetParams(
  teamSessionId: string,
): RemoteCompatibilityGetParams {
  return { teamSessionId }
}

/**
 * Build the `compatibility.ack` params. NOTE (wire gap): the frozen
 * `compatibility.get` exposes aggregate counts only, so the UI cannot
 * currently enumerate a `requirementId` to ack — the builder is complete
 * and tested; the UI renders the ack control disabled with the explicit
 * reason until the wire exposes the per-requirement rows.
 */
export function compatibilityAckParams(
  teamSessionId: string,
  requirementId: string,
  acknowledgedBy: string,
  note?: string,
): RemoteCompatibilityAckParams {
  return {
    teamSessionId,
    requirementId,
    acknowledgedBy,
    ...(note !== undefined ? { note } : {}),
  }
}

/**
 * Build the `compatibility.reprobe` params. The trigger MUST be one of
 * the five frozen values (closed set — anything else throws before a
 * wire round-trip is spent).
 */
export function compatibilityReprobeParams(
  teamSessionId: string,
  trigger: string,
): RemoteCompatibilityReprobeParams {
  if (!isReprobeTrigger(trigger)) {
    throw new Error(
      `GOVERNANCE_MALFORMED: compatibility.reprobe trigger '${trigger}' is outside the frozen closed set`,
    )
  }
  return { teamSessionId, trigger }
}

// --- the override value --------------------------------------------------------

/** The `override.get` success value (null = no override recorded). */
export interface OverrideWire {
  readonly override: RemoteLosslessRecord | null
}

/** Parse the `override.get` success value. */
export function parseOverrideValue(value: unknown): OverrideWire {
  const record = asRecord(value, 'value')
  const raw = record['override']
  if (raw === null) return { override: null }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('GOVERNANCE_MALFORMED: override must be an object or null')
  }
  return { override: raw as RemoteLosslessRecord }
}

// --- the policy state (UI §21) ---------------------------------------------------

/**
 * The `policyState.get` cell wire row (one closed capability).
 */
export interface PolicyStateCellWire {
  readonly capability: RemoteCapability
  readonly locked: boolean
  /** The committed entry (`null` = the cell carries no value). */
  readonly entry: RemotePolicyEntry | null
}

/** The `policyState.get` view wire (state id + cells, sorted by capability). */
export interface PolicyStateViewWire {
  readonly stateId: string
  readonly cells: readonly PolicyStateCellWire[]
}

/**
 * Parse the `policyState.get` success value (the frozen `PolicyStateView`
 * mirror: `stateId` + optional `cells` keyed by closed capability).
 */
export function parsePolicyStateValue(value: unknown): PolicyStateViewWire {
  const record = asRecord(value, 'value')
  const stateId = requireString(record, 'stateId')
  const rawCells = record['cells']
  const cells: PolicyStateCellWire[] = []
  if (rawCells !== undefined) {
    if (typeof rawCells !== 'object' || rawCells === null || Array.isArray(rawCells)) {
      throw new Error('GOVERNANCE_MALFORMED: cells must be an object')
    }
    const cellsRecord = rawCells as RemoteSafeRecord
    for (const capability of Object.keys(cellsRecord).sort()) {
      const cell = cellsRecord[capability]
      if (typeof cell !== 'object' || cell === null || Array.isArray(cell)) {
        throw new Error(
          `GOVERNANCE_MALFORMED: cells['${capability}'] must be an object`,
        )
      }
      const cellRecord = cell as RemoteSafeRecord
      const locked = cellRecord['locked'] === true
      const entryRaw = cellRecord['value']
      let entry: RemotePolicyEntry | null = null
      if (entryRaw !== undefined) {
        if (
          typeof entryRaw !== 'object' ||
          entryRaw === null ||
          Array.isArray(entryRaw)
        ) {
          throw new Error(
            `GOVERNANCE_MALFORMED: cells['${capability}'].value must be an object`,
          )
        }
        const entryRecord = entryRaw as RemoteSafeRecord
        const kind = entryRecord['kind']
        if (kind === 'deny') {
          entry = { kind: 'deny' }
        } else if (kind === 'allow') {
          const itemsRaw = entryRecord['items']
          if (!Array.isArray(itemsRaw) || !itemsRaw.every((i) => typeof i === 'string')) {
            throw new Error(
              `GOVERNANCE_MALFORMED: cells['${capability}'].value.items must be a string array`,
            )
          }
          entry = { kind: 'allow', items: itemsRaw as string[] }
        } else {
          throw new Error(
            `GOVERNANCE_MALFORMED: cells['${capability}'].value.kind must be 'allow' or 'deny'`,
          )
        }
      }
      cells.push({ capability: capability as RemoteCapability, locked, entry })
    }
  }
  return { stateId, cells }
}

/**
 * The §21 policy-state display mapping. State ids are blueprint-defined
 * OPEN vocabulary (no closed list on the wire), so the display shows the
 * id verbatim — no case transformation or invented alias (the UI §21
 * `Policy [ Exploration ▾ ]` header renders the current state id from
 * the projection).
 */
export function policyStateLabel(stateId: string): string {
  return stateId
}

// --- the effective config lanes (UI §18) ----------------------------------------

/** The §18.3 DISTINCT state words (never unified "Disabled"). */
export const EFFECTIVE_CONFIG_STATE_WORDS: Record<EffectiveConfigState, string> = {
  [EFFECTIVE_CONFIG_STATES.inherited]: 'Inherited',
  [EFFECTIVE_CONFIG_STATES.overridden]: 'Overridden',
  [EFFECTIVE_CONFIG_STATES.suppressed]: 'Suppressed',
  [EFFECTIVE_CONFIG_STATES.unavailable]: 'Unavailable',
  [EFFECTIVE_CONFIG_STATES.denied]: 'Denied',
  [EFFECTIVE_CONFIG_STATES.locked]: 'Locked',
  [EFFECTIVE_CONFIG_STATES.pending_next_boundary]: 'Pending next boundary',
  [EFFECTIVE_CONFIG_STATES.degraded]: 'Degraded',
}

/**
 * One effective-config lane row (UI §18.1: value / effective state /
 * source-provenance / suppressed? / unavailable? / deniedBy? / when the
 * change takes effect — `effectiveFrom`).
 */
export interface EffectiveConfigLaneRow {
  /** `'model' | 'workspace' | 'permissions:<name>' | 'autonomy'`. */
  readonly lane: string
  readonly value: string | null
  readonly source: string
  readonly state: EffectiveConfigState
  readonly stateWord: string
  readonly suppressed: boolean | null
  readonly unavailable: boolean | null
  readonly deniedBy: string | null
  /** The effect boundary (projection step), v2 additive. */
  readonly effectiveFrom: number | null
  readonly locked: boolean | null
}

function laneRow(lane: string, entry: EffectiveConfigEntryV2): EffectiveConfigLaneRow {
  return {
    lane,
    value: entry.value,
    source: entry.source,
    state: entry.state,
    stateWord: EFFECTIVE_CONFIG_STATE_WORDS[entry.state] ?? entry.state,
    suppressed: entry.suppressed ?? null,
    unavailable: entry.unavailable ?? null,
    deniedBy: entry.deniedBy ?? null,
    effectiveFrom: entry.effectiveFrom ?? null,
    locked: entry.locked ?? null,
  }
}

/** The four-lane effective-config container (v1 or v2 entries). */
export interface EffectiveConfigLanesInput {
  readonly model: EffectiveConfigEntryV2
  readonly workspace: EffectiveConfigEntryV2
  readonly permissions: Readonly<Record<string, EffectiveConfigEntryV2>>
  readonly autonomy: EffectiveConfigEntryV2
}

/**
 * Flatten one member's effective config (v1 or v2 DTO — v1 entries are
 * structural subsets of v2) into the lane rows: `model`, `workspace`,
 * the sorted `permissions` entries, `autonomy` (UI §18.2 order).
 */
export function effectiveConfigLanes(dto: EffectiveConfigLanesInput): EffectiveConfigLaneRow[] {
  const rows: EffectiveConfigLaneRow[] = [
    laneRow('model', dto.model),
    laneRow('workspace', dto.workspace),
  ]
  for (const name of Object.keys(dto.permissions).sort()) {
    const entry = dto.permissions[name]
    if (entry !== undefined) {
      rows.push(laneRow(`permissions:${name}`, entry))
    }
  }
  rows.push(laneRow('autonomy', dto.autonomy))
  return rows
}

/** The §19 hard-policy display (never pretend an override beats a hard policy). */
export interface HardPolicyDisplay {
  readonly requested: string
  readonly effective: string
  readonly reason: string
}

/**
 * The §19 hard-policy display for a denied lane: `Requested: <value> /
 * Effective: Denied / Reason: <deniedBy>`. `null` for every non-denied
 * lane (an override is never shown as if it beat the policy).
 */
export function hardPolicyDisplay(
  row: EffectiveConfigLaneRow,
): HardPolicyDisplay | null {
  if (row.state !== EFFECTIVE_CONFIG_STATES.denied || row.deniedBy === null) {
    return null
  }
  return {
    requested: row.value ?? '(no value)',
    effective: 'Denied',
    reason: row.deniedBy,
  }
}
