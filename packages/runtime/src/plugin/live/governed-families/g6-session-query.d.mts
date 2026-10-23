/**
 * Adjacent tsc type surface for `packages/runtime/src/plugin/live/governed-
 * families/g6-session-query.mjs` (A5-M2 G6 REAL-QUERY ADAPTER). Minimal,
 * consumed-only (the image.d.mts pattern): it types ONLY what the lane test
 * `packages/runtime/test/a5m2-g6-session-query-c1.test.ts` and the future
 * wire owners (feat/a5m2-wire-* trees) consume; the runtime law lives in the
 * `.mjs`. No host .ts is imported — the native definition and the port are
 * typed STRUCTURALLY, mirroring the pinned 639ed01539 faces (see the .mjs
 * header ledger for every file:line).
 */

/** One captured native tool definition as the host's defineTool product
 *  exposes it (core/tools/src/schema.ts:554-632 @639ed01539): name,
 *  description bytes, the COMPILED parameter JSON Schema, the compiled
 *  output schema wrapper, and the execute function. */
export interface G6NativeDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  output?: { schema?: unknown, [key: string]: unknown }
  execute: (args: unknown, exec: unknown) => Promise<unknown>
  [key: string]: unknown
}

/** The caller facts the delegation law reads (workspace-access.callerOf
 *  @tool-session-query/src/workspace-access.ts:56-69 @639ed01539): id,
 *  workspace cwd (possibly absent — the cross-session search law then
 *  refuses), and the CURRENT-step boundary fold. */
export interface G6Caller {
  id: string
  cwd?: string
  boundary?: { lastStepStartSeq?: number | null }
}

/** The SEARCH-family port facet: the two ABSTRACT full-text methods
 *  (session-query/src/index.ts:153-156, :164-167 @639ed01539), concrete only
 *  through a composed backend. BOTH carry the real two-formal signature
 *  (request, exec?) — the optional half is part of the declared face. */
export interface G6SearchQueryPort {
  searchSessions: (request: Record<string, unknown>, exec?: { signal?: AbortSignal }) => Promise<Record<string, unknown>>
  searchEvents: (request: Record<string, unknown>, exec?: { signal?: AbortSignal }) => Promise<Record<string, unknown>>
}

/** The TRACE-family port facet: the two CONCRETE engine methods
 *  (session-query/src/index.ts:327-331, :340-347 @639ed01539). */
export interface G6TraceQueryPort {
  traceSession: (sessionId: string, signal?: AbortSignal) => Promise<Record<string, unknown>>
  traceEvent: (request: { sessionId: string, seq: number }, signal?: AbortSignal) => Promise<Record<string, unknown>>
}

/** The EVENT-READ-family port facet: the CONCRETE engine method
 *  (session-query/src/index.ts:355-361 @639ed01539); the read-window cap
 *  stays the service's own typed refusal. */
export interface G6EventReadQueryPort {
  readEvent: (request: { sessionId: string, seq: number, before?: number, after?: number }, signal?: AbortSignal) => Promise<Record<string, unknown>>
}

/** One typed query port per real service method family — NEVER a shared
 *  string-dispatch wrapper. */
export interface G6QueryPorts {
  searchQueryPort: G6SearchQueryPort
  traceQueryPort: G6TraceQueryPort
  eventReadQueryPort: G6EventReadQueryPort
}

/** Placement deps for {@link createG6SessionQueryAdapter}. */
export interface G6AdapterDeps {
  realmId: string
  providerId: string
  /** Production: `name => ctx.tools.get(name, scope)`. */
  readNative: (name: string) => G6NativeDefinition | undefined | null
  queryPorts: G6QueryPorts
  readCaller: () => G6Caller | undefined | null
  /** Only the OWNING assembly observes search-backend presence; absent or
   *  not `present === true` keeps the two search rows honestly INACTIVE. */
  declaredMount?: { searchBackend?: { present?: boolean, detail?: string } }
  /** Mirrors DEFAULT_MAX_SEARCH_RESULTS = 100 (tool-session-query/src/index.ts:22 @639ed01539). */
  maxSearchResults?: number
  definitionIdentityOf?: (definition: G6NativeDefinition) => string
  observe?: (event: Record<string, unknown>) => void
}

export interface G6Refusal {
  ok: false
  code: string
  detail: string
}

export interface G6ClassifyOk {
  ok: true
  correlation: string
  effects: readonly Record<string, unknown>[]
  targetManifest: Record<string, unknown>
  reviewPayload: Record<string, unknown>
  parametersFingerprint: string
  plan: Record<string, unknown>
}

export interface G6InvokeOk {
  ok: true
  value: unknown
  plan: Record<string, unknown>
}

export type G6Outcome = G6ClassifyOk | G6InvokeOk | G6Refusal

/** One of the five typed governed rows. */
export interface G6Row {
  active: boolean
  familyId: string
  adapterRevision: number
  toolName: string
  operation: string
  mountCondition: 'always' | 'declared_mount'
  realmId: string
  providerId: string
  portFamily: 'search' | 'trace' | 'eventRead'
  portMethod: 'searchSessions' | 'searchEvents' | 'traceSession' | 'traceEvent' | 'readEvent'
  nativeCite: string
  serviceCite: string
  /** The CAPTURED native description bytes; null with no capture. */
  description: string | null
  registrationSchema: { parameters: Record<string, unknown>, output?: unknown } | null
  captured: () => boolean
  definitionIdentity: string | null
  namedBlockers: readonly string[]
  classify: (args: unknown) => G6ClassifyOk | G6Refusal | Promise<G6ClassifyOk | G6Refusal>
  invoke: (args: unknown, exec?: { signal?: AbortSignal }) => Promise<G6Outcome>
  drainSemantics: string
  drain: () => void
  draining: () => boolean
  lastDispatch: () => Record<string, unknown> | null
}

export interface G6Adapter {
  adapterRevision: number
  familyId: string
  rows: Record<'session_search' | 'session_event_search' | 'session_trace' | 'session_event_trace' | 'session_event_read', G6Row>
  portFamilies: Record<string, { facet: string, methods: readonly string[], arity: number, law: string }>
  namedBlockers: Record<string, string>
  typedCodes: Record<string, string>
}

export declare const A5_G6_ADAPTER_REVISION: number
export declare const A5_G6_FAMILY: string
export declare const A5_G6_TOOL_NAMES: readonly string[]
export declare const A5_G6_PORT_FAMILIES: Record<'search' | 'trace' | 'eventRead', { facet: string, methods: readonly string[], arity: number, law: string }>
export declare const A5_G6_TYPED_CODES: Record<string, string>
export declare const A5_G6_NAMED_BLOCKERS: Record<'SEARCH_BACKEND' | 'TARGET_PREAUTH' | 'PARENT_FILTER' | 'TITLES_PRESENTATION' | 'SESSION_HISTORY_RESOURCE_KIND', string>
export declare const A5_G6_DRAIN_SEMANTICS: string

export declare class G6SessionQueryRefusal extends Error {
  code: string
  facts?: unknown
  constructor (code: string, detail: string, facts?: unknown)
}

export declare function createG6SessionQueryAdapter (deps: G6AdapterDeps): G6Adapter
