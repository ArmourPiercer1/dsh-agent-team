/**
 * p4t3-binding-service — the SessionBindingService: cold-hydration
 * resolve (ordinary / team-root / team-member / unbound, Architecture
 * §36.1), idempotent creation, and the typed cross-record rejections:
 *
 * - a team-root binding requires an EXISTING TeamSession ("wrong root"
 *   rejected at creation time);
 * - a team-member binding requires the MemberInstanceRecord and never
 *   re-points the durable child (invariant 24) — which is what keeps an
 *   ordinary fork of a member child session team-free (Architecture
 *   §35.3);
 * - duplicate binding attempts surface the repository's typed
 *   `RECORD_DUPLICATE` (contracts `SESSION_ALREADY_BOUND` preserved for
 *   the same-kind child clash; cross-kind rebinds carry the
 *   `session-already-bound` problem).
 *
 * @module @dsh-agent-team/storage/test/p4t3-binding-service
 */

import { describe, expect, it } from 'vitest'

import { parseInstanceId } from '../../contracts/src/index.js'
import { reconcileTeamBindings } from '../bindings/index.js'
import { asTeamDomainError, capture, detail, memberInstanceInput } from './p4-helpers.js'
import { createHealthyTeam } from './p4t3-helpers.js'

const world = await createHealthyTeam()
const { seam, service, repositories, root, memberChild, secondChild, instance, secondInstance, ordinarySession, forkedChildSession, forkedRootSession } = world

// --- cold-hydration resolve -----------------------------------------------
const resolveRoot = service.resolve(String(root))
const resolveChild = service.resolve(String(memberChild))
const resolveOrdinary = service.resolve(ordinarySession)
const resolveForkedChild = service.resolve(forkedChildSession)

// --- ordinary binding ------------------------------------------------------
const ordinaryCreated = await service.createOrdinaryBinding(ordinarySession)
const writesBeforeOrdinaryIdem = seam.writeLog.length
const ordinaryIdem = await capture(() => service.createOrdinaryBinding(ordinarySession))
const writesAfterOrdinaryIdem = seam.writeLog.length
const resolveOrdinaryAfter = service.resolve(ordinarySession)

// --- wrong root: team-root binding without a TeamSession -------------------
const wrongRootRejection = await capture(() => service.createTeamRootBinding(forkedRootSession))

// --- team-root creation idempotency (identical bytes) ----------------------
const writesBeforeRootIdem = seam.writeLog.length
const rootIdem = await capture(() => service.createTeamRootBinding(String(root)))
const writesAfterRootIdem = seam.writeLog.length

// --- team-member creation idempotency (identical bytes) --------------------
const writesBeforeMemberIdem = seam.writeLog.length
const memberIdem = await capture(() =>
  service.createTeamMemberBinding(String(root), String(instance), String(memberChild)),
)
const writesAfterMemberIdem = seam.writeLog.length

// --- ordinary fork of a member child: no team binding creatable ------------
const forkMemberRejection = await capture(() =>
  service.createTeamMemberBinding(String(root), String(instance), forkedChildSession),
)
const forkRootRejection = await capture(() => service.createTeamRootBinding(forkedChildSession))
const resolveForkedAfterRejections = service.resolve(forkedChildSession)

// --- team-member binding without a MemberInstanceRecord --------------------
const missingRecordRejection = await capture(() =>
  service.createTeamMemberBinding(String(root), 'inst-ghost', String(secondChild)),
)

// --- malformed ids are rejected with the contracts code preserved ----------
const badInstanceRejection = await capture(() =>
  service.createTeamMemberBinding(String(root), 'Inst_Bad', String(secondChild)),
)
const badChildRejection = await capture(() =>
  service.createTeamMemberBinding(String(root), String(instance), 'child with space'),
)

// --- cross-kind duplicate: child already bound `ordinary` -------------------
await service.createOrdinaryBinding(secondChild)
const crossKindRecord = await repositories.memberInstances.put(memberInstanceInput(root, secondInstance, secondChild))
const crossKindRejection = await capture(() =>
  service.createTeamMemberBinding(String(root), String(secondInstance), String(secondChild)),
)

// --- same-kind duplicate: a second record claims the same child ------------
const gammaInstance = parseInstanceId('inst-gamma')
const duplicateClaimRecord = await repositories.memberInstances.put(
  memberInstanceInput(root, gammaInstance, memberChild),
)
const duplicateChildRejection = await capture(() =>
  service.createTeamMemberBinding(String(root), String(gammaInstance), String(memberChild)),
)

// --- removal ----------------------------------------------------------------
const removeOrdinary = await service.removeBinding(ordinarySession)
const resolveOrdinaryRemoved = service.resolve(ordinarySession)
const removeAgain = await service.removeBinding(ordinarySession)

// --- final state: a freshly built team is bidirectionally consistent -------
const finalWorld = await createHealthyTeam()
const finalReport = reconcileTeamBindings(finalWorld.repositories, String(finalWorld.root))

describe('p4t3-binding-service', () => {
  it('resolves the team root as team-root (cold hydration)', () => {
    expect(resolveRoot.status).toBe('team-root')
    if (resolveRoot.status === 'team-root') {
      expect(String(resolveRoot.binding.sessionId)).toBe(String(root))
    }
  })

  it('resolves the member child as team-member with the exact composite identity', () => {
    expect(resolveChild.status).toBe('team-member')
    if (resolveChild.status === 'team-member') {
      expect(String(resolveChild.binding.rootSessionId)).toBe(String(root))
      expect(String(resolveChild.binding.instanceId)).toBe(String(instance))
      expect(String(resolveChild.binding.sessionId)).toBe(String(memberChild))
    }
  })

  it('resolves an unbound ordinary session as unbound (no Team authority)', () => {
    expect(resolveOrdinary.status).toBe('unbound')
  })

  it('resolves an ordinary fork of a member child as unbound (no inherited binding)', () => {
    expect(resolveForkedChild.status).toBe('unbound')
  })

  it('creates an ordinary binding and makes resolve explicit about it', () => {
    expect(ordinaryCreated.kind).toBe('ordinary')
    expect(ordinaryIdem.ok).toBe(true)
    expect(writesAfterOrdinaryIdem).toBe(writesBeforeOrdinaryIdem)
    expect(resolveOrdinaryAfter.status).toBe('ordinary')
  })

  it('rejects a team-root binding for a session with no TeamSession (wrong root)', () => {
    expect(wrongRootRejection.ok).toBe(false)
    const error = asTeamDomainError(wrongRootRejection.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('root-session-not-a-team')
    expect(detail(error, 'store')).toBe('session_bindings')
  })

  it('is idempotent when re-creating an identical team-root binding', () => {
    expect(rootIdem.ok).toBe(true)
    expect(writesAfterRootIdem).toBe(writesBeforeRootIdem)
  })

  it('is idempotent when re-creating an identical team-member binding', () => {
    expect(memberIdem.ok).toBe(true)
    expect(writesAfterMemberIdem).toBe(writesBeforeMemberIdem)
  })

  it('rejects a team-member binding for an ordinary fork (the record is never re-pointed)', () => {
    expect(forkMemberRejection.ok).toBe(false)
    const error = asTeamDomainError(forkMemberRejection.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('binding-contradicts-record')
    expect(detail(error, 'expectedChildSessionId')).toBe(String(memberChild))
  })

  it('rejects a team-root binding for an ordinary fork (no TeamSession there)', () => {
    expect(forkRootRejection.ok).toBe(false)
    const error = asTeamDomainError(forkRootRejection.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('root-session-not-a-team')
  })

  it('leaves the forked child unbound after the rejected creation attempts (fail closed)', () => {
    expect(resolveForkedAfterRejections.status).toBe('unbound')
  })

  it('rejects a team-member binding when the MemberInstanceRecord is missing', () => {
    expect(missingRecordRejection.ok).toBe(false)
    const error = asTeamDomainError(missingRecordRejection.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('member-record-missing')
  })

  it('preserves the contracts code for malformed ids', () => {
    expect(badInstanceRejection.ok).toBe(false)
    expect(asTeamDomainError(badInstanceRejection.error).code).toBe('RECORD_INVALID')
    expect(detail(asTeamDomainError(badInstanceRejection.error), 'contractsCode')).toBe('INVALID_INSTANCE_ID')
    expect(badChildRejection.ok).toBe(false)
    expect(asTeamDomainError(badChildRejection.error).code).toBe('RECORD_INVALID')
    expect(detail(asTeamDomainError(badChildRejection.error), 'contractsCode')).toBe('INVALID_CHILD_SESSION_ID')
  })

  it('rejects a cross-kind duplicate with the typed session-already-bound problem', () => {
    expect(crossKindRecord.instanceId).toBe(secondInstance)
    expect(crossKindRejection.ok).toBe(false)
    const error = asTeamDomainError(crossKindRejection.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('session-already-bound')
    expect(detail(error, 'existingKind')).toBe('ordinary')
    expect(detail(error, 'newKind')).toBe('team-member')
  })

  it('rejects a same-kind duplicate child claim with contracts SESSION_ALREADY_BOUND', () => {
    expect(duplicateClaimRecord.rootSessionId).toBe(root)
    expect(duplicateChildRejection.ok).toBe(false)
    const error = asTeamDomainError(duplicateChildRejection.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'contractsCode')).toBe('SESSION_ALREADY_BOUND')
  })

  it('removes a binding durably; a second removal is a no-op', () => {
    expect(removeOrdinary).toBe(true)
    expect(resolveOrdinaryRemoved.status).toBe('unbound')
    expect(removeAgain).toBe(false)
  })

  it('keeps a freshly built healthy team bidirectionally consistent', () => {
    expect(finalReport.consistent).toBe(true)
    expect(finalReport.teamSessionPresent).toBe(true)
    expect(finalReport.diagnostics).toEqual([])
  })
})
