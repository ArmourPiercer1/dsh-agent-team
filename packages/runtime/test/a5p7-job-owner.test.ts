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

// The W7 / W7M-2 legs proved the owner-fence law with the ROW holding the
// durable identity read next to the gateway. These specs pin the SAME law
// into the production class: the identity source is INJECTED, and the
// gateway — not the row's discipline — is what vetoes an unconfirmed claim.
describe('a5p7 injected identity source — durable state is the admission authority', () => {
  /** A fixture standing in for `memberInstances.list` in the live row. */
  function durableStore(members: readonly { rootSessionId: string; instanceId: string }[]) {
    const rows = new Set(members.map((m) => jobOwnerKey(m)))
    return {
      resolve: (claimed: { rootSessionId: string; instanceId: string }) =>
        rows.has(jobOwnerKey(claimed))
          ? { rootSessionId: claimed.rootSessionId, instanceId: claimed.instanceId }
          : null,
    }
  }

  it('a claim the source cannot confirm is refused owner-not-durable with ZERO state delta', () => {
    const events: { event: string; severity?: string }[] = []
    const gw = createJobsGateway({
      identity: durableStore([OWNER_A]),
      onObserve: (o) => events.push(o),
    })
    const ghost = gw.admitJob({
      jobId: 'j1',
      owner: OWNER_B, // not a durable member: same host, no such row
      scopeKey: 'agent:x',
      toolName: 'tool-x',
      pinnedIdentity: 'id-1',
    })
    expect(ghost.ok).toBe(false)
    if (!ghost.ok) expect(ghost.code).toBe('owner-not-durable')
    // VETO-SIDE ZERO-REGISTRATION: no job record, no lease token anywhere —
    // only the loud alarm. (The W7M-2 law: the registry is the zero meter.)
    expect(gw.job('j1')).toHaveLength(0)
    expect(gw.lease.outstanding()).toHaveLength(0)
    expect(events.filter((e) => e.event === 'gateway-admit-identity-unconfirmed')).toHaveLength(1)
    expect(events.some((e) => e.event === 'gateway-job-admitted')).toBe(false)
    // A durable claim sails through and the owner key is the SOURCE's copy.
    const ok = gw.admitJob({ jobId: 'j2', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(ok.ok).toBe(true)
    if (ok.ok) expect(ok.job.ownerKey).toBe(jobOwnerKey(OWNER_A))
  })

  it('the identity gate runs BEFORE the lease: a drained window never sees the vetoed claim', () => {
    // Same refusal either way, but the ORDER is the claim: an unconfirmed
    // owner must not even reach the lease door (zero registration).
    const gw = createJobsGateway({ identity: durableStore([]) })
    const refused = gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(!refused.ok && refused.code === 'owner-not-durable').toBe(true)
    expect(gw.lease.state()).toBe('ACTIVE') // no lease side effect happened
  })

  it('without an injected source the lane keeps the fixture shape: caller claims pass verbatim', () => {
    // Backward-compatibility pin: the a5p7 fixtures and both live kits built
    // on this behavior at base; absence of the option must not change it.
    const gw = createJobsGateway()
    const took = gw.admitJob({ jobId: 'j1', owner: OWNER_B, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(took.ok).toBe(true)
    expect(gw.lease.outstanding()).toHaveLength(1)
  })

  it('owner-mismatch and duplicate-job keep their exact codes when a source is injected', () => {
    const gw = createJobsGateway({ identity: durableStore([OWNER_A, OWNER_B]) })
    gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    const clash = gw.admitJob({ jobId: 'j1', owner: OWNER_B, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(!clash.ok && clash.code === 'owner-mismatch').toBe(true)
    const dup = gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(!dup.ok && dup.code === 'duplicate-job').toBe(true)
  })
})
