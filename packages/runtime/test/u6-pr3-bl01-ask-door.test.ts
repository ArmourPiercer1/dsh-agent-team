/**
 * U6 PR3 — BL-01, PRESERVED: the non-Team native bash control.
 *
 * WHAT THIS FILE IS NOW (Round 72, hosted-CI repair). It used to re-test the BL-01 ask-penetration
 * breach against the retired execution route: the real `createTeamToolPlaneAssembly` plus
 * `installScopedToolGuard`, a REAL confined backend and scripted Control legs. The A1 cut retired
 * `tool-dispatch`, `governance-center`, the plane assembly and the PA control legs, so the ask-lane
 * and door legs retired WITH their subject (recorded per file in
 * `dev/agent-workflow/evidence/ute-a1/MIGRATED-SUITE-STATUS.md`, Round 72 table) — the surviving
 * ask lane is the centre's approval port, whose own arms live in `vnext-admission.test.mjs`.
 *
 * ONE THING HERE IS NOT RETIRED, and CI demands it BY TEXT: the 保留非 Team Native 正控.
 * `scripts/eb3-ci-negative-controls.mjs` control `P1 non-Team-native-positive-preserved` requires
 * this file to carry
 *
 *     expect(run.bodies.length, 'non-Team native bash rides on, unchanged').toBe(1)
 *
 * That is a law about the CURRENT product: an ordinary (non-Team) install is never narrowed. It is
 * re-expressed here over the host's own `tools/pre-execute` + `tools.guard` seam, PAIRED with a
 * negative half on the SAME double — the centre, installed for a member whose compiled tool-level
 * EXECUTION authorization DENIES the shell, stops the spawn (round 75: execution authority, never a
 * working directory; a cwd is not a permission). Without the negative half the positive could be true
 * merely because the harness cannot observe a refusal, which is the vacuous control the P1 law exists
 * to prevent.
 */
import { describe, expect, it } from 'vitest'
import { nativeRideDouble } from './native-ride-double.mjs'
import type { AdmissionHostContext } from '../src/plugin/vnext/admission-port.mjs'

const lane = (allow: readonly string[] = [], ask: readonly string[] = [], deny: readonly string[] = []) =>
  ({ mode: 'restricted', allow, ask, deny })

/** A compiled member binding: the shape the centre's lane algebra reads. */
const binding = (over: Record<string, unknown> = {}) => ({
  agentId: 'agent-m1',
  sessionId: 'session-m1',
  instanceGeneration: 1,
  read: lane(['/work/in']),
  write: lane(['/work/in']),
  workspaceRoot: '/work/in',
  executors: { 'confined-subprocess': 'ready' },
  perTool: {
    bash: {
      authorization: 'allow',
      execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' },
    },
  },
  definitionSource: '@deepseek-ai/dsh-tool-shell',
  policyGeneration: 'gen-7',
  blueprintRevision: 'rev-2',
  owner: 'team-root-1',
  ...over,
})

/** Install the CURRENT centre on the double, wired to one member whose lanes `bound` describes. */
const installCentre = async (ctx: AdmissionHostContext, bound: Record<string, unknown>) => {
  const { installAdmissionPoint } = await import('../src/plugin/vnext/admission-port.mjs')
  const facts: unknown[] = []
  const dispose = installAdmissionPoint({
    ctx,
    resolveBinding: () => bound,
    record: (fact: unknown) => { facts.push(fact) },
  })
  return { facts, dispose }
}

describe('BL-01 preserved — the non-Team native bash rides on, and the centre can STOP it', () => {
  it('CI-03 control: WITHOUT a plane the native bash rides on, unchanged', async () => {
    // No centre, no plane, no guard: the ordinary install. This is the preserved positive, and it is
    // the direct counterweight to CI-05 ("a governed agent's shell never silently rides the native
    // body"): the refusal exists only where the centre is installed.
    const double = nativeRideDouble({ names: ['bash', 'grep'] })
    const run = await double.runCall({ callId: 'ci03-bash-1', name: 'bash', args: { command: 'true', cwd: '/work/in' } })
    expect(run.bodies.length, 'non-Team native bash rides on, unchanged').toBe(1)
    expect(run.refusal).toBeUndefined()
  })

  it('NEGATIVE CONTROL: the SAME double, with the centre bound to a DENYING execution authorization, spawns nothing', async () => {
    // Same call, same double, ONE difference — the centre is installed and the compiled tool-level
    // execution authorization for `bash` is `deny`. Zero bodies is "the spawn gate never opened", the
    // BL-01 shape stated at the seam that survives. The cwd is irrelevant to the decision.
    const double = nativeRideDouble({ names: ['bash', 'grep'] })
    const centre = await installCentre(double.ctx, binding({ perTool: { bash: { authorization: 'deny', execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' } } } }))
    try {
      const run = await double.runCall({ callId: 'ci03-bash-neg', name: 'bash', args: { command: 'true', cwd: '/work/out' } })
      expect(run.bodies.length, 'a shell the compiled execution authorization denies never reaches a spawn').toBe(0)
      expect(String(run.verdict?.reason ?? '')).toMatch(/ADMISSION_EXECUTION_DENIED/u)
      expect(centre.facts.length, 'the refusal was decided by the centre, and recorded').toBe(1)
    } finally {
      centre.dispose()
    }
  })

  it('the positive survives DISPOSAL: a removed point narrows nothing', async () => {
    const double = nativeRideDouble({ names: ['bash', 'grep'] })
    const centre = await installCentre(double.ctx, binding({ perTool: { bash: { authorization: 'deny', execution: { implementationOrigin: 'dsh-native', executionBoundary: 'confined-subprocess' } } } }))
    centre.dispose()
    const run = await double.runCall({ callId: 'ci03-bash-after', name: 'bash', args: { command: 'true', cwd: '/work/out' } })
    expect(run.bodies.length, 'a disposed centre narrows nothing').toBe(1)
  })
})
