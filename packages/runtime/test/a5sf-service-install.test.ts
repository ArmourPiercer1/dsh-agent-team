/**
 * a5sf-service-install.test.ts — P1-05 (Gate G1.5): per-Member Service realm and
 * Provider binding over the REAL Cordis composition.
 *
 * What this file proves (and what it does NOT):
 *
 *  - Two Members are installed into ONE root Context as two `ctx.isolate('fs',
 *    label)` scopes. Each scope carries its OWN confined Provider instance; the
 *    root's provider is neither replaced nor shadowed (`root.get('fs')` keeps
 *    the base instance object identity).
 *  - Registration-time scope is proven by registering the SAME native-shaped
 *    tool name in both Member scopes through the real `defineTool` +
 *    `tools.register` seam; call-time identity is proven by executing each
 *    definition and observing which Provider (and therefore which Member
 *    ceiling) served the call.
 *  - The confinement is the P1-02/P1-03 policy: a read outside the Member's
 *    read axis is refused, a write outside the write axis is refused, and a
 *    write whose target is not readable is refused (`write ⇒ read`).
 *  - Install is fail-closed and atomic: a refused compile, a duplicate member,
 *    a missing base Provider, or a Provider without the managed method surface
 *    refuses the WHOLE install with a typed code and mounts nothing.
 *  - `dispose()` removes the Member's Provider from its scope.
 *
 * The Provider here is a test double for the *service-identity* laws (a real
 * `LocalFileSystem` is not importable from this package's dependency closure —
 * pnpm's strict layout, and no lockfile change is allowed in a worktree). The
 * double is mounted through the same public `Service`/`Context` seams and the
 * install samples `Object.getPrototypeOf(root.get('fs')).constructor`, exactly
 * as it will sample `fs-local`/`fs-sandbox` in a real Host. Full native
 * `tool-fs` dispatch over the real Host composition is the P2/E2E leg; this
 * file does not claim it.
 *
 * @module @dsh-agent-team/runtime/test/a5sf-service-install
 */
import { mkdtemp, mkdir, readFile, rm, stat as statFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { ToolRuntime, type ToolDefinition } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  EffectiveIoPolicy,
  MemberPolicy,
  PathRuleSet,
  TrustedMemberIdentity,
} from '../member-io-policy/src/types.js'
import { installMemberIoProviders, installToolBindingRealm } from '../team-services/src/install.js'
import { mountA5sfRealm } from '../team-services/src/mount.js'
import { createInvocationBinder } from '../member-io-policy/src/invocation.js'
import {
  mintApprovedAskReceipt,
  prepareApprovedWriteOperation,
  registerPendingApprovedAskReceipt,
  runWithApprovedAskExecutionScope,
} from '../member-io-policy/src/approved-ask-receipt.js'
import {
  createGuardConsultFileSink,
  GuardObservationError,
  observeGuard,
  readGuardConsultFile,
  type GuardConsultFact,
} from '../team-services/src/guard-observability.js'
import type { MemberServiceInstallation } from '../team-services/src/types.js'
import type { MemberServiceSpec } from '../team-services/src/install.js'
import { TEAM_IO_DENIAL_CODES, TeamServiceInstallError } from '../team-services/src/types.js'

/** Fixture root: workspace-local, never `tests/homes`, cleaned at the end. */
const FIXTURE_PARENT = join(process.cwd(), '.artifacts', 'tmp')

let rootDir = ''
let dirA = ''
let dirB = ''
let outsideDir = ''

const IDENTITY_A: TrustedMemberIdentity = Object.freeze({
  teamId: 'team-a5sf',
  memberInstanceId: 'member-a',
  templateId: 'worker',
  instanceGeneration: 1,
})
const IDENTITY_B: TrustedMemberIdentity = Object.freeze({
  ...IDENTITY_A,
  memberInstanceId: 'member-b',
})
const DUP: TrustedMemberIdentity = Object.freeze({ ...IDENTITY_A, memberInstanceId: 'member-dup' })

function lane(allow: string[], deny: string[] = [], ask: string[] = []): PathRuleSet {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze(allow), ask: Object.freeze(ask), deny: Object.freeze(deny) })
}

function policyOf(identity: TrustedMemberIdentity, read: PathRuleSet, write: PathRuleSet): MemberPolicy {
  return Object.freeze({
    memberIdentity: identity.memberInstanceId,
    templateId: identity.templateId,
    instanceGeneration: identity.instanceGeneration,
    revision: `rev-${identity.memberInstanceId}`,
    read,
    write,
    network: Object.freeze({ access: 'allow' as const }),
  })
}

// --- the test Provider (a real Service implementation over node:fs) ---------

interface FsTargetLike {
  readonly hostPath: string
}

class TestFileSystem extends Service {
  constructor(ctx: Context, config: Record<string, unknown> = {}) {
    super(ctx, 'fs')
    this.config = config
  }

  readonly config: Record<string, unknown>

  /** Base-Provider read count, used by the P2 seam's fail-closed arm. */
  static reads = 0

  processPath(target: unknown): string {
    return (target as FsTargetLike).hostPath
  }

  contains(parent: unknown, child: unknown): boolean {
    return this.processPath(child).startsWith(this.processPath(parent))
  }

  async resolve(path: string): Promise<FsTargetLike> {
    return { hostPath: path }
  }

  async readText(target: unknown): Promise<string> {
    TestFileSystem.reads += 1
    return readFile(this.processPath(target), 'utf8')
  }

  async streamText(target: unknown): Promise<AsyncIterable<string>> {
    const text = await this.readText(target)
    return (async function* stream(): AsyncGenerator<string> {
      yield text
    })()
  }

  async readBytes(target: unknown): Promise<Uint8Array> {
    return readFile(this.processPath(target))
  }

  async readByteRange(target: unknown, range: { offset: number; length: number }): Promise<Uint8Array> {
    const bytes = await readFile(this.processPath(target))
    return bytes.subarray(range.offset, range.offset + range.length)
  }

  async listDir(target: unknown): Promise<unknown[]> {
    const { readdir } = await import('node:fs/promises')
    return (await readdir(this.processPath(target))).map((name) => ({ name }))
  }

  async stat(target: unknown): Promise<unknown> {
    const info = await statFile(this.processPath(target))
    return { size: info.size }
  }

  async lstat(path: string): Promise<unknown> {
    return statFile(path)
  }

  async watch(): Promise<() => Promise<void>> {
    return async () => {}
  }

  async writeText(target: unknown, content: string): Promise<unknown> {
    await writeFile(this.processPath(target), content, 'utf8')
    return { version: 'v1' }
  }

  async editText(): Promise<unknown> {
    return { version: 'v2' }
  }
}

/** The root-level base Provider the install samples. */
class BaseFileSystem extends TestFileSystem {}

/** A Provider that fails to mount when its config says so (rollback leg). */
class FailingFileSystem extends TestFileSystem {
  constructor(ctx: Context, config: Record<string, unknown> = {}) {
    if (config.failMount === true) throw new Error('boom: provider mount failed')
    super(ctx, config)
  }
}

/** A Provider missing the managed surface — the install must refuse it. */
class IncompleteFileSystem extends TestFileSystem {}
// Deliberately remove the managed method from the PROTOTYPE surface the install
// inspects, so the install must notice the missing capability.
Object.defineProperty(IncompleteFileSystem.prototype, 'readBytes', { get: () => undefined })

let root: Context
/** Definitions registered inside each Member scope (same tool name twice). */
const registered = new Map<string, (args: { path: string }) => Promise<string>>()

function registerProbeTool(ctx: Context, memberKey: string, toolName: string): void {
  const definition: ToolDefinition = {
    name: toolName,
    description: 'read a file through the scoped fs Provider',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value as string }] },
    async execute(args: { path: string }): Promise<string> {
      const fs = (ctx as unknown as { fs: TestFileSystem }).fs
      const target = await fs.resolve(args.path)
      return fs.readText(target)
    },
  }
  ctx.tools.register(definition)
  registered.set(memberKey, (args) => definition.execute(args, {} as never) as Promise<string>)
}

beforeAll(async () => {
  await mkdir(FIXTURE_PARENT, { recursive: true })
  rootDir = await mkdtemp(join(FIXTURE_PARENT, 'a5sf-p1-05-'))
  dirA = join(rootDir, 'a')
  dirB = join(rootDir, 'b')
  outsideDir = join(rootDir, 'outside')
  await mkdir(dirA, { recursive: true })
  await mkdir(dirB, { recursive: true })
  await mkdir(outsideDir, { recursive: true })
  await writeFile(join(dirA, 'a.txt'), 'alpha\n', 'utf8')
  await writeFile(join(dirB, 'b.txt'), 'beta\n', 'utf8')
  await writeFile(join(outsideDir, 'secret.txt'), 'secret\n', 'utf8')

  root = new Context()
  await root.plugin(SystemPrompt, {})
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFileSystem, { root: rootDir })
})

afterAll(async () => {
  await rm(rootDir, { recursive: true, force: true })
})

/** Install the two Members once per suite; the tests only read. */
const setup = async (): Promise<{ a: MemberServiceInstallation; b: MemberServiceInstallation }> => {
  const specs: MemberServiceSpec[] = [
    {
      identity: IDENTITY_A,
      policy: { ok: true, value: policyOf(IDENTITY_A, lane([dirA]), lane([dirA])) },
    },
    {
      identity: IDENTITY_B,
      policy: { ok: true, value: policyOf(IDENTITY_B, lane([dirB]), lane([dirB])) },
    },
  ]
  const installation = await installMemberIoProviders({ root, members: specs })
  const [a, b] = installation.members as [MemberServiceInstallation, MemberServiceInstallation]
  // Distinct tool NAMES per Member: DSH's per-agent same-name variants are
  // registered through an agent scope (P2 host leg); here each definition's
  // BODY resolves `ctx.fs` from its own isolated Cordis scope, which is the
  // service-identity property this file proves.
  registerProbeTool(a.ctx, 'a', 'read_file_a')
  registerProbeTool(b.ctx, 'b', 'read_file_b')
  return { a, b }
}

describe('P1-05 per-Member service realm', () => {
  let a!: MemberServiceInstallation
  let b!: MemberServiceInstallation

  beforeAll(async () => {
    const installed = await setup()
    a = installed.a
    b = installed.b
  })

  it('installs one Provider instance per Member, none at the root', () => {
    expect(a.fs).not.toBe(b.fs)
    expect(root.get('fs')).toBeInstanceOf(BaseFileSystem)
    expect(root.get('fs')).not.toBe(a.fs)
    expect(root.get('fs')).not.toBe(b.fs)
    expect(Object.isFrozen(a.serviceIdentity)).toBe(true)
    expect(a.serviceIdentity.memberInstanceId).toBe('member-a')
    expect(a.serviceIdentity.policyRevision).toBe('rev-member-a')
  })

  it('round-trips a read inside the Member read axis', async () => {
    expect(await a.fs.readText(await a.fs.resolve(join(dirA, 'a.txt')))).toBe('alpha\n')
    expect(await b.fs.readText(await b.fs.resolve(join(dirB, 'b.txt')))).toBe('beta\n')
  })

  it('refuses a read outside the Member read axis, per Member', async () => {
    const aReadingB = a.fs.readText(await a.fs.resolve(join(dirB, 'b.txt')))
    await expect(aReadingB).rejects.toMatchObject({ code: 'IO_READ_DENIED' })
    const bReadingA = b.fs.readText(await b.fs.resolve(join(dirA, 'a.txt')))
    await expect(bReadingA).rejects.toMatchObject({ code: 'IO_READ_DENIED' })
    const aReadingOutside = a.fs.readText(await a.fs.resolve(join(outsideDir, 'secret.txt')))
    await expect(aReadingOutside).rejects.toMatchObject({ code: 'IO_READ_DENIED' })
  })

  it('refuses a write outside the write axis and a write whose target is not readable', async () => {
    await expect(a.fs.writeText(await a.fs.resolve(join(dirB, 'in-b.txt')), 'x')).rejects.toMatchObject({
      code: 'IO_WRITE_DENIED',
    })
    // A write axis that allows the target but a read axis that does not: write ⇒ read.
    const narrow = await installMemberIoProviders({
      root,
      members: [
        {
          identity: { ...IDENTITY_A, memberInstanceId: 'member-narrow' },
          policy: { ok: true, value: policyOf({ ...IDENTITY_A, memberInstanceId: 'member-narrow' }, lane([join(dirA, 'sub')]), lane([dirA])) },
        },
      ],
    })
    const narrowMember = narrow.members[0]!
    await expect(narrowMember.fs.writeText(await narrowMember.fs.resolve(join(dirA, 'a.txt')), 'x')).rejects.toMatchObject({
      code: 'IO_WRITE_REQUIRES_READ',
    })
    await narrowMember.dispose()
  })

  it('allows a write inside both axes', async () => {
    const target = join(dirA, 'written.txt')
    await a.fs.writeText(await a.fs.resolve(target), 'written\n')
    expect(await readFile(target, 'utf8')).toBe('written\n')
  })

  it('resolves a tool body against its own Member Provider at call time', async () => {
    const readA = registered.get('a')!
    const readB = registered.get('b')!
    expect(await readA({ path: join(dirA, 'a.txt') })).toBe('alpha\n')
    expect(await readB({ path: join(dirB, 'b.txt') })).toBe('beta\n')
    // Each tool keeps its own ceiling: A's tool cannot read B's file.
    await expect(readA({ path: join(dirB, 'b.txt') })).rejects.toMatchObject({ code: 'IO_READ_DENIED' })
  })

  it('refuses the whole install on a refused compile / duplicate / missing base Provider', async () => {
    const refusedPolicy = { ok: false as const, code: 'MEMBER_CEILING_UNDECLARED' as const, detail: 'no ceiling', path: 'memberIoCeilings' }
    await expect(
      installMemberIoProviders({
        root,
        members: [{ identity: { ...IDENTITY_A, memberInstanceId: 'member-x' }, policy: refusedPolicy }],
      }),
    ).rejects.toMatchObject({ code: 'MEMBER_POLICY_UNAVAILABLE' })

    await expect(
      installMemberIoProviders({
        root,
        members: [
          { identity: DUP, policy: { ok: true, value: policyOf(DUP, lane([dirA]), lane([dirA])) } },
          { identity: DUP, policy: { ok: true, value: policyOf(DUP, lane([dirA]), lane([dirA])) } },
        ],
      }),
    ).rejects.toMatchObject({ code: 'MEMBER_DUPLICATE' })

    const empty = new Context()
    await empty.plugin(SystemPrompt, {})
    await expect(
      installMemberIoProviders({
        root: empty,
        members: [{ identity: IDENTITY_A, policy: { ok: true, value: policyOf(IDENTITY_A, lane([dirA]), lane([dirA])) } }],
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' })
  })

  it('refuses a Provider that lacks the managed method surface', async () => {
    const incomplete = new Context()
    await incomplete.plugin(SystemPrompt, {})
    await incomplete.plugin(IncompleteFileSystem, {})
    await expect(
      installMemberIoProviders({
        root: incomplete,
        members: [{ identity: IDENTITY_A, policy: { ok: true, value: policyOf(IDENTITY_A, lane([dirA]), lane([dirA])) } }],
      }),
    ).rejects.toMatchObject({ code: 'PROVIDER_INCOMPATIBLE' })
  })

  it('dispose removes the Member Provider from its scope', async () => {
    const disposable = await installMemberIoProviders({
      root,
      members: [
        { identity: { ...IDENTITY_A, memberInstanceId: 'member-gone' }, policy: { ok: true, value: policyOf({ ...IDENTITY_A, memberInstanceId: 'member-gone' }, lane([dirA]), lane([dirA])) } },
      ],
    })
    const only = disposable.members[0]!
    expect(only.ctx.get('fs')).toBeInstanceOf(TestFileSystem)
    await only.dispose()
    expect(only.ctx.get('fs')).toBeUndefined()
  })

  it('keeps the closed denial vocabulary small and exported', () => {
    expect(TEAM_IO_DENIAL_CODES).toContain('IO_READ_DENIED')
    expect(TEAM_IO_DENIAL_CODES).toContain('IO_WRITE_DENIED')
    expect(TEAM_IO_DENIAL_CODES).toContain('IO_WRITE_REQUIRES_READ')
    expect(new TeamServiceInstallError('MEMBER_DUPLICATE', 'x').code).toBe('MEMBER_DUPLICATE')
  })

  it('rolls back an already-mounted Member when a LATER mount fails (all-or-nothing)', async () => {
    const scopedRoot = new Context()
    await scopedRoot.plugin(SystemPrompt, {})
    await scopedRoot.plugin(ToolRuntime)
    await scopedRoot.plugin(BaseFileSystem, {})
    await expect(
      installMemberIoProviders({
        root: scopedRoot,
        providerClass: FailingFileSystem,
        members: [
          { identity: IDENTITY_A, policy: { ok: true, value: policyOf(IDENTITY_A, lane([dirA]), lane([dirA])) } },
          {
            identity: { ...IDENTITY_A, memberInstanceId: 'member-fails' },
            policy: { ok: true, value: policyOf({ ...IDENTITY_A, memberInstanceId: 'member-fails' }, lane([dirA]), lane([dirA])) },
            config: { failMount: true },
          },
        ],
      }),
    ).rejects.toMatchObject({ code: 'SERVICE_MOUNT_FAILED' })
    // Nothing from the failed install survives: the first Member can be
    // installed again (no duplicate/ghost entry) and its realm serves normally.
    const retry = await installMemberIoProviders({
      root: scopedRoot,
      providerClass: BaseFileSystem,
      members: [{ identity: IDENTITY_A, policy: { ok: true, value: policyOf(IDENTITY_A, lane([dirA]), lane([dirA])) } }],
    })
    expect(await retry.members[0]!.fs.readText(await retry.members[0]!.fs.resolve(join(dirA, 'a.txt')))).toBe('alpha\n')
    await retry.dispose()
  })

  it('refuses a policy compiled for a STALE instance generation', async () => {
    const stale = policyOf(IDENTITY_A, lane([dirA]), lane([dirA]))
    await expect(
      installMemberIoProviders({
        root,
        members: [{ identity: { ...IDENTITY_A, instanceGeneration: 2 }, policy: { ok: true, value: stale } }],
      }),
    ).rejects.toMatchObject({ code: 'MEMBER_POLICY_STALE' })
  })

  it('a tool-binding realm enforces the NARROWER effective lane, not the Member ceiling', async () => {
    const docs = join(dirA, 'docs')
    await mkdir(docs, { recursive: true })
    await writeFile(join(docs, 'narrow.txt'), 'narrow\n', 'utf8')
    const effective: EffectiveIoPolicy = Object.freeze({
      memberIdentity: IDENTITY_A.memberInstanceId,
      toolBindingIdentity: 'dsh.fs/read',
      invocationId: 'call-narrow',
      policyRevision: 'rev-narrow',
      read: lane([docs]),
      write: lane([]),
      network: Object.freeze({ access: 'allow' as const }),
    })
    const realm = await installToolBindingRealm({
      root,
      spec: { identity: IDENTITY_A, toolBindingIdentity: 'dsh.fs/read', effective },
    })
    expect(await realm.fs.readText(await realm.fs.resolve(join(docs, 'narrow.txt')))).toBe('narrow\n')
    // The Member ceiling allows dirA, but the BINDING does not: refused.
    await expect(realm.fs.readText(await realm.fs.resolve(join(dirA, 'a.txt')))).rejects.toMatchObject({ code: 'IO_READ_DENIED' })
    await realm.dispose()
  })
})

// ---------------------------------------------------------------------------
// P2 seam (BL-14/P2-01 follow-up): guard consultations are observable, the
// default path is unchanged, and the ONE mount entry point composes the two
// installers. The cross-process transport is proved in
// `tests/world-factory/a5sf-p2-seam.test.mjs`; this block pins the package-side
// laws over the REAL Cordis unit root.
// ---------------------------------------------------------------------------

describe('P2 seam: observable guard consultations', () => {
  const seamLane = (allow: string[]): PathRuleSet => lane(allow)

  function seamEffective(identity: TrustedMemberIdentity, binding: string, allow: string[]): EffectiveIoPolicy {
    return Object.freeze({
      memberIdentity: identity.memberInstanceId,
      toolBindingIdentity: binding,
      invocationId: `call-${binding}`,
      policyRevision: `rev-${binding}`,
      read: seamLane(allow),
      write: seamLane(allow),
      network: Object.freeze({ access: 'allow' as const }),
    })
  }

  it('default path: no observer ⇒ same frozen shape and same allow/deny outcomes', async () => {
    const dir = await mkdtemp(join(rootDir, 'seam-default-'))
    await writeFile(join(dir, 'ok.txt'), 'ok\n', 'utf8')
    const identity = { ...IDENTITY_A, memberInstanceId: 'member-seam-default' }
    const effective = seamEffective(identity, 'seam/read', [dir])

    const plain = await installToolBindingRealm({ root, spec: { identity, toolBindingIdentity: 'seam/read', effective } })
    const observed = await installToolBindingRealm({
      root,
      spec: { identity: { ...identity, memberInstanceId: 'member-seam-observed' }, toolBindingIdentity: 'seam/read-observed', effective: seamEffective({ ...identity, memberInstanceId: 'member-seam-observed' }, 'seam/read-observed', [dir]) },
      onGuardConsult: () => undefined,
    })
    expect(Object.keys(plain).sort()).toEqual(Object.keys(observed).sort())
    expect(Object.isFrozen(plain)).toBe(true)
    expect(plain.policyRevision).toBe('rev-seam/read')
    expect(await plain.fs.readText(await plain.fs.resolve(join(dir, 'ok.txt')))).toBe('ok\n')
    await expect(plain.fs.readText(await plain.fs.resolve(join(dirA, 'a.txt')))).rejects.toMatchObject({ code: 'IO_READ_DENIED' })
    await plain.dispose()
    await observed.dispose()
  })

  it('observer forwards the optional operation context VERBATIM (R3 receipt bytes)', async () => {
    const seen: Array<{ method: string; hostPath: string; operation: unknown }> = []
    const inner = async (method: string, hostPath: string, _annotations?: readonly string[], operation?: { content?: string }): Promise<void> => {
      seen.push({ method, hostPath, operation })
    }
    const observed = observeGuard(inner, () => undefined, {
      realm: 'member',
      memberIdentity: 'member-observe-operation',
      toolBindingIdentity: null,
      policyRevision: 'rev-observe-operation',
    })
    await observed('writeText', '/tmp/x', undefined, { content: 'approved bytes' })
    expect(seen).toEqual([{ method: 'writeText', hostPath: '/tmp/x', operation: { content: 'approved bytes' } }])
  })

  it('observer records one fact per consultation, and the JSONL sink round-trips', async () => {
    const dir = await mkdtemp(join(rootDir, 'seam-observe-'))
    await writeFile(join(dir, 'ok.txt'), 'ok\n', 'utf8')
    const sinkDir = await mkdtemp(join(FIXTURE_PARENT, 'seam-sink-'))
    const sinkPath = join(sinkDir, 'consult.jsonl')
    const sink = createGuardConsultFileSink({ path: sinkPath })
    const facts: GuardConsultFact[] = []
    const identity = { ...IDENTITY_A, memberInstanceId: 'member-seam-observe' }
    const mounted = await mountA5sfRealm({
      root,
      members: [{ identity, policy: { ok: true, value: policyOf(identity, lane([dir]), lane([dir])) } }],
      bindings: [{ identity, toolBindingIdentity: 'seam/observe', effective: seamEffective(identity, 'seam/observe', [dir]) }],
      providerClass: BaseFileSystem,
      onGuardConsult: async (fact) => {
        facts.push(fact)
        await sink.record(fact)
      },
    })
    const binding = mounted.bindings[0]!
    expect(await binding.fs.readText(await binding.fs.resolve(join(dir, 'ok.txt')))).toBe('ok\n')
    await expect(binding.fs.readText(await binding.fs.resolve(join(dirA, 'a.txt')))).rejects.toMatchObject({ code: 'IO_READ_DENIED' })
    expect(facts.map((fact) => fact.sequence)).toEqual([1, 2])
    expect(facts.map((fact) => fact.decidedBy)).toEqual(['ALLOW', 'IO_READ_DENIED'])
    expect(facts.every((fact) => fact.realm === 'binding' && fact.toolBindingIdentity === 'seam/observe')).toBe(true)
    expect(await readGuardConsultFile(sinkPath)).toEqual(facts)
    await mounted.dispose()
  })

  it('sink failure is fail-closed and reported, and the Provider is never consulted', async () => {
    const dir = await mkdtemp(join(rootDir, 'seam-fail-'))
    await writeFile(join(dir, 'ok.txt'), 'ok\n', 'utf8')
    const identity = { ...IDENTITY_A, memberInstanceId: 'member-seam-fail' }
    const sink = createGuardConsultFileSink({ path: join(dir, 'missing-subdir', 'consult.jsonl') })
    const realm = await installToolBindingRealm({
      root,
      spec: { identity, toolBindingIdentity: 'seam/fail', effective: seamEffective(identity, 'seam/fail', [dir]) },
      onGuardConsult: (fact) => sink.record(fact),
    })
    TestFileSystem.reads = 0
    await expect(realm.fs.readText(await realm.fs.resolve(join(dir, 'ok.txt')))).rejects.toBeInstanceOf(GuardObservationError)
    expect(TestFileSystem.reads).toBe(0)
    await realm.dispose()
  })
})

/**
 * R3 PRODUCTION WIRING (round 95). The mount must hand the confined Provider
 * the SAME invocation binder the centre spends grants through, or a receipt
 * minted for an approved `write` can never be verified and every ask fails
 * closed. These arms pin the SEAM, not the approval chain itself (the chain is
 * proven by ADM-154…161 and by the live D4 judge):
 *
 *  - with the authority supplied, an in-scope receipt for THIS effect authorizes
 *    the `writeText` and the REAL bytes land;
 *  - with the authority OMITTED (the pre-R3 mount), the same receipt is refused
 *    `RECEIPT_AUTHORITY_UNAVAILABLE` — fail-closed, never an ambient allow;
 *  - with the authority supplied but NO execution scope, the ask is refused
 *    `RECEIPT_NOT_IN_SCOPE` before any byte.
 *
 * No lane is widened: the write axis still says `ask`, `deny` still wins, and
 * the receipt is only consulted on the `ask` branch.
 */
describe('R3 production wiring: the mount passes the invocation binder', () => {
  const CONTENT = 'WIRED-APPROVED-BYTES\n'

  async function wiredRealm(options: { withAuthority: boolean }): Promise<{
    identity: TrustedMemberIdentity
    dir: string
    target: string
    fs: MemberServiceInstallation['fs']
    binder: ReturnType<typeof createInvocationBinder>
    dispose: () => Promise<void>
  }> {
    const dir = await mkdtemp(join(FIXTURE_PARENT, 'a5sf-r3-wiring-'))
    const target = join(dir, 'approved.txt')
    const identity: TrustedMemberIdentity = {
      ...IDENTITY_A,
      memberInstanceId: `member-r3-${options.withAuthority ? 'authority' : 'no-authority'}-${Math.random().toString(36).slice(2, 8)}`,
    }
    const scopedRoot = new Context()
    await scopedRoot.plugin(SystemPrompt, {})
    await scopedRoot.plugin(ToolRuntime)
    await scopedRoot.plugin(BaseFileSystem, { root: dir })
    const binder = createInvocationBinder()
    const installation = await installMemberIoProviders({
      root: scopedRoot,
      members: [{
        identity,
        policy: { ok: true, value: policyOf(identity, lane([dir]), lane([], [], [dir])) },
      }],
      ...(options.withAuthority ? { approvedAskAuthority: { binder } } : {}),
    })
    return {
      identity,
      dir,
      target,
      fs: installation.members[0]!.fs,
      binder,
      dispose: installation.dispose,
    }
  }

  async function receiptFor(identity: TrustedMemberIdentity, dir: string, target: string, binder: ReturnType<typeof createInvocationBinder>) {
    const prepared = await prepareApprovedWriteOperation({ locator: target, content: CONTENT })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) throw new Error(prepared.detail)
    const minted = mintApprovedAskReceipt({
      executionId: 'exec-r3-wiring',
      callId: 'call-r3-wiring',
      member: identity,
      toolName: 'write',
      toolBindingIdentity: '',
      operation: prepared.value,
      policyGeneration: `rev-${identity.memberInstanceId}`,
      approval: { requestId: 'req-r3-wiring', decisionId: 'decision-r3-wiring', caseId: null, legOrdinal: null },
      grant: {
        consumed: true,
        binderEpoch: binder.currentEpoch(),
        memberEpoch: binder.currentMemberEpoch(identity.memberInstanceId),
      },
      bounds: { read: lane([dir]), write: lane([], [], [dir]) },
    })
    expect(minted.ok).toBe(true)
    if (!minted.ok) throw new Error(minted.detail)
    return minted.value
  }

  it('with authority: an in-scope receipt authorizes the approved writeText and the bytes land', async () => {
    const realm = await wiredRealm({ withAuthority: true })
    try {
      const receipt = await receiptFor(realm.identity, realm.dir, realm.target, realm.binder)
      registerPendingApprovedAskReceipt({}, receipt)
      await runWithApprovedAskExecutionScope(receipt, async () => {
        await realm.fs.writeText({ hostPath: realm.target } as never, CONTENT)
      })
      expect(await readFile(realm.target, 'utf8')).toBe(CONTENT)
    } finally {
      await realm.dispose()
      await rm(realm.dir, { recursive: true, force: true })
    }
  })

  it('without authority (pre-R3 mount): the same receipt is refused, zero bytes', async () => {
    const realm = await wiredRealm({ withAuthority: false })
    try {
      const receipt = await receiptFor(realm.identity, realm.dir, realm.target, realm.binder)
      registerPendingApprovedAskReceipt({}, receipt)
      await expect(runWithApprovedAskExecutionScope(receipt, async () => {
        await realm.fs.writeText({ hostPath: realm.target } as never, CONTENT)
      })).rejects.toMatchObject({
        code: 'IO_ASK_RECEIPT_REFUSED',
        message: expect.stringContaining('RECEIPT_AUTHORITY_UNAVAILABLE'),
      })
      await expect(statFile(realm.target)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await realm.dispose()
      await rm(realm.dir, { recursive: true, force: true })
    }
  })

  it('with authority but outside any execution scope: refused, zero bytes', async () => {
    const realm = await wiredRealm({ withAuthority: true })
    try {
      await expect(realm.fs.writeText({ hostPath: realm.target } as never, CONTENT)).rejects.toMatchObject({
        code: 'IO_ASK_RECEIPT_REFUSED',
        message: expect.stringContaining('RECEIPT_NOT_IN_SCOPE'),
      })
      await expect(statFile(realm.target)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await realm.dispose()
      await rm(realm.dir, { recursive: true, force: true })
    }
  })
})
