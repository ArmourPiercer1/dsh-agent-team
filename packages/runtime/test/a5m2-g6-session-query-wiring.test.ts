/**
 * A5M2-G6-WIRING (root ruling 17:45: RUNNABLE THIN BRIDGE) — the spec of
 * `g6-session-query-wiring.mjs`: the G6 session-query adapter (rev.4,
 * released, imported VERBATIM — this spec re-proves NONE of its row laws;
 * `a5m2-g6-session-query-c1.test.ts` 52/52 owns those) composed into the
 * production mount + PA consumption faces:
 *
 *  (a) ASSEMBLY facts over the REAL adapter factory: five rows, the ACTIVE
 *      definitions carry the CAPTURED native faces verbatim and by reference
 *      (root 8b4: ONLY execute is replaced; the native body never runs
 *      through the bridge), and every non-emitted row stays an honest
 *      DECLARED-INACTIVE census with NO definition and NO registration
 *      (declared-mount absent / capture absent / registration face
 *      incomplete — refusal bytes verbatim from a reference adapter mounted
 *      DIRECTLY, deep-equal);
 *  (b) family entries key on the RUNTIME placement identity — the feed is
 *      backed by the REAL `definitionIdentityOf` mint (pb §6; per-object
 *      algebra), the key NEVER equals the capture-side identity, entries
 *      flow through the PRODUCTION registry (`registerA5GovernedFamily` /
 *      `a5GovernedFamilyFor` round-trip), and a silent feed or a moved feed
 *      THROWS (never a guessed key, never a silent skip — the
 *      agent-bindings law);
 *  (c) the PA consumption walk is the published split-path shape
 *      (paAdmit.open -> paAdmit.edge -> body -> paAdmit.closePlan):
 *      the walk carries the four P-adds at FULL VALUE from the row's OWN
 *      reviewPayload, the family block EXCLUDES the capture-side
 *      definitionIdentity, the body demands the edge's one-shot
 *      `consumedProof` witness before any port entry, and EVERY path closes
 *      the plan fact exactly once; deny / cancelled / approval-not-landed /
 *      edge-deny / edge-cancelled / missing-witness all refuse with the
 *      refusing side's OWN bytes and ZERO port entries;
 *  (d) the injected-ceiling law: the factory REFUSES to assemble without
 *      the Team decision port (fail closed), a runtime target denial rides
 *      the adapter's own P_G6_TEAM_CEILING_DENY with zero port entry and
 *      zero PA open, and the rev-4 FINAL-SERVE WHOLE-SET membership recheck
 *      survives the bridge UNCHANGED (a member revoked across the title
 *      read refuses the whole result through the bridge);
 *  (e) the rev-4 row laws ride through untouched: effects stay
 *      `tool-invoke` with no invented resource dimension, the
 *      SESSION_HISTORY_RESOURCE_KIND named blocker travels verbatim, drain
 *      reaches every row;
 *  (f) NAMED GAPS pinned at their MEASURED bytes through the REAL published
 *      checkers (control/types.ts) — never worded closed:
 *      PA_CONSUMPTION_BRIDGE_COMPLETION: the production bridge validates a
 *      registered family's targetManifest losslessness (isLosslessJsonValue)
 *      and typed-plan structure (validatePaFamilyTarget); as measured the
 *      rev-4 manifest of the three always-mount rows is NOT lossless
 *      (`maxSearchResults` is an always-present member that is undefined
 *      off the search family), and `PA_FAMILY_TARGET_RULES` carries no
 *      'B-SESSION-QUERY' structure — the exact wire-pinned refusals;
 *      BACKEND DEPLOYMENT: with no searchBackend evidence the two search
 *      rows emit nothing and the native stays untouched.
 *
 * DISCLOSED STAND-INS (the adapter spec owns the REAL halves; this spec is
 * NOT C2 — no Host, no ports, no tests/homes, no network): the native faces
 * are recorded test doubles in the host defineTool shape (name/description/
 * parameters/output{schema,render}/execute); the typed query ports are
 * recording doubles in the pinned two-formal-parameter shape the placement
 * arity law demands; the `pa` seat is a recording double that OBEYS the real
 * paAdmit open/edge/closePlan contract shape (team-tool-plane.mjs:1679/
 * :1713/:1714) — the PLANE'S seat is the integrator line, stood in here the
 * way the G1 wiring spec stands in its admit. The REAL pieces used here are
 * the adapter factory and rows, the production family registry, the pb §6
 * identity mint, and the published rules-gate checkers.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g6-session-query-wiring
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { definitionIdentityOf } from '../tool-dispatch/index.js'
import { isLosslessJsonValue, validatePaFamilyTarget } from '../control/types.js'

/** The adapter row face AS CONSUMED here (opaque machinery stays with the
 *  adapter spec; only the members this spec touches are typed). */
interface Row {
  active: boolean
  namedBlockers: string[]
  classify: (args: Record<string, unknown>) => {
    ok: boolean
    code?: string
    detail?: string
    effects?: unknown
    reviewPayload?: Record<string, unknown>
  }
  drain: () => void
  draining: () => boolean
}
interface Definition {
  name: string
  description: unknown
  parameters: unknown
  output: unknown
  execute: (args: Record<string, unknown>, exec: Record<string, unknown>) => Promise<unknown>
}
interface Registration {
  name: string
  definitionIdentity: string
  entry: { familyId: string; adapterRevision: number; providerIdentity: string }
}
interface Assembly {
  ok: boolean
  code?: string
  detail?: string
  familyId?: string
  adapterRevision?: number
  placementNames: string[]
  definitions: Definition[]
  rows: Record<string, { status: string; reason?: string; row: Row; captureDefinitionIdentity?: string | null }>
  declared: Array<{ name: string; status: string; reason: string }>
  rowOf: (name: string) => Row
  drain: () => Record<string, unknown>
  familyRegistrations: () => Registration[]
}

const WIRE = (await import(new URL('../src/plugin/live/governed-families/g6-session-query-wiring.mjs', import.meta.url).href)) as {
  A5_G6_QUERY_WIRING_REVISION: number
  A5_G6_QUERY_WIRING_CODES: Record<string, string>
  buildG6SessionQueryWiring: (input?: Record<string, unknown>) => Assembly
  buildG6QuerySupplyFromService: (service?: unknown) =>
    | { ok: true, providerId: string, queryPorts: Record<string, unknown>, declaredMount: Record<string, unknown> }
    | { ok: false, code: string, detail: string }
}
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/g6-session-query.mjs', import.meta.url).href)) as {
  A5_G6_FAMILY: string
  A5_G6_ADAPTER_REVISION: number
  A5_G6_TOOL_NAMES: string[]
  A5_G6_TYPED_CODES: Record<string, string>
  A5_G6_NAMED_BLOCKERS: Record<string, string>
  createG6SessionQueryAdapter: (deps: Record<string, unknown>) => { rows: Record<string, Row> }
}
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as {
  registerA5GovernedFamily: (key: string, entry: { familyId: string; adapterRevision: number; providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string; adapterRevision: number; providerIdentity: string } | undefined
}

const CODES = WIRE.A5_G6_QUERY_WIRING_CODES
const SC = ADAPTER.A5_G6_TYPED_CODES
const TOOLS = ADAPTER.A5_G6_TOOL_NAMES

const REALM = 'realm-g6-wire'
const PROVIDER = 'provider-g6-wire'
const CALLER_ID = 'sess-caller-w1'
const CWD = '/work/repo'

type Seed = { id: string, cwd: string, createdAt: number, parentSession?: string, title?: string, events?: Array<{ seq: number, type: string, time: number, surface: string, snippetText: string }> }

const SEEDS: Seed[] = [
  { id: CALLER_ID, cwd: CWD, createdAt: 5000, title: 'caller session', events: [] },
  { id: 's-a', cwd: CWD, parentSession: 'p-root', createdAt: 4000, title: 'Alpha work', events: [{ seq: 5, type: 'user/message', time: 3900, surface: 'current', snippetText: 'alpha needle' }] },
  { id: 'p-root', cwd: CWD, createdAt: 1000, title: 'Root', events: [] },
]

const record = (seed: Seed) => ({ header: { id: seed.id, cwd: seed.cwd, createdAt: seed.createdAt } })

/** The five captured-native shapes (authored parameter schemas; the host
 *  defineTool face). Each world builds FRESH objects so the pb §6 mint keys
 *  per world never collide in the process-global registry/identity maps. */
const PARAMS: Record<string, Record<string, unknown>> = {
  session_search: { type: 'object', properties: { query: { type: 'string', minLength: 1 } }, required: ['query'], additionalProperties: false },
  session_event_search: { type: 'object', properties: { session_id: { type: 'string' }, query: { type: 'string', minLength: 1 } }, required: ['query'], additionalProperties: false },
  session_trace: { type: 'object', properties: { session_id: { type: 'string' } }, required: [], additionalProperties: false },
  session_event_trace: { type: 'object', properties: { session_id: { type: 'string' }, seq: { type: 'integer', minimum: 0 } }, required: ['seq'], additionalProperties: false },
  session_event_read: { type: 'object', properties: { session_id: { type: 'string' }, seq: { type: 'integer', minimum: 0 }, before: { type: 'integer' }, after: { type: 'integer' } }, required: ['seq'], additionalProperties: false },
}

interface WorldOpts {
  tag: string
  searchBackend?: { present: true } | { present: false, evidence: string }
  ceiling?: Set<string>
  cwd?: string | undefined
  hideNative?: string[]
  halfCapture?: string[]
  ceilingDeniesDuring?: { port: string, id: string }
  paMode?: 'allow' | 'deny' | 'cancelled' | 'approval-missing' | 'no-proof' | 'edge-deny' | 'edge-cancelled'
}

function makeWorld (opts: WorldOpts) {
  const { tag } = opts
  const seeds = JSON.parse(JSON.stringify(SEEDS)) as Seed[]
  const sessions = new Map(seeds.map((s) => [s.id, s]))
  const calls: Array<{ method: string }> = []
  const nativeBodies: string[] = []
  const ceiling = opts.ceiling ?? new Set(['s-a', 'p-root', CALLER_ID])
  const cwd = 'cwd' in opts ? opts.cwd : CWD
  let titlesTick = 0

  const twoArg = (name: string, fn: (a?: unknown, b?: unknown) => unknown) => {
    // TWO named formals: the placement arity law counts them (a 1-arg
    // stand-in is signature drift).
    return async function portFn (a: unknown, b: unknown): Promise<unknown> {
      calls.push({ method: name })
      if (opts.ceilingDeniesDuring !== undefined && opts.ceilingDeniesDuring.port === name) {
        // membership leg: a revocation lands AFTER this port resolved, while
        // the row is between awaits (the title read is the last port before
        // the final serve on every read lane).
        titlesTick += 1
        if (titlesTick === 1) ceiling.delete(opts.ceilingDeniesDuring.id)
      }
      return await fn(a, b)
    }
  }

  const qp: Record<string, unknown> = {
    searchQueryPort: Object.freeze({
      searchSessions: twoArg('searchSessions', (request) => {
        const q = String((request as Record<string, unknown>).query ?? '')
        const items = [...sessions.values()].flatMap((seed) => {
          const hit = (seed.events ?? []).find((ev) => ev.snippetText.includes(q))
          return hit === undefined ? [] : [{ ...record(seed).header, bestMatch: { seq: hit.seq, type: hit.type, time: hit.time, surface: hit.surface, snippet: hit.snippetText } }]
        })
        return { items }
      }),
      searchEvents: twoArg('searchEvents', (request) => {
        const req = request as Record<string, unknown>
        const seed = sessions.get(String(req.sessionId))
        if (seed === undefined) throw Object.assign(new Error('session was not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
        return { session: record(seed).header, items: (seed.events ?? []).filter((ev) => ev.snippetText.includes(String(req.query ?? ''))).map((ev) => ({ sessionId: seed.id, seq: ev.seq, type: ev.type, time: ev.time, surface: ev.surface, snippet: ev.snippetText })) }
      }),
    }),
    traceQueryPort: Object.freeze({
      traceSession: twoArg('traceSession', (sessionId) => {
        const seed = sessions.get(String(sessionId))
        if (seed === undefined) throw Object.assign(new Error('session was not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
        const ancestors: unknown[] = []
        let walk = seed.parentSession === undefined ? undefined : sessions.get(seed.parentSession)
        while (walk !== undefined) { ancestors.push(record(walk)); walk = walk.parentSession === undefined ? undefined : sessions.get(walk.parentSession) }
        return { target: record(seed), ancestors, descendants: [], complete: true }
      }),
      traceEvent: twoArg('traceEvent', (request) => {
        const req = request as Record<string, unknown>
        const seed = sessions.get(String(req.sessionId))
        if (seed === undefined) throw Object.assign(new Error('session was not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' })
        // the adapter's event-trace lane authorizes the RESPONSE's .session
        // header (g6-session-query.mjs:1664) and renders trace.target as the
        // EVENT record (:826-834) — the port face carries both.
        const target = (seed.events ?? []).find((ev) => ev.seq === req.seq) ?? { seq: Number(req.seq), type: 'message', surface: 'chat', time: 1731000000000 }
        return { session: record(seed).header, target, ancestors: [], descendants: [], complete: true, replacementChain: [], replacedEventSeqs: [], sourceEventSeqs: [], derivedEventSeqs: [] }
      }),
    }),
    eventReadQueryPort: Object.freeze({
      readEvent: twoArg('readEvent', (request) => {
        const req = request as Record<string, unknown>
        const seed = sessions.get(String(req.sessionId))
        const target = seed?.events?.find((ev) => ev.seq === req.seq)
        if (seed === undefined || target === undefined) throw Object.assign(new Error('session event was not found'), { code: 'SESSION_QUERY_EVENT_NOT_FOUND' })
        return { session: record(seed).header, target, events: [target], startSeq: target.seq, endSeq: target.seq }
      }),
    }),
    authorizationQueryPort: Object.freeze({
      filterSessions: twoArg('filterSessions', (filters) => {
        const fs = (filters ?? []) as Array<{ kind: string, values?: unknown[] }>
        const ids = fs.find((f) => f.kind === 'id')?.values as string[] | undefined
        const cwds = fs.find((f) => f.kind === 'cwd')?.values as string[] | undefined
        return [...sessions.values()]
          .filter((seed) => (ids === undefined || ids.includes(seed.id)) && (cwds === undefined || cwds.includes(seed.cwd)))
          .map(record)
      }),
    }),
    titlesQueryPort: Object.freeze({
      readTitleSnapshots: twoArg('readTitleSnapshots', (ids) => {
        return ((ids ?? []) as string[]).map((id) => {
          const seed = sessions.get(id)
          if (seed === undefined) return { sessionId: id, status: 'rejected', reason: Object.assign(new Error('session was not found'), { code: 'SESSION_QUERY_SESSION_NOT_FOUND' }) }
          return { sessionId: id, status: 'fulfilled', value: { session: record(seed).header, ...(seed.title === undefined ? {} : { title: { title: seed.title } }) } }
        })
      }),
    }),
  }

  const natives = new Map<string, Record<string, unknown>>()
  for (const name of TOOLS) {
    natives.set(name, {
      name,
      description: `[${tag}] native ${name} description bytes`,
      parameters: JSON.parse(JSON.stringify(PARAMS[name])),
      execute: async () => { nativeBodies.push(name); return 'NATIVE-BODY-NEVER-RUNS' },
      output: { schema: { type: 'string' }, render: (value: unknown) => String(value) },
    })
  }
  for (const name of opts.halfCapture ?? []) {
    const native = natives.get(name)
    if (native !== undefined) delete (native as Record<string, unknown>).output
  }
  const hidden = new Set(opts.hideNative ?? [])

  const readNative = (name: string) => (hidden.has(name) ? undefined : natives.get(name))
  let callerNow = CALLER_ID
  let boundaryNow: Record<string, unknown> | undefined
  const readCaller = () => ({ id: callerNow, ...(cwd === undefined ? {} : { cwd }), ...(boundaryNow === undefined ? {} : { boundary: boundaryNow }) })
  const teamCeiling = (target: string) => ceiling.has(target)
  const declaredMount = { searchBackend: opts.searchBackend ?? { present: true as const } }

  const paCalls: Array<{ leg: string, input: Record<string, unknown> | undefined, callId: string | undefined }> = []
  const mode = opts.paMode ?? 'allow'
  const pa = {
    async open (walk: Record<string, unknown>) {
      paCalls.push({ leg: 'open', input: walk, callId: String(walk.callId) })
      if (mode === 'deny') return { kind: 'deny', code: 'P_PA_TEST_DENY', detail: 'the test admission denied this walk' }
      if (mode === 'cancelled') return { cancelled: true }
      if (mode === 'approval-missing') return { kind: 'pending' }
      return { kind: 'approved', grant: { grantId: `grant-${tag}` }, placementName: String(walk.toolName) }
    },
    async edge (state: Record<string, unknown>) {
      paCalls.push({ leg: 'edge', input: state, callId: String(state.callId) })
      if (mode === 'deny') return { kind: 'deny', code: 'P_PA_TEST_DENY', detail: 'unreachable in deny mode' }
      if (mode === 'edge-deny') return { kind: 'deny', code: 'P_PA_TEST_EDGE_DENY', detail: 'the test execution edge refused this call' }
      if (mode === 'edge-cancelled') return { cancelled: true }
      if (mode === 'no-proof') return { kind: 'allow' }
      return { kind: 'allow', consumedProof: { grant: { grantId: `grant-${tag}` } } }
    },
    closePlan (callId: string) { paCalls.push({ leg: 'closePlan', input: undefined, callId }) },
  }

  const baseInput: Record<string, unknown> = {
    realmId: REALM,
    providerId: PROVIDER,
    readNative,
    queryPorts: qp,
    readCaller,
    teamCeiling,
    declaredMount,
    definitionIdentityOf,
    placementFeed: () => undefined,
    pa,
  }
  const closePlanCalls = () => paCalls.filter((c) => c.leg === 'closePlan').length

  return {
    natives, qp, calls, nativeBodies, ceiling, paCalls, closePlanCalls, readNative, baseInput,
    /** The caller face is swappable so the drift legs can move the caller
     *  A→B inside the PA-await window (root 18:2x TOCTOU legs). */
    setCaller: (id: string) => { callerNow = id },
    setCallerBoundary: (boundary: Record<string, unknown> | undefined) => { boundaryNow = boundary },
    portCalls: () => calls.length,
    build (over: Record<string, unknown> = {}) {
      // the adapter's own contradiction law: evidence of NO backend with a
      // supplied search facet is a refused config defect — an assembly
      // without the deployment evidence ships WITHOUT the facet.
      const ports = declaredMount.searchBackend.present
        ? qp
        : Object.fromEntries(Object.entries(qp).filter(([facet]) => facet !== 'searchQueryPort'))
      return WIRE.buildG6SessionQueryWiring({ ...baseInput, queryPorts: ports, ...over })
    },
  }
}

const TRACE_ARGS = { session_id: 's-a' }
const EXEC = { callId: 'exec-token-1' }

const asRefusal = async (promise: Promise<unknown>): Promise<{ code: string; message: string }> => {
  try {
    await promise
    throw new Error('expected a refusal, got a resolve')
  } catch (error) {
    const e = error as { code?: string; message?: string }
    return { code: String(e.code ?? ''), message: String(e.message ?? '') }
  }
}

describe('A5M2-G6-WIRING — thin bridge over the REAL adapter factory + registry + PA split-path seat', () => {
  describe('(a) assembly: adapter reused verbatim, captured definitions travel complete, non-emitted rows stay honest census', () => {
    it('assembles five ACTIVE rows; every definition is the captured native with ONLY execute replaced (root 8b4, by reference)', () => {
      const w = makeWorld({ tag: 'a1' })
      const asm = w.build()
      expect(asm.ok).toBe(true)
      expect(asm.familyId).toBe('B-SESSION-QUERY')
      expect(asm.adapterRevision).toBe(ADAPTER.A5_G6_ADAPTER_REVISION)
      expect(asm.placementNames).toEqual(TOOLS)
      expect(asm.definitions).toHaveLength(5)
      for (const definition of asm.definitions) {
        const native = w.natives.get(definition.name as string)!
        expect(definition.description).toBe(native.description)
        expect(definition.parameters).toBe(native.parameters) // VERBATIM, by reference
        expect(definition.output).toBe(native.output) // complete presentation face
        expect(definition.execute).not.toBe(native.execute)
        expect(w.natives.get(definition.name as string)!.execute).toBe(native.execute) // native untouched
      }
    })

    it('no searchBackend evidence: the two search rows are DECLARED-INACTIVE census — no definition, no registration, native untouched (BACKEND DEPLOYMENT named gap)', () => {
      const w = makeWorld({ tag: 'a2', searchBackend: { present: false, evidence: 'no session-query backend deployed on this assembly' } })
      const asm = w.build({ placementFeed: (name: string) => ({ definitionIdentity: `def-census-${name}`, realmId: REALM }) })
      expect(asm.ok).toBe(true)
      expect(asm.placementNames).toEqual(['session_trace', 'session_event_trace', 'session_event_read'])
      const search = asm.rows.session_search!
      expect(search.status).toBe('DECLARED-INACTIVE')
      expect(search.reason).toBe('declared-mount-absent')
      expect(search.row.active).toBe(false)
      expect(search.row.classify({ query: 'x' }).code).toBe(SC.DECLARED_MOUNT_ABSENT)
      const regs = asm.familyRegistrations()
      expect(regs.map((r) => r.name)).toEqual(['session_trace', 'session_event_trace', 'session_event_read'])
      // the census rows never reach registration — with no feed even the
      // three ACTIVE rows throw rather than register on a guessed key
      expect(() => w.build().familyRegistrations()).toThrow(CODES.PLACEMENT_KEY_ABSENT)
    })

    it('capture absent: no definition, no registration, and the census row answers the ADAPTER’S OWN refusal bytes (reference adapter, deep-equal)', () => {
      const w = makeWorld({ tag: 'a3', hideNative: ['session_event_read'] })
      const asm = w.build()
      expect(asm.rows.session_event_read!.status).toBe('DECLARED-INACTIVE')
      expect(asm.rows.session_event_read!.reason).toBe('capture-absent')
      expect(asm.placementNames).not.toContain('session_event_read')
      const reference = ADAPTER.createG6SessionQueryAdapter({
        realmId: REALM, providerId: PROVIDER, readNative: w.readNative,
        queryPorts: w.qp, readCaller: () => ({ id: CALLER_ID, cwd: CWD }),
        teamCeiling: (t: string) => w.ceiling.has(t),
        declaredMount: { searchBackend: { present: true } },
      })
      expect(asm.rows.session_event_read!.row.classify({ seq: 5 })).toEqual(reference.rows.session_event_read!.classify({ seq: 5 }))
    })

    it('half-capture (no output face) is never emitted as a definition — honest registration-face-incomplete census, never a fabricated shape', () => {
      const w = makeWorld({ tag: 'a4', halfCapture: ['session_trace'] })
      const asm = w.build()
      expect(asm.rows.session_trace!.status).toBe('DECLARED-INACTIVE')
      expect(asm.rows.session_trace!.reason).toBe('registration-face-incomplete')
      expect(asm.placementNames).not.toContain('session_trace')
    })

    it('the factory fails CLOSED on its seams: no ceiling, no placementFeed, no pa seat, unknown keys — INPUT_INVALID, never a permissive stand-in', () => {
      const w = makeWorld({ tag: 'a5' })
      const noCeiling = WIRE.buildG6SessionQueryWiring({ ...w.baseInput, teamCeiling: undefined })
      expect(noCeiling.ok).toBe(false)
      expect(noCeiling.code).toBe(CODES.INPUT_INVALID)
      expect(noCeiling.detail!).toContain('INJECTED')
      const noFeed = WIRE.buildG6SessionQueryWiring({ ...w.baseInput, placementFeed: undefined })
      expect(noFeed.ok).toBe(false)
      expect(noFeed.detail!).toContain('placementFeed')
      const noPa = WIRE.buildG6SessionQueryWiring({ ...w.baseInput, pa: undefined })
      expect(noPa.ok).toBe(false)
      // root 18:2x defect ③: the seat is accepted in its PRODUCTION shape —
      // the pinned bytes name the callable paAdmit face, not a plain-object
      // test that rejected it.
      expect(noPa.detail!).toContain('CALLABLE with open / edge / closePlan')
      const stray = WIRE.buildG6SessionQueryWiring({ ...w.baseInput, nativeFallback: true })
      expect(stray.ok).toBe(false)
      expect(stray.detail!).toContain('nativeFallback')
    })
  })

  describe('(b) registration: RUNTIME placement identity through the PRODUCTION registry; silent/moved feeds throw', () => {
    it('entries equal definitionIdentityOf(the EMITTED definitions), round-trip the registry law, and are never the capture-side identity', () => {
      const w = makeWorld({ tag: 'b1' })
      // the provider records the placement of THIS assembly's definitions:
      // the feed closes over the assembly and answers the mint of the PLACED
      // definition object (pb §6 — the identity the seam minted, read fresh).
      let placed: Definition[] = []
      const asm = w.build({
        placementFeed: (name: string) => {
          const def = placed.find((d) => d.name === name)
          return def === undefined ? undefined : { definitionIdentity: String(definitionIdentityOf(def)), realmId: REALM }
        },
      })
      expect(asm.ok).toBe(true)
      placed = asm.definitions
      const registrations = asm.familyRegistrations()
      expect(registrations).toHaveLength(5)
      for (const registration of registrations) {
        const definition = asm.definitions.find((d) => d.name === registration.name)!
        expect(registration.definitionIdentity).toBe(String(definitionIdentityOf(definition)))
        // placed identity and capture-side identity stay VISIBLY SEPARATE
        const rowEntry = asm.rows[registration.name]!
        expect(registration.definitionIdentity).not.toBe(rowEntry.captureDefinitionIdentity)
        expect(registration.entry).toEqual({ familyId: 'B-SESSION-QUERY', adapterRevision: ADAPTER.A5_G6_ADAPTER_REVISION, providerIdentity: PROVIDER })
        REGISTRY.registerA5GovernedFamily(registration.definitionIdentity, registration.entry)
        expect(REGISTRY.a5GovernedFamilyFor(registration.definitionIdentity)).toEqual(registration.entry)
      }
    })

    it('a silent feed (no identity) THROWS PLACEMENT_KEY_ABSENT — never a guessed key, never a silent skip', () => {
      const w = makeWorld({ tag: 'b2' })
      const asm = w.build() // placementFeed answers undefined
      expect(() => asm.familyRegistrations()).toThrow(CODES.PLACEMENT_KEY_ABSENT)
    })

    it('a moved feed (identity floats between mount reads) THROWS PLACEMENT_KEY_MOVED and re-registers nothing', () => {
      const w = makeWorld({ tag: 'b3' })
      // one feed, honest on the first read per name, floating on the second
      let first = true
      const movingFeed = () => {
        const answer = { definitionIdentity: first ? 'def#moved-A' : 'def#moved-B', realmId: REALM }
        first = false
        return answer
      }
      const moved = w.build({ placementFeed: movingFeed })
      moved.familyRegistrations() // first mount read per name
      expect(() => moved.familyRegistrations()).toThrow(CODES.PLACEMENT_KEY_MOVED)
    })
  })

  describe('(c) PA consumption legs through the published split-path seat (open -> edge -> body -> closePlan)', () => {
    it('happy read: walk carries the four P-adds at FULL VALUE, edge witness lands, row body serves, plan fact closes exactly once, native body never runs', async () => {
      const w = makeWorld({ tag: 'c1' })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const value = await definition.execute(TRACE_ARGS, EXEC)
      expect(typeof value).toBe('string')
      expect(String(value).length).toBeGreaterThan(0)
      const open = w.paCalls.find((c) => c.leg === 'open')!.input!
      expect(open.realmId).toBe(REALM)
      expect(open.callId).toBe('exec-token-1')
      expect(open.toolName).toBe('session_trace')
      expect(open.parametersFingerprint).toMatch(/^sha256:/u)
      expect(open.requestedEffects).toMatchObject({ effects: [{ kind: 'tool-invoke', toolName: 'session_trace', resource: null }] })
      expect(typeof (open.requestedEffects as Record<string, unknown>).fingerprint).toBe('string')
      const family = open.family as Record<string, unknown>
      expect(family.familyId).toBe('B-SESSION-QUERY')
      expect(family.adapterRevision).toBe(ADAPTER.A5_G6_ADAPTER_REVISION)
      expect(family.providerIdentity).toBe(PROVIDER)
      // capture-side definitionIdentity NEVER rides the walk's family block
      expect('definitionIdentity' in family).toBe(false)
      const manifest = family.targetManifest as Record<string, unknown>
      expect(manifest.toolName).toBe('session_trace')
      expect(manifest.effectiveTargetSessionId).toBe('s-a')
      const edge = w.paCalls.find((c) => c.leg === 'edge')!.input!
      expect(edge.grant).toEqual({ grantId: 'grant-c1' })
      expect(w.nativeBodies).toEqual([])
      // the row's own port lane ran: authorize + trace + titles
      expect(w.calls.map((c) => c.method)).toEqual(['filterSessions', 'traceSession', 'readTitleSnapshots'])
      expect(w.closePlanCalls()).toBe(1)
      expect(w.paCalls.filter((c) => c.leg === 'closePlan')[0]!.callId).toBe('exec-token-1')
    })

    it('admission DENY rides its own bytes: zero port entry, zero consume, plan fact still closed', async () => {
      const w = makeWorld({ tag: 'c2', paMode: 'deny' })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(definition.execute(TRACE_ARGS, EXEC))
      expect(refusal.code).toBe('P_PA_TEST_DENY')
      expect(w.portCalls()).toBe(0)
      expect(w.paCalls.some((c) => c.leg === 'edge')).toBe(false)
      expect(w.closePlanCalls()).toBe(1)
    })

    it('cancelled at open: P_G6_WIRE_ADMISSION_CANCELLED, zero port entry, closed', async () => {
      const w = makeWorld({ tag: 'c3', paMode: 'cancelled' })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(definition.execute(TRACE_ARGS, EXEC))
      expect(refusal.code).toBe(CODES.ADMISSION_CANCELLED)
      expect(w.portCalls()).toBe(0)
      expect(w.closePlanCalls()).toBe(1)
    })

    it('allow-without-a-landed-grant refuses APPROVAL_NOT_LANDED — internal state never substitutes for the kernel answer', async () => {
      const w = makeWorld({ tag: 'c4', paMode: 'approval-missing' })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(definition.execute(TRACE_ARGS, EXEC))
      expect(refusal.code).toBe(CODES.APPROVAL_NOT_LANDED)
      expect(w.portCalls()).toBe(0)
      expect(w.closePlanCalls()).toBe(1)
    })

    it('edge DENY / edge CANCELLED ride their own bytes with zero port entry and the plan fact closed', async () => {
      for (const [tag, mode, code] of [['c5', 'edge-deny', 'P_PA_TEST_EDGE_DENY'], ['c6', 'edge-cancelled', CODES.EDGE_CANCELLED]] as const) {
        const w = makeWorld({ tag, paMode: mode })
        const asm = w.build()
        const definition = asm.definitions.find((d) => d.name === 'session_trace')!
        const refusal = await asRefusal(definition.execute(TRACE_ARGS, EXEC))
        expect(refusal.code).toBe(code)
        expect(w.portCalls()).toBe(0)
        expect(w.closePlanCalls()).toBe(1)
      }
    })

    it('allow WITHOUT the one-shot consume witness refuses CONSUME_PROOF_MISSING and the body never runs — no self-attested consumption, zero port entry', async () => {
      const w = makeWorld({ tag: 'c7', paMode: 'no-proof' })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(definition.execute(TRACE_ARGS, EXEC))
      expect(refusal.code).toBe(CODES.CONSUME_PROOF_MISSING)
      expect(refusal.message).toContain('zero port entries')
      expect(w.portCalls()).toBe(0)
      expect(w.closePlanCalls()).toBe(1)
    })

    it('no execution-token identity refuses CALL_ID_ABSENT before any admission is opened', async () => {
      const w = makeWorld({ tag: 'c8' })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(definition.execute(TRACE_ARGS, {}))
      expect(refusal.code).toBe(CODES.CALL_ID_ABSENT)
      expect(w.paCalls.length).toBe(0)
      expect(w.portCalls()).toBe(0)
    })
  })

  describe('(d) injected Team ceiling: no-scope fails closed; run-time denials ride the adapter’s own bytes; rev-4 membership law survives', () => {
    it('classify-time target denial rides P_G6_TEAM_CEILING_DENY with ZERO port entry and ZERO PA open (pre-read, existence-safe)', async () => {
      const w = makeWorld({ tag: 'd1', ceiling: new Set([CALLER_ID]) })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(definition.execute(TRACE_ARGS, EXEC))
      expect(refusal.code).toBe(SC.TEAM_CEILING_DENY)
      expect(w.paCalls.length).toBe(0)
      expect(w.portCalls()).toBe(0)
    })

    it('REV-4 OUTPUT-SET MEMBERSHIP SURVIVES THE BRIDGE UNCHANGED: a set member revoked across the title read refuses the WHOLE result (no serve on a stale authorization), plan fact closed', async () => {
      const w = makeWorld({ tag: 'd2', ceilingDeniesDuring: { port: 'readTitleSnapshots', id: 'p-root' } })
      const asm = w.build()
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(definition.execute(TRACE_ARGS, EXEC))
      expect(refusal.code).toBe(SC.TEAM_CEILING_DENY)
      expect(refusal.message).toContain("revoked set member 'p-root'")
      expect(w.calls.map((c) => c.method)).toEqual(['filterSessions', 'traceSession', 'readTitleSnapshots'])
      expect(w.closePlanCalls()).toBe(1)
    })

    it('the ceiling decision port is CALLED per effective target on the row lane (injected, live, never snapshotted)', async () => {
      const seen: string[] = []
      const w = makeWorld({ tag: 'd3' })
      const asm = w.build({ teamCeiling: (target: string) => { seen.push(target); return w.ceiling.has(target) } })
      const definition = asm.definitions.find((d) => d.name === 'session_trace')!
      await definition.execute(TRACE_ARGS, EXEC)
      expect(seen[0]).toBe('s-a')
      expect(seen.length).toBeGreaterThan(1) // per-dispatch + final-serve re-verification is the row's live-decision law
    })
  })

  describe('(e) rev-4 row laws ride through untouched + import closure from source text', () => {
    it('effects stay tool-invoke with NO invented resource dimension; the SESSION_HISTORY_RESOURCE_KIND blocker travels verbatim; drain reaches every row', () => {
      const w = makeWorld({ tag: 'e1' })
      const asm = w.build()
      const row = asm.rowOf('session_trace')
      const plan = row.classify(TRACE_ARGS)
      expect(plan.ok).toBe(true)
      expect(plan.effects).toEqual([{ kind: 'tool-invoke', toolName: 'session_trace', resource: null }])
      expect(row.namedBlockers).toEqual([ADAPTER.A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND])
      expect(asm.drain()).toBeTruthy()
      expect(row.draining()).toBe(true)
      expect(row.classify(TRACE_ARGS).code).toBe(SC.DRAINING)
    })

    it('the module’s static import closure is exactly [domain tool-governance, ./g6-session-query.mjs]; no dynamic import, no require, no plane/registry/host/test-path specifier in ANY import position', () => {
      const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'g6-session-query-wiring.mjs'), 'utf8')
      const statics = [...source.matchAll(/^import \{[\s\S]*?\} from '([^']+)'/gmu)].map((m) => m[1])
      expect(statics).toEqual(['../../../../../domain/tool-governance/src/index.js', './g6-session-query.mjs'])
      // the FORBIDDEN scan runs on the IMPORT SURFACE (specifiers and the
      // dynamic-import/require call sites), never on refusal-message law
      // text — the strings this module quotes cite the law, they do not
      // import it.
      const importSurface = [
        ...[...source.matchAll(/from '([^']+)'/gmu)].map((m) => m[1]),
        ...[...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]/gmu)].map((m) => m[1]),
        ...[...source.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]/gmu)].map((m) => m[1]),
      ].join('\n')
      expect(source).not.toMatch(/\bimport\s*\(/u)
      expect(source).not.toMatch(/\brequire\s*\(/u)
      for (const forbidden of ['agent-bindings', 'pa-mount-registry', 'team-tool-plane', 'tool-dispatch', 'deepseek-harness-test-use', 'tests/', 'operation-permission', 'control/types']) {
        expect(importSurface, `forbidden specifier reaches the import surface: ${forbidden}`).not.toContain(forbidden)
      }
    })
  })

  describe('(f) NAMED GAPS pinned at their measured bytes through the REAL published checkers — never worded closed', () => {
    it('PA_CONSUMPTION_BRIDGE_COMPLETION (1): the three always-mount rows’ targetManifest FAILS the bridge’s lossless walk (maxSearchResults is an always-present member that is undefined off the search family)', () => {
      const w = makeWorld({ tag: 'f1' })
      const asm = w.build()
      for (const toolName of ['session_trace', 'session_event_trace', 'session_event_read']) {
        const plan = asm.rowOf(toolName).classify(toolName === 'session_trace' ? TRACE_ARGS : { session_id: 's-a', seq: 5 })
        expect(plan.ok).toBe(true)
        const manifest = plan.reviewPayload!.targetManifest as Record<string, unknown>
        expect('maxSearchResults' in manifest).toBe(true)
        expect(manifest.maxSearchResults).toBe(undefined)
        expect(isLosslessJsonValue(manifest)).toBe(false)
      }
    })

    it('PA_CONSUMPTION_BRIDGE_COMPLETION (2): even the lossless search-row manifest meets NO registered structure — the wire-pinned unregistered-family denial of the rules gate', () => {
      const w = makeWorld({ tag: 'f2' })
      const asm = w.build()
      const plan = asm.rowOf('session_search').classify({ query: 'needle' })
      expect(plan.ok).toBe(true)
      const manifest = plan.reviewPayload!.targetManifest as Record<string, unknown>
      expect(isLosslessJsonValue(manifest)).toBe(true) // search rows carry the number
      expect(validatePaFamilyTarget('B-SESSION-QUERY', manifest)).toBe(
        "familyId: no target structure is registered for 'B-SESSION-QUERY'",
      )
      // the measured inexpressibility the delta must close: nullable string,
      // string array — NO current kind admits either, and the closed key-set
      // law refuses both including and omitting the keys.
      expect(manifest.callerWorkspaceCwd).toBe(CWD)
      expect(Array.isArray(manifest.disclosures)).toBe(true)
      const noCwd = makeWorld({ tag: 'f2b', cwd: undefined })
      const asmNoCwd = noCwd.build()
      const planNoCwd = asmNoCwd.rowOf('session_trace').classify(TRACE_ARGS)
      expect((planNoCwd.reviewPayload!.targetManifest as Record<string, unknown>).callerWorkspaceCwd).toBe(null)
    })

    it('BACKEND DEPLOYMENT stays named: with absent evidence the census row refuses with the assembly’s evidence string verbatim and NO registration exists', () => {
      const evidence = 'no session-query backend deployed on this assembly'
      const w = makeWorld({ tag: 'f3', searchBackend: { present: false, evidence } })
      const asm = w.build()
      const refusal = asm.rowOf('session_search').classify({ query: 'needle' })
      expect(refusal.code).toBe(SC.DECLARED_MOUNT_ABSENT)
      expect(refusal.detail!).toContain(evidence)
      expect(() => asm.familyRegistrations()).toThrow(CODES.PLACEMENT_KEY_ABSENT) // census rows never reach registration
    })
  })

  describe('(g) root 18:2x defect round — production seat shape, one capture, TOCTOU close, issued identity', () => {
    it('g1: the PRODUCTION seat shape assembles and walks — paAdmit is a CALLABLE carrying open/edge/closePlan (team-tool-plane.mjs:1214/:1679/:1713/:1714)', async () => {
      const w = makeWorld({ tag: 'g1' })
      const methods = w.baseInput.pa as Record<string, unknown>
      const callablePa = Object.assign(
        async () => { throw new Error('the CALLABLE face of paAdmit never runs on the split-path walk — only the attached methods do') },
        methods,
      )
      const asm = w.build({ pa: callablePa })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_trace')!
      const served = String(await def.execute(TRACE_ARGS, { callId: 'exec-callable-seat' }))
      expect(String(served)).toContain('s-a')
      expect(w.closePlanCalls()).toBe(1)
      expect(w.calls.length).toBeGreaterThan(0)
    })

    it('g2: ONE CAPTURE per name — the seam answers the adapter and the placed definition with the SAME object; a second read is structurally impossible', () => {
      const w = makeWorld({ tag: 'g2' })
      const first = new Map<string, Record<string, unknown>>()
      const reads: string[] = []
      const seam = (name: string) => {
        reads.push(name)
        const base = w.readNative(name)
        if (base === undefined) return undefined
        if (!first.has(name)) {
          first.set(name, { ...base, description: `[g2-first-capture] ${name}` })
          return first.get(name)
        }
        // A second read would spread THIS polluted clone into the placed
        // definition — the assertions below pin it never happens.
        return { ...base, description: `[g2-SECOND-READ-POLLUTION-${String(reads.length)}] ${name}` }
      }
      const asm = w.build({ readNative: seam })
      expect(asm.ok).toBe(true)
      for (const name of ['session_search', 'session_event_search', 'session_trace', 'session_event_trace', 'session_event_read']) {
        expect(reads.filter((n) => n === name).length, `seam reads for ${name}`).toBe(1)
      }
      for (const definition of asm.definitions) {
        expect(String(definition.description)).toBe(`[g2-first-capture] ${definition.name}`)
      }
      expect(asm.definitions.length).toBe(5)
    })

    it('g3: caller A→B DURING the PA wait refuses with P_G6_WIRE_PLAN_DRIFT, zero port entry — the grant never rides a newer scope', async () => {
      const w = makeWorld({ tag: 'g3' })
      const methods = w.baseInput.pa as Record<string, unknown>
      const driftingPa = Object.freeze({
        ...methods,
        open: async (walk: Record<string, unknown>) => {
          const answered = await (methods.open as (x: Record<string, unknown>) => Promise<unknown>)(walk)
          w.setCaller('caller-B-after-approval') // the caller moves while PA is asked
          return answered
        },
      })
      const asm = w.build({ pa: driftingPa })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_search')!
      const refusal = await asRefusal(def.execute({ query: 'needle' }, { callId: 'exec-drift' }))
      expect(refusal.code).toBe(CODES.PLAN_DRIFT)
      expect(refusal.message).toContain('frozen plan')
      expect(w.calls.length, 'zero port entry on the drift path').toBe(0)
      expect(w.closePlanCalls(), 'the plan fact still dies with the call').toBe(1)
    })

    it('g4: args MUTATED during the PA wait never execute — the body runs the frozen APPROVED snapshot', async () => {
      const w = makeWorld({ tag: 'g4' })
      const methods = w.baseInput.pa as Record<string, unknown>
      const args: Record<string, unknown> = { session_id: 's-a', seq: 5 }
      const mutatingPa = Object.freeze({
        ...methods,
        open: async (walk: Record<string, unknown>) => {
          args.session_id = 's-zzz' // caller-side mutation lands AFTER classify, DURING the PA await
          return await (methods.open as (x: Record<string, unknown>) => Promise<unknown>)(walk)
        },
      })
      const asm = w.build({ pa: mutatingPa })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_event_trace')!
      const served = String(await def.execute(args, { callId: 'exec-mutated' }))
      // served = the APPROVED target s-a; had the mutated s-zzz (no such
      // session) reached the row, invoke would have refused NOT_FOUND.
      expect(String(served)).toContain('s-a')
      expect(String(served)).not.toContain('s-zzz')
      expect(w.calls.length).toBeGreaterThan(0)
      expect(w.closePlanCalls()).toBe(1)
    })

    it('g5: the ISSUED identity — the correlationOf seam owns the call id end-to-end (walk, proof leg, closePlan); an exec without callId is admissible through it', async () => {
      const w = makeWorld({ tag: 'g5' })
      let minted = 0
      const asm = w.build({ correlationOf: (_exec: unknown, name: string) => `g5-issued-${name}-${String(minted += 1)}` })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_trace')!
      const served = String(await def.execute(TRACE_ARGS, { token: {} })) // NO callId on the exec
      expect(String(served)).toContain('s-a')
      const openLegs = w.paCalls.filter((c) => c.leg === 'open')
      expect(openLegs[0]!.callId).toBe('g5-issued-session_trace-1')
      expect(w.paCalls.filter((c) => c.leg === 'closePlan')[0]!.callId).toBe('g5-issued-session_trace-1')
    })

    it('g6: no issuer, no exec identity — CALL_ID_ABSENT refuses before the seat; no plan fact is opened', async () => {
      const w = makeWorld({ tag: 'g6' })
      const asm = w.build()
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_trace')!
      const refusal = await asRefusal(def.execute(TRACE_ARGS, { token: {} }))
      expect(refusal.code).toBe(CODES.CALL_ID_ABSENT)
      expect(w.paCalls.length).toBe(0)
      expect(w.calls.length).toBe(0)
      expect(w.closePlanCalls()).toBe(0)
    })
  })

  describe('(h) approved callerSnapshot FULL-VALUE binding (root 992: the fingerprint does not cover the caller id or the step boundary)', () => {
    it('h1: explicit-target same-cwd caller A→B during the PA wait — the fingerprint does NOT move, yet the full callerSnapshot refuses (this is the leak the fingerprint re-compare alone missed)', async () => {
      const w = makeWorld({ tag: 'h1' })
      const methods = w.baseInput.pa as Record<string, unknown>
      const obs: Array<Record<string, unknown>> = []
      const driftingPa = Object.freeze({
        ...methods,
        open: async (walk: Record<string, unknown>) => {
          const answered = await (methods.open as (x: Record<string, unknown>) => Promise<unknown>)(walk)
          // SAME workspace cwd (the world's cwd face is caller-independent),
          // EXPLICIT target in the args: the targetManifest — and with it
          // the parametersFingerprint — is byte-identical under caller B.
          w.setCaller('caller-B-same-cwd')
          return answered
        },
      })
      const asm = w.build({ pa: driftingPa, observe: (e: Record<string, unknown>) => { obs.push(e) } })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_event_trace')!
      const refusal = await asRefusal(def.execute({ session_id: 's-a', seq: 5 }, { callId: 'exec-caller-swap' }))
      expect(refusal.code).toBe(CODES.PLAN_DRIFT)
      // the DRIFT detail pins WHY: not the fingerprint (it did not move) —
      // the approved callerSnapshot's own value.
      expect(obs.some((e) => e.event === 'g6-wire:plan-DRIFT' && e.code === 'caller-snapshot-moved'), 'the drift line names the caller snapshot').toBe(true)
      expect(obs.some((e) => e.code === 'fingerprint-moved'), 'the fingerprint itself did not move').toBe(false)
      expect(w.calls.length, 'zero port entry').toBe(0)
      expect(w.nativeBodies.length).toBe(0)
      expect(w.closePlanCalls()).toBe(1)
    })

    it('h2: step-boundary tick during the PA wait (id and cwd unchanged) — the readable window never widens through the old grant', async () => {
      const w = makeWorld({ tag: 'h2' })
      const methods = w.baseInput.pa as Record<string, unknown>
      const obs: Array<Record<string, unknown>> = []
      w.setCallerBoundary({ visibleThrough: 10 })
      const tickingPa = Object.freeze({
        ...methods,
        open: async (walk: Record<string, unknown>) => {
          const answered = await (methods.open as (x: Record<string, unknown>) => Promise<unknown>)(walk)
          // the boundary tick 10→20 widens what the body WOULD read; the
          // fingerprint does not contain the boundary and does not move.
          w.setCallerBoundary({ visibleThrough: 20 })
          return answered
        },
      })
      const asm = w.build({ pa: tickingPa, observe: (e: Record<string, unknown>) => { obs.push(e) } })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_event_read')!
      const refusal = await asRefusal(def.execute({ session_id: 's-a', seq: 5 }, { callId: 'exec-boundary-tick' }))
      expect(refusal.code).toBe(CODES.PLAN_DRIFT)
      expect(obs.some((e) => e.event === 'g6-wire:plan-DRIFT' && e.code === 'caller-snapshot-moved')).toBe(true)
      expect(w.calls.length, 'the widened window never reached the ports').toBe(0)
      expect(w.closePlanCalls()).toBe(1)
      // the same call under a STEADY caller serves normally (the leg proves
      // the refusal is the tick, not the tool) — on a CLEAN seat (the
      // ticking pa would of course tick again):
      w.setCallerBoundary({ visibleThrough: 10 })
      const steadyAsm = w.build()
      expect(steadyAsm.ok).toBe(true)
      const plain = steadyAsm.definitions.find((d) => d.name === 'session_event_read')!
      const served = String(await plain.execute({ session_id: 's-a', seq: 5 }, { callId: 'exec-steady' }))
      expect(served).toContain('s-a')
    })

    it('h3: the REAL supply-shape acceptance — current-session event_search rides the turnBoundary state lastStepStartSeq (workspace-access.ts:56-69 @639ed01539), never a silent whole-corpus read', async () => {
      const w = makeWorld({ tag: 'h3' })
      const reqs: Array<Record<string, unknown>> = []
      const base = w.qp as unknown as { searchQueryPort: { searchEvents: (a: unknown, b: unknown) => Promise<unknown>, searchSessions: (a: unknown, b: unknown) => Promise<unknown> } }
      const wrappedQp = {
        ...w.qp,
        searchQueryPort: Object.freeze({
          searchSessions: base.searchQueryPort.searchSessions,
          // TWO named formals (the placement arity law).
          searchEvents: async function spy (a: unknown, b: unknown): Promise<unknown> {
            reqs.push(a as Record<string, unknown>)
            return await base.searchQueryPort.searchEvents(a, b)
          },
        }),
      }
      // (a) NO boundary → the ROW'S OWN guard refuses the current-session
      // default (root 18:58: a production current-session event_search
      // without the projection answers NO_CURRENT_STEP) — the searchEvents
      // port is NEVER entered.
      const noBoundaryAsm = w.build({ queryPorts: wrappedQp })
      expect(noBoundaryAsm.ok).toBe(true)
      const searchDef = noBoundaryAsm.definitions.find((d) => d.name === 'session_event_search')!
      const refusal = await asRefusal(searchDef.execute({ query: 'alpha needle' }, { callId: 'exec-current-nostep' }))
      expect(refusal.code).toBe('SESSION_QUERY_TOOL_NO_CURRENT_STEP')
      expect(reqs.length, 'the unbounded current-session read never reached searchEvents').toBe(0)
      // (b) the actual projection STATE (lastStepStartSeq — the same field
      // the host caller law carries, core/agent/src/types.ts:82) → served,
      // with the readable window CLAMPED to the step start.
      w.setCallerBoundary({ lastStepStartSeq: 6 })
      const steppedAsm = w.build({ queryPorts: wrappedQp })
      expect(steppedAsm.ok).toBe(true)
      const searchDef2 = steppedAsm.definitions.find((d) => d.name === 'session_event_search')!
      const served = String(await searchDef2.execute({ query: 'alpha needle' }, { callId: 'exec-current-step' }))
      expect(typeof served).toBe('string')
      expect(reqs.length).toBe(1)
      // the clamp rides the REAL filter face (buildEventFilters — a
      // {kind:'seq', from?, to?} entry, adapter :593-607): seq.to is capped
      // at lastStepStartSeq - 1 — the loop never reads outside the step.
      const filters = reqs[0]!.filters as Array<{ kind: string, to?: number }>
      expect(filters.find((f) => f.kind === 'seq')?.to, 'the window clamps to lastStepStartSeq - 1').toBe(5)
    })
  })

  describe('(i) REAL SUPPLY (root 992 ②): the facets map OFF the live sessionQuery service — absent/incomplete are honest census, never fake supply', () => {
    const engineFace = (over: Record<string, unknown> = {}) => Object.assign({
      name: 'sessionQuery',
      searchSessions: async () => 'E:searchSessions',
      searchEvents: async () => 'E:searchEvents',
      traceSession: async () => 'E:traceSession',
      traceEvent: async () => 'E:traceEvent',
      readEvent: async () => 'E:readEvent',
      filterSessions: async () => 'E:filterSessions',
      readTitleSnapshots: async () => 'E:readTitleSnapshots',
    }, over)

    it('i1: no service registered — SUPPLY_ABSENT typed census (never a fake stand-in)', () => {
      const supply = WIRE.buildG6QuerySupplyFromService(undefined)
      expect(supply.ok).toBe(false)
      if (supply.ok === true) return
      expect(supply.code).toBe(CODES.SUPPLY_ABSENT)
    })

    it('i2: core facet missing — SUPPLY_INCOMPLETE naming the facet, no partial supply', () => {
      const engine = engineFace({ readEvent: undefined })
      const supply = WIRE.buildG6QuerySupplyFromService(engine)
      expect(supply.ok).toBe(false)
      if (supply.ok === true) return
      expect(supply.code).toBe(CODES.SUPPLY_INCOMPLETE)
      expect(supply.detail).toContain('readEvent')
    })

    it('i3: live service — provider identity off the registration, facets bound to the SAME live methods, search evidence present', async () => {
      const seen: Array<{ name: string, call: unknown[] }> = []
      const engine = engineFace({
        traceSession: async (...call: unknown[]) => { seen.push({ name: 'traceSession', call }); return 'E:live-trace' },
      })
      const supply = WIRE.buildG6QuerySupplyFromService(engine)
      expect(supply.ok).toBe(true)
      if (supply.ok !== true) return
      expect(supply.providerId).toBe('sessionQuery')
      const tracePort = supply.queryPorts.traceQueryPort as { traceSession: (a: unknown, b: unknown) => Promise<unknown> }
      expect(await tracePort.traceSession('s-a', 'signal-x')).toBe('E:live-trace')
      expect(seen[0]!.call).toEqual(['s-a', 'signal-x'])
      expect(supply.declaredMount.searchBackend).toEqual({ present: true })
    })

    it('i4: service WITHOUT search facets — ok supply, no searchQueryPort, honest present:false evidence (the two search names keep their natives)', () => {
      const engine = engineFace({ searchSessions: undefined, searchEvents: undefined })
      const supply = WIRE.buildG6QuerySupplyFromService(engine)
      expect(supply.ok).toBe(true)
      if (supply.ok !== true) return
      expect(Object.keys(supply.queryPorts)).not.toContain('searchQueryPort')
      expect((supply.declaredMount.searchBackend as { present?: unknown }).present).toBe(false)
      expect(String((supply.declaredMount.searchBackend as { evidence?: string }).evidence ?? '')).toContain('observed at mount')
    })

    it('i5: service→supply→wiring→serve end to end with NOTHING injected from config', async () => {
      const w = makeWorld({ tag: 'i5' })
      const ports = w.qp as unknown as {
        searchQueryPort: { searchSessions: (a: unknown, b: unknown) => Promise<unknown>, searchEvents: (a: unknown, b: unknown) => Promise<unknown> }
        traceQueryPort: { traceSession: (a: unknown, b: unknown) => Promise<unknown>, traceEvent: (a: unknown, b: unknown) => Promise<unknown> }
        eventReadQueryPort: { readEvent: (a: unknown, b: unknown) => Promise<unknown> }
        authorizationQueryPort: { filterSessions: (a: unknown, b: unknown) => Promise<unknown> }
        titlesQueryPort: { readTitleSnapshots: (a: unknown, b: unknown) => Promise<unknown> }
      }
      const engine = {
        name: 'sessionQuery',
        searchSessions: ports.searchQueryPort.searchSessions,
        searchEvents: ports.searchQueryPort.searchEvents,
        traceSession: ports.traceQueryPort.traceSession,
        traceEvent: ports.traceQueryPort.traceEvent,
        readEvent: ports.eventReadQueryPort.readEvent,
        filterSessions: ports.authorizationQueryPort.filterSessions,
        readTitleSnapshots: ports.titlesQueryPort.readTitleSnapshots,
      }
      const supply = WIRE.buildG6QuerySupplyFromService(engine)
      expect(supply.ok).toBe(true)
      if (supply.ok !== true) return
      const asm = w.build({ providerId: supply.providerId, queryPorts: supply.queryPorts, declaredMount: supply.declaredMount })
      expect(asm.ok).toBe(true)
      const def = asm.definitions.find((d) => d.name === 'session_trace')!
      const served = String(await def.execute(TRACE_ARGS, { callId: 'exec-real-supply' }))
      expect(served).toContain('s-a')
      expect(w.nativeBodies.length).toBe(0)
    })

    it('i6: the supply IS the approved handle — a later method swap on the service can NOT ride the face the adapter pins (no wrapper masking)', () => {
      const callsA: string[] = []
      const callsB: string[] = []
      const engine = engineFace({
        traceSession: async function originalA (id: unknown, signal: unknown) { callsA.push(`A:${String(id)}:${String(signal)}`); return 'E:A' },
      })
      const supply = WIRE.buildG6QuerySupplyFromService(engine)
      expect(supply.ok).toBe(true)
      if (supply.ok !== true) return
      const tracePort = supply.queryPorts.traceQueryPort as { traceSession: (a: unknown, b: unknown) => Promise<unknown> }
      // the swap AFTER supply-build: the service face changes…
      engine.traceSession = async function swappedB () { callsB.push('B'); return 'E:B' }
      // …but the SUPPLIED face is the build-time handle bound to its
      // receiver: the adapter pins this stable face and what it pins IS the
      // approved method, so drift can never hide behind a wrapper.
      void tracePort.traceSession('s-a', 'sig')
      expect(callsA).toEqual(['A:s-a:sig'])
      expect(callsB.length, 'the swapped method never rides the approved supply').toBe(0)
    })
  })
})
