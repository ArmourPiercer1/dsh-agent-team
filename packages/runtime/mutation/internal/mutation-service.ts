/**
 * pre-alpha3 PR-F (plan §F.2) — the TEST-WORLD mutation service kernel
 * (internal): the P7-T2 future-boundary mutation state machine, RETIRED
 * from the production authority by pre-alpha3 PR-A (the production
 * writer is {@link @dsh-agent-team/runtime/governance}) and pulled OFF
 * the public module surface by PR-F — it is the direct test seam of the
 * P7-T2 test family (p7t2-*) and of the legacy integrated admission
 * world (p7t7) only.
 *
 * This is NOT a production code path: no production module imports it
 * (the zero-core / p6t6 scans treat it as a test-world kernel). The
 * pure kernels it composes (`normalizePolicyEntry`, `normalizeStateView`,
 * `checkExternalHardFacts` from {@link ../service.js} and the frozen
 * P3-T4 resolver) stay on the production path, shared with the
 * governance authority — ONE vocabulary, no duplicate assembly.
 *
 * What lives here (moved from the former public surface, unchanged):
 *
 * - {@link StepClock} — the step-boundary clock port (test-world driver;
 *   the production step clock was retired as a decision source by PR-B,
 *   pinned 0/1);
 * - {@link MutationService} — the frozen "Runtime mutation" state
 *   machine over its injected ports (future-boundary mutation,
 *   escalation intake, external hard facts, PolicyState transitions,
 *   creation fields, provenance-carrying resolution);
 * - the structural intake validators + the frozen-error mapper it needs.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 *
 * @module @dsh-agent-team/runtime/mutation/internal/mutation-service
 */

import {
  assertMemberIdentityInTeam,
  CAPABILITY_NAME_VALUES,
  createMemberIdentity,
  deepFreeze,
  parseInstanceId,
  parseRootSessionId,
  parseTeamSessionId,
  PolicyResolutionError,
  POLICY_ERROR_CODES,
  resolveEffectivePolicy,
} from '../../../domain/policy/src/index.js'
import type {
  CapabilityName,
  EffectivePolicy,
  InstanceId,
  MemberIdentity,
  PolicyEntry,
  RootSessionId,
  SuppressedOverlayRecord,
  TeamSessionId,
  TeamValueOrigin,
} from '../../../domain/policy/src/index.js'
import { assembleEffectivePolicyInput } from './policy-adapter.js'
import { MutationError, MUTATION_ERROR_CODES } from '../errors.js'
import {
  checkExternalHardFacts,
  normalizePolicyEntry,
  normalizeStateView,
} from '../service.js'
import {
  checkAgainstEnvelope,
  memberEnvelopeItems,
  teamEnvelopeItems,
} from '../envelope.js'
import { MUTATION_RECORD_KINDS } from '../types.js'
import type {
  CreationFieldMutationRequest,
  EffectiveConfigCapture,
  EffectiveConfiguration,
  MutationLedgerEntry,
  MutationRequest,
  MutationStore,
  PolicyReader,
  PolicyStateTransitionRecord,
  PolicyStateTransitionRequest,
  StoredMutationRecord,
} from '../types.js'

/**
 * The STEP-BOUNDARY clock (moved here from the public `types.ts` by
 * PR-F): the mutation plane never advances it (steps are driven by the
 * harness / admission pipeline); it only reads it. `0` = before the
 * first step. The PRODUCTION step clock was retired as a decision
 * source by pre-alpha3 PR-B (pinned 0/1) — this port drives the
 * test-world kernel only.
 */
export interface StepClock {
  /** The step currently in progress (0 before the first step). */
  currentStep(): number
}

/** The dependency bag of one {@link MutationService} (all ports injected). */
export interface MutationServiceDeps {
  readonly clock: StepClock
  readonly store: MutationStore
  readonly policy: PolicyReader
  /** Custom id minting for durable records/ledger entries (defaults to a
   *  deterministic per-service counter). */
  readonly newRecordId?: (kind: 'mutation' | 'ledger' | 'transition') => string
}

/**
 * The runtime mutation service of one TeamSession group. Stateless with
 * respect to the ports (all durable state lives in the store); the only
 * service-local state is the in-flight capture set (diagnostic) and the
 * default id counter.
 */
export class MutationService {
  private readonly deps: MutationServiceDeps
  private idCounter: number
  private readonly inflight: Set<EffectiveConfigCapture>

  constructor(deps: MutationServiceDeps) {
    this.deps = deps
    this.idCounter = 0
    this.inflight = new Set<EffectiveConfigCapture>()
  }

  /** The number of in-flight (unreleased) step captures (diagnostic). */
  inflightCount(): number {
    return this.inflight.size
  }

  // -------------------------------------------------------------------------
  // Capability mutations (model / tools / permissions / skills / mcp)
  // -------------------------------------------------------------------------

  /**
   * Admit one capability mutation request (future-boundary). See the
   * module doc for the intake pipeline. Returns the durable record.
   *
   * @throws {@link MutationError} — `MALFORMED_MUTATION_INPUT` (request
   *   shape / stored facts), `IDENTITY_SCOPE_MISMATCH` (cross-team
   *   member), `EXTERNAL_HARD_REJECTED` (beyond the external hard facts,
   *   every origin), `MEMBER_SELF_ESCALATION` /
   *   `LEADER_OUT_OF_ENVELOPE` (agent origin beyond the autonomy
   *   envelope).
   */
  requestMutation(request: MutationRequest): StoredMutationRecord {
    const teamSessionId = assertTeamSessionId(request.teamSessionId)
    const capability = assertCapability(request.capability)
    const value = normalizePolicyEntry(request.value, 'value')
    const actor = assertActorKind(request.actor.kind)

    // Scope / target selection (closed by actor kind — see the types doc).
    let scope: 'team' | 'instance'
    let recordMember: MemberIdentity | undefined
    if (actor === 'human') {
      scope = request.scope ?? 'team'
      if (scope !== 'team' && scope !== 'instance') {
        throw new MutationError(
          MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
          `malformed mutation input at actor.scope: must be 'team' or 'instance' (got '${String(request.scope)}')`,
          { field: 'actor.scope' },
        )
      }
      if (scope === 'instance') {
        recordMember = assertMemberInTeam(request.targetMember, teamSessionId, 'targetMember')
      } else if (request.targetMember !== undefined) {
        throw new MutationError(
          MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
          "malformed mutation input at targetMember: team-scoped human overrides carry no target",
          { field: 'targetMember' },
        )
      }
    } else {
      scope = actor === 'leader' ? 'team' : 'instance'
      if (request.scope !== undefined) {
        throw new MutationError(
          MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
          `malformed mutation input at actor.scope: scope is fixed by the actor kind for origin '${actor}'`,
          { field: 'actor.scope', origin: actor },
        )
      }
      if (request.targetMember !== undefined) {
        throw new MutationError(
          MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
          'malformed mutation input at targetMember: only instance-scoped human overrides carry a target',
          { field: 'targetMember', origin: actor },
        )
      }
      if (actor === 'member') {
        recordMember = assertMemberInTeam(request.actor.member, teamSessionId, 'actor.member')
      }
    }
    // External hard facts: EVERY origin (invariant 35; §19.5 — the human
    // override cannot bypass them either).
    this.checkExternalHard(teamSessionId, capability, value)

    // Team autonomy envelope: AGENT origins only (invariants 36/37).
    if (actor !== 'human') {
      const blueprint = this.deps.policy.readBlueprintEnvelope(teamSessionId)
      const origin: TeamValueOrigin = actor
      if (actor === 'member') {
        const recordIdentity = recordMember
        if (recordIdentity === undefined) {
          // Unreachable (assigned above for member origin) 鈥?defensive invariant.
          throw new MutationError(
            MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
            'malformed mutation input: member origin requires a validated member identity',
            { field: 'actor.member' },
          )
        }
        const template = this.deps.policy.readTemplatePolicy(teamSessionId, recordIdentity)
        const envelope = memberEnvelopeItems(teamSessionId, recordIdentity, blueprint, template)
        checkAgainstEnvelope(capability, value, envelope, origin)
      } else {
        const members = this.registeredMembers(teamSessionId)
        const envelope = teamEnvelopeItems(
          teamSessionId,
          members,
          blueprint,
          (team, member) => this.deps.policy.readTemplatePolicy(team, member),
        )
        checkAgainstEnvelope(capability, value, envelope, origin)
      }
    }

    const kind =
      actor === 'leader'
        ? MUTATION_RECORD_KINDS.TEMPLATE_OVERLAY
        : actor === 'member'
          ? MUTATION_RECORD_KINDS.INSTANCE_OVERLAY
          : MUTATION_RECORD_KINDS.HUMAN_OVERRIDE
    const requestedAtStep = this.deps.clock.currentStep()
    const values: Partial<Record<CapabilityName, PolicyEntry>> = {}
    values[capability] = value
    const record: StoredMutationRecord = deepFreeze({
      recordId: this.mintId('mutation'),
      kind,
      scope,
      // null — never undefined: the record is deep-frozen (lossless JSON).
      member: recordMember ?? null,
      origin: actor,
      values,
      requestedAtStep,
      effectiveFromStep: requestedAtStep + 1,
    })
    this.deps.store.appendRecord(teamSessionId, record)
    this.appendLedger({
      teamSessionId,
      capability,
      recordKind: kind,
      origin: actor,
      value,
      recordId: record.recordId,
      requestedAtStep,
      effectiveFromStep: record.effectiveFromStep,
    })
    return record
  }

  // -------------------------------------------------------------------------
  // PolicyState transitions (§20.4, invariant 40)
  // -------------------------------------------------------------------------

  /**
   * Admit one explicit PolicyState transition (future-boundary). Only
   * explicit human / authorized-leader actors are authorized
   * (`UNAUTHORIZED_TRANSITION` otherwise). The target state is validated
   * with the same structural rules the frozen resolver applies (closed
   * capability keys; cell = `{locked?, value?}` only).
   */
  switchPolicyState(request: PolicyStateTransitionRequest): PolicyStateTransitionRecord {
    const teamSessionId = assertTeamSessionId(request.teamSessionId)
    const actor = assertActorKind(request.actor.kind)
    if (actor === 'member') {
      throw new MutationError(
        MUTATION_ERROR_CODES.UNAUTHORIZED_TRANSITION,
        'a PolicyState transition by an ordinary member is unauthorized (only explicit human / authorized-leader transitions exist, invariant 40)',
        { allowedActors: ['human', 'leader'] },
      )
    }
    if (request.actor.member !== undefined) {
      throw new MutationError(
        MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
        'malformed transition request: transition actors are TeamSession-level (no member)',
        { field: 'actor.member' },
      )
    }
    const state = normalizeStateView(request.target, 'target')
    const requestedAtStep = this.deps.clock.currentStep()
    const entryId = this.mintId('ledger')
    const transition: PolicyStateTransitionRecord = deepFreeze({
      entryId,
      origin: actor,
      state,
      requestedAtStep,
      effectiveFromStep: requestedAtStep + 1,
    })
    this.deps.store.appendTransition(teamSessionId, transition)
    this.appendLedger({
      teamSessionId,
      recordKind: 'policyStateTransition',
      origin: actor,
      stateId: state.stateId,
      requestedAtStep,
      effectiveFromStep: transition.effectiveFromStep,
    })
    return transition
  }

  // -------------------------------------------------------------------------
  // Creation fields (§21.2 / §21.6)
  // -------------------------------------------------------------------------

  /**
   * Register the creation fields of a MemberInstance (once). Records the
   * `workspace` (mutable until first RUNNING, §21.2) and the
   * `contextPolicy` (immutable from this moment, §21.6), and starts their
   * provenance ledger entries.
   */
  registerInstance(
    teamSessionId: TeamSessionId,
    member: MemberIdentity,
    fields: { readonly workspace: string; readonly contextPolicy: string },
  ): void {
    const team = assertTeamSessionId(teamSessionId)
    const identity = assertMemberInTeam(member, team, 'member')
    const workspace = assertCreationFieldValue(fields.workspace, 'workspace')
    const contextPolicy = assertCreationFieldValue(fields.contextPolicy, 'contextPolicy')
    if (this.deps.store.getCreationFields(team, identity.instanceId) !== undefined) {
      throw new MutationError(
        MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
        `malformed registration: instance '${identity.instanceId}' already has registered creation fields`,
        { field: 'instance', instanceId: identity.instanceId },
      )
    }
    this.deps.store.registerCreationFields(team, identity, { workspace, contextPolicy })
    const step = this.deps.clock.currentStep()
    for (const [field, fieldValue] of [
      ['workspace', workspace],
      ['contextPolicy', contextPolicy],
    ] as const) {
      this.appendLedger({
        teamSessionId: team,
        recordKind: 'creationField',
        origin: 'static',
        field,
        instanceId: identity.instanceId,
        fieldValue,
        requestedAtStep: step,
        effectiveFromStep: step + 1,
      })
    }
  }

  /**
   * Request a post-creation change of a creation field. `contextPolicy`
   * is ALWAYS rejected (`IMMUTABLE_CREATION_FIELD`, §21.6); `workspace`
   * is admitted only BEFORE the instance's first RUNNING (§21.2) and
   * rejected after. An unregistered instance is `UNKNOWN_INSTANCE`.
   */
  requestCreationFieldMutation(request: CreationFieldMutationRequest): void {
    const team = assertTeamSessionId(request.teamSessionId)
    const identity = assertMemberInTeam(request.member, team, 'member')
    const field = assertCreationField(request.field)
    const value = assertCreationFieldValue(request.value, 'value')
    if (this.deps.store.getCreationFields(team, identity.instanceId) === undefined) {
      throw new MutationError(
        MUTATION_ERROR_CODES.UNKNOWN_INSTANCE,
        `instance '${identity.instanceId}' has no registered creation fields in TeamSession '${team}'`,
        { instanceId: identity.instanceId },
      )
    }
    if (field === 'contextPolicy') {
      throw new MutationError(
        MUTATION_ERROR_CODES.IMMUTABLE_CREATION_FIELD,
        'contextPolicy is immutable from MemberInstance creation (§21.6)',
        { field, rule: 'immutableAfterCreation', instanceId: identity.instanceId },
      )
    }
    if (this.deps.store.isRunning(team, identity.instanceId)) {
      throw new MutationError(
        MUTATION_ERROR_CODES.IMMUTABLE_CREATION_FIELD,
        'workspace is immutable after the instance first reached RUNNING (§21.2)',
        { field, rule: 'immutableAfterFirstRunning', instanceId: identity.instanceId },
      )
    }
    this.deps.store.setWorkspace(team, identity.instanceId, value)
    const step = this.deps.clock.currentStep()
    this.appendLedger({
      teamSessionId: team,
      recordKind: 'creationField',
      origin: 'static',
      field,
      instanceId: identity.instanceId,
      fieldValue: value,
      requestedAtStep: step,
      effectiveFromStep: step + 1,
    })
  }

  // -------------------------------------------------------------------------
  // Step boundary: in-flight capture + resolution
  // -------------------------------------------------------------------------

  /**
   * Begin one step of one member: mark first RUNNING (locks the
   * workspace, §21.2) and capture the effective configuration at the
   * step boundary. The capture is a frozen value — later mutations never
   * reach in-flight work (the DevPlan §20.2 future-boundary contract);
   * `release()` settles the step.
   *
   * @throws {@link MutationError} `UNKNOWN_INSTANCE` when the instance
   *   has no registered creation fields.
   */
  beginStep(member: MemberIdentity): EffectiveConfigCapture {
    const identity = assertMemberIdentity(member, 'member')
    const team = identity.rootSessionId
    if (this.deps.store.getCreationFields(team, identity.instanceId) === undefined) {
      throw new MutationError(
        MUTATION_ERROR_CODES.UNKNOWN_INSTANCE,
        `instance '${identity.instanceId}' has no registered creation fields (register the instance before its first step)`,
        { instanceId: identity.instanceId },
      )
    }
    this.deps.store.markRunning(team, identity.instanceId)
    const step = this.deps.clock.currentStep()
    const config = this.resolveEffective(team, identity, step)
    const inflight = this.inflight
    const capture: EffectiveConfigCapture = {
      teamSessionId: team,
      member: identity,
      step,
      policy: config.policy,
      contributions: config.contributions,
      release: () => {
        inflight.delete(capture)
      },
    }
    inflight.add(capture)
    return capture
  }

  /**
   * Resolve the EFFECTIVE CONFIGURATION of one member at one step (the
   * current step by default): the frozen resolver's fully-explained
   * `EffectivePolicy` + this module's source chain (every provenance
   * ledger entry effective at the step) + the stored-but-suppressed
   * overlays (new suppressions are recorded in the store here, lazily —
   * non-destructive, §19.4).
   *
   * @throws {@link MutationError} — the frozen resolver's typed errors
   *   mapped onto this module's closed surface (escalation / identity /
   *   malformed), plus the intake codes above.
   */
  resolveEffective(
    teamSessionId: TeamSessionId,
    member: MemberIdentity,
    atStep?: number,
  ): EffectiveConfiguration {
    const team = assertTeamSessionId(teamSessionId)
    const identity = assertMemberInTeam(member, team, 'member')
    if (atStep !== undefined && (!Number.isInteger(atStep) || atStep < 0)) {
      throw new MutationError(
        MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
        `malformed resolve input at atStep: must be a non-negative integer (got ${String(atStep)})`,
        { field: 'atStep' },
      )
    }
    const step = atStep ?? this.deps.clock.currentStep()
    const input = assembleEffectivePolicyInput({
      teamSessionId: team,
      member: identity,
      atStep: step,
      store: this.deps.store,
      policy: this.deps.policy,
    })
    let policy: EffectivePolicy
    try {
      policy = resolveEffectivePolicy(input)
    } catch (error) {
      throw mapFrozenError(error, 'resolve')
    }
    this.recordSuppressions(team, step, policy.suppressed)
    const contributions = this.deps.store
      .listLedger(team)
      .filter((entry) => entry.effectiveFromStep <= step)
    return deepFreeze({
      teamSessionId: team,
      member: identity,
      step,
      policy,
      contributions,
      suppressed: policy.suppressed,
    })
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private mintId(kind: 'mutation' | 'ledger' | 'transition'): string {
    const custom = this.deps.newRecordId
    if (custom !== undefined) return custom(kind)
    this.idCounter += 1
    return `p7t2-${kind}-${this.idCounter}`
  }

  private appendLedger(
    fields: Omit<MutationLedgerEntry, 'entryId'>,
  ): MutationLedgerEntry {
    const entry: MutationLedgerEntry = deepFreeze({
      entryId: this.mintId('ledger'),
      ...fields,
    })
    this.deps.store.appendLedger(entry.teamSessionId, entry)
    return entry
  }

  private registeredMembers(teamSessionId: TeamSessionId): MemberIdentity[] {
    const members: MemberIdentity[] = []
    for (const rawId of this.deps.store.listInstances(teamSessionId)) {
      try {
        const instanceId = parseInstanceId(rawId)
        members.push(createMemberIdentity(teamSessionId, instanceId))
      } catch (error) {
        throw mapFrozenError(error, 'envelope')
      }
    }
    return members
  }

  /** The external hard facts check (every origin; see the module doc). */
  private checkExternalHard(
    teamSessionId: TeamSessionId,
    capability: CapabilityName,
    value: PolicyEntry,
  ): void {
    checkExternalHardFacts(
      teamSessionId,
      capability,
      value,
      this.deps.policy.readExternalFacts(teamSessionId),
    )
  }

  /**
   * Record the fresh suppressions of one resolution (lazy, §19.4):
   * deduplicated on (capability, layer, policyStateId) against the store's
   * existing suppression trail; `recordedAtStep` = this step. The key is
   * the overlay LAYER (not the slot's `overlayId`) because a slot's id is
   * the latest contributing durable record overall and therefore changes
   * whenever a new record joins the slot — deduping on the slot id would
   * re-record the same logical suppression once per id drift. The
   * recorded record keeps the slot id it had at first recording.
   */
  private recordSuppressions(
    teamSessionId: TeamSessionId,
    step: number,
    suppressed: readonly SuppressedOverlayRecord[],
  ): void {
    const seen = new Set<string>()
    for (const existing of this.deps.store.listSuppressions(teamSessionId)) {
      seen.add(`${existing.capability}|${existing.layer}|${existing.policyStateId}`)
    }
    for (const record of suppressed) {
      const key = `${record.capability}|${record.layer}|${record.policyStateId}`
      if (seen.has(key)) continue
      seen.add(key)
      this.deps.store.appendSuppression(
        teamSessionId,
        deepFreeze({ ...record, recordedAtStep: step }),
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Structural validation (the intake boundary; mirrors the frozen domain's
// rules — closed sets, exact field shapes — under this module's error code)
// ---------------------------------------------------------------------------

/** Assert `raw` is a valid TeamSessionId (invariant 9: = RootSessionId). */
function assertTeamSessionId(raw: unknown): TeamSessionId {
  try {
    return parseTeamSessionId(raw)
  } catch (error) {
    return mapToMalformed(error, 'teamSessionId')
  }
}

/** Assert `raw` is one of the CLOSED five capability domains. */
function assertCapability(raw: unknown): CapabilityName {
  if (typeof raw !== 'string' || !(CAPABILITY_NAME_VALUES as readonly string[]).includes(raw)) {
    throw new MutationError(
      MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
      `malformed mutation input at capability: unknown capability '${String(raw)}' (closed set: ${CAPABILITY_NAME_VALUES.join(', ')})`,
      { field: 'capability', value: raw },
    )
  }
  return raw as CapabilityName
}

/** Assert `raw` is a closed mutation-actor kind. */
function assertActorKind(raw: unknown): 'human' | 'leader' | 'member' {
  if (raw !== 'human' && raw !== 'leader' && raw !== 'member') {
    throw new MutationError(
      MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
      `malformed mutation input at actor.kind: unknown actor kind '${String(raw)}' (closed set: human, leader, member)`,
      { field: 'actor.kind', value: raw },
    )
  }
  return raw
}

/** Assert `raw` is a valid in-team member identity (invariant 18). */
function assertMemberInTeam(
  raw: unknown,
  teamSessionId: TeamSessionId,
  field: string,
): MemberIdentity {
  const identity = assertMemberIdentity(raw, field)
  try {
    assertMemberIdentityInTeam(identity, teamSessionId)
  } catch (error) {
    throw mapFrozenError(error, field)
  }
  return identity
}

/** Assert `raw` is a structurally valid member identity (no team check). */
function assertMemberIdentity(raw: unknown, field: string): MemberIdentity {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new MutationError(
      MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
      `malformed mutation input at ${field}: must be a member identity {rootSessionId, instanceId}`,
      { field, problem: 'not a record' },
    )
  }
  const record = raw as Record<string, unknown>
  let rootSessionId: RootSessionId
  let instanceId: InstanceId
  try {
    rootSessionId = parseRootSessionId(record['rootSessionId'])
    instanceId = parseInstanceId(record['instanceId'])
  } catch (error) {
    throw mapToMalformed(error, field)
  }
  return createMemberIdentity(rootSessionId, instanceId)
}

/** Assert `raw` is a closed creation-field name. */
function assertCreationField(raw: unknown): 'workspace' | 'contextPolicy' {
  if (raw !== 'workspace' && raw !== 'contextPolicy') {
    throw new MutationError(
      MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
      `malformed mutation input at field: unknown creation field '${String(raw)}' (closed set: workspace, contextPolicy)`,
      { field: 'field', value: raw },
    )
  }
  return raw
}

/** Assert a creation-field string value (non-empty, ≤ 255, no control chars). */
function assertCreationFieldValue(raw: unknown, field: string): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 255) {
    throw new MutationError(
      MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
      `malformed mutation input at ${field}: must be a non-empty string of at most 255 characters`,
      { field },
    )
  }
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    if (code < 0x20 || code === 0x7f) {
      throw new MutationError(
        MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
        `malformed mutation input at ${field}: must not contain control characters`,
        { field },
      )
    }
  }
  return raw
}

// Frozen-error mapping (the closed error surface)
// ---------------------------------------------------------------------------

/**
 * Map a frozen-domain {@link PolicyResolutionError} onto this module's
 * closed surface, preserving the code strings that belong to both
 * vocabularies (identity / escalation) verbatim and translating the
 * structural code. Non-policy errors become `MALFORMED_MUTATION_INPUT`.
 */
export function mapFrozenError(error: unknown, stage: string): MutationError {
  if (error instanceof PolicyResolutionError) {
    const details: Record<string, unknown> = { stage, ...error.details }
    switch (error.code) {
      case POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH:
        return new MutationError(MUTATION_ERROR_CODES.IDENTITY_SCOPE_MISMATCH, error.message, details)
      case POLICY_ERROR_CODES.MEMBER_SELF_ESCALATION:
        return new MutationError(MUTATION_ERROR_CODES.MEMBER_SELF_ESCALATION, error.message, details)
      case POLICY_ERROR_CODES.LEADER_OUT_OF_ENVELOPE:
        return new MutationError(MUTATION_ERROR_CODES.LEADER_OUT_OF_ENVELOPE, error.message, details)
      case POLICY_ERROR_CODES.MALFORMED_POLICY_INPUT:
        return new MutationError(MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT, error.message, details)
    }
  }
  return new MutationError(
    MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
    error instanceof Error ? error.message : String(error),
    { stage, problem: 'unexpected non-policy error' },
  )
}

/** Map a frozen identity-parse failure to this module's structural code. */
function mapToMalformed(error: unknown, field: string): never {
  if (error instanceof PolicyResolutionError && error.code === POLICY_ERROR_CODES.IDENTITY_SCOPE_MISMATCH) {
    throw new MutationError(
      MUTATION_ERROR_CODES.IDENTITY_SCOPE_MISMATCH,
      error.message,
      { field, ...error.details },
    )
  }
  throw new MutationError(
    MUTATION_ERROR_CODES.MALFORMED_MUTATION_INPUT,
    error instanceof Error ? error.message : String(error),
    { field, problem: 'identity parse failure' },
  )
}
