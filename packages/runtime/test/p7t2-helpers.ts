/**
 * p7t2-helpers — shared fakes and fixture builders for the P7-T2
 * (runtime mutation/provenance) tests (TaskDoc §11.8 P7-T2; DevPlan
 * §20.2).
 *
 * Contents:
 *
 * - fixture ids (one TeamSession + a foreign TeamSession for identity-
 *   boundary negatives; three MemberInstances) — minted through the
 *   frozen contracts mirror so they satisfy the id patterns by
 *   construction;
 * - {@link InMemoryMutationStore} — the in-memory {@link MutationStore}
 *   (append-only lists; per-instance creation fields with the running
 *   flag);
 * - {@link FakeStepClock} — the controllable {@link StepClock};
 * - {@link FakePolicyReader} — the mutable {@link PolicyReader} (the test
 *   flips blueprint/template/external facts and every later read — intake
 *   OR resolution — observes the change, exactly like the cold-resume
 *   re-probe, invariant 36.3);
 * - {@link createP7T2World} — one service + its ports wired together;
 * - {@link allow} / {@link deny} — policy entry builders;
 * - {@link captureError} / {@link assertMutationCode} — the
 *   expect-and-return error helpers (the vitest shim's matcher surface is
 *   limited; the tests branch on `code`, never on message text);
 * - {@link snapshotCapture} / {@link snapshotConfig} — plain snapshot
 *   projections (the scenario code captures snapshots at module top
 *   level; the `it` bodies assert only on the captured data).
 *
 * @module @dsh-agent-team/runtime/test/p7t2-helpers
 */

import {
  CAPABILITY_NAME_VALUES,
  createMemberIdentity,
  parseInstanceId,
  parseRootSessionId,
  parseTeamSessionId,
} from '../../domain/policy/src/index.js'
import type {
  BlueprintPolicyEnvelope,
  CapabilityName,
  ExternalPolicyFacts,
  InstanceId,
  MemberIdentity,
  PolicyEntry,
  TemplatePolicy,
} from '../../domain/policy/src/index.js'
import {
  MutationError,
  MutationService,
  type EffectiveConfigCapture,
  type EffectiveConfiguration,
  type EffectivePolicyLike,
  type SuppressedOverlayRecord,
  type MutationLedgerEntry,
  type MutationStore,
  type PolicyReader,
  type PolicyStateTransitionRecord,
  type StepClock,
  type StoredMutationRecord,
  type SuppressionRecord,
  type CreationFieldRecord,
  type TeamSessionId,
} from '../mutation/index.js'

// ---------------------------------------------------------------------------
// Fixture ids
// ---------------------------------------------------------------------------

/** The fixture TeamSession (= its root session id, invariant 9). */
export const P7T2_TEAM: TeamSessionId = parseTeamSessionId('session-root-p7t2')
/** A FOREIGN TeamSession (identity-boundary negatives). */
export const P7T2_OTHER_TEAM: TeamSessionId = parseTeamSessionId('session-root-p7t2other')
/** The fixture MemberInstance ids (lowercase alphanumeric tails). */
export const P7T2_ALPHA: InstanceId = parseInstanceId('inst-p7t2alpha')
export const P7T2_BETA: InstanceId = parseInstanceId('inst-p7t2beta')
export const P7T2_GAMMA: InstanceId = parseInstanceId('inst-p7t2gamma')

/** Build a member identity under `root` with `instanceId`. */
export function makeMember(root: string, instanceId: string): MemberIdentity {
  return createMemberIdentity(parseRootSessionId(root), parseInstanceId(instanceId))
}

/** A fixture member of the fixture team. */
export function fixtureMember(instanceId: InstanceId): MemberIdentity {
  return makeMember(P7T2_TEAM, instanceId)
}

/** A member of the FOREIGN team (same instanceId — scope must still
 *  mismatch, invariant 18). */
export function foreignMember(instanceId: InstanceId): MemberIdentity {
  return makeMember(P7T2_OTHER_TEAM, instanceId)
}

// ---------------------------------------------------------------------------
// Fakes: clock, store, reader
// ---------------------------------------------------------------------------

/** The controllable step-boundary clock (0 = before the first step). */
export class FakeStepClock implements StepClock {
  private step: number

  constructor(start = 0) {
    this.step = start
  }

  currentStep(): number {
    return this.step
  }

  advance(n = 1): void {
    this.step += n
  }
}

/** A mutable internal row (the public shape is the readonly
 * {@link CreationFieldRecord}). */
interface CreationFieldRow {
  instanceId: InstanceId
  workspace: string
  contextPolicy: string
  running: boolean
}

/**
 * The in-memory MutationStore: append-only lists per TeamSession plus the
 * per-instance creation fields. The service deep-freezes everything it
 * appends; the store keeps the (frozen) references as-is. Creation-field
 * rows stay mutable internally (the running flag flips at first RUNNING)
 * and are read through the getter.
 */
export class InMemoryMutationStore implements MutationStore {
  private readonly transitions = new Map<string, PolicyStateTransitionRecord[]>()
  private readonly records = new Map<string, StoredMutationRecord[]>()
  private readonly creationFields = new Map<string, Map<InstanceId, CreationFieldRow>>()
  private readonly ledger = new Map<string, MutationLedgerEntry[]>()
  private readonly suppressions = new Map<string, SuppressionRecord[]>()

  private list<T>(map: Map<string, T[]>, teamSessionId: string): T[] {
    let list = map.get(teamSessionId)
    if (list === undefined) {
      list = []
      map.set(teamSessionId, list)
    }
    return list
  }

  listTransitions(teamSessionId: TeamSessionId): readonly PolicyStateTransitionRecord[] {
    return this.list(this.transitions, teamSessionId)
  }

  appendTransition(teamSessionId: TeamSessionId, transition: PolicyStateTransitionRecord): void {
    this.list(this.transitions, teamSessionId).push(transition)
  }

  listRecords(teamSessionId: TeamSessionId): readonly StoredMutationRecord[] {
    return this.list(this.records, teamSessionId)
  }

  appendRecord(teamSessionId: TeamSessionId, record: StoredMutationRecord): void {
    this.list(this.records, teamSessionId).push(record)
  }

  getCreationFields(
    teamSessionId: TeamSessionId,
    instanceId: InstanceId,
  ): CreationFieldRecord | undefined {
    const row = this.creationFields.get(teamSessionId)?.get(instanceId)
    if (row === undefined) return undefined
    // Defensive copy: the internal row stays mutable (the running flag
    // flips at first RUNNING) and must not alias caller-held snapshots.
    return {
      instanceId: row.instanceId,
      workspace: row.workspace,
      contextPolicy: row.contextPolicy,
      running: row.running,
    }
  }

  registerCreationFields(
    teamSessionId: TeamSessionId,
    member: MemberIdentity,
    fields: { readonly workspace: string; readonly contextPolicy: string },
  ): void {
    let byInstance = this.creationFields.get(teamSessionId)
    if (byInstance === undefined) {
      byInstance = new Map()
      this.creationFields.set(teamSessionId, byInstance)
    }
    byInstance.set(member.instanceId, {
      instanceId: member.instanceId,
      workspace: fields.workspace,
      contextPolicy: fields.contextPolicy,
      running: false,
    })
  }

  setWorkspace(teamSessionId: TeamSessionId, instanceId: InstanceId, workspace: string): void {
    const record = this.creationFields.get(teamSessionId)?.get(instanceId)
    if (record !== undefined) record.workspace = workspace
  }

  isRunning(teamSessionId: TeamSessionId, instanceId: InstanceId): boolean {
    return this.creationFields.get(teamSessionId)?.get(instanceId)?.running === true
  }

  markRunning(teamSessionId: TeamSessionId, instanceId: InstanceId): void {
    const record = this.creationFields.get(teamSessionId)?.get(instanceId)
    if (record !== undefined) record.running = true
  }

  listInstances(teamSessionId: TeamSessionId): readonly InstanceId[] {
    const byInstance = this.creationFields.get(teamSessionId)
    return byInstance === undefined ? [] : [...byInstance.keys()]
  }

  listLedger(teamSessionId: TeamSessionId): readonly MutationLedgerEntry[] {
    return this.list(this.ledger, teamSessionId)
  }

  appendLedger(teamSessionId: TeamSessionId, entry: MutationLedgerEntry): void {
    this.list(this.ledger, teamSessionId).push(entry)
  }

  listSuppressions(teamSessionId: TeamSessionId): readonly SuppressionRecord[] {
    return this.list(this.suppressions, teamSessionId)
  }

  appendSuppression(teamSessionId: TeamSessionId, record: SuppressionRecord): void {
    this.list(this.suppressions, teamSessionId).push(record)
  }
}

/** The reader options of {@link FakePolicyReader}. */
export interface FakePolicyReaderOptions {
  readonly blueprint?: BlueprintPolicyEnvelope
  /** Member template policies, keyed by instanceId (absent → `{}`). */
  readonly templates?: Readonly<Record<InstanceId, TemplatePolicy>>
  readonly external?: ExternalPolicyFacts
}

/**
 * The mutable PolicyReader: the tests re-assign `blueprint` / `external` /
 * templates and every later read observes the change (the re-probe model).
 */
export class FakePolicyReader implements PolicyReader {
  blueprint: BlueprintPolicyEnvelope
  external: ExternalPolicyFacts
  private readonly templates: Map<InstanceId, TemplatePolicy>

  constructor(options: FakePolicyReaderOptions = {}) {
    this.blueprint = options.blueprint ?? { values: {}, autonomyEnvelope: {} }
    this.external = options.external ?? { hard: {}, capabilityExists: {} }
    this.templates = new Map(Object.entries(options.templates ?? {}))
  }

  setTemplate(instanceId: InstanceId, template: TemplatePolicy): void {
    this.templates.set(instanceId, template)
  }

  readBlueprintEnvelope(_teamSessionId: TeamSessionId): BlueprintPolicyEnvelope {
    return this.blueprint
  }

  readTemplatePolicy(_teamSessionId: TeamSessionId, member: MemberIdentity): TemplatePolicy {
    return this.templates.get(member.instanceId) ?? {}
  }

  readExternalFacts(_teamSessionId: TeamSessionId): ExternalPolicyFacts {
    return this.external
  }
}

/** The world of one P7-T2 scenario: one service + its three ports. */
export interface P7T2World {
  readonly clock: FakeStepClock
  readonly store: InMemoryMutationStore
  readonly reader: FakePolicyReader
  readonly service: MutationService
}

/** Build one service over the fakes (deterministic default id minting). */
export function createP7T2World(options: FakePolicyReaderOptions = {}): P7T2World {
  const clock = new FakeStepClock(0)
  const store = new InMemoryMutationStore()
  const reader = new FakePolicyReader(options)
  const service = new MutationService({ clock, store, policy: reader })
  return { clock, store, reader, service }
}

// ---------------------------------------------------------------------------
// Entry / snapshot helpers
// ---------------------------------------------------------------------------

/** Build an `allow` policy entry. */
export function allow(...items: string[]): PolicyEntry {
  return { kind: 'allow', items }
}

/** Build a `deny` policy entry. */
export function deny(): PolicyEntry {
  return { kind: 'deny' }
}

/** The result of {@link captureError}. */
export type CapturedError =
  | { readonly thrown: true; readonly error: unknown }
  | { readonly thrown: false }

/** Run `fn`, capturing any thrown error (scenarios run at top level). */
export function captureError(fn: () => void): CapturedError {
  try {
    fn()
    return { thrown: false }
  } catch (error) {
    return { thrown: true, error }
  }
}

/**
 * Assert `error` is a MutationError with `code` and return the code +
 * details (tests branch on the code, never on the message text).
 */
export function assertMutationCode(error: unknown, code: string): { code: string; details?: Record<string, unknown> } {
  if (!(error instanceof MutationError)) {
    throw new Error(`assertMutationCode: expected a MutationError but got: ${String(error)}`)
  }
  if (error.code !== code) {
    throw new Error(
      `assertMutationCode: expected MutationError code '${code}' but got '${error.code}'`,
    )
  }
  return {
    code: error.code,
    ...(error.details !== undefined ? { details: error.details } : {}),
  }
}

/** The minimal step-resolution shape {@link snapshotConfig} projects
 * (both {@link EffectiveConfiguration} and its captured core). */
export interface SnapshotableResolution {
  readonly step: number
  readonly policy: EffectivePolicyLike
  readonly contributions: readonly MutationLedgerEntry[]
  readonly suppressed?: readonly SuppressedOverlayRecord[]
}

/** The plain snapshot projection of one in-flight capture. */
export function snapshotCapture(capture: EffectiveConfigCapture): Record<string, unknown> {
  return snapshotConfig({
    step: capture.step,
    policy: capture.policy,
    contributions: capture.contributions,
    suppressed: capture.policy.suppressed,
  })
}

/** The plain snapshot projection of one effective configuration. */
export function snapshotConfig(config: SnapshotableResolution): Record<string, unknown> {
  const cells: Record<string, unknown> = {}
  for (const capability of CAPABILITY_NAME_VALUES) {
    const cell = config.policy.cells[capability]
    cells[capability] = {
      effective: cell.effective,
      layer: cell.team.layer,
      origin: cell.team.origin,
      recordId: cell.team.recordId,
      overriddenLower: cell.team.overriddenLower,
      note: cell.external.note,
      removedItems: cell.external.removedItems,
      hard: cell.external.hard,
      explanation: cell.explanation,
    }
  }
  return {
    step: config.step,
    policyStateId: config.policy.policyStateId,
    cells,
    suppressed: config.suppressed ?? [],
    contributions: [...config.contributions].map((entry) => ({ ...entry })),
    explanation: config.policy.explanation,
  }
}

/** A one-line summary of a cell (diagnostic for failure messages). */
export function cellSummary(config: EffectiveConfiguration, capability: CapabilityName): string {
  const cell = config.policy.cells[capability]
  return `${capability}: ${JSON.stringify(cell.effective)} via ${cell.team.layer}(${cell.team.origin},${cell.team.recordId}) note=${cell.external.note}`
}
