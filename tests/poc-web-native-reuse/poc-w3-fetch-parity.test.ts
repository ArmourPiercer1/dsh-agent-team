/**
 * A5W PoC P-W3 — web_fetch 安全保证逐项实测：原生 HttpFetchProvider vs Team 受治 transport/row
 *
 * ⚠ PoC 不入生产判据 — 三层保证区分（①调用准入 ②Provider 自身保证 ③Provider 内部不可验证活动）
 *   的证据腿；判据表见 dev/agent-workflow/evidence/a5w-native-reuse-20261031/WEB-NATIVE-POC.md。
 * 记录时间（真实 UTC）：2026-10-31。
 *   原生侧 = pristine @639ed01539 web-fetch-http 的 HttpFetchProvider 真类。它的 DNS 法则腿
 *   （非公网拒连）用 resolvePublicAddresses 的真实现 + 假 DNS lookup 直测（零网络）；行为腿
 *   （重定向/上限/超时/取消）经公开构造参数注入 loopback 解析（provider 自己的注入 seam，
 *   非 monkey-patch）。Team 侧 = 真实 web-family row（plane 挂载，ask+approve）+ 真实
 *   transport（loopback-http trusted opt）。全部打同一组 MOCK 段本地 stub；零真网络。
 * 注意：原生 provider 默认法则连 loopback 都拒（无本机开关）——Team transport 反而在 trusted
 *   mount opt 下允许 loopback http。这一条是 ②/③ 层差异的直接见证。
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree, MOCK_PORT_BANDS, portsOfBands } from '../paths.mjs'
import { approvingControlLeg } from '../../packages/runtime/test/a5-m1-control-legs.mjs'
import * as planeRow from '../../packages/runtime/src/plugin/live/team-tool-plane.mjs'
import { createWebTransport } from '../../packages/tools/web-family/src/web-transport.mjs'

const REPO_ROOT = findTestRepoRoot(process.cwd())
if (REPO_ROOT === null) throw new Error('P-SETUP: no pristine test-use tree found')
const PRISTINE = testUseTree(REPO_ROOT)
const httpProviderLib = (await import(pathToFileURL(join(PRISTINE, 'packages/web/web-fetch-http/lib/index.js')).href)) as {
  HttpFetchProvider: new (limits: Record<string, unknown>, resolveAddresses?: (hostname: string, signal: AbortSignal) => Promise<Array<{ address: string; family: 4 | 6 }>>) => {
    id: string
    available(): boolean
    fetch(req: { url: string }, signal?: AbortSignal): Promise<{ url: string; statusCode: number; body: { kind: string; content: string }; truncated: boolean }>
  }
}

// ── stub family on the MOCK band ───────────────────────────────────────────
let stub: Server
let victim: Server
let stubPort = 0
let victimPort = 0
const stubHits: string[] = []
const victimHits: string[] = []
const capturedHeaders: Array<Record<string, string | string[] | undefined>> = []
const HUGE_600K = 'H'.repeat(600 * 1024)
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
const ORIGIN = () => `http://127.0.0.1:${String(stubPort)}`

beforeAll(async () => {
  mkdirSync(WORLD, { recursive: true })
  stub = createServer((req, res) => {
    const url = String(req.url ?? '')
    stubHits.push(url)
    capturedHeaders.push(req.headers as Record<string, string | string[] | undefined>)
    if (url === '/page') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('hello-parity'); return }
    if (url === '/hop') { res.writeHead(302, { location: '/page' }); res.end(); return }
    if (url === '/cross') { res.writeHead(302, { location: `http://127.0.0.1:${String(victimPort)}/victim` }); res.end(); return }
    if (url === '/loop') { res.writeHead(302, { location: '/loop' }); res.end(); return }
    if (url === '/huge') { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(HUGE_600K); return }
    if (url === '/stream') {
      // chunked (no Content-Length): the stream-overrun byte-cap path.
      res.writeHead(200, { 'content-type': 'text/plain' })
      let sent = 0
      const tick = () => {
        if (sent >= 2 * 1024 * 1024) { res.end(); return }
        sent += 4096
        if (!res.write('S'.repeat(4096))) res.once('drain', tick)
        else setImmediate(tick)
      }
      tick()
      return
    }
    if (url === '/big-cl') { res.writeHead(200, { 'content-type': 'text/plain', 'content-length': String(2_000_000) }); res.end('B'.repeat(2_000_000)); return }
    if (url === '/slow') { return }
    if (url === '/octet') { res.writeHead(200, { 'content-type': 'application/octet-stream' }); res.end('opaque-bytes'); return }
    res.writeHead(404); res.end('nf')
  })
  victim = createServer((req, res) => {
    victimHits.push(String(req.url ?? ''))
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('VICTIM')
  })
  stub.on('clientError', () => undefined)
  victim.on('clientError', () => undefined)
  stubPort = await listenFirstFree(stub)
  victimPort = await listenFirstFree(victim)
})
afterAll(async () => {
  rmSync(WORLD, { recursive: true, force: true })
  await new Promise<void>((r) => stub.close(() => r()))
  await new Promise<void>((r) => victim.close(() => r()))
})

// ── native provider instances ──────────────────────────────────────────────
// The loopback dial arms inject the resolver THROUGH THE PUBLIC CONSTRUCTOR
// SEAM (`resolveAddresses` is documented as the policy-validated address seam);
// this measures the provider's own behaviour, not a patched host.
const loopbackResolve = async (): Promise<Array<{ address: string; family: 4 | 6 }>> => [{ address: '127.0.0.1', family: 4 }]
const NATIVE_LIMITS = { maxResponseBytes: 1_000_000, maxBodyChars: 200, timeoutMs: 30_000, maxRedirects: 5, userAgent: 'poc-a5w-native' }
const native = new httpProviderLib.HttpFetchProvider(NATIVE_LIMITS, loopbackResolve)
const nativeFastTimeout = new httpProviderLib.HttpFetchProvider({ ...NATIVE_LIMITS, timeoutMs: 300 }, loopbackResolve)

const codeOf = (e: unknown): string => String((e as { code?: string })?.code ?? '')
const callNative = async (provider: typeof native, url: string, signal?: AbortSignal) => {
  try { return { ok: true as const, value: await provider.fetch({ url }, signal) } }
  catch (e) { return { ok: false as const, code: codeOf(e), msg: String((e as Error)?.message ?? e) } }
}

// ── Team governed row (real plane, real transport, loopback-http trusted opt) ──
const REALM = 'a5w-poc-w3-realm'
const WORLD = join(new URL('../../', import.meta.url).pathname, 'tests/homes', `poc-a5w-w3-${Date.now().toString(36)}`)
const ROOT_DIR = join(WORLD, 'root')
const subtreeContains = ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/')
const ASK = { default: 'ask', allow: [], ask: [], deny: [] }
interface PlaneValue {
  definitions: Array<{ name: string; execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<unknown> }>
  ownNames: readonly string[]
  mount: (agentCtx: Record<string, unknown>) => { dispose: () => void }
}
async function teamRow(name: string): Promise<(raw: unknown, exec?: Record<string, unknown>) => Promise<unknown>> {
  const built = (planeRow as { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok: boolean; value?: PlaneValue; code?: string; message?: string } })
    .createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => 0 },
      teamSessionId: 'a5w-poc-w3-root',
      permissionPolicy: ASK,
      realmId: REALM,
      templateId: 'a5w-tpl',
      role: 'member',
      instanceId: 'a5w-instance',
      onObserve: () => undefined,
      fs: { subtreeContains },
      plane: { fsInstance: { fs: 'a5w-ctl', rootDir: ROOT_DIR, realmId: REALM, kind: 'absolute-path' }, webEnabled: true, webAllowHttpLoopback: true },
      controlLeg: approvingControlLeg([]),
    })
  if (built.ok !== true) throw new Error(`plane refused: ${String(built.code)}`)
  const row = (built.value as PlaneValue).definitions.find((d) => d.name === name)
  if (row === undefined) throw new Error(`no ${name} row`)
  return (raw, exec) => row.execute(raw, exec)
}
const callTeam = async (raw: unknown, exec?: Record<string, unknown>) => {
  try { return { ok: true as const, value: await (await teamRow('web_fetch'))(raw, exec) as { statusCode: number; body?: { kind?: string; content?: string }; truncated?: boolean } } }
  catch (e) { return { ok: false as const, msg: String((e as Error)?.message ?? e) } }
}

describe('P-W3 — native HttpFetchProvider behaviours (real class, loopback via the public resolver seam)', () => {
  it('H-0 available() is constant-true: the anonymous public fetcher is ALWAYS selectable (no credential concept)', () => {
    expect(native.available()).toBe(true)
    expect(native.id).toBe('http')
  })
  it('H-1 same-origin redirect hop: followed, content delivered; the stub SEES the provider UA header', async () => {
    stubHits.length = 0
    const r = await callNative(native, `${ORIGIN()}/hop`)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.body.content).toBe('hello-parity')
    expect(capturedHeaders.at(-1)?.['user-agent']).toBe('poc-a5w-native')
  })
  it('H-2 cross-origin redirect → WEB_REDIRECT_BLOCKED and the redirect target is NEVER contacted', async () => {
    victimHits.length = 0
    const r = await callNative(native, `${ORIGIN()}/cross`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_REDIRECT_BLOCKED')
    expect(victimHits).toEqual([])
  })
  it('H-3 redirect loop → WEB_REDIRECT_BLOCKED at the 5-hop cap', async () => {
    const r = await callNative(native, `${ORIGIN()}/loop`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_REDIRECT_BLOCKED')
  })
  it('H-4 STREAMED body (no Content-Length) over the byte cap is CUT SHORT and delivered with truncated=true (diverges from the Team whole-refusal)', async () => {
    const nativeTinyCap = new httpProviderLib.HttpFetchProvider({ ...NATIVE_LIMITS, maxResponseBytes: 4096, maxBodyChars: 100_000 }, loopbackResolve)
    const r = await callNative(nativeTinyCap, `${ORIGIN()}/stream`)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.value.truncated).toBe(true); expect(r.value.body.content.length).toBeLessThanOrEqual(4096) }
  })
  it('H-5 Content-Length over the cap → WEB_FETCH_TOO_LARGE refused WHOLE before any body read', async () => {
    const r = await callNative(native, `${ORIGIN()}/big-cl`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_FETCH_TOO_LARGE')
  })
  it('H-6 decoded body over maxBodyChars is truncated to the cap with truncated=true', async () => {
    const r = await callNative(native, `${ORIGIN()}/huge`)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.value.body.content.length).toBe(200); expect(r.value.truncated).toBe(true) }
  })
  it('H-7 wall-time bound → WEB_FETCH_TIMEOUT (300ms instance against a never-answering stub)', async () => {
    const r = await callNative(nativeFastTimeout, `${ORIGIN()}/slow`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_FETCH_TIMEOUT')
  })
  it('H-8 pre-aborted signal → WEB_ABORTED before any socket', async () => {
    stubHits.length = 0
    const controller = new AbortController()
    controller.abort()
    const r = await callNative(native, `${ORIGIN()}/page`, controller.signal)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_ABORTED')
    expect(stubHits).toEqual([])
  })
  it('H-9 application/octet-stream → WEB_UNSUPPORTED_CONTENT_TYPE (native fetch keeps html/text only)', async () => {
    const r = await callNative(native, `${ORIGIN()}/octet`)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('WEB_UNSUPPORTED_CONTENT_TYPE')
  })
  it('H-10 plain http scheme is ACCEPTED by the native policy (public-address law only) — the contrast row for Team https-only', async () => {
    const r = await callNative(native, `${ORIGIN()}/page`)
    expect(r.ok).toBe(true)
  })
  it('H-11 DNS/destination LAW with ZERO DNS and ZERO socket: the DEFAULT provider refuses every non-public literal destination (loopback hostname resolves locally and is refused too)', async () => {
    const defaultProvider = new httpProviderLib.HttpFetchProvider(NATIVE_LIMITS) // NO injected resolver — the shipped law
    stubHits.length = 0
    const refused: string[] = []
    for (const target of [
      'http://127.0.0.1:1/page',
      'http://10.0.0.1/page',
      'http://192.168.1.1/page',
      'http://172.16.5.5/page',
      'http://169.254.1.1/page',
      'http://100.64.0.1/page',
      'http://[::1]/page',
      'http://[fe80::1]/page',
      'http://[::ffff:127.0.0.1]/page',
      'http://[64:ff9b::808:808]/page',
      `http://localhost:${String(stubPort)}/page`, // REAL local resolution → refused by the public-address law
    ]) {
      const r = await callNative(defaultProvider, target)
      refused.push(`${target}:${r.ok ? 'DELIVERED' : r.code}`)
    }
    expect(refused.every((row) => row.endsWith(':WEB_BLOCKED_URL'))).toBe(true)
    expect(stubHits).toEqual([]) // the loopback stub was never contacted — the law fired before the socket
    // Public-accept leg = ENV (no real DNS/TCP from this PoC; source fact pinned in the
    // decision doc: resolvePublicAddresses accepts range()==='unicast' answers only).
  })
})

describe('P-W3 — the SAME arms on the Team governed row / transport (real plane, ask+approve)', () => {
  it('T-1 positive on the loopback stub (trusted loopback-http mount opt): bytes delivered', async () => {
    stubHits.length = 0
    const r = await callTeam({ url: `${ORIGIN()}/page` })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.body?.content).toBe('hello-parity')
    // Team transport sends NO user-agent (headers: accept only) — the divergence witness.
    expect(capturedHeaders.at(-1)?.['user-agent']).toBeUndefined()
  })
  it('T-2 cross-origin redirect → WEB_REDIRECT_DENIED and the victim is NEVER contacted (same law as H-2, own code)', async () => {
    victimHits.length = 0
    const r = await callTeam({ url: `${ORIGIN()}/cross` })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_REDIRECT_DENIED')
    expect(victimHits).toEqual([])
  })
  it('T-3 redirect loop → WEB_REDIRECT_LIMIT', async () => {
    const r = await callTeam({ url: `${ORIGIN()}/loop` })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_REDIRECT_LIMIT')
  })
  it('T-4 body over the row byte bound (512 KiB default) is refused WHOLE — nothing is delivered (diverges from H-4/H-6 truncate semantics)', async () => {
    const r = await callTeam({ url: `${ORIGIN()}/huge` })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_RESPONSE_TOO_LARGE')
  })
  it('T-5 application/octet-stream is NOT refused for being opaque (transport is content-type agnostic) — the contrast to H-9', async () => {
    const r = await callTeam({ url: `${ORIGIN()}/octet` })
    expect(r.ok).toBe(true)
  })
  it('T-6 transport wall-time bound → WEB_TIMEOUT', async () => {
    const transport = createWebTransport({ allowHttpLoopback: true })
    const out = await transport.fetchBounded({ url: `${ORIGIN()}/slow`, maxBytes: 1024, timeoutMs: 200 })
    expect(out.ok).toBe(false)
    expect((out as { code?: string }).code).toBe('WEB_TIMEOUT')
  })
  it('T-7 transport cancellation → cancelled (pre-aborted signal)', async () => {
    const transport = createWebTransport({ allowHttpLoopback: true })
    const controller = new AbortController()
    controller.abort()
    const out = await transport.fetchBounded({ url: `${ORIGIN()}/page`, maxBytes: 1024, signal: controller.signal })
    expect((out as { cancelled?: boolean }).cancelled).toBe(true)
  })
  it('T-8 plain https-only law: an http url that is NOT loopback is refused by the mechanics gate (zero wire) even on the opted-in mount', async () => {
    const r = await callTeam({ url: 'http://example.invalid/page' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('WEB_SCHEME_NOT_ALLOWED')
  })
})

describe('P-W3 — headers/cookies surface (what the two fetchers put on the wire)', () => {
  it('X-1 the native provider sends its UA + accept and NO cookie jar (observed at the stub)', async () => {
    capturedHeaders.length = 0
    await callNative(native, `${ORIGIN()}/page`)
    const headers = capturedHeaders[0] ?? {}
    expect(headers['user-agent']).toBe('poc-a5w-native')
    expect(headers['cookie']).toBeUndefined()
  })
  it('X-2 the Team transport sends accept:*/* and nothing else (no UA, no cookie) — observed at the stub', async () => {
    capturedHeaders.length = 0
    await callTeam({ url: `${ORIGIN()}/page` })
    const headers = capturedHeaders[0] ?? {}
    expect(headers['cookie']).toBeUndefined()
    expect(headers['user-agent']).toBeUndefined()
    expect(headers['accept']).toBe('*/*')
  })
})
