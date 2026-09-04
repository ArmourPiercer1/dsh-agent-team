/**
 * P8-S7-R2 (R2-3) — BQ-11: the model state view of one member (DevPlan
 * P8-S §22 BQ-11: "current model / next-boundary pending model / Team
 * constraint/provenance / availability"; UI rows D09/H06/H09/H10/H12).
 *
 * The view resolves the model cell of ONE member twice through the FROZEN
 * P3-T4 resolver (reused verbatim, never re-implemented), over the SAME
 * durable layer facts the R2-2 effective-config view consumes:
 *
 * - `current` — the NOW horizon: the policy state active at the CURRENT
 *   step (the production step clock is pinned to 0, so the policy state
 *   of a fresh boundary). Record-backed winning values are conservatively
 *   pending in this horizon (the two-horizon ruling of R2-2: the
 *   boundary-application record set is PROCESS-LOCAL, appliedRecordIds
 *   empty in the durable projection).
 * - `pendingNextBoundary` — the NEXT horizon (the maximum step: every
 *   admitted future-boundary change is resolved). The key is present when
 *   something is pending FOR THE MODEL CELL: a PolicyState transition
 *   with `effectiveFromStep > currentStep`, or a winning value backed by
 *   an admitted-but-not-yet-applied record. The entry's `state` is
 *   `pending-next-boundary` when a concrete model value applies at the
 *   next boundary; when no model applies there (team deny, capability
 *   absence, external hard facts, malformed item) the entry carries the
 *   corresponding `denied` / `unavailable` state with `value: null` —
 *   the UI reads "the next request has no model" from it.
 * - `provenance` — the winning Team layer of the model cell at the NOW
 *   horizon (layer / origin / record id — the §18.3 source) plus the
 *   frozen resolver's per-cell explanation line: the p7t2 provenance
 *   fact, consumed verbatim (H12 "Team provenance on the Root model").
 * - `availability` — the TEAM-SIDE availability (H10): `unavailable`
 *   exactly when the current entry is `denied` or `unavailable` (the Team
 *   constraint removed the model), `available` otherwise (a concrete
 *   selection applies, including the world baseline for `unspecified`
 *   cells). The ND-03 substrate/browser adapter facts are a DIFFERENT
 *   concern (the R1 cluster) and are out of this view by design.
 *
 * When the resolver rejects the input (a malformed stored payload — fail
 * closed), this function THROWS the typed frozen error; the caller
 * catches and drops the `modelState` key (the row keeps its other fields).
 *
 * @module @dsh-agent-team/runtime/plugin/model-state-view
 */

import {
  EFFECTIVE_CONFIG_SOURCES,
  EFFECTIVE_CONFIG_STATES,
} from '../../../contracts/src/index.js'
import type {
  MemberModelStateDto,
  ModelStateEntryDto,
} from '../../../contracts/src/index.js'
import { CAPABILITY_NAMES, resolveEffectivePolicy } from '../../../domain/policy/src/index.js'
import type { EffectivePolicy, EffectivePolicyInput } from '../../../domain/policy/src/index.js'
import { assembleEffectivePolicyInput } from '../../policy-adapter.js'
import { selectPolicyOverrides } from '../../activation/index.js'
import {
  modelConsumptionView,
} from '../../agent-setup/model/index.js'
import type { ModelConsumptionView, ModelSelection } from '../../agent-setup/model/index.js'
import type {
  DurableOverrideRef,
  MutationStore,
  PolicyReader,
  PolicyStateTransitionRecord,
  StoredMutationRecord,
} from '../../mutation/index.js'
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js'
import {
  CLOSER_LAYERS,
  SOURCE_BY_LAYER,
  deniedByString,
  effectiveFromOf,
  externalHardDecides,
} from './effective-config-view.js'

/** The arguments of {@link createModelStateView}. */
export interface ModelStateViewArgs {
  /** The TeamSession (root session) id the member belongs to. */
  readonly teamSessionId: string
  /** The member's stable instance id. */
  readonly instanceId: string
  /** The current step (the projection clock; the production pin is 0). */
  readonly currentStep: number
  /** The world baseline model selection (the harness-injected static model). */
  readonly staticModel: ModelSelection
  /** The member's durable PolicyState transitions (admission order). */
  readonly transitions: readonly PolicyStateTransitionRecord[]
  /** The member's durable mutation records (admission order). */
  readonly records: readonly StoredMutationRecord[]
  /** Every durable governance override record of the TeamSession. */
  readonly overrides: readonly GovernanceOverrideRecord[]
  /** The static policy reader (blueprint envelope / template / external). */
  readonly policyReader: PolicyReader
}

/** Clamp the resolver explanation line to the frozen display bound. */
function clampExplanation(explanation: string): string {
  const bound = 512
  return explanation.length > bound ? explanation.slice(0, bound) : explanation
}

/**
 * Derive one model state entry from a consumption view of ONE horizon,
 * with the R2-2 model-lane state precedence (module docs of
 * `effective-config-view.ts`): unavailable > external hard > unspecified
 * (baseline consumer rule) > team/external denial > record-backed pending
 * > closer-layer override > inherited. The entry carries the closed v2
 * provenance keys `deniedBy?` / `unavailable?` / `effectiveFrom?` — the
 * effective-config lane's `suppressed?` / `locked?` keys are NOT part of
 * the model-state entry (their own lanes own those facts).
 */
function entryOf(
  view: ModelConsumptionView,
  policy: EffectivePolicy,
  staticModel: ModelSelection,
  records: readonly StoredMutationRecord[],
): ModelStateEntryDto {
  const note = policy.cells[CAPABILITY_NAMES.MODEL].external.note
  const externalHard = externalHardDecides(note)
  const layer = view.source.layer
  const recordId = view.source.recordId
  const pending = view.pendingNextBoundary.length > 0 && recordId !== null
  const selectionValue =
    view.selection !== undefined
      ? `${view.selection.provider}/${view.selection.model}`
      : null

  let value: string | null
  let source: (typeof EFFECTIVE_CONFIG_SOURCES)[keyof typeof EFFECTIVE_CONFIG_SOURCES]
  let state: (typeof EFFECTIVE_CONFIG_STATES)[keyof typeof EFFECTIVE_CONFIG_STATES]
  const extra: { deniedBy?: string; unavailable?: boolean; effectiveFrom?: number } = {}

  if (view.unavailable) {
    value = null
    state = EFFECTIVE_CONFIG_STATES.unavailable
    source = externalHard ? EFFECTIVE_CONFIG_SOURCES.external_hard_policy : SOURCE_BY_LAYER[layer]
    extra.unavailable = true
  } else if (externalHard) {
    value = null
    state = EFFECTIVE_CONFIG_STATES.denied
    source = EFFECTIVE_CONFIG_SOURCES.external_hard_policy
    extra.deniedBy =
      note === 'externalHardRemovedAll' ? 'external:hard-removed-all' : 'external:hard-deny'
  } else if (layer === 'unspecified') {
    // The documented consumer rule: the Team did not speak to the model
    // cell, so the world baseline (the static model) applies.
    value = `${staticModel.provider}/${staticModel.model}`
    source = EFFECTIVE_CONFIG_SOURCES.capability
    state = EFFECTIVE_CONFIG_STATES.inherited
  } else if (view.deniedBy !== undefined) {
    value = null
    state = EFFECTIVE_CONFIG_STATES.denied
    source = SOURCE_BY_LAYER[layer]
    extra.deniedBy = deniedByString(view.deniedBy)
  } else if (pending) {
    value = selectionValue
    source = SOURCE_BY_LAYER[layer]
    state = EFFECTIVE_CONFIG_STATES.pending_next_boundary
    const from = effectiveFromOf(recordId, records)
    if (from !== undefined) extra.effectiveFrom = from
  } else if (CLOSER_LAYERS.has(layer)) {
    value = selectionValue
    source = SOURCE_BY_LAYER[layer]
    state = EFFECTIVE_CONFIG_STATES.overridden
  } else {
    value = selectionValue
    source = SOURCE_BY_LAYER[layer]
    state = EFFECTIVE_CONFIG_STATES.inherited
  }

  const entry: {
    value: string | null
    source: (typeof EFFECTIVE_CONFIG_SOURCES)[keyof typeof EFFECTIVE_CONFIG_SOURCES]
    state: (typeof EFFECTIVE_CONFIG_STATES)[keyof typeof EFFECTIVE_CONFIG_STATES]
    deniedBy?: string
    unavailable?: boolean
    effectiveFrom?: number
  } = { value, source, state }
  if (extra.deniedBy !== undefined) entry.deniedBy = extra.deniedBy
  if (extra.unavailable !== undefined) entry.unavailable = extra.unavailable
  if (extra.effectiveFrom !== undefined) entry.effectiveFrom = extra.effectiveFrom
  return entry
}

/**
 * Resolve the BQ-11 model state view of one member.
 * @param args - the durable layer facts (see {@link ModelStateViewArgs}).
 * @returns the plain (unfrozen) view; the projection pipeline validates
 *   and deep-freezes it.
 * @throws the frozen policy resolver's typed error when the merged input
 *   is malformed (fail closed — the caller drops the view, never a
 *   partial one).
 */
export function createModelStateView(args: ModelStateViewArgs): MemberModelStateDto {
  const { teamSessionId, instanceId, currentStep, staticModel } = args
  const { transitions, records, overrides, policyReader } = args

  // 1. Both horizons over the same durable facts: NOW = the current step
  //    (the policy state active there), NEXT = the maximum step (every
  //    admitted future-boundary change resolved).
  const miniStore = {
    listTransitions: () => transitions,
    listRecords: () => records,
  } as unknown as MutationStore
  const baseNow = assembleEffectivePolicyInput({
    teamSessionId,
    member: { rootSessionId: teamSessionId, instanceId },
    atStep: currentStep,
    store: miniStore,
    policy: policyReader,
  })
  const baseNext = assembleEffectivePolicyInput({
    teamSessionId,
    member: { rootSessionId: teamSessionId, instanceId },
    atStep: Number.MAX_SAFE_INTEGER,
    store: miniStore,
    policy: policyReader,
  })

  // 2. Merge the durable governance slots (the R2-2 merge rule, verbatim):
  //    a mutation-store slot wins when present, the governance slot fills
  //    whatever the store did not produce.
  const governance = selectPolicyOverrides(overrides, teamSessionId, instanceId)
  const inputNow: EffectivePolicyInput = {
    ...baseNow,
    templateOverlay: baseNow.templateOverlay ?? governance.templateOverlay,
    instanceOverlay: baseNow.instanceOverlay ?? governance.instanceOverlay,
    humanOverride: baseNow.humanOverride ?? governance.humanOverride,
  }
  const inputNext: EffectivePolicyInput = {
    ...baseNext,
    templateOverlay: baseNext.templateOverlay ?? governance.templateOverlay,
    instanceOverlay: baseNext.instanceOverlay ?? governance.instanceOverlay,
    humanOverride: baseNext.humanOverride ?? governance.humanOverride,
  }

  const nowPolicy = resolveEffectivePolicy(inputNow)
  const nextPolicy = resolveEffectivePolicy(inputNext)

  // 3. The backend-truth override refs, scoped to THIS member (team scope +
  //    this instance only); appliedRecordIds empty by the two-horizon
  //    ruling (the process-local application set is not durable).
  const refs: DurableOverrideRef[] = overrides
    .filter((record) => record.scope === 'team' || record.instanceId === instanceId)
    .map((record) => ({
      recordId: record.recordId,
      kind: record.kind,
      scope: record.scope,
      generation: record.generation,
      updatedAt: record.updatedAt,
      values: record.values as Record<string, unknown>,
    }))
  const provenanceOptions = { overrides: refs, appliedRecordIds: [] as readonly string[] }

  const nowView = modelConsumptionView(nowPolicy, staticModel, provenanceOptions)
  const nextView = modelConsumptionView(nextPolicy, staticModel, provenanceOptions)

  const current = entryOf(nowView, nowPolicy, staticModel, records)

  // 4. The next-boundary entry: present when the model cell has something
  //    pending (a transition with effectiveFromStep > currentStep, or a
  //    winning value backed by an admitted-but-unapplied record).
  const pendingTransitions = transitions.filter((t) => t.effectiveFromStep > currentStep)
  const winnerIsPendingRecord =
    nextView.source.recordId !== null && nextView.pendingNextBoundary.length > 0
  const out: {
    current: ModelStateEntryDto
    pendingNextBoundary?: ModelStateEntryDto
    provenance: {
      layer: string
      origin: string
      recordId: string | null
      explanation: string
    }
    availability: 'available' | 'unavailable'
  } = {
    current,
    provenance: {
      layer: nowView.source.layer,
      origin: nowView.source.origin,
      recordId: nowView.source.recordId,
      explanation: clampExplanation(nowView.explanation),
    },
    availability:
      current.state === EFFECTIVE_CONFIG_STATES.denied || current.state === EFFECTIVE_CONFIG_STATES.unavailable
        ? 'unavailable'
        : 'available',
  }

  if (pendingTransitions.length > 0 || winnerIsPendingRecord) {
    const base = entryOf(nextView, nextPolicy, staticModel, records)
    // effectiveFrom: the earliest pending step — the next transition
    // boundary, or (record-backed pending, no transition) the stored
    // record's effectiveFromStep; absent when neither is derivable.
    let from: number | undefined
    if (pendingTransitions.length > 0) {
      const steps = pendingTransitions
        .map((t) => t.effectiveFromStep)
        .filter((step) => Number.isSafeInteger(step) && step >= 0)
      if (steps.length > 0) from = Math.min(...steps)
    }
    if (from === undefined) from = effectiveFromOf(nextView.source.recordId, records)
    // A concrete value at the next boundary is by definition
    // pending-next-boundary; a null value keeps its denied / unavailable
    // state (the entry says "no model from the next boundary").
    out.pendingNextBoundary =
      base.value !== null
        ? {
            value: base.value,
            source: base.source,
            state: EFFECTIVE_CONFIG_STATES.pending_next_boundary,
            ...(from !== undefined ? { effectiveFrom: from } : {}),
          }
        : {
            ...base,
            ...(from !== undefined ? { effectiveFrom: from } : {}),
          }
  }

  return out
}
