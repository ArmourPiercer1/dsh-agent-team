/**
 * A5M2-G2-TEAM-ASSEMBLY (revision 4; rev2 = lifecycle round per the assembly
 * review of 6f9aec9782, rev3 = root 4afa MCP residuals — persistent retained
 * ownership, close keeps ownership on failure, SYNCHRONOUS admission cutoff —
 * rev4 = root 6875: generation ownership carries the REAL transport + close
 * handle; failed cleanup really touches that owned handle) — the two Team
 * assembly ports proven on the REAL pinned public entries at Host 639ed01539:
 *
 *  BROWSER port: the REAL public modules are LOADED by these legs
 *  (browser-use-stagehand-native src/launch.ts + src/worker-client.ts via the
 *  package's public "./src/*" exports). The runtime now runs through the
 *  PUBLIC WORKER ENTRY openBrowserWorker (src/worker-client.ts:15 — the entry
 *  the host's own wiring uses), fixing the reviewed gaps of the direct
 *  openNativeBrowser lane: acquisition cancel is REAL (abort mid-ready
 *  terminates — leg-proven through the worker-contract double), a failed init
 *  never leaves a half-open CDP connection, and execute(method, args,
 *  operationSignal) honors the operation signal by closing the connection on
 *  abort, with NO hidden reopen (a Team retry is a new lease acquisition).
 *  Attach mode closes ONLY the runtime — with no owned Chromium nothing is
 *  fake-cleaned. A real Chromium launch/worker spawn is an environment
 *  dimension: NOT_RUN_BROWSER_ENVIRONMENT (the module boundary is the real
 *  pinned import).
 *
 *  MCP port: the REAL SDK Client (@modelcontextprotocol/client 2.0.0) is
 *  constructed and CONNECTED by the port; the lifecycle review's four holes
 *  are closed with legs: (1) ONE serial chain — a pending connect is counted
 *  by close (close joins the chain and really closes the connecting
 *  generation), (2) concurrent reconnects cannot overwrite-and-leak, (3) a
 *  failed connect rolls its half-open generation closed while the current one
 *  stays live (pin-verified: the SDK routes a failed connect through
 *  client.close(), which reaches transport.close), (4) close failures are
 *  OWNED (retained real reference, CLOSE_FAILED at the rotation,
 *  re-attempted/reported at close — pin-verified that client.close()
 *  propagates a transport.close() rejection; transport "closed" marks only
 *  after the real close succeeded — never early-true). The transport factory
 *  receives ONLY the frozen approved-config target (full endpointUrl / spawn
 *  argv0+args+cwd) — same-source by construction. Registration binds the
 *  SCOPE FACE instance (disposer from the registered face only; two scopes,
 *  same server name, independent — isolation is never the name). No network,
 *  no credentials: the scripted InMemoryTransport pair is the wire (a mapping
 *  test for the SDK verbs — production transports are built by CENTER from
 *  the same frozen target).
 *
 *  WEB: not implemented by ruling — the precise gap is anchor-tested.
 *
 * Disclosed: doubles beyond the loaded real modules prove WIRING — NOT C2;
 * module stays UNWIRED (CENTER wires bindings/plane — never written here; the
 * e78 a5m2-wire-g2 branch mounts plane/glue only); zero git.
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
/** True when p already settled; false while still pending (30ms observation). */
async function settled (p: Promise<unknown>): Promise<boolean> {
  const PENDING = 'pending'
  const race = await Promise.race([
    p.then(() => 'done', () => 'done'),
    new Promise<string>((res) => { setTimeout(res, 30, PENDING) }),
  ])
  return race !== PENDING
}

interface RuntimeHandle { value: { execute: (m: string, a: unknown, s?: AbortSignal) => Promise<unknown> } }
interface PortStats { launchChromium: number, openBrowserWorker: number, workerWarns: number, opens: number, retained: number, poisoned: boolean }
interface BrowserPort {
  run: (facts: Record<string, unknown>, work: (res: RuntimeHandle) => Promise<unknown>) => Promise<unknown>
  state: () => string
  stats: () => PortStats
  close: () => Promise<unknown>
  assemblyLaws: Record<string, string>
}
const ASM = (await import(new URL('../src/plugin/live/governed-families/g2-team-assembly.mjs', import.meta.url).href)) as {
  A5_G2_ASSEMBLY_REVISION: number
  A5_G2_ASSEMBLY_CODES: Record<'ENTRY_INCOMPLETE' | 'CONFIG_INCOMPLETE' | 'SCOPE_CLOSED' | 'ALREADY_REGISTERED' | 'FACE_INCOMPLETE' | 'CONNECT_FAILED', string>
  A5_G2_WEB_ROUTE_GAP: Record<string, string>
  loadG2TeamAssemblyEntries: (d: Record<string, unknown>) => Promise<Record<string, unknown>>
  createG2TeamBrowserPort: (d: Record<string, unknown>) => BrowserPort
  createG2TeamMcpPort: (d: Record<string, unknown>) => McpPort
}
interface McpStats { server: string, generation: string | null, connected: boolean, disposed: boolean, inflight: number, transportsBuilt: number, transportsClosed: number, transportsCloseFailed: number, pendingGenerations: number, retainedGenerations: number, scopeBound: boolean, dispatch: { dispatchCount: number, driftRejects: number }, lastDispatch: Record<string, unknown> | null }
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
const WORKER_ENTRY = new URL('experimental/browser-use-stagehand-native/src/worker-client.ts', HOST).href
const SDK_ENTRY = new URL('mcp/mcp-client/node_modules/@modelcontextprotocol/client/dist/index.mjs', HOST).href
const AC = ASM.A5_G2_ASSEMBLY_CODES

/* ── BROWSER port (worker entry) ──────────────────────────────────── */
interface Doubles { entries: Record<string, unknown>, order: string[], configs: Array<Record<string, unknown>>, signals: AbortSignal[], fireWarn: (m: string) => void }
function workerDoubles (opts: { failInitOnce?: boolean, failRollback?: boolean, holdOpen?: boolean } = {}): Doubles {
  const order: string[] = []
  const configs: Array<Record<string, unknown>> = []
  const signals: AbortSignal[] = []
  let procs = 0
  let initFailsLeft = opts.failInitOnce === true ? 1 : 0
  let openRelease: (() => void) | null = null
  let warnSink: ((m: string) => void) | null = null
  const entries = {
    launchChromium: async (cfg: Record<string, unknown>, signal: AbortSignal) => {
      order.push('launch')
      void cfg; void signal
      procs += 1
      return { endpoint: `http://127.0.0.1:4${1000 + procs}`, close: async () => { order.push('proc:close'); if (opts.failRollback === true) throw new Error('process refuses to die') } } // real OwnedChromium (launch.ts:11-16)
    },
    openBrowserWorker: async (cfg: Record<string, unknown>, signal: AbortSignal, warn: (m: string) => void) => {
      order.push('runtime:open')
      configs.push(cfg)
      signals.push(signal)
      warnSink = warn
      if (signal.aborted) throw signal.reason
      if (opts.holdOpen === true) {
        // worker-client law: abort mid-`ready` TERMINATES and rejects (worker-client.ts:56-68)
        await new Promise<void>((res, rej) => {
          const onAbort = (): void => { rej(signal.reason) }
          signal.addEventListener('abort', onAbort, { once: true })
          openRelease = () => { signal.removeEventListener('abort', onAbort); res() }
        })
      }
      if (signal.aborted) throw signal.reason
      if (initFailsLeft > 0) {
        initFailsLeft -= 1
        order.push('worker:terminate') // failed init terminates inside the entry — no half-open CDP survives
        throw new Error('worker init failed (connect→Stagehand.create) — Worker terminated')
      }
      let closing: Promise<void> | null = null
      const close = (): Promise<void> => closing ??= (async () => { order.push('runtime:close') })() // cached ⇒ idempotent (worker-client close ??=)
      return {
        async execute (method: string, _args: unknown, opSignal?: AbortSignal) {
          if (closing !== null) throw new Error('Stagehand browser Worker is closed')
          opSignal?.throwIfAborted()
          const canceled = (): void => { void close().catch(() => {}) } // worker-client.ts:75 abort ⇒ close
          opSignal?.addEventListener('abort', canceled, { once: true })
          try {
            order.push(`exec:${method}`)
            await Promise.resolve()
            opSignal?.throwIfAborted()
            return { method }
          } finally {
            opSignal?.removeEventListener('abort', canceled)
          }
        },
        close,
      }
    },
  }
  void openRelease
  return { entries, order, configs, signals, fireWarn: (m: string) => { warnSink?.(m) } }
}

const LAUNCH_CONFIG = { mode: 'launch', model: { modelName: 'gpt-4o', apiKey: 'sk-approved-config-only' }, headless: true, operationTimeoutMs: 60000, shutdownGraceMs: 5000 }

describe('a5m2-g2-assembly BROWSER port (worker entry)', () => {
  it('loads the REAL pinned public entries at 639ed01539 — launch.ts AND worker-client.ts (the host-used runtime entry, "./src/*" public export) — and refuses bad paths typed', async () => {
    const entries = await ASM.loadG2TeamAssemblyEntries({ launchEntry: LAUNCH_ENTRY, workerEntry: WORKER_ENTRY })
    expect(typeof entries['launchChromium']).toBe('function') // src/launch.ts:24 — real OwnedChromium factory
    expect(typeof entries['openBrowserWorker']).toBe('function') // src/worker-client.ts:15 — real worker runtime entry
    expect((entries['openBrowserWorker'] as ((...args: unknown[]) => unknown) | undefined)?.length).toBe(3) // (config, signal, warn) — signal + warn lanes are real parameters
    const bad = await asyncError(() => ASM.loadG2TeamAssemblyEntries({ launchEntry: '/nonexistent/launch.ts', workerEntry: WORKER_ENTRY }))
    expect(bad.code).toBe(AC.ENTRY_INCOMPLETE)
    expect((await asyncError(() => ASM.loadG2TeamAssemblyEntries({ launchEntry: LAUNCH_ENTRY } as Record<string, unknown>))).code).toBe(AC.ENTRY_INCOMPLETE) // workerEntry REQUIRED — the native-direct lane is retired
  }, 30000)

  it('launch wiring drives openBrowserWorker with THAT process\'s endpoint and the real scope signal; warn lands in observe; ONE open across calls; close = runtime then process exactly once', async () => {
    const d = workerDoubles()
    const events: Array<Record<string, unknown>> = []
    const port = ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: LAUNCH_CONFIG, entries: d.entries, consumeApproval: () => 'consumed', observe: (e: Record<string, unknown>) => { events.push(e) } })
    await port.run({ toolName: 'stagehand_navigate' }, async (res) => await res.value.execute('navigate', {}, new AbortController().signal))
    await port.run({ toolName: 'stagehand_act' }, async (res) => await res.value.execute('act', {}, new AbortController().signal))
    expect(d.order).toEqual(['launch', 'runtime:open', 'exec:navigate', 'exec:act']) // PA-before-open + one admission
    expect(d.configs.length).toBe(1)
    expect(d.configs[0]?.['cdpEndpoint']).toBe('http://127.0.0.1:41001') // THE endpoint of that exact process
    expect(d.configs[0]?.['mode']).toBe('attach') // host flow: runtime attaches to the launched endpoint
    expect(d.configs[0]?.['headless']).toBe(true) // approved config pass-through
    expect(d.signals[0]).toBeInstanceOf(globalThis['AbortSignal']) // the real acquisition-cancel signal is passed
    d.fireWarn('SDK cleanup did not finish') // worker-client warn lane
    expect(port.stats()).toMatchObject({ launchChromium: 1, openBrowserWorker: 1, workerWarns: 1, opens: 1 })
    expect(events.some((e) => e['event'] === 'worker-warn')).toBe(true)
    await port.close()
    expect(d.order.filter((o) => o === 'runtime:close')).toEqual(['runtime:close'])
    expect(d.order.filter((o) => o === 'proc:close')).toEqual(['proc:close'])
    expect(d.order.indexOf('runtime:close')).toBeLessThan(d.order.indexOf('proc:close')) // runtime THEN process
    await port.close() // idempotent
    expect(d.order.filter((o) => o === 'proc:close').length).toBe(1)
  })

  it('PA refused ⇒ ZERO real-entry calls; the pre-effect path stays structurally EXCLUDED; attach without endpoint refuses CONFIG_INCOMPLETE; native-direct entries are REJECTED (worker entry only)', async () => {
    const d = workerDoubles()
    const port = ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: LAUNCH_CONFIG, entries: d.entries, consumeApproval: () => 'refused' })
    expect((await asyncError(() => port.run({ toolName: 'stagehand_navigate' }, async () => 'never'))).code).toMatch(/PA_NOT_CONSUMED/)
    expect(port.stats()).toMatchObject({ launchChromium: 0, openBrowserWorker: 0, opens: 0 })
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/governed-families/g2-team-assembly.mjs'), 'utf8') // source-provenance pattern per a3p2 lane-import test
    expect(src).not.toMatch(/from '[^']*browser-use/) // imports NO host browser package at all — the host SessionResources admission cannot be re-entered
    expect(port.assemblyLaws['preEffect']).toMatch(/EXCLUDED/)
    expect(() => ASM.createG2TeamBrowserPort({ mode: 'attach', nativeConfig: { mode: 'attach' }, entries: d.entries, consumeApproval: () => 'consumed' })).toThrow(/CONFIG_INCOMPLETE/) // no invented endpoint
    expect(() => ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: LAUNCH_CONFIG, entries: { launchChromium: async () => ({ close: async () => {} }), openNativeBrowser: async () => ({}) }, consumeApproval: () => 'consumed' })).toThrow(/ENTRY_INCOMPLETE/) // the reviewed rejection of the native-direct lane
  })

  it('REAL half-open cleanup through the worker law: failed init (terminated inside the entry) rolls the owned process closed BEFORE rejecting (clean ⇒ recoverable retry); a rollback that also fails poisons + retains and refuses further opens; drain never fakes closed', async () => {
    const d = workerDoubles({ failInitOnce: true })
    const port = ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: LAUNCH_CONFIG, entries: d.entries, consumeApproval: () => 'consumed' })
    expect((await asyncError(() => port.run({ toolName: 'stagehand_navigate' }, async () => 'never'))).code).toMatch(/LAUNCH_FAILED/)
    expect(d.order).toEqual(['launch', 'runtime:open', 'worker:terminate', 'proc:close']) // rollback BEFORE the rejection settles
    expect(port.stats()).toMatchObject({ retained: 0, poisoned: false })
    await port.run({ toolName: 'stagehand_navigate' }, async () => 'retry-ok') // recoverable: retry is a new call
    expect(port.stats().opens).toBe(2)
    const leakD = workerDoubles({ failInitOnce: true, failRollback: true })
    const leaked = ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: LAUNCH_CONFIG, entries: leakD.entries, consumeApproval: () => 'consumed' })
    expect((await asyncError(() => leaked.run({ toolName: 'stagehand_navigate' }, async () => 'never'))).code).toMatch(/CLOSE_FAILED/)
    expect(leaked.stats()).toMatchObject({ retained: 1, poisoned: true }) // the REAL handle held at owner level
    expect((await asyncError(() => leaked.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toMatch(/LEASE_CLOSED/) // no reopen over the leak
    const drainErr = await asyncError(() => leaked.close())
    expect(drainErr.message).toMatch(/RETAINED/) // drain never fakes closed
  })

  it('scope close CANCELS a pending acquisition for real: abort mid-ready rejects (worker law), the half-open launch rolls back, and drain reaches a real closed', async () => {
    const d = workerDoubles({ holdOpen: true })
    const port = ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: LAUNCH_CONFIG, entries: d.entries, consumeApproval: () => 'consumed' })
    const running = port.run({ toolName: 'stagehand_navigate' }, async () => 'never-reached')
    await Promise.resolve() // let the open start and park mid-`ready`
    const closed = port.close() // scope.abort FIRST — the pending worker open must TERMINATE, not linger
    expect((await asyncError(() => running)).message.length).toBeGreaterThan(0) // the aborted acquisition rejects (terminate law); work never ran
    expect(d.order).toEqual(['launch', 'runtime:open', 'proc:close']) // NOTHING was ever established; the process is really closed
    await closed
    expect(port.stats()).toMatchObject({ openBrowserWorker: 1, opens: 1, retained: 0, poisoned: false })
  })

  it('operationSignal cancels for real: abort mid-execute CLOSES the connection and rejects; the closed runtime NEVER reopens silently — a retry is a new lease acquisition, and drain closes exactly once', async () => {
    const d = workerDoubles()
    const port = ASM.createG2TeamBrowserPort({ mode: 'launch', nativeConfig: LAUNCH_CONFIG, entries: d.entries, consumeApproval: () => 'consumed' })
    const captured: RuntimeHandle[] = []
    await port.run({ toolName: 'stagehand_navigate' }, async (res) => { captured.push(res); return 'opened' })
    expect(captured.length).toBe(1)
    const handle = captured[0] as RuntimeHandle
    const op = new AbortController()
    const abortedOp = (async () => {
      const p = handle.value.execute('act', {}, op.signal)
      op.abort(new Error('user canceled')) // lands while the operation is in flight
      return await p
    })()
    await expect(abortedOp).rejects.toThrow(/user canceled/) // the REAL abort reason propagates (worker-client throwIfAborted law) — a cancellation, not a typed seam refusal
    expect(d.order).toContain('runtime:close') // the CANCELED connection is really closed (worker-client.ts:75-76)
    await expect(handle.value.execute('act', {}, new AbortController().signal)).rejects.toThrow(/closed/i) // no hidden reopen
    expect(port.stats().openBrowserWorker).toBe(1) // no secret second worker either — retry = a new lease acquisition
    await port.close() // drain re-closes the (cached) worker close — idempotent
    expect(d.order.filter((o) => o === 'runtime:close').length).toBe(1)
    expect(d.order.filter((o) => o === 'proc:close').length).toBe(1)
  })

  it('attach mode: opens the CONFIGURED endpoint with zero launches, and close is RUNTIME-ONLY — with no owned Chromium nothing is fake-cleaned', async () => {
    const d = workerDoubles()
    const port = ASM.createG2TeamBrowserPort({ mode: 'attach', nativeConfig: { mode: 'attach', cdpEndpoint: 'http://configured.example:9222', operationTimeoutMs: 60000 }, entries: d.entries, consumeApproval: () => 'consumed' })
    await port.run({ toolName: 'stagehand_navigate' }, async (res) => await res.value.execute('navigate', {}, new AbortController().signal))
    expect(d.configs[0]?.['cdpEndpoint']).toBe('http://configured.example:9222') // the approved endpoint, verbatim
    expect(port.stats().launchChromium).toBe(0)
    await port.close()
    expect(d.order).toEqual(['runtime:open', 'exec:navigate', 'runtime:close']) // exactly: no proc:close ever — attach owns no process
  })
})

/* ── MCP port (REAL SDK client + scripted wire, serial lifecycle) ─── */
interface WireMsg { jsonrpc: string, id?: number | string, method?: string, params?: Record<string, unknown>, result?: Record<string, unknown>, error?: Record<string, unknown> }
interface Scripted { seen: WireMsg[], release: () => void }
type Sdk = { Client: new (a: unknown, b: unknown) => unknown, InMemoryTransport: { createLinkedPair: () => Promise<Array<Record<string, unknown>>> } }
const sdk = (await import(SDK_ENTRY)) as unknown as Sdk

function scriptedPeer (pairB: Record<string, unknown>, gated = false): Scripted {
  const seen: WireMsg[] = []
  let open = !gated
  const queue: WireMsg[] = []
  const send = (m: WireMsg): void => { (pairB['send'] as (x: WireMsg) => Promise<void>)(m).catch(() => {}) }
  pairB['onmessage'] = (raw: WireMsg) => {
    if (raw.id === undefined) return // notifications (initialized) get no answer
    seen.push(raw)
    // Pin-verified protocol law: SDK 2.0.0 probes server/discover first (a
    // -32601 answer falls back to the legacy era) and gates list/read behind
    // the advertised resources capability.
    const answer: WireMsg = raw.method === 'initialize'
      ? { jsonrpc: '2.0', id: raw.id, result: { protocolVersion: (raw.params?.['protocolVersion'] as string) ?? '2025-06-18', capabilities: { resources: {} }, serverInfo: { name: 'g2-scripted', version: '0' } } }
      : raw.method === 'resources/list'
        ? { jsonrpc: '2.0', id: raw.id, result: { resources: [{ uri: 'res://g2', name: 'g2' }] } }
        : raw.method === 'resources/templates/list'
          ? { jsonrpc: '2.0', id: raw.id, result: { resourceTemplates: [{ name: 't', uriTemplate: 'res://{x}' }] } }
          : raw.method === 'resources/read'
            ? { jsonrpc: '2.0', id: raw.id, result: { contents: [{ uri: String(raw.params?.['uri'] ?? ''), text: 'served-real-client' }] } }
            : { jsonrpc: '2.0', id: raw.id, error: { code: -32601, message: 'scripted: not found' } }
    if (open) send(answer)
    else queue.push(answer)
  }
  return { seen, release: () => { open = true; for (const m of queue.splice(0)) send(m) } }
}

async function makePair (gated = false): Promise<{ a: Record<string, unknown>, peer: Scripted }> {
  const [a, b] = await sdk.InMemoryTransport.createLinkedPair()
  if (a === undefined || b === undefined) throw new Error('InMemoryTransport.createLinkedPair must answer a linked pair')
  return { a, peer: scriptedPeer(b, gated) }
}

describe('a5m2-g2-assembly MCP port', () => {
  const surface = { serverName: 'team-g2-remote', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' }
  const TIMEOUT = 4500
  const EXEC = { agent: { id: 'agent-g2-asm' }, signal: new AbortController().signal }

  it('SAME-SOURCE e2e: the port connects the REAL SDK 2.0.0 Client and the factory receives ONLY the frozen approved-config target (full endpointUrl — the same source registration/capture use); capture answers THAT client + gen-1 + the original timeout config; seam dispatch arrives as REAL JSON-RPC with faithful params', async () => {
    const pair1 = await makePair()
    const targets: Array<Record<string, unknown>> = []
    const queue: Array<Record<string, unknown>> = [pair1.a]
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: (t: Record<string, unknown>) => { targets.push(t); const x = queue.shift(); if (x === undefined) throw new Error('transport queue dry'); return x },
      toolCallTimeoutMs: TIMEOUT,
    })
    await port.reconnect()
    expect(targets.length).toBe(1)
    expect(targets[0]).toEqual({ server: 'team-g2-remote', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' }) // the FULL approved endpoint is the only construction input — the InMemoryTransport here is a wire MAPPING; production factories build the real transport from THIS frozen target
    expect(Object.isFrozen(targets[0])).toBe(true) // the target cannot be mutated toward a side-channel endpoint
    expect(port.stats().generation).toBe('gen-1')
    const cap = port.captureConnection()
    expect(cap['client']).toBeInstanceOf(sdk.Client) // the captured generation IS a real SDK Client
    expect(cap['generation']).toBe('gen-1')
    expect(cap['timeout']).toBe(TIMEOUT) // original approved config value preserved
    expect(cap['endpointOrigin']).toBe('https://mcp.example')
    const out = await port.request({ method: 'resources/list' }, EXEC)
    expect((out['resources'] as unknown[]).length).toBe(1) // served through the REAL client
    expect(pair1.peer.seen.map((m) => m.method)).toEqual(expect.arrayContaining(['initialize', 'resources/list'])) // real handshake + real JSON-RPC
    const tpl = await port.request({ method: 'resources/templates/list', cursor: 'c-7' }, EXEC)
    expect((tpl['resourceTemplates'] as unknown[]).length).toBe(1)
    expect(pair1.peer.seen.find((m) => m.method === 'resources/templates/list')?.['params']).toMatchObject({ cursor: 'c-7' })
    const rd = await port.request({ method: 'resources/read', uri: 'res://g2' }, EXEC)
    expect((rd['contents'] as Array<Record<string, unknown>>)[0]?.['text']).toBe('served-real-client')
    expect(pair1.peer.seen.find((m) => m.method === 'resources/read')?.['params']).toMatchObject({ uri: 'res://g2' })
    expect(port.stats().lastDispatch?.['connectionIncarnation']).toBe('gen-1')
    expect(port.stats().lastDispatch?.['executedOn']).toBe('captured-generation')
  }, 30000)

  it('a FAILED connect owns its rollback: reconnect refuses typed, the CURRENT generation stays live and capture-able, the half-open generation gets its real close (pin-verified: the SDK routes connect-failure cleanup through client.close → transport.close), pending count returns to zero', async () => {
    const pair1 = await makePair()
    let brokenCloseAttempted = false
    const brokenTransport = { start: async () => { throw new Error('wire down at connect') }, send: async () => {}, close: async () => { brokenCloseAttempted = true } }
    let useBroken = false
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => { if (useBroken) { useBroken = false; return brokenTransport } return pair1.a },
      toolCallTimeoutMs: TIMEOUT,
    })
    await port.reconnect()
    const first = port.captureConnection()['client']
    useBroken = true
    const err = await asyncError(() => port.reconnect())
    expect(err.code).toBe(AC.CONNECT_FAILED)
    expect(port.stats()).toMatchObject({ connected: true, generation: 'gen-1', pendingGenerations: 0 }) // the live generation is UNTOUCHED
    expect(port.captureConnection()['client']).toBe(first)
    expect(Object.keys(await port.request({ method: 'resources/list' }, EXEC)).length).toBeGreaterThan(0) // and it still serves
    expect(brokenCloseAttempted).toBe(true) // the half-open generation got its real close
    expect(port.stats().retainedGenerations).toBe(0) // a SUCCESSFUL rollback retains nothing
    // …and a rollback that ALSO fails keeps the half-open reference PERSISTENTLY owned (real reference, not an error string)
    let broken2Closes = 0
    const broken2 = { start: async () => { throw new Error('wire down twice') }, send: async () => {}, close: async () => { broken2Closes += 1; throw new Error('refusing rollback close') } }
    let useBroken2 = false
    const port2 = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => { if (useBroken2) { useBroken2 = false; return broken2 } return pair1.a },
      toolCallTimeoutMs: TIMEOUT,
    })
    await port2.reconnect() // gen-1 live
    useBroken2 = true
    const rbErr = await asyncError(() => port2.reconnect())
    expect(rbErr.code).toBe(AC.CONNECT_FAILED)
    expect(rbErr.message).toMatch(/RETAINED/) // the refusal states the truth: real ownership was taken
    expect(port2.stats()).toMatchObject({ connected: true, generation: 'gen-1', pendingGenerations: 0, retainedGenerations: 1 }) // the half-open lives on in stats as a REAL retained reference
    const rbClose = await asyncError(() => port2.close())
    expect(rbClose.message).toMatch(/retained-connect-rollback-close/) // the owned failure re-surfaces at close…
    expect(rbClose.message).toMatch(/refusing rollback close/) // …with its underlying reason
    expect(broken2Closes).toBe(2) // pin law: the SDK reaches transport.close exactly ONCE on the failed-connect path (its own cleanup) and later client.close() no-ops — the SECOND call is the PORT'S OWNED cleanup reaching the retained transport handle directly (keeping the Client alone would not keep the unclosed transport closed)
    expect(port2.stats()).toMatchObject({ disposed: true, connected: false, retainedGenerations: 1 }) // a failed close keeps REAL ownership (never dropped for an error string)
  }, 30000)

  it('concurrent reconnects are SERIALIZED on the chain: both settle, exactly one rotation happens, the rotated-out generation closes, no client is overwritten-and-leaked', async () => {
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
    const [a, b] = await Promise.all([port.reconnect(), port.reconnect()]) // fired together — the chain must serialize them
    expect(a).toBeTruthy()
    expect(b).toBeTruthy()
    expect(port.stats()).toMatchObject({ generation: 'gen-2', connected: true, transportsBuilt: 2, transportsClosed: 1, pendingGenerations: 0 }) // first generation REALLY closed by the second rotation; none orphaned
    expect(pair2.peer.seen.map((m) => m.method)).toContain('initialize') // the SECOND reconnect built the live gen-2
    await port.request({ method: 'resources/list' }, EXEC)
    expect(pair2.peer.seen.map((m) => m.method)).toContain('resources/list') // live dispatch runs on gen-2
  }, 30000)

  it('close failures are OWNED, never swallowed: a rotated-out generation that refuses to close is RETAINED (real reference), the rotation reports CLOSE_FAILED, transport closed is NEVER early-true, and close() re-attempts AND re-reports (pin-verified: client.close propagates the transport failure)', async () => {
    const pair1 = await makePair()
    const pair2 = await makePair()
    pair1.a['close'] = async () => { throw new Error('generation-1 transport refuses to die') }
    const transports: Array<Record<string, unknown>> = [pair1.a, pair2.a]
    let i = 0
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => transports[i++] as Record<string, unknown>,
      toolCallTimeoutMs: TIMEOUT,
    })
    await port.reconnect() // gen-1 on pair1 (its close is poisoned)
    const rotErr = await asyncError(() => port.reconnect()) // rotation to gen-2: gen-1 close FAILS
    expect(rotErr.message).toMatch(/CLOSE_FAILED/)
    expect(port.stats()).toMatchObject({ generation: 'gen-2', connected: true, retainedGenerations: 1, transportsClosed: 0, transportsCloseFailed: 1 }) // new gen live; old RETAINED; nothing counted closed that isn't
    await port.request({ method: 'resources/list' }, EXEC) // the live generation still serves
    const closeErr = await asyncError(() => port.close())
    expect(closeErr.message).toMatch(/retained-rotated-generation-close/) // owned failure re-surfaced at close, with the retained label
    expect(closeErr.message).toMatch(/refuses to die/) // and the underlying reason
    expect(port.stats()).toMatchObject({ disposed: true, connected: false, retainedGenerations: 1 }) // re-attempted at close and STILL OWNED — ownership reduced only on real close success, never dropped on failure
  }, 30000)

  it('close COUNTS a pending connect: close joins the serial chain, the connecting generation settles (never truncated mid-handshake) and is then really closed — nothing survives the scope', async () => {
    const pair1 = await makePair()
    const pair2 = await makePair(true) // gated: the handshake stalls until release() — a REAL pending connect
    const queue: Array<Record<string, unknown>> = [pair1.a, pair2.a]
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: surface,
      resourceServerName: 'team-g2-remote',
      entries: { Client: sdk.Client },
      makeTransport: () => { const t = queue.shift(); if (t === undefined) throw new Error('dry'); return t },
      toolCallTimeoutMs: TIMEOUT,
    })
    await port.reconnect() // gen-1
    let disposedFaces = 0
    port.register({ register: () => () => { disposedFaces += 1 } })
    const rotating = port.reconnect() // gen-2 connect PENDING (handshake unanswered)
    await Promise.resolve()
    const closing = port.close() // close must WAIT for the pending connect (counts it), then close it for real
    // …but the ADMISSION CUTOFF is immediate AT ENTRY — it does not wait on the pending connect
    expect(port.stats().disposed).toBe(true) // requests/registrations/captures refuse from THIS tick
    expect(() => port.captureConnection()).toThrow(/CAPTURE_INCOMPLETE/)
    expect(disposedFaces).toBe(1) // the bound scope face is unregistered SYNCHRONOUSLY at close entry
    expect((await asyncError(() => port.request({ method: 'resources/list' }, EXEC))).code).toBe(AC.SCOPE_CLOSED) // nothing is admitted mid-teardown
    expect(await settled(closing)).toBe(false) // yet the teardown itself is NOT done — the connect is mid-handshake
    expect(port.stats().pendingGenerations).toBe(1) // the connecting generation IS tracked (close counts it)
    pair2.peer.release() // the handshake completes
    await expect(rotating).rejects.toThrow(/P_G2_ASM_SCOPE_CLOSED/) // the connecting generation sees the closed scope and is really closed, not published
    await closing
    expect(port.stats()).toMatchObject({ disposed: true, connected: false, pendingGenerations: 0, retainedGenerations: 0, transportsClosed: 2 }) // BOTH generations really closed — the connecting one included
    expect(disposedFaces).toBe(1) // and the face was unregistered exactly once
  }, 30000)

  it('scope isolation is the FACE BINDING, not the server name: two ports on the SAME server name register into two scope faces independently; close unregisters exactly the bound face', async () => {
    const pairA = await makePair()
    const pairB = await makePair()
    const mk = (t: Record<string, unknown>): McpPort => ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'team-g2-remote', entries: { Client: sdk.Client }, makeTransport: () => t, toolCallTimeoutMs: TIMEOUT })
    const portA = mk(pairA.a)
    const portB = mk(pairB.a)
    const calls: string[] = []
    const faceA = { register: (_s: string, _p: unknown) => { calls.push('A:register'); return () => { calls.push('A:dispose') } } }
    const faceB = { register: (_s: string, _p: unknown) => { calls.push('B:register'); return () => { calls.push('B:dispose') } } }
    await portA.reconnect()
    await portB.reconnect()
    portA.register(faceA)
    portB.register(faceB) // SAME server name, different scope face — legal: isolation is the face binding
    expect(portA.stats().scopeBound).toBe(true)
    expect(portB.stats().scopeBound).toBe(true)
    await portA.close()
    expect(calls).toEqual(['A:register', 'B:register', 'A:dispose']) // exactly the bound face disposed — B untouched
    expect((await asyncError(() => portA.request({ method: 'resources/list' }, EXEC))).code).toBe(AC.SCOPE_CLOSED)
    const out = await portB.request({ method: 'resources/list' }, EXEC) // the other scope serves on
    expect((out['resources'] as unknown[]).length).toBe(1)
    await portB.close()
    expect(calls).toEqual(['A:register', 'B:register', 'A:dispose', 'B:dispose'])
  }, 30000)

  it('registration + construction law: provider carries {request}; second register on the bound port refuses; non-function face refuses; name/timeout/factory omissions refuse at build; a non-Transport factory return refuses BEFORE connecting', async () => {
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
    expect(registered[0]?.['server']).toBe('team-g2-remote')
    expect(typeof registered[0]?.['provider']?.['request']).toBe('function') // the mcp-resources provider face {request}
    expect(() => port.register(face)).toThrow(/ALREADY_REGISTERED/) // one port, one scope registration
    const out = await (registered[0]?.['provider']?.['request'] as (r: unknown, e: unknown) => Promise<Record<string, unknown>>)({ method: 'resources/list' }, EXEC)
    expect((out['resources'] as unknown[]).length).toBe(1)
    expect(() => port.register({ register: 'not-a-function' } as unknown as { register: (s: string, p: unknown) => () => void })).toThrow(/FACE_INCOMPLETE/)
    expect(() => ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'other-name', entries: { Client: sdk.Client }, makeTransport: () => pair1.a, toolCallTimeoutMs: TIMEOUT })).toThrow(/CONFIG_INCOMPLETE/) // same-source ⇒ same name
    expect(() => ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'team-g2-remote', entries: { Client: sdk.Client }, makeTransport: () => pair1.a })).toThrow(/CONFIG_INCOMPLETE/) // no defaulted timeout
    expect(() => ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'team-g2-remote', entries: { Client: sdk.Client }, toolCallTimeoutMs: TIMEOUT })).toThrow(/CONFIG_INCOMPLETE/) // transport factory REQUIRED
    const junk = ASM.createG2TeamMcpPort({ declaredSurfaceConfig: surface, resourceServerName: 'team-g2-remote', entries: { Client: sdk.Client }, makeTransport: () => ({ start: async () => {} }), toolCallTimeoutMs: TIMEOUT }) // missing send/close
    const jerr = await asyncError(() => junk.reconnect())
    expect(jerr.code).toBe(AC.FACE_INCOMPLETE) // non-Transport refused BEFORE the SDK touches it
    expect(junk.stats()).toMatchObject({ transportsBuilt: 0, connected: false })
  }, 30000)

  it('stdio surface: the frozen target carries the approved spawn identity (argv0/args/cwd) — the SAME source the seam captures against', async () => {
    const stdioSurface = { serverName: 'team-g2-local', transport: 'stdio', command: ['node', 'server.mjs', '--stdio'], cwd: '/srv/mcp/team-g2' }
    let seenTarget: Record<string, unknown> | null = null
    const pair1 = await makePair()
    const port = ASM.createG2TeamMcpPort({
      declaredSurfaceConfig: stdioSurface,
      resourceServerName: 'team-g2-local',
      entries: { Client: sdk.Client },
      makeTransport: (t: Record<string, unknown>) => { seenTarget = t; return pair1.a },
      toolCallTimeoutMs: TIMEOUT,
    })
    await port.reconnect()
    expect(seenTarget).toEqual({ server: 'team-g2-local', transport: 'stdio', spawn: { argv0: 'node', args: ['server.mjs', '--stdio'], cwd: '/srv/mcp/team-g2' } })
    const cap = port.captureConnection()
    expect(cap['spawn']).toEqual({ argv0: 'node', args: ['server.mjs', '--stdio'], cwd: '/srv/mcp/team-g2' }) // factory target == capture target == approved config
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
    const closing = port.close() // close JOINS the serial chain — its own step starts on the next microtask
    await Promise.resolve()
    expect(unregistered).toBe(1) // unregister FIRST in close's own order (before drain, before any client close)
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
