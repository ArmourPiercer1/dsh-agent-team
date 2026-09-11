/**
 * bp1-red-probe.test.ts — BP0 / BP-A characterization (RED) probes for the
 * issue #2 blueprint-loading parallel repair (plan §4): the defect surface
 * of the CURRENT implementation, pinned BEFORE any product change.
 *
 * The probes assert the DESIRED (post-repair) behavior, so they fail
 * against the base 6a2f3e1 (the RED evidence attached to the PR) and turn
 * green as the corresponding BP stage lands:
 *
 *   RED-1 (BP-D/E) — the root catalog is DYNAMIC: a second Blueprint saved
 *     under the row's `blueprintDir` is listed WITHOUT any row-config
 *     change (the config carries no catalog channel today).
 *   RED-2 (BP-D) — a Blueprint file added AFTER boot is visible on the NEXT
 *     catalog query (scan-on-demand: no install-lifetime directory
 *     snapshot, no watcher, no HMR).
 *   RED-5 (BP-G) — a boot failure no longer leaves the /team-remote route
 *     unregistered: the mount happens BEFORE `boot()` (the route is
 *     registered once the root is CONSTRUCTED), the readiness state then
 *     fails closed on every non-catalog method, while `catalog.list` stays
 *     servable (it depends only on the source authority + the opened
 *     domain — plan §12).
 *
 * The 405 symptom itself is an upstream rc.1 routing fact (a route missing
 * at the webserver layer returns 405); the unit probe pins the ROOT CAUSE
 * — "the route was never registered because the mount awaited a boot that
 * rejected" — per plan §4 RED-5.
 *
 * Runner note: the plain-node vitest shim forbids async `it()` bodies —
 * the worlds boot at module load (top-level await), the `it` bodies assert
 * synchronously (the t12b1 / t12m4 pattern).
 *
 * @module @dsh-agent-team/runtime/test/bp1-red-probe
 */
import { describe, expect, it } from 'vitest'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
  writeText,
} from '../../testkit/fault-injection/file-seam.mjs'
import { REMOTE_RPC_CHANNEL } from '../../remote/src/handlers/register.js'
import * as hostEntry from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import {
  isTeamPluginError,
  TEAM_PLUGIN_ERROR_CODES,
} from '../src/plugin/types.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the fixture identities (own ids; structure mirrors T12B1/T12M4) -----------

/** The production row's root (the team the real create builds). */
const ROOT_SID = 'session-bp1redroot'
/** The resume probe's root (NEVER created on the medium -> boot fail-closed). */
const RESUME_PROBE_ROOT = 'session-bp1rednofit'

/**
 * The row anchor Blueprint (A). The row's `blueprintSource` — the
 * bootstrap/compatibility anchor that stays required.
 */
const BLUEPRINT_A_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: BP1-RED-A',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the BP1-RED-A team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the BP1-RED-A work.',
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
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The BP1-RED-A default state.',
  'quotas:',
  '    team:',
  '      maxInstances: 12',
  '      maxConcurrent: 12',
  '    members:',
  '      maxInstances: 4',
  '      maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The saved source B (present in the source dir from the start). */
const BLUEPRINT_B_SOURCE = BLUEPRINT_A_SOURCE
  .replace('BP1-RED-A', 'BP1-RED-B')
  .replace('You lead the BP1-RED-B team.', 'You lead the BP1-RED-B team.')

/** The saved source C (written AFTER the boot — the no-HMR probe). */
const BLUEPRINT_C_SOURCE = BLUEPRINT_A_SOURCE
  .replace('BP1-RED-A', 'BP1-RED-C')

/** The row config base (the entry's ONLY input channel). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function rowConfig(overrides: Record<string, any>): Record<string, any> {
  return {
    bootPhase: 'create',
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_A_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/bp1red',
    seedMembers: [],
    staticModel: { provider: 'bp1red-static', model: 'bp1red-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
    remoteMountWaitMs: 0,
    ...overrides,
  }
}

// --- the test Cordis context + the seam simulation (the t12b1/t12m4 pattern) ---

interface TestWorld {
  ctx: TeamPluginHostContext
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

/** One plain-object Cordis context (get / provide / effect). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
function makeWorld(extra: Record<string, any>): TestWorld {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    // M2 (plan §15.5): the hard-injected workspace service (stub).
    workspaceRegistry: { list: () => [], resolveByPath: async () => undefined },
    ...extra,
  }
  const effectDisposers: Array<() => void> = []
  return {
    ctx: {
      get: (name: string) => provided[name],
      provide: (name: string, value: unknown) => {
        provided[name] = value
      },
      effect: (factory: () => () => void, _label?: string) => {
        effectDisposers.push(factory())
      },
    },
    provided,
    effectDisposers,
  }
}

/** Apply the entry and await its bootstrap (`ready`). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
async function applyWorld(world: TestWorld, config: Record<string, any>): Promise<Record<string, any>> {
  await hostEntry.apply(world.ctx, config)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const teamRoot: Record<string, any> = world.provided.teamRoot
  if (teamRoot === undefined) throw new Error('BP1 guard: apply resolved but never provided teamRoot')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped test payload
  const root: Record<string, any> = await teamRoot.ready
  return root
}

/** The DSH-shaped seam handler (the extra signal argument is ignored). */
type DshShapeHandler = (
  endpoint: string,
  payload: unknown,
  signal?: unknown,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
) => Promise<Record<string, any>>

/**
 * The seam SIMULATION (the t12m4 pattern): a plain-object 'connection'
 * service whose `rpc.handle` captures the channel + the DSH-shaped
 * dispatcher.
 */
function makeConnectionSink() {
  const captured: {
    channel: string | null
    handler: DshShapeHandler | null
    calls: string[]
  } = { channel: null, handler: null, calls: [] }
  const rpc = {
    handle(channel: string, handler: DshShapeHandler) {
      captured.channel = channel
      captured.handler = handler
      captured.calls.push(channel)
      return async () => undefined
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
  const connection: Record<string, any> = { rpc }
  return { connection, captured }
}

// --- W1: the dynamic catalog (RED-1 + RED-2) ------------------------------------

// Pre-cleanup: deterministic scratch basenames (the testkit contract) — a
// crashed prior run would leave a stamped team_domain / source files behind.
const sourcesDir = scratchDir('bp1-red-sources')
destroyDir(sourcesDir)
const dir1 = scratchDir('bp1-red-create')
destroyDir(dir1)
writeText(`${sourcesDir}/bp1-red-a.yml`, BLUEPRINT_A_SOURCE)
writeText(`${sourcesDir}/bp1-red-b.yml`, BLUEPRINT_B_SOURCE)
const seam1 = new FileStorageSeam(dir1)
const world1 = makeWorld({ teamStorageSeam: seam1 })
const root1 = await applyWorld(world1, rowConfig({ blueprintDir: sourcesDir }))

// The catalog read WHILE the root is live (before the post-boot write):
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- live catalog facade (dynamic surface under test)
const catalogIdsBefore: readonly string[] = [...((root1 as any).catalog.blueprintIds as readonly string[])]

// RED-2: a NEW saved source appears in the directory AFTER the boot. The
// live catalog re-scans on demand — the next query sees it, no HMR.
writeText(`${sourcesDir}/bp1-red-c.yml`, BLUEPRINT_C_SOURCE)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- live catalog facade (dynamic surface under test)
const catalogIdsAfter: readonly string[] = [...((root1 as any).catalog.blueprintIds as readonly string[])]

await root1.close()
await world1.effectDisposers.forEach((dispose) => dispose())
destroyDir(dir1)
destroyDir(sourcesDir)

// --- W2: boot failure -> the remote route + readiness (RED-5) --------------------

const dir2 = scratchDir('bp1-red-bootfail')
destroyDir(dir2)
const seam2 = new FileStorageSeam(dir2)

// Stage 1: a real create stamps the domain (and one live team, ROOT_SID).
const world2a = makeWorld({ teamStorageSeam: seam2 })
const root2a = await applyWorld(world2a, rowConfig({}))
await root2a.close()
await world2a.effectDisposers.forEach((dispose) => dispose())

// Stage 2: RESUME a DIFFERENT root over the same stamped medium — the
// domain opens (the D-1 open path), the root is CONSTRUCTED, and `boot()`
// fails closed (TEAM_PLUGIN_RESUME_STATE_MISSING: no durable row for that
// root). The probe observes the remote registration around that rejection.
const sink2 = makeConnectionSink()
const world2b = makeWorld({ teamStorageSeam: seam2, connection: sink2.connection })
await hostEntry.apply(world2b.ctx, rowConfig({ bootPhase: 'resume', rootSessionId: RESUME_PROBE_ROOT }))
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic service surface (test double), untyped by design
const teamRoot2b: any = world2b.provided.teamRoot
let bootErr2 = ''
let bootErrCode2 = ''
try {
  await teamRoot2b.ready
} catch (e) {
  bootErr2 = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
  bootErrCode2 = isTeamPluginError(e) ? e.code : ''
}
const handler2 = sink2.captured.handler
const wireCatalog = handler2 === null
  ? null
  : await handler2('catalog.list', { version: 1, params: {} }, undefined)
const wireNonCatalog = handler2 === null
  ? null
  : await handler2(
    'team.getProjection',
    { version: 1, params: { teamSessionId: RESUME_PROBE_ROOT } },
    undefined,
  )
await world2b.effectDisposers.forEach((dispose) => dispose())
destroyDir(dir2)

// --- the assertions (sync it() bodies) -------------------------------------------

describe('BP1 RED probes: the blueprint-loading defect surface (plan §4)', () => {
  it('RED-1 the root catalog is DYNAMIC: the saved source B under blueprintDir is listed without a row-config change', () => {
    // Desired: both the inline anchor (A) and the saved source (B) are
    // listed. Current: the catalog is the static single-blueprint object
    // built from config.blueprintSource alone.
    expect([...catalogIdsBefore].sort()).toEqual(['BP1-RED-A', 'BP1-RED-B'])
  })

  it('RED-2 a saved source added AFTER boot is visible on the next catalog query (no HMR, scan-on-demand)', () => {
    // Desired: the post-boot write of C is picked up by the next query.
    // Current: the catalog holds an install-lifetime snapshot (no reload
    // surface at all).
    expect([...catalogIdsAfter].sort()).toEqual(['BP1-RED-A', 'BP1-RED-B', 'BP1-RED-C'])
  })

  it('characterization: the resume of an uncreated root still fails closed with TEAM_PLUGIN_RESUME_STATE_MISSING', () => {
    // This anchor passes BEFORE and AFTER the repair (the repair changes
    // WHERE the route registers, never whether a broken boot rejects).
    expect(bootErrCode2).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_RESUME_STATE_MISSING)
    expect(bootErr2.indexOf(RESUME_PROBE_ROOT) >= 0).toBe(true)
  })

  it('RED-5a the /team-remote route is registered BEFORE boot() settles (a boot failure no longer leaves the route missing)', () => {
    // Desired: mountRemote runs once the root is CONSTRUCTED — the
    // rejection above must not prevent the registration.
    // Current: the mount awaits boot(); boot rejects -> mountRemoteNow is
    // never called -> the webserver route is missing (the 405 symptom).
    expect(sink2.captured.channel).toBe(REMOTE_RPC_CHANNEL)
    expect(sink2.captured.calls).toEqual([REMOTE_RPC_CHANNEL])
  })

  it('RED-5b catalog.list stays SERVABLE in the failed state (it depends only on the source authority + the opened domain)', () => {
    // Desired: the frozen RemoteResponse success envelope (data + the
    // provenance) even though the boot rejected.
    // Current: no dispatcher was registered at all (handler null).
    expect(wireCatalog !== null).toBe(true)
    if (wireCatalog !== null) {
      expect(wireCatalog.ok).toBe(true)
      expect(wireCatalog.value !== null && wireCatalog.value !== undefined).toBe(true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- wire payload (dynamic surface under test)
      const data: any = (wireCatalog as any).value?.data
      expect(Array.isArray(data?.blueprints)).toBe(true)
    }
  })

  it('RED-5c a NON-catalog method fails closed in the failed state (no partial readiness)', () => {
    // Desired: the typed failure envelope (ok:false) — the readiness gate
    // refuses every runtime method while the state is not 'ready'.
    // Current: no dispatcher at all.
    expect(wireNonCatalog !== null).toBe(true)
    if (wireNonCatalog !== null) {
      expect(wireNonCatalog.ok).toBe(false)
    }
  })
})
