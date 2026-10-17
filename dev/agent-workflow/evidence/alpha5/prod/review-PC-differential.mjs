#!/usr/bin/env node
/**
 * review-PC-differential.mjs — P-C reviewer instrument (independent of the kit).
 *
 * PURPOSE 1 (review item ①): prove or disprove, BY EXECUTION, that the PR7
 *   DEFAULT (no identity / no lease / no reader injection, explicit
 *   `pinnedIdentity`) is VERBATIM the base behaviour. Method: load the base
 *   barrel (d714a941 committed dist) and the head barrel (ce44fd4e committed
 *   dist) in ONE process, run the SAME scripted scenario against each, capture
 *   every return value, every observation event and the final internal state
 *   dump, and compare the two transcripts with a canonical (sorted-key) JSON
 *   comparison. Six scenarios = the six criteria of this review (the W7
 *   semantic families the kit books: identity/pin, isolation, revocation,
 *   settle+release, boundary+giveUp, redaction+unknown-call).
 *
 * PURPOSE 2 (review item ①, boundary): record the degenerate inputs where the
 *   two barrels are NOT expected to agree, so any delta is on the record with
 *   its exact shape instead of being argued about. (INFO rows, not verdicts.)
 *
 * PURPOSE 3 (review item ②): the injection gates, measured on the head barrel
 *   only — zero-registration veto (state delta 0), admit-time live reader pin
 *   (+ the unreadable / no-reader negative controls), and lease-injection
 *   object identity (the assembly's window IS the driven window).
 *
 * Exit: 0 every expectation held; 2 an expectation broke; 1 fatal.
 */
import { writeFileSync } from 'node:fs'

const BASE_URL = 'file:///srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-prod-pr23/packages/runtime/dist/packages/runtime/jobs-gateway/index.js'
const HEAD_URL = 'file:///srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5p7-rev-pc/packages/runtime/dist/packages/runtime/jobs-gateway/index.js'

const results = []
let failures = 0
function book (id, claim, ok, detail) {
  results.push({ id, claim, ok, detail })
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} :: ${claim}${ok ? '' : `\n    ${String(detail).split('\n').join('\n    ')}`}`)
}
function info (id, claim, detail) {
  results.push({ id, claim, ok: true, info: true, detail })
  console.log(`INFO ${id} :: ${claim}\n    ${String(detail).split('\n').join('\n    ')}`)
}

/** Canonical JSON: keys sorted at every depth, so a comparison is about VALUES. */
function canon (value) {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v)
}

const OA = { rootSessionId: 'root-A', instanceId: 'inst-A' }
const OB = { rootSessionId: 'root-B', instanceId: 'inst-B' }
const SWAPPED = { rootSessionId: 'root-B', instanceId: 'inst-A' }
/** A real event name from the lane's closed set (settles the lease). */
const DONE = (callId, extra = {}) => ({ callId, event: 'dispatcher-call-completed-after-abort', ...extra })
const CANCELLED = (callId, extra = {}) => ({ callId, event: 'dispatcher-call-cancelled-before-body', ...extra })

// ── the six scenarios: NO injection, explicit pin = the base fixture shape ──
const SCENARIOS = [
  {
    id: 'C1-W3-identity-pin',
    claim: 'identity binding + value pin against caller mutation + duplicate/owner-mismatch faces',
    run (mod, g) {
      const callerOwner = { rootSessionId: 'root-A', instanceId: 'inst-A' }
      const a = g.admitJob({ jobId: 'j1', owner: callerOwner, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      callerOwner.instanceId = 'EVIL-MUTATED' // post-admission mutation of the caller's object
      const clash = g.admitJob({ jobId: 'j1', owner: OB, scopeKey: 'scope-B', toolName: 'bash', pinnedIdentity: 'def-v1' })
      const dup = g.admitJob({ jobId: 'j1', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      return { admitted: a, record: g.job('j1'), clash, dup, keyMath: mod.jobOwnerKey(OA) }
    },
  },
  {
    id: 'C2-W4-isolation',
    claim: 'two-member mutual invisibility + static cross-scope detail + swapped-root viewer',
    run (mod, g) {
      g.admitJob({ jobId: 'jA', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      g.admitJob({ jobId: 'jB', owner: OB, scopeKey: 'scope-B', toolName: 'read_image', pinnedIdentity: 'def-v2' })
      return {
        ownA: g.projectFor(OA, 'jA'),
        crossAtoB: g.projectFor(OA, 'jB'),
        ownB: g.projectFor(OB, 'jB'),
        crossBtoA: g.projectFor(OB, 'jA'),
        swappedRoot: g.projectFor(SWAPPED, 'jA'),
        allIds: g.job('*').map((r) => r.jobId),
        otherViewer: g.projectFor({ rootSessionId: 'root-C', instanceId: 'inst-C' }, 'jA'),
      }
    },
  },
  {
    id: 'C3-W5-revocation-attribution',
    claim: 'cancel-only-what-moved + neighbour safety + execution-time attribution',
    build () {
      const live = new Map([['scope-A/bash', 'def-v1'], ['scope-A/read_image', 'def-v1'], ['scope-B/bash', 'def-v1']])
      const probe = (scopeKey, name) => {
        const v = live.get(`${scopeKey}/${name}`)
        return v === undefined ? { ok: false, identity: 'withdrawn' } : { ok: true, identity: v }
      }
      return { options: { resolveDefinition: probe }, live }
    },
    run (mod, g, ctx) {
      g.admitJob({ jobId: 'jX', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      g.admitJob({ jobId: 'jY', owner: OA, scopeKey: 'scope-A', toolName: 'read_image', pinnedIdentity: 'def-v1' })
      g.admitJob({ jobId: 'jZ', owner: OB, scopeKey: 'scope-B', toolName: 'bash', pinnedIdentity: 'def-v1' })
      ctx.live.set('scope-A/bash', 'def-v2') // ONLY (scope-A,bash) moved
      const cancelled = g.onRegistryChange()
      ctx.live.delete('scope-A/read_image') // unreadable is its own class
      const withdrawn = g.onRegistryChange()
      const view = g.projectFor(OA, 'jX')
      return {
        cancelled, withdrawn, view,
        records: g.job('*').map((r) => ({ jobId: r.jobId, cancelRequested: r.cancelRequested, pinnedIdentity: r.pinnedIdentity })),
        probeOverride: g.onRegistryChange(() => ({ ok: true, identity: 'def-v2' })),
      }
    },
  },
  {
    id: 'C4-W6-settle-release',
    claim: 'settle while ACTIVE + drain at self-counted zero reaches RELEASED',
    run (mod, g) {
      g.admitJob({ jobId: 'jS', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      const mid = { state: g.lease.state(), outstanding: g.lease.outstanding().map((t) => t.callId) }
      const ev = g.observeDispatchEvent(DONE('jS'))
      const drained = g.lease.drain()
      const released = g.lease.release()
      const admitAfterReleased = g.admitJob({ jobId: 'jS2', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      return { mid, ev, drained, released, admitAfterReleased, endState: g.lease.state(), record: g.job('jS') }
    },
  },
  {
    id: 'C5-W7-boundary-giveup',
    claim: 'A holds ⇒ B refused + drain refuses new admits from the first instant + cross-boundary settle refused with token outstanding + release refuses forever after giveUp',
    run (mod, g) {
      g.admitJob({ jobId: 'jM', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      const bTriesSame = g.admitJob({ jobId: 'jM', owner: OB, scopeKey: 'scope-B', toolName: 'bash', pinnedIdentity: 'def-v1' })
      const drained = g.lease.drain()
      const newAdmit = g.admitJob({ jobId: 'jNew', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      const cross = g.observeDispatchEvent(DONE('jM'))
      const outstanding = g.lease.outstanding().map((t) => t.callId)
      const releaseBlocked = g.lease.release()
      const gaveUp = g.lease.giveUp('reviewer-scenario')
      const releaseForever = g.lease.release()
      const secondGiveUp = g.lease.giveUp('again')
      const refusedEnd = g.observeDispatchEvent(CANCELLED('jM'))
      return { bTriesSame, drained, newAdmit, cross, outstanding, releaseBlocked, gaveUp, releaseForever, secondGiveUp, refusedEnd, endState: g.lease.state(), record: g.job('jM') }
    },
  },
  {
    id: 'C6-redaction-unknown',
    claim: 'unknown callId is noted not invented + credential-shaped values redacted AT COLLECTION',
    run (mod, g) {
      const unknown = g.observeDispatchEvent(DONE('ghost', { note: 'Bearer tok-secret-abc' }))
      const noOutcome = g.observeDispatchEvent({ callId: 'ghost2', event: 'some-plane-event-without-outcome' })
      g.admitJob({ jobId: 'jR', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
      const known = g.observeDispatchEvent(DONE('jR', {
        authorization: 'Bearer super-secret-token-123',
        args: { token: 'tok-xyz', apiKey: 'key-abc', nested: { cookie: 'dsh-auth-cookie=abc%3Ddef', keep: 'plain' } },
      }))
      const rec = g.job('jR')[0]
      return {
        unknown, noOutcome, known,
        evidenceText: JSON.stringify(rec.evidence),
        marker: mod.REDACTION_MARKER,
        outcome: rec.outcome, state: rec.state,
        projection: g.projectFor(OA, 'jR'),
        redactDirect: mod.redactCredentials({ token: 'sk-abcdefghijklmnop', keep: 'plain', list: [{ password: 'p' }, 'x'] }),
      }
    },
  },
]

function runScenario (mod, sc) {
  const obs = []
  const built = sc.build ? sc.build() : { options: {} }
  const g = mod.createJobsGateway({ ...built.options, onObserve: (o) => obs.push(o) })
  const out = sc.run(mod, g, built)
  return {
    out,
    obs,
    dump: {
      leaseState: g.lease.state(),
      outstanding: g.lease.outstanding().map((t) => t.callId),
      jobs: g.job('*').map((r) => ({ jobId: r.jobId, ownerKey: r.ownerKey, state: r.state, outcome: r.outcome, cancelRequested: r.cancelRequested })),
    },
  }
}

const BASE = await import(BASE_URL)
const HEAD = await import(HEAD_URL)

console.log('── ① DEFAULT (no injection) = base: six criteria, transcript-differential ──')
for (const sc of SCENARIOS) {
  let b, h
  try { b = runScenario(BASE, sc) } catch (e) { b = { threw: String(e?.message ?? e) } }
  try { h = runScenario(HEAD, sc) } catch (e) { h = { threw: String(e?.message ?? e) } }
  const bs = canon(b)
  const hs = canon(h)
  const same = bs === hs
  let detail = ''
  if (!same) {
    const bl = bs.split('},{')
    const hl = hs.split('},{')
    for (let i = 0; i < Math.max(bl.length, hl.length); i += 1) {
      if (bl[i] !== hl[i]) { detail = `first diff at segment ${i}\n  base: ${String(bl[i]).slice(0, 500)}\n  head: ${String(hl[i]).slice(0, 500)}`; break }
    }
    detail += `\n  baseLen=${bs.length} headLen=${hs.length}`
  }
  book(sc.id, `${sc.claim} — head transcript byte-equal to base`, same,
    detail || `${bs.length} canonical bytes equal; ${JSON.parse(bs).obs.length} observation events on both sides`)
}

console.log('\n── ① boundary shapes (recorded, not judged) ──')
for (const [label, shape] of [['empty-string pin', ''], ['undefined pin, no reader', undefined]]) {
  const one = (mod) => {
    const obs = []
    const g = mod.createJobsGateway({ onObserve: (o) => obs.push(o) })
    const r = g.admitJob({ jobId: 'jD', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: shape })
    return { r, events: obs.map((o) => o.event), lease: g.lease.state(), outstanding: g.lease.outstanding().length, jobs: g.job('*').length }
  }
  info(`BND-${label}`, 'base vs head shape on record (degenerate input, no injection)', `base=${canon(one(BASE))}\n  head=${canon(one(HEAD))}`)
}

console.log('\n── ② injection gates (head barrel only) ──')
for (const injected of [false, true]) {
  const sink = []
  const lease = injected ? HEAD.createLeaseWindow((o) => sink.push({ from: 'window', ...o })) : undefined
  const obs = []
  const g = HEAD.createJobsGateway({ identity: { resolve: () => null }, lease, onObserve: (o) => obs.push(o) })
  const before = { jobs: g.job('*').length, outstanding: g.lease.outstanding().length, state: g.lease.state(), obs: obs.length }
  const r = g.admitJob({ jobId: 'jNo', owner: OA, scopeKey: 'scope-A', toolName: 'bash' })
  const after = { jobs: g.job('*').length, outstanding: g.lease.outstanding().length, state: g.lease.state(), obs: obs.length }
  const delta = { jobs: after.jobs - before.jobs, outstanding: after.outstanding - before.outstanding, state: before.state === after.state ? 'unchanged' : `${before.state}->${after.state}`, newEvents: obs.slice(before.obs) }
  book(`T1-zero-registration${injected ? ' (assembly-owned window)' : ' (private window)'}`,
    'owner-not-durable refusal leaves ZERO state delta (no job record, no lease token, window state untouched) and exactly one alarm event',
    r.ok === false && r.code === 'owner-not-durable' && delta.jobs === 0 && delta.outstanding === 0 && delta.state === 'unchanged'
      && delta.newEvents.length === 1 && delta.newEvents[0].event === 'gateway-admit-identity-unconfirmed' && delta.newEvents[0].severity === 'alarm'
      && (injected ? sink.length === 0 : true), // the veto never touches the window at all
    canon({ refusal: r, delta, windowEvents: sink }))
}
{
  let readerCalls = 0
  const obs = []
  const g = HEAD.createJobsGateway({
    identity: { resolve: () => null },
    resolveDefinition: () => { readerCalls += 1; return { ok: true, identity: 'def-live' } },
    onObserve: (o) => obs.push(o),
  })
  const r = g.admitJob({ jobId: 'jOrder', owner: OA, scopeKey: 'scope-A', toolName: 'bash' })
  book('T1b-gate-order', 'GATE 1 (identity) runs BEFORE GATE 2 (definition read): a veto at GATE 1 never consults the reader',
    r.code === 'owner-not-durable' && readerCalls === 0 && obs.length === 1, canon({ r, readerCalls, events: obs.map((o) => o.event) }))
}
{
  const g = HEAD.createJobsGateway({
    identity: { resolve: (claimed) => ({ rootSessionId: `host-${claimed.rootSessionId}`, instanceId: 'inst-authority' }) },
  })
  const r = g.admitJob({ jobId: 'jAuth', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
  const rec = g.job('jAuth')[0]
  const keyOfAuthority = HEAD.jobOwnerKey({ rootSessionId: 'host-root-A', instanceId: 'inst-authority' })
  const keyOfClaim = HEAD.jobOwnerKey(OA)
  const claimSees = g.projectFor(OA, 'jAuth')
  const authoritySees = g.projectFor({ rootSessionId: 'host-root-A', instanceId: 'inst-authority' }, 'jAuth')
  book('T1c-authority-copy', 'owner binding frozen from the AUTHORITY COPY (injected source), not the caller claim',
    r.ok === true && rec.ownerKey === keyOfAuthority && rec.ownerKey !== keyOfClaim && claimSees.ok === false && authoritySees.ok === true,
    canon({ ownerKey: rec.ownerKey, keyOfAuthority, keyOfClaim, claimSees, authoritySees }))
}
{
  const g = HEAD.createJobsGateway({ identity: { resolve: () => { throw new Error('repository unreadable') } } })
  let threw = null
  try { g.admitJob({ jobId: 'jThrow', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' }) } catch (e) { threw = String(e?.message ?? e) }
  book('T1d-throwing-source-shape', 'a THROWING identity source propagates fail-loud and still registers nothing (contract puts the try/catch on the implementation)',
    threw === 'repository unreadable' && g.job('*').length === 0 && g.lease.outstanding().length === 0,
    canon({ threw, jobs: g.job('*').length, outstanding: g.lease.outstanding().length }))
}
{
  let live = 'def-live-1'
  const calls = []
  const reader = (scopeKey, name) => { calls.push(`${scopeKey}/${name}`); return live === null ? { ok: false, identity: 'unavailable' } : { ok: true, identity: live } }
  const obs = []
  const g = HEAD.createJobsGateway({ resolveDefinition: reader, onObserve: (o) => obs.push(o) })
  const r1 = g.admitJob({ jobId: 'p1', owner: OA, scopeKey: 'scope-A', toolName: 'bash' })
  live = 'def-live-2'
  const r2 = g.admitJob({ jobId: 'p2', owner: OA, scopeKey: 'scope-A', toolName: 'bash' })
  const pinnedNow = { p1: g.job('p1')[0].pinnedIdentity, p2: g.job('p2')[0].pinnedIdentity }
  const callsAtPinning = calls.slice()
  live = null
  const before = { jobs: g.job('*').length, outstanding: g.lease.outstanding().length, state: g.lease.state() }
  const r3 = g.admitJob({ jobId: 'p3', owner: OA, scopeKey: 'scope-A', toolName: 'bash' })
  const afterUnreadable = { jobs: g.job('*').length, outstanding: g.lease.outstanding().length, state: g.lease.state() }
  book('T2-admit-edge-live-read', 'pin omitted ⇒ the reader is consulted AT the admit edge (one read per admission) and each job pins what it read THEN (no caching, no first-read-wins)',
    r1.ok && r2.ok && pinnedNow.p1 === 'def-live-1' && pinnedNow.p2 === 'def-live-2' && callsAtPinning.length === 2,
    canon({ pinnedNow, callsAtPinning, callsAfterUnreadableAttempt: calls.length }))
  book('T2-neg-unreadable-mapping-rejected', 'NEGATIVE CONTROL: unreadable read ⇒ mapping-rejected with ZERO state delta (closed world: the two live leases and the job set are untouched, only an alarm)',
    r3.ok === false && r3.code === 'mapping-rejected' && afterUnreadable.jobs === before.jobs && afterUnreadable.outstanding === before.outstanding && afterUnreadable.state === before.state,
    canon({ refusal: r3, before, afterUnreadable, events: obs.map((o) => o.event) }))
}
{
  const obs = []
  const g = HEAD.createJobsGateway({ onObserve: (o) => obs.push(o) })
  const r = g.admitJob({ jobId: 'n1', owner: OA, scopeKey: 'scope-A', toolName: 'bash' })
  book('T2b-neg-no-reader', 'NEGATIVE CONTROL: no reader + pin omitted ⇒ mapping-rejected with ZERO state delta',
    r.ok === false && r.code === 'mapping-rejected' && g.job('*').length === 0 && g.lease.outstanding().length === 0 && obs.length === 1 && obs[0].event === 'gateway-admit-definition-unreadable',
    canon({ refusal: r, jobs: g.job('*').length, events: obs.map((o) => o.event) }))
  let calls = 0
  const g2 = HEAD.createJobsGateway({ resolveDefinition: () => { calls += 1; return { ok: false, identity: 'never' } } })
  const r2 = g2.admitJob({ jobId: 'n2', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
  book('T2c-explicit-pin-no-reader-call', 'explicit pin (fixture shape) passes through verbatim and never consults the reader',
    r2.ok === true && r2.job.pinnedIdentity === 'def-v1' && calls === 0, canon({ r: r2, calls }))
}
{
  const sink = []
  const lease = HEAD.createLeaseWindow((o) => sink.push(o.event))
  const g = HEAD.createJobsGateway({ lease, onObserve: () => {} })
  const sameObject = g.lease === lease
  g.admitJob({ jobId: 'l1', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
  const tokenOnAssemblyObject = lease.outstanding().map((t) => t.callId)
  const g2 = HEAD.createJobsGateway({ lease, onObserve: () => {} })
  const shared = g2.lease === lease && g2.lease.outstanding().map((t) => t.callId).join() === 'l1'
  const settle = g.observeDispatchEvent(DONE('l1')) // settle while ACTIVE, through the gateway
  const zeroed = lease.outstanding().map((t) => t.callId)
  const drained = lease.drain() // teardown starts on the ASSEMBLY object
  const admitAfterDrain = g.admitJob({ jobId: 'l2', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
  const rel1 = lease.release()
  book('T3-assembly-owns-window', 'gateway.lease === injected window; the assembly object drives settle/drain/release; no private shadow window; drain refuses new admits and release reaches RELEASED at self-counted zero',
    sameObject && shared && tokenOnAssemblyObject.join() === 'l1' && settle.ok === true && zeroed.length === 0
      && drained.ok === true && admitAfterDrain.ok === false && admitAfterDrain.code === 'gateway-not-active'
      && rel1.ok === true && lease.state() === 'RELEASED',
    canon({ sameObject, shared, tokenOnAssemblyObject, settle, zeroed, drained, admitAfterDrain, rel1, state: lease.state(), windowEvents: sink }))
  const lease2 = HEAD.createLeaseWindow(() => {})
  const g3 = HEAD.createJobsGateway({ lease: lease2, onObserve: () => {} })
  g3.admitJob({ jobId: 'l3', owner: OA, scopeKey: 'scope-A', toolName: 'bash', pinnedIdentity: 'def-v1' })
  lease2.drain()
  lease2.giveUp('assembly decided')
  const cross = g3.observeDispatchEvent(DONE('l3'))
  book('T3-giveup-on-assembly-object', 'giveUp on the injected object is terminal for the gateway too (cross-boundary settle refused, token outstanding, state GIVEN_UP)',
    lease2.state() === 'GIVEN_UP' && cross.ok === true && g3.job('l3')[0].state === 'settled' && lease2.outstanding().map((t) => t.callId).join() === 'l3',
    canon({ state: lease2.state(), cross, recordState: g3.job('l3')[0].state, outstanding: lease2.outstanding().map((t) => t.callId) }))
}
{
  const durable = new Map([['root-A|inst-A', { rootSessionId: 'root-A', instanceId: 'inst-A' }]])
  const identity = { resolve: (c) => durable.get(`${c.rootSessionId}|${c.instanceId}`) ?? null }
  let bashIdentity = 'def-live'
  const ledger = []
  const lease = HEAD.createLeaseWindow((o) => ledger.push({ from: 'window', event: o.event }))
  const g = HEAD.createJobsGateway({
    identity,
    lease,
    resolveDefinition: (scopeKey, name) => (name === 'bash' ? { ok: true, identity: bashIdentity } : { ok: false, identity: 'not-registered' }),
    onObserve: (o) => ledger.push({ from: 'gateway', event: o.event }),
  })
  const okA = g.admitJob({ jobId: 'q1', owner: OA, scopeKey: 'scope-A', toolName: 'bash' })
  const vetoB = g.admitJob({ jobId: 'q2', owner: OB, scopeKey: 'scope-B', toolName: 'bash' })
  const vetoTool = g.admitJob({ jobId: 'q3', owner: OA, scopeKey: 'scope-A', toolName: 'read_image' })
  bashIdentity = 'def-moved' // the Definition this job rides moves after admission
  const moved = g.onRegistryChange()
  book('T4-production-shape-chain', 'pc-CONTRACT §1.1 ⑤ chain: durable-confirmed owner + live pin admits; unconfirmed owner and unreadable definition both refuse with ZERO registration; a later move cancels exactly the one live job',
    okA.ok === true && okA.job.pinnedIdentity === 'def-live' && vetoB.code === 'owner-not-durable' && vetoTool.code === 'mapping-rejected'
      && g.job('*').length === 1 && lease.outstanding().map((t) => t.callId).join() === 'q1' && moved.map((c) => c.jobId).join() === 'q1',
    canon({ okA: { ok: okA.ok, pinned: okA.job.pinnedIdentity }, vetoB, vetoTool, moved, jobs: g.job('*').map((r) => r.jobId), outstanding: lease.outstanding().map((t) => t.callId), ledger }))
}

console.log('\n── verdict ──')
console.log(`booked=${results.length} failures=${failures}`)
writeFileSync(new URL('./review-PC-differential.json', import.meta.url), JSON.stringify({ at: new Date().toISOString(), base: 'd714a941 committed dist', head: 'ce44fd4e committed dist', results, failures }, null, 2) + '\n')
process.exit(failures === 0 ? 0 : 2)
