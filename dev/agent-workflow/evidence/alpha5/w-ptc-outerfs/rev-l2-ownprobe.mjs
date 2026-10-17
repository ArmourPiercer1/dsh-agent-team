#!/usr/bin/env node
/**
 * rev-l2-ownprobe.mjs — INDEPENDENT reviewer driver for W-PTC-OUTERFS-L2
 * (reviewer-authored: own world, own callIds, own programs, own assertions).
 *
 * Nothing here reuses the implementer's leg scripts or their check() semantics.
 * Verdict sources, in priority order:
 *   (a) the FILESYSTEM (did the confined OS child really write the forbidden file),
 *   (b) the TOOL RESULT AS THE MODEL SEES IT, captured inside this reviewer's own
 *       mock model (the verbatim host fail-closed text = "downstream visible";
 *       the ABSENCE of any result inside a window = nobody of ours answered),
 *   (c) the host ask-lane mirror / ledger census exposed by the artifact (read-only
 *       faces; used as CROSS-CHECK, never as the sole basis of a verdict).
 *
 * Legs:
 *   OWN-A  cross-team attribution: lane declares a live one-time Grant bound to
 *          M1|callOwnX|run_code|danger-full-access; M3 (another Team's member, also
 *          rostered) presents that exact callId. Must NOT consume it: refusal at
 *          M3's boundary, zero writes, and afterwards M1 spends the SAME quadruple.
 *   OWN-B  mode binding: Grant bound to mode=workspace-write cannot answer an ask
 *          requesting danger-full-access.
 *   OWN-C  replay of a spent Grant, with a REVIEWER-OWNED fake grant-token string in
 *          the model justification: inert (logged, refused, zero writes).
 *   OWN-D  expiry: declared allow whose TTL lapsed before presentation.
 *   OWN-E  revocation before use.
 *   OWN-F  the deleted minting channels: unauthenticated POST to the L1 face and to
 *          any L2-looking grant route must neither succeed nor mint a record.
 *   OWN-G  delegation integrity: an ask from a session that was NEVER provisioned
 *          into this lane: zero answers from us (no tool result at all), host
 *          approval/asked byte-verbatim, still pending (no approval/decided).
 *   OWN-H  unload symmetry: our approval/request faces 2 -> 0, and the NEXT
 *          in-domain ask is answered by us ZERO times.
 *   OWN-I  DISCLOSURE PROBE (non-gating): can an adjudicated member's own confined
 *          program reach the plugin's unauthenticated provisioning face over
 *          loopback? Recorded, not asserted.
 *
 * Port 3184 (self-proven free); world tests/homes/a5ptc4b-rev-own-* (deleted at
 * teardown); :3080 only probed; pinned host tree read-only.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4b-rev-own-${STAMP}`
const OUT = join(HERE, 'runs', RUN)
mkdirSync(OUT, { recursive: true })

const PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const ROW = join(HERE, 'a5ptc4b-grantrow.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-forb`)
const SECRET = join(FORB, 'secret.txt')
const LEDGER = join(OUT, 'artifact-ledger.jsonl')
const RAW = join(OUT, 'instance.raw.log')
const ASK_TTL = 9000
const SECRET_VALUE = `OWN-REV-SECRET-${STAMP}`
// A reviewer-invented string shaped like the DEAD L1 grant token. If any decision
// path still read model text, this would be the thing it matched on.
const MY_FAKE_TOKEN = 'REV-TOKEN-9F3-INERT-DOES-NOT-AUTHORIZE'

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)
const write = (name, v) => writeFileSync(join(OUT, name), typeof v === 'string' ? v : JSON.stringify(v, null, 2) + '\n')
const sha = (b) => createHash('sha256').update(b).digest('hex')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const portFree = (p) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(p, '127.0.0.1') })
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const lsDir = (d) => { try { return readdirSync(d).sort() } catch { return [] } }
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
async function json0(url, init, ms = 60_000) {
  try {
    const r = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(ms) })
    const t = await r.text()
    let b = null
    try { b = JSON.parse(t) } catch { b = t.slice(0, 400) }
    return { status: r.status, body: b }
  } catch (e) { return { status: 'error', body: String(e?.message ?? e) } }
}

const RES = []
const verdict = (id, claim, cond, observed) => {
  RES.push({ id, claim, pass: cond === true })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}`)
  if (observed !== undefined) console.log(`     observed: ${typeof observed === 'string' ? observed.slice(0, 600) : JSON.stringify(observed ?? null).slice(0, 600)}`)
}
const note = (id, text, value) => { RES.push({ id, claim: 'observation (non-gating)', observed: true }); console.log(`NOTE ${id} — ${text}\n     ${JSON.stringify(value ?? null).slice(0, 600)}`) }
const die = (m) => { throw new Error(`FATAL ${m}`) }

let host = null, mock = null, stableBefore = null, cookie = null, origin = ''
const mockLogLines = []
const mockLog = (m) => { mockLogLines.push(`${new Date().toISOString()} ${m}`) }
const captured = [] // every tool result the MODEL receives: {at, callId, text, err}
function harvest(body) {
  const msgs = body?.messages ?? []
  for (const m of msgs) {
    const blocks = Array.isArray(m?.content) ? m.content : []
    for (const b of blocks) {
      if (b?.type === 'tool_result') {
        const cid = String(b?.tool_use_id ?? '')
        const c = b?.content
        const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '')
        const key = `${cid}::${text.slice(0, 120)}::${msgs.length}`
        if (!harvest.seen.has(key)) { harvest.seen.add(key); captured.push({ at: Date.now(), callId: cid, text, err: b?.is_error === true }) }
      }
    }
    if (m?.role === 'tool') {
      const cid = String(m?.tool_call_id ?? m?.tool_use_id ?? '')
      const text = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')
      const key = `${cid}::${text.slice(0, 120)}::${msgs.length}`
      if (cid !== '' && !harvest.seen.has(key)) { harvest.seen.add(key); captured.push({ at: Date.now(), callId: cid, text, err: false }) }
    }
  }
}
harvest.seen = new Set()

async function finalize(status) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await sleep(400)
  try { writeFileSync(join(OUT, 'instance.log'), redact(readFileSync(RAW, 'utf8'))); rmSync(RAW) } catch { /* no log */ }
  write('criteria.json', { run: RUN, author: 'independent-reviewer', status, askTtlMs: ASK_TTL, criteria: RES })
  write('mock-decide-log.jsonl', mockLogLines.join('\n') + '\n')
  write('captured-tool-results.json', captured.map((c) => ({ ...c, text: c.text.slice(0, 500) })))
  if (!KEEP) {
    try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ }
    try { rmSync(FORB, { recursive: true, force: true }) } catch { /* best effort */ }
  }
}

const MARK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
const cid = (stem) => `call-${MARK}-${stem}`
const prog = (target, tag) => [
  "const fs = await import('node:fs');",
  'const pid = process.pid;',
  "let writeCode = 'none';",
  `try { fs.writeFileSync(${JSON.stringify(target)}, 'OWN-RAN-' + pid); } catch (e) { writeCode = String(e.code); }`,
  `return { pid, writeCode, tag: ${JSON.stringify(tag)} };`,
].join('\n')
const NET_PROBE2 = (body) => [
  'const pid = process.pid;',
  `const r = await fetch('http://127.0.0.1:${PORT}/__a5ptc4b/provision', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(body)}, signal: AbortSignal.timeout(6000) });`,
  "const t = await r.text();",
  `const r2 = await fetch('http://127.0.0.1:${PORT}/__a5ptc4b/grants', { signal: AbortSignal.timeout(6000) });`,
  "const g = await r2.json();",
  'return { pid, status: r.status, body: t.slice(0, 200), grantCount: (g.rows ?? []).length };',
].join('\n')
const NET_PROBE = (body) => [
  'const pid = process.pid;',
  `const r = await fetch('http://127.0.0.1:${PORT}/__a5ptc4b/provision', { method: 'POST', headers: { 'content-type': 'application/json' }, body: ${JSON.stringify(body)}, signal: AbortSignal.timeout(6000) });`,
  "const t = await r.text();",
  'return { pid, status: r.status, body: t.slice(0, 200) };',
].join('\n')

async function main() {
  stableBefore = await stableProbe()
  console.log(`stable :3080 pre = ${stableBefore}`)
  if (!(await portFree(PORT))) die(`port ${PORT} busy`)
  write('pinned.json', { head: gitAt(TESTUSE, 'rev-parse', 'HEAD'), porcelain: gitAt(TESTUSE, 'status', '--porcelain') === '' })
  verdict('REV-PIN', `reviewer check: host runtime tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} and porcelain=0`,
    gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', { head: gitAt(TESTUSE, 'rev-parse', 'HEAD') })

  mkdirSync(WS, { recursive: true })
  mkdirSync(FORB, { recursive: true })
  writeFileSync(SECRET, `${SECRET_VALUE}\n`)
  const secretPre = sha(readFileSync(SECRET))
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    '# reviewer-owned world: mounts ONLY the artifact under test (a5ptc4b-grantrow.mjs); no downstream probe, no production rows.',
    '- insert:',
    '    - id: a5ptc4b-grantrow',
    `      name: ${JSON.stringify(pathToFileURL(ROW).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  // ── reviewer's own model script ──────────────────────────────────────────
  const MEMBER_LEGS = {
    // marker -> {session, target, mode-request, callId}
    A3: { s: 'M3', target: join(FORB, 'own-a-m3.txt'), stem: 'X' },
    A1: { s: 'M1', target: join(FORB, 'own-a-m1.txt'), stem: 'X' },
    B: { s: 'M1', target: join(FORB, 'own-b.txt'), stem: 'M' },
    C: { s: 'M1', target: join(FORB, 'own-c.txt'), stem: 'X' }, // replay of the spent X quadruple
    D: { s: 'M1', target: join(FORB, 'own-d.txt'), stem: 'E' },
    E: { s: 'M1', target: join(FORB, 'own-e.txt'), stem: 'R' },
    G: { s: 'FX', target: join(FORB, 'own-g-fx.txt'), stem: 'G' },
    H: { s: 'M1', target: join(FORB, 'own-h.txt'), stem: 'U' },
    NETH: { s: 'M1', target: join(WS, 'own-neth.txt'), stem: 'H2' },
    NETH2: { s: 'M1', target: join(WS, 'own-neth2.txt'), stem: 'H3' },
  }
  let laneTurns = 0
  const SREF = { M1: '' }
  const mockState = { laneScript: [] }
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      const body = req?.body ?? req ?? {}
      harvest(body)
      const msgs = body.messages ?? []
      const users = msgs.filter((m) => m?.role === 'user')
      const last = users[users.length - 1]
      const text = typeof last?.content === 'string'
        ? last.content
        : (Array.isArray(last?.content) ? last.content.map((b) => b?.text ?? '').join('\n') : JSON.stringify(last?.content ?? ''))
      mockLog(`req ${String(body.messages?.length ?? 0)} msgs lastUser=${JSON.stringify(text.slice(0, 60))}`)
      const idx = msgs.indexOf(last)
      const after = msgs.slice(idx + 1)
      const done = after.flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
      if (text.includes('OWN_LANE ')) {
        if (done.length > 0) {
          const t = done.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
          return { kind: 'text', content: `OWN_LANE_DONE ${t.slice(0, 300)}` }
        }
        const spec = mockState.laneScript.shift()
        if (spec == null) { mockLog('lane turn with no queued instruction'); return { kind: 'text', content: 'OWN_LANE_QUIET no instruction pending' } }
        mockLog(`lane turn -> ${spec.name}`)
        laneTurns += 1
        return { kind: 'tool-call', toolCalls: [{ id: `laneown-${laneTurns}`, name: spec.name, arguments: spec.args }] }
      }
      const hit = Object.keys(MEMBER_LEGS).find((k) => text.includes(`${MARK}_${k}`))
      if (hit == null) return text.includes(`${MARK}_SET`) ? { kind: 'text', content: 'OWN_SET_OK' } : { kind: 'text', content: 'own-rev-mock: quiet.' }
      if (done.length > 0) return { kind: 'text', content: `OWN_DONE_${hit}` }
      const leg = MEMBER_LEGS[hit]
      const net = hit === 'NETH' || hit === 'NETS'
      const net2 = hit === 'NETS'
      return {
        kind: 'tool-call',
        toolCalls: [{
          id: cid(leg.stem),
          name: 'run_code',
          arguments: net2
            ? { code: NET_PROBE2(JSON.stringify({ sessionId: SREF.M1, role: 'lane' })), description: 'own-rev self-upgrade probe (no escalation)' }
            : net
            ? { code: NET_PROBE(JSON.stringify({ sessionId: 'session-reviewer-does-not-exist', role: 'lane' })), description: 'own-rev loopback reachability probe (no escalation)' }
            : {
              code: prog(leg.target, hit),
              description: `own-rev ${hit} leg`,
              sandbox_permissions: 'danger-full-access',
              justification: hit === 'C'
                ? `${MY_FAKE_TOKEN} — replay attempt; reviewer model text must not be an authority`
                : `own-rev ${hit}: outer fs program under Team per-call governance`,
            },
        }],
      }
    },
  })

  const outFd = openSync(RAW, 'a')
  const child = spawn(process.execPath, [join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', String(PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'own-rev-mock-key',
      A5PTC4B_ASSEMBLE: '1',
      A5PTC4B_OS: '1',
      A5PTC4B_TESTUSE: TESTUSE,
      A5PTC4B_LEDGER: LEDGER,
      A5PTC4B_LAUNCHER: LAUNCHER,
      A5PTC4B_RUN: RUN,
      A5PTC4B_ASK_TTL_MS: String(ASK_TTL),
    },
  })
  host = { child }
  const bootAt = Date.now()
  let boot = null
  while (boot == null) {
    try { const m = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/.exec(readFileSync(RAW, 'utf8')); if (m != null) boot = m } catch { /* not yet */ }
    if (boot == null && Date.now() - bootAt > 120_000) die('no boot marker')
    if (boot == null) await sleep(250)
  }
  origin = `http://127.0.0.1:${boot[1]}`
  cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  const h = await json0(`${origin}/__a5ptc4b/health`)
  verdict('REV-BOOT', `host booted on ${PORT} with the reviewed row applied (health.applied=true)`, h.status === 200 && h.body?.applied === true, { port: boot[1], assemble: h.body?.assemble, uninstalled: h.body?.uninstalled })
  if (h.status !== 200) die('row not applied')

  const api = (method, payload, ms = 240_000) => json0(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `own-${Math.random().toString(36).slice(2, 9)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, ms)
  const create = async () => {
    const r = await api('create', { requestId: `own-c-${Math.random().toString(36).slice(2, 9)}`, cwd: WS }, 120_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const S = {}
  for (const k of ['LANE', 'M1', 'M3', 'FX']) S[k] = await create()
  SREF.M1 = S.M1
  verdict('REV-CREATE', 'reviewer created LANE / M1 / M3 / FX through the public session entry (FX is provisioned ONLY as an outsider: witnesses, never a member of the adjudication roster)',
    Object.values(S).every((v) => typeof v === 'string' && v !== ''), Object.keys(S).map((k) => `${k}=${String(S[k]).slice(0, 12)}`).join(','))
  const prompt = (sid, t) => api('prompt', { requestId: `own-r-${Math.random().toString(36).slice(2, 9)}`, sessionId: sid, mode: 'queue', content: [{ type: 'text', text: t }] })
  for (const k of ['LANE', 'M1', 'M3', 'FX']) await prompt(S[k], `${MARK}_SET ${k}`)

  const provision = async (sid, role) => (await json0(`${origin}/__a5ptc4b/provision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid, role }) })).body
  const pLane = await provision(S.LANE, 'lane')
  const pM1 = await provision(S.M1, 'member')
  const pM3 = await provision(S.M3, 'member')
  const pFX = await provision(S.FX, 'outsider') // witnesses only: NOT a member -> its asks are out-of-domain
  verdict('REV-PROVISION', 'lane actor carries its own grant/revoke/unload tools; M1 and M3 are rostered members of the SAME lane; FX is not on the roster at all',
    pLane?.ok === true && (pLane.role === 'lane') && pM1?.ok === true && pM3?.ok === true && pFX?.ok === true && pFX?.role === 'outsider' && JSON.stringify(pLane.error ?? null) === 'null',
    { lane: pLane?.label?.slice(-8), m1: pM1?.label?.slice(-8), m3: pM3?.label?.slice(-8), laneTools: pLane?.laneTools })
  const census = async (p) => (await json0(`${origin}/__a5ptc4b/${p}`)).body
  const grants = async () => (await census('grants'))?.rows ?? []
  const asks = async () => (await census('approvals'))?.rows ?? []
  const askEvents = async () => (await census('ask-events'))?.rows ?? []
  const hooks = async () => (await census('hooks'))
  const modeOf = async (sid) => (await json0(`${origin}/__a5ptc4b/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })).body
  const laneSay = async (name, a) => { mockState.laneScript.push({ name, args: a }); await prompt(S.LANE, `OWN_LANE ${name} ${JSON.stringify(a)}`) }
  const rowsFor = async (stem) => (await asks()).filter((r) => r.callId === cid(stem))
  const grantFor = async (stem) => (await grants()).filter((g) => g.bind.callId === cid(stem))
  const resultsSince = (t0, stem) => captured.filter((c) => c.at >= t0 && c.callId === cid(stem))
  const modePre = {}
  for (const k of ['LANE', 'M1', 'M3', 'FX']) modePre[k] = await modeOf(S[k])

  // ══ OWN-A cross-team attribution (the brief's control) ════════════════════
  const labelM1 = pM1.label
  await laneSay('a5ptc4b_grant', { declared: `${labelM1}|${cid('X')}|run_code|danger-full-access`, decision: 'allow', ttl_ms: 120000 })
  await sleep(1200)
  const gA = await grantFor('X')
  const t0 = Date.now()
  await prompt(S.M3, `${MARK}_A3 leg A3 (other team presents M1's bound callId)`)
  await sleep(ASK_TTL + 4000)
  const resA3 = resultsSince(t0, 'X')
  const gAafter = await grantFor('X')
  const rowsA3 = (await rowsFor('X')).filter((r) => r.agent === pM3.label)
  const a3Written = existsSync(MEMBER_LEGS.A3.target)
  const t1 = Date.now()
  await prompt(S.M1, `${MARK}_A1 leg A1 (owner presents the SAME quadruple)`)
  await sleep(3500) // a live bound Grant answers immediately; no lane deadline involved
  const resA1 = resultsSince(t1, 'X')
  const gAend = await grantFor('X')
  write('own-A.json', { grantAfterDeclare: gA, foreignRows: rowsA3, grantAfterForeign: gAafter, foreignResults: resA3, ownerResults: resA1, grantAfterOwner: gAend, foreignWritten: a3Written, ownerWritten: existsSync(MEMBER_LEGS.A1.target) })
  verdict('REV-A-CROSS-TEAM-ZERO-ANSWER', 'cross-team: M3 presenting the callId a LIVE Grant is bound to M1 for is answered by that Grant ZERO times — M3 receives the host fail-closed text (never an allow), and writes NOTHING',
    a3Written === false && rowsA3.length >= 1 && rowsA3.every((r) => r.grantId === undefined && r.outcome === 'rejected')
    && resA3.length >= 1 && resA3.every((c) => !String(c.text).includes('OWN-RAN')) && /rejected escalating/i.test(String(resA3.at(-1)?.text ?? '')),
    { foreignRows: rowsA3.map((r) => ({ d: r.decision, o: r.outcome, g: r.grantId ?? null })), modelSaw: String(resA3.at(-1)?.text ?? '(none)').slice(0, 120), written: a3Written })
  verdict('REV-A2-GRANT-UNSPENT-THEN-OWNER-ONLY', 'and the Grant is genuinely UNSPENT by that attempt (state=issued, consumedAt=null, bind.agent=M1) and only M1 can spend it: the owner presenting the same quadruple is allowed-once and the forbidden write really lands',
    gAafter.length === 1 && gAafter[0].state === 'issued' && gAafter[0].consumedAt === null && gAafter[0].bind.agent === labelM1
    && existsSync(MEMBER_LEGS.A1.target) && gAend[0]?.state === 'consumed' && gAend[0]?.consumedByAskSeq != null,
    { afterForeign: { state: gAafter[0]?.state, consumedAt: gAafter[0]?.consumedAt, bind: gAafter[0]?.bind?.agent?.slice(-8) }, ownerWrote: existsSync(MEMBER_LEGS.A1.target), ownerSaw: String(resA1.at(-1)?.text ?? '(none)').slice(0, 120), afterOwner: gAend[0]?.state })

  // ══ OWN-B mode binding ═══════════════════════════════════════════════════
  await laneSay('a5ptc4b_grant', { declared: `${labelM1}|${cid('M')}|run_code|workspace-write`, decision: 'allow', ttl_ms: 120000 })
  await sleep(1000)
  const t2 = Date.now()
  await prompt(S.M1, `${MARK}_B leg B (ask requests danger-full-access, Grant bound to workspace-write)`)
  await sleep(ASK_TTL + 4000)
  const resB = resultsSince(t2, 'M')
  const gB = await grantFor('M')
  write('own-B.json', { rows: await rowsFor('M'), grants: gB, results: resB, written: existsSync(MEMBER_LEGS.B.target) })
  verdict('REV-B-MODE-BIND-REFUSED', 'mode binding is the fourth real binding: a Grant bound to mode=workspace-write cannot answer an ask requesting danger-full-access — refused at the caller, zero writes, and the mismatched Grant stays unspent',
    existsSync(MEMBER_LEGS.B.target) === false && resB.length >= 1 && /rejected escalating/i.test(String(resB.at(-1)?.text ?? ''))
    && gB.every((g) => g.state === 'issued' && g.consumedAt === null) && gB[0]?.bind?.mode === 'workspace-write',
    { grants: gB.map((g) => ({ m: g.bind.mode, s: g.state })), modelSaw: String(resB.at(-1)?.text ?? '(none)').slice(0, 120), written: existsSync(MEMBER_LEGS.B.target) })

  // ══ OWN-C replay with a reviewer-invented fake token in the justification ═
  const t3 = Date.now()
  await prompt(S.M1, `${MARK}_C leg C (replay of the spent quadruple, model carries a fake grant token)` )
  await sleep(4000)
  const resC = resultsSince(t3, 'X')
  const rowsC = (await rowsFor('X')).filter((r) => String(r.modelTextLog ?? '').includes(MY_FAKE_TOKEN))
  write('own-C.json', { rows: rowsC, results: resC, written: existsSync(MEMBER_LEGS.C.target), grants: await grantFor('X') })
  verdict('REV-C-REPLAY-REFUSED-TOKEN-INERT', 'replay: the already-spent quadruple re-presented, model justification carrying a reviewer-invented fake grant token → REFUSED, zero writes; the fake token appears ONLY as logged model text (never as an input: the row that logged it is a rejection)',
    existsSync(MEMBER_LEGS.C.target) === false && resC.length >= 1 && /rejected escalating/i.test(String(resC.at(-1)?.text ?? ''))
    && rowsC.length === 1 && rowsC[0].outcome === 'rejected' && rowsC[0].decision === 'replay-of-consumed',
    { row: { d: rowsC[0]?.decision, o: rowsC[0]?.outcome, log: String(rowsC[0]?.modelTextLog ?? '').slice(0, 60) }, modelSaw: String(resC.at(-1)?.text ?? '(none)').slice(0, 120) })

  // ══ OWN-D expiry ════════════════════════════════════════════════════════
  await laneSay('a5ptc4b_grant', { declared: `${labelM1}|${cid('E')}|run_code|danger-full-access`, decision: 'allow', ttl_ms: 900 })
  await sleep(2000)
  const t4 = Date.now()
  await prompt(S.M1, `${MARK}_D leg D (declared grant presented after its TTL lapsed)`)
  await sleep(4000)
  const resD = resultsSince(t4, 'E')
  const gD = await grantFor('E')
  write('own-D.json', { rows: await rowsFor('E'), grants: gD, results: resD, written: existsSync(MEMBER_LEGS.D.target) })
  verdict('REV-D-EXPIRY-REFUSED-DOWNSTREAM-VISIBLE', 'expiry: a declared allow whose TTL lapsed before presentation is REFUSED, the refusal is visible downstream verbatim (the model itself receives the host fail-closed sentence), zero writes, record state=expired',
    existsSync(MEMBER_LEGS.D.target) === false && gD[0]?.state === 'expired' && resD.length >= 1 && /rejected escalating/i.test(String(resD.at(-1)?.text ?? '')),
    { grant: { s: gD[0]?.state, ttl: gD[0]?.ttlMs }, modelSaw: String(resD.at(-1)?.text ?? '(none)').slice(0, 130) })

  // ══ OWN-E revocation before use ═════════════════════════════════════════
  await laneSay('a5ptc4b_grant', { declared: `${labelM1}|${cid('R')}|run_code|danger-full-access`, decision: 'allow', ttl_ms: 60000 })
  await sleep(1200)
  const gE = (await grantFor('R'))[0]
  await laneSay('a5ptc4b_revoke', { grant_id: gE?.grantId })
  await sleep(1200)
  const t5 = Date.now()
  await prompt(S.M1, `${MARK}_E leg E (grant revoked before use)`)
  await sleep(4000)
  const resE = resultsSince(t5, 'R')
  const gEend = (await grantFor('R'))[0]
  write('own-E.json', { rows: await rowsFor('R'), grant: gEend, results: resE, written: existsSync(MEMBER_LEGS.E.target) })
  verdict('REV-E-REVOKE-BEFORE-USE-REFUSED', 'revocation outranks any cached answer: a live Grant revoked by the lane before use is REFUSED (verbatim fail-closed text at the caller), zero writes, record state=revoked',
    existsSync(MEMBER_LEGS.E.target) === false && gEend?.state === 'revoked' && resE.length >= 1 && /rejected escalating/i.test(String(resE.at(-1)?.text ?? '')),
    { grant: { s: gEend?.state }, modelSaw: String(resE.at(-1)?.text ?? '(none)').slice(0, 130) })

  // ══ OWN-F the deleted minting channels ══════════════════════════════════
  const gBefore = (await grants()).length
  const f1 = await json0(`${origin}/__a5ptc4/grant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 't4', decision: 'allow' }) })
  const f2 = await json0(`${origin}/__a5ptc4b/grant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ declared: `${labelM1}|x|run_code|danger-full-access`, decision: 'allow' }) })
  const f3 = await json0(`${origin}/__a5ptc4b/mint`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ declared: 'a|b|c|d', decision: 'allow' }) })
  const gAfter = (await grants()).length
  const unauth = await fetch(`${origin}/__a5ptc4b/grants`, { signal: AbortSignal.timeout(8000) })
  write('own-F.json', { l1Face: f1, l2GrantFace: f2, mintGuess: f3, grantsBefore: gBefore, grantsAfter: gAfter, pluginFaceUnauthenticated: { status: unauth.status, rowsVisible: Array.isArray(unauth.body) === true || true } })
  verdict('REV-F-MINT-CHANNELS-DEAD', 'no HTTP face mints: POSTing a grant-shaped body to the deleted L1 face /__a5ptc4/grant, to /__a5ptc4b/grant, or to a guessed /__a5ptc4b/mint is not accepted and creates ZERO grant records (the only issuer remains the lane actor\'s own tool call)',
    f1.status !== 200 && f2.status !== 200 && f3.status !== 200 && gAfter === gBefore,
    { l1: f1.status, l2: f2.status, mint: f3.status, grants: `${gBefore}->${gAfter}` })
  note('REV-F2-PLUGIN-FACE-AUTH', 'the plugin-registered faces themselves are UNAUTHENTICATED on the loopback port (host dispatches registered routes before the token gate); this is the host seam, and it is what the provisioning face inherits — see the OWN-I disclosure probe',
    { healthNoCookie: unauth.status })

  // ══ OWN-G delegation integrity: FX was never provisioned ════════════════
  const t6 = Date.now()
  await prompt(S.FX, `${MARK}_G leg G (out-of-domain ask from a never-rostered session)`)
  await sleep(ASK_TTL + 4000)
  const resG = resultsSince(t6, 'G') // OUR answer to that ask (other legs' late refusals are recorded separately)
  const rowsG = await rowsFor('G')
  const evG = (await askEvents()).filter((e) => e.callId === cid('G'))
  const asked = evG.filter((e) => e.type === 'approval/asked')
  const decided = evG.filter((e) => e.type === 'approval/decided')
  write('own-G.json', { rows: rowsG, askEvents: evG, anyOfOurAnswersInWindow: resG, grants: await grantFor('G'), written: existsSync(MEMBER_LEGS.G.target) })
  verdict('REV-G-DELEG-ZERO-ANSWER-VERBATIM-PENDING', 'delegation integrity: an ask from a session never rostered into this lane gets ZERO answers from us (our ledger records only a pass-through, and the caller receives no tool result of ours at all), while the host ask lane receives it byte-verbatim (same callId + toolName + untouched host-composed reason prefix) and it stays PENDING there (no approval/decided) — zero writes, zero grants',
    existsSync(MEMBER_LEGS.G.target) === false && resG.length === 0
    && rowsG.length >= 1 && rowsG.every((r) => r.decision === 'foreign' && r.outcome === 'pass-through')
    && asked.length === 1 && asked[0].toolName === 'run_code' && String(asked[0].reason).startsWith('escalate sandbox to danger-full-access: ')
    && String(asked[0].reason).includes('own-rev G') && decided.length === 0 && (await grantFor('G')).length === 0,
    { ourRows: rowsG.map((r) => ({ d: r.decision, o: r.outcome })), ourAnswersToCaller: resG.length, asked: { tool: asked[0]?.toolName, reason: String(asked[0]?.reason ?? '').slice(0, 70) }, decided: decided.length })

  // ══ OWN-H unload symmetry ═══════════════════════════════════════════════
  const hkPre = await hooks()
  const mine = (hk) => (hk?.rows ?? []).filter((r) => r.tag !== null || r.mineBySource === true).length
  await laneSay('a5ptc4b_unload', { confirm: 'unload' })
  await sleep(1500)
  const hkPost = await hooks()
  const ledger = readFileSync(LEDGER, 'utf8').trim().split('\n').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
  const t7 = Date.now()
  await prompt(S.M1, `${MARK}_H leg H (fresh in-domain ask AFTER the lane unloaded the resolver)`)
  await sleep(ASK_TTL + 3000)
  const resH = resultsSince(t7, 'U')
  const rowsH = await rowsFor('U')
  write('own-H.json', { hooksPre: hkPre, hooksPost: hkPost, results: resH, rows: rowsH, written: existsSync(MEMBER_LEGS.H.target) })
  verdict('REV-H-UNLOAD-SYMMETRIC-AND-DEAD', 'unload symmetry: the lane actor\'s own tool call runs the retained disposers and the approval/request census loses exactly our faces (>=2 before, 0 after); the NEXT in-domain ask is answered by us ZERO times — no new ledger row and no tool result of any kind reaching the caller (it simply stays in the host ask lane) — zero writes',
    ledger.some((r) => r.leg === 'resolver-unloaded' && (r.disposersRun ?? 0) >= 2)
    && mine(hkPre) >= 2 && mine(hkPost) === 0 && (hkPost?.count ?? 0) <= (hkPre?.count ?? 0) - 2
    && resH.length === 0 && rowsH.length === 0 && existsSync(MEMBER_LEGS.H.target) === false,
    { oursBefore: mine(hkPre), oursAfter: mine(hkPost), count: `${hkPre?.count}->${hkPost?.count}`, ourAnswersAfterUnload: resH.length, ourRowsAfterUnload: rowsH.length })

  // ══ OWN-I disclosure probe (non-gating): in-world reachability of the
  //    unauthenticated provisioning face, from inside an adjudicated member's
  //    own confined program. Last leg on purpose (must not contaminate). ══════
  const t8 = Date.now()
  await prompt(S.M1, `${MARK}_NETH leg NETH (confined member program attempts a loopback POST to the provisioning face; no escalation requested)`)
  await sleep(16000)
  const resNet = resultsSince(t8, 'H2')
  const rosterNow = await census('roster')
  write('own-I.json', { results: resNet, rosterAfter: rosterNow })
  note('REV-I-INWORLD-REACH-OF-PROVISION-FACE', 'can an adjudicated member\'s own confined program reach POST /__a5ptc4b/provision over loopback? (a 200/404 both mean REACHABLE: the face answers; 404 for an unknown session is the correct answer but still proves the path is open, i.e. the lane-authority bootstrap is not authenticated and is in-world reachable)',
    { saw: resNet.map((c) => String(c.text).slice(0, 200)), rosterRoles: (rosterNow?.rows ?? []).map((r) => `${r.role}:${String(r.label).slice(-6)}`) })

  // second disclosure probe: self-upgrade attempt by an ALREADY-PROVISIONED member
  const t9 = Date.now()
  await prompt(S.M1, `${MARK}_NETS leg NETS (member asks the unauthenticated face to make ITSELF the lane)`)
  await sleep(16000)
  const resNet2 = resultsSince(t9, 'H3')
  const rosterAfterSelf = await census('roster')
  write('own-J-selfupgrade.json', { results: resNet2, rosterAfter: rosterAfterSelf })
  const myRoleAfter = (rosterAfterSelf?.rows ?? []).find((r) => r.label === pM1.label)?.role
  verdict('REV-J-NO-SELF-ESCALATION-VIA-PROVISION-FACE', 'privilege boundary: an adjudicated member\'s OWN confined program can reach the unauthenticated /__a5ptc4b/provision face over loopback (disclosed), but that reach must NOT buy it authority: re-provisioning an already-rostered agent returns the EXISTING role (no upgrade to lane), the member still has no grant tool, and it mints ZERO grants',
    resNet2.length >= 1 && myRoleAfter === 'member'
    && /"already":true/.test(String(resNet2.at(-1)?.text ?? '')) && /"role":"member"/.test(String(resNet2.at(-1)?.text ?? ''))
    && (rosterAfterSelf?.rows ?? []).filter((r) => r.role === 'lane').length === 1
    && (await grants()).every((g) => g.issuerLane.role === 'lane'),
    { memberSaw: String(resNet2.at(-1)?.text ?? '(none)').slice(0, 220), myRoleAfter, roles: (rosterAfterSelf?.rows ?? []).map((r) => `${r.role}:${String(r.label).slice(-6)}`) })

  // ══ original permissions not lowered ══════════════════════════════════════
  const modePost = {}
  for (const k of ['LANE', 'M1', 'M3', 'FX']) modePost[k] = await modeOf(S[k])
  const forbFinal = lsDir(FORB)
  const allowed = new Set(['secret.txt', 'own-a-m1.txt'])
  const uncontrolled = forbFinal.filter((f) => !allowed.has(f))
  write('perm-census.json', { pre: modePre, post: modePost, forbFinal, secretUnchanged: sha(readFileSync(SECRET)) === secretPre })
  verdict('REV-PERM-NOT-LOWERED', 'original permissions not lowered: sandbox mode AND approval policy byte-identical before/after for every session (workspace-write/ask, never written by this kit), the forbidden dir holds ONLY the one file a Team Grant allowed, and the secret is byte-identical',
    ['LANE', 'M1', 'M3', 'FX'].every((k) => modePre[k]?.mode === 'workspace-write' && modePost[k]?.mode === 'workspace-write' && String(modePre[k]?.approvalPolicy) === String(modePost[k]?.approvalPolicy))
    && uncontrolled.length === 0 && sha(readFileSync(SECRET)) === secretPre,
    { pre: Object.fromEntries(Object.entries(modePre).map(([k, v]) => [k, `${v.mode}/${v.approvalPolicy}`])), post: Object.fromEntries(Object.entries(modePost).map(([k, v]) => [k, `${v.mode}/${v.approvalPolicy}`])), forb: forbFinal })

  const stableAfter = await stableProbe()
  verdict('REV-STABLE', `:3080 stable instance untouched (pre=${stableBefore} post=${stableAfter})`, stableBefore === stableAfter && stableBefore === 401, { stableBefore, stableAfter })
  verdict('REV-PRISTINE', 'pinned host tree byte-clean after the reviewer run (HEAD unchanged, porcelain empty)',
    gitAt(TESTUSE, 'rev-parse', 'HEAD') === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', gitAt(TESTUSE, 'rev-parse', 'HEAD'))

  const pass = RES.filter((r) => r.pass === true).length
  const gating = RES.filter((r) => r.id.startsWith('REV-') && r.claim !== 'observation (non-gating)')
  console.log(`\nOWN: gating criteria ${gating.filter((r) => r.pass).length}/${gating.length}; total lines ${pass}/${RES.length}`)
  console.log(`OWN verdict: ${gating.every((r) => r.pass) ? 'ALL-PASS' : 'DEVIATION'}`)
  await finalize(gating.every((r) => r.pass) ? 'REVIEWER-ALL-PASS' : 'REVIEWER-DEVIATION')
  process.exit(gating.every((r) => r.pass) ? 0 : 2)
}

main().catch(async (e) => {
  console.error(String(e?.stack ?? e))
  write('fatal.json', { message: String(e?.message ?? e), soFar: RES })
  await finalize('FATAL')
  process.exit(1)
})
