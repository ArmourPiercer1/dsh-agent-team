/**
 * a5-m2-todo-write-c1 — Alpha.5 M2 row `todo_write (M-14)`, C1 level, per the
 * frozen family contract `m0-closure-v3/M0-B-FAMILY-TARGET-CONTRACTS.md`
 * §3 B-SESSION (保留原生 + 统一前置接管) and §1.2 共用 BASE.C1.
 *
 * WHAT THIS FILE ACCEPTS (implements no new production law):
 *  - the pinned host `todo_write` implementation AT 639ed01539 (loaded from
 *    the pristine test-use tree's compiled lib — the tree pin is asserted
 *    before any import; the host is NEVER booted and nothing here claims
 *    段1/段3 runtime-presence proof: preset-mount presence and session-log
 *    visibility are Host legs, queued for the single Host owner);
 *  - the closed-world Guard law (`tool-dispatch/closed-world-guard.ts`) for
 *    same-name forgery, foreign/absent identity, unbound names and DRAINING;
 *  - the plane name gate (`team-tool-plane.mjs` verifyPlaneNames) — `todo_write`
 *    is a reserved native name and a plane row claiming it is refused.
 *
 * WHAT THIS FILE PINS AS CURRENT-GAP (regression net, NOT endorsement):
 *  the host parameters ROOT is an implicit open object
 *  (`packages/todo/tool-todo/src/index.ts:138-157` carries NO root-level
 *  `additionalProperties: false` — only `items` does, :145), so an unknown
 *  TOP-LEVEL key is NOT refused at the schema layer (no typed 拒) and the
 *  write proceeds as usual (the key is NOT consumed into the list); and the
 *  owning-session refusal is a bare Error with no typed code (:194-197).
 *  Both are the exact cells the P 前置接管 must flip to typed refusals; when
 *  the P classify lands in production, the T10/T4 legs below MUST be flipped
 *  to typed-refusal assertions — do not "fix" them silently.
 *
 * P-PROPOSED material lives here as a REFERENCE IMPLEMENTATION only
 * (`classify`, the TODO_P_* codes): production src placement goes through the
 * CENTER's concentrated wiring (proposal: evidence/alpha5/m2-todo/
 * p-takeover-proposal.md). ⑧ stays NOT_WIRED until that lands + Host C2/C3.
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
  const exec = { agent: { session: { append: (type: string, data: { todos: unknown }) => { events.push({ type, data: data as ProjectionEvent['data'] }) } } } }
  return { tool, projection, events, exec }
}

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

/* ────────────── P-PROPOSED reference (NOT production law yet) ────────────── */
/**
 * P 前置 classify per contract §1 + §1.1: PURE parse, closed operation set,
 * effects ONLY from the frozen vocabulary, strict targetManifest. The typed
 * codes below are P-PROPOSED (proposed for the lane's code family; production
 * naming is CENTER/AUTH's call — see p-takeover-proposal.md).
 */
function classify(
  args: Record<string, unknown>,
  ctx: { agentIdentity: string | null; boundSessionIncarnation: string | null },
) {
  const unknown = Object.keys(args).filter((k) => k !== 'todos')
  if (unknown.length > 0) return { ok: false as const, code: 'P_TODO_CLASSIFY_UNKNOWN_PARAMETER', detail: unknown.join(',') }
  if (!Array.isArray(args.todos)) return { ok: false as const, code: 'P_TODO_CLASSIFY_INVALID_ARGUMENTS', detail: 'todos must be an array' }
  if (ctx.agentIdentity === null) return { ok: false as const, code: 'P_TODO_CLASSIFY_NO_OWNING_SESSION', detail: 'no exec.agent' }
  if (ctx.boundSessionIncarnation === null || ctx.boundSessionIncarnation !== ctx.agentIdentity) {
    return { ok: false as const, code: 'P_TODO_CLASSIFY_FOREIGN_SESSION', detail: 'caller incarnation is not the bound current session' }
  }
  const items = args.todos as { content?: unknown; status?: unknown; [k: string]: unknown }[]
  for (const [i, item] of items.entries()) {
    const extra = Object.keys(item).filter((k) => k !== 'content' && k !== 'status')
    if (extra.length > 0) return { ok: false as const, code: 'P_TODO_CLASSIFY_UNKNOWN_PARAMETER', detail: `todos[${i}].${extra[0]}` }
    if (typeof item.content !== 'string' || item.content.trim().length === 0) {
      return { ok: false as const, code: 'P_TODO_CLASSIFY_INVALID_ARGUMENTS', detail: `todos[${i}].content must be a non-empty string` }
    }
    if (!(STATUSES as readonly string[]).includes(String(item.status))) {
      return { ok: false as const, code: 'P_TODO_CLASSIFY_INVALID_ARGUMENTS', detail: `todos[${i}].status must be one of ${STATUSES.join('|')}` }
    }
  }
  const canonical = items.map((t) => ({ content: (t.content as string).trim(), status: t.status as string }))
  const digest = createHash('sha256').update(JSON.stringify(canonical)).digest('hex')
  return {
    ok: true as const,
    effects: [{ kind: 'tool-invoke' as const, toolName: 'todo_write', resource: null }],
    manifest: {
      operation: 'replace-list',
      sessionIncarnation: ctx.boundSessionIncarnation,
      todosDigest: digest,
      counts: {
        pending: canonical.filter((t) => t.status === 'pending').length,
        inProgress: canonical.filter((t) => t.status === 'in_progress').length,
        completed: canonical.filter((t) => t.status === 'completed').length,
      },
      allowParallelPolicy: 'P-consumed-at-prepare',
      paramFingerprint: digest,
    },
  }
}
/* ─────────────────────────────────────────────────────────────────────────── */

describe('a5-m2-todo-write-c1 — B-SESSION todo arm, BASE.C1 caliber (fixture level, no Host)', () => {
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
    // the root itself declares NO additionalProperties — the open-root gap T10 pins:
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
    const first = await m.tool.execute({ todos: [{ content: 'alpha', status: 'pending' }, { content: 'beta', status: 'in_progress' }] }, m.exec)
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
    // and the policy is behavior, not decoration: single-active refuses a second in_progress
  })

  it('T10 REGRESSION NET (current gap, do NOT soften): unknown TOP-LEVEL key gets NO typed refusal and the write proceeds (key not consumed)', async () => {
    const m = mount(true)
    // CURRENT FORM (re-verified by CENTER statically): parameters ROOT has no
    // additionalProperties:false (src :138-157; only items :145 closes), so the
    // schema layer neither declares nor refuses the key, the body only reads
    // `todos`, and the append happens anyway. This leg pins the gap as a
    // regression net. WHEN the P classify lands in production this assertion
    // MUST be flipped to a typed refusal (P_TODO_CLASSIFY_UNKNOWN_PARAMETER) —
    // flipping is the landing proof, silence here is a red flag.
    const res = await m.tool.execute({ todos: [{ content: 'ok', status: 'pending' }], bogus_top_key: 42 }, m.exec)
    expect(m.events).toHaveLength(1) // append happened: typed refusal ABSENT
    expect(res.todos).toEqual([{ content: 'ok', status: 'pending' }]) // key NOT consumed into the list
    // The P reference classify, by contrast, already refuses it typed (contrast pair):
    const refused = classify({ todos: [{ content: 'ok', status: 'pending' }], bogus_top_key: 42 }, { agentIdentity: 'session-m1', boundSessionIncarnation: 'session-m1' })
    expect(refused.ok).toBe(false)
    expect(refused.ok === false && refused.code).toBe('P_TODO_CLASSIFY_UNKNOWN_PARAMETER')
  })

  it('T11 owning-session refusal is a bare Error today (typed-code gap pinned) with ZERO appends', async () => {
    const m = mount(true)
    const err = await m.tool.execute({ todos: [{ content: 'x', status: 'pending' }] }, {}).catch((e: unknown) => e as Error)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).message).toContain('todo_write requires an owning agent session')
    expect((err as Error).name).toBe('Error') // ⑦: NO typed code at :194-197 — P layer supplies it
    expect((err as Error & { code?: string }).code).toBeUndefined()
    expect(m.events).toHaveLength(0)
  })

  it('T12 P classify (P-PROPOSED) emits the frozen §1.1 vocabulary only: I=tool-invoke on the exact name, resource null, parses clean', () => {
    const out = classify({ todos: [{ content: ' a ', status: 'in_progress' }] }, { agentIdentity: 'session-m1', boundSessionIncarnation: 'session-m1' })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.effects).toEqual([{ kind: 'tool-invoke', toolName: 'todo_write', resource: null }])
    expect(out.effects.map((e) => e.kind)).toEqual(['tool-invoke'])
    expect(EFFECT_KINDS).toContain('tool-invoke') // closed vocabulary, zero new kinds
    const parsed = parseRequestedEffectSet(out.effects)
    expect(parsed.ok).toBe(true) // the REAL domain parser accepts the classify output
    expect(out.manifest.operation).toBe('replace-list')
    expect(out.manifest.sessionIncarnation).toBe('session-m1')
    expect(out.manifest.todosDigest).toMatch(/^[0-9a-f]{64}$/)
    expect(out.manifest.counts).toEqual({ pending: 0, inProgress: 1, completed: 0 })
  })

  it('T13 P classify negative: foreign/absent session incarnation and value-law breaks are typed refusals', () => {
    const ok = { agentIdentity: 'session-m1', boundSessionIncarnation: 'session-m1' }
    expect(classify({ todos: [] }, { agentIdentity: null, boundSessionIncarnation: 'session-m1' }).ok).toBe(false)
    const foreign = classify({ todos: [] }, { agentIdentity: 'session-OTHER', boundSessionIncarnation: 'session-m1' })
    expect(foreign.ok === false && foreign.code).toBe('P_TODO_CLASSIFY_FOREIGN_SESSION')
    const dup = classify({ todos: [{ content: 'd', status: 'pending' }, { content: ' d ', status: 'completed' }] }, ok)
    // canonical trim makes these the same content — value law stays in the host body TODAY;
    // classify is pure-parse and does NOT re-implement host value laws (contract: adapter keeps
    // native role/owner/resource checks; §1.1 no parallel law):
    expect(dup.ok).toBe(true)
    const badEnum = classify({ todos: [{ content: 'x', status: 'archived' }] }, ok)
    expect(badEnum.ok === false && badEnum.code).toBe('P_TODO_CLASSIFY_INVALID_ARGUMENTS')
    const blank = classify({ todos: [{ content: '   ', status: 'pending' }] }, ok)
    expect(blank.ok === false && blank.code).toBe('P_TODO_CLASSIFY_INVALID_ARGUMENTS')
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
})
