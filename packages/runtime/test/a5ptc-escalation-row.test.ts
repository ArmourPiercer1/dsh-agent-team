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
 * LIFECYCLE-FIX ROUND (live run live-2026-10-18T12-55-53): the three U-legs
 * (L-U1 drop face / L-U1b archive face / L-U2 cold re-mount) were likewise
 * committed RED-first against the shipped row — the measured production
 * reds (row routes a torn-down member; re-mount throws 'already registered')
 * are reproduced at the unit seam before the fix lands.
 * U-1b FOLLOW-UP ROUND (live runs live-2026-10-18T13-4* + T13-51-55, 2x):
 * L-U1b was RED again — the first version flipped a `resident` boolean and
 * never modeled that a COLD RE-MOUNT re-establishes residency on a durably
 * ARCHIVED member. The leg now walks the PRODUCTION archive procedure (the
 * real P7-T3 core service over the real durable domain) and pins the row
 * against every post-archive face; the ask-time routability gained the
 * DURABLE admissibility oracle beside the residency oracle.
 */
import { describe, expect, it } from 'vitest'

type MemberHandle = {
  memberKey: string
  installOn: (ctxLike: { on: (ev: string, h: (...a: never[]) => unknown) => () => void }) => () => void
  revoke: () => void
  /** Lifecycle-fix round: routable = this face is live AND the injected
   *  residency predicate (when given) still says the session is resident. */
  isRoutable: () => boolean
}
type RowAssembly = {
  registerMember: (m: {
    sessionId: string
    instanceId: string
    realmId: string
    isLeader: boolean
    /** Lifecycle-fix round: the injected residency oracle (the glue passes
     *  the sync `residency.has` port). Absent = always resident (pure rows). */
    isResident?: () => boolean
    /** U-1b follow-up round: the injected DURABLE admissibility oracle (the
     *  glue reads the durable member lifecycle; ARCHIVED/DISPOSED ⇒ false —
     *  residency is volatile, the durable record is the archive truth).
     *  Absent = always admissible (pure rows). */
    isAdmissible?: () => boolean
  }) => MemberHandle
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
/** The lifecycle-fix round: the router keys on the member HANDLE (the
 *  registerMember result), so a re-mounted session's stale Agent object can
 *  never route into the new generation (identity, not the shared key). */
type RowRouter = {
  registerAgent: (agent: object, member: MemberHandle, assembly: RowAssembly) => () => void
  resolve: (agent: object) => unknown
  route: (req: Record<string, unknown>, next: () => Promise<'passthrough'>) => Promise<unknown>
  liveCount: () => number
  /** Lifecycle-fix round (U-1/U-1b): the public `agent/disposed` mirror —
   *  drops the disposed Agent's routing entry AND revokes its member face.
   *  Idempotent; never throws; true only when an entry was dropped. */
  onAgentDisposed: (agent: unknown) => boolean
}
type RowModule = {
  createPtcEscalationRowAssembly: (o: Record<string, unknown>) => RowAssembly
  createPtcEscalationRouter: () => RowRouter
}

const loadRow = async (): Promise<RowModule> =>
  (await import(new URL('../src/plugin/live/ptc-escalation-row.mjs', import.meta.url).href)) as RowModule

const esc = (mode: string): string => `escalate sandbox to ${mode}: need to write under the workspace`

function harness(opts: { ttlMs?: number } = {}) {
  let nowMs = 1_700_000_000_000
  const controls: Array<{ requestId: string; kind: string; toolName: string; correlation: string; summary: string; decision: string | null }> = []
  const observations: Array<Record<string, unknown>> = []
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
      onObserve: (o: Record<string, unknown>) => { observations.push(o) },
    })
  })()
  return {
    assembly,
    controls,
    observations,
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
    // OWNERSHIP is the reason prefix (the host escalation approver face is
    // tool-generic — {agent, toolName, callId, reason}; the toolName rides
    // the fingerprint), so a NON-escalation reason — whatever the tool —
    // delegates untouched:
    expect(await row.adjudicate(m.memberKey, { toolName: 'web_fetch', callId: 'c-y', reason: 'tool needs permission: network access' }, next)).toBe('passthrough')
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

  // ── LIFECYCLE-FIX ROUND (live run live-2026-10-18T12-55-53, U-1/U-1b/U-2) ──
  // The three production teardown faces measured RED: after a residency
  // DROP (U-1) or a LEADER ARCHIVE (U-1b) the row kept ROUTING the torn-down
  // member (`dropped=true … seenByRow=true`, `archived=true … seenByRow=true`)
  // because the mount's unregister rode the ROW-level toolDisposers drain
  // (row stop only); and a COLD RE-MOUNT refused with
  // `member '…' is already registered (one face per session)` (U-2) — the
  // production entry could not recover a torn-down governed member. The legs
  // below pin the fix: the member lifecycle rides the RESIDENCY lifecycle —
  // (a) the public `agent/disposed` face (host.ts, the activation-fence
  // listener precedent) drops the routing entry AND revokes the face,
  // idempotent; (b) a dropped (non-resident) member NEVER routes — the ask
  // delegates through next() with ZERO state (the pre-round host chain owns
  // it, exactly the measured fail-closed landing); (c) a re-mount REPLACES
  // the stale face (one LIVE face per session, recoverable forever after).

  it('L-U1 residency drop: a dropped member never routes again — zero state, then the disposed face cleans up idempotently', async () => {
    const h = harness()
    const mod = await loadRow()
    const row = await h.assembly
    const router = mod.createPtcEscalationRouter()
    let resident = true
    const m = row.registerMember({ sessionId: 's-u1', instanceId: 'inst-u1', realmId: 'r1', isLeader: false, isResident: () => resident })
    const agent = { id: 's-u1' }
    const off = router.registerAgent(agent, m, row)
    // positive control: the live member routes and lands allowed-once.
    expect(await router.route({ agent, toolName: 'run_code', callId: 'u1-call-1', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
    expect(h.controls.length).toBe(1)
    // RESIDENCY DROP: liveAgents.delete is synchronous (the sync port /
    // quiesce step), the Agent dispose runs behind it — the row must stop
    // routing AT THE DROP, with zero observation and zero durable request.
    resident = false
    const obsBefore = h.observations.length
    const asksBefore = row.census().adjudications.asks
    expect(await router.route({ agent, toolName: 'run_code', callId: 'u1-call-2', reason: esc('workspace-write') }, passthrough)).toBe('passthrough')
    expect(h.controls.length).toBe(1)
    expect(h.observations.length).toBe(obsBefore)
    expect(row.census().adjudications.asks).toBe(asksBefore)
    // the public agent/disposed face (host.ts global listener): drops the
    // entry AND revokes the member face (census honest, member-revoked booked).
    expect(router.onAgentDisposed(agent)).toBe(true)
    expect(router.liveCount()).toBe(0)
    expect(row.census().membersLive).toBe(0)
    expect(h.observations.some((o) => o.event === 'member-revoked' && o.session === 's-u1')).toBe(true)
    // idempotent: a second disposed event is a no-op that never throws and
    // writes nothing; the row-stop drain disposer (late) is also a no-op.
    const obsAfter = h.observations.length
    expect(router.onAgentDisposed(agent)).toBe(false)
    expect(router.onAgentDisposed(undefined)).toBe(false)
    expect(router.onAgentDisposed(null)).toBe(false)
    off()
    expect(h.observations.length).toBe(obsAfter)
    // and the dead identity still never routes:
    expect(await router.route({ agent, toolName: 'run_code', callId: 'u1-call-3', reason: esc('workspace-write') }, passthrough)).toBe('passthrough')
    expect(h.controls.length).toBe(1)
  })

  it('L-U1b archive face (PRODUCTION PROCEDURE FORM): the REAL archiveMember commits ARCHIVED durably — the archived member never routes again, NOT EVEN through a cold re-mount that re-establishes residency; restore recovers', async () => {
    // U-1b follow-up round: the first L-U1b flipped a `resident` boolean —
    // too weak, and that is exactly why vitest was green while the live kit
    // stayed red (runs live-2026-10-18T12-55-53 + T13-51-55). This leg walks
    // the PRODUCTION archive procedure instead: the real P7-T3 core service
    // over the REAL durable domain (p7t3-helpers: five live quiesce steps →
    // durable COMMIT_ARCHIVE through the CAS commit port), then measures the
    // row against EVERY later face. The law being pinned: RESIDENCY is a
    // volatile runtime map (a drop flips it, ANY later cold resume flips it
    // BACK); the durable member lifecycle is the ARCHIVE truth. A routable
    // ask-time face needs BOTH: resident AND durably admissible.
    const { createLifecycleWorld, destroyWorld, P7T3_SPEC_A } = await import('./p7t3-helpers.js')
    const world = await createLifecycleWorld('a5ptc-u1b-archive', {
      seedMembers: [{ label: P7T3_SPEC_A.label, lifecycle: 'SETTLED', resident: true }],
    })
    try {
      const h = harness()
      const mod = await loadRow()
      const row = await h.assembly
      const router = mod.createPtcEscalationRouter()
      const target = world.target(P7T3_SPEC_A.label)
      const sid = world.childSessions[P7T3_SPEC_A.label]
      if (sid === undefined) throw new Error('a5ptc-u1b: seeded member child session missing')
      // the DURABLE admissibility oracle — in production the glue injects a
      // read of the real durable member row (agent-bindings:
      // domain.repositories.memberInstances, the SAME public read the
      // lifecycle interrupt port rides); ARCHIVED/DISPOSED ⇒ not routable.
      const isAdmissible = (): boolean => {
        const lc = world.recordFor(P7T3_SPEC_A.label)?.lifecycle
        return lc !== 'ARCHIVED' && lc !== 'DISPOSED'
      }
      const isResident = (): boolean => world.residency.hasResidency(sid)
      const m = row.registerMember({ sessionId: sid, instanceId: String(target.instanceId), realmId: 'r1', isLeader: false, isResident, isAdmissible })
      const agent = { id: sid }
      router.registerAgent(agent, m, row)
      // positive control: the live member routes and lands allowed-once.
      expect(await router.route({ agent, toolName: 'run_code', callId: 'u1b-call-1', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
      expect(h.controls.length).toBe(1)
      // THE PRODUCTION ARCHIVE PROCEDURE (leader tool → router → the locked
      // LifecycleService core): quiesce (close-admission, interrupt, drain,
      // wait-quiescence, RELEASE-RESIDENCY) then the durable ARCHIVE commit.
      const archive = await world.service.archiveMember(target)
      expect(archive.residencyDropped).toBe(true)
      expect(world.recordFor(P7T3_SPEC_A.label)?.lifecycle).toBe('ARCHIVED')
      // FACE 1 — the drop itself: residency has gone false at step 5, so the
      // ask delegates untouched (the U-1 mechanism, still true).
      expect(await router.route({ agent, toolName: 'run_code', callId: 'u1b-call-2', reason: esc('workspace-write') }, passthrough)).toBe('passthrough')
      expect(h.controls.length).toBe(1)
      // FACE 2 — THE LIVE RED: the durable session stays on disk; ANY later
      // execution of the archived member cold-resumes it — residency is
      // re-established and the host mounts a FRESH Agent object (the mount
      // re-registers through the replace semantics). Residency says resident
      // again; only the DURABLE lifecycle still says ARCHIVED. The row must
      // refuse on the durable truth: delegation, zero observation, and above
      // all NO second durable request (the measured live red opened one).
      world.residency.markResident(sid)
      const agent2 = { id: sid }
      const m2 = row.registerMember({ sessionId: sid, instanceId: String(target.instanceId), realmId: 'r1', isLeader: false, isResident, isAdmissible })
      router.registerAgent(agent2, m2, row)
      const obsBefore = h.observations.length
      expect(await router.route({ agent: agent2, toolName: 'run_code', callId: 'u1b-call-3', reason: esc('workspace-write') }, passthrough)).toBe('passthrough')
      expect(h.controls.length).toBe(1) // NO durable request for an archived member
      expect(h.observations.length).toBe(obsBefore) // zero observation, zero state
      // the LATE disposed event for the drop-step handle stays entry-identity
      // guarded: it drops only the stale entry, never the new face.
      expect(router.onAgentDisposed(agent)).toBe(true)
      expect(router.liveCount()).toBe(1)
      expect(await router.route({ agent: agent2, toolName: 'run_code', callId: 'u1b-call-3', reason: esc('workspace-write') }, passthrough)).toBe('passthrough')
      // FACE 3 — restore through the REAL procedure (ARCHIVED → SETTLED):
      // the durable truth reopens, the SAME live face routes again — the
      // admissibility gate is state-derived, never a permanent lock-out.
      await world.service.restoreMember(target)
      expect(world.recordFor(P7T3_SPEC_A.label)?.lifecycle).toBe('SETTLED')
      expect(await router.route({ agent: agent2, toolName: 'run_code', callId: 'u1b-call-4', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
      expect(h.controls.length).toBe(2)
      // and one-shot stays one-shot on the recovered face (replay refused).
      expect(await router.route({ agent: agent2, toolName: 'run_code', callId: 'u1b-call-4', reason: esc('workspace-write') }, passthrough)).toBe('rejected')
      expect(h.controls.length).toBe(2)
    } finally {
      await destroyWorld(world)
    }
  })

  it('L-U2 cold re-mount: re-entry REPLACES the stale face (no throw), the new Agent recovers allowed-once one-shot, stale identity never leaks', async () => {
    const h = harness()
    const mod = await loadRow()
    const row = await h.assembly
    const router = mod.createPtcEscalationRouter()
    let residentA = true
    const mA = row.registerMember({ sessionId: 's-u2', instanceId: 'inst-u2', realmId: 'r1', isLeader: false, isResident: () => residentA })
    const agentA = { id: 's-u2' }
    const offA = router.registerAgent(agentA, mA, row)
    expect(await router.route({ agent: agentA, toolName: 'run_code', callId: 'u2-call-1', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
    // cold-resume race: residency dropped, the OLD handle disposed behind —
    // its agent/disposed event has NOT arrived yet (the sync port is
    // fire-and-forget). The re-mount MUST NOT throw (U-2's 422 root face) —
    // same-session re-entry replaces the stale face.
    residentA = false
    let residentB = true
    const mB = row.registerMember({ sessionId: 's-u2', instanceId: 'inst-u2', realmId: 'r1', isLeader: false, isResident: () => residentB })
    expect(row.census().membersLive).toBe(1)
    expect(h.observations.some((o) => o.event === 'member-revoked' && o.session === 's-u2')).toBe(true)
    // the stale Agent object (its dispose event still pending) never routes
    // into the new generation — delegation, zero state:
    const obsBefore = h.observations.length
    expect(await router.route({ agent: agentA, toolName: 'run_code', callId: 'u2-call-9', reason: esc('workspace-write') }, passthrough)).toBe('passthrough')
    expect(h.observations.length).toBe(obsBefore)
    expect(h.controls.length).toBe(1)
    // the NEW Agent (the host mints a fresh object for the same session id)
    // registers and recovers adjudication — allowed-once, still ONE-SHOT:
    const agentB = { id: 's-u2' }
    router.registerAgent(agentB, mB, row)
    expect(await router.route({ agent: agentB, toolName: 'run_code', callId: 'u2-call-2', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
    expect(h.controls.length).toBe(2)
    expect(await router.route({ agent: agentB, toolName: 'run_code', callId: 'u2-call-2', reason: esc('workspace-write') }, passthrough)).toBe('rejected')
    expect(h.controls.length).toBe(2) // replay meets the CONSUMED mark, never a fresh approval
    // a pre-drop callId keeps its consumed fact across the re-mount:
    expect(await router.route({ agent: agentB, toolName: 'run_code', callId: 'u2-call-1', reason: esc('workspace-write') }, passthrough)).toBe('rejected')
    expect(h.controls.length).toBe(2)
    // the LATE disposed event for the old Agent drops only the STALE entry;
    // the old handle's revoke (row-stop drain, late) cannot kill the new face.
    expect(router.onAgentDisposed(agentA)).toBe(true)
    expect(router.liveCount()).toBe(1)
    expect(row.census().membersLive).toBe(1)
    offA()
    mA.revoke()
    expect(row.census().membersLive).toBe(1)
    expect(await router.route({ agent: agentB, toolName: 'run_code', callId: 'u2-call-3', reason: esc('workspace-write') }, passthrough)).toBe('allowed-once')
    residentB = false
    expect(await router.route({ agent: agentB, toolName: 'run_code', callId: 'u2-call-4', reason: esc('workspace-write') }, passthrough)).toBe('passthrough')
  })
})
