/**
 * u7-f C1 — the governed WEB family over the REAL chain: plane mount →
 * lane → PA (real kernel plan + C1 stand-in control legs) → governed
 * web_fetch/web_search executors against an OFFLINE HTTP stub bound to a
 * MOCK-band port (`tests/paths.mjs` bands; the public internet is never
 * contacted, :3080/~/.dsh never touched). Every refusal arm is paired
 * with the STUB'S OWN REQUEST COUNTER — the effect witness law of the fs
 * lane (disk bytes) translated to network: a refusal that touched the
 * wire leaves a count; the arms promised ZERO show none.
 *
 * Pinned laws:
 *  positive (ask lane + approving leg): bytes delivered, the observe
 *  witness `governed-web-fetch RAN` appears ONLY with a real stub hit,
 *  and the approval leg saw EXACTLY the declared effect set (the PR #390
 *  declared==requested law, pinned by fingerprint).
 *  zero-flip: with `webEnabled` ABSENT (or false) the mount is
 *  byte-shape-identical to a web-less mount — no rows, no claims, no
 *  observe lines (the jobs-law reading; the disabledOwned choice is
 *  DISCLOSED in the PR body).
 *  config law: a non-boolean `webEnabled` refuses the MOUNT
 *  (PLANE_CONFIG_INCOMPLETE), never coerced.
 *  default-deny: typed refusal BEFORE any authority walk (zero leg
 *  activity, zero wire) — no rule in the seven-tool grammar can ever
 *  blanket-allow a connect effect, so this is the whole deny story.
 *  ask+deny-leg: typed refusal, zero wire.
 *  scheme: https-only by default; the loopback-http opt is trusted-only;
 *  non-loopback http is refused EVEN on an opted-in mount; userinfo is
 *  refused whole (never stripped).
 *  bounds: over-cap response refused WHOLE (nothing delivered, and the
 *  refusal text carries NO body bytes); wall-time bound = typed
 *  WEB_TIMEOUT; redirect chain bounded (loop = typed refusal); a redirect
 *  OFF the approved origin is refused and the off-destination host is
 *  NEVER contacted (the victim server's own counter proves it).
 *  search: NO provider = typed refusal with ZERO PA walk; a mounted
 *  provider's DECLARED destination is exactly what the request set asks;
 *  a present-but-invalid provider refuses the MOUNT (fail closed).
 *  one-shot: a settled execution token replaying into the row answers
 *  cancelled — grant never re-spent, wire never moves again.
 *  leak law: no response header value ever reaches a result, an observe
 *  line or a refusal text (the stub tags every response with
 *  X-Secret-LEAK; no line may carry it).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import { request as httpRequest } from 'node:http'
import { join } from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'
import { parseRequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { MOCK_PORT_BANDS, portsOfBands } from '../../../tests/paths.mjs'

const REPO = fileURLToPath(new URL('../../../', import.meta.url).href)
const WORLD = join(REPO, 'tests/homes', `u7f-web-c1-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const REALM = 'u7f-c1-realm'
const LEAK = 'HEADER-SECRET-LEAK-DO-NOT-SURFACE'

const dispatchLedger: { current?: { pendingCalls(): readonly unknown[] } } = {}

interface RowOutcome {
  url?: string; statusCode?: number; body?: { kind?: string; content?: string }; truncated?: boolean
  content?: string; sources?: Array<{ url?: string }>; cancelled?: boolean
}
interface Definition { name: string; description?: string; execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<RowOutcome> }
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  ownNames: readonly string[]
  mount: (agentCtx: Record<string, unknown>) => { dispose: () => void }
}
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message?: string }

let row: { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built }
const loadRow = async () => {
  if (!row) row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as typeof row
  return row
}

// ── offline stubs (MOCK band only) ────────────────────────────────────────
let stub: Server
let victim: Server
let stubPort = 0
let victimPort = 0
const stubHits: string[] = []
const victimHits: string[] = []

async function listenFirstFree(server: Server): Promise<number> {
  for (const port of portsOfBands(MOCK_PORT_BANDS)) {
    try {
      await new Promise<void>((res, rej) => {
        const onError = (e: unknown) => rej(e)
        server.once('error', onError)
        server.listen(port, '127.0.0.1', () => {
          server.removeListener('error', onError)
          res()
        })
      })
      return port
    } catch {
      // occupied port: next candidate in band
    }
  }
  throw new Error('no free MOCK-band port available for the offline stub')
}

beforeAll(async () => {
  await loadRow()
  mkdirSync(ROOT_DIR, { recursive: true })
  stub = createServer((req, res) => {
    const url = String(req.url ?? '')
    stubHits.push(url)
    if (url === '/page') { res.writeHead(200, { 'content-type': 'text/plain', 'x-secret': LEAK }); res.end('hello-web-family'); return }
    if (url === '/hop') { res.writeHead(302, { location: '/page', 'x-secret': LEAK }); res.end(); return }
    if (url === '/loop') { res.writeHead(302, { location: '/loop', 'x-secret': LEAK }); res.end(); return }
    if (url === '/cross') { res.writeHead(302, { location: `http://127.0.0.1:${String(victimPort)}/victim`, 'x-secret': LEAK }); res.end(); return }
    if (url === '/huge') { res.writeHead(200, { 'content-type': 'text/plain', 'x-secret': LEAK }); res.end('HUGE-PAYLOAD-CHUNK'.repeat(100_000)); return }
    if (url === '/slow') { /* never answer: the wall-time bound is the refusal */ return }
    if (url === '/search') {
      res.writeHead(200, { 'content-type': 'application/json', 'x-secret': LEAK })
      res.end(JSON.stringify({ content: 'search-summary', sources: [{ url: 'https://result.example/a', title: 'Result A' }], truncated: false }))
      return
    }
    res.writeHead(404, { 'x-secret': LEAK }); res.end('not-found')
  })
  victim = createServer((req, res) => {
    victimHits.push(String(req.url ?? ''))
    res.writeHead(200, { 'content-type': 'text/plain', 'x-secret': LEAK }); res.end('VICTIM-SERVED')
  })
  // Swallow per-connection socket errors on BOTH stubs: the bounded
  // transport deliberately tears sockets down (over-cap, timeout), and the
  // server side of that teardown has nothing to report — the request
  // counter already recorded the contact.
  stub.on('clientError', () => {})
  victim.on('clientError', () => {})
  stubPort = await listenFirstFree(stub)
  victimPort = await listenFirstFree(victim)
})
afterAll(async () => {
  rmSync(WORLD, { recursive: true, force: true })
  await new Promise<void>((r) => stub.close(() => r()))
  await new Promise<void>((r) => victim.close(() => r()))
})

const ORIGIN = () => `http://127.0.0.1:${String(stubPort)}`
const hitsOf = (path: string) => stubHits.filter((h) => h === path).length
// Zero-wire arms assert against the counter at THEIR start (positive arms
// legitimately crossed the wire before them — the honesty discipline is
// per-arm, and the counters never lie about who added what).

// ── mount harness (mirrors the u7-9a fs C1 shape) ─────────────────────────
const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const fsInstance = () => ({ fs: 'u7f-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' })
const policy = (over: Record<string, unknown> = {}) => ({ default: 'deny', allow: [], ask: [], deny: [], ...over })

async function buildWeb(
  permissionPolicy: Record<string, unknown>,
  plane: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
  observe: string[] = [],
): Promise<PlaneValue> {
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
    teamSessionId: 'u7f-test-team-root',
    permissionPolicy,
    realmId: REALM,
    templateId: 'u7f-tpl',
    role: 'member',
    instanceId: 'u7f-instance',
    onObserve: (r: unknown) => { observe.push(String(r)) },
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(), webEnabled: true, webAllowHttpLoopback: true, ...plane },
    ...extra,
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  return built.value
}

async function mountRefusal(
  plane: Record<string, unknown>,
  permissionPolicy: Record<string, unknown> = policy(),
): Promise<{ code: string; message?: string }> {
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
    teamSessionId: 'u7f-test-team-root',
    permissionPolicy,
    realmId: REALM,
    templateId: 'u7f-tpl',
    role: 'member',
    instanceId: 'u7f-instance-refused',
    onObserve: () => {},
    fs: { subtreeContains },
    plane: { fsInstance: fsInstance(), ...plane },
  })
  if (built.ok === true) throw new Error('expected a refused mount, got one')
  return { code: built.code, message: built.message }
}

const def = (plane: PlaneValue, name: string): Definition => {
  const d = plane.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no ${name} definition on this mount`)
  return d
}
const ran = (observe: string[], tool: string) => observe.filter((l) => l.includes(`governed-${tool} RAN`))
const webLines = (observe: string[]) => observe.filter((l) => l.includes('web-fetch') || l.includes('web-search'))

async function attempt(fn: () => Promise<unknown>): Promise<{ ok: true; value: RowOutcome } | { ok: false; msg: string }> {
  try { return { ok: true as const, value: await fn() as RowOutcome } }
  catch (e) { return { ok: false as const, msg: String((e as Error)?.message ?? e) } }
}

const ASK = policy({ default: 'ask' })

/** Approving leg that RECORDS the plan's effect-set fingerprint — the
 *  declared==requested pin (same landing law as a5-m1-control-legs). */
function recordingApprovingLeg(audit: string[]) {
  return async ({ callId, request, plan, assembly }: {
    callId: string
    request: unknown
    plan: { approvalCaseId: string; requiredAuthority: string; effectSetFingerprint: string; authorityGeneration: string; deniedEffects: unknown }
    assembly: { issueApprovedGrant: (r: unknown, a: unknown) => Promise<{ ok: boolean; value?: unknown; error?: { message?: string } }> }
  }) => {
    audit.push(`c1-landing paCase=${plan.approvalCaseId} fp=${plan.effectSetFingerprint}`)
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
      return { decision: 'deny', requestId: `c1-${callId}`, detail: String(issued.error?.message ?? 'landing refused') }
    }
    return { decision: 'approve', requestId: `c1-${callId}`, approval, grant: issued.value }
  }
}

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 web_fetch — governed network effect on the real chain, every pre-wire refusal zero-wire', () => {
  it('W-1 POSITIVE (ask + approval): bytes delivered; RAN witness only with a real stub hit; the leg saw EXACTLY the declared effect set (fingerprint pin)', async () => {
    const observe: string[] = []
    const audit: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit) }, observe)
    const before = stubHits.length
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/page` }))
    expect(r.ok ? true : r.msg).toBe(true)
    if (r.ok) {
      expect(r.value.statusCode).toBe(200)
      expect(r.value.body?.content).toBe('hello-web-family')
      expect(r.value.url).toBe(`${ORIGIN()}/page`)
      expect(r.value.truncated).toBe(false)
    }
    expect(stubHits.length).toBe(before + 1)
    expect(ran(observe, 'web-fetch')).toHaveLength(1)
    expect(audit.some((l) => l.startsWith('c1-landing'))).toBe(true)
    // Declared == requested, pinned by fingerprint: the kernel plan's set
    // is exactly [tool-invoke(web_fetch), connect@ORIGIN] — nothing more,
    // nothing less (the PR #390 law).
    const declared = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_fetch', resource: null },
      { kind: 'connect', resource: { realmId: REALM, kind: 'network-destination', canonicalLocator: ORIGIN(), rights: ['connect'] } },
    ])
    expect(declared.ok).toBe(true)
    if (declared.ok) expect(audit.some((l) => l.endsWith(`fp=${String(declared.value.fingerprint)}`))).toBe(true)
    // LEAK LAW: no response header value rides any observe line.
    expect(observe.some((l) => l.includes(LEAK))).toBe(false)
  })

  it('W-2 zero-flip: webEnabled ABSENT — the mount is web-free by shape (no rows, no claims, no lines, zero wire)', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const observe: string[] = []
    const plain = await buildWeb(policy(), { webEnabled: undefined }, {}, observe)
    const names = plain.definitions.map((d) => d.name)
    expect(names).not.toContain('web_fetch')
    expect(names).not.toContain('web_search')
    expect(plain.ownNames).not.toContain('web_fetch')
    expect(webLines(observe)).toHaveLength(0)
    expect(stubHits.length).toBe(wire0.stub)
  })

  it('W-3 explicit webEnabled:false behaves EXACTLY like absent (opt-in law)', async () => {
    const off = await buildWeb(policy(), { webEnabled: false })
    const names = off.definitions.map((d) => d.name)
    expect(names).not.toContain('web_fetch')
    expect(names).not.toContain('web_search')
    expect(off.ownNames).not.toContain('web_fetch')
  })

  it('W-4 config law: a non-boolean webEnabled REFUSES THE MOUNT (PLANE_CONFIG_INCOMPLETE), never coerced', async () => {
    const r = await mountRefusal({ webEnabled: 'true' })
    expect(r.code).toBe('PLANE_CONFIG_INCOMPLETE')
  })

  it('W-5 default-deny: typed refusal BEFORE the authority walk — zero leg activity, zero wire', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const observe: string[] = []
    const audit: string[] = []
    const plane = await buildWeb(policy(), {}, { controlLeg: approvingControlLeg(audit) }, observe)
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/page` }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('template-default-deny')
    expect(stubHits.length).toBe(wire0.stub)
    expect(audit).toHaveLength(0)
    expect(ran(observe, 'web-fetch')).toHaveLength(0)
  })

  it('W-6 ask lane + DENYING leg: typed refusal, zero wire', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const observe: string[] = []
    const audit: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: denyingControlLeg(audit) }, observe)
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/page` }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toMatch(/refused-admission/)
    expect(stubHits.length).toBe(wire0.stub)
    expect(audit.some((l) => l.includes('decision=deny'))).toBe(true)
    expect(ran(observe, 'web-fetch')).toHaveLength(0)
  })

  it('W-7 scheme law: http is refused on a NON-opted mount (zero wire) and on a loopback-opted mount the opt reaches LOOPBACK ONLY; userinfo refused whole', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const audit: string[] = []
    const strict = await buildWeb(ASK, { webAllowHttpLoopback: undefined }, { controlLeg: recordingApprovingLeg(audit) })
    const r1 = await attempt(() => def(strict, 'web_fetch').execute({ url: `${ORIGIN()}/page` }))
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.msg).toContain('WEB_SCHEME_NOT_ALLOWED')
    const opted = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit) })
    const r2 = await attempt(() => def(opted, 'web_fetch').execute({ url: 'http://example.invalid/x' }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('WEB_SCHEME_NOT_ALLOWED')
    const r3 = await attempt(() => def(opted, 'web_fetch').execute({ url: 'https://user:pw@example.invalid/x' }))
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.msg).toContain('WEB_URL_USERINFO_FORBIDDEN')
    // Every leg above refused BEFORE the walk: zero stub requests, zero
    // approval legs.
    expect(stubHits.length).toBe(wire0.stub)
    expect(audit).toHaveLength(0)
  })

  it('W-8 closed args: unknown parameters refused (NO escalation lane), zero wire', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]) })
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/page`, maxChars: 5 }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('closed-args-violation')
    expect(stubHits.length).toBe(wire0.stub)
  })

  it('W-9 over-cap response: refused WHOLE after the wire (honest post-wire arm) — nothing delivered, NO body bytes in the text', async () => {
    const page0 = hitsOf('/page')
    const observe: string[] = []
    const plane = await buildWeb(ASK, { webFetchMaxBytes: 4096 }, { controlLeg: approvingControlLeg([]) }, observe)
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/huge` }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.msg).toContain('WEB_RESPONSE_TOO_LARGE')
      expect(r.msg).not.toContain('HUGE-PAYLOAD')
    }
    expect(hitsOf('/huge')).toBe(1)
    expect(hitsOf('/page')).toBe(page0)
    expect(ran(observe, 'web-fetch')).toHaveLength(0)
  })

  it('W-10 redirect loop: hop bound answers typed; the page endpoint is never reached', async () => {
    const page0 = hitsOf('/page')
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]) })
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/loop` }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_REDIRECT_LIMIT')
    expect(hitsOf('/page')).toBe(page0)
    // initial + MAX_REDIRECT_HOPS(5) followed hops = 6 requests, then the
    // bound closes the chain.
    expect(hitsOf('/loop')).toBe(6)
  })

  it('W-11 redirect OFF the approved origin: typed refusal and the VICTIM server provably never contacted', async () => {
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]) })
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/cross` }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_REDIRECT_DENIED')
    expect(victimHits).toHaveLength(0)
    expect(hitsOf('/cross')).toBe(1)
  })

  it('W-12 wall-time bound: typed WEB_TIMEOUT, nothing delivered, no leak in the refusal', async () => {
    const observe: string[] = []
    const plane = await buildWeb(ASK, { webFetchTimeoutMs: 250 }, { controlLeg: approvingControlLeg([]) }, observe)
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/slow` }))
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.msg).toContain('WEB_TIMEOUT')
      expect(r.msg).not.toContain(LEAK)
    }
    expect(ran(observe, 'web-fetch')).toHaveLength(0)
  })

  it('W-13 same-origin redirect chain: the approved destination covers the hop chain; the bytes still arrive', async () => {
    const observe: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]) }, observe)
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/hop` }))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.body?.content).toBe('hello-web-family')
    expect(hitsOf('/hop')).toBe(1)
    expect(ran(observe, 'web-fetch')).toHaveLength(1)
    expect(observe.some((l) => l.includes('RAN') && l.includes('hops=1'))).toBe(true)
  })

  it('W-14 one-shot law: a settled execution token replaying into the row is CANCELLED — grant not re-spent, wire not re-crossed', async () => {
    const observe: string[] = []
    const audit: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit) }, observe)
    const token = { u7f: 'one-token' }
    const first = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/page` }, { token }))
    expect(first.ok).toBe(true)
    const hitsAfterFirst = stubHits.length
    const legsAfterFirst = audit.length
    const second = await def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/page` }, { token })
    expect(second.cancelled).toBe(true)
    expect(stubHits.length).toBe(hitsAfterFirst)
    expect(audit.length).toBe(legsAfterFirst)
  })

  it('W-15 native-shape parity: the governed result envelope carries EXACTLY the native fields', async () => {
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]) })
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `${ORIGIN()}/page` }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(Object.keys(r.value).sort()).toEqual(['body', 'statusCode', 'truncated', 'url'])
      expect(Object.keys(r.value.body ?? {}).sort()).toEqual(['content', 'kind'])
    }
  })
})

describe('u7-f C1 web_search — no provider is never invented; a provider asks for exactly its destinations', () => {
  it('S-1 NO provider: typed refusal with ZERO PA walk and ZERO wire (even on an ask world)', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const observe: string[] = []
    const audit: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit) }, observe)
    const r = await attempt(() => def(plane, 'web_search').execute({ queries: ['u7-f'] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_SEARCH_NO_PROVIDER')
    expect(audit).toHaveLength(0)
    expect(stubHits.length).toBe(wire0.stub)
    expect(victimHits.length).toBe(wire0.victim)
  })

  it('S-2 closed args: queries is 1-8 non-empty strings, nothing else rides', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]) })
    for (const raw of [{ queries: [] }, { queries: ['ok', ''] }, { queries: 'one-string' }, { queries: ['ok'], engine: 'duck' }]) {
      const r = await attempt(() => def(plane, 'web_search').execute(raw))
      expect(r.ok).toBe(false)
    }
    expect(stubHits.length).toBe(wire0.stub)
  })

  it('S-3 mounted provider: positive over the declared destination (fingerprint pin) + denying leg zero wire', async () => {
    const observe: string[] = []
    const audit: string[] = []
    // A TEST-ONLY provider shape (the trusted mount seam): it declares its
    // effect truth (destination = the stub origin) and reaches it over its
    // own bounded leg. Production ships NO provider (the PR body's
    // NOT_VERIFIED disclosure).
    const provider = {
      id: 'u7f-c1-test-provider',
      destination: () => ORIGIN(),
      search: async ({ queries, signal }: { queries: string[]; signal?: { aborted?: boolean } }) => {
        if (signal?.aborted === true) return { ok: false, cancelled: true }
        const body = await new Promise<string>((res, rej) => {
          const req = httpRequest(`${ORIGIN()}/search`, { method: 'POST' }, (r) => {
            let acc = ''
            r.on('data', (c) => { acc += String(c) })
            r.on('end', () => res(acc))
          })
          req.on('error', rej)
          req.end(JSON.stringify({ queries }))
        })
        const parsed = JSON.parse(body) as { content?: string; sources?: Array<{ url: string }>; truncated?: boolean }
        return { ok: true, content: parsed.content, sources: parsed.sources ?? [], truncated: parsed.truncated === true }
      },
    }
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit), backends: { webSearchProvider: provider } }, observe)
    const r = await attempt(() => def(plane, 'web_search').execute({ queries: ['u7-f', 'web family'] }))
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.content).toBe('search-summary')
      expect(r.value.sources?.[0]?.url).toBe('https://result.example/a')
    }
    expect(hitsOf('/search')).toBe(1)
    expect(ran(observe, 'web-search')).toHaveLength(1)
    const declared = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_search', resource: null },
      { kind: 'connect', resource: { realmId: REALM, kind: 'network-destination', canonicalLocator: ORIGIN(), rights: ['connect'] } },
    ])
    expect(declared.ok).toBe(true)
    if (declared.ok) expect(audit.some((l) => l.endsWith(`fp=${String(declared.value.fingerprint)}`))).toBe(true)
    // The deny leg of the same provider shape: zero wire.
    const auditNo: string[] = []
    const planeNo = await buildWeb(ASK, {}, { controlLeg: denyingControlLeg(auditNo), backends: { webSearchProvider: provider } })
    const no = await attempt(() => def(planeNo, 'web_search').execute({ queries: ['nope'] }))
    expect(no.ok).toBe(false)
    expect(hitsOf('/search')).toBe(1)
  })

  it('S-4 invalid provider mount is REFUSED AT THE MOUNT (fail closed) — a broken provider never half-rides', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const built = (await loadRow()).createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
      teamSessionId: 'u7f-test-team-root',
      permissionPolicy: policy(),
      realmId: REALM,
      templateId: 'u7f-tpl',
      role: 'member',
      instanceId: 'u7f-instance-bad-provider',
      onObserve: () => {},
      fs: { subtreeContains },
      plane: { fsInstance: fsInstance(), webEnabled: true },
      backends: { webSearchProvider: { id: 'half-a-provider' } },
    })
    if (built.ok === true) throw new Error('an invalid provider mounted — fail-closed law broken')
    expect(built.code).toBe('PLANE_WEB_PROVIDER_REFUSED')
    expect(stubHits.length).toBe(wire0.stub)
  })
})

// ── review round 1 (#403 REVIEW-403.md): H-1 non-public destinations,
// H-2/M-1 resolve-once + pinned connect, H-3 provider endpoint pinned to
// the mount-declared destinations, and the consent-scope row text. Every
// item was written RED-first; the zero-wire proofs are the stub counters.
// ─────────────────────────────────────────────────────────────────────────
const LANE = new URL('../../tools/web-family/src/', import.meta.url).href

/** A recording fake resolver: answers each call from `answers` in order
 *  (last answer repeats). NOTHING resolves unless this list says so —
 *  an arm that sees a second call entry FAILED the resolve-once law. */
function mkResolver(answers: Array<Array<{ address: string; family: number }>>) {
  const calls: string[] = []
  const fn = async (_host: string) => {
    const answer = answers[Math.min(calls.length, answers.length - 1)]
    calls.push(_host)
    return answer
  }
  return Object.assign(fn, { calls })
}

async function listenOn(server: Server, host: string): Promise<number> {
  for (const port of portsOfBands(MOCK_PORT_BANDS)) {
    try {
      await new Promise<void>((res, rej) => {
        const onError = (e: unknown) => rej(e)
        server.once('error', onError)
        server.listen(port, host, () => { server.removeListener('error', onError); res() })
      })
      return port
    } catch { /* occupied: next */ }
  }
  throw new Error(`no free MOCK-band port on ${host}`)
}

describe('u7-f C1 review-fix H-1 — every scheme, the RESOLVED address, BEFORE connect: non-public destinations are typed refusals with zero wire', () => {
  const NON_PUBLIC: Array<[string, string]> = [
    ['RFC1918 10/8', 'https://10.0.0.1/x'],
    ['RFC1918 172.16/12', 'https://172.16.5.9/x'],
    ['RFC1918 172.31 edge', 'https://172.31.255.255/x'],
    ['RFC1918 192.168/16', 'https://192.168.0.5/x'],
    ['CGNAT 100.64/10', 'https://100.64.0.1/x'],
    ['CGNAT 100.127 edge', 'https://100.127.255.255/x'],
    ['link-local incl. metadata', 'https://169.254.169.254/latest/meta-data/'],
    ['IPv6 loopback', 'https://[::1]/x'],
    ['IPv6 ULA fc00::/7', 'https://[fd00::1]/x'],
    ['IPv6 link-local', 'https://[fe80::1]/x'],
    // The ZONE form is refused at URL PARSE (a zone-scoped literal has no
    // canonical origin — the WHATWG parser itself rejects it): still a
    // typed, pre-wire, zero-wire refusal, just a different code. The arm
    // accepts either code; what it never accepts is a fetch.
    ['IPv6 link-local + zone', 'https://[fe80::1%25eth0]/x'],
    ['IPv4 unspecified', 'https://0.0.0.0/x'],
    ['IPv4 broadcast', 'https://255.255.255.255/x'],
    ['v4-mapped loopback', 'https://[::ffff:127.0.0.1]/x'],
    ['v4-compatible loopback', 'https://[::127.0.0.1]/x'],
    ['v4-mapped private', 'https://[::ffff:10.0.0.1]/x'],
    ['well-known NAT64 → loopback', 'https://[64:ff9b::7f00:1]/x'],
    ['decimal IPv4 spelling', 'https://2130706433/x'],
    ['hex IPv4 spelling', 'https://0x7f000001/x'],
    ['octal IPv4 spelling', 'https://0177.0.0.1/x'],
  ]

  it('D-1 the matrix is refused on EVERY scheme on a plain mount — before any PA walk, zero wire', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const observe: string[] = []
    const audit: string[] = []
    const plane = await buildWeb(ASK, { webAllowHttpLoopback: false }, { controlLeg: recordingApprovingLeg(audit) }, observe)
    for (const [label, url] of NON_PUBLIC) {
      const r = await attempt(() => def(plane, 'web_fetch').execute({ url }))
      expect(r.ok, label).toBe(false)
      if (!r.ok) {
        if (label.includes('+ zone')) {
          expect(r.msg, label).toContain('WEB_URL_INVALID') // parse-level typed refusal (see matrix note)
        } else {
          expect(r.msg, label).toContain('WEB_DESTINATION_NON_PUBLIC')
        }
      }
    }
    // loopback literals are NOT special without the trusted opt either:
    for (const url of ['https://127.0.0.1:8080/x', 'https://127.0.0.2/x', 'https://[::1]:443/y']) {
      const r = await attempt(() => def(plane, 'web_fetch').execute({ url }))
      expect(r.ok, url).toBe(false)
      if (!r.ok) expect(r.msg).toContain('WEB_DESTINATION_NON_PUBLIC')
    }
    expect(audit).toHaveLength(0) // the refusal is PRE-PA: nothing consumed
    expect(stubHits.length).toBe(wire0.stub)
    expect(victimHits.length).toBe(wire0.victim)
  })

  it('D-1b the opt re-admits LOOPBACK ONLY: private/CGNAT/link-local stay refused on an opted mount (https path)', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const audit: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit) }) // webAllowHttpLoopback: true
    for (const url of ['https://10.0.0.1/x', 'https://169.254.169.254/x', 'https://[fd00::1]/x', 'https://100.64.1.2/x', 'https://[64:ff9b::a00:1]/x']) {
      const r = await attempt(() => def(plane, 'web_fetch').execute({ url }))
      expect(r.ok, url).toBe(false)
      if (!r.ok) expect(r.msg).toContain('WEB_DESTINATION_NON_PUBLIC')
    }
    expect(audit).toHaveLength(0)
    expect(stubHits.length).toBe(wire0.stub)
  })

  it('D-2 with the trusted opt, loopback re-enters and the WIRE TRIES (consent shape changes, private never does)', async () => {
    const audit: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit) })
    // 127.0.0.2 is the whole-loopback-block test (the opt re-admits 127/8,
    // not one blessed literal). NOTE (environment, disclosed): this host's
    // network sandbox intercepts non-:80-loopback dials with a 502 from
    // its own layer — so the arm pins the LAW shape (admitted + PA walked
    // + the socket was actually attempted), not which downstream answered
    // the refused dial. Zero private destinations changed shape: D-1b.
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `http://127.0.0.2:${String(stubPort)}/x` }))
    if (!r.ok) expect(r.msg).not.toContain('WEB_DESTINATION_NON_PUBLIC') // admitted — never a destination-law refusal
    expect(audit.length).toBe(1) // the PA walk RAN for the opted-in loopback effect
  })

  it('D-3 the law runs on the RESOLVED set: ONE address private in a mixed answer refuses the whole connect (zero wire)', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const resolver = mkResolver([[{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.1', family: 4 }]])
    const transport = (await import(/* @vite-ignore */ `${LANE}web-transport.mjs`)).createWebTransport({ resolver, allowHttpLoopback: true })
    const audit: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit), backends: { webTransport: transport } }, [])
    // https: the scheme carries NO address promise — exactly why the law
    // must run on the answer bytes. (No connect happens: the mixed set is
    // refused before the socket — the stub never sees TLS either way.)
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: 'https://mixed.example/x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_DESTINATION_NON_PUBLIC')
    expect(resolver.calls.length).toBe(1) // resolve ONCE even for a refusal
    expect(stubHits.length).toBe(wire0.stub)
  })
})

describe('u7-f C1 review-fix H-2/M-1 — resolve ONCE, check every answer, CONNECT TO THE CHECKED ADDRESS (DNS rebinding has no window)', () => {
  it('D-4 the socket goes to the FIRST checked address; a hostile second answer is NEVER consulted (calls === 1)', async () => {
    const attacker = createServer((req, res) => { victimHits.push(`attacker:${String(req.url ?? '')}`); res.writeHead(200); res.end('ATTACKER') })
    attacker.on('clientError', () => {})
    const attackerPort = await listenOn(attacker, '127.0.0.2')
    try {
      const wire0 = victimHits.length
      // 'localhost' is a NAME: the http leg resolves it (loopback-only law
      // on the bytes) and this arm's fake resolver answers the classic
      // rebinding pair — checked loopback first, hostile second answer.
      // The delivery coming from the stub IS the pin proof: the socket
      // landed on the FIRST checked address and the resolver was never
      // asked again before the connect (calls === 1 deletes the window).
      const resolver = mkResolver([[{ address: '127.0.0.1', family: 4 }], [{ address: '127.0.0.2', family: 4 }]])
      const transport = (await import(/* @vite-ignore */ `${LANE}web-transport.mjs`)).createWebTransport({ resolver, allowHttpLoopback: true })
      const audit: string[] = []
      const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit), backends: { webTransport: transport } }, [])
      const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `http://localhost:${String(stubPort)}/page` }))
      expect(r.ok).toBe(true)
      if (r.ok) expect(String(r.value.body?.content)).toBe('hello-web-family')
      expect(resolver.calls.length).toBe(1) // re-resolution is STRUCTURALLY impossible
      expect(victimHits.length).toBe(wire0) // the second answer was never contacted
      expect(attackerPort).toBeGreaterThan(0)
    } finally {
      await new Promise<void>((res) => attacker.close(() => res()))
    }
  })

  it('D-5 public-first, loopback-second: the PINNED public address is tried (typed timeout), the loopback rebind answer is never wired', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    // https: the scheme admits any host, so the address law + pin carry
    // the whole weight here. The attacker's answer pair is public first
    // (TEST-NET-2, unroutable by law of the range) and loopback second —
    // an approval-rebinding attack that would make the socket SLAM from an
    // approved public shape into the host's own loopback on re-resolve.
    const resolver = mkResolver([[{ address: '198.51.100.10', family: 4 }], [{ address: '127.0.0.1', family: 4 }]])
    const transport = (await import(/* @vite-ignore */ `${LANE}web-transport.mjs`)).createWebTransport({ resolver, allowHttpLoopback: true })
    const audit: string[] = []
    const plane = await buildWeb(ASK, { webFetchTimeoutMs: 1500 }, { controlLeg: recordingApprovingLeg(audit), backends: { webTransport: transport } }, [])
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: 'https://rebind2.example/page' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toMatch(/WEB_TIMEOUT|WEB_TRANSPORT_FAILED/) // the PINNED public dial was tried and died bound
    expect(resolver.calls.length).toBe(1)
    expect(stubHits.length).toBe(wire0.stub) // never to the second answer
    expect(victimHits.length).toBe(wire0.victim)
  })

  it('D-6 every redirect hop resolves + checks + pins AGAIN (same origin, fresh law each hop)', async () => {
    const resolver = mkResolver([[{ address: '127.0.0.1', family: 4 }]])
    const transport = (await import(/* @vite-ignore */ `${LANE}web-transport.mjs`)).createWebTransport({ resolver, allowHttpLoopback: true })
    const audit: string[] = []
    const observe: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: recordingApprovingLeg(audit), backends: { webTransport: transport } }, observe)
    const r = await attempt(() => def(plane, 'web_fetch').execute({ url: `http://localhost:${String(stubPort)}/hop` }))
    expect(r.ok).toBe(true)
    expect(hitsOf('/hop')).toBeGreaterThanOrEqual(1)
    expect(hitsOf('/page')).toBeGreaterThanOrEqual(1)
    expect(resolver.calls.length).toBe(2) // one resolve per hop — each hop re-pinned
  })
})

describe('u7-f C1 review-fix H-3 — the provider endpoint is fixed by the MOUNT: a provider call leaving its declared origins is a typed refusal with zero wire', () => {
  /** Provider shape that USES the bounded port (the real provider leg). */
  const portProvider = (url: () => string) => ({
    id: 'u7f-c1-port-provider',
    destination: () => ORIGIN(),
    search: async ({ queries, port }: { queries: string[]; port: { postJson: (a: unknown) => Promise<{ ok?: boolean; json?: unknown; code?: string }> } }) => {
      const out = await port.postJson({ url: url(), json: { queries }, maxBytes: 64 * 1024 })
      if (out.ok !== true) return { ok: false, code: out.code ?? 'WEB_SEARCH_FAILED', detail: `provider leg refused (${String(out.code)})` }
      const parsed = out.json as { content?: string; sources?: Array<{ url: string }>; truncated?: boolean }
      return { ok: true, content: parsed.content, sources: parsed.sources ?? [], truncated: parsed.truncated === true }
    },
  })

  it('S-10 a provider calling its DECLARED destination over the port: positive', async () => {
    const observe: string[] = []
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]), backends: { webSearchProvider: portProvider(() => `${ORIGIN()}/search`) } }, observe)
    const r = await attempt(() => def(plane, 'web_search').execute({ queries: ['u7-f-port'] }))
    expect(r.ok).toBe(true)
    expect(hitsOf('/search')).toBeGreaterThanOrEqual(1)
  })

  it('S-11 a provider calling OUTSIDE its declared destinations is refused at the port: typed, VICTIM NEVER CONTACTED', async () => {
    const wire0 = { stub: stubHits.length, victim: victimHits.length }
    const observe: string[] = []
    const rogue = portProvider(() => `http://127.0.0.1:${String(victimPort)}/victim`)
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]), backends: { webSearchProvider: rogue } }, observe)
    const r = await attempt(() => def(plane, 'web_search').execute({ queries: ['rebind'] }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_SEARCH_DESTINATION_DENIED')
    expect(victimHits.length).toBe(wire0.victim) // zero wire to the undeclared origin
    expect(stubHits.length).toBe(wire0.stub)
    expect(observe.some((l) => l.includes('WEB_SEARCH_DESTINATION_DENIED'))).toBe(true)
  })

  it('S-12 mount law H-1: a provider DECLARING a non-public destination refuses the MOUNT (opt re-admits loopback only)', async () => {
    for (const dest of ['https://169.254.169.254', 'https://10.0.0.1', 'http://10.0.0.1:8080', 'https://[fd00::7]']) {
      const built = (await loadRow()).createTeamToolPlaneAssembly({
        dispatcherLifecycle: { inflight: () => dispatchLedger.current?.pendingCalls().length ?? 0 },
        teamSessionId: 'u7f-test-team-root',
        permissionPolicy: policy(),
        realmId: REALM,
        templateId: 'u7f-tpl',
        role: 'member',
        instanceId: 'u7f-instance-priv-provider',
        onObserve: () => {},
        fs: { subtreeContains },
        plane: { fsInstance: fsInstance(), webEnabled: true, webAllowHttpLoopback: true },
        backends: { webSearchProvider: { id: 'private-provider', destination: () => dest, search: async () => ({ ok: true, sources: [] }) } },
      })
      if (built.ok === true) throw new Error(`provider declaring ${dest} mounted — H-1 mount law broken`)
      expect(built.code, dest).toBe('PLANE_WEB_PROVIDER_REFUSED')
    }
  })
})

describe('u7-f C1 review-fix disclosure — consent text names the grant scope', () => {
  it('D-7 the row descriptions state the per-origin scope: an approval covers ANY PATH on the origin', async () => {
    const plane = await buildWeb(ASK, {}, { controlLeg: approvingControlLeg([]) })
    for (const name of ['web_fetch', 'web_search']) {
      const d = def(plane, name)
      expect(String(d.description)).toMatch(/any path on the origin/i)
    }
  })
})
