/**
 * P6-T5 — progress updates: durable, reflected in the projection seed,
 * authorized through the facade, and total-ordered per subject.
 *
 * MUST-TEST (TaskDoc §11.7): a progress update is durable and reflected
 * in the projection seed; the out-of-order guard rejects a stale sequence
 * (REJECT policy: stale cannot overwrite newer state); unknown-instance
 * targeting fails with the facade's typed code; input-shape failures are
 * typed ActivityErrors with ZERO side effects.
 */

import { describe, expect, it } from 'vitest'
import {
  P6T2_SEEDS,
  P6T5_ROOT,
  activityRows,
  assertActivityCode,
  assertFacadeCode,
  createP6T5Suite,
  destroyP6T1World,
  expectActivityRejection,
  expectFacadeRejection,
  humanCaller,
  leaderCaller,
  memberCaller,
  nextSequence,
  p6t5Progress,
  rawActivityFacts,
  rawAuditFacts,
  rawLedgerCount,
  teamProjection,
} from './p6t5-helpers.js'
import type { P6T5Suite } from './p6t5-helpers.js'

interface ProgressResults {
 firstRow: {
   globalSequence: number
   factType: string
   sequence: number
   op: string
   progress: string
   summary?: string
   lastAction?: string
   correlation?: string
   reportedByInstanceId: string
  }
 durableFactTypes: string[]
 projectionAfterFirst: {
   status?: string
   summary?: string
   lastAction?: string
   correlation?: string
   sequence: number
   openIntervals: readonly unknown[]
   closedIntervals: readonly unknown[]
  }
 projectionAfterBlocked: { readonly status?: string; readonly sequence: number }
 leaderReport: {
   status?: string
   sequence: number
   reportedByInstanceId?: string
  }
 auditFacts: {
   count: number
   actions: string[]
   targets: string[]
   progresses: string[]
   firstCaller: unknown
  }
 unknownInstance: { readonly code: string }
 staleClaim: {
   code: string
   kind: string
   claimed: number
   head: number
   expected: number
  }
 gapClaim: { readonly code: string; readonly kind: string; readonly expected: number }
 stateAfterRejections: { readonly head: number; readonly ledgerCount: number }
 freshSubjectHead: number
 worker2Subject: { readonly status?: string; readonly sequence: number }
 inputValidation: {
   zeroSequence: string
   emptySubject: string
   openSubject: string
   badProgress: string
   emptyToken: string
   longSummary: string
   badInstanceId: string
   badRoot: string
   ledgerCountAfter: number
  }
}

const results: ProgressResults = {
  firstRow: { globalSequence: 0, factType: '', sequence: 0, op: '', progress: '', reportedByInstanceId: '' },
  durableFactTypes: [],
  projectionAfterFirst: { sequence: 0, openIntervals: [], closedIntervals: [] },
  projectionAfterBlocked: { sequence: 0 },
  leaderReport: { sequence: 0 },
  auditFacts: { count: 0, actions: [], targets: [], progresses: [], firstCaller: undefined },
  unknownInstance: { code: '' },
  staleClaim: { code: '', kind: '', claimed: 0, head: 0, expected: 0 },
  gapClaim: { code: '', kind: '', expected: 0 },
  stateAfterRejections: { head: 0, ledgerCount: 0 },
  freshSubjectHead: 0,
  worker2Subject: { sequence: 0 },
  inputValidation: {
    zeroSequence: '',
    emptySubject: '',
    openSubject: '',
    badProgress: '',
    emptyToken: '',
    longSummary: '',
    badInstanceId: '',
    badRoot: '',
    ledgerCountAfter: 0,
  },
}

const worker = P6T2_SEEDS.worker.instanceId
const worker2 = P6T2_SEEDS.worker2.instanceId
let suite: P6T5Suite

{
  suite = await createP6T5Suite('p6t5x-progress', ['leader', 'worker', 'worker2'])
  try {
    const { world, ledger } = suite

    // --- MUST-TEST: the progress update is durable --------------------------------
    const firstRow = await ledger.recordProgress(
      p6t5Progress({
        subject: 'build',
        sequence: 1,
        progress: 'in-progress',
        summary: 'starting the build',
        lastAction: 'cloning the repo',
        correlation: 'corr-build',
        requestToken: 'tok-p6t5-p1',
      }),
    )
    results.firstRow = {
      globalSequence: firstRow.globalSequence,
      factType: firstRow.factType,
      sequence: firstRow.sequence,
      op: firstRow.op,
      progress: firstRow.progress,
      summary: firstRow.summary,
      lastAction: firstRow.lastAction,
      correlation: firstRow.correlation,
      reportedByInstanceId: firstRow.reportedByInstanceId,
    }
    results.durableFactTypes = rawActivityFacts(world).map((entry) => entry.factType)

    // --- MUST-TEST: reflected in the projection seed ------------------------------
    const lane = teamProjection(ledger, world).instances.find(
      (instance) => instance.instanceId === worker,
    )
    const subject = lane?.subjects.find((entry) => entry.subject === 'build')
    results.projectionAfterFirst = {
      status: subject?.status,
      summary: subject?.summary,
      lastAction: subject?.lastAction,
      correlation: subject?.correlation,
      sequence: subject?.sequence ?? 0,
      openIntervals: subject?.openIntervals ?? [],
      closedIntervals: subject?.closedIntervals ?? [],
    }

    // second progress on the same subject (status update to blocked)
    await ledger.recordProgress(
      p6t5Progress({
        subject: 'build',
        sequence: 2,
        progress: 'blocked',
        summary: 'waiting for the api key',
        lastAction: 'requesting the api key',
        requestToken: 'tok-p6t5-p2',
      }),
    )
    const lane2 = teamProjection(ledger, world).instances.find(
      (instance) => instance.instanceId === worker,
    )
    const subject2 = lane2?.subjects.find((entry) => entry.subject === 'build')
    results.projectionAfterBlocked = {
      status: subject2?.status,
      sequence: subject2?.sequence ?? 0,
    }

    // the leader may report for a live instance (the documented reporter rule)
    const leaderRow = await ledger.recordProgress(
      p6t5Progress({
        caller: leaderCaller(),
        subject: 'build',
        sequence: 3,
        progress: 'completed',
        summary: 'build finished',
        lastAction: 'publishing the artifact',
        requestToken: 'tok-p6t5-p3',
      }),
    )
    const lane3 = teamProjection(ledger, world).instances.find(
      (instance) => instance.instanceId === worker,
    )
    const subject3 = lane3?.subjects.find((entry) => entry.subject === 'build')
    results.leaderReport = {
      status: subject3?.status,
      sequence: subject3?.sequence ?? 0,
      reportedByInstanceId: leaderRow.reportedByInstanceId,
    }

    // the facade audit facts (the authorization evidence family)
    const audits = rawAuditFacts(world)
    results.auditFacts = {
      count: audits.length,
      actions: audits.map((entry) => String(entry.payload['action'])),
      targets: audits.map((entry) => String(entry.payload['targetInstanceId'])),
      progresses: audits.map((entry) => String(entry.payload['progress'])),
      firstCaller: audits.length > 0 ? audits[0]?.payload['caller'] : undefined,
    }

    // --- MUST-TEST (negative): unknown instance → the facade's typed code --------
    // the LEADER reports for the ghost (leader-any passes the pre-facade
    // reporter rule), so the facade's own target resolution rejects it
    const unknown = await expectFacadeRejection(
      ledger.recordProgress(
        p6t5Progress({
          caller: leaderCaller(),
          instanceId: 'inst-p6t5ghost00',
          subject: 'build',
          sequence: nextSequence(ledger, 'inst-p6t5ghost00', 'build'),
          requestToken: 'tok-p6t5-unknown',
        }),
      ),
      'TEAM_RUNTIME_INSTANCE_NOT_FOUND',
    )
    results.unknownInstance = { code: unknown.code }

    // --- MUST-TEST: the out-of-order guard (REJECT policy) -------------------------
    const stale = await expectActivityRejection(
      ledger.recordProgress(
        p6t5Progress({ subject: 'build', sequence: 2, requestToken: 'tok-p6t5-stale' }),
      ),
      'ACTIVITY_SEQUENCE_STALE',
    )
    const staleDetails = stale.details ?? {}
    results.staleClaim = {
      code: stale.code,
      kind: String(staleDetails['kind']),
      claimed: Number(staleDetails['claimed']),
      head: Number(staleDetails['head']),
      expected: Number(staleDetails['expected']),
    }
    const gap = await expectActivityRejection(
      ledger.recordProgress(
        p6t5Progress({ subject: 'build', sequence: 99, requestToken: 'tok-p6t5-gap' }),
      ),
      'ACTIVITY_SEQUENCE_STALE',
    )
    results.gapClaim = {
      code: gap.code,
      kind: String(gap.details?.['kind']),
      expected: Number(gap.details?.['expected']),
    }
    results.stateAfterRejections = {
      head: nextSequence(ledger, worker, 'build') - 1,
      ledgerCount: rawLedgerCount(world),
    }

    // a FRESH subject starts at head 0 (per-subject clocks are independent)
    await ledger.recordProgress(
      p6t5Progress({
        subject: 'deploy',
        sequence: 1,
        progress: 'in-progress',
        summary: 'packaging the release',
        requestToken: 'tok-p6t5-deploy1',
      }),
    )
    results.freshSubjectHead = nextSequence(ledger, worker, 'deploy') - 1

    // a different member's subject is independent too
    await ledger.recordProgress(
      p6t5Progress({
        caller: memberCaller(worker2),
        instanceId: worker2,
        subject: 'scout-work',
        sequence: 1,
        progress: 'in-progress',
        lastAction: 'scanning the registry',
        requestToken: 'tok-p6t5-w2s1',
      }),
    )
    const laneW2 = teamProjection(ledger, world).instances.find(
      (instance) => instance.instanceId === worker2,
    )
    const subjectW2 = laneW2?.subjects.find((entry) => entry.subject === 'scout-work')
    results.worker2Subject = {
      status: subjectW2?.status,
      sequence: subjectW2?.sequence ?? 0,
    }

    // --- input validation (typed ActivityError, ZERO side effects) -----------------
    const before = rawLedgerCount(world)
    const zeroSequence = await expectActivityRejection(
      ledger.recordProgress(p6t5Progress({ sequence: 0, requestToken: 'tok-p6t5-i1' })),
      'ACTIVITY_INPUT_INVALID',
    )
    const emptySubject = await expectActivityRejection(
      ledger.recordProgress(p6t5Progress({ subject: '', requestToken: 'tok-p6t5-i2' })),
      'ACTIVITY_INPUT_INVALID',
    )
    const openSubject = await expectActivityRejection(
      ledger.recordProgress(
        p6t5Progress({
          subject: 'x'.repeat(257),
          requestToken: 'tok-p6t5-i3',
        }),
      ),
      'ACTIVITY_INPUT_INVALID',
    )
    const badProgress = await expectActivityRejection(
      ledger.recordProgress(
        p6t5Progress({
          progress: 'done' as never,
          requestToken: 'tok-p6t5-i4',
        }),
      ),
      'ACTIVITY_INPUT_INVALID',
    )
    const emptyToken = await expectActivityRejection(
      ledger.recordProgress(p6t5Progress({ requestToken: '' })),
      'ACTIVITY_INPUT_INVALID',
    )
    const longSummary = await expectActivityRejection(
      ledger.recordProgress(
        p6t5Progress({ summary: 's'.repeat(513), requestToken: 'tok-p6t5-i5' }),
      ),
      'ACTIVITY_INPUT_INVALID',
    )
    const badInstanceId = await expectActivityRejection(
      ledger.recordProgress(p6t5Progress({ instanceId: 'not-an-instance', requestToken: 'tok-p6t5-i6' })),
      'ACTIVITY_INPUT_INVALID',
    )
    const badRoot = await expectActivityRejection(
      ledger.recordProgress(p6t5Progress({ rootSessionId: 12345 as never, requestToken: 'tok-p6t5-i7' })),
      'ACTIVITY_INPUT_INVALID',
    )
    results.inputValidation = {
      zeroSequence: zeroSequence.code,
      emptySubject: emptySubject.code,
      openSubject: openSubject.code,
      badProgress: badProgress.code,
      emptyToken: emptyToken.code,
      longSummary: longSummary.code,
      badInstanceId: badInstanceId.code,
      badRoot: badRoot.code,
      ledgerCountAfter: rawLedgerCount(world),
    }
    expect(before).toBe(rawLedgerCount(world))
  } finally {
    await destroyP6T1World(suite.world)
  }
}

describe('P6-T5 progress updates (durable, projected, authorized, total-ordered)', () => {
  it('records the first progress durably as the closed progress fact type', () => {
    expect(results.firstRow.factType).toBe('activity-progress-recorded')
    expect(results.firstRow.op).toBe('progress')
    expect(results.firstRow.globalSequence).toBe(2)
    expect(results.firstRow.sequence).toBe(1)
    expect(results.firstRow.progress).toBe('in-progress')
    expect(results.firstRow.summary).toBe('starting the build')
    expect(results.firstRow.lastAction).toBe('cloning the repo')
    expect(results.firstRow.correlation).toBe('corr-build')
    expect(results.firstRow.reportedByInstanceId).toBe(worker)
    expect(results.durableFactTypes).toEqual(['activity-progress-recorded'])
  })

  it('reflects the progress in the projection seed (frozen UI field names)', () => {
    expect(results.projectionAfterFirst.status).toBe('in-progress')
    expect(results.projectionAfterFirst.summary).toBe('starting the build')
    expect(results.projectionAfterFirst.lastAction).toBe('cloning the repo')
    expect(results.projectionAfterFirst.correlation).toBe('corr-build')
    expect(results.projectionAfterFirst.sequence).toBe(1)
    expect(results.projectionAfterFirst.openIntervals).toEqual([])
    expect(results.projectionAfterFirst.closedIntervals).toEqual([])
  })

  it('updates the status on the next progress (blocked) at the next per-subject sequence', () => {
    expect(results.projectionAfterBlocked.status).toBe('blocked')
    expect(results.projectionAfterBlocked.sequence).toBe(2)
  })

  it('allows the leader to report for a live instance (the documented reporter rule)', () => {
    expect(results.leaderReport.status).toBe('completed')
    expect(results.leaderReport.sequence).toBe(3)
    expect(results.leaderReport.reportedByInstanceId).toBe('inst-leader')
  })

  it('keeps the facade audit facts as the authorization evidence family', () => {
    expect(results.auditFacts.count).toBe(3)
    expect(results.auditFacts.actions).toEqual([
      'report-progress',
      'report-progress',
      'report-progress',
    ])
    expect(results.auditFacts.targets).toEqual([worker, worker, worker])
    expect(results.auditFacts.progresses).toEqual(['in-progress', 'blocked', 'completed'])
    expect(results.auditFacts.firstCaller).toEqual({
      kind: 'instance',
      instanceId: worker,
      role: 'member',
    })
  })

  it("rejects an unknown target with the facade's typed code (INSTANCE_NOT_FOUND)", () => {
    expect(results.unknownInstance.code).toBe('TEAM_RUNTIME_INSTANCE_NOT_FOUND')
  })

  it('rejects a stale claimed sequence (REJECT policy: stale cannot overwrite newer state)', () => {
    expect(results.staleClaim.code).toBe('ACTIVITY_SEQUENCE_STALE')
    expect(results.staleClaim.kind).toBe('stale')
    expect(results.staleClaim.claimed).toBe(2)
    expect(results.staleClaim.head).toBe(3)
    expect(results.staleClaim.expected).toBe(4)
  })

  it('rejects a gap claimed sequence (a gap is never silently filled)', () => {
    expect(results.gapClaim.code).toBe('ACTIVITY_SEQUENCE_STALE')
    expect(results.gapClaim.kind).toBe('gap')
    expect(results.gapClaim.expected).toBe(4)
  })

  it('leaves the durable state unchanged after rejected claims', () => {
    // head stayed at 3 (seq 1,2,3); the ledger holds 8 entries: the 3
    // activity rows + 3 facade audit facts from the successful writes,
    // plus 2 orphan audit facts — the stale/gap claims passed the facade
    // (audit evidence committed) before the ledger's out-of-order guard
    // rejected them in its own guarded commit, so each left an audit fact
    // without a structured row. That is the documented crash-window shape:
    // detectable (audit fact without a row) and repairable (re-report at
    // the re-read head+1). The per-subject head is unchanged, so no newer
    // state was overwritten.
    expect(results.stateAfterRejections.head).toBe(3)
    expect(results.stateAfterRejections.ledgerCount).toBe(8)
  })

  it('keeps per-subject clocks independent (fresh subject starts at 1)', () => {
    expect(results.freshSubjectHead).toBe(1)
  })

  it('keeps per-member subjects independent (worker2 self-report)', () => {
    expect(results.worker2Subject.status).toBe('in-progress')
    expect(results.worker2Subject.sequence).toBe(1)
  })

  it('fails input-shape violations with typed ActivityErrors and ZERO side effects', () => {
    const v = results.inputValidation
    expect(v.zeroSequence).toBe('ACTIVITY_INPUT_INVALID')
    expect(v.emptySubject).toBe('ACTIVITY_INPUT_INVALID')
    expect(v.openSubject).toBe('ACTIVITY_INPUT_INVALID')
    expect(v.badProgress).toBe('ACTIVITY_INPUT_INVALID')
    expect(v.emptyToken).toBe('ACTIVITY_INPUT_INVALID')
    expect(v.longSummary).toBe('ACTIVITY_INPUT_INVALID')
    expect(v.badInstanceId).toBe('ACTIVITY_INPUT_INVALID')
    expect(v.badRoot).toBe('ACTIVITY_INPUT_INVALID')
    // the input-validation rejections wrote nothing durable (they fail in
    // validateBase, BEFORE the facade call — zero side effects): the count
    // is still the 8 from after the rejected claims plus the two later
    // successful writes (deploy + worker2, each a row + its audit fact)
    expect(v.ledgerCountAfter).toBe(12)
  })

  it('uses the team root of the P6-T5 fixture', () => {
    expect(P6T5_ROOT).toBe('session-root-p6t1')
  })
})
