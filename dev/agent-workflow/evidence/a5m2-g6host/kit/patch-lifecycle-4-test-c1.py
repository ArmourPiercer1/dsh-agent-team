p = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/packages/runtime/test/a5m2-g6-session-query-c1.test.ts'
s = open(p).read()
n = 0
def rep(old, new, count=1):
    global s, n
    assert s.count(old) == count, f'MISSING/AMBIG({s.count(old)}): ' + old[:80].replace('\n', '\\n')
    s = s.replace(old, new, count)
    n += 1

# doc + code vocabulary
rep(""" *      object identity per dispatch (PORT_RECEIVER_MOVED / PORT_METHOD_MOVED,""",
    """ *      PUBLIC Provider generation identity per dispatch (root ruling 3, lane
 *      increment 1: replacement INVALIDATES via PORT_RECEIVER_MOVED quoting
 *      both markers; non-ACTIVE answers typed PORT_LIFECYCLE_UNOBSERVABLE;
 *      the removed per-read facet/method identity laws stay removed,""")
rep("""'CALLER_DRIFT' | 'PORT_RECEIVER_MOVED' | 'PORT_METHOD_MOVED' |""",
    """'CALLER_DRIFT' | 'PORT_RECEIVER_MOVED' | 'PORT_METHOD_MOVED' | 'PORT_LIFECYCLE_UNOBSERVABLE' |""")

# World interface: lifecycle handles
rep("""interface World {
  svc: Record<string, unknown>""",
    """interface World {
  svc: Record<string, unknown>
  advanceGeneration(): void
  setObserverActive(on: boolean): void""")

# helper: mutable public generation feeding the observer
rep("""  const adapter = S.createG6SessionQueryAdapter({
    realmId: 'realm-g6',""",
    """  // Root ruling 3 (lane increment 1): the ONLY currentness source — a
  // PUBLIC lifecycle observer with a mutable ACTIVE generation.
  let observerActive = true
  let observerId = 1
  const lifecycle = {
    currentGeneration: () => (observerActive ? { id: observerId, service: svc as unknown } : null),
  }
  const adapter = S.createG6SessionQueryAdapter({
    realmId: 'realm-g6',""")
rep("""    declaredMount: { searchBackend: backend },
    ...(opts.maxSearchResults === undefined ? {} : { maxSearchResults: opts.maxSearchResults }),""",
    """    declaredMount: { searchBackend: backend },
    lifecycle,
    generation: 1,
    ...(opts.maxSearchResults === undefined ? {} : { maxSearchResults: opts.maxSearchResults }),""")
rep("""  const world: World = {
    svc,
    qp,""",
    """  const world: World = {
    svc,
    qp,
    advanceGeneration: () => { observerId += 1 },
    setObserverActive: (on: boolean) => { observerActive = on },""")

# negative constructions: lifecycle must be present to reach the evidence law
rep("""    expect(() => S.createG6SessionQueryAdapter({
      realmId: 'r',
      providerId: 'p',
      readNative: () => undefined,
      queryPorts: {},
      readCaller: () => undefined,
      teamCeiling: () => true,
    })).toThrow(/REAL deployment evidence/u)""",
    """    expect(() => S.createG6SessionQueryAdapter({
      realmId: 'r',
      providerId: 'p',
      readNative: () => undefined,
      queryPorts: {},
      readCaller: () => undefined,
      teamCeiling: () => true,
      lifecycle: { currentGeneration: () => ({ id: 1, service: {} }) },
      generation: 1,
    })).toThrow(/REAL deployment evidence/u)
    // Root ruling 3: WITHOUT the public lifecycle observer (or its pinned
    // generation) the factory refuses to construct at all — currentness
    // unknowable fails closed at the assembly boundary, and an ACTIVE
    // observer bound to a DIFFERENT service handle refuses the mount too.
    expect(() => S.createG6SessionQueryAdapter({
      realmId: 'r', providerId: 'p', readNative: () => undefined, queryPorts: {},
      readCaller: () => undefined, teamCeiling: () => true,
      declaredMount: { searchBackend: { present: false, evidence: 'e' } },
    })).toThrow(/lifecycle/u)
    expect(() => S.createG6SessionQueryAdapter({
      realmId: 'r', providerId: 'p', readNative: () => undefined, queryPorts: {},
      readCaller: () => undefined, teamCeiling: () => true,
      declaredMount: { searchBackend: { present: false, evidence: 'e' } },
      lifecycle: { currentGeneration: () => null }, generation: 1,
    })).toThrow(/generation/u)""")
rep("""    const base = {
      realmId: 'r',
      providerId: 'p',
      readNative: (name: string) => w.captured.get(name),
      readCaller: () => ({ id: CALLER_ID, cwd: CWD }),
      teamCeiling: () => true,
    }""",
    """    const base = {
      realmId: 'r',
      providerId: 'p',
      readNative: (name: string) => w.captured.get(name),
      readCaller: () => ({ id: CALLER_ID, cwd: CWD }),
      teamCeiling: () => true,
      lifecycle: { currentGeneration: () => ({ id: 1, service: w.svc as unknown }) },
      generation: 1,
    }""")

# the two removed-law tests → new-law pair (+ unobservable leg)
rep("""  it('the RECEIVER OBJECT moving (same functions, swapped instance) refuses PORT_RECEIVER_MOVED with zero forwarding', async () => {
    const w = await makeWorld()
    const mark = w.calls.length
    w.qp['authorizationQueryPort'] = { ...w.svc }
    const out = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(out.refusal?.['code']).toBe(SC.PORT_RECEIVER_MOVED)
    expect(w.callsSince(mark).length).toBe(0)
  })

  it('a rebound METHOD FUNCTION on the pinned receiver refuses PORT_METHOD_MOVED with zero forwarding', async () => {
    const w = await makeWorld()
    const mark = w.calls.length;
    (w.svc as Record<string, unknown>)['readEvent'] = async function (request: unknown, signal?: unknown) { return { request, signal } }
    const out = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(out.refusal?.['code']).toBe(SC.PORT_METHOD_MOVED)
    expect(w.callsSince(mark).length).toBe(0)
  })""",
    """  it('REMOVED-LAW PIN (root ruling 3, ruling (c)): a same-instance facet/method rebind inside the SAME generation is NOT observed and never promised — the bound generation-1 handles keep serving; PORT_METHOD_MOVED no longer exists as a runtime law', async () => {
    const w = await makeWorld()
    const native = await w.nativeCall('session_event_read', { session_id: 's-a', seq: 5 })
    // Same-object method edit + swapped facet identity: neither is a public
    // lifecycle transition; nothing may be detected here (by design).
    w.qp['authorizationQueryPort'] = { ...w.svc }
    ;(w.svc as Record<string, unknown>)['readEvent'] = async function rebound () { throw new Error('MUST-NOT-RUN') }
    const out = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(String(out.value)).toContain('"seq": 5')
    expect(String(out.value)).toBe(String(native.value))
  })

  it('a PUBLIC generation replacement INVALIDATES the row: PORT_RECEIVER_MOVED quoting pinned-vs-live markers, zero forwarding — old approvals never ride across generations (precision 2)', async () => {
    const w = await makeWorld()
    const served = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(String(served.value)).toContain('"seq": 5')
    const mark = w.calls.length
    w.advanceGeneration()
    const out = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(out.refusal?.['code']).toBe(SC.PORT_RECEIVER_MOVED)
    expect(String(out.refusal?.['detail'])).toContain('generation 1 is INVALIDATED')
    expect(String(out.refusal?.['detail'])).toContain('live generation 2')
    expect(w.callsSince(mark).length).toBe(0)
  })

  it('observer non-ACTIVE (no generation answerable) fail-closes typed PORT_LIFECYCLE_UNOBSERVABLE with zero forwarding; a restored ACTIVE generation serves again (precision 1; never latched)', async () => {
    const w = await makeWorld()
    w.setObserverActive(false)
    const mark = w.calls.length
    const out = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(out.refusal?.['code']).toBe(SC.PORT_LIFECYCLE_UNOBSERVABLE)
    expect(w.callsSince(mark).length).toBe(0)
    w.setObserverActive(true)
    const served = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(String(served.value)).toContain('"seq": 5')
  })""")

open(p, 'w').write(s)
print(f'c1 migration: {n} operations')
