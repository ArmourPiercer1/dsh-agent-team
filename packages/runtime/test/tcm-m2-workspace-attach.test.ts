/**
 * tcm-m2-workspace-attach — M2 (plan §15.5 / §M2): the host-side
 * Workspace public seam.
 *
 * The production host hard-injects the upstream public
 * `workspaceRegistry` service (the web profile's workspace row is the
 * provider — CORE PATCH BUDGET = 0: the team repo never imports the
 * upstream workspace package) and builds ONE narrow closure over it —
 * the {@link WorkspaceAttachPort} the production root exposes:
 *
 *   resolvePath(path)      → { workspaceId, path (canonical) }
 *   attachSession(id, sid) → the materialized session is accounted
 *
 * Proven here (real production entry + real file storage seam for the
 * entry-driven scenarios; the port factory against a faithful plain-object
 * emulation of the upstream public contract for the seam-level
 * scenarios — the seam is tested against the projection, never against
 * the upstream implementation):
 *
 *   1. registered path resolution returns the registry's CANONICAL path
 *      verbatim (any input spelling);
 *   2. an unknown path rejects with TEAM_PLUGIN_WORKSPACE_NOT_FOUND —
 *      both the missing directory (the upstream realpath rejection,
 *      wrapped) and the existing-but-unowned directory — and the
 *      registry is NEVER mutated by a failed resolution (no silent
 *      create-or-adopt);
 *   3. the attach-after-materialization contract: a session materialized
 *      with the workspace's canonical cwd attaches; a session whose cwd
 *      mismatches (and an unmaterialized session) reject with
 *      TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED;
 *   4. idempotent retry: a second attach of an already-accounted session
 *      resolves without duplicating the account or re-writing (the
 *      upstream Workspace.attachSession contract, delegated verbatim);
 *   5. an attach naming a deleted workspace id rejects with
 *      TEAM_PLUGIN_WORKSPACE_NOT_FOUND;
 *   6. a MISSING `workspaceRegistry` service rejects the real entry's
 *      bootstrap with TEAM_PLUGIN_SERVICE_MISSING (before any durable
 *      effect; the facade is still provided — apply never rejects);
 *   7. a MALFORMED service (lacking resolveByPath) rejects the real
 *      entry's bootstrap with TEAM_PLUGIN_SERVICE_MISSING (the
 *      malformation named);
 *   8. the healthy world: the real entry boots, the facade's root
 *      exposes the closure, and resolve + attach work end-to-end through
 *      the root surface.
 *
 * Runner note: the plain-node shim forbids async `it()` bodies — the
 * scenarios run at module top level, the `it` bodies assert
 * synchronously (the same convention as rmr-remote-mount-race).
 * @module @dsh-agent-team/runtime/test/tcm-m2-workspace-attach
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import {
  isTeamPluginError,
  TEAM_PLUGIN_ERROR_CODES,
} from '../src/plugin/types.js'
import type { TeamPluginConfig } from '../src/plugin/types.js'
import {
  assertWorkspaceRegistryLike,
  createWorkspaceAttach,
} from '../src/plugin/workspace-attach.js'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the fake upstream registry (faithful plain-object emulation) --------------

/** One emulated workspace record (the account the attach mutates). */
interface FakeWorkspace {
  readonly id: string
  readonly path: string
  sessionIds: string[]
  /** Upstream durable writes performed by accepted attaches. */
  writes: number
  /** Every attachSession call (idempotent retries included). */
  attachCalls: string[]
}

/**
 * The faithful plain-object emulation of the upstream public
 * `workspaceRegistry` + `Workspace.attachSession` contract (the seam is
 * tested against the NARROW PROJECTION, never against the upstream
 * implementation — CORE PATCH BUDGET = 0 keeps the team repo from
 * importing the upstream package in-chain):
 *
 *   - `resolveByPath` canonicalizes (trailing-slash spelling here; the
 *     upstream realpath does strictly more), rejects for a missing
 *     directory, and returns `undefined` for an existing unowned one;
 *   - `attachSession` (upstream entity contract): an already-accounted
 *     id resolves WITHOUT writing; a new id's materialized header cwd
 *     must equal the workspace path, unknown ids and mismatches reject
 *     without writing;
 *   - `list()` — the durable-order projection (the id→entity lookup the
 *     seam owns).
 */
function makeFakeWorkspaceRegistry() {
  const existingDirs = new Set<string>()
  const workspaces = new Map<string, FakeWorkspace>()
  const sessionCwds = new Map<string, string>()

  /** The fake's canonicalization: trailing-slash spellings converge. */
  const canonicalize = (p: string): string => p.replace(/[\\/]+$/u, '')

  function addDir(path: string): void {
    existingDirs.add(canonicalize(path))
  }

  function register(path: string, id: string): FakeWorkspace {
    const canonical = canonicalize(path)
    existingDirs.add(canonical)
    const ws: FakeWorkspace = {
      id,
      path: canonical,
      sessionIds: [],
      writes: 0,
      attachCalls: [],
    }
    workspaces.set(canonical, ws)
    return ws
  }

  /** Materialize one session (its stored header carries `cwd`). */
  function materialize(sessionId: string, cwd: string): void {
    const canonical = canonicalize(cwd)
    existingDirs.add(canonical)
    sessionCwds.set(sessionId, canonical)
  }

  function remove(id: string): void {
    for (const [path, ws] of workspaces) {
      if (ws.id === id) {
        workspaces.delete(path)
        return
      }
    }
  }

  function entity(id: string): FakeWorkspace | undefined {
    for (const ws of workspaces.values()) {
      if (ws.id === id) return ws
    }
    return undefined
  }

  async function attachTo(ws: FakeWorkspace, sessionId: string): Promise<void> {
    ws.attachCalls.push(sessionId)
    // Upstream: the settled snapshot already accounts the id → the cwd
    // fact was checked when it first attached; no re-validation, no write.
    if (ws.sessionIds.includes(sessionId)) return
    const cwd = sessionCwds.get(sessionId)
    if (cwd === undefined) {
      throw new Error(
        `cannot validate session '${sessionId}': session persistence holds no such session`,
      )
    }
    if (cwd !== ws.path) {
      throw new Error(
        `cannot attach session '${sessionId}' to workspace '${ws.path}': its cwd resolves to '${cwd}'`,
      )
    }
    ws.sessionIds = [sessionId, ...ws.sessionIds]
    ws.writes += 1
  }

  const registry = {
    list(): readonly {
      readonly id: string
      readonly path: string
      attachSession(sessionId: string): Promise<void>
    }[] {
      return [...workspaces.values()].map((ws) => ({
        id: ws.id,
        path: ws.path,
        attachSession: (sessionId: string): Promise<void> => attachTo(ws, sessionId),
      }))
    },
    async resolveByPath(p: string): Promise<
      | {
          readonly id: string
          readonly path: string
          attachSession(sessionId: string): Promise<void>
        }
      | undefined
    > {
      const canonical = canonicalize(p)
      if (!existingDirs.has(canonical)) {
        throw new Error(`ENOENT: no such file or directory, realpath '${canonical}'`)
      }
      const ws = workspaces.get(canonical)
      if (ws === undefined) return undefined
      return {
        id: ws.id,
        path: ws.path,
        attachSession: (sessionId: string): Promise<void> => attachTo(ws, sessionId),
      }
    },
  }

  return { registry, addDir, register, materialize, remove, entity, count: () => workspaces.size }
}

// --- A: the port factory against the fake registry (seam-level) ----------------

const fakeA = makeFakeWorkspaceRegistry()
const wsA = fakeA.register('C:/team/wsx', 'ws-a')
const portA = createWorkspaceAttach(fakeA.registry)

// A1 — the registered path resolves (a different spelling) to the
// registry's canonical path, verbatim:
const resA1 = await portA.resolvePath('C:/team/wsx/')

// A2 — an existing UNOWNED directory rejects (NOT_FOUND, the unowned
// reason):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a2Error: any
fakeA.addDir('C:/team/unowned')
try {
  await portA.resolvePath('C:/team/unowned')
} catch (error) {
  a2Error = error
}

// A3 — a MISSING directory rejects (the upstream realpath rejection is
// wrapped, NOT_FOUND):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a3Error: any
try {
  await portA.resolvePath('C:/team/never-existed')
} catch (error) {
  a3Error = error
}

// A10 — an empty path rejects (fail-closed at the port):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a10Error: any
try {
  await portA.resolvePath('')
} catch (error) {
  a10Error = error
}

// The failed resolutions never mutated the registry (no silent
// create-or-adopt): exactly the one registered workspace remains.
const registryCountAfterA = fakeA.count()

// A4 — the attach-after-materialization contract: the session's
// materialized header cwd equals the workspace path → attach resolves:
fakeA.materialize('session-m2a', 'C:/team/wsx')
await portA.attachSession('ws-a', 'session-m2a')
const accountAfterA4 = [...(fakeA.entity('ws-a')?.sessionIds ?? [])]
const writesAfterA4 = fakeA.entity('ws-a')?.writes ?? 0

// A5 — a cwd mismatch rejects (ATTACH_FAILED, both paths in the message):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a5Error: any
fakeA.materialize('session-m2b', 'C:/team/elsewhere')
try {
  await portA.attachSession('ws-a', 'session-m2b')
} catch (error) {
  a5Error = error
}

// A6 — an unmaterialized session rejects (ATTACH_FAILED):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a6Error: any
try {
  await portA.attachSession('ws-a', 'session-ghost')
} catch (error) {
  a6Error = error
}

// A7 — the idempotent retry: a second attach of the already-accounted
// session resolves, duplicates nothing, and performs NO further write
// (the port delegates verbatim — the upstream attach IS called again,
// and the no-write idempotency is the upstream contract's):
await portA.attachSession('ws-a', 'session-m2a')
const accountAfterA7 = [...(fakeA.entity('ws-a')?.sessionIds ?? [])]
const writesAfterA7 = fakeA.entity('ws-a')?.writes ?? 0
const attachCallsA7 = [...(fakeA.entity('ws-a')?.attachCalls ?? [])]

// A8 — an attach naming a DELETED workspace id rejects (NOT_FOUND):
fakeA.register('C:/team/shortlived', 'ws-b')
fakeA.remove('ws-b')
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a8Error: any
try {
  await portA.attachSession('ws-b', 'session-m2a')
} catch (error) {
  a8Error = error
}

// A9 — the structural validator: absent and malformed services fail
// closed with the stable code (the same code the entry uses):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a9aError: any
try {
  assertWorkspaceRegistryLike(undefined)
} catch (error) {
  a9aError = error
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let a9bError: any
try {
  assertWorkspaceRegistryLike({ list: () => [] })
} catch (error) {
  a9bError = error
}

// --- B: the real production entry (missing / malformed / healthy world) --------

const TCM_ROOT_SID = 'session-tcm-m2'
const TCM_SEED_WORKER_ID = 'inst-tcmm2w1'
const TCM_SEED_WORKER_CHILD = 'session-child-tcmm2w1'
const TCM_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: TCM-M2-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the TCM M2 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the TCM M2 work.',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '  deny:',
  '    - delete-team',
  'policyStates:',
  '  - id: default',
  '    description: "Default state."',
  'quotas:',
  '  team:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  '  members:',
  '    maxInstances: 2',
  '    maxConcurrent: 2',
  'metadata: {}',
  '---',
].join('\n')

/** The TCM-M2 row config (the entry's ONLY input channel). */
function tcmRowConfig(overrides: Partial<TeamPluginConfig> = {}): TeamPluginConfig {
  return {
    bootPhase: 'create',
    rootSessionId: TCM_ROOT_SID,
    blueprintSource: TCM_BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/tcm-m2',
    seedMembers: [
      {
        instanceId: TCM_SEED_WORKER_ID,
        templateId: 'worker',
        label: 'tcm-m2-seed-worker',
        childSessionId: TCM_SEED_WORKER_CHILD,
      },
    ],
    staticModel: { provider: 'tcm-static', model: 'tcm-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    ...overrides,
  }
}

interface TcmWorld {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

/** One plain-object Cordis context (get / provide / effect). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function makeWorld(extra: Record<string, any>): TcmWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    ...extra,
  }
  const effectDisposers: Array<() => void> = []
  const ctx: TeamPluginHostContext = {
    get: (name: string) => provided[name],
    provide: (name: string, value: unknown) => {
      provided[name] = value
    },
    effect: (factory: () => () => void, _label?: string) => {
      effectDisposers.push(factory())
    },
  }
  return { ctx, provided, effectDisposers }
}

// B1 — the MISSING service: the bootstrap rejects with the stable code
// (before any durable effect; the facade is provided — apply never
// rejects):
const dir1 = scratchDir('tcm-m2-missing-svc')
destroyDir(dir1) // idempotent start-state
const world1 = makeWorld({ teamStorageSeam: new FileStorageSeam(dir1) })
await hostEntry.apply(world1.ctx, tcmRowConfig())
let b1Error: unknown
try {
  await world1.provided.teamRoot.ready
} catch (error) {
  b1Error = error
}
for (const dispose of world1.effectDisposers) dispose()
await new Promise((resolve) => {
  setTimeout(resolve, 10)
})
destroyDir(dir1)

// B2 — the MALFORMED service (lacking resolveByPath): the bootstrap
// rejects with the stable code, the malformation named:
const dir2 = scratchDir('tcm-m2-malformed-svc')
destroyDir(dir2)
const world2 = makeWorld({
  teamStorageSeam: new FileStorageSeam(dir2),
  workspaceRegistry: { list: () => [] },
})
await hostEntry.apply(world2.ctx, tcmRowConfig())
let b2Error: unknown
try {
  await world2.provided.teamRoot.ready
} catch (error) {
  b2Error = error
}
for (const dispose of world2.effectDisposers) dispose()
await new Promise((resolve) => {
  setTimeout(resolve, 10)
})
destroyDir(dir2)

// B3 — the healthy world: the real entry boots over the real file seam
// and the closure the root exposes works end-to-end (resolve → attach):
const fakeB = makeFakeWorkspaceRegistry()
const wsB = fakeB.register('C:/team/m2home', 'ws-b3')
const dir3 = scratchDir('tcm-m2-healthy')
destroyDir(dir3)
const world3 = makeWorld({
  teamStorageSeam: new FileStorageSeam(dir3),
  workspaceRegistry: fakeB.registry,
})
await hostEntry.apply(world3.ctx, tcmRowConfig())
let b3Root: { workspaceAttach?: {
  resolvePath(path: string): Promise<{ readonly workspaceId: string; readonly path: string }>
  attachSession(workspaceId: string, sessionId: string): Promise<void>
} } | undefined
try {
  b3Root = await world3.provided.teamRoot.ready
} catch {
  b3Root = undefined
}
fakeB.materialize('session-m2home', 'C:/team/m2home')
let b3Resolve: { readonly workspaceId: string; readonly path: string } | undefined
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- scenario error capture
let b3Error: any
try {
  if (b3Root?.workspaceAttach !== undefined) {
    b3Resolve = await b3Root.workspaceAttach.resolvePath('C:/team/m2home/')
    await b3Root.workspaceAttach.attachSession(b3Resolve.workspaceId, 'session-m2home')
  }
} catch (error) {
  b3Error = error
}
const b3Account = [...(fakeB.entity('ws-b3')?.sessionIds ?? [])]
for (const dispose of world3.effectDisposers) dispose()
await new Promise((resolve) => {
  setTimeout(resolve, 10)
})
destroyDir(dir3)

// --- the assertions (sync it() bodies) -----------------------------------------

function codeOf(error: unknown): string | null {
  return isTeamPluginError(error) ? error.code : null
}

describe('M2 the host-side workspace attach seam (plan §15.5)', () => {
  it('A1: a registered path (any spelling) resolves to the registry canonical path, verbatim', () => {
    expect(resA1).toEqual({ workspaceId: 'ws-a', path: wsA.path })
    expect(wsA.path).toBe('C:/team/wsx')
    expect(resA1?.path === wsA.path).toBe(true)
  })

  it('A2: an existing unowned directory rejects with TEAM_PLUGIN_WORKSPACE_NOT_FOUND (the unowned reason)', () => {
    expect(codeOf(a2Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND)
    expect(isTeamPluginError(a2Error) && a2Error.message.includes('C:/team/unowned')).toBe(true)
    expect(isTeamPluginError(a2Error) && a2Error.message.includes('no workspace owns it')).toBe(true)
  })

  it('A3: a missing directory rejects with TEAM_PLUGIN_WORKSPACE_NOT_FOUND (the realpath rejection wrapped)', () => {
    expect(codeOf(a3Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND)
    expect(isTeamPluginError(a3Error) && a3Error.message.includes('C:/team/never-existed')).toBe(true)
    expect(isTeamPluginError(a3Error) && a3Error.message.includes('ENOENT')).toBe(true)
  })

  it('A10: an empty path rejects fail-closed at the port', () => {
    expect(codeOf(a10Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND)
  })

  it('A2/A3: failed resolutions never mutated the registry (no silent create-or-adopt)', () => {
    expect(registryCountAfterA).toBe(1)
  })

  it('A4: a session materialized with the workspace cwd attaches (the account records it once)', () => {
    expect(accountAfterA4).toEqual(['session-m2a'])
    expect(writesAfterA4).toBe(1)
  })

  it('A5: a cwd mismatch rejects with TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED (both paths named)', () => {
    expect(codeOf(a5Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED)
    expect(isTeamPluginError(a5Error) && a5Error.message.includes('C:/team/wsx')).toBe(true)
    expect(isTeamPluginError(a5Error) && a5Error.message.includes('C:/team/elsewhere')).toBe(true)
  })

  it('A6: an unmaterialized session rejects with TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED', () => {
    expect(codeOf(a6Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_ATTACH_FAILED)
    expect(isTeamPluginError(a6Error) && a6Error.message.includes('session-ghost')).toBe(true)
  })

  it('A7: the idempotent retry resolves, duplicates nothing, and performs no further write (the port delegates verbatim)', () => {
    expect(accountAfterA7).toEqual(['session-m2a'])
    expect(writesAfterA7).toBe(1)
    // the upstream attach was called for the session TWICE (first attach
    // + the retry — the port never caches or dedupes itself), and the
    // failed A5/A6 attempts are the other recorded calls:
    expect(attachCallsA7.filter((id) => id === 'session-m2a')).toEqual([
      'session-m2a',
      'session-m2a',
    ])
    expect(attachCallsA7).toEqual([
      'session-m2a',
      'session-m2b',
      'session-ghost',
      'session-m2a',
    ])
  })

  it('A8: an attach naming a deleted workspace id rejects with TEAM_PLUGIN_WORKSPACE_NOT_FOUND', () => {
    expect(codeOf(a8Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_WORKSPACE_NOT_FOUND)
    expect(isTeamPluginError(a8Error) && a8Error.message.includes('ws-b')).toBe(true)
  })

  it('A9: the structural validator fails closed on absent and malformed services', () => {
    expect(codeOf(a9aError)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING)
    expect(codeOf(a9bError)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING)
    expect(isTeamPluginError(a9bError) && a9bError.message.includes('malformed')).toBe(true)
  })

  it('B1: a missing workspaceRegistry service rejects the real entry bootstrap (TEAM_PLUGIN_SERVICE_MISSING, the service named; the facade is still provided)', () => {
    expect('teamRoot' in world1.provided).toBe(true)
    expect(codeOf(b1Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING)
    expect(b1Error instanceof Error && b1Error.message.includes('workspaceRegistry')).toBe(true)
  })

  it('B2: a malformed service (no resolveByPath) rejects the real entry bootstrap (the malformation named)', () => {
    expect('teamRoot' in world2.provided).toBe(true)
    expect(codeOf(b2Error)).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING)
    expect(b2Error instanceof Error && b2Error.message.includes('malformed')).toBe(true)
  })

  it('B3: the healthy world boots and the root exposes a working closure (resolve → attach end-to-end)', () => {
    expect(b3Root !== undefined && b3Root !== null).toBe(true)
    expect(b3Root?.workspaceAttach !== undefined).toBe(true)
    expect(b3Error === undefined).toBe(true)
    expect(b3Resolve).toEqual({ workspaceId: 'ws-b3', path: wsB.path })
    expect(b3Account).toEqual(['session-m2home'])
  })
})
