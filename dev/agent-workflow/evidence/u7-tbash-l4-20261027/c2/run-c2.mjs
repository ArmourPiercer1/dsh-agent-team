/**
 * dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs — the U7
 * `team_bash` L4 round: ONE live Host boot per execution, each boot DECLARED
 * in `boot-budget.jsonl` before it starts (budget 3; a 4th is refused).
 *
 * World/brain/resolver/judge = tests/world-factory/lib/u7-tbash-assembly.mjs
 * (C1-pinned by tests/world-factory/u7-tbash.test.mjs). This runner is the
 * HUMAN on the public seam only: remote `team.getLedgerPage` (read) and
 * remote `team.resolveControl` v4 (decide) on the create-ECHOED governed
 * session id — identity-asserted, never the boot root (r5 cause).
 *
 * Effects are read from DISK (the team root files), tool results are joined
 * to their calls by tool_use_id, decisions/consumptions from the durable
 * ledger. Verdicts: the shared `judgeTbash`; `tbash:mounted` is boot-time.
 *
 * Run:  node dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/run-c2.mjs
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { TestWorldFactory, apiPrompt, authenticate, fetchJson } from '../../../../../tests/world-factory/lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf, MANAGED_TOOL_NAMES, SAFE_UNMANAGED_TOOL_NAMES } from '../../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { createRunRecord, readAuthorityBinding } from '../../../../../tests/world-factory/lib/run-record.mjs'
import { testUseTree } from '../../../../../tests/paths.mjs'
import {
  TBASH_CASES, createTbashAssembly, makeTbashDecide, askerScript, decideResolution,
  callResultsOf, judgeTbash, commandHashOf, extractGovernedSessionId,
} from '../../../../../tests/world-factory/lib/u7-tbash-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BUDGET = 3
const BUDGET_PATH = join(HERE, 'boot-budget.jsonl')
const notes = []
const git = (args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim()
const run = createRunRecord({
  runId: `u7tb-c2-${Date.now().toString(36)}`,
  suite: 'u7-team-bash-l4',
  selectedCases: [...TBASH_CASES],
  bindings: {
    teamSha: git(['rev-parse', 'HEAD']),
    teamTreeClean: git(['status', '--porcelain', '--', 'packages', 'tests', 'scripts']) === '',
    hostSha: 'set-from-assertHostBase-in-main',
    authority: readAuthorityBinding(REPO),
  },
})
const add = (id, verdict, detail) => {
  run.addCase(id, verdict, { detail })
  console.log(`[u7tb-c2] case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 400)}`)
}
async function fetchJsonRetry(url, opts, timeoutMs) {
  try { return await fetchJson(url, opts, timeoutMs) } catch (e) { return { status: 0, body: null, error: String(e?.message ?? e) } }
}
/** The stable instance is only LOOKED at (GET, no token): status before == after. */
async function stableStatus() {
  try {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), 5000)
    const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: ctl.signal })
    clearTimeout(t)
    return r.status
  } catch (e) { return `unreachable:${String(e?.name ?? e)}` }
}
function declareBoot(world) {
  const prior = existsSync(BUDGET_PATH) ? readFileSync(BUDGET_PATH, 'utf8').split('\n').filter((l) => l.trim() !== '') : []
  const n = prior.length + 1
  if (n > BUDGET) throw new Error(`boot budget exhausted: ${String(prior.length)}/${String(BUDGET)} declared in ${BUDGET_PATH}`)
  const entry = { boot: n, budget: BUDGET, declaredAt: new Date().toISOString(), runId: run.record.runId, world: world.id, teamSha: run.record.bindings.teamSha }
  appendFileSync(BUDGET_PATH, JSON.stringify(entry) + '\n')
  return entry
}
const redact = (t) => String(t).replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1<redacted>')

async function main() {
  const stableBefore = await stableStatus()
  const factory = new TestWorldFactory({
    repoRoot: REPO,
    evidenceRoot: join(REPO, '.artifacts', 'tmp', 'u7-tbash-c2-world'),
    hostTree: testUseTree(REPO),
  })
  const hostBase = factory.assertHostBase('c2-check')
  run.record.bindings.hostSha = hostBase.head
  const world = await factory.createWorld({ line: 'u7tb' })
  const assembly = createTbashAssembly({ repoRoot: REPO, home: world.home, runStamp: world.id, reportDir: world.logDir })
  const planted = assembly.writePreBootFiles()
  const kind = {
    option: 'u7tbRows', probe: null, paths: {}, ledgerRows: {}, envKeys: [], env: () => ({}),
    patchHeader: [
      'U7 team_bash L4 World (evidence script, no shared kind registration):',
      'production Team row with the governed confined shell plane, p6t6',
      'observer and the base preset declaration.',
    ],
  }
  world.kinds = [kind]
  world.activeKind = kind
  world.u7tbRows = { rows: assembly.teamRows() }
  const decide = makeTbashDecide({ assembly })
  await world.startMock({ decide })
  const declared = declareBoot(world)
  run.record.bootDeclaration = declared
  console.log(`[u7tb-c2] boot ${String(declared.boot)}/${String(BUDGET)} declared; starting (world ${world.id})`)
  const t0 = Date.now()
  let boot = null
  try {
    boot = await world.startHost({ bootTimeoutMs: 150_000 })
  } catch (error) {
    add('tbash:mounted', 'START_FAILED', { reason: `host start failed: ${String(error?.message ?? error).slice(0, 300)}` })
  }
  const tag = `boot${String(declared.boot)}`
  if (boot !== null) {
    run.logHostStart({ phase: 'u7tb-c2-boot', boot: declared.boot, world: world.id, port: boot.port, bootMs: Date.now() - t0 })
    try { await drive({ world, assembly, planted, boot, decide }) } catch (e) { notes.push(`drive threw: ${String(e?.stack ?? e).slice(0, 600)}`) }
    try { writeFileSync(join(HERE, `host-${tag}.log`), redact(readFileSync(boot.logPath, 'utf8'))) } catch { notes.push('host log copy failed') }
  }
  try {
    const reqs = world.mock?.requests ?? []
    const raw = JSON.stringify(reqs.map((r) => ({ seq: r.seq, path: r.path, status: r.status, body: r.body ?? null, reply: r.reply ?? null })))
    // Declared EXCERPT: the LAST asker-lane request (its full transcript =
    // all four calls + results) and the LAST leader request; raw is hashed.
    const isAsker = (r) => JSON.stringify(r?.body?.messages ?? []).includes(`[team-work requestToken=${assembly.tokens('d1')}`)
    const lastAsker = [...reqs].reverse().find(isAsker) ?? null
    const lastLeader = [...reqs].reverse().find((r) => !isAsker(r) && JSON.stringify(r?.body?.messages ?? []).includes(assembly.markers.MK_L1)) ?? null
    const pick = (r) => (r === null ? null : { seq: r.seq, messages: r.body?.messages ?? null, reply: r.reply ?? null })
    writeFileSync(join(HERE, `mock-excerpt-${tag}.json`), JSON.stringify({
      note: 'Declared EXCERPT (last asker-lane request + last leader request, byte-identical message arrays); the raw capture is not committed.',
      rawSha256: createHash('sha256').update(raw).digest('hex'), rawRequests: reqs.length,
      asker: pick(lastAsker), leader: pick(lastLeader),
    }, null, 1))
  } catch (e) { notes.push(`mock excerpt failed: ${String(e?.message ?? e)}`) }
  try { await world.stopHost() } catch { /* receipts below */ }
  const receipts = await world.teardown({ keepHome: false }).catch((e) => ({ error: String(e?.message ?? e) }))
  const stableAfter = await stableStatus()
  const hostAfter = factory.assertHostBase('c2-check-after')
  Object.assign(run.record, {
    notes,
    stableInstance: { port: 3080, statusBefore: stableBefore, statusAfter: stableAfter, unchanged: stableBefore === stableAfter, touched: false },
    hostTreeAfter: { head: hostAfter.head },
    teardown: { receipts: receipts ?? null, homeRemoved: !existsSync(world.home) },
    evidence: [`host-${tag}.log`, `mock-excerpt-${tag}.json`].map((f) => `dev/agent-workflow/evidence/u7-tbash-l4-20261027/c2/${f}`).filter((p) => existsSync(join(REPO, p))),
    mockDigest: world.mock === null ? [] : world.mockRequestDigest().slice(-60),
  })
  run.finalize()
  const out = join(HERE, `c2-verdicts-${tag}.json`)
  run.write(out)
  console.log(`[u7tb-c2] record written to ${out} (u5-run-record/1, finalized before write); :3080 ${String(stableBefore)} -> ${String(stableAfter)}`)
  const fails = run.record.cases.filter((v) => v.verdict !== 'PASS').length
  console.log(`[u7tb-c2] DONE overall=${run.record.overall} pass=${String(run.record.cases.length - fails)} nonpass=${String(fails)}`)
}

async function drive({ world, assembly, planted, boot, decide }) {
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
  const failRest = (why) => {
    for (const id of TBASH_CASES) if (!run.record.cases.some((c) => c.id === id)) add(id, 'FAIL', { reason: why })
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
    return st.status === 200 && stateBody?.rootSessionId === assembly.ROOT && stateBody?.teamSession !== null
  }, 90_000) : { hit: false }
  if (!healthW.hit || health?.body?.ok !== true || !stateW.hit) {
    failRest(`readiness failed: health=${JSON.stringify(health?.body ?? null).slice(0, 300)} state=${JSON.stringify(stateBody ?? null).slice(0, 200)}`)
    return
  }
  const cookie = await authenticate(origin, world.token)
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7tb-c2')
  if (discPrompt.status !== 200) { failRest(`discovery prompt rejected: ${String(discPrompt.status)}`); return }
  const discW = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC) && surfaceNamesOf(r).length > 0), 150_000)
  if (!discW.hit) { failRest('discovery model request absent (deny list cannot be computed)'); return }
  await sleep(1500)
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  const surface = [...new Set(disc)].sort()
  const denyList = surface.filter((n) => !n.startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
  assembly.writeMainBlueprint(denyList)
  const hostLog = () => { try { return readFileSync(boot.logPath, 'utf8') } catch { return '' } }
  const created = await remoteCall(fetchJsonRetry, origin, cookie, 'team.create', {
    rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 },
  })
  const unwrap = (body) => {
    const v = body?.result?.value
    return v && typeof v === 'object' && 'data' in v ? v.data : v
  }
  const createOk = created.status === 200 && created.body?.result?.ok === true
  const createValue = unwrap(created.body)
  const identity = extractGovernedSessionId(createValue, { expectedRoot: assembly.CREATE_ROOT, bootRoot: assembly.ROOT })
  const teamSessionId = identity.teamSessionId ?? null
  const identityOk = createOk && identity.ok
  let independent = null
  if (teamSessionId !== null) {
    const projection = await remoteCall(fetchJsonRetry, origin, cookie, 'team.getProjection', { teamSessionId }, 'u7tb-independent', 1)
    const pv = unwrap(projection.body)
    independent = pv?.rootSessionId ?? pv?.teamSessionId ?? pv?.projection?.rootSessionId ?? null
  }
  const independentOk = independent === teamSessionId && teamSessionId !== null
  run.record.governedSession = { ...identity, teamSessionId, bootRoot: assembly.ROOT, identityOk: identityOk && independentOk, fromIndependentRead: independent, ledgerForeignEntries: 0, bindings: { rowToModelCall: [], modelCallToSession: [] } }
  if (!createOk || !run.record.governedSession.identityOk) {
    add('tbash:mounted', 'FAIL', { createOk, identityOk, createBody: JSON.stringify(created.body ?? null).slice(0, 800) })
    failRest('team.create failed or governed identity mismatch')
    return
  }

  // ── the human on the public seam ─────────────────────────────────────────
  const ledgerControl = async () => {
    const byType = { 'control-request-recorded': [], 'control-decision-recorded': [], 'control-allow-consumed': [], 'control-request-abandoned': [] }
    let afterSequence = 0
    for (let pageNo = 0; pageNo < 20; pageNo += 1) {
      const page = await remoteCall(fetchJsonRetry, origin, cookie, 'team.getLedgerPage', { teamSessionId, afterSequence, limit: 500 }, 'u7tb-ledger', 1)
      const r = page?.body?.result
      if (page?.status !== 200 || r?.ok !== true) throw new Error(`team.getLedgerPage failed: status=${String(page?.status)} ${JSON.stringify(r ?? null).slice(0, 160)}`)
      const data = unwrap(page.body)
      const entries = Array.isArray(data?.entries) ? data.entries : []
      for (const e of entries) {
        if (e?.rootSessionId !== teamSessionId) {
          run.record.governedSession.ledgerForeignEntries += 1
          continue
        }
        if (byType[e?.factType] === undefined) continue
        let payload = e.payload
        if (typeof payload === 'string') { try { payload = JSON.parse(payload) } catch { payload = {} } }
        byType[e.factType].push({ sequence: e.sequence ?? null, payload: payload ?? {} })
      }
      const next = data?.nextAfterSequence
      if (next === null || next === undefined || entries.length === 0) break
      afterSequence = Number(next)
    }
    const settled = new Set([...byType['control-decision-recorded'], ...byType['control-allow-consumed'], ...byType['control-request-abandoned']].map((f) => String(f.payload?.requestId ?? '')))
    return {
      requests: byType['control-request-recorded'].map((f) => {
        const p = f.payload ?? {}
        const raw = JSON.stringify(p)
        return {
          requestId: String(p.requestId ?? ''), rootSessionId: e.rootSessionId ?? null, toolName: p.toolName ?? null, kind: p.kind ?? null,
          targetInstanceId: p.targetInstanceId ?? null, summary: String(p.summary ?? '').slice(0, 200),
          operationFingerprint: p.operationFingerprint ?? null,
          parametersFingerprint: p.reviewPayload?.parametersFingerprint ?? null,
          carriesPinnedCommandHash: raw.includes(commandHashOf(askerScript(assembly)[0].command).slice('sha256:'.length)),
          status: settled.has(String(p.requestId ?? '')) ? 'settled' : 'pending',
        }
      }),
      decisions: byType['control-decision-recorded'].map((f) => ({ requestId: String(f.payload?.requestId ?? ''), decision: f.payload?.decision ?? null })),
      consumptions: byType['control-allow-consumed'].map((f) => ({ requestId: String(f.payload?.requestId ?? '') })),
      abandoned: byType['control-request-abandoned'].map((f) => ({ requestId: String(f.payload?.requestId ?? '') })),
    }
  }
  const pinnedCommandHash = commandHashOf(askerScript(assembly)[0].command)
  const resolutions = []
  const approverErrors = []
  const effectAtPending = []
  let approverStop = false
  const approver = (async () => {
    for (;;) {
      if (approverStop) return
      try {
        const ctl = await ledgerControl()
        for (const row of ctl.requests) {
          if (row.status !== 'pending' || resolutions.some((r) => r.requestId === row.requestId)) continue
          // attribution: the LATEST issued asker step not yet tied to a row
          const issued = decide.__state().issued
          const taken = new Set(resolutions.map((r) => r.step))
          const outstanding = [...issued].reverse().find((x) => !taken.has(x.step)) ?? null
          const allowsGiven = resolutions.filter((r) => r.decision === 'allow').length
          const verdict = decideResolution({ row, outstanding, pinnedCommandHash, allowsGiven, governedSessionId: teamSessionId })
          // zero-effect-while-pending witness (the grant never carried over)
          effectAtPending.push({ requestId: row.requestId, step: outstanding?.step ?? null, effects: { appr: assembly.readEffect('appr'), other: assembly.readEffect('other'), deny: assembly.readEffect('deny') } })
          const res = await remoteCall(fetchJsonRetry, origin, cookie, 'team.resolveControl',
            { teamSessionId, requestId: row.requestId, decision: verdict.decision, note: `u7tb-human-${verdict.decision}` }, 'u7tb-resolve', 4)
          const ok = res?.status === 200 && res?.body?.result?.ok === true
          resolutions.push({
            requestId: row.requestId, step: outstanding?.step ?? null, tag: outstanding?.tag ?? null,
            commandHash: outstanding === null ? null : commandHashOf(outstanding.command),
            decision: verdict.decision, reason: verdict.reason, ok, kind: row.kind, summary: row.summary,
            parametersFingerprint: row.parametersFingerprint, carriesPinnedCommandHash: row.carriesPinnedCommandHash,
            body: ok ? 'ok' : JSON.stringify(res?.body ?? null).slice(0, 300),
          })
          console.log(`[u7tb-c2] human ${verdict.decision} ${row.requestId} step=${String(outstanding?.step)} ok=${String(ok)} (${verdict.reason})`)
        }
      } catch (err) { if (approverErrors.length < 20) approverErrors.push(String(err?.message ?? err).slice(0, 200)) }
      await sleep(500)
    }
  })()
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const wake = async (t) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7TB_PHASE_${t}`, 'u7tb-c2-wake').catch(() => null)
    if (pr !== null && pr.status !== 200) notes.push(`wake ${t} rejected status=${String(pr.status)}`)
  }
  const wakeCadence = async (content, deadlineMs, t, maxWakes) => {
    const t0w = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(content)) return true
      if (Date.now() - t0w > deadlineMs) return replySeen(content)
      if (Date.now() - lastWake > 6000 && wakes < maxWakes) { wakes += 1; lastWake = Date.now(); await wake(t) }
      await sleep(350)
    }
  }
  const askerDone = await wakeCadence(assembly.DONE.asker, 420_000, 'a', 60)
  const leaderDone = await wakeCadence(assembly.DONE.leader, 120_000, 'z', 15)
  approverStop = true
  try { await approver } catch { /* loop exits on the flag */ }
  notes.push(`lanes: asker=${String(askerDone)} leader=${String(leaderDone)}`)

  // seam replay: re-allow the SPENT approved row — must be refused
  const ridA = resolutions.find((r) => r.step === 0 && r.decision === 'allow')?.requestId ?? null
  let seamReAllow = null
  if (ridA !== null) {
    const res = await remoteCall(fetchJsonRetry, origin, cookie, 'team.resolveControl', { teamSessionId, requestId: ridA, decision: 'allow', note: 'u7tb-seam-replay' }, 'u7tb-replay', 4)
    seamReAllow = { requestId: ridA, ok: res?.status === 200 && res?.body?.result?.ok === true, body: JSON.stringify(res?.body ?? null).slice(0, 300) }
  }
  await sleep(1500)
  let ctl = null
  try { ctl = await ledgerControl() } catch (e) { notes.push(`final ledger read failed: ${String(e?.message ?? e)}`) }

  // ── evidence ──────────────────────────────────────────────────────────────
  const requests = world.mock?.requests ?? []
  const results = callResultsOf(requests).filter((r) => r.name === 'team_bash')
  const script = askerScript(assembly)
  // call k = the k-th team_bash tool_use of the asker, joined by id
  const askerUses = []
  for (const rec of requests) {
    if (!JSON.stringify(rec?.body?.messages ?? []).includes(`[team-work requestToken=${assembly.tokens('d1')}`)) continue
    for (const m of rec?.body?.messages ?? []) {
      for (const b of Array.isArray(m?.content) ? m.content : []) {
        if (b?.type === 'tool_use' && b.name === 'team_bash' && !askerUses.some((u) => u.id === b.id)) askerUses.push({ id: b.id, command: b.input?.command ?? null })
      }
    }
  }
  const calls = script.map((s, k) => {
    const use = askerUses[k] ?? null
    const res = use === null ? null : results.find((r) => r.id === use.id) ?? null
    return { step: s.step, tag: s.tag, command: use?.command ?? null, scriptCommand: s.command, toolUseId: use?.id ?? null, result: res === null ? null : { isError: res.isError, text: res.text.slice(0, 600) } }
  })
  const corpus = JSON.stringify(requests.map((r) => r.body ?? {}))
  const log = hostLog()
  const secretBytes = (() => { try { return readFileSync(assembly.SECRET_FILE, 'utf8') } catch { return null } })()
  const placement = log.split('\n').filter((l) => l.includes('placement-feed rows='))
  const forensic = log.split('\n').filter((l) => /a5-pa-bridge|production-admission|a5p5-refused|confined-shell/i.test(l)).slice(-40).map((l) => redact(l).slice(0, 300))
  const digest = {
    pinned: { commandHash: pinnedCommandHash, claims: assembly.claims, ranEcho: assembly.ranEcho },
    calls,
    resolutions,
    effectAtPending,
    ledger: ctl,
    seamReAllow,
    effects: { appr: assembly.readEffect('appr'), other: assembly.readEffect('other'), deny: assembly.readEffect('deny') },
    leak: { inCorpus: corpus.includes(assembly.claims.secret), inHostLog: log.includes(assembly.claims.secret), bytesUnchanged: secretBytes === planted.secretBefore },
    lanes: { askerDone, leaderDone },
    brain: decide.__state(),
    approverErrors,
    hostForensic: forensic,
    notifTurns: requests.filter((r) => JSON.stringify(r?.body?.messages ?? []).includes('[team-control requestId=')).length,
  }
  run.record.tbashDigest = digest
  const hostAlive = world.instance?.child !== null && world.instance?.child !== undefined && world.instance.child.exitCode === null
  add('tbash:mounted', placement.length > 0 && (placement.at(-1) ?? '').includes('team_bash') && hostAlive ? 'PASS' : 'FAIL', {
    healthOk: true, stateOk: true, createOk, governedSession: teamSessionId,
    placementFeed: placement.length > 0 ? redact(placement.at(-1)).slice(0, 300) : null,
    launcherPin: assembly.launcherSha(),
  })
  for (const [id, verdict, detail] of judgeTbash(digest, hostAlive)) add(id, verdict, detail)
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('[u7tb-c2] FATAL', error)
  process.exit(1)
})
