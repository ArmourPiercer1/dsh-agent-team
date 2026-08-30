/**
 * p5t6-helpers — shared fixtures and world builders for the P5-T6
 * (member create/resume residency) tests (TaskDoc §11.5 P5-T6 card;
 * ruling R34).
 *
 * Contents:
 *
 * - {@link P5T6_FIXTURE} — the P5-T6 fixture identities (frozen
 *   contracts v1 branded ids + the creation specs), distinct from the
 *   P4 / P5-T1 / P5-T5 fixture values;
 * - {@link P5T6_SPEC_A} / {@link P5T6_SPEC_B} — the two creation specs
 *   (different labels → different derived identities; B carries
 *   `groupId` + `workspace`);
 * - {@link FakeResidencyPort} — the mock-first {@link ResidencyPort}
 *   (the ephemeral-residency boundary of the evict path): Map-backed
 *   live state, call recording, one-shot drop fault injection;
 * - {@link FakeSessionDurability} — the mock-first
 *   {@link SessionDurabilityPort} (the child-Session durability barrier
 *   of the fresh path): call recording, one-shot fault injection;
 * - {@link createMemberResidencyWorld} — one durable TeamDomain world
 *   over the testkit `FileStorageSeam` (the REAL P4 repositories + the
 *   REAL read-handle projection (P5-T1) + the REAL write-port adapter
 *   (P5-T6) wrapped in a recording proxy), the mock-first
 *   `FakeAgentSetupSurface` (P5-T1) as the agent-runtime boundary, the
 *   `FakeResidencyPort`, and a deterministic clock;
 * - {@link restartMemberResidencyWorld} — the process-restart model
 *   (DevPlan §18.5): a NEW seam over the SAME scratch dir re-opens the
 *   durable domain with a FRESH surface (empty residency) and a FRESH
 *   residency port (the ephemeral state is lost; the durable rows are
 *   not);
 * - {@link destroyWorld} — closes the domain and removes the scratch dir.
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code.
 * @module @dsh-agent-team/runtime/test/p5t6-helpers
 */

import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberLifecycleState } from '../../contracts/src/index.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createTeamDomainReadHandle } from '../agent-setup/binder/index.js'
import type { TeamDomainReadHandle } from '../agent-setup/binder/index.js'
import { createMemberDomainWritePort, deriveMemberIdentity } from '../member-residency/index.js'
import type {
  MemberCreateSpec,
  MemberDomainWritePort,
  MemberResidencyPorts,
  ResidencyPort,
  SessionDurabilityPort,
} from '../member-residency/index.js'
import { FakeAgentSetupSurface } from './p5t1-helpers.js'

/** The P5-T6 fixture identities (frozen contracts v1 branded ids). */
export const P5T6_FIXTURE = {
  rootSessionId: parseRootSessionId('session-root-p5t6'),
  ordinarySessionId: parseSessionId('session-ordinary-p5t6'),
  templateId: parseTemplateId('p5t6worker'),
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('P5T6-BP'),
    revision: parseBlueprintRevision('1'),
    contentHash: parseBlueprintContentHash('sha256-33333333333333333333333333333333'),
  }),
  defaultWorkspace: 'C:/agent-team/work/p5t6',
  createdAt: '2026-08-30T07:00:00Z',
}

/** Creation spec A — the minimal member (no groupId / workspace). */
export const P5T6_SPEC_A: MemberCreateSpec = {
  rootSessionId: 'session-root-p5t6',
  templateId: 'p5t6worker',
  label: 'worker-a',
}

/** Creation spec B — carries groupId + workspace (a different identity). */
export const P5T6_SPEC_B: MemberCreateSpec = {
  rootSessionId: 'session-root-p5t6',
  templateId: 'p5t6worker',
  label: 'worker-b',
  groupId: 'grp-p5t6',
  workspace: 'C:/agent-team/work/p5t6',
}

/** One recorded call of the fake residency port. */
export interface FakeResidencyCall {
  readonly method: 'hasResidency' | 'dropResidency'
  readonly sessionId: string
  /** The returned boolean. */
  readonly result: boolean
}

/**
 * The mock-first {@link ResidencyPort} (the evict path's only contact
 * with the live agent runtime): Map-backed live state, call recording,
 * and one-shot drop fault injection.
 */
export class FakeResidencyPort implements ResidencyPort {
  /** Every call, in order (the call-recording evidence). */
  readonly calls: FakeResidencyCall[] = []
  private readonly live = new Map<string, boolean>()
  private nextDropFault: Error | undefined

  /** Set (or clear) the simulated live residency of one session. */
  setResidency(sessionId: string, present: boolean): void {
    this.live.set(sessionId, present)
  }

  hasResidency(sessionId: string): boolean {
    const result = this.live.get(sessionId) ?? false
    this.calls.push({ method: 'hasResidency', sessionId, result })
    return result
  }

  dropResidency(sessionId: string): boolean {
    if (this.nextDropFault !== undefined) {
      const fault = this.nextDropFault
      this.nextDropFault = undefined
      throw fault
    }
    const had = this.live.get(sessionId) ?? false
    if (had) {
      this.live.set(sessionId, false)
    }
    this.calls.push({ method: 'dropResidency', sessionId, result: had })
    return had
  }

  /** Inject a fault into the NEXT `dropResidency` call only. */
  failNextDrop(fault: Error): void {
    this.nextDropFault = fault
  }
}

/**
 * The mock-first {@link SessionDurabilityPort} (the child-Session
 * durability barrier of the fresh path): records every `ensureDurable`
 * call in order (the ordering / zero-write proof channel) and supports
 * one-shot fault injection. A resolved call is the no-op the contract
 * demands for an already-durable session.
 */
export class FakeSessionDurability implements SessionDurabilityPort {
  /** Every `ensureDurable(childSessionId)` call, in order. */
  readonly calls: string[] = []

  private nextEnsureDurableFault: Error | undefined = undefined

  ensureDurable(childSessionId: string): Promise<void> {
    this.calls.push(childSessionId)
    if (this.nextEnsureDurableFault !== undefined) {
      const fault = this.nextEnsureDurableFault
      this.nextEnsureDurableFault = undefined
      return Promise.reject(fault)
    }
    return Promise.resolve()
  }

  /** Inject a fault into the NEXT `ensureDurable` call only. */
  failNextEnsureDurable(fault: Error): void {
    this.nextEnsureDurableFault = fault
  }
}

/** One recorded durable write call of the world's recording proxy. */
export interface P5T6WriteCall {
  readonly method: 'putMemberInstance' | 'putSessionBinding'
}

/** One durable TeamDomain world wired for the member residency. */
export interface P5T6World {
  /** The scratch dir backing the seam (destroyed by `destroyWorld`). */
  readonly scratchDir: string
  /** The file seam (backing medium for the durable world). */
  readonly seam: FileStorageSeam
  /** The open durable domain (the repositories are the write source). */
  readonly domain: TeamDomain
  /** The binder's read handle over the domain repositories (P5-T1). */
  readonly readHandle: TeamDomainReadHandle
  /** The REAL write-port adapter wrapped in a recording proxy. */
  readonly writes: MemberDomainWritePort
  /** Every attempted durable write, in order (zero-write proof channel). */
  readonly writeCalls: P5T6WriteCall[]
  /** The mock-first agent-setup surface (the agent-runtime boundary). */
  readonly surface: FakeAgentSetupSurface
  /** The mock-first residency port (the evict path's live boundary). */
  readonly residency: FakeResidencyPort
  /** The mock-first child-Session durability barrier (fresh path). */
  readonly durability: FakeSessionDurability
  /** The deterministic clock (1s ticks from the fixture base time). */
  readonly now: () => string
  /** The ports wired over this world (for the member-residency entry points). */
  readonly ports: MemberResidencyPorts
  /** Inject a fault into the NEXT `putMemberInstance` attempt (the recording is kept). */
  readonly failNextPutMemberInstance: (fault: Error) => void
  /** Inject a fault into the NEXT `putSessionBinding` attempt (the recording is kept). */
  readonly failNextPutSessionBinding: (fault: Error) => void
}

/** The seed shape of one pre-existing member (crash-window / lifecycle worlds). */
export interface P5T6SeedMemberOptions {
  /** The creation spec the seed row derives from (same identity the module derives). */
  readonly spec: MemberCreateSpec
  /** The seeded lifecycle (default `CREATED`). */
  readonly lifecycle?: MemberLifecycleState
  /** The seeded activityVersion (default 1). */
  readonly activityVersion?: number
  /** Seed the MemberInstance record (default `true`; `false` = the binding-only crash window). */
  readonly withRecord?: boolean
  /** Seed the `team-member` binding row (default `true`; `false` = the record-only crash window). */
  readonly withBinding?: boolean
}

/**
 * World-seeding options (the root / conflict / integrity worlds). Seeds
 * flow through the SAME repositories (world pre-arrangement, NOT module
 * writes — they do not flow through the write proxy's `writeCalls`).
 */
export interface P5T6WorldOptions {
  /** Seed the bound Team root: TeamSession record + `team-root` binding row. */
  readonly seedBoundRoot?: boolean
  /** Seed a `team-root` binding row WITHOUT the TeamSession record (the integrity-violation world). */
  readonly seedOrphanRootBinding?: boolean
  /** Seed an `ordinary` binding row for the fixture ordinary session. */
  readonly seedOrdinaryBinding?: boolean
  /** Seed one member's durable rows (record / binding, crash windows selectable). */
  readonly seedMember?: P5T6SeedMemberOptions
}

/**
 * The deterministic clock: 1-second ticks starting after the fixture
 * base time (deterministic `createdAt` stamps across tests).
 */
export function makeNow(): () => string {
  let t = Date.parse(P5T6_FIXTURE.createdAt)
  return () => {
    t += 1000
    return new Date(t).toISOString()
  }
}

/**
 * Create one durable TeamDomain world over a FRESH scratch dir, wired
 * with the real P4 repositories (write source), the real read-handle
 * projection (P5-T1), the real write-port adapter wrapped in a
 * recording proxy, the mock-first surface, the mock-first residency
 * port, and a deterministic clock.
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param options - optional seed rows (see {@link P5T6WorldOptions}).
 */
export async function createMemberResidencyWorld(
  basename: string,
  options: P5T6WorldOptions = {},
): Promise<P5T6World> {
  const dir = scratchDir(basename)
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  const world = finishWorld(dir, seam, domain)
  await seedRows(world, options)
  return world
}

/**
 * The process-restart model (DevPlan §18.5): close the old world, open a
 * NEW seam over the SAME scratch dir (the durable records survive; the
 * ephemeral Agent residency does NOT — a FRESH surface and a FRESH
 * residency port start empty).
 *
 * @param world - the world to restart.
 * @returns the re-wired world over the same scratch dir.
 */
export async function restartMemberResidencyWorld(world: P5T6World): Promise<P5T6World> {
  await world.domain.close()
  const seam = new FileStorageSeam(world.scratchDir)
  const domain = await openTeamDomain(seam)
  return finishWorld(world.scratchDir, seam, domain)
}

/** Wire one world record over an open domain (shared by create/restart). */
function finishWorld(
  scratchDir: string,
  seam: FileStorageSeam,
  domain: TeamDomain,
): P5T6World {
  const readHandle = createTeamDomainReadHandle(domain.repositories)
  const baseWritePort = createMemberDomainWritePort(domain.repositories)
  const writeCalls: P5T6WriteCall[] = []
  let nextPutMemberInstanceFault: Error | undefined
  let nextPutSessionBindingFault: Error | undefined
  const writes: MemberDomainWritePort = {
    putMemberInstance(input) {
      writeCalls.push({ method: 'putMemberInstance' })
      if (nextPutMemberInstanceFault !== undefined) {
        const fault = nextPutMemberInstanceFault
        nextPutMemberInstanceFault = undefined
        throw fault
      }
      return baseWritePort.putMemberInstance(input)
    },
    putSessionBinding(binding) {
      writeCalls.push({ method: 'putSessionBinding' })
      if (nextPutSessionBindingFault !== undefined) {
        const fault = nextPutSessionBindingFault
        nextPutSessionBindingFault = undefined
        throw fault
      }
      return baseWritePort.putSessionBinding(binding)
    },
  }
  const surface = new FakeAgentSetupSurface()
  const residency = new FakeResidencyPort()
  const durability = new FakeSessionDurability()
  const now = makeNow()
  const ports: MemberResidencyPorts = {
    teamDomain: readHandle,
    writes,
    surface,
    residency,
    sessionDurability: durability,
    now,
  }
  return {
    scratchDir,
    seam,
    domain,
    readHandle,
    writes,
    writeCalls,
    surface,
    residency,
    durability,
    now,
    ports,
    failNextPutMemberInstance: (fault: Error) => {
      nextPutMemberInstanceFault = fault
    },
    failNextPutSessionBinding: (fault: Error) => {
      nextPutSessionBindingFault = fault
    },
  }
}

/**
 * Seed the optional world rows through the SAME repositories (the seeds
 * are world pre-arrangement, NOT module writes).
 *
 * @param world - the fresh world.
 * @param options - the seed rows to add.
 */
async function seedRows(world: P5T6World, options: P5T6WorldOptions): Promise<void> {
  const root = String(P5T6_FIXTURE.rootSessionId)
  if (options.seedBoundRoot) {
    await world.domain.repositories.teamSessions.put({
      rootSessionId: P5T6_FIXTURE.rootSessionId,
      blueprint: P5T6_FIXTURE.blueprint,
      createdAt: P5T6_FIXTURE.createdAt,
      generation: 1,
    })
    await world.domain.repositories.sessionBindings.put({
      kind: 'team-root',
      schemaVersion: 1,
      sessionId: root,
    })
  }
  if (options.seedOrphanRootBinding) {
    await world.domain.repositories.sessionBindings.put({
      kind: 'team-root',
      schemaVersion: 1,
      sessionId: root,
    })
  }
  if (options.seedOrdinaryBinding) {
    await world.domain.repositories.sessionBindings.put({
      kind: 'ordinary',
      schemaVersion: 1,
      sessionId: String(P5T6_FIXTURE.ordinarySessionId),
    })
  }
  if (options.seedMember !== undefined) {
    const seed = options.seedMember
    const identity = deriveMemberIdentity(seed.spec)
    if (seed.withRecord !== false) {
      await world.domain.repositories.memberInstances.put({
        rootSessionId: parseRootSessionId(seed.spec.rootSessionId),
        instanceId: parseInstanceId(identity.instanceId),
        templateId: parseTemplateId(seed.spec.templateId),
        label: seed.spec.label,
        ...(seed.spec.groupId !== undefined ? { groupId: seed.spec.groupId } : {}),
        childSessionId: parseChildSessionId(identity.childSessionId),
        ...(seed.spec.workspace !== undefined ? { workspace: seed.spec.workspace } : {}),
        lifecycle: seed.lifecycle ?? 'CREATED',
        createdAt: P5T6_FIXTURE.createdAt,
        activityVersion: seed.activityVersion ?? 1,
      })
    }
    if (seed.withBinding !== false) {
      await world.domain.repositories.sessionBindings.put({
        kind: 'team-member',
        schemaVersion: 1,
        sessionId: identity.childSessionId,
        rootSessionId: seed.spec.rootSessionId,
        instanceId: identity.instanceId,
      })
    }
  }
}

/** Close the domain and remove the scratch dir (test cleanup). */
export async function destroyWorld(world: P5T6World): Promise<void> {
  await world.domain.close()
  destroyDir(world.scratchDir)
}

/**
 * Assert-and-return helper: run an async fn, expect it to throw, and
 * return the thrown error (the shim has no `rejects` matcher).
 *
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

export { FakeAgentSetupSurface }
