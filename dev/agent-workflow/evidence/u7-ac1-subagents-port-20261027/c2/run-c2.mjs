/**
 * dev/agent-workflow/evidence/u7-ac1-subagents-port-20261027/c2/run-c2.mjs —
 * the AC-1 C2 run: ONE live Host boot per execution, each boot DECLARED in
 * `boot-budget.jsonl` BEFORE it starts (original budget 3, extended to 6 by
 * the main-agent ruling; the runner refuses a 7th).
 * Pattern: dev/agent-workflow/evidence/u7-inspect-c2-20261027/c2/run-c2.mjs
 * (human approvals over the PUBLIC remote seam: team.getLedgerPage +
 * team.resolveControl v4). The drive script is committed clean before the
 * boot; `bindings.driveScriptClean` records it. Boot 7 was voided before
 * any drive effect due to a runner TDZ defect; exactly one boot 8 is granted.
 *
 * Cases (u5-run-record/1, evidence-first; a missing witness is FAIL):
 *   ac:mounted          create ok; the host placement feed carries the seven
 *                       family rows; zero plane mount/placement refusals
 *   ac:list-models      list_subagent_models RAN after a human ALLOW; the
 *                       llm provider list is read back from the tool_result
 *   ac:list-agents      list_agents RAN after a human ALLOW over
 *                       subagents.listChildren; the catalog read back carries
 *                       the one-shot spawn child (catalogSize ≥ 1)
 *   ac:spawn-positive   subagent RAN after a human ALLOW through
 *                       subagents.start('spawn'); the child's final text is
 *                       read back in the pilot's tool_result
 *   ac:child-toolview   every spawn/fork CHILD model request carried ZERO tool
 *                       definitions; the spawn child's attempted `read` got
 *                       an error tool_result; the port's own child-toolview
 *                       lines read tools=[] (Q1)
 *   ac:fork-positive    subagent_fork RAN after a human ALLOW through
 *                       subagents.start('fork'); the fork child's request
 *                       carried the turn-1 token; its answer is read back
 *   ac:refusal-tools    subagent {tools:[…]} → typed schema refusal, zero ask
 *   ac:refusal-provider subagent {provider:…} → typed Tier A amplification
 *                       refusal, zero ask
 *   ac:refusal-fork-bg  subagent_fork {run_in_background:true} → typed
 *                       amplification refusal, zero ask
 *   ac:mounted         also fails closed if the reserved run_code transport
 *                       is discovered on the native surface
 *   ac:leak-check       the outside secret is in no transcript and no host
 *                       log, its bytes unchanged; :3080 status unchanged;
 *                       exactly TWO child starts happened (spawn + fork)
 *
 * Run:  node dev/agent-workflow/evidence/u7-ac1-subagents-port-20261027/c2/run-c2.mjs
 */
import { appendFileSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { TestWorldFactory, apiPrompt, authenticate, fetchJson } from '../../../../../tests/world-factory/lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, messagesOf } from '../../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { createRunRecord, readAuthorityBinding } from '../../../../../tests/world-factory/lib/run-record.mjs'
import { testUseTree } from '../../../../../tests/paths.mjs'
import { AC1_TOOLS, AGENT_CONTROL_MANAGED_NAMES, createAc1Assembly, makeAc1Decide, userTexts, assertAc1NativeSurface, computeAc1BuiltinToolDeny } from './ac1-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..', '..')
const REL = relative(REPO, HERE)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ORIGINAL_BUDGET = 3
const BUDGET = 8 // boot 7 voided; exactly one final boot 8; no boot 9
const BUDGET_PATH = join(HERE, 'boot-budget.jsonl')
const SELECTED = ['ac:mounted', 'ac:list-models', 'ac:list-agents', 'ac:spawn-positive', 'ac:child-toolview', 'ac:fork-positive',
  'ac:refusal-tools', 'ac:refusal-provider', 'ac:refusal-fork-bg', 'ac:leak-check']
const notes = []
const git = (args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim()
const run = createRunRecord({
  runId: `u7ac1-c2-${Date.now().toString(36)}`,
  suite: 'u7-ac1-agent-control-subagents-c2',
  selectedCases: SELECTED,
  bindings: {
    teamSha: git(['rev-parse', 'HEAD']),
    teamTreeClean: git(['status', '--porcelain', '--', 'packages', 'tests/world-factory', 'tests/paths.mjs', 'scripts']) === '',
    driveScriptClean: git(['status', '--porcelain', '--', join(REL, 'run-c2.mjs'), join(REL, 'ac1-assembly.mjs')]) === '',
    hostSha: 'set-from-assertHostBase-in-main',
    authority: readAuthorityBinding(REPO),
  },
})
const add = (id, verdict, detail) => {
  run.addCase(id, verdict, { detail })
  console.log(`[u7ac1-c2] case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 400)}`)
}
async function fetchJsonRetry(url, opts, timeoutMs) {
  try { return await fetchJson(url, opts, timeoutMs) } catch (e) { return { status: 0, body: null, error: String(e?.message ?? e) } }
}
async function stableProbe() {
  try {
    const res = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) })
    return { status: res.status }
  } catch (e) { return { status: 0, error: String(e?.message ?? e).slice(0, 80) } }
}

function declareBoot(world) {
  const prior = existsSync(BUDGET_PATH) ? readFileSync(BUDGET_PATH, 'utf8').split('\n').filter((l) => l.trim() !== '') : []
  const n = prior.length + 1
  if (n > BUDGET) throw new Error(`boot budget exhausted: ${String(prior.length)}/${String(BUDGET)} declared in ${BUDGET_PATH}`)
  const entry = { boot: n, budget: BUDGET, declaredAt: new Date().toISOString(), runId: run.record.runId, world: world.id, teamSha: run.record.bindings.teamSha, driveScriptClean: run.record.bindings.driveScriptClean }
  appendFileSync(BUDGET_PATH, JSON.stringify(entry) + '\n')
  return entry
}

async function main() {
  if (!run.record.bindings.driveScriptClean || !run.record.bindings.teamTreeClean) {
    throw new Error('refusing to boot: the drive script or the product tree is not committed clean')
  }
  const stableBefore = await stableProbe()
  const factory = new TestWorldFactory({
    repoRoot: REPO,
    evidenceRoot: join(REPO, '.artifacts', 'tmp', 'u7-ac1-c2-world'),
    hostTree: testUseTree(REPO),
  })
  const hostBase = factory.assertHostBase('c2-check')
  run.record.bindings.hostSha = hostBase.head
  const world = await factory.createWorld({ line: 'u7ac1' })
  const assembly = createAc1Assembly({ repoRoot: REPO, home: world.home, runStamp: world.id, reportDir: world.logDir })
  const planted = assembly.writePreBootFiles()
  const kind = {
    option: 'u7fRows', probe: null, paths: {}, ledgerRows: {}, envKeys: [], env: () => ({}),
    patchHeader: [
      'U7 AC-1 C2 World (evidence script, no shared kind registration): the',
      'production Team row with the AGENT-CONTROL family ON (no injected port,',
      'no injected caller authority), p6t6 observer and two preset declarations.',
    ],
  }
  world.kinds = [kind]
  world.activeKind = kind
  world.u7fRows = { rows: assembly.teamRows() }
  await world.startMock({ decide: makeAc1Decide({ assembly }) })
  const declared = declareBoot(world)
  run.record.bootDeclaration = declared
  console.log(`[u7ac1-c2] boot ${String(declared.boot)}/${String(BUDGET)} declared; starting (world ${world.id})`)
  const t0 = Date.now()
  let boot = null
  try {
    boot = await world.startHost({ bootTimeoutMs: 150_000 })
  } catch (error) {
    add('ac:mounted', 'START_FAILED', { reason: `host start failed: ${String(error?.message ?? error).slice(0, 300)}` })
  }
  if (boot !== null) {
    run.logHostStart({ phase: 'u7ac1-c2-boot', boot: declared.boot, world: world.id, port: boot.port, bootMs: Date.now() - t0 })
    try { await drive({ world, assembly, planted, boot, stableBefore }) } catch (e) { notes.push(`drive threw: ${String(e?.stack ?? e).slice(0, 600)}`) }
  }
  const tag = `boot${String(declared.boot)}`
  if (boot !== null) {
    try { copyFileSync(boot.logPath, join(HERE, `host-${tag}.log`)) } catch { notes.push('host log copy failed') }
  }
  try {
    // Declared EXCERPT: the child + pilot requests (the witnesses), capped.
    const reqs = (world.mock?.requests ?? []).map((r) => ({ seq: r.seq, path: r.path, status: r.status, body: r.body ?? null, reply: r.reply ?? null }))
    const raw = JSON.stringify(reqs)
    const isWitness = (r) => {
      const ut = userTexts(r).join('\n')
      return ut.includes(assembly.markers.CHILD_SPAWN) || ut.includes(assembly.markers.CHILD_FORK)
    }
    const kept = reqs.filter(isWitness)
    const lastPilot = [...reqs].reverse().find((r) => userTexts(r).some((t) => t.includes(`requestToken=${assembly.tokens('d2')}`)))
    const lastLeader = reqs.at(-1)
    const excerpt = {
      note: `Declared EXCERPT of the ${tag} mock corpus: every CHILD request (spawn/fork), the last pilot turn-2 request (full pilot chain) and the final request. Kept entries are byte-identical to the capture; the raw capture is not committed (evidence guard).`,
      rawSha256: createHash('sha256').update(raw).digest('hex'),
      rawEntries: reqs.length,
      entries: [...kept, ...(lastPilot ? [lastPilot] : []), ...(lastLeader ? [lastLeader] : [])],
    }
    writeFileSync(join(HERE, `mock-corpus-${tag}.json`), JSON.stringify(excerpt, null, 1))
  } catch (e) { notes.push(`mock corpus dump failed: ${String(e?.message ?? e)}`) }
  try { await world.stopHost() } catch { /* receipts below */ }
  const receipts = await world.teardown({ keepHome: false }).catch((e) => ({ error: String(e?.message ?? e) }))
  let hostAfter = null
  try { hostAfter = factory.assertHostBase('c2-after') } catch (e) { notes.push(`host base after: ${String(e?.message ?? e)}`) }
  Object.assign(run.record, {
    notes,
    hostBaseAfter: hostAfter,
    teardown: { receipts: receipts ?? null },
    evidence: [`${REL}/host-${tag}.log`, `${REL}/mock-corpus-${tag}.json`].filter((p) => existsSync(join(REPO, p))),
    mockDigest: world.mock === null ? [] : world.mockRequestDigest().slice(-60),
  })
  run.finalize()
  const out = join(HERE, `c2-verdicts-${tag}.json`)
  run.write(out)
  console.log(`[u7ac1-c2] record written to ${out} (u5-run-record/1, finalized before write)`)
  const fails = run.record.cases.filter((v) => v.verdict !== 'PASS').length
  console.log(`[u7ac1-c2] DONE overall=${run.record.overall} pass=${String(run.record.cases.length - fails)} nonpass=${String(fails)}`)
}

export const LIVE_IO = Object.freeze({ fetchJsonRetry, authenticate, apiPrompt, sleep, stableProbe, readFile: readFileSync })

/** Resolve the drive's live defaults without shadowing any injected binding. */
export function resolveDriveIo(overrides = {}, liveDefaults = LIVE_IO) {
  return { ...liveDefaults, ...overrides }
}

/**
 * Judge a positive fork read-back by the first non-error result carrying the
 * expected token. Earlier error results can be pre-flight noise from another
 * model prompt in the same world and must not mask a later positive effect.
 */
export function judgeForkPositive(readBack, expectedToken) {
  return readBack.find((result) => !result?.isError && String(result?.text ?? '').includes(expectedToken)) ?? null
}

export async function drive({ world, assembly, planted, boot, stableBefore, io = {}, liveDefaults = LIVE_IO }) {
  const resolvedIo = resolveDriveIo(io, liveDefaults)
  const fetchJsonRetry = resolvedIo.fetchJsonRetry
  const authenticate = resolvedIo.authenticate
  const apiPrompt = resolvedIo.apiPrompt
  const sleep = resolvedIo.sleep
  const stableProbe = resolvedIo.stableProbe
  const readFileSync = resolvedIo.readFile
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
    add('ac:mounted', 'FAIL', { reason: `health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 400)}` })
    return
  }
  if (!stateW.hit) {
    add('ac:mounted', 'FAIL', { reason: `anchored Team Session never appeared: ${JSON.stringify(stateBody ?? null).slice(0, 300)}` })
    return
  }
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7ac1-c2')
  if (discPrompt.status !== 200) {
    add('ac:mounted', 'FAIL', { reason: `discovery prompt rejected: ${String(discPrompt.status)}` })
    return
  }
  const discW = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC)), 120_000)
  if (!discW.hit) {
    add('ac:mounted', 'FAIL', { reason: 'discovery model request absent (deny list cannot be computed)' })
    return
  }
  await sleep(1500)
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  // The seven family names are claimed by the plane, while todo_write is the
  // The reserved PTC transport is not a valid native fixture surface.
  try { assertAc1NativeSurface(surface) } catch (error) {
    add('ac:mounted', 'FAIL', { reason: String(error?.message ?? error), surface })
    return
  }
  const denyList = computeAc1BuiltinToolDeny(surface)
  run.record.discoverySurface = surface
  assembly.writeMainBlueprint(denyList)
  const hostLog = () => { try { return readFileSync(boot.logPath, 'utf8') } catch { return '' } }
  const created = await remoteCall(fetchJsonRetry, origin, cookie, 'team.create', {
    rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 },
  })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  await sleep(3000)
  const placementLines = () => hostLog().split('\n').filter((l) => l.includes('placement-feed rows='))
  const planeRefusals = () => hostLog().split('\n').filter((l) => l.includes('a5-plane: mount-REFUSED') || l.includes('a5-plane: placement-REFUSED'))

  const unwrap = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const ledgerControl = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJsonRetry, origin, cookie, 'team.getLedgerPage',
        { teamSessionId: assembly.CREATE_ROOT, afterSequence, limit: 500 }, 'u7ac1-ledger', 1)
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
  const asks = { resolutions: [], errors: [] }
  let approverStop = false
  const approver = createOk ? (async () => {
    for (;;) {
      if (approverStop) return
      try {
        const ctl = await ledgerControl()
        for (const row of ctl.requests) {
          if (row.status !== 'pending' || !AC1_TOOLS.includes(String(row.toolName))) continue
          if (asks.resolutions.some((r) => r.requestId === row.requestId)) continue
          const res = await remoteCall(fetchJsonRetry, origin, cookie, 'team.resolveControl',
            { teamSessionId: assembly.CREATE_ROOT, requestId: row.requestId, decision: 'allow', note: 'u7ac1-c2-human-allow' }, 'u7ac1-approval', 4)
          const ok = res?.status === 200 && res?.body?.result?.ok === true
          asks.resolutions.push({ requestId: row.requestId, toolName: row.toolName, decision: 'allow', ok, status: res?.status ?? null, body: ok ? 'ok' : JSON.stringify(res?.body ?? null).slice(0, 300) })
          console.log(`[u7ac1-c2] human allow ${row.requestId} tool=${String(row.toolName)} ok=${String(ok)}`)
        }
      } catch (err) { if (asks.errors.length < 20) asks.errors.push(String(err?.message ?? err).slice(0, 160)) }
      await sleep(500)
    }
  })() : Promise.resolve()
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const wake = async (tg) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7AC1_PHASE_${tg}`, 'u7ac1-c2-wake').catch(() => null)
    if (pr !== null && pr.status !== 200) notes.push(`wake ${tg} rejected status=${String(pr.status)}`)
  }
  const wakeCadence = async (content, deadlineMs, tg, maxWakes) => {
    const t0w = Date.now()
    let lastWake = Date.now()
    let wakes = 0
    for (;;) {
      if (replySeen(content)) return true
      if (Date.now() - t0w > deadlineMs) return replySeen(content)
      if (Date.now() - lastWake > 8000 && wakes < maxWakes) { wakes += 1; lastWake = Date.now(); await wake(tg) }
      await sleep(350)
    }
  }
  let p1 = false; let p2 = false; let leaderDone = false
  if (createOk) {
    p1 = await wakeCadence(assembly.DONE.pilot1, 420_000, 'a', 50)
    p2 = await wakeCadence(assembly.DONE.pilot2, 300_000, 'b', 40)
    leaderDone = await wakeCadence(assembly.DONE.leader, 180_000, 'z', 20)
  }
  approverStop = true
  try { await approver } catch { /* loop exits on the flag */ }
  notes.push(`lanes: pilot1=${String(p1)} pilot2=${String(p2)} leader=${String(leaderDone)}`)
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
  const results = new Map()
  for (const rec of requests) {
    // A fork request includes a partial in-flight parent transcript. Do not
    // attribute inherited tool blocks (including the fork's unknown-tool probe)
    // to a second execution in the pilot lane.
    if (userTexts(rec).some((t) => t.includes(assembly.markers.CHILD_FORK))) continue
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
  const resultsOf = (name, pred = () => true) => [...results.values()].filter((r) => r.name === name && pred(r.input ?? {}))
  const allowedFor = (tool) => asks.resolutions.filter((r) => r.toolName === tool && r.ok)
  const asksFor = (tool) => (ctl?.requests ?? []).filter((r) => r.toolName === tool)
  const ranLines = (row) => logLines.filter((l) => l.includes(`agent-control-${row} RAN`))
  const toolviewLines = logLines.filter((l) => l.includes('agent-runtime host-port: child-toolview'))
  const heads = (rs) => rs.map((r) => ({ isError: r.isError, text: r.text.slice(0, 500) }))

  // ac:mounted
  const placement = placementLines()
  const placementHas = (n) => placement.some((l) => l.split('rows=[')[1]?.split(']')[0]?.split(',').includes(n))
  add('ac:mounted', createOk && AGENT_CONTROL_MANAGED_NAMES.every(placementHas) && planeRefusals().length === 0 ? 'PASS' : 'FAIL', {
    createOk,
    createBody: createOk ? 'ok' : JSON.stringify(created.body ?? null).slice(0, 800),
    placementFeed: placement.map((l) => l.slice(0, 300)),
    planeRefusals: planeRefusals().slice(0, 3).map((l) => l.slice(0, 200)),
  })
  if (!createOk) return

  // ac:list-models
  const lm = resultsOf('list_subagent_models')
  let providers = null
  for (const r of lm) { if (!r.isError && r.text.includes('"models"')) { try { providers = JSON.parse(r.text).models } catch { providers = r.text.includes('deepseek-official') ? ['<text>'] : null } } }
  add('ac:list-models', lm.length === 1 && !lm[0].isError && lm[0].text.includes('deepseek-official') && ranLines('list_subagent_models').length === 1 && allowedFor('list_subagent_models').length === 1 ? 'PASS' : 'FAIL', {
    readBack: heads(lm), providersParsed: providers, ranWitness: ranLines('list_subagent_models').map((l) => l.slice(0, 200)),
    humanAllow: allowedFor('list_subagent_models').map((r) => r.requestId),
  })

  // ac:spawn-positive
  const sp = resultsOf('subagent', (i) => i.description === 'ac1 spawn probe')
  add('ac:spawn-positive', sp.length === 1 && !sp[0].isError && sp[0].text.includes(assembly.DONE.childPong) && ranLines('subagent').length === 1 && allowedFor('subagent').length === 1 ? 'PASS' : 'FAIL', {
    readBack: heads(sp), ranWitness: ranLines('subagent').map((l) => l.slice(0, 200)),
    humanAllow: allowedFor('subagent').map((r) => r.requestId),
    toolviewLines: toolviewLines.map((l) => l.slice(0, 200)),
  })

  // ac:list-agents
  const la = resultsOf('list_agents')
  let catalogSize = null
  for (const line of logLines) { const m = /catalog-read count=(\d+)/.exec(line); if (m !== null) catalogSize = Number(m[1]) }
  add('ac:list-agents', la.length === 1 && !la[0].isError && catalogSize !== null && catalogSize >= 1 && ranLines('list_agents').length === 1 && allowedFor('list_agents').length === 1 ? 'PASS' : 'FAIL', {
    readBack: heads(la), catalogSize, ranWitness: ranLines('list_agents').map((l) => l.slice(0, 200)),
    humanAllow: allowedFor('list_agents').map((r) => r.requestId),
    note: 'the native projection lists continuable children only; the one-shot spawn child is witnessed through catalogSize/oneShotChildren from the same subagents.listChildren answer',
  })

  // ac:child-toolview
  const childReqs = (marker) => requests.filter((r) => userTexts(r).some((t) => t.includes(marker)))
  const spawnChild = childReqs(assembly.markers.CHILD_SPAWN)
  const forkChild = childReqs(assembly.markers.CHILD_FORK)
  const positiveSpawnRequestIds = new Set(spawnChild.map((r) => r.seq))
  const positiveForkRequestIds = new Set(forkChild.map((r) => r.seq))
  const toolsOf = (r) => surfaceNamesOf(r)
  const childAttempt = spawnChild.flatMap((r) => [...(r.body?.messages ?? [])].flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
    .filter((b) => b?.type === 'tool_result').map((b) => ({ isError: b.is_error === true, text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('').slice(0, 300) })))
  const allEmpty = [...spawnChild, ...forkChild].every((r) => toolsOf(r).length === 0)
  const portViews = toolviewLines.map((l) => /tools=\[([^\]]*)\]/.exec(l)?.[1] ?? '?')
  const unknownRead = childAttempt.filter((a) => a.isError && a.text.includes('unknown tool "read"'))
  add('ac:child-toolview', spawnChild.length === 2 && forkChild.length === 1 && allEmpty && unknownRead.length === 1
    && childAttempt.length === 1 && portViews.length === 2 && portViews.every((v) => v === '') ? 'PASS' : 'FAIL', {
    spawnChildRequests: spawnChild.length,
    forkChildRequests: forkChild.length,
    childToolSurfaces: [...spawnChild, ...forkChild].map(toolsOf),
    spawnChildAttemptedToolResults: childAttempt,
    unknownReadErrors: unknownRead.length,
    portToolviewLines: toolviewLines.map((l) => l.slice(0, 200)),
    q1: 'Tier A ceiling is an empty child tool view; the mock read probe must fail specifically as unknown tool',
  })

  // ac:fork-positive
  const fk = resultsOf('subagent_fork', (i) => i.description === 'ac1 fork probe')
  const forkPositive = judgeForkPositive(fk, assembly.DONE.forkSaw)
  const forkSawToken = forkChild.some((r) => JSON.stringify(r.body ?? {}).includes(assembly.markers.TOKEN))
  add('ac:fork-positive', forkPositive !== null && forkSawToken && ranLines('subagent_fork').length === 1 && allowedFor('subagent_fork').length === 1 ? 'PASS' : 'FAIL', {
    readBack: heads(fk), forkChildRequestCarriedToken: forkSawToken,
    ranWitness: ranLines('subagent_fork').map((l) => l.slice(0, 200)),
    humanAllow: allowedFor('subagent_fork').map((r) => r.requestId),
  })

  // refusals — each refused call independently requires typed text, zero child
  // starts/effect, and zero attributable Control asks. Positive-case asks do not
  // alter this invariant.
  const requestIdsInResult = (rs) => new Set(rs.flatMap((r) => [...String(r.text ?? '').matchAll(/requestId[=: ]+([A-Za-z0-9_-]+)/g)].map((m) => m[1])))
  const refusal = (id, rs, needles, tool) => {
    const resultRequestIds = requestIdsInResult(rs)
    const asksForCase = asksFor(tool).filter((ask) => resultRequestIds.has(ask.requestId))
    // No unattributed asks can hide behind missing requestId text: exactly
    // one durable request per positive tool, all consumed, no extra requests.
    const accounted = AC1_TOOLS.every((name) => asksFor(name).length === 1 && allowedFor(name).length === 1)
      && (ctl?.requests ?? []).length === 4 && (ctl?.consumptions ?? []).length === 4
    const ok = rs.length === 1 && rs[0].isError === true && needles.every((n) => rs[0].text.includes(n)) && asksForCase.length === 0 && accounted
    add(id, ok ? 'PASS' : 'FAIL', { readBack: heads(rs), expected: needles, durableAsksFor: { tool, attributedRequestIds: [...resultRequestIds], count: asksForCase.length, positivesExpected: 0 } })
  }
  refusal('ac:refusal-tools', resultsOf('subagent', (i) => Array.isArray(i.tools)), ['agent-control-schema-refused', "unknown field 'tools'"], 'subagent')
  refusal('ac:refusal-provider', resultsOf('subagent', (i) => i.provider !== undefined), ['agent-control-amplification-refused', "provider 'deepseek-official' is outside the caller's own authority"], 'subagent')
  refusal('ac:refusal-fork-bg', resultsOf('subagent_fork', (i) => i.run_in_background === true), ['agent-control-amplification-refused', 'continuable'], 'subagent_fork')

  // ac:leak-check
  const stableAfter = await stableProbe()
  const secretGone = !corpus.includes(assembly.SECRET_CLAIM) && !log.includes(assembly.SECRET_CLAIM)
  const secretBytes = (() => { try { return readFileSync(assembly.SECRET_FILE, 'utf8') } catch { return null } })()
  const startKinds = toolviewLines.map((l) => l.includes('provider=fork') ? 'fork' : l.includes('provider=spawn') ? 'spawn' : 'unknown')
  const positiveStarts = startKinds.filter((kind) => kind === 'spawn' || kind === 'fork')
  add('ac:leak-check', secretGone && secretBytes === planted.secretBefore && stableAfter.status === stableBefore.status
    && positiveStarts.filter((kind) => kind === 'spawn').length === 1 && positiveStarts.filter((kind) => kind === 'fork').length === 1
    && startKinds.every((kind) => kind === 'spawn' || kind === 'fork') ? 'PASS' : 'FAIL', {
    secretClaimInCorpus: corpus.includes(assembly.SECRET_CLAIM),
    secretClaimInHostLog: log.includes(assembly.SECRET_CLAIM),
    secretBytesUnchanged: secretBytes === planted.secretBefore,
    stable3080: { before: stableBefore, after: stableAfter },
    childStarts: toolviewLines.length,
    startsByProvider: { spawn: positiveStarts.filter((kind) => kind === 'spawn').length, fork: positiveStarts.filter((kind) => kind === 'fork').length },
    law: 'positive witnesses require exactly one spawn and one fork start; refusals are not starts',
  })
}

const isDirectExecution = process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
const dryRun = isDirectExecution && process.argv.includes('--dry-run')
const execute = dryRun ? async () => {
  if (!process.argv.includes('--fixtures')) throw Error('--dry-run requires --fixtures')
  const { fixtures } = await import('./dryrun-fixtures.mjs')
  await fixtures({ drive, run, here: HERE, repo: REPO, mode: process.argv.includes('--old-faces') ? 'old' : process.argv.includes('--mutation') ? 'mutation' : process.argv.includes('--no-overrides') ? 'no-overrides' : 'current' })
} : main
if (isDirectExecution) {
  execute().then(() => process.exit(0)).catch((error) => {
    console.error('[u7ac1-c2] FATAL', error)
    process.exit(1)
  })
}
