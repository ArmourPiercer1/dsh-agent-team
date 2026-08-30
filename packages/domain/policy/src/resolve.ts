/**
 * The pure policy resolver (P3-T4).
 *
 * `resolveEffectivePolicy` computes the effective policy of one member of
 * one TeamSession in the two frozen stages (Architecture §19.6):
 *
 * ```text
 * P_TeamResolved = Resolve(
 *     Blueprint, MemberTemplate, PolicyState,
 *     TemplateAutonomyOverlay, InstanceAutonomyOverlay,
 *     ExplicitHumanOverride
 * )
 * P_effective = P_externalHard ∩ P_capabilityExists ∩ P_TeamResolved
 * ```
 *
 * Stage 1 (Team domain, invariant 33 — resolved in the Team domain before
 * materialization to the DSH guard):
 *
 * - Each capability cell resolves by PRECEDENCE over the Team-owned value
 *   layers ({@link TEAM_LAYER_ORDER}: blueprint < policyState < template <
 *   templateOverlay < instanceOverlay < humanOverride). A cell no Team
 *   layer granted fails closed: deny (the explicit human override is the
 *   only layer that may grant such a cell, invariant 34).
 * - Autonomy overlays are ADMISSION-CHECKED against the Team autonomy
 *   envelope (blueprint ∩ template envelope, §19.3) before they may win:
 *   - a `deny` overlay always wins admission (it only tightens);
 *   - an `allow` overlay with items outside the envelope FAILS the whole
 *     resolution with a typed error — `MEMBER_SELF_ESCALATION` for
 *     member-origin (invariant 37), `LEADER_OUT_OF_ENVELOPE` for
 *     leader-origin (invariant 36). The resolver never resolves "around"
 *     a violating record.
 *   - an in-envelope `allow` overlay in a cell the current PolicyState
 *     LOCKS is "stored but suppressed" (§19.4): recorded in the output
 *     provenance, non-destructive, re-admissible if the state relaxes.
 *     Locking never suppresses a `deny` overlay (suppression must never
 *     loosen) and never suppresses an explicit human override (§19.5).
 * - The human override is NOT envelope-checked and NOT state-gated
 *   (invariant 34: it may exceed the Team autonomy boundary).
 *
 * Stage 2 (external intersection, un-bypassable — invariant 34, §25.4):
 *
 * - a missing capability (`capabilityExists[c] === false`) denies the cell
 *   for EVERY layer — an override cannot create a removed capability back
 *   (invariant 35, §21.5: compatibility drift instead);
 * - an external hard `deny` denies the cell for every layer;
 * - an external hard allow-list INTERSECTS the Team-allowed items
 *   (removed items are recorded per cell); an empty intersection denies.
 *
 * The output makes the provenance of EVERY value first-class data
 * (TaskDoc P3-T4 acceptance: "every effective value is explainable"):
 * winner layer/origin/record, the losing lower layers, the suppressed
 * overlays, the external facts and exactly which items were removed, plus
 * a deterministic one-line explanation per cell.
 *
 * Pure function: no I/O, no state mutation, no ambient state; the same
 * input always yields a deeply-equal output. The output is deep-frozen.
 *
 * @module @dsh-agent-team/domain/policy/resolve
 */

import { deepFreeze } from './contracts-mirror.js'
import {
  CAPABILITY_NAME_VALUES,
  TEAM_LAYERS,
  TEAM_VALUE_ORIGINS,
} from './types.js'
import type {
  AutonomyOverlayRecord,
  CapabilityName,
  CellResolution,
  EffectivePolicy,
  EffectivePolicyInput,
  ExternalCellFacts,
  OverriddenTeamLayer,
  PolicyEntry,
  SuppressedOverlayRecord,
  TeamLayer,
  TeamResolvedCell,
  TeamValueOrigin,
} from './types.js'
import {
  POLICY_ERROR_CODES,
  PolicyResolutionError,
} from './errors.js'
import { validatePolicyInput } from './validate.js'
import type { ValidatedPolicyInput } from './validate.js'

/** One Team-owned candidate value for a cell (internal). */
interface TeamCandidate {
  readonly layer: TeamLayer
  readonly origin: TeamValueOrigin
  readonly recordId: string | null
  readonly value: PolicyEntry
}

/**
 * Resolve the effective policy of one member of one TeamSession.
 *
 * @param input - the complete pure resolver input (validated at the
 *   boundary; see {@link validatePolicyInput}).
 * @returns the effective policy with full per-cell provenance.
 * @throws `PolicyResolutionError` (`MALFORMED_POLICY_INPUT`) for malformed
 *   ids or structural policy violations, (`IDENTITY_SCOPE_MISMATCH`) for a
 *   cross-scope member identity, and the escalation codes for overlays
 *   outside the Team autonomy envelope
 *   (`MEMBER_SELF_ESCALATION`) / (`LEADER_OUT_OF_ENVELOPE`) for an
 *   out-of-envelope autonomy overlay.
 */
export function resolveEffectivePolicy(input: EffectivePolicyInput): EffectivePolicy {
  const validated = validatePolicyInput(input)

  const cells = {} as Record<CapabilityName, CellResolution>
  const allSuppressed: SuppressedOverlayRecord[] = []
  for (const capability of CAPABILITY_NAME_VALUES) {
    const cell = resolveCell(capability, input, validated)
    cells[capability] = cell
    for (const suppressed of cell.team.suppressed) {
      allSuppressed.push(suppressed)
    }
  }

  return deepFreeze({
    teamSessionId: input.teamSessionId,
    member: input.member,
    policyStateId: input.policyState.stateId,
    cells,
    suppressed: allSuppressed,
    explanation: CAPABILITY_NAME_VALUES.map((capability) => cells[capability].explanation).join(
      '\n',
    ),
  })
}

// --- internals ----------------------------------------------------------------

/**
 * Resolve one capability cell: stage 1 (Team-domain resolution) followed
 * by stage 2 (external intersection).
 */
function resolveCell(
  capability: CapabilityName,
  input: EffectivePolicyInput,
  validated: ValidatedPolicyInput,
): CellResolution {
  const state = input.policyState
  const stateCell = state.cells === undefined ? undefined : state.cells[capability]
  const locked = stateCell !== undefined && stateCell.locked === true
  const envelopeItems = validated.envelopeItems.get(capability)
  if (envelopeItems === undefined) {
    // Unreachable: validation seeds every capability. Fail closed anyway.
    throw new PolicyResolutionError(
      POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT,
      `no envelope computed for capability '${capability}'`,
      { capability, problem: 'internal invariant' },
    )
  }

  // --- Stage 1: collect Team-owned candidates in ASCENDING precedence. ---
  const candidates: TeamCandidate[] = []

  const blueprintValue = input.blueprint.values === undefined ? undefined : input.blueprint.values[capability]
  if (blueprintValue !== undefined) {
    candidates.push({
      layer: TEAM_LAYERS.BLUEPRINT,
      origin: TEAM_VALUE_ORIGINS.STATIC,
      recordId: null,
      value: blueprintValue,
    })
  }

  if (stateCell !== undefined && stateCell.value !== undefined) {
    candidates.push({
      layer: TEAM_LAYERS.POLICY_STATE,
      origin: TEAM_VALUE_ORIGINS.STATIC,
      recordId: null,
      value: stateCell.value,
    })
  }

  const templateValue = input.template.values === undefined ? undefined : input.template.values[capability]
  if (templateValue !== undefined) {
    candidates.push({
      layer: TEAM_LAYERS.TEMPLATE,
      origin: TEAM_VALUE_ORIGINS.STATIC,
      recordId: null,
      value: templateValue,
    })
  }

  const suppressed: SuppressedOverlayRecord[] = []
  const overlays: Array<{ readonly layer: TeamLayer; readonly record: AutonomyOverlayRecord }> = []
  if (input.templateOverlay !== undefined) {
    overlays.push({ layer: TEAM_LAYERS.TEMPLATE_OVERLAY, record: input.templateOverlay })
  }
  if (input.instanceOverlay !== undefined) {
    overlays.push({ layer: TEAM_LAYERS.INSTANCE_OVERLAY, record: input.instanceOverlay })
  }
  for (const { layer, record } of overlays) {
    const value = record.values[capability]
    if (value === undefined) continue
    if (value.kind === 'deny') {
      // A deny overlay only tightens: always admitted, never suppressed.
      candidates.push({
        layer,
        origin: record.origin,
        recordId: record.overlayId,
        value,
      })
      continue
    }
    const outOfEnvelope = value.items.filter((item) => !envelopeItems.has(item))
    if (outOfEnvelope.length > 0) {
      // Invariants 36/37: an out-of-envelope overlay record makes the whole
      // resolution fail (fail-closed). The code depends on the origin.
      throw new PolicyResolutionError(
        record.origin === 'member'
          ? POLICY_ERROR_CODES.MEMBER_SELF_ESCALATION
          : POLICY_ERROR_CODES.LEADER_OUT_OF_ENVELOPE,
        `autonomy overlay '${record.overlayId}' (origin ${record.origin}) grants items outside the ` +
          `Team autonomy envelope for capability '${capability}': ` +
          `[${outOfEnvelope.join(', ')}] ⊄ envelope [${[...envelopeItems].sort().join(', ')}]`,
        {
          capability,
          overlayId: record.overlayId,
          origin: record.origin,
          outOfEnvelopeItems: outOfEnvelope,
          envelopeItems: [...envelopeItems].sort(),
        },
      )
    }
    if (locked) {
      // §19.4: stored but suppressed — non-destructive, recorded in
      // provenance; a tightening state must never produce a loosening.
      suppressed.push({
        capability,
        overlayId: record.overlayId,
        layer,
        origin: record.origin,
        value,
        reason: 'policyStateLocked',
        policyStateId: state.stateId,
      })
      continue
    }
    candidates.push({
      layer,
      origin: record.origin,
      recordId: record.overlayId,
      value,
    })
  }

  const human = input.humanOverride
  if (human !== undefined) {
    const value = human.values[capability]
    if (value !== undefined) {
      // §19.5 / invariant 34: no envelope check, no state gate.
      candidates.push({
        layer: TEAM_LAYERS.HUMAN_OVERRIDE,
        origin: TEAM_VALUE_ORIGINS.HUMAN,
        recordId: human.overrideId,
        value,
      })
    }
  }

  // Winner = highest-precedence candidate (candidates are ascending).
  const winner: TeamCandidate | undefined =
    candidates.length > 0 ? candidates[candidates.length - 1] : undefined

  let team: TeamResolvedCell
  if (winner === undefined) {
    team = {
      layer: 'unspecified',
      origin: TEAM_VALUE_ORIGINS.STATIC,
      recordId: null,
      value: { kind: 'deny' },
      overriddenLower: [],
      suppressed,
    }
  } else {
    const overriddenLower: OverriddenTeamLayer[] = candidates
      .slice(0, candidates.length - 1)
      .map((candidate) => ({
        layer: candidate.layer,
        origin: candidate.origin,
        recordId: candidate.recordId,
        value: candidate.value,
      }))
    team = {
      layer: winner.layer,
      origin: winner.origin,
      recordId: winner.recordId,
      value: winner.value,
      overriddenLower,
      suppressed,
    }
  }

  // --- Stage 2: external intersection (un-bypassable). ---
  const capabilityExists =
    input.external.capabilityExists[capability] === undefined
      ? true
      : input.external.capabilityExists[capability] === true
  const hardEntry = input.external.hard[capability]

  let hardFacts: ExternalCellFacts['hard'] = 'unspecified'
  if (hardEntry !== undefined) {
    hardFacts = hardEntry.kind === 'deny' ? 'deny' : { allowedItems: [...hardEntry.items] }
  }

  let effective: PolicyEntry
  let removedItems: string[] = []
  let note: ExternalCellFacts['note'] = 'none'

  if (team.value.kind === 'deny') {
    // The Team domain denied the cell; the external stage removes nothing.
    effective = { kind: 'deny' }
  } else if (!capabilityExists) {
    // Invariant 35: no layer — human override included — can grant a
    // capability that does not exist in the substrate.
    effective = { kind: 'deny' }
    removedItems = [...team.value.items]
    note = 'capabilityMissing'
  } else if (hardEntry !== undefined && hardEntry.kind === 'deny') {
    // Invariant 34 / §25.4: the external hard denies the cell for everyone.
    effective = { kind: 'deny' }
    removedItems = [...team.value.items]
    note = 'externalHardDeny'
  } else {
    const teamItems = team.value.items
    const hardItems =
      hardEntry !== undefined && hardEntry.kind === 'allow' ? hardEntry.items : undefined
    if (hardItems === undefined) {
      effective = { kind: 'allow', items: [...teamItems] }
    } else {
      const hardSet = new Set(hardItems)
      const allowed = [...teamItems].filter((item) => hardSet.has(item))
      removedItems = [...teamItems].filter((item) => !hardSet.has(item))
      if (allowed.length === 0) {
        effective = { kind: 'deny' }
        note = 'externalHardRemovedAll'
      } else {
        effective = { kind: 'allow', items: allowed }
      }
    }
  }

  const external: ExternalCellFacts = {
    capabilityExists,
    hard: hardFacts,
    removedItems,
    note,
  }

  const explanation = buildExplanation(capability, team, external, effective)

  return {
    capability,
    effective,
    team,
    external,
    explanation,
  }
}

// --- explanation rendering ------------------------------------------------------

function fmtEntry(entry: PolicyEntry): string {
  return entry.kind === 'deny' ? 'deny' : `allow[${entry.items.join(',')}]`
}

function fmtTeam(team: TeamResolvedCell): string {
  if (team.layer === 'unspecified') {
    const suppressed = fmtSuppressed(team)
    return `none(origin=static) deny (fail-closed: no team layer grants this cell)${suppressed}`
  }
  const recordPart = team.recordId === null ? '' : `, ${team.recordId}`
  const suppressed = fmtSuppressed(team)
  return `${team.layer}(origin=${team.origin}${recordPart}) ${fmtEntry(team.value)}${suppressed}`
}

function fmtSuppressed(team: TeamResolvedCell): string {
  if (team.suppressed.length === 0) return ''
  const ids = team.suppressed.map((record) => record.overlayId).join(',')
  return `; suppressed=[${ids}]`
}

function fmtHard(hard: ExternalCellFacts['hard']): string {
  if (hard === 'unspecified') return 'unspecified'
  if (hard === 'deny') return 'deny'
  return `allow[${hard.allowedItems.join(',')}]`
}

function buildExplanation(
  capability: CapabilityName,
  team: TeamResolvedCell,
  external: ExternalCellFacts,
  effective: PolicyEntry,
): string {
  const removed =
    external.removedItems.length > 0
      ? `, removed=[${external.removedItems.join(',')}]`
      : ''
  return (
    `${capability}: effective ${fmtEntry(effective)}; ` +
    `team ${fmtTeam(team)}; ` +
    `external exists=${external.capabilityExists ? 'yes' : 'no'}, hard=${fmtHard(external.hard)}${removed}`
  )
}
