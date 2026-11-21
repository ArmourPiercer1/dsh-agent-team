/**
 * world.mjs — the host-free C1 world for the AGENT-CONTROL family (UTE-3 / G1 B1).
 *
 * WHAT THE "OLD PATH" IS HERE, precisely (measured, not inherited — see
 * `probe-composition.mjs` and `dev/agent-workflow/evidence/ute3-agentctl-b1-20261121/`):
 *
 *   host        NONE. This world boots no host, sets no DSH_HOME, opens no port.
 *               It mounts THIS repository's governed plane source directly
 *               (`packages/runtime/src/plugin/live/team-tool-plane.mjs`), which
 *               is the code UTE-4 would retire.
 *   governance  the legacy governed plane + the FamilyAssembly seam + the
 *               `dsh.agent-control-family` descriptor, exactly as
 *               `packages/tools/families/agent-control.mjs` assembles it:
 *               ONE family, seven rows, fixed native spellings, the closed
 *               `agentControlEnabled` boolean.
 *   dispatch    the family's OWN row `execute`, with the dispatch-provided
 *               `exec.agent` / `exec.signal` / `exec.tokenKey` the host tool
 *               runner would supply.
 *
 * WHY NOT route-C: the Stage-0 probe measured that the product route-C attach
 * appends no agent-control shadow, so every one of the seven names is an
 * `unknown tool` refusal there (zero provider calls, zero guard facts). A
 * route-C fixture would therefore record the HOST's native rows, not the family
 * being retired. The old path for THIS family is the governed family body.
 *
 * The effect boundary is an INJECTED agent-runtime port (the family's own
 * public seam: `cap.injected.agentRuntime`). The port is a deterministic test
 * double that keeps REAL state (roster, per-agent inbox, created children,
 * workflow runs) and records EVERY call it receives. That gives each vector two
 * independent witnesses: the model-facing payload and the state change read
 * back afterwards. It does NOT prove host-side effects — §UNKNOWN in README.md.
 *
 * @module tests/ute-g1-agentctl/lib/world
 */
import { createHash } from 'node:crypto'
import { register } from 'node:module'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { REPO_ROOT } from './paths.mjs'

// The governed plane's TS sources are imported with `.js` specifiers; the same
// hook the repo's own test runner uses resolves them to their `.ts` siblings.
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const REALM = 'ute3-agentctl-realm'
const INSTANCE = 'ute3-agentctl-member'
const SCOPE_KEY = `${REALM}:${INSTANCE}`

/** The seven fixed native spellings the family claims (the census unit). */
export const AGENT_CONTROL_NAMES = Object.freeze([
  'subagent', 'subagent_fork', 'send_message', 'interrupt_agent',
  'list_agents', 'list_subagent_models', 'workflow',
])

/** The default template policy: every row asks, and the control leg approves. */
export const ASK_POLICY = Object.freeze({ default: 'ask', allow: [], ask: [], deny: [] })
/** A template that denies everything: the typed rule-grammar refusal. */
export const DENY_POLICY = Object.freeze({ default: 'deny', allow: [], ask: [], deny: [] })

/** The caller's trusted authority snapshot (no route/tool can be exceeded). */
export const CALLER_AUTHORITY = Object.freeze({
  providers: Object.freeze(['prov-a']),
  models: Object.freeze(['model-1', 'model-2']),
  tools: Object.freeze(['read', 'grep']),
  continuable: true,
})
/** The durable roster the owner fence consults. */
export const AGENT_SCOPE = Object.freeze({ scopeKey: SCOPE_KEY, members: Object.freeze(['member-alpha', 'member-beta']) })

/** Deterministic JSON: object keys sorted, no whitespace. */
export function stableJson(value) {
  return JSON.stringify(sortDeep(value))
}
function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) out[key] = sortDeep(value[key])
    return out
  }
  return value
}
export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stableJson(value)).digest('hex')
}

/**
 * A deterministic agent-runtime port with REAL state.
 *
 * @param {object} [options]
 * @param {readonly {id: string, label?: string, status: string}[]} [options.roster]
 * @param {string} [options.models]
 * @param {'authority-refused'|undefined} [options.listModelsRefusal]
 * @param {readonly {op: 'enumerate'|'spawn'|'steer', spec?: object}[]} [options.workflowPlan]
 */
export function makeAgentRuntime(options = {}) {
  const roster = (options.roster ?? [
    { id: 'member-alpha', label: 'alpha', status: 'running' },
    { id: 'member-beta', label: 'beta', status: 'inactive' },
  ]).map((entry) => ({ ...entry }))
  const models = options.models ?? 'prov-a/model-1 — model-1'
  const workflowPlan = options.workflowPlan ?? [{ op: 'enumerate' }, { op: 'spawn', spec: { description: 'workflow-child', prompt: 'fan out' } }]
  const state = { roster, inbox: {}, children: [], workflow: null }
  const calls = []
  let seq = 0

  const record = (leg, fields = {}) => {
    calls.push(Object.freeze({ leg, ...fields }))
  }
  const nextChild = (leg, spec) => {
    seq += 1
    const id = `member-child-${seq}`
    const label = String(spec?.description ?? 'child')
    state.roster.push({ id, label, status: 'running' })
    state.children.push({ id, leg, label, prompt: String(spec?.prompt ?? '') })
    return { id, seq }
  }

  const runtime = {
    calls,
    state,
    callsFor: (leg) => calls.filter((call) => call.leg === leg),
    listAgents: async ({ caller, scope } = {}) => {
      record('listAgents', { scope: scope ?? 'children' })
      return state.roster.map((entry) => ({ kind: 'child', id: entry.id, label: entry.label ?? entry.id, status: entry.status }))
    },
    listModels: async ({ caller, provider, model } = {}) => {
      record('listModels', { provider: provider ?? null, model: model ?? null })
      if (options.listModelsRefusal === 'authority-refused') {
        return { ok: false, code: 'agent-runtime-authority-refused', detail: `provider ${JSON.stringify(provider ?? null)} is outside the caller's discovery authority` }
      }
      return models
    },
    spawnChild: async ({ caller, spec } = {}) => {
      record('spawnChild', { description: spec?.description ?? null, provider: spec?.provider ?? null, model: spec?.model ?? null, background: spec?.run_in_background === true })
      const { id, seq: n } = nextChild('spawnChild', spec)
      return { kind: 'foreground', runId: `child-run-${n}`, subagentId: id, output: [{ type: 'text', text: `child-${n}` }] }
    },
    forkChild: async ({ caller, spec, context } = {}) => {
      record('forkChild', { description: spec?.description ?? null, context: context?.kind ?? null })
      const { id, seq: n } = nextChild('forkChild', spec)
      return { kind: 'foreground', runId: `fork-run-${n}`, subagentId: id, output: [{ type: 'text', text: `fork-${n}` }] }
    },
    steer: async ({ caller, targetId, message } = {}) => {
      record('steer', { targetId: targetId ?? null })
      const key = String(targetId ?? '')
      state.inbox[key] = [...(state.inbox[key] ?? []), String(message ?? '')]
      return { messageId: `message-${key}-${state.inbox[key].length}` }
    },
    interrupt: async ({ caller, targetId, reason } = {}) => {
      record('interrupt', { targetId: targetId ?? null, reason: reason ?? null })
      const target = state.roster.find((entry) => entry.id === targetId)
      if (target !== undefined) target.status = 'interrupted'
      return { accepted: true }
    },
    runWorkflow: async ({ caller, script, spawn, steer, enumerate } = {}) => {
      record('runWorkflow', { description: script?.description ?? null })
      const steps = []
      let started = 0
      for (const [index, step] of workflowPlan.entries()) {
        let result
        if (step.op === 'spawn') {
          result = await spawn(step.spec ?? {})
          if (result !== null && typeof result === 'object' && result.ok === false) {
            return { ok: false, code: String(result.code ?? 'agent-control-workflow-step-refused'), detail: String(result.detail ?? 'the workflow spawn leg refused') }
          }
          started += 1
        } else if (step.op === 'steer') {
          result = await steer(step.spec ?? {})
          if (result !== null && typeof result === 'object' && result.ok === false) {
            return { ok: false, code: String(result.code ?? 'agent-control-workflow-step-refused'), detail: String(result.detail ?? 'the workflow steer leg refused') }
          }
        } else {
          result = await enumerate()
        }
        steps.push({ index, op: step.op, ran: true })
      }
      state.workflow = { runId: 'workflow-run-1', agentsStarted: started, steps: steps.map((step) => step.op) }
      return { kind: 'foreground', runId: 'workflow-run-1', agentsStarted: started, result: { steps } }
    },
  }
  return runtime
}

/** The approving C1 control leg: lands the kernel's OWN plan for real (a
 *  fingerprint-bound one-shot grant through `assembly.issueApprovedGrant`).
 *  The semantics are the C1 stand-in described in
 *  `packages/runtime/test/a5-m1-control-legs.mjs`; this lane keeps its own copy
 *  so the fixture does not depend on another suite's file, and records only
 *  DECISIONS (case ids contain hashes; a golden never records them). */
export function landingControlLeg(audit = []) {
  return async ({ callId, request, plan, assembly }) => {
    audit.push('approve')
    const approval = {
      approvalCaseId: plan.approvalCaseId,
      reviewerAuthority: plan.requiredAuthority,
      beneficiaryAuthority: 'member',
      requiredAuthorityAtCreation: plan.requiredAuthority,
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGenerationAtCreation: plan.authorityGeneration,
      deniedEffectsAtCreation: plan.deniedEffects,
    }
    const issued = await assembly.issueApprovedGrant(request, approval)
    if (issued.ok !== true) return { decision: 'deny', requestId: `ute3-agentctl-${callId}`, detail: String(issued.error?.message ?? 'landing refused') }
    return { decision: 'approve', requestId: `ute3-agentctl-${callId}`, approval, grant: issued.value }
  }
}

/** The denying control leg: the request settles deny and the body never runs. */
export function denyingControlLeg(audit = []) {
  return async ({ callId }) => {
    audit.push('deny')
    return { decision: 'deny', requestId: `ute3-agentctl-${callId}` }
  }
}

let planeModule

/**
 * Build ONE governed agent-control world (one plane mount + one runtime).
 *
 * @param {object} [options]
 * @param {string} [options.label]
 * @param {object} [options.policy] template policy (default ASK_POLICY)
 * @param {object} [options.runtime] the injected agent-runtime port (default makeAgentRuntime())
 * @param {object|null} [options.agentScope] durable roster (default AGENT_SCOPE; null = not wired)
 * @param {object|null} [options.callerAuthority] trusted snapshot (default CALLER_AUTHORITY)
 * @param {Function} [options.forkContextProvider] assembly context DATA source
 * @param {'approve'|'deny'|'absent'} [options.control] the control leg (default approve)
 * @param {object} [options.planeCfg] extra/overriding plane config keys
 * @param {readonly string[]} [options.observeSink] receives the plane's observe lines
 * @returns {Promise<object>} the world
 */
export async function createAgentControlWorld(options = {}) {
  if (planeModule === undefined) planeModule = await import(`file://${join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'team-tool-plane.mjs')}`)
  const runtime = options.runtime ?? makeAgentRuntime()
  const audit = []
  const observe = options.observeSink ?? []
  const control = options.control ?? 'approve'
  const injected = {
    ...(options.noPort === true ? {} : { agentRuntime: runtime }),
    ...(options.agentScope === null ? {} : { agentScope: options.agentScope ?? AGENT_SCOPE }),
    ...(options.callerAuthority === null ? {} : { callerAuthority: options.callerAuthority ?? CALLER_AUTHORITY }),
    ...(options.forkContextProvider === undefined ? {} : { forkContextProvider: options.forkContextProvider }),
  }
  const built = planeModule.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'ute3-agentctl-team-root',
    permissionPolicy: options.policy ?? ASK_POLICY,
    realmId: REALM,
    templateId: 'worker',
    role: 'member',
    instanceId: INSTANCE,
    onObserve: (line) => observe.push(String(line)),
    fs: { subtreeContains: ({ parent, child }) => child === parent || child.startsWith(`${parent}/`) },
    plane: { agentControlEnabled: true, ...(options.planeCfg ?? {}) },
    backends: injected,
    ...(control === 'absent' ? {} : { controlLeg: control === 'deny' ? denyingControlLeg(audit) : landingControlLeg(audit) }),
  })
  if (built.ok !== true) throw new Error(`governed plane mount refused: ${built.code} ${String(built.message ?? '')}`)
  const plane = built.value
  const definitions = new Map(plane.definitions.map((definition) => [definition.name, definition]))
  return {
    label: options.label ?? 'vector',
    plane,
    definitions,
    runtime,
    audit,
    observe,
    policy: options.policy ?? ASK_POLICY,
    /** The mounted row names (the family claim set observed at registration). */
    names: plane.definitions.map((definition) => definition.name),
    /** Dispatch one row exactly as the host tool runner would. */
    async dispatch(name, args, exec = {}) {
      const definition = definitions.get(name)
      if (definition === undefined) throw new Error(`unknown agent-control row ${JSON.stringify(name)}`)
      return definition.execute(args ?? {}, exec)
    },
    /** The state read back from the injected port, normalized for a golden. */
    stateView() {
      const view = {
        roster: runtime.state.roster.map((entry) => `${entry.id}:${entry.status}`).sort(),
        inbox: Object.keys(runtime.state.inbox).sort().map((key) => `${key}:${runtime.state.inbox[key].length}:${[...runtime.state.inbox[key]].sort().join('|')}`),
        children: runtime.state.children.map((entry) => `${entry.id}:${entry.leg}:${entry.label}`).sort(),
        workflow: runtime.state.workflow === null ? null : { runId: runtime.state.workflow.runId, agentsStarted: runtime.state.workflow.agentsStarted, steps: runtime.state.workflow.steps },
      }
      return view
    },
    stateDigest() {
      return sha256({ state: this.stateView(), legs: runtime.calls.map((call) => call.leg).sort() })
    },
    /** The READABLE state read-back the fixture records: what actually changed
     *  in the injected port's real state, after the call. */
    stateCell() {
      const view = this.stateView()
      return [
        `roster=${view.roster.length === 0 ? '-' : view.roster.join('|')}`,
        `inbox=${view.inbox.length === 0 ? '-' : view.inbox.join('|')}`,
        `children=${view.children.length === 0 ? '-' : view.children.join('|')}`,
        `workflow=${view.workflow === null ? '-' : `${view.workflow.runId}:${view.workflow.agentsStarted}:${view.workflow.steps.join('>')}`}`,
      ].join(';')
    },
  }
}
