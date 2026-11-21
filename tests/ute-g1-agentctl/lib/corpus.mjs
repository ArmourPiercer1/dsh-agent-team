/**
 * corpus.mjs — the G1-AGENT-CONTROL golden-vector corpus (all seven members).
 *
 * One vector = one declared world + one invocation (or an explicitly listed
 * sequence) + the claims the old path must satisfy. The corpus is executed by
 * `capture-old-path.mjs` against the GOVERNED FAMILY BODY (see `lib/world.mjs`
 * and the Stage-0 probe) and recorded into `golden/old-path.tsv`.
 *
 * `entry` is the member that produced the effect, so the retirement unit's
 * member coverage is machine-derivable from the fixture's `entry` column
 * (scripts/ute-retirement-gate.mjs).
 *
 * THE UNIT IS SEVEN MEMBERS AND THIS CORPUS COVERS SEVEN. The Stage-0 probe
 * measured TWO implementations per member (a governed family body row at the
 * native spelling, plus the pinned host's native row) — so a real baseline is
 * owed for every member, and there is no exclusion. A corpus that quietly
 * dropped a member would be the under-claim the retirement gate refuses
 * (`UTE_MEMBER_UNCOVERED`).
 *
 * Six vectors per member, at minimum one of each required kind:
 *   success/effect · wrong-input refusal · permission/out-of-lane refusal ·
 *   abort/deadline. The extra two are member-specific: the authority fence, the
 *   one-shot exec-token law, the contract-bound refusal, or the unresolvable
 *   route. No vector is invented to fill a quota: each one exercises a path the
 *   family's own code has.
 *
 * `expect` is the DESIGN CLAIM, checked against the captured old path: a claim
 * the old path does not satisfy is a CORPUS BUG (RED), never a green. It is
 * never checked against the row's prose — the witnesses are the runtime port's
 * real state and call record plus the model-facing payload.
 *
 * @module tests/ute-g1-agentctl/lib/corpus
 */

import { CALLER_AUTHORITY, DENY_POLICY } from './world.mjs'

/** A caller bound to one-shot children: `run_in_background` is an amplification. */
const NON_CONTINUABLE = Object.freeze({ ...CALLER_AUTHORITY, continuable: false })

const spawnArgs = { description: 'delegate', prompt: 'do the delegated work' }
const forkArgs = { description: 'continue', prompt: 'build on the conversation' }

export const CORPUS = Object.freeze([
  /* ─────────────────────────────── subagent ─────────────────────────────── */
  {
    id: 'AC-SUB-1-spawn',
    entry: 'subagent',
    steps: [{ args: spawnArgs }],
    expect: { outcome: 'allow', refusal: null, calls: 1, control: 1, payloadContains: 'child-1', stateContains: 'member-child-1:spawnChild:delegate' },
    note: 'in-authority spawn: the port records ONE spawn, the returned payload names the child run, and the roster read back gained the child',
  },
  {
    id: 'AC-SUB-2-schema',
    entry: 'subagent',
    steps: [{ args: { ...spawnArgs, escalate: true } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 0, control: 0, payloadContains: undefined },
    note: 'closed argument grammar: an unknown field is refused WHOLE before the PA edge (zero control ask, zero port)',
  },
  {
    id: 'AC-SUB-3-amplification',
    entry: 'subagent',
    steps: [{ args: { ...spawnArgs, provider: 'forbidden-provider' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'no-amplification fence: a child route outside the caller snapshot is refused BEFORE the PA edge (zero control ask, zero spawn)',
  },
  {
    id: 'AC-SUB-4-template-deny',
    entry: 'subagent',
    policy: DENY_POLICY,
    steps: [{ args: spawnArgs }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'deny-default template: the closed rule grammar names no agent-control tool, so the row refuses typed before PA (zero port)',
  },
  {
    id: 'AC-SUB-5-abort',
    entry: 'subagent',
    steps: [{ args: spawnArgs, signal: 'aborted' }],
    expect: { outcome: 'deny', refusal: 'cancelled', calls: 0, control: 0 },
    note: 'cancellation before dispatch: the PA edge answers cancelled and the port is never asked',
  },
  {
    id: 'AC-SUB-6-replay',
    entry: 'subagent',
    steps: [{ args: spawnArgs, tokenKey: 'exec-sub-1' }, { args: spawnArgs, tokenKey: 'exec-sub-1' }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 1, control: 1 },
    note: 'ONE-SHOT exec-token law: the second call under a settled token refuses as a replay and the port stays at ONE spawn',
  },

  /* ───────────────────────────── subagent_fork ──────────────────────────── */
  {
    id: 'AC-FORK-1-inherit',
    entry: 'subagent_fork',
    steps: [{ args: forkArgs }],
    expect: { outcome: 'allow', refusal: null, calls: 1, control: 1, payloadContains: 'fork-1', stateContains: 'member-child-1:forkChild:continue' },
    note: 'in-authority fork: context is DATA (inherit-mount-conversation), the port records ONE fork, and the roster gained the child',
  },
  {
    id: 'AC-FORK-2-schema',
    entry: 'subagent_fork',
    steps: [{ args: { ...forkArgs, provider: 'prov-a' } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 0, control: 0 },
    note: 'the fork grammar carries NO route arm by shape: a provider field is an unknown field, refused whole',
  },
  {
    id: 'AC-FORK-3-context-authority',
    entry: 'subagent_fork',
    forkContextProvider: () => ({ kind: 'inherit-mount-conversation', grants: ['filesystem:any'] }),
    steps: [{ args: forkArgs }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'law (e): a context source that smuggles authority-shaped keys refuses the fork typed BEFORE the PA edge (zero fork)',
  },
  {
    id: 'AC-FORK-4-template-deny',
    entry: 'subagent_fork',
    policy: DENY_POLICY,
    steps: [{ args: forkArgs }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'deny-default template: typed refusal before PA, zero port',
  },
  {
    id: 'AC-FORK-5-abort',
    entry: 'subagent_fork',
    steps: [{ args: forkArgs, signal: 'aborted' }],
    expect: { outcome: 'deny', refusal: 'cancelled', calls: 0, control: 0 },
    note: 'cancellation before dispatch: the port never forks',
  },
  {
    id: 'AC-FORK-6-amplification',
    entry: 'subagent_fork',
    callerAuthority: NON_CONTINUABLE,
    steps: [{ args: { ...forkArgs, run_in_background: true } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'no-amplification fence: a background fork needs `continuable` in the caller snapshot; without it the fork refuses typed with zero port',
  },

  /* ───────────────────────────── send_message ───────────────────────────── */
  {
    id: 'AC-MSG-1-steer',
    entry: 'send_message',
    steps: [{ args: { agent_id: 'member-alpha', message: 'hello' } }],
    expect: { outcome: 'allow', refusal: null, calls: 1, control: 1, payloadContains: 'message-member-alpha-1', stateContains: 'inbox=member-alpha:1:hello' },
    note: 'in-roster steer: the port records ONE steer, the payload names the message, and the target inbox read back holds it',
  },
  {
    id: 'AC-MSG-2-schema',
    entry: 'send_message',
    steps: [{ args: { agent_id: 'member-alpha', message: 'hello', broadcast: true } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 0, control: 0 },
    note: 'closed argument grammar: a broadcast arm does not exist and is refused whole',
  },
  {
    id: 'AC-MSG-3-foreign',
    entry: 'send_message',
    steps: [{ args: { agent_id: 'foreign-scope:ghost-9', message: 'x' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'owner fence: a structurally foreign target refuses typed BEFORE the PA edge (zero control ask, zero steer)',
  },
  {
    id: 'AC-MSG-4-off-roster',
    entry: 'send_message',
    steps: [{ args: { agent_id: 'not-my-agent', message: 'x' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'durable-roster membership fence: a bare target off the roster refuses typed (the roster is trusted data, never a probe)',
  },
  {
    id: 'AC-MSG-5-template-deny',
    entry: 'send_message',
    policy: DENY_POLICY,
    steps: [{ args: { agent_id: 'member-alpha', message: 'hello' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'deny-default template: typed refusal before PA, zero port',
  },
  {
    id: 'AC-MSG-6-abort',
    entry: 'send_message',
    steps: [{ args: { agent_id: 'member-alpha', message: 'hello' }, signal: 'aborted' }],
    expect: { outcome: 'deny', refusal: 'cancelled', calls: 0, control: 0 },
    note: 'cancellation before dispatch: no steer reaches the port',
  },

  /* ──────────────────────────── interrupt_agent ─────────────────────────── */
  {
    id: 'AC-INT-1-interrupt',
    entry: 'interrupt_agent',
    steps: [{ args: { agent_id: 'member-beta', reason: 'budget' } }],
    expect: { outcome: 'allow', refusal: null, calls: 1, control: 1, payloadContains: 'accepted', stateContains: 'member-beta:interrupted' },
    note: 'in-roster interrupt: the port records ONE interrupt and the target STATUS read back changed running/inactive → interrupted',
  },
  {
    id: 'AC-INT-2-schema',
    entry: 'interrupt_agent',
    steps: [{ args: { agent_id: 'member-beta', urgency: 'now' } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 0, control: 0 },
    note: 'closed argument grammar: an unknown field is refused whole',
  },
  {
    id: 'AC-INT-3-foreign',
    entry: 'interrupt_agent',
    steps: [{ args: { agent_id: 'foreign-scope:ghost-9' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'owner fence: a foreign target refuses typed before PA (zero interrupt)',
  },
  {
    id: 'AC-INT-4-no-roster',
    entry: 'interrupt_agent',
    agentScope: null,
    steps: [{ args: { agent_id: 'member-alpha' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'fail closed: without a trusted roster, membership is unprovable and steer/interrupt refuse typed with zero port',
  },
  {
    id: 'AC-INT-5-template-deny',
    entry: 'interrupt_agent',
    policy: DENY_POLICY,
    steps: [{ args: { agent_id: 'member-beta' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'deny-default template: typed refusal before PA, zero port',
  },
  {
    id: 'AC-INT-6-abort',
    entry: 'interrupt_agent',
    steps: [{ args: { agent_id: 'member-beta' }, signal: 'aborted' }],
    expect: { outcome: 'deny', refusal: 'cancelled', calls: 0, control: 0 },
    note: 'cancellation before dispatch: no interrupt reaches the port',
  },

  /* ─────────────────────────────── list_agents ──────────────────────────── */
  {
    id: 'AC-LIST-1-enumerate',
    entry: 'list_agents',
    steps: [{ args: {} }],
    expect: { outcome: 'allow', refusal: null, calls: 1, control: 1, payloadContains: 'member-alpha' },
    note: 'authorized enumeration: the port records ONE roster read and the payload is the roster verbatim',
  },
  {
    id: 'AC-LIST-2-schema',
    entry: 'list_agents',
    steps: [{ args: { agent_id: 'member-alpha', message: 'shaped-like-a-steer' } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 0, control: 0 },
    note: 'enumeration ⊄ mutation: the closed grammar admits no mutation arm, so a mutation-shaped request is refused whole',
  },
  {
    id: 'AC-LIST-3-template-deny',
    entry: 'list_agents',
    policy: DENY_POLICY,
    steps: [{ args: {} }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'deny-default template: even pure enumeration refuses typed before PA (zero port)',
  },
  {
    id: 'AC-LIST-4-abort',
    entry: 'list_agents',
    steps: [{ args: {}, signal: 'aborted' }],
    expect: { outcome: 'deny', refusal: 'cancelled', calls: 0, control: 0 },
    note: 'cancellation before dispatch: the roster is not read',
  },
  {
    id: 'AC-LIST-5-no-port',
    entry: 'list_agents',
    noPort: true,
    steps: [{ args: {} }],
    expect: { outcome: 'deny', refusal: 'route-unresolved', calls: 0, control: 1 },
    note: 'unresolvable route: with no injected runtime and no host face, the leg is a typed UNWIRED refusal AFTER the PA edge (the route itself has no backend)',
  },
  {
    id: 'AC-LIST-6-descendants',
    entry: 'list_agents',
    steps: [{ args: { scope: 'descendants' } }],
    expect: { outcome: 'allow', refusal: null, calls: 1, control: 1, payloadContains: 'member-beta' },
    note: 'the native `scope` arm, closed to its two values: descendants is admitted and reaches the port with that scope',
  },

  /* ───────────────────────── list_subagent_models ───────────────────────── */
  {
    id: 'AC-MODELS-1-list',
    entry: 'list_subagent_models',
    steps: [{ args: {} }],
    expect: { outcome: 'allow', refusal: null, calls: 1, control: 1, payloadContains: 'prov-a/model-1' },
    note: 'authorized discovery: the port records ONE listModels and the payload is its string verbatim',
  },
  {
    id: 'AC-MODELS-2-schema',
    entry: 'list_subagent_models',
    steps: [{ args: { provider: 'prov-a', model: 'model-1', extra: true } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 0, control: 0 },
    note: 'closed argument grammar: an unknown field is refused whole',
  },
  {
    id: 'AC-MODELS-3-template-deny',
    entry: 'list_subagent_models',
    policy: DENY_POLICY,
    steps: [{ args: {} }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'deny-default template: typed refusal before PA, zero port',
  },
  {
    id: 'AC-MODELS-4-abort',
    entry: 'list_subagent_models',
    steps: [{ args: {}, signal: 'aborted' }],
    expect: { outcome: 'deny', refusal: 'cancelled', calls: 0, control: 0 },
    note: 'cancellation before dispatch: model discovery is not read',
  },
  {
    id: 'AC-MODELS-5-no-port',
    entry: 'list_subagent_models',
    noPort: true,
    steps: [{ args: {} }],
    expect: { outcome: 'deny', refusal: 'route-unresolved', calls: 0, control: 1 },
    note: 'unresolvable route: no injected runtime and no host llm face ⇒ typed UNWIRED refusal after the PA edge',
  },
  {
    id: 'AC-MODELS-6-authority',
    entry: 'list_subagent_models',
    runtime: { listModelsRefusal: 'authority-refused' },
    steps: [{ args: { provider: 'forbidden-provider' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 1, control: 1 },
    note: 'the port answers a typed authority refusal after the call is admitted; the row turns it into `agent-control-runtime-…` and the port recorded exactly ONE discovery attempt',
  },

  /* ─────────────────────────────── workflow ─────────────────────────────── */
  {
    id: 'AC-WF-1-run',
    entry: 'workflow',
    steps: [{ args: { description: 'orchestrate', prompt: 'fan out' } }],
    expect: { outcome: 'allow', refusal: null, calls: 3, control: 1, payloadContains: 'workflow-run-1', stateContains: 'workflow=workflow-run-1:1:enumerate>spawn' },
    note: 'in-authority workflow: the driver enumerates then spawns through the caller-bound delegate (runWorkflow + listAgents + spawnChild = THREE port calls, ONE PA ask)',
  },
  {
    id: 'AC-WF-2-schema',
    entry: 'workflow',
    steps: [{ args: { description: 'orchestrate', prompt: 'fan out', script: 'return 1' } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 0, control: 0 },
    note: 'closed argument grammar: the model cannot supply a script arm; an unknown field is refused whole',
  },
  {
    id: 'AC-WF-3-step-amplification',
    entry: 'workflow',
    runtime: { workflowPlan: [{ op: 'spawn', spec: { description: 'escalated', prompt: 'p', tools: ['write'] } }] },
    steps: [{ args: { description: 'orchestrate', prompt: 'fan out' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 1, control: 1 },
    note: 'law (c): a script step that asks for a tool outside the caller is refused by the delegate; runWorkflow ran once but NO spawnChild ran',
  },
  {
    id: 'AC-WF-4-template-deny',
    entry: 'workflow',
    policy: DENY_POLICY,
    steps: [{ args: { description: 'orchestrate', prompt: 'fan out' } }],
    expect: { outcome: 'deny', refusal: 'lane-deny', calls: 0, control: 0 },
    note: 'deny-default template: typed refusal before PA, zero port',
  },
  {
    id: 'AC-WF-5-abort',
    entry: 'workflow',
    steps: [{ args: { description: 'orchestrate', prompt: 'fan out' }, signal: 'aborted' }],
    expect: { outcome: 'deny', refusal: 'cancelled', calls: 0, control: 0 },
    note: 'cancellation before dispatch: the workflow driver is never started',
  },
  {
    id: 'AC-WF-6-replay',
    entry: 'workflow',
    steps: [{ args: { description: 'orchestrate', prompt: 'fan out' }, tokenKey: 'exec-wf-1' }, { args: { description: 'orchestrate', prompt: 'fan out' }, tokenKey: 'exec-wf-1' }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', calls: 3, control: 1 },
    note: 'ONE-SHOT exec-token law on the workflow row: the replay refuses and the port stays at the first run (runWorkflow + its enumerate + its one spawnChild)',
  },
])

/** Members present in the corpus (the retirement coverage is derived from `entry`). */
export const COVERED_MEMBERS = Object.freeze([...new Set(CORPUS.map((vector) => vector.entry))])

/** The required vector KINDS every member must declare at least once. */
export const REQUIRED_KINDS = Object.freeze({
  'success/effect': (vector) => vector.expect.outcome === 'allow',
  'wrong-input refusal': (vector) => vector.expect.outcome === 'deny' && vector.expect.category !== undefined ? vector.expect.category === 'invalid-argument' : vector.expect.refusal === 'invalid-argument',
  'permission/out-of-lane refusal': (vector) => vector.expect.outcome === 'deny' && vector.expect.refusal === 'lane-deny',
  'abort/deadline': (vector) => vector.expect.outcome === 'deny' && vector.expect.refusal === 'cancelled',
})

/** Which members declare which required kind (used by the lane suite). */
export function kindCoverage() {
  const out = {}
  for (const member of COVERED_MEMBERS) {
    out[member] = {}
    for (const [kind, predicate] of Object.entries(REQUIRED_KINDS)) {
      out[member][kind] = CORPUS.filter((vector) => vector.entry === member && predicate(vector)).map((vector) => vector.id)
    }
  }
  return out
}
