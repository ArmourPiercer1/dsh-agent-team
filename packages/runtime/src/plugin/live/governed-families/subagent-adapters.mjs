/**
 * governed-families/subagent-adapters.mjs — A5-M2 governed-adapter rows for
 * the INDEPENDENTLY ANSWERABLE control trio of census family B-SUBAGENT:
 * record 44 interrupt_agent / 45 list_agents / 46 send_message (frozen
 * dispatch index M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json; family law
 * M0-B-FAMILY-TARGET-CONTRACTS.md §B-SUBAGENT). UNWIRED by ruling: NOTHING
 * here registers or mounts anything; the PAIRED registration writer feeds
 * `familyRegistrations()` entries at the mount moment exactly as the
 * B-SCHEDULE/B-TEAM families do (schedule-adapters.mjs is the settled house
 * style; registration keys stay placement-feed minted, never hand-spelled).
 *
 * ── THE SUBSET BOUNDARY (root 17:51 ruling, stated up front) ──────────────
 * The census family B-SUBAGENT spans records 39–46 (subagent / subagent_fork
 * / subagent_codex / subagent_claude_code / list_subagent_models + this
 * control trio). The SPAWN side (39–43) is NOT developed here and CANNOT be
 * honestly adapted at this seam: the contract law "P child 创建前安装同一
 * CENTER closed world，不能先 spawn 再补 Guard" is a pre-spawn CENTER
 * obligation (existing entry path agent-bindings.mjs, createTeamAgent
 * route), the external codex/claude envelopes are provider-mount
 * dimensions, and the trio bodies never spawn anything — they only reach
 * ALREADY-EXISTING children through `ctx.subagents`. NAMED GAP
 * SPAWN_SIDE_CLOSED_WORLD carries records 39–43 forward with exactly that
 * boundary; this module is the trio (44/45/46), nothing more, and its
 * familyRegistrations() entries carry recordIndex so the paired writer
 * registers ONLY these three.
 *
 * ── NATIVE-FACE LEDGER (comment-side ONLY: a string literal IS an edge to
 * the audit, so these path facts never live in values) ─────────────────────
 * send_message    HOST pkg dsh-tool-subagent-control, subagent/tool-subagent-control/src/index.ts: register @:28 of defineTool, wrapped by markAdjacentAgentSendMessageTool (dsh-subagent internal); body: sender = exec.agent — FALSY → THROW Error('send_message requires a calling agent (exec.agent was undefined)'); message = [{type:'text', text: args.message}]; messageId = await ctx.subagents.sendMessage(sender, brandString(args.agent_id), message, { signal: exec.signal }); return { messageId }. No catch — service errors propagate as tool errors.
 * interrupt_agent same file: register @:74; body: caller = exec.agent — FALSY → THROW Error('interrupt_agent requires a calling agent (exec.agent was undefined)') ("Ancestor authority requires an exact live calling agent"); ctx.subagents.interrupt(brandString(args.agent_id), { kind:'ancestor', agent: caller }); returns Promise.resolve({ accepted: true }) — FIRE-AND-FORGET: the call answers REQUEST-ACCEPTED, not a stopped turn, not a destroyed child (the ledger law: the service authorizes the exact live caller against the target's RECORDED LINEAGE; the tool adds no authority of its own).
 * list_agents     same pkg list-agents.ts: register @:86; body: parent = exec.agent — FALSY → THROW Error('list_agents requires a calling agent (exec.agent was undefined)'); scope = args.scope ?? 'children' (closed enum children|descendants, dispatcher schema-validated); children → await ctx.subagents.listChildren(parent.id, exec.signal); descendants → await ctx.subagents.listDescendants(parent.id, exec.signal); projection (project/statusOf): diagnostic rows pass through {kind,id,reason,parent?,depth?}; NON-continuable (one-shot) rows are OMITTED (send_message can never continue them); child rows {kind:'child', id, label, status: agents.get(id)?.status === 'running' ? 'running' : 'inactive', parent?, depth?} — the live Agent registry (ctx.agents) answers status per row WITHOUT exposing load state.
 * service face    HOST pkg dsh-subagent lib types: sendMessage(sender: Agent, targetId: SessionId, content: ContentBlock[], options:{signal?}): Promise<MessageId>; interrupt(targetSessionId: SessionId, authority: {kind:'ancestor', agent: Agent}): void; listChildren(parentSessionId, signal?): Promise<SubagentCatalogEntry[]>; listDescendants(rootSessionId, signal?): Promise<SubagentDescendantListEntry[]>. The host bodies resolve ctx.subagents and ctx.agents AFRESH at every call (closure over ctx, property read per call) — the row therefore re-reads BOTH live feeds per dispatch (sibling root ② law).
 * marker          HOST pkg dsh-subagent, subagent/src/internal.ts: adjacentAgentSendMessageTool = Symbol.for('dsh.subagent.adjacentAgentSendMessageTool') — PROCESS-STABLE IDENTITY carried by the STANDARD adjacent-Agent messaging tool ONLY; mark = Object.defineProperty(definition, symbol, { value: true }) — NON-ENUMERABLE. MEASURED CONSEQUENCE: an object spread of a marked definition DROPS the mark — a placed definition that re-spreads the capture would silently BREAK the continuation-delivery check (continuation.ts consults the predicate on the REGISTERED tool). This assembly therefore REQUIRES the injected predicate + marker pair and RE-MARKS the placed send_message definition (L3b); the spec pins the measured facts (mark non-enumerable, bare spread loses it, re-mark restores it).
 * non-recognition contract §B-SUBAGENT: exact host-provider identity must NEVER cross-certify with the upstream experimental Team same-name trio (packages/experimental/tool-agent-team registers same-named tools); for send_message the marker gate ENFORCES this at assembly (a same-name unmarked capture is refused); for interrupt_agent/list_agents no marker exists — non-recognition rides the placement-feed's realm identity (the registration key is minted for the PLACED definition of THIS provider's mount), never name equality.
 * registration   the lane binds these trio tools for its members through agent-bindings (CENTER-owned paths); this module registers nothing (L11).
 *
 * ── LAW INDEX ──────────────────────────────────────────────────────────────
 *  L1 HONEST DECLARED ROWS: mountCondition `always` for all three records —
 *     the only activation gate is a COMPLETE capture (real registration
 *     minimum-entry shape: name/description/output{schema,render}/execute/
 *     definitionIdentity); an absent capture leaves an honest
 *     DECLARED-INACTIVE row; a half-capture is an ASSEMBLY refusal.
 *  L2 ONLY EXECUTE IS REPLACED (root 8b4 law): every captured face rides the
 *     placed definition verbatim BY REFERENCE (description, compiled
 *     parameters, output{schema,render}); ONLY `execute` is replaced.
 *  L3 LIVE SERVICE RE-READ (sibling root ② law): the bodies resolve
 *     ctx.subagents and ctx.agents per call — the row re-reads the REQUIRED
 *     liveSubagentService() and liveAgentsRegistry() feeds at EVERY dispatch
 *     edge; a replaced object or rebound method is PORT_DRIFT with zero
 *     service entry; split mounts refuse at assembly. THE VERIFIED HANDLES
 *     ARE THE INVOKED HANDLES: the edge returns the verified {port, registry,
 *     methods} and the dispatch uses exactly those — no second, unverified
 *     feed read exists between verification and invocation; the
 *     parameters compare base is a BIND-TIME canonical snapshot, never the
 *     live shared reference (settled house law from the B-TEAM review).
 *  L3b MARKER GATE + RE-MARK (measured): the send_message capture MUST pass
 *     the injected REAL predicate isAdjacentAgentSendMessageTool (a
 *     same-name foreign tool — e.g. the experimental Team trio — fails:
 *     NON_HOST_SEND_MESSAGE); the placed definition is re-marked through
 *     the injected REAL marker, because the spread provably drops the
 *     non-enumerable symbol mark. Both functions are REQUIRED inputs; the
 *     module imports nothing (the symbol identity lives in the injected
 *     pair, never in a hand-copied byte).
 *  L4 LIVE CALLER IDENTITY, THROWN LIKE THE HOST: the trio NEVER binds an
 *     Agent at register time — identity is `exec.agent` PER CALL, and the
 *     service authorizes the exact live reference against the recorded
 *     lineage. The row mirrors each body's own missing-caller THROW with
 *     the byte-identical message (zero service entry) and forwards the
 *     SAME Agent reference to the service — never a reconstructed or
 *     id-paired stand-in. Contrast B-SCHEDULE (register-time bound Agent →
 *     internal_error VALUE): the trio's refusal class is a THROW, exactly
 *     as the published bodies throw.
 *  L5 THIN ARGUMENT MIRROR, REFUSAL CLASS: beyond the record check the row
 *     mirrors only what the dispatcher schema already enforces BEFORE the
 *     body runs (agent_id non-empty string; message non-empty string;
 *     scope ∈ {absent, children, descendants}) — as typed REFUSALS (a
 *     mount anomaly the lane dispatcher would have stopped), never as
 *     invented lane VALUES: the trio bodies answer NO typed argument
 *     VALUES of their own (no ScheduleInputError class, no TeamToolArgs
 *     class here), and inventing one would be duck-law. The SERVICE keeps
 *     every real adjudication (unknown target, lineage deny, cross-owner).
 *  L6 NO ERROR MAP: the bodies never catch; the row catches NOTHING —
 *     service throws propagate verbatim as tool errors (no value
 *     fabrication, root ③ spirit; no published error class exists for this
 *     service face — measured: none exported for these paths).
 *  L7 PER-DISPATCH EDGE RE-VERIFY: liveNative(name) must answer the bound
 *     definition OBJECT with unchanged description bytes, compiled
 *     parameters, and execute function; the live service/registry feeds
 *     must answer the bound objects with the frozen method references. Any
 *     drift refuses typed with ZERO service entry — no replacement-body
 *     path, no native fallback.
 *  L8 PLAN MEMO, RUN THE FRESH PLAN (root ④ boundary stated honestly):
 *     classify freezes {args snapshot, operation, target,
 *     parametersFingerprint}; delegate re-derives classify on the snapshot,
 *     requires an equal fingerprint, refuses foreign/stale plans and a
 *     REPLAY OF THE SAME CONSUMED PLAN OBJECT with zero service entry — an
 *     INTERNAL MEMO, NOT the one-shot ledger (NAMED GAP PLAN_ONCE_MEMO).
 *     The row mints no consumedProof; delivery idempotency (messageId)
 *     belongs to the service.
 *  L9 DRAIN = NEW-CALL PROHIBITION ONLY: a committed delivery or interrupt
 *     request stays committed; drain settles nothing.
 *  L10 NO UNADMITTED PATH: `admit` is REQUIRED — every placed definition
 *     runs classify → admit → dispatch; any refusal throws with the
 *     refusing side's OWN typed bytes and zero service entry. The plane's
 *     PA walk occupies the seat; this module performs no PA walk.
 *  L11 UNWIRED: registration keys come ONLY from the placement feed at the
 *     mount moment (PLACEMENT_KEY_ABSENT / PLACEMENT_KEY_MOVED throw;
 *     nothing guesses, nothing silently skips); the PAIRED registration
 *     writer feeds familyRegistrations() entries to registerA5GovernedFamily.
 *
 * NAMED GAPS — see A5_B_SUBAGENT_NAMED_GAPS below; carried verbatim on
 * every plan, never faked closed.
 *
 * Windows dimensions: NOT RUN on this Linux harness, never claimed.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/subagent-adapters
 */
import { createHash } from 'node:crypto'

/** Census family (records 44/45/46 — the independently answerable trio). */
export const A5_B_SUBAGENT_FAMILY_ID = 'B-SUBAGENT'
export const A5_B_SUBAGENT_ADAPTER_REVISION = 1
/** Frozen mount condition of the three records (always). */
export const A5_B_SUBAGENT_MOUNT_CONDITION = 'always'

/** The three records: census recordIndex + the row's closed operation. */
export const A5_B_SUBAGENT_RECORD_SPECS = Object.freeze({
  interrupt_agent: Object.freeze({ recordIndex: 44, operation: 'subagent-interrupt' }),
  list_agents: Object.freeze({ recordIndex: 45, operation: 'subagent-list' }),
  send_message: Object.freeze({ recordIndex: 46, operation: 'subagent-send-message' }),
})
export const A5_B_SUBAGENT_TOOL_NAMES = Object.freeze(['interrupt_agent', 'list_agents', 'send_message'])

/**
 * THE PORT LAW — the published SubagentService methods the three captured
 * host bodies call (see the ledger). Arity/signature are the whole
 * value-side fact; every path citation lives in the comment ledger only.
 * The port OBJECT is injected (production: the live ctx.subagents); this
 * module holds no implementation of any of it. The remote faces
 * (interruptByParent etc.) are NOT part of this trio's seam and are never
 * called by these rows.
 */
export const A5_B_SUBAGENT_SERVICE_METHODS = Object.freeze({
  sendMessage: Object.freeze({ arity: 4, signature: 'sendMessage(sender, targetId, content, options): Promise<MessageId>' }),
  interrupt: Object.freeze({ arity: 2, signature: 'interrupt(targetSessionId, authority): void (fire-and-forget)' }),
  listChildren: Object.freeze({ arity: 2, signature: 'listChildren(parentSessionId, signal?): Promise<SubagentCatalogEntry[]>' }),
  listDescendants: Object.freeze({ arity: 2, signature: 'listDescendants(rootSessionId, signal?): Promise<SubagentDescendantListEntry[]>' }),
})

/** The census effect deltas (records 44/45/46, recordEffectDeltaFromInventory)
 *  with where each OBSERVABLE fact stops at this seam. */
export const A5_B_SUBAGENT_EFFECT_LABELS = Object.freeze({
  interrupt_agent: 'I + S(cancel-target-child-turn): the row observes ONLY the fire-and-forget REQUEST acceptance ({accepted:true} = accepted, NOT stopped, NOT destroyed — census: 停止准确所属child当前turn；不得误称销毁); child-resource evidence and turn convergence are NOT observable at this seam',
  list_agents: 'S(registry-read): the durable child catalog through the service projection + the live Agent-registry status read; the row claims nothing beyond the projected answer',
  send_message: 'I + S(message-inject-into-child-agent): the row observes ONLY the service-ack messageId; the durable delivery, continuation semantics and resource budget ride INSIDE the service (census: send不是仅内存write — the ACK is the seam-visible fact, not the whole obligation)',
})

/** Typed refusal codes OWNED by this module (closed set). */
export const A5_B_SUBAGENT_CODES = Object.freeze({
  INPUT_INVALID: 'P_B_SUBAGENT_INPUT_INVALID',
  CAPTURE_ABSENT: 'P_B_SUBAGENT_CAPTURE_ABSENT',
  CAPTURE_INCOMPLETE: 'P_B_SUBAGENT_CAPTURE_INCOMPLETE',
  NON_FAMILY_CAPTURE: 'P_B_SUBAGENT_NON_FAMILY_CAPTURE',
  NON_HOST_SEND_MESSAGE: 'P_B_SUBAGENT_NON_HOST_SEND_MESSAGE',
  LIVE_NATIVE_ABSENT: 'P_B_SUBAGENT_LIVE_NATIVE_ABSENT',
  PORT_ABSENT: 'P_B_SUBAGENT_PORT_ABSENT',
  PORT_METHOD_ABSENT: 'P_B_SUBAGENT_PORT_METHOD_ABSENT',
  PORT_DRIFT: 'P_B_SUBAGENT_PORT_DRIFT',
  DEFINITION_DRIFT: 'P_B_SUBAGENT_DEFINITION_DRIFT',
  MARKER_ABSENT: 'P_B_SUBAGENT_MARKER_ABSENT',
  ADMISSION_ABSENT: 'P_B_SUBAGENT_ADMISSION_ABSENT',
  NOT_OWN_PLAN: 'P_B_SUBAGENT_NOT_OWN_PLAN',
  PLAN_STALE: 'P_B_SUBAGENT_PLAN_STALE',
  ALREADY_DISPATCHED: 'P_B_SUBAGENT_ALREADY_DISPATCHED',
  DRAINING: 'P_B_SUBAGENT_DRAINING',
  PLACEMENT_KEY_ABSENT: 'P_B_SUBAGENT_PLACEMENT_KEY_ABSENT',
  PLACEMENT_KEY_MOVED: 'P_B_SUBAGENT_PLACEMENT_KEY_MOVED',
})
const CODES = A5_B_SUBAGENT_CODES

/**
 * The dimensions this adapter can NEVER serve through its seam — carried
 * verbatim on every plan instead of being faked closed.
 */
export const A5_B_SUBAGENT_NAMED_GAPS = Object.freeze({
  SPAWN_SIDE_CLOSED_WORLD: 'SPAWN SIDE (census records 39–43: subagent / subagent_fork / subagent_codex / subagent_claude_code / list_subagent_models) IS NOT COVERED HERE and cannot be honestly adapted at this seam: the contract law P child创建前安装同一CENTER closed world，不能先spawn再补Guard is a PRE-SPAWN CENTER obligation (existing entry path agent-bindings createTeamAgent route), the external codex/claude envelopes are provider-mount dimensions ("不能把外部模型当已治理native工具"), and NOTHING in this trio spawns — its three bodies reach ONLY ALREADY-EXISTING children through ctx.subagents. The family C2 dimension 未安装治理child不得启动 is therefore NOT observable, NOT claimed, and NOT weakened by this subset landing.',
  LINEAGE_AUTHORITY: 'PARENT-CHILD RELATION AND CROSS-OWNER DENY ARE SERVICE-SIDE FACTS (measured): the published bodies ADD NO AUTHORITY OF THEIR OWN — send passes the caller as the SENDER reference and interrupt hands {kind:\'ancestor\', agent: caller} for the SERVICE to authorize against the target\'s recorded lineage; list scopes by the caller\'s session id. The row forwards the SAME live exec.agent reference and adjudicates nothing: a cross-owner message/interrupt is refused by the SERVICE (the exact denial surface is not observable at this seam — C2\'s 跨owner拒 obligation lives with the service, not this row).',
  INTERRUPT_COMPLETION: 'INTERRUPT IS FIRE-AND-FORGET: {accepted:true} is REQUEST ACCEPTANCE — not a stopped turn, not drained descendants, not a destroyed child (census 44: 不得误称销毁; the published description says the call returns WITHOUT waiting, deeper children keep running). Awaiting child resource evidence (C3) is not observable at this seam and is never reported.',
  DELIVERY_CONTINUATION: 'SEND IS NOT AN IN-MEMORY WRITE — and the row sees only its ACK: the messageId is the service acceptance; durable delivery, the continuation/liveness semantics (the marked standard tool participates in the continuation-delivery check), and the resource-budget implication of a waking send ride INSIDE the service. The row never restates them.',
  PLAN_ONCE_MEMO: 'PLAN-ONCE IS AN INTERNAL MEMO, NOT THE ONE-SHOT LEDGER (root ④): consumedPlans refuses replaying the SAME plan OBJECT with zero service entry; a caller that COPIES a plan\'s fields re-dispatches (the fingerprint law re-runs the whole law on the copy). Delivery idempotency is the SERVICE\'s (messageId semantics); the real one-shot consumedProof is the CENTER PA wiring edge. This row mints neither and never claims once-closure.',
  UPSTREAM_NON_RECOGNITION: 'FAMILY IDENTITY NEVER CROSSES PROVIDERS (contract: exact host-provider身份不得与上游实验Team同名trio互认): packages/experimental/tool-agent-team registers SAME-NAMED tools; for send_message the assembly marker gate ENFORCES non-recognition (an unmarked same-name capture is refused NON_HOST_SEND_MESSAGE); for interrupt_agent/list_agents no marker exists in the published face — non-recognition rides the placement feed\'s realm identity for THIS mount\'s placed definitions, never name equality. A row here is only ever the host-provider identity of the mount that fed the capture.',
})

const DRAIN_SEMANTICS = 'drain = NEW-CALL PROHIBITION: a committed delivery (messageId), an accepted interrupt request, or a listed projection stays as it is; drain settles nothing, cancels nothing, revives nothing'

/* ── small internal primitives (sibling house) ───────────────────────── */

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
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

/** L4 (measured law): the three published bodies THROW these exact bytes
 *  when exec.agent is falsy. The row mirrors the THROW (contrast the
 *  B-SCHEDULE bound-owner internal_error VALUE — different published
 *  refusal class, byte-for-byte preserved per body). */
const missingCallerThrow = (name) => new Error(`${name} requires a calling agent (exec.agent was undefined)`)

/** The list projection mirror (list-agents.ts project/statusOf, verbatim
 *  semantics): diagnostic passes, NON-continuable rows are OMITTED, child
 *  rows carry the live registry status WITHOUT exposing load state. */
function projectEntry(agents, entry, position) {
  if (!isRecord(entry)) return undefined
  const at = position === undefined ? {} : { parent: position.parentId, depth: position.depth }
  if (entry.kind === 'diagnostic') {
    return { kind: 'diagnostic', id: entry.id, reason: entry.reason, ...at }
  }
  if (entry.mode !== 'continuable') return undefined
  const child = agents.get(entry.id)
  return {
    kind: 'child',
    id: entry.id,
    label: entry.label,
    status: isRecord(child) && child.status === 'running' ? 'running' : 'inactive',
    ...at,
  }
}

/* ── the factory ────────────────────────────────────────────────────── */

const refuseAssembly = (code, message) => deepFreeze({ ok: false, code, message })

const refusalToThrow = (refusal) => {
  const error = new Error(`refused-b-subagent ${String(refusal?.code ?? CODES.INPUT_INVALID)} — ${String(refusal?.detail ?? 'the adapter refused without a detail')}`)
  error.code = refusal?.code
  error.subagentRefusal = deepFreeze({ ...refusal })
  return error
}

/**
 * Assembly-time factory for the three B-SUBAGENT control-trio rows.
 *
 * @param input {{
 *   providerId?: string,
 *   captured?: Record<string, { native: object, definitionIdentity: string }>,
 *   liveNative: (name: string) => unknown,            // REQUIRED re-read
 *   subagentService: object,                          // bound ctx.subagents-shaped port
 *   liveSubagentService: () => unknown,               // REQUIRED per-dispatch re-read (L3)
 *   agentsRegistry: { get(id: unknown): unknown },    // bound ctx.agents-shaped live registry
 *   liveAgentsRegistry: () => unknown,                // REQUIRED per-dispatch re-read (L3)
 *   isAdjacentAgentSendMessageTool: (def: unknown) => boolean, // REQUIRED REAL predicate (L3b)
 *   markAdjacentAgentSendMessageTool: (def: unknown) => unknown, // REQUIRED REAL marker (L3b)
 *   placementFeed: (name: string) => { definitionIdentity?: string, realmId?: string } | undefined,
 *   admit: (ctx: object) => Promise<{ ok: boolean, code?: string, detail?: string }>,
 *   observe?: (row: unknown) => void,
 * }} input
 * @returns a frozen `{ ok: true, assembly }` or a frozen `{ ok: false, code, message }`.
 */
export function createSubagentAdapterAssembly(input = {}) {
  if (!isRecord(input)) return refuseAssembly(CODES.INPUT_INVALID, 'the factory takes one input record')
  const knownInput = new Set(['providerId', 'captured', 'liveNative', 'subagentService', 'liveSubagentService', 'agentsRegistry', 'liveAgentsRegistry', 'isAdjacentAgentSendMessageTool', 'markAdjacentAgentSendMessageTool', 'placementFeed', 'admit', 'observe'])
  for (const key of Object.keys(input)) {
    if (!knownInput.has(key)) {
      return refuseAssembly(CODES.INPUT_INVALID, `unknown input '${key}' — the factory takes exactly {providerId, captured, liveNative, subagentService, liveSubagentService, agentsRegistry, liveAgentsRegistry, isAdjacentAgentSendMessageTool, markAdjacentAgentSendMessageTool, placementFeed, admit, observe}`)
    }
  }
  const providerId = typeof input.providerId === 'string' && input.providerId.length > 0 ? input.providerId : 'b-subagent'
  if (typeof input.placementFeed !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'placementFeed (name) => {definitionIdentity, realmId} | undefined is REQUIRED — the family key is the runtime identity the seam minted for the PLACED definition, never a hand-spelled string (the settled registration law)')
  }
  if (typeof input.admit !== 'function') {
    return refuseAssembly(CODES.ADMISSION_ABSENT, 'admit is REQUIRED — this module ships NO unadmitted path to the subagent service (the plane\'s PA walk occupies this seam at integration; L10)')
  }
  if (typeof input.liveSubagentService !== 'function' || typeof input.liveAgentsRegistry !== 'function') {
    return refuseAssembly(CODES.INPUT_INVALID, 'liveSubagentService () => ctx.subagents AND liveAgentsRegistry () => ctx.agents are REQUIRED — the published bodies resolve BOTH afresh at every call, so every dispatch re-reads the CURRENT objects; a bind-time constant compared against itself proves nothing (sibling root ② law)')
  }
  if (typeof input.isAdjacentAgentSendMessageTool !== 'function' || typeof input.markAdjacentAgentSendMessageTool !== 'function') {
    return refuseAssembly(CODES.MARKER_ABSENT, 'isAdjacentAgentSendMessageTool + markAdjacentAgentSendMessageTool are REQUIRED as the REAL pair from dsh-subagent/internal (injected — this module imports nothing): the predicate gates the send_message capture against same-name foreign tools (experimental Team trio non-recognition), and the marker MUST re-apply the standard-tool identity to the PLACED definition — an object spread provably DROPS the non-enumerable symbol mark, and an unmarked registered send_message silently breaks the continuation-delivery check (L3b, measured)')
  }
  const service = input.subagentService
  if (!isRecord(service)) {
    return refuseAssembly(CODES.PORT_ABSENT, 'subagentService is REQUIRED — the ctx.subagents-shaped REAL-SERVICE port (production: the live ctx.subagents); this adapter holds no subagent implementation')
  }
  if (input.liveSubagentService() !== service) {
    return refuseAssembly(CODES.PORT_DRIFT, 'liveSubagentService() does not answer the bound subagentService — the mount is already split between two service objects; refuse at assembly, never dispatch into a split mount')
  }
  const registry = input.agentsRegistry
  if (!isRecord(registry) || typeof registry.get !== 'function') {
    return refuseAssembly(CODES.PORT_ABSENT, 'agentsRegistry { get(id) } is REQUIRED — the ctx.agents-shaped live Agent registry the list projection reads per row (status WITHOUT exposing load state)')
  }
  if (input.liveAgentsRegistry() !== registry) {
    return refuseAssembly(CODES.PORT_DRIFT, 'liveAgentsRegistry() does not answer the bound agentsRegistry — split live registry; refuse at assembly')
  }
  const frozenPortMethods = {}
  for (const method of Object.keys(A5_B_SUBAGENT_SERVICE_METHODS)) {
    if (typeof service[method] !== 'function') {
      return refuseAssembly(CODES.PORT_METHOD_ABSENT, `the port answers no function for published SubagentService method '${method}' (${A5_B_SUBAGENT_SERVICE_METHODS[method].signature}) — a partial port is a config defect, never a degraded row`)
    }
    frozenPortMethods[method] = service[method]
  }
  const isHostSendMessage = input.isAdjacentAgentSendMessageTool
  const markHostSendMessage = input.markAdjacentAgentSendMessageTool
  const observe = typeof input.observe === 'function' ? input.observe : () => {}

  const capturedIn = input.captured ?? {}
  if (!isRecord(capturedIn)) return refuseAssembly(CODES.INPUT_INVALID, 'captured must be a record (name -> {native, definitionIdentity}) or absent')
  for (const key of Object.keys(capturedIn)) {
    if (!Object.prototype.hasOwnProperty.call(A5_B_SUBAGENT_RECORD_SPECS, key)) {
      return refuseAssembly(CODES.NON_FAMILY_CAPTURE, `'${key}' is not a B-SUBAGENT control-trio record (this module is exactly ${A5_B_SUBAGENT_TOOL_NAMES.join(', ')} — the spawn side 39-43 is NOT adapted here, NAMED GAP SPAWN_SIDE_CLOSED_WORLD); another family's or provider's face never rides this module`)
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
    // L3b MARKER GATE: the send_message capture must BE the standard
    // adjacent-Agent messaging tool (the REAL injected predicate decides —
    // the symbol identity never lives in this file).
    if (key === 'send_message' && isHostSendMessage(native) !== true) {
      return refuseAssembly(CODES.NON_HOST_SEND_MESSAGE, 'captured.send_message is NOT the standard adjacent-Agent messaging tool (the injected REAL predicate refused it) — a same-name unmarked tool (e.g. the upstream experimental Team trio) NEVER rides the host-provider B-SUBAGENT identity (contract: exact host-provider身份不得与上游实验Team同名trio互认)')
    }
  }

  const rows = new Map()
  const declared = []
  const definitions = []
  const consumedPlans = new WeakSet()
  const state = { draining: false, dispatches: 0, refuses: 0 }
  const boundOf = new WeakMap()

  const refuseWith = (name, code, detail) => {
    state.refuses += 1
    observe({ event: 'b-subagent:refusal', name, code })
    return refuse(code, detail)
  }

  /** L3/L7 edge integrity: definition bytes + BOTH live service feeds. */
  const edgeIntegrity = (row) => {
    if (state.draining) {
      return refuse(CODES.DRAINING, `${row.name}: draining — new calls are refused, committed effects stay committed (${DRAIN_SEMANTICS})`)
    }
    const bound = boundOf.get(row)
    if (bound === undefined) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: no bind-time binding exists — a row assembled outside this factory dispatches nothing`)
    }
    const live = input.liveNative(row.name)
    if (live !== bound.def) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the face behind liveNative is no longer the captured object — the governed call refuses; there is no replacement-body path and no native fallback`)
    }
    if (live.description !== bound.descriptionBytes || canonicalJson(live.parameters) !== bound.parametersCanonical) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's description or compiled parameter bytes moved since bind time (compared against the BIND-TIME canonical snapshot, not the live shared reference)`)
    }
    if (live.execute !== bound.execute) {
      return refuse(CODES.DEFINITION_DRIFT, `${row.name}: the captured definition's execute function is no longer the bound function value`)
    }
    const current = input.liveSubagentService()
    if (current !== bound.port) {
      return refuse(CODES.PORT_DRIFT, `${row.name}: the CURRENT ctx.subagents read is not the bound port object — the published bodies resolve it afresh per call; a replaced service underneath this mount is drift, full stop (L3)`)
    }
    // THE VERIFIED HANDLES ARE THE INVOKED HANDLES (settled house law from
    // the B-TEAM first review, carried into this family from day one): the
    // port object, the method functions and the live registry verified by
    // THIS read are the exact handles the delegate edge later uses — there
    // is no second, unverified feed read between verification and
    // invocation.
    const methods = {}
    for (const method of row.portMethods) {
      const fn = current[method]
      if (fn !== frozenPortMethods[method]) {
        return refuse(CODES.PORT_DRIFT, `${row.name}: the port method '${method}' was rebound underneath the frozen bind — a rebound service method is drift, full stop`)
      }
      methods[method] = fn
    }
    const currentRegistry = input.liveAgentsRegistry()
    if (currentRegistry !== bound.registry) {
      return refuse(CODES.PORT_DRIFT, `${row.name}: the CURRENT ctx.agents read is not the bound live registry — the list projection reads it per row; a replaced registry is drift (L3)`)
    }
    return Object.freeze({ port: current, registry: currentRegistry, methods: Object.freeze(methods) })
  }

  const buildActiveRow = (name, capture) => {
    const spec = A5_B_SUBAGENT_RECORD_SPECS[name]
    const def = capture.native
    const descriptionBytes = def.description
    const parameters = def.parameters === undefined ? Object.freeze({}) : def.parameters
    const portMethods = name === 'send_message'
      ? Object.freeze(['sendMessage'])
      : name === 'interrupt_agent'
        ? Object.freeze(['interrupt'])
        : Object.freeze(['listChildren', 'listDescendants'])
    const row = {
      name,
      familyId: A5_B_SUBAGENT_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: A5_B_SUBAGENT_MOUNT_CONDITION,
      active: true,
      capturePresent: true,
      description: descriptionBytes,
      parameters,
      outputSchema: def.output.schema,
      definitionIdentity: capture.definitionIdentity,
      effectDelta: A5_B_SUBAGENT_EFFECT_LABELS[name],
      portMethods,
      namedGaps: A5_B_SUBAGENT_NAMED_GAPS,
      classify: (rawArgs) => classify(row, rawArgs),
      delegate: (plan, ctx) => delegate(row, plan, ctx),
    }
    boundOf.set(row, Object.freeze({ def, descriptionBytes, parametersCanonical: canonicalJson(parameters), execute: def.execute, port: service, registry }))
    return row
  }

  /** Contract §B-SUBAGENT target facts every plan carries: I+S(parent
   *  member + child instance, exact operation) — the parent is the LIVE
   *  exec.agent REFERENCE at dispatch (never a string), the child id is a
   *  CLAIM the service adjudicates against recorded lineage. */
  const mintTarget = (name, snapshot) => Object.freeze({
    contract: 'M0-B-FAMILY-TARGET-CONTRACTS §B-SUBAGENT — 目标I+S(parent member+child instance,spawn/fork/message/interrupt/read/model-list) — THIS ROW: message/interrupt/read over an EXISTING child only (spawn side is NAMED GAP SPAWN_SIDE_CLOSED_WORLD)',
    parent: 'the LIVE exec.agent reference at dispatch (identity by reference, per-call; the trio binds no Agent at register time — L4)',
    child: Object.freeze({
      claim: snapshot.agent_id ?? null,
      adjudication: 'the SubagentService authorizes the exact live caller against the target\'s RECORDED LINEAGE (cross-owner/unknown deny is service-side — NAMED GAP LINEAGE_AUTHORITY); the row adjudicates nothing',
    }),
    action: A5_B_SUBAGENT_RECORD_SPECS[name].operation,
    revision: 'no revision carrier at this seam — messageId is the service delivery ACK for send; interrupt answers request-acceptance only; list is read-only (NAMED GAPS DELIVERY_CONTINUATION / INTERRUPT_COMPLETION)',
    effect: A5_B_SUBAGENT_EFFECT_LABELS[name],
    depth: name === 'list_agents'
      ? `scope ${String(snapshot.scope ?? 'children')} — descendants rows carry parent/depth for the caller's own tree; entries deeper than 1 accept only interrupt_agent (published face law, restated here as fact not enforcement)`
      : 'one addressed child instance per call',
    budget: '模型/provider/预算/最大深度/工作区/新child权限上限 are SPAWN/ENVELOPE dimensions (39–43) — invisible and NOT claimed at this seam',
  })

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
    // before the body runs; the trio bodies answer NO typed argument VALUES):
    if (row.name === 'send_message') {
      if (typeof args.agent_id !== 'string' || args.agent_id.length === 0) return refuseWith(row.name, CODES.INPUT_INVALID, 'send_message: agent_id must be a non-empty string (dispatcher-shape mirror; unknown-target adjudication stays the SERVICE\'s)')
      if (typeof args.message !== 'string' || args.message.length === 0) return refuseWith(row.name, CODES.INPUT_INVALID, 'send_message: message must be a non-empty string (dispatcher-shape mirror)')
    } else if (row.name === 'interrupt_agent') {
      if (typeof args.agent_id !== 'string' || args.agent_id.length === 0) return refuseWith(row.name, CODES.INPUT_INVALID, 'interrupt_agent: agent_id must be a non-empty string (dispatcher-shape mirror)')
    } else if (args.scope !== undefined && args.scope !== 'children' && args.scope !== 'descendants') {
      return refuseWith(row.name, CODES.INPUT_INVALID, 'list_agents: scope is the closed enum children | descendants (absent = children) — dispatcher-shape mirror')
    }
    const snapshot = deepFreeze(jsonClone(args))
    const plan = deepFreeze({
      rowName: row.name,
      recordIndex: row.recordIndex,
      operation: A5_B_SUBAGENT_RECORD_SPECS[row.name].operation,
      target: mintTarget(row.name, snapshot),
      args: snapshot,
      parametersFingerprint: `sha256:${sha256(canonicalJson({ name: row.name, args: snapshot }))}`,
      namedGaps: A5_B_SUBAGENT_NAMED_GAPS,
    })
    observe({ event: 'b-subagent:classified', name: row.name })
    return deepFreeze({ ok: true, plan })
  }

  /** L3/L4/L6/L7/L8 dispatch. `exec` is LIVE (agent/signal ride by
   *  reference — the service authorizes the REFERENCE, L4). */
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
      return refuseWith(row.name, CODES.ALREADY_DISPATCHED, `${row.name}: this plan OBJECT was already dispatched — INTERNAL MEMO refusal only (NAMED GAP PLAN_ONCE_MEMO): delivery idempotency is the service's, the real consumedProof the center PA's; the row claims no once-closure (L8/④)`)
    }
    const exec = isRecord(ctx) ? ctx.exec : undefined
    // L4: the byte-identical missing-caller THROW of the published body.
    if (!isRecord(exec) || !isRecord(exec.agent)) {
      observe({ event: 'b-subagent:missing-caller-throw', name: row.name })
      throw missingCallerThrow(row.name)
    }
    consumedPlans.add(plan)
    state.dispatches += 1
    const signal = exec.signal
    // L6: NO catch — the published bodies never catch; service throws
    // propagate verbatim as tool errors. No error class exists to mirror.
    // The invoked handles are the edge-VERIFIED handles (no second feed
    // read between verification and invocation).
    if (row.name === 'send_message') {
      observe({ event: 'b-subagent:port-call', name: row.name, method: 'sendMessage' })
      const messageId = await edge.methods.sendMessage.call(
        edge.port,
        exec.agent,
        fresh.plan.args.agent_id,
        [{ type: 'text', text: fresh.plan.args.message }],
        { signal },
      )
      observe({ event: 'b-subagent:dispatched', name: row.name })
      return Object.freeze({ ok: true, settled: 'service', value: Object.freeze({ messageId }) })
    }
    if (row.name === 'interrupt_agent') {
      observe({ event: 'b-subagent:port-call', name: row.name, method: 'interrupt' })
      // FIRE-AND-FORGET exactly like the body: the authority carries the
      // live caller REFERENCE; nothing is awaited.
      edge.methods.interrupt.call(edge.port, fresh.plan.args.agent_id, { kind: 'ancestor', agent: exec.agent })
      observe({ event: 'b-subagent:dispatched', name: row.name })
      return Object.freeze({ ok: true, settled: 'service', value: Object.freeze({ accepted: true }) })
    }
    const parent = exec.agent
    const scope = fresh.plan.args.scope ?? 'children'
    observe({ event: 'b-subagent:port-call', name: row.name, method: scope === 'descendants' ? 'listDescendants' : 'listChildren' })
    const entries = scope === 'descendants'
      ? await edge.methods.listDescendants.call(edge.port, parent.id, signal)
      : await edge.methods.listChildren.call(edge.port, parent.id, signal)
    const projected = entries
      .map((entry) => projectEntry(edge.registry, entry, scope === 'descendants' ? entry : undefined))
      .filter((entry) => entry !== undefined)
    observe({ event: 'b-subagent:dispatched', name: row.name })
    return Object.freeze({ ok: true, settled: 'service', value: Object.freeze(projected) })
  }

  const buildDeclaredRow = (name, reason, code) => {
    const spec = A5_B_SUBAGENT_RECORD_SPECS[name]
    const refusal = refuse(code, `${name}: honest ${A5_B_SUBAGENT_MOUNT_CONDITION} declared row (${reason}) — no captured native face was mounted; every classify/delegate refuses typed with zero service entry, zero substitution, no definition, no registration`)
    return Object.freeze({
      name,
      familyId: A5_B_SUBAGENT_FAMILY_ID,
      recordIndex: spec.recordIndex,
      mountCondition: A5_B_SUBAGENT_MOUNT_CONDITION,
      active: false,
      capturePresent: false,
      description: null,
      parameters: null,
      outputSchema: null,
      definitionIdentity: null,
      namedGaps: A5_B_SUBAGENT_NAMED_GAPS,
      classify: () => refusal,
      delegate: () => refusal,
    })
  }

  for (const name of A5_B_SUBAGENT_TOOL_NAMES) {
    const capture = capturedIn[name]
    if (capture === undefined) {
      const row = buildDeclaredRow(name, 'capture-absent', CODES.CAPTURE_ABSENT)
      rows.set(name, Object.freeze({ status: 'DECLARED-INACTIVE', reason: 'capture-absent', row }))
      declared.push(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_SUBAGENT_FAMILY_ID, status: 'DECLARED-INACTIVE', reason: 'capture-absent', captureReportedIgnored: false }))
      observe({ event: 'b-subagent:declared', name, reason: 'capture-absent' })
      continue
    }
    const row = buildActiveRow(name, capture)
    // THE CAPTURED DEFINITION TRAVELS COMPLETE (root 8b4 law): every face
    // rides verbatim BY REFERENCE; ONLY `execute` is replaced. The
    // send_message PLACED definition is RE-MARKED (L3b: spread drops the
    // non-enumerable standard-tool mark; the continuation-delivery check
    // consults the REGISTERED definition).
    const placed = { ...capture.native, execute: async (args, exec) => {
      const classified = row.classify(args)
      if (classified.ok !== true) throw refusalToThrow(classified)
      const admitted = await input.admit(Object.freeze({ name, recordIndex: row.recordIndex, familyId: A5_B_SUBAGENT_FAMILY_ID, classified, exec }))
      if (admitted?.ok !== true) {
        throw refusalToThrow(admitted ?? { code: CODES.ADMISSION_ABSENT, detail: 'the admission seam refused this call' })
      }
      const settled = await row.delegate(classified.plan, { exec })
      if (settled?.ok !== true) throw refusalToThrow(settled)
      return settled.value
    } }
    const definition = Object.freeze(name === 'send_message' ? markHostSendMessage(placed) : placed)
    rows.set(name, Object.freeze({ status: 'ACTIVE', row, definition, captureDefinitionIdentity: capture.definitionIdentity }))
    definitions.push(definition)
    observe({ event: 'b-subagent:mounted', name, recordIndex: row.recordIndex })
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
      recordIndex: A5_B_SUBAGENT_RECORD_SPECS[definition.name].recordIndex,
      definitionIdentity: key,
      entry: Object.freeze({
        familyId: A5_B_SUBAGENT_FAMILY_ID,
        adapterRevision: A5_B_SUBAGENT_ADAPTER_REVISION,
        providerIdentity: providerId,
      }),
    })
  }))

  const rowsView = Object.freeze(Object.fromEntries([...rows.entries()]))
  const assembly = Object.freeze({
    ok: true,
    familyId: A5_B_SUBAGENT_FAMILY_ID,
    revision: A5_B_SUBAGENT_ADAPTER_REVISION,
    mountCondition: A5_B_SUBAGENT_MOUNT_CONDITION,
    providerId,
    subset: 'records 44/45/46 (control trio); the family spawn side 39-43 is NOT adapted here (NAMED GAP SPAWN_SIDE_CLOSED_WORLD)',
    placementNames: Object.freeze(definitions.map((definition) => definition.name)),
    definitions: Object.freeze(definitions),
    rows: rowsView,
    declared: Object.freeze(declared),
    rowOf: (name) => rows.get(name)?.row,
    /** L9: new-call prohibition ONLY. */
    drain: () => {
      state.draining = true
      return deepFreeze({ event: 'b-subagent:drain', semantics: DRAIN_SEMANTICS })
    },
    inFlight: () => deepFreeze({ dispatches: state.dispatches, refuses: state.refuses }),
    familyRegistrations,
  })
  return assembly
}
