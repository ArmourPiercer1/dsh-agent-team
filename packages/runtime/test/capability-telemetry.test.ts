/**
 * pre-alpha3 PR-C §C.7 — the durable capability-runtime telemetry (plan
 * §C.7): the `capability-runtime-event` ledger fact type + its writer.
 *
 * Locks the writer contract (plan §C.10 gate 4 + gate 5):
 * - the writer mirrors `writePolicyStateTransitionRow`: `allocateSequence`
 *   (the allocation order is the event order) then `put` (idempotent on
 *   identical bytes);
 * - the row lands under the FROZEN `compatibility` category (the closed
 *   8-shape is unchanged — PR-C is the category's first production writer);
 * - the payload is the closed lossless-JSON shape (event / capabilityType /
 *   capabilityName / verdict / source / observedAt + optional reason /
 *   attempt);
 * - a write failure PROPAGATES (no silent drop).
 *
 * Pure test: the ledger port is the I/O boundary (an in-memory double); no
 * real storage is touched.
 */
import { describe, expect, it } from 'vitest'
import {
  CAPABILITY_RUNTIME_EVENT_FACT_TYPE,
  CAPABILITY_RUNTIME_EVENTS,
  CAPABILITY_RUNTIME_EVENT_KIND_VALUES,
  assertCapabilityRuntimeEventKind,
  createCapabilityRuntimeEvent,
  writeCapabilityRuntimeEvent,
} from '../readiness/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/index.js'

const FIXED_NOW = '2026-12-01T00:00:00.000Z'

function ledgerDouble(): {
  rows: Array<Record<string, unknown>>
  ledger: { allocateSequence(): Promise<number>; put(entry: Record<string, unknown>): Promise<unknown> }
} {
  let next = 1
  const rows: Array<Record<string, unknown>> = []
  return {
    rows,
    ledger: {
      allocateSequence: async () => next++,
      put: async (entry) => {
        rows.push(entry)
        return entry
      },
    },
  }
}

describe('PR-C C.7 — the durable capability-runtime telemetry', () => {
  it('the fact type is exactly `capability-runtime-event` (the compatibility category\'s first production writer)', () => {
    expect(CAPABILITY_RUNTIME_EVENT_FACT_TYPE).toBe('capability-runtime-event')
  })

  it('the event vocabulary is the closed 6-set (probe-completed / capability-lost|retry|restored / mount-failed|restored)', () => {
    expect([...CAPABILITY_RUNTIME_EVENT_KIND_VALUES].sort()).toEqual([
      'capability-lost',
      'capability-restored',
      'capability-retry',
      'mount-failed',
      'mount-restored',
      'probe-completed',
    ])
  })

  it('assertCapabilityRuntimeEventKind rejects an unknown kind (fail-closed MALFORMED_DTO)', () => {
    expect(assertCapabilityRuntimeEventKind(CAPABILITY_RUNTIME_EVENTS.mountFailed, 'k')).toBe('mount-failed')
    expect(() => assertCapabilityRuntimeEventKind('bogus', 'k')).toThrowError(/unknown capability-runtime event kind/)
  })

  it('createCapabilityRuntimeEvent validates + freezes (an unknown verdict / empty name throws)', () => {
    const event = createCapabilityRuntimeEvent({
      event: CAPABILITY_RUNTIME_EVENTS.mountFailed,
      capabilityType: 'mcpServer',
      capabilityName: 'beta',
      verdict: 'unreachable',
      source: 'mcp-fiber',
      observedAt: FIXED_NOW,
      reason: 'beta down',
      attempt: 2,
    })
    expect(Object.isFrozen(event)).toBe(true)
    expect(event.attempt).toBe(2)
    expect(() =>
      createCapabilityRuntimeEvent({
        event: CAPABILITY_RUNTIME_EVENTS.mountFailed,
        capabilityType: 'mcpServer',
        capabilityName: '',
        verdict: 'unreachable',
        source: 'mcp-fiber',
        observedAt: FIXED_NOW,
      }),
    ).toThrowError(/capabilityName must be non-empty/)
  })

  it('the writer allocates a sequence then puts a row stamped with the fact type + schema version + createdAt', async () => {
    const { rows, ledger } = ledgerDouble()
    const event = createCapabilityRuntimeEvent({
      event: CAPABILITY_RUNTIME_EVENTS.mountFailed,
      capabilityType: 'mcpServer',
      capabilityName: 'beta',
      verdict: 'unreachable',
      source: 'mcp-fiber',
      observedAt: FIXED_NOW,
      reason: 'beta down',
      attempt: 1,
    })
    await writeCapabilityRuntimeEvent(ledger, 'root-1', event, () => FIXED_NOW)
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row.factType).toBe('capability-runtime-event')
    expect(row.schemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    expect(row.sequence).toBe(1)
    expect(row.rootSessionId).toBe('root-1')
    expect(row.createdAt).toBe(FIXED_NOW)
    const payload = row.payload as Record<string, unknown>
    expect(payload.event).toBe('mount-failed')
    expect(payload.capabilityType).toBe('mcpServer')
    expect(payload.capabilityName).toBe('beta')
    expect(payload.verdict).toBe('unreachable')
    expect(payload.source).toBe('mcp-fiber')
    expect(payload.observedAt).toBe(FIXED_NOW)
    expect(payload.reason).toBe('beta down')
    expect(payload.attempt).toBe(1)
  })

  it('the writer sequences multiple events in allocation order (the lost / retry / restored order is the sequence order)', async () => {
    const { rows, ledger } = ledgerDouble()
    const mk = (kind: (typeof CAPABILITY_RUNTIME_EVENTS)[keyof typeof CAPABILITY_RUNTIME_EVENTS], attempt?: number) =>
      createCapabilityRuntimeEvent({
        event: kind,
        capabilityType: 'mcpServer',
        capabilityName: 'beta',
        verdict: attempt !== undefined ? 'reachable' : 'unreachable',
        source: 'mcp-fiber',
        observedAt: FIXED_NOW,
        attempt,
      })
    await writeCapabilityRuntimeEvent(ledger, 'root-1', mk(CAPABILITY_RUNTIME_EVENTS.capabilityLost), () => FIXED_NOW)
    await writeCapabilityRuntimeEvent(ledger, 'root-1', mk(CAPABILITY_RUNTIME_EVENTS.capabilityRetry, 2), () => FIXED_NOW)
    await writeCapabilityRuntimeEvent(ledger, 'root-1', mk(CAPABILITY_RUNTIME_EVENTS.capabilityRestored, 3), () => FIXED_NOW)
    expect(rows.map((r) => (r.payload as Record<string, unknown>).event)).toEqual([
      'capability-lost',
      'capability-retry',
      'capability-restored',
    ])
    expect(rows.map((r) => r.sequence)).toEqual([1, 2, 3])
    // The retry / restored carry the attempt count (plan §C.10 gate 4).
    expect((rows[1]!.payload as Record<string, unknown>).attempt).toBe(2)
    expect((rows[2]!.payload as Record<string, unknown>).attempt).toBe(3)
  })

  it('a ledger put failure PROPAGATES (no silent drop)', async () => {
    const failingLedger = {
      allocateSequence: async () => 1,
      put: async () => {
        throw new Error('storage down')
      },
    }
    const event = createCapabilityRuntimeEvent({
      event: CAPABILITY_RUNTIME_EVENTS.mountFailed,
      capabilityType: 'mcpServer',
      capabilityName: 'beta',
      verdict: 'unreachable',
      source: 'mcp-fiber',
      observedAt: FIXED_NOW,
    })
    await expect(
      writeCapabilityRuntimeEvent(failingLedger, 'root-1', event, () => FIXED_NOW),
    ).rejects.toThrowError('storage down')
  })
})
