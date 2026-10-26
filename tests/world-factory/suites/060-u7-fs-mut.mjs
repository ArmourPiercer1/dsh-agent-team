/**
 * tests/world-factory/suites/060-u7-fs-mut.mjs — the `u7-fs-mut` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (u7-w0, 2026-10-26).
 *
 * Moved VERBATIM out of u5-canary-runner.mjs at origin/master 88107ad71 (the
 * suite's SUITE_CASES entry + its comment, its run function and the banner
 * above it, and its totalRequests budget) so a new suite lane ADDS a file here
 * and edits no shared list in the runner. The only textual changes: the runner
 * helpers it used arrive through the `ctx` argument, `SUITE_CASES['u7-fs-mut']`
 * reads the module's own CASES, and imports name exactly what the body uses.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../lib/u6-fs-assembly.mjs'
import { createFsMutAssembly, makeFsMutDecide, judgeU7FsMut } from '../lib/u7-fsmut-assembly.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// U7-9a C2 (the first S5 per-family delivery): the FS family's MUTATION
// members — governed write/edit/read_image — on the SAME kernel, ONE
// World, ZERO center diff (CA-01). The verdict source is the RUNNER'S OWN
// DISK READS (bytes as they are, never a transcript): governed create and
// edit land exactly; the never-named deny target stays BYTE-IDENTICAL
// across a write attempt; the read_image lane must answer HONESTLY (a
// real run or a typed fail-closed refusal with zero commit — silence
// fails); the ungoverned boot-root native write lands on its own path and
// never appears on a governed RAN witness.
const CASES = Object.freeze(['fsm:mounted', 'fsm:write-positive', 'fsm:edit-positive', 'fsm:refusal-zero-effect', 'fsm:image-lane-honest', 'fsm:ctl-native-write', 'fsm:leak-check'])

// U7-9a C2 (the FS family's mutation members at the Host): ONE governed
// World whose kernel owns write/edit/read_image beside read — the CA-01
// claim is that a new family member needs ZERO center diff and ZERO new
// assembly machinery, so this World carries the SAME teamToolPlane config
// the u6-fs read World proved. Verdict law: the runner's OWN disk reads (an
// independent Oracle — the host never reports about itself), host-log
// witnesses of the family's own observe lines (the governed-vs-native
// discriminator), and BYTE COMPARISON for every refusal's zero effect.
async function runU7FsMut({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const CASE_IDS = CASES
  const done = new Set()
  const add = (id, verdict, detail) => {
    done.add(id)
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 240)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASE_IDS) {
      if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
    }
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
  const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u7FsMut: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createFsMutAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir, sessionRoot: factory.hostTree })
  const planted = assembly.writePreBootFiles() // plant truth BEFORE any host exists
  world.u7FsMut.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeFsMutDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u7fsmut-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try {
    boot = await startPromise
  } catch (error) {
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u7fsmut-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  const laneDone = { strict: false, leader: false, ctl: false }
  record.record.u7fsmutLanes = laneDone

  // ── readiness: p6t6 health + anchored Team Session ───────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('fsm:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
    failRest('mount readiness failed')
    return
  }
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.phase === 'create' && stateBody?.teamSession !== null
  }, 90_000)

  // ── discovery -> blueprint -> team.create ────────────────────────────────
  let surface = []
  let cookie = null
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
  } else {
    cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7fsmut')
    if (discPrompt.status !== 200) {
      failRest(`discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}`)
    } else {
      const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
      if (!discW.hit) {
        failRest('discovery model request absent (deny list cannot be computed)', { mockDigest: world.mockRequestDigest().slice(-6) })
      } else {
        const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
        surface = [...new Set(disc)].sort()
        const denyList = surface.filter((n) => !n.startsWith('team_')
          && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'].includes(n)
          && !['todo_write'].includes(n))
        assembly.writeMainBlueprint(denyList)
        const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
        const createOk = created.status === 200 && created.body?.result?.ok === true
        if (!createOk) {
          failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
        } else {
          // ── drive: member legs, leader close, then the NATIVE ctl trigger ─
          const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
          const wake = async (tag) => {
            const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `FSMUT_PHASE_${tag}`, 'u7fsmut-wake')
            if (pr.status !== 200) log(`wake ${String(tag)} rejected: status=${String(pr.status)}`)
          }
          const wakeCadence = async (content, deadlineMs, tag) => {
            const t0 = Date.now()
            let lastWake = 0
            let wakes = 0
            for (;;) {
              if (replySeen(content)) return true
              if (Date.now() - t0 > deadlineMs) return replySeen(content)
              if (Date.now() - lastWake > 3000 && wakes < 14) { wakes += 1; lastWake = Date.now(); await wake(tag) }
              await new Promise((r) => setTimeout(r, 350))
            }
          }
          laneDone.strict = await wakeCadence('FSMUT_STRICT_DONE', 150_000, 's')
          laneDone.ctl = await wakeCadence('FSMUT_CTL_DONE', 120_000, 'c')
          laneDone.leader = await wakeCadence('FSMUT_L1_DONE', 90_000, 'z')
        }
      }
    }
  }

  // ── evidence: the runner's OWN disk oracle + host-log witnesses ──────────
  const oracle = assembly.readOracleFacts()
  let logLines = []
  try {
    const text = readFileSync(boot.logPath, 'utf8')
    logLines = text.split('\n').filter((l) => /governed-write|governed-edit|governed-image|placement-feed rows=|a5-plane: (mount|placement)-REFUSED|PLANE_FS_FAMILY_INCOMPLETE|PLANE_READ_REGISTRATION_REFUSED/.test(l))
  } catch { /* log unreadable → verdicts fall to the disk truth */ }
  const before = {
    deniedShaBefore: planted.deniedShaBefore,
    plantShaBefore: planted.plantShaBefore,
    W1_CONTENT: assembly.W1_CONTENT,
    PLANT_BEFORE: assembly.claims.plantBefore,
    PLANT_AFTER_CONTENT: assembly.PLANT_AFTER_CONTENT,
    CTL_CONTENT: assembly.CTL_CONTENT,
  }
  record.record.u7fsmutDigest = {
    planted, oracle,
    logHits: {
      writeRan: logLines.filter((l) => l.includes('governed-write RAN')).length,
      editRan: logLines.filter((l) => l.includes('governed-edit RAN')).length,
      image: logLines.filter((l) => l.includes('governed-image')).length,
      planeRefusals: logLines.filter((l) => /REFUSED/.test(l)).map((l) => l.slice(0, 200)),
    },
    // forensic lane (boot u7fsmut1-4 lessons, all MEASURED):
    //  - whole-body regexes count TOOL DEFINITIONS too — the honest shape
    //    walks assistant tool_use blocks and reports the last user turn's
    //    tool_result head (boots u7fsmut1-3 lied about the last call here);
    //  - boot u7fsmut4 verdicts: governed write/edit PASS on disk bytes +
    //    RAN witnesses; the denied-path write and the read_image call died
    //    at a HOST pre-dispatch layer (zero row witnesses, zero host-log
    //    error lines); the CI-03 member's NATIVE write answered
    //    `[sandbox: file access denied under workspace-write mode]` — the
    //    tool_result head is the ONLY witness such deaths leave, which is
    //    why it rides the evidence now.
    mockLaneTranscript: (world.mock?.requests ?? []).slice(-60).map((rec) => {
      const body = rec.body ?? {}
      const msgs = Array.isArray(body.messages) ? body.messages : []
      const toolUses = msgs.flatMap((m) => m?.role === 'assistant' && Array.isArray(m.content)
        ? m.content.filter((b) => b?.type === 'tool_use').map((b) => String(b.name)) : [])
      const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
      const resultHead = typeof lastUser?.content === 'string' ? lastUser.content.slice(0, 150)
        : Array.isArray(lastUser?.content)
          ? (lastUser.content.find((b) => b?.type === 'tool_result')?.content?.slice?.(0, 150)
             ?? JSON.stringify(lastUser.content[0] ?? '').slice(0, 150))
          : null
      return {
        seq: rec.seq,
        d1: JSON.stringify(msgs.map((m) => (m?.role === 'user' ? m.content : ''))).includes('[team-work requestToken=u7fsmut-d1'),
        d2: JSON.stringify(msgs.map((m) => (m?.role === 'user' ? m.content : ''))).includes('[team-work requestToken=u7fsmut-d2'),
        nCalls: toolUses.length,
        lastCall: toolUses.length > 0 ? toolUses[toolUses.length - 1] : null,
        resultHead,
      }
    }),
    surface, laneDone,
  }
  try {
    writeFileSync(join(evidence, `${runId}.u7fsmut-evidence.json`), JSON.stringify(record.record.u7fsmutDigest, null, 2) + '\n')
  } catch { /* evidence is best-effort */ }

  const verdicts = judgeU7FsMut({
    before, oracle, log: logLines, laneDone,
    journal: record.record.u7fsmutDigest.mockLaneTranscript ?? [],
    hostAlive: hostAlive(), healthOk: health?.body?.ok === true, stateOk: stateW.hit, surface,
  })
  for (const [id, verdict, detail] of verdicts) {
    if (!done.has(id)) add(id, verdict, detail)
  }

  // ── leak-check ────────────────────────────────────────────────────────────
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  if (!done.has('fsm:leak-check')) add('fsm:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
  if (!hostAlive() && !done.has('fsm:host-died')) log('host died during the run (verdicts read the evidence as-is)')
}

export default {
  suite: 'u7-fs-mut',
  cases: CASES,
  totalRequests: 80,
  run: (opts, ctx) => runU7FsMut(opts, ctx),
}
