#!/usr/bin/env node
/**
 * team-view-sync-complete-e2e.mjs — the REAL-SPILL E2E kit for
 * team-view-sync-complete phase 2 (frozen decision 8, 2026-09-28):
 *
 *   the final E2E must exercise the REAL spill writer path end to end:
 *     real tool/shell spill  ->  durable artifact-read-granted
 *     ->  team.getReadState reports the durable generation advance
 *     ->  team.getProjection (v6) serves a readable frame carrying the
 *         (durableGeneration, liveToken) pair
 *     ->  the RAW LEDGER keeps the grant (locator + digests present)
 *     ->  the PROJECTION / Team-Events surface does NOT expose the
 *         grant fact (closed fact table: locator/digest hidden).
 *
 * HOW (all through public seams, CORE PATCH BUDGET = 0):
 *   - host = pristine test-use DSH 0.1.7-rc.1
 *     (tests/deepseek-harness-test-use @ 46a7f68b09) launched as
 *     `node apps/cli/lib/bin.js web --port <port> --no-open`.
 *   - DSH_HOME = a world SEEDED from the retained mpr smoke world
 *     tests/homes/mpr-2026-09-27T08-35-52 (proven multi-root boot: the
 *     boot anchor + T1 with four SETTLED members) — copied to a fresh
 *     ephemeral home; the row patch is rewritten to mount the TASK
 *     WORKTREE dist (file:// rows, the mpr-kit install mode — no clone,
 *     no registry).
 *   - the SPILL TEAM is created fresh IN this world through the public
 *     remote channel: `team.create` (contract v1) with `initialWork` —
 *     the Root initial-work vertical (TCM §15.7/§15.8) that admits and
 *     delivers ONE creation-time work unit into the NEW ROOT (Leader)
 *     session. WHY the Leader (and not a member): the A2C-1 shell
 *     contract rejects a positive whole-tool `bash` allow for MEMBER
 *     templates; the LEADER allow-lane whole-tool 'any' rule is the
 *     exec-autonomy-contract exception, valid at runtime only under the
 *     mutation-envelope dual gate (the blueprint carries
 *     teamEnvelope.allow: [bash] + a leader permissions block with the
 *     allow-lane bash rule). No mpr-world template carries any
 *     `capabilities.permissions`, so no mpr agent could ever mint a
 *     grant (the observer installs only alongside a permissions policy —
 *     a policy-free agent's grants would be inert dead facts). The new
 *     blueprint (written into the seeded world's blueprintDir, a
 *     fixture — not plugin code) is the only way to get a grant-
 *     eligible agent in this world.
 *   - mock model (packages/tools/harness/mock-deepseek.mjs @ 3496/3497):
 *     marker-driven decide — the work turn carrying the SPILL marker
 *     and no tool result yet gets the ONE tool call `bash` — the
 *     REGISTERED tool name (`defineTool({name: 'bash'})` upstream; the
 *     plugin row is `tool-bash`, but the model-facing surface registers
 *     `bash`) — ({command}) whose stdout is 300KB (far over the executor's
 *     maxOutputBytes default of 64KB) — that overflow is the REAL
 *     in-memory-cap spill (canonical success value carries
 *     stdout.spillPath); the agent-scoped tools/result observer
 *     (shell-result-observer, installed by the live glue alongside the
 *     permission listener) records the durable shell-foreground
 *     artifact grant through the authority; the follow-up turn (tool
 *     result present — the pinned upstream speaks the Anthropic
 *     /v1/messages wire, so a tool result is a `tool_result` block in a
 *     user message, NOT a role:'tool' message) gets short text.
 *   - the spill turn is driven by `team.create`'s `initialWork`
 *     (contract v1) — a direct /api/session/prompt on a Team-managed
 *     session is intercepted by the activation fence, and the Root
 *     initial-work path is the fence-legitimate external drive of the
 *     Leader's own work unit (never the generic Member follow-up on
 *     inst-leader).
 *
 * CRITERIA (exit 0 only if ALL pass):
 *   C0 — preflight: test-use HEAD/porcelain, worktree branch+dist entry,
 *        glue/seam presence, :3080/:3180 probe (never bound), ports free.
 *   C1 — baseline (pre-spill): the SEED team T1 is intact —
 *        team.getReadState(T1 member) v6 = team-member + disposed:false
 *        + durableGeneration = G0 (32) + liveToken 'lt-v1-*' (PR #35
 *        follow-up, P0-2: the closed value carries the token);
 *        team.getProjection(T1) v6 readable with the pair (G0, LT0);
 *        team.getLedgerPage(T1) = L0 entries, NO artifact-read-granted;
 *        AND the not-yet-created T2 root answers team.getReadState v6 =
 *        'none' with null cells INCLUDING liveToken null (frozen
 *        decision 1: 'none' only on positively confirmed no-affiliation;
 *        P0-2: none → null, never a token).
 *   C2 — the real spill: team.create v1 {rootSessionId: T2,
 *        blueprintId, initialWork: {prompt}} returns ok (fresh-root);
 *        the mock records the marker work turn with the `bash`
 *        call AND the tool result; the durable artifact-read-granted
 *        fact lands in the T2 ledger within the budget (that IS the
 *        real spill writer path: executor spill -> observer ->
 *        authority -> durable fact); team.listRoots (v3) then carries
 *        T2.
 *   C3 — read-state detects the generation: fresh
 *        team.getReadState(T2) v6 = team-root + disposed:false +
 *        memberInstanceId:null + durableGeneration G1 that AGREES with
 *        the T2 ledger stamp INCLUDING the grant + a non-empty
 *        'lt-v1-*' liveToken (P0-2: the host can compute the token
 *        through the public seam — a host that could not would fail
 *        typed, never serve a tokenless team relation) : S1-A hook A
 *        (every NEW durable entry advances the owning root's stamp +1;
 *        row bootstrap = 1; the create path advances once at creation)
 *        gives G1 = 2 + entryCount(T2). The Root initial-work vertical
 *        (TCM §15.7/§15.8) is synchronous — team.create v1 returns AFTER
 *        the terminal delivered fact, so the mid-turn grant is already
 *        inside G1 (a grant that did not advance the stamp would read
 *        4 ≠ 5). C1 pins the invariant on the T1 baseline (32 = 2 + 30).
 *   C4 — projection readable: team.getProjection(T2) v6 = ok frame, the
 *        nine frozen v1 cells + durableGeneration === G1 + liveToken
 *        present AND IDENTICAL to the read-state liveToken (P0-2: ONE
 *        authority for the freshness pair — the host computes the token
 *        once; both endpoints expose the same value); provenance (at
 *        value.provenance) contractVersion 6 + projectionGeneration G1.
 *   C5 — the RAW LEDGER keeps the grant: team.getLedgerPage(T2) carries
 *        an artifact-read-granted entry with instanceId 'inst-leader'
 *        + locator (the spill file exists on disk, size > 64KB) +
 *        source {kind: 'shell-foreground', toolName: 'bash'} +
 *        the digests.
 *   C5 — the PROJECTION surface HIDES it: the v6 projection JSON
 *        contains neither the locator nor the digests nor the fact type
 *        (closed fact table — the client Team-Events skip is spec-
 *        covered separately; here the API-level closed table is the
 *        assertion). C6 is C5-dependent by construction (hiding is
 *        only verifiable with a grant present).
 *   C7 — post-teardown: :3080/:3180 probe unchanged; test-use porcelain
 *        still empty; host+mock ports released; world retained (path in
 *        the summary).
 *
 * PORTS: host = first free of 3181..3186 (the 3180 family); mock =
 *   3496 (fallback 3497). :3080/:3180 are NEVER bound — read-only
 *   probes pre and post (recorded in the summary).
 *
 * EVIDENCE: dev/agent-workflow/evidence/team-view-sync-complete/
 *   wp8-spill-e2e-<stamp>/ (summary.json + host log token-scrubbed +
 *   FULL mock request log + api-transcript.json + create response).
 *   The launch token is scrubbed from every retained artifact.
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed (evidence dump);
 *   1 = fatal (environment / boot / row).
 */

import { spawn, spawnSync } from 'node:child_process'
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync,
  readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
// The gitignored test-use checkout exists only in the MAIN checkout, not
// in task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}
const MAIN = resolve(WORKTREE, '..', '..') // <main>/.worktrees/<task> -> <main>
import { TEST_USE_BASELINE_SHA } from '../../../tests/paths.mjs'  // canonical test-infrastructure pin (docs/TEST_METHODS.md §1)
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // canonical pin = tests/paths.mjs (moves with the pinned host generation)
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const SRC_WORLD = join(MAIN, 'tests', 'homes', 'mpr-2026-09-27T08-35-52')
const HOST_PORT_MIN = 3181
const HOST_PORT_MAX = 3186
const MOCK_PORTS = [3496, 3497]
const STABLE_PROBES = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']
const RUN_STAMP = `tvs-spill-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
const WORLD = join(MAIN, 'tests', 'homes', RUN_STAMP)
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'team-view-sync-complete', `wp8-spill-e2e-${RUN_STAMP}`)
const INSTANCE_LOG = join(EVIDENCE_DIR, 'instance.log')
const MOCK_LOG = join(EVIDENCE_DIR, 'mock.log')

// The seeded world's fixed durable facts (verified at preflight against
// the COPY — never trusted from memory):
const T1 = 'session-mpr-t1-mpr-2026-09-27T08-35-52'
const T1_MEMBER_SESSION = 'session-team-child-796562d4284593654607730948ad2b04'
const T1_MEMBER_INSTANCE = 'inst-17legoh0ti27'

// The fresh SPILL team (created through the public remote channel):
const T2 = `session-tvs-spill-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`
const BLUEPRINT_ID = 'team.tvs-spill'
const LEADER_INSTANCE_ID = 'inst-leader' // packages/contracts LEADER_INSTANCE_ID
const NONCE = RUN_STAMP
const MK_SPILL = `tvs_spill_${RUN_STAMP}`
const SPILL_COMMAND = "head -c 300000 /dev/zero | tr '\\0' 'x'" // 300KB stdout > 64KB cap -> real spill
const SPILL_PROMPT =
  `${MK_SPILL} — run exactly one bash command for me: ${SPILL_COMMAND} — then tell me the approximate output size.`

/**
 * The spill-team blueprint (a FIXTURE written into the seeded world's
 * blueprintDir — not plugin code). Leader-only: the A2C-1 shell contract
 * rejects a positive whole-tool `bash` allow for MEMBER templates; the
 * leader allow-lane whole-tool 'any' rule is the exec-autonomy-contract
 * exception (user ruling 2026-09-18), runtime-valid only under the
 * mutation-envelope dual gate — satisfied here by teamEnvelope.allow
 * carrying the 'bash' exec token (leaderExecEnvelopeOps: no
 * memberEnvelopes entry -> the effective set is the teamEnvelope allow
 * minus deny). The `permissions` block is what makes the agent
 * grant-eligible at all (the live glue installs the tools/result
 * observer ONLY alongside a permissions policy; a policy-free agent
 * would only mint inert dead facts). `builtinToolDeny` carries the
 * 19 production-host built-ins the A2C-2 Permission Coverage Gate
 * names as ownerless (the gate passes only a surface where every tool
 * has an authority owner; the E2E surface is deliberately narrow:
 * `bash` (the registered shell tool) + the team tools).
 */
const TVS_BLUEPRINT_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BLUEPRINT_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the real-spill e2e team (team-view-sync-complete, frozen decision 8)."',
  '  modelPreference: "deepseek-official/role-leader"',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  '        - team_list_members',
  '        - team_list_templates',
  '        - team_inspect_config',
  '        - team_create_member',
  '        - team_delegate',
  '        - team_follow_up',
  '        - team_send_message',
  '        - team_report_progress',
  '        - team_request_control',
  '        - team_resolve_control',
  '        - team_list_pending_control',
  '        - team_collect',
  '        - team_archive_member',
  // The Permission Coverage Gate (A2C-2): a permissions-carrying agent's
  // FINAL model-facing surface must give EVERY tool an authority owner
  // (managed vocabulary / selected team tools / proven MCP delta / the
  // closed SAFE_UNMANAGED registry). The production host's built-in
  // surface carries 19 tools that own no owner under this world's row
  // (7 unknown-unmanaged + 12 known-sensitive-unmanaged, enumerated by
  // the gate itself in run 8); `builtinToolDeny` (free-form tool names,
  // applied to the surface before the gate) removes exactly those 19 —
  // the E2E needs only `bash` (the registered shell tool) plus the team
  // tools, so a narrow explicit surface is the fixture answer (not a
  // plugin change — the gate failing on an unowned tool is by design).
  '    builtinToolDeny:',
  '      - ask_user_question',
  '      - create_goal',
  '      - exit_plan_mode',
  '      - get_goal',
  '      - glob',
  '      - grep',
  '      - interrupt_agent',
  '      - job_kill',
  '      - job_list',
  '      - job_output',
  '      - list_agents',
  '      - present',
  '      - send_message',
  '      - skill',
  '      - subagent_fork',
  '      - update_goal',
  '      - web_fetch',
  '      - web_search',
  '      - workflow',
  '    skills:',
  '      kind: allow',
  '      items: []',
  '    mcp:',
  '      kind: allow',
  '      items: []',
  '    permissions:',
  '      default: ask',
  '      allow:',
  '        - tool: bash',
  '          resource:',
  '            kind: any',
  '      ask: []',
  '      deny: []',
  'members: []',
  'requirements: []',
  'teamEnvelope:',
  '  allow:',
  '    - bash',
  '  deny: []',
  'memberEnvelopes: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

const BOOT_TIMEOUT_MS = 300_000
const SETTLE_TIMEOUT_MS = 120_000

const criteria = ['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7'].map((id) => ({ id, pass: false, detail: 'pending' }))
function mark(id, pass, detail) {
  const c = criteria.find((x) => x.id === id)
  if (c) {
    c.pass = pass === true
    c.detail = String(detail).slice(0, 2000)
  }
  log(`${pass ? 'PASS' : 'FAIL'} ${id} — ${String(detail).slice(0, 200)}`)
}

const log = (msg) => {
  const line = `[${new Date().toISOString()}] ${msg}`
  process.stdout.write(`${line}\n`)
}

function writeEvidence(name, content) {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  if (typeof content === 'string') writeFileSync(join(EVIDENCE_DIR, name), content)
  else writeFileSync(join(EVIDENCE_DIR, name), JSON.stringify(content, null, 2))
}

function scrub(text) {
  // The launch token (and any cookie derivative) never enters evidence.
  return String(text).replace(/token=[A-Za-z0-9_-]{8,}/g, 'token=SCRUBBED').replace(/set-cookie:[^\n]{0,200}/gi, 'set-cookie: SCRUBBED')
}

function dieFatal(msg, exitCode = 1) {
  log(`FATAL ${msg}`)
  try { writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: msg, criteria, world: WORLD, evidence: EVIDENCE_DIR }) } catch { /* best effort */ }
  process.exit(exitCode)
}

// ── small helpers ───────────────────────────────────────────────────────────

function isPortFree(port) {
  return new Promise((res) => {
    const srv = net.createServer()
    srv.once('error', () => res(false))
    srv.listen({ port, host: '127.0.0.1' }, () => {
      srv.close(() => res(true))
    })
  })
}

async function probe(url, timeoutMs = 5_000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
    return res.status
  } catch {
    return 'unreachable'
  }
}

async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body, error: res.status === 0 ? res.error : undefined }
}

function logTail(logPath, n = 40) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '(no log)'
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function waitForLogLine(logPath, predicate, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let last = -1
  return new Promise((resolvePromise) => {
    const timer = setInterval(() => {
      if (!alive()) {
        clearInterval(timer)
        resolvePromise(null)
        return
      }
      try {
        const content = readFileSync(logPath, 'utf8')
        if (content.length !== last) {
          last = content.length
          const lines = content.split('\n')
          for (let i = lines.length - 1; i >= 0; i -= 1) {
            if (predicate(lines[i])) {
              clearInterval(timer)
              resolvePromise(lines[i])
              return
            }
          }
        }
      } catch { /* not yet */ }
      if (Date.now() > deadline) {
        clearInterval(timer)
        resolvePromise(null)
      }
    }, 250)
  })
}

function gitIn(cwd, argv) {
  const r = spawnSync('git', argv, { cwd, encoding: 'utf8' })
  return { status: r.status, out: (r.stdout ?? '').trim() }
}

// ── mock helpers (mpr-kit shape) ────────────────────────────────────────────

function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}
function msgTexts(m) {
  const c = m?.content
  if (typeof c === 'string') return [c]
  if (Array.isArray(c)) return c.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text)
  return []
}
function lastUserText(body) {
  const msgs = body?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const texts = msgTexts(m)
    if (texts.length > 0) return texts.join('\n')
  }
  return ''
}
function anyText(body) {
  const msgs = body?.messages ?? []
  return msgs.map((m) => msgTexts(m).join('\n')).join('\n')
}
function firstText(body) {
  const msgs = body?.messages ?? []
  for (const m of msgs) {
    const texts = msgTexts(m)
    if (texts.length > 0) return texts.join('\n')
  }
  return ''
}
function isTitleSideCall(record) {
  // 0.1.7 title side-call prompt (session-title-llm): it carries the
  // session's messages (including our marker) in its prompt JSON, so
  // marker-based work-turn lookups MUST exclude it.
  return /generate the session title|concise title/i.test(firstText(bodyOf(record)))
}
function hasToolResult(body) {
  // The pinned upstream speaks the Anthropic /v1/messages wire: a tool
  // result is a `tool_result` block inside a USER message. (The OpenAI
  // role:'tool' shape is kept as a fallback for other deployments.)
  const msgs = body?.messages ?? []
  return msgs.some(
    (m) => m?.role === 'tool'
      || (Array.isArray(m?.content) && m.content.some((b) => b && b.type === 'tool_result')),
  )
}
function toolResultSpillPaths(body) {
  // Evidence helper: the stdout spill path(s) advertised by the tool
  // result content of this request (the model-visible canonical value
  // rides the tool_result content text; the structured locator is not on
  // the wire — the observer reads it from the structured value instead).
  const found = []
  for (const m of body?.messages ?? []) {
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b && b.type === 'tool_result' && typeof b.content === 'string') {
        for (const mm of b.content.matchAll(/full output: (\S+)/g)) found.push(mm[1])
      }
    }
  }
  return found
}

// ── the world row patch (rewritten for THIS worktree) ───────────────────────

/**
 * Retarget the seeded world's profile patch to this worktree WITHOUT
 * changing its row set: the mpr world runs TWO rows — the production
 * `dsh-agent-team` row and the `p6t6-team-tools` harness row (kept for
 * world fidelity; this run drives everything through the public
 * /team-remote channel). Only the file:// row-URL worktree prefix and
 * the blueprintDir path move; everything else stays byte-for-byte the
 * mpr original (the proven boot config).
 */
function rewriteWorldProfile() {
  const p = join(WORLD, 'profiles', 'web', 'cordis.patch.yml')
  let s = readFileSync(p, 'utf8')
  for (const u of [...new Set([...s.matchAll(/file:\/\/\/[^\s"]+/g)].map((m) => m[0]))]) {
    const abs = u.replace(/^file:\/\//, '')
    const idx = abs.indexOf('/packages/')
    if (idx === -1) continue
    const oldRoot = abs.slice(0, idx)
    s = s.split(`${oldRoot}/packages/`).join(`${WORKTREE}/packages/`)
  }
  s = s.split(`${SRC_WORLD}/blueprints`).join(`${WORLD}/blueprints`)
  writeFileSync(p, s)
  const check = readFileSync(p, 'utf8')
  if (check.includes('async-default-contract')) throw new Error('profile rewrite left a stale worktree URL')
  if (!check.includes('p6t6-team-tools')) throw new Error('profile rewrite dropped the p6t6 harness row')
  if (!check.includes(`${WORLD}/blueprints`)) throw new Error('profile rewrite missed the blueprintDir retarget')
}

/** Write the spill-team blueprint into the seeded world's blueprintDir. */
function writeSpillBlueprint() {
  writeFileSync(join(WORLD, 'blueprints', 'tvs-spill.yaml'), TVS_BLUEPRINT_YAML)
}

// ── host lifecycle ──────────────────────────────────────────────────────────

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        cwd: home,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: HOST_BASELINE_SHA,
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'tvs-spill-smoke-key',
        },
      },
    )
  } catch (error) {
    closeSync(outFd)
    closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => {
    exitInfo.exited = true
    exitInfo.signal = 'spawn-error'
    exitInfo.message = error.message
  })
  child.on('close', (code, signal) => {
    exitInfo.exited = true
    exitInfo.code = code
    exitInfo.signal = signal
  })
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}

function stopHost(h) {
  try { h.child.kill() } catch { /* already gone */ }
  return h
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

/** One /team-remote call (the public browser channel): POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, version, timeoutMs = 120_000) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `tvs-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
}

// ── durable world facts (read from the SEED copy at preflight) ──────────────

function readWorldFacts(world) {
  const raw = JSON.parse(readFileSync(join(world, 'storages', 'team_domain.json'), 'utf8'))
  const t = raw.tables
  const teamRow = JSON.parse(t.team_sessions[T1])
  const counter = JSON.parse(t.ledger['__ledger_sequence_counter'])
  // member_instances rows are keyed by the composite PK
  // {instanceId, rootSessionId} (JSON string) — scan for ours.
  const memberKey = Object.keys(t.member_instances).find(
    (k) => k.includes(`"instanceId":"${T1_MEMBER_INSTANCE}"`) && k.includes(`"rootSessionId":"${T1}"`),
  )
  if (memberKey === undefined) throw new Error(`member ${T1_MEMBER_INSTANCE} row not found under T1`)
  const member = JSON.parse(t.member_instances[memberKey])
  if (member.rootSessionId !== T1) throw new Error(`member ${T1_MEMBER_INSTANCE} is not a child of T1`)
  const binding = JSON.parse(t.session_bindings[T1_MEMBER_SESSION])
  if (binding.kind !== 'team-member' || binding.instanceId !== T1_MEMBER_INSTANCE) {
    throw new Error(`member binding row does not match (kind=${binding.kind})`)
  }
  if (member.lifecycle !== 'SETTLED') throw new Error(`member lifecycle is ${member.lifecycle} (expected SETTLED)`)
  return {
    teamGeneration: teamRow.generation,
    ledgerCounter: counter.value,
    memberLifecycle: member.lifecycle,
    memberChildSession: member.childSessionId,
  }
}

// ── main ────────────────────────────────────────────────────────────────────

const apiTranscript = []
function safeJson(v) {
  try {
    const t = JSON.stringify(v === undefined ? { __undefined: true } : v)
    return t === undefined ? JSON.stringify({ __unstringifiable: true }) : t
  } catch (e) {
    return `unstringifiable: ${e.message}`
  }
}

async function recordApi(label, call) {
  const body = call.result.body
  const outcome = body?.result?.ok === true
    ? 'ok'
    : `not-ok ${safeJson(body?.result?.error ?? body ?? { __no_body: true, status: call.result.status, transportError: call.result.error ?? null }).slice(0, 200)}`
  apiTranscript.push({
    label,
    method: call.method,
    params: call.params,
    version: call.version,
    status: call.result.status,
    transportError: call.result.error ?? null,
    result: body,
  })
  log(`api ${label}: ${call.method} -> ${call.result.status} ${outcome}`)
}

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  log(`kit: team-view-sync-complete real-spill E2E (frozen decision 8)`)
  log(`worktree=${WORKTREE} testuse=${TESTUSE}`)
  log(`world=${WORLD} (seed from ${SRC_WORLD})`)

  // ── C0 — preflight ─────────────────────────────────────────────────────────
  const head = gitIn(TESTUSE, ['rev-parse', 'HEAD'])
  const porcelain = gitIn(TESTUSE, ['status', '--porcelain'])
  const wtBranch = gitIn(WORKTREE, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const wtHead = gitIn(WORKTREE, ['rev-parse', 'HEAD'])
  // PR #35 third follow-up P1 (guide §14): the E2E must be bound to a
  // CLEAN final commit, not to a branch + dirty working tree — the
  // worktree porcelain is a HARD gate (an uncommitted working tree
  // cannot prove an immutable commit passed this E2E).
  const wtPorcelain = gitIn(WORKTREE, ['status', '--porcelain'])
  const distOk = existsSync(PRODUCTION_ROW_PATH) && existsSync(GLUE_PATH) && existsSync(SEAM_PATH) && existsSync(P6T6_ROW_PATH)
  const stablePre = {}
  for (const u of STABLE_PROBES) stablePre[u] = await probe(u)
  let hostPort = null
  for (let p = HOST_PORT_MIN; p <= HOST_PORT_MAX; p += 1) {
    if (await isPortFree(p)) { hostPort = p; break }
  }
  let mockPort = null
  for (const p of MOCK_PORTS) {
    if (await isPortFree(p)) { mockPort = p; break }
  }
  const srcOk = existsSync(join(SRC_WORLD, 'storages', 'team_domain.json'))
  const c0 = head.status === 0 && head.out === HOST_BASELINE_SHA
    && porcelain.status === 0 && porcelain.out === ''
    && wtBranch.status === 0 && wtBranch.out === 'fix/team-view-sync-complete-20260927'
    && wtHead.status === 0
    && wtPorcelain.status === 0 && wtPorcelain.out === ''
    && distOk && srcOk && hostPort !== null && mockPort !== null
  mark('C0', c0, `testuse HEAD=${head.out} porcelain='${porcelain.out.slice(0, 80)}' wt=${wtBranch.out}@${wtHead.out.slice(0, 8)} wtPorcelain='${wtPorcelain.out.slice(0, 80)}' dist=${distOk} hostPort=${hostPort} mockPort=${mockPort} stable=${JSON.stringify(stablePre)}`)
  if (!c0) dieFatal('preflight failed')
  writeEvidence('preflight.json', { head: head.out, wtBranch: wtBranch.out, wtHead: wtHead.out, worktreePorcelain: wtPorcelain.out, hostPort, mockPort, stablePre })

  // ── seed the world ─────────────────────────────────────────────────────────
  log(`seeding world ${WORLD} from ${SRC_WORLD}`)
  rmSync(WORLD, { recursive: true, force: true })
  const cp = spawnSync('cp', ['-r', SRC_WORLD, WORLD], { encoding: 'utf8' })
  if (cp.status !== 0) dieFatal(`world seed failed: ${cp.stderr}`)
  // Stale session locks from the retained world must not block re-open.
  const sessionsRoot = join(WORLD, 'sessions')
  for (const top of readdirSync(sessionsRoot)) {
    const dir = join(sessionsRoot, top)
    if (!statSync(dir).isDirectory()) continue
    for (const entry of readdirSync(dir)) {
      const p = join(dir, entry)
      if (statSync(p).isDirectory() && existsSync(join(p, 'session.lock'))) {
        rmSync(join(p, 'session.lock'))
        log(`removed stale session.lock: ${join(entry, 'session.lock')}`)
      }
    }
  }
  rewriteWorldProfile()
  writeSpillBlueprint()
  log('world seeded (row patch retargeted to this worktree, both rows kept, spill blueprint written; stale locks cleared)')

  const facts = readWorldFacts(WORLD)
  log(`world facts: T1 generation=${facts.teamGeneration} ledgerCounter=${facts.ledgerCounter} member=${T1_MEMBER_INSTANCE} (${facts.memberLifecycle}) child=${facts.memberChildSession}`)

  // ── mock model ─────────────────────────────────────────────────────────────
  let MOCK = null
  let toolCallSeq = 0
  try {
    MOCK = await startMockModel({
      port: mockPort,
      decide: ({ req }) => {
        const body = bodyOf(req)
        if (isTitleSideCall(req)) return { kind: 'text', content: `tvs-title-${NONCE}` }
        const lastUser = lastUserText(body)
        if (lastUser.includes(MK_SPILL)) {
          if (!hasToolResult(body)) {
            toolCallSeq += 1
            return {
              kind: 'tool-call',
              toolCalls: [{
                id: `call-tvs-spill-${toolCallSeq}`,
                name: 'bash',
                arguments: JSON.stringify({
                  command: SPILL_COMMAND,
                  description: 'tvs-spill probe: 300KB output (real spill E2E, frozen decision 8)',
                }),
              }],
            }
          }
          return { kind: 'text', content: `done ${NONCE}: the command printed roughly 300KB of x.` }
        }
        return { kind: 'text', content: `ack ${NONCE}` }
      },
      log: (msg) => { try { writeFileSync(MOCK_LOG, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
    })
  } catch (e) {
    dieFatal(`mock model failed to start: ${e.message}`)
  }
  log(`mock model on 127.0.0.1:${mockPort}`)

  // ── host boot ──────────────────────────────────────────────────────────────
  const h = spawnHost({ port: hostPort, home: WORLD, logPath: INSTANCE_LOG, mockPort })
  const origin = `http://127.0.0.1:${hostPort}`
  let cookie = null
  try {
    const line = await waitForLogLine(INSTANCE_LOG, (l) => l.includes('/?token='), BOOT_TIMEOUT_MS, h.alive)
    if (line === null) {
      const detail = h.exitInfo.exited
        ? `process exited (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'}${h.exitInfo.message ? ` msg=${h.exitInfo.message}` : ''})`
        : `no boot marker within ${BOOT_TIMEOUT_MS}ms`
      throw new Error(`host boot failed: ${detail}\n--- log tail ---\n${scrub(logTail(INSTANCE_LOG))}`)
    }
    const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
    if (m === null || m[1] !== String(hostPort)) throw new Error(`boot marker port mismatch: ${line}`)
    cookie = await authenticate(origin, m[2])
    // Route-ready wait: the boot marker (token line) is emitted when the web
    // server listens, which precedes the team row's `rpc.handle` effect that
    // registers the /team-remote prefix route (T12-M4 mounts before the awaited
    // live boot, but the listen can happen first). A request landing in that
    // window hits the frontend static fallback (POST → bare 405, empty body)
    // instead of the channel dispatcher. Poll the v6 endpoint until the route
    // answers (any non-405 = the channel dispatcher is serving), then proceed.
    const tRoute = Date.now()
    let routeStatus = 0
    while (Date.now() - tRoute < 60_000) {
      const r = await remoteCall(origin, cookie, 'team.getReadState', { sessionId: T1_MEMBER_SESSION }, 6)
      routeStatus = r.status
      if (routeStatus !== 405) break
      await sleep(250)
    }
    if (routeStatus === 405) throw new Error('the /team-remote route never became ready (405 static fallback for 60s)')
    log(`route ready (${Date.now() - tRoute}ms after boot marker; status=${routeStatus})`)
  } catch (e) {
    stopHost(h)
    await MOCK.close()
    dieFatal(e.message)
  }

  // Function-scope verdict values (the final summary reads these).
  let gCreate = null
  let g1 = null
  let settleMs = null
  let grantEntry = null

  try {
    // ── C1 — baseline (pre-spill) ───────────────────────────────────────────
    const rs0 = await remoteCall(origin, cookie, 'team.getReadState', { sessionId: T1_MEMBER_SESSION }, 6)
    recordApi('rs0', { method: 'team.getReadState', params: { sessionId: T1_MEMBER_SESSION }, version: 6, result: rs0 })
    const rp0 = await remoteCall(origin, cookie, 'team.getProjection', { teamSessionId: T1 }, 6)
    recordApi('rp0', { method: 'team.getProjection', params: { teamSessionId: T1 }, version: 6, result: rp0 })
    const lp0 = await remoteCall(origin, cookie, 'team.getLedgerPage', { teamSessionId: T1, limit: 100 }, 6)
    recordApi('lp0', { method: 'team.getLedgerPage', params: { teamSessionId: T1, limit: 100 }, version: 6, result: lp0 })
    // The not-yet-created T2 root: 'none' with null cells (frozen decision
    // 1 — 'none' ONLY on positively confirmed no-affiliation).
    const rsT2pre = await remoteCall(origin, cookie, 'team.getReadState', { sessionId: T2 }, 6)
    recordApi('rsT2pre', { method: 'team.getReadState', params: { sessionId: T2 }, version: 6, result: rsT2pre })
    const lr0 = await remoteCall(origin, cookie, 'team.listRoots', {}, 3)
    recordApi('lr0', { method: 'team.listRoots', params: {}, version: 3, result: lr0 })

    const rs0v = rs0.body?.result?.ok === true ? rs0.body.result.value?.data : null
    const rp0v = rp0.body?.result?.ok === true ? rp0.body.result.value?.data?.projection : null
    const lp0v = lp0.body?.result?.ok === true ? lp0.body.result.value?.data : null
    const rsT2preV = rsT2pre.body?.result?.ok === true ? rsT2pre.body.result.value?.data : null
    const g0 = facts.teamGeneration
    const l0 = (lp0v?.entries ?? []).length
    const grant0 = (lp0v?.entries ?? []).filter((e) => e.factType === 'artifact-read-granted')
    const lt0 = rp0v?.liveToken ?? null
    // (PR #35 follow-up, P0-2) the CLOSED value carries liveToken:
    // none → null; team → non-empty 'lt-v1-*'.
    const rs0lt = rs0v?.liveToken ?? null
    const t2PreNone = rsT2preV?.relation === 'none'
      && rsT2preV?.teamSessionId === null
      && rsT2preV?.memberInstanceId === null
      && rsT2preV?.durableGeneration === null
      && rsT2preV?.disposed === false
      && rsT2preV?.liveToken === null
    const c1 =
      rs0v?.relation === 'team-member'
      && rs0v?.teamSessionId === T1
      && rs0v?.memberInstanceId === T1_MEMBER_INSTANCE
      && rs0v?.disposed === false
      && rs0v?.durableGeneration === g0
      && typeof rs0lt === 'string' && rs0lt.startsWith('lt-v1-')
      && rp0v !== null && rp0v.durableGeneration === g0 && typeof lt0 === 'string' && lt0.startsWith('lt-v1-')
      && rp0v.generation === g0
      && grant0.length === 0
      && t2PreNone
      && g0 === 2 + l0
    mark('C1', c1, `rs0={relation:${rs0v?.relation},gen:${rs0v?.durableGeneration},lt:${String(rs0lt).slice(0, 24)}…} rp0={gen:${rp0v?.generation},durable:${rp0v?.durableGeneration},lt:${String(lt0).slice(0, 24)}…} ledger=${l0} entries grants=${grant0.length} stamp=${g0} = 2 + ${l0} (S1-A invariant) T2pre={relation:${rsT2preV?.relation},cells-null+liveToken-null:${t2PreNone}}`)
    if (!c1) dieFatal('baseline (C1) not as expected — aborting before the spill prompt', 2)

    // ── C2 — the real spill (team.create v1 + initialWork on T2) ────────────
    // The spill runs on the NEW ROOT (Leader) session: the A2C-1 shell
    // contract gives only the leader an allow-lane whole-tool bash rule
    // (under the mutation-envelope dual gate), and the live glue installs
    // the tools/result observer only alongside a permissions policy.
    // team.create v1's initialWork admits + delivers ONE creation-time
    // work unit into the Root session (the fence-legitimate external
    // drive — never the generic Member follow-up on inst-leader).
    const createParams = {
      rootSessionId: T2,
      blueprintId: BLUEPRINT_ID,
      initialWork: { prompt: SPILL_PROMPT },
    }
    const create = await remoteCall(origin, cookie, 'team.create', createParams, 1, 240_000)
    recordApi('create', { method: 'team.create', params: createParams, version: 1, result: create })
    writeEvidence('c2-create.json', create)
    const createOk = create.status === 200 && create.body?.result?.ok === true
    const createPath = create.body?.result?.value?.data?.path ?? create.body?.result?.value?.path ?? null
    log(`team.create -> ${create.status} ok=${createOk} path=${createPath}`)
    if (!createOk) {
      dieFatal(`team.create rejected (status=${create.status}): ${safeJson(create.body).slice(0, 400)}\n--- log tail ---\n${scrub(logTail(INSTANCE_LOG))}`, 2)
    }
    // The generation at create-return. The synchronous initial-work
    // vertical admits, runs the work turn (the MID-TURN grant lands here),
    // and delivers BEFORE returning — the settle loop below still polls
    // for the durable grant as the authoritative settle signal (it is
    // already durable on the first poll; a regression that made the grant
    // async-or-missing would still be caught by the 120s budget).
    const rsC = await remoteCall(origin, cookie, 'team.getReadState', { sessionId: T2 }, 6)
    recordApi('rsC', { method: 'team.getReadState', params: { sessionId: T2 }, version: 6, result: rsC })
    const rsCv = rsC.body?.result?.ok === true ? rsC.body.result.value?.data : null
    if (rsCv?.relation !== 'team-root' || typeof rsCv?.durableGeneration !== 'number') {
      dieFatal(`T2 read-state after create is not team-root: ${safeJson(rsCv).slice(0, 300)}`, 2)
    }
    gCreate = rsCv.durableGeneration
    // Settle: the durable artifact-read-granted fact in the T2 ledger IS
    // the real-spill chain settlement (executor spill -> observer ->
    // authority -> durable fact). The read-state generation detection is
    // C3's job.
    const settleStart = Date.now()
    let lpSettle = null
    while (Date.now() - settleStart < SETTLE_TIMEOUT_MS) {
      lpSettle = await remoteCall(origin, cookie, 'team.getLedgerPage', { teamSessionId: T2, limit: 100 }, 6)
      const entries = lpSettle.body?.result?.ok === true ? (lpSettle.body.result.value?.data?.entries ?? []) : []
      grantEntry = entries.filter((e) => e.factType === 'artifact-read-granted').pop() ?? null
      if (grantEntry !== null) { settleMs = Date.now() - settleStart; break }
      await sleep(1_500)
    }
    recordApi('lpSettle', { method: 'team.getLedgerPage', params: { teamSessionId: T2, limit: 100 }, version: 6, result: lpSettle })
    // The mock must show the FULL turn: the marker work prompt WITH the
    // the `bash` tool call offered, then the tool result arriving (the
    // Anthropic wire: a tool_result block in a user message).
    const reqs = (MOCK.requests ?? [])
    const markerReqs = reqs.filter((r) => anyText(bodyOf(r)).includes(MK_SPILL) && !isTitleSideCall(r))
    const toolCallSeen = markerReqs.some((r) => (bodyOf(r)?.tools ?? []).some((t) => t?.name === 'bash'))
    const toolResultSeen = markerReqs.some((r) => hasToolResult(bodyOf(r)))
    // FULL marker-request bodies (always written): the tools surface of
    // the work turn + the tool_result content (success spillPath vs a
    // rejection) are the decisive evidence for the spill chain.
    writeEvidence('c2-marker-requests.json', markerReqs.map((r) => ({
      seq: r.seq,
      tools: (bodyOf(r)?.tools ?? []).map((t) => t?.name ?? null),
      toolResult: hasToolResult(bodyOf(r)),
      spillPathsInResult: toolResultSpillPaths(bodyOf(r)),
      body: bodyOf(r),
    })))
    // The new root is listed through the public channel (zero-state roots
    // surface, frozen decision 6's API-level half).
    const lr1 = await remoteCall(origin, cookie, 'team.listRoots', {}, 3)
    recordApi('lr1', { method: 'team.listRoots', params: {}, version: 3, result: lr1 })
    const roots1 = lr1.body?.result?.ok === true ? (lr1.body.result.value?.data?.roots ?? []) : []
    const t2Listed = roots1.some((r) => r.rootSessionId === T2)
    const c2 = settleMs !== null && toolCallSeen && toolResultSeen && t2Listed
    mark('C2', c2, `settle=${settleMs ?? 'TIMEOUT'}ms gCreate=${gCreate} mockReqs=${reqs.length} markerReqs=${markerReqs.length} toolCall=${toolCallSeen} toolResult=${toolResultSeen} T2-listed=${t2Listed} roots=${roots1.length}`)
    if (!c2) {
      writeEvidence('c2-fail-mock-requests.json', reqs.map((r) => ({
        seq: r.seq,
        model: bodyOf(r)?.model ?? null,
        marker: anyText(bodyOf(r)).includes(MK_SPILL),
        toolResult: hasToolResult(r),
        spillPathsInResult: toolResultSpillPaths(bodyOf(r)),
        text: anyText(bodyOf(r)).slice(0, 800),
      })))
      writeEvidence('c2-fail-ledger.json', lpSettle.body?.result?.value?.data?.entries ?? null)
      dieFatal(`settle failed (C2): no artifact-read-granted in the T2 ledger within ${SETTLE_TIMEOUT_MS}ms\n--- log tail ---\n${scrub(logTail(INSTANCE_LOG))}`, 2)
    }

    // ── C3 — read-state detects the generation ─────────────────────────────
    // STAMP AGREEMENT (see the header C3 note): the fresh read must return
    // the team-root cells with a durableGeneration equal to 2 + the T2
    // ledger entry count, with the grant AMONG those entries — the
    // synchronous initial-work vertical already returned the post-grant
    // state at create-return (G_CREATE included the grant, G1 === G_CREATE
    // is expected and asserted by the arithmetic below).
    const rs1 = await remoteCall(origin, cookie, 'team.getReadState', { sessionId: T2 }, 6)
    recordApi('rs1', { method: 'team.getReadState', params: { sessionId: T2 }, version: 6, result: rs1 })
    const rs1v = rs1.body?.result?.ok === true ? rs1.body.result.value?.data : null
    g1 = typeof rs1v?.durableGeneration === 'number' ? rs1v.durableGeneration : null
    // (PR #35 follow-up, P0-2) the team-root read-state carries the
    // non-empty liveToken (C4 asserts its identity with the projection).
    const lt1rs = rs1v?.liveToken ?? null
    // The T2 ledger state the stamp must agree with (fetched here, reused by C5).
    const lp1 = await remoteCall(origin, cookie, 'team.getLedgerPage', { teamSessionId: T2, limit: 100 }, 6)
    recordApi('lp1', { method: 'team.getLedgerPage', params: { teamSessionId: T2, limit: 100 }, version: 6, result: lp1 })
    const lp1v = lp1.body?.result?.ok === true ? lp1.body.result.value?.data : null
    const entries = lp1v?.entries ?? []
    const grants = entries.filter((e) => e.factType === 'artifact-read-granted')
    const grant = grants[grants.length - 1] ?? null
    const c3 =
      rs1v?.relation === 'team-root'
      && rs1v?.teamSessionId === T2
      && rs1v?.memberInstanceId === null
      && rs1v?.disposed === false
      && g1 !== null
      && typeof lt1rs === 'string' && lt1rs.startsWith('lt-v1-')
      && grants.length >= 1
      && g1 === 2 + entries.length
    mark('C3', c3, `readState post = {relation:${rs1v?.relation}, team:${rs1v?.teamSessionId}, disposed:${rs1v?.disposed}, gen:${g1} (create-return ${gCreate}), lt:${String(lt1rs).slice(0, 24)}…} stamp ${g1} = 2 + ${entries.length} entries, grants=${grants.length}, grantSeq=${grant?.sequence} (first/last seq ${entries[0]?.sequence}/${entries[entries.length - 1]?.sequence})`)

    // ── C4 — projection readable with the pair ──────────────────────────────
    const rp1 = await remoteCall(origin, cookie, 'team.getProjection', { teamSessionId: T2 }, 6)
    recordApi('rp1', { method: 'team.getProjection', params: { teamSessionId: T2 }, version: 6, result: rp1 })
    const rp1ok = rp1.body?.result?.ok === true
    const rp1v = rp1ok ? rp1.body.result.value : null
    const rp1p = rp1v?.data?.projection ?? null
    const lt1 = rp1p?.liveToken ?? null
    // The v6 provenance rides value.provenance (NOT under value.data).
    const prov1 = rp1v?.provenance ?? {}
    // (PR #35 follow-up, P0-2) the projection's liveToken IS the
    // read-state's liveToken — ONE authority for the freshness pair
    // (the host computes the token once; both endpoints expose it).
    const c4 = rp1ok && rp1p !== null
      && rp1p.generation === g1
      && rp1p.durableGeneration === g1
      && typeof lt1 === 'string' && lt1.startsWith('lt-v1-')
      && lt1 === lt1rs
      && prov1.contractVersion === 6
      && prov1.projectionGeneration === g1
      && 'members' in rp1p && 'generation' in rp1p && 'schemaVersion' in rp1p
    mark('C4', c4, `projection post = {gen:${rp1p?.generation}, durable:${rp1p?.durableGeneration}, lt:${String(lt1).slice(0, 24)}…, lt===readState-lt:${lt1 === lt1rs}, provCv:${prov1.contractVersion}, provGen:${prov1.projectionGeneration}}`)

    // ── C5 — the raw ledger keeps the grant (the lp1 page fetched in C3) ───
    const locator = grant?.payload?.locator
    let locatorStats = null
    try {
      if (typeof locator === 'string' && locator.length > 0) locatorStats = { exists: true, size: statSync(locator).size }
    } catch { locatorStats = { exists: false } }
    const c5 = grant !== null
      && grant.payload?.instanceId === LEADER_INSTANCE_ID
      && typeof locator === 'string'
      && locatorStats?.exists === true
      && locatorStats.size > 64_000
      && grant.payload?.source?.kind === 'shell-foreground'
      && grant.payload?.source?.toolName === 'bash'
      && typeof grant.payload?.targetKeyDigest === 'string'
      && typeof grant.payload?.versionDigest === 'string'
    mark('C5', c5, `grant=${grant ? `seq=${grant.sequence} inst=${grant.payload?.instanceId} locator=${locator} size=${locatorStats?.size} source=${grant.payload?.source?.kind}/${grant.payload?.source?.toolName} digests=${String(grant.payload?.targetKeyDigest).slice(0, 12)}/…` : 'ABSENT'} entries=${entries.length}`)
    if (!c5) {
      writeEvidence('c5-grants-missing-entries.json', entries.map((e) => ({ seq: e.sequence, factType: e.factType, payloadKeys: e.payload ? Object.keys(e.payload) : null })))
    }

    // ── C6 — the projection surface hides the grant ─────────────────────────
    const projJson = JSON.stringify(rp1p ?? {})
    // C5-dependent by construction: hiding is only verifiable with a grant
    // present. C5 absent -> C6 fails (nothing proven hidden).
    const hiddenOk = c5 === true
      ? !projJson.includes(locator)
        && !projJson.includes(grant.payload.targetKeyDigest)
        && !projJson.includes(grant.payload.versionDigest)
        && !projJson.includes('artifact-read-granted')
      : false
    const c6 = hiddenOk === true
    mark('C6', hiddenOk === true, c5 === true
      ? `projection JSON (${projJson.length} chars) contains locator=${projJson.includes(locator)} targetDigest=${projJson.includes(grant.payload.targetKeyDigest)} versionDigest=${projJson.includes(grant.payload.versionDigest)} factType=${projJson.includes('artifact-read-granted')}`
      : `not verifiable — no grant in the ledger (C5 failed)`)

    // ── evidence ─────────────────────────────────────────────────────────────
    writeEvidence('api-transcript.json', apiTranscript)
    // FULL mock request records (bodies + replies) — the tool_result
    // content is the model-visible spill evidence.
    writeEvidence('mock-requests.json', (MOCK.requests ?? []).map((r) => ({
      seq: r.seq,
      method: r.method,
      path: r.path,
      model: bodyOf(r)?.model ?? null,
      status: r.status,
      replyKind: r.reply?.kind ?? r.sent?.kind ?? null,
      body: bodyOf(r),
      sent: r.sent ?? r.reply ?? null,
    })))
    writeEvidence('instance.log.scrubbed', scrub(readFileSync(INSTANCE_LOG, 'utf8')))
    writeEvidence('mock.log', existsSync(MOCK_LOG) ? readFileSync(MOCK_LOG, 'utf8') : '(no mock log)')
  } finally {
    // ── C7 — teardown ───────────────────────────────────────────────────────
    stopHost(h)
    try { await MOCK.close() } catch { /* already stopped */ }
    await new Promise((r) => setTimeout(r, 500))
    const stablePost = {}
    for (const u of STABLE_PROBES) stablePost[u] = await probe(u)
    const porcelainPost = gitIn(TESTUSE, ['status', '--porcelain'])
    const headPost = gitIn(TESTUSE, ['rev-parse', 'HEAD'])
    const portFreeHost = await isPortFree(hostPort)
    const portFreeMock = await isPortFree(mockPort)
    const stableUnchanged = JSON.stringify(stablePre) === JSON.stringify(stablePost)
    const c7 = stableUnchanged && porcelainPost.out === '' && headPost.out === HOST_BASELINE_SHA && portFreeHost && portFreeMock
    mark('C7', c7, `stable pre==post=${stableUnchanged} testuse porcelain='${porcelainPost.out.slice(0, 60)}' HEAD=${headPost.out.slice(0, 8)} portsFree host=${portFreeHost} mock=${portFreeMock}`)
    writeEvidence('post.json', { stablePost, porcelainPost: porcelainPost.out, headPost: headPost.out, portFreeHost, portFreeMock, world: WORLD })
  }

  const allPass = criteria.every((c) => c.pass)
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP,
    verdict: allPass ? 'PASS' : 'FAIL',
    world: WORLD,
    worktree: WORKTREE,
    worktreeHead: wtHead.out,
    worktreePorcelain: wtPorcelain.out,
    hostPort,
    mockPort,
    t1: T1,
    t2: T2,
    blueprintId: BLUEPRINT_ID,
    spillLeader: { instance: LEADER_INSTANCE_ID },
    generation: { t2AtCreateReturn: gCreate, t2AfterGrant: g1 },
    grant: grantEntry ? { seq: grantEntry.sequence, locator: grantEntry.payload?.locator, source: grantEntry.payload?.source } : null,
    criteria,
  })
  log(`VERDICT ${allPass ? 'PASS' : 'FAIL'} — evidence: ${EVIDENCE_DIR}`)
  process.exit(allPass ? 0 : 2)
}

main().catch((e) => dieFatal(`unhandled: ${e.stack ?? e}`))
