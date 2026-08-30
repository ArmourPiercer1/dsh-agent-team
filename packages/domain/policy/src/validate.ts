/**
 * Strict structural validation of policy resolver inputs (P3-T4).
 *
 * The resolver consumes plain data structures (no runtime guards upstream
 * in the pure domain), so every input is validated at the boundary, the
 * same way the contracts v1 DTOs are (closed record discipline):
 *
 * - identity: `teamSessionId` must be a valid TeamSessionId
 *   (`parseTeamSessionId`); `member.rootSessionId` / `member.instanceId`
 *   must be valid ids and `member` must belong to the TeamSession
 *   (`assertMemberIdentityInTeam`, invariant 18) — both from the local
 *   contracts-v1 mirror (./contracts-mirror.js, see its module doc for why
 *   the package does not import contracts sources directly).
 * - capability keys: every map key must be one of the CLOSED
 *   {@link CAPABILITY_NAME_VALUES} (unknown keys →
 *   `MALFORMED_POLICY_INPUT`, never silently ignored);
 * - entries: a `PolicyEntry` is exactly `{kind:'deny'}` or
 *   `{kind:'allow', items:[...1..n unique non-empty strings]}` — an empty
 *   allow-list is malformed (use `deny`), duplicates are malformed;
 * - overlay/override/state/external records: exact field shapes.
 *
 * Identity-boundary violations fail as the policy's own
 * `PolicyResolutionError`: malformed ids → `MALFORMED_POLICY_INPUT`,
 * cross-scope member identity → `IDENTITY_SCOPE_MISMATCH` (the contracts
 * v1 code string) — thrown by the mirror, propagated here unwrapped.
 *
 * The validation also precomputes the per-cell TEAM AUTONOMY ENVELOPE:
 * the intersection of the blueprint `autonomyEnvelope` and the template
 * `mutationEnvelope` (Architecture §19.3, jointly with the PolicyState
 * envelope which gates at resolve time). An absent/deny entry contributes
 * an EMPTY set: the Team domain fails closed for agent overlays.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 * @module @dsh-agent-team/domain/policy/validate
 */

import {
  parseInstanceId,
  parseRootSessionId,
  parseTeamSessionId,
  assertMemberIdentityInTeam,
} from './contracts-mirror.js'
import {
  CAPABILITY_NAME_VALUES,
} from './types.js'
import {
  POLICY_ERROR_CODES,
} from './errors.js'
import type {
  AutonomyOverlayRecord,
  CapabilityName,
  EffectivePolicyInput,
  HumanOverrideRecord,
  PolicyEntry,
  PolicyStateCellView,
  PolicyStateView,
} from './types.js'
import { PolicyResolutionError } from './errors.js'

/** Internal validation result: the per-cell Team autonomy envelope sets. */
export interface ValidatedPolicyInput {
  /**
   * The per-cell Team autonomy envelope item set:
   * `blueprint.autonomyEnvelope[c] ∩ template.mutationEnvelope[c]`
   * (absent/deny → ∅). Only used for overlay admission; never leaves the
   * resolver (internal state, not part of the output).
   */
  readonly envelopeItems: ReadonlyMap<CapabilityName, ReadonlySet<string>>
}

/**
 * Validate a complete resolver input.
 *
 * @param input - the pure resolver input to validate.
 * @returns the precomputed envelope (internal).
 * @throws `PolicyResolutionError` (`MALFORMED_POLICY_INPUT`) for
 *   malformed ids or any structural policy violation, or
 *   (`IDENTITY_SCOPE_MISMATCH`) for a cross-scope member identity.
 */
export function validatePolicyInput(input: EffectivePolicyInput): ValidatedPolicyInput {
  const teamSessionId = parseTeamSessionId(input.teamSessionId)
  parseRootSessionId(input.member.rootSessionId)
  parseInstanceId(input.member.instanceId)
  assertMemberIdentityInTeam(input.member, teamSessionId)

  const state = input.policyState
  if (
    typeof state.stateId !== 'string' ||
    state.stateId.length === 0 ||
    hasForbiddenIdChars(state.stateId)
  ) {
    throw malformed(
      'policyState.stateId',
      'must be a non-empty id-like string (no whitespace/control characters)',
    )
  }
  const stateCells = parseStateCellMap(state.cells, 'policyState.cells')

  parsePolicyMap(input.blueprint.values, 'blueprint.values')
  const blueprintEnvelope = parsePolicyMap(input.blueprint.autonomyEnvelope, 'blueprint.autonomyEnvelope')
  parsePolicyMap(input.template.values, 'template.values')
  const templateEnvelope = parsePolicyMap(input.template.mutationEnvelope, 'template.mutationEnvelope')

  if (input.templateOverlay !== undefined) {
    validateOverlay(input.templateOverlay, 'template', 'templateOverlay')
  }
  if (input.instanceOverlay !== undefined) {
    validateOverlay(input.instanceOverlay, 'instance', 'instanceOverlay')
  }
  if (input.humanOverride !== undefined) {
    validateHumanOverride(input.humanOverride)
  }

  parsePolicyMap(input.external.hard, 'external.hard')
  parseExistsMap(input.external.capabilityExists, 'external.capabilityExists')

  // Precompute the per-cell Team autonomy envelope (blueprint ∩ template).
  const envelopeItems = new Map<CapabilityName, Set<string>>()
  for (const capability of CAPABILITY_NAME_VALUES) {
    const blueprintSet = entryToItemSet(blueprintEnvelope?.[capability])
    const templateSet = entryToItemSet(templateEnvelope?.[capability])
    const intersection = new Set<string>()
    for (const item of blueprintSet) {
      if (templateSet.has(item)) intersection.add(item)
    }
    envelopeItems.set(capability, intersection)
  }

  return { envelopeItems }
}

// --- internal helpers -------------------------------------------------------

function malformed(field: string, problem: string): PolicyResolutionError {
  return new PolicyResolutionError(
    POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
    `malformed policy input at ${field}: ${problem}`,
    { field, problem },
  )
}

function hasForbiddenIdChars(value: string): boolean {
  return /\s/.test(value) || /[\u0000-\u001f\u007f]/.test(value)
}

/**
 * Validate one policy entry and return a normalized copy (fresh array,
 * input order preserved).
 */
function parsePolicyEntry(value: unknown, field: string): PolicyEntry {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw malformed(field, `policy entry must be a record {kind:'allow'|'deny', ...}`)
  }
  const record = value as Record<string, unknown>
  const kind = record['kind']
  const keys = Object.keys(record)
  if (kind === 'deny') {
    if (keys.some((key) => key !== 'kind')) {
      throw malformed(field, `a 'deny' entry must not carry extra fields (got ${keys.join(', ')})`)
    }
    return { kind: 'deny' }
  }
  if (kind === 'allow') {
    if (keys.some((key) => key !== 'kind' && key !== 'items')) {
      throw malformed(field, `an 'allow' entry may only carry 'kind' and 'items'`)
    }
    const items = record['items']
    if (!Array.isArray(items) || items.length === 0) {
      throw malformed(field, `'allow' items must be a non-empty array (use kind:'deny' for no items)`)
    }
    const seen = new Set<string>()
    for (const item of items) {
      if (typeof item !== 'string' || item.length === 0) {
        throw malformed(`${field}.items`, 'every item must be a non-empty string')
      }
      if (seen.has(item)) {
        throw malformed(`${field}.items`, `duplicate item '${item}'`)
      }
      seen.add(item)
    }
    return { kind: 'allow', items: [...items] }
  }
  throw malformed(field, `unknown or missing 'kind' (expected 'allow' or 'deny', got ${JSON.stringify(kind)})`)
}

/**
 * Validate a partial capability→entry map (closed key set) and return a
 * normalized copy; `undefined` input stays `undefined`.
 */
function parsePolicyMap(
  value: unknown,
  field: string,
): Partial<Record<CapabilityName, PolicyEntry>> | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw malformed(field, 'must be a record keyed by capability name (or absent)')
  }
  const out: Partial<Record<CapabilityName, PolicyEntry>> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!(CAPABILITY_NAME_VALUES as readonly string[]).includes(key)) {
      throw new PolicyResolutionError(
        POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
        `unknown capability '${key}' at ${field} (closed set: ${CAPABILITY_NAME_VALUES.join(', ')})`,
        { field, capability: key, problem: 'unknown capability' },
      )
    }
    out[key as CapabilityName] = parsePolicyEntry(entry, `${field}.${key}`)
  }
  return out
}

/** Validate the PolicyState per-cell map (closed keys; locked/value shape). */
function parseStateCellMap(
  value: unknown,
  field: string,
): Partial<Record<CapabilityName, PolicyStateCellView>> | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw malformed(field, 'must be a record keyed by capability name (or absent)')
  }
  const out: Partial<Record<CapabilityName, PolicyStateCellView>> = {}
  for (const [key, cell] of Object.entries(value)) {
    if (!(CAPABILITY_NAME_VALUES as readonly string[]).includes(key)) {
      throw new PolicyResolutionError(
        POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
        `unknown capability '${key}' at ${field} (closed set: ${CAPABILITY_NAME_VALUES.join(', ')})`,
        { field, capability: key, problem: 'unknown capability' },
      )
    }
    const capability = key as CapabilityName
    if (typeof cell !== 'object' || cell === null || Array.isArray(cell)) {
      throw malformed(`${field}.${capability}`, 'state cell must be a record {locked?, value?}')
    }
    const record = cell as Record<string, unknown>
    if (Object.keys(record).some((k) => k !== 'locked' && k !== 'value')) {
      throw malformed(`${field}.${capability}`, "state cell may only carry 'locked' and 'value'")
    }
    const locked = record['locked']
    if (locked !== undefined && typeof locked !== 'boolean') {
      throw malformed(`${field}.${capability}.locked`, 'must be a boolean when present')
    }
    const valueEntry = record['value']
    const normalized: PolicyStateCellView = {}
    if (locked === true) normalized.locked = true
    if (valueEntry !== undefined) {
      normalized.value = parsePolicyEntry(valueEntry, `${field}.${capability}.value`)
    }
    out[capability] = normalized
  }
  return out
}

/** Validate the capability-existence map (closed keys; boolean values). */
function parseExistsMap(
  value: unknown,
  field: string,
): Partial<Record<CapabilityName, boolean>> {
  if (value === undefined) {
    throw malformed(field, 'external.capabilityExists must be a record (possibly empty)')
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw malformed(field, 'must be a record keyed by capability name')
  }
  const out: Partial<Record<CapabilityName, boolean>> = {}
  for (const [key, flag] of Object.entries(value)) {
    if (!(CAPABILITY_NAME_VALUES as readonly string[]).includes(key)) {
      throw new PolicyResolutionError(
        POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
        `unknown capability '${key}' at ${field} (closed set: ${CAPABILITY_NAME_VALUES.join(', ')})`,
        { field, capability: key, problem: 'unknown capability' },
      )
    }
    if (typeof flag !== 'boolean') {
      throw malformed(`${field}.${key}`, 'must be a boolean')
    }
    out[key as CapabilityName] = flag
  }
  return out
}

/** Validate one autonomy overlay record against its input slot. */
function validateOverlay(
  overlay: AutonomyOverlayRecord,
  expectedKind: 'template' | 'instance',
  field: string,
): void {
  if (typeof overlay !== 'object' || overlay === null || Array.isArray(overlay)) {
    throw malformed(field, 'overlay must be a record')
  }
  if (typeof overlay.overlayId !== 'string' || overlay.overlayId.length === 0) {
    throw malformed(`${field}.overlayId`, 'must be a non-empty string')
  }
  if (overlay.kind !== expectedKind) {
    throw malformed(
      `${field}.kind`,
      `overlay in the '${field}' slot must have kind '${expectedKind}' (got '${String(overlay.kind)}')`,
    )
  }
  if (overlay.origin !== 'leader' && overlay.origin !== 'member') {
    throw malformed(
      `${field}.origin`,
      `must be 'leader' or 'member' (got '${String(overlay.origin)}') — human authority is not an overlay origin`,
    )
  }
  parsePolicyMap(overlay.values, `${field}.values`)
}

/** Validate one explicit human override record. */
function validateHumanOverride(override: HumanOverrideRecord): void {
  if (typeof override !== 'object' || override === null || Array.isArray(override)) {
    throw malformed('humanOverride', 'override must be a record')
  }
  if (typeof override.overrideId !== 'string' || override.overrideId.length === 0) {
    throw malformed('humanOverride.overrideId', 'must be a non-empty string')
  }
  if (override.scope !== 'team' && override.scope !== 'instance') {
    throw malformed(
      'humanOverride.scope',
      `must be 'team' or 'instance' (got '${String(override.scope)}')`,
    )
  }
  parsePolicyMap(override.values, 'humanOverride.values')
}

/** The item set of an envelope entry (absent/deny → ∅; allow → its items). */
function entryToItemSet(entry: PolicyEntry | undefined): Set<string> {
  if (entry === undefined || entry.kind === 'deny') return new Set()
  return new Set(entry.items)
}
