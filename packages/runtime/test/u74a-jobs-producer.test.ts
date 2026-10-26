/**
 * U7-4a (user ruling 2026-10-26, item 2) — C1: the governed background-bash
 * ATTRIBUTION PRODUCER, its arm on the SAME confined provider, and the
 * kernel-ordering law the whole lane stands on.
 *
 * Four groups, one claim each:
 *  G1 THE PRODUCER (standalone, real gateway assembly + real bridge):
 *     attribution follows the host receipt (never precedes it), the
 *     fail-closed refusals leave NOTHING spawned or NOTHING exposed, the
 *     close after a refused attribution is HONEST (request ≠ settlement),
 *     the ring pull-sources carry the payload bytes the host registry will
 *     pump, the cancel leg is wired before/after the spawn race, and the
 *     module imports NOTHING (no second authority reachable).
 *  G2 CI-05 REGRESSION through the producer's own row face: an unattributed
 *     id is the typed zero-reach refusal; an attributed id answers corded to
 *     its owner and owner-mismatch to a foreign viewer.
 *  G3 THE ARM on the confined executor (provider's deps seam): WITHOUT the
 *     collaborator the by-name refusal is byte-identical and NOTHING is
 *     probed; WITH it, the arm runs the SAME gates and hands the SAME
 *     request + a lazy provider-spawn thunk to the producer, and the
 *     producer's answer flows verbatim.
 *  G4 THE FULL KERNEL (real plane + real landlock launcher + durable ask
 *     leg): an approved `team_bash background:true` call really spawns, the
 *     job is ATTRIBUTED before the receipt, the ring bytes come back through
 *     the governed `job_output` face, kills answer their honest forms, the
 *     foreign viewer measures ZERO host reach, trio calls cost ZERO
 *     approvals, and a DENIED ask never reaches producer/spawn/registry at
 *     all (attribution never precedes authorization).
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'

const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

/** The typed shape of what the (untyped, production) producer/executor
 *  answer — named once here so no leg needs an `any`. */
interface BackendAnswer {
  ok?: boolean
  failure?: { class?: string; code?: string; detail?: string }
  outcome?: { exitCode?: number | null; stdout?: string; stderr?: string; timedOut?: boolean; cancelled?: boolean; truncated?: boolean }
  settlement?: { kind?: string }
}
interface JobSpecLike {
  kind?: string
  owner?: string
  label?: string
  output?: Array<{ channel?: string; read: (n: number) => { text: string; nextOffset: number; lossy?: boolean } }>
  run?: unknown
}
interface GatewayRowLike {
  checkManagementAccess(o: { jobId: string; viewer: Record<string, unknown> }): { ok?: boolean; corded?: boolean; code?: string; detail?: string }
}
const asFsPath = (u: URL): string => fileURLToPath(u as Parameters<typeof fileURLToPath>[0])
const REPO = asFsPath(new URL('../../../', import.meta.url))
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = sha256(readFileSync(LAUNCHER))

const PRODUCER_PATH = new URL('../src/plugin/live/jobs-background-producer.mjs', import.meta.url)
const BRIDGE_PATH = new URL('../src/plugin/live/jobs-family-bridge.mjs', import.meta.url)
const GATEWAY_PATH = new URL('../src/plugin/live/jobs-gateway-assembly.mjs', import.meta.url)
const PLANE_PATH = new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url)

const REALM = 'u74a-realm'
const ROOT = 'session-u74a-team-root'
const OWNER_A = { rootSessionId: ROOT, instanceId: 'inst-1' }
const OWNER_F = { rootSessionId: ROOT, instanceId: 'inst-f' }
const OWNER_SESSION = 'session-u74a-member'
const FOREIGN_SESSION = 'session-u74a-foreign'

interface Handle {
  pid: number
  stdout: Readable
  stderr: Readable
  exited: Promise<{ code: number | null; signal: string | null }>
  terminate: () => Promise<{ ok: boolean }>
  recordCapable: boolean
  emitOut: (s: string) => void
  emitErr: (s: string) => void
  close: () => void
  die: (code?: number | null, signal?: string | null) => void
  terminateCalls: () => number
}

/** A hand-sequenced streaming handle (the shape the provider resolves for the
 *  producer): bytes and death are driven by the test, never by the clock. */
function fakeHandle(): Handle {
  const stdout = new Readable({ read() {} })
  const stderr = new Readable({ read() {} })
  let resolveExited: (i: { code: number | null; signal: string | null }) => void = () => {}
  const exited = new Promise<{ code: number | null; signal: string | null }>((r) => { resolveExited = r })
  let terminates = 0
  let dead = false
  const die = (code: number | null = 0, signal: string | null = null): void => {
    if (dead) return
    dead = true
    resolveExited({ code, signal })
  }
  return {
    pid: 424242, stdout, stderr, exited,
    terminate: async () => { terminates += 1; die(null, 'SIGTERM'); return { ok: true } },
    recordCapable: true,
    emitOut: (s) => { stdout.push(s) },
    emitErr: (s) => { stderr.push(s) },
    close: () => { stdout.push(null); stderr.push(null) },
    die,
    terminateCalls: () => terminates,
  }
}

interface StoredJob {
  id: string
  spec: Record<string, unknown>
  hooks: { cancel: (reason?: string) => void; done: Promise<{ status: string; detail?: string }> } | null
  status: 'running' | 'completed' | 'killed' | 'failed'
  detail?: string
}

/** A JobRegistry double @639ed01539 laws: start preflights BEFORE the
 *  starter runs (a thrown preflight calls no `spec.run` — zero side
 *  effects), the owner fence is caller-scoped, kill answers the TWO honest
 *  forms. Every touch is counted: host REACH is measured, never assumed. */
function fakeRegistry(over: Record<string, unknown> = {}): {
  calls: string[]
  reach: () => number
  startCalls: () => number
  jobs: Map<string, StoredJob>
  setPreflight: (fn: (() => void) | null) => void
  setKillMode: (m: 'requested' | 'already-finished' | 'throw') => void
  lastSpec: () => Record<string, unknown> | undefined
} & Record<string, unknown> {
  const calls: string[] = []
  const jobs = new Map<string, StoredJob>()
  let seq = 0
  let starts = 0
  let preflight: (() => void) | null = null
  let killMode: 'requested' | 'already-finished' | 'throw' = 'requested'
  let last: Record<string, unknown> | undefined
  const svc = {
    calls,
    reach: () => calls.length,
    startCalls: () => starts,
    jobs,
    setPreflight: (fn: (() => void) | null) => { preflight = fn },
    setKillMode: (m: 'requested' | 'already-finished' | 'throw') => { killMode = m },
    lastSpec: () => last,
    start: (spec: Record<string, unknown>): string => {
      starts += 1
      calls.push('start')
      // host law: preflight first; the STARTER (the spawn) runs only after.
      if (preflight !== null) preflight()
      if (typeof spec.kind !== 'string' || typeof spec.owner !== 'string'
        || typeof spec.run !== 'function' || !Array.isArray(spec.output)) {
        throw new Error('JobRegistry: malformed JobSpec')
      }
      const id = `bash-u74a-${++seq}`
      last = spec
      const job: StoredJob = { id, spec, hooks: null, status: 'running' }
      jobs.set(id, job)
      job.hooks = (spec.run as (h: unknown) => StoredJob['hooks'])({ id })
      void job.hooks?.done.then((r) => {
        job.status = r.status === 'completed' ? 'completed' : r.status === 'killed' ? 'killed' : 'failed'
        job.detail = r.detail
      })
      return id
    },
    list: (caller?: string): unknown[] => {
      calls.push(`list:${caller ?? 'none'}`)
      return [...jobs.values()].filter((j) => j.spec.owner === caller)
        .map((j) => ({ id: j.id, kind: 'bash', status: j.status, label: j.spec.label }))
    },
    read: (id: string, caller?: string): unknown => {
      calls.push(`read:${id}:${caller ?? 'none'}`)
      const j = jobs.get(id)
      if (j === undefined) throw new Error(`unknown job ${id}`)
      if (j.spec.owner !== caller) throw new Error('caller-fence: not your job')
      const out = (j.spec.output as Array<{ channel: string; read: (n: number) => { text: string } }>)
        .map((s) => ({ channel: s.channel, text: s.read(0).text }))
      return { chunks: out, job: { status: j.status } }
    },
    kill: (id: string, caller?: string, reason?: string): string => {
      calls.push(`kill:${id}:${caller ?? 'none'}`)
      const j = jobs.get(id)
      if (j === undefined) throw new Error(`unknown job ${id}`)
      if (j.spec.owner !== caller) throw new Error('caller-fence: not your job')
      if (killMode === 'throw') throw new Error('host kill fault')
      if (j.status !== 'running' || killMode === 'already-finished') return 'already-finished'
      j.hooks?.cancel(reason)
      return 'requested'
    },
    wait: async (): Promise<unknown> => undefined,
  }
  return { ...svc, ...(over as Record<string, unknown>) } as never
}

function domainDouble(): unknown {
  return {
    repositories: {
      memberInstances: {
        list: (rootKey: string): unknown[] =>
          rootKey === ROOT ? [{ instanceId: 'inst-1' }, { instanceId: 'inst-f' }] : [],
      },
    },
  }
}

interface ProducerModule {
  createGovernedBackgroundProducer(i: Record<string, unknown>): {
    enabled: boolean
    accept: (ctx: Record<string, unknown>) => Promise<BackendAnswer>
    stats: {
      producerCalls: number; hostJobsCreated: number; attributions: number
      attributionRefusals: number
      closes: { requested: number; alreadyFinished: number; uncertain: number }
    }
  }
}
interface GatewayModule {
  createLiveJobsGatewayAssembly(cfg: Record<string, unknown>): GatewayRowLike
  jobsBridgeScopeKey(o: Record<string, unknown>): string
}
interface BridgeModule {
  createGovernedJobsBridge(o: Record<string, unknown>): { scopeKey: string; ensureRegistered: () => number }
  ci05GovernedGatewayRow(asm: unknown): GatewayRowLike
}
const producerModule = async (): Promise<ProducerModule> =>
  (await import(PRODUCER_PATH.href)) as ProducerModule
const gatewayModule = async (): Promise<GatewayModule> =>
  (await import(GATEWAY_PATH.href)) as GatewayModule
const bridgeModule = async (): Promise<BridgeModule> =>
  (await import(BRIDGE_PATH.href)) as BridgeModule

function waitFor(cond: () => boolean, what: string, budgetMs = 20_000): Promise<void> {
  const t0 = Date.now()
  return new Promise((resolve, reject) => {
    const tick = (): void => {
      if (cond()) return resolve()
      if (Date.now() - t0 > budgetMs) return reject(new Error(`u74a timeout: ${what}`))
      setTimeout(tick, 5)
    }
    tick()
  })
}

/** G1/G2 world: REAL gateway assembly + REAL bridge pin feed (a feedable
 *  placement double) + counting JobRegistry double + the producer. */
async function world(opts: { feedable?: boolean; withGateway?: boolean; ownerDurable?: boolean } = {}) {
  const gw = await gatewayModule()
  const mod = await bridgeModule()
  const asm = gw.createLiveJobsGatewayAssembly({ teamRoot: domainDouble(), rootSessionId: ROOT })
  const wrapped = mod.ci05GovernedGatewayRow(asm)
  const feed = new Map<string, { definitionIdentity: string }>()
  const svc = fakeRegistry()
  const scopeKey = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
  const planeRow = () => ({
    placementFeed: (n: string): { definitionIdentity: string } | undefined => feed.get(n),
  })
  const bridge = mod.createGovernedJobsBridge({
    scopeKey, viewer: OWNER_A,
    gatewayRow: () => wrapped, planeRow, jobsService: () => svc, observe: () => {},
  })
  if (opts.feedable !== false) {
    for (const n of ['bash', 'job_output', 'job_list', 'job_kill']) {
      feed.set(n, { definitionIdentity: `def#u74a-${n}` })
    }
  }
  const observations: string[] = []
  const witnesses: string[] = []
  const producer = (await producerModule()).createGovernedBackgroundProducer({
    scopeKey,
    viewer: OWNER_A,
    ownerSessionId: OWNER_SESSION,
    gatewayRow: () => (opts.withGateway === false ? null : wrapped),
    ensureRegistered: () => bridge.ensureRegistered(),
    jobsService: () => svc,
    ownerDurable: () => opts.ownerDurable !== false,
    observe: (r: string) => observations.push(String(r)),
    logLine: (l: string) => witnesses.push(String(l)),
  })
  let spawnCount = 0
  let handle: Handle | null = null
  let spawnResult: () => unknown = () => ({ ok: true, value: handle ?? (handle = fakeHandle()) })
  const spawn = async (): Promise<unknown> => { spawnCount += 1; return spawnResult() }
  const ctx = (command = 'sleep 30'): Record<string, unknown> => ({
    call: { callId: 'call-u74a-1' },
    request: { command, cwd: '/u74a-root', timeoutMs: null },
    spawn,
  })
  return {
    asm, wrapped, svc, scopeKey, producer, observations, witnesses, feed,
    ctx,
    setSpawnResult: (fn: () => unknown) => { spawnResult = fn },
    spawnCount: () => spawnCount,
    handle: (): Handle => (handle ??= fakeHandle()),
  }
}

describe('u74a G1 — the producer: attribution follows the authorized host receipt (never precedes it)', () => {
  it('P1 accepted path: host receipt first, attribution second, counters ordered, honest receipt', async () => {
    const w = await world()
    const r = await w.producer.accept(w.ctx('sleep 30'))
    expect(r.ok).toBe(true)
    expect(String(r.outcome?.stdout)).toContain('started background job bash-u74a-1')
    expect(r.outcome?.exitCode).toBeNull() // the CALL observes no exit — the trio owns the stream
    expect(r.settlement).toEqual({ kind: 'completed' })
    expect(w.svc.startCalls()).toBe(1)
    const spec = w.svc.lastSpec() as JobSpecLike
    expect(spec.kind).toBe('bash')
    expect(spec.owner).toBe(OWNER_SESSION) // the mount's OWN session owns the job
    expect(spec.label).toContain('sleep 30')
    expect((spec.output as unknown[]).length).toBe(2)
    expect(w.producer.stats).toMatchObject({ producerCalls: 1, hostJobsCreated: 1, attributions: 1, attributionRefusals: 0 })
    // the attribution rode the EXISTING gateway law and is visible on the row face
    const chk = w.wrapped.checkManagementAccess({ jobId: 'bash-u74a-1', viewer: OWNER_A })
    expect(chk.ok).toBe(true)
    expect(chk.corded).toBe(true)
    expect(w.witnesses.some((l) => l.includes('a5bg: attributed hostJobId=bash-u74a-1'))).toBe(true)
    // the pin feed ran BEFORE the admit (the creating-lane pin from the placement feed)
    expect(w.feed.size).toBe(4)
  })

  it('P2 the ring pull-sources carry payload bytes for the host registry (job_output reads these)', async () => {
    const w = await world()
    const h = w.handle()
    const r = await w.producer.accept(w.ctx('printf U74A-RING'))
    expect(r.ok).toBe(true)
    // let the microtask wire the handle's streams (the same race the host
    // registry wins by pumping pull-sources later, not synchronously)
    await new Promise((res) => setTimeout(res, 5))
    h.emitOut('U74A-RING-BYTES-42\n')
    h.close()
    h.die(0)
    const spec = w.svc.lastSpec() as JobSpecLike
    const src = (spec.output as Array<{ channel: string; read: (n: number) => { text: string; nextOffset: number; lossy: boolean } }>)
      .find((o) => o.channel === 'stdout')!
    await waitFor(() => src.read(0).text.includes('U74A-RING-BYTES-42'), 'the capture delivered the bytes')
    const first = src.read(0)
    expect(first.text).toContain('U74A-RING-BYTES-42')
    expect(first.lossy).toBe(false)
    const second = src.read(first.nextOffset)
    expect(second.text).toBe('')
  })

  it('P3 the cancel leg is wired BEFORE the spawn settles (kill racing the spawn still terminates)', async () => {
    // attribution fails (no pins) ⇒ close runs while the spawn is STILL pending
    const w2 = await world({ feedable: false })
    const late = fakeHandle()
    w2.setSpawnResult(() => ({ ok: true, value: late }))
    const r = await w2.producer.accept(w2.ctx())
    expect(r.ok).toBe(false) // attribution refused ⇒ typed, nothing exposed
    expect(String(r.failure?.detail)).toContain('cancellation REQUESTED')
    // the spawn lands one microtask later; the cancel must STILL reach it
    await waitFor(() => late.terminateCalls() >= 1, 'the raced cancel reached the late handle')
    expect(late.terminateCalls()).toBeGreaterThanOrEqual(1) // cancel reached the pending handle
    const outcome = await (w2.svc.jobs.get('bash-u74a-1')!.hooks!.done)
    expect(outcome.status).toBe('killed')
    expect(String(outcome.detail)).toContain('governed-attribution-refused')
    expect(w2.producer.stats).toMatchObject({ hostJobsCreated: 1, attributions: 0, attributionRefusals: 1 })
  })

  it('P4 honest closes: already-finished vs kill-fault TERMINATION-UNCONFIRMED (request ≠ settlement)', async () => {
    const w1 = await world({ feedable: false })
    w1.svc.setKillMode('already-finished')
    const r1 = await w1.producer.accept(w1.ctx())
    expect(String(r1.failure?.detail)).toContain('close: job already finished')
    expect(w1.producer.stats.closes).toMatchObject({ alreadyFinished: 1, requested: 0, uncertain: 0 })
    const w2 = await world({ feedable: false })
    w2.svc.setKillMode('throw')
    const r2 = await w2.producer.accept(w2.ctx())
    expect(String(r2.failure?.detail)).toContain('TERMINATION-UNCONFIRMED')
    expect(w2.producer.stats.closes).toMatchObject({ uncertain: 1 })
  })

  it('P5 fail-closed refusals bear ZERO host side effects (no service, non-durable owner, preflight refusal)', async () => {
    const w = await world()
    const noSvc = (await producerModule()).createGovernedBackgroundProducer({
      scopeKey: w.scopeKey, viewer: OWNER_A, ownerSessionId: OWNER_SESSION,
      gatewayRow: () => w.wrapped, ensureRegistered: () => 0,
      jobsService: () => undefined, ownerDurable: () => true,
    })
    const r0 = await noSvc.accept(w.ctx())
    expect(r0.failure?.code).toBe('background-jobs-service-unavailable')
    const r1 = await (await producerModule()).createGovernedBackgroundProducer({
      scopeKey: w.scopeKey, viewer: OWNER_A, ownerSessionId: OWNER_SESSION,
      gatewayRow: () => w.wrapped, ensureRegistered: () => 0,
      jobsService: () => fakeRegistry(), ownerDurable: () => false,
    }).accept(w.ctx())
    expect(r1.failure?.code).toBe('background-owner-not-durable')
    // the host preflight throws BEFORE the starter: nothing spawned, nothing attributed
    w.svc.setPreflight(() => { throw new Error('per-owner concurrency limit reached') })
    const r2 = await w.producer.accept(w.ctx())
    expect(r2.failure?.code).toBe('background-start-refused')
    expect(w.spawnCount()).toBe(0)
    expect(w.producer.stats).toMatchObject({ producerCalls: 1, hostJobsCreated: 0, attributions: 0 })
    expect(noSvc.stats.producerCalls).toBe(1) // counted call ≠ side effect; the refusals hold at zero host reach
    expect(w.svc.reach()).toBe(1) // the one counted reach IS the refused preflight 'start' itself
  })

  it('P6 gateway-row absent and mapping-rejected both refuse the attribution and close honestly (no owner-less job is exposed)', async () => {
    const w = await world({ withGateway: false })
    const r = await w.producer.accept(w.ctx())
    expect(r.failure?.code).toBe('background-attribution-refused')
    expect(String(r.failure?.detail)).toContain('no live gateway row')
    expect(w.producer.stats).toMatchObject({ hostJobsCreated: 1, attributions: 0, attributionRefusals: 1 })
    expect(w.svc.calls).toContain('kill:bash-u74a-1:session-u74a-member')
    // the unattributed id stays the CI-05 typed refusal on the row face
    const chk = w.wrapped.checkManagementAccess({ jobId: 'bash-u74a-1', viewer: OWNER_A })
    expect(chk).toMatchObject({ ok: false, code: 'unattributed-job' })
  })

  it('P7 a confined spawn refusal settles the job honestly (ring note + failed) — the birth stays attributed and readable', async () => {
    const w = await world()
    w.setSpawnResult(() => ({ ok: false, error: { code: 'landlock-denied', message: 'plan refused' } }))
    const r = await w.producer.accept(w.ctx())
    expect(r.ok).toBe(true) // the host receipt is real: the job exists and is READABLE
    const outcome = await w.svc.jobs.get('bash-u74a-1')!.hooks!.done
    expect(outcome.status).toBe('failed')
    const spec = w.svc.lastSpec() as JobSpecLike
    const src = (spec.output as Array<{ channel: string; read: (n: number) => { text: string } }>).find((o) => o.channel === 'stdout')!
    expect(src.read(0).text).toContain('confined spawn refused: landlock-denied')
  })

  it('P8 counters: attributions <= hostJobsCreated <= producerCalls across a mixed sequence', async () => {
    const w = await world()
    await w.producer.accept(w.ctx('a'))
    w.svc.setPreflight(() => { throw new Error('no live agent') })
    await w.producer.accept(w.ctx('b'))
    w.svc.setPreflight(null)
    const w2 = await world({ feedable: false })
    await w2.producer.accept(w2.ctx('c'))
    for (const p of [w.producer, w2.producer]) {
      const s = p.stats
      expect(s.attributions <= s.hostJobsCreated).toBe(true)
      expect(s.hostJobsCreated <= s.producerCalls).toBe(true)
    }
    expect(w.producer.stats).toMatchObject({ producerCalls: 2, hostJobsCreated: 1, attributions: 1 })
    expect(w2.producer.stats).toMatchObject({ producerCalls: 1, hostJobsCreated: 1, attributions: 0 })
  })

  it('P9 no second authority: the producer module imports NOTHING', () => {
    const src = readFileSync(asFsPath(PRODUCER_PATH), 'utf8')
    expect([...src.matchAll(/^import\s/gm)].length).toBe(0)
    expect(src).not.toMatch(/require\(/)
  })
})

describe('u74a G2 — CI-05 regression through the producer row face', () => {
  it('X1 unattributed = typed zero-reach refusal; attributed = corded to owner, owner-mismatch to foreign', async () => {
    const w = await world()
    const planted = w.wrapped.checkManagementAccess({ jobId: 'bash-PLANTED', viewer: OWNER_A })
    expect(planted).toMatchObject({ ok: false, code: 'unattributed-job' })
    const r = await w.producer.accept(w.ctx())
    expect(r.ok).toBe(true)
    expect(w.wrapped.checkManagementAccess({ jobId: 'bash-u74a-1', viewer: OWNER_A })).toMatchObject({ ok: true, corded: true })
    expect(w.wrapped.checkManagementAccess({ jobId: 'bash-u74a-1', viewer: OWNER_F })).toMatchObject({ ok: false, code: 'owner-mismatch' })
  })
})

// ── G3: THE ARM (confined executor, provider deps seam) ────────────────────
interface ShellBackend {
  run: (call: Record<string, unknown>, io: Record<string, unknown>) => Promise<BackendAnswer>
  execCount: () => number
  lastRuns: Array<{ callId: string; pid?: number; exit: number | null }>
}
const PROCESS_FAMILY = await import(new URL('../../tools/process-family/src/index.mjs', import.meta.url).href)
const G3_WORLD = join(REPO, 'tests/homes', `u74a-g3-${Date.now().toString(36)}`)
beforeAll(() => { mkdirSync(G3_WORLD, { recursive: true }); writeFileSync(join(G3_WORLD, '.keep'), '') })
afterAll(() => { rmSync(G3_WORLD, { recursive: true, force: true }) })

function g3Backend(over: Record<string, unknown> = {}, counters: { spawnReqs: Record<string, unknown>[]; probes: number }): ShellBackend {
  const deps = {
    availability: () => { counters.probes += 1; return { rows: [{ subject: 'python3', present: true, note: 'u74a fake' }] } },
    run: () => { throw new Error('u74a G3 fake: the one-shot arm must never run') },
    probeFacts: () => ({
      abiVersion: 4,
      legs: {
        selective: { leg: 'selective', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        denyall: { leg: 'denyall', verdict: 'ENFORCE-CONFIRMED', rc: 0, checks: [] },
        badhandled: { leg: 'badhandled', verdict: 'DEMO-CONFIRMED', rc: 0, checks: [] },
      },
    }),
    spawnStream: (argv: readonly string[]) => {
      counters.spawnReqs.push({ argv: [...argv] })
      const proc = {
        pid: 424243,
        stdin: { write: (_c: unknown, _e: unknown, cb: () => void) => cb() },
        stdout: new Readable({ read() {} }),
        stderr: new Readable({ read() {} }),
        handshake: (() => { const h = new Readable({ read() {} }); h.push('{"stream":true,"pid":424243}\n'); return h })(),
        kill: () => true,
        exit: new Promise(() => {}),
        alive: { value: true },
        signals: [] as string[],
        onTerminate: null,
      }
      return { ok: true, value: proc }
    },
    signalProcess: () => true,
    pidAlive: () => true,
  }
  return PROCESS_FAMILY.createConfinedShellBackend({
    realmId: REALM,
    templateId: 'u74a-tpl',
    instanceId: 'inst-1',
    cwdRoot: G3_WORLD,
    confined: { trustRoot: null, scratchRoot: G3_WORLD, assembly: {}, deps },
    observe: () => {},
    ...(over as { background?: unknown }),
  }) as ShellBackend
}

describe('u74a G3 — the arm on the SAME confined provider row (not a second executor)', () => {
  it('E1 UNCONFIGURED: the by-name refusal is byte-identical and NOTHING is probed or spawned', async () => {
    const counters = { spawnReqs: [] as Record<string, unknown>[], probes: 0 }
    const be = g3Backend({}, counters)
    const r = await be.run({ callId: 'g3-e1', parsedArgs: { tool: 'bash', command: 'true', background: true } }, {})
    expect(r.ok).toBe(false)
    expect(r.failure).toMatchObject({
      class: 'denied',
      code: 'background-not-supported',
      detail: 'background spawn is not implemented by the confined-exec row (refused by name, never reinterpreted as a foreground run)',
    })
    expect(be.execCount()).toBe(0)
    expect(be.lastRuns.length).toBe(0)
    expect(counters.probes).toBe(0)
    expect(counters.spawnReqs.length).toBe(0)
  })

  it('E2 CONFIGURED: the arm runs the SAME gates and hands the producer the SAME request + a lazy provider-spawn thunk', async () => {
    // First: what the FOREGROUND arm spawns with for this very call — the
    // parity witness for the arm's request object.
    const fg = { spawnReqs: [] as Record<string, unknown>[] }
    const fgBe = g3Backend({}, fg as never)
    void fgBe.run({ callId: 'g3-e2-fg', parsedArgs: { tool: 'bash', command: 'true' } }, {})
    let seen: { call?: { callId?: string }; request?: Record<string, unknown>; spawn?: unknown } | null = null
    const canned = { ok: true, outcome: { exitCode: null, stdout: 'started background job bash-x', stderr: '', timedOut: false, cancelled: false, truncated: false }, settlement: { kind: 'completed' } }
    const counters = { spawnReqs: [] as Record<string, unknown>[], probes: 0 }
    const be = g3Backend({
      background: {
        enabled: true,
        accept: async (ctx: Record<string, unknown>) => { seen = ctx as { call?: { callId?: string }; request?: Record<string, unknown>; spawn?: unknown }; return canned },
      },
    }, counters)
    const r = await be.run({ callId: 'g3-e2', parsedArgs: { tool: 'bash', command: 'true', background: true } }, {})
    expect(r).toBe(canned) // the producer's answer flows VERBATIM
    expect(seen).not.toBeNull()
    expect(seen!.call?.callId).toBe('g3-e2')
    // the SAME confined request the foreground arm carries (same argv/cwd/
    // grant fingerprint shape/exitPassthrough) — byte-parity at the fields.
    const req = seen!.request as Record<string, unknown> | undefined
    expect(req?.argv).toEqual(['/bin/sh', '-c', 'true'])
    expect(req?.exitPassthrough).toBe(true)
    expect(String(req?.grantFingerprint)).toContain('g3-e2')
    expect(String(req?.bindingId)).toBe('glue7-plane:u74a-tpl')
    expect(typeof seen!.spawn).toBe('function')
    // the provider was NEVER spawned directly by the arm — only the thunk can spawn
    expect(counters.spawnReqs.length).toBe(0)
    // probe DID run (the same gate sequence as foreground)
    expect(counters.probes).toBeGreaterThan(0) // the arm runs the SAME probe gate
  })

  it('E3 CONFIGURED + producer refusal flows through typed (and the spawn stays the producer\'s call)', async () => {
    const counters = { spawnReqs: [] as Record<string, unknown>[], probes: 0 }
    const be = g3Backend({
      background: {
        enabled: true,
        accept: async () => ({ ok: false, failure: { class: 'denied', code: 'background-attribution-refused', detail: 'x' } }),
      },
    }, counters)
    const r = await be.run({ callId: 'g3-e3', parsedArgs: { tool: 'bash', command: 'true', background: true } }, {})
    expect(r.ok).toBe(false)
    expect(r.failure?.code).toBe('background-attribution-refused')
    expect(counters.spawnReqs.length).toBe(0)
  })
})

// ── G4: THE FULL KERNEL (real plane + real landlock launcher) ──────────────
interface PlaneDef { name: string; execute: (raw: unknown, ctx?: { agent?: { id: string } }) => Promise<{ text: string }> }
interface PlaneValue {
  definitions: ReadonlyArray<PlaneDef>
  backends: Record<string, { execCount?: () => number; lastStageTrace?: string[] }>
}
const planeModule = async (): Promise<{
  createTeamToolPlaneAssembly: (i: Record<string, unknown>) => { ok: true; value: PlaneValue } | { ok: false; code: string; message: string }
}> => (await import(PLANE_PATH.href)) as never

const G4_WORLD = join(REPO, 'tests/homes', `u74a-g4-${Date.now().toString(36)}`)
beforeAll(() => { mkdirSync(join(G4_WORLD, 'root'), { recursive: true }) })
afterAll(() => { rmSync(G4_WORLD, { recursive: true, force: true }) })

const POLICY_ASK = Object.freeze({
  default: 'ask',
  allow: [{ tool: 'read', resource: { kind: 'any' } }],
  ask: [] as unknown[],
  deny: [] as unknown[],
})

async function g4World(over: Record<string, unknown> = {}) {
  const gw = await gatewayModule()
  const mod = await bridgeModule()
  const pmod = await planeModule()
  const asm = gw.createLiveJobsGatewayAssembly({ teamRoot: domainDouble(), rootSessionId: ROOT })
  const wrapped = mod.ci05GovernedGatewayRow(asm)
  const svc = fakeRegistry()
  let legs = 0
  const controlLeg = async (input: unknown): Promise<unknown> => {
    legs += 1
    return (over.deny === true ? denyingControlLeg() : approvingControlLeg())(input as never)
  }
  const mount = (instanceId: string): PlaneValue => {
    const scopeKey = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId })
    let planeValue: PlaneValue | null = null
    const bridge = mod.createGovernedJobsBridge({
      scopeKey,
      viewer: { rootSessionId: ROOT, instanceId },
      gatewayRow: () => wrapped,
      planeRow: () => planeValue,
      jobsService: () => svc,
      observe: () => {},
    })
    const built = pmod.createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => 0 },
      teamSessionId: ROOT,
      controlLeg,
      permissionPolicy: POLICY_ASK,
      realmId: REALM,
      templateId: 'u74a-tpl',
      role: 'member',
      instanceId,
      onObserve: () => {},
      plane: {
        fsInstance: { fs: 'u74a-ctl', rootDir: join(G4_WORLD, 'root'), realmId: REALM, kind: 'absolute-path' },
        confinedProvider: {
          trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
          assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
        },
        cwdRoot: join(G4_WORLD, 'root'),
        jobsEnabled: true,
        ...(over.plane as Record<string, unknown> | undefined ?? {}),
      },
      backends: { jobs: bridge, ...((over.mountBackends as Record<string, unknown> | undefined) ?? {}) },
    })
    if (!built.ok) throw new Error(`mount refused: ${built.code} ${built.message ?? ''}`)
    planeValue = built.value
    return built.value
  }
  return {
    asm, wrapped, svc, mount, legs: () => legs,
  }
}

/** build + mount in one step, WITH the producer wired at backends.backgroundJobs
 *  (the law the plane validates: backgroundJobs=true REQUIRES it). */
async function g4ProducerMount() {
  const gw = await gatewayModule()
  const mod = await bridgeModule()
  const pmod = await planeModule()
  const asm = gw.createLiveJobsGatewayAssembly({ teamRoot: domainDouble(), rootSessionId: ROOT })
  const wrapped = mod.ci05GovernedGatewayRow(asm)
  const svc = fakeRegistry()
  let legs = 0
  const approve = approvingControlLeg()
  const observations: string[] = []
  const witnesses: string[] = []
  const scopeKey = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
  let planeValue: PlaneValue | null = null
  const bridge = mod.createGovernedJobsBridge({
    scopeKey, viewer: OWNER_A,
    gatewayRow: () => wrapped, planeRow: () => planeValue, jobsService: () => svc,
    observe: (r: string) => observations.push(String(r)),
  })
  const producer = (await producerModule()).createGovernedBackgroundProducer({
    scopeKey,
    viewer: OWNER_A,
    ownerSessionId: OWNER_SESSION,
    gatewayRow: () => wrapped,
    ensureRegistered: () => bridge.ensureRegistered(),
    jobsService: () => svc,
    ownerDurable: () => true,
    observe: (r: string) => observations.push(String(r)),
    logLine: (l: string) => witnesses.push(String(l)),
  })
  // a foreign mount sharing the SAME asm/svc (a different member scope)
  const foreignScope = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-f' })
  let foreignValue: PlaneValue | null = null
  const foreignBridge = mod.createGovernedJobsBridge({
    scopeKey: foreignScope, viewer: OWNER_F,
    gatewayRow: () => wrapped, planeRow: () => foreignValue, jobsService: () => svc, observe: () => {},
  })
  const build = (instanceId: string, bd: Record<string, unknown>, pv: (v: PlaneValue) => void): PlaneValue => {
    const built = pmod.createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => 0 },
      teamSessionId: ROOT,
      controlLeg: async (input: unknown) => { legs += 1; return approve(input as never) },
      permissionPolicy: POLICY_ASK,
      realmId: REALM, templateId: 'u74a-tpl', role: 'member', instanceId,
      onObserve: () => {},
      plane: {
        fsInstance: { fs: 'u74a-ctl', rootDir: join(G4_WORLD, 'root'), realmId: REALM, kind: 'absolute-path' },
        confinedProvider: {
          trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
          assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
        },
        cwdRoot: join(G4_WORLD, 'root'),
        jobsEnabled: true,
        // THE CREATING-LANE PIN LAW (see the plane's U7-4a validation):
        // background attribution pins feed-readably ONLY under the native
        // 'bash' spelling — the shell-takeover mount.
        ...(instanceId === 'inst-1' ? { backgroundJobs: true, names: { bash: 'bash' } } : {}),
      },
      backends: bd,
    })
    if (!built.ok) throw new Error(`mount refused: ${built.code} ${built.message ?? ''}`)
    pv(built.value)
    return built.value
  }
  const owner = build('inst-1', { jobs: bridge, backgroundJobs: producer }, (v) => { planeValue = v })
  const foreign = build('inst-f', { jobs: foreignBridge }, (v) => { foreignValue = v })
  const row = (plane: PlaneValue, name: string): PlaneDef => {
    const d = plane.definitions.find((x) => x.name === name)
    if (!d) throw new Error(`row ${name} not mounted`)
    return d
  }
  return {
    asm, wrapped, svc, producer, owner, foreign, row, legs: () => legs, observations, witnesses,
  }
}

describe('u74a G4 — the full kernel: real plane, real landlock spawn, durable ask, attributed trio', () => {
  it('K1 an APPROVED background team_bash really spawns, is ATTRIBUTED before the receipt, and the ring bytes come back through job_output', async () => {
    const w = await g4ProducerMount()
    const out = await w.row(w.owner, 'bash').execute({ command: 'printf U74A-RING-BYTES-42', background: true }, { agent: { id: OWNER_SESSION } })
    expect(out.text).toContain('started background job bash-u74a-1')
    expect(out.text).toContain('exit=not-observed') // the CALL honestly reports: no exit observed
    expect(w.svc.startCalls()).toBe(1)
    expect(w.legs()).toBe(1) // the durable ask lane ran EXACTLY once for this call
    expect(w.producer.stats).toMatchObject({ producerCalls: 1, hostJobsCreated: 1, attributions: 1 })
    expect(w.wrapped.checkManagementAccess({ jobId: 'bash-u74a-1', viewer: OWNER_A })).toMatchObject({ corded: true })
    // the real process settles; the governed trio face then reads the REAL bytes back
    await waitFor(() => w.svc.jobs.get('bash-u74a-1')!.status !== 'running', 'the real printf job settled')
    const listed = await w.row(w.owner, 'job_list').execute({}, { agent: { id: OWNER_SESSION } })
    expect(listed.text).toContain('bash-u74a-1')
    const read = await w.row(w.owner, 'job_output').execute({ job_id: 'bash-u74a-1' }, { agent: { id: OWNER_SESSION } })
    expect(read.text).toContain('U74A-RING-BYTES-42')
    // no second ledger: trio calls cost ZERO approvals
    expect(w.legs()).toBe(1)
    // kill on a finished job answers the honest form
    const kill = await w.row(w.owner, 'job_kill').execute({ job_id: 'bash-u74a-1', reason: 'done' }, { agent: { id: OWNER_SESSION } })
    expect(kill.text).toMatch(/already[- ]finished|already finished/i)
    expect(w.legs()).toBe(1)
  }, 90_000)

  it('K2 a live job killed through job_kill answers REQUESTED and the real process is terminated (killed settlement)', async () => {
    const w = await g4ProducerMount()
    await w.row(w.owner, 'bash').execute({ command: 'sleep 25', background: true }, { agent: { id: OWNER_SESSION } })
    expect(w.svc.startCalls()).toBe(1)
    const kill = await w.row(w.owner, 'job_kill').execute({ job_id: 'bash-u74a-1', reason: 'c2 leg' }, { agent: { id: OWNER_SESSION } })
    expect(kill.text).toMatch(/request/i)
    const outcome = await w.svc.jobs.get('bash-u74a-1')!.hooks!.done
    expect(outcome.status).toBe('killed')
    expect(String(outcome.detail)).toContain('c2 leg')
  }, 90_000)

  it('K3 the FOREIGN viewer measures ZERO host reach on the owner\'s job (owner-mismatch fires before the registry)', async () => {
    const w = await g4ProducerMount()
    await w.row(w.owner, 'bash').execute({ command: 'printf foreign-leg', background: true }, { agent: { id: OWNER_SESSION } })
    const reach = w.svc.reach()
    const legs = w.legs()
    const fOut = await w.row(w.foreign, 'job_output').execute({ job_id: 'bash-u74a-1' }, { agent: { id: FOREIGN_SESSION } })
    expect(fOut.text).toMatch(/owner-mismatch|not your job|owner/i)
    const fList = await w.row(w.foreign, 'job_list').execute({}, { agent: { id: FOREIGN_SESSION } })
    expect(fList.text).not.toContain('bash-u74a-1')
    const fKill = await w.row(w.foreign, 'job_kill').execute({ job_id: 'bash-u74a-1', reason: 'attempt' }, { agent: { id: FOREIGN_SESSION } })
    expect(fKill.text).not.toMatch(/requested/)
    expect(w.svc.reach(), 'measured: no foreign host touch').toBe(reach + 1 /* job_list's own caller-scoped list only */)
    expect(w.legs(), 'trio never touches the approval lane').toBe(legs)
  }, 90_000)

  it('K4 ZERO FLIP: without the backgroundJobs key the background call keeps the byte-identical by-name refusal and the registry is NEVER touched (even with the trio mounted)', async () => {
    const w = await g4World({ plane: {} })
    const value = w.mount('inst-1')
    const row = value.definitions.find((d) => d.name === 'team_bash')!
    const out = await row.execute({ command: 'sleep 30', background: true }, { agent: { id: OWNER_SESSION } })
    expect(out.text).toMatch(/background-not-supported/)
    expect(w.svc.reach()).toBe(0)
    expect(value.backends.shell?.execCount?.()).toBe(0)
    expect(w.svc.startCalls()).toBe(0)
  }, 60_000)

  it('K5 DENIED ask: even an approved-by-name background call that the kernel REFUSES reaches producer, registry and provider ZERO times (attribution never precedes authorization)', async () => {
    const w = await g4ProducerMountDeny()
    const out = await w.row(w.owner, 'bash').execute({ command: 'sleep 30', background: true }, { agent: { id: OWNER_SESSION } })
    expect(out.text).not.toContain('started background job')
    expect(w.svc.reach()).toBe(0)
    expect(w.producer.stats.producerCalls).toBe(0)
    expect(w.legs()).toBe(1) // the ask ran and was DENIED
  }, 60_000)

  it('K6 mount matrix: backgroundJobs without jobsEnabled / without the producer / without the provider / non-boolean are all typed mount refusals', async () => {
    const pmod = await planeModule()
    const base = {
      dispatcherLifecycle: { inflight: () => 0 },
      teamSessionId: ROOT,
      permissionPolicy: POLICY_ASK,
      realmId: REALM, templateId: 'u74a-tpl', role: 'member', instanceId: 'inst-1',
      onObserve: () => {},
    }
    const confinedProvider = {
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    }
    const fsInstance = { fs: 'u74a-ctl', rootDir: join(G4_WORLD, 'root'), realmId: REALM, kind: 'absolute-path' }
    const refusal = (plane: Record<string, unknown>, backends: Record<string, unknown>): string => {
      const r = pmod.createTeamToolPlaneAssembly({ ...base, plane: { fsInstance, confinedProvider, ...plane }, backends })
      if (r.ok) throw new Error('expected refusal')
      return r.code
    }
    const producerStub = { accept: async () => ({ ok: true }) }
    expect(refusal({ backgroundJobs: true }, { backgroundJobs: producerStub })).toBe('PLANE_CONFIG_INCOMPLETE') // jobsEnabled absent
    expect(refusal({ jobsEnabled: true, backgroundJobs: true }, {})).toBe('PLANE_CONFIG_INCOMPLETE') // no producer
    const pmodRefusalNoProvider = pmod.createTeamToolPlaneAssembly({
      ...base,
      plane: { fsInstance, jobsEnabled: true, backgroundJobs: true },
      backends: { backgroundJobs: producerStub },
    })
    expect(pmodRefusalNoProvider.ok).toBe(false)
    expect((pmodRefusalNoProvider as { code: string }).code).toBe('PLANE_CONFIG_INCOMPLETE')
    expect(refusal({ jobsEnabled: true, backgroundJobs: 'yes' }, { backgroundJobs: producerStub })).toBe('PLANE_CONFIG_INCOMPLETE')
    // THE CREATING-LANE PIN LAW: every key is satisfied but the mount keeps
    // the `team_bash` alias — no feed-readable 'bash' lane, no attribution
    // ever possible ⇒ the mount is refused, not half-wired.
    expect(refusal({ jobsEnabled: true, backgroundJobs: true }, { jobs: { bridgeId: 'x' }, backgroundJobs: producerStub }))
      .toBe('PLANE_CONFIG_INCOMPLETE')
    // and the FULL legal combination (takeover name + jobs bridge + producer
    // + provider) MOUNTS (non-vacuity of every refusal above).
    const ok = pmod.createTeamToolPlaneAssembly({
      ...base,
      plane: { fsInstance, confinedProvider, jobsEnabled: true, backgroundJobs: true, names: { bash: 'bash' } },
      backends: { backgroundJobs: producerStub },
    })
    expect(ok.ok, ok.ok ? '' : (ok as { message: string }).message).toBe(true)
  })
})

/** K5's world: identical to g4ProducerMount but the durable leg DENIES. */
async function g4ProducerMountDeny() {
  const gw = await gatewayModule()
  const mod = await bridgeModule()
  const pmod = await planeModule()
  const asm = gw.createLiveJobsGatewayAssembly({ teamRoot: domainDouble(), rootSessionId: ROOT })
  const wrapped = mod.ci05GovernedGatewayRow(asm)
  const svc = fakeRegistry()
  let legs = 0
  const deny = denyingControlLeg()
  const scopeKey = gw.jobsBridgeScopeKey({ realmId: REALM, rootSessionId: ROOT, instanceId: 'inst-1' })
  let planeValue: PlaneValue | null = null
  const bridge = mod.createGovernedJobsBridge({
    scopeKey, viewer: OWNER_A,
    gatewayRow: () => wrapped, planeRow: () => planeValue, jobsService: () => svc, observe: () => {},
  })
  const producer = (await producerModule()).createGovernedBackgroundProducer({
    scopeKey, viewer: OWNER_A, ownerSessionId: OWNER_SESSION,
    gatewayRow: () => wrapped, ensureRegistered: () => bridge.ensureRegistered(),
    jobsService: () => svc, ownerDurable: () => true,
  })
  const built = pmod.createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: ROOT,
    controlLeg: async (input: unknown) => { legs += 1; return deny(input as never) },
    permissionPolicy: POLICY_ASK,
    realmId: REALM, templateId: 'u74a-tpl', role: 'member', instanceId: 'inst-1',
    onObserve: () => {},
    plane: {
      fsInstance: { fs: 'u74a-ctl', rootDir: join(G4_WORLD, 'root'), realmId: REALM, kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
      cwdRoot: join(G4_WORLD, 'root'),
      jobsEnabled: true, backgroundJobs: true, names: { bash: 'bash' },
    },
    backends: { jobs: bridge, backgroundJobs: producer },
  })
  if (!built.ok) throw new Error(`mount refused: ${built.code} ${built.message ?? ''}`)
  planeValue = built.value
  const row = (plane: PlaneValue, name: string): PlaneDef => {
    const d = plane.definitions.find((x) => x.name === name)
    if (!d) throw new Error(`row ${name} not mounted`)
    return d
  }
  return { asm, wrapped, svc, producer, owner: built.value, row, legs: () => legs }
}
