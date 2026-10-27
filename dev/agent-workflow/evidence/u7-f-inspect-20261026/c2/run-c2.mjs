/**
 * dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/run-c2.mjs — the
 * U7-F C2 round: ONE live Host boot (boot budget 3, this script spends 1 per
 * execution and records every start in c2-verdicts.json), driving the
 * governed inspect family through the PUBLIC world-factory machinery.
 *
 * It deliberately registers NO new world kind and edits NO shared registry:
 * the mount descriptor (patch header + caller rows) rides the library's own
 * public startHost contract, assembled right here beside its evidence.
 *
 * Legs (verdicts are evidence-first; a missing witness is FAIL, never prose):
 *   u7f:mounted              health + state + the alias surface + placement
 *   u7f:skill-load           live PA ask → leader resolve → governed skill
 *                            read of an authorized SKILL.md (claim bytes)
 *   u7f:inspect-list         governed inspect list through the live host's
 *                            own inspect-provider face
 *   u7f:refusal-zero-effect  unknown-provider query: typed refusal, ZERO
 *                            dispatch witness in the host log
 *   u7f:approval-leg         the leader's resolve leg ran (the ask chain)
 *   u7f:leak-check           the OUTSIDE-the-root secret claim appears in
 *                            no transcript and no host log; bytes unchanged
 *
 * Run:  node dev/agent-workflow/evidence/u7-f-inspect-20261026/c2/run-c2.mjs
 */
import { readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { TestWorldFactory, apiPrompt, authenticate, fetchJson } from '../../../../../tests/world-factory/lib/world-factory.mjs'
import { remoteCall, hasMarker, surfaceNamesOf } from '../../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { createRunRecord, readAuthorityBinding } from '../../../../../tests/world-factory/lib/run-record.mjs'
import { testUseTree } from '../../../../../tests/paths.mjs'
import { createU7fInspectAssembly, makeU7fInspectDecide } from './u7f-inspect-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../../..', '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const SELECTED = ['u7f:mounted', 'u7f:skill-load', 'u7f:inspect-list', 'u7f:refusal-zero-effect', 'u7f:approval-leg', 'u7f:leak-check']
const boots = []
const notes = []
// The RUN-rule record (EB3): built through the SHARED lib so it carries
// `overall` / `finishedAt` / `bindings.authority` and finalizes BEFORE the
// write — the u7-4a suite's binding shape (teamSha = this tree at boot,
// hostSha = the asserted host-base HEAD, authority = the live generation
// pointer). The old round-1 hand-rolled c2-verdicts.json lacked these
// (PR #404 finding B-3) and is preserved verbatim under round1-boots-1-3/.
const git = (args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim()
const run = createRunRecord({
  runId: `u7f-c2-${Date.now().toString(36)}`,
  suite: 'u7f-inspect-family-c2',
  selectedCases: SELECTED,
  bindings: {
    teamSha: git(['rev-parse', 'HEAD']),
    hostSha: 'set-from-assertHostBase-in-main', // the pinned host-base HEAD lands below
    authority: readAuthorityBinding(REPO),
    round: 2,
  },
})
const add = (id, verdict, detail) => {
  run.addCase(id, verdict, { detail })
  console.log(`[u7f-c2] case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 300)}`)
}

async function fetchJsonRetry(url, opts, timeoutMs) {
  try { return await fetchJson(url, opts, timeoutMs) } catch (e) { return { status: 0, body: null, error: String(e?.message ?? e) } }
}

async function main() {
  const factory = new TestWorldFactory({
    repoRoot: REPO,
    evidenceRoot: join(HERE, 'world'),
    hostTree: testUseTree(REPO),
  })
  const hostBase = factory.assertHostBase('c2-check')
  run.record.bindings.hostSha = hostBase.head
  const world = await factory.createWorld({ line: 'u7finsp' })
  const assembly = createU7fInspectAssembly({
    repoRoot: REPO, home: world.home, runStamp: world.id, reportDir: world.logDir, sessionRoot: factory.hostTree,
  })
  const planted = assembly.writePreBootFiles()
  // The mount descriptor, fabricated here (no shared kind registration):
  // startHost composes the patch layer from `activeKind` + `this[option].rows`.
  const kind = {
    option: 'u7fRows', probe: null, paths: {}, ledgerRows: {}, envKeys: [], env: () => ({}),
    patchHeader: [
      'U7-F C2 World (evidence script, no shared kind registration): the',
      'production Team row with the INSPECT family ON over one sanctioned',
      'skill root, p6t6 observer and preset declarations, one patch layer.',
    ],
  }
  world.kinds = [kind]
  world.activeKind = kind
  world.u7fRows = { rows: assembly.teamRows() }
  await world.startMock({ decide: makeU7fInspectDecide({ assembly }) })
  console.log(`[u7f-c2] boot 1 starting (world ${world.id})`)
  const t0 = Date.now()
  let boot = null
  try {
    boot = await world.startHost({ bootTimeoutMs: 150_000 })
  } catch (error) {
    add('u7f:mounted', 'FAIL', { reason: `host start failed: ${String(error?.message ?? error).slice(0, 300)}` })
  }
  if (boot !== null) {
    run.logHostStart({ phase: 'u7f-c2-boot', world: world.id, port: boot.port, logPath: boot.logPath, startedAt: new Date().toISOString(), bootMs: Date.now() - t0 })
    boots.push({ phase: 'u7f-c2-boot', world: world.id, port: boot.port, logPath: boot.logPath, startedAt: new Date().toISOString(), bootMs: Date.now() - t0 })
    await drive({ world, assembly, planted, boot })
  }
  const remaining = SELECTED.filter((id) => run.getCase(id) === undefined)
  for (const id of remaining) add(id, 'FAIL', { reason: 'leg not reached (earlier failure or timeout)' })
  // teardown (best effort) — capture BEFORE anything goes; home STAYS this
  // round (post-mortem store + real log files), operator cleans tests/homes.
  const fsMod = await import('node:fs')
  const logCopy = join(HERE, 'host-boot-round2.log')
  if (boot !== null) { try { fsMod.copyFileSync(boot.logPath, logCopy) } catch { notes.push('host log copy failed') } }
  try {
    fsMod.writeFileSync(join(HERE, 'mock-corpus.json'), JSON.stringify((world.mock?.requests ?? []).map((r) => ({
      seq: r.seq, path: r.path, status: r.status, body: r.body ?? null, reply: r.reply ?? null,
    }))))
  } catch { notes.push('mock corpus dump failed') }
  try { await world.stopHost() } catch { /* record below */ }
  const receipts = await world.teardown({ keepHome: true }).catch((e) => ({ error: String(e?.message ?? e) }))
  try {
    const hits = []
    const walk = (dir, depth) => {
      if (depth > 4) return
      for (const ent of fsMod.readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name)
        if (ent.isDirectory()) { if (!ent.name.startsWith('node_modules')) walk(p, depth + 1) } else if (/\.(log|txt|jsonl)$/.test(ent.name) && fsMod.statSync(p).size < 40_000_000) {
          const t = fsMod.readFileSync(p, 'utf8')
          for (const line of t.split('\n')) {
            if (/inspect-family|INSPECT|placement-feed|PLANE_INSPECT|governed-skill|governed-inspect|createRootAgent|root-start|ROOT_START|blueprint/i.test(line)) hits.push(`${p.replace(world.home, '<home>')}| ${line.slice(0, 300)}`)
          }
        }
      }
    }
    walk(world.home, 0)
    fsMod.writeFileSync(join(HERE, 'home-log-hits.txt'), hits.slice(0, 4000).join('\n'))
    notes.push(`home scan hits: ${String(hits.length)}`)
  } catch (e) { notes.push(`home scan failed: ${String(e?.message ?? e)}`) }
  // Finalize BEFORE writing (RUN rule): `finalize()` folds every selected
  // case with no verdict to FAIL, computes `overall`, and stamps
  // `finishedAt`; `write()` then serializes the finalized record — a PASS
  // token cannot be produced unless every selected case is PASS.
  Object.assign(run.record, {
    round: 'u7f-c2',
    boots,
    notes,
    teardown: { receipts: receipts ?? null },
    mockDigest: world.mock === null ? [] : world.mockRequestDigest().slice(-80),
  })
  run.finalize()
  run.write(join(HERE, 'c2-verdicts.json'))
  console.log('[u7f-c2] record written to c2-verdicts.json (u5-run-record/1, finalized before write)')
  const fails = run.record.cases.filter((v) => v.verdict !== 'PASS').length
  console.log(`[u7f-c2] DONE overall=${run.record.overall} pass=${run.record.cases.length - fails} fail=${fails}`)
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
  // readiness
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
  let surface = []
  if (!healthW.hit || health?.body?.ok !== true) {
    add('u7f:mounted', 'FAIL', { reason: `health not ok: status=${String(health?.status)} body=${JSON.stringify(health?.body ?? null).slice(0, 400)}` })
    return
  }
  if (!stateW.hit) {
    add('u7f:mounted', 'FAIL', { reason: `anchored Team Session never appeared: ${JSON.stringify(stateBody ?? null).slice(0, 300)}` })
    return
  }
  // discovery → blueprint → team.create
  let cookie = null
  try { cookie = await authenticate(origin, world.token) } catch (e) {
    add('u7f:mounted', 'FAIL', { reason: `authenticate failed: ${String(e?.message ?? e)}` })
    return
  }
  const discPrompt = await apiPrompt(origin, cookie, assembly.ROOT, assembly.markers.MK_DISC, 'u7f-c2')
  if (discPrompt.status !== 200) {
    add('u7f:mounted', 'FAIL', { reason: `discovery prompt rejected: ${String(discPrompt.status)} ${JSON.stringify(discPrompt.body ?? {}).slice(0, 200)}` })
    return
  }
  const discW = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, assembly.markers.MK_DISC)), 120_000)
  if (!discW.hit) {
    add('u7f:mounted', 'FAIL', { reason: 'discovery model request absent (deny list cannot be computed)', mockDigest: world.mockRequestDigest().slice(-6) })
    return
  }
  await sleep(1500)
  const disc = world.mock.requests.filter((r) => hasMarker(r, assembly.markers.MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)[0]
  surface = [...new Set(disc)].sort()
  const denyList = surface.filter((n) => !n.startsWith('team_')
    && !['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh'].includes(n)
    && !['todo_write'].includes(n))
  assembly.writeMainBlueprint(denyList)
  const hostLog = () => { try { return readFileSync(boot.logPath, 'utf8') } catch { return '' } }
  const created = await remoteCall(fetchJsonRetry, origin, cookie, 'team.create', {
    rootSessionId: assembly.CREATE_ROOT, blueprintId: assembly.BP_MAIN_ID, initialWork: { prompt: assembly.markers.MK_L1 },
  })
  const createOk = created.status === 200 && created.body?.result?.ok === true
  if (!createOk) {
    const fsMod0 = await import('node:fs')
    fsMod0.writeFileSync(join(HERE, 'c2-create-error.json'), JSON.stringify({ status: created.status, body: created.body, surface }, null, 2))
  }
  const logNow = hostLog()
  const placement = logNow.split('\n').filter((l) => l.includes('placement-feed rows='))
  const ALIASES = ['team_skill', 'team_cordis_inspect_list', 'team_cordis_inspect_query']
  const hostAlive = () => world.instance?.child?.exitCode === null && world.instance?.child !== null && world.instance?.child !== undefined
  add('u7f:mounted', healthW.hit && stateW.hit && createOk && ALIASES.every((n) => (placement[placement.length - 1] ?? '').includes(n)) ? 'PASS' : 'FAIL', {
    healthOk: true, stateOk: true, createOk,
    createBody: createOk ? 'ok' : JSON.stringify(created.body ?? null).slice(0, 1200),
    placementFeed: placement.length > 0 ? placement[placement.length - 1].slice(0, 300) : null,
    rootSessionSurfaceAliases: ALIASES.map((n) => `${n}=${surface.includes(n)}`).join(','),
    note: 'the alias check on the ROOT-session discovery surface is DISCLOSED, not the law: plane rows bind per member session; the placement-feed line above is the mount truth for the governed member sessions',
  })
  if (!createOk) return
  // drive: wake cadence from the runner + the scripted lanes
  const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && r.reply.content === content)
  const wake = async (tag) => {
    const pr = await apiPrompt(origin, cookie, assembly.CREATE_ROOT, `U7F_PHASE_${tag}`, 'u7f-c2-wake').catch(() => null)
    if (pr !== null && pr.status !== 200) notes.push(`wake ${tag} rejected status=${String(pr.status)}`)
  }
  const wakeCadence = async (content, deadlineMs, tag) => {
    const t0w = Date.now()
    let lastWake = 0
    let wakes = 0
    for (;;) {
      if (replySeen(content)) return true
      if (Date.now() - t0w > deadlineMs) return replySeen(content)
      if (Date.now() - lastWake > 3000 && wakes < 20) { wakes += 1; lastWake = Date.now(); await wake(tag) }
      await sleep(350)
    }
  }
  const strictDone = await wakeCadence(assembly.DONE.strict, 240_000, 's')
  const leaderDone = await wakeCadence(assembly.DONE.leader, 120_000, 'z')
  notes.push(`lanes: strict=${String(strictDone)} leader=${String(leaderDone)}`)
  // ── evidence ──────────────────────────────────────────────────────────────
  const corpus = JSON.stringify((world.mock?.requests ?? []).map((r) => r.body ?? {}))
  const log = hostLog()
  const logLines = log.split('\n')
  const skillClaim = readFileSync(assembly.files.demo.path, 'utf8').includes('multiply everything by two')
  add('u7f:skill-load', corpus.includes('<skill_content') && corpus.includes('u7f-demo-skill')
    && logLines.some((l) => l.includes('governed-skill RAN name=u7f-demo-skill')) && skillClaim
    ? 'PASS' : 'FAIL', {
    transcriptHasSkillContent: corpus.includes('<skill_content'),
    ranWitness: logLines.filter((l) => l.includes('governed-skill')).slice(-3).map((l) => l.slice(0, 200)),
    refusalWitness: logLines.filter((l) => l.includes('governed-skill') && l.includes('denied')).slice(-2),
  })
  add('u7f:inspect-list', corpus.includes('"providers"')
    && logLines.some((l) => l.includes('governed-inspect-list RAN'))
    ? 'PASS' : 'FAIL', {
    transcriptHasProviders: corpus.includes('"providers"'),
    ranWitness: logLines.filter((l) => l.includes('governed-inspect-list')).slice(-3).map((l) => l.slice(0, 200)),
  })
  const queryRan = logLines.filter((l) => l.includes('governed-inspect-query RAN'))
  add('u7f:refusal-zero-effect', corpus.includes('inspect-provider-unknown') && queryRan.length === 0
    ? 'PASS' : 'FAIL', {
    transcriptHasRefusal: corpus.includes('inspect-provider-unknown'),
    queryRanLines: queryRan.slice(0, 3).map((l) => l.slice(0, 200)),
  })
  // Honest approval-leg count: ASSISTANT tool_use issues (not tool-definition
  // text — boot-2's corpus string-match counted 36 definitions for zero
  // issues) and any pending-control-listed that saw count>0.
  let resolveIssues = 0
  let pendingSeenNonEmpty = 0
  for (const rec of world.mock?.requests ?? []) {
    const msgs = (rec.body ?? {})?.messages ?? []
    for (const m of msgs) {
      if (m?.role === 'assistant' && Array.isArray(m.content)) {
        resolveIssues += m.content.filter((b) => b?.type === 'tool_use' && b?.name === 'team_resolve_control').length
      }
      const t = Array.isArray(m?.content) ? m.content.map((b) => b?.text ?? '').join('') : (typeof m?.content === 'string' ? m.content : '')
      if (/"pending-control-listed"[^\n]*"count"\s*:\s*[1-9]/.test(t)) pendingSeenNonEmpty += 1
    }
  }
  add('u7f:approval-leg', resolveIssues > 0 && pendingSeenNonEmpty > 0 ? 'PASS' : 'FAIL', {
    resolveIssues, pendingSeenNonEmpty,
    note: 'PASS requires a durable PA ask actually raised (pending count>0) AND a leader resolve actually issued; tool-definition text never counts',
  })
  const secretGone = !corpus.includes(assembly.files.secret.claim) && !log.includes(assembly.files.secret.claim)
  const secretBytes = (() => { try { return readFileSync(assembly.SECRET_FILE, 'utf8') } catch { return null } })()
  add('u7f:leak-check', secretGone && (secretBytes === null || secretBytes === planted.secretBefore) ? 'PASS' : 'FAIL', {
    secretClaimInCorpus: corpus.includes(assembly.files.secret.claim),
    secretClaimInHostLog: log.includes(assembly.files.secret.claim),
    secretBytesUnchanged: secretBytes === null ? 'file gone with home' : secretBytes === planted.secretBefore,
  })
}

main().then(() => process.exit(0)).catch((error) => {
  console.error('[u7f-c2] FATAL', error)
  process.exit(1)
})
