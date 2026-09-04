/**
 * ActivationProvider admission checks — steps 1–11 of the DevPlan §19.2
 * order (TaskDoc §11.7 P6-T1).
 *
 * Every function in this module is READ-ONLY over the durable TeamDomain
 * state (invariant 41) and the injected inputs: no durable write may happen
 * before the journal reservation (step 12). A failure of any step in this
 * module therefore leaves ZERO durable writes (the fail-closed contract of
 * the provider; asserted by the P6-T1 tests over a recording proxy).
 *
 * The functions are individually testable pure-ish seams (they take their
 * repositories/catalog explicitly); the provider composes them in the frozen
 * order:
 *
 *   1  resolve TeamSession (team-root binding + TeamSession record)
 *   2  resolve immutable Blueprint (catalog resolve + content-hash equality)
 *   3  resolve member template
 *   4  caller authority (closed source rules)
 *   5  admission (closed source vocabulary)
 *   6  compatibility (blueprint requirements vs environment facts)
 *   7  quota (committed + in-flight reservations vs blueprint quotas)
 *   8  policy (effective policy resolution with durable overlays)
 *   9  overlay bounds (team ∩ template mutation envelopes)
 *   10 workspace/context creation fields (frozen at creation, invariant 29)
 *   11 allocate instanceId (deterministic, collision-checked; durably
 *      reserved by the journal PREPARED row in step 12)
 *
 * No `node:` builtins, no I/O, no live references.
 * @module @dsh-agent-team/runtime/activation/checks
 */

import {
  LEADER_INSTANCE_ID,
  parseInstanceId,
  parseRootSessionId,
  teamSessionIdOf,
  createMemberIdentity,
} from '../../contracts/src/index.js'
import {
  GROUP_ID_MAX_LENGTH,
  LABEL_MAX_LENGTH,
  parseLabelLikeField,
  parseWorkspaceField,
} from '../../contracts/src/dto/common.js'
import type {
  MemberInstanceRecordDto,
  TeamSessionRecordDto,
} from '../../contracts/src/index.js'
import type {
  BlueprintCatalog,
  QuotaSpec,
  TeamBlueprint,
} from '../../domain/blueprint/src/index.js'
import type {
  CompatibilityResult,
  EnvironmentFact,
  RequirementInput,
  RequirementType,
  WarningAcknowledgement,
} from '../../domain/compatibility/src/index.js'
import {
  COMPATIBILITY_STATUS,
  evaluateCompatibility,
} from '../../domain/compatibility/src/index.js'
import {
  DEFAULT_CONTEXT_POLICY,
  isContextPolicy,
  CONTEXT_POLICIES,
} from '../../domain/member/src/index.js'
import type { ContextPolicy } from '../../domain/member/src/index.js'
import {
  CAPABILITY_NAME_VALUES,
  DEFAULT_POLICY_STATE_ID,
  resolveEffectivePolicy,
} from '../../domain/policy/src/index.js'
import type {
  AutonomyOverlayRecord,
  EffectivePolicy,
  ExternalPolicyFacts,
  HumanOverrideRecord,
  PolicyEntry,
} from '../../domain/policy/src/index.js'
import {
  PROVISION_INTENT_TYPE,
} from '../../storage/provisioning/index.js'
import {
  OPERATION_PHASES,
} from '../../storage/schema/index.js'
import type {
  GovernanceOverrideRecord,
  OperationRecord,
} from '../../storage/schema/index.js'
import type { TeamDomainRepositories } from '../../storage/repositories/index.js'
import {
  ACTIVATION_ERROR_CODES,
  ActivationError,
} from './errors.js'
import {
  allocateActivationInstanceId,
} from './identity.js'
import type {
  ActivationSource,
  MemberActivationRequest,
} from './types.js'
import { ACTIVATION_SOURCES } from './types.js'

// --- step 1: TeamSession ----------------------------------------------------------

/**
 * Step 1 — resolve the TeamSession: the root must carry a `team-root`
 * session binding AND a durable TeamSession record (invariant 9: the root
 * session id IS the TeamSessionId).
 *
 * @param repositories - the TeamDomain repositories (read-only use).
 * @param rootSessionId - the root DSH session id.
 * @returns the durable TeamSession record.
 * @throws {@link ActivationError} `ACTIVATION_TEAM_SESSION_NOT_FOUND`.
 */
export function resolveTeamSession(
  repositories: TeamDomainRepositories,
  rootSessionId: string,
): TeamSessionRecordDto {
  const root = parseRootSessionId(rootSessionId)
  const binding = repositories.sessionBindings.get(root)
  if (binding === undefined || binding.kind !== 'team-root') {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
      `activation: session '${root}' has no team-root binding (not a TeamSession)`,
      { rootSessionId: root },
    )
  }
  const teamSession = repositories.teamSessions.get(root)
  if (teamSession === undefined) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
      `activation: no TeamSession record for root session '${root}'`,
      { rootSessionId: root },
    )
  }
  return teamSession
}

// --- step 2: immutable Blueprint ---------------------------------------------------

/** The resolved immutable blueprint of one TeamSession (step 2 output). */
export interface ResolvedBoundBlueprint {
  /** The validated, deeply-frozen blueprint. */
  readonly blueprint: TeamBlueprint
  /** The bound snapshot ref (blueprintId + revision + contentHash). */
  readonly blueprintId: string
  readonly revision: string
  readonly contentHash: string
}

/**
 * Step 2 — resolve the IMMUTABLE blueprint bound to the TeamSession:
 * `catalog.resolve(blueprintId, revision)` plus the content-hash equality
 * against the bound snapshot ref (the snapshot is immutable: a hash
 * mismatch is a durable-state corruption, not a re-resolvable drift).
 *
 * @param catalog - the immutable blueprint catalog.
 * @param teamSession - the TeamSession record (carries the bound ref).
 * @returns the resolved blueprint and its bound snapshot identity.
 * @throws {@link ActivationError} `ACTIVATION_BLUEPRINT_UNRESOLVED` (the
 *   catalog cannot resolve the bound revision) or
 *   `ACTIVATION_BLUEPRINT_HASH_MISMATCH` (the resolved content hash differs
 *   from the bound ref).
 */
export function resolveBoundBlueprint(
  catalog: BlueprintCatalog,
  teamSession: TeamSessionRecordDto,
): ResolvedBoundBlueprint {
  const ref = teamSession.blueprint
  let blueprint: TeamBlueprint
  try {
    blueprint = catalog.resolve(ref.blueprintId, ref.revision)
  } catch (error) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.BLUEPRINT_UNRESOLVED,
      `activation: bound blueprint '${ref.blueprintId}' revision '${ref.revision}' cannot be resolved from the catalog`,
      { blueprintId: ref.blueprintId, revision: ref.revision, cause: String(error) },
    )
  }
  if (blueprint.contentHash !== ref.contentHash) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.BLUEPRINT_HASH_MISMATCH,
      `activation: blueprint '${ref.blueprintId}' revision '${ref.revision}' content hash does not match the bound snapshot ref (the snapshot is immutable)`,
      {
        blueprintId: ref.blueprintId,
        revision: ref.revision,
        boundContentHash: ref.contentHash,
        resolvedContentHash: blueprint.contentHash,
      },
    )
  }
  return {
    blueprint,
    blueprintId: ref.blueprintId,
    revision: ref.revision,
    contentHash: ref.contentHash,
  }
}

// --- step 3: template ----------------------------------------------------------------

/**
 * Step 3 — resolve the member template from the immutable blueprint.
 *
 * @param blueprint - the resolved blueprint.
 * @param templateId - the template to instantiate.
 * @returns the template declaration.
 * @throws {@link ActivationError} `ACTIVATION_TEMPLATE_NOT_FOUND`.
 */
export function resolveTemplate(blueprint: TeamBlueprint, templateId: string) {
  const template = blueprint.members.find((member) => member.templateId === templateId)
  if (template === undefined) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.TEMPLATE_NOT_FOUND,
      `activation: blueprint declares no member template '${templateId}'`,
      { templateId },
    )
  }
  return template
}

// --- step 4: caller authority ----------------------------------------------------------

/**
 * Step 4 — caller authority (closed source rules):
 *
 * - `leader-explicit` / `leader-delegate`: the calling authority must be the
 *   LeaderInstance of the TeamSession (the only agent authority that creates
 *   members); any other/absent caller is denied;
 * - `human-ui`: humans are the team owner — no agent-authority requirement
 *   (the caller id is optional free-form principal data).
 *
 * @param source - the activation source.
 * @param callerId - the calling authority (member instance id for leader
 *   sources; optional principal id for human-ui).
 * @throws {@link ActivationError} `ACTIVATION_CALLER_AUTHORITY_DENIED`.
 */
export function checkCallerAuthority(source: ActivationSource, callerId: string | undefined): void {
  if (source === ACTIVATION_SOURCES.LEADER_EXPLICIT || source === ACTIVATION_SOURCES.LEADER_DELEGATE) {
    if (callerId !== LEADER_INSTANCE_ID) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.CALLER_AUTHORITY_DENIED,
        `activation: source '${source}' requires the LeaderInstance caller (got ${callerId === undefined ? 'absent caller' : `'${callerId}'`})`,
        { source, callerId: callerId ?? null },
      )
    }
    return
  }
  // human-ui: no agent-authority requirement.
}

// --- step 5: admission ------------------------------------------------------------------

/**
 * Step 5 — team-level admission of the activation source (v1 rule: every
 * closed-vocabulary source is admitted; the request validation has already
 * rejected unknown sources). The compatibility engine (step 6) is the
 * environment gate and the binder admission guard (post-commit) is the work
 * gate; this step owns the source-class admission only.
 *
 * @param source - the activation source.
 * @throws {@link ActivationError} `ACTIVATION_SOURCE_NOT_ADMITTED` (a
 *   source outside the closed vocabulary — unreachable after validation,
 *   kept as a loud guard).
 */
export function admitSource(source: ActivationSource): void {
  if (
    source !== ACTIVATION_SOURCES.LEADER_EXPLICIT &&
    source !== ACTIVATION_SOURCES.LEADER_DELEGATE &&
    source !== ACTIVATION_SOURCES.HUMAN_UI
  ) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.SOURCE_NOT_ADMITTED,
      `activation: source '${String(source)}' is not admitted to create new work`,
      { source: String(source) },
    )
  }
}

// --- step 6: compatibility -----------------------------------------------------------------

/**
 * The closed bridge from the blueprint's free lowercase-slug requirement
 * domains to the compatibility engine's closed §27.1 requirement-type
 * vocabulary (the canonical mapping established by the P3-T6 composition
 * pipeline: `tool`→tool, `skill`→skill, `mcp`→mcpServer — extended here to
 * the full closed type set).
 */
export const BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE: Readonly<Record<string, RequirementType>> = {
  tool: 'tool',
  skill: 'skill',
  mcp: 'mcpServer',
  mcpServer: 'mcpServer',
  model: 'modelRoute',
  modelRoute: 'modelRoute',
  persona: 'persona',
  teamStructure: 'teamStructure',
}

/**
 * Map the blueprint's capability requirements to the compatibility engine's
 * typed requirements (step 6 input half).
 *
 * `optional` mapping (documented ruling): a blueprint requirement marked
 * `optional: true` maps to `complete: false` (an unmet optional capability
 * degrades to an ack-able WARNING); a required requirement maps to
 * `complete: true` (an unmet required capability is FATAL — the team must
 * not admit work it cannot structurally do). The `teamStructure` and
 * `persona` types are FATAL at the engine level regardless of `complete`.
 *
 * @param blueprint - the resolved blueprint.
 * @returns the typed requirement inputs (stable order: blueprint order).
 * @throws {@link ActivationError} `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL`
 *   when the blueprint declares a requirement domain outside the closed
 *   bridge (fail loud — an unprobeable requirement cannot be admitted).
 */
export function toActivationRequirements(blueprint: TeamBlueprint): readonly RequirementInput[] {
  const inputs: RequirementInput[] = []
  for (const requirement of blueprint.requirements) {
    const type = BLUEPRINT_DOMAIN_TO_REQUIREMENT_TYPE[requirement.domain]
    if (type === undefined) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL,
        `activation: blueprint requirement domain '${requirement.domain}' is not in the closed probeable-domain bridge (fail loud, Architecture §27.1)`,
        { domain: requirement.domain, name: requirement.name },
      )
    }
    inputs.push(
      deepFreezeLocal({
        requirementId: `req-${requirement.domain}-${requirement.name}`,
        type,
        subjects: [requirement.name],
        complete: requirement.optional !== true,
      }),
    )
  }
  return inputs
}

/** Local deep-freeze helper (avoids a runtime import for a pure value op). */
function deepFreezeLocal<T extends object>(value: T): T {
  return Object.freeze(value)
}

/**
 * Step 6 — compatibility gate (invariant 50: the compatibility gate blocks
 * new-work admission).
 *
 * @param blueprint - the resolved blueprint.
 * @param environmentFacts - the current environment probe facts.
 * @param acknowledgements - optional WARNING acknowledgements (pass-through).
 * @returns the frozen compatibility result (status + per-requirement outcomes).
 * @throws {@link ActivationError} `ACTIVATION_COMPATIBILITY_BLOCKED_FATAL`
 *   (BLOCKED_FATAL, or an unbridgeable requirement domain) or
 *   `ACTIVATION_COMPATIBILITY_BLOCKED_WARNING` (BLOCKED_WARNING:
 *   unacknowledged warnings).
 */
export function evaluateActivationCompatibility(
  blueprint: TeamBlueprint,
  environmentFacts: readonly EnvironmentFact[],
  acknowledgements: readonly WarningAcknowledgement[] | undefined,
): CompatibilityResult {
  const requirements = toActivationRequirements(blueprint)
  const result = evaluateCompatibility({
    requirements,
    environmentFacts,
    ...(acknowledgements !== undefined ? { acknowledgements } : {}),
  })
  if (result.status === COMPATIBILITY_STATUS.BLOCKED_FATAL) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_FATAL,
      `activation: compatibility is BLOCKED_FATAL (${result.counts.fatal} fatal requirement outcome(s))`,
      {
        fingerprint: result.environmentFingerprint,
        requirements: result.requirements.map((requirement) => ({
          requirementId: requirement.requirementId,
          outcome: requirement.outcome,
          reasonCode: requirement.reasonCode,
        })),
      },
    )
  }
  if (result.status === COMPATIBILITY_STATUS.BLOCKED_WARNING) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.COMPATIBILITY_BLOCKED_WARNING,
      `activation: compatibility is BLOCKED_WARNING (${result.counts.unackedWarning} unacknowledged warning(s))`,
      {
        fingerprint: result.environmentFingerprint,
        requirements: result.requirements.map((requirement) => ({
          requirementId: requirement.requirementId,
          outcome: requirement.outcome,
          reasonCode: requirement.reasonCode,
        })),
      },
    )
  }
  // OPEN and DEGRADED_ACKNOWLEDGED admit (the acknowledged degradation is
  // reported through the result's compatibilityStatus channel).
  return result
}

// --- step 7: quota --------------------------------------------------------------------------

/** The durable counting view of one team (step 7 input). */
export interface QuotaCountingView {
  /** Every committed member record of the team (any lifecycle). */
  readonly members: readonly MemberInstanceRecordDto[]
  /** Every durable operation row (all teams; filtered here). */
  readonly operations: readonly OperationRecord[]
}

/** Whether one operation row is an IN-FLIGHT provisioning reservation. */
function isInFlightProvisionOperation(operation: OperationRecord, root: string): boolean {
  if (operation.intent.type !== PROVISION_INTENT_TYPE) return false
  if (operation.phase !== OPERATION_PHASES.PREPARED) return false
  const payload = operation.intent.payload
  return typeof payload['rootSessionId'] === 'string' && payload['rootSessionId'] === root
}

/**
 * The quota counts of one team: committed members plus in-flight (PREPARED,
 * not yet committed) provisioning reservations. In-flight reservations
 * count toward BOTH the instance totals and the concurrent-active quotas:
 * they will commit as CREATED (active) instances, so counting only
 * committed records would let parallel activations over-create (the G6
 * quota-race gate).
 *
 * @param view - the durable counting view.
 * @param rootSessionId - the team (root) session id.
 * @param templateId - the template being instantiated (per-template counts).
 * @returns the counts (team-wide and template-scoped; total and active).
 */
export function countTeamQuota(
  view: QuotaCountingView,
  rootSessionId: string,
  templateId: string,
): {
  readonly teamTotal: number
  readonly teamActive: number
  readonly templateTotal: number
  readonly templateActive: number
} {
  const root = parseRootSessionId(rootSessionId)
  let teamTotal = 0
  let teamActive = 0
  let templateTotal = 0
  let templateActive = 0
  for (const member of view.members) {
    if (member.rootSessionId !== root) continue
    teamTotal += 1
    if (isActiveLifecycle(member.lifecycle)) teamActive += 1
    if (member.templateId === templateId) {
      templateTotal += 1
      if (isActiveLifecycle(member.lifecycle)) templateActive += 1
    }
  }
  for (const operation of view.operations) {
    if (!isInFlightProvisionOperation(operation, root)) continue
    teamTotal += 1
    teamActive += 1
    const payloadTemplate = operation.intent.payload['templateId']
    if (payloadTemplate === templateId) {
      templateTotal += 1
      templateActive += 1
    }
  }
  return { teamTotal, teamActive, templateTotal, templateActive }
}

/** The lifecycle states that count as concurrent-active for the quotas. */
const ACTIVE_LIFECYCLE_STATES: readonly string[] = ['CREATED', 'RUNNING']

function isActiveLifecycle(lifecycle: string): boolean {
  return ACTIVE_LIFECYCLE_STATES.includes(lifecycle)
}

/**
 * Step 7 — quota check against the blueprint's quota spec. An absent quota
 * (or absent bound) is UNLIMITED. The counts include in-flight reservations
 * (see {@link countTeamQuota}).
 *
 * Quota semantics (documented ruling): `quotas.team.maxInstances` = team-
 * wide total committed + in-flight instances; `quotas.team.maxConcurrent` =
 * team-wide ACTIVE (CREATED|RUNNING) instances; `quotas.members.*` = the
 * same two bounds scoped to the template being instantiated (one Quota
 * object shared by all member templates).
 *
 * @param quota - the blueprint's quota spec (may be undefined).
 * @param counts - the counted view.
 * @param templateId - the template being instantiated.
 * @throws {@link ActivationError} `ACTIVATION_QUOTA_*` (one of the four
 *   closed quota codes).
 */
export function checkQuota(
  quota: QuotaSpec | undefined,
  counts: {
    readonly teamTotal: number
    readonly teamActive: number
    readonly templateTotal: number
    readonly templateActive: number
  },
  templateId: string,
): void {
  if (quota === undefined) return
  const team = quota.team
  if (team !== undefined) {
    if (team.maxInstances !== undefined && counts.teamTotal + 1 > team.maxInstances) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_INSTANCES,
        `activation: team quota maxInstances=${team.maxInstances} exhausted (current+reserved=${counts.teamTotal}, +1 requested)`,
        { maxInstances: team.maxInstances, current: counts.teamTotal },
      )
    }
    if (team.maxConcurrent !== undefined && counts.teamActive + 1 > team.maxConcurrent) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.QUOTA_TEAM_MAX_CONCURRENT,
        `activation: team quota maxConcurrent=${team.maxConcurrent} exhausted (active+reserved=${counts.teamActive}, +1 requested)`,
        { maxConcurrent: team.maxConcurrent, active: counts.teamActive },
      )
    }
  }
  const members = quota.members
  if (members !== undefined) {
    if (members.maxInstances !== undefined && counts.templateTotal + 1 > members.maxInstances) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_INSTANCES,
        `activation: member quota maxInstances=${members.maxInstances} exhausted for template '${templateId}' (current+reserved=${counts.templateTotal}, +1 requested)`,
        { templateId, maxInstances: members.maxInstances, current: counts.templateTotal },
      )
    }
    if (members.maxConcurrent !== undefined && counts.templateActive + 1 > members.maxConcurrent) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.QUOTA_MEMBER_MAX_CONCURRENT,
        `activation: member quota maxConcurrent=${members.maxConcurrent} exhausted for template '${templateId}' (active+reserved=${counts.templateActive}, +1 requested)`,
        { templateId, maxConcurrent: members.maxConcurrent, active: counts.templateActive },
      )
    }
  }
}

// --- step 8: policy ---------------------------------------------------------------------------

/**
 * The deterministic overlay/override selection from the durable `overrides`
 * store into the policy resolver's overlay slots (step 8 input half).
 *
 * Mapping (closed, documented ruling):
 *
 * - `scope: 'team'` + `kind: 'autonomy-overlay'` → the `templateOverlay`
 *   slot (kind `'template'`);
 * - `scope: 'instance'` matching the NEW instance id + `kind:
 *   'autonomy-overlay'` → the `instanceOverlay` slot (kind `'instance'`) —
 *   never present for a genuinely fresh instance, supported for re-drive
 *   correctness;
 * - `kind: 'human-override'` → the `humanOverride` slot (the instance-
 *   scoped record wins over the team-scoped one, per the policy contract);
 * - multiple candidates for one slot: the HIGHEST `generation` wins, ties
 *   broken by the LEXICOGRAPHICALLY SMALLEST `recordId` (deterministic;
 *   multi-overlay composition is owned by the later governance work).
 *
 * The stored `values` payload passes through UNTOUCHED: the policy resolver
 * re-validates it (a malformed stored payload fails closed in step 8).
 *
 * @param overrides - the durable governance override records (all teams).
 * @param rootSessionId - the team (root) session id.
 * @param instanceId - the instance being activated.
 * @returns the selected overlay slots (absent when no candidate exists).
 */
export function selectPolicyOverrides(
  overrides: readonly GovernanceOverrideRecord[],
  rootSessionId: string,
  instanceId: string,
): {
  readonly templateOverlay?: AutonomyOverlayRecord
  readonly instanceOverlay?: AutonomyOverlayRecord
  readonly humanOverride?: HumanOverrideRecord
} {
  const root = parseRootSessionId(rootSessionId)
  const inTeam = (record: GovernanceOverrideRecord): boolean => record.rootSessionId === root
  const candidates = (
    records: readonly GovernanceOverrideRecord[],
  ): readonly GovernanceOverrideRecord[] =>
    records.slice().sort((a, b) => {
      if (a.generation !== b.generation) return a.generation < b.generation ? 1 : -1
      return a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0
    })
  const templateCandidates = candidates(
    overrides.filter((record) => inTeam(record) && record.scope === 'team' && record.kind === 'autonomy-overlay'),
  )
  const instanceCandidates = candidates(
    overrides.filter(
      (record) =>
        inTeam(record) && record.scope === 'instance' && record.instanceId === instanceId && record.kind === 'autonomy-overlay',
    ),
  )
  const humanTeam = candidates(
    overrides.filter((record) => inTeam(record) && record.scope === 'team' && record.kind === 'human-override'),
  )
  const humanInstance = candidates(
    overrides.filter(
      (record) => inTeam(record) && record.scope === 'instance' && record.instanceId === instanceId && record.kind === 'human-override',
    ),
  )
  const result: {
    templateOverlay?: AutonomyOverlayRecord
    instanceOverlay?: AutonomyOverlayRecord
    humanOverride?: HumanOverrideRecord
  } = {}
  const template = templateCandidates[0]
  if (template !== undefined && template.origin !== undefined) {
    result.templateOverlay = {
      overlayId: template.recordId,
      kind: 'template',
      origin: template.origin,
      values: template.values as Partial<Record<string, PolicyEntry>>,
    }
  }
  const instance = instanceCandidates[0]
  if (instance !== undefined && instance.origin !== undefined) {
    result.instanceOverlay = {
      overlayId: instance.recordId,
      kind: 'instance',
      origin: instance.origin,
      values: instance.values as Partial<Record<string, PolicyEntry>>,
    }
  }
  const human = humanInstance[0] !== undefined ? humanInstance[0] : humanTeam[0]
  if (human !== undefined) {
    result.humanOverride = {
      overrideId: human.recordId,
      scope: human.scope,
      values: human.values as Partial<Record<string, PolicyEntry>>,
    }
  }
  return result
}

/**
 * Step 8 — effective policy resolution for the member being activated.
 *
 * v1 input assembly (documented ruling): the v1 blueprint carries no
 * per-capability value layers (its envelopes are mutation-operation
 * envelopes, not policy cells — the canonical P3-T6 pipeline resolves with
 * empty blueprint/template value layers), so the policy input uses empty
 * value layers; the differentiation comes from the stored
 * overlay/override records (durable, team-scoped) and the external hard
 * facts (injected; no Team layer can bypass them, invariant 34). The
 * PolicyState is the implicit `default` state of v1 (the TeamSession has no
 * durable transition store yet; invariant 40 owns transitions).
 *
 * @param args - the resolution inputs.
 * @returns the frozen effective policy (explainable per-cell, provenance
 *   included).
 * @throws {@link ActivationError} `ACTIVATION_POLICY_RESOLUTION_FAILED` when
 *   the resolver rejects the input (e.g. a malformed stored overlay payload
 *   — fail closed).
 */
export function resolveActivationPolicy(args: {
  readonly rootSessionId: string
  readonly instanceId: string
  readonly overrides: readonly GovernanceOverrideRecord[]
  readonly external: ExternalPolicyFacts
}): EffectivePolicy {
  const { rootSessionId, instanceId, overrides, external } = args
  const selected = selectPolicyOverrides(overrides, rootSessionId, instanceId)
  let policy: EffectivePolicy
  try {
    policy = resolveEffectivePolicy({
      teamSessionId: teamSessionIdOf(parseRootSessionId(rootSessionId)),
      member: createMemberIdentity(parseRootSessionId(rootSessionId), parseInstanceId(instanceId)),
      blueprint: {},
      template: {},
      policyState: { stateId: DEFAULT_POLICY_STATE_ID },
      ...(selected.templateOverlay !== undefined ? { templateOverlay: selected.templateOverlay } : {}),
      ...(selected.instanceOverlay !== undefined ? { instanceOverlay: selected.instanceOverlay } : {}),
      ...(selected.humanOverride !== undefined ? { humanOverride: selected.humanOverride } : {}),
      external,
    })
  } catch (error) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.POLICY_RESOLUTION_FAILED,
      `activation: effective policy resolution failed (fail closed): ${String(error)}`,
      { rootSessionId, instanceId },
    )
  }
  return policy
}

/** The per-capability effective values of one resolution (lossless-JSON view). */
export function effectivePolicyValues(policy: EffectivePolicy): Record<string, PolicyEntry> {
  const values: Record<string, PolicyEntry> = {}
  for (const name of CAPABILITY_NAME_VALUES) {
    values[name] = policy.cells[name].effective
  }
  return values
}

// --- step 9: overlay bounds ----------------------------------------------------------------------

/**
 * The mutation-operation overlay bounds of a new member (step 9): the
 * INTERSECTION of the Team envelope and the template's member envelope
 * (Architecture §5.4/§19.3: a mutation operation is in-bounds only when
 * BOTH envelopes allow it; an absent envelope or an absent operation =
 * out-of-bounds — the boundary fails closed).
 *
 * @param blueprint - the resolved blueprint.
 * @param templateId - the template being instantiated.
 * @returns the in-bounds mutation operations (deterministic order).
 */
export function computeOverlayBounds(blueprint: TeamBlueprint, templateId: string): readonly string[] {
  const memberEntry = blueprint.memberEnvelopes.find((entry) => entry.templateId === templateId)
  const templateAllow = new Set(memberEntry?.envelope.allow ?? [])
  const teamDeny = new Set(blueprint.teamEnvelope?.deny ?? [])
  const templateDeny = new Set(memberEntry?.envelope.deny ?? [])
  const bounds: string[] = []
  for (const operation of blueprint.teamEnvelope?.allow ?? []) {
    if (teamDeny.has(operation) || !templateAllow.has(operation) || templateDeny.has(operation)) continue
    bounds.push(operation)
  }
  return bounds
}

// --- step 10: workspace/context fields ---------------------------------------------------------------

/** The frozen creation-time fields of one activation (step 10 output). */
export interface ResolvedCreationFields {
  /** The validated label. */
  readonly label: string
  /** The validated group id (absent when the request carried none). */
  readonly groupId?: string
  /** The effective workspace (explicit > TeamSession default > absent). */
  readonly workspace?: string
  /** The contextPolicy frozen at creation (invariant 29). */
  readonly contextPolicy: ContextPolicy
}

/**
 * Step 10 — workspace/context creation fields (frozen at creation):
 *
 * - the label / groupId are structurally validated (contracts v1 field
 *   rules);
 * - the effective workspace = the explicit request workspace, else the
 *   TeamSession default (Architecture §21.2 W1);
 * - the contextPolicy = the TEMPLATE's contextPolicy, else the default
 *   (`persistent`) — invariant 29: it is frozen from the template at
 *   creation and never caller-chosen; an unknown template token fails
 *   closed (the blueprint validation only bounds the token format, not the
 *   domain vocabulary).
 *
 * @param teamSession - the TeamSession record (default workspace).
 * @param request - the activation request (label/groupId/workspace).
 * @param template - the resolved template (contextPolicy).
 * @returns the frozen creation fields.
 * @throws {@link ActivationError} `ACTIVATION_INVALID_WORKSPACE_FIELD`,
 *   `ACTIVATION_INVALID_LABEL_FIELD`, `ACTIVATION_INVALID_GROUP_ID_FIELD`,
 *   or `ACTIVATION_TEMPLATE_CONTEXT_POLICY_UNKNOWN`.
 */
export function resolveCreationFields(
  teamSession: TeamSessionRecordDto,
  request: MemberActivationRequest,
  template: { readonly contextPolicy?: string },
): ResolvedCreationFields {
  let label: string
  try {
    label = parseLabelLikeField(request.label, 'label', LABEL_MAX_LENGTH)
  } catch (error) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.INVALID_LABEL_FIELD,
      `activation: invalid label: ${String(error)}`,
      { label: String(request.label) },
    )
  }
  let groupId: string | undefined
  if (request.groupId !== undefined) {
    try {
      groupId = parseLabelLikeField(request.groupId, 'groupId', GROUP_ID_MAX_LENGTH)
    } catch (error) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.INVALID_GROUP_ID_FIELD,
        `activation: invalid groupId: ${String(error)}`,
        { groupId: String(request.groupId) },
      )
    }
  }
  let workspace: string | undefined
  if (request.workspace !== undefined) {
    try {
      workspace = parseWorkspaceField(request.workspace, 'workspace')
    } catch (error) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.INVALID_WORKSPACE_FIELD,
        `activation: invalid workspace: ${String(error)}`,
        { workspace: String(request.workspace) },
      )
    }
  } else if (teamSession.defaultWorkspace !== undefined) {
    try {
      workspace = parseWorkspaceField(teamSession.defaultWorkspace, 'defaultWorkspace')
    } catch (error) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.INVALID_WORKSPACE_FIELD,
        `activation: invalid TeamSession defaultWorkspace: ${String(error)}`,
        { workspace: String(teamSession.defaultWorkspace) },
      )
    }
  }
  const contextPolicy = template.contextPolicy ?? DEFAULT_CONTEXT_POLICY
  if (typeof contextPolicy !== 'string' || !isContextPolicy(contextPolicy)) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.TEMPLATE_CONTEXT_POLICY_UNKNOWN,
      `activation: template declares unknown contextPolicy '${String(template.contextPolicy)}' (expected ${CONTEXT_POLICIES.PERSISTENT} | ${CONTEXT_POLICIES.FRESH_PER_DELEGATION})`,
      { contextPolicy: String(template.contextPolicy) },
    )
  }
  return { label, ...(groupId !== undefined ? { groupId } : {}), ...(workspace !== undefined ? { workspace } : {}), contextPolicy }
}

// --- step 11: instance-id allocation ------------------------------------------------------------------

/**
 * Step 11 — allocate the member instance id for the logical operation and
 * collision-check it against durable state (read-only): committed members
 * of the team AND in-flight provisioning reservations (PREPARED operation
 * rows). The allocation is deterministic in `(rootSessionId, source,
 * requestToken)` (see `identity.ts`), so the check runs under the team
 * lock in the provider together with the quota count and the reservation.
 *
 * A collision is a LOUD failure (the logical token is stable: a retry of
 * the same operation re-derives the same id and converges; a DIFFERENT
 * operation colliding is a true conflict that must surface, never be
 * silently rotated).
 *
 * @param request - the activation request.
 * @param view - the durable counting view (members + operations).
 * @returns the allocated (collision-checked) instance id.
 * @throws {@link ActivationError} `ACTIVATION_INSTANCE_ID_CONFLICT` (or
 *   `ACTIVATION_LEADER_INSTANCE_ID_RESERVED`).
 */
export function allocateCheckedInstanceId(request: MemberActivationRequest, view: QuotaCountingView): string {
  const instanceId = allocateActivationInstanceId(request.rootSessionId, request.source, request.requestToken)
  const root = parseRootSessionId(request.rootSessionId)
  for (const member of view.members) {
    if (member.rootSessionId === root && member.instanceId === instanceId) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.INSTANCE_ID_CONFLICT,
        `activation: allocated instance id '${instanceId}' already exists as a committed member of team '${root}'`,
        { instanceId },
      )
    }
  }
  for (const operation of view.operations) {
    if (!isInFlightProvisionOperation(operation, root)) continue
    if (operation.intent.payload['instanceId'] === instanceId) {
      throw new ActivationError(
        ACTIVATION_ERROR_CODES.INSTANCE_ID_CONFLICT,
        `activation: allocated instance id '${instanceId}' is already reserved by an in-flight provisioning operation '${operation.operationId}'`,
        { instanceId, reservedBy: operation.operationId },
      )
    }
  }
  return instanceId
}
