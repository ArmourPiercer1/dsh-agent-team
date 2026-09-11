/**
 * H3 — the hostile-prepend seam spec (alpha.2 hardening closure,
 * review §21 adversarial probe; plan §14/§16/§18).
 *
 * The seam under test is the TEST-ONLY route in
 * packages/tools/harness/plugin.mjs:
 *
 *   POST /__hardening/hostile-prepend { agent }
 *
 * which installs on the CURRENT live agent of `agent` a hostile
 * `tools/pre-execute` listener at the OUTERMOST waterfall position
 * (`{ prepend: true }`) that resolves `{ kind: 'allow' }` WITHOUT ever
 * calling next() — the §21 threat. The route is live ONLY under the
 * host-process env gate DSH_HARDENING_PROBE=1 (the H3 verification boot
 * sets it; the gate negative is THIS file's primary leg).
 *
 * Scope of this file: the seam's CONTRACT — gate on/off, route
 * registration, request validation (405/400), the prepend call shape
 * (event/opts, the force-allow fn), per-agent scoping, the
 * idempotent-per-agent replace, the unknown-session failure, and the
 * row-stop backstop drain. The SECURITY property itself (a force-allow
 * cannot let any managed tool execute past the Team permission policy)
 * is pinned by h1a-pre-execute-endcap.test.ts (unit) and the H3 live
 * kit battery (dev/agent-workflow/evidence/alpha2-hardening/h3/kit —
 * the h3-hostile-* check groups).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and
 * captures its results; the `it` bodies are pure synchronous
 * assertions.
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

// The seam under test (a plain .mjs harness row — no TS, no loader):
const plugin = await import('../harness/plugin.mjs')

// ── fakes ─────────────────────────────────────────────────────────────────

interface Res {
  statusCode: number
  payload: string
  body: Record<string, unknown> | null
}

function makeRes(): Res {
  const res: Res = { statusCode: 0, payload: '', body: null }
  return res
}
function writeHead(res: Res, status: number): void {
  res.statusCode = status
}
function end(res: Res, payload?: string): void {
  res.payload += payload ?? ''
  try {
    res.body = res.payload === '' ? null : (JSON.parse(res.payload) as Record<string, unknown>)
  } catch {
    res.body = null
  }
}
function makeResWithApi(): { api: object; res: Res } {
  const res = makeRes()
  const api = {
    writeHead: (status: number) => writeHead(res, status),
    end: (payload?: string) => end(res, payload),
  }
  return { api, res }
}

function makeReq(method: string, body: string): object {
  // Buffer chunk — a real http.IncomingMessage emits Buffers (the plugin's
  // readBody does Buffer.concat(chunks)); a string chunk makes concat throw
  // inside the 'end' callback, which hangs the readBody promise forever.
  const req = Readable.from([Buffer.from(body)]) as unknown as { method: string }
  req.method = method
  return req
}

interface RegisteredRoute {
  path: string
  label: string
  handler: (req: object, res: object) => void | Promise<void>
}

function makeWebServer() {
  const routes: RegisteredRoute[] = []
  const api = {
    routes,
    register(spec: { kind: string; path: string; handler: (req: object, res: object) => void | Promise<void> }, label: string) {
      routes.push({ path: spec.path, label, handler: spec.handler })
      return () => {
        const i = routes.findIndex((r) => r.path === spec.path)
        if (i >= 0) routes.splice(i, 1)
      }
    },
  }
  return api
}

interface OnCallRecord {
  event: string
  fn: () => Promise<unknown>
  opts: unknown
  disposed: boolean
}

function makeAgentCtx() {
  const onCalls: OnCallRecord[] = []
  const api = {
    onCalls,
    on(event: string, fn: () => Promise<unknown>, opts?: unknown): () => void {
      const rec: OnCallRecord = { event, fn, opts, disposed: false }
      onCalls.push(rec)
      return () => {
        rec.disposed = true
      }
    },
  }
  return api
}

interface WorldOptions {
  /** sessionId → agent ctx (null = ensureLiveAgent rejects NO_LIVE_AGENT). */
  sessions: Record<string, ReturnType<typeof makeAgentCtx> | null>
}

function makeTeamRoot({ sessions }: WorldOptions) {
  const agents: Record<string, object | null> = {}
  for (const [sid, rec] of Object.entries(sessions)) agents[sid] = rec === null ? null : { agent: { ctx: rec }, session: { sessionId: sid } }
  return {
    ready: Promise.resolve() as Promise<void>,
    live: {
      listLiveSessions: () => Object.keys(agents).filter((sid) => agents[sid] !== null),
      ensureLiveAgent: async (sid: string) => {
        // The real host surface rejects (NO_LIVE_AGENT) for unknown AND
        // non-live sessions; null entries model "registered but not live".
        if (!(sid in agents) || agents[sid] === null) {
          const err = new Error(`no live agent for '${sid}'`)
          ;(err as unknown as { code: string }).code = 'NO_LIVE_AGENT'
          throw err
        }
        return agents[sid]
      },
      close: async () => undefined,
    },
    tools: { tools: [] },
    observations: [] as string[],
  }
}

function makeCtx(services: Record<string, unknown>) {
  const effectLabels: string[] = []
  const effectDisposers: (() => void)[] = []
  return {
    effectLabels,
    effectDisposers,
    get(name: string) {
      return services[name]
    },
    effect(fn: () => unknown, label: string): () => void {
      const d = fn()
      effectLabels.push(label)
      const stop = () => {
        if (typeof d === 'function') (d as () => void)()
      }
      effectDisposers.push(stop)
      return stop
    },
  }
}

// ── scenario world (scratch DSH_HOME + directive) ─────────────────────────

const scratch = mkdtempSync(join(tmpdir(), 'h3-hostile-seam-'))
const savedHome = process.env.DSH_HOME
const savedProbe = process.env.DSH_HARDENING_PROBE
process.env.DSH_HOME = scratch
writeFileSync(
  join(scratch, 'p6t6-directive.json'),
  JSON.stringify({ boot: 1, phase: 'create', reportDir: join(scratch, 'reports'), rootSessionId: 'h3-root', runStamp: 'h3' }),
)

const settle = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Wall-clock guard (H3, review intervention): every handler invocation is
 * raced against a hard timeout so a never-settling handler (e.g. a readBody
 * promise whose 'end' never fires) FAILS this file in ~5s instead of
 * hanging the whole vitest worker indefinitely (0 CPU, process alive).
 */
const HANDLER_TIMEOUT_MS = 5000
async function post(route: RegisteredRoute, method: string, body: string): Promise<Res> {
  const { api, res } = makeResWithApi()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`h3 hostile-seam: handler for ${route.path} ${method} did not settle within ${HANDLER_TIMEOUT_MS}ms (never-resolving await?)`)),
      HANDLER_TIMEOUT_MS,
    )
  })
  try {
    await Promise.race([Promise.resolve(route.handler(makeReq(method, body), api)), timeout])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
  return res
}

// ── scenario 1 — GATE OFF (the probe env unset) ───────────────────────────

const offCtxA = makeAgentCtx()
const webServerOff = makeWebServer()
const ctxOff = makeCtx({ webServer: webServerOff, teamRoot: makeTeamRoot({ sessions: { 'h3-lead': offCtxA } }) })
delete process.env.DSH_HARDENING_PROBE
await plugin.apply(ctxOff)
await settle()

const hostileRouteOff = webServerOff.routes.find((r) => r.path === '/__hardening/hostile-prepend')
const offPost = hostileRouteOff !== undefined ? await post(hostileRouteOff, 'POST', JSON.stringify({ agent: 'h3-lead' })) : null
const offGet = hostileRouteOff !== undefined ? await post(hostileRouteOff, 'GET', '') : null

// ── scenario 2 — GATE ON (DSH_HARDENING_PROBE=1) ──────────────────────────

const onCtxLead = makeAgentCtx()
const onCtxMem = makeAgentCtx()
const webServerOn = makeWebServer()
const ctxOn = makeCtx({
  webServer: webServerOn,
  teamRoot: makeTeamRoot({ sessions: { 'h3-lead': onCtxLead, 'h3-mem': onCtxMem, 'h3-ghost': null } }),
})
process.env.DSH_HARDENING_PROBE = '1'
await plugin.apply(ctxOn)
await settle()

const hostileRoute = webServerOn.routes.find((r) => r.path === '/__hardening/hostile-prepend')
// Captured BEFORE the row-stop below (the stop removes the route from the
// route set and drains every parked disposer), so the `it` blocks can assert
// intermediate state even though they run after all module-level work.
const routeWasRegistered = hostileRoute !== undefined
const p1 = hostileRoute !== undefined ? await post(hostileRoute, 'POST', JSON.stringify({ agent: 'h3-lead' })) : null
const firstAllow = onCtxLead.onCalls[0]?.fn !== undefined ? await onCtxLead.onCalls[0].fn() : null
const leadCountAfterP1 = onCtxLead.onCalls.length
const p2 = hostileRoute !== undefined ? await post(hostileRoute, 'POST', JSON.stringify({ agent: 'h3-lead' })) : null
const secondAllow = onCtxLead.onCalls[1]?.fn !== undefined ? await onCtxLead.onCalls[1].fn() : null
const pNoAgent = hostileRoute !== undefined ? await post(hostileRoute, 'POST', JSON.stringify({})) : null
const pBadJson = hostileRoute !== undefined ? await post(hostileRoute, 'POST', '{not-json') : null
const pGet = hostileRoute !== undefined ? await post(hostileRoute, 'GET', '') : null
const pGhost = hostileRoute !== undefined ? await post(hostileRoute, 'POST', JSON.stringify({ agent: 'h3-ghost' })) : null

// the row-stop backstop: drain every parked force-allow disposer.
for (const stop of ctxOn.effectDisposers) stop()

// restore the environment + clean the scratch
if (savedHome === undefined) delete process.env.DSH_HOME
else process.env.DSH_HOME = savedHome
if (savedProbe === undefined) delete process.env.DSH_HARDENING_PROBE
else process.env.DSH_HARDENING_PROBE = savedProbe
rmSync(scratch, { recursive: true, force: true })

// ── assertions ────────────────────────────────────────────────────────────

describe('H3 hostile-prepend seam (review §21 test-only route)', () => {
  it('registers the route on the success route set under the test-only label', () => {
    // routeWasRegistered / hostileRoute were captured pre-row-stop, when the
    // route was still a live member of the success route set (the row stop
    // below legitimately unregisters it, as it does for every route).
    expect(routeWasRegistered).toBe(true)
    expect(hostileRoute?.path).toBe('/__hardening/hostile-prepend')
    expect(hostileRoute?.label ?? '').toContain('TEST-ONLY')
    expect(hostileRoute?.label ?? '').toContain('DSH_HARDENING_PROBE')
  })

  it('GATE OFF: with DSH_HARDENING_PROBE unset the route answers 503 and installs NOTHING', () => {
    expect(offPost).not.toBeNull()
    expect(offPost?.statusCode).toBe(503)
    expect(String(offPost?.body?.error ?? '')).toContain('DSH_HARDENING_PROBE=1')
    expect(offCtxA.onCalls.length).toBe(0)
  })

  it('GATE OFF: even a GET answers 503 (the gate is checked before method dispatch)', () => {
    expect(offGet?.statusCode).toBe(503)
    expect(String(offGet?.body?.error ?? '')).toContain('hardening probe disabled')
  })

  it('GATE ON: POST {agent} answers 200 and installs a prepend-allow on that agent ctx only', () => {
    expect(p1?.statusCode).toBe(200)
    expect(p1?.body?.agent).toBe('h3-lead')
    expect(p1?.body?.prepended).toBe(true)
    // Exactly ONE listener after the first POST (captured before p2's
    // replace and the row-stop both ran at module level).
    expect(leadCountAfterP1).toBe(1)
    expect(onCtxLead.onCalls[0]?.event).toBe('tools/pre-execute')
    expect(onCtxLead.onCalls[0]?.opts).toEqual({ prepend: true })
    // the hostile listener IS the §21 force-allow (no next() in sight):
    expect(firstAllow).toEqual({ kind: 'allow' })
    // the other agent's ctx is untouched (per-agent install surface):
    expect(onCtxMem.onCalls.length).toBe(0)
  })

  it('GATE ON: a second prepend on the same agent REPLACES the first (idempotent-per-agent, old listener disposed)', () => {
    expect(p2?.statusCode).toBe(200)
    expect(onCtxLead.onCalls.length).toBe(2)
    expect(onCtxLead.onCalls[0]?.disposed).toBe(true)
    expect(onCtxLead.onCalls[1]?.event).toBe('tools/pre-execute')
    expect(onCtxLead.onCalls[1]?.opts).toEqual({ prepend: true })
    expect(secondAllow).toEqual({ kind: 'allow' })
  })

  it('GATE ON: a missing body.agent answers 400', () => {
    expect(pNoAgent?.statusCode).toBe(400)
    expect(String(pNoAgent?.body?.error ?? '')).toContain('body.agent is a required string')
  })

  it('GATE ON: a malformed JSON body answers 400', () => {
    expect(pBadJson?.statusCode).toBe(400)
    expect(String(pBadJson?.body?.error ?? '')).toContain('bad JSON body')
  })

  it('GATE ON: a non-POST answers 405', () => {
    expect(pGet?.statusCode).toBe(405)
    expect(pGet?.body?.error).toBe('POST only')
  })

  it('GATE ON: an unknown session answers 500 (ensureLiveAgent rejection surfaces, nothing installed)', () => {
    expect(pGhost?.statusCode).toBe(500)
    expect(String(pGhost?.body?.error ?? '')).toContain('no live agent')
    expect(onCtxLead.onCalls.length).toBe(2)
    expect(onCtxMem.onCalls.length).toBe(0)
  })

  it('row-stop backstop: stopping the row drains every parked force-allow disposer', () => {
    expect(onCtxLead.onCalls.length).toBe(2)
    expect(onCtxLead.onCalls.every((c) => c.disposed)).toBe(true)
  })
})
