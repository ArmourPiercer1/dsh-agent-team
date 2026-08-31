// G8-R3 reviewer-3 e2e — Cordis host row (the real-remote-seam wiring).
//
// Mounts the real vNext remote seam into a real DSH web instance:
//
//  1. A real TeamDomain over the real storageDomain seam (fresh DSH_HOME,
//     committed `createRealStorageDomainSeam` reused by relative import —
//     never copied), seeded with one team at generation 1: leader + one
//     worker + one scout (P6-T6 seed shape; no schemaVersion — the
//     repository defaults it).
//  2. The FIRST real `TeamDomainReadPort` implementation: deterministic
//     derivation from durable rows (documented in the G8 report §harness;
//     policyState constant 'default', creationBudgetConsumed constant 0,
//     leader childSessionId omitted per invariant 14, contextPolicy
//     derived from the blueprint because the member record has no such
//     field, deterministic effectiveConfig, ledger summary folded from
//     the global ledger store filtered by rootSessionId).
//  3. All twelve remote ports wired: catalog / projection / ledger /
//     compatibility.current / admission are REAL (synchronous read ports
//     over the real domain; admission via the bridge below). lifecycle /
//     override / policyState / compatibility.ack+probe / handoff /
//     legacy / intent / teamCreate are typed-error stubs (outside the
//     G8 E1-E6 scenario scope; the frozen dispatcher maps them to typed
//     error results, never 500).
//  4. THE FINDING (G8 cross-task combination): the frozen Remote
//     dispatcher (P8-T4) is synchronous end-to-end — it never awaits its
//     ports (ports.ts D-2: "The port methods are synchronous") — but the
//     real TeamRuntime `performAction` is genuinely async (durable writes
//     go through the StorageKvTable promise boundary: enqueue + backend
//     putRecord/update). The two cannot be composed directly at the
//     admission port. The harness therefore registers the RPC channel
//     with a thin async bridge for the single endpoint the e2e mutates
//     (`member.create`): the bridge reuses the frozen
//     `parseRemoteRequest` / `parseRemoteMethodParams` /
//     `buildRemoteSuccess` / `buildRemoteError` and mirrors the frozen
//     dispatcher's invariant order (1 unknown-method [trivially true for
//     the bridged catalog method] / 2 envelope / 3 params / 4-5 typed
//     errors / 6 lossless+provenance) around a real
//     `await runtime.performAction(request)`. Every other endpoint is
//     served by the untouched frozen `createRemoteDispatcher`. This
//     bridge is a harness-level adapter for a contract-level async/sync
//     gap and is reported in the G8 report as a combination finding.
//
//  5. A `/__g8r3/health` route for the boot driver.
//
// Plain JavaScript (the row is not transformed). node: builtins are
// allowed in a Cordis host row (P2-T6 probe precedent).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const HERE = path.dirname(fileURLToPath(import.meta.url))

function findWorktreeRoot(from) {
  let dir = from
  for (let i = 0; i < 16; i += 1) {
    if (
      fs.existsSync(path.join(dir, 'packages', 'remote')) &&
      fs.existsSync(path.join(dir, 'dev', 'agent-workflow'))
    ) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('g8r3 row: cannot locate worktree root from ' + from)
}

const ROOT = findWorktreeRoot(HERE)
const pkgUrl = (rel) => pathToFileURL(path.join(ROOT, 'packages', rel)).href

// ---------------------------------------------------------------------------
// Fixture identity (all G8R3-owned; no overlap with other reviewers' ids)
// ---------------------------------------------------------------------------

const TEAM_ID = 'session-g8r3team01'
const TEAM_WORKSPACE = 'C:/agent-team/work/g8r3'
const SEED_AT = '2026-08-29T00:00:00.000Z'
const CHILD_SID_PREFIX = 'session-child-'

const childSidFor = (instanceId) => CHILD_SID_PREFIX + String(instanceId).replace(/[^A-Za-z0-9]/g, '')

// The G8R3 fixture blueprint (own id). Quotas: team 12/12, per-member
// template 3/3 — the E5(e) quota boundary (3 seeded/created workers + 1
// more > 3) binds on the member-template quota, mirroring the P6-T6
// fixture shape.
const BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: G8R3-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the G8R3 remote-seam verification team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the G8R3 verification work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the G8R3 verification team.',
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
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The G8R3 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 3',
  '    maxConcurrent: 3',
  'metadata: {}',
  '---',
].join('\n')

const SEED = [
  { instanceId: null, templateId: 'leader', label: 'leader', leader: true },
  { instanceId: 'inst-g8r3w0', templateId: 'worker', label: 'seed-worker' },
  { instanceId: 'inst-g8r3s0', templateId: 'scout', label: 'seed-scout' },
]

export const name = 'g8r3-remote-e2e'
export const inject = ['webServer', 'storageDomain', 'connection']

const state = { ready: false, error: null, teamSessionId: null, generation: 0 }

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

export function apply(ctx) {
  // Register the .js -> .ts resolve hook BEFORE the first dynamic TS import.
  register(pathToFileURL(path.join(HERE, 'ts-loader.mjs')).href, import.meta.url)

  // Boot driver health route (registered as an effect: reversible).
  ctx.effect(() => {
    const handler = (req, res) => {
      const payload =
        state.error !== null
          ? { status: 'error', error: state.error }
          : {
              status: state.ready ? 'ready' : 'starting',
              teamSessionId: state.teamSessionId,
              generation: state.generation,
            }
      const body = JSON.stringify(payload)
      res.writeHead(state.error !== null ? 500 : 200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      })
      res.end(body)
    }
    const r = ctx.webServer.register({ kind: 'exact', path: '/__g8r3/health', handler })
    return typeof r === 'function' ? r : undefined
  }, 'g8r3 remote e2e: health route')

  boot(ctx).catch((err) => {
    state.error = (err && err.message) || String(err)
  })
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------

async function boot(ctx) {
  const contractsMod = await import(pkgUrl('contracts/src/index.js'))
  const reposMod = await import(pkgUrl('storage/repositories/index.js'))
  const blueprintMod = await import(pkgUrl('domain/blueprint/src/index.js'))
  const routerMod = await import(pkgUrl('runtime/action-router/index.js'))
  const activationMod = await import(pkgUrl('runtime/activation/index.js'))
  const projectionMod = await import(pkgUrl('runtime/projection/index.js'))
  const admissionErrs = await import(pkgUrl('runtime/admission/errors.js'))
  const remoteMod = await import(pkgUrl('remote/src/index.js'))
  const seamMod = await import(pkgUrl('runtime/root-binding/harness/seam.mjs'))

  const C = contractsMod
  const sid = C.parseRootSessionId(TEAM_ID)

  // 1. Real TeamDomain over the real storageDomain seam (fresh DSH_HOME).
  const realSeam = seamMod.createRealStorageDomainSeam(ctx.get('storageDomain'))
  const domain = await reposMod.createTeamDomain(realSeam)
  ctx.effect(
    () => () => {
      Promise.resolve(domain.close()).catch(() => {})
    },
    'g8r3 remote e2e: team-domain close',
  )

  // 2. Seed the team at generation 1 (P6-T6 seed shape).
  const blueprint = blueprintMod.parseBlueprint(BLUEPRINT_SOURCE)
  const catalog = blueprintMod.createBlueprintCatalog([blueprint])
  const R = domain.repositories
  await R.teamSessions.put({
    rootSessionId: sid,
    blueprint: C.createBlueprintSnapshotRef({
      blueprintId: C.parseBlueprintId(String(blueprint.blueprintId)),
      revision: C.parseBlueprintRevision(String(blueprint.revision)),
      contentHash: C.parseBlueprintContentHash(String(blueprint.contentHash)),
    }),
    defaultWorkspace: TEAM_WORKSPACE,
    createdAt: SEED_AT,
    generation: 1,
  })
  await R.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: sid })
  for (const row of SEED) {
    const instanceId = row.leader ? C.LEADER_INSTANCE_ID : row.instanceId
    const childSessionId = row.leader ? TEAM_ID : childSidFor(row.instanceId)
    await R.memberInstances.put({
      rootSessionId: sid,
      instanceId: C.parseInstanceId(String(instanceId)),
      templateId: C.parseTemplateId(row.templateId),
      label: row.label,
      childSessionId: C.parseChildSessionId(childSessionId),
      lifecycle: 'RUNNING',
      createdAt: SEED_AT,
      activityVersion: 1,
    })
  }

  // 3. Deterministic ports for the real runtime (no agents / no LLM).
  const environmentFacts = async () => [
    { domain: 'tool', subject: 'web', available: true, generation: 1 },
    { domain: 'skill', subject: 'base', available: true, generation: 1 },
  ]
  const externalPolicyFacts = async () => ({ hard: {}, capabilityExists: {} })
  // Deterministic clock (run-4 finding: the wall clock made
  // `generatedAt` differ between two pulls of the same generation,
  // breaking byte-identical projection comparison).
  const now = () => SEED_AT
  const childFactory = {
    async createChildSession(request) {
      return { childSessionId: childSidFor(String(request.instanceId)) }
    },
  }
  const sessionDurability = { async ensureDurable() {} }
  const surface = {
    getInstalledSlots() {
      return []
    },
    installOverlay() {},
    restoreScope() {},
    recordSessionEvent() {},
  }

  const provider = activationMod.createActivationProvider({
    teamDomain: domain,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    childSessionFactory: childFactory,
    sessionDurability,
    surface,
    now,
  })
  const runtime = routerMod.createTeamRuntime({
    teamDomain: domain,
    activationProvider: provider,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    now,
  })

  // 4. The read port (first real TeamDomainReadPort — see header).
  const LEDGER_CATEGORIES = [
    'team',
    'member',
    'lifecycle',
    'message',
    'control',
    'policy',
    'compatibility',
    'progress',
  ]
  const categoryOfFactType = (factType) => {
    const t = String(factType)
    if (t.includes('control')) return 'control'
    if (t.includes('message')) return 'message'
    if (t.includes('policy')) return 'policy'
    if (t.includes('compatib')) return 'compatibility'
    if (t.includes('progress')) return 'progress'
    if (
      t.includes('archive') ||
      t.includes('restore') ||
      t.includes('dispose') ||
      t.includes('lifecycle')
    ) {
      return 'lifecycle'
    }
    if (t.includes('member')) return 'member'
    return 'team'
  }
  const teamLedgerEntries = (teamSessionId) =>
    R.ledger
      .list()
      .filter((e) => String(e.rootSessionId) === String(teamSessionId))
      .slice()
      .sort((a, b) => Number(a.sequence) - Number(b.sequence))
  const compatSummaryOf = (teamSessionId) => {
    const row = R.compatibility.get(String(teamSessionId))
    if (row === undefined) {
      return {
        status: 'OPEN',
        probeGeneration: 1,
        requirementFingerprint: 'g8r3-req',
        environmentFingerprint: 'g8r3-env',
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      }
    }
    const summary = {
      status: typeof row.status === 'string' ? row.status : 'OPEN',
      probeGeneration: Number.isFinite(Number(row.probeGeneration)) ? Number(row.probeGeneration) : 1,
      requirementFingerprint:
        typeof row.requirementFingerprint === 'string' ? row.requirementFingerprint : 'g8r3-req',
      environmentFingerprint:
        typeof row.environmentFingerprint === 'string' ? row.environmentFingerprint : 'g8r3-env',
      warningCount: Number.isFinite(Number(row.warningCount)) ? Number(row.warningCount) : 0,
      fatalCount: Number.isFinite(Number(row.fatalCount)) ? Number(row.fatalCount) : 0,
      acknowledgedWarningCount:
        Number.isFinite(Number(row.acknowledgedWarningCount)) ? Number(row.acknowledgedWarningCount) : 0,
    }
    if (typeof row.lastProbedAt === 'string' && row.lastProbedAt.length > 0) {
      summary.lastProbedAt = row.lastProbedAt
    }
    return summary
  }
  const memberQuota = Number(
    blueprint.quotas && blueprint.quotas.members ? blueprint.quotas.members.maxInstances : 3,
  )
  const templateContextPolicy = new Map([['leader', 'persistent']])
  for (const m of Array.isArray(blueprint.members) ? blueprint.members : []) {
    templateContextPolicy.set(
      String(m.templateId),
      typeof m.contextPolicy === 'string' ? m.contextPolicy : 'persistent',
    )
  }
  const readPort = {
    readProjectionSource(teamSessionId) {
      const sidStr = String(teamSessionId)
      const row = R.teamSessions.get(sidStr)
      if (row === undefined) {
        throw new admissionErrs.TeamRuntimeError(
          admissionErrs.TEAM_RUNTIME_ERROR_CODES.TEAM_SESSION_NOT_FOUND,
          "g8r3 read port: no TeamSession record for '" + sidStr + "'",
        )
      }
      const compat = compatSummaryOf(sidStr)
      const entries = teamLedgerEntries(sidStr)
      const byCategory = {}
      for (const k of LEDGER_CATEGORIES) byCategory[k] = 0
      for (const e of entries) byCategory[categoryOfFactType(e.factType)] += 1
      const totalEntries = entries.length
      const latestSequence = totalEntries > 0 ? Number(entries[totalEntries - 1].sequence) : 0
      const members = R.memberInstances.list(sidStr).map((m) => {
        const instId = String(m.instanceId)
        const isLeader = instId === String(C.LEADER_INSTANCE_ID)
        const hasWorkspace = typeof m.workspace === 'string' && m.workspace.length > 0
        const entry = {
          instanceId: instId,
          templateId: String(m.templateId),
          label: String(m.label),
          lifecycle: String(m.lifecycle),
          createdAt: String(m.createdAt),
          contextPolicy: templateContextPolicy.get(String(m.templateId)) || 'persistent',
          effectiveConfig: {
            model: { value: 'g8r3-model', source: 'blueprint', state: 'inherited' },
            workspace: {
              value: hasWorkspace ? m.workspace : TEAM_WORKSPACE,
              source: 'instance-creation',
              state: 'locked',
            },
            permissions: {},
            autonomy: { value: null, source: 'autonomy-overlay', state: 'suppressed' },
          },
        }
        if (typeof m.groupId === 'string' && m.groupId.length > 0) entry.groupId = m.groupId
        if (!isLeader && typeof m.childSessionId === 'string' && m.childSessionId.length > 0) {
          entry.childSessionId = m.childSessionId
        }
        if (hasWorkspace) entry.workspace = m.workspace
        return entry
      })
      const templates = [
        {
          kind: 'leader',
          templateId:
            blueprint.leader && blueprint.leader.templateId ? String(blueprint.leader.templateId) : 'leader',
          displayName: 'Leader',
          contextPolicy: 'persistent',
        },
      ]
      for (const m of Array.isArray(blueprint.members) ? blueprint.members : []) {
        templates.push({
          kind: 'member',
          templateId: String(m.templateId),
          displayName:
            m.displayName && String(m.displayName).length > 0 ? String(m.displayName) : String(m.templateId),
          contextPolicy: templateContextPolicy.get(String(m.templateId)) || 'persistent',
          instanceQuota: memberQuota,
        })
      }
      return {
        teamSessionId: row.rootSessionId,
        blueprint: row.blueprint,
        defaultWorkspace:
          typeof row.defaultWorkspace === 'string' && row.defaultWorkspace.length > 0
            ? row.defaultWorkspace
            : TEAM_WORKSPACE,
        createdAt: row.createdAt,
        generation: Number(row.generation),
        root: {
          policyState: 'default',
          admission: compat.status,
          compatibility: compat,
          creationBudgetConsumed: 0,
        },
        templates,
        members,
        ledger: {
          latestSequence,
          totalEntries,
          byCategory,
          pendingControlCount: entries.filter((e) => String(e.factType).includes('control')).length,
        },
      }
    },
  }
  // Deterministic clock injected (the service default is the ambient Date —
  // run-4/run-5 finding: an unstamped `generatedAt` differs between two
  // pulls of the same generation).
  const projection = projectionMod.createProjectionService(readPort, null, { clock: now })

  // 5. The twelve remote ports.
  const typedError = (code, message) => {
    const err = new Error(message)
    err.code = code
    return err
  }
  const notWired = (op) => () => {
    throw typedError('G8R3_PORT_NOT_WIRED', 'g8r3 harness: remote port ' + op + ' is not wired (outside G8 E1-E6 scope)')
  }
  const deps = {
    catalog: {
      list: () =>
        catalog.blueprintIds.map((id) => ({
          blueprintId: String(id),
          revisions: catalog.listRevisions(String(id)).map((r) => Number(r)),
        })),
      get: (blueprintId, revision) =>
        revision === undefined
          ? catalog.resolveLatest(String(blueprintId))
          : catalog.resolve(String(blueprintId), String(revision)),
    },
    intent: { probe: notWired('intent.probe') },
    teamCreate: { create: notWired('teamCreate.create') },
    projection: { project: (teamSessionId) => projection.project(teamSessionId) },
    ledger: {
      listEntries: (teamSessionId) => teamLedgerEntries(String(teamSessionId)),
      countEntries: (teamSessionId) => teamLedgerEntries(String(teamSessionId)).length,
    },
    admission: {
      // The frozen dispatcher is synchronous; the real performAction is
      // async. member.create never reaches this stub (the bridge below
      // intercepts it); member.send / member.followup are out of e2e
      // scope and surface as typed errors.
      performAction: notWired('admission.performAction (member.send/member.followup; member.create is bridged)'),
    },
    lifecycle: {
      archive: notWired('lifecycle.archive'),
      restore: notWired('lifecycle.restore'),
      dispose: notWired('lifecycle.dispose'),
    },
    override: {
      get: notWired('override.get'),
      set: notWired('override.set'),
      reset: notWired('override.reset'),
    },
    policyState: {
      read: notWired('policyState.read'),
      switchState: notWired('policyState.switchState'),
    },
    compatibility: {
      current: (teamSessionId) => compatSummaryOf(String(teamSessionId)),
      acknowledge: notWired('compatibility.acknowledge'),
      probe: notWired('compatibility.probe'),
    },
    handoff: {
      prepareSource: notWired('handoff.prepareSource'),
      start: notWired('handoff.start'),
    },
    legacy: { inspect: notWired('legacy.inspect') },
  }

  // 6. The frozen dispatcher + the member.create async bridge (header §4).
  const frozenDispatcher = remoteMod.createRemoteDispatcher(deps)

  // Effect-sequence extraction: the frozen member.ts `admissionEffectSequence`
  // reads only `effect.factSequence` / `effect.deliveredSequence` (messaging
  // vocabulary). The real P6-T2 `RuntimeActionEffect` closed union carries
  // `sequence` (fact-recorded / work-admitted / lifecycle-changed) and
  // `ledgerSequence` (member-activated) — so the frozen mapping yields null
  // for EVERY real-runtime outcome (cross-task combination finding F2).
  // This bridge therefore applies the vocabulary mapping at the adapter
  // boundary: frozen names first (contract compatibility), then the real
  // runtime's closed field names.
  const admissionEffectSequence = (outcome) => {
    const effect = outcome && typeof outcome === 'object' ? outcome.effect : undefined
    if (effect === null || typeof effect !== 'object' || Array.isArray(effect)) return undefined
    for (const key of ['factSequence', 'deliveredSequence', 'ledgerSequence', 'sequence']) {
      const v = effect[key]
      if (typeof v === 'number' && Number.isSafeInteger(v)) return v
    }
    return undefined
  }

  const toTypedErrorResult = (error, ctxProvenance) => {
    // Mirror of the frozen dispatcher invariants 4/5 (dispatch.ts
    // toRemoteErrorResult), reusing the frozen builders.
    if (remoteMod.isRemoteContractError(error)) {
      const details = error.details
      const field = details !== undefined && typeof details.field === 'string' ? details.field : undefined
      const reason =
        details !== undefined && typeof details.reason === 'string' ? details.reason : undefined
      return remoteMod.buildRemoteError(error.code, error.message, ctxProvenance, { field, reason })
    }
    if (error instanceof Error) {
      const typed = error
      if (typeof typed.code === 'string' && typed.code.length > 0) {
        return remoteMod.buildRemoteError(typed.code, typed.message, ctxProvenance, {
          reason: 'domain-error',
          cause: { code: typed.code, message: typed.message },
          sourceDetails: typed.details,
        })
      }
    }
    return remoteMod.buildRemoteError(
      remoteMod.REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR,
      'internal error in remote handler',
      ctxProvenance,
      { reason: 'untyped-error' },
    )
  }

  const bridgeMemberCreate = async (endpoint, payload) => {
    const ctxProvenance = {
      method: endpoint,
      endpoint,
      contractVersion: remoteMod.REMOTE_CONTRACT_VERSION,
      requestToken: null,
    }
    try {
      // Frozen invariants 2/3 (same order as the frozen dispatcher).
      const request = remoteMod.parseRemoteRequest(payload)
      ctxProvenance.contractVersion = request.version
      const parsed = remoteMod.parseRemoteMethodParams(endpoint, request.params)
      ctxProvenance.requestToken = parsed.requestToken
      // The frozen member.ts request construction, verbatim.
      const createParams = parsed.params
      const admissionRequest = {
        rootSessionId: createParams.teamSessionId,
        action: 'create-member',
        caller: createParams.caller,
        requestToken: createParams.requestToken,
        ...(createParams.delegationTemplateId !== undefined
          ? { delegationTemplateId: createParams.delegationTemplateId }
          : {}),
        ...(createParams.delegationInstanceId !== undefined
          ? { delegationInstanceId: createParams.delegationInstanceId }
          : {}),
        ...(createParams.payload !== undefined ? { payload: createParams.payload } : {}),
      }
      const outcome = await runtime.performAction(admissionRequest)
      // Frozen invariant 6 + success (frozen builders).
      return remoteMod.buildRemoteSuccess({ outcome }, {
        ...ctxProvenance,
        projectionGeneration: null,
        effectSequence: admissionEffectSequence(outcome) ?? null,
      })
    } catch (error) {
      return toTypedErrorResult(error, ctxProvenance)
    }
  }

  const channelHandler = async (endpoint, payload) => {
    if (endpoint === 'member.create') return bridgeMemberCreate(endpoint, payload)
    return frozenDispatcher(endpoint, payload)
  }

  ctx.effect(() => {
    const r = ctx.connection.rpc.handle(remoteMod.REMOTE_RPC_CHANNEL, channelHandler)
    return typeof r === 'function' ? r : undefined
  }, 'g8r3 remote e2e: rpc channel (frozen dispatcher + member.create async bridge)')

  state.teamSessionId = TEAM_ID
  state.generation = 1
  state.ready = true
}
