/**
 * governed-families/schedule-adapters.mjs — A5-M2 B-SCHEDULE governed-adapter
 * family (census records 30 schedule_create / 31 schedule_delete /
 * 32 schedule_list / 33 schedule_update, family B-SCHEDULE,
 * implementationOwnerRole SERVICE, mountCondition declared_mount,
 * onMountObligation FULL_GOVERNANCE — M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json;
 * contract M0-B-FAMILY-TARGET-CONTRACTS.md §B-SCHEDULE). FOUR REAL-SERVICE
 * TYPED ROWS — never a generic tool-invoke shell: each row carries its own
 * captured native description/parameter/output bytes, its own mirror of the
 * captured tool body's OWN argument law, and its own typed dispatch mapping
 * onto the injected schedule-service port, whose face mirrors the REAL
 * published `ctx.schedule` ScheduleService one-for-one (same names, same
 * arity, same returns).
 *
 * UNWIRED BY OWNERSHIP: placement/registration (`registerA5GovernedFamily` +
 * the PA_FAMILY_TARGET_RULES entry) is PAIRED work owned by another agent
 * running now; the census (p4t6) is the CENTER's to book. NOTHING here
 * mounts itself, registers anything, or claims C2 acceptance. The shared
 * writer feeds `familyRegistrations()` entries at the mount moment exactly
 * like the settled g1-query-wiring integration contract.
 *
 * REVISION 2 (root ①–④ round-1 ruling on the d87 commit): (①) every plan
 * carries the contract §B-SCHEDULE TARGET (owner session + taskId + revision
 * + action; timer namespace + arm/reschedule/disarm; destination session +
 * wake) and the trigger dimension is reported as a MEASURED missing public
 * interface (TRIGGER_GOVERNANCE gap), never stuffed into create/update
 * claims; (②) the owner law is the host's own REFERENCE identity —
 * `exec.agent !== capturedAgent → internal_error` (tools.ts:438/:457/:481/
 * :509) — the trusted live ctx.schedule is RE-READ per dispatch exactly where
 * the host bodies resolve `rootCtx.schedule` afresh, and the update CAS
 * re-verifies after its `list` await; the old bind-time constant
 * self-compare proved nothing and is gone; (③) the L6 mirror maps ONLY
 * through `instanceof` the published ScheduleInputError class (index.ts:36),
 * injected by the owning assembly — the duck-code path that could leak
 * internal message bytes is deleted; (④) the plan-once WeakSet is an
 * INTERNAL MEMO, not the one-shot ledger: the real consumedProof is the
 * center PA wiring edge — the row mints none and never claims once-closure.
 *
 * ── NATIVE-FACE / SERVICE LEDGER (comment-side ONLY: a string literal IS an
 * edge to the audit, so these path facts never live in values) ─────────────
 * All facts @639ed015397290b3745d163aafe02ffee4aa3f84 (pristine
 * tests/deepseek-harness-test-use, path source tests/paths.mjs), paths
 * relative to its packages/schedule/schedule/.
 * TOOLS  src/tools.ts: registerScheduleTools(rootCtx, toolCtx, agent) :410
 *        registers four defineTool products:
 *          schedule_create :417 — parameters prompt(required)+title(required)
 *            +SELECTOR_PARAMETERS(:341: after_seconds/at/every_seconds/daily/
 *            weekly/cron; at is oneOf string | {date,time,time_zone}; daily/
 *            weekly/cron objects carry required members); body order:
 *            `exec.agent !== agent → internal_error` :438, validateCreateArgs
 *            (:222) :439, `exec.signal.aborted → internal_error` :441,
 *            `scheduleView(await rootCtx.schedule.create(agent.session.id,
 *            args, exec.signal), Date.now())` :443, catch → operationError.
 *          schedule_list :452 — parameters {}; body: agent check :457,
 *            signal check :458, `rootCtx.schedule.list({ sessionId:
 *            agent.session.id })` :460 mapped through scheduleView.
 *          schedule_delete :470 — parameters id(required, non-empty
 *            trim-stable); body order: id law FIRST (:476-479 returns the
 *            invalid_rule VALUE before any identity read), then agent check
 *            :481, signal check :482, `rootCtx.schedule.delete({sessionId,
 *            id}, exec.signal)` :484.
 *          schedule_update :493 — parameters id(required)+title/prompt
 *            +update-side selectors (no after_seconds — "To change a relative
 *            delay, create a new reminder."); body order: agent check :509,
 *            validateUpdateArgs(:269) :510, signal check :512, then the
 *            two-step CAS: `list({sessionId}).find(record.id === id)`
 *            :515-517; on miss the
 *            ended/not-found split reads the HOST-WIDE catalog (non-tool
 *            surface): `catalog().some(entry.sessionId === sessionId &&
 *            entry.id === id)` :521-524 → {id, updated:false,
 *            code:'schedule_ended' | 'schedule_not_found'}; on hit
 *            `timingChangeFrom(args)`(:322) + `update({sessionId, id,
 *            expected, change?, title?, prompt?}, exec.signal)` :526-532;
 *            'record' in result → scheduleView(result.record, Date.now()).
 *        Output faces CREATE/LIST/DELETE/UPDATE_OUTPUT_SCHEMA :119-166 over
 *        VIEW_SCHEMA (six kind branches) + the closed ERROR_SCHEMAS union
 *        (invalid_prompt, invalid_selector, invalid_rule, invalid_time_zone,
 *        not_future, time_out_of_range, frequency_too_high, internal_error);
 *        renderValue = JSON.stringify :185; internalError :197;
 *        operationError :202 (`error instanceof ScheduleInputError ?
 *        {code,message} : internal_error` — the tool NEVER re-raises).
 * DOMAIN src/domain.ts: MIN_EVERY_INTERVAL_SECONDS = 60 :37; MAX_TITLE_LENGTH
 *        = 120 :40; REQUIRED_TITLE_MESSAGE :165; ScheduleId brand :139;
 *        scheduleView(record, now) = Object.freeze({...record, state:
 *        now >= Date.parse(record.scheduledAt) ? 'overdue' : 'scheduled',
 *        deliveryMode: 'host'}) :1850.
 * SERVICE src/index.ts: Context merge `schedule: ScheduleService` :66-68;
 *        class ScheduleService :100; PUBLISHED d.ts lib/types/index.d.ts:
 *        Context merge :13-15, class :39, create(sessionId, request,
 *        signal?):Promise<ScheduleRecord> :68, list(request):Promise<
 *        ScheduleRecord[]> :74, catalog():Promise<ScheduleCatalogEntry[]>
 *        :81, history(request):Promise<ScheduleDeliveryHistoryResult> :89,
 *        delete(request, signal?):Promise<ScheduleDeleteResult> :99,
 *        update(request, signal?):Promise<ScheduleUpdateResult> :111 (src
 *        mirrors: create :249, list :290, catalog :304). The published JSDoc
 *        law the rows mirror: every write checks the signal BEFORE
 *        persistence and CANCELLATION DOES NOT ROLL BACK an in-flight write;
 *        reads/deletion never activate a Session; history throws
 *        ScheduleInputError when limit is not a safe integer 1..100.
 * TYPES  src/types.ts: ScheduleCreateRequest :363 (the create request IS the
 *        model args — prompt/title/selector), ScheduleListRequest :383
 *        {sessionId}, ScheduleDeleteRequest :389 {sessionId,id},
 *        ScheduleTimingChange :395 (closed kinds at/every/daily/weekly/cron),
 *        ScheduleUpdateRequest :411 {sessionId,id,expected,change?,title?,
 *        prompt?}, ScheduleUpdateMiss :419 (updated:false + closed code),
 *        ScheduleUpdateResult :426, ScheduleView :265, ScheduleToolError :321
 *        (the closed v1 union), tool values ScheduleCreateValue :332 /
 *        ScheduleListValue :335 / ScheduleDeleteValue :343 /
 *        ScheduleUpdateValue :432.
 * RUNTIME src/runtime.ts: the wake path — resolveAgent(task.sessionId) :101 →
 *        recurring-occurrence resolution → createUserMessage(source
 *        'schedule') → agent.followup :123 → ctx.sessions.flush :124.
 *        MEASURED (root ① investigation): this delivery path has NO public
 *        pre-delivery governance entry — no hook/listener/canDeliver/veto
 *        anywhere in runtime.ts (grep measured empty), and ScheduleRuntime
 *        is plugin-private (index.ts:113/:156 construct it; NOT exported
 *        from the published index surface). The durable timer arm/delivery/
 *        wake dimension is SERVICE+RUNTIME law, NOT this seam (NAMED GAPS:
 *        TIMER_ARM + TRIGGER_GOVERNANCE). Revocation-blocking IS published
 *        durable law: the scan only picks status === 'active' tasks
 *        (runtime.ts:90/:155), so delete/update (the revocation paths this
 *        family owns) block later wakes through the durable record state —
 *        auditable through catalog/history — no re-ask per trigger.
 *
 * ROOT LAWS (module UNWIRED; legs run against recorded DOUBLES — NOT C2, no
 * real-Host dimension is claimed from this file):
 *  L1 CAPTURE LAW (declared_mount): a row is ACTIVE only when the placement
 *     assembly presents the DECLARED SCHEDULE-SERVICE PROOF
 *     (`declaredService.present === true`) AND that record's complete
 *     captured native face. Otherwise the row is an honest declared/INACTIVE
 *     row: every classify/delegate refuses TYPED
 *     (P_B_SCHEDULE_DECLARED_MOUNT_ABSENT / P_B_SCHEDULE_CAPTURE_ABSENT)
 *     with zero port entry and zero substitution — never a fake-closed row,
 *     never a placeholder reminder. Captures presented without the declared
 *     proof are REPORTED (assembly.declared lists them as ignored — never a
 *     silent drop) and stay INACTIVE.
 *  L2 VERBATIM FACE: row.description / row.parameters / row.outputSchema ARE
 *     the captured bytes (same values); this file holds no re-authored copy
 *     of any host schema. The PLACED definition is the CAPTURED DEFINITION,
 *     COMPLETE (root 8b4 law): EVERY presentation face rides into the placed
 *     definition verbatim and BY REFERENCE (`output: {schema, render,
 *     presentationMeta?}`, compiled `parameters`, `presentCall`/`presentResult`,
 *     hooks, `timeoutMs`, any future face) and ONLY `execute` is replaced.
 *     The assembly gate mirrors ONLY the real registration minimum-entry
 *     SHAPE law (core/tools register() @ 639: mandatory `output` face,
 *     function render/presentationMeta, positive timeoutMs) so a half-capture
 *     is refused at assembly and schema SEMANTICS stay host-owned.
 *  L3 REAL-SERVICE DELEGATION: each dispatch is the exact ScheduleService
 *     call the captured host body performs — same method, same arity, the
 *     SAME argument shapes (ScheduleCreateRequest IS the model args; the CAS
 *     `expected` rides the record read through the port THIS call performed;
 *     the live exec.signal rides by reference). The port object and its
 *     method FUNCTION OBJECTS are frozen at bind AND the live service is
 *     re-read at every dispatch edge (L7); the update CAS re-verifies the
 *     whole edge AFTER its `await list` and BEFORE `port.update` (root ②: an
 *     await is where this lane's world can move — a drifted/rebound service
 *     surfacing during the await refuses with ZERO update entry).
 *  L3b PLAN CARRIES THE CONTRACT TARGET (root ①, contract §B-SCHEDULE:114
 *     target I+S(owner session+taskId+revision,action)+S(timer namespace,
 *     arm/reschedule/disarm)+S(destination session,wake)): every plan's
 *     frozen `target` states the owner session (read from the BOUND owner,
 *     never a caller string — C1), the taskId (the validated id for delete/
 *     update; `service-mints-id-on-commit` for create), the revision law
 *     (the CAS `expected` record for update; durable-record state for
 *     delete), the action, the timer effect DELTA the write performs
 *     (arm / re-align / disarm-on-record-state / none) explicitly labelled
 *     SERVICE-side (TIMER_ARM gap — the row never claims it armed anything),
 *     and the destination (the OWNER session itself — every published
 *     ScheduleService face is session-scoped and the wake resolves exactly
 *     `task.sessionId`, runtime.ts:101 — this family opens NO cross-session
 *     path) with the wake labelled service-owned and NOT licensed by this
 *     invocation (TRIGGER_GOVERNANCE gap).
 *  L4 TARGET = THE BOUND LIVE OWNER, BY REFERENCE — NEVER AN ID STRING,
 *     NEVER A GUESS (C1: 跨会话目标不能从caller字符串猜; root ② ruling): the
 *     row is bound at mount to the REAL captured owner Agent object
 *     (`capturedAgent` — the same live owner the host's own
 *     registerScheduleTools binds, tools.ts:405/:411). At every dispatch edge
 *     the row applies the HOST'S OWN identity law by REFERENCE:
 *     `exec.agent !== capturedAgent → internal_error` (tools.ts:438/:457/
 *     :481/:509) — a different object carrying the SAME id/header strings is
 *     refused exactly as the host refuses it (id-string pairing was ②-
 *     rejected: two agents can share bytes). The service-call sessionId is
 *     then read from the BOUND owner at call time (the host bodies read
 *     `agent.session.id` at :443/:460/:484/:515), never from a caller string.
 *  L5 TOOL-BODY LAW MIRROR, HOST ORDER (each rule line-cited above): the
 *     pure argument half runs at classify and becomes a frozen TOOL-ERROR
 *     PLAN (the model-visible VALUE the host returns — these tools answer
 *     typed error VALUES, they do not throw); at the dispatch edge the
 *     row re-runs the host body's own CHECK ORDER per tool (delete: id law →
 *     agent → signal; create/list/update: agent → … → signal), so an
 *     invalid-args plan and a wrong-agent call cannot swap observed shapes.
 *     Nothing beyond the cited law is re-implemented: cron parsing, time
 *     zones, not_future, occurrence math and the CAS conflict stay SERVICE
 *     facts — service throws map through the mirrored operationError law
 *     (L6) and are never re-labelled, swallowed twice, or pre-answered.
 *  L6 ERROR-VALUE MIRROR (root ③): the captured bodies NEVER re-raise
 *     (operationError tools.ts:202 `error instanceof ScheduleInputError ?
 *     {code,message} : internalError()`). The lane cannot import host code,
 *     so the owning assembly injects the PUBLISHED class via
 *     `input.ScheduleInputError` (published export src/index.ts:36 — the
 *     SAME class identity the host throws); the mirror runs the host's own
 *     law `error instanceof ScheduleInputError ? {code: error.code, message:
 *     error.message} : internalError()`. The prior duck-by-code path is
 *     DELETED: a foreign error merely wearing a closed code no longer leaks
 *     its internal `message` bytes into a model-visible value — it maps to
 *     the stable internal_error exactly as the host maps a non-input error.
 *  L7 PER-DISPATCH IDENTITY RE-VERIFY: before any port entry the row
 *     re-answers the REQUIRED placement feed `liveNative(name)` and compares
 *     the definition OBJECT identity, its description bytes, its compiled
 *     parameters, AND its execute function value against the bind-time
 *     capture; it ALSO re-reads the LIVE schedule service via the REQUIRED
 *     `liveScheduleService()` feed (root ②: the host bodies resolve
 *     `rootCtx.schedule` AFRESH at every call — tools.ts:443/:460/:484/:515 —
 *     so a bind-time constant compared against itself proves nothing and the
 *     self-compare is deleted). The live read must be the bound port object
 *     with the frozen method FUNCTIONS; any drift refuses typed with zero
 *     port entry — a closure-attested identity is self-attestation, so a
 *     capture without `liveNative` is an assembly refusal, never a mounted
 *     row.
 *  L8 PLAN MEMO, RUN THE FRESH PLAN (root ④ boundary stated honestly):
 *     classify freezes {args snapshot, operation, target,
 *     parametersFingerprint, toolError?}; delegate re-derives classify on the
 *     snapshot, requires an equal fingerprint, refuses a foreign plan, a
 *     mutated/stale plan, and a REPLAY OF THE SAME CONSUMED PLAN OBJECT with
 *     zero port entry. BOUNDARY: that last refusal is an INTERNAL MEMO over
 *     one object, NOT the one-shot ledger — plan-once with real consumedProof
 *     is a CENTER PA wiring obligation (the plane's consume-for-execution
 *     edge); this row mints no consumedProof, and a caller that COPIES a
 *     plan's fields re-dispatches (re-running the full law each time). The
 *     row never claims once-closure (NAMED GAP PLAN_ONCE_MEMO).
 *  L9 DRAIN = NEW-CALL PROHIBITION, NEVER A FAKE ROLLBACK: ScheduleService
 *     writes are durable on commit and the published JSDoc law says
 *     cancellation does not roll back an in-flight write; drain forbids NEW
 *     calls only — it settles nothing and revives nothing.
 *  L10 NO UNADMITTED PATH TO THE PORT: the factory REQUIRES an `admit` seam
 *     (the seat the plane's PA walk occupies). Every placed definition runs
 *     classify → admit → dispatch; any refusal throws with the refusing
 *     side's OWN typed bytes and zero port entry. Admission authority stays
 *     exactly where the plane froze it — this module performs no PA walk.
 *
 * NAMED GAPS (carried verbatim on every plan, never faked closed): the timer
 * arm/reschedule/disarm, the durable restart recovery, and the delivery wake
 * are SERVICE+RUNTIME dimensions (runtime.ts:90-155) invisible at this port
 * seam; per the family contract a future wake is NOT a standing license
 * (本次批准的是持久schedule定义及其界限) — each trigger is a new invocation
 * that must re-check current policy/owner, and the INVESTIGATION (root ①)
 * MEASURED that the published face offers NO pre-delivery governance entry
 * for that re-check (NAMED GAP TRIGGER_GOVERNANCE names the exact missing
 * interface; this row therefore NEVER claims the re-check, and the
 * obligation is NOT stuffed into create/update claims either — the row's
 * claims stop at the durable record write); the `sessionPersistence`
 * load-order requirement (published service doc) is an assembly obligation,
 * not a row fact. The census effect deltas (durable storage write, timer
 * arm, cross-session wake on delivery) are recorded on the frozen dispatch
 * index, not asserted from this lane.
 *
 * Windows dimensions: NOT RUN on this Linux harness, never claimed.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/schedule-adapters
 */
import { createHash } from 'node:crypto'

/** Census family (M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX records 30–33). */
export const A5_B_SCHEDULE_FAMILY_ID = 'B-SCHEDULE'
export const A5_B_SCHEDULE_ADAPTER_REVISION = 2
/** Frozen mount condition of all four records (declared_mount). */
export const A5_B_SCHEDULE_MOUNT_CONDITION = 'declared_mount'

/** The four records: census recordIndex + the row's closed operation. */
export const A5_B_SCHEDULE_RECORD_SPECS = Object.freeze({
  schedule_create: Object.freeze({ recordIndex: 30, operation: 'schedule-create' }),
  schedule_delete: Object.freeze({ recordIndex: 31, operation: 'schedule-delete' }),
  schedule_list: Object.freeze({ recordIndex: 32, operation: 'schedule-list' }),
  schedule_update: Object.freeze({ recordIndex: 33, operation: 'schedule-update' }),
})
export const A5_B_SCHEDULE_TOOL_NAMES = Object.freeze(['schedule_create', 'schedule_delete', 'schedule_list', 'schedule_update'])

/**
 * THE PORT LAW — mirrors the REAL published ScheduleService methods the four
 * captured host bodies call (see the ledger for the pinned lines). Names and
 * arity are the whole value-side fact; every path/line citation lives in this
 * file's comment ledger ONLY (a string literal IS an audit edge). The port
 * OBJECT is injected by the owning assembly (production: the live
 * `ctx.schedule`); this module holds no implementation of any of it.
 * `history` and `catalog` are published SERVICE faces with no model tool of
 * their own — `catalog` is consumed by the update CAS exactly where the host
 * body consumes it; `history` stays reachable through the port for the
 * owning assembly and is never model-mounted by this module.
 */
export const A5_B_SCHEDULE_SERVICE_METHODS = Object.freeze({
  create: Object.freeze({ arity: 3, signature: 'create(sessionId, request, signal?): Promise<ScheduleRecord>' }),
  list: Object.freeze({ arity: 1, signature: 'list(request): Promise<ScheduleRecord[]>' }),
  catalog: Object.freeze({ arity: 0, signature: 'catalog(): Promise<ScheduleCatalogEntry[]>' }),
  history: Object.freeze({ arity: 1, signature: 'history(request): Promise<ScheduleDeliveryHistoryResult>' }),
  delete: Object.freeze({ arity: 2, signature: 'delete(request, signal?): Promise<ScheduleDeleteResult>' }),
  update: Object.freeze({ arity: 2, signature: 'update(request, signal?): Promise<ScheduleUpdateResult>' }),
})

/** The published ScheduleToolError code union (src/types.ts :321 union,
 *  values enumerated from the tools.ts ERROR_SCHEMAS face). DOCUMENTATION-
 *  SIDE since root ③: the L6 mirror admits ONLY `instanceof` the injected
 *  published class (tools.ts:202), never a duck-check against this list. */
export const A5_B_SCHEDULE_TOOL_ERROR_CODES = Object.freeze([
  'invalid_prompt',
  'invalid_selector',
  'invalid_rule',
  'invalid_time_zone',
  'not_future',
  'time_out_of_range',
  'frequency_too_high',
  'internal_error',
])

/** Typed refusal codes OWNED by this module (closed set). */
export const A5_B_SCHEDULE_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_SCHEDULE_INPUT_INVALID',
  DECLARED_MOUNT_ABSENT: 'P_B_SCHEDULE_DECLARED_MOUNT_ABSENT',
  CAPTURE_ABSENT: 'P_B_SCHEDULE_CAPTURE_ABSENT',
  CAPTURE_INCOMPLETE: 'P_B_SCHEDULE_CAPTURE_INCOMPLETE',
  NON_FAMILY_CAPTURE: 'P_B_SCHEDULE_NON_FAMILY_CAPTURE',
  LIVE_NATIVE_ABSENT: 'P_B_SCHEDULE_LIVE_NATIVE_ABSENT',
  PORT_ABSENT: 'P_B_SCHEDULE_PORT_ABSENT',
  PORT_METHOD_ABSENT: 'P_B_SCHEDULE_PORT_METHOD_ABSENT',
  PORT_DRIFT: 'P_B_SCHEDULE_PORT_DRIFT',
  DEFINITION_DRIFT: 'P_B_SCHEDULE_DEFINITION_DRIFT',
  ADMISSION_ABSENT: 'P_B_SCHEDULE_ADMISSION_ABSENT',
  NOT_OWN_PLAN: 'P_B_SCHEDULE_NOT_OWN_PLAN',
  PLAN_STALE: 'P_B_SCHEDULE_PLAN_STALE',
  ALREADY_DISPATCHED: 'P_B_SCHEDULE_ALREADY_DISPATCHED',
  DRAINING: 'P_B_SCHEDULE_DRAINING',
  PLACEMENT_KEY_ABSENT: 'P_B_SCHEDULE_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_B_SCHEDULE_PLACEMENT_KEY_MOVED',
})
const CODES = A5_B_SCHEDULE_CODES

/**
 * The dimensions this adapter can NEVER serve through the ScheduleService
 * port — carried verbatim on every plan instead of being faked closed.
 */
export const A5_B_SCHEDULE_NAMED_GAPS = Object.freeze({
  TIMER_ARM: 'TIMER ARM / RESCHEDULE / DISARM UNOBSERVED at this seam: the durable timer obligation, restart non-double-fire and the delivery wake run in the service runtime (runtime.ts:90-155 @639ed01539) behind the committed record; the port call only durably writes the record — the row never claims it armed, re-armed, or disarmed a timer, and a delete result never asserts no wake is already queued (the captured DELETE_DESCRIPTION itself: deletion does not retract an already-queued reminder).',
  TRIGGER_GOVERNANCE: 'THE TRIGGER IS NOT THIS INVOCATION\'S LICENSE, AND THE RE-CHECK HAS NO PUBLISHED ENTRY (measured @639ed01539): per contract §B-SCHEDULE each future wake is a NEW invocation that must re-check current policy/target owner (每次触发新invocation重查当前policy/目标owner), and revocation blocks firing through durable state rather than a per-trigger re-ask (the scan only takes status === \'active\' records, runtime.ts:90/:155 — delete/update ARE the revocation path, auditable via catalog/history). MEASURED: the published surface exports NO trigger-time governance entry — ScheduleRuntime is plugin-private (index.ts:113/:156 construct it, not exported) and the delivery path resolveAgent(runtime.ts:101) → agent.followup(:123) → sessions.flush(:124) carries no hook/listener/veto anywhere in runtime.ts. EXACT MISSING PUBLIC INTERFACE: a pre-delivery governance entry between resolveAgent and followup where the governor re-checks current policy/owner per trigger. What DOES hold at the driven turn: every tool call the wake\'s turn performs re-runs the normal per-call admission (实际后续工具仍逐次治理). Nothing granted through this row authorizes any later invocation; the row never reports the dimension as checked and create/update never claim trigger authority.',
  PLAN_ONCE_MEMO: 'PLAN-ONCE IS AN INTERNAL MEMO, NOT THE ONE-SHOT LEDGER (root ④): consumedPlans refuses replaying the SAME plan OBJECT with zero port entry; a caller that COPIES a plan\'s fields re-dispatches (the fingerprint law re-runs the whole argument law on the copy). The real one-shot consumedProof is a CENTER PA wiring obligation (the plane\'s consume-for-execution edge); this row mints no consumedProof and never claims once-closure.',
  PERSISTENCE_ORDER: 'sessionPersistence load order (the published service doc: a delivery commits only when the session/flush listener participated) is an ASSEMBLY obligation of the owning mount, not a row fact; the row never observes it.',
})

const DRAIN_SEMANTICS = 'drain = NEW-CALL PROHIBITION: ScheduleService writes are durable on commit and the published law says cancellation does not roll back an in-flight write; drain settles nothing, revives nothing, and fakes no rollback'

/* ── small internal primitives ─────────────────────────────────────── */

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const deepFreeze = (value) => {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}
const canonicalJson = (value) => JSON.stringify(value, (_k, v) => (
  v !== null && typeof v === 'object' && !Array.isArray(v)
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
    : v
))
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex')
const refuse = (code, detail) => deepFreeze({ ok: false, code, detail })
/** The sibling house clone (args are dispatcher-parsed JSON data). */
const jsonClone = (value) => JSON.parse(JSON.stringify(value))

/** Mirrored published domain constants (src/domain.ts :37/:40) — the same
 *  numbers the captured parameter descriptions carry; kept as VALUES because
 *  the classify law compares against them (L5 mirror). */
const MIN_EVERY_INTERVAL_SECONDS = 60
const MAX_TITLE_LENGTH = 120
const REQUIRED_TITLE_MESSAGE = 'title is required and must be non-empty after trimming.'

/** Canonical projection mirror, byte-for-byte the published `scheduleView`
 *  (src/domain.ts:1850): {...record, state, deliveryMode:'host'}, frozen. */
export function scheduleView(record, now) {
  return Object.freeze({
    ...record,
    state: now >= Date.parse(record.scheduledAt) ? 'overdue' : 'scheduled',
    deliveryMode: 'host',
  })
}

/** The stable internal_error value (tools.ts:197). */
const internalErrorValue = () => deepFreeze({ code: 'internal_error', message: 'The schedule operation failed.' })

/** L6 operationError mirror (tools.ts:202), root ③: the host's OWN law
 *  `error instanceof ScheduleInputError ? {code,message} : internalError()`,
 *  run against the PUBLISHED class identity the owning assembly injects
 *  (export src/index.ts:36 — the same class the host bodies import and
 *  throw). The former duck-by-code path is DELETED: a foreign error wearing
 *  a closed code no longer leaks its internal message bytes; it maps to the
 *  stable internal_error exactly as the host maps a non-input error. */
function toToolErrorValue(error, ScheduleInputErrorClass) {
  return error instanceof ScheduleInputErrorClass
    ? deepFreeze({ code: error.code, message: error.message })
    : internalErrorValue()
}

/* ── L5: the captured tool bodies' OWN argument law, mirrored verbatim ── */

/** invalidInterval mirror (tools.ts:207-219). */
function invalidInterval(everySeconds) {
  if (everySeconds === undefined) return undefined
  if (!Number.isSafeInteger(everySeconds)) {
    return { code: 'invalid_rule', message: 'every_seconds must be a safe integer.' }
  }
  if (everySeconds < MIN_EVERY_INTERVAL_SECONDS) {
    return {
      code: 'frequency_too_high',
      message: `every_seconds must be at least ${MIN_EVERY_INTERVAL_SECONDS}.`,
    }
  }
  return undefined
}

/** validateCreateArgs mirror (tools.ts:222-266) over the plan-time snapshot. */
function validateCreateArgs(args) {
  const keys = Object.keys(args)
  if (keys.some((key) => key !== 'prompt'
    && key !== 'title'
    && key !== 'after_seconds'
    && key !== 'at'
    && key !== 'every_seconds'
    && key !== 'daily'
    && key !== 'weekly'
    && key !== 'cron')
    || Number(args.after_seconds !== undefined)
    + Number(args.at !== undefined)
    + Number(args.every_seconds !== undefined)
    + Number(args.daily !== undefined)
    + Number(args.weekly !== undefined)
    + Number(args.cron !== undefined) !== 1) {
    return {
      code: 'invalid_selector',
      message: 'schedule_create accepts exactly one of after_seconds, at, every_seconds, daily, weekly, or cron.',
    }
  }
  if (args.prompt.trim().length === 0) {
    return { code: 'invalid_prompt', message: 'prompt must be non-empty after trimming.' }
  }
  if (args.title.trim().length === 0) {
    return { code: 'invalid_prompt', message: REQUIRED_TITLE_MESSAGE }
  }
  if (args.title.trim().length > MAX_TITLE_LENGTH) {
    return { code: 'invalid_prompt', message: `title must be at most ${MAX_TITLE_LENGTH} characters.` }
  }
  if (args.after_seconds !== undefined
    && (!Number.isSafeInteger(args.after_seconds) || args.after_seconds <= 0)) {
    return { code: 'invalid_rule', message: 'after_seconds must be a positive safe integer.' }
  }
  return invalidInterval(args.every_seconds)
}

/** validateUpdateArgs mirror (tools.ts:269-319). */
function validateUpdateArgs(args) {
  const selectors = [
    args.at !== undefined,
    args.every_seconds !== undefined,
    args.daily !== undefined,
    args.weekly !== undefined,
    args.cron !== undefined,
  ].filter(Boolean).length
  if (Object.keys(args).some((key) => key !== 'id'
    && key !== 'title'
    && key !== 'prompt'
    && key !== 'at'
    && key !== 'every_seconds'
    && key !== 'daily'
    && key !== 'weekly'
    && key !== 'cron')
    || selectors > 1) {
    return {
      code: 'invalid_selector',
      message: 'schedule_update accepts at most one of at, every_seconds, daily, weekly, or cron.',
    }
  }
  if (args.id.length === 0 || args.id.trim() !== args.id) {
    return { code: 'invalid_rule', message: 'schedule_update id must be non-empty without surrounding whitespace.' }
  }
  if (selectors === 0 && args.title === undefined && args.prompt === undefined) {
    return {
      code: 'invalid_selector',
      message: 'schedule_update needs a new title, prompt, or one of at, every_seconds, daily, weekly, or cron.',
    }
  }
  if (args.title !== undefined && args.title.trim().length === 0) {
    return { code: 'invalid_prompt', message: REQUIRED_TITLE_MESSAGE }
  }
  if (args.title !== undefined && args.title.trim().length > MAX_TITLE_LENGTH) {
    return { code: 'invalid_prompt', message: `title must be at most ${MAX_TITLE_LENGTH} characters.` }
  }
  if (args.prompt !== undefined && args.prompt.trim().length === 0) {
    return { code: 'invalid_prompt', message: 'prompt must be non-empty after trimming.' }
  }
  return invalidInterval(args.every_seconds)
}

/** timingChangeFrom mirror (tools.ts:322-333). */
function timingChangeFrom(args) {
  if (args.at !== undefined) return { kind: 'at', at: args.at }
  if (args.every_seconds !== undefined) return { kind: 'every', every_seconds: args.every_seconds }
  if (args.daily !== undefined) return { kind: 'daily', daily: args.daily }
  if (args.weekly !== undefined) return { kind: 'weekly', weekly: args.weekly }
  if (args.cron !== undefined) return { kind: 'cron', cron: args.cron }
  return undefined
}

/** schedule_delete id law (tools.ts:476-479). */
function deleteIdLaw(id) {
  if (typeof id !== 'string' || id.length === 0 || id.trim() !== id) {
    return { code: 'invalid_rule', message: 'schedule_delete id must be non-empty without surrounding whitespace.' }
  }
  return undefined
}

/** schedule_list has an EMPTY parameter face (tools.ts:454): any key is a
 *  dispatcher-side defect; mirror the closed invalid_selector shape with
 *  zero port entry rather than an invented code. */
function listArgsLaw(args) {
  if (Object.keys(args).length !== 0) {
    return { code: 'invalid_selector', message: 'schedule_list takes no parameters.' }
  }
  return undefined
}

/** The per-tool check ORDER the captured bodies run (L5): where the pure
 *  tool-law VALUE sits relative to the live identity/signal checks. */
const CHECK_ORDER = Object.freeze({
  schedule_create: Object.freeze({ toolError: 'after-agent', signal: 'after-toolError' }),
  schedule_delete: Object.freeze({ toolError: 'first', signal: 'after-agent' }),
  schedule_list: Object.freeze({ toolError: 'after-agent', signal: 'after-agent' }),
  schedule_update: Object.freeze({ toolError: 'after-agent', signal: 'after-toolError' }),
})

/* ── the factory ────────────────────────────────────────────────────── */

const refuseAssembly = (code, message) => deepFreeze({ ok: false, code, message })

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-b-schedule ${String(refusal?.code ?? CODES.INPUT_INVALID)} — ${String(refusal?.detail ?? 'the adapter refused without a detail')}`)
  error.code = refusal?.code
  error.scheduleRefusal = deepFreeze({ ...refusal })
  return error
}

/**
 * Assembly-time factory for the four B-SCHEDULE rows.
 *
 * @param input {{
 *   providerId?: string,
 *   declaredService?: { present?: boolean, facts?: object },
 *       // the TRUSTED declared schedule-service proof the placement
 *       // assembly presents (mountCondition declared_mount); anything else
 *       // leaves every row an honest INACTIVE declared row
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *       // native = the COMPLETE captured ToolDefinition (every presentation
 *       // face verbatim); the placed def spreads it and replaces ONLY execute
 *   liveNative: (name: string) => unknown,  // REQUIRED placement feed re-read
 *   scheduleService: object,                // the BOUND ctx.schedule-shaped port
 *   liveScheduleService: () => unknown,     // REQUIRED per-dispatch live re-read of
 *       // the CURRENT ctx.schedule (root ② — the host bodies resolve
 *       // rootCtx.schedule afresh; a replaced object is PORT_DRIFT)
 *   capturedAgent: object,                  // REQUIRED: the REAL live owner Agent
 *       // object the host registerScheduleTools binds (tools.ts:405/:411);
 *       // dispatch REFERENCE-compares exec.agent against it (root ②)
 *   ScheduleInputError: class,               // REQUIRED: the PUBLISHED class
 *       // (index.ts:36) the L6 mirror runs `instanceof` against (root ③)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   admit: (ctx: object) => Promise<{ ok: boolean, code?: string, detail?: string }>,
 *   observe?: (row: unknown) => void,
 * }} input
 * @returns a frozen `{ ok: true, assembly }` (definitions + declared report +
 *          familyRegistrations) or a frozen `{ ok: false, code, message }`.
 */
export function createScheduleAdapterAssembly(input = {}) {
  if (!isRecord(input)) return refuseAssembly(CODES.INPUT_INVALID, 'the factory takes one input record')
  const knownInput = new Set(['providerId', 'declaredService', 'captured', 'liveNative', 'scheduleService', 'liveScheduleService', 'capturedAgent', 'ScheduleInputError', 'placementFeed', 'admit', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(CODES.INPUT_INVALID, `unknown input '${key}' — the factory takes exactly {providerId, declaredService, captured, liveNative, scheduleService, liveScheduleService, capturedAgent, ScheduleInputError, placementFeed, admit, observe}`)
    }
  }
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'b-schedule'
  if (typeof input.placementFeed !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition, never a hand-spelled string (the settled registration law)')
  }
  if (typeof input.admit !== 'function') {
    return refuseAssembly(CODES.ADMISSION_ABSENT, 'admit is REQUIRED — this module ships NO unadmitted path to the schedule service (the plane\'s PA walk occupies this seam at integration; L10)')
  }
  if (!isRecord(input.capturedAgent)
    || !isRecord(input.capturedAgent.session)
    || typeof input.capturedAgent.session.id !== 'string' || input.capturedAgent.session.id.length === 0) {
    return refuseAssembly(CODES.INPUT_INVALID, 'capturedAgent is REQUIRED — the REAL live owner Agent object the host binds (tools.ts:405/:411): dispatch REFERENCE-checks exec.agent against it exactly like the host (exec.agent !== agent → internal_error, tools.ts:438/:457/:481/:509) and the service-call sessionId is read from it (root ②: a config id-string never re-pairs an Agent object)')
  }
  if (typeof input.liveScheduleService !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'liveScheduleService () => ctx.schedule is REQUIRED — the host bodies resolve rootCtx.schedule AFRESH at every call (tools.ts:443/:460/:484/:515), so the row re-reads the CURRENT service at every dispatch edge; a bind-time constant compared against itself proves nothing (root ②)')
  }
  if (typeof input.ScheduleInputError !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'ScheduleInputError is REQUIRED — the PUBLISHED error class (export src/index.ts:36, the same class identity the host bodies throw); the L6 mirror runs the host\'s own `error instanceof ScheduleInputError` law (tools.ts:202), never a duck-code that leaks internal message bytes (root ③)')
  }
  const service = input.scheduleService
  if (!isRecord(service)) {
    return refuseAssembly(CODES.PORT_ABSENT, 'scheduleService is REQUIRED — the ctx.schedule-shaped REAL-SERVICE port (production: the live ctx.schedule); this adapter holds no schedule implementation')
  }
  if (input.liveScheduleService() !== service) {
    return refuseAssembly(CODES.PORT_DRIFT, 'liveScheduleService() does not answer the bound scheduleService — the mount is already split between two service objects; refuse at assembly, never dispatch into a split mount')
  }
  const frozenPortMethods = {}
  for (const method of Object.keys(A5_B_SCHEDULE_SERVICE_METHODS)) {
    if (typeof service[method] !== 'function') {
      return refuseAssembly(CODES.PORT_METHOD_ABSENT, `the port answers no function for published ScheduleService method '${method}' (${A5_B_SCHEDULE_SERVICE_METHODS[method].signature}) — a partial port is a config defect, never a degraded row`)
    }
    frozenPortMethods[method] = service[method]
  }
  const capturedAgent = input.capturedAgent
  const ScheduleInputErrorClass = input.ScheduleInputError
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

  const declaredProof = isRecord(input.declaredService) && input.declaredService.present === true
  const capturedIn = input.captured ?? {}
  if (!isRecord(capturedIn)) return refuseAssembly(CODES.INPUT_INVALID, 'captured must be a record (name -> {native, definitionIdentity}) or absent')
  for (const key of Object.keys(capturedIn)) {
    if (!Object.prototype.hasOwnProperty.call(A5_B_SCHEDULE_RECORD_SPECS, key)) {
      return refuseAssembly(CODES.NON_FAMILY_CAPTURE, `'${key}' is not a B-SCHEDULE record (the family is exactly ${A5_B_SCHEDULE_TOOL_NAMES.join(', ')}); another family's face never rides this module`)
    }
  }
  const captureKeys = Object.keys(capturedIn)
  if (captureKeys.length > 0 && typeof input.liveNative !== 'function') {
    return refuseAssembly(CODES.LIVE_NATIVE_ABSENT, 'liveNative is REQUIRED whenever a capture is presented — without the placement feed re-read the per-dispatch identity check is self-attestation (L7)')
  }
  // THE CAPTURE SHAPE LAW mirrors the REAL registration minimum entry (core/
  // tools register() @ 639): mandatory `output` face, function render/
  // presentationMeta, positive timeoutMs. A half-capture is refused at
  // assembly — never demoted to a declared row, never emitted for the real
  // entry to reject. Schema SEMANTICS stay host-owned (the spec verifies the
  // emitted definitions through the real registration entry).
  for (const [key, capture] of Object.entries(capturedIn)) {
    const native = isRecord(capture) ? capture.native : undefined
    const output = isRecord(native) ? native.output : undefined
    if (!isRecord(capture)
      || !isRecord(native) || native.name !== key || typeof native.description !== 'string' || typeof native.execute !== 'function'
      || !isRecord(output) || output.schema === undefined || typeof output.render !== 'function'
      || (output.presentationMeta !== undefined && typeof output.presentationMeta !== 'function')
      || (native.timeoutMs !== undefined && (!Number.isFinite(native.timeoutMs) || native.timeoutMs <= 0))
      || typeof capture.definitionIdentity !== 'string' || capture.definitionIdentity.length === 0) {
      return refuseAssembly(CODES.CAPTURE_INCOMPLETE, `captured.${key} must be a COMPLETE captured definition — {native: {name:'${key}', description, output:{schema, render, presentationMeta?}, execute, ...every presentation face verbatim}, definitionIdentity: non-empty string} (the real registration minimum-entry shape law; a half-capture is refused, never demoted)`)
    }
  }

  const rows = new Map()
  const declared = []
  const definitions = []
  const consumedPlans = new WeakSet()
  const state = { draining: false, dispatches: 0, refuses: 0 }
  /** Bind-time bindings live in this PRIVATE side table, never on the row
   *  face a consumer may spread or serialize (the row stays the honest
   *  presentation surface its .d.mts declares). */
  const boundOf = new WeakMap()

  const refuseWith = (name, code, detail) => {
    state.refuses += 1
    observe({ event: 'b-schedule:refusal', name, code })
    return refuse(code, detail)
  }

  /** L4/L7 edge integrity. Returns a refusal or null. */
  const edgeIntegrity = (row) => {
    if (state.draining) {
      return refuse(CODES.DRAINING, `${row.name}: draining — new calls are refused, committed writes stay durable (${DRAIN_SEMANTICS})`)
    }
    const bound = boundOf.get(row)
    if (bound === undefined) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: no bind-time binding exists — a row assembled outside this factory dispatches nothing`)
    }
    const live = input.liveNative(row.name)
    if (live !== bound.def) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the face behind liveNative is no longer the captured object — the governed call refuses; there is no replacement-body path and no native fallback`)
    }
    if (live.description !== bound.descriptionBytes || canonicalJson(live.parameters) !== canonicalJson(bound.parameters)) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's description or compiled parameter bytes moved since bind time`)
    }
    if (live.execute !== bound.execute) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's execute function is no longer the bound function value`)
    }
    // ROOT ②: read the CURRENT schedule service exactly where the host body
    // would resolve `rootCtx.schedule` — the old `service !== bound.port`
    // constant self-compare could never observe anything and is deleted.
    const current = input.liveScheduleService()
    if (current !== bound.port) {
      return refuse(CODES.PORT_DRIFT, `${row.name}: the CURRENT ctx.schedule read is not the bound port object — the host bodies resolve rootCtx.schedule afresh per call (tools.ts:443/:460/:484/:515); a service replaced underneath this mount is drift, full stop`)
    }
    for (const method of row.portMethods) {
      if (current[method] !== frozenPortMethods[method]) {
        return refuse(CODES.PORT_DRIFT, `${row.name}: the port method '${method}' was rebound underneath the frozen bind — a rebound service method is drift, full stop`)
      }
    }
    return null
  }

  /** L4 (root ②): the host's OWN identity law — REFERENCE equality of the
   *  live caller against the BOUND owner Agent object (tools.ts:438/:457/
   *  :481/:509 `exec.agent !== agent`). A miss answers the HOST's own
   *  identity-refusal VALUE (internal_error), zero port entry. Id bytes are
   *  NEVER the pairing fact: a look-alike Agent object is refused exactly
   *  like the host refuses it. */
  const ownerMatches = (exec) => isRecord(exec) && exec.agent === capturedAgent

  const buildActiveRow = (name, capture) => {
    const spec = A5_B_SCHEDULE_RECORD_SPECS[name]
    const def = capture.native
    const descriptionBytes = def.description
    const parameters = def.parameters === undefined ? Object.freeze({}) : def.parameters
    const portMethods = name === 'schedule_update'
      ? Object.freeze(['list', 'catalog', 'update'])
      : Object.freeze([name === 'schedule_create' ? 'create' : name === 'schedule_delete' ? 'delete' : 'list'])
    const row = {
      name,
      familyId: A5_B_SCHEDULE_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: A5_B_SCHEDULE_MOUNT_CONDITION,
      active: true,
      capturePresent: true,
      description: descriptionBytes,
      parameters,
      outputSchema: def.output.schema,
      definitionIdentity: capture.definitionIdentity,
      portMethods,
      namedGaps: A5_B_SCHEDULE_NAMED_GAPS,
      classify: (rawArgs) => classify(row, rawArgs),
      delegate: (plan, ctx) => delegate(row, plan, ctx),
    }
    boundOf.set(row, Object.freeze({ def, descriptionBytes, parameters, execute: def.execute, port: service }))
    return row
  }

  /** L3b (root ①): the contract §B-SCHEDULE target facts every plan carries.
   *  All values are READS of bound/published facts — the row claims nothing
   *  beyond the durable record write (TIMER_ARM / TRIGGER_GOVERNANCE carry
   *  exactly what it never claims). */
  const TARGET_TIMER_EFFECT = Object.freeze({
    schedule_create: 'arm — SERVICE-side: the committed record creates the timer obligation; the row never observes the arm',
    schedule_update: 're-align — SERVICE-side: the committed record re-computes the obligation (contract: 改规则即重对齐)',
    schedule_delete: 'disarm-on-durable-record-state — SERVICE-side: the scan only takes status === \'active\' (runtime.ts:90/:155); an already-queued wake is NOT retracted (captured DELETE_DESCRIPTION)',
    schedule_list: 'none — read-only',
  })
  const TARGET_REVISION_LAW = Object.freeze({
    schedule_create: 'service-mints-id-on-commit (storage tasks key = ScheduleId; no pre-commit revision exists)',
    schedule_update: 'cas-expected-record (the COMPLETE observed record read through THIS dispatch\'s list await — storage has no numeric revision; the expected record IS the revision carrier)',
    schedule_delete: 'id-scoped-durable-delete (the published delete request is {sessionId,id})',
    schedule_list: 'read-only',
  })
  const mintTarget = (name, law, snapshot) => Object.freeze({
    contract: 'M0-B-FAMILY-TARGET-CONTRACTS §B-SCHEDULE — target I+S(owner session+taskId+revision,action)+S(timer namespace,arm/reschedule/disarm)+S(destination session,wake)',
    owner: Object.freeze({ kind: 'bound-live-agent-reference', sessionId: capturedAgent.session.id }),
    action: A5_B_SCHEDULE_RECORD_SPECS[name].operation,
    taskId: law === undefined && (name === 'schedule_delete' || name === 'schedule_update') ? snapshot.id : null,
    revision: TARGET_REVISION_LAW[name],
    timer: Object.freeze({
      namespace: 'schedule-runtime-plugin-private (ScheduleRuntime, index.ts:113/:156 — NOT a public namespace handle)',
      effect: TARGET_TIMER_EFFECT[name],
    }),
    destination: Object.freeze({
      sessionId: capturedAgent.session.id,
      path: 'every published ScheduleService face is session-scoped to the bound owner and the wake resolves exactly task.sessionId (runtime.ts:101) — this family opens NO cross-session path from a caller string (C1)',
      wake: 'service-side agent.followup + sessions.flush (runtime.ts:123-124); NOT licensed by this invocation — see the TRIGGER_GOVERNANCE gap',
    }),
  })

  /** L8 classify: PURE over the arguments; the frozen plan is the ONLY thing
   *  delegate will ever run. No fs, no port, no clock here. */
  const classify = (row, rawArgs) => {
    if (state.draining) {
      return refuseWith(row.name, CODES.DRAINING, `${row.name}: draining — new calls are refused (${DRAIN_SEMANTICS})`)
    }
    if (rawArgs !== undefined && rawArgs !== null && !isRecord(rawArgs)) {
      return refuseWith(row.name, CODES.INPUT_INVALID, `${row.name}: arguments must be a record (the real dispatcher always hands an object; anything else is a mount anomaly)`)
    }
    const args = rawArgs === undefined || rawArgs === null ? {} : rawArgs
    const law = row.name === 'schedule_create'
      ? validateCreateArgs(args)
      : row.name === 'schedule_update'
        ? validateUpdateArgs(args)
        : row.name === 'schedule_delete'
          ? deleteIdLaw(args.id)
          : listArgsLaw(args)
    const snapshot = deepFreeze(jsonClone(args))
    const plan = deepFreeze({
      rowName: row.name,
      recordIndex: row.recordIndex,
      operation: A5_B_SCHEDULE_RECORD_SPECS[row.name].operation,
      target: mintTarget(row.name, law, snapshot),
      args: snapshot,
      ...(law === undefined ? {} : { toolError: deepFreeze({ ...law }) }),
      parametersFingerprint: `sha256:${sha256(canonicalJson({ name: row.name, args: snapshot }))}`,
      namedGaps: A5_B_SCHEDULE_NAMED_GAPS,
    })
    observe({ event: 'b-schedule:classified', name: row.name, toolError: law !== undefined })
    return deepFreeze({ ok: true, plan })
  }

  /** L5 host check-order + L3 dispatch. `exec` is LIVE (agent/signal ride by
   *  reference); nothing is taken from the plan closure. */
  const delegate = async (row, plan, ctx) => {
    const integrity = edgeIntegrity(row)
    if (integrity !== null) return refuseWith(row.name, integrity.code, integrity.detail)
    if (!isRecord(plan) || plan.rowName !== row.name || plan.recordIndex !== row.recordIndex) {
      return refuseWith(row.name, CODES.NOT_OWN_PLAN, `${row.name}: the presented plan belongs to another row — governed dispatch never runs a foreign plan`)
    }
    const fresh = classify(row, plan.args)
    if (fresh.ok !== true) return refuseWith(row.name, fresh.code, fresh.detail)
    if (fresh.plan.parametersFingerprint !== plan.parametersFingerprint) {
      return refuseWith(row.name, CODES.PLAN_STALE, `${row.name}: the plan's fingerprint does not match a fresh classification of its own snapshot — a mutated/stale plan never dispatches (L8)`)
    }
    if (consumedPlans.has(plan)) {
      return refuseWith(row.name, CODES.ALREADY_DISPATCHED, `${row.name}: this plan OBJECT was already dispatched — INTERNAL MEMO refusal only (NAMED GAP PLAN_ONCE_MEMO): the one-shot consumedProof is the center PA edge; the row claims no once-closure (L8/④)`)
    }
    const exec = isRecord(ctx) ? ctx.exec : undefined
    const order = CHECK_ORDER[row.name]
    const answerToolError = (value) => {
      consumedPlans.add(plan)
      observe({ event: 'b-schedule:tool-law-value', name: row.name, code: value.code })
      return deepFreeze({ ok: true, settled: 'tool-law-value', value })
    }
    if (order.toolError === 'first' && fresh.plan.toolError !== undefined) return answerToolError(fresh.plan.toolError)
    if (!ownerMatches(exec)) {
      // L4 (root ②): the host's own identity-refusal VALUE — exec.agent is
      // not the BOUND owner OBJECT (tools.ts:438/:457/:481/:509), zero port
      // entry, zero substitution. Id-string look-alikes fail here exactly
      // like the host fails them.
      return answerToolError(internalErrorValue())
    }
    if (fresh.plan.toolError !== undefined && order.toolError === 'after-agent') return answerToolError(fresh.plan.toolError)
    if (isRecord(exec) && isRecord(exec.signal) && exec.signal.aborted === true) {
      return answerToolError(internalErrorValue())
    }
    consumedPlans.add(plan)
    state.dispatches += 1
    // The service-call sessionId is read from the BOUND owner at call time
    // (the host bodies read agent.session.id at :443/:460/:484/:515) — never
    // from a caller string (C1), never from mount-time config bytes.
    const sessionId = capturedAgent.session.id
    const callPort = async (method, buildArgs) => {
      observe({ event: 'b-schedule:port-call', name: row.name, method })
      return frozenPortMethods[method].apply(service, buildArgs())
    }
    const signalOf = () => (isRecord(exec) && typeof exec.signal !== 'undefined' ? exec.signal : undefined)
    try {
      let value
      if (row.name === 'schedule_list') {
        const records = await callPort('list', () => [{ sessionId }])
        const now = Date.now()
        value = Object.freeze(records.map((record) => scheduleView(record, now)))
      } else if (row.name === 'schedule_create') {
        const record = await callPort('create', () => [sessionId, fresh.plan.args, signalOf()])
        value = scheduleView(record, Date.now())
      } else if (row.name === 'schedule_delete') {
        value = await callPort('delete', () => [deepFreeze({ sessionId, id: fresh.plan.args.id }), signalOf()])
      } else {
        // schedule_update: the host's TWO-STEP CAS (tools.ts:515-532), read
        // through the port THIS dispatch performs — never from a cached list.
        const id = fresh.plan.args.id
        const expected = (await callPort('list', () => [{ sessionId }]))
          .find((record) => record.id === id)
        if (expected === undefined) {
          const entries = await callPort('catalog', () => [])
          const ended = entries.some((entry) => entry.sessionId === sessionId && entry.id === id)
          value = deepFreeze({ id, updated: false, code: ended ? 'schedule_ended' : 'schedule_not_found' })
        } else {
          // ROOT ②: the await above is where this lane's world can move —
          // re-verify the FULL edge (definition, live service, method
          // identities, bound owner) AFTER list and BEFORE port.update. A
          // drift surfacing during the await refuses with ZERO update entry;
          // an owner swap mid-await answers the host identity-refusal VALUE.
          const recheck = edgeIntegrity(row)
          if (recheck !== null) {
            return refuseWith(row.name, recheck.code, `${row.name}: post-await re-verify (root ②) — ${recheck.detail}`)
          }
          if (!ownerMatches(exec)) {
            return answerToolError(internalErrorValue())
          }
          const change = timingChangeFrom(fresh.plan.args)
          // SHALLOW freeze only: the request envelope is ours, but `expected`
          // is a PORT-OWNED record — freezing service data through a governed
          // call would mutate the port's own state, which this row never does.
          const request = Object.freeze({
            sessionId,
            id,
            expected,
            ...(change === undefined ? {} : { change }),
            ...(fresh.plan.args.title === undefined ? {} : { title: fresh.plan.args.title }),
            ...(fresh.plan.args.prompt === undefined ? {} : { prompt: fresh.plan.args.prompt }),
          })
          const result = await callPort('update', () => [request, signalOf()])
          value = isRecord(result) && 'record' in result ? scheduleView(result.record, Date.now()) : result
        }
      }
      observe({ event: 'b-schedule:dispatched', name: row.name })
      // SHALLOW freeze: the wrapper is ours; `value` may carry port-owned
      // objects — the row never freezes the service's own data.
      return Object.freeze({ ok: true, settled: 'service', value })
    } catch (error) {
      // L6 (root ③): the captured bodies never re-raise — the host's own
      // law `error instanceof ScheduleInputError ? {code,message} :
      // internal_error` (tools.ts:202) against the INJECTED published class
      // identity; no duck path, no internal message leak; the event stays
      // OBSERVED, never swallowed.
      observe({ event: 'b-schedule:service-error', name: row.name })
      return deepFreeze({ ok: true, settled: 'service-error-value', value: toToolErrorValue(error, ScheduleInputErrorClass) })
    }
  }

  const buildDeclaredRow = (name, reason, code) => {
    const spec = A5_B_SCHEDULE_RECORD_SPECS[name]
    const refusal = refuse(code, `${name}: honest ${A5_B_SCHEDULE_MOUNT_CONDITION} declared row (${reason}) — no captured native face and/or no declared schedule-service proof was mounted; every classify/delegate refuses typed with zero port entry, zero substitution, no definition, no registration`)
    return Object.freeze({
      name,
      familyId: A5_B_SCHEDULE_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: A5_B_SCHEDULE_MOUNT_CONDITION,
      active: false,
      capturePresent: false,
      description: null,
      parameters: null,
      outputSchema: null,
      definitionIdentity: null,
      namedGaps: A5_B_SCHEDULE_NAMED_GAPS,
      classify: () => refusal,
      delegate: () => refusal,
    })
  }

  for (const name of A5_B_SCHEDULE_TOOL_NAMES) {
    const capture = capturedIn[name]
    if (!declaredProof) {
      const row = buildDeclaredRow(name, capture === undefined
        ? 'no declaredService proof and no capture'
        : `no declaredService proof; the presented capture is REPORTED and ignored — L1 (a def masking the native name with nothing behind it is the plane's refused class)`,
      CODES.DECLARED_MOUNT_ABSENT)
      rows.set(name, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'declared-mount-absent', row }))
      declared.push(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_SCHEDULE_FAMILY_ID, status: 'DECLARED-INACTIVE', reason: 'declared-mount-absent', captureReportedIgnored: capture !== undefined }))
      observe({ event: 'b-schedule:declared', name, reason: 'declared-mount-absent' })
      continue
    }
    if (capture === undefined) {
      const row = buildDeclaredRow(name, 'capture-absent', CODES.CAPTURE_ABSENT)
      rows.set(name, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'capture-absent', row }))
      declared.push(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_SCHEDULE_FAMILY_ID, status: 'DECLARED-INACTIVE', reason: 'capture-absent', captureReportedIgnored: false }))
      observe({ event: 'b-schedule:declared', name, reason: 'capture-absent' })
      continue
    }
    const row = buildActiveRow(name, capture)
    // THE CAPTURED DEFINITION TRAVELS COMPLETE (root 8b4 law): every face
    // rides verbatim BY REFERENCE; ONLY `execute` is replaced (the classify →
    // admit → dispatch body). Nested faces are NOT re-frozen — they belong
    // to the capture and the host registry keeps the same references.
    const definition = Object.freeze({ ...capture.native, execute: async (args, exec) => {
      const classified = row.classify(args)
      if (classified.ok !== true) throw refusalToThrow(classified)
      const admitted = await input.admit(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_SCHEDULE_FAMILY_ID, classified, exec }))
      if (admitted?.ok !== true) {
        throw refusalToThrow(admitted ?? { code: CODES.ADMISSION_ABSENT, detail: 'the admission seam refused this call' })
      }
      const settled = await row.delegate(classified.plan, { exec })
      if (settled?.ok !== true) throw refusalToThrow(settled)
      return settled.value
    } })
    rows.set(name, Object.freeze({ status: 'ACTIVE', row, definition, captureDefinitionIdentity: capture.definitionIdentity }))
    definitions.push(definition)
    observe({ event: 'b-schedule:mounted', name, recordIndex: row.recordIndex })
  }

  // THE MOUNT-MOMENT REGISTRATION (the settled agent-bindings law, post
  // publish): the key is the placement feed's RUNTIME identity of the PLACED
  // definition, read fresh, never cached, never hand-spelled. The shared
  // PAIRED writer hands each entry to registerA5GovernedFamily — THIS module
  // registers nothing itself.
  const mountedKeys = new Map()
  const familyRegistrations = () => Object.freeze(definitions.map((definition) => {
    const fed = input.placementFeed(definition.name)
    const key = isRecord(fed) && typeof fed.definitionIdentity === 'string' && fed.definitionIdentity.length > 0
      ? fed.definitionIdentity
      : null
    if (key === null) {
      throw new Error(`${CODES.PLACEMENT_KEY_ABSENT}: the placed row '${definition.name}' answered no definition identity through the placement feed — the family registration has no trusted key; a guessed key is forbidden and an unobserved silent skip is the drift the family gate measures`)
    }
    const seen = mountedKeys.get(definition.name)
    if (seen !== undefined && seen !== key) {
      throw new Error(`${CODES.PLACEMENT_KEY_MOVED}: the placement identity of '${definition.name}' moved between mount reads (${seen} -> ${key}) — a placed definition's identity does not float; the mount is broken and re-registers nothing`)
    }
    mountedKeys.set(definition.name, key)
    return Object.freeze({
      name: definition.name,
      recordIndex: A5_B_SCHEDULE_RECORD_SPECS[definition.name].recordIndex,
      definitionIdentity: key,
      entry: Object.freeze({
        familyId: A5_B_SCHEDULE_FAMILY_ID,
        adapterRevision: A5_B_SCHEDULE_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const rowsView = Object.freeze(Object.fromEntries([...rows.entries()]))
  // SHALLOW freeze of the assembly: the captured presentation faces and the
  // port's own data belong to their owners — the assembly REPORTS them by
  // reference and never freezes through them (only the plans/refusals/
  // declared entries, which this module mints, are deep-frozen).
  const assembly = Object.freeze({
    ok: true,
    familyId: A5_B_SCHEDULE_FAMILY_ID,
    revision: A5_B_SCHEDULE_ADAPTER_REVISION,
    mountCondition: A5_B_SCHEDULE_MOUNT_CONDITION,
    providerId,
    declaredProof,
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    /** ToolDefinition faces for the ACTIVE rows: the COMPLETE captured native
     *  definitions with ONLY execute replaced (classify → admit → dispatch).
     *  The plane places these verbatim; the real host registration entry
     *  accepts them (spec-verified through 真实 register 最低入口核). */
    definitions: Object.freeze(definitions),
    rows: rowsView,
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name)?.row,
    /** L9: new-call prohibition ONLY — settles nothing, rolls nothing back. */
    drain: () => {
      state.draining = true
      return deepFreeze({ event: 'b-schedule:drain', semantics: DRAIN_SEMANTICS })
    },
    inFlight: () => deepFreeze({ dispatches: state.dispatches, refuses: state.refuses }),
    /** THE family registration face — call it at the mount moment (AFTER
     *  publish); the PAIRED registration writer feeds each entry to
     *  registerA5GovernedFamily. Throws PLACEMENT_KEY_ABSENT /
     *  PLACEMENT_KEY_MOVED instead of guessing or skipping. */
    familyRegistrations,
  })
  return assembly
}
