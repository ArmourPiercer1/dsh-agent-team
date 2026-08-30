/**
 * p4-05 — overrides and compatibility stores.
 *
 * Governance overrides: two kinds (human-override / autonomy-overlay),
 * cross-field rules (origin exactly for autonomy-overlay, instanceId
 * exactly for instance scope), identity-keyed round-trip, idempotency,
 * per-identity duplication. Compatibility states: one record per root
 * session, P3-aligned status vocabulary, acknowledgement records,
 * duplicate-state rejection.
 *
 * @module @dsh-agent-team/storage/test/p4-05-governance
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import {
  governanceOverrideKey,
  serializeCompatibilityState,
  serializeGovernanceOverride,
} from '../schema/index.js'
import type { GovernanceOverrideIdentity } from '../schema/index.js'
import { createTeamDomain } from '../repositories/index.js'
import {
  InMemoryStorageSeam,
  P4_FIXTURE,
  asTeamDomainError,
  autonomyOverlayInstance,
  capture,
  compatibilityAcknowledgement,
  compatibilityState,
  detail,
  humanOverrideTeam,
} from './p4-helpers.js'

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const repo = domain.repositories.overrides
const compatRepo = domain.repositories.compatibility
const root = P4_FIXTURE.rootSessionId
const raw = seam.rawRows(TEAM_DOMAIN_NAME, 'overrides')

const humanOverride = await repo.put(humanOverrideTeam(String(root), 'ov-team-1'))
const overlay = await repo.put(autonomyOverlayInstance(String(root), 'inst-alpha', 'leader', 'ol-inst-1'))

const overlayNoOrigin = await capture(() =>
  repo.put({ ...autonomyOverlayInstance(String(root), 'inst-alpha', 'leader', 'ol-inst-2'), origin: undefined }),
)
const humanWithOrigin = await capture(() => repo.put({ ...humanOverrideTeam(String(root), 'ov-team-2'), origin: 'leader' }))
const instanceNoId = await capture(() =>
  repo.put({ ...autonomyOverlayInstance(String(root), 'inst-alpha', 'leader', 'ol-inst-3'), instanceId: undefined }),
)
const teamWithId = await capture(() => repo.put({ ...humanOverrideTeam(String(root), 'ov-team-4'), instanceId: 'inst-alpha' }))

const writesBefore = seam.writeLog.length
const putSame = await capture(() => repo.put(humanOverrideTeam(String(root), 'ov-team-1')))
const writesAfterIdem = seam.writeLog.length
const dupValues = await capture(() => repo.put({ ...humanOverrideTeam(String(root), 'ov-team-1'), values: { autonomy: 'strict' } }))

await repo.put(autonomyOverlayInstance(String(root), 'inst-beta', 'member', 'ol-inst-2'))
const listedOverrides = repo.list(String(root))

const teamIdentity: GovernanceOverrideIdentity = {
  kind: 'human-override',
  recordId: 'ov-team-1',
  rootSessionId: String(root),
  scope: 'team',
}
const overlayIdentity: GovernanceOverrideIdentity = {
  kind: 'autonomy-overlay',
  instanceId: 'inst-alpha',
  recordId: 'ol-inst-1',
  rootSessionId: String(root),
  scope: 'instance',
}

const compat = await compatRepo.put(
  compatibilityState(String(root), {
    status: 'BLOCKED_WARNING',
    acknowledgements: [compatibilityAcknowledgement('req.autonomy-boundary', 'accepted with guards'), compatibilityAcknowledgement('req.workspace-root')],
  }),
)
const compatGet = compatRepo.get(String(root))
const badStatus = await capture(() => compatRepo.put(compatibilityState(String(root), { status: 'MAYBE' })))
const ackMissing = await capture(() =>
  compatRepo.put(compatibilityState(String(root), { acknowledgements: [{ ...compatibilityAcknowledgement('req.autonomy-boundary'), acknowledgedAt: undefined }] })))
const compatDup = await capture(() => compatRepo.put(compatibilityState(String(root), { status: 'OPEN', acknowledgements: [] })))

describe('p4-05 overrides + compatibility stores', () => {
  it('a team-scope human-override round-trips at its governance key', () => {
    expect(repo.get(teamIdentity)).toEqual(humanOverride)
    expect(raw.get(governanceOverrideKey(teamIdentity))).toBe(serializeGovernanceOverride(humanOverride))
  })

  it('an instance-scope autonomy-overlay (origin leader) round-trips at its governance key', () => {
    expect(repo.get(overlayIdentity)).toEqual(overlay)
    expect(overlay.origin).toBe('leader')
  })

  it('an autonomy-overlay without origin is rejected', () => {
    expect(overlayNoOrigin.ok).toBe(false)
    const error = asTeamDomainError(overlayNoOrigin.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('origin-required-for-autonomy-overlay')
  })

  it('a human-override with origin is rejected', () => {
    expect(humanWithOrigin.ok).toBe(false)
    const error = asTeamDomainError(humanWithOrigin.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('origin-forbidden-for-human-override')
  })

  it('instance scope requires instanceId; team scope forbids it', () => {
    expect(instanceNoId.ok).toBe(false)
    expect(detail(asTeamDomainError(instanceNoId.error), 'problem')).toBe('instanceId-required-for-instance-scope')
    expect(teamWithId.ok).toBe(false)
    expect(detail(asTeamDomainError(teamWithId.error), 'problem')).toBe('instanceId-forbidden-for-team-scope')
  })

  it('an identical put is idempotent; a changed value raises duplicate-override', () => {
    expect(putSame.ok).toBe(true)
    expect(writesAfterIdem).toBe(writesBefore)
    expect(dupValues.ok).toBe(false)
    const error = asTeamDomainError(dupValues.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('duplicate-override')
  })

  it('distinct identities (different instanceId) are separate keys in list(root)', () => {
    expect(listedOverrides.length).toBe(3)
    expect(listedOverrides.map((o) => o.recordId)).toEqual(['ol-inst-1', 'ol-inst-2', 'ov-team-1'])
  })

  it('a compatibility state with two acknowledgements round-trips at the rootSessionId key', () => {
    expect(compatGet).toEqual(compat)
    expect(compat.status).toBe('BLOCKED_WARNING')
    expect(compat.acknowledgements.length).toBe(2)
    expect(compat.acknowledgements[0]?.note).toBe('accepted with guards')
    const compatRaw = seam.rawRows(TEAM_DOMAIN_NAME, 'compatibility')
    expect(compatRaw.get(String(root))).toBe(serializeCompatibilityState(compat))
  })

  it('an unknown compatibility status is rejected with bad-status', () => {
    expect(badStatus.ok).toBe(false)
    const error = asTeamDomainError(badStatus.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('bad-status')
  })

  it('an acknowledgement without acknowledgedAt is rejected with MALFORMED_DTO', () => {
    expect(ackMissing.ok).toBe(false)
    const error = asTeamDomainError(ackMissing.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('MALFORMED_DTO')
  })

  it('a second compatibility state for the same root raises duplicate-compatibility-state', () => {
    expect(compatDup.ok).toBe(false)
    const error = asTeamDomainError(compatDup.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('duplicate-compatibility-state')
  })
})
