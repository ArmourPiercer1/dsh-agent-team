/**
 * u7-f C1 — the governed UI family (ask_user_question + present) over the
 * REAL chain: plane mount → FamilyAssembly seam → lane admission → the
 * Kernel's PA walk (one-shot, the C1 control-leg stand-in) → the governed
 * executors with every authority force injected and the human-facing
 * effects landing ONLY on the INJECTED fake interaction port.
 *
 * The template law is `u7-9a-fs-mutation-c1.test.ts`: the observe line
 * `governed-ask RAN` / `governed-present RAN` appears ONLY when the effect
 * actually landed; every refusal arm pairs the ANSWER with a FACT (port
 * call counts, disk byte-compares, audit counts), never a guard light
 * alone; file BYTES never ride an observation line (the canary legs prove
 * it for present).
 *
 * Pinned laws:
 *  mount — absent `uiFamilyEnabled` = the family does not exist and the
 *    native spellings are NOT plane-owned (byte-zero flip); enabled = the
 *    two rows mount at their FIXED native spellings; a non-boolean key is
 *    refused PLANE_CONFIG_INCOMPLETE (never silently defaulted).
 *  ask — legacy answers {answers}; the timed variant selects at MOUNT
 *    (the host `mode: timed` mirror); the timeout law (-1 keyed ask,
 *    default 120, bound 1..2147483, invalid BEFORE the PA edge); the
 *    PENDING outcome is typed and NEVER carries answers (a dishonest
 *    port's answers riding a pending result are dropped); port absent /
 *    malformed / throwing = typed refusals, never a fabricated answer.
 *  present — the fs family's anchor law (out-of-root and `../` refused
 *    with ZERO port calls and ZERO fs touch; the symlink escape refused
 *    post-consume with ZERO publication and byte-identical outside);
 *    1..8 closed items; probe pays the declared read effects; bytes never
 *    enter the result, the port payload, or a line.
 *  both — declared == requested (E-group pins the fingerprinted set to the
 *    contribution's declared targets: one name, two faces); default-deny
 *    refuses with zero port calls; control-leg deny answers typed; the
 *    settled-token replay answers cancelled WITHOUT re-consuming the grant
 *    or touching the port twice; unknown fields have no ride.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const WORLD = join(REPO, 'tests/homes', `u7-f-c1-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const OUTSIDE_DIR = join(WORLD, 'outside')
const REALM = 'u7-f-c1-realm'
// The canary: bytes of a presented file must appear in NO observation line
// (present verifies by descriptor probe and publishes REFERENCES only).
const CANARY = 'CANARY-BYTES-NEVER-RIDE-A-LINE-9f2e'

interface RowOutcome { answers?: unknown[]; pending?: boolean; callId?: string; message?: string; files?: Array<{ path: string; description?: string }>; turn?: number; cancelled?: boolean }
interface Definition { name: string; description: string; parameters: Record<string, unknown>; execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<RowOutcome> }
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  ownNames: readonly string[]
  mount: (agentCtx: Record<string, unknown>) => { dispose: () => void }
}
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message?: string }

interface FakePort {
  askCalls: Array<Record<string, unknown>>
  askTimedCalls: Array<{ request: Record<string, unknown>; callId: string; timeoutMs: number }>
  presentCalls: Array<Record<string, unknown>>
  ask: (request: Record<string, unknown>) => Promise<unknown>
  askTimed?: (request: Record<string, unknown>, callId: string, timeoutMs: number) => Promise<unknown>
  present?: (request: Record<string, unknown>) => Promise<unknown>
}

let row: { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built }

const loadRow = async () => {
  if (!row) row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as typeof row
  return row
}

beforeAll(async () => {
  await loadRow()
  mkdirSync(ROOT_DIR, { recursive: true })
  mkdirSync(OUTSIDE_DIR, { recursive: true })
  writeFileSync(join(ROOT_DIR, 'doc.txt'), 'presentable-doc-line\n')
  writeFileSync(join(ROOT_DIR, 'canary.txt'), `${CANARY}\n`)
  writeFileSync(join(ROOT_DIR, 'second.txt'), 'second-doc-line\n')
  writeFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'OUTSIDE-SECRET-DO-NOT-PUBLISH\n')
  symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), join(ROOT_DIR, 'alias.txt'))
  mkdirSync(join(ROOT_DIR, 'adir'))
})
afterAll(() => { rmSync(WORLD, { recursive: true, force: true }) })

const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const fsInstance = () => ({ fs: 'u7f-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' })
const confinedProvider = {
  trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
  assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
}

const policy = (lanes: { default?: 'deny' | 'ask'; allow?: unknown[]; ask?: unknown[]; deny?: unknown[] }) => ({
  default: lanes.default ?? 'deny',
  allow: lanes.allow ?? [],
  ask: lanes.ask ?? [],
  deny: lanes.deny ?? [],
})
// A positive governed UI call runs under an ASK-default template: the
// closed rule grammar names no interaction/presentation tool, so under a
// deny default NO rule could ever cover the question/publication arm (the
// D-group pins both refusal layers); under 'ask' every arm falls to the
// per-call approval, which the control leg answers once.
const ASK_DEFAULT = policy({ default: 'ask', ask: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }] })

/** One mount under test. `planeExtra` carries the family keys
 *  (uiFamilyEnabled / uiTimedQuestions); `port` rides the kit backends
 *  seam exactly as a trusted mount would inject it. */
async function build(
  frozen: unknown,
  opts: { planeExtra?: Record<string, unknown>; port?: FakePort | Record<string, unknown> | null; controlLeg?: unknown } = {},
  observe: string[] = [],
): Promise<PlaneValue> {
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u7f-test-team-root',
    permissionPolicy: frozen,
    realmId: REALM,
    templateId: 'u7f-tpl',
    role: 'member',
    instanceId: 'u7f-instance',
    onObserve: (r: unknown) => { observe.push(String(r)) },
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(), confinedProvider, uiFamilyEnabled: true, ...(opts.planeExtra ?? {}) },
    ...((opts.controlLeg === undefined ? {} : { controlLeg: opts.controlLeg })),
    ...((opts.port === undefined || opts.port === null ? {} : { backends: { uiInteraction: opts.port } })),
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  const plane = built.value
  plane.mount({})
  return plane
}

async function buildRaw(input: Record<string, unknown>): Promise<Built> {
  return (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u7f-test-team-root',
    realmId: REALM,
    templateId: 'u7f-tpl',
    role: 'member',
    instanceId: 'u7f-instance',
    onObserve: () => {},
    ...input,
  })
}

const def = (plane: PlaneValue, name: string): Definition => {
  const d = plane.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no ${name} definition`)
  return d
}
const ran = (observe: string[], tool: string) => observe.filter((l) => l.includes(`governed-${tool} RAN`))

async function attempt(fn: () => Promise<unknown>): Promise<{ ok: true; value: RowOutcome } | { ok: false; msg: string }> {
  try { return { ok: true as const, value: await fn() as RowOutcome } }
  catch (error) { return { ok: false as const, msg: String((error as Error).message ?? error) } }
}

/** The fake interaction port (the C1 stand-in for the trusted mount's
 *  human face): it records EVERYTHING it is asked, answers per `opts`, and
 *  is the ONE witness the zero-effect legs count. */
function fakePort(opts: {
  answers?: unknown[]
  timedResult?: unknown
  presentReceipt?: unknown
  askThrows?: string
  presentThrows?: string
  noPresentFace?: boolean
  noTimedFace?: boolean
} = {}): FakePort {
  const port: FakePort = {
    askCalls: [],
    askTimedCalls: [],
    presentCalls: [],
    ask: async (request) => {
      port.askCalls.push(request)
      if (opts.askThrows !== undefined) throw new Error(opts.askThrows)
      const questions = (request.questions ?? []) as Array<{ id: string }>
      return { answers: opts.answers ?? questions.map((q) => ({ id: q.id, selected: ['yes'] })) }
    },
  }
  if (opts.noTimedFace !== true) {
    port.askTimed = async (request, callId, timeoutMs) => {
      port.askTimedCalls.push({ request, callId, timeoutMs })
      if (opts.askThrows !== undefined) throw new Error(opts.askThrows)
      if (opts.timedResult !== undefined) return opts.timedResult
      const questions = (request.questions ?? []) as Array<{ id: string }>
      return { answers: questions.map((q) => ({ id: q.id, selected: ['timed-yes'] })) }
    }
  }
  if (opts.noPresentFace !== true) {
    port.present = async (request) => {
      port.presentCalls.push(request)
      if (opts.presentThrows !== undefined) throw new Error(opts.presentThrows)
      return opts.presentReceipt ?? { turn: 7 }
    }
  }
  return port
}

const Q = (over: Record<string, unknown> = {}) => ({ id: 'q1', question: 'Proceed?', ...over })

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 mount law — opt-in by closed key, zero flip by absence', () => {
  it('MF-1 absent uiFamilyEnabled: NO ask/present definitions, the native spellings stay NOT plane-owned (byte-zero flip)', async () => {
    const built = await buildRaw({
      permissionPolicy: ASK_DEFAULT,
      fs: { subtreeContains },
      plane: { fsInstance: fsInstance(), confinedProvider },
    })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    built.value.mount({})
    const names = built.value.definitions.map((d) => d.name)
    expect(names).not.toContain('ask_user_question')
    expect(names).not.toContain('present')
    expect(built.value.ownNames).not.toContain('ask_user_question')
    expect(built.value.ownNames).not.toContain('present')
  })

  it('MF-2 uiFamilyEnabled:true mounts BOTH rows at their FIXED native spellings (kernel-owned)', async () => {
    const plane = await build(ASK_DEFAULT, { port: fakePort() })
    expect(plane.definitions.map((d) => d.name)).toContain('ask_user_question')
    expect(plane.definitions.map((d) => d.name)).toContain('present')
    expect(plane.ownNames).toContain('ask_user_question')
    expect(plane.ownNames).toContain('present')
  })

  it('MF-3 non-boolean uiFamilyEnabled / uiTimedQuestions: PLANE_CONFIG_INCOMPLETE, the mount is refused (never silently defaulted)', async () => {
    const bad = await buildRaw({
      permissionPolicy: ASK_DEFAULT,
      fs: { subtreeContains },
      plane: { fsInstance: fsInstance(), confinedProvider, uiFamilyEnabled: 'yes' },
    })
    expect(bad.ok).toBe(false)
    if (bad.ok === false) expect(bad.code).toContain('PLANE_CONFIG_INCOMPLETE')
    const bad2 = await buildRaw({
      permissionPolicy: ASK_DEFAULT,
      fs: { subtreeContains },
      plane: { fsInstance: fsInstance(), confinedProvider, uiFamilyEnabled: true, uiTimedQuestions: 1 },
    })
    expect(bad2.ok).toBe(false)
    if (bad2.ok === false) expect(bad2.code).toContain('PLANE_CONFIG_INCOMPLETE')
  })

  it('MF-4 the reviewed manifest carries the ui family + its kernel capability, and the contribution declares the SAME Domain Authority identities the executors request', async () => {
    const manifest = JSON.parse(readFileSync(join(REPO, 'packages/tools/families/manifest.json'), 'utf8')) as {
      kernelCapabilities: Record<string, { backsExecution?: string }>
      families: Array<{ module: string; sha256: string }>
    }
    expect(manifest.families.some((f) => f.module === 'ui.mjs')).toBe(true)
    expect(manifest.kernelCapabilities['ui-interaction']?.backsExecution).toBe('family-body')
    const lane = await import(new URL('../../tools/ui-family/src/index.mjs', import.meta.url).href) as {
      buildUiFamilyContribution: (i: Record<string, unknown>) => {
        familyId: string
        visibility: { nativeNames: string[] }
        requiredCapabilities: string[]
        effects: { declared: boolean; kinds: string[]; targets: string[] }
        obligations: Record<string, string>
        execution: { via: string }
      }
      USER_INTERACTION_DOMAIN_AUTHORITY: string
      UI_PRESENTATION_DOMAIN_AUTHORITY: string
      buildAskRowDefinition: (i: Record<string, unknown>) => unknown
      buildPresentRowDefinition: (i: Record<string, unknown>) => unknown
    }
    const contribution = lane.buildUiFamilyContribution({
      ask: { definition: lane.buildAskRowDefinition({ askExecutor: async () => ({ kind: 'cancelled' }) }), executorFactory: () => undefined },
      present: { definition: lane.buildPresentRowDefinition({ presentExecutor: async () => ({ kind: 'cancelled' }) }), executorFactory: () => undefined },
      mechanics: {},
      port: {},
      cancelBoundary: 'test',
    })
    expect(contribution.familyId).toBe('dsh.ui-family')
    expect(contribution.visibility.nativeNames).toEqual(['ask_user_question', 'present'])
    expect(contribution.requiredCapabilities).toEqual(['ui-interaction'])
    expect(contribution.effects.declared).toBe(true)
    expect(contribution.effects.targets).toEqual(['realm-file-root', lane.USER_INTERACTION_DOMAIN_AUTHORITY, lane.UI_PRESENTATION_DOMAIN_AUTHORITY])
    expect(contribution.execution.via).toBe('family-body')
    expect(contribution.obligations).toEqual({ admission: 'kernel', grantMint: 'kernel', grantConsume: 'kernel' })
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 ask (legacy) — answer lands once through the injected port, refusals touch nothing', () => {
  it('A-1 POSITIVE: the answer batch passes through UNTOUCHED; the port saw ONE call in service shape; the RAN line is true', async () => {
    const observe: string[] = []
    const audit: string[] = []
    const port = fakePort({ answers: [{ id: 'q1', selected: ['Deploy now'], custom: 'ship it' }] })
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg(audit) }, observe)
    const r = await attempt(() => def(plane, 'ask_user_question').execute(
      { questions: [{ id: 'q1', question: 'Deploy?', header: 'Confirm', options: [{ label: 'Deploy now' }, { label: 'Hold' }], multi_select: true }] },
      { token: { t: 'a1' } },
    ))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ answers: [{ id: 'q1', selected: ['Deploy now'], custom: 'ship it' }] })
    expect(port.askCalls).toHaveLength(1)
    expect(port.askTimedCalls).toHaveLength(0)
    // model→service translation at the port seam: multi_select rides as multiSelect.
    const sent = (port.askCalls[0]?.questions ?? []) as Array<Record<string, unknown>>
    expect(sent[0]?.multiSelect).toBe(true)
    expect(sent[0]?.multi_select).toBeUndefined()
    expect(ran(observe, 'ask')).toHaveLength(1)
    expect(observe.some((l) => l.includes('governed-ask RAN answers=1'))).toBe(true)
    expect(audit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(1)
  })

  it('A-2 port ABSENT: typed refusal, zero PA consumption, zero port calls (a call that could never ask never spends a grant)', async () => {
    const observe: string[] = []
    const audit: string[] = []
    const plane = await build(ASK_DEFAULT, { port: null, controlLeg: approvingControlLeg(audit) }, observe)
    const r = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 'a2' } }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('UI_INTERACTION_PORT_ABSENT')
    expect(audit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(0)
    expect(observe.some((l) => l.includes('governed-ask port-refusal'))).toBe(true)
    expect(ran(observe, 'ask')).toHaveLength(0)
  })

  it('A-3 unknown fields have NO ride (top level, question, option): typed schema refusals BEFORE the port; multi_select stays the model spelling', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const r1 = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()], mode: 'sneak' }, { token: { t: 'a3-1' } }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.msg).toContain('ask-unknown-parameter')
    const r2 = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [{ ...Q(), permission: 'all' }] }, { token: { t: 'a3-2' } }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('ask-unknown-parameter')
    const r3 = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [{ ...Q(), options: [{ label: 'ok', auto_approve: true }] }] }, { token: { t: 'a3-3' } }))
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.msg).toContain('ask-unknown-parameter')
    expect(port.askCalls).toHaveLength(0)
  })

  it('A-4 the closed contract refuses malformed questions (empty batch, blank id/question, wrong types) with zero port calls', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const legs: Array<[unknown, string]> = [
      [{ questions: [] }, 'ask-questions-required'],
      [{ questions: [{ question: 'no id' }] }, 'ask-question-malformed'],
      [{ questions: [{ id: '', question: 'blank id' }] }, 'ask-question-malformed'],
      [{ questions: [{ id: 'x', question: 42 }] }, 'ask-question-malformed'],
      [{ questions: [{ id: 'x', question: 'q', multi_select: 'yes' }] }, 'ask-question-malformed'],
      [{ questions: [{ id: 'x', question: 'q', options: 'A or B' }] }, 'ask-options-malformed'],
    ]
    for (const [i, [args, code]] of legs.entries()) {
      const r = await attempt(() => def(plane, 'ask_user_question').execute(args, { token: { t: `a4-${String(i)}` } }))
      expect(r.ok, JSON.stringify(args)).toBe(false)
      if (!r.ok) expect(r.msg).toContain(code)
    }
    expect(port.askCalls).toHaveLength(0)
  })

  it('A-5 default-DENY template: typed refusal (the closed grammar names no interaction rule), zero port calls', async () => {
    const observe: string[] = []
    const port = fakePort()
    const plane = await build(policy({ allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }] }), { port }, observe)
    const r = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 'a5' } }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('template-default-deny')
    expect(port.askCalls).toHaveLength(0)
    expect(ran(observe, 'ask')).toHaveLength(0)
  })

  it('A-6 the control leg DENIES the question: typed refusal, the port was never asked (zero effect: no card, no wait)', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: denyingControlLeg([]) })
    const r = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 'a6' } }))
    expect(r.ok).toBe(false)
    expect(port.askCalls).toHaveLength(0)
  })

  it('A-7 one-shot: the settled token re-used answers cancelled WITHOUT re-consuming the grant or asking the human twice', async () => {
    const observe: string[] = []
    const audit: string[] = []
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg(audit) }, observe)
    const token = { t: 'a7' }
    const first = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token }))
    expect(first.ok).toBe(true)
    const second = await def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token })
    expect(second.cancelled).toBe(true)
    expect(port.askCalls).toHaveLength(1)
    expect(audit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(1)
    expect(ran(observe, 'ask')).toHaveLength(1)
  })

  it('A-8 in-flight replay on the SAME token is refused outright (one question, one wait)', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const token = { t: 'a8' }
    const first = def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token })
    const second = await attempt(async () => await def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token }))
    const firstResult = await attempt(async () => await first)
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.msg).toContain('exec-token-replay')
    expect(firstResult.ok).toBe(true)
    expect(port.askCalls).toHaveLength(1)
  })

  it('A-9 a dishonest port is answered by typed refusals, NEVER by a fabricated answer: malformed shape and port throw', async () => {
    const observe: string[] = []
    const malformed = fakePort({ answers: undefined })
    ;(malformed as { ask: (r: Record<string, unknown>) => Promise<unknown> }).ask = async (r) => { malformed.askCalls.push(r); return { notAnswers: true } }
    const plane1 = await build(ASK_DEFAULT, { port: malformed, controlLeg: approvingControlLeg([]) }, observe)
    const r1 = await attempt(() => def(plane1, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 'a9-1' } }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.msg).toContain('UI_INTERACTION_PORT_MALFORMED')
    const thrower = fakePort({ askThrows: 'CALLER_NOT_LIVE: caller is not the exact live root' })
    const plane2 = await build(ASK_DEFAULT, { port: thrower, controlLeg: approvingControlLeg([]) }, observe)
    const r2 = await attempt(() => def(plane2, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 'a9-2' } }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) {
      expect(r2.msg).toContain('UI_INTERACTION_PORT_FAILED')
      // the service's own typed refusal surfaces VERBATIM as the carrier.
      expect(r2.msg).toContain('CALLER_NOT_LIVE')
    }
    expect(ran(observe, 'ask')).toHaveLength(0)
  })

  it('A-10 an aborted signal answers the cancelled row-form with ZERO port calls (a call that never reached the human claims zero effect)', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const controller = new AbortController()
    controller.abort()
    const r = await def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 'a10' }, signal: controller.signal })
    expect(r.cancelled).toBe(true)
    expect(port.askCalls).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 timed law — mount-time variant selection, expiry is typed, NEVER an answer', () => {
  const timedPlane = async (port: FakePort, observe: string[] = [], audit: string[] = []) =>
    await build(ASK_DEFAULT, { planeExtra: { uiTimedQuestions: true }, port, controlLeg: approvingControlLeg(audit) }, observe)

  it('T-1 variant selection is MOUNT-TIME and CLOSED: only the timed mount carries the timeout parameter (host mode mirror)', async () => {
    const legacy = await build(ASK_DEFAULT, { port: fakePort() })
    const timed = await timedPlane(fakePort())
    expect(legacy.definitions.find((d) => d.name === 'ask_user_question')?.parameters.properties).not.toHaveProperty('timeout')
    expect(timed.definitions.find((d) => d.name === 'ask_user_question')?.parameters.properties).toHaveProperty('timeout')
    // the legacy mount keeps refusing the timed parameter (unknown field, no ride).
    const port = fakePort()
    const r = await attempt(() => def(legacy, 'ask_user_question').execute({ questions: [Q()], timeout: 5 }, { token: { t: 't1' } }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('ask-unknown-parameter')
    expect(port.askCalls).toHaveLength(0)
  })

  it('T-2 the per-call timeout reaches the port in milliseconds; the mount default is the host 120s', async () => {
    const port = fakePort()
    const plane = await timedPlane(port)
    const r1 = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()], timeout: 30 }, { token: { t: 't2-1' } }))
    expect(r1.ok).toBe(true)
    expect(port.askTimedCalls[0]?.timeoutMs).toBe(30_000)
    await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 't2-2' } }))
    expect(port.askTimedCalls[1]?.timeoutMs).toBe(120_000)
  })

  it('T-3 timeout -1 takes the KEYED indefinite-ask arm (host wait:{callId} form); the timed face is untouched', async () => {
    const port = fakePort()
    const plane = await timedPlane(port)
    const r = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()], timeout: -1 }, { token: { t: 't3' } }))
    expect(r.ok).toBe(true)
    expect(port.askTimedCalls).toHaveLength(0)
    expect(port.askCalls).toHaveLength(1)
    expect(port.askCalls[0]?.wait).toBeTypeOf('object')
    expect(String((port.askCalls[0]?.wait as { callId?: string } | undefined)?.callId).length).toBeGreaterThan(0)
  })

  it('T-4 EXPIRY is the typed pending outcome with the host pendingNotice VERBATIM — and no answers field exists to misread', async () => {
    const observe: string[] = []
    const port = fakePort({ timedResult: { pending: true } })
    const plane = await timedPlane(port, observe)
    const r = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()], timeout: 1 }, { token: { t: 't4' } }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.pending).toBe(true)
      expect(r.value.answers).toBeUndefined()
      expect(typeof r.value.callId).toBe('string')
      expect(r.value.message).toBe('No answer batch arrived before the timeout. This is pending, not a skipped answer. Continue useful independent work. The user can still answer; their reply will be a user message identified as answer_to_pending_question with this callId and the original questions. Do not treat this as permission.')
    }
    expect(port.askTimedCalls).toHaveLength(1)
    expect(ran(observe, 'ask')).toHaveLength(1)
    expect(observe.some((l) => l.includes('governed-ask RAN pending'))).toBe(true)
  })

  it('T-5 a dishonest port answering {pending:true, answers:[…]} gets its answers DROPPED (never merged, never surfaced)', async () => {
    const port = fakePort({ timedResult: { pending: true, answers: [{ id: 'q1', selected: ['FABRICATED'] }] } })
    const plane = await timedPlane(port)
    const r = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()], timeout: 1 }, { token: { t: 't5' } }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.pending).toBe(true)
      expect(r.value.answers).toBeUndefined()
    }
  })

  it('T-6 the timeout BOUND is a law BEFORE any authority force: 0 / 1.5 / 2147484 / strings are typed refusals with zero port calls', async () => {
    const audit: string[] = []
    const port = fakePort()
    const plane = await timedPlane(port, [], audit)
    for (const [i, timeout] of [0, 1.5, 2_147_484, '30', -2].entries()) {
      const r = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()], timeout }, { token: { t: `t6-${String(i)}` } }))
      expect(r.ok, String(timeout)).toBe(false)
      if (!r.ok) expect(r.msg).toContain('ask-timeout-invalid')
    }
    expect(port.askTimedCalls).toHaveLength(0)
    expect(port.askCalls).toHaveLength(0)
    expect(audit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(0)
  })

  it('T-7 the timed variant enforces unique question ids per call (host validateQuestionIds); the refusal is zero-port', async () => {
    const port = fakePort()
    const plane = await timedPlane(port)
    const r = await attempt(() => def(plane, 'ask_user_question').execute(
      { questions: [{ id: 'same', question: 'A?' }, { id: 'same', question: 'B?' }] },
      { token: { t: 't7' } },
    ))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('ask-duplicate-question-id')
    expect(port.askTimedCalls).toHaveLength(0)
  })

  it('T-8 replay law holds for the timed arm too: settled token answers cancelled, the human was waited-for once', async () => {
    const port = fakePort()
    const plane = await timedPlane(port)
    const token = { t: 't8' }
    const first = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()], timeout: 30 }, { token }))
    expect(first.ok).toBe(true)
    const second = await def(plane, 'ask_user_question').execute({ questions: [Q()], timeout: 30 }, { token })
    expect(second.cancelled).toBe(true)
    expect(port.askTimedCalls).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 present — anchor law, probe-paid reads, bytes never ride anything', () => {
  const PRESENT_OK = () => ({ files: [{ path: join(ROOT_DIR, 'doc.txt'), description: 'the doc' }] })

  it('P-1 POSITIVE: the verified file list reaches the port; the probe line pays the read effect with the REAL byte count; the receipt carries the port turn', async () => {
    const observe: string[] = []
    const audit: string[] = []
    const port = fakePort({ presentReceipt: { turn: 4 } })
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg(audit) }, observe)
    const r = await attempt(() => def(plane, 'present').execute(PRESENT_OK(), { token: { t: 'p1' } }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.files).toEqual([{ path: join(ROOT_DIR, 'doc.txt'), description: 'the doc' }])
      expect(r.value.turn).toBe(4)
    }
    expect(port.presentCalls).toHaveLength(1)
    const realBytes = readFileSync(join(ROOT_DIR, 'doc.txt')).length
    expect(observe.some((l) => l.includes(`governed-present PROBED path=${join(ROOT_DIR, 'doc.txt')} bytes=${String(realBytes)}`))).toBe(true)
    expect(ran(observe, 'present')).toHaveLength(1)
    expect(audit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(1)
  })

  it('P-2 out-of-root paths (absolute outside, ../ traversal) are refused PURE-LEXICALLY: zero PA consumption, zero port calls, zero fs touch', async () => {
    const audit: string[] = []
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg(audit) })
    const r1 = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(OUTSIDE_DIR, 'secret.txt') }] }, { token: { t: 'p2-1' } }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.msg).toContain('locator-rejected')
    writeFileSync(join(ROOT_DIR, 'upme.txt'), 'x\n')
    const r2 = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(ROOT_DIR, 'sub', '..', '..', 'outside', 'secret.txt') }] }, { token: { t: 'p2-2' } }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('locator-rejected')
    expect(port.presentCalls).toHaveLength(0)
    expect(audit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(0)
  })

  it('P-3 the symlink escape is refused POST-CONSUME with ZERO publication; the outside target stays BYTE-IDENTICAL', async () => {
    const observe: string[] = []
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) }, observe)
    const before = readFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'utf8')
    const r = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(ROOT_DIR, 'alias.txt') }] }, { token: { t: 'p3' } }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toMatch(/ANCHOR-DRIFT|symlink-alias/)
    expect(port.presentCalls).toHaveLength(0)
    expect(readFileSync(join(OUTSIDE_DIR, 'secret.txt'), 'utf8')).toBe(before)
    expect(ran(observe, 'present')).toHaveLength(0)
  })

  it('P-4 absent file answers the HOST sentence; a directory is not a regular file; both zero port', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const missing = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(ROOT_DIR, 'ghost.txt') }] }, { token: { t: 'p4-1' } }))
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.msg).toContain('FILE_NOT_FOUND')
      expect(missing.msg).toContain('Cannot present')
      expect(missing.msg).toContain('file not found. Check the path, create the file if needed, and retry.')
    }
    expect(existsSync(join(ROOT_DIR, 'ghost.txt'))).toBe(false)
    const dir = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(ROOT_DIR, 'adir') }] }, { token: { t: 'p4-2' } }))
    expect(dir.ok).toBe(false)
    if (!dir.ok) expect(dir.msg).toContain('not a regular file')
    expect(port.presentCalls).toHaveLength(0)
  })

  it('P-5 no presentation face on the injected port: typed UI_PRESENT_PORT_ABSENT, zero PA consumption; the ASK face stays usable', async () => {
    const audit: string[] = []
    const port = fakePort({ noPresentFace: true })
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg(audit) })
    const r = await attempt(() => def(plane, 'present').execute(PRESENT_OK(), { token: { t: 'p5' } }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('UI_PRESENT_PORT_ABSENT')
    expect(audit.filter((l) => l.startsWith('c1-standin-landing'))).toHaveLength(0)
    // same mount, same port: the ask row still works through its own face.
    const ask = await attempt(() => def(plane, 'ask_user_question').execute({ questions: [Q()] }, { token: { t: 'p5-ask' } }))
    expect(ask.ok).toBe(true)
    expect(port.askCalls).toHaveLength(1)
  })

  it('P-6 the closed file contract: 0 files / 9 files / unknown item fields are typed schema refusals with zero port calls', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const r1 = await attempt(() => def(plane, 'present').execute({ files: [] }, { token: { t: 'p6-1' } }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.msg).toContain('present-files-required')
    const nine = { files: Array.from({ length: 9 }, (_unused, i) => ({ path: join(ROOT_DIR, `doc${String(i)}.txt`) })) }
    const r2 = await attempt(() => def(plane, 'present').execute(nine, { token: { t: 'p6-2' } }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('present-files-limit')
    const r3 = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(ROOT_DIR, 'doc.txt'), auto_publish: true }] }, { token: { t: 'p6-3' } }))
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.msg).toContain('present-unknown-parameter')
    expect(port.presentCalls).toHaveLength(0)
  })

  it('P-7 default-DENY refuses BOTH ways: an uncovered file answers the executor file-level law; a covered file answers the Kernel edge refusal — both zero port', async () => {
    const observe: string[] = []
    const port1 = fakePort()
    const denyUncovered = await build(policy({ allow: [{ tool: 'read', resource: { kind: 'subtree', path: OUTSIDE_DIR } }] }), { port: port1 }, observe)
    const r1 = await attempt(() => def(denyUncovered, 'present').execute(PRESENT_OK(), { token: { t: 'p7-1' } }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) {
      expect(r1.msg).toContain('template-default-deny')
      expect(r1.msg).toContain('no read rule covers this presented file')
    }
    expect(port1.presentCalls).toHaveLength(0)
    const port2 = fakePort()
    const denyCovered = await build(policy({ allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT_DIR } }] }), { port: port2 }, observe)
    const r2 = await attempt(() => def(denyCovered, 'present').execute(PRESENT_OK(), { token: { t: 'p7-2' } }))
    expect(r2.ok).toBe(false)
    expect(port2.presentCalls).toHaveLength(0)
    expect(ran(observe, 'present')).toHaveLength(0)
  })

  it('P-8 one presented file OUT of root poisons the whole call BEFORE anything publishes (all-or-nothing)', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const r = await attempt(() => def(plane, 'present').execute({
      files: [{ path: join(ROOT_DIR, 'doc.txt') }, { path: join(OUTSIDE_DIR, 'secret.txt') }],
    }, { token: { t: 'p8' } }))
    expect(r.ok).toBe(false)
    expect(port.presentCalls).toHaveLength(0)
  })

  it('P-9 ZERO BYTE LEAK: the presented file canary appears in NO observation line, refusal or RAN alike', async () => {
    const observe: string[] = []
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) }, observe)
    const ok = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(ROOT_DIR, 'canary.txt') }] }, { token: { t: 'p9-1' } }))
    expect(ok.ok).toBe(true)
    const bad = await attempt(() => def(plane, 'present').execute({ files: [{ path: join(ROOT_DIR, 'ghost.txt') }] }, { token: { t: 'p9-2' } }))
    expect(bad.ok).toBe(false)
    const leaked = observe.filter((l) => l.includes(CANARY) || l.includes('presentable-doc-line'))
    expect(leaked).toEqual([])
  })

  it('P-10 one-shot replay: the settled token answers cancelled; the human-facing publish happened EXACTLY once', async () => {
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) })
    const token = { t: 'p10' }
    const first = await attempt(() => def(plane, 'present').execute(PRESENT_OK(), { token }))
    expect(first.ok).toBe(true)
    const second = await def(plane, 'present').execute(PRESENT_OK(), { token })
    expect(second.cancelled).toBe(true)
    expect(port.presentCalls).toHaveLength(1)
  })

  it('P-11 multiple in-root files publish together (receipt order, one line each); a throwing port is a typed io refusal, never a silent success', async () => {
    const observe: string[] = []
    const port = fakePort()
    const plane = await build(ASK_DEFAULT, { port, controlLeg: approvingControlLeg([]) }, observe)
    const r = await attempt(() => def(plane, 'present').execute({
      files: [{ path: join(ROOT_DIR, 'doc.txt') }, { path: join(ROOT_DIR, 'second.txt'), description: 'two' }],
    }, { token: { t: 'p11-1' } }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.files).toHaveLength(2)
      expect(r.value.files?.[1]?.description).toBe('two')
    }
    expect(port.presentCalls).toHaveLength(1)
    expect(observe.some((l) => l.includes('governed-present RAN files=2'))).toBe(true)
    const failPort = fakePort({ presentThrows: 'no open turn on this mount' })
    const plane2 = await build(ASK_DEFAULT, { port: failPort, controlLeg: approvingControlLeg([]) })
    const bad = await attempt(() => def(plane2, 'present').execute(PRESENT_OK(), { token: { t: 'p11-2' } }))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.msg).toContain('UI_PRESENT_PORT_FAILED')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 declared == requested — the fingerprinted set IS the declaration (PR #390 made structural)', () => {
  /** Direct executors with a capturing fake pa (the u7-9a I-13 pattern):
   *  what the REAL row requests at the Kernel edge, effect by effect. */
  const direct = async (opts: { timed?: boolean; port?: Record<string, unknown>; rootDir?: string | null } = {}) => {
    const askLane = await import(new URL('../../tools/ui-family/src/ask-executor.mjs', import.meta.url).href) as {
      createGovernedAskExecutor: (i: Record<string, unknown>) => (raw: unknown, corr?: unknown) => Promise<unknown>
    }
    const presentLane = await import(new URL('../../tools/ui-family/src/present-executor.mjs', import.meta.url).href) as {
      createGovernedPresentExecutor: (i: Record<string, unknown>) => (raw: unknown, corr?: unknown) => Promise<unknown>
    }
    const sets: Array<{ requestedEffects?: { effects?: Array<Record<string, unknown>>; fingerprint?: string } }> = []
    const pa = async (c: { signal?: { aborted?: boolean } }) => (c.signal?.aborted === true ? { kind: 'allow', cancelled: true } : { kind: 'allow' })
    const base = {
      realmId: REALM,
      policy: policy({ default: 'ask' }),
      decide: () => ({ kind: 'allow' }),
      pa: async (c: unknown) => { sets.push(c as typeof sets[number]); return await pa(c as { signal?: { aborted?: boolean } }) },
    }
    const ask = askLane.createGovernedAskExecutor({ ...base, portRef: () => opts.port ?? fakePort(), timed: opts.timed === true })
    const present = presentLane.createGovernedPresentExecutor({ ...base, rootDir: opts.rootDir === undefined ? ROOT_DIR : opts.rootDir, portRef: () => opts.port ?? fakePort() })
    return { ask, present, sets }
  }

  it('E-1 the ask call REQUESTS exactly tool-invoke(ask_user_question) + domain-ref(user-interaction) — the declared arm is IN the fingerprinted set', async () => {
    const lane = await import(new URL('../../tools/ui-family/src/ui-mechanics.mjs', import.meta.url).href) as {
      USER_INTERACTION_DOMAIN_AUTHORITY: string
      UI_PRESENTATION_DOMAIN_AUTHORITY: string
    }
    const { ask, sets } = await direct()
    const r = await ask({ questions: [Q()] }, { token: { t: 'e1' } })
    expect((r as { kind?: string }).kind).toBe('ok')
    expect(sets).toHaveLength(1)
    // The canonical set sorts its arms (the fingerprint law); pin the
    // MULTISET and every identity, not an insertion order.
    const effects = sets[0]?.requestedEffects?.effects ?? []
    expect(effects.map((e) => e.kind).sort()).toEqual(['domain-ref', 'tool-invoke'])
    expect(effects.find((e) => e.kind === 'tool-invoke')?.toolName).toBe('ask_user_question')
    expect(effects.find((e) => e.kind === 'domain-ref')?.domainAuthorityId).toBe(lane.USER_INTERACTION_DOMAIN_AUTHORITY)
    expect(typeof sets[0]?.requestedEffects?.fingerprint).toBe('string')
  })

  it('E-2 the present call REQUESTS tool-invoke(present) + domain-ref(ui-presentation) + one READ per file at the anchored locator — the read arm is not decorative (the probe pays for it)', async () => {
    const lane = await import(new URL('../../tools/ui-family/src/ui-mechanics.mjs', import.meta.url).href) as {
      UI_PRESENTATION_DOMAIN_AUTHORITY: string
    }
    const { present, sets } = await direct()
    const r = await present({ files: [{ path: join(ROOT_DIR, 'doc.txt') }, { path: join(ROOT_DIR, 'second.txt') }] }, { token: { t: 'e2' } })
    expect((r as { kind?: string }).kind).toBe('ok')
    const effects = sets[0]?.requestedEffects?.effects ?? []
    expect(effects.map((e) => e.kind).sort()).toEqual(['domain-ref', 'read', 'read', 'tool-invoke'])
    expect(effects.find((e) => e.kind === 'tool-invoke')?.toolName).toBe('present')
    expect(effects.find((e) => e.kind === 'domain-ref')?.domainAuthorityId).toBe(lane.UI_PRESENTATION_DOMAIN_AUTHORITY)
    const locators = effects.filter((e) => e.kind === 'read').map((e) => (e.resource as { canonicalLocator?: string }).canonicalLocator).sort()
    expect(locators).toEqual([join(ROOT_DIR, 'doc.txt'), join(ROOT_DIR, 'second.txt')].sort())
  })

  it('E-3 one name, two faces: the identities the executors REQUEST are the constants the contribution DECLARES (drift in either is RED here)', async () => {
    const lane = await import(new URL('../../tools/ui-family/src/index.mjs', import.meta.url).href) as {
      USER_INTERACTION_DOMAIN_AUTHORITY: string
      UI_PRESENTATION_DOMAIN_AUTHORITY: string
      buildUiFamilyContribution: (i: Record<string, unknown>) => { effects: { targets: string[] } }
      buildAskRowDefinition: (i: Record<string, unknown>) => unknown
      buildPresentRowDefinition: (i: Record<string, unknown>) => unknown
    }
    const contribution = lane.buildUiFamilyContribution({
      ask: { definition: lane.buildAskRowDefinition({ askExecutor: async () => ({ kind: 'cancelled' }) }), executorFactory: () => undefined },
      present: { definition: lane.buildPresentRowDefinition({ presentExecutor: async () => ({ kind: 'cancelled' }) }), executorFactory: () => undefined },
      mechanics: {},
      port: {},
      cancelBoundary: 'test',
    })
    expect(contribution.effects.targets).toContain(lane.USER_INTERACTION_DOMAIN_AUTHORITY)
    expect(contribution.effects.targets).toContain(lane.UI_PRESENTATION_DOMAIN_AUTHORITY)
  })
})

// ── Review round 1 (REVIEW-405): the one-fd identity law (F-405-1), the
// host-required receipt turn (F-405-3), the fd-metered size cap.
describe('R — present at the OPEN WINDOW: one-fd identity, receipt turn, fd cap', () => {
  /** A fresh present-executor whose fs OPEN seam fires `swap` exactly once
   *  for `target` — deterministic arrival inside the check→use window that
   *  F-405-1 names (the path was anchored and verified; the object behind
   *  it is being traded at the instant of open). Mocked at BOTH open
   *  faces (node:fs openSync, node:fs/promises open) so the same test is
   *  RED on the check-then-open head and GREEN on the one-fd head. */
  const racePresent = async (target: string, swap: () => void) => {
    const arm = { fired: false }
    vi.resetModules()
    vi.doMock('node:fs', async (importOriginal) => {
      const m = await (importOriginal as unknown as () => Promise<typeof import('node:fs')>)()
      const real = m.openSync
      return { ...m, openSync: ((...args: Parameters<typeof m.openSync>) => {
        if (!arm.fired && args[0] === target) { arm.fired = true; swap() }
        return real(...args)
      }) as typeof m.openSync }
    })
    vi.doMock('node:fs/promises', async (importOriginal) => {
      const m = await (importOriginal as unknown as () => Promise<typeof import('node:fs/promises')>)()
      const realOpen = m.open as unknown as (...a: unknown[]) => Promise<unknown>
      return { ...m, open: async (...args: unknown[]) => {
        if (!arm.fired && args[0] === target) { arm.fired = true; swap() }
        return await realOpen(...args)
      } }
    })
    const lane = await import(new URL('../../tools/ui-family/src/present-executor.mjs', import.meta.url).href) as {
      createGovernedPresentExecutor: (i: Record<string, unknown>) => (raw: unknown, corr?: unknown) => Promise<Record<string, unknown>>
    }
    const presentCalls: unknown[] = []
    const port = { present: async (req: unknown) => { presentCalls.push(req); return { turn: 7 } } }
    const present = lane.createGovernedPresentExecutor({
      realmId: REALM,
      policy: policy({ default: 'ask' }),
      decide: () => ({ kind: 'allow' }),
      pa: async () => ({ kind: 'allow' }),
      rootDir: ROOT_DIR,
      portRef: () => port,
    })
    return { present, presentCalls, arm }
  }

  const cleanupRace = () => {
    vi.doUnmock('node:fs')
    vi.doUnmock('node:fs/promises')
    vi.resetModules()
  }

  /** The same direct executor WITHOUT the fs mock (no race arm needed). */
  const plainPresent = async (presentPort?: { present: (req: unknown) => Promise<unknown> }) => {
    const lane = await import(new URL('../../tools/ui-family/src/present-executor.mjs', import.meta.url).href) as {
      createGovernedPresentExecutor: (i: Record<string, unknown>) => (raw: unknown, corr?: unknown) => Promise<Record<string, unknown>>
    }
    const presentCalls: unknown[] = []
    const port = presentPort ?? { present: async (req: unknown) => { presentCalls.push(req); return { turn: 7 } } }
    const present = lane.createGovernedPresentExecutor({
      realmId: REALM,
      policy: policy({ default: 'ask' }),
      decide: () => ({ kind: 'allow' }),
      pa: async () => ({ kind: 'allow' }),
      rootDir: ROOT_DIR,
      portRef: () => port,
    })
    return { present, presentCalls }
  }

  it('R-1 the final component swapped in the open window (substituted inode) is REFUSED — fstat-vs-snapshot drift binds the fd, never the path (F-405-1a)', async () => {
    const target = join(ROOT_DIR, 'race-final.txt')
    const orig = join(WORLD, 'race-final.orig')
    writeFileSync(target, 'APPROVED-ORIGINAL-IDENTITY\n')
    const { present, presentCalls, arm } = await racePresent(target, () => {
      renameSync(target, orig)
      writeFileSync(target, 'SUBSTITUTED-INODE-9e41-NOT-APPROVED\n')
    })
    try {
      const r = await present({ files: [{ path: target }] }, { token: { t: 'r1' } })
      expect(arm.fired, 'INJECTION SELF-PROOF: the swap fired inside the open window').toBe(true)
      expect(r.kind, 'the substituted inode must never be presented').toBe('refused')
      expect(String(r.code)).toBe('ANCHOR-DRIFT')
      expect(presentCalls).toHaveLength(0)
    } finally {
      if (existsSync(orig)) renameSync(orig, target)
      rmSync(target, { force: true })
      cleanupRace()
    }
  })

  it('R-2 the final component swapped to a SYMLINK to the outside file in the open window is refused; the outside file is never opened (F-405-1a)', async () => {
    const target = join(ROOT_DIR, 'race-link.txt')
    const orig = join(WORLD, 'race-link.orig')
    writeFileSync(target, 'APPROVED-PLAIN-FILE\n')
    const { present, presentCalls, arm } = await racePresent(target, () => {
      renameSync(target, orig)
      symlinkSync(join(OUTSIDE_DIR, 'secret.txt'), target)
    })
    try {
      const r = await present({ files: [{ path: target }] }, { token: { t: 'r2' } })
      expect(arm.fired, 'INJECTION SELF-PROOF: the swap fired inside the open window').toBe(true)
      expect(r.kind).toBe('refused')
      expect(String(r.code)).toBe('NOT_A_FILE')
      expect(presentCalls).toHaveLength(0)
      expect(`${String(r.text ?? '')}${JSON.stringify(presentCalls)}`).not.toContain('OUTSIDE-SECRET-DO-NOT-PUBLISH')
    } finally {
      rmSync(target, { force: true })
      if (existsSync(orig)) renameSync(orig, target)
      rmSync(target, { force: true })
      cleanupRace()
    }
  })

  it('R-3 the PARENT DIRECTORY swapped to a symlink onto the outside dir in the open window is refused — /proc/self/fd containment proves the fd, never the path (F-405-1b)', async () => {
    const sub = join(ROOT_DIR, 'racesub')
    const moved = join(ROOT_DIR, 'racesub-moved')
    rmSync(sub, { recursive: true, force: true })
    rmSync(moved, { recursive: true, force: true })
    mkdirSync(sub, { recursive: true })
    const target = join(sub, 'secret.txt')
    writeFileSync(target, 'INSIDE-LOOKALIKE-NOT-THE-OUTSIDE-FILE\n')
    const { present, presentCalls, arm } = await racePresent(target, () => {
      renameSync(sub, moved)
      symlinkSync(OUTSIDE_DIR, sub)
    })
    try {
      const r = await present({ files: [{ path: target }] }, { token: { t: 'r3' } })
      expect(arm.fired, 'INJECTION SELF-PROOF: the parent swap fired inside the open window').toBe(true)
      expect(r.kind, 'the parent swap must NOT deliver the outside file through an in-root-looking path').toBe('refused')
      expect(String(r.code)).toBe('ANCHOR-ESCAPE')
      expect(presentCalls).toHaveLength(0)
      expect(`${String(r.text ?? '')}${JSON.stringify(presentCalls)}`).not.toContain('OUTSIDE-SECRET-DO-NOT-PUBLISH')
    } finally {
      rmSync(sub, { force: true }) // the symlink itself
      mkdirSync(sub, { recursive: true })
      if (existsSync(join(moved, 'secret.txt'))) renameSync(join(moved, 'secret.txt'), target)
      cleanupRace()
    }
  })

  it('R-4 a receipt WITHOUT the host-required turn is a typed refusal — publication without correlation identity is not success (F-405-3; host packages/deliverables/tool-present/src/index.ts:61 requires integer turn; :79 refuses an unopened turn)', async () => {
    const port = { present: async () => ({ /* no turn — a mount that lost the correlation fact */ }) }
    const { present } = await plainPresent(port)
    const r = await present({ files: [{ path: join(ROOT_DIR, 'doc.txt') }] }, { token: { t: 'r4' } })
    expect(r.kind, 'the governed face never silently accepts a turn-less publication').toBe('refused')
    expect(String((r as { code?: string }).code)).toBe('UI_PRESENT_RECEIPT_INVALID')
    expect((r as { sideEffectPossible?: boolean }).sideEffectPossible, 'the mount may already have displayed — the refusal says so').toBe(true)
  })

  it('R-5 the size cap is enforced ON THE VERIFIED FD (cap+1 metering): one byte over refuses FILE_TOO_LARGE, at the cap passes — metered bytes are discarded, never disclosed', async () => {
    const MAX = 1024 * 1024 // the governed read cap (fs-mechanics MAX_READ_BYTES)
    const over = join(ROOT_DIR, 'race-over.bin')
    const at = join(ROOT_DIR, 'race-at.bin')
    writeFileSync(over, Buffer.alloc(MAX + 1, 0x61))
    writeFileSync(at, Buffer.alloc(MAX, 0x62))
    try {
      const { present } = await plainPresent()
      const r = await present({ files: [{ path: over }] }, { token: { t: 'r5a' } })
      expect(r.kind).toBe('refused')
      expect(String((r as { code?: string }).code)).toBe('FILE_TOO_LARGE')
      const ok = await present({ files: [{ path: at }] }, { token: { t: 'r5b' } })
      expect(ok.kind).toBe('ok')
    } finally {
      rmSync(over, { force: true })
      rmSync(at, { force: true })
    }
  })
})
