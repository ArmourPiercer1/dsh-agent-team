/**
 * p8s7r4-handoff-wiring.test.ts — P8-S7-R4 W1 (A28): the THREE handoff
 * production ports are UN-FAIL-CLOSED in the shipped production entry
 * (coverage rows M11 + the A28 port triad):
 *
 * - `sourceSurface` — the EXACTLY-ONE canonical surface freeze through
 *   the DSH public `sessionQuery` service (injected through the row's
 *   public seam; verified at use time, never at construction time);
 * - `summarizer` — the one-shot NON-MODEL deterministic digest
 *   (`summarizeSourceSurface` — pure, no model, no I/O);
 * - `teamCreation` — the fresh-root binding path reused for handoffs
 *   (deterministic mint `session-handoff-<sha256(intentToken) hex40>`,
 *   the TeamSession record PRE-PUT with the one-shot provenance
 *   `handoffSourceSessionId`, then `bindFresh` — W1/BQ-16).
 *
 * Proven against the REAL production entry (`../src/plugin/host.js`
 * `apply(ctx, config)`) over a REAL storage seam (testkit
 * `FileStorageSeam`):
 *
 * 1. a handoff started through the production `handoff` port completes
 *    (no `HANDOFF_*UNAVAILABLE`), reads the source EXACTLY ONCE, mints
 *    the deterministic root, and the durable record carries the
 *    provenance field;
 * 2. the BQ-17 read surface (`handoffRead.describe`) joins the
 *    in-memory operation view with the durable provenance;
 * 3. the BQ-18 read (`fork.describe`) classifies the minted handoff root
 *    as `integrity-conflict` / `reconciled-child-carries-members`
 *    (memberCount 1) — a handoff root is a FULL fresh team (record +
 *    team-root binding + v2 LeaderInstance), not a memberless fork
 *    sidecar;
 * 4. the S6 remote `handoff.prepare` route now returns the deterministic
 *    summary (the A28 `handoffPrepare` producer is wired);
 * 5. the S6 remote `handoff.create` route is IDEMPOTENT per
 *    `(sourceSessionId, requestToken)` — a same-token replay re-reads
 *    nothing and creates nothing new (BC-22, production level);
 * 6. a world WITHOUT the `sessionQuery` service keeps the documented
 *    fail-closed behavior (service: `HANDOFF_SOURCE_SURFACE_UNAVAILABLE`;
 *    remote: `TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE`).
 *
 * Runner note: the plain-node shim (scripts/test-vitest-shim.mjs)
 * forbids async `it()` bodies and exposes only toBe/toEqual/
 * toBeGreaterThan/toThrow — so every scenario is driven at MODULE TOP
 * LEVEL and the `it` bodies assert synchronously over the captured
 * results (the P8-S5A / P8-S7-R2 pattern).
 *
 * @module @dsh-agent-team/runtime/test/p8s7r4-handoff-wiring
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

// --- the fixture identities ----------------------------------------------------

/** The production row's root (the team the handoffs originate FROM). */
const ROOT_SID = 'session-p8s7r4root'
/** The ordinary source session (the handoff SOURCE — no team binding). */
const SRC_SID = 'session-p8s7r4-src'
/** The T2-A seeded worker (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-p8s7r4seedw1'
const SEED_WORKER_CHILD = 'session-child-p8s7r4seedw1'

/** The T2 blueprint (own id; structure mirrors the P8-S5A fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S7R4-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S7R4 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S7R4 work.',
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
  '    description: The P8S7R4 default state.',
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
    defaultWorkspace: 'C:/agent-team/work/p8s7r4',
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
  if (teamRoot === undefined) throw new Error('T2 scenario guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const root: Record<string, any> = await teamRoot.ready
  return root
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`T2 scenario guard: ${label}`)
}

/**
 * Capture the remote dispatcher the registration installs (the P8-S7-R2
 * fake-connection pattern) and return the endpoint caller.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function attachRemoteCaller(root: Record<string, any>): (
  endpoint: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  params: Record<string, any>,
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
) => Promise<Record<string, any>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  let captured: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null = null
  const registration = root.seams.remoteHandlerRegistration.current()
  check(registration !== null, 'the remote handler registration seam is empty')
  registration({
    rpc: {
      handle: (_channel: string, dispatcher: unknown) => {
        captured = dispatcher as (
          endpoint: string,
          payload: unknown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
        ) => Promise<Record<string, any>>
        return () => {}
      },
    },
  })
  const dispatcher = captured as
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    | ((endpoint: string, payload: unknown) => Promise<Record<string, any>>)
    | null
  if (dispatcher === null) throw new Error('the registration never installed a dispatcher')
  return (endpoint, params) => dispatcher(endpoint, { version: 1, params })
}

/** Read one remote response's error code (null when ok). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function remoteCode(response: Record<string, any>): string | null {
  if (response.ok === false) {
    const error = response['error']
    return error !== null && typeof error === 'object'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
      ? String((error as Record<string, any>)['code'])
      : 'malformed-error'
  }
  return null
}

/** Read one remote response's data payload (the `{ok, value: {data}}` envelope). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function remoteData(response: Record<string, any>): Record<string, any> {
  const value = response['value']
  if (value === null || typeof value !== 'object') {
    throw new Error('T2 scenario guard: the remote response carries no value envelope')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const data = (value as Record<string, any>)['data']
  if (data === null || typeof data !== 'object') {
    throw new Error('T2 scenario guard: the remote response carries no data payload')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  return data as Record<string, any>
}

// --- the DSH public sessionQuery fake (the injected public authority) ----------

/**
 * The fake `sessionQuery` service (the ONLY public read channel the
 * handoff wiring may use). Records every surface read; returns a
 * deterministic two-message surface for the fixture source session and
 * a fulfilled title observation.
 */
function makeSessionQueryFake() {
  const fake = {
    readSurfaceCount: 0,
    readTitleCount: 0,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    readSurface: async (id: string): Promise<Record<string, any>> => {
      fake.readSurfaceCount += 1
      if (id !== SRC_SID) throw new Error(`readSurface called with '${id}'`)
      return {
        session: { id: SRC_SID, createdAt: 1725000000000 },
        capturedThroughSeq: 9,
        events: [
          {
            seq: 1,
            type: 'user/message',
            time: 1725000001000,
            data: { content: [{ type: 'text', text: 'handoff me the baseline work' }] },
          },
          {
            seq: 2,
            type: 'assistant/message',
            time: 1725000002000,
            data: { message: { content: [{ type: 'text', text: 'baseline done' }] } },
          },
        ],
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    readTitleSnapshots: async (ids: readonly string[]): Promise<Record<string, any>[]> => {
      fake.readTitleCount += 1
      return ids.map((sid) => ({
        status: 'fulfilled',
        value: { session: { id: sid, createdAt: 1725000000000 }, title: { title: 'P8S7R4 source task' } },
      }))
    },
  }
  return fake
}

// --- T2-A: the wired world (sessionQuery present) --------------------------------

const dirA = scratchDir('p8s7r4-t2a-wired')
const seamA = new FileStorageSeam(dirA)
const worldA = makeWorld(seamA)
const queryA = makeSessionQueryFake()
worldA.provided.sessionQuery = queryA
const rootA = await applyWorld(worldA, rowConfig(ROOT_SID))

// Scenario 1: the handoff completes through the production port.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
let s1State: Record<string, any> = {}
try {
  s1State = await rootA.handoff.startTeamFromHere({
    sourceSessionId: SRC_SID,
    requestToken: 'tok-p8s7r4-w1',
    staged: {},
  })
} catch (err) {
  s1State = { error: err instanceof Error ? err.message : String(err) }
}
const s1Minted = typeof s1State.team === 'object' && s1State.team !== null ? String(s1State.team.rootSessionId) : ''
// Snapshot BEFORE the later scenarios re-read the source (the shim runs
// every `it` body after ALL top-level scenarios — intermediate state needs
// top-level snapshots).
const s1ReadCount = queryA.readSurfaceCount

// Scenario 2: the BQ-17 read surface joins operation state + durable provenance.
const s2Describe =
  typeof rootA.handoffRead === 'object' && rootA.handoffRead !== null
    ? rootA.handoffRead.describe({ sourceSessionId: SRC_SID, requestToken: 'tok-p8s7r4-w1' })
    : null

// Scenario 3: the durable record of the minted root (the sole authority).
const s3Record = s1Minted === '' ? undefined : rootA.domain.repositories.teamSessions.get(s1Minted)

// Scenario 4: the BQ-18 fork state of the handoff child (a settled fork).
const s4Fork =
  s1Minted === ''
    ? null
    : rootA.fork.describe({ parentSessionId: SRC_SID, childSessionId: s1Minted })

// Scenario 5: the S6 remote handoff.prepare route (the A28 producer).
const callerA = attachRemoteCaller(rootA)
const s5Prepare = await callerA('handoff.prepare', { sourceSessionId: SRC_SID })
// Snapshot BEFORE the handoff.create scenarios (the w2 operation reads again).
const s5ReadCount = queryA.readSurfaceCount

// Scenario 6: the S6 remote handoff.create route — idempotency per
// (sourceSessionId, requestToken) (BC-22, production level).
const s6First = await callerA('handoff.create', {
  sourceSessionId: SRC_SID,
  requestToken: 'tok-p8s7r4-w2',
  staged: {},
})
const s6Second = await callerA('handoff.create', {
  sourceSessionId: SRC_SID,
  requestToken: 'tok-p8s7r4-w2',
  staged: {},
})
const s6FirstData =
  typeof s6First.value === 'object' && s6First.value !== null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    ? (s6First.value as Record<string, any>)['data']
    : null
const s6FirstState =
  s6FirstData !== null && typeof s6FirstData === 'object'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    ? (s6FirstData as Record<string, any>)['state']
    : null
const s6Minted =
  s6FirstState !== null &&
  typeof s6FirstState === 'object' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  typeof (s6FirstState as Record<string, any>).team === 'object' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  (s6FirstState as Record<string, any>).team !== null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    ? String((s6FirstState as Record<string, any>).team.rootSessionId)
    : ''
const s6RecordCount = s6Minted === '' ? -1 : rootA.domain.repositories.teamSessions.get(s6Minted) === undefined ? 0 : 1
const s6AllRecords = rootA.domain.repositories.teamSessions.list().length

// --- T2-B: the fail-closed world (sessionQuery absent) ----------------------------

const dirB = scratchDir('p8s7r4-t2b-failclosed')
const seamB = new FileStorageSeam(dirB)
const worldB = makeWorld(seamB)
const rootB = await applyWorld(worldB, rowConfig('session-p8s7r4rootb'))

let s7ServiceError: unknown = null
try {
  await rootB.handoff.startTeamFromHere({
    sourceSessionId: SRC_SID,
    requestToken: 'tok-p8s7r4-w3',
    staged: {},
  })
} catch (err) {
  s7ServiceError = err
}
const s7Code =
  s7ServiceError !== null &&
  typeof s7ServiceError === 'object' &&
  (s7ServiceError as { name?: unknown }).name === 'HandoffError' &&
  typeof (s7ServiceError as { code?: unknown }).code === 'string'
    ? (s7ServiceError as { code: string }).code
    : `unexpected-error: ${s7ServiceError instanceof Error ? s7ServiceError.message : String(s7ServiceError)}`

const callerB = attachRemoteCaller(rootB)
const s8Prepare = await callerB('handoff.prepare', { sourceSessionId: SRC_SID })

// --- teardown ----------------------------------------------------------------------

await rootA.close()
await rootB.close()
await destroyDir(dirA)
await destroyDir(dirB)

// --- assertions ----------------------------------------------------------------------

describe('p8s7r4 W1 (A28) — the handoff production ports are un-fail-closed in the production entry', () => {
  it('S1: a handoff completes end-to-end — the source is read EXACTLY ONCE and the root is minted deterministically', () => {
    expect(typeof s1State.error === 'string').toBe(false)
    expect(s1State.kind).toBe('completed')
    expect(s1State.replayed).toBe(false)
    expect(/^session-handoff-[0-9a-f]{40}$/.test(s1Minted)).toBe(true)
    // Snapshot taken right after S1 (the shim runs every `it` body after
    // ALL top-level scenarios): the one-shot freeze read the source
    // EXACTLY ONCE.
    expect(s1ReadCount).toBe(1)
  })

  it('S2: handoffRead.describe (BQ-17) joins the operation view with the durable provenance', () => {
    check(s2Describe !== null, 'handoffRead.describe is missing on the root surface')
    expect(s2Describe.known).toBe(true)
    expect(s2Describe.snapshotStatus).toBe('context-frozen')
    check(
      s2Describe.state !== null,
      'the completed operation has no observable state on the read surface',
    )
    expect(s2Describe.state.kind).toBe('completed')
    check(
      s2Describe.createdTeam !== undefined,
      'the created team identity is missing on the read surface',
    )
    expect(s2Describe.createdTeam.rootSessionId).toBe(s1Minted)
    expect(s2Describe.createdTeam.handoffSourceSessionId).toBe(SRC_SID)
  })

  it('S3: the durable record of the minted root carries the one-shot provenance (BQ-16)', () => {
    check(s3Record !== undefined, 'the minted root has no durable TeamSession record')
    expect(s3Record.handoffSourceSessionId).toBe(SRC_SID)
    check(
      s3Record.blueprint !== undefined,
      'the minted record has no blueprint snapshot ref',
    )
    expect(String(s3Record.blueprint.blueprintId)).toBe('P8S7R4-BP')
    expect(String(s3Record.blueprint.revision)).toBe('1')
    expect(s3Record.generation).toBe(1)
  })

  it('S4: the minted handoff root is a FULL fresh team — fork.describe classifies it as an integrity conflict (member-carrying reconciled child), NOT a settled fork sidecar (BQ-18)', () => {
    check(s4Fork !== null, 'fork.describe is missing or the mint is absent')
    expect(s4Fork.state).toBe('integrity-conflict')
    expect(s4Fork.details).toEqual({ conflict: 'reconciled-child-carries-members', memberCount: 1 })
  })

  it('S5: the remote handoff.prepare route returns the deterministic NON-MODEL summary (the A28 producer)', () => {
    expect(remoteCode(s5Prepare)).toBe(null)
    const summary = remoteData(s5Prepare)['summary']
    check(summary !== null && typeof summary === 'object', 'handoff.prepare returned no summary')
    expect(summary['title']).toBe('P8S7R4 source task')
    const rawBullets: unknown = summary['bullets']
    if (!Array.isArray(rawBullets)) throw new Error('T2 scenario guard: the summary has no bullets')
    const bullets: readonly unknown[] = rawBullets
    check(bullets.length >= 1, 'the summary bullets are empty')
    expect(String(bullets[0])).toBe(
      `Captured 2 message(s) — 1 user, 1 assistant — at ${new Date(1725000000000).toISOString()} through log seq 9.`,
    )
    // prepare re-freezes the surface (it is a fresh read route — the
    // one-shot freeze belongs to the operation, not to prepare).
    // Snapshot taken right after prepare: the source is now read 2x
    // (the S1 operation read + this prepare read).
    expect(s5ReadCount).toBe(2)
  })

  it('S6: the remote handoff.create is idempotent per (sourceSessionId, requestToken) — the replay creates nothing new (BC-22)', () => {
    expect(remoteCode(s6First)).toBe(null)
    const firstState = remoteData(s6First)['state']
    expect(firstState.kind).toBe('completed')
    expect(firstState.replayed).toBe(false)
    expect(/^session-handoff-[0-9a-f]{40}$/.test(s6Minted)).toBe(true)
    // The same-token replay: stored state replayed, no new read, no new team.
    expect(remoteCode(s6Second)).toBe(null)
    const secondState = remoteData(s6Second)['state']
    expect(secondState.kind).toBe('completed')
    expect(secondState.replayed).toBe(true)
    expect(secondState.team.rootSessionId).toBe(s6Minted)
    // The source was read for the FIRST create only (the S1 operation +
    // the prepare read + this w2 operation = 3; the w2 replay re-reads
    // nothing — the idempotency contract).
    expect(queryA.readSurfaceCount).toBe(3)
    // Exactly one durable record for the minted root (no duplicate).
    expect(s6RecordCount).toBe(1)
    // The store holds: the row root + the S1 mint + the S6 mint = 3.
    expect(s6AllRecords).toBe(3)
  })

  it('S7: without the sessionQuery service the handoff port keeps failing closed (service-level code)', () => {
    expect(s7Code).toBe('HANDOFF_SOURCE_SURFACE_UNAVAILABLE')
  })

  it('S8: without the sessionQuery service the remote prepare route keeps failing closed (root-level code)', () => {
    expect(remoteCode(s8Prepare)).toBe('TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE')
  })
})
