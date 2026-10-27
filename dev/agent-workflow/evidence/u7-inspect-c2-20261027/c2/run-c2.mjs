/**
 * dev/agent-workflow/evidence/u7-inspect-c2-20261027/c2/run-c2.mjs — the
 * inspect C2 COMPLETION round on master: ONE live Host boot per execution,
 * each boot DECLARED in `boot-budget.jsonl` before it starts (budget 3 —
 * the runner refuses a 4th declaration), driving the governed inspect
 * family through the PUBLIC world-factory machinery.
 *
 * Forked from the #404 runner (`u7-f-inspect-20261026/c2/run-c2.mjs`, kept
 * byte-untouched with its records). The World, row config and envelopes are
 * the #404 ones; the DRIVE SCRIPT changes (root causes measured on the
 * boot-5 capture — see ../README.md):
 *   D1  leader fence self-satisfied by its own hold text (assembly F1)
 *   D2  approval is the HUMAN public seam: this runner polls the durable
 *       Control rows (remote team.getLedgerPage) and resolves through
 *       remote team.resolveControl v4 — the u7-f-web proven pattern; the
 *       leader keeps only the read-only team_list_pending_control
 *   D3  the pending witness parses the REAL list-output shape
 *       (`tool_result.content[].text` → {"status":"pending-control-listed",
 *       "pending":[{requestId,toolName,…}],"count":N}) — assembly
 *       `pendingListedOf`
 *   D4  window: strict lane 420 s / 60 wakes (was 240 s / 20)
 *
 * Legs (verdicts are evidence-first; a missing witness is FAIL, never prose):
 *   u7f:mounted              health + state + team.create + placement-feed
 *   u7f:skill-load           governed team_skill RAN after a human ALLOW;
 *                            skill content read back in the member transcript
 *   u7f:inspect-list         governed team_cordis_inspect_list RAN after a
 *                            human ALLOW; the provider directory is read back
 *                            from the member's tool_result (count == RAN count)
 *   u7f:inspect-query        governed team_cordis_inspect_query host/Tool/
 *                            listTools RAN after a human ALLOW; data read back
 *   u7f:refusal-zero-effect  unknown-provider query: typed refusal in the
 *                            member transcript, ZERO durable ask row for it,
 *                            ZERO dispatch line for that provider
 *   u7f:approval-leg         every durable ask: pending in a leader listing
 *                            (real shape) → human-seam resolve ok → exactly
 *                            ONE decision and ONE control-allow-consumed fact
 *   u7f:leak-check           the OUTSIDE-the-root secret claim appears in no
 *                            transcript and no host log; bytes unchanged
 *
 * Run:  node dev/agent-workflow/evidence/u7-inspect-c2-20261027/c2/run-c2.mjs
 */
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { TestWorldFactory, apiPrompt, authenticate, fetchJson } from '../../../../../tests/world-factory/lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { createRunRecord, readAuthorityBinding } from '../../../../../tests/world-factory/lib/run-record.mjs'
import { testUseTree } from '../../../../../tests/paths.mjs'
import { createU7fInspectAssembly, makeU7fInspectDecide, pendingListedOf } from './u7f-inspect-assembly.mjs'
import { buildExcerpt } from '../../u7-f-inspect-20261026/c2/trim-mock-corpus.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BUDGET = 3
const BUDGET_PATH = join(HERE, 'boot-budget.jsonl')
const FAMILY_TOOLS = ['team_skill', 'team_cordis_inspect_list', 'team_cordis_inspect_query']

const SELECTED = ['u7f:mounted', 'u7f:skill-load', 'u7f:inspect-list', 'u7f:inspect-query', 'u7f:refusal-zero-effect', 'u7f:approval-leg', 'u7f:leak-check']
const notes = []
const git = (args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim()
const run = createRunRecord({
  runId: `u7insp-c2-${Date.now().toString(36)}`,
  suite: 'u7f-inspect-family-c2-completion',
  selectedCases: SELECTED,
  bindings: {
    teamSha: git(['rev-parse', 'HEAD']),
    // product/test/script trees at boot: clean = the boot ran exactly teamSha
    teamTreeClean: git(['status', '--porcelain', '--', 'packages', 'tests', 'scripts']) === '',
    hostSha: 'set-from-assertHostBase-in-main',
    authority: readAuthorityBinding(REPO),
  },
})
const add = (id, verdict, detail) => {
  run.addCase(id, verdict, { detail })
  console.log(`[u7insp-c2] case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 400)}`)
}

async function fetchJsonRetry(url, opts, timeoutMs) {
  try { return await fetchJson(url, opts, timeoutMs) } catch (e) { return { status: 0, body: null, error: String(e?.message ?? e) } }
}

/** Declare the boot BEFORE it starts; refuse past the budget. */
function declareBoot(world) {
  const prior = existsSync(BUDGET_PATH) ? readFileSync(BUDGET_PATH, 'utf8').split('\n').filter((l) => l.trim() !== '') : []
  const n = prior.length + 1
  if (n > BUDGET) throw new Error(`boot budget exhausted: ${String(prior.length)}/${String(BUDGET)} declared in ${BUDGET_PATH}`)
  const entry = { boot: n, budget: BUDGET, declaredAt: new Date().toISOString(), runId: run.record.runId, world: world.id, teamSha: run.record.bindings.teamSha }
  appendFileSync(BUDGET_PATH, JSON.stringify(entry) + '\n')
  return entry
}

async function main() {
  const factory = new TestWorldFactory({
    repoRoot: REPO,
    // raw logs live OUTSIDE git (gitignored .artifacts); the cited host log
    // is copied beside the record after the run.
    evidenceRoot: join(REPO, '.artifacts', 'tmp', 'u7-inspect-c2-world'),
    hostTree: testUseTree(REPO),
  })
  const hostBase = factory.assertHostBase('c2-check')
  run.record.bindings.hostSha = hostBase.head
  const world = await factory.createWorld({ line: 'u7insp' })
  const assembly = createU7fInspectAssembly({
    repoRoot: REPO, home: world.home, runStamp: world.id, reportDir: world.logDir, sessionRoot: factory.hostTree,
  })
  const planted = assembly.writePreBootFiles()
  const kind = {
    option: 'u7fRows', probe: null, paths: {}, ledgerRows: {}, envKeys: [], env: () => ({}),
    patchHeader: [
      'U7 inspect C2 completion World (evidence script, no shared kind',
      'registration): the production Team row with the INSPECT family ON over',
      'one sanctioned skill root, p6t6 observer and preset declarations.',
    ],
  }
  world.kinds = [kind]
  world.activeKind = kind
  world.u7fRows = { rows: assembly.teamRows() }
  await world.startMock({ decide: makeU7fInspectDecide({ assembly }) })
  const declared = declareBoot(world)
  run.record.bootDeclaration = declared
  console.log(`[u7insp-c2] boot ${String(declared.boot)}/${String(BUDGET)} declared; starting (world ${world.id})`)
  const t0 = Date.now()
  let boot = null
  try {
    boot = await world.startHost({ bootTimeoutMs: 150_000 })
  } catch (error) {
    add('u7f:mounted', 'START_FAILED', { reason: `host start failed: ${String(error?.message ?? error).slice(0, 300)}` })
  }
  if (boot !== null) {
    run.logHostStart({ phase: 'u7insp-c2-boot', boot: declared.boot, world: world.id, port: boot.port, bootMs: Date.now() - t0 })
    try { await drive({ world, assembly, planted, boot }) } catch (e) { notes.push(`drive threw: ${String(e?.stack ?? e).slice(0, 400)}`) }
  }
  const tag = `boot${String(declared.boot)}`
  if (boot !== null) {
    try { copyFileSync(boot.logPath, join(HERE, `host-${tag}.log`)) } catch { notes.push('host log copy failed') }
  }
  try {
    const rawCorpus = JSON.stringify((world.mock?.requests ?? []).map((r) => ({
      seq: r.seq, path: r.path, status: r.status, body: r.body ?? null, reply: r.reply ?? null,
    })))
    const excerpt = buildExcerpt(rawCorpus)
    excerpt.note = `Declared EXCERPT of the ${tag} mock corpus (selector: u7-f-inspect-20261026/c2/trim-mock-corpus.mjs witnessEntryIndexes — the final entry carries the full leader chain). Kept entries are byte-identical to the capture; the raw capture is never committed (1 MiB evidence guard) and its digest is below.`
    writeFileSync(join(HERE, `mock-corpus-${tag}.json`), JSON.stringify(excerpt, null, 1))
  } catch (e) { notes.push(`mock corpus dump failed: ${String(e?.message ?? e)}`) }
  try { await world.stopHost() } catch { /* receipts below */ }
  const receipts = await world.teardown({ keepHome: false }).catch((e) => ({ error: String(e?.message ?? e) }))
  Object.assign(run.record, {
    notes,
    teardown: { receipts: receipts ?? null },
    evidence: [`dev/agent-workflow/evidence/u7-inspect-c2-20261027/c2/host-${tag}.log`, `dev/agent-workflow/evidence/u7-inspect-c2-20261027/c2/mock-corpus-${tag}.json`]
      .filter((p) => existsSync(join(REPO, p))),
    mockDigest: world.mock === null ? [] : world.mockRequestDigest().slice(-60),
  })
  // Finalize BEFORE writing (RUN rule).
  run.finalize()
  const out = join(HERE, `c2-verdicts-${tag}.json`)
  run.write(out)
  console.log(`[u7insp-c2] record written to ${out} (u5-run-record/1, finalized before write)`)
  const fails = run.record.cases.filter((v) => v.verdict !== 'PASS').length
  console.log(`[u7insp-c2] DONE overall=${run.record.overall} pass=${String(run.record.cases.length - fails)} nonpass=${String(fails)}`)
}

async function drive({ world, assembly, planted, boot }) {
  const origin = `http://127.0.0.1:${boot.port}`
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
  let health = null
  const healthW = await waitA(async () => {
    health = await fetchJsonRetry(`${origin}/__p6t6/health`, undefined, 20_000)
    return health.status === 200 && typeof health.body?.ok === 'boolean'
  }, 120_000)
  let stateBody = null
  const stateW = healthW.hit ? await waitA(async () => {
    const st = await fetchJsonRetry(`${origin}/__p6t6/state`, undefined, 30_000)
    stateBody = st.body
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.phase === 'create' && stateBody?.teamSession !== null
  }, 90_000) : { hit: false }
  if (!healthW.hit || health?.body?.ok !== true) {
    add('u7f:mounted', 'FAIL', { reason: `health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 400)}` })
    return
  }
  if (!stateW.hit) {
    add('u7f:mounted', 'FAIL', { reason: `anchored Team Session never appeared: ${JSON.stringify(stateBody ?? null).slice(0, 300)}` })
    return
  }
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7insp-c2')
  if (discPrompt.status !== 200) {
    add('u7f:mounted', 'FAIL', { reason: `discovery prompt rejected: ${String(discPrompt.status)}` })
    return
  }
  const discW = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC)), 120_000)
  if (!discW.hit) {
    add('u7f:mounted', 'FAIL', { reason: 'discovery model request absent (deny list cannot be computed)' })
    return
  }
  await sleep(1500)
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  const denyList = surface.filter((n) => !n.startsWith('team_')
    && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'].includes(n)
    && !['todo_write'].includes(n))
  assembly.writeMainBlueprint(denyList)
  const hostLog = () => { try { return readFileSync(boot.logPath, 'utf8') } catch { return '' } }
  const created = await remoteCall(fetchJsonRetry, origin, cookie, 'team.create', {
    rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 },
  })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  const placement = hostLog().split('\n').filter((l) => l.includes('placement-feed rows='))
  add('u7f:mounted', createOk && FAMILY_TOOLS.every((n) => (placement.at(-1) ?? '').includes(n)) ? 'PASS' : 'FAIL', {
    healthOk: true, stateOk: true, createOk,
    createBody: createOk ? 'ok' : JSON.stringify(created.body ?? null).slice(0, 1200),
    placementFeed: placement.length > 0 ? placement.at(-1).slice(0, 300) : null,
  })
  if (!createOk) return

  // ── D2: the runner IS the human resolver over the PUBLIC remote seam ────
  const unwrap = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const ledgerControl = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJsonRetry, origin, cookie, 'team.getLedgerPage',
        { teamSessionId: assembly.CREATE_ROOT, afterSequence, limit: 500 }, 'u7insp-ledger', 1)
      const r = page?.body?.result
      if (page?.status !== 200 || r?.ok === false) throw new Error(`team.getLedgerPage failed: status=${String(page?.status)} ${JSON.stringify(r ?? null).slice(0, 160)}`)
      const data = unwrap(page.body)
      const entries = Array.isArray(data?.entries) ? data.entries : []
      for (const e of entries) {
        if (byType[e?.factType] === undefined) continue
        let payload = e.payload
        if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
        byType[e.factType].push({ sequence: e.sequence ?? null, payload: payload ?? {} })
      }
      const next = data?.nextAfterSequence
      if (next === null || next === undefined || entries.length === 0) break
      afterSequence = Number(next)
    }
    const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']]
      .map((f) => String(f.payload?.requestId ?? '')))
    return {
      requests: byType['control-request-recorded'].map((f) => ({
        requestId: String(f.payload?.requestId ?? ''), toolName: f.payload?.toolName ?? null,
        status: settled.has(String(f.payload?.requestId ?? '')) ? 'settled' : 'pending',
      })),
      decisions: byType['control-decision-recorded'].map((f) => ({ requestId: String(f.payload?.requestId ?? ''), decision: f.payload?.decision ?? null })),
      consumptions: byType['control-allow-consumed'].map((f) => ({ requestId: String(f.payload?.requestId ?? '') })),
      abandoned: byType['control-request-abandoned'].map((f) => ({ requestId: String(f.payload?.requestId ?? '') })),
    }
  }
  const asks = { resolutions: [], errors: [], firstSeenAt: new Map() }
  let approverStop = false
  const approver = (async () => {
    for (;;) {
      if (approverStop) return
      try {
        const ctl = await ledgerControl()
        const listed = new Set(pendingListedOf(world.mock?.requests ?? []).map((p) => p.requestId))
        for (const row of ctl.requests) {
          if (row.status !== 'pending' || !FAMILY_TOOLS.includes(String(row.toolName))) continue
          if (asks.resolutions.some((r) => r.requestId === row.requestId)) continue
          if (!asks.firstSeenAt.has(row.requestId)) asks.firstSeenAt.set(row.requestId, Date.now())
          // Resolve AFTER the leader's listing showed the row as pending
          // (the approval-leg witness); never stall the member past 45 s.
          const witnessed = listed.has(row.requestId)
          if (!witnessed && Date.now() - asks.firstSeenAt.get(row.requestId) < 45_000) continue
          const res = await remoteCall(fetchJsonRetry, origin, cookie, 'team.resolveControl',
            { teamSessionId: assembly.CREATE_ROOT, requestId: row.requestId, decision: 'allow', note: 'u7insp-c2-human-allow' }, 'u7insp-approval', 4)
          const ok = res?.status === 200 && res?.body?.result?.ok === true
          asks.resolutions.push({ requestId: row.requestId, toolName: row.toolName, decision: 'allow', ok, witnessedPendingInListing: witnessed, status: res?.status ?? null, body: ok ? 'ok' : JSON.stringify(res?.body ?? null).slice(0, 300) })
          console.log(`[u7insp-c2] human allow ${row.requestId} tool=${String(row.toolName)} ok=${String(ok)} witnessed=${String(witnessed)}`)
        }
      } catch (err) { if (asks.errors.length < 20) asks.errors.push(String(err?.message ?? err).slice(0, 160)) }
      await sleep(500)
    }
  })()
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7F_PHASE_${tag}`, 'u7insp-c2-wake').catch(() => null)
    if (pr !== null && pr.status !== 200) notes.push(`wake ${tag} rejected status=${String(pr.status)}`)
  }
  const wakeCadence = async (content, deadlineMs, tag, maxWakes) => {
    const t0w = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(content)) return true
      if (Date.now() - t0w > deadlineMs) return replySeen(content)
      if (Date.now() - lastWake > 6000 && wakes < maxWakes) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await sleep(350)
    }
  }
  const strictDone = await wakeCadence(assembly.DONE.strict, 420_000, 's', 60)
  const leaderDone = await wakeCadence(assembly.DONE.leader, 120_000, 'z', 15)
  approverStop = true
  try { await approver } catch { /* loop exits on the flag */ }
  notes.push(`lanes: strict=${String(strictDone)} leader=${String(leaderDone)}`)
  let ctl = null
  try { ctl = await ledgerControl() } catch (e) { notes.push(`final ledger read failed: ${String(e?.message ?? e)}`) }
  run.record.controlLedger = ctl
  run.record.humanResolutions = asks.resolutions
  run.record.approverErrors = asks.errors

  // ── evidence ──────────────────────────────────────────────────────────────
  const requests = world.mock?.requests ?? []
  const corpus = JSON.stringify(requests.map((r) => r.body ?? {}))
  const log = hostLog()
  const logLines = log.split('\n')
  // Structural read-back: every tool_result keyed by the tool_use that
  // produced it (name + input), over every captured request.
  const results = new Map()
  for (const rec of requests) {
    const uses = new Map()
    for (const m of rec?.body?.messages ?? []) {
      for (const b of Array.isArray(m?.content) ? m.content : []) {
        if (b?.type === 'tool_use') uses.set(b.id, { name: b.name, input: b.input })
        if (b?.type === 'tool_result' && uses.has(b.tool_use_id)) {
          results.set(b.tool_use_id, { ...uses.get(b.tool_use_id), isError: b.is_error === true, text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('') })
        }
      }
    }
  }
  const resultsOf = (name) => [...results.values()].filter((r) => r.name === name)
  const allowedFor = (tool) => asks.resolutions.filter((r) => r.toolName === tool && r.ok)

  const skillClaim = readFileSync(assembly.files.demo.path, 'utf8').includes('multiply everything by two')
  const skillRes = resultsOf('team_skill')
  const skillRan = logLines.filter((l) => l.includes('governed-skill RAN name=u7f-demo-skill'))
  add('u7f:skill-load', skillRes.some((r) => !r.isError && r.text.includes('<skill_content') && r.text.includes('multiply everything by two'))
    && skillRan.length === 1 && allowedFor('team_skill').length === 1 && skillClaim ? 'PASS' : 'FAIL', {
    readBack: skillRes.map((r) => ({ isError: r.isError, head: r.text.slice(0, 120) })),
    ranWitness: skillRan.map((l) => l.slice(0, 200)),
    humanAllow: allowedFor('team_skill').map((r) => r.requestId),
  })

  const listRan = logLines.filter((l) => l.includes('governed-inspect-list RAN'))
  const listCount = Number(/count=(\d+)/.exec(listRan[0] ?? '')?.[1] ?? NaN)
  const listRes = resultsOf('team_cordis_inspect_list')
  let readBackProviders = null
  for (const r of listRes) {
    if (r.isError) continue
    try { const j = JSON.parse(r.text); if (Array.isArray(j?.providers)) readBackProviders = j.providers } catch { /* not JSON */ }
  }
  add('u7f:inspect-list', listRan.length === 1 && listCount > 0 && readBackProviders !== null && readBackProviders.length === listCount
    && allowedFor('team_cordis_inspect_list').length === 1 ? 'PASS' : 'FAIL', {
    ranWitness: listRan.map((l) => l.slice(0, 200)),
    readBackProviderCount: readBackProviders?.length ?? null,
    readBackProviders: (readBackProviders ?? []).map((p) => `${String(p?.platform)}/${String(p?.id)}`),
    toolResults: listRes.map((r) => ({ isError: r.isError, head: r.text.slice(0, 200) })),
    humanAllow: allowedFor('team_cordis_inspect_list').map((r) => r.requestId),
  })

  const queryRes = resultsOf('team_cordis_inspect_query')
  const posRes = queryRes.filter((r) => r.input?.provider === 'Tool')
  const posRan = logLines.filter((l) => l.includes('governed-inspect-query RAN platform=host provider=Tool method=listTools'))
  let posData = null
  for (const r of posRes) {
    if (r.isError) continue
    try { const j = JSON.parse(r.text); if (j?.provider === 'Tool' && j?.method === 'listTools' && j?.data !== undefined) posData = j.data } catch { /* not JSON */ }
  }
  add('u7f:inspect-query', posRan.length === 1 && posData !== null && allowedFor('team_cordis_inspect_query').length === 1 ? 'PASS' : 'FAIL', {
    ranWitness: posRan.map((l) => l.slice(0, 200)),
    readBackDataHead: posData === null ? null : JSON.stringify(posData).slice(0, 300),
    toolResults: posRes.map((r) => ({ isError: r.isError, head: r.text.slice(0, 300) })),
    otherQueryLog: logLines.filter((l) => l.includes('governed-inspect-query') && !l.includes('RAN')).slice(0, 4).map((l) => l.slice(0, 200)),
    humanAllow: allowedFor('team_cordis_inspect_query').map((r) => r.requestId),
  })

  const unkRes = queryRes.filter((r) => r.input?.provider === 'u7f-no-such-provider')
  const unkRan = logLines.filter((l) => l.includes('governed-inspect-query') && l.includes('u7f-no-such-provider'))
  const queryAsks = (ctl?.requests ?? []).filter((r) => r.toolName === 'team_cordis_inspect_query')
  add('u7f:refusal-zero-effect', unkRes.length === 1 && unkRes[0].text.includes('inspect-provider-unknown') && !unkRes[0].text.trim().startsWith('{')
    && unkRan.length === 0 && ctl !== null && queryAsks.length === posRes.length ? 'PASS' : 'FAIL', {
    refusalReadBack: unkRes.map((r) => ({ isError: r.isError, text: r.text.slice(0, 400) })),
    unknownProviderLogLines: unkRan.map((l) => l.slice(0, 200)),
    durableQueryAsks: queryAsks.length,
    positiveQueryCalls: posRes.length,
    law: 'the unknown-provider call raised NO durable Control row (asks for team_cordis_inspect_query == positive calls only) and NO dispatch line for that provider',
  })

  const listedPending = pendingListedOf(requests)
  const familyAsks = (ctl?.requests ?? []).filter((r) => FAMILY_TOOLS.includes(String(r.toolName)))
  const perAsk = familyAsks.map((a) => ({
    requestId: a.requestId,
    toolName: a.toolName,
    listedPending: listedPending.some((p) => p.requestId === a.requestId),
    humanResolveOk: asks.resolutions.some((r) => r.requestId === a.requestId && r.ok),
    decisions: (ctl?.decisions ?? []).filter((d) => d.requestId === a.requestId).map((d) => d.decision),
    consumptions: (ctl?.consumptions ?? []).filter((c) => c.requestId === a.requestId).length,
  }))
  const legOk = (p) => p.listedPending && p.humanResolveOk && p.decisions.length === 1 && p.decisions[0] === 'allow' && p.consumptions === 1
  add('u7f:approval-leg', perAsk.length === 3 && perAsk.every(legOk)
    && FAMILY_TOOLS.every((t) => perAsk.filter((p) => p.toolName === t).length === 1) ? 'PASS' : 'FAIL', {
    perAsk,
    law: 'each durable PA ask: pending in a leader team_list_pending_control listing (real shape) -> human public seam team.resolveControl v4 allow ok -> exactly ONE decision row and exactly ONE control-allow-consumed fact',
  })

  const secretGone = !corpus.includes(assembly.files.secret.claim) && !log.includes(assembly.files.secret.claim)
  const secretBytes = (() => { try { return readFileSync(assembly.SECRET_FILE, 'utf8') } catch { return null } })()
  add('u7f:leak-check', secretGone && secretBytes === planted.secretBefore ? 'PASS' : 'FAIL', {
    secretClaimInCorpus: corpus.includes(assembly.files.secret.claim),
    secretClaimInHostLog: log.includes(assembly.files.secret.claim),
    secretBytesUnchanged: secretBytes === planted.secretBefore,
  })
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('[u7insp-c2] FATAL', error)
  process.exit(1)
})
