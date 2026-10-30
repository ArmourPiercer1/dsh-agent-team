/**
 * u7r3-s1ask C1 — the governed ask row carries its per-call Agent into the
 * EXISTING `createUserQuestionsPort` binding (O2-A S1): the already-public
 * per-call carrier `ToolExecutionInput.agent` (host core/tools index.ts:339
 * @639ed01539 — "the agent on whose behalf the call runs (set by the agent
 * loop)") rides the row transport like the agent-control rows already do
 * (spawn-row.mjs:41-43: trusted transport data the model cannot express or
 * restate), and the host-service arm binds it LAZILY for that call only.
 *
 * Every leg runs the REAL chain without a boot (the u7-f C1 law): plane
 * mount → FamilyAssembly seam → lane admission → the Kernel's PA walk (the
 * C1 stand-in control leg) → the governed executor → the port resolved per
 * call. The host-service arm is driven through `mount(agentCtx)` — the same
 * public seam production binds (`hostServices.ctx = agentCtx`, the lazy
 * `ctx.get('userQuestions')` lookup); the service fake mirrors the pinned
 * host's OWN law (user-questions/src/index.ts:287-330 + assertLiveRoot
 * :131-144): an UNscoped request is never answered (NO_PROVIDER), a scoped
 * request naming a non-live agent is refused (CALLER_NOT_LIVE), and only a
 * scoped request naming the live root answers. The law lives in the fake
 * because it is the SERVICE's law — the row surfaces it verbatim, never
 * second-guesses it (ui-interaction-port.mjs:73-79).
 *
 * Pinned laws:
 *  scoped arm — carrier present ⇒ the request that reaches the service
 *    carries that EXACT agent identity (ask face AND timed askTimed face);
 *    the answer lands; `governed-ask RAN` rides the observe line.
 *  no silent unscoped forwarding — with a carrier expected there is NO
 *    service call without it (the sweep leg proves this across the whole
 *    surface); a nullish carrier is NOT carried by the row (spawn-row's
 *    falsy law) and the legacy unscoped arm stays byte-equal: the service's
 *    OWN typed refusal surfaces as the SAME `UI_INTERACTION_PORT_FAILED`
 *    the row answers today (the f3/f4 C2 refusal shape, regression-pinned).
 *  falsy/unknown carrier — the service's ownership law answers verbatim
 *    (CALLER_NOT_LIVE), never a synthesized success, never a silent drop.
 *  injected arm untouched — an injected port wins and receives NO
 *    re-stamped carrier (it owns its own binding); the unscoped legacy
 *    behavior on that arm is byte-equal (the 41 C1 legs of
 *    u7-f-ui-c1.test.ts ride it unchanged).
 *  correlation discipline — the Agent never rides an observe line, a
 *    callId, or any service field beside `agent` (sentinel leg).
 *  adapter law (ui-interaction-port.mjs:83-94) — binding resolves lazily;
 *    an unresolved binding forwards the request UNTOUCHED (the same object,
 *    no `{ agent: undefined }` key); absent binding = identical; the
 *    fail-closed arms (no service / missing face → null) are unchanged.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `s1ask-c1-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const REALM = 's1ask-c1-realm'
// The sentinel: this exact text must appear NOWHERE except as the Agent
// object's own identity (never stringified onto a line, a callId, or a
// service field beside `agent`).
const SENTINEL = 'SENTINEL-live-root-agent-4f3a'

interface Definition { name: string; execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<unknown> }
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  mount: (agentCtx: Record<string, unknown>) => { dispose?: () => void; ok?: boolean; code?: string }
}
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message?: string }

let row: { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built }
let port: {
  createUserQuestionsPort: (service: unknown, binding?: { agent?: () => unknown }) => Record<string, unknown> | null
}

const loadRow = async () => {
  if (!row) row = (await import(new URL('../../runtime/src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as typeof row
  return row
}
const loadPort = async () => {
  if (!port) port = (await import(new URL('../ui-family/src/ui-interaction-port.mjs', import.meta.url).href)) as typeof port
  return port
}

beforeAll(async () => {
  await loadRow()
  await loadPort()
  mkdirSync(ROOT_DIR, { recursive: true })
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const fsInstance = () => ({ fs: 's1ask-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' })
const confinedProvider = {
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
}
const ASK_DEFAULT = { default: 'ask', allow: [], ask: [], deny: [] }

let controlAudit: string[] = []
interface LegPlan {
  approvalCaseId: unknown
  requiredAuthority: unknown
  effectSetFingerprint: unknown
  authorityGeneration: unknown
  deniedEffects: unknown
}
interface LegInput {
  callId: unknown
  request: unknown
  plan: LegPlan
  assembly: {
    issueApprovedGrant: (request: unknown, approval: Record<string, unknown>) => Promise<{ ok?: boolean; value?: unknown; error?: { message?: string } }>
  }
}
const approvingControlLeg = () => async ({ callId, request, plan, assembly }: LegInput) => {
  controlAudit.push(`c1-standin-landing paCase=${plan.approvalCaseId} rung=${plan.requiredAuthority}`)
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
  if (issued.ok !== true) {
    return { decision: 'deny', requestId: `c1-standin-${callId}`, detail: String(issued.error?.message ?? 'landing refused') }
  }
  return { decision: 'approve', requestId: `c1-standin-${callId}`, approval, grant: issued.value }
}

/** The fake pinned-host `userQuestions` service. Its law is the HOST's law
 *  mirrored verbatim (user-questions/src/index.ts @639ed01539):
 *  - `agent === undefined`  → the plain waterfall arm → NO answerer accepts
 *    unscoped traffic → `NO_PROVIDER` (`:318-324`).
 *  - scoped but not the exact live root → `CALLER_NOT_LIVE` (assertLiveRoot
 *    `:131-144`).
 *  - scoped + live root → answers. */
function fakeUserService(liveRoots: unknown[]) {
  const service = {
    askCalls: [] as Array<Record<string, unknown>>,
    askTimedCalls: [] as Array<{ request: Record<string, unknown>; callId: string; timeoutMs: number }>,
    ask: async (request: Record<string, unknown>) => {
      service.askCalls.push(request)
      const agent = request.agent
      if (agent === undefined) throw new Error('no user-questions answerer accepted the request')
      if (!liveRoots.includes(agent)) throw new Error('the supplied agent is not the registry live root (CALLER_NOT_LIVE)')
      const questions = (request.questions ?? []) as Array<{ id: string }>
      return { answers: questions.map((q) => ({ id: q.id, selected: ['yes'] })) }
    },
    askTimed: async (request: Record<string, unknown>, callId: string, timeoutMs: number) => {
      service.askTimedCalls.push({ request, callId, timeoutMs })
      const agent = request.agent
      if (agent === undefined) throw new Error('no user-questions answerer accepted the request')
      if (!liveRoots.includes(agent)) throw new Error('the supplied agent is not the registry live root (CALLER_NOT_LIVE)')
      const questions = (request.questions ?? []) as Array<{ id: string }>
      return { answers: questions.map((q) => ({ id: q.id, selected: ['timed-yes'] })) }
    },
  }
  return service
}

/** One mount whose agent ctx answers `ctx.get('userQuestions')` exactly the
 *  way the trusted production mount binds it (team-tool-plane.mjs:2039-2048
 *  — `hostServices.ctx = agentCtx`, lookups lazy per call). No injected
 *  port: this is the SERVICE arm, the only arm production carries. */
async function buildServiceArm(
  service: unknown,
  opts: { planeExtra?: Record<string, unknown> } = {},
  observe: string[] = [],
): Promise<PlaneValue> {
  controlAudit = []
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 's1ask-test-team-root',
    permissionPolicy: ASK_DEFAULT,
    realmId: REALM,
    templateId: 's1ask-tpl',
    role: 'member',
    instanceId: 's1ask-instance',
    onObserve: (r: unknown) => { observe.push(String(r)) },
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(), confinedProvider, uiFamilyEnabled: true, ...(opts.planeExtra ?? {}) },
    controlLeg: approvingControlLeg(),
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  const plane = built.value
  const mounted = plane.mount({
    tools: { register: () => () => {} },
    get: (name: string) => (name === 'userQuestions' ? service : undefined),
  })
  if (mounted?.ok === false) throw new Error(`placement refused: ${String(mounted.code)}`)
  return plane
}

/** One mount on the INJECTED arm (the kit/C1 seam) — legacy behavior must
 *  stay byte-equal whether or not a carrier rides the call. */
async function buildInjectedArm(
  injectedPort: Record<string, unknown>,
  observe: string[] = [],
): Promise<PlaneValue> {
  controlAudit = []
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 's1ask-test-team-root',
    permissionPolicy: ASK_DEFAULT,
    realmId: REALM,
    templateId: 's1ask-tpl',
    role: 'member',
    instanceId: 's1ask-instance',
    onObserve: (r: unknown) => { observe.push(String(r)) },
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(), confinedProvider, uiFamilyEnabled: true },
    controlLeg: approvingControlLeg(),
    backends: { uiInteraction: injectedPort },
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  const plane = built.value
  plane.mount({ tools: { register: () => () => {} }, get: () => undefined })
  return plane
}

const askDef = (plane: PlaneValue): Definition => {
  const d = plane.definitions.find((x) => x.name === 'ask_user_question')
  if (d === undefined) throw new Error('no ask_user_question definition')
  return d
}
const Q = (over: Record<string, unknown> = {}) => ({ id: 'q1', question: 'Proceed?', ...over })

async function attempt(fn: () => Promise<unknown>): Promise<{ ok: true; value: unknown } | { ok: false; msg: string }> {
  try { return { ok: true as const, value: await fn() } }
  catch (error) { return { ok: false as const, msg: String((error as Error).message ?? error) } }
}

// ─────────────────────────────────────────────────────────────────────────
describe('S1 scoped arm — the per-call carrier reaches the service through the existing binding', () => {
  it('SB-1 carrier present: the service request carries that EXACT agent identity and the answer lands', async () => {
    const carrier = { id: SENTINEL, sessionKey: 'sess-live-root-1' }
    const service = fakeUserService([carrier])
    const observe: string[] = []
    const plane = await buildServiceArm(service, {}, observe)
    const r = await attempt(() => askDef(plane).execute(
      { questions: [{ id: 'q1', question: 'Deploy?', options: [{ label: 'Deploy now' }, { label: 'Hold' }], multi_select: true }] },
      { token: { t: 'sb-1' }, agent: carrier },
    ))
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.value).toEqual({ answers: [{ id: 'q1', selected: ['yes'] }] })
    expect(service.askCalls).toHaveLength(1)
    const sent = service.askCalls[0]!
    // The scoped call SHAPE: the service request carries the carrier as the
    // SAME object identity (a carrier, never a copy of its fields) beside
    // the translated questions.
    expect(sent.agent).toBe(carrier)
    const questions = sent.questions as Array<Record<string, unknown>>
    expect(questions[0]?.multiSelect).toBe(true)
    expect(questions[0]?.multi_select).toBeUndefined()
    // No correlation leakage: the Agent never rides any other service field,
    // and no observe line carries the sentinel text.
    expect(Object.keys(sent).sort()).toEqual(['agent', 'questions'])
    expect(observe.some((l) => l.includes('SENTINEL-live-root-agent-4f3a'))).toBe(false)
    expect(observe.some((l) => l.includes('governed-ask RAN answers=1'))).toBe(true)
    expect(controlAudit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(1)
  })

  it('SB-1t timed face: the askTimed request carries the carrier too (the host timed law)', async () => {
    const carrier = { id: SENTINEL, sessionKey: 'sess-live-root-1' }
    const service = fakeUserService([carrier])
    const observe: string[] = []
    const plane = await buildServiceArm(service, { planeExtra: { uiTimedQuestions: true } }, observe)
    const r = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'sb-1t' }, agent: carrier }))
    expect(r.ok).toBe(true)
    expect(service.askTimedCalls).toHaveLength(1)
    expect(service.askTimedCalls[0]!.request.agent).toBe(carrier)
    expect(service.askCalls).toHaveLength(0)
    expect(r.ok === true && r.value).toEqual({ answers: [{ id: 'q1', selected: ['timed-yes'] }] })
  })

  it('SB-4 sweep: NO service call ever goes out without the carrier when one is expected', async () => {
    const carrier = { id: SENTINEL, sessionKey: 'sess-live-root-sweep' }
    const service = fakeUserService([carrier])
    const plane = await buildServiceArm(service)
    for (let i = 0; i < 3; i += 1) {
      const r = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: `sb-4-${String(i)}` }, agent: carrier }))
      expect(r.ok).toBe(true)
    }
    expect(service.askCalls).toHaveLength(3)
    // Every single dispatch carries the exact agent — there is no path that
    // drops it (no unscoped forwarding on a carrier-expected call).
    for (const sent of service.askCalls) expect(sent.agent).toBe(carrier)
    expect(service.askCalls.some((s) => s.agent === undefined)).toBe(false)
  })
})

describe('failure laws preserved — absent/falsy/unknown carriers never become a silent unscoped delivery', () => {
  it('SB-2 carrier absent: the SAME typed UI_INTERACTION_PORT_FAILED refusal as today (f3/f4 shape), service law verbatim', async () => {
    const service = fakeUserService([])
    const observe: string[] = []
    const plane = await buildServiceArm(service, {}, observe)
    const r = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'sb-2' } }))
    // The legacy unscoped arm is UNTOUCHED: the row forwards to the service,
    // the service's OWN law answers NO_PROVIDER, and the row surfaces the
    // SAME typed refusal code/class it answers today.
    expect(service.askCalls).toHaveLength(1)
    expect(service.askCalls[0]!.agent).toBeUndefined()
    expect(r.ok).toBe(false)
    if (r.ok === false) {
      expect(r.msg.startsWith('refused-io UI_INTERACTION_PORT_FAILED')).toBe(true)
      expect(r.msg).toContain('no user-questions answerer accepted the request')
    }
    expect(observe.some((l) => l.includes('governed-ask port-failed'))).toBe(true)
    expect(observe.some((l) => l.includes('governed-ask RAN'))).toBe(false)
  })

  it('SB-3a null/undefined carrier: the row does NOT carry it (spawn-row falsy law) → unscoped arm → typed refusal', async () => {
    const service = fakeUserService([])
    const plane = await buildServiceArm(service)
    const withNull = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'sb-3a-n' }, agent: null }))
    const withUndef = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'sb-3a-u' }, agent: undefined }))
    for (const r of [withNull, withUndef]) {
      expect(r.ok).toBe(false)
      if (r.ok === false) expect(r.msg.startsWith('refused-io UI_INTERACTION_PORT_FAILED')).toBe(true)
    }
    expect(service.askCalls).toHaveLength(2)
    expect(service.askCalls.every((s) => s.agent === undefined)).toBe(true)
  })

  it('SB-3b unknown agent: the service ownership law answers verbatim (CALLER_NOT_LIVE), never a synthesized success', async () => {
    const stranger = { id: 'not-a-live-root' }
    const service = fakeUserService([])
    const plane = await buildServiceArm(service)
    const r = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'sb-3b' }, agent: stranger }))
    expect(r.ok).toBe(false)
    if (r.ok === false) {
      expect(r.msg.startsWith('refused-io UI_INTERACTION_PORT_FAILED')).toBe(true)
      // The service's typed refusal rides VERBATIM — the row never rewrites
      // the Host's ownership law (ui-interaction-port.mjs:76-79).
      expect(r.msg).toContain('CALLER_NOT_LIVE')
    }
    expect(service.askCalls).toHaveLength(1)
    expect(service.askCalls[0]!.agent).toBe(stranger)
  })

  it('SB-3c falsy non-nullish carrier (false): rides verbatim as dispatch data, the service law refuses it', async () => {
    const service = fakeUserService([])
    const plane = await buildServiceArm(service)
    const r = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'sb-3c' }, agent: false }))
    expect(r.ok).toBe(false)
    if (r.ok === false) expect(r.msg.startsWith('refused-io UI_INTERACTION_PORT_FAILED')).toBe(true)
    expect(service.askCalls).toHaveLength(1)
    expect(service.askCalls[0]!.agent).toBe(false)
  })
})

describe('legacy arms untouched — the injected port owns its own binding', () => {
  it('LEG-1 injected port wins with a carrier present: NO re-stamped agent on its request', async () => {
    const carrier = { id: SENTINEL }
    const calls: Array<Record<string, unknown>> = []
    const injected = {
      ask: async (request: Record<string, unknown>) => {
        calls.push(request)
        const questions = (request.questions ?? []) as Array<{ id: string }>
        return { answers: questions.map((q) => ({ id: q.id, selected: ['injected'] })) }
      },
    }
    const plane = await buildInjectedArm(injected)
    const r = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'leg-1' }, agent: carrier }))
    expect(r.ok).toBe(true)
    expect(calls).toHaveLength(1)
    // The lane does not re-stamp the carrier onto an injected port — that
    // arm's binding is the mount's own (the S3 arm stays exactly as built).
    expect('agent' in calls[0]!).toBe(false)
  })

  it('LEG-2 injected port without a carrier: byte-equal legacy answer path (the 41 C1 legs unchanged)', async () => {
    const calls: Array<Record<string, unknown>> = []
    const injected = {
      ask: async (request: Record<string, unknown>) => {
        calls.push(request)
        const questions = (request.questions ?? []) as Array<{ id: string }>
        return { answers: questions.map((q) => ({ id: q.id, selected: ['injected'] })) }
      },
    }
    const plane = await buildInjectedArm(injected)
    const r = await attempt(() => askDef(plane).execute({ questions: [Q()] }, { token: { t: 'leg-2' } }))
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.value).toEqual({ answers: [{ id: 'q1', selected: ['injected'] }] })
    expect(calls).toHaveLength(1)
    expect('agent' in calls[0]!).toBe(false)
  })
})

describe('adapter law (ui-interaction-port.mjs:83-94) — lazy binding, untouched unscoped request, fail-closed arms', () => {
  interface AdapterPort {
    ask: (request: Record<string, unknown>) => Promise<unknown>
    askTimed: (request: Record<string, unknown>, callId: string, timeoutMs: number) => Promise<unknown>
  }
  const usable = (p: Record<string, unknown> | null): AdapterPort => {
    expect(p).not.toBeNull()
    if (p === null) throw new Error('adapter refused a service it should have wrapped')
    return p as unknown as AdapterPort
  }

  it('AD-1 binding resolves to an agent: ask AND askTimed carry it beside the request fields', async () => {
    const { createUserQuestionsPort } = await loadPort()
    const captured: Array<{ request: unknown; callId?: unknown; timeoutMs?: unknown }> = []
    const agent = () => ({ id: 'live-agent' })
    const service = {
      ask: async (request: Record<string, unknown>) => { captured.push({ request }); return { answers: [] } },
      askTimed: async (request: Record<string, unknown>, callId: unknown, timeoutMs: unknown) => { captured.push({ request, callId, timeoutMs }); return { pending: true } },
    }
    const p = usable(createUserQuestionsPort(service, { agent }))
    await p.ask({ questions: [{ id: 'q1' }] })
    await p.askTimed({ questions: [{ id: 'q1' }] }, 'call-1', 1000)
    const scoped = captured.map((c) => c.request as Record<string, unknown>)
    expect(scoped[0]!.agent).toEqual({ id: 'live-agent' })
    expect(scoped[1]!.agent).toEqual({ id: 'live-agent' })
    expect(captured[1]!.callId).toBe('call-1')
    expect(captured[1]!.timeoutMs).toBe(1000)
  })

  it('AD-2 binding resolves to undefined: the SAME request object is forwarded untouched — never an `{ agent: undefined }` key', async () => {
    const { createUserQuestionsPort } = await loadPort()
    let captured: Record<string, unknown> | undefined
    const service = {
      ask: async (request: Record<string, unknown>) => { captured = request; return { answers: [] } },
      askTimed: async () => ({ pending: true }),
    }
    const p = usable(createUserQuestionsPort(service, { agent: () => undefined }))
    const sent = { questions: [{ id: 'q1' }] }
    await p.ask(sent)
    // Identical object reference: the documented no-agent arm forwards the
    // request UNCHANGED (the unscoped legacy shape, byte-equal).
    expect(captured).toBe(sent)
    expect(captured !== undefined && 'agent' in captured).toBe(false)
  })

  it('AD-3 legacy one-argument call: identical unscoped forwarding (the pre-S1 call shape stays legal)', async () => {
    const { createUserQuestionsPort } = await loadPort()
    let captured: Record<string, unknown> | undefined
    const service = {
      ask: async (request: Record<string, unknown>) => { captured = request; return { answers: [] } },
      askTimed: async () => ({ pending: true }),
    }
    const p = usable(createUserQuestionsPort(service))
    const sent = { questions: [{ id: 'q1' }] }
    await p.ask(sent)
    expect(captured).toBe(sent)
    expect(captured !== undefined && 'agent' in captured).toBe(false)
  })

  it('AD-4 fail-closed arms unchanged: no service / missing face = null, never a half-port', async () => {
    const { createUserQuestionsPort } = await loadPort()
    expect(createUserQuestionsPort(null, { agent: () => ({ id: 'x' }) })).toBeNull()
    expect(createUserQuestionsPort(undefined, { agent: () => ({ id: 'x' }) })).toBeNull()
    expect(createUserQuestionsPort({}, { agent: () => ({ id: 'x' }) })).toBeNull()
    expect(createUserQuestionsPort({ ask: async () => ({ answers: [] }) }, { agent: () => ({ id: 'x' }) })).toBeNull()
  })
})
