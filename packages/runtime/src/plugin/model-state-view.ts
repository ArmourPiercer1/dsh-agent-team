/**
 * P8-S7-R2 (R2-3) — BQ-11: the model state view of one member (DevPlan
 * P8-S §22 BQ-11: "current model / next-boundary pending model / Team
 * constraint/provenance / availability"; UI rows D09/H06/H09/H10/H12).
 *
 * pre-alpha3 PR-B (plan §B.2/§B.3): the view resolves the model cell of
 * ONE member through the ONE canonical read (`readEffectivePolicy`) over
 * the SAME durable facts the R2-2 effective-config view consumes — the
 * production step clock is RETIRED as a decision source:
 *
 * - `current` — the COMMITTED model: the durable PolicyState (the last
 *   committed transition in commit order, else the implicit `default`) +
 *   the governance slot winners + the static layers (the bound snapshot
 *   through the production PolicyReader). A host restart derives the SAME
 *   view from the SAME durable truth (no process-local policy truth).
 * - `pendingNextBoundary` — the NEXT-BOUNDARY entry: present when a
 *   durable fact may not yet be applied by this process (a committed
 *   PolicyState transition, or a winning value backed by an admitted
 *   durable record). The boundary-application set is PROCESS-LOCAL
 *   (absent in the durable projection), so the projection reports
 *   conservatively (the R2-2 two-horizon ruling, re-based from step
 *   horizons onto the committed/applied split). The entry's `state` is
 *   `pending-next-boundary` when a concrete model value applies at the
 *   next boundary; when no model applies there (team deny, capability
 *   absence, external hard facts, malformed item) the entry carries the
 *   corresponding `denied` / `unavailable` state with `value: null` —
 *   the UI reads "the next request has no model" from it.
 * - `provenance` — the winning Team layer of the model cell at the
 *   committed horizon (layer / origin / record id — the §18.3 source)
 *   plus the frozen resolver's per-cell explanation line.
 * - `availability` — the TEAM-SIDE availability (H10): `unavailable`
 *   exactly when the current entry is `denied` or `unavailable` (the Team
 *   constraint removed the model), `available` otherwise (a concrete
 *   selection applies, including the world baseline for `unspecified`
 *   cells). The ND-03 substrate/browser adapter facts are a DIFFERENT
 *   concern (the R1 cluster) and are out of this view by design.
 *
 * The legacy `effectiveFromStep` display of the pre-PR-B two-horizon view
 * (the `effectiveFrom` key sourced from the step fields) is RETIRED: the
 * frozen v2 key remains part of the closed DTO shape (DURATIONAL-optional)
 * but the production derivation never sets it (there is no runtime step
 * anymore — plan §B.2 "legacy step fields keep parse/display only" and the
 * process-local step fields are test-world-only).
 *
 * When the canonical read rejects the input (a malformed stored payload —
 * fail closed), this function THROWS the typed frozen error; the caller
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
import { CAPABILITY_NAMES } from '../../../domain/policy/src/index.js'
import type { EffectivePolicy } from '../../../domain/policy/src/index.js'
import {
  readEffectivePolicy,
} from '../../effective-policy/index.js'
import {
  modelConsumptionView,
} from '../../agent-setup/model/index.js'
import type { ModelConsumptionView, ModelSelection } from '../../agent-setup/model/index.js'
import type {
  PolicyReader,
  PolicyStateTransitionRecord,
} from '../../mutation/index.js'
import type { GovernanceOverrideRecord } from '../../../storage/schema/index.js'
import {
  CLOSER_LAYERS,
  SOURCE_BY_LAYER,
  deniedByString,
  externalHardDecides,
} from './effective-config-view.js'

/** The arguments of {@link createModelStateView}. */
export interface ModelStateViewArgs {
  /** The TeamSession (root session) id the member belongs to. */
  readonly teamSessionId: string
  /** The member's stable instance id. */
  readonly instanceId: string
  /** The world baseline model selection (the harness-injected static model). */
  readonly staticModel: ModelSelection
  /**
   * The member's durable PolicyState transitions (COMMIT order — the
   * ledger sequence order; the LAST entry is the committed state).
   */
  readonly transitions: readonly PolicyStateTransitionRecord[]
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
 * Derive one model state entry from a consumption view of the committed
 * horizon, with the R2-2 model-lane state precedence (module docs of
 * `effective-config-view.ts`): unavailable > external hard > unspecified
 * (baseline consumer rule) > team/external denial > record-backed pending
 * > closer-layer override > inherited. The entry carries the closed v2
 * provenance keys `deniedBy?` / `unavailable?` — the `effectiveFrom` key
 * is retired (no runtime step, module docs) and the effective-config
 * lane's `suppressed?` / `locked?` keys are NOT part of the model-state
 * entry (their own lanes own those facts).
 */
function entryOf(
  view: ModelConsumptionView,
  policy: EffectivePolicy,
  staticModel: ModelSelection,
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
  const extra: { deniedBy?: string; unavailable?: boolean } = {}

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
  } = { value, source, state }
  if (extra.deniedBy !== undefined) entry.deniedBy = extra.deniedBy
  if (extra.unavailable !== undefined) entry.unavailable = extra.unavailable
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
  const { teamSessionId, instanceId, staticModel } = args
  const { transitions, overrides, policyReader } = args

  // 1. The ONE canonical read (pre-alpha3 PR-B): the committed PolicyState
  //    (the last durable transition in commit order) + the governance slot
  //    winners + the static layers — the SAME read the live request
  //    boundary and the R2-2 effective-config view run (single source).
  const read = readEffectivePolicy({
    rootSessionId: teamSessionId,
    instanceId,
    policy: policyReader,
    transitions,
    overrides,
  })
  const policy = read.policy

  // 2. The backend-truth refs are the canonical read's MEMBER-SCOPED refs
  //    (team scope + this instance); appliedRecordIds empty by the
  //    committed/applied ruling (the process-local application set is not
  //    durable — the projection reports conservatively).
  const provenanceOptions = { overrides: read.refs, appliedRecordIds: [] as readonly string[] }
  const view = modelConsumptionView(policy, staticModel, provenanceOptions)

  const current = entryOf(view, policy, staticModel)

  // 3. The next-boundary entry: present when a durable fact may not yet be
  //    applied by this process — a committed PolicyState transition
  //    (commit order, no step: the pinned (0, 1) legacy stamp is a record
  //    field, not a decision input) or a winning value backed by an
  //    admitted durable record.
  const hasCommittedTransition = read.policyStateTransition !== null
  const winnerIsPendingRecord =
    view.source.recordId !== null && view.pendingNextBoundary.length > 0

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
      layer: view.source.layer,
      origin: view.source.origin,
      recordId: view.source.recordId,
      explanation: clampExplanation(view.explanation),
    },
    availability:
      current.state === EFFECTIVE_CONFIG_STATES.denied || current.state === EFFECTIVE_CONFIG_STATES.unavailable
        ? 'unavailable'
        : 'available',
  }

  if (hasCommittedTransition || winnerIsPendingRecord) {
    const base = entryOf(view, policy, staticModel)
    // A concrete value at the next boundary is by definition
    // pending-next-boundary; a null value keeps its denied / unavailable
    // state (the entry says "no model from the next boundary").
    out.pendingNextBoundary =
      base.value !== null
        ? {
            value: base.value,
            source: base.source,
            state: EFFECTIVE_CONFIG_STATES.pending_next_boundary,
          }
        : { ...base }
  }

  return out
}
