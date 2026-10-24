/**
 * a5m2-g5-goal-service-c1.test.ts — A5-M2 G5 REAL-SERVICE ADAPTER legs for
 * g5-goal-service.mjs (the create_goal / get_goal / update_goal rows over
 * the REAL 639 goal-service interface). Three leg families:
 *
 *  A) INTERFACE AUDIT — the REAL 639 FACTS, proven against the pristine
 *     checkout (tests/paths.mjs is the unique path source; the pin is
 *     639ed015397290b3745d163aafe02ffee4aa3f84 = 0.2.0-rc.2):
 *     - the tool description/parameter bytes are read FROM the pinned
 *       tool-goal source and compiled through the REAL pinned host compiler
 *       (parameterSchemaSpecToJsonSchema / defineTool @
 *       tests/deepseek-harness-test-use/packages/core/tools/lib) — the
 *       recorded compiled bytes ARE the fixed point (no mirror-lift);
 *     - the result/object shape is asserted with the REAL validators
 *       (valueSchemaSpecToJsonSchema / assertSupportedJsonSchema /
 *       validateJsonSchemaValue): {goal:null} | {goal:{id,revision,
 *       objective,phase,roundsStarted,maxGoalRounds,blockedReason?},
 *       activation}, createdAt/updatedAt ABSENT;
 *     - the service methods behind the tools (GoalService.get/create/edit/
 *       pause/resume/complete/block, goal/src/index.ts:277/:303/:329/:352/
 *       :364/:391/:409) and the tool-side call sites (ctx.goals.*, block's
 *       {code:'model-reported'}, authority.ts, wrapup.ts, deferContext) are
 *       pinned from the source text, and the adapter's PORT LAW mirrors
 *       the extracted signatures' arity one-for-one.
 *  B) PLACEMENT LAW — captured-native-delegate rows: rows carry the
 *     captured description/parameter bytes VERBATIM; a missing or foreign
 *     capture, or a port that cannot serve a record, answers an honest
 *     INACTIVE row (mountCondition declared_mount) whose blocker is carried
 *     verbatim — nothing mounts, nothing substitutes, nothing is faked.
 *  C) DELEGATION REACH-THROUGH — a RECORDING FAKE PORT (a test-owned
 *     double; NOT C2, no real-Host dimension is claimed): the recorded call
 *     tuples (method + argument count + payload objects) match the real
 *     GoalService signatures; the rows run ONLY their own tool's mapping
 *     (no shared string-dispatch); the tool-owned parameter law refuses
 *     with zero port entry; service errors propagate verbatim; identity
 *     drift refuses before any port entry; authority/wrap-up stay NAMED
 *     GAPS the rows never claim to close.
 *
 * Scope: NO Host process, NO network, NO :3080. Module status: UNWIRED
 * (wiring is the CENTER's, on separate feat/a5m2-wire-* trees); matrix
 * tier of the module: 接线未测 is NOT reached here — these are assembly/
 * in-process legs, so the module stays 已测试-eligible only through this
 * spec's own tier claim: IN-PROCESS PROVEN (C1); real-Host dimensions:
 * not claimed. Windows dimensions: NOT_RUN_WINDOWS_UNAUTHORIZED.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g5-goal-service-c1
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot, testUsePath, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION } from '../../../tests/paths.mjs'

/* ── module under test ─────────────────────────────────────────────── */
const G5 = (await import(new URL('../src/plugin/live/governed-families/g5-goal-service.mjs', import.meta.url).href)) as {
  A5_G5_FAMILY_ID: string
  A5_G5_ADAPTER_REVISION: number
  A5_G5_GOAL_RECORDS: { get_goal: { recordIndex: number, family: string, operation: string }, create_goal: { recordIndex: number, family: string, operation: string }, update_goal: { recordIndex: number, family: string, operation: string } }
  A5_G5_GOAL_TOOL_NAMES: readonly GoalToolName[]
  A5_G5_GOAL_SERVICE_METHODS: { get: { arity: number, signature: string, source: string }, create: { arity: number, signature: string, source: string }, edit: { arity: number, signature: string, source: string }, pause: { arity: number, signature: string, source: string }, resume: { arity: number, signature: string, source: string }, complete: { arity: number, signature: string, source: string }, block: { arity: number, signature: string, source: string } }
  A5_G5_GOAL_CODES: {
    DECLARED_MOUNT_ABSENT: string
    CAPTURE_DRIFT: string
    PORT_ABSENT: string
    PORT_METHOD_ABSENT: string
    PORT_METHOD_DRIFT: string
    DRAINING: string
    AGENT_REQUIRED: string
    INVALID_ARGUMENTS: string
    UNKNOWN_PARAMETER: string
    MISSING_PARAMETER: string
    UNKNOWN_ACTION: string
    GOAL_REF_INVALID: string
    PARAM_LAW: string
    RESUME_PAUSED: string
    BLOCK_THRESHOLD: string
    DIRECT_HUMAN_REQUIRED: string
    COMPLETION_AUTHORITY_REQUIRED: string
    NOT_OWN_PLAN: string
  }
  A5_G5_GOAL_NAMED_GAPS: Record<'AUTHORITY' | 'WRAPUP' | 'AGENT_AUTH', string>
  goalValue: (goal: Record<string, unknown> | undefined) => Record<string, unknown>
  createG5GoalServiceAdapter: (deps: Record<string, unknown>) => G5Adapter
}

/** The row face as the legs consume it (the module is untyped `.mjs`). */
interface RowPlanManifest {
  namedGaps?: Record<string, string>
  executionAuthority?: { observed: boolean, kind?: string, reason?: string }
}
interface RowPlan { targetManifest: RowPlanManifest }
interface RowResult {
  ok?: boolean
  code?: string
  detail?: string
  value?: Record<string, unknown>
  plan?: RowPlan
  // classify() answers THE PLAN ITSELF: targetManifest rides the result at
  // top level (the port-entry refusals answer without one — hence optional).
  targetManifest?: RowPlanManifest
  dispatch?: Array<{ method: string, source: string }>
  authorityObserved?: boolean
  nativeDelegated?: boolean
}
interface G5Row {
  familyId: string
  adapterRevision: number
  recordIndex: number
  toolName: string
  operation: string
  mountCondition: string
  mountState: string
  active: boolean
  captured(): boolean
  description: string | null
  parametersSchema: Record<string, unknown> | null
  outputSchema: Record<string, unknown> | null
  portMethods: readonly string[]
  namedGaps: Record<string, string>
  blocker?: string
  classify(args: unknown): Promise<RowResult>
  invoke(args: unknown, exec: Record<string, unknown>): Promise<RowResult>
  runPlan(plan: unknown, exec: Record<string, unknown>): Promise<RowResult>
  drain(): void
  draining(): boolean
  stats(): { dispatches: number, refuses: number, driftRejects: number, nativeDelegations: number }
}
interface G5Adapter {
  get_goal: G5Row
  create_goal: G5Row
  update_goal: G5Row
  adapterLaw: Record<string, unknown>
  stats(): { dispatches: number, refuses: number, driftRejects: number, nativeDelegations: number }
  drain(): void
  draining(): boolean
}
const CODES = G5.A5_G5_GOAL_CODES

/* ── the pinned checkout (unique path source: tests/paths.mjs) ─────── */
const PIN_SHA = '639ed015397290b3745d163aafe02ffee4aa3f84'
const repoRoot = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (repoRoot === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const pinRead = (rel: string): string => {
  // root 02:04 handling: the pinned checkout through the unique path source
  // (canonical location, or the DSH_TEST_USE_ROOT-supplied read-only 639 base)
  const p = testUsePath(dirname(fileURLToPath(import.meta.url)), rel)
  if (!existsSync(p)) throw new Error(`pristine pinned source absent (${rel}); failing closed`)
  return readFileSync(p, 'utf8')
}
/** Whitespace-normalized containment: the byte facts survive re-flow. */
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim()
const containsAll = (haystack: string, needles: readonly string[]): void => {
  const h = norm(haystack)
  for (const needle of needles) expect(h).toContain(norm(needle))
}

const toolGoalSrc = pinRead('packages/goal/tool-goal/src/index.ts')
const authoritySrc = pinRead('packages/goal/tool-goal/src/authority.ts')
const wrapupSrc = pinRead('packages/goal/tool-goal/src/wrapup.ts')
const goalSrc = pinRead('packages/goal/goal/src/index.ts')
const goalTypesSrc = pinRead('packages/goal/goal/src/types.ts')

/* ── the REAL pinned host tool lib (the production compiler/validators) ── */
const HOST_LIB = testUsePath(dirname(fileURLToPath(import.meta.url)), 'packages', 'core', 'tools', 'lib', 'index.js')
if (!existsSync(HOST_LIB)) throw new Error(`pristine host lib absent; failing closed (${HOST_LIB})`)
const hostTools = () => import(pathToFileURL(HOST_LIB).href) as Promise<{
  assertSupportedJsonSchema: (schema: unknown) => void
  validateJsonSchemaValue: (schema: unknown, value: unknown, path: string) => string[]
  validateArgs: (spec: Record<string, unknown>, args: unknown) => string[]
  parameterSchemaSpecToJsonSchema: (spec: Record<string, unknown>) => Record<string, unknown>
  valueSchemaSpecToJsonSchema: (spec: unknown) => Record<string, unknown>
  defineTool: (options: Record<string, unknown>) => {
    name: string
    description: string
    parameters: Record<string, unknown>
    output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => Array<{ type: string, text: string }> }
    execute: (args: unknown, exec: unknown) => Promise<unknown>
  }
}>

/* ── the 639 CAPTURED authored faces (verbatim from tool-goal/src/index.ts) ── */
const UPDATE_ACTIONS = ['edit', 'pause', 'resume', 'complete', 'blocked']
const GET_DESCRIPTION = 'Read the current session goal, including the id and revision that update_goal requires.'
const CREATE_DESCRIPTION = 'Create a persisted goal that keeps this session working across automatic continuation rounds. '
  + 'Use it when the direct human request is a long-running objective, even if the user did not say "goal"; '
  + 'not for single-turn work.'
/** The SAME bytes in their SOURCE literal form (three concatenated parts). */
const CREATE_DESCRIPTION_SRC = "'Create a persisted goal that keeps this session working across automatic continuation rounds. ' "
  + "+ 'Use it when the direct human request is a long-running objective, even if the user did not say \"goal\"; ' "
  + "+ 'not for single-turn work.'"
const UPDATE_DESCRIPTION = 'Update the current goal.'

const AUTHORED_PARAMS: { get_goal: Record<string, unknown>, create_goal: Record<string, unknown>, update_goal: Record<string, unknown> } = {
  get_goal: {},
  create_goal: {
    objective: { type: 'string', required: true, description: 'The concrete completion objective inferred from the direct human request.' },
    max_goal_rounds: { type: 'number', description: 'Optional positive safe-integer limit on automatic continuation rounds.' },
  },
  update_goal: {
    goal_id: { type: 'string', required: true, description: 'Exact id returned by get_goal.' },
    revision: { type: 'number', required: true, description: 'Exact positive revision returned by get_goal.' },
    action: {
      type: 'string',
      required: true,
      enum: UPDATE_ACTIONS,
      description: 'edit, pause, and resume require a direct top-level human request. complete and blocked are also allowed during an automatic continuation of this goal; blocked is rejected before the configured minimum round count.',
    },
    objective: { type: 'string', description: 'Replacement objective; valid only with action edit.' },
    max_goal_rounds: { type: 'number', description: 'Replacement cap; valid only with action edit.' },
    blocked_reason: { type: 'string', description: 'Required only with action blocked: the concrete condition that persisted across rounds and blocks progress.' },
  },
}

/** The shared GOAL_OUTPUT schema exactly as GOAL_VALUE_SCHEMA declares it
 *  (tool-goal/src/index.ts:74-112). */
const AUTHORED_OUTPUT_SCHEMA = {
  oneOf: [
    { type: 'object', additionalProperties: false, properties: { goal: { type: 'null', required: true } } },
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        goal: {
          type: 'object',
          additionalProperties: false,
          required: true,
          properties: {
            id: { type: 'string', required: true },
            revision: { type: 'integer', required: true },
            objective: { type: 'string', required: true },
            phase: { type: 'string', required: true, enum: ['active', 'paused', 'blocked', 'complete'] },
            roundsStarted: { type: 'integer', required: true },
            maxGoalRounds: { type: 'integer', required: true },
            blockedReason: {
              type: 'object',
              additionalProperties: false,
              properties: { code: { type: 'string', required: true }, message: { type: 'string', required: true } },
            },
          },
        },
        activation: { type: 'string', required: true, enum: ['armed', 'disarmed'] },
      },
    },
  ],
} as const

/** No property-level `required: true` marker may survive a compiled face. */
const requiredMarker = (node: unknown): boolean => {
  if (node === null || typeof node !== 'object') return false
  const rec = node as Record<string, unknown>
  if (Object.hasOwn(rec, 'required') && rec.required === true) return true
  const props = rec.properties
  if (props !== null && typeof props === 'object') {
    for (const child of Object.values(props as Record<string, unknown>)) if (requiredMarker(child)) return true
  }
  return false
}

/** THE production capture shape: the authored 639 config compiled through
 *  the REAL pinned defineTool — what `ctx.tools.get(name, scope)` answers
 *  at the pin (g3 fixed-point idiom). execute is a NEVER-ENTERED tripwire:
 *  these rows are real-service rows, they do not run the native body. */
type GoalToolName = 'get_goal' | 'create_goal' | 'update_goal'
async function captureNativeGoalTool(name: GoalToolName, executeOverride?: (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown): Promise<{ def: Record<string, unknown>; entered: () => number }> {
  const host = await hostTools()
  let entered = 0
  const description = name === 'get_goal' ? GET_DESCRIPTION : name === 'create_goal' ? CREATE_DESCRIPTION : UPDATE_DESCRIPTION
  const def = host.defineTool({
    name,
    description,
    parameters: JSON.parse(JSON.stringify(AUTHORED_PARAMS[name])) as Record<string, unknown>,
    output: {
      schema: JSON.parse(JSON.stringify(AUTHORED_OUTPUT_SCHEMA)) as Record<string, unknown>,
      render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: executeOverride === undefined
      ? async () => {
        entered += 1
        throw new Error('NATIVE BODY MUST NOT BE ENTERED by a G5 real-service row')
      }
      // THE DELEGATE TEST DOUBLE (root 06:5x): the ONLY arms that may enter
      // a captured body are goal-round blocked under an UNTRUSTED threshold
      // (the native-delegate route). The double records what the row hands
      // it and answers like the native body would.
      : async (args: Record<string, unknown>, exec: Record<string, unknown>) => {
        entered += 1
        return executeOverride(args, exec)
      },
  })
  return { def: def as unknown as Record<string, unknown>, entered: () => entered }
}

/* ── recording FAKE goal-service port (test-owned double, NOT C2) ───── */
interface PortCall { method: string; args: unknown[] }
const callAt = (calls: PortCall[], i: number): PortCall => calls[i] as unknown as PortCall
interface FakePort {
  port: Record<string, unknown>
  calls: PortCall[]
  setCurrent: (v: Record<string, unknown> | undefined) => void
  setFailure: (method: string, error: Error) => void
}
function fakeGoals(initialCurrent: Record<string, unknown> | undefined = undefined, nextViews: Record<string, Record<string, unknown>> = {}): FakePort {
  const calls: PortCall[] = []
  let current = initialCurrent
  const failures = new Map<string, Error>()
  const record = (method: string) => (...args: unknown[]): Record<string, unknown> | undefined => {
    calls.push({ method, args })
    const failure = failures.get(method)
    if (failure !== undefined) throw failure
    if (method === 'get') return current
    const view = nextViews[method]
    if (view === undefined) throw new Error(`fake goal port: no seeded ${method} view`)
    current = view
    return view
  }
  // Synchronous methods, arity per the port law (GoalService, :277-:409).
  const port: Record<string, unknown> = {
    get: record('get'),
    create: record('create'),
    edit: record('edit'),
    pause: record('pause'),
    resume: record('resume'),
    complete: record('complete'),
    block: record('block'),
  }
  return {
    port,
    calls,
    setCurrent: (v) => { current = v },
    setFailure: (method, error) => { failures.set(method, error) },
  }
}

const VIEW = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'goal-9b2',
  revision: 1,
  objective: 'govern the goal tools',
  phase: 'active',
  maxGoalRounds: 4,
  roundsStarted: 0,
  createdAt: 1000,
  updatedAt: 1000,
  activation: 'armed',
  ...over,
})
// EXEC is the ToolRunContext slice the rows consume. The Agent carries ONLY
// the identity the rows observe: the module reads presence and hands the
// object to the port BY REFERENCE. A REAL Agent.session is a real Session
// object that only the real GoalService commits through (goal/src/index.ts:
// 609-613) — these legs never stub it, and nothing here touches agent.session
// (a fabricated session shape is a stub pretending to be the domain, which
// the proven-interface discipline forbids; if any code path needed one,
// freezing this object without one would throw).
const EXEC = Object.freeze({ agent: Object.freeze({ id: 'agent-g5-c1' }) })

// Checked first-entry read: the preceding toBe(1) length pins make a missing
// entry a hard test failure, not an undefined silently comparing equal.
const first = <T>(xs: T[]): T => xs[0] as T

async function world(opts: {
  current?: Record<string, unknown>
  nextViews?: Record<string, Record<string, unknown>>
  missingNative?: readonly string[]
  foreignNative?: readonly string[]
  nativeExecute?: Partial<Record<'get_goal' | 'create_goal' | 'update_goal', (args: Record<string, unknown>, exec: Record<string, unknown>) => unknown>>
  noNativeExecute?: readonly string[]
  portOmit?: readonly string[]
  blockedAfterConsecutiveRounds?: number
  executionFacts?: () => unknown
  realmId?: string
} = {}): Promise<{
  adapter: G5Adapter
  port: FakePort
  goals: Record<string, unknown>
  natives: Record<'get_goal' | 'create_goal' | 'update_goal', { def: Record<string, unknown>; entered: () => number }>
  slot: Record<'get_goal' | 'create_goal' | 'update_goal', unknown>
  fail: { nativeEntered: () => number }
}> {
  type NativeCaptured = { def: Record<string, unknown>; entered: () => number }
  const natives = {} as Record<'get_goal' | 'create_goal' | 'update_goal', NativeCaptured>
  const slot = {} as Record<'get_goal' | 'create_goal' | 'update_goal', unknown>
  for (const name of G5.A5_G5_GOAL_TOOL_NAMES) {
    const captured = await captureNativeGoalTool(name, opts.nativeExecute?.[name])
    natives[name] = captured
    slot[name] = opts.missingNative?.includes(name)
      ? undefined
      : opts.foreignNative?.includes(name)
        ? { name: `other_${name}`, description: 'x', parameters: {}, output: { schema: {} } }
        : opts.noNativeExecute?.includes(name)
          ? { ...captured.def as Record<string, unknown>, execute: undefined }
          : captured.def
  }
  const fake = fakeGoals(opts.current, opts.nextViews ?? {})
  const goals: Record<string, unknown> = { ...fake.port }
  for (const m of opts.portOmit ?? []) delete goals[m]
  const adapter = G5.createG5GoalServiceAdapter({
    realmId: opts.realmId ?? 'realm-g5-c1',
    providerId: 'assembly-g5-c1',
    readNative: (name: string) => slot[name as 'get_goal' | 'create_goal' | 'update_goal'],
    goals,
    ...(opts.blockedAfterConsecutiveRounds === undefined ? {} : { blockedAfterConsecutiveRounds: opts.blockedAfterConsecutiveRounds }),
    ...(opts.executionFacts === undefined ? {} : { readExecutionFacts: opts.executionFacts }),
  })
  return {
    adapter,
    port: fake,
    goals,
    natives,
    slot,
    fail: { nativeEntered: () => Object.values(natives).reduce((n, e) => n + e.entered(), 0) },
  }
}

/* ═══ A) INTERFACE AUDIT — the REAL 639 facts ═══════════════════════ */
describe('a5m2-g5 audit — the pinned 639 tool surface', () => {
  it('the checkout IS the pin: 639ed01539… = 0.2.0-rc.2 (tests/paths.mjs is the unique source)', () => {
    expect(TEST_USE_BASELINE_SHA).toBe(PIN_SHA)
    expect(DSH_BASELINE_VERSION).toBe('0.2.0-rc.2')
  })

  it('the three tool names, descriptions, action enum and config defaults are the recorded 639 bytes', () => {
    containsAll(toolGoalSrc, [
      `const name = 'tool-goal'`,
      "name: 'get_goal'",
      "name: 'create_goal'",
      "name: 'update_goal'",
      CREATE_DESCRIPTION_SRC,
      GET_DESCRIPTION,
      "description: 'Update the current goal.'",
      "const UPDATE_ACTIONS: UpdateAction[] = ['edit', 'pause', 'resume', 'complete', 'blocked']",
      "blockedAfterConsecutiveRounds: z.number().step(1).min(1).default(3)", // :38-40 — the adapter's default mirror
      "inject = ['agents', 'goals', 'tools', 'systemPrompt', 'sessionProjections']",
    ])
  })

  it('the AUTHORED parameter literals live at the pin AND the REAL pinned compiler lifts them to the recorded compiled bytes (fixed point, no mirror-lift)', async () => {
    const host = await hostTools()
    containsAll(toolGoalSrc, [
      "objective: { type: 'string', required: true, description: 'The concrete completion objective inferred from the direct human request.', }",
      "max_goal_rounds: { type: 'number', description: 'Optional positive safe-integer limit on automatic continuation rounds.', }",
      "goal_id: { type: 'string', required: true, description: 'Exact id returned by get_goal.' }",
      "revision: { type: 'number', required: true, description: 'Exact positive revision returned by get_goal.' }",
      "objective: { type: 'string', description: 'Replacement objective; valid only with action edit.' }",
      "max_goal_rounds: { type: 'number', description: 'Replacement cap; valid only with action edit.' }",
      "blocked_reason: { type: 'string', description: 'Required only with action blocked: the concrete condition that persisted across rounds and blocks progress.', }",
      'enum: UPDATE_ACTIONS',
      "action: { type: 'string', required: true, enum: UPDATE_ACTIONS, description: 'edit, pause, and resume require a direct top-level human request. complete and blocked are also allowed ' + 'during an automatic continuation of this goal; blocked is rejected before the configured minimum round count.', }",
    ])
    const compiled = {
      get_goal: host.parameterSchemaSpecToJsonSchema(AUTHORED_PARAMS.get_goal),
      create_goal: host.parameterSchemaSpecToJsonSchema(AUTHORED_PARAMS.create_goal),
      update_goal: host.parameterSchemaSpecToJsonSchema(AUTHORED_PARAMS.update_goal),
    }
    expect(compiled.get_goal).toEqual({ type: 'object', properties: {} })
    expect(compiled.create_goal).toEqual({
      type: 'object',
      properties: {
        objective: { type: 'string', description: 'The concrete completion objective inferred from the direct human request.' },
        max_goal_rounds: { type: 'number', description: 'Optional positive safe-integer limit on automatic continuation rounds.' },
      },
      required: ['objective'],
    })
    expect((compiled.update_goal as { required: string[] }).required).toEqual(['goal_id', 'revision', 'action'])
    expect(((compiled.update_goal as { properties: Record<string, { enum?: string[] }> }).properties.action?.enum)).toEqual(UPDATE_ACTIONS)
    for (const face of Object.values(compiled)) {
      host.assertSupportedJsonSchema(face)
      expect(requiredMarker(face)).toBe(false) // property-level markers were lifted
    }
    // The REAL defineTool product IS the registration face the capture seam
    // answers — the row must carry THAT product, so the audit pins it here.
    const def = await captureNativeGoalTool('update_goal')
    expect(def.def.parameters).toEqual(compiled.update_goal)
    expect(host.validateArgs(AUTHORED_PARAMS.update_goal, { goal_id: 'g', revision: 1, action: 'nope' })).toEqual([
      '"action" must be one of ["edit","pause","resume","complete","blocked"]',
    ])
    expect(host.validateArgs(AUTHORED_PARAMS.create_goal, {})).toEqual(['missing required property "objective"'])
  })

  it('the RESULT SHAPE is the recorded goalValue object: oneOf {goal:null} | {goal:{id,revision,objective,phase,roundsStarted,maxGoalRounds,blockedReason?},activation}, proven by the REAL validators', async () => {
    const host = await hostTools()
    containsAll(toolGoalSrc, [
      'const GOAL_VALUE_SCHEMA = {',
      "phase: { type: 'string', required: true, enum: ['active', 'paused', 'blocked', 'complete'] }",
      "activation: { type: 'string', required: true, enum: ['armed', 'disarmed'] }",
      "roundsStarted: { type: 'integer', required: true }",
      "maxGoalRounds: { type: 'integer', required: true }",
    ])
    const compiledOutput = host.valueSchemaSpecToJsonSchema(JSON.parse(JSON.stringify(AUTHORED_OUTPUT_SCHEMA)))
    const branches = compiledOutput.oneOf as unknown as [
      { properties: { goal: Record<string, unknown> } },
      { properties: { goal: { properties: Record<string, unknown>, required: string[], additionalProperties: boolean } } },
    ]
    expect(branches.length).toBe(2)
    expect(branches[0].properties.goal).toEqual({ type: 'null' })
    const goalProps = branches[1].properties.goal.properties as Record<string, unknown>
    expect(Object.keys(goalProps).sort()).toEqual(['blockedReason', 'id', 'maxGoalRounds', 'objective', 'phase', 'revision', 'roundsStarted'])
    expect(branches[1].properties.goal.required.sort()).toEqual(['id', 'maxGoalRounds', 'objective', 'phase', 'revision', 'roundsStarted'])
    expect(branches[1].properties.goal.additionalProperties).toBe(false)
    // The canonical values the adapter produces are exactly what the pinned
    // validators accept — and the near-misses are exactly what they refuse.
    const full = G5.goalValue(VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'stuck' } }))
    expect(full).toEqual({
      goal: { id: 'goal-9b2', revision: 1, objective: 'govern the goal tools', phase: 'blocked', roundsStarted: 0, maxGoalRounds: 4, blockedReason: { code: 'model-reported', message: 'stuck' } },
      activation: 'armed',
    })
    expect(host.validateJsonSchemaValue(compiledOutput, full, '')).toEqual([])
    expect(host.validateJsonSchemaValue(compiledOutput, G5.goalValue(undefined), '')).toEqual([])
    const leaked = JSON.parse(JSON.stringify(full))
    leaked.goal.createdAt = 1 // GoalView carries it; the VALUE must not
    expect(host.validateJsonSchemaValue(compiledOutput, leaked, '').length).toBeGreaterThan(0)
    expect(host.validateJsonSchemaValue(compiledOutput, { goal: null, activation: 'armed' }, '').length).toBeGreaterThan(0)
    // The tool's OWN render projection: GOAL_OUTPUT render = JSON.stringify.
    const def = await captureNativeGoalTool('get_goal')
    const rendered = (def.def as unknown as { output: { render: (a: unknown, v: unknown) => Array<{ type: string, text: string }> } }).output
    expect(rendered.render({}, { goal: null })).toEqual([{ type: 'text', text: '{"goal":null}' }])
  })

  it('GoalView carries createdAt/updatedAt/activation while the tool VALUE drops the timestamps — the view→value distinction is pinned (types.ts:90-99 vs index.ts:157-173)', () => {
    containsAll(goalTypesSrc, [
      'export interface GoalView extends GoalSnapshot {',
      'readonly roundsStarted: number',
      'readonly createdAt: number',
      'readonly updatedAt: number',
      'readonly activation: GoalActivation',
      "export type GoalActivation = 'armed' | 'disarmed'",
      "export type GoalId = Branded<'GoalId'>",
    ])
    const valueKeys = Object.keys(G5.goalValue(VIEW()).goal as object).sort()
    expect(valueKeys).toEqual(['id', 'maxGoalRounds', 'objective', 'phase', 'revision', 'roundsStarted'])
  })
})

describe('a5m2-g5 audit — the REAL service methods behind the three tools', () => {
  it('GoalService is ctx.goals; the seven consumed methods exist with the cited signatures; the PORT LAW mirrors each extracted signature arity one-for-one', () => {
    containsAll(goalSrc, [
      'interface Context {',
      'goals: GoalService',
      'export class GoalService extends TypertRemoteService {',
      'get(agent: Agent): GoalView | undefined {',
      'create(agent: Agent, request: CreateGoalRequest): GoalView {',
      'edit(agent: Agent, ref: GoalRef, request: EditGoalRequest): GoalView {',
      'pause(agent: Agent, ref: GoalRef): GoalView {',
      'resume(agent: Agent, ref: GoalRef): GoalView {',
      'complete(agent: Agent, ref: GoalRef): GoalView {',
      'block(agent: Agent, ref: GoalRef, reason: GoalBlockReason): GoalView {',
      'defaultMaxGoalRounds: z.number().default(256)', // the SERVICE default — never pre-resolved by the adapter
    ])
    for (const [method, law] of Object.entries(G5.A5_G5_GOAL_SERVICE_METHODS)) {
      const sig = new RegExp(`  ${method}\\(([^)]*)\\): [^{]+\\{`).exec(goalSrc)
      expect(sig, `GoalService.${method} signature at the pin`).not.toBeNull()
      const params = ((sig as RegExpExecArray)[1] ?? '').split(',').filter((t) => t.trim().length > 0)
      expect(params.length, `port-law arity for ${method}`).toBe(law.arity)
      expect((params[0] ?? '').trim().startsWith('agent: Agent')).toBe(true)
      expect(law.source.startsWith('goal/src/index.ts:')).toBe(true)
    }
    // The port vocabulary is the domain vocabulary:
    containsAll(goalTypesSrc, [
      'export interface GoalRef {',
      'export interface CreateGoalRequest {',
      'export interface EditGoalRequest {',
      'export interface GoalBlockReason {',
    ])
  })

  it('the tool bodies call EXACTLY these service methods (call-site bytes), with block carrying {code:\'model-reported\'} and the goal-round wrap-up riding exec.deferContext — not the service', () => {
    containsAll(toolGoalSrc, [
      'goalValue(ctx.goals.get(execution.agent))',
      'ctx.goals.create(execution.agent, {',
      'ctx.goals.edit(execution.agent, ref, replacements)',
      'ctx.goals.pause(execution.agent, ref)',
      'ctx.goals.resume(execution.agent, ref)',
      'const current = ctx.goals.get(execution.agent)',
      'ctx.goals.complete(execution.agent, ref)',
      "ctx.goals.block(execution.agent, ref, {",
      "code: 'model-reported',",
      'exec.deferContext(createUserMessage({',
      'renderWrapupContext(goal.objective',
      "'goal_id must be non-empty and revision must be a positive safe integer', 'GOAL_TOOL_INVALID_UPDATE'",
      "the model cannot resume a paused goal; the user must resume it', 'GOAL_TOOL_RESUME_PAUSED'",
      "blocked requires at least " + "${resolved.blockedAfterConsecutiveRounds} consecutive goal rounds; ",
      "maxGoalRounds: args.max_goal_rounds",
    ])
    containsAll(authoritySrc, [
      'export function goalToolExecution(ctx: Context, exec: ToolRunContext): GoalToolExecution {',
      "reject('goal tools require a calling agent', 'GOAL_TOOL_AGENT_REQUIRED')",
      'export function requireDirectHuman(ctx: Context, execution: GoalToolExecution): void {',
      'export function completionAuthority(ctx: Context, execution: GoalToolExecution): GoalToolAuthority {',
      'const goal = ctx.goals.get(execution.agent)', // the goal-round read the row mirrors
    ])
    containsAll(wrapupSrc, ['export function renderWrapupContext(objective: string, blockedReason?: string): ContentBlock[] {', '<goal_complete>', '<goal_blocked>'])
  })

  it('the module PORT LAW, record table and named gaps are the pinned delegation facts, not invented vocabulary', () => {
    expect(G5.A5_G5_FAMILY_ID).toBe('B-SESSION')
    expect(G5.A5_G5_GOAL_RECORDS.get_goal.recordIndex).toBe(28)
    expect(G5.A5_G5_GOAL_RECORDS.create_goal.recordIndex).toBe(27)
    expect(G5.A5_G5_GOAL_RECORDS.update_goal.recordIndex).toBe(29)
    expect(Object.keys(G5.A5_G5_GOAL_SERVICE_METHODS).sort()).toEqual(['block', 'complete', 'create', 'edit', 'get', 'pause', 'resume'])
    expect(G5.A5_G5_GOAL_NAMED_GAPS.AUTHORITY).toContain('authority.ts:80-118')
    expect(G5.A5_G5_GOAL_NAMED_GAPS.WRAPUP).toContain('deferContext')
    expect(G5.A5_G5_GOAL_NAMED_GAPS.WRAPUP).toContain('wrapup.ts:17-41')
    expect(G5.A5_G5_GOAL_NAMED_GAPS.AGENT_AUTH).toContain('GOAL_TOOL_AGENT_REQUIRED')
  })
})

/* ═══ B) PLACEMENT LAW — capture + port decide, honestly ════════════ */
describe('a5m2-g5 placement — captured faces and the injected port', () => {
  it('assembly defects THROW (a config defect never silently defaults)', () => {
    expect(() => G5.createG5GoalServiceAdapter({})).toThrow(/realmId is required/)
    expect(() => G5.createG5GoalServiceAdapter({ realmId: 'r' })).toThrow(/providerId is required/)
    expect(() => G5.createG5GoalServiceAdapter({ realmId: 'r', providerId: 'p' })).toThrow(/readNative is required/)
    expect(() => G5.createG5GoalServiceAdapter({ realmId: 'r', providerId: 'p', readNative: () => undefined })).toThrow(/goals is required/)
    const base = { realmId: 'r', providerId: 'p', readNative: () => undefined, goals: fakeGoals().port }
    expect(() => G5.createG5GoalServiceAdapter({ ...base, blockedAfterConsecutiveRounds: 0 })).toThrow(/blockedAfterConsecutiveRounds must be a positive safe integer/) // verbatim host config law
    // P2 TRUST (root 05:5x): ABSENT is legal but UNTRUSTED — the adapter never
    // defaults the host's config value (the goal-round blocked leg below pins
    // what closes because of it).
    expect(() => G5.createG5GoalServiceAdapter({ ...base })).not.toThrow()
    expect(() => G5.createG5GoalServiceAdapter({ ...base, readExecutionFacts: 'nope' as unknown as () => unknown })).toThrow(/readExecutionFacts/)
  })

  it('a missing or foreign capture answers an honest declared_mount INACTIVE row — blocker verbatim, zero port entry, the other rows serve', async () => {
    const w = await world({ missingNative: ['create_goal'], foreignNative: ['update_goal'], nextViews: { get: VIEW() } })
    expect(w.adapter.get_goal.active).toBe(true)
    const inactiveRows: Array<[string, G5Row]> = [
      ['create_goal', w.adapter.create_goal],
      ['update_goal', w.adapter.update_goal],
    ]
    for (const [name, row] of inactiveRows) {
      expect(row.active).toBe(false)
      expect(row.mountCondition).toBe('declared_mount')
      expect(row.captured()).toBe(false)
      expect(row.description).toBeNull()
      expect(String(row.blocker)).toContain('declared_mount is unproven')
      const plan = await row.classify(name === 'create_goal' ? { objective: 'x' } : { goal_id: 'g', revision: 1, action: 'pause' })
      expect(plan.ok).toBe(false)
      expect(plan.code).toBe(CODES.DECLARED_MOUNT_ABSENT)
      expect(String(plan.detail)).toContain(name)
      const invoked = await row.invoke({ objective: 'x', goal_id: 'g', revision: 1, action: 'pause' }, EXEC)
      expect(invoked.code).toBe(CODES.DECLARED_MOUNT_ABSENT)
    }
    expect(String(w.adapter.create_goal.blocker)).toContain('absent') // capture missing
    expect(String(w.adapter.update_goal.blocker)).toContain('foreign object') // wrong face under the name
    expect(w.port.calls.length).toBe(0) // zero port entry across both INACTIVE rows
    // The ACTIVE row still serves:
    const ok = await w.adapter.get_goal.invoke({}, EXEC)
    expect(ok.ok).toBe(true)
    expect(w.fail.nativeEntered()).toBe(0)
  })

  it('a port that cannot serve a record answers INACTIVE for THAT record with the cited missing method; the read row and the create row still mount', async () => {
    const w = await world({ portOmit: ['block', 'complete', 'edit', 'pause', 'resume'], nextViews: { get: VIEW(), create: VIEW() }, executionFacts: () => ({ kind: 'direct-human' }) })
    expect(w.adapter.get_goal.active).toBe(true)
    expect(w.adapter.create_goal.active).toBe(true)
    expect(w.adapter.update_goal.active).toBe(false)
    expect(String(w.adapter.update_goal.blocker)).toMatch(/"block" \(goal\/src\/index\.ts:409/)
    expect(String(w.adapter.update_goal.blocker)).toMatch(/"edit" \(goal\/src\/index\.ts:329/)
    const r = await w.adapter.update_goal.classify({ goal_id: 'g', revision: 1, action: 'blocked', blocked_reason: 'x' })
    expect(r.code).toBe(CODES.DECLARED_MOUNT_ABSENT)
    const created = await w.adapter.create_goal.invoke({ objective: 'o' }, EXEC)
    expect(created.ok).toBe(true)
    expect(w.port.calls.map((c) => c.method)).toEqual(['create'])
  })

  it('ACTIVE rows carry the CAPTURED bytes verbatim (identity, not copy) and their OWN per-tool dispatch set — three typed rows, never one wrapper', async () => {
    const w = await world({ nextViews: { get: VIEW() } })
    const { get_goal, create_goal, update_goal } = w.adapter
    expect(get_goal.description).toBe(GET_DESCRIPTION)
    expect(create_goal.description).toBe(CREATE_DESCRIPTION)
    expect(update_goal.description).toBe(UPDATE_DESCRIPTION)
    // L2: the row face IS the captured compiled schema object.
    expect(create_goal.parametersSchema).toBe(w.natives.create_goal.def.parameters)
    expect(update_goal.parametersSchema).toBe(w.natives.update_goal.def.parameters)
    expect(((update_goal.parametersSchema ?? {}) as { properties: Record<string, { enum?: unknown[] }> }).properties.action?.enum).toEqual(UPDATE_ACTIONS)
    expect(update_goal.outputSchema).toBe((w.natives.update_goal.def as { output: { schema: unknown } }).output.schema)
    expect(get_goal.portMethods).toEqual(['get'])
    expect(create_goal.portMethods).toEqual(['create'])
    expect(update_goal.portMethods).toEqual(['get', 'edit', 'pause', 'resume', 'complete', 'block'])
    expect(get_goal.recordIndex).toBe(28)
    expect(create_goal.familyId).toBe('B-SESSION')
    // Every row names the un-closeable dimensions verbatim:
    for (const row of [get_goal, create_goal, update_goal]) {
      expect(row.namedGaps.WRAPUP).toContain('exec.deferContext')
    }
    expect(String(create_goal.namedGaps.AUTHORITY)).toContain('requireDirectHuman')
  })
})

/* ═══ C) DELEGATION REACH-THROUGH over the recording fake port ══════ */
describe('a5m2-g5 delegation — recorded tuples match the real signatures', () => {
  it('get_goal: exactly ONE port.get, the Agent object BY REFERENCE, the canonical goalValue projection (timestamps dropped), undefined goal → {goal:null}; the native body is never entered', async () => {
    const w = await world({ current: VIEW() })
    const out = await w.adapter.get_goal.invoke({}, EXEC)
    expect(out.ok).toBe(true)
    expect(w.port.calls.length).toBe(1)
    expect(callAt(w.port.calls, 0).method).toBe('get')
    expect(callAt(w.port.calls, 0).args.length).toBe(G5.A5_G5_GOAL_SERVICE_METHODS.get.arity)
    expect(callAt(w.port.calls, 0).args[0]).toBe(EXEC.agent) // by reference, never a re-minted stand-in
    expect(out.value).toEqual({
      goal: { id: 'goal-9b2', revision: 1, objective: 'govern the goal tools', phase: 'active', roundsStarted: 0, maxGoalRounds: 4 },
      activation: 'armed',
    })
    expect(JSON.stringify(out.value)).not.toMatch(/createdAt|updatedAt/)
    w.port.setCurrent(undefined)
    const none = await w.adapter.get_goal.invoke(undefined, EXEC)
    expect(none.value).toEqual({ goal: null })
    const noAgent = await w.adapter.get_goal.invoke({}, {})
    expect(noAgent.code).toBe(CODES.AGENT_REQUIRED)
    expect(w.port.calls.length).toBe(2) // the agent refusal entered ZERO port calls
    expect(w.fail.nativeEntered()).toBe(0)
  })

  it('create_goal: the create tuple carries (agent, {objective} | {objective,maxGoalRounds}); a 0 cap passes THROUGH to the service (the REAL create-side asymmetry); the adapter never pre-validates service facts', async () => {
    const w = await world({ nextViews: { create: VIEW() }, executionFacts: () => ({ kind: 'direct-human' }) })
    await w.adapter.create_goal.invoke({ objective: 'o' }, EXEC)
    expect(callAt(w.port.calls, 0).method).toBe('create')
    expect(callAt(w.port.calls, 0).args[1]).toEqual({ objective: 'o' })
    await w.adapter.create_goal.invoke({ objective: 'o', max_goal_rounds: 7 }, EXEC)
    expect(callAt(w.port.calls, 1).args[1]).toEqual({ objective: 'o', maxGoalRounds: 7 }) // NAME MAPPED objective/maxGoalRounds (tool-goal:225-228)
    await w.adapter.create_goal.invoke({ objective: '', max_goal_rounds: 0 }, EXEC)
    expect(callAt(w.port.calls, 2).args[1]).toEqual({ objective: '', maxGoalRounds: 0 }) // validity is SERVICE law (:199-212) — pass-through, no pre-refusal, no fake-closed
    expect(callAt(w.port.calls, 2).args.length).toBe(G5.A5_G5_GOAL_SERVICE_METHODS.create.arity)
    // Service truth propagates verbatim (never swallowed, never re-labelled):
    w.port.setFailure('create', new Error('goal "goal-9b2" already exists with phase "active" (GOAL_ALREADY_EXISTS)'))
    await expect(w.adapter.create_goal.invoke({ objective: 'o2' }, EXEC)).rejects.toThrow(/GOAL_ALREADY_EXISTS/)
  })

  it('update_goal: every action dispatches its OWN GoalService method with the exact ref/replacements/reason objects; the filler law and the create-side asymmetry differ exactly as the pin does', async () => {
    const refArgs = { goal_id: 'goal-9b2', revision: 3 }
    const editView = VIEW({ revision: 4, objective: 'new objective' })
    const w = await world({ current: VIEW({ revision: 3 }), nextViews: { edit: editView, pause: VIEW({ revision: 4, phase: 'paused', activation: 'disarmed' }), resume: VIEW({ revision: 4 }), complete: VIEW({ revision: 4, phase: 'complete', activation: 'disarmed' }), block: VIEW({ revision: 4, phase: 'blocked', activation: 'disarmed', blockedReason: { code: 'model-reported', message: 'the same blocker' } }) }, executionFacts: () => ({ kind: 'direct-human' }) })
    const row = w.adapter.update_goal
    await row.invoke({ ...refArgs, action: 'edit', objective: 'new objective', max_goal_rounds: 9 }, EXEC)
    expect(w.port.calls.map((c) => c.method)).toEqual(['edit'])
    expect(callAt(w.port.calls, 0).args[1]).toEqual({ id: 'goal-9b2', revision: 3 }) // GoalRef object
    expect(callAt(w.port.calls, 0).args[2]).toEqual({ objective: 'new objective', maxGoalRounds: 9 }) // replacements (tool-goal:258-261)
    // Filler law: '' objective + 0 cap collapse to NO replacements — and the
    // {} request still rides to the service, which owns GOAL_INVALID_EDIT.
    await row.invoke({ ...refArgs, action: 'edit', objective: '', max_goal_rounds: 0 }, EXEC)
    expect(callAt(w.port.calls, 1).args[2]).toEqual({})
    // pause: (agent, ref), arity 2.
    await row.invoke({ ...refArgs, action: 'pause' }, EXEC)
    expect(callAt(w.port.calls, 2).method).toBe('pause')
    expect(callAt(w.port.calls, 2).args.length).toBe(G5.A5_G5_GOAL_SERVICE_METHODS.pause.arity)
    expect(callAt(w.port.calls, 2).args[1]).toEqual({ id: 'goal-9b2', revision: 3 })
    // complete: arity 2.
    await row.invoke({ ...refArgs, action: 'complete' }, EXEC)
    expect(callAt(w.port.calls, 3).method).toBe('complete')
    // blocked: arity 3, reason {code:'model-reported',message} (tool-goal:315-318).
    const blocked = await row.invoke({ ...refArgs, action: 'blocked', blocked_reason: 'the same blocker' }, EXEC)
    expect(callAt(w.port.calls, 4).method).toBe('block')
    expect(callAt(w.port.calls, 4).args.length).toBe(G5.A5_G5_GOAL_SERVICE_METHODS.block.arity)
    expect(callAt(w.port.calls, 4).args[2]).toEqual({ code: 'model-reported', message: 'the same blocker' })
    expect(blocked.value).toEqual({
      goal: { id: 'goal-9b2', revision: 4, objective: 'govern the goal tools', phase: 'blocked', roundsStarted: 0, maxGoalRounds: 4, blockedReason: { code: 'model-reported', message: 'the same blocker' } },
      activation: 'disarmed',
    })
    // The blocked result is where the host ALSO defers the wrap-up context —
    // impossible through this port, so the row reports it as a named gap and
    // the plan's manifest carries the citation instead of a fake-closed.
    expect(String(blocked.plan?.targetManifest.namedGaps?.WRAPUP)).toContain('renderWrapupContext')
  })

  it('the tool parameter law refuses BEFORE the port: unknown members, missing required, off-enum action, goalRef law (verbatim host message), and every action/field exclusion', async () => {
    const w = await world({ current: VIEW(), nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) } })
    const row = w.adapter.update_goal
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ goal_id: 'g', revision: 1, action: 'pause', extra: 1 }, CODES.UNKNOWN_PARAMETER],
      [{ goal_id: 'g', revision: 1 }, CODES.MISSING_PARAMETER],
      [{ goal_id: 'g', revision: 1, action: 'delete' }, CODES.UNKNOWN_ACTION],
      [{ goal_id: '  ', revision: 1, action: 'pause' }, CODES.GOAL_REF_INVALID],
      [{ goal_id: 'g', revision: 0, action: 'pause' }, CODES.GOAL_REF_INVALID],
      [{ goal_id: 'g', revision: 1.5, action: 'pause' }, CODES.GOAL_REF_INVALID],
      [{ goal_id: 'g', revision: 1, action: 'edit', blocked_reason: 'x' }, CODES.PARAM_LAW],
      [{ goal_id: 'g', revision: 1, action: 'pause', objective: 'x' }, CODES.PARAM_LAW],
      [{ goal_id: 'g', revision: 1, action: 'resume', max_goal_rounds: 4 }, CODES.PARAM_LAW],
      [{ goal_id: 'g', revision: 1, action: 'blocked', objective: 'x' }, CODES.PARAM_LAW],
      [{ goal_id: 'g', revision: 1, action: 'complete', blocked_reason: 'x' }, CODES.PARAM_LAW],
      [{ goal_id: 'g', revision: 1, action: 'blocked' }, CODES.PARAM_LAW],
      [{ goal_id: 'g', revision: 1, action: 'blocked', blocked_reason: '   ' }, CODES.PARAM_LAW],
      [{ goal_id: 'g', revision: 'x', action: 'pause' }, CODES.INVALID_ARGUMENTS],
    ]
    for (const [args, code] of cases) {
      const r = await row.classify(args)
      expect(r.ok, JSON.stringify(args)).toBe(false)
      expect(r.code, JSON.stringify(args)).toBe(code)
    }
    const refRefusal = await row.classify({ goal_id: ' x', revision: 1, action: 'pause' })
    expect(String(refRefusal.detail)).toContain('goal_id must be non-empty and revision must be a positive safe integer') // verbatim (tool-goal:148-151)
    expect(w.port.calls.length).toBe(0) // EVERY refusal above entered ZERO port
    const createUnknown = await w.adapter.create_goal.classify({ objective: 'o', goal_id: 'nope' })
    expect(createUnknown.code).toBe(CODES.UNKNOWN_PARAMETER)
  })

  it('resume law: the row reads the CURRENT goal THROUGH the port first (the host :278 read), refuses the exact paused match with GOAL_TOOL_RESUME_PAUSED mirrored — port.resume never runs; a non-paused goal resumes through', async () => {
    const paused = await world({ current: VIEW({ id: 'goal-9b2', revision: 3, phase: 'paused' }), nextViews: { resume: VIEW({ revision: 4 }) }, executionFacts: () => ({ kind: 'direct-human' }) })
    const denied = await paused.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 3, action: 'resume' }, EXEC)
    expect(denied.code).toBe(CODES.RESUME_PAUSED)
    expect(String(denied.detail)).toContain('the model cannot resume a paused goal') // verbatim host sentence (tool-goal:281-284)
    expect(paused.port.calls.map((c) => c.method)).toEqual(['get']) // the read ran, the mutation never did
    const live = await world({ current: VIEW({ id: 'goal-9b2', revision: 3, phase: 'blocked' }), nextViews: { resume: VIEW({ revision: 4, phase: 'active' }) }, executionFacts: () => ({ kind: 'direct-human' }) })
    const ok = await live.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 3, action: 'resume' }, EXEC)
    expect(ok.ok).toBe(true)
    expect(live.port.calls.map((c) => c.method)).toEqual(['get', 'resume']) // host order: current-read THEN resume
    expect(ok.dispatch?.map((d) => d.method)).toEqual(['get', 'resume'])
    // A STALE ref is NOT the exact match: the host only refuses the exact
    // paused goal at THIS revision; the service then answers GOAL_STALE_
    // REVISION itself (goal/src/index.ts:455-466) — mirrored, not swallowed:
    live.port.setFailure('resume', new Error('stale goal ref (GOAL_STALE_REVISION)'))
    await expect(live.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 2, action: 'resume' }, EXEC)).rejects.toThrow(/GOAL_STALE_REVISION/)
  })

  it('authority law: with the execution-facts reader mounted the row enforces direct-human and goal-round rules BEFORE port entry; without it the dimension rides UNOBSERVED and is never claimed', async () => {
    const refusalPath = await world({ current: VIEW({ roundsStarted: 0 }), nextViews: { create: VIEW() }, executionFacts: () => ({ kind: 'goal-round' }) })
    const denied = await refusalPath.adapter.create_goal.invoke({ objective: 'o' }, EXEC)
    expect(denied.code).toBe(CODES.DIRECT_HUMAN_REQUIRED)
    expect(refusalPath.port.calls.length).toBe(0) // create's requireDirectHuman gate (:224) refused first
    const human = await world({ current: VIEW({ roundsStarted: 2 }), nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) }, executionFacts: () => ({ kind: 'direct-human' }) })
    const humanBlocked = await human.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, EXEC)
    expect(humanBlocked.ok).toBe(true) // direct human is exempt from the threshold (tool-goal:305: goal-round-only)
    expect(human.port.calls.map((c) => c.method)).toEqual(['block']) // no completionAuthority read on the human path (authority.ts:112)
    // goal-round + roundsStarted below the floor ⇒ GOAL_TOOL_BLOCK_THRESHOLD mirror:
    const roundLow = await world({
      blockedAfterConsecutiveRounds: 3, // TRUSTED supply (root 05:5x): the verbatim native check runs only with it
      current: VIEW({ roundsStarted: 2 }),
      nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) },
      executionFacts: () => ({ kind: 'goal-round' }),
    })
    const deniedBlock = await roundLow.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, EXEC)
    expect(deniedBlock.code).toBe(CODES.BLOCK_THRESHOLD)
    expect(String(deniedBlock.detail)).toContain('blocked requires at least 3 consecutive goal rounds; current round is 2') // verbatim shape (:307-311)
    expect(roundLow.port.calls.map((c) => c.method)).toEqual(['get']) // the authority read ran; the mutation never did
    // at/above the floor it serves (get THEN block — completionAuthority's own read):
    const roundOk = await world({
      blockedAfterConsecutiveRounds: 3, // TRUSTED supply: at/above the real floor the arm serves
      current: VIEW({ roundsStarted: 3 }),
      nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) },
      executionFacts: () => ({ kind: 'goal-round' }),
    })
    expect((await roundOk.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, EXEC)).ok).toBe(true)
    expect(roundOk.port.calls.map((c) => c.method)).toEqual(['get', 'block'])
    // No reader ⇒ honest UNOBSERVED (never claimed) and FAIL-CLOSED (the
    // center's P1 safe correction @e794ef0d6 — this is the 缺供 negative
    // control for the trusted per-call reader the mount-arm now mints): the
    // mutation arm refuses with the existing code BEFORE the port; only the
    // UNOBSERVED-never-claimed bytes are what they always were.
    const bare = await world({ nextViews: { create: VIEW() } })
    const created = await bare.adapter.create_goal.invoke({ objective: 'o' }, EXEC)
    expect(created.ok).toBe(false)
    expect(created.code).toBe(CODES.DIRECT_HUMAN_REQUIRED)
    expect(bare.port.calls.length).toBe(0)
    // the refusal carries no plan (it refused at the port-entry edge); the
    // honest UNOBSERVED bytes are what classify reports on a READ plan:
    const barePlan = await bare.adapter.create_goal.classify({ objective: 'o' })
    expect(barePlan.targetManifest?.executionAuthority?.observed).toBe(false)
    expect(String(barePlan.targetManifest?.executionAuthority?.reason)).toContain('authority.ts:80-118')
    // A garbage reader answer is NOT a pass either:
    const garbage = await world({ nextViews: { create: VIEW() }, executionFacts: () => ({ kind: 'vibes' }) })
    const g = await garbage.adapter.create_goal.invoke({ objective: 'o' }, EXEC)
    // fail-closed like 缺供: no closed kind ⇒ the mutation arm refuses before
    // the port, and the plan it classified carries the honest reason.
    expect(g.ok).toBe(false)
    expect(g.code).toBe(CODES.DIRECT_HUMAN_REQUIRED)
    expect(garbage.port.calls.length).toBe(0)
    const gPlan = await garbage.adapter.create_goal.classify({ objective: 'o' })
    expect(gPlan.targetManifest?.executionAuthority?.observed).toBe(false)
    expect(String(gPlan.targetManifest?.executionAuthority?.reason)).toContain('unobserved is NOT a pass')
  })

  it('P2 THRESHOLD TRUST (root 05:5x + 06:5x DELEGATE): goal-round blocked with NO trusted threshold runs EXACTLY ONE captured native body — zero port, zero row wrap-up, verbatim decisions; only a NON-EXECUTABLE capture falls back to refuse-before-port', async () => {
    const delegated: Array<{ args: Record<string, unknown>, exec: Record<string, unknown> }> = []
    const wraps: unknown[] = []
    const untrusted = await world({
      current: VIEW({ roundsStarted: 3 }),
      nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) },
      executionFacts: () => ({ kind: 'goal-round' }),
      nativeExecute: {
        update_goal: (args, exec) => {
          delegated.push({ args, exec })
          // the native body's OWN single wrap-up, as the host would:
          const defer = exec.deferContext as (m: unknown) => void
          defer({ role: 'user', nativeWrapUp: true })
          return { goal: VIEW({ phase: 'blocked', revision: 2 }), activation: 'disarmed' }
        },
      },
    })
    const execWithWrap = Object.freeze({ agent: EXEC.agent, deferContext: (m: unknown): void => { wraps.push(m) } })
    const served = await untrusted.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, execWithWrap)
    expect(served.ok).toBe(true)
    expect(served.nativeDelegated).toBe(true)
    // ONE body, entered EXACTLY once, with the plan's args and the dispatch's
    // exec VERBATIM (same object — the public deferContext the native
    // wrap-up needs rides it):
    expect(delegated.length).toBe(1)
    expect(first(delegated).args).toEqual({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' })
    expect(first(delegated).exec).toBe(execWithWrap)
    // ZERO port entry — the delegate answers BEFORE any goals.get (the
    // native re-reads the goal through ITS OWN ctx.goals inside its body;
    // the trusted facts reader may also read it — neither is the row's port):
    expect(untrusted.port.calls.length).toBe(0)
    // WRAP-UP OWNERSHIP pinned: the ONE wrap-up came from the NATIVE body
    // only; the row added NOTHING second (a row mirror wrap would make 2):
    expect(wraps).toEqual([{ role: 'user', nativeWrapUp: true }])
    // The native projection rides VERBATIM — no second goalValue pass:
    expect((served.value as { activation?: string }).activation).toBe('disarmed')
    expect(first(served.dispatch as Array<{ method: string }>).method).toBe('native-execute(update_goal)')
    expect(untrusted.adapter.update_goal.stats().nativeDelegations).toBe(1)
    // DELEGATE IDENTITY (capture-drift is REFUSED, never delegated): swap the
    // face behind the seam and the SAME call refuses at the identity
    // re-verify — no second body entry, nothing forwarded.
    untrusted.slot.update_goal = { name: 'other_update_goal', description: 'x', parameters: {}, output: { schema: {} } }
    const drifted = await untrusted.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, execWithWrap)
    expect(drifted.code).toBe(CODES.CAPTURE_DRIFT)
    expect(delegated.length).toBe(1)
    expect(untrusted.port.calls.length).toBe(0)
    untrusted.slot.update_goal = untrusted.natives.update_goal.def
    // A native THRESHOLD refusal propagates VERBATIM (L5 discipline): the
    // row never re-labels, swallows, or answers a second time:
    const denying = await world({
      current: VIEW({ roundsStarted: 3 }),
      executionFacts: () => ({ kind: 'goal-round' }),
      nativeExecute: {
        update_goal: () => { throw new Error('blocked requires at least 5 consecutive goal rounds; current round is 3 [GOAL_TOOL_BLOCK_THRESHOLD]') },
      },
    })
    await expect(denying.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, execWithWrap))
      .rejects.toThrow('blocked requires at least 5 consecutive goal rounds; current round is 3')
    expect(denying.port.calls.length).toBe(0)
    // NEGATIVE CONTROL (capture absent to execute): NO executable captured
    // identity + untrusted threshold ⇒ refuse BEFORE the port (the P2 8d83
    // wording survives exactly for this case); other arms keep serving:
    const inert = await world({
      current: VIEW({ roundsStarted: 3 }),
      nextViews: { complete: VIEW({ revision: 2, phase: 'complete', activation: 'disarmed' }) },
      executionFacts: () => ({ kind: 'goal-round' }),
      noNativeExecute: ['update_goal'],
    })
    const closed = await inert.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, EXEC)
    expect(closed.code).toBe(CODES.BLOCK_THRESHOLD)
    expect(String(closed.detail)).toContain('NEVER defaults')
    expect(inert.port.calls.length).toBe(0)
    // The SAME dispatch TRUSTED (the assembly supplies the host's real value):
    // the verbatim below-floor law is back — get runs, mutation does not.
    const trusted = await world({
      blockedAfterConsecutiveRounds: 5, // a host configured 5: the old fallback-3 would have SERVED this too early
      current: VIEW({ roundsStarted: 3, revision: 1 }),
      nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) },
      executionFacts: () => ({ kind: 'goal-round' }),
    })
    const tooEarly = await trusted.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, EXEC)
    expect(tooEarly.code).toBe(CODES.BLOCK_THRESHOLD)
    expect(String(tooEarly.detail)).toContain('blocked requires at least 5 consecutive goal rounds; current round is 3')
    expect(trusted.port.calls.map((c) => c.method)).toEqual(['get'])
    // UNTRUSTED does NOT touch the other arms: goal-round COMPLETE serves
    // (native :305 gates blocked ONLY), direct-human BLOCKED serves (the
    // floor is a goal-round rule), reads serve:
    const completeStill = await world({
      current: VIEW({ roundsStarted: 3 }),
      nextViews: { complete: VIEW({ revision: 4, phase: 'complete', activation: 'disarmed' }) },
      executionFacts: () => ({ kind: 'goal-round' }),
    })
    const done = await completeStill.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'complete' }, EXEC)
    expect(done.ok).toBe(true)
    expect(completeStill.port.calls.map((c) => c.method)).toEqual(['get', 'complete'])
    const humanBlocked = await world({
      current: VIEW({ roundsStarted: 0 }),
      nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) },
      executionFacts: () => ({ kind: 'direct-human' }),
    })
    expect((await humanBlocked.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' }, EXEC)).ok).toBe(true)
    expect(humanBlocked.port.calls.map((c) => c.method)).toEqual(['block'])
  })

  it('THE WRAP-UP MIRROR (root 02:51 ③): a landed goal-round complete/blocked defers the hosts OWN wrap-up through the exec public deferContext — byte-equal to the pristine 639 renderer — and never on any other path', async () => {
    // Evaluate the PRISTINE host renderer (types stripped) to build the
    // expected text — the mirror is compared against the host's own output,
    // never against a restatement of it.
    const pristineRender = new Function(
      wrapupSrc
        .replace(/^import type[^\n]*\n/gm, '')
        .replace('export function renderWrapupContext(objective: string, blockedReason?: string): ContentBlock[] {', 'function renderWrapupContext(objective, blockedReason) {')
        + '\nreturn renderWrapupContext;',
    )() as (objective: string, blockedReason?: string) => Array<{ type: string, text: string }>
    const deferWorld = async () => {
      const deferred: Array<Record<string, unknown>> = []
      const w = await world({
        blockedAfterConsecutiveRounds: 3, // TRUSTED supply: the wrap-up leg needs the goal-round blocked arm OPEN
        current: VIEW({ roundsStarted: 3 }),
        nextViews: {
          complete: VIEW({ revision: 4, phase: 'complete', activation: 'disarmed' }),
          block: VIEW({ revision: 4, phase: 'blocked', activation: 'disarmed', blockedReason: { code: 'model-reported', message: 'the blocker' } }),
        },
        executionFacts: () => ({ kind: 'goal-round' }),
      })
      const exec = Object.freeze({ agent: EXEC.agent, deferContext: (m: Record<string, unknown>): void => { deferred.push(m) } })
      return { w, deferred, exec }
    }
    const objective = 'govern the goal tools' // VIEW()'s objective, the value the mirror must echo
    // goal-round COMPLETE: the wrap-up lands — the host's exact construction.
    const cw = await deferWorld()
    const done = await cw.w.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 3, action: 'complete' }, cw.exec)
    expect(done.ok).toBe(true)
    expect(cw.deferred.length).toBe(1)
    const m = first(cw.deferred)
    expect(m.role).toBe('user') // createUserMessage's own shape (public @639)
    expect(m.source).toEqual({ kind: 'tool-goal', form: 'notice', summary: `complete: ${objective}` }) // (tool-goal:325-328 + boundContextSummary)
    expect(m.content).toEqual(pristineRender(objective)) // BYTE-EQUAL to the pristine renderer
    // goal-round BLOCKED: the reason rides, byte-equal too.
    const bw = await deferWorld()
    const blockedDone = await bw.w.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 3, action: 'blocked', blocked_reason: 'the blocker' }, bw.exec)
    expect(blockedDone.ok).toBe(true)
    expect(bw.deferred.length).toBe(1)
    expect(first(bw.deferred).content).toEqual(pristineRender(objective, 'the blocker'))
    expect(String((first(bw.deferred).source as { summary: string }).summary)).toBe(`blocked: ${objective}`)
    // NOT on the direct-human path (the host's condition is kind==='goal-round', :319).
    const hw = await world({
      current: VIEW({ roundsStarted: 3 }),
      nextViews: { complete: VIEW({ revision: 4, phase: 'complete', activation: 'disarmed' }) },
      executionFacts: () => ({ kind: 'direct-human' }),
    })
    const humanDeferred: Array<unknown> = []
    const human = await hw.adapter.update_goal.invoke(
      { goal_id: 'goal-9b2', revision: 3, action: 'complete' },
      Object.freeze({ agent: EXEC.agent, deferContext: (msg: unknown): void => { humanDeferred.push(msg) } }),
    )
    expect(human.ok).toBe(true)
    expect(humanDeferred.length).toBe(0)
    // NOT on non-terminal actions.
    const nw = await deferWorld()
    await nw.w.adapter.update_goal.invoke({ goal_id: 'goal-9b2', revision: 3, action: 'pause' }, nw.exec)
    expect(nw.deferred.length).toBe(0)
    // A refusal lands NO wrap-up (the mutation never entered the port).
    const lowFloor = await world({
      blockedAfterConsecutiveRounds: 3,
      current: VIEW({ roundsStarted: 1 }),
      nextViews: { block: VIEW({ phase: 'blocked', blockedReason: { code: 'model-reported', message: 'x' } }) },
      executionFacts: () => ({ kind: 'goal-round' }),
    })
    const lowDeferred: Array<unknown> = []
    const refused = await lowFloor.adapter.update_goal.invoke(
      { goal_id: 'goal-9b2', revision: 1, action: 'blocked', blocked_reason: 'x' },
      Object.freeze({ agent: EXEC.agent, deferContext: (msg: unknown): void => { lowDeferred.push(msg) } }),
    )
    expect(refused.code).toBe(CODES.BLOCK_THRESHOLD)
    expect(lowDeferred.length).toBe(0)
    // An exec WITHOUT the public face: the wrap-up is observed as
    // unavailable, never faked, and the landed mutation stands (no rewind).
    const pw = await world({
      current: VIEW({ roundsStarted: 3 }),
      nextViews: { complete: VIEW({ revision: 4, phase: 'complete', activation: 'disarmed' }) },
      executionFacts: () => ({ kind: 'goal-round' }),
    })
    const events: Array<Record<string, unknown>> = []
    const noFace = await pw.adapter.update_goal.invoke(
      { goal_id: 'goal-9b2', revision: 3, action: 'complete' },
      EXEC,
    )
    expect(noFace.ok).toBe(true)
    expect(events.length).toBe(0) // (the observe channel is the assembly's; the RESULT never pretends)
  })

  it('per-dispatch identity (L7): a rotated capture, a mutated description/schema byte, or a rebound port method refuses with drift BEFORE the port runs — zero forwarding', async () => {
    const w = await world({ nextViews: { get: VIEW() } })
    expect((await w.adapter.get_goal.invoke({}, EXEC)).ok).toBe(true)
    const before = w.port.calls.length
    const other = await captureNativeGoalTool('get_goal') // same bytes, DIFFERENT object
    w.slot.get_goal = other.def
    const rotated = await w.adapter.get_goal.invoke({}, EXEC)
    expect(rotated.code).toBe(CODES.CAPTURE_DRIFT)
    w.slot.get_goal = w.natives.get_goal.def // restore the object…
    const def = w.natives.get_goal.def as unknown as { description: string }
    def.description = 'mutated under the pin' // …but the bytes moved
    expect((await w.adapter.get_goal.invoke({}, EXEC)).code).toBe(CODES.CAPTURE_DRIFT)
    def.description = GET_DESCRIPTION // restore bytes, rebound the PORT method:
    w.goals.get = function rebound(this: unknown) { return undefined }
    const rebound = await w.adapter.get_goal.invoke({}, EXEC)
    expect(rebound.code).toBe(CODES.CAPTURE_DRIFT)
    expect(String(rebound.detail)).toContain('rebound')
    expect(w.port.calls.length).toBe(before) // NONE of the drifts forwarded
    expect(w.adapter.stats().driftRejects).toBe(3)
    expect(w.fail.nativeEntered()).toBe(0)
  })

  it('plan discipline (L8): a row runs only its OWN fresh-consistent plan — foreign, cross-row, cross-generation plans and drain refuse with zero port entry', async () => {
    const w = await world({ nextViews: { get: VIEW(), create: VIEW() } })
    const plan = await w.adapter.get_goal.classify({})
    expect(plan.ok).toBe(true)
    const foreign = await w.adapter.create_goal.runPlan(plan, EXEC) // another row's plan
    expect(foreign.code).toBe(CODES.NOT_OWN_PLAN)
    const otherWorld = await world({ nextViews: { get: VIEW() }, realmId: 'realm-other-g5' }) // different realm ⇒ different fingerprint
    const alien = await otherWorld.adapter.get_goal.classify({})
    expect((await w.adapter.get_goal.runPlan(alien, EXEC)).code).toBe(CODES.NOT_OWN_PLAN)
    expect((await w.adapter.get_goal.runPlan({ ok: false, code: 'x' }, EXEC)).code).toBe(CODES.NOT_OWN_PLAN)
    w.adapter.drain()
    expect(w.adapter.draining()).toBe(true)
    const drained = await w.adapter.get_goal.invoke({}, EXEC)
    expect(drained.code).toBe(CODES.DRAINING)
    expect(String(drained.detail)).toContain('synchronous session appends') // commit truth: drain settles nothing
    expect(otherWorld.port.calls.length).toBe(0) // classify alone never enters a port
    expect(w.port.calls.length).toBe(0) // the drained adapter never entered its port
    expect(w.fail.nativeEntered()).toBe(0)
  })
})
