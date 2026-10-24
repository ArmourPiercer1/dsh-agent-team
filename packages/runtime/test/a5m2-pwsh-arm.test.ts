/**
 * a5m2-pwsh-arm.test.ts — the governed PWSH arm class (CENTER source card,
 * root FIXED scope 2026-10-24). Linux world ⇒ the suite is author-side
 * STRUCTURE/GOVERNANCE legs + honest negative ENV legs (a typed ENV refusal
 * class is the CORRECT answer here, never a pass) + win32-SHAPE legs over
 * injected transport seams (unit-level doubles for the spawn transport ONLY;
 * the win32/ENV gates stay the module's own law — mocks 不替生产, and real
 * PowerShell acceptance is marked ENV-NOT-AVAILABLE below, skip ≠ pass).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createGovernedPwshArm,
  PWSH_FAMILY_ID,
  PWSH_EFFECT_FOREGROUND,
  PWSH_EFFECT_BACKGROUND,
} from '../src/plugin/live/governed-families/pwsh-arm.mjs'

interface Cl { ok?: boolean, code?: string, plan: Record<string, unknown> }
const cls = (c: unknown): Cl => c as Cl

const GOOD_PROOF = { kind: 'allow', consumedProof: { grant: { grantId: 'g-1' } } }

function arm (over: Record<string, unknown> = {}) {
  const calls: Record<string, unknown[]> = { pa: [], fg: [], bg: [], spill: [] }
  const deps: Record<string, unknown> = {
    declared: () => true,
    platform: () => 'win32',
    jobsFace: () => true,
    fsExists: () => false,
    which: () => 'C:\\shim\\pwsh.exe',
    consumePaAtBody: (exec: unknown, plan: unknown) => { (calls.pa as unknown[]).push([exec, plan]); return GOOD_PROOF },
    spawnForeground: async (argv: unknown, opts: unknown) => { (calls.fg as unknown[]).push([argv, opts]); return { ok: true, exitCode: 0, stdout: 'hello', stderr: '' } },
    startBackground: async (argv: unknown, opts: unknown) => { (calls.bg as unknown[]).push([argv, opts]); return { jobId: 'job-1' } },
    spillObserver: (a: unknown) => { (calls.spill as unknown[]).push(a) },
    ...over,
  }
  return { a: createGovernedPwshArm(deps as never), calls }
}

describe('a5m2 governed pwsh arm', () => {
  it('(a) config law BOTH directions: no declared mount = the factory refuses to build; declared = the arm shape is closed and frozen', () => {
    expect(() => createGovernedPwshArm({ declared: () => false } as never)).toThrow(/never built|NOT declared|config law/i)
    const { a } = arm()
    expect(Object.isFrozen(a)).toBe(true)
    expect(a.name).toBe('pwsh')
    expect(a.familyId).toBe(PWSH_FAMILY_ID)
    expect(typeof a.classify).toBe('function')
    expect(typeof a.execute).toBe('function')
    expect(typeof a.drain).toBe('function')
    expect(a.providerId).toBe('a5p5-plane')
  })

  it('(b) closed keys per mount shape: unknown key refused; run_in_background exists ONLY with the jobs mount; effect vocabulary is the CLOSED route-records set (no invented kinds)', () => {
    const fgOnly = arm({ jobsFace: () => false })
    expect(cls(fgOnly.a.classify({ command: 'Get-Date', description: 'show time' })).ok).toBe(true)
    expect(cls(fgOnly.a.classify({ command: 'x', description: 'd', run_in_background: true })).code).toBe('PWSH_INPUT_KEYS_UNKNOWN')
    expect(cls(fgOnly.a.classify({ command: 'x', description: 'd', evil: 1 })).code).toBe('PWSH_INPUT_KEYS_UNKNOWN')
    expect(cls(fgOnly.a.classify({ description: 'd' })).code).toBe('PWSH_INPUT_COMMAND_MISSING')
    const withJobs = arm()
    const bgCls = cls(withJobs.a.classify({ command: 'x', description: 'd', run_in_background: true }))
    expect(bgCls.ok).toBe(true)
    expect(bgCls.plan.effects).toEqual([...PWSH_EFFECT_BACKGROUND])
    expect(cls(withJobs.a.classify({ command: 'x', description: 'd' })).plan.effects).toEqual([...PWSH_EFFECT_FOREGROUND])
    expect(PWSH_EFFECT_FOREGROUND).toEqual(['shell-exec-powershell-win32'])
    expect(PWSH_EFFECT_BACKGROUND).toEqual(['shell-exec-powershell-win32', 'bg-jobs'])
  })

  it('(c) REAL negative ENV legs on THIS host (no injected platform, no injected probe): the answer is the typed ENV class with sideEffectPossible:false — never a pass', async () => {
    const real = createGovernedPwshArm({ declared: () => true, consumePaAtBody: () => { throw new Error('PA must never be entered on an ENV refusal') } } as never)
    const classified = cls(real.classify({ command: 'Get-Date', description: 'show time' }))
    expect(classified.ok).toBe(true)
    const answer = await real.execute({ callId: 'env-1' }, classified.plan as never)
    // this Linux world either fails the platform gate or the binary gate —
    // both are the honest ENV refusal class; a pass here WOULD BE the fake:
    expect(answer.kind).toBe('deny')
    expect(['PWSH_ENV_UNSUPPORTED_PLATFORM', 'PWSH_ENV_BINARY_UNRESOLVED']).toContain((answer as { code?: string }).code)
    expect((answer as { sideEffectPossible?: boolean }).sideEffectPossible).toBe(false)
    const detail = String(real.execute).length > 0
    expect(detail).toBe(true)
  })

  it('(d) deny lanes before any PA entry; the PA seat keeps the sibling proof law — bool/no-witness/deny/throw all refuse with ZERO spawn; the good witness runs REAL argv', async () => {
    const env = arm({ platform: () => 'linux' })
    const c = cls(env.a.classify({ command: 'x', description: 'd' }))
    expect(await env.a.execute({}, c.plan as never)).toMatchObject({ code: 'PWSH_ENV_UNSUPPORTED_PLATFORM' })
    expect(env.calls.pa).toHaveLength(0)
    const nobin = arm({ fsExists: () => false, which: () => undefined })
    expect(await nobin.a.execute({}, c.plan as never)).toMatchObject({ code: 'PWSH_ENV_BINARY_UNRESOLVED' })
    expect(nobin.calls.pa).toHaveLength(0)
    const bgNoJobs = arm({ jobsFace: () => false })
    const bgPlan = { ...c.plan, background: true }
    expect(await bgNoJobs.a.execute({}, bgPlan as never)).toMatchObject({ code: 'PWSH_ENV_JOBS_UNMOUNTED' })
    expect(bgNoJobs.calls.pa).toHaveLength(0)

    for (const bad of [true, false, null, 'allow', { kind: 'allow' }, { kind: 'deny', code: 'GRANT_STALE' }]) {
      const h = arm({ consumePaAtBody: () => bad })
      const r = await h.a.execute({}, c.plan as never)
      expect(r.kind).toBe('deny')
      expect(h.calls.fg).toHaveLength(0)
    }
    const good = arm()
    const r = await good.a.execute({ callId: 'run-1' }, c.plan as never)
    expect(r).toMatchObject({ kind: 'allow', mode: 'foreground', exitCode: 0 })
    expect(good.calls.fg).toHaveLength(1)
    const fgCalls = good.calls.fg as unknown[][]
    const [argv] = fgCalls[0] as [string[]]
    expect(argv).toContain('-NoProfile')
    expect(argv[argv.length - 1]).toBe('x')
    expect(good.calls.spill).toHaveLength(1) // successful foreground ONLY
  })

  it('(e) spill law + background + late cancellation: no spill on failure/background; background returns the REAL job id; a post-consume abort is a REAL side effect, never rolled back', async () => {
    const fail = arm({ spawnForeground: async () => ({ exitCode: 1, stdout: '', stderr: 'boom' }) })
    const c = cls(fail.a.classify({ command: 'x', description: 'd' }))
    const r1 = await fail.a.execute({}, c.plan as never)
    expect(r1).toMatchObject({ exitCode: 1, sideEffectPossible: true })
    expect(fail.calls.spill).toHaveLength(0)
    const bg = arm()
    const bgc = cls(bg.a.classify({ command: 'x', description: 'd', run_in_background: true }))
    const r2 = await bg.a.execute({}, bgc.plan as never)
    expect(r2).toMatchObject({ mode: 'background', jobId: 'job-1', sideEffectPossible: true })
    expect(bg.calls.spill).toHaveLength(0)
    const aborted = arm({ spawnForeground: async () => ({ exitCode: null, stdout: '', stderr: '' }) })
    const signal = { aborted: true }
    const r3 = await aborted.a.execute({ signal }, cls(aborted.a.classify({ command: 'x', description: 'd' })).plan as never)
    expect(r3).toMatchObject({ sideEffectPossible: true, cancelledAfterStart: true })
  })

  it('(f) REAL PowerShell acceptance leg — ENV-NOT-AVAILABLE on this host (skip is NOT pass): recorded honestly, so the ledger never reads this suite as win32 proof', async () => {
    const probe = createGovernedPwshArm({ declared: () => true } as never)
    const c = cls(probe.classify({ command: 'Get-Process', description: 'list processes' }))
    const real = await probe.execute({}, c.plan as never)
    const marked = real.kind === 'deny' && String(real.code).startsWith('PWSH_ENV_') ? 'ENV-NOT-AVAILABLE' : 'UNEXPECTED-PASS'
    expect(marked).toBe('ENV-NOT-AVAILABLE')
    expect(c.plan.effects).toEqual([...PWSH_EFFECT_FOREGROUND])
  })

  it('(g) source law: M0 citations + the four law surfaces are cited where the code claims them; the effect set stays the closed FC-SHL-P vocabulary', () => {
    const here = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(here, '..', 'src', 'plugin', 'live', 'governed-families', 'pwsh-arm.mjs'), 'utf8')
    expect(src).toContain('TOOL-CAPABILITY-MATRIX-9b2.md :33')
    expect(src).toContain('route-records-v3c.json FC-SHL-P')
    expect(src).toContain('shell-exec-powershell-win32')
    expect(src).toContain('bg-jobs')
    expect(src).toContain('leaderExecEnvelopeOps')
    expect(src).toContain("s6-remote.ts:489")
    expect(src).toContain('agent-bindings :528-536')
    expect(src).toContain('PWSH_ENV_UNSUPPORTED_PLATFORM')
    // no invented kinds anywhere in the module:
    const kinds = src.match(/'([a-z0-9]+(?:-[a-z0-9]+)+)'/g) ?? []
    const effectKinds = [...new Set(kinds.filter((k) => /shell-exec|bg-jobs|fs-|net-|egress|write|read/.test(k)))]
    expect(effectKinds.sort()).toEqual(["'bg-jobs'", "'shell-exec-powershell-win32'"].sort())
  })
})
