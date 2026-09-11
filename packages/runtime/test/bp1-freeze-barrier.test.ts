/**
 * bp1-freeze-barrier.test.ts — BP6 spec (issue #2 blueprint-loading
 * parallel repair, plan §10): the freeze barrier at the fresh-TeamSession
 * choke points + the plan's fresh-TeamSession invariant.
 *
 * The invariant (plan §10):
 *
 *   > a production fresh TeamSession commit ⇒ the registry MUST carry the
 *     same `(blueprintId, revision, contentHash)` record.
 *
 * pinned here over the two production mint paths the host entry drives:
 *
 *   1. the REAL create boot (the shared `rootBinding.bindFresh` wrapper
 *      — the single choke point team.create v1/v2 and the boot create
 *      share): after the create settles, the row anchor is frozen in the
 *      TeamDomain `blueprint_registry` with the exact (id, revision,
 *      contentHash) of the minted TeamSession's bound snapshot, and the
 *      stored source text is the row anchor (the pinned source — the
 *      saved copy under blueprintDir with the same identity is shadowed,
 *      never a duplicate, the RED-1 contract);
 *   2. the fixture boot seed (the writer-audit category 3 — a fixture
 *      world with an injected authority explicitly seeds the registry for
 *      the row anchor before its durable put): after the seeded boot, the
 *      same invariant holds for the seeded TeamSession.
 *
 * The legacy factory-world path (no injected authority — the direct
 * `bindFreshTeamRoot` callers, e.g. the p5t5-fresh-root world) keeps the
 * no-freeze behavior: those worlds stay green without touching the
 * registry (the root's `blueprintAuthority` param is the only switch).
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds boot at module load (top-level await), the `it` bodies
 * assert synchronously (the t12b1 / t12m4 pattern).
 *
 * @module @dsh-agent-team/runtime/test/bp1-freeze-barrier
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
  writeText,
} from '../../testkit/fault-injection/file-seam.mjs'
import { openTeamDomain } from '../../storage/repositories/index.js'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { parseBlueprint, toBlueprintSnapshotRef } from '../../domain/blueprint/src/index.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the fixture identities -------------------------------------------------------

const ROOT_SID = 'session-bp1barroot'
const FIXTURE_ROOT_SID = 'session-bp1barfix'

/** The row anchor (the full closed v1 document — the T12-B1 proven shape). */
const ANCHOR_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: BP1-BAR-A',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the BP1-BAR-A team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the BP1-BAR-A work.',
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
  '    description: The BP1-BAR-A default state.',
  'quotas:',
  '    team:',
  '      maxInstances: 12',
  '      maxConcurrent: 12',
  '    members:',
  '      maxInstances: 4',
  '      maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

const ANCHOR_REF = toBlueprintSnapshotRef(parseBlueprint(ANCHOR_SOURCE))

function rowConfig(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: ANCHOR_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/bp1bar',
    seedMembers: [],
    staticModel: { provider: 'bp1bar-static', model: 'bp1bar-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    remoteMountWaitMs: 0,
    ...overrides,
  }
}

// --- the test Cordis context (the t12b1/t12m4 pattern) -----------------------------

interface TestWorld {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double)
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function makeWorld(extra: Record<string, any>): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double)
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    ...extra,
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
    effectDisposers,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
async function applyWorld(world: TestWorld, config: Record<string, unknown>): Promise<Record<string, any>> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('BP1 guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  const root: Record<string, any> = await teamRoot.ready
  return root
}

// --- W1: the REAL create boot (the bindFresh wrapper choke point) -------------------

const sourcesDir = scratchDir('bp1-barrier-sources')
destroyDir(sourcesDir)
// A saved copy of the ANCHOR identity under the directory (the RED-1
// contract: shadowed by the anchor, never a duplicate) + one saved B.
writeText(`${sourcesDir}/barrier-a.yml`, ANCHOR_SOURCE)
writeText(
  `${sourcesDir}/barrier-b.yml`,
  ANCHOR_SOURCE.replace('BP1-BAR-A', 'BP1-BAR-B'),
)
const dir1 = scratchDir('bp1-barrier-create')
destroyDir(dir1)
const seam1 = new FileStorageSeam(dir1)
const world1 = makeWorld({ teamStorageSeam: seam1 })
const root1 = await applyWorld(world1, rowConfig({ blueprintDir: sourcesDir }))

// The durable audit: reopen the medium fresh (the root is still live — the
// audit reads the committed bytes, not the root's view).
const audit1 = await openTeamDomain(new FileStorageSeam(dir1))
const w1Session = audit1.repositories.teamSessions.get(ROOT_SID)
const w1Row = w1Session === undefined ? undefined : audit1.repositories.blueprintRegistry.get(w1Session.blueprint.blueprintId, w1Session.blueprint.revision)

await root1.close()
await world1.effectDisposers.forEach((dispose) => dispose())
destroyDir(dir1)
destroyDir(sourcesDir)

// --- W2: the fixture boot seed (writer-audit category 3) ----------------------------

const dir2 = scratchDir('bp1-barrier-fixture')
destroyDir(dir2)
const seam2 = new FileStorageSeam(dir2)
const world2 = makeWorld({ teamStorageSeam: seam2 })
const root2 = await applyWorld(world2, rowConfig({
  rootSessionId: FIXTURE_ROOT_SID,
  // A NON-EMPTY seedMembers is the documented fixture-world trigger
  // (plan §7-B1): the boot seeds the frozen world through seedBootWorld.
  seedMembers: [
    {
      instanceId: 'inst-barrierworker',
      templateId: 'worker',
      label: 'worker',
      childSessionId: 'session-bp1barfixworker',
    },
  ],
}))

const audit2 = await openTeamDomain(new FileStorageSeam(dir2))
const w2Session = audit2.repositories.teamSessions.get(FIXTURE_ROOT_SID)
const w2Row = w2Session === undefined ? undefined : audit2.repositories.blueprintRegistry.get(w2Session.blueprint.blueprintId, w2Session.blueprint.revision)

await root2.close()
await world2.effectDisposers.forEach((dispose) => dispose())
destroyDir(dir2)

// --- the assertions (sync it() bodies) ------------------------------------------------

describe('BP6 freeze barrier: the fresh-TeamSession invariant (plan §10)', () => {
  it('W1 real create: the minted TeamSession carries the row anchor snapshot, and the registry holds the SAME (id, revision, contentHash) record', () => {
    expect(w1Session).not.toBe(undefined)
    expect(w1Session?.blueprint.blueprintId).toBe(ANCHOR_REF.blueprintId)
    expect(w1Session?.blueprint.revision).toBe(ANCHOR_REF.revision)
    expect(w1Session?.blueprint.contentHash).toBe(ANCHOR_REF.contentHash)
    expect(w1Row).not.toBe(undefined)
    expect(w1Row?.blueprintId).toBe(ANCHOR_REF.blueprintId)
    expect(w1Row?.revision).toBe(ANCHOR_REF.revision)
    expect(w1Row?.contentHash).toBe(ANCHOR_REF.contentHash)
    // the stored source text is the row anchor (the pinned source)
    expect(w1Row?.source).toBe(ANCHOR_SOURCE)
    // the saved copy of the anchor identity under blueprintDir never became
    // a second row (shadow semantics — the freeze appended exactly once)
    expect(audit1.repositories.blueprintRegistry.list().length).toBe(1)
  })

  it('W2 fixture boot seed: the seeded TeamSession carries the anchor snapshot, and the registry holds the SAME record (category-3 explicit seeding)', () => {
    expect(w2Session).not.toBe(undefined)
    expect(w2Session?.blueprint.blueprintId).toBe(ANCHOR_REF.blueprintId)
    expect(w2Session?.blueprint.revision).toBe(ANCHOR_REF.revision)
    expect(w2Session?.blueprint.contentHash).toBe(ANCHOR_REF.contentHash)
    expect(w2Row).not.toBe(undefined)
    expect(w2Row?.contentHash).toBe(ANCHOR_REF.contentHash)
    expect(w2Row?.source).toBe(ANCHOR_SOURCE)
  })

  it('W2 fixture world: the seed member row was seeded alongside (the fixture contract is intact)', () => {
    const worker = audit2.repositories.memberInstances.get(FIXTURE_ROOT_SID, 'inst-barrierworker')
    expect(worker).not.toBe(undefined)
    expect(worker?.templateId).toBe('worker')
  })
})
