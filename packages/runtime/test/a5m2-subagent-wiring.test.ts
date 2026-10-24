/**
 * A5M2-B-SUBAGENT-WIRING — the REAL PA wiring spec for the control trio
 * (census records 44 interrupt_agent / 45 list_agents / 46 send_message;
 * root 20:02 card: 真实PA接线, 复用现 open→edge→consumedProof→同冻结plan原生
 * →dispose, 不造admit ok或平行ledger).
 *
 * The adapter rows are spec'd elsewhere (a5m2-subagent-adapters.test.ts owns
 * the row laws); THIS spec owns the WIRING facts: the admit seat is occupied
 * by the real walk (a hand-supplied admit is refused — the fabricated
 * admit-ok), the walk input is the frozen plane shape with the plan's own
 * parametersFingerprint (open→edge pairing), the closed tool-invoke-only
 * effect set, the consumedProof DEMAND (allow-without-proof refuses with
 * zero service entry), deny bytes ride verbatim, cancellation is not
 * permission, a thrown/torn-down leg drops its answer and closes the plan
 * fact, and mount/dispose follows the jobs-row law.
 *
 * DOUBLES (disclosed as doubles, C1 real-surface measurement, no Host
 * session): the ctx.subagents service, the ctx.agents registry, the
 * placement feed, and the PA FUNNEL — the funnel double is shaped by the
 * plane's measured answer law (team-tool-plane.mjs :1449-1713: kind
 * allow/deny, cancelled, consumedProof ONLY on the consume-ok branch,
 * closePlan on the face). The captured definitions and the adjacency marker
 * are the REAL published Host faces @639ed01539 (the trio spec's capture
 * idiom).
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { findTestRepoRoot } from '../../../tests/paths.mjs'

// ── module under spec (hand-cast, house idiom) ─────────────────────────────
type Definition = {
  [face: string]: unknown
  name: string
  description: string
  output: { schema: unknown; render: unknown }
  parameters?: Record<string, unknown>
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
type PaAnswer = { kind?: string; cancelled?: boolean; code?: string; detail?: string; consumedProof?: unknown }
type PaWalk = {
  realmId: string
  callId: string
  parametersFingerprint: string
  requestedEffects: { effects: { kind: string; toolName?: string; resource: unknown }[]; fingerprint: string }
  toolName: string
  family: { familyId: string; adapterRevision: number; providerIdentity: string; targetManifest: Record<string, unknown> }
  signal?: AbortSignal
}
type PaDouble = {
  (walk: PaWalk): Promise<PaAnswer>
  walks: PaWalk[]
  closePlan: (callId: string) => void
  closePlanCalls: string[]
  setAnswer: (answer: PaAnswer | ((walk: PaWalk) => PaAnswer | Promise<PaAnswer>)) => void
  setFault: (error: Error | undefined) => void
  setGate: (gate: ((walk: PaWalk) => Promise<void>) | undefined) => void
}
type WiringValue = {
  ok: true
  familyId: string
  wiringRevision: number
  adapterRevision: number
  providerId: string
  subset: string
  definitions: Definition[]
  placementNames: string[]
  rowOf: (name: string) => { name: string; classify: (args: unknown) => { ok: boolean; plan?: { target?: unknown; args?: unknown } } } | undefined
  familyRegistrations: () => { name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }[]
  inFlight: () => { dispatches: number; refuses: number }
  mount: (agentCtx: { tools: { register: (definition: Definition) => unknown } }) => { ok: boolean; code?: string; name?: string; dispose?: () => unknown }
  dispose: () => unknown
}
type WiringResult = WiringValue | { ok: false; code: string; message: string; name?: string }
type WiringModule = {
  A5_B_SUBAGENT_WIRING_REVISION: number
  A5_B_SUBAGENT_WIRING_CODES: Record<string, string>
  createBSubagentControlWiring: (input?: Record<string, unknown>) => WiringResult
}
type AdapterModule = {
  A5_B_SUBAGENT_FAMILY_ID: string
  A5_B_SUBAGENT_ADAPTER_REVISION: number
  A5_B_SUBAGENT_RECORD_SPECS: Record<string, { recordIndex: number; operation: string }>
  A5_B_SUBAGENT_TOOL_NAMES: string[]
  A5_B_SUBAGENT_EFFECT_LABELS: Record<string, string>
  A5_B_SUBAGENT_CODES: Record<string, string>
  A5_B_SUBAGENT_NAMED_GAPS: Record<string, string>
}

const WIRING = (await import(new URL('../src/plugin/live/governed-families/subagent-wiring.mjs', import.meta.url).href)) as WiringModule
const WCODES = WIRING.A5_B_SUBAGENT_WIRING_CODES
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/subagent-adapters.mjs', import.meta.url).href)) as AdapterModule
const NAMES = ADAPTER.A5_B_SUBAGENT_TOOL_NAMES
const ACODES = ADAPTER.A5_B_SUBAGENT_CODES

// ── the REAL published Host faces from the pristine baseline (fail closed) ─
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_PKG = (...rel: string[]): string => join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', ...rel)
const TOOLS_LIB = HOST_PKG('core', 'tools', 'lib', 'index.js')
const SYS_PROMPT_LIB = HOST_PKG('core', 'system-prompt', 'lib', 'index.js')
const CONTROL_LIB = HOST_PKG('subagent', 'tool-subagent-control', 'lib', 'index.js')
const LIST_LIB = HOST_PKG('subagent', 'tool-subagent-control', 'lib', 'types', 'list-agents.js')
const INTERNAL_LIB = HOST_PKG('subagent', 'subagent', 'lib', 'types', 'internal.js')
for (const lib of [TOOLS_LIB, SYS_PROMPT_LIB, CONTROL_LIB, LIST_LIB, INTERNAL_LIB]) {
  if (!existsSync(lib)) throw new Error(`pristine lib absent (${lib}); failing closed`)
}
const CORDIS_PATHS = [TOOLS_LIB, SYS_PROMPT_LIB, CONTROL_LIB, LIST_LIB, INTERNAL_LIB].map((lib) => createRequire(pathToFileURL(lib)).resolve('@deepseek-ai/cordis'))
if (new Set(CORDIS_PATHS).size !== 1) {
  throw new Error(`host module set splits across cordis copies (${CORDIS_PATHS.join(' != ')}); failing closed`)
}
const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as { default: unknown }
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_PATHS[0] as string).href)) as unknown as { Context: new () => { plugin: (p: unknown, c?: Record<string, unknown>) => Promise<void>; tools: { get: (name: string) => Record<string, unknown> | undefined } } }
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
const HOST_CONTROL = (await import(pathToFileURL(CONTROL_LIB).href)) as unknown as { apply: (ctx: unknown) => void }
const HOST_LIST = (await import(pathToFileURL(LIST_LIB).href)) as unknown as { apply: (ctx: unknown) => void }
const HOST_INTERNAL = (await import(pathToFileURL(INTERNAL_LIB).href)) as unknown as {
  isAdjacentAgentSendMessageTool: (definition: unknown) => boolean
  markAdjacentAgentSendMessageTool: (definition: unknown) => unknown
}

const captureRealNatives = async (): Promise<Record<string, Definition>> => {
  const ctx = new HOST_CORDIS.Context()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
  HOST_CONTROL.apply(ctx)
  HOST_LIST.apply(ctx)
  const defs: Record<string, Definition> = {}
  for (const name of NAMES) {
    const def = ctx.tools.get(name)
    if (def === undefined) throw new Error(`the REAL host registered no tool '${name}' — baseline drift; failing closed`)
    defs[name] = def as unknown as Definition
  }
  return defs
}
const REAL_NATIVES = await captureRealNatives()

// ── lane doubles: service port, registry, placement feed, PA funnel ────────
const AGENT_REF: Record<string, unknown> = { id: 'agent-parent-live-1', session: { id: 'session-parent-1', header: {} } }
const CONTROLLER = new AbortController()
const SIGNAL = CONTROLLER.signal
const REALM = 'realm-wire-1'
const PROVIDER = 'prov-wire'

type Fixture = {
  calls: string[]
  service: Record<string, (...args: never[]) => unknown>
  lastSend: unknown[]
}
function makeFixture(): Fixture {
  const calls: string[] = []
  const fixture: Fixture = {
    calls,
    lastSend: [],
    service: {
      sendMessage: (async (...args: unknown[]) => {
        calls.push('sendMessage')
        fixture.lastSend = args
        return 'msg-ack-7'
      }) as (...args: never[]) => unknown,
      interrupt: ((...args: unknown[]) => {
        calls.push('interrupt')
        void args
        // Fire-and-forget like the published face: the never-settling return
        // kills any row that would (wrongly) await it.
        return new Promise<never>(() => {})
      }) as (...args: never[]) => unknown,
      listChildren: (async () => {
        calls.push('listChildren')
        return [{ id: 'agent-child-1', label: 'worker one', mode: 'continuable' }]
      }) as (...args: never[]) => unknown,
      listDescendants: (async () => {
        calls.push('listDescendants')
        return []
      }) as (...args: never[]) => unknown,
    },
  }
  return fixture
}

const PROOF = Object.freeze({ spentGrantId: 'grant-wire-once', lease: 'witness' })

function makePa(defaultAnswer?: PaAnswer): PaDouble {
  let answer: PaAnswer | ((walk: PaWalk) => PaAnswer | Promise<PaAnswer>) = defaultAnswer ?? { kind: 'allow', consumedProof: PROOF }
  let fault: Error | undefined
  let gate: ((walk: PaWalk) => Promise<void>) | undefined
  const pa = (async (walk: PaWalk): Promise<PaAnswer> => {
    pa.walks.push(walk)
    if (gate !== undefined) await gate(walk)
    if (fault !== undefined) throw fault
    return typeof answer === 'function' ? await answer(walk) : answer
  }) as PaDouble
  pa.walks = []
  pa.closePlanCalls = []
  pa.closePlan = (callId: string) => {
    pa.closePlanCalls.push(callId)
  }
  pa.setAnswer = (next) => {
    answer = next
  }
  pa.setFault = (error) => {
    fault = error
  }
  pa.setGate = (next) => {
    gate = next
  }
  return pa
}

const registryDouble = { get: () => undefined }

const DEFAULT_SERVICE = {
  sendMessage: (async () => 'msg-ack-7') as (...args: never[]) => unknown,
  interrupt: (() => undefined) as (...args: never[]) => unknown,
  listChildren: (async () => []) as (...args: never[]) => unknown,
  listDescendants: (async () => []) as (...args: never[]) => unknown,
}

// feed override hook (realmId absence legs)
let readFeedOverride: ((name: string) => Record<string, unknown> | undefined) | undefined
const setFeedOverride = (fn: ((name: string) => Record<string, unknown> | undefined) | undefined): void => {
  readFeedOverride = fn
}

function mountWiring(
  pa: PaDouble,
  overrides: Record<string, unknown> = {},
): WiringResult {
  return WIRING.createBSubagentControlWiring({
    providerId: PROVIDER,
    captured: Object.fromEntries(NAMES.map((name) => [name, { native: REAL_NATIVES[name], definitionIdentity: `cap:${name}` }])),
    liveNative: (name: string) => REAL_NATIVES[name],
    subagentService: DEFAULT_SERVICE,
    liveSubagentService: () => DEFAULT_SERVICE,
    agentsRegistry: registryDouble,
    liveAgentsRegistry: () => registryDouble,
    ...overrides,
    isAdjacentAgentSendMessageTool: HOST_INTERNAL.isAdjacentAgentSendMessageTool,
    markAdjacentAgentSendMessageTool: HOST_INTERNAL.markAdjacentAgentSendMessageTool,
    placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}`, realmId: REALM, ...(readFeedOverride?.(name) ?? {}) }),
    pa,
  })
}

const execFor = (callId: string, signal: AbortSignal = SIGNAL): Record<string, unknown> => ({ agent: AGENT_REF, signal, callId })
const okValue = (result: WiringResult): WiringValue => {
  if (result.ok !== true) throw new Error(`wiring mount refused: ${result.code} — ${result.message}`)
  return result
}
const asError = (error: unknown): Error & { code?: string; subagentRefusal?: { code?: string; detail?: string } } => error as Error & { code?: string; subagentRefusal?: { code?: string; detail?: string } }

describe('a5m2-subagent-wiring (a) factory gates: the seat is OWNED, PA is REQUIRED', () => {
  it('a hand-supplied admit is refused (the fabricated admit-ok this card forbids); a missing/non-function pa is refused', () => {
    const pa = makePa()
    expect(WIRING.createBSubagentControlWiring(null as unknown as Record<string, unknown>).ok).toBe(false)
    const withAdmit = WIRING.createBSubagentControlWiring({ pa, admit: async () => ({ ok: true }) })
    expect(withAdmit.ok === true ? '' : withAdmit.code).toBe(WCODES.ADMISSION_SEAT_OWNED)
    const admitKeyEvenUndefined = WIRING.createBSubagentControlWiring({ pa, admit: undefined })
    expect(admitKeyEvenUndefined.ok === true ? '' : admitKeyEvenUndefined.code).toBe(WCODES.ADMISSION_SEAT_OWNED)
    const noPa = WIRING.createBSubagentControlWiring({ placementFeed: () => ({ definitionIdentity: 'k', realmId: REALM }) })
    expect(noPa.ok === true ? '' : noPa.code).toBe(WCODES.PA_ABSENT)
    const badPa = WIRING.createBSubagentControlWiring({ placementFeed: () => ({ definitionIdentity: 'k', realmId: REALM }), pa: 'not-a-funnel' })
    expect(badPa.ok === true ? '' : badPa.code).toBe(WCODES.PA_ABSENT)
  })
  it('unknown inputs are refused (spawn-side/workflow arms are other owners faces); the ADAPTER OWN refusal passes through verbatim', () => {
    const pa = makePa()
    const unknown = WIRING.createBSubagentControlWiring({ pa, workflowTools: {} })
    expect(unknown.ok === true ? '' : unknown.code).toBe(WCODES.INPUT_INVALID)
    expect(unknown.ok === true ? '' : unknown.message).toContain('other owners')
    // no liveNative at all → the ADAPTER's own refusal code rides through
    const broken = WIRING.createBSubagentControlWiring({ pa, placementFeed: () => ({ definitionIdentity: 'k', realmId: REALM }) })
    expect(broken.ok).toBe(false)
    if (broken.ok === false) {
      expect(broken.code, 'the adapter module owns capture refusals — the wiring re-codes nothing').not.toContain('_WIRE_')
    }
  })
})

describe('a5m2-subagent-wiring (b) verbatim reuse of the frozen adapter', () => {
  it('placed defs travel COMPLETE (only execute replaced), send_message carries the REAL adjacency mark, registrations ride the assembly face', () => {
    const wiring = okValue(mountWiring(makePa()))
    expect(wiring.familyId).toBe('B-SUBAGENT')
    expect(wiring.wiringRevision, 'visible bumps: 1→2 root-21:20 union encoding; 2→3 the 9d968 handoff canonical-law switch (frozen adapter revision UNTOUCHED); since root 22:02 this rev is the ONE family-claim revision the real path stamps (PA block + registration face)').toBe(3)
    // the wiring SURFACE reports the frozen adapter's own capture revision
    // as its fact (1) — the CLAIM seats (block/registration) carry the live
    // family-claim revision above; two honest facts, never conflated.
    expect(wiring.adapterRevision).toBe(ADAPTER.A5_B_SUBAGENT_ADAPTER_REVISION)
    expect(wiring.providerId).toBe(PROVIDER)
    expect(wiring.placementNames).toEqual([...NAMES].sort())
    for (const definition of wiring.definitions) {
      const native = REAL_NATIVES[definition.name]
      if (native === undefined) throw new Error(`no real native for ${definition.name}`)
      expect(definition.description).toBe(native.description)
      expect(definition.output).toBe(native.output) // BY REFERENCE — presentation faces verbatim
      expect(definition.parameters).toBe(native.parameters)
      expect(definition.execute).not.toBe(native.execute) // ONLY execute replaced
    }
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no send_message def')
    expect(HOST_INTERNAL.isAdjacentAgentSendMessageTool(send), 'the re-applied mark survives the wiring').toBe(true)
    const regs = wiring.familyRegistrations()
    expect(regs.map((r) => [r.name, r.recordIndex, r.definitionIdentity]).sort()).toEqual([
      ['interrupt_agent', 44, 'placed-interrupt_agent'],
      ['list_agents', 45, 'placed-list_agents'],
      ['send_message', 46, 'placed-send_message'],
    ])
    for (const reg of regs) {
      // ROOT 22:02 revision consistency: the registration CLAIM carries the
      // ONE revision the real path mints with (the wiring's live family-claim
      // rev), NOT the frozen adapter's capture revision — and it MUST equal
      // the PA family block's stamp (measured on the walk leg), so an
      // earlier-rev claim on an identity REFUSES at the registry's
      // one-identity law instead of silently translating an old row.
      expect(reg.entry).toEqual({ familyId: 'B-SUBAGENT', adapterRevision: WIRING.A5_B_SUBAGENT_WIRING_REVISION, providerIdentity: PROVIDER })
    }
  })
})

describe('a5m2-subagent-wiring (c) the WALK is the frozen plane shape with the plan pairing value', () => {
  it('open carries realmId/live callId/plan parametersFingerprint/tool-invoke-only effects/family block/live signal; two equal calls share the VALUE but walk twice (no memo, no reuse)', async () => {
    const fixture = makeFixture()
    const pa = makePa()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no def')
    await expect(send.execute({ agent_id: 'agent-child-1', message: 'down' }, execFor('call-w1'))).resolves.toEqual({ messageId: 'msg-ack-7' })
    expect(pa.walks).toHaveLength(1)
    const walk = pa.walks[0]
    if (walk === undefined) throw new Error('no walk captured')
    expect(walk.realmId).toBe(REALM)
    expect(walk.callId).toBe('call-w1')
    expect(walk.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    // FIX 1 (root 20:39): the walk rides parseRequestedEffectSet's OWN
    // canonical value (the plane's requestedEffects.effects shape) — never
    // a bare array:
    expect(walk.requestedEffects.effects).toEqual([{ kind: 'tool-invoke', resource: null, toolName: 'send_message' }])
    expect(walk.requestedEffects.fingerprint, 'the domain parser minted the canonical digest').toMatch(/^[0-9a-f]{64}$|^sha256:/)
    expect(walk.toolName).toBe('send_message')
    expect(walk.family.familyId).toBe('B-SUBAGENT')
    // ROOT 22:02 revision consistency: the PA family block stamps the SAME
    // live family-claim revision the registration face carries (measured in
    // leg (b)) — one number for plan/edge and registration, so any
    // earlier-rev approval/row REFUSES at the registry's one-identity law
    // and is never silently translated. The frozen adapter's own capture
    // revision (1) stays its reported fact on the wiring surface.
    expect(walk.family.adapterRevision, 'block stamp === registration claim stamp (root 22:02 consistency law)').toBe(WIRING.A5_B_SUBAGENT_WIRING_REVISION)
    expect(walk.family.providerIdentity).toBe(PROVIDER)
    // UNION ENCODING (root 21:20 joint card, control-mint side): the ONE
    // operation-discriminated entry's CONTROL shape — common required strings
    // + control additions; FULL canonical JSON, never digests; the complete
    // plan.target losslessly reconstructible from the manifest leaves — a
    // label never stands in for the target.
    const manifest = walk.family.targetManifest
    const sendSpec = ADAPTER.A5_B_SUBAGENT_RECORD_SPECS.send_message
    if (sendSpec === undefined) throw new Error('no send spec')
    expect(manifest.operation).toBe(sendSpec.operation)
    expect(manifest.action, 'action binds to the record\'s original operation').toBe(sendSpec.operation)
    expect(manifest.recordIndex).toBe(46)
    expect(manifest.effectDelta).toBe(ADAPTER.A5_B_SUBAGENT_EFFECT_LABELS.send_message)
    // The single census effect fact (DISCLOSED): the seam holds ONE effect
    // truth per control record — plan.target.effect and the row's
    // effectDelta are the SAME census string, so `effect` and `effectDelta`
    // carry it identically; no second truth is invented here.
    expect(manifest.effect, 'effect = the plan target own census leaf').toBe(manifest.effectDelta)
    expect(manifest.addressClaim, 'the classified target carries the real agent_id').toBe('agent-child-1')
    expect(typeof manifest.contract).toBe('string')
    expect(typeof manifest.revision).toBe('string')
    expect(typeof manifest.depth).toBe('string')
    expect(typeof manifest.caller).toBe('string')
    expect(typeof manifest.budget).toBe('string')
    expect(typeof manifest.addressRelation).toBe('string')
    expect(typeof manifest.addressAdjudication).toBe('string')
    // namedGapsCanonical: FULL canonical JSON that round-trips the frozen gap
    // facts whole (root 21:20: 后两完整规范JSON非hash摘要).
    expect(JSON.parse(String(manifest.namedGapsCanonical)), 'namedGaps round-trip, whole').toEqual(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS)
    // LOSSLESS target reconstruction from the manifest leaves, and the FULL
    // classified args riding as canonical JSON (the real agent_id AND the
    // message content):
    const sendRow = wiring.rowOf('send_message')
    if (sendRow === undefined) throw new Error('no send row')
    const expectedPlan = sendRow.classify({ agent_id: 'agent-child-1', message: 'down' })
    if (expectedPlan.ok !== true || expectedPlan.plan === undefined) throw new Error('NO-PLAN')
    const reconstructedTarget = {
      contract: manifest.contract,
      caller: manifest.caller,
      address: { claim: manifest.addressClaim, relation: manifest.addressRelation, adjudication: manifest.addressAdjudication },
      action: manifest.action,
      revision: manifest.revision,
      effect: manifest.effect,
      depth: manifest.depth,
      budget: manifest.budget,
    }
    expect(reconstructedTarget, 'the complete original plan.target rebuilds losslessly').toEqual(expectedPlan.plan.target)
    expect(JSON.parse(String(manifest.argsCanonical))).toEqual({ agent_id: 'agent-child-1', message: 'down' })
    // FIX 4 (root 20:39): the payload is frozen; the CALLER'S AbortSignal
    // rides by reference and is NEVER frozen (deep-freezing it would break
    // abort during the PA wait):
    expect(Object.isFrozen(walk.family), 'own payload frozen').toBe(true)
    expect(Object.isFrozen(walk.signal), 'caller signal untouched').toBe(false)
    expect(walk.signal, 'the live signal rides BY REFERENCE').toBe(SIGNAL)
    expect(fixture.calls).toEqual(['sendMessage'])
    // second identical call: fresh walk, SAME fingerprint VALUE (open→edge
    // pairing is over the value; the wiring mints no second identity):
    await expect(send.execute({ agent_id: 'agent-child-1', message: 'down' }, execFor('call-w2'))).resolves.toEqual({ messageId: 'msg-ack-7' })
    expect(pa.walks).toHaveLength(2)
    const second = pa.walks[1]
    if (second === undefined) throw new Error('no second walk')
    expect(second.parametersFingerprint).toBe(walk.parametersFingerprint)
    expect(second.callId).toBe('call-w2')
  })
  it('the trio effect derivation is closed and per-record: exactly one tool-invoke effect naming the invoked tool, for every row', async () => {
    const fixture = makeFixture()
    const pa = makePa()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const byName = Object.fromEntries(wiring.definitions.map((d) => [d.name, d]))
    const interruptDef = byName['interrupt_agent']
    const listDef = byName['list_agents']
    if (interruptDef === undefined || listDef === undefined) throw new Error('trio incomplete')
    await interruptDef.execute({ agent_id: 'agent-child-1' }, execFor('call-wi'))
    await listDef.execute({}, execFor('call-wl'))
    expect(pa.walks.map((w) => [w.toolName, w.requestedEffects.effects])).toEqual([
      ['interrupt_agent', [{ kind: 'tool-invoke', resource: null, toolName: 'interrupt_agent' }]],
      ['list_agents', [{ kind: 'tool-invoke', resource: null, toolName: 'list_agents' }]],
    ])
    // and the rows SERVED through the consumed edge (the proof-allowed path):
    expect(fixture.calls).toEqual(['interrupt', 'listChildren'])
  })
  it('argsCanonical is FULL canonical JSON, not a digest (root 21:20): full message text, unknown-but-legal keys, array order, nulls and empty strings all survive; addressClaim is the NULLABLE leaf', async () => {
    const fixture = makeFixture()
    const pa = makePa()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    const list = wiring.definitions.find((d) => d.name === 'list_agents')
    if (send === undefined || list === undefined) throw new Error('trio incomplete')
    const rich = {
      agent_id: 'agent-child-1',
      message: 'multi-line FULL text — 原文全文\nwith "quotes", emoji ✓, tail: ',
      nilLeaf: null,
      emptyString: '',
      orderMatters: [3, 1, 2, 3],
      unknownButLegal: { nested: ['a', null, ''] },
    }
    await send.execute(rich, execFor('call-rt1'))
    // list_agents carries NO agent_id: the nullable addressClaim law answers
    // the plan fact NULL — never a fabricated empty string, never absent-key
    // drift:
    await list.execute({}, execFor('call-rt2'))
    // ROOT 21:37 case: list_agents({agent_id: 7}) — an address-SHAPED name
    // under a NUMBER value is a legal UNKNOWN key for THIS operation (open
    // object root, Host law). It is NOT an address designation: the manifest
    // answers the operation's true no-address NULL, while the key rides
    // argsCanonical COMPLETE and reaches the native law untouched — nothing
    // deleted, no new kind, no nullable→any widening at the table:
    await list.execute({ agent_id: 7 }, execFor('call-rt3'))
    const m1 = pa.walks[0]?.family.targetManifest
    const m2 = pa.walks[1]?.family.targetManifest
    const m3 = pa.walks[2]?.family.targetManifest
    if (m1 === undefined || m2 === undefined || m3 === undefined) throw new Error('no walks')
    expect(JSON.parse(String(m1.argsCanonical)), 'the FULL classified args, value-for-value').toEqual(rich)
    expect(String(m1.argsCanonical), 'the full message text rides — no summary, no digest').toContain('原文全文')
    expect(String(m1.argsCanonical), 'unknown-but-legal keys ride').toContain('unknownButLegal')
    const back = JSON.parse(String(m1.argsCanonical)) as { orderMatters: unknown[]; nilLeaf: unknown; emptyString: unknown }
    expect(back.orderMatters, 'array order preserved').toEqual([3, 1, 2, 3])
    expect(back.nilLeaf, 'null survives').toBeNull()
    expect(back.emptyString, 'empty string survives and is NOT dropped or coerced').toBe('')
    // THE LEAF LAW (9d968 mint-owner handoff @4e96decc6): argsCanonical is
    // the mint's OWN copy of the controls-module :234-238 sorted-key
    // JSON.stringify — recomputed here over a fresh classify of the SAME
    // args; the leaf is that exact byte string (content, not spelling):
    const rtRow = wiring.rowOf('send_message')
    if (rtRow === undefined) throw new Error('no send row')
    const rtPlan = rtRow.classify(rich)
    if (rtPlan.ok !== true || rtPlan.plan === undefined) throw new Error('classify refused')
    const sortedKeyLaw = (v: unknown): string => JSON.stringify(v, (_k, x) => (x !== null && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x as Record<string, unknown>).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
      : x))
    expect(String(m1.argsCanonical), 'the leaf IS the :234-238 law over the classified args').toBe(sortedKeyLaw(rtPlan.plan.args))
    expect(m1.addressClaim).toBe('agent-child-1')
    expect(m2.addressClaim, 'nullableString law: no claim is NULL (the plan fact)').toBeNull()
    expect(m2.operation).toBe('subagent-list')
    expect(m2.action).toBe('subagent-list')
    expect(m2.recordIndex).toBe(45)
    expect(m2.effectDelta).toBe(ADAPTER.A5_B_SUBAGENT_EFFECT_LABELS.list_agents)
    expect(m3.addressClaim, 'list NEVER claims an address: the foreign numeric agent_id is not interpreted (root 21:37)').toBeNull()
    expect(String(m3.argsCanonical), 'the unknown numeric key rides COMPLETE — nothing deleted').toBe('{"agent_id":7}')
    expect(m3.operation).toBe('subagent-list')
  })
})

describe('a5m2-subagent-wiring (d/e/f) the answer laws', () => {
  const served = async (pa: PaDouble, callId = 'call-x'): Promise<unknown> => {
    const fixture = makeFixture()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no def')
    const out = await send.execute({ agent_id: 'agent-child-1', message: 'hi' }, execFor(callId)).then((v) => ({ ok: true, v }), (e: unknown) => ({ ok: false, error: asError(e) }))
    return { out, fixture }
  }
  it('allow WITHOUT consumedProof REFUSES (self-attestation seat closed) with ZERO service entry; the refused call may walk again — the wiring holds no spent-token state (no parallel ledger)', async () => {
    const pa = makePa({ kind: 'allow' }) // the plane's proof-less allow shape (:1653)
    const first = await served(pa, 'call-p1') as { out: { ok: boolean; error?: Error & { subagentRefusal?: { code?: string } } }; fixture: Fixture }
    expect(first.out.ok).toBe(false)
    expect(first.out.error?.subagentRefusal?.code).toBe(WCODES.PROOF_ABSENT)
    expect(first.fixture.calls, 'zero port entry').toEqual([])
    expect(pa.walks).toHaveLength(1)
    expect(pa.closePlanCalls, 'a refused admit is not a never-completed PA leg — the funnel owns its own plan fact').toEqual([])
    // prove nothing was burned: flip the answer, a fresh call walks and serves
    pa.setAnswer({ kind: 'allow', consumedProof: PROOF })
    const second = await served(pa, 'call-p2') as { out: { ok: boolean; v?: unknown }; fixture: Fixture }
    expect(second.out.ok).toBe(true)
    expect((second.out as { v?: unknown }).v).toEqual({ messageId: 'msg-ack-7' })
    expect(pa.walks).toHaveLength(2) // a SECOND walk happened — no self-minted blocklist
  })
  it('a DENY rides the funnel OWN bytes EXACTLY (root 20:39: the detail passes through untouched, no appended gloss) with zero service entry', async () => {
    const pa = makePa({ kind: 'deny', code: 'GRANT_CONSUMPTION_REFUSED', detail: 'edge said no' })
    const res = await served(pa) as { out: { ok: boolean; error?: Error & { code?: string; subagentRefusal?: { code?: string; detail?: string } } }; fixture: Fixture }
    expect(res.out.ok).toBe(false)
    expect(res.out.error?.code, 'the funnel code rides, NOT a P_B_SUBAGENT_WIRE_* re-code').toBe('GRANT_CONSUMPTION_REFUSED')
    expect(res.out.error?.subagentRefusal?.code).toBe('GRANT_CONSUMPTION_REFUSED')
    expect(res.out.error?.subagentRefusal?.detail, 'the funnel detail BYTES, not bytes-plus-commentary').toBe('edge said no')
    expect(res.out.error?.message).toContain('edge said no')
    expect(res.fixture.calls).toEqual([])
  })
  it('cancellation is NOT permission: pre-aborted signal walks zero times; a cancelled answer refuses even with proof present', async () => {
    const pa = makePa({ kind: 'allow', cancelled: true, consumedProof: PROOF })
    const res = await served(pa) as { out: { ok: boolean; error?: Error & { subagentRefusal?: { code?: string } } }; fixture: Fixture }
    expect(res.out.error?.subagentRefusal?.code).toBe(WCODES.CANCELLED)
    expect(res.fixture.calls).toEqual([])
    const aborted = new AbortController()
    aborted.abort()
    const pa2 = makePa()
    const fixture = makeFixture()
    const wiring = okValue(mountWiring(pa2, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no def')
    const error = asError(await send.execute({ agent_id: 'agent-child-1', message: 'hi' }, execFor('call-abort', aborted.signal)).then(() => null, (e: unknown) => asError(e)))
    expect(error?.subagentRefusal?.code).toBe(WCODES.CANCELLED)
    expect(pa2.walks, 'an already-aborted call never opens the walk').toHaveLength(0)
    expect(fixture.calls).toEqual([])
  })
  it('PA-pending → abort (root 20:39 FIX 4 local leg): the caller signal stays LIVE during the wait — abort lands, the leg refuses CANCELLED with zero service entry', async () => {
    const pa = makePa()
    const fixture = makeFixture()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const controller = new AbortController()
    let release: () => void = () => {}
    pa.setGate(() => new Promise<void>((resolve) => {
      release = resolve
    }))
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no def')
    const inflight = send.execute({ agent_id: 'agent-child-1', message: 'hi' }, { agent: AGENT_REF, signal: controller.signal, callId: 'call-wa' }).then(() => null, (e: unknown) => asError(e))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(pa.walks, 'the walk is open and WAITING').toHaveLength(1)
    controller.abort() // the signal rode UNFROZEN — the abort must actually land
    expect(controller.signal.aborted, 'the caller signal was never frozen by the walk (a frozen signal cannot abort)').toBe(true)
    release()
    const error = await inflight
    expect(error?.subagentRefusal?.code).toBe(WCODES.CANCELLED)
    expect(pa.closePlanCalls, 'the funnel completed its own walk; its finally owns the plan fact').toEqual([])
    expect(fixture.calls, 'the aborted leg enters nothing').toEqual([])
  })
  it('a THROWN walk is never an authorization: PA_FAULT refusal + closePlan ends the plan fact, zero service entry', async () => {
    const pa = makePa()
    pa.setFault(new Error('kernel exploded'))
    const res = await served(pa, 'call-wf') as { out: { ok: boolean; error?: Error & { subagentRefusal?: { code?: string } } }; fixture: Fixture }
    expect(res.out.error?.subagentRefusal?.code).toBe(WCODES.PA_FAULT)
    expect(pa.closePlanCalls).toEqual(['call-wf'])
    expect(res.fixture.calls).toEqual([])
  })
  it('disposed WHILE the walk is in flight: the answer is DROPPED, the plan fact closed, zero service entry (post-await world re-check)', async () => {
    const pa = makePa()
    const fixture = makeFixture()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    let release: () => void = () => {}
    pa.setGate(() => new Promise<void>((resolve) => {
      release = resolve
    }))
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no def')
    const inflight = send.execute({ agent_id: 'agent-child-1', message: 'hi' }, execFor('call-wd')).then(() => null, (e: unknown) => asError(e))
    await new Promise((resolve) => setTimeout(resolve, 0))
    wiring.dispose()
    release()
    const error = await inflight
    expect(error?.subagentRefusal?.code).toBe(WCODES.DISPOSED)
    expect(pa.closePlanCalls).toEqual(['call-wd'])
    expect(fixture.calls, 'the answer was dropped — nothing entered the service').toEqual([])
  })
})

describe('a5m2-subagent-wiring (g) mount/dispose: the jobs-row placement law', () => {
  it('mount registers EVERY placed def (identity === wiring.definitions); dispose drains FIRST, runs disposers reversed exactly once, and is idempotent; later calls refuse with the ADAPTER own DRAINING bytes', async () => {
    const pa = makePa()
    const fixture = makeFixture()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const order: string[] = []
    const agentCtx = {
      tools: {
        register: (definition: Definition) => {
          order.push(`register:${definition.name}`)
          return () => order.push(`dispose:${definition.name}`)
        },
      },
    }
    const mounted = wiring.mount(agentCtx)
    expect(mounted.ok).toBe(true)
    expect(order).toEqual(['register:interrupt_agent', 'register:list_agents', 'register:send_message'].map((s) => s))
    wiring.dispose()
    expect(order.slice(3)).toEqual(['dispose:send_message', 'dispose:list_agents', 'dispose:interrupt_agent'])
    wiring.dispose()
    expect(order).toHaveLength(6) // idempotent: nothing re-runs
    expect(pa.closePlanCalls).toEqual([]) // drain is not a dropped leg
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no def')
    const error = asError(await send.execute({ agent_id: 'agent-child-1', message: 'late' }, execFor('call-late')).then(() => null, (e: unknown) => asError(e)))
    expect(error?.subagentRefusal?.code, 'drain ran FIRST: the late call answers the ADAPTER own DRAINING bytes').toBe(ACODES.DRAINING)
    expect(pa.walks, 'disposed wiring opens ZERO walks').toHaveLength(0)
    expect(fixture.calls).toEqual([])
  })
  it('a register failure rolls back what it already placed (reversed, best-effort) and answers the typed placement conflict', () => {
    const wiring = okValue(mountWiring(makePa()))
    const rolled: string[] = []
    const agentCtx = {
      tools: {
        register: (definition: Definition) => {
          if (definition.name === 'list_agents') throw new Error('name already taken')
          return () => rolled.push(definition.name)
        },
      },
    }
    const mounted = wiring.mount(agentCtx)
    expect(mounted.ok).toBe(false)
    expect(mounted.code).toBe(WCODES.PLACEMENT_CONFLICT)
    expect(mounted.name).toBe('list_agents')
    expect(rolled).toEqual(['interrupt_agent'])
  })
  it('a SECOND mount is REFUSED outright (root 20:39 FIX 3): the first mount stays the ONLY registration — no re-register, no orphaned disposers', () => {
    const wiring = okValue(mountWiring(makePa()))
    const order: string[] = []
    const agentCtx = {
      tools: {
        register: (definition: Definition) => {
          order.push(`register:${definition.name}`)
          return () => order.push(`dispose:${definition.name}`)
        },
      },
    }
    expect(wiring.mount(agentCtx).ok).toBe(true)
    const twice = wiring.mount(agentCtx)
    expect(twice.ok).toBe(false)
    expect(twice.code).toBe(WCODES.MOUNT_ALREADY_PLACED)
    expect(order.filter((o) => o.startsWith('register:')), 'ZERO re-registration by the refused mount').toHaveLength(3)
    wiring.dispose()
    expect(order.filter((o) => o.startsWith('dispose:')), 'the FIRST mount\'s disposers ran, exactly once').toHaveLength(3)
  })
})

describe('a5m2-subagent-wiring (h) honesty pins', () => {
  it('the import closure is the frozen adapter PLUS the domain effect grammar ONLY (root 20:39 FIX 1): no plane, no kernel, no crypto', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'subagent-wiring.mjs'), 'utf8')
    const specifiers = [...source.matchAll(/^import[\s\S]*?from '(.+)'$/gm)].map((m) => String(m[1]))
    expect(specifiers).toEqual(['./subagent-adapters.mjs', '../../../../../domain/tool-governance/src/index.js'])
  })
  it('missing live exec.callId or a feed with no realmId refuses with ZERO PA entry (never a minted constant)', async () => {
    const pa = makePa()
    const fixture = makeFixture()
    const wiring = okValue(mountWiring(pa, { subagentService: fixture.service, liveSubagentService: () => fixture.service, agentsRegistry: registryDouble, liveAgentsRegistry: () => registryDouble }))
    const send = wiring.definitions.find((d) => d.name === 'send_message')
    if (send === undefined) throw new Error('no def')
    const noCall = asError(await send.execute({ agent_id: 'agent-child-1', message: 'hi' }, { agent: AGENT_REF, signal: SIGNAL }).then(() => null, (e: unknown) => asError(e)))
    expect(noCall?.subagentRefusal?.code).toBe(WCODES.CALL_ID_ABSENT)
    setFeedOverride(() => ({ realmId: undefined }))
    const noRealm = asError(await send.execute({ agent_id: 'agent-child-1', message: 'hi' }, execFor('call-r')).then(() => null, (e: unknown) => asError(e)))
    expect(noRealm?.subagentRefusal?.code).toBe(WCODES.REALM_ABSENT)
    setFeedOverride(undefined)
    expect(pa.walks).toHaveLength(0)
    expect(fixture.calls).toEqual([])
  })
  it('the spawn side stays UNMOUNTED and UNWALKED: placement names are the trio and the family block carries the spawn gap fact verbatim', () => {
    const wiring = okValue(mountWiring(makePa()))
    expect(wiring.definitions.map((d) => d.name).sort()).toEqual(['interrupt_agent', 'list_agents', 'send_message'])
    expect(wiring.placementNames).not.toContain('subagent')
    expect(wiring.placementNames).not.toContain('list_subagent_models')
    expect(String(wiring.subset ?? '')).toContain('39-43')
  })
})
