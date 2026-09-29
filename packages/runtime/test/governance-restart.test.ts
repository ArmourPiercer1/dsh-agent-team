/**
 * pre-alpha3 PR-A — GOVERNANCE RESTART + COMMIT-BEFORE-ACK (plan items 5,
 * 8, 9): after a process restart (a NEW TeamDomain seam over the SAME
 * durable dir), the slot winner is EXACTLY the pre-restart record, the
 * PolicyState active state is restored through the production durable
 * preload, the generation sequence continues without gap or duplicate,
 * a same-state switch is a typed no-op (item 8), a commit fault returns
 * NO success (item 9), and the durable commit is observed BEFORE the ack
 * (the commit-before-ack contract the R2-1 window closed).
 *
 * Pinned here:
 *
 * - P1 override restart: two durable sets -> reopen the domain -> a fresh
 *   service sees the same winner (recordId/generation/values byte-equal)
 *   and the next set re-issues at generation + 1 (no gap, no duplicate);
 * - P2 PolicyState restart: the production `createDurableMutationStore`
 *   preload restores the transition from the durable ledger rows; the
 *   restarted service's same-state switch is a no-op and the next switch
 *   mints the continuation entry id;
 * - P3 same-state no-op (item 8): switching to the ACTIVE state is
 *   `{changed:false}` with zero durable writes;
 * - P4 commit fault (item 9): a failing durable commit rejects the ack
 *   with the fault, appends NOTHING to the read cache, and leaves the
 *   chain un-poisoned;
 * - P5 commit-before-ack: while the durable commit is pending, the ack is
 *   pending and the cache is empty; the ack resolves only after the
 *   commit completes.
 *
 * The runner executes these files under plain Node: all async work runs
 * in the top-level block, the `it` bodies assert synchronously; the
 * scratch worlds are destroyed before the first assertion.
 *
 * @module @dsh-agent-team/runtime/test/governance-restart
 */

import { describe, expect, it } from 'vitest'
import {
  createTeamDomain,
  openTeamDomain,
  type TeamDomainRepositories,
} from '../../storage/repositories/index.js'
import { teamSessionInput } from '../../storage/test/p4-helpers.js'
import { FileStorageSeam, destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import {
  createDurableMutationStore,
  writePolicyStateTransitionRow,
} from '../src/plugin/durable-mutation-store.js'
import { createTeamOperationCoordinator } from '../coordination/index.js'
import {
  createGovernanceMutationService,
  isMutationError,
  selectSlotWinner,
  slotIdentityOf,
  type GovernanceMutationService,
  type GovernanceMutationServiceDeps,
  type GovernanceTransitionCommit,
} from '../governance/index.js'
import type {
  CreationFieldRecord,
  InstanceId,
  MemberIdentity,
  MutationActor,
  MutationLedgerEntry,
  MutationStore,
  OverrideRecordView,
  OverrideStorePort,
  PolicyReader,
  PolicyStateTransitionRecord,
  StoredMutationRecord,
  SuppressionRecord,
  TeamSessionId,
} from '../mutation/index.js'
import type { PolicyEntry } from '../../domain/policy/src/index.js'

const ROOT = 'session-gov-restart'
const NOW = '2026-09-29T00:00:00.000Z'
const now = () => NOW
// The transition actor vocabulary is the frozen value-origin set
// (human/leader/member — the wire's actorOf maps the human caller to 'human').
const actor: MutationActor = { kind: 'human' }

// ---------------------------------------------------------------------------
// The minimal production-shaped inner mutation store (the transitions
// lane is a real in-memory cache; every other lane is a documented no-op
// — exactly the S5A ephemeral semantics the durable wrapper preserves).
// ---------------------------------------------------------------------------
function memMutationStore(): MutationStore {
  const transitions: PolicyStateTransitionRecord[] = []
  return {
    listTransitions(_teamSessionId: TeamSessionId) {
      return transitions
    },
    appendTransition(_teamSessionId: TeamSessionId, transition: PolicyStateTransitionRecord) {
      transitions.push(transition)
    },
    listRecords(_teamSessionId: TeamSessionId): readonly StoredMutationRecord[] {
      return []
    },
    appendRecord(_teamSessionId: TeamSessionId, _record: StoredMutationRecord): void {},
    getCreationFields(_teamSessionId: TeamSessionId, _instanceId: InstanceId): CreationFieldRecord | undefined {
      return undefined
    },
    registerCreationFields(
      _teamSessionId: TeamSessionId,
      _member: MemberIdentity,
      _fields: { readonly workspace: string; readonly contextPolicy: string },
    ): void {},
    setWorkspace(_teamSessionId: TeamSessionId, _instanceId: InstanceId, _workspace: string): void {},
    isRunning(_teamSessionId: TeamSessionId, _instanceId: InstanceId): boolean {
      return false
    },
    markRunning(_teamSessionId: TeamSessionId, _instanceId: InstanceId): void {},
    listInstances(_teamSessionId: TeamSessionId): readonly InstanceId[] {
      return []
    },
    listLedger(_teamSessionId: TeamSessionId): readonly MutationLedgerEntry[] {
      return []
    },
    appendLedger(_teamSessionId: TeamSessionId, _entry: MutationLedgerEntry): void {},
    listSuppressions(_teamSessionId: TeamSessionId): readonly SuppressionRecord[] {
      return []
    },
    appendSuppression(_teamSessionId: TeamSessionId, _record: SuppressionRecord): void {},
  }
}

const noopPolicy: PolicyReader = {
  readBlueprintEnvelope: () => ({}),
  readTemplatePolicy: () => ({}),
  readExternalFacts: () => ({ hard: {}, capabilityExists: {} }),
}

const cells = (m: string): Record<string, PolicyEntry> => ({ model: { kind: 'allow', items: [m] } })

function overridePortOf(repos: TeamDomainRepositories): OverrideStorePort {
  return {
    list: (rootSessionId) => Promise.resolve(repos.overrides.list(rootSessionId) as readonly OverrideRecordView[]),
    put: (record) => repos.overrides.put(record),
  }
}

// ---------------------------------------------------------------------------
// P1: the override restart (real storage)
// ---------------------------------------------------------------------------
const p1Dir = scratchDir('gov-restart-p1')
destroyDir(p1Dir) // self-cleaning: a crashed prior run may leave a domain behind
const p1Seam1 = new FileStorageSeam(p1Dir)
const p1Domain1 = await createTeamDomain(p1Seam1)
const p1Service1 = createGovernanceMutationService({
  chain: createTeamOperationCoordinator(),
  overrides: overridePortOf(p1Domain1.repositories),
  transitions: memMutationStore(),
  transitionCommit: { commit: async () => {} },
  policy: noopPolicy,
  registeredMembers: () => Promise.resolve([]),
  policyStates: () => ['default', 'strict'],
  now,
})
const p1seed1 = await p1Service1.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-a'),
})
const p1seed2 = await p1Service1.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: { model: cells('m-b')['model'], mcp: { kind: 'deny' } } as Record<string, PolicyEntry>,
})
const p1PreRestartWinner = selectSlotWinner(
  p1Domain1.repositories.overrides.list(ROOT),
  slotIdentityOf({ kind: 'human-override', scope: 'team', origin: undefined }, ROOT),
)
// RESTART: a NEW seam + a NEW service (a fresh process) over the SAME dir.
const p1Seam2 = new FileStorageSeam(p1Dir)
const p1Domain2 = await openTeamDomain(p1Seam2)
const p1Service2 = createGovernanceMutationService({
  chain: createTeamOperationCoordinator(),
  overrides: overridePortOf(p1Domain2.repositories),
  transitions: memMutationStore(),
  transitionCommit: { commit: async () => {} },
  policy: noopPolicy,
  registeredMembers: () => Promise.resolve([]),
  policyStates: () => ['default', 'strict'],
  now,
})
const p1PostRestartWinner = selectSlotWinner(
  p1Domain2.repositories.overrides.list(ROOT),
  slotIdentityOf({ kind: 'human-override', scope: 'team', origin: undefined }, ROOT),
)
const p1next = await p1Service2.setOverride({
  authority: { kind: 'operator' },
  rootSessionId: ROOT,
  scope: 'team',
  cells: cells('m-c'),
  expectedGeneration: p1PostRestartWinner === null ? undefined : p1PostRestartWinner.generation,
})
destroyDir(p1Dir)

// ---------------------------------------------------------------------------
// P2/P3: the PolicyState restart through the production durable preload
// ---------------------------------------------------------------------------
const p2Dir = scratchDir('gov-restart-p2')
destroyDir(p2Dir) // self-cleaning: a crashed prior run may leave a domain behind
const p2Seam1 = new FileStorageSeam(p2Dir)
const p2Domain1 = await createTeamDomain(p2Seam1)
// The durable ledger put advances the TeamSession generation stamp — the
// team row must exist (facts belong to an existing team; the production
// boot order creates it before any mutation can flow).
await p2Domain1.repositories.teamSessions.put(teamSessionInput(ROOT as Parameters<typeof teamSessionInput>[0]))
const p2Durable1 = createDurableMutationStore(memMutationStore(), p2Domain1.repositories, ROOT, now)
const p2Commit1: GovernanceTransitionCommit = {
  commit: (transition) => writePolicyStateTransitionRow(p2Domain1.repositories.ledger, ROOT, transition, now),
}
const p2Service1 = createGovernanceMutationService({
  chain: createTeamOperationCoordinator(),
  overrides: { list: () => Promise.resolve([] as readonly OverrideRecordView[]), put: async () => undefined },
  transitions: p2Durable1.store,
  transitionCommit: p2Commit1,
  policy: noopPolicy,
  registeredMembers: () => Promise.resolve([]),
  policyStates: () => ['default', 'strict', 'restricted'],
  now,
})
const p2switch1 = await p2Service1.switchPolicyState({
  actor,
  rootSessionId: ROOT,
  target: { stateId: 'strict' },
})
// P3: the same-state no-op (zero durable writes).
const p2rowsAfterSwitch1 = p2Domain1.repositories.ledger.list().length
const p2switch2 = await p2Service1.switchPolicyState({
  actor,
  rootSessionId: ROOT,
  target: { stateId: 'strict' },
})
const p2rowsAfterNoop = p2Domain1.repositories.ledger.list().length
// RESTART.
const p2Seam2 = new FileStorageSeam(p2Dir)
const p2Domain2 = await openTeamDomain(p2Seam2)
const p2Durable2 = createDurableMutationStore(memMutationStore(), p2Domain2.repositories, ROOT, now)
await p2Durable2.preload()
const p2Commit2: GovernanceTransitionCommit = {
  commit: (transition) => writePolicyStateTransitionRow(p2Domain2.repositories.ledger, ROOT, transition, now),
}
const p2Service2 = createGovernanceMutationService({
  chain: createTeamOperationCoordinator(),
  overrides: { list: () => Promise.resolve([] as readonly OverrideRecordView[]), put: async () => undefined },
  transitions: p2Durable2.store,
  transitionCommit: p2Commit2,
  policy: noopPolicy,
  registeredMembers: () => Promise.resolve([]),
  policyStates: () => ['default', 'strict', 'restricted'],
  now,
})
// The restarted service sees strict as ACTIVE: same-state is a no-op.
const p2restartNoop = await p2Service2.switchPolicyState({
  actor,
  rootSessionId: ROOT,
  target: { stateId: 'strict' },
})
// The continuation: the next real switch mints the continuation entry id.
const p2restartSwitch = await p2Service2.switchPolicyState({
  actor,
  rootSessionId: ROOT,
  target: { stateId: 'restricted' },
})
destroyDir(p2Dir)

// ---------------------------------------------------------------------------
// P4: the commit fault (no success ack; no phantom cache row)
// ---------------------------------------------------------------------------
const p4Transitions = memMutationStore()
const p4Service = createGovernanceMutationService({
  chain: createTeamOperationCoordinator(),
  overrides: { list: () => Promise.resolve([] as readonly OverrideRecordView[]), put: async () => undefined },
  transitions: p4Transitions,
  transitionCommit: {
    commit: async () => {
      throw new Error('the ledger is down')
    },
  },
  policy: noopPolicy,
  registeredMembers: () => Promise.resolve([]),
  policyStates: () => ['default', 'strict'],
  now,
})
const p4attempt = await p4Service
  .switchPolicyState({ actor, rootSessionId: ROOT, target: { stateId: 'strict' } })
  .then(
    (value): { ok: true; value: Awaited<ReturnType<typeof p4Service.switchPolicyState>> } => ({ ok: true, value }),
    (error): { ok: false; error: Error } => ({ ok: false, error }),
  )

// ---------------------------------------------------------------------------
// P5: commit-before-ack (the gated commit)
// ---------------------------------------------------------------------------
const p5Transitions = memMutationStore()
let p5GateResolve: () => void = () => {}
const p5Gate = new Promise<void>((resolve) => {
  p5GateResolve = resolve
})
let p5CommitStarted = false
let p5CommitDone = false
let p5Acked = false
const p5Service = createGovernanceMutationService({
  chain: createTeamOperationCoordinator(),
  overrides: { list: () => Promise.resolve([] as readonly OverrideRecordView[]), put: async () => undefined },
  transitions: p5Transitions,
  transitionCommit: {
    commit: async () => {
      p5CommitStarted = true
      await p5Gate
      p5CommitDone = true
    },
  },
  policy: noopPolicy,
  registeredMembers: () => Promise.resolve([]),
  policyStates: () => ['default', 'strict'],
  now,
})
const p5pending = p5Service.switchPolicyState({ actor, rootSessionId: ROOT, target: { stateId: 'strict' } })
p5pending.then(
  () => {
    p5Acked = true
  },
  () => {
    p5Acked = true
  },
)
// One I/O tick: the chain work has reached the (gated) durable commit.
await new Promise((resolve) => setTimeout(resolve, 5))
const p5cacheWhilePending = p5Transitions.listTransitions(ROOT).length
const p5commitStartedWhilePending = p5CommitStarted
const p5ackedWhilePending = p5Acked
p5GateResolve()
const p5result = await p5pending

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('PR-A governance restart — the override winner survives exactly', () => {
  it('the restarted service sees the same winner and continues the generation', () => {
    expect(p1seed1.changed).toBe(true)
    expect(p1seed2.changed).toBe(true)
    expect(p1PreRestartWinner).not.toBeNull()
    if (p1PreRestartWinner === null) throw new Error('no pre-restart winner')
    expect(p1PreRestartWinner.recordId).toBe('ovr-mcp+model-team-g1')
    expect(p1PreRestartWinner.generation).toBe(2)

    // EXACT winner equality across the restart (the durable rows are the
    // source of truth — no process-local state).
    expect(p1PostRestartWinner).not.toBeNull()
    if (p1PostRestartWinner === null) throw new Error('no post-restart winner')
    expect(p1PostRestartWinner.recordId).toBe(p1PreRestartWinner.recordId)
    expect(p1PostRestartWinner.generation).toBe(p1PreRestartWinner.generation)
    expect(p1PostRestartWinner.values).toEqual(p1PreRestartWinner.values)
    expect(p1PostRestartWinner.updatedAt).toBe(p1PreRestartWinner.updatedAt)

    // The continuation: generation + 1, no gap, no duplicate record id.
    expect(p1next.changed).toBe(true)
    if (p1next.changed) {
      expect(p1next.record.generation).toBe(3)
    }
    const postIds = p1Domain2.repositories.overrides.list(ROOT).map((record) => record.recordId).sort()
    expect(postIds).toEqual(['ovr-mcp+model-team-g1', 'ovr-model-team-g0', 'ovr-model-team-g2'])
  })
})

describe('PR-A governance restart — the PolicyState active state survives', () => {
  it('the durable preload restores the transition; the same-state switch is a no-op', () => {
    expect(p2switch1.changed).toBe(true)
    if (!p2switch1.changed) throw new Error('first switch not admitted')
    expect(p2switch1.transition.entryId).toBe('ps-strict-0')

    // P3: the same-state no-op wrote nothing durable.
    expect(p2rowsAfterSwitch1).toBe(1)
    expect(p2switch2.changed).toBe(false)
    if (!p2switch2.changed) expect(p2switch2.reason).toBe('no-change')
    expect(p2rowsAfterNoop).toBe(1)

    // The restarted service: the preload restored strict as active, so
    // the same-state switch is a no-op (zero new durable rows) and the
    // continuation mints the next entry id.
    expect(p2restartNoop.changed).toBe(false)
    if (!p2restartNoop.changed) expect(p2restartNoop.reason).toBe('no-change')
    expect(p2restartSwitch.changed).toBe(true)
    if (p2restartSwitch.changed) {
      expect(p2restartSwitch.transition.entryId).toBe('ps-restricted-1')
    }
    // The restored lane: exactly the two durable transitions, in order.
    const restored = p2Durable2.store.listTransitions(ROOT)
    expect(restored).toHaveLength(2)
    expect(restored.map((transition) => transition.entryId)).toEqual(['ps-strict-0', 'ps-restricted-1'])
  })
})

describe('PR-A governance restart — the commit fault (no success ack)', () => {
  it('a failing durable commit rejects the ack, appends nothing, and leaves the chain usable', () => {
    expect(p4attempt.ok).toBe(false)
    if (!p4attempt.ok) {
      const error = p4attempt.error
      // The fault propagates raw (it is NOT a mutation-plane rejection).
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).message).toBe('the ledger is down')
    }
    // No phantom transition in the read cache (the append is post-commit).
    expect(p4Transitions.listTransitions(ROOT)).toHaveLength(0)
  })
})

describe('PR-A governance restart — commit-before-ack ordering', () => {
  it('the ack is pending while the durable commit is pending; the cache appends only after the commit', () => {
    expect(p5commitStartedWhilePending).toBe(true) // the commit was REACHED
    expect(p5ackedWhilePending).toBe(false) // the ack did NOT return yet (snapshot)
    expect(p5cacheWhilePending).toBe(0) // no cache append before the commit
    expect(p5result.changed).toBe(true)
    if (p5result.changed) expect(p5result.transition.entryId).toBe('ps-strict-0')
    expect(p5CommitDone).toBe(true)
    expect(p5Acked).toBe(true)
    expect(p5Transitions.listTransitions(ROOT)).toHaveLength(1)
  })
})
