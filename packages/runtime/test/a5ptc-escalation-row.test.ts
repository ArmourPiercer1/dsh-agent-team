/**
 * alpha5 PTC fs half-arm (work order 10:04Z, owner 1ef62fcd) — the SYNTHETIC
 * leg for `live/ptc-escalation-row.mjs`: the production adjudication row that
 * turns a governed member's host escalation ask (`approval/request`,
 * reason-prefixed `escalate sandbox to <mode>: …`, the pinned host's verbatim
 * reason shape at packages/sandbox/sandbox/lib/index.js:109) into (a) one
 * durable ControlService approval (the IN PRODUCTION ask→pending ladder:
 * leader → `user-approval`, member → `leader-approval`,
 * pre-execute-adapter.ts:1822-1868 verbatim request shape) and (b) exactly
 * ONE one-shot OperationGrant through the PR2 mint + ledger
 * (tool-admission/grant-mint.ts:74/:111 — zero domain edits).
 *
 * The five negative controls mirror the reviewed demo's NC-1..5
 * (evidence/alpha5/w-ptc-outerfs L2 lineage): replay, expiry, other-team,
 * revocation-before-use, mode-binding mismatch — here graded through the
 * REAL kernel precedence (identity → realm → generation → revision →
 * fingerprint → expiry → consumption LAST). Pass-through (a non-escalation
 * ask reaches `next()` untouched) pins S1, and the census/boot row pins S4.
 * RED-FIRST: this file was committed BEFORE the row module existed (the
 * first run is the RED pin; the OS-floor lesson from the demo line).
 */
import { describe, expect, it } from 'vitest'

type RowAssembly = {
  registerMember: (m: { sessionId: string; instanceId: string; realmId: string; isLeader: boolean }) => {
    memberKey: string
    installOn: (ctxLike: { on: (ev: string, h: (...a: never[]) => unknown) => () => void }) => () => void
    revoke: () => void
  }
  adjudicate: (
    memberKey: string,
    req: { toolName: string; callId?: string; reason?: string; signal?: AbortSignal },
    next: () => Promise<string>,
  ) => Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable' | 'passthrough'>
  census: () => {
    rootSessionId: string
    membersLive: number
    adjudications: { asks: number; allowedOnce: number; refused: number; passthrough: number }
    boot: { selectedRunner: string; enforcement: string } | null
  }
  setBootCensus: (b: { selectedRunner: string; enforcement: string }) => void
  grantsState: () => Array<{ grantId: string; state: string }>
}
type RowModule = { createPtcEscalationRowAssembly: (o: Record<string, unknown>) => RowAssembly }

const loadRow = async (): Promise<RowModule> =>
  (await import(new URL('../src/plugin/live/ptc-escalation-row.mjs', import.meta.url).href)) as RowModule

const esc = (mode: string): string => `escalate sandbox to ${mode}: need to write under the workspace`

function harness(opts: { ttlMs?: number } = {}) {
  let nowMs = 1_700_000_000_000
  const controls: Array<{ requestId: string; kind: string; toolName: string; correlation: string; summary: string; decision: string | null }> = []
  let nextDecision: 'allow' | 'deny' = 'allow'
  let abortWait = false
  const controlService = {
    async requestControl(input: Record<string, unknown>) {
      const rec = {
        requestId: `req-${String(controls.length + 1)}`,
        kind: String(input.kind),
        toolName: String(input.toolName),
        correlation: String(input.correlation),
        summary: String(input.summary),
        decision: null as string | null,
      }
      controls.push(rec)
      return rec
    },
    async awaitControlDecision({ requestId }: { requestId: string }) {
      if (abortWait) {
        const e = new Error('aborted') as Error & { code: string }
        e.code = 'CONTROL_WAIT_ABORTED'
        throw e
      }
      const rec = controls.find((c) => c.requestId === requestId)
      if (rec === undefined) throw new Error('no such request')
      rec.decision = nextDecision
      return { requestId, decision: nextDecision, decisionSequence: 1 }
    },
  }
  let seq = 0
  const assembly = (async () => {
    const mod = await loadRow()
    return mod.createPtcEscalationRowAssembly({
      rootSessionId: 'root-1',
      getControlService: () => controlService,
      ttlMs: opts.ttlMs ?? 60_000,
      now: () => nowMs,
      nextGrantId: () => `g-${String(++seq)}`,
    })
  })()
  return {
    assembly,
    controls,
    advance: (ms: number) => { nowMs += ms },
    decide: (d: 'allow' | 'deny') => { nextDecision = d },
    abortWaits: (v: boolean) => { abortWait = v },
    clock: () => nowMs,
  }
}

const passthrough = async (): Promise<'passthrough'> => 'passthrough' as const

describe('a5ptc-escalation-row (PTC fs half-arm synthetic leg)', () => {
  it('NC-1 replay: one approval allows EXACTLY ONE call; the replayed ask is refused', async () => {
    const h = harness()
    const row = await h.assembly
    const m = row.registerMember({ sessionId: 's-a', instanceId: 'inst-a', realmId: 'r1', isLeader: false })
    const req = { toolName: 'run_code', callId: 'call-1', reason: esc('workspace-write') }
    expect(await row.adjudicate(m.memberKey, req, passthrough)).toBe('allowed-once')
    expect(h.controls[0]?.kind).toBe('leader-approval')
    expect(h.controls[0]?.correlation).toBe('call-1')
    expect(await row.adjudicate(m.memberKey, req, passthrough)).toBe('rejected')
    // the replay never opened a second durable approval:
    expect(h.controls.length).toBe(1)
    expect(row.grantsState().filter((g) => g.state === 'consumed').length).toBe(1)
  })

  it('NC-2 expiry: a grant consumed after its window is refused (expiry precedes consumption)', async () => {
    const h = harness({ ttlMs: 5_000 })
    const row = await h.assembly
    const m = row.registerMember({ sessionId: 's-b', instanceId: 'inst-b', realmId: 'r1', isLeader: false })
    const req = { toolName: 'run_code', callId: 'call-2', reason: esc('workspace-write') }
    expect(await row.adjudicate(m.memberKey, req, passthrough)).toBe('allowed-once')
    h.advance(5_001)
    expect(await row.adjudicate(m.memberKey, req, passthrough)).toBe('rejected')
  })

  it('NC-3 other team: another root never vouches for this root\'s grants; keys are member-scoped', async () => {
    const h = harness()
    const rowA = await h.assembly
    const mod = await loadRow()
    const rowB = mod.createPtcEscalationRowAssembly({
      rootSessionId: 'root-2',
      getControlService: () => {
        throw new Error('root-2 must NOT mint for root-1 grants')
      },
      now: () => 1_700_000_000_000,
    })
    const mA = rowA.registerMember({ sessionId: 's-a', instanceId: 'inst-a', realmId: 'r1', isLeader: false })
    const req = { toolName: 'run_code', callId: 'call-3', reason: esc('workspace-write') }
    expect(await rowA.adjudicate(mA.memberKey, req, passthrough)).toBe('allowed-once')
    // rowB was never given the approval bridge and owns a closed-world ledger:
    // presenting the grantId there is unknown-grant territory, and its census
    // stays empty.
    expect(rowB.census().adjudications.asks).toBe(0)
    // member-scoped keys: the SAME callId from a DIFFERENT member is its own
    // ask (no cross-member grant reuse).
    const mB = rowA.registerMember({ sessionId: 's-b', instanceId: 'inst-b2', realmId: 'r1', isLeader: false })
    expect(await rowA.adjudicate(mB.memberKey, req, passthrough)).toBe('allowed-once')
    expect(h.controls.length).toBe(2)
  })

  it('NC-4 revocation before use: a denied decision and an aborted wait mint NOTHING', async () => {
    const h = harness()
    const row = await h.assembly
    const m = row.registerMember({ sessionId: 's-c', instanceId: 'inst-c', realmId: 'r1', isLeader: false })
    h.decide('deny')
    expect(await row.adjudicate(m.memberKey, { toolName: 'run_code', callId: 'call-4', reason: esc('workspace-write') }, passthrough)).toBe('rejected')
    h.abortWaits(true)
    expect(await row.adjudicate(m.memberKey, { toolName: 'run_code', callId: 'call-5', reason: esc('workspace-write') }, passthrough)).toBe('cancelled')
    expect(row.grantsState().length).toBe(0)
    expect(h.controls.length).toBe(2)
  })

  it('NC-5 mode binding: a replay under a DIFFERENT mode refuses on the fingerprint', async () => {
    const h = harness()
    const row = await h.assembly
    const m = row.registerMember({ sessionId: 's-d', instanceId: 'inst-d', realmId: 'r1', isLeader: false })
    expect(await row.adjudicate(m.memberKey, { toolName: 'run_code', callId: 'call-6', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
    expect(await row.adjudicate(m.memberKey, { toolName: 'run_code', callId: 'call-6', reason: esc('read-only') }, passthrough)).toBe('rejected')
    // the mismatch never opened a second approval:
    expect(h.controls.length).toBe(1)
  })

  it('S1 pass-through: non-escalation asks delegate via next() UNTOUCHED (zero state)', async () => {
    const h = harness()
    const row = await h.assembly
    const m = row.registerMember({ sessionId: 's-e', instanceId: 'inst-e', realmId: 'r1', isLeader: false })
    let called = 0
    const next = async (): Promise<'passthrough'> => { called++; return 'passthrough' as const }
    expect(await row.adjudicate(m.memberKey, { toolName: 'run_code', callId: 'c-x', reason: 'some other approval reason' }, next)).toBe('passthrough')
    expect(await row.adjudicate(m.memberKey, { toolName: 'web_fetch', callId: 'c-y', reason: esc('workspace-write') }, next)).toBe('passthrough')
    expect(called).toBe(2)
    expect(row.census().adjudications.asks).toBe(2)
    expect(row.census().adjudications.passthrough).toBe(2)
    expect(row.grantsState().length).toBe(0)
  })

  it('S4 census + boot row + S5 disposer symmetry: install/uninstall is symmetric and the census is honest', async () => {
    const h = harness()
    const row = await h.assembly
    row.setBootCensus({ selectedRunner: 'landlock-prelauncher.py', enforcement: 'abi>=3' })
    const m = row.registerMember({ sessionId: 's-f', instanceId: 'inst-f', realmId: 'r1', isLeader: true })
    let uninstalled = 0
    const ctxLike = {
      on: (_ev: string, _h: (...a: never[]) => unknown) => () => { uninstalled++ },
    }
    const dispose = m.installOn(ctxLike)
    expect(row.census().membersLive).toBe(1)
    expect(row.census().boot?.selectedRunner).toBe('landlock-prelauncher.py')
    dispose()
    expect(uninstalled).toBe(1)
    expect(row.census().membersLive).toBe(0)
    // a leader ask routes to user-approval (the in-production ladder):
    const m2 = row.registerMember({ sessionId: 's-g', instanceId: 'inst-g', realmId: 'r1', isLeader: true })
    expect(await row.adjudicate(m2.memberKey, { toolName: 'run_code', callId: 'call-7', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
    expect(h.controls[0]?.kind).toBe('user-approval')
    // with NO control service the row FAILS CLOSED (claims 'unavailable', never delegates):
    const mod = await loadRow()
    const rowX = mod.createPtcEscalationRowAssembly({ rootSessionId: 'root-x', getControlService: () => undefined, now: () => 1 })
    const mx = rowX.registerMember({ sessionId: 's-x', instanceId: 'inst-x', realmId: 'rx', isLeader: false })
    expect(await rowX.adjudicate(mx.memberKey, { toolName: 'run_code', callId: 'c-z', reason: esc('workspace-write') }, passthrough)).toBe('unavailable')
  })
})
