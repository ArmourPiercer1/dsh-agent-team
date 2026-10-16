/**
 * a5p1r-gg-probes.test.ts — the G-g support-contract probes G-2 and G-4 as
 * always-run assertions (grading §2.1 of `g-g-support-contract.md`: an E-level
 * claim needs its FULL predicate in the vitest net, with the negative control
 * in the same net).
 *
 * What was missing before these legs (contract §2.2, verbatim gaps):
 *
 *  - P4 ("U — 同配置部分 NO-EVIDENCE"): the recovery path — drifted name refused
 *    on its NEXT call, explicit re-bind restores it — had only ever been measured
 *    in a DELIVERING configuration (RW-AFTER-DOOR-BODY-ZERO, the MCP re-bind leg).
 *    §(j)'s allowed wording "pinned until re-bind" may not be extrapolated into
 *    the silent configuration, so it is now MEASURED there: Leg A does the whole
 *    sequence inside one silent (disposed-subscription) arm.
 *  - P1–P3 under a SECOND silent injection: the inert arm disposes a live
 *    subscription; the contract's G-4 arm never disposes anything — the
 *    subscription is accepted, its table entry stays, and dispatch simply stops
 *    reaching the lane. Leg B injects exactly that (a swallow proxy in the
 *    listener table) and asserts the five-point set PLUS the event-stream counts
 *    the contract pins (P3's other half, "事件流计数断言并入 G-4 谓词组").
 *  - P6's two halves pair up: Leg B also re-reads `changeChannelStatus()` at the
 *    end of the run ('armed' — the reverse half), while the forward half
 *    (delivered ⇒ 'proven') is asserted in a5p1r-change-abort.test.ts leg ①.
 *
 * Family note (why these legs install a TEAM-OWN `grep`, unlike the ②⑦ leg next
 * door): `bindOwnTools` re-binds the `team-own:` family only — an inherited
 * native name keeps its `native:<name>` identity and is not re-bindable into
 * `team-own:` at ACTIVE (PR1's stable identity law, stated in
 * a5p1r-change-abort.test.ts leg ⑥). The recovery path therefore has to be
 * measured in the family that owns the documented way back, which is also what
 * every kit armB3 configuration is (`assemblyOwnedNames` + `bindOwnTools`).
 *
 * Zero product-code change; zero ports; in-process double only.
 *
 * @module test/a5p1r-gg-probes
 */
import { describe, expect, it } from 'vitest'
import {
  installScopedToolGuard,
  type ScopedGuardAgentCtx,
  type ScopedGuardHandle,
} from '../tool-dispatch/index.js'
import { scopedRegistryDouble, type ScopedRegistryDouble } from './a5p1r-scoped-registry-double.js'

interface Lane {
  readonly double: ScopedRegistryDouble
  readonly handle: ScopedGuardHandle
}

/**
 * One governed Agent on one registry, with `grep` as a Team-OWN Definition bound
 * through `bindOwnTools` (the family whose documented recovery is `bindOwnTools`).
 * The G-4 swallow injection wires its own ctx inline at its leg, because the
 * point of that arm is the exact shape of the wrapped `on`. The kit mirrors are
 * `a5p1r-rereg-window.mjs`'s `guarded-after-change-inert` and
 * `guarded-after-change-swallow` arms.
 */
function ownToolLane(): Lane {
  const double = scopedRegistryDouble({ globalNames: [] })
  double.registerOwn('grep', 'TEAM.grep', 'agent-m1')
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const nativeNames = (globalSchemas ?? []).map((row) => row.name)
  const outcome = installScopedToolGuard({
    agentCtx: double.ctxFor('agent-m1'),
    runtimeAgent: { id: 'agent-m1' },
    agentScopeKey: 's-agent-m1',
    trustedIdentities: ['agent-m1'],
    nativeNames,
    maskedNames: [],
  })
  if (!outcome.ok) throw new Error(`install refused: ${outcome.error.code} ${outcome.error.message}`)
  const bound = outcome.value.bindOwnTools(['grep'])
  if (!bound.ok) throw new Error(`bindOwnTools refused: ${bound.error.message}`)
  const published = outcome.value.publish()
  if (!published.ok) throw new Error(`publish refused: ${published.error.message}`)
  return { double, handle: outcome.value }
}

const events = (handle: ScopedGuardHandle): readonly string[] => handle.observations().map((row) => String(row.event))
const rowsFor = (handle: ScopedGuardHandle, event: string): readonly Record<string, unknown>[] =>
  handle.observations().filter((row) => String(row.event) === event)

/** The after-door park, same shape as a5p1r-change-abort.test.ts's helper. */
interface ParkedCall {
  readonly settled: Promise<Awaited<ReturnType<ScopedRegistryDouble['runCall']>>>
  readonly parked: Promise<void>
  readonly release: () => void
}

function startParkedCall(
  double: ScopedRegistryDouble,
  input: { readonly callId: string; readonly name: string },
): ParkedCall {
  let markParked!: () => void
  const parked = new Promise<void>((resolve) => {
    markParked = resolve
  })
  let openGate!: () => void
  const gate = new Promise<void>((resolve) => {
    openGate = resolve
  })
  const list = double.listeners.get('tools/execute') ?? []
  list.push(((async (exec: { callId?: unknown }, next: () => Promise<unknown>) => {
    if (exec?.callId !== input.callId) return await next()
    markParked()
    await gate
    return await next()
  }) as unknown) as (...args: never[]) => unknown)
  double.listeners.set('tools/execute', list)
  return { parked, release: () => openGate(), settled: double.runCall({ ...input }) }
}

/**
 * The five-point loud set + the G-4 event-stream counts, shared by both silent
 * injections — everything observable AT the settled edge, before any recovery
 * probe moves the run on. FAIL = any conjunct. (The P4 recovery conjuncts are
 * per-leg, because they place further calls.)
 */
function expectSilentLoudAtCallEdge(handle: ScopedGuardHandle): void {
  // — five-point set (RW-CHANGE-*-LOUD): the alarm says the moved Body ran, with
  //   the channel still unproven; NOTHING was cancelled; the verification is
  //   withdrawn at the call edge; the status never left 'armed'.
  const alarms = rowsFor(handle, 'dispatcher-call-executed-unvalidated')
  expect(alarms).toHaveLength(1)
  expect(alarms[0]!.severity).toBe('alarm')
  expect(alarms[0]!.changeChannel).toBe('armed')
  expect(String(alarms[0]!.pinned)).not.toBe(String(alarms[0]!.current))
  expect(events(handle)).not.toContain('dispatcher-change-abort-issued')
  expect(events(handle)).not.toContain('dispatcher-call-cancelled-before-body')
  expect(handle.changeChannelStatus()).toBe('armed')
  // — event-stream counts (the P3 half merged into the G-4 predicate group): the
  //   call edge names definition-drift and downgrades; the Binding revision says
  //   verified=false and states why.
  const callEdge = rowsFor(handle, 'dispatcher-definition-change-at-call-edge')
  expect(callEdge).toHaveLength(1)
  expect(callEdge[0]!.reason).toBe('definition-drift')
  expect(callEdge[0]!.moved).toBe(true)
  expect(callEdge[0]!.downgraded).toBe(true)
  const revised = rowsFor(handle, 'dispatcher-binding-revised').filter((row) => row.verified === false)
  expect(revised.length).toBeGreaterThanOrEqual(1)
  expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
  expect(handle.dispatcher.surface.entryOf('grep')?.unverifiedReason).toBe('definition-drift')
}

describe('a5p1r G-g probes — the silent channel measured whole, in both its injections', () => {
  it('G-2/P4 (inert injection): refused on the next call, re-bind restores — measured inside the silent arm', async () => {
    const { double, handle } = ownToolLane()
    // The subscription exists and was accepted; the Host simply never delivers
    // (the unit mirror of the kit's dispose-after-subscribe injection).
    double.listeners.delete('tools/change')
    expect(handle.changeChannelStatus()).toBe('armed')

    const call = startParkedCall(double, { callId: 'g2-first', name: 'grep' })
    await call.parked
    double.registerOwn('grep', 'V2.grep', 'agent-m1')
    call.release()
    const run = await call.settled
    expect(run.bodies).toEqual(['V2.grep']) // nothing could cancel it

    // Five-point set + event-stream counts at the call edge.
    expectSilentLoudAtCallEdge(handle)

    // P4 inside the same silent arm: the drifted name is pinned until re-bind.
    const second = await double.runCall({ callId: 'g2-second', name: 'grep' })
    expect(second.bodies).toEqual([])
    expect(second.threw ?? second.text).toMatch(/definition drift/)
    expect(second.threw ?? second.text).toMatch(/re-bind required/)
    const rebind = handle.bindOwnTools(['grep'])
    expect(rebind.ok).toBe(true)
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(true)
    const third = await double.runCall({ callId: 'g2-third', name: 'grep' })
    expect(third.bodies).toEqual(['V2.grep'])
    // No new un-validated Body happened after the first, and the channel never
    // left 'armed' (P6 reverse half, re-read at the end of the arm).
    expect(rowsFor(handle, 'dispatcher-call-executed-unvalidated')).toHaveLength(1)
    expect(handle.changeChannelStatus()).toBe('armed')
  })

  it('G-4/P1-P3 (swallow injection): accepted-but-never-dispatched subscription is loud, counts, stays armed, and recovers the same way', async () => {
    const double = scopedRegistryDouble({ globalNames: [] })
    double.registerOwn('grep', 'TEAM.grep', 'agent-m1')
    // A control subscription the kit-mirror harness owns: it proves the registry
    // really emits `tools/change` during the run — this arm measures swallowed
    // delivery, not a dead emitter.
    let controlEvents = 0
    ;(double.ctx.on as unknown as (e: string, l: () => void) => () => void)('tools/change', () => { controlEvents += 1 })
    // The swallow view the lane is installed on: accepted subscription, live entry
    // in the listener table, dispatch never forwards to the lane's handler.
    let proxyEmissions = 0
    let disposed = false
    const realOn = double.ctx.on as unknown as (event: string, listener: (...args: never[]) => unknown) => () => void
    const swallowOn = (event: string, listener: (...args: never[]) => unknown): (() => void) => {
      if (event !== 'tools/change') return realOn(event, listener)
      const proxy = (): void => { proxyEmissions += 1 }
      const list = double.listeners.get(event) ?? []
      list.push(proxy as unknown as (...args: never[]) => unknown)
      double.listeners.set(event, list)
      return () => {
        disposed = true
        const at = list.indexOf(proxy as unknown as (...args: never[]) => unknown)
        if (at >= 0) list.splice(at, 1)
      }
    }
    const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
    const nativeNames = (globalSchemas ?? []).map((row) => row.name)
    const outcome = installScopedToolGuard({
      agentCtx: { tools: double.ctx.tools, on: swallowOn } as unknown as ScopedGuardAgentCtx,
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-agent-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames,
      maskedNames: [],
    })
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return
    const handle = outcome.value
    expect(handle.bindOwnTools(['grep']).ok).toBe(true)
    expect(handle.publish().ok).toBe(true)
    // The subscription entry is in the Host's listener table and nothing was
    // disposed — the shape is indistinguishable from a healthy arm at assembly.
    expect((double.listeners.get('tools/change') ?? []).length).toBeGreaterThanOrEqual(2) // proxy + control
    expect(disposed).toBe(false)
    expect(handle.changeChannelStatus()).toBe('armed')

    const call = startParkedCall(double, { callId: 'g4-first', name: 'grep' })
    await call.parked
    double.registerOwn('grep', 'V2.grep', 'agent-m1') // a REAL emission happens here
    call.release()
    const run = await call.settled
    expect(run.bodies).toEqual(['V2.grep']) // swallowed: nothing cancelled it

    // The injection did what it claims: the registry emitted, the subscription's
    // table entry saw the dispatch, and the lane's handler still never ran.
    expect(controlEvents).toBeGreaterThanOrEqual(1)
    expect(proxyEmissions).toBeGreaterThanOrEqual(1)
    expect(disposed).toBe(false)

    expectSilentLoudAtCallEdge(handle)
    // …recovery in the same swallowed configuration.
    const second = await double.runCall({ callId: 'g4-second', name: 'grep' })
    expect(second.bodies).toEqual([])
    expect(second.threw ?? second.text).toMatch(/definition drift/)
    expect(second.threw ?? second.text).toMatch(/re-bind required/)
    expect(handle.bindOwnTools(['grep']).ok).toBe(true)
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(true)
    const third = await double.runCall({ callId: 'g4-third', name: 'grep' })
    expect(third.bodies).toEqual(['V2.grep'])
    expect(rowsFor(handle, 'dispatcher-call-executed-unvalidated')).toHaveLength(1)
    expect(handle.changeChannelStatus()).toBe('armed') // P6 reverse half, end of run
  })
})
