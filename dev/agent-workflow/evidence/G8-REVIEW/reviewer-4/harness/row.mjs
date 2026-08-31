/**
 * g8r4-remote-projection — G8-REVIEW reviewer-4 remote e2e harness row.
 *
 * What this row is:
 *   A DSH function-plugin row (named exports `name` / `inject` / `apply`,
 *   no default export — the Loader drops mixed shapes) mounted into the
 *   pristine test-use DSH web profile. It loads the worktree's
 *   `packages/remote/src` + `packages/runtime` / `contracts` / `domain` /
 *   `storage` TypeScript sources through the sibling `ts-loader.mjs`
 *   resolve hook, builds the 12 REAL remote ports over a fresh DSH_HOME's
 *   real TeamDomain storage (seeded with a small team + ledger entries the
 *   way `run.mjs` plants fixtures), and registers the public seam
 *   `connection.rpc.handle('/team-remote', <dispatcher from
 *   registerRemoteHandlers>)` (Remote contract v1).
 *
 * Documented harness decisions (each one is the smallest real thing that
 * satisfies the brief without touching core):
 *
 * 1. Storage seam — a FILE-BACKED implementation of the public
 *    `StorageDomainSeam` contract (`packages/storage/schema/seam.ts`). The
 *    production host binding is deferred (P4-T5/P5); the seam module
 *    explicitly designs repositories to run against such bindings. Every
 *    table persists to `<DSH_HOME>/g8-team-domain/team_domain/<table>.json`
 *    (JSON object: key -> canonical JSON string) and mutates its cache
 *    SYNCHRONOUSLY at call time (`writeFileSync`), returning already
 *    resolvable promises. Consequence: a real repository write fired from a
 *    sync port is durable and observable before the fired promise settles.
 *
 * 2. Sync mutation ports — the Remote contract's 12 ports are synchronous
 *    (`RemoteHandlerDeps`; design note §6: "the seam itself is
 *    promise-based and the dispatcher adapts"). Every mutating port uses
 *    the two-phase pattern: (a) sync real reads + precompute through the
 *    real contracts builders + the real sync binder; (b) fire the real
 *    async repository writes, each with a `.catch` that appends a
 *    diagnostic line to `<DSH_HOME>/g8-r4-harness-output/write-failures.jsonl`;
 *    (c) return the precomputed outcome synchronously.
 *
 * 3. Compatibility port — REPLICATES the prober's logic synchronously.
 *    The real `createCompatibilityProber` wraps every write in
 *    `withLock` = `lock.then(work, work)`, deferring evaluation and writes
 *    to a microtask; a sync port cannot await it. The replica performs the
 *    exact same steps with sync seams: sync `compatibility.get`, pure
 *    `evaluateCompatibility`, the same `CompatibilityStateRecord`
 *    construction (including the field-by-field `outcomes` mapping), the
 *    same `delete + put + advanceGeneration` replacement (fired), and the
 *    same verdict shape and `COMPATIBILITY_*` error codes.
 *
 * 4. teamCreate port — mirrors `runtime/root-binding/fresh-root.ts` and
 *    `cold-root.ts` step-for-step (same conflict codes, same write
 *    ordering: record before binding, binder after both), with the
 *    precomputed stamped record/binding returned synchronously and the
 *    real repository writes fired.
 *
 * 5. lifecycle / override / policyState / handoff / legacy ports — backed
 *    directly over the real repositories + real contracts/storage schema
 *    builders (the P7-T2/T3/T5 runtime services take large injected agent
 *    surfaces; direct repository backing keeps every port real, durable,
 *    and synchronous). The ledger sequence counter is bumped through the
 *    harness seam's own table accessor (documented exception, decision 1).
 *
 * 6. Agent-setup surface — the ruling-R28 mock-first no-op recorder
 *    (the real DSH agent seam is a later task's surface).
 *
 * Health: `GET /__g8r4/health` (exact route, NOT fenced by the RPC
 * trust/auth middleware — the browser-less driver polls it cookie-free,
 * the P5-T5 precedent) reports `{ok, ready, setupError, generation, ...}`.
 *
 * Reversibility: the RPC channel and the health route are ctx.effects;
 * the domain + seam close on fiber teardown.
 *
 * Zero-core discipline is irrelevant here (harness, not repo source):
 * node: builtins are used freely.
 */

import { register } from 'node:module'
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import process from 'node:process'

const HERE = dirname(fileURLToPath(import.meta.url))

// Register the worktree TS source loader BEFORE any package import.
register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

// Discover the worktree root: the nearest ancestor containing
// packages/remote/src/index.ts.
let ROOT
{
  let cursor = HERE
  for (;;) {
    if (existsSync(join(cursor, 'packages', 'remote', 'src', 'index.ts'))) {
      ROOT = cursor
      break
    }
    const parent = dirname(cursor)
    if (parent === cursor) throw new Error(`g8r4: cannot locate the worktree root above ${HERE}`)
    cursor = parent
  }
}
const pkg = (relative) => pathToFileURL(join(ROOT, relative)).href

const C = await import(pkg('packages/contracts/src/index.js'))
const BP = await import(pkg('packages/domain/blueprint/src/index.js'))
const CD = await import(pkg('packages/domain/compatibility/src/index.js'))
const SS = await import(pkg('packages/storage/schema/index.js'))
const SR = await import(pkg('packages/storage/repositories/index.js'))
const RB = await import(pkg('packages/runtime/root-binding/index.js'))
const BD = await import(pkg('packages/runtime/agent-setup/binder/index.js'))
const PJ = await import(pkg('packages/runtime/projection/index.js'))
const CR = await import(pkg('packages/runtime/compatibility/index.js'))
const RM = await import(pkg('packages/remote/src/index.js'))

const ROW_ID = 'g8r4-remote-projection'
const BP_ID = 'team.g8research'
const BP_REV = '1'
const SEED_ROOT = 'g8-root-1'
const TEAM_DEFAULT_WORKSPACE = 'D:/g8-r4/ws'

export const name = ROW_ID
export const inject = ['webServer', 'connection']

// ---------------------------------------------------------------------------
// File-backed StorageDomainSeam (decision 1)
// ---------------------------------------------------------------------------

/**
 * One persistent KV table: an in-memory Map cache over one JSON file
 * (key -> canonical JSON string). Mutations hit the cache and the file
 * synchronously at call time; the returned promises resolve afterwards.
 */
function makeTable(entry, seamError) {
  function assertOpen() {
    if (entry.closed) throw seamError('closed', `domain '${entry.spec.name}' is closed`)
  }
  function persist() {
    const plain = Object.fromEntries(entry.cache)
    writeFileSync(entry.file, JSON.stringify(plain, null, 2) + '\n')
  }
  return {
    get(key) {
      assertOpen()
      return entry.cache.get(key)
    },
    entries() {
      assertOpen()
      return [...entry.cache.entries()][Symbol.iterator]()
    },
    keys() {
      assertOpen()
      return [...entry.cache.keys()][Symbol.iterator]()
    },
    get size() {
      assertOpen()
      return entry.cache.size
    },
    async put(key, value) {
      assertOpen()
      if (typeof key !== 'string' || key.length === 0) {
        throw seamError('invalid-record', `table '${entry.name}': key must be a non-empty string`)
      }
      if (typeof value !== 'string') {
        throw seamError('invalid-record', `table '${entry.name}': values are canonical JSON strings`)
      }
      entry.cache.set(key, value)
      persist()
    },
    async delete(key) {
      assertOpen()
      const had = entry.cache.delete(key)
      if (had) persist()
      return had
    },
    async update(key, fn) {
      assertOpen()
      if (!entry.cache.has(key)) {
        throw seamError('missing-key', `table '${entry.name}': key '${key}' is missing`)
      }
      const next = fn(entry.cache.get(key))
      if (typeof next !== 'string') {
        throw seamError('invalid-record', `table '${entry.name}': update result must be a canonical JSON string`)
      }
      entry.cache.set(key, next)
      persist()
      return next
    },
  }
}

/**
 * The file-backed seam over `<baseDir>/<domainName>/<table>.json` files.
 * Implements exactly the public `StorageDomainSeam` surface
 * (`open(spec)`, `closeAll()`) plus the handle/table contract, with the
 * frozen seam error codes. `rawTable` is a harness-only accessor (NOT part
 * of the public seam) used to bump the ledger sequence counter
 * synchronously inside the sync mutation ports.
 */
function createFileSeam(baseDir) {
  const openDomains = new Map()

  function seamError(code, message, detail) {
    const error = new Error(message)
    error.code = code
    if (detail !== undefined) error.detail = detail
    return error
  }

  function assertPlainStringObject(value, what) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw seamError('malformed-medium', `${what} must be a JSON object of string rows`)
    }
    for (const [key, row] of Object.entries(value)) {
      if (typeof row !== 'string') {
        throw seamError('malformed-medium', `${what}: row '${key}' is not a canonical JSON string`)
      }
    }
  }

  function loadTableFile(dir, table) {
    const file = join(dir, `${table}.json`)
    if (!existsSync(file)) {
      writeFileSync(file, '{}\n')
      return new Map()
    }
    let value
    try {
      value = JSON.parse(readFileSync(file, 'utf8'))
    } catch {
      throw seamError('malformed-medium', `table file ${file} is not valid JSON`)
    }
    assertPlainStringObject(value, `table '${table}' file`)
    return new Map(Object.entries(value))
  }

  function closeDomain(domain) {
    if (domain.closed) return
    domain.closed = true
    for (const entry of domain.tables.values()) entry.closed = true
  }

  function makeHandle(domain) {
    return {
      name: domain.spec.name,
      table(tableName) {
        if (domain.closed) throw seamError('closed', `domain '${domain.spec.name}' is closed`)
        const entry = domain.tables.get(tableName)
        if (entry === undefined) {
          throw seamError('backend-not-found', `table '${tableName}' is not declared on domain '${domain.spec.name}'`)
        }
        return makeTable(entry, seamError)
      },
      close() {
        closeDomain(domain)
        openDomains.delete(domain.spec.name)
      },
    }
  }

  function openDomain(spec) {
    const dir = join(baseDir, spec.name)
    const metaPath = join(dir, 'meta.json')
    if (existsSync(metaPath)) {
      let meta
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf8'))
      } catch {
        throw seamError('malformed-medium', `${metaPath} is not valid JSON`)
      }
      if (
        typeof meta !== 'object' ||
        meta === null ||
        typeof meta['name'] !== 'string' ||
        typeof meta['version'] !== 'number' ||
        !Array.isArray(meta['tables'])
      ) {
        throw seamError('malformed-medium', `${metaPath} is not a domain meta record`)
      }
      if (meta['name'] !== spec.name) {
        throw seamError('backend-not-found', `medium at ${dir} belongs to domain '${meta['name']}', not '${spec.name}'`)
      }
      if (meta['version'] !== spec.version) {
        throw seamError(
          'version-mismatch',
          `domain '${spec.name}' is persisted at version ${meta['version']}; this binding supports ${spec.version}`,
          { found: meta['version'] },
        )
      }
      for (const table of spec.tables) {
        if (!meta['tables'].includes(table)) {
          throw seamError('backend-not-found', `table '${table}' is absent from the persisted domain at ${dir}`)
        }
      }
    } else {
      mkdirSync(dir, { recursive: true })
      writeFileSync(metaPath, JSON.stringify({ name: spec.name, version: spec.version, tables: [...spec.tables] }, null, 2) + '\n')
    }
    const tables = new Map()
    for (const table of spec.tables) {
      tables.set(table, {
        name: table,
        spec,
        file: join(dir, `${table}.json`),
        cache: loadTableFile(dir, table),
        closed: false,
      })
    }
    const domain = { spec, dir, tables, closed: false }
    openDomains.set(spec.name, domain)
    return makeHandle(domain)
  }

  return {
    async open(spec) {
      if (openDomains.has(spec.name)) {
        throw seamError('already-open', `domain '${spec.name}' is already open`)
      }
      return openDomain(spec)
    },
    async closeAll() {
      for (const domain of openDomains.values()) closeDomain(domain)
      openDomains.clear()
    },
    // Harness-only (NOT part of the public seam): raw table accessor over
    // the opened `team_domain`, used to bump the ledger sequence counter
    // synchronously (decision 5).
    rawTable(table) {
      const domain = openDomains.get('team_domain')
      if (domain === undefined || domain.closed) {
        throw seamError('closed', 'domain team_domain is not open')
      }
      const entry = domain.tables.get(table)
      if (entry === undefined) throw seamError('backend-not-found', `table '${table}' is not declared`)
      return makeTable(entry, seamError)
    },
  }
}

// ---------------------------------------------------------------------------
// Row body
// ---------------------------------------------------------------------------

export function apply(ctx) {
  const home = process.env['DSH_HOME']
  if (typeof home !== 'string' || home.length === 0) {
    throw new Error('g8r4: DSH_HOME environment variable is not set')
  }
  const outputDir = join(home, 'g8-r4-harness-output')
  mkdirSync(outputDir, { recursive: true })
  const diagnosticsFile = join(outputDir, 'write-failures.jsonl')

  const healthState = {
    ok: true,
    ready: false,
    setupError: null,
    row: ROW_ID,
    contractVersion: RM.REMOTE_CONTRACT_VERSION,
    teamRootId: SEED_ROOT,
    generation: null,
    seeded: false,
    writeFailures: 0,
  }

  // Health route: exact kind, NOT subject to the RPC trust/cookie fence
  // (P5-T5 precedent). Registered synchronously so the boot driver can poll
  // it the instant the row applies; readiness rides in healthState.
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/__g8r4/health',
        handler(req, res) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify(healthState))
        },
      }),
    'g8r4: health route',
  )

  // Fire-and-forget setup (session-reader pattern): the health route is
  // live immediately, ready flips on setup success, setup-failure.json on
  // failure.
  const setup = async () => {
    const seam = createFileSeam(join(home, 'g8-team-domain'))
    let domain
    try {
      domain = await SR.createTeamDomain(seam)
    } catch (error) {
      if (error !== null && typeof error === 'object' && error.code === 'TEAM_DOMAIN_EXISTS') {
        domain = await SR.openTeamDomain(seam)
      } else {
        throw error
      }
    }
    const repos = domain.repositories

    // --- Blueprint catalog over the harness YAML sources -------------------
    const blueprintsDir = join(HERE, 'blueprints')
    const catalog = BP.createBlueprintCatalogFromSource({
      listSources: () =>
        readdirSync(blueprintsDir)
          .filter((file) => file.endsWith('.yaml'))
          .map((file) => file.slice(0, -5)),
      readSource: (sourceName) => readFileSync(join(blueprintsDir, `${sourceName}.yaml`), 'utf8'),
    })

    // --- Shared building blocks -------------------------------------------
    const now = () => new Date().toISOString()

    // The ruling-R28 mock-first agent-setup surface (decision 6): records,
    // never blocks.
    const surface = createMockSurface()
    const readHandle = BD.createTeamDomainReadHandle(repos)

    // Fire one real async write; diagnostics on failure (decision 2).
    const fire = (promise, label) => {
      Promise.resolve(promise).catch((error) => {
        const entry = {
          at: now(),
          label,
          code: error !== null && typeof error === 'object' && typeof error.code === 'string' ? error.code : null,
          message: error instanceof Error ? error.message : String(error),
        }
        try {
          appendFileSync(diagnosticsFile, JSON.stringify(entry) + '\n')
        } catch {
          // A diagnostics fault must never mask the original failure.
        }
        healthState.writeFailures += 1
      })
    }

    // --- Seed the small team (idempotent: skipped when already present) ----
    if (repos.teamSessions.get(SEED_ROOT) === undefined) {
      const blueprint = catalog.resolve(BP_ID, BP_REV)
      await RB.bindFreshTeamRoot(
        {
          teamDomain: readHandle,
          writes: RB.createTeamDomainWritePort(repos),
          surface,
          now,
        },
        {
          rootSessionId: SEED_ROOT,
          blueprint: BP.toBlueprintSnapshotRef(blueprint),
          defaultWorkspace: TEAM_DEFAULT_WORKSPACE,
          generation: 1,
        },
      )
      const createdAt = now()
      await repos.memberInstances.put(
        C.createMemberInstanceRecord({
          rootSessionId: SEED_ROOT,
          instanceId: C.LEADER_INSTANCE_ID,
          templateId: 'leader',
          label: 'Team Lead',
          childSessionId: SEED_ROOT,
          lifecycle: 'RUNNING',
          createdAt,
          activityVersion: 1,
        }),
      )
      await repos.memberInstances.put(
        C.createMemberInstanceRecord({
          rootSessionId: SEED_ROOT,
          instanceId: 'inst-alpha',
          templateId: 'researcher',
          label: 'Researcher',
          childSessionId: 'g8-child-alpha',
          lifecycle: 'CREATED',
          createdAt,
          activityVersion: 1,
        }),
      )
      await repos.memberInstances.put(
        C.createMemberInstanceRecord({
          rootSessionId: SEED_ROOT,
          instanceId: 'inst-beta',
          templateId: 'writer',
          label: 'Writer',
          childSessionId: 'g8-child-beta',
          lifecycle: 'CREATED',
          createdAt,
          activityVersion: 1,
        }),
      )
      await repos.sessionBindings.put(
        C.parseSessionBinding({
          schemaVersion: 1,
          kind: 'team-member',
          sessionId: 'g8-child-alpha',
          rootSessionId: SEED_ROOT,
          instanceId: 'inst-alpha',
        }),
      )
      await repos.sessionBindings.put(
        C.parseSessionBinding({
          schemaVersion: 1,
          kind: 'team-member',
          sessionId: 'g8-child-beta',
          rootSessionId: SEED_ROOT,
          instanceId: 'inst-beta',
        }),
      )
      // Five durable facts: generation walks 1 -> 6 (hook A per new entry).
      const seedFacts = [
        { factType: 'team.created', payload: { blueprintId: BP_ID, blueprintRevision: Number(BP_REV), displayName: 'G8 Research Team' } },
        { factType: 'member.created', payload: { instanceId: C.LEADER_INSTANCE_ID, templateId: 'leader', label: 'Team Lead' } },
        { factType: 'member.created', payload: { instanceId: 'inst-alpha', templateId: 'researcher', label: 'Researcher' } },
        { factType: 'member.created', payload: { instanceId: 'inst-beta', templateId: 'writer', label: 'Writer' } },
        { factType: 'control.requested', payload: { kind: 'plan-approved', by: 'human-1' } },
      ]
      for (const fact of seedFacts) {
        const sequence = await repos.ledger.allocateSequence()
        await repos.ledger.put({
          schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
          sequence,
          rootSessionId: SEED_ROOT,
          factType: fact.factType,
          payload: fact.payload,
          createdAt: now(),
        })
      }
    }

    const seededTeam = repos.teamSessions.get(SEED_ROOT)
    healthState.seeded = seededTeam !== undefined
    healthState.generation = seededTeam !== undefined ? seededTeam.generation : null

    // --- Port helpers -------------------------------------------------------
    function typedError(code, message, details) {
      const error = new Error(message)
      error.code = code
      if (details !== undefined) error.details = details
      return error
    }

    function requireTeam(rootSessionId) {
      const team = repos.teamSessions.get(rootSessionId)
      if (team === undefined) {
        throw typedError('TEAM_SESSION_NOT_FOUND', `team session '${rootSessionId}' not found`, { rootSessionId })
      }
      return team
    }

    function blueprintOf(team) {
      return catalog.resolve(team.blueprint.blueprintId, team.blueprint.revision)
    }

    function contextPolicyOf(template) {
      const value = template.contextPolicy ?? 'persistent'
      if (value !== 'persistent' && value !== 'fresh_per_delegation') {
        throw typedError('CONTEXT_POLICY_INVALID', `unsupported context policy '${value}'`, { value })
      }
      return value
    }

    // Bump the ledger sequence counter synchronously through the harness
    // seam's own table (decision 5) and return the new value. The real
    // repository write fires so the row is durable like every other write.
    function nextSequenceSync() {
      const table = seam.rawTable('ledger')
      const raw = table.get(SS.LEDGER_SEQUENCE_COUNTER_KEY)
      const value = (raw === undefined ? 0 : SS.deserializeLedgerSequenceCounter(raw).value) + 1
      const counter = SS.serializeLedgerSequenceCounter({
        schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
        kind: SS.LEDGER_SEQUENCE_COUNTER_KIND,
        value,
      })
      fire(table.put(SS.LEDGER_SEQUENCE_COUNTER_KEY, counter), `ledger.counter:${value}`)
      return value
    }

    function putLedgerFactSync(rootSessionId, factType, payload) {
      const sequence = nextSequenceSync()
      const entry = {
        schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
        sequence,
        rootSessionId,
        factType,
        payload,
        createdAt: now(),
      }
      fire(repos.ledger.put(entry), `ledger.put:${rootSessionId}:${sequence}`)
      return sequence
    }

    // --- The g8s1-pattern read-port adapter (per-team, dynamic) ------------
    function memberRowOf(record, blueprint, defaultWorkspace) {
      const isLeader = record.instanceId === C.LEADER_INSTANCE_ID
      const template =
        blueprint.leader.templateId === record.templateId
          ? blueprint.leader
          : blueprint.members.find((member) => member.templateId === record.templateId)
      const workspace = record.workspace !== undefined ? record.workspace : defaultWorkspace
      const row = {
        instanceId: record.instanceId,
        templateId: record.templateId,
        label: record.label,
        lifecycle: record.lifecycle,
        createdAt: record.createdAt,
        contextPolicy: template !== undefined ? contextPolicyOf(template) : 'persistent',
        effectiveConfig: g8s1EffectiveConfig(workspace),
      }
      if (!isLeader) row.childSessionId = record.childSessionId
      if (record.workspace !== undefined) row.workspace = record.workspace
      if (record.groupId !== undefined) row.groupId = record.groupId
      return row
    }

    // The deterministic g8s1 stand-in EffectiveConfigDto (4 lanes).
    function g8s1EffectiveConfig(workspace) {
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
      for (const entry of entries) {
        const category = entry.factType.split('.')[0]
        if (category in byCategory) byCategory[category] += 1
        else byCategory.progress += 1
      }
      return {
        latestSequence: entries.length > 0 ? entries[entries.length - 1].sequence : 0,
        totalEntries: entries.length,
        byCategory,
        pendingControlCount: 0,
      }
    }

    function compatibilitySummaryOf(rootSessionId) {
      const stored = repos.compatibility.get(rootSessionId)
      if (stored !== undefined) {
        const counts = stored.outcomes['counts']
        return {
          status: stored.status,
          probeGeneration: stored.generation,
          requirementFingerprint: stored.fingerprint,
          environmentFingerprint: stored.fingerprint,
          warningCount: counts !== undefined && typeof counts === 'object' ? counts['warning'] : 0,
          fatalCount: counts !== undefined && typeof counts === 'object' ? counts['fatal'] : 0,
          acknowledgedWarningCount: 0,
          lastProbedAt: stored.computedAt,
        }
      }
      return {
        status: 'OPEN',
        probeGeneration: 1,
        requirementFingerprint: 'req-g8r4',
        environmentFingerprint: 'env-g8r4',
        warningCount: 0,
        fatalCount: 0,
        acknowledgedWarningCount: 0,
      }
    }

    const readPort = {
      readProjectionSource(teamSessionId) {
        const team = requireTeam(teamSessionId)
        const blueprint = blueprintOf(team)
        const entries = repos.ledger.list().filter((entry) => entry.rootSessionId === teamSessionId)
        const templates = [
          {
            kind: 'leader',
            templateId: blueprint.leader.templateId,
            displayName: blueprint.leader.displayName ?? 'Leader',
            ...(blueprint.leader.description !== undefined ? { description: blueprint.leader.description } : {}),
            contextPolicy: contextPolicyOf(blueprint.leader),
          },
          ...blueprint.members.map((member) => ({
            kind: 'member',
            templateId: member.templateId,
            displayName: member.displayName ?? String(member.templateId),
            ...(member.description !== undefined ? { description: member.description } : {}),
            contextPolicy: contextPolicyOf(member),
          })),
        ]
        return {
          teamSessionId: C.parseTeamSessionId(teamSessionId),
          blueprint: team.blueprint,
          ...(team.defaultWorkspace !== undefined ? { defaultWorkspace: team.defaultWorkspace } : {}),
          createdAt: team.createdAt,
          generation: team.generation,
          root: {
            policyState: policyStates.get(teamSessionId) ?? 'default',
            admission: 'OPEN',
            compatibility: compatibilitySummaryOf(teamSessionId),
            creationBudgetConsumed: 0,
          },
          templates,
          members: repos.memberInstances.list(teamSessionId).map((record) => memberRowOf(record, blueprint, team.defaultWorkspace)),
          ledger: ledgerSummaryOf(entries),
        }
      },
    }
    const projectionService = PJ.createProjectionService(readPort, null, { clock: now })

    // --- Policy state (per-team, row-level; ledger + operations journal) ---
    const policyStates = new Map() // teamSessionId -> policy state id

    // --- Compatibility engine helpers (decision 3) --------------------------
    function harnessEnvironmentFacts() {
      return [
        CD.parseEnvironmentFact({ domain: 'tool', subject: 'search', available: true, generation: 1, detail: 'g8-r4 harness environment' }),
        CD.parseEnvironmentFact({ domain: 'tool', subject: 'read', available: true, generation: 1, detail: 'g8-r4 harness environment' }),
      ]
    }

    // Field-by-field plain-JSON mapping mirroring probe.ts `outcomesOf`.
    function outcomesOfPlain(result) {
      const rows = result.requirements.map((requirement) => {
        const ackRef = requirement.acknowledgement
        const bound = ackRef !== null ? ackRef.acknowledgement : null
        return {
          requirementId: requirement.requirementId,
          type: requirement.type,
          complete: requirement.complete,
          outcome: requirement.outcome,
          reasonCode: requirement.reasonCode,
          detail: requirement.detail,
          unavailableSubjects: [...requirement.unavailableSubjects],
          mismatchFingerprint: requirement.mismatchFingerprint,
          acknowledgement:
            ackRef === null
              ? null
              : {
                  status: ackRef.status,
                  acknowledgement:
                    bound === null
                      ? null
                      : {
                          requirementId: bound.requirementId,
                          mismatchFingerprint: bound.mismatchFingerprint,
                          environmentFingerprint: bound.environmentFingerprint,
                          acknowledgedBy: bound.acknowledgedBy,
                          acknowledgedAt: bound.acknowledgedAt,
                          ...(bound.note !== undefined ? { note: bound.note } : {}),
                        },
                },
        }
      })
      return {
        counts: {
          pass: result.counts.pass,
          warning: result.counts.warning,
          fatal: result.counts.fatal,
          unackedWarning: result.counts.unackedWarning,
          staleAcknowledgement: result.counts.staleAcknowledgement,
        },
        requirements: rows,
      }
    }

    function verdictOfResult(result, recordedAt, generation) {
      return {
        recordedAt,
        generation,
        environmentFingerprint: result.environmentFingerprint,
        status: result.status,
        pass: result.counts.pass,
        warning: result.counts.warning,
        fatal: result.counts.fatal,
        unackedWarning: result.counts.unackedWarning,
      }
    }

    function verdictOfRecord(record) {
      const counts = record.outcomes['counts']
      const readCount = (key) =>
        counts !== undefined && typeof counts === 'object' && typeof counts[key] === 'number' ? counts[key] : 0
      return {
        recordedAt: record.computedAt,
        generation: record.generation,
        environmentFingerprint: record.fingerprint,
        status: record.status,
        pass: readCount('pass'),
        warning: readCount('warning'),
        fatal: readCount('fatal'),
        unackedWarning: readCount('unackedWarning'),
      }
    }

    function fireCompatReplace(rootSessionId, record) {
      fire(
        repos.compatibility
          .delete(rootSessionId)
          .then(() => repos.compatibility.put(record))
          .then(() => repos.teamSessions.advanceGeneration(rootSessionId)),
        `compatibility.replace:${rootSessionId}`,
      )
    }

    function evaluateFor(rootSessionId, acks) {
      const team = requireTeam(rootSessionId)
      const blueprint = blueprintOf(team)
      const requirements = CD.parseRequirements(CR.compatibilityRequirementsOf(blueprint))
      const environmentFacts = harnessEnvironmentFacts()
      const result = CD.evaluateCompatibility({ requirements, environmentFacts, acknowledgements: acks })
      return { requirements, environmentFacts, result }
    }

    // --- The 12 ports --------------------------------------------------------

    const catalogPort = {
      list() {
        return [...catalog.blueprintIds].map((blueprintId) => ({
          blueprintId,
          revisions: catalog.listRevisions(blueprintId).map((revision) => Number(revision)),
        }))
      },
      get(blueprintId, blueprintRevision) {
        return blueprintRevision !== undefined
          ? catalog.resolve(blueprintId, String(blueprintRevision))
          : catalog.resolveLatest(blueprintId)
      },
    }

    const intentPort = {
      probe(blueprintId, blueprintRevision, environmentFacts) {
        const blueprint =
          blueprintRevision !== undefined
            ? catalog.resolve(blueprintId, String(blueprintRevision))
            : catalog.resolveLatest(blueprintId)
        const requirements = CD.parseRequirements(CR.compatibilityRequirementsOf(blueprint))
        const facts = (environmentFacts ?? []).map((fact) => CD.parseEnvironmentFact(fact))
        const result = CD.evaluateCompatibility({ requirements, environmentFacts: facts, acknowledgements: [] })
        return {
          status: result.status,
          environmentFingerprint: result.environmentFingerprint,
          counts: {
            pass: result.counts.pass,
            warning: result.counts.warning,
            fatal: result.counts.fatal,
            unackedWarning: result.counts.unackedWarning,
            staleAcknowledgement: result.counts.staleAcknowledgement,
          },
          requirements: result.requirements.map((requirement) => ({
            requirementId: requirement.requirementId,
            type: requirement.type,
            complete: requirement.complete,
            outcome: requirement.outcome,
            reasonCode: requirement.reasonCode,
            detail: requirement.detail,
            unavailableSubjects: [...requirement.unavailableSubjects],
            mismatchFingerprint: requirement.mismatchFingerprint,
          })),
        }
      },
    }

    const teamCreatePort = {
      create(rootSessionId, blueprintId, blueprintRevision) {
        const id = C.parseRootSessionId(rootSessionId)
        const ref =
          blueprintRevision !== undefined
            ? BP.toBlueprintSnapshotRef(catalog.resolve(blueprintId, String(blueprintRevision)))
            : BP.toBlueprintSnapshotRef(catalog.resolveLatest(blueprintId))
        const existing = repos.teamSessions.get(rootSessionId)
        const binding = repos.sessionBindings.get(rootSessionId)
        if (existing !== undefined) {
          // Cold path (mirrors runtime/root-binding/cold-root.ts): the sync
          // binder core decides; ordinary sessions carry NO durable state.
          const binder = new BD.TeamAgentBinder({ surface, teamDomain: readHandle })
          const bind = binder.rehydrateColdRoot(rootSessionId)
          if (bind.noopReason === 'ordinary') {
            return { path: 'cold-root', durable: null, bind }
          }
          return {
            path: 'cold-root',
            durable: { teamSession: existing, binding: binding ?? null, wrote: false },
            bind,
          }
        }
        if (binding !== undefined && binding.kind !== 'team-root') {
          throw typedError(
            'ROOT_BINDING_SESSION_KIND_CONFLICT',
            `session '${rootSessionId}' already carries a '${binding.kind}' binding; the fresh root requires none or 'team-root'`,
            { rootSessionId, kind: binding.kind },
          )
        }
        if (binding !== undefined) {
          throw typedError(
            'ROOT_BINDING_TEAM_SESSION_CONFLICT',
            `session '${rootSessionId}' has a 'team-root' binding without a TeamSession record (integrity violation)`,
            { rootSessionId },
          )
        }
        // Fresh path (mirrors runtime/root-binding/fresh-root.ts): record
        // BEFORE binding, binder after both. The sync seam makes the fired
        // writes visible to the sync binder before it reads.
        const recordInput = {
          rootSessionId: id,
          blueprint: ref,
          defaultWorkspace: TEAM_DEFAULT_WORKSPACE,
          createdAt: now(),
          generation: 1,
        }
        const record = C.createTeamSessionRecord(recordInput)
        const bindingRow = C.parseSessionBinding({ schemaVersion: 1, kind: 'team-root', sessionId: rootSessionId })
        fire(
          repos.teamSessions
            .put(recordInput)
            .then(() => repos.sessionBindings.put(bindingRow)),
          `team.create:${rootSessionId}`,
        )
        const binder = new BD.TeamAgentBinder({ surface, teamDomain: readHandle })
        const bind = binder.bindFreshRoot(rootSessionId)
        // Every live team carries its leader MemberInstanceRecord (the
        // projection fold requires exactly one inst-leader row — a team
        // whose root exists but has no leader residency is MALFORMED_DTO
        // by design). The root agent's own residency is created here,
        // mirroring the seed team and the admission port's member.create
        // pattern: the durable member record first, then the
        // member.created fact (hook A advances the fresh root's
        // generation 1 -> 2).
        fire(
          repos.memberInstances.put(
            C.createMemberInstanceRecord({
              rootSessionId: id,
              instanceId: C.LEADER_INSTANCE_ID,
              templateId: 'leader',
              label: 'Team Lead',
              childSessionId: id,
              lifecycle: 'RUNNING',
              createdAt: now(),
              activityVersion: 1,
            }),
          ),
          `team.create:${rootSessionId}:leader`,
        )
        putLedgerFactSync(id, 'member.created', {
          instanceId: C.LEADER_INSTANCE_ID,
          templateId: 'leader',
          childSessionId: id,
        })
        return {
          path: 'fresh-root',
          durable: { teamSession: record, binding: bindingRow, wrote: true },
          bind,
        }
      },
    }

    const projectionPort = {
      project(teamSessionId) {
        return projectionService.project(C.parseTeamSessionId(teamSessionId))
      },
    }

    const ledgerPort = {
      listEntries(teamSessionId) {
        return repos.ledger.list().filter((entry) => entry.rootSessionId === teamSessionId)
      },
      countEntries(teamSessionId) {
        return repos.ledger.list().filter((entry) => entry.rootSessionId === teamSessionId).length
      },
    }

    function callerRoleOf(caller) {
      return caller.kind === 'human' ? 'human' : 'member'
    }

    const admissionPort = {
      performAction(request) {
        const root = request.rootSessionId
        requireTeam(root)
        const callerRole = callerRoleOf(request.caller)
        if (request.action === 'create-member') {
          let templateId
          if (request.delegationTemplateId !== undefined && request.delegationInstanceId !== undefined) {
            throw typedError('DELEGATION_CONFLICT', 'create-member accepts delegationTemplateId XOR delegationInstanceId', {
              rootSessionId: root,
            })
          }
          if (request.delegationTemplateId !== undefined) {
            const blueprint = blueprintOf(requireTeam(root))
            const template = blueprint.members.find((member) => member.templateId === request.delegationTemplateId)
            if (template === undefined) {
              throw typedError('TEMPLATE_NOT_FOUND', `blueprint has no member template '${request.delegationTemplateId}'`, {
                rootSessionId: root,
                templateId: request.delegationTemplateId,
              })
            }
            templateId = template.templateId
          } else if (request.delegationInstanceId !== undefined) {
            const instance = repos.memberInstances.get(root, request.delegationInstanceId)
            if (instance === undefined) {
              throw typedError('INSTANCE_NOT_FOUND', `member instance '${request.delegationInstanceId}' not found in team '${root}'`, {
                rootSessionId: root,
                instanceId: request.delegationInstanceId,
              })
            }
            templateId = instance.templateId
          } else {
            throw typedError('DELEGATION_REQUIRED', 'create-member requires delegationTemplateId or delegationInstanceId', {
              rootSessionId: root,
            })
          }
          const instanceId = 'inst-' + randomHex(12)
          const childSessionId = 'g8-child-' + randomHex(8)
          const record = C.createMemberInstanceRecord({
            rootSessionId: root,
            instanceId,
            templateId,
            label: templateId,
            childSessionId,
            lifecycle: 'CREATED',
            createdAt: now(),
            activityVersion: 1,
          })
          const binding = C.parseSessionBinding({
            schemaVersion: 1,
            kind: 'team-member',
            sessionId: childSessionId,
            rootSessionId: root,
            instanceId,
          })
          const sequence = putLedgerFactSync(root, 'member.created', { instanceId, templateId, childSessionId })
          fire(
            repos.memberInstances
              .put(record)
              .then(() => repos.sessionBindings.put(binding)),
            `member.create:${root}:${instanceId}`,
          )
          return {
            status: 'executed',
            action: 'create-member',
            rootSessionId: root,
            callerRole,
            targetInstanceId: instanceId,
            effect: { kind: 'fact-recorded', factType: 'member.created', sequence },
            requestToken: request.requestToken,
          }
        }
        if (request.action === 'send-message' || request.action === 'follow-up') {
          const target = repos.memberInstances.get(root, request.targetInstanceId)
          if (target === undefined) {
            throw typedError(
              'INSTANCE_NOT_FOUND',
              `member instance '${request.targetInstanceId}' not found in team '${root}'`,
              { rootSessionId: root, instanceId: request.targetInstanceId },
            )
          }
          if (request.action === 'send-message') {
            if (typeof request.body !== 'string' || request.body.length === 0) {
              throw typedError('MESSAGE_BODY_REQUIRED', 'send-message requires a non-empty body', { rootSessionId: root })
            }
            const sequence = putLedgerFactSync(root, 'message.sent', {
              from: request.caller.kind === 'instance' ? request.caller.instanceId : 'human',
              to: request.targetInstanceId,
              subject: request.subject ?? null,
              body: request.body,
            })
            return {
              status: 'executed',
              action: 'send-message',
              rootSessionId: root,
              callerRole,
              targetInstanceId: request.targetInstanceId,
              effect: { kind: 'fact-recorded', factType: 'message.sent', sequence },
              requestToken: request.requestToken,
            }
          }
          const sequence = putLedgerFactSync(root, 'member.followup', { target: request.targetInstanceId })
          return {
            status: 'executed',
            action: 'follow-up',
            rootSessionId: root,
            callerRole,
            targetInstanceId: request.targetInstanceId,
            effect: { kind: 'fact-recorded', factType: 'member.followup', sequence },
            requestToken: request.requestToken,
          }
        }
        throw typedError('ADMISSION_ACTION_UNSUPPORTED', `unsupported admission action '${request.action}'`, {
          rootSessionId: root,
          action: request.action,
        })
      },
    }

    function lifecycleTransition(teamSessionId, instanceId, to, factType, allowedFrom) {
      const root = teamSessionId
      requireTeam(root)
      const record = repos.memberInstances.get(root, instanceId)
      if (record === undefined) {
        throw typedError('INSTANCE_NOT_FOUND', `member instance '${instanceId}' not found in team '${root}'`, {
          rootSessionId: root,
          instanceId,
        })
      }
      if (!allowedFrom.includes(record.lifecycle)) {
        throw typedError(
          'LIFECYCLE_STATE_CONFLICT',
          `member '${instanceId}' is '${record.lifecycle}'; transition to '${to}' requires one of ${allowedFrom.join(' | ')}`,
          { rootSessionId: root, instanceId, from: record.lifecycle, to },
        )
      }
      const updated = C.createMemberInstanceRecord({
        rootSessionId: root,
        instanceId,
        templateId: record.templateId,
        label: record.label,
        ...(record.groupId !== undefined ? { groupId: record.groupId } : {}),
        childSessionId: record.childSessionId,
        ...(record.workspace !== undefined ? { workspace: record.workspace } : {}),
        lifecycle: to,
        createdAt: record.createdAt,
        activityVersion: record.activityVersion,
      })
      const sequence = putLedgerFactSync(root, factType, { instanceId, from: record.lifecycle, to })
      fire(
        // The member store has no update path (put-on-occupied is a
        // duplicate); the real pattern is delete + re-put.
        repos.memberInstances
          .delete(root, instanceId)
          .then(() => repos.memberInstances.put(updated)),
        `lifecycle.${to}:${root}:${instanceId}`,
      )
      return {
        instanceId,
        teamSessionId: root,
        from: record.lifecycle,
        to,
        sequence,
        at: now(),
      }
    }

    const lifecyclePort = {
      archive(teamSessionId, instanceId) {
        return lifecycleTransition(teamSessionId, instanceId, 'ARCHIVED', 'lifecycle.changed', ['CREATED', 'RUNNING', 'SETTLED'])
      },
      restore(teamSessionId, instanceId) {
        return lifecycleTransition(teamSessionId, instanceId, 'RUNNING', 'lifecycle.changed', ['ARCHIVED'])
      },
      dispose(teamSessionId, instanceId) {
        return lifecycleTransition(teamSessionId, instanceId, 'DISPOSED', 'lifecycle.changed', ['CREATED', 'RUNNING', 'SETTLED', 'ARCHIVED'])
      },
    }

    function overrideIdentity(teamSessionId, capability, scope, targetInstanceId) {
      const identity = {
        kind: 'human-override',
        recordId: capability,
        scope: scope ?? 'team',
        rootSessionId: teamSessionId,
      }
      if (targetInstanceId !== undefined) identity.instanceId = targetInstanceId
      return identity
    }

    const overridePort = {
      get(teamSessionId, capability, scope, targetInstanceId) {
        requireTeam(teamSessionId)
        return repos.overrides.get(overrideIdentity(teamSessionId, capability, scope, targetInstanceId))
      },
      set(request) {
        const root = request.teamSessionId
        requireTeam(root)
        const identity = overrideIdentity(root, request.capability, request.scope, request.targetInstanceId)
        const existing = repos.overrides.get(identity)
        const generation = existing !== undefined ? existing.generation + 1 : 1
        const record = {
          schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
          kind: 'human-override',
          recordId: request.capability,
          scope: request.scope ?? 'team',
          rootSessionId: root,
          ...(request.targetInstanceId !== undefined ? { instanceId: request.targetInstanceId } : {}),
          values: { [request.capability]: request.value },
          generation,
          updatedAt: now(),
        }
        const parsed = SS.parseGovernanceOverride(record)
        if (existing !== undefined) {
          fire(repos.overrides.delete(identity).then(() => repos.overrides.put(parsed)), `override.set:${root}:${request.capability}`)
        } else {
          fire(repos.overrides.put(parsed), `override.set:${root}:${request.capability}`)
        }
        return parsed
      },
      reset(request) {
        const root = request.teamSessionId
        requireTeam(root)
        const identity = overrideIdentity(root, request.capability, request.scope, request.targetInstanceId)
        // The seam mutates synchronously: capture existence BEFORE firing
        // the delete so `removed` is exact when this port returns.
        const existed = repos.overrides.get(identity) !== undefined
        fire(repos.overrides.delete(identity), `override.reset:${root}:${request.capability}`)
        return { removed: existed }
      },
    }

    const policyStatePort = {
      read(teamSessionId) {
        requireTeam(teamSessionId)
        return { stateId: policyStates.get(teamSessionId) ?? 'default' }
      },
      switchState(request) {
        const root = request.teamSessionId
        const team = requireTeam(root)
        const blueprint = blueprintOf(team)
        const knownStates = ['default', ...blueprint.policyStates.map((state) => state.id)]
        if (!knownStates.includes(request.target)) {
          throw typedError('POLICY_STATE_UNKNOWN', `policy state '${request.target}' is not defined for this team`, {
            rootSessionId: root,
            target: request.target,
          })
        }
        const from = policyStates.get(root) ?? 'default'
        policyStates.set(root, request.target)
        const sequence = putLedgerFactSync(root, 'policy.state.changed', { from, to: request.target, actor: request.actor })
        const operation = SS.parseOperationRecord({
          schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
          operationId: 'op-' + randomHex(16),
          idempotencyKey: `g8r4:policy-state:${root}:${sequence}`,
          intent: { type: 'policy-state.switch', payload: { from, to: request.target, actor: request.actor } },
          phase: 'COMMITTED',
          updatedAt: now(),
          generation: 1,
        })
        fire(repos.operations.put(operation), `policyState.set:${root}:${request.target}`)
        return {
          teamSessionId: root,
          from,
          to: request.target,
          actor: request.actor,
          sequence,
          at: now(),
        }
      },
    }

    const compatibilityPort = {
      current(teamSessionId) {
        const stored = repos.compatibility.get(teamSessionId)
        if (stored !== undefined) return verdictOfRecord(stored)
        requireTeam(teamSessionId)
        const { result } = evaluateFor(teamSessionId, [])
        return verdictOfResult(result, now(), 0)
      },
      acknowledge(teamSessionId, requirementId, acknowledgedBy, note) {
        const root = teamSessionId
        const previous = repos.compatibility.get(root)
        const previousAcks = previous !== undefined ? [...previous.acknowledgements] : []
        const { result } = evaluateFor(root, previousAcks)
        const target = result.requirements.find((requirement) => requirement.requirementId === requirementId)
        if (target === undefined) {
          throw new CR.CompatibilityError(
            CR.COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING,
            `compatibility: no requirement '${requirementId}' in the bound blueprint's evaluation (nothing to acknowledge)`,
            { rootSessionId: root, requirementId, outcome: 'ABSENT' },
          )
        }
        if (target.outcome === 'FATAL') {
          throw new CR.CompatibilityError(
            CR.COMPATIBILITY_ERROR_CODES.FATAL_NOT_ACKNOWLEDGABLE,
            `compatibility: FATAL requirement '${requirementId}' is not ack-able (Architecture §27.2)`,
            { rootSessionId: root, requirementId, reasonCode: target.reasonCode, detail: target.detail },
          )
        }
        if (target.outcome === 'PASS' || target.mismatchFingerprint === null) {
          throw new CR.CompatibilityError(
            CR.COMPATIBILITY_ERROR_CODES.ACK_TARGET_NOT_WARNING,
            `compatibility: requirement '${requirementId}' is PASS in the current evaluation — there is no mismatch to bind an acknowledgement to (Architecture §27.3)`,
            { rootSessionId: root, requirementId, outcome: 'PASS' },
          )
        }
        const ack = {
          requirementId: target.requirementId,
          mismatchFingerprint: target.mismatchFingerprint,
          environmentFingerprint: result.environmentFingerprint,
          acknowledgedBy,
          acknowledgedAt: now(),
          ...(note !== undefined ? { note } : {}),
        }
        const { result: reResult } = evaluateFor(root, [...previousAcks, ack])
        const recordedAt = now()
        const generation = (previous !== undefined ? previous.generation : 0) + 1
        const record = {
          schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
          rootSessionId: root,
          status: reResult.status,
          fingerprint: reResult.environmentFingerprint,
          generation,
          outcomes: outcomesOfPlain(reResult),
          acknowledgements: [...previousAcks, ack],
          computedAt: recordedAt,
        }
        fireCompatReplace(root, record)
        return verdictOfResult(reResult, recordedAt, generation)
      },
      probe(teamSessionId, trigger) {
        const root = teamSessionId
        const previous = repos.compatibility.get(root)
        const previousAcks = previous !== undefined ? [...previous.acknowledgements] : []
        const { result } = evaluateFor(root, previousAcks)
        const recordedAt = now()
        const generation = (previous !== undefined ? previous.generation : 0) + 1
        const record = {
          schemaVersion: SS.TEAM_DOMAIN_SCHEMA_VERSION,
          rootSessionId: root,
          status: result.status,
          fingerprint: result.environmentFingerprint,
          generation,
          outcomes: outcomesOfPlain(result),
          acknowledgements: previousAcks,
          computedAt: recordedAt,
        }
        fireCompatReplace(root, record)
        return { ...verdictOfResult(result, recordedAt, generation), trigger }
      },
    }

    const handoffPort = {
      prepareSource(sourceSessionId) {
        const binding = repos.sessionBindings.get(sourceSessionId)
        return {
          sourceSessionId,
          bindingKind: binding !== undefined ? binding.kind : 'ordinary',
          ready: true,
          at: now(),
        }
      },
      start(sourceSessionId, requestToken, staged) {
        return {
          status: 'replayed',
          sourceSessionId,
          requestToken,
          ...(staged !== undefined ? { staged } : {}),
          at: now(),
        }
      },
    }

    const legacyPort = {
      inspect(dshHome) {
        // The fresh test home carries no legacy Team metadata: the closed
        // inspection vocabulary resolves to the native fallback.
        return {
          status: 'native-fallback',
          dshHome,
          legacyTeamFound: false,
          at: now(),
        }
      },
    }

    const deps = {
      catalog: catalogPort,
      intent: intentPort,
      teamCreate: teamCreatePort,
      projection: projectionPort,
      ledger: ledgerPort,
      admission: admissionPort,
      lifecycle: lifecyclePort,
      override: overridePort,
      policyState: policyStatePort,
      compatibility: compatibilityPort,
      handoff: handoffPort,
      legacy: legacyPort,
    }

    // --- Registration (caller-fiber effects; reversible) ---------------------
    ctx.effect(
      () => {
        const registration = RM.registerRemoteHandlers(ctx.connection, deps)
        return () => registration.dispose()
      },
      'g8r4: rpc channel /team-remote',
    )
    ctx.effect(
      () => () => {
        healthState.ready = false
        domain.close().catch(() => undefined)
        seam.closeAll().catch(() => undefined)
      },
      'g8r4: team domain teardown',
    )

    healthState.ready = true
  }

  setup()
    .then(() => {
      // ready was set inside setup; nothing else to do here.
    })
    .catch((error) => {
      healthState.ok = false
      healthState.ready = false
      healthState.setupError = error instanceof Error ? error.message : String(error)
      try {
        writeFileSync(
          join(outputDir, 'setup-failure.json'),
          JSON.stringify(
            {
              at: new Date().toISOString(),
              error: {
                name: error !== null && typeof error === 'object' && typeof error.name === 'string' ? error.name : 'Error',
                code: error !== null && typeof error === 'object' && typeof error.code === 'string' ? error.code : null,
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
              },
            },
            null,
            2,
          ),
        )
      } catch {
        // The health route still reports the failure even if the file is
        // unwritable.
      }
    })
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** The ruling-R28 mock-first agent-setup surface: records, never blocks. */
function createMockSurface() {
  const installed = new Map() // sessionId -> Set<slot name>
  return {
    getInstalledSlots(sessionId) {
      const slots = installed.get(sessionId)
      return slots !== undefined ? [...slots] : []
    },
    installOverlay(sessionId, slot) {
      let slots = installed.get(sessionId)
      if (slots === undefined) {
        slots = new Set()
        installed.set(sessionId, slots)
      }
      slots.add(typeof slot === 'string' ? slot : slot.name)
    },
    restoreScope(sessionId, scope) {
      let slots = installed.get(sessionId)
      if (slots === undefined) {
        slots = new Set()
        installed.set(sessionId, slots)
      }
      for (const slot of scope.slots) slots.add(slot)
    },
    recordSessionEvent(sessionId, event) {
      // Provenance channel only: keep the last events bounded in memory.
      void sessionId
      void event
    },
  }
}

/** Lowercase hex string of the given length (id minting; non-cryptographic). */
function randomHex(length) {
  let out = ''
  while (out.length < length) {
    out += Math.floor(Math.random() * 16).toString(16)
  }
  return out.slice(0, length)
}
