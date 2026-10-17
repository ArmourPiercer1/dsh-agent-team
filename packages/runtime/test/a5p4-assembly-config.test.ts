/**
 * a5p4-assembly-config — the PR4/5 INSTALL-ROUND seam (pb-CONTRACT.md §1):
 * the provider's production entry parameters come from the ASSEMBLY CONFIG
 * (`ProviderOptions.assembly`), not from hardcoded paths. Legs:
 *  1. `verifyLauncherIntegrity` — the pure byte-pin verdicts (match /
 *     mismatch / unreadable / malformed pin), injected `read` (no fs race).
 *  2. The configured launcher path is what reaches the launcher seam:
 *     argv[0] of EVERY launcher invocation is `assembly.launcherPath`
 *     (the honest face for the install surface, where tsc emit carries no
 *     `.py` and the W4 row had to rewrite argv[0] through the deps spy).
 *  3. The byte-pin gate ordering (launcher sha 校验路径): a WRONG pin
 *     refuses `SANDBOX_UNAVAILABLE` before any probe leg and with ZERO
 *     launcher invocations; bytes swapped between a clean prepare and the
 *     execute are caught by the re-gate and never reach `run`.
 *  4. The ABI pin floor: a measured version below `minAbiVersion` refuses
 *     before any process exists; at/above the floor proceeds.
 *  5. ABSENT assembly keeps the historical lane default byte-for-byte
 *     (module-relative launcher copy, `A5P4_PYTHON`/python3) — the DORMANT
 *     face is unchanged.
 *
 * All process-visible facts flow through the PUBLIC injected `deps` seam
 * (counting fake); no real launcher runs in this spec (the real-bytes legs
 * are the W4-extract evidence, `evidence/alpha5/prod/`).
 *
 * @module packages/runtime/test/a5p4-assembly-config
 */

import { afterAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createConfinedProcessProvider, type ProviderDeps, type SpawnRequest } from '../sandbox-provider/provider.js'
import { verifyLauncherIntegrity } from '../sandbox-provider/probe-abi.js'
import { makeScratchWorld, removeScratchWorld } from './a5p4-harness.js'

const world = makeScratchWorld('assembly')
afterAll(() => removeScratchWorld(world))

const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')

/** Counting fake (same shape as a5p4-provider): every launcher invocation visible. */
function fakeDeps(result: { rc: number | null; stdout: string; stderr: string }, abiVersion: number | null = 4): ProviderDeps & { calls: string[][] } {
  const calls: string[][] = []
  return {
    calls,
    availability: () => ({
      rows: [
        { subject: 'python3', present: true, note: 'precondition check: fake injected' },
        { subject: 'launcher-script', present: true, note: 'precondition check: fake injected' },
      ],
    }),
    run: (argv) => {
      calls.push([...argv])
      return result
    },
    probeFacts: () => ({
      abiVersion,
      legs: {
        selective: { leg: 'selective', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        denyall: { leg: 'denyall', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        badhandled: { leg: 'badhandled', verdict: 'DEMO-CONFIRMED', rc: 0, checks: [] },
      },
    }),
  }
}

const baseRequest = (over: Partial<SpawnRequest>): SpawnRequest => ({
  grantFingerprint: 'sha256:grant-assembly-0001',
  realmId: 'realm-assembly',
  bindingId: 'binding-asm',
  memberScope: 'member/asm',
  argv: ['/bin/true'],
  cwd: world,
  env: [['PATH', '/usr/bin:/bin']],
  ...over,
})

/** A launcher answer the provider's execute() accepts (out_ref carries the payload text). */
function execAnswer(pid: number, outText: string): { rc: number; stdout: string; stderr: string; outFile: string } {
  const outFile = join(world, `out-${String(pid)}-${Math.random().toString(36).slice(2, 8)}.txt`)
  writeFileSync(outFile, outText)
  return { rc: 0, stdout: JSON.stringify({ rc: 0, pid, executed: true, out_ref: outFile, err_ref: outFile }), stderr: '', outFile }
}

describe('a5p4 verifyLauncherIntegrity (pure byte-pin verdicts)', () => {
  const bytes = new TextEncoder().encode('#!/usr/bin/env python3\n# trusted launcher bytes\n')
  const pinned = sha256(bytes)
  const read = (path: string): Uint8Array => {
    if (path === '/missing/launcher.py') throw new Error('ENOENT: no such file or directory')
    return bytes
  }
  it('PINNED-MATCH only on the exact bytes', () => {
    const v = verifyLauncherIntegrity({ launcherPath: '/x/launcher.py', launcherSha256: pinned, read })
    expect(v.kind).toBe('PINNED-MATCH')
    expect(v.observed).toBe(pinned)
  })
  it('PIN-MISMATCH names BOTH hashes (public byte-hash facts, never a silent pass)', () => {
    const v = verifyLauncherIntegrity({ launcherPath: '/x/launcher.py', launcherSha256: sha256('other bytes'), read })
    expect(v.kind).toBe('PIN-MISMATCH')
    expect(v.detail).toContain(sha256('other bytes'))
    expect(v.detail).toContain(pinned)
  })
  it('UNREADABLE refuses closed (no fs read race in this leg)', () => {
    const v = verifyLauncherIntegrity({ launcherPath: '/missing/launcher.py', launcherSha256: pinned, read })
    expect(v.kind).toBe('UNREADABLE')
    expect(v.observed).toBe(null)
  })
  it('INVALID-PIN: a malformed pin is a configuration defect, refused closed', () => {
    for (const bad of ['', 'not-hex', pinned.slice(0, 63)]) {
      const v = verifyLauncherIntegrity({ launcherPath: '/x/launcher.py', launcherSha256: bad, read })
      expect(v.kind).toBe('INVALID-PIN')
    }
  })
  it('the real fs read path hashes the file bytes (production default `read`)', () => {
    const file = join(world, 'integrity-realfs.py')
    writeFileSync(file, bytes)
    const v = verifyLauncherIntegrity({ launcherPath: file, launcherSha256: pinned })
    expect(v.kind).toBe('PINNED-MATCH')
    const off = verifyLauncherIntegrity({ launcherPath: file, launcherSha256: sha256('tamper') })
    expect(off.kind).toBe('PIN-MISMATCH')
  })
})

describe('a5p4 provider assembly config (public deps seam observed)', () => {
  it('assembly.launcherPath is the path the launcher seam sees (argv[0], every call) — not the hardcoded source-tree copy', async () => {
    const configured = join(world, 'trusted', 'landlock-prelauncher.py')
    const answer = execAnswer(4242, 'ASSEMBLY-OK')
    const deps = fakeDeps(answer)
    const provider = createConfinedProcessProvider({
      realmId: 'realm-assembly',
      trustRoot: 'sha256:0000000000000000#evidence',
      scratchRoot: world,
      deps,
      assembly: { launcherPath: configured, pythonPath: '/assembly/bin/python3.11' },
    })
    const r = await provider.spawn(baseRequest({}))
    expect(r.ok).toBe(true)
    expect(deps.calls.length).toBeGreaterThan(0)
    for (const argv of deps.calls) expect(argv[0]).toBe(configured)
    if (r.ok) {
      expect(r.value.output.stdout).toBe('ASSEMBLY-OK')
      expect(r.value.receipt.processIdentity).toContain('pid:4242')
      expect(r.value.lease.status).toBe('terminated')
    }
  })

  it('launcher sha 校验路径 ①: a WRONG pin refuses SANDBOX_UNAVAILABLE before any probe leg, ZERO launcher invocations', async () => {
    const file = join(world, 'pinned-wrong.py')
    writeFileSync(file, '# real bytes\n')
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const provider = createConfinedProcessProvider({
      realmId: 'realm-assembly',
      trustRoot: null,
      scratchRoot: world,
      deps,
      assembly: { launcherPath: file, launcherSha256: sha256('the bytes the assembler actually trusts') },
    })
    const p = await provider.probe()
    expect(p.ok).toBe(false)
    if (!p.ok) {
      expect(p.error.code).toBe('SANDBOX_UNAVAILABLE')
      expect(p.error.message).toContain('launcher integrity gate')
    }
    expect(deps.calls).toEqual([]) // no probe leg, no preflight through `run`, no spawn — closed before anything ran
    const s = await provider.spawn(baseRequest({}))
    expect(s.ok).toBe(false)
    expect(deps.calls).toEqual([])
  })

  it('launcher sha 校验路径 ②: bytes swapped AFTER a clean prepare never reach `run` (execute re-gate; the plan stays unconsumed)', async () => {
    const file = join(world, 'pinned-swap.py')
    const good = '# trusted bytes v1\n'
    writeFileSync(file, good)
    const answer = execAnswer(777, 'SHOULD-NOT-RUN')
    const deps = fakeDeps(answer)
    const provider = createConfinedProcessProvider({
      realmId: 'realm-assembly',
      trustRoot: null,
      scratchRoot: world,
      deps,
      assembly: { launcherPath: file, launcherSha256: sha256(good) },
    })
    const prepared = await provider.prepare(baseRequest({}))
    expect(prepared.ok).toBe(true)
    writeFileSync(file, '# TAMPERED bytes v2\n')
    if (prepared.ok) {
      const r = await provider.execute(prepared.value)
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.error.code).toBe('SANDBOX_UNAVAILABLE')
      const execCalls = deps.calls.filter((argv) => argv[1] === '--confined-exec')
      expect(execCalls).toEqual([]) // the swapped bytes were never executed
      // restore the trusted bytes: the SAME (unburned) plan runs now
      writeFileSync(file, good)
      const again = await provider.execute(prepared.value)
      expect(again.ok).toBe(true)
      const execCalls2 = deps.calls.filter((argv) => argv[1] === '--confined-exec')
      expect(execCalls2.length).toBe(1)
      // one-shot law stands: a THIRD execute of the consumed plan still refuses
      const third = await provider.execute(prepared.value)
      expect(third.ok).toBe(false)
    }
  })

  it('ABI pin floor: measured below assembly.minAbiVersion ⇒ typed refusal before any process; at the floor ⇒ proceeds', async () => {
    const below = fakeDeps({ rc: 0, stdout: '', stderr: '' }, 4)
    const pLow = createConfinedProcessProvider({
      realmId: 'realm-assembly',
      trustRoot: null,
      scratchRoot: world,
      deps: below,
      assembly: { minAbiVersion: 6 },
    })
    const rLow = await pLow.prepare(baseRequest({}))
    expect(rLow.ok).toBe(false)
    if (!rLow.ok) {
      expect(rLow.error.code).toBe('SANDBOX_UNAVAILABLE')
      expect(rLow.error.message).toContain('below the assembly-pinned floor v6')
    }
    expect(below.calls).toEqual([])

    const at = fakeDeps(execAnswer(9001, 'ABI-OK'), 4)
    const pAt = createConfinedProcessProvider({
      realmId: 'realm-assembly',
      trustRoot: null,
      scratchRoot: world,
      deps: at,
      assembly: { minAbiVersion: 4 },
    })
    const rAt = await pAt.spawn(baseRequest({}))
    expect(rAt.ok).toBe(true)
  })

  it('ABSENT assembly keeps the historical default face: module-relative source-tree launcher, no pins, every gate open', async () => {
    const deps = fakeDeps(execAnswer(1, 'DEFAULT'))
    const provider = createConfinedProcessProvider({
      realmId: 'realm-assembly',
      trustRoot: null,
      scratchRoot: world,
      deps,
    })
    const r = await provider.spawn(baseRequest({}))
    expect(r.ok).toBe(true)
    expect(deps.calls.length).toBeGreaterThan(0)
    for (const argv of deps.calls) {
      expect(argv[0]?.replace(/\\/g, '/')).toMatch(/sandbox-provider\/launcher\/landlock-prelauncher\.py$/)
    }
  })
})
