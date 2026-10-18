/**
 * a5p4-provider — the confined-process provider seam over the lane: the frozen
 * `ConfinedProcessProvider` shape (probe / spawn / requestCancellation /
 * settleTermination, mirrored structurally in the lane contract stub), the
 * NO-FALLBACK law (capability short → typed refusal BEFORE any process
 * exists — zero process creations, observed through the injected seam), the
 * prepare/execute phase split (plan PoC-4c: async launch may hold the split,
 * never a fake-sync handle), and one REAL P1 confined-exec leg (entry
 * self-lock, then exec the untrusted argv; deny-path raw word inside the
 * confined child).
 *
 * @module packages/runtime/test/a5p4-provider.test
 */

import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { PassThrough } from 'node:stream'
import { join } from 'node:path'
import {
  createConfinedProcessProvider,
  type ProviderDeps,
  type ProviderLease,
  type SpawnRequest,
} from '../sandbox-provider/provider.js'
import { compileFdPlan } from '../sandbox-provider/fd-inheritance.js'
import {

  makeScratchWorld,
  removeScratchWorld,
} from './a5p4-harness.js'

const world = makeScratchWorld('provider')
afterAll(() => removeScratchWorld(world))

/** A counting fake: every process creation attempt is visible. */
function fakeDeps(result: { rc: number | null; stdout: string; stderr: string }): ProviderDeps & { calls: string[][] } {
  const calls: string[][] = []
  return {
    calls,
    availability: () => ({ rows: [{ subject: 'python3', present: true, note: 'precondition check: fake injected' }] }),
    run: (argv) => {
      calls.push([...argv])
      return result
    },
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

const baseRequest = (over: Partial<SpawnRequest>): SpawnRequest => ({
  grantFingerprint: 'sha256:grant-0001',
  realmId: 'realm-provider',
  bindingId: 'binding-a',
  memberScope: 'member/a',
  argv: ['/bin/true'],
  cwd: world,
  env: [['PATH', '/usr/bin:/bin']],
  ...over,
})

describe('a5p4 provider no-fallback law (fake seam — zero process creations)', () => {
  it('hard-required dimension WITHOUT enforcement rows ⇒ IO_POLICY_UNSUPPORTED/SANDBOX_UNAVAILABLE and NOTHING ran', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    ;(deps as { probeFacts: () => unknown }).probeFacts = () => ({ abiVersion: null, legs: {} }) // no enforcement evidence at all
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
      hardDimensions: ['content-read'],
    })
    const r = await provider.spawn(baseRequest({}))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(['IO_POLICY_UNSUPPORTED', 'SANDBOX_UNAVAILABLE']).toContain(r.error.code)
    expect(deps.calls).toEqual([]) // the refusal happened BEFORE any process existed
  })

  it('a denied network profile refuses pre-spawn even with full FS enforcement (network never rides on FS bits)', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
      hardDimensions: ['content-read'],
    })
    const r = await provider.spawn(baseRequest({ networkProfile: 'deny' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(deps.calls).toEqual([])
  })

  it('an empty argv array is a typed refusal (argv is an explicit array, never a shell string, never empty)', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
    })
    const r = await provider.spawn(baseRequest({ argv: [] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message.toLowerCase()).toContain('argv')
    expect(deps.calls).toEqual([])
  })

  it('an undeclared FD plan is refused at prepare (the closed-set FD law bites before execute)', () => {
    const r = compileFdPlan([{ fd: 0, purpose: 'syscall' as never, resourceFingerprint: 'x' }])
    expect(r.ok).toBe(false)
  })

  it('prepare/execute is a real split: prepare yields a plan WITHOUT a process; execute consumes it exactly once', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
      hardDimensions: ['content-read'],
    })
    const prepared = await provider.prepare(baseRequest({}))
    expect(prepared.ok).toBe(true)
    expect(deps.calls).toEqual([]) // prepare compiles, never runs
    if (!prepared.ok) return
    expect(prepared.value.phase).toBe('prepared')
    const first = await provider.execute(prepared.value)
    expect(first.ok).toBe(true)
    expect(deps.calls.length).toBe(1)
    // one-shot: a consumed plan cannot be re-executed (a second execute would
    // be an ungranted re-spawn, not a resume).
    const second = await provider.execute(prepared.value)
    expect(second.ok).toBe(false)
    expect(deps.calls.length).toBe(1)
  })
})

describe('a5p4 provider REAL confined-exec leg (P1 entry self-lock)', () => {
  it('confines the untrusted argv under a scratch policy: deny-path read refused inside the child, allowed write ok', async () => {
    mkdirSync(join(world, 'allow'), { recursive: true })
    mkdirSync(join(world, 'deny'), { recursive: true })
    writeFileSync(join(world, 'deny', 'secret.txt'), 'TOP-SECRET-DO-NOT-LEAK\n')
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
    })
    const probe = await provider.probe()
    const enforced = probe.ok && probe.value.some((r) => r.dimension === 'content-read' && r.level === 'enforced')
    if (!enforced) {
      // No landlock on this host (or probe refused): nothing may be claimed —
      // and a hard-required spawn must fail closed with ZERO process.
      const hard = createConfinedProcessProvider({
        realmId: 'realm-provider',
        trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
        scratchRoot: world,
        hardDimensions: ['content-read'],
      })
      const denied = await hard.spawn(baseRequest({}))
      expect(denied.ok).toBe(false)
      return
    }
    const plan = compileFdPlan([])
    expect(plan.ok).toBe(true)
    const r = await provider.spawn(
      baseRequest({
        argv: ['/bin/sh', '-c', 'cat deny/secret.txt 2>&1; printf ok > allow/w.txt && cat allow/w.txt'],
        allowPaths: [{ path: join(world, 'allow'), accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, removeFile: true, truncate: true } }],
      }),
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.receipt.processIdentity).toMatch(/pid:\d+/)
    // The confined child must NOT be able to read the denied file, whatever it
    // says about the allowed one.
    const out = r.value.output
    expect(out.combined).toContain('Permission denied')
    expect(out.combined).not.toContain('TOP-SECRET')
    expect(out.combined).toContain('ok')
    expect(r.value.lease.status).toBe('terminated')
  }, 30_000)
})

// ---------------------------------------------------------------------------
// Root 09:43Z round: two review notes land as provider laws.
// (1) fd 3 (L3d): a DECLARED fd 3 used to compile, then the launcher closed
// its own channel and the declaration silently died. The refusal moved to the
// declaration face — `prepare()`, shared by the one-shot and the streaming
// arm, BEFORE any plan or process exists, and the refusal burns no grant.
// (2) note (b): `leases`/`streamRuns` were append-only — a LONG-LIVED
// provider (one realm, many calls) grew without bound (this lane has no
// long-lived world, so nothing was observed; the fix is booked before the
// growth could bite). Terminal settles now retire the frozen record into a
// FIFO-bounded audit ledger and drain both live maps to zero.
// ---------------------------------------------------------------------------
describe('a5p4 provider fd-3 refusal face (review L3d)', () => {
  it('a plan DECLARING fd 3 is refused typed BEFORE any process exists — both arms share prepare(); zero stream spawns; no grant burned', async () => {
    let streamAttempts = 0
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    ;(deps as { spawnStream?: unknown }).spawnStream = (): unknown => {
      streamAttempts += 1
      return { ok: false, error: { code: 'SANDBOX_UNAVAILABLE', message: 'test fake: never spawns' } }
    }
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
    })
    const declared = { declaredFds: [{ fd: 3, purpose: 'delivery' as const, resourceFingerprint: 'sha256:marker' }] }
    const oneShot = await provider.spawn(baseRequest({ ...declared }))
    expect(oneShot.ok).toBe(false)
    if (!oneShot.ok) {
      expect(oneShot.error.code).toBe('IO_POLICY_UNSUPPORTED')
      expect(oneShot.error.message).toContain('fd-launcher-owned') // the refusal names itself
    }
    const stream = await provider.spawnStreaming(baseRequest({ ...declared }))
    expect(stream.ok).toBe(false)
    if (!stream.ok) expect(stream.error.message).toContain('fd-launcher-owned')
    expect(deps.calls).toEqual([]) // one-shot arm: ZERO process creations
    expect(streamAttempts).toBe(0) // stream arm: refused at prepare — the launcher never saw a pipe
    // the refusal is not a burn: the SAME provider still prepares + runs a legal request untouched
    const good = await provider.spawn(baseRequest({}))
    expect(good.ok).toBe(true)
    expect(deps.calls.length).toBe(1)
  })
})

describe('a5p4 provider bounded settled-lease ledger (review note (b))', () => {
  it('24 one-shot cycles on one long-lived provider (cap 8): live maps stay zero, the ledger is FIFO-capped, inside-horizon leases answer idempotently, evicted ones are honestly forgotten', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '{"executed":true,"rc":0}', stderr: '' })
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
      settledLedgerCap: 8,
    })
    const issued: { lease: ProviderLease }[] = []
    for (let i = 0; i < 24; i += 1) {
      const r = await provider.spawn(baseRequest({ grantFingerprint: `sha256:cycle-${i}` }))
      expect(r.ok, `cycle ${i}`).toBe(true)
      if (r.ok) issued.push({ lease: r.value.lease })
      const bk = provider.bookkeeping()
      expect(bk.liveLeases, 'a one-shot lease is born terminal — it never occupies the live map').toBe(0)
      expect(bk.streamRuns).toBe(0)
      expect(bk.settledLedger).toBeLessThanOrEqual(bk.settledLedgerCap)
    }
    expect(provider.bookkeeping().settledLedger).toBe(8)
    const recent = issued.slice(-8)
    const evicted = issued.slice(0, 16)
    const settledAgain = await provider.settleTermination(recent[7]!.lease, true)
    expect(settledAgain.ok).toBe(true)
    if (settledAgain.ok) expect(settledAgain.value.status).toBe('terminated')
    const cancelAgain = await provider.requestCancellation(recent[0]!.lease)
    expect(cancelAgain.ok).toBe(true) // inside the horizon: the idempotent answer survives via the ledger
    if (cancelAgain.ok) expect(cancelAgain.value.status).toBe('terminated')
    const forgotten = await provider.requestCancellation(evicted[0]!.lease)
    expect(forgotten.ok).toBe(false) // beyond the horizon: refused by name, never a silent ok
    if (!forgotten.ok) expect(forgotten.error.message).toContain(evicted[0]!.lease.leaseId)
  })

  it('a streaming settle releases BOTH live maps and retires the record to the ledger; unconfirmed stays LIVE until a terminal settle; request/terminate stay idempotent after the retire', async () => {
    const deadPid = 4_194_303 // above this world's live pid range: pidAlive() is honestly false
    const fakeStream = (): unknown => {
      const pt = (): PassThrough => new PassThrough()
      const handshake = new PassThrough()
      handshake.write(`{"stream":true,"pid":${deadPid}}\n`)
      return {
        ok: true,
        value: Object.freeze({
          pid: deadPid,
          stdin: pt(),
          stdout: pt(),
          stderr: pt(),
          handshake,
          kill: (): boolean => true,
          exit: Promise.resolve({ code: 0, signal: null }),
        }),
      }
    }
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    ;(deps as { spawnStream?: unknown }).spawnStream = fakeStream
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
    })
    const h = await provider.spawnStreaming(baseRequest({}), { handshakeTimeoutMs: 5_000 })
    expect(h.ok).toBe(true)
    if (!h.ok) return
    expect(provider.bookkeeping().liveLeases).toBe(1) // active: a LIVE claim
    const unconfirmed = await provider.settleTermination(h.value.lease, false)
    expect(unconfirmed.ok).toBe(true)
    if (unconfirmed.ok) expect(unconfirmed.value.status).toBe('termination-unconfirmed')
    expect(provider.bookkeeping().liveLeases).toBe(1) // unconfirmed is NOT retired — the upgrade path stays live
    const settled = await provider.settleTermination(h.value.lease, true)
    expect(settled.ok).toBe(true)
    if (settled.ok) expect(settled.value.status).toBe('terminated')
    const bk = provider.bookkeeping()
    expect(bk.liveLeases).toBe(0)
    expect(bk.streamRuns).toBe(0) // the live process handle was RELEASED at the terminal settle
    expect(bk.settledLedger).toBe(1)
    const cancelAfter = await provider.requestCancellation(h.value.lease)
    expect(cancelAfter.ok).toBe(true) // idempotent through the ledger
    if (cancelAfter.ok) expect(cancelAfter.value.status).toBe('terminated')
    const terminateAfter = await h.value.terminate({ graceMs: 50, deadlineMs: 1_000 })
    expect(terminateAfter.ok).toBe(true)
    if (terminateAfter.ok) expect(terminateAfter.value.status).toBe('terminated')
    // and the terminate-DRIVEN path (the dispose leg of a policyChange cycle) drains too:
    const h2 = await provider.spawnStreaming(baseRequest({ grantFingerprint: 'sha256:term-leg' }), { handshakeTimeoutMs: 5_000 })
    expect(h2.ok).toBe(true)
    if (!h2.ok) return
    const done = await h2.value.terminate({ graceMs: 50, deadlineMs: 3_000 })
    expect(done.ok).toBe(true)
    if (done.ok) expect(done.value.status).toBe('terminated')
    expect(provider.bookkeeping().streamRuns).toBe(0)
    expect(provider.bookkeeping().settledLedger).toBe(2)
  }, 30_000)
})

/**
 * #337 STEP B — R1 TRUSTED COMPLETION RECORD (root ruling 20:12Z, item ①). The
 * streaming handle carries the launcher's out-of-band exit record. The binding
 * is threefold and mechanical: the record lives in THIS plan's freshly made
 * `<out-dir>` (`provider.ts:575-576` — one unique `planId`, mkdir BEFORE the
 * spawn, the payload can never reach it: the confined ruleset never grants it),
 * the record's `pid` must equal the handshake pid (`provider.ts:705-715`), and
 * the provider reads only AFTER the launcher is observed dead — the launcher's
 * own law writes `exit.json` after `waitpid` and BEFORE it exits
 * (`landlock-prelauncher.py:501-505` precede `:513`/`:528`), so an observed
 * death means a complete write (single O_TRUNC writer; no second writer exists).
 * The fake conforms to the real stream-process shape the probes recorded:
 * PassThrough pipes, the `{"stream":true,"pid":N}` fd-3 handshake line, a
 * scripted `exit` promise — and the record is written through the SAME
 * `--out-dir` token the real launcher receives on argv (`provider.ts:695`).
 */
describe('a5p4 provider R1 — the trusted exit record (streaming arm)', () => {
  const FAKE_PID = 4_194_300 // above this world's live pid range, like the sibling legs

  const streamFake = (writeRecord: ((outDir: string) => void) | null) =>
    (argv: readonly string[]): unknown => {
      const idx = argv.indexOf('--out-dir')
      const outDir = idx >= 0 ? String(argv[idx + 1]) : ''
      const handshake = new PassThrough()
      handshake.write(`{"stream":true,"pid":${FAKE_PID}}\n`)
      const pt = (): PassThrough => new PassThrough()
      // the launcher law, replayed: record FIRST, death second (the write
      // precedes the launcher's own exit — the reader must never race a partial write)
      let settleExit!: (v: { code: number | null; signal: string | null }) => void
      const exit = new Promise<{ code: number | null; signal: string | null }>((res) => { settleExit = res })
      queueMicrotask(() => {
        if (writeRecord !== null && outDir !== '') writeRecord(outDir)
        settleExit({ code: 0, signal: null })
      })
      return {
        ok: true,
        value: Object.freeze({ pid: FAKE_PID, stdin: pt(), stdout: pt(), stderr: pt(), handshake, kill: (): boolean => true, exit }),
      }
    }

  const providerFor = (writeRecord: ((outDir: string) => void) | null) => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    ;(deps as { spawnStream?: unknown }).spawnStream = streamFake(writeRecord)
    return createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
    })
  }

  const openHandle = async (provider: ReturnType<typeof providerFor>, grant: string) => {
    const h = await provider.spawnStreaming(baseRequest({ grantFingerprint: `sha256:${grant}` }), { handshakeTimeoutMs: 5_000 })
    expect(h.ok, `spawnStreaming for ${grant}`).toBe(true)
    if (!h.ok) return null
    return h.value
  }

  it('R1: a recorded rc arrives VERBATIM (0 / 2 / a signal death as -9), and the streaming arm declares itself record-capable', async () => {
    for (const rc of [0, 2, -9] as const) {
      const provider = providerFor((outDir) => { writeFileSync(join(outDir, 'exit.json'), JSON.stringify({ pid: FAKE_PID, rc })) })
      const handle = await openHandle(provider, `r1-rc-${String(rc)}`)
      expect(handle).not.toBeNull()
      if (handle === null) return
      // line-proof of the promise: provider.ts:695 passes --out-dir UNCONDITIONALLY
      // on the stream argv; the launcher writes the record after waitpid (:501-505).
      expect(handle.recordCapable).toBe(true)
      const rec = await handle.payloadExit
      expect(rec).toEqual({ form: 'recorded', rc, pid: FAKE_PID })
      const done = await handle.terminate({ graceMs: 20, deadlineMs: 2_000 })
      expect(done.ok).toBe(true)
    }
  }, 30_000)

  it('R1 negative controls: missing / malformed / oversize / pid-mismatch arrive as their OWN forms — fail-closed material, never a silent success and never a guessed rc', async () => {
    const forms: Array<{ grant: string; write: ((outDir: string) => void) | null; want: Record<string, unknown> }> = [
      { grant: 'r1-missing', write: null, want: { form: 'missing' } },
      { grant: 'r1-malformed', write: (d) => { writeFileSync(join(d, 'exit.json'), 'not-json{') }, want: { form: 'unparsable', reason: 'malformed' } },
      { grant: 'r1-oversize', write: (d) => { writeFileSync(join(d, 'exit.json'), 'x'.repeat(8192)) }, want: { form: 'unparsable', reason: 'oversize' } },
      { grant: 'r1-mismatch', write: (d) => { writeFileSync(join(d, 'exit.json'), JSON.stringify({ pid: FAKE_PID + 7, rc: 0 })) }, want: { form: 'pid-mismatch', recordPid: FAKE_PID + 7 } },
      { grant: 'r1-rc-not-integer', write: (d) => { writeFileSync(join(d, 'exit.json'), JSON.stringify({ pid: FAKE_PID, rc: '0' })) }, want: { form: 'unparsable', reason: 'malformed' } },
    ]
    for (const f of forms) {
      const provider = providerFor(f.write)
      const handle = await openHandle(provider, f.grant)
      expect(handle).not.toBeNull()
      if (handle === null) return
      const rec = await handle.payloadExit
      expect(rec, f.grant).toEqual(f.want)
      const done = await handle.terminate({ graceMs: 20, deadlineMs: 2_000 })
      expect(done.ok).toBe(true)
    }
  }, 60_000)

  it('R1 boundary: the record never touches the old faces — the ONE-SHOT arm stays the legitimate no-record form (its rc travels in the emit frame, launcher :420; receipt shape byte-for-byte unchanged)', async () => {
    const deps = fakeDeps({ rc: 0, stdout: JSON.stringify({ executed: true, rc: 0, pid: 1, out_ref: 'x', err_ref: 'y' }), stderr: '' })
    const provider = createConfinedProcessProvider({
      realmId: 'realm-provider',
      trustRoot: 'git:alpha5-pr4-prov:sandbox-provider/launcher',
      scratchRoot: world,
      deps: deps as unknown as ProviderDeps,
    })
    const r = await provider.spawn(baseRequest({ grantFingerprint: 'sha256:r1-oneshot-shape' }))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const flat = JSON.stringify({ receipt: r.value.receipt, output: r.value.output, lease: r.value.lease })
    expect(flat).not.toContain('payloadExit')
    expect(flat).not.toContain('recordCapable')
    expect(Object.keys(r.value.receipt).sort()).toEqual(['lease', 'processIdentity'])
  })
})
