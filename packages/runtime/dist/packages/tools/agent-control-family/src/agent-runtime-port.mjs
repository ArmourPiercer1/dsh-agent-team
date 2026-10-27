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
 * The production resolver: build the leg provider from the mount's public
 * host-service face. NOTHING here imports host internals: the only outward
 * edge is `hostService(name)` — a lookup by the public service name, exactly
 * the seam the fs image row uses for `attachments`/`llm`. Every leg is
 * resolved AT CALL TIME (a service that mounts after assembly becomes
 * usable; one that goes away stops being usable — no stale handle rides).
 *
 * Pinned recognized faces (host-tools.json @ u1c sha256 35e2a63c…4f86, host
 * tree @ 639ed01539): the experimental Team face `agentTeams` answers
 * `listMembers(agent)` / `sendMessage(agent, {target, content})` /
 * `interrupt(agent, target)` / `spawnTeammate(agent, {name, description,
 * prompt, context, provider, signal})` (packages/experimental/tool-agent-team
 * /src/index.ts:215/232/277/180); the model face `llm` answers
 * `listProviders()` / `listModels(providerId)` (packages/subagent
 * /tool-subagent/src/list-models.ts:40/63 via `ctx.get('llm')`). The caller
 * is the DISPATCH-PROVIDED agent identity the row forwarded (`caller.agent`,
 * the native `callingAgent(exec.agent, …)` law) — never a model argument; a
 * call whose trusted agent identity did not arrive refuses typed with zero
 * reach. A face that resolves but answers a DIFFERENT shape contributes NO
 * leg — the row refuses `agent-runtime-leg-unwired`, never a guessed call.
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
  const legResolver = (leg) => {
    switch (leg) {
      case 'listAgents': {
        const f = face('listAgents', ['agentTeams'], (svc) => (typeof svc.listMembers === 'function' ? svc.listMembers : undefined))
        if (f === null) return null
        return async ({ caller: c }) => {
          const agent = asAgent(c)
          if (agent === null) return CALLER_UNRESOLVED
          const members = f.svc.listMembers(agent)
          const list = Array.isArray(members) ? members : null
          if (list === null) return { ok: false, code: 'agent-runtime-shape-unrecognized', detail: 'the roster face answered a non-array — the contract refuses, never guesses' }
          return { ok: true, agents: list }
        }
      }
      case 'listModels': {
        const f = face('listModels', ['llm'], (svc) => (typeof svc.listProviders === 'function' && typeof svc.listModels === 'function' ? svc.listProviders : undefined))
        if (f === null) return null
        return async ({ provider }) => {
          const llm = service('llm')
          if (provider === undefined) return { ok: true, models: llm.listProviders().map((p) => ({ provider: p.id, name: p.name })) }
          const models = await llm.listModels(provider)
          return { ok: true, models: Array.isArray(models) ? models : null }
        }
      }
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
      case 'spawnChild': {
        const f = face('spawnChild', ['agentTeams'], (svc) => (typeof svc.spawnTeammate === 'function' ? svc.spawnTeammate : undefined))
        if (f === null) return null
        // CARRY EXACTLY OR REFUSE (review R1 F-1): the pinned face
        // SpawnTeammateRequest is the CLOSED six-field record `name,
        // description, prompt, context, provider, signal`
        // (tests/deepseek-harness-test-use/packages/experimental/agent-team
        // /src/types.ts:166-173); at runtime the face REQUIRES a provider
        // string (roster.ts:264 `requiredText(request.provider, …)`) and
        // folds the caller's cancellation (roster.ts:256
        // `AbortSignal.any([request.signal, …])`). A bounded field the check
        // APPROVED that this face cannot carry is refused TYPED with zero
        // reach — silently dropping it would run a DIFFERENT child than the
        // one admitted; a face-required field the walk did not carry is
        // refused too — fabricating a route or a lifetime would restate the
        // approved world. Never a partial guess.
        const faceRefusal = (detail) => Object.freeze({
          ok: false,
          code: 'agent-runtime-port-face-cannot-carry',
          detail: `the approved effect world has no faithful spelling on the pinned host face — refused with zero reach, the child that would run is not the child that was admitted (${detail})`,
        })
        return async ({ caller: c, spec, signal }) => {
          const agent = asAgent(c)
          if (agent === null) return CALLER_UNRESOLVED
          const uncarryable = ['model', 'reasoning_effort', 'run_in_background']
            .filter((field) => spec?.[field] !== undefined && spec?.[field] !== null)
          if (uncarryable.length > 0) {
            return faceRefusal(`caller bounded ${uncarryable.join(', ')}; the face has no such field (types.ts:166-173) — the named follow-up center round (vNext roster face) carries them`)
          }
          if (typeof spec?.provider !== 'string' || spec.provider.length === 0) {
            return faceRefusal('the admitted world named no provider route, but the face requires one (roster.ts:264) — no default is expressible and none is invented')
          }
          if (signal === null || typeof signal !== 'object' || typeof signal.aborted !== 'boolean') {
            return faceRefusal('the walk carried no AbortSignal and the face folds one (roster.ts:256) — a never-aborted stand-in would restate the approved lifetime')
          }
          return await f.svc.spawnTeammate(agent, {
            name: String(spec?.description ?? 'governed-child').slice(0, 64),
            description: String(spec?.description ?? ''),
            prompt: [{ type: 'text', text: String(spec?.prompt ?? '') }],
            context: 'fresh',
            // The bounded provider forwards EXACTLY as approved (types.ts:171).
            provider: spec.provider,
            signal,
          })
        }
      }
      default:
        // forkChild / runWorkflow have NO recognized public service face at
        // the pinned host: the legs stay unwired and the rows refuse typed.
        // The C2 run records verbatim which legs a real mount answered.
        return null
    }
  }
  return Object.freeze({
    portId: 'agent-runtime-host-port',
    legResolver,
    caller,
  })
}
