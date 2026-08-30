/**
 * p5t5-helpers — shared fixtures and world builders for the P5-T5
 * (root-binding) tests (TaskDoc §11.5 I-1 real binding; ruling R32).
 *
 * Contents:
 *
 * - {@link P5T5_FIXTURE} — the P5-T5 fixture identities (frozen
 *   contracts v1 branded ids), distinct from the P4/P5-T1 fixture values;
 * - {@link createRootBindingWorld} — one durable TeamDomain world over
 *   the testkit `FileStorageSeam` (the REAL P4 repositories + the REAL
 *   read-handle projection (P5-T1) + the REAL write-port adapter
 *   (P5-T5) wrapped in a recording proxy), plus the mock-first
 *   `FakeAgentSetupSurface` (P5-T1) as the agent-runtime boundary and a
 *   deterministic clock;
 * - {@link restartRootBindingWorld} — the process-restart model
 *   (DevPlan §18.5): a NEW seam instance over the SAME scratch dir
 *   re-opens the durable domain with a FRESH surface (empty residency);
 * - {@link destroyWorld} — closes the domain and removes the scratch dir.
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code.
 * @module @dsh-agent-team/runtime/test/p5t5-helpers
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
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { createTeamDomainReadHandle } from '../agent-setup/binder/index.js'
import type { TeamDomainReadHandle } from '../agent-setup/binder/index.js'
import { createTeamDomainWritePort } from '../root-binding/index.js'
import type { RootBindingPorts, TeamDomainWritePort } from '../root-binding/index.js'
import { FakeAgentSetupSurface } from './p5t1-helpers.js'

/** The P5-T5 fixture identities (frozen contracts v1 branded ids). */
export const P5T5_FIXTURE = {
  rootSessionId: parseRootSessionId('session-root-p5t5'),
  memberSessionId: parseChildSessionId('session-child-p5t5'),
  ordinarySessionId: parseSessionId('session-ordinary-p5t5'),
  instanceId: parseInstanceId('inst-p5t5alpha'),
  templateId: parseTemplateId('p5t5worker'),
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('P5T5-BP'),
    revision: parseBlueprintRevision('1'),
    contentHash: parseBlueprintContentHash('sha256-11111111111111111111111111111111'),
  }),
  /** A DIFFERENT immutable snapshot (the conflict-world blueprint). */
  blueprintOther: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('P5T5-BP2'),
    revision: parseBlueprintRevision('1'),
    contentHash: parseBlueprintContentHash('sha256-22222222222222222222222222222222'),
  }),
  defaultWorkspace: 'C:/agent-team/work/p5t5',
  createdAt: '2026-08-30T06:00:00Z',
}

/** One recorded durable write call of the world's recording proxy. */
export interface P5T5WriteCall {
  readonly method: 'putTeamSession' | 'putSessionBinding'
}

/** One durable TeamDomain world wired for the root binding. */
export interface P5T5World {
  /** The scratch dir backing the seam (destroyed by `destroyWorld`). */
  readonly scratchDir: string
  /** The file seam (backing medium for the durable world). */
  readonly seam: FileStorageSeam
  /** The open durable domain (the repositories are the write source). */
  readonly domain: TeamDomain
  /** The binder's read handle over the domain repositories (P5-T1). */
  readonly readHandle: TeamDomainReadHandle
  /** The REAL write-port adapter wrapped in a recording proxy. */
  readonly writes: TeamDomainWritePort
  /** Every attempted durable write, in order (zero-write proof channel). */
  readonly writeCalls: P5T5WriteCall[]
  /** The mock-first agent-setup surface (the agent-runtime boundary). */
  readonly surface: FakeAgentSetupSurface
  /** The deterministic clock (1s ticks from the fixture base time). */
  readonly now: () => string
  /** The ports wired over this world (for the root-binding entry points). */
  readonly ports: RootBindingPorts
}

/**
 * World-seeding options (the conflict / integrity / ordinary worlds).
 */
export interface P5T5WorldOptions {
  /** Seed a `team-member` binding row for the fixture member session (the kind-conflict world). */
  readonly seedMemberBinding?: boolean
  /** Seed a `team-root` binding row WITHOUT the TeamSession record (the integrity-violation world). */
  readonly seedOrphanRootBinding?: boolean
  /** Seed an `ordinary` binding row for the fixture ordinary session (the S4 world). */
  readonly seedOrdinaryBinding?: boolean
}

/**
 * The deterministic clock: 1-second ticks starting after the fixture
 * base time (deterministic `createdAt` stamps across tests).
 */
export function makeNow(): () => string {
  let t = Date.parse(P5T5_FIXTURE.createdAt)
  return () => {
    t += 1000
    return new Date(t).toISOString()
  }
}

/**
 * Create one durable TeamDomain world over a FRESH scratch dir, wired
 * with the real P4 repositories (write source), the real read-handle
 * projection (P5-T1), the real write-port adapter wrapped in a
 * recording proxy, the mock-first surface, and a deterministic clock.
 *
 * @param basename - the scratch dir basename (unique per test).
 * @param options - optional seed rows (see {@link P5T5WorldOptions}).
 */
export async function createRootBindingWorld(
  basename: string,
  options: P5T5WorldOptions = {},
): Promise<P5T5World> {
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
 * ephemeral Agent residency does NOT — a FRESH surface starts empty).
 *
 * @param world - the world to restart.
 * @returns the re-wired world over the same scratch dir.
 */
export async function restartRootBindingWorld(world: P5T5World): Promise<P5T5World> {
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
): P5T5World {
  const readHandle = createTeamDomainReadHandle(domain.repositories)
  const baseWritePort = createTeamDomainWritePort(domain.repositories)
  const writeCalls: P5T5WriteCall[] = []
  const writes: TeamDomainWritePort = {
    putTeamSession(input) {
      writeCalls.push({ method: 'putTeamSession' })
      return baseWritePort.putTeamSession(input)
    },
    putSessionBinding(binding) {
      writeCalls.push({ method: 'putSessionBinding' })
      return baseWritePort.putSessionBinding(binding)
    },
  }
  const surface = new FakeAgentSetupSurface()
  const now = makeNow()
  const ports: RootBindingPorts = { teamDomain: readHandle, writes, surface, now }
  return { scratchDir, seam, domain, readHandle, writes, writeCalls, surface, now, ports }
}

/**
 * Seed the optional world rows through the SAME repositories (the seeds
 * are world pre-arrangement, NOT module writes — they do not flow
 * through the write proxy's `writeCalls`).
 *
 * @param world - the fresh world.
 * @param options - the seed rows to add.
 */
async function seedRows(
  world: P5T5World,
  options: P5T5WorldOptions,
): Promise<void> {
  const root = String(P5T5_FIXTURE.rootSessionId)
  if (options.seedMemberBinding) {
    await world.domain.repositories.sessionBindings.put({
      kind: 'team-member',
      schemaVersion: 1,
      rootSessionId: root,
      instanceId: String(P5T5_FIXTURE.instanceId),
      sessionId: String(P5T5_FIXTURE.memberSessionId),
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
      sessionId: String(P5T5_FIXTURE.ordinarySessionId),
    })
  }
}

/** Close the domain and remove the scratch dir (test cleanup). */
export async function destroyWorld(world: P5T5World): Promise<void> {
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
