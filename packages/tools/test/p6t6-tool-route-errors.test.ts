/**
 * p6t6-tool-route-errors.test.ts — ROUND 123: the ROUTE-LEVEL arm for the
 * `POST /__p6t6/tool` error mapping that round 122 added to the harness row
 * (`packages/tools/harness/plugin.mjs:377`) and disclosed as unarmed.
 *
 * WHAT ROUND 122 ADDED, AND WHY IT NEEDS A ROUTE-LEVEL ARM. A seam refusal
 * (`A5SF_*`) used to fall into the generic 500, where it was indistinguishable
 * from "the tool threw". Round 122 mapped every `A5SF_*` code explicitly — 400
 * for `A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED` (a CALLER error: the wrong shape
 * was handed to the one-call entry) and 500 for every other `A5SF_*` (a
 * COMPOSITION error: no executor, no dispatch contract, no settlement). The
 * round-122 controls drove the BINDER (`createAgentBindings().executeTool`),
 * not this HTTP mapping, so a regression in the status choice would have gone
 * unnoticed. These arms drive the ROUTE ITSELF: one real `apply()` over a
 * scratch `DSH_HOME` and the repo's hostile-seam doubles (`makeCtx` /
 * `makeWebServer` / `Req`+`Res`), with `teamRoot.live.executeTool` replying per
 * scenario — the route's own contract, nothing below it.
 *
 * WHAT IS ASSERTED, AND WHY EACH ARM IS FALSIFIABLE
 *
 *   R1  shape refusal (`A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED`) ⇒ **400** and the
 *       typed code in the body. Dropping the explicit branch (or mapping it to
 *       500) re-reds it.
 *   R2a/R2b non-shape `A5SF_*` (`A5SF_TOOL_EXECUTOR_UNAVAILABLE`,
 *       `A5SF_TOOL_EXECUTOR_RESULT_MISSING`) ⇒ **500** with the typed code, and
 *       NOT 400. Collapsing every `A5SF_*` to 400 re-reds both.
 *   R3a/R3b a successful governed call ⇒ **200** and the `{isError, value,
 *       error, content}` settlement is carried THROUGH the mapping unchanged
 *       (`isError:false` ⇒ `{ok:true, value}`; `isError:true` ⇒
 *       `{ok:false, error:{message, info}}`). Changing the envelope re-reds it.
 *   R4a an UNTYPED error (no `code`) ⇒ **500** with NO `code` in the body — it
 *       can never be presented as a 400 caller error.
 *   R4b a non-`A5SF_*` typed code (`TOOLS_EXECUTE`) ⇒ **500** with no `A5SF_*`
 *       code echoed; the A5SF branch is not a catch-all.
 *   R4c an `A5SF_`-PREFIXED lookalike (`…_UNSUPPORTED_EXTRA`) ⇒ **500**, proving
 *       the 400 is selected by EXACT code equality, not by a widened prefix.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous): every
 * async scenario runs at MODULE level (top-level await) and captures its
 * results; the `it` bodies are pure synchronous assertions. That is the
 * hostile-seam suite's own pattern (`h3-hostile-seam.test.ts`), reused here
 * because the row is a plain `.mjs` with module-level boot state.
 */
import { describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

// The row under test (a plain .mjs harness row — no TS, no loader):
// @ts-expect-error TS7016 — the harness row is an untyped plain .mjs loaded at runtime by the cordis row loader; no declaration file exists (DEC-1 pin, same rationale as h3-hostile-seam.test.ts).
const plugin = await import('../harness/plugin.mjs')

// ── the hostile-seam doubles (h3 pattern) ─────────────────────────────────

interface Res {
  statusCode: number
  payload: string
  body: Record<string, unknown> | null
}

function makeResWithApi(): { api: object, res: Res } {
  const res: Res = { statusCode: 0, payload: '', body: null }
  const api = {
    writeHead: (status: number) => { res.statusCode = status },
    end: (payload?: string) => {
      res.payload += payload ?? ''
      try {
        res.body = res.payload === '' ? null : (JSON.parse(res.payload) as Record<string, unknown>)
      } catch {
        res.body = null
      }
    },
  }
  return { api, res }
}

function makeReq(method: string, body: string): object {
  // Buffer chunk — a real http.IncomingMessage emits Buffers (the row's
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
  return {
    routes,
    register(
      spec: { kind: string, path: string, handler: (req: object, res: object) => void | Promise<void> },
      label: string,
    ) {
      routes.push({ path: spec.path, label, handler: spec.handler })
      return () => {
        const i = routes.findIndex((r) => r.path === spec.path)
        if (i >= 0) routes.splice(i, 1)
      }
    },
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

/** The typed refusal shape the product's seam raises (`A5sfToolExecutorSeamError`). */
function seamError(code: string, detail: string): Error {
  const error = new Error(`tool-executor-mount: ${code}: ${detail}`)
  error.name = 'A5sfToolExecutorSeamError'
  ;(error as unknown as { code: string }).code = code
  return error
}

/**
 * A `teamRoot` whose ONLY live behaviour is `executeTool`: each `body.name`
 * selects one scenario, so every arm drives the SAME registered route and only
 * the outcome below it changes.
 */
function makeToolRouteTeamRoot() {
  return {
    ready: Promise.resolve() as Promise<void>,
    live: {
      listLiveSessions: () => ['r123-route-root'],
      executeTool: async (as: string, request: { name: string, args?: unknown, callId?: string }) => {
        switch (request.name) {
          case 'shape-refusal':
            throw seamError(
              'A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED',
              'expected the SINGLE-CALL shape { callId, name, arguments, agent, signal } but received a BATCH (`calls` is present)',
            )
          case 'no-executor':
            throw seamError('A5SF_TOOL_EXECUTOR_UNAVAILABLE', 'no tool executor is selected for this member scope')
          case 'no-result':
            throw seamError('A5SF_TOOL_EXECUTOR_RESULT_MISSING', 'the host executor returned no result for this call')
          case 'ok':
            return {
              isError: false,
              value: { echoed: request.args, callId: request.callId },
              error: undefined,
              content: [{ type: 'text', text: 'governed result' }],
            }
          case 'tool-error':
            return {
              isError: true,
              value: undefined,
              error: { message: `denied by lane for '${as}'`, info: { lane: 'fs.read', decision: 'deny' } },
              content: [],
            }
          case 'untyped':
            throw new Error('the tool body threw, with no typed code at all')
          case 'other-code': {
            const error = new Error('the host tools pipeline failed')
            ;(error as unknown as { code: string }).code = 'TOOLS_EXECUTE'
            throw error
          }
          case 'prefix-lookalike':
            // A5SF_-PREFIXED but NOT the shape refusal: must stay a 500.
            throw seamError('A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED_EXTRA', 'a code this route does not single out')
          default:
            throw new Error(`unknown scenario ${request.name}`)
        }
      },
      close: async () => undefined,
    },
    tools: { tools: [] },
    domain: { repositories: {} },
    control: { listControlState: async () => ({ requests: [], decisions: [], consumptions: [] }) },
    activity: { listActivityFacts: () => [] },
    messaging: { recoverPendingDeliveries: async () => ({ pending: [] }) },
    config: { rootSessionId: 'r123-route-root', mcpServer: null },
  }
}

// ── one real apply() over a scratch DSH_HOME ──────────────────────────────

const scratch = mkdtempSync(join(tmpdir(), 'r123-tool-route-'))
const savedHome = process.env.DSH_HOME
process.env.DSH_HOME = scratch
writeFileSync(
  join(scratch, 'p6t6-directive.json'),
  JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: join(scratch, 'reports'),
    rootSessionId: 'r123-route-root',
    runStamp: 'r123',
  }),
)

const settle = () => new Promise<void>((r) => setTimeout(r, 0))

/** Wall-clock guard: a never-settling handler FAILS the file instead of hanging the worker. */
const HANDLER_TIMEOUT_MS = 5000
async function post(route: RegisteredRoute, method: string, body: string): Promise<Res> {
  const { api, res } = makeResWithApi()
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`r123 tool-route: handler for ${route.path} ${method} did not settle within ${HANDLER_TIMEOUT_MS}ms`)),
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

const webServer = makeWebServer()
const ctx = makeCtx({ webServer, teamRoot: makeToolRouteTeamRoot() })
await plugin.apply(ctx)
await settle()

const toolRoute = webServer.routes.find((r) => r.path === '/__p6t6/tool')
const routeWasRegistered = toolRoute !== undefined

const callTool = async (name: string, args: Record<string, unknown> = {}, callId?: string): Promise<Res> => {
  if (toolRoute === undefined) throw new Error('/__p6t6/tool was not registered')
  return post(toolRoute, 'POST', JSON.stringify({ name, as: 'r123-route-root', args, ...(callId === undefined ? {} : { callId }) }))
}

const shapeRefusal = routeWasRegistered ? await callTool('shape-refusal') : null
const noExecutor = routeWasRegistered ? await callTool('no-executor') : null
const noResult = routeWasRegistered ? await callTool('no-result') : null
const okCall = routeWasRegistered ? await callTool('ok', { marker: 'unchanged' }, 'r123-call-1') : null
const toolError = routeWasRegistered ? await callTool('tool-error') : null
const untyped = routeWasRegistered ? await callTool('untyped') : null
const otherCode = routeWasRegistered ? await callTool('other-code') : null
const lookalike = routeWasRegistered ? await callTool('prefix-lookalike') : null

// the row-stop backstop, then restore the environment + clean the scratch
for (const stop of ctx.effectDisposers) stop()
if (savedHome === undefined) delete process.env.DSH_HOME
else process.env.DSH_HOME = savedHome
rmSync(scratch, { recursive: true, force: true })

// ── assertions ────────────────────────────────────────────────────────────

describe('round 123 — POST /__p6t6/tool maps the typed A5SF_* failures to the right HTTP status', () => {
  it('registers the tool route on the success route set', () => {
    expect(routeWasRegistered).toBe(true)
    expect(toolRoute?.path).toBe('/__p6t6/tool')
    expect(toolRoute?.label).toBe('p6t6 tool route')
  })

  it('R1: A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED is a 400 with the typed code in the body', () => {
    expect(shapeRefusal?.statusCode).toBe(400)
    expect(shapeRefusal?.body?.code).toBe('A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED')
    // The message is carried verbatim, so an operator sees the expected shape.
    expect(String(shapeRefusal?.body?.error ?? '')).toContain('SINGLE-CALL')
  })

  it('R2a: a non-shape A5SF_* failure (no executor) is a 500 with the typed code, never a 400', () => {
    expect(noExecutor?.statusCode).toBe(500)
    expect(noExecutor?.statusCode).not.toBe(400)
    expect(noExecutor?.body?.code).toBe('A5SF_TOOL_EXECUTOR_UNAVAILABLE')
  })

  it('R2b: a second non-shape A5SF_* failure (no settlement) is also a 500 with its code', () => {
    expect(noResult?.statusCode).toBe(500)
    expect(noResult?.body?.code).toBe('A5SF_TOOL_EXECUTOR_RESULT_MISSING')
  })

  it('R3a: a successful governed call is a 200 and the settlement value is carried through unchanged', () => {
    expect(okCall?.statusCode).toBe(200)
    // The route maps `isError:false` to `{ok:true, value}` and does NOT rebuild
    // the value: the caller receives exactly what the governed call settled on.
    expect(okCall?.body).toEqual({ ok: true, value: { echoed: { marker: 'unchanged' }, callId: 'r123-call-1' } })
    expect('error' in (okCall?.body ?? {})).toBe(false)
  })

  it('R3b: an isError settlement is a 200 `{ok:false}` and its error envelope is unchanged', () => {
    expect(toolError?.statusCode).toBe(200)
    expect(toolError?.body).toEqual({
      ok: false,
      error: { message: "denied by lane for 'r123-route-root'", info: { lane: 'fs.read', decision: 'deny' } },
    })
    // An isError settlement is NOT an HTTP failure: the call ran and refused.
    expect(toolError?.statusCode).not.toBe(500)
  })

  it('R4a (negative): an UNTYPED error is a 500 with NO typed code — it cannot be presented as a 400', () => {
    expect(untyped?.statusCode).toBe(500)
    expect(untyped?.statusCode).not.toBe(400)
    expect('code' in (untyped?.body ?? {})).toBe(false)
  })

  it('R4b (negative): a non-A5SF_* code is a 500 that echoes no A5SF_* code', () => {
    expect(otherCode?.statusCode).toBe(500)
    expect(otherCode?.statusCode).not.toBe(400)
    expect(String(otherCode?.body?.code ?? '')).not.toMatch(/^A5SF_/)
  })

  it('R4c (negative): the 400 is EXACT-code equality — an A5SF_-prefixed lookalike stays a 500', () => {
    expect(lookalike?.statusCode).toBe(500)
    expect(lookalike?.statusCode).not.toBe(400)
    expect(lookalike?.body?.code).toBe('A5SF_TOOL_DISPATCH_SHAPE_UNSUPPORTED_EXTRA')
  })
})
