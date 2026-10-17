/**
 * a5p7-job-owner.test.ts — JobOwner attribution (identity = member scope,
 * C-GW) and the Web projection rules: owner-scoped reads and redaction that
 * happens at collection, not at display.
 *
 * @module test/a5p7-job-owner
 */
import { describe, expect, it } from 'vitest'
import { createJobsGateway, jobOwnerKey, REDACTION_MARKER } from '../jobs-gateway/index.js'

const OWNER_A = { rootSessionId: 'session-a', instanceId: 'inst-1' }
const OWNER_B = { rootSessionId: 'session-a', instanceId: 'inst-2' }
const OWNER_OTHER_TEAM = { rootSessionId: 'session-b', instanceId: 'inst-1' }

describe('a5p7 JobOwner — identity is member scope', () => {
  it('the owner key is canonical: same member ⇒ same key regardless of literal field order', () => {
    const k1 = jobOwnerKey({ rootSessionId: 'session-a', instanceId: 'inst-1' })
    const k2 = jobOwnerKey({ instanceId: 'inst-1', rootSessionId: 'session-a' } as typeof OWNER_A)
    expect(k1).toBe(k2)
    // Same instanceId in another TeamSession is a DIFFERENT owner (invariant 18).
    expect(jobOwnerKey(OWNER_OTHER_TEAM)).not.toBe(k1)
  })

  it('admission binds the owner once: mutating the caller object cannot re-attribute the job', () => {
    const gw = createJobsGateway()
    const mutable: { rootSessionId: string; instanceId: string } = { ...OWNER_A }
    const took = gw.admitJob({
      jobId: 'j1',
      owner: mutable,
      scopeKey: 'agent:x',
      toolName: 'tool-x',
      pinnedIdentity: 'tool-x@v1',
    })
    expect(took.ok).toBe(true)
    mutable.instanceId = OWNER_B.instanceId // the caller tries to move the job
    expect(gw.job('j1')[0]!.ownerKey).toBe(jobOwnerKey(OWNER_A))
    expect(gw.projectFor(OWNER_B, 'j1').ok).toBe(false)
    expect(gw.projectFor(OWNER_A, 'j1').ok).toBe(true)
  })

  it('re-admitting a live jobId under a different member scope is an owner-mismatch alarm', () => {
    const events: string[] = []
    const clash = createJobsGateway({ onObserve: (o) => events.push(o.event) })
    clash.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    const second = clash.admitJob({ jobId: 'j1', owner: OWNER_B, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.code).toBe('owner-mismatch')
    expect(events).toContain('gateway-admit-owner-claim-conflict')
    // The same owner re-admitting is still just a duplicate, not a conflict.
    const dup = clash.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(!dup.ok && dup.code === 'duplicate-job').toBe(true)
  })
})

describe('a5p7 Web projection — owner-scoped reads and collect-time redaction', () => {
  it('a non-owner member scope is refused without leaking the owner identity', () => {
    const gw = createJobsGateway()
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    const res = gw.projectFor(OWNER_B, 'j1')
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.code).toBe('owner-mismatch')
      expect(res.detail).not.toContain(jobOwnerKey(OWNER_A))
      expect(res.detail).not.toContain('inst-1')
    }
  })

  it('credential-shaped values are redacted AT COLLECTION, so the view cannot leak them', () => {
    const gw = createJobsGateway()
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    const res = gw.observeDispatchEvent({
      event: 'dispatcher-call-terminated-after-body-start',
      callId: 'j1',
      tool: 'tool-x',
      sideEffectPossible: true,
      abortIssuedBy: 'none',
      detail: { launchToken: 'sk-live-token-LEAKME', note: 'value survived' },
      authorization: 'Bearer sk-another-LEAKME',
    })
    expect(res).toEqual({ ok: true })
    const view = gw.projectFor(OWNER_A, 'j1')
    expect(view.ok).toBe(true)
    const [job] = gw.job('j1')
    const evidenceText = JSON.stringify(job)
    expect(evidenceText).not.toContain('sk-live-token-LEAKME')
    expect(evidenceText).not.toContain('sk-another-LEAKME')
    expect(evidenceText).toContain(REDACTION_MARKER)
    // Non-sensitive values survive the sweep (redaction is targeted, not lossy).
    expect(evidenceText).toContain('value survived')
  })
})
