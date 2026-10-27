/**
 * agent-control-family/src/agent-control-executor.mjs — the governed
 * agent-control effect bodies (U7-F).
 *
 * OWNER ROLE (family lane, §4 Execution boundary, CI-06/CI-07): this is the
 * Family's EFFECT BODY. Every authority force arrives INJECTED — `decide`
 * (the lane verdict), `pa` (the Kernel's admission walk incl. the one-shot
 * consume edge), `policy` (template facts), the agent-runtime `port`, the
 * trusted `scopeFence` and `callerAuthority` — and the body NEVER calls them
 * as an afterthought around the effect. The order is LAW:
 *
 *   closed-argument parse → effect derivation → lane decide → default-deny
 *   re-check → FAMILY FENCES (scope / amplification / context-data) → the
 *   PA edge (admitCall → Control ask when required → grant → one-shot
 *   consume) → the port leg → the effect.
 *
 * A refusal at any earlier step is ZERO port calls (the fake spawner/messenger
 * records nothing), zero PA touch (no Control row is opened by a fence), and
 * a stable typed message with no stack. The port is never reached on a
 * refusal, exactly like the jobs producer is never reached on a kernel
 * refusal, and the PA edge is never reached on a fence refusal (fences are
 * the ADVISORY earlier-refusal — they can only refuse earlier, never admit).
 *
 * ONE-SHOT SPAWN LAW: the exec token ledger keys one correlation per
 * execution. A SECOND call carrying an already-settled token is a REPLAY and
 * refuses with `agent-control-replay-refused` — the consumed spawn grant is
 * spent and the port is NEVER asked a second time.
 *
 * @module agent-control-family/agent-control-executor
 */
import { parseRequestedEffectSet } from '../../../domain/tool-governance/src/index.js'
import {
  authorityBounded,
  classifyTargetScope,
  deriveAgentControlEffects,
  parseAgentControlArgs,
  scanContextAuthority,
  scopeMembership,
  workflowEffectWorld,
} from './agent-control-mechanics.mjs'
import { LEG_UNWIRED, resolveLeg } from './agent-runtime-port.mjs'

const refused = (code, detail) => ({ kind: 'refused', code, text: `refused-agent-control ${code} — ${detail}` })

/**
 * Build the seven governed executors for ONE mount. They share the exec-token
 * ledger and the mount nonce (one ledger per mount, like the image row's).
 *
 * @param {object} input
 * @param {string} input.realmId
 * @param {object} input.mountScope trusted {scopeKey} identity of THIS mount
 * @param {object} input.permissionPolicy the template policy (default + lanes)
 * @param {(effectSet: object) => {kind: string, code?: string}} input.decide
 * @param {Function|undefined} input.pa the plane PA edge (admit+consume)
 * @param {object} input.port the normalized agent-runtime port
 * @param {{members: string[]}|null} input.scopeFence durable roster (advisory)
 * @param {object|null} input.callerAuthority durable caller authority snapshot
 * @param {(() => object)|undefined} input.forkContextProvider assembly context DATA source
 * @param {(line: string) => void} input.observe
 */
export function createAgentControlExecutors(input) {
  const {
    realmId, mountScope, permissionPolicy, decide, pa, port,
    scopeFence, callerAuthority, forkContextProvider, observe = () => {},
  } = input
  const mountNonce = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`
  const tokenLedger = new Map()
  let paSeq = 0

  /** Shared walk up to (exclusive) the port leg. Returns either
   *  { ok: true, ... } or a refusal. */
  const govern = async (name, raw, corr) => {
    const parsed = parseAgentControlArgs(name, raw)
    if (!parsed.ok) return refused('agent-control-schema-refused', parsed.problems.join('; '))
    const arms = deriveAgentControlEffects(realmId, name, parsed.args)
    if (arms === null) return refused('agent-control-schema-refused', `no effect law for row '${name}'`)
    const verdict = decide({ effects: arms })
    if (verdict.kind === 'deny') return refused('agent-control-lane-denied', `the template lane denies this agent-control effect (${String(verdict.code)})`)
    if (permissionPolicy?.default === 'deny') {
      // The closed rule grammar names NO agent-control tool (PERMISSION_TOOL_NAMES),
      // so under a deny-default template policy no rule can cover these
      // tool-invoke arms: the honest answer is a typed refusal BEFORE the PA
      // edge (the same posture the center's own default-deny gate answers —
      // this row never reaches an unadmitted effect).
      return refused('template-default-deny', 'the template policy defaults to DENY and the closed rule grammar names no agent-control tool — an effect the policy never names is not an effect the policy allows')
    }

    // ── FAMILY FENCES (advisory, before PA, zero port) ──
    if (name === 'send_message' || name === 'interrupt_agent') {
      const scoped = classifyTargetScope(parsed.args.agent_id, mountScope)
      if (scoped.foreign === true) return refused('agent-control-scope-foreign', `target is outside this mount's scope (${scoped.detail}) — zero reach, nothing was probed`)
      const member = scopeMembership(scopeFence, scoped.id)
      if (!member.ok) return refused(member.code, member.detail)
      parsed.args.targetId = scoped.id
    }
    if (name === 'subagent') {
      const bound = authorityBounded(callerAuthority, {
        provider: parsed.args.provider, model: parsed.args.model, continuable: parsed.args.run_in_background === true,
      })
      if (!bound.ok) return refused('agent-control-amplification-refused', `a child may not carry broader authority than its caller: ${bound.violations.join('; ')}`)
    }
    if (name === 'subagent_fork') {
      const bound = authorityBounded(callerAuthority, {
        continuable: parsed.args.run_in_background === true,
      })
      if (!bound.ok) return refused('agent-control-amplification-refused', `a forked child may not carry broader authority than its caller: ${bound.violations.join('; ')}`)
      if (typeof forkContextProvider === 'function') {
        let context
        try {
          context = forkContextProvider()
        } catch {
          return refused('agent-control-context-authority-refused', 'the mount\'s fork context source faulted — context is DATA; a source that cannot prove it is data refuses the fork')
        }
        const tainted = scanContextAuthority(context ?? {})
        if (tainted.length > 0) {
          return refused('agent-control-context-authority-refused', `the fork context carries authority-shaped keys (${tainted.slice(0, 3).join(', ')}) — a forked child inherits CONVERSATION DATA, never grants`)
        }
        parsed.args.context = context ?? { kind: 'inherit-mount-conversation' }
      } else {
        parsed.args.context = { kind: 'inherit-mount-conversation' }
      }
    }

    // ── PA EDGE (one-shot consume lives INSIDE this injected edge) ──
    if (typeof pa !== 'function') {
      return refused('agent-control-pa-edge-unavailable', 'this mount carries no PA admission edge, so no agent-control effect may run (fail closed)')
    }
    const set = parseRequestedEffectSet(arms)
    if (!set.ok) return refused('agent-control-effect-set-rejected', JSON.stringify(set.problems).slice(0, 200))
    const tokenKey = typeof corr?.correlation === 'string' && corr.correlation.length > 0 ? corr.correlation : undefined
    let correlation
    if (tokenKey !== undefined) {
      const prior = tokenLedger.get(tokenKey)
      if (prior !== undefined) {
        // ONE-SHOT SPAWN LAW: the execution identity already settled (or is
        // in flight) — a second spawn request under one exec token refuses
        // with ZERO port calls. The consumed grant stays consumed.
        return refused('agent-control-replay-refused', `this execution token already carried an agent-control call (${prior.state}) — a consumed spawn grant never spawns twice`)
      }
      paSeq += 1
      correlation = `plane-ac:${mountNonce}-${String(paSeq)}`
      tokenLedger.set(tokenKey, { correlation, state: 'in-flight' })
    } else {
      paSeq += 1
      correlation = `plane-ac:${mountNonce}-${String(paSeq)}`
    }
    const gate = await pa({
      realmId,
      callId: correlation,
      ...(corr?.signal === undefined ? {} : { signal: corr.signal }),
      parametersFingerprint: set.value.fingerprint,
      requestedEffects: set.value,
    })
    if (tokenKey !== undefined) tokenLedger.set(tokenKey, { correlation, state: 'settled' })
    if (gate.kind === 'deny') {
      return refused(`agent-control-pa-${String(gate.code)}`, String(gate.detail ?? 'the PA execution edge refused this call'))
    }
    if (gate.kind === 'allow' && gate.cancelled === true) return { kind: 'cancelled' }
    return {
      ok: true,
      name,
      args: parsed.args,
      requestedEffects: set.value,
      correlation,
      signal: corr?.signal,
      // The DISPATCH-PROVIDED agent identity the row forwarded (the native
      // callingAgent law): trusted mount data, never a model argument.
      ...(corr?.agent === null || corr?.agent === undefined ? {} : { agent: corr.agent }),
    }
  }

  /** Complete the walk through the port leg. */
  const run = async (name, raw, corr, legName, invoke) => {
    const walked = await govern(name, raw, corr)
    if (walked.ok !== true) return walked
    const fn = resolveLeg(port, legName)
    if (fn === null) return refused(LEG_UNWIRED.code, `${LEG_UNWIRED.detail} (leg '${legName}')`)
    const caller = { realmId, templateId: input.templateId, instanceId: input.instanceId, ...(walked.agent === undefined ? {} : { agent: walked.agent }) }
    try {
      const result = await invoke(fn, caller, walked.args, walked)
      if (result !== null && typeof result === 'object' && result.ok === false) {
        return refused(`agent-control-runtime-${String(result.code ?? 'refused')}`, String(result.detail ?? 'the agent runtime refused the leg'))
      }
      observe(`agent-control-${name} RAN correlation=${walked.correlation}`)
      return { kind: 'ok', value: result }
    } catch (error) {
      return refused('agent-control-runtime-faulted', String(error?.message ?? error).slice(0, 200))
    }
  }

  const callerOf = (walked) => ({ realmId, templateId: input.templateId, instanceId: input.instanceId, ...(walked.agent === undefined ? {} : { agent: walked.agent }) })

  /** The workflow spawn leg: the SAME no-amplification fence guards every
   *  spawn a script takes (law (c) — no back door). Returns the guarded
   *  delegates the port's workflow driver must use for its agent legs. */
  const workflowLegs = (walked) => {
    const spawnDelegate = async (spec) => {
      // Law (c) AT THE LIVE LEG: the script's driver may not restate
      // authority through the delegate — the legs run as THIS caller and no
      // other, and every spawn re-passes the no-amplification fence below.
      const override = workflowEffectWorld(mountScope, spec)
      if (override.length > 0) return { ok: false, code: 'agent-control-amplification-refused', detail: `workflow spawn leg refused: ${override.join('; ')} (law (c): a workflow script spawns only through the caller-bound legs)` }
      const bound = authorityBounded(callerAuthority, {
        provider: spec?.provider, model: spec?.model, tools: spec?.tools, continuable: spec?.run_in_background === true,
      })
      if (!bound.ok) return { ok: false, code: 'agent-control-amplification-refused', detail: `workflow spawn leg refused: ${bound.violations.join('; ')}` }
      const fn = resolveLeg(port, 'spawnChild')
      if (fn === null) return LEG_UNWIRED
      return fn({ caller: callerOf(walked), spec: { ...(spec ?? {}), viaWorkflow: walked.correlation }, ...(walked.signal === undefined ? {} : { signal: walked.signal }) })
    }
    const steerDelegate = async (spec) => {
      const override = workflowEffectWorld(mountScope, spec)
      if (override.length > 0) return { ok: false, code: 'agent-control-amplification-refused', detail: `workflow steer leg refused: ${override.join('; ')}` }
      const scoped = classifyTargetScope(spec?.agent_id, mountScope)
      if (scoped.foreign === true) return { ok: false, code: 'agent-control-scope-foreign', detail: `workflow steer leg refused: ${scoped.detail}` }
      const member = scopeMembership(scopeFence, scoped.id)
      if (!member.ok) return { ok: false, code: member.code, detail: member.detail }
      const fn = resolveLeg(port, 'steer')
      if (fn === null) return LEG_UNWIRED
      return fn({ caller: callerOf(walked), targetId: scoped.id, message: String(spec?.message ?? '') })
    }
    return { spawn: spawnDelegate, steer: steerDelegate }
  }

  return Object.freeze({
    list_agents: (raw, corr) => run('list_agents', raw, corr, 'listAgents',
      (fn, cl) => fn({ caller: cl })),
    list_subagent_models: (raw, corr) => run('list_subagent_models', raw, corr, 'listModels',
      (fn, cl, args) => fn({ caller: cl, ...(args.provider === undefined ? {} : { provider: args.provider }) })),
    subagent: (raw, corr) => run('subagent', raw, corr, 'spawnChild',
      (fn, cl, args) => fn({ caller: cl, spec: args, ...(corr?.signal === undefined ? {} : { signal: corr.signal }) })),
    subagent_fork: (raw, corr) => run('subagent_fork', raw, corr, 'forkChild',
      (fn, cl, args) => fn({ caller: cl, spec: { description: args.description, prompt: args.prompt, ...(args.run_in_background === undefined ? {} : { run_in_background: args.run_in_background }) }, context: args.context, ...(corr?.signal === undefined ? {} : { signal: corr.signal }) })),
    send_message: (raw, corr) => run('send_message', raw, corr, 'steer',
      (fn, cl, args) => fn({ caller: cl, targetId: args.targetId, message: args.message })),
    interrupt_agent: (raw, corr) => run('interrupt_agent', raw, corr, 'interrupt',
      (fn, cl, args) => fn({ caller: cl, targetId: args.targetId, ...(args.reason === undefined ? {} : { reason: args.reason }) })),
    workflow: (raw, corr) => {
      const walkedP = govern('workflow', raw, corr)
      return Promise.resolve(walkedP).then((walked) => {
        if (walked.ok !== true) return walked
        const fn = resolveLeg(port, 'runWorkflow')
        if (fn === null) return refused(LEG_UNWIRED.code, `${LEG_UNWIRED.detail} (leg 'runWorkflow')`)
        const legs = workflowLegs(walked)
        return fn({
          caller: callerOf(walked),
          script: { description: walked.args.description, prompt: walked.args.prompt },
          spawn: legs.spawn,
          steer: legs.steer,
          enumerate: async () => {
            const roster = resolveLeg(port, 'listAgents')
            if (roster === null) return LEG_UNWIRED
            return roster({ caller: callerOf(walked) })
          },
          ...(walked.signal === undefined ? {} : { signal: walked.signal }),
        }).then((result) => {
          if (result !== null && typeof result === 'object' && result.ok === false) {
            return refused(`agent-control-runtime-${String(result.code ?? 'refused')}`, String(result.detail ?? 'the agent runtime refused the workflow'))
          }
          observe(`agent-control-workflow RAN correlation=${walked.correlation}`)
          return { kind: 'ok', value: result }
        }).catch((error) => refused('agent-control-runtime-faulted', String(error?.message ?? error).slice(0, 200)))
      })
    },
    /** Test/observation face: the exec-token ledger (one-shot proof). */
    tokenLedgerView: () => Object.fromEntries([...tokenLedger.entries()].map(([k, v]) => [k, v.state])),
  })
}
