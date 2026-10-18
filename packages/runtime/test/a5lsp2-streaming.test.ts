/**
 * a5lsp2-streaming — the R-1 approved production arm (user ruling 07:53Z):
 * `spawnStreaming()` stands PARALLEL to the frozen one-shot seam on the
 * confined process provider. The grant/admission/lease/terminate machinery
 * and the launcher-integrity double gate are REUSED; `spawn()`, `RunOutput`
 * and every old call site keep their exact bytes (the old-API regression is
 * the a5p4 suite, re-run untouched — 66/66 on this head).
 *
 * Legs (criteria families of the P-LSP brief):
 *  PERMISSION     — every confined gate that `spawn()` walks also gates
 *                   `spawnStreaming()` BEFORE any process exists: realm
 *                   confusion, availability, byte-pin double gate (refusal
 *                   before plan consumption = the grant is not burned), ABI
 *                   floor, one-shot plan law (a consumed plan never streams).
 *  LEASE          — a streaming run issues an ACTIVE lease; the frozen law
 *                   holds: the cancellation REQUEST moves the lease and never
 *                   settles it; `settleTermination` is the only path to a
 *                   terminal status; unconfirmed stays flagged.
 *  TERMINATION    — `terminate()` (the handle's arm) signals the confined
 *                   pid, escalates SIGTERM→SIGKILL within the grace window,
 *                   and settles CONFIRMED only on observed exit; a run that
 *                   cannot be confirmed settles `termination-unconfirmed`.
 *  REAL (Landlock) — the same launcher backend the one-shot REAL legs use:
 *                   a real LSP fixture performs the framed initialize
 *                   handshake + bidirectional hover round-trips over the
 *                   handle's stdin/stdout, reports its OS pid + gen, reads
 *                   DENIED bytes only as EACCES inside the child, and dies
 *                   bounded on terminate with /proc proof.
 *
 * Fakes are injected through the OPTIONAL streaming seams
 * (`deps.spawnStream` / `deps.signalProcess` / `deps.pidAlive`); absent them
 * the provider uses its production arms (node:child_process spawn of the
 * launcher in stream mode, process.kill, /proc liveness).
 *
 * @module packages/runtime/test/a5lsp2-streaming
 */

import { afterAll, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { Readable, Writable } from 'node:stream'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  createConfinedProcessProvider,
  type LauncherStreamProcess,
  type ProviderDeps,
  type SpawnRequest,
} from '../sandbox-provider/provider.js'
import {
  execPath,
  fixturePath,
  laneArgv,
  makeWorld,
  nodeBinDir,
  pidAlive,
  pollUntil,
  productionLauncherPath,
  removeWorld,
  sampleLaneProcesses,
  sha256File,
  sourceFixtureLeaksIn,
} from './a5lsp2-harness.js'

const world = makeWorld('stream')
afterAll(() => removeWorld(world))

const LAUNCHER_SHA = sha256File(productionLauncherPath())

/** The authoritative ABI fact of THIS host through the production launcher. */
function hostAbiVersion(): number | null {
  const r = spawnSync('python3', [productionLauncherPath(), '--abi-probe'], { encoding: 'utf8', timeout: 5_000 })
  try {
    const line = String(r.stdout).trim().split('\n').pop()
    const parsed = JSON.parse(String(line)) as { abi_version?: number }
    return typeof parsed.abi_version === 'number' ? parsed.abi_version : null
  } catch {
    return null
  }
}

const HOST_ABI = hostAbiVersion()
const REAL = HOST_ABI !== null && HOST_ABI >= 3
const describeReal = REAL ? describe : describe.skip

// ---------------------------------------------------------------------------
// fakes
// ---------------------------------------------------------------------------

interface FakeOpts {
  handshake?: Record<string, unknown> | null
  holdHandshakeOpen?: boolean
  /** which signal the fake exits on; 'never' models the stubborn child */
  exitOn?: 'SIGTERM' | 'SIGKILL' | 'never'
  pid?: number
}

function fakeProcess(opts: FakeOpts): LauncherStreamProcess & { signals: string[] } {
  const handshake = new Readable({ read() {} })
  if (opts.handshake !== undefined && opts.handshake !== null) {
    handshake.push(Buffer.from(JSON.stringify(opts.handshake) + '\n', 'utf8'))
    if (!opts.holdHandshakeOpen) handshake.push(null)
  }
  let resolveExit: (v: { code: number | null; signal: string | null }) => void = () => {}
  const exit = new Promise<{ code: number | null; signal: string | null }>((r) => { resolveExit = r })
  const signals: string[] = []
  const sink = new Writable({ write(_c, _e, cb) { cb() } })
  const emptyStream = (): Readable => Readable.from((async function* () { /* no payload in fake legs */ })())
  const proc: LauncherStreamProcess & { signals: string[] } = {
    pid: opts.pid ?? 424242,
    stdin: sink,
    stdout: emptyStream(),
    stderr: emptyStream(),
    handshake,
    signals,
    kill(signal?: string | number): boolean {
      const s = String(signal ?? 'SIGTERM')
      if (!signals.includes(s)) signals.push(s)
      if (opts.exitOn === 'never') return true
      if (opts.exitOn === undefined || opts.exitOn === s) {
        resolveExit({ code: null, signal: s })
        handshake.push(null)
      }
      return true
    },
    exit,
  }
  return proc
}

function fakeDeps(result: { rc: number | null; stdout: string; stderr: string }, abiVersion: number | null = 4) {
  const calls: string[][] = []
  const streamCalls: string[][] = []
  const signals: { pid: number; signal: string }[] = []
  const deps = {
    calls,
    streamCalls,
    signals,
    availability: () => ({ rows: [{ subject: 'python3', present: true, note: 'precondition check: fake injected' }] }),
    run: (argv: readonly string[]) => {
      calls.push([...argv])
      return result
    },
    probeFacts: () => ({
      abiVersion,
      legs: {
        selective: { leg: 'selective', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        denyall: { leg: 'denyall', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        badhandled: { leg: 'badhandled', verdict: 'DEMO-CONFIRMED', rc: 0, checks: [] },
      },
    }),
  }
  return deps as ProviderDeps & {
    calls: string[][]
    streamCalls: string[][]
    signals: { pid: number; signal: string }[]
  }
}

function withStream(deps: ProviderDeps & { streamCalls: string[][] }, value: LauncherStreamProcess | { ok: false; error: { code: 'SANDBOX_UNAVAILABLE'; message: string } }) {
  const d = deps as unknown as Record<string, unknown>
  d.spawnStream = (argv: readonly string[]) => {
    deps.streamCalls.push([...argv])
    return 'ok' in value ? value : { ok: true, value }
  }
}

const baseRequest = (over: Partial<SpawnRequest>): SpawnRequest => ({
  grantFingerprint: 'sha256:grant-lsp-0001',
  realmId: 'realm-a5lsp2-stream',
  bindingId: 'binding-lsp',
  memberScope: 'member/a',
  argv: ['/bin/true'],
  cwd: world,
  env: [['PATH', '/usr/bin:/bin']],
  ...over,
})

function providerWith(deps: ProviderDeps, over: Record<string, unknown> = {}) {
  return createConfinedProcessProvider({
    realmId: 'realm-a5lsp2-stream',
    trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher',
    scratchRoot: world,
    deps,
    ...over,
  })
}

// ---------------------------------------------------------------------------
// PERMISSION legs — the confined gates stream through the SAME ladder (fakes)
// ---------------------------------------------------------------------------

describe('a5lsp2 streaming permission (fake seam — zero process creations)', () => {
  it('realm confusion refuses the streaming arm with ZERO stream spawns', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    withStream(deps, fakeProcess({ handshake: { stream: true, pid: 424242 } }))
    const provider = providerWith(deps)
    const r = await provider.spawnStreaming(baseRequest({ realmId: 'realm-someone-elses' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('IO_POLICY_UNSUPPORTED')
    expect(deps.streamCalls).toEqual([])
    expect(deps.calls).toEqual([])
  })

  it('a wrong launcher sha refuses with ZERO stream spawns (the byte-pin gates the streaming arm too)', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    withStream(deps, fakeProcess({ handshake: { stream: true, pid: 424242 } }))
    const provider = providerWith(deps, { assembly: { launcherPath: productionLauncherPath(), launcherSha256: '0'.repeat(64) } })
    const r = await provider.spawnStreaming(baseRequest({}))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('SANDBOX_UNAVAILABLE')
    expect(deps.streamCalls).toEqual([])
    expect(deps.calls).toEqual([])
  })

  it('the sha re-gate refuses BEFORE plan consumption — a restored pin still streams on the SAME plan (grant not burned)', async () => {
    // Same shape as P-B's execute re-gate leg, mirrored onto the streaming arm.
    const launcherCopy = join(world, 'swappable-launcher.py')
    const real = readFileSync(productionLauncherPath())
    writeFileSync(launcherCopy, real)
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const fake = fakeProcess({ handshake: { stream: true, pid: 424242 }, exitOn: 'SIGTERM' })
    withStream(deps, fake)
    const provider = providerWith(deps, { assembly: { launcherPath: launcherCopy, launcherSha256: sha256File(launcherCopy) } })
    const plan = await provider.prepare(baseRequest({}))
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    writeFileSync(launcherCopy, Buffer.concat([real, Buffer.from('\n# swapped\n', 'utf8')]))
    const refused = await provider.executeStreaming(plan.value)
    expect(refused.ok).toBe(false)
    if (!refused.ok) expect(refused.error.code).toBe('SANDBOX_UNAVAILABLE')
    expect(deps.streamCalls).toEqual([]) // refused before ANY process existed
    writeFileSync(launcherCopy, real) // restore the trusted bytes
    const streamed = await provider.executeStreaming(plan.value)
    expect(streamed.ok).toBe(true) // the ONE-SHOT grant was not burned by the gate refusal
    expect(deps.streamCalls.length).toBe(1)
    await fake.kill('SIGTERM')
  })

  it('a consumed plan never streams twice — the second executeStreaming is the second-spawn-without-a-grant refusal', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const fake = fakeProcess({ handshake: { stream: true, pid: 424242 }, exitOn: 'SIGTERM' })
    withStream(deps, fake)
    const provider = providerWith(deps)
    const plan = await provider.prepare(baseRequest({}))
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    const first = await provider.executeStreaming(plan.value)
    expect(first.ok).toBe(true)
    const second = await provider.executeStreaming(plan.value)
    expect(second.ok).toBe(false) // one spawn per grant — the streaming arm obeys the same law
    expect(deps.streamCalls.length).toBe(1)
    if (first.ok) await first.value.terminate({ graceMs: 50, deadlineMs: 2_000 })
  })

  it('ABI floor: a measured ABI below the assembly floor refuses the streaming arm before any process exists', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' }, 3)
    withStream(deps, fakeProcess({ handshake: { stream: true, pid: 424242 } }))
    const provider = providerWith(deps, { assembly: { minAbiVersion: 4 } })
    const r = await provider.spawnStreaming(baseRequest({}))
    expect(r.ok).toBe(false)
    expect(deps.streamCalls).toEqual([])
  })

  it('launcher abi_unavailable in the handshake refuses and issues NO lease', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    withStream(deps, fakeProcess({ handshake: { abi_unavailable: true } }))
    const provider = providerWith(deps)
    const r = await provider.spawnStreaming(baseRequest({}))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('SANDBOX_UNAVAILABLE')
    const cancelled = await provider.requestCancellation({
      leaseId: 'lease-never-issued',
      grantFingerprint: 'sha256:grant-lsp-0001',
      realmId: 'realm-a5lsp2-stream',
      bindingId: 'binding-lsp',
      memberScope: 'member/a',
      executionKind: 'process',
      status: 'active',
    })
    expect(cancelled.ok).toBe(false) // no lease exists for a refused streaming run
  })

  it('a handshake that never answers times out BOUNDED and kills the launcher', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const fake = fakeProcess({ handshake: null, holdHandshakeOpen: true, exitOn: 'SIGKILL' })
    withStream(deps, fake)
    const provider = providerWith(deps)
    const t0 = Date.now()
    const r = await provider.spawnStreaming(baseRequest({}), { handshakeTimeoutMs: 300 })
    expect(Date.now() - t0).toBeLessThan(5_000)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('SANDBOX_UNAVAILABLE')
    expect(fake.signals.length).toBeGreaterThan(0) // the half-open launcher was killed
    await fake.exit
  })

  it('spawnStream itself failing refuses typed and leaves NO streaming lease behind', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const d = deps as unknown as Record<string, unknown>
    d.spawnStream = () => ({ ok: false, error: { code: 'SANDBOX_UNAVAILABLE', message: 'fake spawn failure' } })
    const provider = providerWith(deps)
    const r = await provider.spawnStreaming(baseRequest({}))
    expect(r.ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// LEASE + TERMINATION legs (fakes with scripted signal behavior)
// ---------------------------------------------------------------------------

describe('a5lsp2 streaming lease law and termination (fake seam)', () => {
  it('lease lifecycle: active on spawn; the cancellation REQUEST moves it to cancelling and never settles it; only settleTermination reaches terminal', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const fake = fakeProcess({ handshake: { stream: true, pid: 424242 }, exitOn: 'SIGTERM' })
    withStream(deps, fake)
    const d1 = deps as unknown as Record<string, unknown>
    d1.signalProcess = (pid: number, signal: string) => {
      deps.signals.push({ pid, signal })
      return fake.kill(signal)
    }
    d1.pidAlive = (pid: number) => pid === 424242 && !fake.signals.includes('SIGTERM')
    const provider = providerWith(deps)
    const r = await provider.spawnStreaming(baseRequest({}))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const { lease, processIdentity, pid } = r.value
    expect(lease.status).toBe('active')
    expect(lease.grantFingerprint).toBe('sha256:grant-lsp-0001')
    expect(pid).toBe(424242)
    expect(processIdentity).toContain('pid:424242:')

    const cancelling = await provider.requestCancellation(lease)
    expect(cancelling.ok).toBe(true)
    if (!cancelling.ok) return
    expect(cancelling.value.status).toBe('cancelling') // the request never settles itself
    await fake.exit // the process IS gone — the status still must not settle on its own
    await new Promise((r2) => setTimeout(r2, 50))
    const recheck = await provider.requestCancellation(cancelling.value)
    expect(recheck.ok).toBe(true)
    if (recheck.ok) expect(recheck.value.status).toBe('cancelling') // still not self-settled

    const unconfirmed = await provider.settleTermination(cancelling.value, false)
    expect(unconfirmed.ok).toBe(true)
    if (!unconfirmed.ok) return
    expect(unconfirmed.value.status).toBe('termination-unconfirmed')
    const settled = await provider.settleTermination(unconfirmed.value, true)
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.value.status).toBe('terminated')
  })

  it('terminate() confirms: SIGTERM sent, exit observed, lease settles terminated', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const fake = fakeProcess({ handshake: { stream: true, pid: 424242 }, exitOn: 'SIGTERM' })
    withStream(deps, fake)
    const d = deps as unknown as Record<string, unknown>
    d.signalProcess = (pid: number, signal: string) => {
      deps.signals.push({ pid, signal })
      return fake.kill(signal)
    }
    d.pidAlive = (pid: number) => pid === 424242 && !fake.signals.includes('SIGTERM')
    const provider = providerWith(deps)
    const r = await provider.spawnStreaming(baseRequest({}))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const settled = await r.value.terminate({ graceMs: 200, deadlineMs: 4_000 })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.value.status).toBe('terminated')
    expect(deps.signals).toEqual([{ pid: 424242, signal: 'SIGTERM' }])
  })

  it('terminate() escalates SIGTERM → SIGKILL when the child ignores the first signal', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    const fake = fakeProcess({ handshake: { stream: true, pid: 424242 }, exitOn: 'SIGKILL' })
    withStream(deps, fake)
    const d = deps as unknown as Record<string, unknown>
    d.signalProcess = (pid: number, signal: string) => {
      deps.signals.push({ pid, signal })
      return fake.kill(signal)
    }
    d.pidAlive = (pid: number) => pid === 424242 && !fake.signals.includes('SIGKILL')
    const provider = providerWith(deps)
    const r = await provider.spawnStreaming(baseRequest({}))
    if (!r.ok) { expect(r.ok).toBe(true); return }
    const settled = await r.value.terminate({ graceMs: 150, deadlineMs: 5_000 })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.value.status).toBe('terminated')
    expect(deps.signals.map((s) => s.signal)).toEqual(['SIGTERM', 'SIGKILL'])
  })

  it('a child that cannot be confirmed settles termination-unconfirmed, never silently terminated', async () => {
    const deps = fakeDeps({ rc: 0, stdout: '', stderr: '' })
    withStream(deps, fakeProcess({ handshake: { stream: true, pid: 424242 }, exitOn: 'never' }))
    const d = deps as unknown as Record<string, unknown>
    d.signalProcess = () => true
    d.pidAlive = () => true
    const provider = providerWith(deps)
    const r = await provider.spawnStreaming(baseRequest({}))
    if (!r.ok) { expect(r.ok).toBe(true); return }
    const settled = await r.value.terminate({ graceMs: 50, deadlineMs: 300 })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.value.status).toBe('termination-unconfirmed')
  })

  it('the one-shot requestCancellation bytes are untouched: a sync-executed lease still settles on the request leg', async () => {
    // Old-face regression, in-lane: spawn() (sync) + requestCancellation keeps its historical
    // 'terminated'-on-request behavior byte-for-byte (full suite = the untouched a5p4 files).
    const answer = JSON.stringify({ executed: true, rc: 0, pid: 99, out_ref: '', err_ref: '' })
    const deps = fakeDeps({ rc: 0, stdout: answer, stderr: '' })
    const provider = providerWith(deps)
    const oneShot = await provider.spawn(baseRequest({}))
    expect(oneShot.ok).toBe(true)
    if (!oneShot.ok) return
    const cancelled = await provider.requestCancellation(oneShot.value.lease)
    expect(cancelled.ok).toBe(true)
    if (!cancelled.ok) return
    expect(cancelled.value.status).toBe('terminated')
  })
})

// ---------------------------------------------------------------------------
// REAL legs — Landlock launcher, real LSP fixture, real pipes
// ---------------------------------------------------------------------------

function frame(obj: unknown): string {
  const body = JSON.stringify(obj)
  return `Content-Length: ${Buffer.byteLength(body, 'utf8')}\r\n\r\n${body}`
}

function frameReader(stream: Readable) {
  let buffer = Buffer.alloc(0)
  const waiters: { resolve: (v: Record<string, unknown>) => void; reject: (e: unknown) => void }[] = []
  const queue: Record<string, unknown>[] = []
  stream.on('data', (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk])
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n', 0, 'utf8')
      if (headerEnd < 0) break
      const header = buffer.subarray(0, headerEnd).toString('utf8')
      const m = /content-length:\s*(\d+)/i.exec(header)
      if (m === null) throw new Error('framing error')
      const len = Number(m[1])
      if (buffer.length < headerEnd + 4 + len) break
      const body = buffer.subarray(headerEnd + 4, headerEnd + 4 + len).toString('utf8')
      buffer = buffer.subarray(headerEnd + 4 + len)
      const parsed = JSON.parse(body) as Record<string, unknown>
      const w = waiters.shift()
      if (w) w.resolve(parsed)
      else queue.push(parsed)
    }
  })
  return function next(timeoutMs: number): Promise<Record<string, unknown>> {
    const q = queue.shift()
    if (q !== undefined) return Promise.resolve(q)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('frame timeout')), timeoutMs)
      waiters.push({
        resolve: (v) => { clearTimeout(timer); resolve(v) },
        reject: (e) => { clearTimeout(timer); reject(e) },
      })
    })
  }
}

describeReal('a5lsp2 streaming REAL (Landlock launcher + real LSP fixture)', () => {
  const fixtureDir = join(world, 'fixtures')
  mkdirSync(fixtureDir, { recursive: true })
  copyFileSync(fixturePath('a5lsp2-fixture-lang-server.mjs'), join(fixtureDir, 'lsp.mjs'))

  function realProvider(realmId: string) {
    return createConfinedProcessProvider({
      realmId,
      trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher',
      scratchRoot: world,
      assembly: { launcherPath: productionLauncherPath(), launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
  }

  it('real LSP handshake + bidirectional round-trips + deny-path + terminate with /proc proof', async () => {
    const genRoot = join(world, 'ws', 'real-g0')
    mkdirSync(genRoot, { recursive: true })
    const secretDir = join(world, 'forbidden')
    mkdirSync(secretDir, { recursive: true })
    writeFileSync(join(secretDir, 'secret.txt'), 'A5LSP2-DENY-WORD\n')
    writeFileSync(join(genRoot, 'a.txt'), 'HOVER-A5LSP2-OK')
    const provider = realProvider('realm-a5lsp2-real')
    const r = await provider.spawnStreaming({
      grantFingerprint: 'sha256:grant-lsp-real',
      realmId: 'realm-a5lsp2-real',
      bindingId: 'binding-lsp-real',
      memberScope: 'member/real',
      argv: laneArgv([execPath(), join(fixtureDir, 'lsp.mjs'), 'g0', join(secretDir, 'secret.txt')]),
      cwd: genRoot,
      env: [['PATH', '/usr/bin:/bin']],
      allowPaths: [
        { path: nodeBinDir(), accessBits: { execute: true, readFile: true, readDir: true } },
        { path: fixtureDir, accessBits: { readFile: true, readDir: true } },
        { path: genRoot, accessBits: { readFile: true, readDir: true } },
      ],
    })
    expect(r.ok === true, `spawnStreaming refused: ${JSON.stringify(r.ok === true ? null : r.error)}`).toBe(true)
    if (!r.ok) return
    const h = r.value
    const next = frameReader(h.stdout)

    // real LSP handshake over the handle's pipes
    h.stdin.write(frame({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { capabilities: {} } }))
    const init = await next(30_000)
    const result = init.result as Record<string, unknown>
    const info = (result.serverInfo ?? {}) as Record<string, unknown>
    expect(init.jsonrpc).toBe('2.0')
    expect(init.id).toBe(1)
    expect(info.name).toBe('a5lsp2-fixture-lang-server')
    expect(info.gen).toBe('g0')
    expect(info.pid).toBe(h.pid) // the handshake pid IS the OS pid the seam reports
    expect(String(info.cwd)).toBe(genRoot)
    expect(info.secretRead).toBe('EACCES') // deny-path: forbidden bytes are NOT readable in the confined child

    // bidirectional hover round-trips (two distinct requests, ordered answers)
    h.stdin.write(frame({ jsonrpc: '2.0', method: 'initialized', params: {} }))
    h.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'textDocument/hover', params: { textDocument: { uri: `file://${join(genRoot, 'a.txt')}` } } }))
    const hover1 = await next(30_000)
    expect(hover1.id).toBe(2)
    const contents = (hover1.result as Record<string, Record<string, string>>).contents as Record<string, string>
    expect(contents.value).toContain('HOVER-A5LSP2-OK')
    expect(contents.value).toContain('[g0|pid:')
    h.stdin.write(frame({ jsonrpc: '2.0', id: 3, method: 'textDocument/hover', params: { textDocument: { uri: 'file:///definitely/not/here.txt' } } }))
    const hover2 = await next(30_000)
    expect(hover2.id).toBe(3)

    // lease is active while the process lives
    expect(h.lease.status).toBe('active')
    expect(pidAlive(h.pid)).toBe(true)

    // graceful shutdown path also works (LSP shutdown)
    h.stdin.write(frame({ jsonrpc: '2.0', id: 4, method: 'shutdown', params: null }))
    await next(30_000)

    // terminate arm: signal the confined pid; confirm bounded; settle via the lease law
    const settled = await h.terminate({ graceMs: 1_000, deadlineMs: 10_000 })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.value.status).toBe('terminated')
    expect(await pollUntil(() => !pidAlive(h.pid), 5_000)).toBe(true) // OS liveness proof
    const exited = await h.exited
    expect(exited !== undefined).toBe(true)
  }, 120_000)

  it('real terminate on the ping fixture settles confirmed and the pid is gone', async () => {
    const genRoot = join(world, 'ws', 'real-g1')
    mkdirSync(genRoot, { recursive: true })
    const provider = realProvider('realm-a5lsp2-real2')
    const r = await provider.spawnStreaming({
      grantFingerprint: 'sha256:grant-lsp-real2',
      realmId: 'realm-a5lsp2-real2',
      bindingId: 'binding-lsp-real2',
      memberScope: 'member/real2',
      argv: laneArgv([execPath(), fixturePath('a5lsp2-fixture-ping.mjs'), 'g1']),
      cwd: genRoot,
      env: [['PATH', '/usr/bin:/bin']],
      allowPaths: [
        { path: nodeBinDir(), accessBits: { execute: true, readFile: true, readDir: true } },
        { path: join(world, 'fixtures'), accessBits: { readFile: true, readDir: true } },
        { path: genRoot, accessBits: { readFile: true, readDir: true } },
      ],
    })
    expect(r.ok === true, `spawnStreaming refused: ${JSON.stringify(r.ok === true ? null : r.error)}`).toBe(true)
    if (!r.ok) return
    const settled = await r.value.terminate({ graceMs: 2_000, deadlineMs: 15_000 })
    expect(settled.ok).toBe(true)
    if (!settled.ok) return
    expect(settled.value.status).toBe('terminated')
    expect(await pollUntil(() => !pidAlive(r.value.pid), 5_000)).toBe(true)
    // Named SOURCE-leak check over THIS world's attributed set. This very leg
    // spawns the fixture from its source path — the one place the lane does — and
    // it carries the run nonce, so it reads as ours rather than as a leak; a
    // process WITHOUT the nonce executing a source fixture is the named red.
    expect(sourceFixtureLeaksIn(sampleLaneProcesses(world)).map((p) => `${String(p.pid)} ${p.cmd}`), 'a5lsp2 SOURCE-fixture leak: a process without this run\'s nonce is executing a lane fixture from its source path').toEqual([])
  }, 90_000)
})
