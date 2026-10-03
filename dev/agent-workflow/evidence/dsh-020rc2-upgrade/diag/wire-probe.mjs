#!/usr/bin/env node
/**
 * DIAGNOSTIC PROBE 3 (throwaway, evidence-only) — 0.2.0-rc.2 wire shape.
 *
 * Bounded MINIMAL reproduction of the one thing the kit's predicates need to
 * know exactly: in a 0.2.0-rc.2 agent turn, (a) where the executed TOOL RESULT
 * sits in the next model request, and (b) where the PERSONA / system
 * instruction sits. Run 4 of the kit showed the 0.1.x assumptions
 * (`role:'tool'` messages, persona inside `messages`) do not hold; this probe
 * reproduces a single executed tool call and dumps the structure — no full
 * chain, hard caps, host stopped at the end.
 *
 * The tool is `team_list_members`: a plugin tool with no permission gate, no
 * side effect, instant result — so the probe exercises the transport, not the
 * permission plane.
 *
 * Caps: MAX_MODEL_CALLS model requests, hard script deadline, own world under
 * tests/homes, ports 3493 / 3498 (documented 3491-3500 family; :3080 never
 * touched).
 */
import { spawn } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'
import { CLIENT_COMMIT_HASH } from '../../../../../tests/paths.mjs'

const WT = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/dsh-020rc2-upgrade'
const TESTUSE = join(WT, 'tests', 'deepseek-harness-test-use')
const SRC_HOME = join(WT, 'tests', 'homes', 'rc2-smoke-2026-10-03T14-29-39')
const SRC_BLUEPRINTS = join(WT, '.rc2-smoke-blueprints-2026-10-03T14-29-39')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(WT, 'tests', 'homes', `wire-probe-${STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINTS = join(WT, `.wire-probe-blueprints-${STAMP}`)
const PORT = 3493
const MOCK_PORT = 3498
const DIAG_DIR = join(WT, 'dev', 'agent-workflow', 'evidence', 'dsh-020rc2-upgrade', 'diag')
const LOG = join(DIAG_DIR, `wire-probe-${STAMP}.log`)
const MAX_MODEL_CALLS = 8
const say = (line) => {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  writeFileSync(LOG, text + '\n', { flag: 'a' })
}
const writeEvidence = (name, content) => writeFileSync(join(DIAG_DIR, `wire-${name}-${STAMP}`), JSON.stringify(content, null, 2))

const killAll = (child) => { try { child.kill() } catch { /* gone */ } }

mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
mkdirSync(WORKSPACE, { recursive: true })
mkdirSync(BLUEPRINTS, { recursive: true })
copyFileSync(join(SRC_HOME, 'profiles', 'web', 'cordis.patch.yml'), join(HOME, 'profiles', 'web', 'cordis.patch.yml'))
const patch = readFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), 'utf8')
writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patch.replace(/blueprintDir: "[^"]*"/, `blueprintDir: "${BLUEPRINTS}"`))
if (existsSync(SRC_BLUEPRINTS)) for (const f of readdirSync(SRC_BLUEPRINTS)) copyFileSync(join(SRC_BLUEPRINTS, f), join(BLUEPRINTS, f))
const ROOT_ID = /rootSessionId: "([^"]+)"/.exec(patch)?.[1] ?? 'wire-probe-root'
writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({ boot: 1, phase: 'create', reportDir: DIAG_DIR, runStamp: STAMP, rootSessionId: ROOT_ID }, null, 2))
say(`world=${HOME} port=${PORT} mock=${MOCK_PORT} root=${ROOT_ID} maxModelCalls=${MAX_MODEL_CALLS}`)

// ── the two shape questions, answered structurally ─────────────────────────
const toolResultsIn = (body) => {
  const classic = (body?.messages ?? []).filter((m) => m?.role === 'tool')
  const parts = []
  for (const m of body?.messages ?? []) {
    if (!Array.isArray(m?.content)) continue
    for (const p of m.content) if (p !== null && typeof p === 'object' && (p.type === 'tool_result' || p.type === 'tool-result')) parts.push({ inRole: m.role, part: p })
  }
  return { classicCount: classic.length, partCount: parts.length, parts }
}
/**
 * Desensitization for any envelope that leaves this probe as evidence: the
 * reviewer rule is that no raw boot token, cookie, credential or host
 * absolute path is ever committed. Model bodies carry no cookies, but
 * `dsh_session_log` / `dsh_plugin_packages` embed absolute host paths and the
 * persona text embeds the workspace path, so both are structurally replaced.
 */
const SCRUB_PATTERNS = [
  [/(https?:\/\/127\.0\.0\.1:\d+\/?\?token=)[A-Za-z0-9_-]+/g, '$1<REDACTED-TOKEN>'],
  [/token=[A-Za-z0-9_-]{16,}/g, 'token=<REDACTED-TOKEN>'],
  [/dsh-auth-[A-Za-z0-9_-]+/g, 'dsh-auth-<REDACTED-COOKIE>'],
  [/Bearer\s+[A-Za-z0-9_-]{8,}/g, 'Bearer <REDACTED-KEY>'],
  [/\/srv\/[A-Za-z0-9._\/-]+/g, '<ABSOLUTE_PATH>'],
  [/[A-Z]:\\[^"\n]{4,}/g, '<ABSOLUTE_PATH>'],
]
const scrubDeep = (value) => {
  if (typeof value === 'string') {
    let out = value
    for (const [re, to] of SCRUB_PATTERNS) out = out.replace(re, to)
    return out
  }
  if (Array.isArray(value)) return value.map(scrubDeep)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      // The session log and the package inventory are host-internal payloads
      // with absolute paths and no bearing on the message shape.
      out[k] = (k === 'dsh_session_log' || k === 'dsh_plugin_packages')
        ? `<REDACTED:${k} presence=${v === undefined ? 'absent' : 'present'}>`
        : scrubDeep(v)
    }
    return out
  }
  return value
}

const shapeOf = (body) => (body?.messages ?? []).map((m) => `${m?.role}:${typeof m?.content === 'string' ? 'string' : Array.isArray(m?.content) ? m.content.map((p) => p?.type ?? '?').join('+') : typeof m?.content}`)

let decideCalls = 0
let dumped = false
let scriptedToolCallSent = false
let auxDumped = false
const mock = await startMockModel({
  port: MOCK_PORT,
  decide: (req) => {
    decideCalls += 1
    const body = req?.req ?? req?.body ?? req ?? {}
    const texts = JSON.stringify(body?.messages ?? [])
    const tr = toolResultsIn(body)
    const hasTools = Array.isArray(body?.tools) && body.tools.length > 0
    say(`decide #${decideCalls} bodyKeys=[${Object.keys(body).join(',')}] hasTools=${hasTools} classicToolMsgs=${tr.classicCount} toolResultParts=${tr.partCount} shapes=[${shapeOf(body).join(' | ').slice(0, 300)}]`)
    if (!dumped && tr.classicCount + tr.partCount > 0) {
      dumped = true
      const firstPart = tr.parts[0]?.part ?? null
      writeEvidence('envelope-agent-with-result', scrubDeep(body))
      writeEvidence('shape', {
        note: 'first request that carries an executed tool result back to the model',
        bodyKeys: Object.keys(body),
        hasTools,
        messageShapes: shapeOf(body),
        toolResultShape: {
          viaRoleToolMessages: tr.classicCount,
          viaContentParts: tr.partCount,
          partFieldNames: firstPart === null ? null : Object.keys(firstPart),
          partContentKind: firstPart === null ? null : (typeof firstPart.content === 'string' ? 'string' : Array.isArray(firstPart.content) ? `array:${firstPart.content.map((x) => x?.type ?? typeof x).join(',')}` : typeof firstPart.content),
          partContentHead: JSON.stringify(firstPart?.content ?? null).slice(0, 400),
        },
        systemKey: typeof body?.system === 'string' ? `string(${body.system.length})` : JSON.stringify(body?.system ?? null).slice(0, 200),
        systemContainsAnchorPersona: JSON.stringify(body?.system ?? '').includes('rc2 anchor A') || String(body?.system ?? '').includes('rc2 anchor A'),
      })
      say(`SHAPE DUMPED toolResults: classic=${tr.classicCount} parts=${tr.partCount} partFields=${firstPart === null ? '-' : Object.keys(firstPart).join(',')} systemType=${typeof body?.system}`)
      return { kind: 'text', content: 'WIRE_PROBE_DONE' }
    }
    if (!hasTools && !auxDumped) {
      auxDumped = true
      writeEvidence('envelope-auxiliary', scrubDeep(body))
      say(`auxiliary (toolless) envelope captured: bodyKeys=[${Object.keys(body).join(',')}] shapes=[${shapeOf(body).join(' | ')}]`)
    }
    if (!scriptedToolCallSent && hasTools && texts.includes('WIRE_PROBE_TURN')) {
      scriptedToolCallSent = true
      say('sending scripted tool call: team_list_members')
      return { kind: 'tool-call', toolCalls: [{ id: `call-wire-${Math.random().toString(36).slice(2, 10)}`, name: 'team_list_members', arguments: {} }] }
    }
    if (decideCalls > MAX_MODEL_CALLS) {
      say(`CAP: ${decideCalls} model calls reached MAX_MODEL_CALLS=${MAX_MODEL_CALLS} without a tool result — aborting`)
      writeEvidence('aborted', { reason: 'cap reached', decideCalls, lastBodyKeys: Object.keys(body), messageShapes: shapeOf(body) })
      return { kind: 'text', content: 'WIRE_PROBE_ABORT_CAP' }
    }
    return { kind: 'text', content: 'WIRE_PROBE_IDLE' }
  },
  log: () => { /* keep the probe log clean; the decide line above carries the signal */ },
})

const logPath = join(DIAG_DIR, `wire-probe-instance-${STAMP}.log`)
const outFd = openSync(logPath, 'a')
const child = spawn(process.execPath, [join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', String(PORT), '--no-open'], {
  cwd: WORKSPACE,
  stdio: ['ignore', outFd, outFd],
  env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, DEEPSEEK_API_KEY: 'wire-probe-mock-key' },
})
const hardStop = setTimeout(() => { say('HARD DEADLINE 180s reached — stopping'); killAll(child); mock.close?.(); process.exit(dumped ? 0 : 3) }, 180_000)
hardStop.unref?.()

const deadline = Date.now() + 150_000
let url = null
while (url === null && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 500))
  const m = /http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/.exec(readFileSync(logPath, 'utf8'))
  if (m !== null) url = { origin: `http://127.0.0.1:${m[1]}`, token: m[2] }
}
if (url === null) { say('FATAL no boot marker'); killAll(child); process.exit(1) }
say(`booted at ${url.origin}`)

const auth = await fetch(`${url.origin}/?token=${url.token}`, { redirect: 'manual' })
const cookie = (auth.headers.get('set-cookie') ?? '').split(';', 1)[0]
say(`auth HTTP ${auth.status} cookieChars=${cookie.length}`)

// The plugin creates the boot root session asynchronously after the row is
// ready, so the turn is submitted with a bounded retry (a single shot races
// creation — observed as `session/not-found`).
let prompt = null
{
  const untilPrompt = Date.now() + 90_000
  for (;;) {
    prompt = await fetch(`${url.origin}/api/session/prompt`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        type: 'client-request',
        rpcId: `wire-${Math.random().toString(36).slice(2, 8)}`,
        method: 'session/prompt',
        payload: { args: { request: { requestId: `wire-req-${Math.random().toString(36).slice(2, 8)}`, sessionId: ROOT_ID, mode: 'queue', content: [{ type: 'text', text: 'WIRE_PROBE_TURN' }] } } },
      }),
    }
    const text = await prompt.text()
    say(`prompt HTTP ${prompt.status} ${text.slice(0, 160)}`)
    if (prompt.status === 200 && !text.includes('not-found')) break
    if (Date.now() >= untilPrompt) { say('FATAL root session never accepted the turn'); killAll(child); process.exit(1) }
    await new Promise((r) => setTimeout(r, 2000))
  }
}

const until = Date.now() + 120_000
while (!dumped && Date.now() < until && decideCalls <= MAX_MODEL_CALLS + 2) await new Promise((r) => setTimeout(r, 500))
say(`done: dumped=${dumped} decideCalls=${decideCalls}`)
killAll(child)
await new Promise((r) => setTimeout(r, 1200))
mock.close?.()
say(`world retained at ${HOME}; instance log ${logPath}`)
process.exit(dumped ? 0 : 3)
