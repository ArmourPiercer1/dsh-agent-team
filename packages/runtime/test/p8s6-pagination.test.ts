/**
 * p8s6-pagination.test.ts — C6 (P8-S6): the production pagination
 * semantics (plan §20.6) through the installed A34 seam
 * (`remoteQueryCommandCompletion`): the stable cursor, the
 * load-earlier session, and the growth-safe window.
 *
 * Driven end-to-end through the completion surface exactly as a remote
 * peer would: `completion({ method: 'team.getLedgerPage', request })`.
 * The facts are durably seeded through the REAL storage repository
 * (`root.domain.repositories.ledger`) with the real fact vocabulary, so
 * every page is computed over durable truth (no mirror, no recompute).
 *
 * Proven per test:
 *
 *   C6.1 — the empty baseline page (total 0, no cursor) with the
 *          success provenance carrying `projectionGeneration: null` and
 *          `effectSequence: null` (a page is a read, not a mutation);
 *   C6.2 — the STABLE CURSOR chain: (0,3) → seq 1..3 cursor 3,
 *          (3,3) → 4..6 cursor 6, (6,3) → [7] terminal (no cursor),
 *          total 7 on every page; the entries ride the closed wire
 *          shape (operationId null);
 *   C6.3 — the STABLE RE-READ: requesting anchor 0 again (whose cached
 *          tracker session already advanced to 3) opens a FRESH session
 *          and returns the SAME window (1..3) — the historical window
 *          is not invalidated by the cursor's own progress;
 *   C6.4 — LOAD EARLIER: anchor 1 (never requested before) opens a
 *          fresh session and serves 2..4 — the window may be reopened
 *          at any earlier stable anchor;
 *   C6.5 — GROWTH-SAFE: after two more facts are appended, (0,3) still
 *          returns 1..3 (the window is stable under growth) with the
 *          total advanced to 9, and the continuation (3,10) reaches the
 *          new terminal (4..9);
 *   C6.6 — the bound-root guard rejects a foreign teamSessionId
 *          (TEAM_REMOTE_FOREIGN_TEAM) BEFORE any ledger read;
 *   C6.7 — an unknown param field is delegated to the dispatcher and
 *          reported with the frozen `malformed-params` code (the
 *          pre-gate never invents a third code);
 *   C6.8 — the frozen tracker's rejection reasons are all reachable at
 *          unit level against the same page shape: anchor-mismatch
 *          (stale in-flight page), total-decreased, non-terminal-page-
 *          short, sequence-before-anchor, page-exceeds-limit,
 *          not-strictly-ascending, cursor-mismatch — with the
 *          pagesApplied / pagesRejected counters (anchor-mismatch can
 *          never fire end-to-end because the synchronous completion
 *          always serves the exact requested anchor; the unit level is
 *          the honest coverage of the stale-response rule).
 *
 * World: own scratch seam + own root + own seed ids.
 * @module @dsh-agent-team/runtime/test/p8s6-pagination
 */

import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import * as hostEntry from '../src/plugin/host.js'
import type { RemoteLedgerEntryValue } from '../../remote/src/contracts/types.js'
import { createLedgerPageTracker } from '../../remote/src/push/ledger-page.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the C6 fixture world -----------------------------------------------------------

/** The C6 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-p8s6pageroot'
/** The C6 seeded worker / scout (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-p8s6pagew1'
const SEED_WORKER_CHILD = 'session-child-p8s6pagew1'
const SEED_SCOUT_ID = 'inst-p8s6pages1'
const SEED_SCOUT_CHILD = 'session-child-p8s6pages1'

/** The C6 blueprint (own id; structure mirrors the P8-S5A T1 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S6PAGE-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S6PAGE team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S6PAGE work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P8S6PAGE team.',
  '    contextPolicy: fresh_per_delegation',
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
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The C6 default state.',
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

/** The C6 row config (the entry's ONLY input channel). */
function rowConfig(): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/p8s6page',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 'c6-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
      {
        instanceId: SEED_SCOUT_ID,
        templateId: 'scout',
        label: 'c6-seed-scout',
        childSessionId: SEED_SCOUT_CHILD,
      },
    ],
    staticModel: { provider: 'p8s6page-static', model: 'p8s6page-model-v1' },
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

// --- the test Cordis context + the entry loader --------------------------------------

interface TeamRootFacade {
  readonly ready: Promise<Record<string, any>>
  [key: string]: any
}

interface TestWorld {
  ctx: Record<string, any>
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

function makeWorld(seam: FileStorageSeam): TestWorld {
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
    effectDisposers,
  }
}

let hostModulePromise: Promise<Record<string, any>> | null = null
function loadHost(): Promise<Record<string, any>> {
  if (hostModulePromise === null) {
    hostModulePromise = Promise.resolve(hostEntry as unknown as Record<string, any>)
  }
  return hostModulePromise
}

function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`C6 scenario guard: ${label}`)
}

async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
}

/** One durable fact at the next allocated sequence (the real vocabulary). */
async function seedFact(repos: Record<string, any>, index: number): Promise<number> {
  const sequence = await repos.ledger.allocateSequence()
  await repos.ledger.put({
    schemaVersion: 1,
    sequence,
    rootSessionId: ROOT_SID,
    factType: 'team-coordination-recorded',
    payload: { n: index },
    createdAt: `2026-09-01T00:00:0${index}.000Z`,
  })
  return sequence
}

/** The closed wire shape of one ledger entry (for the unit-level pages). */
function wireEntry(sequence: number): RemoteLedgerEntryValue {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId: ROOT_SID,
    factType: 'team-coordination-recorded',
    payload: {},
    operationId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
  }
}

// --- the scenarios (module top level — the sync shim forbids async it()) -------------

const c6 = await (async () => {
  const dir = scratchDir('p8s6-page')
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  try {
    const { root } = await applyWorld(world, rowConfig())
    const repos = root.domain.repositories

    const completion = root.seams.remoteQueryCommandCompletion.current()
    check(typeof completion === 'function', 'the completion seam is not installed')

    async function callPage(params: Record<string, any>): Promise<Record<string, any>> {
      const response = await completion({
        method: 'team.getLedgerPage',
        request: { version: 1, params },
      })
      return response as Record<string, any>
    }

    // --- C6.1 the empty baseline (before any fact) ----------------------------------

    const baseline = await callPage({ teamSessionId: ROOT_SID })

    // --- seed 7 durable facts ---------------------------------------------------------

    const firstSequences: number[] = []
    for (let i = 1; i <= 7; i += 1) {
      firstSequences.push(await seedFact(repos, i))
    }

    // --- C6.2 the stable cursor chain -------------------------------------------------

    const page1 = await callPage({ teamSessionId: ROOT_SID, afterSequence: 0, limit: 3 })
    const page2 = await callPage({ teamSessionId: ROOT_SID, afterSequence: 3, limit: 3 })
    const page3 = await callPage({ teamSessionId: ROOT_SID, afterSequence: 6, limit: 3 })

    // --- C6.3 the stable re-read at anchor 0 (a fresh session) -----------------------

    const reread = await callPage({ teamSessionId: ROOT_SID, afterSequence: 0, limit: 3 })

    // --- C6.4 load earlier at anchor 1 -------------------------------------------------

    const earlier = await callPage({ teamSessionId: ROOT_SID, afterSequence: 1, limit: 3 })

    // --- C6.5 growth-safe: append two more facts, then re-page ------------------------

    const growthSequences: number[] = []
    for (let i = 8; i <= 9; i += 1) {
      growthSequences.push(await seedFact(repos, i))
    }
    const afterGrowth = await callPage({ teamSessionId: ROOT_SID, afterSequence: 0, limit: 3 })
    const continuation = await callPage({ teamSessionId: ROOT_SID, afterSequence: 3, limit: 10 })

    // --- C6.6 / C6.7 the end-to-end negatives ------------------------------------------

    const foreign = await callPage({
      teamSessionId: 'session-other',
      afterSequence: 0,
      limit: 3,
    })
    const malformed = await callPage({
      teamSessionId: ROOT_SID,
      bogus: 1,
    })

    // --- C6.8 the unit-level tracker rejections ----------------------------------------

    const tracker = createLedgerPageTracker(0)
    const goodPage1 = {
      entries: [wireEntry(1), wireEntry(2), wireEntry(3)],
      nextAfterSequence: 3,
      total: 7,
    }
    const applied = tracker.applyPage({ afterSequence: 0, limit: 3 }, goodPage1)
    const staleInFlight = tracker.applyPage({ afterSequence: 5, limit: 3 }, goodPage1)
    const totalDecreased = tracker.applyPage(
      { afterSequence: 3, limit: 3 },
      { entries: [wireEntry(4), wireEntry(5), wireEntry(6)], nextAfterSequence: 6, total: 5 },
    )
    const shortWithCursor = tracker.applyPage(
      { afterSequence: 3, limit: 3 },
      { entries: [wireEntry(4)], nextAfterSequence: 4, total: 7 },
    )
    const beforeAnchor = tracker.applyPage(
      { afterSequence: 3, limit: 3 },
      { entries: [wireEntry(2)], nextAfterSequence: null, total: 7 },
    )
    const exceedsLimit = tracker.applyPage(
      { afterSequence: 3, limit: 3 },
      { entries: [wireEntry(4), wireEntry(5), wireEntry(6), wireEntry(7)], nextAfterSequence: 7, total: 7 },
    )
    const notAscending = tracker.applyPage(
      { afterSequence: 3, limit: 3 },
      { entries: [wireEntry(4), wireEntry(4)], nextAfterSequence: null, total: 7 },
    )
    const cursorMismatch = tracker.applyPage(
      { afterSequence: 3, limit: 3 },
      { entries: [wireEntry(4), wireEntry(5), wireEntry(6)], nextAfterSequence: 99, total: 7 },
    )
    const trackerState = tracker.state()

    return {
      world,
      dir,
      baseline,
      firstSequences,
      page1,
      page2,
      page3,
      reread,
      earlier,
      growthSequences,
      afterGrowth,
      continuation,
      foreign,
      malformed,
      applied,
      staleInFlight,
      totalDecreased,
      shortWithCursor,
      beforeAnchor,
      exceedsLimit,
      notAscending,
      cursorMismatch,
      trackerState,
    }
  } catch (err) {
    destroyDir(dir)
    world.effectDisposers.forEach((dispose) => dispose())
    throw new Error(`C6 pagination world failing: ${err instanceof Error ? err.message : String(err)}`)
  }
})()

function valueOf(response: Record<string, any>): Record<string, any> {
  check(response.ok === true, `expected a success response, got ${JSON.stringify(response)}`)
  return response.value as Record<string, any>
}

function pageOf(response: Record<string, any>): Record<string, any> {
  return (valueOf(response).data as Record<string, any>)
}

function codeOf(response: Record<string, any>): string | null {
  if (response.ok === false) {
    return String((response.error as Record<string, any>).code)
  }
  return null
}

it('C6.1 the empty baseline page carries total 0 and a read provenance (null generations)', () => {
  check(c6.baseline.ok === true, `baseline not ok: ${JSON.stringify(c6.baseline)}`)
  const page = pageOf(c6.baseline)
  expect(page.entries).toEqual([])
  expect(page.nextAfterSequence).toBe(null)
  expect(page.total).toBe(0)
  const provenance = (c6.baseline.value as Record<string, any>).provenance as Record<string, any>
  expect(provenance.origin).toBe('team-remote')
  expect(provenance.method).toBe('team.getLedgerPage')
  expect(provenance.contractVersion).toBe(1)
  expect(provenance.requestToken).toBe(null)
  expect(provenance.projectionGeneration).toBe(null)
  expect(provenance.effectSequence).toBe(null)
})

it('C6.2 the stable cursor chain: (0,3)→1..3, (3,3)→4..6, (6,3)→[7] terminal, total 7', () => {
  expect(c6.firstSequences).toEqual([1, 2, 3, 4, 5, 6, 7])
  const p1 = pageOf(c6.page1)
  expect(p1.entries.map((e: Record<string, any>) => e.sequence)).toEqual([1, 2, 3])
  expect(p1.nextAfterSequence).toBe(3)
  expect(p1.total).toBe(7)
  expect(p1.entries[0].factType).toBe('team-coordination-recorded')
  expect(p1.entries[0].payload).toEqual({ n: 1 })
  expect(p1.entries[0].operationId).toBe(null)
  const p2 = pageOf(c6.page2)
  expect(p2.entries.map((e: Record<string, any>) => e.sequence)).toEqual([4, 5, 6])
  expect(p2.nextAfterSequence).toBe(6)
  expect(p2.total).toBe(7)
  const p3 = pageOf(c6.page3)
  expect(p3.entries.map((e: Record<string, any>) => e.sequence)).toEqual([7])
  expect(p3.nextAfterSequence).toBe(null)
  expect(p3.total).toBe(7)
})

it('C6.3 the stable re-read at anchor 0 serves the SAME window (fresh session, not invalidated)', () => {
  const reread = pageOf(c6.reread)
  expect(reread.entries.map((e: Record<string, any>) => e.sequence)).toEqual([1, 2, 3])
  expect(reread.nextAfterSequence).toBe(3)
  expect(reread.total).toBe(7)
})

it('C6.4 load earlier: anchor 1 (never requested before) serves 2..4', () => {
  const earlier = pageOf(c6.earlier)
  expect(earlier.entries.map((e: Record<string, any>) => e.sequence)).toEqual([2, 3, 4])
  expect(earlier.nextAfterSequence).toBe(4)
  expect(earlier.total).toBe(7)
})

it('C6.5 growth-safe: (0,3) keeps the window 1..3 under growth; the continuation reaches the new terminal', () => {
  expect(c6.growthSequences).toEqual([8, 9])
  const afterGrowth = pageOf(c6.afterGrowth)
  expect(afterGrowth.entries.map((e: Record<string, any>) => e.sequence)).toEqual([1, 2, 3])
  expect(afterGrowth.nextAfterSequence).toBe(3)
  expect(afterGrowth.total).toBe(9)
  const continuation = pageOf(c6.continuation)
  expect(continuation.entries.map((e: Record<string, any>) => e.sequence)).toEqual([4, 5, 6, 7, 8, 9])
  expect(continuation.nextAfterSequence).toBe(null)
  expect(continuation.total).toBe(9)
})

it('C6.6 a foreign teamSessionId is rejected BEFORE any ledger read', () => {
  expect(c6.foreign.ok).toBe(false)
  expect(codeOf(c6.foreign)).toBe('TEAM_REMOTE_FOREIGN_TEAM')
  const details = (c6.foreign.error as Record<string, any>).details as Record<string, any>
  expect(details.reason).toBe('foreign-team')
})

it('C6.7 an unknown param field is delegated to the dispatcher and reported malformed-params', () => {
  expect(c6.malformed.ok).toBe(false)
  expect(codeOf(c6.malformed)).toBe('malformed-params')
})

it('C6.8 the frozen tracker rejects every stale/shaped page with the closed reasons', () => {
  expect(c6.applied.ok).toBe(true)
  expect(c6.staleInFlight).toEqual({ ok: false, reason: 'anchor-mismatch' })
  expect(c6.totalDecreased).toEqual({ ok: false, reason: 'total-decreased' })
  expect(c6.shortWithCursor).toEqual({ ok: false, reason: 'non-terminal-page-short' })
  expect(c6.beforeAnchor).toEqual({ ok: false, reason: 'sequence-before-anchor' })
  expect(c6.exceedsLimit).toEqual({ ok: false, reason: 'page-exceeds-limit' })
  expect(c6.notAscending).toEqual({ ok: false, reason: 'not-strictly-ascending' })
  expect(c6.cursorMismatch).toEqual({ ok: false, reason: 'cursor-mismatch' })
  // Counters: exactly one applied page, seven rejected.
  expect(c6.trackerState.pagesApplied).toBe(1)
  expect(c6.trackerState.pagesRejected).toBe(7)
  expect(c6.trackerState.anchor).toBe(3)
  expect(c6.trackerState.lastTotal).toBe(7)
})

// --- teardown --------------------------------------------------------------------------

describe('p8s6-pagination teardown', () => {
  it('the C6 world is disposed (stop semantics)', () => {
    c6.world.effectDisposers.forEach((dispose) => dispose())
    c6.world.effectDisposers.length = 0
    destroyDir(c6.dir)
    expect(true).toBe(true)
  })
})
