/**
 * A5M2-G2-TEAM-ASSEMBLY — the two Team assembly ports (g2-team-assembly.mjs)
 * proven on the REAL pinned public entries at Host 639ed01539:
 *
 *  BROWSER port: the REAL public modules are LOADED by these legs
 *  (browser-use-stagehand-native src/launch.ts + src/native.ts via the
 *  package's public "./src/*" exports — proof they are importable at this
 *  pin, with the pinned export shapes). Wiring legs then drive the port with
 *  entry doubles: launchChromium's REAL OwnedChromium shape {endpoint, close}
 *  feeds openNativeBrowser, which must receive THAT process's endpoint
 *  (host src/index.ts:105-106 flow), pass-through config, PA-before-open
 *  (reviewed lease), half-open cleanup (reviewed owner), attach config law,
 *  and the pre-effect EXCLUSION (no second admission; this module imports no
 *  host browser runtime package — source-proven). A real Chromium launch is
 *  an environment dimension: NOT_RUN_BROWSER_ENVIRONMENT here.
 *
 *  MCP port: the REAL SDK Client (@modelcontextprotocol/client 2.0.0 — the
 *  package the host's own connection imports at connection.ts:18) is
 *  instantiated and CONNECTED by the port over a scripted in-memory
 *  transport pair; the scripted peer observes REAL JSON-RPC initialize +
 *  resources/list | templates/list | read calls, so same-source capture
 *  (client instance identity, gen-N, original timeout config), registration
 *  through the public mcpResources face shape, reconnect rotation (old
 *  generation REALLY closes), and scope-close drain → real client.close() →
 *  post-close refusal are all exercised end-to-end. No network, no
 *  credentials, no spawn — the scripted pair is the wire.
 *
 *  WEB: not implemented by ruling — the precise gap (forbidden global id/env
 *  switch and per-realm composition bypass; direct tool-plane fork only;
 *  CORE_SEAM_BLOCKER recorded) is anchor-tested as exported.
 *
 * Disclosed: doubles beyond the loaded real modules prove WIRING — NOT C2;
 * nothing here claims a real browser, real MCP server, or production secret;
 * module stays UNWIRED (CENTER wires bindings/plane — never written here);
 * zero git.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g2-team-assembly
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

interface SeamErr extends Error { code?: string }
async function asyncError (fn: () => unknown): Promise<SeamErr> {
  try {
    await fn()
  } catch (e) {
    const err = e as SeamErr
    expect(err.message).toMatch(/P_G2_(SEAM|ASM)_/)
    return err
  }
  throw new Error('expected a typed P_G2_* refusal — the call succeeded')
}

interface PortStats { launchChromium: number, openNativeBrowser: number, opens: number, retained: number, poisoned: boolean }
interface BrowserPort {
  run: (facts: Record<string, unknown>, work: (res: unknown) => Promise<unknown>) => Promise<unknown>
  state: () => string
  stats: () => PortStats
  close: () => Promise<unknown>
  assemblyLaws: Record<string, string>
}
const ASM = (await import(new URL('../src/plugin/live/governed-families/g2-team-assembly.mjs', import.meta.url).href)) as {
  A5_G2_ASSEMBLY_REVISION: number
  A5_G2_ASSEMBLY_CODES: Record<'ENTRY_INCOMPLETE' | 'CONFIG_INCOMPLETE' | 'SCOPE_CLOSED' | 'ALREADY_REGISTERED' | 'FACE_INCOMPLETE', string>
  A5_G2_WEB_ROUTE_GAP: Record<string, string>
  loadG2TeamAssemblyEntries: (d: Record<string, unknown>) => Promise<Record<string, unknown>>
  createG2TeamBrowserPort: (d: Record<string, unknown>) => BrowserPort
  createG2TeamMcpPort: (d: Record<string, unknown>) => McpPort
}
interface McpStats { server: string, generation: string | null, connected: boolean, disposed: boolean, inflight: number, transportsClosed: number, transportsBuilt: number, dispatch: { dispatchCount: number, driftRejects: number }, lastDispatch: Record<string, unknown> | null }
interface McpPort {
  request: (req: unknown, exec?: unknown) => Promise<Record<string, unknown>>
  provider: { request: (r: unknown, e: unknown) => Promise<unknown> }
  register: (face: { register: (s: string, p: unknown) => () => void }) => () => void
  reconnect: () => Promise<unknown>
  close: () => Promise<void>
  captureConnection: () => Record<string, unknown>
  stats: () => McpStats
  assemblyLaws: Record<string, string>
}

// The kernel worktree carries its own pristine host checkout (TEST_METHODS
// §2; the only allowed runtime source). These ARE the pinned public entries.
const HOST = new URL('../../../tests/deepseek-harness-test-use/packages/', import.meta.url).href
const LAUNCH_ENTRY = new URL('experimental/browser-use-stagehand-native/src/launch.ts', HOST).href
const NATIVE_ENTRY = new URL('experimental/browser-use-stagehand-native/src/native.ts', HOST).href
const SDK_ENTRY = new URL('mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist/index.mjs', HOST).href
const AC = ASM.A5_G2_ASSEMBLY_CODES

/* ── BROWSER port ─────────────────────────────────────────────────── */
describe('a5m2-g2-assembly BROWSER port', () => {
  it('loads the REAL pinned public entries at 639ed01539 (launch.ts + native.ts via the package "./src/*" export) and refuses bad paths typed', async () => {
    const entries = await ASM.loadG2TeamAssemblyEntries({ launchEntry: LAUNCH_ENTRY, nativeEntry: NATIVE_ENTRY })
    expect(typeof entries['launchChromium']).toBe('function') // src/launch.ts:24 — real OwnedChromium factory
    expect(typeof entries['openNativeBrowser']).toBe('function') // src/native.ts:95 — real NativeBrowserRuntime opener
    expect((entries['launchChromium'] as ((...args: unknown[]) => unknown) | undefined)?.length).toBe(2) // (config, signal) contract — the abort-before-ownership signal is real
    const bad = await asyncError(() => ASM.loadG2TeamAssemblyEntries({ launchEntry: '/nonexistent/launch.ts', nativeEntry: NATIVE_ENTRY }))
    expect(bad.code).toBe(AC.ENTRY_INCOMPLETE) // nothing partial reaches a port
    expect((await asyncError(() => ASM.loadG2TeamAssemblyEntries({} as Record<string, unknown>))).code).toBe(AC.ENTRY_INCOMPLETE)
  }, 30000)

  it('launch wiring uses the REAL entry flow: OwnedChromium{endpoint, close} from launchChromium feeds openNativeBrowser with THAT endpoint (host src/index.ts:105-106), config passes through untouched of endpoints, one open across calls, close runtime→process exactly once on port.close', async () => {
    const order: string[] = []
    const configs: Array<Record<string, unknown>> = []
    let procs = 0
    const entries = {
      launchChromium: async (cfg: Record<string, unknown>, signal: AbortSignal) => {
        order.push('launch')
        expect(cfg['model']).toBeTruthy() // the approved config object, passed through
        void signal.aborted
        procs += 1
        return { endpoint: `http://127.0.0.1:4${1000 + procs}`, close: async () => { order.push('proc:close') } } // real OwnedChromium shape (launch.ts:11-16)
      },
      openNativeBrowser: async (cfg: Record<string, unknown>) => {
        order.push('runtime:open')
        configs.push(cfg)
        return { close: async () => { order.push('runtime:close') } }
      },
    }
    const port = ASM.createG2TeamBrowserPort({
      mode: 'launch',
      nativeConfig: { mode: 'launch', model: { modelName: 'gpt-4o', apiKey: 'sk-approved-config-only' }, headless: true, operationTimeoutMs: 60000 },
      entries,
      consumeApproval: () => 'consumed',
    })
    await port.run({ toolName: 'stagehand_navigate' }, async () => 'work')
    await port.run({ toolName: 'stagehand_act' }, async () => 'work2') // ONE owner across calls
    expect(order).toEqual(['launch', 'runtime:open']) // PA-before-open + single admission
    expect(configs.length).toBe(1)
    expect(configs[0]?.['cdpEndpoint']).toBe('http://127.0.0.1:41001') // THE endpoint of that exact process
    expect(configs[0]?.['mode']).toBe('attach') // host flow: runtime attaches to the launched endpoint
    expect(configs[0]?.['headless']).toBe(true) // approved config pass-through
    expect(port.stats()).toMatchObject({ launchChromium: 1, openNativeBrowser: 1, opens: 1, retained: 0, poisoned: false })
    await port.close()
    expect(order).toEqual(['launch', 'runtime:open', 'runtime:close', 'proc:close']) // runtime THEN process
    await port.close() // idempotent
    expect(order.filter((o) => o === 'proc:close').length).toBe(1)
  })

  it('PA refused ⇒ ZERO real-entry calls; the pre-effect path is structurally EXCLUDED (no host browser runtime import anywhere in the module); missing attach endpoint refuses CONFIG_INCOMPLETE', async () => {
    const entries = { launchChromium: async () => { throw new Error('must never run') }, openNativeBrowser: async () => { throw new Error('must never run') } }
    const port = ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: { mode: 'launch' }, entries, consumeApproval: () => 'refused' })
    expect((await asyncError(() => port.run({ toolName: 'stagehand_navigate' }, async () => 'never'))).code).toMatch(/PA_NOT_CONSUMED/)
    expect(port.stats()).toMatchObject({ launchChromium: 0, openNativeBrowser: 0, opens: 0 })
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/governed-families/g2-team-assembly.mjs'), 'utf8') // source-provenance pattern per a3p2 lane-import test
    expect(src).not.toMatch(/from '[^']*browser-use/) // imports NO host browser package at all — the host SessionResources admission cannot be re-entered
    expect(port.assemblyLaws['preEffect']).toMatch(/EXCLUDED/)
    expect(() => ASM.createG2TeamBrowserPort({ mode: 'attach', nativeConfig: { mode: 'attach' }, entries, consumeApproval: () => 'consumed' })).toThrow(/CONFIG_INCOMPLETE/) // no invented endpoint
    const attachPort = ASM.createG2TeamBrowserPort({ mode: 'attach', nativeConfig: { mode: 'attach', cdpEndpoint: 'http://configured.example:9222' }, entries: { launchChromium: async () => { throw new Error('attach must not launch') }, openNativeBrowser: async (cfg: Record<string, unknown>) => { expect(cfg['cdpEndpoint']).toBe('http://configured.example:9222'); return { close: async () => {} } } }, consumeApproval: () => 'consumed' })
    await attachPort.run({ toolName: 'stagehand_navigate' }, async () => 'ok') // attach opens the CONFIGURED endpoint, zero launches
    expect(attachPort.stats().launchChromium).toBe(0)
  })

  it('REAL half-open cleanup: runtime open failure closes the owned process BEFORE rejecting (clean ⇒ recoverable retry); a rollback that also fails poisons + retains and the port refuses further opens — the reviewed owner law through real wiring', async () => {
    const order: string[] = []
    let runtimeFails = 0
    const mk = (failRollback: boolean) => ASM.createG2TeamBrowserPort({
      mode: 'launch',
      nativeConfig: { mode: 'launch' },
      entries: {
        launchChromium: async () => { order.push('launch'); return { endpoint: 'http://127.0.0.1:4999', close: async () => { order.push('proc:close'); if (failRollback) throw new Error('process refuses to die') } } },
        openNativeBrowser: async () => {
          order.push('runtime:open')
          if (runtimeFails === 0) { runtimeFails += 1; throw new Error('CDP connect exploded') }
          return { close: async () => { order.push('runtime:close') } }
        },
      },
      consumeApproval: () => 'consumed',
    })
    const clean = mk(false)
    expect((await asyncError(() => clean.run({ toolName: 'stagehand_navigate' }, async () => 'never'))).code).toMatch(/LAUNCH_FAILED/)
    expect(order).toEqual(['launch', 'runtime:open', 'proc:close']) // rollback BEFORE the rejection settles
    expect(clean.stats()).toMatchObject({ retained: 0, poisoned: false })
    await clean.run({ toolName: 'stagehand_navigate' }, async () => 'retry-ok') // recoverable: retry is a new call
    expect(clean.stats().opens).toBe(2)
    runtimeFails = 0
    order.length = 0
    const leaked = mk(true)
    expect((await asyncError(() => leaked.run({ toolName: 'stagehand_navigate' }, async () => 'never'))).code).toMatch(/CLOSE_FAILED/)
    expect(leaked.stats()).toMatchObject({ retained: 1, poisoned: true }) // the REAL handle held at owner level
    expect((await asyncError(() => leaked.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toMatch(/LEASE_CLOSED/) // no reopen over the leak
    const drainErr = await asyncError(() => leaked.close())
    expect(drainErr.message).toMatch(/RETAINED/) // drain never fakes closed
  })
})

/* ── MCP port (REAL SDK client + scripted wire) ───────────────────── */
interface WireMsg { jsonrpc: string, id?: number | string, method?: string, params?: Record<string, unknown>, result?: Record<string, unknown>, error?: Record<string, unknown> }
interface Scripted { seen: WireMsg[] }
type Sdk = { Client: new (a: unknown, b: unknown) => unknown, InMemoryTransport: { createLinkedPair: () => Promise<Array<Record<string, unknown>>> } }
const sdk = (await import(SDK_ENTRY)) as unknown as Sdk

function scriptedPeer(pairB: Record<string, unknown>): Scripted {
  const seen: WireMsg[] = []
  const send = (m: WireMsg): void => { (pairB['send'] as (x: WireMsg) => Promise<void>)(m).catch(() => {}) }
  pairB['onmessage'] = (raw: WireMsg) => {
    if (raw.id === undefined) return // notifications (initialized) get no answer
    seen.push(raw)
    // The real SDK gates list/read behind the advertised resources capability.
    if (raw.method === 'initialize') send({ jsonrpc: '2.0', id: raw.id, result: { protocolVersion: (raw.params?.['protocolVersion'] as string) ?? '2025-06-18', capabilities: { resources: {} }, serverInfo: { name: 'g2-scripted', version: '0' } } })
    else if (raw.method === 'resources/list') send({ jsonrpc: '2.0', id: raw.id, result: { resources: [{ uri: 'res://g2', name: 'g2' }] } })
    else if (raw.method === 'resources/templates/list') send({ jsonrpc: '2.0', id: raw.id, result: { resourceTemplates: [{ name: 't', uriTemplate: 'res://{x}' }] } })
    else if (raw.method === 'resources/read') send({ jsonrpc: '2.0', id: raw.id, result: { contents: [{ uri: String(raw.params?.['uri'] ?? ''), text: 'served-real-client' }] } })
    else send({ jsonrpc: '2.0', id: raw.id, error: { code: -32601, message: 'scripted: not found' } })
  }
  return { seen }
}

async function makePair (): Promise<{ a: Record<string, unknown>, peer: ReturnType<typeof scriptedPeer> }> {
  const [a, b] = await sdk.InMemoryTransport.createLinkedPair()
  if (a === undefined || b === undefined) throw new Error('InMemoryTransport.createLinkedPair must answer a linked pair')
  return { a, peer: scriptedPeer(b) }
}

describe('a5m2-g2-assembly MCP port', () => {
  const surface = { serverName: 'team-g2-remote', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' }
  const TIMEOUT = 4500
  const signal = new AbortController().signal
  const EXEC = { agent: { id: 'agent-g2-asm' }, signal }

  it('SAME-SOURCE truth: the port connects the REAL @modelcontextprotocol/client 2.0.0 (host connection.ts:18 package); captureConnection answers THAT client instance, gen-N and the original timeout config; the seam dispatches as REAL JSON-RPC the scripted peer observes', async () => {
    const pair1 = await makePair()
    const queue: Array<Record<string, unknown>> = [pair1.a]
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => { const t = queue.shift(); if (t === undefined) throw new Error('transport queue dry'); return t },
      toolCallTimeoutMs: TIMEOUT,
    })
    await port.reconnect()
    expect(port.stats().generation).toBe('gen-1')
    const cap = port.captureConnection()
    expect(cap['client']).toBeInstanceOf(sdk.Client) // the captured generation IS a real SDK Client
    expect(cap['generation']).toBe('gen-1')
    expect(cap['timeout']).toBe(TIMEOUT) // original approved config value preserved
    expect(cap['endpointOrigin']).toBe('https://mcp.example')
    const out = await port.request({ method: 'resources/list' }, EXEC)
    expect((out['resources'] as unknown[]).length).toBe(1) // served through the REAL client
    expect(pair1.peer.seen.map((m) => m.method)).toContain('resources/list') // REAL JSON-RPC on the wire
    expect(pair1.peer.seen.map((m) => m.method)).toContain('initialize') // real handshake happened
    const params = pair1.peer.seen.find((m) => m.method === 'resources/list')?.['params']
    expect(params === undefined || !('method' in params)).toBe(true) // internal request object never dumped on the wire
    const tpl = await port.request({ method: 'resources/templates/list', cursor: 'c-7' }, EXEC)
    expect((tpl['resourceTemplates'] as unknown[]).length).toBe(1)
    expect(pair1.peer.seen.find((m) => m.method === 'resources/templates/list')?.['params']).toMatchObject({ cursor: 'c-7' })
    const rd = await port.request({ method: 'resources/read', uri: 'res://g2' }, EXEC)
    expect((rd['contents'] as Array<Record<string, unknown>>)[0]?.['text']).toBe('served-real-client')
    expect(pair1.peer.seen.find((m) => m.method === 'resources/read')?.['params']).toMatchObject({ uri: 'res://g2' })
    expect(port.stats().lastDispatch?.['connectionIncarnation']).toBe('gen-1')
    expect(port.stats().lastDispatch?.['executedOn']).toBe('captured-generation')
  }, 30000)

  it('registers through the PUBLIC mcpResources face shape (scope-layered register returning a disposer, refused twice); config/name mismatches and missing timeout refuse typed BEFORE any connection', async () => {
    const pair1 = await makePair()
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => pair1.a,
      toolCallTimeoutMs: TIMEOUT,
    })
    const registered: Array<{ server: string, provider: Record<string, unknown> }> = []
    const face = { register: (s: string, p: unknown) => { registered.push({ server: s, provider: p as Record<string, unknown> }); return () => {} } }
    await port.reconnect()
    port.register(face)
    expect(registered[0]?.['server']).toBe('team-g2-remote') // the Team-only server name, verbatim
    expect(typeof registered[0]?.['provider']?.['request']).toBe('function') // the mcp-resources provider shape {request}
    expect(() => port.register(face)).toThrow(/ALREADY_REGISTERED/) // one slot, one registration
    // registered provider dispatch works end-to-end:
    const out = await (registered[0]?.['provider']?.['request'] as (r: unknown, e: unknown) => Promise<Record<string, unknown>>)({ method: 'resources/list' }, EXEC)
    expect((out['resources'] as unknown[]).length).toBe(1)
    expect(() => port.register({ register: 'not-a-function' } as unknown as { register: (s: string, p: unknown) => () => void })).toThrow(/FACE_INCOMPLETE/)
    // mismatched/approval-less configs refuse at BUILD time — no connection attempted:
    expect(() => ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'other-name', entries: { Client: sdk.Client }, makeTransport: () => pair1.a, toolCallTimeoutMs: TIMEOUT })).toThrow(/CONFIG_INCOMPLETE/) // same-source ⇒ same name
    expect(() => ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'team-g2-remote', entries: { Client: sdk.Client }, makeTransport: () => pair1.a })).toThrow(/CONFIG_INCOMPLETE/) // no defaulted timeout
    expect(() => ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'team-g2-remote', entries: { Client: sdk.Client }, toolCallTimeoutMs: TIMEOUT })).toThrow(/CONFIG_INCOMPLETE/) // transport factory REQUIRED — no invented connection
  }, 30000)

  it('reconnect rotates generations for real: new Client instance becomes the capture, the OLD generation closes its transport, and the next dispatch runs on the new generation', async () => {
    const pair1 = await makePair()
    const pair2 = await makePair()
    const queue: Array<Record<string, unknown>> = [pair1.a, pair2.a]
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => { const t = queue.shift(); if (t === undefined) throw new Error('dry'); return t },
      toolCallTimeoutMs: TIMEOUT,
    })
    await port.reconnect()
    const first = port.captureConnection()['client']
    await port.request({ method: 'resources/list' }, EXEC)
    await port.reconnect() // rotation: gen-2
    expect(port.stats().generation).toBe('gen-2')
    expect(port.stats().transportsBuilt).toBe(2)
    expect(port.stats().transportsClosed).toBe(1) // the rotated generation REALLY closed (wrapper-observed)
    expect(port.captureConnection()['client']).not.toBe(first)
    expect(port.captureConnection()['generation']).toBe('gen-2')
    await port.request({ method: 'resources/read', uri: 'res://g2' }, EXEC)
    expect(pair2.peer.seen.map((m) => m.method)).toContain('resources/read') // served on the NEW client
    expect(pair1.peer.seen.map((m) => m.method)).not.toContain('resources/read')
  }, 30000)

  it('scope close is real: unregister FIRST, in-flight requests DRAIN, then client.close() tears the transport down; afterwards capture and requests refuse — and re-close is cached', async () => {
    const pair1 = await makePair()
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => pair1.a,
      toolCallTimeoutMs: TIMEOUT,
    })
    let unregistered = 0
    const events: string[] = []
    port.register({ register: () => () => { unregistered += 1; events.push('unregister') } })
    await port.reconnect()
    const inflight = port.request({ method: 'resources/list' }, EXEC) // dispatched, not yet settled
    expect(port.stats().inflight).toBe(1) // tracked
    const closing = port.close()
    expect(unregistered).toBe(1) // unregister happened FIRST, synchronously at close start
    const out = await inflight // the in-flight request STILL settles (drain, not kill)
    expect((out['resources'] as unknown[]).length).toBe(1)
    await closing
    expect(port.stats()).toMatchObject({ disposed: true, connected: false, inflight: 0, transportsClosed: 1 })
    expect((await asyncError(() => port.request({ method: 'resources/list' }, EXEC))).code).toBe(AC.SCOPE_CLOSED) // post-close: nothing serves
    expect(() => port.captureConnection()).toThrow(/CAPTURE_INCOMPLETE/) // and the seam could not execute anyway
    await port.close() // cached, no second unregister
    expect(unregistered).toBe(1)
    expect(events).toEqual(['unregister'])
  }, 30000)
})

/* ── WEB gap anchor ───────────────────────────────────────────────── */
describe('a5m2-g2-assembly WEB (ruled: not implemented — precise gap exported)', () => {
  it('the exported gap states the forbidden routes (global id/env switch, per-realm composition bypass), the direct-fork route, and records the upstream gap as CORE_SEAM_BLOCKER', () => {
    const gap = ASM.A5_G2_WEB_ROUTE_GAP
    expect(String(gap['decision'])).toMatch(/FORBIDDEN/)
    expect(String(gap['publicFaces'])).toMatch(/re-resolves globally/) // why ctx.web selection may not route the Team fork
    expect(String(gap['gap'])).toMatch(/CORE_SEAM_BLOCKER/)
    expect(String(gap['gap'])).toMatch(/directly/)
  })
})
