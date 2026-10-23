/**
 * A5M2-TEAM-ADAPTERS — the B-TEAM family spec (census records 74–82, 86;
 * family B-TEAM, ownerRole CONTROL, mountCondition always; contract
 * M0-B-FAMILY-TARGET-CONTRACTS.md §B-TEAM).
 *
 * THE DELEGATION MODE (read with the module header): B-TEAM's natives are
 * our OWN lane products — the REAL `createTeamTools(options)` definitions
 * built HERE over real port DOUBLES (facade/controlService/messaging/
 * activity/resolveCaller) — and the governed row delegates each admitted
 * call BACK into that same captured governed execute (contract: 全部采用既有
 * Team service角色/归属校验 / 不得重复建立同义service层). So the legs below
 * measure BOTH sides honestly: the ROW's added law (admit seat, argument
 * mirror answering the LANE'S OWN rejected-value bytes, plan memo, drift
 * refusals, zero-delegate on every refusal) AND the fact that the existing
 * chain's governance actually RUNS behind it (caller-root binding,
 * caller-unresolved, the Leader-gate, the last-mile guard, unexpected-error
 * rethrow) — never re-implemented here.
 *
 * HONEST DISCLOSURE (per ruling): REAL definitions from the REAL factory +
 * DOUBLES for the five runtime ports + a double admit/placementFeed = C1-
 * grade real-surface measurement, NOT C2 (no Host, no durable storage, no
 * real Team). The family C2 (10/10 + cross-root/member/role negatives
 * through the real services) is the paired acceptance's obligation —
 * NAMED GAP SERVICE_ENTRY_DELEGATION carries it. The B-CONTROL five (83/84/
 * 85/87/88, g1-surface-adapters' landed facts) are a DIFFERENT family: a
 * mutual non-recognition leg proves they cannot ride this module.
 * Windows dimensions: NOT RUN, never claimed.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createTeamTools } from '../../tools/src/index.js'

// ── the production module under spec (hand-cast, house idiom) ─────────────
type PlanTarget = {
  contract: string
  root: { claim: string | null; adjudication: string }
  member: { claim?: string | null; adjudication?: string } | string
  object: string
  action: string
  revision: string
  effect: string
  face: string
}
type ToolErrorValue = { status: 'rejected'; code: string; message: string; details?: Record<string, unknown> }
type Plan = {
  rowName: string
  recordIndex: number
  operation: string
  target: PlanTarget
  args: Record<string, unknown>
  toolError?: ToolErrorValue
  parametersFingerprint: string
  namedGaps: Record<string, string>
}
type ClassifyResult = { ok: boolean; code?: string; detail?: string; plan?: Plan }
type DelegateResult = { ok?: boolean; code?: string; detail?: string; settled?: string; value?: unknown }
type Row = {
  name: string
  familyId: string
  recordIndex: number
  mountCondition: string
  active: boolean
  capturePresent: boolean
  description: string | null
  parameters: Record<string, unknown> | null
  definitionIdentity: string | null
  effectDelta?: string
  namedGaps: Record<string, string>
  classify: (args: unknown) => ClassifyResult
  delegate: (plan: Plan, ctx?: { exec?: unknown }) => Promise<DelegateResult>
}
type Definition = {
  [face: string]: unknown
  name: string
  description: string
  output: { schema: unknown; render: unknown }
  parameters?: Record<string, unknown>
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
type Registration = { name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }
type AssemblyValue = {
  ok: true
  familyId: string
  revision: number
  mountCondition: string
  providerId: string
  placementNames: string[]
  definitions: Definition[]
  rows: Record<string, { status: string; reason?: string; row: Row; definition?: Definition }>
  declared: Array<{ name: string; recordIndex: number; familyId: string; status: string; reason: string }>
  rowOf: (name: string) => Row | undefined
  drain: () => { event: string; semantics: string }
  inFlight: () => { dispatches: number; refuses: number }
  familyRegistrations: () => Registration[]
}
type AssemblyResult = AssemblyValue | { ok: false; code: string; message: string }
type AdapterModule = {
  A5_B_TEAM_FAMILY_ID: string
  A5_B_TEAM_ADAPTER_REVISION: number
  A5_B_TEAM_MOUNT_CONDITION: string
  A5_B_TEAM_RECORD_SPECS: Record<string, { recordIndex: number; operation: string }>
  A5_B_TEAM_TOOL_NAMES: string[]
  A5_B_TEAM_EFFECT_LABELS: Record<string, string>
  A5_B_TEAM_CODES: Record<string, string>
  A5_B_TEAM_NAMED_GAPS: Record<string, string>
  createTeamAdapterAssembly: (input?: Record<string, unknown>) => AssemblyResult
}

const ADAPTER_PATH = new URL('../src/plugin/live/governed-families/team-adapters.mjs', import.meta.url)
const ADAPTER = (await import(ADAPTER_PATH.href)) as AdapterModule
const CODES = ADAPTER.A5_B_TEAM_CODES
const NAMES = ADAPTER.A5_B_TEAM_TOOL_NAMES

// ── the REAL lane factory over recorded port doubles (the sanctioned
//    service entries — C1-grade real defs; the ports are disclosed doubles) ─
type Harness = {
  calls: string[]
  toolset: { tools: readonly Definition[] }
  byName: Map<string, Definition>
  setGuardBlock: (value: boolean) => void
  setRuntimeError: (error: Error | undefined) => void
  setCallerRoot: (root: string) => void
  setCallerInstance: (instanceId: string) => void
  setCallerResolvable: (value: boolean) => void
}

const ROOT = 'session-root-team-1'
const OTHER_ROOT = 'session-root-OTHER-1'
const LEADER_SESSION = 'session-leader-live-1'

function makeHarness(): Harness {
  const calls: string[] = []
  const state = {
    guardBlock: false,
    runtimeError: undefined as Error | undefined,
    callerRoot: ROOT,
    callerInstance: 'inst-leader',
    callerResolvable: true,
  }
  const options = {
    teamRuntime: {
      performAction: async (request: Record<string, unknown>) => {
        calls.push(`performAction:${String(request.action)}`)
        if (state.runtimeError !== undefined) throw state.runtimeError
        return {
          action: String(request.action),
          rootSessionId: String(request.rootSessionId),
          callerRole: 'leader',
          ...(request.targetInstanceId !== undefined ? { targetInstanceId: String(request.targetInstanceId) } : {}),
          effect: { kind: 'fact-recorded', factType: 'fixture-effect', sequence: 1 },
          requestToken: String(request.requestToken),
        }
      },
    },
    controlService: {
      guardOperation: async (scope: Record<string, unknown>) => {
        calls.push(`guardOperation:${String(scope.targetInstanceId)}`)
        return state.guardBlock
          ? { allowed: false, reason: 'pending-approval', requestId: 'req-control-9' }
          : { allowed: true }
      },
    },
    messaging: {
      sendTeamMessage: async (request: Record<string, unknown>) => {
        calls.push('sendTeamMessage')
        return {
          rootSessionId: String(request.rootSessionId),
          action: 'send_message',
          callerRole: 'leader',
          recipientInstanceId: String(request.recipientInstanceId),
          deliveryMode: 'direct',
          deliveredToInstanceId: String(request.recipientInstanceId),
          deliveredToSessionId: 'session-child-live-1',
          factSequence: 7,
          deliveredSequence: 8,
          requestToken: String(request.requestToken),
        }
      },
    },
    activity: {
      listActivityFacts: () => {
        calls.push('listActivityFacts')
        return []
      },
      recordProgress: async (row: Record<string, unknown>) => {
        calls.push('recordProgress')
        return { sequence: Number(row.sequence), progress: String(row.progress) }
      },
    },
    resolveCaller: async (sessionId: string) => {
      calls.push(`resolveCaller:${sessionId}`)
      if (!state.callerResolvable) throw new Error('fixture: session is not a team caller')
      return {
        caller: { kind: 'instance', instanceId: state.callerInstance },
        rootSessionId: state.callerRoot,
      }
    },
  }
  const toolset = createTeamTools(options as unknown as Parameters<typeof createTeamTools>[0]) as unknown as { tools: readonly Definition[] }
  const byName = new Map(toolset.tools.map((tool) => [tool.name, tool]))
  if (byName.size !== 15) throw new Error(`fixture: createTeamTools answered ${byName.size} tools — the real fifteen-tool factory moved; failing closed`)
  for (const name of NAMES) {
    if (!byName.has(name)) throw new Error(`fixture: the real factory no longer answers '${name}' — failing closed`)
  }
  return {
    calls,
    toolset,
    byName,
    setGuardBlock: (value) => {
      state.guardBlock = value
    },
    setRuntimeError: (error) => {
      state.runtimeError = error
    },
    setCallerRoot: (root) => {
      state.callerRoot = root
    },
    setCallerInstance: (instanceId) => {
      state.callerInstance = instanceId
    },
    setCallerResolvable: (value) => {
      state.callerResolvable = value
    },
  }
}

const CAPTURE_FOR = (harness: Harness, names: readonly string[] = NAMES): Record<string, { native: Definition; definitionIdentity: string }> =>
  Object.fromEntries(names.map((name) => {
    const native = harness.byName.get(name)
    if (native === undefined) throw new Error(`no real '${name}' definition`)
    return [name, { native, definitionIdentity: `cap:${name}` }]
  }))

type MountOverrides = Record<string, unknown>
function mount(harness: Harness, overrides: MountOverrides = {}): AssemblyValue {
  const delegates: Record<string, Definition['execute']> = {}
  for (const name of NAMES) {
    const native = harness.byName.get(name)
    if (native === undefined) throw new Error(`no real '${name}' definition`)
    delegates[name] = native.execute
  }
  const input: Record<string, unknown> = {
    captured: CAPTURE_FOR(harness),
    liveNative: (name: string) => harness.byName.get(name),
    teamDelegates: delegates,
    liveTeamDelegates: () => delegates,
    placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
    admit: async () => {
      harness.calls.push('admit')
      return { ok: true }
    },
    ...overrides,
  }
  const result = ADAPTER.createTeamAdapterAssembly(input)
  if (result.ok !== true) throw new Error(`mount fixture refused: ${result.code} — ${result.message}`)
  return result
}

const EXEC = { agent: { id: LEADER_SESSION }, callId: 'call-1' }
const VALID_ARGS: Record<string, Record<string, unknown>> = {
  team_list_members: { rootSessionId: ROOT, requestToken: 'tok-list-1' },
  team_list_templates: { rootSessionId: ROOT, requestToken: 'tok-tpl-1' },
  team_inspect_config: { rootSessionId: ROOT, requestToken: 'tok-cfg-1', targetInstanceId: 'inst-a1' },
  team_create_member: { rootSessionId: ROOT, requestToken: 'tok-new-1', delegationTemplateId: 'tpl-worker', label: 'builder' },
  team_delegate: { rootSessionId: ROOT, requestToken: 'tok-del-1', delegationTemplateId: 'tpl-worker', label: 'builder', prompt: 'do the work' },
  team_follow_up: { rootSessionId: ROOT, requestToken: 'tok-fup-1', targetInstanceId: 'inst-a1', prompt: 'continue' },
  team_collect: { rootSessionId: ROOT, requestToken: 'tok-col-1', requestTokens: ['tok-del-1'] },
  team_send_message: { rootSessionId: ROOT, requestToken: 'tok-msg-1', recipientInstanceId: 'inst-a1', body: 'hello' },
  team_report_progress: { rootSessionId: ROOT, requestToken: 'tok-rep-1', instanceId: 'inst-a1', subject: 'lane-1', progress: 'in-progress' },
  team_archive_member: { rootSessionId: ROOT, requestToken: 'tok-arc-1', targetInstanceId: 'inst-a1' },
}

// ── (a) frozen census facts + module purity ────────────────────────────────
describe('a5m2-team-adapters (a) frozen facts + purity', () => {
  it('census/contract facts and the ten-record closed family (B-CONTROL five NEVER ride)', () => {
    expect(ADAPTER.A5_B_TEAM_FAMILY_ID).toBe('B-TEAM')
    expect(ADAPTER.A5_B_TEAM_ADAPTER_REVISION).toBe(1)
    expect(ADAPTER.A5_B_TEAM_MOUNT_CONDITION).toBe('always')
    expect([...NAMES].sort()).toEqual([
      'team_archive_member', 'team_collect', 'team_create_member', 'team_delegate',
      'team_follow_up', 'team_inspect_config', 'team_list_members', 'team_list_templates',
      'team_report_progress', 'team_send_message',
    ])
    const indices = Object.fromEntries(Object.entries(ADAPTER.A5_B_TEAM_RECORD_SPECS).map(([k, v]) => [k, v.recordIndex]))
    expect(indices).toEqual({
      team_list_members: 74, team_list_templates: 75, team_inspect_config: 76,
      team_create_member: 77, team_delegate: 78, team_follow_up: 79, team_collect: 80,
      team_send_message: 81, team_report_progress: 82, team_archive_member: 86,
    })
    // The landed B-CONTROL five (g1-surface-adapters records 83/84/85/87/88).
    for (const foreign of ['team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_grant_permission', 'team_revoke_permission']) {
      expect(NAMES).not.toContain(foreign)
    }
  })
  it('module closure: exactly [node:crypto], zero lane/host imports, no dynamic import', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'team-adapters.mjs'), 'utf8')
    const statics = [...source.matchAll(/^import .* from '(.+)'$/gm)].map((m) => String(m[1]))
    expect(statics).toEqual(['node:crypto'])
    expect(source).not.toContain('import(')
    expect(source).not.toMatch(/require\(/)
  })
})

// ── (b) real capture parity: the COMPLETE face travels, ONLY execute is
//        replaced (root 8b4 law) ────────────────────────────────────────────
describe('a5m2-team-adapters (b) real captured definition parity', () => {
  it('every placed definition keeps EVERY real makeDefinition face by reference; only execute is replaced', () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    expect(assembly.definitions).toHaveLength(10)
    expect(assembly.placementNames.length).toBe(10)
    expect(assembly.declared).toEqual([])
    for (const definition of assembly.definitions) {
      const native = harness.byName.get(definition.name)
      if (native === undefined) throw new Error('no native')
      expect(definition.description).toBe(native.description)
      expect(definition.parameters).toBe(native.parameters) // SAME compiled object
      expect(definition.output).toBe(native.output)
      expect(definition.output.render).toBe(native.output.render) // the REAL render
      expect(definition.execute).not.toBe(native.execute) // ONLY execute
      // the REAL minimum-entry shape rides (schema defined, render function):
      expect(native.output.schema).toBeDefined()
      expect(typeof native.output.render).toBe('function')
    }
  })
  it('no captures ⇒ ten honest DECLARED-INACTIVE rows, zero definitions, zero registrations', async () => {
    const harness = makeHarness()
    const delegates: Record<string, unknown> = {}
    for (const name of NAMES) {
      const native = harness.byName.get(name)
      if (native !== undefined) delegates[name] = native.execute
    }
    const result = ADAPTER.createTeamAdapterAssembly({
      teamDelegates: delegates,
      liveTeamDelegates: () => delegates,
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
      admit: async () => ({ ok: true }),
    })
    expect(result.ok).toBe(true)
    if (result.ok !== true) return
    expect(result.definitions).toEqual([])
    expect(result.declared).toHaveLength(10)
    expect(result.familyRegistrations()).toEqual([])
    const row = result.rowOf('team_delegate')
    if (row === undefined) throw new Error('no row')
    expect(row.active).toBe(false)
    expect(row.classify(VALID_ARGS.team_delegate)).toEqual({ ok: false, code: CODES.CAPTURE_ABSENT, detail: expect.stringContaining('capture-absent') })
    // (declared rows answer the SAME refusal synchronously — await-proof)
    expect(await row.delegate({} as Plan, {})).toMatchObject({ ok: false, code: CODES.CAPTURE_ABSENT })
    expect(harness.calls).toEqual([])
  })
  it('assembly refusals: split set (rebuild behind a stale capture), missing/foreign/partial inputs', () => {
    const harness = makeHarness()
    const delegates: Record<string, unknown> = {}
    for (const name of NAMES) {
      const native = harness.byName.get(name)
      if (native !== undefined) delegates[name] = native.execute
    }
    const base = {
      captured: CAPTURE_FOR(harness),
      liveNative: (name: string) => harness.byName.get(name),
      teamDelegates: delegates,
      liveTeamDelegates: () => delegates,
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
      admit: async () => ({ ok: true }),
    }
    const refuse = (overrides: MountOverrides): string => {
      const result = ADAPTER.createTeamAdapterAssembly({ ...base, ...overrides })
      if (result.ok === true) throw new Error('expected refusal')
      return result.code
    }
    expect(refuse({ admit: undefined })).toBe(CODES.ADMISSION_ABSENT)
    expect(refuse({ placementFeed: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ liveTeamDelegates: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ teamDelegates: 'nope' })).toBe(CODES.PORT_ABSENT)
    expect(refuse({ liveTeamDelegates: () => ({ ...delegates }) })).toBe(CODES.PORT_DRIFT)
    expect(refuse({ captured: { ...base.captured, team_request_control: CAPTURE_FOR(harness, ['team_list_members']).team_list_members! } }))
      .toBe(CODES.NON_FAMILY_CAPTURE)
    const half = CAPTURE_FOR(harness, ['team_delegate'])
    const noOutput = { ...half.team_delegate!.native } as Record<string, unknown>
    delete noOutput.output
    expect(refuse({ captured: { team_delegate: { ...half.team_delegate!, native: noOutput as unknown as Definition } } })).toBe(CODES.CAPTURE_INCOMPLETE)
    expect(refuse({ liveNative: undefined })).toBe(CODES.LIVE_NATIVE_ABSENT)
    // A partial delegate set must ALSO ride the live read (otherwise the
    // split-mount check fires first — that ordering is itself pinned below).
    const partial: Record<string, unknown> = { team_delegate: delegates.team_delegate }
    expect(refuse({ teamDelegates: partial, liveTeamDelegates: () => partial })).toBe(CODES.PORT_METHOD_ABSENT)
    expect(refuse({ teamDelegates: partial })).toBe(CODES.PORT_DRIFT) // split-mount ordering
    expect(refuse({ stranger: 1 })).toBe(CODES.INPUT_INVALID)
    // THE SPLIT SET (L3): delegates rebuilt from a SECOND createTeamTools
    // run — every face matches BY VALUE but the execute is a DIFFERENT
    // function object behind a stale capture → refused at assembly.
    const second = makeHarness()
    const rebuilt: Record<string, unknown> = {}
    for (const name of NAMES) {
      const native = second.byName.get(name)
      if (native !== undefined) rebuilt[name] = native.execute
    }
    expect(refuse({ teamDelegates: rebuilt, liveTeamDelegates: () => rebuilt })).toBe(CODES.TEAM_SET_SPLIT)
  })
})

// ── (d) classify mirrors the LANE'S OWN argument law (bytes) with zero
//        delegate entry ────────────────────────────────────────────────────
describe('a5m2-team-adapters (d) the argument mirror answers lane bytes', () => {
  it('the real compiled required arrays equal the frozen face law', () => {
    const harness = makeHarness()
    const expected: Record<string, string[]> = {
      team_list_members: ['rootSessionId', 'requestToken'],
      team_list_templates: ['rootSessionId', 'requestToken'],
      team_inspect_config: ['rootSessionId', 'requestToken', 'targetInstanceId'],
      team_create_member: ['rootSessionId', 'requestToken', 'delegationTemplateId', 'label'],
      team_delegate: ['rootSessionId', 'requestToken', 'label', 'prompt'],
      team_follow_up: ['rootSessionId', 'requestToken', 'targetInstanceId', 'prompt'],
      team_collect: ['rootSessionId', 'requestToken', 'requestTokens'],
      team_send_message: ['rootSessionId', 'requestToken', 'recipientInstanceId', 'body'],
      team_report_progress: ['rootSessionId', 'requestToken', 'instanceId', 'subject', 'progress'],
      team_archive_member: ['rootSessionId', 'requestToken', 'targetInstanceId'],
    }
    const assembly = mount(harness)
    for (const [name, required] of Object.entries(expected)) {
      const row = assembly.rowOf(name)
      if (row === undefined) throw new Error('no row')
      const parameters = row.parameters as { required?: string[] } | null
      expect(parameters?.required, name).toEqual(required)
    }
  })
  it('byte-identical lane rejections answered as plan toolError VALUES with zero delegate entry', () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    const cases: Array<[string, Record<string, unknown>, ToolErrorValue]> = [
      ['team_list_members', { requestToken: 't' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: "team-tools: required argument 'rootSessionId' is missing", details: { field: 'rootSessionId' } }],
      ['team_list_members', { rootSessionId: 'r'.repeat(256), requestToken: 't' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: 'team-tools: argument \'rootSessionId\' exceeds 255 characters', details: { field: 'rootSessionId', maxLength: 255, length: 256 } }],
      ['team_list_members', { rootSessionId: ROOT, requestToken: 't'.repeat(129) }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: 'team-tools: argument \'requestToken\' exceeds 128 characters', details: { field: 'requestToken', maxLength: 128, length: 129 } }],
      ['team_list_members', { rootSessionId: ROOT, requestToken: '' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: "team-tools: argument 'requestToken' must be non-empty", details: { field: 'requestToken' } }],
      ['team_inspect_config', { rootSessionId: ROOT, requestToken: 't' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: "team-tools: required argument 'targetInstanceId' is missing", details: { field: 'targetInstanceId' } }],
      ['team_delegate', { rootSessionId: ROOT, requestToken: 't', label: 'l', prompt: 'p' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: 'team-tools: delegate requires exactly one of delegationTemplateId / delegationInstanceId' }],
      ['team_delegate', { rootSessionId: ROOT, requestToken: 't', label: 'l', prompt: 'p', delegationTemplateId: 'a', delegationInstanceId: 'inst-a1' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: 'team-tools: delegate accepts exactly one of delegationTemplateId / delegationInstanceId, not both' }],
      ['team_collect', { rootSessionId: ROOT, requestToken: 't', requestTokens: [] }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: "team-tools: argument 'requestTokens' must be a non-empty array of at most 64 work request tokens" }],
      ['team_collect', { rootSessionId: ROOT, requestToken: 't', requestTokens: [''] }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: "team-tools: argument 'requestTokens' entries must be non-empty strings" }],
      ['team_report_progress', { rootSessionId: ROOT, requestToken: 't', instanceId: 'inst-a1', subject: 's', progress: 'done' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: "team-tools: argument 'progress' must be one of in-progress | completed | blocked", details: { progress: 'done' } }],
      ['team_send_message', { rootSessionId: ROOT, requestToken: 't', recipientInstanceId: 'inst-a1', body: 'b'.repeat(8193) }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: 'team-tools: argument \'body\' exceeds 8192 characters', details: { field: 'body', maxLength: 8192, length: 8193 } }],
      ['team_follow_up', { rootSessionId: ROOT, requestToken: 't', targetInstanceId: 7, prompt: 'p' }, { status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS', message: "team-tools: argument 'targetInstanceId' must be a string", details: { field: 'targetInstanceId' } }],
    ]
    for (const [name, args, expectedError] of cases) {
      const row = assembly.rowOf(name)
      if (row === undefined) throw new Error('no row')
      const classified = row.classify(args)
      expect(classified.ok, `${name} ${JSON.stringify(args)}`).toBe(true)
      expect(classified.plan?.toolError, name).toEqual(expectedError)
      expect(classified.plan?.target.face, name).toContain('REFUSED')
    }
    // an OPTIONAL empty string is ABSENT (lane law), not an error:
    const row = assembly.rowOf('team_delegate')
    if (row === undefined) throw new Error('no row')
    const ok = row.classify({ rootSessionId: ROOT, requestToken: 't', delegationTemplateId: 'tpl', label: 'l', prompt: 'p', groupId: '' })
    expect(ok.ok).toBe(true)
    expect(ok.plan?.toolError).toBeUndefined()
    expect(harness.calls).toEqual([]) // every mirror answered with ZERO delegate entry
  })
  it('plans are frozen, fingerprinted, gap-carrying, and carry the §B-TEAM TARGET', () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    const row = assembly.rowOf('team_create_member')
    if (row === undefined) throw new Error('no row')
    const classified = row.classify(VALID_ARGS.team_create_member)
    const plan = classified.plan
    if (plan === undefined) throw new Error('no plan')
    expect(Object.isFrozen(plan)).toBe(true)
    expect(plan.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(Object.keys(plan.namedGaps).sort()).toEqual(['CALLER_IDENTITY', 'GUARD_AND_LIFECYCLE', 'PLAN_ONCE_MEMO', 'SERVICE_ENTRY_DELEGATION'])
    expect(plan.target.contract).toContain('§B-TEAM')
    expect(plan.target.root.claim).toBe(ROOT)
    expect(plan.target.root.adjudication).toContain('TEAM_TOOL_CALLER_ROOT_MISMATCH')
    expect(plan.target.member).toEqual({ claim: 'tpl-worker', adjudication: expect.stringContaining('activation authority') })
    expect(plan.target.action).toBe('team-create-member')
    expect(plan.target.revision).toContain('facade idempotency identity')
    expect(plan.target.effect).toBe(ADAPTER.A5_B_TEAM_EFFECT_LABELS.team_create_member)
    // the gap text states the boundary honestly (never faked closed):
    expect(ADAPTER.A5_B_TEAM_NAMED_GAPS.SERVICE_ENTRY_DELEGATION).toContain('不得重复建立同义service层')
    expect(ADAPTER.A5_B_TEAM_NAMED_GAPS.SERVICE_ENTRY_DELEGATION).toContain('VERIFIES NONE')
    expect(ADAPTER.A5_B_TEAM_NAMED_GAPS.CALLER_IDENTITY).toContain('never trusted from the caller string')
    // non-record args are a MOUNT ANOMALY refusal (sibling house law), not a value:
    expect(row.classify('nope')).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(row.classify([1, 2])).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
  })
})

// ── (e) the admit seat (L10) ──────────────────────────────────────────────
describe('a5m2-team-adapters (e) required admit seat', () => {
  it('a DENY throws the refusing side\'s own bytes with zero delegate entry', async () => {
    const harness = makeHarness()
    const assembly = mount(harness, {
      admit: async () => ({ ok: false, code: 'PA_DENY', detail: 'the walk stopped here' }),
    })
    const definition = assembly.definitions.find((d) => d.name === 'team_delegate')
    if (definition === undefined) throw new Error('no def')
    const error = await definition.execute(VALID_ARGS.team_delegate, EXEC).then(() => undefined, (e: unknown) => e as Error & { teamRefusal?: { code: string; detail: string } })
    expect(error).toBeInstanceOf(Error)
    expect(error?.teamRefusal).toEqual({ ok: false, code: 'PA_DENY', detail: 'the walk stopped here' })
    expect(harness.calls).toEqual([])
  })
  it('admit receives the governed envelope (name, recordIndex, familyId, plan, live exec)', async () => {
    const harness = makeHarness()
    let seen: Record<string, unknown> = {}
    const assembly = mount(harness, {
      admit: async (ctx: Record<string, unknown>) => {
        seen = ctx
        return { ok: true }
      },
    })
    const definition = assembly.definitions.find((d) => d.name === 'team_list_members')
    if (definition === undefined) throw new Error('no def')
    await definition.execute(VALID_ARGS.team_list_members, EXEC)
    expect(seen.name).toBe('team_list_members')
    expect(seen.recordIndex).toBe(74)
    expect(seen.familyId).toBe('B-TEAM')
    expect(seen.classified).toMatchObject({ ok: true })
    expect(seen.exec).toBe(EXEC) // LIVE, by reference (L4)
  })
})

// ── (f) the DELEGATED existing chain actually governs (the contract law
//        runs there; the row passes its values through, zero fabrication) ──
describe('a5m2-team-adapters (f) delegated existing-chain governance', () => {
  it('the P0 caller-root binding RUNS behind the row: cross-root caller rejected, ZERO facade entry', async () => {
    const harness = makeHarness()
    harness.setCallerRoot(OTHER_ROOT)
    const assembly = mount(harness)
    const definition = assembly.definitions.find((d) => d.name === 'team_list_members')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute(VALID_ARGS.team_list_members, EXEC) as ToolErrorValue & { details?: Record<string, unknown> }
    expect(value.status).toBe('rejected')
    expect(value.code).toBe('TEAM_TOOL_CALLER_ROOT_MISMATCH')
    expect(value.details).toEqual({ callerRootSessionId: OTHER_ROOT, requestedRootSessionId: ROOT })
    expect(harness.calls.filter((c) => c.startsWith('performAction'))).toEqual([])
    expect(harness.calls).toContain(`resolveCaller:${LEADER_SESSION}`) // live per-call identity (L4)
  })
  it('an unresolvable caller is the lane\'s TEAM_TOOL_CALLER_UNRESOLVED VALUE (never a row invention)', async () => {
    const harness = makeHarness()
    harness.setCallerResolvable(false)
    const assembly = mount(harness)
    const definition = assembly.definitions.find((d) => d.name === 'team_collect')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute(VALID_ARGS.team_collect, EXEC) as ToolErrorValue
    expect(value).toMatchObject({ status: 'rejected', code: 'TEAM_TOOL_CALLER_UNRESOLVED' })
  })
  it('happy path settles as the REAL lane result (executed) through facade doubles', async () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    const definition = assembly.definitions.find((d) => d.name === 'team_list_members')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute(VALID_ARGS.team_list_members, EXEC) as { status: string; rootSessionId: string; requestToken: string }
    expect(value.status).toBe('executed')
    expect(value.rootSessionId).toBe(ROOT)
    expect(value.requestToken).toBe('tok-list-1')
    expect(harness.calls.filter((c) => c.startsWith('performAction'))).toHaveLength(1)
  })
  it('guard-blocked VALUES pass through verbatim (follow-up guarded on the target, zero facade entry)', async () => {
    const harness = makeHarness()
    harness.setGuardBlock(true)
    const assembly = mount(harness)
    const definition = assembly.definitions.find((d) => d.name === 'team_follow_up')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute(VALID_ARGS.team_follow_up, EXEC) as { status: string; reason: string; requestId?: string }
    expect(value.status).toBe('blocked')
    expect(value.reason).toBe('pending-approval')
    expect(value.requestId).toBe('req-control-9')
    expect(harness.calls).toContain('guardOperation:inst-a1')
    expect(harness.calls.filter((c) => c.startsWith('performAction'))).toEqual([])
  })
  it('the Leader-gate is the DELEGATED chain\'s (member caller rejected before guard, zero effects)', async () => {
    const harness = makeHarness()
    harness.setCallerInstance('inst-a1') // a MEMBER caller
    const assembly = mount(harness)
    const definition = assembly.definitions.find((d) => d.name === 'team_archive_member')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute(VALID_ARGS.team_archive_member, EXEC) as ToolErrorValue
    expect(value).toMatchObject({ status: 'rejected', code: 'TEAM_TOOL_ARCHIVE_NOT_LEADER' })
    expect(harness.calls.filter((c) => c.startsWith('guardOperation') || c.startsWith('performAction'))).toEqual([])
  })
  it('an UNEXPECTED error is a THROW passed through — the row mints no error value (L6)', async () => {
    const harness = makeHarness()
    harness.setRuntimeError(new Error('boom-unexpected'))
    const assembly = mount(harness)
    const definition = assembly.definitions.find((d) => d.name === 'team_list_templates')
    if (definition === undefined) throw new Error('no def')
    await expect(definition.execute(VALID_ARGS.team_list_templates, EXEC)).rejects.toThrow(/boom-unexpected/)
  })
  it('a mirrored tool-law miss ANSWERS the lane value through execute (settled, not a throw) with zero facade entry', async () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    const definition = assembly.definitions.find((d) => d.name === 'team_inspect_config')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ rootSessionId: ROOT, requestToken: 't' }, EXEC) as ToolErrorValue
    expect(value).toMatchObject({ status: 'rejected', code: 'TEAM_TOOL_BAD_ARGUMENTS' })
    // admit RAN (it sits before the delegate seat), the delegated chain did NOT:
    expect(harness.calls.filter((c) => !c.startsWith('admit'))).toEqual([])
  })
})

// ── (g) plan memo (L8), (h) drift (L7), (i) drain, (j) registration ──────
describe('a5m2-team-adapters (g) plan memo', () => {
  it('consumed/foreign/stale plans refuse with zero delegate entry; the COPY boundary is pinned honestly', async () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    const row = assembly.rowOf('team_list_members')
    if (row === undefined) throw new Error('no row')
    const first = row.classify(VALID_ARGS.team_list_members)
    const plan = first.plan
    if (plan === undefined) throw new Error('no plan')
    const settled = await row.delegate(plan, { exec: EXEC })
    expect(settled).toMatchObject({ ok: true, settled: 'delegated' })
    const callsAfterFirst = harness.calls.length
    const replay = await row.delegate(plan, { exec: EXEC })
    expect(replay).toMatchObject({ ok: false, code: CODES.ALREADY_DISPATCHED })
    expect(replay.detail).toContain('INTERNAL MEMO')
    expect(harness.calls).toHaveLength(callsAfterFirst) // zero added entry
    // PINNED HONEST BOUNDARY (root ④): copied fields RE-dispatch — the real
    // one-shot edges are the center PA consumedProof + the facade's OWN
    // requestToken idempotency INSIDE the delegated chain.
    const copied = { ...plan }
    const again = await row.delegate(copied, { exec: EXEC })
    expect(again).toMatchObject({ ok: true, settled: 'delegated' })
    expect(harness.calls).toHaveLength(callsAfterFirst + 2) // admit is inside execute, not here: facade + resolveCaller
    const foreign = await row.delegate({ ...plan, rowName: 'team_delegate' }, { exec: EXEC })
    expect(foreign).toMatchObject({ ok: false, code: CODES.NOT_OWN_PLAN })
    const stale = await row.delegate({ ...plan, parametersFingerprint: 'sha256:deadbeef' }, { exec: EXEC })
    expect(stale).toMatchObject({ ok: false, code: CODES.PLAN_STALE })
  })
})
describe('a5m2-team-adapters (h) per-dispatch drift (L7)', () => {
  it('liveNative object drift, delegates-object replacement, and a rebound method all refuse with zero delegate entry', async () => {
    const harness = makeHarness()
    let mode = 'bound'
    const delegates: Record<string, Definition['execute']> = {}
    for (const name of NAMES) {
      const native = harness.byName.get(name)
      if (native !== undefined) delegates[name] = native.execute
    }
    const result = ADAPTER.createTeamAdapterAssembly({
      captured: CAPTURE_FOR(harness),
      liveNative: (name: string) => {
        const native = harness.byName.get(name)
        if (native === undefined) return undefined
        return mode === 'def-drift' ? { ...native } : native
      },
      teamDelegates: delegates,
      liveTeamDelegates: () => {
        if (mode === 'port-drift') return { ...delegates }
        if (mode === 'method-drift') {
          // SAME object identity, a REBOUND method (the live mount mutated it).
          return delegates
        }
        return delegates
      },
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
      admit: async () => ({ ok: true }),
    })
    if (result.ok !== true) throw new Error('mount failed')
    const row = result.rowOf('team_report_progress')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify(VALID_ARGS.team_report_progress).plan) as Plan
    const callsBefore = harness.calls.length
    mode = 'def-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DEFINITION_DRIFT })
    mode = 'port-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PORT_DRIFT })
    mode = 'bound'
    const rebound = delegates.team_report_progress
    const replacement = async () => ({ status: 'executed' })
    Object.defineProperty(delegates, 'team_report_progress', { value: replacement, writable: true, configurable: true, enumerable: true })
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PORT_DRIFT })
    Object.defineProperty(delegates, 'team_report_progress', { value: rebound, writable: true, configurable: true, enumerable: true })
    expect(harness.calls).toHaveLength(callsBefore) // ZERO delegate entry on every drift
  })
})
describe('a5m2-team-adapters (i/j) drain + registration', () => {
  it('drain = new-call prohibition only', async () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    assembly.drain()
    const row = assembly.rowOf('team_list_members')
    if (row === undefined) throw new Error('no row')
    expect(row.classify(VALID_ARGS.team_list_members)).toMatchObject({ ok: false, code: CODES.DRAINING })
    expect(harness.calls).toEqual([])
  })
  it('familyRegistrations: placement-feed keys only; ABSENT/MOVED keys throw (never guess, never skip)', () => {
    const harness = makeHarness()
    const assembly = mount(harness)
    const registrations = assembly.familyRegistrations()
    expect(registrations).toHaveLength(10)
    expect(registrations[0]?.entry).toEqual({ familyId: 'B-TEAM', adapterRevision: 1, providerIdentity: 'b-team' })
    expect(registrations.map((r) => r.definitionIdentity).sort()).toEqual(NAMES.map((n) => `placed-${n}`).sort())
    expect(registrations.find((r) => r.name === 'team_archive_member')?.recordIndex).toBe(86)
    // absent key:
    const moved = mount(harness, { placementFeed: () => undefined })
    expect(() => moved.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_ABSENT}:`))
    // moved key (each read floats):
    let tick = 0
    const floating = mount(harness, { placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}-${(tick += 1)}` }) })
    floating.familyRegistrations()
    expect(() => floating.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_MOVED}:`))
  })
})
