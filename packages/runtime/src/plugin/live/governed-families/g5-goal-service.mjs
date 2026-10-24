/**
 * governed-families/g5-goal-service.mjs — A5-M2 G5 REAL-SERVICE ADAPTER for
 * the host goal tools `create_goal` / `get_goal` / `update_goal` (census
 * records 27/28/29, family B-SESSION, ownerRole SERVICE, mountCondition
 * always, onMountObligation FULL_GOVERNANCE — M0-B-RECORD-FAMILY-ACCEPTANCE-
 * INDEX.json; contract M0-B-FAMILY-TARGET-CONTRACTS.md §3 B-SESSION: owner/
 * revision checks BEFORE the E session service commits, 保留原生). UNWIRED
 * component: the plane/glue (CENTER) places it; no Host process, no network.
 *
 * This is NOT a generic tool-invoke shell: EACH of the three tools gets its
 * OWN typed row carrying (a) the tool's OWN captured native description and
 * compiled parameter-schema bytes (captured from the live registration via
 * the injected `readNative` seam at placement — never re-authored here) and
 * (b) its OWN dispatch mapping onto the injected goal-service port, whose
 * interface mirrors the REAL host `GoalService` methods one-for-one (same
 * names, same arity, same return). No row dispatches through a shared
 * string-command wrapper; the mapping closures are per-tool, per-action.
 *
 * ── NATIVE-FACE / SERVICE LEDGER (all @639ed01539, pristine checkout, path
 * source tests/paths.mjs; comment-side ONLY — a string literal IS an edge) ──
 * tools plugin   dsh-tool-goal tool-goal/src/index.ts: name 'tool-goal' :28;
 *                inject [agents,goals,tools,systemPrompt,sessionProjections] :29;
 *                Config.blockedAfterConsecutiveRounds default 3 :38-40,:126-132;
 *                UPDATE_ACTIONS [edit,pause,resume,complete,blocked] :49;
 *                GET_DESCRIPTION :56; CREATE_DESCRIPTION :51-54; update_goal
 *                description 'Update the current goal.' :236; GoalToolValue
 *                :59-72; GOAL_VALUE_SCHEMA :74-112; goalRef law :145-154
 *                (non-empty trim-stable goal_id + positive safe-integer
 *                revision, else GOAL_TOOL_INVALID_UPDATE); hasText/hasRoundCap
 *                filler law :134-142; goalValue projection :157-173; shared
 *                GOAL_OUTPUT (render = JSON.stringify) :176-179.
 * get_goal       register :195-205; parameters {} :198; body
 *                goalValue(ctx.goals.get(execution.agent)) :202.
 * create_goal    register :207-232; parameters objective(required)/
 *                max_goal_rounds :210-220; requireDirectHuman :224; body
 *                ctx.goals.create(agent, { objective,
 *                ...max_goal_rounds===undefined?{}:{maxGoalRounds} }) :225-228
 *                — NO zero-filter here (asymmetry vs update is REAL).
 * update_goal    register :234-342; parameters goal_id/revision/action(enum)
 *                +objective/max_goal_rounds/blocked_reason :237-253; goalRef
 *                :257; replacements {objective?,maxGoalRounds?} :258-261;
 *                edit: requireDirectHuman :263, blocked_reason excluded :264-
 *                266, ctx.goals.edit(agent, ref, replacements) :267; pause/
 *                resume: requireDirectHuman :271, objective/max_goal_rounds/
 *                blocked_reason excluded :272-277, the model may NOT resume a
 *                paused goal — GOAL_TOOL_RESUME_PAUSED after reading the
 *                CURRENT goal :278-285, ctx.goals.pause/resume :286-288;
 *                complete/blocked: completionAuthority :291, objective/
 *                max_goal_rounds excluded :292-296, blocked_reason excluded
 *                for complete :298-300 and REQUIRED for blocked :301-304,
 *                blocked threshold (roundsStarted < blockedAfter under
 *                goal-round authority) :305-312, ctx.goals.complete :314,
 *                ctx.goals.block(agent, ref, {code:'model-reported',message})
 *                :315-318; goal-round wrap-up via exec.deferContext(create
 *                UserMessage(renderWrapupContext(...))) :319-330.
 * authority      tool-goal/src/authority.ts: goalToolExecution (exec.agent
 *                required :49-52; exact live agent inside its active driver
 *                :53-59; open model turn required :33-39); requireDirectHuman
 *                :100-103; completionAuthority :111-118.
 * service        dsh-goal goal/src/index.ts: Context merge `goals: GoalService`
 *                :59-63; class GoalService :240; get(agent): GoalView |
 *                undefined :277; disarm :289; create(agent, request):
 *                GoalView :303 (objective trim + maxGoalRounds positive safe
 *                integer + defaultMaxGoalRounds default 256 live INSIDE the
 *                service :199-220,:243-245 — the adapter never pre-resolves
 *                or pre-validates them); edit(agent, ref, request): GoalView
 *                :329; pause(agent, ref): GoalView :352; resume(agent, ref):
 *                GoalView :364; complete(agent, ref): GoalView :391; block
 *                (agent, ref, reason): GoalView :409; clear(agent, ref):
 *                GoalRef :433; commit = synchronous session append
 *                :609-626.
 * domain types   goal/src/types.ts: GoalId branded :17; GoalRef {id,revision}
 *                :20-25; CreateGoalRequest {objective,maxGoalRounds?} :28-31;
 *                EditGoalRequest {objective?,maxGoalRounds?} :39-42;
 *                GoalPhase active|paused|blocked|complete :45-49;
 *                GoalBlockReason {code,message} :52-57; GoalSnapshot :60-69;
 *                GoalActivation armed|disarmed :72; GoalView = snapshot +
 *                roundsStarted/createdAt/updatedAt/activation :90-99.
 *
 * RESULT SHAPE (all three tools, GOAL_OUTPUT :176-179 over GoalToolValue
 * :59-72): `{ goal: null }` OR `{ goal: { id, revision, objective, phase,
 * roundsStarted, maxGoalRounds, blockedReason?{code,message} }, activation }`
 * — createdAt/updatedAt are DELIBERATELY absent (the projection at :157-173
 * never copies them); activation is observation, not replay state.
 *
 * ROOT LAWS (module UNWIRED; the spec legs run against recorded DOUBLES —
 * NOT C2, no real-Host dimension is claimed):
 *  L1 CAPTURE LAW: a row exists only over the tool's captured native face.
 *     No capture (or a foreign object answering the name) ⇒ honest INACTIVE
 *     row (mountCondition declared_mount, active:false): every classify/
 *     invoke refuses typed with the VERBATIM blocker, zero port entry, zero
 *     substitution — never a fake-closed fake, never a placeholder answer.
 *  L2 VERBATIM FACE: row.description / row.parametersSchema / row.
 *     outputSchema ARE the captured bytes (same values, frozen); the schema
 *     validation the row runs reads the CAPTURED compiled schema — this file
 *     holds no re-authored copy of any host schema.
 *  L3 REAL-SERVICE DELEGATION: each dispatch is the exact GoalService call
 *     the host body performs — same method, same arity, arguments handed by
 *     reference (the Agent object rides verbatim; the real port does its own
 *     live-agent assertion goal/src/index.ts:469-473). The recorded tuple
 *     (method, [agent, request|ref|reason]) is what a signature audit reads.
 *  L4 TOOL-PARAMETER LAW MIRROR (publicly declared, observable at this
 *     seam, each rule line-cited above): goalRef law; hasText/hasRoundCap
 *     fillers; the per-action mutual exclusions; the required-ness law; the
 *     create-side NO-filter asymmetry; the resume-paused mirror (it reads
 *     the CURRENT goal THROUGH the port — the same read the host body does
 *     at :278). Nothing beyond this is re-implemented.
 *  L5 NON-REIMPLEMENTATION BOUNDARY: objective trim/validity, round-cap
 *     validation and the defaultMaxGoalRounds=256 resolution stay SERVICE
 *     facts (:199-220); revision CAS stays SERVICE law (:456-466
 *     GOAL_STALE_REVISION) and each phase-transition check is inline per
 *     mutation (:334 edit, :353 pause, :368-379 resume, :392-398 complete,
 *     :413-415 block) — service throws propagate verbatim, the
 *     row never swallows, re-labels, or pre-answers them.
 *  L6 AUTHORITY + WRAP-UP ARE NOT THIS PORT'S FACTS: requireDirectHuman /
 *     completionAuthority (authority.ts:80-118) read the SESSION EVENT LOG
 *     and the live agent graph; the goal-round wrap-up rides
 *     exec.deferContext — none of it is observable or mountable through the
 *     GoalService port. A row therefore carries these as NAMED GAPS, verba-
 *     tim, on every plan; when the assembly injects `readExecutionFacts`
 *     the row ADDITIONALLY enforces the direct-human requirement and the
 *     blocked threshold before port entry; without the reader the row
 *     reports the dimension UNOBSERVED — it never claims it checked.
 *  L7 PER-DISPATCH IDENTITY RE-VERIFY (captured-native-delegate row law):
 *     before ANY port entry the row re-answers readNative(name) and
 *     compares OBJECT IDENTITY, description/parameters bytes, the frozen
 *     port method function objects, and the live port object; ANY drift ⇒
 *     typed refusal with zero port entry. The port's own methods are frozen
 *     at bind and rebound-method drift is refused (double-wrap refused).
 *  L8 PLAN ONCE, RUN THE PLAN: classify freezes {args snapshot, operation,
 *     portMethod, serviceCall, parametersFingerprint}; invoke re-derives
 *     classify, requires the fresh plan's fingerprint to equal the supplied
 *     plan's, then runs the FRESH plan — a plan from another row, another
 *     generation, or stale facts never dispatches.
 *  L9 DRAIN = NEW-CALL PROHIBITION. GoalService mutations are synchronous
 *     session appends (:609-626); there is no cancellable resource behind
 *     this adapter, drain settles nothing, and a mutation whose append
 *     committed is durable regardless of the row's later state.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g5-goal-service
 */
import { createHash } from 'node:crypto'

// THE WRAP-UP'S TWO PUBLIC PIECES (root 02:51 ③): the native body builds its
// goal-round wrap-up from exactly these public exports
// (tool-goal/src/index.ts:11 `import { boundContextSummary, createUserMessage,
// HarnessError } from '@deepseek-ai/dsh-llm'` @639ed01539). The row mirrors
// the SAME construction — never a parallel renderer, never a private import.
import { boundContextSummary, createUserMessage } from '@deepseek-ai/dsh-llm'

/** Census family (M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX records 27/28/29). */
export const A5_G5_FAMILY_ID = 'B-SESSION'
export const A5_G5_ADAPTER_REVISION = 1

/** The three tools, census recordIndexes, and the closed operation set. */
export const A5_G5_GOAL_RECORDS = Object.freeze({
  get_goal: Object.freeze({ recordIndex: 28, family: 'B-SESSION', operation: 'goal-read' }),
  create_goal: Object.freeze({ recordIndex: 27, family: 'B-SESSION', operation: 'goal-create' }),
  update_goal: Object.freeze({ recordIndex: 29, family: 'B-SESSION', operation: 'goal-action-dispatch' }),
})
export const A5_G5_GOAL_TOOL_NAMES = Object.freeze(['get_goal', 'create_goal', 'update_goal'])

/**
 * THE PORT LAW — mirrors the REAL GoalService methods the three host bodies
 * call (goal/src/index.ts line per entry; names/arity/return pinned by the
 * spec's source-text audit, never inferred). The port OBJECT is injected by
 * the owning assembly (production: the live `ctx.goals`); this module holds
 * no implementation of any of it.
 */
export const A5_G5_GOAL_SERVICE_METHODS = Object.freeze({
  get: Object.freeze({ arity: 1, signature: 'get(agent): GoalView | undefined', source: 'goal/src/index.ts:277' }),
  create: Object.freeze({ arity: 2, signature: 'create(agent, request: CreateGoalRequest): GoalView', source: 'goal/src/index.ts:303' }),
  edit: Object.freeze({ arity: 3, signature: 'edit(agent, ref: GoalRef, request: EditGoalRequest): GoalView', source: 'goal/src/index.ts:329' }),
  pause: Object.freeze({ arity: 2, signature: 'pause(agent, ref: GoalRef): GoalView', source: 'goal/src/index.ts:352' }),
  resume: Object.freeze({ arity: 2, signature: 'resume(agent, ref: GoalRef): GoalView', source: 'goal/src/index.ts:364' }),
  complete: Object.freeze({ arity: 2, signature: 'complete(agent, ref: GoalRef): GoalView', source: 'goal/src/index.ts:391' }),
  block: Object.freeze({ arity: 3, signature: 'block(agent, ref: GoalRef, reason: GoalBlockReason): GoalView', source: 'goal/src/index.ts:409' }),
})

/** Per-tool closed dispatch sets over the port (no shared dispatch table). */
const PORT_METHODS_BY_TOOL = Object.freeze({
  get_goal: Object.freeze(['get']),
  create_goal: Object.freeze(['create']),
  update_goal: Object.freeze(['get', 'edit', 'pause', 'resume', 'complete', 'block']),
})

/** The actions update_goal's captured enum declares (tool-goal :49,:243). */
const UPDATE_ACTIONS = Object.freeze(['edit', 'pause', 'resume', 'complete', 'blocked'])

/** Typed refusal codes owned by this module. */
export const A5_G5_GOAL_CODES = Object.freeze({
  DECLARED_MOUNT_ABSENT: 'P_G5_GOAL_DECLARED_MOUNT_ABSENT',
  CAPTURE_DRIFT: 'P_G5_GOAL_CAPTURE_DRIFT',
  PORT_ABSENT: 'P_G5_GOAL_PORT_ABSENT',
  PORT_METHOD_ABSENT: 'P_G5_GOAL_PORT_METHOD_ABSENT',
  PORT_METHOD_DRIFT: 'P_G5_GOAL_PORT_METHOD_DRIFT',
  DRAINING: 'P_G5_GOAL_DRAINING',
  AGENT_REQUIRED: 'P_G5_GOAL_AGENT_REQUIRED',
  INVALID_ARGUMENTS: 'P_G5_GOAL_INVALID_ARGUMENTS',
  UNKNOWN_PARAMETER: 'P_G5_GOAL_UNKNOWN_PARAMETER',
  MISSING_PARAMETER: 'P_G5_GOAL_MISSING_PARAMETER',
  UNKNOWN_ACTION: 'P_G5_GOAL_UNKNOWN_ACTION',
  GOAL_REF_INVALID: 'P_G5_GOAL_REF_INVALID',
  PARAM_LAW: 'P_G5_GOAL_PARAM_LAW',
  RESUME_PAUSED: 'P_G5_GOAL_RESUME_PAUSED',
  BLOCK_THRESHOLD: 'P_G5_GOAL_BLOCK_THRESHOLD',
  DIRECT_HUMAN_REQUIRED: 'P_G5_GOAL_DIRECT_HUMAN_REQUIRED',
  COMPLETION_AUTHORITY_REQUIRED: 'P_G5_GOAL_COMPLETION_AUTHORITY_REQUIRED',
  NOT_OWN_PLAN: 'P_G5_GOAL_NOT_OWN_PLAN',
})
const CODES = A5_G5_GOAL_CODES

/**
 * The dimensions this adapter can NEVER serve through the GoalService port —
 * carried verbatim on every plan instead of being faked closed (card law).
 */
export const A5_G5_GOAL_NAMED_GAPS = Object.freeze({
  AUTHORITY: 'AUTHORITY UNOBSERVED at this seam: requireDirectHuman and completionAuthority read the SESSION EVENT LOG and the live agent graph (tool-goal/src/authority.ts:80-118 @639ed01539) — the GoalService port carries no such fact; the row never claims it checked, and an assembly that can read the execution facts injects readExecutionFacts so the row enforces them before port entry',
  WRAPUP: 'GOAL-ROUND WRAP-UP UNMOUNTABLE at this seam: the host body defers the wrap-up context via exec.deferContext(createUserMessage(renderWrapupContext(...))) (tool-goal/src/index.ts:319-330, wrapup.ts:17-41 @639ed01539) — there is no GoalService method for it, so the port lane never serves it and never pretends it did',
  AGENT_AUTH: 'CALLING-AGENT AUTHENTICATION stays native/port-side: goalToolExecution requires the exact live calling agent inside its active driver with an open model turn (tool-goal/src/authority.ts:33-59) and GoalService.assertLive refuses a non-live agent (goal/src/index.ts:469-473); the row hands the Agent object by reference and mirrors only the observable agent-presence law (GOAL_TOOL_AGENT_REQUIRED :49-52)',
})

const DRAIN_SEMANTICS = 'drain = NEW-CALL PROHIBITION: GoalService mutations are synchronous session appends (goal/src/index.ts:609-626 @639ed01539); this adapter owns no cancellable resource, drain settles nothing, and a committed append stays durable regardless of the row state — never a fake rollback'

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

/** Tool filler law (tool-goal/src/index.ts:134-142): strict-schema fillers
 *  ('' and 0) are ABSENT, exactly as the host body reads them. */
const hasText = (value) => value !== undefined && value !== ''
const hasRoundCap = (value) => value !== undefined && value !== 0

/** goalRef law, mirrored from tool-goal/src/index.ts:145-154 verbatim rule
 *  (non-empty trim-stable id + positive safe-integer revision). */
function goalRefOf(goalId, revision) {
  if (typeof goalId !== 'string' || goalId.length === 0 || goalId !== goalId.trim()
    || !Number.isSafeInteger(revision) || revision < 1) {
    return null
  }
  return { id: goalId, revision }
}

/**
 * The canonical result projection, byte-for-byte the host tool's `goalValue`
 * (tool-goal/src/index.ts:157-173): GoalView → GoalToolValue. createdAt/
 * updatedAt are NOT copied; blockedReason is present only when defined;
 * activation rides beside the goal, and undefined goal → { goal: null }.
 * @param {object | undefined} goal
 */
export function goalValue(goal) {
  if (goal === undefined) return { goal: null }
  return {
    goal: {
      id: goal.id,
      revision: goal.revision,
      objective: goal.objective,
      phase: goal.phase,
      roundsStarted: goal.roundsStarted,
      maxGoalRounds: goal.maxGoalRounds,
      ...(goal.blockedReason === undefined ? {} : {
        blockedReason: { code: goal.blockedReason.code, message: goal.blockedReason.message },
      }),
    },
    activation: goal.activation,
  }
}

/**
 * Minimal enforcement of ONE tool's CAPTURED compiled parameter schema
 * (root: object; declared keys only — the lane face is CLOSED; required
 * members present; string/number/enum leaf checks). This reads the
 * captured bytes, so it tracks whatever the live registration declares.
 */
function checkCapturedParams(schema, args, toolName) {
  if (!isRecord(args)) {
    return refuse(CODES.INVALID_ARGUMENTS, `${toolName}: model arguments must be one JSON object; nothing is consulted`)
  }
  const properties = isRecord(schema?.properties) ? schema.properties : {}
  for (const key of Object.keys(args)) {
    if (!Object.hasOwn(properties, key)) {
      return refuse(CODES.UNKNOWN_PARAMETER, `${toolName}: '${key}' is not a declared parameter of the captured ${toolName} face; the lane face is closed`)
    }
  }
  const required = Array.isArray(schema?.required) ? schema.required : []
  for (const key of required) {
    if (args[key] === undefined) {
      return refuse(CODES.MISSING_PARAMETER, `${toolName}: required parameter '${key}' is absent (captured schema required[])`)
    }
  }
  for (const [key, node] of Object.entries(properties)) {
    const value = args[key]
    if (value === undefined) continue
    const type = isRecord(node) ? node.type : undefined
    if (type === 'string' && typeof value !== 'string') {
      return refuse(CODES.INVALID_ARGUMENTS, `${toolName}: '${key}' must be a string per the captured schema`)
    }
    if (type === 'number' && typeof value !== 'number') {
      return refuse(CODES.INVALID_ARGUMENTS, `${toolName}: '${key}' must be a number per the captured schema`)
    }
    if (Array.isArray(node?.enum) && !node.enum.includes(value)) {
      return refuse(CODES.UNKNOWN_ACTION, `${toolName}: '${key}' ${JSON.stringify(value)} is outside the captured enum [${node.enum.map((v) => JSON.stringify(v)).join(', ')}]`)
    }
  }
  return null
}

/** Assembly-time defect: a config defect throws, it never silently defaults. */
function assemblyDefect(detail) {
  return new TypeError(`g5-goal-service: ${detail}`)
}

/** Validate one captured native definition; returns a problem string or null. */
function captureProblem(name, def) {
  if (def === undefined || def === null) return `the captured native face "${name}" is absent`
  if (typeof def.name !== 'string' || def.name !== name) return `the face behind readNative("${name}") answers name ${JSON.stringify(def?.name ?? null)} — a foreign object cannot mount under this record`
  if (typeof def.description !== 'string') return `the captured "${name}" face carries no description string`
  if (!isRecord(def.parameters)) return `the captured "${name}" face carries no compiled parameters object`
  if (!isRecord(def.output) || !isRecord(def.output.schema)) return `the captured "${name}" face carries no output schema`
  return null
}

/** Honest INACTIVE row (L1/declared_mount): the record exists for the
 *  center's census, every call refuses typed with the VERBATIM blocker. */
function inactiveG5Row({ toolName, realmId, providerId, blocker, mountState }) {
  const record = A5_G5_GOAL_RECORDS[toolName]
  const say = () => refuse(CODES.DECLARED_MOUNT_ABSENT, `${toolName}: ${blocker}`)
  return Object.freeze({
    familyId: A5_G5_FAMILY_ID,
    adapterRevision: A5_G5_ADAPTER_REVISION,
    recordIndex: record.recordIndex,
    toolName,
    operation: record.operation,
    mountCondition: 'declared_mount',
    mountState,
    realmId,
    providerId,
    active: false,
    captured: () => false,
    description: null,
    parametersSchema: null,
    outputSchema: null,
    portMethods: Object.freeze([...PORT_METHODS_BY_TOOL[toolName]]),
    namedGaps: A5_G5_GOAL_NAMED_GAPS,
    blocker,
    classify: async () => say(),
    invoke: async () => say(),
    runPlan: async () => say(),
    drainSemantics: DRAIN_SEMANTICS,
    drain: () => {},
    draining: () => false,
  })
}

/**
 * The per-tool mapping closures — each row's OWN dispatch law (L3/L4), each
 * branch line-cited to the host body. The closure returns the ordered port
 * CALL LIST it wants executed: [{ method, build(ctx) → callArgs }] where
 * ctx carries { agent, ref, args, port }.
 */
const DISPATCH_BY_TOOL = {
  get_goal() {
    return [
      { method: 'get', source: 'tool-goal/src/index.ts:202 ctx.goals.get(execution.agent)', build: ({ agent }) => [agent] },
    ]
  },
  create_goal({ args }) {
    // Objective VALIDITY (trim/non-empty) and round-cap validity are SERVICE
    // facts (goal/src/index.ts:199-212 GOAL_INVALID_OBJECTIVE / GOAL_INVALID_
    // MAX_ROUNDS) — the host body passes the arguments through unvalidated
    // (tool-goal/src/index.ts:225-228) and the row keeps that boundary.
    // The create-side also passes max_goal_rounds THROUGH whenever it is
    // present (index.ts:227: undefined-check, NOT the hasRoundCap filler
    // law) — a 0 cap reaches the service. The asymmetry vs update is REAL.
    const request = {
      objective: args.objective,
      ...(args.max_goal_rounds === undefined ? {} : { maxGoalRounds: args.max_goal_rounds }),
    }
    return [
      { method: 'create', source: 'tool-goal/src/index.ts:225-228 ctx.goals.create(agent, {objective, maxGoalRounds?})', build: ({ agent }) => [agent, request] },
    ]
  },
  update_goal({ args, ref, toolName, currentView }) {
    const action = args.action
    if (!UPDATE_ACTIONS.includes(action)) {
      return { refusal: refuse(CODES.UNKNOWN_ACTION, `${toolName}: action ${JSON.stringify(action)} is outside the captured enum [${UPDATE_ACTIONS.map((a) => JSON.stringify(a)).join(', ')}] (tool-goal/src/index.ts:49,:243)`) }
    }
    const replacements = {
      ...(hasText(args.objective) ? { objective: args.objective } : {}),
      ...(hasRoundCap(args.max_goal_rounds) ? { maxGoalRounds: args.max_goal_rounds } : {}),
    }
    if (action === 'edit') {
      if (hasText(args.blocked_reason)) {
        return { refusal: refuse(CODES.PARAM_LAW, `${toolName}: blocked_reason is valid only with action blocked (tool-goal/src/index.ts:264-266 GOAL_TOOL_INVALID_UPDATE law)`) }
      }
      // objective/max_goal_rounds BOTH absent (or filler) → replacements {}
      // rides to the service, which owns the GOAL_INVALID_EDIT refusal
      // (goal/src/index.ts:333-335). The row never pre-refuses what the
      // service already refuses with its own code.
      return [
        { method: 'edit', source: 'tool-goal/src/index.ts:267 ctx.goals.edit(agent, ref, replacements)', build: ({ agent }) => [agent, ref, replacements] },
      ]
    }
    if (action === 'pause' || action === 'resume') {
      if (hasText(args.objective) || hasRoundCap(args.max_goal_rounds) || hasText(args.blocked_reason)) {
        return { refusal: refuse(CODES.PARAM_LAW, `${toolName}: objective and max_goal_rounds are valid only with action edit; blocked_reason is valid only with action blocked (tool-goal/src/index.ts:272-277 GOAL_TOOL_INVALID_UPDATE law)`) }
      }
      if (action === 'resume') {
        // The model may NOT resume a paused goal — the host reads the CURRENT
        // goal through the service (:278) and refuses the EXACT-match paused
        // resume (:279-285). currentView is that same port.get read.
        if (currentView !== undefined && currentView.id === ref.id && currentView.revision === ref.revision
          && currentView.phase === 'paused') {
          return { refusal: refuse(CODES.RESUME_PAUSED, `${toolName}: the model cannot resume a paused goal; the user must resume it (tool-goal/src/index.ts:279-285 GOAL_TOOL_RESUME_PAUSED law)`) }
        }
        return [
          { method: 'resume', source: 'tool-goal/src/index.ts:288 ctx.goals.resume(agent, ref)', build: ({ agent }) => [agent, ref] },
        ]
      }
      return [
        { method: 'pause', source: 'tool-goal/src/index.ts:287 ctx.goals.pause(agent, ref)', build: ({ agent }) => [agent, ref] },
      ]
    }
    // complete / blocked
    if (hasText(args.objective) || hasRoundCap(args.max_goal_rounds)) {
      return { refusal: refuse(CODES.PARAM_LAW, `${toolName}: objective and max_goal_rounds are valid only with action edit (tool-goal/src/index.ts:292-296 GOAL_TOOL_INVALID_UPDATE law)`) }
    }
    if (action === 'complete' && hasText(args.blocked_reason)) {
      return { refusal: refuse(CODES.PARAM_LAW, `${toolName}: blocked_reason is valid only with action blocked (tool-goal/src/index.ts:298-300 GOAL_TOOL_INVALID_UPDATE law)`) }
    }
    if (action === 'blocked' && (args.blocked_reason === undefined || String(args.blocked_reason).trim().length === 0)) {
      return { refusal: refuse(CODES.PARAM_LAW, `${toolName}: blocked_reason is required with action blocked (tool-goal/src/index.ts:301-304 GOAL_TOOL_INVALID_UPDATE law)`) }
    }
    if (action === 'complete') {
      return [
        { method: 'complete', source: 'tool-goal/src/index.ts:314 ctx.goals.complete(agent, ref)', build: ({ agent }) => [agent, ref] },
      ]
    }
    return [
      { method: 'block', source: "tool-goal/src/index.ts:315-318 ctx.goals.block(agent, ref, {code:'model-reported', message})", build: ({ agent }) => [agent, ref, { code: 'model-reported', message: args.blocked_reason }] },
    ]
  },
}

/**
 * The ARGUMENT-ONLY half of the captured tool's own law: run the tool's
 * mapping statically (no current-goal view ⇒ the current-goal rules stay
 * at the dispatch edge). A refusal is the captured tool's OWN refusal
 * message; null means the arguments are admissible at plan time.
 * @param {string} toolName
 * @param {Record<string, unknown>} args
 */
function staticParameterLaw(toolName, args) {
  const out = toolName === 'update_goal'
    ? DISPATCH_BY_TOOL.update_goal({ args, ref: goalRefOf(args.goal_id, args.revision), toolName, currentView: undefined })
    : DISPATCH_BY_TOOL[toolName]({ args, toolName })
  if (Array.isArray(out)) return null
  return out.refusal ?? out
}

/**
 * Placement-time factory: build the three governed rows for the host goal
 * tools over (a) the CAPTURED native faces (read via the injected capture
 * seam — production `name => ctx.tools.get(name, scope)`) and (b) the
 * injected GOAL-SERVICE PORT whose object is the live `ctx.goals` (or a
 * signature-identical stand-in in legs). Rows delegate per the L3/L4 table
 * above; nothing here boots a Host, opens a socket, or touches :3080.
 *
 * @param deps {{
 *   realmId: string,
 *   providerId: string,
 *   readNative: (name: string) => object | undefined,   // capture seam
 *   goals: object,   // the GoalService-shaped port: the seven methods of
 *                    // A5_G5_GOAL_SERVICE_METHODS (extra methods may ride)
 *   blockedAfterConsecutiveRounds?: number,   // host tool Config VALUE — trusted ONLY when supplied; absent = the goal-round blocked arm alone closes (root 05:5x; NEVER defaulted here)
 *   readExecutionFacts?: () => { kind: 'direct-human' } | { kind: 'goal-round' },
 *   observe?: (event) => void
 * }}
 * @returns {{ get_goal: object, create_goal: object, update_goal: object,
 *   adapterLaw: object }} the three rows keyed by tool name + the shared law.
 */
/**
 * MIRROR of the host's `renderWrapupContext` (tool-goal/src/wrapup.ts:17-41
 * @639ed01539) — the model-visible closing instruction a goal-round terminal
 * update defers. Byte-identical BY DESIGN: the service spec pins every long
 * sentence against the pristine 639 source, so a host edit that moves this
 * text fails the pin (and the next host bump must re-copy it verbatim, same
 * law as the census bytes). The renderer is the host's TEXT; the deferral is
 * the exec's OWN public face (ToolRunContext.deferContext, api-catalog) —
 * this row adds no authority, no ledger, no second system.
 * @param {string} objective - the terminal goal's objective, echoed for grounding.
 * @param {string} [blockedReason] - the validated report for 'blocked'; omitted for 'complete'.
 * @returns {Array<{type: 'text', text: string}>} one fresh context block.
 */
const G5_WRAPUP_GROUNDING = 'Report only what earlier rounds and tool results in this session actually establish; '
  + 'when a detail is not in the session, say so instead of inventing it. '
function renderG5WrapupContext(objective, blockedReason) {
  const heading = `Objective: ${JSON.stringify(objective)}\n`
  const text = blockedReason === undefined
    ? '<goal_complete>\n'
      + heading
      + 'The goal is marked complete and this autonomous run is ending. Write the closing '
      + 'message to the user now: state the outcome, summarize what was done and how it was '
      + 'verified, and point to the concrete results (files, commits, or other artifacts). '
      + G5_WRAPUP_GROUNDING
      + 'Note anything the user should review or do next. Address the user directly. Do not '
      + "call any more tools in this run; further work waits for the user's next instruction.\n"
      + '</goal_complete>'
    : '<goal_blocked>\n'
      + heading
      + `Blocked: ${JSON.stringify(blockedReason)}\n`
      + 'The goal is marked blocked and this autonomous run is ending. Write the closing '
      + 'message to the user now: state what has been completed so far, describe the concrete '
      + 'blocking condition and what you tried, and say exactly what you need from the user to '
      + 'continue. '
      + G5_WRAPUP_GROUNDING
      + 'Address the user directly. Do not call any more tools in this run; further work '
      + "waits for the user's next instruction.\n"
      + '</goal_blocked>'
  return [{ type: 'text', text }]
}

export function createG5GoalServiceAdapter({
  realmId,
  providerId,
  readNative,
  goals,
  blockedAfterConsecutiveRounds,
  readExecutionFacts,
  observe = () => {},
} = {}) {
  if (typeof realmId !== 'string' || realmId.length === 0) throw assemblyDefect('realmId is required (the effects answer in a realm)')
  if (typeof providerId !== 'string' || providerId.length === 0) throw assemblyDefect('providerId is required (the placing assembly identifies itself)')
  if (typeof readNative !== 'function') throw assemblyDefect('readNative is required — the tools.get(name, scope) capture seam; a row that cannot capture mounts INACTIVE (declared_mount), it never invents a body')
  if (!isRecord(goals)) throw assemblyDefect('goals is required — the injected GoalService-shaped port (production: the live ctx.goals); this adapter holds no goal implementation')
  const thresholdTrusted = blockedAfterConsecutiveRounds !== undefined
  if (thresholdTrusted && (!Number.isSafeInteger(blockedAfterConsecutiveRounds) || blockedAfterConsecutiveRounds < 1)) {
    // Verbatim mirror of the host tool's config law (tool-goal/src/index.ts:126-132).
    throw assemblyDefect('blockedAfterConsecutiveRounds must be a positive safe integer')
  }
  if (readExecutionFacts !== undefined && typeof readExecutionFacts !== 'function') {
    throw assemblyDefect('readExecutionFacts, when supplied, must be a function answering {kind:\'direct-human\'} | {kind:\'goal-round\'} — the execution authority the host derives in authority.ts:111-118; without it the row reports the dimension UNOBSERVED, it never claims it checked')
  }

  /** The port method FUNCTION OBJECTS frozen at bind (L7): drift = refused. */
  const frozenPortMethods = {}
  for (const method of Object.keys(A5_G5_GOAL_SERVICE_METHODS)) {
    if (typeof goals[method] === 'function') frozenPortMethods[method] = goals[method]
  }

  const rows = {}
  const stats = { dispatches: 0, refuses: 0, driftRejects: 0 }
  let draining = false

  const callExecutionFacts = () => {
    if (typeof readExecutionFacts !== 'function') return deepFreeze({ observed: false, reason: A5_G5_GOAL_NAMED_GAPS.AUTHORITY })
    let facts
    try {
      facts = readExecutionFacts()
    } catch {
      return deepFreeze({ observed: false, reason: `readExecutionFacts threw — the execution authority cannot be read for this dispatch (${A5_G5_GOAL_NAMED_GAPS.AUTHORITY})` })
    }
    if (facts?.kind !== 'direct-human' && facts?.kind !== 'goal-round') {
      return deepFreeze({ observed: false, reason: `readExecutionFacts answered no closed kind (${JSON.stringify(facts?.kind ?? null)}); unobserved is NOT a pass` })
    }
    return deepFreeze({ observed: true, kind: facts.kind })
  }

  const runPortCalls = (calls, ctx) => {
    const results = []
    for (const call of calls) {
      const callArgs = call.build(ctx)
      const method = goals[call.method]
      observe({ event: 'port-call', toolName: ctx.toolName, method, source: call.source })
      // Synchronous GoalService methods; any service throw propagates
      // VERBATIM (L5) — never swallowed, re-labelled, or answered twice.
      results.push(method.apply(goals, callArgs))
    }
    return results
  }

  const buildActiveRow = (toolName, def) => {
    const record = A5_G5_GOAL_RECORDS[toolName]
    const descriptionBytes = def.description
    const parametersSchema = deepFreeze(def.parameters)
    const outputSchema = deepFreeze(def.output.schema)
    const portMethods = PORT_METHODS_BY_TOOL[toolName]
    const captureIdentity = `sha256:${sha256(canonicalJson({ name: def.name, description: descriptionBytes, parameters: parametersSchema }))}`
    const bound = { name: def.name, def }

    const refuseWith = (code, detail) => {
      stats.refuses += 1
      observe({ event: 'refusal', toolName, code, detail })
      return refuse(code, detail)
    }

    /** L7 per-dispatch identity re-verify. Returns a problem or null. */
    const identityProblem = () => {
      let live
      try {
        live = readNative(toolName)
      } catch {
        return 'the capture seam threw on re-read — the captured native face cannot be re-verified for this dispatch'
      }
      if (live !== bound.def) return 'the face behind readNative is no longer the captured object — the governed call refuses; there is no replacement-body path and no native fallback'
      if (live.description !== descriptionBytes) return "the captured definition's description bytes moved since bind time"
      if (canonicalJson(live.parameters) !== canonicalJson(parametersSchema)) return "the captured definition's compiled parameter schema moved since bind time"
      for (const method of portMethods) {
        const now = goals[method]
        if (typeof now !== 'function') return `the port method "${method}" (${A5_G5_GOAL_SERVICE_METHODS[method]?.source ?? 'unknown source'}) is no longer a function`
        if (now !== frozenPortMethods[method]) return `the port method "${method}" was rebound underneath the frozen bind — a rebound service method is drift, full stop`
      }
      return null
    }

    /** L4/plan-time tool-parameter law + the frozen plan (L8). */
    const classify = async (rawArgs) => {
      if (draining) return refuseWith(CODES.DRAINING, `${toolName}: the adapter is draining — new calls are refused; committed appends stay durable (${DRAIN_SEMANTICS})`)
      const args = rawArgs === undefined || rawArgs === null ? {} : rawArgs
      const schemaProblem = checkCapturedParams(parametersSchema, args, toolName)
      if (schemaProblem !== null) return schemaProblem
      if (toolName === 'update_goal') {
        const ref = goalRefOf(args.goal_id, args.revision)
        if (ref === null) {
          // Verbatim host refusal (tool-goal/src/index.ts:148-151).
          return refuseWith(CODES.GOAL_REF_INVALID, `${toolName}: goal_id must be non-empty and revision must be a positive safe integer (GOAL_TOOL_INVALID_UPDATE law, tool-goal/src/index.ts:145-154)`)
        }
      }
      // L4 at PLAN time: the argument-only half of the captured tool's own
      // law runs at classify (the host body runs it at the top of execute),
      // so no plan ever carries arguments the pinned tool itself refuses.
      // Current-goal rules (resume-paused, blocked threshold) stay at the
      // dispatch edge because the host reads those through the service too.
      const lawRefusal = staticParameterLaw(toolName, args)
      if (lawRefusal !== null) return refuseWith(lawRefusal.code, lawRefusal.detail)
      const actualArgs = deepFreeze(JSON.parse(JSON.stringify(args)))
      const executionFacts = callExecutionFacts()
      const parametersFingerprint = `sha256:${sha256(canonicalJson({ toolName, adapterRevision: A5_G5_ADAPTER_REVISION, realmId, providerId, actualArgs }))}`
      const correlation = `g5.${toolName}.r${A5_G5_ADAPTER_REVISION}.${stats.dispatches + 1}`
      return deepFreeze({
        ok: true,
        correlation,
        familyId: A5_G5_FAMILY_ID,
        adapterRevision: A5_G5_ADAPTER_REVISION,
        toolName,
        recordIndex: record.recordIndex,
        operation: record.operation,
        captureIdentity,
        parametersFingerprint,
        actualArgs,
        targetManifest: deepFreeze({
          toolName,
          operation: record.operation,
          portMethods: [...portMethods],
          executionAuthority: executionFacts,
          namedGaps: toolName === 'get_goal'
            ? Object.freeze({ authority: `${A5_G5_GOAL_NAMED_GAPS.AUTHORITY} (get_goal is the read arm — requireDirectHuman/completionAuthority do not gate it; the live-agent laws ride the port: authority.ts:49-59, goal/src/index.ts:469-473)` })
            : A5_G5_GOAL_NAMED_GAPS,
        }),
      })
    }

    /** L3 dispatch: the exact port call list for THIS plan. */
    const dispatchCalls = (plan, ctx) => {
      const mapper = DISPATCH_BY_TOOL[toolName]
      const ref = toolName === 'update_goal' ? goalRefOf(plan.actualArgs.goal_id, plan.actualArgs.revision) : undefined
      if (toolName === 'update_goal' && ref === null) {
        return { refusal: refuseWith(CODES.GOAL_REF_INVALID, `${toolName}: goal_id must be non-empty and revision must be a positive safe integer (GOAL_TOOL_INVALID_UPDATE law, tool-goal/src/index.ts:145-154)`) }
      }
      const action = plan.actualArgs.action
      // Authority edges the host enforces BEFORE the service call. With the
      // reader mounted the row mirrors them; without it the dimension is
      // carried UNOBSERVED (L6) — never claimed, never faked.
      // P1 SAFE CORRECTION (center, 2026-10-24, root-confirmed mechanism):
      // an UNOBSERVED authority dimension NEVER opens a MUTATION arm. Host
      // tool-goal enforces requireDirectHuman/completionAuthority BEFORE the
      // service (@639ed01539 index.ts:224,:263,:271,:291 → authority.ts:100-118)
      // and the service's exact-agent/CAS checks supply NO authority; a row
      // without a trusted per-call reader therefore REFUSES the authority-
      // gated write instead of passing it through unmirrored (the pass-through
      // was the bypass: PA approve -> direct port call the host would refuse).
      // Scoped to the authority-gated arms (get_goal and the read arms are
      // unchanged); no new vocabulary (existing codes + the named AUTHORITY
      // gap wording); the OBSERVED enforcement paths below stay byte-identical.
      // Final shape = the owner's trusted readExecutionFacts supply (8722);
      // this block then closes the refusal BY OBSERVATION, not by absence.
      if (toolName === 'create_goal') {
        if (plan.targetManifest.executionAuthority.observed !== true) {
          return { refusal: refuseWith(CODES.DIRECT_HUMAN_REQUIRED, `${toolName}: ${A5_G5_GOAL_NAMED_GAPS.AUTHORITY}; the host requires a direct human turn before create (tool-goal/src/index.ts:224 → authority.ts:100-103) and UNOBSERVED is not a pass — the write arm stays closed until a trusted per-call reader observes it; zero port entry`) }
        }
        if (plan.targetManifest.executionAuthority.kind !== 'direct-human') {
          return { refusal: refuseWith(CODES.DIRECT_HUMAN_REQUIRED, `${toolName}: this goal operation requires a direct human turn on a top-level agent (tool-goal/src/index.ts:224 → authority.ts:100-103); the mounted execution-facts reader says kind ${JSON.stringify(plan.targetManifest.executionAuthority.kind)} — zero port entry`) }
        }
      }
      if (toolName === 'update_goal') {
        const needsDirect = action === 'edit' || action === 'pause' || action === 'resume'
        const isCompletion = action === 'complete' || action === 'blocked'
        if ((needsDirect || isCompletion) && plan.targetManifest.executionAuthority.observed !== true) {
          return { refusal: refuseWith(needsDirect ? CODES.DIRECT_HUMAN_REQUIRED : CODES.COMPLETION_AUTHORITY_REQUIRED, `${toolName}: action ${JSON.stringify(action)} is authority-gated at the host (tool-goal/src/index.ts:263,:271${isCompletion ? ',:291' : ''} → authority.ts:100-118) and ${A5_G5_GOAL_NAMED_GAPS.AUTHORITY}; UNOBSERVED is not a pass — zero port entry`) }
        }
        if (needsDirect && plan.targetManifest.executionAuthority.kind !== 'direct-human') {
          return { refusal: refuseWith(CODES.DIRECT_HUMAN_REQUIRED, `${toolName}: action ${JSON.stringify(action)} requires a direct human turn (tool-goal/src/index.ts:263,:271 → authority.ts:100-103) — zero port entry`) }
        }
        if (isCompletion && plan.targetManifest.executionAuthority.kind !== 'direct-human' && plan.targetManifest.executionAuthority.kind !== 'goal-round') {
          return { refusal: refuseWith(CODES.COMPLETION_AUTHORITY_REQUIRED, `${toolName}: complete and blocked require a direct human turn or the current goal round (tool-goal/src/index.ts:291 → authority.ts:111-118) — zero port entry`) }
        }
      }
      const planList = mapper(toolName === 'update_goal'
        ? { args: plan.actualArgs, ref, toolName, currentView: undefined }
        : { args: plan.actualArgs, toolName })
      if (Array.isArray(planList) === false) return planList // { refusal }

      // The resume-paused mirror reads the CURRENT goal THROUGH the port
      // first — the same read the host body performs (:278); host order is
      // exclusions → get → paused-check → resume, so the read happens HERE,
      // once, and rides the dispatch record as executedPrefix. A throwing
      // service read propagates verbatim (L5).
      if (toolName === 'update_goal' && action === 'resume') {
        const getCall = { method: 'get', source: 'tool-goal/src/index.ts:278 const current = ctx.goals.get(execution.agent)' }
        const current = goals.get(ctx.agent)
        const afterResume = mapper({ args: plan.actualArgs, ref, toolName, currentView: current })
        if (Array.isArray(afterResume) === false) return { refusal: afterResume.refusal, executedPrefix: [getCall] }
        return { list: afterResume, executedPrefix: [getCall] }
      }
      // The blocked threshold (tool-goal:305-312) is enforceable ONLY where
      // the goal-round fact is readable. completionAuthority reads the
      // CURRENT goal through the service on the goal-round path
      // (authority.ts:113 ctx.goals.get(execution.agent)) — the row mirrors
      // that same port.get before complete/blocked under goal-round
      // authority, and takes roundsStarted from THAT read.
      const goalRoundCompletion = (action === 'complete' || action === 'blocked')
        && plan.targetManifest.executionAuthority.observed === true
        && plan.targetManifest.executionAuthority.kind === 'goal-round'
      if (goalRoundCompletion) {
        const getCall = { method: 'get', source: 'tool-goal/src/authority.ts:113 ctx.goals.get(execution.agent) inside completionAuthority' }
        // P2 THRESHOLD TRUST (root 05:5x ruling; 639 tool-goal Config :32-40/:126-131):
        // the threshold is a HOST CONFIG VALUE (default 3 is the tool's own
        // fallback, NOT a fact this row may assume — a host configured 5
        // would see a too-early blocked under a guessed 3, a host configured
        // 1 an over-refusal). With NO trusted supply the goal-round BLOCKED
        // arm alone stays closed (this refusal; zero port entry); every other
        // arm — direct-human completions, goal-round completes, edit/pause/
        // resume under direct human, get_goal reads — keeps serving exactly
        // as repaired. Trusted supply (assembly passes the real config value)
        // runs the verbatim native check below.
        if (action === 'blocked' && !thresholdTrusted) {
          return { refusal: refuseWith(CODES.BLOCK_THRESHOLD, `${toolName}: the goal-round blocked floor is the tool's CONFIG VALUE (tool-goal/src/index.ts:305-312 reads the resolved Config, default 3 at :126-132 — a host value this assembly never read); the row NEVER defaults it, so the goal-round blocked arm stays closed until a trusted threshold rides the supply (or the check delegates to the native tool) — zero port entry; other arms unaffected`) }
        }
        const current = goals.get(ctx.agent)
        if (action === 'blocked' && current !== undefined && current.roundsStarted < blockedAfterConsecutiveRounds) {
          // Verbatim host message shape (tool-goal/src/index.ts:307-311).
          return { refusal: refuseWith(CODES.BLOCK_THRESHOLD, `${toolName}: blocked requires at least ${blockedAfterConsecutiveRounds} consecutive goal rounds; current round is ${current.roundsStarted} (GOAL_TOOL_BLOCK_THRESHOLD law, tool-goal/src/index.ts:305-312) — the MUTATION arm never enters the port (the authority read above is the host's own completionAuthority get)`), executedPrefix: [getCall] }
        }
        return { list: planList, executedPrefix: [getCall] }
      }
      return { list: planList }
    }

    const invoke = async (rawArgs, exec) => {
      const plan = await classify(rawArgs)
      if (plan.ok !== true) return plan
      return runPlan(plan, exec)
    }

    /** Run a plan THIS row classified (L8): plan-freshness, identity
     *  re-verify, agent presence, then the exact port calls. */
    const runPlan = async (plan, exec) => {
      if (draining) return refuseWith(CODES.DRAINING, `${toolName}: the adapter is draining — new port entries are refused (${DRAIN_SEMANTICS})`)
      if (!isRecord(plan) || plan.ok !== true || plan.toolName !== toolName
        || plan.adapterRevision !== A5_G5_ADAPTER_REVISION
        || plan.captureIdentity !== captureIdentity) {
        return refuseWith(CODES.NOT_OWN_PLAN, `${toolName}: the supplied plan is absent, a refusal, another row's, or from a different adapter generation — a plan is consumed by the row that classified it, once`)
      }
      const fresh = await classify(plan.actualArgs)
      if (fresh.ok !== true) return fresh
      if (fresh.parametersFingerprint !== plan.parametersFingerprint) {
        return refuseWith(CODES.NOT_OWN_PLAN, `${toolName}: a fresh classify of the SAME args now produces a DIFFERENT fingerprint than the supplied plan — the row state moved underneath the plan; zero port entry`)
      }
      const identity = identityProblem()
      if (identity !== null) {
        stats.driftRejects += 1
        observe({ event: 'drift-refusal', toolName, code: CODES.CAPTURE_DRIFT })
        return refuse(CODES.CAPTURE_DRIFT, `${toolName}: ${identity}; zero port entry`)
      }
      const agent = exec?.agent
      if (agent === undefined) {
        // Observable mirror of GOAL_TOOL_AGENT_REQUIRED (authority.ts:49-52):
        // the port methods all take the Agent object by reference.
        return refuseWith(CODES.AGENT_REQUIRED, `${toolName}: goal tools require a calling agent (tool-goal/src/authority.ts:49-52 GOAL_TOOL_AGENT_REQUIRED); the Agent object rides to the port by reference and the real service asserts its live identity (goal/src/index.ts:469-473) — zero port entry`)
      }
      const built = dispatchCalls(fresh, { agent, toolName })
      if (built.refusal !== undefined) return built.refusal
      const ctx = { agent, toolName }
      const results = runPortCalls(built.list, ctx)
      const finalView = results[results.length - 1]
      stats.dispatches += 1
      observe({ event: 'port-commit', toolName, correlation: fresh.correlation, detail: fresh.parametersFingerprint })
      // THE WRAP-UP MIRROR (root 02:51 ③; native tool-goal/src/index.ts:319-329
      // @639ed01539): a goal-round COMPLETE/BLOCKED that actually landed defers
      // the model-visible closing context through the DISPATCH'S OWN public
      // exec.deferContext — the host body's exact construction
      // (createUserMessage + renderWrapupContext mirror + the notice source
      // `{kind:'tool-goal', form:'notice', summary: boundContextSummary(...)}`).
      // This is context parity, NOT authority: the authority checks ran above
      // and the host re-checks on the port. Only an OBSERVED goal-round
      // completes here (direct-human closes need no wrap-up — the host's own
      // `authority.kind === 'goal-round'` condition); a dispatch whose exec
      // carries no deferContext face is OBSERVED, never faked (the WRAPUP
      // named gap stays TRUE of the port: no GoalService method serves it).
      if (toolName === 'update_goal'
        && fresh.targetManifest.executionAuthority.observed === true
        && fresh.targetManifest.executionAuthority.kind === 'goal-round') {
        const g5Action = fresh.actualArgs?.action
        if (g5Action === 'complete' || g5Action === 'blocked') {
          const g5Objective = String(finalView?.objective ?? '')
          if (typeof exec?.deferContext === 'function') {
            exec.deferContext(createUserMessage({
              content: renderG5WrapupContext(
                g5Objective,
                g5Action === 'blocked' ? String(fresh.actualArgs?.blocked_reason ?? '') : undefined,
              ),
              source: {
                kind: 'tool-goal',
                form: 'notice',
                summary: boundContextSummary(`${g5Action}: ${g5Objective}`),
              },
            }))
          } else {
            observe({ event: 'wrapup-defer-UNAVAILABLE', toolName, detail: `the ${g5Action} landed goal-round but the dispatch exec carries no public deferContext face — the wrap-up is NOT fabricated` })
          }
        }
      }
      return deepFreeze({
        ok: true,
        // Canonical result: the host goalValue projection over the FINAL
        // port view (tool-goal/src/index.ts:157-173). A terminal update
        // result would additionally carry the goal-round wrap-up context
        // host-side — UNMOUNTABLE through this port (named gap).
        value: goalValue(finalView),
        plan: fresh,
        dispatch: [...(built.executedPrefix ?? []), ...built.list.map((c) => ({ method: c.method, source: c.source }))],
        authorityObserved: fresh.targetManifest.executionAuthority.observed === true,
      })
    }

    return Object.freeze({
      familyId: A5_G5_FAMILY_ID,
      adapterRevision: A5_G5_ADAPTER_REVISION,
      recordIndex: record.recordIndex,
      toolName,
      operation: record.operation,
      mountCondition: 'captured_native+goals_port',
      mountState: 'ACTIVE',
      realmId,
      providerId,
      active: true,
      captured: () => true,
      captureIdentity,
      // L2: the CAPTURED bytes, verbatim.
      description: descriptionBytes,
      parametersSchema,
      outputSchema,
      portMethods: [...portMethods],
      namedGaps: A5_G5_GOAL_NAMED_GAPS,
      classify,
      invoke,
      runPlan,
      drainSemantics: DRAIN_SEMANTICS,
      drain: () => { draining = true },
      draining: () => draining,
      stats: () => Object.freeze({ ...stats }),
    })
  }

  for (const toolName of A5_G5_GOAL_TOOL_NAMES) {
    let captured = undefined
    let captureIssue = null
    try {
      captured = readNative(toolName)
    } catch {
      captureIssue = `the capture seam threw while reading "${toolName}"`
    }
    const problem = captureIssue ?? captureProblem(toolName, captured)
    if (problem !== null) {
      rows[toolName] = inactiveG5Row({
        toolName, realmId, providerId,
        mountState: 'INACTIVE-CAPTURE-ABSENT',
        blocker: `declared_mount is unproven (${problem}): the row exists for the census but nothing mounts and nothing substitutes — the REAL native face is the only source of this tool's description/parameter bytes and this adapter invents no body (named gaps: AUTHORITY ${A5_G5_GOAL_NAMED_GAPS.AUTHORITY.slice(0, 80)}…)`,
      })
      continue
    }
    const missing = PORT_METHODS_BY_TOOL[toolName].filter((m) => typeof goals[m] !== 'function')
    if (missing.length > 0) {
      rows[toolName] = inactiveG5Row({
        toolName, realmId, providerId,
        mountState: 'INACTIVE-PORT-INCOMPLETE',
        blocker: `declared_mount is unproven (the injected goals port serves none/all-less of the required method(s) ${missing.map((m) => `"${m}" (${A5_G5_GOAL_SERVICE_METHODS[m].source} @639ed01539)`).join(', ')}): the real GoalService surface this record delegates to is not mounted — nothing is substituted and no partial arm runs`,
      })
      continue
    }
    rows[toolName] = buildActiveRow(toolName, captured)
  }

  return Object.freeze({
    ...rows,
    adapterLaw: deepFreeze({
      familyId: A5_G5_FAMILY_ID,
      adapterRevision: A5_G5_ADAPTER_REVISION,
      records: A5_G5_GOAL_RECORDS,
      portLaw: A5_G5_GOAL_SERVICE_METHODS,
      namedGaps: A5_G5_GOAL_NAMED_GAPS,
      drain: DRAIN_SEMANTICS,
      delegationLaw: 'each row dispatches ONLY its own captured-tool mapping onto the real GoalService methods (get_goal→get; create_goal→create; update_goal→get?/edit|pause|resume|complete|block per action) — never a shared tool-invoke string dispatch; the result is the goalValue projection of the final port view (tool-goal/src/index.ts:157-173)',
    }),
    stats: () => Object.freeze({ ...stats }),
    drain: () => { draining = true },
    draining: () => draining,
  })
}
