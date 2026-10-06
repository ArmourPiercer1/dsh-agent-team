/**
 * A4-PR0a — the abandoned-request projection closure (ADR A4-4, plan Task 0a).
 *
 * DEFECT (live in merged Alpha.3, independent of Alpha.4): the inline abort
 * path appends the additive terminal fact `control-request-abandoned` to the
 * durable ledger (`control/service.ts:257` + the `putEntry` append at
 * `:1818-1826`), but that fact type is absent from the host's
 * `FACT_TYPE_CATEGORY` (`src/plugin/projection-source.ts:223-250`). The fold
 * classifies every root entry and THROWS
 * `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` for any unmapped type, on
 * EVERY projection read (`:762-768`, called from `ledgerSummaryOf` at `:403`).
 * Ledger facts are append-only, so ONE abandoned inline request breaks
 * `team.getProjection` for that Team **permanently** — the same shape as the
 * historical H3 incident (`p8s6-remote-commands.test.ts:563-595`) and exactly
 * the class the `artifact-read-granted` repair (H1, below) closed once before.
 *
 * WHY NO EXISTING TEST CAUGHT IT: the three abandonment tests
 * (`control-inline-abandon`, `control-abandon-without-resolve-envelope`,
 * `control-abandon-storage-fault`) assert the service/guard/restart surfaces
 * and read NO projection; the projection tests never abandon a request. This
 * test is the missing composition: production writer → durable store →
 * production read port.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous): the
 * scenario runs at module top level and the `it` bodies assert captured
 * values.
 */

import { describe, expect, it } from 'vitest'
import {
  CONTROL_EXECUTION_COUPLINGS,
  CONTROL_REQUEST_KINDS,
} from '../control/index.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  controlFacts,
  createP6T4Service,
  createP6T4World,
  destroyP6T1World,
  memberCaller,
  restartP6T1World,
} from './p6t4-helpers.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The fact type the inline abort path writes. Pinned as a literal on
 *  purpose: this test guards the COMPOSITION (writer's type vs the reader's
 *  closed category map), and pinning it here means a silent rename of the
 *  writer's constant is a red test rather than a silently vacuous guard. */
const ABANDON_FACT_TYPE = 'control-request-abandoned'

/** The same template rows production injects through `readPortDeps`
 *  (`src/plugin/root.ts:2969`); the facts under test are 100 % production
 *  written, only the deps are supplied as they are at the composition root. */
const PORT_DEPS = {
  templates: () =>
    [
      { kind: 'leader', templateId: 'leader', displayName: 'leader', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
    ] as never,
  policyState: () => 'default' as const,
}

/** The eight frozen categories (`packages/contracts/src/projection/states.ts`).
 *  Pinned literally: PR0a must land its fact type inside this shape, never
 *  beside it (ADR A3-7: the category set is closed). */
const CATEGORY_KEYS = [
  'team',
  'member',
  'lifecycle',
  'message',
  'control',
  'policy',
  'compatibility',
  'progress',
] as const

function sumByCategory(byCategory: Record<string, number>): number {
  return Object.values(byCategory).reduce((acc, value) => acc + value, 0)
}

/** Read the projection for the world's root through the PRODUCTION read port. */
function readProjection(domain: never) {
  const port = createTeamDomainReadPort(domain, PORT_DEPS)
  return port.readProjectionSource(parseRootSessionId(P6T4_ROOT))
}

// --- scenario -----------------------------------------------------------------

type Captured = {
  readonly ok: boolean
  readonly errorMessage?: string
  readonly factCount?: number
  readonly byCategory?: Record<string, number>
  readonly abandonFacts?: number
  readonly restartedOk?: boolean
  readonly restartedError?: string
  readonly restartedSumMatches?: boolean
}

const abandoned: Captured = await (async (): Promise<Captured> => {
  const world = await createP6T4World('a4pr0a-abandon', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    const request = await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4pr0a-1',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // The requesting member aborts its own invocation: this is the ONLY write
    // of the fact type under test, and it is the production path.
    await service.abandonControlRequest({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      requestId: request.requestId,
      reason: 'user aborted the invocation',
    })
    const abandonFacts = controlFacts(world, ABANDON_FACT_TYPE).length

    let outcome: Captured = { ok: false, abandonFacts }
    try {
      const source = readProjection(world.domain as never)
      const ledger = source.ledger as unknown as {
        totalEntries: number
        byCategory: Record<string, number>
      }
      outcome = {
        ok: true,
        abandonFacts,
        factCount: ledger.totalEntries,
        byCategory: ledger.byCategory,
      }
    } catch (error) {
      outcome = { ok: false, abandonFacts, errorMessage: String(error) }
    }

    // The same durable store, reopened: the fact is append-only, so a read
    // that fails today must keep failing forever — and after the fix, must
    // keep working forever.
    const restarted = await restartP6T1World(world)
    try {
      const source = readProjection(restarted.domain as never)
      const ledger = source.ledger as unknown as {
        totalEntries: number
        byCategory: Record<string, number>
      }
      outcome = {
        ...outcome,
        restartedOk: true,
        restartedSumMatches: sumByCategory(ledger.byCategory) === ledger.totalEntries,
      }
    } catch (error) {
      outcome = { ...outcome, restartedOk: false, restartedError: String(error) }
    } finally {
      destroyP6T1World(restarted)
    }
    return outcome
  } finally {
    // The restart helper relocates the seam; destroy is idempotent per world.
    try {
      destroyP6T1World(world)
    } catch {
      /* already destroyed by the restart path */
    }
  }
})()

/** A control world with NO abandonment: the control leg of the proof, so a
 *  blanket projection breakage cannot be mistaken for this defect. */
const untouched: Captured = await (async (): Promise<Captured> => {
  const world = await createP6T4World('a4pr0a-clean', ['leader', 'worker'])
  try {
    const service = createP6T4Service(world)
    await service.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.USER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'write-file',
      toolName: 'fs.write',
      correlation: 'corr-a4pr0a-2',
      executionCoupling: CONTROL_EXECUTION_COUPLINGS.INLINE,
    })
    // Pending, never abandoned.
    try {
      const source = readProjection(world.domain as never)
      const ledger = source.ledger as unknown as {
        totalEntries: number
        byCategory: Record<string, number>
      }
      return {
        ok: true,
        factCount: ledger.totalEntries,
        byCategory: ledger.byCategory,
        abandonFacts: controlFacts(world, ABANDON_FACT_TYPE).length,
      }
    } catch (error) {
      return { ok: false, errorMessage: String(error) }
    }
  } finally {
    destroyP6T1World(world)
  }
})()

// --- assertions ----------------------------------------------------------------

describe('A4-PR0a: an abandoned inline request must not break the ledger projection', () => {
  it('C1: the production abort path really wrote the fact type under test', () => {
    expect(abandoned.abandonFacts).toBe(1)
    expect(untouched.abandonFacts).toBe(0)
  })

  it('C2: the same control world WITHOUT an abandonment projects fine (the defect is specific to the abandon fact)', () => {
    expect(untouched.errorMessage ?? null).toBeNull()
    expect(untouched.ok).toBe(true)
    expect(typeof untouched.factCount).toBe('number')
  })

  it('C3: the world WITH the abandonment projects too — the category map must cover the fact type', () => {
    // RED today: `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` names
    // `control-request-abandoned`. Written as the FIXED expectation, per
    // test-driven-development: this is the assertion that makes the defect an
    // executed fact rather than a static inference.
    expect(abandoned.errorMessage ?? null).toBeNull()
    expect(abandoned.ok).toBe(true)
  })

  it('C4: the abandonment is classified into the frozen `control` category, and the eight-category sum invariant holds', () => {
    if (!abandoned.ok || abandoned.byCategory === undefined) {
      // Keep the failure readable while the test is RED.
      expect(`projection failed: ${abandoned.errorMessage ?? ''}`).toBe('projection succeeded')
    }
    const by = abandoned.byCategory as Record<string, number>
    expect(Object.keys(by).sort()).toEqual([...CATEGORY_KEYS].sort())
    expect(sumByCategory(by)).toBe(abandoned.factCount)
    // The abandon fact is counted, and counted as control (the same home the
    // artifact-read grant repair chose for a non-ControlRequest control fact).
    expect(by.control ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('C5: the fixed read is stable across a reopen (append-only facts cannot re-break it)', () => {
    expect(abandoned.restartedOk).toBe(true)
    expect(abandoned.restartedSumMatches).toBe(true)
  })
})
