/**
 * plugin.mjs — G8-R6 (reviewer 6) pristine-host, browserless remote e2e row.
 *
 * Mounted into the test instance's web profile patch layer
 * (`<DSH_HOME>/profiles/web/cordis.patch.yml` — the ONLY allowed seam; see
 * run.mjs). It drives the REAL product remote seam end to end:
 *
 *   - the real storage seam (seam.mjs over the DSH public `storageDomain`
 *     service) opens/creates the real TeamDomain;
 *   - a deterministic team is seeded idempotently (boot 1 writes the rows;
 *     boot 2 — the E2 restart — reopens the persisted unit, so the scenario
 *     proves REAL durability across a process death);
 *   - all 12 `RemoteHandlerDeps` ports (packages/remote/src/handlers/ports.ts,
 *     deviation D-2) are implemented: the scenario-exercised read paths run
 *     on REAL product code (catalog, intent probe, projection fold over the
 *     durable rows, ledger slice, override/policyState/compatibility reads,
 *     legacy inspection); the mutation paths are FAIL-CLOSED with the REAL
 *     closed product error codes (the vNext runtime services are
 *     promise-based and the 12 ports are synchronous — the production host
 *     wiring is explicitly "a later P8 harness task", design note §3);
 *   - `registerRemoteHandlers(connection, deps)` (packages/remote/src)
 *     exposes the 22 endpoints on the public seam channel `/team-remote`;
 *   - two harness-only control routes serve the driver (obs-ready poll +
 *     in-scenario durable fact append, which advances the REAL ledger
 *     generation through the S1-A hook).
 *
 * The dynamic imports load THIS repository's TS modules through the
 * worktree-relative TS resolution hook (ts-loader.mjs, registered before
 * the first dynamic import). Zero-core holds: no DSH private/internal
 * module is imported anywhere; node: builtins are used only in this
 * harness plumbing (the zero-core rule applies to packages/*.ts product
 * code).
 *
 * Directive: `<DSH_HOME>/g8r6-directive.json` (written by run.mjs before
 * every boot) — `{ boot: number, reportDir: string }`.
 * Observability: `<reportDir>/harness-output/g8r6-obs.json`
 *   `{ phase: 'activating' | 'ready' | 'setup-failed', teamSessionId?,
 *     generation?, seeded?, compatStatus?, fatal? }`.
 *
 * @module g8r6-harness/plugin
 */
import { randomBytes } from 'node:crypto'
import { register } from 'node:module'
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// Register the TS resolution hook BEFORE the first dynamic worktree import.
register(new URL('./ts-loader.mjs', import.meta.url), import.meta.url)

export const name = 'g8r6-remote-seam'

/** Hard dependencies: the row waits until all three services exist. */
export const inject = ['connection', 'webServer', 'storageDomain']

// ---------------------------------------------------------------------------
// Constants (deterministic fixtures; no wall clock in the seeded world)
// ---------------------------------------------------------------------------

/** Six levels up from this file to the worktree root (harness -> ... -> dev). */
const UP6 = '../../../../../../'
const DIRECTIVE_NAME = 'g8r6-directive.json'
const OBS_NAME = 'g8r6-obs.json'

const TEAM_ID = 'session-g8r6-team'
const LEADER_ID = 'inst-leader'
const WORKER_ID = 'inst-g8r6worker'
const LEADER_CHILD = 'session-g8r6-child-leader'
const WORKER_CHILD = 'session-g8r6-child-worker'
/** The deterministic created-at stamp for every seeded row. */
const C0 = '2026-08-31T09:00:00.000Z'
const DEFAULT_WORKSPACE = 'C:/g8r6/work'
const WORKER_WORKSPACE = 'C:/g8r6/work/worker'
const BP_ID = 'g8r6.team'
const BP_REV = '1'
const LEADER_TEMPLATE = 'tpl-g8r6-leader'
const WORKER_TEMPLATE = 'tpl-g8r6-worker'
const COMPAT_FINGERPRINT = 'g8r6-env-empty'
const FACT_TEAM = 'g8r6-seed-team'
const FACT_MEMBER = 'g8r6-seed-member'
const FACT_ACTIVITY = 'g8r6-activity'

/**
 * The seeded blueprint source (the closed vNext YAML document: frontmatter
 * fences + the exact top-level field set). Template ids match the durable
 * member rows' templateId so the projection policy lookup is total.
 */
const BP_SOURCE = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ID}`,
  'revision: "1"',
  'leader:',
  `  templateId: ${LEADER_TEMPLATE}`,
  '  displayName: G8R6 Leader',
  '  persona: "g8r6 deterministic leader persona"',
  'members:',
  '  - templateId: tpl-g8r6-worker',
  '    displayName: G8R6 Worker',
  '    persona: "g8r6 deterministic worker persona"',
  'requirements:',
  '  - domain: model',
  '    name: model.g8r6',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
].join('\n')

// ---------------------------------------------------------------------------
// Directive + observability
// ---------------------------------------------------------------------------

/** @type {object} the validated directive of this boot. */
let directive
/** @type {Promise<void>} resolves when row setup finished (success or failure). */
let readyGate
/** @type {((() => void) | undefined)} */
let resolveReady
/** @type {string|null} setup failure (visible through /__g8r6/ready). */
let setupError = null

/** Read + validate the run directive (written by run.mjs before every boot). */
function readDirective() {
  const home = process.env.DSH_HOME
  if (!home) throw new Error('g8r6: DSH_HOME is not set in the host process environment')
  const parsed = JSON.parse(readFileSync(join(home, DIRECTIVE_NAME), 'utf8'))
  if (typeof parsed.reportDir !== 'string' || parsed.reportDir.length === 0) {
    throw new Error('g8r6: directive.reportDir is required')
  }
  if (!Number.isInteger(parsed.boot) || (parsed.boot !== 1 && parsed.boot !== 2)) {
    throw new Error(`g8r6: directive.boot must be 1 or 2 (got ${JSON.stringify(parsed.boot)})`)
  }
  return parsed
}

/** Write the poll target the driver reads (`<reportDir>/harness-output/g8r6-obs.json`). */
function writeObs(obs) {
  try {
    const dir = join(directive.reportDir, 'harness-output')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, OBS_NAME), JSON.stringify(obs, null, 2))
  } catch {
    /* the /__g8r6/ready route still reports the state */
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers (the P5-T5 form)
// ---------------------------------------------------------------------------

/**
 * Send one JSON response on the webserver route.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

/** @param {import('node:http').IncomingMessage} req @returns {Promise<string>} */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** One unique durable-operation id (`op-` + 16 hex chars, the frozen pattern). */
function freshOpId() {
  return 'op-' + randomBytes(8).toString('hex')
}

// ---------------------------------------------------------------------------
// Typed fail-closed errors (dispatcher invariant 4b: own non-empty string
// `code` -> pass-through code + message)
// ---------------------------------------------------------------------------

/**
 * Build one typed domain error with a REAL closed product code.
 * @param {string} code - the closed code value.
 * @param {string} message - the human-readable detail.
 * @returns {Error}
 */
function typedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

// ---------------------------------------------------------------------------
// Projection source (the g8s1 buildRealSource approach over the REAL rows)
// ---------------------------------------------------------------------------

/** Resolve a template's frozen contextPolicy (default `persistent`). */
function contextPolicyOfTemplate(template, isContextPolicy) {
  const policy = template.contextPolicy ?? 'persistent'
  if (!isContextPolicy(policy)) {
    throw new Error(`g8r6: template '${String(template.templateId)}' carries unknown contextPolicy '${policy}'`)
  }
  return policy
}

/**
 * The deterministic four-lane effective-config view for the stand-in source
 * (structurally the P8-T2 raw builder shape; the real per-instance resolver
 * is a later host-wiring task — same approach as the P8 team's own G8-S1
 * stamp e2e).
 * @param {string} defaultWorkspace
 * @returns {object}
 */
function effectiveConfigOf(defaultWorkspace) {
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

/**
 * Build the bounded projection source from the REAL durable rows (the
 * pre-adapter stand-in; the generation is verbatim from the seeded row, so
 * the stamp -> projection chain is proven over REAL state). Unknown team
 * sessions throw the REAL closed code (typed pass-through on the wire).
 *
 * @param {object} repos - the TeamDomain repositories.
 * @param {string} teamSessionId
 * @param {object} blueprintMod
 * @param {object} catalog
 * @param {object} codes - TEAM_RUNTIME_ERROR_CODES.
 * @returns {object} the TeamDomainProjectionSource.
 */
function buildProjectionSource(repos, teamSessionId, blueprintMod, catalog, codes, isContextPolicy) {
  const teamRow = repos.teamSessions.get(teamSessionId)
  if (teamRow === undefined) {
    throw typedError(
      codes.TEAM_SESSION_NOT_FOUND,
      `g8r6: team session '${teamSessionId}' has no durable row`,
    )
  }
  const blueprint = catalog.resolve(teamRow.blueprint.blueprintId, String(teamRow.blueprint.revision))
  const defaultWorkspace = teamRow.defaultWorkspace ?? DEFAULT_WORKSPACE

  const templates = []
  templates.push({
    kind: 'leader',
    templateId: blueprint.leader.templateId,
    displayName: blueprint.leader.displayName ?? 'Leader',
    contextPolicy: contextPolicyOfTemplate(blueprint.leader, isContextPolicy),
  })
  for (const member of blueprint.members) {
    templates.push({
      kind: 'member',
      templateId: member.templateId,
      displayName: member.displayName ?? String(member.templateId),
      ...(member.description !== undefined ? { description: member.description } : {}),
      contextPolicy: contextPolicyOfTemplate(member, isContextPolicy),
    })
  }

  const policyByTemplate = new Map()
  policyByTemplate.set(blueprint.leader.templateId, contextPolicyOfTemplate(blueprint.leader, isContextPolicy))
  for (const member of blueprint.members) {
    policyByTemplate.set(member.templateId, contextPolicyOfTemplate(member, isContextPolicy))
  }
  const members = []
  for (const record of repos.memberInstances.list(teamSessionId)) {
    const isLeader = String(record.instanceId) === LEADER_ID
    const contextPolicy = policyByTemplate.get(String(record.templateId))
    if (contextPolicy === undefined) {
      throw new Error(`g8r6: no template contextPolicy for member template '${record.templateId}'`)
    }
    members.push({
      instanceId: record.instanceId,
      templateId: record.templateId,
      label: record.label,
      lifecycle: record.lifecycle,
      createdAt: record.createdAt,
      contextPolicy,
      effectiveConfig: effectiveConfigOf(defaultWorkspace),
      // invariant 14: the LeaderInstance row carries NO childSessionId in the projection.
      ...(isLeader ? {} : { childSessionId: record.childSessionId }),
      ...(record.workspace !== undefined ? { workspace: record.workspace } : {}),
      ...(record.groupId !== undefined ? { groupId: record.groupId } : {}),
    })
  }

  const entries = repos.ledger.list().filter((entry) => entry.rootSessionId === teamSessionId)
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
    if (entry.factType === FACT_TEAM || entry.factType === FACT_ACTIVITY) byCategory.team += 1
    else if (entry.factType === FACT_MEMBER) byCategory.member += 1
  }

  const compatRow = repos.compatibility.get(teamSessionId)
  const counts = (compatRow && compatRow.outcomes && compatRow.outcomes.counts) || {
    pass: 0,
    warning: 0,
    fatal: 0,
    unackedWarning: 0,
  }

  return {
    teamSessionId: parseTeamSessionId(teamSessionId),
    blueprint: teamRow.blueprint,
    defaultWorkspace: teamRow.defaultWorkspace,
    createdAt: teamRow.createdAt,
    generation: teamRow.generation,
    root: {
      // `default` is the seeded team's only policy state; the compat summary
      // mirrors the REAL seeded compat state row.
      policyState: 'default',
      admission: 'OPEN',
      compatibility: {
        status: compatRow ? compatRow.status : 'OPEN',
        probeGeneration: compatRow ? compatRow.generation : 1,
        requirementFingerprint: compatRow && compatRow.outcomes
          ? String(compatRow.outcomes.environmentFingerprint ?? COMPAT_FINGERPRINT)
          : 'req-g8r6',
        environmentFingerprint: compatRow ? compatRow.fingerprint : COMPAT_FINGERPRINT,
        warningCount: counts.warning,
        fatalCount: counts.fatal,
        acknowledgedWarningCount: 0,
      },
      creationBudgetConsumed: 0,
    },
    templates,
    members,
    ledger: {
      latestSequence,
      totalEntries: entries.length,
      byCategory,
      pendingControlCount: 0,
    },
  }
}

/** Bound module handle (filled in run). */
let parseTeamSessionId = (value) => value

// ---------------------------------------------------------------------------
// The row entry point (fire-and-forget async setup, the P2-proven form)
// ---------------------------------------------------------------------------

/**
 * @param {object} ctx - the Cordis plugin context.
 */
export function apply(ctx) {
  let resolveReadyLocal
  readyGate = new Promise((r) => { resolveReadyLocal = r })
  resolveReady = resolveReadyLocal
  run(ctx).catch((error) => {
    setupError = error instanceof Error ? error.message : String(error)
    try {
      writeObs({ phase: 'setup-failed', fatal: setupError })
    } catch {
      /* nothing else to do */
    }
    try {
      const home = process.env.DSH_HOME
      if (home !== undefined) {
        mkdirSync(join(home, 'g8r6-run'), { recursive: true })
      }
      writeFileSync(
        join(directive?.reportDir ?? join(home ?? '.', 'g8r6-run'), 'setup-failure.json'),
        JSON.stringify({ error: setupError, stack: error?.stack ?? null }, null, 2),
      )
    } catch {
      /* the ready route still reports the failure */
    }
    resolveReadyLocal()
  })
}

/**
 * The async row setup: read the directive, open/create the TeamDomain
 * through the REAL storageDomain seam, seed idempotently, register the 22
 * seam endpoints + the two control routes.
 * @param {object} ctx
 * @returns {Promise<void>}
 */
async function run(ctx) {
  directive = readDirective()
  writeObs({ phase: 'activating' })

  const webServer = ctx.get('webServer')
  const storageDomain = ctx.get('storageDomain')
  const connection = ctx.get('connection')
  if (webServer === undefined || storageDomain === undefined || connection === undefined) {
    throw new Error('g8r6: webServer/storageDomain/connection services missing despite inject')
  }

  // Dynamic imports: the TS resolution hook (registered at module top)
  // rewrites the worktree-relative .js specifiers to the .ts sources.
  const reposMod = await import(UP6 + 'packages/storage/repositories/index.js')
  const contractsMod = await import(UP6 + 'packages/contracts/src/index.js')
  const blueprintMod = await import(UP6 + 'packages/domain/blueprint/src/index.js')
  const compatDomainMod = await import(UP6 + 'packages/domain/compatibility/src/index.js')
  const rtCompatMod = await import(UP6 + 'packages/runtime/compatibility/index.js')
  const projectionMod = await import(UP6 + 'packages/runtime/projection/index.js')
  const admissionMod = await import(UP6 + 'packages/runtime/admission/index.js')
  const handoffMod = await import(UP6 + 'packages/runtime/handoff/index.js')
  const remoteMod = await import(UP6 + 'packages/remote/src/index.js')
  const legacyMod = await import(UP6 + 'packages/legacy/session-reader/index.js')
  const seamMod = await import('./seam.mjs')

  parseTeamSessionId = contractsMod.parseTeamSessionId
  const codes = admissionMod.TEAM_RUNTIME_ERROR_CODES

  const realSeam = seamMod.createRealStorageDomainSeam(storageDomain)
  /** @type {object} the storage-domain TeamDomain facade (boot 1 create / boot 2 open). */
  let domain
  try {
    domain = await reposMod.openTeamDomain(realSeam)
  } catch {
    domain = await reposMod.createTeamDomain(realSeam)
  }
  const repos = domain.repositories
  ctx.effect(() => () => {
    void domain.close().catch(() => {})
  }, 'g8r6 team-domain close')

  // The deterministic blueprint catalog (real parse + validation + hashing).
  const blueprint = blueprintMod.parseBlueprint(BP_SOURCE)
  const catalog = blueprintMod.createBlueprintCatalog([blueprint])

  // ------------------------------------------------------------------ seed
  let seeded = false
  if (repos.teamSessions.get(TEAM_ID) === undefined) {
    seeded = true
    const snapshotRef = catalog.snapshotOf(BP_ID, BP_REV)
    await repos.teamSessions.put({
      blueprint: snapshotRef,
      createdAt: C0,
      defaultWorkspace: DEFAULT_WORKSPACE,
      generation: 1,
      rootSessionId: TEAM_ID,
    })
    await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: TEAM_ID })
    await repos.memberInstances.put({
      activityVersion: 1,
      childSessionId: LEADER_CHILD,
      createdAt: C0,
      instanceId: LEADER_ID,
      label: 'G8R6 Leader',
      lifecycle: 'CREATED',
      rootSessionId: TEAM_ID,
      templateId: LEADER_TEMPLATE,
    })
    await repos.memberInstances.put({
      activityVersion: 1,
      childSessionId: WORKER_CHILD,
      createdAt: C0,
      instanceId: WORKER_ID,
      label: 'G8R6 Worker',
      lifecycle: 'CREATED',
      rootSessionId: TEAM_ID,
      templateId: WORKER_TEMPLATE,
      workspace: WORKER_WORKSPACE,
    })
    await repos.sessionBindings.put({
      instanceId: WORKER_ID,
      kind: 'team-member',
      rootSessionId: TEAM_ID,
      schemaVersion: 1,
      sessionId: WORKER_CHILD,
    })
    // Two initial ledger facts: each REAL put advances the generation
    // (S1-A hook A) -> the seeded world ends at generation 3, deterministically.
    await repos.ledger.put({
      schemaVersion: 1,
      sequence: await repos.ledger.allocateSequence(),
      rootSessionId: TEAM_ID,
      factType: FACT_TEAM,
      payload: { stage: 'team-seeded', blueprintId: BP_ID, revision: BP_REV },
      operationId: freshOpId(),
      createdAt: C0,
    })
    await repos.ledger.put({
      schemaVersion: 1,
      sequence: await repos.ledger.allocateSequence(),
      rootSessionId: TEAM_ID,
      factType: FACT_MEMBER,
      payload: { stage: 'members-seeded', leaderInstance: LEADER_ID, workerInstance: WORKER_ID },
      operationId: freshOpId(),
      createdAt: C0,
    })
    // The seeded compat state: REAL pure evaluation of the REAL blueprint
    // requirements against the (deterministic) empty environment.
    const compatResult = compatDomainMod.evaluateCompatibility({
      requirements: rtCompatMod.compatibilityRequirementsOf(blueprint),
      environmentFacts: [],
    })
    await repos.compatibility.put({
      schemaVersion: 1,
      rootSessionId: TEAM_ID,
      status: compatResult.status,
      fingerprint: COMPAT_FINGERPRINT,
      generation: 1,
      outcomes: compatResult,
      acknowledgements: [],
      computedAt: C0,
    })
  }

  // ------------------------------------------------------------ projection
  const readPort = {
    readProjectionSource: (teamSessionId) =>
      buildProjectionSource(repos, teamSessionId, blueprintMod, catalog, codes, contractsMod.isContextPolicy),
  }
  // A deterministic clock keeps the DTO's generatedAt identical across
  // boots, so E1/E2 can deep-compare the whole projection.
  const projectionService = projectionMod.createProjectionService(readPort, null, { clock: () => C0 })

  // ------------------------------------------------------------------ ports
  const teamRowOf = (teamSessionId) => repos.teamSessions.get(teamSessionId)
  const requireTeam = (teamSessionId) => {
    if (teamRowOf(teamSessionId) === undefined) {
      throw typedError(codes.TEAM_SESSION_NOT_FOUND, `team session '${teamSessionId}' has no durable row`)
    }
  }
  const lifecycleFailClosed = (teamSessionId, instanceId) => {
    requireTeam(teamSessionId)
    const member = repos.memberInstances.get(teamSessionId, instanceId)
    if (member === undefined) {
      throw typedError(codes.INSTANCE_NOT_FOUND, `member instance '${instanceId}' has no durable row`)
    }
    throw typedError(
      codes.LIFECYCLE_COMMIT_UNAVAILABLE,
      'g8r6 harness: lifecycle commit is fail-closed (browserless; the durable commit path is a later P8 host-wiring task)',
    )
  }
  const admissionFailClosedMessage =
    'g8r6 harness: the admission success path is fail-closed (the real TeamRuntime is promise-based and the sync ports cannot await it — a later P8 host-wiring task)'

  // Port 8 helper (hoisted out of the deps literal): resolve one
  // capability cell by scanning the team's override rows for the record
  // that claims that cell at the addressed scope; latest
  // generation/updatedAt/recordId wins (deterministic). Store rows are
  // keyed by a minted recordId (the P7-T2 mutation store mints its own
  // ids; a row's `values` claims one capability cell).
  const overrideCellRecord = (teamSessionId, capability, scope, targetInstanceId) => {
    const wantScope = scope === 'instance' ? 'instance' : 'team'
    const records = repos.overrides.list(teamSessionId).filter((record) => {
      if (record.scope !== wantScope) return false
      if (wantScope === 'instance' && record.instanceId !== targetInstanceId) return false
      const values = record.values
      return values !== null && typeof values === 'object'
        && Object.prototype.hasOwnProperty.call(values, capability)
    })
    if (records.length === 0) return undefined
    records.sort((a, b) =>
      (a.generation - b.generation)
      || (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0)
      || (a.recordId < b.recordId ? -1 : a.recordId > b.recordId ? 1 : 0))
    return records[records.length - 1]
  }

  const deps = {
    // Port 1 — catalog: the REAL blueprint catalog (pure, sync).
    catalog: {
      list: () => catalog.blueprintIds.map((id) => ({
        blueprintId: id,
        revisions: catalog.listRevisions(id).map(Number),
      })),
      get: (blueprintId, blueprintRevision) => (blueprintRevision === undefined
        ? catalog.resolveLatest(blueprintId)
        : catalog.resolve(blueprintId, String(blueprintRevision))),
    },
    // Port 2 — intent: REAL pure compatibility evaluation (100% real).
    intent: {
      probe: (blueprintId, blueprintRevision, environmentFacts) => {
        const bp = blueprintRevision === undefined
          ? catalog.resolveLatest(blueprintId)
          : catalog.resolve(blueprintId, String(blueprintRevision))
        return compatDomainMod.evaluateCompatibility({
          requirements: rtCompatMod.compatibilityRequirementsOf(bp),
          environmentFacts: [...environmentFacts],
        })
      },
    },
    // Port 3 — team.create: fail-closed (the async root-binding path with
    // real overlay/slot work is a later P8 host-wiring task; E1-E6 never
    // call it).
    teamCreate: {
      create: () => {
        throw typedError(codes.DURABLE_WRITE_FAILED,
          'g8r6 harness: team.create is fail-closed (the fresh-root binding path is a later P8 host-wiring task)')
      },
    },
    // Port 4 — projection: the REAL projection fold over the REAL durable
    // rows (the g8s1 stand-in approach; root facts + effectiveConfig are
    // deterministic, everything else is real state).
    projection: {
      project: (teamSessionId) => projectionService.project(teamSessionId),
    },
    // Port 5 — ledger: the REAL storage ledger, filtered by root (the
    // remote D-5 slicer in team.ts slices on top of this).
    ledger: {
      listEntries: (teamSessionId) => repos.ledger.list().filter((entry) => entry.rootSessionId === teamSessionId),
      countEntries: (teamSessionId) => repos.ledger.list().filter((entry) => entry.rootSessionId === teamSessionId).length,
    },
    // Port 6 — admission: real storage reads for the error paths; the
    // success path fail-closes with the REAL closed code.
    admission: {
      performAction: (request) => {
        // RemoteAdmissionRequest addresses the root via `rootSessionId`
        // (frozen in packages/remote/src/handlers/member.ts) — NOT
        // `teamSessionId`.
        requireTeam(request.rootSessionId)
        if (request.targetInstanceId !== undefined) {
          const member = repos.memberInstances.get(request.rootSessionId, request.targetInstanceId)
          if (member === undefined) {
            throw typedError(codes.INSTANCE_NOT_FOUND,
              `member instance '${request.targetInstanceId}' has no durable row`)
          }
        }
        throw typedError(codes.DURABLE_WRITE_FAILED, admissionFailClosedMessage)
      },
    },
    // Port 7 — lifecycle: real member read (typed not-found codes); the
    // commit itself fail-closes (browserless, zero durable writes).
    lifecycle: {
      archive: lifecycleFailClosed,
      restore: lifecycleFailClosed,
      dispose: lifecycleFailClosed,
    },
    // Port 8 — override: real store read; set fail-closes; reset is
    // TRUTHFUL against the real store (absent record -> removed:false).
    // Store rows are keyed by a minted recordId (the P7-T2 mutation store
    // mints its own ids; a row's `values` claims one capability cell),
    // so a capability cell is resolved by scanning the team's rows for
    // the record that claims that cell at the addressed scope; the
    // latest generation/updatedAt/recordId wins (deterministic).
    override: {
      get: (teamSessionId, capability, scope, targetInstanceId) => {
        requireTeam(teamSessionId)
        const record = overrideCellRecord(teamSessionId, capability, scope, targetInstanceId)
        return record === undefined ? null : record
      },
      set: () => {
        throw typedError(codes.DURABLE_WRITE_FAILED,
          'g8r6 harness: override.set is fail-closed (the durable mutation store is a later P8 host-wiring task)')
      },
      reset: (request) => {
        requireTeam(request.teamSessionId)
        const record = overrideCellRecord(request.teamSessionId, request.capability,
          request.scope, request.targetInstanceId)
        if (record !== undefined) {
          throw typedError(codes.DURABLE_WRITE_FAILED,
            'g8r6 harness: override.reset on a stored record is fail-closed (the durable mutation store is a later P8 host-wiring task)')
        }
        return { removed: false }
      },
    },
    // Port 9 — policyState: deterministic read mirroring the seeded team
    // row (the real mutation store is a later host-wiring task); the
    // switch fail-closes.
    policyState: {
      read: (teamSessionId) => {
        requireTeam(teamSessionId)
        return { stateId: 'default' }
      },
      switchState: () => {
        throw typedError(codes.DURABLE_WRITE_FAILED,
          'g8r6 harness: policyState.switchState is fail-closed (MutationService needs the full store + policy reader — a later P8 host-wiring task)')
      },
    },
    // Port 10 — compatibility: the REAL seeded durable state, mapped to
    // the closed verdict; ack/probe fail-close (the real prober is
    // promise-based).
    compatibility: {
      current: (teamSessionId) => {
        const state = repos.compatibility.get(teamSessionId)
        if (state === undefined) {
          throw typedError(codes.TEAM_SESSION_NOT_FOUND,
            `team session '${teamSessionId}' has no durable compatibility state`)
        }
        const counts = (state.outcomes && state.outcomes.counts) || {
          pass: 0, warning: 0, fatal: 0, unackedWarning: 0,
        }
        return {
          recordedAt: state.computedAt,
          generation: state.generation,
          environmentFingerprint: state.fingerprint,
          status: state.status,
          pass: counts.pass,
          warning: counts.warning,
          fatal: counts.fatal,
          unackedWarning: counts.unackedWarning,
        }
      },
      acknowledge: () => {
        throw typedError(codes.DURABLE_WRITE_FAILED,
          'g8r6 harness: compatibility.acknowledge is fail-closed (the real prober is promise-based)')
      },
      probe: () => {
        throw typedError(codes.DURABLE_WRITE_FAILED,
          'g8r6 harness: compatibility.probe is fail-closed (the real prober is promise-based)')
      },
    },
    // Port 11 — handoff: browserless harness has no source-session surface
    // -> the REAL closed code.
    handoff: {
      prepareSource: () => {
        throw typedError(handoffMod.HANDOFF_ERROR_CODES.SOURCE_SURFACE_UNAVAILABLE,
          'g8r6 harness: handoff source surface unavailable (browserless)')
      },
      start: () => {
        throw typedError(handoffMod.HANDOFF_ERROR_CODES.SOURCE_SURFACE_UNAVAILABLE,
          'g8r6 harness: handoff source surface unavailable (browserless)')
      },
    },
    // Port 12 — legacy: the REAL read-only inspector over a best-effort
    // fs-backed LegacyHomePort (node:fs is allowed in harness .mjs plumbing).
    legacy: {
      inspect: (dshHome, workspaceCwd, projectDir) => {
        const fsPort = {
          listDir: (path) => {
            try {
              return readdirSync(path, { withFileTypes: true }).map((entry) => ({
                name: entry.name,
                kind: entry.isDirectory() ? 'dir' : 'file',
              }))
            } catch {
              return undefined
            }
          },
          readFile: (path) => {
            try {
              return readFileSync(path, 'utf8')
            } catch {
              return undefined
            }
          },
        }
        return legacyMod.inspectLegacyTeam(fsPort, { dshHome, workspaceCwd, projectDir })
      },
    },
  }

  // ------------------------------------------------------- seam registration
  ctx.effect(() => {
    const registration = remoteMod.registerRemoteHandlers(connection, deps)
    return () => registration.dispose()
  }, 'g8r6: rpc channel /team-remote')

  // --------------------------------------------------- harness control routes
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__g8r6/ready',
    handler: async (req, res) => {
      await readyGate
      if (setupError !== null) {
        sendJson(res, 500, { status: 'setup-failed', error: setupError })
        return
      }
      const row = repos.teamSessions.get(TEAM_ID)
      sendJson(res, 200, {
        status: 'ready',
        teamSessionId: TEAM_ID,
        generation: row.generation,
        seeded,
      })
    },
  }), 'g8r6 /__g8r6/ready route')
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__g8r6/fact',
    handler: async (req, res) => {
      await readyGate
      if (setupError !== null) {
        sendJson(res, 500, { status: 'setup-failed', error: setupError })
        return
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST required' })
        return
      }
      const text = await readBody(req)
      let note = ''
      try {
        note = (JSON.parse(text).note ?? '')
      } catch {
        note = text
      }
      const now = new Date().toISOString()
      const sequence = await repos.ledger.allocateSequence()
      await repos.ledger.put({
        schemaVersion: 1,
        sequence,
        rootSessionId: TEAM_ID,
        factType: FACT_ACTIVITY,
        payload: { note: String(note).slice(0, 512), at: now },
        operationId: freshOpId(),
        createdAt: now,
      })
      const row = repos.teamSessions.get(TEAM_ID)
      sendJson(res, 200, { generation: row.generation, sequence })
    },
  }), 'g8r6 /__g8r6/fact route')

  writeObs({
    phase: 'ready',
    teamSessionId: TEAM_ID,
    generation: repos.teamSessions.get(TEAM_ID).generation,
    seeded,
  })
  resolveReady()
}
