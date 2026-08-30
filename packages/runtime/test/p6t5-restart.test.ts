/**
 * P6-T5 — restart: recovery from the durable state ONLY.
 *
 * MUST-TEST (TaskDoc §11.7): re-instantiate the runtime + ledger and
 * re-open the repositories on the same durable store (the P6-T1 restart
 * seam). Recovery reads the durable activity rows and the durable
 * TeamLedger counter; the in-memory per-team lock map is fresh and empty.
 * An interval that was OPEN before the restart STAYS OPEN until it is
 * explicitly closed after the restart — the close at head+1 succeeds
 * (a close-without-open would have failed closed), and the closed pair
 * shows the pre-restart `startedAt` label plus the post-restart `closedAt`
 * label.
 *
 * Documented label semantics: the projection timestamps are DISPLAY
 * labels written by each fact's own clock. The test clock resets on
 * restart (a fresh process has a fresh label source), so a pair that
 * spans the restart can show a post-restart label that sorts BEFORE the
 * pre-restart one — the durable ORDER is always the global sequence,
 * never the labels.
 */

import { describe, expect, it } from 'vitest'
import type { ActivityFactRow, ActivityLedger } from '../activity/index.js'
import {
  P6T2_SEEDS,
  activityRows,
  createP6T5Suite,
  destroyP6T1World,
  nextSequence,
  p6t5Close,
  p6t5Open,
  p6t5Progress,
  rawAuditFacts,
  rawLedgerCount,
  restartP6T5Suite,
  teamProjection,
} from './p6t5-helpers.js'
import type { P6T1World, P6T5Suite } from './p6t5-helpers.js'

interface RowSnapshot {
 globalSequence: number
 factType: string
 subject: string
 op: string
 sequence: number
 progress: string
}

interface Snapshot {
 rows: RowSnapshot[]
 buildStatus?: string
 buildSequence: number
 openCorrelations: string[]
 openStartedAt?: string
 closedPairs: {
   correlation: string
   startedSequence: number
   closedSequence: number
   startedAt: string
   closedAt: string
  }[]
 deployStatus?: string
 ledgerCount: number
 auditCount: number
}

interface RestartResults {
 pre: Snapshot
 post: Snapshot
 postNextSeq: number
 closeAfterRestart: {
   closedRow: { readonly sequence: number; readonly globalSequence: number }
   openCorrelations: string[]
   corr1Pair: {
     startedSequence: number
     closedSequence: number
     startedAt: string
     closedAt: string
     open: boolean
    }
   corr2Pair: {
     startedAt: string
     closedAt: string
    }
   buildSequence: number
  }
 postClose: { readonly ledgerCount: number; readonly auditCount: number }
}

function snapshot(ledger: ActivityLedger, world: P6T1World, worker: string): Snapshot {
  const rows: RowSnapshot[] = activityRows(ledger).map((row: ActivityFactRow) => ({
    globalSequence: row.globalSequence,
    factType: row.factType,
    subject: row.subject,
    op: row.op,
    sequence: row.sequence,
    progress: row.progress,
  }))
  const lane = teamProjection(ledger, world).instances.find((entry) => entry.instanceId === worker)
  const build = lane?.subjects.find((entry) => entry.subject === 'build')
  const deploy = lane?.subjects.find((entry) => entry.subject === 'deploy')
  return {
    rows,
    buildStatus: build?.status,
    buildSequence: build?.sequence ?? 0,
    openCorrelations: (build?.openIntervals ?? []).map((row) => row.correlation),
    openStartedAt: build?.openIntervals[0]?.startedAt,
    closedPairs: (build?.closedIntervals ?? []).map((row) => ({
      correlation: row.correlation,
      startedSequence: row.startedSequence,
      closedSequence: row.closedSequence ?? 0,
      startedAt: row.startedAt,
      closedAt: row.closedAt ?? '',
    })),
    deployStatus: deploy?.status,
    ledgerCount: rawLedgerCount(world),
    auditCount: rawAuditFacts(world).length,
  }
}

const results: RestartResults = {
  pre: { rows: [], buildSequence: 0, openCorrelations: [], closedPairs: [], ledgerCount: 0, auditCount: 0 },
  post: { rows: [], buildSequence: 0, openCorrelations: [], closedPairs: [], ledgerCount: 0, auditCount: 0 },
  postNextSeq: 0,
  closeAfterRestart: {
    closedRow: { sequence: 0, globalSequence: 0 },
    openCorrelations: [],
    corr1Pair: { startedSequence: 0, closedSequence: 0, startedAt: '', closedAt: '', open: true },
    corr2Pair: { startedAt: '', closedAt: '' },
    buildSequence: 0,
  },
  postClose: { ledgerCount: 0, auditCount: 0 },
}

const worker = P6T2_SEEDS.worker.instanceId
let suite: P6T5Suite

{
  suite = await createP6T5Suite('p6t5x-restart', ['leader', 'worker'])
  try {
    const { world, ledger } = suite

    // pre-restate writes: progress, an interval that STAYS OPEN (corr-1),
    // and a closed pair (corr-2), plus a second subject
    await ledger.recordProgress(
      p6t5Progress({ progress: 'in-progress', summary: 'starting the build', requestToken: 'tok-p6t5-re-r1' }),
    )
    await ledger.openInterval(
      p6t5Open({ sequence: 2, correlation: 'corr-1', requestToken: 'tok-p6t5-re-o1' }),
    )
    await ledger.openInterval(
      p6t5Open({ sequence: 3, correlation: 'corr-2', requestToken: 'tok-p6t5-re-o2' }),
    )
    await ledger.closeInterval(
      p6t5Close({ sequence: 4, correlation: 'corr-2', closeNote: 'done early', requestToken: 'tok-p6t5-re-c1' }),
    )
    await ledger.recordProgress(
      p6t5Progress({ subject: 'deploy', progress: 'blocked', requestToken: 'tok-p6t5-re-d1' }),
    )

    results.pre = snapshot(ledger, world, worker)

    // RESTART: re-open the repositories on the same durable store,
    // re-instantiate the runtime + the ledger (fresh clocks, fresh locks)
    suite = await restartP6T5Suite(suite)
    const { world: world2, ledger: ledger2 } = suite

    // recovery from the durable state ONLY — no in-memory state survived
    results.post = snapshot(ledger2, world2, worker)
    results.postNextSeq = nextSequence(ledger2, worker, 'build')

    // MUST-TEST: the pre-restart OPEN interval is still open — the close
    // at head+1 succeeds (it would fail closed if the open state were lost)
    const closedRow = await ledger2.closeInterval(
      p6t5Close({ sequence: 5, correlation: 'corr-1', closeNote: 'closed after restart', requestToken: 'tok-p6t5-re-c2' }),
    )
    const laneAfter = teamProjection(ledger2, world2).instances.find((entry) => entry.instanceId === worker)
    const buildAfter = laneAfter?.subjects.find((entry) => entry.subject === 'build')
    const corr1Pair = (buildAfter?.closedIntervals ?? []).find((row) => row.correlation === 'corr-1')
    const corr2Pair = (buildAfter?.closedIntervals ?? []).find((row) => row.correlation === 'corr-2')
    results.closeAfterRestart = {
      closedRow: { sequence: closedRow.sequence, globalSequence: closedRow.globalSequence },
      openCorrelations: (buildAfter?.openIntervals ?? []).map((row) => row.correlation),
      corr1Pair: {
        startedSequence: corr1Pair?.startedSequence ?? 0,
        closedSequence: corr1Pair?.closedSequence ?? 0,
        startedAt: corr1Pair?.startedAt ?? '',
        closedAt: corr1Pair?.closedAt ?? '',
        open: corr1Pair?.open ?? true,
      },
      corr2Pair: {
        startedAt: corr2Pair?.startedAt ?? '',
        closedAt: corr2Pair?.closedAt ?? '',
      },
      buildSequence: buildAfter?.sequence ?? 0,
    }
    results.postClose = {
      ledgerCount: rawLedgerCount(world2),
      auditCount: rawAuditFacts(world2).length,
    }
  } finally {
    await destroyP6T1World(suite.world)
  }
}

describe('P6-T5 restart (recovery from the durable state only)', () => {
  it('restores every durable row byte-for-byte (globalSequences included)', () => {
    expect(results.post.rows).toEqual(results.pre.rows)
    // 5 pre-restart activity rows: build(progress, open c1, open c2, close c2) + deploy(progress)
    expect(results.pre.rows.length).toBe(5)
    // (each durable audit fact precedes its activity row: globals 2,4,6,8,10)
    expect(results.pre.rows.map((row) => row.globalSequence)).toEqual([2, 4, 6, 8, 10])
    expect(results.pre.rows.map((row) => row.factType)).toEqual([
      'activity-progress-recorded',
      'activity-interval-opened',
      'activity-interval-opened',
      'activity-interval-closed',
      'activity-progress-recorded',
    ])
  })

  it('restores the projection (status, head, the open interval, the closed pair)', () => {
    expect(results.post.buildStatus).toBe('in-progress')
    expect(results.post.buildSequence).toBe(4)
    expect(results.post.openCorrelations).toEqual(['corr-1'])
    expect(results.post.openStartedAt).toBe('2026-08-31T12:00:02.000Z')
    expect(results.post.closedPairs).toEqual([
      {
        correlation: 'corr-2',
        startedSequence: 3,
        closedSequence: 4,
        startedAt: '2026-08-31T12:00:03.000Z',
        closedAt: '2026-08-31T12:00:04.000Z',
      },
    ])
    expect(results.post.deployStatus).toBe('blocked')
    expect(results.postNextSeq).toBe(5)
    // recovery read nothing: the durable counts are unchanged
    expect(results.post.ledgerCount).toBe(results.pre.ledgerCount)
    expect(results.post.auditCount).toBe(results.pre.auditCount)
    expect(results.pre.ledgerCount).toBe(10)
  })

  it('keeps a pre-restart OPEN interval open until explicitly closed after the restart', () => {
    // the close at head+1 succeeded (no ACTIVITY_INTERVAL_NOT_OPEN): the
    // open state survived the restart in the durable rows
    expect(results.closeAfterRestart.closedRow.sequence).toBe(5)
    expect(results.closeAfterRestart.openCorrelations).toEqual([])
    expect(results.closeAfterRestart.buildSequence).toBe(5)
    expect(results.closeAfterRestart.corr1Pair.open).toBe(false)
    expect(results.closeAfterRestart.corr1Pair.startedSequence).toBe(2)
    expect(results.closeAfterRestart.corr1Pair.closedSequence).toBe(5)
  })

  it('shows the pre-restart startedAt + post-restart closedAt on the spanning pair', () => {
    // the labels come from each fact's own clock (the display clock is a
    // fresh process on restart); the durable order is the global sequence
    expect(results.closeAfterRestart.corr1Pair.startedAt).toBe('2026-08-31T12:00:02.000Z')
    expect(results.closeAfterRestart.corr1Pair.closedAt).toBe('2026-08-31T12:00:01.000Z')
    // the fully pre-restart pair keeps both of its labels, in clock order
    expect(results.closeAfterRestart.corr2Pair.startedAt).toBe('2026-08-31T12:00:03.000Z')
    expect(results.closeAfterRestart.corr2Pair.closedAt).toBe('2026-08-31T12:00:04.000Z')
  })

  it('continues the durable TeamLedger global sequence (the counter survived)', () => {
    // 10 pre-restart entries (5 audit + 5 activity) → the post-restart
    // audit takes 11, the close row takes global sequence 12
    expect(results.closeAfterRestart.closedRow.globalSequence).toBe(12)
  })

  it('keeps the facade audit trail durable and growing', () => {
    expect(results.pre.auditCount).toBe(5)
    expect(results.postClose.auditCount).toBe(6)
    expect(results.postClose.ledgerCount).toBe(12)
  })
})
