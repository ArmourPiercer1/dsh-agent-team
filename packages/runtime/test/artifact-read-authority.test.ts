/**
 * artifact-read-authority.test.ts — Strict-read + Core-spill Phase A:
 * the TeamArtifactAuthority decision core over INJECTED fakes
 * (implementation guide §2.5 — no plugin globals):
 *
 * issuance (D5/A5):
 *  - managed member session: fresh resolve+stat → digests → DURABLE put
 *    BEFORE the runtime install (order pinned by a recording port) →
 *    registry holds the grant;
 *  - non-managed session: no-op, zero port effects, no throw
 *    (upstream-equivalent);
 *  - ineligible lifecycle at issue (ARCHIVED/DISPOSED): throws
 *    ArtifactRecordError;
 *  - artifact absent / not a regular file at issue: throws (ADR §5
 *    fail-closed — the wrapper rejects saveText);
 *  - the durable put is the LAST write before the install (a put
 *    failure leaves NO runtime candidate).
 *
 * use (architecture §12):
 *  - valid grant (same locator + same identity + same file) → valid;
 *  - cross-instance (another root, or another instance of the same
 *    root) → no-candidate (never authorized);
 *  - different locator (alias path to the same file) → locator-mismatch;
 *  - replaced file (new version token) → version-mismatch;
 *  - replaced file with different targetKey → no-candidate;
 *  - deleted artifact → artifact-missing;
 *  - directory at the locator → not-regular-file;
 *  - ARCHIVED / DISPOSED lifecycle at use → instance-ineligible (the
 *    candidate stays installed — D6 dormancy, no deletion);
 *  - fs stat fault at use → fail closed (no grant).
 *
 * recovery (implementation guide §3):
 *  - rebuildFromLedger replays the durable facts (clear + install),
 *    skips corrupt/foreign rows, and keeps stale (deleted-artifact)
 *    facts as INERT candidates (they fail the fresh stat at use).
 *
 * registry:
 *  - composite-identity keying (invariant 18): the same instanceId
 *    under two roots are separate namespaces; locator re-install
 *    replaces; clear drops everything.
 *
 * @module @dsh-agent-team/runtime/test/artifact-read-authority
 */
import { describe, expect, it } from 'vitest'
import {
  ArtifactGrantRegistry,
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
  ArtifactReadGrant,
} from '../artifact-read/index.js'
import {
  memberIdentityKey,
  type InstanceId,
  type RootSessionId,
} from '../../contracts/src/index.js'

/**
 * The test's identity constants are plain strings; `memberIdentityKey`
 * consumes the branded domain ids. This is the test-side mirror of the
 * authority's single branding boundary (type-only — the brand is a
 * nominal marker over the same string).
 */
function mkKey(rootSessionId: string, instanceId: string): string {
  return memberIdentityKey({
    rootSessionId: rootSessionId as RootSessionId,
    instanceId: instanceId as InstanceId,
  })
}

// --- fakes ------------------------------------------------------------------------

interface FsWorld {
  /** path (locator string) → file state. Absent key = absent file. */
  readonly files: Map<string, { targetKey: string; version: string; type: 'file' | 'directory' | 'other' }>
  /** Set the targetKey the resolve of this locator returns (replacement by retarget). */
  resolveFault: boolean
  statFault: boolean
}

function makeFsWorld(): FsWorld {
  return { files: new Map<string, { targetKey: string; version: string; type: 'file' | 'directory' | 'other' }>(), resolveFault: false, statFault: false }
}

function fsPort(world: FsWorld): ArtifactFsPort {
  return {
    async resolve(path: string): Promise<ArtifactFsTarget> {
      if (world.resolveFault) throw new Error('fs resolve fault')
      const file = world.files.get(path)
      if (file === undefined) throw new Error(`FS_NOT_FOUND: ${path}`)
      return { targetKey: file.targetKey, displayPath: path }
    },
    async stat(target: ArtifactFsTarget): Promise<ArtifactFsInfo | undefined> {
      if (world.statFault) throw new Error('fs stat fault')
      for (const [path, file] of world.files) {
        if (file.targetKey === target.targetKey) {
          return { version: file.version, type: file.type, size: 100 }
        }
      }
      return undefined
    },
  }
}

interface IdentityWorld {
  /** DSH session id → { rootSessionId, instanceId } | undefined (unmanaged). */
  readonly bindings: Map<string, { rootSessionId: string; instanceId: string } | undefined>
  /** (rootSessionId + instanceId) → lifecycle. */
  readonly lifecycles: Map<string, ArtifactInstanceLifecycle | undefined>
}

function makeIdentityWorld(): IdentityWorld {
  return {
    bindings: new Map<string, { rootSessionId: string; instanceId: string } | undefined>(),
    lifecycles: new Map<string, ArtifactInstanceLifecycle | undefined>(),
  }
}

const lifecycleKey = (rootSessionId: string, instanceId: string) => `${rootSessionId}::${instanceId}`

function identityPort(world: IdentityWorld): ArtifactIdentityPort {
  return {
    instanceForSession(sessionId: string) {
      return world.bindings.get(sessionId)
    },
    lifecycleOf(rootSessionId: string, instanceId: string) {
      return world.lifecycles.get(lifecycleKey(rootSessionId, instanceId))
    },
  }
}

interface LedgerWorld {
  readonly entries: ArtifactLedgerEntry[]
  readonly appended: Array<{ rootSessionId: string; payload: Record<string, unknown> }>
  putFault: boolean
}

function makeLedgerWorld(): LedgerWorld {
  return { entries: [], appended: [], putFault: false }
}

function makeLedgerPort(world: LedgerWorld): ArtifactLedgerPort {
  return {
    async appendGranted(rootSessionId: string, payload: Record<string, unknown>) {
      if (world.putFault) throw new Error('ledger put fault')
      world.appended.push({ rootSessionId, payload })
      world.entries.push({
        schemaVersion: 2,
        sequence: world.entries.length + 1,
        rootSessionId,
        factType: 'artifact-read-granted',
        payload,
        createdAt: '2026-09-20T00:00:00.000Z',
      })
    },
    async listGranted() {
      return [...world.entries]
    },
  }
}

// --- fixture world -------------------------------------------------------------------

interface World {
  fs: FsWorld
  identity: IdentityWorld
  ledger: LedgerWorld
  authority: TeamArtifactAuthority
  /** The ledger PORT over the world (for observing wrappers). */
  ledgerPort: ArtifactLedgerPort
}

function makeWorld(): World {
  const fs = makeFsWorld()
  const identity = makeIdentityWorld()
  const ledger = makeLedgerWorld()
  const ledgerPort = makeLedgerPort(ledger)
  const authority = new TeamArtifactAuthority({ fs: fsPort(fs), identity: identityPort(identity), ledger: ledgerPort })
  return { fs, identity, ledger, authority, ledgerPort }
}

/** Seed a file into the fs world (the just-saved spill artifact). */
function seedFile(world: World, locator: string, targetKey?: string, version = 'v1', type: 'file' | 'directory' | 'other' = 'file'): void {
  world.fs.files.set(locator, { targetKey: targetKey ?? `tk:${locator}`, version, type })
}

const ROOT_A = 'team-root-A'
const ROOT_B = 'team-root-B'
const MEMBER = 'inst-worker-1'
const LEADER = 'inst-leader'

/** Bind a session to a managed identity (leader or member) with a given lifecycle. */
function bindSession(world: World, sessionId: string, rootSessionId: string, instanceId: string, lifecycle: ArtifactInstanceLifecycle): void {
  world.identity.bindings.set(sessionId, { rootSessionId, instanceId })
  world.identity.lifecycles.set(lifecycleKey(rootSessionId, instanceId), lifecycle)
}

// --- registry --------------------------------------------------------------------------

describe('ArtifactGrantRegistry', () => {
  const grant = (locator: string, rootSessionId = ROOT_A, instanceId = MEMBER): ArtifactReadGrant => ({
    rootSessionId,
    instanceId,
    locator,
    targetKeyDigest: targetKeyDigest('tk:1'),
    versionDigest: versionDigest('v1'),
    source: { kind: 'spill-store', spillSource: { kind: 'tool', toolName: 'bash', callId: 'c', label: 'l' } },
  })

  it('keys by the COMPOSITE identity (invariant 18): the same instanceId under two roots is separate', () => {
    const registry = new ArtifactGrantRegistry()
    const keyA = mkKey(ROOT_A, MEMBER)
    const keyB = mkKey(ROOT_B, MEMBER)
    expect(keyA).not.toBe(keyB)
    registry.install(keyA, grant('/a/x'))
    expect(registry.findCandidates(keyA, targetKeyDigest('tk:1')).length).toBe(1)
    expect(registry.findCandidates(keyB, targetKeyDigest('tk:1')).length).toBe(0)
    expect(registry.hasAny(keyB)).toBe(false)
  })

  it('findCandidates narrows by fresh target digest; the locator is NOT a filter here', () => {
    const registry = new ArtifactGrantRegistry()
    const key = mkKey(ROOT_A, MEMBER)
    registry.install(key, grant('/a/x'))
    expect(registry.findCandidates(key, targetKeyDigest('tk:1')).length).toBe(1)
    expect(registry.findCandidates(key, targetKeyDigest('tk:other')).length).toBe(0)
    expect(registry.listForIdentity(key).length).toBe(1)
  })

  it('re-installing the same identity + locator replaces the candidate', () => {
    const registry = new ArtifactGrantRegistry()
    const key = mkKey(ROOT_A, MEMBER)
    registry.install(key, grant('/a/x'))
    const replacement = { ...grant('/a/x'), versionDigest: versionDigest('v2') }
    registry.install(key, replacement)
    expect(registry.size).toBe(1)
    expect(registry.listForIdentity(key)[0]!.versionDigest).toBe(versionDigest('v2'))
  })

  it('clear drops everything', () => {
    const registry = new ArtifactGrantRegistry()
    registry.install(mkKey(ROOT_A, MEMBER), grant('/a/x'))
    registry.clear()
    expect(registry.size).toBe(0)
  })
})

// --- issuance ----------------------------------------------------------------------------

describe('authority: issuance (D5/A5)', () => {
  it('managed member session: durable put BEFORE runtime install, grant registered', async () => {
    const world = makeWorld()
    const locator = '/spill/tool-1.log'
    seedFile(world, locator)
    bindSession(world, 'session-1', ROOT_A, MEMBER, 'RUNNING')

    const outcome = await world.authority.recordSpillStoreArtifact({
      sessionId: 'session-1',
      source: { kind: 'tool', toolName: 'bash', callId: 'call-1', label: 'bash' },
      locator,
    })
    expect(outcome.recorded).toBe(true)
    if (outcome.recorded) {
      expect(outcome.grant.rootSessionId).toBe(ROOT_A)
      expect(outcome.grant.instanceId).toBe(MEMBER)
      expect(outcome.grant.locator).toBe(locator)
      expect(outcome.grant.targetKeyDigest).toBe(targetKeyDigest(`tk:${locator}`))
      expect(outcome.grant.versionDigest).toBe(versionDigest('v1'))
    }
    // exactly one durable put, carrying the closed payload, under the producing root
    expect(world.ledger.appended.length).toBe(1)
    expect(world.ledger.appended[0]!.rootSessionId).toBe(ROOT_A)
    expect(Object.keys(world.ledger.appended[0]!.payload).sort()).toEqual([
      'instanceId',
      'locator',
      'schemaVersion',
      'source',
      'targetKeyDigest',
      'versionDigest',
    ])
    // the runtime projection holds the grant (installed AFTER the put — same order)
    const key = mkKey(ROOT_A, MEMBER)
    expect(world.authority.registry.findCandidates(key, targetKeyDigest(`tk:${locator}`)).length).toBe(1)
  })

  it('durable-first order pinned: the put completes before the registry install is observable', async () => {
    const world = makeWorld()
    seedFile(world, '/spill/tool-2.log')
    bindSession(world, 'session-2', ROOT_A, MEMBER, 'RUNNING')
    // instrument the port: record the registry size at the moment the put runs
    let sizeAtPut = -1
    let observingAuthority: TeamArtifactAuthority
    const observing = {
      async appendGranted(rootSessionId: string, payload: Record<string, unknown>) {
        sizeAtPut = observingAuthority.registry.size
        await world.ledgerPort.appendGranted(rootSessionId, payload)
      },
      listGranted: world.ledgerPort.listGranted,
    }
    observingAuthority = new TeamArtifactAuthority({
      fs: fsPort(world.fs),
      identity: identityPort(world.identity),
      ledger: observing,
    })
    await observingAuthority.recordSpillStoreArtifact({
      sessionId: 'session-2',
      source: { kind: 'tool', toolName: 'bash', callId: 'call-2', label: 'bash' },
      locator: '/spill/tool-2.log',
    })
    expect(sizeAtPut).toBe(0) // nothing installed at put time
    expect(observingAuthority.registry.size).toBe(1)
  })

  it('non-managed session: no-op, zero side effects, no throw (upstream-equivalent)', async () => {
    const world = makeWorld()
    seedFile(world, '/spill/tool-3.log')
    // NO binding for session-3
    const outcome = await world.authority.recordSpillStoreArtifact({
      sessionId: 'session-3',
      source: { kind: 'session-reference', sessionId: 'session-x', label: 'ref' },
      locator: '/spill/tool-3.log',
    })
    expect(outcome).toEqual({ recorded: false, reason: 'unmanaged-session' })
    expect(world.ledger.appended.length).toBe(0)
    expect(world.authority.registry.size).toBe(0)
  })

  it('ineligible lifecycle at issue (ARCHIVED/DISPOSED): throws ArtifactRecordError, nothing durable', async () => {
    for (const lifecycle of ['ARCHIVED', 'DISPOSED'] as const) {
      const world = makeWorld()
      seedFile(world, '/spill/tool-4.log')
      bindSession(world, 'session-4', ROOT_A, MEMBER, lifecycle)
      await expect(
        world.authority.recordSpillStoreArtifact({
          sessionId: 'session-4',
          source: { kind: 'tool', toolName: 'bash', callId: 'call-4', label: 'bash' },
          locator: '/spill/tool-4.log',
        }),
      ).rejects.toBeInstanceOf(ArtifactRecordError)
      expect(world.ledger.appended.length).toBe(0)
      expect(world.authority.registry.size).toBe(0)
    }
  })

  it('artifact absent at issue: throws (ADR §5 fail-closed)', async () => {
    const world = makeWorld()
    bindSession(world, 'session-5', ROOT_A, MEMBER, 'RUNNING')
    // no file seeded — resolve fails
    await expect(
      world.authority.recordSpillStoreArtifact({
        sessionId: 'session-5',
        source: { kind: 'tool', toolName: 'bash', callId: 'call-5', label: 'bash' },
        locator: '/spill/absent.log',
      }),
    ).rejects.toBeInstanceOf(ArtifactRecordError)
    expect(world.ledger.appended.length).toBe(0)
  })

  it('non-regular file at issue: throws', async () => {
    const world = makeWorld()
    seedFile(world, '/spill/dir.log', 'tk:dir', 'v1', 'directory')
    bindSession(world, 'session-6', ROOT_A, MEMBER, 'RUNNING')
    await expect(
      world.authority.recordSpillStoreArtifact({
        sessionId: 'session-6',
        source: { kind: 'tool', toolName: 'bash', callId: 'call-6', label: 'bash' },
        locator: '/spill/dir.log',
      }),
    ).rejects.toBeInstanceOf(ArtifactRecordError)
  })

  it('put failure leaves NO runtime candidate (durable-first)', async () => {
    const world = makeWorld()
    seedFile(world, '/spill/tool-7.log')
    bindSession(world, 'session-7', ROOT_A, MEMBER, 'RUNNING')
    world.ledger.putFault = true
    await expect(
      world.authority.recordSpillStoreArtifact({
        sessionId: 'session-7',
        source: { kind: 'tool', toolName: 'bash', callId: 'call-7', label: 'bash' },
        locator: '/spill/tool-7.log',
      }),
    ).rejects.toBeInstanceOf(ArtifactRecordError)
    expect(world.ledger.appended.length).toBe(0)
    expect(world.authority.registry.size).toBe(0)
  })

  it('shell artifact: records under the composite identity from the setup context', async () => {
    const world = makeWorld()
    const locator = '/spill/shell-1.log'
    seedFile(world, locator)
    bindSession(world, 'session-8', ROOT_A, LEADER, 'leader')
    const outcome = await world.authority.recordShellArtifact({
      rootSessionId: ROOT_A,
      instanceId: LEADER,
      source: { kind: 'shell-foreground', toolName: 'bash', callId: 'call-8', stream: 'stdout' },
      locator,
    })
    expect(outcome.recorded).toBe(true)
    if (outcome.recorded) {
      expect(outcome.grant.rootSessionId).toBe(ROOT_A)
      expect(outcome.grant.instanceId).toBe(LEADER)
      expect(outcome.grant.source).toEqual({ kind: 'shell-foreground', toolName: 'bash', callId: 'call-8', stream: 'stdout' })
    }
  })

  it('shell artifact for an ineligible instance: throws', async () => {
    const world = makeWorld()
    seedFile(world, '/spill/shell-2.log')
    world.identity.lifecycles.set(lifecycleKey(ROOT_A, MEMBER), 'DISPOSED')
    await expect(
      world.authority.recordShellArtifact({
        rootSessionId: ROOT_A,
        instanceId: MEMBER,
        source: { kind: 'shell-foreground', toolName: 'pwsh', callId: 'call-9', stream: 'stderr' },
        locator: '/spill/shell-2.log',
      }),
    ).rejects.toBeInstanceOf(ArtifactRecordError)
  })
})

// --- use (architecture §12) ---------------------------------------------------------------

describe('authority: use (architecture §12)', () => {
  async function seededGrant(world: World, locator = '/spill/use.log', instanceId = MEMBER, lifecycle: ArtifactInstanceLifecycle = 'RUNNING', rootSessionId = ROOT_A) {
    seedFile(world, locator)
    bindSession(world, 'session-use', rootSessionId, instanceId, lifecycle)
    await world.authority.recordSpillStoreArtifact({
      sessionId: 'session-use',
      source: { kind: 'tool', toolName: 'bash', callId: 'call-u', label: 'bash' },
      locator,
    })
    return locator
  }

  const target = (locator: string): ArtifactFsTarget => ({ targetKey: `tk:${locator}`, displayPath: locator })

  it('valid grant: same locator + same identity + same file → valid', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: target(locator),
    })
    expect(verdict).toEqual({ valid: true })
  })

  it('cross-instance denial: another instance of the same root → no-candidate', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    // a different member of the same root reads it
    world.identity.lifecycles.set(lifecycleKey(ROOT_A, 'inst-worker-2'), 'RUNNING')
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: 'inst-worker-2',
      locator,
      target: target(locator),
    })
    expect(verdict).toEqual({ valid: false, reason: 'no-candidate' })
  })

  it('cross-root denial: the same instanceId under another root → no-candidate (invariant 18)', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    world.identity.lifecycles.set(lifecycleKey(ROOT_B, MEMBER), 'RUNNING')
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_B,
      instanceId: MEMBER,
      locator,
      target: target(locator),
    })
    expect(verdict).toEqual({ valid: false, reason: 'no-candidate' })
  })

  it('alias locator (different string, same file) → locator-mismatch', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    // the alias resolves to the SAME targetKey but the model requested a different string
    world.fs.files.set('/spill/alias.log', { targetKey: `tk:${locator}`, version: 'v1', type: 'file' })
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator: '/spill/alias.log',
      target: { targetKey: `tk:${locator}`, displayPath: '/spill/alias.log' },
    })
    expect(verdict).toEqual({ valid: false, reason: 'locator-mismatch' })
  })

  it('replaced file (same targetKey, new version token) → version-mismatch', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    world.fs.files.set(locator, { targetKey: `tk:${locator}`, version: 'v2', type: 'file' })
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: target(locator),
    })
    expect(verdict).toEqual({ valid: false, reason: 'version-mismatch' })
  })

  it('retargeted file (different targetKey) → no-candidate', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    // the path now resolves to a DIFFERENT file identity (symlink swap)
    world.fs.files.set(locator, { targetKey: 'tk:intruder', version: 'v1', type: 'file' })
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: { targetKey: 'tk:intruder', displayPath: locator },
    })
    expect(verdict).toEqual({ valid: false, reason: 'no-candidate' })
  })

  it('deleted artifact → artifact-missing (the candidate stays installed)', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    world.fs.files.delete(locator)
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: target(locator),
    })
    expect(verdict).toEqual({ valid: false, reason: 'artifact-missing' })
    expect(world.authority.registry.size).toBe(1) // no deletion (D6: no revoke fact)
  })

  it('directory at the locator → not-regular-file', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    world.fs.files.set(locator, { targetKey: `tk:${locator}`, version: 'v1', type: 'directory' })
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: target(locator),
    })
    expect(verdict).toEqual({ valid: false, reason: 'not-regular-file' })
  })

  it('ARCHIVED / DISPOSED lifecycle at use → instance-ineligible (dormant/terminal)', async () => {
    for (const lifecycle of ['ARCHIVED', 'DISPOSED'] as const) {
      const world = makeWorld()
      const locator = await seededGrant(world)
      world.identity.lifecycles.set(lifecycleKey(ROOT_A, MEMBER), lifecycle)
      const verdict = await world.authority.authorizeRead({
        rootSessionId: ROOT_A,
        instanceId: MEMBER,
        locator,
        target: target(locator),
      })
      expect(verdict).toEqual({ valid: false, reason: 'instance-ineligible' })
    }
  })

  it('fs stat fault at use → fail closed (no grant)', async () => {
    const world = makeWorld()
    const locator = await seededGrant(world)
    world.fs.statFault = true
    const verdict = await world.authority.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: target(locator),
    })
    expect(verdict.valid).toBe(false)
  })
})

// --- recovery (implementation guide §3) ---------------------------------------------------

describe('authority: cold-restart rebuild', () => {
  it('rebuilds the registry from the durable facts (clear + replay)', async () => {
    const world = makeWorld()
    const locator = '/spill/rebuild.log'
    seedFile(world, locator)
    bindSession(world, 'session-r', ROOT_A, MEMBER, 'SETTLED')
    await world.authority.recordSpillStoreArtifact({
      sessionId: 'session-r',
      source: { kind: 'tool', toolName: 'bash', callId: 'call-r', label: 'bash' },
      locator,
    })
    // simulate the cold restart: a FRESH authority over the SAME durable world
    const fresh = new TeamArtifactAuthority({
      fs: fsPort(world.fs),
      identity: identityPort(world.identity),
      ledger: makeLedgerPort(world.ledger),
    })
    expect(fresh.registry.size).toBe(0)
    const counts = await fresh.rebuildFromLedger()
    expect(counts).toEqual({ rebuilt: 1, skipped: 0 })
    expect(fresh.registry.size).toBe(1)
    // the rebuilt grant authorizes a read of the still-identical file
    const verdict = await fresh.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: { targetKey: `tk:${locator}`, displayPath: locator },
    })
    expect(verdict).toEqual({ valid: true })
  })

  it('skips corrupt/foreign rows; keeps stale (deleted-artifact) facts as INERT candidates', async () => {
    const world = makeWorld()
    // one good fact for a file that is later deleted
    const locator = '/spill/stale.log'
    seedFile(world, locator)
    bindSession(world, 'session-s', ROOT_A, MEMBER, 'SETTLED')
    await world.authority.recordSpillStoreArtifact({
      sessionId: 'session-s',
      source: { kind: 'tool', toolName: 'bash', callId: 'call-s', label: 'bash' },
      locator,
    })
    // one corrupt fact (bad digest) + one foreign fact family
    world.ledger.entries.push({
      schemaVersion: 2,
      sequence: world.ledger.entries.length + 1,
      rootSessionId: ROOT_A,
      factType: 'artifact-read-granted',
      payload: { schemaVersion: 1, instanceId: MEMBER, locator: '/x', targetKeyDigest: 'bogus', versionDigest: targetKeyDigest('v'), source: { kind: 'shell-foreground', toolName: 'bash', callId: 'c', stream: 'stdout' } },
      createdAt: '2026-09-20T00:00:00.000Z',
    })
    world.ledger.entries.push({
      schemaVersion: 2,
      sequence: world.ledger.entries.length + 1,
      rootSessionId: ROOT_A,
      factType: 'activity-progress-recorded',
      payload: { op: 'progress' },
      createdAt: '2026-09-20T00:00:00.000Z',
    })
    // the artifact is gone (stale fact)
    world.fs.files.delete(locator)

    const fresh = new TeamArtifactAuthority({
      fs: fsPort(world.fs),
      identity: identityPort(world.identity),
      ledger: makeLedgerPort(world.ledger),
    })
    const counts = await fresh.rebuildFromLedger()
    expect(counts).toEqual({ rebuilt: 1, skipped: 2 })
    expect(fresh.registry.size).toBe(1) // the stale fact is installed but INERT
    const verdict = await fresh.authorizeRead({
      rootSessionId: ROOT_A,
      instanceId: MEMBER,
      locator,
      target: { targetKey: `tk:${locator}`, displayPath: locator },
    })
    expect(verdict).toEqual({ valid: false, reason: 'artifact-missing' })
  })

  it('rebuild clears a pre-existing runtime projection (exactly the durable state)', async () => {
    const world = makeWorld()
    // runtime-installed grant with NO durable fact (the forbidden state must not survive a rebuild)
    world.authority.registry.install(
      mkKey(ROOT_A, MEMBER),
      {
        rootSessionId: ROOT_A,
        instanceId: MEMBER,
        locator: '/ghost',
        targetKeyDigest: targetKeyDigest('tk:ghost'),
        versionDigest: versionDigest('v1'),
        source: { kind: 'shell-foreground', toolName: 'bash', callId: 'g', stream: 'stdout' },
      },
    )
    expect(world.authority.registry.size).toBe(1)
    const counts = await world.authority.rebuildFromLedger()
    expect(counts).toEqual({ rebuilt: 0, skipped: 0 })
    expect(world.authority.registry.size).toBe(0)
  })
})
