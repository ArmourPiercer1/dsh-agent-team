/**
 * Alpha.6 PR-I1a real-host probe row — drives the SHIPPED durable writer over the host's real storage domain.
 *
 * WHY THIS ROW EXISTS. PR-I1a's writer is dormant: it has zero production callers, so no product seam reaches
 * it, and every one of its durability legs was measured over `p4-helpers`' in-memory seam (grade C1). The claim
 * that stayed unpaid was the one only a real Host can pay: a row written through `applyReviewAssignment` lands
 * in the host's own durable storage domain, survives a REAL process restart, and is read back by a FRESH
 * process that never saw the write. This row mounts the built artifacts of THIS worktree through the public
 * profile-patch seam (CORE PATCH BUDGET = 0), opens `team_domain` over the injected `storageDomain` service,
 * and answers those questions in a live host.
 *
 * WHAT IS AND IS NOT THE PRODUCT HERE:
 *   - the writer, the ledger repository, the TeamSession repository and the contracts parsers are the built
 *     artifacts this PR ships (`packages/runtime/dist/...`) — not a re-implementation;
 *   - the seam is `packages/runtime/root-binding/harness/seam.mjs`, the same public-`storageDomain` seam the
 *     production row is configured with through `seamUrl`;
 *   - what this row adds is a SCENARIO (which commands, in which order) and a report file. It is a probe, and
 *     the report says so. It is not a caller of the writer in the dormancy sense: the dormancy walk covers
 *     `packages/**`, and a kit under `tests/kits/` is outside that universe — disclosed, not smuggled.
 *
 * Two modes, one per boot, so the restart crosses a real process boundary:
 *   `write`   — create the domain, seed one TeamSession row, write created/transferred/retired through the
 *               writer, replay the last command, read everything back in the same process. The report
 *               carries this process's kernel identity (`process.pid`, the `exec -a` marker in argv0, and a
 *               per-module nonce) so the reopen leg has something to assert against.
 *   `restart` — open the SAME domain in a NEW host process, list the FULL rows (payload included), replay
 *               the FIRST command, and write one fresh family. The driver hands this mode the boot-1
 *               pid/marker (`previousBootPid` / `previousBootArgv0`); the reopen step asserts THIS
 *               process's identity differs from both, and the driver re-grades the two reported pids
 *               against the two child pids it spawned itself.
 */

import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'

export const name = 'a6pri1a-probe'
export const inject = ['storageDomain', 'webServer']

const BOOT = process.hrtime.bigint()

/**
 * Per-process identity (F-I1a1-1, round 2). This module is evaluated once per host process, so `nonce`
 * is a fresh-module-instance marker; `process.pid` is the kernel's process identity; `process.argv0` is
 * the per-boot exec marker the driver passed through `exec -a`. The reopen leg asserts against all three
 * — none of them is a constant the probe could hand out without actually being a different process.
 */
const PROCESS_IDENTITY = Object.freeze({ pid: process.pid, argv0: process.argv0 ?? null, nonce: randomUUID() })

/** @type {{state:string, detail:string, report?:object}} */
let progress = { state: 'starting', detail: 'apply entered' }
/** @type {object|null} */
let report = null

const elapsedMs = () => Number(process.hrtime.bigint() - BOOT) / 1e6

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

/** The report file is the evidence channel; the route is only the readiness channel. */
function emit(ctx, config, body) {
  report = body
  progress = { state: body.state, detail: body.detail ?? '', report: body }
  try {
    writeFileSync(config.reportPath, JSON.stringify(body, null, 2))
  } catch (error) {
    progress = { state: 'report-write-failed', detail: `${progress.detail} :: report write: ${String(error)}` }
  }
}

export async function apply(ctx, config) {
  const webServer = ctx.get('webServer')
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__a6pri1a/health',
    handler: (req, res) => sendJson(res, 200, {
      ok: report?.state === 'done',
      mode: config?.mode ?? null,
      elapsedMs: elapsedMs(),
      state: progress.state,
      detail: progress.detail,
    }),
  }, 'a6pri1a probe health route'), 'a6pri1a probe health route disposal')

  emit(ctx, config, { state: 'running', mode: config?.mode ?? null, detail: 'apply registered the health route', steps: [] })
  // Let the response for the readiness route be reachable before heavy work parks the tick.
  await new Promise((resolve) => setTimeout(resolve, 250))

  const steps = []
  const step = (id, ok, measured) => { steps.push({ id, ok: ok === true, measured: String(measured) }) }
  try {
    const dist = new URL(config.distRoot)
    const contracts = await import(new URL('contracts/src/index.js', dist))
    const teamDomainModule = await import(new URL('storage/repositories/team-domain.js', dist))
    const stores = await import(new URL('storage/schema/stores.js', dist))
    const writer = await import(new URL('runtime/review-assignment/writer.js', dist))
    const seamModule = await import(new URL(config.seamUrl ?? '../../../packages/runtime/root-binding/harness/seam.mjs', import.meta.url))

    const storageDomain = ctx.get('storageDomain')
    if (storageDomain === undefined || storageDomain === null) {
      emit(ctx, config, { state: 'failed', mode: config.mode, detail: 'the storageDomain public service is absent', steps })
      return
    }
    const seam = seamModule.createRealStorageDomainSeam(storageDomain)
    // F-I1a1-1 round 2: a real predicate over the observed seam surface, not the literal `true`.
    const seamSurface = { open: typeof seam?.open, closeAll: typeof seam?.closeAll }
    step('real-seam-built', seamSurface.open === 'function' && seamSurface.closeAll === 'function',
      `createRealStorageDomainSeam over the injected storageDomain service (open: ${seamSurface.open}, closeAll: ${seamSurface.closeAll})`)

    const rootSessionId = config.rootSessionId
    const root = contracts.parseRootSessionId(rootSessionId)

    /** The writer's port, composed here — the thin adapter the lane deliberately does not own. */
    const ledgerPort = (domain) => ({
      allocateSequence: () => domain.repositories.ledger.allocateSequence(),
      put: (draft) => domain.repositories.ledger.put({
        schemaVersion: stores.TEAM_DOMAIN_SCHEMA_VERSION,
        sequence: draft.sequence,
        rootSessionId: contracts.parseRootSessionId(draft.rootSessionId),
        factType: draft.factType,
        payload: draft.payload,
        createdAt: draft.createdAt,
      }),
      list: () => domain.repositories.ledger.list().map((entry) => ({
        sequence: entry.sequence,
        rootSessionId: entry.rootSessionId,
        factType: entry.factType,
        payload: entry.payload,
      })),
    })

    /** A real per-root mutex: this row is the only writer, and the port still gets a real queue. */
    let tail = Promise.resolve()
    const held = { depth: 0, peak: 0, acquires: 0 }
    const lock = {
      withLock(target, critical) {
        held.acquires += 1
        const run = tail.then(async () => {
          held.depth += 1
          held.peak = Math.max(held.peak, held.depth)
          try {
            return await critical()
          } finally {
            held.depth -= 1
          }
        })
        tail = run.then(() => undefined, () => undefined)
        return run
      },
    }

    let clockTicks = 0
    const clock = () => new Date(Date.parse('2026-10-31T00:00:00.000Z') + (clockTicks += 1) * 1000).toISOString()

    const command = (overrides) => ({
      kind: 'created',
      rootSessionId,
      approvalCaseId: config.approvalCaseId ?? 'approval-case-a6pri1a',
      currentLegRequestId: 'leg-request-1',
      target: { kind: 'instance', instanceId: 'inst-alpha' },
      reasonCode: 'ROUTER_PLAN_COVERS_ACTION',
      basedOnCaseVersion: 'case-version-1',
      actorCallerRef: 'caller:leader',
      ...overrides,
    })

    if (config.mode === 'write') {
      const domain = await teamDomainModule.createTeamDomain(seam)
      // F-I1a1-1 round 2: real predicate — the name comes back from the host's own opened handle, and the
      // process identity is recorded so the driver can grade boot 1 vs boot 2 across the restart.
      step('domain-created-real-medium', domain.name === 'team_domain',
        `createTeamDomain opened "${domain.name}" over the host storageDomain service (pid ${PROCESS_IDENTITY.pid}, argv0 ${String(PROCESS_IDENTITY.argv0)})`)

      const blueprint = contracts.createBlueprintSnapshotRef({
        blueprintId: contracts.parseBlueprintId('A6PRI1A-PROBE'),
        revision: contracts.parseBlueprintRevision('1'),
        contentHash: contracts.parseBlueprintContentHash('sha256-a6pri1aprobe000000000000000000000000000000'),
      })
      await domain.repositories.teamSessions.put({
        blueprint,
        createdAt: '2026-10-31T00:00:00.000Z',
        defaultWorkspace: config.workspace,
        generation: 1,
        rootSessionId: root,
      })
      const generationBefore = domain.repositories.teamSessions.get(root)?.generation ?? null
      step('team-session-row-seeded', generationBefore !== null, `team_sessions.generation before the writes = ${String(generationBefore)}`)

      const deps = { ledger: ledgerPort(domain), lock, now: clock }

      const created = await writer.applyReviewAssignment(deps, command({}))
      step('write-created', created.ok === true, JSON.stringify(created.ok
        ? { applied: created.applied, sequence: created.sequence, epoch: created.assignmentEpoch }
        : { refusal: created.refusal, detail: created.detail }))

      const replay = await writer.applyReviewAssignment(deps, command({}))
      step('replay-same-command', replay.ok === true && replay.applied === 'already' && replay.sequence === created.sequence,
        JSON.stringify(replay.ok
          ? { applied: replay.applied, sequence: replay.sequence, epoch: replay.assignmentEpoch }
          : { refusal: replay.refusal, detail: replay.detail }))

      const transferred = await writer.applyReviewAssignment(deps, command({
        kind: 'transferred', target: { kind: 'instance', instanceId: 'inst-beta' },
      }))
      step('write-transferred', transferred.ok === true && transferred.assignmentEpoch === 2, JSON.stringify(transferred.ok
        ? { applied: transferred.applied, sequence: transferred.sequence, epoch: transferred.assignmentEpoch }
        : { refusal: transferred.refusal, detail: transferred.detail }))

      const retired = await writer.applyReviewAssignment(deps, command({
        kind: 'retired', target: { kind: 'instance', instanceId: 'inst-beta' },
      }))
      step('write-retired', retired.ok === true && retired.assignmentEpoch === 3, JSON.stringify(retired.ok
        ? { applied: retired.applied, sequence: retired.sequence, epoch: retired.assignmentEpoch }
        : { refusal: retired.refusal, detail: retired.detail }))

      const generationAfter = domain.repositories.teamSessions.get(root)?.generation ?? null
      const expectedWrites = [created, transferred, retired].filter((r) => r.ok && r.applied === 'written').length
      step('generation-advanced-per-write', generationAfter === generationBefore + expectedWrites,
        `generation ${String(generationBefore)} -> ${String(generationAfter)} across ${String(expectedWrites)} durable write(s); the replay added none`)

      // F-I1a1-3 round 2: report the FULL ledger rows (schemaVersion, sequence, rootSessionId, factType,
      // payload, createdAt — whatever `list()` hands back), not a six-field projection. The cross-boot
      // "byte-identical" leg then compares the payload too, instead of only naming it.
      const rows = domain.repositories.ledger.list().map((entry) => ({ ...entry }))
      step('rows-in-real-ledger', rows.length === 3, `${String(rows.length)} row(s): ${rows.map((r) => `${String(r.sequence)}:${r.factType}@${String(r.payload?.assignmentEpoch)}`).join(', ')}`)
      step('foreign-roots-absent', rows.every((r) => r.rootSessionId === rootSessionId),
        `every row carries the written root (${rows.length === 0 ? 'no rows' : 'one root'})`)

      const owned = await domain.repositories.ledger.list().length
      // F-I1a1-1 round 2: the close step reports what close() actually did, not a constant `true`.
      let closeError = null
      try {
        await domain.close()
      } catch (error) {
        closeError = `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`
      }
      step('domain-closed', closeError === null, closeError === null
        ? `domain closed cleanly after ${String(owned)} durable row(s); the report is the handoff to boot 2`
        : `domain.close() THREW after ${String(owned)} durable row(s): ${closeError}`)

      emit(ctx, config, {
        state: 'done', mode: 'write', detail: 'wrote the family through the shipped writer over the real medium',
        rootSessionId, lock: held, steps, process: PROCESS_IDENTITY,
        writes: { created, replay, transferred, retired }, rows,
        generation: { before: generationBefore, after: generationAfter },
      })
      return
    }

    if (config.mode === 'restart') {
      // F-I1a1-1 round 2: `domain-reopened-fresh-process` was `step(id, true, …)` — a check that could
      // only go red if the probe died. It is now a real predicate: the driver hands this boot the pid
      // and argv0 marker of the boot-1 process (which the boot-1 probe itself recorded), and the step
      // asserts THIS process's kernel identity differs from both. The driver independently re-grades
      // the two reported pids against the two pids it spawned, so neither end can fake the other.
      const previousBootPid = Number(config.previousBootPid)
      const previousBootArgv0 = typeof config.previousBootArgv0 === 'string' ? config.previousBootArgv0 : null
      const freshProcess = Number.isInteger(previousBootPid) && previousBootPid > 0 && previousBootPid !== process.pid
        && previousBootArgv0 !== null && previousBootArgv0 !== process.argv0
      const domain = await teamDomainModule.openTeamDomain(seam)
      step('domain-reopened-fresh-process', freshProcess,
        `openTeamDomain reopened "${domain.name}" in THIS process (pid ${PROCESS_IDENTITY.pid}, argv0 ${String(PROCESS_IDENTITY.argv0)}, nonce ${PROCESS_IDENTITY.nonce}); ` +
        `boot 1 ran as pid ${String(config.previousBootPid)}, argv0 ${String(config.previousBootArgv0)} — different process: ${String(freshProcess)}`)

      // Full rows again (F-I1a1-3): the cross-boot comparison covers payload bytes, not a projection.
      const rows = domain.repositories.ledger.list().map((entry) => ({ ...entry }))
      step('rows-survived-restart', rows.length === 3, `${String(rows.length)} row(s) read back after the restart: ${rows.map((r) => `${String(r.sequence)}:${r.factType}@${String(r.payload?.assignmentEpoch)}`).join(', ')}`)

      const generation = domain.repositories.teamSessions.get(root)?.generation ?? null
      step('generation-durable', typeof generation === 'number', `team_sessions.generation in the fresh process = ${String(generation)}`)

      const deps = { ledger: ledgerPort(domain), lock, now: clock }
      const replayFirst = await writer.applyReviewAssignment(deps, command({}))
      step('replay-after-restart-answers-already', replayFirst.ok === true && replayFirst.applied === 'already',
        JSON.stringify(replayFirst.ok
          ? { applied: replayFirst.applied, sequence: replayFirst.sequence, epoch: replayFirst.assignmentEpoch }
          : { refusal: replayFirst.refusal, detail: replayFirst.detail }))

      const rowsAfterReplay = domain.repositories.ledger.list().length
      step('replay-wrote-nothing', rowsAfterReplay === rows.length, `ledger holds ${String(rowsAfterReplay)} row(s) after the replay (was ${String(rows.length)})`)

      // A real second live process now writes: the sequence must continue the chain, not restart it.
      // Round 2 (F-I1a1-7): `> previousMax` passed a jump to 9; the expected value is exact now.
      const previousMax = rows.length > 0 ? Math.max(...rows.map((r) => r.sequence)) : 0
      const fresh = await writer.applyReviewAssignment(deps, command({
        kind: 'created', approvalCaseId: `${config.approvalCaseId ?? 'approval-case-a6pri1a'}-second`,
      }))
      step('new-family-writes-after-restart', fresh.ok === true && fresh.sequence === previousMax + 1,
        JSON.stringify(fresh.ok
          ? { applied: fresh.applied, sequence: fresh.sequence, epoch: fresh.assignmentEpoch, previousMax, expected: previousMax + 1 }
          : { refusal: fresh.refusal, detail: fresh.detail }))

      await domain.close()
      emit(ctx, config, {
        state: 'done', mode: 'restart', detail: 'reopened the medium in a fresh process and folded it',
        rootSessionId, lock: held, steps, process: PROCESS_IDENTITY,
        rows, generation, replayFirst, fresh,
      })
      return
    }

    emit(ctx, config, { state: 'failed', mode: config.mode ?? null, detail: `unknown mode ${String(config.mode)}`, steps })
  } catch (error) {
    emit(ctx, config, {
      state: 'failed', mode: config?.mode ?? null,
      detail: `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}`,
      stack: typeof error?.stack === 'string' ? error.stack.split('\n').slice(0, 6).join(' | ') : null,
      steps,
    })
  }
}
