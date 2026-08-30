/**
 * p4t3-helpers — shared fixtures for the P4-T3 (SessionBinding
 * integrity/reconciliation) tests.
 *
 * Builds a fully consistent "healthy team" on a fresh in-memory seam
 * (the same P4-T1 fake seam, `InMemoryStorageSeam`): one TeamSession at
 * the fixture root, one member instance with its durable child session,
 * the `team-root` binding row, and the `team-member` binding row — the
 * state Architecture §15.3 calls bidirectionally consistent. Corruption
 * scenarios then mutate exactly one relationship at a time through the
 * P4-T1 repositories (the repositories write any parseable record; the
 * cross-record rules live in the P4-T3 service/reconciler, which is what
 * the tests exercise).
 *
 * This file is NOT a test file (no `.test.ts` suffix); it is imported by
 * the p4t3-*.test.ts files and type-checked by packages/storage.
 *
 * @module @dsh-agent-team/storage/test/p4t3-helpers
 */

import type { ChildSessionId, InstanceId, RootSessionId } from '../../contracts/src/index.js'
import {
  InMemoryStorageSeam,
  P4_FIXTURE,
  memberInstanceInput,
  teamSessionInput,
} from './p4-helpers.js'
import type { TeamDomain, TeamDomainRepositories } from '../repositories/index.js'
import { createTeamDomain } from '../repositories/index.js'
import { SessionBindingService } from '../bindings/index.js'
import type { TeamBindingReconciliationReport } from '../bindings/index.js'
import type { BindingDiagnosticCode } from '../bindings/index.js'

/**
 * One fresh, fully consistent team world: the seam, the open domain, the
 * binding service, and the fixture identities the scenarios share.
 */
export interface P4T3World {
  /** The in-memory seam (write log, raw rows, crash simulation). */
  readonly seam: InMemoryStorageSeam
  /** The open TeamDomain over the seam. */
  readonly domain: TeamDomain
  /** The P4-T3 binding service over the domain's repositories. */
  readonly service: SessionBindingService
  /** The P4-T1 repositories (the only state boundary the tests mutate). */
  readonly repositories: TeamDomainRepositories
  /** The healthy team's root session (fixture root). */
  readonly root: RootSessionId
  /** A second existing team root (fixture other root) for cross-root scenarios. */
  readonly otherRoot: RootSessionId
  /** The member's durable child session. */
  readonly memberChild: ChildSessionId
  /** A second member child session (fixture). */
  readonly secondChild: ChildSessionId
  /** The member's instance id. */
  readonly instance: InstanceId
  /** A second instance id (fixture). */
  readonly secondInstance: InstanceId
  /** A plain session with no Team binding (the ordinary fork case). */
  readonly ordinarySession: string
  /** A fresh session id standing in for a native fork of the member child. */
  readonly forkedChildSession: string
  /** A fresh session id standing in for a native fork of the team root. */
  readonly forkedRootSession: string
}

/**
 * Create one fresh healthy team world:
 *
 * - TeamSession at `session-root-1` (generation 1);
 * - MemberInstance ('session-root-1', 'inst-alpha') with durable child
 *   'session-child-1' (lifecycle CREATED);
 * - `team-root` binding for the root and the matching `team-member`
 *   binding for the child — both created through the P4-T3 service, so
 *   the happy creation path is exercised in every scenario.
 *
 * @returns the world.
 */
export async function createHealthyTeam(): Promise<P4T3World> {
  const seam = new InMemoryStorageSeam()
  const domain = await createTeamDomain(seam)
  const repositories = domain.repositories
  const root = P4_FIXTURE.rootSessionId
  const otherRoot = P4_FIXTURE.otherRootSessionId
  const memberChild = P4_FIXTURE.childSessionId
  const secondChild = P4_FIXTURE.secondChildSessionId
  const instance = P4_FIXTURE.instanceId
  const secondInstance = P4_FIXTURE.secondInstanceId

  await repositories.teamSessions.put(teamSessionInput(root))
  await repositories.memberInstances.put(memberInstanceInput(root, instance, memberChild))

  const service = new SessionBindingService(repositories)
  await service.createTeamRootBinding(String(root))
  await service.createTeamMemberBinding(String(root), String(instance), String(memberChild))

  return {
    seam,
    domain,
    service,
    repositories,
    root,
    otherRoot,
    memberChild,
    secondChild,
    instance,
    secondInstance,
    ordinarySession: 'session-ordinary-1',
    forkedChildSession: 'session-child-fork-1',
    forkedRootSession: 'session-root-fork-1',
  }
}

/**
 * Add a second, fully consistent, member-free team at the world's other
 * root (TeamSession + team-root binding) — the target team of
 * cross-root ("wrong root") scenarios.
 *
 * @param world - the world to extend (mutates its stores durably).
 */
export async function addSecondTeam(world: P4T3World): Promise<void> {
  await world.repositories.teamSessions.put(teamSessionInput(world.otherRoot, 1))
  await world.service.createTeamRootBinding(String(world.otherRoot))
}

/**
 * The sorted list of diagnostic codes of a report (stable assertion shape).
 *
 * @param report - the reconciliation report.
 * @returns the sorted code values (duplicates preserved).
 */
export function codesOf(report: TeamBindingReconciliationReport): string[] {
  return report.diagnostics.map((diagnostic) => diagnostic.code).sort()
}

/**
 * The first diagnostic of one code in a report (undefined when absent).
 *
 * @param report - the reconciliation report.
 * @param code - the diagnostic code to find.
 */
export function findDiagnostic(
  report: TeamBindingReconciliationReport,
  code: BindingDiagnosticCode,
) {
  return report.diagnostics.find((diagnostic) => diagnostic.code === code)
}
