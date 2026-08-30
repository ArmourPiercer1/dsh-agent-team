/**
 * p4t3-fork-reconciliation — binding queries support cold hydration and
 * fork reconciliation (task card acceptance; Architecture §35.1/§35.2/
 * §35.3, §36.1).
 *
 * Three fork shapes, all handled by durable state alone (no live Agent, no
 * runtime call):
 *
 * - **root fork** (§35.2): a native fork of the team root session is a NEW
 *   TeamSession under a NEW root — committed as a TeamSession record first,
 *   recognized by the idempotent sidecar root binding afterwards, and it
 *   inherits NO members;
 * - **member-child fork** (§35.3): a native fork of a member's durable
 *   child session is an ORDINARY independent session — it can neither take
 *   the member's binding (invariant 24: never re-pointed) nor any root
 *   binding (no TeamSession), so it stays unbound;
 * - **cold hydration** (§36.1): a freshly constructed service (no cached
 *   state) decides ordinary / team-root / team-member / unbound from the
 *   binding store alone.
 *
 * @module @dsh-agent-team/storage/test/p4t3-fork-reconciliation
 */

import { describe, expect, it } from 'vitest'

import { parseRootSessionId } from '../../contracts/src/index.js'
import { reconcileTeamBindings, SessionBindingService } from '../bindings/index.js'
import { asTeamDomainError, capture, detail, teamSessionInput } from './p4-helpers.js'
import { createHealthyTeam } from './p4t3-helpers.js'

const world = await createHealthyTeam()
const forkWorld = await createHealthyTeam()

// --- root fork (Architecture §35.2) ----------------------------------------
// Before anything is committed at the fork root: an empty scope.
const forkEmptyReport = reconcileTeamBindings(forkWorld.repositories, forkWorld.forkedRootSession)
// Recognition before the TeamSession is committed must fail closed.
const preForkRejection = await capture(() => forkWorld.service.createTeamRootBinding(forkWorld.forkedRootSession))
// The fork is committed as a NEW TeamSession (new root, generation 1).
await forkWorld.repositories.teamSessions.put(teamSessionInput(parseRootSessionId(forkWorld.forkedRootSession)))
const forkBeforeReport = reconcileTeamBindings(forkWorld.repositories, forkWorld.forkedRootSession)
// Idempotent sidecar recognition: bind the fork root now that it is a team.
const forkRootBinding = await forkWorld.service.createTeamRootBinding(forkWorld.forkedRootSession)
const writesBeforeForkIdem = forkWorld.seam.writeLog.length
const forkRootIdem = await capture(() => forkWorld.service.createTeamRootBinding(forkWorld.forkedRootSession))
const writesAfterForkIdem = forkWorld.seam.writeLog.length
const forkAfterReport = reconcileTeamBindings(forkWorld.repositories, forkWorld.forkedRootSession)
const forkColdResolve = new SessionBindingService(forkWorld.repositories).resolve(forkWorld.forkedRootSession)
// The original team is untouched by the fork's lifecycle.
const originalAfterForkReport = reconcileTeamBindings(forkWorld.repositories, String(forkWorld.root))

// --- member-child fork (Architecture §35.3) ---------------------------------
// The fork is a native copy of the member's durable child session.
const forkMemberRejection = await capture(() =>
  world.service.createTeamMemberBinding(String(world.root), String(world.instance), world.forkedChildSession),
)
const forkRootAttempt = await capture(() => world.service.createTeamRootBinding(world.forkedChildSession))
const forkedChildRow = world.repositories.sessionBindings.get(world.forkedChildSession)
const forkedChildResolve = new SessionBindingService(world.repositories).resolve(world.forkedChildSession)
// Optionally recording the fork as `ordinary` is explicit and team-neutral.
await world.service.createOrdinaryBinding(world.forkedChildSession)
const forkedOrdinaryResolve = world.service.resolve(world.forkedChildSession)
const worldAfterOrdinaryReport = reconcileTeamBindings(world.repositories, String(world.root))

// --- cold hydration (Architecture §36.1) ------------------------------------
// A brand-new service with no cached state: the binding store is the
// entirety of its knowledge.
const coldService = new SessionBindingService(world.repositories)
const coldRoot = coldService.resolve(String(world.root))
const coldChild = coldService.resolve(String(world.memberChild))
const coldOrdinary = coldService.resolve(world.ordinarySession)

describe('p4t3-fork-reconciliation', () => {
  it('treats a fork root with no team artifacts as an empty, consistent scope', () => {
    expect(forkEmptyReport.consistent).toBe(true)
    expect(forkEmptyReport.teamSessionPresent).toBe(false)
    expect(forkEmptyReport.diagnostics).toEqual([])
  })

  it('fails closed when recognizing a root fork before its TeamSession is committed', () => {
    expect(preForkRejection.ok).toBe(false)
    const error = asTeamDomainError(preForkRejection.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('root-session-not-a-team')
  })

  it('diagnoses a committed root fork awaiting sidecar recognition', () => {
    expect(forkBeforeReport.consistent).toBe(false)
    expect(forkBeforeReport.teamSessionPresent).toBe(true)
    expect(forkBeforeReport.diagnostics.map((d) => d.code)).toEqual(['missing-root-binding'])
  })

  it('recognizes the root fork with an idempotent sidecar team-root binding', () => {
    expect(forkRootBinding.kind).toBe('team-root')
    expect(String(forkRootBinding.sessionId)).toBe(forkWorld.forkedRootSession)
    expect(forkRootIdem.ok).toBe(true)
    expect(writesAfterForkIdem).toBe(writesBeforeForkIdem)
  })

  it('is bidirectionally consistent and memberless once recognized', () => {
    expect(forkAfterReport.consistent).toBe(true)
    expect(forkAfterReport.teamSessionPresent).toBe(true)
    expect(forkAfterReport.memberRecordsChecked).toBe(0)
    expect(forkAfterReport.memberBindingsChecked).toBe(0)
  })

  it('resolves a recognized root fork as team-root on cold hydration', () => {
    expect(forkColdResolve.status).toBe('team-root')
  })

  it('leaves the original team consistent and does not inherit members into the fork', () => {
    expect(originalAfterForkReport.consistent).toBe(true)
    expect(originalAfterForkReport.memberRecordsChecked).toBe(1)
    expect(forkAfterReport.memberRecordsChecked).toBe(0)
  })

  it('refuses to point a member-child fork at the member binding (never re-pointed)', () => {
    expect(forkMemberRejection.ok).toBe(false)
    const error = asTeamDomainError(forkMemberRejection.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('binding-contradicts-record')
    expect(detail(error, 'expectedChildSessionId')).toBe(String(world.memberChild))
    expect(detail(error, 'givenChildSessionId')).toBe(world.forkedChildSession)
  })

  it('refuses to give a member-child fork a team-root binding', () => {
    expect(forkRootAttempt.ok).toBe(false)
    const error = asTeamDomainError(forkRootAttempt.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('root-session-not-a-team')
  })

  it('leaves a member-child fork unbound after the rejected attempts (no row created)', () => {
    expect(forkedChildRow).toBe(undefined)
    expect(forkedChildResolve.status).toBe('unbound')
  })

  it('records a member-child fork as ordinary without disturbing team integrity', () => {
    expect(forkedOrdinaryResolve.status).toBe('ordinary')
    expect(worldAfterOrdinaryReport.consistent).toBe(true)
    expect(worldAfterOrdinaryReport.diagnostics).toEqual([])
  })

  it('resolves the full cold-hydration chain from a fresh service', () => {
    expect(coldRoot.status).toBe('team-root')
    expect(coldChild.status).toBe('team-member')
    if (coldChild.status === 'team-member') {
      expect(String(coldChild.binding.rootSessionId)).toBe(String(world.root))
      expect(String(coldChild.binding.instanceId)).toBe(String(world.instance))
    }
    expect(coldOrdinary.status).toBe('unbound')
  })
})
