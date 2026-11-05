/**
 * p7t7-integrated-lifecycle-restore.test.ts — P7-T7 G7 criteria 4 + 5
 * (DevPlan §20.7), integrated over the REAL P7-T3 lifecycle service
 * (TaskDoc §11.8 P7-T7: "fork/handoff/lifecycle/ACK integrated suite"):
 *
 * - criterion 4 (lifecycle quiescence): archiving a RUNNING member runs the
 *   full quiescence sequence — close admission, interrupt, DRAIN
 *   DESCENDANTS, WAIT QUIESCENCE — BEFORE releasing residency and before
 *   any commit; the member settles then archives, +2 activity, residency
 *   dropped. The transaction then ENDS with the row-6 post-commit
 *   residency re-drop and the admission reopen (2026-11-05); both are
 *   asserted by global-clock SEQUENCE, not merely by presence, because the
 *   defect this closes lives entirely in the ordering;
 * - criterion 5 (Restore does not create/resume Agent): restoring an
 *   ARCHIVED member commits exactly ONE durable step
 *   (`COMMIT_RESTORE`, ARCHIVED -> SETTLED, +1 activity) with ZERO live
 *   contact — no admission, no interrupt, no drain, no residency drop, and
 *   the resume-Agent/create-Agent probe surfaces are never touched;
 * - in BOTH scenarios the legacy home inspected by the P7-T7 reader is
 *   untouched (read-only isolation): identical inspection view before/
 *   after and a read-only port log.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are synchronous):
 * each scenario runs at module top level, its observables are captured
 * into a plain snapshot, the world is destroyed in `finally`; the `it`
 * bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/legacy/test/p7t7-integrated-lifecycle-restore
 */

import { describe, expect, it } from 'vitest'
import { LIFECYCLE_STEP_NAMES as S } from '../../runtime/lifecycle/index.js'
import { createLifecycleWorld, destroyWorld } from '../../runtime/test/p7t3-helpers.js'
import { destroyDir, scratchDir } from '../../testkit/fault-injection/file-seam.mjs'
import { inspectLegacyTeam } from '../session-reader/index.js'
import {
  P7T7_REQUEST,
  buildP7T7LegacyHome,
  homeTreeSnapshot,
  RecordingLegacyHomePort,
  viewJson,
} from './p7t7-helpers.js'

/** One isolated legacy-home fixture (reader view + recording port). */
function makeLegacyHome() {
  const tree = buildP7T7LegacyHome()
  const port = new RecordingLegacyHomePort(tree)
  return {
    tree,
    port,
    viewBefore: inspectLegacyTeam(port, P7T7_REQUEST),
    homeBefore: homeTreeSnapshot(tree),
  }
}

/** The full quiescence-first archive step sequence (frozen vocabulary). */
const ARCHIVE_RUNNING_STEPS: readonly string[] = [
  S.CLOSE_ADMISSION,
  S.INTERRUPT,
  S.DRAIN_DESCENDANTS,
  S.WAIT_QUIESCENCE,
  S.RELEASE_RESIDENCY,
  S.COMMIT_SETTLE,
  S.COMMIT_ARCHIVE,
]
/** The restore step sequence: exactly one durable commit, no live work. */
const RESTORE_STEPS: readonly string[] = [S.COMMIT_RESTORE]

// ---------------------------------------------------------------------------
// S4 — criterion 4: lifecycle quiescence (archive a RUNNING member)
// ---------------------------------------------------------------------------

const s4 = await (async () => {
  const home = makeLegacyHome()
  // Clear any leftover scratch dir from a crashed prior run: the seam is
  // DETERMINISTIC per basename and createTeamDomain refuses an existing domain.
  destroyDir(scratchDir('p7t7-lc-s4'))
  const world = await createLifecycleWorld('p7t7-lc-s4', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'RUNNING', resident: true }],
  })
  try {
    const target = world.target('p7t3-worker-a')
    const result = await world.service.archiveMember(target)
    const durable = world.recordFor('p7t3-worker-a')
    const steps = [...result.steps]
    const drainIdx = steps.indexOf(S.DRAIN_DESCENDANTS)
    const waitIdx = steps.indexOf(S.WAIT_QUIESCENCE)
    const firstCommitIdx = steps.findIndex((step) => step.startsWith('commit') || S.COMMIT_SETTLE === step)
    const viewAfter = inspectLegacyTeam(home.port, P7T7_REQUEST)
    home.port.assertOnlyReadOps()
    return {
      steps,
      drainBeforeWait: drainIdx !== -1 && waitIdx !== -1 && drainIdx < waitIdx,
      quiescenceBeforeCommit:
        waitIdx !== -1 &&
        firstCommitIdx !== -1 &&
        waitIdx < firstCommitIdx,
      settledCommitted: result.settledCommitted,
      residencyDropped: result.residencyDropped,
      drained: result.drained,
      resultLifecycle: result.member.lifecycle,
      resultAv: result.member.activityVersion,
      durableLifecycle: durable?.lifecycle ?? null,
      clockKinds: world.clock.kinds(),
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
      // Row 6 (2026-11-05): the ORDERING evidence, not just the step set — the
      // global clock assigns one monotonic seq to every effect, so these prove
      // WHEN the post-commit re-drop and the reopen ran. `seq` is -1 only if the
      // call is absent, which the assertions below then fail on by length.
      dropSeqs: world.residency.dropCalls.map((call) => call.seq),
      firstCommitSeq: world.commit.calls[0]?.seq ?? -1,
      lastCommitSeq: world.commit.calls[world.commit.calls.length - 1]?.seq ?? -1,
      reopenSeqs: world.admission.reopenCalls.map((call) => call.seq),
      viewIdentical: viewJson(viewAfter) === viewJson(home.viewBefore),
      homeIdentical: JSON.stringify(homeTreeSnapshot(home.tree)) === JSON.stringify(home.homeBefore),
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ---------------------------------------------------------------------------
// S5 — criterion 5: restore does not create/resume Agent
// ---------------------------------------------------------------------------

const s5 = await (async () => {
  const home = makeLegacyHome()
  destroyDir(scratchDir('p7t7-lc-s5'))
  const world = await createLifecycleWorld('p7t7-lc-s5', {
    seedMembers: [{ label: 'p7t3-worker-a', lifecycle: 'ARCHIVED' }],
  })
  try {
    const result = await world.service.restoreMember(world.target('p7t3-worker-a'))
    const durable = world.recordFor('p7t3-worker-a')
    const viewAfter = inspectLegacyTeam(home.port, P7T7_REQUEST)
    home.port.assertOnlyReadOps()
    return {
      steps: [...result.steps],
      resultLifecycle: result.member.lifecycle,
      resultAv: result.member.activityVersion,
      durableLifecycle: durable?.lifecycle ?? null,
      clockKinds: world.clock.kinds(),
      commitOps: world.commit.calls.map((c) => `${c.operation}:${c.from}->${c.to}`),
      admissionCalls: world.admission.calls.length,
      interruptCalls: world.activity.calls.length,
      drainCalls: world.descendants.calls.length,
      dropCalls: world.residency.dropCalls.length,
      // The p7t3 fakes expose NUMERIC call counters (not call arrays).
      resumeAgentCalls:
        world.admission.resumeAgentCalls +
        world.activity.resumeAgentCalls +
        world.descendants.resumeAgentCalls,
      createAgentCalls:
        world.admission.createAgentCalls +
        world.activity.createAgentCalls +
        world.descendants.createAgentCalls,
      viewIdentical: viewJson(viewAfter) === viewJson(home.viewBefore),
      homeIdentical: JSON.stringify(homeTreeSnapshot(home.tree)) === JSON.stringify(home.homeBefore),
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ===========================================================================
// Assertions
// ===========================================================================

describe('P7-T7 G7 criterion 4: lifecycle quiescence (integrated, P7-T3 real service)', () => {
  it('archiving RUNNING runs the full quiescence-first step sequence', () => {
    expect(s4.steps).toEqual([...ARCHIVE_RUNNING_STEPS])
  })
  it('descendants are drained and quiescence awaited BEFORE residency release / any commit', () => {
    expect(s4.drainBeforeWait).toBe(true)
    expect(s4.quiescenceBeforeCommit).toBe(true)
  })
  it('the member settles then archives; residency is dropped; +2 activity', () => {
    expect(s4.settledCommitted).toBe(true)
    expect(s4.residencyDropped).toBe(true)
    expect(s4.resultLifecycle).toBe('ARCHIVED')
    expect(s4.resultAv).toBe(3)
    expect(s4.durableLifecycle).toBe('ARCHIVED')
  })
  it('the live-contact and commit channels match the sequence', () => {
    expect(s4.clockKinds).toEqual([
      'admission.close',
      'activity.interrupt',
      'descendants.drain',
      'residency.drop',
      'commit',
      'commit',
      // Row 6 (2026-11-05): the transaction ENDS with the handle dropped
      // (the drop→commit window cannot carry a live handle past ARCHIVED)
      // and with admission reopened (the close is procedure-scoped).
      'residency.drop',
      'admission.reopen',
    ])
    expect(s4.commitOps).toEqual(['SETTLE:RUNNING->SETTLED', 'ARCHIVE:SETTLED->ARCHIVED'])
    expect(s4.admissionCalls).toBe(1)
    expect(s4.interruptCalls).toBe(1)
    expect(s4.drainCalls).toBe(1)
    // Two drops: step 5 (before the commits) and the row-6 re-drop (after
    // the last commit). The second is a no-op on the fake's map, which is
    // exactly why the SEQ assertion below — not the return value — is the
    // load-bearing one.
    expect(s4.dropCalls).toBe(2)
  })
  it('row 6: the post-commit re-drop and the admission reopen are ORDERED, not merely present', () => {
    // A step-set assertion says the effects happened. It does not say WHEN,
    // and the defect this closes lives entirely in the WHEN: a drop that
    // runs before the commit leaves the drop→commit window open. So this is
    // a global-clock seq assertion, and it goes red if the re-drop moves
    // back before the last durable commit.
    expect(s4.dropSeqs).toHaveLength(2)
    expect(s4.reopenSeqs).toHaveLength(1)
    const firstCommitSeq = s4.firstCommitSeq
    const lastCommitSeq = s4.lastCommitSeq
    const preCommitDropSeq = s4.dropSeqs[0] ?? -1
    const postCommitDropSeq = s4.dropSeqs[1] ?? -1
    // Step 5 still releases residency BEFORE any durable commit.
    expect(preCommitDropSeq).toBeLessThan(firstCommitSeq)
    // The re-drop follows the LAST durable commit (ARCHIVE->ARCHIVED)...
    expect(postCommitDropSeq).toBeGreaterThan(lastCommitSeq)
    // ...and the reopen closes the procedure after BOTH drops.
    expect(s4.reopenSeqs[0] ?? -1).toBeGreaterThan(postCommitDropSeq)
  })
  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(s4.viewIdentical).toBe(true)
    expect(s4.homeIdentical).toBe(true)
  })
})

describe('P7-T7 G7 criterion 5: restore does not create/resume Agent (integrated, P7-T3 real service)', () => {
  it('restoring ARCHIVED commits exactly [COMMIT_RESTORE] (ARCHIVED -> SETTLED, +1 activity)', () => {
    expect(s5.steps).toEqual([...RESTORE_STEPS])
    expect(s5.resultLifecycle).toBe('SETTLED')
    expect(s5.resultAv).toBe(2)
    expect(s5.durableLifecycle).toBe('SETTLED')
    expect(s5.commitOps).toEqual(['RESTORE:ARCHIVED->SETTLED'])
    expect(s5.clockKinds).toEqual(['commit'])
  })
  it('zero live contact: no admission, interrupt, drain, or residency drop', () => {
    expect(s5.admissionCalls).toBe(0)
    expect(s5.interruptCalls).toBe(0)
    expect(s5.drainCalls).toBe(0)
    expect(s5.dropCalls).toBe(0)
  })
  it('the resume-Agent / create-Agent probe surfaces are never touched', () => {
    expect(s5.resumeAgentCalls).toBe(0)
    expect(s5.createAgentCalls).toBe(0)
  })
  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(s5.viewIdentical).toBe(true)
    expect(s5.homeIdentical).toBe(true)
  })
})
