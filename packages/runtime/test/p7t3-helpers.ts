/**
 * p7t3-helpers — shared fixtures and world builders for the P7-T3
 * (MemberInstance lifecycle: Archive / Restore / Dispose + descendant
 * drain) tests (TaskDoc §11.5 P7-T3 card; ruling R34).
 *
 * Contents:
 *
 * - {@link P7T3_FIXTURE} / {@link P7T3_SPEC_A} … {@link P7T3_SPEC_D} —
 *   the P7-T3 fixture identities (frozen contracts v1 branded ids +
 *   creation specs), distinct from the P4 / P5 / P6 fixture values;
 * - {@link P7T3Clock} — the global call-order clock shared by every fake
 *   of one world (a single monotonic timeline: the machine-checkable
 *   evidence that the live steps ran in the frozen §20.3 order, before
 *   the durable commits);
 * - the mock-first quiescence fakes — {@link P7T3AdmissionFake} /
 *   {@link P7T3ActivityFake} / {@link P7T3DescendantsFake} /
 *   {@link P7T3ResidencyFake} (call recording, one-shot fault injection,
 *   and the G7 call-surface probes `resumeAgent` / `createAgent` that the
 *   restore-no-agent suite asserts were NEVER touched);
 * - {@link P7T3CommitFake} — the test binding of the P6-T2
 *   {@link LifecycleCommitPort}: the durable lifecycle commit over the
 *   REAL P4 repositories (the established P6-T2 pattern: tombstone
 *   `delete` + re-`put` of the transitioned record — the
 *   `member_instances` store is append-only per record, P4), with a
 *   fail-closed read-fresh `from`-check, call recording, and per-call
 *   fault injection (the crash-window arm);
 * - {@link createLifecycleWorld} — one durable TeamDomain world over the
 *   testkit `FileStorageSeam` (the REAL P4 repositories) + the fakes +
 *   the REAL `createLifecycleService` (the per-team lock under test in
 *   the dispose-race suite);
 * - {@link restartLifecycleWorld} — the process-restart model: a NEW
 *   seam over the SAME scratch dir re-opens the durable domain with FRESH
 *   fakes (the ephemeral residency does NOT survive; the durable records
 *   DO);
 * - {@link destroyWorld} / {@link captureError}.
 *
 * Top-level-await pattern (plain-node shim): the world is built, the
 * scenario executed, the observables captured into a plain snapshot, the
 * world destroyed in `finally`; the `it` bodies assert only over the
 * captured data (synchronously).
 *
 * @module @dsh-agent-team/runtime/test/p7t3-helpers
 */

import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../contracts/src/index.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import type { LifecycleCommitPort } from '../admission/index.js'
import { createLifecycleService, isLifecycleRuntimeError } from '../lifecycle/index.js'
import type {
  AdmissionClosePort,
  DescendantDrainPort,
  DescendantDrainReport,
  LifecyclePorts,
  LifecycleService,
  LifecycleTarget,
  MemberActivityPort,
} from '../lifecycle/index.js'
import { deriveMemberIdentity } from '../member-residency/index.js'
import type { MemberCreateSpec, ResidencyPort } from '../member-residency/index.js'

/** The P7-T3 fixture identities (frozen contracts v1 branded ids). */
export const P7T3_FIXTURE = {
  rootSessionId: parseRootSessionId('session-root-p7t3'),
  templateId: parseTemplateId('p7t3worker'),
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('P7T3-BP'),
    revision: parseBlueprintRevision('1'),
    contentHash: parseBlueprintContentHash('sha256-44444444444444444444444444444444'),
  }),
  createdAt: '2026-08-30T09:00:00Z',
}

/** Creation spec A — the canonical test member. */
export const P7T3_SPEC_A: MemberCreateSpec = {
  rootSessionId: 'session-root-p7t3',
  templateId: 'p7t3worker',
  label: 'p7t3-worker-a',
}

/** Creation spec B — the second member (the illegal-state matrix). */
export const P7T3_SPEC_B: MemberCreateSpec = {
  rootSessionId: 'session-root-p7t3',
  templateId: 'p7t3worker',
  label: 'p7t3-worker-b',
}

/** Creation spec C — the third member (the illegal-state matrix). */
export const P7T3_SPEC_C: MemberCreateSpec = {
  rootSessionId: 'session-root-p7t3',
  templateId: 'p7t3worker',
  label: 'p7t3-worker-c',
}

/** Creation spec D — the fourth member (the illegal-state matrix). */
export const P7T3_SPEC_D: MemberCreateSpec = {
  rootSessionId: 'session-root-p7t3',
  templateId: 'p7t3worker',
  label: 'p7t3-worker-d',
}

/**
 * The well-formed target of one fixture label WITHOUT requiring a seed row
 * (the MEMBER_NOT_FOUND scenarios: a valid-format identity that is absent
 * from the durable store).
 * @param label - the fixture label (P7T3_SPEC_A … P7T3_SPEC_D).
 */
export function p7t3TargetForLabel(label: string): LifecycleTarget {
  const spec = p7t3SpecForLabel(label)
  const identity = deriveMemberIdentity(spec)
  return { rootSessionId: spec.rootSessionId, instanceId: identity.instanceId }
}

/** Resolve the creation spec of a fixture label (the seed identity). */
export function p7t3SpecForLabel(label: string): MemberCreateSpec {
  switch (label) {
    case P7T3_SPEC_A.label:
      return P7T3_SPEC_A
    case P7T3_SPEC_B.label:
      return P7T3_SPEC_B
    case P7T3_SPEC_C.label:
      return P7T3_SPEC_C
    case P7T3_SPEC_D.label:
      return P7T3_SPEC_D
    default:
      throw new Error(`p7t3 helpers: no fixture spec for label '${label}'`)
  }
}

/** One event of the global world clock (a monotonic ordered timeline). */
export interface P7T3ClockEvent {
  /** The 1-based monotonic sequence number. */
  readonly seq: number
  /** The effect kind (the closed fake vocabulary). */
  readonly kind: string
  /** A lossless-JSON detail (ids / states, no live references). */
  readonly detail: string
}

/**
 * The global call-order clock of one world: every fake records its
 * effects here, so one assertion over `kinds()` is the machine-checkable
 * proof of the frozen procedure order (live steps → commits).
 */
export class P7T3Clock {
  /** The ordered event log (append-only). */
  readonly events: P7T3ClockEvent[] = []
  private seq = 0

  /** Record one effect. @returns the sequence number assigned. */
  tick(kind: string, detail = ''): number {
    this.seq += 1
    this.events.push({ seq: this.seq, kind, detail })
    return this.seq
  }

  /** The event kinds in order (the procedure-order assertion surface). */
  kinds(): string[] {
    return this.events.map((event) => event.kind)
  }

  /** The number of events of one kind. */
  countOf(kind: string): number {
    return this.events.filter((event) => event.kind === kind).length
  }
}

/** One recorded live call of a fake port. */
export interface P7T3LiveCall {
  readonly seq: number
  readonly detail: string
}

/**
 * The mock-first admission-close port (DevPlan §20.3 step 1) with call
 * recording, one-shot fault injection, and the G7 call-surface probes.
 */
export class P7T3AdmissionFake implements AdmissionClosePort {
  readonly clock: P7T3Clock
  readonly calls: P7T3LiveCall[] = []
  /** G7 probe: the live-surface `resume` call (must stay 0 for Restore). */
  resumeAgentCalls = 0
  /** G7 probe: the live-surface `create` call (must stay 0 for Restore). */
  createAgentCalls = 0
  /** One-shot fault (thrown on the next `closeNewWork`). */
  failNext: Error | undefined

  constructor(clock: P7T3Clock) {
    this.clock = clock
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  resumeAgent(): void {
    this.resumeAgentCalls += 1
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  createAgent(): void {
    this.createAgentCalls += 1
  }

  async closeNewWork(target: LifecycleTarget): Promise<void> {
    const seq = this.clock.tick('admission.close', `${target.rootSessionId}/${target.instanceId}`)
    this.calls.push({ seq, detail: `${target.rootSessionId}/${target.instanceId}` })
    if (this.failNext !== undefined) {
      const fault = this.failNext
      this.failNext = undefined
      throw fault
    }
  }
}

/**
 * The mock-first member-activity port (DevPlan §20.3 step 2) with call
 * recording, one-shot fault injection, and the G7 call-surface probes.
 */
export class P7T3ActivityFake implements MemberActivityPort {
  readonly clock: P7T3Clock
  readonly calls: P7T3LiveCall[] = []
  /** G7 probe: the live-surface `resume` call (must stay 0 for Restore). */
  resumeAgentCalls = 0
  /** G7 probe: the live-surface `create` call (must stay 0 for Restore). */
  createAgentCalls = 0
  /** One-shot fault (thrown on the next `interrupt`). */
  failNext: Error | undefined

  constructor(clock: P7T3Clock) {
    this.clock = clock
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  resumeAgent(): void {
    this.resumeAgentCalls += 1
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  createAgent(): void {
    this.createAgentCalls += 1
  }

  async interrupt(target: LifecycleTarget): Promise<void> {
    const seq = this.clock.tick('activity.interrupt', `${target.rootSessionId}/${target.instanceId}`)
    this.calls.push({ seq, detail: `${target.rootSessionId}/${target.instanceId}` })
    if (this.failNext !== undefined) {
      const fault = this.failNext
      this.failNext = undefined
      throw fault
    }
  }
}

/** One recorded descendant-drain call. */
export interface P7T3DrainCall {
  readonly seq: number
  readonly childSessionId: string
}

/**
 * The mock-first descendant-drain port (DevPlan §20.3 step 3, the public
 * descendant seam) with call recording, a configurable drain report (the
 * nested-subagent drain scenarios), one-shot fault injection, and the G7
 * call-surface probes.
 */
export class P7T3DescendantsFake implements DescendantDrainPort {
  readonly clock: P7T3Clock
  readonly calls: P7T3DrainCall[] = []
  /** G7 probe: the live-surface `resume` call (must stay 0 for Restore). */
  resumeAgentCalls = 0
  /** G7 probe: the live-surface `create` call (must stay 0 for Restore). */
  createAgentCalls = 0
  /** The report returned by every drain (default: no descendants, quiescent). */
  report: DescendantDrainReport = { drained: 0, quiescent: true }
  /** One-shot fault (thrown on the next `drainDescendants`). */
  failNext: Error | undefined

  constructor(clock: P7T3Clock) {
    this.clock = clock
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  resumeAgent(): void {
    this.resumeAgentCalls += 1
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  createAgent(): void {
    this.createAgentCalls += 1
  }

  async drainDescendants(childSessionId: string): Promise<DescendantDrainReport> {
    const seq = this.clock.tick('descendants.drain', childSessionId)
    this.calls.push({ seq, childSessionId })
    if (this.failNext !== undefined) {
      const fault = this.failNext
      this.failNext = undefined
      throw fault
    }
    return this.report
  }
}

/** One recorded residency-drop call. */
export interface P7T3DropCall {
  readonly seq: number
  readonly sessionId: string
  readonly dropped: boolean
}

/**
 * The mock-first P5-T6 {@link ResidencyPort} (Map-backed ephemeral
 * residency state) with call recording and the G7 call-surface probes.
 * `hasResidency` is a state READ — it does not tick the clock (only real
 * effects do).
 */
export class P7T3ResidencyFake implements ResidencyPort {
  readonly clock: P7T3Clock
  readonly residents: Set<string> = new Set()
  readonly dropCalls: P7T3DropCall[] = []
  /** G7 probe: the live-surface `resume` call (must stay 0 for Restore). */
  resumeAgentCalls = 0
  /** G7 probe: the live-surface `create` call (must stay 0 for Restore). */
  createAgentCalls = 0

  constructor(clock: P7T3Clock) {
    this.clock = clock
  }

  /** Seed one live residency (world pre-arrangement). */
  markResident(sessionId: string): void {
    this.residents.add(sessionId)
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  resumeAgent(): void {
    this.resumeAgentCalls += 1
  }

  /** The G7 call-surface probe (a real live binding would hold this). */
  createAgent(): void {
    this.createAgentCalls += 1
  }

  hasResidency(sessionId: string): boolean {
    return this.residents.has(sessionId)
  }

  dropResidency(sessionId: string): boolean {
    const seq = this.clock.tick('residency.drop', sessionId)
    const dropped = this.residents.delete(sessionId)
    this.dropCalls.push({ seq, sessionId, dropped })
    return dropped
  }
}

/** One recorded durable commit call. */
export interface P7T3CommitCall {
  readonly seq: number
  readonly rootSessionId: string
  readonly instanceId: string
  readonly from: string
  readonly operation: string
  readonly to: string
}

/**
 * The test binding of the P6-T2 {@link LifecycleCommitPort}: the durable
 * lifecycle commit over the REAL P4 repositories — the established P6-T2
 * pattern (tombstone `delete` + re-`put` of the transitioned record: the
 * `member_instances` store is append-only per record, P4).
 *
 * Fail-closed like the real binding: it reads the record FRESH, verifies
 * `current.lifecycle === args.from` (a drift is a hard fault), and only
 * then writes the transitioned record (`activityVersion + 1`, the
 * domain D3 rule). Call recording + per-call fault injection (the
 * crash-window arm).
 */
export class P7T3CommitFake implements LifecycleCommitPort {
  readonly clock: P7T3Clock
  readonly domain: TeamDomain
  readonly calls: P7T3CommitCall[] = []
  /** One-shot fault (thrown on the next commit). */
  failNext: Error | undefined
  /** The 1-based call number to fault (one-shot). */
  failAt: number | undefined
  /** The fault thrown by `failAt`. */
  failFault: Error | undefined

  constructor(clock: P7T3Clock, domain: TeamDomain) {
    this.clock = clock
    this.domain = domain
  }

  /** Arm a fault for the Nth commit call (1-based; one-shot). */
  failCallNumber(n: number, fault: Error): void {
    this.failAt = n
    this.failFault = fault
  }

  async commitTransition(args: {
    readonly rootSessionId: string
    readonly instanceId: string
    readonly from: MemberLifecycleState
    readonly operation: string
    readonly to: MemberLifecycleState
  }): Promise<void> {
    const seq = this.clock.tick('commit', `${args.operation}:${args.from}->${args.to}`)
    this.calls.push({
      seq,
      rootSessionId: args.rootSessionId,
      instanceId: args.instanceId,
      from: args.from,
      operation: args.operation,
      to: args.to,
    })
    if (this.failNext !== undefined) {
      const fault = this.failNext
      this.failNext = undefined
      throw fault
    }
    if (this.failAt !== undefined && this.calls.length === this.failAt) {
      const fault = this.failFault
      this.failAt = undefined
      this.failFault = undefined
      throw fault
    }
    const repo = this.domain.repositories.memberInstances
    const current = repo.get(args.rootSessionId, args.instanceId)
    if (current === undefined) {
      throw new Error(`p7t3 commit fake: member '${args.instanceId}' vanished before commit`)
    }
    if (current.lifecycle !== args.from) {
      throw new Error(
        `p7t3 commit fake: lifecycle drift: expected from '${args.from}', found '${current.lifecycle}'`,
      )
    }
    await repo.delete(args.rootSessionId, args.instanceId)
    await repo.put({
      rootSessionId: current.rootSessionId,
      instanceId: current.instanceId,
      templateId: current.templateId,
      label: current.label,
      ...(current.groupId !== undefined ? { groupId: current.groupId } : {}),
      childSessionId: current.childSessionId,
      ...(current.workspace !== undefined ? { workspace: current.workspace } : {}),
      lifecycle: args.to,
      createdAt: current.createdAt,
      activityVersion: current.activityVersion + 1,
    })
  }
}

/** One seeded member of a world. */
export interface P7T3SeedMember {
  /** The fixture label (P7T3_SPEC_A … P7T3_SPEC_D). */
  readonly label: string
  /** The seeded durable lifecycle state. */
  readonly lifecycle: MemberLifecycleState
  /** The seeded activity version (default 1). */
  readonly activityVersion?: number
  /** Seed one live (ephemeral) residency on the member child session. */
  readonly resident?: boolean
}

/** The options of one world. */
export interface P7T3WorldOptions {
  /** Seed the TeamSession + team-root binding (default `true`). */
  readonly seedRoot?: boolean
  /** The member rows to seed. */
  readonly seedMembers?: readonly P7T3SeedMember[]
  /** The drain report of the descendant seam (default: quiescent, 0). */
  readonly drainReport?: DescendantDrainReport
}

/** One durable TeamDomain world + the mock-first live ports. */
export interface P7T3World {
  /** The scratch dir (survives a restart). */
  readonly scratchDir: string
  /** The storage seam (one per world generation). */
  readonly seam: FileStorageSeam
  /** The REAL P4 TeamDomain (the durable authority under assertion). */
  readonly domain: TeamDomain
  /** The global call-order clock (shared across restarts). */
  readonly clock: P7T3Clock
  /** The admission-close fake (step `close-admission`). */
  readonly admission: P7T3AdmissionFake
  /** The member-activity fake (step `interrupt`). */
  readonly activity: P7T3ActivityFake
  /** The descendant-drain fake (step `drain-descendants`). */
  readonly descendants: P7T3DescendantsFake
  /** The residency fake (step `release-residency`). */
  readonly residency: P7T3ResidencyFake
  /** The durable commit fake (the commit steps). */
  readonly commit: P7T3CommitFake
  /** The ports bundle (the REAL service wiring under test). */
  readonly ports: LifecyclePorts
  /** The REAL locked service (the per-team lock of `createLifecycleService`). */
  readonly service: LifecycleService
  /** The seeded member targets, by label. */
  readonly targets: Record<string, LifecycleTarget>
  /** The seeded member child sessions, by label. */
  readonly childSessions: Record<string, string>
  /** Resolve the target of a seeded label (throws when absent). */
  target(label: string): LifecycleTarget
  /** Read one durable member record by seeded label. */
  recordFor(label: string): MemberInstanceRecordDto | undefined
  /** Close the domain and remove the scratch dir (test cleanup). */
  destroy(): Promise<void>
}

/**
 * Wire one world generation over an open domain: FRESH fakes (the
 * ephemeral residency starts empty on every generation) over the shared
 * clock, the REAL `createLifecycleService`, and the seed bookkeeping.
 */
function finishWorld(
  scratchDir: string,
  seam: FileStorageSeam,
  domain: TeamDomain,
  clock: P7T3Clock,
  drainReport: DescendantDrainReport | undefined,
  carry?: {
    readonly targets: Record<string, LifecycleTarget>
    readonly childSessions: Record<string, string>
  },
): P7T3World {
  const admission = new P7T3AdmissionFake(clock)
  const activity = new P7T3ActivityFake(clock)
  const descendants = new P7T3DescendantsFake(clock)
  const residency = new P7T3ResidencyFake(clock)
  const commit = new P7T3CommitFake(clock, domain)
  if (drainReport !== undefined) descendants.report = drainReport
  const ports: LifecyclePorts = { teamDomain: domain, commit, admission, activity, descendants, residency }
  const service = createLifecycleService(ports)
  const targets: Record<string, LifecycleTarget> = carry ? { ...carry.targets } : {}
  const childSessions: Record<string, string> = carry ? { ...carry.childSessions } : {}
  return {
    scratchDir,
    seam,
    domain,
    clock,
    admission,
    activity,
    descendants,
    residency,
    commit,
    ports,
    service,
    targets,
    childSessions,
    target(label: string): LifecycleTarget {
      const t = targets[label]
      if (t === undefined) throw new Error(`p7t3 world: no member '${label}' seeded`)
      return t
    },
    recordFor(label: string): MemberInstanceRecordDto | undefined {
      const t = targets[label]
      if (t === undefined) throw new Error(`p7t3 world: no member '${label}' seeded`)
      return domain.repositories.memberInstances.get(t.rootSessionId, t.instanceId)
    },
    destroy: async () => {
      await domain.close()
      destroyDir(scratchDir)
    },
  }
}

/**
 * Create one durable world over a FRESH scratch dir and seed it (the
 * seeds are world pre-arrangement, NOT module writes).
 * @param basename - the scratch dir basename (unique per scenario).
 * @param options - the seed options.
 */
export async function createLifecycleWorld(
  basename: string,
  options: P7T3WorldOptions = {},
): Promise<P7T3World> {
  const dir = scratchDir(basename)
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  const world = finishWorld(dir, seam, domain, new P7T3Clock(), options.drainReport)
  await seedRows(world, options)
  return world
}

/**
 * The process-restart model: close the old world generation, open a NEW
 * seam over the SAME scratch dir (the durable records survive; the
 * ephemeral residency and every live fake do NOT — fresh fakes start
 * empty), keeping the shared clock for one global timeline.
 * @param world - the world generation to restart.
 * @returns the re-wired world generation over the same scratch dir.
 */
export async function restartLifecycleWorld(world: P7T3World): Promise<P7T3World> {
  await world.domain.close()
  const seam = new FileStorageSeam(world.scratchDir)
  const domain = await openTeamDomain(seam)
  return finishWorld(world.scratchDir, seam, domain, world.clock, undefined, {
    targets: world.targets,
    childSessions: world.childSessions,
  })
}

/**
 * Seed the optional world rows through the SAME repositories.
 * @param world - the fresh world.
 * @param options - the seed rows to add.
 */
async function seedRows(world: P7T3World, options: P7T3WorldOptions): Promise<void> {
  const root = String(P7T3_FIXTURE.rootSessionId)
  if (options.seedRoot !== false) {
    await world.domain.repositories.teamSessions.put({
      rootSessionId: P7T3_FIXTURE.rootSessionId,
      blueprint: P7T3_FIXTURE.blueprint,
      createdAt: P7T3_FIXTURE.createdAt,
      generation: 1,
    })
    await world.domain.repositories.sessionBindings.put({
      kind: 'team-root',
      schemaVersion: 1,
      sessionId: root,
    })
  }
  const seeds = options.seedMembers ?? []
  for (const seed of seeds) {
    const spec = p7t3SpecForLabel(seed.label)
    const identity = deriveMemberIdentity(spec)
    await world.domain.repositories.memberInstances.put({
      rootSessionId: parseRootSessionId(root),
      instanceId: parseInstanceId(identity.instanceId),
      templateId: P7T3_FIXTURE.templateId,
      label: seed.label,
      childSessionId: parseChildSessionId(identity.childSessionId),
      lifecycle: seed.lifecycle,
      createdAt: P7T3_FIXTURE.createdAt,
      activityVersion: seed.activityVersion ?? 1,
    })
    await world.domain.repositories.sessionBindings.put({
      kind: 'team-member',
      schemaVersion: 1,
      sessionId: identity.childSessionId,
      rootSessionId: root,
      instanceId: identity.instanceId,
    })
    if (seed.resident) world.residency.markResident(identity.childSessionId)
    world.targets[seed.label] = { rootSessionId: root, instanceId: identity.instanceId }
    world.childSessions[seed.label] = identity.childSessionId
  }
}

/** Close the domain and remove the scratch dir (test cleanup). */
export async function destroyWorld(world: P7T3World): Promise<void> {
  await world.destroy()
}

/**
 * The extracted fields of one thrown value (the test assertion surface):
 * narrows a `LifecycleRuntimeError` to its closed `code` + the relevant
 * `details` fields as primitives; a non-lifecycle throw is reported with
 * `isLifecycle: false` and its `name`/string as `code`.
 */
export interface P7T3ErrorFields {
  /** True when the thrown value is a `LifecycleRuntimeError`. */
  readonly isLifecycle: boolean
  /** The closed code, or the thrown value's `name`/string. */
  readonly code: string
  /** `details.step` (live / write-fault step). */
  readonly step: string | undefined
  /** `details.from` (ILLEGAL_STATE). */
  readonly from: string | undefined
  /** `details.to` (ILLEGAL_STATE). */
  readonly to: string | undefined
  /** `details.reason` (ILLEGAL_STATE). */
  readonly reason: string | undefined
  /** `details.phase` (DURABLE_STATE_FAILED: `read` | `write`). */
  readonly phase: string | undefined
  /** `details.drained` (NOT_QUIESCENT residual). */
  readonly drained: number | undefined
  /** `details.reason === 'malformed-drain-report'` (NOT_QUIESCENT). */
  readonly malformed: boolean
  /** `details.field` (INVALID_INPUT). */
  readonly field: string | undefined
  /** `details.cause` (INVALID_INPUT). */
  readonly cause: string | undefined
}

/** Extract the assertion surface of one thrown value (see above). */
export function runtimeErrorFields(error: unknown): P7T3ErrorFields {
  if (isLifecycleRuntimeError(error)) {
    const d = error.details
    const str = (key: string): string | undefined =>
      typeof d[key] === 'string' ? (d[key] as string) : undefined
    const num = (key: string): number | undefined =>
      typeof d[key] === 'number' ? (d[key] as number) : undefined
    return {
      isLifecycle: true,
      code: error.code,
      step: str('step'),
      from: str('from'),
      to: str('to'),
      reason: str('reason'),
      phase: str('phase'),
      drained: num('drained'),
      malformed: d['reason'] === 'malformed-drain-report',
      field: str('field'),
      cause: str('cause'),
    }
  }
  return {
    isLifecycle: false,
    code: error instanceof Error ? error.name : String(error),
    step: undefined,
    from: undefined,
    to: undefined,
    reason: undefined,
    phase: undefined,
    drained: undefined,
    malformed: false,
    field: undefined,
    cause: undefined,
  }
}

/**
 * Capture the error thrown by one async operation (a no-throw is a test
 * bug: the scenario expected a rejection).
 * @param fn - the async function expected to throw.
 * @returns the thrown error.
 */
export async function captureError(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
  } catch (error) {
    return error
  }
  throw new Error('captureError: the function under test did not throw')
}
