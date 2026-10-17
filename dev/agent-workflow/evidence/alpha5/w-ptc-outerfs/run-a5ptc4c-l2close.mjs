#!/usr/bin/env node
/**
 * run-a5ptc4c-l2close.mjs — W-PTC-OUTERFS-L2 CLOSURE runner (F-L2-1 + F-L2-2).
 *
 * GREEN (default): the closure row (a5ptc4c-grantrow.mjs) must
 *   (a) refuse EVERY step of the F-L2-1 attack chain that
 *       run-a5ptc4c-chainred.mjs completed against the reviewed row:
 *         F1-REG-TRUSTED-CHANNEL-ONESHOT  registration ONLY via the
 *             assembler-private 0600 lifecycle channel (registeredVia recorded),
 *             one-time per spawn: consumed-nonce replay refused,
 *             already-rostered re-registration refused (never a promotion),
 *             post-seal registration refused — ATK never reaches the roster;
 *         F1-NO-HTTP-REGISTRATION-MINT  grant/register/provision shapes POSTed
 *             to all eight plausible paths (reviewed /__a5ptc4b/*, closure
 *             /__a5ptc4c/*, devkit /__a5ptc4cdev/*) produce NO 2xx mutation:
 *             roster and grants ledgers move zero; route census: mutating=0;
 *         F1-INWORLD-ATTACK-REFUSED  the member's own confined workspace-write
 *             child (SAME program class as the RED round) gets non-2xx on both
 *             provision paths and EACCES writing the lifecycle-channel file
 *             (OS floor, forbidden-dir control), roster delta zero;
 *         F1-ATK-MINT-DEAD  the attacker driving its OWN session ATK finds no
 *             minting tool on it (unknown-tool refusal captured AT the model
 *             boundary), grants ledger delta zero;
 *         F1-CHAIN-CONSUME-REFUSED  the member presents the very quadruple the
 *             attack aimed at: no Grant exists → held to the lane deadline →
 *             lane-timeout rejection with NO grantId; l-chain.txt (which the
 *             RED round WROTE) does not exist;
 *   (b) reproduce the whole L2 governance suite with the SAME criterion ids
 *       (ANCHOR + five negative controls + DELEG + CONC + T5 + GOV + PERM),
 *       plus F1-DELEGATION-PATH-UNDISTURBED: after every refusal above, the
 *       honest lane still answers a fresh ask allowed-once (write lands);
 *   (c) close F-L2-2: unload burns member faces (real disposers, ledger
 *       counted, ghost ask answered zero times) → channel install rebuilds
 *       faces to exactly the installed count → uninstall-all disposes BOTH
 *       tiers and leaves only the DISCLOSED read-only residue (POST probes
 *       change nothing) → reinstall answers exactly one decided row per ask.
 *
 * --red (discrimination): assembly OFF (A5PTC4C_ASSEMBLE=0) — every GOVERNANCE
 * criterion MUST fail while security-posture and hygiene criteria (absence
 * faces, channel discipline, OS floor, pins, PERM invariants) still pass.
 *
 * Port 3184 (self-proven free); world tests/homes/a5ptc4c-* (deleted at
 * teardown unless --keep); :3080 only probed; pinned host tree read-only.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { createServer } from 'node:net'
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync, chmodSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const args = process.argv.slice(2)
const argValue = (n, d) => { const i = args.indexOf(`--${n}`); return i === -1 ? d : args[i + 1] }
const MODE = args.includes('--red') ? 'red' : 'green'
const KEEP = args.includes('--keep')
const HERE = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(HERE, '..', '..', '..', '..', '..')))
const RUN_STAMP = new Date().toISOString().slice(0, 19).replace(/:/g, '-') + 'Z'
const RUN = `a5ptc4c-${MODE}-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(join(HERE, 'runs', RUN))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc4c-grantrow.mjs')
const PROBE_PATH = join(HERE, 'a5ptc4b-probe-pkg', 'a5ptc4b-downstream-probe.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-forb`)
const SECRET = join(FORB, 'secret.txt')
const IPC_DIR = join(HOME, '.a5ptc4c')
const IPC_FILE = join(IPC_DIR, 'lane-channel.jsonl')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const PROBE_LEDGER = join(EVIDENCE_DIR, 'downstream-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const ASK_TTL_MS = Number(argValue('ask-ttl', 10000))
const LEG_WAIT = MODE === 'green' ? 120_000 : 25_000
const FORB_TARGET = (leg) => join(FORB, `l-${leg}.txt`)
const CHAIN_TARGET = FORB_TARGET('chain')
const GHOST_TARGET = FORB_TARGET('ghost')

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)

const GOVERNANCE_IDS = new Set([
  'ANCHOR-TEAM-GRANT-ALLOWED-ONCE', 'NEG1-REPLAY-REFUSED', 'NEG2-EXPIRED-REFUSED-DOWNSTREAM-VISIBLE',
  'NEG3-AGENT-BIND-GRANT-UNSPENT-AND-OWNER-ONLY', 'NEG4-REVOKED-BEFORE-USE-REFUSED', 'NEG5-MODE-BIND-MISMATCH-REFUSED',
  'DELEG-ZERO-ANSWER-VERBATIM-DOWNSTREAM', 'CONCURRENCY-ISOLATION', 'T5-UNLOAD-SYMMETRIC-AND-DEAD',
  'GOV-ADJUDICATION-INPUT-IS-TEAM-GRANT-ONLY',
  'F1-CHAIN-CONSUME-REFUSED', 'F1-DELEGATION-PATH-UNDISTURBED',
  'F2-UNLOAD-BURNS-MEMBER-FACES', 'F2-UNINSTALL-ALL-NO-RESIDUE', 'F2-REINSTALL-EXACTLY-ONCE',
])

const CRITERIA = []
const check = (id, claim, cond, observed) => {
  CRITERIA.push({ id, claim, pass: cond === true, governance: GOVERNANCE_IDS.has(id) })
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

const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
const LEG_ALIAS = { REPLAY: 'ANCHOR', XTEAMUSE: 'XTEAM' }
const LEG_STEM = { REPLAY: 'replay', XTEAMUSE: 'xteam' }
const callIdFor = (leg) => `call-${MK}-${LEG_ALIAS[leg] ?? leg}`
const escProgram = (tag, stem) => [
  "const fs = await import('node:fs');",
  'const pid = process.pid;',
  `const w = await tools.a5ptc4c_echo({ tag: '${tag}-body' });`,
  'let writeCode = \'none\';',
  `try { fs.writeFileSync(${JSON.stringify(FORB_TARGET(stem))}, 'A5PTC4C-BODY-RAN-' + pid); } catch (e) { writeCode = String(e.code); }`,
  'return { pid, echo: w, writeCode, canary: \'A5PTC4C-BODY-RAN\' };',
].join('\n')
const foreignProgram = (leg) => [
  "const fs = await import('node:fs');",
  'const pid = process.pid;',
  'let writeCode = \'none\';',
  `try { fs.writeFileSync(${JSON.stringify(FORB_TARGET(leg.toLowerCase()))}, 'FX-BODY-RAN-' + pid); } catch (e) { writeCode = String(e.code); }`,
  `fs.writeFileSync(${JSON.stringify(join(WS, `fx-${leg.toLowerCase()}-fxcanary.txt`))}, 'FX-RAN-' + pid);`,
  'return { pid, writeCode, canary: \'FX-RAN\' };',
].join('\n')
// The attacker's confined child — SAME SHAPE as the RED round: workspace-write,
// NO escalation; try lane registration over loopback on every plausible face,
// read the roster census, and try to append to the assembler lifecycle channel.
const attackerProgram = (atkSid) => [
  "const fs = await import('node:fs');",
  'const pid = process.pid;',
  `const base = 'http://127.0.0.1:${HOST_PORT}';`,
  'const out = { pid };',
  'const post = async (p) => { try {',
  `  const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: ${JSON.stringify(atkSid)}, sid: ${JSON.stringify(atkSid)}, role: 'lane', pending_seq: 1, decision: 'allow', ttl_ms: 60000 }) });`,
  '  const t = String(await r.text()).slice(0, 160); return { status: r.status, body: t } } catch (e) { return { error: String(e).slice(0, 120) } } };',
  'out.oldFace = await post(\'/__a5ptc4b/provision\');',
  'out.newFace = await post(\'/__a5ptc4c/provision\');',
  'out.devFace = await post(\'/__a5ptc4cdev/provision\');',
  'out.mint = await post(\'/__a5ptc4c/grant\');',
  'try { const r2 = await fetch(base + \'/__a5ptc4c/roster\'); out.rosterStatus = r2.status; const j = await r2.json(); out.laneCount = (j.rows ?? []).filter((x) => x.role === \'lane\').length } catch (e) { out.rosterError = String(e).slice(0, 120) }',
  `try { fs.appendFileSync(${JSON.stringify(IPC_FILE)}, JSON.stringify({ kind: 'register', nonce: 'attacker-forged-' + Date.now(), role: 'lane' }) + '\\n'); out.ipcWrite = 'WRITTEN-DANGER' } catch (e) { out.ipcWrite = String(e.code) }`,
  `try { fs.appendFileSync(${JSON.stringify(join(FORB, 'ipc-control.txt'))}, 'x'); out.forbControl = 'WRITTEN-DANGER' } catch (e) { out.forbControl = String(e.code) }`,
  `fs.writeFileSync(${JSON.stringify(join(WS, 'chain-green-result.json'))}, JSON.stringify(out));`,
  'return out;',
].join('\n')

let host = null
let mock = null
let stableBefore = null
let origin = null
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
  writeEvidence('criteria.json', { run: RUN, mode: MODE, askTtlMs: ASK_TTL_MS, status, criteria: CRITERIA })
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

async function main() {
  stableBefore = await stableProbe()
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `pinned host tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain=0`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 12)} porcelain=${porcelain0}`)
  const rowSrc = readFileSync(ROW_PATH, 'utf8')
  const revSrc = readFileSync(join(HERE, 'run-a5ptc4-rev.mjs'), 'utf8')
  const mutatingRouteLit = /'\/__a5ptc4c(b|dev)?\/(provision|grant|revoke|register|unload)'/
  check('T1-NO-TOKEN-CHANNEL-AND-NO-MUTATING-ROUTE-IN-ARTIFACT', 'static: the closure row carries no model-text token channel and registers NO mutating HTTP path literal (provision/grant/revoke/register/unload), consumes ONLY the assembler-private lifecycle channel, and contains no devkit import; the red control runner still keeps the L1 row byte-identical (token literal present there, inert)',
    !rowSrc.includes('A5PTC4-TOKEN') && !mutatingRouteLit.test(rowSrc)
    && !rowSrc.includes('setSandboxMode') && !rowSrc.includes('setApprovalPolicy')
    && rowSrc.includes('A5PTC4C_IPC') && rowSrc.includes('lifecycle-register')
    && !rowSrc.includes('devprovision') && revSrc.includes('A5PTC4-TOKEN'),
    `mutating-literals=${mutatingRouteLit.test(rowSrc)} token-channel=false ipc=true devkit-ref=false`)
  const rowSha = sha256(rowSrc)
  writeEvidence('install-manifest.json', {
    run: RUN,
    productionAssembly: [
      { file: basename(ROW_PATH), sha256: rowSha, mounted: 'cordis.patch.yml id=a5ptc4c-grantrow' },
      { file: 'a5ptc4b-probe-pkg/a5ptc4b-downstream-probe.mjs', sha256: sha256(readFileSync(PROBE_PATH)), mounted: 'cordis.patch.yml id=a5ptc4b-downstream-probe' },
    ],
    devOnlyFiles: [{ file: 'a5ptc4c-devprovision-pkg/a5ptc4c-devprovision.mjs', mounted: 'NOT MOUNTED in this assembly (kit dev shape only; env A5PTC4C_DEVKIT gate inside; see run-a5ptc4c-devkit.mjs)' }],
    note: 'install-surface diff: the devkit provision file appears ONLY in the dev-shape manifest; this production manifest never references it and the row source contains no devkit import.',
  })

  mkdirSync(WS, { recursive: true })
  mkdirSync(FORB, { recursive: true })
  writeFileSync(SECRET, `A5PTC4C-${RUN_STAMP}\n`)
  const secretShaPre = sha256(readFileSync(SECRET))
  // The assembler-private lifecycle channel: created by US (Team host side)
  // BEFORE the host starts, mode 0600; the plugin only ever READS appended bytes.
  mkdirSync(IPC_DIR, { recursive: true })
  writeFileSync(IPC_FILE, '', { mode: 0o600 })
  chmodSync(IPC_FILE, 0o600)
  const ipcModeOk = (statSync(IPC_FILE).mode & 0o777) === 0o600
  const probeRun = spawnSync(LAUNCHER, ['--probe'], { encoding: 'utf8', timeout: 4000 })
  const directWs = (() => {
    const d = join(EVIDENCE_DIR, 'os-direct-ws'); mkdirSync(d, { recursive: true })
    const r = spawnSync(LAUNCHER, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--rw', d, '--', process.execPath, '-e',
      `require('node:fs').writeFileSync(${JSON.stringify(join(d, 'ok.txt'))},'ok')`], { encoding: 'utf8', timeout: 15_000 })
    return existsSync(join(d, 'ok.txt')) && Number(r.status) === 0
  })()
  const directOs = (() => {
    const r = spawnSync(LAUNCHER, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--', process.execPath, '-e',
      `require('node:fs').appendFileSync(${JSON.stringify(join(FORB, 'os-direct-deny.txt'))},'x')`], { encoding: 'utf8', timeout: 15_000 })
    return !existsSync(join(FORB, 'os-direct-deny.txt')) && /EACCES|read-only|denied|EPERM/i.test(String(r.stderr))
  })()
  check('P-OS-PREFLIGHT', 'OS floor up (direct launcher probes; the forbidden-dir EACCES the attacker child hits later rides this same confine() path)',
    Number(probeRun.status) === 0 && directWs && directOs,
    `probe-exit=${String(probeRun.status)} ws-writable=${directWs} forbidden-denied=${directOs}`)
  check('F1-CHANNEL-0600', 'the lifecycle-channel file exists BEFORE the host starts and is mode 0600 (assembler-private; the plugin only reads it)', ipcModeOk, `mode=${(statSync(IPC_FILE).mode & 0o777).toString(8)}`)

  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5ptc4c ${MODE} round ${RUN}: production assembly = closure row + downstream probe.`,
    '# NO devkit row is mounted here (the explicit dev shape lives in run-a5ptc4c-devkit.mjs).',
    '- insert:',
    '    - id: a5ptc4c-grantrow',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '',
    '    - id: a5ptc4b-downstream-probe',
    `      name: ${JSON.stringify(pathToFileURL(PROBE_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))
  const patchText = readFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), 'utf8')
  check('F1-DEVKIT-ABSENT-BY-DEFAULT', 'production install surface: cordis.patch.yml mounts ONLY the closure row + the independent probe; no devkit provision row is referenced anywhere (install-surface diff in install-manifest.json; dev-shape proof in run-a5ptc4c-devkit.mjs)',
    !patchText.includes('devprovision') && !patchText.includes('a5ptc4cdev') && patchText.includes('a5ptc4c-grantrow') && patchText.includes('a5ptc4b-downstream-probe'),
    'mounted=[a5ptc4c-grantrow, a5ptc4b-downstream-probe]')

  let laneTurns = 0
  let reqs = 0
  const S = {}
  const laneVerbs = /A5PTC4C_LANE_(ALLOW_PENDING\s+\d+|DENY_PENDING\s+\d+|REVOKE\s+\S+|UNLOAD|ALLOW_PAST\s+\d+\s+\S+|ALLOW_FUTURE\s+\S+\s+\d+)/
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 180) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs}` }
      const body = req?.body ?? req ?? {}
      const msgs = body.messages ?? []
      const users = msgs.filter((m) => m?.role === 'user')
      const last = users[users.length - 1]
      const lastText = typeof last?.content === 'string' ? last.content : (Array.isArray(last?.content) ? last.content.map((b0) => b0?.text ?? '').join('\n') : String(last?.content ?? ''))
      const atk = /A5PTC4C_ATK_GRANT\s+(\S+)/.exec(lastText)
      if (atk !== null) {
        const idx = msgs.indexOf(last)
        const done = msgs.slice(idx + 1).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => /tool.?result|tool-call-error|toolerror/i.test(String(b?.type ?? ''))) : [])
        if (done.length > 0) {
          const t = done.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
          writeEvidence('atk-mint-boundary.json', { at: new Date().toISOString(), toolResultAtModelBoundary: t.slice(0, 900) })
          return { kind: 'text', content: `A5PTC4C_ATK_DONE ${t.slice(0, 500)}` }
        }
        return { kind: 'tool-call', toolCalls: [{ id: `atk-${MK}-mint`, name: 'a5ptc4c_grant', arguments: { declared: atk[1].trim(), decision: 'allow', ttl_ms: 60000 } }] }
      }
      const sayM = laneVerbs.exec(lastText)
      const say = sayM === null ? null : sayM[1].trim()
      if (say !== null) {
        const idx = msgs.indexOf(last)
        const toolResults = msgs.slice(idx + 1).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
        const resultText = toolResults.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
        laneTurns += 1
        const pending = /^A5PTC4C-GRANT-REJECTED no pending ask with seq=(\d+)/.test(resultText) ? null : /^PENDING (\d+)$/.exec(resultText)
        if (say.startsWith('ALLOW_PENDING')) {
          if (toolResults.length === 0) { const n = Number(/\s(\d+)$/.exec(say)[1]); return { kind: 'tool-call', toolCalls: [{ id: `lane-${MK}-ap${laneTurns}`, name: 'a5ptc4c_grant', arguments: { pending_seq: n, decision: 'allow', ttl_ms: 60000 } }] } }
          return { kind: 'text', content: `A5PTC4C_LANE_PENDING_NOT_FOUND ${resultText.slice(0, 200)}` }
        }
        if (say.startsWith('DENY_PENDING')) {
          if (toolResults.length === 0) { const n = Number(/\s(\d+)$/.exec(say)[1]); return { kind: 'tool-call', toolCalls: [{ id: `lane-${MK}-dp${laneTurns}`, name: 'a5ptc4c_grant', arguments: { pending_seq: n, decision: 'reject', ttl_ms: 60000 } }] } }
          return { kind: 'text', content: `A5PTC4C_LANE_DENY_DONE ${resultText.slice(0, 200)}` }
        }
        if (say.startsWith('REVOKE')) {
          if (toolResults.length === 0) { const id = /^REVOKE (\S+)$/.exec(say)[1]; return { kind: 'tool-call', toolCalls: [{ id: `lane-${MK}-rv${laneTurns}`, name: 'a5ptc4c_revoke', arguments: { grant_id: id } }] } }
          return { kind: 'text', content: `A5PTC4C_LANE_REVOKE_DONE ${resultText.slice(0, 300)}` }
        }
        if (say.startsWith('ALLOW_PAST')) {
          if (toolResults.length === 0) { const m = /^ALLOW_PAST (\d+) (\S+)$/.exec(say); return { kind: 'tool-call', toolCalls: [{ id: `lane-${MK}-xp${laneTurns}`, name: 'a5ptc4c_grant', arguments: { declared: m[2], decision: 'allow', ttl_ms: Number(m[1]) } }] } }
          return { kind: 'text', content: `A5PTC4C_LANE_PAST_DONE ${resultText.slice(0, 300)}` }
        }
        if (say.startsWith('ALLOW_FUTURE')) {
          if (toolResults.length === 0) { const m = /^ALLOW_FUTURE (\S+) (\d+)$/.exec(say); return { kind: 'tool-call', toolCalls: [{ id: `lane-${MK}-gr${laneTurns}`, name: 'a5ptc4c_grant', arguments: { declared: m[1], decision: 'allow', ttl_ms: Number(m[2]) } }] } }
          return { kind: 'text', content: `A5PTC4C_LANE_FUTURE_DONE ${resultText.slice(0, 300)}` }
        }
        if (toolResults.length > 0 && !/GRANT-REJECTED/.test(resultText)) return { kind: 'text', content: `A5PTC4C_LANE_UNLOAD_DONE ${resultText.slice(0, 300)}` }
        return { kind: 'tool-call', toolCalls: [{ id: `lane-${MK}-un${laneTurns}`, name: 'a5ptc4c_unload', arguments: { confirm: 'unload' } }] }
      }
      const hit = ['ANCHOR', 'REPLAY', 'EXPIRY', 'REVOKE', 'BIND', 'XTEAM', 'XTEAMUSE', 'Q1', 'Q2', 'DELEG', 'FXCHECK', 'CHAINA', 'CHAIN', 'UNLOADAFTER', 'GHOST', 'PANCHOR', 'Q3'].find((l) => lastText.includes(`${MK}_${l} `) || lastText.endsWith(`${MK}_${l}`))
      if (hit == null) return lastText.includes(`${MK}_SET`) ? { kind: 'text', content: `${MK}_SET_OK` } : { kind: 'text', content: 'a5ptc4c-mock: quiet.' }
      const idx = msgs.indexOf(last)
      const results = msgs.slice(idx + 1).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
      if (results.length > 0) {
        const t = results.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
        return { kind: 'text', content: `${MK}_DONE_${hit} ${t.slice(0, 900)}` }
      }
      const code = hit === 'DELEG' || hit === 'FXCHECK' ? foreignProgram(hit === 'FXCHECK' ? 'FXPRE' : 'DELEG') : hit === 'CHAINA' ? attackerProgram(S.ATK) : escProgram(hit, LEG_STEM[hit] ?? hit.toLowerCase())
      return {
        kind: 'tool-call',
        toolCalls: [{
          id: callIdFor(hit),
          name: 'run_code',
          arguments: hit === 'FXCHECK'
            ? { code, description: 'a5ptc4c FXCHECK: outsider workspace-write control (no escalation)' }
            : hit === 'DELEG'
              ? { code, description: `a5ptc4c ${hit}: outsider program (host lane route; must NOT be answered by us)`, sandbox_permissions: 'danger-full-access', justification: `a5ptc4c ${hit}: outsider leg` }
            : hit === 'CHAINA'
              ? { code, description: 'a5ptc4c CHAINA: confined attacker program (workspace-write, NO escalation) attacks the provision faces + lifecycle channel' }
              : {
                code,
                description: `a5ptc4c ${hit}: write ${LEG_STEM[hit] ?? hit.toLowerCase()} target`,
                sandbox_permissions: 'danger-full-access',
                justification: hit === 'REPLAY'
                  ? `a5ptc4c REPLAY: second presentation of the SAME four-way identity; this text also carries the DEAD L1 token verbatim (A5PTC4-TOKEN=${MK}-L1TEXT) to prove the token channel is inert and log-only`
                  : `a5ptc4c ${hit}: justification carries model text only`,
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
      DEEPSEEK_API_KEY: 'a5ptc4c-mock-key',
      A5PTC4C_ASSEMBLE: MODE === 'green' ? '1' : '0',
      A5PTC4C_OS: '1',
      A5PTC4C_TESTUSE: TESTUSE,
      A5PTC4C_LEDGER: LEDGER,
      A5PTC4C_LAUNCHER: LAUNCHER,
      A5PTC4C_RUN: RUN,
      A5PTC4C_ASK_TTL_MS: String(ASK_TTL_MS),
      A5PTC4C_IPC: IPC_FILE,
      A5PTC4B_PROBE_LEDGER: PROBE_LEDGER,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(120_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  await waitFor(90_000, async () => { const h = await fetchJson(`${origin}/__a5ptc4c/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'closure row apply')
  check('L-BOOT', `host booted on ${HOST_PORT} with the closure row applied; the read-only downstream probe is mounted too`,
    cookie !== null && (await fetchJson(`${origin}/__a5ptc4bp/health`))?.body?.applied === true, 'both rows applied=true')

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5ptc4c-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async () => {
    const r = await api('create', { requestId: `a5ptc4c-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 90_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX', 'ATK']) S[k] = await createSession()
  const prompt = (sid, text) => api('prompt', { requestId: `a5ptc4c-r-${Math.random().toString(36).slice(2, 10)}`, sessionId: sid, mode: 'queue', content: [{ type: 'text', text }] }, 240_000)
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX', 'ATK']) await prompt(S[k], `${MK}_SET_${k} setup turn; reply OK`)
  check('L-CREATE', 'six host sessions created through the public session API (LANE, M1, M2, M3, FX, ATK — ATK is NEVER registered)', Object.values(S).every((x) => typeof x === 'string' && x.startsWith('session-')))

  const census = async (path) => (await fetchJson(`${origin}${path}`)).body
  const roster = async () => (await census('/__a5ptc4c/roster')).rows ?? []
  const grants = async () => ((await census('/__a5ptc4c/grants')).rows) ?? []
  const approvals = async () => ((await census('/__a5ptc4c/approvals')).rows) ?? []
  const pendingList = async () => ((await census('/__a5ptc4c/pending')).rows) ?? []
  const jrows = async () => ((await census('/__a5ptc4c/journal')).rows) ?? []
  const askEvents = async () => ((await census('/__a5ptc4c/ask-events')).rows) ?? []
  const routesCensus = async () => (await census('/__a5ptc4c/routes'))
  const lifecycleCensus = async () => (await census('/__a5ptc4c/lifecycle'))
  const regCensus = async () => (await census('/__a5ptc4c/registration'))
  const probeLedgerRows = async () => { try { return readFileSync(PROBE_LEDGER, 'utf8').split('\n').filter((x) => x !== '').map((x) => JSON.parse(x)) } catch { return [] } }
  const state = async () => (await census('/__a5ptc4c/state')).assemblies ?? {}
  const runsOf = async (label) => (await state())?.[label]?.runs ?? []
  const modeOf = async (sid) => (await fetchJson(`${origin}/__a5ptc4c/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })).body

  // permission baseline BEFORE anything happens (PERM invariants)
  const modePre = {}
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX', 'ATK']) modePre[k] = await modeOf(S[k])

  // ══ F-L2-1: registration through the TRUSTED LIFECYCLE CHANNEL only ═══════
  const ipcAppend = (rec) => appendFileSync(IPC_FILE, JSON.stringify(rec) + '\n')
  const nonces = { LANE: randomUUID(), M1: randomUUID(), M2: randomUUID(), M3: randomUUID(), FX: randomUUID() }
  ipcAppend({ kind: 'register', nonce: nonces.LANE, sessionId: S.LANE, role: 'lane', at: new Date().toISOString() })
  const laneRow = await waitFor(60_000, async () => (await roster()).find((x) => x.role === 'lane') ?? false, 'lane registration via lifecycle channel')
  const laneLabel = laneRow.label
  for (const [k, role] of [['M1', 'member'], ['M2', 'member'], ['M3', 'member'], ['FX', 'outsider']]) {
    ipcAppend({ kind: 'register', nonce: nonces[k], sessionId: S[k], role, at: new Date().toISOString() })
  }
  const L = {}
  for (const k of ['M1', 'M2', 'M3', 'FX']) {
    L[k] = await waitFor(60_000, async () => (await roster()).find((x) => x.sessionId === S[k])?.label ?? false, `registration of ${k}`)
  }
  const bindFor = (key, leg) => `${key}|${callIdFor(leg)}|run_code|danger-full-access`

  // channel discipline: consumed-nonce replay, already-rostered, post-seal
  const refusedBefore = (await regCensus()).refused.length
  ipcAppend({ kind: 'register', nonce: nonces.LANE, sessionId: S.ATK, role: 'lane' }) // replay of a consumed nonce
  ipcAppend({ kind: 'register', nonce: randomUUID(), sessionId: S.M1, role: 'lane' }) // already rostered: never promoted
  ipcAppend({ kind: 'seal' })
  ipcAppend({ kind: 'register', nonce: randomUUID(), sessionId: S.ATK, role: 'lane' }) // post-seal
  const refusedSeen = await pollUntil(30_000, async () => { const c = await regCensus(); return c.refused.length >= refusedBefore + 3 ? c : false }, 'three channel refusals')
  const rc = refusedSeen?.__held ? await regCensus() : refusedSeen
  const regLedger = (await jrows()).filter((x) => x.leg === 'lifecycle-register')
  const refusedReasons = regLedger.filter((x) => x.decision === 'refused').map((x) => x.reason)
  const atkRegistered = (await roster()).some((x) => x.sessionId === S.ATK)
  writeEvidence('registration-channel.json', { census: rc, ledgerRows: regLedger })
  check('F1-REG-TRUSTED-CHANNEL-ONESHOT', 'F-L2-1 core: EVERY roster entry (lane included) arrived via the assembler-private lifecycle channel (registeredVia=trusted-lifecycle-channel; one ledger decision=registered each); a replayed consumed nonce is refused, re-registering a rostered member as lane is refused (no promotion, ever), and after the assembler SEALED the channel a fresh well-formed lane registration is refused — ATK never got on the roster',
    (rc?.rows ?? []).length === 5 && (rc?.rows ?? []).every((r) => r.via === 'trusted-lifecycle-channel')
    && regLedger.filter((x) => x.decision === 'registered').length === 5
    && refusedReasons.some((r) => String(r).startsWith('replay')) && refusedReasons.some((r) => String(r).startsWith('already')) && refusedReasons.some((r) => String(r).startsWith('sealed'))
    && rc?.sealed === true && atkRegistered === false,
    `rows=${(rc?.rows ?? []).length} via=${JSON.stringify([...new Set((rc?.rows ?? []).map((r) => r.via))])} refused=${JSON.stringify(refusedReasons)} sealed=${rc?.sealed} atkOnRoster=${atkRegistered}`)

  // no HTTP face can register or mint (runner-side; in-world version is CHAINA)
  const rosterN0 = (await roster()).length
  const grantsN0 = (await grants()).length
  const facePosts = {}
  for (const p of ['/__a5ptc4b/provision', '/__a5ptc4b/grant', '/__a5ptc4c/provision', '/__a5ptc4c/grant', '/__a5ptc4c/revoke', '/__a5ptc4c/register', '/__a5ptc4cdev/provision', '/__a5ptc4cdev/grant']) {
    const r = await fetchJson(`${origin}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: S.ATK, sid: S.ATK, role: 'lane', pending_seq: 1, decision: 'allow', agent: L.M1, toolName: 'run_code', mode: 'danger-full-access', ttl_ms: 60000 }) })
    facePosts[p] = { status: r.status, body: typeof r.body === 'string' ? r.body.slice(0, 120) : r.body }
  }
  const rosterN1 = (await roster()).length
  const grantsN1 = (await grants()).length
  const routesC = await routesCensus()
  check('F1-NO-HTTP-REGISTRATION-MINT', 'F-L2-1 face closure: POSTing grant/register/provision shapes to ALL eight plausible paths (reviewed /__a5ptc4b/*, closure /__a5ptc4c/*, devkit /__a5ptc4cdev/*) produces no 2xx mutation — roster and grants ledgers move ZERO, and the route census registers mutating=0 with no mutating path anywhere',
    rosterN1 === rosterN0 && grantsN1 === grantsN0 && Object.values(facePosts).every((f) => f.status !== 200)
    && routesC.mutating === 0 && routesC.registered.every((r) => !/\/(provision|grant|revoke|register|unload)$/.test(r.path)),
    `roster=${rosterN0}->${rosterN1} grants=${grantsN0}->${grantsN1} mutating=${routesC.mutating} posts=${JSON.stringify(Object.fromEntries(Object.entries(facePosts).map(([k, v]) => [k, v.status])))}`)

  const legSay = async (verb, timeoutMs = 25_000) => {
    // queue-mode prompt RPC resolves BEFORE the lane turn's tool executes —
    // wait for THIS call's ledger row, never an earlier one (race pinned the
    // first green round: REVOKE presented before the revoke tool ran).
    const before = (await jrows()).length
    await prompt(S.LANE, `A5PTC4C_LANE_${verb}`)
    const res = await pollUntil(timeoutMs, async () => {
      const rows = await jrows()
      if (rows.length <= before) return false
      return rows.slice(before).reverse().find((x) => ['grant-minted', 'grant-revoked', 'resolver-unloaded', 'lane-refused-pending'].includes(x.leg)) ?? false
    }, 'lane ledger row')
    return res?.__held === undefined ? res : null
  }
  const laneSay = async (verb, timeoutMs = 25_000) => await legSay(verb, timeoutMs)
  const approvalsRowFor = async (callId, outcome) => (await approvals()).filter((x) => x.callId === callId && (outcome === undefined || x.outcome === outcome)).at(-1)

  // ══ F-L2-1 GREEN attack chain (mirror of the completed RED round) ═════════
  // run EARLY so no earlier leg can starve these sessions in either mode
  const rosterBefore = (await roster()).length
  const grantsBeforeChain = (await grants()).length
  await prompt(S.M1, `${MK}_CHAINA leg CHAINA`)
  const chainRes = await pollUntil(LEG_WAIT, async () => { const f = readIfExists(join(WS, 'chain-green-result.json')); return f === null ? false : JSON.parse(f) }, 'attacker program result')
  const cr = chainRes?.__held ? {} : chainRes
  const rosterAfterA = (await roster())
  const atkNow = rosterAfterA.find((x) => x.sessionId === S.ATK)
  writeEvidence('chain-green-stepA.json', { attacker: cr, rosterDelta: rosterAfterA.length - rosterBefore, atkEntry: atkNow ?? null })
  check('F1-INWORLD-ATTACK-REFUSED', 'F-L2-1 attack step 1 refused IN-WORLD: the member\'s own confined workspace-write child (same program that CONNECTED in the pre-fix round) now gets NON-2xx on the reviewed path, the closure path, the devkit path AND a mint shape; the roster census stays READABLE but gains no lane; appending to the assembler lifecycle-channel file is OS-REFUSED (EACCES — same workspace-write floor as the forbidden-directory control); the ws write still works; roster delta ZERO',
    cr?.oldFace?.status !== undefined && cr.oldFace.status !== 200 && cr?.newFace?.status !== 200 && cr?.devFace?.status !== 200 && cr?.mint?.status !== 200
    && cr?.ipcWrite === 'EACCES' && cr?.forbControl === 'EACCES' && cr?.rosterStatus === 200
    && rosterAfterA.length === rosterBefore && atkNow === undefined,
    `attacker=${JSON.stringify(cr ?? null).slice(0, 500)} rosterDelta=${rosterAfterA.length - rosterBefore}`)
  await prompt(S.ATK, `A5PTC4C_ATK_GRANT ${L.M1}|${callIdFor('CHAIN')}|run_code|danger-full-access`)
  const scanSessionsForRefusal = () => {
    const hits = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name)
        if (e.isDirectory()) { walk(p); continue }
        if (!/^session\..*\.jsonl(\.zstd)?$/.test(e.name) || statSync(p).size > 8_000_000) continue
        let text = ''
        if (p.endsWith('.zstd')) {
          const dec = spawnSync('zstd', ['-d', '-c', p], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
          text = Number(dec.status) === 0 ? String(dec.stdout) : ''
        } else text = readFileSync(p, 'utf8')
        for (const line of text.split('\n')) {
          if (line.includes('a5ptc4c_grant') && /unknown|no such|not found|not registered|unregistered|is not available/i.test(line)) hits.push({ file: p.replace(`${HOME}/`, ''), line: line.slice(0, 600) })
        }
      }
    }
    try { walk(HOME) } catch { /* capture */ }
    return hits
  }
  const atkBoundary = await pollUntil(150_000, async () => {
    const f = readIfExists(join(EVIDENCE_DIR, 'atk-mint-boundary.json'))
    if (f !== null) return JSON.parse(f)
    const hits = scanSessionsForRefusal()
    return hits.length > 0 ? { sessionLogHits: hits } : false
  }, 'ATK mint boundary capture (mock tool_result OR session log)')
  const bnd = atkBoundary?.__held ? {} : atkBoundary
  const grantsAfterMint = (await grants()).length
  const chainGrantAny = (await grants()).some((g) => g.bind?.callId === callIdFor('CHAIN'))
  writeEvidence('chain-green-stepB.json', { boundary: bnd, grantsDelta: grantsAfterMint - grantsBeforeChain, anyChainGrant: chainGrantAny })
  check('F1-ATK-MINT-DEAD', 'F-L2-1 attack step 2 refused: the attacker drives its OWN session ATK to call the lane grant tool — ATK was never registered, so NO minting tool exists on it; the refusal is observed AT THE MODEL BOUNDARY (tool result carries the unknown-tool error) and the grants ledger moves ZERO',
    ((String(bnd?.toolResultAtModelBoundary ?? '').length > 0 && /unknown|not.*found|no such|unregistered/i.test(String(bnd?.toolResultAtModelBoundary ?? '')))
      || (bnd?.sessionLogHits ?? []).length > 0)
    && !String(bnd?.toolResultAtModelBoundary ?? '').includes('A5PTC4C-GRANT g') && (bnd?.sessionLogHits ?? []).every((h) => !h.line.includes('A5PTC4C-GRANT g'))
    && grantsAfterMint === grantsBeforeChain && chainGrantAny === false,
    `boundary=${JSON.stringify(bnd ?? null).slice(0, 400)} grantsDelta=${grantsAfterMint - grantsBeforeChain}`)
  await prompt(S.M1, `${MK}_CHAIN leg CHAIN`)
  const rChain = await pollUntil(ASK_TTL_MS + 30_000, async () => approvalsRowFor(callIdFor('CHAIN'), 'rejected'), 'CHAIN consumption refusal')
  await sleep(500)
  const chainWritten = existsSync(CHAIN_TARGET)
  writeEvidence('chain-green-stepC.json', { row: rChain, written: chainWritten, target: CHAIN_TARGET })
  check('F1-CHAIN-CONSUME-REFUSED', 'F-L2-1 attack step 3 refused: the member presents the very quadruple the attack aimed at — no Grant exists (registration and mint both failed), nothing answers, the ask holds to the lane deadline → lane-timeout rejection carrying NO grantId; the forbidden target l-chain.txt DOES NOT EXIST (the RED round wrote this same file)',
    rChain !== null && rChain?.__held === undefined && (rChain?.decision === 'lane-timeout' || rChain?.decision === 'lane-refused') && rChain?.grantId === undefined
    && chainWritten === false,
    `row=${JSON.stringify(rChain ?? null).slice(0, 240)} written=${chainWritten}`)

  // ══ L2 governance suite (unchanged ids) ═══════════════════════════════════
  const fxRunsBefore = ((await state())?.[L.FX]?.runs ?? []).length
  await prompt(S.FX, `${MK}_FXCHECK outsider run_code`)
  const fxCheck = await pollUntil(LEG_WAIT, async () => { const runs = (await state())?.[L.FX]?.runs ?? []; return runs.length > fxRunsBefore ? runs.at(-1) : false }, 'FXCHECK')
  check('L-FX-RUNCODE-PRESENT', 'control: the outsider session CAN run run_code with plain workspace-write (it never needed escalation)',
    fxCheck?.__held === undefined && String(fxCheck?.text ?? '').includes('FX-RAN') && existsSync(join(WS, 'fx-fxpre-fxcanary.txt')),
    `held=${fxCheck?.__held ?? false} text=${String(fxCheck?.text ?? '').slice(0, 200)}`)
  const sbx = await fetchJson(`${origin}/__a5ptc4c/sandbox`).catch(() => null)
  check('L-LAUNCHER-DEPLOY', 'the launcher path is deployed via the provider PUBLIC internals test-hook (same mechanism as L1/L2)',
    sbx?.body?.landlockLauncher === LAUNCHER, `selectedRunner=${sbx?.body?.selectedRunner} enforcement=${sbx?.body?.enforcement}`)

  // ANCHOR
  const runsBeforeAnchor = (await runsOf(L.M1)).length
  await prompt(S.M1, `${MK}_ANCHOR leg ANCHOR`)
  const anchorPending = await pollUntil(20_000, async () => (await pendingList()).find((x) => x.bind?.callId === callIdFor('ANCHOR')) ?? false, 'anchor ask pending')
  const aPending = anchorPending?.__held === undefined ? anchorPending : null
  await legSay(`ALLOW_PENDING ${aPending?.seq ?? 999}`)
  const anchorRow = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('ANCHOR'), 'allowed-once'), 'anchor allowed-once row')
  const rAnchor = await pollUntil(LEG_WAIT, async () => { const runs = await runsOf(L.M1); const hit = runs.slice(runsBeforeAnchor).find((x) => String(x?.text ?? '').includes('A5PTC4C-BODY-RAN')); return hit ?? false }, 'anchor run')
  const anchorWritten = existsSync(FORB_TARGET('anchor'))
  writeEvidence('leg-ANCHOR.json', { pending: aPending, anchorRow, run: rAnchor?.__held ? null : rAnchor, written: anchorWritten })
  check('ANCHOR-TEAM-GRANT-ALLOWED-ONCE', 'positive anchor: lane ask-bound Grant (bindings copied from the HOST ask record) → allowed-once; the confined outer program really wrote the forbidden zone through the escalation path; the Grant is consumed',
    anchorRow?.decision === 'lane-allow@pending' && anchorRow?.grantSource === 'ask-bound'
    && rAnchor?.__held === undefined && anchorWritten,
    `row=${JSON.stringify(anchorRow ?? null).slice(0, 260)} written=${anchorWritten}`)
  const anchorGrant = (await grants()).find((g) => g.bind?.callId === callIdFor('ANCHOR'))

  // NEG1 REPLAY
  const grantsAfterAnchor = (await grants()).length
  const runsBeforeReplay = (await runsOf(L.M1)).length
  await prompt(S.M1, `${MK}_REPLAY leg REPLAY`)
  const rReplay = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('REPLAY'), 'rejected'), 'replay decision row')
  await sleep(800)
  const runsAfterReplay = (await runsOf(L.M1)).length
  writeEvidence('leg-REPLAY.json', { row: rReplay, grantsDelta: (await grants()).length - grantsAfterAnchor, runsDelta: runsAfterReplay - runsBeforeReplay, written: existsSync(FORB_TARGET('replay')) })
  check('NEG1-REPLAY-REFUSED', 'NC-1 REPLAY (F-2): the SAME agent/callId/toolName/mode presented AGAIN → decision=replay-of-consumed outcome=rejected straight from the consumed record; the dead L1 token text inside the justification is LOG ONLY (modelTextLog) and never consulted; NO new Grant minted, NO new run, zero writes',
    rReplay?.__held === undefined && rReplay?.decision === 'replay-of-consumed' && rReplay?.grantId === anchorGrant?.grantId
    && String(rReplay?.modelTextLog ?? '').includes('A5PTC4-TOKEN') && (await grants()).length === grantsAfterAnchor
    && !(await runsOf(L.M1)).slice(runsBeforeReplay).some((x) => String(x?.text ?? '').includes('A5PTC4C-BODY-RAN'))
    && !existsSync(FORB_TARGET('replay')),
    `row=${JSON.stringify(rReplay ?? null).slice(0, 300)} grantsDelta=${(await grants()).length - grantsAfterAnchor} runsDelta=${runsAfterReplay - runsBeforeReplay} written=${existsSync(FORB_TARGET('replay'))}`)

  // NEG2 EXPIRY
  await laneSay(`ALLOW_PAST 1200 ${bindFor(L.M1, 'EXPIRY')}`)
  const expG = (await grants()).find((g) => g.bind?.callId === callIdFor('EXPIRY'))
  await sleep(1700)
  const expStateBefore = (await grants()).find((g) => g.grantId === expG?.grantId)?.state
  await prompt(S.M1, `${MK}_EXPIRY leg EXPIRY`)
  const rExpiry = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('EXPIRY'), 'rejected'), 'EXPIRY decision row')
  const expState = (await grants()).find((g) => g.grantId === expG?.grantId)?.state
  writeEvidence('leg-EXPIRY.json', { grantId: expG?.grantId, ttlMs: expG?.ttlMs, stateBeforePresent: expStateBefore, stateAfterPresent: expState, row: rExpiry, written: existsSync(FORB_TARGET('expiry')) })
  check('NEG2-EXPIRED-REFUSED-DOWNSTREAM-VISIBLE', 'NC-2 EXPIRY (T-4, F-4): declared allow with a 1200 ms TTL lapses before presentation → decision=expired outcome=rejected carrying the grantId and expiredAt, the record transitioned to state=expired (TTL is lazily enforced AT adjudication — never a silent pass), zero writes',
    rExpiry?.__held === undefined && rExpiry?.decision === 'expired' && rExpiry?.grantId === expG?.grantId && expState === 'expired' && !existsSync(FORB_TARGET('expiry')),
    `ttl=${expG?.ttlMs} stateBefore=${expStateBefore} stateAfter=${expState} row=${JSON.stringify(rExpiry ?? null).slice(0, 240)} written=${existsSync(FORB_TARGET('expiry'))}`)

  // NEG4 REVOCATION BEFORE USE
  await laneSay(`ALLOW_FUTURE ${bindFor(L.M1, 'REVOKE')} 60000`)
  const revG = (await grants()).find((g) => g.bind?.callId === callIdFor('REVOKE') && g.state === 'issued')
  const rRevoke = await legSay(`REVOKE ${revG?.grantId ?? 'missing'}`)
  const revState = (await grants()).find((g) => g.grantId === revG?.grantId)?.state
  await prompt(S.M1, `${MK}_REVOKE leg REVOKE`)
  const rRevokePresent = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('REVOKE'), 'rejected'), 'REVOKE decision row')
  writeEvidence('leg-REVOKE.json', { grantId: revG?.grantId, revoked: rRevoke, stateAfterRevoke: revState, row: rRevokePresent, written: existsSync(FORB_TARGET('revoke')) })
  check('NEG4-REVOKED-BEFORE-USE-REFUSED', 'NC-4 REVOCATION BEFORE USE (F-3): a live Grant revoked BEFORE presentation → decision=revoked outcome=rejected straight from the revoked record (GRANTS FIRST — no cache could answer with the stale allow), zero writes',
    rRevoke?.leg === 'grant-revoked' && revState === 'revoked'
    && rRevokePresent?.__held === undefined && rRevokePresent?.decision === 'revoked'
    && !existsSync(FORB_TARGET('revoke')),
    `stateAfterRevoke=${revState} row=${JSON.stringify(rRevokePresent ?? null).slice(0, 240)} written=${existsSync(FORB_TARGET('revoke'))}`)

  // NEG5 MODE BIND
  await laneSay(`ALLOW_FUTURE ${L.M1}|${callIdFor('BIND')}|run_code|workspace-write 60000`)
  const bindG = (await grants()).find((g) => g.bind?.callId === callIdFor('BIND'))
  await prompt(S.M1, `${MK}_BIND leg BIND`)
  const bindPending = await pollUntil(ASK_TTL_MS + 15_000, async () => (await pendingList()).find((x) => x.bind?.callId === callIdFor('BIND')) ?? false, 'BIND ask pending', )
  const bindHeld = bindPending?.__held === undefined
  const rBind = await pollUntil(ASK_TTL_MS + 30_000, async () => approvalsRowFor(callIdFor('BIND'), 'rejected'), 'BIND lane-timeout row')
  writeEvidence('leg-BIND.json', { grantId: bindG?.grantId, grantBindMode: bindG?.bind?.mode, row: rBind, heldToLaneDeadline: bindHeld, written: existsSync(FORB_TARGET('bind')) })
  check('NEG5-MODE-BIND-MISMATCH-REFUSED', 'NC-5 MODE BIND: a Grant declared for the same agent|callId|toolName but mode=workspace-write may NOT answer an ask requesting danger-full-access — mode is part of the four-way identity; no record could answer (the ask held to the lane deadline); zero writes',
    bindG?.bind?.mode === 'workspace-write' && rBind?.__held === undefined && (rBind?.decision === 'lane-timeout' || rBind?.decision === 'lane-refused') && rBind?.grantId === undefined
    && !existsSync(FORB_TARGET('bind')),
    `grantMode=${bindG?.bind?.mode} row=${JSON.stringify(rBind ?? null).slice(0, 240)} written=${existsSync(FORB_TARGET('bind'))}`)

  // NEG3 OTHER-TEAM
  const grantsBeforeX = (await grants()).length
  await laneSay(`ALLOW_FUTURE ${bindFor(L.M1, 'XTEAM')} 20000`)
  const xg = (await grants()).find((g) => g.bind?.callId === callIdFor('XTEAM') && g.state === 'issued')
  await prompt(S.M3, `${MK}_XTEAM leg XTEAM`)
  const rXForeign = await pollUntil(ASK_TTL_MS + 30_000, async () => (await approvals()).find((x) => x.callId === callIdFor('XTEAM') && x.agent === L.M3 && x.outcome === 'rejected') ?? false, 'M3 foreign ask row')
  const xgAfterForeign = (await grants()).find((g) => g.grantId === xg?.grantId)
  writeEvidence('leg-XTEAM.json', { grantId: xg?.grantId, foreignAsk: rXForeign, grantStateAfterForeign: xgAfterForeign?.state, grantsDelta: (await grants()).length - grantsBeforeX, writtenForeign: existsSync(FORB_TARGET('xteam')) })
  check('NEG3-AGENT-BIND-GRANT-UNSPENT-AND-OWNER-ONLY', 'NC-3 TEAM BIND (F-1): M3 presenting the callId whose live Grant is bound to M1 → our lane ANSWERS NOTHING (M3 owns no Grant ⇒ nothing answers ⇒ held to the lane deadline; zero answers, zero writes) AND the Grant stays untouched (state=issued, consumedAt=null)',
    rXForeign?.__held === undefined && rXForeign?.grantId === undefined && (rXForeign?.decision === 'lane-timeout' || rXForeign?.decision === 'lane-refused')
    && xgAfterForeign?.state === 'issued' && xgAfterForeign?.consumedAt === null && !existsSync(FORB_TARGET('xteam')),
    `foreignAsk=${JSON.stringify(rXForeign ?? null).slice(0, 240)} grantState=${xgAfterForeign?.state} consumedAt=${xgAfterForeign?.consumedAt} written=${existsSync(FORB_TARGET('xteam'))}`)
  await prompt(S.M1, `${MK}_XTEAMUSE leg XTEAMUSE`)
  const rXOwner = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('XTEAM'), 'allowed-once'), 'M1 owner-side XTEAM row')
  // Reviewer precision (a): the authorized write can land ~tens of ms AFTER the decision
  // row appears (reviewer measured +58 ms, file verified on disk). BOUNDED-POLL the
  // landing — the criterion is NOT relaxed (still must observe the write; a timeout fails).
  const ownerLanding = await pollUntil(LEG_WAIT, async () => (existsSync(FORB_TARGET('xteam'))
    ? { file: 'l-xteam.txt', size: statSync(FORB_TARGET('xteam')).size, mtimeMs: statSync(FORB_TARGET('xteam')).mtimeMs, decisionRowAt: rXOwner?.at ?? null }
    : false), 'XTEAM owner write landing (bounded poll; criterion unchanged)')
  const ownerWritten = ownerLanding?.__held === undefined
  const xgAfterOwner = (await grants()).find((g) => g.grantId === xg?.grantId)
  writeEvidence('leg-XTEAMUSE.json', { row: rXOwner, grantStateAfterOwner: xgAfterOwner?.state, written: ownerWritten, writeLanding: ownerLanding?.__held === undefined ? ownerLanding : { timedOut: true } })
  check('NEG3-AGENT-BIND-GRANT-UNSPENT-AND-OWNER-ONLY', 'NC-3 second half: the OWNER M1 presenting the same quadruple consumes the Grant (allowed-once, state=consumed, write lands)',
    rXOwner?.__held === undefined && rXOwner?.grantId === xg?.grantId && xgAfterOwner?.state === 'consumed' && ownerWritten,
    `row=${JSON.stringify(rXOwner ?? null).slice(0, 240)} state=${xgAfterOwner?.state} written=${ownerWritten}`)

  // CONCURRENCY
  await prompt(S.M1, `${MK}_Q1 leg Q1`)
  await prompt(S.M2, `${MK}_Q2 leg Q2`)
  const concPending = await pollUntil(20_000, async () => { const p = await pendingList(); return p.length >= 2 ? p : false }, 'two asks concurrently pending')
  const p1 = Array.isArray(concPending) ? concPending.find((x) => x.bind?.callId === callIdFor('Q1')) : undefined
  const p2 = Array.isArray(concPending) ? concPending.find((x) => x.bind?.callId === callIdFor('Q2')) : undefined
  await legSay(`ALLOW_PENDING ${p1?.seq ?? 997}`)
  await legSay(`DENY_PENDING ${p2?.seq ?? 998}`)
  const rowQ1 = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('Q1'), 'allowed-once'), 'Q1 allowed-once row')
  const rowQ2 = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('Q2'), 'rejected'), 'Q2 rejected row')
  writeEvidence('leg-Q1-Q2.json', { rowQ1, rowQ2, p1: p1?.seq, p2: p2?.seq })
  check('CONCURRENCY-ISOLATION', 'concurrency: M1 and M2 asks pending at once; each settled ONLY by its own seq-decision (Q1 lane-allow@pending/allowed-once, Q2 lane-reject@pending/rejected); neither borrowed the other',
    Array.isArray(concPending) && p1 !== undefined && p2 !== undefined
    && rowQ1?.decision === 'lane-allow@pending' && rowQ1?.grantSource === 'ask-bound'
    && rowQ2?.decision === 'lane-reject@pending',
    `rowQ1=${JSON.stringify(rowQ1 ?? null).slice(0, 200)} rowQ2=${JSON.stringify(rowQ2 ?? null).slice(0, 200)}`)

  // DELEG (foreign → verbatim downstream, zero answers from us)
  await prompt(S.FX, `${MK}_DELEG outsider escalation`)
  const fxDeleg = await pollUntil(LEG_WAIT, async () => (await approvals()).find((x) => x.agent === L.FX && x.decision === 'foreign') ?? false, 'our foreign row')
  const askEventsNow = await askEvents()
  const fxAsked = askEventsNow.filter((x) => x.type === 'approval/asked' && String(x.callId ?? '').startsWith(`call-${MK}-DELEG`))
  const probeSaw = (await probeLedgerRows()).filter((r) => r.callId === callIdFor('DELEG'))
  const fxDecided = askEventsNow.filter((x) => x.type === 'approval/decided' && x.approvalId != null && x.approvalId === fxAsked[0]?.approvalId)
  writeEvidence('leg-DELEG.json', { foreignRow: fxDeleg, hostAskLaneMirror: fxAsked, downstreamProbeSaw: probeSaw, hostDecided: fxDecided, written: existsSync(FORB_TARGET('deleg')) })
  check('DELEG-ZERO-ANSWER-VERBATIM-DOWNSTREAM', 'delegation integrity (root point 2): FX is rostered as outsider ⇒ our ledger holds ONLY decision=foreign/pass-through (zero answers); the HOST ask lane received the SAME callId with an UNREWRITTEN reason (verbatim downlink) and nothing decided it (no approval/decided) ⇒ it still sits in the host lane for the real human; zero writes',
    fxDeleg?.__held === undefined && fxDeleg?.decision === 'foreign' && fxAsked.length >= 1
    && fxAsked.some((x) => String(x.reason ?? '').includes('a5ptc4c DELEG: outsider leg')) && fxDecided.length === 0
    && !existsSync(FORB_TARGET('deleg')),
    `foreign=${JSON.stringify(fxDeleg ?? null).slice(0, 180)} hostAsked=${JSON.stringify(fxAsked).slice(0, 300)} decided=${fxDecided.length} probe=${probeSaw.length} written=${existsSync(FORB_TARGET('deleg'))}`)

  // honest path undisturbed AFTER the refusals (governance: fails in RED)
  await prompt(S.M3, `${MK}_PANCHOR leg PANCHOR`)
  const pAnchorPending = await pollUntil(20_000, async () => (await pendingList()).find((x) => x.bind?.callId === callIdFor('PANCHOR')) ?? false, 'post-attack anchor pending')
  const paPending = pAnchorPending?.__held === undefined ? pAnchorPending : null
  await legSay(`ALLOW_PENDING ${paPending?.seq ?? 996}`)
  const paRow = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('PANCHOR'), 'allowed-once'), 'post-attack anchor row')
  const paWritten = await pollUntil(30_000, async () => existsSync(FORB_TARGET('panchor')) ? true : false, 'post-attack write')
  writeEvidence('leg-PANCHOR.json', { pending: paPending, row: paRow, written: paWritten })
  check('F1-DELEGATION-PATH-UNDISTURBED', 'the fix did not break the honest delegation path: AFTER every attack leg was refused, a fresh M3 ask is answered by the trusted-registered lane (ask-bound Grant from the HOST ask record) → allowed-once with the write landing',
    paRow?.decision === 'lane-allow@pending' && paWritten === true,
    `row=${JSON.stringify(paRow ?? null).slice(0, 240)} written=${paWritten}`)

  // ══ F-L2-2 lifecycle: unload → ghost → install → uninstall-all → reinstall ═
  const hooksBeforeUnload = await census('/__a5ptc4c/hooks')
  const rUnload = await legSay('UNLOAD')
  const hooksAfterUnload = await census('/__a5ptc4c/hooks')
  await prompt(S.M1, `${MK}_UNLOADAFTER leg UNLOADAFTER`)
  const unloadRows = (await approvals()).filter((x) => x.callId === callIdFor('UNLOADAFTER'))
  const rUnloadAfter = await pollUntil(MODE === 'green' ? 20_000 : 12_000, async () => { const runs = await runsOf(L.M1); const hit = (runs ?? []).find((x) => String(x?.text ?? '').includes('UNLOADAFTER-body')); return hit ?? false }, 'UNLOADAFTER run (must NOT happen)')
  const unloadJournal = (await jrows()).filter((x) => x.leg === 'resolver-unloaded').at(-1)
  writeEvidence('leg-UNLOAD.json', { hooksBeforeUnload, hooksAfterUnload, journal: unloadJournal ?? null, ourRowsAfterUnload: unloadRows, runAfterUnload: rUnloadAfter?.__held ? null : rUnloadAfter, written: existsSync(FORB_TARGET('unloadafter')) })
  const mineOf = (hc) => (hc?.rows ?? []).filter((r) => r.tag !== null).length
  const mineBefore = mineOf(hooksBeforeUnload)
  const mineAfter = mineOf(hooksAfterUnload)
  check('T5-UNLOAD-SYMMETRIC-AND-DEAD', 'T-5 unload symmetry still holds on the closure row: the lane\'s own tool call runs the retained disposers, our approval/request faces go to ZERO, and the NEXT in-domain ask is answered by us ZERO times (no ledger row, no tool result) with zero writes',
    unloadJournal !== undefined && mineBefore >= 2 && mineAfter === 0
    && (hooksAfterUnload?.count ?? 0) <= (hooksBeforeUnload?.count ?? 0) - 2
    && (unloadJournal?.disposersRun ?? 0) >= 2 && unloadRows.length === 0 && rUnloadAfter?.__held !== undefined
    && !existsSync(FORB_TARGET('unloadafter')),
    `mineBefore=${mineBefore} mineAfter=${mineAfter} hooks=${hooksBeforeUnload?.count}->${hooksAfterUnload?.count} disposersRun=${unloadJournal?.disposersRun} rowsAfter=${unloadRows.length} written=${existsSync(FORB_TARGET('unloadafter'))}`)
  check('F2-UNLOAD-BURNS-MEMBER-FACES', 'F-L2-2 core: the SAME unload also ran the REAL disposers of every MEMBER\'s own agent-ctx approval face (the L2 row only flag-gated those); the ledger counts them (memberFaces>=3), and the ghost check above (zero answers, zero rows) proves they are dead, not merely quiet',
    (unloadJournal?.memberFaces ?? 0) >= 3,
    `memberFacesDisposed=${unloadJournal?.memberFaces}`)

  // install #1 (rebuild after T5) — faces back to exactly the installed count
  const installsBefore1 = (await jrows()).filter((x) => x.leg === 'lifecycle-install').length
  ipcAppend({ kind: 'lifecycle', op: 'install' })
  const li1 = await pollUntil(30_000, async () => { const rs = (await jrows()).filter((x) => x.leg === 'lifecycle-install'); return rs.length > installsBefore1 ? rs.at(-1) : false }, 'install #1 journal row')
  const hooksRe1 = await census('/__a5ptc4c/hooks')
  const mineRe1 = mineOf(hooksRe1)

  // uninstall-all: must dispose BOTH tiers from the just-rebuilt live set
  const uaBefore = (await jrows()).filter((x) => x.leg === 'lifecycle-uninstall-all').length
  ipcAppend({ kind: 'lifecycle', op: 'uninstall-all' })
  const uaJournal = await pollUntil(30_000, async () => { const rs = (await jrows()).filter((x) => x.leg === 'lifecycle-uninstall-all'); return rs.length > uaBefore ? rs.at(-1) : false }, 'uninstall-all journal row')
  const ua = uaJournal?.__held === undefined ? uaJournal : null
  await prompt(S.M2, `${MK}_GHOST leg GHOST`)
  await sleep(3000)
  const ghostRows = (await approvals()).filter((x) => x.callId === callIdFor('GHOST'))
  const ghostWritten = existsSync(GHOST_TARGET)
  const routesAfter = await routesCensus()
  const grantsBeforePostProbes = (await grants()).length
  const rosterBeforePostProbes = (await roster()).length
  const postProbes = {}
  for (const p of ['/__a5ptc4c/health', '/__a5ptc4c/roster', '/__a5ptc4c/grants', '/__a5ptc4c/approvals', '/__a5ptc4c/hooks', '/__a5ptc4c/pending', '/__a5ptc4c/registration', '/__a5ptc4c/lifecycle']) {
    const r = await fetchJson(`${origin}${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grant_id: 'g1', decision: 'allow', sessionId: S.ATK, role: 'lane' }) })
    postProbes[p] = r.status
  }
  const grantsAfterPost = (await grants()).length
  const rosterAfterPost = (await roster()).length
  const lc = await lifecycleCensus()
  writeEvidence('residue-disclosure.json', {
    lifecycleCensus: lc,
    routesAfterUninstall: routesAfter.registered.map((r) => ({ path: r.path, disposed: r.disposed })),
    postProbeStatuses: postProbes,
    grantsDeltaAfterPostProbes: grantsAfterPost - grantsBeforePostProbes,
    rosterDeltaAfterPostProbes: rosterAfterPost - rosterBeforePostProbes,
    ghost: { rows: ghostRows, written: ghostWritten },
  })
  check('F2-UNINSTALL-ALL-NO-RESIDUE', 'F-L2-2 residue: the channel\'s uninstall-all ran BOTH tiers (adjudication including every member face, plus witnesses and lane tools; ledger counts >0 on both), the in-domain ask afterwards gets ZERO answers and zero writes, and the ONLY residue is the DISCLOSED read-only set (census faces + sealed channel listener + audit ledger) — POSTing grant/revoke/register shapes to every surviving census face changes NOTHING (grants/roster deltas zero)',
    ua !== null && (ua?.adjudicationDisposed ?? 0) >= 3 && (ua?.lifeDisposed ?? 0) >= 4
    && ghostRows.length === 0 && ghostWritten === false
    && (lc?.residueAfterUninstall?.length ?? 0) >= 3 && grantsAfterPost === grantsBeforePostProbes && rosterAfterPost === rosterBeforePostProbes,
    `install1=${JSON.stringify(li1?.__held === undefined ? { faces: li1?.faces, liveFaces: li1?.liveFaces } : null)} adj=${ua?.adjudicationDisposed} life=${ua?.lifeDisposed} ghostRows=${ghostRows.length} written=${ghostWritten} residue=${lc?.residueAfterUninstall?.length} posts=${JSON.stringify(postProbes)}`)

  // reinstall: exactly-once, no ghosts, no double faces
  const installsBefore2 = (await jrows()).filter((x) => x.leg === 'lifecycle-install').length
  ipcAppend({ kind: 'lifecycle', op: 'install' })
  const liJournal = await pollUntil(30_000, async () => { const rs = (await jrows()).filter((x) => x.leg === 'lifecycle-install'); return rs.length > installsBefore2 ? rs.at(-1) : false }, 'install #2 journal row')
  const li = liJournal?.__held === undefined ? liJournal : null
  const hooksRe = await census('/__a5ptc4c/hooks')
  const mineRe = mineOf(hooksRe)
  await prompt(S.M3, `${MK}_Q3 leg Q3`)
  const q3Pending = await pollUntil(20_000, async () => (await pendingList()).find((x) => x.bind?.callId === callIdFor('Q3')) ?? false, 'Q3 pending after reinstall')
  const q3p = q3Pending?.__held === undefined ? q3Pending : null
  await legSay(`ALLOW_PENDING ${q3p?.seq ?? 995}`)
  const q3Row = await pollUntil(LEG_WAIT, async () => approvalsRowFor(callIdFor('Q3'), 'allowed-once'), 'Q3 allowed-once row')
  const q3Written = await pollUntil(30_000, async () => existsSync(FORB_TARGET('q3')) ? true : false, 'Q3 write')
  const q3RowsAll = (await approvals()).filter((x) => x.callId === callIdFor('Q3'))
  const q3Decided = q3RowsAll.filter((x) => x.outcome === 'allowed-once' || x.outcome === 'rejected').length
  const alreadyRows = (await jrows()).filter((x) => x.decision === 'already-decided-at-another-face' && x.callId === callIdFor('Q3'))
  writeEvidence('leg-REINSTALL.json', { install1: li1?.__held === undefined ? li1 : null, install2: li, hooks: hooksRe, mineRe, pending: q3p, row: q3Row, written: q3Written, allRows: q3RowsAll, alreadyRows })
  check('F2-REINSTALL-EXACTLY-ONCE', 'F-L2-2 lifecycle regression (install→uninstall→reinstall): after each channel install the hook census shows OUR faces at EXACTLY the installed count (never doubled); the next ask is answered (ask-bound Grant allowed-once, write lands) and produced exactly ONE decided ledger row for its callId with no already-decided duplicates ⇒ no ghost answers during the dead window and no double adjudication after reinstall',
    li !== null && li1?.__held === undefined && mineRe1 === mineBefore && mineRe === mineBefore
    && q3Row?.decision === 'lane-allow@pending' && q3Written === true
    && q3Decided === 1 && alreadyRows.length === 0,
    `mineBefore=${mineBefore} mineRe1=${mineRe1} mineRe=${mineRe} row=${JSON.stringify(q3Row ?? null).slice(0, 200)} decidedRows=${q3Decided} alreadyRows=${alreadyRows.length} written=${q3Written}`)

  // final censuses + governance audit + PERM
  const hooksFinal = await census('/__a5ptc4c/hooks')
  const approvalsFinal = await approvals()
  const grantsFinal = await grants()
  writeEvidence('hooks-final.json', hooksFinal)
  writeEvidence('census-approvals-final.json', approvalsFinal)
  writeEvidence('census-grants-final.json', grantsFinal)
  writeEvidence('census-journal-final.json', await jrows())
  const decided = approvalsFinal.filter((x) => x.outcome === 'allowed-once' || x.outcome === 'rejected')
  const decidedFromGrant = decided.filter((x) => x.grantId !== undefined)
  const decidedNoGrantAnswered = decided.filter((x) => x.grantId === undefined && x.decision !== 'foreign' && !/^lane-(timeout|refused|reject)/.test(String(x.decision)))
  const rosterFinal = await roster()
  const allViaChannel = rosterFinal.length > 0 && rosterFinal.every((r) => r.registeredVia === 'trusted-lifecycle-channel')
  check('GOV-ADJUDICATION-INPUT-IS-TEAM-GRANT-ONLY', 'root governance claim, machine-checked: every Grant was minted by the trusted-registered lane actor\'s tool call; every answer traces to a grantId or an explicit no-answer posture (lane-timeout/lane-refused/foreign); no decision on model text (token-text rows are log-only); no HTTP face minted or registered anything; the whole roster came from the trusted channel',
    allGrantsOk(grantsFinal, laneLabel) && decided.length > 0 && decidedNoGrantAnswered.length === 0
    && decidedFromGrant.every((x) => grantsFinal.some((g) => g.grantId === x.grantId))
    && approvalsFinal.filter((x) => String(x.modelTextLog ?? '').includes('A5PTC4-TOKEN')).every((x) => x.decision === 'replay-of-consumed' || x.decision === 'foreign')
    && (MODE === 'red' || allViaChannel),
    `grants=${grantsFinal.length} via=${JSON.stringify([...new Set(grantsFinal.map((g) => g.via))])} issuer=${JSON.stringify([...new Set(grantsFinal.map((g) => g.issuerLane?.label))])} answeredRows=${decided.length} unexplained=${JSON.stringify(decidedNoGrantAnswered.map((x) => ({ d: x.decision, o: x.outcome })))} rosterVia=${JSON.stringify([...new Set(rosterFinal.map((r) => r.registeredVia))])}`)
  const modePost = {}
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX', 'ATK']) modePost[k] = await modeOf(S[k])
  const forbFinal = (() => { try { return readdirSync(FORB) } catch { return [] } })()
  const controlled = new Set(['secret.txt', 'os-direct-deny.txt', 'ipc-control.txt',
    'l-anchor.txt', 'l-replay.txt', 'l-expiry.txt', 'l-revoke.txt', 'l-bind.txt', 'l-xteam.txt',
    'l-fxpre.txt', 'l-q1.txt', 'l-q2.txt', 'l-deleg.txt', 'l-unloadafter.txt',
    'l-panchor.txt', 'l-chain.txt', 'l-ghost.txt', 'l-q3.txt'])
  const unexpected = forbFinal.filter((n) => !controlled.has(n))
  const refusedNoWrite = ['l-replay.txt', 'l-expiry.txt', 'l-revoke.txt', 'l-bind.txt', 'l-deleg.txt', 'l-unloadafter.txt', 'l-chain.txt', 'l-ghost.txt']
  const secretAfter = readIfExists(SECRET)
  writeEvidence('perm-final.json', { modePre, modePost, forbFinal, unexpected, refusedWrites: refusedNoWrite.filter((n) => existsSync(join(FORB, n))), secretUnchanged: sha256(Buffer.from(String(secretAfter))) === secretShaPre })
  check('PERM-ORIGINAL-NOT-LOWERED-NOT-WIDENED', 'original permissions not lowered/not widened: per-session sandbox.mode AND approvalPolicy byte-identical before/after across all six sessions (host session-init values, never written by this kit); the forbidden zone holds ONLY controlled file names; EVERY refused leg (including the attack-chain target) wrote nothing; secret.txt byte-identical',
    ['LANE', 'M1', 'M2', 'M3', 'FX', 'ATK'].every((k) => modePost[k]?.mode === 'workspace-write' && modePost[k]?.approvalPolicy === 'ask'
      && `${modePre[k]?.mode}/${modePre[k]?.approvalPolicy}` === `${modePost[k]?.mode}/${modePost[k]?.approvalPolicy}`)
    && unexpected.length === 0 && refusedNoWrite.every((n) => !existsSync(join(FORB, n)))
    && sha256(Buffer.from(String(secretAfter))) === secretShaPre,
    `modes=${JSON.stringify(Object.fromEntries(Object.entries(modePost).map(([k, v]) => [k, `${v?.mode}/${v?.approvalPolicy}`])))} unexpected=${JSON.stringify(unexpected)} refusedButWritten=${JSON.stringify(refusedNoWrite.filter((n) => existsSync(join(FORB, n))))} secretUnchanged=${sha256(Buffer.from(String(secretAfter))) === secretShaPre}`)
  const stableAfter = await stableProbe()
  check('P-STABLE-UNTOUCHED', `:3080 stable instance untouched (pre=${stableBefore} post=${stableAfter}); this kit bound only ${HOST_PORT}`,
    stableBefore === stableAfter && stableBefore === 401, `pre=${stableBefore} post=${stableAfter}`)
  const pinnedHeadPost = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  check('P-PRISTINE-POST', 'pinned host tree byte-clean after the run (HEAD unchanged, porcelain empty)',
    pinnedHeadPost === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', `head=${pinnedHeadPost.slice(0, 12)}`)

  const passCount = CRITERIA.filter((c) => c.pass).length
  const gov = CRITERIA.filter((c) => c.governance)
  const govTotal = new Set(gov.map((c) => c.id)).size
  const govPass = new Set(gov.filter((c) => c.pass).map((c) => c.id)).size
  const govFail = new Set(gov.filter((c) => !c.pass).map((c) => c.id)).size
  const nonGovFail = CRITERIA.filter((c) => !c.governance && !c.pass)
  console.log(`\n[${MODE.toUpperCase()}] criteria: ${passCount}/${CRITERIA.length} pass; governance set ${govPass}/${govTotal}`)
  let ok
  if (MODE === 'green') ok = nonGovFail.length === 0 && govFail === 0
  else ok = nonGovFail.length === 0 && govFail === govTotal
  console.log(`[${MODE.toUpperCase()}] verdict: ${ok ? 'EXPECTED' : 'DEVIATION'} (nonGovernanceFail=${nonGovFail.length} governanceFail=${govFail}/${govTotal})`)
  await finalize(ok ? (MODE === 'green' ? 'GREEN-ALL-PASS' : 'RED-ALL-EXPECTED-FAIL') : 'SOME-DEVIATION')
  process.exit(ok ? 0 : 2)
}

function allGrantsOk(grantsArr, laneLabel2) {
  return grantsArr.every((g) => g.via === 'team-lane-tool' && g.issuerLane?.label === laneLabel2 && g.issuerLane?.role === 'lane')
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { writeEvidence('fatal.json', { message: String(error?.message ?? error), criteriaSoFar: CRITERIA }) } catch { /* last resort */ }
  await finalize('FATAL')
  process.exit(1)
})
