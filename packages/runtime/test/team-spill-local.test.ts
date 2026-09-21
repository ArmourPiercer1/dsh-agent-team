/**
 * team-spill-local.test.ts — Strict-read + Core-spill Phase C: the
 * Team-aware local spill provider (`TeamAwareLocalSpillStore`) — the
 * REAL class over a minimal structural Cordis context (the `Service`
 * base's constructor + effect surface, no fiber machinery) and the REAL
 * `TeamArtifactAuthority` over fakes (the fs auto-materializes the
 * written file; the identity port carries one managed member; the
 * ledger records puts and can fault):
 *
 *  S1  managed member session: saveText stores the file (the upstream
 *      path) AND records the durable grant (one ledger put, the closed
 *      payload, `spill-store` provenance) — and the END-TO-END vertical
 *      closes: `authorizeRead` on the exact locator + freshly resolved
 *      target returns `valid: true`;
 *  S2  unmanaged session: upstream-equivalent — the file is stored, the
 *      ref is returned, ZERO grant I/O (no ledger put, no fs identity
 *      lookup);
 *  S3  managed session + DURABLE PUT FAILURE: saveText REJECTS (the
 *      stable `ArtifactRecordError`, code ARTIFACT_RECORD_FAILED) and
 *      no runtime grant is ever installed (the registry stays empty —
 *      the artifact is never grant-backed without its durable fact);
 *  S4  bridge WITHOUT an authority (bootstrap not settled / failed):
 *      upstream-equivalent, no crash, no I/O;
 *  S5  the row registers the SAME `spillStore` service the base row
 *      registers (the inherited `Service` base — the upstream consumers
 *      see no difference) and the module's default export is the class
 *      (the Cordis loader's unwrap shape);
 *  S6  the `session-reference` source arm maps verbatim onto the
 *      durable payload (the closed two-arm union, both arms pinned);
 *  S7  a STORAGE failure (the upstream write path) rejects BEFORE any
 *      grant I/O (no put, no install — the record runs only after a
 *      durable file);
 *  S8  an ineligible (DISPOSED) managed instance: saveText REJECTS
 *      (D6 eligibility at issuance) — no put, no install.
 *  C1  CONFIG MIGRATION REGRESSION (PR #26 supplemental §3.1-B): a
 *      custom `root` on the team-spill-local row is honored by the
 *      INHERITED LocalSpillStore (resolved absolute, not the private
 *      `dsh-spill-*` default; saveText lands under it) — the config a
 *      profile already carries for the old `spill-local` row survives
 *      the provider replacement;
 *  C2  CONFIG MIGRATION REGRESSION (PR #26 supplemental §3.1-B): a
 *      non-default `cleanupPeriodDays` propagates into the inherited
 *      LocalSpillStore — the resolved config carries it (not the 30-day
 *      default, not the 0-disable) AND the inherited startup sweep runs
 *      at THAT period (exercised through the documented LocalSpillStore
 *      `gatherRoots` test seam with an isolated root set — expired
 *      session content is reclaimed, fresh content is kept).
 *
 * @module @dsh-agent-team/runtime/test/team-spill-local
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { SaveTextSpill } from '@deepseek-ai/dsh-spill'
import {
  ArtifactRecordError,
  TeamArtifactAuthority,
  targetKeyDigest,
  versionDigest,
} from '../artifact-read/index.js'
import type {
  ArtifactFsInfo,
  ArtifactFsPort,
  ArtifactFsTarget,
  ArtifactIdentityPort,
  ArtifactInstanceLifecycle,
  ArtifactLedgerEntry,
  ArtifactLedgerPort,
} from '../artifact-read/index.js'
import {
  TeamAwareLocalSpillStore,
  default as SpillStoreDefault,
} from '../src/plugin/team-spill-local.js'
import type { TeamArtifactAuthorityBridge } from '../src/plugin/artifact-grant-bridge.js'

const ROOT = 'team-root-s'
const MEMBER = 'inst-worker-s'

// --- the fake fs port (auto-materializes written files) -------------------------

interface FsWorld {
  readonly targets: Map<
    string,
    { targetKey: string; version: string; type: 'file' | 'directory' | 'other' }
  >
  resolveCalls: string[]
  statCalls: string[]
}

function makeFsWorld(): FsWorld {
  return { targets: new Map(), resolveCalls: [], statCalls: [] }
}

function makeFsPort(world: FsWorld): ArtifactFsPort {
  return {
    async resolve(path: string): Promise<ArtifactFsTarget> {
      world.resolveCalls.push(path)
      let target = world.targets.get(path)
      if (target === undefined) {
        // The file exists on disk (the store wrote it) — materialize a
        // stable identity (first sight wins: same path → same targetKey
        // for the rest of the world's life).
        target = { targetKey: `tk:${path}`, version: 'v1', type: 'file' }
        world.targets.set(path, target)
      }
      return { targetKey: target.targetKey, displayPath: path }
    },
    async stat(target: ArtifactFsTarget): Promise<ArtifactFsInfo | undefined> {
      world.statCalls.push(target.targetKey)
      const file = [...world.targets.values()].find((f) => f.targetKey === target.targetKey)
      if (file === undefined) return undefined
      return { version: file.version, type: file.type, size: 1 }
    },
  }
}

// --- the identity port (managed bindings + lifecycles) --------------------------

interface IdentityWorld {
  /** sessionId → (root, instance) binding. Absent = unmanaged. */
  readonly bindings: Map<string, { rootSessionId: string; instanceId: string }>
  /** `${root}::${instance}` → lifecycle. */
  readonly lifecycles: Map<string, ArtifactInstanceLifecycle>
}

function makeIdentityPort(world: IdentityWorld): ArtifactIdentityPort {
  return {
    instanceForSession(sessionId: string) {
      return world.bindings.get(sessionId)
    },
    lifecycleOf(rootSessionId: string, instanceId: string) {
      return world.lifecycles.get(`${rootSessionId}::${instanceId}`)
    },
  }
}

// --- the ledger port (recording + fault injection) -------------------------------

interface LedgerWorld {
  readonly appended: Array<{ rootSessionId: string; payload: Record<string, unknown> }>
  putFault: boolean
}

function makeLedgerPort(world: LedgerWorld): ArtifactLedgerPort {
  return {
    async appendGranted(rootSessionId, payload) {
      if (world.putFault) throw new Error('fake ledger: the durable put was rejected')
      world.appended.push({ rootSessionId, payload })
    },
    async listGranted(): Promise<ArtifactLedgerEntry[]> {
      return []
    },
  }
}

// --- the minimal structural Cordis context (the Service base's surface) ----------

interface RecordedEffect {
  readonly factory: () => Generator<unknown, unknown, unknown>
  readonly label: string | undefined
}

interface FakeCtxWorld {
  readonly provided: Map<string, unknown>
  readonly effects: RecordedEffect[]
  bridge: TeamArtifactAuthorityBridge | undefined
}

function makeFakeCtx(world: FakeCtxWorld) {
  return {
    reflect: {
      provide: (name: string, value: unknown): void => {
        world.provided.set(name, value)
      },
      get: (name: string): unknown => (name === 'teamArtifactAuthority' ? world.bridge : undefined),
    },
    effect: (factory: () => Generator<unknown, unknown, unknown>, label?: string): void => {
      // Recorded (not run): the unit tests that disable the sweep
      // (`cleanupPeriodDays: 0`) never need the body, and the C2
      // config-propagation test RUNS the recorded generator explicitly
      // (the documented LocalSpillStore test seam) to observe the
      // startup cleanup at the PROPAGATED period.
      world.effects.push({ factory, label })
    },
    logger: { warn: (): void => {} },
  }
}

// --- the store world factory -------------------------------------------------------

interface StoreWorld {
  readonly fs: FsWorld
  readonly identity: IdentityWorld
  readonly ledger: LedgerWorld
  readonly ctx: FakeCtxWorld
  readonly authority: TeamArtifactAuthority
  readonly root: string
}

const tmpRoots: string[] = []

function makeStoreWorld(options?: {
  readonly putFault?: boolean
  readonly bridge?: boolean
}): StoreWorld {
  const root = mkdtempSync(join(tmpdir(), 'team-spill-store-'))
  tmpRoots.push(root)
  const fs: FsWorld = makeFsWorld()
  const identity: IdentityWorld = { bindings: new Map(), lifecycles: new Map() }
  const ledger: LedgerWorld = { appended: [], putFault: options?.putFault ?? false }
  const ctx: FakeCtxWorld = {
    provided: new Map(),
    effects: [],
    bridge: options?.bridge === false ? undefined : { authority: undefined },
  }
  const authority = new TeamArtifactAuthority({
    fs: makeFsPort(fs),
    identity: makeIdentityPort(identity),
    ledger: makeLedgerPort(ledger),
  })
  if (options?.bridge !== false) {
    ctx.bridge = { authority }
  }
  const store = new TeamAwareLocalSpillStore(makeFakeCtx(ctx) as never, {
    root,
    cleanupPeriodDays: 0,
  })
  return { fs, identity, ledger, ctx, authority, root: store.root }
}

function bindMember(
  world: StoreWorld,
  sessionId: string,
  lifecycle: ArtifactInstanceLifecycle = 'RUNNING',
): void {
  world.identity.bindings.set(sessionId, { rootSessionId: ROOT, instanceId: MEMBER })
  world.identity.lifecycles.set(`${ROOT}::${MEMBER}`, lifecycle)
}

function saveInput(
  sessionId: string,
  source?:
    | { kind: 'tool'; toolName: string; callId: string; label: string }
    | { kind: 'session-reference'; sessionId: string; label: string },
): SaveTextSpill {
  const theSource =
    source ?? { kind: 'tool' as const, toolName: 'bash', callId: 'call-1', label: 'bash' }
  return {
    owner: { sessionId: sessionId as never },
    source: theSource as never,
    suggestedName: 'tool-bash.log',
    content: 'x'.repeat(4096),
  }
}

function storeOf(world: StoreWorld): TeamAwareLocalSpillStore {
  return world.ctx.provided.get('spillStore') as TeamAwareLocalSpillStore
}

afterEach(() => {
  while (tmpRoots.length > 0) {
    const dir = tmpRoots.pop()
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true })
  }
})

// --- the cases ----------------------------------------------------------------------

describe('TeamAwareLocalSpillStore (strict-read core-spill C)', () => {
  it('S5: registers the SAME `spillStore` service (the inherited Service base)', () => {
    const world = makeStoreWorld()
    expect(world.ctx.provided.size).toBe(1)
    // the registered instance IS the store (the consumers' ctx.spillStore)
    expect(storeOf(world)).toBeInstanceOf(TeamAwareLocalSpillStore)
    // the default export is the same class (the Cordis loader unwraps it)
    expect(SpillStoreDefault).toBe(TeamAwareLocalSpillStore)
  })

  it('S1: managed member session — file stored + durable grant + end-to-end read valid', async () => {
    const world = makeStoreWorld()
    bindMember(world, 'session-1')

    const spillRef = await storeOf(world).saveText(saveInput('session-1'))

    // the upstream storage path ran (the file is durable under the root)
    expect(readFileSync(String(spillRef.locator)).length).toBe(spillRef.bytes)
    expect(String(spillRef.locator).startsWith(world.root)).toBe(true)
    // exactly one durable put, the closed payload, under the producing root
    expect(world.ledger.appended.length).toBe(1)
    const put = world.ledger.appended[0]!
    expect(put.rootSessionId).toBe(ROOT)
    expect(Object.keys(put.payload).sort()).toEqual([
      'instanceId',
      'locator',
      'schemaVersion',
      'source',
      'targetKeyDigest',
      'versionDigest',
    ])
    expect(put.payload.instanceId).toBe(MEMBER)
    expect(put.payload.locator).toBe(spillRef.locator)
    expect(put.payload.source).toEqual({
      kind: 'spill-store',
      spillSource: { kind: 'tool', toolName: 'bash', callId: 'call-1', label: 'bash' },
    })
    expect(put.payload.targetKeyDigest).toBe(targetKeyDigest(`tk:${spillRef.locator}`))
    expect(put.payload.versionDigest).toBe(versionDigest('v1'))
    // the END-TO-END vertical: the reading side (the Phase B lane's
    // authority call) finds the grant valid on the exact locator + the
    // freshly resolved target
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT,
      instanceId: MEMBER,
      locator: spillRef.locator,
      target: { targetKey: `tk:${spillRef.locator}`, displayPath: spillRef.locator },
    })
    expect(verdict).toEqual({ valid: true })
  })

  it('S2: unmanaged session — upstream-equivalent, ZERO grant I/O', async () => {
    const world = makeStoreWorld()
    // no binding for 'session-2' (an ordinary session)
    const ref = await storeOf(world).saveText(saveInput('session-2'))
    expect(readFileSync(String(ref.locator)).length).toBe(ref.bytes)
    expect(world.ledger.appended.length).toBe(0)
    expect(world.fs.resolveCalls.length).toBe(0) // the authority never resolved
    expect(world.fs.statCalls.length).toBe(0)
    expect(world.authority.registry.size).toBe(0)
  })

  it('S3: managed session + put fault — saveText REJECTS, no runtime grant installed', async () => {
    const world = makeStoreWorld({ putFault: true })
    bindMember(world, 'session-3')
    let error: unknown
    try {
      await storeOf(world).saveText(saveInput('session-3'))
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ArtifactRecordError)
    expect((error as ArtifactRecordError).code).toBe('ARTIFACT_RECORD_FAILED')
    // the artifact is never presented as grant-backed without its fact
    expect(world.ledger.appended.length).toBe(0)
    expect(world.authority.registry.size).toBe(0)
    // the read side stays on the unchanged pipeline (no candidate)
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT,
      instanceId: MEMBER,
      locator: '/whatever',
      target: { targetKey: 'tk:anywhere', displayPath: '/whatever' },
    })
    expect(verdict).toEqual({ valid: false, reason: 'no-candidate' })
  })

  it('S4: bridge without an authority (bootstrap not settled) — upstream-equivalent', async () => {
    const world = makeStoreWorld({ bridge: false })
    bindMember(world, 'session-4') // the session WOULD be managed, but the authority is unavailable
    const ref = await storeOf(world).saveText(saveInput('session-4'))
    expect(readFileSync(String(ref.locator)).length).toBe(ref.bytes)
    expect(world.ledger.appended.length).toBe(0)
    expect(world.fs.resolveCalls.length).toBe(0)
  })

  it('S6: the session-reference source arm maps verbatim onto the durable payload', async () => {
    const world = makeStoreWorld()
    bindMember(world, 'session-5')
    const ref = await storeOf(world).saveText(
      saveInput('session-5', { kind: 'session-reference', sessionId: 'session-42', label: 'ref' }),
    )
    expect(world.ledger.appended.length).toBe(1)
    expect(world.ledger.appended[0]!.payload.source).toEqual({
      kind: 'spill-store',
      spillSource: { kind: 'session-reference', sessionId: 'session-42', label: 'ref' },
    })
    void ref
  })

  it('S7: a storage failure rejects BEFORE any grant I/O', async () => {
    // A `root` that is a FILE (not a directory) makes the upstream
    // session-directory creation fail (ENOTDIR) — the storage path
    // rejects before the record path is reached.
    const base = mkdtempSync(join(tmpdir(), 'team-spill-store-block-'))
    tmpRoots.push(base)
    const blockFile = join(base, 'block')
    writeFileSync(blockFile, 'block')
    const fs = makeFsWorld()
    const identity: IdentityWorld = { bindings: new Map(), lifecycles: new Map() }
    identity.bindings.set('session-6', { rootSessionId: ROOT, instanceId: MEMBER })
    identity.lifecycles.set(`${ROOT}::${MEMBER}`, 'RUNNING')
    const ledger: LedgerWorld = { appended: [], putFault: false }
    const ctx: FakeCtxWorld = { provided: new Map(), effects: [], bridge: { authority: undefined } }
    const authority = new TeamArtifactAuthority({
      fs: makeFsPort(fs),
      identity: makeIdentityPort(identity),
      ledger: makeLedgerPort(ledger),
    })
    ctx.bridge = { authority }
    const store = new TeamAwareLocalSpillStore(makeFakeCtx(ctx) as never, {
      root: blockFile, // a file — the session dir cannot be created under it
      cleanupPeriodDays: 0,
    })
    let error: unknown
    try {
      await store.saveText(saveInput('session-6'))
    } catch (e) {
      error = e
    }
    expect(error).toBeDefined() // the upstream storage failure propagates
    expect(ledger.appended.length).toBe(0) // no grant I/O after a storage failure
    expect(fs.resolveCalls.length).toBe(0)
    expect(authority.registry.size).toBe(0)
  })

  it('S8: an ineligible (DISPOSED) managed instance — saveText REJECTS at issuance', async () => {
    const world = makeStoreWorld()
    bindMember(world, 'session-7', 'DISPOSED')
    let error: unknown
    try {
      await storeOf(world).saveText(saveInput('session-7'))
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(ArtifactRecordError)
    expect(world.ledger.appended.length).toBe(0)
    expect(world.authority.registry.size).toBe(0)
  })

  // --- the config-migration regression tests (PR #26 supplemental §3.1-B) ------

  it('C1: a custom config.root is honored by the inherited LocalSpillStore (the old spill-local config survives the provider replacement)', async () => {
    // A profile that already carries `root` (and friends) on its
    // `spill-local` row carries the SAME config onto the `team-spill-local`
    // row — the regression risk is that the subclass/loader drops it and
    // falls back to the private default. The assertion is on the INHERITED
    // LocalSpillStore surface: the resolved root is the custom path (not a
    // fresh `dsh-spill-*` mkdtemp) and saveText lands under it.
    const base = mkdtempSync(join(tmpdir(), 'team-spill-root-'))
    tmpRoots.push(base)
    const customRoot = join(base, 'custom', 'spill-root') // nested: created on demand by the storage path
    const ctx: FakeCtxWorld = { provided: new Map(), effects: [], bridge: undefined } // unmanaged: storage path only
    const store = new TeamAwareLocalSpillStore(makeFakeCtx(ctx) as never, {
      root: customRoot,
      cleanupPeriodDays: 0,
    })
    expect(store.root).toBe(resolve(customRoot))
    expect(basename(store.root)).not.toMatch(/^dsh-spill-/) // not the private default shape
    const ref = await store.saveText(saveInput('session-c1'))
    expect(ref.locator.startsWith(store.root)).toBe(true)
    expect(existsSync(ref.locator)).toBe(true)
  })

  it('C2: a non-default cleanupPeriodDays propagates into the inherited LocalSpillStore (config carried + the startup sweep runs at the propagated period)', async () => {
    // Same migration surface: `cleanupPeriodDays` set on the row must
    // survive into the inherited LocalSpillStore — (a) the resolved config
    // carries the custom value (not the 30-day default, not the 0-disable)
    // and (b) the INHERITED startup sweep actually expires at THAT period.
    // The sweep is exercised through the documented LocalSpillStore test
    // seam: a subclass overrides `gatherRoots` to the isolated root set
    // (no real tmpdir scan, no foreign I/O) and the recorded startup
    // effect is run explicitly (its generator body is the inherited
    // cleanup registration).
    const root = mkdtempSync(join(tmpdir(), 'team-spill-cleanup-'))
    tmpRoots.push(root)
    const expiredDir = join(root, 'session-aaaabbbbcccc')
    const freshDir = join(root, 'session-111122223333')
    mkdirSync(expiredDir, { recursive: true })
    mkdirSync(freshDir)
    const expiredFile = join(expiredDir, 'old.txt')
    const freshFile = join(freshDir, 'fresh.txt')
    writeFileSync(expiredFile, 'old')
    writeFileSync(freshFile, 'fresh')
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000)
    utimesSync(expiredFile, twoDaysAgo, twoDaysAgo) // strictly older than the 1-day cutoff

    class IsolatedSpillStore extends TeamAwareLocalSpillStore {
      // The documented LocalSpillStore test seam: an isolated root set for
      // the sweep (the production `gatherRoots` would scan the OS tmpdir
      // for prior-default roots — foreign to this unit test).
      override async gatherRoots(
        warn: (message: string) => void,
      ): Promise<Array<{ path: string; pruneWhenEmpty: boolean }>> {
        void warn
        return [{ path: this.root, pruneWhenEmpty: false }]
      }
    }

    const ctx: FakeCtxWorld = { provided: new Map(), effects: [], bridge: undefined } // unmanaged: storage path only
    const store = new IsolatedSpillStore(makeFakeCtx(ctx) as never, {
      root,
      cleanupPeriodDays: 1, // a non-default, non-zero period
    })

    // (a) the inherited LocalSpillStore carries the RESOLVED custom period
    // (the config survived the subclass constructor pass-through) and the
    // custom root.
    expect(store.config.cleanupPeriodDays).toBe(1)
    expect(store.root).toBe(resolve(root))

    // (b) the inherited constructor registered the startup sweep effect…
    const sweepEffect = ctx.effects.find((e) => e.label === 'spill-local cleanup sweep')
    expect(sweepEffect).toBeDefined()
    if (sweepEffect === undefined) throw new Error('sweep effect missing (the expect above is the assertion)')
    // …and, run at the PROPAGATED period (cutoff = now − 1 day), it expires
    // the 2-day-old file and prunes its emptied session dir, while the
    // fresh session survives.
    const gen = sweepEffect.factory()
    const rawDisposer = gen.next().value
    if (rawDisposer === undefined) throw new Error('sweep effect yielded no disposer')
    // The upstream sweep generator yields its async disposer as the first
    // value (LocalSpillStore 'spill-local cleanup sweep' contract).
    const disposer = rawDisposer as () => Promise<void>
    await disposer()
    expect(existsSync(expiredFile)).toBe(false)
    expect(existsSync(expiredDir)).toBe(false)
    expect(existsSync(freshFile)).toBe(true)
    expect(existsSync(freshDir)).toBe(true)
  })
})
