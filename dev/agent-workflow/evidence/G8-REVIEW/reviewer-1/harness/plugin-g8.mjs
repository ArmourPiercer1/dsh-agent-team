/**
 * plugin-g8.mjs — G8-REVIEW reviewer-1 e2e row (the Remote contract v1 over
 * the real TeamDomain stack, installed on the pristine test-use instance).
 *
 * The row is the "later P8 harness task" that register.ts defers: it builds
 * the twelve-port dependency surface over the real vNext packages and
 * installs `registerRemoteHandlers` as a caller-fiber effect on the public
 * `/team-remote` RPC channel.
 *
 * What is REAL here (imported as .ts file URLs from the reviewed worktree):
 *   - storage: the host `storageDomain` service -> StorageDomainSeam (the
 *     tracked P5-T5 adapter, copied to seam.mjs) -> createTeamDomain (the
 *     real on-disk TeamDomain under the fresh DSH_HOME);
 *   - projection: createProjectionService (P8-T2) over the H1 source
 *     adapter (real repository reads, real fold, real P8-T1 DTO pipeline);
 *   - ledger: the real LedgerRepository (synchronous list/get) behind a
 *     rootSessionId filtering adapter;
 *   - admission: the real facade's synchronous pipeline steps 1-5
 *     (validateActionRequest / resolveTeamAndTarget / resolveCaller /
 *     checkCallerRoleAuthority / callerEnvelope + enforceEnvelope /
 *     enforceCompatibilityGate — all real exported functions) plus the
 *     durable fact commit through the real ledger repository (H5);
 *   - remote: the real dispatcher + handlers + registerRemoteHandlers.
 *
 * Harness duties (documented in g8-report.md; the repo defers ALL of the
 * host wiring to a later P8 harness task, so every bridge below is a
 * reviewer-side duty, not a repo defect of the remote layer):
 *
 *   H1 — source adapter. No production TeamDomainReadPort implementation
 *        exists at this SHA. The row assembles the bounded
 *        TeamDomainProjectionSource from the real repositories (synchronous
 *        reads): the TeamSession record, the real catalog-resolved
 *        blueprint (template rows), the member rows, the derived ledger
 *        summary, and the documented root-facts constants.
 *   H2 — generation bump. The TeamSession record is WRITE-ONCE in the
 *        store (teamSessions.put raises RECORD_DUPLICATE for a different
 *        record at an occupied key), and no production code bumps the
 *        whole-projection generation. The row bumps it through the H6
 *        mirror layer (the only layer that can override a durable row
 *        read): after every admitted durable effect the team_sessions
 *        mirror row is re-serialized at generation+1. The bump is
 *        in-process (the underlying host store keeps the seed generation)
 *        — at this SHA there is no durable generation-owner; that gap is
 *        reported.
 *   H3 — effectiveConfig. No v1 durable owner for the four-lane effective
 *        configuration view; the row carries a structurally valid view
 *        (the frozen P8-T2 fixture shape) per member.
 *   H4 — ledger byCategory. No canonical factType->category function in
 *        the repo; the row derives the DurableLedgerSummary at read time
 *        with the documented mapping (coordination facts are classified by
 *        their payload action).
 *   H5 — synchronous admission executor. The Remote port surface is
 *        synchronous (ports.ts: "the port methods are synchronous") while
 *        the real TeamRuntime facade is asynchronous (router.ts:
 *        `async function performAction`). A direct wiring is impossible
 *        (the dispatcher never awaits the category handler). The row runs
 *        the real facade's synchronous steps 1-5 unmodified and commits
 *        the send-message / follow-up durable facts itself through the
 *        real ledger repository. create-member (the async
 *        ActivationProvider path) is NOT hostable on the sync surface and
 *        reports a typed harness code if exercised.
 *   H6 — synchronous-visibility seam. The storage repositories are
 *        promise-based (put/allocate/update await the seam) while the
 *        remote read paths and the executor are synchronous. The row
 *        wraps every host KvTable with an in-memory mirror that is updated
 *        synchronously inside put/delete/update, so an unawaited durable
 *        write is synchronously visible to the synchronous reads;
 *        durability continues on the real host store (every underlying
 *        promise is tracked and counted in the health route).
 *
 * The nine ports the G8 e2e scenarios do not exercise (catalog, intent,
 * teamCreate, lifecycle, override, policyState, compatibility, handoff,
 * legacy) are typed-error stubs: any call throws a typed error with its
 * own string code, which the real dispatcher passes through (invariant 4)
 * — a visible canary if a scenario ever reaches them.
 *
 * Plain .mjs (harness plumbing). The repo TS entry points are imported as
 * explicit .ts file URLs (Node native type stripping); the tracked
 * ts-loader hook still rewrites the intra-package relative .js specifiers
 * (its gate covers parents under <worktree>/packages/).
 */

import { register } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const HOME = process.env.DSH_HOME
const directive = JSON.parse(readFileSync(join(HOME, 'g8-directive.json'), 'utf8'))
const WORKTREE = directive.worktree
const ROOT_SESSION_ID = directive.teamSessionId

// The tracked ts-loader hook (packages/runtime/root-binding/harness)
// rewrites relative .js -> .ts for parents under <worktree>/packages.
// Register it BEFORE the first dynamic import (P5-T5 pattern).
const TS_LOADER = pathToFileURL(join(WORKTREE, 'packages/runtime/root-binding/harness/ts-loader.mjs')).href
register(TS_LOADER, import.meta.url)

/** Import one repo TS entry point by worktree-relative path. */
const repo = (rel) => pathToFileURL(join(WORKTREE, rel)).href

export const name = 'g8r1-remote-e2e'
export const inject = ['connection', 'webServer', 'storageDomain']

/** One scenario fact timestamp (the deterministic harness clock). */
const NOW = '2026-08-30T09:00:00Z'

export function apply(ctx) {
  const state = {
    ready: false,
    error: null,
    teamSessionId: ROOT_SESSION_ID,
    generation: 1,
    durability: { pending: 0, settled: 0, failed: 0 },
  }

  // ── health route (plain fetch, no cookie; P2-T6 / P5-T5 pattern) ─────────
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/__g8r1/health',
    handler: (req, res) => {
      const payload = JSON.stringify({
        ready: state.ready,
        error: state.error,
        teamSessionId: state.teamSessionId,
        generation: state.generation,
        durability: { ...state.durability },
      })
      res.writeHead(200, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
      res.end(payload)
    },
  }), 'g8r1: health route')

  run(ctx, state).catch((error) => {
    state.error = error && error.stack ? String(error.stack) : String(error)
    try {
      mkdirSync(join(HOME, 'harness-output'), { recursive: true })
      writeFileSync(
        join(HOME, 'harness-output', 'setup-failure.json'),
        JSON.stringify({ row: name, teamSessionId: state.teamSessionId, error: state.error }, null, 2),
      )
    } catch {
      // best effort only — the health route still reports the failure
    }
  })
}

async function run(ctx, state) {
  // ── real modules (explicit .ts file URLs; the hook handles the rest) ────
  const [seamMod, contracts, blueprintDomain, storage, storageSchema, admission, projection, remote, p6t1] =
    await Promise.all([
      import(new URL('./seam.mjs', import.meta.url).href),
      import(repo('packages/contracts/src/index.ts')),
      import(repo('packages/domain/blueprint/src/index.ts')),
      import(repo('packages/storage/repositories/index.ts')),
      import(repo('packages/storage/schema/index.ts')),
      import(repo('packages/runtime/admission/index.ts')),
      import(repo('packages/runtime/projection/index.ts')),
      import(repo('packages/remote/src/index.ts')),
      import(repo('packages/runtime/test/p6t1-helpers.ts')),
    ])

  // ── H6: the synchronous-visibility mirror over the real host storage ────
  const hostSeam = seamMod.createRealStorageDomainSeam(ctx.get('storageDomain'))
  const mirrors = new Map() // tableName -> Map<string, unknown>
  const trackDurability = (promise) => {
    state.durability.pending += 1
    Promise.resolve(promise).then(
      () => { state.durability.settled += 1 },
      () => { state.durability.failed += 1 },
    )
    return promise
  }
  const mirrorSeam = {
    async open(spec) {
      const domain = await hostSeam.open(spec)
      const wrapped = new Map()
      for (const tableName of spec.tables) {
        const base = domain.table(tableName)
        const mirror = new Map()
        mirrors.set(tableName, mirror)
        const mergedKeys = () => {
          const keys = new Set()
          for (const key of base.keys()) keys.add(key)
          for (const key of mirror.keys()) keys.add(key)
          return keys
        }
        wrapped.set(tableName, {
          get: (key) => (mirror.has(key) ? mirror.get(key) : base.get(key)),
          entries: () => {
            const merged = new Map()
            for (const [key, value] of base.entries()) merged.set(key, value)
            for (const [key, value] of mirror) merged.set(key, value)
            return merged[Symbol.iterator]()
          },
          keys: () => mergedKeys()[Symbol.iterator](),
          get size() { return mergedKeys().size },
          put: (key, value) => {
            mirror.set(key, value)
            return trackDurability(base.put(key, value))
          },
          delete: (key) => {
            mirror.delete(key)
            return trackDurability(base.delete(key))
          },
          update: (key, fn) => {
            const current = mirror.has(key) ? mirror.get(key) : base.get(key)
            if (current === undefined) {
              const error = new Error(`missing key '${key}'`)
              error.code = 'missing-key'
              return Promise.reject(error)
            }
            const next = fn(current)
            mirror.set(key, next)
            // seam contract (packages/storage/schema/seam.ts:77-83): update
            // resolves to the STORED NEXT VALUE (put resolves void) — the
            // repositories validate the returned bytes (ledger.ts:83).
            return trackDurability(base.put(key, next)).then(() => next)
          },
        })
      }
      return {
        name: domain.name,
        table: (tableName) => wrapped.get(tableName),
        close: () => domain.close(),
      }
    },
    closeAll: () => hostSeam.closeAll(),
  }

  // ── the real TeamDomain over the mirrored host storage ───────────────────
  const domain = await storage.createTeamDomain(mirrorSeam)
  ctx.effect(() => () => { domain.close().catch(() => {}) }, 'g8r1: team domain close')
  const repos = domain.repositories

  // ── seed the durable team (canonical p6t1 fixture, real store writes) ────
  const blueprintDoc = p6t1.parseFixtureBlueprint()
  const catalog = p6t1.createP6T1Catalog()
  const envFacts = await p6t1.makeEnvironmentFacts()
  const WORKER_INSTANCE_ID = 'inst-g8r1w1'
  const WORKER_CHILD_SESSION_ID = 'session-child-g8r1w1'
  const TEAM_DEFAULT_WORKSPACE = 'C:/agent-team/work/g8r1'

  await repos.teamSessions.put({
    rootSessionId: ROOT_SESSION_ID,
    blueprint: contracts.createBlueprintSnapshotRef({
      blueprintId: contracts.parseBlueprintId(String(blueprintDoc.blueprintId)),
      revision: contracts.parseBlueprintRevision(String(blueprintDoc.revision)),
      contentHash: contracts.parseBlueprintContentHash(String(blueprintDoc.contentHash)),
    }),
    defaultWorkspace: TEAM_DEFAULT_WORKSPACE,
    createdAt: '2026-08-30T08:00:00Z',
    generation: 1,
  })
  await repos.sessionBindings.put({
    kind: 'team-root',
    schemaVersion: 1,
    sessionId: ROOT_SESSION_ID,
  })
  await repos.memberInstances.put({
    rootSessionId: ROOT_SESSION_ID,
    instanceId: contracts.parseInstanceId(String(contracts.LEADER_INSTANCE_ID)),
    templateId: contracts.parseTemplateId(String(blueprintDoc.leader.templateId)),
    label: 'Leader',
    childSessionId: contracts.parseChildSessionId(ROOT_SESSION_ID),
    lifecycle: 'RUNNING',
    createdAt: '2026-08-30T08:00:00Z',
    activityVersion: 1,
  })
  await repos.memberInstances.put({
    rootSessionId: ROOT_SESSION_ID,
    instanceId: contracts.parseInstanceId(WORKER_INSTANCE_ID),
    templateId: contracts.parseTemplateId(String(blueprintDoc.members[0].templateId)),
    label: 'Worker-1',
    childSessionId: contracts.parseChildSessionId(WORKER_CHILD_SESSION_ID),
    lifecycle: 'RUNNING',
    createdAt: '2026-08-30T08:00:00Z',
    activityVersion: 1,
  })
  await repos.compatibility.put({
    schemaVersion: 1,
    rootSessionId: ROOT_SESSION_ID,
    status: 'BLOCKED_FATAL',
    fingerprint: 'fp-g8r1-env',
    generation: 1,
    outcomes: { fatal: ['skill:base'] },
    acknowledgements: [],
    computedAt: '2026-08-30T08:00:00Z',
  })

  // Seven seeded ledger facts (the H4 mapping covers every factType used).
  const humanCaller = { kind: 'human', humanId: 'g8r1-reviewer' }
  const seededFacts = [
    { factType: 'team-created', payload: { action: 'create-team', blueprintId: String(blueprintDoc.blueprintId), at: NOW } },
    { factType: 'member-registered', payload: { action: 'create-member', instanceId: String(contracts.LEADER_INSTANCE_ID), childSessionId: ROOT_SESSION_ID, at: NOW } },
    { factType: 'member-registered', payload: { action: 'create-member', instanceId: WORKER_INSTANCE_ID, childSessionId: WORKER_CHILD_SESSION_ID, at: NOW } },
    { factType: 'team-coordination-recorded', payload: { action: 'send-message', caller: humanCaller, targetInstanceId: WORKER_INSTANCE_ID, recipientInstanceId: WORKER_INSTANCE_ID, body: 'seed message', at: NOW } },
    { factType: 'team-coordination-recorded', payload: { action: 'request-control', caller: humanCaller, targetInstanceId: WORKER_INSTANCE_ID, at: NOW } },
    { factType: 'team-coordination-recorded', payload: { action: 'report-progress', caller: humanCaller, targetInstanceId: WORKER_INSTANCE_ID, progress: 'in-progress', at: NOW } },
    { factType: 'member-lifecycle-changed', payload: { action: 'admit-work', instanceId: WORKER_INSTANCE_ID, from: 'CREATED', to: 'RUNNING', at: NOW } },
  ]
  for (const fact of seededFacts) {
    const sequence = await repos.ledger.allocateSequence()
    await repos.ledger.put({
      schemaVersion: 1,
      sequence,
      rootSessionId: ROOT_SESSION_ID,
      factType: fact.factType,
      payload: fact.payload,
      createdAt: NOW,
    })
  }

  // ── H2: the generation bump (mirror-override of the write-once row) ─────
  function bumpGeneration(rootSessionId) {
    const record = repos.teamSessions.get(String(rootSessionId))
    if (record === undefined) return
    const next = contracts.createTeamSessionRecord({
      rootSessionId: record.rootSessionId,
      blueprint: record.blueprint,
      ...(record.defaultWorkspace !== undefined ? { defaultWorkspace: record.defaultWorkspace } : {}),
      createdAt: record.createdAt,
      generation: record.generation + 1,
    })
    const mirrorRow = mirrors.get('team_sessions')
    if (mirrorRow === undefined) return
    mirrorRow.set(String(record.rootSessionId), contracts.serializeTeamSessionRecord(next))
    // keep the health route's generation live (state.generation is a setup
    // snapshot otherwise; the base row stays gen 1 by design — H2)
    state.generation = Number(next.generation)
  }

  // ── H5: the synchronous admission executor (real steps 1-5, real writes) ─
  const COUNTER_KEY = storageSchema.LEDGER_SEQUENCE_COUNTER_KEY
  function commitFactSync(rootSessionId, factType, payload) {
    // allocateSequence runs its counter update synchronously inside the
    // H6 mirror before the promise resolves; the new counter is therefore
    // readable synchronously (the durability promise is tracked).
    trackDurability(repos.ledger.allocateSequence())
    const counterRaw = mirrors.get('ledger').get(COUNTER_KEY)
    const sequence = Number(JSON.parse(String(counterRaw)).value)
    const entry = {
      schemaVersion: 1,
      sequence,
      rootSessionId,
      factType,
      payload,
      createdAt: NOW,
    }
    trackDurability(repos.ledger.put(entry))
    const stored = repos.ledger.get(sequence)
    if (stored === undefined || Number(stored.sequence) !== sequence) {
      const error = new Error(`G8-R1 harness: ledger entry ${sequence} read-back mismatch (sync visibility broken)`)
      error.code = 'G8R1_SYNC_VISIBILITY_BROKEN'
      throw error
    }
    return sequence
  }
  function callerRef(caller) {
    if (caller.role === 'human') {
      return { kind: 'human', humanId: caller.humanId }
    }
    return { kind: 'instance', instanceId: caller.callerMember === undefined ? undefined : caller.callerMember.instanceId, role: caller.role }
  }
  function requireLiveTargetSync(rootSessionId, target) {
    const fresh = repos.memberInstances.get(String(rootSessionId), String(target.instanceId))
    if (fresh === undefined) {
      throw new admission.TeamRuntimeError(
        admission.TEAM_RUNTIME_ERROR_CODES.INSTANCE_NOT_FOUND,
        `TeamRuntime: target '${String(target.instanceId)}' no longer exists (fresh view)`,
        { rootSessionId: String(rootSessionId), instanceId: String(target.instanceId) },
      )
    }
    admission.enforceWorkAcceptingState(fresh.lifecycle)
    return fresh
  }
  function performActionSync(request) {
    // Steps 1-5 — the real facade pipeline (unmodified exported functions).
    const spec = admission.validateActionRequest(request)
    const resolved = admission.resolveTeamAndTarget(repos, catalog, request, spec)
    const rootSessionId = String(resolved.rootSessionId)
    const blueprint = resolved.bound.blueprint
    const caller = admission.resolveCaller(repos, rootSessionId, request.caller)
    admission.checkCallerRoleAuthority(spec, caller)
    const overrides = repos.overrides.list(rootSessionId)
    const envelope = admission.callerEnvelope(blueprint, caller, overrides)
    admission.enforceEnvelope(spec, envelope)
    if (admission.isNewWorkAdmission(spec)) {
      admission.enforceCompatibilityGate(repos, blueprint, rootSessionId, envFacts)
    }

    // Step 6 — the durable effect (harness-synchronous, real repositories).
    let effect
    if (spec.name === 'send-message') {
      const fresh = requireLiveTargetSync(rootSessionId, resolved.target)
      const recipientToken = String((request.payload && request.payload['recipientInstanceId']) ?? '')
      const recipient = admission.resolveInstanceToken(repos, rootSessionId, blueprint, recipientToken, spec.name)
      const payload = {
        action: spec.name,
        caller: callerRef(caller),
        targetInstanceId: String(fresh.instanceId),
        recipientInstanceId: String(recipient.instanceId),
      }
      for (const field of ['subject', 'body']) {
        const value = request.payload && request.payload[field]
        if (typeof value === 'string') payload[field] = value
      }
      if (request.requestToken !== undefined) payload['requestToken'] = request.requestToken
      payload['at'] = NOW
      const sequence = commitFactSync(rootSessionId, 'team-coordination-recorded', payload)
      effect = { kind: 'fact-recorded', factType: 'team-coordination-recorded', sequence }
    } else if (spec.name === 'follow-up') {
      const fresh = requireLiveTargetSync(rootSessionId, resolved.target)
      if (String(fresh.lifecycle) !== 'RUNNING') {
        // P6-T2 default wiring: no lifecycle commit port; a non-RUNNING
        // work target cannot be transitioned (fail closed, zero writes).
        throw new admission.TeamRuntimeError(
          admission.TEAM_RUNTIME_ERROR_CODES.LIFECYCLE_COMMIT_UNAVAILABLE,
          `TeamRuntime: no lifecycle commit port is wired (P6-T2 default); work target '${String(fresh.instanceId)}' is ${String(fresh.lifecycle)}`,
          { rootSessionId, instanceId: String(fresh.instanceId), from: String(fresh.lifecycle) },
        )
      }
      const payload = {
        action: spec.name,
        caller: callerRef(caller),
        targetInstanceId: String(fresh.instanceId),
        childSessionId: String(fresh.childSessionId),
        fromLifecycle: String(fresh.lifecycle),
        lifecycleCommitted: false,
      }
      const taskSummary = request.payload && request.payload['taskSummary']
      if (typeof taskSummary === 'string') payload['taskSummary'] = taskSummary
      if (request.requestToken !== undefined) payload['requestToken'] = request.requestToken
      payload['at'] = NOW
      const sequence = commitFactSync(rootSessionId, 'team-work-admitted', payload)
      effect = { kind: 'work-admitted', instanceId: String(fresh.instanceId), fromLifecycle: String(fresh.lifecycle), lifecycleCommitted: false, sequence }
    } else {
      // create-member: the ActivationProvider path is asynchronous and
      // cannot be hosted on the synchronous Remote port surface at this
      // SHA (H5). A typed harness code keeps any accidental call visible.
      const error = new Error(
        `G8-R1 harness: action '${spec.name}' requires the async ActivationProvider, which the synchronous Remote port surface cannot host at this SHA (documented H5)`,
      )
      error.code = 'G8R1_ADMISSION_NOT_HOSTED'
      error.details = { action: spec.name }
      throw error
    }

    // H2 — the whole-projection generation advances with the durable effect.
    bumpGeneration(rootSessionId)

    return {
      status: 'executed',
      action: spec.name,
      rootSessionId,
      callerRole: caller.role,
      ...(resolved.target !== undefined ? { targetInstanceId: String(resolved.target.instanceId) } : {}),
      effect,
      requestToken: request.requestToken,
    }
  }

  // ── H1: the bounded projection source adapter (real repository reads) ────
  const EIGHT_CATEGORIES = ['team', 'member', 'lifecycle', 'message', 'control', 'policy', 'compatibility', 'progress']
  function mapFactTypeToCategory(factType, action) {
    switch (factType) {
      case 'team-created': return 'team'
      case 'member-registered': return 'member'
      case 'member-lifecycle-changed': return 'lifecycle'
      case 'team-work-admitted': return 'team'
      case 'team-coordination-recorded':
        switch (action) {
          case 'report-progress': return 'progress'
          case 'request-control': return 'control'
          case 'resolve-control': return 'control'
          default: return 'message'
        }
      default: return 'team'
    }
  }
  function ledgerEntriesOf(rootSessionId) {
    return repos.ledger.list().filter((entry) => String(entry.rootSessionId) === rootSessionId)
  }
  function ledgerSummaryOf(rootSessionId) {
    const entries = ledgerEntriesOf(rootSessionId)
    const byCategory = {}
    for (const category of EIGHT_CATEGORIES) byCategory[category] = 0
    let pendingControl = 0
    for (const entry of entries) {
      const action = entry.payload && typeof entry.payload === 'object' && entry.payload !== null
        ? entry.payload['action']
        : undefined
      byCategory[mapFactTypeToCategory(String(entry.factType), typeof action === 'string' ? action : undefined)] += 1
      if (action === 'request-control') pendingControl += 1
      if (action === 'resolve-control') pendingControl -= 1
    }
    return {
      latestSequence: entries.length > 0 ? Number(entries[entries.length - 1].sequence) : 0,
      totalEntries: entries.length,
      byCategory,
      pendingControlCount: Math.max(0, pendingControl),
    }
  }
  function contextPolicyOfTemplate(blueprint, templateId) {
    if (String(blueprint.leader.templateId) === templateId) {
      return blueprint.leader.contextPolicy ?? 'persistent'
    }
    const member = blueprint.members.find((row) => String(row.templateId) === templateId)
    return member === undefined ? 'persistent' : (member.contextPolicy ?? 'persistent')
  }
  function effectiveConfigFor(member, teamDefaultWorkspace) {
    // H3: structurally valid four-lane view (the frozen P8-T2 fixture
    // shape); no v1 durable owner exists for this view.
    const workspace = member.workspace !== undefined ? String(member.workspace) : String(teamDefaultWorkspace)
    return {
      model: { value: 'qwen3.8-27b', source: 'blueprint', state: 'inherited' },
      workspace: { value: workspace, source: 'instance-creation', state: 'locked' },
      permissions: {
        Bash: { value: 'allowed', source: 'policy-state', state: 'inherited' },
        Web: { value: null, source: 'external-hard-policy', state: 'denied' },
      },
      autonomy: { value: 'web-search', source: 'autonomy-overlay', state: 'suppressed' },
    }
  }
  const sourcePort = {
    readProjectionSource(teamSessionId) {
      const id = String(teamSessionId)
      const record = repos.teamSessions.get(id)
      if (record === undefined) {
        throw new admission.TeamRuntimeError(
          admission.TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
          `TeamRuntime: no TeamSession record for root session '${id}'`,
          { rootSessionId: id },
        )
      }
      // The real catalog resolution (content-hash consistency enforced).
      const blueprint = catalog.resolve(String(record.blueprint.blueprintId), String(record.blueprint.revision))
      const templates = [
        templateRow('leader', blueprint.leader),
        ...blueprint.members.map((member) => templateRow('member', member)),
      ]
      const memberRows = repos.memberInstances.list(id).map((member) => {
        const isLeader = String(member.instanceId) === String(contracts.LEADER_INSTANCE_ID)
        return {
          instanceId: String(member.instanceId),
          templateId: String(member.templateId),
          label: String(member.label),
          ...(member.groupId !== undefined ? { groupId: String(member.groupId) } : {}),
          // childSessionId is ABSENT for the leader (invariant 14).
          ...(isLeader ? {} : { childSessionId: String(member.childSessionId) }),
          ...(member.workspace !== undefined ? { workspace: String(member.workspace) } : {}),
          lifecycle: String(member.lifecycle),
          createdAt: String(member.createdAt),
          contextPolicy: contextPolicyOfTemplate(blueprint, String(member.templateId)),
          effectiveConfig: effectiveConfigFor(member, record.defaultWorkspace),
        }
      })
      const compat = repos.compatibility.get(id)
      const compatibilitySummary = compat === undefined
        ? {
            status: 'OPEN',
            probeGeneration: 0,
            requirementFingerprint: 'none',
            environmentFingerprint: 'none',
            warningCount: 0,
            fatalCount: 0,
            acknowledgedWarningCount: 0,
          }
        : {
            status: String(compat.status),
            probeGeneration: Number(compat.generation),
            requirementFingerprint: String(compat.fingerprint),
            environmentFingerprint: String(compat.fingerprint),
            warningCount: 0,
            fatalCount: String(compat.status) === 'BLOCKED_FATAL' ? 1 : 0,
            acknowledgedWarningCount: compat.acknowledgements === undefined ? 0 : compat.acknowledgements.length,
            lastProbedAt: String(compat.computedAt),
          }
      return {
        teamSessionId: id,
        blueprint: record.blueprint,
        ...(record.defaultWorkspace !== undefined ? { defaultWorkspace: String(record.defaultWorkspace) } : {}),
        createdAt: String(record.createdAt),
        generation: Number(record.generation),
        root: {
          policyState: String(blueprint.policyStates[0].id),
          admission: 'OPEN',
          compatibility: compatibilitySummary,
          creationBudgetConsumed: 0,
        },
        templates,
        members: memberRows,
        ledger: ledgerSummaryOf(id),
      }
    },
  }
  function templateRow(kind, template) {
    // The fixture leader template omits `displayName`; the canonical P8-T2
    // durable row carries a non-empty one ('Leader', p8t2-helpers.ts:160) and
    // the frozen projection DTO rejects an empty string (MALFORMED_DTO). The
    // adapter therefore capitalizes the templateId when the name is absent —
    // yielding exactly the canonical fixture names (Leader/Worker/Scout).
    const rawName = template.displayName !== undefined && template.displayName !== ''
      ? String(template.displayName)
      : String(template.templateId).charAt(0).toUpperCase() + String(template.templateId).slice(1)
    return {
      kind,
      templateId: String(template.templateId),
      displayName: rawName,
      ...(template.description !== undefined ? { description: String(template.description) } : {}),
      contextPolicy: template.contextPolicy ?? 'persistent',
      ...(template.instanceQuota !== undefined ? { instanceQuota: Number(template.instanceQuota) } : {}),
    }
  }

  // ── the twelve-port dependency surface ───────────────────────────────────
  const projectionService = projection.createProjectionService(sourcePort, null, { clock: () => NOW })
  function stubPort(portName) {
    return new Proxy({}, {
      get: (target, prop) => {
        if (typeof prop !== 'string') return undefined
        return () => {
          const error = new Error(
            `G8-R1 harness: the '${portName}' port method '${prop}' is not wired (not exercised by the G8 e2e scenarios E1-E6)`,
          )
          error.code = 'G8R1_PORT_NOT_WIRED'
          error.details = { port: portName, method: prop }
          throw error
        }
      },
    })
  }
  const deps = {
    catalog: stubPort('catalog'),
    intent: stubPort('intent'),
    teamCreate: stubPort('teamCreate'),
    projection: {
      project: (teamSessionId) => projectionService.project(teamSessionId),
    },
    ledger: {
      listEntries: (teamSessionId) => ledgerEntriesOf(String(teamSessionId)),
      countEntries: (teamSessionId) => ledgerEntriesOf(String(teamSessionId)).length,
    },
    admission: {
      performAction: (request) => performActionSync(request),
    },
    lifecycle: stubPort('lifecycle'),
    override: stubPort('override'),
    policyState: stubPort('policyState'),
    compatibility: stubPort('compatibility'),
    handoff: stubPort('handoff'),
    legacy: stubPort('legacy'),
  }

  // ── install the remote handlers (the deferred P8 host wiring) ────────────
  const connection = ctx.get('connection')
  ctx.effect(() => {
    const reg = remote.registerRemoteHandlers(connection, deps)
    return () => reg.dispose()
  }, 'g8r1: team-remote rpc channel')

  // ── ready ────────────────────────────────────────────────────────────────
  state.ready = true
  state.generation = Number(repos.teamSessions.get(ROOT_SESSION_ID).generation)
  const outDir = join(HOME, 'harness-output')
  mkdirSync(outDir, { recursive: true })
  writeFileSync(
    join(outDir, 'row-setup.json'),
    JSON.stringify({
      row: name,
      teamSessionId: ROOT_SESSION_ID,
      channel: remote.REMOTE_RPC_CHANNEL,
      seededLedgerEntries: ledgerEntriesOf(ROOT_SESSION_ID).length,
      generation: state.generation,
      now: NOW,
    }, null, 2),
  )
}
