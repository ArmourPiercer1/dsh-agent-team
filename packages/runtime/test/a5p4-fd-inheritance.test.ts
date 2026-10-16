/**
 * a5p4-fd-inheritance — the FD-inheritance declaration set (C-PROC: FD 继承集
 * 显式声明) and the launcher-side law: default is CLOSE-ALL-UNDECLARED, the
 * CLOEXEC marker is a mechanism, not by itself the guarantee (plan §7: TOCTOU_A
 * 旧 FD 不追溯 ⇒ the launcher must close every unapproved inherited FD; 10-
 * landlock-lanes TOCTOU_A/B findings).
 *
 * The second block is the REAL P2 fork-not-exec leg: the reference launcher
 * compiles the ruleset in the parent, forks (no exec — CLOEXEC does not bite
 * across fork), the child closes all undeclared FDs, self-locks (restrict_self),
 * and reports per-FD identity from /proc/self/fd. On a kernel without the ABI
 * the leg answers `ABI-UNAVAILABLE` and the test pins the honest typed
 * degradation instead (no fake enforce, no red).
 *
 * @module packages/runtime/test/a5p4-fd-inheritance.test
 */

import { afterAll, describe, expect, it } from 'vitest'
import {
  compileFdPlan,
  fdPlanToPayload,
  FD_INHERIT_DEFAULT,
  INHERIT_PURPOSES,
  type DeclaredInheritedFd,
} from '../sandbox-provider/fd-inheritance.js'
import { runFdCloseProbe, type LauncherDeps } from '../sandbox-provider/probe-abi.js'
import { createDefaultLauncherDeps, makeScratchWorld, removeScratchWorld } from './a5p4-harness.js'

describe('a5p4 FD inheritance declaration set (pure)', () => {
  it('declares the closed purpose set (stdin/stdout/stderr/delivery)', () => {
    expect([...INHERIT_PURPOSES]).toEqual(['stdin', 'stdout', 'stderr', 'delivery'])
  })

  it('the inherit default is the constant close-all-undeclared — there is NO inherit-all arm', () => {
    expect(FD_INHERIT_DEFAULT).toBe('close-all-undeclared')
    const plan = compileFdPlan([])
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.plan.inheritDefault).toBe(FD_INHERIT_DEFAULT)
  })

  it('accepts a declared delivery FD set and preserves order', () => {
    const plan = compileFdPlan([
      { fd: 0, purpose: 'stdin', resourceFingerprint: 'sha256:aa' },
      { fd: 7, purpose: 'delivery', resourceFingerprint: 'sha256:bb' },
    ])
    expect(plan.ok).toBe(true)
    if (plan.ok) expect(plan.plan.declared.map((d) => d.fd)).toEqual([0, 7])
  })

  it('refuses: negative / non-integer / duplicate fds, off-closed-set purpose, empty fingerprint', () => {
    const cases = [
      [{ fd: -1, purpose: 'stdin', resourceFingerprint: 'x' }],
      [{ fd: 1.5, purpose: 'stdin', resourceFingerprint: 'x' }],
      [{ fd: 3, purpose: 'stdin', resourceFingerprint: 'x' }, { fd: 3, purpose: 'stdout', resourceFingerprint: 'y' }],
      [{ fd: 4, purpose: 'pipe-me', resourceFingerprint: 'x' }],
      [{ fd: 5, purpose: 'delivery', resourceFingerprint: '   ' }],
    ] as const
    for (const decl of cases) {
      // Deliberately off-schema inputs: cast away the input type on purpose —
      // the runtime law, not the compiler, is the referee for these legs.
      const r = compileFdPlan(decl as unknown as readonly DeclaredInheritedFd[])
      expect(r.ok, JSON.stringify(decl)).toBe(false)
    }
  })

  it('the launcher payload carries the close-all directive, not merely per-FD flags (CLOEXEC-is-mechanism law)', () => {
    const plan = compileFdPlan([{ fd: 7, purpose: 'delivery', resourceFingerprint: 'sha256:cc' }])
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const payload = fdPlanToPayload(plan.plan)
    expect(payload.inheritDefault).toBe('close-all-undeclared')
    expect(payload.declared).toEqual([{ fd: 7, purpose: 'delivery' }])
    // The directive is a DEFAULT-CLOSE instruction; there is no "keep the rest"
    // field the launcher could honour.
    expect(Object.keys(payload).sort()).toEqual(['declared', 'inheritDefault'])
  })
})

describe('a5p4 real FD-closure leg (P2 fork-not-exec handoff)', () => {
  const world = makeScratchWorld('fdclose')
  afterAll(() => removeScratchWorld(world))

  it('declared FD survives the child self-lock; an undeclared inherited FD is closed', () => {
    // The launcher reproduces the leak shape INSIDE its own trusted process:
    // two synthetic inherited FDs (CLOEXEC cleared, as a sloppy spawner would
    // leave them), ruleset compiled in the parent, fork WITHOUT exec, child
    // closes everything the payload does not declare, then self-locks.
    const deps: LauncherDeps = createDefaultLauncherDeps()
    const v = runFdCloseProbe(deps, world)
    if (v.verdict === 'ABI-UNAVAILABLE') {
      // Honest degradation is a PASS on hosts without the ABI: the probe says
      // so and claims no enforcement.
      expect(v.declaredSeen).toBeNull()
      expect(v.undeclaredClosed).toBeNull()
      return
    }
    expect(v.verdict).toBe('FD-CLOSURE-CONFIRMED')
    expect(v.declaredSeen).toBe(true)
    expect(v.undeclaredClosed).toBe(true)
  })
})
