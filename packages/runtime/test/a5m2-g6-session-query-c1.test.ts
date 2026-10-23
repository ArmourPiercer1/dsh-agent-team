/**
 * A5M2-G6-SESSION-QUERY-C1 (rev 2) — the REAL-QUERY ADAPTER for the five host
 * session-intelligence tools (g6-session-query.mjs), rebuilt against the six
 * independent-review items. Leg classes:
 *
 *  (1) INTERFACE AUDIT over the pinned 639ed01539 pristine checkout
 *      (tests/paths.mjs is the unique path/pin source): REAL built-tool
 *      capture, REAL host-validator fixed point, TEXT-PINNED canonical lines
 *      INCLUDING presentation.ts / service-boundary.ts / extraction.ts /
 *      workspace-access.ts, the SAFE-table EXACT equality (the module mirror
 *      must equal the source table entry-for-entry), and the runtime
 *      abstract-vs-concrete proof extended to filterSessions/readTitleSnapshots.
 *  (2) NATIVE OUTPUT FIDELITY (item 4): the CAPTURED native execute() runs
 *      over one shared fake service as a byte-equality ORACLE — every served
 *      string of every row must be IDENTICAL to what the real operations +
 *      presentation layers serve for the same fixture (titles, parent display
 *      through the authorized filter, trace shape, empty strings, cap notes).
 *  (3) PRE-AUTH ∩ CEILING (items 1+2): filterSessions pre-read tuples, the
 *      ONE existence-safe failure for missing vs foreign targets, Team
 *      ceiling denial pre-read with zero port entry, and the result-lane
 *      ceiling intersection for the cross-session search.
 *  (4) CAPTURED-SCHEMA TYPED VALIDATION (item 3): type/enum violations
 *      refused from the COMPILED bytes, no coercion; the host's own
 *      validator agrees on the same captured schema.
 *  (5) PARENT/ROOT LANE + EVIDENCE MOUNT (item 6): real authorizeSessionIds
 *      tuples, root null only when include is true, include_root_sessions:
 *      false honored, empty-lane native string, and the evidence law (no
 *      search methods needed to construct without a backend; INACTIVE carries
 *      the verbatim evidence; contradictions throw at placement).
 *  (6) RECEIVER-PINNED DISPATCH (item 5): receiver-object and function-
 *      object identity per dispatch (PORT_RECEIVER_MOVED / PORT_METHOD_MOVED,
 *      zero forwarding), cursor paging riding the pinned receiver, the native
 *      repeated-cursor law riding SESSION_QUERY_INVALID_CURSOR, drift, drain.
 *
 * Scope: NO Host boot, NO network, NO :3080/:3180. Tier honesty: the module
 * is UNWIRED; the equivalence legs run over a TEST-OWNED FAKE service and
 * prove the pipeline mirror, NOT a real-Session dimension; assembly /
 * in-process dimensions are never 已测试. Family status: 未开发（部分实现）
 * — see the card report.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g6-session-query-c1
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA, TEST_USE_REL, findTestRepoRoot } from '../../../tests/paths.mjs'

const REPO = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO === null) throw new Error('a5m2-g6-session-query-c1: no repo root carrying tests/paths.mjs — failing closed')
const HOST = join(REPO, TEST_USE_REL)

type ToolName = 'session_search' | 'session_event_search' | 'session_trace' | 'session_event_trace' | 'session_event_read'
interface PortFamilyFace { facet: string, methods: string[], arity: number, required: boolean, law: string }
const S = (await import(new URL('../src/plugin/live/governed-families/g6-session-query.mjs', import.meta.url).href)) as {
  A5_G6_ADAPTER_REVISION: number
  A5_G6_FAMILY: string
  A5_G6_TOOL_NAMES: readonly ToolName[]
  A5_G6_PORT_FAMILIES: { search: PortFamilyFace, trace: PortFamilyFace, eventRead: PortFamilyFace, authorization: PortFamilyFace, titles: PortFamilyFace }
  A5_G6_TYPED_CODES: Record<'DECLARED_MOUNT_ABSENT' | 'NATIVE_FACE_ABSENT' | 'INVALID_ARGUMENTS' | 'UNKNOWN_PARAMETER' | 'MISSING_PARAMETER' | 'INVALID_QUERY' | 'INVALID_FILTER' | 'CALLER_UNAVAILABLE' | 'CALLER_DRIFT' | 'PORT_RECEIVER_MOVED' | 'PORT_METHOD_MOVED' | 'PRE_ABORTED' | 'RESULT_INTEGRITY_INVALID' | 'TEAM_CEILING_DENY' | 'DRAINING', string>
  A5_G6_SAFE_SERVICE_FAILURES: Record<string, { code: string, message: string }>
  A5_G6_NAMED_BLOCKERS: { SEARCH_BACKEND: string, SESSION_HISTORY_RESOURCE_KIND: string }
  A5_G6_DRAIN_SEMANTICS: string
  createG6SessionQueryAdapter: (deps: Record<string, unknown>) => G6Adapter
}
const SC = S.A5_G6_TYPED_CODES

/* ── local structural types (test doubles; the host law is cited, never typed as any) ── */
interface NativeFace {
  name: string
  description: string
  parameters: Record<string, unknown>
  output?: { schema?: unknown }
  execute: (args: unknown, exec: unknown) => Promise<unknown>
  [key: string]: unknown
}
interface G6Row {
  active: boolean
  mountCondition: string
  toolName: string
  portFamily: string
  portMethod: string
  description: string | null
  registrationSchema: Record<string, unknown> | null
  captured: () => boolean
  namedBlockers: string[]
  classify: (args: unknown) => Record<string, unknown>
  invoke: (args: unknown, exec?: Record<string, unknown>) => Promise<Record<string, unknown>>
  drain: () => void
  draining: () => boolean
  lastDispatch: () => Record<string, unknown> | null
}
interface G6Adapter { rows: Record<ToolName, G6Row> }
interface Tuple { method: string, args: unknown[] }
interface Failure extends Error { code?: string }

const DESC: Record<ToolName, string> = {
  session_search: 'Search prior sessions in the caller workspace and return the strongest matching event from each session.',
  session_event_search: 'Search prior events in one authorized session; the current session excludes the step performing this call.',
  session_trace: 'Read the authorized session lineage around one session, including complete visible ancestor and descendant relationships.',
  session_event_trace: 'Read every direct replacement and relationship to a cited source event for one event in an authorized session.',
  session_event_read: 'Read one full unabridged event and optional neighboring raw-event summaries from an authorized session.',
}

const CALLER_ID = 'sess-caller-1'
const CWD = '/work/repo'

/* ── host loaders ───────────────────────────────────────────────────────── */
interface HostQueryLib {
  SessionQueryEngine: { prototype: Record<string, unknown> }
  SessionQueryError: new (message: string, code: string) => Error & { code: string }
}
let hostQueryPromise: Promise<HostQueryLib> | null = null
function hostQuery (): Promise<HostQueryLib> {
  if (hostQueryPromise === null) {
    const libPath = join(HOST, 'packages', 'session-query', 'session-query', 'lib', 'index.js')
    if (!existsSync(libPath)) throw new Error(`pristine session-query lib absent (${libPath}); failing closed`)
    hostQueryPromise = import(pathToFileURL(libPath).href) as Promise<HostQueryLib>
  }
  return hostQueryPromise
}

let hostToolsPromise: Promise<{
  assertSupportedJsonSchema: (schema: unknown) => void
  validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
}> | null = null
function hostTools () {
  if (hostToolsPromise === null) {
    const libPath = join(HOST, 'packages', 'core', 'tools', 'lib', 'index.js')
    if (!existsSync(libPath)) throw new Error(`pristine core/tools lib absent (${libPath}); failing closed`)
    hostToolsPromise = import(pathToFileURL(libPath).href) as Promise<{
      assertSupportedJsonSchema: (schema: unknown) => void
      validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
    }>
  }
  return hostToolsPromise
}

type ToolPluginLib = { apply: (ctx: unknown, config: Record<string, unknown>) => void }
let toolPluginPromise: Promise<ToolPluginLib> | null = null
function toolPlugin (): Promise<ToolPluginLib> {
  if (toolPluginPromise === null) {
    const libPath = join(HOST, 'packages', 'session-query', 'tool-session-query', 'lib', 'index.js')
    if (!existsSync(libPath)) throw new Error(`pristine host tool lib absent (${libPath}); failing closed`)
    toolPluginPromise = import(pathToFileURL(libPath).href) as Promise<ToolPluginLib>
  }
  return toolPluginPromise
}

let realFacesPromise: Promise<Record<ToolName, NativeFace>> | null = null
/** Executes the REAL built tool plugin's apply() over a capture ctx. */
function loadRealFaces (): Promise<Record<ToolName, NativeFace>> {
  if (realFacesPromise === null) {
    realFacesPromise = (async () => {
      const mod = (await toolPlugin()) as unknown as {
        name: string
        inject: string[]
        DEFAULT_MAX_SEARCH_RESULTS: number
        apply: (ctx: unknown, config: Record<string, unknown>) => void
      }
      expect(mod.name).toBe('tool-session-query')
      expect(mod.inject).toEqual(['tools', 'systemPrompt', 'sessionQuery', 'sessionProjections'])
      expect(mod.DEFAULT_MAX_SEARCH_RESULTS).toBe(100)
      const captured = {} as Record<ToolName, NativeFace>
      const order: string[] = []
      const ctx = {
        tools: { register: (tool: NativeFace) => { (captured as Record<string, NativeFace>)[tool.name] = tool; order.push(tool.name); return () => {} } },
        systemPrompt: { section: () => {}, getSectionOrder: () => 0 },
      }
      mod.apply(ctx, {})
      expect(order).toEqual(['session_search', 'session_event_search', 'session_trace', 'session_event_trace', 'session_event_read'])
      return captured
    })()
  }
  return realFacesPromise
}

function hostSrc (rel: string): string[] {
  const p = join(HOST, 'packages', rel)
  if (!existsSync(p)) throw new Error(`pristine host source absent (${p}); failing closed`)
  return readFileSync(p, 'utf8').split('\n')
}
function pinBlock (rel: string, from: number, to: number, mustContain: readonly string[]): void {
  const block = hostSrc(rel).slice(from - 1, to).join('\n')
  for (const needle of mustContain) {
    expect(block, `${rel}:${from}-${to} must contain ${JSON.stringify(needle)}`).toContain(needle)
  }
}

/* ── the shared fake service (ONE object plays every facet, mirroring the
 *    one real SessionQueryEngine instance) + fixture world ──────────────── */
interface SeedEvent {
  seq: number
  type: string
  time: number
  surface: string
  snippetText?: string
  data?: Record<string, unknown>
}
interface SeedSession {
  id: string
  cwd?: string
  parentSession?: string
  createdAt: number
  live?: boolean
  persisted?: boolean
  title?: string
  events?: SeedEvent[]
}
interface WorldOpts {
  sessions?: SeedSession[]
  boundary?: { lastStepStartSeq?: number | null }
  noBoundary?: boolean
  ceiling?: string[] | 'all'
  maxSearchResults?: number
  searchBackend?: unknown
  provideSearchFacet?: boolean
  readCallerOverride?: () => unknown
}

const DEFAULT_SESSIONS: SeedSession[] = [
  { id: CALLER_ID, cwd: CWD, createdAt: 5000, title: 'caller session', events: [{ seq: 10, type: 'user/message', time: 4900, surface: 'current', snippetText: 'hello from the caller', data: { content: [{ type: 'text', text: 'hello from the caller' }] } }] },
  { id: 's-a', cwd: CWD, parentSession: 'p-root', createdAt: 4000, title: 'Alpha work', events: [{ seq: 5, type: 'user/message', time: 3900, surface: 'current', snippetText: 'alpha needle', data: { content: [{ type: 'text', text: 'alpha needle' }] } }, { seq: 6, type: 'assistant/message', time: 3950, surface: 'current', snippetText: 'alpha reply', data: { message: { content: [{ type: 'text', text: 'alpha reply' }] } } }] },
  { id: 's-b', cwd: CWD, createdAt: 3000, title: 'Beta root', events: [{ seq: 2, type: 'user/message', time: 2900, surface: 'current', snippetText: 'beta needle' }] },
  { id: 'p-root', cwd: CWD, createdAt: 1000, title: 'Root', events: [] },
  { id: 's-evil', cwd: '/elsewhere', createdAt: 2000, title: 'Foreign', events: [{ seq: 1, type: 'user/message', time: 1900, surface: 'current', snippetText: 'foreign needle' }] },
  { id: 'p-evil', cwd: '/elsewhere', createdAt: 900, events: [] },
]

function defaultSessions (): SeedSession[] {
  return JSON.parse(JSON.stringify(DEFAULT_SESSIONS)) as SeedSession[]
}

interface World {
  svc: Record<string, unknown>
  qp: Record<string, unknown>
  captured: Map<string, NativeFace>
  calls: Tuple[]
  boundary: { lastStepStartSeq?: number | null } | undefined
  adapter: G6Adapter
  pages: { searchSessions: Record<string, unknown>[], searchEvents: Record<string, unknown>[] }
  fail: Record<string, unknown>
  rejectTitles: Set<string>
  sessions: Map<string, SeedSession>
  exec: () => { agent: { session: { id: string, header: Record<string, unknown> } }, signal: AbortSignal }
  callsSince: (mark: number) => Tuple[]
  nativeCall: (tool: ToolName, args: unknown) => Promise<{ value?: string, error?: Failure }>
  rowCall: (tool: ToolName, args: unknown) => Promise<{ value?: string, error?: Failure, refusal?: Record<string, unknown> }>
}

/* The EXACT SessionQueryError class of the tool module graph: the vitest SSR
 * runner may load a file-URL-imported copy of the built lib separately from
 * the copy the tool plugin's own imports resolve, so a directly-imported
 * class would fail the native `instanceof SessionQueryError` sanitize law for
 * reasons that are module-graph artifacts, not law. The tool graph constructs
 * one internally on the repeated-cursor law (operations.ts:268-274, thrown
 * UNSANITIZED out of collectPages) — the probe captures the genuine class. */
let queryErrorCtorRef: (new (message: string, code: string) => Error & { code: string }) | null = null
async function queryErrorCtor (w: World): Promise<new (message: string, code: string) => Error & { code: string }> {
  if (queryErrorCtorRef !== null) return queryErrorCtorRef
  w.pages.searchSessions.push({ items: [], nextCursor: 'c-probe' }, { items: [], nextCursor: 'c-probe' })
  const probe = await w.nativeCall('session_search', { query: 'probe' })
  if (probe.error === undefined || probe.error.constructor.name !== 'SessionQueryError') {
    throw new Error('g6-c1: the repeated-cursor probe did not surface the tool-graph SessionQueryError — failing closed')
  }
  queryErrorCtorRef = probe.error.constructor as new (message: string, code: string) => Error & { code: string }
  return queryErrorCtorRef
}

async function makeWorld (opts: WorldOpts = {}): Promise<World> {
  const mod = await toolPlugin()
  const sessions = new Map((opts.sessions ?? defaultSessions()).map((seed) => [seed.id, seed]))
  const calls: Tuple[] = []
  const pages = { searchSessions: [] as Record<string, unknown>[], searchEvents: [] as Record<string, unknown>[] }
  const fail: Record<string, unknown> = {}
  const rejectTitles = new Set<string>()
  const ceiling: string[] | 'all' = opts.ceiling ?? 'all'
  const boundary = opts.noBoundary === true ? undefined : (opts.boundary ?? { lastStepStartSeq: 50 })
  const caller = { id: CALLER_ID, cwd: CWD, boundary }
  const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
  const record = (seed: SeedSession) => ({
    header: {
      id: seed.id,
      ...(seed.cwd === undefined ? {} : { cwd: seed.cwd }),
      ...(seed.parentSession === undefined ? {} : { parentSession: seed.parentSession }),
      createdAt: seed.createdAt,
    },
    live: seed.live ?? true,
    persisted: seed.persisted ?? true,
  })

  const sessionMatches = (seed: SeedSession, filters: Array<Record<string, unknown>>): boolean => {
    for (const filter of filters) {
      if (filter['kind'] === 'id') {
        if (!(filter['values'] as string[]).includes(seed.id)) return false
      } else if (filter['kind'] === 'cwd') {
        if (!(filter['values'] as Array<string | null>).includes(seed.cwd ?? null)) return false
      } else if (filter['kind'] === 'parent') {
        if (!(filter['values'] as Array<string | null>).includes(seed.parentSession ?? null)) return false
      } else if (filter['kind'] === 'created-at') {
        const from = (filter['from'] as number | undefined) ?? Number.NEGATIVE_INFINITY
        const to = (filter['to'] as number | undefined) ?? Number.POSITIVE_INFINITY
        if (seed.createdAt < from || seed.createdAt > to) return false
      } else if (filter['kind'] === 'availability') {
        const values = filter['values'] as string[]
        const live = (seed.live ?? true) && values.includes('live')
        const persisted = (seed.persisted ?? true) && values.includes('persisted')
        if (!live && !persisted) return false
      }
    }
    return true
  }
  const eventMatches = (ev: SeedEvent, filters: Array<Record<string, unknown>>): boolean => {
    for (const filter of filters) {
      if (filter['kind'] === 'seq') {
        const from = (filter['from'] as number | undefined) ?? Number.NEGATIVE_INFINITY
        const to = (filter['to'] as number | undefined) ?? Number.POSITIVE_INFINITY
        if (ev.seq < from || ev.seq > to) return false
      } else if (filter['kind'] === 'time') {
        const from = (filter['from'] as number | undefined) ?? Number.NEGATIVE_INFINITY
        const to = (filter['to'] as number | undefined) ?? Number.POSITIVE_INFINITY
        if (ev.time < from || ev.time > to) return false
      } else if (filter['kind'] === 'type') {
        if (!(filter['values'] as string[]).includes(ev.type)) return false
      } else if (filter['kind'] === 'surface') {
        if (!(filter['values'] as string[]).includes(ev.surface)) return false
      }
    }
    return true
  }
  const queryHit = (ev: SeedEvent, query: string): boolean =>
    query.length === 0 || (ev.snippetText ?? '').toLowerCase().includes(query.toLowerCase())

  const svc: Record<string, unknown> = {
    async filterSessions (filters: Array<Record<string, unknown>>, signal?: AbortSignal) {
      calls.push({ method: 'filterSessions', args: [filters, signal] })
      if (fail['filterSessions'] !== undefined) throw fail['filterSessions']
      return [...sessions.values()]
        .filter((seed) => sessionMatches(seed, filters))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(record)
    },
    async searchSessions (request: Record<string, unknown>, exec?: unknown) {
      calls.push({ method: 'searchSessions', args: [request, exec] })
      if (fail['searchSessions'] !== undefined) throw fail['searchSessions']
      const queued = pages.searchSessions.shift()
      if (queued !== undefined) return queued
      const query = request['query'] as string
      const sessionFilters = (request['sessionFilters'] ?? []) as Array<Record<string, unknown>>
      const eventFilters = (request['eventFilters'] ?? []) as Array<Record<string, unknown>>
      const items = [...sessions.values()]
        .filter((seed) => sessionMatches(seed, sessionFilters))
        .sort((a, b) => b.createdAt - a.createdAt)
        .flatMap((seed) => {
          const best = (seed.events ?? []).filter((ev) => eventMatches(ev, eventFilters) && queryHit(ev, query))[0]
          if (best === undefined) return []
          return [{ ...record(seed), bestMatch: { seq: best.seq, type: best.type, time: best.time, surface: best.surface, snippet: best.snippetText ?? '' } }]
        })
      return { items }
    },
    async searchEvents (request: Record<string, unknown>, exec?: unknown) {
      calls.push({ method: 'searchEvents', args: [request, exec] })
      if (fail['searchEvents'] !== undefined) throw fail['searchEvents']
      const queued = pages.searchEvents.shift()
      if (queued !== undefined) return queued
      const seed = sessions.get(request['sessionId'] as string)
      if (seed === undefined) throw new (await hostQuery()).SessionQueryError('session was not found', 'SESSION_QUERY_SESSION_NOT_FOUND')
      const filters = (request['filters'] ?? []) as Array<Record<string, unknown>>
      const items = (seed.events ?? [])
        .filter((ev) => eventMatches(ev, filters) && queryHit(ev, request['query'] as string))
        .map((ev) => ({ sessionId: seed.id, seq: ev.seq, type: ev.type, time: ev.time, surface: ev.surface, snippet: ev.snippetText ?? '' }))
      return { session: record(seed).header, items }
    },
    async traceSession (sessionId: string, signal?: AbortSignal) {
      calls.push({ method: 'traceSession', args: [sessionId, signal] })
      if (fail['traceSession'] !== undefined) throw fail['traceSession']
      const seed = sessions.get(sessionId)
      if (seed === undefined) throw new (await hostQuery()).SessionQueryError('session was not found', 'SESSION_QUERY_SESSION_NOT_FOUND')
      const ancestors: ReturnType<typeof record>[] = []
      let walk = seed.parentSession === undefined ? undefined : sessions.get(seed.parentSession)
      while (walk !== undefined) {
        ancestors.push(record(walk))
        walk = walk.parentSession === undefined ? undefined : sessions.get(walk.parentSession)
      }
      const buildNode = (candidate: SeedSession): { session: ReturnType<typeof record>, descendants: unknown[] } => ({
        session: record(candidate),
        descendants: [...sessions.values()]
          .filter((child) => child.parentSession === candidate.id)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(buildNode),
      })
      return clone({
        target: record(seed),
        ancestors,
        descendants: [...sessions.values()]
          .filter((child) => child.parentSession === seed.id)
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(buildNode),
        complete: true,
      })
    },
    async traceEvent (request: { sessionId: string, seq: number }, signal?: AbortSignal) {
      calls.push({ method: 'traceEvent', args: [request, signal] })
      if (fail['traceEvent'] !== undefined) throw fail['traceEvent']
      const seed = sessions.get(request.sessionId)
      const ev = seed?.events?.find((candidate) => candidate.seq === request.seq)
      if (seed === undefined || ev === undefined) throw new (await hostQuery()).SessionQueryError('session event was not found', 'SESSION_QUERY_EVENT_NOT_FOUND')
      return {
        session: record(seed).header,
        target: { seq: ev.seq, type: ev.type, time: ev.time, surface: ev.surface },
        replacementChain: [],
        replacedEventSeqs: [],
        sourceEventSeqs: [1],
        derivedEventSeqs: [11],
      }
    },
    async readEvent (request: Record<string, unknown>, signal?: AbortSignal) {
      calls.push({ method: 'readEvent', args: [request, signal] })
      if (fail['readEvent'] !== undefined) throw fail['readEvent']
      const seed = sessions.get(request['sessionId'] as string)
      const events = seed?.events ?? []
      const target = events.find((ev) => ev.seq === request['seq'])
      if (seed === undefined || target === undefined) throw new (await hostQuery()).SessionQueryError('session event was not found', 'SESSION_QUERY_EVENT_NOT_FOUND')
      const before = (request['before'] as number | undefined) ?? 0
      const after = (request['after'] as number | undefined) ?? 0
      const window = events.filter((ev) => ev.seq >= target.seq - before && ev.seq <= target.seq + after)
      return {
        session: record(seed).header,
        target: clone(target),
        events: clone(window),
        startSeq: window[0]?.seq ?? target.seq,
        endSeq: window[window.length - 1]?.seq ?? target.seq,
      }
    },
    async readTitleSnapshots (ids: string[], signal?: AbortSignal) {
      calls.push({ method: 'readTitleSnapshots', args: [ids, signal] })
      if (fail['readTitleSnapshots'] !== undefined) throw fail['readTitleSnapshots']
      const rejected = (id: string, message: string, code: string) => {
        if (queryErrorCtorRef === null) throw new Error(`g6-c1: a rejected title observation (${code}) was requested before the tool-graph SessionQueryError was probed — fail closed`)
        return { sessionId: id, status: 'rejected', reason: new queryErrorCtorRef(message, code) }
      }
      return ids.map((id) => {
        if (rejectTitles.has(id)) return rejected(id, 'title source failed', 'SESSION_QUERY_EVENT_NOT_FOUND')
        const seed = sessions.get(id)
        if (seed === undefined) return rejected(id, 'session was not found', 'SESSION_QUERY_SESSION_NOT_FOUND')
        return {
          sessionId: id,
          status: 'fulfilled',
          value: { session: record(seed).header, ...(seed.title === undefined ? {} : { title: { title: seed.title } }) },
        }
      })
    },
  }

  const captured = new Map<string, NativeFace>()
  const ctx = {
    tools: { register: (tool: NativeFace) => { captured.set(tool.name, tool); return () => {} } },
    systemPrompt: { section: () => {}, getSectionOrder: () => 0 },
    sessionQuery: svc,
    sessionProjections: { stateOf: () => boundary },
    logger: { warn: () => {} },
  }
  mod.apply(ctx, { ...(opts.maxSearchResults === undefined ? {} : { maxSearchResults: opts.maxSearchResults }) })

  const provideSearch = opts.provideSearchFacet !== false
  const backend = opts.searchBackend ?? { present: true }
  const qp: Record<string, unknown> = {
    traceQueryPort: svc,
    eventReadQueryPort: svc,
    authorizationQueryPort: svc,
    titlesQueryPort: svc,
    ...(provideSearch ? { searchQueryPort: svc } : {}),
  }
  const adapter = S.createG6SessionQueryAdapter({
    realmId: 'realm-g6',
    providerId: 'plugin-team-g6',
    readNative: (name: string) => captured.get(name),
    queryPorts: qp,
    readCaller: opts.readCallerOverride ?? (() => ({ ...caller })),
    teamCeiling: (targetSessionId: string) => ceiling === 'all' || ceiling.includes(targetSessionId),
    declaredMount: { searchBackend: backend },
    ...(opts.maxSearchResults === undefined ? {} : { maxSearchResults: opts.maxSearchResults }),
  })

  const world: World = {
    svc,
    qp,
    captured,
    calls,
    boundary,
    adapter,
    pages,
    fail,
    rejectTitles,
    sessions,
    exec: () => ({
      agent: { session: { id: CALLER_ID, header: { id: CALLER_ID, cwd: CWD, createdAt: 5000 } } },
      signal: new AbortController().signal,
    }),
    callsSince: (mark) => calls.slice(mark),
    nativeCall: async (tool, args) => {
      try {
        return { value: (await (captured.get(tool) as NativeFace).execute(args, world.exec())) as string }
      } catch (error) {
        return { error: error as Failure }
      }
    },
    rowCall: async (tool, args) => {
      const exec = world.exec()
      try {
        const out = await world.adapter.rows[tool].invoke(args, { signal: exec.signal })
        if (out['ok'] === true) return { value: out['value'] as string }
        return { refusal: out }
      } catch (error) {
        return { error: error as Failure }
      }
    },
  }
  return world
}

/* ══ 1. INTERFACE AUDIT — the REAL 639 facts ══════════════════════════════ */
describe('a5m2-g6 interface audit — pinned baseline + REAL tool surface', () => {
  it('the pinned baseline is the unique source: tests/paths.mjs SHA + version + the checkout itself', () => {
    expect(TEST_USE_BASELINE_SHA).toBe('639ed015397290b3745d163aafe02ffee4aa3f84')
    expect(DSH_BASELINE_VERSION).toBe('0.2.0-rc.2')
    expect(TEST_USE_REL).toBe('tests/deepseek-harness-test-use')
    const pkg = JSON.parse(readFileSync(join(HOST, 'package.json'), 'utf8')) as { version: string }
    expect(pkg.version).toBe(DSH_BASELINE_VERSION)
  })

  it('the REAL built plugin registers EXACTLY the five tools with pinned description bytes and compiled parameters the REAL host validator accepts', async () => {
    const captured = await loadRealFaces()
    const host = await hostTools()
    expect(Object.keys(captured)).toEqual(S.A5_G6_TOOL_NAMES)
    const expectedProperties: Record<ToolName, string[]> = {
      session_search: ['query', 'session_ids', 'created_at_from', 'created_at_to', 'parent_session_ids', 'include_root_sessions', 'availability', 'event_seq_from', 'event_seq_to', 'event_time_from', 'event_time_to', 'event_types', 'event_surfaces'],
      session_event_search: ['session_id', 'query', 'seq_from', 'seq_to', 'time_from', 'time_to', 'event_types', 'surfaces'],
      session_trace: ['session_id'],
      session_event_trace: ['session_id', 'seq'],
      session_event_read: ['session_id', 'seq', 'before', 'after'],
    }
    const expectedRequired: Record<ToolName, string[]> = {
      session_search: ['query'],
      session_event_search: ['query'],
      session_trace: [],
      session_event_trace: ['seq'],
      session_event_read: ['seq'],
    }
    for (const name of S.A5_G6_TOOL_NAMES) {
      const tool = captured[name]
      expect(tool.description, `${name} description bytes`).toBe(DESC[name])
      const params = tool.parameters as { type: string, properties: Record<string, Record<string, unknown>>, required?: string[] }
      expect(params.type, `${name} root`).toBe('object')
      expect(Object.keys(params.properties), `${name} properties`).toEqual(expectedProperties[name])
      expect(params.required ?? [], `${name} required`).toEqual(expectedRequired[name])
      for (const [prop, spec] of Object.entries(params.properties)) {
        expect(spec.required, `${name}.${prop} compiled marker`).toBeUndefined()
      }
      expect(() => host.assertSupportedJsonSchema(tool.parameters), `${name} host validator`).not.toThrow()
      if (expectedRequired[name].length > 0) {
        expect(host.validateJsonSchemaValue(tool.parameters, {}, '').join(';'), `${name} missing-required`).toMatch(String(expectedRequired[name][0]))
      } else {
        expect(host.validateJsonSchemaValue(tool.parameters, {}, '')).toEqual([])
      }
    }
    expect((captured['session_event_read'].output as { schema: unknown }).schema).toEqual({ type: 'string' })
  })

  it('canonical SOURCE lines behind rev 2 are TEXT-PINNED (tool face, input DSL, operations, workspace law, boundary, presentation, extraction, types, service signatures)', () => {
    pinBlock('session-query/tool-session-query/src/index.ts', 65, 73, ["name: 'session_search'", 'parameters: toolInput.sessionSearchParameters', 'operations.executeSessionSearch'])
    pinBlock('session-query/tool-session-query/src/index.ts', 75, 83, ["name: 'session_event_search'", 'parameters: toolInput.eventSearchParameters', 'operations.executeEventSearch'])
    pinBlock('session-query/tool-session-query/src/index.ts', 85, 93, ["name: 'session_trace'", 'parameters: toolInput.targetSessionParameter', 'operations.executeSessionTrace'])
    pinBlock('session-query/tool-session-query/src/index.ts', 95, 106, ["name: 'session_event_trace'", "seq: { type: 'integer', required: true", 'operations.executeEventTrace'])
    pinBlock('session-query/tool-session-query/src/index.ts', 108, 121, ["name: 'session_event_read'", "before: { type: 'integer'", "after: { type: 'integer'", 'operations.executeEventRead'])
    pinBlock('session-query/tool-session-query/src/index.ts', 46, 49, ["schema: { type: 'string' as const }"])
    pinBlock('session-query/tool-session-query/src/input.ts', 88, 107, [
      "filters.push({ kind: 'id', values: args.session_ids.map(value => brandString<SessionIdValue>(value)) })",
      'function materializeParentSessionIds',
      'return [...new Set(values.map(value => brandString<SessionIdValue>(value)))]',
    ])
    pinBlock('session-query/tool-session-query/src/input.ts', 126, 141, [
      'session-search query must contain non-whitespace text',
      'session-search query must not contain NUL',
    ])
    pinBlock('session-query/tool-session-query/src/input.ts', 271, 294, [
      'must be a non-negative safe integer',
      'must contain at least one value when supplied',
    ])
    // operations: the pre-read authorizations + lanes the rev-2 rows mirror
    pinBlock('session-query/tool-session-query/src/operations.ts', 79, 102, [
      'await workspaceAccess.authorizeSessionIds(ctx, caller, requestedParentIds, exec.signal)',
      'if (args.include_root_sessions === true) parentValues.push(null)',
      'if (parentValues.length === 0) return presentation.formatEmptySessionSearch()',
      "sessionFilters.push({ kind: 'cwd', values: [cwd] })",
      "serviceBoundary.call(ctx, exec.signal, 'session search', () =>",
      'hit => hit.header.id !== caller.id && workspaceAccess.recordAuthorized(hit, caller)',
    ])
    pinBlock('session-query/tool-session-query/src/operations.ts', 103, 114, [
      '.map(hit => hit.header.parentSession)',
      'authorizedParents',
      'presentation.formatSessionSearch(collected, titles, authorizedParents)',
    ])
    pinBlock('session-query/tool-session-query/src/operations.ts', 117, 169, [
      'const sessionId = workspaceAccess.targetId(args, caller)',
      'await workspaceAccess.authorizeTarget(ctx, caller, sessionId, exec.signal)',
      'const title = await workspaceAccess.readTitle(ctx, caller, sessionId, exec.signal)',
      'range.to = Math.min(range.to ?? Number.MAX_SAFE_INTEGER, (stepStartSeq ?? 0) - 1)',
      'workspaceAccess.assertObservedTargetAuthorized(caller, sessionId, page.session)',
    ])
    pinBlock('session-query/tool-session-query/src/operations.ts', 171, 201, [
      'await workspaceAccess.authorizeTarget(ctx, caller, sessionId, exec.signal)',
      "serviceBoundary.call(ctx, exec.signal, 'session lineage trace', () =>",
      'presentation.formatSessionTrace(trace, ancestors, ancestorBoundary, descendants, titles)',
    ])
    pinBlock('session-query/tool-session-query/src/operations.ts', 244, 277, [
      'session-search provider repeated a continuation cursor',
      "'SESSION_QUERY_INVALID_CURSOR'",
    ])
    // workspace law
    pinBlock('session-query/tool-session-query/src/workspace-access.ts', 75, 90, [
      'if (target === caller.id) return',
      "{ kind: 'id', values: [target] }",
      "{ kind: 'cwd', values: [cwd] }",
      'records.length !== 1',
      'unauthorizedTarget()',
    ])
    pinBlock('session-query/tool-session-query/src/workspace-access.ts', 111, 135, [
      'authorized.add(caller.id)',
      "{ kind: 'id', values: other }",
      "if (cwd === undefined || other.length === 0) return authorized",
    ])
    pinBlock('session-query/tool-session-query/src/workspace-access.ts', 137, 173, [
      "if (observation.status === 'rejected')",
      'assertObservedTargetAuthorized(caller, observation.sessionId, observation.value.session)',
      "observation.value.title?.title ?? 'untitled'",
      "if (sanitized.code === 'SESSION_QUERY_TOOL_UNAUTHORIZED') throw sanitized",
    ])
    pinBlock('session-query/tool-session-query/src/workspace-access.ts', 237, 241, ['(title unavailable: '])
    // service boundary: the ONE target failure + the sanitize law
    pinBlock('session-query/tool-session-query/src/service-boundary.ts', 92, 114, [
      "'session target is outside the caller workspace'",
      "'SESSION_QUERY_TOOL_UNAUTHORIZED'",
      'signal.throwIfAborted()',
    ])
    pinBlock('session-query/tool-session-query/src/service-boundary.ts', 116, 148, [
      'error instanceof SessionQueryError',
      "'session query operation failed'",
    ])
    // presentation: the strings the rows must serve byte-identically
    pinBlock('session-query/tool-session-query/src/presentation.ts', 48, 83, [
      'Parent: ${parent}',
      "'[outside workspace]'",
      'Session search results (${collected.items.length}):',
      'No prior session matches found.',
    ])
    pinBlock('session-query/tool-session-query/src/presentation.ts', 108, 131, [
      "'Ancestors (nearest first):'",
      "'- none (target is a root session)'",
      "'- [outside workspace boundary]'",
    ])
    pinBlock('session-query/tool-session-query/src/presentation.ts', 165, 209, [
      '```json',
      'JSON.stringify(window.target, null, 2)',
      '| (no semantic text)',
    ])
    pinBlock('session-query/session-query/src/extraction.ts', 15, 87, [
      "case 'user/message':",
      "case 'tool/result':",
      "case 'turn/end':",
    ])
    // canonical result members + service signatures behind the two new facets
    pinBlock('session-query/session-query/src/types.ts', 162, 183, [
      "status: 'fulfilled'",
      "status: 'rejected'",
    ])
    pinBlock('session-query/session-query/src/index.ts', 206, 213, ['async filterSessions(', 'materializeSessionResultFilters(filters)'])
    pinBlock('session-query/session-query/src/index.ts', 251, 263, ['async readTitleSnapshots(', 'this._corpus.projectMany(sessionIds'])
    pinBlock('session-query/session-query/src/types.ts', 231, 242, ['nextCursor?: SessionSearchCursor', 'session: SessionHeader'])
  })

  it('the SAFE-FAILURES mirror in the module EQUALS the source table entry-for-entry (rev-2 sanitize law)', () => {
    const text = hostSrc('session-query/tool-session-query/src/service-boundary.ts').join('\n')
    const table = text.slice(
      text.indexOf('const SAFE_SESSION_QUERY_FAILURES = {'),
      text.indexOf('} satisfies Record<SessionQueryErrorCode'),
    )
    const entries = [...table.matchAll(/(\w+): \{\s*code: '([A-Z_]+)',\s*message: '([^']+)'/gu)]
    expect(entries.length).toBe(17)
    const source: Record<string, { code: string, message: string }> = {}
    for (const [, key, code, message] of entries) source[key as string] = { code: code as string, message: message as string }
    expect(S.A5_G6_SAFE_SERVICE_FAILURES).toEqual(source)
  })

  it('runtime proof on the built service: abstract search absent; concrete trace/read/authorization/titles all 2-formal', async () => {
    const query = await hostQuery()
    const proto = query.SessionQueryEngine.prototype as unknown as Record<string, unknown>
    expect(proto['searchSessions']).toBeUndefined()
    expect(proto['searchEvents']).toBeUndefined()
    for (const method of ['traceSession', 'traceEvent', 'readEvent', 'filterSessions', 'readTitleSnapshots']) {
      expect(typeof proto[method], method).toBe('function')
      expect((proto[method] as { length: number }).length, `${method} arity`).toBe(2)
    }
    // sanitize-detection law: the REAL error class keeps its constructor name
    const error = new query.SessionQueryError('probe', 'SESSION_QUERY_STALE_CURSOR')
    expect(error.constructor.name).toBe('SessionQueryError')
    expect(error.code).toBe('SESSION_QUERY_STALE_CURSOR')
  })
})

/* ══ 2. CAPTURED-SCHEMA TYPED VALIDATION (fix 3) ═════════════════════════ */
describe('a5m2-g6 captured-schema typed validation — the compiled bytes decide, nothing coerces', () => {
  it('type violations on the captured compiled schema are refused typed with ZERO port entry', async () => {
    const w = await makeWorld()
    const mark = w.calls.length
    const badSeq = w.adapter.rows['session_event_trace'].classify({ session_id: 's-a', seq: '7' })
    expect(badSeq['ok']).toBe(false)
    expect(badSeq['code']).toBe(SC.INVALID_ARGUMENTS)
    expect(String(badSeq['detail'])).toContain("'seq' must be an integer")
    expect(String(badSeq['detail'])).toContain('never coerces')
    const badIds = w.adapter.rows['session_search'].classify({ query: 'x', session_ids: [123] })
    expect(String(badIds['detail'])).toContain("'session_ids'[0] must be a string")
    const badRoot = w.adapter.rows['session_search'].classify({ query: 'x', include_root_sessions: 'yes' })
    expect(String(badRoot['detail'])).toContain("'include_root_sessions' must be a boolean")
    const badEnum = w.adapter.rows['session_search'].classify({ query: 'x', availability: ['ghost'] })
    expect(String(badEnum['detail'])).toContain('must be one of')
    const badSurfaces = w.adapter.rows['session_event_search'].classify({ query: 'x', surfaces: ['nope'] })
    expect(String(badSurfaces['detail'])).toContain('must be one of ["current","shadowed","log-only"]')
    expect(w.callsSince(mark).length).toBe(0)
  })

  it('the REAL host validator agrees on the SAME captured schema (fixed point; the r9 idiom)', async () => {
    const captured = await loadRealFaces()
    const host = await hostTools()
    const face = captured['session_event_trace'].parameters
    expect(host.validateJsonSchemaValue(face, { seq: '7' }, '').join(';')).toMatch(/integer|number/u)
    expect(host.validateJsonSchemaValue(face, { seq: 7 }, '')).toEqual([])
    const searchFace = captured['session_search'].parameters
    expect(host.validateJsonSchemaValue(searchFace, { query: 'ok', availability: ['ghost'] }, '').join(';')).not.toEqual([])
  })

  it('the input-law body taxonomy rides the native messages through the planning envelope', async () => {
    const w = await makeWorld()
    const blank = w.adapter.rows['session_event_search'].classify({ query: '   ' })
    expect(blank['code']).toBe(SC.INVALID_QUERY)
    expect(String(blank['detail'])).toContain('session-search query must contain non-whitespace text')
    const nul = w.adapter.rows['session_event_search'].classify({ query: 'a\u0000b' })
    expect(String(nul['detail'])).toContain('must not contain NUL')
    const negSeq = w.adapter.rows['session_event_trace'].classify({ seq: -1 })
    expect(negSeq['code']).toBe(SC.INVALID_FILTER)
    expect(String(negSeq['detail'])).toContain('seq must be a non-negative safe integer')
    const emptyParents = w.adapter.rows['session_search'].classify({ query: 'x', parent_session_ids: [] })
    expect(String(emptyParents['detail'])).toContain('parent_session_ids must contain at least one value when supplied')
    const badTime = w.adapter.rows['session_event_search'].classify({ query: 'x', time_from: 'yesterday' })
    expect(String(badTime['detail'])).toContain('session time_from range must be an ISO 8601 timestamp with Z or a numeric offset')
  })
})

/* ══ 3. PRE-AUTH ∩ CEILING + EXISTENCE SAFETY (fixes 1+2) ════════════════ */
describe('a5m2-g6 pre-authorization intersection and existence-safe errors', () => {
  it('a foreign target and a MISSING target answer the ONE native failure — byte-equal to each other and to the native oracle — pre-read, zero read-port entry', async () => {
    const w = await makeWorld()
    const foreign = await w.rowCall('session_event_read', { session_id: 's-evil', seq: 1 })
    const missing = await w.rowCall('session_event_read', { session_id: 's-nope', seq: 1 })
    expect(foreign.error?.code).toBe('SESSION_QUERY_TOOL_UNAUTHORIZED')
    expect(missing.error?.code).toBe('SESSION_QUERY_TOOL_UNAUTHORIZED')
    expect(missing.error?.message).toBe('session target is outside the caller workspace')
    expect(foreign.error?.message).toBe(missing.error?.message)
    const nativeForeign = await w.nativeCall('session_event_read', { session_id: 's-evil', seq: 1 })
    const nativeMissing = await w.nativeCall('session_event_read', { session_id: 's-nope', seq: 1 })
    expect(nativeForeign.error?.code).toBe('SESSION_QUERY_TOOL_UNAUTHORIZED')
    expect(nativeForeign.error?.message).toBe(foreign.error?.message)
    expect(nativeMissing.error?.message).toBe(nativeForeign.error?.message)
    // the ONLY port entries were filterSessions id+cwd authorizations — never readEvent
    expect(w.calls.map((tuple) => tuple.method)).toEqual(['filterSessions', 'filterSessions', 'filterSessions', 'filterSessions'])
    expect(w.calls[1]?.args[0]).toEqual([{ kind: 'id', values: ['s-nope'] }, { kind: 'cwd', values: [CWD] }])
  })

  it('the caller-self target rides the native short-circuit (workspace-access.ts:81) — zero filterSessions, direct read', async () => {
    const w = await makeWorld()
    const mark = w.calls.length
    const out = await w.rowCall('session_event_read', { seq: 10 })
    expect(out.value).toContain('Target event seq 10')
    const methods = w.callsSince(mark).map((tuple) => tuple.method)
    expect(methods).not.toContain('filterSessions')
    expect(methods).toContain('readEvent')
    expect(w.callsSince(mark).find((tuple) => tuple.method === 'readEvent')?.args[0]).toEqual({ sessionId: CALLER_ID, seq: 10 })
  })

  it('the Team ceiling denies PRE-READ with zero port entry and no existence information (classify AND invoke)', async () => {
    const w = await makeWorld({ ceiling: [CALLER_ID] })
    const classified = w.adapter.rows['session_event_read'].classify({ session_id: 's-a', seq: 5 })
    expect(classified['ok']).toBe(false)
    expect(classified['code']).toBe(SC.TEAM_CEILING_DENY)
    expect(String(classified['detail'])).toContain('zero port entry')
    expect(String(classified['detail'])).toContain('carries no existence information')
    const mark = w.calls.length
    const invoked = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(invoked.refusal?.['code']).toBe(SC.TEAM_CEILING_DENY)
    expect(w.callsSince(mark).length).toBe(0)
  })

  it('session_search INTERSECTS the ceiling into the result lane: a same-workspace hit outside the ceiling is not served (the native oracle serves it — the ceiling is the Team-side delta)', async () => {
    const w = await makeWorld({ ceiling: [CALLER_ID, 's-b'] })
    const native = await w.nativeCall('session_search', { query: 'needle' })
    expect(String(native.value)).toContain('Session search results (2):')
    const row = await w.rowCall('session_search', { query: 'needle' })
    expect(String(row.value)).toContain('Session search results (1):')
    expect(String(row.value)).toContain('Session s-b')
    expect(String(row.value)).not.toContain('Session s-a')
  })

  it('event_search PRE-AUTHORIZES an explicit target before searchEvents, and a rogue page session fails the observed-header assert', async () => {
    const w = await makeWorld()
    const mark = w.calls.length
    const out = await w.rowCall('session_event_search', { session_id: 's-a', query: 'needle' })
    expect(out.value).toContain('Event search results (1):')
    const methods = w.callsSince(mark).map((tuple) => tuple.method)
    expect(methods.indexOf('filterSessions')).toBeLessThan(methods.indexOf('searchEvents'))
    w.pages.searchEvents.push({ session: { id: 's-evil', cwd: '/elsewhere' }, items: [] })
    const rogue = await w.rowCall('session_event_search', { session_id: 's-a', query: 'needle' })
    expect(rogue.error?.code).toBe('SESSION_QUERY_TOOL_UNAUTHORIZED')
    expect(rogue.error?.message).toBe('session target is outside the caller workspace')
  })

  it('current-session search without a step boundary throws the native NO_CURRENT_STEP failure in both pipelines', async () => {
    const w = await makeWorld({ noBoundary: true })
    const native = await w.nativeCall('session_event_search', { query: 'hello' })
    const row = await w.rowCall('session_event_search', { query: 'hello' })
    expect(native.error?.code).toBe('SESSION_QUERY_TOOL_NO_CURRENT_STEP')
    expect(row.error?.code).toBe('SESSION_QUERY_TOOL_NO_CURRENT_STEP')
    expect(row.error?.message).toBe('current-session search requires an active step boundary')
  })
})

/* ══ 4. NATIVE OUTPUT FIDELITY — byte-equality vs the REAL execute (fix 4) ═ */
describe('a5m2-g6 native output fidelity — every served string byte-equals the REAL operations+presentation oracle', () => {
  it('session_trace: identical string (title header, created, ancestors nearest-first, descendants)', async () => {
    const w = await makeWorld()
    const native = await w.nativeCall('session_trace', { session_id: 's-a' })
    const row = await w.rowCall('session_trace', { session_id: 's-a' })
    expect(typeof native.value).toBe('string')
    expect(row.value).toBe(native.value)
    expect(String(row.value)).toContain('Session s-a — Alpha work')
    expect(String(row.value)).toContain('- p-root — Root')
    expect(String(row.value)).toContain('- none')
  })

  it('session_trace on a foreign parent line stops at the boundary note (identical)', async () => {
    const sessions = defaultSessions()
    sessions.push({ id: 's-e', cwd: CWD, parentSession: 'p-evil', createdAt: 3500, title: 'Eps', events: [] })
    const w = await makeWorld({ sessions })
    const native = await w.nativeCall('session_trace', { session_id: 's-e' })
    const row = await w.rowCall('session_trace', { session_id: 's-e' })
    expect(row.value).toBe(native.value)
    expect(String(row.value)).toContain('- [outside workspace boundary]')
  })

  it('session_event_trace: identical string (target line, replaced-by, seq lists)', async () => {
    const w = await makeWorld()
    const native = await w.nativeCall('session_event_trace', { session_id: 's-a', seq: 5 })
    const row = await w.rowCall('session_event_trace', { session_id: 's-a', seq: 5 })
    expect(row.value).toBe(native.value)
    expect(String(row.value)).toContain('Replaced by: none')
    expect(String(row.value)).toContain('Events cited directly as sources: 1')
    expect(String(row.value)).toContain('Direct derived events: 11')
  })

  it('session_event_read: identical string (```json fenced target, Before neighbors with semantic text); keys ride only when supplied', async () => {
    const w = await makeWorld()
    const native = await w.nativeCall('session_event_read', { session_id: 's-a', seq: 6, before: 1 })
    const row = await w.rowCall('session_event_read', { session_id: 's-a', seq: 6, before: 1 })
    expect(row.value).toBe(native.value)
    expect(String(row.value)).toContain('```json')
    expect(String(row.value)).toContain('"seq": 6')
    expect(String(row.value)).toContain('Before:')
    expect(String(row.value)).toContain('alpha needle')
    expect(String(row.value)).not.toContain('After:')
    const tuple = w.calls.find((entry) => entry.method === 'readEvent')
    expect(tuple?.args[0]).toEqual({ sessionId: 's-a', seq: 6, before: 1 })
  })

  it('session_event_search: identical strings for hits, current-step exclusion (seq to = 49), and the native empty-window string (title read BEFORE the short-circuit, zero searchEvents)', async () => {
    const w = await makeWorld()
    const hits = await w.nativeCall('session_event_search', { session_id: 's-a', query: 'needle' })
    const hitsRow = await w.rowCall('session_event_search', { session_id: 's-a', query: 'needle' })
    expect(hitsRow.value).toBe(hits.value)
    expect(String(hitsRow.value)).toContain('Session s-a — Alpha work')

    const current = await w.nativeCall('session_event_search', { query: 'hello' })
    const currentRow = await w.rowCall('session_event_search', { query: 'hello' })
    expect(currentRow.value).toBe(current.value)
    const tuple = [...w.calls].reverse().find((entry) => entry.method === 'searchEvents')
    expect(tuple?.args[0]).toEqual(expect.objectContaining({
      sessionId: CALLER_ID,
      query: 'hello',
      filters: [{ kind: 'seq', to: 49 }],
    }))

    const mark = w.calls.length
    const empty = await w.rowCall('session_event_search', { session_id: CALLER_ID, query: 'hello', seq_from: 60 })
    expect(empty.value).toBe(`Session ${CALLER_ID} — caller session\n\nNo prior event matches found.`)
    const methods = w.callsSince(mark).map((entry) => entry.method)
    expect(methods).not.toContain('searchEvents')
    expect(methods).toContain('readTitleSnapshots')
  })

  it('session_search: identical multi-hit string with the parent display through the AUTHORIZED filter (authorized id / root / [outside workspace]) and the cap note', async () => {
    const sessions = defaultSessions()
    sessions.push({ id: 's-e', cwd: CWD, parentSession: 'p-evil', createdAt: 4500, title: 'Eps', events: [{ seq: 3, type: 'user/message', time: 4400, surface: 'current', snippetText: 'epsilon needle' }] })
    const w = await makeWorld({ sessions })
    const native = await w.nativeCall('session_search', { query: 'needle' })
    const row = await w.rowCall('session_search', { query: 'needle' })
    expect(row.value).toBe(native.value)
    expect(String(row.value)).toContain('Session search results (3):')
    expect(String(row.value)).toContain('   Parent: p-root')
    expect(String(row.value)).toContain('   Parent: root')
    expect(String(row.value)).toContain('   Parent: [outside workspace]')
    expect(String(row.value)).not.toContain('Result cap reached')

    const w3 = await makeWorld({ maxSearchResults: 1 })
    const nativeCapped = await w3.nativeCall('session_search', { query: 'needle' })
    const rowCapped = await w3.rowCall('session_search', { query: 'needle' })
    expect(rowCapped.value).toBe(nativeCapped.value)
    expect(String(rowCapped.value)).toContain('Result cap reached. Narrow the query or add filters to find additional matches.')
  })

  it('title unavailability renders the SAME in both pipelines (rejected observation → untitled (title unavailable: CODE))', async () => {
    const w = await makeWorld()
    await queryErrorCtor(w)
    w.rejectTitles.add('s-a')
    const native = await w.nativeCall('session_event_read', { session_id: 's-a', seq: 5 })
    const row = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(row.value).toBe(native.value)
    expect(String(row.value)).toContain('Session s-a — untitled (title unavailable: SESSION_QUERY_EVENT_NOT_FOUND)')
  })

  it('an UNAUTHORIZED service failure rides the ONE target failure identically in both pipelines (sanitize:134-136)', async () => {
    const w = await makeWorld()
    const Ctor = await queryErrorCtor(w)
    w.fail['readTitleSnapshots'] = new Ctor('forbidden fold', 'SESSION_QUERY_TOOL_UNAUTHORIZED')
    const native = await w.nativeCall('session_event_read', { session_id: 's-a', seq: 5 })
    const row = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(native.error?.code).toBe('SESSION_QUERY_TOOL_UNAUTHORIZED')
    expect(native.error?.message).toBe('session target is outside the caller workspace')
    expect(row.error?.code).toBe('SESSION_QUERY_TOOL_UNAUTHORIZED')
    expect(row.error?.message).toBe(native.error?.message)
  })
})

/* ══ 5. SERVICE-LANE ERRORS RIDE THE SAFE TABLE (fix 2) ═══════════════════ */
describe('a5m2-g6 service-lane error semantics — the mirrored safe table, not row codes', () => {
  it('a REAL SessionQueryError from the port surfaces with the TABLE-safe message and code, identical to the native oracle; the raw message never rides', async () => {
    const w = await makeWorld()
    const Ctor = await queryErrorCtor(w)
    w.fail['traceEvent'] = new Ctor('raw internal detail with identifiers', 'SESSION_QUERY_EVENT_NOT_FOUND')
    const native = await w.nativeCall('session_event_trace', { session_id: 's-a', seq: 5 })
    const row = await w.rowCall('session_event_trace', { session_id: 's-a', seq: 5 })
    expect(native.error?.code).toBe('SESSION_QUERY_EVENT_NOT_FOUND')
    expect(row.error?.code).toBe('SESSION_QUERY_EVENT_NOT_FOUND')
    expect(row.error?.message).toBe('session event was not found')
    expect(row.error?.message).toBe(native.error?.message)
    expect(String(row.error?.message)).not.toContain('raw internal detail')
  })

  it('an unknown port failure collapses to SESSION_QUERY_TOOL_FAILED in both pipelines', async () => {
    const w = await makeWorld()
    w.fail['traceSession'] = new Error('engine exploded')
    const native = await w.nativeCall('session_trace', { session_id: 's-a' })
    const row = await w.rowCall('session_trace', { session_id: 's-a' })
    expect(native.error?.code).toBe('SESSION_QUERY_TOOL_FAILED')
    expect(row.error?.code).toBe('SESSION_QUERY_TOOL_FAILED')
    expect(row.error?.message).toBe('session query operation failed')
  })

  it('the native repeated-cursor law rides SESSION_QUERY_INVALID_CURSOR with the native message (no row-local code)', async () => {
    const w = await makeWorld()
    const hitA = { header: { id: 's-a', cwd: CWD, parentSession: 'p-root', createdAt: 4000 }, live: true, persisted: true, bestMatch: { seq: 5, type: 'user/message', time: 3900, surface: 'current', snippet: 'alpha needle' } }
    const loopPages = (): Record<string, unknown>[] => JSON.parse(JSON.stringify([
      { items: [hitA], nextCursor: 'c-1' },
      { items: [hitA], nextCursor: 'c-1' },
    ])) as Record<string, unknown>[]
    w.pages.searchSessions.push(...loopPages())
    const native = await w.nativeCall('session_search', { query: 'needle' })
    w.pages.searchSessions.push(...loopPages())
    const row = await w.rowCall('session_search', { query: 'needle' })
    expect(native.error?.code).toBe('SESSION_QUERY_INVALID_CURSOR')
    expect(row.error?.code).toBe('SESSION_QUERY_INVALID_CURSOR')
    expect(row.error?.message).toBe('session-search provider repeated a continuation cursor')
    expect(row.error?.message).toBe(native.error?.message)
  })

  it('an off-contract page (items missing) is a governance integrity refusal — the row refuses to serve or page further', async () => {
    const w = await makeWorld()
    w.pages.searchSessions.push({ noItems: true })
    const row = await w.rowCall('session_search', { query: 'needle' })
    expect(row.error?.code).toBe(SC.RESULT_INTEGRITY_INVALID)
  })
})

/* ══ 6. PARENT/ROOT LANE + EVIDENCE MOUNT (fix 6) ════════════════════════ */
describe('a5m2-g6 parent/root lane and evidence-backed mount law', () => {
  it('parent_session_ids ride REAL authorizeSessionIds pre-authorization; unauthorized parents are dropped; root null joins ONLY when include is true — byte-equal to the native oracle', async () => {
    const w = await makeWorld()
    const native = await w.nativeCall('session_search', { query: 'needle', parent_session_ids: ['p-root', 'p-evil'], include_root_sessions: true })
    w.calls.length = 0
    const row = await w.rowCall('session_search', { query: 'needle', parent_session_ids: ['p-root', 'p-evil'], include_root_sessions: true })
    expect(row.value).toBe(native.value)
    const authTuple = w.calls.find((entry) => entry.method === 'filterSessions')
    expect(authTuple?.args[0]).toEqual([
      { kind: 'id', values: ['p-root', 'p-evil'] },
      { kind: 'cwd', values: [CWD] },
    ])
    const sessionFilters = ((w.calls.find((entry) => entry.method === 'searchSessions')?.args[0]) as { sessionFilters: unknown[] }).sessionFilters
    expect(sessionFilters).toContainEqual({ kind: 'parent', values: ['p-root', null] })
    expect(sessionFilters[sessionFilters.length - 1]).toEqual({ kind: 'cwd', values: [CWD] })
  })

  it('include_root_sessions:false queries parents WITHOUT the root clause; false alone skips the lane', async () => {
    const w = await makeWorld()
    const nativeFalse = await w.nativeCall('session_search', { query: 'needle', parent_session_ids: ['p-root'], include_root_sessions: false })
    w.calls.length = 0
    const rowFalse = await w.rowCall('session_search', { query: 'needle', parent_session_ids: ['p-root'], include_root_sessions: false })
    expect(rowFalse.value).toBe(nativeFalse.value)
    const filters = ((w.calls.find((entry) => entry.method === 'searchSessions')?.args[0]) as { sessionFilters: Array<Record<string, unknown>> }).sessionFilters
    expect(filters.find((filter) => filter['kind'] === 'parent')).toEqual({ kind: 'parent', values: ['p-root'] })

    w.calls.length = 0
    const alone = await w.rowCall('session_search', { query: 'needle', include_root_sessions: false })
    const aloneFilters = ((w.calls.find((entry) => entry.method === 'searchSessions')?.args[0]) as { sessionFilters: Array<Record<string, unknown>> }).sessionFilters
    expect(aloneFilters.some((filter) => filter['kind'] === 'parent')).toBe(false)
    expect(String(alone.value)).toContain('Session search results (2):')
  })

  it('an ALL-unauthorized parent lane serves the native empty string with ZERO searchSessions entry', async () => {
    const w = await makeWorld()
    const mark = w.calls.length
    const out = await w.rowCall('session_search', { query: 'needle', parent_session_ids: ['p-evil'] })
    expect(out.value).toBe('No prior session matches found.')
    expect(w.callsSince(mark).map((entry) => entry.method)).not.toContain('searchSessions')
    const native = await w.nativeCall('session_search', { query: 'needle', parent_session_ids: ['p-evil'] })
    expect(native.value).toBe('No prior session matches found.')
  })

  it('the ceiling intersects the parent lane too: an authorized-but-ceiling-denied parent never reaches the service filter', async () => {
    const w = await makeWorld({ ceiling: [CALLER_ID, 's-a', 's-b'] })
    const mark = w.calls.length
    const out = await w.rowCall('session_search', { query: 'needle', parent_session_ids: ['p-root'] })
    expect(out.value).toBe('No prior session matches found.')
    expect(w.callsSince(mark).map((entry) => entry.method)).not.toContain('searchSessions')
  })

  it('evidence law: silence throws; present:false + evidence constructs WITHOUT any search facet, INACTIVE carries the evidence verbatim, and trace/event-read stay fully REAL (native oracle byte-equal without a search port)', async () => {
    const evidence = 'deployment probe: no session-query-sqlite backend composed; SESSION_QUERY_SEARCH_DISABLED observed at boot'
    expect(() => S.createG6SessionQueryAdapter({
      realmId: 'r',
      providerId: 'p',
      readNative: () => undefined,
      queryPorts: {},
      readCaller: () => undefined,
      teamCeiling: () => true,
    })).toThrow(/REAL deployment evidence/u)
    const w = await makeWorld({ searchBackend: { present: false, evidence }, provideSearchFacet: false })
    expect(w.adapter.rows['session_search'].active).toBe(false)
    expect(w.adapter.rows['session_event_search'].active).toBe(false)
    const refused = await w.adapter.rows['session_search'].invoke({ query: 'x' })
    expect(refused['code']).toBe(SC.DECLARED_MOUNT_ABSENT)
    expect(String(refused['detail'])).toContain(evidence)
    expect(String(refused['detail'])).toContain('ABSTRACT full-text')
    const native = await w.nativeCall('session_trace', { session_id: 's-a' })
    const row = await w.rowCall('session_trace', { session_id: 's-a' })
    expect(row.value).toBe(native.value)
    const read = await w.rowCall('session_event_read', { session_id: 's-a', seq: 5 })
    expect(String(read.value)).toContain('"seq": 5')
  })

  it('evidence/wiring contradictions THROW at placement (present:true without a facet; present:false WITH one; present:false without the evidence string)', async () => {
    await expect(makeWorld({ searchBackend: { present: true }, provideSearchFacet: false })).rejects.toThrow(/must agree/u)
    const w = await makeWorld()
    const base = {
      realmId: 'r',
      providerId: 'p',
      readNative: (name: string) => w.captured.get(name),
      readCaller: () => ({ id: CALLER_ID, cwd: CWD }),
      teamCeiling: () => true,
    }
    expect(() => S.createG6SessionQueryAdapter({
      ...base,
      queryPorts: { ...w.qp },
      declaredMount: { searchBackend: { present: false, evidence: 'x says absent' } },
    })).toThrow(/contradiction/u)
    expect(() => S.createG6SessionQueryAdapter({
      ...base,
      queryPorts: { traceQueryPort: w.svc, eventReadQueryPort: w.svc, authorizationQueryPort: w.svc, titlesQueryPort: w.svc },
      declaredMount: { searchBackend: { present: false } as Record<string, unknown> },
    })).toThrow(/verbatim deployment evidence/u)
    expect(() => S.createG6SessionQueryAdapter({
      ...base,
      queryPorts: { searchQueryPort: w.svc, traceQueryPort: w.svc, authorizationQueryPort: w.svc, titlesQueryPort: w.svc },
      declaredMount: { searchBackend: { present: true } },
    })).toThrow(/eventReadQueryPort is required/u)
    expect(() => S.createG6SessionQueryAdapter({
      ...base,
      queryPorts: {
        searchQueryPort: w.svc,
        traceQueryPort: { traceSession: async function (sessionId: unknown) { return sessionId }, traceEvent: async function (r: unknown, s?: unknown) { return { r, s } } },
        eventReadQueryPort: w.svc,
        authorizationQueryPort: w.svc,
        titlesQueryPort: w.svc,
      },
      declaredMount: { searchBackend: { present: true } },
    })).toThrow(/2 formal parameters/u)
  })
})

/* ══ 7. RECEIVER-PINNED DISPATCH + PAGING + IDENTITY (fix 5) ══════════════ */
describe('a5m2-g6 receiver-pinned dispatch and pinned-receiver paging', () => {
  it('cursor paging rides the PINNED receiver: the second request carries the cursor on the SAME normalized request, byte-equal to the native oracle', async () => {
    const hitA = { header: { id: 's-a', cwd: CWD, parentSession: 'p-root', createdAt: 4000 }, live: true, persisted: true, bestMatch: { seq: 5, type: 'user/message', time: 3900, surface: 'current', snippet: 'alpha needle' } }
    const hitB = { header: { id: 's-b', cwd: CWD, createdAt: 3000 }, live: true, persisted: true, bestMatch: { seq: 2, type: 'user/message', time: 2900, surface: 'current', snippet: 'beta needle' } }
    const queue = (): Record<string, unknown>[] => JSON.parse(JSON.stringify([
      { items: [hitA], nextCursor: 'c-1' },
      { items: [hitB] },
    ])) as Record<string, unknown>[]
    const w = await makeWorld()
    w.pages.searchSessions.push(...queue())
    const native = await w.nativeCall('session_search', { query: 'needle' })
    w.pages.searchSessions.push(...queue())
    const mark = w.calls.length
    const row = await w.rowCall('session_search', { query: 'needle' })
    expect(row.value).toBe(native.value)
    expect(String(row.value)).toContain('Session search results (2):')
    const searchTuples = w.callsSince(mark).filter((entry) => entry.method === 'searchSessions')
    expect(searchTuples.length).toBe(2)
    const second = searchTuples[1]?.args[0] as Record<string, unknown>
    expect(second['cursor']).toBe('c-1')
    expect(second['query']).toBe('needle')
    expect(second['sessionFilters']).toEqual([{ kind: 'cwd', values: [CWD] }])
  })

  it('the RECEIVER OBJECT moving (same functions, swapped instance) refuses PORT_RECEIVER_MOVED with zero forwarding', async () => {
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
  })

  it('caller drift (workspace move between classify and entry) refuses CALLER_DRIFT with zero forwarding', async () => {
    let flip = 0
    const w = await makeWorld({
      readCallerOverride: () => {
        flip += 1
        if (flip === 1) return { id: CALLER_ID, cwd: CWD, boundary: { lastStepStartSeq: 50 } }
        return { id: CALLER_ID, cwd: '/moved', boundary: { lastStepStartSeq: 50 } }
      },
    })
    const mark = w.calls.length
    const out = await w.rowCall('session_trace', { session_id: 's-a' })
    expect(out.refusal?.['code']).toBe(SC.CALLER_DRIFT)
    expect(w.callsSince(mark).length).toBe(0)
  })

  it('pre-aborted signals and drained rows refuse typed with zero port entry; dispatch facts (portCalls, portMethod) are observable', async () => {
    const w = await makeWorld()
    const controller = new AbortController()
    controller.abort()
    const aborted = await w.adapter.rows['session_trace'].invoke({ session_id: 's-a' }, { signal: controller.signal })
    expect(aborted['code']).toBe(SC.PRE_ABORTED)
    const before = w.calls.length
    await w.adapter.rows['session_trace'].invoke({ session_id: 's-a' }, { signal: new AbortController().signal })
    const facts = w.adapter.rows['session_trace'].lastDispatch()
    expect(facts?.['portMethod']).toBe('traceSession')
    expect((facts?.['portCalls'] as number) ?? 0).toBeGreaterThanOrEqual(1)
    expect(w.calls.length).toBeGreaterThan(before)
    w.adapter.rows['session_trace'].drain()
    expect(w.adapter.rows['session_trace'].draining()).toBe(true)
    const drained = await w.adapter.rows['session_trace'].invoke({ session_id: 's-a' })
    expect(drained['code']).toBe(SC.DRAINING)
  })
})

/* ══ 8. ROW FACTS — captured bytes, closed surface, single residual ═══════ */
describe('a5m2-g6 row facts — five typed rows, captured bytes, evidence mount', () => {
  it('five ACTIVE typed rows (present:true evidence) carry the CAPTURED description bytes + output {type:string}, map to the five real methods, and name ONLY the resource-kind residual', async () => {
    const w = await makeWorld()
    const familyByTool: Record<string, string> = {
      session_search: 'search', session_event_search: 'search', session_trace: 'trace', session_event_trace: 'trace', session_event_read: 'eventRead',
    }
    for (const name of S.A5_G6_TOOL_NAMES) {
      const row = w.adapter.rows[name]
      expect(row.active, name).toBe(true)
      expect(row.captured(), name).toBe(true)
      expect(row.description, `${name} captured bytes`).toBe(DESC[name])
      expect(row.portFamily, name).toBe(familyByTool[name])
      expect(row.mountCondition, name).toBe(familyByTool[name] === 'search' ? 'declared_mount' : 'always')
      expect((row.registrationSchema as { output: unknown }).output, `${name} output`).toEqual({ type: 'string' })
      expect(row.namedBlockers.join('|'), `${name} residual`).toContain('session-history')
      expect(row.namedBlockers.some((blocker) => blocker.includes('TARGET_PREAUTH') || blocker.includes('PARENT_FILTER') || blocker.includes('TITLES_PRESENTATION')), `${name} closed residuals stay closed`).toBe(false)
    }
    expect(w.adapter.rows['session_search'].portMethod).toBe('searchSessions')
    expect(w.adapter.rows['session_event_search'].portMethod).toBe('searchEvents')
    expect(w.adapter.rows['session_trace'].portMethod).toBe('traceSession')
    expect(w.adapter.rows['session_event_trace'].portMethod).toBe('traceEvent')
    expect(w.adapter.rows['session_event_read'].portMethod).toBe('readEvent')
    expect(S.A5_G6_PORT_FAMILIES['authorization']?.facet).toBe('authorizationQueryPort')
    expect(S.A5_G6_PORT_FAMILIES['titles']?.facet).toBe('titlesQueryPort')
    expect(S.A5_G6_PORT_FAMILIES['search']?.required).toBe(false)
    expect(S.A5_G6_ADAPTER_REVISION).toBe(2)
  })

  it('classify stays pure and closed-surface: unknown/missing params refused; effects are the single tool-invoke; the fingerprint is canonical', async () => {
    const w = await makeWorld()
    const unknown = w.adapter.rows['session_trace'].classify({ session_id: 's-a', sneaky: true })
    expect(unknown['code']).toBe(SC.UNKNOWN_PARAMETER)
    const missing = w.adapter.rows['session_event_read'].classify({ session_id: 's-a' })
    expect(missing['code']).toBe(SC.MISSING_PARAMETER)
    const plan = w.adapter.rows['session_trace'].classify({ session_id: 's-a' })
    expect(plan['ok']).toBe(true)
    expect(plan['effects']).toEqual([{ kind: 'tool-invoke', toolName: 'session_trace', resource: null }])
    expect(String(plan['parametersFingerprint'])).toMatch(/^sha256:[0-9a-f]{64}$/u)
    expect(w.calls.length).toBe(0)
  })

  it('a missing native capture refuses NATIVE_FACE_ABSENT (no re-authored schema, no substituted body)', async () => {
    const w = await makeWorld()
    const naked = S.createG6SessionQueryAdapter({
      realmId: 'r',
      providerId: 'p',
      readNative: () => undefined,
      queryPorts: { searchQueryPort: w.svc, traceQueryPort: w.svc, eventReadQueryPort: w.svc, authorizationQueryPort: w.svc, titlesQueryPort: w.svc },
      readCaller: () => ({ id: CALLER_ID, cwd: CWD }),
      teamCeiling: () => true,
      declaredMount: { searchBackend: { present: true } },
    })
    const out = naked.rows['session_trace'].classify({})
    expect(out['code']).toBe(SC.NATIVE_FACE_ABSENT)
    expect(naked.rows['session_trace'].description).toBe(null)
  })

  it('config defects THROW at placement: identity, caller reader, ceiling, and the search arity law', async () => {
    const w = await makeWorld()
    const base: Record<string, unknown> = {
      realmId: 'realm-g6',
      providerId: 'plugin-team-g6',
      readNative: (name: string) => w.captured.get(name),
      queryPorts: { ...w.qp },
      readCaller: () => ({ id: CALLER_ID, cwd: CWD }),
      teamCeiling: () => true,
      declaredMount: { searchBackend: { present: true } },
    }
    expect(() => S.createG6SessionQueryAdapter({ ...base, realmId: '' })).toThrow(TypeError)
    expect(() => S.createG6SessionQueryAdapter({ ...base, readCaller: undefined })).toThrow(TypeError)
    expect(() => S.createG6SessionQueryAdapter({ ...base, teamCeiling: undefined })).toThrow(/teamCeiling/u)
    expect(() => S.createG6SessionQueryAdapter({
      ...base,
      queryPorts: { ...w.qp, searchQueryPort: { ...w.svc, searchSessions: async function (request: unknown) { return request } } },
    })).toThrow(/2 formal parameters/u)
  })
})
