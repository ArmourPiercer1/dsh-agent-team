/**
 * tests/world-factory/suites/070-u7-fagentb.mjs — the `u7-fagentb` C2 suite
 * (U7-F B): the AGENT-STATE family's live MOUNT LAW at the real host, TWO
 * boots (budget: THREE declared, TWO used — recorded in the run record).
 *
 * Verdict law: the runner's OWN reads of the host log + the mock
 * transcript — the host never reports about itself, and silence FAILS.
 *
 *  A) ZERO FLIP (key ABSENT): the proven u7-fs-mut world shape mounts its
 *     governed plane exactly as shipped (the placement-feed witness rows
 *     are the same rows master mounts), NOTHING of the agent-state family
 *     appears anywhere in the log, and `todo_write` rides the model
 *     surface as the HOST NATIVE (disabledOwned is empty — the family
 *     claims nothing while the closed boolean key is absent).
 *  B) ENABLED WITHOUT A STORE (key TRUE on production wiring): the
 *     production binder passes `backends` for the jobs bridge ONLY —
 *     there is no agent-state store adapter on this tree and this lane
 *     edits no binder line — so the family's build answers
 *     `PLANE_AGENT_STATE_STORE_MISSING` and the REAL host refuses the
 *     whole plane mount with the typed code (a thrown mount, never a
 *     degraded one), leaving zero placement-feed rows and zero family
 *     witnesses behind.
 *
 * DISCLOSED VERBATIM (the suite evidence carries this text; the PR body
 * repeats it; it is NEVER coloured PASS): the ENABLED-AND-STORE-MOUNTED
 * positive legs — authorized read, authorized mutation with the durable
 * fact read back, refused cross-scope write with zero reach — have no
 * production seam on this tree. `agent-bindings.mjs` wires no
 * `backends.agentState`; mounting a durable store adapter is a separate
 * named binder lane, and this family self-mounts nothing. Those legs are
 * PROVEN at C1 over the real plane and the real kernel grant
 * (packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts: the ask-
 * default governed chain with the minted one-shot grant, the recorded
 * durable fact, the planted cross-scope zero-reach proof, the full
 * transition table with zero durable writes).
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../lib/u6-fs-assembly.mjs'
import { makeFsMutDecide } from '../lib/u7-fsmut-assembly.mjs'
import { createFAgentBAssembly, judgeU7FAgentB } from '../lib/u7fagentb-assembly.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CASES = Object.freeze(['agt:zero-flip-mount', 'agt:native-ride-witness', 'agt:enabled-mount-refused', 'agt:enabled-zero-plane', 'agt:leak-check'])

const CODE_RE = /PLANE_AGENT_STATE_STORE_MISSING|plane_agent_state_store_missing/
const FAMILY_RE = /a5-agent-state|agent-state-family/
const PLACEMENT_RE = /placement-feed rows=/

async function runU7FAgentB({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const CASE_IDS = CASES
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
  }
  const waitA = async (predicate, timeoutMs) => {
    const started = Date.now()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return { hit: true, waitedMs: Date.now() - started }
      if (Date.now() - started >= timeoutMs) return { hit: false, waitedMs: Date.now() - started }
      await sleep(400)
    }
  }

  /** One world: materialize (fs-mut shape, plane delta controlled), boot,
   *  discovery, team.create, leader wake-cadence until `waitFor` hits (or
   *  deadline), then collect witnesses and tear down. */
  const runWorld = async ({ phase, agentStateEnabled, waitFor, deadlineMs }) => {
    const world = await factory.createWorld({ line, u7FsMut: { rows: [] } })
    worlds.push(world)
    record.record.bindings.worldIds.push(world.id)
    const assembly = createFAgentBAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir, sessionRoot: factory.hostTree })
    assembly.writePreBootFiles()
    world.u7FsMut.rows.push(...assembly.teamRowsFor({ agentStateEnabled }))
    await world.startMock({ decide: makeFsMutDecide({ assembly }) })
    record.logHostStart({ world: world.id, phase })
    rc.arm()
    const startPromise = world.startHost()
    const child = world.instance?.child ?? null
    if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
    let boot = null
    let bootError = null
    try {
      boot = await startPromise
    } catch (error) {
      bootError = String(error?.message ?? error).slice(0, 240)
    }
    const out = { world, assembly, boot, bootError, surface: [], refusalHits: [], placementLines: [], familyLines: [], familyRanLines: [], health: null, stateOk: false }
    if (boot !== null) {
      record.record.boots = (record.record.boots ?? []).concat([{ phase, world: world.id, port: boot.port, logPath: boot.logPath }])
      const origin = `http://127.0.0.1:${boot.port}`
      const healthW = await waitA(async () => {
        const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
        out.health = st
        return st.status === 200 && st.body?.ok === true
      }, 120_000)
      out.stateOk = healthW.hit
      if (healthW.hit) {
        try {
          const cookie = await authenticate(origin, world.token)
          const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7fagentb')
          if (discPrompt.status === 200) {
            const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 120_000 })
            if (discW.hit) {
              const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
              out.surface = [...new Set(disc)].sort()
            }
          }
          const denyList = out.surface.filter((n) => !n.startsWith('team_')
            && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'].includes(n)
            && !['todo_write'].includes(n))
          assembly.writeMainBlueprint(denyList)
          await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
          const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
          const wake = async (tag) => {
            const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `FSMUT_PHASE_${tag}`, 'u7fagentb-wake')
            if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
          }
          // Drive the leader lane (member creation = where plane wiring
          // happens) until this world's witness lands or the deadline.
          const t0 = Date.now()
          let lastWake = 0
          let wakes = 0
          for (;;) {
            const lines = readLog(boot)
            collect(out, lines, world)
            if (waitFor(out)) break
            if (Date.now() - t0 > deadlineMs) break
            if (Date.now() - lastWake > 3000 && wakes < 20) { wakes += 1; lastWake = Date.now(); await wake('d') }
            if (replySeen('FAGENTB_NEVER')) break
            await sleep(500)
          }
        } catch (error) {
          log(`${phase} drive phase error (witnesses still read from disk): ${String(error?.message ?? error).slice(0, 160)}`)
        }
      }
    }
    // Final witness read (post-deadline truth, whatever the drive did).
    if (boot !== null) collect(out, readLog(boot), world)
    try { await rc.stopChild() } catch { /* idempotent */ }
    const receipts = await world.teardown({ keepHome })
    out.leak = await evaluateLeak({ world, receipts, factory })
    return out
  }

  const readLog = (boot) => {
    try { return readFileSync(boot.logPath, 'utf8').split('\n') } catch { return [] }
  }
  const collect = (out, lines, world) => {
    out.placementLines = lines.filter((l) => PLACEMENT_RE.test(l))
    out.familyLines = lines.filter((l) => FAMILY_RE.test(l))
    out.familyRanLines = out.familyLines.filter((l) => l.includes(' RAN '))
    out.refusalHits = lines.filter((l) => CODE_RE.test(l) || l.includes('mount-REFUSED'))
      .map((l) => `host-log: ${l.slice(0, 220)}`)
    // In-band witness: the mount error text can also surface inside a team
    // tool_result the model carried (the throw rides the tool result).
    for (const rec of world.mock?.requests ?? []) {
      const t = JSON.stringify(rec.body ?? {})
      if (CODE_RE.test(t)) out.refusalHits.push(`mock-transcript: ${String(CODE_RE.exec(t)?.[0] ?? '')}`)
    }
  }

  // ── boot A: key ABSENT — zero flip ────────────────────────────────────────
  const bootA = await runWorld({
    phase: 'u7fagentb-bootA-zero-flip',
    agentStateEnabled: undefined,
    deadlineMs: 150_000,
    waitFor: (out) => out.placementLines.length > 0,
  })
  // ── boot B: key TRUE, no production store port — typed mount refusal ─────
  const bootB = await runWorld({
    phase: 'u7fagentb-bootB-enabled-refused',
    agentStateEnabled: true,
    deadlineMs: 150_000,
    waitFor: (out) => out.refusalHits.length > 0,
  })

  const bootAPlain = {
    surface: bootA.surface,
    placementLines: bootA.placementLines,
    familyLines: bootA.familyLines,
    healthOk: bootA.health?.body?.ok === true,
    stateOk: bootA.stateOk,
  }
  const bootBPlain = {
    refusalHits: bootB.refusalHits,
    placementLines: bootB.placementLines,
    familyRanLines: bootB.familyRanLines,
    bootError: bootB.bootError,
  }
  const verdicts = judgeU7FAgentB({ bootA: bootAPlain, bootB: bootBPlain, leakOk: bootA.leak?.ok === true && bootB.leak?.ok === true })
  for (const [id, verdict, detail] of verdicts) if (!done.has(id)) add(id, verdict, detail)

  try {
    writeFileSync(join(evidence, `${runId}.u7fagentb-evidence.json`), JSON.stringify({
      boots: record.record.boots,
      bootA: { ...bootAPlain, bootError: bootA.bootError },
      bootB: bootBPlain,
      leaks: { bootA: bootA.leak, bootB: bootB.leak },
      disclosed: 'ENABLED-AND-STORE-MOUNTED positive legs (authorized read; authorized mutation with the durable fact read back; refused cross-scope write with zero reach) have NO production seam on this tree: agent-bindings.mjs wires backends for the jobs bridge only and this lane edited no binder line. They are PROVEN at C1 over the real plane and the real kernel grant (packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts) and are NOT claimed live here. A durable store adapter is a separate named binder lane.',
      law: { zeroFlip: 'agentStateEnabled ABSENT = FALSE: no rows, no family witnesses, native todo_write rides unchanged', failClosed: 'enabled with no store port -> whole plane mount refused PLANE_AGENT_STATE_STORE_MISSING, zero placement rows, zero RAN witnesses' },
    }, null, 2) + '\n')
  } catch { /* evidence is best-effort */ }
  void failRest
}

export default {
  suite: 'u7-fagentb',
  cases: CASES,
  totalRequests: 90,
  run: (opts, ctx) => runU7FAgentB(opts, ctx),
}
