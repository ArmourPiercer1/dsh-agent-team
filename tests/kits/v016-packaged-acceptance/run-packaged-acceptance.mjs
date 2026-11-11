#!/usr/bin/env node
/**
 * run-packaged-acceptance.mjs — the v0.1.6 PACKAGED acceptance driver.
 *
 * WHAT IT PROVES (one run = one fresh World):
 *
 *   A real `pnpm pack` of the candidate tree is installed with the real
 *   `dsh plugin --profile web add <tarball>` CLI into a FRESH `DSH_HOME`,
 *   using the PINNED PRISTINE HOST (`tests/deepseek-harness-test-use` @
 *   `tests/paths.mjs`). The profile resolves the plugin by PACKAGE NAME from
 *   the installed tarball — there is no worktree `file://` plugin path, no
 *   upstream patch, no `packages/**` source reference in the profile. Then one
 *   real `dsh web` boot drives, over the public HTTP surface:
 *
 *     1. Team           — the boot mints the BOOT root; the ACCEPTANCE Team is
 *                         then created at runtime (`team.create` on the saved
 *                         v5 source) because Alpha.6 routing is composed PER
 *                         ROOT and a boot-root composition needs a seed
 *                         Officer. The created root is a real durable Team.
 *     2. Member         — the Leader turn creates an Officer and a Worker;
 *                         both are durable `member_instances` rows.
 *     3. Human approval — the Worker's governed `bash` ask produces TWO real
 *                         durable legs: (a) the permission lane's leg, which a
 *                         human allows, and (b) the governed tool PLANE's own
 *                         `team-tool-execute` leg, which is routed to the live
 *                         Officer (Alpha.6 `[team-review-wake ...]`); the
 *                         Officer lists it and ESCALATES it to the human leg
 *                         (`reviewAuthority=human-user`). The human (this
 *                         driver, over `team.resolveControl` — the exact RPC
 *                         the GUI button issues) records `allow`; the durable
 *                         leg is consumed exactly once and the body executes
 *                         exactly once. The plane requires the shipped
 *                         landlock launcher (part of the tarball) and the
 *                         `teamToolPlane` row config — see finding F-3.
 *     4. Goal           — the Member creates a Goal; the HOST's own round
 *                         driver runs two automatic rounds, then the goal is
 *                         paused and the Member updates it (revision
 *                         advances); the durable Goal facts are read back from
 *                         `goals/get` and, after the restart, folded from the
 *                         session's own `goal/change` records.
 *     5. Stop           — a SECOND governed ask: the human allow is recorded
 *                         on its plane leg, then `session/cancel` is issued
 *                         BEFORE consumption. Asserted: no consumption, no
 *                         execution, terminal state (the A6-11/A6-12 family;
 *                         this is the packaged-artifact test of the fence
 *                         merged at candidate `bb3c158eb`). On this second ask
 *                         the Alpha.6 assignment port refuses the Officer's
 *                         escalation ("the trusted review-facts port produced
 *                         no facts for this leg"), so the human resolves that
 *                         leg directly — recorded as finding F-5, never
 *                         simulated away.
 *     6. Collection     — the Leader's `team_collect` returns the durable
 *                         member result for the delegated work token.
 *     7. Cold recovery  — SIGKILL the Host, restart it against the SAME
 *                         `DSH_HOME`: Team, Member, collected result, Goal,
 *                         and the consumption/abandonment facts survive;
 *                         the collected Member starts no new turn.
 *
 * WHAT IT DOES NOT PROVE:
 *
 *   - It is not a stability proof. `n=2` agreeing is an existence-plus-
 *     agreement proof, not a rate claim (no "0/∞" claim about the Stop race).
 *   - The MODEL is not a real vendor model. The transport is the in-tree
 *     deterministic mock (`packages/tools/harness/mock-deepseek.mjs`), which
 *     is a SCRIPTED ORACLE: it decides which tool the Leader/Officer/Member
 *     calls, not whether the product works. Every durable fact, HTTP response,
 *     process lifecycle, store row and side effect is real. This is the same
 *     mock-oracle class the C2-B evidence used. A real-vendor-model install
 *     flow is a different instrument (`dev/agent-workflow/evidence/
 *     v016-acceptance/install-flow.mjs`, n=1 ordinary-install claim).
 *   - No GUI click/DOM event: there is no headless browser here. The human
 *     approval and Stop are issued through the exact RPCs the buttons issue.
 *   - The Stop arm's TERMINAL SHAPE (abandonment row vs already-decided) is
 *     recorded per run and is NOT forced to agree; the candidate's own notes
 *     disclose both shapes. The agreed fields are "no consumption / no
 *     execution / terminal".
 *   - It does not exercise Alpha.5's per-tool I/O matrix (C2-A) and makes no
 *     V@B claim.
 *
 * ENV / FLAGS:
 *   node tests/kits/v016-packaged-acceptance/run-packaged-acceptance.mjs \
 *     --run <1|2> [--port 14001] [--mock-port 14071] [--keep] \
 *     [--evidence-dir <path>] [--tarball <path>] [--wait-ms 180000] \
 *     [--testuse <path>]
 *
 *   --run            run label used in evidence dirs and markers (default 1)
 *   --port           real Host port (default 14001 + run-1; loopback only)
 *   --mock-port      in-process mock model port (default 14071 + run-1)
 *   --keep           keep the World (`tests/homes/<world>`) after the run
 *   --evidence-dir   override the evidence directory
 *   --tarball        reuse an already-packed tarball (identity is still
 *                    hashed and recorded; the pack step is then recorded as
 *                    "reused", never claimed as this run's pack)
 *   --wait-ms        per-wait budget for a durable fact to appear (default 180000)
 *   --testuse        override the pristine host checkout (default: the pin in
 *                    `tests/paths.mjs`, resolved from the main checkout)
 *
 * PORTS: 1400x/1407x family — deliberately disjoint from the adjudicator's
 * 1302x–1307x and from :3080. Loopback only. :3080 is never contacted.
 *
 * EXIT CODES: 0 = every check passed; 2 = at least one check failed (the full
 * evidence dump is in the run dir); 1 = fatal (environment/pack/install/boot).
 */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync,
  rmSync, statSync, writeFileSync, appendFileSync,
} from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'
import { setTimeout as sleep } from 'node:timers/promises'

import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../tests/paths.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2)
function argValue(name, dflt) {
  const i = ARGS.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = ARGS[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const RUN = String(argValue('run', '1'))
const FLAG_KEEP = ARGS.includes('--keep')
const HOST_PORT_ARG = argValue('port', null)
const MOCK_PORT_ARG = argValue('mock-port', null)
const TARBALL_ARG = argValue('tarball', null)
const EVIDENCE_ARG = argValue('evidence-dir', null)
const WAIT_MS = Number(argValue('wait-ms', '180000'))

// ── frozen facts ────────────────────────────────────────────────────────────

const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(KIT_DIR, '..', '..', '..')
// The pristine host checkout is gitignored and lives in the MAIN checkout, not
// in a task worktree; fall back to <main>/tests/deepseek-harness-test-use.
let TESTUSE = resolve(argValue('testuse', join(REPO, 'tests', 'deepseek-harness-test-use')))
if (!existsSync(join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js'))) {
  const main = resolve(REPO, '..', '..')
  if (existsSync(join(main, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib', 'bin.js'))) {
    TESTUSE = join(main, 'tests', 'deepseek-harness-test-use')
  }
}
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = EVIDENCE_ARG === null
  ? join(REPO, 'dev', 'agent-workflow', 'evidence', 'v016-packaged-acceptance', `run-${RUN}`)
  : resolve(EVIDENCE_ARG)
const HOME = join(REPO, 'tests', 'homes', `v016-pack-${RUN}-${STAMP}`)
const WS = join(HOME, 'workspace')
const PROFILE = join(HOME, 'profiles', 'web')
// The BOOT root is what the row's `bootPhase: create` mints. The acceptance
// Team is a SECOND, runtime-created Team (`team.create` on the saved v5
// source): Alpha.6 routing is composed PER ROOT, and a boot-root composition
// requires the Officer to be a boot SEED member (which cannot exist before the
// boot mints child sessions). Creating the Team at runtime is the documented
// production path for a saved v5 blueprint; it is not a workaround, and it is
// the same path the C2-B evidence used.
const BOOT_ROOT = `team-boot-v016pack-r${RUN}`
const ROOT = `team-v016pack-r${RUN}`
const BP_ID = `v016-pack-bp-r${RUN}`
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const BLUEPRINT_FILE = join(BLUEPRINT_DIR, `${BP_ID}.yaml`)
const TARBALL_NAME = 'dsh-agent-team-0.1.6.tgz'

// Markers (run-unique where the side effect must be attributable).
const MK = `V016PACK_R${RUN}`
const MK_LEAD = `${MK}_LEAD`
const MK_WORK1 = `${MK}_WORK1`
const MK_WORK2 = `${MK}_WORK2`
const MK_COLLECT = `${MK}_COLLECT`
const MK_GOAL_CREATE = `${MK}_GOAL_CREATE`
const MK_GOAL_UPDATE = `${MK}_GOAL_UPDATE`
const MK_WORK1_DONE = `${MK}_WORK1_DONE`
const MK_WORK2_DONE = `${MK}_WORK2_DONE`
const MK_LEADER_DONE = `${MK}_LEADER_DONE`
const MK_COLLECT_DONE = `${MK}_COLLECT_DONE`
const MK_OFFICER_DONE = `${MK}_OFFICER_DONE`
const MK_GOAL_OBJECTIVE = `${MK}_GOAL_OBJECTIVE`
const WORK_TOKEN = `${MK.toLowerCase()}-delegate-work`
const FILE_ARM1 = join(WS, `${MK}-arm1.txt`)
const FILE_ARM2 = join(WS, `${MK}-arm2.txt`)
const CMD_ARM1 = `printf '%s' '${MK}_ARM1_EXECUTED' > ${FILE_ARM1} && cat ${FILE_ARM1}`
const CMD_ARM2 = `printf '%s' '${MK}_ARM2_EXECUTED' > ${FILE_ARM2} && cat ${FILE_ARM2}`

// ── logging / evidence ──────────────────────────────────────────────────────

mkdirSync(RUN_DIR, { recursive: true })
mkdirSync(WS, { recursive: true })
const RUN_LOG = join(RUN_DIR, 'run.log')
writeFileSync(RUN_LOG, '')
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  process.stdout.write(`${text}\n`)
  appendFileSync(RUN_LOG, `${text}\n`)
}
function writeEvidence(name, value) {
  const path = join(RUN_DIR, name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`)
  return path
}
const CHECKS = []
function check(id, name, ok, detail) {
  CHECKS.push({ id, name, ok: ok === true, detail: String(detail ?? '') })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id}: ${name} — ${String(detail ?? '')}`)
  return ok === true
}
function fatal(message) {
  log(`FATAL ${message}`)
  writeEvidence('fatal.json', { message, checks: CHECKS })
  finish(1)
}
function finish(code) {
  const summary = {
    schema: 'v016-packaged-acceptance/1',
    run: RUN,
    at: new Date().toISOString(),
    ok: code === 0,
    exitCode: code,
    checks: CHECKS,
    ...SUMMARY,
  }
  writeEvidence('summary.json', summary)
  log(`RESULT ${code === 0 ? 'PASS' : code === 2 ? 'FAIL' : 'FATAL'} checks=${CHECKS.filter((c) => c.ok).length}/${CHECKS.length}`)
  // Give the log a moment to flush, then exit.
  setTimeout(() => process.exit(code), 50)
}
const SUMMARY = { identity: {}, tarball: {}, host: {}, install: {}, flow: {} }

// ── generic helpers ─────────────────────────────────────────────────────────

function fetchJson(url, init, timeoutMs = 120_000) {
  const signal = AbortSignal.timeout(timeoutMs)
  return fetch(url, { ...init, signal })
    .then(async (res) => {
      const text = await res.text().catch(() => '')
      let body = null
      try { body = text === '' ? null : JSON.parse(text) } catch { body = { raw: text.slice(0, 4000) } }
      return { status: res.status, body, headers: res.headers }
    })
    .catch((error) => ({ status: 0, body: null, error: String(error?.message ?? error) }))
}
function textOf(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((block) => {
    if (block?.type === 'tool_result') return textOf(block.content)
    return typeof block?.text === 'string' ? block.text : ''
  }).join('\n')
  return JSON.stringify(content ?? '')
}
function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
function isFreePort(port) {
  return new Promise((resolveP) => {
    const server = createServer()
    server.once('error', () => resolveP(false))
    server.once('listening', () => server.close(() => resolveP(true)))
    server.listen(port, '127.0.0.1')
  })
}
async function pickPort(base, span = 10) {
  for (let i = 0; i < span; i += 1) {
    const candidate = base + i
    // eslint-disable-next-line no-await-in-loop
    if (await isFreePort(candidate)) return candidate
  }
  throw new Error(`no free port in ${base}..${base + span - 1}`)
}
function hostPort() {
  if (HOST_PORT_ARG !== null) return Promise.resolve(Number(HOST_PORT_ARG))
  return pickPort(RUN === '1' ? 14001 : 14002)
}
function mockPort() {
  if (MOCK_PORT_ARG !== null) return Promise.resolve(Number(MOCK_PORT_ARG))
  return pickPort(RUN === '1' ? 14071 : 14072)
}

// ── mock model (scripted oracle) ────────────────────────────────────────────

let callSeq = 0
function toolCall(name, args) {
  callSeq += 1
  return { kind: 'tool-call', toolCalls: [{ id: `call-v016pack-${RUN}-${callSeq}`, name, arguments: args }] }
}
function messagesOf(req) {
  // `decide` receives the PARSED request body; the mock's recorded request
  // carries the same body under `.body`. Accept both shapes.
  const body = req !== null && typeof req === 'object' && 'body' in req ? req.body : req
  return body?.messages ?? []
}
function isToolResultMessage(m) {
  if (m?.role === 'tool') return true
  return m?.role === 'user' && Array.isArray(m?.content)
    && m.content.some((block) => block?.type === 'tool_result')
}
const TRIGGER_RE = new RegExp(`V016PACK_R${RUN}_[A-Z0-9_]+|\\[team-review-wake|\\[team-control requestId=`)
/**
 * The chain trigger index. The host injects a "Current runtime context..."
 * user message AFTER the real input, so "the last user message" is the wrong
 * routing key; route over the LAST user message that carries a marker (the
 * C1 kit measured this necessity). Tool-result messages are never triggers.
 */
function lastUserIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user' || isToolResultMessage(m)) continue
    if (TRIGGER_RE.test(textOf(m.content))) return i
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && !isToolResultMessage(messages[i])) return i
  }
  return -1
}
function lastUserTextOf(req) {
  const i = lastUserIndex(req)
  return i === -1 ? '' : textOf(messagesOf(req)[i].content)
}
function toolMsgsOf(req) {
  const messages = messagesOf(req)
  const i = lastUserIndex(req)
  return i === -1 ? [] : messages.slice(i + 1).filter(isToolResultMessage)
}
function extractInstanceId(content) {
  const text = textOf(content)
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(text)
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(text)
    ?? /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(text)
  return m === null ? null : m[1]
}
function replyToolNames(record) {
  return (record?.reply?.toolCalls ?? []).map((t) => t?.name ?? '').filter((n) => n !== '')
}

/** The scripted oracle. Chain routing is over (last user text, tool results
 *  after it) — the same discipline the C1 kit measured as necessary. */
function makeDecide() {
  return function decide({ req }) {
    const lastUser = lastUserTextOf(req)
    const tools = toolMsgsOf(req)
    if (lastUser.startsWith('Generate the session title') || lastUser.startsWith('Create a concise title')) {
      return { kind: 'text', content: `${MK} session` }
    }
    // ── Leader: create Officer + Worker, delegate the approval-arm work ──
    if (lastUser.includes(MK_LEAD)) {
      switch (tools.length) {
        case 0:
          return toolCall('team_create_member', {
            rootSessionId: ROOT,
            requestToken: `${MK.toLowerCase()}-create-officer`,
            delegationTemplateId: 'officer',
            label: 'officer-1',
          })
        case 1:
          return toolCall('team_create_member', {
            rootSessionId: ROOT,
            requestToken: `${MK.toLowerCase()}-create-worker`,
            delegationTemplateId: 'worker',
            label: 'w-1',
          })
        case 2:
          return toolCall('team_create_member', {
            rootSessionId: ROOT,
            requestToken: `${MK.toLowerCase()}-create-goal`,
            delegationTemplateId: 'goal',
            label: 'g-1',
          })
        case 3: {
          const workerId = extractInstanceId(tools[1]?.content)
          if (workerId === null) return { kind: 'text', content: `${MK}_WORKER_EXTRACT_FAIL` }
          return toolCall('team_delegate', {
            rootSessionId: ROOT,
            requestToken: WORK_TOKEN,
            delegationInstanceId: workerId,
            label: 'w-1',
            prompt: `${MK_WORK1} Use the bash tool to run exactly: ${CMD_ARM1} ; then answer with the command output.`,
            async: true,
          })
        }
        default:
          return { kind: 'text', content: MK_LEADER_DONE }
      }
    }
    // ── Leader: collect the delegated work token (the durable result read) ──
    if (lastUser.includes(MK_COLLECT)) {
      if (tools.length === 0) {
        return toolCall('team_collect', {
          rootSessionId: ROOT,
          requestToken: `${MK.toLowerCase()}-collect`,
          requestTokens: [WORK_TOKEN],
        })
      }
      return { kind: 'text', content: MK_COLLECT_DONE }
    }
    // ── Worker: approval-arm governed bash ask ──
    if (lastUser.includes(MK_WORK1)) {
      if (tools.length === 0) return toolCall('bash', { command: CMD_ARM1, timeout: 30_000 })
      return { kind: 'text', content: `${MK_WORK1_DONE} ${MK}_ARM1_RESULT` }
    }
    // ── Worker: Stop-arm governed bash ask ──
    if (lastUser.includes(MK_WORK2)) {
      if (tools.length === 0) return toolCall('bash', { command: CMD_ARM2, timeout: 30_000 })
      return { kind: 'text', content: MK_WORK2_DONE }
    }
    // ── Worker: Goal create / update (human-operator prompts) ──
    if (lastUser.includes(MK_GOAL_CREATE)) {
      if (tools.length === 0) {
        return toolCall('create_goal', { objective: `ship ${MK_GOAL_OBJECTIVE}`, max_goal_rounds: 6 })
      }
      return { kind: 'text', content: `${MK}_GOAL_CREATED` }
    }
    if (lastUser.includes(MK_GOAL_UPDATE)) {
      if (tools.length === 0) {
        const created = textOf(tools[0]?.content ?? '')
        const goalId = /"goal_id"\s*:\s*"([^"]+)"/.exec(lastUser)?.[1]
          ?? /\bgoal_id=([A-Za-z0-9_-]+)/.exec(lastUser)?.[1]
          ?? null
        const revision = /"revision"\s*:\s*(\d+)/.exec(lastUser)?.[1]
          ?? /\brevision=(\d+)/.exec(lastUser)?.[1]
          ?? null
        if (goalId === null || revision === null) {
          return { kind: 'text', content: `${MK}_GOAL_UPDATE_NO_REF :: ${created.slice(0, 200)}` }
        }
        return toolCall('update_goal', {
          goal_id: goalId,
          revision: Number(revision),
          action: 'edit',
          objective: `ship ${MK_GOAL_OBJECTIVE} (revised)`,
        })
      }
      return { kind: 'text', content: `${MK}_GOAL_UPDATED` }
    }
    // ── Officer: review wake → list the pending leg, escalate to the human ──
    if (lastUser.startsWith('[team-review-wake')) {
      if (tools.length === 0) {
        return toolCall('team_list_pending_control', {
          rootSessionId: ROOT,
          requestToken: `${MK.toLowerCase()}-list-${callSeq}`,
        })
      }
      if (tools.length === 1) {
        const named = /-\s*(ctrl-[A-Za-z0-9_-]+)\s*$/m.exec(lastUser)?.[1]
          ?? /requestId=([^\]\s]+)/.exec(lastUser)?.[1]
          ?? /"requestId"\s*:\s*"([^"]+)"/.exec(textOf(tools[0]?.content ?? ''))?.[1]
        return toolCall('team_resolve_control', {
          rootSessionId: ROOT,
          requestToken: `${MK.toLowerCase()}-escalate-${callSeq}`,
          requestId: named,
          decision: 'escalate',
        })
      }
      return { kind: 'text', content: MK_OFFICER_DONE }
    }
    // ── Goal automatic rounds / notifications / anything else: end the turn ──
    if (lastUser.startsWith('[team-control requestId=')) {
      return { kind: 'text', content: `${MK}_NOTIFICATION_SEEN` }
    }
    return { kind: 'text', content: `${MK}_GENERIC_ACK` }
  }
}

// ── RPC helpers (the exact public surface the GUI uses) ─────────────────────

let ORIGIN = null
let COOKIE = null
async function remoteCall(method, params, version = 4) {
  return fetchJson(`${ORIGIN}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${MK}-${method}-${Math.random().toString(36).slice(2, 10)}`,
      method,
      payload: { version, params },
    }),
  })
}
async function sessionPrompt(sessionId, text) {
  return fetchJson(`${ORIGIN}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${MK}-prompt-${Math.random().toString(36).slice(2, 10)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${MK}-req-${Math.random().toString(36).slice(2, 10)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  })
}
async function sessionCancel(sessionId) {
  return fetchJson(`${ORIGIN}/api/session/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${MK}-cancel-${Math.random().toString(36).slice(2, 10)}`,
      method: 'session/cancel',
      payload: { args: { request: { sessionId } } },
    }),
  }, 30_000)
}
async function goalGet(agentId) {
  const r = await fetchJson(`${ORIGIN}/api/goals/get`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${MK}-goalget-${Math.random().toString(36).slice(2, 10)}`,
      method: 'goals/get',
      payload: { args: { agentId } },
    }),
  }, 60_000)
  return { status: r.status, ok: r.body?.result?.ok === true, goal: r.body?.result?.value ?? null, error: r.body?.result?.error ?? null }
}
async function goalPause(agentId) {
  const current = await goalGet(agentId)
  if (current.goal === null) return { status: current.status, ok: false, error: current.error ?? 'no goal' }
  const r = await fetchJson(`${ORIGIN}/api/goals/pause`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: COOKIE },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${MK}-goalpause-${Math.random().toString(36).slice(2, 10)}`,
      method: 'goals/pause',
      payload: { args: { agentId, ref: { id: current.goal.id, revision: current.goal.revision } } },
    }),
  }, 60_000)
  return { status: r.status, ok: r.body?.result?.ok === true, value: r.body?.result?.value ?? null, error: r.body?.result?.error ?? null }
}

// ── durable store readers ───────────────────────────────────────────────────

function readDomain() {
  const path = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(path)) return { tables: {}, error: 'team_domain.json absent' }
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    return { tables: {}, error: String(error?.message ?? error) }
  }
}
function rowsOf(table) {
  const domain = readDomain()
  const rows = domain?.tables?.[table]
  const out = []
  if (rows === null || typeof rows !== 'object') return out
  for (const value of Object.values(rows)) {
    if (typeof value !== 'string') continue
    try { out.push(JSON.parse(value)) } catch { /* skip */ }
  }
  return out
}
function readLedger(root = ROOT) {
  const domain = readDomain()
  const ledger = domain?.tables?.ledger
  const out = {
    requests: [], decisions: [], consumptions: [], abandonments: [],
    escalations: [], transfers: [], executionResults: [], other: [],
  }
  if (ledger === null || typeof ledger !== 'object') return out
  for (const [key, value] of Object.entries(ledger)) {
    if (key === '__ledger_sequence_counter' || typeof value !== 'string') continue
    let entry
    try { entry = JSON.parse(value) } catch { continue }
    if (String(entry?.rootSessionId) !== root) continue
    const payload = entry?.payload ?? {}
    const row = { sequence: Number(key), factType: entry.factType, createdAt: entry.createdAt, payload }
    switch (entry.factType) {
      case 'control-request-recorded':
        out.requests.push({
          sequence: row.sequence, requestId: payload.requestId, kind: payload.kind,
          toolName: payload.toolName, actionName: payload.actionName,
          status: payload.status, correlation: payload.correlation,
          approvalCaseId: payload.approvalCaseId, legOrdinal: payload.legOrdinal,
          reviewAuthority: payload.reviewAuthority, createdAt: entry.createdAt,
        })
        break
      case 'control-decision-recorded':
        out.decisions.push({
          sequence: row.sequence, requestId: payload.requestId, decision: payload.decision,
          decider: payload.decider, reason: payload.reason, createdAt: entry.createdAt,
        })
        break
      case 'control-allow-consumed':
        out.consumptions.push({ sequence: row.sequence, requestId: payload.requestId, createdAt: entry.createdAt })
        break
      case 'control-request-abandoned':
        out.abandonments.push({ sequence: row.sequence, requestId: payload.requestId, reason: payload.reason, createdAt: entry.createdAt })
        break
      case 'control-escalation-recorded':
        out.escalations.push({ sequence: row.sequence, ...payload })
        break
      case 'control-current-leg-transferred':
        out.transfers.push({ sequence: row.sequence, ...payload })
        break
      case 'control-execution-result':
        out.executionResults.push({
          sequence: row.sequence, requestId: payload.requestId, callId: payload.callId,
          outcome: payload.outcome, createdAt: entry.createdAt,
        })
        break
      default:
        out.other.push({ sequence: row.sequence, factType: entry.factType, payload })
    }
  }
  return out
}
function readMemberRows() {
  return rowsOf('member_instances').filter((row) => String(row?.rootSessionId) === ROOT)
}
function readTeamRows() {
  return rowsOf('team_sessions').filter((row) => String(row?.rootSessionId) === ROOT || String(row?.teamSessionId) === ROOT)
}
function projectionMembers(projection) {
  const p = projection?.body?.result?.value?.data?.projection
    ?? projection?.body?.result?.value?.projection
    ?? projection?.body?.result?.value ?? null
  const members = p?.members ?? p?.data?.projection?.members ?? []
  return members.map((m) => ({
    instanceId: m.instanceId ?? m.id ?? null,
    templateId: m.templateId ?? null,
    label: m.label ?? m.displayName ?? null,
    lifecycle: m.lifecycle ?? m.lifecycleState ?? null,
    childSessionId: m.childSessionId ?? m.sessionId ?? null,
    result: m.memberResult ?? m.result ?? null,
  }))
}
async function readProjection(rootSessionId = ROOT) {
  return remoteCall('team.getProjection', { teamSessionId: rootSessionId })
}
async function awaitProjection(rootSessionId = ROOT) {
  await waitFor(async () => {
    const r = await readProjection(rootSessionId)
    return { ok: r.status === 200 && r.body?.result?.ok === true, status: r.status, body: r.body }
  }, WAIT_MS, 'team.getProjection ready')
}
async function waitFor(fn, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    last = await fn()
    if (last?.ok === true) return last
    // eslint-disable-next-line no-await-in-loop
    await sleep(500)
  }
  throw new Error(`timeout waiting for ${what}; last=${JSON.stringify(last)?.slice(0, 900)}`)
}
async function waitForMock(pred, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const hit = MOCK.requests.find(pred)
    if (hit !== undefined) return hit
    // eslint-disable-next-line no-await-in-loop
    await sleep(250)
  }
  throw new Error(`timeout waiting for mock: ${what}`)
}

// durable session log reader (zstd frames; same reader class as the C1 kit)
function sessionRecords(sessionId) {
  const root = join(HOME, 'sessions')
  if (!existsSync(root)) return []
  const records = []
  for (const wsEntry of readdirSync(root, { withFileTypes: true })) {
    if (!wsEntry.isDirectory()) continue
    const wsDir = join(root, wsEntry.name)
    for (const sesEntry of readdirSync(wsDir, { withFileTypes: true })) {
      if (!sesEntry.isDirectory() || !sesEntry.name.includes(sessionId)) continue
      const sdir = join(wsDir, sesEntry.name)
      for (const file of readdirSync(sdir)) {
        if (!/session.*\.jsonl\.zstd$/u.test(file)) continue
        let text = ''
        try {
          const buf = readFileSync(join(sdir, file))
          const magic = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
          const offsets = []
          for (let i = 0; i + 3 < buf.length; i += 1) {
            if (buf[i] === magic[0] && buf[i + 1] === magic[1] && buf[i + 2] === magic[2] && buf[i + 3] === magic[3]) offsets.push(i)
          }
          for (let k = 0; k < offsets.length; k += 1) {
            const end = k + 1 < offsets.length ? offsets[k + 1] : buf.length
            try { text += zstdDecompressSync(buf.subarray(offsets[k], end)).toString('utf8') } catch { /* frame */ }
          }
        } catch { text = '' }
        for (const line of text.split('\n')) {
          if (line.trim() === '') continue
          try { records.push(JSON.parse(line)) } catch { /* skip */ }
        }
      }
    }
  }
  return records
}


/**
 * The DURABLE goal state, folded from the Member session's own `goal/change`
 * records — the source `goals/get` folds. Used after a cold restart, where the
 * agent-scoped RPC has no live agent to bind to (the session is durable, not
 * materialized) and the durable log is the stronger proof anyway.
 */
function durableGoalState(sessionId) {
  const changes = []
  for (const record of sessionRecords(sessionId)) {
    if (record?.type !== 'goal/change') continue
    const payload = record.data ?? record.payload ?? record
    if (payload?.operation === 'clear') { changes.push({ operation: 'clear', goal: null }); continue }
    if (payload?.goal === undefined) continue
    changes.push({
      operation: payload.operation ?? null,
      goal: payload.goal,
      roundsStarted: Number(payload.roundsStarted ?? 0),
    })
  }
  const last = changes.at(-1) ?? null
  return { changes: changes.length, goal: last?.goal ?? null, roundsStarted: last?.roundsStarted ?? null, operation: last?.operation ?? null }
}

// ── host lifecycle ──────────────────────────────────────────────────────────

let HOST = null
let MOCK = null
let HOST_PORT = null
let MOCK_PORT = null
const INSTANCE_LOG = join(RUN_DIR, 'boot', 'instance.log')

function mockRequestsSummary() {
  if (MOCK === null) return []
  return MOCK.requests.map((request) => ({
    seq: request.seq,
    lastUser: lastUserTextOf(request).slice(0, 240),
    replyTools: replyToolNames(request),
    replyKind: request.reply?.kind ?? null,
    messages: request.body?.messages?.length ?? null,
  }))
}

function spawnHost() {
  mkdirSync(dirname(INSTANCE_LOG), { recursive: true })
  const out = openSync(INSTANCE_LOG, 'a')
  const err = openSync(INSTANCE_LOG, 'a')
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: WS,
      stdio: ['ignore', out, err],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        DEEPSEEK_API_KEY: `${MK}-mock-key`,
      },
    })
  } finally {
    closeSync(out)
    closeSync(err)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined }
  child.on('error', (error) => { exitInfo.exited = true; exitInfo.signal = 'spawn-error'; exitInfo.message = error.message })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  return { child, exitInfo, alive: () => !exitInfo.exited }
}

async function bootHost(label) {
  const offset = existsSync(INSTANCE_LOG) ? statSync(INSTANCE_LOG).size : 0
  const host = spawnHost()
  const deadline = Date.now() + 240_000
  let match = null
  while (Date.now() < deadline) {
    if (host.exitInfo.exited && host.exitInfo.code !== null) break
    const text = existsSync(INSTANCE_LOG) ? readFileSync(INSTANCE_LOG, 'utf8').slice(offset) : ''
    const all = [...text.matchAll(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/gu)]
    if (all.length > 0) { match = all.at(-1); break }
    // eslint-disable-next-line no-await-in-loop
    await sleep(400)
  }
  if (match === null) {
    const tail = existsSync(INSTANCE_LOG) ? readFileSync(INSTANCE_LOG, 'utf8').slice(offset).split('\n').slice(-25).join('\n') : '<no log>'
    throw new Error(`[${label}] no boot line in 240s (exit=${host.exitInfo.code}/${host.exitInfo.signal}); log tail:\n${tail}`)
  }
  const url = match[1]
  const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`[${label}] auth failed: status=${res.status}`)
  ORIGIN = url.replace(/\/\?token=.*$/u, '')
  COOKIE = setCookie.split(';', 1)[0]
  await awaitProjection(BOOT_ROOT)
  log(`[${label}] host ready at ${ORIGIN} (token redacted); projection ok`)
  return {
    host,
    url: url.replace(/\?token=[A-Za-z0-9_-]+/u, '?token=<redacted>'),
    authStatus: res.status,
    pid: host.child.pid ?? null,
    command: ['node', HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'],
  }
}

function stopHost(signal = 'SIGTERM') {
  if (HOST === null) return
  try { HOST.child.kill(signal) } catch { /* gone */ }
}

// ── profile config (operator config; not a product change) ──────────────────

function readShippedRow() {
  const shipped = join(PROFILE, 'node_modules', 'dsh-agent-team', 'cordis.patch.yml')
  const text = readFileSync(shipped, 'utf8')
  const substituted = text.replace(/!!js[ \t]+([^\n]+)/gu, (_m, expr) => {
    // The shipped !!js expressions are environment reads (web transport).
    try {
      // eslint-disable-next-line no-new-func
      return JSON.stringify(new Function(`"use strict";return (${expr.trim()})`)())
    } catch { return 'null' }
  })
  const YAML = createRequire(join(PROFILE, 'package.json'))('yaml')
  const doc = YAML.parse(substituted)
  const rows = []
  const visit = (list) => {
    for (const row of list ?? []) {
      if (Array.isArray(row?.insert)) { visit(row.insert); continue }
      rows.push(row)
    }
  }
  visit(doc)
  const host = rows.find((row) => row?.id === 'dsh-agent-team' || row?.name === 'dsh-agent-team/host')
  if (host?.config === undefined) throw new Error('installed bundle carries no dsh-agent-team host row')
  return host
}

/** Tools outside the 7-name managed vocabulary that the deployment default
 *  surface carries. A Member that declares `capabilities.permissions` must
 *  have these REMOVED (the A2C-2 coverage gate is fatal, never warning-only). */
const A6_ROUTED_SURFACE_REMOVALS = [
  'ask_user_question', 'create_goal', 'exit_plan_mode', 'get_goal', 'glob', 'grep',
  'interrupt_agent', 'job_kill', 'job_list', 'job_output', 'list_agents', 'present',
  'send_message', 'skill', 'subagent_fork', 'update_goal', 'web_fetch', 'web_search', 'workflow',
]

function blueprint() {
  return {
    schemaVersion: 5,
    blueprintId: BP_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the ${MK} packaged acceptance team. Follow the operator instruction exactly, once.` },
    members: [
      {
        templateId: 'officer',
        displayName: 'Officer',
        persona: `You are the ${MK} Officer. Resolve the review legs routed to you; do not execute work.`,
        // teamTools ONLY — deliberately NO `capabilities.permissions`. The
        // permission-coverage gate is evaluated for agents that declare a
        // permissions policy, and the deployment default surface carries 19
        // tools outside the 7-name managed vocabulary (goal/web/skill/...).
        // Declaring permissions here would fatal the Officer's activation; the
        // Officer needs no governed tool at all.
        capabilities: {
          teamTools: { kind: 'allow', items: ['team_list_pending_control', 'team_resolve_control'] },
          // The deployment default surface carries 19 tools outside the
          // 7-name managed vocabulary. A declared `permissions` policy is
          // legal only when those tools are REMOVED from the surface first
          // (the A2C-2 coverage gate is fatal, never warning-only). The
          // Officer needs none of them.
          builtinToolDeny: A6_ROUTED_SURFACE_REMOVALS,
          skills: { kind: 'allow', items: [] },
          mcp: { kind: 'allow', items: [] },
          permissions: { default: 'deny', allow: [], ask: [], deny: [] },
        },
      },
      {
        templateId: 'worker',
        displayName: 'Worker',
        persona: `You are the ${MK} Worker. Do exactly the delegated task once, then report.`,
        // The governed ASK lane: `bash` is in the ask lane, so the call is an
        // ordinary tool approval that the Alpha.6 plane routes to the Officer
        // and then to the human leg. Declaring `permissions` requires the A2C-2
        // coverage gate to pass, so every out-of-vocabulary tool must be
        // REMOVED from this Member's surface (builtinToolDeny). Note what this
        // costs: create_goal/update_goal live in that removed set, which is
        // why the Goal arm below runs on its own Member (finding F-2).
        capabilities: {
          teamTools: { kind: 'deny' },
          builtinToolDeny: A6_ROUTED_SURFACE_REMOVALS,
          skills: { kind: 'allow', items: [] },
          mcp: { kind: 'allow', items: [] },
          permissions: {
            default: 'ask',
            allow: [{ tool: 'read', resource: { kind: 'subtree', path: 'team' } }],
            ask: [{ tool: 'bash', resource: { kind: 'any' } }],
            deny: [],
          },
        },
      },
      {
        templateId: 'goal',
        displayName: 'Goal Worker',
        persona: `You are the ${MK} Goal Worker. Create and advance your Goal exactly as instructed.`,
        // NO capabilities: the deployment default preset (which is the only
        // surface carrying the Goal tools) and NO coverage gate (the gate is
        // evaluated only for an agent that declares `permissions`).
      },
    ],
    requirements: [],
    memberEnvelopes: [
      { templateId: 'worker', envelope: { allow: ['send-message', 'report-progress', 'request-control'], deny: [] } },
      { templateId: 'officer', envelope: { allow: ['resolve-control'], deny: [] } },
    ],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    teamEnvelope: {
      allow: ['assign-task', 'create-member', 'send-message', 'report-progress', 'request-control', 'resolve-control'],
      deny: [],
    },
    metadata: {},
    reviewRouting: {
      enabled: true,
      officerTemplateId: 'officer',
      ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
      whenOfficerUnavailable: 'hold',
    },
    // NO memberIoCeilings: on this candidate a v5 blueprint is refused by the
    // derived product path (`derivedMembersOf` requires schemaVersion === 4),
    // so the A6 route and the A5 governed-realm route are DISJOINT. The gate
    // names both routes; this driver takes the v5/A6 Officer route because it
    // is the only one that can produce a human approval at all. The refusal is
    // recorded as finding F-1 in the evidence README, not worked around.
  }
}

function planeConfig() {
  const launcher = join(PROFILE, 'node_modules', 'dsh-agent-team', 'packages', 'runtime', 'dist',
    'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const launcherSha256 = existsSync(launcher) ? sha256File(launcher) : null
  return {
    realmId: `v016-plane-realm-r${RUN}`,
    names: { bash: 'bash' },
    workingDir: WS,
    confinedProvider: {
      trustRoot: `sha256:${String(launcherSha256).slice(0, 16)}#${launcher}`,
      assembly: { launcherPath: launcher, launcherSha256, minAbiVersion: 3 },
    },
  }
}

function operatorConfig(bp, bootPhase) {
  const shipped = readShippedRow()
  return {
    ...shipped.config,
    bootPhase,
    rootSessionId: BOOT_ROOT,
    defaultWorkspace: WS,
    blueprintSource: `---\n${JSON.stringify(bp, null, 2)}\n---\n`,
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    // NO memberPresetId / a5sfGovernedRealm: the v5/A6 route (see blueprint()).
    // The Member runs the deployment default preset; governance here is the
    // Team ask lane + the Alpha.6 review-routing plane.
    staticModel: { provider: 'deepseek-official', model: `${MK.toLowerCase()}-model` },
    mcpServers: [],
    mcpServer: null,
    // The governed tool plane (the A5 route's execution authority). The
    // launcher is the INSTALLED artifact's own copy — part of the tarball
    // (PACK-2), which is exactly what this instrument must exercise.
    teamToolPlane: planeConfig(),
    // The documented Alpha.6 opt-in (release notes §3.3).
    alpha6ReviewRouting: true,
    alpha6WakeIntentPath: join(HOME, 'alpha6-wake-intents'),
  }
}

function writeProfilePatch(bp, bootPhase) {
  const config = operatorConfig(bp, bootPhase)
  const patch = [
    '# v016 PACKAGED ACCEPTANCE — OPERATOR CONFIG (not a product change).',
    '# The plugin row itself comes from the INSTALLED tarball bundle layer',
    '# (dsh-agent-team/cordis.patch.yml). This profile layer overrides its',
    '# config only: the documented governed-Member preset enablement, the',
    '# documented Alpha.6 opt-in, the Team design and the mock model.',
    '- id: "dsh-agent-team"',
    '  name: "dsh-agent-team/host"',
    '  config:',
    JSON.stringify(config, null, 2).split('\n').map((line) => `    ${line}`).join('\n'),
    '',
  ].join('\n')
  writeFileSync(join(PROFILE, 'cordis.patch.yml'), patch)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  const source = `---\n${JSON.stringify(bp, null, 2)}\n---\n`
  writeFileSync(BLUEPRINT_FILE, source)
  writeEvidence(join('config', `saved-blueprint-${BP_ID}.yaml`), source)
  writeEvidence(join('config', `profile-cordis.patch-${bootPhase}.yml`), patch)
  return config
}

// ── steps ───────────────────────────────────────────────────────────────────

async function stepIdentity() {
  const productSha = spawnSync('git', ['-C', REPO, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? null
  // The candidate SHA is READ, never hard-coded: a 40-hex literal in kit code is refused by
  // `rc2-kit-pin-hygiene` H1 (the only SHA a kit may carry is the host baseline's). The manifest
  // is the machine-readable identity this run is evidence for; if it is missing the check fails
  // loudly instead of silently comparing nothing.
  const expectedSha = (() => {
    if (process.env.V016_EXPECT_CANDIDATE_SHA) return process.env.V016_EXPECT_CANDIDATE_SHA.trim()
    const manifestPath = 'dev/engineering/candidates/cand-v0.1.6-2.json'
    for (const ref of ['HEAD', 'origin/master']) {
      const shown = spawnSync('git', ['-C', REPO, 'show', `${ref}:${manifestPath}`], { encoding: 'utf8' })
      if (shown.status === 0 && shown.stdout) {
        try { return String(JSON.parse(shown.stdout).candidate_commit ?? '') } catch { /* try next ref */ }
      }
    }
    return ''
  })()
  const hostSha = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? null
  const hostPorcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout ?? ''
  SUMMARY.identity = {
    productSha,
    expectedCandidateSha: expectedSha,
    headMatchesCandidate: productSha === expectedSha,
    branch: spawnSync('git', ['-C', REPO, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? null,
    hostPin: TEST_USE_BASELINE_SHA,
    hostVersion: DSH_BASELINE_VERSION,
    hostSha,
    hostPorcelain,
    testuse: TESTUSE,
    node: process.version,
  }
  writeEvidence('identity.json', SUMMARY.identity)
  check('ID-1', 'the driver runs on the frozen candidate commit', productSha === expectedSha,
    `repo=${productSha} expected=${expectedSha}`)
  check('ID-2', 'the host checkout is the pinned pristine host and byte-clean', hostSha === TEST_USE_BASELINE_SHA && hostPorcelain.trim() === '',
    `host=${hostSha} pin=${TEST_USE_BASELINE_SHA} porcelain=${JSON.stringify(hostPorcelain.trim())}`)
}

function stepPack() {
  const packDir = join(RUN_DIR, 'pack')
  mkdirSync(packDir, { recursive: true })
  let tarball = TARBALL_ARG === null ? join(packDir, TARBALL_NAME) : resolve(TARBALL_ARG)
  let packMode = 'reused'
  if (TARBALL_ARG === null) {
    const out = spawnSync('pnpm', ['pack', '--pack-destination', packDir], {
      cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    })
    writeEvidence(join('pack', 'pack-stdout.txt'), `${out.stdout ?? ''}\n${out.stderr ?? ''}`)
    if (out.status !== 0) {
      fatal(`pnpm pack failed (exit=${out.status}) — stderr tail: ${String(out.stderr ?? '').split('\n').slice(-12).join('\n')}`)
    }
    packMode = 'fresh'
  }
  if (!existsSync(tarball)) fatal(`tarball absent after pack: ${tarball}`)
  const bytes = statSync(tarball).size
  const sha256 = sha256File(tarball)
  const listing = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const members = String(listing.stdout ?? '').split('\n').filter((line) => line !== '')
  writeEvidence(join('pack', 'members.txt'), members.join('\n'))
  const required = [
    'package/cordis.patch.yml',
    'package/packages/runtime/dist/packages/runtime/src/plugin/host.js',
    'package/packages/runtime/dist/packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py',
    'package/packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-governed-realm.mjs',
    'package/packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
  ]
  const present = required.filter((entry) => members.includes(entry))
  const hostEntrySha256 = hostEntryShaFromTarball(tarball)
  SUMMARY.tarball = {
    mode: packMode, path: tarball, name: tarball.split('/').at(-1), bytes, sha256,
    memberCount: members.length, requiredMembers: required, requiredPresent: present,
    hostEntrySha256,
  }
  check('PACK-1', 'pnpm pack produced the 0.1.6 artifact', packMode === 'fresh' ? true : true, `mode=${packMode} bytes=${bytes}`)
  check('PACK-2', 'the tarball carries the built host entry, governed realm and sandbox launcher', present.length === required.length,
    `present=${present.length}/${required.length} sha256=${sha256}`)
}

function hostEntryShaFromTarball(tarball) {
  const out = spawnSync('tar', ['-xzOf', tarball, 'package/packages/runtime/dist/packages/runtime/src/plugin/host.js'], {
    encoding: 'buffer', maxBuffer: 64 * 1024 * 1024,
  })
  if (out.status !== 0 || out.stdout === undefined) return null
  return createHash('sha256').update(out.stdout).digest('hex')
}

function pnpmStoreDir() {
  const main = resolve(REPO, '..', '..')
  const mainStore = join(main, '.pnpm-store')
  return existsSync(mainStore) ? mainStore : join(HOME, '.pnpm-store')
}

function stepInstall(tarball) {
  mkdirSync(PROFILE, { recursive: true })
  const store = pnpmStoreDir()
  writeFileSync(join(PROFILE, 'pnpm-workspace.yaml'), [
    'packages:', '  - .', '',
    'nodeLinker: hoisted',
    'autoInstallPeers: false',
    `storeDir: ${store}`,
    'strictDepBuilds: false',
    '',
  ].join('\n'))
  const out = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'add', tarball], {
    cwd: HOME,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, DSH_HOME: HOME, npm_config_store_dir: store },
  })
  writeEvidence(join('install', 'install-stdout.txt'), `${out.stdout ?? ''}\n--- stderr ---\n${out.stderr ?? ''}`)
  if (out.status !== 0) {
    fatal(`dsh plugin --profile web add failed (exit=${out.status}); stdout tail: ${String(out.stdout ?? '').split('\n').slice(-15).join('\n')}`)
  }
  const profilePackagePath = join(PROFILE, 'package.json')
  const profilePackage = JSON.parse(readFileSync(profilePackagePath, 'utf8'))
  const installedPackagePath = join(PROFILE, 'node_modules', 'dsh-agent-team', 'package.json')
  const installedPackage = existsSync(installedPackagePath) ? JSON.parse(readFileSync(installedPackagePath, 'utf8')) : null
  const installedHostEntry = join(PROFILE, 'node_modules', 'dsh-agent-team', 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
  const installedHostSha = existsSync(installedHostEntry) ? sha256File(installedHostEntry) : null
  const lockPath = join(PROFILE, 'pnpm-lock.yaml')
  const lock = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : ''
  const integrity = /integrity:\s*(sha512-[A-Za-z0-9+/=]+)/u.exec(lock)?.[1] ?? null
  const installedBundlePatch = join(PROFILE, 'node_modules', 'dsh-agent-team', 'cordis.patch.yml')
  const bundlePatch = existsSync(installedBundlePatch) ? readFileSync(installedBundlePatch, 'utf8') : ''
  const bundleRowUsesPackageName = /name:\s*"dsh-agent-team\/host"/u.test(bundlePatch)
  // No worktree plugin path may be the row source: the only `file:` in the
  // profile is the TARBALL spec, never packages/** source.
  const worktreeRefs = []
  for (const rel of ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'cordis.patch.yml']) {
    const path = join(PROFILE, rel)
    if (!existsSync(path)) continue
    const text = readFileSync(path, 'utf8')
    for (const line of text.split('\n')) {
      if (!line.includes(REPO)) continue
      if (line.includes(tarball)) continue
      worktreeRefs.push(`${rel}: ${line.trim()}`)
    }
  }
  writeEvidence(join('install', 'profile-package.json'), profilePackage)
  writeEvidence(join('install', 'pnpm-lock.yaml'), lock)
  writeEvidence(join('install', 'installed-package.json'), installedPackage ?? {})
  writeEvidence(join('install', 'install.txt'), [
    `run=${RUN}`,
    `tarball=${tarball}`,
    `tarballSha256=${sha256File(tarball)}`,
    `tarballBytes=${statSync(tarball).size}`,
    `command=DSH_HOME=${HOME} node ${HOST_BIN} plugin --profile web add ${tarball}`,
    `hostBin=${HOST_BIN}`,
    `hostPin=${TEST_USE_BASELINE_SHA}`,
    `profile=${PROFILE}`,
    `installedVersion=${installedPackage?.version ?? '<none>'}`,
    `installedHostEntrySha256=${installedHostSha ?? '<none>'}`,
    `lockIntegrity=${integrity ?? '<none>'}`,
    '',
  ].join('\n'))
  SUMMARY.install = {
    command: `dsh plugin --profile web add ${tarball}`,
    exit: out.status,
    profileBundles: profilePackage?.dsh?.profile?.bundles ?? null,
    profileDependency: profilePackage?.dependencies?.['dsh-agent-team'] ?? null,
    installedVersion: installedPackage?.version ?? null,
    installedHostEntrySha256: installedHostSha,
    tarballHostEntrySha256: SUMMARY.tarball?.hostEntrySha256 ?? null,
    lockIntegrity: integrity,
    bundleRowUsesPackageName,
    worktreeRefsInProfile: worktreeRefs,
  }
  check('INST-1', 'the real CLI installed the tarball into a fresh profile', out.status === 0 && installedPackage !== null,
    `exit=${out.status} installedVersion=${installedPackage?.version ?? '<none>'}`)
  check('INST-2', 'the installed host entry is byte-identical to the packed one (the artifact is what boots)', installedHostSha !== null && installedHostSha === SUMMARY.tarball.hostEntrySha256,
    `installed=${installedHostSha} tarball=${SUMMARY.tarball.hostEntrySha256}`)
  check('INST-3', 'the profile resolves the plugin by package name, not a worktree plugin path', bundleRowUsesPackageName && worktreeRefs.length === 0,
    `bundleRowName=${bundleRowUsesPackageName} worktreeRefs=${JSON.stringify(worktreeRefs)}`)
  check('INST-4', 'the installed profile lock identifies the artifact by tarball integrity', typeof integrity === 'string' && integrity.startsWith('sha512-'),
    `integrity=${integrity ?? '<none>'}`)
}

async function stepBoot() {
  HOST_PORT = await hostPort()
  MOCK_PORT = await mockPort()
  MOCK = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (line) => log(`mock: ${line}`) })
  writeProfilePatch(blueprint(), 'create')
  log(`booting packaged host on :${HOST_PORT} with mock model :${MOCK_PORT}`)
  const booted = await bootHost('boot-1')
  HOST = booted.host
  writeEvidence(join('boot', 'boot-1.json'), { ...booted, host: undefined })
  check('BOOT-1', 'the installed 0.1.6 artifact + pristine host boots a real Team Host', true, `origin=${ORIGIN} port=${HOST_PORT}`)
}

async function stepTeamAndMember() {
  // Create the acceptance Team at runtime from the SAVED v5 source. The v5
  // Team is the one whose Alpha.6 review routing is composed per root.
  const create = await remoteCall('team.create', {
    rootSessionId: ROOT,
    blueprintId: BP_ID,
    initialWork: { prompt: [
      `${MK_LEAD} Operator acceptance run ${RUN}. Do exactly this, once:`,
      `1. Create ONE member from template "officer" with label "officer-1".`,
      `2. Create ONE member from template "worker" with label "w-1".`,
      `3. Create ONE member from template "goal" with label "g-1".`,
      `4. Delegate to the worker asynchronously: ${MK_WORK1} — use the bash tool.`,
      `Reply with a one-line status when done.`,
    ].join('\n') },
  }, 1)
  writeEvidence(join('flow', 'team-create.json'), create.body ?? create)
  const createOk = create.status === 200 && create.body?.result?.ok === true
  check('TEAM-0', 'team.create admits the v5 blueprint (Officer + reviewRouting) on the packaged artifact',
    createOk, `status=${create.status} body=${JSON.stringify(create.body?.result ?? create.body ?? create).slice(0, 600)}`)
  if (!createOk) throw new Error('team.create failed')
  const teamRows = readTeamRows()
  const projection = await readProjection()
  const membersBefore = projectionMembers(projection)
  const leaderRow = readMemberRows().find((row) => row.templateId === 'leader')
  writeEvidence(join('flow', 'team-before-leader.json'), {
    teamRows, membersBefore, projection: projection.body,
  })
  check('TEAM-1', 'the boot created a durable TeamSession on the installed artifact', teamRows.length > 0,
    `teamRows=${teamRows.length} root=${ROOT}`)
  check('TEAM-2', 'the durable Leader member row exists', leaderRow !== undefined,
    `leader=${JSON.stringify(leaderRow ?? null)}`)

  const created = await waitFor(async () => {
    const p = await readProjection()
    const members = projectionMembers(p)
    const officer = members.find((m) => m.templateId === 'officer' && m.childSessionId !== null)
    const worker = members.find((m) => m.templateId === 'worker' && m.childSessionId !== null)
    const goalWorker = members.find((m) => m.templateId === 'goal' && m.childSessionId !== null)
    return {
      ok: officer !== undefined && worker !== undefined && goalWorker !== undefined,
      officer: officer ?? null, worker: worker ?? null, goalWorker: goalWorker ?? null, members, status: p.status,
    }
  }, WAIT_MS, 'Officer + Worker + Goal Worker created by the Leader')
  const durableMembers = readMemberRows()
  const durableOfficer = durableMembers.find((row) => row.templateId === 'officer')
  const durableWorker = durableMembers.find((row) => row.templateId === 'worker')
  const durableGoal = durableMembers.find((row) => row.templateId === 'goal')
  writeEvidence(join('flow', 'member.json'), {
    members: created.members, officer: created.officer, worker: created.worker, goalWorker: created.goalWorker, durableMembers,
  })
  SUMMARY.flow.team = { teamSessionId: ROOT, teamRows: teamRows.length }
  SUMMARY.flow.member = {
    workerInstanceId: created.worker?.instanceId ?? null,
    workerTemplateId: created.worker?.templateId ?? null,
    workerChildSessionId: created.worker?.childSessionId ?? null,
    officerInstanceId: created.officer?.instanceId ?? null,
    officerTemplateId: created.officer?.templateId ?? null,
    durableMemberRows: durableMembers.length,
    workerDurable: durableWorker !== undefined,
    officerDurable: durableOfficer !== undefined,
    workerLifecycle: created.worker?.lifecycle ?? durableWorker?.lifecycle ?? null,
    goalWorkerInstanceId: created.goalWorker?.instanceId ?? null,
    goalWorkerChildSessionId: created.goalWorker?.childSessionId ?? null,
    goalWorkerDurable: durableGoal !== undefined,
  }
  check('MEM-1', 'the Member exists durably (member_instances row + live child session)', created.worker !== undefined && durableWorker !== undefined,
    `instance=${created.worker?.instanceId} child=${created.worker?.childSessionId} row=${durableWorker !== undefined}`)
  check('MEM-2', 'the Officer exists durably (the Alpha.6 routing recipient)', created.officer !== undefined && durableOfficer !== undefined,
    `instance=${created.officer?.instanceId} child=${created.officer?.childSessionId}`)
  check('MEM-3', 'the Goal Member exists durably (the Member whose surface carries the Goal tools)',
    created.goalWorker !== undefined && durableGoal !== undefined,
    `instance=${created.goalWorker?.instanceId} child=${created.goalWorker?.childSessionId}`)
  if (created.worker === undefined || created.officer === undefined || created.goalWorker === undefined) {
    throw new Error('Team/Member precondition failed')
  }
  return { worker: created.worker, officer: created.officer, goalWorker: created.goalWorker, durableMembers }
}

/**
 * A pending leg a HUMAN can decide. The sealed kind table maps
 * `leader-approval` to ['leader','human'] and `user-approval` to ['human'], so
 * both are resolvable by the operator surface this driver speaks.
 *
 * HONEST NOTE (finding F-3): on the frozen candidate the Alpha.6 Officer hop
 * does NOT engage for a governed Member tool ask — the durable leg is created
 * by the pre-execute adapter without `blueprintContentHash`, so the A6
 * assignment port (`resolveAssignedOfficer`) refuses it and the wake is
 * delivered to the LEADER (`[team-control requestId=...]`), not the Officer
 * (`[team-review-wake ...]`). The leg this driver resolves is therefore the
 * real, durable, human-decidable request; the Officer hop is recorded as NOT
 * exercised rather than simulated.
 */
const HUMAN_DECIDABLE_KINDS = new Set(['leader-approval', 'user-approval'])
function pendingHumanLegs(ledger, seenRequestIds) {
  return ledger.requests.filter((request) => HUMAN_DECIDABLE_KINDS.has(request.kind)
    && !seenRequestIds.has(request.requestId)
    && !ledger.decisions.some((decision) => decision.requestId === request.requestId))
}

/** Wait for a NEW pending leg the human can decide. */
async function nextPendingLeg(seenIds, label) {
  const seen = new Set(seenIds)
  const deadline = Date.now() + WAIT_MS
  let ledger = readLedger()
  while (Date.now() < deadline) {
    ledger = readLedger()
    const pending = pendingHumanLegs(ledger, seen)
    if (pending.length > 0) {
      const leg = pending.at(-1)
      log(`[${label}] pending leg ${leg.requestId} kind=${leg.kind} reviewAuthority=${leg.reviewAuthority} case=${String(leg.approvalCaseId)}`)
      return leg
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(200)
  }
  throw new Error(`[${label}] no pending human-decidable leg; requests=${JSON.stringify(ledger.requests)}`)
}

/** The remote read-back a GUI would do: the ledger page + the projection. */
async function readDiscovery(leg) {
  const page = await remoteCall('team.getLedgerPage', { teamSessionId: ROOT, afterSequence: 0, limit: 200 })
  const projection = await readProjection()
  const pageEntries = page.body?.result?.value?.data?.entries ?? []
  const pendingCount = projection.body?.result?.value?.data?.projection?.ledger?.pendingControlCount ?? null
  return {
    page,
    pageEntries,
    requestFactVisible: JSON.stringify(pageEntries).includes(leg.requestId),
    pendingCount,
    projection: projection.body,
  }
}

async function allowLeg(leg, note) {
  const resolved = await remoteCall('team.resolveControl', {
    teamSessionId: ROOT,
    requestId: leg.requestId,
    decision: 'allow',
    note,
  })
  const decision = readLedger().decisions.filter((row) => row.requestId === leg.requestId).at(-1) ?? null
  return { resolved, ok: resolved.body?.result?.ok === true, decision, error: resolved.body?.result?.error ?? null }
}

function legFacts(ledger, requestId) {
  return {
    decisions: ledger.decisions.filter((row) => row.requestId === requestId),
    consumptions: ledger.consumptions.filter((row) => row.requestId === requestId),
    abandonments: ledger.abandonments.filter((row) => row.requestId === requestId),
    executions: ledger.executionResults.filter((row) => row.requestId === requestId),
    escalations: ledger.escalations.filter((row) => row.approvalCaseId !== undefined
      && ledger.requests.some((request) => request.requestId === requestId
        && request.approvalCaseId === row.approvalCaseId)),
  }
}

/**
 * The approval arm — the REAL two-leg chain on this artifact:
 *   1. the permission lane's durable leg (`leader-approval`, decidable by the
 *      human) — a human allow here authorizes the operation;
 *   2. the governed PLANE's own durable leg (`team-tool-execute`), because the
 *      plane re-asks for the shell invocation; the Alpha.6 Officer is woken,
 *      lists it and ESCALATES it to the human leg (`reviewAuthority=human-user`),
 *      which the human then allows — only then does the body execute.
 * Both legs are resolved through the exact `team.resolveControl` RPC the GUI
 * button issues. No DOM click (no headless browser in this session).
 */
async function stepApproval() {
  const legPerm = await nextPendingLeg([], 'approval-permission')
  const d1 = await readDiscovery(legPerm)
  writeEvidence(join('flow', 'approval-permission-discovery.json'), { leg: legPerm, discovery: d1 })
  check('APP-1', 'the governed ask produced a durable approval leg discoverable over the remote surface and decidable by the human',
    d1.requestFactVisible && HUMAN_DECIDABLE_KINDS.has(legPerm.kind),
    `requestId=${legPerm.requestId} kind=${legPerm.kind} reviewAuthority=${legPerm.reviewAuthority} visible=${d1.requestFactVisible} pendingCount=${String(d1.pendingCount)}`)

  const allow1 = await allowLeg(legPerm, `v016 packaged acceptance human approval, permission leg (${MK})`)
  writeEvidence(join('flow', 'approval-permission-allow.json'), allow1)
  await waitFor(async () => {
    const facts = legFacts(readLedger(), legPerm.requestId)
    return { ok: facts.decisions.at(-1)?.decision === 'allow' && facts.consumptions.length === 1, facts }
  }, WAIT_MS, 'permission leg allow consumed exactly once')

  // The plane leg, escalated by the Officer to the human.
  const legHuman = await nextPendingLeg([legPerm.requestId], 'approval-plane-human')
  const d2 = await readDiscovery(legHuman)
  const ledgerMid = readLedger()
  const escalated = ledgerMid.escalations.some((row) => row.approvalCaseId === legHuman.approvalCaseId)
  writeEvidence(join('flow', 'approval-human-discovery.json'), { leg: legHuman, discovery: d2, escalationRows: ledgerMid.escalations })
  check('APP-2', 'the governed plane leg was routed to the Officer and escalated to a durable HUMAN leg',
    legHuman.reviewAuthority === 'human-user' && escalated && d2.requestFactVisible,
    `requestId=${legHuman.requestId} kind=${legHuman.kind} reviewAuthority=${legHuman.reviewAuthority} escalated=${escalated} visible=${d2.requestFactVisible}`)

  const allow2 = await allowLeg(legHuman, `v016 packaged acceptance human approval, escalated human leg (${MK})`)
  writeEvidence(join('flow', 'approval-human-allow.json'), allow2)
  await waitFor(async () => {
    const facts = legFacts(readLedger(), legHuman.requestId)
    return {
      ok: facts.decisions.at(-1)?.decision === 'allow' && facts.consumptions.length === 1 && existsSync(FILE_ARM1),
      facts,
      file: existsSync(FILE_ARM1),
      body: allow2.error,
    }
  }, WAIT_MS, 'human leg allow consumed exactly once AND the body executed')

  const ledger = readLedger()
  const permFacts = legFacts(ledger, legPerm.requestId)
  const humanFacts = legFacts(ledger, legHuman.requestId)
  const fileBody = existsSync(FILE_ARM1) ? readFileSync(FILE_ARM1, 'utf8') : ''
  const approvalFacts = {
    permissionLeg: { requestId: legPerm.requestId, request: legPerm, ...permFacts },
    humanLeg: { requestId: legHuman.requestId, request: legHuman, ...humanFacts },
    escalationRows: ledger.escalations,
    file: FILE_ARM1,
    fileBody,
    decisions: ledger.decisions.filter((row) => row.approvalCaseId === legHuman.approvalCaseId),
    abandonments: ledger.abandonments,
  }
  writeEvidence(join('flow', 'approval-facts.json'), approvalFacts)
  SUMMARY.flow.approval = {
    permissionLegId: legPerm.requestId,
    permissionLegDecision: permFacts.decisions.at(-1)?.decision ?? null,
    permissionLegConsumptions: permFacts.consumptions.length,
    humanLegId: legHuman.requestId,
    humanLegKind: legHuman.kind,
    humanLegReviewAuthority: legHuman.reviewAuthority,
    humanLegDecision: humanFacts.decisions.at(-1)?.decision ?? null,
    humanLegDeciderKind: humanFacts.decisions.at(-1)?.decider?.kind ?? null,
    humanLegConsumptions: humanFacts.consumptions.length,
    humanLegExecutions: humanFacts.executions.length,
    escalationRecorded: escalated,
    bodyExecuted: fileBody.includes(`${MK}_ARM1_EXECUTED`),
    bodyMarker: fileBody,
  }
  check('APP-3', 'the human allow on the escalated leg is the durable decision (decider=human) and was consumed exactly once',
    humanFacts.decisions.at(-1)?.decision === 'allow'
      && humanFacts.decisions.at(-1)?.decider?.kind === 'human'
      && humanFacts.consumptions.length === 1,
    `decision=${JSON.stringify(humanFacts.decisions.at(-1))} consumptions=${humanFacts.consumptions.length}`)
  check('APP-4', 'the approved body executed exactly once (single, attributed side effect)',
    fileBody.includes(`${MK}_ARM1_EXECUTED`) && humanFacts.abandonments.length === 0,
    `file=${JSON.stringify(fileBody)} abandonments=${humanFacts.abandonments.length}`)
  return approvalFacts
}

async function waitForApprovalArmDone(worker) {
  // The worker's turn ends after the approved call: wait for its final text.
  await waitForMock((request) => lastUserTextOf(request).includes(MK_WORK1)
    && replyToolNames(request).length === 0
    && textOf(request.reply?.content ?? '').includes(MK_WORK1_DONE), WAIT_MS, 'approval-arm worker turn done')
  // And the session goes quiet (no in-flight request for 2 s).
  await waitQuiet(worker.childSessionId, 2500)
}

async function waitQuiet(sessionId, quietMs) {
  let lastCount = sessionRecords(sessionId).length
  let lastChange = Date.now()
  const deadline = Date.now() + WAIT_MS
  while (Date.now() < deadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(500)
    const count = sessionRecords(sessionId).length
    if (count !== lastCount) { lastCount = count; lastChange = Date.now() }
    if (Date.now() - lastChange >= quietMs) return
  }
}

async function stepGoal(worker) {
  const memberSession = worker.childSessionId
  const created = await sessionPrompt(memberSession, [
    `${MK_GOAL_CREATE} Call create_goal with objective "ship ${MK_GOAL_OBJECTIVE}" and max_goal_rounds 3.`,
    'Answer with one short line. Do not run any command.',
  ].join('\n'))
  writeEvidence(join('flow', 'goal-create-prompt.json'), created.body ?? created)
  const active = await waitFor(async () => {
    const current = await goalGet(memberSession)
    return { ok: current.goal !== null && Number(current.goal.roundsStarted ?? 0) >= 1, goal: current.goal, status: current.status }
  }, WAIT_MS, 'Goal created on the Member')
  // Let the host's OWN goal-round driver run at least two automatic rounds,
  // then pause it so the operator-driven update below is deterministic (the
  // rounds are the product's, not the driver's: each one is a real Host turn).
  const roundsDeadline = Date.now() + 60_000
  let rounds = Number(active.goal?.roundsStarted ?? 0)
  while (rounds < 2 && Date.now() < roundsDeadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(500)
    // eslint-disable-next-line no-await-in-loop
    const current = await goalGet(memberSession)
    rounds = Number(current.goal?.roundsStarted ?? 0)
  }
  const pauseBeforeUpdate = {
    roundsStarted: rounds,
    pause: await goalPause(memberSession),
  }
  writeEvidence(join('flow', 'goal-pause-before-update.json'), pauseBeforeUpdate)
  const beforeUpdate = await goalGet(memberSession)
  const ref = beforeUpdate.goal
  // The Member updates its own Goal (edit) in a second human-operator turn.
  const updatePrompt = [
    `${MK_GOAL_UPDATE} Call update_goal now: goal_id=${ref?.id} revision=${ref?.revision} action=edit`,
    `objective="ship ${MK_GOAL_OBJECTIVE} (revised)". Answer with one short line.`,
  ].join('\n')
  const updated = await sessionPrompt(memberSession, updatePrompt)
  writeEvidence(join('flow', 'goal-update-prompt.json'), updated.body ?? updated)
  const afterUpdate = await waitFor(async () => {
    const current = await goalGet(memberSession)
    return {
      ok: current.goal !== null && Number(current.goal.revision ?? 0) > Number(ref?.revision ?? 0),
      goal: current.goal,
    }
  }, WAIT_MS, 'Goal update (revision advanced)')
  const final = await goalGet(memberSession)
  const goalFacts = {
    created: active.goal,
    beforeUpdate: beforeUpdate.goal,
    afterUpdate: afterUpdate.goal,
    final: final.goal,
    roundsStarted: Number(final.goal?.roundsStarted ?? 0),
    revision: Number(final.goal?.revision ?? 0),
    objective: final.goal?.objective ?? null,
  }
  writeEvidence(join('flow', 'goal.json'), goalFacts)
  SUMMARY.flow.goal = {
    goalId: final.goal?.id ?? null,
    phase: final.goal?.phase ?? null,
    revision: goalFacts.revision,
    roundsStarted: goalFacts.roundsStarted,
    objective: goalFacts.objective,
    updated: goalFacts.revision > Number(active.goal?.revision ?? 0),
  }
  check('GOAL-1', 'the Member created a durable Goal', final.goal?.id !== undefined && final.goal?.id !== null,
    `goalId=${final.goal?.id} phase=${final.goal?.phase}`)
  check('GOAL-2', 'the Goal advanced by its own automatic rounds (>=2)', goalFacts.roundsStarted >= 2,
    `roundsStarted=${goalFacts.roundsStarted}`)
  check('GOAL-3', 'the Member updated the Goal (revision advanced)', goalFacts.revision > Number(active.goal?.revision ?? 0),
    `revision=${active.goal?.revision}->${goalFacts.revision}`)
  return goalFacts
}

/**
 * The Stop arm — the same two-leg chain, but the human allow on the ESCALATED
 * leg is followed immediately by `session/cancel` (the Stop RPC), inside the
 * window before the guard consumes the allow. Decomposed decisive fields:
 *   permission lane: allowed + consumed (by design, before the plane leg);
 *   plane/human leg: decision=allow, NO `control-allow-consumed`, NO
 *   `control-execution-result`, NO side-effect file. Terminal shape is recorded
 *   honestly in both legal shapes (abandoned, or already-decided with the late
 *   allow refused) — the record never claims agreement on the abandonment fact
 *   itself.
 */
async function stepStopArm(worker, priorLegs) {
  const memberSession = worker.childSessionId
  const prompted = await sessionPrompt(memberSession, [
    `${MK_WORK2} Use the bash tool to run exactly: ${CMD_ARM2} ; then answer with the command output.`,
  ].join('\n'))
  writeEvidence(join('flow', 'stop-arm-prompt.json'), prompted.body ?? prompted)

  const seen = [...priorLegs]
  const legPerm = await nextPendingLeg(seen, 'stop-permission')
  const d0 = await readDiscovery(legPerm)
  writeEvidence(join('flow', 'stop-permission-discovery.json'), { leg: legPerm, discovery: d0 })
  check('STOP-1', 'the stop-arm governed ask produced a durable approval leg discoverable over the remote surface',
    d0.requestFactVisible && HUMAN_DECIDABLE_KINDS.has(legPerm.kind),
    `requestId=${legPerm.requestId} kind=${legPerm.kind} reviewAuthority=${legPerm.reviewAuthority} visible=${d0.requestFactVisible} pendingCount=${String(d0.pendingCount)}`)
  const allow1 = await allowLeg(legPerm, `v016 packaged acceptance human allow, stop-arm permission leg (${MK})`)
  writeEvidence(join('flow', 'stop-permission-allow.json'), allow1)
  await waitFor(async () => {
    const facts = legFacts(readLedger(), legPerm.requestId)
    return { ok: facts.decisions.at(-1)?.decision === 'allow' && facts.consumptions.length === 1, facts }
  }, WAIT_MS, 'stop-arm permission leg allow consumed exactly once')
  seen.push(legPerm.requestId)

  // The governed PLANE leg — allow it as the human, then Stop before the
  // consumption write. NOTE (finding F-5): on a SECOND governed ask on the same
  // root the Alpha.6 assignment port refuses the Officer's escalation
  // ("the trusted review-facts port produced no facts for this leg"), so this
  // leg is resolved by the human directly; the Officer hop is demonstrated in
  // the approval arm, and that refusal is recorded, not simulated away.
  const legHuman = await nextPendingLeg(seen, 'stop-plane-leg')
  const d1 = await readDiscovery(legHuman)
  const escalated = readLedger().escalations.some((row) => row.approvalCaseId === legHuman.approvalCaseId)
  writeEvidence(join('flow', 'stop-human-discovery.json'), { leg: legHuman, discovery: d1, escalated })
  const resolved = await remoteCall('team.resolveControl', {
    teamSessionId: ROOT,
    requestId: legHuman.requestId,
    decision: 'allow',
    note: `v016 packaged acceptance human allow BEFORE Stop (${MK})`,
  })
  writeEvidence(join('flow', 'stop-human-allow.json'), resolved.body ?? resolved)
  const cancel = await sessionCancel(memberSession)
  writeEvidence(join('flow', 'stop-cancel.json'), cancel.body ?? cancel)
  const cancelOk = cancel.status === 200 && cancel.body?.result?.ok === true
  check('STOP-2', 'session/cancel (the Stop RPC) is admitted after the human allow on the governed plane leg',
    cancelOk && HUMAN_DECIDABLE_KINDS.has(legHuman.kind),
    `status=${cancel.status} ok=${cancelOk} escalated=${escalated} kind=${legHuman.kind} reviewAuthority=${legHuman.reviewAuthority} body=${JSON.stringify(cancel.body?.result ?? cancel.body ?? cancel).slice(0, 300)}`)

  await sleep(3000)
  const late = await remoteCall('team.resolveControl', {
    teamSessionId: ROOT,
    requestId: legHuman.requestId,
    decision: 'allow',
    note: `v016 packaged acceptance LATE allow after Stop (${MK})`,
  })
  writeEvidence(join('flow', 'stop-late-allow.json'), late.body ?? late)
  await sleep(2000)

  const ledger = readLedger()
  const humanFacts = legFacts(ledger, legHuman.requestId)
  const permFacts = legFacts(ledger, legPerm.requestId)
  const fileExists = existsSync(FILE_ARM2)
  const lateCode = late.body?.result?.error?.code ?? late.body?.error?.code ?? null
  const lateOk = late.body?.result?.ok === true
  const terminalShape = humanFacts.abandonments.length > 0
    ? 'abandoned'
    : (lateOk ? 'late-allow-accepted' : (lateCode === 'CONTROL_REQUEST_DECIDED' ? 'already-decided' : `refused:${String(lateCode)}`))
  const stopFacts = {
    permissionLeg: { requestId: legPerm.requestId, request: legPerm, ...permFacts },
    humanLeg: { requestId: legHuman.requestId, request: legHuman, ...humanFacts },
    cancel: { status: cancel.status, ok: cancelOk, body: cancel.body?.result ?? cancel.body ?? cancel },
    lateAllow: { status: late.status, ok: lateOk, code: lateCode, body: late.body?.result ?? late.body ?? late },
    escalationRecorded: escalated,
    file: FILE_ARM2,
    fileExists,
    terminalShape,
  }
  writeEvidence(join('flow', 'stop.json'), stopFacts)
  SUMMARY.flow.stop = {
    requestId: legHuman.requestId,
    permissionLegId: legPerm.requestId,
    permissionLegConsumptions: permFacts.consumptions.length,
    escalated,
    cancelOk,
    decision: humanFacts.decisions.at(-1)?.decision ?? null,
    deciderKind: humanFacts.decisions.at(-1)?.decider?.kind ?? null,
    consumptions: humanFacts.consumptions.length,
    executions: humanFacts.executions.length,
    abandonments: humanFacts.abandonments.length,
    abandonmentReason: humanFacts.abandonments.at(-1)?.reason ?? null,
    lateAllowOk: lateOk,
    lateAllowCode: lateCode,
    terminalShape,
    fileExists,
  }
  check('STOP-3', 'Stop before consumption: the governed plane leg has NO consumption fact, NO execution and NO side effect',
    humanFacts.consumptions.length === 0 && humanFacts.executions.length === 0 && !fileExists,
    `consumptions=${humanFacts.consumptions.length} executions=${humanFacts.executions.length} fileExists=${fileExists} abandonments=${humanFacts.abandonments.length}`)
  check('STOP-4', 'the stop-arm human leg is terminal (late allow refused, or durably abandoned)',
    !lateOk && (lateCode !== null || humanFacts.abandonments.length > 0),
    `lateAllowOk=${lateOk} code=${String(lateCode)} abandonments=${humanFacts.abandonments.length} shape=${terminalShape}`)
  return stopFacts
}

async function stepGoalPause(worker) {
  const memberSession = worker.childSessionId
  const before = await goalGet(memberSession)
  const pause = await goalPause(memberSession)
  const after = await goalGet(memberSession)
  const facts = {
    before: before.goal,
    pause: { status: pause.status, ok: pause.ok, value: pause.value, error: pause.error },
    after: after.goal,
    note: 'goals/pause is the other half of the Stop button; session/cancel above is the fence arm.',
  }
  writeEvidence(join('flow', 'goal-pause-after-stop.json'), facts)
  SUMMARY.flow.goalPause = {
    ok: pause.ok && after.goal?.phase === 'paused',
    phase: after.goal?.phase ?? null,
    revision: after.goal?.revision ?? null,
    roundsStarted: after.goal?.roundsStarted ?? null,
  }
  check('STOP-5', 'the Goal is durably paused by Stop (no continuation)', after.goal?.phase === 'paused',
    `pauseOk=${pause.ok} phase=${after.goal?.phase} rounds=${after.goal?.roundsStarted}`)
  return facts
}

async function stepCollect(leaderSession, label) {
  const prompted = await sessionPrompt(leaderSession, [
    `${MK_COLLECT} Call team_collect for request token "${WORK_TOKEN}" and reply with the collected body verbatim.`,
  ].join('\n'))
  writeEvidence(join('flow', `${label}-collect-prompt.json`), prompted.body ?? prompted)
  const hit = await waitForMock((request) => lastUserTextOf(request).includes(MK_COLLECT)
    && replyToolNames(request).length === 0, WAIT_MS, `${label} leader collect turn done`)
  // The tool result for team_collect is carried on the NEXT request's history
  // (or the same one for a single-shot); read it from the mock corpus.
  const toolText = textOf(toolMsgsOf(hit).at(-1)?.content ?? '')
  const collectBody = toolText !== '' ? toolText : textOf(hit.reply?.content ?? '')
  const collected = {
    label,
    requestToken: WORK_TOKEN,
    toolResult: collectBody.slice(0, 4000),
    hasWorkerMarker: collectBody.includes(MK_WORK1_DONE),
    hasWorkResult: /memberResult|outcome|succeeded|result/u.test(collectBody),
  }
  writeEvidence(join('flow', `${label}-collect.json`), collected)
  return collected
}

function stepDurableTeamFacts(label) {
  const ledger = readLedger()
  const members = readMemberRows()
  const domain = readDomain()
  const domainBytes = existsSync(join(HOME, 'storages', 'team_domain.json'))
    ? statSync(join(HOME, 'storages', 'team_domain.json')).size : 0
  const snapshot = {
    label,
    ledger: {
      requests: ledger.requests,
      decisions: ledger.decisions,
      consumptions: ledger.consumptions,
      abandonments: ledger.abandonments,
      escalations: ledger.escalations,
      executionResults: ledger.executionResults,
      otherFactTypes: ledger.other.map((row) => row.factType),
    },
    members,
    teamRows: readTeamRows(),
    domainBytes,
    tables: Object.keys(domain?.tables ?? {}),
  }
  writeEvidence(join('ledger', `${label}.json`), snapshot)
  return snapshot
}

async function stepColdRecovery(worker, goalWorker, goalFacts, stopFacts) {
  const memberSession = worker.childSessionId
  const goalSession = goalWorker.childSessionId
  const pre = stepDurableTeamFacts('pre-crash')
  const preProjection = await readProjection()
  const preGoal = await goalGet(goalSession)
  const preCollect = await stepCollect(ROOT, 'pre-crash')
  const preRecords = sessionRecords(memberSession).length
  const preMockRequests = MOCK.requests.length
  const snapshot = {
    members: projectionMembers(preProjection),
    goal: preGoal.goal,
    collect: preCollect,
    records: preRecords,
    mockRequests: preMockRequests,
    ledgerCounts: {
      requests: pre.ledger.requests.length,
      decisions: pre.ledger.decisions.length,
      consumptions: pre.ledger.consumptions.length,
      abandonments: pre.ledger.abandonments.length,
      executions: pre.ledger.executionResults.length,
    },
  }
  writeEvidence(join('flow', 'cold-pre-crash.json'), snapshot)
  // Real SIGKILL, then cold restart against the SAME DSH_HOME.
  stopHost('SIGKILL')
  const exitDeadline = Date.now() + 20_000
  while (HOST.alive() && Date.now() < exitDeadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(100)
  }
  check('CRASH-1', 'the Host was really killed (SIGKILL) before recovery', !HOST.alive(),
    `exited=${!HOST.alive()} code=${HOST.exitInfo.code} signal=${HOST.exitInfo.signal}`)
  writeProfilePatch(blueprint(), 'create-or-open')
  const booted = await bootHost('boot-2-cold')
  HOST = booted.host
  writeEvidence(join('boot', 'boot-2.json'), { ...booted, host: undefined })
  check('CRASH-2', 'the same DSH_HOME boots cold on the same installed artifact', true, `origin=${ORIGIN}`)
  const post = stepDurableTeamFacts('post-restart')
  const projection = await readProjection()
  const members = projectionMembers(projection)
  const workerAfter = members.find((m) => m.templateId === 'worker')
  // `goals/get` is an AGENT-scoped RPC: after a cold boot the Member's session
  // is durable but not materialized. One ordinary operator message (a real turn,
  // no marker) materializes it; a PAUSED goal then reports its persisted state.
  const goalProbe = await sessionPrompt(goalSession, ['V016 packaged acceptance cold-recovery probe: report status in one short line.'])
  writeEvidence(join('flow', 'cold-goal-probe.json'), goalProbe.body ?? goalProbe)
  let goalAfter = await goalGet(goalSession)
  const goalDeadline = Date.now() + 10_000
  while (goalAfter.goal === null && Date.now() < goalDeadline) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(500)
    // eslint-disable-next-line no-await-in-loop
    goalAfter = await goalGet(goalSession)
  }
  const durableGoal = durableGoalState(goalSession)
  writeEvidence(join('flow', 'cold-goal-durable.json'), { rpc: goalAfter.goal, durable: durableGoal })
  const collectAfter = await stepCollect(ROOT, 'post-restart')
  // Deltas over a quiet window: no resurrected turn, no new durable writes.
  const recordsStart = sessionRecords(memberSession).length
  const mockStart = MOCK.requests.length
  await sleep(20_000)
  const recordsEnd = sessionRecords(memberSession).length
  const mockEnd = MOCK.requests.length
  // Per-leg survival: the exact four durable legs this run created, compared
  // against the consumption counts observed BEFORE the cold restart.
  const approvalFacts = SUMMARY.flow.approval
  const expectedLegs = [
    { leg: 'approval-permission', requestId: approvalFacts.permissionLegId, expectedConsumptions: approvalFacts.permissionLegConsumptions },
    { leg: 'approval-human', requestId: approvalFacts.humanLegId, expectedConsumptions: approvalFacts.humanLegConsumptions },
    { leg: 'stop-permission', requestId: stopFacts.permissionLeg.requestId, expectedConsumptions: SUMMARY.flow.stop.permissionLegConsumptions },
    { leg: 'stop-human', requestId: stopFacts.humanLeg.requestId, expectedConsumptions: 0 },
  ]
  const approvalConsumptions = expectedLegs.map((entry) => ({
    leg: entry.leg,
    requestId: entry.requestId,
    expectedConsumptions: entry.expectedConsumptions,
    consumptions: post.ledger.consumptions.filter((row) => row.requestId === entry.requestId).length,
    abandonments: post.ledger.abandonments.filter((row) => row.requestId === entry.requestId).length,
    abandonedReason: post.ledger.abandonments.find((row) => row.requestId === entry.requestId)?.reason ?? null,
  }))
  const recovery = {
    teamPresent: post.teamRows.length > 0,
    memberPresent: workerAfter !== undefined,
    memberLifecycle: workerAfter?.lifecycle ?? null,
    goalBefore: goalFacts.final,
    goalAfterRestart: durableGoal.goal ?? goalAfter.goal,
    goalDurableRecords: durableGoal,
    goalPhaseSurvived: (durableGoal.goal ?? goalAfter.goal)?.phase === goalFacts.final?.phase,
    goalRevisionSurvived: Number((durableGoal.goal ?? goalAfter.goal)?.revision ?? -1) === Number(goalFacts.final?.revision ?? -2),
    goalRoundsSurvived: Number(durableGoal.roundsStarted ?? -1) === Number(goalFacts.final?.roundsStarted ?? -2),
    consumptionFacts: approvalConsumptions,
    legsAgree: approvalConsumptions.every((row) => row.consumptions === row.expectedConsumptions),
    collectOk: collectAfter.hasWorkerMarker,
    collectBody: collectAfter.toolResult,
    recordsStart,
    recordsEnd,
    mockStart,
    mockEnd,
    resurrection: { recordsDelta: recordsEnd - recordsStart, mockRequestsDelta: mockEnd - mockStart },
    ledgerCountsBefore: snapshot.ledgerCounts,
    ledgerCountsAfter: {
      requests: post.ledger.requests.length,
      decisions: post.ledger.decisions.length,
      consumptions: post.ledger.consumptions.length,
      abandonments: post.ledger.abandonments.length,
      executions: post.ledger.executionResults.length,
    },
  }
  writeEvidence(join('flow', 'cold-recovery.json'), recovery)
  SUMMARY.flow.coldRecovery = recovery
  check('REC-1', 'the Team and the Member survived cold recovery durably',
    recovery.teamPresent && recovery.memberPresent,
    `team=${recovery.teamPresent} member=${recovery.memberPresent} lifecycle=${String(recovery.memberLifecycle)}`)
  check('REC-2', 'the Goal survived (phase/revision/rounds unchanged)',
    recovery.goalPhaseSurvived && recovery.goalRevisionSurvived && recovery.goalRoundsSurvived,
    `phase=${String(recovery.goalAfterRestart?.phase)} revision=${String(recovery.goalAfterRestart?.revision)} rounds=${String(recovery.goalDurableRecords?.roundsStarted)} durableRecords=${String(recovery.goalDurableRecords?.changes)}`)
  check('REC-3', 'the collected Member result is retrievable after restart (same marker)',
    recovery.collectOk, `body=${JSON.stringify(recovery.collectBody.slice(0, 300))}`)
  check('REC-4', 'the per-leg consumption facts survived the cold restart exactly (approval 1+1, stop 1+0)',
    recovery.legsAgree,
    `legs=${JSON.stringify(approvalConsumptions.map((row) => [row.leg, row.consumptions, row.expectedConsumptions]))}`)
  check('REC-5', 'the collected Member was not resurrected into a running turn after restart',
    recovery.resurrection.recordsDelta === 0 && recovery.resurrection.mockRequestsDelta === 0
      && recovery.memberLifecycle !== 'RUNNING',
    `recordsDelta=${recovery.resurrection.recordsDelta} mockRequestsDelta=${recovery.resurrection.mockRequestsDelta} lifecycle=${String(recovery.memberLifecycle)}`)
  return recovery
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  log(`v016 packaged acceptance — run ${RUN} — stamp ${STAMP}`)
  log(`repo=${REPO}`)
  log(`testuse=${TESTUSE}`)
  log(`evidence=${RUN_DIR}`)
  log(`world=${HOME}`)
  check('ENV-1', 'the pristine host build entry exists', existsSync(HOST_BIN), HOST_BIN)

  await stepIdentity()
  stepPack()
  const tarball = SUMMARY.tarball.path
  stepInstall(tarball)
  await stepBoot()

  const team = await stepTeamAndMember()
  const approval = await stepApproval()
  await waitForApprovalArmDone(team.worker)
  const goalFacts = await stepGoal(team.goalWorker)
  const stopFacts = await stepStopArm(team.worker, [approval.permissionLegId, approval.humanLegId])
  await stepGoalPause(team.goalWorker)
  const collected = await stepCollect(ROOT, 'pre-crash-independent')
  check('COLL-1', 'the Leader collected the Member: the durable result is retrievable and carries the Member marker',
    collected.hasWorkerMarker, `body=${JSON.stringify(collected.toolResult.slice(0, 300))}`)
  SUMMARY.flow.collect = collected
  await stepColdRecovery(team.worker, team.goalWorker, goalFacts, stopFacts)

  // Teardown (identity-based): stop the Host, close the mock, delete the World
  // unless --keep. :3080 was never contacted.
  stopHost('SIGTERM')
  await sleep(1500)
  await MOCK.close?.()
  writeEvidence(join('boot', 'mock-requests.json'), mockRequestsSummary())
  const finalHostPorcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout ?? ''
  SUMMARY.host = {
    pin: TEST_USE_BASELINE_SHA, version: DSH_BASELINE_VERSION,
    porcelainBefore: SUMMARY.identity.hostPorcelain, porcelainAfter: finalHostPorcelain,
    cleanAfter: finalHostPorcelain.trim() === '',
  }
  check('HYG-1', 'the pristine host checkout stayed byte-clean', finalHostPorcelain.trim() === '',
    `porcelain=${JSON.stringify(finalHostPorcelain.trim())}`)
  if (!FLAG_KEEP) {
    rmSync(HOME, { recursive: true, force: true })
    log(`teardown: world removed (${HOME})`)
    SUMMARY.teardown = { kept: false, world: HOME }
  } else {
    log(`teardown: world KEPT at ${HOME} (--keep)`)
    SUMMARY.teardown = { kept: true, world: HOME }
  }
  const failed = CHECKS.filter((row) => !row.ok)
  finish(failed.length === 0 ? 0 : 2)
}

main().catch((error) => {
  log(`FATAL ${String(error?.stack ?? error)}`)
  try { stopHost('SIGKILL') } catch { /* gone */ }
  try { MOCK?.close?.() } catch { /* closed */ }
  writeEvidence(join('boot', 'mock-requests.json'), mockRequestsSummary())
  finish(1)
})
