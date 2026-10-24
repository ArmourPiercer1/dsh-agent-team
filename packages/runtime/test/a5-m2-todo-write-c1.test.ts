/**
 * a5-m2-todo-write-c1 — Alpha.5 M2 row `todo_write (M-14)`, C1 level, per the
 * frozen family contract `m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md`
 * §3 B-SESSION (保留原生 + 统一前置接管) and §1.2 BASE.C1/C3, revised per the
 * root repair card (07:2x): REAL Host identity shapes, the REAL M1 A
 * (`runtime/tool-admission` — admitCall → planApproval/issueApprovedGrant →
 * the ONE consumeForExecution edge), snapshot execution + commit-edge
 * cancel/drain re-check.
 *
 * WHAT THIS FILE ACCEPTS (implements no new law beyond the landed arm):
 *  - the pinned host `todo_write` implementation AT 639ed01539 (loaded from
 *    the pristine test-use tree's compiled lib — tree pin asserted before any
 *    import; the host is NEVER booted; 段1/段3 runtime presence and C2/C3 on
 *    the real Host remain queued Host legs (README §6) — the A legs below are
 *    LANE-boundary evidence over the REAL kernel, not Host acceptance);
 *  - the REAL exec identity shapes: `exec.agent.id` (core/agent types.d.ts:13
 *    — Session-backed Agent identity) and `exec.agent.session.header.id`
 *    (core/session types.d.ts:64-65 — durable header single copy); NO invented
 *    words are readable anywhere (the old `agentIdentity`/`identity`
 *    vocabulary is gone with no shim — root card ①);
 *  - the REAL A assembly (`createProductionAdmissionAssembly`, the same class
 *    the production plane mounts) with the sibling-card fixture algebra
 *    (a5p2-fixtures binding/MEMBER; a5-m1-control-legs approving leg = the
 *    DISCLOSED C1 stand-in that still LANDS the kernel grant for real);
 *  - the closed-world Guard law + plane name gate (T3-T6, unchanged family).
 *
 * LEG MAP: T1-T9 + T14 host-plane facts (pinned, not endorsed) | T10/T11 the
 * FLIPPED landing proofs (typed governed refusals; host facts kept) | T12 the
 * REAL-A positive via landed approval (exactly one append, real fold, backend log) |
 * T13 classify negatives (real shapes) | T15 REAL deny + REAL ask-pending —
 * produced by the KERNEL, not by skipping stages (the root ruled a hand-skipped
 * prepare was NEVER approval evidence) | T16 REAL ask + landed approve leg +
 * same-grant re-entry refused twice over (kernel one-shot AND arm state) |
 * T17 same-tick cancel ≡ append count (commit-edge re-check) and post-commit
 * honesty | T18 replacement attacks (execute-function drift, binding-generation
 * drift, post-approval exec.agent replacement → snapshot routing, cross-pair
 * grant) | T19 M0 strict payload (deep freeze, full-value fingerprint) |
 * T20 DRAINING everywhere, no native fallback.
 *
 * Production registration/placement/mask (takeover ledger row, `todoEnabled`
 * consumer, glue) belongs to CENTER —
 * `dev/agent-workflow/evidence/alpha5/m2-todo/p-takeover-proposal.md`. Until
 * that lands and the Host C2 legs run, matrix ⑧ is NOT_IMPLEMENTED/NOT_WIRED.
 *
 * @module test/a5-m2-todo-write-c1
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA, TEST_USE_REL } from '../../../tests/paths.mjs'
import {
  GUARD_DENIAL_REASONS,
  createGovernedSurface,
  definitionIdentityOf,
  guardDecision,
  untestedAssurance,
} from '../tool-dispatch/index.js'
import {
  EFFECT_KINDS,
  parseRequestedEffectSet,
  parseToolBinding,
  type AdmissionRequest,
  type RequestedEffectSet,
  type ToolBinding,
} from '../../domain/tool-governance/src/index.js'
import { createGrantLedger, createProductionAdmissionAssembly } from '../tool-admission/index.js'
import { binding, MEMBER } from './a5p2-fixtures.js'
import { FIXED_NOW } from './a5p2-kernel-harness.js'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'
import type { TemplatePermissionPolicy } from '../../domain/blueprint/src/types.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const TREE = join(REPO, TEST_USE_REL)
const TODO_LIB = join(TREE, 'packages/todo/tool-todo/lib/index.js')
const TOOLS_LIB = join(TREE, 'packages/core/tools/lib/index.js')
const TODO_SRC = join(TREE, 'packages/todo/tool-todo/src/index.ts')

/** The status enum as ONE law (host index.ts:26), never restated per leg. */
const STATUSES = ['pending', 'in_progress', 'completed'] as const

/** The lane realm + the member's SessionId (Agent.id is Session-backed). */
const REALM_ID = 'realm-a5m2todo'
const SES_ID = 'ses-a5m2todo-1'

interface HostTool {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute(args: unknown, exec: unknown): Promise<{
    todos: { content: string; status: string }[]
    counts: { pending: number; inProgress: number; completed: number }
  }>
}
interface HostTodo {
  name: string
  inject: readonly string[]
  Config: (raw: unknown) => unknown
  apply(ctx: {
    tools: { register: (t: HostTool) => void }
    sessionProjections: { register: (p: ProjectionDef) => void }
  }, config: { allowParallelInProgress: boolean }): void
}
interface ProjectionDef {
  key: string
  init: () => unknown
  apply: (state: unknown, event: { type: string; data?: unknown }) => unknown
}
interface ProjectionEvent { type: string; data: { todos: { content: string; status: string }[] } }

type TodoPlan = object
interface TodoGrantView {
  grantId: string
  callId: string
  bindingId: string
  bindingRevision: number
  parametersFingerprint: string
}
interface ArmOutcome {
  ok: boolean
  code?: string
  detail?: string
  plan?: TodoPlan
  effects?: { kind: string; toolName: string; resource: null }[]
  manifest?: Record<string, unknown>
  reviewPayload?: Record<string, unknown>
  parametersFingerprint?: string
  value?: { todos: { content: string; status: string }[]; counts: { pending: number; inProgress: number; completed: number } }
  settled?: string
  appendOutcome?: string
}
interface TodoArmHandle {
  familyId: string
  adapterRevision: number
  definitionIdentity: string
  providerId: string
  classify(args: unknown, exec: unknown, callId: string): ArmOutcome
  prepare(plan: TodoPlan, grant?: { grantId: string }): ArmOutcome
  execute(plan: TodoPlan, consumed: { consumed: boolean; grant: TodoGrantView }): Promise<ArmOutcome>
  cancel(plan: TodoPlan): ArmOutcome
  drain(): void
}
const TODO_ARM = (await import(new URL('../src/plugin/live/governed-families/todo.mjs', import.meta.url).href)) as {
  A5_TODO_FAMILY_ID: string
  A5_TODO_OPERATION: string
  A5_TODO_TOOL_NAME: string
  A5_TODO_ADAPTER_REVISION: number
  A5_TODO_TYPED_CODES: Record<string, string>
  createGovernedTodoArm: (deps: {
    nativeDefinition: HostTool
    definitionIdentity: string
    providerId: string
    memberAgentId: string
    sessionHeaderId: string
    bindingFacts: () => { bindingId: string; bindingRevision: number; policyGeneration: number; authorityGeneration: number }
    allowParallelInProgress: boolean
    observe?: (row: { event: string; correlation: string; detail?: string }) => void
  }) => TodoArmHandle
}

let todo: HostTodo
let ToolArgsErrorName = ''
let libDigest = ''

beforeAll(async () => {
  // BINDING FIRST: the tree must still BE the pin, and the host source lines
  // this row's locator pack claims must still carry the law they were read
  // from (drift RED, re-read discipline — the pindir family precedent).
  const head = readFileSync(join(TREE, '.git/HEAD'), 'utf8').trim()
  expect(head, 'test-use tree must stay detached at the pinned baseline').toBe(TEST_USE_BASELINE_SHA)
  const src = readFileSync(TODO_SRC, 'utf8').split('\n')
  expect(src[25], 'host :26 status enum anchor').toContain("['pending', 'in_progress', 'completed']")
  expect(src[134], 'host :135 registration anchor').toContain('ctx.tools.register(defineTool({')
  expect(src[135], 'host :136 name anchor').toContain("name: 'todo_write'")
  expect(src[196], 'host :197 owning-session anchor').toContain('todo_write requires an owning agent session')
  libDigest = createHash('sha256').update(readFileSync(TODO_LIB)).digest('hex')
  todo = (await import(pathToFileURL(TODO_LIB).href)) as HostTodo
  const coreTools = (await import(pathToFileURL(TOOLS_LIB).href)) as { ToolArgsError: new (violations: string[]) => { name: string } }
  ToolArgsErrorName = new coreTools.ToolArgsError(['probe']).name
})

/** Captured real definition + real projection from one genuine registration. */
function mount(allowParallel: boolean, events: ProjectionEvent[]) {
  const tools: HostTool[] = []
  const projections: ProjectionDef[] = []
  todo.apply(
    {
      tools: { register: (t) => tools.push(t) },
      sessionProjections: { register: (p) => projections.push(p) },
    },
    { allowParallelInProgress: allowParallel },
  )
  // The registration contract of the pinned module: one apply registers
  // exactly one tool and one projection. State it, do not cast past it.
  const tool = tools[0]
  const projection = projections[0]
  if (tool === undefined || projection === undefined) {
    throw new Error(`pinned tool-todo registration contract broken: got ${tools.length} tool(s), ${projections.length} projection(s)`)
  }
  return { tool, projection, events }
}

/** The REAL Host runtime-face exec shape: `exec.agent.id` (Agent.id,
 * Session-backed) + `exec.agent.session` carrying the durable header (its
 * `.id` is the single durable copy) and the append entry the native body uses. */
function hostExec(agentId: string, headerId: string, events: ProjectionEvent[]) {
  return {
    agent: {
      id: agentId,
      session: {
        header: { id: headerId },
        append: (type: string, data: { todos: unknown }) => { events.push({ type, data: data as ProjectionEvent['data'] }) },
      },
    },
  }
}
type HostExec = ReturnType<typeof hostExec>

interface ArmFixture {
  tool: HostTool
  projection: ProjectionDef
  events: ProjectionEvent[]
  exec: HostExec
  arm: TodoArmHandle
  observed: { event: string; correlation: string; detail?: string }[]
  facts: { bindingId: string; bindingRevision: number; policyGeneration: number; authorityGeneration: number }
  paBinding: ToolBinding
  defIdentity: string
}

/** The arm over the captured native body, production-shaped: bind-time
 * capture of definition + identity facts + the injected M1 binding reader. */
function armFixture(allowParallel = true): ArmFixture {
  const events: ProjectionEvent[] = []
  const m = mount(allowParallel, events)
  const defIdentity = definitionIdentityOf(m.tool)
  if (defIdentity === null) throw new Error('fixture: the captured native body must carry a placement identity')
  const exec = hostExec(SES_ID, SES_ID, events)
  const paBinding = binding({
    bindingId: 'bind-todo-m2',
    agentScopeKey: SES_ID,
    toolName: 'todo_write',
    definitionIdentity: defIdentity,
    providerId: 'team-adapter',
  })
  const facts = {
    bindingId: paBinding.bindingId,
    bindingRevision: paBinding.revision,
    policyGeneration: paBinding.policyGeneration,
    authorityGeneration: paBinding.authorityGeneration,
  }
  const observed: { event: string; correlation: string; detail?: string }[] = []
  const arm = TODO_ARM.createGovernedTodoArm({
    nativeDefinition: m.tool,
    definitionIdentity: defIdentity,
    providerId: 'team-adapter',
    memberAgentId: SES_ID,
    sessionHeaderId: SES_ID,
    bindingFacts: () => ({ ...facts }),
    allowParallelInProgress: allowParallel,
    observe: (row) => { observed.push(row) },
  })
  return { tool: m.tool, projection: m.projection, events, exec, arm, observed, facts, paBinding, defIdentity }
}

const VALID_ARGS = { todos: [{ content: 'alpha', status: 'pending' }, { content: 'beta', status: 'in_progress' }] }
const TODO_EFFECTS = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: 'todo_write', resource: null }])
if (!TODO_EFFECTS.ok) throw new Error('fixture: the todo effect set must parse')
const EFFECT_SET: RequestedEffectSet = TODO_EFFECTS.value

/** The REAL M1 A assembly (the same class the production plane mounts). */
function paHarness(policy: TemplatePermissionPolicy) {
  const ledger = createGrantLedger()
  const built = createProductionAdmissionAssembly({
    permissionPolicy: policy,
    realmId: REALM_ID,
    templateId: 'tpl-m2todo',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    clock: () => FIXED_NOW,
    authorityGeneration: () => 1,
    beneficiaryAuthority: 'member',
    ledger,
  })
  if (!built.ok) throw new Error(`real production assembly refused the fixture policy: ${JSON.stringify(built.error).slice(0, 300)}`)
  return { assembly: built.value, ledger }
}
type Assembly = ReturnType<typeof paHarness>['assembly']
/** The kernel's OWN grant type — no local stand-in. */
type KernelGrant = Parameters<Assembly['consumeForExecution']>[0]

/** ONE documented widening (a5b3-cancel-leg precedent, in THIS file — the
 * shared declaration stays untouched): the leg `.d.mts` models the PLANE-seam
 * face (sync minimal landing edge); this card calls the leg DIRECTLY with the
 * real async assembly and the typed request — which the runtime honors (the
 * leg awaits the landing). Only the call face is widened; nothing is skipped. */
const runApprovingLeg = approvingControlLeg() as unknown as (input: {
  callId: string
  request: AdmissionRequest
  plan: unknown
  assembly: Assembly
}) => Promise<{ decision: string; grant?: unknown; detail?: string }>

function paRequest(f: ArmFixture, callId: string, fingerprint: string): AdmissionRequest {
  return {
    binding: f.paBinding,
    member: MEMBER,
    callId,
    realmId: REALM_ID,
    parametersFingerprint: fingerprint,
    requestedEffects: EFFECT_SET,
  }
}

/** The one-shot execution edge, verbatim shape of the write-card standard. */
function consumeEdge(assembly: Assembly, grant: KernelGrant, callId: string, fingerprint: string) {
  return assembly.consumeForExecution(grant, {
    currentAuthorityGeneration: 1,
    member: MEMBER,
    callId,
    realmId: REALM_ID,
    bindingId: grant.bindingId,
    bindingRevision: grant.bindingRevision,
    parametersFingerprint: fingerprint,
    requestedEffects: EFFECT_SET,
  })
}

/** arm.execute needs the grant VIEW; the kernel grant structurally satisfies
 * it (pairing fields are read by the arm, nothing is invented here). */
function grantView(grant: KernelGrant): TodoGrantView {
  return {
    grantId: grant.grantId,
    callId: grant.callId,
    bindingId: grant.bindingId,
    bindingRevision: grant.bindingRevision,
    parametersFingerprint: grant.parametersFingerprint,
  }
}

/** The centered positive lane for todo_write (see ASK_DEFAULT note): the real
 * kernel answers requires-approval, and the DISCLOSED C1 approving stand-in
 * LANDS the kernel grant for real (assembly.issueApprovedGrant). */
async function openApproved(f: ArmFixture, assembly: Assembly, callId: string, fingerprint: string): Promise<KernelGrant> {
  const request = paRequest(f, callId, fingerprint)
  const admitted = await assembly.admitCall(request)
  if (!admitted.ok || admitted.value.kind !== 'requires-approval') throw new Error(`${callId}: the ask lane must answer requires-approval, got ${admitted.ok ? admitted.value.kind : 'refusal'}`)
  const planned = assembly.planApproval(request)
  if (!planned.ok) throw new Error(`${callId}: planApproval must answer the pending request`)
  const leg = await runApprovingLeg({ callId, request, plan: planned.value, assembly })
  if (leg.decision !== 'approve' || leg.grant === undefined) throw new Error(`${callId}: the approving leg must land a grant: ${leg.detail ?? 'no detail'}`)
  return leg.grant as KernelGrant
}

type LaneRun =
  | { stage: 'classify'; out: ArmOutcome }
  | { stage: 'admit'; out: ArmOutcome }
  | { stage: 'approval'; out: ArmOutcome; plan: TodoPlan }
  | { stage: 'planApproval'; out: ArmOutcome; plan: TodoPlan }
  | { stage: 'denied'; out: ArmOutcome; plan: TodoPlan }
  | { stage: 'prepare'; out: ArmOutcome; plan: TodoPlan }
  | { stage: 'consume'; out: ArmOutcome; plan: TodoPlan }
  | { stage: 'executed'; out: ArmOutcome; plan: TodoPlan; assembly: Assembly; ledger: ReturnType<typeof createGrantLedger>; grant: KernelGrant; fingerprint: string }

/** The full lane run: classify → REAL admit → prepare → REAL consume edge →
 * arm execute. approve=true additionally drives the DISCLOSED C1 approving
 * stand-in (it LANDS the kernel grant for real via assembly.issueApprovedGrant
 * — no Control row / guardOperation, exactly the delta the AUTH bridge adds;
 * the bash card established this shape). */
async function runLane(f: ArmFixture, policy: TemplatePermissionPolicy, callId: string, opts: { args?: unknown; approve?: boolean } = {}): Promise<LaneRun> {
  const args = opts.args ?? VALID_ARGS
  const c = f.arm.classify(args, f.exec, callId)
  if (!c.ok || c.plan === undefined || c.parametersFingerprint === undefined) return { stage: 'classify', out: c }
  const fingerprint = c.parametersFingerprint
  const { assembly, ledger } = paHarness(policy)
  const request = paRequest(f, callId, fingerprint)
  const admitted = await assembly.admitCall(request)
  if (!admitted.ok) return { stage: 'admit', out: { ok: false, code: String(admitted.error?.code ?? 'ADMISSION_CALL_REFUSED') } }
  let grant: KernelGrant | undefined
  if (admitted.value.kind === 'admitted') {
    grant = admitted.value.grant
  } else if (admitted.value.kind === 'requires-approval') {
    if (opts.approve !== true) return { stage: 'approval', out: { ok: false, code: 'REQUIRES_APPROVAL_PENDING' }, plan: c.plan }
    const planned = assembly.planApproval(request)
    if (!planned.ok) return { stage: 'planApproval', out: { ok: false, code: 'PLAN_REFUSED' }, plan: c.plan }
    const leg = await runApprovingLeg({ callId, request, plan: planned.value, assembly })
    if (leg.decision !== 'approve' || leg.grant === undefined) return { stage: 'approval', out: { ok: false, code: 'APPROVAL_DENIED_BY_LEG', detail: leg.detail ?? 'no detail' }, plan: c.plan }
    grant = leg.grant as KernelGrant
  } else {
    return { stage: 'denied', out: { ok: false, code: String(admitted.value.error?.code ?? 'ADMISSION_DENIED'), detail: String(admitted.value.error?.message ?? '') }, plan: c.plan }
  }
  const prepared = f.arm.prepare(c.plan, { grantId: grant.grantId })
  if (!prepared.ok) return { stage: 'prepare', out: prepared, plan: c.plan }
  const edge = consumeEdge(assembly, grant, callId, fingerprint)
  if (!edge.ok) return { stage: 'consume', out: { ok: false, code: String(edge.error?.code ?? 'GRANT_CONSUMPTION_REFUSED') }, plan: c.plan }
  const executed = await f.arm.execute(c.plan, { consumed: true, grant: grantView(grant) })
  return { stage: 'executed', out: executed, plan: c.plan, assembly, ledger, grant, fingerprint }
}

const DENY_ALL: TemplatePermissionPolicy = { default: 'deny', allow: [], ask: [], deny: [] }
/** The only representable positive lane for THIS family (lane fact, reported
 * to CENTER): the blueprint `PermissionTool` closed set is
 * {read, read_image, write, edit, lsp, bash, pwsh} (domain/blueprint
 * types.ts:56-63) and the kernel projects each rule's tool-invoke arm as
 * `${realm}|tool:${permissionTool}` (admission-kernel.ts:830) — `todo_write`
 * is NOT nameable there, and `default: 'allow'` is rejected by the grammar
 * itself ("no silent privilege expansion", types.ts:106). Approval however
 * expands from the EFFECT's toolName (`${realm}|tool:todo_write`,
 * approval-case.ts:82), so the ask lane + a real approval answer is the
 * centered positive: every positive leg below rides ask→landed-approval. */
const ASK_DEFAULT: TemplatePermissionPolicy = { default: 'ask', allow: [], ask: [], deny: [] }

/** The fold the HOST registered (index.ts:120-133): write→list, turn/start→null. */
function readBack(m: { projection: ProjectionDef }, events: ProjectionEvent[]): unknown {
  return events.reduce((state: unknown, ev) => m.projection.apply(state, ev), m.projection.init())
}

function bindingFor(name: string, definitionIdentity: string, over: Partial<ToolBinding> = {}): ToolBinding {
  const parsed = parseToolBinding({
    bindingId: `inherited-native:${SES_ID}:${name}`,
    agentScopeKey: SES_ID,
    toolName: name,
    definitionIdentity,
    providerId: 'dsh-agent-team',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'trusted-host',
    assurance: untestedAssurance('team-trusted-extension', 'trusted-host'),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
    ...over,
  })
  if (!parsed.ok) throw new Error(`fixture binding invalid: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

const SCOPE = { agentScopeKey: SES_ID, trustedIdentities: [SES_ID] }
const PLANE = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  verifyPlaneNames: (names: Record<string, string>, readName: string) => { ok: boolean; code?: string }
  PLANE_RESERVED_NATIVE: readonly string[]
  PLANE_RESERVED_NATIVE_HOST_PIN: string
}

describe('a5-m2-todo-write-c1 — B-SESSION todo arm, root-card caliber (real shapes, real A, lane level, no Host)', () => {
  it('T1 real definition/provider binding: pinned apply captures the definition and its placement identity', () => {
    expect(existsSync(TODO_LIB), 'pristine host checkout required (same family as a5-pindir)').toBe(true)
    expect(todo.name).toBe('tool-todo')
    expect(libDigest).toMatch(/^[0-9a-f]{64}$/)
    const m = mount(true, [])
    expect(m.tool.name).toBe('todo_write')
    expect(m.tool.description).toContain('several only when work runs in parallel') // config:true clause
    const identity = definitionIdentityOf(m.tool)
    expect(typeof identity).toBe('string')
    expect(definitionIdentityOf(m.tool)).toBe(identity) // stable per body instance
    // Instance identity, NOT the name: a second registration of the same name
    // yields a DIFFERENT body identity — this is the algebra the Guard uses to
    // refuse same-name impersonation (T4). Identity is never the tool name.
    expect(definitionIdentityOf(mount(true, []).tool)).not.toBe(identity)
    expect(identity).not.toContain('todo_write')
  })

  it('T2 parameters shape is the frozen contract text: todos required, item content/status required, enum closed', () => {
    const m = mount(true, [])
    // defineTool compiles the ParameterSchemaSpec into an implicit OBJECT root
    // (core/tools schema.ts): the array law lives under properties.todos.
    const root = m.tool.parameters as {
      type: string
      required: string[]
      additionalProperties?: boolean
      properties: {
        todos: {
          type: string
          items: {
            additionalProperties: boolean
            required: string[]
            properties: { content: { type: string }; status: { type: string; enum?: string[] } }
          }
        }
      }
    }
    expect(root.type).toBe('object')
    expect(root.required).toEqual(['todos'])
    expect(root.properties.todos.type).toBe('array')
    expect(root.properties.todos.items.additionalProperties).toBe(false) // the ONLY closed layer (src :145)
    expect(root.properties.todos.items.required).toEqual(['content', 'status'])
    expect(root.properties.todos.items.properties.content.type).toBe('string')
    expect(root.properties.todos.items.properties.status.enum).toEqual([...STATUSES])
    // the root itself declares NO additionalProperties — the open-root gap the
    // landed arm refuses on the governed path (T10):
    expect(root.additionalProperties).toBeUndefined()
  })

  it('T3 plane state: reserved name on the pinned registry, and a plane row CLAIMING the name is typed-refused', () => {
    expect(PLANE.PLANE_RESERVED_NATIVE).toContain('todo_write')
    expect(PLANE.PLANE_RESERVED_NATIVE_HOST_PIN).toBe(`${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA.slice(0, 10)}`)
    const claim = PLANE.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }, 'todo_write')
    expect(claim.ok).toBe(false)
    expect(claim.code).toBe('PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED')
    const stray = PLANE.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash', todo: 'todo_write' } as never, 'read')
    expect(stray.ok).toBe(false)
    expect(stray.code).toBe('PLANE_NAMES_INVALID') // the names map stays closed to grep/glob/bash
  })

  it('T4 same-name forgery is refused by the real Guard law (drifted body + shadowed native, two typed codes)', () => {
    const surface = createGovernedSurface({ agentScopeKey: SES_ID })
    const bind = surface.bind({ name: 'todo_write', origin: 'inherited-native', binding: bindingFor('todo_write', 'pinned-identity'), verified: true })
    expect(bind.ok).toBe(true)
    const drifted = guardDecision({
      exec: { name: 'todo_write', agentIdentity: SES_ID },
      scope: SCOPE, surface, active: true, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'impersonator-identity' },
    })
    expect(drifted.kind).toBe('deny')
    expect(drifted.kind === 'deny' && drifted.reason).toBe(GUARD_DENIAL_REASONS.DEFINITION_DRIFT)
    const shadowed = createGovernedSurface({ agentScopeKey: SES_ID })
    shadowed.bind({ name: 'todo_write', origin: 'inherited-native', binding: bindingFor('todo_write', 'pinned-identity'), verified: false, unverifiedReason: 'native-shadowed' })
    const v2 = guardDecision({
      exec: { name: 'todo_write', agentIdentity: SES_ID },
      scope: SCOPE, surface: shadowed, active: true, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'pinned-identity' },
    })
    expect(v2.kind).toBe('deny')
    expect(v2.kind === 'deny' && v2.reason).toBe(GUARD_DENIAL_REASONS.NATIVE_SHADOWED)
  })

  it('T5 cross/absent identity is typed-refused on the name lane (NEG-2 family, no native fallback)', () => {
    const surface = createGovernedSurface({ agentScopeKey: SES_ID })
    surface.bind({ name: 'todo_write', origin: 'inherited-native', binding: bindingFor('todo_write', 'pinned-identity'), verified: true })
    const decide = (agentIdentity?: string) => guardDecision({
      exec: { name: 'todo_write', ...(agentIdentity !== undefined ? { agentIdentity } : {}) },
      scope: SCOPE, surface, active: true, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'pinned-identity' },
    })
    const absent = decide()
    expect(absent.kind === 'deny' && absent.reason).toBe(GUARD_DENIAL_REASONS.IDENTITY_ABSENT)
    const foreign = decide('session-OTHER')
    expect(foreign.kind === 'deny' && foreign.reason).toBe(GUARD_DENIAL_REASONS.IDENTITY_FOREIGN)
  })

  it('T6 unknown action spelling has no abstain arm (unbound todo_read, TEAM_TOOL_UNGOVERNED) and DRAINING refuses everything', () => {
    const surface = createGovernedSurface({ agentScopeKey: SES_ID })
    surface.bind({ name: 'todo_write', origin: 'inherited-native', binding: bindingFor('todo_write', 'pinned-identity'), verified: true })
    const stranger = guardDecision({
      exec: { name: 'todo_read', agentIdentity: SES_ID },
      scope: SCOPE, surface, active: true, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'x' },
    })
    expect(stranger.kind === 'deny' && stranger.reason).toBe(GUARD_DENIAL_REASONS.UNGOVERNED)
    const draining = guardDecision({
      exec: { name: 'todo_write', agentIdentity: SES_ID },
      scope: SCOPE, surface, active: false, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'pinned-identity' },
    })
    expect(draining.kind === 'deny' && draining.reason).toBe(GUARD_DENIAL_REASONS.NOT_ACTIVE)
  })

  it('T7 POSITIVE: owning-session governed write → event append, real projection read-back equals the result, last-write-wins', async () => {
    const m = mount(true, [])
    const exec = hostExec(SES_ID, SES_ID, m.events)
    const first = await m.tool.execute(VALID_ARGS, exec)
    expect(m.events).toHaveLength(1)
    expect(m.events[0]).toEqual({ type: 'todo/write', data: { todos: first.todos } })
    expect(first.counts).toEqual({ pending: 1, inProgress: 1, completed: 0 })
    expect(readBack(m, m.events)).toEqual(first.todos) // read-back = the HOST fold, not a copy
    const second = await m.tool.execute({ todos: [{ content: 'alpha', status: 'completed' }] }, exec)
    expect(readBack(m, m.events)).toEqual(second.todos) // whole-list replacement
    expect(second.counts).toEqual({ pending: 0, inProgress: 0, completed: 1 })
    expect(readBack(m, [...m.events, { type: 'turn/start', data: { todos: [] } }])).toBeNull() // fold's turn reset law
  })

  it('T8 negative (typed): illegal status enum and unknown ITEM key are ToolArgsError/INVALID_ARGS with ZERO appends', async () => {
    const m = mount(true, [])
    const exec = hostExec(SES_ID, SES_ID, m.events)
    const enumErr = await m.tool.execute({ todos: [{ content: 'x', status: 'doing' }] }, exec).then(
      () => { throw new Error('T8: an illegal status enum must reject, never resolve') },
      (e: unknown) => e as Error & { code?: string },
    )
    expect(enumErr.name).toBe(ToolArgsErrorName)
    expect(enumErr.code).toBe('INVALID_ARGS')
    expect(enumErr.message).toContain('must be one of')
    await expect(m.tool.execute({ todos: [{ content: 'x', status: 'pending', extra: 1 }] }, exec)).rejects.toThrow(/is not a declared property/)
    expect(m.events).toHaveLength(0) // zero side effects for both classes
  })

  it('T9 negative (config layer): allowParallelInProgress is required with NO default and must be boolean', () => {
    expect(() => todo.Config({})).toThrow(/missing required value/)
    expect(() => todo.Config({ allowParallelInProgress: 'yes' })).toThrow(/expected boolean/)
    expect(todo.Config({ allowParallelInProgress: false })).toEqual({ allowParallelInProgress: false })
  })

  it('T10 FLIPPED landing proof: governed path typed-refuses unknown TOP-LEVEL keys with ZERO appends (host-plane fact stays pinned, host is zero-byte)', async () => {
    const f = armFixture(true)
    const refused = f.arm.classify({ todos: [{ content: 'ok', status: 'pending' }], bogus_top_key: 42 }, f.exec, 'call-t10')
    expect(refused.ok).toBe(false)
    expect(refused.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.UNKNOWN_PARAMETER)
    expect(refused.detail).toContain('bogus_top_key')
    expect(f.events).toHaveLength(0) // the governed path appended nothing
    // HOST-PLANE FACT (pinned, not endorsed — the host schema layer still has
    // the implicit open root, src :138-157): the RAW native definition still
    // accepts the key and writes; the key is NOT consumed into the list.
    const raw = await f.tool.execute({ todos: [{ content: 'ok', status: 'pending' }], bogus_top_key: 42 }, f.exec)
    expect(f.events).toHaveLength(1)
    expect(raw.todos).toEqual([{ content: 'ok', status: 'pending' }])
  })

  it('T11 FLIPPED landing proof: typed refusal for a missing REAL session (no invented-word shim anywhere), host bare Error pinned', async () => {
    const f = armFixture(true)
    // exec WITHOUT the real shapes (no agent.id / session.header.id):
    const noCtx = f.arm.classify(VALID_ARGS, {}, 'call-t11a')
    expect(noCtx.ok).toBe(false)
    expect(noCtx.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NO_OWNING_SESSION)
    // the INVENTED words (`identity`/`agentIdentity`) from the pre-fix round
    // are unreadable — real Host shapes only, no compatibility shim (card ①):
    const invented = f.arm.classify(VALID_ARGS, { agent: { identity: SES_ID, session: { header: { id: SES_ID }, append: () => {} } } }, 'call-t11b')
    expect(invented.ok).toBe(false)
    expect(invented.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NO_OWNING_SESSION)
    // pairing failure on EITHER real fact is typed foreign, never a fallback:
    const foreignHeader = f.arm.classify(VALID_ARGS, hostExec(SES_ID, 'ses-OTHER-header', f.events), 'call-t11c')
    expect(foreignHeader.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.FOREIGN_SESSION)
    expect(f.events).toHaveLength(0)
    // HOST-PLANE FACT (pinned, not endorsed): the raw body still bare-throws.
    const rawErr = await f.tool.execute(VALID_ARGS, {}).then(
      () => { throw new Error('T11: the host body must bare-throw without an owning session') },
      (e: unknown) => e as Error & { code?: string },
    )
    expect(rawErr.name).toBe('Error')
    expect(rawErr.message).toContain('todo_write requires an owning agent session')
    expect(rawErr.code).toBeUndefined()
    expect(f.events).toHaveLength(0)
  })

  it('T12 REAL-A positive (lane-provable C2-shape): ask→landed approval→prepare→ONE consume edge→exactly one append, real fold read-back, backend log complete on one correlation', async () => {
    const f = armFixture(true)
    const r = await runLane(f, ASK_DEFAULT, 'call-t12', { approve: true })
    if (r.stage !== 'executed' || r.out.ok !== true) throw new Error(`T12: the real A lane must execute, got stage=${r.stage} code=${r.out.code ?? 'none'} detail=${r.out.detail ?? '-'}`)
    expect(r.out.value?.counts).toEqual({ pending: 1, inProgress: 1, completed: 0 })
    expect(f.events).toHaveLength(1) // EXACTLY one append, by the bound native body
    expect(f.events[0]).toEqual({ type: 'todo/write', data: { todos: r.out.value?.todos } })
    expect(readBack(f, f.events)).toEqual(r.out.value?.todos) // business result via the real host fold
    expect(r.ledger.consumedCount()).toBe(1) // the REAL one-shot ledger; no new ledger exists
    expect(f.observed.map((o) => o.event)).toEqual(['classify', 'admit', 'backend-start', 'backend-commit', 'backend-end'])
    expect(new Set(f.observed.map((o) => o.correlation)).size).toBe(1) // one invocation correlation
  })

  it('T13 classify negatives on the real shapes; HOST VALUE LAWS stay native (no parallel law)', () => {
    const f = armFixture(true)
    expect(f.arm.classify({ todos: 'not-array' }, f.exec, 'c1').code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.INVALID_ARGUMENTS)
    expect(f.arm.classify({ todos: [{ content: 'x', status: 'archived' }] }, f.exec, 'c2').code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.INVALID_ARGUMENTS)
    expect(f.arm.classify({ todos: [{ content: '   ', status: 'pending' }] }, f.exec, 'c3').code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.INVALID_ARGUMENTS)
    expect(f.arm.classify({ todos: [{ content: 'x', status: 'pending', extra: 1 }] }, f.exec, 'c4').code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.UNKNOWN_PARAMETER)
    expect(f.arm.classify(VALID_ARGS, f.exec, '').code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.INVALID_ARGUMENTS) // correlation required
    // duplicate content is the HOST BODY's value law (§1.1 no parallel law):
    // classify passes it through, the native body refuses at execute (T14).
    expect(f.arm.classify({ todos: [{ content: 'd', status: 'pending' }, { content: ' d ', status: 'completed' }] }, f.exec, 'c5').ok).toBe(true)
    expect(f.events).toHaveLength(0)
  })

  it('T14 runtime value tiers stay bare Errors at the host body (⑦ layering pinned) and only touch the append after validation', async () => {
    const s = mount(false, []) // single-active policy: the value laws below bind here
    const sexec = hostExec(SES_ID, SES_ID, s.events)
    await expect(s.tool.execute({ todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'in_progress' }] }, sexec)).rejects.toThrow(/at most one task may be in_progress/)
    await expect(s.tool.execute({ todos: [{ content: 'x', status: 'pending' }, { content: 'x', status: 'completed' }] }, sexec)).rejects.toThrow(/duplicate content/)
    await expect(s.tool.execute({ todos: [{ content: '  ', status: 'pending' }] }, sexec)).rejects.toThrow(/non-empty string/)
    expect(s.events).toHaveLength(0)
    // …while the SAME list is accepted under the parallel policy (config:true):
    const p = mount(true, [])
    await p.tool.execute({ todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'in_progress' }] }, hostExec(SES_ID, SES_ID, p.events))
    expect(p.events).toHaveLength(1)
  })

  it('T15 REAL deny and REAL ask-pending are produced by the kernel, not by skipping stages: typed answers, ZERO appends', async () => {
    const d = armFixture(true)
    const denied = await runLane(d, DENY_ALL, 'call-t15d')
    expect(denied.stage).toBe('denied') // the kernel's own expansion lane said deny
    expect(denied.out.ok).toBe(false)
    expect(d.events).toHaveLength(0)
    const a = armFixture(true)
    const pending = await runLane(a, ASK_DEFAULT, 'call-t15a') // NO approve: the real kernel says requires-approval
    expect(pending.stage).toBe('approval')
    expect(pending.out.code).toBe('REQUIRES_APPROVAL_PENDING')
    expect(a.events).toHaveLength(0)
    // pending holds NO grant: prepare without one is a typed refusal, and the
    // body stays unreachable — but this is STATE-HYGIENE; the pending PROOF is
    // the kernel answer above (root ruling: a hand-skipped prepare was never
    // approval evidence).
    if (!('plan' in pending)) throw new Error('T15: pending must carry the plan')
    const noGrant = a.arm.prepare(pending.plan)
    expect(noGrant.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NOT_ADMITTED)
    expect(a.events).toHaveLength(0)
  })

  it('T16 REAL ask + landed approve leg executes ONCE; the same consumed grant never re-fires (kernel one-shot AND arm state)', async () => {
    const f = armFixture(true)
    const r = await runLane(f, ASK_DEFAULT, 'call-t16', { approve: true })
    if (r.stage !== 'executed' || r.out.ok !== true) throw new Error(`T16: the landed approval leg must execute, got stage=${r.stage} code=${r.out.code ?? 'none'}`)
    expect(f.events).toHaveLength(1)
    expect(r.ledger.consumedCount()).toBe(1)
    // same-token re-entry #1 — the REAL kernel refuses a second consumption:
    const reConsume = consumeEdge(r.assembly, r.grant, 'call-t16', r.fingerprint)
    expect(reConsume.ok).toBe(false) // one-shot law: the grant is spent
    // same-token re-entry #2 — the arm state machine refuses a second execute:
    const reFire = await f.arm.execute(r.plan, { consumed: true, grant: grantView(r.grant) })
    expect(reFire.ok).toBe(false)
    expect(reFire.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.ALREADY_CONSUMED)
    expect(f.events).toHaveLength(1) // a re-fire can never double-commit
  })

  it('T17 same-tick cancel agrees with the append count (commit-edge re-check); post-commit cancel never rewrites', async () => {
    const f = armFixture(true)
    const c = f.arm.classify(VALID_ARGS, f.exec, 'call-t17a')
    if (!c.ok || c.plan === undefined || c.parametersFingerprint === undefined) throw new Error('T17: classify must succeed')
    const { assembly } = paHarness(ASK_DEFAULT)
    const grant = await openApproved(f, assembly, 'call-t17a', c.parametersFingerprint)
    expect(f.arm.prepare(c.plan, { grantId: grant.grantId }).ok).toBe(true)
    if (!consumeEdge(assembly, grant, 'call-t17a', c.parametersFingerprint).ok) throw new Error('T17: first consume edge must succeed')
    const running = f.arm.execute(c.plan, { consumed: true, grant: grantView(grant) })
    const z = f.arm.cancel(c.plan) // SAME tick: CLAIMED, body not entered
    expect(z.settled).toBe('CANCELLED-BEFORE-EXECUTION')
    expect(z.appendOutcome).toContain('zero')
    expect(f.events).toHaveLength(0) // report-time append = 0…
    const done = await running
    expect(done.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.CANCELLED)
    expect(f.events).toHaveLength(0) // …and post-settle append = 0: CONSISTENT (the pre-fix defect reported ALREADY-COMMITTED at 0, then wrote)
    // post-commit honesty: a committed plan says ALREADY-COMMITTED, append 1.
    const c2 = f.arm.classify({ todos: [{ content: 'z', status: 'pending' }] }, f.exec, 'call-t17b')
    if (!c2.ok || c2.plan === undefined || c2.parametersFingerprint === undefined) throw new Error('T17: second classify must succeed')
    const grant2 = await openApproved(f, assembly, 'call-t17b', c2.parametersFingerprint)
    expect(f.arm.prepare(c2.plan, { grantId: grant2.grantId }).ok).toBe(true)
    if (!consumeEdge(assembly, grant2, 'call-t17b', c2.parametersFingerprint).ok) throw new Error('T17: second consume edge must succeed')
    const x2 = await f.arm.execute(c2.plan, { consumed: true, grant: grantView(grant2) })
    expect(x2.ok).toBe(true)
    const z2 = f.arm.cancel(c2.plan)
    expect(z2.settled).toBe('ALREADY-COMMITTED')
    expect(f.events).toHaveLength(1) // the truth: one append rode the log
  })

  it('T18 replacement attacks after approval: execute-function drift and binding-generation drift are typed-refused; exec replacement cannot redirect the snapshot; a grant never crosses payloads', async () => {
    // (a) execute-PROPERTY replacement between the consume edge and the body
    //     entry → the edge re-check (captured function VALUE) refuses typed:
    const a = armFixture(true)
    const ca = a.arm.classify(VALID_ARGS, a.exec, 'call-t18a')
    if (!ca.ok || ca.plan === undefined || ca.parametersFingerprint === undefined) throw new Error('T18a: classify must succeed')
    const { assembly: asmA } = paHarness(ASK_DEFAULT)
    const grantA = await openApproved(a, asmA, 'call-t18a', ca.parametersFingerprint)
    expect(a.arm.prepare(ca.plan, { grantId: grantA.grantId }).ok).toBe(true)
    if (!consumeEdge(asmA, grantA, 'call-t18a', ca.parametersFingerprint).ok) throw new Error('T18a: consume edge must succeed')
    let spyRan = false
    a.tool.execute = async () => { spyRan = true; return { todos: [], counts: { pending: 0, inProgress: 0, completed: 0 } } } // property replacement POST-APPROVAL
    const drifted = await a.arm.execute(ca.plan, { consumed: true, grant: grantView(grantA) })
    expect(drifted.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.DEFINITION_DRIFT)
    expect(spyRan).toBe(false) // the replacement never runs (pre-fix: it DID run)
    expect(a.events).toHaveLength(0)
    // (b) binding-generation drift between classify and the edge:
    const b = armFixture(true)
    const cb = b.arm.classify(VALID_ARGS, b.exec, 'call-t18b')
    if (!cb.ok || cb.plan === undefined || cb.parametersFingerprint === undefined) throw new Error('T18b: classify must succeed')
    const { assembly } = paHarness(ASK_DEFAULT)
    const grant = await openApproved(b, assembly, 'call-t18b', cb.parametersFingerprint)
    expect(b.arm.prepare(cb.plan, { grantId: grant.grantId }).ok).toBe(true)
    if (!consumeEdge(assembly, grant, 'call-t18b', cb.parametersFingerprint).ok) throw new Error('T18b: consume edge must succeed')
    b.facts.bindingRevision += 1 // the M1 binding row advances under the approval
    const moved = await b.arm.execute(cb.plan, { consumed: true, grant: grantView(grant) })
    expect(moved.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.GRANT_MISMATCH)
    expect(b.events).toHaveLength(0)
    // (c) post-approval exec.agent replacement → snapshot routing: the append
    //     lands ONLY on the session classified for; foreign session stays empty:
    const f = armFixture(true)
    const cc = f.arm.classify(VALID_ARGS, f.exec, 'call-t18c')
    if (!cc.ok || cc.plan === undefined || cc.parametersFingerprint === undefined) throw new Error('T18c: classify must succeed')
    const { assembly: asmC } = paHarness(ASK_DEFAULT)
    const grantC = await openApproved(f, asmC, 'call-t18c', cc.parametersFingerprint)
    expect(f.arm.prepare(cc.plan, { grantId: grantC.grantId }).ok).toBe(true)
    if (!consumeEdge(asmC, grantC, 'call-t18c', cc.parametersFingerprint).ok) throw new Error('T18c: consume edge must succeed')
    // (d) SECOND plan on the SAME exec, classified while the exec is still
    //     original (同 exec 双票): its own plan exists but no matching
    //     consumed proof — it must never ride (c)'s grant:
    const other = f.arm.classify({ todos: [{ content: 'other', status: 'pending' }] }, f.exec, 'call-t18d')
    if (!other.ok || other.plan === undefined) throw new Error('T18d: classify must succeed')
    // APPROVAL PASSED on (c); now the live exec object has its agent slot swapped by a
    // FOREIGN session (the pre-fix arm wrote there):
    const foreignEvents: ProjectionEvent[] = []
    f.exec.agent = {
      id: 'ses-FOREIGN',
      session: {
        header: { id: 'ses-FOREIGN' },
        append: (type: string, data: { todos: unknown }) => { foreignEvents.push({ type, data: data as ProjectionEvent['data'] }) },
      },
    }
    const xc = await f.arm.execute(cc.plan, { consumed: true, grant: grantView(grantC) })
    expect(xc.ok).toBe(true)
    expect(f.events).toHaveLength(1) // snapshot routing: the classified session got the write
    expect(foreignEvents).toHaveLength(0) // the replaced object received NOTHING
    // (d) cont.: the second plan of the same exec attempts to ride (c)'s spent
    //     grant — pairing refuses, append count stays at ONE:
    expect(f.arm.prepare(other.plan, { grantId: grantC.grantId }).ok).toBe(true)
    const crossed = await f.arm.execute(other.plan, { consumed: true, grant: grantView(grantC) })
    expect(crossed.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.GRANT_MISMATCH)
    expect(f.events).toHaveLength(1) // still ONE append total
  })

  it('T19 M0 strict payload: deep-frozen reviewPayload, FULL-VALUE parametersFingerprint (never digest-only), effects-only vocabulary', () => {
    const f = armFixture(true)
    const c = f.arm.classify(VALID_ARGS, f.exec, 'call-t19')
    if (!c.ok || c.reviewPayload === undefined || c.parametersFingerprint === undefined) throw new Error('T19: classify must answer the payload')
    expect(c.effects).toEqual([{ kind: 'tool-invoke', toolName: 'todo_write', resource: null }])
    expect(EFFECT_KINDS).toContain('tool-invoke') // closed vocabulary, zero new kinds
    const parsed = parseRequestedEffectSet(c.effects)
    expect(parsed.ok).toBe(true) // the REAL domain parser accepts the classify output
    const payload = c.reviewPayload
    expect(payload.familyId).toBe(TODO_ARM.A5_TODO_FAMILY_ID)
    expect(payload.adapterRevision).toBe(TODO_ARM.A5_TODO_ADAPTER_REVISION)
    expect(payload.providerIdentity).toBe('team-adapter')
    expect(payload.definitionIdentity).toBe(f.defIdentity) // the `@` half, bound at bind time
    const manifest = payload.targetManifest as Record<string, unknown>
    expect(manifest.operation).toBe(TODO_ARM.A5_TODO_OPERATION)
    expect(manifest.agentId).toBe(SES_ID) // REAL Host ids live in the manifest
    expect(manifest.sessionHeaderId).toBe(SES_ID)
    expect(manifest.allowParallelPolicy).toBe(true)
    expect(String(manifest.todosDigest)).toMatch(/^[0-9a-f]{64}$/)
    // 载荷法: the fingerprint is NEVER the digest alone, and it moves with
    // FULL values — same list, different call correlation ⇒ different value:
    expect(c.parametersFingerprint).not.toBe(manifest.todosDigest)
    const same = f.arm.classify(VALID_ARGS, f.exec, 'call-t19-other')
    expect(same.ok && same.parametersFingerprint !== c.parametersFingerprint).toBe(true)
    // deep freeze ALL the way down (冻结 payload):
    expect(Object.isFrozen(c.reviewPayload)).toBe(true)
    expect(Object.isFrozen(manifest)).toBe(true)
    expect(Object.isFrozen(manifest.counts)).toBe(true)
    expect(Object.isFrozen(c.effects)).toBe(true)
    const firstEffect = c.effects?.[0]
    expect(firstEffect !== undefined && Object.isFrozen(firstEffect)).toBe(true)
    expect(Object.isFrozen(c.plan)).toBe(true)
  })

  it('T20 DRAINING everywhere: classify/prepare refuse, an already-claimed plan is stopped at the edge with append 0, no native fallback', async () => {
    const f = armFixture(true)
    const c = f.arm.classify(VALID_ARGS, f.exec, 'call-t20')
    if (!c.ok || c.plan === undefined || c.parametersFingerprint === undefined) throw new Error('T20: classify must succeed')
    const { assembly } = paHarness(ASK_DEFAULT)
    const grant = await openApproved(f, assembly, 'call-t20', c.parametersFingerprint)
    expect(f.arm.prepare(c.plan, { grantId: grant.grantId }).ok).toBe(true)
    if (!consumeEdge(assembly, grant, 'call-t20', c.parametersFingerprint).ok) throw new Error('T20: consume edge must succeed')
    const running = f.arm.execute(c.plan, { consumed: true, grant: grantView(grant) })
    f.arm.drain() // SAME tick: the commit-edge re-check must stop the body
    const done = await running
    expect(done.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.DRAINING)
    expect(f.events).toHaveLength(0) // append 0 ≡ reported 0; the body never ran
    expect(f.arm.classify(VALID_ARGS, f.exec, 'call-t20b').code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.DRAINING)
    expect(f.observed.some((o) => o.event === 'backend-start')).toBe(false) // no native call, no fallback
  })
})
