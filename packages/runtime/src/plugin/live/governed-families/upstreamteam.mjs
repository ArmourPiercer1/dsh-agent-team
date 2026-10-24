/**
 * governed-families/upstreamteam.mjs — A5-M2 governed-adapter rows for census
 * family **B-UPSTREAMTEAM** (frozen dispatch index
 * `docs/plans/active/alpha5-tool-io-governance/m0-closure-v3/M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json`,
 * family law `M0-B-FAMILY-TARGET-CONTRACTS.md#B-UPSTREAMTEAM`).
 *
 * THE OBJECT (root correction, kept stated so nobody re-derives it wrong):
 * these nine records are the **experimental upstream Team implementations**
 * shipped by the HOST package `@deepseek-ai/dsh-experimental-tool-agent-team`
 * (fixed 639 host: `packages/experimental/tool-agent-team/src/index.ts`,
 * built face `packages/experimental/tool-agent-team/lib/index.js`; the nine
 * names are listed for that package in the host's own
 * `docs/tool-catalog.md:43`). They are NOT this repository's ten `team_*`
 * business tools (those are records 74-82, `team-adapters.mjs:208-216`) and
 * NOT the `team_task_*` names any document labelled UNKNOWN (the per-name
 * rows of `TOOL-CAPABILITY-MATRIX-9b2.md:141-144` are a different statement
 * and stay untouched by this module).
 *
 * SAME-NAME, TWO IMPLEMENTATIONS (root census notation, spelled out):
 * `interrupt_agent` / `list_agents` / `send_message` exist twice in the
 * upstream surface — the SubagentService implementation (census records
 * 44/45/46, `subagent-adapters.mjs:155-159`, family B-SUBAGENT) and this
 * experimental agent-team implementation (records 65/66/67, this family).
 * A row here NEVER borrows the B-SUBAGENT port law, operation token, effect
 * label or record index, and vice versa.
 *
 * MOUNT CONDITION: all nine frozen records carry
 * `mountCondition: 'declared_mount'` and `onMountObligation:
 * 'FULL_GOVERNANCE'`, so `A5_B_UPSTREAMTEAM_MOUNT_CONDITION` is
 * 'declared_mount' (never 'always') and every mounted row rides the plane's
 * OWN `paAdmit` funnel (`team-tool-plane.mjs:1610-1614`: `paAdmitBody` is the
 * ONE funnel every governed production call passes; the row paths mount
 * `pa: paAdmit`). No second ledger, no side PA path, no widened default
 * exposure: the assembly produces rows and placements ONLY for names the
 * paired registration writer actually feeds at the mount moment.
 *
 * STATUS DISCIPLINE: the index marks all nine
 * `targetStatus: PROPOSED_NOT_IMPLEMENTED_NOT_ACCEPTED`. Writing a row here is
 * implementation progress, never an acceptance claim. This revision rows SIX
 * records (65/66/67/70/71/73) whose host port law is transcribed line by line;
 * the remaining three (68/69/72) stay typed DECLARED-not-yet-rowed entries in
 * `A5_B_UPSTREAMTEAM_NAMED_GAPS` with their frozen record index and the exact
 * host-side law still missing, so a gap can never be papered over by an
 * invented signature.
 */

export const A5_B_UPSTREAMTEAM_FAMILY_ID = 'B-UPSTREAMTEAM'
export const A5_B_UPSTREAMTEAM_ADAPTER_REVISION = 1

/** Frozen mount condition of the nine records (always, per the index). */
export const A5_B_UPSTREAMTEAM_MOUNT_CONDITION = 'declared_mount'

/** The nine records: census recordIndex + the row's closed operation token. */
export const A5_B_UPSTREAMTEAM_RECORD_SPECS = Object.freeze({
  interrupt_agent: Object.freeze({ recordIndex: 65, operation: 'upstreamteam-interrupt' }),
  list_agents: Object.freeze({ recordIndex: 66, operation: 'upstreamteam-list' }),
  send_message: Object.freeze({ recordIndex: 67, operation: 'upstreamteam-send-message' }),
  spawn_teammate: Object.freeze({ recordIndex: 68, operation: 'upstreamteam-spawn' }),
  wait_agent: Object.freeze({ recordIndex: 69, operation: 'upstreamteam-wait' }),
  team_task_create: Object.freeze({ recordIndex: 70, operation: 'upstreamteam-task-create' }),
  team_task_get: Object.freeze({ recordIndex: 71, operation: 'upstreamteam-task-get' }),
  team_task_list: Object.freeze({ recordIndex: 72, operation: 'upstreamteam-task-list' }),
  team_task_update: Object.freeze({ recordIndex: 73, operation: 'upstreamteam-task-update' }),
})

/** Declaration order is the frozen index order, not alphabetical. */
export const A5_B_UPSTREAMTEAM_TOOL_NAMES = Object.freeze([
  'interrupt_agent', 'list_agents', 'send_message', 'spawn_teammate', 'wait_agent',
  'team_task_create', 'team_task_get', 'team_task_list', 'team_task_update',
])

/**
 * THE PORT LAW, transcribed name by name from the captured 639 bodies of
 * `packages/experimental/tool-agent-team/lib/index.js` (fixed host 639ed01539) —
 * every entry states the host method the native execute actually calls and its
 * real arity. The caller identity is ALWAYS the exec-derived agent from
 * `callingAgent(exec.agent, <name>)`, never a model-supplied field, so member
 * visibility is unchanged: a row can only ever see the caller's own team. The
 * port OBJECT is injected by the paired registration writer (production: the
 * live `ctx.agentTeams` plus the host's `TeamTaskId` brand); this module
 * implements none of it and registers nothing.
 *
 *   66 list_agents      :328  listMembers(caller).map(modelMember)
 *   65 interrupt_agent  :363  interrupt(caller, args.target)
 *   67 send_message     :312  sendMessage(caller, { target, message })
 *   70 team_task_create :393  createTask(caller, { subject, description,
 *                              ...blockedBy = blocked_by.map(TeamTaskId),
 *                              ...writeScopes = write_scopes })
 *   71 team_task_get    :455  getTask(caller, TeamTaskId(args.task_id))
 *   73 team_task_update :512  updateTask(caller, { taskId: TeamTaskId(task_id),
 *                              expectedRevision, action, ...subject,
 *                              ...description, ...blockedBy, ...writeScopes, ...owner })
 * `listMembers` and `getTask` answers are additionally modelled host-side by
 * `modelMember` / the task view (:73, :455); the value-side modelling stays
 * with the captured native face, which the paired writer re-attaches.
 */
export const A5_B_UPSTREAMTEAM_SERVICE_METHODS = Object.freeze({
  list_agents: Object.freeze({ service: 'agentTeams', method: 'listMembers', arity: 1 }),
  interrupt_agent: Object.freeze({ service: 'agentTeams', method: 'interrupt', arity: 2 }),
  send_message: Object.freeze({ service: 'agentTeams', method: 'sendMessage', arity: 2 }),
  team_task_create: Object.freeze({ service: 'agentTeams', method: 'createTask', arity: 2 }),
  team_task_get: Object.freeze({ service: 'agentTeams', method: 'getTask', arity: 2 }),
  team_task_update: Object.freeze({ service: 'agentTeams', method: 'updateTask', arity: 2 }),
})

export const A5_B_UPSTREAMTEAM_EFFECT_LABELS = Object.freeze({
  list_agents: Object.freeze({ effect: 'read', label: 'roster-read: caller-scoped, no durable write' }),
  team_task_get: Object.freeze({ effect: 'read', label: 'task-read: one task of the caller\'s team' }),
  interrupt_agent: Object.freeze({ effect: 'control', label: 'cancellation request on one teammate' }),
  send_message: Object.freeze({ effect: 'write', label: 'mailbox write to one teammate' }),
  team_task_create: Object.freeze({ effect: 'write', label: 'durable shared-task create' }),
  team_task_update: Object.freeze({ effect: 'write', label: 'durable shared-task mutation, revision-checked' }),
})

/** Typed refusal codes of this family (never a generic internal error). */
export const A5_B_UPSTREAMTEAM_CODES = Object.freeze({
  rowNotRowed: 'P_UPSTREAMTEAM_ROW_NOT_ROWED',
  callerUnresolved: 'P_UPSTREAMTEAM_CALLER_UNRESOLVED',
  mountNotDeclared: 'P_UPSTREAMTEAM_MOUNT_NOT_DECLARED',
  paSeatMissing: 'P_UPSTREAMTEAM_PA_SEAT_MISSING',
  portMethodMissing: 'P_UPSTREAMTEAM_PORT_METHOD_MISSING',
})

/**
 * Model-facing parameter faces, copied from the captured tool definitions — a
 * row accepts ONLY these keys and drops everything else, so a row can never
 * widen what the model may pass (`list_agents` has no arguments at all).
 */
export const A5_B_UPSTREAMTEAM_PARAM_FACES = Object.freeze({
  list_agents: Object.freeze([]),
  interrupt_agent: Object.freeze(['target']),
  send_message: Object.freeze(['target', 'message']),
  team_task_create: Object.freeze(['subject', 'description', 'blocked_by', 'write_scopes']),
  team_task_get: Object.freeze(['task_id']),
  team_task_update: Object.freeze(['task_id', 'expected_revision', 'action', 'subject', 'description', 'blocked_by', 'write_scopes', 'owner']),
})

/**
 * Argument marshalling, one entry per rowed name, mirroring the captured
 * `execute` bodies exactly (same key renames: snake_case model face ->
 * camelCase service face; same optional-spread behaviour; the same
 * `TeamTaskId` branding through the injected `brandTaskId`).
 */
function marshalArgs(name, args, caller, port) {
  const optional = (key, value) => (value === undefined ? {} : { [key]: value })
  const brandList = (list) => (list === undefined ? undefined : list.map((item) => port.brandTaskId(item)))
  if (name === 'list_agents') return [caller]
  if (name === 'interrupt_agent') return [caller, args.target]
  if (name === 'team_task_get') return [caller, port.brandTaskId(args.task_id)]
  if (name === 'send_message') return [caller, { target: args.target, message: args.message }]
  if (name === 'team_task_create') {
    return [caller, {
      subject: args.subject,
      description: args.description,
      ...optional('blockedBy', brandList(args.blocked_by)),
      ...optional('writeScopes', args.write_scopes),
    }]
  }
  return [caller, {
    taskId: port.brandTaskId(args.task_id),
    expectedRevision: args.expected_revision,
    action: args.action,
    ...optional('subject', args.subject),
    ...optional('description', args.description),
    ...optional('blockedBy', brandList(args.blocked_by)),
    ...optional('writeScopes', args.write_scopes),
    ...optional('owner', args.owner),
  }]
}

/**
 * Names this revision does NOT row, with the exact host-side law that still has
 * to be transcribed before a row can be honest about it (each citation is a
 * line range of the captured 639 body):
 *   68 spawn_teammate — the native composes a <system-reminder> teammate brief
 *     into `prompt` and calls spawnTeammate(agent, { name, description,
 *     prompt: [ … ], context: args.context ?? 'fresh' }) (lib/index.js:268-296);
 *     restating that brief here would fork host copy instead of reusing the
 *     captured native face, so the row waits for a ruling on reuse.
 *   69 wait_agent — value-side law is a guard chain before the port call:
 *     timeout_ms must be a safe integer in 10000..3600000, and an inactive-peer
 *     check over listMembers with ACTIVE_WAIT_STATUSES answers
 *     NO_ACTIVE_PEER_MESSAGE; only then waitForChange(caller, timeoutMs,
 *     exec.signal) (lib/index.js:338-350). The signal is an exec face, not a
 *     model face, and the status set has not been transcribed yet.
 *   72 team_task_list — post-call filter over listTasks(caller) on
 *     status/owner/ready plus cursor/limit paging (lib/index.js:430-440); the
 *     predicate tail and paging law are not fully transcribed yet.
 */
export const A5_B_UPSTREAMTEAM_NAMED_GAPS = Object.freeze({
  spawn_teammate: Object.freeze({ recordIndex: 68, reason: 'native composes the teammate brief into prompt (lib/index.js:268-296); reuse ruling pending before a row forks that copy' }),
  wait_agent: Object.freeze({ recordIndex: 69, reason: 'guard chain + exec.signal face and ACTIVE_WAIT_STATUSES not transcribed (lib/index.js:338-350)' }),
  team_task_list: Object.freeze({ recordIndex: 72, reason: 'filter predicate tail and cursor/limit paging not transcribed (lib/index.js:430-440)' }),
})

/**
 * ONE NAME, ONE PLACEMENT (the settled house method, the same shape the plane
 * uses for its own rows): a placement entry exists only for a name that is
 * (a) rowed here, (b) actually fed by the paired registration writer, and
 * (c) seated on the plane's `paAdmit`. The entry never names a registration
 * key by hand — placement keys stay placement-feed minted.
 */
export function upstreamTeamPlacementEntry(name) {
  const spec = A5_B_UPSTREAMTEAM_RECORD_SPECS[name]
  if (spec === undefined) return null
  if (Object.prototype.hasOwnProperty.call(A5_B_UPSTREAMTEAM_NAMED_GAPS, name)) return null
  return Object.freeze({
    familyId: A5_B_UPSTREAMTEAM_FAMILY_ID,
    recordIndex: spec.recordIndex,
    operation: spec.operation,
    mountCondition: A5_B_UPSTREAMTEAM_MOUNT_CONDITION,
    effect: A5_B_UPSTREAMTEAM_EFFECT_LABELS[name]?.effect ?? 'unknown',
  })
}

/**
 * The row body for the one rowed name. It performs no work itself: it asks the
 * injected port for the roster of the CALLER's team and hands the result to the
 * plane's PA funnel exactly as the row paths do (`pa: paAdmit`). A missing PA
 * seat or an unresolved caller is a typed refusal, never a silent read.
 */
/**
 * Build one row. Governance is never decided here: the operation, the census
 * recordIndex and the value-side thunk are handed to the plane's OWN PA funnel
 * (`paAdmitBody`, team-tool-plane.mjs:1610-1614), exactly as the row paths of the
 * other families do. Only the frozen parameter face survives the trim, so a row
 * cannot widen the model-facing surface.
 */
export function createUpstreamTeamRow(name, input = {}) {
  const entry = upstreamTeamPlacementEntry(name)
  if (entry === null) return { ok: false, code: A5_B_UPSTREAMTEAM_CODES.rowNotRowed, name }
  const { port, callerAgent, pa, args = {} } = input
  if (typeof pa?.admit !== 'function' && typeof pa !== 'function') {
    return { ok: false, code: A5_B_UPSTREAMTEAM_CODES.paSeatMissing, name }
  }
  if (typeof callerAgent !== 'string' || callerAgent.length === 0) {
    return { ok: false, code: A5_B_UPSTREAMTEAM_CODES.callerUnresolved, name }
  }
  const method = A5_B_UPSTREAMTEAM_SERVICE_METHODS[name]?.method
  if (typeof port?.[method] !== 'function' || (method !== 'listMembers' && typeof port.brandTaskId !== 'function' && (name === 'team_task_get' || name === 'team_task_create' || name === 'team_task_update'))) {
    return { ok: false, code: A5_B_UPSTREAMTEAM_CODES.portMethodMissing, name }
  }
  const face = A5_B_UPSTREAMTEAM_PARAM_FACES[name]
  const trimmed = {}
  for (const key of face) if (args[key] !== undefined) trimmed[key] = args[key]
  const admit = typeof pa === 'function' ? pa : pa.admit
  return {
    ok: true,
    entry,
    invoke() {
      return admit({
        operation: entry.operation,
        recordIndex: entry.recordIndex,
        run: () => port[method](...marshalArgs(name, trimmed, callerAgent, port)),
      })
    },
  }
}
