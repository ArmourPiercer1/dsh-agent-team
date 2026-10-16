/**
 * a5p1r-change-abort.test.ts — B3 (user ruling (ii)): a Definition that moves
 * cancels the calls that have not executed, and the lane tells cancellation and
 * termination apart.
 *
 * The scenario is the one the review filed as the residual that could not be
 * closed: a call has passed every check this lane owns, and an ordinary,
 * non-malicious re-registration lands in the gap before the registry resolves
 * the Body. The ruling's answer is the mechanism the pinned Host already
 * advertises to a wrapper — "wrappers may change only `exec.signal`"
 * (`packages/core/tools/src/index.ts` @ 639ed01539, `:155-159`) — because the
 * Host's own dispatch step refuses a raised signal at `:1572`, BEFORE
 * `resolveExecution` at `:1578`. The native execute chain still runs; nothing in
 * Core is touched; the veto that was rejected (a door that never calls `next()`)
 * is not used anywhere here.
 *
 * Four things are pinned, and each is a separate promise:
 *
 *  1. BODY = 0 for an after-door move (①), and the refusal is the Host's own
 *     `ABORTED_BEFORE_DISPATCH` with `bodyInvoked` false — the lane did not
 *     invent the outcome, it only made the Host reach it;
 *  2. the notification channel is a CAPABILITY, not a nice-to-have (②): absent
 *     or unsubscribable is a typed assembly refusal, and an accepted-but-silent
 *     channel is a loud per-call alarm (⑦ retracts the old "one call, then
 *     withdrawn" wording precisely because it let that case pass quietly);
 *  3. the abort is TARGETED (③): `tools/change` is argument-less and
 *     unfiltered, so a move in another Agent's scope, or on a neighbour tool, or
 *     on a sibling call that was not touched, must cancel nothing;
 *  4. an abort is a REQUEST (④): what happened is read off the Host's two
 *     shapes, and a call whose Body ran — cancelled by the caller, terminated by
 *     the lane, or lucky enough to finish first — is reported as executed.
 *
 * @module test/a5p1r-change-abort
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
  readonly handles: Record<string, ScopedGuardHandle>
  readonly ctx: ScopedGuardAgentCtx
}

/** Two governed Agents on ONE registry: the isolation matrix needs both. */
function governed(
  options: {
    readonly agents?: readonly string[]
    readonly names?: readonly string[]
    /** A name the Team itself registers and binds (the family the re-bind path belongs to). */
    readonly own?: readonly { name: string; identity: string }[]
    readonly bindOwn?: readonly string[]
    readonly bindMcp?: readonly string[]
  } = {},
): Lane {
  const agents = options.agents ?? ['agent-m1']
  const names = options.names ?? ['grep']
  const double = scopedRegistryDouble({
    globalNames: names,
    otherScopes: [...agents.slice(1)],
  })
  for (const row of options.own ?? []) double.registerOwn(row.name, row.identity, agents[0])
  const globalSchemas = (double.ctx.tools.schemas as (scope?: unknown) => readonly { name: string }[])(undefined)
  const nativeNames = (globalSchemas ?? []).map((row) => row.name)
  const handles: Record<string, ScopedGuardHandle> = {}
  for (const id of agents) {
    const outcome = installScopedToolGuard({
      // Each Agent's own ctx: the pinned registry routes the tool-call events by
      // the execution's scope, so a lane must not see another Agent's calls (and
      // must still see the one unfiltered channel, `tools/change`).
      agentCtx: double.ctxFor(id),
      runtimeAgent: { id },
      agentScopeKey: `s-${id}`,
      trustedIdentities: [...agents],
      nativeNames,
      maskedNames: [],
    })
    if (!outcome.ok) throw new Error(`install refused for ${id}: ${outcome.error.code} ${outcome.error.message}`)
    for (const ownName of options.bindOwn ?? []) {
      const bound = outcome.value.bindOwnTools([ownName])
      if (!bound.ok) throw new Error(`bindOwnTools refused: ${bound.error.message}`)
    }
    for (const mcpName of options.bindMcp ?? []) {
      const bound = outcome.value.bindMcpTools([mcpName])
      if (!bound.ok) throw new Error(`bindMcpTools refused: ${bound.error.message}`)
    }
    const published = outcome.value.publish()
    if (!published.ok) throw new Error(`publish refused for ${id}: ${published.error.code} ${published.error.message}`)
    handles[id] = outcome.value
  }
  return { double, handles, ctx: double.ctx }
}

const events = (handle: ScopedGuardHandle): readonly string[] => handle.observations().map((row) => String(row.event))
const rowsFor = (handle: ScopedGuardHandle, event: string): readonly Record<string, unknown>[] =>
  handle.observations().filter((row) => String(row.event) === event)

/**
 * A call parked AFTER the dispatch door, by a third-party wrapper mounted after
 * ours — the shape the review measured as `inner-after-ours`, made reproducible
 * without a sleep. Our door has already read and handed over its signal when the
 * park begins, so anything the test registers from outside while the call is
 * parked is, by construction, "after every check the lane owns and before the
 * registry resolves the Body".
 */
interface ParkedCall {
  readonly settled: Promise<Awaited<ReturnType<ScopedRegistryDouble['runCall']>>>
  readonly parked: Promise<void>
  readonly release: () => void
}

function startParkedCall(
  double: ScopedRegistryDouble,
  input: { readonly callId: string; readonly name: string; readonly agentIdentity?: string },
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
  // Call-scoped: a park that holds up somebody else's call would measure the
  // harness, not the lane.
  list.push(((async (exec: { callId?: unknown }, next: () => Promise<unknown>) => {
    if (exec?.callId !== input.callId) return await next()
    markParked()
    await gate
    return await next()
  }) as unknown) as (...args: never[]) => unknown)
  double.listeners.set('tools/execute', list)
  return { parked, release: () => openGate(), settled: double.runCall({ ...input }) }
}

describe('a5p1r B3 — the after-door move cancels the call, not the world', () => {
  it('① a re-registration after the dispatch door cancels the call BEFORE its Body: body count 0', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked
    // The door has run: the watch is armed and the signal is ours.
    expect(handle.pendingCalls().map((row) => row.callId)).toEqual(['c1'])

    // An ordinary concurrent re-registration, from outside the call.
    double.registerOwn('grep', 'V2.grep')
    call.release()
    const run = await call.settled

    // THE HEADLINE: no Body ran. Not "one", not "the old one" — none.
    expect(run.bodies).toEqual([])
    // …and the refusal is the Host's own before-dispatch shape, not a lane fiction.
    expect(run.code).toBe('ABORTED_BEFORE_DISPATCH')
    expect(run.bodyInvoked).toBe(false)
    expect(run.text).toContain('aborted before dispatch')

    // The lane attributes its own action, on its own event surface.
    // The lane reports WHICH identity it had validated and WHICH one is now
    // there — as opaque definition fingerprints, never as labels it cannot read.
    const issued = rowsFor(handle, 'dispatcher-change-abort-issued')
    expect(issued).toHaveLength(1)
    const calls = issued[0]!.calls as readonly { callId: string; tool: string; pinned: string; current: string }[]
    expect(calls).toHaveLength(1)
    expect(calls[0]!.callId).toBe('c1')
    expect(calls[0]!.tool).toBe('grep')
    expect(calls[0]!.pinned).toMatch(/^def#\d+$/)
    expect(calls[0]!.current).toMatch(/^def#\d+$/)
    expect(calls[0]!.current).not.toBe(calls[0]!.pinned)
    expect(events(handle)).toContain('dispatcher-call-cancelled-before-body')
    // Verification is withdrawn as before: the NEXT call is refused until a re-bind.
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
    const second = await double.runCall({ callId: 'c2', name: 'grep' })
    expect(second.bodies).toEqual([])
    // And no watch was leaked.
    expect(handle.pendingCalls()).toEqual([])
  })

  it('① positive control: with nothing moving, the signal wrapper is inert and the Body runs', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked
    call.release()
    const run = await call.settled
    expect(run.bodies).toEqual(['NATIVE.grep'])
    expect(run.code).toBeUndefined()
    expect(events(handle)).not.toContain('dispatcher-change-abort-issued')
    expect(events(handle)).not.toContain('dispatcher-call-cancelled-before-body')
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(true)
    expect(handle.pendingCalls()).toEqual([])
  })

  it('② the change channel is a capability: a ctx with no event seam refuses the assembly', () => {
    const double = scopedRegistryDouble({ globalNames: ['grep'] })
    const ctx = { tools: double.ctx.tools } as unknown as ScopedGuardAgentCtx
    const outcome = installScopedToolGuard({
      agentCtx: ctx,
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: ['grep'],
      maskedNames: [],
    })
    expect(outcome.ok).toBe(false)
    if (!outcome.ok) expect(outcome.error.message).toMatch(/tools\/pre-execute|on/)
    // No residue: nothing was left armed on the way out.
    expect(double.guards).toHaveLength(0)
  })

  it('② an unsubscribe-able channel: a tools/change subscription that THROWS refuses the assembly, typed', () => {
    const double = scopedRegistryDouble({ globalNames: ['grep'] })
    const realOn = double.ctx.on as unknown as (event: string, listener: (...args: never[]) => unknown) => () => void
    const ctx = {
      tools: double.ctx.tools,
      on: (event: string, listener: (...args: never[]) => unknown) => {
        if (event === 'tools/change') throw new Error('fixture: this scope will not deliver registry notifications')
        return realOn(event, listener)
      },
    } as unknown as ScopedGuardAgentCtx
    const outcome = installScopedToolGuard({
      agentCtx: ctx,
      runtimeAgent: { id: 'agent-m1' },
      agentScopeKey: 's-m1',
      trustedIdentities: ['agent-m1'],
      nativeNames: ['grep'],
      maskedNames: [],
    })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    // Typed, names the channel, and says what is no longer promised.
    expect(outcome.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(outcome.error.message).toContain('tools/change')
    expect(outcome.error.message).toContain('unsupported')
    // And the refusal is complete: the four seams that DID arm were rolled back.
    expect(double.guards).toHaveLength(0)
    expect(double.listeners.get('tools/execute') ?? []).toHaveLength(0)
    expect(double.listeners.get('tools/pre-execute') ?? []).toHaveLength(0)
  })

  it('②⑦ an accepted-but-silent channel is an alarm, not a pass: the moved Body runs and is reported as EXECUTED UNVERIFIED', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    // The subscription exists; the Host never delivers it. Undetectable at
    // assembly time, so the honesty moves to the call edge.
    double.listeners.delete('tools/change')
    expect(handle.changeChannelStatus()).toBe('armed')

    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked
    double.registerOwn('grep', 'V2.grep')
    call.release()
    const run = await call.settled

    // Without the notification there is nothing to cancel with: the Body runs.
    expect(run.bodies).toEqual(['V2.grep'])
    // …and the lane says so, loudly, instead of filing it as a quiet withdrawal.
    const alarms = rowsFor(handle, 'dispatcher-call-executed-unvalidated')
    expect(alarms).toHaveLength(1)
    expect(alarms[0]!.severity).toBe('alarm')
    expect(alarms[0]!.changeChannel).toBe('armed')
    // The old wording filed this as "fail-closed, exposure = one call". That
    // claim is retracted; what is left is a refusal to call it closed.
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
    expect(handle.changeChannelStatus()).toBe('armed')
  })

  it('③ isolation — a move in ANOTHER Agent scope cancels nothing here', async () => {
    const { double, handles } = governed({ agents: ['agent-m1', 'agent-m2'] })
    const mine = handles['agent-m1']!
    const other = handles['agent-m2']!
    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked

    // The neighbour replaces ITS own same-name Definition. `tools/change` is
    // unfiltered, so this event reaches both lanes; only the one whose own
    // definition moved may act on it.
    double.registerOwn('grep', 'OTHER.grep', 'agent-m2')
    call.release()
    const run = await call.settled

    expect(run.bodies).toEqual(['NATIVE.grep']) // ← not cancelled
    expect(run.code).toBeUndefined()
    expect(events(mine)).not.toContain('dispatcher-change-abort-issued')
    expect(mine.dispatcher.surface.entryOf('grep')?.verified).toBe(true)
    // The neighbour's Binding drifted (its own name moved) but its in-flight
    // calls are untouched — it has none.
    expect(other.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
  })

  it('③ isolation — a move on one name cancels only the calls that carried that name', async () => {
    const { double, handles } = governed({ names: ['grep', 'read'] })
    const handle = handles['agent-m1']!
    const moving = startParkedCall(double, { callId: 'call-grep', name: 'grep' })
    await moving.parked
    const sibling = startParkedCall(double, { callId: 'call-read', name: 'read' })
    await sibling.parked
    expect(handle.pendingCalls().map((row) => row.name).sort()).toEqual(['grep', 'read'])

    double.registerOwn('grep', 'V2.grep')
    moving.release()
    sibling.release()
    const [grepRun, readRun] = await Promise.all([moving.settled, sibling.settled])

    expect(readRun.bodies).toEqual(['NATIVE.read']) // the neighbour tool completed
    expect(readRun.code).toBeUndefined()
    expect(grepRun.bodies).toEqual([]) // the moved one was cancelled
    const issued = rowsFor(handle, 'dispatcher-change-abort-issued')
    expect(issued).toHaveLength(1)
    expect(JSON.stringify(issued[0]!.calls)).not.toContain('read')
  })

  it('③ isolation — every concurrent call of the moved name is cancelled, and none of the untouched ones', async () => {
    const { double, handles } = governed({ names: ['grep', 'read'] })
    const handle = handles['agent-m1']!
    const a = startParkedCall(double, { callId: 'a', name: 'grep' })
    await a.parked
    const b = startParkedCall(double, { callId: 'b', name: 'grep' })
    await b.parked
    const c = startParkedCall(double, { callId: 'c', name: 'grep' })
    await c.parked
    const untouched = startParkedCall(double, { callId: 'u', name: 'read' })
    await untouched.parked
    expect(handle.pendingCalls()).toHaveLength(4)

    double.registerOwn('grep', 'V2.grep')
    a.release()
    b.release()
    c.release()
    untouched.release()
    const [ra, rb, rc] = await Promise.all([a.settled, b.settled, c.settled])
    const results = [ra, rb, rc]
    const untouchedRun = await untouched.settled

    expect(results.map((run) => run.bodies)).toEqual([[], [], []])
    expect(results.every((run) => run.code === 'ABORTED_BEFORE_DISPATCH')).toBe(true)
    expect(untouchedRun.bodies).toEqual(['NATIVE.read'])
    const issued = rowsFor(handle, 'dispatcher-change-abort-issued')
    expect((issued[0]!.calls as readonly unknown[])).toHaveLength(3)
    expect(handle.pendingCalls()).toEqual([])
  })

  it('④ a real caller cancellation is reported as TERMINATED after the Body started, never as un-executed', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    const caller = new AbortController()
    const run = await double.runCall({
      callId: 'c1',
      name: 'grep',
      callerSignal: caller.signal,
      raiseCaller: () => caller.abort(),
      cancelCallerAt: 'inside-body',
    })
    // The Body ran — the side effect is real.
    expect(run.bodies).toEqual(['NATIVE.grep'])
    expect(run.bodyInvoked).toBe(true)
    expect(run.code).toBe('ABORTED')
    // The lane saw it and classified it as termination, not as a cancellation it
    // can claim, and not as something that never executed.
    const terminated = rowsFor(handle, 'dispatcher-call-terminated-after-body-start')
    expect(terminated).toHaveLength(1)
    expect(terminated[0]!.sideEffectPossible).toBe(true)
    expect(terminated[0]!.abortIssuedBy).toBe('none')
    expect(events(handle)).not.toContain('dispatcher-call-cancelled-before-body')
  })

  it('④ a lane abort that arrives while the Body is running is TERMINATION too — the side effect is never re-labelled away', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    const run = await double.runCall({
      callId: 'c1',
      name: 'grep',
      whileBodyRuns: () => {
        double.registerOwn('grep', 'V2.grep')
      },
    })
    expect(run.bodies).toEqual(['NATIVE.grep']) // ← it ran
    expect(run.bodyInvoked).toBe(true)
    expect(run.code).toBe('ABORTED')
    const terminated = rowsFor(handle, 'dispatcher-call-terminated-after-body-start')
    expect(terminated).toHaveLength(1)
    expect(terminated[0]!.abortIssuedBy).toBe('lane-definition-move')
    expect(events(handle)).not.toContain('dispatcher-call-cancelled-before-body')
    // The lane still withdraws the verification for what it can see.
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
  })

  it('④ an abort that loses the race is reported as EXECUTED, not swallowed', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked
    // The Body has already returned by the time post-execute runs: move there and
    // the abort has nothing left to cancel.
    const list = double.listeners.get('tools/post-execute') ?? []
    list.push((() => {
      double.registerOwn('grep', 'V2.grep')
    }) as (...args: never[]) => unknown)
    double.listeners.set('tools/post-execute', list)
    call.release()
    const run = await call.settled

    expect(run.bodies).toEqual(['NATIVE.grep'])
    const late = rowsFor(handle, 'dispatcher-call-completed-after-abort')
    expect(late).toHaveLength(1)
    expect(late[0]!.sideEffectPossible).toBe(true)
    expect(events(handle)).not.toContain('dispatcher-call-cancelled-before-body')
  })

  it('⑤ hooks, telemetry and result identity survive: the cancelled call reaches both result edges under its own callId with the Host shape', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    const seen: { post?: unknown; result?: unknown; postCallId?: string; resultCallId?: string } = {}
    const push = (event: string, listener: (...args: never[]) => unknown): void => {
      const list = double.listeners.get(event) ?? []
      list.push(listener)
      double.listeners.set(event, list)
    }
    push('tools/post-execute', ((exec: { callId: string }, result: unknown) => {
      seen.post = result
      seen.postCallId = exec.callId
    }) as (...args: never[]) => unknown)
    push('tools/result', ((exec: { callId: string }, result: unknown) => {
      seen.result = result
      seen.resultCallId = exec.callId
    }) as (...args: never[]) => unknown)

    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked
    double.registerOwn('grep', 'V2.grep')
    call.release()
    await call.settled

    // Both edges fired for the cancelled call — the lane suppressed nothing, and
    // a telemetry consumer still sees the call (with its error code, which is
    // what the session log and the telemetry severity are built from).
    expect(seen.postCallId).toBe('c1')
    expect(seen.resultCallId).toBe('c1')
    expect(JSON.stringify(seen.result)).toContain('ABORTED_BEFORE_DISPATCH')
    expect(JSON.stringify(seen.post)).toContain('ABORTED_BEFORE_DISPATCH')
    // Call identity untouched: the lane changed a signal, never an identity.
    expect(events(handle)).toContain('dispatcher-call-cancelled-before-body')
  })

  it('⑤ an MCP whole-generation resync cancels the in-flight calls it moved, and the re-bind path restores them', async () => {
    const { double, handles } = governed({ names: [], own: [{ name: 'grep', identity: 'MCP.gen1.grep' }], bindMcp: ['grep'] })
    const handle = handles['agent-m1']!
    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked
    // MCP syncTools: dispose the previous generation, register the next one.
    double.mcpResync('agent-m1', [{ name: 'grep', identity: 'MCP.gen2.grep' }])
    call.release()
    const run = await call.settled
    expect(run.bodies).toEqual([])
    expect(run.code).toBe('ABORTED_BEFORE_DISPATCH')
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
    // The documented way back: an explicit re-bind by the trusted assembly
    // (MCP-family binding, because that is the family that owns the name).
    const rebound = handle.bindMcpTools(['grep'])
    expect(rebound.ok).toBe(true)
    expect(handle.dispatcher.surface.entryOf('grep')?.verified).toBe(true)
    const after = await double.runCall({ callId: 'c2', name: 'grep' })
    expect(after.bodies).toEqual(['MCP.gen2.grep'])
  })

  it('⑥ bind → drift → re-bind grows the revision, and the recovery path is the one the documentation promises', async () => {
    // A Team-OWN Definition, which is the family `bindOwnTools` re-binds. (An
    // inherited native name keeps its `native:<name>` identity for the same
    // reason and is not re-bindable into `team-own:` at ACTIVE — PR1's stable
    // identity law, unchanged here.)
    const { double, handles } = governed({ names: [], own: [{ name: 'grep', identity: 'TEAM.grep' }], bindOwn: ['grep'] })
    const handle = handles['agent-m1']!
    expect(await (async () => (await double.runCall({ callId: 'c0', name: 'grep' })).bodies)()).toEqual(['TEAM.grep'])
    const first = handle.dispatcher.surface.entryOf('grep')
    expect(first?.verified).toBe(true)
    expect(first?.revision).toBeTypeOf('number')

    double.registerOwn('grep', 'V2.grep')
    const drifted = handle.dispatcher.surface.entryOf('grep')
    expect(drifted?.verified).toBe(false)
    expect(drifted?.unverifiedReason).toBe('definition-drift')
    expect((drifted?.revision ?? 0)).toBeGreaterThan(first?.revision ?? 0)

    // The re-bind is a NEW immutable revision, strictly higher (PR1's own law,
    // which `bindAll` used to violate by always writing revision 1).
    expect(handle.bindOwnTools(['grep']).ok).toBe(true)
    const rebound = handle.dispatcher.surface.entryOf('grep')
    expect(rebound?.verified).toBe(true)
    expect((rebound?.revision ?? 0)).toBeGreaterThan(drifted?.revision ?? 0)

    // A second move, a second growth: the counter never goes backwards or repeats.
    double.registerOwn('grep', 'V3.grep')
    expect((handle.dispatcher.surface.entryOf('grep')?.revision ?? 0)).toBeGreaterThan(rebound?.revision ?? 0)
    expect(handle.bindOwnTools(['grep']).ok).toBe(true)
    expect((handle.dispatcher.surface.entryOf('grep')?.revision ?? 0)).toBeGreaterThan(rebound?.revision ?? 0)
    const run = await double.runCall({ callId: 'c9', name: 'grep' })
    expect(run.bodies).toEqual(['V3.grep'])
  })

  it('④ a cancelled call whose outcome the lane cannot read is left UNRESOLVED, never counted as cancelled', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    // A post-execute policy rewrites the Host's canonical before-dispatch result
    // into an error that no longer says what it was (the shape a broken or
    // downgrade-ing observer produces on the real waterfall edge).
    const run = await double.runCall({
      callId: 'c1',
      name: 'grep',
      swap: { stage: 'execute-after-ours' as never, name: 'grep', identity: 'V2.grep' },
      postExecuteReplaces: { isError: true, content: [{ type: 'text', text: 'Error: post-execute policy failure' }] },
    })
    expect(run.bodies).toEqual([])
    expect(events(handle)).toContain('dispatcher-change-abort-issued')
    // The lane refuses to file it as a cancellation it succeeded…
    expect(events(handle)).not.toContain('dispatcher-call-cancelled-before-body')
    // …or as an ordinary completion…
    expect(events(handle)).not.toContain('dispatcher-call-completed-after-abort')
    // …and leaves it standing as unresolved.
    const unreadable = rowsFor(handle, 'dispatcher-call-outcome-unreadable')
    expect(unreadable).toHaveLength(1)
    expect(unreadable[0]!.severity).toBe('alarm')
  })

  it('③ isolation — the affected set stays whole: a global move cancels every Agent\'s in-flight call of that name', async () => {
    // The filter this round adds is only about NOT cancelling innocent calls. It
    // must not become a way to shrink the responsibility set: when the trusted
    // (global) definition moves, every Agent's un-executed call of that name is
    // cancelled by its own lane, in every Agent that has one.
    const { double, handles } = governed({ agents: ['agent-m1', 'agent-m2'] })
    const mine = handles['agent-m1']!
    const theirs = handles['agent-m2']!
    const a = startParkedCall(double, { callId: 'in-m1', name: 'grep' })
    await a.parked
    const b = startParkedCall(double, { callId: 'in-m2', name: 'grep', agentIdentity: 'agent-m2' })
    await b.parked
    expect(mine.pendingCalls().map((row) => row.callId)).toEqual(['in-m1'])
    expect(theirs.pendingCalls().map((row) => row.callId)).toEqual(['in-m2'])

    // The global (trusted) definition moves: BOTH agents now resolve a different
    // Body than the one their Binding pinned.
    double.registerGlobal('grep', 'V2.grep')
    a.release()
    b.release()
    const [runA, runB] = await Promise.all([a.settled, b.settled])

    expect(runA.bodies).toEqual([])
    expect(runB.bodies).toEqual([])
    expect(runA.code).toBe('ABORTED_BEFORE_DISPATCH')
    expect(runB.code).toBe('ABORTED_BEFORE_DISPATCH')
    expect(mine.observations().some((row) => String(row.event) === 'dispatcher-change-abort-issued')).toBe(true)
    expect(theirs.observations().some((row) => String(row.event) === 'dispatcher-change-abort-issued')).toBe(true)
    expect(mine.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
    expect(theirs.dispatcher.surface.entryOf('grep')?.verified).toBe(false)
  })

  it('⑤ a teardown that meets a call parked past the drain start still refuses, and B3 changes nothing about that law', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    const call = startParkedCall(double, { callId: 'c1', name: 'grep' })
    await call.parked
    // A call parked after the door holds a lease AND a watch.
    expect(handle.pendingCalls()).toHaveLength(1)
    const early = handle.disposeOrdered()
    expect(early.ok).toBe(false)
    expect(['DRAINING', 'TOMBSTONED']).toContain(handle.dispatcher.state())
    // The mask is still armed: a half-finished teardown does not uncover the
    // native surface (NEG-1's whole point).
    expect(handle.observations().some((row) => String(row.event) === 'mask-lifted')).toBe(false)

    call.release()
    const run = await call.settled
    // The lane's OWN bookkeeping is clean: the watch was dropped at the edge.
    expect(handle.pendingCalls()).toEqual([])
    // And PR1's R4 law stands untouched by B3: `'settled'` evidence is accepted
    // only while ACTIVE, so a lease that outlives the drain leaves the teardown
    // refusing for good. An abort mechanism is not a way to declare a call
    // finished, and the lane does not use it as one.
    expect(run.bodies).toEqual(['NATIVE.grep'])
    const second = handle.disposeOrdered()
    expect(second.ok).toBe(false)
    expect(handle.dispatcher.state()).not.toBe('RELEASED')
  })

  it('⑧ an execution that will not carry a wrapper is refused, not run unguarded', async () => {
    const { double, handles } = governed()
    const handle = handles['agent-m1']!
    // A Host (or an outer wrapper) that freezes the execution object: the lane
    // cannot install its signal, so it cannot make its promise, and it says so.
    const list = double.listeners.get('tools/execute') ?? []
    const ours = list.splice(0, list.length)
    list.push((async (exec: { signal?: AbortSignal }, next: () => Promise<unknown>) => {
      Object.defineProperty(exec, 'signal', { writable: false, configurable: false, value: exec.signal })
      return await next()
    }) as (...args: never[]) => unknown, ...ours)
    double.listeners.set('tools/execute', list)

    const run = await double.runCall({ callId: 'c1', name: 'grep' })
    expect(run.bodies).toEqual([])
    expect(run.threw ?? run.text).toContain('cannot be made cancellable')
    expect(rowsFor(handle, 'dispatcher-signal-wrapper-unavailable')).toHaveLength(1)
  })
})
