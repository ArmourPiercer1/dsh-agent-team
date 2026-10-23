/**
 * Adjacent tsc type surface for `packages/runtime/src/plugin/live/governed-
 * families/g6-session-query.mjs` (A5-M2 G6 REAL-QUERY ADAPTER, rev 2).
 * Minimal, consumed-only (the image.d.mts pattern): it types ONLY what the
 * lane test `packages/runtime/test/a5m2-g6-session-query-c1.test.ts` and the
 * future wire owners (feat/a5m2-wire-* trees) consume; the runtime law lives
 * in the `.mjs`. No host .ts is imported — the native definition, the five
 * typed port facets, and the canonical result members are typed STRUCTURALLY,
 * mirroring the pinned 639ed01539 faces (see the .mjs header ledger for every
 * file:line). invoke serves the NATIVE model-facing string (captured output
 * schema {type:'string'}, tool-session-query/src/index.ts:46-49).
 */

/** One captured native tool definition as the host's defineTool product
 *  exposes it (core/tools/src/schema.ts:554-632 @639ed01539): name,
 *  description bytes, the COMPILED parameter JSON Schema (the row type-
 *  validates model args against THESE bytes — never coerces), the compiled
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
 *  workspace cwd (possibly absent — the cross-session search law then throws
 *  the native SESSION_QUERY_TOOL_UNAUTHORIZED failure), and the CURRENT-step
 *  boundary fold. */
export interface G6Caller {
  id: string
  cwd?: string
  boundary?: { lastStepStartSeq?: number | null }
}

/* ── canonical session-query result mirrors (session-query/src/types.ts) ── */

/** SessionHeader members the authorization law reads (dsh-session). */
export interface G6SessionHeaderLike {
  id: string
  cwd?: string
  parentSession?: string
  createdAt?: number
  [key: string]: unknown
}

/** SessionRecord (types.ts:27-34). */
export interface G6SessionRecordLike {
  header: G6SessionHeaderLike
  live: boolean
  persisted: boolean
  [key: string]: unknown
}

/** SessionSearchHit (types.ts:285-288). */
export interface G6SearchHitLike extends G6SessionRecordLike {
  bestMatch: { seq: number, type: string, time: number, surface: string, snippet: string }
}

/** SessionSearchPage (types.ts:231-236); the cursor is a branded string (cursor.ts:6). */
export interface G6SearchPageLike {
  items: readonly G6SearchHitLike[]
  nextCursor?: string
}

/** SessionEventSearchHit (types.ts:279-282). */
export interface G6EventSearchHitLike {
  sessionId: string
  seq: number
  type: string
  time: number
  surface: string
  snippet: string
}

/** SessionEventSearchPage (types.ts:239-242). */
export interface G6EventSearchPageLike {
  session: G6SessionHeaderLike
  items: readonly G6EventSearchHitLike[]
  nextCursor?: string
}

/** SessionLineageTrace (types.ts:81-101). */
export interface G6TraceLike {
  target: G6SessionRecordLike
  ancestors: readonly G6SessionRecordLike[]
  descendants: readonly { session: G6SessionRecordLike, descendants: readonly unknown[] }[]
  complete: boolean
  [key: string]: unknown
}

/** SessionEventTraceObservation (types.ts:112-131). */
export interface G6EventTraceLike {
  session: G6SessionHeaderLike
  target: { seq: number, type: string, time: number, surface: string }
  replacedBy?: number
  replacementChain: readonly number[]
  replacedEventSeqs: readonly number[]
  sourceEventSeqs: readonly number[]
  derivedEventSeqs: readonly number[]
}

/** SessionEventWindow (types.ts:146-159). */
export interface G6EventWindowLike {
  session: G6SessionHeaderLike
  target: Record<string, unknown>
  events: readonly Record<string, unknown>[]
  startSeq: number
  endSeq: number
  [key: string]: unknown
}

/** SessionTitleObservationResult (types.ts:162-183). */
export type G6TitleObservation
  = | { sessionId: string, status: 'fulfilled', value: { session: G6SessionHeaderLike, title?: { title: string } } }
    | { sessionId: string, status: 'rejected', reason: unknown }

/* ── the five typed port facets (VERBATIM real signatures) ──────────────── */

/** SEARCH family: the two ABSTRACT full-text methods (index.ts:153-156,
 *  :164-167), concrete only through a composed backend. OPTIONAL facet —
 *  supplied ONLY on the assembly's real deployment evidence. */
export interface G6SearchQueryPort {
  searchSessions: (request: Record<string, unknown>, exec?: { signal?: AbortSignal }) => Promise<G6SearchPageLike>
  searchEvents: (request: Record<string, unknown>, exec?: { signal?: AbortSignal }) => Promise<G6EventSearchPageLike>
}

/** TRACE family: CONCRETE (index.ts:327-331, :340-347). */
export interface G6TraceQueryPort {
  traceSession: (sessionId: string, signal?: AbortSignal) => Promise<G6TraceLike>
  traceEvent: (request: { sessionId: string, seq: number }, signal?: AbortSignal) => Promise<G6EventTraceLike>
}

/** EVENT-READ family: CONCRETE (index.ts:355-361). */
export interface G6EventReadQueryPort {
  readEvent: (request: Record<string, unknown>, signal?: AbortSignal) => Promise<G6EventWindowLike>
}

/** AUTHORIZATION family: CONCRETE (index.ts:206-213). Carries the REAL
 *  authorizeTarget/authorizeSessionIds pre-read law
 *  (workspace-access.ts:75-90, :111-135) — the four target rows pre-authorize
 *  through THIS facet before any read. */
export interface G6AuthorizationQueryPort {
  filterSessions: (filters: readonly Record<string, unknown>[], signal?: AbortSignal) => Promise<readonly G6SessionRecordLike[]>
}

/** TITLES family: CONCRETE (index.ts:251-259). Carries the native title
 *  composition (workspace-access.ts:137-173) into the served presentation
 *  strings. */
export interface G6TitlesQueryPort {
  readTitleSnapshots: (sessionIds: readonly string[], signal?: AbortSignal) => Promise<readonly G6TitleObservation[]>
}

export interface G6QueryPorts {
  searchQueryPort?: G6SearchQueryPort
  traceQueryPort: G6TraceQueryPort
  eventReadQueryPort: G6EventReadQueryPort
  authorizationQueryPort: G6AuthorizationQueryPort
  titlesQueryPort: G6TitlesQueryPort
}

/** The owning assembly's REAL search-backend fact. INACTIVE must ride
 *  verbatim evidence; the factory refuses to construct on silence, and
 *  present:false forbids a search facet (no fake search methods). */
export type G6SearchBackendEvidence
  = | { present: true }
    | { present: false, evidence: string }

export interface G6AdapterDeps {
  realmId: string
  providerId: string
  readNative: (name: string) => G6NativeDefinition | undefined | null
  queryPorts: G6QueryPorts
  readCaller: () => G6Caller | undefined
  /** Team allow ceiling INTERSECTED with the service-side pre-authorization
   *  (item 1): a target read needs BOTH. Denial is pre-read, zero port entry.
   *  ROOT-16:47 closure: the SAME live decision gates (a) every hasTarget
   *  row — all four session_id-taking tools, session_event_search included
   *  — at classify AND invoke AND every later recheck; (b) session_trace's
   *  ancestor/descendant lineage lanes (denied members under-disclose, their
   *  ids never reach visibleIds/title reads); (c) the title lane itself —
   *  every cross-session title lookup passes this gate before the port; and
   *  (d) the cross-await REVOCATION contract — re-read at every dispatch,
   *  every await resumption, every cursor-continuation request construction
   *  and the final serve. This is the LIVE decision port: no stale revision
   *  snapshot is ever trusted. */
  teamCeiling: (targetSessionId: string, caller: G6Caller) => boolean
  declaredMount: { searchBackend: G6SearchBackendEvidence }
  maxSearchResults?: number
  definitionIdentityOf?: (definition: G6NativeDefinition) => string
  observe?: (event: Record<string, unknown>) => void
}

/** Governance-plane refusal envelope — P_G6_* codes only. Service-lane
 *  failures are NOT envelopes: invoke THROWS G6SessionQueryServiceError
 *  carrying the SAME code+message the native boundary throws (existence-safe
 *  safe-table semantics, service-boundary.ts:21-97).
 *  REVOCATION SHAPE (rev 3): the envelope fronts failures observable BEFORE
 *  admission; a revocation of caller/boundary/service/ceiling discovered at
 *  any LATER recheck (dispatch, await resumption, cursor-continuation
 *  construction, final serve) rejects with G6SessionQueryRefusal carrying
 *  the SAME closed P_G6_* codes — zero further forwarding, entered effects
 *  not rewound, nothing served.
 *  OUTPUT-SET MEMBERSHIP (rev 4, root-65c539): the final serve re-verifies
 *  the LIVE ceiling over the WHOLE output set — search hits, authorized
 *  parents, trace lineage members and the effective target — not only the
 *  target; a member revoked while the set was assembled (e.g. during the
 *  title await) refuses the ENTIRE result rather than serving a stale set.
 *  Pre-lookup filtering never substitutes for output-membership recheck. */
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

/** invoke serves the NATIVE model-facing string, byte-equal to the captured
 *  execute() output over the same service (presentation mirrors, rev 2). */
export interface G6InvokeOk {
  ok: true
  value: string
  plan: Record<string, unknown>
}

export type G6Outcome = G6Refusal | G6ClassifyOk | G6InvokeOk

export interface G6Row {
  active: boolean
  toolName: string
  portFamily: string
  portMethod: string
  description: string | null
  registrationSchema: Record<string, unknown> | null
  namedBlockers: readonly string[]
  captured: () => boolean
  classify: (args: Record<string, unknown>) => G6Refusal | G6ClassifyOk
  invoke: (args: Record<string, unknown>, exec?: { signal?: AbortSignal }) => Promise<G6Outcome>
  drain: () => void
  draining: () => boolean
  lastDispatch: () => Record<string, unknown> | null
}

export interface G6Adapter {
  rows: Readonly<Record<string, G6Row>>
}

export declare const A5_G6_ADAPTER_REVISION: number
export declare const A5_G6_FAMILY: string
export declare const A5_G6_TOOL_NAMES: readonly string[]
export declare const A5_G6_PORT_FAMILIES: Record<string, { facet: string, methods: readonly string[], arity: number, required: boolean, law: string }>
export declare const A5_G6_TYPED_CODES: Record<string, string>
export declare const A5_G6_SAFE_SERVICE_FAILURES: Record<string, { code: string, message: string }>
export declare const A5_G6_NAMED_BLOCKERS: Record<string, string>
export declare const A5_G6_DRAIN_SEMANTICS: string
export declare class G6SessionQueryServiceError extends Error {
  code: string
  constructor (message: string, code: string)
}
export declare class G6SessionQueryRefusal extends Error {
  code: string
  facts?: unknown
  constructor (code: string, detail: string, facts?: unknown)
}
export declare function createG6SessionQueryAdapter (deps: G6AdapterDeps): G6Adapter
