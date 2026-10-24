import sys
lv = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g6/packages/runtime/src/plugin/live/'
n = 0
def patch(path, ops):
    global n
    s = open(path).read()
    for old, new in ops:
        assert s.count(old) == 1, f'{path}: MISSING/AMBIG: ' + old[:80].replace('\n', '\\n')
        s = s.replace(old, new, 1)
        n += 1
    open(path, 'w').write(s)

W = lv + 'governed-families/g6-session-query-wiring.mjs'
A = lv + 'governed-families/g6-session-query.mjs'
B = lv + 'agent-bindings.mjs'

# ── wiring: splice doc-params + function (index-based) ────────────────────
s = open(W).read()
t_anchor = "export const A5_G6_QUERY_WIRING_CODES = Object.freeze({\n"
assert s.count(t_anchor) == 1
s = s.replace(t_anchor, t_anchor + "  // Root ruling 3 (lane increment 1): typed fail-closed — governed\n  // currentness is unknowable without the public Provider lifecycle observer.\n  PORT_LIFECYCLE_UNOBSERVABLE: 'P_G6_WIRE_PORT_LIFECYCLE_UNOBSERVABLE',\n", 1)
n += 1

start = s.index(' * @param {unknown} service - the live `ctx.get(\'sessionQuery\')` answer')
mid = s.index(' */' + chr(10), start) + 4
fstart = s.index('export function buildG6QuerySupplyFromService', mid)
end = s.index('\n}\n', fstart) + 3

NEW = ''' * @param {unknown} service - the sessionQuery service handle OF THE PINNED
 *  GENERATION (the observer's ACTIVE-generation read taken once at bind
 *  time). It is NOT re-observed per call: public reads answer a fresh proxy
 *  each time (root-verified Cordis fact), so no law here may treat read
 *  identity as a lifecycle signal.
 * @param {{ currentGeneration(): { id: number, service: unknown } | null }=} lifecycle -
 *  the PUBLIC Provider lifecycle observer (root ruling 3, lane increment 1;
 *  host-side optional child fiber over `ctx.inject(['sessionQuery'])`).
 *  REMOVED LAWS (anti-reintroduction pins — do NOT reinstate): (i) the old
 *  `observeCurrent` accessor + `receiverMoved` sentinel compared per-read
 *  `ctx.get` identity against the build-time instance — under fresh-proxy
 *  reads it false-tripped on EVERY placement (the real-host 405-adjacent
 *  SESSION_QUERY_ARM_REFUSED mechanism); (ii) any per-method function-object
 *  continuity expectation (ruling (c): no same-fiber hot-swap promise; a
 *  `ctx.set` same-fiber value swap and same-object method edits do NOT
 *  notify and are NOT detectable here — by design). Currentness rides the
 *  PUBLIC lifecycle ONLY: bind once per generation; the generation must be
 *  ACTIVE at bind time; a lifecycle replacement invalidates earlier
 *  generations (the adapter refuses their rows with typed, log-observable
 *  refusals). An absent observer or a non-ACTIVE/pre-activation fiber
 *  answers NO generation: the supply fail-closes TYPED — unknowable never
 *  becomes allow-by-default (center precision 1).
 * @returns {{ ok: true, providerId: string, queryPorts: Record<string, unknown>, generation: number, lifecycle: object, declaredMount: Record<string, unknown> } | { ok: false, code: string, detail: string }}
 */
export function buildG6QuerySupplyFromService (service, lifecycle) {
  // CURRENTNESS: the lifecycle observer is mandatory supply (see REMOVED
  // LAWS above — the per-read identity stand-in is NOT reinstated).
  if (lifecycle === null || typeof lifecycle !== 'object' || typeof lifecycle.currentGeneration !== 'function') {
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.PORT_LIFECYCLE_UNOBSERVABLE, 'no public Provider lifecycle observer was supplied — governed query currentness is unknowable at this assembly and the family fail-closes (typed census, zero flip; never allow-by-default, never a per-read identity stand-in)')
  }
  if (service === null || typeof service !== 'object') {
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.SUPPLY_ABSENT, 'the DSH public sessionQuery service is not registered in this process — the B-SESSION-QUERY family is not deployed here (honest DECLARED-INACTIVE census, zero flip; never a fake stand-in, never a config substitute)')
  }
  const generation = lifecycle.currentGeneration()
  if (generation === null || generation === undefined || typeof generation.id !== 'number' || generation.service !== service) {
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.PORT_LIFECYCLE_UNOBSERVABLE, `the lifecycle observer answers no ACTIVE generation bound to THIS service (observer=${generation === null || generation === undefined ? 'no-active-generation' : 'generation-' + String(generation.id)}) — provider absent, reloading, or non-ACTIVE; the mount fail-closes typed and the family stays DECLARED-INACTIVE for this mount`)
  }
  const core = ['traceSession', 'traceEvent', 'readEvent', 'filterSessions', 'readTitleSnapshots']
  const missing = core.filter((name) => typeof service[name] !== 'function')
  if (missing.length > 0) {
    return wiringRefuse(A5_G6_QUERY_WIRING_CODES.SUPPLY_INCOMPLETE, `the registered sessionQuery service implements no ${missing.join(', ')} — the family mounts no partial supply (fail-closed; the natives stay untouched)`)
  }
  // BIND ONCE PER GENERATION (the approved shape): every supplied facet
  // method is the bound handle taken ONCE from this generation at bind
  // time. No getters, no per-read re-observation, no sentinel object.
  const bindFacet = (names) => Object.freeze(Object.fromEntries(names.map((name) => [name, service[name].bind(service)])))
  const searchPresent = typeof service.searchSessions === 'function' && typeof service.searchEvents === 'function'
  const queryPorts = Object.freeze({
    ...(searchPresent
      ? { searchQueryPort: bindFacet(['searchSessions', 'searchEvents']) }
      : {}),
    traceQueryPort: bindFacet(['traceSession', 'traceEvent']),
    eventReadQueryPort: bindFacet(['readEvent']),
    authorizationQueryPort: bindFacet(['filterSessions']),
    titlesQueryPort: bindFacet(['readTitleSnapshots']),
  })
  return deepFreeze({
    ok: true,
    // Provider identity = the service's OWN registration name (the Service
    // base stores the super(ctx, 'sessionQuery') name; the registration key
    // is the fallback) — a trusted in-process identity, never a configured
    // string.
    providerId: typeof service.name === 'string' && service.name !== '' ? String(service.name) : 'sessionQuery',
    queryPorts: Object.freeze(queryPorts),
    // The generation marker rides the supply into the adapter: every
    // lifecycle refusal quotes pinned-vs-live generation ids — INVALIDATION
    // through a public replacement is provable from the log (center
    // precision 2).
    generation: generation.id,
    lifecycle,
    // Declared-mount = the OBSERVED evidence of THIS process's registration
    // (the trusted publisher): search facets callable → present; not
    // implemented → honestly absent with the observation as the evidence
    // bytes.
    declaredMount: Object.freeze({
      searchBackend: searchPresent
        ? Object.freeze({ present: true })
        : Object.freeze({ present: false, evidence: 'the registered sessionQuery service implements no searchSessions/searchEvents (observed at mount) — no search row mounts; the search names keep their natives' }),
    }),
  })
}
'''
s = s[:start] + NEW + s[end:]
open(W, 'w').write(s)
n += 1

# ── adapter: codes, deps law, both guard sites ────────────────────────────
patch(A, [
  ("""  PORT_RECEIVER_MOVED: 'P_G6_PORT_RECEIVER_MOVED',
  PORT_METHOD_MOVED: 'P_G6_PORT_METHOD_MOVED',""",
   """  PORT_RECEIVER_MOVED: 'P_G6_PORT_RECEIVER_MOVED',
  // Root ruling 3: the vocabulary entry survives (frozen envelope set); the
  // RUNTIME law behind it is REMOVED (same-fiber method hot-swap is neither
  // promised nor observable — ruling (c)); suites pin it as never-thrown.
  PORT_METHOD_MOVED: 'P_G6_PORT_METHOD_MOVED',
  // Public Provider lifecycle unreadable/non-ACTIVE at a dispatch — typed
  // fail-closed (center precision 1), never allow-by-default.
  PORT_LIFECYCLE_UNOBSERVABLE: 'P_G6_PORT_LIFECYCLE_UNOBSERVABLE',"""),
  ("""  const { realmId, providerId, readNative, queryPorts, readCaller, teamCeiling, declaredMount, definitionIdentityOf, observe = () => {} } = deps""",
   """  const { realmId, providerId, readNative, queryPorts, readCaller, teamCeiling, declaredMount, definitionIdentityOf, observe = () => {}, lifecycle, generation } = deps
  // CURRENTNESS DEPENDENCY (root ruling 3, lane increment 1): the PUBLIC
  // Provider lifecycle observer + the placement-pinned generation id are
  // REQUIRED supply. The removed per-read identity laws (facet-object /
  // function-object continuity) stay removed — anti-reintroduction pins;
  // the suites prove the adapter never reads them again.
  if (lifecycle === null || typeof lifecycle !== 'object' || typeof lifecycle.currentGeneration !== 'function') {
    throw new TypeError('g6-session-query: lifecycle { currentGeneration(): {id, service} | null } is required — the public Provider lifecycle is the ONLY currentness source (an assembly without it cannot establish governed freshness; fail-closed at construction)')
  }
  if (!Number.isInteger(generation) || generation < 1) {
    throw new TypeError('g6-session-query: generation (positive integer — the Provider generation pinned at placement) is required; INVALIDATION refusals carry it as the observable marker (center precision 2)')
  }"""),
  ("""      // PER-DISPATCH RECEIVER + IDENTITY RE-VERIFY (fix 5): the facet OBJECT
      // (the service instance `this` is bound to) and each bound FUNCTION must
      // still BE the placement-time refs. Zero forwarding on any drift.
      for (const [facetName, method] of spec.facetsUsed) {
        const ref = facetRefs[facetName]
        if (ref === undefined || queryPorts[facetName] !== ref.object) {
          return refuse(A5_G6_TYPED_CODES.PORT_RECEIVER_MOVED, `the live ${facetName} is no longer the RECEIVER OBJECT pinned at placement — the service instance moved underneath the row; zero forwarding`)
        }
        if (ref.object[method] !== ref.methods[method]) {
          return refuse(A5_G6_TYPED_CODES.PORT_METHOD_MOVED, `the live ${facetName}.${method} is no longer the function OBJECT pinned at placement — the port generation moved underneath the row; zero forwarding`)
        }
      }""",
   """      // CURRENTNESS LAW (root ruling 3, lane increment 1 — REMOVED LAWS,
      // anti-reintroduction pins): the per-dispatch facet-OBJECT identity and
      // per-METHOD function-object continuity checks are REMOVED. Public
      // reads answer a FRESH proxy per read (root-verified Cordis fact), so
      // comparing them against placement-time refs is not a lifecycle signal
      // — it false-trips every call. Currentness rides the PUBLIC Provider
      // lifecycle ONLY: the generation pinned at placement must still be the
      // ACTIVE generation (methods were bound ONCE at bind time inside that
      // generation). A lifecycle REPLACEMENT invalidates this row's pinned
      // approvals — typed, log-observable, BOTH generation markers present
      // (center precision 2); an unobservable lifecycle fail-closes (center
      // precision 1).
      const lifecycleNow = lifecycle.currentGeneration()
      if (lifecycleNow === null || lifecycleNow === undefined) {
        return refuse(A5_G6_TYPED_CODES.PORT_LIFECYCLE_UNOBSERVABLE, `the sessionQuery Provider lifecycle answers no ACTIVE generation — the placement generation ${generation} cannot be confirmed live; fail-closed, zero forwarding`)
      }
      if (lifecycleNow.id !== generation) {
        return refuse(A5_G6_TYPED_CODES.PORT_RECEIVER_MOVED, `sessionQuery Provider lifecycle REPLACED the placement generation — pinned generation ${generation} is INVALIDATED (live generation ${lifecycleNow.id}); old approvals never ride across generations, zero forwarding`)
      }"""),
  ("""      // REVOCATION LAW (root-1eea delta ③): from entry admission on, EVERY
      // service dispatch — every page, every title read — AND the final serve
      // re-verify the CURRENT caller id/cwd/step-boundary, the pinned
      // receiver objects + method objects, and the Team ceiling decision.""",
   """      // REVOCATION LAW (root-1eea delta ③; currentness leg re-anchored by
      // root ruling 3): from entry admission on, EVERY service dispatch —
      // every page, every title read — AND the final serve re-verify the
      // CURRENT caller id/cwd/step-boundary, the PUBLIC Provider generation
      // (pinned == live ACTIVE, else typed INVALIDATION/unobservable
      // refusal), and the Team ceiling decision."""),
  ("""        for (const [guardFacet, guardMethod] of spec.facetsUsed) {
          const ref = facetRefs[guardFacet]
          if (ref === undefined || queryPorts[guardFacet] !== ref.object) {
            throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.PORT_RECEIVER_MOVED, `${stage}: the live ${guardFacet} is no longer the RECEIVER OBJECT pinned at placement — zero further forwarding`)
          }
          if (ref.object[guardMethod] !== ref.methods[guardMethod]) {
            throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.PORT_METHOD_MOVED, `${stage}: the live ${guardFacet}.${guardMethod} is no longer the function OBJECT pinned at placement — zero further forwarding`)
          }
        }""",
   """        const nowGen = lifecycle.currentGeneration()
        if (nowGen === null || nowGen === undefined) {
          throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.PORT_LIFECYCLE_UNOBSERVABLE, `${stage}: the sessionQuery Provider lifecycle answers no ACTIVE generation — placement generation ${generation} unconfirmable; zero further forwarding`)
        }
        if (nowGen.id !== generation) {
          throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.PORT_RECEIVER_MOVED, `${stage}: sessionQuery Provider generation ${generation} INVALIDATED by lifecycle replacement (live generation ${nowGen.id}); zero further forwarding`)
        }"""),
])

# ── bindings: generation-bound build call + adapter deps ──────────────────
patch(B, [
  ("""sessionQuery: sessionQueryBackend, sessionProjections: sessionProjectionsBackend""",
   """sessionQueryLifecycle, sessionProjections: sessionProjectionsBackend"""),
  ("""          const g6Supply = buildG6QuerySupplyFromService(
            typeof sessionQueryBackend === 'function' ? sessionQueryBackend() : undefined,
            // Root 19:29 — the SAME Host public lazy accessor rides the
            // supply: every adapter guard read re-observes the CURRENT
            // `ctx.get('sessionQuery')` identity, so a whole-service
            // replacement refuses through the row's own PORT_RECEIVER_MOVED
            // law (the approved receiver/method handles keep executing
            // while the identity matches and NEVER switch to the new
            // instance's). The real accessor — no stale constant
            // masquerading as current.
            typeof sessionQueryBackend === 'function' ? sessionQueryBackend : undefined,
          )""",
   """          // Root ruling 3 (lane increment 1): the supply binds to ONE
          // generation of the PUBLIC Provider lifecycle observer (host-side
          // optional child fiber over ctx.inject(['sessionQuery']); the
          // removed per-read identity observer is documented in the wiring
          // module and pinned by suites). An absent face or a
          // non-ACTIVE/pre-activation fiber yields an ok:false TYPED answer
          // (PORT_LIFECYCLE_UNOBSERVABLE) → the honest DECLARED-INACTIVE
          // census below (fail-closed, zero flip — never allow-by-default).
          const g6Lifecycle = typeof sessionQueryLifecycle?.currentGeneration === 'function'
            ? sessionQueryLifecycle
            : undefined
          const g6Supply = buildG6QuerySupplyFromService(
            g6Lifecycle === undefined ? undefined : g6Lifecycle.currentGeneration()?.service,
            g6Lifecycle,
          )"""),
  ("""              queryPorts: g6Supply.queryPorts,""",
   """              queryPorts: g6Supply.queryPorts,
              lifecycle: g6Supply.lifecycle,
              generation: g6Supply.generation,"""),
])

print(f'lifecycle increment: {n} operations')
