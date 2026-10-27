/**
 * agent-control-family/src/agent-runtime-port.mjs — the injected AGENT-RUNTIME
 * PORT contract and the production resolver (U7-F).
 *
 * THE FAMILY HOLDS NO AGENT POWER OF ITS OWN. Every effect leg — enumerate,
 * spawn, fork, steer, interrupt, workflow — is executed by a PORT that the
 * trusted assembly injects. This file owns:
 *
 *  1. the CONTRACT SHAPE (closed op names; every leg optional). A leg the
 *     port does not answer is never guessed or faked: the row refuses with
 *     the typed `agent-runtime-leg-unwired` refusal and ZERO port reach —
 *     the shut-face law, per leg, not per row.
 *  2. the PRODUCTION resolver: legs resolved LAZILY at call time from the
 *     mount's public host services (`cap.hostService(name)` — the same
 *     public seam the host's own tools ride, the attachments/llm precedent).
 *     A service that does not resolve, or answers a shape the contract does
 *     not recognize, contributes NO leg (typed refusal), never a partial
 *     guess. Which legs the pinned host actually answers live is a C2
 *     question, recorded verbatim — the resolver invents nothing.
 *
 * Purity: no `node:*`, no I/O of its own; every call rides an injected face.
 *
 * @module agent-control-family/agent-runtime-port
 */

/** The closed leg names. */
export const PORT_LEGS = Object.freeze(['listAgents', 'listModels', 'spawnChild', 'forkChild', 'steer', 'interrupt', 'runWorkflow'])

/** The per-leg typed refusal when no port answers the leg. */
export const LEG_UNWIRED = Object.freeze({
  ok: false,
  code: 'agent-runtime-leg-unwired',
  detail: 'no agent-runtime port answers this leg for this mount — the governed row refuses with zero reach, never a fake and never a bypass',
})

/** Normalize any port candidate (injected or host-resolved) into the closed
 *  leg view: only function legs survive, everything else is absent. A
 *  candidate may answer legs DYNAMICALLY through `legResolver(leg)` (the
 *  host resolver uses this so a service that mounts late becomes usable and
 *  one that goes away stops being usable — no stale handle rides). */
export function normalizePort(candidate) {
  if (candidate === null || candidate === undefined || typeof candidate !== 'object') {
    return { portId: null, staticLegs: Object.freeze({}), legResolver: () => null }
  }
  const legs = {}
  for (const leg of PORT_LEGS) {
    if (typeof candidate[leg] === 'function') legs[leg] = candidate[leg].bind(candidate)
  }
  const resolver = typeof candidate.legResolver === 'function'
    ? (leg) => {
      const fn = candidate.legResolver(leg)
      return typeof fn === 'function' ? fn : null
    }
    : () => null
  return { portId: typeof candidate.portId === 'string' ? candidate.portId : 'agent-runtime-port', staticLegs: Object.freeze(legs), legResolver: resolver }
}

/**
 * Resolve one leg: returns a callable, or null (NEVER a stub that lies).
 */
export function resolveLeg(port, leg) {
  if (!PORT_LEGS.includes(leg)) return null
  return port.staticLegs[leg] ?? port.legResolver(leg) ?? null
}

/**
 * The Tier A spawn law AT THE PORT (AC-1, design §2.3/§2.4 + F4/F6): the
 * child the production port starts is ≤ ANY caller by construction —
 *   - `toolFilter: { allow: [] }` is FORCED on every child start (the public
 *     SubagentStartRequest.toolFilter, subagent/src/types.ts:186-192, applied
 *     as a chain-wide tools.restrict in the child's creation window,
 *     child-agent.ts:200-218): zero inherited tools;
 *   - NO `agentOptions` and NO `persona` are ever sent: the in-process merge
 *     is the caller's own route (types.ts:164-171);
 *   - a request that still carries a route / background / tool arm when it
 *     reaches the port is refused TYPED (the executor's ceiling refuses it
 *     earlier; this is the second gate, never a silent drop);
 *   - a caller whose PUBLIC tool view presents the reserved PTC transport
 *     `run_code` (core/tools/src/index.ts:1215 — present iff the scope mode is
 *     not `native`) is refused: a tool-less child would still get `run_code`.
 */
export const TIER_A_CHILD_TOOL_FILTER = Object.freeze({ allow: Object.freeze([]) })
export const TIER_A_FORBIDDEN_SPEC_FIELDS = Object.freeze(['provider', 'model', 'reasoning_effort', 'run_in_background', 'tools', 'persona', 'agentOptions', 'toolFilter'])

/** The public PTC probe: does the caller agent's own tool view present the
 *  reserved `run_code` transport? `tools.get(name, scope)` is the public
 *  registry read (core/tools/src/index.ts:1230). An agent whose view cannot be
 *  read answers `unknown` — the caller fences treat that as a refusal. */
export function callerPtcMode(agent) {
  try {
    const tools = agent?.ctx?.tools
    if (tools === null || tools === undefined || typeof tools.get !== 'function') return 'unknown'
    return tools.get('run_code', agent) === undefined ? 'native' : 'ptc'
  } catch {
    return 'unknown'
  }
}

/** The child's visible tool names through the public `tools.schemas(scope)`
 *  face (the native invariant.ts read), or null when unreadable. */
function childToolView(run) {
  try {
    const child = run?.localAgent
    const tools = child?.ctx?.tools
    if (tools === null || tools === undefined || typeof tools.schemas !== 'function') return null
    const schemas = tools.schemas(child)
    return Array.isArray(schemas) ? schemas.map((s) => String(s?.name ?? '')) : null
  } catch {
    return null
  }
}

const textOf = (output) => (Array.isArray(output) ? output : [])
  .filter((b) => b !== null && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
  .map((b) => b.text)
  .join('')

/**
 * The production resolver: build the leg provider from the mount's public
 * host-service face. NOTHING here imports host internals: the only outward
 * edge is `hostService(name)` — a lookup by the public service name, exactly
 * the seam the fs image row uses for `attachments`/`llm`. Every leg is
 * resolved AT CALL TIME (a service that mounts after assembly becomes
 * usable; one that goes away stops being usable — no stale handle rides).
 *
 * Pinned recognized faces (host tree @ 639ed01539, AC-1 retarget):
 *   - `subagents` (SubagentRuntime, subagent/subagent/src/index.ts:200-215):
 *     `listChildren(parentSessionId, signal)` :374, `listDescendants(root,
 *     signal)` :393, `start(provider, SubagentStartRequest)` :559 with the
 *     bundle providers `spawn` and `fork` (bundle/base/cordis.patch.yml:349-399);
 *   - `llm`: `listProviders()` / `listModels(providerId)` (the native
 *     list_subagent_models seam, tool-subagent/src/list-models.ts:42-63).
 * The four AC-1 legs (listAgents, listModels, spawnChild, forkChild) NEVER
 * consult the experimental `agentTeams` runtime (a different product the
 * base bundle does not load). The out-of-lane `steer` / `interrupt` legs are
 * left exactly as #406 shipped them (lanes AC-2/AC-3 retarget them).
 * The caller is the DISPATCH-PROVIDED agent identity the row forwarded
 * (`caller.agent`, the native `callingAgent(exec.agent, …)` law) — never a
 * model argument; a call whose trusted agent identity did not arrive refuses
 * typed with zero reach. A face that resolves but answers a DIFFERENT shape
 * contributes NO leg — the row refuses `agent-runtime-leg-unwired`.
 *
 * @param {{ hostService: (name: string) => unknown, caller: object, observe?: (line: string) => void }} input
 * @returns the closed-leg port view whose legs resolve lazily.
 */
export function createHostAgentRuntimePort({ hostService, caller, observe = () => {} }) {
  const service = (name) => {
    try {
      return typeof hostService === 'function' ? hostService(name) : undefined
    } catch {
      return undefined
    }
  }
  const note = (line) => observe(`agent-runtime host-port: ${line}`)
  /** Resolve a candidate service that structurally answers `pick`; the
   *  lookup re-runs on EVERY call (lazy: mount-late / go-away honest). */
  const face = (leg, serviceNames, pick) => {
    for (const name of serviceNames) {
      const svc = service(name)
      if (svc === null || svc === undefined || typeof svc !== 'object') continue
      const fn = pick(svc)
      if (typeof fn === 'function') return { name, svc, fn }
    }
    note(`leg ${leg}: no recognized shape among [${serviceNames.join(',')}] — leg stays unwired`)
    return null
  }
  const CALLER_UNRESOLVED = Object.freeze({
    ok: false,
    code: 'agent-runtime-caller-unresolved',
    detail: 'the dispatch-provided caller agent identity did not reach this leg — the runtime legs run as a real caller and no other (the native callingAgent law), so a call without one is refused with zero reach',
  })
  const asAgent = (c) => (c !== null && typeof c === 'object' && c.agent !== null && typeof c.agent === 'object' ? c.agent : null)
  const isSignal = (s) => s !== null && typeof s === 'object' && typeof s.aborted === 'boolean'
  const tierA = (detail) => Object.freeze({
    ok: false,
    code: 'agent-runtime-tier-a-refused',
    detail: `the Tier A child carries no tools, no route override and no background lifetime — refused with zero reach (${detail})`,
  })
  /** One Tier A child start on the named bundle provider (`spawn` | `fork`). */
  const startTierA = (leg, providerName) => {
    const f = face(leg, ['subagents'], (svc) => (typeof svc.start === 'function' ? svc.start : undefined))
    if (f === null) return null
    return async ({ caller: c, spec, signal }) => {
      const agent = asAgent(c)
      if (agent === null) return CALLER_UNRESOLVED
      const carried = TIER_A_FORBIDDEN_SPEC_FIELDS.filter((field) => spec?.[field] !== undefined && spec?.[field] !== null
        && !(field === 'run_in_background' && spec[field] === false))
      if (carried.length > 0) return tierA(`request carried ${carried.join(', ')}`)
      if (!isSignal(signal)) return tierA('the walk carried no AbortSignal and SubagentStartRequest.signal is required (types.ts:156-163) — no never-aborted stand-in is invented')
      const mode = callerPtcMode(agent)
      if (mode !== 'native') {
        return Object.freeze({
          ok: false,
          code: 'agent-control-child-ptc-refused',
          detail: `the caller's tool view is ${mode === 'ptc' ? 'in PTC mode (run_code present)' : 'unreadable'}; a Tier A child would still receive the run_code transport — refused with zero reach`,
        })
      }
      const request = {
        label: String(spec?.description ?? 'governed-child').slice(0, 120),
        prompt: [{ type: 'text', text: String(spec?.prompt ?? '') }],
        parent: agent,
        signal,
        // FORCED (Tier A): zero inherited tools; never caller-chosen.
        toolFilter: TIER_A_CHILD_TOOL_FILTER,
      }
      const run = await f.svc.start(providerName, request)
      const view = childToolView(run)
      note(`child-toolview provider=${providerName} run=${String(run?.id)} tools=[${(view ?? ['<unreadable>']).join(',')}]`)
      if (view === null || view.length > 0) {
        try { await run?.dispose?.() } catch { /* the refusal stands */ }
        return Object.freeze({
          ok: false,
          code: 'agent-runtime-child-toolview-nonempty',
          detail: `the started child's visible tool list is ${view === null ? 'unreadable' : `[${view.join(',')}]`}, not empty — the run was disposed and the call refused (fail closed)`,
        })
      }
      let result
      let failure
      try {
        result = await run.result
      } catch (error) {
        failure = error
      }
      try { await run.dispose() } catch { /* settle with the run's own outcome */ }
      if (failure !== undefined) throw failure
      const text = textOf(result?.output)
      if (result?.stopReason !== 'completed') {
        return Object.freeze({
          ok: false,
          code: 'agent-runtime-child-error',
          detail: `the child ended with stopReason '${String(result?.stopReason)}'${typeof result?.diagnostic === 'string' ? ` (${result.diagnostic.slice(0, 200)})` : ''}; partial text: ${text.slice(0, 200)}`,
        })
      }
      return { kind: 'foreground', runId: String(run.id), output: Array.isArray(result?.output) ? result.output : [] }
    }
  }
  const legResolver = (leg) => {
    switch (leg) {
      case 'listAgents': {
        const f = face('listAgents', ['subagents'], (svc) => (typeof svc.listChildren === 'function' && typeof svc.listDescendants === 'function' ? svc.listChildren : undefined))
        if (f === null) return null
        return async ({ caller: c, scope, signal }) => {
          const agent = asAgent(c)
          if (agent === null) return CALLER_UNRESOLVED
          const id = agent.id
          if (typeof id !== 'string' || id.length === 0) return CALLER_UNRESOLVED
          const descendants = scope === 'descendants'
          const entries = descendants
            ? await f.svc.listDescendants(id, signal)
            : await f.svc.listChildren(id, signal)
          if (!Array.isArray(entries)) return { ok: false, code: 'agent-runtime-shape-unrecognized', detail: 'the subagent catalog answered a non-array — the contract refuses, never guesses' }
          // The native projection (tool-subagent-control/src/list-agents.ts:60-79):
          // one-shot children are traversal nodes the model never addresses,
          // diagnostics pass through.
          const agents = []
          let oneShot = 0
          for (const entry of entries) {
            const at = descendants ? { parent: entry?.parentId, depth: entry?.depth } : {}
            if (entry?.kind === 'diagnostic') { agents.push({ kind: 'diagnostic', id: entry.id, reason: entry.reason, ...at }); continue }
            if (entry?.mode !== 'continuable') { oneShot += 1; continue }
            agents.push({ kind: 'child', id: entry.id, label: entry.label, ...at })
          }
          note(`catalog-read count=${entries.length} oneShot=${oneShot}`)
          return { ok: true, scope: descendants ? 'descendants' : 'children', agents, catalogSize: entries.length, oneShotChildren: oneShot }
        }
      }
      case 'listModels': {
        const f = face('listModels', ['llm'], (svc) => (typeof svc.listProviders === 'function' && typeof svc.listModels === 'function' ? svc.listProviders : undefined))
        if (f === null) return null
        return async ({ provider }) => {
          const llm = f.svc
          if (provider === undefined) {
            const providers = llm.listProviders()
            return { ok: true, models: (Array.isArray(providers) ? providers : []).map((p) => ({ provider: p.id, name: p.name })), spawnRoutes: 'inherit-only' }
          }
          const models = await llm.listModels(provider)
          if (!Array.isArray(models)) return { ok: false, code: 'agent-runtime-shape-unrecognized', detail: 'llm.listModels answered a non-array' }
          // Q3 (measured): the pin answers model OBJECTS ({id,name,…}); a bare
          // string is projected to the same shape, never guessed further.
          return { ok: true, provider, models: models.map((m) => (typeof m === 'string' ? { id: m, name: m } : { id: m?.id, name: m?.name })), spawnRoutes: 'inherit-only' }
        }
      }
      case 'spawnChild': return startTierA('spawnChild', 'spawn')
      case 'forkChild': return startTierA('forkChild', 'fork')
      case 'steer': {
        const f = face('steer', ['agentTeams'], (svc) => (typeof svc.sendMessage === 'function' ? svc.sendMessage : undefined))
        if (f === null) return null
        return async ({ caller: c, targetId, message }) => {
          const agent = asAgent(c)
          if (agent === null) return CALLER_UNRESOLVED
          return await f.svc.sendMessage(agent, { target: targetId, content: [{ type: 'text', text: message }] })
        }
      }
      case 'interrupt': {
        const f = face('interrupt', ['agentTeams'], (svc) => (typeof svc.interrupt === 'function' ? svc.interrupt : undefined))
        if (f === null) return null
        return async ({ caller: c, targetId }) => {
          const agent = asAgent(c)
          if (agent === null) return CALLER_UNRESOLVED
          return await f.svc.interrupt(agent, targetId)
        }
      }
      default:
        // runWorkflow stays unwired at AC-1 (lane AC-4 owns workflowEngine):
        // the row refuses typed.
        return null
    }
  }
  return Object.freeze({
    portId: 'agent-runtime-host-port',
    legResolver,
    caller,
  })
}
