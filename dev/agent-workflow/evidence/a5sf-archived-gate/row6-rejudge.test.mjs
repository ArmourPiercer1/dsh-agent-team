/**
 * row6-rejudge.test.mjs — host-free re-judgement of Search row 6 AFTER the
 * durable-lifecycle gate (`memberResumeRefusal` in agent-bindings.mjs).
 *
 * What is proven, in this order, per archived run:
 *
 *   A. THE ARCHIVED BYTES ARE UNCHANGED HISTORY. Re-judging the diagnosis's
 *      archived sample with the SHIPPED judge still returns REFUTED with the
 *      same five clauses. Nothing below rewrites `row6-samples/`.
 *
 *   B. THE SAME STIMULUS AGAINST THE FIXED PRODUCT RETURNS THE REFUSAL. The
 *      archived member row is replayed in a host-free world (t12a bridge,
 *      the REAL glue): go live while SETTLED, commit the durable ARCHIVED
 *      row, drop residency (the archive quiesce step), then dispatch the two
 *      archived probes (`grep`, `glob`) through the SAME public seam the
 *      `/__p6t6/tool` route calls (`live.executeTool`). Both replies are the
 *      route's exact 422 mapping of `NO_LIVE_AGENT`; the refusal message
 *      names the ARCHIVED lifecycle; ZERO resumes and ZERO tool executions
 *      happen after the archive boundary.
 *
 *   C. THE JUDGE FLIPS FOR THE RIGHT REASON. The archived sample's own
 *      archive / membersAfter / stopInstant / pre-stop facts / teardown
 *      process seam are kept VERBATIM; only the three post-boundary
 *      measurements are replaced by B (the two probe replies, the probe
 *      guard facts = none, the post-boundary spawns = none). `judgeRow6`
 *      then returns PROVEN. The five clauses that were false in A flip
 *      because the serving dispatch is now a typed refusal, not because the
 *      environment stopped producing facts: B measured `resumes === 0` and
 *      `toolExecutions === 0`, so no guard could be consulted and no tool
 *      (hence no subprocess) could run.
 *
 * The substitution is printed and stored in row6-rejudge.json; it is a
 * POST-FIX sample, clearly not a rewrite of the archived one.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { judgeRow6, SEARCH_CASE_IDS } from '../../../../tests/world-factory/lib/a5sf-search-live.mjs'
import { createLiveWorld } from '../../../../packages/runtime/test/t12a-live-bridge.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEARCH = join(HERE, '..', 'a5sf-search-live')
/** The id the archived runs used before the 2026-11-05 wording fix. */
const LEGACY_ROW6 = 'live:search-row6-teardown-no-callable-shadow'
const SAMPLES = ['2026-11-04T20-10-19Z', '2026-11-04T20-17-23Z']
const json = (path) => JSON.parse(readFileSync(path, 'utf8'))

/** Find the row-6 key in a cases map (new id, then the legacy alias). */
function row6Key(cases) {
  return Object.keys(cases ?? {}).find((key) => key === SEARCH_CASE_IDS.row6)
    ?? Object.keys(cases ?? {}).find((key) => key === LEGACY_ROW6)
}

/**
 * Reconstruct the archived row-6 sample exactly as row6-replay.mjs does
 * (display copy is count-reduced; the full arrays live in teardown.json).
 */
function loadArchived(stamp) {
  const dir = join(SEARCH, 'row6-samples', stamp)
  const record = json(join(dir, 'run-record.json'))
  const teardown = json(join(dir, 'teardown.json'))
  const oracle = json(join(dir, 'oracle-samples.json'))
  const id = row6Key(Object.fromEntries((record.cases ?? []).map((c) => [c.id, c])))
  const row6Case = record.cases.find((c) => c.id === id)
  if (row6Case === undefined) throw new Error(`${stamp}: no row 6 in the run record`)
  const archivedSample = oracle.cases[row6Key(oracle.cases)]?.sample
  if (archivedSample === undefined) throw new Error(`${stamp}: no archived oracle sample for row 6`)
  const member = archivedSample.member
  const sample = {
    member,
    archive: teardown.archive,
    membersAfter: teardown.membersAfterArchive,
    postStopDispatches: teardown.postStopDispatches,
    facts: archivedSample.facts,
    probeFacts: teardown.probeFacts,
    stopInstant: row6Case.detail.stopInstant,
    observations: teardown.observations,
    managed: { sessionId: member.childSessionId, realmLabel: `member:${member.instanceId}` },
    duringManagedDisposal: true,
    managedRealmCount: 1,
    hostAlive: row6Case.detail.host.hostAlive,
    portStillListening: teardown.processSeam.portStillListening,
    homeDeleted: teardown.processSeam.homeExistsAfterTeardown === false,
    orphanPids: teardown.processSeam.orphanPids,
    confinedSpawnsAfterStop: new Array(Number(row6Case.detail.confinedSpawnsAfterStop ?? 0)),
    baseSpawnsAfterStop: new Array(Number(row6Case.detail.baseSpawnsAfterStop ?? 0)),
  }
  return { dir, record, teardown, row6Case, sample }
}

/** The archived driver's two post-stop probes, args verbatim (run-boot.mjs:1656-1665). */
function probeRequests(record) {
  const f = record.fixtures
  return [
    {
      name: 'grep',
      args: { pattern: record.claims.needle, path: f.inLaneDir },
      callId: 'a5sfsrch-post-stop-grep',
    },
    {
      name: 'glob',
      args: { pattern: 'needle.txt', path: f.globDir },
      callId: 'a5sfsrch-post-stop-glob',
    },
  ]
}

/** The exact `/__p6t6/tool` status/body mapping (packages/tools/harness/plugin.mjs:383-404). */
async function routeReply(binding, sessionId, request) {
  try {
    const outcome = await binding.executeTool(sessionId, request)
    if (outcome.isError === true) {
      return { status: 200, body: { ok: false, error: { message: outcome.error.message, ...(outcome.error.info !== undefined ? { info: outcome.error.info } : {}) } } }
    }
    return { status: 200, body: { ok: true, value: outcome.value } }
  } catch (error) {
    if (error?.code === 'NO_LIVE_AGENT') {
      return { status: 422, body: { error: `no live agent for '${sessionId}': ${error.message}` } }
    }
    if (error?.code === 'CONSUMPTION_BOUNDARY') {
      return { status: 500, body: { error: `durable consumption boundary failed for '${sessionId}': ${error.message}` } }
    }
    return { status: error?.code === 'TOOLS_EXECUTE' ? 500 : 500, body: { error: String(error?.message ?? error) } }
  }
}

/**
 * B: replay the archived stimulus against the FIXED product. Returns the
 * route replies plus the measured zero-resume / zero-tool-execution facts.
 */
async function fixedSeamReplies(loaded) {
  const { sample, teardown, record } = loaded
  const member = sample.member
  const root = String(teardown.archive.body.value.rootSessionId)
  const child = String(member.childSessionId)
  const world = await createLiveWorld({
    rootSessionId: root,
    members: [{ instanceId: member.instanceId, childSessionId: child, templateId: 'tpl-t12a', lifecycle: 'SETTLED' }],
    persistence: { exists: () => true },
  })
  try {
    // The Member is live in SETTLED before the archive boundary (the pre-archive state).
    const handle = await world.binding.ensureLiveAgent(child)
    const toolExecutions = handle.agent.ctx.toolExecutions
    // The durable ARCHIVED commit + the archive quiesce's residency release
    // (quiesce.ts step 5 -> residency.dropResidency; the exact two effects the
    // archived run recorded).
    const rows = world.domain.repositories.memberInstances.list(root)
    rows[0].lifecycle = 'ARCHIVED'
    await world.binding.dropResidency(child)
    const before = {
      resumes: world.agents.resumes.length,
      creates: world.agents.creates.length,
      toolExecutions: toolExecutions.length,
    }
    const replies = []
    for (const request of probeRequests(record)) {
      replies.push(await routeReply(world.binding, child, request))
    }
    // The in-process seam keeps the TYPED code (the route collapses it to
    // NO_LIVE_AGENT by design; executeTool's message still names ARCHIVED).
    let directCode = null
    try {
      await world.binding.ensureLiveAgent(child)
    } catch (error) {
      directCode = error?.code ?? null
    }
    const after = {
      resumes: world.agents.resumes.length,
      creates: world.agents.creates.length,
      toolExecutions: toolExecutions.length,
    }
    return {
      rootSessionId: root,
      childSessionId: child,
      replies,
      directCode,
      before,
      after,
      delta: {
        resumes: after.resumes - before.resumes,
        creates: after.creates - before.creates,
        toolExecutions: after.toolExecutions - before.toolExecutions,
      },
    }
  } finally {
    await world.binding.close().catch(() => undefined)
  }
}

describe('row 6 re-judge — the archived samples flip because the seam refuses', () => {
  it('archived bytes stay REFUTED; the fixed seam produces the refusal; the judge flips to PROVEN', async () => {
    const results = []
    for (const stamp of SAMPLES) {
      const loaded = loadArchived(stamp)
      const archived = loaded.sample
      const replayed = judgeRow6(archived)

      // A — the archived run is history: the shipped judge still refutes the
      // recorded serving dispatch (200 ok:true on `glob`).
      expect(replayed.verdict, `${stamp}: the archived bytes must stay REFUTED`).toBe('REFUTED')
      expect(replayed.failed).toContain('everyDispatchExplained')

      // B — the same stimulus against the fixed product.
      const seam = await fixedSeamReplies(loaded)
      expect(seam.replies.map((r) => r.status), `${stamp}: both probes must be 422`).toEqual([422, 422])
      for (const reply of seam.replies) {
        expect(reply.body.ok, `${stamp}: a refusal must never carry ok:true`).toBeUndefined()
        expect(reply.body.error).toMatch(/ARCHIVED MemberInstance/u)
        expect(reply.body.error).toMatch(/PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED|explicit restore is required/u)
      }
      expect(seam.directCode, `${stamp}: the in-process seam must keep the typed code`).toBe('PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED')
      expect(seam.delta.resumes, `${stamp}: the gate must not resume the archived Member`).toBe(0)
      expect(seam.delta.creates, `${stamp}: the gate must not create an Agent`).toBe(0)
      expect(seam.delta.toolExecutions, `${stamp}: no tool may execute after the archive boundary`).toBe(0)

      // C — keep every archived field VERBATIM except the three post-boundary
      // measurements B just made; judge with the shipped judge.
      const fixedSample = {
        ...archived,
        postStopDispatches: seam.replies,
        probeFacts: [],
        confinedSpawnsAfterStop: [],
        baseSpawnsAfterStop: [],
      }
      const fixed = judgeRow6(fixedSample)
      expect(fixed.verdict, `${stamp}: fixed verdict failed on ${JSON.stringify(fixed.detail?.checks ?? fixed.failed)}`).toBe('PROVEN')
      expect(fixed.checks.everyDispatchExplained).toBe(true)
      expect(fixed.checks.noSuccessAfterStop).toBe(true)
      expect(fixed.checks.noCallableShadow).toBe(true)
      expect(fixed.checks.probeFactsAreRefusals).toBe(true)
      expect(fixed.checks.noProcessAfterStop).toBe(true)
      expect(fixed.checks.archivedLifecycle, `${stamp}: the archive fact is the archived one`).toBe(true)
      expect(fixed.checks.noFactAfterStop, `${stamp}: archived pre-stop facts are kept verbatim`).toBe(true)

      results.push({
        stamp,
        runId: loaded.record.runId,
        archivedVerdict: { verdict: replayed.verdict, reason: replayed.reason, failed: replayed.failed },
        boundary: archived.stopInstant,
        archive: { status: archived.archive.status, effect: archived.archive.body?.value?.effect ?? null },
        fixedSeam: seam,
        fixedVerdict: {
          verdict: fixed.verdict,
          reason: fixed.reason,
          checks: fixed.checks,
          postStop: fixed.detail.postStop,
        },
        substitutions: {
          postStopDispatches: 'MEASURED by the fixed seam in this arm (the archived replies are the pre-fix history)',
          probeFacts: 'MEASURED empty (no tool execution -> no guard consult)',
          confinedSpawnsAfterStop: 'MEASURED empty (toolExecutions delta 0 -> no tool/subprocess)',
          baseSpawnsAfterStop: 'MEASURED empty (same)',
          everythingElse: 'VERBATIM from the archived sample (member, archive, membersAfter, stopInstant, facts, observations, process seam)',
        },
      })
    }

    writeFileSync(
      join(HERE, 'row6-rejudge.json'),
      `${JSON.stringify({
        schema: 'a5sf-archived-gate/row6-rejudge/1',
        generatedAt: new Date().toISOString(),
        judge: 'tests/world-factory/lib/a5sf-search-live.mjs#judgeRow6 (unmodified)',
        rowId: SEARCH_CASE_IDS.row6,
        legacyRowId: LEGACY_ROW6,
        results,
      }, null, 2)}\n`,
      'utf8',
    )
  })
})
