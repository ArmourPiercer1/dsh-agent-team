/**
 * p4t3-reconciler — bidirectional SessionBinding integrity (TaskDoc §11.5
 * P4-T3; Architecture §15.3; Development Plan §17.3/§17.4).
 *
 * Every scenario starts from a fresh, fully consistent healthy team and
 * corrupts exactly one relationship through the P4-T1 repositories (the
 * repositories write any parseable record — the cross-record rules are
 * P4-T3's job, which is what the report must expose). The reconciler is
 * read-only: it names each violation with a stable code and never rewrites
 * anything (fail closed, never guess which side is right).
 *
 * Must-test matrix (task card):
 *
 * - **missing child** (committed MemberInstance, no committed
 *   SessionBinding)  -> `missing-member-binding`;
 * - **duplicate binding** (same child claimed by two records; the
 *   creation-time `RECORD_DUPLICATE` lives in the binding-service test)
 *   -> `duplicate-child-claim` (+ the instance conflict it implies);
 * - **wrong root** (child bound under a different team root, or team
 *   artifacts under a root with no TeamSession)
 *   -> `child-bound-to-other-root` / `team-session-missing`;
 * - the remaining codes cover the rest of the bidirectional pair
 *   (`orphan-member-binding`, `member-child-mismatch`,
 *   `child-bound-to-other-instance`, `binding-kind-conflict`,
 *   `missing-root-binding`, `root-binding-kind-conflict`).
 *
 * @module @dsh-agent-team/storage/test/p4t3-reconciler
 */

import { describe, expect, it } from 'vitest'

import { parseInstanceId } from '../../contracts/src/index.js'
import { reconcileTeamBindings } from '../bindings/index.js'
import { asTeamDomainError, capture, detail, memberInstanceInput, ordinaryBinding, teamMemberBinding } from './p4-helpers.js'
import { addSecondTeam, codesOf, createHealthyTeam, findDiagnostic } from './p4t3-helpers.js'

// --- S0: healthy baseline (determinism, read-only proof) -------------------
const baseline = await createHealthyTeam()
const baselineWritesBefore = baseline.seam.writeLog.length
const baselineReport = reconcileTeamBindings(baseline.repositories, String(baseline.root))
const baselineReportAgain = reconcileTeamBindings(baseline.repositories, String(baseline.root))
const baselineWritesAfter = baseline.seam.writeLog.length

// --- S1: missing child (record committed, binding row absent) --------------
const s1 = await createHealthyTeam()
await s1.repositories.sessionBindings.delete(String(s1.memberChild))
const s1Report = reconcileTeamBindings(s1.repositories, String(s1.root))

// --- S2: orphan (binding committed, record absent) --------------------------
const s2 = await createHealthyTeam()
await s2.repositories.memberInstances.delete(String(s2.root), String(s2.instance))
const s2Report = reconcileTeamBindings(s2.repositories, String(s2.root))

// --- S3: both fault windows at once (two members, each broken one way) -----
const s3 = await createHealthyTeam()
await s3.repositories.memberInstances.put(memberInstanceInput(s3.root, s3.secondInstance, s3.secondChild))
await s3.repositories.sessionBindings.put(
  teamMemberBinding(String(s3.root), String(s3.secondInstance), String(s3.secondChild)),
)
await s3.repositories.sessionBindings.delete(String(s3.secondChild))
await s3.repositories.memberInstances.delete(String(s3.root), String(s3.instance))
const s3Report = reconcileTeamBindings(s3.repositories, String(s3.root))

// --- S4: wrong root — the child bound to a different existing team ---------
const s4 = await createHealthyTeam()
await addSecondTeam(s4)
await s4.repositories.sessionBindings.delete(String(s4.memberChild))
await s4.repositories.sessionBindings.put(
  teamMemberBinding(String(s4.otherRoot), String(s4.instance), String(s4.memberChild)),
)
const s4ReportRoot = reconcileTeamBindings(s4.repositories, String(s4.root))
const s4ReportOther = reconcileTeamBindings(s4.repositories, String(s4.otherRoot))

// --- S5: wrong root — team artifacts under a root with no TeamSession ------
const s5 = await createHealthyTeam()
await s5.repositories.sessionBindings.delete(String(s5.memberChild))
await s5.repositories.sessionBindings.put(
  teamMemberBinding(s5.forkedRootSession, String(s5.instance), String(s5.memberChild)),
)
const s5ReportRoot = reconcileTeamBindings(s5.repositories, String(s5.root))
const s5ReportFork = reconcileTeamBindings(s5.repositories, s5.forkedRootSession)

// --- S6: instance swap (beta bound to both children, alpha unbound) --------
const s6 = await createHealthyTeam()
await s6.repositories.memberInstances.put(memberInstanceInput(s6.root, s6.secondInstance, s6.secondChild))
await s6.repositories.sessionBindings.put(
  teamMemberBinding(String(s6.root), String(s6.secondInstance), String(s6.secondChild)),
)
await s6.repositories.sessionBindings.delete(String(s6.memberChild))
await s6.repositories.sessionBindings.put(
  teamMemberBinding(String(s6.root), String(s6.secondInstance), String(s6.memberChild)),
)
const s6Report = reconcileTeamBindings(s6.repositories, String(s6.root))

// --- S7: child mismatch (binding points elsewhere, record's child unbound) -
const s7 = await createHealthyTeam()
await s7.repositories.sessionBindings.delete(String(s7.memberChild))
await s7.repositories.sessionBindings.put(
  teamMemberBinding(String(s7.root), String(s7.instance), String(s7.secondChild)),
)
const s7Report = reconcileTeamBindings(s7.repositories, String(s7.root))

// --- S8: duplicate child claim (two records, one child) --------------------
const s8 = await createHealthyTeam()
const s8GammaInstance = parseInstanceId('inst-gamma')
await s8.repositories.memberInstances.put(memberInstanceInput(s8.root, s8GammaInstance, s8.memberChild))
const s8Report = reconcileTeamBindings(s8.repositories, String(s8.root))

// --- S9: missing root binding -----------------------------------------------
const s9 = await createHealthyTeam()
await s9.repositories.sessionBindings.delete(String(s9.root))
const s9Report = reconcileTeamBindings(s9.repositories, String(s9.root))

// --- S10: TeamSession missing but team artifacts remain --------------------
const s10 = await createHealthyTeam()
await s10.repositories.teamSessions.delete(String(s10.root))
const s10Report = reconcileTeamBindings(s10.repositories, String(s10.root))

// --- S11: root bound with the wrong kind ------------------------------------
const s11 = await createHealthyTeam()
await s11.repositories.sessionBindings.delete(String(s11.root))
await s11.repositories.sessionBindings.put(ordinaryBinding(String(s11.root)))
const s11Report = reconcileTeamBindings(s11.repositories, String(s11.root))

// --- S12: child bound with the wrong kind -----------------------------------
const s12 = await createHealthyTeam()
await s12.repositories.sessionBindings.delete(String(s12.memberChild))
await s12.repositories.sessionBindings.put(ordinaryBinding(String(s12.memberChild)))
const s12Report = reconcileTeamBindings(s12.repositories, String(s12.root))

// --- S13: empty scope — an ordinary session has nothing to reconcile -------
const s13 = await createHealthyTeam()
const s13Report = reconcileTeamBindings(s13.repositories, 'session-root-empty')

// --- S14: malformed scope root ----------------------------------------------
const s14Rejection = await capture(() => reconcileTeamBindings(baseline.repositories, 'root with space'))

describe('p4t3-reconciler', () => {
  it('reports a healthy team as bidirectionally consistent with exact counts', () => {
    expect(baselineReport.rootSessionId).toBe(String(baseline.root))
    expect(baselineReport.consistent).toBe(true)
    expect(baselineReport.teamSessionPresent).toBe(true)
    expect(baselineReport.memberRecordsChecked).toBe(1)
    expect(baselineReport.memberBindingsChecked).toBe(1)
    expect(baselineReport.diagnostics).toEqual([])
    expect(baselineReport.byCode).toEqual({})
  })

  it('is deterministic: identical stored state yields an identical report', () => {
    expect(baselineReportAgain).toEqual(baselineReport)
    expect(Object.isFrozen(baselineReport)).toBe(true)
    expect(Object.isFrozen(baselineReport.diagnostics)).toBe(true)
  })

  it('is read-only: reconciliation performs no writes', () => {
    expect(baselineWritesAfter).toBe(baselineWritesBefore)
  })

  it('diagnoses the missing child (record without binding row)', () => {
    expect(s1Report.consistent).toBe(false)
    expect(codesOf(s1Report)).toEqual(['missing-member-binding'])
    const diagnostic = findDiagnostic(s1Report, 'missing-member-binding')
    expect(diagnostic?.sessionId).toBe(String(s1.memberChild))
    expect(diagnostic?.instanceId).toBe(String(s1.instance))
    expect(diagnostic?.rootSessionId).toBe(String(s1.root))
    expect(s1Report.byCode['missing-member-binding']).toBe(1)
    expect(s1Report.memberRecordsChecked).toBe(1)
    expect(s1Report.memberBindingsChecked).toBe(0)
  })

  it('diagnoses the orphan (binding row without record)', () => {
    expect(s2Report.consistent).toBe(false)
    expect(codesOf(s2Report)).toEqual(['orphan-member-binding'])
    const diagnostic = findDiagnostic(s2Report, 'orphan-member-binding')
    expect(diagnostic?.sessionId).toBe(String(s2.memberChild))
    expect(diagnostic?.instanceId).toBe(String(s2.instance))
    expect(s2Report.memberRecordsChecked).toBe(0)
    expect(s2Report.memberBindingsChecked).toBe(1)
  })

  it('diagnoses both fault windows at once when each is broken a different way', () => {
    expect(s3Report.consistent).toBe(false)
    expect(codesOf(s3Report)).toEqual(['missing-member-binding', 'orphan-member-binding'])
    const missing = findDiagnostic(s3Report, 'missing-member-binding')
    expect(missing?.sessionId).toBe(String(s3.secondChild))
    expect(missing?.instanceId).toBe(String(s3.secondInstance))
    const orphan = findDiagnostic(s3Report, 'orphan-member-binding')
    expect(orphan?.sessionId).toBe(String(s3.memberChild))
    expect(orphan?.instanceId).toBe(String(s3.instance))
  })

  it('diagnoses the wrong root (child bound to a different existing team)', () => {
    expect(codesOf(s4ReportRoot)).toEqual(['child-bound-to-other-root'])
    const diagnostic = findDiagnostic(s4ReportRoot, 'child-bound-to-other-root')
    expect(diagnostic?.sessionId).toBe(String(s4.memberChild))
    expect(diagnostic?.context?.boundRootSessionId).toBe(String(s4.otherRoot))
    expect(codesOf(s4ReportOther)).toEqual(['orphan-member-binding'])
  })

  it('diagnoses team artifacts under a root with no TeamSession', () => {
    expect(codesOf(s5ReportRoot)).toEqual(['child-bound-to-other-root'])
    expect(codesOf(s5ReportFork)).toEqual(['orphan-member-binding', 'team-session-missing'])
    const teamMissing = findDiagnostic(s5ReportFork, 'team-session-missing')
    expect(teamMissing?.sessionId).toBe(s5.forkedRootSession)
    expect(s5ReportFork.teamSessionPresent).toBe(false)
  })

  it('diagnoses an instance swap (wrong instance + mismatched child)', () => {
    expect(codesOf(s6Report)).toEqual(['child-bound-to-other-instance', 'member-child-mismatch'])
    const swapped = findDiagnostic(s6Report, 'child-bound-to-other-instance')
    expect(swapped?.instanceId).toBe(String(s6.instance))
    expect(swapped?.context?.boundInstanceId).toBe(String(s6.secondInstance))
  })

  it('diagnoses a child mismatch (record and binding disagree on the child)', () => {
    expect(codesOf(s7Report)).toEqual(['member-child-mismatch', 'missing-member-binding'])
    const mismatch = findDiagnostic(s7Report, 'member-child-mismatch')
    expect(mismatch?.sessionId).toBe(String(s7.secondChild))
    expect(mismatch?.context?.recordChildSessionId).toBe(String(s7.memberChild))
  })

  it('diagnoses a duplicate child claim (two records, one durable child)', () => {
    expect(codesOf(s8Report)).toEqual(['child-bound-to-other-instance', 'duplicate-child-claim'])
    const claim = findDiagnostic(s8Report, 'duplicate-child-claim')
    expect(claim?.sessionId).toBe(String(s8.memberChild))
    expect(claim?.context?.instanceIds).toEqual(['inst-alpha', 'inst-gamma'])
    expect(s8Report.byCode['duplicate-child-claim']).toBe(1)
  })

  it('diagnoses the missing root binding (TeamSession without its row)', () => {
    expect(codesOf(s9Report)).toEqual(['missing-root-binding'])
    const diagnostic = findDiagnostic(s9Report, 'missing-root-binding')
    expect(diagnostic?.sessionId).toBe(String(s9.root))
    expect(s9Report.teamSessionPresent).toBe(true)
  })

  it('diagnoses the missing TeamSession (artifacts without the record)', () => {
    expect(codesOf(s10Report)).toEqual(['team-session-missing'])
    expect(s10Report.teamSessionPresent).toBe(false)
    expect(s10Report.memberRecordsChecked).toBe(1)
    expect(s10Report.memberBindingsChecked).toBe(1)
  })

  it('diagnoses a root bound with the wrong kind', () => {
    expect(codesOf(s11Report)).toEqual(['root-binding-kind-conflict'])
    const diagnostic = findDiagnostic(s11Report, 'root-binding-kind-conflict')
    expect(diagnostic?.context?.foundKind).toBe('ordinary')
  })

  it('diagnoses a child bound with the wrong kind', () => {
    expect(codesOf(s12Report)).toEqual(['binding-kind-conflict'])
    const diagnostic = findDiagnostic(s12Report, 'binding-kind-conflict')
    expect(diagnostic?.instanceId).toBe(String(s12.instance))
    expect(diagnostic?.context?.foundKind).toBe('ordinary')
  })

  it('treats an empty scope (an ordinary session) as trivially consistent', () => {
    expect(s13Report.consistent).toBe(true)
    expect(s13Report.teamSessionPresent).toBe(false)
    expect(s13Report.memberRecordsChecked).toBe(0)
    expect(s13Report.memberBindingsChecked).toBe(0)
    expect(s13Report.diagnostics).toEqual([])
    expect(s13Report.byCode).toEqual({})
  })

  it('rejects a malformed scope root with the contracts code preserved', () => {
    expect(s14Rejection.ok).toBe(false)
    const error = asTeamDomainError(s14Rejection.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('INVALID_ROOT_SESSION_ID')
  })
})
