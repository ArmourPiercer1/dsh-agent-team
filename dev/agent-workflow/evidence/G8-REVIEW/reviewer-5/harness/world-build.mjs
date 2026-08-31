/**
 * g8r5 world build — assembles the REAL TeamDomain world (mock-first
 * ruling R28: durable domain REAL; DSH-side surfaces deterministic fakes)
 * and exposes the twelve Remote-contract-v1 ports as an object of
 * dotted-name functions for the worker mailbox (world-worker.mjs).
 *
 * REAL at this SHA (the under-review packages, imported from the reviewed
 * worktree via G8R5_PACKAGES_DIR):
 *   - FileStorageSeam over G8R5_DATA_DIR + createTeamDomain (durable world)
 *   - parseBlueprint + createBlueprintCatalog (P6T2 blueprint, one revision)
 *   - createActivationProvider (P6-T1) over the R28 fakes
 *     (FakeAgentSetupSurface / FakeSessionDurability / FakeChildSessionFactory)
 *   - createTeamRuntime (P6-T2) — the async admission facade, AWAITED here
 *   - createProjectionService (P8-T2) over a live read-port (g8s1 stand-in
 *     pattern, generalized + live compatibility block)
 *   - MutationService (P7-T2) over an in-memory store + a revocable
 *     subclass (audit-preserving reset; no durable mutation adapter exists
 *     at this SHA — documented boundary)
 *   - createLifecycleService (P7-T3) over the P7T3 fakes + real commit
 *   - createHandoffService (P7-T5) over the P7T5 fakes
 *     (FakeSourceSurface / FakeSummarizer / FakeTeamCreation — R28)
 *   - createCompatibilityProber (P7-T1) — async, AWAITED here
 *   - inspectLegacyTeam (P7-T7) over the real-FS home port
 *
 * DETERMINISM: the clock is frozen at P6T2_NOW for every domain write;
 * the projection clock is frozen at a G8R5 stamp.
 *
 * Plain .mjs harness code (not a tracked package module); node: builtins
 * allowed. Loaded by world-worker.mjs AFTER the ts-loader register.
 * @module g8r5-harness/world-build
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const PKG = process.env.G8R5_PACKAGES_DIR
const DATA_DIR = process.env.G8R5_DATA_DIR

if (typeof PKG !== 'string' || PKG.length === 0) {
  throw new Error('world-build: G8R5_PACKAGES_DIR is not set')
}
if (typeof DATA_DIR !== 'string' || DATA_DIR.length === 0) {
  throw new Error('world-build: G8R5_DATA_DIR is not set')
}

const P = (rel) => pathToFileURL(join(PKG, rel)).href

/** The frozen projection produced-at stamp (the service clock). */
const G8R5_GENERATED_AT = '2026-08-31T18:00:00.000Z'

/** The default workspace bound to the fresh G8-R5 root. */
const G8R5_DEFAULT_WORKSPACE = 'C:/agent-team/work/g8r5'

function typedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

// The P7-T2 InMemoryMutationStore class (assigned once, after the dynamic
// import resolves — the revocable subclass is then defined inside
// buildWorld, where the class is in scope).
let InMemoryMutationStoreRef = null

export async function buildWorld() {
  // ------------------------------------------------------------- imports
  const [
    fileSeamMod,
    repositoriesMod,
    blueprintMod,
    compatEngineMod,
    contractsMod,
    activationMod,
    p5t1Mod,
    p5t6Mod,
    p6t1Mod,
    p6t2Mod,
    p7t2Mod,
    p7t3Mod,
    p7t5Mod,
    binderMod,
    rootBindingMod,
    routerMod,
    mutationMod,
    projectionServiceMod,
    lifecycleMod,
    handoffMod,
    compatProberMod,
    legacyMod,
    legacyFsMod,
    provisioningMod,
  ] = await Promise.all([
    import(P('testkit/fault-injection/file-seam.mjs')),
    import(P('storage/repositories/index.js')),
    import(P('domain/blueprint/src/index.js')),
    import(P('domain/compatibility/src/index.js')),
    import(P('contracts/src/index.js')),
    import(P('runtime/activation/index.js')),
    import(P('runtime/test/p5t1-helpers.js')),
    import(P('runtime/test/p5t6-helpers.js')),
    import(P('runtime/test/p6t1-helpers.js')),
    import(P('runtime/test/p6t2-helpers.js')),
    import(P('runtime/test/p7t2-helpers.js')),
    import(P('runtime/test/p7t3-helpers.js')),
    import(P('runtime/test/p7t5-helpers.js')),
    import(P('runtime/agent-setup/binder/index.js')),
    import(P('runtime/root-binding/index.js')),
    import(P('runtime/action-router/index.js')),
    import(P('runtime/mutation/index.js')),
    import(P('runtime/projection/service.js')),
    import(P('runtime/lifecycle/index.js')),
    import(P('runtime/handoff/index.js')),
    import(P('runtime/compatibility/index.js')),
    import(P('legacy/session-reader/index.js')),
    import(P('legacy/session-reader/e2e/fs-seam.mjs')),
    import(P('storage/provisioning/index.js')),
  ])

  InMemoryMutationStoreRef = p7t2Mod.InMemoryMutationStore
  if (InMemoryMutationStoreRef === undefined) {
    throw new Error('world-build: p7t2 helpers lack InMemoryMutationStore')
  }

  /**
   * The in-memory P7-T2 mutation store extended with audit-preserving
   * revocation: `revoke` keeps the record in the internal map but filters
   * it out of `listRecords` (reset semantics of the Remote contract D-7).
   * No durable mutation adapter exists at this SHA (documented boundary).
   */
  const G8r5RevocableStore = class extends InMemoryMutationStoreRef {
    constructor() {
      super()
      this.revoked = new Set()
    }
    revoke(teamSessionId, recordId) {
      this.revoked.add(`${String(teamSessionId)}::${String(recordId)}`)
    }
    isRevoked(teamSessionId, recordId) {
      return this.revoked.has(`${String(teamSessionId)}::${String(recordId)}`)
    }
    listRecords(teamSessionId) {
      return super.listRecords(teamSessionId).filter(
        (record) => !this.isRevoked(teamSessionId, record.recordId),
      )
    }
  }

  const { FileStorageSeam } = fileSeamMod
  const { createTeamDomain } = repositoriesMod
  const { parseBlueprint, createBlueprintCatalog } = blueprintMod
  const { evaluateCompatibility } = compatEngineMod
  const { parseTeamSessionId, parseRootSessionId, parseBlueprintId } = contractsMod
  const { createActivationProvider } = activationMod
  const { FakeAgentSetupSurface } = p5t1Mod
  const { FakeSessionDurability } = p5t6Mod
  const {
    FakeChildSessionFactory,
    makeEnvironmentFacts,
    makeExternalPolicyFacts,
    LEADER_INSTANCE_ID,
  } = p6t1Mod
  const { P6T2_BLUEPRINT_SOURCE, P6T2_NOW } = p6t2Mod
  const { FakeStepClock, FakePolicyReader } = p7t2Mod
  const {
    P7T3Clock,
    P7T3AdmissionFake,
    P7T3ActivityFake,
    P7T3DescendantsFake,
    P7T3ResidencyFake,
    P7T3CommitFake,
  } = p7t3Mod
  const { FakeSourceSurface, FakeSummarizer, FakeTeamCreation } = p7t5Mod
  const { createTeamDomainReadHandle, TeamAgentBinder } = binderMod
  const { createTeamDomainWritePort, RootBindingError, ROOT_BINDING_ERROR_CODES } = rootBindingMod
  const { createTeamRuntime } = routerMod
  const { MutationService } = mutationMod
  const { createProjectionService } = projectionServiceMod
  const { createLifecycleService } = lifecycleMod
  const { createHandoffService } = handoffMod
  const { createCompatibilityProber, compatibilityRequirementsOf } = compatProberMod
  const { inspectLegacyTeam } = legacyMod
  const { createRealFsHomePort } = legacyFsMod
  const { PROVISION_INTENT_TYPE } = provisioningMod

  // ----------------------------------------------------------- world core
  mkdirSync(DATA_DIR, { recursive: true })
  const seam = new FileStorageSeam(DATA_DIR)
  const domain = await createTeamDomain(seam)
  const repositories = domain.repositories

  const blueprint = parseBlueprint(P6T2_BLUEPRINT_SOURCE)
  const catalog = createBlueprintCatalog([blueprint])

  const surface = new FakeAgentSetupSurface()
  const durability = new FakeSessionDurability()
  const childFactory = new FakeChildSessionFactory()
  const environmentFacts = async () => makeEnvironmentFacts()
  const externalPolicyFacts = async () => makeExternalPolicyFacts()
  const now = () => P6T2_NOW

  const provider = createActivationProvider({
    teamDomain: domain,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    childSessionFactory: childFactory,
    sessionDurability: durability,
    surface,
    projectionPublisher: (event) => {
      // The e2e reads durable truth through the projection service; the
      // publisher is a no-op sink (no push transport in this harness).
      void event
    },
  })

  const runtime = createTeamRuntime({
    teamDomain: domain,
    activationProvider: provider,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    now,
  })

  // --------------------------------------------------- mutation (P7-T2)
  const mutationClock = new FakeStepClock()
  const mutationStore = new G8r5RevocableStore()
  const mutationService = new MutationService({
    clock: mutationClock,
    store: mutationStore,
    policy: new FakePolicyReader(),
  })
  /** Last explicitly switched policy state per team (invariant 40: explicit switch only). */
  const policyStateOf = new Map()

  // --------------------------------------------------- lifecycle (P7-T3)
  const lifecycleClock = new P7T3Clock()
  const lifecycleService = createLifecycleService({
    teamDomain: domain,
    commit: new P7T3CommitFake(lifecycleClock, domain),
    admission: new P7T3AdmissionFake(lifecycleClock),
    activity: new P7T3ActivityFake(lifecycleClock),
    descendants: new P7T3DescendantsFake(lifecycleClock),
    residency: new P7T3ResidencyFake(lifecycleClock),
  })

  // ----------------------------------------------------- handoff (P7-T5)
  const sourceSurface = new FakeSourceSurface()
  const handoffService = createHandoffService({
    sourceSurface,
    summarizer: new FakeSummarizer(),
    teamCreation: new FakeTeamCreation(),
    clock: now,
  })

  // ------------------------------------------- compatibility (P7-T1) probers
  const probers = new Map()
  function proberOf(teamSessionId) {
    const team = parseTeamSessionId(String(teamSessionId))
    const cached = probers.get(team)
    if (cached !== undefined) return cached
    const teamRow = repositories.teamSessions.get(team)
    if (teamRow === undefined || teamRow === null) {
      throw typedError('TEAM_SESSION_NOT_FOUND', `no TeamSession '${String(team)}'`)
    }
    const bound = catalog.resolve(
      String(teamRow.blueprint.blueprintId),
      String(teamRow.blueprint.revision),
    )
    const prober = createCompatibilityProber({
      repositories,
      rootSessionId: team,
      blueprint: bound,
      environmentFacts,
      now,
    })
    probers.set(team, prober)
    return prober
  }

  // --------------------------------------------------- projection source
  function contextPolicyOf(template) {
    return template.contextPolicy ?? 'persistent'
  }
  function effectiveConfigOf(defaultWorkspace) {
    // The deterministic four-lane stand-in (g8s1 precedent, documented:
    // the real per-instance resolver is a later task).
    return {
      model: { value: 'qwen3.8-27b', source: 'blueprint', state: 'inherited' },
      workspace: { value: defaultWorkspace, source: 'instance-creation', state: 'locked' },
      permissions: {
        Bash: { value: 'allowed', source: 'policy-state', state: 'inherited' },
        Web: { value: null, source: 'external-hard-policy', state: 'denied' },
      },
      autonomy: { value: 'web-search', source: 'autonomy-overlay', state: 'suppressed' },
    }
  }
  function templateRowsOf(bp) {
    const rows = [
      {
        kind: 'leader',
        templateId: bp.leader.templateId,
        displayName: bp.leader.displayName ?? 'Leader',
        contextPolicy: contextPolicyOf(bp.leader),
      },
    ]
    for (const template of bp.members) {
      rows.push({
        kind: 'member',
        templateId: template.templateId,
        displayName: template.displayName ?? String(template.templateId),
        ...(template.description !== undefined ? { description: template.description } : {}),
        contextPolicy: contextPolicyOf(template),
      })
    }
    return rows
  }
  function memberRowsOf(bp, team, defaultWorkspace) {
    const policyByTemplate = new Map()
    policyByTemplate.set(String(bp.leader.templateId), contextPolicyOf(bp.leader))
    for (const template of bp.members) {
      policyByTemplate.set(String(template.templateId), contextPolicyOf(template))
    }
    const rows = []
    for (const record of repositories.memberInstances.list(team)) {
      const isLeader = String(record.instanceId) === LEADER_INSTANCE_ID
      const templateId = String(record.templateId)
      const contextPolicy = policyByTemplate.get(templateId)
      if (contextPolicy === undefined) {
        throw typedError(
          'PROJECTION_TEMPLATE_POLICY_MISSING',
          `no template contextPolicy for member template '${templateId}'`,
        )
      }
      const row = {
        instanceId: record.instanceId,
        templateId: record.templateId,
        label: record.label,
        lifecycle: record.lifecycle,
        createdAt: record.createdAt,
        contextPolicy,
        effectiveConfig: effectiveConfigOf(defaultWorkspace),
      }
      if (!isLeader) row.childSessionId = record.childSessionId
      if (record.workspace !== undefined) row.workspace = record.workspace
      if (record.groupId !== undefined) row.groupId = record.groupId
      rows.push(row)
    }
    return rows
  }
  /**
   * The documented category assignment (no canonical mapper exists in-repo
   * at this SHA): every ledger entry is assigned to exactly one category
   * so the durable summary invariant totalEntries == sum(byCategory) holds.
   */
  function categoryOf(entry) {
    const factType = String(entry.factType)
    if (factType === PROVISION_INTENT_TYPE) return 'member'
    if (factType === 'member-lifecycle-changed') return 'lifecycle'
    if (factType === 'team-work-admitted') return 'team'
    if (factType === 'team-coordination-recorded') {
      const action =
        entry.payload !== null && typeof entry.payload === 'object' ? entry.payload.action : undefined
      if (action === 'send-message') return 'message'
      if (action === 'report-progress') return 'progress'
      if (action === 'request-control' || action === 'resolve-control') return 'control'
      return 'team'
    }
    return 'team'
  }
  function ledgerEntriesOf(team) {
    const all = repositories.ledger.list()
    const hasRoot = all.length > 0 && typeof all[0].rootSessionId === 'string'
    const entries = hasRoot
      ? all.filter((entry) => entry.rootSessionId === team)
      : all.slice()
    entries.sort((a, b) => a.sequence - b.sequence)
    return entries
  }
  function ledgerSummaryOf(entries) {
    const byCategory = {
      team: 0,
      member: 0,
      lifecycle: 0,
      message: 0,
      control: 0,
      policy: 0,
      compatibility: 0,
      progress: 0,
    }
    let latestSequence = 0
    for (const entry of entries) {
      if (entry.sequence > latestSequence) latestSequence = entry.sequence
      byCategory[categoryOf(entry)] += 1
    }
    return {
      latestSequence,
      totalEntries: entries.length,
      byCategory,
      pendingControlCount: 0,
    }
  }
  function compatBlockOf(team) {
    const row = repositories.compatibility.get(team)
    if (row === undefined || row === null) {
      // No probe has run yet: the g8s1 stand-in block (documented).
      return {
        status: 'OPEN',
        probeGeneration: 1,
        requirementFingerprint: 'req-g8r5',
        environmentFingerprint: 'env-g8r5',
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      }
    }
    const outcomes =
      row.outcomes !== null && typeof row.outcomes === 'object' ? row.outcomes : {}
    const counts = outcomes.counts !== null && typeof outcomes.counts === 'object' ? outcomes.counts : {}
    return {
      status: row.status,
      probeGeneration: row.generation,
      // The durable record carries one combined fingerprint; both cells
      // mirror it (documented mapping of the projection view).
      requirementFingerprint: row.fingerprint,
      environmentFingerprint: row.fingerprint,
      warningCount: typeof counts.warning === 'number' ? counts.warning : 0,
      fatalCount: typeof counts.fatal === 'number' ? counts.fatal : 0,
      acknowledgedWarningCount: Array.isArray(row.acknowledgements) ? row.acknowledgements.length : 0,
    }
  }
  function buildSource(team) {
    const teamRow = repositories.teamSessions.get(team)
    if (teamRow === undefined || teamRow === null) {
      throw typedError('TEAM_SESSION_NOT_FOUND', `no TeamSession '${String(team)}'`)
    }
    const bound = catalog.resolve(
      String(teamRow.blueprint.blueprintId),
      String(teamRow.blueprint.revision),
    )
    return {
      teamSessionId: team,
      blueprint: teamRow.blueprint,
      defaultWorkspace: teamRow.defaultWorkspace,
      createdAt: teamRow.createdAt,
      generation: teamRow.generation,
      root: {
        // The live view of the last explicit policy switch (invariant 40);
        // 'default' until one happens (documented stand-in read).
        policyState: policyStateOf.get(team) ?? 'default',
        admission: 'OPEN',
        compatibility: compatBlockOf(team),
        creationBudgetConsumed: 0,
      },
      templates: templateRowsOf(bound),
      members: memberRowsOf(bound, team, teamRow.defaultWorkspace),
      ledger: ledgerSummaryOf(ledgerEntriesOf(team)),
    }
  }
  const projectionReadPort = {
    readProjectionSource: (team) => buildSource(team),
  }
  const projectionService = createProjectionService(projectionReadPort, null, {
    clock: () => G8R5_GENERATED_AT,
  })

  // ------------------------------------------------- team-create binding
  function bindingPorts() {
    return {
      teamDomain: createTeamDomainReadHandle(repositories),
      // FIX (run #6): createTeamDomainWritePort takes the REPOSITORIES
      // bundle (team-domain.ts L44 TeamDomainRepositories), not the TeamDomain
      // wrapper — passing `domain` made `repositories.teamSessions` undefined
      // and the first put crash with "reading 'put'" (detached promise).
      writes: createTeamDomainWritePort(repositories),
      surface,
      now,
    }
  }

  // ------------------------------------------------------------- ports
  const ports = {
    // -- 1. catalog (pre-creation blueprint discovery)
    // PORT CONTRACT (remote/src/handlers/catalog.ts L23-26): the handler does
    // `const blueprints = deps.list(); return { data: { blueprints } }` — the
    // port returns the BARE ARRAY of blueprint records; the `blueprints` key
    // is added by the handler (RemoteCatalogListValue, contracts/types.ts L28).
    'catalog.list': () =>
      catalog.blueprintIds.map((id) => {
        const revisions = [...catalog.listRevisions(id)]
        return {
          blueprintId: id,
          revisions,
          latest: revisions.length > 0 ? revisions[revisions.length - 1] : null,
        }
      }),
    'catalog.get': (blueprintId, blueprintRevision) => {
      const id = String(blueprintId)
      const resolved =
        blueprintRevision === undefined || blueprintRevision === null
          ? catalog.resolveLatest(id)
          : catalog.resolve(id, String(blueprintRevision))
      return resolved
    },

    // -- 2. intent (pre-creation compatibility probe)
    'intent.probe': (blueprintId, blueprintRevision, environmentFactsParam) => {
      const id = String(blueprintId)
      const resolved =
        blueprintRevision === undefined || blueprintRevision === null
          ? catalog.resolveLatest(id)
          : catalog.resolve(id, String(blueprintRevision))
      const requirements = compatibilityRequirementsOf(resolved)
      const facts = Array.isArray(environmentFactsParam) ? environmentFactsParam : []
      return evaluateCompatibility({ requirements, environmentFacts: facts })
    },

    // -- 3. teamCreate (fresh-root binding / cold-root rehydration)
    // HARNESS BOUNDARY — synchronous composition over the real durable
    // world. The Remote contract v1 ports are SYNCHRONOUS: dispatch.ts:164
    // invokes the category handler without awaiting, and team.ts reads
    // created['path']/'durable'/'bind' synchronously. The P5-T5 orchestrators
    // (bindFreshTeamRoot / rehydrateColdTeamRoot) are async, so calling them
    // would return a Promise where a value object is required and leave a
    // detached promise behind (run #6). On this file-backed seam every side
    // effect of those orchestrators runs SYNCHRONOUSLY at call time (the
    // FileStorageSeam kv `put` body is fully synchronous — see file-seam.mjs
    // L340-344 + L402; the P5-T1 binder is synchronous), so the adapter
    // composes the identical step order over the same real components:
    //   fresh: kind check -> record put (real write port) -> binding put ->
    //          TeamAgentBinder.bindFreshRoot -> {path, durable, bind}
    //   cold:  TeamAgentBinder.rehydrateColdRoot -> read-only durable
    //          observation -> {path, durable, bind}
    // Repository/seam failures throw at call time exactly as they would
    // inside the orchestrators (their typed errors are the source of truth).
    'teamCreate.create': (rootSessionId, blueprintId, blueprintRevision) => {
      const root = parseRootSessionId(String(rootSessionId))
      const bpId = parseBlueprintId(String(blueprintId))
      const ports3 = bindingPorts()
      const readH = ports3.teamDomain
      const writes = ports3.writes
      const lateReject = (label) => (error) => {
        console.error(`g8r5 teamCreate: late ${label} rejection:`, error && error.stack ? error.stack : String(error))
      }
      const existing = readH.getTeamSession(root)
      const existingBinding = readH.getSessionBinding(root)
      if (existing !== undefined && existing !== null) {
        // Cold-root rehydration (read-only durable observation + binder).
        const binder = new TeamAgentBinder({ surface, teamDomain: readH })
        const bind = binder.rehydrateColdRoot(root)
        let durable
        if (bind.noopReason !== 'ordinary') {
          const teamSession = readH.getTeamSession(root)
          const binding = readH.getSessionBinding(root)
          if (teamSession === undefined || binding === undefined || binding.kind !== 'team-root') {
            throw new Error(
              `cold root rehydration of session '${root}' observed a non-team-root durable state after a non-ordinary bind result (binder contract violation)`,
            )
          }
          durable = { teamSession, binding, wrote: false }
        }
        return { path: 'cold-root', durable: durable === undefined ? null : durable, bind }
      }
      // Fresh-root binding (the P5-T5 order, composed synchronously).
      if (existingBinding !== undefined && existingBinding.kind !== 'team-root') {
        throw new RootBindingError(
          ROOT_BINDING_ERROR_CODES.ROOT_BINDING_SESSION_KIND_CONFLICT,
          `fresh team-root binding of session '${root}' requires no binding or a 'team-root' binding`,
          { sessionId: root, foundKind: existingBinding.kind },
        )
      }
      const resolved =
        blueprintRevision === undefined || blueprintRevision === null
          ? catalog.resolveLatest(bpId)
          : catalog.resolve(bpId, String(blueprintRevision))
      const snapshotRef = catalog.snapshotOf(bpId, resolved.revision)
      writes.putTeamSession({
        rootSessionId: root,
        blueprint: snapshotRef,
        createdAt: now(),
        generation: 1,
        defaultWorkspace: G8R5_DEFAULT_WORKSPACE,
      }).catch(lateReject('putTeamSession'))
      const teamSession = readH.getTeamSession(root)
      if (teamSession === undefined) {
        throw new Error(`g8r5 teamCreate: TeamSession record of '${root}' is absent after the synchronous put (seam violation)`)
      }
      let bindingRow
      if (existingBinding === undefined) {
        writes.putSessionBinding({ kind: 'team-root', schemaVersion: 1, sessionId: root }).catch(lateReject('putSessionBinding'))
        bindingRow = readH.getSessionBinding(root)
        if (bindingRow === undefined) {
          throw new Error(`g8r5 teamCreate: team-root binding of '${root}' is absent after the synchronous put (seam violation)`)
        }
      } else {
        bindingRow = existingBinding
      }
      // The reserved LeaderInstance row (invariants 13/14): the roster
      // documents that "the leader's row is owned by the runtime that
      // creates the TeamSession" (domain/member/src/roster.ts L146-149) —
      // in this harness the remote team.create entry is that runtime, so
      // the fresh path materializes it (deterministic child session id;
      // the projection source builder strips it from the leader row,
      // satisfying the projection's leader-no-childSessionId rule).
      // Lifecycle CREATED per the input docs ("normally CREATED").
      repositories.memberInstances.put({
        rootSessionId: root,
        instanceId: String(LEADER_INSTANCE_ID),
        templateId: String(resolved.leader.templateId),
        label: 'Leader',
        childSessionId: 'session-child-g8r5-leader',
        lifecycle: 'CREATED',
        createdAt: now(),
        activityVersion: 1,
      }).catch(lateReject('putLeaderMember'))
      const binder = new TeamAgentBinder({ surface, teamDomain: readH })
      const bind = binder.bindFreshRoot(root)
      return {
        path: 'fresh-root',
        durable: { teamSession, binding: bindingRow, wrote: true },
        bind,
      }
    },

    // -- 4. projection (whole-projection DTO, lag-tolerant generation)
    'projection.project': (teamSessionId) => {
      const team = parseTeamSessionId(String(teamSessionId))
      return projectionService.project(team)
    },

    // -- 5. ledger (durable entries, sequence-ascending)
    'ledger.listEntries': (teamSessionId) => ledgerEntriesOf(String(teamSessionId)),
    'ledger.countEntries': (teamSessionId) => ledgerEntriesOf(String(teamSessionId)).length,

    // -- 6. admission (the real P6-T2 facade, AWAITED by the worker)
    'admission.performAction': async (request) => {
      if (request === null || typeof request !== 'object') {
        throw typedError('MALFORMED_ADMISSION_REQUEST', 'admission request must be an object')
      }
      const mapped = {
        rootSessionId: request.rootSessionId,
        action: request.action,
        caller: request.caller,
        requestToken: request.requestToken,
      }
      if (request.targetInstanceId !== undefined) mapped.targetInstanceId = request.targetInstanceId
      if (request.delegationTemplateId !== undefined) {
        mapped.delegationTemplateId = request.delegationTemplateId
      }
      if (request.delegationInstanceId !== undefined) {
        mapped.delegationInstanceId = request.delegationInstanceId
      }
      // The runtime action contract carries the action fields in `payload`
      // (no top-level body/subject); fold the wire-level send fields in.
      const payload = { ...(request.payload !== undefined && request.payload !== null ? request.payload : {}) }
      if (request.action === 'send-message') {
        if (request.targetInstanceId !== undefined) {
          payload.recipientInstanceId = request.targetInstanceId
        }
        if (request.body !== undefined) payload.body = request.body
        if (request.subject !== undefined) payload.subject = request.subject
      }
      if (Object.keys(payload).length > 0) mapped.payload = payload
      return runtime.performAction(mapped)
    },

    // -- 7. lifecycle (P7-T3 over the real domain)
    'lifecycle.archive': (teamSessionId, instanceId) =>
      lifecycleService.archiveMember({
        rootSessionId: parseTeamSessionId(String(teamSessionId)),
        instanceId: String(instanceId),
      }),
    'lifecycle.restore': (teamSessionId, instanceId) =>
      lifecycleService.restoreMember({
        rootSessionId: parseTeamSessionId(String(teamSessionId)),
        instanceId: String(instanceId),
      }),
    'lifecycle.dispose': (teamSessionId, instanceId) =>
      lifecycleService.disposeMember({
        rootSessionId: parseTeamSessionId(String(teamSessionId)),
        instanceId: String(instanceId),
      }),

    // -- 8. override (P7-T2 mutation service + revocable in-memory store)
    'override.get': (teamSessionId, capability, scope, targetInstanceId) => {
      const team = parseTeamSessionId(String(teamSessionId))
      const wantScope = scope ?? 'team'
      const records = mutationStore.listRecords(team)
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const record = records[i]
        if (record.values === null || typeof record.values !== 'object') continue
        if (record.values[capability] === undefined) continue
        if (record.scope !== wantScope) continue
        if (
          targetInstanceId !== undefined &&
          record.targetMember !== undefined &&
          record.targetMember !== null &&
          String(record.targetMember.instanceId) !== String(targetInstanceId)
        ) {
          continue
        }
        return record
      }
      return null
    },
    'override.set': (request) => {
      const team = parseTeamSessionId(String(request.teamSessionId))
      return mutationService.requestMutation({
        teamSessionId: team,
        capability: String(request.capability),
        value: request.value,
        actor: String(request.actor),
        scope: request.scope ?? 'team',
        ...(request.targetInstanceId !== undefined
          ? {
              targetMember: {
                rootSessionId: team,
                instanceId: String(request.targetInstanceId),
              },
            }
          : {}),
      })
    },
    'override.reset': (request) => {
      const team = parseTeamSessionId(String(request.teamSessionId))
      const records = mutationStore.listRecords(team)
      for (let i = records.length - 1; i >= 0; i -= 1) {
        const record = records[i]
        if (record.values === null || typeof record.values !== 'object') continue
        if (record.values[request.capability] === undefined) continue
        if ((record.scope ?? 'team') !== (request.scope ?? 'team')) continue
        if (
          request.targetInstanceId !== undefined &&
          record.targetMember !== undefined &&
          record.targetMember !== null &&
          String(record.targetMember.instanceId) !== String(request.targetInstanceId)
        ) {
          continue
        }
        mutationStore.revoke(team, record.recordId)
        return { removed: true }
      }
      return { removed: false }
    },

    // -- 9. policyState (P7-T2 mutation service; explicit switch only)
    'policyState.read': (teamSessionId) => {
      const team = parseTeamSessionId(String(teamSessionId))
      return { stateId: policyStateOf.get(team) ?? 'default' }
    },
    'policyState.switchState': (request) => {
      const team = parseTeamSessionId(String(request.teamSessionId))
      const transition = mutationService.switchPolicyState({
        teamSessionId: team,
        target: request.target,
        actor: String(request.actor),
      })
      policyStateOf.set(team, String(request.target))
      return transition
    },

    // -- 10. compatibility (the real P7-T1 prober, AWAITED by the worker)
    'compatibility.current': (teamSessionId) => {
      const team = parseTeamSessionId(String(teamSessionId))
      const row = repositories.compatibility.get(team)
      return row === undefined ? null : row
    },
    'compatibility.acknowledge': (teamSessionId, requirementId, acknowledgedBy, note) =>
      proberOf(teamSessionId).acknowledge({
        requirementId: String(requirementId),
        acknowledgedBy: String(acknowledgedBy),
        ...(note !== undefined ? { note: String(note) } : {}),
      }),
    'compatibility.probe': (teamSessionId, trigger) =>
      proberOf(teamSessionId).probe(String(trigger)),

    // -- 11. handoff (P7-T5 service over the R28 fakes)
    'handoff.prepareSource': async (sourceSessionId) =>
      sourceSurface.readCanonicalSurface(String(sourceSessionId)),
    'handoff.start': (sourceSessionId, requestToken, staged) =>
      handoffService.startTeamFromHere({
        sourceSessionId: String(sourceSessionId),
        requestToken: String(requestToken),
        ...(staged !== undefined ? { staged } : {}),
      }),

    // -- 12. legacy (P7-T7 read-only inspection over the real-FS port)
    'legacy.inspect': (dshHome, workspaceCwd, projectDir) =>
      inspectLegacyTeam(createRealFsHomePort(), {
        dshHome: String(dshHome),
        ...(workspaceCwd !== undefined ? { workspaceCwd: String(workspaceCwd) } : {}),
        ...(projectDir !== undefined ? { projectDir: String(projectDir) } : {}),
      }),
  }

  return {
    ports,
    world: {
      domain,
      repositories,
      catalog,
      provider,
      runtime,
      projectionService,
      mutationService,
      lifecycleService,
      handoffService,
      seam,
    },
  }
}
