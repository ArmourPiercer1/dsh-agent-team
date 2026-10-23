/**
 * governed-families/g6-session-query.mjs — A5-M2 G6 REAL-QUERY ADAPTER (rev 2)
 * for the five host session-intelligence tools (session_search /
 * session_event_search / session_trace / session_event_trace /
 * session_event_read). A placement-time factory takes (a) the CAPTURED native
 * tool faces and (b) INJECTED TYPED QUERY PORTS mirroring the real
 * `ctx.sessionQuery` (SessionQueryEngine) method families VERBATIM — now
 * including the authorization family (filterSessions) and the titles family
 * (readTitleSnapshots) — plus the Team allow-ceiling decision, and returns
 * five typed governed rows.
 *
 * Rev 2 closes the six independent-review items:
 *  1. PRE-AUTHORIZATION INTERSECTION — the four target rows
 *     (session_event_search / session_trace / session_event_trace /
 *     session_event_read) run the REAL service pre-authorization law
 *     (authorizeTarget via filterSessions, workspace-access.ts:75-90) BEFORE
 *     any read port entry, INTERSECTED with the injected Team allow ceiling:
 *     a read needs BOTH the service authorization AND the ceiling. No
 *     read-then-filter anywhere. (TARGET_PREAUTH residual CLOSED.)
 *  2. EXISTENCE-SAFE ERRORS — target failures ride the service's own safe
 *     semantics: missing target and foreign target both produce the single
 *     SESSION_QUERY_TOOL_UNAUTHORIZED failure 'session target is outside the
 *     caller workspace' (service-boundary.ts:92-97 via authorizeTarget
 *     :83/:89); every port failure is sanitized through the mirrored safe
 *     table (service-boundary.ts:21-90). The row adds NO code that could
 *     distinguish "does not exist" from "outside workspace".
 *  3. CAPTURED-SCHEMA TYPED VALIDATION — arguments are type-validated against
 *     the CAPTURED compiled JSON Schema (type/enum/items of the compiled
 *     face), never coerced: a numeric seq or a non-string session_ids item is
 *     refused typed; String()/Number() coercion is absent by construction.
 *  4. NATIVE OUTPUT FIDELITY — invoke serves the SAME model-facing string the
 *     native operations layer serves: the presentation mirrors of
 *     presentation.ts (:48-79, :81-83, :85-106, :108-131, :149-163, :165-188)
 *     compose titles via readTitleSnapshots (:137-155) and renderSession-
 *     scoped parent display through the AUTHORIZED parent set
 *     (operations.ts:104-107 → 'root' | <authorized id> | '[outside
 *     workspace]', presentation.ts:56-60); the trace keeps the native
 *     shape. The captured native output schema ({type:'string'}, index.ts:46-49)
 *     is the row's output type. (TITLES_PRESENTATION residual CLOSED.)
 *  5. RECEIVER PINNED PAGINATION — every port call (including every page of
 *     collectPages) goes to the function object AND the receiver object
 *     captured at placement (this stays bound to the same service instance);
 *     per-dispatch re-verify checks facet-object identity (PORT_RECEIVER_MOVED)
 *     and function-object identity (PORT_METHOD_MOVED) plus caller
 *     id/cwd/boundary (CALLER_DRIFT) — not method-name equality.
 *  6. REAL PARENT/ROOT LANE + EVIDENCE-BACKED MOUNT —
 *     parent_session_ids / include_root_sessions ride the REAL
 *     authorizeSessionIds law (workspace-access.ts:111-135 via filterSessions)
 *     intersected with the ceiling, null riding the root clause exactly like
 *     operations.ts:79-89 (include_root_sessions:false = parents only; roots
 *     join ONLY when true; an empty lane serves the native
 *     'No prior session matches found.' string). The search rows activate
 *     ONLY on the owning assembly's REAL deployment evidence
 *     (declaredMount.searchBackend {present:true}); evidence
 *     {present:false, evidence:'<verbatim observation>'} keeps them honest
 *     INACTIVE and the factory then REQUIRES the search facet to be ABSENT —
 *     an assembly without a search backend constructs the adapter WITHOUT
 *     providing fake search methods. (PARENT_FILTER residual CLOSED.)
 *
 * Rev 3 (root-1eea concentrated review delta — three residual over-reach
 * paths closed, the six rev-2 items above STAND CLOSED and are not reopened):
 *  ① EVERY hasTarget row (ALL FOUR session_id-taking tools, the search-family
 *     session_event_search included — family is no excuse) carries the Team
 *     ceiling on its effective target (classify + entry + per-dispatch),
 *     intersected with the service pre-authorization; cwd agreement never
 *     substitutes for the ceiling.
 *  ② session_trace's lineage lanes intersect the ceiling too: a
 *     ceiling-denied ancestor stops display at the boundary note, a
 *     ceiling-denied descendant subtree rides the same null under-disclosure
 *     as an unauthorized one, and denied ids never reach visibleIds/title
 *     reads (cwd-only filtering is closed).
 *  ③ REVOCATION CONTRACT: from entry admission on, every service dispatch
 *     (each page, each title read) AND the final serve re-verify the CURRENT
 *     caller id/cwd/step-boundary, the pinned receiver + method objects and
 *     the live Team ceiling decision — a revocation across an await never
 *     serves on the stale authorization (typed G6SessionQueryRefusal throws,
 *     same codes; entered effects not rewound per the drain semantics). No
 *     stale revision snapshot is trusted; the decision port stays live.
 *     ROOT-65c539 closure: the final serve ALSO re-verifies the CURRENT
 *     ceiling over the WHOLE OUTPUT SET — search hits, authorized parents,
 *     trace lineage members and the target — not only the effective target;
 *     a member revoked while the set was being assembled (e.g. during the
 *     title await) refuses the ENTIRE result instead of serving a stale set
 *     (pre-title filtering alone never substitutes for output membership).
 *
 * UNWIRED: nothing here mounts itself; placement/registration is the CENTER's.
 * No Host boot, no network. Legs in a5m2-g6-session-query-c1.test.ts run the
 * REAL captured native faces (the built tool plugin's apply() is executed to
 * capture them) and additionally use the REAL captured execute() as a
 * byte-equality ORACLE against the row over one shared fake service.
 *
 * ── REAL-FACE LEDGER (comment-side ONLY; every fact @639ed01539, pristine
 * host checkout tests/deepseek-harness-test-use; paths relative to its
 * packages/) ────────────────────────────────────────────────────────────────
 * Tool surface — session-query/tool-session-query/src/index.ts
 *   plugin name 'tool-session-query' :16; inject ['tools','systemPrompt',
 *   'sessionQuery','sessionProjections'] :19; DEFAULT_MAX_SEARCH_RESULTS 100
 *   :22; TEXT_OUTPUT {schema:{type:'string'}} :46-49; apply() :57; execute
 *   lines :71/:81/:91/:104/:119. Five ctx.tools.register(defineTool(…)):
 *   session_search :65-73, session_event_search :75-83, session_trace :85-93,
 *   session_event_trace :95-106, session_event_read :108-121.
 * Parameter DSL — tool-session-query/src/input.ts: buildSessionFilters :88-101
 *   (brandString is TYPE-LEVEL only; runtime values are plain strings),
 *   materializeParentSessionIds :103-107 (assertNonEmptyArray + Set dedup),
 *   buildEventFilters :109-124, normalizeQuery :126-141, sequenceRange
 *   :143-156, timestampRange :158-182, ISO_TIMESTAMP :179-180,
 *   parseIsoTimestamp :188-221, compareTimestamps :223-234, invalidRange
 *   :271-276 ('session <name> range <detail>', SESSION_QUERY_INVALID_FILTER),
 *   assertNonNegativeSafeInteger :278-285 ('<name> must be a non-negative
 *   safe integer'), assertNonEmptyArray :287-294. CLOSED enum lanes:
 *   availability ∈ {live, persisted} (:52-56), surfaces/event_surfaces ∈
 *   {current, shadowed, log-only} (:62-66, :77-81).
 * The lift — core/tools/src/schema.ts defineTool :554-632 (compile :577,
 *   execute-time validateArgs :579/:598-599); parameterSchemaSpecToJsonSchema
 *   :449-458; json-schema.ts assertSupportedJsonSchema :385. The CAPTURED
 *   native definition carries the COMPILED product; g3CanonicalRegistration-
 *   Face carries it verbatim and the row VALIDATES model args against it.
 * Real query services (the five port facets mirror these signatures VERBATIM)
 *   — session-query/src/index.ts: abstract SessionQueryEngine :98, service
 *   name 'sessionQuery' :106, backend law :91-97.
 *     SEARCH (ABSTRACT, backend-composed — SqliteSessionQueryEngine
 *     @session-query-sqlite/src/index.ts:203, overrides :268/:296; a
 *     deployment may carry SESSION_QUERY_SEARCH_DISABLED
 *     @service-boundary.ts:74-77):
 *       searchSessions(request, exec?) :153-156; searchEvents(request, exec?)
 *       :164-167.
 *     TRACE / EVENT-READ / AUTHORIZATION / TITLES (CONCRETE on the engine):
 *       traceSession(sessionId, signal?) :327-331; traceEvent(request,
 *       signal?) :340-347; readEvent(request, signal?) :355-361;
 *       filterSessions(filters, signal?) :206-213 → SessionRecord[];
 *       readTitleSnapshots(ids, signal?) :251-259 →
 *       SessionTitleObservationResult[] (types.ts:162-183: {sessionId,
 *       status:'fulfilled', value:{session, title?}} | {sessionId,
 *       status:'rejected', reason}).
 * Call sites the delegation mirrors — tool-session-query/src/operations.ts:
 *   executeSessionSearch :55-115 (cwd law :63-68, parent lane :79-89 with the
 *   empty-lane native string :87, cwd clause pushed LAST :90, per-hit accept
 *   :101, parent DISPLAY authorization :104-107, titles :108-113);
 *   executeEventSearch :117-169 (authorizeTarget :125 BEFORE the search,
 *   CURRENT-step cap :128-139, title read BEFORE the short-circuit :140,
 *   empty-window short-circuit :141-143, full filter build :144-151,
 *   observed-header assert :163); executeSessionTrace :171-201
 *   (authorizeTarget :178, assert :181, ancestor stop-at-first-unauthorized
 *   :183-192, authorizeDescendants :193, titles :194-199, formatSessionTrace
 *   :200); executeEventTrace :203-218 (assert :208, authorizeTarget :212,
 *   assert :215); executeEventRead :220-242 (asserts :225-228,
 *   authorizeTarget :231, request keys-only-when-supplied :232-238, assert
 *   :239); collectPages :244-277 (maxResults cap :262-264, repeated-cursor
 *   THROW 'session-search provider repeated a continuation cursor'
 *   SESSION_QUERY_INVALID_CURSOR :268-274).
 * Service boundary mirror — tool-session-query/src/service-boundary.ts:
 *   SAFE_SESSION_QUERY_FAILURES table :21-90 (17 codes; INVALID_CONFIG and
 *   SOURCE_CONFLICT collapse to SESSION_QUERY_TOOL_FAILED); unauthorizedTarget
 *   :92-97; call() :99-114 (throwIfAborted before/after + sanitize on catch);
 *   sanitizeError :116-141 (SessionQueryError known code → safe {code,
 *   message}; HarnessError SESSION_QUERY_TOOL_UNAUTHORIZED → the same
 *   unauthorizedTarget; everything else → generic 'session query operation
 *   failed' / SESSION_QUERY_TOOL_FAILED; ctx.logger.warn full diagnostic).
 * Workspace law mirror — tool-session-query/src/workspace-access.ts: callerOf
 *   :56-69 (exec.agent.session.id/header.cwd + turnBoundary projection);
 *   targetId :71-73; authorizeTarget :75-90 (caller-self short-circuit :81,
 *   missing cwd → the ONE unauthorized failure :83, filterSessions id+cwd :84
 *   -88, records.length !== 1 → the SAME failure :89 — missing and foreign
 *   targets are indistinguishable by design); recordAuthorized :92-94;
 *   headerAuthorized :96-99; assertObservedTargetAuthorized :101-109;
 *   authorizeSessionIds :111-135 (caller-self included :119, id+cwd clauses
 *   :123-127); readTitles :137-155 / readTitle :157-164 / unavailableTitle
 *   :166-173 (rejected observation → sanitize; UNAUTHORIZED re-throws, others
 *   render 'untitled (title unavailable: CODE)' via titleText :237-241);
 *   authorizeDescendants :175-205 (iterative; unauthorized → null);
 *   visitDescendants :207-227; descendantIds :229-235.
 * Presentation mirrors — tool-session-query/src/presentation.ts:
 *   formatSessionSearch :48-79 (parent display 'root' | authorized id |
 *   '[outside workspace]' :56-60, snippet/availability lines, cap note :75-77),
 *   formatEmptySessionSearch :81-83 ('No prior session matches found.'),
 *   formatEventSearch :85-106, formatSessionTrace :108-131, renderDescendants
 *   :133-147, formatEventTrace :149-163, formatEventRead :165-188 (```json
 *   fenced target + Before/After neighbors), formatNeighbor :190-194,
 *   availabilityText :196-201, seqList :203-205, formatTime :207-209;
 *   extractSessionEventText mirror — session-query/src/extraction.ts:15-87.
 * Canonical result members (what the rows read) — session-query/src/types.ts:
 *   SessionSearchPage {items, nextCursor?} :231-236; SessionEventSearchPage
 *   +{session} :239-242; SessionSearchHit +{bestMatch} :285-288;
 *   SessionEventSearchHit +{snippet} :279-282; SessionResultFilter :203-208;
 *   SessionTitleObservation(Result) :162-183; SessionLineageTrace :81-101;
 *   SessionEventTraceObservation :112-131; SessionEventWindow :146-159.
 *   SessionSearchCursor is a branded STRING (cursor.ts:6). Read-window cap
 *   SESSION_QUERY_READ_WINDOW_MAX 50 (config.ts:6) stays the SERVICE's.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * MOUNT LAW: trace/event-trace/event-read/authorization/titles are CONCRETE
 * engine methods — those facets are REQUIRED at placement. The SEARCH facet is
 * OPTIONAL and gated by the owning assembly's evidence (item 6 above):
 * {present:true} requires the real facet; {present:false, evidence} forbids
 * it and the two search rows stay honest INACTIVE carrying the evidence
 * verbatim. Silence (no searchBackend fact) is a placement defect — mis-
 * configuration fails loud.
 *
 * REMAINING NAMED RESIDUAL (reported, never faked):
 *  - SESSION_HISTORY_RESOURCE_KIND: the closed RESOURCE_KINDS set
 *    (workspace|realm-home|absolute-path|directory|metadata|
 *    network-destination, domain/tool-governance/src/resource.ts:42-50)
 *    carries NO session-history kind — the read rides as tool-invoke over the
 *    bound typed port method; the session-history resource kind is the
 *    CENTER's grammar close, never an invention here.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g6-session-query
 */
import { createHash } from 'node:crypto'

import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import { g3CanonicalRegistrationFace } from './g3-fsproc-adapters.mjs'

export const A5_G6_ADAPTER_REVISION = 4
export const A5_G6_FAMILY = 'B-SESSION-QUERY'

/** The five tool names, exactly as the host registers them (index.ts:66/:76/:86/:96/:109 @639ed01539). */
export const A5_G6_TOOL_NAMES = Object.freeze([
  'session_search',
  'session_event_search',
  'session_trace',
  'session_event_trace',
  'session_event_read',
])

/**
 * The five typed port facets, mirroring the real service method families
 * VERBATIM (every real signature has TWO formal parameters — the optional
 * exec/signal half is part of the declared face; index.ts:153-167, :206-213,
 * :251-259, :327-361 @639ed01539). Arity is checked at placement: a 1-arg
 * stand-in is a signature drift, not a simplification.
 */
export const A5_G6_PORT_FAMILIES = Object.freeze({
  search: Object.freeze({
    facet: 'searchQueryPort',
    methods: Object.freeze(['searchSessions', 'searchEvents']),
    arity: 2,
    required: false,
    law: 'ABSTRACT on SessionQueryEngine (session-query/src/index.ts:153-156, :164-167 @639ed01539); concrete only through a composed backend (SqliteSessionQueryEngine @session-query-sqlite/src/index.ts:203, :268, :296) — supplied ONLY on the assembly\'s real deployment evidence',
  }),
  trace: Object.freeze({
    facet: 'traceQueryPort',
    methods: Object.freeze(['traceSession', 'traceEvent']),
    arity: 2,
    required: true,
    law: 'CONCRETE on the engine (session-query/src/index.ts:327-331, :340-347 @639ed01539) — backend-independent exact traces (law :91-97)',
  }),
  eventRead: Object.freeze({
    facet: 'eventReadQueryPort',
    methods: Object.freeze(['readEvent']),
    arity: 2,
    required: true,
    law: 'CONCRETE on the engine (session-query/src/index.ts:355-361 @639ed01539); the read-window cap (SESSION_QUERY_READ_WINDOW_MAX 50, config.ts:6) stays the SERVICE\'s own typed refusal',
  }),
  authorization: Object.freeze({
    facet: 'authorizationQueryPort',
    methods: Object.freeze(['filterSessions']),
    arity: 2,
    required: true,
    law: 'CONCRETE on the engine (session-query/src/index.ts:206-213 @639ed01539); carries the REAL authorizeTarget/authorizeSessionIds pre-read law (workspace-access.ts:75-90, :111-135)',
  }),
  titles: Object.freeze({
    facet: 'titlesQueryPort',
    methods: Object.freeze(['readTitleSnapshots']),
    arity: 2,
    required: true,
    law: 'CONCRETE on the engine (session-query/src/index.ts:251-259 @639ed01539); carries the native title composition (workspace-access.ts:137-173, presentation titles)',
  }),
})

/** Typed refusal codes owned by this module (all prefixed P_G6_; governance-plane envelopes). */
export const A5_G6_TYPED_CODES = Object.freeze({
  DECLARED_MOUNT_ABSENT: 'P_G6_DECLARED_MOUNT_ABSENT',
  NATIVE_FACE_ABSENT: 'P_G6_NATIVE_FACE_ABSENT',
  INVALID_ARGUMENTS: 'P_G6_INVALID_ARGUMENTS',
  UNKNOWN_PARAMETER: 'P_G6_UNKNOWN_PARAMETER',
  MISSING_PARAMETER: 'P_G6_MISSING_PARAMETER',
  INVALID_QUERY: 'P_G6_INVALID_QUERY',
  INVALID_FILTER: 'P_G6_INVALID_FILTER',
  CALLER_UNAVAILABLE: 'P_G6_CALLER_UNAVAILABLE',
  CALLER_DRIFT: 'P_G6_CALLER_DRIFT',
  PORT_RECEIVER_MOVED: 'P_G6_PORT_RECEIVER_MOVED',
  PORT_METHOD_MOVED: 'P_G6_PORT_METHOD_MOVED',
  PRE_ABORTED: 'P_G6_PRE_ABORTED',
  RESULT_INTEGRITY_INVALID: 'P_G6_RESULT_INTEGRITY_INVALID',
  TEAM_CEILING_DENY: 'P_G6_TEAM_CEILING_DENY',
  DRAINING: 'P_G6_DRAINING',
})

/**
 * Mirror of SAFE_SESSION_QUERY_FAILURES (service-boundary.ts:21-90 @639ed01539).
 * Service-lane failures surface ONLY through this table, so a missing target
 * and a foreign target are never distinguishable through message text.
 */
export const A5_G6_SAFE_SERVICE_FAILURES = Object.freeze({
  SESSION_QUERY_ABORTED: Object.freeze({ code: 'SESSION_QUERY_ABORTED', message: 'session query was cancelled' }),
  SESSION_QUERY_CORRUPT_SESSION: Object.freeze({ code: 'SESSION_QUERY_CORRUPT_SESSION', message: 'session event history is corrupt' }),
  SESSION_QUERY_EVENT_NOT_FOUND: Object.freeze({ code: 'SESSION_QUERY_EVENT_NOT_FOUND', message: 'session event was not found' }),
  SESSION_QUERY_INDEX_FAILED: Object.freeze({ code: 'SESSION_QUERY_INDEX_FAILED', message: 'session search index is unavailable' }),
  SESSION_QUERY_INVALID_CONFIG: Object.freeze({ code: 'SESSION_QUERY_TOOL_FAILED', message: 'session query operation failed' }),
  SESSION_QUERY_INVALID_CURSOR: Object.freeze({ code: 'SESSION_QUERY_INVALID_CURSOR', message: 'session search continuation is invalid' }),
  SESSION_QUERY_INVALID_FILTER: Object.freeze({ code: 'SESSION_QUERY_INVALID_FILTER', message: 'session query filters were rejected' }),
  SESSION_QUERY_INVALID_LIMIT: Object.freeze({ code: 'SESSION_QUERY_INVALID_LIMIT', message: 'session query result limit was rejected' }),
  SESSION_QUERY_INVALID_QUERY: Object.freeze({ code: 'SESSION_QUERY_INVALID_QUERY', message: 'session query was rejected' }),
  SESSION_QUERY_INVALID_LINEAGE: Object.freeze({ code: 'SESSION_QUERY_INVALID_LINEAGE', message: 'session lineage is invalid' }),
  SESSION_QUERY_INVALID_SURFACE: Object.freeze({ code: 'SESSION_QUERY_INVALID_SURFACE', message: 'session event history is invalid' }),
  SESSION_QUERY_INVALID_WINDOW: Object.freeze({ code: 'SESSION_QUERY_INVALID_WINDOW', message: 'session event window is invalid' }),
  SESSION_QUERY_PERSISTENCE_FAILED: Object.freeze({ code: 'SESSION_QUERY_PERSISTENCE_FAILED', message: 'session history storage is unavailable' }),
  SESSION_QUERY_SEARCH_DISABLED: Object.freeze({ code: 'SESSION_QUERY_SEARCH_DISABLED', message: 'session search is disabled in this deployment' }),
  SESSION_QUERY_SESSION_NOT_FOUND: Object.freeze({ code: 'SESSION_QUERY_SESSION_NOT_FOUND', message: 'session was not found' }),
  SESSION_QUERY_STALE_CURSOR: Object.freeze({ code: 'SESSION_QUERY_STALE_CURSOR', message: 'session history changed while paging; retry the complete search call' }),
  SESSION_QUERY_SOURCE_CONFLICT: Object.freeze({ code: 'SESSION_QUERY_TOOL_FAILED', message: 'session query operation failed' }),
})

/**
 * Verbatim blockers carried by the affected rows. Rev 2: TARGET_PREAUTH,
 * PARENT_FILTER and TITLES_PRESENTATION are CLOSED (implemented against the
 * real filterSessions/readTitleSnapshots facets) and removed; silence about a
 * search backend is no longer constructible at all — the factory demands the
 * owning assembly's evidence either way.
 */
export const A5_G6_NAMED_BLOCKERS = Object.freeze({
  SEARCH_BACKEND: 'session_search/session_event_search speak for the ABSTRACT full-text methods searchSessions/searchEvents (session-query/src/index.ts:153-156, :164-167 @639ed01539) which exist only through a composed backend (SqliteSessionQueryEngine @session-query-sqlite/src/index.ts:203, :268, :296; a deployment can also carry SESSION_QUERY_SEARCH_DISABLED @service-boundary.ts:74-77). Activation rides declaredMount.searchBackend {present:true} + the real search facet; INACTIVE rides {present:false, evidence:"<verbatim deployment observation>"} which the factory then REQUIRES to carry no search facet — the assembly never fabricates fake search methods to construct the adapter',
  SESSION_HISTORY_RESOURCE_KIND: 'the closed RESOURCE_KINDS set (workspace|realm-home|absolute-path|directory|metadata|network-destination, domain/tool-governance/src/resource.ts:42-50) carries NO session-history kind, and the closed effect grammar admits a `read` only over a valid ResourceRef (tool-governance effects.ts) — the read rides as tool-invoke over the bound typed port method and the target/workspace facts live in the target manifest; a session-history resource kind is the CENTER\'s grammar close, never an invention here',
})

export const A5_G6_DRAIN_SEMANTICS =
  'drain forbids NEW classify/invoke entries from this point on; a port call already entered is NOT rewound by the row — the sessionQuery service owns its own cancellation (AbortSignal law, session-query/src/index.ts:327-361 @639ed01539); CLOSED is terminal, no resurrection'

/** Row-local typed error for service-lane failures — carries the SAME code+message the native boundary throws (HarnessError/SessionQueryError twin). */
export class G6SessionQueryServiceError extends Error {
  constructor (message, code) {
    super(message)
    this.name = 'G6SessionQueryServiceError'
    this.code = code
  }
}

/** Row-local typed error for governance-plane integrity faults (off-contract port answers). */
export class G6SessionQueryRefusal extends Error {
  constructor (code, detail, facts) {
    super(`${code}: ${detail}`)
    this.name = 'G6SessionQueryRefusal'
    this.code = code
    if (facts !== undefined) this.facts = facts
  }
}

/* ── shared primitives ─────────────────────────────────────────────────── */

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
const canonicalJson = (value) => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const jsonClone = (value) => JSON.parse(JSON.stringify(value))

function refuse (code, detail) {
  return Object.freeze({ ok: false, code, detail })
}

/* ── service-boundary mirror (service-boundary.ts @639ed01539) ──────────── */

function unauthorizedTargetError () {
  // service-boundary.ts:92-97 — THE one existence-safe target failure.
  return new G6SessionQueryServiceError('session target is outside the caller workspace', 'SESSION_QUERY_TOOL_UNAUTHORIZED')
}

function genericFailureError () {
  // service-boundary.ts:143-148.
  return new G6SessionQueryServiceError('session query operation failed', 'SESSION_QUERY_TOOL_FAILED')
}

function isServiceErrorLike (error) {
  // The built host class keeps its constructor name (SessionQueryError
  // @session-query/src/config.ts:49-54); the G6 twin covers the body-law
  // mirrors that throw the same taxonomy in-process.
  if (error instanceof G6SessionQueryServiceError) return true
  return error instanceof Error && typeof error.code === 'string'
    && typeof error.constructor?.name === 'string' && error.constructor.name === 'SessionQueryError'
}

function renderFullErrorChain (error) {
  try {
    if (!(error instanceof Error)) return String(error)
    const diagnostics = []
    const seen = new Set()
    let current = error
    while (current instanceof Error && !seen.has(current)) {
      seen.add(current)
      diagnostics.push(current.stack ?? String(current))
      current = current.cause
    }
    if (current instanceof Error) diagnostics.push('[circular error cause]')
    else if (current !== undefined) diagnostics.push(String(current))
    return diagnostics.join('\nCaused by: ')
  } catch {
    return '[unprintable session query failure]'
  }
}

function sanitizeServiceError (observe, operation, error) {
  // Governance-plane integrity refusals (guardFacts, result-shape guards)
  // are NOT service failures — they pass through unsanitized.
  if (error instanceof G6SessionQueryRefusal) throw error
  // sanitizeError mirror (service-boundary.ts:116-141): full diagnostic is
  // OBSERVED (never model-served); the model sees only safe {code, message}.
  observe({ event: 'service-failure', operation, diagnostic: renderFullErrorChain(error) })
  if (isServiceErrorLike(error) && typeof error.code === 'string'
    && Object.hasOwn(A5_G6_SAFE_SERVICE_FAILURES, error.code)) {
    const failure = A5_G6_SAFE_SERVICE_FAILURES[error.code]
    if (failure.code !== 'SESSION_QUERY_TOOL_FAILED') {
      return new G6SessionQueryServiceError(failure.message, failure.code)
    }
  }
  if (error instanceof Error && error.code === 'SESSION_QUERY_TOOL_UNAUTHORIZED') {
    return unauthorizedTargetError()
  }
  return genericFailureError()
}

/** serviceBoundary.call mirror (:99-114): abort checks around, sanitize on catch. */
async function serviceCall (observe, signal, operation, invoke) {
  signal?.throwIfAborted?.()
  try {
    const value = await invoke()
    signal?.throwIfAborted?.()
    return value
  } catch (error) {
    signal?.throwIfAborted?.()
    throw sanitizeServiceError(observe, operation, error)
  }
}

/* ── input.ts mirrors: the SAME taxonomy and the SAME messages ─────────── */

function normalizeQuery (value) {
  // normalizeQuery (input.ts:126-141). Type truth comes from the CAPTURED
  // schema validation before this runs; hostile types never reach it.
  const query = value.trim().replace(/\s+/gu, ' ')
  if (query.length === 0) {
    throw new G6SessionQueryServiceError('session-search query must contain non-whitespace text', 'SESSION_QUERY_INVALID_QUERY')
  }
  if (query.includes('\0')) {
    throw new G6SessionQueryServiceError('session-search query must not contain NUL', 'SESSION_QUERY_INVALID_QUERY')
  }
  return query
}

function invalidRange (name, detail) {
  return new G6SessionQueryServiceError(`session ${name} range ${detail}`, 'SESSION_QUERY_INVALID_FILTER')
}

function assertNonNegativeSafeInteger (name, value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new G6SessionQueryServiceError(`${name} must be a non-negative safe integer`, 'SESSION_QUERY_INVALID_FILTER')
  }
}

function assertNonEmptyArray (name, values) {
  if (values.length === 0) {
    throw new G6SessionQueryServiceError(`${name} must contain at least one value when supplied`, 'SESSION_QUERY_INVALID_FILTER')
  }
}

function sequenceRange (from, to) {
  if (from !== undefined) assertNonNegativeSafeInteger('sequence lower bound', from)
  if (to !== undefined) assertNonNegativeSafeInteger('sequence upper bound', to)
  if (from !== undefined && to !== undefined && from > to) {
    throw invalidRange('sequence', 'from must be less than or equal to to')
  }
  return {
    ...(from === undefined ? {} : { from }),
    ...(to === undefined ? {} : { to }),
  }
}

const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):(\d{2}))$/

function daysInMonth (year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function parseIsoTimestamp (name, value) {
  const match = ISO_TIMESTAMP.exec(value)
  if (match === null) throw invalidRange(name, 'must be an ISO 8601 timestamp with Z or a numeric offset')
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] ?? 0)
  const offsetHour = Number(match[10] ?? 0)
  const offsetMinute = Number(match[11] ?? 0)
  if (
    month < 1 || month > 12
    || day < 1 || day > daysInMonth(year, month)
    || hour > 23 || minute > 59 || second > 59
    || offsetHour > 23 || offsetMinute > 59
  ) {
    throw invalidRange(name, 'must be a valid ISO 8601 timestamp')
  }
  const fraction = match[7] ?? ''
  const millisecondDigits = fraction.slice(0, 3).padEnd(3, '0')
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`
    + `:${match[6] ?? '00'}.${millisecondDigits}${match[8]}`
  const timestamp = Date.parse(normalized)
  if (!Number.isSafeInteger(timestamp)) throw invalidRange(name, 'must be a valid ISO 8601 timestamp')
  return { millisecond: timestamp, remainder: fraction.slice(3).replace(/0+$/u, '') }
}

function compareTimestamps (left, right) {
  if (left.millisecond !== right.millisecond) return left.millisecond < right.millisecond ? -1 : 1
  const length = Math.max(left.remainder.length, right.remainder.length)
  for (let index = 0; index < length; index += 1) {
    const leftDigit = left.remainder[index] ?? '0'
    const rightDigit = right.remainder[index] ?? '0'
    if (leftDigit !== rightDigit) return leftDigit < rightDigit ? -1 : 1
  }
  return 0
}

function nextUpFinite (value) {
  if (value === 0) return Number.MIN_VALUE
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  view.setBigUint64(0, value > 0 ? bits + 1n : bits - 1n)
  return view.getFloat64(0)
}

function nextDownFinite (value) {
  if (value === 0) return -Number.MIN_VALUE
  const view = new DataView(new ArrayBuffer(8))
  view.setFloat64(0, value)
  const bits = view.getBigUint64(0)
  view.setBigUint64(0, value > 0 ? bits - 1n : bits + 1n)
  return view.getFloat64(0)
}

function timestampRange (name, from, to) {
  if (from === undefined && to === undefined) return undefined
  const fromTimestamp = from === undefined ? undefined : parseIsoTimestamp(`${name}_from`, from)
  const toTimestamp = to === undefined ? undefined : parseIsoTimestamp(`${name}_to`, to)
  if (fromTimestamp !== undefined && toTimestamp !== undefined
    && compareTimestamps(fromTimestamp, toTimestamp) > 0) {
    throw invalidRange(name, 'from must be less than or equal to to')
  }
  return {
    ...(fromTimestamp === undefined ? {} : {
      from: fromTimestamp.remainder.length === 0 ? fromTimestamp.millisecond : nextUpFinite(fromTimestamp.millisecond),
    }),
    ...(toTimestamp === undefined ? {} : {
      to: toTimestamp.remainder.length === 0 ? toTimestamp.millisecond : nextDownFinite(toTimestamp.millisecond + 1),
    }),
  }
}

/** buildSessionFilters mirror (input.ts:88-101): values ride UNCOERCED. */
function buildSessionFilters (args) {
  const filters = []
  if (args.session_ids !== undefined) {
    assertNonEmptyArray('session_ids', args.session_ids)
    filters.push({ kind: 'id', values: [...args.session_ids] })
  }
  const created = timestampRange('created_at', args.created_at_from, args.created_at_to)
  if (created !== undefined) filters.push({ kind: 'created-at', ...created })
  if (args.availability !== undefined) {
    assertNonEmptyArray('availability', args.availability)
    filters.push({ kind: 'availability', values: [...args.availability] })
  }
  return filters
}

/** materializeParentSessionIds mirror (input.ts:103-107): assert + Set dedup. */
function materializeParentSessionIds (values) {
  if (values === undefined) return undefined
  assertNonEmptyArray('parent_session_ids', values)
  return [...new Set(values)]
}

/** buildEventFilters mirror (input.ts:109-124). */
function buildEventFilters (input) {
  const filters = []
  const seq = sequenceRange(input.seqFrom, input.seqTo)
  if (seq.from !== undefined || seq.to !== undefined) filters.push({ kind: 'seq', ...seq })
  const time = timestampRange('time', input.timeFrom, input.timeTo)
  if (time !== undefined) filters.push({ kind: 'time', ...time })
  if (input.eventTypes !== undefined) {
    assertNonEmptyArray('event_types', input.eventTypes)
    filters.push({ kind: 'type', values: [...input.eventTypes] })
  }
  if (input.surfaces !== undefined) {
    assertNonEmptyArray('surfaces', input.surfaces)
    filters.push({ kind: 'surface', values: [...input.surfaces] })
  }
  return filters
}

/* ── captured-schema typed validation (fix 3 — NO coercion) ────────────── */

function schemaProblem (value, schema, path) {
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) return `${path} must be one of ${JSON.stringify(schema.enum)} (captured enum)`
  }
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' ? null : `${path} must be a string — the row validates the CAPTURED schema type and never coerces`
    case 'integer':
      return Number.isInteger(value) ? null : `${path} must be an integer — the row validates the CAPTURED schema type and never coerces`
    case 'number':
      return typeof value === 'number' && Number.isFinite(value) ? null : `${path} must be a finite number (captured schema)`
    case 'boolean':
      return typeof value === 'boolean' ? null : `${path} must be a boolean (captured schema)`
    case 'array': {
      if (!Array.isArray(value)) return `${path} must be an array (captured schema)`
      for (let index = 0; index < value.length; index += 1) {
        const problem = schemaProblem(value[index], schema.items ?? {}, `${path}[${String(index)}]`)
        if (problem !== null) return problem
      }
      return null
    }
    case 'object':
      return isRecord(value) ? null : `${path} must be an object (captured schema)`
    default:
      return null
  }
}

function validateCapturedArgs (face, args) {
  const problems = []
  for (const [key, value] of Object.entries(args)) {
    const property = face.properties[key]
    if (property === undefined) continue // unknown keys are refused separately
    const problem = schemaProblem(value, property, `'${key}'`)
    if (problem !== null) problems.push(problem)
  }
  return problems
}

/* ── workspace law mirrors (workspace-access.ts @639ed01539) ────────────── */

function headerAuthorized (header, caller) {
  // headerAuthorized :96-99 — the caller-self header still rides the cwd rule.
  if (header.id === caller.id) return header.cwd === caller.cwd
  return caller.cwd !== undefined && header.cwd === caller.cwd
}

function recordAuthorized (record, caller) {
  return headerAuthorized(record.header, caller)
}

function assertObservedTargetAuthorized (caller, target, observed) {
  // assertObservedTargetAuthorized :101-109 — observed id AND workspace.
  if (observed.id !== target || !headerAuthorized(observed, caller)) {
    throw unauthorizedTargetError()
  }
}

/**
 * authorizeDescendants mirror (:175-205): iterative; unauthorized → null.
 * Root-1eea delta ②: the Team ceiling intersects the SAME lane — a
 * ceiling-denied subtree is under-disclosed through the same null mechanism
 * (its ids never reach visibleIds/titles and are never named in the output).
 */
function authorizeDescendants (nodes, caller, ceilingAllows = () => true) {
  const result = []
  let pending
  for (const node of [...nodes].reverse()) pending = { node, target: result, next: pending }
  while (pending !== undefined) {
    const current = pending
    pending = current.next
    if (!recordAuthorized(current.node.session, caller) || !ceilingAllows(current.node.session.header.id)) {
      current.target.push(null)
      continue
    }
    const projected = { record: current.node.session, descendants: [] }
    current.target.push(projected)
    for (const child of [...current.node.descendants].reverse()) {
      pending = { node: child, target: projected.descendants, next: pending }
    }
  }
  return result
}

/** visitDescendants mirror (:207-227): LIFO stack, pre-order, depth labels. */
function * visitDescendants (nodes) {
  let pending
  for (const node of [...nodes].reverse()) pending = { node, depth: 0, next: pending }
  while (pending !== undefined) {
    const current = pending
    pending = current.next
    yield current
    if (current.node === null) continue
    for (const child of [...current.node.descendants].reverse()) {
      pending = { node: child, depth: current.depth + 1, next: pending }
    }
  }
}

function descendantIds (nodes) {
  const ids = []
  for (const { node } of visitDescendants(nodes)) {
    if (node !== null) ids.push(node.record.header.id)
  }
  return ids
}

/* ── presentation mirrors (presentation.ts + extraction.ts @639ed01539) ── */

function titleText (view) {
  // workspace-access.ts:237-241.
  return view.unavailableCode === undefined
    ? view.text
    : `${view.text} (title unavailable: ${view.unavailableCode})`
}

function availabilityText (record) {
  return [
    record.live ? 'live' : undefined,
    record.persisted ? 'persisted' : undefined,
  ].filter((value) => value !== undefined).join(', ') || 'unavailable'
}

function seqList (values) {
  return values.length === 0 ? 'none' : values.join(', ')
}

function formatTime (value) {
  return new Date(value).toISOString()
}

function formatEmptySessionSearch () {
  return 'No prior session matches found.'
}

function formatSessionSearch (collected, titles, authorizedParents) {
  if (collected.items.length === 0) return formatEmptySessionSearch()
  const lines = [`Session search results (${collected.items.length}):`]
  for (const [index, hit] of collected.items.entries()) {
    const parent = hit.header.parentSession === undefined
      ? 'root'
      : authorizedParents.has(hit.header.parentSession)
        ? hit.header.parentSession
        : '[outside workspace]'
    const availability = [
      hit.live ? 'live' : undefined,
      hit.persisted ? 'persisted' : undefined,
    ].filter((value) => value !== undefined).join(', ') || 'unavailable'
    lines.push(
      '',
      `${index + 1}. Session ${hit.header.id} — ${titleText(titles.get(hit.header.id))}`,
      `   Created: ${formatTime(hit.header.createdAt)}`,
      `   Parent: ${parent}`,
      `   Availability: ${availability}`,
      `   Best match: seq ${hit.bestMatch.seq} | ${hit.bestMatch.type} | ${hit.bestMatch.surface} | ${formatTime(hit.bestMatch.time)}`,
      `   Snippet: ${hit.bestMatch.snippet}`,
    )
  }
  if (collected.capped) {
    lines.push('', 'Result cap reached. Narrow the query or add filters to find additional matches.')
  }
  return lines.join('\n')
}

function formatEventSearch (sessionId, title, collected) {
  const lines = [`Session ${sessionId} — ${titleText(title)}`]
  if (collected.items.length === 0) {
    lines.push('', 'No prior event matches found.')
    return lines.join('\n')
  }
  lines.push('', `Event search results (${collected.items.length}):`)
  for (const [index, hit] of collected.items.entries()) {
    lines.push(
      `${index + 1}. seq ${hit.seq} | ${hit.type} | ${hit.surface} | ${formatTime(hit.time)}`,
      `   Snippet: ${hit.snippet}`,
    )
  }
  if (collected.capped) {
    lines.push('', 'Result cap reached. Narrow the query or add filters to find additional matches.')
  }
  return lines.join('\n')
}

function renderDescendants (lines, nodes, titles) {
  for (const { node, depth } of visitDescendants(nodes)) {
    const indent = '  '.repeat(depth)
    if (node === null) {
      lines.push(`${indent}- [outside workspace subtree]`)
      continue
    }
    const id = node.record.header.id
    lines.push(`${indent}- ${id} — ${titleText(titles.get(id))} | ${formatTime(node.record.header.createdAt)} | ${availabilityText(node.record)}`)
  }
}

function formatSessionTrace (trace, ancestors, ancestorBoundary, descendants, titles) {
  const lines = [
    `Session ${trace.target.header.id} — ${titleText(titles.get(trace.target.header.id))}`,
    `Created: ${formatTime(trace.target.header.createdAt)}`,
    `Availability: ${availabilityText(trace.target)}`,
    '',
    'Ancestors (nearest first):',
  ]
  if (ancestors.length === 0 && !ancestorBoundary) lines.push('- none (target is a root session)')
  for (const record of ancestors) {
    lines.push(`- ${record.header.id} — ${titleText(titles.get(record.header.id))} | ${formatTime(record.header.createdAt)} | ${availabilityText(record)}`)
  }
  if (ancestorBoundary) lines.push('- [outside workspace boundary]')
  lines.push('', 'Descendants:')
  if (descendants.length === 0) lines.push('- none')
  else renderDescendants(lines, descendants, titles)
  return lines.join('\n')
}

function formatEventTrace (sessionId, title, trace) {
  return [
    `Session ${sessionId} — ${titleText(title)}`,
    `Target: seq ${trace.target.seq} | ${trace.target.type} | ${trace.target.surface} | ${formatTime(trace.target.time)}`,
    `Replaced by: ${trace.replacedBy ?? 'none'}`,
    `Replacement chain: ${seqList(trace.replacementChain)}`,
    `Events replaced by target: ${seqList(trace.replacedEventSeqs)}`,
    `Events cited directly as sources: ${seqList(trace.sourceEventSeqs)}`,
    `Direct derived events: ${seqList(trace.derivedEventSeqs)}`,
  ].join('\n')
}

/* extractSessionEventText mirror (extraction.ts:15-87): the same first-party
 * semantic text lanes; unknown events stay non-searchable. */
function joinText (parts) {
  return parts.map((part) => part.trim()).filter(Boolean).join('\n')
}

function blockText (block) {
  switch (block.type) {
    case 'text':
      return [block.text]
    case 'reasoning':
      return []
    case 'tool-call':
      return [block.name, block.arguments]
    default:
      return []
  }
}

function contentText (content) {
  return joinText(content.flatMap(blockText))
}

function turnEndText (reason) {
  switch (reason.kind) {
    case 'error':
      return joinText(['error', reason.error.message])
    case 'aborted':
      return 'aborted'
    case 'max-tokens':
    case 'interrupted':
      return reason.kind
    case 'completed':
      return ''
    default:
      return ''
  }
}

function extractSessionEventText (event) {
  switch (event.type) {
    case 'user/message':
      return contentText(event.data.content)
    case 'assistant/message':
      return contentText(event.data.message.content)
    case 'tool/call':
      return joinText([event.data.name, event.data.arguments])
    case 'tool/result':
      return joinText([
        contentText(event.data.message.content),
        event.data.error?.name ?? '',
        event.data.error?.code ?? '',
      ])
    case 'todo/write':
      return joinText(event.data.todos.flatMap((todo) => [todo.status, todo.content]))
    case 'turn/end':
      return turnEndText(event.data.reason)
    default:
      return ''
  }
}

function formatNeighbor (event) {
  const text = extractSessionEventText(event)
  return `- seq ${event.seq} | ${event.type} | ${formatTime(event.time)}`
    + (text.length === 0 ? ' | (no semantic text)' : `\n  ${text.replaceAll('\n', '\n  ')}`)
}

function formatEventRead (sessionId, title, window) {
  const before = window.events.filter((event) => event.seq < window.target.seq)
  const after = window.events.filter((event) => event.seq > window.target.seq)
  const lines = [
    `Session ${sessionId} — ${titleText(title)}`,
    `Target event seq ${window.target.seq}:`,
    '```json',
    JSON.stringify(window.target, null, 2),
    '```',
  ]
  if (before.length > 0) {
    lines.push('', 'Before:')
    for (const event of before) lines.push(formatNeighbor(event))
  }
  if (after.length > 0) {
    lines.push('', 'After:')
    for (const event of after) lines.push(formatNeighbor(event))
  }
  return lines.join('\n')
}

/* ── the collectPages mirror (operations.ts:244-277 @639ed01539) ────────── */

async function collectPages (maxResults, signal, request, accept, revalidate) {
  const items = []
  const seen = new Set()
  let cursor
  for (;;) {
    signal?.throwIfAborted?.()
    // ROOT-16:47 delta ③: every continuation REQUEST CONSTRUCTION — the
    // second page and beyond — is itself a revalidation point: the cursor
    // is only baked into a new request after the current caller/boundary/
    // service/ceiling passed the freshness gate.
    revalidate?.(cursor === undefined ? 'page request' : 'cursor-continuation request')
    const page = await request(cursor)
    signal?.throwIfAborted?.()
    if (!isRecord(page) || !Array.isArray(page.items)) {
      throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.RESULT_INTEGRITY_INVALID, 'the port answered an off-contract page (SessionSearchPage.items is a readonly array, types.ts:231-236 @639ed01539) — refusing to page further or to serve the page')
    }
    for (const item of page.items) {
      if (!accept(item)) continue
      if (items.length === maxResults) return { items, capped: true }
      items.push(item)
    }
    if (page.nextCursor === undefined) return { items, capped: false }
    if (seen.has(page.nextCursor)) {
      // operations.ts:268-274 — the native cursor-loop law rides the service
      // taxonomy (SESSION_QUERY_INVALID_CURSOR), never a row-local code.
      throw new G6SessionQueryServiceError('session-search provider repeated a continuation cursor', 'SESSION_QUERY_INVALID_CURSOR')
    }
    seen.add(page.nextCursor)
    cursor = page.nextCursor
  }
}

/* ── the five typed tool specs ───────────────────────────────────────────── */

const TOOL_SPECS = Object.freeze({
  // hasTarget: the tool resolves an EFFECTIVE TARGET SESSION (explicit
  // session_id or the caller) that the Team allow ceiling must intersect —
  // all four session_id-taking tools, session_event_search INCLUDED
  // (root-1eea delta ①); the cross-session search has no single target and
  // rides the ceiling per result/parent instead.
  session_search: Object.freeze({
    operation: 'search-across-sessions',
    portFamily: 'search',
    portMethod: 'searchSessions',
    hasTarget: false,
    mountCondition: 'declared_mount',
    nativeCite: 'tool-session-query/src/index.ts:65-73 @639ed01539',
    serviceCite: 'ctx.sessionQuery.searchSessions — abstract @session-query/src/index.ts:153-156, concrete @session-query-sqlite/src/index.ts:268 @639ed01539',
    facetsUsed: Object.freeze([
      ['searchQueryPort', 'searchSessions'],
      ['authorizationQueryPort', 'filterSessions'],
      ['titlesQueryPort', 'readTitleSnapshots'],
    ]),
  }),
  session_event_search: Object.freeze({
    operation: 'search-within-session',
    portFamily: 'search',
    portMethod: 'searchEvents',
    hasTarget: true,
    mountCondition: 'declared_mount',
    nativeCite: 'tool-session-query/src/index.ts:75-83 @639ed01539',
    serviceCite: 'ctx.sessionQuery.searchEvents — abstract @session-query/src/index.ts:164-167, concrete @session-query-sqlite/src/index.ts:296 @639ed01539',
    facetsUsed: Object.freeze([
      ['searchQueryPort', 'searchEvents'],
      ['authorizationQueryPort', 'filterSessions'],
      ['titlesQueryPort', 'readTitleSnapshots'],
    ]),
  }),
  session_trace: Object.freeze({
    operation: 'trace-session-lineage',
    portFamily: 'trace',
    portMethod: 'traceSession',
    hasTarget: true,
    mountCondition: 'always',
    nativeCite: 'tool-session-query/src/index.ts:85-93 @639ed01539',
    serviceCite: 'ctx.sessionQuery.traceSession — concrete @session-query/src/index.ts:327-331 @639ed01539',
    facetsUsed: Object.freeze([
      ['traceQueryPort', 'traceSession'],
      ['authorizationQueryPort', 'filterSessions'],
      ['titlesQueryPort', 'readTitleSnapshots'],
    ]),
  }),
  session_event_trace: Object.freeze({
    operation: 'trace-event-relationships',
    portFamily: 'trace',
    portMethod: 'traceEvent',
    hasTarget: true,
    mountCondition: 'always',
    nativeCite: 'tool-session-query/src/index.ts:95-106 @639ed01539',
    serviceCite: 'ctx.sessionQuery.traceEvent — concrete @session-query/src/index.ts:340-347 @639ed01539',
    facetsUsed: Object.freeze([
      ['traceQueryPort', 'traceEvent'],
      ['authorizationQueryPort', 'filterSessions'],
      ['titlesQueryPort', 'readTitleSnapshots'],
    ]),
  }),
  session_event_read: Object.freeze({
    operation: 'read-event-window',
    portFamily: 'eventRead',
    portMethod: 'readEvent',
    hasTarget: true,
    mountCondition: 'always',
    nativeCite: 'tool-session-query/src/index.ts:108-121 @639ed01539',
    serviceCite: 'ctx.sessionQuery.readEvent — concrete @session-query/src/index.ts:355-361 @639ed01539',
    facetsUsed: Object.freeze([
      ['eventReadQueryPort', 'readEvent'],
      ['authorizationQueryPort', 'filterSessions'],
      ['titlesQueryPort', 'readTitleSnapshots'],
    ]),
  }),
})

/**
 * The per-tool body-law mirrors the native operation runs (input.ts via
 * operations.ts). THROW the native taxonomy; classify converts a THROW into
 * the planning-plane envelope, invoke lets the SAME error ride to the caller.
 */
function classifyToolArgs (toolName, args, caller) {
  if (toolName === 'session_search') {
    if (caller.cwd === undefined) {
      // operations.ts:63-68 — the cross-session lane needs a workspace.
      throw new G6SessionQueryServiceError('cross-session search is unavailable because the caller session has no workspace', 'SESSION_QUERY_TOOL_UNAUTHORIZED')
    }
    const query = normalizeQuery(args.query)
    const sessionFilters = buildSessionFilters(args)
    const eventFilters = buildEventFilters({
      seqFrom: args.event_seq_from,
      seqTo: args.event_seq_to,
      timeFrom: args.event_time_from,
      timeTo: args.event_time_to,
      eventTypes: args.event_types,
      surfaces: args.event_surfaces,
    })
    const requestedParentIds = materializeParentSessionIds(args.parent_session_ids)
    return {
      checks: {
        query,
        sessionFilters,
        eventFilters,
        requestedParentIds,
        includeRootSessions: args.include_root_sessions === true,
      },
    }
  }
  if (toolName === 'session_event_search') {
    const query = normalizeQuery(args.query)
    const range = sequenceRange(args.seq_from, args.seq_to)
    // Dry-validate the remaining clauses; the FULL filter build happens at
    // the entry (operations.ts:144-151 rebuilds from the step-capped range).
    timestampRange('time', args.time_from, args.time_to)
    if (args.event_types !== undefined) assertNonEmptyArray('event_types', args.event_types)
    if (args.surfaces !== undefined) assertNonEmptyArray('surfaces', args.surfaces)
    return { checks: { query, seqRange: range } }
  }
  if (toolName === 'session_trace') return { checks: {} }
  if (toolName === 'session_event_trace') {
    assertNonNegativeSafeInteger('seq', args.seq)
    return { checks: {} }
  }
  assertNonNegativeSafeInteger('seq', args.seq)
  if (args.before !== undefined) assertNonNegativeSafeInteger('before', args.before)
  if (args.after !== undefined) assertNonNegativeSafeInteger('after', args.after)
  return { checks: {} }
}

const BODY_LAW_CODES = Object.freeze({
  SESSION_QUERY_INVALID_QUERY: A5_G6_TYPED_CODES.INVALID_QUERY,
  SESSION_QUERY_INVALID_FILTER: A5_G6_TYPED_CODES.INVALID_FILTER,
})

function requireCaller (readCaller, label) {
  let caller
  try {
    caller = readCaller()
  } catch {
    return { refusal: refuse(A5_G6_TYPED_CODES.CALLER_UNAVAILABLE, `${label}: readCaller threw — the caller identity the tool law needs (workspace-access.callerOf @workspace-access.ts:56-69) cannot be observed; fail closed`) }
  }
  if (!isRecord(caller) || typeof caller.id !== 'string' || caller.id.length === 0) {
    return { refusal: refuse(A5_G6_TYPED_CODES.CALLER_UNAVAILABLE, `${label}: readCaller must answer {id, cwd, boundary} mirroring workspace-access.callerOf (workspace-access.ts:56-69 @639ed01539); the row never invents a caller`) }
  }
  return { caller: { id: caller.id, cwd: caller.cwd, boundary: caller.boundary } }
}

/* ── the placement-time factory ──────────────────────────────────────────── */

/**
 * Build the five governed rows. HARD-VISITED config (a defect throws at
 * placement, never at call): identity; the four REQUIRED typed facets (the
 * search facet rides the deployment evidence law and may be ABSENT);
 * readCaller; the Team ceiling; the searchBackend evidence either way.
 *
 * @param deps {{
 *   realmId: string,
 *   providerId: string,
 *   readNative: (name: string) => ({ name: string, description: string,
 *     parameters: object, output?: { schema: unknown }, execute: Function }
 *     | undefined | null),   // production: name => ctx.tools.get(name, scope)
 *   queryPorts: {
 *     searchQueryPort?: { searchSessions: Function, searchEvents: Function },
 *     traceQueryPort: { traceSession: Function, traceEvent: Function },
 *     eventReadQueryPort: { readEvent: Function },
 *     authorizationQueryPort: { filterSessions: Function },
 *     titlesQueryPort: { readTitleSnapshots: Function },
 *   },
 *   readCaller: () => ({ id: string, cwd?: string, boundary?: {
 *     lastStepStartSeq?: number | null } } | undefined),
 *   teamCeiling: (targetSessionId: string, caller: { id: string, cwd?: string }) => boolean,
 *   declaredMount: { searchBackend: { present: true } | { present: false, evidence: string } },
 *   maxSearchResults?: number,   // mirrors DEFAULT_MAX_SEARCH_RESULTS 100 (index.ts:22)
 *   definitionIdentityOf?: (definition) => string,
 *   observe?: (event) => void,
 * }}
 * @returns {{ rows: Record<string, object>, portFamilies, safeServiceFailures, namedBlockers, typedCodes }}
 */
export function createG6SessionQueryAdapter (deps = {}) {
  const { realmId, providerId, readNative, queryPorts, readCaller, teamCeiling, declaredMount, definitionIdentityOf, observe = () => {} } = deps
  if (typeof realmId !== 'string' || realmId.length === 0) throw new TypeError('g6-session-query: realmId is required')
  if (typeof providerId !== 'string' || providerId.length === 0) throw new TypeError('g6-session-query: providerId is required (the placing assembly identifies itself)')
  if (typeof readNative !== 'function') throw new TypeError('g6-session-query: readNative(name) is required — the tools.get(name, scope) capture seam; the rows carry CAPTURED native description bytes, never re-authored text')
  if (typeof readCaller !== 'function') throw new TypeError('g6-session-query: readCaller is required — every delegation resolves the effective target through the caller law (workspace-access.callerOf @workspace-access.ts:56-69 + targetId :71-73 @639ed01539); the row never invents a caller')
  if (typeof teamCeiling !== 'function') throw new TypeError('g6-session-query: teamCeiling(targetSessionId, caller) is required — the Team allow ceiling INTERSECTED with the service-side pre-authorization; without a ceiling there is no Team read law to enforce')
  if (!isRecord(queryPorts)) throw new TypeError('g6-session-query: queryPorts {searchQueryPort?, traceQueryPort, eventReadQueryPort, authorizationQueryPort, titlesQueryPort} is required — one typed facet per real service method family, never a shared string-dispatch wrapper')

  const backend = declaredMount?.searchBackend
  if (!isRecord(backend) || typeof backend.present !== 'boolean') {
    throw new TypeError('g6-session-query: declaredMount.searchBackend is required as REAL deployment evidence — {present:true} when the assembly has composed a backend answering the ABSTRACT search methods, or {present:false, evidence:"<verbatim observation>"} keeping the two search rows honest INACTIVE; an assembly WITHOUT a search backend provides present:false + evidence and NO searchQueryPort — the adapter constructs without any fake search method, and silence is a placement defect (misconfiguration fails loud)')
  }
  const searchFacet = queryPorts.searchQueryPort
  if (backend.present === false) {
    if (typeof backend.evidence !== 'string' || backend.evidence.trim().length === 0) {
      throw new TypeError('g6-session-query: declaredMount.searchBackend {present:false} must carry the verbatim deployment evidence string (the observation that keeps the search rows INACTIVE) — an un-evidenced INACTIVE is a silent capability lie')
    }
    if (searchFacet !== undefined) {
      throw new TypeError('g6-session-query: the evidence says no search backend is composed, yet queryPorts.searchQueryPort was supplied — the contradiction is refused; do not wire search methods the deployment does not have')
    }
  }
  if (backend.present === true && searchFacet === undefined) {
    throw new TypeError('g6-session-query: declaredMount.searchBackend {present:true} claims a composed backend but queryPorts.searchQueryPort is absent — the evidence and the wiring must agree')
  }

  for (const [familyKey, family] of Object.entries(A5_G6_PORT_FAMILIES)) {
    const facet = queryPorts[family.facet]
    if (facet === undefined) {
      if (family.required) {
        throw new TypeError(`g6-session-query: queryPorts.${family.facet} is required (the ${familyKey} family; ${family.law})`)
      }
      continue
    }
    if (!isRecord(facet)) {
      throw new TypeError(`g6-session-query: queryPorts.${family.facet} must be one facet object (the real service instance; ${family.law}) — the receiver identity is enforced per dispatch`)
    }
    for (const method of family.methods) {
      const fn = facet[method]
      if (typeof fn !== 'function') {
        throw new TypeError(`g6-session-query: queryPorts.${family.facet}.${method} must be a function — the port mirrors the real service method VERBATIM (${family.law})`)
      }
      if (fn.length !== family.arity) {
        throw new TypeError(`g6-session-query: queryPorts.${family.facet}.${method} must carry the real signature's ${family.arity} formal parameters (the optional exec/signal half is PART of the declared face — session-query/src/index.ts:153-167, :206-213, :251-259, :327-361 @639ed01539); a ${fn.length}-arg stand-in is a signature drift`)
      }
    }
  }
  const maxSearchResults = deps.maxSearchResults ?? 100
  if (!Number.isSafeInteger(maxSearchResults) || maxSearchResults < 1) {
    throw new TypeError('g6-session-query: maxSearchResults must be a positive safe integer (mirrors DEFAULT_MAX_SEARCH_RESULTS, tool-session-query/src/index.ts:22 @639ed01539)')
  }

  const searchDeclared = backend.present === true
  const searchBlockDetail = `[deployment evidence] ${backend.present === false ? backend.evidence : 'searchBackend evidence present:true'} — ${A5_G6_NAMED_BLOCKERS.SEARCH_BACKEND}`

  const rows = {}
  for (const toolName of A5_G6_TOOL_NAMES) {
    rows[toolName] = buildG6Row({
      toolName,
      spec: TOOL_SPECS[toolName],
      realmId,
      providerId,
      readNative,
      queryPorts,
      readCaller,
      teamCeiling,
      definitionIdentityOf,
      observe,
      maxSearchResults,
      searchDeclared,
      searchBlockDetail,
    })
  }
  return Object.freeze({
    adapterRevision: A5_G6_ADAPTER_REVISION,
    familyId: A5_G6_FAMILY,
    rows: Object.freeze(rows),
    portFamilies: A5_G6_PORT_FAMILIES,
    safeServiceFailures: A5_G6_SAFE_SERVICE_FAILURES,
    namedBlockers: A5_G6_NAMED_BLOCKERS,
    typedCodes: A5_G6_TYPED_CODES,
  })
}

function buildG6Row ({ toolName, spec, realmId, providerId, readNative, queryPorts, readCaller, teamCeiling, definitionIdentityOf, observe, maxSearchResults, searchDeclared, searchBlockDetail }) {
  const declaredActive = spec.mountCondition === 'declared_mount' ? searchDeclared : true
  const declaredDetail = spec.mountCondition === 'declared_mount' ? searchBlockDetail : ''

  let capture = null
  const definition = readNative(toolName)
  if (isRecord(definition) && definition.name === toolName && typeof definition.description === 'string'
    && isRecord(definition.parameters) && typeof definition.execute === 'function') {
    const parametersFace = g3CanonicalRegistrationFace(definition.parameters)
    const effectsProblem = validateRowEffects(toolName)
    if (effectsProblem !== null) throw new TypeError(`g6-session-query/${toolName}: ${effectsProblem}`)
    capture = Object.freeze({
      definition,
      description: definition.description, // CAPTURED native description bytes
      parametersFace,
      outputSchema: isRecord(definition.output) && definition.output.schema !== undefined
        ? deepFreeze(jsonClone(definition.output.schema))
        : null,
      definitionIdentity: typeof definitionIdentityOf === 'function'
        ? String(definitionIdentityOf(definition) ?? '') || null
        : null,
    })
  }

  // RECEIVER + METHOD pinned at placement (fix 5): the facet OBJECT is the
  // service instance `this` must stay bound to; the function object is the
  // bound face. Every port call goes through these refs, never a live lookup.
  const facetRefs = {}
  for (const [facetName] of spec.facetsUsed) {
    const facet = queryPorts[facetName]
    if (facet === undefined) continue
    const methods = {}
    for (const family of Object.values(A5_G6_PORT_FAMILIES)) {
      if (family.facet !== facetName) continue
      for (const method of family.methods) methods[method] = facet[method]
    }
    facetRefs[facetName] = { object: facet, methods }
  }

  let draining = false
  let seq = 0
  let lastDispatch = null

  const row = {
    active: declaredActive,
    familyId: A5_G6_FAMILY,
    adapterRevision: A5_G6_ADAPTER_REVISION,
    toolName,
    operation: spec.operation,
    mountCondition: spec.mountCondition,
    realmId,
    providerId,
    portFamily: spec.portFamily,
    portMethod: spec.portMethod,
    nativeCite: spec.nativeCite,
    serviceCite: spec.serviceCite,
    /** Verbatim native description bytes; null when nothing was captured. */
    description: capture === null ? null : capture.description,
    registrationSchema: capture === null ? null : deepFreeze({
      parameters: capture.parametersFace,
      ...(capture.outputSchema === null ? {} : { output: capture.outputSchema }),
    }),
    captured: () => capture !== null,
    definitionIdentity: capture === null ? null : capture.definitionIdentity,
    namedBlockers: Object.freeze([A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND]),
    classify (args) {
      if (draining) return refuse(A5_G6_TYPED_CODES.DRAINING, 'the row is DRAINING: no call reaches the port and nothing falls back to native')
      if (!declaredActive) return refuse(A5_G6_TYPED_CODES.DECLARED_MOUNT_ABSENT, `${toolName}: ${declaredDetail}`)
      if (capture === null) {
        return refuse(A5_G6_TYPED_CODES.NATIVE_FACE_ABSENT, `the native "${toolName}" definition was not visible on the bind-time capture seam — the row refuses typed and NEVER substitutes a body or re-authors a schema (${spec.nativeCite})`)
      }
      if (!isRecord(args)) return refuse(A5_G6_TYPED_CODES.INVALID_ARGUMENTS, 'model arguments must be one JSON object')
      const face = capture.parametersFace
      const known = new Set(Object.keys(face.properties))
      for (const key of Object.keys(args)) {
        if (!known.has(key)) {
          return refuse(A5_G6_TYPED_CODES.UNKNOWN_PARAMETER, `'${key}' is not a parameter of the CAPTURED ${toolName} schema (${spec.nativeCite})`)
        }
      }
      for (const required of face.required ?? []) {
        if (args[required] === undefined) {
          return refuse(A5_G6_TYPED_CODES.MISSING_PARAMETER, `required parameter '${required}' is absent (captured compiled schema required array)`)
        }
      }
      // Typed validation against the CAPTURED compiled schema (fix 3) —
      // type/enum/items of the COMPILED bytes; nothing is coerced.
      const schemaProblems = validateCapturedArgs(face, args)
      if (schemaProblems.length > 0) {
        return refuse(A5_G6_TYPED_CODES.INVALID_ARGUMENTS, `arguments violate the CAPTURED compiled schema: ${schemaProblems.join('; ')}`)
      }
      const caller = requireCaller(readCaller, toolName)
      if (caller.refusal !== undefined) return caller.refusal
      let built
      try {
        built = classifyToolArgs(toolName, args, caller.caller)
      } catch (error) {
        if (error instanceof G6SessionQueryServiceError) {
          // The planning plane surfaces the SAME taxonomy as the invoke-time
          // throw, with the native message riding verbatim in the detail.
          const code = BODY_LAW_CODES[error.code] ?? A5_G6_TYPED_CODES.INVALID_ARGUMENTS
          return refuse(code, `${error.code}: ${error.message} (service-lane semantics; invoke would throw this exact failure)`)
        }
        throw error
      }
      const effectiveTarget = args.session_id ?? caller.caller.id
      // hasTarget rows (ALL FOUR session_id-taking tools — session_event_search
      // included; root-1eea delta ①: port family is no excuse) ride the Team
      // ceiling on their effective target. The cross-session search has no
      // single target and rides the ceiling in the result/parent lanes.
      if (spec.hasTarget && teamCeiling(effectiveTarget, caller.caller) !== true) {
        return refuse(A5_G6_TYPED_CODES.TEAM_CEILING_DENY, teamCeilingDetail(effectiveTarget))
      }
      seq += 1
      const correlation = `g6.${A5_G6_FAMILY}.${toolName}.r${A5_G6_ADAPTER_REVISION}.${String(seq)}`
      const effects = rowEffects(toolName)
      const effectsParse = parseRequestedEffectSet(effects)
      if (effectsParse.ok !== true) {
        return refuse(A5_G6_TYPED_CODES.INVALID_ARGUMENTS, `the row built effects its own closed grammar rejects: ${String(effectsParse.problems?.[0]?.detail ?? 'parse refused')}`)
      }
      const targetManifest = deepFreeze({
        toolName,
        operation: spec.operation,
        portFamily: spec.portFamily,
        portMethod: spec.portMethod,
        effectiveTargetSessionId: typeof effectiveTarget === 'string' ? effectiveTarget : null,
        callerWorkspaceCwd: typeof caller.caller.cwd === 'string' ? caller.caller.cwd : null,
        // APPROVED OMISSION LAW (root 19:25, wiring-owner measurement
        // g6-session-query-wiring.mjs:92-96): the family-rules table denies
        // key-with-undefined by design and the lossless walk kills it too —
        // so the MINT must not emit it: non-search rows OMIT the key
        // entirely (hasOwnProperty false), search rows keep the effective
        // cap value byte-unchanged.
        ...(spec.portFamily === 'search' ? { maxSearchResults } : {}),
        disclosures: [A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND],
      })
      const reviewPayload = deepFreeze({
        familyId: A5_G6_FAMILY,
        adapterRevision: A5_G6_ADAPTER_REVISION,
        providerIdentity: providerId,
        definitionIdentity: capture.definitionIdentity,
        targetManifest,
      })
      const plan = deepFreeze({
        correlation,
        toolName,
        actualArgs: deepFreeze(jsonClone(args)),
        checks: deepFreeze(built.checks),
        callerSnapshot: deepFreeze({ id: caller.caller.id, cwd: caller.caller.cwd ?? null, boundary: caller.caller.boundary === undefined ? null : deepFreeze(jsonClone(caller.caller.boundary)) }),
        effects,
        targetManifest,
        reviewPayload,
        parametersFingerprint: `sha256:${sha256(canonicalJson({ realmId, providerId, toolName, reviewPayload, actualArgs: args }))}`,
      })
      return deepFreeze({
        ok: true,
        correlation: plan.correlation,
        effects: plan.effects,
        targetManifest: plan.targetManifest,
        reviewPayload: plan.reviewPayload,
        parametersFingerprint: plan.parametersFingerprint,
        plan,
      })
    },
    async invoke (args, exec = {}) {
      const plan = row.classify(args)
      if (plan.ok !== true) return plan
      // PER-DISPATCH RECEIVER + IDENTITY RE-VERIFY (fix 5): the facet OBJECT
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
      }
      const callerNow = requireCaller(readCaller, toolName)
      if (callerNow.refusal !== undefined) return callerNow.refusal
      if (callerNow.caller.id !== plan.plan.callerSnapshot.id
        || (callerNow.caller.cwd ?? null) !== plan.plan.callerSnapshot.cwd
        || canonicalJson(callerNow.caller.boundary ?? null) !== canonicalJson(plan.plan.callerSnapshot.boundary)) {
        return refuse(A5_G6_TYPED_CODES.CALLER_DRIFT, 'the caller identity/workspace/step-boundary moved between classify and the port entry — the plan is stale, not re-approvable; zero forwarding')
      }
      const signal = exec?.signal
      if (signal?.aborted === true) {
        return refuse(A5_G6_TYPED_CODES.PRE_ABORTED, "the caller's signal was already aborted before this call was admitted — nothing started, zero port entry")
      }
      const caller = callerNow.caller
      const effectiveTarget = plan.plan.actualArgs.session_id ?? caller.id
      if (spec.hasTarget && teamCeiling(effectiveTarget, caller) !== true) {
        return refuse(A5_G6_TYPED_CODES.TEAM_CEILING_DENY, teamCeilingDetail(effectiveTarget))
      }
      // REVOCATION LAW (root-1eea delta ③): from entry admission on, EVERY
      // service dispatch — every page, every title read — AND the final serve
      // re-verify the CURRENT caller id/cwd/step-boundary, the pinned
      // receiver objects + method objects, and the Team ceiling decision. A
      // revocation landing across an await is NEVER served on the stale
      // authorization: the row throws the SAME governance codes through
      // G6SessionQueryRefusal (the entry envelope shape only fronts failures
      // observable before admission). Already-entered port calls are not
      // rewound (the drain semantics); nothing further enters and nothing
      // serves. The contract here is the LIVE decision port — no stale
      // revision snapshot is trusted.
      const planCallerSnapshot = plan.plan.callerSnapshot
      const guardFacts = (stage) => {
        for (const [guardFacet, guardMethod] of spec.facetsUsed) {
          const ref = facetRefs[guardFacet]
          if (ref === undefined || queryPorts[guardFacet] !== ref.object) {
            throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.PORT_RECEIVER_MOVED, `${stage}: the live ${guardFacet} is no longer the RECEIVER OBJECT pinned at placement — zero further forwarding`)
          }
          if (ref.object[guardMethod] !== ref.methods[guardMethod]) {
            throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.PORT_METHOD_MOVED, `${stage}: the live ${guardFacet}.${guardMethod} is no longer the function OBJECT pinned at placement — zero further forwarding`)
          }
        }
        const now = requireCaller(readCaller, toolName)
        if (now.refusal !== undefined) throw new G6SessionQueryRefusal(now.refusal.code, `${stage}: ${now.refusal.detail}`)
        if (now.caller.id !== planCallerSnapshot.id
          || (now.caller.cwd ?? null) !== planCallerSnapshot.cwd
          || canonicalJson(now.caller.boundary ?? null) !== canonicalJson(planCallerSnapshot.boundary)) {
          throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.CALLER_DRIFT, `${stage}: the caller identity/workspace/step-boundary moved after this call was admitted — the authorization is revoked; in-flight effects are not rewound, but no further port entry and nothing is served`)
        }
        if (spec.hasTarget && teamCeiling(effectiveTarget, now.caller) !== true) {
          throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.TEAM_CEILING_DENY, `${stage}: the Team ceiling revoked the effective target '${String(effectiveTarget)}' after admission — nothing is served`)
        }
        return now.caller
      }
      let portCalls = 0
      const call = async (facetName, method, operation, ...portArgs) => {
        guardFacts(`dispatch ${facetName}.${method}`)
        const ref = facetRefs[facetName]
        portCalls += 1
        // this === the pinned receiver object, always (fix 5).
        const answered = await serviceCall(observe, signal, operation, () => ref.methods[method].call(ref.object, ...portArgs))
        // ROOT-16:47 delta ②: EVERY await resumption re-reads the CURRENT
        // caller id/cwd/step-boundary, the pinned receiver + method objects
        // and the live Team ceiling. Drift across an await is a ZERO-FORWARD
        // refusal with the closed codes: the entered effect is not rewound
        // (drain semantics), nothing further dispatches, nothing serves.
        guardFacts(`resumption ${facetName}.${method}`)
        return answered
      }
      const readTitleSnapshots = async (requestedIds) => {
        // ROOT-16:47 delta ①: title lookups that cross into ANCESTOR /
        // DESCENDANT / hit sessions pass the SAME live teamCeiling decision
        // gate as targets — a denied id never enters the title port at all.
        // (The classify+invoke target double-gate and the per-dispatch guard
        // remain the earlier gates; this is the title lane's own gate.)
        const ids = requestedIds.filter((id) => teamCeiling(id, caller) === true)
        if (ids.length === 0) return new Map()
        const observations = await call('titlesQueryPort', 'readTitleSnapshots', 'title observation', ids, signal)
        const titles = new Map()
        if (!Array.isArray(observations)) {
          throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.RESULT_INTEGRITY_INVALID, 'readTitleSnapshots must answer SessionTitleObservationResult[] (types.ts:170-183 @639ed01539)')
        }
        for (const observation of observations) {
          if (observation.status === 'rejected') {
            const sanitized = sanitizeServiceError(observe, 'title observation item', observation.reason)
            if (sanitized.code === 'SESSION_QUERY_TOOL_UNAUTHORIZED') throw sanitized
            titles.set(observation.sessionId, { text: 'untitled', unavailableCode: sanitized.code })
            continue
          }
          assertObservedTargetAuthorized(caller, observation.sessionId, observation.value.session)
          titles.set(observation.sessionId, { text: observation.value.title?.title ?? 'untitled' })
        }
        return titles
      }
      const readTitle = async (id) => (await readTitleSnapshots([id])).get(id)
      // authorizeTarget mirror (workspace-access.ts:75-90): caller-self
      // short-circuits; everything else passes filterSessions id+cwd BEFORE
      // any read — missing and foreign targets answer the ONE safe failure.
      const authorizeTarget = async (target) => {
        if (target === caller.id) return
        if (caller.cwd === undefined) throw unauthorizedTargetError()
        const records = await call('authorizationQueryPort', 'filterSessions', 'target authorization', [
          { kind: 'id', values: [target] },
          { kind: 'cwd', values: [caller.cwd] },
        ], signal)
        if (!Array.isArray(records) || records.length !== 1) throw unauthorizedTargetError()
      }
      // authorizeSessionIds mirror (:111-135).
      const authorizeSessionIds = async (ids) => {
        const unique = [...new Set(ids)]
        const authorized = new Set()
        if (unique.includes(caller.id)) authorized.add(caller.id)
        const other = unique.filter((id) => id !== caller.id)
        if (caller.cwd === undefined || other.length === 0) return authorized
        const records = await call('authorizationQueryPort', 'filterSessions', 'session-id authorization', [
          { kind: 'id', values: other },
          { kind: 'cwd', values: [caller.cwd] },
        ], signal)
        const requested = new Set(other)
        for (const record of records) {
          if (requested.has(record.header.id) && recordAuthorized(record, caller)) authorized.add(record.header.id)
        }
        return authorized
      }
      const ceilingOpen = (id) => teamCeiling(id, caller) === true
      const observeFacts = (extra) => {
        lastDispatch = deepFreeze({
          row: toolName,
          portFamily: spec.portFamily,
          portMethod: spec.portMethod,
          capturedAt: 'row-invoke',
          effectiveTargetSessionId: typeof effectiveTarget === 'string' ? effectiveTarget : null,
          callerFingerprint: `sha256:${sha256(canonicalJson({ id: caller.id, cwd: caller.cwd ?? null }))}`,
          parametersFingerprint: plan.parametersFingerprint,
          portCalls,
          ...extra,
        })
        observe({ event: 'dispatch', facts: lastDispatch })
      }
      const serve = (value, outputMembers) => {
        const guardCaller = guardFacts('final serve')
        // ROOT-65c539 FINAL MEMBER RECHECK: the guards above only re-decide
        // the EFFECTIVE TARGET; a result SET (search hits, authorized
        // parents, trace lineage members) was assembled from members that
        // passed the ceiling EARLIER. If the live decision revokes any
        // member across an await (e.g. during the title read), the stale
        // set is NEVER served: the final output membership is re-verified
        // against the CURRENT authorization and any revocation refuses the
        // WHOLE result (entered effects stay, nothing serves).
        if (outputMembers !== undefined) {
          for (const member of outputMembers) {
            if (teamCeiling(member, guardCaller) !== true) {
              throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.TEAM_CEILING_DENY, `final serve: the Team ceiling revoked set member '${String(member)}' during this operation — the whole result is refused, nothing is served on a stale authorization`)
            }
          }
        }
        observeFacts({ served: 'string' })
        return deepFreeze({ ok: true, value, plan: plan.plan })
      }
      // From here on the row mirrors the native operation byte-for-byte;
      // service-lane failures THROW the mirrored safe failures (fix 2).
      if (toolName === 'session_search') {
        if (caller.cwd === undefined) {
          throw new G6SessionQueryServiceError('cross-session search is unavailable because the caller session has no workspace', 'SESSION_QUERY_TOOL_UNAUTHORIZED')
        }
        const { query, eventFilters, requestedParentIds, includeRootSessions } = plan.plan.checks
        const sessionFilters = jsonClone(plan.plan.checks.sessionFilters)
        if (requestedParentIds !== undefined || includeRootSessions) {
          // REAL parent authorization (fix 6): filterSessions-authorized ∩
          // ceiling; `null` rides the root clause only when include is true.
          const authorizedParents = requestedParentIds === undefined
            ? new Set()
            : await authorizeSessionIds(requestedParentIds)
          const parentValues = requestedParentIds === undefined
            ? []
            : requestedParentIds.filter((id) => authorizedParents.has(id) && ceilingOpen(id))
          if (includeRootSessions) parentValues.push(null)
          if (parentValues.length === 0) return serve(formatEmptySessionSearch())
          sessionFilters.push({ kind: 'parent', values: parentValues })
        }
        sessionFilters.push({ kind: 'cwd', values: [caller.cwd] })
        const request = { query, sessionFilters, eventFilters: jsonClone(eventFilters) }
        const collected = await collectPages(
          maxSearchResults,
          signal,
          (cursor) => call('searchQueryPort', 'searchSessions', 'session search', { ...request, ...(cursor === undefined ? {} : { cursor }) }, { signal }),
          (hit) => isRecord(hit?.header) && hit.header.id !== caller.id && headerAuthorized(hit.header, caller) && ceilingOpen(hit.header.id),
          guardFacts,
        )
        const parentIds = collected.items
          .map((hit) => hit.header.parentSession)
          .filter((id) => id !== undefined)
        const displayAuthorized = await authorizeSessionIds(parentIds)
        const authorizedParents = new Set([...displayAuthorized].filter((id) => ceilingOpen(id)))
        const titles = await readTitleSnapshots(collected.items.map((hit) => hit.header.id))
        return serve(
          formatSessionSearch(collected, titles, authorizedParents),
          [...collected.items.map((hit) => hit.header.id), ...authorizedParents],
        )
      }
      if (toolName === 'session_event_search') {
        const { query } = plan.plan.checks
        await authorizeTarget(effectiveTarget)
        let range = { ...plan.plan.checks.seqRange }
        if (effectiveTarget === caller.id) {
          if (caller.boundary === undefined || caller.boundary.lastStepStartSeq === undefined) {
            // operations.ts:128-135 — native safe failure, no row-local code.
            throw new G6SessionQueryServiceError('current-session search requires an active step boundary', 'SESSION_QUERY_TOOL_NO_CURRENT_STEP')
          }
          range = { ...range, to: Math.min(range.to ?? Number.MAX_SAFE_INTEGER, (caller.boundary.lastStepStartSeq ?? 0) - 1) }
        }
        const title = await readTitle(effectiveTarget)
        if (range.from !== undefined && range.to !== undefined && range.from > range.to) {
          return serve(formatEventSearch(effectiveTarget, title, { items: [], capped: false }), [effectiveTarget])
        }
        // FULL filter build from the (possibly step-capped) range; a degenerate
        // capped bound rides the native INVALID_FILTER taxonomy (the loop
        // never runs tools outside a step).
        const filters = buildEventFilters({
          seqFrom: range.from,
          seqTo: range.to,
          timeFrom: plan.plan.actualArgs.time_from,
          timeTo: plan.plan.actualArgs.time_to,
          eventTypes: plan.plan.actualArgs.event_types,
          surfaces: plan.plan.actualArgs.surfaces,
        })
        const request = { sessionId: effectiveTarget, query, filters }
        const collected = await collectPages(
          maxSearchResults,
          signal,
          async (cursor) => {
            const page = await call('searchQueryPort', 'searchEvents', 'event search', { ...request, ...(cursor === undefined ? {} : { cursor }) }, { signal })
            assertObservedTargetAuthorized(caller, effectiveTarget, page.session)
            return page
          },
          () => true,
          guardFacts,
        )
        return serve(formatEventSearch(effectiveTarget, title, collected), [effectiveTarget])
      }
      if (toolName === 'session_trace') {
        await authorizeTarget(effectiveTarget)
        const trace = await call('traceQueryPort', 'traceSession', 'session lineage trace', effectiveTarget, signal)
        assertObservedTargetAuthorized(caller, effectiveTarget, trace.target.header)
        const ancestors = []
        let ancestorBoundary = false
        for (const ancestor of trace.ancestors) {
          // Root-1eea delta ②: the ancestor lane intersects the Team ceiling
          // — a ceiling-denied ancestor stops the display at the boundary
          // note and never reaches visibleIds/title reads.
          if (!recordAuthorized(ancestor, caller) || !ceilingOpen(ancestor.header.id)) {
            ancestorBoundary = true
            break
          }
          ancestors.push(ancestor)
        }
        if (ancestors.length === trace.ancestors.length && !trace.complete) ancestorBoundary = true
        const descendants = authorizeDescendants(trace.descendants, caller, ceilingOpen)
        const visibleIds = [
          trace.target.header.id,
          ...ancestors.map((record) => record.header.id),
          ...descendantIds(descendants),
        ]
        const titles = await readTitleSnapshots(visibleIds)
        return serve(formatSessionTrace(trace, ancestors, ancestorBoundary, descendants, titles), visibleIds)
      }
      if (toolName === 'session_event_trace') {
        await authorizeTarget(effectiveTarget)
        const trace = await call('traceQueryPort', 'traceEvent', 'event trace', { sessionId: effectiveTarget, seq: plan.plan.actualArgs.seq }, signal)
        assertObservedTargetAuthorized(caller, effectiveTarget, trace.session)
        const title = await readTitle(effectiveTarget)
        return serve(formatEventTrace(effectiveTarget, title, trace), [effectiveTarget])
      }
      // session_event_read
      await authorizeTarget(effectiveTarget)
      const window = await call('eventReadQueryPort', 'readEvent', 'event read', {
        sessionId: effectiveTarget,
        seq: plan.plan.actualArgs.seq,
        // keys present ONLY when supplied (operations.ts:232-238 @639ed01539)
        ...(plan.plan.actualArgs.before === undefined ? {} : { before: plan.plan.actualArgs.before }),
        ...(plan.plan.actualArgs.after === undefined ? {} : { after: plan.plan.actualArgs.after }),
      }, signal)
      assertObservedTargetAuthorized(caller, effectiveTarget, window.session)
      const title = await readTitle(effectiveTarget)
      return serve(formatEventRead(effectiveTarget, title, window), [effectiveTarget])
    },
    drainSemantics: A5_G6_DRAIN_SEMANTICS,
    drain () {
      draining = true
    },
    draining: () => draining,
    lastDispatch: () => lastDispatch,
  }
  if (!declaredActive) {
    // Honest INACTIVE row (evidence-backed): the record exists for the census;
    // every call refuses with the assembly's verbatim deployment evidence;
    // zero substitution, zero port entry.
    row.classify = () => refuse(A5_G6_TYPED_CODES.DECLARED_MOUNT_ABSENT, `${toolName}: ${declaredDetail}`)
    row.invoke = async () => refuse(A5_G6_TYPED_CODES.DECLARED_MOUNT_ABSENT, `${toolName}: ${declaredDetail}`)
  }
  return row

  function teamCeilingDetail (target) {
    return `the Team allow ceiling (teamCeiling port) denies this member the effective target '${String(target)}' — the read requires BOTH the service-side pre-authorization AND the ceiling (intersection law); refusal is PRE-READ with zero port entry and carries no existence information`
  }
}

function rowEffects (toolName) {
  // The session-history read envelope CANNOT ride as a resource effect: the
  // closed RESOURCE_KINDS set (workspace|realm-home|absolute-path|directory/
  // metadata/network-destination, domain/tool-governance/src/resource.ts:42-50)
  // carries no session-history kind, and the closed effect grammar accepts a
  // `read` ONLY over a valid ResourceRef — inventing a kind is forbidden (G1
  // record-91 law: a gap is reported, never faked). The read rides as the
  // tool-invoke over the bound typed port method; the effective target and
  // workspace scope live in the target manifest, and the missing resource
  // dimension is this file's named residual (A5_G6_NAMED_BLOCKERS
  // .SESSION_HISTORY_RESOURCE_KIND).
  return Object.freeze([
    Object.freeze({ kind: 'tool-invoke', toolName, resource: null }),
  ])
}

function validateRowEffects (toolName) {
  const parsed = parseRequestedEffectSet(rowEffects(toolName))
  return parsed.ok === true ? null : `the row's own effect grammar refuses its effect set: ${String(parsed.problems?.[0]?.detail ?? 'parse refused')}`
}
