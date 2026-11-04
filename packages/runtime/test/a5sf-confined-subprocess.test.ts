/**
 * a5sf-confined-subprocess.test.ts — BL-16: the Member-realm `subprocess`
 * Provider that `grep`/`glob` execute on.
 *
 * WHAT THE GAP IS (measured, before this lane): the native `@deepseek-ai/
 * dsh-tool-fs-search` module injects `subprocess`, NOT `fs`, so the Member
 * realm — which only confined `fs` — forwarded `grep`/`glob` with ZERO fs
 * facts. An out-of-lane search executed on the preset, unconfined
 * `ctx.subprocess` and returned the outside bytes (SEARCH-3 in
 * `evidence/a5sf-fs-tools/README.md`). This suite pins the REPAIR at the
 * provider level, and pins the two properties that make it a repair rather
 * than a cosmetic one:
 *
 *   1. a target outside the effective read set is REFUSED BEFORE any process
 *      exists (the fake provider records `spawnCalls`, and the refusal arm
 *      asserts it is 0 — a post-hoc result filter would show 1);
 *   2. the child runs under the compiled OS profile, so a read the admission
 *      does not name is still refused BY THE KERNEL (the real-launcher arm
 *      asserts `Permission denied` and the absence of the forbidden bytes).
 *
 * The effective read lane is `ceiling ∩ restriction`, i.e. the value
 * `compileEffectiveIo` already produced — this suite calls that ONE compiler
 * and never re-derives an intersection of its own.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-confined-subprocess
 */
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import type { Readable } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { EffectiveIoPolicy, MemberPolicy, PathRuleSet } from '../member-io-policy/src/types.js'
import { compileEffectiveIo } from '../member-io-policy/src/index.js'
import { compileExecutionProfile } from '../team-sandbox/src/profile.js'
import {
  confinedSpawnAllowPaths,
  createConfinedSubprocessClass,
  createMemberSubprocessGuard,
  programAttributionRefusal,
  readIntentsOf,
} from '../team-services/src/subprocess.js'
import type { ConfinedProcessProvider, ConfinedStreamProcess } from '../team-services/src/subprocess.js'
import type { ProviderResult } from '../sandbox-provider/contract-stub.js'
import type { PayloadExitRecord, SpawnRequest } from '../sandbox-provider/provider.js'

const IDENTITY = Object.freeze({ teamId: 'team-bl16', memberInstanceId: 'member-bl16', templateId: 'worker', instanceGeneration: 1 })

function lane(allow: readonly string[], deny: readonly string[] = []): PathRuleSet {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([...deny]) })
}

function ceiling(read: PathRuleSet, write: PathRuleSet): MemberPolicy {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: 'a5sf1:bl16:g1',
    read,
    write,
    network: Object.freeze({ access: 'allow' }),
  })
}

/** The ONE product compiler: effective = ceiling ∩ restriction. */
function effective(read: PathRuleSet, write: PathRuleSet, restrictionRead: PathRuleSet): EffectiveIoPolicy {
  const compiled = compileEffectiveIo(
    ceiling(read, write),
    { bindingIdentity: 'dsh.search/grep', read: restrictionRead, write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' },
    {
      memberIdentity: IDENTITY.memberInstanceId,
      callId: 'call-bl16',
      policyRevision: 'a5sf1:bl16:g1',
      toolBindingIdentity: 'dsh.search/grep',
      approvedOnce: false,
    },
  )
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

/** The handle shape these arms read (the published subset they assert on). */
interface HandleLike {
  readonly collected: {
    readonly stdout?: { readFrom(fromByte: number): { text: string; nextOffset: number; lossy: boolean } }
    readonly stderr?: { readFrom(fromByte: number): { text: string; nextOffset: number; lossy: boolean } }
  }
  readonly done: Promise<{ exitCode: number | null; signal: string | null }>
  terminate(): void
  waitForExit(signal?: AbortSignal): Promise<boolean>
}

// ---------------------------------------------------------------------------
// A deterministic stand-in for the OS arm. It records every request so the
// refusal arms can prove NO process was ever asked for.
// ---------------------------------------------------------------------------
interface FakeBehaviour {
  readonly stdout?: string
  readonly stderr?: string
  readonly payloadExit?: PayloadExitRecord
  readonly exitCode?: number | null
  readonly signal?: string | null
  readonly onSpawn?: () => void
  readonly onTerminate?: () => void
}

interface FakeProvider extends ConfinedProcessProvider {
  readonly requests: SpawnRequest[]
  readonly spawnCalls: number
}

function fakeProvider(behaviour: FakeBehaviour = {}): FakeProvider {
  const requests: SpawnRequest[] = []
  const provider = {
    requests,
    get spawnCalls(): number {
      return requests.length
    },
    async spawnStreaming(request: SpawnRequest): Promise<ProviderResult<ConfinedStreamProcess>> {
      requests.push(request)
      behaviour.onSpawn?.()
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      const stdin = new PassThrough()
      stdout.end(behaviour.stdout ?? '')
      stderr.end(behaviour.stderr ?? '')
      const payloadExit: PayloadExitRecord = behaviour.payloadExit ?? { form: 'recorded', rc: behaviour.exitCode ?? 0, pid: 4242 }
      const handle: ConfinedStreamProcess = Object.freeze({
        pid: 4242,
        stdin,
        stdout,
        stderr,
        exited: Promise.resolve({ code: behaviour.exitCode ?? 0, signal: behaviour.signal ?? null }),
        terminate: async () => {
          behaviour.onTerminate?.()
          return { ok: true as const, value: undefined as never }
        },
        recordCapable: true as const,
        payloadExit: Promise.resolve(payloadExit),
      })
      return { ok: true, value: handle }
    },
  }
  return provider as unknown as FakeProvider
}

/** A spec shaped exactly like the pinned module's `grep` spawn. */
function grepSpec(cwd: string, path: string | undefined, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    argv: ['/usr/bin/rg', '--no-config', '--json', '--regexp=NEEDLE', ...(path === undefined ? [] : ['--', path])],
    cwd,
    stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
    graceMs: 1000,
    ...extra,
  }
}

/** The Service base every confined provider must subclass (Cordis registers by name). */
class BaseSubprocess {
  readonly ctx: unknown
  constructor(ctx: unknown, _config?: unknown) {
    this.ctx = ctx
  }
  spawn(): never {
    throw new Error('base spawn must never run: a managed Member call does not reach the bare path')
  }
  async spawnTerminal(): Promise<never> {
    throw new Error('base spawnTerminal must never run')
  }
}

const worlds: string[] = []
let world = ''
let inside = ''
let outside = ''

beforeAll(async () => {
  world = await realpath(await mkdtemp(join(tmpdir(), 'a5sf-bl16-')))
  worlds.push(world)
  inside = join(world, 'inside')
  outside = join(world, 'outside')
  await mkdir(inside, { recursive: true })
  await mkdir(outside, { recursive: true })
  await writeFile(join(inside, 'needle.txt'), 'INSIDE-NEEDLE\n', 'utf8')
  await writeFile(join(outside, 'secret.txt'), 'OUTSIDE-SECRET-MUST-NOT-LEAK\n', 'utf8')
})

afterAll(async () => {
  for (const dir of worlds) await rm(dir, { recursive: true, force: true })
})

function confined(
  policy: EffectiveIoPolicy,
  provider: FakeProvider,
  facts: { method: string; locator: string; decision: string; decidedBy: string }[] = [],
) {
  const Base = BaseSubprocess as unknown as new (ctx: unknown, config?: unknown) => unknown
  const guard = createMemberSubprocessGuard(policy)
  return createConfinedSubprocessClass(Base as never, {
    effective: policy,
    provider,
    onGuardConsult: (fact) => {
      facts.push({ method: fact.method, locator: fact.locator, decision: fact.decision, decidedBy: fact.decidedBy })
    },
    guard,
  }) as unknown as {
    new (ctx: unknown, config?: unknown): {
      spawn(spec: unknown): HandleLike
      spawnTerminal?(spec: unknown): Promise<unknown>
    }
  }
}

describe('BL-16 read-intent extraction (pure)', () => {
  it('reads the operands after `--`, resolving relative ones against cwd', () => {
    expect(readIntentsOf({ argv: ['/usr/bin/rg', '--json', '--', 'inside'], cwd: world })).toEqual([join(world, 'inside')])
    expect(readIntentsOf({ argv: ['/usr/bin/rg', '--json', '--', outside], cwd: world })).toEqual([outside])
  })

  it('falls back to cwd when the argv names no operand (the walk root IS cwd)', () => {
    expect(readIntentsOf({ argv: ['/usr/bin/rg', '--files', '--glob=**/*.txt'], cwd: inside })).toEqual([inside])
  })

  it('never mistakes a pattern or a --flag=value for a path', () => {
    expect(readIntentsOf({ argv: ['/usr/bin/rg', '--regexp=foo/bar', '--glob=**/*.ts'], cwd: inside })).toEqual([inside])
    // BL-16 review round 2: a shell's `-c` body is a command string, never an
    // operand — it used to be admitted as an absolute read root when the body
    // began with `/`, and the lane guard then reported a misleading
    // `IO_READ_DENIED: ... does not exist`.
    expect(readIntentsOf({ argv: ['/bin/sh', '-c', '/etc/passwd; echo x'], cwd: inside })).toEqual([inside])
    // The truthful refusal for that spawn is attribution, not a lane lookup.
    const shell = programAttributionRefusal({ argv: ['/bin/sh', '-c', '/etc/passwd'] })
    expect(shell?.code).toBe('IO_READ_DENIED')
    expect(shell?.detail).toMatch(/shell\/interpreter-class/)
    expect(shell?.detail).not.toMatch(/does not exist/)
    // The declared allow-list and its per-program argv contract.
    expect(programAttributionRefusal({ argv: ['/usr/bin/rg', '--no-config', '--regexp=x', '--', inside] })).toBeUndefined()
    expect(programAttributionRefusal({ argv: ['/usr/bin/rg', '--regexp=x', '--', inside] })?.detail).toMatch(/--no-config/)
    expect(programAttributionRefusal({ argv: ['/usr/bin/rg', '--no-config', '--pre=sh', '--', inside] })?.detail).toMatch(/--pre/)
    expect(programAttributionRefusal({ argv: ['/usr/bin/rg', '--no-config', '-z', '--', inside] })?.detail).toMatch(/search-zip|-z/)
    expect(programAttributionRefusal({ argv: ['/tmp/not-authored', '--', inside] })?.detail).toMatch(/unknown binary/)
  })
})

describe('BL-16 admission (unit, no process)', () => {
  it('admits an in-lane search root and hands it to the confined provider', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const provider = fakeProvider({ stdout: '{"type":"match"}\n', payloadExit: { form: 'recorded', rc: 0, pid: 4242 } })
    const facts: { method: string; locator: string; decision: string; decidedBy: string }[] = []
    const Confined = confined(policy, provider, facts)

    const service = new Confined({})
    const handle = service.spawn(grepSpec(world, inside))
    const outcome = await handle.done

    expect(provider.spawnCalls).toBe(1)
    expect(provider.requests[0]?.cwd).toBe(world)
    expect(provider.requests[0]?.argv).toEqual(['/usr/bin/rg', '--no-config', '--json', '--regexp=NEEDLE', '--', inside])
    // The OS profile carries the effective read lane; the runtime allowance is
    // ADDITIVE (executable + loader dirs) and never replaces the lane.
    const granted = (provider.requests[0]?.allowPaths ?? []).map((entry) => entry.path)
    expect(granted).toContain(inside)
    const laneEntry = (provider.requests[0]?.allowPaths ?? []).find((entry) => entry.path === inside)
    expect(laneEntry?.accessBits.readFile).toBe(true)
    expect(laneEntry?.accessBits.readDir).toBe(true)
    expect(outcome).toEqual({ exitCode: 0, signal: null })
    expect(facts).toEqual([{ method: 'spawn', locator: inside, decision: 'allow', decidedBy: 'ALLOW' }])
    expect(String(handle.collected.stdout?.readFrom(0).text)).toContain('"type":"match"')
  })

  it('REFUSES a target outside the ceiling BEFORE any process exists', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const provider = fakeProvider()
    const facts: { method: string; locator: string; decision: string; decidedBy: string }[] = []
    const Confined = confined(policy, provider, facts)

    const handle = new Confined({}).spawn(grepSpec(world, outside))
    await expect(handle.done).rejects.toThrowError(/IO_READ_DENIED|outside/)
    // THE NEGATIVE CONTROL AGAINST "FILTER AFTER THE FACT": zero processes.
    expect(provider.spawnCalls).toBe(0)
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ method: 'spawn', locator: outside, decision: 'deny', decidedBy: 'IO_READ_DENIED' })
    expect(JSON.stringify(facts)).not.toContain('OUTSIDE-SECRET-MUST-NOT-LEAK')
  })

  it('REFUSES a target that is INSIDE the ceiling but OUTSIDE the tool restriction', async () => {
    // ceiling covers the whole world; the tool restriction covers `inside/` only.
    const policy = effective(lane([world]), lane([world]), lane([inside]))
    expect(policy.read.allow).toEqual([inside])
    const provider = fakeProvider()
    const facts: { method: string; locator: string; decision: string; decidedBy: string }[] = []
    const Confined = confined(policy, provider, facts)

    const handle = new Confined({}).spawn(grepSpec(world, outside))
    await expect(handle.done).rejects.toThrowError(/IO_READ_DENIED|outside/)
    expect(provider.spawnCalls).toBe(0)
    expect(facts[0]).toMatchObject({ decision: 'deny', decidedBy: 'IO_READ_DENIED', locator: outside })
  })

  it('REFUSES a `..` operand that escapes the lane through cwd resolution', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const provider = fakeProvider()
    const Confined = confined(policy, provider)
    const spec = grepSpec(inside, undefined)
    spec.argv = ['/usr/bin/rg', '--no-config', '--json', '--regexp=NEEDLE', '--', '../outside']
    await expect(new Confined({}).spawn(spec).done).rejects.toThrowError(/IO_READ_DENIED|outside/)
    expect(provider.spawnCalls).toBe(0)
  })

  it('REFUSES when the argv names no operand and the cwd (the walk root) is out of lane', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const provider = fakeProvider()
    const facts: { method: string; locator: string; decision: string; decidedBy: string }[] = []
    const Confined = confined(policy, provider, facts)
    await expect(new Confined({}).spawn(grepSpec(outside, undefined)).done).rejects.toThrowError(/IO_READ_DENIED|outside/)
    expect(provider.spawnCalls).toBe(0)
    expect(facts[0]).toMatchObject({ locator: outside, decision: 'deny' })
  })

  it('REFUSES a lane the OS profile cannot express instead of spawning unconfined', async () => {
    const unrestricted: PathRuleSet = Object.freeze({ mode: 'all', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) })
    const policy = effective(unrestricted, unrestricted, unrestricted)
    const provider = fakeProvider()
    const Confined = confined(policy, provider)
    expect(() => new Confined({}).spawn(grepSpec(world, inside))).toThrowError(/PATH_LANE_UNRESTRICTED|PROFILE_REFUSED|unconfined/)
    expect(provider.spawnCalls).toBe(0)
  })

  it('REFUSES a request for an stdio shape it cannot honour (spill file, control pipe)', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const provider = fakeProvider()
    const Confined = confined(policy, provider)
    const spill = grepSpec(world, inside)
    spill.stdio = { stdin: 'ignore', stdout: { maxBytes: 1024, spill: { maxBytes: 4096 } }, stderr: { maxBytes: 64 } }
    expect(() => new Confined({}).spawn(spill)).toThrowError(/spill/i)
    const control = grepSpec(world, inside)
    control.stdio = { stdin: 'ignore', stdout: { maxBytes: 1024 }, stderr: { maxBytes: 64 }, control: 'pipe' }
    expect(() => new Confined({}).spawn(control)).toThrowError(/control/i)
    expect(provider.spawnCalls).toBe(0)
  })

  it('REFUSES a terminal spawn (no terminal face on this provider)', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const Confined = confined(policy, fakeProvider())
    const service = new Confined({})
    expect(typeof service.spawnTerminal).toBe('function')
    await expect(service.spawnTerminal!({ argv: ['/bin/sh'], cwd: world })).rejects.toThrow(/terminal/i)
  })
})

describe('BL-16 exit-code and cancellation fidelity', () => {
  it('preserves exit 1 (no matches) and exit 2 (invalid pattern) — no fabricated 0', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    for (const [rc, expected] of [[0, 0], [1, 1], [2, 2]] as const) {
      const provider = fakeProvider({ payloadExit: { form: 'recorded', rc, pid: 7 }, exitCode: rc })
      const handle = new (confined(policy, provider))({}).spawn(grepSpec(world, inside))
      expect(await handle.done).toEqual({ exitCode: expected, signal: null })
    }
  })

  it('REJECTS a completion it cannot record instead of inventing a success', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const provider = fakeProvider({ payloadExit: { form: 'missing' } })
    const handle = new (confined(policy, provider))({}).spawn(grepSpec(world, inside))
    await expect(handle.done).rejects.toThrow(/exit code|record|missing/i)
  })

  it('reports a signal death as a signal, not as an exit code', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const provider = fakeProvider({ payloadExit: { form: 'recorded', rc: -15, pid: 7 } })
    const handle = new (confined(policy, provider))({}).spawn(grepSpec(world, inside))
    expect(await handle.done).toEqual({ exitCode: null, signal: 'SIGTERM' })
  })

  it('terminates the child on caller cancellation', async () => {
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    let terminated = 0
    const provider = fakeProvider({ onTerminate: () => { terminated += 1 } })
    const controller = new AbortController()
    const Confined = confined(policy, provider)
    const spec = grepSpec(world, inside, { signal: controller.signal })
    const handle = new Confined({}).spawn(spec)
    controller.abort()
    await handle.waitForExit()
    expect(terminated).toBeGreaterThan(0)
  })
})

describe('BL-16 real OS leg (Landlock launcher, host-free)', () => {
  it('refuses a shell body at ADMISSION (0 processes, one fact), then measures the KERNEL allowance directly', async (ctx) => {
    const { createConfinedProcessProvider } = await import('../sandbox-provider/provider.js')
    const policy = effective(lane([inside]), lane([inside]), lane([inside]))
    const osProvider = createConfinedProcessProvider({
      realmId: 'realm-bl16-os',
      trustRoot: 'git:a5sf:bl16',
      scratchRoot: world,
    })
    const probe = await osProvider.probe()
    if (!probe.ok) {
      ctx.skip('the confined backend is unavailable on this host')
      return
    }
    const levels = new Map(probe.value.map((row) => [row.dimension, row.level]))
    if (levels.get('content-read') !== 'enforced') {
      ctx.skip('this backend does not enforce content-read; the OS law cannot be proven here')
      return
    }
    // (a) Admission: a shell body is refused BEFORE the provider is called.
    const counts = { spawn: 0 }
    const counted = {
      async spawnStreaming(request: SpawnRequest, streaming?: { graceMs: number }) {
        counts.spawn += 1
        return osProvider.spawnStreaming(request, streaming)
      },
    }
    const facts: { method: string; locator: string; decision: string; decidedBy: string }[] = []
    const Confined = createConfinedSubprocessClass(BaseSubprocess as never, {
      effective: policy,
      provider: counted as unknown as ConfinedProcessProvider,
      realmId: 'realm-bl16-os',
      onGuardConsult: (fact) => {
        facts.push({ method: fact.method, locator: fact.locator, decision: fact.decision, decidedBy: fact.decidedBy })
      },
    }) as unknown as { new (ctx: unknown): { spawn(spec: unknown): HandleLike } }
    const handle = new Confined({}).spawn({
      argv: ['/bin/sh', '-c', `cat /etc/passwd; cat ${outside}/secret.txt; cat ${inside}/needle.txt`],
      cwd: inside,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
      graceMs: 2000,
    })
    await expect(handle.done).rejects.toThrowError(/statically attributed|shell/i)
    expect(counts.spawn).toBe(0)
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ method: 'spawn', locator: '/bin/sh', decision: 'deny', decidedBy: 'IO_READ_DENIED' })
    expect(String(handle.collected.stdout?.readFrom(0).text ?? '')).toBe('')

    // (b) Layer 2 alone, with the SAME request builder: the kernel DOES serve
    //     /etc (the launcher's runtime_base) and DOES refuse the out-of-lane
    //     sibling. This is the measured boundary the README now states.
    const rawProfile = compileExecutionProfile(policy)
    expect(rawProfile.ok).toBe(true)
    if (!rawProfile.ok) return
    const spawned = await osProvider.spawnStreaming({
      grantFingerprint: 'bl16-unit-kernel',
      realmId: 'realm-bl16-os',
      bindingId: 'dsh.search/grep',
      memberScope: IDENTITY.memberInstanceId,
      argv: ['/bin/sh', '-c', `head -c 24 /etc/passwd; echo SEP; cat ${outside}/secret.txt 2>&1; echo RC=$?; cat ${inside}/needle.txt`],
      cwd: inside,
      env: [],
      allowPaths: confinedSpawnAllowPaths(rawProfile.value.allowPaths, '/bin/sh'),
      exitPassthrough: true,
    }, { graceMs: 2000 })
    expect(spawned.ok).toBe(true)
    if (!spawned.ok) return
    const text = await drainConfined(spawned.value)
    expect(text).toContain('root:x:0:0')
    expect(text).toContain('INSIDE-NEEDLE')
    expect(text).toMatch(/Permission denied|EACCES/)
    expect(text).not.toContain('OUTSIDE-SECRET-MUST-NOT-LEAK')
    // The host-side file still holds the secret: absence above is a refusal,
    // not a fixture that was never written.
    expect(existsSync(join(outside, 'secret.txt'))).toBe(true)
    expect(await readFile(join(outside, 'secret.txt'), 'utf8')).toContain('OUTSIDE-SECRET-MUST-NOT-LEAK')
  }, 60_000)
})

/** Drain every stream of a raw provider handle, then report the exit. */
async function drainConfined(handle: ConfinedStreamProcess): Promise<string> {
  const chunks: Buffer[] = []
  const consume = async (stream: Readable): Promise<void> => {
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer))
  }
  await Promise.all([consume(handle.stdout), consume(handle.stderr), handle.exited])
  return Buffer.concat(chunks).toString('utf8')
}
