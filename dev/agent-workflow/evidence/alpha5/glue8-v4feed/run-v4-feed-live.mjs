#!/usr/bin/env node
/**
 * a5fl-live — the LIVE-HOST leg of the v4 flip (V4-ENABLEMENT-ROUTE 阶段③
 * three-pin #2:「v4 文档经生产入口真实可解析可运行 — live 宿主腿: v4 blueprint
 * 创建 team → 真实 delegate 一小步 → 绿; 允许既有 mock-LLM 位」).
 *
 * Everything runs through REAL production surface on a REAL test-use host:
 *   the public profile-patch seam mounts the production dsh-agent-team row
 *   (this worktree's built dist) — the same row the shipped composition uses;
 *   a v4 saved-source document (schemaVersion: 4 + the optional toolBindings
 *   family) lands in the blueprintDir; catalog.list / catalog.get read it
 *   through the wire; team.create binds it on a fresh root (the production
 *   parse-once→validate→snapshot entry runs the fourth parser for real);
 *   the Leader (mock-LLM position — the sanctioned existing seam) drives
 *   team_create_member + a SYNC team_delegate; the member runs one real bash
 *   echo through the allow lane; the marker file on disk and the delegate's
 *   result are the durable witnesses;
 *   the v3 boot anchor team runs alongside, unchanged (v3 zero-drift witness
 *   at the runtime face).
 *
 * Discipline (TEST_METHODS): host = tests/deepseek-harness-test-use pristine
 * at the paths.mjs baseline; DSH_HOME inside the workspace (tests/homes/);
 * ports from the 318x family with the :3080 AND :3180 stable instances probed
 * zero-touched before/after; boot token REDACTED in every evidence artifact;
 * the world is removed at teardown unless --keep (path then registered).
 *
 * Usage: node run-v4-live-leg.mjs [--host-port N] [--mock-port N] [--keep]
 * Exit: 0 = all criteria PASS; 2 = any criterion failed; 1 = fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync, closeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

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

const LEG_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(LEG_DIR, '../../../..', '..')
const TESTUSE = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

// A5G8 (GLUE-8): one script, two faces, driven by A5G8_MODE.
//   preassembly — the v4 row WITHOUT a plane placement: the fail-closed
//     RED-first witness (dispatch reaches the Tool Binding verification
//     gate, NOTHING executes) — the verbatim v4-flip pin, re-run per round.
//   assembled   — the SAME v4 blueprint + the row config carries
//     teamToolPlane (realmId + fsInstance + confinedProvider, GLUE-7 #321
//     shape): the v4 execution feed RIDES the existing placement/binding
//     feed with zero new architecture; read/grep run REAL, team_bash runs
//     confined after the durable allow, team_glob lands the honest shut.
const MODE = String(process.env.A5G8_MODE ?? 'assembled')
if (MODE !== 'assembled' && MODE !== 'preassembly') throw new Error(`A5G8_MODE must be assembled|preassembly, got ${MODE}`)
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = join(LEG_DIR, 'runs', `live-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `a5g8-v4feed-${MODE}-${RUN_STAMP}`)
const LAUNCHER = join(WORKTREE, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const GOV_DIR = join(HOME, 'governed')
const G8_READ_REL = 'v4g8-read.txt'
const G8_BYTES = 'A5G8-V4-REAL-BYTES-42 token G8QZ\n'
const G8_GREP_TOK = 'G8QZ'
const G8_BASH_TOK = 'A5G8-BASH-TOK'
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(LEG_DIR, 'runs', `a5g8-blueprints-${MODE}-${RUN_STAMP}`)

const HOST_PORT = Number(argValue('host-port', 3182))
const MOCK_PORT = Number(argValue('mock-port', 3493))
const SMOKE_PRESET_ID = 'rc2-smoke'

const ROOT = `session-a5fl-root-${RUN_STAMP}`
const CREATE_ROOT = `session-a5fl-v4team-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.a5fl-anchor'
const BP_V4_ID = 'team.a5fl-v4'

const MK_DISC = `A5FLMK_DISC_${RUN_STAMP}`
const MK_LEAD = `A5FLMK_LEAD_${RUN_STAMP}`
const MK_MEM = `A5FLMK_MEM_${RUN_STAMP}`
const SUM_MARK = `a5fl-marker-${RUN_STAMP}`
const FILE_MARK = join(WORKSPACE, `a5fl-mark-${RUN_STAMP}.txt`)
const CMD_MARK = `echo ${SUM_MARK} > ${FILE_MARK} && echo a5fl-executed`

// ── logging / criteria / evidence (with token redaction) ────────────────────
const criteria = []
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  try { writeFileSync(join(RUN_DIR, 'run.log'), stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
}
function check(id, name, ok, detail) {
  criteria.push({ id, name, ok: ok === true, detail: redactTokens(String(detail ?? '')) })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id}: ${name}${detail ? ` — ${String(detail).slice(0, 400)}` : ''}`)
  return ok === true
}
function redactTokens(text) {
  return String(text).replace(/token=([A-Za-z0-9_-]{8,})/g, (_m, tok) => {
    const h = createHash('sha256').update(tok).digest('hex').slice(0, 8)
    return `token=REDACTED-${h}`
  })
}
function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    const body = typeof content === 'string' ? redactTokens(content) : redactTokens(JSON.stringify(content, null, 2))
    writeFileSync(join(RUN_DIR, name), body)
  } catch { /* best-effort */ }
}
function dieFatal(msg, code = 1) {
  log(`FATAL ${msg}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redactTokens(msg), criteria })
  process.exit(code)
}
function logTail(logPath, n = 120) {
  try { return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n') } catch { return '<no log>' }
}

// ── http helpers (c1-kit shapes) ────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 240_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch(() => ({ status: 0 }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStableInstance(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth returned HTTP ${res.status} (expected 303)`)
  return setCookie.split(';', 1)[0]
}
async function p6t6Get(port, what) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/${what}`, undefined, 30_000)
}
async function remoteCall(origin, cookie, method, params, tag = 'a5fl', version = 1, timeoutMs = 240_000) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
}
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5fl') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
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
}
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
  // Final full-file pass (c1-kit shape): the marker can land between the
  // last incremental read and the deadline check.
  try {
    const full = readFileSync(logPath, 'utf8')
    for (const l of full.split('\n')) {
      const m = regex.exec(l)
      if (m !== null) return l
    }
  } catch { /* best-effort */ }
  return null
}

// ── mock oracle helpers (c1-kit shapes) ─────────────────────────────────────
function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-a5fl-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}
function bodyOf(req) {
  // the mock hands decide the PARSED body (top-level messages) while
  // mock.requests records wrap it under .body — accept both (c1-kit shim).
  return req?.body?.messages !== undefined ? req.body : req
}
function messagesOf(req) {
  const msgs = bodyOf(req)?.messages
  return Array.isArray(msgs) ? msgs : []
}
function userTextOf(req) {
  return messagesOf(req).filter((m) => m.role === 'user').map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n')
}
const TRIGGER_RE = /A5FLMK_[A-Z0-9_]+_[0-9T:-]+/
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user') continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user') return i
  }
  return -1
}
function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  if (i === -1) return ''
  const last = messages[i]
  return typeof last.content === 'string' ? last.content : JSON.stringify(last.content ?? '')
}
function msgText(m) {
  return typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
}
/**
 * The completed tool results after the chain trigger. LIVE-FOUND (0.2.0-rc.2
 * host wire): tool results ride as role=user messages carrying
 * {"type":"tool_result",...} content parts — a role:'tool' message NEVER
 * appears on this host generation (the c1-era filter matched role 'tool'; the
 * rc.2 wire is Anthropic-part shaped). Count = progress.
 */
function toolMsgsOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  return messages.slice(i + 1).filter((m) => {
    if (m.role === 'tool') return true
    return m.role === 'user' && msgText(m).includes('"tool_result"')
  }).map((m) => ({ role: 'tool', content: msgText(m) }))
}
function extractInstanceId(content) {
  // The tool-result text rides JSON parts INSIDE content arrays, so the text
  // this sees is JSON-escaped at least once ({\"instanceId\":\"...\"}); match
  // both shapes (rc.2 wire), then the bare id as the last resort.
  const text = String(content ?? '')
  const m =
    /instanceId\\?"\s*:\s*\\?"(inst-[A-Za-z0-9][A-Za-z0-9-]{3,64})/.exec(text) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(text) ??
    /(inst-[A-Za-z0-9][A-Za-z0-9-]{3,64})/.exec(text)
  return m === null ? null : m[1]
}
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.filter(pred).pop()
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) { log(`timeout waiting for: ${label}`); return null }
    await new Promise((r) => setTimeout(r, 400))
  }
}

/**
 * The oracle. Chains (LAST user message + tool-message count):
 *   title side-calls → neutral;
 *   member (MK_MEM):  bash one echo (allow lane, NO approval loop) → done;
 *   leader  (MK_LEAD): create_member → SYNC delegate (async:false) → the
 *                      delegate result must carry `a5fl-executed` + the
 *                      marker → final text.
 *   DISC (boot root)  → text (surface capture happens on this request).
 */
function makeDecide() {
  let issued = 0
  return function decide({ req }) {
    // Circuit-breaker: a healthy leg fits well under 40 model requests.
    issued += 1
    if (issued > 60) return { kind: 'text', content: 'A5FL_CIRCUIT_BREAK' }
    const firstMsg = messagesOf(req)[0]
    const firstText = typeof firstMsg?.content === 'string'
      ? firstMsg.content
      : firstMsg?.role === 'user' && Array.isArray(firstMsg?.content)
        ? String(firstMsg.content[0]?.text ?? '')
        : ''
    if (firstMsg?.role === 'user' && (/^Create a concise title/.test(firstText) || /^Generate the session title/.test(firstText))) {
      // The title side-call embeds the session's first human message (markers
      // included) — it must NEVER be chain-routed (LIVE-FOUND: tool-calling a
      // title request drives the host into a regeneration loop).
      return { kind: 'text', content: 'a5fl live session' }
    }
    const lastUser = lastUserTextOf(req)
    const tools = toolMsgsOf(req).length
    // Inbox notification turns (the leader-approval notice arrives as a
    // user message '[team-control requestId=...]'). The scripted human
    // resolves over the wire, so these turns must END, never chain-route.
    {
      const users = messagesOf(req).filter((m) => m.role === 'user')
      const rawLast = users.length > 0 ? msgText(users[users.length - 1]) : ''
      if (rawLast.includes('[team-control requestId=') && !rawLast.includes(MK_MEM)) {
        return { kind: 'text', content: 'A5FL_NOTED' }
      }
    }
    if (lastUser.includes(MK_LEAD)) {
      try {
        const msgs = messagesOf(req)
        const ti = lastTriggerIndex(req)
        writeFileSync(join(RUN_DIR, 'leader-forensics.log'),
          `roles=[${msgs.map((m) => m.role).join(',')}]\n` +
          msgs.map((m, i) => `${i} <${m.role}> ${(typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')).slice(0, 400).replace(/\s+/g, ' ')}`).join('\n') +
          `\ntriggerIdx=${ti}\n----\n`,
          { flag: 'a' })
      } catch { /* forensics best-effort */ }
    }
    if (lastUser.includes(MK_MEM)) {
      if (MODE === 'assembled') {
        // The v4-era feed legs, in order: governed READ (real bytes),
        // team_grep (REAL rg over the governed root), team_glob (the honest
        // typed shut — the CANDIDATE-A row is NOT production), team_bash
        // (confined, behind the durable allow), then a quoted closing turn.
        switch (tools) {
          case 0: return toolCall('call-g8-read', 'read', { file_path: G8_READ_REL })
          case 1: return toolCall('call-g8-grep', 'team_grep', { pattern: G8_GREP_TOK, path: '.', output_mode: 'content' })
          case 2: return toolCall('call-g8-glob', 'team_glob', { pattern: '*' })
          case 3: return toolCall('call-g8-bash', 'team_bash', { command: `echo ${G8_BASH_TOK}; echo a5g8-v4-wrote > ./bash-sentinel.txt`, timeoutMs: 30000 })
          default: {
            const quote = toolMsgsOf(req).map((m, i) => `r${i}=${String(m.content ?? '').slice(0, 140).replace(/\s+/g, ' ')}`).join(' | ')
            return { kind: 'text', content: `A5FL_MEM_DONE_QUOTE ${quote}` }
          }
        }
      }
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_MARK, timeoutMs: 30000 })
        case 1: {
          const r0 = String(toolMsgsOf(req)[0]?.content ?? '')
          // Forensics: the ask->allow arc may surface as executed OR as a
          // denial/awaiting text — record which, the leg asserts on it.
          return { kind: 'text', content: r0.includes('a5fl-executed') ? 'A5FL_MEM_DONE_EXECUTED' : `A5FL_MEM_DONE :: ${r0.slice(0, 200)}` }
        }
        default: return { kind: 'text', content: `A5FL_MEM_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_LEAD)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT,
          requestToken: `a5fl-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: 'w-v4',
        })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(req)[0]?.content)
          if (id === null) return { kind: 'text', content: `A5FL_LEAD_EXTRACT_FAIL :: ${String(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT,
            requestToken: `a5fl-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: 'w-v4',
            prompt: MK_MEM,
            async: false,
          })
        }
        case 2: {
          // LIVE-FOUND (rc.2 wire): team_delegate returns an IMMEDIATE
          // executed receipt (effect.kind=work-admitted); member completion
          // arrives later as an inbox notification turn, NOT in this result.
          const del = String(toolMsgsOf(req)[1]?.content ?? '')
          return { kind: 'text', content: del.includes('work-admitted') || del.includes('a5fl-executed') ? 'A5FL_LEAD_DONE_DELEGATED' : `A5FL_LEAD_NO_EXECUTION :: ${del.slice(0, 300)}` }
        }
        default: return { kind: 'text', content: `A5FL_LEAD_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5FL_DISC_DONE' }
    return { kind: 'text', content: 'A5FL_IDLE' }
  }
}

/** The durable control ledger over the world's team_domain store (c1-kit shape). */
function readControlLedger(root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      let entry
      try { entry = JSON.parse(v) } catch { continue }
      if (String(entry?.rootSessionId) !== root) continue
      const payload = entry?.payload ?? {}
      if (entry.factType === 'control-request-recorded') {
        out.requests.push({ requestId: payload.requestId, kind: payload.kind, toolName: payload.toolName, status: payload.status })
      } else if (entry.factType === 'control-decision-recorded') {
        out.decisions.push({ requestId: payload.requestId, decision: payload.decision })
      } else if (entry.factType === 'control-allow-consumed') {
        out.consumptions.push({ requestId: payload.requestId })
      }
    }
  } catch (error) { out.error = String(error?.message ?? error) }
  return out
}

// ── YAML emit (c1-kit shape) ────────────────────────────────────────────────
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
  `  persona: "You are the leader of the a5fl boot team. ${MK_DISC} is the discovery marker."`,
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the a5fl boot team."',
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

/** The v4 saved source: the v3 authoring face UNCHANGED plus the optional
 *  toolBindings family (one fully-explicit entry). The digit is a literal —
 *  this file lives under dev/agent-workflow/, the fence's recorded
 *  orchestration-evidence exclusion (scan-scope: EXCLUDED_PREFIXES). */
function v4BlueprintYaml(denyList) {
  return [
    '---',
    'schemaVersion: 4',
    `blueprintId: ${BP_V4_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5fl v4 team. ${MK_LEAD}`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_list_members',
    '        - team_list_templates',
    '        - team_create_member',
    '        - team_delegate',
    '        - team_collect',
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
    `    persona: ${JSON.stringify(`You are worker-v4 of the a5fl v4 team. ${MK_MEM}`)}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    ...(denyList.length === 0
      ? ['      builtinToolDeny: []']
      : ['      builtinToolDeny:', ...denyList.map((n) => `        - ${n}`)]),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    ...(MODE === 'assembled'
      ? ['      permissions:', '        default: ask', '        allow:', '          - tool: read', '            resource:', '              kind: any', '        ask: []', '        deny: []']
      : ['      permissions:', '        default: ask', '        allow: []', '        ask:', '          - tool: bash', '            resource:', '              kind: any', '        deny: []']),    'memberEnvelopes:',
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
    'toolBindings:',
    '  - owner: dsh.core',
    '    name: bash',
    '    authorization: allow',
    '    io:',
    '      read:',
    '        mode: all',
    '        deny: []',
    '      write:',
    '        mode: restricted',
    '        allow:',
    '          - "."',
    '        ask: []',
    '        deny:',
    '          - ".git"',
    '      network:',
    '        mode: deny',
    '        default: deny',
    '    execution:',
    '      implementationOrigin: dsh-native',
    '      executionBoundary: confined-subprocess',
    '---',
    '',
  ].join('\n')
}

// ── row config + profile patch (c1-kit shape, p6t6 row dropped) ────────────
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
    staticModel: { provider: 'deepseek-official', model: 'a5fl-live-model' },
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
  // A5G8 ②: the v4 execution feed = the SAME row config plus the GLUE-7
  // teamToolPlane face (agent-bindings.mjs:2412 assembly — the placement is
  // era-agnostic by construction). Zero new architecture: realmId +
  // controlled-fs placement + confined provider, the #321 assembled shape.
  if (MODE === 'assembled') {
    cfg.teamToolPlane = {
      realmId: 'a5g8-v4-realm',
      fsInstance: { fs: 'a5g8-ctl', rootDir: GOV_DIR, realmId: 'a5g8-v4-realm', kind: 'absolute-path' },
      confinedProvider: {
        trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
        assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
      },
    }
  } else {
    cfg.teamToolPlane = { realmId: 'a5g8-v4-realm-pre' }
  }
  return cfg
}
function smokePresetDeclaration() {
  return presetDeclarationRow({
    id: SMOKE_PRESET_ID,
    displayName: 'a5fl live',
    description: `a5fl v4-flip live leg preset (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
    plugins: smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    }),
  })
}
function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# a5fl v4-flip live-leg patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist) mounted ONLY through the public profile-patch seam.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(smokePresetDeclaration(), 2),
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
          DEEPSEEK_API_KEY: 'a5fl-live-mock-key',
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
function stopHost(h) { try { h.child.kill() } catch { /* gone */ } }

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })

  // Preflight: test-use pristine at the baseline; ports free; stable probes.
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  if (rev !== TEST_USE_BASELINE_SHA || (dirty ?? 'x') !== '') dieFatal(`test-use not pristine-at-baseline: HEAD=${rev} dirty=${JSON.stringify(dirty)}`)
  check('A0.0', 'test-use pristine at the paths.mjs baseline', true, `sha=${rev}`)
  for (const port of [HOST_PORT, MOCK_PORT]) {
    const probe = await probeStableInstance(`http://127.0.0.1:${port}/`)
    if (probe.status !== 'unreachable') dieFatal(`port ${port} not free (${probe.status})`)
  }
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)

  const mockLog = join(RUN_DIR, 'mock.log')
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (l) => { try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  log(`mock model on ${mock.port}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  writePatchFile(HOME)
  mkdirSync(GOV_DIR, { recursive: true })
  writeFileSync(join(GOV_DIR, G8_READ_REL), G8_BYTES)
  writeFileSync(join(BLUEPRINT_DIR, 'a5fl-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
  const host = spawnHost({ port: HOST_PORT, home: HOME, logPath: instanceLog, mockPort: mock.port })

  let hostStopped = false
  const stopOnce = () => { if (!hostStopped) { stopHost(host); hostStopped = true } }

  const FAILS = []
  const fail = (id) => FAILS.push(id)

  try {
    const line = await waitForLogLine(instanceLog, BOOT_MARKER, 360_000, host.alive)
    if (line === null) {
      stopOnce()
      dieFatal(`host boot failed${host.exitInfo.exited ? ` (exit ${host.exitInfo.code}/${host.exitInfo.signal})` : ''}\n--- tail ---\n${logTail(instanceLog)}`)
    }
    const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
    if (m === null) dieFatal(`unexpected boot line shape`)
    const origin = `http://127.0.0.1:${m[1]}`
    const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`auth failed: ${e.message}`))
    // Row readiness gates (p6t6 observability row, proven kit pattern).
    {
      const hb0 = Date.now() + 240_000
      for (;;) {
        const hb = await p6t6Get(HOST_PORT, 'health')
        if (hb.status === 200 && hb.body?.ok === true) break
        if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
          stopOnce()
          dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- tail ---\n${logTail(instanceLog)}`)
        }
        if (Date.now() >= hb0) { stopOnce(); dieFatal(`row health not ready in 240s\n--- tail ---\n${logTail(instanceLog)}`) }
        await new Promise((r) => setTimeout(r, 1000))
      }
      const st0 = Date.now() + 120_000
      for (;;) {
        const st = await p6t6Get(HOST_PORT, 'state')
        const b = st.body
        if (st.status === 200 && b !== null && typeof b === 'object' && b.rootSessionId === ROOT && b.phase === 'create' && b.teamSession !== null && typeof b.teamSession === 'object') break
        if (Date.now() >= st0) { stopOnce(); dieFatal(`row state not well-formed in 120s; last=${JSON.stringify(st.body).slice(0, 400)}\n--- tail ---\n${logTail(instanceLog)}`) }
        await new Promise((r) => setTimeout(r, 500))
      }
    }
    check('A1.0', 'real host booted on the production row (profile-patch seam; v3 anchor team alive)', true, `origin=${origin}`)

    // ── DISC: capture the live tool surface (deny list for the v4 worker) ──
    const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC)
    log(`disc prompt status=${discPrompt.status} body=${JSON.stringify(discPrompt.body ?? null).slice(0, 300)}`)
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 180_000, 'DISC model request')
    if (discReq === null) dieFatal('DISC model request never observed')
    const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
    const MANAGED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'todo_write']
    const TEAM_TOOLS = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress', 'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member']
    const denyList = surface.filter((n) => !MANAGED.includes(n) && !TEAM_TOOLS.includes(n) && !n.startsWith('team_'))
    check('A1.1', 'boot root surface captured (bash present; unmanaged remainder computed)', surface.includes('bash'), `surface=${surface.length} deny=${denyList.length}`)

    // ── A2: the v4 saved source through the WIRE catalog ──────────────────
    writeFileSync(join(BLUEPRINT_DIR, 'a5fl-v4.yaml'), v4BlueprintYaml(denyList))
    let rows = []
    const catalogDeadline = Date.now() + 90_000
    for (;;) {
      const list = await remoteCall(origin, cookie, 'catalog.list', {})
      rows = list.body?.result?.value?.data?.blueprints ?? []
      if (rows.some((r) => r.blueprintId === BP_V4_ID)) break
      if (Date.now() >= catalogDeadline) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    const v4Row = rows.find((r) => r.blueprintId === BP_V4_ID)
    writeEvidence('a2-catalog-rows.json', rows)
    check('A2.0', 'catalog.list carries the v4 saved source', v4Row !== undefined, `row=${JSON.stringify(v4Row ?? null).slice(0, 300)}`)
    if (v4Row === undefined) fail('A2.0')
    const v4State = (v4Row?.revisionStates ?? []).find((x) => x.revision === 1)
    const runs = v4State !== undefined && v4State.schemaVersion === 4 && v4State.migrationState === 'current'
    check('A2.1', 'the v4 row RUNS (schemaVersion 4 stamped, migrationState=current — not migration-required, not unsupported)', runs, `state=${JSON.stringify(v4State ?? null)}`)
    if (!runs) fail('A2.1')
    const anchorRow = rows.find((r) => r.blueprintId === BP_ANCHOR_ID)
    const anchorState = (anchorRow?.revisionStates ?? []).find((x) => x.revision === 1)
    check('A2.3', 'v3 zero-drift witness at the wire: the v3 anchor row still lists RUNS (3/current) alongside', anchorState !== undefined && anchorState.schemaVersion === 3 && anchorState.migrationState === 'current', `state=${JSON.stringify(anchorState ?? null)}`)
    if (anchorState === undefined) fail('A2.3')

    // ── A3: team.create on a fresh root — the PRODUCTION entry parses v4 ──
    // LIVE-FOUND (rc.2 host): the create RESPONSE can block past the client
    // window while the initial-work leader turn runs its live arc (delegate ->
    // member ask). The team + frozen row exist while the call is in flight
    // (ledger/catalog witnesses below), so the create call is ISSUED
    // CONCURRENTLY with the approval arc and awaited before its criterion.
    let createSettled = null
    const createPromise = remoteCall(origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_V4_ID,
      initialWork: { prompt: MK_LEAD },
    }, 'a5flc', 1, 900_000).then(
      (r) => { createSettled = r; return r },
      (e) => { createSettled = { status: 0, error: String(e) }; return createSettled },
    )

    // ── A4 (concurrent): the real delegate small step (leader→member→ask→allow→bash) ──
    // The member's bash is an ASK-lane shell rule (the shell-class allow lane is
    // LEADER-ONLY by the A2C-1 grammar — fail-closed for members), so the one
    // step opens a durable leader-approval request. The scripted human resolves
    // it allow over the PRODUCTION wire (team.resolveControl v4 — the call the
    // leader panel makes) WHILE the create response is still in flight; the
    // blocked execution then resumes and create completes 200 (c1-S6 topology).
    let ledger = { requests: [], decisions: [], consumptions: [], error: null }
    const askDeadline = Date.now() + 420_000
    for (;;) {
      ledger = readControlLedger(CREATE_ROOT)
      if (ledger.requests.some((q) => q.kind === 'leader-approval')) break
      if (createSettled !== null) break // create returned without the ask — decide on its own terms
      if (Date.now() >= askDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const askReq = ledger.requests.find((q) => q.kind === 'leader-approval') ?? null
    writeEvidence('a4-control-ledger-ask.json', ledger)
    check('A4.1', 'the v4 team member ask opened a DURABLE leader-approval request (real runtime governance on a v4-bound team)', askReq !== null, `ledger=${JSON.stringify(ledger).slice(0, 300)}`)
    if (askReq === null) fail('A4.1')
    if (askReq !== null) {
      const resolved = await remoteCall(origin, cookie, 'team.resolveControl', {
        teamSessionId: CREATE_ROOT,
        requestId: askReq.requestId,
        decision: 'allow',
        note: 'a5fl live leg: scripted human allow (the Leader is blocked in the sync delegate)',
      }, 'a5flres', 4)
      writeEvidence('a4-resolve-control.json', resolved.body ?? resolved)
      check('A4.2', 'team.resolveControl (v4 wire) ACCEPTS the allow on the v4 team (durable decision)', resolved.status === 200 && resolved.body?.result?.ok === true, `status=${resolved.status} body=${JSON.stringify(resolved.body ?? resolved).slice(0, 300)}`)
      if (!(resolved.status === 200 && resolved.body?.result?.ok === true)) fail('A4.2')
    }

    // Await the create response (issued above; may have been blocked on the arc).
    const created = await createPromise
    writeEvidence('a3-team-create.json', created.body ?? created)
    const createOk = created.status === 200
      && created.body?.result?.ok === true
      && created.body?.result?.value?.data?.path === 'fresh-root'
    check('A3.0', 'team.create ACCEPTS the v4 blueprint on a fresh root (production parse-once→validate→snapshot ran the fourth parser)', createOk, `status=${created.status} body=${JSON.stringify(created.body ?? created).slice(0, 300)}`)
    if (!createOk) fail('A3.0')

    // catalog.get reads the FROZEN registry row — populated by the create above.
    const got = await remoteCall(origin, cookie, 'catalog.get', { blueprintId: BP_V4_ID, blueprintRevision: 1 })
    const gotRow = got.body?.result?.value?.data?.blueprint ?? got.body?.result?.value?.data ?? null
    // (RECORDED: catalog.get's view trims to the identity face —
    // schemaVersion/blueprintId/revision/contentHash/leader/members/requirements/
    // policyStates; the toolBindings family rides the contentHash binding, which
    // a5fl1 pins at unit level. Here: the identity face stamped 4 + hash.)
    const gotOk = gotRow !== null
      && gotRow.schemaVersion === 4
      && typeof gotRow.contentHash === 'string' && gotRow.contentHash.startsWith('sha256:')
      && gotRow.blueprintId === BP_V4_ID
    writeEvidence('a2-catalog-get.json', gotRow ?? got.body ?? got)
    check('A2.2', 'catalog.get returns the v4 identity (schemaVersion 4 + contentHash, blueprintId match)', gotOk, `status=${got.status} hash=${String(gotRow?.contentHash ?? '').slice(0, 23)}`)
    if (!gotOk) fail('A2.2')

    // Post-allow ledger: the decision is durable (consumption facts recorded too).
    let finalLedger = ledger
    const ledgerDeadline = Date.now() + 90_000
    for (;;) {
      finalLedger = readControlLedger(CREATE_ROOT)
      if (finalLedger.decisions.some((d) => d.requestId === askReq?.requestId)) break
      if (Date.now() >= ledgerDeadline) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    writeEvidence('a4-control-ledger-final.json', finalLedger)
    const decided = askReq !== null && finalLedger.decisions.some((d) => d.requestId === askReq.requestId)
    check('A4.3', 'the human allow is DURABLE (control-decision-recorded on the team ledger)', decided, `decisions=${JSON.stringify(finalLedger.decisions).slice(0, 240)}`)
    if (!decided) fail('A4.3')

    // Member completion witness (the oracle's member-chain reply) and the
    // leader-side delegate receipt (work-admitted) — both from mock traffic.
    const memDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply.content).startsWith('A5FL_MEM_DONE'), 300_000, 'member done turn')
    const leadDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && String(r.reply.content).startsWith('A5FL_LEAD_DONE'), 300_000, 'leader final turn')
    const leadDelegated = leadDone !== null && String(leadDone.reply.content) === 'A5FL_LEAD_DONE_DELEGATED'
    writeEvidence('a4-leader-final.json', { content: leadDone?.reply?.content ?? null, memContent: memDone?.reply?.content ?? null, toolMsgs: leadDone === null ? [] : toolMsgsOf(leadDone).map((t) => String(t.content ?? '').slice(0, 1500)) })
    check('A4.0', 'the v4 team leader ran create_member + team_delegate and the executed work-admitted receipt landed in the leader context', leadDelegated, `final=${String(leadDone?.reply?.content ?? 'timeout').slice(0, 200)}`)
    if (!leadDelegated) fail('A4.0')
    const memberText = String(memDone?.reply?.content ?? '')
    // The consumption fact lands when the member adapter consumes the allow —
    // poll for it (finalLedger above was snapshotted at DECISION time).
    for (let i = 0; i < 60; i += 1) {
      finalLedger = readControlLedger(CREATE_ROOT)
      if (askReq !== null && finalLedger.consumptions.some((c) => c.requestId === askReq.requestId)) break
      await new Promise((r) => setTimeout(r, 1000))
    }
    writeEvidence('a4-control-ledger-consumed.json', finalLedger)
    const consumed = askReq !== null && finalLedger.consumptions.some((c) => c.requestId === askReq.requestId)
    // The allow was CONSUMED (the closed-world Guard re-evaluated the real
    // dispatch after the decision), and the dispatch terminates at the Tool
    // Binding verification gate: the v4 toolBindings family is a DOCUMENT-face
    // effect-governance family (hash-bound identity); the dispatch-time VERIFIED
    // body comes from the provider BINDING FEED (a5pbr2 / pb §6), which v4 does
    // not feed yet — so the closed-world guard fail-closes
    // ("cannot be verified at dispatch time (no fallback to the native body)").
    // That refusal, durable on the member's session events, is the v4-era
    // product face; asserting executed here would assert the wrong design.
    if (MODE === 'assembled') {
      // ── A5G8 C-series: the v4 team EXECUTES on the production plane ────
      // Feed witness first: the placement rows of the v4-bound root rode the
      // feed (the same #313 channel v3 rides — era-agnostic by construction).
      const bootLog = readFileSync(instanceLog, 'utf8')
      const fed = bootLog.includes('a5-plane: placement-feed rows=') && bootLog.includes('a5g8-v4-realm')
      check('C0', 'the v4-bound scope mounted the plane: placement-feed rows logged through the SAME #313 binding feed (realm a5g8-v4-realm)', fed, `rows=${JSON.stringify(bootLog.split('\n').filter((l) => l.includes('placement-feed')).map((l) => l.slice(0, 160)).slice(0, 3))}`)
      if (!fed) fail('C0')
      // The dispatch consumed the durable allow and the QUOTED member turn
      // carries the tool results: read REAL bytes, grep REAL hits, glob the
      // honest shut, bash the confined execution.
      const consumedA = askReq !== null && finalLedger.consumptions.some((c) => c.requestId === askReq.requestId)
      check('C1', 'POSITIVE READ on a v4-bound team: the governed read row ran and returned REAL BYTES from the controlled root (r0 carries the file content, no refusal vocabulary)', memberText.includes('A5G8-V4-REAL-BYTES-42'), `memberText=${JSON.stringify(memberText).slice(0, 300)}`)
      if (!memberText.includes('A5G8-V4-REAL-BYTES-42')) fail('C1')
      const grepHit = memberText.includes('v4g8-read.txt') && memberText.includes(G8_GREP_TOK)
      check('C2', 'POSITIVE SEARCH: team_grep ran the REAL read-only search over the governed root and the token hit rode the wire', grepHit, `memberText=${JSON.stringify(memberText).slice(0, 300)}`)
      if (!grepHit) fail('C2')
      const globShut = memberText.includes('IO_POLICY_UNSUPPORTED')
      check('C3', 'GLOB ROW STAYS TYPED-SHUT on the v4 wire too (CANDIDATE-A never shipped): the shut face lands honestly, no walk, no names', globShut, `memberText=${JSON.stringify(memberText).slice(0, 300)}`)
      if (!globShut) fail('C3')
      await new Promise((r) => setTimeout(r, 8_000))
      let sentinelExists = false
      try { sentinelExists = existsSync(join(GOV_DIR, 'bash-sentinel.txt')) } catch { /* absent */ }
      const bashRan = consumedA && memberText.includes(G8_BASH_TOK) && sentinelExists
      check('C4', 'POSITIVE SHELL on the v4 wire: after the durable allow was CONSUMED, team_bash ran CONFINED and the sentinel file exists with real bytes inside the governed root', bashRan, `consumed=${String(consumedA)} tok=${String(memberText.includes(G8_BASH_TOK))} sentinel=${String(sentinelExists)}`)
      if (!bashRan) fail('C4')
      check('A4.4', 'the allow was CONSUMED and the member dispatch EXECUTED on the governed rows (v4 era, plane fed — the fail-closed leg of the preassembly run is the paired RED)', consumedA, `consumed=${String(consumedA)}`)
      if (!consumedA) fail('A4.4')
      check('A5.0', 'the governed WRITE landed for REAL where allowed: bash-sentinel.txt exists under the controlled root (positive control of execution, the mirror of the preassembly NEGATIVE)', sentinelExists, `sentinel=${join(GOV_DIR, 'bash-sentinel.txt')}`)
      if (!sentinelExists) fail('A5.0')
    } else {
      // ── RED-FIRST verbatim pin (the v4-flip 14/14 face, re-run per round) ──
      const consumed = askReq !== null && finalLedger.consumptions.some((c) => c.requestId === askReq.requestId)
      // The allow was CONSUMED (the closed-world Guard re-evaluated the real
      // dispatch after the decision), and the dispatch terminates at the Tool
      // Binding verification gate: the v4 toolBindings family is a DOCUMENT-face
      // effect-governance family (hash-bound identity); the dispatch-time VERIFIED
      // body comes from the provider BINDING FEED (a5pbr2 / pb §6), which the
      // UNFED (preassembly) v4 world does not have — so the closed-world guard
      // fail-closes ("cannot be verified at dispatch time (no fallback to the
      // native body)"). That refusal is the honest RED-first witness the
      // assembled run is measured against.
      const guardFace = memberText.includes('cannot be verified at dispatch time')
      check('A4.4', 'RED-FIRST fail-closed pin: the allow was CONSUMED and the member bash dispatch reached the Tool Binding verification gate (unfed plane = refusal, the exact refusal text)', consumed && guardFace, `consumed=${String(consumed)} guardFace=${String(guardFace)} memberText=${JSON.stringify(memberText).slice(0, 260)}`)
      if (!(consumed && guardFace)) fail('A4.4')
      // ── A5: the durable negative witness — an unverified binding NEVER executes ──
      await new Promise((r) => setTimeout(r, 15_000))
      let markerExists = false
      try { markerExists = existsSync(FILE_MARK) } catch { /* unreadable = absent */ }
      check('A5.0', 'the unverified binding executed NOTHING: no marker file on disk (closed world, no fallback to the native body)', !markerExists, `markerExists=${String(markerExists)}`)
      if (markerExists) fail('A5.0')
    }
  } finally {
    // Member-session forensics BEFORE teardown removes the world: the child
    // session's durable events carry the bash tool result (executed vs denied).
    try {
      const sessRoot = join(HOME, 'sessions')
      const hits = []
      const { execFileSync } = await import('node:child_process')
      const walk = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const fp = join(dir, e.name)
          if (e.isDirectory()) walk(fp)
          else if (e.name === 'session.v4.jsonl.zstd') {
            try {
              const txt = execFileSync('zstd', ['-dc', fp], { maxBuffer: 64 * 1024 * 1024 }).toString()
              for (const line of txt.split('\n')) {
                if (line.includes('"name":"bash"') || line.includes('"tool/result"')) hits.push(`${fp.split('/').slice(-2)[0]}| ${line.slice(0, 1100)}`)
              }
            } catch { /* per-file best-effort */ }
          }
        }
      }
      if (existsSync(sessRoot)) walk(sessRoot)
      writeFileSync(join(RUN_DIR, 'a5-member-bash-events.txt'), hits.join('\n').slice(0, 200_000) + '\n')
    } catch (err) { log(`member forensics skipped: ${String(err).slice(0, 120)}`) }
    log('teardown: stopping host + mock')
    stopOnce()
    try { await mock.close() } catch { /* best-effort */ }
    const postStable = {
      p3080: await probeStableInstance('http://127.0.0.1:3080/'),
      p3180: await probeStableInstance('http://127.0.0.1:3180/'),
    }
    writeEvidence('post-stable-probe.json', postStable)
    writeEvidence('mock-requests.json', mock.requests.map((r) => ({
      seq: r.seq,
      receivedAt: r.receivedAt,
      userTextHead: lastUserTextOf(r).slice(0, 200),
      toolMsgCountAfterLastUser: toolMsgsOf(r).length,
      reply: r.reply,
    })))
    writeEvidence('instance-tail.txt', logTail(instanceLog, 200))
    if (FLAG_KEEP) {
      log(`--keep: world retained at ${HOME} (blueprints at ${BLUEPRINT_DIR}) — REGISTER THIS PATH in the run README before keeping`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
      log(`world removed (${HOME})`)
    }
    const passed = criteria.filter((c) => c.ok).length
    const verdict = FAILS.length === 0 ? 'PASS' : 'FAIL'
    writeEvidence('summary.json', {
      runStamp: RUN_STAMP,
      hostBaseline: TEST_USE_BASELINE_SHA,
      hostPort: HOST_PORT,
      mockPort: MOCK_PORT,
      worktree: WORKTREE,
      criteria,
      passed,
      total: criteria.length,
      failed: FAILS,
      stable: { pre: preStable, post: postStable },
      verdict,
    })
    log(`VERDICT ${verdict} — ${passed}/${criteria.length}${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)
    console.log(`A5G8-V4-FEED ${MODE} VERDICT ${FAILS.length === 0 ? 'GREEN' : 'RED'} (${criteria.filter((c) => c.ok).length}/${criteria.length}) fails=${JSON.stringify(FAILS)}`)
    process.exit(FAILS.length === 0 ? 0 : 2)
  }
}

const isDirect = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
export { v4BlueprintYaml, BP_ANCHOR_YAML, BP_V4_ID }

if (isDirect) main().catch((e) => {
  try { log(`FATAL uncaught: ${redactTokens(String(e.stack ?? e))}`) } catch { /* best-effort */ }
  process.exit(1)
})
