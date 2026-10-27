/**
 * tests/world-factory/suites/110-u7-fagentb.mjs — the `u7-fagentb` C2 suite
 * (U7-F B): the AGENT-STATE family's live MOUNT LAW at the real host, TWO
 * boots per recorded run (three declared; every actual host start across all
 * recorded runs is listed in the run records — see the evidence dir).
 *
 * Verdict law: the runner's OWN reads of the host log, the world home, the
 * p6t6 probe bodies and the mock transcript — the host never reports about
 * itself, and SILENCE FAILS (a refusal the suite cannot witness is a FAIL,
 * never an assumed PASS).
 *
 *  A) ZERO FLIP (key ABSENT): the proven u7-fs-mut world shape mounts its
 *     governed plane exactly as shipped (placement-feed + census-boot boot
 *     signatures), NOTHING of the agent-state family appears anywhere, and
 *     no agent-state spelling rides ANY captured model surface. Disclosed
 *     measured truth: the 0.2.0-rc.2 team-session surface carries no native
 *     `todo_write` at all, so the family-disabled surface claim is the
 *     NEGATIVE one (zero added names; shipped names ride unchanged).
 *  B) ENABLED WITHOUT A STORE (key TRUE on production wiring): the
 *     production binder passes `backends` for the jobs bridge ONLY —
 *     there is no agent-state store adapter on this tree and this lane
 *     edits no binder line — so the family's build answers
 *     `PLANE_AGENT_STATE_STORE_MISSING` and the mount is refused before any
 *     governed row exists: zero placement-feed rows, zero census-boot
 *     signatures, zero family witnesses. The typed code must be WITNESSED
 *     in an observable channel (host log / world home / p6t6 body / mock
 *     transcript) or the case FAILS.
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
import { AGENT_STATE_LIVE_NAMES, createFAgentBAssembly, judgeU7FAgentB } from '../lib/u7fagentb-assembly.mjs'
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { zstdDecompressSync } from 'node:zlib'
import { join, relative } from 'node:path'

const CASES = Object.freeze(['agt:zero-flip-mount', 'agt:surface-unchanged-witness', 'agt:enabled-mount-refused', 'agt:enabled-zero-plane', 'agt:leak-check'])

const CODE_RE = /PLANE_AGENT_STATE_STORE_MISSING|plane_agent_state_store_missing/
const FAMILY_RE = /a5-agent-state|agent-state-family/
const PLACEMENT_RE = /placement-feed rows=/
const CENSUS_RE = /a5ptc: census-boot/
const SCAN_TEXT_EXT = /\.(json|jsonl|log|txt|out|yml|yaml|md|ndjson|zstd)$/i

/** Read a text or zstd-compressed (session.v3.jsonl.zstd) file to text. */
function readMaybeZstd(p) {
  const buf = readFileSync(p)
  if (p.endsWith('.zstd')) {
    try { return zstdDecompressSync(buf).toString('utf8') } catch { return '' }
  }
  return buf.toString('utf8')
}

/** Walk a small world home (bounded files/bytes) and return every line
 *  matching the typed-code regex, tagged with its relative path. */
function scanHome(root, re, budget = { files: 600, bytes: 8 * 1024 * 1024 }) {
  const hits = []
  const walk = (dir, depth) => {
    if (depth > 8 || budget.files <= 0 || budget.bytes <= 0) return
    let entries = []
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (budget.files <= 0 || budget.bytes <= 0) return
      const p = join(dir, e.name)
      if (e.isDirectory()) { walk(p, depth + 1); continue }
      if (!e.isFile() || !SCAN_TEXT_EXT.test(e.name)) continue
      budget.files -= 1
      let text = ''
      try {
        const size = statSync(p).size
        if (size > 4 * 1024 * 1024) { budget.bytes -= 4 * 1024 * 1024; continue }
        budget.bytes -= size
        text = readFileSync(p, 'utf8')
      } catch { continue }
      if (re.test(text)) {
        for (const line of text.split('\n')) {
          if (re.test(line)) hits.push(`home:${relative(root, p)}: ${line.trim().slice(0, 220)}`)
          if (hits.length > 40) return
        }
      }
    }
  }
  walk(root, 0)
  return hits
}

async function runU7FAgentB({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const CASE_IDS = CASES
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
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
  const readLog = (boot) => {
    try { return readFileSync(boot.logPath, 'utf8').split('\n') } catch { return [] }
  }

  /** Collect every witness channel of the current world truth into `out`. */
  const collect = (out, world) => {
    const lines = out.boot === null ? [] : readLog(out.boot)
    out.placementLines = lines.filter((l) => PLACEMENT_RE.test(l))
    out.censusBootLines = lines.filter((l) => CENSUS_RE.test(l))
    out.familyLines = lines.filter((l) => FAMILY_RE.test(l))
    out.familyRanLines = out.familyLines.filter((l) => l.includes(' RAN '))
    out.refusalHits = []
    for (const l of lines) {
      if (CODE_RE.test(l) || l.includes('mount-REFUSED') || l.includes('refused the mount')) out.refusalHits.push(`host-log: ${l.slice(0, 220)}`)
    }
    for (const rec of world.mock?.requests ?? []) {
      const t = JSON.stringify(rec.body ?? {})
      if (CODE_RE.test(t)) out.refusalHits.push(`mock-transcript: ${String(CODE_RE.exec(t)?.[0] ?? '')}`)
      const surf = (() => { try { return surfaceNamesOf(rec) } catch { return [] } })()
      for (const n of surf) if (!out.surfaceUnion.includes(n)) out.surfaceUnion.push(n)
    }
    const homeHits = scanHome(world.home, CODE_RE)
    for (const h of homeHits) if (!out.refusalHits.includes(h)) out.refusalHits.push(h)
    // team.create response body is a first-class witness channel: in the
    // enabled world the leader-agent start surfaces the mount refusal here
    // (the plane handle resolves when the governed session materializes).
    const createdText = out.createBodyText ?? ''
    if (CODE_RE.test(createdText)) out.refusalHits.push(`team-create-body: ${String(CODE_RE.exec(createdText)?.[0] ?? '')}`)
    const probeText = JSON.stringify({ health: out.health, state: out.state })
    if (CODE_RE.test(probeText)) out.refusalHits.push('p6t6-probe: health/state body carries the typed code')
  }

  /** One world: materialize (fs-mut shape, ONE controlled plane delta),
   *  boot, optionally drive a session lane (drive=true), collect witnesses,
   *  tear down. */
  const runWorld = async ({ phase, agentStateEnabled, drive, waitFor, deadlineMs }) => {
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
    const out = { boot: null, bootError: null, surfaceUnion: [], refusalHits: [], placementLines: [], censusBootLines: [], familyLines: [], familyRanLines: [], health: null, state: null }
    try {
      out.boot = await startPromise
    } catch (error) {
      out.bootError = String(error?.message ?? error).slice(0, 240)
    }
    if (out.boot !== null) {
      record.record.boots = (record.record.boots ?? []).concat([{ phase, world: world.id, port: out.boot.port, logPath: out.boot.logPath }])
      const origin = `http://127.0.0.1:${out.boot.port}`
      const healthW = await waitA(async () => {
        const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
        out.health = { status: st.status, body: st.body ?? null }
        return st.status === 200 && st.body?.ok === true
      }, drive ? 120_000 : 30_000)
      if (healthW.hit) {
        const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
        out.state = { status: st.status, body: st.body ?? null }
        collect(out, world)
        const anchored = out.state?.body?.rootSessionId === assembly.ROOT
        try {
          const cookie = await authenticate(origin, world.token)
          if (drive && anchored) {
            const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7fagentb')
            if (discPrompt.status === 200) {
              const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 120_000 })
              if (discW.hit) {
                const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
                for (const n of new Set(disc)) if (!out.surfaceUnion.includes(n)) out.surfaceUnion.push(n)
                const denyList = [...new Set(disc)].sort().filter((n) => !n.startsWith('team_')
                  && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'].includes(n)
                  && !['todo_write'].includes(n))
                assembly.writeMainBlueprint(denyList)
              }
            }
          }
          // team.create is attempted in BOTH worlds: in the zero-flip world
          // it drives the shipped lanes (the placement witness); in the
          // enabled world the mount refusal may surface HERE (the plane
          // handle resolves when the governed session materializes) — the
          // response body is then a first-class witness channel.
          const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
          out.createBodyText = JSON.stringify(created.body ?? {})
          out.teamCreate = { status: created.status, ok: created.body?.result?.ok === true, bodyText: String(out.createBodyText).slice(0, 900) }
          const t0 = Date.now()
          let lastWake = 0
          let wakes = 0
          for (;;) {
            collect(out, world)
            if (waitFor(out)) break
            if (Date.now() - t0 > deadlineMs) break
            if (anchored && Date.now() - lastWake > 3000 && wakes < 20) { wakes += 1; lastWake = Date.now(); await apiPrompt(origin, cookie, assembly.CREATE_ROOT, 'FSMUT_PHASE_d', 'u7fagentb-wake').catch(() => {}) }
            await sleep(500)
          }
        } catch (error) {
          log(`${phase} drive phase error (witnesses still read from disk): ${String(error?.message ?? error).slice(0, 160)}`)
        }
      }
      collect(out, world)
    }
    try { await rc.stopChild() } catch { /* idempotent */ }
    const receipts = await world.teardown({ keepHome })
    out.leak = await evaluateLeak({ world, receipts, factory })
    return out
  }

  // ── boot A: key ABSENT — zero flip (full shipped drive) ─────────────────
  const bootA = await runWorld({
    phase: 'u7fagentb-bootA-zero-flip',
    agentStateEnabled: undefined,
    drive: true,
    deadlineMs: 150_000,
    waitFor: (out) => out.placementLines.length > 0 && out.censusBootLines.length > 0,
  })
  // ── boot B: key TRUE, no production store port — typed mount refusal ────
  const bootB = await runWorld({
    phase: 'u7fagentb-bootB-enabled-refused',
    agentStateEnabled: true,
    drive: true,
    deadlineMs: 150_000,
    waitFor: (out) => out.refusalHits.length > 0,
  })

  const verdicts = judgeU7FAgentB({ bootA, bootB, leakOk: bootA.leak?.ok === true && bootB.leak?.ok === true })
  for (const [id, verdict, detail] of verdicts) if (!done.has(id)) add(id, verdict, detail)

  try {
    writeFileSync(join(evidence, `${runId}.u7fagentb-evidence.json`), JSON.stringify({
      boots: record.record.boots,
      bootA: { bootError: bootA.bootError, health: bootA.health, state: bootA.state, teamCreate: bootA.teamCreate ?? null, surfaceUnion: bootA.surfaceUnion, placementLines: bootA.placementLines, censusBootLines: bootA.censusBootLines, familyLines: bootA.familyLines, refusalHits: bootA.refusalHits },
      bootB: { bootError: bootB.bootError, health: bootB.health, state: bootB.state, teamCreate: bootB.teamCreate ?? null, placementLines: bootB.placementLines, censusBootLines: bootB.censusBootLines, familyRanLines: bootB.familyRanLines, refusalHits: bootB.refusalHits, surfaceUnion: bootB.surfaceUnion },
      leaks: { bootA: bootA.leak, bootB: bootB.leak },
      disclosed: 'ENABLED-AND-STORE-MOUNTED positive legs (authorized read; authorized mutation with the durable fact read back; refused cross-scope write with zero reach) have NO production seam on this tree: agent-bindings.mjs wires backends for the jobs bridge only and this lane edited no binder line. They are PROVEN at C1 over the real plane and the real kernel grant (packages/runtime/test/u7-f-agentb-agent-state-c1.test.ts) and are NOT claimed live here. A durable store adapter is a separate named binder lane. Also disclosed: the 0.2.0-rc.2 team-session model surface carries no native todo_write; the family-disabled surface claim is asserted as ABSENCE of the five spellings.',
      law: { zeroFlip: 'agentStateEnabled ABSENT = FALSE: no rows, no family witnesses, shipped placement + census-boot signatures unchanged', failClosed: 'enabled with no store port -> whole plane mount refused PLANE_AGENT_STATE_STORE_MISSING; witnessed typed code required, silence FAILS' },
    }, null, 2) + '\n')
  } catch { /* evidence is best-effort */ }
}

export default {
  suite: 'u7-fagentb',
  cases: CASES,
  totalRequests: 160,
  run: (opts, ctx) => runU7FAgentB(opts, ctx),
}
