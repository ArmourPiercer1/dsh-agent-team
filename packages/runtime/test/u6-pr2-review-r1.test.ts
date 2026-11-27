/**
 * U6 PR2 — REVIEW ROUND 1, PRESERVED: the non-Team native read control.
 *
 * WHAT THIS FILE IS NOW (Round 72, hosted-CI repair). It used to be the R1 fixes suite for the
 * retired execution route: the real `createTeamToolPlaneAssembly`, the real
 * `installScopedToolGuard` over the pinned scoped-registry double, and the Governance Center
 * kernel's lifecycle port. The A1 cut retired `tool-dispatch`, `governance-center` and the plane
 * assembly, so those legs retired WITH their subject (recorded per file in
 * `dev/agent-workflow/evidence/ute-a1/MIGRATED-SUITE-STATUS.md`, Round 72 table).
 *
 * ONE THING HERE IS NOT RETIRED, and CI demands it BY TEXT: the 保留非 Team Native 正控.
 * `scripts/eb3-ci-negative-controls.mjs` control `P1 non-Team-native-positive-preserved` requires
 * this file to carry
 *
 *     expect(run.bodies.length, 'non-Team native read rides on, unchanged').toBe(1)
 *
 * That assertion is a law about the CURRENT product, not about the retired route: an ordinary
 * (non-Team) install is never narrowed by Team governance. It is re-expressed over the seam the cut
 * left us with, and it is PAIRED with negative halves on the SAME double — the centre, installed for
 * a member whose compiled read lane denies the same read, stops the body; and a DISPOSED centre stops
 * narrowing anything. Without those halves "the body ran" could be true simply because the harness
 * cannot observe a refusal at all, which is the vacuous control the P1 law exists to prevent.
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
  definitionSource: '@deepseek-ai/dsh-tool-fs',
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

describe('R1 preserved — the non-Team native read rides on, and the centre can STOP it', () => {
  it('CI-03 control: WITHOUT a plane the native read rides on, unchanged', async () => {
    // No centre, no plane, no guard: the ordinary install. This is the preserved positive.
    const double = nativeRideDouble({ names: ['read', 'grep'] })
    const run = await double.runCall({ callId: 'ci03-read-1', name: 'read', args: { file_path: '/etc/hostname' } })
    expect(run.bodies.length, 'non-Team native read rides on, unchanged').toBe(1)
    expect(run.refusal).toBeUndefined()
  })

  it('NEGATIVE CONTROL: the SAME double, with the centre bound to a denying read lane, runs no body', async () => {
    // Proves the control above is not vacuous: same call, same double, ONE difference — the centre
    // is installed and the member's compiled read lane does not include the path.
    const double = nativeRideDouble({ names: ['read', 'grep'] })
    const centre = await installCentre(double.ctx, binding({ read: lane([], [], ['/work/out']) }))
    try {
      const run = await double.runCall({ callId: 'ci03-read-neg', name: 'read', args: { file_path: '/work/out/doc.txt' } })
      expect(run.bodies.length, 'a read the compiled lane denies never reaches its body').toBe(0)
      expect(String(run.verdict?.reason ?? '')).toMatch(/LANE_DENY/u)
      expect(centre.facts.length, 'the refusal was decided by the centre, and recorded').toBe(1)
    } finally {
      centre.dispose()
    }
  })

  it('the positive survives DISPOSAL: a removed point narrows nothing', async () => {
    // The third direction of the same law: Team governance is scoped to its own install. Removing it
    // restores the ordinary install exactly — a centre that kept refusing after disposal would be a
    // global narrowing, which is the thing the non-Team control forbids.
    const double = nativeRideDouble({ names: ['read', 'grep'] })
    const centre = await installCentre(double.ctx, binding({ read: lane([], [], ['/work/out']) }))
    centre.dispose()
    const run = await double.runCall({ callId: 'ci03-read-after', name: 'read', args: { file_path: '/work/out/doc.txt' } })
    expect(run.bodies.length, 'a disposed centre narrows nothing').toBe(1)
  })
})
