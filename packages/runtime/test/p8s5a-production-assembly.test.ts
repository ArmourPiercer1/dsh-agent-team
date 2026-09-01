/**
 * p8s5a-production-assembly.test.ts — T1 (P8-S5A): the shipped production
 * entry TRULY ASSEMBLES the backend.
 *
 * The test imports the production entry from TS SOURCE (`../src/plugin/
 * host.js` — NodeNext .js→.ts sibling; the runner hook and tsc resolve
 * the same file identically) and calls its Cordis `apply(ctx, config)`
 * with:
 *
 * Scope honesty (S5A-URL): in-chain this suite proves the SOURCE-level
 * contract — the entry shape, the config validator, and the full
 * A01–A29 assembly against the real P4 repositories. BUILT-artifact
 * loadability (the dist-mirror entry the live harness mounts) is proven
 * OUT-OF-CHAIN: the full live harness re-run (17/17) and the plain-Node
 * `node --check` + import smoke over the rebuilt dist entry (see
 * dev/agent-workflow/evidence/P8-S/S5A-url-result.md, A6/A7).
 *
 *   - a REAL storage seam (testkit `FileStorageSeam` over a scratch dir —
 *     the durable authority is the real P4 repositories);
 *   - a TEST-OWNED stub glue bundle passed through the row-owned
 *     `config.glueUrl` channel (the exact production loading path; the
 *     stub records surface effects and counts boot/close);
 *   - plain-object services for `agents` / `sessionPersistence`
 *     (the stub glue never touches them).
 *
 * Runner note: the plain-node shim (scripts/test-vitest-shim.mjs) forbids
 * async `it()` bodies and exposes only toBe/toEqual/toBeGreaterThan/toThrow
 * — so, exactly like the P6-T2/P8-S3 suites, every scenario drives the
 * production entry at MODULE TOP LEVEL (top-level await) and captures the
 * observable outcome; the synchronous `it` bodies assert on the captured
 * state. A scenario that cannot run throws during module load and fails
 * the whole file.
 *
 * Proven per test:
 *
 *   T1.1 — A01–A29 all assembled and reachable through the `teamRoot`
 *          facade + the full root surface; the tool stack is filled
 *          (10 tools); the create-phase boot seeds the durable world
 *          (team root row + binding + the two RUNNING/av1 seed members);
 *          boot is memoized;
 *   T1.2 — the four S6 install seams (A30/A31/A32/A34) fail closed with
 *          their stable codes pre-install, are install-once (a second
 *          install throws TEAM_PLUGIN_SEAM_ALREADY_INSTALLED), and the
 *          fail-closed overlay proxy activates on install;
 *   T1.3 — the injected frozen legacy reader (A29) is reachable through
 *          the production root (empty home -> `native-fallback` view);
 *   T1.4 — the fresh/cold binding paths (A05/A06/A08/A09) are directly
 *          invocable against the production root (fresh root bind +
 *          fresh member + cold rehydration: root against the seeded world, member against the fresh member — the frozen seed contract defines the seeded member rows WITHOUT child team-member bindings, so the boot flow is live-only);
 *   T1.5 — the resume phase re-opens the durable world without re-seeding
 *          (the same rows, boot once);
 *   T1.6 — invalid row config and missing hard services reject the
 *          bootstrap (`teamRoot.ready`) with stable codes while the facade IS still provided synchronously (apply never rejects);
 *   T1.7 — the row effect disposer closes the world (stop semantics).
 * @module @dsh-agent-team/runtime/test/p8s5a-production-assembly
 */

import { describe, expect, it } from 'vitest'
import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import type { InstanceId } from '../../contracts/src/index.js'
import { parseBlueprint } from '../../domain/blueprint/src/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
} from '../../testkit/fault-injection/file-seam.mjs'
import {
  TEAM_PLUGIN_ERROR_CODES,
} from '../src/plugin/types.js'
import * as hostEntry from '../src/plugin/host.js'
import {
  createFailClosedOverlayProxy,
  createProjectionLiveOverlaySeam,
} from '../src/plugin/seams.js'
import type { LiveResidencyOverlayPort } from '../projection/index.js'
import { stubGlueUrl } from './p8s5a-artifacts.mjs'

// --- the T1 fixture world -----------------------------------------------------------

/** The T1 root session id (distinct from every other phase fixture). */
const ROOT_SID = 'session-p8s5aroot'
/** The T1 seeded worker / scout (the leader is implied by the root). */
const SEED_WORKER_ID = 'inst-p8s5aseedw1'
const SEED_SCOUT_ID = 'inst-p8s5aseeds1'
const SEED_WORKER_CHILD = 'session-child-p8s5aseedw1'

/** The T1 blueprint (own id; structure mirrors the P6-T6 fixture). */
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P8S5A-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P8S5A team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P8S5A work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P8S5A team.',
  '    contextPolicy: fresh_per_delegation',
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
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P8S5A default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The T1 row config (the entry's ONLY input channel). */
function rowConfig(bootPhase: 'create' | 'resume') {
  return {
    bootPhase,
    rootSessionId: ROOT_SID,
    blueprintSource: BLUEPRINT_SOURCE,
    generation: 1,
    defaultWorkspace: 'C:/agent-team/work/p8s5a',
    seedMembers: [
      {
        instanceId: SEED_WORKER_ID,
        templateId: 'worker',
        label: 't1-seed-worker',
        childSessionId: SEED_WORKER_CHILD,
      },
      {
        instanceId: SEED_SCOUT_ID,
        templateId: 'scout',
        label: 't1-seed-scout',
        childSessionId: 'session-child-p8s5aseeds1',
      },
    ],
    staticModel: { provider: 'p8s5a-static', model: 'p8s5a-model-v1' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: stubGlueUrl(),
  }
}

// --- the test Cordis context + the built-entry loader --------------------------------

/** The production facade `teamRoot` as provided by the entry. */
interface TeamRootFacade {
  readonly ready: Promise<Record<string, any>>
  [key: string]: any
}

interface TestWorld {
  ctx: Record<string, any>
  readonly provided: Record<string, any>
  readonly effectDisposers: Array<() => void>
}

/** One plain-object Cordis context (get / provide / effect). */
function makeWorld(seam: FileStorageSeam): TestWorld {
  const provided: Record<string, any> = {
    agents: { create: async () => {}, resume: async () => {} },
    sessionPersistence: { ensure: async () => {} },
    teamStorageSeam: seam,
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

let hostModulePromise: Promise<Record<string, any>> | null = null
/**
 * Resolve the production entry (statically imported from TS source — see
 * the file header for the source-level scope). Memoized for shape parity
 * with the pre-S5A-URL dynamic-import form.
 */
function loadHost(): Promise<Record<string, any>> {
  if (hostModulePromise === null) {
    hostModulePromise = Promise.resolve(hostEntry as unknown as Record<string, any>)
  }
  return hostModulePromise
}

/** Fail the whole file (module-load failure) on a flow-critical invariant. */
function check(condition: boolean, label: string): void {
  if (!condition) throw new Error(`T1 scenario guard: ${label}`)
}

/**
 * Read the thrown TeamPluginError `code` from one failing call (null when
 * it did not throw; an `unexpected-error:` string when it threw something
 * else). Duck-typed on purpose: the stable `code` string is the contract
 * (robust if the entry ever runs from a different module instance than
 * the src class this file imports).
 */
function readTeamPluginCode(fn: () => unknown): string | null {
  try {
    fn()
    return null
  } catch (err) {
    if (
      err !== null &&
      typeof err === 'object' &&
      (err as { name?: unknown }).name === 'TeamPluginError' &&
      typeof (err as { code?: unknown }).code === 'string'
    ) {
      return (err as { code: string }).code
    }
    return `unexpected-error: ${err instanceof Error ? err.message : String(err)}`
  }
}

/** Apply the entry and await its bootstrap (`ready`). */
async function applyWorld(world: TestWorld, config: Record<string, any>) {
  const host = await loadHost()
  await host.apply(world.ctx, config)
  const teamRoot: TeamRootFacade = world.provided.teamRoot
  check(teamRoot !== undefined, 'apply resolved but never provided teamRoot')
  const root = await teamRoot.ready
  return { host, teamRoot, root }
}

// --- the scenarios (module top level — the sync shim forbids async it()) -------------

// --- T1.1 — the create-phase assembly ------------------------------------------------

interface T11State {
  hostName: string
  applyType: string
  configRootSessionId: string
  configBootPhase: string
  domainCloseType: string
  domainName: string
  catalogPresent: boolean
  blueprintId: string
  leaderInstanceId: string
  intentCatalogKeyCount: number
  proberPresent: boolean
  authorityPresent: boolean
  enforceGateType: string
  bindFreshType: string
  rootRehydrateColdType: string
  createFreshType: string
  memberRehydrateColdType: string
  binderPresent: boolean
  slotPersonaName: string
  slotModelName: string
  slotCapabilityName: string
  providerPresent: boolean
  runtimePresent: boolean
  lifecycleServicePresent: boolean
  commitTransitionType: string
  mutationServicePresent: boolean
  admitGovernanceOverrideType: string
  resolveDurableModelSelectionType: string
  resolveDurableMcpFacetType: string
  messagingPresent: boolean
  controlPresent: boolean
  activityPresent: boolean
  forkReconcileType: string
  handoffPresent: boolean
  projectionPresent: boolean
  projectType: string
  liveIsStub: boolean
  bootCount: number
  toolsCount: number
  rootRecordPresent: boolean
  rootRecordGeneration: number
  rootRecordBlueprintId: string
  memberCount: number
  workerPresent: boolean
  workerLifecycle: string
  workerActivityVersion: number
  workerChildSessionId: string
  bootCountAfterSecondBoot: number
}

const t11 = await (async (): Promise<T11State> => {
  const dir = scratchDir('p8s5a-create')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const seam = new FileStorageSeam(dir)
  const world = makeWorld(seam)
  const { host, teamRoot, root } = await applyWorld(world, rowConfig('create'))
  try {
    const rootRecord = root.domain.repositories.teamSessions.get(parseRootSessionId(ROOT_SID))
    const members = root.domain.repositories.memberInstances.list(parseRootSessionId(ROOT_SID))
    const worker = members.find((m: any) => String(m.instanceId) === SEED_WORKER_ID)
    // Boot is memoized (a second call is a no-op, no second glue boot).
    await root.boot()
    return {
      hostName: String(host.name),
      applyType: typeof host.apply,
      configRootSessionId: String(root.config.rootSessionId),
      configBootPhase: String(root.config.bootPhase),
      domainCloseType: typeof root.domain.close,
      domainName: String(root.domain.name),
      catalogPresent: root.catalog !== null && root.catalog !== undefined,
      blueprintId: String(root.blueprint.blueprintId),
      leaderInstanceId: String(root.leaderIdentity.instanceId),
      intentCatalogKeyCount: Object.keys(root.intent.catalog).length,
      proberPresent: root.compatibility.prober !== null,
      authorityPresent: root.compatibility.authority !== null,
      enforceGateType: typeof root.compatibility.enforceGate,
      bindFreshType: typeof root.rootBinding.bindFresh,
      rootRehydrateColdType: typeof root.rootBinding.rehydrateCold,
      createFreshType: typeof root.memberResidency.createFresh,
      memberRehydrateColdType: typeof root.memberResidency.rehydrateCold,
      binderPresent: root.binder !== null && root.binder !== undefined,
      slotPersonaName: String(root.slots.persona.name),
      slotModelName: String(root.slots.model.name),
      slotCapabilityName: String(root.slots.capability.name),
      providerPresent: root.provider !== null && root.provider !== undefined,
      runtimePresent: root.runtime !== null && root.runtime !== undefined,
      lifecycleServicePresent:
        root.lifecycle.service !== null && root.lifecycle.service !== undefined,
      commitTransitionType: typeof root.lifecycle.commit.commitTransition,
      mutationServicePresent:
        root.mutation.service !== null && root.mutation.service !== undefined,
      admitGovernanceOverrideType: typeof root.mutation.admitGovernanceOverride,
      resolveDurableModelSelectionType: typeof root.mutation.resolveDurableModelSelection,
      resolveDurableMcpFacetType: typeof root.mutation.resolveDurableMcpFacet,
      messagingPresent: root.messaging !== null && root.messaging !== undefined,
      controlPresent: root.control !== null && root.control !== undefined,
      activityPresent: root.activity !== null && root.activity !== undefined,
      forkReconcileType: typeof root.fork.reconcile,
      handoffPresent: root.handoff !== null && root.handoff !== undefined,
      projectionPresent: root.projection !== null && root.projection !== undefined,
      projectType: typeof root.projection.project,
      liveIsStub: teamRoot.live === root.live,
      bootCount: (root.live as any).__t1.bootCount,
      toolsCount: root.tools.tools.length,
      rootRecordPresent: rootRecord !== undefined,
      rootRecordGeneration: rootRecord === undefined ? -1 : rootRecord.generation,
      rootRecordBlueprintId:
        rootRecord === undefined ? '<missing>' : String(rootRecord.blueprint.blueprintId),
      memberCount: members.length,
      workerPresent: worker !== undefined,
      workerLifecycle: worker === undefined ? '<missing>' : String(worker.lifecycle),
      workerActivityVersion: worker === undefined ? -1 : worker.activityVersion,
      workerChildSessionId: worker === undefined ? '<missing>' : String(worker.childSessionId),
      bootCountAfterSecondBoot: (root.live as any).__t1.bootCount,
    }
  } finally {
    await root.close()
    destroyDir(dir)
  }
})()

// --- T1.2 — the S6 seam discipline ----------------------------------------------------

interface T12State {
  seamInstalledCount: number
  seamCurrentOkCount: number
  projectionSucceeded: boolean
  projectionMemberCount: number
  projectionResidentCount: number
  projectionColdCount: number
  secondInstallCode: string | null
  nullInstallCode: string | null
  proxyPreInstallCode: string | null
  proxyPostInstallEntry: unknown
}

const t12 = await (async (): Promise<T12State> => {
  const dir = scratchDir('p8s5a-seams')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const world = makeWorld(new FileStorageSeam(dir))
  const { root } = await applyWorld(world, rowConfig('create'))
  try {
    const seams = root.seams
    // S6: the production root installs all four seams during construction
    // (C1 — the production flow never hits a not-installed code; the
    // fail-closed pre-install state remains testable on fresh seams).
    const seamInstalledCount = [
      seams.projectionLiveOverlay.installed,
      seams.remoteHandlerRegistration.installed,
      seams.serverPrincipalDerivation.installed,
      seams.remoteQueryCommandCompletion.installed,
    ].filter(Boolean).length
    const seamCurrentOkCount = [
      seams.projectionLiveOverlay.current() !== null,
      seams.remoteHandlerRegistration.current() !== null,
      seams.serverPrincipalDerivation.current() !== null,
      seams.remoteQueryCommandCompletion.current() !== null,
    ].filter(Boolean).length

    // The projection works end-to-end through the production root (S6):
    // the catalog-backed source resolves the templates + policyState, and
    // the installed live-residency overlay maps every durable member —
    // the stub world's live set is empty, so all three project cold.
    let projectionSucceeded = false
    let projectionMemberCount = -1
    let projectionResidentCount = -1
    let projectionColdCount = -1
    try {
      const projection = root.projection.project(parseRootSessionId(ROOT_SID))
      projectionSucceeded = true
      projectionMemberCount = projection.members.length
      projectionResidentCount = projection.members.filter(
        (member: { liveActivity: { residency: string } | null }) =>
          member.liveActivity !== null && member.liveActivity.residency === 'resident',
      ).length
      projectionColdCount = projection.members.filter(
        (member: { liveActivity: { residency: string } | null }) =>
          member.liveActivity !== null && member.liveActivity.residency === 'cold',
      ).length
    } catch (e) {
      // The production root must project without error (the overlay seam is
      // installed during construction) — fail the file on the real error.
      throw e instanceof Error
        ? new Error(`T1.2 projection failed: ${e.name}: ${e.message}`)
        : e
    }

    // Install-once: a second install on any production seam throws (the
    // root installed every seam during construction).
    const secondInstallCode = readTeamPluginCode(() =>
      seams.projectionLiveOverlay.install({ snapshot: () => new Map() }),
    )
    // A null implementation is rejected (typed seam, non-null impl) —
    // checked on a fresh seam (the production ones are already installed).
    const freshSeam = createProjectionLiveOverlaySeam()
    const nullInstallCode = readTeamPluginCode(() =>
      freshSeam.install(null as unknown as LiveResidencyOverlayPort),
    )

    // The fail-closed overlay proxy: throws pre-install, delegates
    // post-install (the A30 wiring the projection service consumes).
    const proxy = createFailClosedOverlayProxy(freshSeam)
    const proxyPreInstallCode = readTeamPluginCode(() => proxy.snapshot())
    // The overlay payload is an arbitrary passthrough fixture (the seam
    // validates nothing but non-null objectness); the cast sits at the
    // type boundary because the seam's generic is the production port.
    const liveOverlay = {
      snapshot: () => new Map([['inst-p8s5aseedw1', { state: 'working' }]]),
    } as unknown as LiveResidencyOverlayPort
    freshSeam.install(liveOverlay)
    const proxyPostInstallEntry = proxy.snapshot().get(
      'inst-p8s5aseedw1' as unknown as InstanceId,
    )

    return {
      seamInstalledCount,
      seamCurrentOkCount,
      projectionSucceeded,
      projectionMemberCount,
      projectionResidentCount,
      projectionColdCount,
      secondInstallCode,
      nullInstallCode,
      proxyPreInstallCode,
      proxyPostInstallEntry,
    }
  } finally {
    await root.close()
    destroyDir(dir)
  }
})()

// --- T1.3 — the injected frozen legacy reader -----------------------------------------

const t13 = await (async (): Promise<{ status: string }> => {
  const dir = scratchDir('p8s5a-legacy')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const world = makeWorld(new FileStorageSeam(dir))
  const { root } = await applyWorld(world, rowConfig('create'))
  try {
    // An empty home (no legacy metadata) -> the native-fallback view.
    const inspection = root.legacy.inspect(
      { listDir: () => [], readFile: () => undefined },
      { dshHome: 'C:/p8s5a-legacy-home' },
    )
    return { status: String(inspection.status) }
  } finally {
    await root.close()
    destroyDir(dir)
  }
})()

// --- T1.4 — the fresh/cold paths are reachable ----------------------------------------

interface T14State {
  freshResultPresent: boolean
  freshRootRowPresent: boolean
  freshMemberPresent: boolean
  freshMemberCount: number
  freshWorkerRowPresent: boolean
  coldRootPresent: boolean
  coldMemberPresent: boolean
}

const t14 = await (async (): Promise<T14State> => {
  const dir = scratchDir('p8s5a-freshcold')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const world = makeWorld(new FileStorageSeam(dir))
  const { root } = await applyWorld(world, rowConfig('create'))
  try {
    // A05 — a fresh root bind for a NEW session in the same domain. The
    // snapshot ref must carry the REAL content hash derived from the bound
    // blueprint source (the production root's catalog is the real domain
    // parser — identity is enforced, not stubbed).
    const freshRoot = 'session-p8s5afresh'
    const freshBp = parseBlueprint(BLUEPRINT_SOURCE)
    const freshResult = await root.rootBinding.bindFresh({
      rootSessionId: parseRootSessionId(freshRoot),
      blueprint: createBlueprintSnapshotRef({
        blueprintId: parseBlueprintId(String(freshBp.blueprintId)),
        revision: parseBlueprintRevision(String(freshBp.revision)),
        contentHash: parseBlueprintContentHash(String(freshBp.contentHash)),
      }),
      generation: 1,
    })
    const freshRootRow = root.domain.repositories.teamSessions.get(parseRootSessionId(freshRoot))

    // A08 — a fresh member under the fresh root (no external effect in
    // the T1 world; the durability barrier is the stub no-op).
    const freshMember = await root.memberResidency.createFresh({
      rootSessionId: freshRoot,
      templateId: 'worker',
      label: 't1-fresh-member',
    })
    const freshMembers = root.domain.repositories.memberInstances.list(
      parseRootSessionId(freshRoot),
    )

    // A06 + A09 — the cold paths (write-free). The root cold path runs
    // against the seeded world (the team-root binding IS seeded); the
    // member cold path runs against the FRESH member above — the frozen
    // seed contract defines the seeded member rows WITHOUT child
    // `team-member` bindings, so a seeded member is deliberately not
    // cold-rehydratable (the boot flow is live-only; the cold nodes stay
    // assembled and reachable on the root surface).
    const coldRoot = await root.rootBinding.rehydrateCold({
      rootSessionId: parseRootSessionId(ROOT_SID),
    })
    const coldMember = await root.memberResidency.rehydrateCold({
      rootSessionId: freshRoot,
      instanceId: String(freshMember.durable.member.instanceId),
    })
    return {
      freshResultPresent: freshResult !== null && freshResult !== undefined,
      freshRootRowPresent: freshRootRow !== undefined,
      freshMemberPresent: freshMember !== null && freshMember !== undefined,
      // The fresh root bind also MINTS the leader row of the fresh root,
      // so the root's member list is leader + fresh member (2 rows).
      freshMemberCount: freshMembers.length,
      freshWorkerRowPresent: freshMembers.some(
        (m: any) => String(m.label) === 't1-fresh-member',
      ),
      coldRootPresent: coldRoot !== null && coldRoot !== undefined,
      coldMemberPresent: coldMember !== null && coldMember !== undefined,
    }
  } finally {
    await root.close()
    destroyDir(dir)
  }
})()

// --- T1.5 — the resume phase ------------------------------------------------------------

interface T15State {
  bootCount: number
  memberCount: number
  rootRecordPresent: boolean
  rootRecordGeneration: number
}

const t15 = await (async (): Promise<T15State> => {
  const dir = scratchDir('p8s5a-resume')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const seam = new FileStorageSeam(dir)
  const createWorld = makeWorld(seam)
  const createRoot = (await applyWorld(createWorld, rowConfig('create'))).root
  await createRoot.close()

  const resumeWorld = makeWorld(seam)
  const { root } = await applyWorld(resumeWorld, rowConfig('resume'))
  try {
    const members = root.domain.repositories.memberInstances.list(parseRootSessionId(ROOT_SID))
    const rootRecord = root.domain.repositories.teamSessions.get(parseRootSessionId(ROOT_SID))
    return {
      // The stub glue's __t1 counters are per createAgentBindings()
      // instance: the resume world's own counter sees exactly its own boot.
      bootCount: (root.live as any).__t1.bootCount,
      memberCount: members.length,
      rootRecordPresent: rootRecord !== undefined,
      rootRecordGeneration: rootRecord === undefined ? -1 : rootRecord.generation,
    }
  } finally {
    await root.close()
    destroyDir(dir)
  }
})()

// --- T1.6 — the loud failure contract ---------------------------------------------------

interface T16State {
  configErrorIsTeamPluginError: boolean
  configErrorCode: string | null
  serviceErrorIsTeamPluginError: boolean
  serviceErrorCode: string | null
  badWorldTeamRootPresent: boolean
  noAgentsTeamRootPresent: boolean
}

const t16 = await (async (): Promise<T16State> => {
  const dir = scratchDir('p8s5a-fail')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const seam = new FileStorageSeam(dir)
  try {
    const host = await loadHost()
    // Invalid row config (before any service is read). apply RESOLVES — the
    // facade IS provided — and the failure surfaces through `ready` (the
    // single observable failure channel; a rejected apply fiber is absorbed
    // by Cordis into an invisible logger):
    const badWorld = makeWorld(seam)
    let configErr: unknown
    await host.apply(badWorld.ctx, { ...rowConfig('create'), bootPhase: 'bogus' })
    check(
      badWorld.provided.teamRoot !== undefined,
      'T1.6 invalid-config apply did not provide the teamRoot facade',
    )
    try {
      await (badWorld.provided.teamRoot as { ready: Promise<unknown> }).ready
    } catch (e) {
      configErr = e
    }

    // A missing hard service (agents) rejects the bootstrap with the stable
    // code (the facade is provided too — apply never rejects):
    const noAgents: Record<string, any> = {
      sessionPersistence: { ensure: async () => {} },
      teamStorageSeam: seam,
    }
    const missingWorld = makeWorld(seam)
    missingWorld.ctx = {
      get: (name: string) => noAgents[name],
      provide: (name: string, value: unknown) => {
        noAgents[name] = value
      },
      effect: () => {},
    }
    let serviceErr: unknown
    await host.apply(missingWorld.ctx, rowConfig('create'))
    check(
      noAgents.teamRoot !== undefined,
      'T1.6 missing-agents apply did not provide the teamRoot facade',
    )
    try {
      await (noAgents.teamRoot as { ready: Promise<unknown> }).ready
    } catch (e) {
      serviceErr = e
    }

    return {
      configErrorIsTeamPluginError:
        configErr !== null &&
        typeof configErr === 'object' &&
        (configErr as { name?: unknown }).name === 'TeamPluginError',
      configErrorCode:
        configErr !== null && typeof configErr === 'object'
          ? ((configErr as { code?: unknown }).code as string | null) ?? null
          : null,
      serviceErrorIsTeamPluginError:
        serviceErr !== null &&
        typeof serviceErr === 'object' &&
        (serviceErr as { name?: unknown }).name === 'TeamPluginError',
      serviceErrorCode:
        serviceErr !== null && typeof serviceErr === 'object'
          ? ((serviceErr as { code?: unknown }).code as string | null) ?? null
          : null,
      badWorldTeamRootPresent: badWorld.provided.teamRoot !== undefined,
      noAgentsTeamRootPresent: noAgents.teamRoot !== undefined,
    }
  } finally {
    destroyDir(dir)
  }
})()

// --- T1.7 — the row effect disposer ------------------------------------------------------

interface T17State {
  effectCount: number
  disposeThrew: string | null
  closeCount: number
}

const t17 = await (async (): Promise<T17State> => {
  const dir = scratchDir('p8s5a-effect')
  destroyDir(dir) // idempotent start-state: an aborted prior run may have left a stamped domain
  const world = makeWorld(new FileStorageSeam(dir))
  const { root } = await applyWorld(world, rowConfig('create'))
  const effectCount = world.effectDisposers.length
  // The disposer runs without throwing (close is idempotent + guarded).
  let disposeThrew: string | null = null
  try {
    for (const dispose of world.effectDisposers) dispose()
  } catch (e) {
    disposeThrew = e instanceof Error ? e.message : String(e)
  }
  // The glue close was invoked (idempotent double-close is safe).
  await root.close()
  const closeCount = (root.live as any).__t1.closeCount
  destroyDir(dir)
  return { effectCount, disposeThrew, closeCount }
})()

// --- the assertions (synchronous `it` bodies over the captured state) -------------------

describe('P8-S5A T1 production assembly (source entry, real storage, stub glue)', () => {
  it('T1.1 create phase: A01-A29 assembled + reachable, 10 tools, seeded world', () => {
    // The entry identity (named-export Cordis protocol).
    expect(t11.hostName).toBe('dsh-agent-team')
    expect(t11.applyType).toBe('function')

    // A01 — the validated config is the root's input channel.
    expect(t11.configRootSessionId).toBe(ROOT_SID)
    expect(t11.configBootPhase).toBe('create')

    // A02 — the open TeamDomain (durable authority).
    expect(t11.domainCloseType).toBe('function')
    expect(t11.domainName).toBe('team_domain')

    // A03 — the immutable blueprint catalog + the bound blueprint.
    expect(t11.catalogPresent).toBe(true)
    expect(t11.blueprintId).toBe('P8S5A-BP')

    // A07 — the leader actor identity (invariant 14).
    expect(t11.leaderInstanceId).toBe('inst-leader')

    // A04 — the intent (remote method) catalog.
    expect(t11.intentCatalogKeyCount).toBeGreaterThan(0)

    // A14 + A15 — the compatibility prober/authority + the gate.
    expect(t11.proberPresent).toBe(true)
    expect(t11.authorityPresent).toBe(true)
    expect(t11.enforceGateType).toBe('function')

    // A05/A06 + A08/A09 — fresh + cold entry points present.
    expect(t11.bindFreshType).toBe('function')
    expect(t11.rootRehydrateColdType).toBe('function')
    expect(t11.createFreshType).toBe('function')
    expect(t11.memberRehydrateColdType).toBe('function')

    // A10 — the binder; A11-A13 — the three overlay slots.
    expect(t11.binderPresent).toBe(true)
    expect(t11.slotPersonaName).toBe('persona')
    expect(t11.slotModelName).toBe('model')
    expect(t11.slotCapabilityName).toBe('capability')

    // A16 — the activation provider; A17-A19 — the runtime facade.
    expect(t11.providerPresent).toBe(true)
    expect(t11.runtimePresent).toBe(true)

    // A20/A21 — lifecycle service + commit port; A22/A23 — mutation.
    expect(t11.lifecycleServicePresent).toBe(true)
    expect(t11.commitTransitionType).toBe('function')
    expect(t11.mutationServicePresent).toBe(true)
    expect(t11.admitGovernanceOverrideType).toBe('function')
    expect(t11.resolveDurableModelSelectionType).toBe('function')
    expect(t11.resolveDurableMcpFacetType).toBe('function')

    // A24-A28 — messaging / control / activity / fork / handoff.
    expect(t11.messagingPresent).toBe(true)
    expect(t11.controlPresent).toBe(true)
    expect(t11.activityPresent).toBe(true)
    expect(t11.forkReconcileType).toBe('function')
    expect(t11.handoffPresent).toBe(true)

    // A30 — the projection service (fail-closed source — T1.2).
    expect(t11.projectionPresent).toBe(true)
    expect(t11.projectType).toBe('function')

    // The live bundle IS the stub (loaded through config.glueUrl).
    expect(t11.liveIsStub).toBe(true)
    expect(t11.bootCount).toBe(1)

    // The tool stack is filled (ten team tools).
    expect(t11.toolsCount).toBe(10)

    // The create-phase boot seeded the durable world (real storage).
    expect(t11.rootRecordPresent).toBe(true)
    // The boot-time initial compatibility probe (decision (x)) is a
    // durable state replacement, and the frozen probe code advances the
    // teamSessions generation with it: the root row is generation 2
    // (seed write = 1, probe replacement = 2).
    expect(t11.rootRecordGeneration).toBe(2)
    expect(t11.rootRecordBlueprintId).toBe('P8S5A-BP')
    // Three seeded member rows: the leader (structural) + the two pairs.
    expect(t11.memberCount).toBe(3)
    expect(t11.workerPresent).toBe(true)
    expect(t11.workerLifecycle).toBe('RUNNING')
    expect(t11.workerActivityVersion).toBe(1)
    expect(t11.workerChildSessionId).toBe(SEED_WORKER_CHILD)

    // Boot is memoized (a second call is a no-op, no second glue boot).
    expect(t11.bootCountAfterSecondBoot).toBe(1)
  })

  it('T1.2 S6 seams install at construction, stay install-once, and project live', () => {
    // The production root installed all four S6 seams during construction
    // (C1 — no not-installed code is reachable in the production flow).
    expect(t12.seamInstalledCount).toBe(4)
    expect(t12.seamCurrentOkCount).toBe(4)

    // The projection works end-to-end: the S6 catalog-backed source
    // (templates + policyState) + the installed live-residency overlay.
    expect(t12.projectionSucceeded).toBe(true)
    // Three durable members (leader + worker + scout); the stub world's
    // live set is empty, so every member projects cold (no resident rows).
    expect(t12.projectionMemberCount).toBe(3)
    expect(t12.projectionResidentCount).toBe(0)
    expect(t12.projectionColdCount).toBe(3)

    // Install-once: a second install on a production seam throws.
    expect(t12.secondInstallCode).toBe(
      TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SEAM_ALREADY_INSTALLED,
    )
    // A null implementation is rejected (typed seam, non-null impl).
    expect(t12.nullInstallCode).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID)

    // The fail-closed overlay proxy: throws pre-install, delegates
    // post-install (the A30 wiring the projection service consumes).
    expect(t12.proxyPreInstallCode).toBe('PROJECTION_LIVE_OVERLAY_NOT_INSTALLED')
    expect(t12.proxyPostInstallEntry).toEqual({ state: 'working' })
  })

  it('T1.3 the frozen legacy reader is reachable through the production root', () => {
    // An empty home (no legacy metadata) -> the native-fallback view.
    expect(t13.status).toBe('native-fallback')
  })

  it('T1.4 fresh + cold binding paths (A05/A06/A08/A09) are directly invocable', () => {
    // A05 — a fresh root bind for a NEW session in the same domain.
    expect(t14.freshResultPresent).toBe(true)
    expect(t14.freshRootRowPresent).toBe(true)

    // A08 — a fresh member under the fresh root (the fresh bind also
    // mints the fresh root's leader row -> 2 member rows total).
    expect(t14.freshMemberPresent).toBe(true)
    expect(t14.freshWorkerRowPresent).toBe(true)
    expect(t14.freshMemberCount).toBe(2)

    // A06 + A09 — cold rehydration (root: seeded world; member: the
    // fresh member — the seeded member rows carry no child bindings).
    expect(t14.coldRootPresent).toBe(true)
    expect(t14.coldMemberPresent).toBe(true)
  })

  it('T1.5 resume phase re-opens the durable world without re-seeding', () => {
    // The glue booted exactly once in this (resume) world — its own
    // createAgentBindings instance, its own counter.
    expect(t15.bootCount).toBe(1)
    // No re-seeding: the same three seed rows (leader + two pairs), the
    // same team root row.
    expect(t15.memberCount).toBe(3)
    expect(t15.rootRecordPresent).toBe(true)
    // The compatibility state row already exists from the create-phase
    // boot (same world), so the resume boot skips the probe — the root
    // row keeps the create-phase generation 2.
    expect(t15.rootRecordGeneration).toBe(2)
  })

  it('T1.6 invalid config and missing services reject the bootstrap with stable codes', () => {
    // The facade IS provided in both cases (apply never rejects) — the
    // failures surface through teamRoot.ready with the stable codes.
    expect(t16.badWorldTeamRootPresent).toBe(true)
    expect(t16.noAgentsTeamRootPresent).toBe(true)
    // Invalid row config rejects the bootstrap with the stable code.
    expect(t16.configErrorIsTeamPluginError).toBe(true)
    expect(t16.configErrorCode).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID)
    // A missing hard service (agents) rejects the bootstrap with the stable code.
    expect(t16.serviceErrorIsTeamPluginError).toBe(true)
    expect(t16.serviceErrorCode).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_SERVICE_MISSING)
  })

  it('T1.7 the row effect disposer closes the world (stop semantics)', () => {
    // Exactly one effect was armed by the entry.
    expect(t17.effectCount).toBe(1)
    // The disposer ran without throwing (close is idempotent + guarded).
    expect(t17.disposeThrew === null).toBe(true)
    // The glue close was invoked (idempotent double-close is safe).
    expect(t17.closeCount).toBeGreaterThan(0)
  })
})
