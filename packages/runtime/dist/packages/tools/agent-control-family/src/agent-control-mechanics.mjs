/**
 * agent-control-family/src/agent-control-mechanics.mjs — the PURE law of the
 * agent-control family (U7-F): argument grammar, effect-arm derivation, the
 * caller-scope fence, the no-amplification law and the fork-context boundary.
 *
 * Every function here is pure data over closed key sets: no `node:*`, no I/O,
 * no clock, no authority. The executors compose these laws BEFORE any
 * injected edge is touched; the port is reached only after every law here
 * answered allowed.
 *
 * THE THREE LAWS THIS FILE OWNS:
 *
 *  1. ENUMERATION / MUTATION SPLIT. The two enumeration rows
 *     (`list_agents`, `list_subagent_models`) derive effect sets whose arms
 *     are ONLY `tool-invoke` (their own name) + `meta` (a metadata view).
 *     They NEVER derive the `domain-ref` arm — the cross-authority arm is
 *     the spawn/steer authority (the agent runtime decides at commit, the
 *     same closed-grammar shape the fs image row uses for the attachment
 *     store). The five mutation rows (`subagent`, `subagent_fork`,
 *     `send_message`, `interrupt_agent`, `workflow`) carry
 *     `tool-invoke` + `domain-ref(dsh-agent-runtime)`; `subagent_fork`
 *     additionally names its conversation-context read as a `meta` arm
 *     (DATA the call discloses, never authority). The split is a DERIVATION
 *     law: the row's argument grammar is closed, the arms are built by the
 *     switch below, and an enumeration request cannot be mutation-shaped.
 *
 *  2. NO AMPLIFICATION (law (b)): a spawn/fork/workflow-spawn child request
 *     may ask for provider/model routes and a tool surface, and EVERY
 *     requested arm must be inside the CALLER's own authority as stated by
 *     the trusted assembly (`callerAuthority`). A missing `callerAuthority`
 *     is a refusal (fail closed), never an unconstrained inherit: this file
 *     can only ever REFUSE earlier — it never admits.
 *
 *  3. THE OWNER FENCE (law (d), mirrors the jobs owner fence): a steer or
 *     interrupt target must live in the CALLER's own scope. The structural
 *     arm answers from trusted mount data alone (zero port interaction):
 *     a target that carries an explicit scope identity other than the
 *     mount's own scope is FOREIGN. A bare id is checked against the
 *     assembly's scope roster when one was injected; without a roster the
 *     call REFUSES (fail closed) — a mount that cannot prove membership
 *     never reaches the target. The port's own caller fence stays the
 *     SECOND, authoritative gate (the advisory can only refuse earlier,
 *     never admit — the jobs `ownerDurable` law).
 *
 * @module agent-control-family/agent-control-mechanics
 */

/** The domain authority the mutation rows reference: the agent runtime
 *  decides the spawn/steer effect AT COMMIT. One name, two faces — the
 *  contribution descriptor declares this exact constant as the target and
 *  the executor requests it as the domain-ref arm (pinned equal by C1). */
export const AGENT_RUNTIME_DOMAIN_AUTHORITY = 'dsh-agent-runtime'

/** The metadata views the two enumeration rows read. */
export const AGENT_ROSTER_VIEW = 'agent-roster'
export const MODEL_ROUTES_VIEW = 'model-routes'
/** The fork row's conversation-context disclosure: a metadata view of the
 *  CALLER's own mount (law (e): context is DATA crossing to the child, never
 *  grants — the row names the read, the port carries bytes). */
export const CONVERSATION_CONTEXT_VIEW = 'mount-conversation-context'

/** The seven fixed native spellings this family takes over (the jobs/fs
 *  precedent: FIXED spellings, never the configurable `names` map). */
export const AGENT_CONTROL_NAMES = Object.freeze([
  'subagent', 'subagent_fork', 'send_message', 'interrupt_agent',
  'list_agents', 'list_subagent_models', 'workflow',
])
export const AGENT_CONTROL_ENUMERATION_NAMES = Object.freeze(['list_agents', 'list_subagent_models'])
export const AGENT_CONTROL_MUTATION_NAMES = Object.freeze([
  'subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'workflow',
])

/** Refusal codes the family answers with (stable messages, no stacks). */
export const AGENT_CONTROL_REFUSAL_CODES = Object.freeze([
  'agent-control-scope-foreign',
  'agent-control-scope-unresolved',
  'agent-control-authority-unresolved',
  'agent-control-amplification-refused',
  'agent-control-context-authority-refused',
  'agent-control-replay-refused',
  'agent-control-workflow-step-refused',
])

// ── closed argument grammar ────────────────────────────────────────────────
/** One string field spec. */
const S = (required = true) => ({ kind: 'string', required })
const B = (required = false) => ({ kind: 'boolean', required })

/** The per-row CLOSED argument worlds: an unknown field is a typed refusal,
 *  never an ignored extra. */
export const ARG_GRAMMAR = Object.freeze({
  subagent: Object.freeze({
    description: S(), prompt: S(),
    provider: S(false), model: S(false), reasoning_effort: S(false),
    run_in_background: B(),
  }),
  // fork carries NO route arms on purpose: the fork inherits the caller's
  // own route, so it cannot even express a route request (law (b) by shape).
  subagent_fork: Object.freeze({
    description: S(), prompt: S(), run_in_background: B(),
  }),
  send_message: Object.freeze({
    agent_id: S(), message: S(),
  }),
  interrupt_agent: Object.freeze({
    agent_id: S(), reason: S(false),
  }),
  list_agents: Object.freeze({}),
  list_subagent_models: Object.freeze({ provider: S(false) }),
  workflow: Object.freeze({
    description: S(), prompt: S(),
  }),
})

/** Parse raw args against the row's closed world.
 *  @returns {{ ok: true, args: object } | { ok: false, problems: string[] }} */
export function parseAgentControlArgs(name, raw) {
  const grammar = ARG_GRAMMAR[name]
  if (grammar === undefined) return { ok: false, problems: [`unknown agent-control row '${String(name)}'`] }
  if (raw !== null && typeof raw !== 'object') {
    return { ok: false, problems: ['arguments must be an object'] }
  }
  const source = raw ?? {}
  const problems = []
  for (const key of Object.keys(source)) {
    if (!Object.prototype.hasOwnProperty.call(grammar, key)) problems.push(`unknown field '${key}'`)
  }
  const args = {}
  for (const [key, spec] of Object.entries(grammar)) {
    const value = source[key]
    if (value === undefined) {
      if (spec.required) problems.push(`missing required field '${key}'`)
      continue
    }
    if (spec.kind === 'string') {
      if (typeof value !== 'string' || value.trim().length === 0) problems.push(`field '${key}' must be a non-empty string`)
      else args[key] = value
    } else if (spec.kind === 'boolean') {
      if (typeof value !== 'boolean') problems.push(`field '${key}' must be a boolean`)
      else args[key] = value
    }
  }
  if (problems.length > 0) return { ok: false, problems }
  return { ok: true, args }
}

// ── effect derivation (law 1) ─────────────────────────────────────────────
/**
 * Derive the requested effect arms for ONE call. The switch is closed by
 * name: enumeration arms can only ever be `meta`, mutation arms always carry
 * the `domain-ref` authority arm. `subagent_fork` adds the conversation
 * metadata read — context is disclosed, not granted.
 * @returns {Array<object>} the raw arms (the executor canonicalizes through
 *   the domain parser BEFORE the PA edge is asked).
 */
export function deriveAgentControlEffects(realmId, name, args) {
  const invoke = { kind: 'tool-invoke', toolName: name, resource: null }
  const meta = (locator) => ({
    kind: 'meta',
    resource: { realmId, kind: 'metadata', canonicalLocator: locator, rights: ['meta'] },
  })
  const runtimeRef = { kind: 'domain-ref', domainAuthorityId: AGENT_RUNTIME_DOMAIN_AUTHORITY, resource: null }
  switch (name) {
    case 'list_agents': return [invoke, meta(AGENT_ROSTER_VIEW)]
    case 'list_subagent_models': return [invoke, meta(MODEL_ROUTES_VIEW)]
    case 'subagent': return [invoke, runtimeRef]
    case 'subagent_fork': return [invoke, runtimeRef, meta(CONVERSATION_CONTEXT_VIEW)]
    case 'send_message':
    case 'interrupt_agent': return [invoke, runtimeRef]
    case 'workflow': return [invoke, runtimeRef]
    default: return null
  }
}

// ── the owner fence (law 3) ───────────────────────────────────────────────
/**
 * Structural foreignness, answered from trusted mount data with ZERO port
 * interaction: a target may be a bare id (addressed inside the mount's own
 * scope by the runtime) or an explicitly scoped id `scope:agent`. A target
 * naming ANY scope other than the mount's own is FOREIGN; nothing about it
 * is probed.
 * @param {string} target
 * @param {{ scopeKey: string }} mountScope - the mount's own scope identity
 *   (trusted: the plane's identity, never a model argument).
 * @returns {{ foreign: true, detail: string } | { foreign: false, id: string }}
 */
export function classifyTargetScope(target, mountScope) {
  const own = typeof mountScope?.scopeKey === 'string' ? mountScope.scopeKey : ''
  const raw = String(target ?? '')
  if (raw.trim().length === 0) return { foreign: true, detail: 'empty target' }
  const sep = raw.indexOf(':')
  if (sep >= 0) {
    const scope = raw.slice(0, sep)
    const id = raw.slice(sep + 1)
    if (id.length === 0) return { foreign: true, detail: 'scoped target carries no agent id' }
    if (scope !== own) return { foreign: true, detail: `target names scope '${scope.slice(0, 24)}', not this mount's own scope` }
    return { foreign: false, id }
  }
  return { foreign: false, id: raw }
}

/**
 * Roster membership (the advisory arm). The roster is TRUSTED ASSEMBLY DATA
 * (durable member facts of the mount's own scope) — never a port call.
 * Without roster data the call REFUSES: membership the mount cannot prove is
 * membership it does not have (fail closed; the jobs producer states the
 * same law for attribution).
 * @returns {{ ok: true } | { ok: false, code: string, detail: string }}
 */
export function scopeMembership(scopeFence, id) {
  if (scopeFence === null || scopeFence === undefined || typeof scopeFence !== 'object') {
    return {
      ok: false,
      code: 'agent-control-scope-unresolved',
      detail: 'this mount carries no durable scope roster, so no steer or interrupt target can be proven in-scope — the call refuses before any runtime is touched (fail closed)',
    }
  }
  const members = Array.isArray(scopeFence.members) ? scopeFence.members : []
  if (members.includes(id)) return { ok: true }
  return {
    ok: false,
    code: 'agent-control-scope-foreign',
    detail: `target '${id.slice(0, 64)}' is not a member of this mount's own scope — steering an agent the caller does not own is refused with zero reach`,
  }
}

// ── no amplification (law 2) ──────────────────────────────────────────────
/**
 * Compare a child-spawn request against the CALLER's authority (trusted
 * assembly data). Every requested arm must be a subset of the caller's own;
 * an absent request inherits the caller's bound, never a wider one. A
 * missing caller authority is a refusal, never an unconstrained spawn.
 * @param {object|null|undefined} callerAuthority {providers?: string[], models?: string[], tools?: string[], continuable?: boolean}
 * @param {object} requested {provider?, model?, tools?: string[], continuable?}
 * @returns {{ ok: true } | { ok: false, violations: string[] }}
 */
export function authorityBounded(callerAuthority, requested) {
  if (callerAuthority === null || callerAuthority === undefined || typeof callerAuthority !== 'object') {
    return { ok: false, violations: ['the mount carries no caller-authority snapshot: a spawn with no bounded caller can never prove it stays inside it (fail closed)'] }
  }
  const violations = []
  const within = (list, value, arm) => {
    if (value === undefined) return
    if (!Array.isArray(list) || !list.includes(value)) violations.push(`${arm} '${String(value).slice(0, 64)}' is outside the caller's own authority`)
  }
  within(callerAuthority.providers, requested.provider, 'provider')
  within(callerAuthority.models, requested.model, 'model')
  if (requested.tools !== undefined) {
    const callerTools = Array.isArray(callerAuthority.tools) ? callerAuthority.tools : []
    for (const tool of requested.tools) {
      if (!callerTools.includes(tool)) violations.push(`tool '${String(tool).slice(0, 64)}' exceeds the caller's own tool surface`)
    }
  }
  if (requested.continuable === true && callerAuthority.continuable !== true) {
    violations.push('a continuable child outlives a caller that is not itself continuable')
  }
  return violations.length === 0 ? { ok: true } : { ok: false, violations }
}

// ── the fork-context boundary (law (e)) ───────────────────────────────────
/** Context that crosses to a forked child is DATA. The family never ships
 *  an authority-shaped context: these keys inside anything the fork request
 *  or the runtime's context answer carries are a refusal, never a strip. */
export const CONTEXT_FORBIDDEN_KEYS = Object.freeze([
  'grant', 'grants', 'approval', 'approvals', 'permission', 'permissions',
  'scopeKey', 'authority', 'token', 'tokenKey', 'controlRequestId',
])

/** Recursively scan a context payload for authority-shaped keys.
 *  @returns {string[] } the offending paths (empty = pure data). */
export function scanContextAuthority(value, path = '$', found = []) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) scanContextAuthority(value[i], `${path}[${String(i)}]`, found)
    return found
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, inner] of Object.entries(value)) {
      if (CONTEXT_FORBIDDEN_KEYS.includes(key)) found.push(`${path}.${key}`)
      scanContextAuthority(inner, `${path}.${key}`, found)
    }
  }
  return found
}

/**
 * The workflow script law (law (c)): a workflow script may only reach other
 * agents through the runtime's own agent-call legs, and every spawn those
 * legs make rides the SAME no-amplification fence through the executor-
 * supplied delegate. Here we grade the EFFECT WORLD the script declares:
 * the row's declared effect set (tool-invoke + domain-ref) already covers
 * every spawn/steer leg the runtime can take, so the family's only extra law
 * is that the port cannot be told to run with an authority OVERRIDE — any
 * request arm that tries to widen (caller identity, grants, scopes) is a
 * typed refusal BEFORE the PA edge.
 * @returns {string[]} violations (empty = the effect world is covered)
 */
export function workflowEffectWorld(caller, requestOverrides) {
  const violations = []
  if (requestOverrides === null || requestOverrides === undefined) return violations
  if (typeof requestOverrides !== 'object') return ['workflow override payload must be an object or absent']
  for (const key of Object.keys(requestOverrides)) {
    if (key === 'caller' || key === 'authority' || key === 'scopeKey' || key === 'grants' || key === 'controls') {
      violations.push(`workflow override arm '${key}' tries to restate authority: the runtime legs run as THIS caller and no other`)
    }
  }
  void caller
  return violations
}
