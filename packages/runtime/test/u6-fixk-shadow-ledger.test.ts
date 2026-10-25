/**
 * FIX-K K5 (U6 kernel safety, external audit 2026-10-26) — the shadow audit
 * ledger had NO bound: every `tools/execute` call appended a JSONL row for
 * the whole life of the agent scope, an unbounded disk-growth channel whose
 * only release was process exit.
 *
 * Fix contract (stop-with-marker, per-install):
 *  - the row writer carries a row budget (`maxLedgerRows`, default large) and
 *    a byte budget (`maxLedgerBytes`);
 *  - at the first write that would exceed a budget the writer appends ONE
 *    terminal marker row (`leg: 'shadow-ledger-capped'`, carrying the budgets
 *    and the counts) and then STOPS appending to the file;
 *  - the `observe` sink keeps receiving every row (the caller owns that
 *    channel's bound), and the flow keeps taking `next()` — capping is an
 *    audit-channel event, never a flow event (the inert law holds);
 *  - `dispose()` closes the writer: after it, nothing appends any more, and
 *    the writer state is released (per-install closure, nothing module-global
 *    grows).
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

type ShadowRowModule = {
  installCenterShadowRow(deps: {
    agentCtx: unknown
    scopeKey: string
    ledgerPath?: string
    observe?: (row: Record<string, unknown>) => void
    maxLedgerRows?: number
    maxLedgerBytes?: number
  }): Promise<{
    installed: true
    disposers: (() => void)[]
    registry: unknown
    kernel: unknown
    adapter: unknown
  }>
}
const loadRow = async (): Promise<ShadowRowModule> =>
  (await import(new URL('../src/plugin/live/center-shadow-row.mjs', import.meta.url).href)) as ShadowRowModule

type FakeExec = {
  name: string
  callId: string
  agent: { id: string }
  signal: AbortSignal
}

function makeFakeCtx() {
  const listeners: { event: string; fn: (exec: FakeExec, next: () => Promise<unknown>) => Promise<unknown> }[] = []
  const definitions = new Map<string, unknown>([
    ['u6_test_tool', { name: 'u6_test_tool', execute: async () => ({ ok: true }) }],
  ])
  const agentCtx = {
    tools: {
      get: (name: string) => definitions.get(name),
      schemas: () => [{ name: 'u6_test_tool' }],
    },
    on: (event: string, fn: (exec: FakeExec, next: () => Promise<unknown>) => Promise<unknown>) => {
      listeners.push({ event, fn })
      return () => {
        const i = listeners.findIndex((l) => l.fn === fn)
        if (i >= 0) listeners.splice(i, 1)
      }
    },
  }
  return { agentCtx, listeners }
}

/** Drive one call through the installed waterfall; assert inertness inline. */
async function driveCall(
  listeners: { event: string; fn: (exec: FakeExec, next: () => Promise<unknown>) => Promise<unknown> }[],
  name: string,
  callId: string,
): Promise<void> {
  const SENTINEL = { native: 'result' }
  let nextCalls = 0
  const executeListeners = listeners.filter((l) => l.event === 'tools/execute')
  let step: () => Promise<unknown> = async () => {
    nextCalls += 1
    return SENTINEL
  }
  for (const l of [...executeListeners].reverse()) {
    const inner = step
    const current = l.fn
    step = async () => current({ name, callId, agent: { id: 'a' }, signal: new AbortController().signal }, inner)
  }
  const returned = await step()
  // the inert law survives capping: next() exactly once, native value untouched
  expect(nextCalls).toBe(1)
  expect(returned).toBe(SENTINEL)
}

describe('FIX-K K5 — the shadow ledger is bounded and released on dispose', () => {
  const dirs: string[] = []
  const tmpLedger = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'u6-fixk-ledger-'))
    dirs.push(dir)
    return join(dir, 'shadow.jsonl')
  }
  const readRows = (path: string): Record<string, unknown>[] =>
    existsSync(path)
      ? readFileSync(path, 'utf8')
          .split('\n')
          .filter((line) => line.trim() !== '')
          .map((line) => JSON.parse(line) as Record<string, unknown>)
      : []

  it('RED K5: the file stops at maxLedgerRows with ONE terminal marker; later calls only reach the sink (flow unchanged)', async () => {
    const ledger = tmpLedger()
    const { agentCtx, listeners } = makeFakeCtx()
    const sink: Record<string, unknown>[] = []
    await (await loadRow()).installCenterShadowRow({
      agentCtx,
      scopeKey: 'root-k5:inst-1',
      ledgerPath: ledger,
      observe: (row) => sink.push(row),
      maxLedgerRows: 3,
    })
    // 6 calls, 1 install row already written: an unbounded writer (the bug)
    // appends 7 rows and never marks the cap.
    for (let i = 0; i < 6; i += 1) await driveCall(listeners, 'u6_test_tool', `call-${String(i)}`)

    const rows = readRows(ledger)
    expect(rows.length).toBe(3) // exactly the budget: install + 2 verdict rows
    expect(rows[rows.length - 1]?.leg).toBe('shadow-ledger-capped')
    // every call was still observed on the sink channel (audit degrades, flow does not):
    const sunk = sink.filter((row) => row.leg === 'shadow-verdict')
    expect(sunk.length).toBe(6)
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('RED K5: the byte budget caps too, with the same single terminal marker', async () => {
    const ledger = tmpLedger()
    const { agentCtx, listeners } = makeFakeCtx()
    await (await loadRow()).installCenterShadowRow({
      agentCtx,
      scopeKey: 'root-k5:inst-2',
      ledgerPath: ledger,
      maxLedgerBytes: 1, // even the install row busts a one-byte budget
    })
    await driveCall(listeners, 'u6_test_tool', 'call-1')
    const rows = readRows(ledger)
    expect(rows.length).toBeLessThanOrEqual(2)
    expect(rows.some((row) => row.leg === 'shadow-ledger-capped')).toBe(true)
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('RED K5: dispose RELEASES the writer — after dispose nothing more appends (and dispose itself is audited)', async () => {
    const ledger = tmpLedger()
    const { agentCtx, listeners } = makeFakeCtx()
    const handle = await (await loadRow()).installCenterShadowRow({
      agentCtx,
      scopeKey: 'root-k5:inst-3',
      ledgerPath: ledger,
    })
    await driveCall(listeners, 'u6_test_tool', 'call-1')
    // Capture the listener body BEFORE disposing; a stale reference driving
    // the row after dispose must never append again.
    const stale = listeners.filter((l) => l.event === 'tools/execute').map((l) => l.fn)
    for (const dispose of handle.disposers) dispose()
    const rowsAtDispose = readRows(ledger)
    expect(rowsAtDispose.some((row) => row.leg === 'shadow-disposed')).toBe(true)

    for (const fn of stale) {
      let nextCalls = 0
      await fn(
        { name: 'u6_test_tool', callId: 'ghost', agent: { id: 'a' }, signal: new AbortController().signal },
        async () => {
          nextCalls += 1
          return { native: 'result' }
        },
      )
      expect(nextCalls).toBe(1) // still inert-by-delegation even post-dispose
    }
    // the file is CLOSED: identical bytes after the dispose attempt above
    expect(readRows(ledger)).toEqual(rowsAtDispose)
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })

  it('regression: under the default budget the ledger behaves exactly like PR1 (no cap marker, every row present)', async () => {
    const ledger = tmpLedger()
    const { agentCtx, listeners } = makeFakeCtx()
    await (await loadRow()).installCenterShadowRow({ agentCtx, scopeKey: 'root-k5:inst-4', ledgerPath: ledger })
    for (let i = 0; i < 5; i += 1) await driveCall(listeners, 'u6_test_tool', `call-${String(i)}`)
    const rows = readRows(ledger)
    expect(rows.some((row) => row.leg === 'shadow-ledger-capped')).toBe(false)
    expect(rows.filter((row) => row.leg === 'shadow-verdict')).toHaveLength(5)
    // K4 ride-along: the verdict rows carry the install scopeKey (the scoped
    // resolution the kernel keyed its opinion on).
    expect(rows.filter((row) => row.leg === 'shadow-verdict').every((row) => row.scopeKey === 'root-k5:inst-4')).toBe(true)
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
  })
})
