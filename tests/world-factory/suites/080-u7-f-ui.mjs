/**
 * tests/world-factory/suites/080-u7-f-ui.mjs — the `u7-f-ui` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (the lane-suite
 * law: a new suite ADDS a file here and edits no shared list in the runner).
 *
 * u7-f C2 (the UI family at the Host): governed ask_user_question + present
 * mount through the reviewed FamilyAssembly descriptor (uiFamilyEnabled) on
 * the SAME kernel as the fs family, ONE World, ONE boot, ZERO center diff
 * (the CA-01 claim). Verdict law: the family's own host-log observe lines,
 * the tool_result heads (the only witness refusals executed above the row
 * leave), the runner's OWN disk reads (byte identity for zero effect), and
 * the CANARY never-rides-a-line law for the out-of-root present (zero fs
 * touch). The live POSITIVE arms are DISCLOSED verbatim (no trusted mount
 * injects a UI port; the host userQuestions service carries no present
 * face) — never faked; they are PROVEN offline in C1 over the injected
 * fake port. Boot budget: ONE start (budget ≤ 3; the ledger below is the
 * only authorization path past a retry).
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../lib/u6-fs-assembly.mjs'
import { createUiAssembly, makeUiDecide, judgeU7Ui } from '../lib/u7-fui-assembly.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CASES = Object.freeze(['ui:mounted', 'ui:ask-live-refused', 'ui:present-inroot-zero-effect', 'ui:present-outside-refused', 'ui:positive-arms-honest', 'ui:leak-check'])

async function runU7FsUi({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
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
  const world = await factory.createWorld({ line, u7FsUi: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createUiAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir, sessionRoot: factory.hostTree })
  const planted = assembly.writePreBootFiles() // plant truth BEFORE any host exists
  world.u7FsUi.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeUiDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u7fui-boot1' })
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
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u7fui-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  const laneDone = { uigov: false, leader: false }
  record.record.u7fuiLanes = laneDone

  // ── readiness: p6t6 health + anchored Team Session ───────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('ui:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
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
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7fui')
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
          // ── drive: the governed UI lane, then the leader close ──────────
          const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
          const wake = async (tag) => {
            const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7FUI_PHASE_${tag}`, 'u7fui-wake')
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
          laneDone.uigov = await wakeCadence('U7FUI_UI_DONE', 150_000, 's')
          laneDone.leader = await wakeCadence('U7FUI_L1_DONE', 90_000, 'z')
        }
      }
    }
  }

  // ── evidence: the runner's OWN disk oracle + host-log witnesses ──────────
  const oracle = assembly.readOracleFacts()
  let logLines = []
  try {
    const text = readFileSync(boot.logPath, 'utf8')
    logLines = text.split('\n').filter((l) => /governed-ask|governed-present|u7f-ask|u7f-present|placement-feed rows=|a5-plane: (mount|placement)-REFUSED|PLANE_UI_REGISTRATION_REFUSED|TOOL_BINDING_UNVERIFIED/.test(l))
  } catch { /* log unreadable → verdicts fall to the disk truth */ }
  const before = {
    presentedShaBefore: planted.presentedShaBefore,
    outsideShaBefore: planted.outsideShaBefore,
  }
  record.record.u7fuiDigest = {
    planted, oracle,
    logHits: {
      askRan: logLines.filter((l) => l.includes('governed-ask RAN')).length,
      askRefusals: logLines.filter((l) => l.includes('governed-ask') && !l.includes('RAN')).map((l) => l.slice(0, 200)),
      presentRan: logLines.filter((l) => l.includes('governed-present RAN')).length,
      presentProbed: logLines.filter((l) => l.includes('governed-present PROBED')).length,
      presentRefusals: logLines.filter((l) => l.includes('governed-present') && !l.includes('RAN') && !l.includes('PROBED')).map((l) => l.slice(0, 200)),
      planeRefusals: logLines.filter((l) => /REFUSED|TOOL_BINDING_UNVERIFIED/.test(l)).map((l) => l.slice(0, 200)),
    },
    // forensic lane (the u7fsmut1-4 measured law): the tool_result HEAD is
    // the ONLY witness a refusal executed above the plane row leaves — the
    // honest shape walks assistant tool_use blocks and reports the last
    // user turn's tool_result head.
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
        d1: JSON.stringify(msgs.map((m) => (m?.role === 'user' ? m.content : ''))).includes('[team-work requestToken=u7fui-d1'),
        nCalls: toolUses.length,
        lastCall: toolUses.length > 0 ? toolUses[toolUses.length - 1] : null,
        resultHead,
      }
    }),
    surface, laneDone,
  }
  try {
    writeFileSync(join(evidence, `${runId}.u7fui-evidence.json`), JSON.stringify(record.record.u7fuiDigest, null, 2) + '\n')
  } catch { /* evidence is best-effort */ }

  const verdicts = judgeU7Ui({
    before, oracle, log: logLines, laneDone,
    journal: record.record.u7fuiDigest.mockLaneTranscript ?? [],
    hostAlive: hostAlive(), healthOk: health?.body?.ok === true, stateOk: stateW.hit, surface,
  })
  for (const [id, verdict, detail] of verdicts) {
    if (!done.has(id)) add(id, verdict, detail)
  }

  // ── leak-check ────────────────────────────────────────────────────────────
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  if (!done.has('ui:leak-check')) add('ui:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
}

export default {
  suite: 'u7-f-ui',
  cases: CASES,
  totalRequests: 60,
  run: (opts, ctx) => runU7FsUi(opts, ctx),
}
