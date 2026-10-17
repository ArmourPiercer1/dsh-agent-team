/**
 * a5p7-lease-cancellation.test.ts — Lane F core: the lease window's
 * ACTIVE→DRAINING boundary (= the settled edge, C-GW) and the cancellation
 * classification law: **an already-started side effect is never re-labelled
 * un-executed, and the two event forms stay distinguishable end to end.**
 *
 * Semantics are aligned to the PR1r B3(ii) implementation (authority
 * `origin/alpha5-pr1r-residual-boundaries` @ bd6310ca) and the C-PROC
 * stage fixture (probe→prepare→execute→terminate, terminate ≠ cancel).
 *
 * @module test/a5p7-lease-cancellation
 */
import { describe, expect, it } from 'vitest'
import { createJobsGateway } from '../jobs-gateway/index.js'
import { createLeaseWindow } from '../jobs-gateway/index.js'
import { runCprocFixture } from './a5p7-cproc-fixture.js'

const OWNER_A = { rootSessionId: 'session-a', instanceId: 'inst-1' }

function admit(gw: ReturnType<typeof createJobsGateway>, jobId: string, name = 'tool-x') {
  const took = gw.admitJob({
    jobId,
    owner: OWNER_A,
    scopeKey: `agent:${jobId}`,
    toolName: name,
    pinnedIdentity: `${name}@v1`,
  })
  if (!took.ok) throw new Error(`admit failed: ${took.detail}`)
  return took.job
}

describe('a5p7 lease window — the boundary is the settled edge', () => {
  it('admits while ACTIVE and refuses from the first instant of the drain', () => {
    const w = createLeaseWindow()
    expect(w.acquire({ callId: 'c1', jobKey: 'k' })).toEqual({ ok: true })
    expect(w.drain()).toEqual({ ok: true })
    const late = w.acquire({ callId: 'c2', jobKey: 'k' })
    expect(late.ok).toBe(false)
    if (!late.ok) expect(late.code).toBe('gateway-not-active')
    expect(w.state()).toBe('DRAINING')
  })

  it('settled ends during ACTIVE; crossing the boundary is refused and the token stands', () => {
    const seen: string[] = []
    const w = createLeaseWindow((o) => seen.push(o.event))
    w.acquire({ callId: 'c1', jobKey: 'k' })
    w.acquire({ callId: 'c2', jobKey: 'k' })
    expect(w.end('c1', 'settled')).toEqual({ ok: true })
    w.drain()
    const crossed = w.end('c2', 'settled')
    expect(crossed.ok).toBe(false)
    if (!crossed.ok) expect(crossed.code).toBe('late-settle-across-boundary')
    // The crossing is loud and the half-state stands: the token is outstanding.
    expect(seen).toContain('gateway-lease-settle-refused-across-boundary')
    expect(w.outstanding().map((t) => t.callId)).toEqual(['c2'])
  })

  it('refused ends a lease in ANY live state — a call we turned away must not wedge the drain', () => {
    const w = createLeaseWindow()
    w.acquire({ callId: 'c1', jobKey: 'k' })
    w.acquire({ callId: 'c2', jobKey: 'k' })
    w.drain()
    expect(w.end('c2', 'refused')).toEqual({ ok: true })
    expect(w.outstanding().map((t) => t.callId)).toEqual(['c1'])
  })

  it('release needs a completed drain AND a self-counted zero; giveUp makes release refuse forever', () => {
    const w = createLeaseWindow()
    w.acquire({ callId: 'c1', jobKey: 'k' })
    w.end('c1')
    // not drained yet
    expect(w.release().ok).toBe(false)
    w.drain()
    expect(w.release()).toEqual({ ok: true })
    expect(w.state()).toBe('RELEASED')

    const w2 = createLeaseWindow()
    w2.acquire({ callId: 'd1', jobKey: 'k' })
    w2.drain()
    w2.giveUp('assembly stopped waiting')
    const refused = w2.release()
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.code).toBe('drain-given-up')
    expect(w2.state()).toBe('GIVEN_UP')
  })

  it('re-arming a live callId is a refusal, never a silent double-count', () => {
    const w = createLeaseWindow()
    expect(w.acquire({ callId: 'c1', jobKey: 'k' })).toEqual({ ok: true })
    const again = w.acquire({ callId: 'c1', jobKey: 'k' })
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe('duplicate-job')
    expect(w.outstanding()).toHaveLength(1)
  })
})

describe('a5p7 cancellation boundary — the two forms never collapse', () => {
  it('C-PROC cancel-before-exec settles the job NOT STARTED with zero side effects', () => {
    const gw = createJobsGateway()
    admit(gw, 'j-early')
    const run = runCprocFixture('j-early', 'tool-x', 'cancel-before-exec')
    expect(run.bodyInvoked).toBe(false)
    for (const e of run.events) expect(gw.observeDispatchEvent(e)).toEqual({ ok: true })
    const job = gw.job('j-early')[0]!
    expect(job.outcome?.kind).toBe('not-started')
    expect(job.outcome?.sideEffectPossible).toBe(false)
    expect(job.outcome?.evidenceEvent).toBe('dispatcher-call-cancelled-before-body')
    expect(job.state).toBe('settled')
  })

  it('C-PROC terminate-after-body-start settles TERMINATED, side effects real, value preserved', () => {
    const gw = createJobsGateway()
    admit(gw, 'j-term')
    const run = runCprocFixture('j-term', 'tool-x', 'terminate-after-body-start')
    expect(run.sideEffectCount).toBe(1)
    for (const e of run.events) expect(gw.observeDispatchEvent(e)).toEqual({ ok: true })
    const job = gw.job('j-term')[0]!
    expect(job.outcome?.kind).toBe('terminated-after-start')
    // The law: a started side effect is NEVER reported as un-executed.
    expect(job.outcome?.sideEffectPossible).toBe(true)
    expect(job.outcome?.kind).not.toBe('not-started')
    // The Body's preserved value survives in the evidence untouched.
    expect(job.evidence[0]!.preservedValue).toBe('partial-body-result-42')
  })

  it('the two forms stay DISTINGUISHABLE through the gateway (evidenceEvent differs)', () => {
    const gw = createJobsGateway()
    admit(gw, 'j-a')
    admit(gw, 'j-b')
    for (const e of runCprocFixture('j-a', 'tool-x', 'cancel-before-exec').events) gw.observeDispatchEvent(e)
    for (const e of runCprocFixture('j-b', 'tool-x', 'terminate-after-body-start').events) gw.observeDispatchEvent(e)
    const a = gw.job('j-a')[0]!.outcome!
    const b = gw.job('j-b')[0]!.outcome!
    expect(a.evidenceEvent).toBe('dispatcher-call-cancelled-before-body')
    expect(b.evidenceEvent).toBe('dispatcher-call-terminated-after-body-start')
    expect(a.evidenceEvent).not.toBe(b.evidenceEvent)
    expect([a.sideEffectPossible, b.sideEffectPossible]).toEqual([false, true])
  })

  it('an abort that lost the race is EXECUTED and said out loud', () => {
    const gw = createJobsGateway()
    admit(gw, 'j-race')
    for (const e of runCprocFixture('j-race', 'tool-x', 'abort-lost-race').events) {
      expect(gw.observeDispatchEvent(e)).toEqual({ ok: true })
    }
    const job = gw.job('j-race')[0]!
    expect(job.outcome?.kind).toBe('executed-despite-cancel')
    expect(job.outcome?.sideEffectPossible).toBe(true)
  })

  it('an unreadable outcome stays UNRESOLVED: neither shape is invented', () => {
    const gw = createJobsGateway()
    admit(gw, 'j-dead')
    for (const e of runCprocFixture('j-dead', 'tool-x', 'cancel-outcome-unreadable').events) {
      gw.observeDispatchEvent(e)
    }
    const job = gw.job('j-dead')[0]!
    expect(job.outcome?.kind).toBe('unresolved')
    // 'unresolved' is not a cancellation claim and not a completion claim.
    expect(job.outcome?.kind).not.toBe('not-started')
    expect(job.outcome?.kind).not.toBe('executed-despite-cancel')
  })

  it('an outcome fact recorded across the drain boundary does NOT launder the lease settle', () => {
    const seen: string[] = []
    const gw = createJobsGateway({ onObserve: (o) => seen.push(o.event) })
    admit(gw, 'j-cross')
    gw.lease.drain()
    for (const e of runCprocFixture('j-cross', 'tool-x', 'terminate-after-body-start').events) {
      gw.observeDispatchEvent(e)
    }
    // The WHAT-HAPPENED fact is kept (terminate form, side effects real)…
    expect(gw.job('j-cross')[0]!.outcome?.kind).toBe('terminated-after-start')
    // …while the COMPLETION evidence crossing the boundary was refused:
    // the lease still counts the token and release cannot pass.
    expect(seen).toContain('gateway-job-outcome-recorded-lease-unconfirmed')
    expect(gw.lease.outstanding().map((t) => t.callId)).toEqual(['j-cross'])
    expect(gw.lease.release().ok).toBe(false)
  })

  it('an event for a call that never took a gateway lease is noted, never invented into a job', () => {
    const gw = createJobsGateway()
    const res = gw.observeDispatchEvent({
      event: 'dispatcher-call-cancelled-before-body',
      callId: 'never-admitted',
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.code).toBe('unknown-job')
    expect(gw.job('never-admitted')).toHaveLength(0)
  })
})

// The W7 kit drove lease lifecycle through the row's own teardown routes and
// the W7M-2 row kept the lease hygiene ledger beside its gateway. The
// production contract inverts that: the ASSEMBLY owns the window and hands
// it in. These specs pin that the gateway drives the INJECTED window and
// that the two laws (self-count, boundary-is-the-settled-edge) hold on it.
describe('a5p7 injected lease window — the assembly owns the window', () => {
  it('the gateway acquires/ends on the injected window, and teardown on it is authoritative', () => {
    const windowObservations: string[] = []
    const window = createLeaseWindow((o) => windowObservations.push(String(o.event)))
    const gw = createJobsGateway({ lease: window })
    expect(gw.lease).toBe(window) // THE window, not a look-alike
    admit(gw, 'j1')
    expect(window.outstanding().map((t) => t.callId)).toEqual(['j1'])
    gw.observeDispatchEvent({ event: 'dispatcher-call-cancelled-before-body', callId: 'j1' })
    expect(window.outstanding()).toHaveLength(0)
    expect(windowObservations).toContain('gateway-lease-ended-settled')
    // The assembly drains/releases ITS window; the gateway reports the same.
    expect(window.drain().ok).toBe(true)
    expect(gw.lease.state()).toBe('DRAINING')
    expect(window.release().ok).toBe(true)
    expect(gw.lease.state()).toBe('RELEASED')
  })

  it('an injected window already draining refuses admissions from the gateway too', () => {
    const window = createLeaseWindow()
    expect(window.drain().ok).toBe(true)
    const gw = createJobsGateway({ lease: window })
    const refused = gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x', pinnedIdentity: 'id-1' })
    expect(!refused.ok && refused.code === 'gateway-not-active').toBe(true)
    expect(gw.job('j1')).toHaveLength(0)
  })

  it('a cross-boundary settle on the injected window keeps the token outstanding (same law, assembly-owned count)', () => {
    const gw = createJobsGateway({ lease: createLeaseWindow() })
    admit(gw, 'j1')
    gw.lease.drain()
    const crossed = gw.observeDispatchEvent({
      event: 'dispatcher-call-terminated-after-body-start',
      callId: 'j1',
      abortIssuedBy: 'lane-definition-move',
    })
    expect(crossed.ok).toBe(true) // the plane's fact stands…
    expect(gw.job('j1')[0]!.outcome?.kind).toBe('terminated-after-start')
    expect(gw.lease.outstanding().map((t) => t.callId)).toEqual(['j1']) // …the settle was refused
    const rel = gw.lease.release()
    expect(!rel.ok && rel.code === 'release-with-outstanding').toBe(true)
  })
})

describe('a5p7 admit-time definition pin — execution-time identity read at the admit edge', () => {
  it('an omitted pinnedIdentity is read from the injected reader AT ADMISSION', () => {
    let current = 'def-v1'
    const gw = createJobsGateway({
      resolveDefinition: (scope, name) => ({ ok: true, identity: `${name}@${current}` }),
    })
    const took = gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x' })
    expect(took.ok).toBe(true)
    if (took.ok) expect(took.job.pinnedIdentity).toBe('tool-x@def-v1')
    // The pin is a SNAPSHOT at admission: a later move never rewrites it.
    current = 'def-v2'
    expect(gw.job('j1')[0]!.pinnedIdentity).toBe('tool-x@def-v1')
  })

  it('an unreadable definition refuses the admission typed, with zero lease (closed world)', () => {
    const events: string[] = []
    const gw = createJobsGateway({
      resolveDefinition: () => ({ ok: false, identity: 'withdrawn' }),
      onObserve: (o) => events.push(o.event),
    })
    const refused = gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x' })
    expect(!refused.ok && refused.code === 'mapping-rejected').toBe(true)
    expect(gw.lease.outstanding()).toHaveLength(0)
    expect(gw.job('j1')).toHaveLength(0)
    expect(events).toContain('gateway-admit-definition-unreadable')
  })

  it('no reader at all + omitted pin = the same typed refusal (the closed world credits no read it cannot make)', () => {
    const gw = createJobsGateway()
    const refused = gw.admitJob({ jobId: 'j1', owner: OWNER_A, scopeKey: 'agent:x', toolName: 'tool-x' })
    expect(!refused.ok && refused.code === 'mapping-rejected').toBe(true)
  })
})
