/**
 * P6-T5 — RUNNING intervals: the multiple-simultaneous-intervals model,
 * the open/close guards (fail closed), the shared per-subject total order,
 * and the out-of-order guard around interval operations.
 *
 * MUST-TEST (TaskDoc §11.7): multiple running intervals coexist and close
 * independently; close-without-open FAILS CLOSED with the typed error;
 * the out-of-order guard rejects a stale overwrite attempt (and the state
 * stays unchanged).
 *
 * Documented model (run-log STEP 4): at most ONE open interval per
 * `(instanceId, subject, correlation)`; different correlations (and
 * different subjects) coexist simultaneously (UI Design §15: one bar per
 * open interval, multiple bars per lane). Interval facts NEVER change the
 * projected status (derived from progress facts only).
 */

import { describe, expect, it } from 'vitest'
import {
  P6T2_SEEDS,
  createP6T5Suite,
  destroyP6T1World,
  expectActivityRejection,
  nextSequence,
  p6t5Close,
  p6t5Open,
  p6t5Progress,
  rawActivityFacts,
  rawLedgerCount,
  teamProjection,
} from './p6t5-helpers.js'
import type { P6T5Suite } from './p6t5-helpers.js'

interface IntervalsResults {
 coexist: {
   openCorrelations: string[]
   statuses: { readonly build?: string; readonly deploy?: string }
   buildSequence: number
  }
 alreadyOpen: {
   code: string
   kind: string
   correlation: string
   openSinceSequence: number
  }
 closeWithoutOpen: { readonly code: string; readonly kind: string }
 closeFreshSubject: {
   code: string
   freshHeadAfter: number
  }
 reopened: {
   openCorrelations: string[]
   closedPairs: {
     correlation: string
     startedSequence: number
     closedSequence: number
     open: boolean
    }[]
  }
 finalBuild: {
   status?: string
   sequence: number
   openCount: number
   closedCount: number
   closedSorted: { readonly correlation: string; readonly closedSequence: number }[]
   startedBeforeClosed: boolean
  }
 staleAroundIntervals: {
   code: string
   kind: string
   claimed: number
   head: number
   expected: number
  }
 durableBuildRowCount: number
 durableDeployRowCount: number
 finalLedgerCount: number
 factTypesBuild: string[]
}

const results: IntervalsResults = {
  coexist: { openCorrelations: [], statuses: {}, buildSequence: 0 },
  alreadyOpen: { code: '', kind: '', correlation: '', openSinceSequence: 0 },
  closeWithoutOpen: { code: '', kind: '' },
  closeFreshSubject: { code: '', freshHeadAfter: 0 },
  reopened: { openCorrelations: [], closedPairs: [] },
  finalBuild: { sequence: 0, openCount: 0, closedCount: 0, closedSorted: [], startedBeforeClosed: false },
  staleAroundIntervals: { code: '', kind: '', claimed: 0, head: 0, expected: 0 },
  durableBuildRowCount: 0,
  durableDeployRowCount: 0,
  finalLedgerCount: 0,
  factTypesBuild: [],
}

const worker = P6T2_SEEDS.worker.instanceId
let suite: P6T5Suite

{
  suite = await createP6T5Suite('p6t5x-intervals', ['leader', 'worker'])
  try {
    const { world, ledger } = suite

    // subject 'build': progress first (seq 1), then the interval story
    await ledger.recordProgress(
      p6t5Progress({ subject: 'build', sequence: 1, progress: 'in-progress', requestToken: 'tok-p6t5-int-p1' }),
    )
    // MUST-TEST: multiple simultaneous running intervals (same subject,
    // different correlations)
    await ledger.openInterval(
      p6t5Open({ subject: 'build', sequence: 2, correlation: 'corr-1', note: 'phase one', requestToken: 'tok-p6t5-int-o1' }),
    )
    await ledger.openInterval(
      p6t5Open({ subject: 'build', sequence: 3, correlation: 'corr-2', requestToken: 'tok-p6t5-int-o2' }),
    )

    // a different SUBJECT with the same correlation string coexists too
    await ledger.openInterval(
      p6t5Open({ subject: 'deploy', sequence: 1, correlation: 'corr-1', requestToken: 'tok-p6t5-int-dep1' }),
    )

    const buildAfterCoexist =
      teamProjection(ledger, world).instances.find((i) => i.instanceId === worker)?.subjects.find(
        (s) => s.subject === 'build',
      )
    const deployAfterCoexist =
      teamProjection(ledger, world).instances.find((i) => i.instanceId === worker)?.subjects.find(
        (s) => s.subject === 'deploy',
      )
    results.coexist = {
      openCorrelations: (buildAfterCoexist?.openIntervals ?? []).map((row) => row.correlation),
      statuses: {
        build: buildAfterCoexist?.status,
        deploy: deployAfterCoexist?.status,
      },
      buildSequence: buildAfterCoexist?.sequence ?? 0,
    }

    // open-while-open → typed rejection (the triple already has an open bar)
    const alreadyOpen = await expectActivityRejection(
      ledger.openInterval(
        p6t5Open({ subject: 'build', sequence: 4, correlation: 'corr-1', requestToken: 'tok-p6t5-int-o3' }),
      ),
      'ACTIVITY_INTERVAL_ALREADY_OPEN',
    )
    results.alreadyOpen = {
      code: alreadyOpen.code,
      kind: String(alreadyOpen.details?.['kind']),
      correlation: String(alreadyOpen.details?.['correlation']),
      openSinceSequence: Number(alreadyOpen.details?.['openSinceSequence']),
    }

    // close one of the two (independent closes — the other stays open)
    await ledger.closeInterval(
      p6t5Close({ subject: 'build', sequence: 4, correlation: 'corr-1', closeNote: 'phase one done', requestToken: 'tok-p6t5-int-c1' }),
    )

    // MUST-TEST (negative): close-without-open FAILS CLOSED
    const closeWithoutOpen = await expectActivityRejection(
      ledger.closeInterval(
        p6t5Close({ subject: 'build', sequence: 5, correlation: 'corr-1', requestToken: 'tok-p6t5-int-c2' }),
      ),
      'ACTIVITY_INTERVAL_NOT_OPEN',
    )
    results.closeWithoutOpen = {
      code: closeWithoutOpen.code,
      kind: String(closeWithoutOpen.details?.['kind']),
    }

    // MUST-TEST (negative): close on a subject that never opened one
    const closeFresh = await expectActivityRejection(
      ledger.closeInterval(
        p6t5Close({ subject: 'fresh', sequence: 1, correlation: 'corr-9', requestToken: 'tok-p6t5-int-c3' }),
      ),
      'ACTIVITY_INTERVAL_NOT_OPEN',
    )
    results.closeFreshSubject = {
      code: closeFresh.code,
      freshHeadAfter: nextSequence(ledger, worker, 'fresh') - 1,
    }

    // re-open the same correlation after its close (a new work unit)
    await ledger.openInterval(
      p6t5Open({ subject: 'build', sequence: 5, correlation: 'corr-1', note: 'phase two', requestToken: 'tok-p6t5-int-o4' }),
    )
    // close both remaining open intervals (independently)
    await ledger.closeInterval(
      p6t5Close({ subject: 'build', sequence: 6, correlation: 'corr-2', requestToken: 'tok-p6t5-int-c4' }),
    )
    await ledger.closeInterval(
      p6t5Close({ subject: 'build', sequence: 7, correlation: 'corr-1', closeNote: 'phase two done', requestToken: 'tok-p6t5-int-c5' }),
    )

    const reopenedBuild =
      teamProjection(ledger, world).instances.find((i) => i.instanceId === worker)?.subjects.find(
        (s) => s.subject === 'build',
      )
    results.reopened = {
      openCorrelations: (reopenedBuild?.openIntervals ?? []).map((row) => row.correlation),
      closedPairs: (reopenedBuild?.closedIntervals ?? []).map((row) => ({
        correlation: row.correlation,
        startedSequence: row.startedSequence,
        closedSequence: row.closedSequence ?? 0,
        open: row.open,
      })),
    }

    // MUST-TEST: the out-of-order guard around interval operations
    const stale = await expectActivityRejection(
      ledger.openInterval(
        p6t5Open({ subject: 'build', sequence: 4, correlation: 'corr-x', requestToken: 'tok-p6t5-int-stale' }),
      ),
      'ACTIVITY_SEQUENCE_STALE',
    )
    results.staleAroundIntervals = {
      code: stale.code,
      kind: String(stale.details?.['kind']),
      claimed: Number(stale.details?.['claimed']),
      head: Number(stale.details?.['head']),
      expected: Number(stale.details?.['expected']),
    }

    // the final state of subject 'build'
    const finalBuild =
      teamProjection(ledger, world).instances.find((i) => i.instanceId === worker)?.subjects.find(
        (s) => s.subject === 'build',
      )
    const closedSorted = (finalBuild?.closedIntervals ?? []).map((row) => ({
      correlation: row.correlation,
      closedSequence: row.closedSequence ?? 0,
    }))
    const firstPair = finalBuild?.closedIntervals[0]
    results.finalBuild = {
      status: finalBuild?.status,
      sequence: finalBuild?.sequence ?? 0,
      openCount: (finalBuild?.openIntervals ?? []).length,
      closedCount: (finalBuild?.closedIntervals ?? []).length,
      closedSorted,
      startedBeforeClosed:
        firstPair !== undefined &&
        firstPair.closedAt !== undefined &&
        firstPair.startedAt < firstPair.closedAt,
    }

    // the durable row families
    results.durableBuildRowCount = rawActivityFacts(world).filter(
      (entry) =>
        String(entry.payload['instanceId']) === worker && String(entry.payload['subject']) === 'build',
    ).length
    results.durableDeployRowCount = rawActivityFacts(world).filter(
      (entry) =>
        String(entry.payload['instanceId']) === worker && String(entry.payload['subject']) === 'deploy',
    ).length
    results.factTypesBuild = rawActivityFacts(world)
      .filter(
        (entry) =>
          String(entry.payload['instanceId']) === worker && String(entry.payload['subject']) === 'build',
      )
      .map((entry) => entry.factType)
    results.finalLedgerCount = rawLedgerCount(world)
  } finally {
    await destroyP6T1World(suite.world)
  }
}

describe('P6-T5 RUNNING intervals (coexist, close independently, fail closed)', () => {
  it('allows multiple simultaneous running intervals (same subject, different correlations)', () => {
    expect(results.coexist.openCorrelations).toEqual(['corr-1', 'corr-2'])
    // interval facts never change the projected status (still the seq-1 progress)
    expect(results.coexist.statuses.build).toBe('in-progress')
    // a subject with only interval facts has NO status
    expect(results.coexist.statuses.deploy).toBe(undefined)
    expect(results.coexist.buildSequence).toBe(3)
  })

  it('allows the same correlation on a different subject (correlations are per-subject)', () => {
    // the deploy subject opened corr-1 while build's corr-1 was open too
    expect(results.durableDeployRowCount).toBe(1)
  })

  it('rejects open-while-open with the typed code (one open bar per triple)', () => {
    expect(results.alreadyOpen.code).toBe('ACTIVITY_INTERVAL_ALREADY_OPEN')
    expect(results.alreadyOpen.kind).toBe('already-open')
    expect(results.alreadyOpen.correlation).toBe('corr-1')
    expect(results.alreadyOpen.openSinceSequence).toBe(2)
  })

  it('FAILS CLOSED on close-without-open (typed code)', () => {
    expect(results.closeWithoutOpen.code).toBe('ACTIVITY_INTERVAL_NOT_OPEN')
    expect(results.closeWithoutOpen.kind).toBe('no-open-interval')
  })

  it('FAILS CLOSED on close for a subject that never opened the correlation (head untouched)', () => {
    expect(results.closeFreshSubject.code).toBe('ACTIVITY_INTERVAL_NOT_OPEN')
    expect(results.closeFreshSubject.freshHeadAfter).toBe(0)
  })

  it('re-opens the same correlation after its close and keeps both closed pairs', () => {
    expect(results.reopened.openCorrelations).toEqual([])
    expect(results.reopened.closedPairs).toEqual([
      { correlation: 'corr-1', startedSequence: 2, closedSequence: 4, open: false },
      { correlation: 'corr-2', startedSequence: 3, closedSequence: 6, open: false },
      { correlation: 'corr-1', startedSequence: 5, closedSequence: 7, open: false },
    ])
  })

  it('keeps the projected status unchanged by interval facts and orders closed pairs by sequence', () => {
    expect(results.finalBuild.status).toBe('in-progress')
    expect(results.finalBuild.sequence).toBe(7)
    expect(results.finalBuild.openCount).toBe(0)
    expect(results.finalBuild.closedCount).toBe(3)
    expect(results.finalBuild.closedSorted).toEqual([
      { correlation: 'corr-1', closedSequence: 4 },
      { correlation: 'corr-2', closedSequence: 6 },
      { correlation: 'corr-1', closedSequence: 7 },
    ])
    expect(results.finalBuild.startedBeforeClosed).toBe(true)
  })

  it('rejects a stale claim around interval operations (REJECT policy, state unchanged)', () => {
    expect(results.staleAroundIntervals.code).toBe('ACTIVITY_SEQUENCE_STALE')
    expect(results.staleAroundIntervals.kind).toBe('stale')
    expect(results.staleAroundIntervals.claimed).toBe(4)
    expect(results.staleAroundIntervals.head).toBe(7)
    expect(results.staleAroundIntervals.expected).toBe(8)
  })

  it('keeps the durable row families (7 build rows + 1 deploy row) and the full audit trail', () => {
    expect(results.durableBuildRowCount).toBe(7)
    expect(results.durableDeployRowCount).toBe(1)
    expect(results.factTypesBuild).toEqual([
      'activity-progress-recorded',
      'activity-interval-opened',
      'activity-interval-opened',
      'activity-interval-closed',
      'activity-interval-opened',
      'activity-interval-closed',
      'activity-interval-closed',
    ])
    // 8 activity rows + 12 facade audit facts (one per authorized
    // report-progress attempt — including the guard-rejected ones: the
    // audit evidence is kept, the structured row is not — documented)
    expect(results.finalLedgerCount).toBe(20)
  })
})
