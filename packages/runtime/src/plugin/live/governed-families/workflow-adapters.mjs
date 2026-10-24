/**
 * governed-families/workflow-adapters.mjs — A5-M2 governed-adapter rows for
 * census family B-ORCHESTRATION: record 47 workflow (always, host-preset-on)
 * / record 48 ralph (declared_mount, host-preset-off in every shipped
 * preset). Census M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json; family law
 * M0-B-FAMILY-TARGET-CONTRACTS.md §B-ORCHESTRATION (line 127). UNWIRED by
 * ruling: NOTHING here registers or mounts; the PAIRED registration writer
 * feeds familyRegistrations() at the mount moment (house style:
 * schedule / team / subagent / subagent-spawn siblings).
 *
 * ── WHAT THE MEASUREMENT FOUND (this is why the rows DELEGATE) ────────────
 * Both faces are minted by TWO published plugins with ONE shared engine
 * seam: the `workflowEngine` SERVICE (abstract class, workflow/src/index.ts
 * :157, whose published face is EXACTLY `abstract start(request):
 * WorkflowRun` :168 — nothing else). tool-workflow registers `workflow`
 * (parameters script/meta/args/run_in_background?, output oneOf
 * background{jobId,runId}|foreground{runId,agentsStarted,result}) and its
 * body hands the ENTIRE fan-out to ctx.workflowEngine.start(...) at :282
 * (background) / :433 (foreground); tool-ralph registers the FIXED `ralph`
 * tool (model supplies DATA ONLY: objective/maxRounds; the loop, route,
 * schema and handoff validation are deployment-owned constants) and hands
 * its loop to the SAME engine seam at :445 with maxTotalAgents = the
 * resolved round cap. Child spawning, per-child admission, Ask-halt,
 * concurrency budgets and the script sandbox are ENGINE/CENTER facts the
 * abstract service face cannot express from outside — re-implementing any
 * of it here would be the duck-law the family contract forbids ("owner
 * SERVICE"). These rows are DELEGATION rows in the settled B-TEAM mode: the
 * placed definition carries every captured face verbatim and ONLY `execute`
 * is replaced; the governed execute dispatches to the SAME captured native
 * execute (L3 pairing), the row adding only the REQUIRED admit seat, the
 * pure argument mirror, the plan memo and the drift gates. The row observes
 * the body answer ({kind,runId,agentsStarted,result|{runId,agentsStarted,
 * result}}) and NOTHING about the individual children — exactly the seam's
 * honest reach; per-child admission is a NAMED GAP below, never claimed.
 *
 * ── NATIVE-FACE LEDGER (comment-side ONLY) ────────────────────────────────
 * workflow   HOST pkg dsh-tool-workflow, workflow/tool-workflow/src/index.ts: name/inject :44-45 (inject tools+workflowEngine+systemPrompt); Config :47-64 (toolName default 'workflow', maxResultChars, enableRunInBackground default true — apply expects the SCHEMASTERY-RESOLVED config); apply :316; prompt section :322-327; THE TOOL registers at :328 as defineTool({name: toolName, parameters {script*, meta*{name*,description*,whenToUse?,phases?}, args?, [run_in_background]}, output oneOf background{jobId,runId}|foreground{runId,agentsStarted,result}, presentCall/presentResult}); execute body :408-470 (measured law): parent = exec.agent — FALSY → THROW Error('workflow tool requires a calling agent (exec.agent was undefined)'); run_in_background===true + config-disabled → THROW 'run_in_background is disabled for this tool'; background branch → ctx.get('jobs') — ABSENT → THROW 'background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs' :270, else jobs.start owns the run (:269-317, cancel maps run.cancel); foreground → ctx.workflowEngine.start({script, meta, args?, parent (LIVE reference), signal}) :433 — META_INVALID/SCRIPT_PARSE THROW SYNCHRONOUSLY from the engine (body laws); the tool BRIDGES exec.signal abort → run.cancel('parent step aborted') (:441-443; measured ASYMMETRY: no pre-aborted immediate check here — a pre-aborted signal fires no listener); await run.result; non-'completed' stopReason maps to a THROW via stopReasonError ('workflow run was cancelled (…)' / 'workflow run failed: …'); finally ALWAYS run.dispose() + recorder.finish/abandon; durable log-only events tool-workflow/run-start|agent-start|agent-end (:114-135) are the plugin's OWN observability, not this row's.
 * ralph      HOST pkg dsh-tool-ralph, workflow/tool-ralph/src/index.ts: name/inject :20-21 (inject tools+workflowEngine+subagents+systemPrompt); Config :24-40 (subagentProvider default 'spawn', maxRounds default 256 (deployment ceiling — shipped preset binds 64), maxHandoffChars/maxResultChars 16384); apply :404; THE TOOL registers at :411 defineTool({name:'ralph' FIXED, parameters {objective*, maxRounds?}, output object{runId,agentsStarted,result}, presentCall/presentResult}); execute :437-477 (measured law): parent === undefined → THROW Error('Ralph tool requires a calling agent (exec.agent was undefined)') — the Host literal is a STRICT `=== undefined` comparison (measured; it differs from the workflow body's `!parent` truthiness) and the capital-R bytes differ from the workflow tool — carried per record; objective.trim() empty → THROW 'Ralph objective must be a non-empty string'; resolveMaxRounds :206 (positive safe integer ≤ ceiling — TypeError lanes); requireFreshProvider :218 (THROWS 'Ralph subagent provider "<n>" is not registered' / '…does not support structured output' / '…inherits parent context; Ralph requires a fresh provider' — the C1 fresh-child guarantee is a BODY law, pinned as passthrough); FIXED RALPH_SCRIPT/RALPH_META constants (:83+:163 — the model supplies DATA only, cannot alter loop/route/schema); ctx.workflowEngine.start({script, meta, args:{objective,maxRounds,maxHandoffChars}, subagentProvider, maxTotalAgents: maxRounds, parent, signal}) :445; abort bridge WITH the explicit pre-aborted check (measured difference vs the workflow tool); readRunResult :~300 (closed terminal shapes; malformed → THROW; round-failed → THROW with last handoff); finally always run.dispose().
 * engine     abstract seam ONLY: workflow/src/index.ts WorkflowEngine :157, published face `abstract start(request): WorkflowRun` :168; the shipped concrete engine is the isolated-group engine wired by CENTER (census engine-isolate-group; existing entry agent-bindings.mjs) — the CONTRACT's P obligation 调用E engine前建立受限child工厂、所有模型tools穿CENTER (contract §B-ORCHESTRATION) lands THERE, not at this row (NAMED GAP PRE_ENGINE_CHILD_FACTORY). The workflow-ptc PtcWorkflowEngine is the PTC-variant engine (the census 'off-in-ptc' lifecycle note), not a second public tool face.
 * mount      shipped presets DISABLE ralph (host-preset-off → honest declared_mount row; the 64-round ceiling is preset-bound per the census); workflow ships host-preset-on (always). Registration for governed members rides agent-bindings (CENTER); this module registers nothing (L11).
 *
 * ── LAW INDEX (settled house laws, siblings as model) ─────────────────────
 *  L1 HONEST DECLARED ROWS: per-record mountCondition (47 always; 48
 *     declared_mount); activation gate = COMPLETE capture (real
 *     registration minimum-entry shape); absent → DECLARED row; half →
 *     assembly refusal.
 *  L2 ONLY EXECUTE IS REPLACED (presentation faces incl. presentCall/
 *     presentResult ride verbatim BY REFERENCE).
 *  L3 DELEGATE SET, VERIFIED = INVOKED: `workflowDelegates[name]` must BE
 *     the captured native execute (SPLIT refused at assembly);
 *     `liveWorkflowDelegates()` REQUIRED, answers the bound object at
 *     assembly AND at the dispatch edge; the verified handles ARE the
 *     invoked handles (no second unverified read); the parameters compare
 *     base is the BIND-TIME canonical snapshot.
 *  L4 LIVE CALLER IDENTITY, THROWN LIKE EACH BODY (measured bytes DIFFER
 *     per record and are carried per record; zero delegate entry; the live
 *     exec rides BY REFERENCE — the bodies put exec.agent INTO the engine
 *     start request as the children's parent and read exec.signal for the
 *     cancel bridge).
 *  L5 THIN ARGUMENT MIRROR, REFUSAL CLASS, PRESENCE+TYPE ONLY: script
 *     string, meta object, args object?, run_in_background boolean?;
 *     objective string, maxRounds number?. Everything VALUE-shaped is a
 *     BODY/ENGINE law that THROWS its own lane bytes through the body
 *     (META_INVALID/SCRIPT_PARSE, the round-ceiling TypeErrors, the fresh-
 *     provider trio, malformed terminal results) — pinned as passthrough,
 *     never re-implemented (duck-law).
 *  L6 NO ERROR MAP: engine validation, cancelled/failed stopReason
 *     conversions, jobs-unavailable, disabled-run_in_background, round
 *     failures — throws propagate VERBATIM as tool errors.
 *  L7 PER-DISPATCH EDGE RE-VERIFY (identity + description bytes + bind-time
 *     parameters snapshot + execute identity + delegate set).
 *  L8 PLAN MEMO + RUN THE FRESH PLAN; the disclosure is the SPAWN-SIDE one
 *     and sharper: one dispatch starts a WHOLE run (N agents) — a copied
 *     plan RE-STARTS a second full run (no idempotency carrier; NAMED GAP).
 *  L9 DRAIN = NEW-CALL PROHIBITION ONLY: started runs stay committed;
 *     drain settles/cancels nothing (child convergence is the engine's C3
 *     obligation — NAMED GAP CANCEL_BUDGET).
 *  L10 NO UNADMITTED PATH: `admit` REQUIRED; classify → admit → delegate.
 *     After admission completes and BEFORE the native body, the caller's
 *     cancel is re-checked SYNCHRONOUSLY and fails closed typed with zero
 *     delegate entry (root 20:05 P1: the Host re-reads the signal only
 *     before execute() — runtime :1572-1585 — and the workflow background
 *     branch races into jobs.start with no step signal; an admit-pending
 *     abort must not open a run). No started job is touched: owner, kill
 *     and background-signal lifecycle stay exactly as the body/jobs own
 *     them.
 *  L11 UNWIRED: placement-feed keys only (ABSENT/MOVED throw); the PAIRED
 *     writer registers at mount.
 *
 * Marker law: NOT applicable (no published marker on these faces —
 * measured). Windows dimensions: NOT RUN here, never claimed.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/workflow-adapters
 */
import { createHash } from 'node:crypto'

/** Census family (records 47/48). */
export const A5_B_ORCHESTRATION_FAMILY_ID = 'B-ORCHESTRATION'
export const A5_B_ORCHESTRATION_ADAPTER_REVISION = 1

/** Per-record census mount conditions (47 always; 48 declared_mount). */
export const A5_B_ORCHESTRATION_RECORD_SPECS = Object.freeze({
  workflow: Object.freeze({ recordIndex: 47, mountCondition: 'always', operation: 'workflow-script-run' }),
  ralph: Object.freeze({ recordIndex: 48, mountCondition: 'declared_mount', operation: 'ralph-bounded-loop' }),
})
export const A5_B_ORCHESTRATION_TOOL_NAMES = Object.freeze(['workflow', 'ralph'])

/** The census effect deltas (recordEffectDeltaFromInventory + positive
 *  obligation) with where the OBSERVABLE fact stops at this seam. */
export const A5_B_ORCHESTRATION_EFFECT_LABELS = Object.freeze({
  workflow: 'I + S(agent-fanout-multiplicative-cost): 真实多节点fanout结果且子call独立准入 — the row observes ONLY the body answer ({kind, runId, agentsStarted, result|jobId}); the fan-out itself, every child spawn and its INDEPENDENT admission live INSIDE the engine behind the abstract start() face (NAMED GAPS PRE_ENGINE_CHILD_FACTORY + CHILD_ADMISSION) — agentsStarted is the run\'s own count, never a per-child grant',
  ralph: 'I + S(agent-loop-rounds-multiplicative-cost): 有界真实多轮结果 — the row observes only the body answer ({runId, agentsStarted, result}); the bound is enforced by the BODY (resolveMaxRounds vs the deployment ceiling) + maxTotalAgents into the engine, and the fresh-child guarantee by requireFreshProvider — all pinned as body passthrough, none re-implemented (NAMED GAP RALPH_BOUND)',
})

/** The per-record identity bytes (measured; they DIFFER — carried per record). */
const IDENTITY_THROWS = Object.freeze({
  workflow: 'workflow tool requires a calling agent (exec.agent was undefined)',
  ralph: 'Ralph tool requires a calling agent (exec.agent was undefined)',
})

/** Typed refusal codes OWNED by this module (closed set). */
export const A5_B_ORCHESTRATION_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_ORCH_INPUT_INVALID',
  CAPTURE_ABSENT: 'P_B_ORCH_CAPTURE_ABSENT',
  CAPTURE_INCOMPLETE: 'P_B_ORCH_CAPTURE_INCOMPLETE',
  NON_FAMILY_CAPTURE: 'P_B_ORCH_NON_FAMILY_CAPTURE',
  LIVE_NATIVE_ABSENT: 'P_B_ORCH_LIVE_NATIVE_ABSENT',
  DELEGATES_ABSENT: 'P_B_ORCH_DELEGATES_ABSENT',
  DELEGATE_METHOD_ABSENT: 'P_B_ORCH_DELEGATE_METHOD_ABSENT',
  DELEGATE_SET_SPLIT: 'P_B_ORCH_DELEGATE_SET_SPLIT',
  DELEGATE_DRIFT: 'P_B_ORCH_DELEGATE_DRIFT',
  DEFINITION_DRIFT: 'P_B_ORCH_DEFINITION_DRIFT',
  ADMISSION_ABSENT: 'P_B_ORCH_ADMISSION_ABSENT',
  NOT_OWN_PLAN: 'P_B_ORCH_NOT_OWN_PLAN',
  PLAN_STALE: 'P_B_ORCH_PLAN_STALE',
  ALREADY_DISPATCHED: 'P_B_ORCH_ALREADY_DISPATCHED',
  CANCELLED_BEFORE_DISPATCH: 'P_B_ORCH_CANCELLED_BEFORE_DISPATCH',
  DRAINING: 'P_B_ORCH_DRAINING',
  PLACEMENT_KEY_ABSENT: 'P_B_ORCH_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_B_ORCH_PLACEMENT_KEY_MOVED',
})
const CODES = A5_B_ORCHESTRATION_CODES

/**
 * The dimensions this adapter can NEVER serve through its seam — carried
 * verbatim on every plan instead of being faked closed.
 */
export const A5_B_ORCHESTRATION_NAMED_GAPS = Object.freeze({
  PRE_ENGINE_CHILD_FACTORY: 'THE RESTRICTED CHILD FACTORY IS A PRE-ENGINE CENTER OBLIGATION THIS SEAM CANNOT EXPRESS (contract §B-ORCHESTRATION: P调用E engine前建立受限child工厂，所有模型tools穿CENTER): the published engine face is EXACTLY abstract start() (workflow/src/index.ts:157,168 — measured); the tool body hands {script, meta, args, parent, signal} (and ralph additionally subagentProvider/maxTotalAgents) to ctx.workflowEngine.start at tool-workflow :282/:433 and tool-ralph :445 — WHICH children the engine mints, with WHICH installed services/tools/model routes is decided by the concrete engine instance CENTER built BEFORE this tool was even callable (census engine-isolate-group; existing entry agent-bindings.mjs). The row verifies none of it and claims none.',
  CHILD_ADMISSION: 'PER-CHILD INDEPENDENT ADMISSION IS ENGINE/CENTER-INTERNAL (contract: 运行时新发现target必须独立子调用A，不继承outer grant; C2 真实多节点/多轮结果且nested Ask停在子body前): individual child spawns behind start() have NO public face at this seam — the row sees only the settled answer and the run\'s own agentsStarted count. The per-child A, the Ask-halt-before-child-body, and the run-wide budget walk are the paired engine/CENTER acceptance obligations; a plan here is a grant for ONE run START, never a grant that fans out to children (agentsStarted is a RESULT fact, not an authority).',
  SCRIPT_CAPS: 'SCRIPT SANITY (C1 workflow脚本禁止逃逸服务能力) IS THE ENGINE SANDBOX\'S FACT (caps-in-script; the census engine-isolate-group note): the row SHAPE-validates script/meta and never executes, compiles or bounds the script — META_INVALID/SCRIPT_PARSE are the engine THROWING through the body, and any escape attempt that the sandbox permits is outside this seam\'s reach.',
  CANCEL_BUDGET: 'C3 CONVERGENCE IS THE ENGINE\'S (cancel全children收敛、并发预算不超、重启不继续旧grant): the ONLY observable facts at this seam are the tool\'s abort BRIDGE — exec.signal abort → run.cancel(\'parent step aborted\') — the measured body-level ASYMMETRY that only the ralph body additionally cancels immediately on an ALREADY-aborted signal (pinned by direct-native calls), and the row\'s own FAIL-CLOSED re-check that refuses an already-aborted caller signal AFTER admission and BEFORE the native body (root 20:05 P1; the Host runtime checks the signal only before execute()). Whether every started child actually converges, the concurrency cap holds, and a restart drops old grants lives inside the engine + CENTER durable state; the row claims no child-level convergence, cancels nothing already started, and settles nothing on drain (L9).',
  RALPH_BOUND: 'RALPH\'S BOUND + FRESHNESS ARE BODY LAWS THE ROW PINS AS PASSTHROUGH ONLY (record 48 positive obligation 有界真实多轮结果): resolveMaxRounds (positive safe integer ≤ deployment ceiling — shipped preset binds 64; the Config default 256 is NOT the shipped bound), requireFreshProvider (registered + structured-output + NOT inheritsParentContext), the FIXED loop constants (the model supplies data only), and readRunResult\'s closed terminal shapes. The real multi-round execution rides maxTotalAgents INTO the engine; the row observes agentsStarted/roundsStarted in the body answer and certifies no round itself.',
  PLAN_ONCE_MEMO: 'PLAN-ONCE IS AN INTERNAL MEMO — AND ONE DISPATCH IS A WHOLE RUN: consumedPlans refuses replaying the SAME plan OBJECT with zero delegate entry, but a caller that COPIES the plan fields RE-STARTS a SECOND FULL RUN (N more children — the spec pins this boundary). No idempotency carrier exists at this seam; the real one-shot proof is the CENTER PA wiring edge. Never claimed as closure.',
})

const DRAIN_SEMANTICS = 'drain = NEW-CALL PROHIBITION: a started run (engine accepted start()) stays committed; drain settles nothing and cancels no run or child'

/* ── small internal primitives (sibling house) ───────────────────────── */

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
const jsonClone = (value) => JSON.parse(JSON.stringify(value))

/** L4: the per-record byte-identical missing-caller THROW. */
const missingCallerThrow = (name) => new Error(IDENTITY_THROWS[name])

const refuseAssembly = (code, message) => deepFreeze({ ok: false, code, message })

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-b-orchestration ${String(refusal?.code ?? CODES.INPUT_INVALID)} — ${String(refusal?.detail ?? 'the adapter refused without a detail')}`)
  error.code = refusal?.code
  error.orchestrationRefusal = deepFreeze({ ...refusal })
  return error
}

/**
 * Assembly-time factory for the two B-ORCHESTRATION rows (DELEGATION mode:
 * each row dispatches to the SAME captured native execute).
 *
 * @param input {{
 *   providerId?: string,
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *   liveNative: (name: string) => unknown,
 *   workflowDelegates: Record<string, Function>,   // name -> the CAPTURED execute (L3)
 *   liveWorkflowDelegates: () => unknown,          // REQUIRED re-read (L3)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   admit: (ctx: object) => Promise<{ ok: boolean, code?: string, detail?: string }>,
 *   observe?: (row: unknown) => void,
 * }} input
 * @returns a frozen `{ ok: true, assembly }` or a frozen `{ ok: false, code, message }`.
 */
export function createWorkflowAdapterAssembly(input = {}) {
  if (!isRecord(input)) return refuseAssembly(CODES.INPUT_INVALID, 'the factory takes one input record')
  const knownInput = new Set(['providerId', 'captured', 'liveNative', 'workflowDelegates', 'liveWorkflowDelegates', 'placementFeed', 'admit', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(CODES.INPUT_INVALID, `unknown input '${key}' — the factory takes exactly {providerId, captured, liveNative, workflowDelegates, liveWorkflowDelegates, placementFeed, admit, observe}`)
    }
  }
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'b-orchestration'
  if (typeof input.placementFeed !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition, never a hand-spelled string (the settled registration law)')
  }
  if (typeof input.admit !== 'function') {
    return refuseAssembly(CODES.ADMISSION_ABSENT, 'admit is REQUIRED — this module ships NO unadmitted path to the orchestration engine (the plane\'s PA walk occupies this seam at integration; L10)')
  }
  const delegatesIn = input.workflowDelegates
  if (!isRecord(delegatesIn)) {
    return refuseAssembly(CODES.DELEGATES_ABSENT, 'workflowDelegates is REQUIRED — the {name -> captured native execute} delegation set (production: the SAME functions the capture recorded); this adapter holds no orchestration implementation')
  }
  if (typeof input.liveWorkflowDelegates !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'liveWorkflowDelegates () => the CURRENT delegates object is REQUIRED — the per-dispatch edge re-verifies the bound set; a bind-time constant compared against itself proves nothing (sibling root ② law)')
  }
  if (input.liveWorkflowDelegates() !== delegatesIn) {
    return refuseAssembly(CODES.DELEGATE_DRIFT, 'liveWorkflowDelegates() does not answer the bound workflowDelegates — the mount is already split between two delegation sets; refuse at assembly, never dispatch into a split mount')
  }
  const capturedIn = input.captured ?? {}
  if (!isRecord(capturedIn)) return refuseAssembly(CODES.INPUT_INVALID, 'captured must be a record (name -> {native, definitionIdentity}) or absent')
  for (const key of Object.keys(capturedIn)) {
    if (!Object.prototype.hasOwnProperty.call(A5_B_ORCHESTRATION_RECORD_SPECS, key)) {
      return refuseAssembly(CODES.NON_FAMILY_CAPTURE, `'${key}' is not a B-ORCHESTRATION record (this module is exactly ${A5_B_ORCHESTRATION_TOOL_NAMES.join(' / ')} — the subagent families are the sibling subagent-adapters and subagent-spawn-adapters modules); another family's or provider's face never rides this module`)
    }
  }
  const captureKeys = Object.keys(capturedIn)
  if (captureKeys.length > 0 && typeof input.liveNative !== 'function') {
    return refuseAssembly(CODES.LIVE_NATIVE_ABSENT, 'liveNative is REQUIRED whenever a capture is presented — without the placement feed re-read the per-dispatch identity check is self-attestation (L7)')
  }
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
    if (typeof delegatesIn[key] !== 'function') {
      return refuseAssembly(CODES.DELEGATE_METHOD_ABSENT, `workflowDelegates has no function for captured '${key}' — a partial delegation set is a config defect, never a degraded row`)
    }
    if (delegatesIn[key] !== native.execute) {
      return refuseAssembly(CODES.DELEGATE_SET_SPLIT, `workflowDelegates.${key} is NOT the captured native execute — delegating to a rebuilt set behind a stale capture is exactly the split the family gate measures (L3)`)
    }
  }
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

  const rows = new Map()
  const declared = []
  const definitions = []
  const consumedPlans = new WeakSet()
  const state = { draining: false, dispatches: 0, refuses: 0 }
  const boundOf = new WeakMap()
  const frozenDelegates = Object.freeze(Object.fromEntries(Object.keys(delegatesIn).map((key) => [key, delegatesIn[key]])))

  const refuseWith = (name, code, detail) => {
    state.refuses += 1
    observe({ event: 'b-orchestration:refusal', name, code })
    return refuse(code, detail)
  }

  /** L3/L7 edge integrity: definition bytes + the VERIFIED delegation handle. */
  const edgeIntegrity = (row) => {
    if (state.draining) {
      return refuse(CODES.DRAINING, `${row.name}: draining — new calls are refused (${DRAIN_SEMANTICS})`)
    }
    const bound = boundOf.get(row)
    if (bound === undefined) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: no bind-time binding exists — a row assembled outside this factory dispatches nothing`)
    }
    const live = input.liveNative(row.name)
    if (live !== bound.def) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the face behind liveNative is no longer the captured object — the governed call refuses; there is no replacement-body path and no native fallback`)
    }
    // BIND-TIME CANONICAL SNAPSHOT (settled house law): never the live
    // shared reference; the row/placed definition still CARRY it (L2).
    if (live.description !== bound.descriptionBytes || canonicalJson(live.parameters) !== bound.parametersCanonical) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's description or compiled parameter bytes moved since bind time (compared against the BIND-TIME canonical snapshot, not the live shared reference)`)
    }
    if (live.execute !== bound.execute) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's execute function is no longer the bound function value`)
    }
    const current = input.liveWorkflowDelegates()
    if (current !== bound.delegates) {
      return refuse(CODES.DELEGATE_DRIFT, `${row.name}: the CURRENT delegation read is not the bound set — a rebuilt/replaced delegation underneath this mount is drift, full stop (L3)`)
    }
    const method = current[row.name]
    if (method !== frozenDelegates[row.name]) {
      return refuse(CODES.DELEGATE_DRIFT, `${row.name}: the delegate '${row.name}' was rebound underneath the frozen bind — a rebound delegation is drift, full stop`)
    }
    // THE VERIFIED HANDLES ARE THE INVOKED HANDLES (no second unverified read).
    return Object.freeze({ delegates: current, method })
  }

  const buildActiveRow = (name, capture) => {
    const spec = A5_B_ORCHESTRATION_RECORD_SPECS[name]
    const def = capture.native
    const descriptionBytes = def.description
    const parameters = def.parameters === undefined ? Object.freeze({}) : def.parameters
    const row = {
      name,
      familyId: A5_B_ORCHESTRATION_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: spec.mountCondition,
      active: true,
      capturePresent: true,
      description: descriptionBytes,
      parameters,
      outputSchema: def.output.schema,
      definitionIdentity: capture.definitionIdentity,
      effectDelta: A5_B_ORCHESTRATION_EFFECT_LABELS[name],
      namedGaps: A5_B_ORCHESTRATION_NAMED_GAPS,
      classify: (rawArgs) => classify(row, rawArgs),
      delegate: (plan, ctx) => delegate(row, plan, ctx),
    }
    boundOf.set(row, Object.freeze({ def, descriptionBytes, parametersCanonical: canonicalJson(parameters), execute: def.execute, delegates: delegatesIn }))
    return row
  }

  /** Contract §B-ORCHESTRATION target facts every plan carries. */
  const mintTarget = (name) => Object.freeze({
    contract: 'M0-B-FAMILY-TARGET-CONTRACTS §B-ORCHESTRATION — 目标I+S(execution graph/loop instance,run)+每个child spawn、上下文读取、轮次/并行/总预算、模型路由 — THIS ROW: the run-START face (the engine behind start() owns everything per-child)',
    parent: 'the LIVE exec.agent reference at dispatch (identity by reference, per-call; the bodies pass this reference INTO the engine start request as the children\'s parent — the row never binds or trusts an id string)',
    child: Object.freeze({
      claim: null,
      adjudication: 'the children are minted by the ENGINE behind the abstract start() face (workflow/src/index.ts:157,168 — measured published face is EXACTLY start()); their installed services/tools/routes are the PRE-ENGINE CENTER restricted child factory (NAMED GAPS PRE_ENGINE_CHILD_FACTORY + CHILD_ADMISSION) — agentsStarted in the answer is a RESULT count, never an authority that fans out',
    }),
    action: A5_B_ORCHESTRATION_RECORD_SPECS[name].operation,
    revision: 'no revision carrier at this seam — one dispatch starts a WHOLE run and a copied plan RE-STARTS a second one (NAMED GAP PLAN_ONCE_MEMO); the body answer carries the engine runId as the SERVICE records it',
    effect: A5_B_ORCHESTRATION_EFFECT_LABELS[name],
    budget: name === 'ralph'
      ? '轮次/并行/总预算 is three-layered and NONE of it is a row law: the BODY resolves maxRounds against the deployment ceiling (shipped preset 64; Config default 256 is NOT the shipped bound), hands maxTotalAgents to the engine, and the engine owns concurrency; the row pins the TypeError lanes as passthrough only'
      : '轮次/并行/总预算 + 模型路由 ride the script + the engine (phases may name provider/model overrides — engine-adjudicated); the row shape-validates meta only',
    script: name === 'ralph'
      ? 'the loop/route/schema are FIXED deployment constants (RALPH_SCRIPT/RALPH_META — the model supplies DATA only, measured); this row never executes scripts'
      : 'C1 脚本禁止逃逸服务能力 is the ENGINE SANDBOX\'s fact (caps-in-script); META_INVALID/SCRIPT_PARSE throw from the engine THROUGH the body — this row never executes, compiles or bounds the script (NAMED GAP SCRIPT_CAPS)',
  })

  /** L8 classify — pure over the arguments (L5 presence+type mirror). */
  const classify = (row, rawArgs) => {
    if (state.draining) {
      return refuseWith(row.name, CODES.DRAINING, `${row.name}: draining — new calls are refused (${DRAIN_SEMANTICS})`)
    }
    if (rawArgs !== undefined && rawArgs !== null && !isRecord(rawArgs)) {
      return refuseWith(row.name, CODES.INPUT_INVALID, `${row.name}: arguments must be a record (the real dispatcher always hands an object; anything else is a mount anomaly)`)
    }
    const args = rawArgs === undefined || rawArgs === null ? {} : rawArgs
    const lawMiss = (detail) => refuseWith(row.name, CODES.INPUT_INVALID, `${row.name}: ${detail}`)
    if (row.name === 'workflow') {
      if (typeof args.script !== 'string') return lawMiss('script must be a string (dispatcher-shape mirror of the required schema field; emptiness/META_INVALID/SCRIPT_PARSE are the ENGINE throwing through the body)')
      if (!isRecord(args.meta)) return lawMiss('meta must be an object (dispatcher-shape mirror; its required inner fields are validated by the ENGINE and throw through the body)')
      if (args.args !== undefined && !isRecord(args.args)) return lawMiss('args must be an object when present (dispatcher-shape mirror)')
      if (args.run_in_background !== undefined && typeof args.run_in_background !== 'boolean') return lawMiss('run_in_background must be a boolean when present (dispatcher-shape mirror; the config-disabled law is the body\'s)')
    } else {
      if (typeof args.objective !== 'string') return lawMiss('objective must be a string (dispatcher-shape mirror of the required schema field; the trim-and-empty law is the body\'s own throw)')
      if (args.maxRounds !== undefined && typeof args.maxRounds !== 'number') return lawMiss('maxRounds must be a number when present (dispatcher-shape mirror; the positive-safe-integer/ceiling TypeErrors are the body\'s)')
    }
    const snapshot = deepFreeze(jsonClone(args))
    const plan = deepFreeze({
      rowName: row.name,
      recordIndex: row.recordIndex,
      operation: A5_B_ORCHESTRATION_RECORD_SPECS[row.name].operation,
      target: mintTarget(row.name),
      args: snapshot,
      parametersFingerprint: `sha256:${sha256(canonicalJson({ name: row.name, args: snapshot }))}`,
      namedGaps: A5_B_ORCHESTRATION_NAMED_GAPS,
    })
    observe({ event: 'b-orchestration:classified', name: row.name })
    return deepFreeze({ ok: true, plan })
  }

  /** L3/L4/L6/L7/L8 dispatch: DELEGATE to the captured native execute.
   *  `exec` rides BY REFERENCE (the bodies read exec.agent / exec.signal
   *  for the parent attribution and the abort→run.cancel bridge). */
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
      return refuseWith(row.name, CODES.ALREADY_DISPATCHED, `${row.name}: this plan OBJECT was already dispatched — INTERNAL MEMO refusal only (NAMED GAP PLAN_ONCE_MEMO): a copied plan RE-STARTS a SECOND FULL RUN; no idempotency carrier at this seam (L8)`)
    }
    const exec = isRecord(ctx) ? ctx.exec : undefined
    // L4: the byte-identical missing-caller THROW of THIS record's body.
    if (!isRecord(exec) || !isRecord(exec.agent)) {
      observe({ event: 'b-orchestration:missing-caller-throw', name: row.name })
      throw missingCallerThrow(row.name)
    }
    // FAIL-CLOSED CANCEL RE-CHECK (root 20:05 P1; measured HOST gap: the
    // runtime re-reads the caller signal only BEFORE execute() — runtime
    // :1572-1585 — while the workflow body reaches jobs.start SYNCHRONOUSLY
    // (:418-423) and its background branch carries no step signal at all
    // (:269-287), so an abort while the admit AWAIT is pending would
    // otherwise open a background run nobody re-checks). Once admission has
    // completed and BEFORE the native body is called, re-check the caller
    // signal synchronously and refuse typed with ZERO delegate entry. The
    // row cancels nothing, claims nothing about already-started jobs, and
    // touches no job owner/kill/background-signal lifecycle.
    if (typeof exec.signal === 'object' && exec.signal !== null && exec.signal.aborted === true) {
      return refuseWith(row.name, CODES.CANCELLED_BEFORE_DISPATCH, `${row.name}: the caller signal was already aborted when admission completed — governed dispatch fail-closes BEFORE the native body (the Host re-checks the signal only before execute(), and the workflow background branch would otherwise race into jobs.start with no step signal); nothing was started, nothing is cancelled here`)
    }
    consumedPlans.add(plan)
    state.dispatches += 1
    observe({ event: 'b-orchestration:delegate-call', name: row.name })
    // L6: NO catch — engine validation throws, stopReason conversions,
    // jobs-unavailable, fresh-provider refusals and round failures
    // propagate verbatim as tool errors (the published body's own
    // behaviour). The delegation uses the edge-VERIFIED handle with the
    // live exec BY REFERENCE.
    const value = await edge.method.call(edge.delegates, fresh.plan.args, exec)
    observe({ event: 'b-orchestration:dispatched', name: row.name })
    // SHALLOW freeze: the wrapper is ours; the body's answer may carry
    // engine-owned objects — the row never freezes the service's own data.
    return Object.freeze({ ok: true, settled: 'delegated', value })
  }

  const buildDeclaredRow = (name, reason, code) => {
    const spec = A5_B_ORCHESTRATION_RECORD_SPECS[name]
    const refusal = refuse(code, `${name}: honest ${spec.mountCondition} declared row (${reason}) — no captured native face was mounted; every classify/delegate refuses typed with zero delegate entry, zero substitution, no definition, no registration`)
    return Object.freeze({
      name,
      familyId: A5_B_ORCHESTRATION_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: spec.mountCondition,
      active: false,
      capturePresent: false,
      description: null,
      parameters: null,
      outputSchema: null,
      definitionIdentity: null,
      namedGaps: A5_B_ORCHESTRATION_NAMED_GAPS,
      classify: () => refusal,
      delegate: () => refusal,
    })
  }

  for (const name of A5_B_ORCHESTRATION_TOOL_NAMES) {
    const capture = capturedIn[name]
    if (capture === undefined) {
      const row = buildDeclaredRow(name, 'capture-absent', CODES.CAPTURE_ABSENT)
      rows.set(name, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'capture-absent', row }))
      declared.push(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_ORCHESTRATION_FAMILY_ID, status: 'DECLARED-INACTIVE', reason: 'capture-absent', captureReportedIgnored: false }))
      observe({ event: 'b-orchestration:declared', name, reason: 'capture-absent' })
      continue
    }
    const row = buildActiveRow(name, capture)
    // THE CAPTURED DEFINITION TRAVELS COMPLETE (root 8b4 law): every face
    // rides verbatim BY REFERENCE; ONLY `execute` is replaced.
    const definition = Object.freeze({ ...capture.native, execute: async (args, exec) => {
      const classified = row.classify(args)
      if (classified.ok !== true) throw refusalToThrow(classified)
      const admitted = await input.admit(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_ORCHESTRATION_FAMILY_ID, classified, exec }))
      if (admitted?.ok !== true) {
        throw refusalToThrow(admitted ?? { code: CODES.ADMISSION_ABSENT, detail: 'the admission seam refused this call' })
      }
      const settled = await row.delegate(classified.plan, { exec })
      if (settled?.ok !== true) throw refusalToThrow(settled)
      return settled.value
    } })
    rows.set(name, Object.freeze({ status: 'ACTIVE', row, definition, captureDefinitionIdentity: capture.definitionIdentity }))
    definitions.push(definition)
    observe({ event: 'b-orchestration:mounted', name, recordIndex: row.recordIndex })
  }

  // THE MOUNT-MOMENT REGISTRATION (sibling law): placement-feed keys only.
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
      recordIndex: A5_B_ORCHESTRATION_RECORD_SPECS[definition.name].recordIndex,
      definitionIdentity: key,
      entry: Object.freeze({
        familyId: A5_B_ORCHESTRATION_FAMILY_ID,
        adapterRevision: A5_B_ORCHESTRATION_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const rowsView = Object.freeze(Object.fromEntries([...rows.entries()]))
  const assembly = Object.freeze({
    ok: true,
    familyId: A5_B_ORCHESTRATION_FAMILY_ID,
    revision: A5_B_ORCHESTRATION_ADAPTER_REVISION,
    providerId,
    subset: 'records 47-48 (B-ORCHESTRATION; DELEGATION mode — rows dispatch to the captured published bodies; the shared engine seam behind start() is CENTER/engine-owned)',
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    definitions: Object.freeze(definitions),
    rows: rowsView,
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name)?.row,
    /** L9: new-call prohibition ONLY. */
    drain: () => {
      state.draining = true
      return deepFreeze({ event: 'b-orchestration:drain', semantics: DRAIN_SEMANTICS })
    },
    inFlight: () => deepFreeze({ dispatches: state.dispatches, refuses: state.refuses }),
    familyRegistrations,
  })
  return assembly
}
