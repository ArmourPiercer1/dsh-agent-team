/**
 * tests/world-factory/suites/070-u7-pwsh.mjs — the `u7-pwsh` C2 suite,
 * collected by u5-canary-runner.mjs from this directory (U7-F, 2026-10-26).
 *
 * The governed PWSH shell-class row at the Host: the process family's
 * SECOND row, mounted by the SAME teamToolPlane declaration the read /
 * shell / fs-mutation worlds proved (CA-01: a family member needs ZERO
 * center diff and ZERO new assembly keys). ONE boot carries every leg:
 * the default-deny typed refusal with ZERO effect, the ask door through a
 * REAL pending Control row settled by the PUBLIC team.resolveControl seam
 * (the GUI's own human lane), the kernel's one-shot consume, the governed
 * body running to its HONEST typed `pwsh-executable-not-found` refusal on
 * this pwsh-less host (DISCLOSED ENV arm — zero spawns measured), and the
 * seam replay refusal. Verdict law (unchanged): DISK FACTS (absent
 * markers), the durable Control lane read through the PRODUCT read plane,
 * and host-log witnesses of the row's OWN observe lines — never the
 * transcript alone.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../lib/u6-fs-assembly.mjs'
import { createPwshAssembly, makePwshDecide, judgeU7Pwsh } from '../lib/u7-pwsh-assembly.mjs'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CASES = Object.freeze(['pwsh:mounted', 'pwsh:deny-zero-effect', 'pwsh:approve-honest-env', 'pwsh:seam-replay-refused', 'pwsh:leak-check'])

async function runU7Pwsh({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
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
  let hostAliveAtEvidence = true

  // ── materialize + boot (ONE host start) ──────────────────────────────────
  const world = await factory.createWorld({ line, u7Pwsh: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createPwshAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir })
  assembly.writePreBootFiles()
  world.u7Pwsh.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makePwshDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u7pwsh-boot1' })
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
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u7pwsh-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  const laneDone = { strict: false, asker: false, leader: false }
  record.record.u7pwshLanes = laneDone

  // ── readiness: p6t6 health + anchored Team Session ───────────────────────
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && (st.body?.ok === true || st.body?.ok === false)
  }, 120_000)
  if (!healthW.hit || health?.body?.ok !== true) {
    add('pwsh:mounted', 'FAIL', { reason: `p6t6 health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 300)}` })
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
  let teamSessionId = assembly.CREATE_ROOT
  if (!stateW.hit) {
    failRest('anchored Team Session never appeared (state probe timed out)')
  } else {
    cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7pwsh')
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
          const unwrap = (body) => {
            const v = body?.result?.value
            return v && typeof v === 'object' && 'data' in v ? v.data : v
          }
          const echoed = unwrap(created.body)?.rootSessionId ?? null
          teamSessionId = echoed ?? assembly.CREATE_ROOT

          // ── the governed Control lane over the PRODUCT read plane ────────
          const CONTROL_FACT_TYPES = ['control-request-recorded', 'control-decision-recorded', 'control-allow-consumed', 'control-request-abandoned']
          const governedControlSnapshot = async () => {
            const byType = Object.fromEntries(CONTROL_FACT_TYPES.map((t) => [t, []]))
            let afterSequence = 0
            for (let pageNo = 0; pageNo < 20; pageNo += 1) {
              const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
                { teamSessionId, afterSequence, limit: 500 }, 'u7pwsh-ledger', 1)
              const r = page?.body?.result
              if (page?.status !== 200 || r?.ok !== true) {
                throw new Error(`team.getLedgerPage failed (page ${String(pageNo + 1)}): status=${String(page?.status)} ${JSON.stringify(r?.error ?? r ?? null).slice(0, 200)}`)
              }
              const data = unwrap(page.body)
              const entries = Array.isArray(data?.entries) ? data.entries : []
              for (const e of entries) {
                if (byType[e?.factType] === undefined) continue
                let payload = e.payload
                if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
                byType[e.factType].push({ sequence: e.sequence, payload: payload ?? {} })
              }
              const next = data?.nextAfterSequence
              if (next === null || next === undefined || entries.length === 0) break
              afterSequence = Number(next)
            }
            const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']]
              .map((f) => String(f.payload?.requestId ?? '')))
            return {
              requests: byType['control-request-recorded'].map((f) => ({
                requestId: String(f.payload?.requestId ?? ''),
                kind: f.payload?.kind ?? null,
                toolName: f.payload?.toolName ?? null,
                summary: String(f.payload?.summary ?? '').slice(0, 160),
                status: settled.has(String(f.payload?.requestId)) ? 'settled' : 'pending',
              })),
              consumptions: byType['control-allow-consumed'].map((f) => ({ requestId: String(f.payload?.requestId ?? '') })),
            }
          }
          const stateSnapshot = async () => (await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000))?.body ?? null

          // ── drive: member legs with the approve arm CONCURRENT ───────────
          const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
          const wake = async (tag) => {
            const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7PWSH_PHASE_${tag}`, 'u7pwsh-wake')
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
              await sleep(350)
            }
          }

          // deny leg first (synchronous typed refusal, no control row)
          laneDone.strict = await wakeCadence('U7PWSH_DENY_DONE', 150_000, 's')

          // ── approve leg: the asker's pwsh call mints a REAL pending row
          // (u7fpwsh-r2 measured TWO governed ask identities on this path:
          // the bridge's durable control-request row AND the kernel PA
          // case row, each resolved and consumed EXACTLY ONCE); the runner
          // settles EVERY matching pending row that appears through the
          // PUBLIC team.resolveControl v4 seam until the lane completes. ──
          const apprArm = { pendingSeen: false, requestId: null, kind: null, attribution: null, resolveBody: null, resolvedOk: false, resolved: [], waitedMs: null, channelError: null }
          {
            const apprDrive = wakeCadence('U7PWSH_APPR_DONE', 170_000, 'a')
            const pendingPwshRow = async () => {
              const st = await stateSnapshot()
              const governed = await governedControlSnapshot().catch((error) => {
                apprArm.channelError = String(error?.message ?? error).slice(0, 200)
                return null
              })
              if (governed === null) return null
              const pending = (governed.requests ?? []).filter((r) => r.status === 'pending' && (r.toolName === 'pwsh' || /tool:pwsh|tool=pwsh|pwsh/.test(String(r.summary ?? ''))))
              if (pending.length === 0) return null
              const askerInst = (st?.members ?? []).find((m) => m.templateId === 'asker')?.instanceId ?? null
              const fresh = pending.filter((r) => !apprArm.resolved.some((x) => x.requestId === r.requestId))
              if (fresh.length === 0) return null
              const exact = askerInst === null
                ? fresh[0] ?? null
                : fresh.find((r) => String(r.summary ?? '').includes(`:${askerInst}:`) || String(r.summary ?? '').includes(askerInst)) ?? null
              const p = exact ?? (fresh.length === 1 ? fresh[0] : null)
              if (p === null || p === undefined) return null
              return { row: p, attribution: exact !== null ? 'exact-instance' : 'sole-pending-row' }
            }
            const first = await waitA(async () => (await pendingPwshRow()) !== null, 120_000)
            apprArm.waitedMs = first.waitedMs
            for (let round = 0; round < 5; round += 1) {
              const found = await pendingPwshRow()
              if (found === null) break
              const { row, attribution } = found
              apprArm.pendingSeen = true
              if (apprArm.requestId === null) {
                apprArm.requestId = row.requestId
                apprArm.kind = row.kind ?? null
                apprArm.attribution = attribution
              }
              const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
                { teamSessionId, requestId: row.requestId, decision: 'allow', note: 'u7pwsh-c2-approve-arm' }, 'u7pwsh-approve', 4)
              const ok = res?.status === 200 && res?.body?.result?.ok === true
              apprArm.resolved.push({ requestId: row.requestId, attribution, ok, body: JSON.stringify(res?.body ?? null).slice(0, 300) })
              if (apprArm.resolved.length === 1) {
                apprArm.resolveBody = apprArm.resolved[0].body
                apprArm.resolvedOk = ok
              }
              // give the retried call time to consume this grant (and, if
              // the kernel opens another governed ask identity, to mint it
              // — the next loop iteration settles that one too).
              if (await waitA(() => replySeen('U7PWSH_APPR_DONE'), 25_000).then((w) => w.hit)) break
            }
            laneDone.asker = await apprDrive

            // ── seam replay: the SAME requestId, settled, resolved again ───
            const replayArm = { attempted: false, refused: false, requestId: apprArm.requestId, body: null }
            if (apprArm.requestId !== null) {
              replayArm.attempted = true
              const res2 = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
                { teamSessionId, requestId: apprArm.requestId, decision: 'allow', note: 'u7pwsh-c2-replay-arm' }, 'u7pwsh-replay', 4)
              const okCall = res2?.status === 200
              const bodyOk = res2?.body?.result?.ok === true
              // REFUSED = the seam answered (well-formed) and did NOT grant:
              // a settled row resolving again with ok:true would be a
              // durable exactly-once violation.
              replayArm.refused = okCall && !bodyOk
              replayArm.body = JSON.stringify(res2?.body ?? null).slice(0, 400)
            }
            record.record.u7pwshReplay = replayArm
            laneDone.leader = await wakeCadence('U7PWSH_L1_DONE', 90_000, 'z')
            record.record.u7pwshAppr = apprArm

            // ── evidence: disk oracle + host-log witnesses + Control lane ──
            const oracle = assembly.readOracleFacts()
            let logLines = []
            try {
              const text = readFileSync(boot.logPath, 'utf8')
              logLines = text.split('\n').filter((l) => /confined-pwsh|placement-feed rows=|template-default-deny|template-deny-lane|a5-pa-bridge|control/i.test(l))
            } catch { /* log unreadable → verdicts fall to the disk truth */ }
            const governedPost = await governedControlSnapshot().catch(() => null)
            const consumptionCount = (governedPost?.consumptions ?? []).length
            const aliveForVerdict = hostAlive()
            hostAliveAtEvidence = aliveForVerdict
            // FULL pwsh-call digest over ALL requests (the lane transcript
            // slice is tail-only; the consume-chain rows sit mid-stream).
            const pwshCalls = (world.mock?.requests ?? []).map((rec) => {
              const body = rec.body ?? {}
              const msgs = Array.isArray(body.messages) ? body.messages : []
              const uses = msgs.flatMap((m) => m?.role === 'assistant' && Array.isArray(m.content)
                ? m.content.filter((b) => b?.type === 'tool_use' && String(b.name) === 'pwsh') : [])
              if (uses.length === 0) return null
              const bodyText = JSON.stringify(body).slice(0, 200_000)
              const lane = bodyText.includes(assembly.tokens('d1')) ? 'strict'
                : bodyText.includes(assembly.tokens('d2')) ? 'asker' : 'other'
              const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
              const tr = Array.isArray(lastUser?.content)
                ? lastUser.content.find((b) => b?.type === 'tool_result')
                : null
              const head = typeof lastUser?.content === 'string' ? lastUser.content
                : typeof tr?.content === 'string' ? tr.content
                  : tr?.content !== undefined ? JSON.stringify(tr.content) : null
              return { seq: rec.seq, lane, head: String(head ?? '').slice(0, 240) }
            }).filter((x) => x !== null)
            record.record.u7pwshDigest = {
              oracle,
              surface, laneDone,
              appr: apprArm,
              replay: record.record.u7pwshReplay,
              pwshCalls,
              controlRequests: (governedPost?.requests ?? []).map((r) => ({ ...r, requestId: String(r.requestId).slice(0, 40) })).slice(-24),
              consumptionCount,
              logHits: {
                pwLines: logLines.filter((l) => l.includes('confined-pwsh')).map((l) => l.slice(0, 220)),
                placement: logLines.filter((l) => l.includes('placement-feed')).map((l) => l.slice(0, 220)),
              },
              mockLaneTranscript: (world.mock?.requests ?? []).slice(-80).map((rec) => {
                const body = rec.body ?? {}
                const msgs = Array.isArray(body.messages) ? body.messages : []
                const bodyText = JSON.stringify(body).slice(0, 200_000)
                const lane = bodyText.includes(assembly.tokens('d1')) ? 'strict'
                  : bodyText.includes(assembly.tokens('d2')) ? 'asker'
                    : bodyText.includes('U7PWSH_PHASE_') || bodyText.includes('[team-root-work') || bodyText.includes('team-work-settled') ? 'leader' : 'other'
                const toolUses = msgs.flatMap((m) => m?.role === 'assistant' && Array.isArray(m.content)
                  ? m.content.filter((b) => b?.type === 'tool_use').map((b) => String(b.name)) : [])
                const lastUser = [...msgs].reverse().find((m) => m?.role === 'user')
                const resultHead = typeof lastUser?.content === 'string' ? lastUser.content.slice(0, 150)
                  : Array.isArray(lastUser?.content)
                    ? (lastUser.content.find((b) => b?.type === 'tool_result')?.content?.slice?.(0, 150)
                       ?? lastUser.content.find((b) => b?.type === 'tool_result')?.content
                       ?? JSON.stringify(lastUser.content[0] ?? '').slice(0, 150))
                    : null
                return {
                  seq: rec.seq,
                  lane,
                  nCalls: toolUses.length,
                  lastCall: toolUses.length > 0 ? toolUses[toolUses.length - 1] : null,
                  resultHead,
                }
              }),
            }
            try {
              writeFileSync(join(evidence, `${runId}.u7pwsh-evidence.json`), JSON.stringify(record.record.u7pwshDigest, null, 2) + '\n')
            } catch { /* evidence is best-effort */ }

            const verdicts = judgeU7Pwsh({
              oracle, log: logLines,
              journal: record.record.u7pwshDigest.mockLaneTranscript ?? [],
              pwshCalls,
              laneDone, apprArm, replayArm: record.record.u7pwshReplay,
              consumptionCount,
              hostAlive: aliveForVerdict, healthOk: health?.body?.ok === true, stateOk: stateW.hit, surface,
            })
            for (const [id, verdict, detail] of verdicts) {
              if (!done.has(id)) add(id, verdict, detail)
            }
          }
        }
      }
    }
  }

  // ── leak-check ────────────────────────────────────────────────────────────
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  if (!done.has('pwsh:leak-check')) add('pwsh:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  const laneGaps = Object.entries(laneDone).filter(([, v]) => v !== true).map(([k]) => k)
  if (laneGaps.length > 0) log(`lane completion gaps: ${laneGaps.join(',')} (each affected case above already carries the FAIL)`)
  if (!hostAliveAtEvidence && !done.has('pwsh:host-died')) log('host died before the evidence point (verdicts read the evidence as-is)')
}

export default {
  suite: 'u7-pwsh',
  cases: CASES,
  totalRequests: 70,
  run: (opts, ctx) => runU7Pwsh(opts, ctx),
}
