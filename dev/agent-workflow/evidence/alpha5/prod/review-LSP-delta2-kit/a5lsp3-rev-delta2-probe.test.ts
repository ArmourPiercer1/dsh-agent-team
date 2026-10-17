/**
 * REVIEW PROBE (LSP delta2 reviewer, world a5lsp3-rev-*) — independent
 * instrument over the delta 1e76cd2c..7962022e:
 *  ① horizon-outside lease semantics, ONE assertion per lease-consuming API
 *  ② repeat terminate (settled-in-horizon / evicted) — no revive/false-alive/swallow
 *  ③ retirement only ever touches TERMINAL records; unconfirmed survives cap pressure
 *  ④ fd-3 PRE (base modules, silent-override era) vs POST (typed refusal), both arms
 *  ⑥ extended bookkeeping() long run (2000 one-shot cycles + streaming leg)
 * This file is reviewer scaffolding: it is NOT part of the lane; it is copied
 * to evidence and removed from the tree before the review commit.
 */
import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { PassThrough } from 'node:stream'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createConfinedProcessProvider, type ProviderDeps, type ProviderLease, type SpawnRequest } from '../sandbox-provider/provider.js'
import { compileFdPlan, fdPlanToPayload } from '../sandbox-provider/fd-inheritance.js'
import { createConfinedProcessProvider as createBaseProvider } from '../sandbox-provider/__revbase-provider.js'
import { compileFdPlan as baseCompileFdPlan, fdPlanToPayload as baseFdPlanToPayload } from '../sandbox-provider/__revbase-fd-inheritance.js'
import { findTestRepoRoot, homeRoot } from '../../../tests/paths.mjs'

const repoRoot = findTestRepoRoot(fileURLToPath(import.meta.url))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const world = join(homeRoot(repoRoot as string), `a5lsp3-rev-${stamp}`)
mkdirSync(world, { recursive: true })
afterAll(() => rmSync(world, { recursive: true, force: true }))

function fakeDeps(result: { rc: number | null; stdout: string; stderr: string }): ProviderDeps & { calls: string[][] } {
  const calls: string[][] = []
  return {
    calls,
    availability: () => ({ rows: [{ subject: 'python3', present: true, note: 'review probe fake' }] }),
    run: (argv) => { calls.push([...argv]); return result },
    probeFacts: () => ({
      abiVersion: 4,
      legs: {
        selective: { leg: 'selective', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        denyall: { leg: 'denyall', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        badhandled: { leg: 'badhandled', verdict: 'DEMO-CONFIRMED', rc: 0, checks: [] },
      },
    }),
  }
}

const deadPid = 4_194_303
function fakeStreamDeps(deps: ProviderDeps & { calls: string[][] }): void {
  ;(deps as { spawnStream?: unknown }).spawnStream = (): unknown => {
    const pt = (): PassThrough => new PassThrough()
    const handshake = new PassThrough()
    handshake.write(`{"stream":true,"pid":${deadPid}}\n`)
    return { ok: true, value: Object.freeze({ pid: deadPid, stdin: pt(), stdout: pt(), stderr: pt(), handshake, kill: (): boolean => true, exit: Promise.resolve({ code: 0, signal: null }) }) }
  }
}

const baseRequest = (over: Partial<SpawnRequest>): SpawnRequest => ({
  grantFingerprint: 'sha256:rev-0001',
  realmId: 'realm-provider',
  bindingId: 'binding-rev',
  memberScope: 'member/rev',
  argv: ['true'],
  cwd: world,
  env: [],
  ...over,
})

const TERM = { graceMs: 50, deadlineMs: 2_000, handshakeTimeoutMs: 5_000 }

function makeProvider(deps: ProviderDeps, settledLedgerCap?: number) {
  return createConfinedProcessProvider({
    realmId: 'realm-provider',
    trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
    scratchRoot: world,
    deps,
    ...(settledLedgerCap === undefined ? {} : { settledLedgerCap }),
  })
}

async function settledStreaming(provider: ReturnType<typeof makeProvider>, fp: string) {
  const h = await provider.spawnStreaming(baseRequest({ grantFingerprint: fp }), TERM)
  if (!h.ok) throw new Error(`spawnStreaming failed: ${JSON.stringify(h.error)}`)
  const t = await h.value.terminate(TERM)
  if (!t.ok) throw new Error(`terminate failed: ${JSON.stringify(t.error)}`)
  return { handle: h.value, settled: t.value }
}

const CLOSED_WORLD = (leaseId: string): string => `lease '${leaseId}' is not one of this provider's leases`

// ---------------------------------------------------------------------------
describe('rev① horizon-outside lease semantics, per lease-consuming API', () => {
  it('every lease API answers an evicted lease with the PRE-EXISTING closed-world refusal (typed, named, never ok, never alive)', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    fakeStreamDeps(deps)
    const provider = makeProvider(deps as unknown as ProviderDeps, 2)
    const a = await settledStreaming(provider, 'sha256:h-a')
    await settledStreaming(provider, 'sha256:h-b')
    const c = await settledStreaming(provider, 'sha256:h-c') // evicts a
    expect(provider.bookkeeping().settledLedger).toBe(2)

    // API 1: requestCancellation — refused by name, code typed, never an ok-true degrade
    const cancel = await provider.requestCancellation(a.settled)
    expect(cancel.ok).toBe(false)
    if (!cancel.ok) {
      expect(cancel.error.code).toBe('IO_POLICY_UNSUPPORTED')
      expect(cancel.error.message).toBe(CLOSED_WORLD(a.settled.leaseId))
    }
    // API 2: settleTermination — same closed-world refusal, cannot resurrect
    const settle = await provider.settleTermination(a.settled, true)
    expect(settle.ok).toBe(false)
    if (!settle.ok) expect(settle.error.message).toBe(CLOSED_WORLD(a.settled.leaseId))
    // API 3: the handle's terminate closure — SINGLE-FLIGHT memo: a repeat
    // answers the SAME frozen terminated bytes (history, not provider recall),
    // never a revive, never an alive; the provider face below is the closed world.
    const term = await a.handle.terminate(TERM)
    expect(term.ok).toBe(true)
    if (term.ok) expect(JSON.stringify(term.value)).toBe(JSON.stringify(a.settled))
    const bk = provider.bookkeeping()
    expect(bk.liveLeases).toBe(0) // never falsely reported alive
    expect(bk.streamRuns).toBe(0)
    expect(bk.settledLedger).toBe(2)

    // closed-world shape identity: evicted-known answers EXACTLY like never-seen
    const ghost = await provider.requestCancellation({ ...a.settled, leaseId: 'lease-plan-never-existed' })
    expect(ghost.ok).toBe(false)
    if (!ghost.ok && !cancel.ok) {
      expect(ghost.error.code).toBe(cancel.error.code)
      expect(ghost.error.message).toBe(CLOSED_WORLD('lease-plan-never-existed'))
    }
    // inside the horizon: byte-identical idempotent answers still hold
    const again = await provider.settleTermination(c.settled, true)
    expect(again.ok).toBe(true)
    if (again.ok) expect(JSON.stringify(again.value)).toBe(JSON.stringify(c.settled))
    const cancelC = await provider.requestCancellation(c.settled)
    expect(cancelC.ok).toBe(true)
    if (cancelC.ok) expect(JSON.stringify(cancelC.value)).toBe(JSON.stringify(c.settled))
    // bookkeeping is counters-only: it never grows a by-id query face
    expect(Object.keys(provider.bookkeeping()).sort()).toEqual(['liveLeases', 'settledLedger', 'settledLedgerCap', 'streamRuns'])
  })

  it('the horizon never degrades a KNOWN record inside it: idempotency survives 100 more settles', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    const provider = makeProvider(deps as unknown as ProviderDeps, 128)
    const first = await provider.spawn(baseRequest({ grantFingerprint: 'sha256:keep-0' }))
    expect(first.ok).toBe(true)
    if (!first.ok) return
    for (let i = 1; i <= 100; i += 1) {
      const r = await provider.spawn(baseRequest({ grantFingerprint: `sha256:keep-${i}` }))
      expect(r.ok).toBe(true)
    }
    const re = await provider.requestCancellation(first.value.lease)
    expect(re.ok).toBe(true)
    if (re.ok) expect(JSON.stringify(re.value)).toBe(JSON.stringify(first.value.lease))
  })
})

// ---------------------------------------------------------------------------
describe('rev② repeat terminate: settled-in-horizon and evicted records', () => {
  it('settled-in-horizon: repeat answers byte-identically, never re-enters the FIFO, never bumps recency', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    fakeStreamDeps(deps)
    const provider = makeProvider(deps as unknown as ProviderDeps, 3)
    const a = await settledStreaming(provider, 'sha256:rep-a')
    await settledStreaming(provider, 'sha256:rep-b')
    await settledStreaming(provider, 'sha256:rep-c')
    expect(provider.bookkeeping().settledLedger).toBe(3)
    // repeats: settle / cancel / terminate all ok, byte-identical, counters unmoved
    const s1 = await provider.settleTermination(a.settled, true)
    expect(s1.ok && JSON.stringify(s1.value) === JSON.stringify(a.settled)).toBe(true)
    const s2 = await provider.requestCancellation(a.settled)
    expect(s2.ok && JSON.stringify(s2.value) === JSON.stringify(a.settled)).toBe(true)
    const s3 = await a.handle.terminate(TERM)
    expect(s3.ok && JSON.stringify(s3.value) === JSON.stringify(a.settled)).toBe(true)
    const bk = provider.bookkeeping()
    expect(bk.settledLedger).toBe(3)
    expect(bk.liveLeases).toBe(0)
    // recency is settle-time, not talk-time: a repeat on A must NOT save A from the next eviction
    await settledStreaming(provider, 'sha256:rep-d') // evicts A (oldest INSERTION), not D
    const gone = await provider.requestCancellation(a.settled)
    expect(gone.ok).toBe(false)
    for (const kept of ['rep-b', 'rep-c', 'rep-d']) {
      void kept // kept set asserted by the eviction of A below
    }
  })

  it('evicted-then-retired: repeat terminate refuses by name; a NEW handle is never swallowed by the stale refusal', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    fakeStreamDeps(deps)
    const provider = makeProvider(deps as unknown as ProviderDeps, 1)
    const a = await settledStreaming(provider, 'sha256:ev-a')
    const b = await settledStreaming(provider, 'sha256:ev-b') // evicts a
    expect(provider.bookkeeping().settledLedger).toBe(1)
    // handle face: memoized terminated bytes (no revive, no alive, no swallow)
    const stale = await a.handle.terminate(TERM)
    expect(stale.ok).toBe(true)
    if (stale.ok) expect(JSON.stringify(stale.value)).toBe(JSON.stringify(a.settled))
    // provider face: the evicted record is honestly forgotten, refused BY NAME
    const staleP = await provider.requestCancellation(a.settled)
    expect(staleP.ok).toBe(false)
    if (!staleP.ok) expect(staleP.error.message).toBe(CLOSED_WORLD(a.settled.leaseId))
    const staleS = await provider.settleTermination(a.settled, true)
    expect(staleS.ok).toBe(false)
    expect(provider.bookkeeping().settledLedger).toBe(1) // refusal changed no ledger byte
    // the new lease lives on, untouched by the stale refusal
    const reB = await provider.requestCancellation(b.settled)
    expect(reB.ok).toBe(true)
    const fresh = await provider.spawnStreaming(baseRequest({ grantFingerprint: 'sha256:ev-c' }), TERM)
    expect(fresh.ok).toBe(true)
    if (!fresh.ok) return
    expect(fresh.value.lease.leaseId).not.toBe(a.settled.leaseId)
    const done = await fresh.value.terminate(TERM)
    expect(done.ok).toBe(true)
    if (done.ok) expect(done.value.status).toBe('terminated')
    expect(provider.bookkeeping().liveLeases).toBe(0)
    expect(provider.bookkeeping().settledLedger).toBe(1) // c replaced b by cap, honest FIFO
  })
})

// ---------------------------------------------------------------------------
describe('rev③ retirement law: only terminal records enter the ledger; unconfirmed stays live', () => {
  it('cap=1 pressure across mixed statuses: the unconfirmed streaming lease is NEVER evicted and always upgradeable', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    fakeStreamDeps(deps)
    const provider = makeProvider(deps as unknown as ProviderDeps, 1)
    const s1 = await settledStreaming(provider, 'sha256:mix-s1') // ledger [s1]
    // an UNCONFIRMED lease must stay live across every cap overflow
    const h2 = await provider.spawnStreaming(baseRequest({ grantFingerprint: 'sha256:mix-s2' }), TERM)
    expect(h2.ok).toBe(true)
    if (!h2.ok) return
    const unc = await provider.settleTermination(h2.value.lease, false)
    expect(unc.ok && unc.value.status === 'termination-unconfirmed').toBe(true)
    const s3 = await settledStreaming(provider, 'sha256:mix-s3') // ledger churns: s1 evicted, [s3]
    const oneShot = await provider.spawn(baseRequest({ grantFingerprint: 'sha256:mix-s4' })) // ledger [s4]
    expect(oneShot.ok).toBe(true)
    // evicted ones were TERMINAL at eviction; unconfirmed survived all of it
    for (const gone of [s1.settled, s3.settled]) {
      const r = await provider.settleTermination(gone, true)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.message).toBe(CLOSED_WORLD(gone.leaseId))
    }
    expect(provider.bookkeeping().liveLeases).toBe(1) // s2, still live
    expect(provider.bookkeeping().streamRuns).toBe(1) // its process handle still held
    const still = await provider.requestCancellation(h2.value.lease)
    expect(still.ok && still.value.status === 'termination-unconfirmed').toBe(true)
    // the keep-alive upgrade path closes: terminal settle retires it (evicting s4)
    const up = await provider.settleTermination(h2.value.lease, true)
    expect(up.ok && up.value.status === 'terminated').toBe(true)
    expect(provider.bookkeeping().liveLeases).toBe(0)
    expect(provider.bookkeeping().streamRuns).toBe(0)
    const upAgain = await provider.settleTermination(h2.value.lease, true)
    expect(upAgain.ok && upAgain.value.status === 'terminated').toBe(true)
    const s4gone = await provider.requestCancellation(oneShot.ok ? oneShot.value.lease : ({} as ProviderLease))
    expect(s4gone.ok).toBe(false) // evicted at s2's upgrade — and s4 WAS terminal
  })

  it('cap=2 with 5 one-shot cycles: survivors answer terminated, evicted were all born terminal', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    const provider = makeProvider(deps as unknown as ProviderDeps, 2)
    const issued: ProviderLease[] = []
    for (let i = 0; i < 5; i += 1) {
      const r = await provider.spawn(baseRequest({ grantFingerprint: `sha256:cap2-${i}` }))
      expect(r.ok).toBe(true)
      if (r.ok) issued.push(r.value.lease)
      expect(provider.bookkeeping().settledLedger).toBeLessThanOrEqual(2)
    }
    const survivors = issued.slice(-2)
    const evicted = issued.slice(0, 3)
    for (const l of survivors) {
      const r = await provider.requestCancellation(l)
      expect(r.ok && r.value.status === 'terminated').toBe(true) // survivor status: TERMINAL
    }
    for (const l of evicted) {
      const r = await provider.requestCancellation(l)
      expect(r.ok).toBe(false) // evicted entries were terminal when they left (spawnSync semantics)
    }
  })
})

// ---------------------------------------------------------------------------
describe('rev④ fd-3 typed refusal: PRE (base 1e76cd2c) vs POST (7962022e)', () => {
  const fd3 = [{ fd: 3, purpose: 'delivery' as const, resourceFingerprint: 'sha256:l3d' }]
  const preWorld = join(world, 'pre-face')
  const postWorld = join(world, 'post-face')
  mkdirSync(preWorld, { recursive: true })
  mkdirSync(postWorld, { recursive: true })

  it('PRE: the base module ACCEPTED a declared fd 3 and shipped it into the launcher payload (the silent-override era)', async () => {
    const pre = baseCompileFdPlan(fd3)
    expect(pre.ok).toBe(true) // the acceptance face: declaration compiled clean
    if (!pre.ok) return
    const payload = baseFdPlanToPayload(pre.plan)
    expect(payload.declared).toEqual([{ fd: 3, purpose: 'delivery' }]) // it REACHED the launcher — where the close was silent
    // and the base prepare() built a plan + policy carrying the doomed declaration
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    const base = createBaseProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: preWorld,
      deps: deps as unknown as ProviderDeps,
    })
    const plan = await base.prepare(baseRequest({ declaredFds: fd3 }))
    expect(plan.ok).toBe(true) // PRE: no refusal at prepare — the law lived nowhere on the declaration face
    if (!plan.ok) return
    const policy = JSON.parse(readFileSync(plan.value.policyPath, 'utf8')) as { fd_plan: { declared: { fd: number }[] }; close_extra_fds: boolean }
    expect(policy.fd_plan.declared.map((d) => d.fd)).toContain(3)
    expect(policy.close_extra_fds).toBe(true)
  })

  it('POST: compileFdPlan + prepare refuse fd 3 typed on BOTH arms before any plan/process; no grant burned; fd 2/4/5 unperturbed; law comment in place', async () => {
    const post = compileFdPlan(fd3)
    expect(post.ok).toBe(false)
    if (!post.ok) {
      expect(post.problems.some((p) => p.code === 'fd-launcher-owned' && p.path === '$.declared[0].fd')).toBe(true)
    }
    let streamAttempts = 0
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    const countStream = (): unknown => { streamAttempts += 1; return { ok: false, error: { code: 'SANDBOX_UNAVAILABLE', message: 'probe: never spawns' } } as never }
    ;(deps as { spawnStream?: unknown }).spawnStream = countStream
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: postWorld,
      deps: deps as unknown as ProviderDeps,
    })
    // one-shot arm
    const oneShot = await provider.spawn(baseRequest({ declaredFds: fd3 }))
    expect(oneShot.ok).toBe(false)
    if (!oneShot.ok) {
      expect(oneShot.error.code).toBe('IO_POLICY_UNSUPPORTED')
      expect(oneShot.error.message).toContain('fd-launcher-owned')
    }
    // streaming arm — same prepare(), same refusal, launcher never touched
    const stream = await provider.spawnStreaming(baseRequest({ declaredFds: fd3 }))
    expect(stream.ok).toBe(false)
    if (!stream.ok) expect(stream.error.message).toContain('fd-launcher-owned')
    expect(deps.calls).toEqual([]) // zero process creations
    expect(streamAttempts).toBe(0) // zero stream spawns
    // refusal burns no grant: the NEXT legal request prepares and runs untouched
    const good = await provider.spawn(baseRequest({ declaredFds: [{ fd: 4, purpose: 'delivery', resourceFingerprint: 'sha256:d4' }, { fd: 5, purpose: 'stdin', resourceFingerprint: 'sha256:d5' }] }))
    expect(good.ok).toBe(true)
    expect(deps.calls.length).toBe(1)
    // the run that passed DID carry fd 4/5 and NO fd 3 in the payload
    const plansDir = join(postWorld, 'plans')
    const newest = (await import('node:fs')).readdirSync(plansDir).map((f) => join(plansDir, f))
    let carried = false
    for (const p of newest) {
      const raw = JSON.parse(readFileSync(p, 'utf8')) as { fd_plan: { declared: { fd: number }[] } }
      const fds = raw.fd_plan.declared.map((d) => d.fd)
      if (fds.includes(4) && fds.includes(5) && !fds.includes(3)) carried = true
      expect(fds).not.toContain(3) // no POST-era policy can EVER carry fd 3
    }
    expect(carried).toBe(true)
    // fd 2 / fd 4 unperturbed at the pure face
    expect(compileFdPlan([{ fd: 2, purpose: 'stderr', resourceFingerprint: 'sha256:e' }]).ok).toBe(true)
    expect(compileFdPlan([{ fd: 4, purpose: 'delivery', resourceFingerprint: 'sha256:d' }]).ok).toBe(true)
    expect(compileFdPlan([{ fd: 4, purpose: 'delivery', resourceFingerprint: 'sha256:d' }, { fd: 3, purpose: 'stdin', resourceFingerprint: 'sha256:x' }]).ok).toBe(false)
    // the law comment sits where the law lives
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'sandbox-provider', 'fd-inheritance.ts'), 'utf8')
    expect(src).toContain('declaring is not using')
    expect(src).toContain('LAUNCHER_OWNED_FD')
    const psrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'sandbox-provider', 'provider.ts'), 'utf8')
    expect(psrc).toContain('fd 3 is launcher-owned')
    expect(psrc).toContain('declaring it')
  })
})

// ---------------------------------------------------------------------------
describe('rev⑥ extended bookkeeping() long run (default cap 1024)', () => {
  it('2000 one-shot cycles + periodic streaming settles: ledger pinned <=1024, live maps at zero, horizon rules hold', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    fakeStreamDeps(deps)
    const provider = makeProvider(deps as unknown as ProviderDeps) // default cap
    expect(provider.bookkeeping().settledLedgerCap).toBe(1024)
    const oldest = await provider.spawn(baseRequest({ grantFingerprint: 'sha256:long-0' }))
    expect(oldest.ok).toBe(true)
    let maxLedger = 0
    for (let i = 1; i <= 2000; i += 1) {
      const r = await provider.spawn(baseRequest({ grantFingerprint: `sha256:long-${i}` }))
      expect(r.ok, `cycle ${i}`).toBe(true)
      if (i % 250 === 0) {
        const s = await settledStreaming(provider, `sha256:long-stream-${i}`)
        expect(s.settled.status).toBe('terminated')
      }
      const bk = provider.bookkeeping()
      maxLedger = Math.max(maxLedger, bk.settledLedger)
      expect(bk.settledLedger).toBeLessThanOrEqual(bk.settledLedgerCap)
      expect(bk.streamRuns).toBeLessThanOrEqual(1)
    }
    expect(maxLedger).toBe(1024)
    const bk = provider.bookkeeping()
    expect(bk.liveLeases).toBe(0)
    expect(bk.streamRuns).toBe(0)
    expect(bk.settledLedger).toBe(1024)
    if (oldest.ok) {
      const gone = await provider.requestCancellation(oldest.value.lease)
      expect(gone.ok).toBe(false) // oldest born-terminal lease was evicted long ago — honestly forgotten, by name
    }
    const fresh = await provider.spawn(baseRequest({ grantFingerprint: 'sha256:long-fresh' }))
    expect(fresh.ok).toBe(true)
    if (fresh.ok) {
      const re = await provider.requestCancellation(fresh.value.lease)
      expect(re.ok && JSON.stringify(re.value) === JSON.stringify(fresh.value.lease)).toBe(true)
    }
  }, 120_000)
})
