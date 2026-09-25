/**
 * model-blueprint-initial-routing.test.ts — Gate E: the live-glue CORE
 * regression for the `modelPreference` routing fix (the model-preference
 * routing fix guide §6.5). This is the primary acceptance: the bound
 * Blueprint template's `modelPreference` must reach the REAL agent model
 * boundary (the `system-prompt/assemble` listener installed through DSH's
 * public `installModelSelection` seam) on EVERY first-use path — fresh
 * leader, fresh member (the fresh-create `templateIdHint` window), the
 * `team_delegate`-shape delegation create, the `team_create_member` →
 * `team_follow_up` arc, request boundaries, cold resume, and cross-root
 * isolation — and a durable human override must still beat it.
 *
 * THE DEFECT (pre-fix): the live request-boundary consumption resolved the
 * model cell WITHOUT the bound template's static model value, so a declared
 * `modelPreference` degraded to `unspecified` -> the `staticModel` baseline
 * — the template's declared model never reached the agent. The fix feeds
 * the SAME `initialTemplateModelGrantOf(template, config.staticModel)`
 * derivation (shared with the activation step-8 and the read-side
 * `readTemplatePolicy`) into the resolver's `template` static layer, with
 * the template LOCATE running BEFORE the model resolution (one locate
 * drives both the model and the mcp grants).
 *
 * Assertion surface: `observeAssembly(agentCtx)` invokes the REAL
 * `system-prompt/assemble` listener and returns the installed selection's
 * `provider` / `model` (the actual agent boundary). The consumption view
 * (`resolveConsumptionViews(...).modelView`) is the policy-level surface
 * (source layer / provenance / override precedence).
 *
 * House pattern: async world construction + action execution at the TOP
 * LEVEL (one block per scenario); every `it` asserts a captured constant
 * synchronously (the plain-node shim supports no async `it`).
 *
 * @module @dsh-agent-team/runtime/test/model-blueprint-initial-routing
 */
import { describe, expect, it } from 'vitest'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'
import { parseBlueprint, toBlueprintSnapshotRef } from '../../domain/blueprint/src/index.js'
import {
  WORKTREE_ROOT,
  createAgentPresetsDouble,
  createLiveWorld,
  observeAssembly,
  removeFixtureHome,
  withDshHome,
  writeDurableFixture,
  type AgentCtxDouble,
} from './t12a-live-bridge.mjs'

// ── the deployment default (staticModel) — the `unspecified` fallback ───────
const BASELINE = { provider: 'mp-baseline', model: 'mp-baseline-model' }

// ── the declared template model routes (qualified — explicit provider) ──────
const LEAD_MODEL = 'mp-lead/model-lead'
const WORK_MODEL = 'mp-work/model-work'
const EXPERT_MODEL = 'mp-expert/model-expert'
const MODEL_A = 'mp-a/model-a'
const MODEL_B = 'mp-b/model-b' // the durable human override item
const X_MODEL = 'mp-x/model-x'
const Y_MODEL = 'mp-y/model-y'

// ── blueprint builder (modelPreference on the template, LEGACY caps) ─────────
// Legacy (no `capabilities` block) keeps the focus on the model cell: the mcp
// initial grant is a separate concern covered by the mcp-blueprint-initial-
// grant suite and Gate D3. `modelPreference` is an independent template field.
interface Tpl {
  readonly templateId: string
  readonly persona: string
  readonly modelPreference?: string
}
function buildBlueprint(bpId: string, leader: Tpl, members: Tpl[]): string {
  const lines = [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    `  templateId: ${leader.templateId}`,
    `  persona: "${leader.persona}"`,
  ]
  if (leader.modelPreference !== undefined) lines.push(`  modelPreference: "${leader.modelPreference}"`)
  if (members.length === 0) {
    lines.push('members: []')
  } else {
    lines.push('members:')
    for (const m of members) {
      lines.push(`  - templateId: ${m.templateId}`, `    persona: "${m.persona}"`)
      if (m.modelPreference !== undefined) lines.push(`    modelPreference: "${m.modelPreference}"`)
    }
  }
  lines.push('requirements: []', 'memberEnvelopes: []', 'policyStates: []', 'metadata: {}', '---', '')
  return lines.join('\n')
}

/** A team-scope human-override MODEL allow (the durable tightening/override). */
function humanModelAllow(rootSessionId: string, recordId: string, items: string[]): GovernanceOverrideRecord {
  return parseGovernanceOverride({
    schemaVersion: 2,
    kind: 'human-override',
    recordId,
    scope: 'team',
    rootSessionId,
    values: { model: { kind: 'allow', items } },
    generation: 1,
    updatedAt: '2026-09-20T00:00:00.000Z',
  })
}

/** The no-MCP config overrides (the model cell is the sole focus). */
const NO_MCP = { mcpServer: null, mcpServers: [] }

/** Read the installed model selection off the real assemble listener. */
async function assembledModel(agentCtx: AgentCtxDouble): Promise<{ provider: unknown; model: unknown }> {
  const payload = (await observeAssembly(agentCtx)) as { variables: Record<string, unknown> } | undefined
  return { provider: payload?.variables?.provider, model: payload?.variables?.model }
}

// ===========================================================================
// World E1 (fresh leader) — the LEADER template declares a qualified
// modelPreference. After the fresh-root setup, the FIRST assembly must be
// the leader model (never the staticModel baseline).
// ===========================================================================
const E1_ROOT = 'mp-e1-root'
const E1_BLUEPRINT = buildBlueprint(
  'team.mp-e1',
  { templateId: 'leader', persona: 'You lead the mp-e1 team.', modelPreference: LEAD_MODEL },
  [],
)
const e1 = await createLiveWorld({
  rootSessionId: E1_ROOT,
  agentPresets: createAgentPresetsDouble(),
  overrides: [],
  configOverrides: { ...NO_MCP, staticModel: BASELINE, blueprintSource: E1_BLUEPRINT },
})
await e1.binding.boot()
const e1Leader = e1.agents.handles.get(E1_ROOT)!.agent.ctx
const e1LeaderAsm = await assembledModel(e1Leader)
const e1LeaderView = e1.binding.resolveConsumptionViews(E1_ROOT) as unknown as {
  modelView: { selection?: { provider: string; model: string }; source?: { layer?: string; origin?: string } }
}

// ===========================================================================
// World E2 (fresh member FIRST request, the fresh-create templateIdHint
// window) — the member row is NOT committed in the domain (the activation
// flow commits it only AFTER the child setup runs). The setup locates the
// template through the `templateIdHint` and must resolve the worker model
// from the bound snapshot — NOT fall back to the staticModel baseline.
// ===========================================================================
const E2_ROOT = 'mp-e2-root'
const E2_INST = 'inst-mp2w1'
const E2_BLUEPRINT = buildBlueprint(
  'team.mp-e2',
  { templateId: 'leader', persona: 'You lead the mp-e2 team.' },
  [{ templateId: 'worker', persona: 'You are the mp-e2 worker.', modelPreference: WORK_MODEL }],
)
// NO durable member row (the fresh-create window) — `members` starts empty.
const e2Members: Array<{ childSessionId: string; instanceId: string; templateId: string }> = []
const e2 = await createLiveWorld({
  rootSessionId: E2_ROOT,
  agentPresets: createAgentPresetsDouble(),
  members: e2Members,
  overrides: [],
  configOverrides: { ...NO_MCP, staticModel: BASELINE, blueprintSource: E2_BLUEPRINT },
})
await e2.binding.boot()
// The production create path: the glue child factory (the fresh-member setup
// runs in the fresh-create window under the hint — the row is not committed
// yet, so the locate MUST bridge through the templateIdHint).
const e2Created = await e2.binding.childFactory.createChildSession({
  rootSessionId: E2_ROOT,
  instanceId: E2_INST,
  label: 'mp-e2 worker',
  templateId: 'worker',
})
const E2_CHILD = String(e2Created.childSessionId)
const e2Worker = e2.agents.handles.get(E2_CHILD)!.agent.ctx
// The FIRST assembly (the fresh-create window — the row is NOT committed
// yet; the setup bridged through the templateIdHint).
const e2WorkerAsm = await assembledModel(e2Worker)
// Commit the durable row (the activation commits it moments after the
// setup) so the consumption VIEW can be re-resolved under the durable
// identity (a rootless re-resolution of an uncommitted row fails closed —
// the P0-1 contract, unchanged).
e2Members.push({ childSessionId: E2_CHILD, instanceId: E2_INST, templateId: 'worker' })
const e2WorkerView = e2.binding.resolveConsumptionViews(E2_CHILD) as unknown as {
  modelView: { selection?: { provider: string; model: string }; source?: { layer?: string; origin?: string } }
}

// ===========================================================================
// World E3 (direct team_delegate create form — the PRIMARY acceptance) —
// Leader -> team_delegate(delegationTemplateId=expert) -> fresh member ->
// FIRST member turn. The model-relevant production boundary of that arc is
// the glue child factory (the activation's post-commit binder install calls
// exactly this `createChildSession` in the fresh-create window); the bridge
// world's domain is a read-only double (no full durable team runtime), so
// the arc is driven at that SAME boundary. The FIRST member assembly must
// already be the expert model (no staticModel fallback, no governance
// workaround).
// ===========================================================================
const E3_ROOT = 'mp-e3-root'
const E3_INST = 'inst-mp3exp'
const E3_BLUEPRINT = buildBlueprint(
  'team.mp-e3',
  { templateId: 'leader', persona: 'You lead the mp-e3 team.' },
  [{ templateId: 'expert', persona: 'You are the mp-e3 expert.', modelPreference: EXPERT_MODEL }],
)
const e3Members: Array<{ childSessionId: string; instanceId: string; templateId: string }> = []
const e3 = await createLiveWorld({
  rootSessionId: E3_ROOT,
  agentPresets: createAgentPresetsDouble(),
  members: e3Members,
  overrides: [],
  configOverrides: { ...NO_MCP, staticModel: BASELINE, blueprintSource: E3_BLUEPRINT },
})
await e3.binding.boot()
// The Leader exists (the boot root). The delegation creates a FRESH expert.
const e3Created = await e3.binding.childFactory.createChildSession({
  rootSessionId: E3_ROOT,
  instanceId: E3_INST,
  label: 'mp-e3 expert (delegated)',
  templateId: 'expert',
})
const E3_CHILD = String(e3Created.childSessionId)
const e3Expert = e3.agents.handles.get(E3_CHILD)!.agent.ctx
// The FIRST member turn (the first assembly) already carries the expert model.
const e3ExpertAsm = await assembledModel(e3Expert)

// ===========================================================================
// World E4 (team_create_member -> first follow_up) — create the member with
// NO task (the fresh-create window, hint), then the FIRST follow_up boundary
// (prepareAgentForRequest) must RETAIN the template model (no staticModel
// reset, no governance workaround).
// ===========================================================================
const E4_ROOT = 'mp-e4-root'
const E4_INST = 'inst-mp4w1'
const E4_BLUEPRINT = buildBlueprint(
  'team.mp-e4',
  { templateId: 'leader', persona: 'You lead the mp-e4 team.' },
  [{ templateId: 'worker', persona: 'You are the mp-e4 worker.', modelPreference: WORK_MODEL }],
)
const e4Members: Array<{ childSessionId: string; instanceId: string; templateId: string }> = []
const e4 = await createLiveWorld({
  rootSessionId: E4_ROOT,
  agentPresets: createAgentPresetsDouble(),
  members: e4Members,
  overrides: [],
  configOverrides: { ...NO_MCP, staticModel: BASELINE, blueprintSource: E4_BLUEPRINT },
})
await e4.binding.boot()
const e4Created = await e4.binding.childFactory.createChildSession({
  rootSessionId: E4_ROOT,
  instanceId: E4_INST,
  label: 'mp-e4 worker (no task)',
  templateId: 'worker',
})
const E4_CHILD = String(e4Created.childSessionId)
const e4Worker = e4.agents.handles.get(E4_CHILD)!.agent.ctx
const e4FirstAsm = await assembledModel(e4Worker)
// Commit the durable row (the activation commits it moments after the setup)
// so the follow_up boundary can re-locate the template through the row.
e4Members.push({ childSessionId: E4_CHILD, instanceId: E4_INST, templateId: 'worker' })
// The first follow_up (request boundary).
await e4.binding.prepareAgentForRequest(E4_CHILD, E4_ROOT)
const e4FollowUpAsm = await assembledModel(e4Worker)

// ===========================================================================
// World E5 (next boundary retains the template model) — with NO override, a
// request boundary must NOT reset the model back to the staticModel baseline
// (the template grant is re-derived from the bound snapshot at every
// boundary).
// ===========================================================================
const E5_ROOT = 'mp-e5-root'
const E5_INST = 'inst-mp5w1'
const E5_BLUEPRINT = buildBlueprint(
  'team.mp-e5',
  { templateId: 'leader', persona: 'You lead the mp-e5 team.' },
  [{ templateId: 'worker', persona: 'You are the mp-e5 worker.', modelPreference: WORK_MODEL }],
)
const e5Members: Array<{ childSessionId: string; instanceId: string; templateId: string }> = []
const e5 = await createLiveWorld({
  rootSessionId: E5_ROOT,
  agentPresets: createAgentPresetsDouble(),
  members: e5Members,
  overrides: [],
  configOverrides: { ...NO_MCP, staticModel: BASELINE, blueprintSource: E5_BLUEPRINT },
})
await e5.binding.boot()
const e5Created = await e5.binding.childFactory.createChildSession({
  rootSessionId: E5_ROOT,
  instanceId: E5_INST,
  label: 'mp-e5 worker',
  templateId: 'worker',
})
const E5_CHILD = String(e5Created.childSessionId)
const e5Worker = e5.agents.handles.get(E5_CHILD)!.agent.ctx
const e5FirstAsm = await assembledModel(e5Worker)
e5Members.push({ childSessionId: E5_CHILD, instanceId: E5_INST, templateId: 'worker' })
// Several boundaries — the template model must survive every one.
await e5.binding.prepareAgentForRequest(E5_CHILD, E5_ROOT)
await e5.binding.prepareAgentForRequest(E5_CHILD, E5_ROOT)
const e5AfterBoundariesAsm = await assembledModel(e5Worker)

// ===========================================================================
// World E6 (a durable human override beats the template model) — created with
// template MODEL_A: request 1 = A. Write a durable human override MODEL_B:
// the NEXT boundary = B. Request 1's in-flight assembly snapshot is UNCHANGED
// (future-boundary semantics: an in-flight turn keeps its own assembly).
// ===========================================================================
const E6_ROOT = 'mp-e6-root'
const E6_INST = 'inst-mp6w1'
const E6_BLUEPRINT = buildBlueprint(
  'team.mp-e6',
  { templateId: 'leader', persona: 'You lead the mp-e6 team.' },
  [{ templateId: 'worker', persona: 'You are the mp-e6 worker.', modelPreference: MODEL_A }],
)
const e6Members: Array<{ childSessionId: string; instanceId: string; templateId: string }> = []
const e6Overrides: GovernanceOverrideRecord[] = []
const e6 = await createLiveWorld({
  rootSessionId: E6_ROOT,
  agentPresets: createAgentPresetsDouble(),
  members: e6Members,
  overrides: e6Overrides,
  configOverrides: { ...NO_MCP, staticModel: BASELINE, blueprintSource: E6_BLUEPRINT },
})
await e6.binding.boot()
const e6Created = await e6.binding.childFactory.createChildSession({
  rootSessionId: E6_ROOT,
  instanceId: E6_INST,
  label: 'mp-e6 worker',
  templateId: 'worker',
})
const E6_CHILD = String(e6Created.childSessionId)
const e6Worker = e6.agents.handles.get(E6_CHILD)!.agent.ctx
// Request 1 (the fresh-create first turn): template MODEL_A.
const e6Req1Asm = await assembledModel(e6Worker)
e6Members.push({ childSessionId: E6_CHILD, instanceId: E6_INST, templateId: 'worker' })
// Write the durable human override MODEL_B (the backend-truth mutation the
// next boundary re-reads).
e6Overrides.push(humanModelAllow(E6_ROOT, 'mp-e6-override-b', [MODEL_B]))
// Request 2 (the next boundary): the override beats the template.
await e6.binding.prepareAgentForRequest(E6_CHILD, E6_ROOT)
const e6Req2Asm = await assembledModel(e6Worker)
const e6Req2View = e6.binding.resolveConsumptionViews(E6_CHILD) as unknown as {
  modelView: { selection?: { provider: string; model: string }; source?: { layer?: string; origin?: string; recordId?: string | null } }
}

// ===========================================================================
// World E7 (cold resume, ZERO model override) — create phase -> host restart
// -> resume phase. The template model is RE-DERIVED from the immutable bound
// Blueprint on resume (no process-local ref, no synthetic override to lean
// on). The bridge's durable-fixture home stands in for the on-disk session.
// ===========================================================================
const E7_ROOT = 'mp-e7-root'
const E7_INST = 'inst-mp7w1'
const E7_CHILD = 'session-child-mp-e7-w1'
const E7_BLUEPRINT = buildBlueprint(
  'team.mp-e7',
  { templateId: 'leader', persona: 'You lead the mp-e7 team.' },
  [{ templateId: 'worker', persona: 'You are the mp-e7 worker.', modelPreference: MODEL_A }],
)
const E7_ROWS = [{ childSessionId: E7_CHILD, instanceId: E7_INST, templateId: 'worker' }]
const E7_SEEDS = [{ instanceId: E7_INST, templateId: 'worker', label: 'mp-e7 worker', childSessionId: E7_CHILD }]
async function buildE7World(bootPhase: 'create' | 'resume') {
  const world = await createLiveWorld({
    rootSessionId: E7_ROOT,
    agentPresets: createAgentPresetsDouble(),
    members: E7_ROWS,
    overrides: [],
    configOverrides: {
      bootPhase,
      ...NO_MCP,
      staticModel: BASELINE,
      blueprintSource: E7_BLUEPRINT,
      seedMembers: bootPhase === 'create' ? E7_SEEDS : [],
    },
  })
  if (bootPhase === 'resume') {
    const home = `${WORKTREE_ROOT}/.tmp-mp-e7-resume-home`
    await withDshHome(home, async () => {
      writeDurableFixture(home, E7_ROOT)
      writeDurableFixture(home, E7_CHILD)
      await world.binding.boot()
    })
    removeFixtureHome(home)
  } else {
    await world.binding.boot()
  }
  return world
}
const e7Create = await buildE7World('create')
const e7cLeader = e7Create.agents.handles.get(E7_ROOT)!.agent.ctx
const e7cWorker = e7Create.agents.handles.get(E7_CHILD)!.agent.ctx
const e7CreateLeaderAsm = await assembledModel(e7cLeader)
const e7CreateWorkerAsm = await assembledModel(e7cWorker)
const e7Resume = await buildE7World('resume')
const e7rLeader = e7Resume.agents.handles.get(E7_ROOT)!.agent.ctx
const e7rWorker = e7Resume.agents.handles.get(E7_CHILD)!.agent.ctx
const e7ResumeLeaderAsm = await assembledModel(e7rLeader)
const e7ResumeWorkerAsm = await assembledModel(e7rWorker)
const e7ResumeWorkerView = e7Resume.binding.resolveConsumptionViews(E7_CHILD) as unknown as {
  modelView: { selection?: { provider: string; model: string }; source?: { layer?: string; origin?: string } }
}

// ===========================================================================
// World E8 (cross-root isolation) — ONE plugin row, two team roots, each
// bound to its OWN blueprint (Team X leader MODEL_X; Team Y leader MODEL_Y).
// Each root's assembly must be its OWN model (no row-anchor / cross-root
// leak). The row anchor is Team X's blueprint — a resolver that fell back to
// it for Team Y would serve X's model on the wrong root.
// ===========================================================================
const E8_X_ROOT = 'mp-e8-x-root'
const E8_Y_ROOT = 'mp-e8-y-root'
const E8_X_BLUEPRINT = buildBlueprint(
  'team.mp-e8-x',
  { templateId: 'leader', persona: 'You lead the mp-e8-x team.', modelPreference: X_MODEL },
  [],
)
const E8_Y_BLUEPRINT = buildBlueprint(
  'team.mp-e8-y',
  { templateId: 'leader', persona: 'You lead the mp-e8-y team.', modelPreference: Y_MODEL },
  [],
)
const E8_X_REF = toBlueprintSnapshotRef(parseBlueprint(E8_X_BLUEPRINT))
const E8_Y_REF = toBlueprintSnapshotRef(parseBlueprint(E8_Y_BLUEPRINT))
const e8 = await createLiveWorld({
  rootSessionId: E8_X_ROOT,
  agentPresets: createAgentPresetsDouble(),
  teamSessions: [
    { rootSessionId: E8_X_ROOT, sessionId: E8_X_ROOT, blueprintId: E8_X_REF.blueprintId, generation: 1, blueprint: E8_X_REF },
    { rootSessionId: E8_Y_ROOT, sessionId: E8_Y_ROOT, blueprintId: E8_Y_REF.blueprintId, generation: 1, blueprint: E8_Y_REF },
  ],
  blueprintSources: [
    { blueprintId: E8_X_REF.blueprintId, revision: E8_X_REF.revision, source: E8_X_BLUEPRINT },
    { blueprintId: E8_Y_REF.blueprintId, revision: E8_Y_REF.revision, source: E8_Y_BLUEPRINT },
  ],
  overrides: [],
  configOverrides: {
    ...NO_MCP,
    staticModel: BASELINE,
    // The row anchor is Team X's blueprint — a row-anchor / boot-root leak
    // would give Team Y X's model.
    blueprintSource: E8_X_BLUEPRINT,
  },
})
await e8.binding.boot()
await e8.binding.createRootAgent(E8_Y_ROOT)
const e8XLeader = e8.agents.handles.get(E8_X_ROOT)!.agent.ctx
const e8YLeader = e8.agents.handles.get(E8_Y_ROOT)!.agent.ctx
const e8XAsm = await assembledModel(e8XLeader)
const e8YAsm = await assembledModel(e8YLeader)
const e8XView = e8.binding.resolveConsumptionViews(E8_X_ROOT) as unknown as { modelView: { selection?: { provider: string; model: string } } }
const e8YView = e8.binding.resolveConsumptionViews(E8_Y_ROOT) as unknown as { modelView: { selection?: { provider: string; model: string } } }

// ===========================================================================
// World E9 (no-preference control) — a LEGACY template with NO
// modelPreference: the model cell stays `unspecified` and the assembly is
// the `config.staticModel` deployment fallback (source = unspecified).
// Locks the compatibility contract (the fix must not change the no-
// preference behavior).
// ===========================================================================
const E9_ROOT = 'mp-e9-root'
const E9_BLUEPRINT = buildBlueprint(
  'team.mp-e9',
  { templateId: 'leader', persona: 'You lead the legacy mp-e9 team.' },
  [{ templateId: 'worker', persona: 'You are the legacy mp-e9 worker.' }],
)
const e9Members: Array<{ childSessionId: string; instanceId: string; templateId: string }> = [
  { childSessionId: 'session-child-mp-e9-w1', instanceId: 'inst-mp9w1', templateId: 'worker' },
]
const e9 = await createLiveWorld({
  rootSessionId: E9_ROOT,
  agentPresets: createAgentPresetsDouble(),
  members: e9Members,
  overrides: [],
  configOverrides: {
    ...NO_MCP,
    staticModel: BASELINE,
    blueprintSource: E9_BLUEPRINT,
    seedMembers: [
      { instanceId: 'inst-mp9w1', templateId: 'worker', label: 'mp-e9 legacy worker', childSessionId: 'session-child-mp-e9-w1' },
    ],
  },
})
await e9.binding.boot()
const e9Leader = e9.agents.handles.get(E9_ROOT)!.agent.ctx
const e9Worker = e9.agents.handles.get('session-child-mp-e9-w1')!.agent.ctx
const e9LeaderAsm = await assembledModel(e9Leader)
const e9WorkerAsm = await assembledModel(e9Worker)
const e9WorkerView = e9.binding.resolveConsumptionViews('session-child-mp-e9-w1') as unknown as {
  modelView: { selection?: { provider: string; model: string }; source?: { layer?: string; origin?: string } }
}

// ===========================================================================
// the matrix
// ===========================================================================

describe('E1 — fresh leader: the FIRST assembly is the leader template model', () => {
  it('the leader assembly carries the declared qualified route (provider + model)', () => {
    expect(e1LeaderAsm.provider).toBe('mp-lead')
    expect(e1LeaderAsm.model).toBe('model-lead')
    // Never the staticModel baseline.
    expect(e1LeaderAsm.provider).not.toBe(BASELINE.provider)
    expect(e1LeaderAsm.model).not.toBe(BASELINE.model)
  })
  it('the consumption view selection + provenance are the template/static layer', () => {
    expect(e1LeaderView.modelView.selection).toEqual({ provider: 'mp-lead', model: 'model-lead' })
    expect(e1LeaderView.modelView.source).toMatchObject({ layer: 'template', origin: 'static' })
  })
})

describe('E2 — fresh member FIRST request (the fresh-create templateIdHint window)', () => {
  it('the member FIRST assembly is the worker model (the row is NOT committed — the hint bridges it)', () => {
    expect(e2WorkerAsm.provider).toBe('mp-work')
    expect(e2WorkerAsm.model).toBe('model-work')
    expect(e2WorkerAsm.provider).not.toBe(BASELINE.provider)
    expect(e2WorkerAsm.model).not.toBe(BASELINE.model)
  })
  it('the consumption view selection + provenance are the template/static layer', () => {
    expect(e2WorkerView.modelView.selection).toEqual({ provider: 'mp-work', model: 'model-work' })
    expect(e2WorkerView.modelView.source).toMatchObject({ layer: 'template', origin: 'static' })
  })
})

describe('E3 — direct team_delegate (create form): the FIRST member turn uses the expert model', () => {
  it('the freshly delegated expert FIRST assembly is already the expert model (primary acceptance)', () => {
    expect(e3ExpertAsm.provider).toBe('mp-expert')
    expect(e3ExpertAsm.model).toBe('model-expert')
    // No staticModel fallback, no governance workaround.
    expect(e3ExpertAsm.provider).not.toBe(BASELINE.provider)
    expect(e3ExpertAsm.model).not.toBe(BASELINE.model)
  })
})

describe('E4 — team_create_member -> first follow_up retains the template model', () => {
  it('the create (no task) FIRST assembly is the worker model', () => {
    expect(e4FirstAsm.provider).toBe('mp-work')
    expect(e4FirstAsm.model).toBe('model-work')
  })
  it('the first follow_up boundary RETAINS the worker model (no staticModel reset)', () => {
    expect(e4FollowUpAsm.provider).toBe('mp-work')
    expect(e4FollowUpAsm.model).toBe('model-work')
    expect(e4FollowUpAsm.provider).not.toBe(BASELINE.provider)
  })
})

describe('E5 — the next boundary retains the template model (no override)', () => {
  it('the FIRST assembly is the worker model', () => {
    expect(e5FirstAsm.provider).toBe('mp-work')
    expect(e5FirstAsm.model).toBe('model-work')
  })
  it('after repeated boundaries the worker model is retained (never reset to the staticModel baseline)', () => {
    expect(e5AfterBoundariesAsm.provider).toBe('mp-work')
    expect(e5AfterBoundariesAsm.model).toBe('model-work')
    expect(e5AfterBoundariesAsm.provider).not.toBe(BASELINE.provider)
    expect(e5AfterBoundariesAsm.model).not.toBe(BASELINE.model)
  })
})

describe('E6 — a durable human override beats the template model', () => {
  it('request 1 (create) is the template MODEL_A', () => {
    expect(e6Req1Asm.provider).toBe('mp-a')
    expect(e6Req1Asm.model).toBe('model-a')
  })
  it('request 2 (the next boundary after the durable override) is MODEL_B', () => {
    expect(e6Req2Asm.provider).toBe('mp-b')
    expect(e6Req2Asm.model).toBe('model-b')
  })
  it('the request-1 in-flight assembly snapshot is UNCHANGED (future-boundary semantics)', () => {
    // The captured request-1 payload still carries MODEL_A — the in-flight
    // turn keeps its own assembly; only the NEXT assembly saw the override.
    expect(e6Req1Asm.provider).toBe('mp-a')
    expect(e6Req1Asm.model).toBe('model-a')
  })
  it('the request-2 consumption view is the humanOverride record (provenance)', () => {
    expect(e6Req2View.modelView.selection).toEqual({ provider: 'mp-b', model: 'model-b' })
    expect(e6Req2View.modelView.source?.layer).toBe('humanOverride')
    expect(e6Req2View.modelView.source?.recordId).toBe('mp-e6-override-b')
  })
})

describe('E7 — cold resume with ZERO model override re-derives the template model', () => {
  it('create phase: the worker FIRST assembly is the template MODEL_A', () => {
    expect(e7CreateWorkerAsm.provider).toBe('mp-a')
    expect(e7CreateWorkerAsm.model).toBe('model-a')
  })
  it('resume phase: the SAME template model survives the host restart (re-derived from the bound Blueprint, no process-local ref)', () => {
    expect(e7ResumeWorkerAsm.provider).toBe('mp-a')
    expect(e7ResumeWorkerAsm.model).toBe('model-a')
    expect(e7ResumeWorkerAsm.provider).not.toBe(BASELINE.provider)
  })
  it('the resume consumption view provenance is the template/static layer', () => {
    expect(e7ResumeWorkerView.modelView.selection).toEqual({ provider: 'mp-a', model: 'model-a' })
    expect(e7ResumeWorkerView.modelView.source).toMatchObject({ layer: 'template', origin: 'static' })
  })
  it('the leader (no preference) stays the staticModel baseline in both phases (control)', () => {
    expect(e7CreateLeaderAsm.provider).toBe(BASELINE.provider)
    expect(e7ResumeLeaderAsm.provider).toBe(BASELINE.provider)
  })
})

describe('E8 — cross-root isolation (each root uses its OWN bound blueprint model)', () => {
  it('Team X leader assembly is MODEL_X (its bound snapshot)', () => {
    expect(e8XAsm.provider).toBe('mp-x')
    expect(e8XAsm.model).toBe('model-x')
  })
  it('Team Y leader assembly is MODEL_Y (its OWN bound snapshot — never the row anchor / Team X model)', () => {
    expect(e8YAsm.provider).toBe('mp-y')
    expect(e8YAsm.model).toBe('model-y')
    expect(e8YAsm.provider).not.toBe('mp-x')
    expect(e8YAsm.model).not.toBe('model-x')
  })
  it('the consumption views agree per root (no reverse leak)', () => {
    expect(e8XView.modelView.selection).toEqual({ provider: 'mp-x', model: 'model-x' })
    expect(e8YView.modelView.selection).toEqual({ provider: 'mp-y', model: 'model-y' })
  })
})

describe('E9 — no-preference control: the model cell stays unspecified -> staticModel', () => {
  it('the leader (no modelPreference) assembly is the staticModel baseline', () => {
    expect(e9LeaderAsm.provider).toBe(BASELINE.provider)
    expect(e9LeaderAsm.model).toBe(BASELINE.model)
  })
  it('the legacy worker (no modelPreference) assembly is the staticModel baseline', () => {
    expect(e9WorkerAsm.provider).toBe(BASELINE.provider)
    expect(e9WorkerAsm.model).toBe(BASELINE.model)
  })
  it('the worker consumption view is the unspecified baseline (source = unspecified)', () => {
    expect(e9WorkerView.modelView.selection).toEqual({ provider: BASELINE.provider, model: BASELINE.model })
    expect(e9WorkerView.modelView.source?.layer).toBe('unspecified')
  })
})
