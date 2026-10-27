/**
 * agent-state-family/src/state-store.mjs — the INJECTED state-store port.
 *
 * The governed rows own the LAW (`agent-state-law.mjs`); this port owns
 * PERSISTENCE and the execution-origin fact (`armFor`). The port arrives
 * through the mount's public injection seam (`cap.injected.agentState`, the
 * kit/test `input.backends` face the plane already honours) — the family
 * holds no kernel, registry or grant handle, and the port carries none:
 *
 *   armFor(scope)              -> {kind:'model'} | {kind:'direct-human'}
 *                                 | {kind:'goal-round', goalId, revision, round}
 *   readGoal(scope)            -> snapshot | null            (BOUNDED: one scope, one snapshot)
 *   applyGoal(scope, op)       -> {ok, snapshot} | {ok:false, code, detail}
 *   readTodos(scope)           -> todos | null
 *   applyTodos(scope, op)      -> {ok, todos} | refusal
 *   readPlanMode(scope)        -> {active, pendingIntents}
 *   applyPlanModeExit(scope, op) -> {ok, state} | refusal
 *
 * EVERY method takes the scope FIRST. The rows derive `scope` exclusively
 * from the dispatch's calling agent — never from arguments — so a
 * cross-scope read or write is UNREACHABLE by construction, and the
 * recording store makes that claim OBSERVABLE (every touch is logged with
 * its scope; refusals must show zero touches).
 *
 * DURABLE IDEMPOTENCE (law d): every apply carries an `applyId` (the PA
 * call correlation). A consumed grant cannot apply twice: the store refuses
 * a repeated applyId with `STATE_APPLY_REPLAY` and zero persistence, and a
 * re-driven mutation with a fresh call answers the CAS refusal
 * (`GOAL_STALE_REVISION` / revision-advanced), never a double fold.
 *
 * @module tools/agent-state-family/state-store
 */

/** The closed port method list — an injected port missing one is refused at
 *  build time (fail closed), never partially trusted. */
export const STATE_PORT_METHODS = Object.freeze([
  'armFor', 'readGoal', 'applyGoal', 'readTodos', 'applyTodos', 'readPlanMode', 'applyPlanModeExit',
])

export function validateStatePort(port) {
  if (port === null || typeof port !== 'object') return { ok: false, detail: 'the agent-state store port is absent' }
  const missing = STATE_PORT_METHODS.filter((m) => typeof port[m] !== 'function')
  if (missing.length > 0) return { ok: false, detail: `the agent-state store port is missing method(s): ${missing.join(',')}` }
  return { ok: true }
}

/** The honest absent store (the jobs bridgeless precedent): every method
 *  answers a typed refusal; the mount stands, the rows answer honestly, and
 *  nothing persists. */
export function createAbsentStateStore() {
  const absent = async () => ({ ok: false, code: 'AGENT_STATE_STORE_UNMOUNTED', detail: 'no agent-state store is mounted at this seam; the governed row refuses with zero state access' })
  return Object.freeze({
    name: 'agent-state:absent',
    armFor: () => ({ kind: 'model' }),
    readGoal: absent,
    applyGoal: absent,
    readTodos: absent,
    applyTodos: absent,
    readPlanMode: absent,
    applyPlanModeExit: absent,
  })
}

/**
 * The RECORDING in-memory store — the C1 fake and the kit-world backing.
 * It records EVERY touch (scope + op + key) so every refusal leg pairs the
 * ANSWER with a DISK FACT of this store's own log, exactly like the fs
 * mutation suite pairs refusals with byte-compare.
 *
 * Scenario controls (test-facing, not port methods):
 *   setArm(scope, arm)      — the execution-origin fact for later calls
 *   seed(scope, {goal, todos, planMode}) — plant state (incl. ANOTHER agent's
 *     state, which the planted cross-scope test expects to stay untouched)
 */
export function createRecordingStateStore() {
  const scopes = new Map()
  const log = { reads: [], writes: [] }
  const applied = new Set()
  const scopeOf = (scope) => {
    let entry = scopes.get(scope)
    if (entry === undefined) {
      entry = { goal: null, todos: null, planMode: { active: false, pendingIntents: [] }, arm: { kind: 'model' } }
      scopes.set(scope, entry)
    }
    return entry
  }
  const store = {
    name: 'agent-state:recording',
    log,
    setArm: (scope, arm) => { scopeOf(scope).arm = arm },
    seed: (scope, patch) => {
      const entry = scopeOf(scope)
      if (patch.goal !== undefined) entry.goal = patch.goal
      if (patch.todos !== undefined) entry.todos = patch.todos
      if (patch.planMode !== undefined) entry.planMode = patch.planMode
    },
    stateOf: (scope) => scopes.get(scope) ?? null,
    armFor: (scope) => {
      const arm = scopeOf(scope).arm
      // arms are execution facts, not durable state: NOT logged as reads
      return arm
    },
    readGoal: async (scope) => {
      log.reads.push({ op: 'goal/read', scope, key: `${scope}/goal` })
      return scopes.get(scope)?.goal ?? null
    },
    applyGoal: async (scope, { expectedRevision, next, applyId }) => {
      log.writes.push({ op: 'goal/apply', scope, key: `${scope}/goal`, applyId })
      if (applied.has(applyId)) {
        return { ok: false, code: 'STATE_APPLY_REPLAY', detail: `apply ${String(applyId)} already consumed; a consumed grant never applies twice` }
      }
      const entry = scopeOf(scope)
      const current = entry.goal
      if (expectedRevision === null) {
        if (current !== null && current.phase !== 'complete') {
          return { ok: false, code: 'GOAL_ALREADY_EXISTS', detail: `goal "${current.goalId}" already exists with phase "${current.phase}"` }
        }
      } else if (current === null || current.goalId !== next.goalId || current.revision !== expectedRevision) {
        return {
          ok: false,
          code: 'GOAL_STALE_REVISION',
          detail: `stale goal ref "${String(next.goalId)}" revision ${String(expectedRevision)}; current is "${String(current?.goalId)}" revision ${String(current?.revision)}`,
        }
      }
      applied.add(applyId)
      entry.goal = next
      return { ok: true, snapshot: next }
    },
    readTodos: async (scope) => {
      log.reads.push({ op: 'todos/read', scope, key: `${scope}/todos` })
      return scopes.get(scope)?.todos ?? null
    },
    applyTodos: async (scope, { todos, applyId }) => {
      log.writes.push({ op: 'todos/apply', scope, key: `${scope}/todos`, applyId })
      if (applied.has(applyId)) {
        return { ok: false, code: 'STATE_APPLY_REPLAY', detail: `apply ${String(applyId)} already consumed; a consumed grant never applies twice` }
      }
      applied.add(applyId)
      scopeOf(scope).todos = todos.map((t) => ({ ...t }))
      return { ok: true, todos }
    },
    readPlanMode: async (scope) => {
      log.reads.push({ op: 'plan-mode/read', scope, key: `${scope}/plan-mode` })
      return scopes.get(scope)?.planMode ?? { active: false, pendingIntents: [] }
    },
    applyPlanModeExit: async (scope, { plan, applyId }) => {
      log.writes.push({ op: 'plan-mode/apply', scope, key: `${scope}/plan-mode`, applyId })
      if (applied.has(applyId)) {
        return { ok: false, code: 'STATE_APPLY_REPLAY', detail: `apply ${String(applyId)} already consumed; a consumed grant never applies twice` }
      }
      const entry = scopeOf(scope)
      if (entry.planMode.active !== true) {
        return { ok: false, code: 'PLAN_MODE_NOT_ACTIVE', detail: 'exit_plan_mode is only available in plan mode' }
      }
      applied.add(applyId)
      entry.planMode = { active: false, pendingIntents: [...entry.planMode.pendingIntents, { plan, appliedBy: applyId }] }
      return { ok: true, state: entry.planMode }
    },
  }
  return store
}
