/**
 * A5M2 B-SCHEDULE TRIGGER CARRIER — the shared binding interface law (root
 * ruling 2026-10-24; the contract owner's own spec). A FAKE plane answers
 * paAdmit/paTokenLedger with exact counters; every leg pins an ENTRY COUNT,
 * never just a boolean.
 */
import { describe, expect, it } from 'vitest'
import { createScheduleTriggerCarrier, SCHEDULE_CARRIER_TOOL_NAME } from '../src/plugin/live/governed-families/schedule-carrier.mjs'

function makePlane(answer = { kind: 'approved', grant: { g: 1 }, placementName: 'pn', paConstructionBinding: { b: 1 } }) {
  const calls = { open: [], edge: [], taken: [], settled: [] }
  return {
    calls,
    paAdmit: {
      open: async (walk) => { calls.open.push(walk); return answer },
      edge: async (walk) => { calls.edge.push(walk); return answer },
    },
    paTokenLedger: {
      take: (token, correlation) => { calls.taken.push({ token, correlation }); return true },
      settle: (token) => { calls.settled.push(token); return true },
    },
  }
}

const intent = (over = {}) => ({
  ownerSessionId: 'sess-owner',
  taskId: 'task-1',
  revision: null,
  occurrence: { scheduledAt: '2026-10-24T10:00:00.000Z', occurrenceAt: '2026-10-24T10:00:00.000Z' },
  destination: { sessionId: 'sess-owner' },
  groupSize: 2,
  phase: 'pre-resolve',
  carrierFingerprint: {
    kind: 'once',
    groupTaskIds: ['task-0', 'task-1'],
    scheduledAt: '2026-10-24T10:00:00.000Z',
    occurrenceAt: '2026-10-24T10:00:00.000Z',
  },
  ...over,
})

function makeCarrier(planeOver, probeOver = {}) {
  const plane = makePlane(planeOver)
  let mounted = true
  const carrier = createScheduleTriggerCarrier({
    plane,
    realmId: 'realm-test',
    familyFacts: { familyId: 'B-SCHEDULE', adapterRevision: 2, providerIdentity: 'a5p5-plane' },
    consumerProbe: () => (mounted && (probeOver.probeFn ? probeOver.probeFn() : true)
      ? { mounted: true, generation: 'ScheduleService:true' }
      : { mounted: false, generation: '' }),
  })
  return { plane, carrier, setMounted: (v) => { mounted = v } }
}

describe('a5m2 schedule trigger carrier (shared binding interface)', () => {
  it('the carrier name is never a placed row and never a new callable tool face', () => {
    expect(SCHEDULE_CARRIER_TOOL_NAME).toBe('schedule.trigger-carrier')
  })

  it('an intent WITHOUT the full-group fingerprint refuses typed with ZERO PA entry (first taskId+groupSize+scheduledAt is NOT an occurrence)', async () => {
    const { plane, carrier } = makeCarrier()
    const bad = intent({ carrierFingerprint: undefined })
    const res = await carrier.admit(bad)
    expect(res).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_OCCURRENCE_INSUFFICIENT' })
    expect(plane.calls.open).toHaveLength(0)
    expect(plane.calls.taken).toHaveLength(0)
  })

  it('fingerprint mismatches (size!=groupSize, dup, head missing, occ mismatch, once occ!=sched) each refuse with zero entry', async () => {
    const { plane, carrier } = makeCarrier()
    const bads = [
      intent({ carrierFingerprint: { kind: 'once', groupTaskIds: ['task-1'], scheduledAt: 'x', occurrenceAt: 'x' } }),
      intent({ carrierFingerprint: { kind: 'once', groupTaskIds: ['task-0', 'task-0'], scheduledAt: '2026-10-24T10:00:00.000Z', occurrenceAt: '2026-10-24T10:00:00.000Z' } }),
      intent({ carrierFingerprint: { kind: 'once', groupTaskIds: ['task-0', 'task-9'], scheduledAt: '2026-10-24T10:00:00.000Z', occurrenceAt: '2026-10-24T10:00:00.000Z' } }),
      intent({ carrierFingerprint: { kind: 'once', groupTaskIds: ['task-0', 'task-1'], scheduledAt: '2026-10-24T10:00:00.000Z', occurrenceAt: '2026-10-24T11:00:00.000Z' } }),
      intent({ occurrence: { scheduledAt: '2026-10-24T10:00:00.000Z', occurrenceAt: '2026-10-24T11:00:00.000Z' }, carrierFingerprint: { kind: 'once', groupTaskIds: ['task-0', 'task-1'], scheduledAt: '2026-10-24T10:00:00.000Z', occurrenceAt: '2026-10-24T10:00:00.000Z' } }),
    ]
    for (const bad of bads) {
      const res = await carrier.admit(bad)
      expect(res.ok).toBe(false)
    }
    expect(plane.calls.open).toHaveLength(0)
  })

  it('closed key set: an extra key (caller-supplied impersonation surface) refuses with zero entry', async () => {
    const { plane, carrier } = makeCarrier()
    const res = await carrier.admit({ ...intent(), fakeGrant: { evil: true } })
    expect(res).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_INTENT_KEYS' })
    expect(plane.calls.open).toHaveLength(0)
  })

  it('owner law: destination !== owner session refuses closed (no cross-session carrier exists)', async () => {
    const { plane, carrier } = makeCarrier()
    const res = await carrier.admit(intent({ destination: { sessionId: 'sess-other' } }))
    expect(res).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_OWNER_MISMATCH' })
    expect(plane.calls.open).toHaveLength(0)
  })

  it('consumer law: fork unmounted/mid-swap refuses with zero PA entry (bound consumer/generation only)', async () => {
    const { plane, carrier, setMounted } = makeCarrier()
    setMounted(false)
    const res = await carrier.admit(intent())
    expect(res).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_CONSUMER_ABSENT' })
    expect(plane.calls.open).toHaveLength(0)
    expect(plane.calls.taken).toHaveLength(0)
  })

  it('one flight: pre-resolve OPENS once (token taken), pre-followup EDGES once carrying the FULL construction binding, then a second delivery of the same occurrence is refused (one consume)', async () => {
    const { plane, carrier } = makeCarrier()
    expect(await carrier.admit(intent())).toBe(true)
    expect(plane.calls.open).toHaveLength(1)
    expect(plane.calls.edge).toHaveLength(0) // the final edge has NOT fired at resolve time
    expect(plane.calls.taken).toHaveLength(1)
    expect(await carrier.admit(intent({ phase: 'pre-followup' }))).toBe(true)
    expect(plane.calls.edge).toHaveLength(1)
    expect(plane.calls.edge[0]).toMatchObject({ grant: { g: 1 }, placementName: 'pn', paConstructionBinding: { b: 1 }, realmId: 'realm-test', toolName: 'schedule.trigger-carrier' })
    expect(plane.calls.settled).toHaveLength(1)
    const replay = await carrier.admit(intent({ phase: 'pre-followup' }))
    expect(replay).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_ALREADY_CONSUMED' })
    expect(await carrier.admit(intent())).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_ALREADY_CONSUMED' })
    expect(plane.calls.edge).toHaveLength(1)
  })

  it('the final edge NEVER borrows: pre-followup without its own open refuses, zero edge', async () => {
    const { plane, carrier } = makeCarrier()
    const res = await carrier.admit(intent({ phase: 'pre-followup' }))
    expect(res).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_NOT_OPEN' })
    expect(plane.calls.edge).toHaveLength(0)
  })

  it('a refused open settles the token and stays retryable (denial is not consumption)', async () => {
    let first = true
    const plane = makePlane()
    plane.paAdmit.open = async (walk) => {
      plane.calls.open.push(walk)
      const answer = first ? { kind: 'deny' } : { kind: 'approved', grant: { g: 2 } }
      first = false
      return answer
    }
    const carrier = createScheduleTriggerCarrier({
      plane,
      realmId: 'realm-test',
      familyFacts: { familyId: 'B-SCHEDULE', adapterRevision: 2, providerIdentity: 'a5p5-plane' },
      consumerProbe: () => ({ mounted: true, generation: 'ScheduleService:true' }),
    })
    const res = await carrier.admit(intent())
    expect(res.ok).not.toBe(true)
    expect(plane.calls.settled).toHaveLength(1)
    expect(await carrier.admit(intent())).toBe(true) // retry lands (backoff law), no starvation
  })

  it('flight reclaim: an open flight whose followup leg never arrived is settled and re-opened on the next firing', async () => {
    const { plane, carrier } = makeCarrier()
    expect(await carrier.admit(intent())).toBe(true)
    expect(await carrier.admit(intent())).toBe(true) // same occurrence re-fires: prior flight reclaimed, fresh open
    expect(plane.calls.settled).toHaveLength(1)
    expect(plane.calls.open).toHaveLength(2)
    expect(await carrier.admit(intent({ phase: 'pre-followup' }))).toBe(true)
    expect(plane.calls.edge).toHaveLength(1)
  })

  it('dispose reclaims open flights and every later admit refuses', async () => {
    const { plane, carrier } = makeCarrier()
    expect(await carrier.admit(intent())).toBe(true)
    carrier.dispose()
    expect(plane.calls.settled).toHaveLength(1)
    const res = await carrier.admit(intent())
    expect(res).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_DISPOSED' })
  })

  it('revision fabrication and phase garbage refuse with zero entry (durable rows carry no revision)', async () => {
    const { plane, carrier } = makeCarrier()
    expect(await carrier.admit(intent({ revision: 3 }))).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_REVISION' })
    expect(await carrier.admit(intent({ phase: 'wake-now' }))).toMatchObject({ ok: false, code: 'P_SCHEDULE_CARRIER_PHASE' })
    expect(plane.calls.open).toHaveLength(0)
  })
})
