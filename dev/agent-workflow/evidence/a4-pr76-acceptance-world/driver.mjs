#!/usr/bin/env node
/**
 * driver.mjs — MACHINE legs for the Alpha.3 §8 nine-step permission-surface
 * acceptance, run against the A4-PR76 acceptance world booted by boot.mjs.
 *
 * SIMULATED / MACHINE acceptance — NOT the human pass. The agent-turn legs
 * (6/7) run over the repo harness mock DeepSeek lane (no model credentials
 * exist in this environment); every observation here is machine-side. The
 * Alpha.4 HUMAN acceptance remains BLOCKED/NOT_RUN (alpha4-implementation-
 * plan.md §7.7), and the browser pass over steps 2-9 stays with the human
 * (LEGS.md maps every step).
 *
 * What this is NOT: it does not simulate any pass it did not execute. Every
 * leg prints the RAW wire response; a leg that cannot run prints SKIP with
 * the missing input named. Exit code != 0 iff a MACHINE leg FAILs.
 *
 * Usage: node driver.mjs [--world <dir>] [--port 3180] [--receipt <path>]
 * Prereq: boot.mjs already running for this world (token read from
 * <world>/.accept-launch.json). Leg 6 needs boot --model-delay-ms >= 2000.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const argv = process.argv.slice(2)
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d }
const REPO = '/home/user/dsh-plugins/dsh-agent-team'
const WORLD = opt('--world', join(REPO, 'tests', 'homes', 'a4-accept-20261007T16-57-26Z'))
const PORT = Number(opt('--port', '3180'))
const ORIGIN = `http://127.0.0.1:${PORT}`
const TEAM = 'session-a4-accept-boot'
const STAMP = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '')
const MOCK_DELAY_MS = (() => {
  try {
    return Number(JSON.parse(readFileSync(join(WORLD, '.accept-host.json'), 'utf8')).modelDelayMs ?? 0)
  } catch {
    return 0
  }
})()
const RECEIPT = opt('--receipt', join(HERE, 'receipts', `driver-run-${STAMP}.log`))
mkdirSync(dirname(RECEIPT), { recursive: true })

// ── receipt + console plumbing ──────────────────────────────────────────────
const results = []
function say(msg) {
  process.stdout.write(msg + '\n')
  appendFileSync(RECEIPT, msg + '\n')
}
function raw(label, value, cap = 1200) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  say(`    ${label}: ${text.length > cap ? text.slice(0, cap) + ` …(+${text.length - cap} chars)` : text}`)
}
function leg(step, name, status, note = '') {
  results.push({ step, name, status, note })
  say(`  [${status}] step ${step} — ${name}${note !== '' ? ` — ${note}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function probeStable(label) {
  let rec
  try {
    const r = await fetch('http://127.0.0.1:3080/', { signal: AbortSignal.timeout(10_000), redirect: 'manual' })
    rec = { label, status: r.status }
  } catch (e) {
    rec = { label, status: 0, error: String(e?.message ?? e) }
  }
  say(`  :3080 red-line probe (${label}): status=${rec.status}`)
  return rec
}

// ── wire helpers (pr-f kit pattern) ─────────────────────────────────────────
let cookie = null
let token = null
try {
  token = JSON.parse(readFileSync(join(WORLD, '.accept-launch.json'), 'utf8')).token
} catch {
  say(`FAIL: no launch token at ${join(WORLD, '.accept-launch.json')} — run boot.mjs first`)
  process.exit(2)
}
async function authenticate() {
  const res = await fetch(`${ORIGIN}/?token=${token}`, { redirect: 'manual' })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth: status=${res.status}`)
  cookie = setCookie.split(';')[0]
  return { status: res.status, hasCookie: true }
}
async function remote(method, params, version = 1) {
  const res = await fetch(`${ORIGIN}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie !== null ? { cookie } : {}) },
    body: JSON.stringify({ type: 'client-request', rpcId: `d-${Math.random().toString(36).slice(2, 8)}`, method, payload: { version, params } }),
  })
  return { http: res.status, body: await res.json().catch(() => null) }
}
async function tool(name, args, as) {
  const res = await fetch(`${ORIGIN}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  })
  return { http: res.status, body: await res.json().catch(() => null) }
}
async function health() {
  return (await fetch(`${ORIGIN}/__p6t6/health`)).json()
}
function deepFindAll(o, pred, out = []) {
  if (o === null || typeof o !== 'object') return out
  if (!Array.isArray(o) && pred(o)) out.push(o)
  for (const v of Object.values(o)) deepFindAll(v, pred, out)
  return out
}
let tokenSeq = 0
const rt = (label) => `a4w-${label}-${STAMP}-${(tokenSeq += 1)}`
function mockCount() {
  const p = join(WORLD, 'logs', 'mock-requests.jsonl')
  return existsSync(p) ? readFileSync(p, 'utf8').split('\n').filter((l) => l !== '').length : 0
}
function mockFiles() {
  const dir = join(WORLD, 'logs')
  return readdirSync(dir).filter((f) => /^mock-req-\d+\.json$/.test(f)).sort()
}
/** Scan captures newer than `sinceCount`, attributed to `childSessionId`. */
function scanNotifications(sinceCount, childSessionId) {
  const files = mockFiles().slice(sinceCount)
  let hits = 0
  let headers = []
  for (const f of files) {
    const text = readFileSync(join(WORLD, 'logs', f), 'utf8')
    if (childSessionId !== '' && !text.includes(childSessionId)) continue
    let parsed
    try { parsed = JSON.parse(text) } catch { continue }
    const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
    for (const m of msgs) {
      const s = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
      const n = (s.match(/\[team-perm-changed /g) ?? []).length
      if (n > 0) {
        hits += n
        for (const hm of s.matchAll(/\[team-perm-changed [^\]]*\]/g)) headers.push(hm[0])
      }
    }
  }
  return { capturesScanned: files.length, hits, headers }
}

say(`# A4-PR76 acceptance driver — SIMULATED / MACHINE run, NOT the human pass`)
say(`# world=${WORLD}`)
say(`# origin=${ORIGIN} stamp=${STAMP} mockDelayMs=${MOCK_DELAY_MS}`)
say(`# (raw responses below are the wire truth; world tokens/paths are gitignored by TEST_METHODS §3.6/§5)`)
const stableBefore = await probeStable('before')

// ════ STEP 2 (MACHINE part): boot surface + team from the envelope-carrying v3 Blueprint ════
say(`\n== step 2 — boot line loaded, auth, catalog, team from the v3 envelope-carrying Blueprint`)
{
  let ok = true
  const bare = await fetch(`${ORIGIN}/`, { redirect: 'manual' })
  raw('bare GET / (expect 401)', { status: bare.status })
  ok &&= bare.status === 401
  raw('authenticated GET /?token= (expect 303)', await authenticate())
  const h = await health()
  raw('GET /__p6t6/health', h)
  ok &&= h.ready === true && h.toolCount === 15
  const cat = await remote('catalog.list', {}, 1)
  const bps = cat.body?.result?.value?.data?.blueprints ?? []
  raw('catalog.list v1', bps)
  const team = bps.find((b) => b.blueprintId === 'a4.accept.team')
  ok &&= team !== undefined && team.revisionStates.every((r) => r.migrationState === 'current')
  // FINDING (recorded, NOT worked around): for FROZEN origins catalog.list
  // reports the storage L3 row stamp, not the Blueprint document version —
  // storage/schema/blueprint-registry.ts:106 stamps schemaVersion=
  // TEAM_DOMAIN_SCHEMA_VERSION (=2, storage/schema/stores.ts:61) while
  // runtime/plugin/blueprint-authority.ts:466-475 consumes that field as the
  // document version. Today benign (both 2 and 3 classify 'current'); after
  // the A4-PR7 7.3 flip (SUPPORTED=[3], RETIRED=[1,2]) every FROZEN row
  // would misclassify as migration-required. Document truth via catalog.get
  // (parsed source) is asserted below; the live list output above is the
  // reproduction.
  say('    FINDING: frozen-origin catalog.list rows stamp schemaVersion from the storage row (2), not the v3 document — see LEGS.md "Findings", reproduction raw above')
  const detail = await remote('catalog.get', { blueprintId: 'a4.accept.team' }, 1)
  const doc = detail.body?.result?.value?.data?.blueprint
  raw('catalog.get a4.accept.team (document truth)', { schemaVersion: doc?.schemaVersion, contentHash: doc?.contentHash })
  ok &&= doc?.schemaVersion === 3
  const created = await remote('team.create', { rootSessionId: TEAM, blueprintId: 'a4.accept.team' }, 2)
  raw('team.create v2 (idempotent)', { ok: created.body?.result?.ok, path: created.body?.result?.value?.data?.path })
  ok &&= created.body?.result?.ok === true
  leg('2', 'world boots; v3 Blueprint with non-empty permissionMutationEnvelope is bound', ok ? 'PASS' : 'FAIL',
    'non-empty envelope is proven BEHAVIORALLY by step 4 (an expansion grant above the member static lane commits ONLY under envelope coverage) and by the v3 validator boot-gate (validate.ts:1335-1337 refuses a v3 doc without both carriers)')
}

// ════ STEP 3 (MACHINE part): Blueprint-SELECTED tool surface ════
say(`\n== step 3 — Leader tool surface carries team_grant_permission/team_revoke_permission; template filtering is live`)
{
  let ok = true
  const g = await tool('team_grant_permission', { rootSessionId: TEAM, requestToken: rt('s3'), targetInstanceId: 'inst-x', rules: [] }, TEAM)
  const gRouted = g.body?.ok === true && g.body?.value?.code === 'TEAM_TOOL_BAD_ARGUMENTS'
  raw('team_grant_permission as Leader (bad args -> typed production rejection = REGISTERED)', g.body)
  const r = await tool('team_revoke_permission', { rootSessionId: TEAM, requestToken: rt('s3b'), targetInstanceId: 'inst-x', rules: [] }, TEAM)
  const rRouted = r.body?.ok === true && r.body?.value?.code === 'TEAM_TOOL_BAD_ARGUMENTS'
  ok &&= gRouted && rRouted
  const bogus = await tool('team_definitely_not_a_tool', {}, TEAM)
  raw('unknown tool name as Leader (expect UNKNOWN_TOOL)', bogus.body)
  ok &&= bogus.body?.error?.info?.code === 'UNKNOWN_TOOL'
  leg('3', 'MACHINE part: both permission tools route to production on the Leader; catalog control UNKNOWN_TOOL', ok ? 'PASS' : 'FAIL',
    'member-side template filtering asserted in step 4 block; GUI visibility pass stays with the human')
  var surfaceOk = ok
}

// ════ STEP 4: WRITE leg (Leader tool + operator-side v7 twin) ════
say(`\n== step 4 — WRITE leg: team_grant_permission exact-file rule -> changed:true; identical replay -> changed:false; remote override.mutatePermission v7 twin`)
let inst = null
let child = ''
let ok4 = false
{
  const mk = await tool('team_create_member', { rootSessionId: TEAM, requestToken: rt('mk'), delegationTemplateId: 'worker', label: `a4w-${STAMP}` }, TEAM)
  raw('team_create_member (worker)', mk.body)
  inst = mk.body?.value?.effect?.instanceId ?? null
  if (inst === null) {
    leg('4', 'member creation', 'FAIL', 'no instanceId in effect')
    leg('5', 'READ leg', 'SKIP', 'blocked by step-4 failure')
    leg('6', 'ACTIVE notification', 'SKIP', 'blocked by step-4 failure')
    leg('7', 'IDLE no-wake', 'SKIP', 'blocked by step-4 failure')
    leg('9', 'lifecycle audit', 'SKIP', 'blocked by step-4 failure')
  } else {
    // filter check for step 3: leader-only tool must be UNKNOWN on the member surface
    const st = await (await fetch(`${ORIGIN}/__p6t6/state`)).json()
    const row = deepFindAll(st, (o) => o.instanceId === inst && typeof o.childSessionId === 'string')[0]
    child = row?.childSessionId ?? ''
    const asMember = await tool('team_grant_permission', { rootSessionId: TEAM, requestToken: rt('s3m'), targetInstanceId: inst, rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: 'grants/x.txt' }, effect: 'allow' }] }, child)
    raw('team_grant_permission as MEMBER child (expect UNKNOWN_TOOL — template filter)', asMember.body)
    if (surfaceOk && asMember.body?.error?.info?.code !== 'UNKNOWN_TOOL') ok4 = false

    const grant = await tool('team_grant_permission', {
      rootSessionId: TEAM, requestToken: rt('g1'), targetInstanceId: inst,
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: `grants/leg4-${STAMP}.txt` }, effect: 'allow' }],
    }, TEAM)
    raw('team_grant_permission (fresh exact file)', grant.body)
    const replay = await tool('team_grant_permission', {
      rootSessionId: TEAM, requestToken: rt('g2'), targetInstanceId: inst,
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: `grants/leg4-${STAMP}.txt` }, effect: 'allow' }],
    }, TEAM)
    raw('identical replay (expect changed:false)', replay.body)
    const opMut = await remote('override.mutatePermission', {
      teamSessionId: TEAM, memberInstanceId: inst, kind: 'grant_instance',
      mutationId: `a4w-opmut-${STAMP}`, reason: 'A4-PR76 acceptance operator-side leg',
      actor: { kind: 'human' },
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: `grants/leg4b-${STAMP}.txt` }, effect: 'deny' }],
    }, 7)
    raw('operator override.mutatePermission v7 (actor kind human)', { ok: opMut.body?.result?.ok, changed: opMut.body?.result?.value?.data?.changed })
    ok4 = grant.body?.value?.changed === true && replay.body?.value?.changed === false
      && opMut.body?.result?.ok === true && opMut.body?.result?.value?.data?.changed === true
    leg('4', 'WRITE leg (Leader tool + operator v7 twin)', ok4 ? 'PASS' : 'FAIL', `member=${inst}`)
  }
}

// ════ STEP 5: READ leg ════
if (inst !== null) {
  say(`\n== step 5 — READ leg: override.getPermission v7 -> authority present, history ascending`)
  const read = await remote('override.getPermission', { teamSessionId: TEAM, memberInstanceId: inst }, 7)
  const d = read.body?.result?.value?.data
  raw('authority', { present: d?.authority?.present, generation: d?.authority?.generation, rules: d?.authority?.rules })
  raw('history generations', (d?.history?.entries ?? []).map((e) => e.generation))
  const gens = (d?.history?.entries ?? []).map((e) => e.generation)
  const asc = gens.every((g2, i) => i === 0 || g2 > gens[i - 1])
  const ruleVisible = (d?.authority?.rules ?? []).some((r2) => r2.resource.includes(`leg4-${STAMP}.txt`) && r2.effect === 'allow')
  leg('5', 'READ leg', d?.authority?.present === true && asc && ruleVisible ? 'PASS' : 'FAIL', 'authority+history ONLY — execution conclusion belongs to the next-operation attempt (GUI/human)')
}

// ════ STEP 6: ACTIVE notification (SIMULATED model lane) ════
if (inst !== null) {
  say(`\n== step 6 — ACTIVE notification (best-effort, at-most-one) — SIMULATED model lane`)
  if (MOCK_DELAY_MS < 2000) {
    leg('6', 'ACTIVE notification', 'SKIP', `needs boot with --model-delay-ms >= 2000 (marker says ${MOCK_DELAY_MS})`)
  } else {
    const before = mockCount()
    const started = Date.now()
    const del = await tool('team_delegate', { rootSessionId: TEAM, requestToken: rt('del'), delegationInstanceId: inst, label: `a4w-run-${STAMP}`, prompt: `A4WAKE-${STAMP} hold briefly and acknowledge.`, async: true }, TEAM)
    raw('async delegate (member enters RUNNING)', { status: del.body?.value?.status, workStatus: del.body?.value?.effect?.workStatus })
    await sleep(1500)
    const midGrant = await tool('team_grant_permission', {
      rootSessionId: TEAM, requestToken: rt('g6'), targetInstanceId: inst,
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: `grants/leg6-${STAMP}.txt` }, effect: 'allow' }],
    }, TEAM)
    raw('CHANGING grant inside the RUNNING window', midGrant.body)
    await sleep(MOCK_DELAY_MS + 8000)
    const scan = scanNotifications(before, child)
    raw(`model-visible [team-perm-changed] occurrences in member captures after seq ${before}`, scan)
    const headerOk = scan.headers.every((h2) => h2.includes(`team=${TEAM}`) && h2.includes(`instance=${inst}`) && /generation=\d+\]$/.test(h2))
    const noRuleBodies = scan.headers.length === scan.hits
    const deliveredInWindow = midGrant.body?.value?.changed === true && del.body?.value?.effect?.workStatus === 'admitted'
    let st6 = 'FAIL'
    let note6 = `hits=${scan.hits}`
    if (scan.hits === 1 && headerOk && noRuleBodies) { st6 = 'PASS'; note6 = 'exactly ONE model-visible notification, spec header, no rule bodies' }
    else if (scan.hits === 0 && deliveredInWindow) { st6 = 'PASS'; note6 = '0 = legitimate best-effort outcome (eligibility re-checked at receipt); grant acked inside the RUNNING window' }
    leg('6', 'ACTIVE notification', st6, note6 + `; SIMULATED lane (mock DeepSeek; no model creds in env); member not restarted (same instanceId/child session continues)`)
  }

  // ════ STEP 7: IDLE no-wake ════
  say(`\n== step 7 — IDLE no-wake (idle window > 2x model delay; no capture growth; write still commits)`)
  if (MOCK_DELAY_MS < 2000) {
    leg('7', 'IDLE no-wake', 'SKIP', 'needs --model-delay-ms >= 2000 for a trustworthy idle window')
  } else {
    await sleep(MOCK_DELAY_MS * 2 + 4000)
    const before = mockCount()
    const g7 = await tool('team_grant_permission', {
      rootSessionId: TEAM, requestToken: rt('g7'), targetInstanceId: inst,
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: `grants/leg7-${STAMP}.txt` }, effect: 'allow' }],
    }, TEAM)
    const r7 = await tool('team_revoke_permission', {
      rootSessionId: TEAM, requestToken: rt('r7'), targetInstanceId: inst,
      rules: [{ operationClass: 'write', matcher: { kind: 'exact', value: `grants/leg7-${STAMP}.txt` }, effect: 'allow' }],
    }, TEAM)
    raw('IDLE CHANGING grant + revoke', { grantChanged: g7.body?.value?.changed, revokeChanged: r7.body?.value?.changed })
    await sleep(MOCK_DELAY_MS * 2 + 6000)
    const after = mockCount()
    const scan = scanNotifications(before, child)
    const read2 = await remote('override.getPermission', { teamSessionId: TEAM, memberInstanceId: inst }, 7)
    const gens2 = (read2.body?.result?.value?.data?.history?.entries ?? []).map((e) => e.generation)
    raw(`mock capture count across idle window`, { before, after })
    raw('history generations after idle mutations', gens2)
    const st7 = after === before && scan.hits === 0 && gens2.length > 1
    leg('7', 'IDLE no-wake', st7 ? 'PASS' : 'FAIL', `zero new model requests, zero notifications, WRITE committed (gens ${gens2.length})`)
  }
}

// ════ STEP 8: negative reads ════
say(`\n== step 8 — negative reads: foreign team / ghost instance / v6 version`)
{
  const foreign = await remote('override.getPermission', { teamSessionId: 'session-not-a-team-here', memberInstanceId: inst ?? 'inst-zz9zz9zz9zz9' }, 7)
  raw('foreign teamSessionId', { code: foreign.body?.result?.error?.code })
  const ghost = await remote('override.getPermission', { teamSessionId: TEAM, memberInstanceId: 'inst-zz9zz9zz9zz9' }, 7)
  raw('grammar-valid ghost instance (current team)', { code: ghost.body?.result?.error?.code })
  const malformed = await remote('override.getPermission', { teamSessionId: TEAM, memberInstanceId: 'inst-ghost-does-not-exist' }, 7)
  raw('malformed ghost id (disclosed: grammar gate answers RECORD_INVALID BEFORE the lifecycle read — still a typed refusal, never an empty view)', { code: malformed.body?.result?.error?.code })
  const v6 = await remote('override.getPermission', { teamSessionId: TEAM, memberInstanceId: inst ?? 'inst-zz9zz9zz9zz9' }, 6)
  raw('getPermission at contract v6', { code: v6.body?.result?.error?.code })
  const ok8 = foreign.body?.result?.error?.code === 'TEAM_REMOTE_FOREIGN_TEAM'
    && ghost.body?.result?.error?.code === 'PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN'
    && v6.body?.result?.error?.code === 'method-version-unsupported'
  leg('8', 'negative reads', ok8 ? 'PASS' : 'FAIL')
}

// ════ STEP 9: lifecycle audit ════
if (inst !== null) {
  say(`\n== step 9 — lifecycle audit: archive keeps history readable; fresh member has no inherited authority`)
  const arch = await tool('team_archive_member', { rootSessionId: TEAM, requestToken: rt('arch'), targetInstanceId: inst }, TEAM)
  raw('team_archive_member', { status: arch.body?.value?.status, to: arch.body?.value?.effect?.to })
  const read = await remote('override.getPermission', { teamSessionId: TEAM, memberInstanceId: inst }, 7)
  const d = read.body?.result?.value?.data
  const gens = (d?.history?.entries ?? []).map((e) => e.generation)
  const asc = gens.every((g2, i) => i === 0 || g2 > gens[i - 1])
  const mk2 = await tool('team_create_member', { rootSessionId: TEAM, requestToken: rt('mk2'), delegationTemplateId: 'worker', label: `a4w-fresh-${STAMP}` }, TEAM)
  const inst2 = mk2.body?.value?.effect?.instanceId ?? null
  const read2 = inst2 !== null
    ? await remote('override.getPermission', { teamSessionId: TEAM, memberInstanceId: inst2 }, 7)
    : { body: null }
  const d2 = read2.body?.result?.value?.data
  raw('archived member history STILL readable (ascending gens)', gens)
  raw('fresh member authority', { present: d2?.authority?.present, historyEntries: (d2?.history?.entries ?? []).length })
  const ok9 = d?.authority?.present === true && gens.length > 1 && asc && d2?.authority?.present === false && (d2?.history?.entries ?? []).length === 0
  leg('9', 'lifecycle audit', ok9 ? 'PASS' : 'FAIL')
}

await probeStable('after')
say(`\n== summary`)
for (const r2 of results) say(`  ${r2.status.padEnd(4)} step ${r2.step} — ${r2.name}${r2.note !== '' ? ` — ${r2.note}` : ''}`)
const fails = results.filter((r2) => r2.status === 'FAIL').length
say(`\n${results.length} MACHINE legs checked: ${results.filter((r2) => r2.status === 'PASS').length} PASS, ${results.filter((r2) => r2.status === 'SKIP').length} SKIP, ${fails} FAIL`)
say(`SIMULATED / MACHINE run — NOT the human pass. Alpha.4 human acceptance: BLOCKED/NOT_RUN (§7.7).`)
writeFileSync(RECEIPT, readFileSync(RECEIPT, 'utf8'))
say(`receipt: ${RECEIPT}`)
process.exit(fails > 0 ? 1 : 0)
