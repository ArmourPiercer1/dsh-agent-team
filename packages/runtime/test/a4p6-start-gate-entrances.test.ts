/**
 * a4p6-start-gate-entrances.test.ts — A4-PR6 review round 1 (BLOCKER 1):
 * the governance start gate sits at EVERY real entrance to a Team start.
 *
 * The 6.A wire law pinned an OCCURRENCE COUNT of `governanceStartGate(`
 * in `s6-remote.ts` — a count that could not see the two non-wire
 * entrances the review found ungated:
 *
 *  - `handoff.create` — the with-handoff operation ALWAYS carries the
 *    frozen context (`handoff/service.ts`: the `with-handoff` mode is
 *    entered only after the one-shot context was materialized), so it
 *    reaches `createAndStartTeam` and calls the target Root Agent start
 *    port — the SAME `live.createRootAgent` entry the gated wire path
 *    uses — with no gate in front of it;
 *  - the production BOOT — the create phase mints durably and the live
 *    layer starts the Root Agent, and the resume phase re-starts a
 *    durable Team, both without ever consulting the gate.
 *
 * This file is the behavioural replacement for the count law: each real
 * entrance is DRIVEN (real `createTeamProductionRoot`, real S6
 * dispatcher, real handoff operation state machine, real durable
 * storage — only the governance service port and the live glue are
 * doubles) and the assertions are the two the review demanded: the
 * TYPED refusal (the wire-shared `TEAM_START_GOVERNANCE_*` code) and
 * ZERO START (the glue's `createRootAgent` port never fires for the
 * refused root; `live.boot` never fires for a refused boot), plus ZERO
 * durable mint for a refused boot-create (fail-closed BEFORE the write).
 *
 * A source law pins the mapping discipline: the three arms are built by
 * ONE exported mapper (`governanceStartRefusal` in `s6-remote.ts`) that
 * every entrance shares — drift between entrances is a contract
 * violation, and no second copy of the wire codes may exist in
 * `root.ts`.
 *
 * The `open` worlds are the regression half: the gate must not break
 * the entrances it now guards (handoff completes, boot completes).
 * The replay assertion proves the refusal is NOT swallowed into the
 * generic `creation-failed` handoff state: the typed code survives to
 * the wire AND the operation stays re-drivable (the review's "refusal
 * is the outcome, not an infrastructure failure").
 *
 * Runner note: the plain-node shim forbids async `it()` bodies and
 * exposes only toBe/toEqual/toBeGreaterThan/toThrow — every scenario
 * runs at MODULE TOP LEVEL; `it` bodies assert synchronously.
 *
 * @module @dsh-agent-team/runtime/test/a4p6-start-gate-entrances
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { createTeamProductionRoot } from '../src/plugin/root.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped stub glue (test double), untyped by design
import { createAgentBindings as createStubBindings } from './p8s5a-stub-glue.mjs'

// --- fixture identities ----------------------------------------------------------

const NOW = '2026-10-12T00:00:00.000Z'
const ROOT_SID = 'session-a4p6r1-root'
const SRC_SID = 'session-a4p6r1-src'
const TOKEN = 'tok-a4p6r1-gate'
/** The deterministic handoff mint prefix (`session-handoff-<sha40>`). */
const HANDOFF_PREFIX = 'session-handoff-'

const WARN_INTERVENTION = 'int-warn-entrance'

const DOC = [
  '---',
  'schemaVersion: 1',
  'blueprintId: A4P6R1-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the A4P6R1 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the A4P6R1 work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  'teamEnvelope:',
  '  allow: [send-message]',
  '  deny: []',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow: [send-message]',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The A4P6R1 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

// --- the governance-service double -----------------------------------------------

/**
 * The gate double: records every consultation (`phase:sid`) and answers
 * per `policy`. `warn` mints the closed `warning-required` arm (the
 * same outcome shape the real `runGate` produces: interventionId +
 * warningId).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test double for the service port, untyped by design
function gateStub(policy: (sid: string) => 'open' | 'warn'): { calls: string[]; service: any } {
  const calls: string[] = []
  const outcome = (phase: string, sid: string): Record<string, unknown> => {
    calls.push(`${phase}:${sid}`)
    if (policy(sid) === 'warn') {
      return { status: 'warning-required', interventionId: WARN_INTERVENTION, warningId: 'warn-entrance' }
    }
    return { status: 'open' }
  }
  const service = {
    checkStart: async (sid: string) => outcome('start', sid),
    checkEnsureRootLive: async (sid: string) => outcome('live', sid),
    observeRuntime: async () => undefined,
    acknowledge: async () => ({ kind: 'not-found' }),
    listWarnings: async () => [],
  }
  return { calls, service }
}

// --- the sessionQuery double (the ONLY handoff source-read channel) ----------------

function makeSessionQueryFake() {
  const fake = {
    readSurfaceCount: 0,
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
        ],
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
    readTitleSnapshots: async (ids: readonly string[]): Promise<Record<string, any>[]> =>
      ids.map((sid) => ({
        status: 'fulfilled',
        value: { session: { id: sid, createdAt: 1725000000000 }, title: { title: 'A4P6R1 source task' } },
      })),
  }
  return fake
}

// --- the world (the d2 production-root pattern) ------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped root world, test double by design
async function buildWorld(scratch: string, opts: {
  bootPhase: 'create' | 'resume'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- service-port double, untyped by design
  governanceWarning?: any
  getSessionQuery?: () => unknown
  /** W4: reopen the SAME durable world (W2's scratch) instead of minting it. */
  reopen?: boolean
}): Promise<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped production root, test double by design
  root: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped stub glue, untyped by design
  stub: any
  dispatcher: (endpoint: string, params: unknown) => Promise<Record<string, any>>
}> {
  const seam = new FileStorageSeam(scratch)
  const domain = opts.reopen === true ? await openTeamDomain(seam) : await createTeamDomain(seam)
  const config: TeamPluginConfig = {
    bootPhase: opts.bootPhase,
    rootSessionId: ROOT_SID,
    blueprintSource: DOC,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/a4p6r1',
    seedMembers: [],
    staticModel: { provider: 'a4p6r1', model: 'a4p6r1-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
  const teamToolsRef = { current: undefined }
  const stub = createStubBindings({ config, teamToolsRef, domain })
  const unused = (): never => {
    throw new Error('A4-PR6 gate guard: legacy inspect is unused in this world')
  }
  const root = createTeamProductionRoot({
    config,
    domain,
    storageSeam: seam,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped stub glue surface, untyped by design
    live: stub as any,
    now: () => NOW,
    teamToolsRef,
    controlServiceRef: { current: undefined },
    legacyInspect: unused as never,
    ...(opts.getSessionQuery === undefined ? {} : { getSessionQuery: opts.getSessionQuery }),
    ...(opts.governanceWarning === undefined ? {} : { governanceWarning: opts.governanceWarning }),
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic registration double (d2 pattern)
  let dispatcher: ((endpoint: string, payload: unknown) => Promise<Record<string, any>>) | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic registration double (d2 pattern)
  root.seams.remoteHandlerRegistration.current()({
    rpc: {
      handle: (_channel: string, handler: unknown) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic dispatcher double, untyped by design
        dispatcher = handler as (endpoint: string, payload: unknown) => Promise<Record<string, any>>
        return () => {}
      },
    },
  })
  if (dispatcher === null) throw new Error('A4-PR6 gate guard: the registration never installed a dispatcher')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic dispatcher double, untyped by design
  const installed = dispatcher as unknown as (endpoint: string, payload: unknown) => Promise<Record<string, any>>
  return {
    root,
    stub,
    // handoff.prepare / handoff.create are v1 catalog methods (the p8s7r4 caller).
    dispatcher: (endpoint, params) => installed(endpoint, { version: 1, params }),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response envelope double shape, untyped by design
function codeOf(response: Record<string, any>): string | null {
  if (response.ok === true) return null
  const error = response['error']
  return error !== null && typeof error === 'object'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic error shape, untyped by design
    ? String((error as Record<string, any>)['code'])
    : 'malformed-error'
}

/**
 * W1 — the handoff entrance, gate REFUSES (warning on the minted handoff
 * root): typed wire refusal, zero start, zero durable mint, re-drivable.
 */
const w1 = await (async () => {
  const dir = scratchDir('a4p6r1-w1-handoff-refused')
  const gate = gateStub((sid) => (sid.startsWith(HANDOFF_PREFIX) ? 'warn' : 'open'))
  const query = makeSessionQueryFake()
  const world = await buildWorld(dir, {
    bootPhase: 'create',
    governanceWarning: gate.service,
    getSessionQuery: () => query,
  })
  await world.root.boot()
  const prepare = await world.dispatcher('handoff.prepare', { sourceSessionId: SRC_SID })
  const first = await world.dispatcher('handoff.create', {
    sourceSessionId: SRC_SID,
    requestToken: TOKEN,
    staged: {},
  })
  const replay = await world.dispatcher('handoff.create', {
    sourceSessionId: SRC_SID,
    requestToken: TOKEN,
    staged: {},
  })
  const started = (world.stub.__t1.rootAgentStarts as string[]).filter((sid) => sid.startsWith(HANDOFF_PREFIX))
  const records = world.root.domain.repositories.teamSessions.list().length
  const handoffChecked = gate.calls.filter((c) => c.startsWith('start:') && c.includes(HANDOFF_PREFIX)).length
  // The minted handoff root is the sid the gate was consulted for.
  const minted = (gate.calls.find((c) => c.startsWith('start:') && c.includes(HANDOFF_PREFIX)) ?? '').split(':')[1] ?? ''
  // The wire `team.create` semantics the refusal must match: the durable
  // row EXISTS and stays NOT LIVE (no team-root binding — the 6.A law:
  // the gate sits after the durable bind and BEFORE startRootAgent).
  const mintedBinding = minted === '' ? 'no-mint' : world.root.domain.repositories.sessionBindings.get(minted)
  await world.root.close()
  destroyDir(dir)
  return { prepare, first, replay, started, records, handoffChecked, gateCalls: gate.calls, mintedBinding }
})()

/**
 * W2 — the handoff entrance, gate OPEN: the gated path still completes
 * (the gate must not break the entrance it guards).
 */
const w2 = await (async () => {
  const dir = scratchDir('a4p6r1-w2-handoff-open')
  const gate = gateStub(() => 'open')
  const query = makeSessionQueryFake()
  const world = await buildWorld(dir, {
    bootPhase: 'create',
    governanceWarning: gate.service,
    getSessionQuery: () => query,
  })
  await world.root.boot()
  await world.dispatcher('handoff.prepare', { sourceSessionId: SRC_SID })
  const create = await world.dispatcher('handoff.create', {
    sourceSessionId: SRC_SID,
    requestToken: TOKEN,
    staged: {},
  })
  const started = (world.stub.__t1.rootAgentStarts as string[]).filter((sid) => sid.startsWith(HANDOFF_PREFIX))
  const records = world.root.domain.repositories.teamSessions.list().length
  const handoffChecked = gate.calls.filter((c) => c.startsWith('start:') && c.includes(HANDOFF_PREFIX)).length
  await world.root.close()
  return { create, started, records, handoffChecked, dir }
})()

/**
 * W3 — the BOOT-create entrance, gate REFUSES: boot rejects typed, ZERO
 * durable mint (the gate sits before `bindFresh`), the live layer never
 * boots.
 */
const w3 = await (async () => {
  const dir = scratchDir('a4p6r1-w3-boot-create-refused')
  const gate = gateStub(() => 'warn')
  const world = await buildWorld(dir, { bootPhase: 'create', governanceWarning: gate.service })
  let rejectionCode = 'NOT-REJECTED'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- captured rejection, untyped by design
  let rejectionDetails: any = null
  try {
    await world.root.boot()
  } catch (error) {
    const err = error as { code?: unknown; detail?: unknown }
    rejectionCode = typeof err.code === 'string' ? err.code : 'NON-TYPED'
    rejectionDetails = err.detail
  }
  const records = world.root.domain.repositories.teamSessions.list().length
  const bootCount = world.stub.__t1.bootCount as number
  const started = world.stub.__t1.rootAgentStarts as string[]
  await world.root.close()
  destroyDir(dir)
  return { rejectionCode, rejectionDetails, records, bootCount, started, calls: gate.calls }
})()

/**
 * W4 — the BOOT-resume entrance, gate REFUSES: a durable, already-live-
 * once Team whose gate now refuses must NOT be restarted by the resume.
 * (The durable world is W2's — the same scratch, reopened.)
 */
const w4 = await (async () => {
  const gate = gateStub(() => 'warn')
  const world = await buildWorld(w2.dir, { bootPhase: 'resume', governanceWarning: gate.service, reopen: true })
  let rejectionCode = 'NOT-REJECTED'
  try {
    await world.root.boot()
  } catch (error) {
    const err = error as { code?: unknown }
    rejectionCode = typeof err.code === 'string' ? err.code : 'NON-TYPED'
  }
  const bootCount = world.stub.__t1.bootCount as number
  await world.root.close()
  destroyDir(w2.dir)
  return { rejectionCode, bootCount, calls: gate.calls }
})()

// --- source law: ONE shared mapper, no second copy of the codes --------------------

const HERE = dirname(fileURLToPath(import.meta.url))
const S6_SOURCE_TEXT = readFileSync(join(HERE, '..', 'src', 'plugin', 's6-remote.ts'), 'utf8')
const ROOT_SOURCE_TEXT = readFileSync(join(HERE, '..', 'src', 'plugin', 'root.ts'), 'utf8')
const HANDOFF_SOURCE_TEXT = readFileSync(join(HERE, '..', 'handoff', 'service.ts'), 'utf8')

// --- assertions ---------------------------------------------------------------------

describe('A4-PR6 review round 1 (BLOCKER 1) — the handoff entrance is gated', () => {
  it('W1: handoff.create under a governance refusal refuses typed and starts NOTHING', () => {
    expect(codeOf(w1.prepare)).toBe(null) // the world is live; the refusal is the HANDOFF start
    expect(codeOf(w1.first)).toBe('TEAM_REMOTE_TEAM_START_GOVERNANCE_WARNING')
    expect(JSON.stringify(w1.first)).toContain(WARN_INTERVENTION) // the pointer rides to the wire
    expect(w1.started).toEqual([]) // zero agent effect — the start port never fired
    expect(w1.records).toBe(2) // the durable handoff row EXISTS (BQ-16 pre-put, same as the wire path)…
    expect(w1.mintedBinding).toBeUndefined() // …and stays NOT LIVE: no team-root binding was ever written
    expect(w1.handoffChecked).toBe(2) // first + replay: the gate re-runs on every re-drive, never bypassed
  })

  it('W1: the refusal is NOT swallowed into the generic creation-failed state (re-drivable, still typed)', () => {
    expect(codeOf(w1.replay)).toBe('TEAM_REMOTE_TEAM_START_GOVERNANCE_WARNING')
  })

  it('W2: with the gate open the handoff completes exactly once (no breakage, single consultation per entrance)', () => {
    expect(codeOf(w2.create)).toBe(null)
    expect(w2.started.length).toBe(1)
    expect(w2.records).toBe(2) // world root + the minted handoff root
    expect(w2.handoffChecked).toBe(1) // ONE consultation — the observation-write discipline
  })
})

describe('A4-PR6 review round 1 (BLOCKER 1) — the boot entrances are gated', () => {
  it('W3: a warning-gated boot-create rejects typed with ZERO durable mint and NO live boot', () => {
    expect(w3.rejectionCode).toBe('TEAM_REMOTE_TEAM_START_GOVERNANCE_WARNING')
    expect(JSON.stringify(w3.rejectionDetails)).toContain(WARN_INTERVENTION)
    expect(w3.records).toBe(0) // fail-closed BEFORE bindFresh — the refusal writes nothing
    expect(w3.bootCount).toBe(0) // live.boot() never reached
    expect(w3.started).toEqual([])
  })

  it('W4: a warning-gated boot-resume refuses to re-start a durable Team (live boot never reached)', () => {
    expect(w4.rejectionCode).toBe('TEAM_REMOTE_TEAM_START_GOVERNANCE_WARNING')
    expect(w4.bootCount).toBe(0)
    expect(w4.calls.some((c) => c.startsWith('live:'))).toBe(true) // the resume entry, same gate
  })
})

describe('A4-PR6 review round 1 (BLOCKER 1) — one mapper, every entrance', () => {
  it('the three arms are built by ONE exported mapper and no entrance re-declares the wire codes', () => {
    expect(S6_SOURCE_TEXT).toContain('export function governanceStartRefusal(')
    expect(ROOT_SOURCE_TEXT).toContain('governanceStartRefusal(')
    expect(ROOT_SOURCE_TEXT).toContain("from './s6-remote.js'")
    // root.ts owns NO copy of the three wire codes (drift between entrances is impossible):
    expect(ROOT_SOURCE_TEXT.includes("TEAM_START_GOVERNANCE_WARNING: '")).toBe(false)
    expect(ROOT_SOURCE_TEXT.includes("TEAM_START_GOVERNANCE_CORRUPT: '")).toBe(false)
    expect(ROOT_SOURCE_TEXT.includes("TEAM_START_MIGRATION_REQUIRED: '")).toBe(false)
    // the handoff state machine passes the refusal through (it does not mint its own arms):
    expect(HANDOFF_SOURCE_TEXT).toContain('isGovernanceStartRefusal(')
  })
})
