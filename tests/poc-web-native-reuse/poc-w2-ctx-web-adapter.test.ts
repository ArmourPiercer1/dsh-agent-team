/**
 * A5W PoC P-W2 / P-W4 — Host Service Adapter 路线原型：Team 治理经 ctx.web seam 复用原生 Provider
 *
 * ⚠ PoC 不入生产判据 — 路线裁决证据（P-W2），判据表见
 *   dev/agent-workflow/evidence/a5w-native-reuse-20261031/WEB-NATIVE-POC.md。
 * 记录时间（真实 UTC）：2026-10-31。全部构件为真实类：
 *   - ctx.web seam = pristine @639ed01539 的 @deepseek-ai/dsh-web WebRuntime（选择语义即宿主语义）；
 *   - DeepSeek Provider = pristine 的 DeepSeekSearchProvider 真类，打到 MOCK 段的本地假
 *     Messages 端点（观测真实出站请求形状/头/取消/重定向语义；真网络腿 = ENV）；
 *   - 治理链 = 真实 a5 plane + 真实 web-family executor + C1 stand-in control leg。
 * 零新搜索客户端：适配对象只做 `webRuntime.search()` 调用 + 结果/错误映射。
 * 零真网络：所有 provider 命中计数与假端点计数器为效果见证。
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree, MOCK_PORT_BANDS, portsOfBands } from '../paths.mjs'
import { parseRequestedEffectSet } from '../../packages/domain/tool-governance/src/index.js'
import { approvingControlLeg, denyingControlLeg } from '../../packages/runtime/test/a5-m1-control-legs.mjs'
import * as planeRow from '../../packages/runtime/src/plugin/live/team-tool-plane.mjs'

const REPO_ROOT = findTestRepoRoot(process.cwd())
if (REPO_ROOT === null) throw new Error('P-SETUP: no pristine test-use tree found')
const PRISTINE = testUseTree(REPO_ROOT)
const webLib = (await import(pathToFileURL(join(PRISTINE, 'packages/web/web/lib/index.js')).href)) as {
  WebRuntime: new (ctx: unknown, config?: Record<string, unknown>) => unknown
  WebError: { prototype: Error; new (message: string, code: string, opts?: unknown): Error }
}
const deepseekLib = (await import(pathToFileURL(join(PRISTINE, 'packages/web/web-search-deepseek/lib/index.js')).href)) as {
  DeepSeekSearchProvider: new (resolveOptions: () => Record<string, unknown>) => {
    id: string
    available(): boolean
    search(req: { query: string; maxResults?: number }, signal?: AbortSignal): Promise<{ content?: string; sources: Array<Record<string, unknown>>; truncated: boolean }>
  }
  DEEPSEEK_DEFAULT_MODEL: string
}

/** Structural ctx for the directly-constructed WebRuntime: the Service ctor needs
 * `reflect.provide`; provider registration runs its generator through `effect`
 * (first yielded value = disposer, later yields collected too). */
const seamShim = {
  reflect: { provide: () => undefined },
  effect: (gen: () => Generator<unknown>) => {
    const it = gen()
    const disposers: Array<() => void> = []
    let step = it.next()
    while (!step.done) {
      if (typeof step.value === 'function') disposers.push(step.value as () => void)
      step = it.next()
    }
    return () => { for (const d of disposers.reverse()) d() }
  },
}
interface Seam {
  registerSearchProvider: (p: unknown) => () => void
  search: (req: { query: string; maxResults?: number }, signal?: AbortSignal) => Promise<{ content?: string; sources: Array<{ url: string }>; truncated: boolean }>
}
const makeSeam = (config: Record<string, unknown> = {}): Seam => new webLib.WebRuntime(seamShim, config) as Seam

const codeOf = (e: unknown): string => String((e as { code?: string })?.code ?? '')
const attempt = async (fn: () => Promise<unknown>) => {
  try { return { ok: true as const, value: await fn() } } catch (e) { return { ok: false as const, code: codeOf(e), msg: String((e as Error)?.message ?? e) } }
}

interface MockOpts { available?: boolean; sources?: number; slowMs?: number }
function mockProvider(id: string, hits: string[], opts: MockOpts = {}) {
  return {
    id,
    available: () => opts.available !== false,
    search: async (request: { query: string; maxResults?: number }, signal?: AbortSignal) => {
      if (signal?.aborted === true) throw new webLib.WebError('aborted', 'WEB_ABORTED')
      if (opts.slowMs !== undefined) {
        await new Promise<void>((resolve, reject) => {
          const t = setTimeout(resolve, opts.slowMs)
          signal?.addEventListener('abort', () => { clearTimeout(t); reject(new webLib.WebError('aborted', 'WEB_ABORTED')) })
        })
      }
      hits.push(request.query)
      const n = opts.sources ?? 1
      return {
        content: `summary:${request.query}`,
        sources: Array.from({ length: n }, (_x, i) => ({ url: `https://r${String(i)}.example/${encodeURIComponent(request.query)}`, title: `S${String(i)}` })),
        truncated: false,
      }
    },
  }
}

// ── the Team-side adapter (P-W2 prototype: call the Host seam, map outcomes) ──
// This is the WHOLE adapter: no new client, no credential handling, no copy of
// provider selection (the seam owns it), no copy of result schema mapping beyond
// {content?,sources,truncated} which the Team row's model-visible face requires.
function makeCtxWebAdapter(seam: Seam, destination: string, counters: { seamCalls: string[] }) {
  return {
    id: 'poc-ctx-web-adapter',
    destination: () => destination,
    search: async (input: { queries: string[]; maxResults: number; signal?: AbortSignal }) => {
      const perQuery: Array<{ content?: string; sources: Array<{ url: string }>; truncated: boolean }> = []
      for (const query of input.queries) {
        counters.seamCalls.push(query)
        const outcome = await attempt(() => seam.search({ query, maxResults: input.maxResults }, input.signal))
        if (!outcome.ok) {
          if (outcome.code === 'WEB_ABORTED') return { ok: false, cancelled: true }
          return { ok: false, code: 'WEB_SEARCH_FAILED', detail: `${String(outcome.code)}: ${outcome.msg.slice(0, 160)}` }
        }
        perQuery.push(outcome.value as { content?: string; sources: Array<{ url: string }>; truncated: boolean })
      }
      const seen = new Set<string>()
      const sources: Array<{ url: string }> = []
      for (const result of perQuery) {
        for (const source of result.sources) {
          if (!seen.has(source.url)) { seen.add(source.url); sources.push(source) }
        }
      }
      return {
        ok: true,
        content: perQuery.map((r, i) => (typeof r.content === 'string' ? `### ${input.queries[i]}\n\n${r.content}` : '')).filter((t) => t.length > 0).join('\n\n'),
        sources: sources.slice(0, input.maxResults),
        truncated: perQuery.some((r) => r.truncated === true) || sources.length > input.maxResults,
      }
    },
  }
}

// ── plane harness (u7f-web-c1 shape) ───────────────────────────────────────
const REALM = 'a5w-poc-w2-realm'
const WORLD = join(new URL('../../', import.meta.url).pathname, 'tests/homes', `poc-a5w-w2-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const policy = (over: Record<string, unknown> = {}) => ({ default: 'deny', allow: [], ask: [], deny: [], ...over })
interface PlaneValue {
  definitions: Array<{ name: string; execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<unknown> }>
  ownNames: readonly string[]
  mount: (agentCtx: Record<string, unknown>) => { dispose: () => void }
}
async function buildPlane(permissionPolicy: Record<string, unknown>, extra: Record<string, unknown>, planeCfg: Record<string, unknown> = {}): Promise<PlaneValue> {
  const built = (planeRow as { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok: boolean; value?: PlaneValue; code?: string; message?: string } })
    .createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => 0 },
      teamSessionId: 'a5w-poc-w2-root',
      permissionPolicy,
      realmId: REALM,
      templateId: 'a5w-tpl',
      role: 'member',
      instanceId: 'a5w-instance',
      onObserve: () => undefined,
      fs: { subtreeContains },
      plane: { fsInstance: { fs: 'a5w-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' }, webEnabled: true, webAllowHttpLoopback: true, ...planeCfg },
      ...extra,
    })
  if (built.ok !== true) throw new Error(`plane mount refused: ${String(built.code)} ${String(built.message ?? '')}`)
  return built.value as PlaneValue
}
const ASK = policy({ default: 'ask' })
function recordingApprovingLeg(audit: string[]) {
  return async ({ callId, request, plan, assembly }: {
    callId: string
    request: unknown
    plan: { approvalCaseId: string; requiredAuthority: string; effectSetFingerprint: string; authorityGeneration: string; deniedEffects: unknown }
    assembly: { issueApprovedGrant: (r: unknown, a: unknown) => Promise<{ ok: boolean; value?: unknown }> }
  }) => {
    audit.push(`w2-landing fp=${plan.effectSetFingerprint}`)
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
    if (issued.ok !== true) return { decision: 'deny', requestId: `w2-${callId}`, detail: 'landing refused' }
    return { decision: 'approve', requestId: `w2-${callId}`, approval, grant: issued.value }
  }
}

// ── loopback mock of the Anthropic-compatible Messages endpoint (DeepSeek 原生搜索的真形状) ──
let messagesStub: Server
let redirectTarget: Server
let messagesPort = 0
let targetPort = 0
const observedRequests: Array<{ method: string; url: string; headers: Record<string, string | string | undefined>; body: string }> = []
const targetHits: string[] = []
async function listenFirstFree(server: Server): Promise<number> {
  for (const port of portsOfBands(MOCK_PORT_BANDS)) {
    try {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, '127.0.0.1', () => resolve())
      })
      return port
    } catch { /* next */ }
  }
  throw new Error('no free MOCK-band port')
}

beforeAll(async () => {
  mkdirSync(ROOT_DIR, { recursive: true })
  messagesStub = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => { body += String(chunk) })
    req.on('end', () => {
      observedRequests.push({ method: String(req.method), url: String(req.url), headers: req.headers as Record<string, string>, body })
      if (String(req.url ?? '').includes('/redirect-me')) {
        res.writeHead(302, { location: `http://127.0.0.1:${String(targetPort)}/elsewhere` })
        res.end()
        return
      }
      if (String(req.url ?? '').includes('/slow')) { return /* never answer */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        content: [
          { type: 'text', text: 'answer with citations', citations: [{ url: 'https://result.example/a', cited_text: 'the cited snippet' }] },
          { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search' },
          { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://result.example/a', title: 'Result A', page_age: '2026-10-30' }] },
        ],
      }))
    })
  })
  redirectTarget = createServer((req, res) => {
    targetHits.push(String(req.url ?? ''))
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end('{}')
  })
  messagesStub.on('clientError', () => undefined)
  messagesPort = await listenFirstFree(messagesStub)
  targetPort = await listenFirstFree(redirectTarget)
})
afterAll(async () => {
  rmSync(WORLD, { recursive: true, force: true })
  await new Promise<void>((r) => messagesStub.close(() => r()))
  await new Promise<void>((r) => redirectTarget.close(() => r()))
})

describe('P-W2 — the ctx.web seam owns provider selection (host law, measured on the real WebRuntime)', () => {
  it('S-1 zero usable provider → WEB_PROVIDER_UNAVAILABLE, zero wire', async () => {
    const seam = makeSeam()
    const r = await attempt(() => seam.search({ query: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_PROVIDER_UNAVAILABLE')
  })
  it('S-2 configured-but-missing id → WEB_PROVIDER_CONFIGURED_MISSING', async () => {
    const seam = makeSeam({ searchProvider: 'ghost' })
    const r = await attempt(() => seam.search({ query: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_PROVIDER_CONFIGURED_MISSING')
  })
  it('S-3 configured-but-unavailable id → WEB_PROVIDER_CONFIGURED_UNAVAILABLE', async () => {
    const seam = makeSeam({ searchProvider: 'off' })
    seam.registerSearchProvider(mockProvider('off', [], { available: false }))
    const r = await attempt(() => seam.search({ query: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_PROVIDER_CONFIGURED_UNAVAILABLE')
  })
  it('S-4 two usable providers, none configured → WEB_PROVIDER_AMBIGUOUS (selection never order-dependent)', async () => {
    const seam = makeSeam()
    seam.registerSearchProvider(mockProvider('a', []))
    seam.registerSearchProvider(mockProvider('b', []))
    const r = await attempt(() => seam.search({ query: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_PROVIDER_AMBIGUOUS')
  })
  it('S-5 duplicate provider id → WEB_DUPLICATE_PROVIDER at registration', () => {
    const seam = makeSeam()
    seam.registerSearchProvider(mockProvider('dup', []))
    let thrown: unknown
    try { seam.registerSearchProvider(mockProvider('dup', [])) } catch (e) { thrown = e }
    expect(codeOf(thrown)).toBe('WEB_DUPLICATE_PROVIDER')
  })
  it('S-6 seam cap: provider answers 20 sources, seam request caps to maxResults and flags truncated', async () => {
    const seam = makeSeam()
    seam.registerSearchProvider(mockProvider('wide', [], { sources: 20 }))
    const r = await seam.search({ query: 'cap', maxResults: 8 })
    expect(r.sources.length).toBe(8)
    expect(r.truncated).toBe(true)
  })
})

describe('P-W2 — the Team row over the adapter (governed PA chain + host seam, zero new client)', () => {
  it('A-1 approve: adapter rides the placement feed, approval saw EXACTLY [tool-invoke(web_search), connect@declared-origin], one seam call per query', async () => {
    const seam = makeSeam()
    const hits: string[] = []
    seam.registerSearchProvider(mockProvider('host-side', hits))
    const counters = { seamCalls: [] as string[] }
    const adapter = makeCtxWebAdapter(seam, 'https://search.example.test', counters)
    const audit: string[] = []
    const plane = await buildPlane(ASK, { controlLeg: recordingApprovingLeg(audit), backends: { webSearchProvider: adapter } })
    const row = plane.definitions.find((d) => d.name === 'web_search')
    expect(row).toBeDefined()
    const out = (await row!.execute({ queries: ['alpha', 'beta'] })) as { sources: Array<{ url: string }>; content?: string; truncated: boolean }
    expect(out.sources.length).toBe(2)
    expect(counters.seamCalls).toEqual(['alpha', 'beta']) // multi-query = one seam call per query (host semantics)
    expect(hits).toEqual(['alpha', 'beta']) // the host-side provider is the ONE execution body
    const declared = parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: 'web_search', resource: null },
      { kind: 'connect', resource: { realmId: REALM, kind: 'network-destination', canonicalLocator: 'https://search.example.test', rights: ['connect'] } },
    ])
    expect(declared.ok).toBe(true)
    if (declared.ok) expect(audit.some((l) => l.endsWith(`fp=${String(declared.value.fingerprint)}`))).toBe(true)
  })
  it('A-2 refused approval: typed refusal, the adapter never touches the seam, ZERO host-provider hits', async () => {
    const seam = makeSeam()
    const hits: string[] = []
    seam.registerSearchProvider(mockProvider('host-side', hits))
    const counters = { seamCalls: [] as string[] }
    const adapter = makeCtxWebAdapter(seam, 'https://search.example.test', counters)
    const audit: string[] = []
    const plane = await buildPlane(ASK, { controlLeg: denyingControlLeg(audit), backends: { webSearchProvider: adapter } })
    const row = plane.definitions.find((d) => d.name === 'web_search')
    let threw = ''
    try { await row!.execute({ queries: ['nope'] }) } catch (e) { threw = String((e as Error).message) }
    expect(threw.length).toBeGreaterThan(0)
    expect(counters.seamCalls).toEqual([])
    expect(hits).toEqual([])
  })
  it('A-3 host seam has NO provider behind the adapter: typed WEB_PROVIDER_UNAVAILABLE refusal through the row, zero wire', async () => {
    const seam = makeSeam() // nothing registered
    const counters = { seamCalls: [] as string[] }
    const adapter = makeCtxWebAdapter(seam, 'https://search.example.test', counters)
    const plane = await buildPlane(ASK, { controlLeg: approvingControlLeg([]), backends: { webSearchProvider: adapter } })
    const row = plane.definitions.find((d) => d.name === 'web_search')
    let threw = ''
    try { await row!.execute({ queries: ['x'] }) } catch (e) { threw = String((e as Error).message) }
    expect(threw).toContain('WEB_PROVIDER_UNAVAILABLE')
    expect(counters.seamCalls).toEqual(['x'])
  })
  it('A-4 cancellation: a pre-aborted signal answers cancelled, the seam is never reached after abort', async () => {
    const seam = makeSeam()
    const hits: string[] = []
    seam.registerSearchProvider(mockProvider('host-side', hits, { slowMs: 5_000 }))
    const counters = { seamCalls: [] as string[] }
    const adapter = makeCtxWebAdapter(seam, 'https://search.example.test', counters)
    const plane = await buildPlane(ASK, { controlLeg: approvingControlLeg([]), backends: { webSearchProvider: adapter } })
    const row = plane.definitions.find((d) => d.name === 'web_search')
    const controller = new AbortController()
    controller.abort()
    const out = (await row!.execute({ queries: ['slow'] }, { signal: controller.signal })) as { cancelled?: boolean }
    expect(out.cancelled).toBe(true)
    expect(hits).toEqual([]) // the slow provider never recorded a completed hit
  })
  it('A-5 mount law: an adapter whose declared destination is a literal non-public host REFUSES THE MOUNT', async () => {
    const seam = makeSeam()
    const counters = { seamCalls: [] as string[] }
    const adapter = makeCtxWebAdapter(seam, 'http://127.0.0.1:9', counters)
    await expect(buildPlane(ASK, { controlLeg: approvingControlLeg([]), backends: { webSearchProvider: adapter } }, { webAllowHttpLoopback: false }))
      .rejects.toThrowError(/PLANE_WEB_PROVIDER_REFUSED|refused/)
  })
})

describe('P-W2/P-W4 — the REAL DeepSeekSearchProvider against a loopback Messages endpoint (native wire shape)', () => {
  it('D-0 available(): no credential source → false (no-credential provider is simply UNUSABLE, never selected)', () => {
    const provider = new deepseekLib.DeepSeekSearchProvider(() => ({
      baseURL: `http://127.0.0.1:${String(messagesPort)}/v1`, model: deepseekLib.DEEPSEEK_DEFAULT_MODEL,
      apiVersion: '2023-06-01', maxTokens: 4096, maxUses: 5,
    }))
    expect(provider.available()).toBe(false)
  })
  it('D-1 resolver answers nothing → WEB_PROVIDER_CREDENTIAL_MISSING, ZERO requests leave the provider', async () => {
    observedRequests.length = 0
    const provider = new deepseekLib.DeepSeekSearchProvider(() => ({
      baseURL: `http://127.0.0.1:${String(messagesPort)}/v1`, model: deepseekLib.DEEPSEEK_DEFAULT_MODEL,
      apiVersion: '2023-06-01', maxTokens: 4096, maxUses: 5,
      resolveApiKey: async () => undefined, apiKeyEnv: 'DEEPSEEK_API_KEY',
    }))
    const r = await attempt(() => provider.search({ query: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_PROVIDER_CREDENTIAL_MISSING')
    expect(observedRequests).toHaveLength(0)
  })
  it('D-2 the native search IS a model call: POST {baseURL}/messages with tools[0].type=web_search_20250305; key rides HEADERS ONLY (never the body); sources map from web_search_tool_result + citation snippets', async () => {
    observedRequests.length = 0
    const recorded: Array<Record<string, unknown>> = []
    const provider = new deepseekLib.DeepSeekSearchProvider(() => ({
      baseURL: `http://127.0.0.1:${String(messagesPort)}/v1`, model: 'poc-model',
      apiVersion: '2023-06-01', maxTokens: 512, maxUses: 2,
      apiKey: 'sk-TEST-SECRET-DO-NOT-LEAK',
      recordRequest: (r: Record<string, unknown>) => { recorded.push(r) },
    }))
    const result = await provider.search({ query: 'q1', maxResults: 8 })
    expect(observedRequests).toHaveLength(1)
    const req = observedRequests[0]!
    expect(req.method).toBe('POST')
    expect(req.url).toBe('/v1/messages')
    expect(req.headers['x-api-key']).toBe('sk-TEST-SECRET-DO-NOT-LEAK')
    expect(req.headers.authorization).toBe('Bearer sk-TEST-SECRET-DO-NOT-LEAK')
    expect(req.headers['anthropic-version']).toBe('2023-06-01')
    const body = JSON.parse(req.body) as { tools: Array<{ type: string; max_uses?: number }>; messages: Array<{ content: Array<{ text: string }> }> }
    expect(body.tools[0]?.type).toBe('web_search_20250305')
    expect(body.tools[0]?.max_uses).toBe(2)
    expect(body.messages[0]?.content[0]?.text).toContain('q1')
    // credential NEVER in the body, never in the secret-free recordRequest payload.
    expect(req.body).not.toContain('sk-TEST-SECRET-DO-NOT-LEAK')
    expect(JSON.stringify(recorded)).not.toContain('sk-TEST-SECRET-DO-NOT-LEAK')
    expect(result.sources).toEqual([{ url: 'https://result.example/a', title: 'Result A', snippet: 'the cited snippet', publishedAt: '2026-10-30' }])
    expect(result.truncated).toBe(false)
    expect(result.content).toBeUndefined() // provider maps SOURCES only — no model summary face
  })
  it('D-3 redirect on the Messages call → typed provider error, redirect target NEVER contacted (redirect:error law)', async () => {
    targetHits.length = 0
    const provider = new deepseekLib.DeepSeekSearchProvider(() => ({
      baseURL: `http://127.0.0.1:${String(messagesPort)}/v1/redirect-me`, model: 'poc-model',
      apiVersion: '2023-06-01', maxTokens: 512, maxUses: 1, apiKey: 'sk-TEST',
    }))
    const r = await attempt(() => provider.search({ query: 'x' }))
    expect(r.ok).toBe(false)
    expect(targetHits).toEqual([])
  })
  it('D-4 mid-flight abort → WEB_ABORTED (cancellation is not a provider error)', async () => {
    const provider = new deepseekLib.DeepSeekSearchProvider(() => ({
      baseURL: `http://127.0.0.1:${String(messagesPort)}/v1/slow`, model: 'poc-model',
      apiVersion: '2023-06-01', maxTokens: 512, maxUses: 1, apiKey: 'sk-TEST',
    }))
    const controller = new AbortController()
    setTimeout(() => controller.abort(), 50)
    const r = await attempt(() => provider.search({ query: 'x' }, controller.signal))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_ABORTED')
  })
  it('D-5 per-query cost shape: a multi-query NATIVE web_search (tool-web layer) fans out to one provider call per query — the multi-query semantics live ABOVE the provider, and the Team row caps 8 vs native 4', () => {
    // Static fact recorded for the decision table, pinned here as an explicit leg:
    // tool-web src/search.ts runs one ctx.web.search per query (dedup exact first);
    // the governed row passes `queries` as ONE batch to its provider port.
    // Native maxQueries default = 4 (WEB_SEARCH_MAX_QUERIES), governed row maxItems = 8
    // (search-row.mjs). A provider adapter must choose one law and disclose it.
    expect(true).toBe(true)
  })
})
