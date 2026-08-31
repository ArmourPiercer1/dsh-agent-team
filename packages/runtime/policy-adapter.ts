/**
 * P7-T2 — the runtime-side policy adapter: assemble the FROZEN resolver's
 * `EffectivePolicyInput` from the mutation store + the static policy
 * reader, as of one step boundary.
 *
 * This module is the single seam between the runtime's append-only durable
 * records and the P3-T4 resolver: the resolver is reused VERBATIM (never
 * re-implemented); the adapter only selects WHICH stored records are
 * effective at the given step and maps them onto the frozen input shape:
 *
 * - `policyState` — the LATEST admitted PolicyState transition with
 *   `effectiveFromStep <= atStep` (future boundary), else the implicit
 *   `{ stateId: 'default' }` (Architecture §20.3 simple blueprints);
 * - `templateOverlay` — the latest TEMPLATE_OVERLAY record per capability
 *   effective at `atStep` (leader origin, team-scoped);
 * - `instanceOverlay` — the latest INSTANCE_OVERLAY record per capability
 *   of the member, effective at `atStep` (member origin, instance-scoped);
 * - `humanOverride` — per capability: the latest instance-scoped HUMAN
 *   override record of the member effective at `atStep` when present,
 *   else the latest team-scoped record (the caller-selection rule the
 *   frozen `HumanOverrideRecord` doc states);
 * - `blueprint` / `template` / `external` — the static facts from the
 *   reader (bound Blueprint snapshot + host facts).
 *
 * Record selection is pure: latest = LAST in the store's admission order
 * among the records effective at the step (admission order is monotone in
 * `requestedAtStep` within one service lifetime, so "last admitted" is
 * "latest"). The assembled overlay/override record id is the
 * `recordId` of the LATEST contributing durable record — the per-capability
 * precise record mapping lives in the provenance ledger (the service's
 * `contributions`), which the card acceptance reads for the source chain.
 *
 * @module @dsh-agent-team/runtime/policy-adapter
 */

import { DEFAULT_POLICY_STATE_ID } from '../domain/policy/src/index.js'
import type {
  AutonomyOverlayRecord,
  CapabilityName,
  EffectivePolicyInput,
  HumanOverrideRecord,
  InstanceId,
  MemberIdentity,
  OverlayOrigin,
  PolicyEntry,
  PolicyStateView,
  TeamSessionId,
  TeamValueOrigin,
} from '../domain/policy/src/index.js'
import { MUTATION_RECORD_KINDS } from './mutation/types.js'
import type {
  MutationRecordKind,
  MutationStore,
  PolicyReader,
  PolicyStateTransitionRecord,
  StoredMutationRecord,
} from './mutation/types.js'

/** The arguments of {@link assembleEffectivePolicyInput}. */
export interface AssembleEffectivePolicyInputArgs {
  /** The TeamSession being resolved (the member's root, invariant 9). */
  readonly teamSessionId: TeamSessionId
  /** The member being resolved (the service validated it is in-team). */
  readonly member: MemberIdentity
  /** The step boundary the input is assembled for. */
  readonly atStep: number
  /** The durable config store (records + transitions). */
  readonly store: MutationStore
  /** The static policy reader (blueprint envelope / template / external). */
  readonly policy: PolicyReader
}

/**
 * Assemble the frozen resolver input for one member at one step. The
 * caller (the service) has already validated `teamSessionId` / `member`
 * (identity boundary) — this function is pure assembly.
 */
export function assembleEffectivePolicyInput(
  args: AssembleEffectivePolicyInputArgs,
): EffectivePolicyInput {
  const { teamSessionId, member, atStep, store, policy } = args
  const blueprint = policy.readBlueprintEnvelope(teamSessionId)
  const template = policy.readTemplatePolicy(teamSessionId, member)
  const external = policy.readExternalFacts(teamSessionId)

  const transitions = store.listTransitions(teamSessionId)
  const active = latestEffective(
    transitions,
    (transition) => transition.effectiveFromStep,
    atStep,
  )
  const policyState: PolicyStateView = active
    ? active.state
    : { stateId: DEFAULT_POLICY_STATE_ID }

  const records = store.listRecords(teamSessionId)
  const templateOverlay = assembleOverlay(records, MUTATION_RECORD_KINDS.TEMPLATE_OVERLAY, atStep)
  const instanceOverlay = assembleOverlay(
    records,
    MUTATION_RECORD_KINDS.INSTANCE_OVERLAY,
    atStep,
    member.instanceId,
  )
  const humanOverride = assembleHumanOverride(records, member.instanceId, atStep)

  return {
    teamSessionId,
    member,
    blueprint,
    template,
    policyState,
    templateOverlay,
    instanceOverlay,
    humanOverride,
    external,
  }
}

// ---------------------------------------------------------------------------
// Record selection (pure helpers, shared with the service)
// ---------------------------------------------------------------------------

/** The latest record effective at `atStep` (last in admission order). */
export function latestEffective<T extends { readonly effectiveFromStep: number }>(
  records: readonly T[],
  effectiveFromStepOf: (record: T) => number,
  atStep: number,
): T | undefined {
  let found: T | undefined
  for (const record of records) {
    if (effectiveFromStepOf(record) <= atStep) found = record
  }
  return found
}

/**
 * Assemble the frozen {@link AutonomyOverlayRecord} for one slot from the
 * store's durable records: per capability, the latest record of the slot
 * effective at `atStep`; `undefined` when no record of the slot is
 * effective. `instanceId` restricts the slot to one instance (the
 * instance overlay); `undefined` keeps the team-scoped slot.
 */
export function assembleOverlay(
  records: readonly StoredMutationRecord[],
  kind: MutationRecordKind,
  atStep: number,
  instanceId?: InstanceId,
): AutonomyOverlayRecord | undefined {
  const values: Partial<Record<CapabilityName, PolicyEntry>> = {}
  let latestRecord: StoredMutationRecord | undefined
  for (const record of records) {
    if (record.kind !== kind || record.effectiveFromStep > atStep) continue
    if (instanceId !== undefined && record.member?.instanceId !== instanceId) continue
    let contributed = false
    for (const capability of Object.keys(record.values) as CapabilityName[]) {
      const entry = record.values[capability]
      if (entry !== undefined) {
        values[capability] = entry
        contributed = true
      }
    }
    if (contributed) latestRecord = record
  }
  if (latestRecord === undefined) return undefined
  return {
    overlayId: latestRecord.recordId,
    kind: kind === MUTATION_RECORD_KINDS.TEMPLATE_OVERLAY ? 'template' : 'instance',
    origin: assertOverlayOrigin(latestRecord.origin),
    values,
  }
}

/** Overlay records are agent-origin only (the frozen {@link OverlayOrigin}). */
function assertOverlayOrigin(origin: TeamValueOrigin): OverlayOrigin {
  if (origin === 'leader' || origin === 'member') return origin
  throw new Error(
    `policy-adapter: overlay records are agent-origin only (invariant violation, got '${origin}')`,
  )
}

/**
 * Assemble the frozen {@link HumanOverrideRecord} for one member from the
 * store's durable records: per capability, the latest instance-scoped
 * record of the member effective at `atStep` when present, else the
 * latest team-scoped record (the frozen caller-selection rule). The
 * assembled `scope` is `'instance'` when any instance-scoped record won a
 * capability, else `'team'`; the id is the latest contributing durable
 * record (last in admission order).
 */
export function assembleHumanOverride(
  records: readonly StoredMutationRecord[],
  instanceId: InstanceId,
  atStep: number,
): HumanOverrideRecord | undefined {
  // Per scope, last write in admission order wins per capability
  // (admission order is monotone in requestedAtStep within one service
  // lifetime, so "last admitted" is "latest").
  const teamWinners = new Map<CapabilityName, StoredMutationRecord>()
  const instanceWinners = new Map<CapabilityName, StoredMutationRecord>()
  for (const record of records) {
    if (record.kind !== MUTATION_RECORD_KINDS.HUMAN_OVERRIDE || record.effectiveFromStep > atStep) continue
    const capabilities = Object.keys(record.values) as CapabilityName[]
    if (record.scope === 'instance') {
      if (record.member?.instanceId !== instanceId) continue
      for (const capability of capabilities) {
        if (record.values[capability] !== undefined) {
          instanceWinners.set(capability, record)
        }
      }
    } else {
      for (const capability of capabilities) {
        if (record.values[capability] !== undefined) {
          teamWinners.set(capability, record)
        }
      }
    }
  }
  // Instance-scoped wins per capability (frozen selection rule).
  const winners = new Map<CapabilityName, StoredMutationRecord>(teamWinners)
  for (const [capability, record] of instanceWinners) winners.set(capability, record)
  if (winners.size === 0) return undefined

  const values: Partial<Record<CapabilityName, PolicyEntry>> = {}
  for (const [capability, record] of winners) {
    values[capability] = record.values[capability]
  }
  const winnerIds = new Set<string>()
  for (const record of winners.values()) winnerIds.add(record.recordId)
  let latestRecord: StoredMutationRecord | undefined
  for (const record of records) {
    if (winnerIds.has(record.recordId)) latestRecord = record
  }
  return {
    overrideId: latestRecord?.recordId ?? '',
    scope: instanceWinners.size > 0 ? 'instance' : 'team',
    values,
  }
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * The policy-state transition selection (exported for the service's
 * suppression bookkeeping and for tests).
 */
export function activePolicyState(
  transitions: readonly PolicyStateTransitionRecord[],
  atStep: number,
): PolicyStateView {
  const active = latestEffective(
    transitions,
    (transition) => transition.effectiveFromStep,
    atStep,
  )
  return active ? active.state : { stateId: DEFAULT_POLICY_STATE_ID }
}
