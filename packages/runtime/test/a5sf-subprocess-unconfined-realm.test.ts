/**
 * a5sf-subprocess-unconfined-realm.test.ts — BL-17: a `subprocess`-consuming
 * native module may only be mounted on a realm that OWNS a confined
 * `subprocess` face.
 *
 * WHY THIS SUITE EXISTS (external Alpha.5 review, 2026-11-04). The confined
 * `subprocess` Provider is mounted on the MEMBER realm
 * (`installMemberIoProviders`). `mountNativeToolModules` mounts binding-owned
 * modules on `binding?.ctx`, and `installToolBindingRealm` installs a confined
 * `fs` and NO `subprocess`. A binding-targeted module that injects
 * `subprocess` would therefore resolve the INHERITED base service with zero
 * guard facts — a proof obtained on the Member realm would be silently wrong
 * on the binding realm. That is now a COMPOSITION-TIME REFUSAL
 * (`SUBPROCESS_UNCONFINED_REALM`), not a documented limitation.
 *
 * ARMS
 *   U1  BINDING realm, real pinned `@deepseek-ai/dsh-tool-fs-search`: the mount
 *       is refused with the typed code, naming the realm and the module.
 *       NEGATIVE CONTROLS: zero provider calls, zero tool definitions, zero
 *       plugin fibers created by the refused call, and the base `subprocess`
 *       tripwire never consulted (the refusal is before any lookup).
 *   U1b The same refusal through the PRODUCT ROW composition
 *       (`attachA5sfNativeToolModules`, which expands a mounted binding into a
 *       binding mount) — the seam and the composition agree.
 *   U2  MEMBER realm, SAME module: mounts, exposes the confined face, and the
 *       routed `grep` executes on the confined provider with the base tripwire
 *       untouched. The refusal above is therefore about the REALM, not the
 *       module.
 *   U3  The nested two-axis case the reviewer asked for: a read restriction
 *       NARROWER than the ceiling is refused at the admission layer for the
 *       binding-effective face, while the SAME target is admitted by a
 *       ceiling-only face (the discriminating pair).
 *
 * Host-free: in-process Cordis roots, a deterministic provider double for the
 * confined faces, no Landlock launcher, no boot and no DSH_HOME.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-subprocess-unconfined-realm
 */
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import { bindScopeParent, createScope } from '@deepseek-ai/dsh-scope'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as searchModule from '@deepseek-ai/dsh-tool-fs-search'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { EffectiveIoPolicy, MemberPolicy, PathRuleSet } from '../member-io-policy/src/types.js'
import { compileEffectiveIo } from '../member-io-policy/src/index.js'
import type { TrustedMemberIdentity } from '../member-io-policy/src/types.js'
import type { ProviderResult } from '../sandbox-provider/contract-stub.js'
import type { PayloadExitRecord, SpawnRequest } from '../sandbox-provider/provider.js'
import { mountA5sfRealm } from '../team-services/src/mount.js'
import type { MountedA5sfRealm } from '../team-services/src/mount.js'
import {
  createConfinedSubprocessClass,
  createMemberSubprocessGuard,
} from '../team-services/src/subprocess.js'
import type { ConfinedProcessProvider, ConfinedStreamProcess } from '../team-services/src/subprocess.js'
import { A5SF_SUBPROCESS_UNCONFINED_REALM } from '../team-services/src/mount.js'

const REPO = realpathSync(join(__dirname, '../../..'))

interface RowModule {
  attachA5sfNativeToolModules(realm: unknown, root: unknown, config: unknown, agentKey: unknown): Promise<unknown[]>
  a5sfRealmConfigOf(config: Record<string, unknown>): unknown
}

const IDENTITY: TrustedMemberIdentity = Object.freeze({
  teamId: 'team-bl17',
  memberInstanceId: 'member-bl17',
  templateId: 'worker',
  instanceGeneration: 1,
})

function lane(allow: readonly string[]): PathRuleSet {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function ceiling(read: PathRuleSet, write: PathRuleSet): MemberPolicy {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: 'rev-bl17',
    read,
    write,
    network: Object.freeze({ access: 'allow' as const }),
  })
}

/** THE ONE COMPILER: effective = ceiling ∩ restriction (never re-derived). */
function effectiveOf(read: PathRuleSet, write: PathRuleSet, restrictionRead: PathRuleSet): EffectiveIoPolicy {
  const compiled = compileEffectiveIo(ceiling(read, write), {
    bindingIdentity: 'dsh.search/grep',
    read: restrictionRead,
    write: lane([]),
    network: 'allow',
  }, {
    memberIdentity: IDENTITY.memberInstanceId,
    callId: 'call-bl17',
    policyRevision: 'rev-bl17',
    toolBindingIdentity: 'dsh.search/grep',
    approvedOnce: false,
  })
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

// ---------------------------------------------------------------------------
// A deterministic stand-in for the OS arm: it records every request, so a
// refusal arm proves NO process was ever asked for.
// ---------------------------------------------------------------------------
interface FakeProvider extends ConfinedProcessProvider {
  readonly requests: SpawnRequest[]
  readonly spawnCalls: number
}

function fakeProvider(): FakeProvider {
  const requests: SpawnRequest[] = []
  const provider = {
    requests,
    get spawnCalls(): number {
      return requests.length
    },
    async spawnStreaming(request: SpawnRequest): Promise<ProviderResult<ConfinedStreamProcess>> {
      requests.push(request)
      const stdout = new PassThrough()
      const stderr = new PassThrough()
      const stdin = new PassThrough()
      stdout.end('')
      stderr.end('')
      const payloadExit: PayloadExitRecord = { form: 'recorded', rc: 0, pid: 4242 }
      const handle: ConfinedStreamProcess = Object.freeze({
        pid: 4242,
        stdin,
        stdout,
        stderr,
        exited: Promise.resolve({ code: 0, signal: null }),
        terminate: async () => ({ ok: true as const, value: undefined as never }),
        payloadExit: Promise.resolve(payloadExit),
      })
      return { ok: true, value: handle }
    },
  }
  return provider as unknown as FakeProvider
}

/** The tripwire base `subprocess` service: any consultation is a FAILURE. */
class BaseSubprocessService extends Service {
  constructor(ctx: Context, config: Record<string, unknown> = {}) {
    super(ctx, 'subprocess')
    this.config = config
  }

  readonly config: Record<string, unknown>

  static calls = 0

  spawn(): never {
    BaseSubprocessService.calls += 1
    throw new Error('BL17_TRIPWIRE: the INHERITED subprocess service ran under a managed mount')
  }

  async spawnTerminal(): Promise<never> {
    BaseSubprocessService.calls += 1
    throw new Error('BL17_TRIPWIRE: the INHERITED subprocess service ran under a managed mount')
  }
}

/** The plain base for the SERVICE-LAYER arm (U3): never a Cordis service. */
class BareSubprocess {
  readonly ctx: unknown
  constructor(ctx: unknown, _config?: unknown) {
    this.ctx = ctx
  }
  spawn(): never {
    throw new Error('BL17_TRIPWIRE: the bare base spawn must never run')
  }
}

/** The base `fs` Provider every Member realm shadows (the install capability gate). */
class BaseFs extends Service {
  constructor(ctx: Context, config: Record<string, unknown> = {}) {
    super(ctx, 'fs')
    this.config = config
  }

  readonly config: Record<string, unknown>

  processPath(target: { hostPath: string }): string { return target.hostPath }
  contains(parent: { hostPath: string }, child: { hostPath: string }): boolean {
    return String(this.processPath(child)).startsWith(String(this.processPath(parent)))
  }
  async resolve(path: string): Promise<{ hostPath: string; displayPath: string }> { return { hostPath: path, displayPath: path } }
  async readText(): Promise<string> { return '' }
  async streamText(): Promise<AsyncIterable<string>> {
    return (async function* stream(): AsyncGenerator<string> { yield '' })()
  }
  async readBytes(): Promise<Uint8Array> { return new Uint8Array() }
  async readByteRange(): Promise<Uint8Array> { return new Uint8Array() }
  async listDir(): Promise<unknown[]> { return [] }
  async stat(): Promise<Record<string, unknown>> { return { type: 'file', size: 0, mtimeMs: 0, mode: 0o644 } }
  async lstat(): Promise<Record<string, unknown>> { return this.stat() }
  async watch(): Promise<() => Promise<void>> { return async () => undefined }
  async writeText(target: { hostPath: string }): Promise<Record<string, unknown>> {
    return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v1' }
  }
  async editText(target: { hostPath: string }): Promise<Record<string, unknown>> {
    return { path: this.processPath(target), displayPath: this.processPath(target), version: 'v2' }
  }
}

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------
const worlds: string[] = []
let world = ''
let inside = ''
let outside = ''
let row: RowModule

beforeAll(async () => {
  world = realpathSync(mkdtempSync(join(tmpdir(), 'a5sf-bl17-')))
  worlds.push(world)
  inside = join(world, 'inside')
  outside = join(world, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(inside, 'needle.txt'), 'INSIDE-NEEDLE\n', 'utf8')
  writeFileSync(join(outside, 'secret.txt'), 'OUTSIDE-SECRET-MUST-NOT-LEAK\n', 'utf8')
  row = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href) as unknown as RowModule
})

afterAll(() => {
  for (const dir of worlds) rmSync(dir, { recursive: true, force: true })
})

interface World {
  readonly root: Context
  readonly agentKey: unknown
  readonly agentCtx: Context
  readonly realm: MountedA5sfRealm
  readonly provider: FakeProvider
  readonly sinkPath: string
}

interface WorldOptions {
  readonly withBinding: boolean
  readonly withSubprocessFace: boolean
  readonly realmId: string
}

/**
 * ONE Member realm, optionally with a mounted `dsh.search/grep` ToolBinding and
 * optionally with a confined `subprocess` face on the Member realm. The preset
 * plane mounts the REAL pinned search module on the standing scope, exactly as
 * a host preset does.
 */
async function mountWorld(options: WorldOptions): Promise<World> {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFs, {})
  await root.plugin(BaseSubprocessService, {})

  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(searchModule as never, { sampleOverCapGlobResults: false } as never)
  const agentKey = { session: { header: {} } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const sinkPath = join(world, `consult-${options.realmId}.jsonl`)
  const provider = fakeProvider()
  const subprocessFace = {
    effective: effectiveOf(lane([inside]), lane([inside]), lane([inside])),
    provider: provider as ConfinedProcessProvider,
    realmId: options.realmId,
    memberScope: IDENTITY.memberInstanceId,
  }
  const realm = await mountA5sfRealm({
    root: agent.ctx,
    members: [{
      identity: IDENTITY,
      policy: { ok: true, value: ceiling(lane([inside]), lane([inside])) },
    }],
    ...(options.withBinding
      ? { bindings: [{ identity: IDENTITY, toolBindingIdentity: 'dsh.search/grep', effective: effectiveOf(lane([world]), lane([inside]), lane([inside])) }] }
      : {}),
    providerClass: BaseFs,
    ...(options.withSubprocessFace ? { subprocess: subprocessFace } : {}),
    onGuardConsult: () => undefined,
  })
  return { root, agentKey, agentCtx: agent.ctx, realm, provider, sinkPath }
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('expected a refusal, but the call resolved')
}

// ---------------------------------------------------------------------------

describe('BL-17 — a subprocess consumer cannot be mounted on a realm with no confined process face', () => {
  it('U1: a BINDING-realm mount of the real search module is refused before any mount', async () => {
    const w = await mountWorld({ withBinding: true, withSubprocessFace: true, realmId: 'realm-bl17-u1' })
    try {
      // Preconditions that make the control sharp: the Member realm OWNS the
      // confined process face, so the ONLY unconfined realm is the binding.
      expect(w.realm.installation.members[0]?.faces.subprocess).not.toBeNull()
      expect(w.realm.bindings).toHaveLength(1)
      expect(w.realm.bindings[0]?.faces.subprocess).toBeNull()

      const baseBefore = BaseSubprocessService.calls
      const tools = w.root.get('tools') as unknown as { get(name: string, scope?: unknown): unknown }
      const beforeGrep = tools.get('grep', w.agentKey)
      let fibersCreated = 0
      const detach = w.root.on('internal/plugin', () => { fibersCreated += 1 })
      const error = await caught(w.realm.mountNativeToolModules([{
        module: searchModule as never,
        toolBindingIdentity: 'dsh.search/grep',
        config: { sampleOverCapGlobResults: false },
      }], { scope: w.agentKey }))
      detach()

      expect(error).toMatchObject({ name: 'TeamServiceInstallError', code: A5SF_SUBPROCESS_UNCONFINED_REALM })
      const detail = (error as { detail?: string }).detail ?? ''
      expect(detail).toContain("binding realm 'dsh.search/grep'")
      expect(detail).toContain('tool-fs-search')
      expect(detail).toContain('confined subprocess face')

      // NEGATIVE CONTROLS, all three counters/identities:
      //  - the base service was never consulted (the tripwire never ran),
      //  - the confined provider was never asked for a process,
      //  - the refused call created NO fiber, registered NO definition and the
      //    tool plane still resolves the pre-call definition (so no tool body
      //    could have run on either service).
      expect(BaseSubprocessService.calls).toBe(baseBefore)
      expect(w.provider.spawnCalls).toBe(0)
      expect(fibersCreated).toBe(0)
      expect(tools.get('grep', w.agentKey)).toBe(beforeGrep)
    } finally {
      await w.realm.dispose()
    }
  })

  it('U1b: the PRODUCT ROW composition refuses the same binding mount (seam and composition agree)', async () => {
    const w = await mountWorld({ withBinding: true, withSubprocessFace: true, realmId: 'realm-bl17-u1b' })
    try {
      const baseBefore = BaseSubprocessService.calls
      const error = await caught(row.attachA5sfNativeToolModules(
        w.realm,
        w.agentCtx,
        row.a5sfRealmConfigOf({
          a5sfEvidencePath: w.sinkPath,
          a5sfNativeToolModules: [{
            url: '@deepseek-ai/dsh-tool-fs-search',
            expectedTools: ['grep', 'glob'],
            config: { sampleOverCapGlobResults: false },
          }],
        }),
        w.agentKey,
      ))
      expect(error).toMatchObject({ code: A5SF_SUBPROCESS_UNCONFINED_REALM })
      const detail = (error as { detail?: string }).detail ?? ''
      expect(detail).toContain("binding realm 'dsh.search/grep'")
      expect(BaseSubprocessService.calls).toBe(baseBefore)
      expect(w.provider.spawnCalls).toBe(0)
      // The attach committed no shadow: the model-visible `grep` is still the
      // preset definition, so no routed body can execute on an inherited face.
      const tools = w.root.get('tools') as unknown as { get(name: string, scope?: unknown): unknown }
      const preset = tools.get('grep', w.agentKey)
      expect(preset).toBeDefined()
    } finally {
      await w.realm.dispose()
    }
  })

  it('U2: the MEMBER realm with the confined face still mounts the same module and executes on it', async () => {
    const w = await mountWorld({ withBinding: false, withSubprocessFace: true, realmId: 'realm-bl17-u2' })
    try {
      const baseBefore = BaseSubprocessService.calls
      const fibers = await w.realm.mountNativeToolModules([{
        module: searchModule as never,
        config: { sampleOverCapGlobResults: false },
        expectedTools: ['grep', 'glob'],
      }], { scope: w.agentKey })
      expect(fibers.length).toBeGreaterThan(0)
      expect(w.realm.installation.members[0]?.faces.subprocess).not.toBeNull()

      const tools = w.root.get('tools') as unknown as {
        execute(input: Record<string, unknown>): Promise<{ isError?: boolean; content?: { type?: string; text?: string }[] }>
      }
      const settled = await tools.execute({
        signal: new AbortController().signal,
        callId: 'bl17-u2-grep',
        agent: w.agentKey,
        name: 'grep',
        arguments: { pattern: 'INSIDE-NEEDLE', path: inside },
      })
      const text = Array.isArray(settled.content)
        ? settled.content.map((part) => (part?.type === 'text' ? part.text ?? '' : '')).join('')
        : ''
      // The confined provider answered the spawn (a deterministic empty result),
      // and the inherited base service was NEVER reached.
      expect(w.provider.spawnCalls).toBe(1)
      expect(BaseSubprocessService.calls).toBe(baseBefore)
      expect(settled.isError).toBe(false)
      expect(text).toContain('No matches found')
    } finally {
      await w.realm.dispose()
    }
  })

  it('U3: a read restriction NARROWER than the ceiling is refused at admission (the nested case)', async () => {
    // ceiling covers `inside` AND `outside`; the binding restriction names
    // `inside` only. The face is built from the compiled effective policy.
    const nested = effectiveOf(lane([inside, outside]), lane([inside]), lane([inside]))
    const provider = fakeProvider()
    const facts: { decision: string; decidedBy: string }[] = []
    const Confined = createConfinedSubprocessClass(BareSubprocess as never, {
      effective: nested,
      provider,
      onGuardConsult: (fact) => { facts.push({ decision: fact.decision, decidedBy: fact.decidedBy }) },
      guard: createMemberSubprocessGuard(nested),
    }) as unknown as {
      new (ctx: unknown, config?: unknown): { spawn(spec: unknown): { readonly done: Promise<unknown> } }
    }
    const spec = {
      argv: ['/usr/bin/rg', '--no-config', '--json', '--regexp=NEEDLE', '--', outside],
      cwd: world,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
      graceMs: 1000,
    }
    const refused = await caught(new Confined({}).spawn(spec).done)
    expect(String((refused as Error).message ?? refused)).toMatch(/IO_READ_DENIED|outside/)
    // The counter control: the ceiling WOULD have admitted this root, and yet
    // zero processes were created because the narrower restriction decided.
    expect(provider.spawnCalls).toBe(0)
    expect(facts).toEqual([{ decision: 'deny', decidedBy: 'IO_READ_DENIED' }])

    // DISCRIMINATING PAIR: the same target through a ceiling-only face runs.
    const ceilingOnly = effectiveOf(lane([inside, outside]), lane([inside]), lane([inside, outside]))
    const ceilingProvider = fakeProvider()
    const CeilingFace = createConfinedSubprocessClass(BareSubprocess as never, {
      effective: ceilingOnly,
      provider: ceilingProvider,
      guard: createMemberSubprocessGuard(ceilingOnly),
    }) as unknown as {
      new (ctx: unknown, config?: unknown): { spawn(spec: unknown): { readonly done: Promise<unknown> } }
    }
    await new CeilingFace({}).spawn(spec).done
    expect(ceilingProvider.spawnCalls).toBe(1)
  })
})
