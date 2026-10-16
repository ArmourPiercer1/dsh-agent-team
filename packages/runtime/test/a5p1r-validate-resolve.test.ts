/**
 * a5p1r-validate-resolve.test.ts — Alpha.5 PR1-residual R-b: the window between
 * "the Guard validated a Definition" and "the registry resolved the Definition
 * it actually calls", entered by an ORDINARY concurrent re-registration.
 *
 * WHY THIS IS NOT THE EXCLUDED ADVERSARY CLASS. The design excludes a malicious
 * same-process Host that rewrites registry memory arbitrarily. What this file
 * drives is the opposite: a plugin doing the thing the Host advertises —
 * `dispose()` the old registration, `register()` a new Definition of the same
 * name in the same scope. The threat model is NOT re-worded here; what this
 * round adds is that the ordinary case now has a measurement and a posture.
 *
 * THE MEASURED PINNED ORDER (see `a5p1r-scoped-registry-double.ts` for the
 * source transcription, and `tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs`
 * for the same arms on the real registry):
 *
 *   `tools/pre-execute` → guard stage → `tools/execute` → resolve → Body
 *
 * Three interleavings, three answers:
 *
 *   before the guard stage   → the per-call definition read sees the new Body
 *                              and refuses (F2 covers it — asserted, not assumed);
 *   before our inner door    → the inner door re-reads and refuses (the law this
 *                              round adds: the door nearest the Body re-asks the
 *                              same question it asked at the outer one);
 *   after our inner door     → NO public seam can see it before the registry's
 *                              own late resolution. That exposure is asserted
 *                              here as what it is (one Body ran that the Guard
 *                              never validated), and the lane withdraws the
 *                              verification AT THAT CALL'S OWN EDGE so the
 *                              exposure can never repeat without a re-bind.
 *
 * @module test/a5p1r-validate-resolve
 */
import { describe, expect, it } from 'vitest'
import { installScopedToolGuard, type ScopedGuardHandle } from '../tool-dispatch/index.js'
import { scopedRegistryDouble, type SwapStage } from './a5p1r-scoped-registry-double.js'

function governed(): { readonly double: ReturnType<typeof scopedRegistryDouble>; readonly handle: ScopedGuardHandle } {
  const double = scopedRegistryDouble({ globalNames: ['grep'] })
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const outcome = installScopedToolGuard({
    agentCtx: double.ctx,
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames: (globalSchemas ?? []).map((row) => row.name),
    maskedNames: [],
  })
  if (!outcome.ok) throw new Error(`install refused: ${outcome.error.code} ${outcome.error.message}`)
  const handle = outcome.value
  const published = handle.publish()
  if (!published.ok) throw new Error(`publish refused: ${published.error.code} ${published.error.message}`)
  expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(true)
  return { double, handle }
}

describe('a5p1r R-b — the validate→resolve window under an ordinary re-registration', () => {
  it('control: with nothing moving, the validated Body runs', async () => {
    const { double } = governed()
    const run = await double.runCall({ callId: 'c1', name: 'grep' })
    expect(run.bodies).toEqual(['NATIVE.grep'])
  })

  it('a re-registration BEFORE the guard stage is refused by the per-call read: no Body runs', async () => {
    const { double, handle } = governed()
    const run = await double.runCall({ callId: 'c1', name: 'grep', swap: { stage: 'pre-execute', name: 'grep', identity: 'V2.grep' } })
    expect(run.bodies).toEqual([])
    expect(run.threw ?? run.text).toContain('different ToolDefinition')
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
  })

  it('a re-registration AFTER the guard stage but BEFORE our inner door is refused AT THAT DOOR: the un-validated Body never runs', async () => {
    const { double, handle } = governed()
    const run = await double.runCall({
      callId: 'c1',
      name: 'grep',
      swap: { stage: 'execute-before-ours' as SwapStage, name: 'grep', identity: 'V2.grep' },
    })
    // The finding this round closes: on the merged lane this Body RAN (measured
    // in runs/Rb-validate-resolve-RED.log), because the inner door only asked
    // whether the Dispatcher was ACTIVE.
    expect(run.bodies).toEqual([])
    expect(run.threw ?? run.text).toContain('team tool guard')
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
  })

  it('RECORDED BOUNDARY: a re-registration after our inner door runs one Body the Guard never validated, and the lane withdraws the verification at that call edge so it cannot repeat', async () => {
    const { double, handle } = governed()
    const run = await double.runCall({
      callId: 'c1',
      name: 'grep',
      swap: { stage: 'execute-after-ours' as SwapStage, name: 'grep', identity: 'V2.grep' },
    })
    // The seam gap, asserted rather than glossed: no public seam sits between
    // our last read and the registry's `resolveExecution`.
    expect(run.bodies).toEqual(['V2.grep'])
    // The fail-closed half: the exposure is exactly one call, because the lane
    // notices at the call's own settled edge and burns the verification there.
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
    expect(
      handle.observations().some((o) => String(o.event) === 'dispatcher-definition-change-at-call-edge'),
    ).toBe(true)
    const second = await double.runCall({ callId: 'c2', name: 'grep' })
    expect(second.bodies).toEqual([])
    expect(second.threw ?? second.text).toContain('team tool guard')
  })

  it('a parked call whose Definition is re-registered while it waits meets a refusal, never the new Body', async () => {
    const { double, handle } = governed()
    let arrive: () => void = () => {}
    const arrived = new Promise<void>((resolve) => { arrive = resolve })
    let openGate: () => void = () => {}
    const gate = new Promise<void>((resolve) => { openGate = resolve })
    const inflight = double.runCall({
      callId: 'c1',
      name: 'grep',
      parkInPreExecute: { signal: { arrived: () => arrive() }, gate },
    })
    await arrived
    // THE DETERMINISTIC INTERLEAVING: the call is provably inside the fence
    // while a legal re-registration lands.
    double.registerOwn('grep', 'V2.grep')
    openGate()
    const run = await inflight
    expect(run.bodies).toEqual([])
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
  })
})
