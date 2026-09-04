/**
 * p4t4-helpers — shared fixtures for the P4-T4 (provisioning state machine)
 * tests.
 *
 * Reuses the P4-T1 in-memory seam fake (`InMemoryStorageSeam`) and fixture
 * identities (`P4_FIXTURE`) and builds the P4-T4 world: one TeamDomain, one
 * deterministic `FakeAgentFactoryAdapter`, and one
 * `ProvisioningCoordinator` over them. It also builds the DURABLE CRASH
 * STATES of the Development Plan §17.4 fault-injection matrix:
 *
 * - `S0` — fresh world (no provisioning state: "before op prepare");
 * - `S1` — `ALLOCATED` (operation PREPARED, no child: "after op prepare" /
 *   "before child create");
 * - `S2` — `CHILD_SESSION_CREATED` (child recorded on the operation row +
 *   member record written: "after child create" / "before SessionBinding");
 * - `S3` — `CHILD_BOUND` (the team-member binding is durable, not
 *   committed: "before MemberInstance commit" / "before ledger");
 * - `S4` — `CHILD_BOUND` + the ledger fact is already durable but the
 *   operation row is still PREPARED ("before operation committed" — the
 *   commit is atomic as fact→COMMITTED-row, so the crash between them
 *   leaves exactly this state);
 * - `S5` — `INSTANCE_COMMITTED` (the terminal: "after committed").
 *
 * The crash tests simulate a crash by arming the seam (`setCrashAfterWrites`)
 * mid-`provision`, letting the drive reject with a `SEAM_FAILURE`, then
 * RE-DRIVING from the durable state (Development Plan §17.3: real process
 * crashes are P4-T5's job; the crash model here is stop + re-drive).
 *
 * Test-only module: never imported by production code.
 * @module @dsh-agent-team/storage/test/p4t4-helpers
 */

import { isTeamDomainError, type TeamDomainError } from '../schema/index.js'
import { createTeamDomain, type TeamDomain } from '../repositories/index.js'
import {
  PROVISION_INTENT_TYPE,
  FakeAgentFactoryAdapter,
  createProvisioningCoordinator,
  provisioningOperationId,
  type ProvisionRequest,
  type ProvisioningCoordinator,
} from '../provisioning/index.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, teamSessionInput } from './p4-helpers.js'

/** The P4-T4 test world: the TeamDomain, the fake adapter, the coordinator. */
export interface P4t4World {
  readonly seam: InMemoryStorageSeam
  readonly domain: TeamDomain
  readonly adapter: FakeAgentFactoryAdapter
  readonly coordinator: ProvisioningCoordinator
}

/** The canonical provisioning request of the fixture member (inst-alpha). */
export const P4T4_REQUEST = {
  instanceId: P4_FIXTURE.instanceId,
  templateId: P4_FIXTURE.templateId,
  label: 'Alpha Researcher',
  allocationToken: 'p4t4-alloc-alpha-1',
} as const

/**
 * Build one provisioning request. `overrides` replace individual fields so
 * tests can derive variants (a second member, a different allocation token,
 * a changed label) without mutating the canonical request.
 */
export function provisionRequest(
  overrides: {
    instanceId?: (typeof P4_FIXTURE)['instanceId'] | string
    templateId?: (typeof P4_FIXTURE)['templateId'] | string
    label?: string
    groupId?: string
    workspace?: string
    allocationToken?: string
  } = {},
): ProvisionRequest {
  return {
    instanceId: overrides.instanceId ?? P4T4_REQUEST.instanceId,
    templateId: overrides.templateId ?? P4T4_REQUEST.templateId,
    label: overrides.label ?? P4T4_REQUEST.label,
    ...(overrides.groupId !== undefined ? { groupId: overrides.groupId } : {}),
    ...(overrides.workspace !== undefined ? { workspace: overrides.workspace } : {}),
    allocationToken: overrides.allocationToken ?? P4T4_REQUEST.allocationToken,
  }
}

/**
 * Create a fresh P4-T4 world over a fresh in-memory seam.
 * @param rootSessionId - the team root the coordinator is scoped to (default fixture root).
 */
export async function createP4t4World(
  rootSessionId: (typeof P4_FIXTURE)['rootSessionId'] | string = P4_FIXTURE.rootSessionId,
): Promise<P4t4World> {
  const seam = new InMemoryStorageSeam()
  const domain = await createTeamDomain(seam)
  // G8-S1 (R60): every new ledger fact now also advances the TeamSession's
  // generation stamp, and a fact for a missing team row is a loud
  // SEAM_FAILURE (invariant: facts belong to an existing team). The factory
  // therefore seeds the team row the coordinator's root addresses, before
  // any test captures its write-count base (the `armCrashAt` docs'
  // "after world creation" snapshot).
  await domain.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(String(rootSessionId))))
  const adapter = new FakeAgentFactoryAdapter()
  const coordinator = createProvisioningCoordinator({ domain, rootSessionId, adapter })
  return { seam, domain, adapter, coordinator }
}

/** The durable crash states of the fault-injection matrix (see module docs). */
export const P4T4_STATES = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5'] as const
export type P4t4State = (typeof P4T4_STATES)[number]

/**
 * Drive a world to one durable crash state using the coordinator's own
 * stage methods (the states are exactly what a crash mid-`provision` would
 * leave durable).
 *
 * `S4` is the one state no single stage method reaches: the ledger fact is
 * appended directly (the journal's terminal writes the fact first and the
 * COMMITTED row second, so the crash between them is a fact without a
 * COMMITTED row — reproduced here by the exact same ledger write).
 */
export async function driveToState(world: P4t4World, state: P4t4State, request: ProvisionRequest = provisionRequest()): Promise<void> {
  switch (state) {
    case 'S0':
      return
    case 'S1':
      await world.coordinator.allocate(request)
      return
    case 'S2':
      await world.coordinator.createChildSession(request)
      return
    case 'S3':
      await world.coordinator.bindChildSession(request)
      return
    case 'S4': {
      await world.coordinator.bindChildSession(request)
      const operation = world.domain.repositories.operations.get(operationIdFor(world, request))
      if (operation === undefined) throw new Error('p4t4-helpers: S4 requires the operation row to exist')
      const sequence = await world.domain.repositories.ledger.allocateSequence()
      await world.domain.repositories.ledger.put({
        schemaVersion: 1,
        sequence,
        rootSessionId: String(world.coordinator.rootSessionId),
        factType: PROVISION_INTENT_TYPE,
        payload: operation.intent.payload,
        operationId: operation.operationId,
        createdAt: P4_FIXTURE.createdAt,
      })
      return
    }
    case 'S5':
      await world.coordinator.provision(request)
      return
  }
}

/** The operation id one provisioning request maps to under one team (deterministic identity). */
export function operationIdFor(world: P4t4World, request: ProvisionRequest): string {
  return provisioningOperationId(String(world.coordinator.rootSessionId), String(request.instanceId))
}

/**
 * Arm a crash AFTER exactly `base + offset` total seam writes: the first
 * `base + offset` writes succeed, every later write rejects with
 * `FakeCrashError` (STICKY — call `seam.clearCrash()` before the re-drive).
 * `base` is the `seam.writeCount` snapshot taken after world creation
 * (the eight schema_meta stamp writes).
 */
export function armCrashAt(seam: InMemoryStorageSeam, base: number, offset: number): void {
  seam.setCrashAfterWrites(base + offset)
}

/** True when `error` is a SEAM_FAILURE TeamDomainError (the crash fake's surface). */
export function isSeamFailure(error: unknown): boolean {
  return isTeamDomainError(error) && (error as TeamDomainError).code === 'SEAM_FAILURE'
}

/** The number of seam writes (optionally restricted to one table) in `seam.writeLog`. */
export function countWrites(seam: InMemoryStorageSeam, table?: string): number {
  return seam.writeLog.filter((entry) => (table === undefined ? true : entry.table === table)).length
}
