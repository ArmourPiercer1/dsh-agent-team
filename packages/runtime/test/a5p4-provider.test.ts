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
import { join } from 'node:path'
import {
  createConfinedProcessProvider,
  type ProviderDeps,
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
