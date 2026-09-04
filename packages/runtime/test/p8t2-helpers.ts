/**
 * p8t2-helpers — shared world factory, fakes, and fixtures for the P8-T2
 * (Projection Service) tests (TaskDoc §11.9 P8-T2; DevPlan §21).
 *
 * Contents:
 *
 * - {@link P8T2_FIXTURE} — the P8-T2 fixture identities (distinct from the
 *   P4 / P5 / P6 / P7 / P8-T1 fixture values);
 * - {@link DEFAULT_PROJECTION_CLOCK} — the deterministic produced-at clock;
 * - the durable source fixture builders (`rawEffectiveConfig`,
 *   `rawCompatibility`, `rawLedger`, `rawLeaderTemplate`, `rawMemberTemplate`,
 *   `rawLeaderMember`, `rawMember`, {@link makeSource}) — plain, structurally
 *   valid TeamDomain projection sources;
 * - {@link FakeDomainPort} — the mock-first {@link TeamDomainReadPort}: the
 *   durable source is returned by reference, `readCount` is the "read exactly
 *   the durable source" evidence channel, and the NON-interface trap method
 *   {@link FakeDomainPort.__readChildLog} (which is NOT on the port
 *   interface) is the §21.2 red-line channel: the fold can only ever call
 *   `readProjectionSource`, so `childLogReadCount` must stay 0;
 * - {@link FakeOverlayPort} — the mock-first {@link LiveResidencyOverlayPort}:
 *   the live overlay snapshot is returned by reference, `snapshotCount` is
 *   the "one snapshot read per projection" channel;
 * - {@link createP8T2World} — one projection service world over the fakes
 *   with the default deterministic clock;
 * - {@link assertProjectionCode} — the closed-code assertion for
 *   {@link ProjectionError}.
 *
 * Mock-first (ruling R28): the TeamDomain source port and the live overlay
 * port are fakes; the projection service (and the pure fold) are REAL. The
 * fakes' call counters are the "bounded durable read / no child-log / one
 * overlay snapshot" evidence channels.
 *
 * @module @dsh-agent-team/runtime/test/p8t2-helpers
 */

import { LEADER_INSTANCE_ID } from '../../contracts/src/index.js'
import type {
  BlueprintContentHash,
  BlueprintId,
  BlueprintRevision,
  ChildSessionId,
  CompatibilitySummaryDto,
  EffectiveConfigDto,
  InstanceId,
  LedgerCategoryCounts,
  MemberActivitySummaryDto,
  MemberLiveActivityDto,
  TemplateId,
  TeamSessionId,
} from '../../contracts/src/index.js'
import { ProjectionError } from '../projection/errors.js'
import type {
  DurableLedgerSummary,
  DurableMemberRow,
  DurableTemplateRow,
  LiveResidencyOverlayPort,
  ProjectionClock,
  TeamDomainProjectionSource,
  TeamDomainReadPort,
  TeamRootFacts,
} from '../projection/index.js'
import { createProjectionService } from '../projection/index.js'
import type { ProjectionService } from '../projection/index.js'

/** The deterministic fixture produced-at clock (ISO-8601). */
export const DEFAULT_PROJECTION_TIMESTAMP = '2026-08-29T12:10:00.000Z'
export const DEFAULT_PROJECTION_CLOCK: ProjectionClock = () => DEFAULT_PROJECTION_TIMESTAMP

/** The P8-T2 fixture identities (distinct from P4 / P5 / P6 / P7 / P8-T1). */
export const P8T2_FIXTURE = {
  /** The TeamSession id (= the root DSH session id, invariant 9). */
  teamSessionId: 'session-p8t2-team' as TeamSessionId,
  blueprintId: 'BP-P8T2' as BlueprintId,
  blueprintRevision: '7' as BlueprintRevision,
  blueprintContentHash: 'sha256:p8t2-blueprint' as BlueprintContentHash,
  defaultWorkspace: '/ws/p8t2-team',
  /** The single LeaderTemplate id (invariant 13). */
  leaderTemplateId: 'tpl-p8t2-leader' as TemplateId,
  /** The MemberTemplate id (invariant 17). */
  memberTemplateId: 'tpl-p8t2-member' as TemplateId,
  createdAt: '2026-08-29T12:00:00.000Z',
} as const

/** The eight frozen ledger categories (UI §27.4), in the contract order. */
const LEDGER_CATEGORIES: readonly string[] = [
  'team',
  'member',
  'lifecycle',
  'message',
  'control',
  'policy',
  'compatibility',
  'progress',
]

function sumByCategory(byCategory: LedgerCategoryCounts): number {
  let sum = 0
  for (const key of LEDGER_CATEGORIES) {
    sum += byCategory[key as keyof LedgerCategoryCounts]
  }
  return sum
}

function zeroByCategory(): LedgerCategoryCounts {
  const byCategory: Record<string, number> = {}
  for (const key of LEDGER_CATEGORIES) byCategory[key] = 0
  return byCategory as unknown as LedgerCategoryCounts
}

/** A structurally valid effective configuration (all four lanes). */
export function rawEffectiveConfig(): EffectiveConfigDto {
  return {
    model: { value: 'qwen3.8-27b', source: 'blueprint', state: 'inherited' },
    workspace: { value: P8T2_FIXTURE.defaultWorkspace, source: 'instance-creation', state: 'locked' },
    permissions: {
      Bash: { value: 'allowed', source: 'policy-state', state: 'inherited' },
      Web: { value: null, source: 'external-hard-policy', state: 'denied' },
    },
    autonomy: { value: 'web-search', source: 'autonomy-overlay', state: 'suppressed' },
  }
}

/** A structurally valid compatibility summary (no probe timestamp). */
export function rawCompatibility(): CompatibilitySummaryDto {
  return {
    status: 'OPEN',
    probeGeneration: 3,
    requirementFingerprint: 'req-p8t2',
    environmentFingerprint: 'env-p8t2',
    warningCount: 0,
    fatalCount: 0,
    acknowledgedWarningCount: 0,
  }
}

export interface RawLedgerOverrides {
  readonly latestSequence?: number
  readonly totalEntries?: number
  readonly byCategory?: Partial<Record<keyof LedgerCategoryCounts, number>>
  readonly pendingControlCount?: number
}

/** A structurally valid durable ledger summary (self-consistent by default). */
export function rawLedger(overrides: RawLedgerOverrides = {}): DurableLedgerSummary {
  const byCategory = { ...zeroByCategory(), ...overrides.byCategory }
  return {
    latestSequence: overrides.latestSequence ?? 0,
    totalEntries: overrides.totalEntries ?? sumByCategory(byCategory),
    byCategory,
    pendingControlCount: overrides.pendingControlCount ?? 0,
  }
}

/** The single LeaderTemplate row (invariant 13). */
export function rawLeaderTemplate(): DurableTemplateRow {
  return {
    kind: 'leader',
    templateId: P8T2_FIXTURE.leaderTemplateId,
    displayName: 'Leader',
    contextPolicy: 'persistent',
  }
}

/** A MemberTemplate row (invariant 17). */
export function rawMemberTemplate(): DurableTemplateRow {
  return {
    kind: 'member',
    templateId: P8T2_FIXTURE.memberTemplateId,
    displayName: 'Worker',
    description: 'A generic team worker',
    contextPolicy: 'fresh_per_delegation',
    instanceQuota: 64,
  }
}

export interface RawMemberOverrides {
  readonly workspace?: string | undefined
  readonly lifecycle?: DurableMemberRow['lifecycle']
  readonly contextPolicy?: DurableMemberRow['contextPolicy']
  readonly groupId?: string
  readonly activity?: MemberActivitySummaryDto
  readonly childSessionId?: ChildSessionId
}

/** The LeaderInstance row (`inst-leader`; NO childSessionId, invariant 14). */
export function rawLeaderMember(overrides: RawMemberOverrides = {}): DurableMemberRow {
  return {
    instanceId: LEADER_INSTANCE_ID,
    templateId: P8T2_FIXTURE.leaderTemplateId,
    label: 'Leader',
    lifecycle: overrides.lifecycle ?? 'RUNNING',
    createdAt: P8T2_FIXTURE.createdAt,
    contextPolicy: overrides.contextPolicy ?? 'persistent',
    effectiveConfig: rawEffectiveConfig(),
    ...(overrides.workspace !== undefined ? { workspace: overrides.workspace } : {}),
    ...(overrides.groupId !== undefined ? { groupId: overrides.groupId } : {}),
    ...(overrides.activity !== undefined ? { activity: overrides.activity } : {}),
  }
}

/** A MemberInstance row (always carries a durable childSessionId, invariant 23). */
export function rawMember(index: number, overrides: RawMemberOverrides = {}): DurableMemberRow {
  return {
    instanceId: `inst-p8t2m${index}` as InstanceId,
    templateId: P8T2_FIXTURE.memberTemplateId,
    label: `Worker ${index}`,
    childSessionId: overrides.childSessionId ?? (`child-p8t2-${index}` as ChildSessionId),
    workspace: overrides.workspace,
    lifecycle: overrides.lifecycle ?? 'RUNNING',
    createdAt: P8T2_FIXTURE.createdAt,
    contextPolicy: overrides.contextPolicy ?? 'fresh_per_delegation',
    effectiveConfig: rawEffectiveConfig(),
    groupId: overrides.groupId,
    activity: overrides.activity,
  }
}

export interface MakeSourceOptions {
  readonly memberCount?: number
  readonly generation?: number
  readonly defaultWorkspace?: string | undefined
  readonly root?: Partial<TeamRootFacts>
  readonly templates?: readonly DurableTemplateRow[]
  readonly members?: readonly DurableMemberRow[]
  readonly ledger?: DurableLedgerSummary
  readonly teamSessionId?: TeamSessionId
}

/**
 * A structurally valid durable TeamDomain projection source.
 *
 * By default: one leader template + one member template, the LeaderInstance
 * plus `memberCount` MemberInstances (all inheriting the team default
 * workspace), generation 1, and a self-consistent empty ledger.
 */
export function makeSource(options: MakeSourceOptions = {}): TeamDomainProjectionSource {
  const memberCount = options.memberCount ?? 1
  const members: readonly DurableMemberRow[] =
    options.members ?? [
      rawLeaderMember(),
      ...Array.from({ length: memberCount }, (_, i) => rawMember(i + 1)),
    ]
  const templates = options.templates ?? [rawLeaderTemplate(), rawMemberTemplate()]
  const root: TeamRootFacts = {
    policyState: 'active',
    admission: 'OPEN',
    compatibility: rawCompatibility(),
    creationBudgetConsumed: 0,
    ...(options.root ?? {}),
  }
  return {
    teamSessionId: options.teamSessionId ?? P8T2_FIXTURE.teamSessionId,
    blueprint: {
      blueprintId: P8T2_FIXTURE.blueprintId,
      revision: P8T2_FIXTURE.blueprintRevision,
      contentHash: P8T2_FIXTURE.blueprintContentHash,
    },
    defaultWorkspace:
      options.defaultWorkspace === undefined ? P8T2_FIXTURE.defaultWorkspace : options.defaultWorkspace,
    createdAt: P8T2_FIXTURE.createdAt,
    generation: options.generation ?? 1,
    root,
    templates,
    members,
    ledger: options.ledger ?? rawLedger(),
  }
}

/**
 * The mock-first TeamDomain source port (DevPlan §21.2). The durable source
 * is returned BY REFERENCE; `readCount` / `readIds` are the "bounded durable
 * read" evidence channel. The NON-interface method {@link __readChildLog} is
 * the §21.2 red-line trap: it is NOT on {@link TeamDomainReadPort}, so the
 * fold can only ever call `readProjectionSource`; if it ever reached a
 * child-log read through the backing store, `childLogReadCount` would be
 * non-zero and the red-line test would fail.
 */
export class FakeDomainPort implements TeamDomainReadPort {
  /** Number of `readProjectionSource` calls. */
  readCount = 0
  /** The teamSessionIds passed to `readProjectionSource`, in order. */
  readonly readIds: string[] = []
  /** The §21.2 red-line trap counter (MUST stay 0 for a projection). */
  childLogReadCount = 0
  /**
   * The number of entries the team's child Session logs WOULD hold. This is a
   * backing-store fact deliberately NOT exposed on the port interface the fold
   * consumes: it models "large child-log volume" for the complexity guard,
   * which asserts the projection is byte-identical for volume 0 vs volume N
   * (the fold is never fed child logs — §21.2 red line).
   */
  readonly childLogVolume: number
  private readonly source: TeamDomainProjectionSource

  constructor(source: TeamDomainProjectionSource, childLogVolume = 0) {
    this.source = source
    this.childLogVolume = childLogVolume
  }

  readProjectionSource(teamSessionId: TeamSessionId): TeamDomainProjectionSource {
    this.readCount += 1
    this.readIds.push(teamSessionId)
    // Return by reference: a fold that mutated the source (rather than
    // building a fresh DTO) would be caught by the durable-truth assertions.
    return this.source
  }

  /**
   * NON-interface trap method (NOT part of {@link TeamDomainReadPort}): a
   * "read the child Session log" surface that a real TeamDomain backing
   * store might have. If the projection ever touched a child log through
   * the port, this would run and increment `childLogReadCount`.
   */
  __readChildLog(_instanceId: InstanceId): string {
    this.childLogReadCount += 1
    return `child-log-of:${_instanceId}`
  }
}

/**
 * The mock-first live residency/activity overlay port (UI §24). The live
 * overlay snapshot map is returned BY REFERENCE; `snapshotCount` is the "one
 * snapshot read per projection" evidence channel.
 */
export class FakeOverlayPort implements LiveResidencyOverlayPort {
  /** Number of `snapshot` calls. */
  snapshotCount = 0
  private readonly snapshotData: ReadonlyMap<InstanceId, MemberLiveActivityDto>

  constructor(snapshot: ReadonlyMap<InstanceId, MemberLiveActivityDto>) {
    this.snapshotData = snapshot
  }

  snapshot(): ReadonlyMap<InstanceId, MemberLiveActivityDto> {
    this.snapshotCount += 1
    return this.snapshotData
  }
}

export interface P8T2World {
  readonly service: ProjectionService
  readonly domain: FakeDomainPort
  readonly overlay: FakeOverlayPort | null
}

export interface CreateWorldOptions {
  readonly source?: TeamDomainProjectionSource
  /** The live overlay snapshot map, or `null` for a cold service. */
  readonly overlay?: ReadonlyMap<InstanceId, MemberLiveActivityDto> | null
  readonly clock?: ProjectionClock
  /**
   * The child-log volume the backing store would hold (complexity guard). It
   * is a fact on the fake ONLY — the fold never observes it (§21.2).
   */
  readonly childLogVolume?: number
}

/** One projection service world over the fakes (the deterministic clock). */
export function createP8T2World(options: CreateWorldOptions = {}): P8T2World {
  const source = options.source ?? makeSource()
  const domain = new FakeDomainPort(source, options.childLogVolume ?? 0)
  const overlay =
    options.overlay === undefined
      ? new FakeOverlayPort(new Map())
      : options.overlay === null
        ? null
        : new FakeOverlayPort(options.overlay)
  const service = createProjectionService(domain, overlay, {
    clock: options.clock ?? DEFAULT_PROJECTION_CLOCK,
  })
  return { service, domain, overlay }
}

/**
 * Assert that `error` is a {@link ProjectionError} with exactly `code`
 * (the closed service-level vocabulary assertion).
 * @throws a plain Error when the shape or the code does not match.
 */
export function assertProjectionCode(error: unknown, code: string): void {
  if (!(error instanceof ProjectionError)) {
    throw new Error(
      `assertProjectionCode: expected a ProjectionError but got ${
        error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      }`,
    )
  }
  if (error.code !== code) {
    throw new Error(
      `assertProjectionCode: expected ProjectionError code '${code}' but got '${error.code}' (${error.message})`,
    )
  }
}

/** The teamSessionId as a plain string (for the `readIds` channel asserts). */
export function teamSessionIdString(id: TeamSessionId): string {
  return id as string
}
