/**
 * governed-families/subagent-spawn-adapters.mjs — A5-M2 governed-adapter rows
 * for the SPAWN SIDE of census family B-SUBAGENT: records 39 subagent /
 * 40 subagent_fork / 41 subagent_codex / 42 subagent_claude_code /
 * 43 list_subagent_models (M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json; family
 * law M0-B-FAMILY-TARGET-CONTRACTS.md §B-SUBAGENT). The control trio
 * (44/45/46) is the sibling `subagent-adapters.mjs`; together they cover the
 * census family — each module carries its own honest gaps. UNWIRED by
 * ruling: NOTHING here registers or mounts anything; the PAIRED registration
 * writer feeds `familyRegistrations()` entries at the mount moment (house
 * style: schedule-adapters / team-adapters / subagent-adapters).
 *
 * ── WHAT THE MEASUREMENT FOUND (this is why the rows DELEGATE) ────────────
 * All five faces are minted by ONE published plugin, @deepseek-ai/dsh-tool-
 * subagent (root E2 anchor "Host tool-subagent index.ts:108,379"): one plugin
 * instance per provider declaration, `toolName` from its Config, the tool
 * registered when the named provider is present. The SPAWN SERVICE LAW —
 * provider resolution, depth resolution, child model-route preflight, the
 * continuable inbox acceptance, the jobs lane, the durable child start —
 * lives ENTIRELY inside the published body against ctx.subagents / the `llm`
 * service / the jobs service. Re-implementing any of it here would be the
 * duck-law the family contract forbids ("owner SERVICE"), so these rows are
 * DELEGATION rows in the settled B-TEAM mode: the placed definition carries
 * every captured face verbatim and ONLY `execute` is replaced; the governed
 * execute dispatches to the SAME captured native execute (L3 pairing), the
 * row adding only the REQUIRED admit seat, the pure argument mirror, the
 * plan memo and the drift gates. The adapter NEVER spawns anything itself
 * and never re-derives child governance.
 *
 * ── NATIVE-FACE LEDGER (comment-side ONLY: a string literal IS an edge to
 * the audit, so path facts never live in values) ───────────────────────────
 * mint plugin  HOST pkg dsh-tool-subagent, subagent/tool-subagent/src/index.ts: name/inject :44-45 (inject tools+subagents+systemPrompt+sessionProjections); Config :106 (provider REQUIRED string, toolName default 'subagent', modelSelectionSettings, enableRunInBackground default true, backgroundMode one-shot|continuable, agentOptions, persona, toolFilter, maxDepth natural|'provider-managed'); apply :313 (maxDepth numeric assert, toolFilter completeness assert, provider capability asserts :330-353, provider-added/-removed listeners + initial-provider mount :574-590, continuable prompt section :592-602); THE TOOL registers inside mount() at :379 as defineTool({name: toolName, description: providerWording(inheritsParentContext)+background wording+choice wording, parameters {description*, prompt*, [provider, model, reasoning_effort when model-selection], [run_in_background when background]}, output oneOf background{jobId}|continuable{subagentId}|foreground{runId,output}, execute}); providerWording :252 (fork wording = inheritsParentContext true — record 40's face is a WORDING + provider difference of the SAME mint); resolveDelegationRun :287.
 * execute body same file :470-567 (measured law, all SERVICE-side): parent = exec.agent — FALSY → THROW Error('subagent tool requires a calling agent (exec.agent was undefined)') :473-476 (NON-agent callers have no delegation ownership); child model request → requestedAgentOptions + assertAllowedModelSelection (model-selection.ts lane errors) + LLM ROUTE PREFLIGHT against the `llm` SERVICE, THROW 'cannot resolve the selected child LLM route because the `llm` service is unavailable' when absent, THROW 'subagent provider "<name>" changed while resolving the child LLM route; retry the delegation' on provider drift mid-preflight; exec.signal.throwIfAborted(); maxDepth = ctx.subagents.resolveMaxDepth(config.maxDepth); request {label, prompt:[{type:'text'}], parent (the LIVE reference), agentOptions?, persona?, toolFilter?, maxDepth?}; continuable → await ctx.subagents.startContinuable({provider,label,request,signal}) resolving AT INBOX ACCEPTANCE ({kind:'continuable',subagentId}); one-shot background → jobs.start(...) (THROW 'background jobs unavailable: load @deepseek-ai/dsh-jobs and @deepseek-ai/dsh-tool-jobs') ({kind:'background',jobId}); foreground → await ctx.subagents.start(provider,{...request,signal}) then settleForegroundRun :208 (stopReasonError converts partial output to a THROW carrying diagnostics). The body CATCHES NOTHING it rewrites — throws propagate as tool errors.
 * list tool    same pkg list-models.ts: registerListSubagentModels(ctx, policy) :86 registers defineTool name 'list_subagent_models' (parameters provider?, model?; output string), execute → listSubagentModels(ctx, policy, args, exec.signal) — a READ over the `llm` service (llm.listProviders() etc.) under the policy captured at install; registeredProvider THROWS 'LLM provider "<id>" is not registered; available providers: ...' :20-27. NO exec.agent identity law in this body (measured — it is a pure read).
 * provider-mint reality records 41/42 (declared_mount) ride the SAME published mint with a different provider declaration: the external codex/claude provider packages (subagent/subagent-codex, subagent/subagent-claude-code) are PROVIDER DRIVERS (inject ['subagents','subprocess']; they register the provider, never a tool — measured: zero tools.register in their src) and the tool face for them is this plugin's definition mounted when `config.provider` names them. The CAPTURE in the spec therefore runs the REAL published plugin apply against the REAL registration harness with a provider present, and the codex/claude captures use the same real mint with their provider names — the mint bytes are the published ones; the PROVIDER SEMANTICS (external process, permission enforcement) are NOT tool-side facts and are NAMED GAPS below, never claimed.
 * registration the lane binds these tools for its members through agent-bindings (CENTER-owned paths; census existingEntryPath); this module registers nothing (L11).
 *
 * ── LAW INDEX (settled house laws, siblings as model) ─────────────────────
 *  L1 HONEST DECLARED ROWS: per-record mountCondition (39/40 always;
 *     41/42/43 declared_mount). Activation gate = COMPLETE capture (real
 *     registration minimum-entry shape); absent capture → honest
 *     DECLARED-INACTIVE row; half-capture → assembly refusal.
 *  L2 ONLY EXECUTE IS REPLACED: every captured face rides verbatim BY
 *     REFERENCE; ONLY `execute` is replaced.
 *  L3 DELEGATE SET, VERIFIED = INVOKED (B-TEAM review law, carried in):
 *     `spawnDelegates[name]` must be the CAPTURED native execute (a rebuilt
 *     set behind a stale capture is refused at assembly:
 *     P_B_SUBAGENT_SPAWN_DELEGATE_SET_SPLIT); `liveSpawnDelegates()` is
 *     REQUIRED and answers the SAME bound object with the frozen method at
 *     assembly AND at the dispatch edge; THE VERIFIED HANDLES ARE THE
 *     INVOKED HANDLES — no second unverified read exists; the compiled
 *     parameters compare base is the BIND-TIME canonical snapshot, never
 *     the live shared reference.
 *  L4 LIVE CALLER IDENTITY, THROWN LIKE THE HOST: the four SPAWN bodies
 *     THROW the byte-identical 'subagent tool requires a calling agent
 *     (exec.agent was undefined)' when exec.agent is falsy — the row
 *     mirrors the THROW (zero delegate entry) and forwards the live exec
 *     BY REFERENCE (the body puts the live parent reference into the spawn
 *     request; governance ownership rides on it). list_subagent_models has
 *     NO identity law (measured) and the row invents none.
 *  L5 THIN ARGUMENT MIRROR, REFUSAL CLASS: only what the dispatcher schema
 *     enforces BEFORE the body (description/prompt non-empty strings;
 *     provider/model/reasoning_effort optional strings; run_in_background
 *     optional boolean; list provider/model optional strings) — typed
 *     REFUSALS (mount-anomaly class), never invented lane VALUES: the
 *     provider/model PAIRING law, the allowed-selection policy and the
 *     closed run-mode law are BODY/SERVICE facts (NAMED below), and
 *     inventing value bytes for them would be duck-law.
 *  L6 NO ERROR MAP: the body throws (llm unavailable, provider changed
 *     mid-preflight, jobs unavailable, stopReason partial output, provider
 *     not registered for list); the row catches NOTHING — throws propagate
 *     verbatim as tool errors, exactly like the published body.
 *  L7 PER-DISPATCH EDGE RE-VERIFY: liveNative object identity + description
 *     bytes + bind-time parameters snapshot + execute identity + the
 *     delegate set — any drift refuses typed with ZERO delegate entry.
 *  L8 PLAN MEMO, RUN THE FRESH PLAN: same as siblings; for spawn the
 *     disclosure is SHARPER (NAMED GAP PLAN_ONCE_MEMO): spawning is
 *     NON-IDEMPOTENT by nature — the memo refuses replaying the SAME plan
 *     object with zero entry, but a caller that COPIES the plan fields
 *     RE-SPAWNS (a second child is created). There is no idempotency
 *     carrier at this seam; the spec pins this copy boundary honestly.
 *  L9 DRAIN = NEW-CALL PROHIBITION ONLY: an accepted spawn (child created,
 *     inbox accepted, job started) stays committed; drain settles nothing,
 *     cancels no child.
 *  L10 NO UNADMITTED PATH: `admit` REQUIRED; every placed definition runs
 *     classify → admit → delegate; refusals throw the refusing side's OWN
 *     typed bytes. The plane's PA walk occupies the seat; no PA walk here.
 *  L11 UNWIRED: placement-feed keys only (ABSENT/MOVED throw); the PAIRED
 *     registration writer feeds familyRegistrations() to the family
 *     registrar.
 *
 * The marker law of the trio module is NOT applicable here (no published
 * marker exists on the spawn faces — measured: markAdjacentAgentSendMessageTool
 * guards send_message only).
 *
 * Windows dimensions: NOT RUN on this Linux harness, never claimed.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/subagent-spawn-adapters
 */
import { createHash } from 'node:crypto'

/** Census family; this module is the SPAWN-SIDE subset (39–43). */
export const A5_B_SUBAGENT_SPAWN_FAMILY_ID = 'B-SUBAGENT'
export const A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION = 1

/** Per-record census mount conditions (39/40 always; 41/42/43 declared_mount). */
export const A5_B_SUBAGENT_SPAWN_RECORD_SPECS = Object.freeze({
  subagent: Object.freeze({ recordIndex: 39, mountCondition: 'always', operation: 'subagent-spawn' }),
  subagent_fork: Object.freeze({ recordIndex: 40, mountCondition: 'always', operation: 'subagent-fork-spawn' }),
  subagent_codex: Object.freeze({ recordIndex: 41, mountCondition: 'declared_mount', operation: 'subagent-spawn-external-codex' }),
  subagent_claude_code: Object.freeze({ recordIndex: 42, mountCondition: 'declared_mount', operation: 'subagent-spawn-external-claude-code' }),
  list_subagent_models: Object.freeze({ recordIndex: 43, mountCondition: 'declared_mount', operation: 'subagent-model-routes-read' }),
})
export const A5_B_SUBAGENT_SPAWN_TOOL_NAMES = Object.freeze(['subagent', 'subagent_fork', 'subagent_codex', 'subagent_claude_code', 'list_subagent_models'])

/** The census effect deltas (recordEffectDeltaFromInventory + positive
 *  obligation) with where the OBSERVABLE fact stops at this seam. */
export const A5_B_SUBAGENT_SPAWN_EFFECT_LABELS = Object.freeze({
  subagent: 'I + S(child-agent-spawn-resource-cost): 受治理child实际任务并继续 — the row observes ONLY the delegated body answer ({kind, subagentId|jobId|runId,output}); child governance INSTALL rides the CENTER pre-spawn closed world (NAMED GAP PRE_SPAWN_CLOSED_WORLD) and the run lives in the SERVICE',
  subagent_fork: 'I + S(child-agent-spawn-seeded-resource-cost): 真实seed fork且child受治理 — the seed/context-inheritance is a PROVIDER (inheritsParentContext) + driver fact (NAMED GAP FORK_SEED); the row observes only the body answer',
  subagent_codex: 'I + S(external-codex-child-agent): 真实外部Codex provider且权限可强制 — the external provider reality and permission enforcement are PROVIDER-DRIVER facts invisible at the tool face (NAMED GAP PROVIDER_ENVELOPE); the row observes only the body answer',
  subagent_claude_code: 'I + S(external-claude-code-child-agent): 真实外部Claude provider且权限可强制 — same boundary as record 41 (NAMED GAP PROVIDER_ENVELOPE)',
  list_subagent_models: 'S(model-routes-read): 准确当前provider可选模型列表 — the row observes only the body answer; route freshness/advisory membership ride on the captured policy + the live `llm` service inside the body (NAMED GAP MODEL_ROUTES_FRESHNESS)',
})

/** Typed refusal codes OWNED by this module (closed set). */
export const A5_B_SUBAGENT_SPAWN_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_SUBAGENT_SPAWN_INPUT_INVALID',
  CAPTURE_ABSENT: 'P_B_SUBAGENT_SPAWN_CAPTURE_ABSENT',
  CAPTURE_INCOMPLETE: 'P_B_SUBAGENT_SPAWN_CAPTURE_INCOMPLETE',
  NON_FAMILY_CAPTURE: 'P_B_SUBAGENT_SPAWN_NON_FAMILY_CAPTURE',
  LIVE_NATIVE_ABSENT: 'P_B_SUBAGENT_SPAWN_LIVE_NATIVE_ABSENT',
  DELEGATES_ABSENT: 'P_B_SUBAGENT_SPAWN_DELEGATES_ABSENT',
  DELEGATE_METHOD_ABSENT: 'P_B_SUBAGENT_SPAWN_DELEGATE_METHOD_ABSENT',
  DELEGATE_SET_SPLIT: 'P_B_SUBAGENT_SPAWN_DELEGATE_SET_SPLIT',
  DELEGATE_DRIFT: 'P_B_SUBAGENT_SPAWN_DELEGATE_DRIFT',
  DEFINITION_DRIFT: 'P_B_SUBAGENT_SPAWN_DEFINITION_DRIFT',
  ADMISSION_ABSENT: 'P_B_SUBAGENT_SPAWN_ADMISSION_ABSENT',
  NOT_OWN_PLAN: 'P_B_SUBAGENT_SPAWN_NOT_OWN_PLAN',
  PLAN_STALE: 'P_B_SUBAGENT_SPAWN_PLAN_STALE',
  ALREADY_DISPATCHED: 'P_B_SUBAGENT_SPAWN_ALREADY_DISPATCHED',
  DRAINING: 'P_B_SUBAGENT_SPAWN_DRAINING',
  PLACEMENT_KEY_ABSENT: 'P_B_SUBAGENT_SPAWN_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_B_SUBAGENT_SPAWN_PLACEMENT_KEY_MOVED',
})
const CODES = A5_B_SUBAGENT_SPAWN_CODES

/**
 * The dimensions this adapter can NEVER serve through its seam — carried
 * verbatim on every plan instead of being faked closed.
 */
export const A5_B_SUBAGENT_SPAWN_NAMED_GAPS = Object.freeze({
  PRE_SPAWN_CLOSED_WORLD: 'THE PRE-SPAWN CLOSED WORLD IS A CENTER OBLIGATION THIS SEAM CANNOT EXPRESS (contract §B-SUBAGENT: P child创建前安装同一CENTER closed world，不能先spawn再补Guard; census existing entry path agent-bindings.mjs, createTeamAgent route per the contract E2 anchor): WHICH governed services a child receives is minted by CENTER before the child starts, not by this row; the body carries maxDepth (runtimeCtx.subagents.resolveMaxDepth), persona/toolFilter from plugin Config and the provider capability asserts — the row verifies NONE of the child\'s installed governance and claims none. C2\'s 未安装治理child不得启动 obligation belongs to the CENTER pre-spawn install plus the paired Host acceptance, NOT to this row.',
  PROVIDER_ENVELOPE: 'EXTERNAL PROVIDER REALITY (records 41/42: 真实外部Codex provider且权限可强制) IS NOT A TOOL-FACE FACT: the codex/claude provider packages register PROVIDERS (their src runs on ctx.subagents + subprocess lanes; measured zero tool registration), and the published mint produces the SAME definition shape for any declared provider (measured). Permission enforceability over the external process (sandbox, secrets, network) rides the provider driver + Host mount; this row cannot observe it, certifies it, or replace the real-provider C2 acceptance with its doubles.',
  FORK_SEED: 'FORK SEEDING (record 40: 真实seed fork, and the contract C3 dimension 冷恢复不可复制fork) IS A PROVIDER/DRIVER FACT (inheritsParentContext wording at the mint; the seeded conversation + cold-recovery non-reproducibility live in the fork driver and the durable Session layer): the row observes only the body answer and the fork wording of the captured face — never whether a seed actually happened.',
  MODEL_ROUTES_FRESHNESS: 'MODEL ROUTE TRUTH (record 43) is captured-policy + LIVE-llm-service INSIDE the body: the policy (allowed routes) is sampled at install time per Session and the provider catalog is read live at execute; the family contract\'s 模型/provider/预算/seed内容摘要 dimensions for the spawn records likewise ride the body + CENTER. The row observes the returned text and claims no freshness.',
  PLAN_ONCE_MEMO: 'PLAN-ONCE IS AN INTERNAL MEMO — AND SPAWN IS NON-IDEMPOTENT: consumedPlans refuses replaying the SAME plan OBJECT with zero delegate entry, but a caller that COPIES the plan fields RE-SPAWNS — a SECOND CHILD is created (the spec pins this boundary). There is NO idempotency carrier at this seam (no requestToken; a spawn has no pre-child identity to dedupe); the real one-shot consumedProof is the CENTER PA wiring edge. The row never claims once-closure.',
})

const DRAIN_SEMANTICS = 'drain = NEW-CALL PROHIBITION: an accepted spawn (created child, accepted inbox entry, started job) stays committed; drain settles nothing and cancels no child'

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

/** L4 (measured law @ index.ts:473-476): the four SPAWN bodies THROW these
 *  exact bytes when exec.agent is falsy. list_subagent_models has NO such
 *  law (measured pure read) and gets none here. */
const missingCallerThrow = () => new Error('subagent tool requires a calling agent (exec.agent was undefined)')

const refuseAssembly = (code, message) => deepFreeze({ ok: false, code, message })

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-b-subagent-spawn ${String(refusal?.code ?? CODES.INPUT_INVALID)} — ${String(refusal?.detail ?? 'the adapter refused without a detail')}`)
  error.code = refusal?.code
  error.spawnRefusal = deepFreeze({ ...refusal })
  return error
}

/**
 * Assembly-time factory for the five B-SUBAGENT spawn-side rows (DELEGATION
 * mode: every row dispatches to the SAME captured native execute).
 *
 * @param input {{
 *   providerId?: string,
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *   liveNative: (name: string) => unknown,
 *   spawnDelegates: Record<string, Function>,   // name -> the CAPTURED execute (L3 pairing)
 *   liveSpawnDelegates: () => unknown,          // REQUIRED re-read (L3)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   admit: (ctx: object) => Promise<{ ok: boolean, code?: string, detail?: string }>,
 *   observe?: (row: unknown) => void,
 * }} input
 * @returns a frozen `{ ok: true, assembly }` or a frozen `{ ok: false, code, message }`.
 */
export function createSubagentSpawnAdapterAssembly(input = {}) {
  if (!isRecord(input)) return refuseAssembly(CODES.INPUT_INVALID, 'the factory takes one input record')
  const knownInput = new Set(['providerId', 'captured', 'liveNative', 'spawnDelegates', 'liveSpawnDelegates', 'placementFeed', 'admit', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(CODES.INPUT_INVALID, `unknown input '${key}' — the factory takes exactly {providerId, captured, liveNative, spawnDelegates, liveSpawnDelegates, placementFeed, admit, observe}`)
    }
  }
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'b-subagent-spawn'
  if (typeof input.placementFeed !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition, never a hand-spelled string (the settled registration law)')
  }
  if (typeof input.admit !== 'function') {
    return refuseAssembly(CODES.ADMISSION_ABSENT, 'admit is REQUIRED — this module ships NO unadmitted path to the subagent service (the plane\'s PA walk occupies this seam at integration; L10)')
  }
  const delegatesIn = input.spawnDelegates
  if (!isRecord(delegatesIn)) {
    return refuseAssembly(CODES.DELEGATES_ABSENT, 'spawnDelegates is REQUIRED — the {name -> captured native execute} delegation set (production: the SAME functions the capture recorded); this adapter holds no spawn implementation')
  }
  if (typeof input.liveSpawnDelegates !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'liveSpawnDelegates () => the CURRENT delegates object is REQUIRED — the per-dispatch edge re-verifies the bound set; a bind-time constant compared against itself proves nothing (sibling root ② law)')
  }
  if (input.liveSpawnDelegates() !== delegatesIn) {
    return refuseAssembly(CODES.DELEGATE_DRIFT, 'liveSpawnDelegates() does not answer the bound spawnDelegates — the mount is already split between two delegation sets; refuse at assembly, never dispatch into a split mount')
  }
  const capturedIn = input.captured ?? {}
  if (!isRecord(capturedIn)) return refuseAssembly(CODES.INPUT_INVALID, 'captured must be a record (name -> {native, definitionIdentity}) or absent')
  for (const key of Object.keys(capturedIn)) {
    if (!Object.prototype.hasOwnProperty.call(A5_B_SUBAGENT_SPAWN_RECORD_SPECS, key)) {
      return refuseAssembly(CODES.NON_FAMILY_CAPTURE, `'${key}' is not a B-SUBAGENT spawn-side record (this module is exactly ${A5_B_SUBAGENT_SPAWN_TOOL_NAMES.join(', ')} — the control trio 44/45/46 is the sibling subagent-adapters module); another family's or provider's face never rides this module`)
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
    // L3 PAIRING: the delegate must BE the captured native execute. A second
    // build behind a stale capture (rebuilt plugin instance) is refused at
    // assembly, not discovered at the first child.
    if (typeof delegatesIn[key] !== 'function') {
      return refuseAssembly(CODES.DELEGATE_METHOD_ABSENT, `spawnDelegates has no function for captured '${key}' — a partial delegation set is a config defect, never a degraded row`)
    }
    if (delegatesIn[key] !== native.execute) {
      return refuseAssembly(CODES.DELEGATE_SET_SPLIT, `spawnDelegates.${key} is NOT the captured native execute — delegating to a rebuilt set behind a stale capture is exactly the split the family gate measures (L3)`)
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
    observe({ event: 'b-subagent-spawn:refusal', name, code })
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
    const current = input.liveSpawnDelegates()
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
    const spec = A5_B_SUBAGENT_SPAWN_RECORD_SPECS[name]
    const def = capture.native
    const descriptionBytes = def.description
    const parameters = def.parameters === undefined ? Object.freeze({}) : def.parameters
    const row = {
      name,
      familyId: A5_B_SUBAGENT_SPAWN_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: spec.mountCondition,
      active: true,
      capturePresent: true,
      description: descriptionBytes,
      parameters,
      outputSchema: def.output.schema,
      definitionIdentity: capture.definitionIdentity,
      effectDelta: A5_B_SUBAGENT_SPAWN_EFFECT_LABELS[name],
      namedGaps: A5_B_SUBAGENT_SPAWN_NAMED_GAPS,
      classify: (rawArgs) => classify(row, rawArgs),
      delegate: (plan, ctx) => delegate(row, plan, ctx),
    }
    boundOf.set(row, Object.freeze({ def, descriptionBytes, parametersCanonical: canonicalJson(parameters), execute: def.execute, delegates: delegatesIn }))
    return row
  }

  /** Contract §B-SUBAGENT target facts every plan carries. */
  const mintTarget = (name) => Object.freeze({
    contract: 'M0-B-FAMILY-TARGET-CONTRACTS §B-SUBAGENT — 目标I+S(parent member+child instance,spawn/fork/message/interrupt/read/model-list) — THIS ROW: the SPAWN/FORK/READ face of the family (the control trio is the sibling module)',
    parent: 'the LIVE exec.agent reference at dispatch (identity by reference, per-call; the spawn bodies put this reference INTO the durable spawn request as the child owner — the row never binds or trusts an id string)',
    child: name === 'list_subagent_models'
      ? Object.freeze({ claim: null, adjudication: 'no child addressed (model-routes-read)' })
      : Object.freeze({
          claim: null,
          adjudication: 'the child is a NEW identity the SERVICE mints at start/acceptance (subagentId/jobId/runId in the body answer); which governed services the child receives is the CENTER PRE-SPAWN closed world (NAMED GAP PRE_SPAWN_CLOSED_WORLD) — never decided here',
        }),
    action: A5_B_SUBAGENT_SPAWN_RECORD_SPECS[name].operation,
    revision: 'no revision carrier at this seam — a spawn is NON-IDEMPOTENT by nature (NAMED GAP PLAN_ONCE_MEMO); the body answer carries the minted child/job/run identity as the SERVICE records it',
    effect: A5_B_SUBAGENT_SPAWN_EFFECT_LABELS[name],
    model: name === 'list_subagent_models'
      ? 'the read itself: provider ids/advertised models/efforts from the captured policy + the LIVE llm service INSIDE the body (NAMED GAP MODEL_ROUTES_FRESHNESS)'
      : '模型/provider/预算/最大深度/seed内容摘要/工作区/新child权限上限 are resolved INSIDE the body (Config agentOptions/persona/toolFilter/maxDepth + the route preflight against the llm service) — the row mirrors NONE of them and claims none',
    depth: name === 'list_subagent_models' ? 'n/a (read)' : 'maxDepth is resolved by the body via ctx.subagents.resolveMaxDepth from the plugin Config — a SERVICE/CENTER dimension, not a row law',
  })

  /** L5 helper: dispatcher-shape mirror — a present-but-wrong-typed
   *  optional string (the real dispatcher schema stops these pre-body). */
  const optionalStringViolation = (args, field) => args[field] !== undefined && typeof args[field] !== 'string'

  /** L8 classify — pure over the arguments (L5 thin mirror). */
  const classify = (row, rawArgs) => {
    if (state.draining) {
      return refuseWith(row.name, CODES.DRAINING, `${row.name}: draining — new calls are refused (${DRAIN_SEMANTICS})`)
    }
    if (rawArgs !== undefined && rawArgs !== null && !isRecord(rawArgs)) {
      return refuseWith(row.name, CODES.INPUT_INVALID, `${row.name}: arguments must be a record (the real dispatcher always hands an object; anything else is a mount anomaly)`)
    }
    const args = rawArgs === undefined || rawArgs === null ? {} : rawArgs
    // L5 thin mirror (REFUSAL class — the dispatcher schema stops these
    // before the body runs; no lane VALUES are invented for BODY/SERVICE
    // laws like the provider/model pairing or the run-mode enum).
    const lawMiss = (detail) => refuseWith(row.name, CODES.INPUT_INVALID, `${row.name}: ${detail}`)
    if (row.name === 'list_subagent_models') {
      if (optionalStringViolation(args, 'provider')) return lawMiss("argument 'provider' must be a string when present (dispatcher-shape mirror)")
      if (optionalStringViolation(args, 'model')) return lawMiss("argument 'model' must be a string when present (dispatcher-shape mirror); the model-requires-provider law is the BODY's")
    } else {
      if (typeof args.description !== 'string' || args.description.length === 0) return lawMiss('description must be a non-empty string (dispatcher-shape mirror of the required schema field)')
      if (typeof args.prompt !== 'string' || args.prompt.length === 0) return lawMiss('prompt must be a non-empty string (dispatcher-shape mirror of the required schema field)')
      for (const field of ['provider', 'model', 'reasoning_effort']) {
        if (optionalStringViolation(args, field)) return lawMiss(`argument '${field}' must be a string when present (dispatcher-shape mirror; the PAIRING/allowed-selection laws are the body's)`)
      }
      if (args.run_in_background !== undefined && typeof args.run_in_background !== 'boolean') return lawMiss('run_in_background must be a boolean when present (dispatcher-shape mirror)')
    }
    const snapshot = deepFreeze(jsonClone(args))
    const plan = deepFreeze({
      rowName: row.name,
      recordIndex: row.recordIndex,
      operation: A5_B_SUBAGENT_SPAWN_RECORD_SPECS[row.name].operation,
      target: mintTarget(row.name),
      args: snapshot,
      parametersFingerprint: `sha256:${sha256(canonicalJson({ name: row.name, args: snapshot }))}`,
      namedGaps: A5_B_SUBAGENT_SPAWN_NAMED_GAPS,
    })
    observe({ event: 'b-subagent-spawn:classified', name: row.name })
    return deepFreeze({ ok: true, plan })
  }

  /** L3/L4/L6/L7/L8 dispatch: DELEGATE to the captured native execute.
   *  `exec` rides BY REFERENCE (the body reads exec.agent / exec.signal). */
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
      return refuseWith(row.name, CODES.ALREADY_DISPATCHED, `${row.name}: this plan OBJECT was already dispatched — INTERNAL MEMO refusal only (NAMED GAP PLAN_ONCE_MEMO): spawn is NON-IDEMPOTENT — a copied plan RE-SPAWNS a second child; there is no idempotency carrier at this seam (L8)`)
    }
    const exec = isRecord(ctx) ? ctx.exec : undefined
    // L4: the byte-identical missing-caller THROW of the four SPAWN bodies
    // (list_subagent_models has no identity law — measured).
    if (row.name !== 'list_subagent_models' && (!isRecord(exec) || !isRecord(exec.agent))) {
      observe({ event: 'b-subagent-spawn:missing-caller-throw', name: row.name })
      throw missingCallerThrow()
    }
    consumedPlans.add(plan)
    state.dispatches += 1
    observe({ event: 'b-subagent-spawn:delegate-call', name: row.name })
    // L6: NO catch — the published body throws (llm unavailable, provider
    // changed mid-preflight, jobs unavailable, aborted signal, stopReason
    // partial output, provider not registered); throws propagate verbatim
    // as tool errors. The delegation uses the edge-VERIFIED handle with the
    // live exec BY REFERENCE (the body reads exec.agent / exec.signal).
    const value = await edge.method.call(edge.delegates, fresh.plan.args, exec)
    observe({ event: 'b-subagent-spawn:dispatched', name: row.name })
    // SHALLOW freeze: the wrapper is ours; the body's answer may carry
    // service-owned objects — the row never freezes the service's own data.
    return Object.freeze({ ok: true, settled: 'delegated', value })
  }

  const buildDeclaredRow = (name, reason, code) => {
    const spec = A5_B_SUBAGENT_SPAWN_RECORD_SPECS[name]
    const refusal = refuse(code, `${name}: honest ${spec.mountCondition} declared row (${reason}) — no captured native face was mounted; every classify/delegate refuses typed with zero delegate entry, zero substitution, no definition, no registration`)
    return Object.freeze({
      name,
      familyId: A5_B_SUBAGENT_SPAWN_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: spec.mountCondition,
      active: false,
      capturePresent: false,
      description: null,
      parameters: null,
      outputSchema: null,
      definitionIdentity: null,
      namedGaps: A5_B_SUBAGENT_SPAWN_NAMED_GAPS,
      classify: () => refusal,
      delegate: () => refusal,
    })
  }

  for (const name of A5_B_SUBAGENT_SPAWN_TOOL_NAMES) {
    const capture = capturedIn[name]
    if (capture === undefined) {
      const row = buildDeclaredRow(name, 'capture-absent', CODES.CAPTURE_ABSENT)
      rows.set(name, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'capture-absent', row }))
      declared.push(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_SUBAGENT_SPAWN_FAMILY_ID, status: 'DECLARED-INACTIVE', reason: 'capture-absent', captureReportedIgnored: false }))
      observe({ event: 'b-subagent-spawn:declared', name, reason: 'capture-absent' })
      continue
    }
    const row = buildActiveRow(name, capture)
    // THE CAPTURED DEFINITION TRAVELS COMPLETE (root 8b4 law): every face
    // rides verbatim BY REFERENCE; ONLY `execute` is replaced.
    const definition = Object.freeze({ ...capture.native, execute: async (args, exec) => {
      const classified = row.classify(args)
      if (classified.ok !== true) throw refusalToThrow(classified)
      const admitted = await input.admit(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_SUBAGENT_SPAWN_FAMILY_ID, classified, exec }))
      if (admitted?.ok !== true) {
        throw refusalToThrow(admitted ?? { code: CODES.ADMISSION_ABSENT, detail: 'the admission seam refused this call' })
      }
      const settled = await row.delegate(classified.plan, { exec })
      if (settled?.ok !== true) throw refusalToThrow(settled)
      return settled.value
    } })
    rows.set(name, Object.freeze({ status: 'ACTIVE', row, definition, captureDefinitionIdentity: capture.definitionIdentity }))
    definitions.push(definition)
    observe({ event: 'b-subagent-spawn:mounted', name, recordIndex: row.recordIndex })
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
      recordIndex: A5_B_SUBAGENT_SPAWN_RECORD_SPECS[definition.name].recordIndex,
      definitionIdentity: key,
      entry: Object.freeze({
        familyId: A5_B_SUBAGENT_SPAWN_FAMILY_ID,
        adapterRevision: A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const rowsView = Object.freeze(Object.fromEntries([...rows.entries()]))
  const assembly = Object.freeze({
    ok: true,
    familyId: A5_B_SUBAGENT_SPAWN_FAMILY_ID,
    revision: A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION,
    providerId,
    subset: 'records 39-43 (spawn side; DELEGATION mode — rows dispatch to the captured published bodies); the control trio 44/45/46 is the sibling subagent-adapters module',
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    definitions: Object.freeze(definitions),
    rows: rowsView,
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name)?.row,
    /** L9: new-call prohibition ONLY. */
    drain: () => {
      state.draining = true
      return deepFreeze({ event: 'b-subagent-spawn:drain', semantics: DRAIN_SEMANTICS })
    },
    inFlight: () => deepFreeze({ dispatches: state.dispatches, refuses: state.refuses }),
    familyRegistrations,
  })
  return assembly
}
