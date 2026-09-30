/**
 * team-view-sync-complete (frozen decisions 3 + 4) — the projection
 * store in CONTRACT v6 mode: the applied freshness identity is the PAIR
 * (durable generation, live token).
 *
 * Coverage: the v6 pair verdict through the store's full state machine
 * (first-frame apply establishes the pair; a durable advance applies
 * and advances `appliedGeneration`; a live-token-only change applies
 * the overlay WITHOUT advancing `appliedGeneration` — the applied-
 * generation advance stays the client's single ledger-refresh trigger;
 * both cells equal is a duplicate; an older durable generation is
 * stale; a foreign team is foreign; a typed RPC error and an
 * internally inconsistent v6 frame are `rpc-error` / `inconsistent`
 * and never write the frame); `appliedLiveToken` lifecycle (null
 * before the first v6 frame, recorded on apply, cleared on reset, and
 * `null` in the v1 default mode where the frozen generation-only
 * behavior stays byte-identical — a v1 store applies a response that
 * carries NO v6 cells); the v6 stale-APPLY guard (PR #35 follow-up
 * P0-3): a LATE response of a SUPERSEDED request with no durable
 * advance is dropped (T1: no token rollback, T2: no error clearing /
 * frame touch) while a late response of a NEWER durable generation
 * still applies (T3).
 *
 * No real timers: the retry scheduler is manual (due-time driven),
 * matching the frozen v1 store spec's harness.
 */
import { describe, expect, it } from 'vitest'
import {
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  createTeamProjectionStore,
  type TeamProjectionScheduler,
} from '../src/state/team-projection-store.js'
import {
  freshnessPairProjectionBindings,
  generationOnlyProjectionBindings,
} from '../src/transport/team-remote-client.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const METHOD = 'team.getProjection'
const TEAM = 'team-v6-spec'

/**
 * One frozen v6 `team.getProjection` success envelope: the base
 * projection shape + the v6 freshness cells (`durableGeneration` ===
 * the durable generation, the opaque `liveToken`) + the provenance
 * cross-checked against the data generation.
 */
function v6Success(
  teamSessionId: string,
  generation: number,
  liveToken: string,
  provenanceGeneration?: number,
  durableGeneration?: number,
): RemoteResponse {
  return buildRemoteSuccess(
    {
      projection: {
        schemaVersion: 1,
        teamSessionId,
        blueprint: { blueprintId: 'b1', blueprintRevision: 1 },
        generation,
        generatedAt: '2026-08-29T00:00:00.000Z',
        root: { rootSessionId: teamSessionId },
        templates: [],
        members: [],
        ledger: { total: 0 },
        durableGeneration: durableGeneration === undefined ? generation : durableGeneration,
        liveToken,
      },
    },
    {
      method: METHOD,
      endpoint: METHOD,
      contractVersion: 6,
      requestToken: null,
      projectionGeneration: provenanceGeneration === undefined ? generation : provenanceGeneration,
    },
  )
}

/** One v6 response with the live token cell ABSENT (inconsistent). */
function v6SuccessMissingToken(teamSessionId: string, generation: number): RemoteResponse {
  return buildRemoteSuccess(
    {
      projection: {
        schemaVersion: 1,
        teamSessionId,
        blueprint: { blueprintId: 'b1', blueprintRevision: 1 },
        generation,
        generatedAt: '2026-08-29T00:00:00.000Z',
        root: { rootSessionId: teamSessionId },
        templates: [],
        members: [],
        ledger: { total: 0 },
        durableGeneration: generation,
      },
    },
    {
      method: METHOD,
      endpoint: METHOD,
      contractVersion: 6,
      requestToken: null,
      projectionGeneration: generation,
    },
  )
}

/** One typed v6 RPC error envelope. */
function v6Error(code: string, message: string): RemoteResponse {
  return buildRemoteError(code, message, {
    method: METHOD,
    endpoint: METHOD,
    contractVersion: 6,
    requestToken: null,
  })
}

/** One manual scheduler (due-time driven; no real timers). */
function manualScheduler(): TeamProjectionScheduler & { fireAll(): void } {
  const due = new Map<number, () => void>()
  let nextHandle = 1
  return {
    schedule(delayMs, task) {
      const handle = nextHandle++
      void delayMs
      due.set(handle, task)
      return handle
    },
    cancel(handle) {
      due.delete(handle)
    },
    fireAll() {
      for (const task of [...due.values()]) task()
      due.clear()
    },
  }
}

/** A scripted pull: one queued response per call. */
function scriptedPull(responses: RemoteResponse[]) {
  const calls: string[] = []
  let index = 0
  return {
    calls,
    getProjection: (teamSessionId: string) => {
      calls.push(teamSessionId)
      const response = responses[index]
      index += 1
      return Promise.resolve(response === undefined ? v6Success(TEAM, 1, 'lt-v1-a') : response)
    },
  }
}

// ---------------------------------------------------------------------------
// Scenarios (top-level await; the `it` bodies assert the captured state)
// ---------------------------------------------------------------------------

// S1: the first v6 frame applies and ESTABLISHES the pair.
const s1 = scriptedPull([v6Success(TEAM, 7, 'lt-v1-a')])
const s1Store = createTeamProjectionStore({
  getProjection: s1.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
const s1Verdict = await s1Store.pull(TEAM)
const s1State = s1Store.getState()

// S2: the durable advance applies (the token may stay — the generation
// is the authority for the durable view).
const s2 = scriptedPull([
  v6Success(TEAM, 7, 'lt-v1-a'),
  v6Success(TEAM, 8, 'lt-v1-a'),
])
const s2Store = createTeamProjectionStore({
  getProjection: s2.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
await s2Store.pull(TEAM)
const s2Verdict = await s2Store.pull(TEAM)
const s2State = s2Store.getState()

// S3: the LIVE-ONLY change applies the overlay WITHOUT advancing the
// durable generation (frozen decision 4: no ledger refresh rides this).
const s3 = scriptedPull([
  v6Success(TEAM, 8, 'lt-v1-a'),
  v6Success(TEAM, 8, 'lt-v1-b'),
])
const s3Store = createTeamProjectionStore({
  getProjection: s3.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
await s3Store.pull(TEAM)
const s3Verdict = await s3Store.pull(TEAM)
const s3State = s3Store.getState()

// S4: both cells equal → duplicate (no state write).
const s4 = scriptedPull([
  v6Success(TEAM, 8, 'lt-v1-b'),
  v6Success(TEAM, 8, 'lt-v1-b'),
])
const s4Store = createTeamProjectionStore({
  getProjection: s4.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
await s4Store.pull(TEAM)
const s4Frame = s4Store.getState().frame
const s4Verdict = await s4Store.pull(TEAM)
const s4State = s4Store.getState()

// S5: an older durable generation → stale (never overwrites).
const s5 = scriptedPull([
  v6Success(TEAM, 8, 'lt-v1-b'),
  v6Success(TEAM, 7, 'lt-v1-c'),
])
const s5Store = createTeamProjectionStore({
  getProjection: s5.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
await s5Store.pull(TEAM)
const s5Verdict = await s5Store.pull(TEAM)
const s5State = s5Store.getState()

// S6: a different team → foreign.
const s6 = scriptedPull([
  v6Success(TEAM, 8, 'lt-v1-b'),
  v6Success('other-team', 9, 'lt-v1-z'),
])
const s6Store = createTeamProjectionStore({
  getProjection: s6.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
await s6Store.pull(TEAM)
const s6Verdict = await s6Store.pull(TEAM)
const s6State = s6Store.getState()

// S7: the typed RPC error (never rejects; stored intact).
const s7 = scriptedPull([
  v6Success(TEAM, 8, 'lt-v1-b'),
  v6Error('team-not-found', 'no such team'),
])
const s7Store = createTeamProjectionStore({
  getProjection: s7.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
await s7Store.pull(TEAM)
const s7Verdict = await s7Store.pull(TEAM)
const s7State = s7Store.getState()

// S8: an internally inconsistent v6 frame (the live token cell absent)
// → inconsistent; the applied pair is untouched.
const s8 = scriptedPull([
  v6Success(TEAM, 8, 'lt-v1-b'),
  v6SuccessMissingToken(TEAM, 9),
])
const s8Store = createTeamProjectionStore({
  getProjection: s8.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
await s8Store.pull(TEAM)
const s8Frame = s8Store.getState().frame
const s8Verdict = await s8Store.pull(TEAM)
const s8State = s8Store.getState()

// S9: reset clears the pair (both cells back to null).
s8Store.reset()
const s9State = s8Store.getState()

// S10: the GENERATION-ONLY store stays byte-identical (the frozen
// generation-only bindings, explicit injection): a response WITHOUT
// the pair cells still applies (the generation-only identity), and
// `appliedLiveToken` stays null.
function v1Success(teamSessionId: string, generation: number): RemoteResponse {
  return buildRemoteSuccess(
    {
      projection: {
        schemaVersion: 1,
        teamSessionId,
        blueprint: { blueprintId: 'b1', blueprintRevision: 1 },
        generation,
        generatedAt: '2026-08-29T00:00:00.000Z',
        root: { rootSessionId: teamSessionId },
        templates: [],
        members: [],
        ledger: { total: 0 },
      },
    },
    {
      method: METHOD,
      endpoint: METHOD,
      contractVersion: 1,
      requestToken: null,
      projectionGeneration: generation,
    },
  )
}
const s10 = {
  getProjection: (teamSessionId: string) => Promise.resolve(v1Success(teamSessionId, 3)),
}
const s10Store = createTeamProjectionStore({
  getProjection: s10.getProjection,
  ...generationOnlyProjectionBindings,
  scheduler: manualScheduler(),
})
const s10Verdict = await s10Store.pull(TEAM)
const s10State = s10Store.getState()

// ---------------------------------------------------------------------------
// T1-T3 (PR #35 follow-up, P0-3): the v6 stale-APPLY guard — a response
// whose request a LATER request already superseded must not roll back the
// applied freshness PAIR when it carries no durable advance; a late
// response of a genuinely NEWER durable generation still applies.
// ---------------------------------------------------------------------------

/** A pull that hands back DEFERRED responses (the in-flight overlap the
 *  scripted queue cannot express: R1 starts, R2 starts, R2 settles, R1
 *  settles LATE). */
function deferredResponses() {
  const pending: Array<(response: RemoteResponse) => void> = []
  return {
    getProjection: (teamSessionId: string) => {
      void teamSessionId
      return new Promise<RemoteResponse>((resolve) => {
        pending.push(resolve)
      })
    },
    settle(index: number, response: RemoteResponse): void {
      const resolve = pending[index]
      if (resolve === undefined) throw new Error(`deferred response ${index} unknown`)
      resolve(response)
    },
  }
}

// T1: seed gen10 A; R1 -> gen10 B (live-only), R2 -> gen10 C (live-only);
// R2 settles FIRST, R1 settles LATE -> the applied pair stays gen10 C
// (the late same-generation live-only frame must NOT roll back the newer
// token).
const t1 = deferredResponses()
const t1Store = createTeamProjectionStore({
  getProjection: t1.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
const t1p0 = t1Store.pull(TEAM)
t1.settle(0, v6Success(TEAM, 10, 'lt-v1-a'))
await t1p0
const t1p1 = t1Store.pull(TEAM) // R1 (gen10 B) in flight
const t1p2 = t1Store.pull(TEAM) // R2 (gen10 C) starts later
t1.settle(2, v6Success(TEAM, 10, 'lt-v1-c'))
await t1p2
t1.settle(1, v6Success(TEAM, 10, 'lt-v1-b')) // R1 settles LATE
const t1Verdict = await t1p1
const t1State = t1Store.getState()

// T2: seed gen10 A; R1 -> gen10 B (live-only), R2 -> TYPED ERROR settling
// FIRST; R1 settles LATE -> the error stays published AND the frame stays
// gen10 A (the late same-generation live-only frame must not touch the
// applied pair or clear the newer error).
const t2 = deferredResponses()
const t2Store = createTeamProjectionStore({
  getProjection: t2.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
const t2p0 = t2Store.pull(TEAM)
t2.settle(0, v6Success(TEAM, 10, 'lt-v1-a'))
await t2p0
const t2p1 = t2Store.pull(TEAM) // R1 (gen10 B) in flight
const t2p2 = t2Store.pull(TEAM) // R2 (typed error) starts later
t2.settle(2, v6Error('team-internal', 'boom')) // R2 error settles FIRST
await t2p2
t2.settle(1, v6Success(TEAM, 10, 'lt-v1-b')) // R1 settles LATE
const t2Verdict = await t2p1
const t2State = t2Store.getState()

// T3: seed gen10 A; R1 -> gen11 (a durable ADVANCE), R2 -> TYPED ERROR
// settling FIRST; R1 settles LATE -> the newer durable generation STILL
// APPLIES (durable authority outranks request order).
const t3 = deferredResponses()
const t3Store = createTeamProjectionStore({
  getProjection: t3.getProjection,
  ...freshnessPairProjectionBindings,
  scheduler: manualScheduler(),
})
const t3p0 = t3Store.pull(TEAM)
t3.settle(0, v6Success(TEAM, 10, 'lt-v1-a'))
await t3p0
const t3p1 = t3Store.pull(TEAM) // R1 (gen11) in flight
const t3p2 = t3Store.pull(TEAM) // R2 (typed error) starts later
t3.settle(2, v6Error('team-internal', 'boom')) // R2 error settles FIRST
await t3p2
t3.settle(1, v6Success(TEAM, 11, 'lt-v1-z')) // R1 (gen11) settles LATE
const t3Verdict = await t3p1
const t3State = t3Store.getState()

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe('team-view-sync-complete — the projection store in contract v6 mode (the freshness PAIR)', () => {
  it('S1: the first v6 frame applies and establishes the applied pair', () => {
    expect(s1Verdict.status).toBe('apply')
    expect(s1Verdict.receivedGeneration).toBe(7)
    expect(s1State.status).toBe('ready')
    expect(s1State.teamSessionId).toBe(TEAM)
    expect(s1State.appliedGeneration).toBe(7)
    expect(s1State.appliedLiveToken).toBe('lt-v1-a')
    if (s1State.frame === null) throw new Error('S1: the applied frame is missing')
    const projection = s1State.frame.projection as unknown as Record<string, unknown>
    expect(projection['durableGeneration']).toBe(7)
    expect(projection['liveToken']).toBe('lt-v1-a')
  })

  it('S2: a durable advance applies and advances appliedGeneration', () => {
    expect(s2Verdict.status).toBe('apply')
    expect(s2Verdict.receivedGeneration).toBe(8)
    expect(s2State.appliedGeneration).toBe(8)
    expect(s2State.appliedLiveToken).toBe('lt-v1-a')
    expect(s2State.status).toBe('ready')
  })

  it('S3: a live-token-only change applies WITHOUT advancing the durable generation (frozen decision 4)', () => {
    expect(s3Verdict.status).toBe('apply')
    expect(s3Verdict.receivedGeneration).toBe(8)
    // THE frozen semantics: the durable generation is UNCHANGED (the
    // client's single ledger-refresh trigger does not fire), while the
    // applied live token moves to the new value.
    expect(s3State.appliedGeneration).toBe(8)
    expect(s3State.appliedLiveToken).toBe('lt-v1-b')
    expect(s3State.status).toBe('ready')
  })

  it('S4: both cells equal is a duplicate — no state write (stable frame reference)', () => {
    expect(s4Verdict.status).toBe('duplicate')
    expect(s4State.appliedGeneration).toBe(8)
    expect(s4State.appliedLiveToken).toBe('lt-v1-b')
    expect(s4State.frame).toBe(s4Frame)
  })

  it('S5: an older durable generation is stale — the applied pair is untouched', () => {
    expect(s5Verdict.status).toBe('stale')
    expect(s5Verdict.receivedGeneration).toBe(7)
    expect(s5State.appliedGeneration).toBe(8)
    expect(s5State.appliedLiveToken).toBe('lt-v1-b')
    expect(s5State.status).toBe('ready')
  })

  it('S6: a foreign team is foreign — no overwrite', () => {
    expect(s6Verdict.status).toBe('foreign')
    expect(s6State.appliedGeneration).toBe(8)
    expect(s6State.teamSessionId).toBe(TEAM)
  })

  it('S7: a typed RPC error resolves (never rejects), is stored intact, and never writes the frame', () => {
    expect(s7Verdict.status).toBe('rpc-error')
    expect(s7State.status).toBe('error')
    expect(s7State.lastError?.code).toBe('team-not-found')
    expect(s7State.appliedGeneration).toBe(8)
    expect(s7State.appliedLiveToken).toBe('lt-v1-b')
  })

  it('S8: an internally inconsistent v6 frame (missing live token) is inconsistent — no write', () => {
    expect(s8Verdict.status).toBe('inconsistent')
    expect(s8Verdict.receivedGeneration).toBeNull()
    expect(s8State.appliedGeneration).toBe(8)
    expect(s8State.appliedLiveToken).toBe('lt-v1-b')
    expect(s8State.frame).toBe(s8Frame)
    expect(s8State.status).toBe('error')
  })

  it('S9: reset clears the pair (both cells null, idle)', () => {
    expect(s9State.status).toBe('idle')
    expect(s9State.teamSessionId).toBeNull()
    expect(s9State.appliedGeneration).toBeNull()
    expect(s9State.appliedLiveToken).toBeNull()
    expect(s9State.frame).toBeNull()
  })

  it('S10: the v1 default store stays byte-identical — a response without the v6 cells applies; the token stays null', () => {
    expect(s10Verdict.status).toBe('apply')
    expect(s10Verdict.receivedGeneration).toBe(3)
    expect(s10State.appliedGeneration).toBe(3)
    expect(s10State.appliedLiveToken).toBeNull()
    expect(s10State.status).toBe('ready')
  })

  it('T1: a LATE same-generation live-only frame of a SUPERSEDED request must not roll back the newer token (the guard drops the no-advance apply)', () => {
    // R2 (gen10 C) settled first; R1 (gen10 B) settled late: its apply
    // verdict is dropped — the applied pair stays gen10 C.
    expect(t1Verdict.status).toBe('apply') // the verdict itself stands...
    expect(t1State.appliedGeneration).toBe(10) // ...but the store did NOT apply it
    expect(t1State.appliedLiveToken).toBe('lt-v1-c')
    expect(t1State.status).toBe('ready')
    if (t1State.frame === null) throw new Error('T1: the applied frame is missing')
    const projection = t1State.frame.projection as unknown as Record<string, unknown>
    expect(projection['liveToken']).toBe('lt-v1-c')
  })

  it('T2: a LATE same-generation frame of a SUPERSEDED request must not clear the newer error or touch the applied frame', () => {
    expect(t2Verdict.status).toBe('apply') // the verdict stands...
    expect(t2State.status).toBe('error') // ...the error stays published
    expect(t2State.lastError?.code).toBe('team-internal')
    expect(t2State.appliedGeneration).toBe(10)
    expect(t2State.appliedLiveToken).toBe('lt-v1-a') // the frame stays gen10 A
    if (t2State.frame === null) throw new Error('T2: the applied frame is missing')
    const projection = t2State.frame.projection as unknown as Record<string, unknown>
    expect(projection['liveToken']).toBe('lt-v1-a')
  })

  it('T3: a LATE frame of a genuinely NEWER durable generation STILL APPLIES (durable authority outranks request order)', () => {
    expect(t3Verdict.status).toBe('apply')
    expect(t3State.status).toBe('ready')
    expect(t3State.appliedGeneration).toBe(11)
    expect(t3State.appliedLiveToken).toBe('lt-v1-z')
    expect(t3State.lastError).toBeUndefined()
  })
})
