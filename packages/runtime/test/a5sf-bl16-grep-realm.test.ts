/**
 * BL-16 — the REALM integration of the confined `subprocess` face.
 *
 * WHAT THIS SUITE IS: the discriminating pair over the PRODUCT seam. The
 * pinned `@deepseek-ai/dsh-tool-fs-search` module injects `subprocess` (NOT
 * `fs`), so the Member realm confinement measured for `read`/`write`/`edit`
 * never covered `grep`/`glob`: they ran on the inherited host service
 * (`SEARCH-0`/`SEARCH-3` in `evidence/a5sf-fs-tools/`). This suite mounts the
 * confined `subprocess` face on the SAME isolated scope route C re-mounts the
 * native modules into, then calls the REAL `grep` tool through the real tool
 * runtime against real fixture files and a REAL ripgrep binary.
 *
 * ARMS
 *   R0  BEFORE the attach the preset definition runs on the INHERITED service:
 *       the tripwire base service THROWS, and the tool surfaces the failure —
 *       the measurement that the shadow (not the base) decides afterwards.
 *   R1  IN-LANE: `grep` finds the needle, exits 0, one `allow` fact.
 *   R2  OUT-OF-LANE: `grep` naming an outside path is refused BEFORE the
 *       provider is called (spawn counter unchanged), exactly one `deny` fact
 *       (`decidedBy: IO_READ_DENIED`), and the outside secret never appears.
 *       The negative control against "filter after the fact" is the COUNTER,
 *       not the text: no process ran, so no bytes were read.
 *   R3  NO-MATCH FIDELITY: an in-lane `grep` with no hit is NOT an error —
 *       exit code 1 survives the handle adaptation (a flattened exit code would
 *       turn every empty search into a failure).
 *   R4  INVALID PATTERN: `rg` exit 2 is reported as a search failure, not as a
 *       clean "no matches", and the pattern never becomes a shell string.
 *   R5  KERNEL LAYER: with a target the admission NAMES as in-lane, a read the
 *       argv never names is refused by the OS profile (this is the layer the
 *       admission cannot provide; asserted by the absence of the secret).
 *   R6  LIVE ROW 1 (2026-11-05): an in-lane `grep` inside a REAL git-worktree
 *       layout returns the match through the REAL tool. The confined rg used to
 *       walk above the search root, try to read the lane-denied `.git` FILE and
 *       exit 2. The face now adds `--no-ignore-parent --no-ignore-vcs` and the
 *       ONE allow fact carries the disclosure.
 *   R6m MUTATION: stripping those flags at the provider boundary reproduces
 *       the live tool error verbatim (`…/.git: Permission denied`, exit 2).
 *   R7  A lane that INCLUDES the worktree root keeps ordinary `.gitignore`
 *       semantics (no flags, no disclosure; the ignored file stays hidden).
 *   R7m MUTATION: forcing the flags onto that lane makes the ignored file
 *       appear — the reason the change is conditional, not global.
 *
 * HOST REQUIREMENT: R1–R7 need the Landlock launcher's `content-read` leg
 * ENFORCED. When the host cannot enforce it the arms are SKIPPED, never
 * reported green (the `a5sf-os-runner.test.ts` precedent).
 *
 * Host-free: in-process Cordis roots, no boot, no port, no DSH_HOME.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import { bindScopeParent, createScope } from '@deepseek-ai/dsh-scope'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import * as searchModule from '@deepseek-ai/dsh-tool-fs-search'
import { compileEffectiveIo } from '../member-io-policy/src/index.js'
import type { EffectiveIoPolicy, MemberPolicy, PathRuleSet } from '../member-io-policy/src/index.js'
import type { TrustedMemberIdentity } from '../member-io-policy/src/types.js'
import { createConfinedProcessProvider } from '../sandbox-provider/index.js'
import { compileExecutionProfile } from '../team-sandbox/src/profile.js'
import { readGuardConsultFile } from '../team-services/src/guard-observability.js'
import {
  SEARCH_IGNORE_DISCOVERY_FLAGS,
  SEARCH_IGNORE_DISCOVERY_NOTES,
  confinedSpawnAllowPaths,
} from '../team-services/src/subprocess.js'
import type { ConfinedProcessProvider, ConfinedStreamProcess } from '../team-services/src/subprocess.js'
import type { SpawnRequest } from '../sandbox-provider/provider.js'

const REPO = realpathSync(join(__dirname, '../../..'))
const LAUNCHER = join(REPO, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

interface RowModule {
  mountMemberA5sfRealm(input: Record<string, unknown>): Promise<{ dispose(): Promise<void>; mountNativeToolModules?: unknown }>
  attachA5sfNativeToolModules(realm: unknown, root: unknown, config: unknown, agentKey: unknown): Promise<unknown[]>
  a5sfRealmConfigOf(config: Record<string, unknown>): unknown
}

interface SearchToolResult {
  readonly isError: boolean
  readonly text: string
}

const IDENTITY: TrustedMemberIdentity = Object.freeze({
  teamId: 'team-bl16',
  memberInstanceId: 'member-bl16',
  templateId: 'worker',
  instanceGeneration: 1,
})

/**
 * The base `fs` Provider the realm needs to shadow. It is a REAL Service over
 * `node:fs` (the `a5sf-service-install`/`fs-arms` double): the realm install
 * requires the closed Provider capability set, and an empty stub would prove
 * nothing about the mount. The `grep`/`glob` lane never calls it — it is here
 * because a Member realm always installs `fs` FIRST.
 */
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
  async readText(target: { hostPath: string }): Promise<string> { return readFileSync(this.processPath(target), 'utf8') }
  async streamText(target: { hostPath: string }): Promise<AsyncIterable<string>> {
    const text = await this.readText(target)
    return (async function* stream(): AsyncGenerator<string> { yield text })()
  }
  async readBytes(target: { hostPath: string }): Promise<Uint8Array> { return readFileSync(this.processPath(target)) }
  async readByteRange(target: { hostPath: string }): Promise<Uint8Array> { return readFileSync(this.processPath(target)) }
  async listDir(): Promise<unknown[]> { return [] }
  async stat(target: { hostPath: string }): Promise<Record<string, unknown>> {
    return { type: 'file', size: readFileSync(this.processPath(target)).length, mtimeMs: 0, mode: 0o644 }
  }
  async lstat(target: { hostPath: string }): Promise<Record<string, unknown>> { return this.stat(target) }
  async watch(): Promise<() => void> { return () => undefined }
  async writeText(target: { hostPath: string }, content: unknown): Promise<Record<string, unknown>> {
    const path = this.processPath(target)
    writeFileSync(path, String(content))
    return { path, displayPath: path, version: 'v1' }
  }
  async editText(target: { hostPath: string }, edit: Record<string, unknown>): Promise<Record<string, unknown>> {
    const path = this.processPath(target)
    writeFileSync(path, String(edit.newString))
    return { path, displayPath: path, version: 'v2' }
  }
}

/** The tripwire base service: any call that reaches it is a CONFINEMENT FAILURE. */
class BaseSubprocess extends Service {
  constructor(ctx: Context, config: Record<string, unknown> = {}) {
    super(ctx, 'subprocess')
    this.config = config
  }

  readonly config: Record<string, unknown>

  static calls = 0

  spawn(): never {
    BaseSubprocess.calls += 1
    throw new Error('BL16_TRIPWIRE: the INHERITED subprocess service ran under a managed Member call')
  }

  async spawnTerminal(): Promise<never> {
    BaseSubprocess.calls += 1
    throw new Error('BL16_TRIPWIRE: the INHERITED subprocess service ran under a managed Member call')
  }
}

function lane(allow: readonly string[], mode: 'restricted' | 'all' = 'restricted'): PathRuleSet {
  if (mode === 'all') return Object.freeze({ mode: 'all', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) })
  return Object.freeze({ mode, allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function ceiling(read: PathRuleSet, write: PathRuleSet): MemberPolicy {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: 'rev-bl16',
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
    write: lane([], 'all'),
    network: 'allow',
  }, {
    memberIdentity: IDENTITY.memberInstanceId,
    callId: 'call-bl16-realm',
    policyRevision: 'rev-bl16',
    toolBindingIdentity: 'dsh.search/grep',
    approvedOnce: false,
  })
  if (!compiled.ok) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)
  return compiled.value
}

// ---------------------------------------------------------------------------
// The world
// ---------------------------------------------------------------------------

const worlds: string[] = []
let world = ''
let inside = ''
let outside = ''
/** A git-worktree-shaped temp tree (`.git` FILE) used by R6/R7. */
let worktree = ''
let worktreeInside = ''
let row: RowModule

beforeAll(async () => {
  world = await realpathSync(await (async () => {
    mkdirSync(join(tmpdir(), 'a5sf-bl16-realm'), { recursive: true })
    return mkdtempSync(join(tmpdir(), 'a5sf-bl16-realm', 'w-'))
  })())
  worlds.push(world)
  inside = join(world, 'inside')
  outside = join(world, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(inside, 'needle.txt'), 'INSIDE-NEEDLE\n', 'utf8')
  writeFileSync(join(inside, 'quiet.txt'), 'nothing to see here\n', 'utf8')

  // The live row-1 shape: a worktree whose `.git` FILE is an ancestor of the
  // search root. R6's lane admits only the search root, so the confined rg
  // cannot read `.git`; R7's lane includes the worktree root.
  const gitdir = join(world, 'main-gitdir', '.git', 'worktrees', 'wt1')
  mkdirSync(gitdir, { recursive: true })
  worktree = join(world, 'repo-wt')
  worktreeInside = join(worktree, 'lane', 'inside')
  mkdirSync(worktreeInside, { recursive: true })
  writeFileSync(join(worktree, '.git'), `gitdir: ${gitdir}\n`, 'utf8')
  writeFileSync(join(worktree, '.gitignore'), 'ignored.md\n', 'utf8')
  writeFileSync(join(worktreeInside, 'needle.txt'), 'WT-NEEDLE\n', 'utf8')
  writeFileSync(join(worktreeInside, 'ignored.md'), 'WT-NEEDLE ignored-but-present\n', 'utf8')

  writeFileSync(join(outside, 'secret.txt'), 'OUTSIDE-SECRET-MUST-NOT-LEAK\n', 'utf8')
  row = await import(pathToFileURL(join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href) as unknown as RowModule
})

afterAll(async () => {
  for (const dir of worlds) rmSync(dir, { recursive: true, force: true })
})

interface WorldHandles {
  readonly root: Context
  readonly agentKey: unknown
  readonly agentCtx: Context
  readonly realm: { dispose(): Promise<void> }
  readonly sinkPath: string
  readonly spawns: { count: number }
  readonly requests: SpawnRequest[]
}

/** A counting shim over the REAL OS provider (the negative control's counter),
 *  recording the exact argv it was asked to run. */
function countingProvider(inner: ConfinedProcessProvider): { provider: ConfinedProcessProvider; spawns: { count: number }; requests: SpawnRequest[] } {
  const spawns = { count: 0 }
  const requests: SpawnRequest[] = []
  const provider: ConfinedProcessProvider = {
    async spawnStreaming(request, streaming) {
      spawns.count += 1
      requests.push(request)
      return inner.spawnStreaming(request, streaming)
    },
  }
  return { provider, spawns, requests }
}

async function worldWith(
  effective: EffectiveIoPolicy,
  realmId: string,
  mutateArgv?: (argv: string[]) => string[],
): Promise<WorldHandles> {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFs, {})
  await root.plugin(BaseSubprocess, {})
  const sinkPath = join(world, `consult-${realmId}.jsonl`)
  // The preset plane: the REAL pinned search module, on the standing scope.
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(searchModule as never, { sampleOverCapGlobResults: false } as never)
  const agentKey = { session: { header: {} } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const osProvider = createConfinedProcessProvider({
    realmId,
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(world, `scratch-${realmId}`),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  }) as unknown as ConfinedProcessProvider
  const counted = countingProvider(osProvider)
  // MUTATION INSTRUMENTATION ONLY (R6/R6m/R7m): edit the argv at the provider
  // boundary. It decides nothing about the lane; the shipped face already made
  // its choice before this wrapper exists.
  const provider: ConfinedProcessProvider = mutateArgv === undefined
    ? counted.provider
    : {
        async spawnStreaming(request, streaming) {
          return counted.provider.spawnStreaming({ ...request, argv: mutateArgv([...request.argv]) }, streaming)
        },
      }

  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: ceiling(lane([inside]), lane([inside])) } }],
        providerClass: BaseFs,
        subprocess: {
          effective,
          provider,
          realmId,
          memberScope: IDENTITY.memberInstanceId,
          bindingId: 'dsh.search/grep',
        },
      }),
    }),
    member: {
      sessionId: 'session-bl16-realm',
      instanceId: IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-bl16',
      templateId: IDENTITY.templateId,
    },
  })
  return { root, agentKey, agentCtx: agent.ctx, realm, sinkPath, spawns: counted.spawns, requests: counted.requests }
}

async function attach(w: WorldHandles): Promise<unknown[]> {
  return row.attachA5sfNativeToolModules(w.realm, w.agentCtx, row.a5sfRealmConfigOf({
    a5sfEvidencePath: w.sinkPath,
    a5sfNativeToolModules: [{
      url: '@deepseek-ai/dsh-tool-fs-search',
      expectedTools: ['grep', 'glob'],
      config: { sampleOverCapGlobResults: false },
    }],
  }), w.agentKey)
}

async function call(w: WorldHandles, name: string, args: Record<string, unknown>): Promise<SearchToolResult> {
  const settled = await (w.root.get('tools') as unknown as {
    execute(input: Record<string, unknown>): Promise<{ isError?: boolean; content?: { type?: string; text?: string }[] }>
  }).execute({
    signal: new AbortController().signal,
    callId: `bl16-${name}-${Math.random().toString(16).slice(2)}`,
    agent: w.agentKey,
    name,
    arguments: args,
  })
  const text = Array.isArray(settled.content) ? settled.content.map((part) => (part?.type === 'text' ? part.text ?? '' : '')).join('') : ''
  return { isError: settled.isError === true, text }
}

interface FactLike {
  realm?: string
  memberIdentity?: string
  toolBindingIdentity?: string | null
  method?: string
  decision?: string
  decidedBy?: string
  locator?: string
  annotations?: readonly string[]
}

/** Read the sink through the PRODUCT reader (schema-checked), not a JSON.parse. */
async function factsOf(path: string): Promise<FactLike[]> {
  if (!existsSync(path)) return []
  return (await readGuardConsultFile(path)) as unknown as FactLike[]
}

/** Is this host's Landlock `content-read` leg enforced? R6m/R7m need it. */
async function kernelEnforced(realmId: string): Promise<boolean> {
  const provider = createConfinedProcessProvider({
    realmId: `probe-${realmId}`,
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(world, `scratch-probe-${realmId}`),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  }) as unknown as { probe(): Promise<{ ok: boolean; value?: { dimension: string; level: string }[] }> }
  const probe = await provider.probe()
  return probe.ok === true
    && probe.value?.some((entry) => entry.dimension === 'content-read' && entry.level === 'enforced') === true
}

// ---------------------------------------------------------------------------

describe('BL-16 realm wiring — the routed grep/glob resolve the CONFINED subprocess', () => {
  it('R0/R1: the preset definition reaches the INHERITED service; the shadow reaches the confined one', async () => {
    const w = await worldWith(effectiveOf(lane([inside]), lane([inside]), lane([inside])), 'realm-bl16-r01')
    try {
      // CONTROL — before the attach, the preset body resolves the inherited
      // service, whose tripwire throws. The tool reports the failure and ZERO
      // facts exist (the unconfined path consults no guard).
      const beforeCalls = BaseSubprocess.calls
      const before = await call(w, 'grep', { pattern: 'INSIDE-NEEDLE', path: inside })
      // The preset definition reached the INHERITED service: its tripwire threw
      // and the tool reported a launch failure. ZERO guard facts exist.
      expect(before.isError).toBe(true)
      expect(before.text).toContain('could not start its search command')
      expect(BaseSubprocess.calls).toBe(beforeCalls + 1)
      expect(await factsOf(w.sinkPath)).toHaveLength(0)

      await attach(w)
      const afterCalls = BaseSubprocess.calls
      const after = await call(w, 'grep', { pattern: 'INSIDE-NEEDLE', path: inside })
      expect(after.isError).toBe(false)
      expect(after.text).toContain('INSIDE-NEEDLE')
      // The shadow decided: the inherited service was NEVER reached again.
      expect(BaseSubprocess.calls).toBe(afterCalls)
      const facts = await factsOf(w.sinkPath)
      expect(facts).toHaveLength(1)
      expect(facts[0]).toMatchObject({
        realm: 'member',
        toolBindingIdentity: null,
        method: 'spawn',
        locator: inside,
        decision: 'allow',
        decidedBy: 'ALLOW',
        memberIdentity: IDENTITY.memberInstanceId,
      })
      expect(w.spawns.count).toBeGreaterThan(0)
    } finally {
      await w.realm.dispose()
    }
  }, 30_000)

  it('R2: an out-of-lane grep is refused BEFORE the provider is called, with one typed fact and no secret', async () => {
    const w = await worldWith(effectiveOf(lane([inside]), lane([inside]), lane([inside])), 'realm-bl16-r2')
    try {
      await attach(w)
      const before = w.spawns.count
      const outcome = await call(w, 'grep', { pattern: 'OUTSIDE-SECRET', path: outside })
      // THE NEGATIVE CONTROL, measured: no process was ever asked for, so no
      // byte of the outside tree could have been read and filtered later.
      expect(w.spawns.count).toBe(before)
      expect(outcome.isError).toBe(true)
      expect(outcome.text).not.toContain('OUTSIDE-SECRET-MUST-NOT-LEAK')
      const facts = await factsOf(w.sinkPath)
      expect(facts).toHaveLength(1)
      expect(facts[0]).toMatchObject({
        realm: 'member',
        method: 'spawn',
        locator: outside,
        decision: 'deny',
        decidedBy: 'IO_READ_DENIED',
      })
    } finally {
      await w.realm.dispose()
    }
  }, 30_000)

  it('R3: an in-lane search with no match is NOT an error — exit code 1 survives the handle adaptation', async () => {
    const w = await worldWith(effectiveOf(lane([inside]), lane([inside]), lane([inside])), 'realm-bl16-r3')
    try {
      await attach(w)
      const outcome = await call(w, 'grep', { pattern: 'NO-SUCH-NEEDLE-ANYWHERE', path: inside })
      expect(outcome.isError).toBe(false)
      expect(outcome.text.toLowerCase()).toContain('no matches')
    } finally {
      await w.realm.dispose()
    }
  }, 30_000)

  it('R4: an invalid pattern is a failure (rg exit 2) carrying the REAL rg stderr', async () => {
    const w = await worldWith(effectiveOf(lane([inside]), lane([inside]), lane([inside])), 'realm-bl16-r4')
    try {
      await attach(w)
      const outcome = await call(w, 'grep', { pattern: '([unclosed', path: inside })
      expect(outcome.isError).toBe(true)
      expect(outcome.text.toLowerCase()).not.toContain('no matches')
      // The face did not swallow rg's own diagnostic while making the
      // invocation lane-safe: the module prefixes the real stderr.
      expect(outcome.text).toContain('regex parse error')
    } finally {
      await w.realm.dispose()
    }
  }, 30_000)

  it('G1/G2: glob rides the SAME confined face — in-lane lists, out-of-lane is refused with a fact', async () => {
    const w = await worldWith(effectiveOf(lane([inside]), lane([inside]), lane([inside])), 'realm-bl16-g12')
    try {
      await attach(w)
      const insideGlob = await call(w, 'glob', { pattern: '*.txt', path: inside })
      expect(insideGlob.isError).toBe(false)
      expect(insideGlob.text).toContain('needle.txt')

      const before = w.spawns.count
      const outsideGlob = await call(w, 'glob', { pattern: '*.txt', path: outside })
      expect(w.spawns.count).toBe(before)
      expect(outsideGlob.isError).toBe(true)
      expect(outsideGlob.text).not.toContain('secret.txt')
      const facts = await factsOf(w.sinkPath)
      const denial = facts.filter((fact) => fact.decision === 'deny')
      expect(denial).toHaveLength(1)
      expect(denial[0]).toMatchObject({ method: 'spawn', locator: outside, decidedBy: 'IO_READ_DENIED' })
    } finally {
      await w.realm.dispose()
    }
  }, 30_000)

  it('R5: a shell body is refused at ADMISSION (0 spawns, one fact), and the KERNEL allowance is measured directly', async () => {
    // (a) The general-face hole: `sh -c 'cat /etc/passwd'` used to reach the
    // kernel with NO fact. Round 2 closes it at admission: shell/interpreter
    // argv is not statically attributable, so no process exists.
    const effective = effectiveOf(lane([inside]), lane([inside]), lane([inside]))
    const osProvider = createConfinedProcessProvider({
      realmId: 'realm-bl16-r5',
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(world, 'scratch-r5'),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    }) as unknown as ConfinedProcessProvider & {
      probe(): Promise<{ ok: boolean; value?: { dimension: string; level: string }[] }>
    }
    const { provider, spawns } = countingProvider(osProvider)
    const probe = await osProvider.probe()
    const dimension = probe.value?.find((row) => row.dimension === 'content-read')
    const enforced = probe.ok === true && dimension?.level === 'enforced'
    if (!enforced) {
      // NEVER green without the kernel: say so in the skip reason.
      expect.soft(enforced, `Landlock content-read is not enforced on this host: ${JSON.stringify(probe)}`).toBe(true)
      return
    }
    const { createConfinedSubprocessClass } = await import('../team-services/src/subprocess.js')
    const facts: { method: string; locator: string; decision: string; decidedBy: string }[] = []
    const Confined = createConfinedSubprocessClass(BaseSubprocess as never, {
      effective,
      provider,
      realmId: 'realm-bl16-r5',
      bindingId: 'dsh.search/grep',
      memberScope: IDENTITY.memberInstanceId,
      onGuardConsult: (fact) => {
        facts.push({ method: fact.method, locator: fact.locator, decision: fact.decision, decidedBy: fact.decidedBy })
      },
    })
    const root = new Context()
    const service = new (Confined as unknown as new (ctx: Context) => {
      spawn(spec: unknown): { done: Promise<{ exitCode: number | null; signal: string | null }>; collected: { stdout?: { readFrom(n: number): { text: string } } } }
    })(root)
    const handle = service.spawn({
      argv: ['/bin/sh', '-c', `cat /etc/passwd; cat ${outside}/secret.txt; cat ${inside}/needle.txt`],
      cwd: inside,
      stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
      graceMs: 5000,
    })
    await expect(handle.done).rejects.toThrow(/statically attributed|shell/i)
    expect(spawns.count).toBe(0)
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({ method: 'spawn', locator: '/bin/sh', decision: 'deny', decidedBy: 'IO_READ_DENIED' })
    expect(handle.collected.stdout?.readFrom(0).text ?? '').toBe('')

    // (b) Layer 2 alone (same request builder): the kernel DOES serve /etc
    // (the launcher's runtime_base) and DOES refuse the out-of-lane sibling.
    const profile = compileExecutionProfile(effective)
    expect(profile.ok).toBe(true)
    if (!profile.ok) return
    const spawned = await osProvider.spawnStreaming({
      grantFingerprint: 'bl16-realm-kernel',
      realmId: 'realm-bl16-r5',
      bindingId: 'dsh.search/grep',
      memberScope: IDENTITY.memberInstanceId,
      argv: ['/bin/sh', '-c', `head -c 24 /etc/passwd; echo SEP; cat ${outside}/secret.txt 2>&1; echo RC=$?; cat ${inside}/needle.txt`],
      cwd: inside,
      env: [],
      allowPaths: confinedSpawnAllowPaths(profile.value.allowPaths, '/bin/sh'),
      exitPassthrough: true,
    }, { graceMs: 5000 })
    expect(spawned.ok).toBe(true)
    if (!spawned.ok) return
    const text = await drainRealm(spawned.value)
    expect(text).toContain('root:x:0:0')
    expect(text).toContain('INSIDE-NEEDLE')
    expect(text).not.toContain('OUTSIDE-SECRET-MUST-NOT-LEAK')
    expect(text).toMatch(/Permission denied|EACCES/)
    // the secret is still on the host: the refusal is the launcher's, not a
    // deletion, and the harness never held the bytes.
    expect(readFileSync(join(outside, 'secret.txt'), 'utf8')).toContain('OUTSIDE-SECRET-MUST-NOT-LEAK')
  }, 60_000)

  it('R6: live row 1 through the REAL grep tool — an in-lane worktree search returns the match (one allow fact, disclosure recorded)', async (ctx) => {
    if (!await kernelEnforced('r6')) {
      ctx.skip('Landlock content-read is not enforced on this host')
      return
    }
    const effective = effectiveOf(lane([worktreeInside]), lane([worktreeInside]), lane([worktreeInside]))
    const w = await worldWith(effective, 'realm-bl16-r6')
    try {
      await attach(w)
      const before = w.spawns.count
      const outcome = await call(w, 'grep', { pattern: 'WT-NEEDLE', path: worktreeInside })
      expect(outcome.isError, `the routed grep must not fail on a worktree search; tool text: ${outcome.text}`).toBe(false)
      expect(outcome.text).toContain('WT-NEEDLE')
      expect(w.spawns.count).toBe(before + 1)
      const request = w.requests.at(-1)
      expect(request?.argv).toContain('--no-ignore-parent')
      expect(request?.argv).toContain('--no-ignore-vcs')
      const facts = await factsOf(w.sinkPath)
      expect(facts).toHaveLength(1)
      expect(facts[0]).toMatchObject({
        realm: 'member',
        method: 'spawn',
        locator: worktreeInside,
        decision: 'allow',
        decidedBy: 'ALLOW',
      })
      // The tool result is not the only place the operator can learn what
      // happened: the SAME allow fact says the discovery was disabled.
      expect(facts[0]?.annotations).toEqual(SEARCH_IGNORE_DISCOVERY_NOTES)
    } finally {
      await w.realm.dispose()
    }
  }, 60_000)

  it('R6m: MUTATION — stripping the two flags at the provider boundary reproduces the LIVE row-1 tool error verbatim', async (ctx) => {
    if (!await kernelEnforced('r6m')) {
      ctx.skip('Landlock content-read is not enforced on this host')
      return
    }
    const effective = effectiveOf(lane([worktreeInside]), lane([worktreeInside]), lane([worktreeInside]))
    const w = await worldWith(effective, 'realm-bl16-r6m', (argv) => argv.filter(
      (token) => token !== '--no-ignore-parent' && token !== '--no-ignore-vcs',
    ))
    try {
      await attach(w)
      const outcome = await call(w, 'grep', { pattern: 'WT-NEEDLE', path: worktreeInside })
      expect(outcome.isError).toBe(true)
      expect(outcome.text).toContain(`${worktree}/.git: Permission denied (os error 13)`)
      expect(outcome.text).toContain('exit 2')
    } finally {
      await w.realm.dispose()
    }
  }, 60_000)

  it('R7: a lane that includes the worktree root keeps ordinary .gitignore semantics (no silent global change)', async (ctx) => {
    if (!await kernelEnforced('r7')) {
      ctx.skip('Landlock content-read is not enforced on this host')
      return
    }
    const effective = effectiveOf(lane([worktree]), lane([worktree]), lane([worktree]))
    const w = await worldWith(effective, 'realm-bl16-r7')
    try {
      await attach(w)
      const outcome = await call(w, 'grep', { pattern: 'WT-NEEDLE', path: worktreeInside })
      expect(outcome.isError).toBe(false)
      expect(outcome.text).toContain('WT-NEEDLE')
      expect(outcome.text).not.toContain('ignored-but-present')
      const request = w.requests.at(-1)
      expect(request?.argv).not.toContain('--no-ignore-vcs')
      expect(request?.argv).not.toContain('--no-ignore-parent')
      const facts = await factsOf(w.sinkPath)
      expect(facts).toHaveLength(1)
      expect(facts[0]?.annotations).toBeUndefined()
    } finally {
      await w.realm.dispose()
    }
  }, 60_000)

  it('R7m: MUTATION — forcing the flags onto that lane loses .gitignore semantics (why the change is conditional)', async (ctx) => {
    if (!await kernelEnforced('r7m')) {
      ctx.skip('Landlock content-read is not enforced on this host')
      return
    }
    const effective = effectiveOf(lane([worktree]), lane([worktree]), lane([worktree]))
    const w = await worldWith(effective, 'realm-bl16-r7m', (argv) => {
      const at = argv.indexOf('--')
      return [...argv.slice(0, at), ...SEARCH_IGNORE_DISCOVERY_FLAGS, ...argv.slice(at)]
    })
    try {
      await attach(w)
      const outcome = await call(w, 'grep', { pattern: 'WT-NEEDLE', path: worktreeInside })
      expect(outcome.isError).toBe(false)
      expect(outcome.text).toContain('ignored-but-present')
    } finally {
      await w.realm.dispose()
    }
  }, 60_000)
})

/** Drain every stream of a raw provider handle, then report the exit. */
async function drainRealm(handle: ConfinedStreamProcess): Promise<string> {
  const chunks: Buffer[] = []
  const consume = async (stream: Readable): Promise<void> => {
    for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer))
  }
  await Promise.all([consume(handle.stdout), consume(handle.stderr), handle.exited])
  return Buffer.concat(chunks).toString('utf8')
}
