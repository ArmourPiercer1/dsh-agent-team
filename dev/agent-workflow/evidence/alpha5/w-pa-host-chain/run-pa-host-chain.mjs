#!/usr/bin/env node
/**
 * w-pa-host-chain — the M1 REAL-HOST reference chain (three legs over the
 * member's native `read` tool):
 *
 *   L1  ask-pending ZERO effect — a leader delegation makes the member's
 *       scripted model call the native `read` tool on an ephemeral fixture
 *       whose permission lane is ASK. Prove a durable Control ask request
 *       exists (remote team.getLedgerPage control-request-recorded fact +
 *       the leader-facing team_list_pending_control row) AND the read has
 *       NOT executed (no tool result row anywhere on the member wire; the
 *       fixture's CONTENT token appears in ZERO model-request bodies).
 *   L2  real approve, one read — resolve the request ALLOW over
 *       POST /team-remote/team.resolveControl (v4, cookie transport exactly
 *       as the prior-art kit). Prove the member tool row returns the fixture
 *       CONTENT, exactly ONE execution, and the durable trio
 *       recorded -> decided(allow) -> consumed on that callId (correlation).
 *   L3  deny ZERO effect — a second read of a DIFFERENT fixture goes ask;
 *       resolve DENY over the same endpoint. Prove the refusal row, the
 *       fixture never observed (its CONTENT token appears in ZERO model
 *       bodies, ever), decided(deny) durable, and NO consumption fact.
 *
 * REAL PRODUCTION CHAIN (no factory mocks, no unit-test substitutes):
 *   the public profile-patch seam mounts the production `dsh-agent-team`
 *   row from THIS worktree's packages/runtime/dist (createTeamProductionRoot
 *   + the real Control service + the real glue); a team is created through
 *   the real `team.create` wire; every decision rides the real remote
 *   `team.resolveControl` presenter path. The only test-side surface is the
 *   sanctioned mock-LLM position (packages/tools/harness/mock-deepseek.mjs)
 *   and the p6t6 observability row used ONLY for boot gating (never for a
 *   decision or an assertion this report rests on).
 *
 * Prior art adapted (NOT edited): tests/kits/pr-d-control-real-host
 * (control legs, ledger readers, cookie transport) and
 * dev/agent-workflow/evidence/alpha5/v4-flip/run-v4-live-leg.mjs (era-current
 * host spawn, preset-declaration seam, rc.2 tool_result wire).
 *
 * Discipline (TEST_METHODS): host = tests/deepseek-harness-test-use pristine
 * at the paths.mjs baseline (porcelain + HEAD verified BEFORE and AFTER);
 * DSH_HOME inside the workspace (tests/homes/<world>); ports from the 318x /
 * 349x family, dynamically picked, NEVER 3080/3180; the stable :3080/:3180
 * instances are probed read-only pre/post and never touched; boot tokens
 * REDACTED in every artifact; the world is removed at teardown unless --keep
 * (path then registered here in the header README of the run dir).
 *
 * Usage: node run-pa-host-chain.mjs [--host-port N] [--mock-port N] [--keep]
 * Exit: 0 = all legs PASS; 2 = any leg failed (FAILURE.md written verbatim);
 *       1 = fatal (environment / boot).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, closeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, homeDir } from '../../../../../tests/paths.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { startMockModel, sanitizeForFixture } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

// ── arguments / frozen facts ────────────────────────────────────────────────
const argv = process.argv.slice(2)
function argValue(name, dflt) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = argv[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const FLAG_KEEP = argv.includes('--keep')
// --plane: mount the production team TOOL PLANE (GLUE-5/Q4 placement route)
// under the row config — the shipped governed shape where the C-FS read row
// takes over the `read` spelling with a placement-attributed Binding. Run-1
// (plain world, no plane) proved the durable ask/decide/consume trio but the
// closed-world Guard refused the UNATTRIBUTED native read at dispatch
// (`the Tool Binding for "read" cannot be verified at dispatch time`) — the
// GLUE-8 A4.4 landing that natexe registered. The plane feed is the public
// row-config seam input this branch ships for exactly that lane.
const FLAG_PLANE = argv.includes('--plane')

const LEG_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(LEG_DIR, '../../../..', '..')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = join(LEG_DIR, 'runs', `live-${FLAG_PLANE ? 'plane-' : 'plain-'}${RUN_STAMP}`)
const HOME = homeDir(WORKTREE, `pa-host-chain-${FLAG_PLANE ? 'pl' : 'pn'}-${RUN_STAMP}`)
const LOCK_FILE = `${HOME}.lock`
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(RUN_DIR, 'blueprints')
const COMMAND_LINE = `node ${path.relative(WORKTREE, join(LEG_DIR, 'run-pa-host-chain.mjs'))}${process.argv.slice(2).length > 0 ? ' ' + process.argv.slice(2).join(' ') : ''} (worktree ${WORKTREE})`

const HOST_PORT_CANDIDATES = [3181, 3182, 3183, 3184, 3185, 3186]
const MOCK_PORT_CANDIDATES = [3497, 3498, 3499, 3500]
const HOST_PORT = Number(argValue('host-port', 0)) || null
const MOCK_PORT = Number(argValue('mock-port', 0)) || null

const SMOKE_PRESET_ID = 'rc2-smoke'
const ROOT = `session-pahc-root-${RUN_STAMP}` // the boot anchor team (row anchor)
const ROOT_P = `session-pahc-pa-${RUN_STAMP}` // the PA reference-chain team
const BP_ANCHOR_ID = 'team.pahc-anchor'
const BP_MAIN_ID = 'team.pahc-main'

// fixtures (EPHEMERAL: inside the world workspace, destroyed with the world)
const NONCE = RUN_STAMP
const FILE_A = join(WORKSPACE, `pahc-fixture-a-${NONCE}.txt`)
const FILE_B = join(WORKSPACE, `pahc-fixture-b-${NONCE}.txt`)
const CONTENT_A = `PAHC-CONTENT-A-${NONCE}`
const CONTENT_B = `PAHC-CONTENT-B-${NONCE}`

const MK = (p) => `PAHCMK_${p}_${RUN_STAMP}`
const TRIGGER_RE = /PAHCMK_[A-Z0-9_]+_[0-9T:-]+/g
const MK_DISC = MK('DISC')
const MK_LEAD1 = MK('LEAD1') // leader turn 1: create member + async delegate A
const MK_PEND = MK('PEND') // leader turn 2: list pending approvals (L1 evidence)
const MK_LEAD2 = MK('LEAD2') // leader turn 3: delegate B
const MK_MEMA = MK('MEMA') // member task A: read fixture A
const MK_MEMB = MK('MEMB') // member task B: read fixture B
const NOTIF_PREFIX = '[team-control requestId='

// ── logging / criteria / evidence (token redaction) ─────────────────────────
const CRITERIA = []
let FIRST_FAILURE = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  try { writeFileSync(join(RUN_DIR, 'run.log'), stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
}
function redactTokens(text) {
  return String(text)
    .replace(/token=([A-Za-z0-9_-]{8,})/g, (_m, tok) => `token=REDACTED-${createHash('sha256').update(tok).digest('hex').slice(0, 8)}`)
    .replace(/("token"\s*:\s*")[A-Za-z0-9_-]+(")/g, '$1<REDACTED>$2')
    .replace(/(dsh-auth-[A-Za-z0-9_-]+)/g, 'dsh-auth-<REDACTED>')
}
function scrubDir(dir) {
  if (!existsSync(dir)) return
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { scrubDir(p); continue }
    if (!st.isFile()) continue
    let raw
    try { raw = readFileSync(p, 'utf8') } catch { continue }
    const scrubbed = redactTokens(raw)
    if (scrubbed !== raw) writeFileSync(p, scrubbed)
  }
}
function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    const body = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    writeFileSync(join(RUN_DIR, name), redactTokens(body))
  } catch { /* best-effort */ }
}
function check(id, name, ok, detail) {
  const row = { id, name, ok: ok === true, detail: redactTokens(String(detail ?? '')).slice(0, 4000) }
  CRITERIA.push(row)
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id}: ${name}${detail ? ` — ${String(detail).slice(0, 400)}` : ''}`)
  if (ok !== true && FIRST_FAILURE === null) {
    FIRST_FAILURE = { id, name, detail: String(detail ?? ''), at: new Date().toISOString() }
    try {
      writeFileSync(join(RUN_DIR, 'FAILURE.md'),
        `# W-PA host chain — first real failure (verbatim)\n\n`
        + `* command: \`${COMMAND_LINE}\`\n`
        + `* at: ${FIRST_FAILURE.at}\n`
        + `* criterion: ${id} — ${name}\n`
        + `* verbatim detail:\n\n\`\`\`\n${String(detail ?? '(none)')}\n\`\`\`\n`)
    } catch { /* best-effort */ }
  }
  return ok === true
}
function dieFatal(msg, code = 1) {
  log(`FATAL ${msg}`)
  if (FIRST_FAILURE === null) {
    FIRST_FAILURE = { id: 'FATAL', name: 'fatal', detail: String(msg), at: new Date().toISOString() }
    try {
      writeFileSync(join(RUN_DIR, 'FAILURE.md'),
        `# W-PA host chain — first real failure (verbatim, fatal)\n\n`
        + `* command: \`${COMMAND_LINE}\`\n`
        + `* at: ${FIRST_FAILURE.at}\n`
        + `* verbatim error:\n\n\`\`\`\n${String(msg)}\n\`\`\`\n`)
    } catch { /* best-effort */ }
  }
  writeEvidence('summary.json', { runStamp: RUN_STAMP, command: COMMAND_LINE, fatal: String(msg), criteria: CRITERIA, firstFailure: FIRST_FAILURE, pass: false, exitCode: code })
  try { scrubDir(RUN_DIR) } catch { /* best-effort */ }
  if (!FLAG_KEEP) {
    try { rmSync(HOME, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(LOCK_FILE, { force: true }) } catch { /* ok */ }
  }
  process.exit(code)
}
function logTail(logPath, n = 150) {
  try { return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n') } catch { return '<no log>' }
}

// ── http helpers (prior-art kit shapes) ─────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 240_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch(() => ({ status: 0 }))
  let body = null
  if (res.status !== 0) {
    const text = await res.text().catch(() => '')
    try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  }
  return { status: res.status, body }
}
async function probeUrl(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned HTTP ${res.status} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}
const TRANSCRIPT = []
function noteTranscript(entry) { TRANSCRIPT.push({ at: new Date().toISOString(), ...entry }) }
async function remoteCall(origin, cookie, method, params, tag = 'pahc', version = 1, timeoutMs = 240_000) {
  const res = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
  noteTranscript({ kind: 'remote', method, version, params: JSON.parse(JSON.stringify(sanitizeForFixture(params, { maxTextLength: 300 }))), status: res.status, body: JSON.parse(JSON.stringify(sanitizeForFixture(res.body, { maxTextLength: 600 }))) })
  return res
}
async function remoteCallReady(host, method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host.origin, host.cookie, method, params, tag, version)
    if (last.status !== 429) return last
    await new Promise((r) => setTimeout(r, 1500))
  }
  return last
}
function resultError(body) {
  const r = body?.result
  if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }
  if (r.ok !== true) return r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }
  return null
}
function resultData(body) {
  const r = body?.result
  if (r === undefined || r.ok !== true) return null
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v) return v.data
  return v
}
async function apiPrompt(host, sessionId, text, tag = 'pahc') {
  const res = await fetchJson(`${host.origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: host.cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  })
  noteTranscript({ kind: 'prompt', sessionId, text: redactTokens(String(text)).slice(0, 240), status: res.status, body: JSON.parse(JSON.stringify(sanitizeForFixture(res.body, { maxTextLength: 400 }))) })
  return res
}
async function p6t6Get(port, what) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/${what}`, undefined, 30_000) }
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    let text = ''
    try { text = readFileSync(logPath, 'utf8') } catch { /* not yet */ }
    const lines = text === '' ? [] : text.split('\n')
    for (let i = seen; i < lines.length; i += 1) {
      const m = regex.exec(lines[i])
      if (m !== null) return lines[i]
    }
    seen = lines.length
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  try {
    const full = readFileSync(logPath, 'utf8')
    for (const l of full.split('\n')) {
      const m = regex.exec(l)
      if (m !== null) return l
    }
  } catch { /* best-effort */ }
  return null
}

// ── mock oracle helpers (rc.2 wire shapes, prior-art kit) ───────────────────
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-pahc-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function messagesOfParsed(parsed) {
  const msgs = parsed?.messages
  return Array.isArray(msgs) ? msgs : []
}
function msgText(m) {
  return typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
}
function firstUserText(parsed) {
  const m = messagesOfParsed(parsed).find((x) => x?.role === 'user')
  return m === undefined ? '' : msgText(m)
}
function lastUserText(parsed) {
  const messages = messagesOfParsed(parsed).filter((m) => m?.role === 'user')
  return messages.length === 0 ? '' : msgText(messages[messages.length - 1])
}
function indexAfterLastUserWith(parsed, marker) {
  const messages = messagesOfParsed(parsed)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user' && msgText(messages[i]).includes(marker)) return i
  }
  return -1
}
/** Completed tool results after an index (rc.2 wire: tool_result parts ride
 *  role=user messages; role:'tool' never appears on this host generation). */
function toolResultsAfter(parsed, idx) {
  const messages = messagesOfParsed(parsed)
  const out = []
  for (const m of messages.slice(idx + 1)) {
    if (m?.role === 'tool') { out.push({ id: m.tool_call_id ?? null, text: msgText(m) }); continue }
    if (m?.role !== 'user') continue
    if (typeof m.content === 'string') {
      if (m.content.includes('"tool_result"')) out.push({ id: null, text: m.content })
      continue
    }
    if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part?.type === 'tool_result') {
          const c = part.content
          const text = typeof c === 'string' ? c : Array.isArray(c)
            ? c.map((b) => (b?.type === 'text' && typeof b.text === 'string' ? b.text : JSON.stringify(b ?? ''))).join('\n')
            : JSON.stringify(c ?? '')
          out.push({ id: part.tool_use_id ?? null, text })
        }
      }
    }
  }
  return out
}
function allToolResults(parsed) { return toolResultsAfter(parsed, -1) }
function extractInstanceId(text) {
  const t = String(text ?? '')
  const m =
    /instanceId\\?"\s*:\s*\\?"(inst-[A-Za-z0-9][A-Za-z0-9-]{3,64})/.exec(t) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(t) ??
    /(inst-[A-Za-z0-9][A-Za-z0-9-]{3,64})/.exec(t)
  return m === null ? null : m[1]
}
function isTitleCall(parsed) {
  const first = messagesOfParsed(parsed)[0]
  const t = typeof first?.content === 'string'
    ? first.content
    : first?.role === 'user' && Array.isArray(first?.content)
      ? String(first.content[0]?.text ?? '')
      : ''
  return first?.role === 'user' && (/^Create a concise title/.test(t) || /^Generate the session title/.test(t))
}

/**
 * The scripted oracle. Attribution rule (natexe prior art): the conversation
 * OPENING prompt attributes member chains (the leader transcript carries the
 * member markers downstream inside delegation tool_use JSON — downstream text
 * is not a witness). Leader turns route on their OWN kit markers, newest
 * first. Notification turns are model-neutral: every decision of this chain
 * rides the REAL remote wire.
 */
function makeDecide() {
  let issued = 0
  return function decide({ req }) {
    issued += 1
    if (issued > 140) return { kind: 'text', content: 'PAHC_CIRCUIT_BREAK' }
    if (isTitleCall(req)) return { kind: 'text', content: 'pahc host chain session' }
    const opener = firstUserText(req)
    const lastUser = lastUserText(req)

    // leader turns (own kit markers, newest first)
    {
      const i2 = indexAfterLastUserWith(req, MK_LEAD2)
      if (i2 !== -1) {
        const tools = toolResultsAfter(req, i2)
        switch (tools.length) {
          case 0: {
            const seen = allToolResults(req).map((r) => extractInstanceId(r.text)).find((v) => v !== null) ?? null
            if (seen === null) return { kind: 'text', content: 'PAHC_LEAD2_NO_INSTANCE' }
            return toolCall('team_delegate', {
              rootSessionId: ROOT_P,
              requestToken: `pahc-delegate-b-${NONCE}`,
              delegationInstanceId: seen,
              label: 'w1',
              prompt: `${MK_MEMB} Read the file ${FILE_B} with the read tool exactly once, then report its first line. Use no other tool.`,
              async: true,
            })
          }
          case 1: return { kind: 'text', content: 'PAHC_LEAD2_DELEGATED' }
          default: return { kind: 'text', content: `PAHC_LEAD2_FALLTHROUGH tools=${tools.length}` }
        }
      }
      const iP = indexAfterLastUserWith(req, MK_PEND)
      if (iP !== -1) {
        const tools = toolResultsAfter(req, iP)
        switch (tools.length) {
          case 0: return toolCall('team_list_pending_control', {
            rootSessionId: ROOT_P,
            requestToken: `pahc-pending-list-${NONCE}`,
          })
          case 1: return { kind: 'text', content: 'PAHC_PEND_LISTED' }
          default: return { kind: 'text', content: `PAHC_PEND_FALLTHROUGH tools=${tools.length}` }
        }
      }
      const i1 = indexAfterLastUserWith(req, MK_LEAD1)
      if (i1 !== -1) {
        const tools = toolResultsAfter(req, i1)
        switch (tools.length) {
          case 0: return toolCall('team_create_member', {
            rootSessionId: ROOT_P,
            requestToken: `pahc-create-${NONCE}`,
            delegationTemplateId: 'worker',
            label: 'w1',
          })
          case 1: {
            const id = extractInstanceId(tools[0]?.text)
            if (id === null) return { kind: 'text', content: `PAHC_LEAD1_EXTRACT_FAIL :: ${String(tools[0]?.text).slice(0, 300)}` }
            return toolCall('team_delegate', {
              rootSessionId: ROOT_P,
              requestToken: `pahc-delegate-a-${NONCE}`,
              delegationInstanceId: id,
              label: 'w1',
              prompt: `${MK_MEMA} Read the file ${FILE_A} with the read tool exactly once, then report its first line. Use no other tool.`,
              async: true,
            })
          }
          case 2: return { kind: 'text', content: 'PAHC_LEAD1_DELEGATED' }
          default: return { kind: 'text', content: `PAHC_LEAD1_FALLTHROUGH tools=${tools.length}` }
        }
      }
    }

    // member chains — attribution by the conversation OPENING prompt only
    if (opener.includes(MK_MEMA) || opener.includes(MK_MEMB)) {
      const bIdx = indexAfterLastUserWith(req, MK_MEMB)
      const aIdx = indexAfterLastUserWith(req, MK_MEMA)
      if (bIdx > aIdx) {
        const tools = toolResultsAfter(req, bIdx)
        switch (tools.length) {
          case 0: return toolCall('read', { file_path: FILE_B })
          case 1: {
            const r = String(tools[0]?.text ?? '')
            if (r.includes(CONTENT_B)) return { kind: 'text', content: 'PAHC_MEMB_UNEXPECTED_CONTENT' }
            if (/denied/i.test(r)) return { kind: 'text', content: 'PAHC_MEMB_REFUSED' }
            return { kind: 'text', content: `PAHC_MEMB_UNKNOWN :: ${r.slice(0, 160)}` }
          }
          default: return { kind: 'text', content: `PAHC_MEMB_FALLTHROUGH tools=${tools.length}` }
        }
      }
      if (aIdx !== -1) {
        const tools = toolResultsAfter(req, aIdx)
        switch (tools.length) {
          case 0: return toolCall('read', { file_path: FILE_A })
          case 1: {
            const r = String(tools[0]?.text ?? '')
            if (r.includes(CONTENT_A)) return { kind: 'text', content: 'PAHC_MEMA_READ_OK' }
            return { kind: 'text', content: `PAHC_MEMA_NO_CONTENT :: ${r.slice(0, 160)}` }
          }
          default: return { kind: 'text', content: `PAHC_MEMA_FALLTHROUGH tools=${tools.length}` }
        }
      }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'PAHC_DISC_DONE' }
    // inbox notification turns (control asks, member completions): neutral.
    if (lastUser.startsWith(NOTIF_PREFIX) || lastUser.includes('[team') || lastUser.includes('"requestId"')) {
      return { kind: 'text', content: 'PAHC_NOTED' }
    }
    return { kind: 'text', content: 'PAHC_IDLE' }
  }
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.filter(pred).pop()
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { log(`mock wait timed out: ${label} (requests=${mock.requests.length})`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}
/** True when EVERY model-request body ever recorded contains `token`. */
function contentObserved(mock, token) {
  const hits = []
  for (const r of mock.requests) {
    try {
      if (JSON.stringify(r.body ?? '').includes(token)) hits.push(r.seq)
    } catch { /* skip unserializable */ }
  }
  return hits
}

// ── durable control ledger (remote wire + local forensics) ──────────────────
function safeParse(v) {
  if (v === null || v === undefined) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return { raw: String(v).slice(0, 400) } }
}
async function remoteControlFacts(host) {
  const byType = {
    'control-request-recorded': [],
    'control-decision-recorded': [],
    'control-allow-consumed': [],
    'control-request-abandoned': [],
  }
  let afterSequence = 0
  let totalEntries = 0
  for (let pageNo = 0; pageNo < 50; pageNo += 1) {
    const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_P, afterSequence, limit: 500 }, `pahc-ledger-${pageNo + 1}`, 1)
    const pageErr = resultError(page.body)
    if (pageErr !== null) throw new Error(`team.getLedgerPage failed (page ${pageNo + 1}, afterSequence=${afterSequence}): ${pageErr.code} ${String(pageErr.message).slice(0, 300)}`)
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    totalEntries += entries.length
    for (const e of entries) {
      if (byType[e?.factType] !== undefined) byType[e.factType].push({ sequence: e.sequence, payload: safeParse(e.payload) })
    }
    const next = data?.nextAfterSequence
    if (next === null || next === undefined || entries.length === 0) break
    afterSequence = Number(next)
  }
  return { totalEntries, byType }
}
function derivedStatus(facts, requestId) {
  if (facts.byType['control-request-abandoned'].some((f) => f.payload.requestId === requestId)) return 'abandoned'
  if (facts.byType['control-decision-recorded'].some((f) => f.payload.requestId === requestId)) return 'decided'
  return 'pending'
}
async function waitForControlRequest(host, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const { byType } = await remoteControlFacts(host)
    const hit = byType['control-request-recorded'].find((f) => pred(f.payload))
    if (hit !== undefined) return hit.payload
    if (Date.now() >= deadline) { log(`control-request wait timed out: ${label}`); return null }
    await new Promise((r) => setTimeout(r, 1000))
  }
}
/** Raw durable ledger facts (FULL payloads, no projection stripping) —
 *  the only admissible source for manifest-presence claims. */
function readControlLedgerRaw() {
  const out = []
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') return out
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      let entry
      try { entry = JSON.parse(v) } catch { continue }
      if (entry?.factType === 'control-request-recorded') out.push(entry.payload ?? {})
    }
  } catch { /* pre-ledger worlds: empty; checks then fail CLOSED */ }
  return out
}
/** Local read-only forensic cross-check of the durable ledger. */
function readControlLedger(root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter') continue
      const entry = safeParse(v)
      if (String(entry?.rootSessionId) !== root) continue
      const payload = safeParse(entry?.payload)
      if (entry.factType === 'control-request-recorded') out.requests.push(payload)
      else if (entry.factType === 'control-decision-recorded') out.decisions.push(payload)
      else if (entry.factType === 'control-allow-consumed') out.consumptions.push(payload)
    }
  } catch (error) { out.error = String(error?.message ?? error) }
  return out
}
function correlationOf(payload) {
  if (typeof payload?.correlation === 'string') return payload.correlation
  if (typeof payload?.scope?.correlation === 'string') return payload.scope.correlation
  return null
}

// ── YAML emit (prior-art kit shape) ─────────────────────────────────────────
function yamlScalar(value) {
  if (value === null) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const s = String(value)
  if (/^[A-Za-z0-9._\-/ ]+$/.test(s) && !/^\s|\s$/.test(s)) return s
  return JSON.stringify(s)
}
function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}${key}: []`]
    return [`${pad}${key}:`, ...value.map((item) => yamlEmitItem(item, indent + 1)).flat()]
  }
  if (value !== null && typeof value === 'object') {
    const empty = Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: {}`]
    return [`${pad}${key}:`, ...Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

// ── blueprints ──────────────────────────────────────────────────────────────
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the pahc boot team. ${MK_DISC} is the discovery marker."`,
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the pahc boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** The PA reference-chain team: the WORKER declares capabilities.permissions
 *  with default ASK and NO allow subtree — every exercise fixture sits
 *  outside any allow subtree (there is none), so its native `read` lands on
 *  the ASK lane (the durable leader-approval path). */
function mainBlueprintYaml(denyList) {
  const denyBlock = (pad) => denyList.length === 0
    ? [`${pad}builtinToolDeny: []`]
    : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${BP_MAIN_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the pahc reference team. When a member ask notification arrives, acknowledge it in one short line; the human decisions ride the external wire. ${MK_LEAD1} ${MK_PEND} ${MK_LEAD2}`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_list_members',
    '        - team_list_templates',
    '        - team_create_member',
    '        - team_delegate',
    '        - team_collect',
    '        - team_follow_up',
    '        - team_list_pending_control',
    ...(denyList.length === 0
      ? ['    builtinToolDeny: []']
      : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify(`You are worker w1 of the pahc reference team. Follow the delegated task exactly, tool by tool, in order; use only the tools the task names. ${MK_MEMA} ${MK_MEMB}`)}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items: []',
    ...(denyList.length === 0
      ? ['      builtinToolDeny: []']
      : ['      builtinToolDeny:', ...denyList.map((n) => `        - ${n}`)]),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    // [REJECTED VARIANT — do not re-apply without a root ruling] A prior
    // edit set default: allow / ask: [] under a FALSE "root ruling" label.
    // Root never ruled this; the schema itself refuses the shape:
    //   MALFORMED_DTO: permissions.default must be one of ask | deny
    //   (no silent privilege expansion). Kept as evidence, reverted.
    '        default: ask',
    '        allow: []',
    '        ask:',
    '          - tool: read',
    '            resource:',
    '              kind: any',
    '        deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - create-member',
    '    - assign-task',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

// ── row config + profile patch (production row, public seam only) ───────────
const PLANE_REALM_ID = `pahc-realm-${RUN_STAMP.slice(0, 10)}`
function teamRowConfig() {
  const cfg = {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'pahc-live-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
  if (FLAG_PLANE) {
    // The shipped governed shape (natexe pattern, read-row variant): the
    // C-FS production provider anchors at the world workspace; the read row
    // mounts under the `read` spelling (the shipped default readName
    // takeover) with a placement-attributed Binding. No confined provider —
    // this chain never executes a shell row (the closed world simply has no
    // shell backend).
    cfg.teamToolPlane = {
      realmId: PLANE_REALM_ID,
      fsInstance: { fs: 'pahc-ctl', rootDir: WORKSPACE, realmId: PLANE_REALM_ID, kind: 'absolute-path' },
    }
  }
  return cfg
}
function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# w-pa-host-chain live patch (run ${RUN_STAMP}): production dsh-agent-team row (THIS worktree's built dist) + p6t6 observability + smoke preset — public profile-patch seam only (CORE PATCH BUDGET = 0).`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: SMOKE_PRESET_ID,
      displayName: 'pahc live',
      description: `pahc host-chain live preset (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
      plugins: smokePresetPlugins({
        personaText: 'You are a coding agent powered by the {{model}} model.',
        cwdSuffix: 'Your working directory is {{cwd}}.',
        bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
      }),
    }), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        cwd: WORKSPACE,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'pahc-live-mock-key',
        },
      },
    )
  } catch (error) {
    closeSync(outFd); closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined }
  child.on('error', (e) => { exitInfo.exited = true; exitInfo.signal = `spawn-error:${e.message}` })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  return { child, exitInfo, alive: () => !exitInfo.exited }
}
async function stopHost(h) {
  try { h.child.kill() } catch { /* gone */ }
  const deadline = Date.now() + 20_000
  for (;;) {
    if (h.exitInfo.exited) return h.exitInfo
    if (Date.now() >= deadline) { try { h.child.kill('SIGKILL') } catch { /* gone */ } return { ...h.exitInfo, killedForced: true } }
    await new Promise((r) => setTimeout(r, 250))
  }
}

// ── member-wire forensics (from the mock's recorded requests) ───────────────
/** Member sessions are attributed by the conversation OPENING prompt (the
 *  delegation prompt carries MK_MEMA/MK_MEMB); the leader transcript carries
 *  the member markers downstream inside delegation tool_use JSON, so it must
 *  never qualify. `marker` then selects the wire of a concrete chain. */
function memberWires(mock, marker) {
  return mock.requests.filter((r) => {
    if (r.body === null) return false
    const opener = firstUserText(r.body)
    if (!opener.includes(MK_MEMA) && !opener.includes(MK_MEMB)) return false
    return JSON.stringify(messagesOfParsed(r.body)).includes(marker)
  })
}
function lastMemberWire(mock, marker) {
  const reqs = memberWires(mock, marker)
  return reqs.length === 0 ? null : reqs[reqs.length - 1].body
}
function toolRowsWithText(mock, marker, token) {
  const wire = lastMemberWire(mock, marker)
  if (wire === null) return []
  return allToolResults(wire).filter((r) => r.text.includes(token))
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  log(`W-PA host chain — stamp=${RUN_STAMP}`)
  log(`command: ${COMMAND_LINE}`)
  log(`worktree=${WORKTREE} testuse=${TESTUSE} home=${HOME}`)

  if (!existsSync(HOST_BIN)) dieFatal(`test-use host bin missing: ${HOST_BIN}`)
  if (!existsSync(PRODUCTION_ROW_PATH)) dieFatal(`production row dist missing (run pnpm -r run build in the worktree): ${PRODUCTION_ROW_PATH}`)
  if (!existsSync(P6T6_PLUGIN_PATH)) dieFatal(`p6t6 row source missing: ${P6T6_PLUGIN_PATH}`)

  // H1(pre): the test-use tree must be pristine at the paths.mjs baseline.
  const revPre = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirtyPre = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  check('H1.pre', 'test-use pristine at the paths.mjs baseline BEFORE', revPre === TEST_USE_BASELINE_SHA && (dirtyPre ?? 'x') === '', `head=${revPre} porcelain=${JSON.stringify(dirtyPre)}`)
  if (revPre !== TEST_USE_BASELINE_SHA || (dirtyPre ?? 'x') !== '') dieFatal(`test-use not pristine-at-baseline: HEAD=${revPre} dirty=${JSON.stringify(dirtyPre)}`)
  writeFileSync(join(RUN_DIR, 'testuse-head-pre.txt'), `${revPre}\n`)

  const preStable = { p3080: await probeUrl('http://127.0.0.1:3080/'), p3180: await probeUrl('http://127.0.0.1:3180/') }
  writeEvidence('pre-stable-probe.json', preStable)

  // fresh world (fail closed) + ports
  if (existsSync(HOME) && readdirSync(HOME).length > 0) dieFatal(`DSH home ${HOME} exists and is non-empty — fail CLOSED`)
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({ world: HOME, pid: process.pid, kit: 'run-pa-host-chain.mjs', runStamp: RUN_STAMP, at: new Date().toISOString() }, null, 2))

  async function pickPort(candidates, label) {
    for (const p of candidates) {
      const probe = await probeUrl(`http://127.0.0.1:${p}/`)
      if (probe.status === 'unreachable') { log(`${label}: picked free port ${p}`); return p }
      log(`${label}: port ${p} busy (${probe.status}), trying next`)
    }
    dieFatal(`${label}: no free port in [${candidates.join(', ')}]`)
    return 0
  }
  const hostPort = HOST_PORT ?? await pickPort(HOST_PORT_CANDIDATES, 'host')
  const mockPort = MOCK_PORT ?? await pickPort(MOCK_PORT_CANDIDATES, 'mock')
  writeEvidence('ports.json', { hostPort, mockPort, policy: '3181-3186 / 3491-3500; NEVER 3080/3180' })

  // fixtures (ephemeral, inside the world workspace)
  writeFileSync(FILE_A, `${CONTENT_A}\nline-two-of-A\n`)
  writeFileSync(FILE_B, `${CONTENT_B}\nline-two-of-B\n`)

  const mockLog = join(RUN_DIR, 'mock.log')
  const mock = await startMockModel({
    port: mockPort,
    decide: makeDecide(),
    log: (l) => { try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  log(`mock model on ${mock.port}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  writePatchFile(HOME)
  writeFileSync(join(BLUEPRINT_DIR, 'pahc-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT }, null, 2))

  const hostProc = spawnHost({ port: hostPort, home: HOME, logPath: instanceLog, mockPort: mock.port })
  let hostStopped = false
  const stopOnce = async () => { if (!hostStopped) { hostStopped = true; await stopHost(hostProc) } }
  const host = { origin: null, cookie: null, port: hostPort }

  // hoisted (the summary/teardown section reads them; a TDZ ReferenceError
  // there would hide the real verdict)
  let recA = null
  let recB = null
  let recAAll = []
  let modelCallIdA = null

  let exitCode = 0
  try {
    // ── boot ────────────────────────────────────────────────────────────────
    const line = await waitForLogLine(instanceLog, BOOT_MARKER, 360_000, hostProc.alive)
    if (line === null) {
      await stopOnce()
      dieFatal(`host boot failed${hostProc.exitInfo.exited ? ` (exit ${hostProc.exitInfo.code}/${hostProc.exitInfo.signal})` : ''}\n--- instance.log tail ---\n${logTail(instanceLog)}`)
    }
    const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
    if (m === null) dieFatal(`unexpected boot line shape: ${redactTokens(line)}`)
    host.origin = `http://127.0.0.1:${m[1]}`
    host.cookie = await authenticate(host.origin, m[2]).catch((e) => dieFatal(`auth failed: ${e.message}`))
    {
      const deadline = Date.now() + 240_000
      for (;;) {
        const hb = await p6t6Get(hostPort, 'health')
        if (hb.status === 200 && hb.body?.ok === true) break
        if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
          await stopOnce()
          dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 800)}\n--- tail ---\n${logTail(instanceLog)}`)
        }
        if (Date.now() >= deadline) { await stopOnce(); dieFatal(`row health not ready in 240s\n--- tail ---\n${logTail(instanceLog)}`) }
        await new Promise((r) => setTimeout(r, 1000))
      }
      const st0 = Date.now() + 120_000
      for (;;) {
        const st = await p6t6Get(hostPort, 'state')
        const b = st.body
        if (st.status === 200 && b !== null && typeof b === 'object' && b.rootSessionId === ROOT && b.phase === 'create' && b.teamSession !== null) break
        if (Date.now() >= st0) { await stopOnce(); dieFatal(`row state not well-formed in 120s; last=${JSON.stringify(st.body).slice(0, 400)}`) }
        await new Promise((r) => setTimeout(r, 500))
      }
    }
    check('A1.0', 'real host booted on the production row (profile-patch seam; anchor team alive)', true, `origin=${host.origin}`)

    // ── DISC: live tool surface → the coverage-gate deny list ───────────────
    const disc = await apiPrompt(host, ROOT, `${MK_DISC} Report your tool inventory, then finish.`, 'pahc-disc')
    log(`disc prompt status=${disc.status}`)
    const discReq = await waitForMock(mock, (r) => r.body !== null && lastUserText(r.body).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 180_000, 'DISC model request')
    if (discReq === null) dieFatal('DISC model request never observed\n--- tail ---\n' + logTail(instanceLog))
    const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
    const MANAGED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'todo_write']
    const TEAM_TOOLS = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress', 'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member']
    const denyList = surface.filter((n) => !MANAGED.includes(n) && !TEAM_TOOLS.includes(n) && !n.startsWith('team_') && n !== 'subagent')
    writeEvidence('l0-surface.json', { surface, denyList })
    check('A1.1', 'boot surface carries the native read tool (unmanaged remainder computed)', surface.includes('read'), `surface=${surface.length} deny=${denyList.length}`)

    // ── the PA team through the real product creation wire ──────────────────
    writeFileSync(join(BLUEPRINT_DIR, 'pahc-main.yaml'), mainBlueprintYaml(denyList))
    let created = null
    {
      const deadline = Date.now() + 120_000
      for (;;) {
        created = await remoteCallReady(host, 'team.create', { rootSessionId: ROOT_P, blueprintId: BP_MAIN_ID }, 'pahc-create-team', 1)
        if (resultError(created.body) === null || Date.now() >= deadline) break
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    const createErr = resultError(created.body)
    check('A2.0', 'team.create over the real wire bound the strict PA blueprint on a fresh root', createErr === null, createErr === null ? `root=${ROOT_P}` : JSON.stringify(createErr).slice(0, 400))
    if (createErr !== null) dieFatal(`team.create failed: ${JSON.stringify(createErr).slice(0, 600)}`)

    // ── L1: delegation → member native read → ask pending, ZERO effect ──────
    const p1 = await apiPrompt(host, ROOT_P, `${MK_LEAD1} Create one member from template worker labeled w1, then delegate task ${MK_MEMA} to it asynchronously (async true).`, 'pahc-lead1')
    log(`lead1 prompt status=${p1.status}`)
    if (!(p1.status === 200 && p1.body?.result?.ok === true)) dieFatal(`lead1 prompt not admitted: status=${p1.status} body=${JSON.stringify(p1.body).slice(0, 300)}`)
    const delegated = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('PAHC_LEAD1_'), 240_000, 'leader create+delegate')
    if (delegated === null) dieFatal(`leader create+delegate turn did not complete (requests=${mock.requests.length})\n--- tail ---\n${logTail(instanceLog)}`)
    check('A3.0', 'leader ran team_create_member + async team_delegate through the real team tools', true, `reply=${delegated.reply.content}`)

    // the member's scripted native read call reaches the model surface
    const readCallA = await waitForMock(mock, (r) => r.reply?.kind === 'tool-call'
      && (r.reply.toolCalls ?? []).some((c) => c.name === 'read' && String(c.arguments?.file_path ?? '') === FILE_A),
    180_000, 'member read(A) tool-call')
    if (readCallA === null) dieFatal(`member never issued the scripted read(${FILE_A})\n--- last member wire ---\n${JSON.stringify(sanitizeForFixture(lastMemberWire(mock, MK_MEMA) ?? {}, { maxTextLength: 300 })).slice(0, 800)}`)
    modelCallIdA = (readCallA.reply.toolCalls ?? [])[0]?.id ?? null

    // the durable ask request (remote product read plane)
    // NOTE (evidence-layer correction): the mint attribution of the durable
    // row must be read from the DURABLE fact payload (raw team_domain.json),
    // not from this wire projection — team.getLedgerPage's projection drops
    // fields (e.g. reviewPayload), so "field absent here" ≠ "absent durable".
    recA = await waitForControlRequest(host, (p) => String(p.summary ?? '').includes(`pahc-fixture-a-${NONCE}`), 180_000, 'L1 ask request (fixture A)')
    if (recA === null) {
      const snap = await remoteControlFacts(host)
      writeEvidence('l1-timeout-facts.json', snap)
      dieFatal(`L1: no durable control-request-recorded for fixture A within 180s (ledger entries=${snap.totalEntries})`)
    }
    const factsL1 = await remoteControlFacts(host)
    const recAAll = factsL1.byType['control-request-recorded'].filter((f) => f.payload.requestId === recA.requestId)
    const decAAll = factsL1.byType['control-decision-recorded'].filter((f) => f.payload.requestId === recA.requestId)
    const conAAll = factsL1.byType['control-allow-consumed'].filter((f) => f.payload.requestId === recA.requestId)
    check('L1.1', 'L1: the member native read on the ASK-lane fixture created exactly ONE durable control-request-recorded fact (toolName=read, kind=leader-approval, correlation=callId)',
      recAAll.length === 1 && recA.toolName === 'read' && typeof correlationOf(recA) === 'string' && correlationOf(recA).length > 0,
      `requestId=${recA.requestId} recorded=${recAAll.length} payload=${JSON.stringify(sanitizeForFixture(recA, { maxTextLength: 300 }))}`)
    {
      // PA-manifest proof, read ONLY from the DURABLE fact (raw ledger), not
      // from this wire projection (which drops reviewPayload). This block
      // therefore inspects readControlLedger() for the matching requestId;
      // if the durable payload carries no PA manifest, that IS the finding.
      const durable = readControlLedgerRaw().find((x) => x.requestId === recA.requestId) ?? {}
      const rp = durable.reviewPayload ?? {}
      check('L1.PA', 'L1: the DURABLE row is the PA effect-set manifest — actionName=team-tool-execute, reviewPayload manifest present, operationFingerprint ≡ reviewPayloadDigest',
        durable.actionName === 'team-tool-execute'
        && typeof durable.reviewPayloadDigest === 'string' && (durable.reviewPayloadDigest ?? '').length > 0
        && durable.operationFingerprint === durable.reviewPayloadDigest
        && typeof rp.approvalCaseId === 'string' && (rp.approvalCaseId ?? '').length > 0
        && rp.effects !== undefined && typeof rp.effects?.fingerprint === 'string',
        `actionName=${String(durable.actionName)} digest=${String(durable.reviewPayloadDigest).slice(0, 18)} opFp=${String(durable.operationFingerprint).slice(0, 18)} rpKeys=${Object.keys(rp).slice(0, 8).join(',')}`)
    }
    check('L1.2', 'L1: the request is PENDING on the durable plane (no decision fact, no consumption fact)',
      derivedStatus(factsL1, recA.requestId) === 'pending' && decAAll.length === 0 && conAAll.length === 0,
      `status=${derivedStatus(factsL1, recA.requestId)} decisions=${decAAll.length} consumptions=${conAAll.length}`)

    // the leader-facing pending-approvals surface (product model tool, real wire)
    const pendTurn = await apiPrompt(host, ROOT_P, `${MK_PEND} List the pending control requests now.`, 'pahc-pend')
    if (!(pendTurn.status === 200 && pendTurn.body?.result?.ok === true)) log(`WARN: pending-list prompt not admitted status=${pendTurn.status}`)
    const pendDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('PAHC_PEND_'), 180_000, 'leader pending-list turn')
    {
      // the leader turn ran team_list_pending_control; the durable row it
      // returned is the pending-approvals surface evidence.
      const pendReqs = mock.requests.filter((r) => r.body !== null && indexAfterLastUserWith(r.body, MK_PEND) !== -1 && toolResultsAfter(r.body, indexAfterLastUserWith(r.body, MK_PEND)).length > 0)
      const pendReq = pendReqs.length > 0 ? pendReqs[pendReqs.length - 1].body : null
      const rows = pendReq === null ? [] : toolResultsAfter(pendReq, indexAfterLastUserWith(pendReq, MK_PEND))
      const rowText = rows.map((r) => r.text).join('\n')
      const listed = rowText.includes(recA.requestId)
      writeEvidence('l1-pending-list.json', { doneReply: pendDone?.reply?.content ?? null, rowText: JSON.parse(JSON.stringify(sanitizeForFixture(rowText.slice(0, 3000), { maxTextLength: 2000 }))) })
      check('L1.3', 'L1: the pending-approvals list (team_list_pending_control over the product wire) carries the ask request', listed, `listed=${listed} reply=${pendDone?.reply?.content ?? 'TIMEOUT'} rowHead=${rowText.slice(0, 200).replace(/\s+/g, ' ')}`)
    }

    // ZERO effect: the read never executed (bounded settle window first)
    await new Promise((r) => setTimeout(r, 5_000))
    const observedA = contentObserved(mock, CONTENT_A)
    const rowsA = toolRowsWithText(mock, MK_MEMA, CONTENT_A)
    const memberDoneA = mock.requests.find((r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '') === 'PAHC_MEMA_READ_OK')
    writeEvidence('l1-evidence.json', {
      recorded: JSON.parse(JSON.stringify(sanitizeForFixture(recAAll, { maxTextLength: 400 }))),
      derivedStatus: derivedStatus(factsL1, recA.requestId),
      contentAObservedInModelRequests: observedA,
      memberContentRows: rowsA.length,
      memberDoneA: memberDoneA !== undefined,
      modelCallIdA,
    })
    check('L1.4', 'L1: the read has NOT executed — zero tool-result rows carry the fixture content and its CONTENT token appears in ZERO model-request bodies',
      rowsA.length === 0 && observedA.length === 0 && memberDoneA === undefined,
      `contentRows=${rowsA.length} modelBodiesWithContent=${JSON.stringify(observedA)}`)

    // ── L2: real ALLOW over POST /team-remote/team.resolveControl ───────────
    const resA = await remoteCallReady(host, 'team.resolveControl', {
      teamSessionId: ROOT_P,
      requestId: recA.requestId,
      decision: 'allow',
      note: 'pahc L2 remote v4 allow',
    }, 'pahc-resolve-a', 4)
    const errA = resultError(resA.body)
    const dataA = resultData(resA.body)
    writeEvidence('l2-resolve-envelope.json', JSON.parse(JSON.stringify(sanitizeForFixture(resA.body, { maxTextLength: 1500 }))))
    check('L2.1', 'L2: remote v4 team.resolveControl ALLOW returned the closed success envelope (decision=allow, host-derived human decider)',
      errA === null && dataA?.decision?.requestId === recA.requestId && dataA?.decision?.decision === 'allow' && dataA?.decision?.decider?.kind === 'human',
      `status=${resA.status} err=${JSON.stringify(errA)} data=${JSON.stringify(sanitizeForFixture(dataA, { maxTextLength: 400 }))}`)

    const memADone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('PAHC_MEMA_'), 240_000, 'member read(A) continuation')
    const wireA = lastMemberWire(mock, MK_MEMA)
    writeEvidence('l2-member-wire.json', JSON.parse(JSON.stringify(sanitizeForFixture(wireA ?? {}, { maxTextLength: 900 }))))
    const contentRowsA = wireA === null ? [] : allToolResults(wireA).filter((r) => r.text.includes(CONTENT_A))
    check('L2.2', 'L2: the member tool row returns the fixture CONTENT with EXACTLY ONE execution (one tool row carrying the content; member chain completed on it)',
      contentRowsA.length === 1 && memADone?.reply?.content === 'PAHC_MEMA_READ_OK',
      `contentRows=${contentRowsA.length} reply=${memADone?.reply?.content ?? 'TIMEOUT'} rowHead=${String(contentRowsA[0]?.text ?? '').slice(0, 200).replace(/\s+/g, ' ')}`)

    const factsL2 = await remoteControlFacts(host)
    const dec2 = factsL2.byType['control-decision-recorded'].filter((f) => f.payload.requestId === recA.requestId)
    const con2 = factsL2.byType['control-allow-consumed'].filter((f) => f.payload.requestId === recA.requestId)
    const corrReq = correlationOf(recAAll[0]?.payload ?? recA)
    const corrCon = con2.length === 1 ? correlationOf(con2[0].payload) : null
    writeEvidence('l2-ledger.json', JSON.parse(JSON.stringify(sanitizeForFixture({
      recorded: recAAll, decision: dec2, consumption: con2, corrReq, corrCon,
    }, { maxTextLength: 400 }))))
    const ledgerL2 = readControlLedger(ROOT_P)
    check('L2.3', 'L2: durable trio on the remote ledger — recorded x1 -> decided(allow, human) x1 -> consumed x1, the consumption carrying the SAME callId (correlation) as the request',
      factsL2.byType['control-request-recorded'].filter((f) => f.payload.requestId === recA.requestId).length === 1
      && dec2.length === 1 && dec2[0].payload.decision === 'allow' && dec2[0].payload.decider?.kind === 'human'
      && con2.length === 1 && corrCon !== null && corrCon === corrReq,
      `corrReq=${corrReq} corrConsumed=${corrCon} decisions=${dec2.length} consumptions=${con2.length} ledgerErr=${ledgerL2.error}`)
    check('L2.4', 'L2: the local durable ledger (storages/team_domain.json, read-only forensic) agrees with the wire trio',
      ledgerL2.error === null
      && ledgerL2.requests.filter((p) => p.requestId === recA.requestId).length === 1
      && ledgerL2.decisions.filter((p) => p.requestId === recA.requestId && p.decision === 'allow').length === 1
      && ledgerL2.consumptions.filter((p) => p.requestId === recA.requestId).length === 1,
      `requests=${ledgerL2.requests.length} decisions=${ledgerL2.decisions.length} consumptions=${ledgerL2.consumptions.length}`)

    // ── L3: second read (different fixture) → ask → real DENY, ZERO effect ──
    const p2 = await apiPrompt(host, ROOT_P, `${MK_LEAD2} Delegate task ${MK_MEMB} to the existing member asynchronously (async true).`, 'pahc-lead2')
    if (!(p2.status === 200 && p2.body?.result?.ok === true)) dieFatal(`lead2 prompt not admitted: status=${p2.status}`)
    const delegatedB = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('PAHC_LEAD2_'), 240_000, 'leader delegate B')
    if (delegatedB === null) dieFatal('leader delegate-B turn did not complete')
    const recB = await waitForControlRequest(host, (p) => String(p.summary ?? '').includes(`pahc-fixture-b-${NONCE}`), 180_000, 'L3 ask request (fixture B)')
    if (recB === null) dieFatal('L3: no durable ask request for fixture B within 180s')
    const factsL3pre = await remoteControlFacts(host)
    const recBAll = factsL3pre.byType['control-request-recorded'].filter((f) => f.payload.requestId === recB.requestId)
    const observedBpre = contentObserved(mock, CONTENT_B)
    const rowsBpre = toolRowsWithText(mock, MK_MEMB, CONTENT_B)
    check('L3.1', 'L3: the second read opened its OWN durable ask request, still PENDING, and the second fixture was not observed (zero content rows, zero model bodies)',
      recBAll.length === 1 && derivedStatus(factsL3pre, recB.requestId) === 'pending' && rowsBpre.length === 0 && observedBpre.length === 0,
      `requestId=${recB.requestId} status=${derivedStatus(factsL3pre, recB.requestId)} contentRows=${rowsBpre.length} modelBodies=${JSON.stringify(observedBpre)}`)

    const resB = await remoteCallReady(host, 'team.resolveControl', {
      teamSessionId: ROOT_P,
      requestId: recB.requestId,
      decision: 'deny',
      note: 'pahc L3 remote v4 deny',
    }, 'pahc-resolve-b', 4)
    const errB = resultError(resB.body)
    const dataB = resultData(resB.body)
    writeEvidence('l3-resolve-envelope.json', JSON.parse(JSON.stringify(sanitizeForFixture(resB.body, { maxTextLength: 1500 }))))
    check('L3.2', 'L3: remote v4 team.resolveControl DENY returned the closed success envelope (decision=deny, human decider)',
      errB === null && dataB?.decision?.requestId === recB.requestId && dataB?.decision?.decision === 'deny' && dataB?.decision?.decider?.kind === 'human',
      `status=${resB.status} err=${JSON.stringify(errB)}`)

    const memBDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply?.content ?? '').startsWith('PAHC_MEMB_'), 240_000, 'member read(B) refusal row')
    const wireB = lastMemberWire(mock, MK_MEMB)
    writeEvidence('l3-member-wire.json', JSON.parse(JSON.stringify(sanitizeForFixture(wireB ?? {}, { maxTextLength: 900 }))))
    const bIdx = wireB === null ? -1 : indexAfterLastUserWith(wireB, MK_MEMB)
    const refusalRows = wireB === null ? [] : toolResultsAfter(wireB, bIdx)
    const refusalText = refusalRows.map((r) => r.text).join('\n')
    writeEvidence('l3-refusal-row.txt', refusalText)
    check('L3.3', 'L3: the member tool row is the REFUSAL (deny text, no fixture content) and the second fixture was NEVER observed on the wire',
      refusalRows.length >= 1 && /denied/i.test(refusalText) && !refusalText.includes(CONTENT_B) && contentObserved(mock, CONTENT_B).length === 0,
      `reply=${memBDone?.reply?.content ?? 'TIMEOUT'} refusalHead=${refusalText.slice(0, 220).replace(/\s+/g, ' ')}`)

    const factsL3 = await remoteControlFacts(host)
    const dec3 = factsL3.byType['control-decision-recorded'].filter((f) => f.payload.requestId === recB.requestId)
    const con3 = factsL3.byType['control-allow-consumed'].filter((f) => f.payload.requestId === recB.requestId)
    const ledgerL3 = readControlLedger(ROOT_P)
    writeEvidence('l3-ledger.json', JSON.parse(JSON.stringify(sanitizeForFixture({
      recorded: recBAll, decision: dec3, consumption: con3,
      localDecisions: ledgerL3.decisions, localConsumptions: ledgerL3.consumptions,
    }, { maxTextLength: 400 }))))
    check('L3.4', 'L3: durable decided(deny) x1 and NO consumption fact for the denied request (local ledger agrees)',
      dec3.length === 1 && dec3[0].payload.decision === 'deny' && con3.length === 0
      && ledgerL3.decisions.filter((p) => p.requestId === recB.requestId && p.decision === 'deny').length === 1
      && ledgerL3.consumptions.filter((p) => p.requestId === recB.requestId).length === 0,
      `decisions=${dec3.length} decision=${dec3[0]?.payload?.decision} consumptions=${con3.length}`)
    check('L3.5', 'L3: zero side effect end-state — the denied fixture content still appears in ZERO model-request bodies (ever)',
      contentObserved(mock, CONTENT_B).length === 0,
      `modelBodiesWithContentB=${JSON.stringify(contentObserved(mock, CONTENT_B))}`)

    await stopOnce()
  } catch (error) {
    await stopOnce().catch(() => { /* ok */ })
    dieFatal(`unexpected runner error: ${String(error?.stack ?? error).slice(0, 3000)}`)
  }

  // ── teardown + hygiene ─────────────────────────────────────────────────────
  try { await mock.close() } catch { /* ok */ }
  {
    const hostProbe = await probeUrl(`http://127.0.0.1:${hostPort}/`)
    const mockProbe = await probeUrl(`http://127.0.0.1:${mockPort}/`)
    check('H2', 'run ports released after teardown (host + mock)', hostProbe.status === 'unreachable' && mockProbe.status === 'unreachable', `host=${hostProbe.status} mock=${mockProbe.status}`)
  }
  const revPost = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirtyPost = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  writeFileSync(join(RUN_DIR, 'testuse-head-post.txt'), `${revPost}\n`)
  check('H1.post', 'test-use porcelain EMPTY and HEAD at the baseline AFTER (zero-touch)', revPost === TEST_USE_BASELINE_SHA && (dirtyPost ?? 'x') === '', `head=${revPost} porcelain=${JSON.stringify(dirtyPost)}`)
  const postStable = { p3080: await probeUrl('http://127.0.0.1:3080/'), p3180: await probeUrl('http://127.0.0.1:3180/') }
  writeEvidence('post-stable-probe.json', postStable)
  check('H1.stable', 'stable :3080/:3180 read-only probes pre == post (zero-touch)',
    JSON.stringify(preStable) === JSON.stringify(postStable), `pre=${JSON.stringify(preStable)} post=${JSON.stringify(postStable)}`)

  // evidence captures
  try { writeFileSync(join(RUN_DIR, 'instance-captured.log'), readFileSync(instanceLog, 'utf8')) } catch { /* ok */ }
  try {
    writeEvidence('mock-transcript.json', mock.requests.map((r) => ({
      seq: r.seq, at: r.at, reply: r.reply, body: JSON.parse(JSON.stringify(sanitizeForFixture(r.body, { maxTextLength: 260 }))),
    })))
  } catch { /* best-effort */ }
  writeEvidence('api-transcript.json', TRANSCRIPT)
  writeEvidence('member-read-call.json', { modelCallIdA, correlation: correlationOf(recA ?? {}) ?? null })

  const failed = CRITERIA.filter((c) => !c.ok)
  const pass = failed.length === 0 && FIRST_FAILURE === null
  writeEvidence('summary.json', {
    task: 'W-PA host chain — M1 real-host reference chain (read ask/approve/deny over the production Control plane)',
    runStamp: RUN_STAMP,
    mode: FLAG_PLANE ? 'plane-fed (teamToolPlane + C-FS read row takeover)' : 'plain row (no plane)',
    priorRunNote: 'plain-world run live-2026-10-22T21-45-43: 20/21 PASS; L2.2 FAIL verbatim: team tool guard: the Tool Binding for "read" cannot be verified at dispatch time (no fallback to the native body)',
    command: COMMAND_LINE,
    head: {
      recordedAtSessionStart: '8e16c954924c73d5b093bcf6a931f27b66259635',
      atRunStart: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: WORKTREE, encoding: 'utf8' }).stdout?.trim(),
      note: 'expected a64f7c680 differed; recorded actual per instruction (branch also advanced by the M1 writer mid-session)',
    },
    world: HOME,
    worldRetained: FLAG_KEEP,
    ports: { hostPort, mockPort },
    testuse: { baseline: TEST_USE_BASELINE_SHA, headPre: revPre, headPost: revPost, porcelainPre: dirtyPre, porcelainPost: dirtyPost },
    requests: { A: { requestId: recA?.requestId ?? null, correlation: correlationOf(recA ?? {}) ?? null, modelCallId: modelCallIdA ?? null }, B: { requestId: recB?.requestId ?? null, correlation: correlationOf(recB ?? {}) ?? null } },
    criteria: CRITERIA,
    firstFailure: FIRST_FAILURE,
    pass,
    exitCode: pass ? 0 : 2,
  })
  exitCode = pass ? 0 : 2
  if (!pass && FIRST_FAILURE !== null) {
    log(`LEG FAILURE — see FAILURE.md (first failure: ${FIRST_FAILURE.id})`)
  }
  if (!FLAG_KEEP) {
    try { rmSync(HOME, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(LOCK_FILE, { force: true }) } catch { /* ok */ }
    log(`world removed: ${HOME}`)
  } else {
    log(`world RETAINED (--keep): ${HOME}`)
  }
  scrubDir(RUN_DIR)
  log(`DONE pass=${pass} criteria=${CRITERIA.length} failed=${failed.length} runDir=${RUN_DIR}`)
  process.exit(exitCode)
}

main().catch((error) => dieFatal(`main() rejected: ${String(error?.stack ?? error).slice(0, 3000)}`))
