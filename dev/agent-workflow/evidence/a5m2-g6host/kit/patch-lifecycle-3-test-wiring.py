p = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/packages/runtime/test/a5m2-g6-session-query-wiring.test.ts'
s = open(p).read()
n = 0
def rep(old, new, count=1):
    global s, n
    assert s.count(old) == count, f'MISSING/AMBIG({s.count(old)}): ' + old[:80].replace('\n', '\\n')
    s = s.replace(old, new, count)
    n += 1

# typed decl: lifecycle observer replaces observeCurrent
rep("""  buildG6QuerySupplyFromService: (service?: unknown, observeCurrent?: () => unknown) =>
    | { ok: true, providerId: string, queryPorts: Record<string, unknown>, declaredMount: Record<string, unknown> }
    | { ok: false, code: string, detail: string }""",
"""  buildG6QuerySupplyFromService: (service?: unknown, lifecycle?: { currentGeneration(): { id: number, service: unknown } | null }) =>
    | { ok: true, providerId: string, queryPorts: Record<string, unknown>, generation: number, lifecycle: { currentGeneration(): { id: number, service: unknown } | null }, declaredMount: Record<string, unknown> }
    | { ok: false, code: string, detail: string }""")

# helpers: fake public generations (root ruling 3, increment 1)
rep("const WIRE = (await import(new URL('../src/plugin/live/governed-families/g6-session-query-wiring.mjs', import.meta.url).href)) as {",
"""// Root ruling 3 (lane increment 1): the PUBLIC Provider lifecycle observer
// is the ONLY currentness source. lifecycleOf answers a stable ACTIVE
// generation; NO_GEN models an absent/non-ACTIVE observer fiber (fail-closed).
const lifecycleOf = (service: unknown, id = 1): { currentGeneration(): { id: number, service: unknown } | null } => ({ currentGeneration: () => ({ id, service }) })
const NO_GEN: { currentGeneration(): { id: number, service: unknown } | null } = { currentGeneration: () => null }

const WIRE = (await import(new URL('../src/plugin/live/governed-families/g6-session-query-wiring.mjs', import.meta.url).href)) as {""")

# fixture baseInput: lifecycle + generation ride the hand-built facets
rep("""    readNative,
    queryPorts: qp,
    readCaller,""",
"""    readNative,
    queryPorts: qp,
    // Root ruling 3: stable generation-1 observer for the hand-built facets.
    lifecycle: lifecycleOf(qp, 1),
    generation: 1,
    readCaller,""")

# i1: keep SUPPLY_ABSENT via an ACTIVE-but-serviceless observer; add the
# new-world absent-observer pin i1b (provider not deployed / fiber inactive).
rep("""    it('i1: no service registered — SUPPLY_ABSENT typed census (never a fake stand-in)', () => {
      const supply = WIRE.buildG6QuerySupplyFromService(undefined)
      expect(supply.ok).toBe(false)
      if (supply.ok === true) return
      expect(supply.code).toBe(CODES.SUPPLY_ABSENT)
    })""",
"""    it('i1: no service registered — SUPPLY_ABSENT typed census (never a fake stand-in)', () => {
      const supply = WIRE.buildG6QuerySupplyFromService(undefined, lifecycleOf(undefined))
      expect(supply.ok).toBe(false)
      if (supply.ok === true) return
      expect(supply.code).toBe(CODES.SUPPLY_ABSENT)
    })

    it('i1b: NO ACTIVE generation (observer absent, or the ctx.inject child fiber non-ACTIVE because the provider is not deployed) — PORT_LIFECYCLE_UNOBSERVABLE typed fail-closed; unknowable never becomes allow-by-default (root ruling 3, center precision 1)', () => {
      const noObserver = WIRE.buildG6QuerySupplyFromService({}, undefined)
      expect(noObserver.ok).toBe(false)
      if (noObserver.ok === true) return
      expect(noObserver.code).toBe(CODES.PORT_LIFECYCLE_UNOBSERVABLE)
      const noGeneration = WIRE.buildG6QuerySupplyFromService({}, NO_GEN)
      expect(noGeneration.ok).toBe(false)
      if (noGeneration.ok === true) return
      expect(noGeneration.code).toBe(CODES.PORT_LIFECYCLE_UNOBSERVABLE)
    })""")

# i6 full rewrite (the removed PORT_METHOD_MOVED law becomes a pin; the
# public generation replacement is the new INVALIDATION law)
i6_start = "    it('i6: a REAL method generational change REFUSES"
i6_end = "expect(w.calls.length, 'zero port entries past the drift').toBe(callsBefore)\n    })\n"
i0 = s.index(i6_start)
i1_ = s.index(i6_end, i0) + len(i6_end)
NEW_I6 = """    it('i6: REMOVED-LAW PIN + generation INVALIDATION (root ruling 3): an in-place method rebind inside the SAME generation is NEITHER observed NOR promised (ruling (c): ctx.set same-fiber swaps do not notify; the removed PORT_METHOD_MOVED law stays removed — anti-reintroduction); a PUBLIC generation replacement INVALIDATES the row — typed PORT_RECEIVER_MOVED quoting BOTH markers, zero forwarding', async () => {
      const w = makeWorld({ tag: 'i6' })
      const ports = w.qp as unknown as {
        searchQueryPort: { searchSessions: (a: unknown, b: unknown) => Promise<unknown>, searchEvents: (a: unknown, b: unknown) => Promise<unknown> }
        traceQueryPort: { traceSession: (a: unknown, b: unknown) => Promise<unknown>, traceEvent: (a: unknown, b: unknown) => Promise<unknown> }
        eventReadQueryPort: { readEvent: (a: unknown, b: unknown) => Promise<unknown> }
        authorizationQueryPort: { filterSessions: (a: unknown, b: unknown) => Promise<unknown> }
        titlesQueryPort: { readTitleSnapshots: (a: unknown, b: unknown) => Promise<unknown> }
      }
      const engine: Record<string, unknown> = {
        name: 'sessionQuery',
        searchSessions: ports.searchQueryPort.searchSessions,
        searchEvents: ports.searchQueryPort.searchEvents,
        traceSession: ports.traceQueryPort.traceSession,
        traceEvent: ports.traceQueryPort.traceEvent,
        readEvent: ports.eventReadQueryPort.readEvent,
        filterSessions: ports.authorizationQueryPort.filterSessions,
        readTitleSnapshots: ports.titlesQueryPort.readTitleSnapshots,
      }
      let liveId = 1
      const observer = { currentGeneration: () => ({ id: liveId, service: engine }) }
      const supply = WIRE.buildG6QuerySupplyFromService(engine, observer)
      expect(supply.ok).toBe(true)
      if (supply.ok !== true) return
      const asm = w.build({ providerId: supply.providerId, queryPorts: supply.queryPorts, declaredMount: supply.declaredMount, lifecycle: supply.lifecycle, generation: supply.generation })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_trace')!
      expect(String(await def.execute(TRACE_ARGS, { callId: 'exec-i6-steady' }))).toContain('s-a')
      // ANTI-REINTRODUCTION PIN (ruling (c)): swapping the method ON THE
      // SERVICE OBJECT inside the same generation changes nothing the row
      // can see — the generation-1 bound handles serve. No PORT_METHOD_MOVED
      // law exists any more and none may be reinstated.
      engine.traceSession = async function swappedB (_a: unknown, _b: unknown): Promise<string> { return 'E:B' }
      const stillServed = String(await def.execute(TRACE_ARGS, { callId: 'exec-i6-same-generation' }))
      expect(stillServed, 'the bound generation-1 handle serves — no same-fiber hot-swap is promised or detected').toContain('s-a')
      // THE PUBLIC LIFECYCLE TRANSITION: a NEW ACTIVE generation invalidates
      // the placement generation — typed, log-observable, both markers.
      liveId = 2
      const callsBefore = w.calls.length
      const refusal = await asRefusal(def.execute(TRACE_ARGS, { callId: 'exec-i6-replaced' }))
      expect(refusal.code).toBe(SC.PORT_RECEIVER_MOVED)
      expect(refusal.detail).toContain('generation 1 is INVALIDATED')
      expect(refusal.detail).toContain('live generation 2')
      expect(w.calls.length, 'zero forwarding past the generation replacement').toBe(callsBefore)
    })
"""
s = s[:i0] + NEW_I6 + s[i1_:]
n += 1

# (j) describe full rewrite
j_start = "  describe('(j) WHOLE-RECEIVER CURRENT IDENTITY"
j0 = s.index(j_start)
j_end = s.index("    it('j2:", j0)
j1x = s.index("})\n})", j_end) + len("})\n})")
NEW_J = """  describe('(j) PUBLIC PROVIDER LIFECYCLE CURRENTNESS (root ruling 3, lane increment 1): a generation replacement INVALIDATES the row typed with both markers; a non-ACTIVE/unobservable observer fail-closes; the removed per-read identity law stays removed (anti-reintroduction)', () => {
    const engineOver = (qp: Record<string, unknown>) => {
      const p = qp as unknown as {
        searchQueryPort: { searchSessions: (a: unknown, b: unknown) => Promise<unknown>, searchEvents: (a: unknown, b: unknown) => Promise<unknown> }
        traceQueryPort: { traceSession: (a: unknown, b: unknown) => Promise<unknown>, traceEvent: (a: unknown, b: unknown) => Promise<unknown> }
        eventReadQueryPort: { readEvent: (a: unknown, b: unknown) => Promise<unknown> }
        authorizationQueryPort: { filterSessions: (a: unknown, b: unknown) => Promise<unknown> }
        titlesQueryPort: { readTitleSnapshots: (a: unknown, b: unknown) => Promise<unknown> }
      }
      return {
        name: 'sessionQuery',
        searchSessions: p.searchQueryPort.searchSessions,
        searchEvents: p.searchQueryPort.searchEvents,
        traceSession: p.traceQueryPort.traceSession,
        traceEvent: p.traceQueryPort.traceEvent,
        readEvent: p.eventReadQueryPort.readEvent,
        filterSessions: p.authorizationQueryPort.filterSessions,
        readTitleSnapshots: p.titlesQueryPort.readTitleSnapshots,
      }
    }

    it('j1: a generation replacement — even carrying the VERY SAME service face — refuses PORT_RECEIVER_MOVED quoting pinned-vs-live markers with zero forwarding (old approvals never ride; the same-face case is exactly what the removed per-read identity law could never see — the lifecycle can)', async () => {
      const w = makeWorld({ tag: 'j1' })
      const approved = engineOver(w.qp)
      let gen: { id: number, service: unknown } = { id: 1, service: approved }
      const supply = WIRE.buildG6QuerySupplyFromService(approved, { currentGeneration: () => gen })
      expect(supply.ok).toBe(true)
      if (supply.ok !== true) return
      const asm = w.build({ providerId: supply.providerId, queryPorts: supply.queryPorts, declaredMount: supply.declaredMount, lifecycle: supply.lifecycle, generation: supply.generation })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_trace')!
      expect(String(await def.execute(TRACE_ARGS, { callId: 'exec-j1-steady' }))).toContain('s-a')
      const callsBefore = w.calls.length
      // PUBLIC LIFECYCLE TRANSITION: the child fiber reloaded (provider
      // replaced) — a NEW ACTIVE generation, possibly the SAME face.
      gen = { id: 2, service: { ...approved } }
      const refusal = await asRefusal(def.execute(TRACE_ARGS, { callId: 'exec-j1-replaced' }))
      expect(refusal.code).toBe(SC.PORT_RECEIVER_MOVED)
      expect(refusal.detail).toContain('generation 1 is INVALIDATED')
      expect(refusal.detail).toContain('live generation 2')
      expect(w.calls.length, 'zero forwarding past the generation replacement').toBe(callsBefore)
    })

    it('j2: the observer answers NO ACTIVE generation (fiber non-ACTIVE / identity unobservable right now) — typed PORT_LIFECYCLE_UNOBSERVABLE fail-closed; a restored ACTIVE generation serves again — the check rides every dispatch, never latched', async () => {
      const w = makeWorld({ tag: 'j2' })
      const approved = engineOver(w.qp)
      const holder: { active: boolean } = { active: true }
      const supply = WIRE.buildG6QuerySupplyFromService(approved, { currentGeneration: () => holder.active ? { id: 1, service: approved } : null })
      expect(supply.ok).toBe(true)
      if (supply.ok !== true) return
      const asm = w.build({ providerId: supply.providerId, queryPorts: supply.queryPorts, declaredMount: supply.declaredMount, lifecycle: supply.lifecycle, generation: supply.generation })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_trace')!
      expect(String(await def.execute(TRACE_ARGS, { callId: 'exec-j2-steady' }))).toContain('s-a')
      holder.active = false
      const refusal = await asRefusal(def.execute(TRACE_ARGS, { callId: 'exec-j2-unobservable' }))
      expect(refusal.code).toBe(SC.PORT_LIFECYCLE_UNOBSERVABLE)
      holder.active = true
      expect(String(await def.execute(TRACE_ARGS, { callId: 'exec-j2-restored' }))).toContain('s-a')
    })
  })
})"""
s = s[:j0] + NEW_J + s[j1x:]
n += 1

# remaining mechanical supply calls: engine-only calls get their own observer
s = s.replace("WIRE.buildG6QuerySupplyFromService(engine)", "WIRE.buildG6QuerySupplyFromService(engine, lifecycleOf(engine))")
n += 1

# the plain i5 asm override (i6/j already carry lifecycle in the rewrite)
rep("const asm = w.build({ providerId: supply.providerId, queryPorts: supply.queryPorts, declaredMount: supply.declaredMount })",
    "const asm = w.build({ providerId: supply.providerId, queryPorts: supply.queryPorts, declaredMount: supply.declaredMount, lifecycle: supply.lifecycle, generation: supply.generation })")

open(p, 'w').write(s)
print(f'wiring test migration: {n} operations, residual old-law refs:', s.count('observeCurrent'))
