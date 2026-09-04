/**
 * g8s1-stamp-advance — S1-A lag-tolerant generation-stamp advance (Gate G8
 * gate supplement, adjudication R60; replaces the original §4.2
 * commit-ATOMIC stamp requirement, which is impossible with the public
 * storage seam).
 *
 * The stamp is the EXISTING `team_sessions.generation` field (seed 1,
 * frozen). It advances +1, durably, only AFTER a NEW ledger fact has been
 * durably written through the ledger commit choke point (hook A in
 * `LedgerRepository.put` — a pre-read marks a new entry; a no-op re-put of
 * identical bytes advances nothing). Stamp-first (advancing at
 * `allocateSequence` time) was rejected by the adjudication.
 *
 * Proven here (storage level, in-memory seam, real repository/journal
 * paths):
 * - fresh team seeds at generation 1;
 * - N=4 sequential mutations through the real journal commit path advance
 *   the stamp strictly 1 → 2 → 3 → 4 → 5 (monotonic, exactly +1 per new
 *   fact, one fact per operation);
 * - identical-bytes re-put of a fact is a no-op that advances NOTHING, and
 *   a journal re-drive of an already-committed operation (fact reuse)
 *   advances NOTHING (zero extra writes, same ledger sequence);
 * - non-state writes (sequence allocations, member/operation/override/
 *   compatibility/binding puts) never touch the stamp;
 * - `advanceGeneration` on a missing team row fails LOUDLY with
 *   SEAM_FAILURE carrying the public seam `missing-key` code (the closed v1
 *   error set has no RECORD_MISSING; a stamp advance for a nonexistent team
 *   is an invariant violation the real wiring cannot produce);
 * - a fact put for a team without a row rejects with SEAM_FAILURE AFTER the
 *   fact row is already durable (state-before-stamp ordering — the
 *   documented v1 lag/crash window, exactly one change behind).
 *
 * Top-level-await house pattern: every world is built and driven at module
 * top level; the `it` bodies are synchronous and assert only captured
 * consts (the shim rejects async `it` bodies).
 *
 * @module @dsh-agent-team/storage/test/g8s1-stamp-advance
 */

import { describe, expect, it } from 'vitest'

import {
  InMemoryStorageSeam,
  P4_FIXTURE,
  asTeamDomainError,
  capture,
  compatibilityState,
  detail,
  humanOverrideTeam,
  ledgerEntryRecord,
  memberInstanceInput,
  operationRecord,
  teamMemberBinding,
  teamSessionInput,
} from './p4-helpers.js'
import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import { createTeamDomain, type TeamDomain } from '../repositories/index.js'
import { createP4t2Journal, provisionRequest } from './p4t2-helpers.js'

const ROOT = String(P4_FIXTURE.rootSessionId)

/** Read the current stamp; throws when the team row is absent (every world here seeds it). */
function generationOf(domain: TeamDomain): number {
  const generation = domain.repositories.teamSessions.get(ROOT)?.generation
  if (generation === undefined) throw new Error('g8s1: team row missing')
  return generation
}

// ------------------------------------------------------------ world A: the
// real journal commit path — seed 1, four committed operations, one replay
const seamA = new InMemoryStorageSeam()
const worldA = await createP4t2Journal(seamA)
const repoA = worldA.repositories

const aSeed = generationOf(worldA)
const aSeedCount = repoA.ledger.entryCount()

const aR1 = await worldA.journal.execute(provisionRequest())
const aStamp1 = generationOf(worldA)
const aCount1 = repoA.ledger.entryCount()

// Same member (identical effects are skipped) but a NEW operation — a new
// fact must still advance the stamp exactly once.
const aR2 = await worldA.journal.execute(provisionRequest({ operationId: 'op-g8s102', idempotencyKey: 'g8s1-provision-02' }))
const aStamp2 = generationOf(worldA)
const aCount2 = repoA.ledger.entryCount()

const aR3 = await worldA.journal.execute(
  provisionRequest({
    operationId: 'op-g8s103',
    idempotencyKey: 'g8s1-provision-03',
    payload: { childSessionId: 'session-child-2', instanceId: 'inst-beta' },
  }),
)
const aStamp3 = generationOf(worldA)
const aCount3 = repoA.ledger.entryCount()

const aR4 = await worldA.journal.execute(
  provisionRequest({
    operationId: 'op-g8s104',
    idempotencyKey: 'g8s1-provision-04',
    payload: { childSessionId: 'session-child-3', instanceId: 'inst-gamma' },
  }),
)
const aStamp4 = generationOf(worldA)
const aCount4 = repoA.ledger.entryCount()

// Replay of the FIRST operation (same operationId, key, canonical intent):
// the journal reuses the durable fact — zero writes, no double advance.
const aPreReplayWrites = seamA.writeCount
const aReplay = await worldA.journal.execute(provisionRequest())
const aStampAfterReplay = generationOf(worldA)
const aCountAfterReplay = repoA.ledger.entryCount()
const aReplayWrites = seamA.writeCount - aPreReplayWrites

// ------------------------------------------------------- world B: non-state
// writes never advance; direct puts do (idempotency + monotonic return)
const seamB = new InMemoryStorageSeam()
const worldB = await createTeamDomain(seamB)
const repoB = worldB.repositories
await repoB.teamSessions.put(teamSessionInput())
const bSeed = generationOf(worldB)

// Two sequence allocations (boot + bump) and one put per other store.
const bSeq1 = await repoB.ledger.allocateSequence()
const bSeq2 = await repoB.ledger.allocateSequence()
await repoB.memberInstances.put(memberInstanceInput())
await repoB.operations.put(operationRecord('op-g8s1b1', 'g8s1-key-b1'))
await repoB.overrides.put(humanOverrideTeam(ROOT))
await repoB.compatibility.put(compatibilityState(ROOT))
await repoB.sessionBindings.put(teamMemberBinding(ROOT, 'inst-alpha', 'session-child-1'))
const bAfterNonState = generationOf(worldB)
const bAfterNonStateCount = repoB.ledger.entryCount()

// A NEW fact advances exactly once (direct put through the hook).
const bFact1 = ledgerEntryRecord(1, ROOT, { operationId: 'op-g8s1b1' })
const bPut1 = await capture(() => repoB.ledger.put(bFact1))
const bStamp1 = generationOf(worldB)

// Identical bytes re-put: the silent no-op must NOT advance again.
const bPut1Again = await capture(() => repoB.ledger.put(bFact1))
const bStamp1Again = generationOf(worldB)
const bCount1Again = repoB.ledger.entryCount()

// A second NEW fact advances again; the direct API returns strictly
// increasing next values (monotonic, never decreases).
const bPut2 = await capture(() => repoB.ledger.put(ledgerEntryRecord(2, ROOT, { operationId: 'op-g8s1b1' })))
const bStamp2 = generationOf(worldB)
const bDirect1 = await repoB.teamSessions.advanceGeneration(ROOT)
const bDirect2 = await repoB.teamSessions.advanceGeneration(ROOT)

// --------------------------------------------------- world C: the teamless
// root — the loud invariant-violation surface (state-before-stamp order)
const seamC = new InMemoryStorageSeam()
const worldC = await createTeamDomain(seamC)
const repoC = worldC.repositories

const cAdvanceMissing = await capture(() => repoC.teamSessions.advanceGeneration(ROOT))
const cSeq = await repoC.ledger.allocateSequence()
const cFactPut = await capture(() => repoC.ledger.put(ledgerEntryRecord(cSeq, ROOT, { operationId: 'op-g8s1c1' })))
const cFactPresent = repoC.ledger.get(cSeq)
const cFactCount = repoC.ledger.entryCount()
const cTeamRows = repoC.teamSessions.list().length
const cRawLedgerKeys = [...seamC.rawRows(TEAM_DOMAIN_NAME, 'ledger').keys()].sort()

// --------------------------------------------------------------------- tests

describe('g8s1: the real journal commit path advances the stamp strictly 1..N+1', () => {
  it('a fresh team seeds at generation 1 with an empty ledger', () => {
    expect(aSeed).toBe(1)
    expect(aSeedCount).toBe(0)
  })

  it('each of the four committed operations advances the stamp exactly once, in order', () => {
    expect(aR1.phase).toBe('COMMITTED')
    expect(aR2.phase).toBe('COMMITTED')
    expect(aR3.phase).toBe('COMMITTED')
    expect(aR4.phase).toBe('COMMITTED')
    expect([aSeed, aStamp1, aStamp2, aStamp3, aStamp4]).toEqual([1, 2, 3, 4, 5])
    expect([aCount1, aCount2, aCount3, aCount4]).toEqual([1, 2, 3, 4])
  })

  it('the second operation (identical member effects skipped) still advances exactly once — the advance tracks the FACT, not the effects', () => {
    expect(aR2.ledgerSequence).toBe(2)
    expect(aStamp2).toBe(aStamp1 + 1)
    expect(aCount2).toBe(aCount1 + 1)
  })

  it('replaying an already-committed operation (fact reuse) advances nothing and writes nothing', () => {
    expect(aReplay.phase).toBe('COMMITTED')
    expect(aReplay.ledgerSequence).toBe(aR1.ledgerSequence)
    expect(aStampAfterReplay).toBe(5)
    expect(aCountAfterReplay).toBe(4)
    expect(aReplayWrites).toBe(0)
  })
})

describe('g8s1: idempotency and monotonicity of the advance', () => {
  it('the seed is 1 and the stamp strictly increases (monotonic, never decreases)', () => {
    expect(bSeed).toBe(1)
    expect(bStamp1).toBe(2)
    expect(bStamp2).toBe(3)
    expect(bDirect1).toBe(4)
    expect(bDirect2).toBe(5)
    expect(bDirect2 > bDirect1).toBe(true)
  })

  it('an identical-bytes re-put of the same fact is a no-op that advances nothing', () => {
    expect(bPut1.ok).toBe(true)
    expect(bPut1Again.ok).toBe(true)
    expect(bStamp1Again).toBe(2)
    expect(bCount1Again).toBe(1)
  })

  it('the direct puts are accepted and the ledger counts one fact per new sequence', () => {
    expect(bPut2.ok).toBe(true)
    expect(repoB.ledger.entryCount()).toBe(2)
    expect(repoB.ledger.get(1)?.operationId).toBe('op-g8s1b1')
    expect(repoB.ledger.get(2)?.operationId).toBe('op-g8s1b1')
  })
})

describe('g8s1: non-state writes never touch the stamp', () => {
  it('sequence allocations (boot + bump) plus one put per other store leave the seed untouched', () => {
    expect(bSeq1).toBe(1)
    expect(bSeq2).toBe(2)
    expect(bAfterNonState).toBe(1)
    expect(bAfterNonStateCount).toBe(0)
  })
})

describe('g8s1: the teamless root fails loudly (state-before-stamp order)', () => {
  it('advanceGeneration on a missing team row is a SEAM_FAILURE carrying the public seam missing-key code', () => {
    expect(cAdvanceMissing.ok).toBe(false)
    const error = asTeamDomainError(cAdvanceMissing.error)
    expect(error.code).toBe('SEAM_FAILURE')
    expect(detail(error, 'seamCode')).toBe('missing-key')
  })

  it('a fact put for the teamless root rejects, but the fact row is already durable', () => {
    expect(cSeq).toBe(1)
    expect(cFactPut.ok).toBe(false)
    const error = asTeamDomainError(cFactPut.error)
    expect(error.code).toBe('SEAM_FAILURE')
    // The state write is durable BEFORE the stamp put: the v1 lag window
    // (exactly one change behind) in its purest form.
    expect(cFactPresent).not.toBe(undefined)
    expect(cFactCount).toBe(1)
    expect(cRawLedgerKeys).toEqual(['1', '__ledger_sequence_counter'])
    // The team row was never created — the stamp simply does not exist yet.
    expect(cTeamRows).toBe(0)
  })
})
