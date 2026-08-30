/**
 * p7t4-helpers — shared fixtures and world builders for the P7-T4 (fork
 * reconciliation) tests (DevPlan §20.4; Architecture §35).
 *
 * Contents:
 *
 * - {@link P7T4_FIXTURE} — the P7-T4 fixture identities (frozen contracts
 *   v1 branded ids), distinct from the P4/P5 fixture values;
 * - {@link P7T4Clock} — the deterministic injected clock (the reconciler's
 *   `ports.now`);
 * - {@link createForkWorld} — one durable TeamDomain world over the
 *   testkit `FileStorageSeam`: the REAL P4 repositories + the REAL
 *   fork-reconciliation port adapter (`createTeamDomainForkPort`);
 * - {@link seedTeamRoot} / {@link seedMemberChild} /
 *   {@link seedOrdinaryBinding} / {@link seedMemberInstance} — the ground
 *   truth durable rows a prior (e.g. fresh-root) run would have written;
 * - {@link restartForkWorld} — the process-restart model (DevPlan §18.5):
 *   a NEW seam instance over the SAME scratch dir re-opens the durable
 *   domain (the P4-T5/P5-T5 restart model);
 * - {@link destroyWorld} — closes the domain and removes the scratch dir;
 * - {@link captureError} — the shim's missing `rejects` matcher.
 *
 * Test-only module (no `.test.ts` suffix): never imported by production
 * code.
 * @module @dsh-agent-team/runtime/test/p7t4-helpers
 */

import {
  createBlueprintSnapshotRef,
  MEMBER_LIFECYCLE_STATES,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseSessionId,
  parseTemplateId,
  TEAM_CONTRACT_SCHEMA_VERSION,
} from '../../contracts/src/index.js'
import type {
  BlueprintSnapshotRef,
  MemberInstanceRecordInput,
  SessionBindingDto,
  TeamSessionRecordInput,
} from '../../contracts/src/index.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain, TeamDomainRepositories } from '../../storage/repositories/index.js'
import { createTeamDomainForkPort } from '../fork-reconciliation/index.js'
import type {
  ForkReconciliationResult,
  ForkReconciliationTeamDomain,
} from '../fork-reconciliation/index.js'
import { destroyDir, FileStorageSeam, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'

/** The P7-T4 fixture identities (frozen contracts v1 branded ids). */
export const P7T4_FIXTURE = {
  /** The Team root session (TeamSessionId = RootSessionId, invariant 9). */
  rootSessionId: parseRootSessionId('session-root-p7t4'),
  /** A member child session of the fixture team. */
  memberChildSessionId: parseChildSessionId('session-member-p7t4'),
  /** An ordinary (Team-less) parent session. */
  ordinaryParentSessionId: parseSessionId('session-ordinary-parent-p7t4'),
  /** The native-fork child session id (the newly minted session). */
  forkChildSessionId: parseChildSessionId('session-forkchild-p7t4'),
  /** An unrelated session id (the "other" child in the conflict worlds). */
  otherChildSessionId: parseChildSessionId('session-other-p7t4'),
  instanceId: parseInstanceId('inst-p7t4alpha'),
  templateId: parseTemplateId('p7t4worker'),
  blueprint: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('P7T4-BP'),
    revision: parseBlueprintRevision('1'),
    contentHash: parseBlueprintContentHash('sha256-11111111111111111111111111111111'),
  }),
  /** A DIFFERENT immutable snapshot (the conflict-world blueprint). */
  blueprintOther: createBlueprintSnapshotRef({
    blueprintId: parseBlueprintId('P7T4-BP2'),
    revision: parseBlueprintRevision('1'),
    contentHash: parseBlueprintContentHash('sha256-22222222222222222222222222222222'),
  }),
  defaultWorkspace: 'C:/agent-team/work/p7t4',
  createdAt: '2026-08-30T07:00:00Z',
  /** The deterministic clock value used for fork-sidecar `createdAt`. */
  forkCreatedAt: '2026-08-30T07:05:00Z',
}

/**
 * The deterministic injected clock: the reconciler's `ports.now`
 * (the child TeamSession `createdAt` stamp). Tests set it explicitly.
 */
export class P7T4Clock {
  private value: string

  constructor(initial: string) {
    this.value = initial
  }

  /** Advance (or set) the clock. */
  set(value: string): void {
    this.value = value
  }

  /** The current stamp (ISO-8601). */
  now(): string {
    return this.value
  }
}

/** One durable fork-reconciliation world over a scratch dir. */
export interface P7T4World {
  /** The scratch dir (stable across restarts). */
  readonly scratchDir: string
  /** The file-backed seam (crash-fault injection lives here). */
  readonly seam: FileStorageSeam
  /** The open TeamDomain. */
  readonly domain: TeamDomain
  /** The P4 repository bundle (ground truth). */
  readonly repositories: TeamDomainRepositories
  /** The REAL fork-reconciliation port over the repositories. */
  readonly teamDomain: ForkReconciliationTeamDomain
  /** The deterministic clock (the reconciler's `ports.now`). */
  readonly clock: P7T4Clock
}

/**
 * Create one durable TeamDomain world over a FRESH scratch dir, wired
 * with the real P4 repositories and the real fork-reconciliation port
 * adapter, plus a deterministic clock.
 *
 * @param basename - the scratch dir basename (unique per test).
 */
export async function createForkWorld(basename: string): Promise<P7T4World> {
  const dir = scratchDir(basename)
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  return finishWorld(dir, seam, domain)
}

/**
 * The process-restart model (DevPlan §18.5): close the old world, open a
 * NEW seam over the SAME scratch dir (the durable records survive).
 *
 * @param world - the world to restart.
 * @returns the re-wired world over the same scratch dir.
 */
export async function restartForkWorld(world: P7T4World): Promise<P7T4World> {
  await world.domain.close()
  const seam = new FileStorageSeam(world.scratchDir)
  const domain = await openTeamDomain(seam)
  return finishWorld(world.scratchDir, seam, domain)
}

/** Wire one world record over an open domain (shared by create/restart). */
function finishWorld(
  scratchDirPath: string,
  seam: FileStorageSeam,
  domain: TeamDomain,
): P7T4World {
  return {
    scratchDir: scratchDirPath,
    seam,
    domain,
    repositories: domain.repositories,
    teamDomain: createTeamDomainForkPort(domain.repositories),
    clock: new P7T4Clock(P7T4_FIXTURE.forkCreatedAt),
  }
}

/**
 * Destroy a world: close the domain and remove the scratch dir.
 * (Idempotent enough for test cleanup: a closed seam dir removal is safe.)
 */
export async function destroyWorld(world: P7T4World): Promise<void> {
  try {
    await world.domain.close()
  } catch {
    // already closed
  }
  await world.seam.closeAll()
  destroyDir(world.scratchDir)
}

/**
 * Seed the durable sidecar of an EXISTING Team root (what the P5-T5
 * fresh-root path would have written): the TeamSession record FIRST,
 * then the `team-root` binding.
 *
 * @param world - the world to seed.
 * @param rootSessionId - the Team root session id.
 * @param blueprint - the immutable Blueprint snapshot (invariant 10).
 * @param options - the optional record fields.
 */
export async function seedTeamRoot(
  world: P7T4World,
  rootSessionId: string,
  blueprint: BlueprintSnapshotRef,
  options: { defaultWorkspace?: string; createdAt?: string } = {},
): Promise<void> {
  const input: TeamSessionRecordInput = {
    rootSessionId: parseRootSessionId(rootSessionId),
    blueprint,
    ...(options.defaultWorkspace !== undefined
      ? { defaultWorkspace: options.defaultWorkspace }
      : {}),
    createdAt: options.createdAt ?? P7T4_FIXTURE.createdAt,
    generation: 1,
  }
  await world.repositories.teamSessions.put(input)
  const binding: SessionBindingDto = {
    schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
    kind: 'team-root',
    sessionId: parseRootSessionId(rootSessionId),
  }
  await world.repositories.sessionBindings.put(binding)
}

/**
 * Seed one member child session of a Team root: the `team-member`
 * binding row (invariant 23/18: childSessionId -> rootSessionId ->
 * instanceId).
 *
 * @param world - the world to seed.
 * @param rootSessionId - the Team root session id.
 * @param childSessionId - the member child session id.
 * @param instanceId - the member instance id.
 */
export async function seedMemberChild(
  world: P7T4World,
  rootSessionId: string,
  childSessionId: string,
  instanceId: string,
): Promise<void> {
  const binding: SessionBindingDto = {
    schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
    kind: 'team-member',
    sessionId: parseChildSessionId(childSessionId),
    rootSessionId: parseRootSessionId(rootSessionId),
    instanceId: parseInstanceId(instanceId),
  }
  await world.repositories.sessionBindings.put(binding)
}

/**
 * Seed a `team-root` binding row WITHOUT its TeamSession record (the
 * corruption state the reconciler must fail closed on: a binding without
 * a record is never produced by the fork-reconciliation ordering).
 *
 * @param world - the world to seed.
 * @param sessionId - the session id carrying the bare `team-root` row.
 */
export async function seedRootBindingOnly(
  world: P7T4World,
  sessionId: string,
): Promise<void> {
  const binding: SessionBindingDto = {
    schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
    kind: 'team-root',
    sessionId: parseRootSessionId(sessionId),
  }
  await world.repositories.sessionBindings.put(binding)
}

/**
 * Seed a TeamSession record WITHOUT its `team-root` binding row (the
 * crash-window state, or a conflict state when the snapshot/generation
 * disagrees with the fork fact).
 *
 * @param world - the world to seed.
 * @param rootSessionId - the Team root session id (the record key).
 * @param blueprint - the immutable Blueprint snapshot.
 * @param options - the optional record fields.
 */
export async function seedChildTeamSession(
  world: P7T4World,
  rootSessionId: string,
  blueprint: BlueprintSnapshotRef,
  options: { generation?: number; defaultWorkspace?: string; createdAt?: string } = {},
): Promise<void> {
  const input: TeamSessionRecordInput = {
    rootSessionId: parseRootSessionId(rootSessionId),
    blueprint,
    ...(options.defaultWorkspace !== undefined
      ? { defaultWorkspace: options.defaultWorkspace }
      : {}),
    createdAt: options.createdAt ?? P7T4_FIXTURE.createdAt,
    generation: options.generation ?? 1,
  }
  await world.repositories.teamSessions.put(input)
}

/**
 * Seed one `ordinary` binding row (a session that is durably recorded as
 * a plain DSH session — no Team authority).
 *
 * @param world - the world to seed.
 * @param sessionId - the ordinary session id.
 */
export async function seedOrdinaryBinding(
  world: P7T4World,
  sessionId: string,
): Promise<void> {
  const binding: SessionBindingDto = {
    schemaVersion: TEAM_CONTRACT_SCHEMA_VERSION,
    kind: 'ordinary',
    sessionId: parseSessionId(sessionId),
  }
  await world.repositories.sessionBindings.put(binding)
}

/**
 * Seed one durable MemberInstance record under a Team root (the
 * "non-empty MemberInstances" contradiction state of the root-fork
 * sidecar, Architecture §35.1).
 *
 * @param world - the world to seed.
 * @param rootSessionId - the Team root session id.
 * @param childSessionId - the member child session id.
 * @param instanceId - the member instance id.
 */
export async function seedMemberInstance(
  world: P7T4World,
  rootSessionId: string,
  childSessionId: string,
  instanceId: string,
): Promise<void> {
  const input: MemberInstanceRecordInput = {
    rootSessionId: parseRootSessionId(rootSessionId),
    instanceId: parseInstanceId(instanceId),
    templateId: P7T4_FIXTURE.templateId,
    label: 'p7t4 member',
    childSessionId: parseChildSessionId(childSessionId),
    lifecycle: MEMBER_LIFECYCLE_STATES.CREATED,
    createdAt: P7T4_FIXTURE.createdAt,
    activityVersion: 1,
  }
  await world.repositories.memberInstances.put(input)
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

/**
 * The exact union member carrying one outcome literal (the discriminant
 * of the frozen `ForkReconciliationResult` union).
 */
type OutcomeMember<O> = Extract<ForkReconciliationResult, { outcome: O }>

/**
 * Narrow a captured reconciliation result to one exact outcome (the
 * frozen discriminated union): throws a clear error when the outcome does
 * not match, so the failing `it` body reports the mismatch; the returned
 * result is narrowed to that exact member and asserted field by field.
 *
 * @param result - the captured result (or `undefined` when the run threw).
 * @param outcome - the exact expected outcome literal.
 * @returns the narrowed result (the exact union member).
 */
export function assertOutcome<O extends ForkReconciliationResult['outcome']>(
  result: ForkReconciliationResult | undefined,
  outcome: O,
): OutcomeMember<O> {
  if (result === undefined || result.outcome !== outcome) {
    const got = result === undefined ? 'undefined (the run threw)' : result.outcome
    throw new Error(`assertOutcome: expected '${outcome}', got '${got}'`)
  }
  return result as OutcomeMember<O>
}
