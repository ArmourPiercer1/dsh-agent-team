/**
 * t12b6-handoff-agent-start.test.ts — T12-B6 (Lane B): the handoff must
 * ACTUALLY start the target Agent through ONE formal create-and-start
 * primitive (plan §7-B4).
 *
 * The production root exposes a single `createAndStartTeam(...)` entry
 * served by BOTH callers:
 *
 *   1. the production `create` boot phase (no initialContext — the live
 *      layer's one-shot `boot()` owns the boot-time root agent), and
 *   2. the handoff target creation (the frozen HandoffContext as
 *      initialContext — the target Root Agent is created via the glue's
 *      `createRootAgent` port and the context is accepted through the
 *      REAL Agent input/context seam via `deliverRootContext`).
 *
 * The with-context handoff is COMPLETE only after BOTH the target Root
 * Agent exists and the context was accepted. Delivery is AT-LEAST-ONCE
 * with the contextToken as the explicit request identity: a re-drive
 * (retry after a failed delivery) may start the agent again and deliver
 * again, and the target DEDUPES by contextToken — no silent duplicate
 * team, no duplicate context entry. A glue without the ports fails
 * closed BEFORE any durable effect. There is NO second Team runtime for
 * the handoff: the target is a plain fresh-bound team root of the same
 * domain.
 *
 * Proven through the production entry (`host.apply` over a REAL file
 * storage seam + the stub glue, the t12b1/p8s7r4 pattern):
 *
 *   W1 — the with-context happy path: the target root is the
 *        deterministic derivation of the B5 composite intent token; the
 *        durable rows (TeamSession + handoff provenance, team-root
 *        binding, honest-v2 Leader, zero extra members) exist; the glue
 *        started the target Root Agent exactly once and delivered the
 *        frozen context (token-leading deterministic text); a same-token
 *        replay re-creates NOTHING.
 *   W2 — an injected delivery failure is surfaced EXPLICITLY as
 *        creation-failed (the partial durable team is visible, never
 *        silent); the re-invocation retries at-least-once (two starts,
 *        two delivery attempts, ONE deduped context entry, identical
 *        bytes) with no duplicate team or member.
 *   W3 — a glue WITHOUT the target-agent ports fails closed BEFORE any
 *        durable effect (no team, no binding, no member row).
 *   W4 — the boot create runs the SAME primitive but never touches the
 *        target-agent ports (the live `boot()` owns the boot agent).
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds are booted at module load (top-level await), the `it`
 * bodies assert synchronously (the t12b1 pattern).
 * @module @dsh-agent-team/runtime/test/t12b6-handoff-agent-start
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'
import { LEADER_INSTANCE_ID, canonicalJsonStringify } from '../../contracts/src/index.js'
import { HANDOFF_ERROR_CODES } from '../handoff/index.js'
import {
  expectedContextToken,
  expectedIntentToken,
  expectedTargetRoot,
} from './p7t5-helpers.js'

// --- the fixture identities -----------------------------------------------------

/** The production row's root (the team the boot create builds). */
const ROOT_SID = 'session-t12b6root'
/** The ordinary source session of the handoff (W1/W2). */
const SRC = 'session-t12b6src'
/** The stable request token of the W1/W2 handoff operation. */
const TOKEN = 'tok-t12b6-ctx'
/** The ordinary source session of the W3 handoff (the no-ports world). */
const SRC3 = 'session-t12b6src3'
/** The stable request token of the W3 handoff operation. */
const TOKEN3 = 'tok-t12b6-noports'

/** The row blueprint (structure mirrors the T12B1 fixture; own id). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: T12B6-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the T12B6 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the T12B6 work.',
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
  '    description: The T12B6 default state.',
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

/** The row config base (the entry's ONLY input channel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(overrides: Record<string, any>): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/t12b6',
    seedMembers: [],
    staticModel: { provider: 't12b6-static', model: 't12b6-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    ...overrides,
  }
}

// --- the test Cordis context (the t12b1 / p8s7r4 pattern) ----------------------

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
  return {
    ctx: {
      get: (name: string) => provided[name],
      provide: (name: string, value: unknown) => {
        provided[name] = value
      },
      effect: (factory: () => () => void, _label?: string) => {
        void factory()
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
  if (teamRoot === undefined) throw new Error('T12B6 guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const root: Record<string, any> = await teamRoot.ready
  return root
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`T12B6 invariant: ${label}`)
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * The fake `sessionQuery` service (the ONLY public read channel the
 * handoff wiring may use): a deterministic two-message surface for the
 * fixture source session + a fulfilled title observation (the p8s7r4
 * pattern). `source` narrows which session id the fake serves.
 */
function makeSessionQueryFake(source: string) {
  const fake = {
    readSurfaceCount: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    readSurface: async (id: string): Promise<Record<string, any>> => {
      fake.readSurfaceCount += 1
      if (id !== source) throw new Error(`readSurface called with '${id}' (expected '${source}')`)
      return {
        session: { id: source, createdAt: 1725000000000 },
        capturedThroughSeq: 9,
        events: [
          {
            seq: 1,
            type: 'user/message',
            time: 1725000001000,
            data: { content: [{ type: 'text', text: 'handoff me the t12b6 work' }] },
          },
          {
            seq: 2,
            type: 'assistant/message',
            time: 1725000002000,
            data: { message: { content: [{ type: 'text', text: 't12b6 baseline done' }] } },
          },
        ],
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    readTitleSnapshots: async (ids: readonly string[]): Promise<Record<string, any>[]> => {
      return ids.map((sid) => ({
        status: 'fulfilled',
        value: { session: { id: sid, createdAt: 1725000000000 }, title: { title: 'T12B6 source task' } },
      }))
    },
  }
  return fake
}

/** The stub glue's recorded state snapshot (the `__t1` diagnostics). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function glueSnapshot(glue: Record<string, any>): Record<string, any> {
  const state = glue.__t1
  return {
    bootCount: state.bootCount,
    rootAgentStarts: [...state.rootAgentStarts],
    rootContextDeliveryAttempts: state.rootContextDeliveryAttempts,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload / hidden internal state
    rootContextDeliveries: state.rootContextDeliveries.map((d: any) => ({ ...d })),
    rootContextLogSize: state.rootContextLog.size,
    rootContextLogKeys: [...state.rootContextLog.keys()],
  }
}

// Pre-cleanup: the scratch basenames are DETERMINISTIC (the testkit
// contract) — a crashed run would leave a stamped team_domain behind and
// poison the next run's create. Destroy every world's medium BEFORE the
// first boot so each world starts on a truly fresh medium.
for (const n of ['t12b6-happy', 't12b6-retry', 't12b6-noports', 't12b6-boot']) {
  destroyDir(scratchDir(n))
}

// --- W1: the with-context happy path (the target Agent really starts) ----------

const seam1 = new FileStorageSeam(scratchDir('t12b6-happy'))
const world1 = makeWorld(seam1)
world1.provided.sessionQuery = makeSessionQueryFake(SRC)
const root1 = await applyWorld(world1, rowConfig({}))
const repos1 = root1.domain.repositories
check(root1.live.__t1 !== undefined, 'W1: the stub glue diagnostics are missing')

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let h1: Record<string, any>
try {
  h1 = await root1.handoff.startTeamFromHere({
    sourceSessionId: SRC,
    requestToken: TOKEN,
    staged: {},
  })
} catch (err) {
  h1 = { error: err instanceof Error ? err.message : String(err) }
}
check(typeof h1.error !== 'string', `W1: the with-context handoff must not throw: ${h1.error}`)

const target1 = h1.team !== null && h1.team !== undefined ? String(h1.team.rootSessionId) : ''
const teamRecord1 = target1 === '' ? undefined : repos1.teamSessions.get(target1)
const binding1 = target1 === '' ? undefined : repos1.sessionBindings.get(target1)
const leader1 = target1 === '' ? undefined : repos1.memberInstances.get(target1, LEADER_INSTANCE_ID)
const memberCount1 = target1 === '' ? -1 : repos1.memberInstances.list(target1).length
const teamCount1 = repos1.teamSessions.list().length
const glue1 = glueSnapshot(root1.live)
const h1Context = h1.kind === 'completed' ? h1.context : undefined

// The same-token replay (BEFORE the assertion phase — the shim runs every
// `it` body after ALL top-level scenarios).
const h1b = await root1.handoff.startTeamFromHere({
  sourceSessionId: SRC,
  requestToken: TOKEN,
  staged: {},
})
const glue1AfterReplay = glueSnapshot(root1.live)
const teamCount1AfterReplay = repos1.teamSessions.list().length

// --- W2: the at-least-once retry (injected delivery failure) -------------------

const seam2 = new FileStorageSeam(scratchDir('t12b6-retry'))
const world2 = makeWorld(seam2)
world2.provided.sessionQuery = makeSessionQueryFake(SRC)
const root2 = await applyWorld(world2, rowConfig({}))
const repos2 = root2.domain.repositories
check(root2.live.__t1 !== undefined, 'W2: the stub glue diagnostics are missing')

const TOKEN2 = 'tok-t12b6-retry'
const target2 = expectedTargetRoot(expectedIntentToken(SRC, TOKEN2))
// Inject ONE delivery failure: the first delivery attempt throws (the
// bind + the agent start have already succeeded at that point).
root2.live.__t1.failNextDeliveries = 1
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let h2a: Record<string, any>
try {
  h2a = await root2.handoff.startTeamFromHere({
    sourceSessionId: SRC,
    requestToken: TOKEN2,
    staged: {},
  })
} catch (err) {
  h2a = { error: err instanceof Error ? err.message : String(err) }
}
check(typeof h2a.error !== 'string', `W2: the failed handoff must surface state, not throw: ${h2a.error}`)
// The partial durable state (the bind ran BEFORE the delivery failed).
const teamRecord2 = repos2.teamSessions.get(target2)
const leader2 = repos2.memberInstances.get(target2, LEADER_INSTANCE_ID)
const memberCount2 = repos2.memberInstances.list(target2).length
const teamCount2 = repos2.teamSessions.list().length
const glue2 = glueSnapshot(root2.live)

// The re-invocation (the same stable operation identity).
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let h2b: Record<string, any>
try {
  h2b = await root2.handoff.startTeamFromHere({
    sourceSessionId: SRC,
    requestToken: TOKEN2,
    staged: {},
  })
} catch (err) {
  h2b = { error: err instanceof Error ? err.message : String(err) }
}
check(typeof h2b.error !== 'string', `W2: the retry must not throw: ${h2b.error}`)
const glue2AfterRetry = glueSnapshot(root2.live)
const teamCount2AfterRetry = repos2.teamSessions.list().length
const memberCount2AfterRetry = repos2.memberInstances.list(target2).length

// --- W3: the no-ports glue (fail closed before any durable effect) -------------

const seam3 = new FileStorageSeam(scratchDir('t12b6-noports'))
const world3 = makeWorld(seam3)
world3.provided.sessionQuery = makeSessionQueryFake(SRC3)
const root3 = await applyWorld(world3, rowConfig({}))
const repos3 = root3.domain.repositories
// Simulate a glue that CANNOT start a target agent on demand: strip the
// additive ports from the live bundle (the root reads them at handoff
// time — the fail-closed preflight must catch it).
delete root3.live.createRootAgent
delete root3.live.deliverRootContext
const target3 = expectedTargetRoot(expectedIntentToken(SRC3, TOKEN3))
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let h3: Record<string, any>
try {
  h3 = await root3.handoff.startTeamFromHere({
    sourceSessionId: SRC3,
    requestToken: TOKEN3,
    staged: {},
  })
} catch (err) {
  h3 = { error: err instanceof Error ? err.message : String(err) }
}
check(typeof h3.error !== 'string', `W3: the no-ports handoff must surface state, not throw: ${h3.error}`)
const teamCount3 = repos3.teamSessions.list().length
const binding3 = repos3.sessionBindings.get(target3)
const memberCount3 = repos3.memberInstances.list(target3).length
const glue3 = glueSnapshot(root3.live)

// --- W4: the boot create (same primitive, target-agent ports untouched) --------

const seam4 = new FileStorageSeam(scratchDir('t12b6-boot'))
const root4 = await applyWorld(makeWorld(seam4), rowConfig({}))
const repos4 = root4.domain.repositories
const teamCount4 = repos4.teamSessions.list().length
const teamRecord4 = repos4.teamSessions.get(ROOT_SID)
const leader4 = repos4.memberInstances.get(ROOT_SID, LEADER_INSTANCE_ID)
const glue4 = glueSnapshot(root4.live)

// Teardown: close every world and destroy every medium.
try {
  await root1.close()
} finally {
  destroyDir(scratchDir('t12b6-happy'))
}
try {
  await root2.close()
} finally {
  destroyDir(scratchDir('t12b6-retry'))
}
try {
  await root3.close()
} finally {
  destroyDir(scratchDir('t12b6-noports'))
}
try {
  await root4.close()
} finally {
  destroyDir(scratchDir('t12b6-boot'))
}

// --- the assertions ---------------------------------------------------------------

describe('t12b6 handoff agent start', () => {
  it('W1: a with-context handoff completes through the ONE formal create-and-start primitive (deterministic target, durable rows, handoff provenance)', () => {
    expect(h1.kind).toBe('completed')
    expect(h1.replayed).toBe(false)
    // The target root is the DETERMINISTIC derivation of the B5
    // composite intent token (independent re-derivation).
    expect(target1).toBe(expectedTargetRoot(expectedIntentToken(SRC, TOKEN)))
    // Invariant 9: TeamSessionId = RootSessionId.
    expect(h1.team.teamSessionId).toBe(target1)
    // The durable TeamSession record carries the handoff provenance.
    expect(teamRecord1 !== undefined).toBe(true)
    expect(teamRecord1!.handoffSourceSessionId).toBe(SRC)
    expect(teamRecord1!.generation).toBe(1)
    expect(ISO_RE.test(String(teamRecord1!.createdAt))).toBe(true)
    // P9-S8 (F1-lite v2): the workspace inheritance rides the PRE-PUT
    // record — `bindFreshTeamRoot`'s existing-record branch keeps that
    // row as-is (it matches blueprint + generation only), so without it
    // the created team's projection fold cannot resolve the leader's
    // effective workspace and fails closed.
    expect(teamRecord1!.defaultWorkspace).toBe('C:/agent-team/work/t12b6')
    // The team-root binding + the honest-v2 Leader (NO childSessionId).
    expect(binding1 !== undefined).toBe(true)
    expect(binding1!.kind).toBe('team-root')
    expect(binding1!.sessionId).toBe(target1)
    expect(leader1 !== undefined).toBe(true)
    expect(leader1!.templateId).toBe('leader')
    expect(leader1!.childSessionId === undefined).toBe(true)
    // ZERO fabricated members: the boot team + the target team, one
    // member (the leader) each.
    expect(memberCount1).toBe(1)
    expect(teamCount1).toBe(2)
  })

  it('W1: the target Root Agent is created ONCE and the frozen context is accepted through the real Agent input/context seam (token-leading deterministic text)', () => {
    const ctxToken = expectedContextToken(SRC, TOKEN)
    // Exactly one target agent start, for the minted root.
    expect(glue1.rootAgentStarts.length).toBe(1)
    expect(glue1.rootAgentStarts[0]).toBe(target1)
    // Exactly one successful delivery, addressed to the target root.
    expect(glue1.rootContextDeliveries.length).toBe(1)
    expect(glue1.rootContextDeliveries[0].rootSessionId).toBe(target1)
    expect(glue1.rootContextDeliveries[0].contextToken).toBe(ctxToken)
    // The delivered text is deterministic: the contextToken LEADS (the
    // explicit request identity of the at-least-once delivery) followed
    // by the canonical lossless-JSON body of the SAME frozen context.
    const text = glue1.rootContextDeliveries[0].text
    expect(text.indexOf(`handoff-context ${ctxToken}\n`) === 0).toBe(true)
    expect(h1Context !== undefined).toBe(true)
    expect(text.indexOf(canonicalJsonStringify(h1Context!)) >= 0).toBe(true)
    // The target deduped log holds the ONE context entry, keyed by the
    // token (at-least-once attempts: exactly one here).
    expect(glue1.rootContextDeliveryAttempts).toBe(1)
    expect(glue1.rootContextLogSize).toBe(1)
    expect(glue1.rootContextLogKeys[0]).toBe(ctxToken)
  })

  it('W1: a same-token replay re-creates NOTHING (no second agent start, no second delivery, no duplicate team)', () => {
    expect(h1b.kind).toBe('completed')
    expect(h1b.replayed).toBe(true)
    expect(h1b.team.rootSessionId).toBe(target1)
    // The replay returns the stored outcome — the creation entry is NOT
    // re-invoked (the port is called exactly once in total).
    expect(glue1AfterReplay.rootAgentStarts.length).toBe(1)
    expect(glue1AfterReplay.rootContextDeliveries.length).toBe(1)
    expect(glue1AfterReplay.rootContextLogSize).toBe(1)
    expect(teamCount1AfterReplay).toBe(2)
  })

  it('W2: an injected delivery failure is surfaced EXPLICITLY as creation-failed (the partial team is visible, never silent)', () => {
    expect(h2a.kind).toBe('creation-failed')
    expect(h2a.failure.code).toBe(HANDOFF_ERROR_CODES.TEAM_CREATION_FAILED)
    expect(
      String(h2a.failure.message).indexOf('injected deliverRootContext failure') >= 0,
    ).toBe(true)
    // The operation carries NO team outcome yet...
    expect(h2a.team).toBe(undefined)
    // ...but the partial durable state is VISIBLE (the bind ran before
    // the delivery failed): the TeamSession record + the honest-v2 Leader.
    expect(teamRecord2 !== undefined).toBe(true)
    expect(teamRecord2!.handoffSourceSessionId).toBe(SRC)
    expect(teamRecord2!.generation).toBe(1)
    expect(leader2 !== undefined).toBe(true)
    expect(memberCount2).toBe(1)
    // The boot team + the partial target team — no silent duplicate.
    expect(teamCount2).toBe(2)
    // The agent WAS started (before the delivery failed); the failed
    // delivery left no successful record.
    expect(glue2.rootAgentStarts.length).toBe(1)
    expect(glue2.rootAgentStarts[0]).toBe(target2)
    expect(glue2.rootContextDeliveryAttempts).toBe(1)
    expect(glue2.rootContextDeliveries.length).toBe(0)
    expect(glue2.rootContextLogSize).toBe(0)
  })

  it('W2: the re-invocation retries AT-LEAST-ONCE and DEDUPES (two starts, two delivery attempts, ONE context entry, no duplicate team or member)', () => {
    expect(h2b.kind).toBe('completed')
    expect(h2b.replayed).toBe(false)
    // The SAME deterministic target (the re-drive is a re-drive, not a
    // new operation).
    expect(h2b.team.rootSessionId).toBe(target2)
    // At-least-once: the agent start and the delivery were each
    // attempted a second time...
    expect(glue2AfterRetry.rootAgentStarts.length).toBe(2)
    expect(glue2AfterRetry.rootContextDeliveryAttempts).toBe(2)
    // ...but the target state holds exactly ONE context entry (deduped
    // by the contextToken — no silent duplicate), delivered as the
    // deterministic token-leading text.
    expect(glue2AfterRetry.rootContextDeliveries.length).toBe(1)
    const ctxToken = expectedContextToken(SRC, TOKEN2)
    expect(glue2AfterRetry.rootContextDeliveries[0].contextToken).toBe(ctxToken)
    expect(
      glue2AfterRetry.rootContextDeliveries[0].text.indexOf(`handoff-context ${ctxToken}\n`) === 0,
    ).toBe(true)
    expect(glue2AfterRetry.rootContextLogSize).toBe(1)
    expect(glue2AfterRetry.rootContextLogKeys[0]).toBe(ctxToken)
    // No duplicate team, no duplicate member.
    expect(teamCount2AfterRetry).toBe(2)
    expect(memberCount2AfterRetry).toBe(1)
  })

  it('W3: a glue WITHOUT the target-agent ports fails closed BEFORE any durable effect (no team, no binding, no member row)', () => {
    expect(h3.kind).toBe('creation-failed')
    expect(h3.failure.code).toBe(HANDOFF_ERROR_CODES.TEAM_CREATION_FAILED)
    expect(
      String(h3.failure.message).indexOf('createRootAgent / deliverRootContext') >= 0,
    ).toBe(true)
    expect(h3.team).toBe(undefined)
    // Only the BOOT team exists — the with-context handoff left ZERO
    // durable target effect (the preflight ran before the pre-put).
    expect(teamCount3).toBe(1)
    expect(binding3).toBe(undefined)
    expect(memberCount3).toBe(0)
    // And the glue's target-agent surface was never touched.
    expect(glue3.rootAgentStarts.length).toBe(0)
    expect(glue3.rootContextDeliveryAttempts).toBe(0)
    expect(glue3.rootContextDeliveries.length).toBe(0)
  })

  it('W4: the boot create runs the SAME primitive but never touches the target-agent ports (the live boot owns the boot agent)', () => {
    // The boot team exists with the post-boot generation (the G8-S1
    // boot-time compatibility probe advanced it: bind stamp 1 -> 2).
    expect(teamCount4).toBe(1)
    expect(teamRecord4 !== undefined).toBe(true)
    expect(teamRecord4!.generation).toBe(2)
    expect(leader4 !== undefined).toBe(true)
    expect(leader4!.childSessionId === undefined).toBe(true)
    // The live layer's one-shot boot created the boot-time root agent —
    // the target-agent ports (the handoff-only seam) were NEVER used.
    expect(glue4.bootCount).toBe(1)
    expect(glue4.rootAgentStarts.length).toBe(0)
    expect(glue4.rootContextDeliveryAttempts).toBe(0)
    expect(glue4.rootContextDeliveries.length).toBe(0)
    expect(glue4.rootContextLogSize).toBe(0)
  })
})
