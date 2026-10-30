/**
 * tests/world-factory/suites/070-u7-f-web.mjs — the `u7-f-web` C2 suite,
 * collected by u5-canary-runner.mjs (drop-in, u7-w0 registry).
 *
 * U7-f C2: the governed WEB family (web_fetch/web_search) on the SAME
 * kernel, ONE World, ZERO center diff (CA-01). The web_fetch family row
 * runs its OWN production default transport (plain node:http) — the stub
 * server the RUNNER owns on a MOCK-band port is the independent Oracle:
 * it counts exactly what the real transport wired, and a refused call's
 * zero effect is proven by the stub's silence, never by prose. The Ask
 * chain is the live one: governed member (permissions default: ask — the
 * rule grammar names no network tool, so a governed connect effect can
 * only ever reach a durable Control approval) → leader
 * team_resolve_control allow / deny from the mock corpus.
 *
 * Verdict law: every PASS names its witnesses (stub ledger counts,
 * host-log family witnesses, corpus decision facts). A blocked arm is
 * DISCLOSED, never flipped to PASS — and R-ENVBLOCK-1 splits the three
 * different things "the witness is absent" used to mean (see
 * ../lib/arm-verdict.mjs): the drive reached the step and the product
 * misbehaved → FAIL; the drive never got there → NOT_REACHED (a harness
 * fact, it claims NOTHING about the environment); ENV_BLOCK ONLY when a
 * verifiable environment-unavailability signal exists (the host refusing to
 * provision the governed surface, a kit that cannot be provisioned, an
 * unusable sandbox backend) quoted VERBATIM through `envSignal()`. A bare
 * in-test reason can no longer buy ENV_BLOCK: `add()` demotes it.
 */
import { apiPrompt, authenticate, fetchJson } from '../lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../lib/u6-fs-assembly.mjs'
import { classifyUnwitnessedArm, envSignal, gateEnvBlock } from '../lib/arm-verdict.mjs'
import { createU7WebAssembly, makeU7WebDecide, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES, FAMILY_OWNED_NAMES } from '../lib/u7f-web-assembly.mjs'
import { MOCK_PORT_BANDS, portsOfBands } from '../../paths.mjs'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'

const CASES = Object.freeze(['web:mounted', 'web:fetch-positive', 'web:approval-chain-live', 'web:deny-leg-zero-wire', 'web:search-no-provider', 'web:leak-check'])

/** The runner-owned stub: an INDEPENDENT ledger of what was wired. */
let STUB_CLAIM = null
async function startStub() {
  const hits = Object.create(null)
  const bump = (p) => { hits[p] = (hits[p] ?? 0) + 1 }
  const server = createServer((req, res) => {
    bump(req.url ?? '?')
    if ((req.url ?? '') === '/claim') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end(`${STUB_CLAIM}\n`)
      return
    }
    res.writeHead(404).end('stub-not-found')
  })
  const ports = portsOfBands(MOCK_PORT_BANDS)
  for (const port of ports) {
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve) })
      return { server, port, hits }
    } catch { /* next */ }
  }
  throw new Error('no free MOCK-band port for the web stub')
}

async function runU7Web({ factory, record, rc, log, line, worlds, keepHome, evidence, runId }, { sleep, waitUntil, evaluateLeak, REPO_ROOT, RUN_LIFETIME_MS }) {
  const done = new Set()
  const add = (id, verdict, detail) => {
    // R-ENVBLOCK-1 gate: an ENV_BLOCK that carries no quotable environment
    // signal is a harness non-arrival in disguise. Every writer in this suite
    // passes this door, so the old habit cannot come back.
    const gated = gateEnvBlock(verdict, detail)
    done.add(id)
    record.addCase(id, gated.verdict, gated.detail)
    log(`case ${id}: ${gated.verdict} ${JSON.stringify(gated.detail).slice(0, 260)}`)
  }
  const failRest = (why, extra = {}) => {
    for (const id of CASES) if (!done.has(id)) add(id, 'FAIL', { reason: why, ...extra })
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

  // ── stub BEFORE anything boots: the Oracle exists before the world ───────
  let stub = null
  try {
    STUB_CLAIM = `U7FWEB_CLAIM_${runId}_BODY`
    stub = await startStub()
  } catch (error) {
    failRest('stub bind failed (no MOCK-band port)', { error: String(error?.message ?? error) })
    return
  }
  const stubOrigin = `http://127.0.0.1:${stub.port}`

  // ── materialize + boot (ONE host start of a declared <=3 budget) ────────
  const world = await factory.createWorld({ line, u7FWeb: { rows: [] } })
  worlds.push(world)
  record.record.bindings.worldIds.push(world.id)
  const assembly = createU7WebAssembly({ repoRoot: REPO_ROOT, home: world.home, runStamp: world.id, reportDir: world.logDir, stubOrigin })
  assembly.writePreBootFiles()
  world.u7FWeb.rows.push(...assembly.teamRows())
  await world.startMock({ decide: makeU7WebDecide({ assembly }) })
  record.logHostStart({ world: world.id, phase: 'u7fweb-boot1' })
  rc.arm()
  const startPromise = world.startHost()
  const child = world.instance?.child ?? null
  if (child !== null) rc.bindChild(child, { lifetimeMs: RUN_LIFETIME_MS, processGroup: false })
  let boot
  try { boot = await startPromise } catch (error) {
    try { stub.server.close() } catch { /* idempotent */ }
    failRest(`host start failed: ${String(error?.message ?? error).slice(0, 200)}`)
    return
  }
  record.record.boots = (record.record.boots ?? []).concat([{ phase: 'u7fweb-boot1', world: world.id, port: boot.port, logPath: boot.logPath }])
  const origin = `http://127.0.0.1:${boot.port}`

  // ── readiness: p6t6 health + anchored Team Session + discovery → create ──
  let health = null
  const healthW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    health = st
    return st.status === 200 && st.body?.ok === true
  }, 120_000)
  let stateBody = null
  const stateW = await waitA(async () => {
    const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000)
  let cookie = null
  let createBody = null
  if (!healthW.hit || health?.body?.ok !== true || !stateW.hit) {
    failRest(`mount readiness failed: health=${String(health?.status)} stateHit=${String(stateW.hit)}`)
  } else {
    cookie = await authenticate(origin, world.token)
    const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7fweb')
    if (discPrompt.status !== 200) {
      failRest(`discovery prompt rejected: ${String(discPrompt.status)}`)
    } else {
      const discW = await waitUntil(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), { timeoutMs: 150_000 })
      if (!discW.hit) {
        failRest('discovery model request absent (deny list cannot be computed)')
      } else {
        const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
        const surface = [...new Set(disc)]
        // The governed pair is EXCLUDED from builtinToolDeny (plane-OWNED
        // names on a governed member — see the assembly header).
        const denyList = surface.filter((n) => !n.startsWith('team_')
          && !MANAGED_TOOL_NAMES.includes(n)
          && !SAFE_UNMANAGED_TOOL_NAMES.includes(n)
          && !FAMILY_OWNED_NAMES.includes(n))
        assembly.writeMainBlueprint(denyList)
        const created = await remoteCall(fetchJson, origin, cookie, 'team.create', { rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 } })
        createBody = created.body ?? null
        const createOk = created.status === 200 && created.body?.result?.ok === true
        if (!createOk) {
          failRest(`team.create failed: status=${String(created.status)} body=${JSON.stringify(created.body ?? null).slice(0, 300)}`)
        } else {
          // ── the runner IS the Human resolver (u7-4a proven pattern): read
          // the durable ask rows through the p6t6 LEDGER FACE
          // (team.getLedgerPage control-* facts — the face the u7-4a
          // approver proved), settle them through the PUBLIC
          // team.resolveControl v4 seam. The leader holds NO control tools,
          // so every decision provably came from the human public seam,
          // one write per row. First pending web_fetch ask -> ALLOW (the
          // approved fetch runs); the next -> DENY (zero wire). The probe
          // row's /__u7fweb/controls face is exercised as a SECOND witness
          // (its disagreement with the ledger is itself evidence; the
          // c2-run2 finding — the exact-route read with a query string —
          // is logged, never depended on).
          const askFacts = { resolutions: [], errors: [], probe: null, lastSeenRows: [] }
          // The proven remote envelope: { result: { ok, value: { data } } }
          // — exactly the face the u6-jobs approver consumes.
          const unwrap = (body) => {
            const v = body?.result?.value
            return v && typeof v === 'object' && 'data' in v ? v.data : v
          }
          const ledgerControlRows = async () => {
            const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
            let afterSequence = 0
            for (let pageNo = 0; pageNo < 10; pageNo += 1) {
              const page = await remoteCall(fetchJson, origin, cookie, 'team.getLedgerPage',
                { teamSessionId: assembly.CREATE_ROOT, afterSequence, limit: 500 }, 'u7fweb-ledger', 1)
              const r = page?.body?.result
              if (page?.status !== 200 || r?.ok === false) {
                throw new Error(`team.getLedgerPage failed: status=${String(page?.status)} ${JSON.stringify(r ?? null).slice(0, 160)}`)
              }
              const data = unwrap(page.body)
              const entries = Array.isArray(data?.entries) ? data.entries : []
              for (const e of entries) {
                if (byType[e?.factType] === undefined) continue
                let payload = e.payload
                if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
                byType[e.factType].push({ payload: payload ?? {} })
              }
              const next = data?.nextAfterSequence
              if (next === null || next === undefined || entries.length === 0) break
              afterSequence = Number(next)
            }
            const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']]
              .map((f) => String(f.payload?.requestId ?? '')))
            const rows = []
            for (const f of byType['control-request-recorded']) {
              const p = f.payload ?? {}
              if (p.requestId === undefined) continue
              rows.push({
                requestId: String(p.requestId),
                toolName: p.toolName ?? null,
                summary: String(p.summary ?? '').slice(0, 160),
                status: settled.has(String(p.requestId)) ? 'settled' : 'pending',
              })
            }
            return rows
          }
          let approverStop = false
          const seen = new Map()
          const approver = (async () => {
            for (;;) {
              if (approverStop) return
              try {
                const rows = await ledgerControlRows()
                askFacts.lastSeenRows = rows.map((r) => ({ requestId: String(r.requestId).slice(0, 16), toolName: r.toolName, status: r.status, summary: String(r.summary).slice(0, 120) }))
                for (const r of rows) {
                  const rid = String(r?.requestId ?? '')
                  if (rid === '' || seen.has(rid)) continue
                  const tag = `${String(r?.toolName ?? '')} ${String(r?.summary ?? '')}`
                  if (r?.status === 'pending' && /web_fetch/.test(tag)) {
                    const decision = seen.size === 0 ? 'allow' : 'deny'
                    const res = await remoteCall(fetchJson, origin, cookie, 'team.resolveControl',
                      { teamSessionId: assembly.CREATE_ROOT, requestId: rid, decision, note: `u7fweb-c2-${decision}` }, 'u7fweb-approval', 4)
                    const ok = res?.status === 200 && (res?.body?.result?.ok === true || res?.body?.result?.value !== undefined)
                    seen.set(rid, { decision, ok })
                    askFacts.resolutions.push({ requestId: rid, decision, ok, resolveStatus: res?.status ?? null, summary: String(r?.summary ?? '').slice(0, 160) })
                    log(`approval ${String(decision)} requestId=${rid.slice(0, 12)} ok=${String(ok)} status=${String(res?.status)}`)
                  }
                }
              } catch (err) { askFacts.errors.push(String(err?.message ?? err).slice(0, 160)) }
              await sleep(350)
            }
          })()
          // Second witness face (loud, non-blocking): the probe row.
          try {
            const h = await fetchJson(`${origin}/__u7fweb/health`, undefined, 10_000)
            const c = await fetchJson(`${origin}/__u7fweb/controls?session=${encodeURIComponent(assembly.CREATE_ROOT)}`, undefined, 10_000)
            askFacts.probe = { health: h?.status, healthBody: h?.body ?? null, controls: c?.status, controlsBody: c?.body ?? null }
          } catch (err) { askFacts.probe = { error: String(err?.message ?? err).slice(0, 160) } }
          const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
          const wake = async (tag) => {
            const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7FWEB_PHASE_${tag}`, 'u7fweb-wake')
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
          const askerDone = await wakeCadence('U7FWEB_STRICT_DONE', 240_000, 'a')
          const leaderDone = await wakeCadence('U7FWEB_L1_DONE', 90_000, 'z')
          approverStop = true
          try { await approver } catch { /* loop exits on the flag */ }
          record.record.u7fwebLanes = { askerDone, leaderDone }
          record.record.u7fwebAsks = askFacts
        }
      }
    }
  }

  // ── evidence: the STUB LEDGER (independent), host-log witnesses, corpus ──
  try { stub.server.close() } catch { /* idempotent */ }
  const claimHits = stub.hits['/claim'] ?? 0
  const victimHits = stub.hits[assembly.VICTIM_PATH] ?? 0
  const otherHits = Object.entries(stub.hits).filter(([p]) => p !== '/claim' && p !== assembly.VICTIM_PATH)
  const stubLedger = { port: stub.port, claimHits, victimHits, other: Object.fromEntries(otherHits) }
  record.record.u7fwebStub = stubLedger
  let logLines = []
  try {
    const text = readFileSync(boot.logPath, 'utf8')
    logLines = text.split('\n').filter((l) => /governed-web-fetch|governed-web-search|placement-feed rows=|a5-plane: (mount|placement)-REFUSED|PLANE_WEB_/.test(l))
  } catch { /* log unreadable → verdicts fall to the stub ledger */ }
  const corpus = JSON.stringify((world.mock?.requests ?? []).map((r) => ({ u: (r.body?.messages ?? []).map((m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n').slice(0, 4000), reply: r.reply ?? null })))
  const anyText = (world.mock?.requests ?? []).map((r) => JSON.stringify(r.body?.messages ?? []) + JSON.stringify(r.reply ?? null)).join('\n')

  // ── verdicts (every PASS names witnesses; walls DISCLOSE, never PASS) ────
  const placement = logLines.filter((l) => l.includes('placement-feed rows=') && l.includes('web_fetch'))
  const ranLines = logLines.filter((l) => l.includes('governed-web-fetch RAN'))
  const denyObs = logLines.filter((l) => /governed-web-fetch (pa-refused|lane-denied|default-deny)/.test(l))
  const searchLines = logLines.filter((l) => l.includes('governed-web-search'))
  const resolveFacts = (record.record.u7fwebAsks?.resolutions ?? [])
  const allowResolution = resolveFacts.find((r) => r.decision === 'allow') ?? null
  const denyResolution = resolveFacts.filter((r) => r.decision === 'deny').at(-1) ?? null
  const deniedRefusal = logLines.filter((l) => l.includes('pa-refused') && l.includes('APPROVAL_DENIED'))
  const askNoticed = anyText.includes('[team-control requestId=')
  const askRowsLedger = (record.record.u7fwebAsks?.lastSeenRows ?? [])
  const noProviderSeen = anyText.includes('WEB_SEARCH_NO_PROVIDER')
  const refusalSeen = anyText.includes('refused-admission') || anyText.includes('refused-approval')
  const lanes = record.record.u7fwebLanes ?? {}
  // ── R-ENVBLOCK-1: arrival witnesses + the one admissible environment signal ─
  // Arrival at a step must be witnessed by something OTHER than the witness
  // being asserted (otherwise "never reached" is circular): the family logged
  // the call, the stub ledger saw wire, an ask surfaced in a transcript, or a
  // decision came back through the public seam.
  const fetchStepReached = ranLines.length > 0 || claimHits > 0 || askNoticed || resolveFacts.length > 0
  const chainStepReached = askRowsLedger.length > 0 || askNoticed || resolveFacts.length > 0
  const denyLegStepReached = resolveFacts.some((r) => r.decision === 'deny') || deniedRefusal.length > 0 || victimHits > 0
  const searchStepReached = searchLines.length > 0 || anyText.includes('web_search')
  // The only channel this suite can honestly quote a wall from is the host log
  // it already captured. PRODUCT refusals (PLANE_WEB_*, APPROVAL_DENIED,
  // WEB_SEARCH_NO_PROVIDER) are the witnesses several arms assert — envSignal()
  // refuses them as environment evidence by construction.
  const envWallSignal = envSignal({
    channel: 'host-log',
    text: logLines.find((l) => /a5-plane: (?:mount|placement)-REFUSED|EADDRINUSE|EACCES|EPERM/.test(l)) ?? null,
    observed: logLines,
  })
  log(`approvals: ${JSON.stringify(resolveFacts).slice(0, 500)} errors=${JSON.stringify(record.record.u7fwebAsks?.errors ?? []).slice(0, 200)}`)
  log(`probe second face: ${JSON.stringify(record.record.u7fwebAsks?.probe ?? null).slice(0, 300)}`)

  if (!done.has('web:mounted')) {
    if (health?.body?.ok === true && (placement.length > 0 || ranLines.length > 0 || logLines.some((l) => l.includes('governed-web-fetch')))) {
      add('web:mounted', 'PASS', { health: 'p6t6 ok', placement: placement[0]?.slice(0, 220) ?? 'family witness in log', webEnabled: 'planeCfg.webEnabled=true (trusted row config)' })
    } else {
      add('web:mounted', 'FAIL', { health: String(health?.status), witnesses: logLines.slice(0, 5) })
    }
  }
  if (!done.has('web:fetch-positive')) {
    if (claimHits === 1 && ranLines.some((l) => l.includes(`dest=${stubOrigin}`) && l.includes('status=200')) && anyText.includes(String(STUB_CLAIM))) {
      add('web:fetch-positive', 'PASS', { stubLedger, ran: ranLines[0]?.slice(0, 220), claimReadBackInCorpus: true, law: 'durable ALLOW -> grant consumed -> the family PRODUCTION node:http transport wired the stub once; body read back through the model transcript' })
    } else if (askRowsLedger.length === 0) {
      // R-ENVBLOCK-1: no durable ask row is EITHER a harness non-arrival (the
      // governed member never got to the governed call) OR a product failure to
      // book one. ENV_BLOCK only if the HOST said the surface is unavailable.
      const v = classifyUnwitnessedArm({
        step: 'the governed web_fetch PA step (a durable ask row on the ledger face)',
        reachedStep: fetchStepReached,
        signal: envWallSignal,
        extra: { stubLedger, askerDone: String(lanes.askerDone), ran: ranLines.slice(0, 2) },
      })
      add('web:fetch-positive', v.verdict, v.detail)
    } else {
      add('web:fetch-positive', 'FAIL', { stubLedger, ran: ranLines.slice(0, 3), askerDone: String(lanes.askerDone), resolutions: resolveFacts })
    }
  }
  if (!done.has('web:approval-chain-live')) {
    if (askRowsLedger.length >= 2 && allowResolution?.ok === true && denyResolution?.ok === true) {
      add('web:approval-chain-live', 'PASS', {
        askRows: askRowsLedger.length, askNoticed,
        witness: `two durable PA ask rows in the p6t6 ledger (tool=web_fetch); the Human public seam team.resolveControl v4 answered allow then deny; host log: RAN x${String(ranLines.length)}, APPROVAL_DENIED x${String(deniedRefusal.length)}`,
        law: 'leader carries NO control tools — the decisions came from the human public seam only',
      })
    } else if (allowResolution === null && askRowsLedger.length === 0) {
      // R-ENVBLOCK-1: "upstream wall" was prose. Split on arrival witnesses;
      // an environment claim now needs the host's own quoted refusal line.
      const v = classifyUnwitnessedArm({
        step: 'the live approval chain (durable PA ask rows answered through team.resolveControl)',
        reachedStep: chainStepReached,
        signal: envWallSignal,
        extra: { resolutions: resolveFacts, askRows: askRowsLedger.length },
      })
      add('web:approval-chain-live', v.verdict, v.detail)
    } else {
      add('web:approval-chain-live', 'FAIL', { askRows: askRowsLedger.length, allowResolution, denyResolution })
    }
  }
  if (!done.has('web:deny-leg-zero-wire')) {
    if (victimHits === 0 && (deniedRefusal.length > 0 || refusalSeen)) {
      add('web:deny-leg-zero-wire', 'PASS', { victimHits: 0, witness: deniedRefusal[0]?.slice(0, 200) ?? 'refused-admission in corpus', law: 'human seam DENIED the second ask; the stub proves ZERO wire to the denied endpoint' })
    } else if (victimHits > 0) {
      add('web:deny-leg-zero-wire', 'FAIL', { victimHits, deniedRefusal: deniedRefusal.slice(0, 2), refusalSeen, reason: 'DENIED call wired the stub' })
    } else {
      // R-ENVBLOCK-1: zero wire with no refusal witness is a non-arrival
      // unless the environment itself refused; the DENIED-the-wire FAIL leg
      // above is untouched.
      const v = classifyUnwitnessedArm({
        step: 'the DENIED leg (a resolved deny whose refusal the stub must not see)',
        reachedStep: denyLegStepReached,
        signal: envWallSignal,
        extra: { victimHits: 0, deniedRefusal: deniedRefusal.slice(0, 2), refusalSeen, askRows: askRowsLedger.length },
      })
      add('web:deny-leg-zero-wire', v.verdict, v.detail)
    }
  }
  if (!done.has('web:search-no-provider')) {
    if (noProviderSeen && searchLines.filter((l) => l.includes('RAN')).length === 0) {
      add('web:search-no-provider', 'PASS', { witness: 'WEB_SEARCH_NO_PROVIDER typed refusal in the member transcript; no governed-web-search RAN witness; zero stub wire beyond /claim', stubLedger })
    } else if (!noProviderSeen && searchStepReached === false && lanes.askerDone !== true) {
      // R-ENVBLOCK-1: the asker lane not arriving is a drive fact. It becomes
      // ENV_BLOCK only on a quoted host wall, and it stays FAIL once the
      // search step was actually reached without the typed refusal.
      const v = classifyUnwitnessedArm({
        step: 'the governed web_search step (the WEB_SEARCH_NO_PROVIDER typed refusal)',
        reachedStep: searchStepReached,
        signal: envWallSignal,
        extra: { askerDone: String(lanes.askerDone), searchWitnesses: searchLines.length },
      })
      add('web:search-no-provider', v.verdict, v.detail)
    } else {
      add('web:search-no-provider', 'FAIL', { noProviderSeen })
    }
  }

  // ── leak-check ───────────────────────────────────────────────────────────
  try { await rc.stopChild() } catch { /* idempotent */ }
  const receipts = await world.teardown({ keepHome })
  const leak = await evaluateLeak({ world, receipts, factory })
  if (!done.has('web:leak-check')) add('web:leak-check', leak.ok ? 'PASS' : 'FAIL', leak.detail)
  log(`u7fweb run ${runId}: stub=${JSON.stringify(stubLedger)} lanes=${JSON.stringify(record.record.u7fwebLanes ?? {})}`)
}

export default {
  suite: 'u7-f-web',
  cases: CASES,
  totalRequests: 90,
  run: (opts, ctx) => runU7Web(opts, ctx),
}
