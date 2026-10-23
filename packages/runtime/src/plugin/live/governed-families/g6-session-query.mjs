/**
 * governed-families/g6-session-query.mjs — A5-M2 G6 REAL-QUERY ADAPTER for the
 * five host session-intelligence tools (session_search / session_trace /
 * session_event_read / session_event_search / session_event_trace). A
 * placement-time factory takes (a) the CAPTURED native tool faces and (b) an
 * INJECTED TYPED QUERY PORT that mirrors the real `ctx.sessionQuery`
 * (SessionQueryEngine) method families VERBATIM, and returns five typed
 * governed rows. The rows carry the CAPTURED native description bytes and the
 * captured compiled parameter schema, enforce the tool body's own argument
 * laws, and DELEGATE to the port — never a generic tool-invoke shell, never a
 * shared string-dispatch wrapper: five typed rows, five captured real
 * parameter schemas, one typed port facet per real service method family
 * (search vs trace vs event-read), each row bound to ONE named port method.
 *
 * UNWIRED: nothing here mounts itself; placement/registration is the CENTER's.
 * No Host boot, no network. Legs in a5m2-g6-session-query-c1.test.ts run the
 * REAL captured native faces (the built tool plugin's apply() is executed to
 * capture them) against FAKE PORTS that record exact call tuples — the fake
 * port is a test-owned double and proves no real-Service dimension.
 *
 * ── REAL-FACE LEDGER (comment-side ONLY; every fact @639ed01539, pristine
 * host checkout tests/deepseek-harness-test-use; paths relative to its
 * packages/) ────────────────────────────────────────────────────────────────
 * Tool surface — session-query/tool-session-query/src/index.ts
 *   plugin name 'tool-session-query' :16; inject ['tools','systemPrompt',
 *   'sessionQuery','sessionProjections'] :19; DEFAULT_MAX_SEARCH_RESULTS 100
 *   :22; shared TEXT_OUTPUT {schema:{type:'string'}} :46-49; apply() :57.
 *   Five ctx.tools.register(defineTool(…)) calls:
 *     session_search       register :65-73  name :66  description :67
 *                          parameters toolInput.sessionSearchParameters :68
 *                          execute → operations.executeSessionSearch :71
 *     session_event_search register :75-83  name :76  description :77
 *                          parameters toolInput.eventSearchParameters :78
 *                          execute → operations.executeEventSearch :81
 *     session_trace        register :85-93  name :86  description :87
 *                          parameters toolInput.targetSessionParameter :88
 *                          isConcurrencySafe :90
 *                          execute → operations.executeSessionTrace :91
 *     session_event_trace  register :95-106 name :96  description :97
 *                          parameters targetSessionParameter + seq :98-101
 *                          execute → operations.executeEventTrace :104
 *     session_event_read   register :108-121 name :109 description :110
 *                          parameters + seq/before/after :111-116
 *                          execute → operations.executeEventRead :119
 * Parameter DSL — tool-session-query/src/input.ts (authored BEFORE the
 *   defineTool lift): sessionSearchParameters :45-67; eventSearchParameters
 *   :69-82; targetSessionParameter :84-86; buildSessionFilters :88-101
 *   (id/created-at/availability clauses; brandString is TYPE-LEVEL only, the
 *   runtime values are plain strings :92/:106); materializeParentSessionIds
 *   :103-107; buildEventFilters :109-124 (seq/time/type/surface clauses);
 *   normalizeQuery :126-141 (trim, collapse whitespace, non-empty, no NUL);
 *   sequenceRange :143-156 (non-negative safe ints, from<=to); ISO
 *   timestamps :158-269 (ISO_TIMESTAMP :179-180; parseIsoTimestamp
 *   :188-221; compareTimestamps :223-234; sub-ms bounds via
 *   nextUpFinite/nextDownFinite :236-264; daysInMonth :266-269);
 *   assertNonNegativeSafeInteger :278-285; assertNonEmptyArray :287-294.
 *   The CLOSED LANES the schemas declare: availability ∈ {live, persisted}
 *   (input.ts:52-56), surfaces/event_surfaces ∈ {current, shadowed,
 *   log-only} (input.ts:62-66, :77-81).
 * The lift that turns authored DSL into the registration face —
 *   core/tools/src/schema.ts: ParameterSchemaSpec (implicit open object root,
 *   per-property required marker) :102-107; parameterSchemaSpecToJsonSchema
 *   :449-458 (parent-level required array + assertSupportedJsonSchema);
 *   defineTool :554-632 compiles at :577 and re-validates model args at
 *   execute time :579, :598-599; json-schema.ts assertSupportedJsonSchema
 *   :385. The CAPTURED native definition already carries the COMPILED
 *   product — g3CanonicalRegistrationFace carries it verbatim.
 * Real query services (the port mirrors these signatures VERBATIM) —
 *   session-query/src/index.ts: the Service Definition declares `sessionQuery`
 *   on Context :85-89; abstract class SessionQueryEngine extends Service :98,
 *   static inject ['sessions'] :99, service name 'sessionQuery' :106. THE
 *   BACKEND LAW (:91-97): "Exact reads, filters, and traces are
 *   backend-independent concrete behavior. A backend implements full-text
 *   observation, reconciliation, ranking, cursor generations, and query
 *   execution on the same ctx.sessionQuery service."
 *     SEARCH FAMILY (ABSTRACT — backend-composed):
 *       searchSessions(request: SessionSearchRequest,
 *         exec?: SessionSearchExecContext): Promise<SessionSearchPage<
 *         SessionSearchHit>>                       :153-156
 *       searchEvents(request: SessionEventSearchRequest,
 *         exec?: SessionSearchExecContext): Promise<SessionEventSearchPage>
 *                                                  :164-167
 *       concrete implementation: SqliteSessionQueryEngine extends
 *       SessionQueryEngine (session-query-sqlite/src/index.ts:203), overrides
 *       searchSessions :268 / searchEvents :296.
 *     TRACE FAMILY (CONCRETE on the engine):
 *       traceSession(sessionId: SessionId, signal?: AbortSignal):
 *         Promise<SessionLineageTrace>             :327-331
 *       traceEvent(request: SessionEventTraceRequest, signal?: AbortSignal):
 *         Promise<SessionEventTraceObservation>    :340-347
 *     EVENT-READ FAMILY (CONCRETE on the engine):
 *       readEvent(request: SessionEventReadRequest, signal?: AbortSignal):
 *         Promise<SessionEventWindow>              :355-361
 *   Call sites the delegation mirrors — tool-session-query/src/operations.ts:
 *   searchSessions(request {query, sessionFilters, eventFilters, cursor?},
 *   {signal}) :94-100 with the caller cwd clause pushed LAST (:90) and the
 *   per-hit accept filter (exclude caller, workspace-authorize) :101;
 *   searchEvents(request {sessionId, query, filters, cursor?}, {signal})
 *   :156-162 with the observed-header re-assert :163; traceSession(sessionId,
 *   signal) :179-180 + target assert :181 + ancestor stop-at-first-
 *   unauthorized :183-192 + descendant authorization :193; traceEvent(
 *   {sessionId, seq}, signal) :213-214 + assert :215; readEvent({sessionId,
 *   seq, before?, after?} — keys present ONLY when supplied —, signal)
 *   :232-238 + assert :239; the page-collection loop collectPages :244-277
 *   (maxResults cap :262-264, repeated-cursor guard :268-274).
 * Canonical result members (the shape the rows validate before serving) —
 *   session-query/src/types.ts: SessionEventSurface 'current'|'shadowed'|
 *   'log-only' :24; SessionRecord {header, live, persisted} :27-34;
 *   SessionLineageNode {session, descendants} :73-78; SessionLineageTrace
 *   {target, ancestors, descendants} & ({complete:true, root} |
 *   {complete:false, unresolvedParentId}) :81-101; SessionEventTraceRequest
 *   {sessionId, seq} :104-109; SessionEventTrace {target, replacedBy?,
 *   replacementChain, replacedEventSeqs, sourceEventSeqs, derivedEventSeqs}
 *   :112-125; SessionEventTraceObservation extends it with {session} :128-131;
 *   SessionEventReadRequest {sessionId, seq, before?, after?} :134-143;
 *   SessionEventWindow {session, inheritedEventCount, target, events,
 *   startSeq, endSeq} :146-159; SessionResultFilter (closed clause set
 *   id/cwd/created-at/parent/availability) :203-208; SessionEventMetadataFilter
 *   (seq/time/type/surface) :214-222; SessionSearchPage {items, nextCursor?}
 *   :231-236; SessionEventSearchPage extends it with {session} :239-242;
 *   SessionSearchExecContext {signal?} :245-248; SessionSearchRequest
 *   {query, sessionFilters?, eventFilters?, limit?, cursor?} :251-262;
 *   SessionEventSearchRequest {sessionId, query, filters?, limit?, cursor?}
 *   :265-276; SessionEventSearchHit extends SessionEventRecord with {snippet}
 *   :279-282; SessionSearchHit extends SessionRecord with {bestMatch}
 *   :285-288; SessionEventRecord {sessionId, seq, type, time, surface}
 *   :59-70; SessionSearchCursor is a branded STRING (cursor.ts:6, brand
 *   factory :13-15). Read-window bound: SESSION_QUERY_READ_WINDOW_MAX 50
 *   (config.ts:6) enforced by the SERVICE (_readWindow :396-405) — the row
 *   mirrors only the tool-level non-negative-integer law (operations.ts:225-
 *   228), the window cap stays the service's own typed refusal.
 * Caller/workspace law the delegation mirrors —
 *   tool-session-query/src/workspace-access.ts: caller from exec.agent +
 *   turnBoundary projection :56-69; effective target = session_id ?? caller
 *   :71-73; headerAuthorized :96-99 (same-cwd rule, caller-self still cwd-
 *   checked); assertObservedTargetAuthorized :101-109 (observed id AND
 *   workspace); authorizeDescendants :175-205 (unauthorized → null).
 *   CURRENT-step law: operations.ts:128-139 (searching the CALLER's own
 *   session excludes the step performing the call; a missing boundary is a
 *   typed failure, a null lastStepStartSeq caps the range to a degenerate
 *   negative `to` that the sequence law then refuses).
 * ───────────────────────────────────────────────────────────────────────────
 *
 * MOUNT LAW (the honest 2/3 split, straight from the Service Definition):
 *  - session_trace / session_event_trace / session_event_read —
 *    mountCondition 'always': traceSession/traceEvent/readEvent are CONCRETE
 *    methods on the engine itself (index.ts:327/:340/:355; backend law
 *    :91-97).
 *  - session_search / session_event_search — mountCondition 'declared_mount':
 *    searchSessions/searchEvents are ABSTRACT on the Service Definition
 *    (:153-156, :164-167) and exist only through a composed backend
 *    (session-query-sqlite/src/index.ts:203/:268/:296); a deployment may also
 *    carry the backend with search DISABLED (SESSION_QUERY_SEARCH_DISABLED is
 *    a first-class model-safe failure, service-boundary.ts:74-77). Backend
 *    presence is a composition fact the OWNING assembly observes and the row
 *    cannot; without `declaredMount.searchBackend.present === true` the two
 *    rows stay honest INACTIVE with the verbatim blocker — nothing mounts,
 *    nothing substitutes.
 *
 * NAMED RESIDUALS (reported, never faked):
 *  - TARGET PRE-AUTHORIZATION: the native body pre-authorizes a foreign
 *    target via ctx.sessionQuery.filterSessions BEFORE the read
 *    (workspace-access.ts:75-90); filterSessions is NOT one of the three
 *    port families this card mounts. The rows enforce the SAME workspace rule
 *    AT THE SERVING EDGE against the port's own observed header
 *    (assertObservedTargetAuthorized mirror, workspace-access.ts:101-109) —
 *    an unauthorized target's data is never SERVED — but the unauthorized
 *    read itself still crosses the port boundary before the refusal. Closing
 *    that pre-read leg needs a filterSessions facet from the CENTER.
 *  - PARENT LANE: session_search's parent_session_ids/include_root_sessions
 *    require authorizeSessionIds over filterSessions
 *    (operations.ts:79-89, workspace-access.ts:111-135). Without that facet
 *    the row REFUSES the parent-lane arguments typed instead of projecting
 *    an un-authorized parent filter.
 *  - TITLES/PRESENTATION: native text output composes titles via
 *    readTitleSnapshots (operations.ts:107-114, :199, :216, :240) and
 *    presentation.ts; the row returns the TYPED service result instead —
 *    the captured native output schema ({type:'string'}, index.ts:46-49)
 *    rides the registration face for the CENTER's placement; text rendering
 *    is not re-implemented here.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g6-session-query
 */
import { createHash } from 'node:crypto'

import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import { g3CanonicalRegistrationFace } from './g3-fsproc-adapters.mjs'

export const A5_G6_ADAPTER_REVISION = 1
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
 * The three typed port facets, mirroring the real service method families
 * VERBATIM (every real signature has TWO formal parameters — the search
 * family's `exec?: SessionSearchExecContext` and the trace/read families'
 * `signal?: AbortSignal` are part of the declared face; index.ts:153-167,
 * :327-361 @639ed01539). Arity is checked at mount: the injected facet's
 * method must be a 2-formal function — a 1-arg stand-in is a shape drift,
 * not a simplification.
 */
export const A5_G6_PORT_FAMILIES = Object.freeze({
  search: Object.freeze({
    facet: 'searchQueryPort',
    methods: Object.freeze(['searchSessions', 'searchEvents']),
    arity: 2,
    law: 'ABSTRACT on SessionQueryEngine (session-query/src/index.ts:153-156, :164-167 @639ed01539); concrete only through a composed backend (SqliteSessionQueryEngine, session-query-sqlite/src/index.ts:203, :268, :296)',
  }),
  trace: Object.freeze({
    facet: 'traceQueryPort',
    methods: Object.freeze(['traceSession', 'traceEvent']),
    arity: 2,
    law: 'CONCRETE on the engine (session-query/src/index.ts:327-331, :340-347 @639ed01539) — backend-independent exact traces (law :91-97)',
  }),
  eventRead: Object.freeze({
    facet: 'eventReadQueryPort',
    methods: Object.freeze(['readEvent']),
    arity: 2,
    law: 'CONCRETE on the engine (session-query/src/index.ts:355-361 @639ed01539); the read-window cap (SESSION_QUERY_READ_WINDOW_MAX 50, config.ts:6) stays the SERVICE\'s own typed refusal',
  }),
})

/** Typed refusal codes owned by this module (all prefixed P_G6_). */
export const A5_G6_TYPED_CODES = Object.freeze({
  DECLARED_MOUNT_ABSENT: 'P_G6_DECLARED_MOUNT_ABSENT',
  NATIVE_FACE_ABSENT: 'P_G6_NATIVE_FACE_ABSENT',
  INVALID_ARGUMENTS: 'P_G6_INVALID_ARGUMENTS',
  UNKNOWN_PARAMETER: 'P_G6_UNKNOWN_PARAMETER',
  MISSING_PARAMETER: 'P_G6_MISSING_PARAMETER',
  INVALID_QUERY: 'P_G6_INVALID_QUERY',
  INVALID_FILTER: 'P_G6_INVALID_FILTER',
  PARENT_FILTER_UNAUTHORIZABLE: 'P_G6_PARENT_FILTER_UNAUTHORIZABLE',
  CALLER_UNAVAILABLE: 'P_G6_CALLER_UNAVAILABLE',
  CALLER_WORKSPACE_ABSENT: 'P_G6_CALLER_WORKSPACE_ABSENT',
  CURRENT_STEP_BOUNDARY_ABSENT: 'P_G6_CURRENT_STEP_BOUNDARY_ABSENT',
  CALLER_DRIFT: 'P_G6_CALLER_DRIFT',
  PORT_METHOD_MOVED: 'P_G6_PORT_METHOD_MOVED',
  PRE_ABORTED: 'P_G6_PRE_ABORTED',
  TARGET_UNAUTHORIZED: 'P_G6_TARGET_UNAUTHORIZED',
  RESULT_SHAPE_INVALID: 'P_G6_RESULT_SHAPE_INVALID',
  CURSOR_LOOP: 'P_G6_CURSOR_LOOP',
  DRAINING: 'P_G6_DRAINING',
})

/**
 * Verbatim blockers carried by every affected row (the INACTIVE search rows
 * carry SEARCH_BACKEND verbatim; the residuals ride every manifest).
 */
export const A5_G6_NAMED_BLOCKERS = Object.freeze({
  SEARCH_BACKEND: 'session_search/session_event_search speak for the ABSTRACT full-text methods searchSessions/searchEvents (session-query/src/index.ts:153-156, :164-167 @639ed01539) which exist only through a composed backend (SqliteSessionQueryEngine @session-query-sqlite/src/index.ts:203, :268, :296; a deployment can also carry SESSION_QUERY_SEARCH_DISABLED @service-boundary.ts:74-77) — backend presence is a composition fact ONLY the owning assembly observes; without declaredMount.searchBackend.present === true these rows stay INACTIVE: nothing mounts, nothing substitutes',
  TARGET_PREAUTH: 'the native body pre-authorizes foreign targets via ctx.sessionQuery.filterSessions (workspace-access.ts:75-90 @639ed01539) which is NOT one of the three mounted port families; the row enforces the same workspace rule AT the serving edge against the port\'s observed header (assertObservedTargetAuthorized mirror @workspace-access.ts:101-109) so unauthorized data is never SERVED, but the pre-read itself crosses the port boundary — the filterSessions facet is the CENTER\'s close',
  PARENT_FILTER: 'session_search parent_session_ids/include_root_sessions require authorizeSessionIds over filterSessions (operations.ts:79-89 + workspace-access.ts:111-135 @639ed01539); without that facet the row REFUSES these arguments typed rather than projecting an un-authorized parent filter',
  TITLES_PRESENTATION: 'native text output composes titles via readTitleSnapshots (operations.ts:107-114/:199/:216/:240 @639ed01539); the row returns the TYPED service result — the captured native output schema {type:\'string\'} (@tool-session-query/src/index.ts:46-49) rides the registration face and text rendering stays the CENTER\'s placement',
  SESSION_HISTORY_RESOURCE_KIND: 'the closed RESOURCE_KINDS set (workspace|realm-home|absolute-path|directory|metadata|network-destination, domain/tool-governance/src/resource.ts:42-50) carries NO session-history kind, and the closed effect grammar admits a `read` only over a valid ResourceRef (tool-governance effects.ts) — the read rides as tool-invoke over the bound typed port method and the target/workspace facts live in the target manifest; a session-history resource kind is the CENTER\'s grammar close, never an invention here',
})

export const A5_G6_DRAIN_SEMANTICS =
  'drain forbids NEW classify/invoke entries from this point on; a port call already entered is NOT rewound by the row — the sessionQuery service owns its own cancellation (AbortSignal law, session-query/src/index.ts:327-361 @639ed01539); CLOSED is terminal, no resurrection'

/** Row-local typed error for THROW-class runtime faults (mirrors where the real body throws). */
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

/* ── argument-law mirrors of tool-session-query/src/input.ts ────────────── */

/** normalizeQuery mirror (input.ts:126-141 @639ed01539). */
function normalizeQuery (value) {
  if (typeof value !== 'string') return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_ARGUMENTS, 'query must be a string (input.ts:46/:71 @639ed01539)') }
  const query = value.trim().replace(/\s+/gu, ' ')
  if (query.length === 0) return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_QUERY, 'session-search query must contain non-whitespace text (normalizeQuery law, input.ts:126-141 @639ed01539)') }
  if (query.includes('\0')) return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_QUERY, 'session-search query must not contain NUL (input.ts:134-139 @639ed01539)') }
  return { query }
}

/** assertNonNegativeSafeInteger mirror (input.ts:278-285 @639ed01539). */
function nonNegativeSafeInteger (name, value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    return refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `${name} must be a non-negative safe integer (input.ts:278-285 @639ed01539)`)
  }
  return null
}

/** assertNonEmptyArray mirror (input.ts:287-294 @639ed01539). */
function nonEmptyArray (name, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `${name} must contain at least one value when supplied (input.ts:287-294 @639ed01539)`)
  }
  return null
}

/** sequenceRange mirror (input.ts:143-156 @639ed01539). */
function sequenceRange (from, to) {
  if (from !== undefined) {
    const problem = nonNegativeSafeInteger('sequence lower bound', from)
    if (problem !== null) return { refusal: problem }
  }
  if (to !== undefined) {
    const problem = nonNegativeSafeInteger('sequence upper bound', to)
    if (problem !== null) return { refusal: problem }
  }
  if (from !== undefined && to !== undefined && from > to) {
    return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_FILTER, 'session sequence range from must be less than or equal to to (input.ts:149-151 @639ed01539)') }
  }
  return {
    range: {
      ...(from === undefined ? {} : { from }),
      ...(to === undefined ? {} : { to }),
    },
  }
}

/* ISO timestamp mirror (input.ts:158-269 @639ed01539): same grammar, same
 * validation, same sub-millisecond boundary law (nextUp/nextDown). */
const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|([+-])(\d{2}):(\d{2}))$/

function daysInMonth (year, month) {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

function parseIsoTimestamp (name, value) {
  if (typeof value !== 'string') return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `${name} must be an ISO 8601 timestamp with Z or a numeric offset (input.ts:188-192 @639ed01539)`) }
  const match = ISO_TIMESTAMP.exec(value)
  if (match === null) return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `${name} must be an ISO 8601 timestamp with Z or a numeric offset (ISO_TIMESTAMP @input.ts:179-180)`) }
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
    return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `${name} must be a valid ISO 8601 timestamp (input.ts:201-208 @639ed01539)`) }
  }
  const fraction = match[7] ?? ''
  const millisecondDigits = fraction.slice(0, 3).padEnd(3, '0')
  const normalized = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}`
    + `:${match[6] ?? '00'}.${millisecondDigits}${match[8]}`
  const timestamp = Date.parse(normalized)
  if (!Number.isSafeInteger(timestamp)) {
    return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `${name} must be a valid ISO 8601 timestamp (input.ts:213-216 @639ed01539)`) }
  }
  return { timestamp: { millisecond: timestamp, remainder: fraction.slice(3).replace(/0+$/u, '') } }
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
  if (from === undefined && to === undefined) return { range: undefined }
  const parsedFrom = from === undefined ? undefined : parseIsoTimestamp(`${name}_from`, from)
  if (parsedFrom?.refusal !== undefined) return { refusal: parsedFrom.refusal }
  const parsedTo = to === undefined ? undefined : parseIsoTimestamp(`${name}_to`, to)
  if (parsedTo?.refusal !== undefined) return { refusal: parsedTo.refusal }
  if (parsedFrom?.timestamp !== undefined && parsedTo?.timestamp !== undefined
    && compareTimestamps(parsedFrom.timestamp, parsedTo.timestamp) > 0) {
    return { refusal: refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `session ${name} range from must be less than or equal to to (input.ts:166-172 @639ed01539)`) }
  }
  return {
    range: {
      ...(parsedFrom?.timestamp === undefined ? {} : {
        from: parsedFrom.timestamp.remainder.length === 0
          ? parsedFrom.timestamp.millisecond
          : nextUpFinite(parsedFrom.timestamp.millisecond),
      }),
      ...(parsedTo?.timestamp === undefined ? {} : {
        to: parsedTo.timestamp.remainder.length === 0
          ? parsedTo.timestamp.millisecond
          : nextDownFinite(parsedTo.timestamp.millisecond + 1),
      }),
    },
  }
}

/** buildSessionFilters mirror (input.ts:88-101 @639ed01539; brandString is
 *  type-level only — the runtime filter values are plain strings). */
function buildSessionFilters (args) {
  const filters = []
  if (args.session_ids !== undefined) {
    const problem = nonEmptyArray('session_ids', args.session_ids)
    if (problem !== null) return { refusal: problem }
    filters.push({ kind: 'id', values: args.session_ids.map((value) => String(value)) })
  }
  const created = timestampRange('created_at', args.created_at_from, args.created_at_to)
  if (created.refusal !== undefined) return { refusal: created.refusal }
  if (created.range !== undefined) filters.push({ kind: 'created-at', ...created.range })
  if (args.availability !== undefined) {
    const problem = nonEmptyArray('availability', args.availability)
    if (problem !== null) return { refusal: problem }
    filters.push({ kind: 'availability', values: [...args.availability] })
  }
  return { filters }
}

/** buildEventFilters mirror (input.ts:109-124 @639ed01539). */
function buildEventFilters (input) {
  const filters = []
  const seq = sequenceRange(input.seqFrom, input.seqTo)
  if (seq.refusal !== undefined) return { refusal: seq.refusal }
  if (seq.range.from !== undefined || seq.range.to !== undefined) filters.push({ kind: 'seq', ...seq.range })
  const time = timestampRange('time', input.timeFrom, input.timeTo)
  if (time.refusal !== undefined) return { refusal: time.refusal }
  if (time.range !== undefined) filters.push({ kind: 'time', ...time.range })
  if (input.eventTypes !== undefined) {
    const problem = nonEmptyArray('event_types', input.eventTypes)
    if (problem !== null) return { refusal: problem }
    filters.push({ kind: 'type', values: [...input.eventTypes] })
  }
  if (input.surfaces !== undefined) {
    const problem = nonEmptyArray('surfaces', input.surfaces)
    if (problem !== null) return { refusal: problem }
    filters.push({ kind: 'surface', values: [...input.surfaces] })
  }
  return { filters }
}

/* ── workspace law mirrors (workspace-access.ts @639ed01539) ────────────── */

/** headerAuthorized mirror (workspace-access.ts:96-99). */
function headerAuthorized (header, caller) {
  if (header === undefined || header === null) return false
  if (header.id === caller.id) return header.cwd === caller.cwd
  return caller.cwd !== undefined && header.cwd === caller.cwd
}

/** authorizeDescendants mirror (workspace-access.ts:175-205): unauthorized
 *  nodes become null, authorized nodes keep their recursively projected
 *  children. */
function authorizeDescendants (nodes, caller) {
  const result = []
  for (const node of nodes) {
    if (!isRecord(node) || !headerAuthorized(node.session?.header, caller)) {
      result.push(null)
      continue
    }
    result.push({
      record: node.session,
      descendants: authorizeDescendants(Array.isArray(node.descendants) ? node.descendants : [], caller),
    })
  }
  return result
}

/* ── canonical result-shape checks (session-query/src/types.ts @639ed01539) */

function shapeProblem (page) {
  if (!isRecord(page)) return 'the port answered a non-object'
  if (!Array.isArray(page.items)) return 'SessionSearchPage.items is a readonly array (types.ts:231-236 @639ed01539)'
  if (page.nextCursor !== undefined && typeof page.nextCursor !== 'string') return 'SessionSearchCursor is a branded string (cursor.ts:6 @639ed01539)'
  return null
}

function requireCaller (deps, label) {
  let caller
  try {
    caller = deps.readCaller()
  } catch {
    return { refusal: refuse(A5_G6_TYPED_CODES.CALLER_UNAVAILABLE, `${label}: readCaller threw — the caller identity the tool law needs (workspace-access.callerOf @workspace-access.ts:56-69) cannot be observed; fail closed`) }
  }
  if (!isRecord(caller) || typeof caller.id !== 'string' || caller.id.length === 0) {
    return { refusal: refuse(A5_G6_TYPED_CODES.CALLER_UNAVAILABLE, `${label}: readCaller must answer {id, cwd, boundary} mirroring workspace-access.callerOf (workspace-access.ts:56-69 @639ed01539); the row never invents a caller`) }
  }
  return { caller }
}

/* ── the collectPages mirror (operations.ts:244-277 @639ed01539) ────────── */

async function collectPages (maxResults, signal, request, accept) {
  const items = []
  const seen = new Set()
  let cursor
  for (;;) {
    signal?.throwIfAborted?.()
    const page = await request(cursor)
    signal?.throwIfAborted?.()
    const problem = shapeProblem(page)
    if (problem !== null) {
      throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.RESULT_SHAPE_INVALID, `${problem}; the row refuses to serve an off-contract page`)
    }
    for (const item of page.items) {
      if (!accept(item)) continue
      if (items.length === maxResults) return { items, capped: true }
      items.push(item)
    }
    if (page.nextCursor === undefined) return { items, capped: false }
    if (seen.has(page.nextCursor)) {
      throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.CURSOR_LOOP, 'session-search provider repeated a continuation cursor (collectPages guard, operations.ts:268-274 @639ed01539)')
    }
    seen.add(page.nextCursor)
    cursor = page.nextCursor
  }
}

/* ── the five typed tool specs (no generic wrapper: one entry per tool, its
 *    own classify law, its own port method) ──────────────────────────────── */

const TOOL_SPECS = Object.freeze({
  session_search: Object.freeze({
    operation: 'search-across-sessions',
    portFamily: 'search',
    portMethod: 'searchSessions',
    mountCondition: 'declared_mount',
    nativeCite: 'tool-session-query/src/index.ts:65-73 @639ed01539',
    serviceCite: 'ctx.sessionQuery.searchSessions — abstract @session-query/src/index.ts:153-156, concrete @session-query-sqlite/src/index.ts:268 @639ed01539',
  }),
  session_event_search: Object.freeze({
    operation: 'search-within-session',
    portFamily: 'search',
    portMethod: 'searchEvents',
    mountCondition: 'declared_mount',
    nativeCite: 'tool-session-query/src/index.ts:75-83 @639ed01539',
    serviceCite: 'ctx.sessionQuery.searchEvents — abstract @session-query/src/index.ts:164-167, concrete @session-query-sqlite/src/index.ts:296 @639ed01539',
  }),
  session_trace: Object.freeze({
    operation: 'trace-session-lineage',
    portFamily: 'trace',
    portMethod: 'traceSession',
    mountCondition: 'always',
    nativeCite: 'tool-session-query/src/index.ts:85-93 @639ed01539',
    serviceCite: 'ctx.sessionQuery.traceSession — concrete @session-query/src/index.ts:327-331 @639ed01539',
  }),
  session_event_trace: Object.freeze({
    operation: 'trace-event-relationships',
    portFamily: 'trace',
    portMethod: 'traceEvent',
    mountCondition: 'always',
    nativeCite: 'tool-session-query/src/index.ts:95-106 @639ed01539',
    serviceCite: 'ctx.sessionQuery.traceEvent — concrete @session-query/src/index.ts:340-347 @639ed01539',
  }),
  session_event_read: Object.freeze({
    operation: 'read-event-window',
    portFamily: 'eventRead',
    portMethod: 'readEvent',
    mountCondition: 'always',
    nativeCite: 'tool-session-query/src/index.ts:108-121 @639ed01539',
    serviceCite: 'ctx.sessionQuery.readEvent — concrete @session-query/src/index.ts:355-361 @639ed01539',
  }),
})

/** Per-tool classify law: the argument mirrors the native body performs
 *  (input.ts + operations.ts citations inline). Answers
 *  { refusal } or { checks: {…facts derived at classify} }. */
function classifyToolArgs (toolName, args) {
  if (toolName === 'session_search') {
    const query = normalizeQuery(args.query)
    if (query.refusal !== undefined) return query
    if (args.parent_session_ids !== undefined || args.include_root_sessions !== undefined) {
      return { refusal: refuse(A5_G6_TYPED_CODES.PARENT_FILTER_UNAUTHORIZABLE, `parent_session_ids/include_root_sessions: ${A5_G6_NAMED_BLOCKERS.PARENT_FILTER}`) }
    }
    const sessionFilters = buildSessionFilters(args)
    if (sessionFilters.refusal !== undefined) return sessionFilters
    const eventFilters = buildEventFilters({
      seqFrom: args.event_seq_from,
      seqTo: args.event_seq_to,
      timeFrom: args.event_time_from,
      timeTo: args.event_time_to,
      eventTypes: args.event_types,
      surfaces: args.event_surfaces,
    })
    if (eventFilters.refusal !== undefined) return eventFilters
    return { checks: { query: query.query, sessionFilters: sessionFilters.filters, eventFilters: eventFilters.filters } }
  }
  if (toolName === 'session_event_search') {
    const query = normalizeQuery(args.query)
    if (query.refusal !== undefined) return query
    const range = sequenceRange(args.seq_from, args.seq_to)
    if (range.refusal !== undefined) return range
    // Dry-validate the remaining clauses; the FULL filter build happens at
    // the entry (operations.ts:144-151 rebuilds from the step-capped range).
    const time = timestampRange('time', args.time_from, args.time_to)
    if (time.refusal !== undefined) return time
    if (args.event_types !== undefined) {
      const problem = nonEmptyArray('event_types', args.event_types)
      if (problem !== null) return { refusal: problem }
    }
    if (args.surfaces !== undefined) {
      const problem = nonEmptyArray('surfaces', args.surfaces)
      if (problem !== null) return { refusal: problem }
    }
    return { checks: { query: query.query, seqRange: range.range } }
  }
  if (toolName === 'session_trace') {
    return { checks: {} }
  }
  if (toolName === 'session_event_trace') {
    const problem = nonNegativeSafeInteger('seq', args.seq)
    if (problem !== null) return { refusal: problem }
    return { checks: {} }
  }
  // session_event_read
  const seqProblem = nonNegativeSafeInteger('seq', args.seq)
  if (seqProblem !== null) return { refusal: seqProblem }
  if (args.before !== undefined) {
    const problem = nonNegativeSafeInteger('before', args.before)
    if (problem !== null) return { refusal: problem }
  }
  if (args.after !== undefined) {
    const problem = nonNegativeSafeInteger('after', args.after)
    if (problem !== null) return { refusal: problem }
  }
  return { checks: {} }
}

/* ── the placement-time factory ──────────────────────────────────────────── */

/**
 * Build the five governed rows. HARD-VISITED config (a defect throws at
 * placement, never at call): realmId/providerId identity; queryPorts with the
 * three typed facets whose methods exist at the mirrored arity; readCaller.
 *
 * @param deps {{
 *   realmId: string,
 *   providerId: string,
 *   readNative: (name: string) => ({ name: string, description: string,
 *     parameters: object, output?: { schema: unknown }, execute: Function }
 *     | undefined | null),   // production: name => ctx.tools.get(name, scope)
 *   queryPorts: {
 *     searchQueryPort: { searchSessions: Function, searchEvents: Function },
 *     traceQueryPort: { traceSession: Function, traceEvent: Function },
 *     eventReadQueryPort: { readEvent: Function },
 *   },
 *   readCaller: () => ({ id: string, cwd?: string, boundary?: {
 *     lastStepStartSeq?: number | null } } | undefined),
 *   declaredMount?: { searchBackend?: { present?: boolean, detail?: string } },
 *   maxSearchResults?: number,   // mirrors DEFAULT_MAX_SEARCH_RESULTS 100 (index.ts:22)
 *   definitionIdentityOf?: (definition) => string,
 *   observe?: (event) => void,
 * }}
 * @returns {{ rows: Record<string, object>, portFamilies, namedBlockers }}
 */
export function createG6SessionQueryAdapter (deps = {}) {
  const { realmId, providerId, readNative, queryPorts, readCaller, declaredMount, definitionIdentityOf, observe = () => {} } = deps
  if (typeof realmId !== 'string' || realmId.length === 0) throw new TypeError('g6-session-query: realmId is required')
  if (typeof providerId !== 'string' || providerId.length === 0) throw new TypeError('g6-session-query: providerId is required (the placing assembly identifies itself)')
  if (typeof readNative !== 'function') throw new TypeError('g6-session-query: readNative(name) is required — the tools.get(name, scope) capture seam; the rows carry CAPTURED native description bytes, never re-authored text')
  if (typeof readCaller !== 'function') throw new TypeError('g6-session-query: readCaller is required — every delegation resolves the effective target through the caller law (workspace-access.callerOf @workspace-access.ts:56-69 + targetId :71-73 @639ed01539); the row never invents a caller')
  if (!isRecord(queryPorts)) throw new TypeError('g6-session-query: queryPorts {searchQueryPort, traceQueryPort, eventReadQueryPort} is required — one typed facet per real service method family, never a shared string-dispatch wrapper')
  for (const [familyKey, family] of Object.entries(A5_G6_PORT_FAMILIES)) {
    const facet = queryPorts[family.facet]
    if (!isRecord(facet)) {
      throw new TypeError(`g6-session-query: queryPorts.${family.facet} is required (the ${familyKey} family; ${family.law})`)
    }
    for (const method of family.methods) {
      const fn = facet[method]
      if (typeof fn !== 'function') {
        throw new TypeError(`g6-session-query: queryPorts.${family.facet}.${method} must be a function — the port mirrors the real service method VERBATIM (${family.law})`)
      }
      if (fn.length !== family.arity) {
        throw new TypeError(`g6-session-query: queryPorts.${family.facet}.${method} must carry the real signature's ${family.arity} formal parameters (the optional exec/signal half is PART of the declared face — session-query/src/index.ts:153-167, :327-361 @639ed01539); a ${fn.length}-arg stand-in is a shape drift`)
      }
    }
  }
  const maxSearchResults = deps.maxSearchResults ?? 100
  if (!Number.isSafeInteger(maxSearchResults) || maxSearchResults < 1) {
    throw new TypeError('g6-session-query: maxSearchResults must be a positive safe integer (mirrors DEFAULT_MAX_SEARCH_RESULTS, tool-session-query/src/index.ts:22 @639ed01539)')
  }

  const searchDeclared = declaredMount?.searchBackend?.present === true
  const searchBlockDetail = typeof declaredMount?.searchBackend?.detail === 'string' && declaredMount.searchBackend.detail.length > 0
    ? declaredMount.searchBackend.detail
    : A5_G6_NAMED_BLOCKERS.SEARCH_BACKEND

  const rows = {}
  for (const toolName of A5_G6_TOOL_NAMES) {
    const spec = TOOL_SPECS[toolName]
    rows[toolName] = buildG6Row({ toolName, spec, realmId, providerId, readNative, queryPorts, readCaller, definitionIdentityOf, observe, maxSearchResults, searchDeclared, searchBlockDetail })
  }
  return Object.freeze({
    adapterRevision: A5_G6_ADAPTER_REVISION,
    familyId: A5_G6_FAMILY,
    rows: Object.freeze(rows),
    portFamilies: A5_G6_PORT_FAMILIES,
    namedBlockers: A5_G6_NAMED_BLOCKERS,
    typedCodes: A5_G6_TYPED_CODES,
  })
}

function buildG6Row ({ toolName, spec, realmId, providerId, readNative, queryPorts, readCaller, definitionIdentityOf, observe, maxSearchResults, searchDeclared, searchBlockDetail }) {
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

  const boundFacet = queryPorts[A5_G6_PORT_FAMILIES[spec.portFamily].facet]
  const boundMethod = boundFacet[spec.portMethod] // the exact function OBJECT bound at placement

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
    namedBlockers: spec.mountCondition === 'declared_mount'
      ? Object.freeze([A5_G6_NAMED_BLOCKERS.SEARCH_BACKEND, A5_G6_NAMED_BLOCKERS.TARGET_PREAUTH, A5_G6_NAMED_BLOCKERS.PARENT_FILTER, A5_G6_NAMED_BLOCKERS.TITLES_PRESENTATION, A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND])
      : Object.freeze([A5_G6_NAMED_BLOCKERS.TARGET_PREAUTH, A5_G6_NAMED_BLOCKERS.TITLES_PRESENTATION, A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND]),
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
      const caller = requireCaller({ readCaller }, toolName)
      if (caller.refusal !== undefined) return caller.refusal
      const built = classifyToolArgs(toolName, args)
      if (built.refusal !== undefined) return built.refusal
      // Enum lanes the captured schema declares (input.ts:52-56, :62-66,
      // :77-81 @639ed01539) — enforced against the CAPTURED face, not a copy.
      for (const key of ['availability', 'event_surfaces', 'surfaces']) {
        if (args[key] === undefined) continue
        const lane = face.properties[key]?.items?.enum
        if (Array.isArray(lane)) {
          for (const value of args[key]) {
            if (!lane.includes(value)) {
              return refuse(A5_G6_TYPED_CODES.INVALID_FILTER, `${key} value ${JSON.stringify(value)} is outside the captured enum lane ${JSON.stringify(lane)}`)
            }
          }
        }
      }
      const effectiveTarget = args.session_id ?? caller.caller.id
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
        maxSearchResults: spec.portFamily === 'search' ? maxSearchResults : undefined,
        disclosures: [A5_G6_NAMED_BLOCKERS.TARGET_PREAUTH, A5_G6_NAMED_BLOCKERS.TITLES_PRESENTATION, A5_G6_NAMED_BLOCKERS.SESSION_HISTORY_RESOURCE_KIND, ...(spec.portFamily === 'search' ? [A5_G6_NAMED_BLOCKERS.PARENT_FILTER] : [])],
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
      // PER-DISPATCH PORT-IDENTITY RE-VERIFY: the live facet's named method
      // must still BE the function OBJECT bound at placement (the g2-provider
      // seams law applied to the port: identity is the JS function, not a
      // name). Zero forwarding on drift.
      const liveFacet = queryPorts[A5_G6_PORT_FAMILIES[spec.portFamily].facet]
      if (liveFacet[spec.portMethod] !== boundMethod) {
        return refuse(A5_G6_TYPED_CODES.PORT_METHOD_MOVED, `the live ${spec.portFamily}.${spec.portMethod} is no longer the function OBJECT bound at placement — the port generation moved underneath the row; zero forwarding`)
      }
      const callerNow = requireCaller({ readCaller }, toolName)
      if (callerNow.refusal !== undefined) return callerNow.refusal
      if (callerNow.refusal === undefined
        && (callerNow.caller.id !== plan.plan.callerSnapshot.id
          || (callerNow.caller.cwd ?? null) !== plan.plan.callerSnapshot.cwd
          || canonicalJson(callerNow.caller.boundary ?? null) !== canonicalJson(plan.plan.callerSnapshot.boundary))) {
        return refuse(A5_G6_TYPED_CODES.CALLER_DRIFT, 'the caller identity/workspace/step-boundary moved between classify and the port entry — the plan is stale, not re-approvable; zero forwarding')
      }
      const signal = exec?.signal
      if (signal?.aborted === true) {
        return refuse(A5_G6_TYPED_CODES.PRE_ABORTED, "the caller's signal was already aborted before this call was admitted — nothing started, zero port entry")
      }
      const caller = callerNow.caller
      const effectiveTarget = plan.plan.actualArgs.session_id ?? caller.id
      const observeFacts = (extra) => {
        lastDispatch = deepFreeze({
          row: toolName,
          portFamily: spec.portFamily,
          portMethod: spec.portMethod,
          capturedAt: 'row-invoke',
          effectiveTargetSessionId: typeof effectiveTarget === 'string' ? effectiveTarget : null,
          callerFingerprint: `sha256:${sha256(canonicalJson({ id: caller.id, cwd: caller.cwd ?? null }))}`,
          parametersFingerprint: plan.parametersFingerprint,
          ...extra,
        })
        observe({ event: 'dispatch', facts: lastDispatch })
      }
      // The port THROWS ride verbatim (the real service throws SessionQueryError;
      // the tool's own serviceBoundary sanitizing is presentation-side and stays
      // disclosed) — the row never swallows a service failure into a fake result.
      if (toolName === 'session_search') {
        if (typeof caller.cwd !== 'string') {
          return refuse(A5_G6_TYPED_CODES.CALLER_WORKSPACE_ABSENT, 'cross-session search is unavailable because the caller session has no workspace (operations.ts:63-68 @639ed01539)')
        }
        const { query, sessionFilters, eventFilters } = plan.plan.checks
        // The native request always carries sessionFilters AND eventFilters
        // (empty arrays included) — operations.ts:95-100 @639ed01539.
        const request = {
          query,
          // the caller cwd clause rides LAST, exactly as the native body
          // pushes it (operations.ts:90 @639ed01539)
          sessionFilters: [...sessionFilters, { kind: 'cwd', values: [caller.cwd] }],
          eventFilters,
        }
        const collected = await collectPages(
          maxSearchResults,
          signal,
          (cursor) => boundMethod.call(liveFacet, { ...request, ...(cursor === undefined ? {} : { cursor }) }, { signal }),
          (hit) => isRecord(hit?.header) && hit.header.id !== caller.id && headerAuthorized(hit.header, caller),
        )
        observeFacts({ pages: true, collected: collected.items.length, capped: collected.capped })
        return { ok: true, value: deepFreeze(jsonClone(collected)), plan: plan.plan }
      }
      if (toolName === 'session_event_search') {
        const { query } = plan.plan.checks
        let range = plan.plan.checks.seqRange
        if (effectiveTarget === caller.id) {
          // CURRENT-step law (operations.ts:128-139 @639ed01539).
          if (caller.boundary === undefined || caller.boundary.lastStepStartSeq === undefined) {
            return refuse(A5_G6_TYPED_CODES.CURRENT_STEP_BOUNDARY_ABSENT, 'current-session search requires an active step boundary (operations.ts:128-135 @639ed01539)')
          }
          range = {
            ...range,
            to: Math.min(range.to ?? Number.MAX_SAFE_INTEGER, (caller.boundary.lastStepStartSeq ?? 0) - 1),
          }
        }
        // Empty-window short circuit BEFORE any filter validation, exactly
        // where the native body puts it (operations.ts:141-143 @639ed01539).
        if (range.from !== undefined && range.to !== undefined && range.from > range.to) {
          observeFacts({ shortCircuited: 'empty-window', collected: 0 })
          return { ok: true, value: deepFreeze({ items: [], capped: false }), plan: plan.plan }
        }
        if (effectiveTarget === caller.id) {
          // A null lastStepStartSeq caps `to` negative — the sequence law
          // refuses the degenerate bound exactly as the real provider
          // validation does (the loop never runs tools outside a step).
          const capProblem = nonNegativeSafeInteger('sequence upper bound', range.to)
          if (capProblem !== null) return capProblem
        }
        // FULL filter build from the (possibly step-capped) range, exactly as
        // the native body does (operations.ts:144-151 @639ed01539).
        const filtersBuild = buildEventFilters({
          seqFrom: range.from,
          seqTo: range.to,
          timeFrom: plan.plan.actualArgs.time_from,
          timeTo: plan.plan.actualArgs.time_to,
          eventTypes: plan.plan.actualArgs.event_types,
          surfaces: plan.plan.actualArgs.surfaces,
        })
        if (filtersBuild.refusal !== undefined) return filtersBuild.refusal
        const filters = filtersBuild.filters
        // The native request always carries filters (operations.ts:157-161
        // @639ed01539).
        const request = { sessionId: effectiveTarget, query, filters }
        const collected = await collectPages(
          maxSearchResults,
          signal,
          async (cursor) => {
            const page = await boundMethod.call(liveFacet, { ...request, ...(cursor === undefined ? {} : { cursor }) }, { signal })
            // assertObservedTargetAuthorized mirror (operations.ts:163 +
            // workspace-access.ts:101-109 @639ed01539) BEFORE serving.
            if (!isRecord(page?.session) || page.session.id !== effectiveTarget || !headerAuthorized(page.session, caller)) {
              throw new G6SessionQueryRefusal(A5_G6_TYPED_CODES.TARGET_UNAUTHORIZED, `the observed page session header is not the authorized target (workspace-access.ts:101-109 @639ed01539) — the page is refused, not served`, { target: String(effectiveTarget) })
            }
            return page
          },
          () => true,
        )
        observeFacts({ collected: collected.items.length, capped: collected.capped })
        return { ok: true, value: deepFreeze(jsonClone(collected)), plan: plan.plan }
      }
      if (toolName === 'session_trace') {
        const trace = await boundMethod.call(liveFacet, effectiveTarget, signal)
        if (!isRecord(trace) || !isRecord(trace.target?.header) || !Array.isArray(trace.ancestors) || !Array.isArray(trace.descendants) || typeof trace.complete !== 'boolean') {
          return refuse(A5_G6_TYPED_CODES.RESULT_SHAPE_INVALID, 'SessionLineageTrace needs {target.header, ancestors[], descendants[], complete} (types.ts:81-101 @639ed01539)')
        }
        if (trace.target.header.id !== effectiveTarget || !headerAuthorized(trace.target.header, caller)) {
          return refuse(A5_G6_TYPED_CODES.TARGET_UNAUTHORIZED, 'the traced target header is not the authorized target (operations.ts:181 @639ed01539)')
        }
        const ancestors = []
        let ancestorBoundary = false
        for (const ancestor of trace.ancestors) {
          if (!headerAuthorized(ancestor?.header, caller)) { ancestorBoundary = true; break }
          ancestors.push(ancestor)
        }
        if (ancestors.length === trace.ancestors.length && trace.complete === false) ancestorBoundary = true
        const descendants = authorizeDescendants(trace.descendants, caller)
        observeFacts({ ancestors: ancestors.length, ancestorBoundary })
        return { ok: true, value: deepFreeze(jsonClone({ target: trace.target, ancestors, ancestorBoundary, descendants, complete: trace.complete })), plan: plan.plan }
      }
      if (toolName === 'session_event_trace') {
        const observation = await boundMethod.call(liveFacet, { sessionId: effectiveTarget, seq: plan.plan.actualArgs.seq }, signal)
        if (!isRecord(observation) || !isRecord(observation.session) || !isRecord(observation.target)
          || !Array.isArray(observation.replacementChain) || !Array.isArray(observation.replacedEventSeqs)
          || !Array.isArray(observation.sourceEventSeqs) || !Array.isArray(observation.derivedEventSeqs)) {
          return refuse(A5_G6_TYPED_CODES.RESULT_SHAPE_INVALID, 'SessionEventTraceObservation needs {session, target, replacementChain[], replacedEventSeqs[], sourceEventSeqs[], derivedEventSeqs[]} (types.ts:112-131 @639ed01539)')
        }
        if (observation.session.id !== effectiveTarget || !headerAuthorized(observation.session, caller)) {
          return refuse(A5_G6_TYPED_CODES.TARGET_UNAUTHORIZED, 'the observed session header is not the authorized target (operations.ts:215 @639ed01539)')
        }
        observeFacts({ seq: plan.plan.actualArgs.seq })
        return { ok: true, value: deepFreeze(jsonClone(observation)), plan: plan.plan }
      }
      // session_event_read
      const request = {
        sessionId: effectiveTarget,
        seq: plan.plan.actualArgs.seq,
        // keys present ONLY when supplied, exactly as the native body builds
        // the request (operations.ts:232-238 @639ed01539)
        ...(plan.plan.actualArgs.before === undefined ? {} : { before: plan.plan.actualArgs.before }),
        ...(plan.plan.actualArgs.after === undefined ? {} : { after: plan.plan.actualArgs.after }),
      }
      const window = await boundMethod.call(liveFacet, request, signal)
      if (!isRecord(window) || !isRecord(window.session) || !isRecord(window.target) || !Array.isArray(window.events)
        || !Number.isSafeInteger(window.startSeq) || !Number.isSafeInteger(window.endSeq)) {
        return refuse(A5_G6_TYPED_CODES.RESULT_SHAPE_INVALID, 'SessionEventWindow needs {session, target, events[], startSeq, endSeq} (types.ts:146-159 @639ed01539)')
      }
      if (window.session.id !== effectiveTarget || !headerAuthorized(window.session, caller)) {
        return refuse(A5_G6_TYPED_CODES.TARGET_UNAUTHORIZED, 'the observed session header is not the authorized target (operations.ts:239 @639ed01539)')
      }
      observeFacts({ seq: plan.plan.actualArgs.seq, window: [window.startSeq, window.endSeq] })
      return { ok: true, value: deepFreeze(jsonClone(window)), plan: plan.plan }
    },
    drainSemantics: A5_G6_DRAIN_SEMANTICS,
    drain () {
      draining = true
    },
    draining: () => draining,
    lastDispatch: () => lastDispatch,
  }
  if (!declaredActive) {
    // Honest INACTIVE row: the record exists for the census; every call
    // refuses with the verbatim blocker; zero substitution, zero port entry.
    row.classify = async () => refuse(A5_G6_TYPED_CODES.DECLARED_MOUNT_ABSENT, `${toolName}: ${declaredDetail}`)
    row.invoke = async () => refuse(A5_G6_TYPED_CODES.DECLARED_MOUNT_ABSENT, `${toolName}: ${declaredDetail}`)
  }
  return row
}

function rowEffects (toolName) {
  // The session-history read envelope CANNOT ride as a resource effect: the
  // closed RESOURCE_KINDS set (workspace|realm-home|absolute-path|directory|
  // metadata|network-destination, domain/tool-governance/src/resource.ts:42-50)
  // carries no session-history kind, and the closed effect grammar accepts a
  // `read` ONLY over a valid ResourceRef (effects.ts:64-69, :113-126 @the
  // lane's own parser) — inventing a kind is forbidden (G1 record-91 law: a
  // gap is reported, never faked). The read therefore rides as the
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
