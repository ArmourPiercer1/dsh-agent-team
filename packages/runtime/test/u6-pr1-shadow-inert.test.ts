/**
 * U6 PR1 C1 — the SHADOW row is inert (U6-SLICE-PLAN PR1: "shadow `decide()`
 * mirrors the future kernel verdict into an audit ledger only — `next()`
 * ALWAYS taken, zero effect on today's flow"; sup-a §5 condition 10: the
 * identity check preserves the success shape; condition 3: approval delegates
 * via `next()` — in shadow, ALWAYS).
 *
 * The suite drives the real row module
 * (`src/plugin/live/center-shadow-row.mjs`) over a fake agent context whose
 * `tools/execute` waterfall is simulated exactly once per call, and proves:
 *   - the listener takes `next()` EXACTLY once and returns its value UNTOUCHED;
 *   - `exec` is never mutated (deep snapshot + signal identity);
 *   - the audit ledger receives typed verdict rows and nothing else;
 *   - an internal failure is a `shadow-error` row, and `next()` is STILL taken;
 *   - the SENSITIVITY plant: a planted misbehaving guard (does not take
 *     next / returns its own value) is caught by the same waterfall checker,
 *     so the inertness assertion is load-bearing, not a tautology.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The proven untyped-glue import pattern (a5ptc-escalation-row.test.ts):
// dynamic URL import + a LOCAL interface cast — no adjacent .d.mts needed,
// the row stays a plain .mjs shipped through the dist mirror.
type ShadowHandle = {
  installed: true
  disposers: (() => void)[]
  registry: unknown
  kernel: unknown
  adapter: { readDefinition: (name: string, scope?: unknown) => unknown }
}
type ShadowRowModule = {
  installCenterShadowRow(deps: {
    agentCtx: unknown
    scopeKey: string
    ledgerPath?: string
    observe?: (row: Record<string, unknown>) => void
  }): Promise<ShadowHandle>
}
const loadRow = async (): Promise<ShadowRowModule> =>
  (await import(new URL('../src/plugin/live/center-shadow-row.mjs', import.meta.url).href)) as ShadowRowModule

type FakeExec = {
  name: string
  callId: string
  agent: { id: string }
  signal: AbortSignal
}

function makeFakeCtx(opts: { toolsGetThrows?: boolean } = {}) {
  const listeners: { event: string; fn: (exec: FakeExec, next: () => Promise<unknown>) => Promise<unknown> }[] = []
  const definitions = new Map<string, unknown>([
    ['u6_test_tool', { name: 'u6_test_tool', execute: async () => ({ ok: true }) }],
  ])
  const agentCtx = {
    tools: {
      get: (name: string) => {
        if (opts.toolsGetThrows) throw new Error('probe: scoped resolution denied')
        return definitions.get(name)
      },
      schemas: () => [{ name: 'u6_test_tool' }, { name: 'read' }],
    },
    on: (event: string, fn: (exec: FakeExec, next: () => Promise<unknown>) => Promise<unknown>) => {
      listeners.push({ event, fn })
      return () => {
        const i = listeners.findIndex((l) => l.fn === fn)
        if (i >= 0) listeners.splice(i, 1)
      }
    },
  }
  return { agentCtx, listeners, definitions }
}

/**
 * The waterfall checker: run one call through the installed listeners and
 * report whether the native chain was taken EXACTLY once and its value came
 * back UNTOUCHED. A violation is returned, never thrown — the sensitivity
 * leg feeds this a planted bad guard and must see the violation.
 */
async function runWaterfall(
  listeners: { event: string; fn: (exec: FakeExec, next: () => Promise<unknown>) => Promise<unknown> }[],
  exec: FakeExec,
): Promise<{ nextCalls: number; returned: unknown; violation: string | null }> {
  const SENTINEL = { native: 'result', shape: ['ran', 'tag'] }
  let nextCalls = 0
  const executeListeners = listeners.filter((l) => l.event === 'tools/execute')
  let returned: unknown = SENTINEL
  let deepest = false
  const next = async () => {
    nextCalls += 1
    deepest = true
    return SENTINEL
  }
  // compose right-to-left like the Host waterfall: the LAST listener is innermost
  let step: () => Promise<unknown> = next
  for (const l of [...executeListeners].reverse()) {
    const inner = step
    const current = l.fn
    step = async () => current(exec, inner)
  }
  try {
    returned = await step()
  } catch (error) {
    return { nextCalls, returned, violation: `listener threw: ${String(error)}` }
  }
  if (nextCalls !== 1) return { nextCalls, returned, violation: `next() called ${String(nextCalls)} times` }
  if (!deepest || returned !== SENTINEL) return { nextCalls, returned, violation: 'native chain result replaced' }
  return { nextCalls, returned, violation: null }
}

describe('u6-pr1 shadow row — inert by construction (conditions 3 + 10, shadow form)', () => {
  const dirs: string[] = []
  const tmpLedger = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'u6-shadow-'))
    dirs.push(dir)
    return join(dir, 'shadow.jsonl')
  }
  const readRows = (path: string): Record<string, unknown>[] =>
    existsSync(path)
      ? readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line) as Record<string, unknown>)
      : []

  it('installs ONE tools/execute listener; the call takes next() once and the result is byte-identical to the native chain', async () => {
    const ledger = tmpLedger()
    const { agentCtx, listeners } = makeFakeCtx()
    const handle = await (await loadRow()).installCenterShadowRow({ agentCtx, scopeKey: 'root-1:inst-1', ledgerPath: ledger })
    const executeListeners = listeners.filter((l) => l.event === 'tools/execute')
    expect(executeListeners).toHaveLength(1)

    const exec: FakeExec = { name: 'u6_test_tool', callId: 'call-1', agent: { id: 'agent-1' }, signal: new AbortController().signal }
    const before = JSON.stringify(exec, (_k, v) => (v instanceof AbortSignal ? 'signal' : v))
    const signalRef = exec.signal
    const outcome = await runWaterfall(listeners, exec)
    expect(outcome.violation).toBeNull()
    expect(outcome.nextCalls).toBe(1)
    expect(JSON.stringify(exec, (_k, v) => (v instanceof AbortSignal ? 'signal' : v))).toBe(before)
    expect(exec.signal).toBe(signalRef) // identity, not just value

    const rows = readRows(ledger)
    expect(rows.some((row) => row.leg === 'shadow-installed')).toBe(true)
    const verdicts = rows.filter((row) => row.leg === 'shadow-verdict')
    expect(verdicts).toHaveLength(1)
    // PR1: the table is fed NOTHING, so the kernel defers — the audit trail
    // of "saw the call, deliberately took next()".
    expect(verdicts[0]?.outcome).toBe('defer')
    expect(verdicts[0]?.code).toBe('NO_APPROVAL_ENTRY')
    expect(verdicts[0]?.name).toBe('u6_test_tool')
    expect(handle.installed).toBe(true)

    // dispose writes the audit close row and unsubscribes the listener.
    for (const dispose of handle.disposers) dispose()
    expect(listeners.filter((l) => l.event === 'tools/execute')).toHaveLength(0)
    expect(readRows(ledger).some((row) => row.leg === 'shadow-disposed')).toBe(true)
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('a call whose Definition is unreadable STILL takes next(); the verdict records the unreadable identity (fail-loud, not fail-flow)', async () => {
    const ledger = tmpLedger()
    const { agentCtx, listeners } = makeFakeCtx({ toolsGetThrows: true })
    await (await loadRow()).installCenterShadowRow({ agentCtx, scopeKey: 'root-2:inst-2', ledgerPath: ledger })
    const outcome = await runWaterfall(listeners, { name: 'u6_test_tool', callId: 'call-2', agent: { id: 'a' }, signal: new AbortController().signal })
    expect(outcome.violation).toBeNull()
    const rows = readRows(ledger)
    const verdict = rows.find((row) => row.leg === 'shadow-verdict')
    expect(verdict).toBeDefined()
    expect(verdict?.identityReadable).toBe(false)
    // identity unreadable AND table empty: the kernel refuses on identity, but
    // SHADOW only records it — the flow took next() (checked above).
    expect(verdict?.outcome === 'refuse' || verdict?.outcome === 'defer').toBe(true)
  })

  it('SENSITIVITY plant: the same checker catches a guard that does not take next() or replaces the result', async () => {
    const plantedSelfDispatch = async (exec: FakeExec, _next: () => Promise<unknown>) => ({ value: `self-dispatched ${exec.name}` })
    const plantedRefusal = async (_exec: FakeExec, _next: () => Promise<unknown>) => ({ error: 'planted veto' })
    const violationA = await runWaterfall([{ event: 'tools/execute', fn: plantedSelfDispatch }], { name: 'x', callId: '1', agent: { id: 'a' }, signal: new AbortController().signal })
    expect(violationA.violation).toContain('next() called 0 times')
    const violationB = await runWaterfall([{ event: 'tools/execute', fn: plantedRefusal }], { name: 'x', callId: '2', agent: { id: 'a' }, signal: new AbortController().signal })
    expect(violationB.violation).toContain('next() called 0 times')
    // The checker is load-bearing: a WELL-BEHAVED listener passes it.
    const wellBehaved = async (_exec: FakeExec, next: () => Promise<unknown>) => next()
    const clean = await runWaterfall([{ event: 'tools/execute', fn: wellBehaved }], { name: 'x', callId: '3', agent: { id: 'a' }, signal: new AbortController().signal })
    expect(clean.violation).toBeNull()
  })

  it('the row never throws into the waterfall even when its own decision path is broken (the failure leg takes next() too)', async () => {
    const ledger = tmpLedger()
    const { agentCtx, listeners } = makeFakeCtx()
    const observations: Record<string, unknown>[] = []
    const handle = await (await loadRow()).installCenterShadowRow({ agentCtx, scopeKey: 'root-3:inst-3', ledgerPath: ledger, observe: (row) => observations.push(row) })
    // Break the decision path AFTER install: the listener must still next().
    // (This plants the worst internal failure PR1 can have: audit is dead.)
    const adapter = handle.adapter as unknown as { readDefinition: () => never }
    adapter.readDefinition = () => {
      throw new Error('planted: adapter internals broken')
    }
    const outcome = await runWaterfall(listeners, { name: 'u6_test_tool', callId: 'call-3', agent: { id: 'a' }, signal: new AbortController().signal })
    expect(outcome.violation).toBeNull()
    const errorRows = readRows(ledger).filter((row) => row.leg === 'shadow-error')
    expect(errorRows).toHaveLength(1)
    expect(String(errorRows[0]?.detail)).toContain('planted: adapter internals broken')
    // the observe sink saw the same rows the ledger did (production channel)
    expect(observations.some((row) => row.leg === 'shadow-installed')).toBe(true)
    expect(observations.some((row) => row.leg === 'shadow-error')).toBe(true)
  })
})
