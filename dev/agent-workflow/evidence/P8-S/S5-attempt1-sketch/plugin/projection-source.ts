/**
 * P8-S5 — the production TeamDomain projection source adapter (plan
 * §19.1 "Projection service"; §20.2 S6 authority completion).
 *
 * This module implements the frozen {@link TeamDomainReadPort} — the
 * BOUNDED durable source the P8-T2 projection service folds into the
 * `TeamProjectionDto` — directly over the durable TeamDomain repositories.
 * It is the production replacement for the per-world stand-in sources the
 * test suites build by hand (the G8-S1 precedent): one adapter for the
 * shipped production root, no per-test re-construction.
 *
 * S5 scope (documented derivations, each frozen here and replaced by the
 * S6 authority completion where the plan assigns the live facts):
 *
 * - `root.policyState` — the pure {@link activePolicyState} over the
 *   session's durable PolicyState transitions when the composition supplies
 *   the mutation plane's durable store + step clock; the implicit
 *   {@link DEFAULT_POLICY_STATE_ID} otherwise (no admitted transition);
 * - `root.compatibility` — the durable `compatibility` store record when
 *   present (the prober's `outcomes` are read defensively — lossless-JSON,
 *   never trusted structurally); the deterministic never-probed summary
 *   (status `OPEN`, generation 1, zero counts — the G8-S1 precedent) when
 *   absent;
 * - `root.creationBudgetConsumed` — `0` (the S5 cold view carries no
 *   handoff-creation authority; S6 completes it);
 * - member `effectiveConfig` — the four-lane cold view: `model` /
 *   `autonomy` are `unavailable` (the per-instance live resolvers are the
 *   P8-S4B consumption plane, not a durable fact), `workspace` resolves the
 *   instance row value over the team default with honest provenance,
 *   `permissions` is the empty map (the resolver's permission lanes are
 *   S6);
 * - `ledger.byCategory` — the closed S5 factType → category map over the
 *   runtime's closed fact vocabulary (throwing on an unknown factType is
 *   corruption detection; `policy` / `compatibility` buckets stay 0 until
 *   S6 writes those fact families).
 *
 * Pure module: no I/O, no `node:` builtins, no DSH imports — the sanctioned
 * test chain imports it directly.
 *
 * @module @dsh-agent-team/runtime/plugin/projection-source
 */

import {
  LEDGER_CATEGORIES,
  LEADER_INSTANCE_ID,
} from '../../../contracts/src/index.js'
import type {
  ChildSessionId,
  CompatibilitySummaryDto,
  ContextPolicy,
  EffectiveConfigDto,
  InstanceId,
  LedgerCategory,
  MemberLifecycleState,
  RemoteSafeJsonValue,
  TeamSessionId,
  TemplateId,
} from '../../../contracts/src/index.js'
import { isContextPolicy } from '../../../contracts/src/index.js'
import type { CompatibilityStateRecord } from '../../../storage/schema/compatibility.js'
import type { LedgerEntry } from '../../../storage/schema/ledger.js'
import type { TeamDomainRepositories } from '../../../storage/repositories/team-domain.js'
import type {
  BlueprintCatalog,
  TeamBlueprint,
} from '../../../domain/blueprint/src/index.js'
import { computeFingerprint } from '../../../domain/compatibility/src/index.js'
import { DEFAULT_POLICY_STATE_ID } from '../../../domain/policy/src/index.js'
import type {
  DurableLedgerSummary,
  DurableMemberRow,
  DurableTemplateRow,
  TeamDomainProjectionSource,
  TeamDomainReadPort,
  TeamRootFacts,
} from '../../projection/index.js'
import { activePolicyState } from '../../policy-adapter.js'
import type { PolicyStateTransitionRecord } from '../../mutation/types.js'
import { compatibilityRequirementsOf } from '../../compatibility/blueprint.js'

// ---------------------------------------------------------------------------
// Adapter options
// ---------------------------------------------------------------------------

/**
 * The policy-state source of the cold view: the SAME durable store + step
 * clock the composition's MutationService consumes (when the mutation plane
 * is installed), so the projected `policyState` tracks every admitted
 * explicit transition at the current step boundary. Absent → the implicit
 * `'default'` state (the G8-S1 never-transitioned precedent).
 */
export interface PolicyStateSource {
  /** The session's durable PolicyState transitions, in admission order. */
  readonly listTransitions: () => readonly PolicyStateTransitionRecord[]
  /** The step currently in progress (0 before the first step). */
  readonly currentStep: () => number
}

/** The arguments of {@link createTeamDomainReadPortAdapter}. */
export interface TeamDomainReadPortAdapterOptions {
  /** The open TeamDomain repositories (the durable authority). */
  readonly repositories: TeamDomainRepositories
  /** The blueprint catalog (resolves the bound snapshot's document). */
  readonly catalog: BlueprintCatalog
  /** The TeamSession (root DSH session id) the adapter is bound to. */
  readonly rootSessionId: string
  /** The optional policy-state source (see {@link PolicyStateSource}). */
  readonly policyStateSource?: PolicyStateSource
}

// ---------------------------------------------------------------------------
// Closed S5 factType → category map (UI §27.4 vocabulary)
// ---------------------------------------------------------------------------

/**
 * The closed S5 mapping of the runtime's fact vocabulary onto the eight
 * frozen ledger categories. Unknown factTypes throw (corruption detection —
 * a TeamLedger row outside the closed runtime vocabulary is not a
 * "different bucket", it is a storage invariant violation). The `policy`
 * and `compatibility` buckets stay 0 in S5: those fact families are written
 * by the S6 authority completion, which replaces this adapter.
 */
const FACT_CATEGORY: Readonly<Record<string, LedgerCategory>> = {
  'team-work-admitted': 'team',
  'member-lifecycle-changed': 'lifecycle',
  'team-coordination-recorded': 'message',
  'team-message-delivered': 'message',
  'control-request-recorded': 'control',
  'control-decision-recorded': 'control',
  'control-allow-consumed': 'control',
  'activity-progress-recorded': 'progress',
  'activity-interval-opened': 'progress',
  'activity-interval-closed': 'progress',
}

// ---------------------------------------------------------------------------
// Durable row structural views (the v2 LeaderInstance row carries NO
// childSessionId / lifecycle — the repository's declared v1 surface does not
// express that absence, so the adapter reads a widened view)
// ---------------------------------------------------------------------------

/** The structural member row view (v1 member + v2 leader in one shape). */
interface DurableMemberRowView {
  readonly instanceId: InstanceId
  readonly templateId: TemplateId
  readonly label: string
  readonly groupId?: string
  readonly childSessionId?: ChildSessionId
  readonly workspace?: string
  readonly lifecycle?: MemberLifecycleState
  readonly createdAt: string
}

// ---------------------------------------------------------------------------
// Root facts
// ---------------------------------------------------------------------------

/**
 * The deterministic never-probed compatibility summary (the G8-S1
 * precedent): no `compatibility` store row yet — the team was created, the
 * probe has not run; admission is OPEN and the counters are zero.
 * `probeGeneration` is 1 (the frozen DTO requires >= 1; `NO_PROBE_GENERATION`
 * is -1 and cannot travel in the DTO). The environment fingerprint is the
 * deterministic fingerprint of the `no-probe` sentinel — non-empty (the
 * frozen DTO requires it) and stable across reads, without pretending any
 * environment was actually probed.
 */
const NEVER_PROBED_ENVIRONMENT_FINGERPRINT: string = computeFingerprint({ probe: 'never' })

function neverProbedSummary(requirementFingerprint: string): CompatibilitySummaryDto {
  return {
    status: 'OPEN',
    probeGeneration: 1,
    requirementFingerprint,
    environmentFingerprint: NEVER_PROBED_ENVIRONMENT_FINGERPRINT,
    warningCount: 0,
    fatalCount: 0,
    acknowledgedWarningCount: 0,
  }
}

/**
 * Read the engine counts stored in the durable record's `outcomes`
 * (defensive lossless-JSON read, the probe.ts precedent: malformed → zero,
 * never a throw).
 */
function outcomeCountsOf(record: CompatibilityStateRecord): {
  readonly warning: number
  readonly fatal: number
  readonly acknowledgedWarning: number
} {
  let warning = 0
  let fatal = 0
  let acknowledgedWarning = 0
  const rawCounts = record.outcomes['counts']
  if (typeof rawCounts === 'object' && rawCounts !== null) {
    const counts = rawCounts as Record<string, unknown>
    if (typeof counts['warning'] === 'number' && Number.isFinite(counts['warning'])) {
      warning = counts['warning']
    }
    if (typeof counts['fatal'] === 'number' && Number.isFinite(counts['fatal'])) {
      fatal = counts['fatal']
    }
  }
  const rawRows = record.outcomes['requirements']
  if (Array.isArray(rawRows)) {
    for (const item of rawRows) {
      if (typeof item !== 'object' || item === null) continue
      const row = item as Record<string, unknown>
      if (row['outcome'] !== 'WARNING') continue
      const ack = row['acknowledgement']
      if (
        typeof ack === 'object' &&
        ack !== null &&
        (ack as Record<string, unknown>)['status'] === 'VALID'
      ) {
        acknowledgedWarning++
      }
    }
  }
  return { warning, fatal, acknowledgedWarning }
}

/**
 * Build the `CompatibilitySummaryDto` from the durable `compatibility`
 * record (absent → the never-probed summary). The requirement fingerprint
 * is re-derived deterministically from the bound blueprint's requirement
 * set (the frozen DTO field is opaque; the derivation is stable across
 * reads, so a fresh client always sees the same identity).
 */
function compatibilitySummaryOf(
  record: CompatibilityStateRecord | undefined,
  requirementFingerprint: string,
): CompatibilitySummaryDto {
  if (record === undefined) {
    return neverProbedSummary(requirementFingerprint)
  }
  const counts = outcomeCountsOf(record)
  return {
    // CompatibilityStatus and AdmissionState share the frozen §28 value set.
    status: record.status,
    probeGeneration: record.generation,
    requirementFingerprint,
    environmentFingerprint: record.fingerprint,
    warningCount: counts.warning,
    fatalCount: counts.fatal,
    acknowledgedWarningCount: counts.acknowledgedWarning,
    lastProbedAt: record.computedAt,
  }
}

/**
 * Build the root identity + admission facts. `handoffSourceSessionId` is
 * absent (the S5 cold view: handoff authority is S6) and
 * `creationBudgetConsumed` is 0 for the same reason.
 */
function rootFactsOf(options: {
  readonly repositories: TeamDomainRepositories
  readonly rootSessionId: string
  readonly blueprint: TeamBlueprint
  readonly policyStateSource?: PolicyStateSource
}): TeamRootFacts {
  const { repositories, rootSessionId, blueprint, policyStateSource } = options
  const record = repositories.compatibility.get(rootSessionId)
  // The requirement set is lossless-JSON by construction (string/boolean
  // fields only); the cast bridges the readonly-interface-array surface to
  // the canonical-JSON value type (no structural difference).
  const requirementFingerprint = computeFingerprint(
    compatibilityRequirementsOf(blueprint) as unknown as RemoteSafeJsonValue,
  )
  let policyState = DEFAULT_POLICY_STATE_ID
  if (policyStateSource !== undefined) {
    const transitions = policyStateSource.listTransitions()
    policyState = activePolicyState(transitions, policyStateSource.currentStep()).stateId
  }
  const root: TeamRootFacts = {
    policyState,
    admission: record === undefined ? 'OPEN' : record.status,
    compatibility: compatibilitySummaryOf(record, requirementFingerprint),
    creationBudgetConsumed: 0,
  }
  return root
}

// ---------------------------------------------------------------------------
// Template rows
// ---------------------------------------------------------------------------

/**
 * Resolve a template's frozen contextPolicy (default `persistent` — the
 * G8-S1 stand-in rule; the blueprint vocabulary is validated by the
 * contracts guard).
 */
function contextPolicyOf(
  template: { readonly templateId: unknown; readonly contextPolicy?: string },
): ContextPolicy {
  const policy = template.contextPolicy ?? 'persistent'
  if (!isContextPolicy(policy)) {
    throw new Error(
      `p8s5 projection: template '${String(template.templateId)}' carries unknown contextPolicy '${policy}'`,
    )
  }
  return policy
}

/**
 * The template rows of the bound snapshot (exactly one leader, invariant
 * 13). `instanceQuota` is absent for every row: the frozen blueprint
 * vocabulary carries no per-template instance cap (the quotas are the
 * team / per-member-family `QuotaSpec`, a separate vocabulary), so "the
 * template has no cap" applies to all of them.
 */
function templateRowsOf(blueprint: TeamBlueprint): DurableTemplateRow[] {
  const rows: DurableTemplateRow[] = []
  const leader = blueprint.leader
  rows.push({
    kind: 'leader',
    templateId: leader.templateId,
    displayName: leader.displayName ?? String(leader.templateId),
    ...(leader.description !== undefined ? { description: leader.description } : {}),
    contextPolicy: contextPolicyOf(leader),
  })
  for (const template of blueprint.members) {
    rows.push({
      kind: 'member',
      templateId: template.templateId,
      displayName: template.displayName ?? String(template.templateId),
      ...(template.description !== undefined ? { description: template.description } : {}),
      contextPolicy: contextPolicyOf(template),
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Member rows
// ---------------------------------------------------------------------------

/**
 * The four-lane effective configuration cold view (S5 documented
 * derivation; the live per-instance resolvers are the P8-S4B consumption
 * plane + the S6 authority completion):
 *
 * - `model` — `unavailable` (no durable per-instance model selection; the
 *   source is `capability`, the lane that will resolve it live);
 * - `workspace` — the instance row value when present (the registered
 *   creation field, `locked` once the instance has a durable workspace),
 *   else the team default (`inherited` from the blueprint binding), else
 *   `unavailable` (the fold then throws the frozen "neither present"
 *   error — the adapter does not shadow it);
 * - `permissions` — the empty map (honest: the resolver's permission lanes
 *   are S6; an absent lane is NOT a denial, so no fake entries);
 * - `autonomy` — `unavailable` (the overlay resolver is S6).
 */
function effectiveConfigOf(row: DurableMemberRowView, defaultWorkspace: string | undefined): EffectiveConfigDto {
  const workspace =
    row.workspace !== undefined
      ? { value: row.workspace, source: 'instance-creation' as const, state: 'locked' as const }
      : defaultWorkspace !== undefined
        ? { value: defaultWorkspace, source: 'blueprint' as const, state: 'inherited' as const }
        : { value: null, source: 'instance-creation' as const, state: 'unavailable' as const }
  return {
    model: { value: null, source: 'capability', state: 'unavailable' },
    workspace,
    permissions: {},
    autonomy: { value: null, source: 'autonomy-overlay', state: 'unavailable' },
  }
}

/**
 * Every durable member row (the LeaderInstance row carries NO
 * childSessionId, invariant 14; a v2 leader row also carries no lifecycle —
 * the Leader is the Root Agent itself, so the cold view reports the root
 * session's standing: `RUNNING`, the G8-S1 stand-in value).
 */
function memberRowsOf(options: {
  readonly repositories: TeamDomainRepositories
  readonly rootSessionId: string
  readonly blueprint: TeamBlueprint
}): DurableMemberRow[] {
  const { repositories, rootSessionId, blueprint } = options
  const policyByTemplate = new Map<string, ContextPolicy>()
  policyByTemplate.set(String(blueprint.leader.templateId), contextPolicyOf(blueprint.leader))
  for (const template of blueprint.members) {
    policyByTemplate.set(String(template.templateId), contextPolicyOf(template))
  }
  const teamRow = repositories.teamSessions.get(rootSessionId)
  const defaultWorkspace = teamRow?.defaultWorkspace
  const rows: DurableMemberRow[] = []
  for (const record of repositories.memberInstances.list(rootSessionId)) {
    // The repository's declared v1 surface does not express the v2 leader
    // row's field absence; read the widened structural view.
    const view = record as DurableMemberRowView
    const isLeader = String(view.instanceId) === LEADER_INSTANCE_ID
    const templateId: TemplateId = view.templateId
    const contextPolicy = policyByTemplate.get(String(templateId))
    if (contextPolicy === undefined) {
      throw new Error(
        `p8s5 projection: no template contextPolicy for member template '${String(templateId)}'`,
      )
    }
    const lifecycle = view.lifecycle
    if (lifecycle === undefined) {
      if (isLeader) {
        // The v2 LeaderInstance row: no ordinary lifecycle (the Root Agent
        // standing — see the module doc).
        rows.push({
          instanceId: view.instanceId,
          templateId,
          label: view.label,
          lifecycle: 'RUNNING',
          createdAt: view.createdAt,
          contextPolicy,
          effectiveConfig: effectiveConfigOf(view, defaultWorkspace),
          ...(view.workspace !== undefined ? { workspace: view.workspace } : {}),
          ...(view.groupId !== undefined ? { groupId: view.groupId } : {}),
        })
        continue
      }
      // A non-leader row MUST carry its lifecycle (invariant 23 vocabulary)
      // — absence is corruption, fail closed.
      throw new Error(
        `p8s5 projection: member row '${String(view.instanceId)}' carries no lifecycle`,
      )
    }
    rows.push({
      instanceId: view.instanceId,
      templateId,
      label: view.label,
      lifecycle,
      createdAt: view.createdAt,
      contextPolicy,
      effectiveConfig: effectiveConfigOf(view, defaultWorkspace),
      ...(view.childSessionId !== undefined ? { childSessionId: view.childSessionId } : {}),
      ...(view.workspace !== undefined ? { workspace: view.workspace } : {}),
      ...(view.groupId !== undefined ? { groupId: view.groupId } : {}),
    })
  }
  return rows
}

// ---------------------------------------------------------------------------
// Ledger summary
// ---------------------------------------------------------------------------

/** Zero-initialize all eight frozen category buckets (all keys). The
 *  accumulator stays a MUTABLE `Record` — the frozen
 *  `LedgerCategoryCounts` is a readonly mapped type and can only be
 *  produced, not folded into (the assignment happens once at the return
 *  boundary of `ledgerSummaryOf`). */
function zeroLedgerCounts(): Record<LedgerCategory, number> {
  const counts = {} as Record<LedgerCategory, number>
  for (const category of Object.values(LEDGER_CATEGORIES)) {
    counts[category] = 0
  }
  return counts
}

/**
 * The `pendingControlCount`: the `control-request-recorded` request ids not
 * matched by any `control-decision-recorded` decision (defensive lossless-
 * JSON payload read; a malformed payload contributes nothing, never a
 * throw — the mirror of the probe.ts `blockingRequirementIdsOf` rule).
 */
function pendingControlCountOf(entries: readonly LedgerEntry[]): number {
  const requested = new Set<string>()
  const decided = new Set<string>()
  for (const entry of entries) {
    const id = entry.payload['requestId']
    if (entry.factType === 'control-request-recorded') {
      if (typeof id === 'string') requested.add(id)
    } else if (entry.factType === 'control-decision-recorded') {
      if (typeof id === 'string') decided.add(id)
    }
  }
  let pending = 0
  for (const id of requested) {
    if (!decided.has(id)) pending++
  }
  return pending
}

/**
 * The durable ledger summary fold (every entry counted exactly once into
 * exactly one category, so `totalEntries === sum(byCategory)` holds by
 * construction; `latestSequence` is 0 for an empty ledger).
 */
function ledgerSummaryOf(entries: readonly LedgerEntry[]): DurableLedgerSummary {
  const byCategory = zeroLedgerCounts()
  let latestSequence = 0
  for (const entry of entries) {
    const category = FACT_CATEGORY[entry.factType]
    if (category === undefined) {
      throw new Error(
        `p8s5 projection: unknown TeamLedger factType '${entry.factType}' (storage invariant violation)`,
      )
    }
    byCategory[category]++
    if (entry.sequence > latestSequence) latestSequence = entry.sequence
  }
  return {
    latestSequence,
    totalEntries: entries.length,
    byCategory,
    pendingControlCount: pendingControlCountOf(entries),
  }
}

// ---------------------------------------------------------------------------
// The adapter
// ---------------------------------------------------------------------------

/**
 * Create the production {@link TeamDomainReadPort} adapter bound to one
 * TeamSession (root DSH session id). Every read re-derives the source from
 * the durable repositories — the adapter keeps no cache (the projection
 * service owns freshness; the generation stamp is the staleness signal).
 */
export function createTeamDomainReadPortAdapter(
  options: TeamDomainReadPortAdapterOptions,
): TeamDomainReadPort {
  const { repositories, catalog, rootSessionId, policyStateSource } = options
  return {
    readProjectionSource(teamSessionId: TeamSessionId): TeamDomainProjectionSource {
      if (String(teamSessionId) !== rootSessionId) {
        throw new Error(
          `p8s5 projection: adapter is bound to '${rootSessionId}', not '${String(teamSessionId)}'`,
        )
      }
      const teamRow = repositories.teamSessions.get(rootSessionId)
      if (teamRow === undefined) {
        throw new Error(
          `p8s5 projection: no team_sessions row for '${rootSessionId}'`,
        )
      }
      const blueprint = catalog.resolve(teamRow.blueprint.blueprintId, teamRow.blueprint.revision)
      const source: TeamDomainProjectionSource = {
        teamSessionId: teamRow.rootSessionId,
        blueprint: teamRow.blueprint,
        createdAt: teamRow.createdAt,
        generation: teamRow.generation,
        root: rootFactsOf({ repositories, rootSessionId, blueprint, policyStateSource }),
        templates: templateRowsOf(blueprint),
        members: memberRowsOf({ repositories, rootSessionId, blueprint }),
        ledger: ledgerSummaryOf(repositories.ledger.list()),
        ...(teamRow.defaultWorkspace !== undefined
          ? { defaultWorkspace: teamRow.defaultWorkspace }
          : {}),
      }
      return source
    },
  }
}
