/**
 * row.mjs — G8 reviewer-2 e2e harness row (g8r2-team-remote).
 *
 * Mounted into a pristine DSH web instance (port 3182, fresh DSH_HOME) via
 * the public `profiles/web/cordis.patch.yml` seam. This row:
 *
 * 1. registers the repo's ts-loader resolve hook and imports the WORKTREE's
 *    TypeScript sources directly (native type-stripping; no bundling):
 *    - packages/remote/src (the closed Remote contract v1 dispatcher),
 *    - packages/runtime/projection (the real P8-T2 ProjectionService),
 *    - packages/runtime/test/p8t2-helpers (pure fixture builders for the
 *      source sub-shapes the harness binds);
 * 2. implements ALL 12 backing ports (the exact `RemoteHandlerDeps` shape)
 *    as a SYNCHRONOUS in-memory model. This is the port contract as the
 *    product documents it (packages/remote/src/handlers/ports.ts, deviation
 *    D-2): "The port methods are synchronous: the vNext runtime services and
 *    storage repositories are in-process and synchronous." The row therefore
 *    stands in for the host-side wiring that the real P8 harness task
 *    provides over the in-process P7/P8 runtime services — the same role
 *    the product's own in-process suites fill with `makeFakePorts`
 *    (packages/remote/test/p8t3-helpers.ts). The remote layer under test is
 *    fully real: the contract-v1 dispatcher, all six category handlers, and
 *    the P8-T2 ProjectionService fold over the harness sources.
 *
 *    Behavior (the criterion-2/3/4 evidence surface):
 *      - teamCreate  — fresh-root: seeds the team record (generation 1),
 *                      two member instances (2 `member.created` facts),
 *                      then a `team.created` fact (sequences 1-3); a second
 *                      create on the same root returns `cold-root` with the
 *                      same bind (idempotent rehydrate);
 *      - projection  — assembles the `TeamDomainProjectionSource` from the
 *                      in-memory stores (team record + member rows +
 *                      ledger facts) and folds it through the REAL
 *                      `createProjectionService` (cold: overlay `null`);
 *      - ledger      — per-root entry list/count, sequence ascending;
 *      - admission   — create-member (duplicate instanceId raises the typed
 *                      `member-already-exists` error; success appends a
 *                      `member.created` fact and bumps the team generation)
 *                      and send-message / follow-up (recipient must be a
 *                      known member or the leader; appends a `message.sent`
 *                      fact; NO generation bump — documented binding
 *                      decision: message facts do not change the identity
 *                      core);
 *
 *    HARNESSED (deterministic minimal records; NOT exercised by E1-E6
 *    except through dispatcher invariants; documented here):
 *      - catalog     — one blueprint row (the fixture blueprint);
 *      - intent      — trivially compatible probe result;
 *      - lifecycle   — archive/restore/dispose over the member store
 *                      (+ a `lifecycle.changed` fact);
 *      - override    — get: null / set: echo / reset: {removed:false};
 *      - policyState — read: 'active' / switchState: echo record;
 *      - compatibility — the fixture CompatibilitySummaryDto;
 *      - handoff     — prepareSource: empty summary / start: 'replayed';
 *      - legacy      — inspect: `native-fallback`.
 *
 * 3. registers the REAL dispatcher through the public
 *    `connection.rpc.handle('/team-remote', ...)` seam as a caller-fiber
 *    effect (reversible on row stop — the register.ts §6 pattern).
 *
 * E3 staleness control channel: the row re-reads
 * `<DSH_HOME>/g8r2-control.json` on EVERY projection read; when
 * `{ "pin": <generation> }` is set and the row's snapshot cache holds that
 * generation, the (stale) cached source is served — producing a genuine
 * over-the-wire stale-generation response that the client engine must
 * reject (decideFrameVerdict strict-newer). Absent file / unknown pin =
 * live read. The driver plants/removes this file between E3 steps.
 *
 * Markers (under DSH_HOME, written by the row):
 *   - g8r2-row-activated.json  apply() completed, channel registered;
 *   - g8r2-row-error.json      apply() failed (boot then fails too).
 *
 * Pure host row; no state outside the in-memory team store + markers.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const HARNESSED_DIR = fileURLToPath(new URL('.', import.meta.url))
// harness/ -> reviewer-2 -> G8-REVIEW -> evidence -> agent-workflow -> dev -> <worktree>
const WORKTREE_ROOT = join(HARNESSED_DIR, '..', '..', '..', '..', '..', '..')

const wtUrl = (p) => pathToFileURL(join(WORKTREE_ROOT, p)).href

export const name = 'g8r2-team-remote'
export const inject = ['connection']

/** A typed domain error the dispatcher passes through with its own code. */
function typedError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

/** factType prefix -> the eight frozen ledger categories. */
const CATEGORY_OF = {
  team: 'team',
  member: 'member',
  lifecycle: 'lifecycle',
  message: 'message',
  control: 'control',
  policy: 'policy',
  compatibility: 'compatibility',
  progress: 'progress',
}

function categoryOf(factType) {
  const prefix = String(factType).split('.')[0]
  return CATEGORY_OF[prefix] ?? null
}

export async function apply(ctx) {
  const dshHome = process.env.DSH_HOME
  if (typeof dshHome !== 'string' || dshHome.length === 0) {
    throw new Error('g8r2 row: DSH_HOME is not set in the host process environment')
  }
  const fail = (error) => {
    try {
      writeFileSync(
        join(dshHome, 'g8r2-row-error.json'),
        JSON.stringify({ at: new Date().toISOString(), message: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined }, null, 2),
      )
    } catch {
      /* marker best-effort */
    }
    throw error
  }

  try {
    // 1) ts-loader hook (repo reusability: packages/legacy/session-reader/e2e/ts-loader.mjs),
    //    then the worktree TS entries (Node native type-stripping).
    register(pathToFileURL(join(WORKTREE_ROOT, 'packages/legacy/session-reader/e2e/ts-loader.mjs')).href, import.meta.url)
    const [remote, runtime, helpers] = await Promise.all([
      import(wtUrl('packages/remote/src/index.ts')),
      import(wtUrl('packages/runtime/projection/index.ts')),
      import(wtUrl('packages/runtime/test/p8t2-helpers.ts')),
    ])

    const FIX = helpers.P8T2_FIXTURE
    const LEADER_ID = 'inst-leader'

    // ── synchronous in-memory team store (the D-2 backing stand-in) ──
    // rootSessionId -> { record, members: Map<instanceId,row>, ledger: [], nextSequence }
    const teams = new Map()

    const getTeam = (rootSessionId) => {
      const team = teams.get(String(rootSessionId))
      if (team === undefined) {
        throw typedError('team-session-not-found', `no TeamSession record for '${rootSessionId}'`)
      }
      return team
    }

    const appendFact = (rootSessionId, factType, payload, operationId) => {
      const team = getTeam(rootSessionId)
      const seq = team.nextSequence++
      team.ledger.push({
        schemaVersion: 1,
        sequence: seq,
        rootSessionId: String(rootSessionId),
        factType,
        payload,
        ...(operationId !== undefined ? { operationId } : {}),
        createdAt: new Date().toISOString(),
      })
      return seq
    }

    const bumpTeamGeneration = (rootSessionId) => {
      const team = getTeam(rootSessionId)
      team.record.generation += 1
    }

    const setLifecycle = (teamSessionId, instanceId, next) => {
      const team = getTeam(teamSessionId)
      const member = team.members.get(instanceId)
      if (member === undefined) {
        throw typedError('unknown-member-instance', `no member instance '${instanceId}' in team '${teamSessionId}'`)
      }
      member.lifecycle = next
      const seq = appendFact(teamSessionId, 'lifecycle.changed', { instanceId, state: next })
      return { instanceId, lifecycle: next, effect: { factSequence: seq } }
    }

    const seedTeam = (rootSessionId, blueprintId, blueprintRevision) => {
      const now = new Date().toISOString()
      const record = {
        rootSessionId,
        blueprint: {
          blueprintId,
          revision: String(blueprintRevision ?? '1'),
          contentHash: `sha256:g8r2-${blueprintId}`,
        },
        defaultWorkspace: `/ws/g8r2-${rootSessionId}`,
        createdAt: now,
        generation: 1,
      }
      const team = {
        record,
        members: new Map(),
        ledger: [],
        nextSequence: 1,
      }
      teams.set(String(rootSessionId), team)
      // The leader is materialized with the team core (its birth is
      // subsumed by the `team.created` fact — no separate admission fact);
      // alpha/bravo are the two seeded member instances.
      const seedMembers = [
        { instanceId: LEADER_ID, label: 'Leader', childSessionId: null },
        { instanceId: 'inst-g8r2alpha', label: 'Alpha', childSessionId: 'child-g8r2-alpha' },
        { instanceId: 'inst-g8r2bravo', label: 'Bravo', childSessionId: 'child-g8r2-bravo' },
      ]
      for (const m of seedMembers) {
        team.members.set(m.instanceId, {
          instanceId: m.instanceId,
          templateId: m.instanceId === LEADER_ID ? FIX.leaderTemplateId : FIX.memberTemplateId,
          label: m.label,
          childSessionId: m.childSessionId,
          lifecycle: 'RUNNING',
          createdAt: now,
          activityVersion: 0,
        })
      }
      for (const m of seedMembers) {
        if (m.instanceId === LEADER_ID) continue // see above
        appendFact(rootSessionId, 'member.created', { instanceId: m.instanceId, label: m.label })
      }
      return record
    }

    // ── projection source assembly (in-memory stores -> P8-T2 source) ──
    const snapshotCache = new Map() // generation -> TeamDomainProjectionSource
    const controlPath = join(dshHome, 'g8r2-control.json')
    const readPin = () => {
      try {
        const raw = readFileSync(controlPath, 'utf8')
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed.pin === 'number' && Number.isSafeInteger(parsed.pin)) {
          return parsed.pin
        }
      } catch {
        /* no control file = live read */
      }
      return null
    }

    const readProjectionSource = (teamSessionId) => {
      const id = String(teamSessionId)
      const team = teams.get(id)
      if (team === undefined) {
        throw typedError('team-session-not-found', `no TeamSession record for root session id '${id}'`)
      }
      const pin = readPin()
      if (pin !== null && snapshotCache.has(pin)) {
        return snapshotCache.get(pin)
      }
      const rec = team.record
      const instances = [...team.members.values()].sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0))
      const entries = team.ledger.slice()
      const byCategory = {
        team: 0, member: 0, lifecycle: 0, message: 0,
        control: 0, policy: 0, compatibility: 0, progress: 0,
      }
      let latestSequence = 0
      for (const entry of entries) {
        const category = categoryOf(entry.factType)
        if (category !== null) byCategory[category] += 1
        if (entry.sequence > latestSequence) latestSequence = entry.sequence
      }
      const source = {
        teamSessionId: rec.rootSessionId,
        blueprint: { ...rec.blueprint },
        defaultWorkspace: rec.defaultWorkspace,
        createdAt: rec.createdAt,
        generation: rec.generation,
        root: {
          policyState: 'active',
          admission: 'OPEN',
          compatibility: helpers.rawCompatibility(),
          creationBudgetConsumed: 0,
        },
        templates: [helpers.rawLeaderTemplate(), helpers.rawMemberTemplate()],
        members: [
          helpers.rawLeaderMember({ createdAt: rec.createdAt }),
          ...instances
            .filter((m) => m.instanceId !== LEADER_ID)
            .map((m) => ({
              instanceId: m.instanceId,
              templateId: m.templateId,
              label: m.label,
              childSessionId: m.childSessionId,
              workspace: m.workspace,
              lifecycle: m.lifecycle,
              createdAt: m.createdAt,
              contextPolicy: 'fresh_per_delegation',
              effectiveConfig: helpers.rawEffectiveConfig(),
            })),
        ],
        ledger: helpers.rawLedger({
          latestSequence,
          totalEntries: entries.length,
          byCategory,
          pendingControlCount: entries.filter((e) => e.factType === 'control.requested').length,
        }),
      }
      snapshotCache.set(rec.generation, source)
      return source
    }

    // Deterministic injected clock (the product's own P8-T2 test option):
    // repeated raw reads are byte-stable, so E2.7 can deep-equal the
    // reconnected client's applied projection against a second raw truth.
    const projectionService = runtime.createProjectionService(
      { readProjectionSource },
      null,
      { clock: () => '2026-01-01T00:00:00.000Z' },
    )

    // ── the twelve backing ports (ALL synchronous, per D-2) ──────────────
    const deps = {
      // Port 3 — team.create (root binding over the in-memory store).
      teamCreate: {
        create(rootSessionId, blueprintId, blueprintRevision) {
          const id = String(rootSessionId)
          const existing = teams.get(id)?.record
          if (existing !== undefined) {
            return {
              path: 'cold-root',
              durable: existing,
              bind: {
                teamSessionId: existing.rootSessionId,
                rootSessionId: existing.rootSessionId,
                blueprintId: existing.blueprint.blueprintId,
                blueprintRevision: existing.blueprint.revision,
                boundAt: new Date().toISOString(),
              },
            }
          }
          const record = seedTeam(rootSessionId, blueprintId, blueprintRevision)
          // the team.created fact completes the seed (seq 3):
          appendFact(rootSessionId, 'team.created', { blueprintId, blueprintRevision: String(blueprintRevision ?? '1') })
          return {
            path: 'fresh-root',
            durable: record,
            bind: {
              teamSessionId: record.rootSessionId,
              rootSessionId: record.rootSessionId,
              blueprintId,
              blueprintRevision: String(blueprintRevision ?? '1'),
              boundAt: new Date().toISOString(),
            },
          }
        },
      },

      // Port 4 — projection (REAL P8-T2 service over the harness sources).
      projection: {
        project(teamSessionId) {
          return projectionService.project(teamSessionId)
        },
      },

      // Port 5 — ledger (per-root slicing, D-5).
      ledger: {
        listEntries(teamSessionId) {
          return getTeam(teamSessionId).ledger.map((e) => ({ ...e, payload: { ...e.payload } }))
        },
        countEntries(teamSessionId) {
          return getTeam(teamSessionId).ledger.length
        },
      },

      // Port 6 — admission (create-member / send-message / follow-up).
      admission: {
        performAction(request) {
          const rootSessionId = request.rootSessionId
          const team = getTeam(rootSessionId)
          if (request.action === 'create-member') {
            const payload = request.payload ?? {}
            const instanceId = typeof payload.instanceId === 'string' && payload.instanceId.length > 0
              ? payload.instanceId
              : `inst-g8r2auto${Math.floor(Math.random() * 1_000_000)}`
            if (instanceId.length > 128 || /\s/.test(instanceId)) {
              throw typedError('invalid-instance-id', `member instance id failed the id rules: ${instanceId}`)
            }
            if (team.members.has(instanceId)) {
              throw typedError('member-already-exists', `member instance already exists: ${instanceId}`)
            }
            const label = typeof payload.label === 'string' && payload.label.length > 0 ? payload.label : `Member ${instanceId}`
            const childSessionId = typeof payload.childSessionId === 'string' && payload.childSessionId.length > 0
              ? payload.childSessionId
              : `child-g8r2-${instanceId}`
            team.members.set(instanceId, {
              instanceId,
              templateId: typeof payload.templateId === 'string' && payload.templateId.length > 0 ? payload.templateId : FIX.memberTemplateId,
              label,
              childSessionId,
              lifecycle: 'RUNNING',
              createdAt: new Date().toISOString(),
              activityVersion: 0,
            })
            const seq = appendFact(rootSessionId, 'member.created', { instanceId, label }, request.requestToken)
            bumpTeamGeneration(rootSessionId)
            return { status: 'accepted', instanceId, effect: { factSequence: seq } }
          }
          if (request.action === 'send-message' || request.action === 'follow-up') {
            const recipient = request.targetInstanceId
            if (typeof recipient !== 'string' || recipient.length === 0) {
              throw typedError('invalid-recipient', 'send-message requires a recipientInstanceId')
            }
            if (!team.members.has(recipient)) {
              throw typedError('unknown-member-instance', `no member instance '${recipient}' in team '${rootSessionId}'`)
            }
            const from =
              request.caller !== undefined && request.caller.kind === 'instance'
                ? request.caller.instanceId
                : request.caller !== undefined && request.caller.kind === 'human'
                  ? request.caller.humanId
                  : 'unknown-caller'
            const seq = appendFact(
              rootSessionId,
              'message.sent',
              {
                from,
                to: recipient,
                ...(request.body !== undefined ? { body: request.body } : {}),
                ...(request.subject !== undefined ? { subject: request.subject } : {}),
              },
              request.requestToken,
            )
            return { status: 'accepted', deliveredTo: recipient, effect: { factSequence: seq } }
          }
          throw typedError('unsupported-action', `unsupported admission action: ${String(request.action)}`)
        },
      },

      // Port 7 — lifecycle (member store; not exercised by E1-E6).
      lifecycle: {
        archive(teamSessionId, instanceId) { return setLifecycle(teamSessionId, instanceId, 'ARCHIVED') },
        restore(teamSessionId, instanceId) { return setLifecycle(teamSessionId, instanceId, 'SETTLED') },
        dispose(teamSessionId, instanceId) { return setLifecycle(teamSessionId, instanceId, 'DISPOSED') },
      },

      // Ports 8/9/10/11/12 + Port 1/2 — deterministic minimal bindings
      // (documented above; dispatcher invariants apply to all of them).
      catalog: {
        list() {
          return [{ blueprintId: FIX.blueprintId, revisions: [Number(FIX.blueprintRevision)] }]
        },
        get(blueprintId, blueprintRevision) {
          if (blueprintId !== FIX.blueprintId) {
            throw typedError('blueprint-not-found', `no blueprint '${blueprintId}' in the harness catalog`)
          }
          return {
            blueprintId,
            revision: String(blueprintRevision ?? FIX.blueprintRevision),
            contentHash: `sha256:g8r2-${blueprintId}`,
          }
        },
      },
      intent: {
        probe(blueprintId, blueprintRevision, environmentFacts) {
          return {
            blueprintId,
            blueprintRevision: String(blueprintRevision ?? FIX.blueprintRevision),
            environmentFacts: [...environmentFacts],
            status: 'compatible',
            mismatches: [],
          }
        },
      },
      override: {
        get() { return null },
        set(request) {
          return {
            status: 'stored',
            teamSessionId: request.teamSessionId,
            capability: request.capability,
            value: request.value,
            actor: request.actor,
            storedAt: new Date().toISOString(),
          }
        },
        reset() { return { removed: false } },
      },
      policyState: {
        read(teamSessionId) {
          return { teamSessionId, state: 'active', transitions: [] }
        },
        switchState(request) {
          return {
            teamSessionId: request.teamSessionId,
            from: 'active',
            to: request.target,
            actor: request.actor,
            at: new Date().toISOString(),
          }
        },
      },
      compatibility: {
        current() { return helpers.rawCompatibility() },
        acknowledge() { return helpers.rawCompatibility() },
        probe(teamSessionId, trigger) {
          return { teamSessionId, trigger, verdict: helpers.rawCompatibility() }
        },
      },
      handoff: {
        prepareSource(sourceSessionId) {
          return {
            sourceSessionId,
            frozenAt: new Date().toISOString(),
            summary: { messages: 0, artifacts: 0 },
          }
        },
        start(sourceSessionId, requestToken) {
          return { status: 'replayed', sourceSessionId, requestToken }
        },
      },
      legacy: {
        inspect(dshHomeArg) {
          return { status: 'native-fallback', dshHome: dshHomeArg }
        },
      },
    }

    const connection = ctx.get('connection')
    if (connection === undefined || typeof connection.rpc?.handle !== 'function') {
      throw new Error('g8r2 row: host service connection (rpc seam) is unavailable')
    }
    ctx.effect(
      () => {
        const reg = remote.registerRemoteHandlers(connection, deps)
        return () => reg.dispose()
      },
      'g8r2: team-remote rpc channel',
    )
    writeFileSync(
      join(dshHome, 'g8r2-row-activated.json'),
      JSON.stringify({
        ok: true,
        at: new Date().toISOString(),
        channel: remote.REMOTE_RPC_CHANNEL,
        ports: Object.keys(deps).length,
        contractVersion: remote.REMOTE_CONTRACT_VERSION,
      }, null, 2),
    )
  } catch (error) {
    fail(error)
  }
}
