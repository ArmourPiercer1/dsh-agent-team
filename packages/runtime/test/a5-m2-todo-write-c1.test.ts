/**
 * a5-m2-todo-write-c1 — Alpha.5 M2 row `todo_write (M-14)`, C1 level, per the
 * frozen family contract `m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md`
 * §3 B-SESSION (保留原生 + 统一前置接管) and §1.2 共用 BASE.C1/C3.
 *
 * WHAT THIS FILE ACCEPTS (implements no new law beyond the landed arm):
 *  - the pinned host `todo_write` implementation AT 639ed01539 (loaded from
 *    the pristine test-use tree's compiled lib — the tree pin is asserted
 *    before any import; the host is NEVER booted and nothing here claims
 *    段1/段3 runtime-presence proof: preset-mount presence and session-log
 *    visibility are Host legs (C2a/C2b, README §5), queued for the single
 *    Host owner; the lane legs below are LANE-boundary evidence, not Host);
 *  - the closed-world Guard law (`tool-dispatch/closed-world-guard.ts`) for
 *    same-name forgery, foreign/absent identity, unbound names and DRAINING;
 *  - the plane name gate (`team-tool-plane.mjs` verifyPlaneNames) — `todo_write`
 *    is a reserved native name and a plane row claiming it is refused;
 *  - the LANDED P layer `src/plugin/live/governed-families/todo.mjs`
 *    (createGovernedTodoArm): classify/prepare/execute/cancel/drain.
 *
 * T10/T11 ARE THE FLIPPED LANDING PROOFS (the regression net of the first C1
 * round, inverted per its own instruction): on the GOVERNED path an unknown
 * TOP-LEVEL key and a missing owning session are typed refusals with zero
 * appends. The HOST-PLANE facts (open root accepts the key and the write
 * proceeds; the owning-session refusal is a bare Error at host :194-197) stay
 * pinned on their own legs — the host is zero-byte; pinned is not endorsed.
 *
 * Production registration/placement/mask (the takeover ledger row, the
 * `todoEnabled` consumer, the arm's glue) belongs to CENTER — proposal:
 * `dev/agent-workflow/evidence/alpha5/m2-todo/p-takeover-proposal.md`.
 * Until that lands and the Host C2 legs run, the matrix ⑧ is
 * NOT_IMPLEMENTED/NOT_WIRED (src exists; production assembly does not).
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
  type ToolBinding,
} from '../../domain/tool-governance/src/index.js'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const TREE = join(REPO, TEST_USE_REL)
const TODO_LIB = join(TREE, 'packages/todo/tool-todo/lib/index.js')
const TOOLS_LIB = join(TREE, 'packages/core/tools/lib/index.js')
const TODO_SRC = join(TREE, 'packages/todo/tool-todo/src/index.ts')

/** The status enum as ONE law (host index.ts:26), never restated per leg. */
const STATUSES = ['pending', 'in_progress', 'completed'] as const

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
type TodoTicket = object
interface ArmOutcome {
  ok: boolean
  code?: string
  detail?: string
  plan?: TodoPlan
  effects?: { kind: string; toolName: string; resource: null }[]
  manifest?: Record<string, unknown>
  ticket?: TodoTicket
  value?: { todos: { content: string; status: string }[]; counts: { pending: number; inProgress: number; completed: number } }
  settled?: string
  appendOutcome?: string
}
interface TodoArmHandle {
  familyId: string
  adapterRevision: number
  definitionIdentity: string
  classify(args: unknown, ctx: { agentIdentity: string | null; sessionIncarnation: string | null }): ArmOutcome
  prepare(plan: TodoPlan | undefined): ArmOutcome
  execute(ticket: TodoTicket | object, exec: unknown): Promise<ArmOutcome>
  cancel(target: TodoPlan | TodoTicket): ArmOutcome
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
    agentScopeKey: string
    trustedIdentities: readonly string[]
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
function mount(allowParallel: boolean) {
  const events: ProjectionEvent[] = []
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
  const exec = { agent: { identity: 'session-m1', session: { append: (type: string, data: { todos: unknown }) => { events.push({ type, data: data as ProjectionEvent['data'] }) } } } }
  return { tool, projection, events, exec }
}

/** The arm over the captured native body — the production shape CENTER's glue
 * will build at bind time (bind-time capture, never a name re-lookup). */
function arm(allowParallel = true) {
  const m = mount(allowParallel)
  const identity = definitionIdentityOf(m.tool)
  if (identity === null) throw new Error('fixture: the captured native body must carry a placement identity')
  const observed: { event: string; correlation: string; detail?: string }[] = []
  const handle = TODO_ARM.createGovernedTodoArm({
    nativeDefinition: m.tool,
    definitionIdentity: identity,
    providerId: 'dsh-agent-team',
    agentScopeKey: 'session-m1',
    trustedIdentities: ['session-m1', 'agent-m1'],
    allowParallelInProgress: allowParallel,
    observe: (row) => { observed.push(row) },
  })
  return { ...m, arm: handle, observed }
}

const CTX = { agentIdentity: 'session-m1', sessionIncarnation: 'session-m1' }
const VALID_ARGS = { todos: [{ content: 'alpha', status: 'pending' }, { content: 'beta', status: 'in_progress' }] }

/** The fold the HOST registered (index.ts:120-133): write→list, turn/start→null. */
function readBack(m: ReturnType<typeof mount>, events: ProjectionEvent[]): unknown {
  return events.reduce((state: unknown, ev) => m.projection.apply(state, ev), m.projection.init())
}

function bindingFor(name: string, definitionIdentity: string, over: Partial<ToolBinding> = {}): ToolBinding {
  const parsed = parseToolBinding({
    bindingId: `inherited-native:session-m1:${name}`,
    agentScopeKey: 'session-m1',
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

const SCOPE = { agentScopeKey: 'session-m1', trustedIdentities: ['session-m1', 'agent-m1'] }
const PLANE = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as {
  verifyPlaneNames: (names: Record<string, string>, readName: string) => { ok: boolean; code?: string }
  PLANE_RESERVED_NATIVE: readonly string[]
  PLANE_RESERVED_NATIVE_HOST_PIN: string
}

describe('a5-m2-todo-write-c1 — B-SESSION todo arm, BASE.C1 caliber (fixture + lane level, no Host)', () => {
  it('T1 real definition/provider binding: pinned apply captures the definition and its placement identity', () => {
    expect(existsSync(TODO_LIB), 'pristine host checkout required (same family as a5-pindir)').toBe(true)
    expect(todo.name).toBe('tool-todo')
    expect(libDigest).toMatch(/^[0-9a-f]{64}$/)
    const m = mount(true)
    expect(m.tool.name).toBe('todo_write')
    expect(m.tool.description).toContain('several only when work runs in parallel') // config:true clause
    const identity = definitionIdentityOf(m.tool)
    expect(typeof identity).toBe('string')
    expect(identity).not.toBeNull()
    expect(definitionIdentityOf(m.tool)).toBe(identity) // stable per body instance
    // Instance identity, NOT the name: a second registration of the same name
    // yields a DIFFERENT body identity — this is the algebra the Guard uses to
    // refuse same-name impersonation (T4). Identity is never the tool name.
    expect(definitionIdentityOf(mount(true).tool)).not.toBe(identity)
    expect(identity).not.toContain('todo_write')
  })

  it('T2 parameters shape is the frozen contract text: todos required, item content/status required, enum closed', () => {
    const m = mount(true)
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
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1' })
    const bind = surface.bind({ name: 'todo_write', origin: 'inherited-native', binding: bindingFor('todo_write', 'pinned-identity'), verified: true })
    expect(bind.ok).toBe(true)
    const drifted = guardDecision({
      exec: { name: 'todo_write', agentIdentity: 'session-m1' },
      scope: SCOPE, surface, active: true, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'impersonator-identity' },
    })
    expect(drifted.kind).toBe('deny')
    expect(drifted.kind === 'deny' && drifted.reason).toBe(GUARD_DENIAL_REASONS.DEFINITION_DRIFT)
    const shadowed = createGovernedSurface({ agentScopeKey: 'session-m1' })
    shadowed.bind({ name: 'todo_write', origin: 'inherited-native', binding: bindingFor('todo_write', 'pinned-identity'), verified: false, unverifiedReason: 'native-shadowed' })
    const v2 = guardDecision({
      exec: { name: 'todo_write', agentIdentity: 'session-m1' },
      scope: SCOPE, surface: shadowed, active: true, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'pinned-identity' },
    })
    expect(v2.kind).toBe('deny')
    expect(v2.kind === 'deny' && v2.reason).toBe(GUARD_DENIAL_REASONS.NATIVE_SHADOWED)
  })

  it('T5 cross/absent identity is typed-refused on the name lane (NEG-2 family, no native fallback)', () => {
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1' })
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
    const surface = createGovernedSurface({ agentScopeKey: 'session-m1' })
    surface.bind({ name: 'todo_write', origin: 'inherited-native', binding: bindingFor('todo_write', 'pinned-identity'), verified: true })
    const stranger = guardDecision({
      exec: { name: 'todo_read', agentIdentity: 'session-m1' },
      scope: SCOPE, surface, active: true, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'x' },
    })
    expect(stranger.kind === 'deny' && stranger.reason).toBe(GUARD_DENIAL_REASONS.UNGOVERNED)
    const draining = guardDecision({
      exec: { name: 'todo_write', agentIdentity: 'session-m1' },
      scope: SCOPE, surface, active: false, policyGeneration: 0, authorityGeneration: 0,
      definition: { ok: true, fingerprint: 'pinned-identity' },
    })
    expect(draining.kind === 'deny' && draining.reason).toBe(GUARD_DENIAL_REASONS.NOT_ACTIVE)
  })

  it('T7 POSITIVE: owning-session governed write → event append, real projection read-back equals the result, last-write-wins', async () => {
    const m = mount(true)
    const first = await m.tool.execute(VALID_ARGS, m.exec)
    expect(m.events).toHaveLength(1)
    expect(m.events[0]).toEqual({ type: 'todo/write', data: { todos: first.todos } })
    expect(first.counts).toEqual({ pending: 1, inProgress: 1, completed: 0 })
    expect(readBack(m, m.events)).toEqual(first.todos) // read-back = the HOST fold, not a copy
    const second = await m.tool.execute({ todos: [{ content: 'alpha', status: 'completed' }] }, m.exec)
    expect(readBack(m, m.events)).toEqual(second.todos) // whole-list replacement
    expect(second.counts).toEqual({ pending: 0, inProgress: 0, completed: 1 })
    expect(readBack(m, [...m.events, { type: 'turn/start', data: { todos: [] } }])).toBeNull() // fold's turn reset law
  })

  it('T8 negative (typed): illegal status enum and unknown ITEM key are ToolArgsError/INVALID_ARGS with ZERO appends', async () => {
    const m = mount(true)
    const enumErr = await m.tool.execute({ todos: [{ content: 'x', status: 'doing' }] }, m.exec).then(
      () => { throw new Error('T8: an illegal status enum must reject, never resolve') },
      (e: unknown) => e as Error & { code?: string },
    )
    expect(enumErr.name).toBe(ToolArgsErrorName)
    expect(enumErr.code).toBe('INVALID_ARGS')
    expect(enumErr.message).toContain('must be one of')
    await expect(m.tool.execute({ todos: [{ content: 'x', status: 'pending', extra: 1 }] }, m.exec)).rejects.toThrow(/is not a declared property/)
    expect(m.events).toHaveLength(0) // zero side effects for both classes
  })

  it('T9 negative (config layer): allowParallelInProgress is required with NO default and must be boolean', () => {
    expect(() => todo.Config({})).toThrow(/missing required value/)
    expect(() => todo.Config({ allowParallelInProgress: 'yes' })).toThrow(/expected boolean/)
    expect(todo.Config({ allowParallelInProgress: false })).toEqual({ allowParallelInProgress: false })
  })

  it('T10 FLIPPED landing proof: governed path typed-refuses unknown TOP-LEVEL keys with ZERO appends (host-plane fact stays pinned, host is zero-byte)', async () => {
    const a = arm(true)
    const refused = a.arm.classify({ todos: [{ content: 'ok', status: 'pending' }], bogus_top_key: 42 }, CTX)
    expect(refused.ok).toBe(false)
    expect(refused.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.UNKNOWN_PARAMETER)
    expect(refused.detail).toContain('bogus_top_key')
    expect(a.events).toHaveLength(0) // the governed path appended nothing
    // HOST-PLANE FACT (pinned, not endorsed — the host schema layer still has
    // the implicit open root, src :138-157): the RAW native definition still
    // accepts the key and writes; the key is NOT consumed into the list.
    const raw = await a.tool.execute({ todos: [{ content: 'ok', status: 'pending' }], bogus_top_key: 42 }, a.exec)
    expect(a.events).toHaveLength(1)
    expect(raw.todos).toEqual([{ content: 'ok', status: 'pending' }])
  })

  it('T11 FLIPPED landing proof: governed path typed-refuses a missing owning session (replacing the bare Error on THAT path) with ZERO appends', async () => {
    const a = arm(true)
    // classify lane: no agent in the trusted context
    const noCtx = a.arm.classify(VALID_ARGS, { agentIdentity: null, sessionIncarnation: null })
    expect(noCtx.ok).toBe(false)
    expect(noCtx.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NO_OWNING_SESSION)
    // execute lane: a real ticket consumed by an agent-less exec is refused
    // BEFORE the native body would bare-throw (host :194-197 never reached)
    const c = a.arm.classify(VALID_ARGS, CTX)
    expect(c.ok).toBe(true)
    if (c.plan === undefined) throw new Error('fixture: classify returned no plan')
    const p = a.arm.prepare(c.plan)
    expect(p.ok).toBe(true)
    if (p.ticket === undefined) throw new Error('fixture: prepare returned no ticket')
    const refused = await a.arm.execute(p.ticket, {})
    expect(refused.ok).toBe(false)
    expect(refused.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NO_OWNING_SESSION)
    expect(a.events).toHaveLength(0)
    // HOST-PLANE FACT (pinned, not endorsed): the raw body still bare-throws.
    const rawErr = await a.tool.execute(VALID_ARGS, {}).then(
      () => { throw new Error('T11: the host body must bare-throw without an owning session') },
      (e: unknown) => e as Error & { code?: string },
    )
    expect(rawErr.name).toBe('Error')
    expect(rawErr.message).toContain('todo_write requires an owning agent session')
    expect(rawErr.code).toBeUndefined()
    expect(a.events).toHaveLength(0)
  })

  it('T12 the landed classify emits the frozen §1.1 vocabulary only: I=tool-invoke on the exact name, resource null, parses clean, bound by definitionIdentity', () => {
    const a = arm(true)
    const out = a.arm.classify({ todos: [{ content: ' a ', status: 'in_progress' }] }, CTX)
    expect(out.ok).toBe(true)
    expect(out.effects).toEqual([{ kind: 'tool-invoke', toolName: 'todo_write', resource: null }])
    expect(out.effects?.map((e) => e.kind)).toEqual(['tool-invoke'])
    expect(EFFECT_KINDS).toContain('tool-invoke') // closed vocabulary, zero new kinds
    const parsed = parseRequestedEffectSet(out.effects)
    expect(parsed.ok).toBe(true) // the REAL domain parser accepts the classify output
    const manifest = out.manifest
    expect(manifest?.operation).toBe(TODO_ARM.A5_TODO_OPERATION)
    expect(manifest?.sessionIncarnation).toBe('session-m1') // trusted ctx, never a model field
    expect(manifest?.todosDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(manifest?.counts).toEqual({ pending: 0, inProgress: 1, completed: 0 })
    expect(manifest?.allowParallelPolicy).toBe(true) // the config fact in force is manifest-reported
    expect(manifest?.paramFingerprint).toBe(manifest?.todosDigest)
    // the `@` half of the I arm: identity bound at BIND time, never the name
    expect(a.arm.definitionIdentity).toBe(definitionIdentityOf(a.tool))
    expect(a.arm.familyId).toBe(TODO_ARM.A5_TODO_FAMILY_ID)
  })

  it('T13 landed classify negatives: foreign/absent session incarnation, off-enum and shape breaks are typed refusals; HOST VALUE LAWS stay native', () => {
    const a = arm(true)
    expect(a.arm.classify(VALID_ARGS, { agentIdentity: 'session-OTHER', sessionIncarnation: 'session-m1' }).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.FOREIGN_SESSION)
    expect(a.arm.classify(VALID_ARGS, { agentIdentity: 'session-m1', sessionIncarnation: 'session-OTHER' }).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.FOREIGN_SESSION)
    expect(a.arm.classify({ todos: 'not-array' }, CTX).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.INVALID_ARGUMENTS)
    expect(a.arm.classify({ todos: [{ content: 'x', status: 'archived' }] }, CTX).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.INVALID_ARGUMENTS)
    expect(a.arm.classify({ todos: [{ content: '   ', status: 'pending' }] }, CTX).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.INVALID_ARGUMENTS)
    expect(a.arm.classify({ todos: [{ content: 'x', status: 'pending', extra: 1 }] }, CTX).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.UNKNOWN_PARAMETER)
    // duplicate content is the HOST BODY's value law (§1.1 no parallel law):
    // classify passes it through, the native body refuses at execute (T14).
    expect(a.arm.classify({ todos: [{ content: 'd', status: 'pending' }, { content: ' d ', status: 'completed' }] }, CTX).ok).toBe(true)
    expect(a.events).toHaveLength(0)
  })

  it('T14 runtime value tiers stay bare Errors at the host body (⑦ layering pinned) and only touch the append after validation', async () => {
    const s = mount(false) // single-active policy: the value laws below bind here
    await expect(s.tool.execute({ todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'in_progress' }] }, s.exec)).rejects.toThrow(/at most one task may be in_progress/)
    await expect(s.tool.execute({ todos: [{ content: 'x', status: 'pending' }, { content: 'x', status: 'completed' }] }, s.exec)).rejects.toThrow(/duplicate content/)
    await expect(s.tool.execute({ todos: [{ content: '  ', status: 'pending' }] }, s.exec)).rejects.toThrow(/non-empty string/)
    expect(s.events).toHaveLength(0)
    // …while the SAME list is accepted under the parallel policy (config:true):
    const p = mount(true)
    await p.tool.execute({ todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'in_progress' }] }, p.exec)
    expect(p.events).toHaveLength(1)
  })

  it('T15 LANE positive (C2-shape, lane-provable part): classify→prepare→execute = exactly one append, business read-back equals the result, backend log complete on one correlation', async () => {
    const a = arm(true)
    const c = a.arm.classify(VALID_ARGS, CTX)
    expect(c.ok).toBe(true)
    if (c.plan === undefined) throw new Error('fixture: classify returned no plan')
    const p = a.arm.prepare(c.plan)
    expect(p.ok).toBe(true)
    if (p.ticket === undefined) throw new Error('fixture: prepare returned no ticket')
    const x = await a.arm.execute(p.ticket, a.exec)
    expect(x.ok).toBe(true)
    expect(x.value?.counts).toEqual({ pending: 1, inProgress: 1, completed: 0 })
    expect(a.events).toHaveLength(1) // EXACTLY one append, by the bound native body
    expect(a.events[0]).toEqual({ type: 'todo/write', data: { todos: x.value?.todos } })
    expect(readBack(a, a.events)).toEqual(x.value?.todos) // business result observable through the real host fold
    const events = a.observed.map((o) => o.event)
    expect(events).toEqual(['classify', 'admit', 'backend-start', 'backend-commit', 'backend-end'])
    expect(new Set(a.observed.map((o) => o.correlation)).size).toBe(1) // one invocation correlation
  })

  it('T16 Ask-pending and deny write ZERO: without a prepare-issued ticket execute is NOT_ADMITTED, the body is unreachable, zero append', async () => {
    const a = arm(true)
    const c = a.arm.classify(VALID_ARGS, CTX)
    expect(c.ok).toBe(true)
    // the admission answer that never admits (Ask pending OR deny) simply
    // never calls prepare — the arm's structure is the proof: prepare/execute
    // have no other door, and the ONLY commit path is a consumed ticket.
    const fakeTicket = { plan: c.plan } // a hand-built ticket is NOT an issued one
    const refused = await a.arm.execute(fakeTicket, a.exec)
    expect(refused.ok).toBe(false)
    expect(refused.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NOT_ADMITTED)
    const strayPrepare = a.arm.prepare({} as TodoPlan)
    expect(strayPrepare.ok).toBe(false)
    expect(strayPrepare.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NOT_ADMITTED)
    expect(a.events).toHaveLength(0)
    expect(a.observed.map((o) => o.event)).toEqual(['classify']) // no admit/backend rows exist
  })

  it('T17 cancel reports the TRUE race settlement at all three points (C3): before-admission / after-admission = zero append, after-commit = ALREADY-COMMITTED', async () => {
    const a = arm(true)
    // (a) cancelled while waiting for admission:
    const c1 = a.arm.classify({ todos: [{ content: 'x', status: 'pending' }] }, CTX)
    if (c1.plan === undefined) throw new Error('fixture: classify returned no plan')
    const z1 = a.arm.cancel(c1.plan)
    expect(z1.settled).toBe('CANCELLED-BEFORE-ADMISSION')
    expect(z1.appendOutcome).toContain('zero')
    expect(a.arm.prepare(c1.plan).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.NOT_ADMITTED)
    // (b) cancelled after admission, before consumption:
    const c2 = a.arm.classify({ todos: [{ content: 'y', status: 'pending' }] }, CTX)
    if (c2.plan === undefined) throw new Error('fixture: classify returned no plan')
    const p2 = a.arm.prepare(c2.plan)
    if (p2.ticket === undefined) throw new Error('fixture: prepare returned no ticket')
    const z2 = a.arm.cancel(p2.ticket)
    expect(z2.settled).toBe('CANCELLED-AFTER-ADMISSION')
    const late = await a.arm.execute(p2.ticket, a.exec)
    expect(late.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.CANCELLED)
    expect(a.events).toHaveLength(0) // both cancellations: the list never moved
    // (c) the race was lost — the commit already happened, cancel cannot rewrite it:
    const c3 = a.arm.classify({ todos: [{ content: 'z', status: 'pending' }] }, CTX)
    if (c3.plan === undefined) throw new Error('fixture: classify returned no plan')
    const p3 = a.arm.prepare(c3.plan)
    if (p3.ticket === undefined) throw new Error('fixture: prepare returned no ticket')
    await a.arm.execute(p3.ticket, a.exec)
    const z3 = a.arm.cancel(p3.ticket)
    expect(z3.settled).toBe('ALREADY-COMMITTED')
    expect(a.events).toHaveLength(1) // the truth: one append rode the log
  })

  it('T18 single-flight consumption and DRAINING with no native fallback: a consumed ticket never re-fires; after drain every stage refuses typed and the body is unreachable', async () => {
    const a = arm(true)
    const c = a.arm.classify(VALID_ARGS, CTX)
    if (c.plan === undefined) throw new Error('fixture: classify returned no plan')
    const p = a.arm.prepare(c.plan)
    if (p.ticket === undefined) throw new Error('fixture: prepare returned no ticket')
    expect((await a.arm.execute(p.ticket, a.exec)).ok).toBe(true)
    const reFire = await a.arm.execute(p.ticket, a.exec)
    expect(reFire.ok).toBe(false)
    expect(reFire.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.ALREADY_CONSUMED)
    expect(a.events).toHaveLength(1) // a re-fire can never double-commit
    a.arm.drain()
    expect(a.arm.classify(VALID_ARGS, CTX).code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.DRAINING)
    const after = await a.arm.execute(p.ticket, a.exec)
    expect(after.code).toBe(TODO_ARM.A5_TODO_TYPED_CODES.DRAINING)
    expect(a.events).toHaveLength(1) // DRAINING: no body reachable, native included (none exists by construction)
  })
})
