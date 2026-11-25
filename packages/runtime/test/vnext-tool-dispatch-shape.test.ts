/**
 * vnext-tool-dispatch-shape.test.ts — ROUND 122: the product's ONE tool-dispatch
 * entry (`createAgentBindings().executeTool`, the `/__p6t6/tool` route body)
 * dispatches in the shape the LIVE tools service offers, decided by PUBLIC
 * CAPABILITY, and refuses a caller's wrong shape instead of coercing it.
 *
 * THE DEFECT THIS PINS (round-121 disclosure). `agent-bindings.mjs#executeTool`
 * handed `tools.execute` the rc.2 SINGLE-CALL object unconditionally. rc.5
 * deleted registry dispatch: its `tools.execute` delegates to a per-scope
 * EXECUTOR and schedules `input.calls`, so the legacy object reached the host
 * with `calls === undefined` — a fault on a route that could never work there.
 * The binder now calls `dispatchGovernedToolCall` (`tool-executor-mount.mjs`),
 * which is the same seam the round-121 controls drive on the REAL hosts
 * (`a5sf-bl16-grep-realm.test.ts` C1a: mounted executor, admission fact, real
 * spawn; C2: unmounted ⇒ `A5SF_TOOL_EXECUTOR_UNAVAILABLE`) — so the two suites
 * cover the two halves: the seam's host-shape correctness on the real hosts,
 * and the BINDER's handoff to that seam here (host-free, both shapes).
 *
 * WHAT IS ASSERTED, AND WHY EACH ARM IS FALSIFIABLE
 *
 *   A (rc.2 arm)      a tools service that declares the rc.2 registry contract
 *                     (`defaultMode`, the t12a double's declared capability)
 *                     receives the SINGLE-CALL object: `{callId, name,
 *                     arguments, agent, signal}`, never `calls`.
 *   B (rc.5 arm)      a service that declares the rc.5 executor contract
 *                     (`setExecutor` + a selection for this agent) receives the
 *                     host's BATCH `{calls:[{type:'tool-call', id, name,
 *                     arguments: <JSON string>}], signal, agent}`, and the
 *                     binder unwraps `batch.results[0].result`.
 *   C (negative)      a caller passing the BATCH to the SINGLE-CALL entry is
 *                     refused typed (`A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED`)
 *                     naming the expected shape — BEFORE `ensureLiveAgent`, so
 *                     not even a live agent is materialized, and with ZERO
 *                     dispatched calls (not silently coerced).
 *   D (negative)      the rc.5 capability with NO executor selected refuses
 *                     `A5SF_TOOL_EXECUTOR_UNAVAILABLE` (not a generic
 *                     `TOOLS_EXECUTE`), with zero dispatches.
 *   E (negative)      a service that declares NEITHER contract refuses
 *                     `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`, with zero
 *                     dispatches — the seam never guesses a shape.
 *
 * No version string is read anywhere: the shape is probed off the live object
 * exactly as the product probes it.
 *
 * ROUND 123 extends the SAME question to the test infrastructure. The World's
 * dispatch helper (`tests/world-factory/lib/a5sf-fs-contract-world.mjs#executeToolDispatch`)
 * used to pick the call shape from a `{ hostMode }` version flag — the exact
 * decision the product closed in rounds 121/122. It now probes the LIVE tools
 * service by public capability too, and the arms F–I below pin that:
 *
 *   F (world, batch)   `setExecutor` ⇒ the rc.5 BATCH, arguments as a JSON
 *                      string, `results[0].result` returned.
 *   G (world, single)  `modeFor` ⇒ the SINGLE CALL, never a `calls` key.
 *   H (world, refusal) neither ⇒ `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`, zero
 *                      dispatches; the World's code is asserted EQUAL to the
 *                      product's exported constant.
 *   I (drift control)  on ONE fake service, the World's probe and the product's
 *                      `hostToolDispatchShape` must answer the same shape; and
 *                      on the same input both engines must emit the SAME call
 *                      and settle on the SAME outcome — across every selector
 *                      combination, so the two cannot drift apart silently.
 */
import { describe, expect, it } from 'vitest'
import type { AgentCtxDouble } from './t12a-live-bridge.mjs'
import { createLiveWorld } from './t12a-live-bridge.mjs'
// ROUND 123 — the World's dispatch helper and the PRODUCT's seam, side by side.
import {
  WORLD_NO_DISPATCH_CONTRACT,
  executeToolDispatch,
  worldToolDispatchShape,
} from '../../../tests/world-factory/lib/a5sf-fs-contract-world.mjs'
import {
  TOOL_EXECUTOR_CAPABILITY_MISSING,
  dispatchGovernedToolCall,
  hostToolDispatchShape,
} from '../src/plugin/vnext/tool-executor-mount.mjs'

/** The world's team root (the boot root: a durable TeamSession row is synthesized). */
const ROOT = 'session-r122-dispatch-root'

const world = await createLiveWorld({
  rootSessionId: ROOT,
  configOverrides: { mcpServer: null },
})
await world.binding.boot()

/** The live agent's ctx the binder reads (`handle.agent.ctx.tools`). */
const rootCtx = world.agents.handles.get(ROOT)!.agent.ctx as AgentCtxDouble
const liveTools = rootCtx.tools as unknown as Record<string, unknown>

/** Run one arm against the SAME live ctx with a temporary tools-service shape. */
async function withToolShape<T>(
  patch: Record<string, unknown>,
  run: (dispatchCalls: unknown[]) => Promise<T>,
  remove: readonly string[] = [],
): Promise<T> {
  const saved = new Map<string, PropertyDescriptor | undefined>()
  const touched = [...Object.keys(patch), ...remove]
  for (const key of touched) saved.set(key, Object.getOwnPropertyDescriptor(liveTools, key))
  for (const key of remove) delete liveTools[key]
  for (const key of Object.keys(patch)) {
    Object.defineProperty(liveTools, key, {
      value: patch[key],
      configurable: true,
      enumerable: true,
      writable: true,
    })
  }
  const dispatchCalls: unknown[] = []
  const originalExecute = liveTools.execute as (input: unknown) => Promise<unknown>
  Object.defineProperty(liveTools, 'execute', {
    value: (input: unknown) => {
      dispatchCalls.push(input)
      return originalExecute.call(liveTools, input)
    },
    configurable: true,
    enumerable: true,
    writable: true,
  })
  try {
    return await run(dispatchCalls)
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor === undefined) delete liveTools[key]
      else Object.defineProperty(liveTools, key, descriptor)
    }
    Object.defineProperty(liveTools, 'execute', {
      value: originalExecute,
      configurable: true,
      enumerable: true,
      writable: true,
    })
  }
}

/** The typed code a promise rejects with (or `undefined` when it resolves). */
async function codeOf(promise: Promise<unknown>): Promise<string | undefined> {
  try {
    await promise
    return undefined
  } catch (error) {
    return (error as { code?: string }).code
  }
}

describe('round 122 — executeTool dispatches in the host-declared shape, and refuses the wrong one', () => {
  it('A (rc.2 arm): a registry-dispatch service receives the SINGLE-CALL object, never a batch', async () => {
    // The t12a double declares rc.2's public contract (`defaultMode`) and
    // dispatches one call itself; this arm is the rc.2 behaviour preserved.
    const outcome = await world.binding.executeTool(ROOT, {
      name: 'shape-probe',
      args: { marker: 'rc2' },
      callId: 'r122-a',
    })
    const recorded = (rootCtx as unknown as { toolExecutions: Record<string, unknown>[] }).toolExecutions
    const last = recorded[recorded.length - 1]!
    expect(last.name).toBe('shape-probe')
    expect(last.callId).toBe('r122-a')
    expect(last.arguments).toEqual({ marker: 'rc2' })
    expect('calls' in last).toBe(false)
    // The double's own settlement is handed back unchanged.
    expect(outcome).toEqual({ ok: true, callId: 'r122-a' })
  })

  it('B (rc.5 arm): an executor-dispatch service receives the host BATCH, and the result is unwrapped', async () => {
    const executorCalls: unknown[] = []
    const executor = {
      execute: async (input: { calls: readonly { id: string }[] }) => {
        executorCalls.push(input)
        return { results: [{ result: { isError: false, value: { settled: input.calls[0]!.id }, content: [] } }] }
      },
    }
    const outcome = await withToolShape(
      {
        setExecutor: () => undefined,
        selectExecutor: () => executor,
        // The rc.5 SERVICE delegates dispatch to its selected executor. The
        // double is a registry, so the arm supplies the one-line delegation
        // the real service performs (`this.selectExecutor(input.agent).execute(input)`).
        execute: (input: { calls?: unknown }) =>
          input.calls === undefined
            ? Promise.resolve({ ok: true })
            : executor.execute(input as { calls: readonly { id: string }[] }),
      },
      async (dispatchCalls) => {
        const settled = await world.binding.executeTool(ROOT, {
          name: 'shape-probe',
          args: { marker: 'rc5' },
          callId: 'r122-b',
        })
        // The binder did NOT hand the host the legacy single-call object: the
        // one dispatch call it made is the rc.5 batch (and it is the same call
        // the executor received — the service delegated to its selection).
        expect(dispatchCalls).toHaveLength(1)
        return settled
      },
    )
    const batch = executorCalls[0] as {
      calls: { type: string, id: string, name: string, arguments: string }[]
      agent: unknown
      signal: unknown
    }
    expect(Array.isArray(batch.calls)).toBe(true)
    expect(batch.calls).toHaveLength(1)
    expect(batch.calls[0]).toMatchObject({ type: 'tool-call', id: 'r122-b', name: 'shape-probe' })
    // rc.5's batch carries the arguments as a JSON STRING (the host contract),
    // not the legacy raw object.
    expect(batch.calls[0]!.arguments).toBe('{"marker":"rc5"}')
    expect(batch.agent).toBe(world.agents.handles.get(ROOT)!.agent)
    expect(batch.signal).toBeInstanceOf(AbortSignal)
    expect(outcome).toEqual({ isError: false, value: { settled: 'r122-b' }, content: [] })
  })

  it('C (negative): a BATCH handed to the single-call entry is refused typed, before any live agent exists', async () => {
    const before = (rootCtx as unknown as { toolExecutions: unknown[] }).toolExecutions.length
    // A session that has NO live agent: if the shape gate ran after
    // `ensureLiveAgent` the code would be NO_LIVE_AGENT instead — the typed
    // shape refusal is therefore proof of ORDER, not just of a code.
    const code = await codeOf(world.binding.executeTool('session-r122-not-live', {
      calls: [{ type: 'tool-call', id: 'r122-c', name: 'shape-probe', arguments: '{}' }],
    } as never))
    expect(code).toBe('A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED')
    expect((rootCtx as unknown as { toolExecutions: unknown[] }).toolExecutions.length).toBe(before)
    expect(world.binding.hasLive('session-r122-not-live')).toBe(false)
  })

  it('D (negative): the rc.5 capability with NO executor selected refuses by name, not as a tool fault', async () => {
    const unavailable = Object.assign(new Error('no executor for scope'), {
      code: 'TOOL_EXECUTOR_UNAVAILABLE',
      name: 'ToolExecutorUnavailableError',
    })
    const dispatched = await withToolShape(
      {
        setExecutor: () => undefined,
        selectExecutor: () => { throw unavailable },
      },
      async (dispatchCalls) => {
        const before = (rootCtx as unknown as { toolExecutions: unknown[] }).toolExecutions.length
        const code = await codeOf(world.binding.executeTool(ROOT, { name: 'shape-probe', args: {}, callId: 'r122-d' }))
        expect(code).toBe('A5SF_TOOL_EXECUTOR_UNAVAILABLE')
        expect((rootCtx as unknown as { toolExecutions: unknown[] }).toolExecutions.length).toBe(before)
        return dispatchCalls.length
      },
    )
    expect(dispatched).toBe(0)
  })

  it('E (negative): a service declaring NEITHER dispatch contract refuses, and is never guessed at', async () => {
    const dispatched = await withToolShape(
      {
        // The double declares no dispatch contract at all (the rc.2 property
        // is REMOVED, not merely undefined — `'defaultMode' in tools` is the
        // seam's probe, so an undefined value would still count as a declaration).
        setExecutor: undefined,
      },
      async (dispatchCalls) => {
        const code = await codeOf(world.binding.executeTool(ROOT, { name: 'shape-probe', args: {}, callId: 'r122-e' }))
        expect(code).toBe('A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING')
        return dispatchCalls.length
      },
      ['defaultMode', 'setExecutor'],
    )
    expect(dispatched).toBe(0)
  })
})

// ── ROUND 123 — the World's dispatch helper decides by capability, and the two
// decisions are held to agree (drift control) ───────────────────────────────

/** The public capabilities a fake tools service may (or may not) declare. */
interface FakeServiceSpec {
  readonly setExecutor?: boolean
  readonly modeFor?: boolean
  readonly defaultMode?: boolean
}

/**
 * A tools service DOUBLE that records the ONE dispatch input it receives and
 * answers in whichever shape that input declares. It is a fake, not a host: it
 * exists so the World's helper and the product's seam can be handed the SAME
 * capability surface and measured against each other without a boot.
 */
function makeToolsService(spec: FakeServiceSpec): {
  service: Record<string, unknown>
  dispatched: Record<string, unknown>[]
} {
  const dispatched: Record<string, unknown>[] = []
  const service: Record<string, unknown> = {
    execute: async (input: Record<string, unknown>) => {
      dispatched.push(input)
      const calls = input.calls
      if (Array.isArray(calls)) {
        return {
          results: calls.map((call) => ({
            result: { isError: false, value: { settled: (call as { id: string }).id }, content: [] },
          })),
        }
      }
      return { isError: false, value: { settled: String(input.callId) }, content: [] }
    },
  }
  if (spec.setExecutor === true) {
    service.setExecutor = () => undefined
    // The seam asks the host's OWN selector whether a scope can dispatch; this
    // double answers "yes" without pretending to be an execution path.
    service.selectExecutor = () => ({ name: 'fake-executor' })
  }
  if (spec.modeFor === true) service.modeFor = () => 'native'
  if (spec.defaultMode === true) service.defaultMode = 'native'
  return { service, dispatched }
}

/** One canonical single call, so the two engines receive identical input. */
function shapeCall(label: string): {
  callId: string
  name: string
  arguments: Record<string, unknown>
  signal: AbortSignal
  agent: Record<string, unknown>
} {
  return {
    callId: `r123-${label}`,
    name: 'shape-probe',
    arguments: { marker: label },
    signal: new AbortController().signal,
    agent: { marker: 'agent' },
  }
}

/** `{value}` on success, `{code}` on a typed refusal — the two observable outcomes. */
async function capture(run: () => Promise<unknown>): Promise<Record<string, unknown>> {
  try {
    return { value: await run() }
  } catch (error) {
    return { code: (error as { code?: string }).code ?? String(error) }
  }
}

describe('round 123 — the World dispatches by PUBLIC CAPABILITY, and agrees with the product seam', () => {
  it('F (world, batch): a service exposing `setExecutor` receives the rc.5 BATCH and `results[0].result` is returned', async () => {
    const { service, dispatched } = makeToolsService({ setExecutor: true })
    const outcome = await executeToolDispatch(service, shapeCall('batch'))
    expect(dispatched).toHaveLength(1)
    const input = dispatched[0]!
    // The batch, not the single call: `calls` is the rc.5 contract, each entry is
    // a `tool-call` and its `arguments` is a JSON STRING (the host's own shape).
    expect(Array.isArray(input.calls)).toBe(true)
    const calls = input.calls as { type: string, id: string, name: string, arguments: string }[]
    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({ type: 'tool-call', id: 'r123-batch', name: 'shape-probe' })
    expect(calls[0]!.arguments).toBe('{"marker":"batch"}')
    expect(input.agent).toEqual({ marker: 'agent' })
    expect(input.signal).toBeInstanceOf(AbortSignal)
    // …and the settlement is the batch's first result, unwrapped.
    expect(outcome).toEqual({ isError: false, value: { settled: 'r123-batch' }, content: [] })
  })

  it('G (world, single): a service exposing `modeFor` receives the SINGLE CALL, never a batch', async () => {
    const { service, dispatched } = makeToolsService({ modeFor: true })
    const outcome = await executeToolDispatch(service, shapeCall('single'))
    expect(dispatched).toHaveLength(1)
    const input = dispatched[0]!
    expect('calls' in input).toBe(false)
    expect(input).toMatchObject({ callId: 'r123-single', name: 'shape-probe', arguments: { marker: 'single' } })
    expect(input.arguments).toEqual({ marker: 'single' })
    expect(outcome).toEqual({ isError: false, value: { settled: 'r123-single' }, content: [] })
  })

  it('H (world, negative): a service declaring NEITHER contract is refused typed, with zero dispatches', async () => {
    const { service, dispatched } = makeToolsService({})
    const code = await codeOf(executeToolDispatch(service, shapeCall('none')))
    expect(code).toBe(WORLD_NO_DISPATCH_CONTRACT)
    // …and the World's typed code IS the product's: one vocabulary, two probes.
    expect(code).toBe(TOOL_EXECUTOR_CAPABILITY_MISSING)
    expect(dispatched).toHaveLength(0)
  })

  it('I (drift control): World and PRODUCT pick the same shape and emit the same call, service by service', async () => {
    // The matrix is the whole public-contract surface both probes read: each
    // selector alone, both registry selectors, both contracts at once (rc.5's
    // `setExecutor` must win), and neither.
    const cases: { label: string, spec: FakeServiceSpec, shape: string | undefined }[] = [
      { label: 'set-executor', spec: { setExecutor: true }, shape: 'executor-mount' },
      { label: 'mode-for', spec: { modeFor: true }, shape: 'registry-dispatch' },
      { label: 'default-mode', spec: { defaultMode: true }, shape: 'registry-dispatch' },
      { label: 'both-registry-selectors', spec: { modeFor: true, defaultMode: true }, shape: 'registry-dispatch' },
      { label: 'both-contracts', spec: { setExecutor: true, modeFor: true, defaultMode: true }, shape: 'executor-mount' },
      { label: 'neither', spec: {}, shape: undefined },
    ]
    for (const entry of cases) {
      // SAME OBJECT, both probes: the agreement is measured, not asserted about
      // two look-alike fakes.
      const probeTarget = makeToolsService(entry.spec).service
      expect(worldToolDispatchShape(probeTarget)).toBe(hostToolDispatchShape(probeTarget))
      expect(worldToolDispatchShape(probeTarget)).toBe(entry.shape)

      // SAME INPUT, both engines: the emitted call and the settled outcome must
      // be identical — a drift in either direction reds this arm.
      const worldSide = makeToolsService(entry.spec)
      const productSide = makeToolsService(entry.spec)
      // ONE call object handed to both engines, so `signal`/`agent` are the same
      // references and the only variable left is the engine.
      const call = shapeCall(entry.label)
      const worldOutcome = await capture(() => executeToolDispatch(worldSide.service, call))
      const productOutcome = await capture(() => dispatchGovernedToolCall(productSide.service, call))
      expect(worldOutcome).toEqual(productOutcome)
      expect(worldSide.dispatched).toEqual(productSide.dispatched)
    }
    // A non-service is not a dispatch contract for either probe.
    for (const value of [undefined, null, 'tools-service']) {
      expect(worldToolDispatchShape(value)).toBe(hostToolDispatchShape(value as never))
    }
  })
})
