/**
 * P6-T5 — projection seeds: PURE deterministic functions from durable
 * activity rows to the UI-facing projection shape (no world, no I/O).
 *
 * MUST-TEST (TaskDoc §11.7): the projection seeds are pure and
 * deterministic — the same durable rows always yield the same projection,
 * regardless of input row order (ordering is ALWAYS the durable TeamLedger
 * global sequence, invariant 44); `createdAt` labels are display-only.
 * Status/summary/lastAction/correlation derive from the LATEST PROGRESS
 * fact only (interval facts never change the status — telemetry is not
 * workflow authority).
 */

import { describe, expect, it } from 'vitest'
import {
  OP_TO_FACT_TYPE,
  projectSubjectFromRows,
  projectTeamFromRows,
} from '../activity/index.js'
import type { ActivityFactRow, ActivityInstanceRef, ActivityOp, ProgressValue } from '../activity/index.js'

const ROOT = 'session-root-p6t1'
const INST_A = 'inst-p6t5purea01'
const INST_B = 'inst-p6t5pureb01'
const INST_C = 'inst-p6t5purec01'
const ROW_ONLY = 'inst-p6t5rowonly01'

/** One synthetic durable activity row (deterministic display labels). */
function makeRow(
  globalSequence: number,
  instanceId: string,
  subject: string,
  op: ActivityOp,
  sequence: number,
  progress: ProgressValue,
  extra: Partial<ActivityFactRow> = {},
): ActivityFactRow {
  return {
    globalSequence,
    factType: OP_TO_FACT_TYPE[op],
    rootSessionId: ROOT,
    instanceId,
    subject,
    sequence,
    op,
    progress,
    requestToken: `tok-p6t5-pure-${globalSequence}`,
    reportedByInstanceId: instanceId,
    createdAt: `t${globalSequence}`,
    ...extra,
  }
}

interface ProjectionResults {
 orderIndependent: {
   forward: unknown
   shuffled: unknown
  }
 grouping: {
   laneInstanceIds: string[]
   laneASubjects: string[]
   laneBSubjects: string[]
   rowOnlyLane: { readonly present: boolean; readonly hasLabel: boolean; readonly subjectCount: number }
   laneALabel?: string
   laneATemplateId?: string
  }
 latestProgressOnly: {
   status?: string
   summary?: string
   lastAction: boolean
   correlation: boolean
   lastProgressAt?: string
   lastFactAt?: string
   sequence: number
   openCorrelations: string[]
  }
 intervalOnly: { readonly status: boolean; readonly sequence: number }
 orphanClose: {
   openCorrelations: string[]
   closedCount: number
   sequence: number
  }
 sameCorrelationPairs: {
   pairs: { readonly correlation: string; readonly startedSequence: number; readonly closedSequence: number }[]
  }
 emptyRows: {
   laneCount: number
   allSubjectsEmpty: boolean
   unknownSubject: boolean
  }
}

const results: ProjectionResults = {
  orderIndependent: { forward: undefined, shuffled: undefined },
  grouping: { laneInstanceIds: [], laneASubjects: [], laneBSubjects: [], rowOnlyLane: { present: false, hasLabel: false, subjectCount: 0 } },
  latestProgressOnly: { lastAction: true, correlation: true, sequence: 0, openCorrelations: [] },
  intervalOnly: { status: true, sequence: 0 },
  orphanClose: { openCorrelations: [], closedCount: 0, sequence: 0 },
  sameCorrelationPairs: { pairs: [] },
  emptyRows: { laneCount: 0, allSubjectsEmpty: true, unknownSubject: false },
}

{
  // --- scenario 1+2: two instances, two subjects, mixed ops -----------------
  const rowsA: ActivityFactRow[] = [
    makeRow(1, INST_A, 'build', 'progress', 1, 'in-progress', { summary: 'A1', lastAction: 'a1', correlation: 'corr-a' }),
    makeRow(2, INST_A, 'build', 'interval-open', 2, 'in-progress', { correlation: 'corr-x', note: 'n2' }),
    makeRow(3, INST_A, 'deploy', 'progress', 1, 'blocked', { summary: 'B1' }),
    makeRow(4, INST_A, 'build', 'progress', 3, 'blocked', { summary: 'A2' }),
    makeRow(5, INST_A, 'build', 'interval-close', 4, 'completed', { correlation: 'corr-x', closeNote: 'c5' }),
  ]
  const rowsB: ActivityFactRow[] = [
    makeRow(6, INST_B, 'scout', 'progress', 1, 'in-progress'),
    makeRow(7, INST_B, 'scout', 'interval-open', 2, 'in-progress', { correlation: 'corr-y' }),
  ]
  const allRows = [...rowsA, ...rowsB]

  // scenario 1: input-order independence (shuffled input → identical output)
  const forward = projectTeamFromRows(allRows, [], ROOT)
  const shuffled = projectTeamFromRows(
    [allRows[4]!, allRows[1]!, allRows[6]!, allRows[0]!, allRows[5]!, allRows[3]!, allRows[2]!],
    [],
    ROOT,
  )
  results.orderIndependent = { forward, shuffled }

  // scenario 2: multi-instance / multi-subject grouping + lane metadata
  const refs: ActivityInstanceRef[] = [
    { instanceId: INST_A, label: 'lane-a', templateId: 'worker' },
    { instanceId: INST_B },
    { instanceId: ROW_ONLY },
  ]
  const grouped = projectTeamFromRows(allRows, refs, ROOT)
  const laneA = grouped.instances.find((entry) => entry.instanceId === INST_A)
  const laneB = grouped.instances.find((entry) => entry.instanceId === INST_B)
  const laneRowOnly = grouped.instances.find((entry) => entry.instanceId === ROW_ONLY)
  results.grouping = {
    laneInstanceIds: grouped.instances.map((entry) => entry.instanceId),
    laneASubjects: (laneA?.subjects ?? []).map((entry) => entry.subject),
    laneBSubjects: (laneB?.subjects ?? []).map((entry) => entry.subject),
    rowOnlyLane: {
      present: laneRowOnly !== undefined,
      hasLabel: laneRowOnly?.label !== undefined,
      subjectCount: (laneRowOnly?.subjects ?? []).length,
    },
    laneALabel: laneA?.label,
    laneATemplateId: laneA?.templateId,
  }

  // scenario 3: status/summary/lastAction/correlation from the LATEST
  // progress fact only — the interval facts carry a 'completed' payload
  // value that must NOT leak into the projected status
  const statusRows: ActivityFactRow[] = [
    makeRow(1, INST_A, 's', 'progress', 1, 'in-progress', { summary: 'early', lastAction: 'early-action', correlation: 'corr-early' }),
    makeRow(2, INST_A, 's', 'interval-open', 2, 'completed', { correlation: 'corr-mid', note: 'mid' }),
    makeRow(3, INST_A, 's', 'progress', 3, 'blocked', { summary: 'late' }),
  ]
  const statusSubject = projectSubjectFromRows(statusRows, INST_A, 's')
  results.latestProgressOnly = {
    status: statusSubject?.status,
    summary: statusSubject?.summary,
    lastAction: statusSubject !== undefined && 'lastAction' in statusSubject,
    correlation: statusSubject !== undefined && 'correlation' in statusSubject,
    lastProgressAt: statusSubject?.lastProgressAt,
    lastFactAt: statusSubject?.lastFactAt,
    sequence: statusSubject?.sequence ?? 0,
    openCorrelations: (statusSubject?.openIntervals ?? []).map((row) => row.correlation),
  }

  // scenario 4: an interval-only subject has NO status but a real head
  const intervalOnlySubject = projectSubjectFromRows(
    [
      makeRow(1, INST_B, 'quiet', 'interval-open', 1, 'in-progress', { correlation: 'corr-q' }),
      makeRow(2, INST_B, 'quiet', 'interval-close', 2, 'completed', { correlation: 'corr-q' }),
    ],
    INST_B,
    'quiet',
  )
  results.intervalOnly = {
    status: intervalOnlySubject !== undefined && 'status' in intervalOnlySubject,
    sequence: intervalOnlySubject?.sequence ?? 0,
  }

  // scenario 5: an orphan close (unreachable through the guarded write
  // path — the fold must still ignore it deterministically)
  const orphanSubject = projectSubjectFromRows(
    [
      makeRow(1, INST_B, 'orphan', 'interval-close', 1, 'completed', { correlation: 'corr-z' }),
      makeRow(2, INST_B, 'orphan', 'interval-open', 2, 'in-progress', { correlation: 'corr-z' }),
    ],
    INST_B,
    'orphan',
  )
  results.orphanClose = {
    openCorrelations: (orphanSubject?.openIntervals ?? []).map((row) => row.correlation),
    closedCount: (orphanSubject?.closedIntervals ?? []).length,
    sequence: orphanSubject?.sequence ?? 0,
  }

  // scenario 6: multiple closed pairs for the SAME correlation, sorted by
  // closedSequence (then correlation)
  const pairsSubject = projectSubjectFromRows(
    [
      makeRow(1, INST_C, 'pairs', 'interval-open', 1, 'in-progress', { correlation: 'corr-1' }),
      makeRow(2, INST_C, 'pairs', 'interval-close', 2, 'completed', { correlation: 'corr-1' }),
      makeRow(3, INST_C, 'pairs', 'interval-open', 3, 'in-progress', { correlation: 'corr-1' }),
      makeRow(4, INST_C, 'pairs', 'interval-close', 4, 'completed', { correlation: 'corr-1' }),
      makeRow(5, INST_C, 'pairs', 'interval-open', 5, 'in-progress', { correlation: 'corr-2' }),
      makeRow(6, INST_C, 'pairs', 'interval-close', 6, 'completed', { correlation: 'corr-2' }),
    ],
    INST_C,
    'pairs',
  )
  results.sameCorrelationPairs = {
    pairs: (pairsSubject?.closedIntervals ?? []).map((row) => ({
      correlation: row.correlation,
      startedSequence: row.startedSequence,
      closedSequence: row.closedSequence ?? 0,
    })),
  }

  // scenario 7: empty rows — lanes persist, unknown subjects are undefined
  const emptyTeam = projectTeamFromRows([], refs, ROOT)
  results.emptyRows = {
    laneCount: emptyTeam.instances.length,
    allSubjectsEmpty: emptyTeam.instances.every((entry) => (entry.subjects ?? []).length === 0),
    unknownSubject: projectSubjectFromRows([], INST_A, 'nothing') === undefined,
  }
}

describe('P6-T5 projection seeds (pure, deterministic)', () => {
  it('is independent of the input row order (ordering is the durable sequence)', () => {
    expect(results.orderIndependent.shuffled).toEqual(results.orderIndependent.forward)
  })

  it('groups by instance lane and subject (one lane per member, sorted)', () => {
    expect(results.grouping.laneInstanceIds).toEqual([INST_A, INST_B, ROW_ONLY])
    expect(results.grouping.laneASubjects).toEqual(['build', 'deploy'])
    expect(results.grouping.laneBSubjects).toEqual(['scout'])
  })

  it('labels lanes from the member metadata; a row-only instance renders unlabeled', () => {
    expect(results.grouping.laneALabel).toBe('lane-a')
    expect(results.grouping.laneATemplateId).toBe('worker')
    expect(results.grouping.rowOnlyLane.present).toBe(true)
    expect(results.grouping.rowOnlyLane.hasLabel).toBe(false)
    expect(results.grouping.rowOnlyLane.subjectCount).toBe(0)
  })

  it('derives status/summary/correlation from the LATEST progress fact only', () => {
    // the interval fact's 'completed' payload value never becomes the status
    expect(results.latestProgressOnly.status).toBe('blocked')
    expect(results.latestProgressOnly.summary).toBe('late')
    // the latest progress fact carries no lastAction/correlation → absent
    expect(results.latestProgressOnly.lastAction).toBe(false)
    expect(results.latestProgressOnly.correlation).toBe(false)
    expect(results.latestProgressOnly.lastProgressAt).toBe('t3')
    expect(results.latestProgressOnly.lastFactAt).toBe('t3')
    expect(results.latestProgressOnly.sequence).toBe(3)
    expect(results.latestProgressOnly.openCorrelations).toEqual(['corr-mid'])
  })

  it('projects an interval-only subject without a status (telemetry is not authority)', () => {
    expect(results.intervalOnly.status).toBe(false)
    expect(results.intervalOnly.sequence).toBe(2)
  })

  it('ignores an orphan close in the fold (unreachable via the guarded path)', () => {
    expect(results.orphanClose.openCorrelations).toEqual(['corr-z'])
    expect(results.orphanClose.closedCount).toBe(0)
    expect(results.orphanClose.sequence).toBe(2)
  })

  it('keeps multiple closed pairs of the same correlation, sorted by closedSequence', () => {
    expect(results.sameCorrelationPairs.pairs).toEqual([
      { correlation: 'corr-1', startedSequence: 1, closedSequence: 2 },
      { correlation: 'corr-1', startedSequence: 3, closedSequence: 4 },
      { correlation: 'corr-2', startedSequence: 5, closedSequence: 6 },
    ])
  })

  it('keeps a lane per member on empty rows and leaves unknown subjects unprojected', () => {
    expect(results.emptyRows.laneCount).toBe(3)
    expect(results.emptyRows.allSubjectsEmpty).toBe(true)
    expect(results.emptyRows.unknownSubject).toBe(true)
  })
})
