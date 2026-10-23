/**
 * governed-families/team-adapters.mjs — A5-M2 governed-adapter rows for the
 * TEN B-TEAM member-operation records (frozen dispatch index
 * M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json records 74–82, 86; family law
 * M0-B-FAMILY-TARGET-CONTRACTS.md §B-TEAM). UNWIRED by ruling: NOTHING here
 * registers or mounts anything; the PAIRED registration writer feeds
 * `familyRegistrations()` entries at the mount moment exactly as the
 * B-SCHEDULE family does (schedule-adapters.mjs is the settled house style).
 *
 * ── THE DELEGATION-MODE DECISION (read this first) ─────────────────────────
 * B-TEAM's "native" is NOT a Host defineTool product: the ten tools are our
 * OWN lane products built by `createTeamTools(options)`
 * (packages/tools/src/tools.ts:1524, the closed fifteen-tool factory; the
 * five B-CONTROL siblings records 83/84/85/87/88 are g1-surface-adapters'
 * landed facts and are NOT re-adapted here — the families are mutually
 * UNRECOGNIZED). §B-TEAM rules the mechanism twice over: "全部采用既有Team
 * service角色/归属校验，P再接A" (run ALL existing Team-service role/ownership
 * checks; P re-walks A) and "不得重复建立同义service层" (do NOT re-establish
 * a synonymous service layer). Therefore THIS family captures the REAL
 * createTeamTools definitions, keeps every face verbatim, replaces ONLY
 * `execute`, and delegates each admitted call to the SAME captured governed
 * execute — the existing chain (makeDefinition's common entry → caller-root
 * binding → per-spec service role checks → last-mile guard → facade/
 * messaging/activity satellites). The row never re-implements any of it:
 * what the row ADDS is exactly the REQUIRED admit seat (L10), the pure
 * argument-law mirror answering the LANE's OWN typed rejected VALUES (L5),
 * the plan memo (L8), and the per-dispatch drift refusals (L7) — each with
 * zero delegate entry and NO native-fallback path. The prior B-SCHEDULE
 * pattern delegated to a service port because the host kept service and
 * tool-body separate; here the tool body IS the sanctioned service entry
 * (NAMED GAP SERVICE_ENTRY_DELEGATION states the boundary honestly).
 *
 * ── NATIVE-FACE LEDGER (comment-side ONLY: a string literal IS an edge to
 * the audit, so these path facts never live in values) ─────────────────────
 * all ten        LANE pkg @dsh-agent-team/tools, packages/tools/src/tools.ts:
 *                createTeamTools(options) @:1524 → makeDefinition(options, spec)
 *                @:425: the COMMON ENTRY every tool runs — isArgsRecord gate
 *                :447 (TeamToolArgsError 'team-tools: the tool arguments must
 *                be a JSON object'), requireStringField(rootSessionId, 255)
 *                :449, validateRequestToken(requestToken, 128) :454,
 *                resolveToolCaller(options, exec) :455 (reads exec.agent.id
 *                PER CALL :265-269, options.resolveCaller(sessionId) :284,
 *                malformed/throwing resolver → TEAM_TOOL_CALLER_UNRESOLVED
 *                rejected VALUE :269-313), the P0 CALLER-ROOT BINDING gate
 *                :459-477 (caller's OWNING root must equal the requested
 *                root → TEAM_TOOL_CALLER_ROOT_MISMATCH rejected VALUE with
 *                {callerRootSessionId, requestedRootSessionId} details),
 *                then spec.run(ctx, args); rejectFromError @:198 maps the
 *                typed lane errors to {status:'rejected', code, message,
 *                details?} and RE-THROWS anything unexpected. Argument law
 *                bytes: packages/tools/src/tokens.ts — TeamToolArgsError
 *                (code TEAM_TOOL_BAD_ARGUMENTS), requireStringField throws
 *                `team-tools: required argument '<f>' is missing` /
 *                `team-tools: argument '<f>' must be non-empty` /
 *                `team-tools: argument '<f>' exceeds <n> characters` with
 *                {field}/{field,maxLength,length} details, optionalStringField
 *                treats empty as ABSENT, validateRequestToken = ≤128.
 *                Lengths (tools.ts :136-150): root 255, body 8192, subject
 *                256, summary 512, lastAction 256, correlation 128,
 *                taskSummary 512, prompt 16384, attachedContext 32768,
 *                label 256, templateId 256, instanceId 256.
 * per-tool faces (spec @line, closed required + run-time argument law this
 * module MIRRORS as pure VALUES):
 *   team_list_members    :496 — required rootSessionId, requestToken; no run-side law
 *   team_list_templates  :518 — same
 *   team_inspect_config  :540 — + targetInstanceId (requireStringField 256) :570
 *   team_create_member   :570 — + delegationTemplateId (256), label (256); optional
 *                          groupId (256), workspace (512) — empty = absent
 *   team_delegate        :612 — label (256), prompt (16384) required; EXACTLY ONE of
 *                          delegationTemplateId / delegationInstanceId (both/neither →
 *                          TeamToolArgsError, messages mirrored verbatim); optional
 *                          groupId 256, workspace 512, taskSummary 512, attachedContext
 *                          32768; `async:false` = sync, ABSENT = async (2026-09-27 ruling)
 *   team_follow_up       :708 — + targetInstanceId (256), prompt (16384); optional
 *                          taskSummary 512, attachedContext 32768; async law same
 *   team_collect         :770 — requestTokens: non-empty array ≤64 non-empty strings
 *                          each ≤128 (three closed TeamToolArgsError messages mirrored)
 *   team_send_message    :815 — recipientInstanceId (256), body (8192); optional
 *                          subject (256); guarded on the target (executeGuarded)
 *   team_report_progress :854 — instanceId (256), subject (256), progress (closed enum
 *                          in-progress|completed|blocked, ≤32 — enum miss mirrored);
 *                          optional summary 512, lastAction 256, correlation 128;
 *                          guarded; ONE bounded retry on ACTIVITY_SEQUENCE_STALE
 *   team_archive_member  :1195 — targetInstanceId (256); Leader-gate (caller.kind ===
 *                          'instance' && caller.instanceId === LEADER_INSTANCE_ID else
 *                          TEAM_TOOL_ARCHIVE_NOT_LEADER rejected VALUE BEFORE guard and
 *                          any effect) is CALLER-DEPENDENT → it runs in the delegated
 *                          chain, never mirrored here (the row holds no caller facts)
 * registration         CENTER-owned: packages/runtime/src/plugin/live/
 *                      agent-bindings.mjs:2444-2456 (the member/leader tool
 *                      binding) — this module registers nothing (L11).
 * guard               executeGuarded (tools.ts, SD-GUARD): well-formed
 *                      instance ids ALWAYS consult the last-mile guard before
 *                      the satellite call; blocked verdicts are VALUES — all
 *                      inside the delegated chain.
 *
 * ── LAW INDEX ──────────────────────────────────────────────────────────────
 *  L1 HONEST DECLARED ROWS: mountCondition is `always` for all ten records,
 *     so the ONLY activation gate is a COMPLETE capture — an absent capture
 *     leaves an honest DECLARED-INACTIVE row whose classify/delegate refuse
 *     typed with zero delegate entry; a half-capture is an ASSEMBLY refusal
 *     (the real registration minimum-entry shape law: name/description/
 *     output{schema,render}/execute/definitionIdentity), never a demoted row.
 *  L2 ONLY EXECUTE IS REPLACED (root 8b4 law): the placed definition spreads
 *     the COMPLETE captured definition and swaps ONLY `execute`; name/
 *     description/compiled parameters/output{schema,render}/every
 *     presentation face ride verbatim BY REFERENCE (the spec checks every
 *     untouched face is === the captured object).
 *  L3 CAPTURE/PORT PAIRING: the REQUIRED `teamDelegates` port answers each
 *     family name with the CURRENT governed implementation, and at assembly
 *     `teamDelegates[name]` MUST BE the captured native execute itself (the
 *     capture and the port are two reads of the SAME createTeamTools set —
 *     a rebuilt set is a split mount, refused TEAM_SET_SPLIT before any row
 *     exists). No lane import: the module takes ONLY the injected faces
 *     (node:crypto is its only import, exactly as schedule-adapters).
 *  L4 CALLER IDENTITY IS THE DELEGATED CHAIN'S (contrast B-SCHEDULE): the
 *     lane surface resolves the caller PER CALL from exec.agent
 *     (tools.ts:265-269) and enforces the durable caller-root binding
 *     (:459-477) — live facts by construction. The row binds NO agent object,
 *     mints NO identity claim, and passes `exec` through BY REFERENCE; an
 *     unresolvable caller answers the lane's own TEAM_TOOL_CALLER_UNRESOLVED
 *     VALUE from inside the delegated chain (NAMED GAP CALLER_IDENTITY).
 *  L5 PURE ARGUMENT MIRROR, LANE BYTES: classify runs the common-entry law
 *     (args record → rootSessionId ≤255 → requestToken ≤128) and the per-tool
 *     spec.run pure law (required fields, lengths, the delegate exactly-one
 *     law, the collect token-array law, the progress closed enum) answering
 *     the LANE'S OWN rejected-VALUE shape {status:'rejected',
 *     code:'TEAM_TOOL_BAD_ARGUMENTS', message, details?} with byte-identical
 *     messages — the lane never throws these at the model (rejectFromError
 *     maps them), so the row answers them as VALUES too, never throws them.
 *     ORDER NOTE (recorded): the common-entry mirror runs where the lane
 *     runs it (before the caller path); the per-tool mirror runs EARLIER
 *     than the lane (the lane checks inside spec.run, after caller
 *     resolution) — a strict tightening that can only turn a would-be
 *     caller-error or later rejection into an earlier ARG rejection with the
 *     lane's own bytes; it never turns a lane rejection into an accept, and
 *     the delegated chain re-runs the full order anyway. Caller-dependent
 *     gates (Leader-gate, guard, roles, quotas, envelope) are NEVER mirrored.
 *  L6 UNEXPECTED ERRORS PASS THROUGH: the delegated chain maps every TYPED
 *     lane error to a rejected VALUE (rejectFromError) and re-throws only
 *     the unexpected; the row catches NOTHING and fabricates no error map —
 *     no duck-coding against error shapes (root ③ spirit: no foreign error
 *     bytes ever enter a value the row mints; the row mints no values from
 *     errors at all).
 *  L7 PER-DISPATCH EDGE RE-VERIFY: before any delegate entry the row
 *     re-answers REQUIRED `liveNative(name)` — the definition OBJECT
 *     identity, its description bytes, and its compiled parameters compared
 *     against the BIND-TIME CANONICAL SNAPSHOT (deep bytes, not the live
 *     shared reference — an in-place mutation cannot move both sides of the
 *     compare together; the row still CARRIES the original reference for
 *     presentation), and its execute function must match the bind-time
 *     capture — and REQUIRED `liveTeamDelegates()`, whose answer must be the
 *     SAME bound port OBJECT with the `name` method still the frozen
 *     delegate. THE VERIFIED HANDLES ARE THE INVOKED HANDLES: edge integrity
 *     returns {port, method} and the delegate edge calls exactly those —
 *     there is no second, unverified live read between check and entry. Any
 *     drift refuses typed with ZERO delegate entry: there is no
 *     replacement-body path and no native fallback (the governed row IS the
 *     only path it serves).
 *  L8 PLAN MEMO, RUN THE FRESH PLAN (root ④ boundary stated honestly):
 *     classify freezes {args snapshot, operation, target,
 *     parametersFingerprint, toolError?}; delegate re-derives classify on the
 *     snapshot, requires an equal fingerprint, refuses a foreign plan, a
 *     mutated/stale plan, and a REPLAY OF THE SAME CONSUMED PLAN OBJECT with
 *     zero delegate entry — an INTERNAL MEMO, NOT the one-shot ledger
 *     (NAMED GAP PLAN_ONCE_MEMO: real consumedProof is the CENTER PA edge).
 *     The requestToken (the durable facade idempotency identity) rides in
 *     the snapshot untouched — retry discipline stays the model's, the
 *     facade adjudicates (target.revision law).
 *  L9 DRAIN = NEW-CALL PROHIBITION ONLY. The lane's durable commits (ad-
 *     missions, messages, activity rows, lifecycle facts) stay durable;
 *     drain settles nothing, rolls nothing back, revives nothing.
 *  L10 NO UNADMITTED PATH: the factory REQUIRES `admit` — every placed
 *     definition runs classify → admit → delegate; any refusal throws with
 *     the refusing side's OWN typed bytes and zero delegate entry. The
 *     plane's PA walk occupies the seat; this module performs no PA walk.
 *  L11 UNWIRED / CENTER OWNS REGISTRATION (§B-TEAM): registration is
 *     agent-bindings.mjs:2444-2456 territory (CENTER); this module registers
 *     nothing, mounts nothing, imports nothing outside node:crypto. The
 *     PAIRED registration writer feeds familyRegistrations() entries to
 *     registerA5GovernedFamily at the mount moment (AFTER publish); the
 *     registration key is the placement feed's RUNTIME identity of the
 *     PLACED definition, read fresh — a guessed key throws, never skips.
 *
 * NAMED GAPS (carried verbatim on every plan, never faked closed) — see
 * A5_B_TEAM_NAMED_GAPS below.
 *
 * Windows dimensions: NOT RUN on this Linux harness, never claimed.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/team-adapters
 */
import { createHash } from 'node:crypto'

/** Census family (M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX records 74–82, 86). */
export const A5_B_TEAM_FAMILY_ID = 'B-TEAM'
export const A5_B_TEAM_ADAPTER_REVISION = 1
/** Frozen mount condition of all ten records (always). */
export const A5_B_TEAM_MOUNT_CONDITION = 'always'

/** The ten records: census recordIndex + the row's closed operation. */
export const A5_B_TEAM_RECORD_SPECS = Object.freeze({
  team_list_members: Object.freeze({ recordIndex: 74, operation: 'team-list-members' }),
  team_list_templates: Object.freeze({ recordIndex: 75, operation: 'team-list-templates' }),
  team_inspect_config: Object.freeze({ recordIndex: 76, operation: 'team-inspect-config' }),
  team_create_member: Object.freeze({ recordIndex: 77, operation: 'team-create-member' }),
  team_delegate: Object.freeze({ recordIndex: 78, operation: 'team-delegate' }),
  team_follow_up: Object.freeze({ recordIndex: 79, operation: 'team-follow-up' }),
  team_collect: Object.freeze({ recordIndex: 80, operation: 'team-collect' }),
  team_send_message: Object.freeze({ recordIndex: 81, operation: 'team-send-message' }),
  team_report_progress: Object.freeze({ recordIndex: 82, operation: 'team-report-progress' }),
  team_archive_member: Object.freeze({ recordIndex: 86, operation: 'team-archive-member' }),
})
export const A5_B_TEAM_TOOL_NAMES = Object.freeze([
  'team_list_members', 'team_list_templates', 'team_inspect_config',
  'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect',
  'team_send_message', 'team_report_progress', 'team_archive_member',
])

/**
 * The lane's per-target read/write effect-delta label per record (§B-TEAM:
 * create/delegate/followup含child运行及预算, collect含返回状态读, send/report
 * 含durable消息写, archive含成员生命周期). Comment-side ledger values ride
 * the plan as the contract label; the row OBSERVES none of it (the delegated
 * chain adjudicates — SERVICE_ENTRY_DELEGATION).
 */
export const A5_B_TEAM_EFFECT_LABELS = Object.freeze({
  team_list_members: 'S(read) — the durable Team roster through the existing facade action',
  team_list_templates: 'S(read) — the bound blueprint templates through the existing facade action',
  team_inspect_config: 'S(read) — ONE member\'s durable effective-policy view (config object)',
  team_create_member: 'I + S(durable member-lifecycle write: NEW instance; quota/envelope/gates adjudicated by the activation authority INSIDE the delegated chain)',
  team_delegate: 'I + S(durable work-unit admission; create-form additionally mints the member-lifecycle fact; child run + budget INSIDE the delegated chain; requestToken = the facade idempotency identity)',
  team_follow_up: 'I + S(durable work-unit admission on an EXISTING instance (same bound child session); guard on the target INSIDE the delegated chain)',
  team_collect: 'S(read) — durable work-status read-back by request tokens; writes nothing, delivers nothing',
  team_send_message: 'I + S(durable message write to the member\'s bound session via the messaging coordinator; relay policy + guard INSIDE the delegated chain; message-commit uncertainty is NOT blindly retried — that law lives in the coordinator)',
  team_report_progress: 'I + S(durable activity row on the per-subject lane; sequence + one bounded stale-retry INSIDE the delegated chain)',
  team_archive_member: 'I + S(member-lifecycle commits: quiesce-then-archive, one or TWO durable commits per the frozen FSM; Leader-gate BEFORE any effect — all INSIDE the delegated chain)',
})

/** Typed refusal codes OWNED by this module (closed set). */
export const A5_B_TEAM_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_TEAM_INPUT_INVALID',
  CAPTURE_ABSENT: 'P_B_TEAM_CAPTURE_ABSENT',
  CAPTURE_INCOMPLETE: 'P_B_TEAM_CAPTURE_INCOMPLETE',
  NON_FAMILY_CAPTURE: 'P_B_TEAM_NON_FAMILY_CAPTURE',
  LIVE_NATIVE_ABSENT: 'P_B_TEAM_LIVE_NATIVE_ABSENT',
  PORT_ABSENT: 'P_B_TEAM_PORT_ABSENT',
  PORT_METHOD_ABSENT: 'P_B_TEAM_PORT_METHOD_ABSENT',
  TEAM_SET_SPLIT: 'P_B_TEAM_TEAM_SET_SPLIT',
  PORT_DRIFT: 'P_B_TEAM_PORT_DRIFT',
  DEFINITION_DRIFT: 'P_B_TEAM_DEFINITION_DRIFT',
  ADMISSION_ABSENT: 'P_B_TEAM_ADMISSION_ABSENT',
  NOT_OWN_PLAN: 'P_B_TEAM_NOT_OWN_PLAN',
  PLAN_STALE: 'P_B_TEAM_PLAN_STALE',
  ALREADY_DISPATCHED: 'P_B_TEAM_ALREADY_DISPATCHED',
  DRAINING: 'P_B_TEAM_DRAINING',
  PLACEMENT_KEY_ABSENT: 'P_B_TEAM_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_B_TEAM_PLACEMENT_KEY_MOVED',
})
const CODES = A5_B_TEAM_CODES

/**
 * The dimensions this adapter can NEVER serve through its seam — carried
 * verbatim on every plan instead of being faked closed.
 */
export const A5_B_TEAM_NAMED_GAPS = Object.freeze({
  SERVICE_ENTRY_DELEGATION: 'THE DELEGATE IS THE EXISTING GOVERNED CHAIN, NOT A RE-IMPLEMENTATION (§B-TEAM: 全部采用既有Team service角色/归属校验 / 不得重复建立同义service层): every role/ownership/quota/envelope check, the last-mile guard (blocked VALUES), the create/delegate single-flight, the follow-up no-double-start law, the archive drain-then-commit lifecycle, and the message-commit-uncertainty no-blind-retry law run INSIDE the delegated createTeamTools execution (tools.ts makeDefinition:425-493 → resolveToolCaller:261 → caller-root binding:459-477 → executeGuarded → facade/messaging/activity). This row VERIFIES NONE of that at its seam — what it adds is the REQUIRED admit seat, the pure argument mirror, the plan memo, and the per-dispatch drift refusals, each with zero delegate entry. The family C2 (10/10 positives + cross-root/member/role negatives through the REAL services) is the paired acceptance\'s obligation, not this module\'s.',
  CALLER_IDENTITY: 'CALLER IDENTITY AND THE CALLER-ROOT BINDING ARE THE DELEGATED CHAIN\'S PER-CALL FACTS (tools.ts:265-269 reads exec.agent.id every call; :459-477 compares the resolver\'s OWNING root against the requested root — TEAM_TOOL_CALLER_UNRESOLVED / TEAM_TOOL_CALLER_ROOT_MISMATCH are the lane\'s own rejected VALUES). The row binds no Agent object and mirrors no caller facts: a rootSessionId ARGUMENT is always a CLAIM the delegated chain adjudicates against durable ownership — never trusted from the caller string (C1). (Contrast B-SCHEDULE: the host tool bound an Agent at register time, so that row re-checks the reference; this lane surface is per-call by construction.)',
  PLAN_ONCE_MEMO: 'PLAN-ONCE IS AN INTERNAL MEMO, NOT THE ONE-SHOT LEDGER (root ④): consumedPlans refuses replaying the SAME plan OBJECT with zero delegate entry; a caller that COPIES a plan\'s fields re-dispatches (the fingerprint law re-runs the whole argument law on the copy). The real one-shot edge is TWOFOLD and neither half is this row: the CENTER PA consume-for-execution proof, and the lane\'s OWN requestToken idempotency (the facade admits the same logical operation once — durable, INSIDE the delegated chain). This row mints no consumedProof and never claims once-closure.',
  GUARD_AND_LIFECYCLE: 'GUARD BLOCKS AND LIFECYCLE OUTCOMES ARE DELEGATED VALUES: pending-control blocks (blocked + requestId), the Leader-gate (TEAM_TOOL_ARCHIVE_NOT_LEADER), CREATED/ARCHIVED/DISPOSED archive rejections, guard blocked semantics on async completions, and the async admission receipt (workStatus \'admitted\', settled false) all arrive as VALUES from the existing chain — the row passes them through verbatim and claims no authority over them.',
})

const DRAIN_SEMANTICS = 'drain = NEW-CALL PROHIBITION: the lane\'s durable commits (admissions, messages, activity rows, lifecycle facts) stay durable; drain settles nothing, rolls nothing back, revives nothing'

/* ── small internal primitives (sibling house, schedule-adapters) ─────── */

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

/* ── L5 mirror: the lane's OWN argument law, mirrored for the pure half ── */

/** The lane closed argument code (tokens.ts:24). */
const TEAM_TOOL_BAD_ARGUMENTS = 'TEAM_TOOL_BAD_ARGUMENTS'
const ROOT_SESSION_MAX_LENGTH = 255
const REQUEST_TOKEN_MAX_LENGTH = 128
const BODY_MAX_LENGTH = 8192
const SUBJECT_MAX_LENGTH = 256
const SUMMARY_MAX_LENGTH = 512
const LAST_ACTION_MAX_LENGTH = 256
const CORRELATION_MAX_LENGTH = 128
const TASK_SUMMARY_MAX_LENGTH = 512
const WORK_PROMPT_MAX_LENGTH = 16384
const ATTACHED_CONTEXT_MAX_LENGTH = 32768
const LABEL_MAX_LENGTH = 256
const TEMPLATE_ID_MAX_LENGTH = 256
const INSTANCE_ID_MAX_LENGTH = 256
const PROGRESS_VALUES = Object.freeze(['in-progress', 'completed', 'blocked'])

/** The lane rejected-VALUE shape (rejectFromError maps TeamToolArgsError to
 *  exactly this — tools.ts:225-232); the row answers the SAME shape. */
const badArgs = (message, details) => (details === undefined
  ? { status: 'rejected', code: TEAM_TOOL_BAD_ARGUMENTS, message }
  : { status: 'rejected', code: TEAM_TOOL_BAD_ARGUMENTS, message, details })

/** readStringField mirror (tokens.ts:92-104): a PRESENT non-string refuses. */
function readString(args, field) {
  const value = args[field]
  if (value === undefined) return { value: undefined }
  if (typeof value !== 'string') {
    return { error: badArgs(`team-tools: argument '${field}' must be a string`, { field }) }
  }
  return { value }
}

/** requireStringField mirror (tokens.ts:114-131) — byte-identical messages. */
function requireString(args, field, maxLength) {
  const read = readString(args, field)
  if (read.error !== undefined) return read
  if (read.value === undefined) {
    return { error: badArgs(`team-tools: required argument '${field}' is missing`, { field }) }
  }
  if (read.value.length === 0) {
    return { error: badArgs(`team-tools: argument '${field}' must be non-empty`, { field }) }
  }
  if (read.value.length > maxLength) {
    return {
      error: badArgs(`team-tools: argument '${field}' exceeds ${maxLength} characters`, { field, maxLength, length: read.value.length }),
    }
  }
  return { value: read.value }
}

/** optionalStringField mirror (tokens.ts:141-152): empty string = ABSENT. */
function optionalString(args, field, maxLength) {
  const read = readString(args, field)
  if (read.error !== undefined) return read
  if (read.value === undefined || read.value.length === 0) return { value: undefined }
  if (read.value.length > maxLength) {
    return {
      error: badArgs(`team-tools: argument '${field}' exceeds ${maxLength} characters`, { field, maxLength, length: read.value.length }),
    }
  }
  return { value: read.value }
}

/** The per-tool pure argument law (L5): returns the lane's rejected VALUE
 *  or undefined. ONLY pure checks the mirrored spec.run code performs with
 *  the pure shape requireStringField/optionalStringField/closed checks have;
 *  caller-dependent gates are NEVER mirrored (L5 ORDER NOTE in the header). */
function teamArgsLaw(name, args) {
  // Common entry (makeDefinition:449/:454) — the lane runs these FIRST.
  const root = requireString(args, 'rootSessionId', ROOT_SESSION_MAX_LENGTH)
  if (root.error !== undefined) return root.error
  const token = requireString(args, 'requestToken', REQUEST_TOKEN_MAX_LENGTH)
  if (token.error !== undefined) return token.error
  switch (name) {
    case 'team_list_members':
    case 'team_list_templates':
      return undefined
    case 'team_inspect_config':
    case 'team_archive_member': {
      const target = requireString(args, 'targetInstanceId', INSTANCE_ID_MAX_LENGTH)
      return target.error
    }
    case 'team_create_member': {
      const templateId = requireString(args, 'delegationTemplateId', TEMPLATE_ID_MAX_LENGTH)
      if (templateId.error !== undefined) return templateId.error
      const label = requireString(args, 'label', LABEL_MAX_LENGTH)
      if (label.error !== undefined) return label.error
      const groupId = optionalString(args, 'groupId', 256)
      if (groupId.error !== undefined) return groupId.error
      const workspace = optionalString(args, 'workspace', 512)
      return workspace.error
    }
    case 'team_delegate': {
      const label = requireString(args, 'label', LABEL_MAX_LENGTH)
      if (label.error !== undefined) return label.error
      const prompt = requireString(args, 'prompt', WORK_PROMPT_MAX_LENGTH)
      if (prompt.error !== undefined) return prompt.error
      const templateId = optionalString(args, 'delegationTemplateId', TEMPLATE_ID_MAX_LENGTH)
      if (templateId.error !== undefined) return templateId.error
      const instanceId = optionalString(args, 'delegationInstanceId', INSTANCE_ID_MAX_LENGTH)
      if (instanceId.error !== undefined) return instanceId.error
      // The closed exactly-one law (delegateSpec — messages byte-verbatim).
      if (templateId.value === undefined && instanceId.value === undefined) {
        return badArgs('team-tools: delegate requires exactly one of delegationTemplateId / delegationInstanceId')
      }
      if (templateId.value !== undefined && instanceId.value !== undefined) {
        return badArgs('team-tools: delegate accepts exactly one of delegationTemplateId / delegationInstanceId, not both')
      }
      const groupId = optionalString(args, 'groupId', 256)
      if (groupId.error !== undefined) return groupId.error
      const workspace = optionalString(args, 'workspace', 512)
      if (workspace.error !== undefined) return workspace.error
      const taskSummary = optionalString(args, 'taskSummary', TASK_SUMMARY_MAX_LENGTH)
      if (taskSummary.error !== undefined) return taskSummary.error
      const attachedContext = optionalString(args, 'attachedContext', ATTACHED_CONTEXT_MAX_LENGTH)
      return attachedContext.error
    }
    case 'team_follow_up': {
      const target = requireString(args, 'targetInstanceId', INSTANCE_ID_MAX_LENGTH)
      if (target.error !== undefined) return target.error
      const prompt = requireString(args, 'prompt', WORK_PROMPT_MAX_LENGTH)
      if (prompt.error !== undefined) return prompt.error
      const taskSummary = optionalString(args, 'taskSummary', TASK_SUMMARY_MAX_LENGTH)
      if (taskSummary.error !== undefined) return taskSummary.error
      const attachedContext = optionalString(args, 'attachedContext', ATTACHED_CONTEXT_MAX_LENGTH)
      return attachedContext.error
    }
    case 'team_collect': {
      // collectSpec: a non-empty array of at most 64 non-empty strings ≤128.
      const raw = args.requestTokens
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > 64) {
        return badArgs('team-tools: argument \'requestTokens\' must be a non-empty array of at most 64 work request tokens')
      }
      for (const entryToken of raw) {
        if (typeof entryToken !== 'string' || entryToken.length === 0) {
          return badArgs("team-tools: argument 'requestTokens' entries must be non-empty strings")
        }
        if (entryToken.length > REQUEST_TOKEN_MAX_LENGTH) {
          return badArgs(`team-tools: argument 'requestTokens' entries exceed ${REQUEST_TOKEN_MAX_LENGTH} characters`, { length: entryToken.length })
        }
      }
      return undefined
    }
    case 'team_send_message': {
      const recipient = requireString(args, 'recipientInstanceId', INSTANCE_ID_MAX_LENGTH)
      if (recipient.error !== undefined) return recipient.error
      const body = requireString(args, 'body', BODY_MAX_LENGTH)
      if (body.error !== undefined) return body.error
      const subject = optionalString(args, 'subject', SUBJECT_MAX_LENGTH)
      return subject.error
    }
    case 'team_report_progress': {
      const instanceId = requireString(args, 'instanceId', INSTANCE_ID_MAX_LENGTH)
      if (instanceId.error !== undefined) return instanceId.error
      const subject = requireString(args, 'subject', SUBJECT_MAX_LENGTH)
      if (subject.error !== undefined) return subject.error
      const progress = requireString(args, 'progress', 32)
      if (progress.error !== undefined) return progress.error
      if (!PROGRESS_VALUES.includes(progress.value)) {
        return badArgs("team-tools: argument 'progress' must be one of in-progress | completed | blocked", { progress: progress.value })
      }
      const summary = optionalString(args, 'summary', SUMMARY_MAX_LENGTH)
      if (summary.error !== undefined) return summary.error
      const lastAction = optionalString(args, 'lastAction', LAST_ACTION_MAX_LENGTH)
      if (lastAction.error !== undefined) return lastAction.error
      const correlation = optionalString(args, 'correlation', CORRELATION_MAX_LENGTH)
      return correlation.error
    }
    default:
      return undefined
  }
}

/* ── the factory ────────────────────────────────────────────────────── */

const refuseAssembly = (code, message) => deepFreeze({ ok: false, code, message })

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-b-team ${String(refusal?.code ?? CODES.INPUT_INVALID)} — ${String(refusal?.detail ?? 'the adapter refused without a detail')}`)
  error.code = refusal?.code
  error.teamRefusal = deepFreeze({ ...refusal })
  return error
}

/**
 * Assembly-time factory for the ten B-TEAM rows.
 *
 * @param input {{
 *   providerId?: string,
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *       // native = the COMPLETE captured createTeamTools definition (every
 *       // face verbatim); the placed def spreads it and replaces ONLY execute
 *   liveNative: (name: string) => unknown,   // REQUIRED placement feed re-read
 *   teamDelegates: Record<string, Function>, // REQUIRED: name -> the CURRENT
 *       // governed implementation; at assembly each entry MUST BE the
 *       // captured native execute (L3 pairing — one createTeamTools set)
 *   liveTeamDelegates: () => unknown,        // REQUIRED per-dispatch live
 *       // re-read of the CURRENT delegates object (L7)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   admit: (ctx: object) => Promise<{ ok: boolean, code?: string, detail?: string }>,
 *   observe?: (row: unknown) => void,
 * }} input
 * @returns a frozen `{ ok: true, assembly }` or a frozen `{ ok: false, code, message }`.
 */
export function createTeamAdapterAssembly(input = {}) {
  if (!isRecord(input)) return refuseAssembly(CODES.INPUT_INVALID, 'the factory takes one input record')
  const knownInput = new Set(['providerId', 'captured', 'liveNative', 'teamDelegates', 'liveTeamDelegates', 'placementFeed', 'admit', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(CODES.INPUT_INVALID, `unknown input '${key}' — the factory takes exactly {providerId, captured, liveNative, teamDelegates, liveTeamDelegates, placementFeed, admit, observe}`)
    }
  }
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'b-team'
  if (typeof input.placementFeed !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition, never a hand-spelled string (the settled registration law)')
  }
  if (typeof input.admit !== 'function') {
    return refuseAssembly(CODES.ADMISSION_ABSENT, 'admit is REQUIRED — this module ships NO unadmitted path to the governed team tools (the plane\'s PA walk occupies this seam at integration; L10)')
  }
  if (typeof input.liveTeamDelegates !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'liveTeamDelegates () => the CURRENT delegates object is REQUIRED — the row re-reads the live governed implementation at every dispatch edge (L7); a bind-time constant compared against itself proves nothing (sibling root ② law)')
  }
  const delegates = input.teamDelegates
  if (!isRecord(delegates)) {
    return refuseAssembly(CODES.PORT_ABSENT, 'teamDelegates is REQUIRED — the name -> governed-execute port of the SAME createTeamTools set the capture came from (production: the live tool set); this adapter holds no team implementation')
  }
  if (input.liveTeamDelegates() !== delegates) {
    return refuseAssembly(CODES.PORT_DRIFT, 'liveTeamDelegates() does not answer the bound teamDelegates — the mount is already split between two implementation sets; refuse at assembly, never dispatch into a split mount')
  }
  const capturedIn = input.captured ?? {}
  if (!isRecord(capturedIn)) return refuseAssembly(CODES.INPUT_INVALID, 'captured must be a record (name -> {native, definitionIdentity}) or absent')
  for (const key of Object.keys(capturedIn)) {
    if (!Object.prototype.hasOwnProperty.call(A5_B_TEAM_RECORD_SPECS, key)) {
      return refuseAssembly(CODES.NON_FAMILY_CAPTURE, `'${key}' is not a B-TEAM record (the family is exactly ${A5_B_TEAM_TOOL_NAMES.join(', ')}); the B-CONTROL five and every other family's face never ride this module`)
    }
  }
  const captureKeys = Object.keys(capturedIn)
  if (captureKeys.length > 0 && typeof input.liveNative !== 'function') {
    return refuseAssembly(CODES.LIVE_NATIVE_ABSENT, 'liveNative is REQUIRED whenever a capture is presented — without the placement feed re-read the per-dispatch identity check is self-attestation (L7)')
  }
  // THE CAPTURE SHAPE LAW mirrors the REAL registration minimum entry — the
  // makeDefinition product face (name/description/parameters/
  // output{schema,render}/execute) plus the mount identity (L1).
  const frozenDelegates = {}
  for (const [key, capture] of Object.entries(capturedIn)) {
    const native = isRecord(capture) ? capture.native : undefined
    const output = isRecord(native) ? native.output : undefined
    if (!isRecord(capture)
      || !isRecord(native) || native.name !== key || typeof native.description !== 'string' || typeof native.execute !== 'function'
      || !isRecord(output) || output.schema === undefined || typeof output.render !== 'function'
      || (native.timeoutMs !== undefined && (!Number.isFinite(native.timeoutMs) || native.timeoutMs <= 0))
      || typeof capture.definitionIdentity !== 'string' || capture.definitionIdentity.length === 0) {
      return refuseAssembly(CODES.CAPTURE_INCOMPLETE, `captured.${key} must be a COMPLETE captured definition — {native: {name:'${key}', description, parameters, output:{schema, render}, execute, ...every presentation face verbatim}, definitionIdentity: non-empty string} (the real registration minimum-entry shape law; a half-capture is refused, never demoted)`)
    }
    if (typeof delegates[key] !== 'function') {
      return refuseAssembly(CODES.PORT_METHOD_ABSENT, `teamDelegates answers no function for the captured family member '${key}' — a partial delegate set is a config defect, never a degraded row`)
    }
    // L3 PAIRING: the capture and the port must be two reads of the SAME
    // tool set — the delegate IS the captured execute.
    if (delegates[key] !== native.execute) {
      return refuseAssembly(CODES.TEAM_SET_SPLIT, `teamDelegates['${key}'] is not the captured native execute — the capture and the delegate port come from different createTeamTools builds (a rebuilt set behind a stale capture is a split mount; refuse at assembly, L3)`)
    }
    frozenDelegates[key] = delegates[key]
  }
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

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
    observe({ event: 'b-team:refusal', name, code })
    return refuse(code, detail)
  }

  /** L7 edge integrity. Returns a frozen `{ port, method }` handle on the
   *  VERIFIED live read (root first-review fix 1: the delegate edge later
   *  INVOKES these exact handles — there is no second, unverified
   *  `liveTeamDelegates()` read on the dispatch path), or a refusal. */
  const edgeIntegrity = (row) => {
    if (state.draining) {
      return refuse(CODES.DRAINING, `${row.name}: draining — new calls are refused, durable lane commits stay durable (${DRAIN_SEMANTICS})`)
    }
    const bound = boundOf.get(row)
    if (bound === undefined) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: no bind-time binding exists — a row assembled outside this factory dispatches nothing`)
    }
    const live = input.liveNative(row.name)
    if (live !== bound.def) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the face behind liveNative is no longer the captured object — the governed call refuses; there is no replacement-body path and no native fallback`)
    }
    // fix 2 (root first-review): the compare base is the BIND-TIME CANONICAL
    // SNAPSHOT (deep bytes captured at bind time), never the live object's
    // own reference — an IN-PLACE mutation of the shared compiled-parameters
    // object can no longer move both sides of this comparison together. The
    // row/placed definition still CARRY the original reference (L2).
    if (live.description !== bound.descriptionBytes || canonicalJson(live.parameters) !== bound.parametersCanonical) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's description or compiled parameter bytes moved since bind time (compared against the BIND-TIME canonical snapshot, not the live shared reference)`)
    }
    if (live.execute !== bound.execute) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's execute function is no longer the bound function value`)
    }
    const current = input.liveTeamDelegates()
    if (current !== bound.port) {
      return refuse(CODES.PORT_DRIFT, `${row.name}: the CURRENT team delegates read is not the bound port object — a rebuilt/replaced implementation set underneath this mount is drift, full stop (L7)`)
    }
    const method = current[row.name]
    if (method !== frozenDelegates[row.name]) {
      return refuse(CODES.PORT_DRIFT, `${row.name}: the delegate '${row.name}' was rebound underneath the frozen bind — a rebound implementation is drift, full stop`)
    }
    return Object.freeze({ port: current, method })
  }

  const buildActiveRow = (name, capture) => {
    const spec = A5_B_TEAM_RECORD_SPECS[name]
    const def = capture.native
    const descriptionBytes = def.description
    const parameters = def.parameters === undefined ? Object.freeze({}) : def.parameters
    const row = {
      name,
      familyId: A5_B_TEAM_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: A5_B_TEAM_MOUNT_CONDITION,
      active: true,
      capturePresent: true,
      description: descriptionBytes,
      parameters,
      outputSchema: def.output.schema,
      definitionIdentity: capture.definitionIdentity,
      effectDelta: A5_B_TEAM_EFFECT_LABELS[name],
      namedGaps: A5_B_TEAM_NAMED_GAPS,
      classify: (rawArgs) => classify(row, rawArgs),
      delegate: (plan, ctx) => delegate(row, plan, ctx),
    }
    boundOf.set(row, Object.freeze({ def, descriptionBytes, parametersCanonical: canonicalJson(parameters), execute: def.execute, port: delegates }))
    return row
  }

  /** Contract §B-TEAM target facts every plan carries (目标I+S(可信durable
   *  root/member/template/config/消息/归档对象,exact operation)). All values
   *  are READS of captured/lane facts; every CLAIM-bearing adjudication is
   *  labelled where it actually runs (the delegated chain), never here. */
  const TARGET_OBJECT = Object.freeze({
    team_list_members: 'the durable Team roster (member instances + lifecycle + bound child session ids)',
    team_list_templates: 'the bound blueprint\'s member templates',
    team_inspect_config: 'ONE member\'s durable effective-policy / requirement / recovery facts',
    team_create_member: 'a NEW member instance from a blueprint template (the member-lifecycle object)',
    team_delegate: 'a work unit with BOTH real branches (tools.ts:688-701): CONTINUE form = a NEW round on an EXISTING delegation instance (guarded on that target, SD-GUARD), CREATE form = a NEW delegation plus template-resolved member (SD-CREATE, activation authority is the gate)',
    team_follow_up: 'a NEW work unit on an EXISTING member (same bound child session)',
    team_collect: 'the durable work-unit states behind the submitted request tokens',
    team_send_message: 'one durable attributed message on the recipient\'s bound session',
    team_report_progress: 'one durable activity row on the per-subject lane',
    team_archive_member: 'ONE member\'s lifecycle (quiesce-then-archive durable commits)',
  })
  const mintTarget = (name, law, snapshot) => Object.freeze({
    contract: 'M0-B-FAMILY-TARGET-CONTRACTS §B-TEAM — 目标I+S(可信durable root/member/template/config/消息/归档对象,exact operation)',
    root: Object.freeze({
      claim: snapshot.rootSessionId ?? null,
      adjudication: 'the caller-root binding gate INSIDE the delegated chain (tools.ts:459-477, TEAM_TOOL_CALLER_ROOT_MISMATCH) compares the resolver\'s durable OWNING root against this claim — the row never trusts the argument string (C1)',
    }),
    member: Object.freeze(
      // fix 3 (root first-review): team_delegate addresses its member
      // through the REAL two-branch law (tools.ts:688-701) — the continue
      // form carries delegationInstanceId (existing instance, SD-GUARD),
      // the create form carries delegationTemplateId (no existing target,
      // SD-CREATE activation gate). The generic branch below never saw the
      // continue form and mislabelled it template/null; it no longer runs
      // for team_delegate.
      name === 'team_delegate'
        ? ('delegationInstanceId' in snapshot
          ? { claim: snapshot.delegationInstanceId ?? null, adjudication: 'CONTINUE form (tools.ts:696-700): work on an EXISTING delegation instance — executeGuarded on THAT target inside the delegated chain (SD-GUARD); the row never resolves or trusts the instance id' }
          : { claim: snapshot.delegationTemplateId ?? null, adjudication: 'CREATE form (tools.ts:701): NO existing target — the activation authority is the gate inside the delegated chain (SD-CREATE); the template resolves durably there' })
        : ('targetInstanceId' in snapshot || 'recipientInstanceId' in snapshot || 'instanceId' in snapshot
          ? { claim: snapshot.targetInstanceId ?? snapshot.recipientInstanceId ?? snapshot.instanceId ?? null, adjudication: 'durable instance resolution INSIDE the delegated chain (labels/template ids are rejected; INSTANCE_ID addressing law)' }
          : (name === 'team_create_member'
            ? { claim: snapshot.delegationTemplateId ?? null, adjudication: 'the activation authority resolves the template DURABLY inside the delegated chain' }
            : 'no member addressed')),
    ),
    object: TARGET_OBJECT[name],
    action: A5_B_TEAM_RECORD_SPECS[name].operation,
    revision: 'requestToken = the durable facade idempotency identity (reuse = retry of the SAME logical operation — the facade/messaging lanes adjudicate); the row carries the token as data and claims no idempotency authority (NAMED GAP PLAN_ONCE_MEMO)',
    effect: A5_B_TEAM_EFFECT_LABELS[name],
    face: law === undefined ? 'the mirrored pure argument law passed' : 'the mirrored pure argument law REFUSED (lane bytes) — see plan.toolError',
  })

  /** L8 classify: PURE over the arguments; the frozen plan is the ONLY thing
   *  delegate will ever run. No delegate, no clock, no caller facts here. */
  const classify = (row, rawArgs) => {
    if (state.draining) {
      return refuseWith(row.name, CODES.DRAINING, `${row.name}: draining — new calls are refused (${DRAIN_SEMANTICS})`)
    }
    if (rawArgs !== undefined && rawArgs !== null && !isRecord(rawArgs)) {
      // Sibling house law: the real dispatcher always hands an object; a
      // non-record is a MOUNT ANOMALY (the lane's own JSON-object defense
      // stays armed behind it inside the delegated chain).
      return refuseWith(row.name, CODES.INPUT_INVALID, `${row.name}: arguments must be a record (the real dispatcher always hands an object; anything else is a mount anomaly)`)
    }
    const args = rawArgs === undefined || rawArgs === null ? {} : rawArgs
    const law = teamArgsLaw(row.name, args)
    const snapshot = deepFreeze(jsonClone(args))
    const plan = deepFreeze({
      rowName: row.name,
      recordIndex: row.recordIndex,
      operation: A5_B_TEAM_RECORD_SPECS[row.name].operation,
      target: mintTarget(row.name, law, snapshot),
      args: snapshot,
      ...(law === undefined ? {} : { toolError: deepFreeze({ ...law }) }),
      parametersFingerprint: `sha256:${sha256(canonicalJson({ name: row.name, args: snapshot }))}`,
      namedGaps: A5_B_TEAM_NAMED_GAPS,
    })
    observe({ event: 'b-team:classified', name: row.name, toolError: law !== undefined })
    return deepFreeze({ ok: true, plan })
  }

  /** L5/L6/L7/L8 dispatch. `exec` is LIVE and rides BY REFERENCE (the lane
   *  resolves the caller from it per call — L4); nothing is taken from the
   *  plan closure. */
  const delegate = async (row, plan, ctx) => {
    const edge = edgeIntegrity(row)
    if (edge !== null && edge.ok === false) return refuseWith(row.name, edge.code, edge.detail)
    if (!isRecord(plan) || plan.rowName !== row.name || plan.recordIndex !== row.recordIndex) {
      return refuseWith(row.name, CODES.NOT_OWN_PLAN, `${row.name}: the presented plan belongs to another row — governed dispatch never runs a foreign plan`)
    }
    const fresh = classify(row, plan.args)
    if (fresh.ok !== true) return refuseWith(row.name, fresh.code, fresh.detail)
    if (fresh.plan.parametersFingerprint !== plan.parametersFingerprint) {
      return refuseWith(row.name, CODES.PLAN_STALE, `${row.name}: the plan's fingerprint does not match a fresh classification of its own snapshot — a mutated/stale plan never dispatches (L8)`)
    }
    if (consumedPlans.has(plan)) {
      return refuseWith(row.name, CODES.ALREADY_DISPATCHED, `${row.name}: this plan OBJECT was already dispatched — INTERNAL MEMO refusal only (NAMED GAP PLAN_ONCE_MEMO): the real one-shot edges are the center PA consumedProof and the lane's own requestToken idempotency INSIDE the delegated chain; the row claims no once-closure (L8/④)`)
    }
    const answerToolError = (value) => {
      consumedPlans.add(plan)
      observe({ event: 'b-team:tool-law-value', name: row.name, code: value.code })
      return deepFreeze({ ok: true, settled: 'tool-law-value', value })
    }
    // L5: the mirrored pure argument law answers the LANE'S OWN rejected
    // VALUE with zero delegate entry (the lane never throws these at the
    // model — rejectFromError maps them to the same shape).
    if (fresh.plan.toolError !== undefined) return answerToolError(fresh.plan.toolError)
    consumedPlans.add(plan)
    state.dispatches += 1
    const exec = isRecord(ctx) ? ctx.exec : undefined
    observe({ event: 'b-team:delegate-call', name: row.name })
    // L6: NO catch here — the delegated chain maps every TYPED lane error to
    // a rejected VALUE itself (rejectFromError) and re-throws only the
    // unexpected; the row passes the value or the throw through verbatim,
    // fabricating no error map (no duck-coding, root ③ spirit). L4: exec
    // rides BY REFERENCE — the chain resolves the live caller from it.
    // fix 1 (root first-review): the invocation goes to the EXACT port and
    // method the edge-integrity read VERIFIED — no second liveTeamDelegates()
    // read exists between verification and invocation.
    return Promise.resolve(edge.method.call(edge.port, fresh.plan.args, exec)).then((value) => {
      observe({ event: 'b-team:dispatched', name: row.name })
      // SHALLOW freeze: the wrapper is ours; the lane's result may carry
      // lane-owned objects — the row never freezes the lane's own data.
      return Object.freeze({ ok: true, settled: 'delegated', value })
    })
  }

  const buildDeclaredRow = (name, reason, code) => {
    const spec = A5_B_TEAM_RECORD_SPECS[name]
    const refusal = refuse(code, `${name}: honest ${A5_B_TEAM_MOUNT_CONDITION} declared row (${reason}) — no captured governed team-tool face was mounted; every classify/delegate refuses typed with zero delegate entry, zero substitution, no definition, no registration`)
    return Object.freeze({
      name,
      familyId: A5_B_TEAM_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: A5_B_TEAM_MOUNT_CONDITION,
      active: false,
      capturePresent: false,
      description: null,
      parameters: null,
      outputSchema: null,
      definitionIdentity: null,
      namedGaps: A5_B_TEAM_NAMED_GAPS,
      classify: () => refusal,
      delegate: () => refusal,
    })
  }

  for (const name of A5_B_TEAM_TOOL_NAMES) {
    const capture = capturedIn[name]
    if (capture === undefined) {
      const row = buildDeclaredRow(name, 'capture-absent', CODES.CAPTURE_ABSENT)
      rows.set(name, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'capture-absent', row }))
      declared.push(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_TEAM_FAMILY_ID, status: 'DECLARED-INACTIVE', reason: 'capture-absent', captureReportedIgnored: false }))
      observe({ event: 'b-team:declared', name, reason: 'capture-absent' })
      continue
    }
    const row = buildActiveRow(name, capture)
    // THE CAPTURED DEFINITION TRAVELS COMPLETE (root 8b4 law): every face
    // rides verbatim BY REFERENCE; ONLY `execute` is replaced (the classify →
    // admit → delegate body).
    const definition = Object.freeze({ ...capture.native, execute: async (args, exec) => {
      const classified = row.classify(args)
      if (classified.ok !== true) throw refusalToThrow(classified)
      const admitted = await input.admit(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_TEAM_FAMILY_ID, classified, exec }))
      if (admitted?.ok !== true) {
        throw refusalToThrow(admitted ?? { code: CODES.ADMISSION_ABSENT, detail: 'the admission seam refused this call' })
      }
      // The mirrored argument law answers VALUES (the lane's own rejected
      // shape) — a tool-law miss is NOT an error, it is the lane's answer;
      // delegate settles it with zero delegate entry.
      const settled = await row.delegate(classified.plan, { exec })
      if (settled?.ok !== true) throw refusalToThrow(settled)
      return settled.value
    } })
    rows.set(name, Object.freeze({ status: 'ACTIVE', row, definition, captureDefinitionIdentity: capture.definitionIdentity }))
    definitions.push(definition)
    observe({ event: 'b-team:mounted', name, recordIndex: row.recordIndex })
  }

  // THE MOUNT-MOMENT REGISTRATION (the settled agent-bindings law, post
  // publish): the key is the placement feed's RUNTIME identity of the PLACED
  // definition, read fresh, never cached, never hand-spelled. The shared
  // PAIRED writer hands each entry to registerA5GovernedFamily — THIS module
  // registers nothing itself (L11; CENTER owns team registration).
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
      recordIndex: A5_B_TEAM_RECORD_SPECS[definition.name].recordIndex,
      definitionIdentity: key,
      entry: Object.freeze({
        familyId: A5_B_TEAM_FAMILY_ID,
        adapterRevision: A5_B_TEAM_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const rowsView = Object.freeze(Object.fromEntries([...rows.entries()]))
  // SHALLOW freeze of the assembly: the captured presentation faces and the
  // delegate set belong to their owners — the assembly REPORTS them by
  // reference and never freezes through them (only the plans/refusals/
  // declared entries, which this module mints, are deep-frozen).
  const assembly = Object.freeze({
    ok: true,
    familyId: A5_B_TEAM_FAMILY_ID,
    revision: A5_B_TEAM_ADAPTER_REVISION,
    mountCondition: A5_B_TEAM_MOUNT_CONDITION,
    providerId,
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    /** ToolDefinition faces for the ACTIVE rows: the COMPLETE captured
     *  governed definitions with ONLY execute replaced (classify → admit →
     *  delegate). The plane places these verbatim; the real registration
     *  minimum-entry shape law accepts them (spec-verified). */
    definitions: Object.freeze(definitions),
    rows: rowsView,
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name)?.row,
    /** L9: new-call prohibition ONLY — settles nothing, rolls nothing back. */
    drain: () => {
      state.draining = true
      return deepFreeze({ event: 'b-team:drain', semantics: DRAIN_SEMANTICS })
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
