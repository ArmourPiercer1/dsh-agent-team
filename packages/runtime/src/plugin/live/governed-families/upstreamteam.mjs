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
 * implementation progress, never an acceptance claim. Only record 66
 * (`list_agents`) carries a completed row in this revision; the other eight
 * names are typed DECLARED-not-yet-rowed entries in
 * `A5_B_UPSTREAMTEAM_NAMED_GAPS` with their frozen record index, so a missing
 * port law can never be papered over by an invented one.
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
 * THE PORT LAW of the ONE rowed name, taken from the captured 639 body rather
 * than invented (`packages/experimental/tool-agent-team/src/index.ts`; built
 * face `lib/index.js:323-328`):
 *   list_agents → ctx.agentTeams.listMembers(callingAgent(exec.agent, 'list_agents'))
 *                 .map(modelMember)
 * so the seam is `agentTeams.listMembers(callerAgent) -> member[]`, the caller
 * identity is derived from the exec agent (never from an argument the model can
 * forge), and the value side is the host's own member model. `parameters: {}`
 * means the row accepts NO model-supplied argument at all. The port object is
 * INJECTED by the paired registration writer (production: the live
 * `ctx.agentTeams` plus the host's caller-resolution and member-modeling
 * helpers); this module implements none of it.
 */
export const A5_B_UPSTREAMTEAM_SERVICE_METHODS = Object.freeze({
  list_agents: Object.freeze({ service: 'agentTeams', method: 'listMembers', arity: 1 }),
})

export const A5_B_UPSTREAMTEAM_EFFECT_LABELS = Object.freeze({
  list_agents: Object.freeze({ effect: 'read', label: 'roster-read: no durable write' }),
})

/** Typed refusal codes of this family (never a generic internal error). */
export const A5_B_UPSTREAMTEAM_CODES = Object.freeze({
  rowNotRowed: 'P_UPSTREAMTEAM_ROW_NOT_ROWED',
  callerUnresolved: 'P_UPSTREAMTEAM_CALLER_UNRESOLVED',
  mountNotDeclared: 'P_UPSTREAMTEAM_MOUNT_NOT_DECLARED',
  paSeatMissing: 'P_UPSTREAMTEAM_PA_SEAT_MISSING',
})

/**
 * The eight names this revision does NOT row, with the reason a row is not
 * possible yet (their captured port law has not been read from the 639 source
 * and transcribed name by name). Each keeps its frozen record index so the
 * next increment extends this table instead of re-deriving the census.
 */
export const A5_B_UPSTREAMTEAM_NAMED_GAPS = Object.freeze({
  interrupt_agent: Object.freeze({ recordIndex: 65, reason: 'port law not yet transcribed from the 639 body' }),
  send_message: Object.freeze({ recordIndex: 67, reason: 'port law not yet transcribed from the 639 body' }),
  spawn_teammate: Object.freeze({ recordIndex: 68, reason: 'port law not yet transcribed from the 639 body' }),
  wait_agent: Object.freeze({ recordIndex: 69, reason: 'port law not yet transcribed (timed wait: 10000..3600000 ms)' }),
  team_task_create: Object.freeze({ recordIndex: 70, reason: 'port law not yet transcribed from the 639 body' }),
  team_task_get: Object.freeze({ recordIndex: 71, reason: 'port law not yet transcribed from the 639 body' }),
  team_task_list: Object.freeze({ recordIndex: 72, reason: 'port law not yet transcribed from the 639 body' }),
  team_task_update: Object.freeze({ recordIndex: 73, reason: 'port law not yet transcribed from the 639 body' }),
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
export function createUpstreamTeamRow(name, input = {}) {
  const entry = upstreamTeamPlacementEntry(name)
  if (entry === null) return { ok: false, code: A5_B_UPSTREAMTEAM_CODES.rowNotRowed, name }
  const { port, callerAgent, pa } = input
  if (typeof pa?.admit !== 'function' && typeof pa !== 'function') {
    return { ok: false, code: A5_B_UPSTREAMTEAM_CODES.paSeatMissing, name }
  }
  if (typeof callerAgent !== 'string' || callerAgent.length === 0) {
    return { ok: false, code: A5_B_UPSTREAMTEAM_CODES.callerUnresolved, name }
  }
  const admit = typeof pa === 'function' ? pa : pa.admit
  return {
    ok: true,
    entry,
    invoke() {
      return admit({ operation: entry.operation, recordIndex: entry.recordIndex, run: () => port.listMembers(callerAgent) })
    },
  }
}
