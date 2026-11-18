/**
 * native-api.test.mjs — NEXT HOST (0.2.2-rc.5) NATIVE API SMOKE.
 *
 * THE DELIVERABLE: prove, against the second pinned host's PUBLIC package
 * surface, the four behaviours the UTE design depends on — with the host's own
 * services and its own executors, not a re-implementation:
 *
 *   A1 `ToolsService.resolve()` returns a `ResolvedToolSet` (admission + close).
 *   A2 A `ToolExecutor` is selected for a tool and REALLY executes it (the tool
 *      body observes the call and the canonical result carries its value).
 *   A3 The invocation pipeline stages run in order:
 *      tools/pre-execute -> tools/execute -> tools/post-execute -> tools/result.
 *   A4 A PTC `run_code` call reaches a REAL INNER EXECUTOR: the program's
 *      nested call is dispatched through the host's PTC bridge into the
 *      registered tool's own `execute`, and the session records
 *      `tool/ptc-dispatch-start` + `tool/ptc-dispatch`.
 *   A5 Cancellation mid-flight: the tool body observes `exec.signal` abort, the
 *      call settles as a failure, and `tools/result` still notifies with it.
 *   A6 A tool that IGNORES the abort cannot turn a cancelled call into a
 *      success: the host overrides it to `ABORTED`; a pre-dispatch abort is
 *      `ABORTED_BEFORE_DISPATCH`.
 *
 * FAIL-LOUD: a missing/ drifted host tree or a non-pinned native asset throws
 * (`host-next-lib.mjs`), never a skip. CORE PATCH BUDGET = 0: only published
 * package entries are imported; nothing in the host tree is written.
 */
import assert from 'node:assert/strict'
import { rmSync } from 'node:fs'
import { test } from 'node:test'

import {
  assertNextHostAssets, assertNextHostTree, hostImport, nextLaneWorkdir, proof,
} from './host-next-lib.mjs'

const host = assertNextHostTree()
const assets = assertNextHostAssets()

const { Context } = await hostImport('@deepseek-ai/cordis')
const { defineTool, TOOL_ABORTED, TOOL_ABORTED_BEFORE_DISPATCH } = await hostImport('@deepseek-ai/dsh-tools')
const { mountAgentLoopTestDependencies, mountAgentLoopTestHarness } = await hostImport('@deepseek-ai/dsh-agent-loop-testkit')
const { executeModelToolFixture } = await hostImport('@deepseek-ai/dsh-tool-testkit')
const { SessionId } = await hostImport('@deepseek-ai/dsh-session')
const { PtcRuntime } = await hostImport('@deepseek-ai/dsh-ptc-runtime')

const MODEL_SELECTION = Object.freeze({ provider: 'mock', model: 'mock' })

/** Mount the host's own prerequisite services + agent loop for one context. */
async function mountHost(mode) {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx, { workingDirectory: true, tools: { mode } })
  const harness = await mountAgentLoopTestHarness(ctx)
  return { ctx, harness }
}

/** Register an observable string tool; `seen` records every executed value. */
function registerObservedTool(ctx, name, seen) {
  return ctx.tools.register(defineTool({
    name,
    description: `Observe one ${name} call.`,
    parameters: { value: { type: 'string', required: true } },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    execute(args) {
      seen.push(args.value)
      return Promise.resolve(`observed:${args.value}`)
    },
  }))
}

test('A1/A2/A3 — resolve, executor selection and pipeline order on the pinned host', async () => {
  const cwd = nextLaneWorkdir()
  const { ctx, harness } = await mountHost('native')
  try {
    const agent = await harness.create(SessionId('next-smoke-native'), {}, { cwd })
    const seen = []
    registerObservedTool(ctx, 'observe', seen)
    const order = []
    ctx.on('tools/pre-execute', async (_exec, next) => { order.push('tools/pre-execute'); return next() })
    ctx.on('tools/execute', async (_exec, next) => { order.push('tools/execute'); return next() })
    ctx.on('tools/post-execute', async (_exec, _result, next) => { order.push('tools/post-execute'); return next() })
    ctx.on('tools/result', () => { order.push('tools/result') })

    const signal = new AbortController().signal
    // A1: a step's admission is a ResolvedToolSet (dispose + per-scope view).
    const toolSet = await ctx.tools.resolve({ agent, modelSelection: MODEL_SELECTION, signal })
    assert.equal(typeof toolSet.dispose, 'function', 'resolve() must return a ResolvedToolSet with dispose()')
    assert.equal(typeof toolSet.view, 'function', 'resolve() must return a ResolvedToolSet with view()')
    const admitted = [...toolSet.view(agent).keys()]
    assert.ok(admitted.includes('observe'), `the resolved set admits the registered tool (got ${admitted.join(',')})`)

    // A2: the selected executor really runs the tool body and returns its value.
    const result = await executeModelToolFixture(ctx, {
      callId: 'next-smoke-a2', name: 'observe', arguments: { value: 'one' }, signal, agent, toolSet,
    })
    assert.equal(result.isError, false, `tool execution failed: ${JSON.stringify(result.error ?? null)}`)
    assert.equal(result.value, 'observed:one')
    assert.deepEqual(seen, ['one'], 'the tool BODY observed the call (an observable side effect, not just a schema)')
    proof('A1', true, `resolve=ResolvedToolSet dispose=function admitted=${admitted.join(',')}`)
    proof('A2', true, `executor=selected tool=observe value=${String(result.value)} bodyObserved=${JSON.stringify(seen)}`)

    // A3: the pipeline stages, in order, for that one call.
    assert.deepEqual(order, ['tools/pre-execute', 'tools/execute', 'tools/post-execute', 'tools/result'])
    proof('A3', true, `order=${order.join('>')}`)
  } finally {
    await ctx.fiber.dispose()
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('A4 — a PTC run_code nested call reaches a real inner executor', async () => {
  const cwd = nextLaneWorkdir()
  const { ctx, harness } = await mountHost('ptc')
  try {
    const agent = await harness.create(SessionId('next-smoke-ptc'), {}, { cwd })
    const inner = []
    registerObservedTool(ctx, 'inner_echo', inner)
    // A PtcRuntime provider (the host's PUBLIC provider seam) that dispatches
    // through the bindings the PTC executor handed it. The nested call crosses
    // the real run_code bridge; the handler is the registered tool's own execute.
    class FixturePtcRuntime extends PtcRuntime {
      language = 'typescript'
      isolation = 'fixture'
      resolve(request) { return { ...request, cwd, timeoutMs: 120_000 } }
      async run(spec) {
        const tools = spec.bindings.find((binding) => binding.global === 'tools')?.functions
        assert.ok(tools?.inner_echo !== undefined, 'the PTC bindings expose the registered tool')
        const value = await tools.inner_echo({ value: 'nested' })
        return { logs: [], value }
      }
    }
    await ctx.plugin(FixturePtcRuntime)
    const signal = new AbortController().signal
    const toolSet = await ctx.tools.resolve({ agent, modelSelection: MODEL_SELECTION, signal })
    // The reserved `run_code` transport is NOT a registry entry (the PTC
    // executor owns it); the admitted set carries the callable tools.
    assert.ok([...toolSet.view(agent).keys()].includes('inner_echo'), 'PTC mode admits the registered inner tool')
    const result = await executeModelToolFixture(ctx, {
      callId: 'next-smoke-a4',
      name: 'run_code',
      arguments: { code: 'return await tools.inner_echo({ value: "nested" })', description: 'nested call' },
      signal, agent, toolSet,
    })
    assert.equal(result.isError, false, `run_code failed: ${JSON.stringify(result.error ?? null)}`)
    assert.deepEqual(inner, ['nested'], 'the INNER tool body executed through the PTC nested dispatch')
    const dispatchEvents = agent.session.snapshotEvents()
      .map((event) => event.type)
      .filter((type) => type === 'tool/ptc-dispatch-start' || type === 'tool/ptc-dispatch')
    assert.deepEqual(dispatchEvents, ['tool/ptc-dispatch-start', 'tool/ptc-dispatch'])
    proof('A4', true, `transport=run_code innerBodyObserved=${JSON.stringify(inner)} sessionEvents=${dispatchEvents.join(',')} outerResult=${JSON.stringify(result.value)}`)
  } finally {
    await ctx.fiber.dispose()
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('A5/A6 — cancellation mid-flight, result notification, and the abort override', async () => {
  const cwd = nextLaneWorkdir()
  const { ctx, harness } = await mountHost('native')
  try {
    const agent = await harness.create(SessionId('next-smoke-cancel'), {}, { cwd })
    const notifications = []
    ctx.on('tools/result', (exec, result) => {
      notifications.push({ name: exec.name, isError: result.isError, text: result.content.map((b) => b.text ?? '').join('') })
    })
    // A5: a cooperative tool observes the fused signal and settles on abort.
    let bodyAborted = false
    ctx.tools.register(defineTool({
      name: 'cooperative', description: 'Settle when cancelled.', parameters: {},
      output: { schema: { type: 'string' }, render: () => [{ type: 'text', text: 'never' }] },
      execute: (_args, exec) => new Promise((_resolve, reject) => {
        exec.signal.addEventListener('abort', () => {
          bodyAborted = exec.signal.aborted
          reject(new Error('cooperative tool saw the abort'))
        }, { once: true })
      }),
    }))
    const cancel = new AbortController()
    const pending = executeModelToolFixture(ctx, {
      callId: 'next-smoke-a5', name: 'cooperative', arguments: {}, signal: cancel.signal, agent,
    })
    setTimeout(() => cancel.abort('next-host smoke: cancel mid-flight'), 40)
    const cancelled = await pending
    assert.equal(bodyAborted, true, 'the tool body saw exec.signal abort')
    assert.equal(cancelled.isError, true, 'a cancelled call settles as a failure')
    const notified = notifications.filter((entry) => entry.name === 'cooperative')
    assert.equal(notified.length, 1, 'tools/result notifies exactly once for the cancelled call')
    assert.equal(notified[0].isError, true)
    proof('A5', true, `bodySawAbort=${bodyAborted} resultIsError=${cancelled.isError} notified=${notified.length} resultText=${JSON.stringify(notified[0].text)}`)

    // A6a: a tool that ignores the abort cannot complete successfully.
    ctx.tools.register(defineTool({
      name: 'ignore_abort', description: 'Finish despite cancellation.', parameters: {},
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: v }] },
      execute: async () => {
        await new Promise((resolveWait) => setTimeout(resolveWait, 100))
        return 'finished-after-abort'
      },
    }))
    const cancel2 = new AbortController()
    const pending2 = executeModelToolFixture(ctx, {
      callId: 'next-smoke-a6a', name: 'ignore_abort', arguments: {}, signal: cancel2.signal, agent,
    })
    setTimeout(() => cancel2.abort('next-host smoke: abort ignored'), 30)
    const overridden = await pending2
    assert.equal(overridden.isError, true, 'a cancelled call never becomes a success')
    assert.equal(overridden.error?.info?.code, TOOL_ABORTED, `the host overrides the late success with ${TOOL_ABORTED}`)

    // A6b: an abort BEFORE dispatch is the other canonical code, and the body never runs.
    let dispatched = 0
    ctx.tools.register(defineTool({
      name: 'never_dispatched', description: 'Must not run.', parameters: {},
      output: { schema: { type: 'string' }, render: () => [{ type: 'text', text: 'ran' }] },
      execute: () => { dispatched += 1; return Promise.resolve('ran') },
    }))
    const pre = new AbortController()
    pre.abort('next-host smoke: abort before dispatch')
    const before = await executeModelToolFixture(ctx, {
      callId: 'next-smoke-a6b', name: 'never_dispatched', arguments: {}, signal: pre.signal, agent,
    })
    assert.equal(before.isError, true)
    assert.equal(before.error?.info?.code, TOOL_ABORTED_BEFORE_DISPATCH)
    assert.equal(dispatched, 0, 'no dispatch after a pre-dispatch abort')
    proof('A6', true, `lateSuccessOverridden=${overridden.error?.info?.code} preDispatch=${before.error?.info?.code} dispatched=${dispatched}`)
  } finally {
    await ctx.fiber.dispose()
    rmSync(cwd, { recursive: true, force: true })
  }
})

test('host identity — the tree and its native assets are the pinned bytes', () => {
  proof('HOST', true, `tag=${host.version} head=${host.head} tree=${host.tree} assets=${assets.files.map((f) => `${f.relPath}:${f.sha256}`).join('|')}`)
})
