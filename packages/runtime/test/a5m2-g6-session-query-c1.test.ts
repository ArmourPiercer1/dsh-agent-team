/**
 * A5M2-G6-SESSION-QUERY-C1 — the REAL-QUERY ADAPTER for the five host
 * session-intelligence tools (g6-session-query.mjs). Two classes of legs:
 *
 *  (1) INTERFACE AUDIT over the pinned 639ed01539 pristine checkout
 *      (tests/paths.mjs is the unique path/pin source):
 *    - the REAL built tool plugin (@deepseek-ai/dsh-tool-session-query
 *      lib/index.js) is EXECUTED (apply() over a capture ctx) so the five
 *      native faces enter the audit as the REAL defineTool products: pinned
 *      description bytes, COMPILED parameter JSON Schema accepted by the
 *      REAL host validator (assertSupportedJsonSchema /
 *      validateJsonSchemaValue, the r9 idiom of a5m2-g2-connector-adapters);
 *    - the cited canonical schema lines (input.ts, operations.ts,
 *      session-query/src/index.ts + types.ts + cursor.ts + config.ts,
 *      workspace-access.ts, service-boundary.ts, session-query-sqlite,
 *      core/tools/src/schema.ts) are TEXT-PINNED;
 *    - the abstract-vs-concrete service split is PROVEN at runtime on the
 *      built @deepseek-ai/dsh-session-query lib: searchSessions/searchEvents
 *      are ABSENT on the SessionQueryEngine prototype (backend law,
 *      index.ts:91-97/:153-167/:164-167) while traceSession/traceEvent/
 *      readEvent are concrete 2-formal methods (:327-361).
 *  (2) ADAPTER + DELEGATION legs: five typed rows carrying the captured
 *      native description bytes; per-family typed ports (search vs trace vs
 *      event-read) recording EXACT call tuples; declared_mount INACTIVE
 *      search rows with the verbatim blocker; per-dispatch port-identity
 *      re-verification; the caller/workspace/step-boundary laws mirrored
 *      from operations.ts. The FAKE PORT is a test-owned double — these
 *      legs are NOT real-Service proof and the module is UNWIRED (tier:
 *      未接线; the delegation legs are 已测试 legs OVER DOUBLES, and
 *      assembly/in-process dimensions are never claimed 已测试).
 *
 * Scope: NO Host boot, NO network, NO :3080/:3180. Red-on-removal: the
 * delegation tuples go RED if the delegation or the mirrored laws are
 * removed; the audit legs go RED if the 639 surfaces move.
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

const S = (await import(new URL('../src/plugin/live/governed-families/g6-session-query.mjs', import.meta.url).href)) as {
  A5_G6_ADAPTER_REVISION: number
  A5_G6_FAMILY: string
  A5_G6_TOOL_NAMES: string[]
  A5_G6_PORT_FAMILIES: Record<string, { facet: string, methods: string[], arity: number, law: string }>
  A5_G6_TYPED_CODES: Record<string, string>
  A5_G6_NAMED_BLOCKERS: Record<string, string>
  A5_G6_DRAIN_SEMANTICS: string
  createG6SessionQueryAdapter: (deps: Record<string, unknown>) => G6Adapter
}
const SC = S.A5_G6_TYPED_CODES

/* ── typed doubles ──────────────────────────────────────────────────────── */
interface Tuple { method: string, args: unknown[] }
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
interface G6Adapter {
  adapterRevision: number
  familyId: string
  rows: Record<string, G6Row>
  namedBlockers: Record<string, string>
}
interface NativeFace {
  name: string
  description: string
  parameters: Record<string, unknown>
  output?: { schema?: unknown }
  execute: unknown
  [key: string]: unknown
}

/* ── the REAL 639 captured faces (the built plugin's apply() executed) ──── */
async function loadRealFaces (): Promise<Record<string, NativeFace>> {
  const libPath = join(HOST, 'packages', 'session-query', 'tool-session-query', 'lib', 'index.js')
  if (!existsSync(libPath)) throw new Error(`pristine host tool lib absent (${libPath}); failing closed`)
  const mod = (await import(pathToFileURL(libPath).href)) as {
    name: string
    inject: string[]
    DEFAULT_MAX_SEARCH_RESULTS: number
    apply: (ctx: unknown, config: Record<string, unknown>) => void
  }
  expect(mod.name).toBe('tool-session-query')
  expect(mod.inject).toEqual(['tools', 'systemPrompt', 'sessionQuery', 'sessionProjections'])
  expect(mod.DEFAULT_MAX_SEARCH_RESULTS).toBe(100)
  const captured: Record<string, NativeFace> = {}
  const order: string[] = []
  const ctx = {
    tools: { register: (tool: NativeFace) => { captured[tool.name] = tool; order.push(tool.name); return () => {} } },
    systemPrompt: { section: () => {}, getSectionOrder: () => 0 },
  }
  mod.apply(ctx, {})
  expect(order).toEqual(['session_search', 'session_event_search', 'session_trace', 'session_event_trace', 'session_event_read'])
  return captured
}

async function loadHostTools (): Promise<{
  assertSupportedJsonSchema: (schema: unknown) => void
  validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
}> {
  const libPath = join(HOST, 'packages', 'core', 'tools', 'lib', 'index.js')
  if (!existsSync(libPath)) throw new Error(`pristine host core/tools lib absent (${libPath}); failing closed`)
  return (await import(pathToFileURL(libPath).href)) as unknown as {
    assertSupportedJsonSchema: (schema: unknown) => void
    validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
  }
}

/* ── text pin against the cited canonical lines ─────────────────────────── */
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

/* ── fake ports recording EXACT call tuples (test-owned doubles) ────────── */
interface FakePorts {
  ports: Record<string, Record<string, unknown>>
  calls: Tuple[]
  searchSessionsPages: Array<Record<string, unknown>>
  searchEventsPages: Array<Record<string, unknown>>
  traceValue: Record<string, unknown> | Error
  eventTraceValue: Record<string, unknown> | Error
  readValue: Record<string, unknown> | Error
}
function makePorts (): FakePorts {
  const calls: Tuple[] = []
  const f: FakePorts = {
    calls,
    ports: {},
    searchSessionsPages: [],
    searchEventsPages: [],
    traceValue: {},
    eventTraceValue: {},
    readValue: {},
  }
  f.ports.searchQueryPort = {
    searchSessions: async function (request: unknown, exec: unknown) {
      calls.push({ method: 'searchSessions', args: [request, exec] })
      const page = f.searchSessionsPages.shift()
      if (page === undefined) throw new Error('fake searchSessions over-served')
      return page
    },
    searchEvents: async function (request: unknown, exec: unknown) {
      calls.push({ method: 'searchEvents', args: [request, exec] })
      const page = f.searchEventsPages.shift()
      if (page === undefined) throw new Error('fake searchEvents over-served')
      return page
    },
  }
  f.ports.traceQueryPort = {
    traceSession: async function (sessionId: unknown, signal: unknown) {
      calls.push({ method: 'traceSession', args: [sessionId, signal] })
      if (f.traceValue instanceof Error) throw f.traceValue
      return f.traceValue
    },
    traceEvent: async function (request: unknown, signal: unknown) {
      calls.push({ method: 'traceEvent', args: [request, signal] })
      if (f.eventTraceValue instanceof Error) throw f.eventTraceValue
      return f.eventTraceValue
    },
  }
  f.ports.eventReadQueryPort = {
    readEvent: async function (request: unknown, signal: unknown) {
      calls.push({ method: 'readEvent', args: [request, signal] })
      if (f.readValue instanceof Error) throw f.readValue
      return f.readValue
    },
  }
  return f
}

const CALLER_ID = 'sess-caller-1'
const CWD = '/work/repo'
function makeCaller () {
  return { id: CALLER_ID, cwd: CWD, boundary: { lastStepStartSeq: 50 } }
}

let realFaces: Record<string, NativeFace> | null = null
async function faces (): Promise<Record<string, NativeFace>> {
  if (realFaces === null) realFaces = await loadRealFaces()
  return realFaces
}

interface AdapterBundle { adapter: G6Adapter, ports: FakePorts, facets: Record<string, Record<string, unknown>>, caller: { value: Record<string, unknown> }, calls: Tuple[] }
function buildAdapter (opts: {
  declared?: boolean,
  callerOverride?: () => Record<string, unknown> | undefined,
  maxSearchResults?: number,
  readNativeOverride?: (name: string) => unknown,
} = {}): AdapterBundle {
  const ports = makePorts()
  const callerHolder = { value: makeCaller() as Record<string, unknown> }
  const adapter = S.createG6SessionQueryAdapter({
    realmId: 'realm-g6',
    providerId: 'plugin-team-g6',
    readNative: (opts.readNativeOverride ?? ((name: string) => realFaces?.[name])) as (name: string) => NativeFace,
    queryPorts: ports.ports,
    readCaller: opts.callerOverride ?? (() => callerHolder.value),
    ...(opts.declared === false ? {} : { declaredMount: { searchBackend: { present: true } } }),
    ...(opts.maxSearchResults === undefined ? {} : { maxSearchResults: opts.maxSearchResults }),
  })
  return { adapter, ports, facets: ports.ports, caller: callerHolder, calls: ports.calls }
}

const hdr = (id: string, cwd: string | undefined): Record<string, unknown> => ({
  ...(cwd === undefined ? {} : { cwd }),
  id,
})
const hit = (id: string, cwd: string): Record<string, unknown> => ({
  header: hdr(id, cwd),
  live: true,
  persisted: false,
  bestMatch: { sessionId: id, seq: 3, type: 'agent_message', time: 1730000000000, surface: 'current', snippet: 'match' },
})

const DESC: Record<string, string> = {
  session_search: 'Search prior sessions in the caller workspace and return the strongest matching event from each session.',
  session_event_search: 'Search prior events in one authorized session; the current session excludes the step performing this call.',
  session_trace: 'Read the authorized session lineage around one session, including complete visible ancestor and descendant relationships.',
  session_event_trace: 'Read every direct replacement and relationship to a cited source event for one event in an authorized session.',
  session_event_read: 'Read one full unabridged event and optional neighboring raw-event summaries from an authorized session.',
}

/* ══ 1. INTERFACE AUDIT — the REAL 639 facts ══════════════════════════════ */
describe('a5m2-g6 interface audit — pinned baseline + REAL tool surface', () => {
  it('the checkout pin the audit speaks for is the 639ed01539 / 0.2.0-rc.2 baseline (tests/paths.mjs is the unique source)', () => {
    expect(TEST_USE_BASELINE_SHA).toBe('639ed015397290b3745d163aafe02ffee4aa3f84')
    expect(DSH_BASELINE_VERSION).toBe('0.2.0-rc.2')
    const pkg = JSON.parse(readFileSync(join(HOST, 'package.json'), 'utf8')) as { version: string }
    expect(pkg.version).toBe(DSH_BASELINE_VERSION)
  })

  it('the REAL built plugin registers EXACTLY the five tools with pinned description bytes and compiled parameters the REAL host validator accepts', async () => {
    const captured = await faces()
    const host = await loadHostTools()
    expect(Object.keys(captured)).toEqual(S.A5_G6_TOOL_NAMES)
    const expectedProperties: Record<string, string[]> = {
      session_search: ['query', 'session_ids', 'created_at_from', 'created_at_to', 'parent_session_ids', 'include_root_sessions', 'availability', 'event_seq_from', 'event_seq_to', 'event_time_from', 'event_time_to', 'event_types', 'event_surfaces'],
      session_event_search: ['session_id', 'query', 'seq_from', 'seq_to', 'time_from', 'time_to', 'event_types', 'surfaces'],
      session_trace: ['session_id'],
      session_event_trace: ['session_id', 'seq'],
      session_event_read: ['session_id', 'seq', 'before', 'after'],
    }
    const expectedRequired: Record<string, string[]> = {
      session_search: ['query'],
      session_event_search: ['query'],
      session_trace: [],
      session_event_trace: ['seq'],
      session_event_read: ['seq'],
    }
    for (const name of S.A5_G6_TOOL_NAMES) {
      const tool = captured[name]
      expect(tool.description, `${name} description bytes`).toBe(DESC[name])
      // the compiled product: object root with properties; parent required
      // array; NO surviving property-level `required: true` marker.
      const params = tool.parameters as { type: string, properties: Record<string, Record<string, unknown>>, required?: string[] }
      expect(params.type, `${name} root`).toBe('object')
      expect(Object.keys(params.properties), `${name} properties`).toEqual(expectedProperties[name])
      expect(params.required ?? [], `${name} required`).toEqual(expectedRequired[name])
      for (const [prop, spec] of Object.entries(params.properties)) {
        expect(spec.required, `${name}.${prop} compiled marker`).toBeUndefined()
      }
      expect(() => host.assertSupportedJsonSchema(tool.parameters), `${name} host validator`).not.toThrow()
      // the host's OWN execute-time validator enforces the same required law
      if (expectedRequired[name].length > 0) {
        expect(host.validateJsonSchemaValue(tool.parameters, {}, '').join(';'), `${name} missing-required`).toMatch(expectedRequired[name][0])
      } else {
        expect(host.validateJsonSchemaValue(tool.parameters, {}, '')).toEqual([])
      }
    }
    // pinned canonical lines behind the parameter DSL (input.ts) and the lift
    pinBlock('session-query/tool-session-query/src/index.ts', 65, 73, ["name: 'session_search'", 'parameters: toolInput.sessionSearchParameters', 'operations.executeSessionSearch'])
    pinBlock('session-query/tool-session-query/src/index.ts', 75, 83, ["name: 'session_event_search'", 'parameters: toolInput.eventSearchParameters', 'operations.executeEventSearch'])
    pinBlock('session-query/tool-session-query/src/index.ts', 85, 93, ["name: 'session_trace'", 'parameters: toolInput.targetSessionParameter', 'operations.executeSessionTrace'])
    pinBlock('session-query/tool-session-query/src/index.ts', 95, 106, ["name: 'session_event_trace'", "seq: { type: 'integer', required: true", 'operations.executeEventTrace'])
    pinBlock('session-query/tool-session-query/src/index.ts', 108, 121, ["name: 'session_event_read'", "before: { type: 'integer'", "after: { type: 'integer'", 'operations.executeEventRead'])
    pinBlock('session-query/tool-session-query/src/index.ts', 46, 49, ["schema: { type: 'string' as const }"])
    pinBlock('session-query/tool-session-query/src/input.ts', 45, 67, [
      "query: { type: 'string', required: true", "availability:", "items: { type: 'string', enum: ['live', 'persisted'] }", "enum: ['current', 'shadowed', 'log-only']",
    ])
    pinBlock('session-query/tool-session-query/src/input.ts', 69, 86, ["session_id: { type: 'string', description: 'Target session id. Omit for the current session.' }"])
    pinBlock('core/tools/src/schema.ts', 449, 458, ['export function parameterSchemaSpecToJsonSchema', 'assertSupportedJsonSchema(schema)'])
    pinBlock('core/tools/src/schema.ts', 554, 601, ['export function defineTool', 'parameterSchemaSpecToJsonSchema(options.parameters)', 'const violations = validate(args)'])
    pinBlock('core/tools/src/json-schema.ts', 385, 385, ['export function assertSupportedJsonSchema'])
  })

  it('the canonical RESULT lines the adapter pins are the ones cited (session-query/src/types.ts ranges + cursor/config)', () => {
    pinBlock('session-query/session-query/src/types.ts', 24, 24, ["export type SessionEventSurface = 'current' | 'shadowed' | 'log-only'"])
    pinBlock('session-query/session-query/src/types.ts', 27, 34, ['export interface SessionRecord', 'header: SessionHeader', 'live: boolean', 'persisted: boolean'])
    pinBlock('session-query/session-query/src/types.ts', 73, 78, ['export interface SessionLineageNode', 'session: SessionRecord', 'descendants: SessionLineageNode[]'])
    pinBlock('session-query/session-query/src/types.ts', 81, 101, ['export type SessionLineageTrace', 'target: SessionRecord', 'ancestors: SessionRecord[]', 'descendants: SessionLineageNode[]', 'complete: true', 'complete: false', 'unresolvedParentId: SessionId'])
    pinBlock('session-query/session-query/src/types.ts', 104, 109, ['export interface SessionEventTraceRequest', 'sessionId: SessionId', 'seq: SessionSeq'])
    pinBlock('session-query/session-query/src/types.ts', 112, 125, ['export interface SessionEventTrace', 'target: SessionEventRecord', 'replacementChain: SessionSeq[]', 'replacedEventSeqs: SessionSeq[]', 'sourceEventSeqs: SessionSeq[]', 'derivedEventSeqs: SessionSeq[]'])
    pinBlock('session-query/session-query/src/types.ts', 128, 131, ['export interface SessionEventTraceObservation extends SessionEventTrace', 'session: SessionHeader'])
    pinBlock('session-query/session-query/src/types.ts', 134, 143, ['export interface SessionEventReadRequest', 'before?: number', 'after?: number'])
    pinBlock('session-query/session-query/src/types.ts', 146, 159, ['export interface SessionEventWindow', 'session: SessionHeader', 'target: SessionEvent', 'events: SessionEvent[]', 'startSeq: SessionSeq', 'endSeq: SessionSeq'])
    pinBlock('session-query/session-query/src/types.ts', 203, 208, ["{ kind: 'id'; values: readonly SessionId[] }", "{ kind: 'cwd'; values: readonly (string | null)[] }", "{ kind: 'created-at' }", "{ kind: 'parent'; values: readonly (SessionId | null)[] }", "{ kind: 'availability'; values: readonly SessionAvailability[] }"])
    pinBlock('session-query/session-query/src/types.ts', 214, 222, ["{ kind: 'seq' }", "{ kind: 'time' }", "{ kind: 'type'; values: readonly SessionEventType[] }", "{ kind: 'surface'; values: readonly SessionEventSurface[] }"])
    pinBlock('session-query/session-query/src/types.ts', 231, 242, ['export interface SessionSearchPage<T>', 'items: readonly T[]', 'nextCursor?: SessionSearchCursor', 'export interface SessionEventSearchPage extends SessionSearchPage<SessionEventSearchHit>', 'session: SessionHeader'])
    pinBlock('session-query/session-query/src/types.ts', 245, 262, ['export interface SessionSearchExecContext', 'signal?: AbortSignal', 'export interface SessionSearchRequest', 'query: string', 'sessionFilters?: readonly SessionResultFilter[]', 'eventFilters?: readonly SessionEventMetadataFilter[]'])
    pinBlock('session-query/session-query/src/types.ts', 265, 276, ['export interface SessionEventSearchRequest', 'sessionId: SessionId', 'filters?: readonly SessionEventMetadataFilter[]'])
    pinBlock('session-query/session-query/src/types.ts', 279, 288, ['export interface SessionEventSearchHit extends SessionEventRecord', 'snippet: string', 'export interface SessionSearchHit extends SessionRecord', 'bestMatch: SessionEventSearchHit'])
    pinBlock('session-query/session-query/src/cursor.ts', 6, 6, ["export type SessionSearchCursor = Branded<'SessionSearchCursor'>"])
    pinBlock('session-query/session-query/src/config.ts', 6, 6, ['export const SESSION_QUERY_READ_WINDOW_MAX = 50'])
    pinBlock('session-query/session-query/src/config.ts', 49, 54, ['export class SessionQueryError extends HarnessError'])
  })

  it('the REAL service definition: search is the ABSTRACT backend-composed family, trace/event-read are CONCRETE — proven on source AND on the built lib prototype', async () => {
    pinBlock('session-query/session-query/src/index.ts', 85, 99, ['interface Context {', 'sessionQuery: SessionQueryEngine', 'export abstract class SessionQueryEngine extends Service', "static inject = ['sessions']"])
    pinBlock('session-query/session-query/src/index.ts', 91, 97, ['Exact reads, filters, and traces are backend-independent concrete behavior', 'A backend implements full-text observation'])
    pinBlock('session-query/session-query/src/index.ts', 153, 156, ['abstract searchSessions(', 'request: SessionSearchRequest,', 'exec?: SessionSearchExecContext,'])
    pinBlock('session-query/session-query/src/index.ts', 164, 167, ['abstract searchEvents(', 'request: SessionEventSearchRequest,'])
    pinBlock('session-query/session-query/src/index.ts', 327, 331, ['async traceSession(sessionId: SessionId, signal?: AbortSignal): Promise<SessionLineageTrace>'])
    pinBlock('session-query/session-query/src/index.ts', 340, 347, ['async traceEvent(request: SessionEventTraceRequest, signal?: AbortSignal): Promise<SessionEventTraceObservation>'])
    pinBlock('session-query/session-query/src/index.ts', 355, 361, ['async readEvent(request: SessionEventReadRequest, signal?: AbortSignal): Promise<SessionEventWindow>'])
    pinBlock('session-query/session-query/src/index.ts', 206, 212, ['async filterSessions('])
    pinBlock('session-query/session-query-sqlite/src/index.ts', 203, 203, ['export class SqliteSessionQueryEngine extends SessionQueryEngine'])
    pinBlock('session-query/session-query-sqlite/src/index.ts', 268, 296, ['override async searchSessions(', 'override async searchEvents('])
    pinBlock('session-query/tool-session-query/src/service-boundary.ts', 74, 77, ['SESSION_QUERY_SEARCH_DISABLED', 'session search is disabled in this deployment'])

    const libPath = join(HOST, 'packages', 'session-query', 'session-query', 'lib', 'index.js')
    if (!existsSync(libPath)) throw new Error(`pristine session-query lib absent (${libPath}); failing closed`)
    const m = (await import(pathToFileURL(libPath).href)) as { SessionQueryEngine: { inject: string[], prototype: Record<string, unknown> } }
    const proto = m.SessionQueryEngine.prototype
    expect(m.SessionQueryEngine.inject).toEqual(['sessions'])
    // ABSTRACT at the pin: no runtime implementation stands on the prototype.
    expect(proto['searchSessions']).toBeUndefined()
    expect(proto['searchEvents']).toBeUndefined()
    // CONCRETE: real two-formal signatures (the optional exec/signal half is
    // part of the declared face the port mirrors VERBATIM).
    for (const [method, arity] of [['traceSession', 2], ['traceEvent', 2], ['readEvent', 2], ['filterSessions', 2]] as const) {
      expect(typeof proto[method], `${method} concrete`).toBe('function')
      expect((proto[method] as { length: number }).length, `${method} arity`).toBe(arity)
    }
  })

  it('the delegation laws the rows mirror are the cited operations.ts / workspace-access.ts / input.ts lines', () => {
    pinBlock('session-query/tool-session-query/src/operations.ts', 55, 115, [
      'caller.header.cwd', 'SESSION_QUERY_TOOL_UNAUTHORIZED', "sessionFilters.push({ kind: 'cwd', values: [cwd] })",
      'ctx.sessionQuery.searchSessions(', 'hit.header.id !== caller.id && workspaceAccess.recordAuthorized(hit, caller)',
    ])
    pinBlock('session-query/tool-session-query/src/operations.ts', 79, 89, ['materializeParentSessionIds', 'authorizeSessionIds', "sessionFilters.push({ kind: 'parent', values: parentValues })"])
    pinBlock('session-query/tool-session-query/src/operations.ts', 117, 169, [
      'ctx.sessionQuery.searchEvents({', 'SESSION_QUERY_TOOL_NO_CURRENT_STEP', 'range.to ?? Number.MAX_SAFE_INTEGER',
      'workspaceAccess.assertObservedTargetAuthorized(caller, sessionId, page.session)',
    ])
    pinBlock('session-query/tool-session-query/src/operations.ts', 171, 218, [
      'ctx.sessionQuery.traceSession(sessionId, exec.signal)', 'workspaceAccess.recordAuthorized(ancestor, caller)',
      'trace.complete', 'workspaceAccess.authorizeDescendants(trace.descendants, caller)',
      'ctx.sessionQuery.traceEvent({ sessionId, seq }, exec.signal)',
    ])
    pinBlock('session-query/tool-session-query/src/operations.ts', 220, 277, [
      "toolInput.assertNonNegativeSafeInteger('before', args.before)", "toolInput.assertNonNegativeSafeInteger('after', args.after)",
      'ctx.sessionQuery.readEvent({', 'repeated a continuation cursor',
    ])
    pinBlock('session-query/tool-session-query/src/workspace-access.ts', 56, 109, [
      'function callerOf(', 'agent.session.id', "stateOf(agent.session, 'turnBoundary')",
      'args.session_id === undefined ? caller.id', 'ctx.sessionQuery.filterSessions([',
      'return caller.header.cwd !== undefined && header.cwd === caller.header.cwd',
      'observed.id !== target || !headerAuthorized(observed, caller)',
    ])
    pinBlock('session-query/tool-session-query/src/input.ts', 126, 141, ["'\\0'", 'must contain non-whitespace text'])
    pinBlock('session-query/tool-session-query/src/input.ts', 179, 180, ['const ISO_TIMESTAMP ='])
    pinBlock('session-query/tool-session-query/src/input.ts', 278, 294, ['must be a non-negative safe integer', 'must contain at least one value when supplied'])
  })
})

/* ══ 2. MOUNT LAW — typed rows, captured bytes, declared_mount INACTIVE ══ */
describe('a5m2-g6 mount law — five typed rows over three typed port families', () => {
  it('config defects THROW at placement: every facet, method, and mirrored 2-formal arity is required', async () => {
    await faces()
    const base = () => ({
      realmId: 'realm-g6',
      providerId: 'plugin-team-g6',
      readNative: (name: string) => (await0(realFaces))[name],
      queryPorts: makePorts().ports,
      readCaller: () => makeCaller(),
    })
    expect(() => S.createG6SessionQueryAdapter({ ...base(), realmId: '' })).toThrow(TypeError)
    expect(() => S.createG6SessionQueryAdapter({ ...base(), readNative: undefined })).toThrow(TypeError)
    expect(() => S.createG6SessionQueryAdapter({ ...base(), readCaller: undefined })).toThrow(TypeError)
    expect(() => S.createG6SessionQueryAdapter({ ...base(), maxSearchResults: 0 })).toThrow(TypeError)
    const noRead: Record<string, Record<string, unknown>> = { ...base().queryPorts }
    delete noRead['eventReadQueryPort']
    expect(() => S.createG6SessionQueryAdapter({ ...base(), queryPorts: noRead })).toThrow(/eventReadQueryPort/)
    const shortArity: Record<string, Record<string, unknown>> = { ...base().queryPorts }
    shortArity['traceQueryPort'] = { traceSession: async function (sessionId: unknown) { return sessionId }, traceEvent: async function (r: unknown, s?: unknown) { return { r, s } } }
    expect(() => S.createG6SessionQueryAdapter({ ...base(), queryPorts: shortArity })).toThrow(/2 formal parameters/)
  })

  it('without the declared search backend the two SEARCH rows stay honest INACTIVE (verbatim blocker, zero port entry); the three concrete rows mount (always)', async () => {
    await faces()
    const b = buildAdapter({ declared: false })
    expect(b.adapter.rows['session_search'].active).toBe(false)
    expect(b.adapter.rows['session_event_search'].active).toBe(false)
    expect(b.adapter.rows['session_search'].mountCondition).toBe('declared_mount')
    for (const name of ['session_trace', 'session_event_trace', 'session_event_read']) {
      expect(b.adapter.rows[name].active, name).toBe(true)
      expect(b.adapter.rows[name].mountCondition, name).toBe('always')
    }
    const classified = await b.adapter.rows['session_search'].classify({ query: 'anything' })
    expect(classified['ok']).toBe(false)
    expect(classified['code']).toBe(SC.DECLARED_MOUNT_ABSENT)
    expect(String(classified['detail'])).toContain(S.A5_G6_NAMED_BLOCKERS.SEARCH_BACKEND)
    expect(String(classified['detail'])).toContain('session-query/src/index.ts:153-156')
    const invoked = await b.adapter.rows['session_event_search'].invoke({ query: 'anything' })
    expect(invoked['ok']).toBe(false)
    expect(invoked['code']).toBe(SC.DECLARED_MOUNT_ABSENT)
    expect(b.calls.length).toBe(0) // nothing substitutes
  })

  it('with the declaration all five rows are active and carry the CAPTURED native bytes: description verbatim, compiled registration face, {type:string} output schema, port-family binding', async () => {
    const captured = await faces()
    const b = buildAdapter()
    expect(Object.keys(b.adapter.rows)).toEqual(S.A5_G6_TOOL_NAMES)
    const familyByTool: Record<string, string> = {
      session_search: 'search', session_event_search: 'search', session_trace: 'trace', session_event_trace: 'trace', session_event_read: 'eventRead',
    }
    for (const name of S.A5_G6_TOOL_NAMES) {
      const row = b.adapter.rows[name]
      expect(row.active, name).toBe(true)
      expect(row.captured(), name).toBe(true)
      expect(row.description, `${name} bytes`).toBe(captured[name].description)
      expect(row.description, `${name} pinned bytes`).toBe(DESC[name])
      const face = row.registrationSchema as { parameters: Record<string, unknown>, output: Record<string, unknown> }
      const compiled = captured[name].parameters as Record<string, unknown>
      expect(face.parameters['properties'], `${name} properties carried verbatim`).toEqual(compiled['properties'])
      expect(face.parameters['additionalProperties'], `${name} closed surface`).toBe(false)
      expect(face.output, `${name} output schema`).toEqual({ type: 'string' }) // TEXT_OUTPUT @index.ts:46-49
      expect(row.portFamily, name).toBe(familyByTool[name])
      expect(row.namedBlockers.join('|'), `${name} titles/presentation residual`).toContain('readTitleSnapshots')
      expect(row.namedBlockers.join('|'), `${name} pre-auth residual`).toContain('filterSessions')
    }
    expect(b.adapter.rows['session_search'].portMethod).toBe('searchSessions')
    expect(b.adapter.rows['session_event_search'].portMethod).toBe('searchEvents')
    expect(b.adapter.rows['session_trace'].portMethod).toBe('traceSession')
    expect(b.adapter.rows['session_event_trace'].portMethod).toBe('traceEvent')
    expect(b.adapter.rows['session_event_read'].portMethod).toBe('readEvent')
    // the two search rows additionally carry the SEARCH_BACKEND + PARENT blockers
    expect(b.adapter.rows['session_search'].namedBlockers.some((x) => x.includes('ABSTRACT full-text'))).toBe(true)
    expect(b.adapter.rows['session_search'].namedBlockers.some((x) => x.includes('authorizeSessionIds'))).toBe(true)
    expect(b.adapter.rows['session_trace'].namedBlockers.some((x) => x.includes('ABSTRACT full-text'))).toBe(false)
  })

  it('a missing native capture refuses typed at call time (NATIVE_FACE_ABSENT) — the row NEVER re-authors a schema or a body', async () => {
    const b = buildAdapter({ readNativeOverride: () => undefined })
    const row = b.adapter.rows['session_trace']
    expect(row.captured()).toBe(false)
    expect(row.description).toBeNull()
    const plan = row.classify({})
    expect(plan['ok']).toBe(false)
    expect(plan['code']).toBe(SC.NATIVE_FACE_ABSENT)
    const invoked = await row.invoke({})
    expect(invoked['code']).toBe(SC.NATIVE_FACE_ABSENT)
    expect(b.calls.length).toBe(0)
  })

  it('the ROW face is stricter than the host root: the host validator ACCEPTS the governed face and its additionalProperties:false rejects unknown model keys the open host root would admit', async () => {
    await faces()
    const host = await loadHostTools()
    const b = buildAdapter()
    const face = b.adapter.rows['session_search'].registrationSchema as { parameters: Record<string, unknown> }
    expect(() => host.assertSupportedJsonSchema(face.parameters)).not.toThrow()
    expect(host.validateJsonSchemaValue(face.parameters, { query: 'x' }, '')).toEqual([])
    expect(host.validateJsonSchemaValue(face.parameters, { query: 'x', sneaky: 1 }, '').join(';')).not.toBe('')
    // the CAPTURED host root itself is open there — the closed surface is the
    // governed row's own law, proven against the same REAL validator.
    const captured = await faces()
    expect(host.validateJsonSchemaValue(captured['session_search'].parameters, { query: 'x', sneaky: 1 }, '')).toEqual([])
  })
})

function await0 (faces: Record<string, NativeFace> | null): Record<string, NativeFace> {
  if (faces === null) throw new Error('faces not loaded')
  return faces
}

/* ══ 3. CLOSED SURFACE + mirrored argument laws ═══════════════════════════ */
describe('a5m2-g6 classify — closed captured surface + the tool body argument laws', () => {
  async function rowOf (name: string): Promise<{ row: G6Row, calls: Tuple[] }> {
    await faces()
    const b = buildAdapter()
    return { row: b.adapter.rows[name], calls: b.calls }
  }

  it('unknown parameters and missing required parameters refuse against the CAPTURED schema (typed, zero port entry)', async () => {
    const { row, calls } = await rowOf('session_search')
    expect(row.classify({ query: 'x', nope: 1 })['code']).toBe(SC.UNKNOWN_PARAMETER)
    expect(row.classify({})['code']).toBe(SC.MISSING_PARAMETER)
    expect(row.classify('nope')['code']).toBe(SC.INVALID_ARGUMENTS)
    const et = (await rowOf('session_event_trace')).row
    expect(et.classify({ session_id: 's' })['code']).toBe(SC.MISSING_PARAMETER)
    expect(et.classify({ seq: 1, bogus: true })['code']).toBe(SC.UNKNOWN_PARAMETER)
    expect(calls.length).toBe(0)
  })

  it('query/enum/range/timestamp/seq laws mirror input.ts (typed refusals)', async () => {
    const search = (await rowOf('session_search')).row
    expect(search.classify({ query: '   ' })['code']).toBe(SC.INVALID_QUERY)
    expect(search.classify({ query: 'a\0b' })['code']).toBe(SC.INVALID_QUERY)
    expect(search.classify({ query: 'ok', session_ids: [] })['code']).toBe(SC.INVALID_FILTER)
    expect(search.classify({ query: 'ok', event_seq_from: 9, event_seq_to: 2 })['code']).toBe(SC.INVALID_FILTER)
    expect(search.classify({ query: 'ok', event_seq_from: -1 })['code']).toBe(SC.INVALID_FILTER)
    expect(search.classify({ query: 'ok', created_at_from: '2026-13-01T00:00:00Z' })['code']).toBe(SC.INVALID_FILTER)
    expect(search.classify({ query: 'ok', created_at_from: '2026-10-01T00:00:00Z', created_at_to: '2026-09-01T00:00:00Z' })['code']).toBe(SC.INVALID_FILTER)
    expect(search.classify({ query: 'ok', availability: ['kind-of'] })['code']).toBe(SC.INVALID_FILTER)
    expect(search.classify({ query: 'ok', event_surfaces: ['bogus'] })['code']).toBe(SC.INVALID_FILTER)
    // the valid ISO lane passes and normalizes (leg below proves the tuple)
    expect(search.classify({ query: 'ok', created_at_from: '2026-10-01T00:00:00Z' })['ok']).toBe(true)
    const read = (await rowOf('session_event_read')).row
    expect(read.classify({ seq: -3 })['code']).toBe(SC.INVALID_FILTER)
    expect(read.classify({ seq: 1.5 })['code']).toBe(SC.INVALID_FILTER)
    expect(read.classify({ seq: 1, before: -2 })['code']).toBe(SC.INVALID_FILTER)
    expect(read.classify({ seq: 1, after: 2 })['ok']).toBe(true)
  })

  it('the session_search PARENT LANE refuses typed (PARENT_FILTER_UNAUTHORIZABLE) with ZERO port entry — an un-authorized parent filter is never projected', async () => {
    await faces()
    const b = buildAdapter()
    const refused = b.adapter.rows['session_search'].classify({ query: 'q', parent_session_ids: ['p1'] })
    expect(refused['code']).toBe(SC.PARENT_FILTER_UNAUTHORIZABLE)
    expect(String(refused['detail'])).toContain('authorizeSessionIds')
    const invoked = await b.adapter.rows['session_search'].invoke({ query: 'q', include_root_sessions: true })
    expect(invoked['code']).toBe(SC.PARENT_FILTER_UNAUTHORIZABLE)
    expect(b.calls.length).toBe(0)
  })

  it('classify is pure over args + injected caller facts: it answers the effects set (closed tool-invoke grammar) + target manifest + fingerprint', async () => {
    await faces()
    const b = buildAdapter()
    const plan = b.adapter.rows['session_trace'].classify({ session_id: 's9' })
    expect(plan['ok']).toBe(true)
    expect(plan['effects']).toEqual([{ kind: 'tool-invoke', toolName: 'session_trace', resource: null }])
    const manifest = plan['targetManifest'] as Record<string, unknown>
    expect(manifest['effectiveTargetSessionId']).toBe('s9')
    expect(manifest['callerWorkspaceCwd']).toBe(CWD)
    expect(String(plan['parametersFingerprint'])).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(b.calls.length).toBe(0)
  })
})

/* ══ 4. DELEGATION over fake ports recording exact tuples ═════════════════ */
describe('a5m2-g6 delegation — exact tuples to the typed port per family', () => {
  const signal = new AbortController().signal

  it('session_search: searchSessions gets ONE typed request — normalized query, model filters, caller-cwd clause pushed LAST, eventFilters always present — and the per-hit accept filter excludes the caller and foreign workspaces', async () => {
    await faces()
    const b = buildAdapter()
    b.ports.searchSessionsPages.push({
      items: [hit(CALLER_ID, CWD), hit('sess-other-ws', '/elsewhere'), hit('sess-a', CWD), hit('sess-b', CWD)],
    })
    const out = await b.adapter.rows['session_search'].invoke(
      { query: '  hello   world ', session_ids: ['sess-a'], event_seq_from: 5, event_types: ['agent_message'] },
      { signal },
    )
    expect(out['ok']).toBe(true)
    expect(b.calls.length).toBe(1)
    const { method, args } = b.calls[0]
    expect(method).toBe('searchSessions')
    expect(args[1]).toEqual({ signal }) // SessionSearchExecContext {signal} — @types.ts:245-248
    expect(args[0]).toEqual({
      query: 'hello world',
      sessionFilters: [
        { kind: 'id', values: ['sess-a'] },
        { kind: 'cwd', values: [CWD] }, // operations.ts:90 — the cwd clause rides last
      ],
      eventFilters: [
        { kind: 'seq', from: 5 },
        { kind: 'type', values: ['agent_message'] },
      ],
    })
    const value = out['value'] as { items: Array<Record<string, unknown>>, capped: boolean }
    expect(value.capped).toBe(false)
    expect(value.items.length).toBe(2) // caller-self and foreign-workspace hits never serve
    expect((value.items[0]['header'] as Record<string, unknown>)['id']).toBe('sess-a')
  })

  it('session_search: cursor paging follows the canonical page contract (cursor rides the SAME normalized request), maxResults caps, a repeated cursor throws CURSOR_LOOP, an off-contract page throws RESULT_SHAPE_INVALID', async () => {
    await faces()
    const b = buildAdapter()
    b.ports.searchSessionsPages.push({ items: [hit('s1', CWD)], nextCursor: 'c-1' }, { items: [hit('s2', CWD)] })
    const out = await b.adapter.rows['session_search'].invoke({ query: 'multi page' }, { signal })
    expect((out['value'] as { items: unknown[] }).items.length).toBe(2)
    expect(b.calls.length).toBe(2)
    const second = b.calls[1].args[0] as Record<string, unknown>
    expect(second['cursor']).toBe('c-1')
    expect(second['query']).toBe('multi page')
    expect(second['sessionFilters']).toEqual([{ kind: 'cwd', values: [CWD] }])

    const capped = buildAdapter({ maxSearchResults: 2 })
    capped.ports.searchSessionsPages.push({ items: [hit('a', CWD), hit('b', CWD), hit('c', CWD)] })
    const cappedOut = await capped.adapter.rows['session_search'].invoke({ query: 'q' }, { signal })
    expect((cappedOut['value'] as { items: unknown[], capped: boolean }).items.length).toBe(2)
    expect((cappedOut['value'] as { capped: boolean }).capped).toBe(true)

    const loop = buildAdapter()
    loop.ports.searchSessionsPages.push({ items: [], nextCursor: 'same' }, { items: [], nextCursor: 'same' })
    await expect(loop.adapter.rows['session_search'].invoke({ query: 'q' }, { signal })).rejects.toThrow(/P_G6_CURSOR_LOOP/)

    const badShape = buildAdapter()
    badShape.ports.searchSessionsPages.push({ nope: true } as unknown as Record<string, unknown>)
    await expect(badShape.adapter.rows['session_search'].invoke({ query: 'q' }, { signal })).rejects.toThrow(/P_G6_RESULT_SHAPE_INVALID/)
  })

  it('session_event_search: explicit target → searchEvents({sessionId, query, filters}, {signal}); the observed page session must BE the authorized target or the page is refused (assertObservedTargetAuthorized mirror)', async () => {
    await faces()
    const b = buildAdapter()
    b.ports.searchEventsPages.push({ items: [{ sessionId: 's9', seq: 4, type: 'agent_message', time: 1, surface: 'current', snippet: 'x' }], session: hdr('s9', CWD) })
    const out = await b.adapter.rows['session_event_search'].invoke({ session_id: 's9', query: 'needle', seq_from: 2 }, { signal })
    expect(out['ok']).toBe(true)
    expect(b.calls[0].method).toBe('searchEvents')
    expect(b.calls[0].args[0]).toEqual({ sessionId: 's9', query: 'needle', filters: [{ kind: 'seq', from: 2 }] })
    expect(b.calls[0].args[1]).toEqual({ signal })

    const rogue = buildAdapter()
    rogue.ports.searchEventsPages.push({ items: [{ x: 1 }], session: hdr('s9', '/elsewhere') })
    await expect(rogue.adapter.rows['session_event_search'].invoke({ session_id: 's9', query: 'q' }, { signal })).rejects.toThrow(/P_G6_TARGET_UNAUTHORIZED/)
    expect(rogue.calls.length).toBe(1) // entered once, refused at the serving edge, NEVER served
  })

  it('session_event_search: the CURRENT session excludes the step performing the call — boundary caps seq_to, a missing boundary refuses typed, a null boundary refues the degenerate bound, and a capped from>to short-circuits with zero port entry', async () => {
    await faces()
    const b = buildAdapter()
    b.ports.searchEventsPages.push({ items: [], session: hdr(CALLER_ID, CWD) })
    await b.adapter.rows['session_event_search'].invoke({ query: 'q' }, { signal })
    expect(b.calls[0].args[0]).toEqual({ sessionId: CALLER_ID, query: 'q', filters: [{ kind: 'seq', to: 49 }] }) // 50 - 1

    const noBoundary = buildAdapter()
    noBoundary.caller.value = { id: CALLER_ID, cwd: CWD }
    const refused = await noBoundary.adapter.rows['session_event_search'].invoke({ query: 'q' }, { signal })
    expect(refused['code']).toBe(SC.CURRENT_STEP_BOUNDARY_ABSENT)
    expect(noBoundary.calls.length).toBe(0)

    const nullBoundary = buildAdapter()
    nullBoundary.caller.value = { id: CALLER_ID, cwd: CWD, boundary: { lastStepStartSeq: null } }
    const degenerate = await nullBoundary.adapter.rows['session_event_search'].invoke({ query: 'q' }, { signal })
    expect(degenerate['code']).toBe(SC.INVALID_FILTER)
    expect(nullBoundary.calls.length).toBe(0)

    const capped = buildAdapter()
    const early = await capped.adapter.rows['session_event_search'].invoke({ query: 'q', seq_from: 60 }, { signal })
    expect(early['ok']).toBe(true)
    expect((early['value'] as { items: unknown[] }).items).toEqual([])
    expect(capped.calls.length).toBe(0) // empty-window short circuit BEFORE the port (operations.ts:141-143)
  })

  it('session_trace: traceSession(sessionId, signal) positional; the target header must be authorized; ancestors stop at the first unauthorized record; descendants project nulls', async () => {
    await faces()
    const b = buildAdapter()
    b.ports.traceValue = {
      target: { header: hdr(CALLER_ID, CWD), live: true, persisted: false },
      ancestors: [
        { header: hdr('anc-1', CWD), live: false, persisted: true },
        { header: hdr('anc-2', '/elsewhere'), live: false, persisted: true },
        { header: hdr('anc-3', CWD), live: false, persisted: true },
      ],
      descendants: [
        { session: { header: hdr('desc-1', CWD), live: false, persisted: true }, descendants: [{ session: { header: hdr('desc-1a', '/elsewhere'), live: false, persisted: true }, descendants: [] }] },
        { session: { header: hdr('desc-2', '/elsewhere'), live: false, persisted: true }, descendants: [] },
      ],
      complete: true,
      root: { header: hdr('root-x', CWD), live: false, persisted: true },
    }
    const out = await b.adapter.rows['session_trace'].invoke({}, { signal })
    expect(out['ok']).toBe(true)
    expect(b.calls[0].method).toBe('traceSession')
    expect(b.calls[0].args[0]).toBe(CALLER_ID) // session_id omitted → the caller (workspace-access.ts:71-73)
    expect(b.calls[0].args[1]).toBe(signal)
    const value = out['value'] as Record<string, unknown>
    expect((value['ancestors'] as unknown[]).length).toBe(1) // stops at anc-2 (operations.ts:183-192)
    expect(value['ancestorBoundary']).toBe(true)
    const descendants = value['descendants'] as Array<Record<string, unknown> | null>
    expect(descendants[1]).toBeNull()
    expect(((descendants[0] as Record<string, unknown>)['descendants'] as unknown[])[0]).toBeNull()
  })

  it('session_event_trace: traceEvent({sessionId, seq}, signal); canonical members are enforced; foreign session header refuses', async () => {
    await faces()
    const b = buildAdapter()
    b.ports.eventTraceValue = {
      session: hdr('s9', CWD),
      target: { sessionId: 's9', seq: 7, type: 'agent_message', time: 1, surface: 'current' },
      replacedBy: 9,
      replacementChain: [9],
      replacedEventSeqs: [],
      sourceEventSeqs: [2],
      derivedEventSeqs: [11],
    }
    const out = await b.adapter.rows['session_event_trace'].invoke({ session_id: 's9', seq: 7 }, { signal })
    expect(out['ok']).toBe(true)
    expect(b.calls[0].args[0]).toEqual({ sessionId: 's9', seq: 7 })
    expect(b.calls[0].args[1]).toBe(signal)
    expect((out['value'] as Record<string, unknown>)['replacementChain']).toEqual([9])

    const badShape = buildAdapter()
    badShape.ports.eventTraceValue = { session: hdr('s9', CWD), target: {} }
    const refused = await badShape.adapter.rows['session_event_trace'].invoke({ session_id: 's9', seq: 7 }, { signal })
    expect(refused['code']).toBe(SC.RESULT_SHAPE_INVALID)

    const rogue = buildAdapter()
    rogue.ports.eventTraceValue = {
      session: hdr('s9', '/elsewhere'), target: {}, replacementChain: [], replacedEventSeqs: [], sourceEventSeqs: [], derivedEventSeqs: [],
    }
    const denied = await rogue.adapter.rows['session_event_trace'].invoke({ session_id: 's9', seq: 7 }, { signal })
    expect(denied['code']).toBe(SC.TARGET_UNAUTHORIZED)
  })

  it('session_event_read: readEvent gets {sessionId, seq} with before/after ONLY when supplied; the window is served after the observed-header check', async () => {
    await faces()
    const b = buildAdapter()
    const window = {
      session: hdr(CALLER_ID, CWD),
      inheritedEventCount: 0,
      target: { seq: 7, type: 'agent_message' },
      events: [{ seq: 6, type: 'tool_call' }, { seq: 7, type: 'agent_message' }],
      startSeq: 6,
      endSeq: 7,
    }
    b.ports.readValue = window
    const bare = await b.adapter.rows['session_event_read'].invoke({ seq: 7 }, { signal })
    expect(bare['ok']).toBe(true)
    expect(b.calls[0].args[0]).toEqual({ sessionId: CALLER_ID, seq: 7 }) // keys only when supplied (operations.ts:232-238)
    expect(b.calls[0].args[1]).toBe(signal)

    const withWindow = buildAdapter()
    withWindow.ports.readValue = window
    await withWindow.adapter.rows['session_event_read'].invoke({ seq: 7, before: 1, after: 0 }, { signal })
    expect(withWindow.calls[0].args[0]).toEqual({ sessionId: CALLER_ID, seq: 7, before: 1, after: 0 })

    const rogue = buildAdapter()
    rogue.ports.readValue = { ...window, session: hdr(CALLER_ID, '/elsewhere') }
    const denied = await rogue.adapter.rows['session_event_read'].invoke({ seq: 7 }, { signal })
    expect(denied['code']).toBe(SC.TARGET_UNAUTHORIZED)
  })

  it('per-dispatch port identity: a rebound port method is caught BEFORE forwarding (PORT_METHOD_MOVED, zero forwarding)', async () => {
    await faces()
    const b = buildAdapter()
    // mutate the facet the SAME way a rotated generation would
    b.facets['traceQueryPort'] = { ...(b.facets['traceQueryPort'] as Record<string, unknown>), traceSession: async function (id: unknown, s?: unknown) { return { id, s } } }
    const out = await b.adapter.rows['session_trace'].invoke({}, { signal })
    expect(out['code']).toBe(SC.PORT_METHOD_MOVED)
    expect(b.calls.length).toBe(0)
  })

  it('pre-aborted signal refuses with ZERO port entry; the caller moving between classify and the entry refuses CALLER_DRIFT with zero port entry', async () => {
    await faces()
    const ctrl = new AbortController()
    ctrl.abort()
    const b = buildAdapter()
    const out = await b.adapter.rows['session_trace'].invoke({}, { signal: ctrl.signal })
    expect(out['code']).toBe(SC.PRE_ABORTED)
    expect(b.calls.length).toBe(0)

    let reads = 0
    const drifting = S.createG6SessionQueryAdapter({
      realmId: 'realm-g6',
      providerId: 'plugin-team-g6',
      readNative: (name: string) => (await0(realFaces))[name],
      queryPorts: makePorts().ports,
      readCaller: () => {
        reads += 1
        return reads === 1 ? makeCaller() : { id: CALLER_ID, cwd: '/moved' }
      },
      declaredMount: { searchBackend: { present: true } },
    }) as G6Adapter
    const drift = await drifting.rows['session_trace'].invoke({}, { signal })
    expect(drift['code']).toBe(SC.CALLER_DRIFT)
  })

  it('a missing caller refuses CALLER_UNAVAILABLE; a caller WITHOUT a workspace refuses session_search typed (operations.ts:63-68) — the cwd clause is never invented', async () => {
    await faces()
    const gone = buildAdapter({ callerOverride: () => undefined })
    const missing = await gone.adapter.rows['session_trace'].invoke({}, { signal })
    expect(missing['code']).toBe(SC.CALLER_UNAVAILABLE)
    expect(gone.calls.length).toBe(0)

    const noWs = buildAdapter()
    noWs.caller.value = { id: CALLER_ID }
    const refused = await noWs.adapter.rows['session_search'].invoke({ query: 'q' }, { signal })
    expect(refused['code']).toBe(SC.CALLER_WORKSPACE_ABSENT)
    expect(noWs.calls.length).toBe(0)
  })

  it('service failures ride VERBATIM — the row never swallows a port rejection into a fake result', async () => {
    await faces()
    const b = buildAdapter()
    const serviceError = Object.assign(new Error('session event was not found'), { code: 'SESSION_QUERY_EVENT_NOT_FOUND' })
    b.ports.readValue = serviceError
    await expect(b.adapter.rows['session_event_read'].invoke({ seq: 99 }, { signal })).rejects.toBe(serviceError)
  })

  it('drain forbids NEW entries (typed refusal, no native fallback); dispatch facts are observable per row', async () => {
    await faces()
    const b = buildAdapter()
    b.ports.traceValue = { target: { header: hdr(CALLER_ID, CWD), live: true, persisted: false }, ancestors: [], descendants: [], complete: true, root: hdr(CALLER_ID, CWD) }
    await b.adapter.rows['session_trace'].invoke({}, { signal })
    const facts = b.adapter.rows['session_trace'].lastDispatch()
    expect(facts?.['portMethod']).toBe('traceSession')
    expect(facts?.['capturedAt']).toBe('row-invoke')
    b.adapter.rows['session_trace'].drain()
    expect(b.adapter.rows['session_trace'].draining()).toBe(true)
    const refused = b.adapter.rows['session_trace'].classify({})
    expect(refused['code']).toBe(SC.DRAINING)
  })
})
