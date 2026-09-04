/**
 * p8s7r4-fork-describe.test.ts — P8-S7-R4 W3 (BQ-18): the read-only fork
 * reconciliation state surface (`root.fork.describe`) over a REAL
 * production entry (`../src/plugin/host.js` `apply(ctx, config)`) and a
 * REAL storage seam (testkit `FileStorageSeam`).
 *
 * The EXACT frozen state vocabulary (plan BQ-18) is proven end to end —
 * every state and every conflict kind is reachable through the real
 * storage-backed read path:
 *
 *   ordinary / root-fork-reconciled / root-fork-recovering /
 *   member-fork-ordinary / integrity-conflict,
 *
 * with the four integrity-conflict kinds:
 *
 *   binding-without-record / parent-binding-without-record /
 *   blueprint-mismatch / reconciled-child-carries-members.
 *
 * The booted production world (stub glue, own blueprint `P8S7R4-FKB`)
 * provides the parent team root (record + team-root binding + one seeded
 * worker). The remaining durable rows are seeded directly through the
 * TeamDomain repositories (the p5t1 row shapes), which is exactly the
 * durable state a crash window of the write path (`fork.reconcile`,
 * unchanged) leaves behind.
 *
 * `fork.describe` is a PURE READ: the suite asserts every row count is
 * unchanged across all nine describe calls (W3 zero-writes).
 *
 * The plain-node vitest shim forbids async `it()` bodies and exposes
 * only toBe/toEqual/toBeGreaterThan/toThrow — so every scenario is
 * driven at MODULE TOP LEVEL and the `it` bodies assert synchronously
 * over the captured results (the P8-S5A / P8-S7-R2 pattern).
 *
 * @module @dsh-agent-team/runtime/test/p8s7r4-fork-describe
 */
import { describe, expect, it } from 'vitest'
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
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the fixture identities ----------------------------------------------------

/** The production row's root (the fork PARENT of every root-fork state). */
const ROOT_SID = 'session-p8s7r4fkroot'
/** The T2-A seeded worker (member child of ROOT_SID). */
const SEED_WORKER_ID = 'inst-p8s7r4fkseedw1'
const SEED_WORKER_CHILD = 'session-child-p8s7r4fkseedw1'

/** An unbound ordinary session — the parent of the member-fork pair. */
const MEM_PARENT = 'session-p8s7r4fkmem'
/** A pair with neither a record nor a binding on either side. */
const OP_PARENT = 'session-p8s7r4fknop'
const OP_CHILD = 'session-p8s7r4fknonc'
/** Record present, binding still pending (crash window: 1/2 writes). */
const FK_REC = 'session-p8s7r4fkrec'
/** Ordinary-bound child under a team-root parent (not yet reconciled). */
const FK_ORD = 'session-p8s7r4fkord'
/** Fully reconciled child: same snapshot ref, team-root binding, 0 members. */
const FK_CHILD = 'session-p8s7r4fkchild'
/** A team-root binding WITHOUT the record (corrupted durable state). */
const FK_BWR = 'session-p8s7r4fkbwr'
/** A team-root binding WITHOUT the record, used as the PARENT. */
const FK_PNOREC = 'session-p8s7r4fkpnorec'
/** A record pinning a DIFFERENT blueprint snapshot (invariant 10 broken). */
const FK_MISM = 'session-p8s7r4fkmism'
/** A reconciled child carrying a member (a fork root must be memberless). */
const FK_MEMC = 'session-p8s7r4fkmemc'

const SEED_WORKSPACE = 'C:/agent-team/work/p8s7r4-fk'
const SEED_CREATED_AT = '2026-08-30T00:00:00Z'
/** The mismatched record's contentHash (same id/revision, different hash). */
const MISMATCH_HASH = 'sha256-' + 'f'.repeat(32)

/** The T2 blueprint (own id; structure mirrors the P8-S5A fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S7R4-FKB',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S7R4 fork-describe team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S7R4 fork-describe work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P8S7R4 fork-describe default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The row config (the entry's ONLY input channel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(rootSessionId: string): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: SEED_WORKSPACE,
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 't2-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
    ],
    staticModel: { provider: 'p8s7r4-static', model: 'p8s7r4-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
  }
}

// --- the test Cordis context (the p8s5a pattern) --------------------------------

interface TestWorld {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
}

/** One plain-object Cordis context (get / provide / effect). */
function makeWorld(seam: FileStorageSeam): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    teamStorageSeam: seam,
  }
  const effectDisposers: Array<() => void> = []
  return {
    ctx: {
      get: (name: string) => provided[name],
      provide: (name: string, value: unknown) => {
        provided[name] = value
      },
      effect: (factory: () => () => void, _label?: string) => {
        effectDisposers.push(factory())
      },
    },
    provided,
  }
}

/** Apply the entry and await its bootstrap (`ready`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorld(world: TestWorld, config: Record<string, any>): Promise<Record<string, any>> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('W3 scenario guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const root: Record<string, any> = await teamRoot.ready
  return root
}

// --- the scenarios (module top level — the shim forbids async it bodies) -------

const dir = scratchDir('p8s7r4-fork')
const seam = new FileStorageSeam(dir)
const world = makeWorld(seam)
const root = await applyWorld(world, rowConfig(ROOT_SID))

const repos = root.domain.repositories
const rootRecord = repos.teamSessions.get(ROOT_SID)
if (rootRecord === undefined) throw new Error('W3 scenario guard: the booted root record is missing')

/** The parent's immutable Blueprint snapshot ref (reused for same-ref rows). */
const parentRef = rootRecord.blueprint
const parentBp = {
  blueprintId: String(parentRef.blueprintId),
  revision: String(parentRef.revision),
  contentHash: String(parentRef.contentHash),
}
/** The mismatched snapshot ref: same id + revision, DIFFERENT contentHash. */
const mismatchRef = createBlueprintSnapshotRef({
  blueprintId: parseBlueprintId(parentBp.blueprintId),
  revision: parseBlueprintRevision(parentBp.revision),
  contentHash: parseBlueprintContentHash(MISMATCH_HASH),
})

// --- seed the durable rows the crash windows leave behind (p5t1 row shapes) ----

// (3) record-only recovering child: the reconciler's 1/2 write.
await repos.teamSessions.put({
  rootSessionId: parseRootSessionId(FK_REC),
  blueprint: parentRef,
  createdAt: SEED_CREATED_AT,
  generation: 1,
})

// (4) not-yet-reconciled child: an ordinary binding under a team-root parent.
await repos.sessionBindings.put({ schemaVersion: 1, kind: 'ordinary', sessionId: parseSessionId(FK_ORD) })

// (5) fully reconciled child: record (same ref) + team-root binding, 0 members.
await repos.teamSessions.put({
  rootSessionId: parseRootSessionId(FK_CHILD),
  blueprint: parentRef,
  createdAt: SEED_CREATED_AT,
  generation: 1,
})
await repos.sessionBindings.put({ schemaVersion: 1, kind: 'team-root', sessionId: parseRootSessionId(FK_CHILD) })

// (6) binding without record (corrupted: the 2/2 write landed, the 1/2 vanished).
await repos.sessionBindings.put({ schemaVersion: 1, kind: 'team-root', sessionId: parseRootSessionId(FK_BWR) })

// (7) parent binding without record (the parent side of the corrupted pair).
await repos.sessionBindings.put({ schemaVersion: 1, kind: 'team-root', sessionId: parseRootSessionId(FK_PNOREC) })

// (8) blueprint mismatch: the child pins a DIFFERENT immutable snapshot.
await repos.teamSessions.put({
  rootSessionId: parseRootSessionId(FK_MISM),
  blueprint: mismatchRef,
  createdAt: SEED_CREATED_AT,
  generation: 1,
})
await repos.sessionBindings.put({ schemaVersion: 1, kind: 'team-root', sessionId: parseRootSessionId(FK_MISM) })

// (9) reconciled child carrying a member (a fork root must be memberless).
await repos.teamSessions.put({
  rootSessionId: parseRootSessionId(FK_MEMC),
  blueprint: parentRef,
  createdAt: SEED_CREATED_AT,
  generation: 1,
})
await repos.sessionBindings.put({ schemaVersion: 1, kind: 'team-root', sessionId: parseRootSessionId(FK_MEMC) })
await repos.memberInstances.put({
  rootSessionId: parseRootSessionId(FK_MEMC),
  instanceId: parseInstanceId('inst-p8s7r4fkmemc1'),
  templateId: parseTemplateId('worker'),
  label: 'fk-memc-worker',
  childSessionId: parseChildSessionId('session-child-p8s7r4fkmemc'),
  workspace: 'C:/agent-team/work/p8s7r4-memc',
  lifecycle: 'CREATED',
  createdAt: SEED_CREATED_AT,
  activityVersion: 1,
})

// (2) the seeded worker's team-member binding — production boot writes the
// memberInstances row; the team-member BINDING row is the durable row that
// records where a forked member child came from (§14.3 C), seeded here so
// the member-fork state is reachable through the real storage read path.
await repos.sessionBindings.put({
  schemaVersion: 1,
  kind: 'team-member',
  sessionId: parseChildSessionId(SEED_WORKER_CHILD),
  rootSessionId: parseRootSessionId(ROOT_SID),
  instanceId: parseInstanceId(SEED_WORKER_ID),
})

// Row-count baselines — captured AFTER the seeding, before any describe:
// fork.describe must leave every one unchanged.
const tsBefore = repos.teamSessions.list().length
const teamRootBindingsBefore = repos.sessionBindings.listByKind('team-root').length
const teamMemberBindingsBefore = repos.sessionBindings.listByKind('team-member').length
const ordinaryBindingsBefore = repos.sessionBindings.listByKind('ordinary').length
const workerMembersBefore = repos.memberInstances.list(ROOT_SID).length

// --- drive the read surface over every state (SYNC — pure read) ----------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
const describeState = (parentSessionId: string, childSessionId: string): Record<string, any> =>
  root.fork.describe({ parentSessionId, childSessionId })

// (1) neither side carries any Team state.
const s1 = describeState(OP_PARENT, OP_CHILD)
// (2) the forked member child: the binding row is navigation metadata only.
const s2 = describeState(MEM_PARENT, SEED_WORKER_CHILD)
// (3) record present, binding pending (reconciler crash window).
const s3 = describeState(ROOT_SID, FK_REC)
// (4) parent is a team root, child not yet reconciled (lazy pending op).
const s4 = describeState(ROOT_SID, FK_ORD)
// (5) record + binding, memberless (reconciler 2/2).
const s5 = describeState(ROOT_SID, FK_CHILD)
// (6) child binding without the child record.
const s6 = describeState(ROOT_SID, FK_BWR)
// (7) parent binding without the parent record.
const s7 = describeState(FK_PNOREC, FK_CHILD)
// (8) the child pins a different immutable Blueprint snapshot.
const s8 = describeState(ROOT_SID, FK_MISM)
// (9) the reconciled child carries a member.
const s9 = describeState(ROOT_SID, FK_MEMC)

// The read-onlyness proof: every count unchanged after all nine reads.
const tsAfter = repos.teamSessions.list().length
const teamRootBindingsAfter = repos.sessionBindings.listByKind('team-root').length
const teamMemberBindingsAfter = repos.sessionBindings.listByKind('team-member').length
const ordinaryBindingsAfter = repos.sessionBindings.listByKind('ordinary').length
const workerMembersAfter = repos.memberInstances.list(ROOT_SID).length
const memcMembers = repos.memberInstances.list(FK_MEMC).length

// --- teardown -------------------------------------------------------------------

await root.close()
destroyDir(dir)

// --- the assertions (synchronous over the captured data) ------------------------

describe('P8-S7-R4 W3 (BQ-18): fork.describe — the read-only fork reconciliation state', () => {
  it('S1: a pair with no Team state on either side is ordinary (empty details)', () => {
    expect(s1.state).toBe('ordinary')
    expect(s1.details).toEqual({})
    expect(s1.parentSessionId).toBe(OP_PARENT)
    expect(s1.childSessionId).toBe(OP_CHILD)
  })

  it('S2: a forked member child is member-fork-ordinary — the binding row is provenance only', () => {
    expect(s2.state).toBe('member-fork-ordinary')
    expect(s2.details).toEqual({ rootSessionId: ROOT_SID, instanceId: SEED_WORKER_ID })
  })

  it('S3: record present without the binding is root-fork-recovering (record-only, 1/2 writes)', () => {
    expect(s3.state).toBe('root-fork-recovering')
    expect(s3.details).toEqual({ phase: 'record-only', durableWrites: 1 })
  })

  it('S4: a team-root parent with an unreconciled child is root-fork-recovering (not-reconciled)', () => {
    expect(s4.state).toBe('root-fork-recovering')
    expect(s4.details).toEqual({ phase: 'not-reconciled' })
  })

  it('S5: record + binding, memberless, same snapshot ref is root-fork-reconciled (2/2 writes)', () => {
    expect(s5.state).toBe('root-fork-reconciled')
    expect(s5.details).toEqual({ memberCount: 0, durableWrites: 2 })
  })

  it('S6: a child team-root binding without the record is an integrity-conflict (binding-without-record)', () => {
    expect(s6.state).toBe('integrity-conflict')
    expect(s6.details).toEqual({ conflict: 'binding-without-record' })
  })

  it('S7: a parent team-root binding without the parent record is an integrity-conflict (parent-binding-without-record)', () => {
    expect(s7.state).toBe('integrity-conflict')
    expect(s7.details).toEqual({ conflict: 'parent-binding-without-record' })
  })

  it('S8: a child pinning a different Blueprint snapshot is an integrity-conflict (blueprint-mismatch) with both refs', () => {
    expect(s8.state).toBe('integrity-conflict')
    expect(s8.details.conflict).toBe('blueprint-mismatch')
    expect(s8.details.parent).toEqual(parentBp)
    expect(s8.details.child).toEqual({ ...parentBp, contentHash: MISMATCH_HASH })
  })

  it('S9: a reconciled child carrying a member is an integrity-conflict (reconciled-child-carries-members)', () => {
    expect(s9.state).toBe('integrity-conflict')
    expect(s9.details).toEqual({ conflict: 'reconciled-child-carries-members', memberCount: 1 })
    expect(memcMembers).toBe(1)
  })

  it('S10: fork.describe is a pure read — every row count is unchanged across all nine states', () => {
    expect(tsAfter).toBe(tsBefore)
    expect(teamRootBindingsAfter).toBe(teamRootBindingsBefore)
    expect(teamMemberBindingsAfter).toBe(teamMemberBindingsBefore)
    expect(ordinaryBindingsAfter).toBe(ordinaryBindingsBefore)
    expect(workerMembersAfter).toBe(workerMembersBefore)
  })
})
