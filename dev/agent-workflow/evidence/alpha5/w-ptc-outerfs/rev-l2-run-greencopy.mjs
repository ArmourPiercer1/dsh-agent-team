#!/usr/bin/env node
/**
 * run-a5ptc4b-l2.mjs — W-PTC-OUTERFS-L2 LIVE runner: per-call fs governance under
 * REAL one-time TEAM-PLANE Grants (fixes T-1..T-5 of review-SECURITY.md, whose
 * five negative controls are reproduced RED against the reviewed L1 row by
 * run-a5ptc4-rev.mjs and must be GREEN here).
 *
 * World shape (all sessions created through the host's public session API):
 *   LANE  = the Team ask-lane actor (leader/human-resolver stand-in). The ONLY
 *           identity that can mint/revoke/unload: it does so as its OWN tool
 *           calls (a5ptc4b_grant / _revoke / _unload) through the authenticated
 *           host API. No HTTP face can do any of that.
 *   M1/M2 = Team members whose escalation asks this lane adjudicates.
 *   M3    = "other team" stand-in: also rostered, but owns NO grant of M1's.
 *   FX    = never provisioned: an ask from it is out of domain → delegated.
 *   probe = downstream ask-lane observer (GUI/remote-bridge stand-in, behind us).
 *
 * Legs → criteria:
 *   ANCHOR   positive anchor: lane ask-bound one-time Grant → allowed-once, the
 *            forbidden write really lands, the record is spent (state=consumed).
 *   NEG-1 REPLAY   same bound quadruple re-presented (and its justification
 *            carries the OLD L1 token text verbatim, to prove the token channel
 *            is dead) → refused, zero writes.
 *   NEG-2 EXPIRY   declared Grant with a short TTL, presented after it lapses →
 *            refused, downstream-visible verbatim text, zero writes.
 *   NEG-3 AGENT-BIND  M3 presents the callId a live Grant is bound to M1 for →
 *            nothing may answer from that record, the Grant must stay UNCONSUMED,
 *            zero writes; then M1 himself presents it and it works (the binding
 *            really points at its owner).
 *   NEG-4 REVOCATION a live Grant revoked before use → refused, zero writes
 *            (the L1 cache-first shape answered this with a stale allow).
 *   NEG-5 MODE-BIND  Grant declared for the same agent/callId/toolName but mode
 *            workspace-write, ask requests danger-full-access → no record may
 *            answer → lane deadline refusal (T-4), zero writes.
 *   DELEG    foreign out-of-domain ask: we answer ZERO, the ask lands downstream
 *            VERBATIM (callId+reason byte-equal at the probe), refused there.
 *   CONC     M1 (allow) ∥ M2 (reject): each ask decided only by its own Grant.
 *   T5       the lane unloads the resolver → hook census proves the
 *            {global,prepend} face is gone → the next in-domain ask is answered
 *            by us ZERO times and is refused downstream, zero writes.
 *   PERM     original permissions not lowered: per-session mode AND approval
 *            policy constant before/after, kit writes no mode/policy anywhere,
 *            secret byte-identical, forbidden dir holds only controlled files.
 *
 * --red = same world, assembly OFF (A5PTC4B_ASSEMBLE=0): the governance criteria
 *         MUST fail (discrimination proof that the outcomes are carried by this
 *         artifact). EXIT 0 = expected outcome for the mode, 2 = deviations, 1 = fatal.
 *
 * Port 3184 (self-proven free); world tests/homes/a5ptc4b-* (deleted at teardown
 * unless --keep); :3080 only probed; pinned host tree read-only.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
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
const RUN = `a5ptc4b-rev-${MODE}-${RUN_STAMP}`
const EVIDENCE_DIR = resolve(join(HERE, 'runs', RUN))
mkdirSync(EVIDENCE_DIR, { recursive: true })

const HOST_PORT = Number(argValue('port', 3184))
const TESTUSE = resolve(argValue('testuse', '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade/tests/deepseek-harness-test-use'))
const LAUNCHER = resolve(argValue('launcher', '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use/native/system/packages/linux-x64/bin/landlock-run'))
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const ROW_PATH = join(HERE, 'a5ptc4b-grantrow.mjs')
const PROBE_PATH = join(HERE, 'a5ptc4b-probe-pkg', 'a5ptc4b-downstream-probe.mjs')
const HOME = join(WORKTREE, 'tests', 'homes', RUN)
const WS = join(HOME, 'ws')
const FORB = join(WORKTREE, 'tests', 'homes', `${RUN}-forb`)
const SECRET = join(FORB, 'secret.txt')
const LEDGER = join(EVIDENCE_DIR, 'assembly-ledger.jsonl')
const PROBE_LEDGER = join(EVIDENCE_DIR, 'downstream-probe-ledger.jsonl')
const INSTANCE_RAW = join(EVIDENCE_DIR, 'instance.raw.log')
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const SECRET_VALUE = `A5PTC4B-SECRET-${RUN_STAMP}`
const ASK_TTL_MS = Number(argValue('ask-ttl', 10000))
const EXPIRY_TTL_MS = 1200

const VERBATIM_REJECT = 'the user rejected escalating this program to "danger-full-access"'
// The dead L1 channel, presented verbatim by the model on the REPLAY leg: it is
// model text now, and must have ZERO effect on the decision.
const L1_TOKEN_TEXT = 'A5PTC4-TOKEN:t4 outerfs leg4: widen under an allowed-once grant (per-call lever positive control)'

const REDACTIONS = [
  [/(https?:\/\/[^\s"'`]+?\?token=)([A-Za-z0-9_-]{8,})/g, (_m, head, tok) => head + `<REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}>`],
  [/\b(token|api_key|apikey|access_token)=["']?[A-Za-z0-9_\-.=]{8,}/gi, (m0) => m0.split('=')[0] + '=<REDACTED>'],
  [/dsh-auth-[A-Za-z0-9_-]{6,}/g, 'dsh-auth-<REDACTED>'],
]
const redact = (t) => REDACTIONS.reduce((x, [re, r]) => x.replace(re, r), t)

const CRITERIA = []
const GOVERNANCE_IDS = new Set([
  'ANCHOR-TEAM-GRANT-ALLOWED-ONCE', 'NEG1-REPLAY-REFUSED', 'NEG2-EXPIRED-REFUSED-DOWNSTREAM-VISIBLE',
  'NEG3-AGENT-BIND-GRANT-UNSPENT-AND-OWNER-ONLY', 'NEG4-REVOKED-BEFORE-USE-REFUSED',
  'NEG5-MODE-BIND-MISMATCH-REFUSED', 'T5-UNLOAD-SYMMETRIC-AND-DEAD', 'GOV-ADJUDICATION-INPUT-IS-TEAM-GRANT-ONLY',
  'DELEG-ZERO-ANSWER-VERBATIM-DOWNSTREAM', 'CONCURRENCY-ISOLATION',
])
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
const lsDir = (dir) => { try { return readdirSync(dir).sort() } catch { return [] } }
const readIfExists = (p) => { try { return readFileSync(p, 'utf8') } catch { return null } }

let host = null
let mock = null
let stableBefore = null
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
  writeEvidence('criteria.json', { run: RUN, mode: MODE, launcherSha, askTtlMs: ASK_TTL_MS, status, criteria: CRITERIA })
}
const writeEvidence = (name, value) => writeFileSync(join(EVIDENCE_DIR, name), typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n')

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
async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...(init ?? {}), signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, body: JSON.parse(text) } } catch { return { status: res.status, body: text } }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const launcherSha = (() => { try { return sha256(readFileSync(LAUNCHER)) } catch { return null } })()

// ── outer PTC programs (they really run in a separate OS process) ───────────
const prog = (body) => ["const fs = await import('node:fs');", 'const pid = process.pid;', body].join('\n')
const escProgram = (leg, target) => prog(`
const w = await tools.a5ptc4b_echo({ tag: '${leg}-body' });
let writeCode = 'none';
try { fs.writeFileSync('${target}', 'A5PTC4B-BODY-RAN-' + pid); } catch (e) { writeCode = String(e.code); }
return { pid, ppid: process.ppid, echo: w, writeCode, canary: 'A5PTC4B-BODY-RAN' };`)
const foreignProgram = (leg, target) => prog(`
let writeCode = 'none';
try { fs.writeFileSync('${FORB}/${target}', 'A5PTC4B-FX-RAN-' + pid); } catch (e) { writeCode = String(e.code); }
fs.writeFileSync('${WS}/${leg}-fx-canary.txt', 'FX-BODY-' + pid);
return { pid, ppid: process.ppid, writeCode, canary: 'A5PTC4B-FX-RAN' };`)

async function main() {
  stableBefore = await stableProbe()
  console.log(`stable-instance :3080 probe (pre) = ${stableBefore}`)
  if (!(await portFree(HOST_PORT))) die(`port ${HOST_PORT} busy`)
  const pinnedHead = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  const porcelain0 = gitAt(TESTUSE, 'status', '--porcelain') === ''
  check('P-PIN', `pinned host tree @${TEST_USE_BASELINE_SHA.slice(0, 10)} with porcelain=0`, pinnedHead === TEST_USE_BASELINE_SHA && porcelain0, `head=${pinnedHead.slice(0, 12)} porcelain=${porcelain0}`)

  // static part of the T-1 claim: the row has no token channel and no mode/policy write
  const rowSrc = readFileSync(ROW_PATH, 'utf8')
  check('T1-NO-TOKEN-CHANNEL-IN-ARTIFACT', 'static: the L2 row contains no grant-token channel (no A5PTC4-TOKEN matcher, no /grant minting route) and calls neither setSandboxMode nor setApprovalPolicy',
    !/A5PTC4-TOKEN/.test(rowSrc) && !/path:\s*['"]\/__a5ptc4b?\/grant['"]/.test(rowSrc) && !/setSandboxMode|setApprovalPolicy/.test(rowSrc),
    `tokenMatcher=${/A5PTC4-TOKEN/.test(rowSrc)} grantRoute=${/path:\s*['"]\/__a5ptc4[b]?\/grant['"]/.test(rowSrc)} modeWrites=${/setSandboxMode|setApprovalPolicy/.test(rowSrc)}`)

  mkdirSync(WS, { recursive: true })
  mkdirSync(FORB, { recursive: true })
  writeFileSync(SECRET, `${SECRET_VALUE}\n`)
  const secretShaPre = sha256(readFileSync(SECRET))
  const probeRun = spawnSync(LAUNCHER, ['--probe'], { encoding: 'utf8', timeout: 4000 })
  const direct = spawnSync(LAUNCHER, ['--ro', '/', '--rw', '/dev/null', '--rw', '/tmp', '--rw', WS, '--',
    process.execPath, '-e', `const fs=require('fs');
fs.writeFileSync(${JSON.stringify(join(WS, 'os-preflight-ws.txt'))},'OS-PREFLIGHT-OK');
let c='none',a='none';
try{fs.writeFileSync(${JSON.stringify(join(FORB, 'os-preflight-hack.txt'))},'x')}catch(e){c=String(e.code)}
try{fs.appendFileSync(${JSON.stringify(SECRET)},'x')}catch(e){a=String(e.code)}
console.log(JSON.stringify({c,a}));`], { encoding: 'utf8', timeout: 20_000 })
  let directObs = {}
  try { directObs = JSON.parse(String(direct.stdout ?? '').trim().split('\n').pop()) } catch { /* capture */ }
  writeEvidence('os-preflight.json', {
    launcher: LAUNCHER, sha256: launcherSha,
    probe: { exit: probeRun.status, stdout: String(probeRun.stdout ?? '').trim(), stderr: String(probeRun.stderr ?? '').trim() },
    direct: { exit: direct.status, observed: directObs, hackExists: existsSync(join(FORB, 'os-preflight-hack.txt')), secretUnchanged: sha256(readFileSync(SECRET)) === secretShaPre },
  })
  check('P-OS-PREFLIGHT', 'OS floor (assembly-independent): the same launcher the host chain execs allows the ws write and refuses forbidden create/append at open (EACCES), zero bytes, secret unchanged',
    probeRun.status === 0 && direct.status === 0 && directObs.c === 'EACCES' && directObs.a === 'EACCES'
    && !existsSync(join(FORB, 'os-preflight-hack.txt')) && sha256(readFileSync(SECRET)) === secretShaPre,
    `probe="${String(probeRun.stdout ?? '').trim()}" direct=${JSON.stringify(directObs)}`)

  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), [
    `# a5ptc4b W-PTC-OUTERFS-L2 patch (run ${RUN}): Team-Grant resolver row + downstream ask-lane probe via the public profile-patch seam; zero production-row mounts, zero sandbox config keys.`,
    '- insert:',
    '    - id: a5ptc4b-grantrow',
    `      name: ${JSON.stringify(pathToFileURL(ROW_PATH).href)}`,
    '      config: {}',
    '    - id: a5ptc4b-downstream-probe',
    `      name: ${JSON.stringify(pathToFileURL(PROBE_PATH).href)}`,
    '      config: {}',
    '',
  ].join('\n'))

  const MK = RUN.replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  // ── lane + member leg scripts ─────────────────────────────────────────────
  const FORB_TARGET = (stem) => join(FORB, `${stem}.txt`)
  const LEG = {
    ANCHOR: { session: 'M1', target: 'l-anchor' },
    REPLAY: { session: 'M1', target: 'l-replay' },
    EXPIRY: { session: 'M1', target: 'l-expiry' },
    REVOKE: { session: 'M1', target: 'l-revoke' },
    BIND: { session: 'M1', target: 'l-bind' },
    XTEAM: { session: 'M3', target: 'l-xteam-foreign-present' },
    XTEAMUSE: { session: 'M1', target: 'l-xteam' },
    Q1: { session: 'M1', target: 'l-q1' },
    Q2: { session: 'M2', target: 'l-q2' },
    UNLOADAFTER: { session: 'M1', target: 'l-unload-after' },
    DELEG: { session: 'FX', target: 'l-deleg-fx' },
    FXCHECK: { session: 'FX', target: 'fxcheck' },
  }
  // NEG-1 replays the SPENT authorization, and NEG-3's second half has the OWNER
  // present the very quadruple a live Grant is bound to: both legs therefore carry
  // another leg's callId (tool-call ids are model-supplied, so re-presenting one is
  // exactly the real-world shape these two controls test).
  const CALL_ALIAS = { REPLAY: 'ANCHOR', XTEAMUSE: 'XTEAM' }
  const callIdOf = (marker) => `call-${MK}-${CALL_ALIAS[marker] ?? marker}`
  const justificationOf = (marker) => marker === 'REPLAY'
    ? `${L1_TOKEN_TEXT} — REPLAY of the already-spent authorization (this model text must not be an input)`
    : `a5ptc4b ${marker}: outer direct fs program under Team per-call governance`

  let laneTurns = 0
  let reqs = 0
  mock = await startMockModel({
    port: 0,
    decide: ({ req }) => {
      reqs += 1
      if (reqs > 120) return { kind: 'text', content: `${MK}_FUSED fuse at ${reqs}` }
      const body = req?.body ?? req ?? {}
      const msgs = body.messages ?? []
      const users = msgs.filter((m) => m?.role === 'user')
      const last = users[users.length - 1]
      const lastText = typeof last?.content === 'string' ? last.content : JSON.stringify(last?.content ?? '')
      // ── Team-lane actor turns (its own tool calls = the Grant channel) ────
      const lane = /A5PTC4B_LANE_(ALLOW_PENDING|DENY_PENDING|REVOKE_PENDING|DECLARE_ALLOW|DECLARE_REJECT|REVOKE_GRANT|UNLOAD)\s+(.*)/.exec(lastText)
      if (lane !== null) {
        const idx = msgs.indexOf(last)
        const done = msgs.slice(idx + 1).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
        if (done.length > 0) {
          const t = done.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
          return { kind: 'text', content: `A5PTC4B_LANE_DONE ${t.slice(0, 500)}` }
        }
        laneTurns += 1
        const rest = lane[2].trim()
        const id = `lane-${MK}-t${laneTurns}`
        const num = Number(rest.split(/\s+/)[0])
        if (lane[1] === 'ALLOW_PENDING') return { kind: 'tool-call', toolCalls: [{ id, name: 'a5ptc4b_grant', arguments: { pending_seq: num, decision: 'allow', ttl_ms: 60000 } }] }
        if (lane[1] === 'DENY_PENDING') return { kind: 'tool-call', toolCalls: [{ id, name: 'a5ptc4b_grant', arguments: { pending_seq: num, decision: 'reject', ttl_ms: 60000 } }] }
        if (lane[1] === 'REVOKE_PENDING') return { kind: 'tool-call', toolCalls: [{ id, name: 'a5ptc4b_revoke', arguments: { pending_seq: num } }] }
        if (lane[1] === 'DECLARE_ALLOW' || lane[1] === 'DECLARE_REJECT') {
          const [declared, ttl] = rest.split(/\s+/)
          return { kind: 'tool-call', toolCalls: [{ id, name: 'a5ptc4b_grant', arguments: { declared, decision: lane[1] === 'DECLARE_ALLOW' ? 'allow' : 'reject', ttl_ms: Number(ttl ?? 60000) } }] }
        }
        if (lane[1] === 'REVOKE_GRANT') return { kind: 'tool-call', toolCalls: [{ id, name: 'a5ptc4b_revoke', arguments: { grant_id: rest.split(/\s+/)[0] } }] }
        return { kind: 'tool-call', toolCalls: [{ id, name: 'a5ptc4b_unload', arguments: { confirm: 'unload' } }] }
      }
      // ── member / foreign turns ────────────────────────────────────────────
      const hit = Object.keys(LEG).find((l) => lastText.includes(`${MK}_${l} `) || lastText.endsWith(`${MK}_${l}`))
      if (hit == null) return lastText.includes(`${MK}_SET`) ? { kind: 'text', content: `${MK}_SET_OK` } : { kind: 'text', content: 'a5ptc4b-mock: quiet.' }
      const idx = msgs.indexOf(last)
      const results = msgs.slice(idx + 1).flatMap((m) => Array.isArray(m?.content) ? m.content.filter((b) => b?.type === 'tool_result') : [])
      if (results.length > 0) {
        const t = results.map((b) => { const c = b.content; return typeof c === 'string' ? c : Array.isArray(c) ? c.map((x) => x?.text ?? '').join('') : JSON.stringify(c ?? '') }).join(' | ')
        return { kind: 'text', content: `${MK}_DONE_${hit} ${t.slice(0, 900)}` }
      }
      if (hit === 'FXCHECK') {
        return { kind: 'tool-call', toolCalls: [{ id: `call-${MK}-FXCHECK`, name: 'run_code', arguments: { code: foreignProgram('fxcheck', 'fxcheck-never-written.txt'), description: 'a5ptc4b FXCHECK: run_code presence probe (no escalation)' } }] }
      }
      const leg = LEG[hit]
      return {
        kind: 'tool-call',
        toolCalls: [{
          id: callIdOf(hit),
          name: 'run_code',
          arguments: {
            code: leg.session === 'FX' ? foreignProgram(hit, `${leg.target}.txt`) : escProgram(hit, FORB_TARGET(leg.target)),
            description: `a5ptc4b ${hit}: outer direct fs program (per-call governance leg)`,
            sandbox_permissions: 'danger-full-access',
            justification: justificationOf(hit),
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
      DEEPSEEK_API_KEY: 'a5ptc4b-mock-key',
      A5PTC4B_ASSEMBLE: MODE === 'green' ? '1' : '0',
      // the OS floor is up in BOTH modes: RED must differ in one respect only —
      // the absence of the adjudication faces, not of the sandbox backend.
      A5PTC4B_OS: '1',
      A5PTC4B_TESTUSE: TESTUSE,
      A5PTC4B_LEDGER: LEDGER,
      A5PTC4B_LAUNCHER: LAUNCHER,
      A5PTC4B_RUN: RUN,
      A5PTC4B_ASK_TTL_MS: String(ASK_TTL_MS),
      A5PTC4B_PROBE_LEDGER: PROBE_LEDGER,
    },
  })
  host = { child }
  child.on('exit', (code, signal) => console.log(`host exited code=${String(code)} signal=${String(signal)}`))
  const boot = await waitFor(120_000, () => {
    try { const m = BOOT_MARKER.exec(readFileSync(INSTANCE_RAW, 'utf8')); return m === null ? false : m } catch { return false }
  }, 'host boot marker')
  const origin = `http://127.0.0.1:${boot[1]}`
  const cookie = (await fetch(`${origin}/?token=${boot[2]}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })).headers.get('set-cookie')
  check('L-BOOT', `host booted on ${HOST_PORT} (port self-proven free) with the token gate live`, cookie !== null, `cookie=${cookie !== null}`)
  await waitFor(40_000, async () => { const h = await fetchJson(`${origin}/__a5ptc4b/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'L2 row apply')
  await waitFor(40_000, async () => { const h = await fetchJson(`${origin}/__a5ptc4bp/health`).catch(() => null); return h?.status === 200 && h.body.applied === true ? h : false }, 'downstream probe apply')
  const hostPid = (await fetchJson(`${origin}/__a5ptc4b/health`)).body.pid

  // the deleted channels must be dead, not merely unused: posting a grant-shaped
  // body to any non-lane face must neither succeed nor create a ledger record
  const grantsBeforeProbe = ((await fetchJson(`${origin}/__a5ptc4b/grants`).catch(() => null))?.body?.rows ?? []).length
  const oldGrant = await fetchJson(`${origin}/__a5ptc4/grant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: 't4', decision: 'allow' }) }).catch(() => null)
  const newGrant = await fetchJson(`${origin}/__a5ptc4b/grant`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ declared: 'x|y|run_code|danger-full-access', decision: 'allow' }) }).catch(() => null)
  const grantsAfterProbe = ((await fetchJson(`${origin}/__a5ptc4b/grants`).catch(() => null))?.body?.rows ?? []).length
  writeEvidence('grant-channel-deleted.json', { grantsBeforeProbe, grantsAfterProbe, oldGrant: { status: oldGrant?.status, body: oldGrant?.body }, newGrant: { status: newGrant?.status, body: newGrant?.body } })
  check('T1-GRANT-HTTP-CHANNEL-DELETED', 'the L1 unauthenticated grant feed is gone and nothing replaces it: POSTing a grant-shaped body to /__a5ptc4/grant or /__a5ptc4b/grant is not accepted and mints ZERO ledger records (Grants exist only as the Team-lane actor\'s own tool call)',
    oldGrant?.status !== 200 && newGrant?.status !== 200 && grantsAfterProbe === grantsBeforeProbe,
    `l1Face=${oldGrant?.status} l2Face=${newGrant?.status} grantsBefore=${grantsBeforeProbe} grantsAfter=${grantsAfterProbe}`)

  const api = (method, payload, timeoutMs = 240_000) => fetchJson(`${origin}/api/session/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json', cookie: cookie ?? '' },
    body: JSON.stringify({ type: 'client-request', rpcId: `a5ptc4b-${Math.random().toString(36).slice(2, 10)}`, method: `session/${method}`, payload: { args: { request: payload } } }),
  }, timeoutMs)
  const createSession = async () => {
    const r = await api('create', { requestId: `a5ptc4b-c-${Math.random().toString(36).slice(2, 10)}`, cwd: WS }, 90_000)
    return r.body?.result?.value?.sessionId ?? r.body?.value?.sessionId ?? null
  }
  const S = {}
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX']) S[k] = await createSession()
  check('L-CREATE', 'five sessions created through the public entry (Team lane actor + members M1/M2 + other-team stand-in M3 + never-adjudicated outsider FX)',
    Object.values(S).every((s) => typeof s === 'string' && s !== ''), JSON.stringify(Object.fromEntries(Object.entries(S).map(([k, v]) => [k, String(v).slice(0, 16)]))))
  const prompt = (sid, text) => api('prompt', { requestId: `a5ptc4b-r-${Math.random().toString(36).slice(2, 10)}`, sessionId: sid, mode: 'queue', content: [{ type: 'text', text }] }, 240_000)
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX']) await prompt(S[k], `${MK}_SET_${k} setup turn; reply OK`)

  const provision = async (sid, role) => {
    const r = await waitFor(120_000, async () => { const x = await fetchJson(`${origin}/__a5ptc4b/provision`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid, role }) }).catch(() => null); return x?.body?.ok === true ? x : false }, `provision ${role}`)
    return r.body
  }
  const provLane = await provision(S.LANE, 'lane')
  const provM1 = await provision(S.M1, 'member')
  const provM2 = await provision(S.M2, 'member')
  const provM3 = await provision(S.M3, 'member')
  const provFX = await provision(S.FX, 'outsider')
  const roster = (await fetchJson(`${origin}/__a5ptc4b/roster`)).body
  const labelOf = (prov) => prov.label
  const laneLabel = labelOf(provLane)
  writeEvidence('roster.json', { lane: provLane, m1: provM1, m2: provM2, m3: provM3, census: roster })
  const laneToolsOk = (provLane.error === null || provLane.error === undefined) && (roster.rows.find((r) => r.role === 'lane')?.laneTools ?? []).length === 3
  check('L-PROVISION', 'roster provisioned: the lane actor carries a5ptc4b_grant/_revoke/_unload on its OWN agent ctx; M1/M2/M3 are adjudicated members with witnesses; FX is provisioned only as an OUTSIDER (witnesses, never on the adjudication roster)',
    [provLane, provM1, provM2, provM3, provFX].every((p) => p.ok === true && p.error == null) && laneToolsOk,
    `lane=${JSON.stringify(provLane).slice(0, 200)} members=${[provM1, provM2, provM3, provFX].map((p) => `${p.role}:${p.ok}`).join(',')} laneTools=${JSON.stringify(roster.rows.find((r) => r.role === 'lane')?.laneTools)}`)

  const jrows = async () => ((await fetchJson(`${origin}/__a5ptc4b/journal`).catch(() => null))?.body?.rows) ?? []
  const state = async () => (await fetchJson(`${origin}/__a5ptc4b/state`)).body?.assemblies ?? {}
  const approvals = async () => ((await fetchJson(`${origin}/__a5ptc4b/approvals`).catch(() => null))?.body?.rows) ?? []
  const grants = async () => ((await fetchJson(`${origin}/__a5ptc4b/grants`).catch(() => null))?.body) ?? { rows: [] }
  const pending = async () => (await fetchJson(`${origin}/__a5ptc4b/pending`).catch(() => null))?.body ?? { rows: [] }
  const probeRows = async () => ((await fetchJson(`${origin}/__a5ptc4bp/received`).catch(() => null))?.body?.rows) ?? []
  // the HOST's own ask lane, mirrored read-only off the public session/event bus
  const askEventsFor = async (callId) => {
    const b = (await fetchJson(`${origin}/__a5ptc4b/ask-events`).catch(() => null))?.body ?? { rows: [] }
    return (b.rows ?? []).filter((e) => e.callId === callId)
  }
  const hooks = async (tag) => { const h = (await fetchJson(`${origin}/__a5ptc4b/hooks`).catch(() => null))?.body; if (tag !== undefined) writeEvidence(`hooks-${tag}.json`, h); return h }
  const modeOf = async (sid) => (await fetchJson(`${origin}/__a5ptc4b/mode`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: sid }) })).body
  const labelFor = (marker) => ({ M1: labelOf(provM1), M2: labelOf(provM2), M3: labelOf(provM3), FX: labelOf(provFX), LANE: laneLabel }[LEG[marker]?.session ?? 'M1'])
  const runsOf = async (label) => (await state())?.[label]?.runs ?? []
  const parseRun = (run) => { try { return JSON.parse(/(\{.*\})/s.exec(String(run?.text ?? ''))?.[1] ?? 'null') } catch { return null } }
  const askRowsFor = async (marker) => (await approvals()).filter((x) => x.callId === callIdOf(marker))
  const grantFor = async (bindCallId) => (await grants()).rows.filter((g) => g.bind.callId === bindCallId)

  const legRunCount = async (marker) => (await runsOf(labelFor(marker))).length
  const runLeg = async (marker, waitMs = 90_000) => {
    const before = await legRunCount(marker)
    await prompt(S[LEG[marker].session], `${MK}_${marker} leg ${marker}`)
    const settled = await pollUntil(waitMs, async () => {
      const runs = await runsOf(labelFor(marker))
      return runs.length > before ? runs[runs.length - 1] : false
    }, `${marker} settle`)
    return { run: settled?.__held ? null : settled, held: settled?.__held !== undefined }
  }
  // Team-lane turn: the runner only READS the lane queue (read-only census) and
  // then instructs the lane actor; every decision enters as the lane's own call.
  const laneSay = async (verb, rest = '') => { await prompt(S.LANE, `A5PTC4B_LANE_${verb} ${rest} (lane turn)`) }
  const waitPendingSeq = async (marker, waitMs = 30_000) => {
    const found = await pollUntil(waitMs, async () => {
      const p = await pending()
      const h = p.rows.find((r) => r.bind.callId === callIdOf(marker))
      return h === undefined ? false : h
    }, `pending ask for ${marker}`)
    return found?.__held ? null : found
  }
  const waitAskRow = async (marker, waitMs = 30_000) => {
    const found = await pollUntil(waitMs, async () => { const rows = await askRowsFor(marker); return rows.length > 0 ? rows[rows.length - 1] : false }, `ask ledger row for ${marker}`)
    return found?.__held ? null : found
  }

  const modePre = {}
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX']) modePre[k] = await modeOf(S[k])
  const hookBoot = await hooks('boot')

  // ── FX run_code presence probe (no escalation, no governance) ─────────────
  await prompt(S.FX, `${MK}_FXCHECK leg FXCHECK`)
  const fxCanary = await pollUntil(60_000, async () => (readIfExists(join(WS, 'fxcheck-fx-canary.txt')) !== null ? true : false), 'FX run_code canary')
  check('L-FX-RUNCODE-PRESENT', 'the never-adjudicated FX (outsider) session can really run the outer program (canary written by the child) — so its later delegation leg is a real escalation ask, not a missing tool',
    fxCanary === true && readIfExists(join(WS, 'fxcheck-fx-canary.txt')) !== null,
    `canary=${JSON.stringify(readIfExists(join(WS, 'fxcheck-fx-canary.txt')))}`)

  writeEvidence('sandbox-census-pre.json', (await fetchJson(`${origin}/__a5ptc4b/sandbox`).catch(() => null))?.body ?? null)

  // ══ ANCHOR: Team ask-lane answers a live ask with an ask-bound one-time Grant
  const beforeAnchor = await legRunCount('ANCHOR')
  await prompt(S.M1, `${MK}_ANCHOR leg ANCHOR`)
  const pendAnchor = await waitPendingSeq('ANCHOR')
  if (pendAnchor !== null) await laneSay('ALLOW_PENDING', String(pendAnchor.seq))
  const anchorSettled = await pollUntil(60_000, async () => {
    const runs = await runsOf(labelOf(provM1))
    return runs.length > beforeAnchor ? runs[runs.length - 1] : false
  }, 'ANCHOR settle')
  const runAnchor = anchorSettled?.__held ? null : anchorSettled
  const anchorParsed = parseRun(runAnchor)
  const anchorAskRow = await waitAskRow('ANCHOR')
  const anchorGrants = await grantFor(callIdOf('ANCHOR'))
  await sleep(400)
  const anchorTarget = readIfExists(FORB_TARGET('l-anchor'))
  writeEvidence('leg-ANCHOR.json', { pending: pendAnchor, run: runAnchor, parsed: anchorParsed, askRow: anchorAskRow, grants: anchorGrants, target: anchorTarget })
  check('ANCHOR-TEAM-GRANT-ALLOWED-ONCE', 'positive anchor: a real Team-plane one-time Grant (minted as the lane actor\'s own tool call, bindings copied from the HOST ask record) answers exactly this ask allowed-once → forbidden target really written by the real OS child, and the Grant record is SPENT (state=consumed, consumedByAskSeq set)',
    anchorAskRow?.outcome === 'allowed-once' && anchorAskRow?.grantId !== undefined && anchorAskRow?.issuerLane === laneLabel
    && String(anchorTarget ?? '').includes('A5PTC4B-BODY-RAN') && anchorParsed?.echo === 'A5PTC4B-ECHO:ANCHOR-body'
    && runAnchor?.raw?.value?.sandbox?.mode === 'danger-full-access'
    && anchorGrants.length === 1 && anchorGrants[0].state === 'consumed' && anchorGrants[0].via === 'team-lane-tool'
    && anchorGrants[0].source === 'ask-bound' && anchorGrants[0].issuerLane.label === laneLabel
    && anchorGrants[0].bind.agent === labelOf(provM1) && anchorGrants[0].bind.callId === callIdOf('ANCHOR')
    && anchorGrants[0].bind.toolName === 'run_code' && anchorGrants[0].bind.mode === 'danger-full-access',
    `askRow=${JSON.stringify(anchorAskRow ?? null).slice(0, 300)} grant=${JSON.stringify(anchorGrants[0] ?? null).slice(0, 400)} target=${JSON.stringify(anchorTarget)} sandbox=${JSON.stringify(runAnchor?.raw?.value?.sandbox ?? null)}`)

  const sandboxCensus = (await fetchJson(`${origin}/__a5ptc4b/sandbox`).catch(() => null))?.body ?? {}
  writeEvidence('sandbox-census.json', sandboxCensus)
  check('L-LAUNCHER-DEPLOY', "the OS backend rides the host's own public provider test-hook: after the first real run the host's own chain walk reports selectedRunner=landlock — in BOTH modes, because the RED control world differs from GREEN only by the absent adjudication faces (a red round with no sandbox backend would prove nothing about governance)",
    sandboxCensus.selectedRunner === 'landlock' && sandboxCensus.landlockLauncher === LAUNCHER,
    JSON.stringify(sandboxCensus).slice(0, 300))

  // ══ NEG-1 REPLAY: same bound quadruple again, and its justification carries
  //          the OLD L1 token text verbatim (must now be inert model text)
  // the replay row shares the ANCHOR's callId, so wait for a NEW row on it
  const replayRowsBefore = (await askRowsFor('REPLAY')).length
  const waitNewReplayRow = async () => {
    const found = await pollUntil(30_000, async () => {
      const rows = await askRowsFor('REPLAY')
      return rows.length > replayRowsBefore ? rows[rows.length - 1] : false
    }, 'new replay ledger row')
    return found?.__held ? null : found
  }
  const rReplay = await runLeg('REPLAY', 45_000)
  const replayAskRow = await waitNewReplayRow()
  const replayWritten = existsSync(FORB_TARGET('l-replay'))
  writeEvidence('leg-REPLAY.json', { run: rReplay.run, askRow: replayAskRow, written: replayWritten, grants: await grantFor(callIdOf('ANCHOR')) })
  check('NEG1-REPLAY-REFUSED', 'NEG-1 replay of the spent authorization (same agent/callId/toolName/mode re-presented, model justification carrying the old L1 grant-token text verbatim): REFUSED (replay-of-consumed), the model token text is only logged, zero writes — L1 answered this with a stale allowed-once and the write landed (review F-2)',
    replayAskRow?.decision === 'replay-of-consumed' && replayAskRow?.outcome === 'rejected'
    && String(replayAskRow?.modelTextLog ?? '').includes('A5PTC4-TOKEN:t4')
    && !replayWritten && String(rReplay.run?.text ?? '').includes(VERBATIM_REJECT),
    `askRow=${JSON.stringify(replayAskRow ?? null).slice(0, 320)} written=${replayWritten} runText=${String(rReplay.run?.text ?? '(held)').slice(0, 200)}`)

  // ══ NEG-2 EXPIRY: declared Grant whose TTL lapses before presentation
  const declaredBind = `${labelOf(provM1)}|${callIdOf('EXPIRY')}|run_code|danger-full-access`
  await laneSay('DECLARE_ALLOW', `${declaredBind} ${EXPIRY_TTL_MS}`)
  const expiryGrants = await pollUntil(30_000, async () => { const g = await grantFor(callIdOf('EXPIRY')); return g.length > 0 ? g : false }, 'declared grant')
  await sleep(EXPIRY_TTL_MS + 900)
  const rExpiry = await runLeg('EXPIRY', 45_000)
  const expiryAskRow = await waitAskRow('EXPIRY')
  const gExpiry = (await grantFor(callIdOf('EXPIRY')))[0] // read AFTER the leg
  writeEvidence('leg-EXPIRY.json', { run: rExpiry.run, askRow: expiryAskRow, grant: gExpiry, written: existsSync(FORB_TARGET('l-expiry')) })
  check('NEG2-EXPIRED-REFUSED-DOWNSTREAM-VISIBLE', 'NEG-2 expired Grant (declared allow, TTL 1200 ms, presented after it lapsed): REFUSED with decision=expired and the refusal is DOWNSTREAM-VISIBLE (the caller receives the host verbatim fail-closed text), zero writes — L1 had no TTL at all (review F-4)',
    expiryAskRow?.decision === 'expired' && expiryAskRow?.outcome === 'rejected' && expiryAskRow?.grantId !== undefined
    && gExpiry?.state === 'expired' && gExpiry?.ttlMs === EXPIRY_TTL_MS && gExpiry?.via === 'team-lane-tool'
    && !existsSync(FORB_TARGET('l-expiry')) && String(rExpiry.run?.text ?? '').includes(VERBATIM_REJECT),
    `askRow=${JSON.stringify(expiryAskRow ?? null).slice(0, 300)} grant=${JSON.stringify(gExpiry ?? null).slice(0, 300)} written=${existsSync(FORB_TARGET('l-expiry'))} runText=${String(rExpiry.run?.text ?? '(held)').slice(0, 200)}`)

  // ══ NEG-4 REVOCATION: live Grant revoked by the lane before it is spent
  const revokeBind = `${labelOf(provM1)}|${callIdOf('REVOKE')}|run_code|danger-full-access`
  await laneSay('DECLARE_ALLOW', `${revokeBind} 60000`)
  const revGrant = await pollUntil(30_000, async () => { const g = await grantFor(callIdOf('REVOKE')); return g.length > 0 ? g[0] : false }, 'revocable grant')
  const grantIdToRevoke = revGrant?.__held ? (await grantFor(callIdOf('REVOKE')))[0]?.grantId : revGrant?.grantId
  await laneSay('REVOKE_GRANT', String(grantIdToRevoke))
  const revokedSeen = await pollUntil(30_000, async () => { const g = (await grantFor(callIdOf('REVOKE')))[0]; return g?.state === 'revoked' ? g : false }, 'revoked state')
  const rRevoke = await runLeg('REVOKE', 45_000)
  const revokeAskRow = await waitAskRow('REVOKE')
  writeEvidence('leg-REVOKE.json', { run: rRevoke.run, askRow: revokeAskRow, grant: revokedSeen?.__held ? null : revokedSeen, written: existsSync(FORB_TARGET('l-revoke')) })
  check('NEG4-REVOKED-BEFORE-USE-REFUSED', 'NEG-4 revocation outranks the cache: a live Grant revoked by the lane before use is REFUSED (decision=revoked, verbatim fail-closed text downstream), zero writes — L1 answered the same shape with the cached allow and the write landed (review F-3)',
    revokeAskRow?.decision === 'revoked' && revokeAskRow?.outcome === 'rejected' && revokeAskRow?.grantId === grantIdToRevoke
    && revokedSeen?.state === 'revoked' && !existsSync(FORB_TARGET('l-revoke')) && String(rRevoke.run?.text ?? '').includes(VERBATIM_REJECT),
    `askRow=${JSON.stringify(revokeAskRow ?? null).slice(0, 300)} grant=${JSON.stringify(revokedSeen ?? null).slice(0, 260)} written=${existsSync(FORB_TARGET('l-revoke'))} runText=${String(rRevoke.run?.text ?? '(held)').slice(0, 180)}`)

  // ══ NEG-3 AGENT BINDING: M3 (other-team stand-in) presents the callId a LIVE
  //          Grant is bound to M1 for. Nothing may answer from it; it must stay
  //          unspent; then M1 himself spends it.
  const xteamBind = `${labelOf(provM1)}|${callIdOf('XTEAM')}|run_code|danger-full-access`
  await laneSay('DECLARE_ALLOW', `${xteamBind} 120000`)
  const xGrant = await pollUntil(30_000, async () => { const g = (await grantFor(callIdOf('XTEAM')))[0]; return g !== undefined ? g : false }, 'grant bound to M1')
  const xGrantId = xGrant?.__held ? (await grantFor(callIdOf('XTEAM')))[0]?.grantId : xGrant?.grantId
  const rX = await runLeg('XTEAM', ASK_TTL_MS + 45_000)
  const xAskRows = await askRowsFor('XTEAM')
  const xGrantAfter = (await grantFor(callIdOf('XTEAM')))[0]
  const rXuse = await runLeg('XTEAMUSE', 60_000)
  const xuseAskRow = await pollUntil(30_000, async () => {
    const mine = (await askRowsFor('XTEAMUSE')).filter((x) => x.agent === labelOf(provM1))
    return mine.length > 0 ? mine[mine.length - 1] : false
  }, 'owner-side ledger row on the bound callId')
  const xGrantSpent = (await grantFor(callIdOf('XTEAM')))[0]
  writeEvidence('leg-XTEAM.json', { foreignPresent: { run: rX.run, rows: xAskRows }, ownerUse: { run: rXuse.run, askRow: xuseAskRow }, grantBefore: xGrant, grantAfterForeign: xGrantAfter, grantAfterOwner: xGrantSpent })
  check('NEG3-AGENT-BIND-GRANT-UNSPENT-AND-OWNER-ONLY', 'NEG-3 attribution: the other-team stand-in M3 presents the exact callId a live Grant is bound to M1 for → our ledger answers it ZERO times with that Grant (decision=lane-timeout, no grantId), M3 writes nothing, and the Grant is still state=issued/unconsumed; when M1 presents his own bound quadruple it is allowed-once and the write lands → the Grant really belongs to its bound agent (review F-1)',
    xAskRows.some((x) => x.agent === labelOf(provM3) && x.outcome === 'rejected' && x.decision === 'lane-timeout' && x.grantId === undefined)
    && !existsSync(FORB_TARGET('l-xteam-foreign-present'))
    && xGrantAfter?.state === 'issued' && xGrantAfter?.consumedAt === null && xGrantAfter?.bind.agent === labelOf(provM1)
    && xuseAskRow?.outcome === 'allowed-once' && xuseAskRow?.grantId === xGrantId && xuseAskRow?.agent === labelOf(provM1)
    && String(readIfExists(FORB_TARGET('l-xteam')) ?? '').includes('A5PTC4B-BODY-RAN')
    && xGrantSpent?.state === 'consumed',
    `foreignRows=${JSON.stringify(xAskRows.map((x) => ({ agent: String(x.agent).slice(-10), decision: x.decision, outcome: x.outcome })))} afterForeign=${JSON.stringify({ state: xGrantAfter?.state, consumedAt: xGrantAfter?.consumedAt, bind: xGrantAfter?.bind?.agent?.slice(-10) })} ownerRow=${JSON.stringify(xuseAskRow ?? null).slice(0, 240)} ownerTarget=${JSON.stringify(readIfExists(FORB_TARGET('l-xteam')))} spent=${xGrantSpent?.state}`)

  // ══ NEG-5 MODE BINDING: same agent/callId/toolName, DIFFERENT mode
  const bindBind = `${labelOf(provM1)}|${callIdOf('BIND')}|run_code|workspace-write`
  await laneSay('DECLARE_ALLOW', `${bindBind} 120000`)
  await pollUntil(30_000, async () => ((await grantFor(callIdOf('BIND'))).length > 0 ? true : false), 'mode-mismatched grant')
  const rBind = await runLeg('BIND', ASK_TTL_MS + 45_000)
  const bindAskRow = await waitAskRow('BIND')
  const bindGrants = await grantFor(callIdOf('BIND'))
  writeEvidence('leg-BIND.json', { run: rBind.run, askRow: bindAskRow, grants: bindGrants, written: existsSync(FORB_TARGET('l-bind')) })
  check('NEG5-MODE-BIND-MISMATCH-REFUSED', 'NEG-5 the fourth binding is real: a Grant declared for the same agent+callId+toolName but mode=workspace-write cannot answer an ask requesting danger-full-access → we answer nothing from it (decision=lane-timeout at the lane deadline) and zero writes; the mismatched Grant stays unspent',
    bindAskRow?.decision === 'lane-timeout' && bindAskRow?.outcome === 'rejected' && bindAskRow?.grantId === undefined
    && !existsSync(FORB_TARGET('l-bind')) && bindGrants.every((g) => g.state === 'issued') && bindGrants[0]?.bind?.mode === 'workspace-write',
    `askRow=${JSON.stringify(bindAskRow ?? null).slice(0, 300)} grants=${JSON.stringify(bindGrants.map((g) => ({ mode: g.bind.mode, state: g.state })))} written=${existsSync(FORB_TARGET('l-bind'))}`)

  // ══ DELEGATION INTEGRITY: out-of-domain ask (FX never provisioned) → zero
  //          answers from us, ask delivered downstream VERBATIM
  const rDeleg = await runLeg('DELEG', 8_000) // not ours to answer: it stays open downstream
  const delegRows = await askRowsFor('DELEG')
  const evDeleg = await askEventsFor(callIdOf('DELEG'))
  const askedDeleg = evDeleg.filter((e) => e.type === 'approval/asked')
  const decidedDeleg = evDeleg.filter((e) => e.type === 'approval/decided')
  const verbatimOk = askedDeleg.length === 1 && askedDeleg[0].toolName === 'run_code'
    && String(askedDeleg[0].reason).startsWith('escalate sandbox to danger-full-access: ')
    && String(askedDeleg[0].reason).includes('a5ptc4b DELEG')
  const delegGrants = await grantFor(callIdOf('DELEG'))
  writeEvidence('leg-DELEG.json', { run: rDeleg?.run ?? null, rows: delegRows, askEvents: evDeleg, probeSaw: (await probeRows()).filter((x) => x.callId === callIdOf('DELEG')).length, canary: readIfExists(join(WS, 'DELEG-fx-canary.txt')), grants: delegGrants, targetWritten: existsSync(FORB_TARGET('l-deleg-fx')) })
  check('DELEG-ZERO-ANSWER-VERBATIM-DOWNSTREAM', "delegation integrity: an ask from an agent outside this Team roster is passed through untouched (ledger decision=foreign, outcome=pass-through, NO outcome from us) and lands in the HOST ask lane byte-verbatim — the host's own approval/asked audit event carries the same callId/toolName and the host-composed reason untouched — and stays PENDING there (no approval/decided), so we neither swallow it nor pre-empt the human lane; zero writes, zero Grants",
    delegRows.length >= 1 && delegRows.every((x) => x.decision === 'foreign' && x.outcome === 'pass-through')
    && verbatimOk && decidedDeleg.length === 0 && delegGrants.length === 0
    && !existsSync(FORB_TARGET('l-deleg-fx')),
    `ourRows=${JSON.stringify(delegRows.map((x) => ({ agent: String(x.agent).slice(-8), decision: x.decision, outcome: x.outcome })))} asked=${JSON.stringify(askedDeleg[0] ?? null).slice(0, 300)} decided=${decidedDeleg.length} grants=${delegGrants.length} written=${existsSync(FORB_TARGET('l-deleg-fx'))}`)

  // ══ CONCURRENCY: M1 allowed ∥ M2 rejected, each decided by its own Grant
  const beforeQ1 = await legRunCount('Q1')
  const beforeQ2 = await legRunCount('Q2')
  await prompt(S.M1, `${MK}_Q1 leg Q1`)
  await prompt(S.M2, `${MK}_Q2 leg Q2`)
  const pQ1 = await waitPendingSeq('Q1')
  const pQ2 = await waitPendingSeq('Q2')
  if (pQ1 !== null) await laneSay('ALLOW_PENDING', String(pQ1.seq))
  if (pQ2 !== null) await laneSay('DENY_PENDING', String(pQ2.seq))
  const q1 = await pollUntil(60_000, async () => { const runs = await runsOf(labelOf(provM1)); return runs.length > beforeQ1 ? runs[runs.length - 1] : false }, 'Q1 settle')
  const q2 = await pollUntil(60_000, async () => { const runs = await runsOf(labelOf(provM2)); return runs.length > beforeQ2 ? runs[runs.length - 1] : false }, 'Q2 settle')
  const rowQ1 = (await askRowsFor('Q1')).at(-1)
  const rowQ2 = (await askRowsFor('Q2')).at(-1)
  const gQ1 = (await grantFor(callIdOf('Q1')))[0]
  const gQ2 = (await grantFor(callIdOf('Q2')))[0]
  writeEvidence('leg-Q1Q2.json', { q1: q1?.__held ? null : q1, q2: q2?.__held ? null : q2, rowQ1, rowQ2, gQ1, gQ2, pending: { Q1: pQ1, Q2: pQ2 } })
  check('CONCURRENCY-ISOLATION', 'two members in flight at once: each pending ask is answered only by its OWN ask-bound Grant (M1 allow → target really written; M2 reject → verbatim refusal, zero writes), distinct callIds, distinct grants, each ledger row carries its own agent',
    rowQ1?.outcome === 'allowed-once' && rowQ1?.agent === labelOf(provM1) && rowQ1?.grantId !== undefined
    && rowQ2?.outcome === 'rejected' && rowQ2?.agent === labelOf(provM2) && rowQ2?.grantId !== undefined && rowQ2?.grantId !== rowQ1?.grantId
    && existsSync(FORB_TARGET('l-q1')) && !existsSync(FORB_TARGET('l-q2'))
    && String(q1?.text ?? '').includes('A5PTC4B-BODY-RAN') && String(q2?.text ?? '').includes(VERBATIM_REJECT),
    `rowQ1=${JSON.stringify(rowQ1 ?? null).slice(0, 240)} rowQ2=${JSON.stringify(rowQ2 ?? null).slice(0, 240)} q1Written=${existsSync(FORB_TARGET('l-q1'))} q2Written=${existsSync(FORB_TARGET('l-q2'))}`)

  // ══ T-5 SYMMETRIC UNLOAD (lane tool disposes the listeners, then proof) ───
  const hooksBeforeUnload = await hooks('pre-unload')
  await laneSay('UNLOAD')
  const unloadedJournal = await pollUntil(30_000, async () => {
    const r = (await jrows()).find((x) => x.leg === 'resolver-unloaded')
    return r === undefined ? false : r
  }, 'resolver-unloaded journal row')
  const rUnload = await runLeg('UNLOADAFTER', 8_000) // nobody of ours answers it now
  const hooksAfterUnload = await hooks('post-unload')
  const unloadRows = await askRowsFor('UNLOADAFTER')
  const evUnload = await askEventsFor(callIdOf('UNLOADAFTER'))
  const askedUnload = evUnload.filter((e) => e.type === 'approval/asked')
  writeEvidence('leg-UNLOAD.json', { hooksBeforeUnload, hooksAfterUnload, unloadedJournal, rows: unloadRows, askEvents: evUnload, run: rUnload.run, written: existsSync(FORB_TARGET('l-unload-after')) })
  const mineBefore = (hooksBeforeUnload?.rows ?? []).filter((r) => r.mineBySource === true || r.tag !== null).length
  const mineAfter = (hooksAfterUnload?.rows ?? []).filter((r) => r.mineBySource === true || r.tag !== null).length
  // The read-only ask-lane mirror is disposed WITH the adjudication faces (full
  // symmetry, no residue of ours anywhere), so the post-unload downlink proof is
  // structural instead: after unloading, the next in-domain ask produces NO ledger
  // row from us AND no tool result at all — neither an allow nor a refusal of ours
  // — i.e. the ask simply stays open in the host's own ask lane, exactly where the
  // DELEG leg (recorded while the mirror was still installed) proved that lane
  // receives foreign asks byte-verbatim. Nothing of ours answers anything any more.
  check('T5-UNLOAD-SYMMETRIC-AND-DEAD', "T-5 unload symmetry: the lane actor's own tool call runs the retained disposers (resolver-unloaded journal row), the hook census loses exactly our approval/request faces (present before, ZERO after), and the NEXT in-domain ask is answered by us ZERO times — no ledger row, and no tool result of any kind (neither an allow nor a refusal of ours: the ask simply remains open in the host's own ask lane) — with zero writes: no permanent pre-empting global listener survives us (review F-5)",
    unloadedJournal !== null && unloadedJournal?.__held === undefined && mineBefore >= 2 && mineAfter === 0
    && (hooksAfterUnload?.count ?? 0) <= (hooksBeforeUnload?.count ?? 0) - 2
    && unloadedJournal.disposersRun >= 2 && unloadRows.length === 0 && rUnload.run == null
    && !existsSync(FORB_TARGET('l-unload-after')),
    `mineBefore=${mineBefore} mineAfter=${mineAfter} hooks=${hooksBeforeUnload?.count}->${hooksAfterUnload?.count} disposersRun=${unloadedJournal?.disposersRun} ourRowsAfterUnload=${unloadRows.length} runAfterUnload=${JSON.stringify(rUnload.run)} mirrorRowsAfterUnload=${askedUnload.length}(0=mirror gone with the faces) written=${existsSync(FORB_TARGET('l-unload-after'))}`)

  // ══ adjudication-input audit: every decision traces to a Team Grant record ──
  const allAsks = await approvals()
  const allGrants = (await grants()).rows
  const decided = allAsks.filter((x) => x.outcome === 'allowed-once' || x.outcome === 'rejected')
  const decidedFromGrant = decided.filter((x) => x.grantId !== undefined)
  const decidedWithoutGrantButAnswered = decided.filter((x) => x.grantId === undefined && x.decision !== 'lane-timeout' && x.decision !== 'foreign' && x.decision !== 'lane-refused')
  check('GOV-ADJUDICATION-INPUT-IS-TEAM-GRANT-ONLY', 'root governance claim, machine-checked: every Grant in the ledger was minted via the Team-lane actor tool call by the provisioned lane identity (via=team-lane-tool, issuerLane.label=lane agent), every answer traces to a grantId or to an explicit no-answer/no-grant posture, no decision was ever taken on model text, and no HTTP face could mint one',
    allGrants.length > 0 && decided.length > 0
    && allGrants.every((g) => g.via === 'team-lane-tool' && g.issuerLane.label === laneLabel && g.issuerLane.role === 'lane')
    && decidedWithoutGrantButAnswered.length === 0
    && decidedFromGrant.every((x) => allGrants.some((g) => g.grantId === x.grantId))
    && allAsks.filter((x) => String(x.modelTextLog ?? '').includes('A5PTC4-TOKEN')).every((x) => x.decision === 'replay-of-consumed' || x.decision === 'foreign'),
    `grants=${allGrants.length} via=${JSON.stringify([...new Set(allGrants.map((g) => g.via))])} issuer=${JSON.stringify([...new Set(allGrants.map((g) => g.issuerLane.label))])} answeredRows=${decided.length} fromGrant=${decidedFromGrant.length} unexplained=${JSON.stringify(decidedWithoutGrantButAnswered.map((x) => ({ d: x.decision, o: x.outcome })))}`)

  // ══ original permissions not lowered ═══════════════════════════════════════
  const modePost = {}
  for (const k of ['LANE', 'M1', 'M2', 'M3', 'FX']) modePost[k] = await modeOf(S[k])
  const forbFinal = lsDir(FORB)
  const controlled = new Set(['secret.txt', 'os-preflight-hack.txt', 'os-preflight-ws.txt',
    'l-anchor.txt', 'l-replay.txt', 'l-expiry.txt', 'l-revoke.txt', 'l-bind.txt',
    'l-xteam-foreign-present.txt', 'l-xteam.txt', 'l-q1.txt', 'l-q2.txt',
    'l-unload-after.txt', 'l-deleg-fx.txt'])
  const allowedWrites = new Set(['l-anchor.txt', 'l-xteam.txt', 'l-q1.txt'])
  const perSessionOk = ['LANE', 'M1', 'M2', 'M3', 'FX'].every((k) => modePre[k]?.mode === 'workspace-write' && modePost[k]?.mode === 'workspace-write'
    && String(modePre[k]?.approvalPolicy) === String(modePost[k]?.approvalPolicy))
  const unexpected = forbFinal.filter((f) => !controlled.has(f))
  const uncontrolledWrites = forbFinal.filter((f) => !allowedWrites.has(f) && f !== 'secret.txt' && !f.startsWith('os-preflight'))
  writeEvidence('permissions-census.json', { pre: modePre, post: modePost, forbFinal, secretUnchanged: sha256(readFileSync(SECRET)) === secretShaPre })
  check('PERM-ORIGINAL-NOT-LOWERED-NOT-WIDENED', 'root acceptance: every session\'s sandbox mode AND approval policy are byte-identical before/after (host session-init values, never written by this kit); the ONLY forbidden-zone files that exist are the three legs a Team Grant allowed (anchor, owner-use, Q1); the secret is byte-identical; the never-policy gate is host-side and runs before dispatch (user-approval decide(): effectivePolicy==="never" returns before the waterfall), so this resolver cannot open a hole for a never session',
    perSessionOk && uncontrolledWrites.length === 0 && unexpected.length === 0 && sha256(readFileSync(SECRET)) === secretShaPre,
    `pre=${JSON.stringify(Object.fromEntries(Object.entries(modePre).map(([k, v]) => [k, `${v.mode}/${v.approvalPolicy}`])))} post=${JSON.stringify(Object.fromEntries(Object.entries(modePost).map(([k, v]) => [k, `${v.mode}/${v.approvalPolicy}`])))} forb=${JSON.stringify(forbFinal)} unexpected=${JSON.stringify(unexpected)} secretUnchanged=${sha256(readFileSync(SECRET)) === secretShaPre}`)

  const stableAfter = await stableProbe()
  check('P-STABLE-UNTOUCHED', `:3080 stable instance untouched (pre=${stableBefore} post=${stableAfter}); this kit bound only ${HOST_PORT}`,
    stableBefore === stableAfter && stableBefore === 401, `pre=${stableBefore} post=${stableAfter}`)
  const pinnedHeadPost = gitAt(TESTUSE, 'rev-parse', 'HEAD')
  check('P-PRISTINE-POST', 'pinned host tree byte-clean after the run (HEAD unchanged, porcelain empty)',
    pinnedHeadPost === TEST_USE_BASELINE_SHA && gitAt(TESTUSE, 'status', '--porcelain') === '', `head=${pinnedHeadPost.slice(0, 12)}`)

  writeEvidence('approvals-census-final.json', await approvals())
  writeEvidence('grants-census-final.json', (await grants()).rows)
  writeEvidence('hooks-final.json', await hooks())
  writeEvidence('journal-tail.json', (await jrows()).slice(-40))

  const passCount = CRITERIA.filter((c) => c.pass).length
  const govPass = CRITERIA.filter((c) => c.governance && c.pass).length
  const govTotal = CRITERIA.filter((c) => c.governance).length
  const nonGovFail = CRITERIA.filter((c) => !c.governance && !c.pass)
  const govFail = CRITERIA.filter((c) => c.governance && !c.pass)
  console.log(`\n[${MODE.toUpperCase()}] criteria: ${passCount}/${CRITERIA.length} pass; governance set ${govPass}/${govTotal}`)
  let ok
  if (MODE === 'green') ok = nonGovFail.length === 0 && govFail.length === 0
  else ok = nonGovFail.length === 0 && govFail.length === govTotal // discrimination: all governance carried OFF
  console.log(`[${MODE.toUpperCase()}] verdict: ${ok ? 'EXPECTED' : 'DEVIATION'} (nonGovernanceFail=${nonGovFail.length} governanceFail=${govFail.length}/${govTotal})`)
  await finalize(ok ? (MODE === 'green' ? 'GREEN-ALL-PASS' : 'RED-ALL-EXPECTED-FAIL') : 'SOME-DEVIATION')
  process.exit(ok ? 0 : 2)
}

main().catch(async (error) => {
  console.error(String(error?.stack ?? error))
  try { writeEvidence('fatal.json', { message: String(error?.message ?? error), criteriaSoFar: CRITERIA }) } catch { /* last resort */ }
  await finalize('FATAL')
  process.exit(1)
})
