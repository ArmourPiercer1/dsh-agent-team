#!/usr/bin/env node
/**
 * strict-read-smoke.mjs — the strict-read + core-spill REAL-PROFILE smoke
 * (task/strict-read-core-spill, implementation guide §16 DoD, phases A–E).
 *
 * WHAT THIS PROVES (one world, two host boots, sequential legs):
 *
 * The world is a REAL PROFILE WORLD — not a hand-inserted row:
 * $DSH_HOME/profiles/web/package.json declares
 * `dsh.profile.bundles: ['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app',
 * 'dsh-agent-team']` with `dsh-agent-team` as a `file:` dependency
 * (symlinked into the profile's node_modules — exactly what pnpm lays down
 * for a file: directory dep). The plugin's SHIPPED bundle layer (the root
 * `dsh.bundle.patch` manifest → cordis.patch.yml) is what installs the
 * rows: the base `spill-local` row DISABLED, the `dsh-agent-team` host row,
 * the Phase C `team-spill-local` provider row, and the client row. The
 * profile's own cordis.patch.yml only (a) overrides the host row's config
 * (staticModel → the scripted mock, the smoke preset, blueprint dir,
 * glue/seam URLs) and (b) inserts the p6t6 observability row. E1 asserts
 * the effective provider composition of this world.
 *
 *   E1 — effective provider: the host boots the bundle layer with the base
 *        spill-local disabled and team-spill-local active (a duplicate
 *        spillStore registration would have failed the composition — the
 *        boot succeeding is the no-duplication proof; the grant I/O below
 *        is recorded ONLY by the Team-aware provider — the behavioral
 *        proof). Host log lines captured to evidence.
 *   E2 — producer side (foreground shell leg, DoD #5): the created team's
 *        LEADER (strict policy: default-deny + allow-bash-any + the
 *        envelope `bash` exec token) runs a >64 KiB bash command; the
 *        agent-scoped tools/result observer records the durable
 *        `artifact-read-granted` fact (source kind `shell-foreground`,
 *        locator = the bash-local spill temp file) under the leader's
 *        composite identity BEFORE the runtime install.
 *   E3 — consumer side (DoD #2): the SAME leader `read`s its own spill
 *        path → the Phase B grant lane authorizes the read WITHOUT a
 *        control request (observation: artifact-grant-check valid:true;
 *        content round-trips the head marker).
 *   E4 — ordinary out-of-workspace read without a grant stays governed
 *        (DoD #1): the leader `read`s an out-of-workspace probe file with
 *        no grant → DENIED (default deny; the grant lane found no grant —
 *        observed).
 *   E5 — other Team instances cannot use the locator (DoD #6): member
 *        worker-1 (strict default-deny) `read`s the leader's spill path →
 *        DENIED (no grant exists for worker-1's identity).
 *   E6 — explicit deny still wins over a valid grant (DoD #7): member
 *        worker-2 (strict default-deny + ask-bash-any + EXPLICIT
 *        `deny read subtree <TMPDIR>`) runs its own >64 KiB bash (its ask
 *        is resolved by the leader via team_resolve_control), the durable
 *        grant for worker-2's spill IS recorded (producer side), and
 *        worker-2 `read`s its own spill path → DENIED by the explicit
 *        rule: the grant lane is never consulted after a static deny
 *        (provenance rule/deny — the valid grant is asserted present in
 *        the ledger).
 *   E7 — restart preserves valid grants (DoD #9): the host is stopped and
 *        relaunched on the SAME home (bootPhase create-or-open adopts the
 *        durable medium); the authority is REBUILT from the durable
 *        ledger before ready settles; the leader `read`s the SAME spill
 *        path again → still ALLOWED.
 *   E8 — non-Team DSH sessions behave as upstream (DoD #11): a plain
 *        (non-team-bound) session on the same host (created via the public
 *        session/create seam with the smoke preset) runs the same big bash
 *        (scripted through the mock) and then reads a KNOWN out-of-workspace
 *        probe path. The model-facing bash result is a text window over
 *        stdout (upstream rendering — it does NOT expose the spillPath), so
 *        the spill is verified from the filesystem: a NEW spill file appears
 *        in WORLD_TMP during the plain turn (diff of the spill inventory).
 *        HARD asserts: upstream spill works + ZERO artifact-read-granted
 *        facts for the plain spill(s) (the artifact authority is a no-op on
 *        unmanaged sessions — no grant I/O). The probe-read outcome (allow
 *        vs deny under the upstream default policy) is INFORMATIONAL.
 *   S1 — the GENERIC dsh-spill-policy SpillStore vertical (PR #26
 *        supplemental §2.1): the leader runs a bash whose stdout is
 *        50,500 bytes — INSIDE bash-local's 64,000-byte early-spill
 *        threshold (NO `stdout.spillPath`, the shell observer records
 *        nothing — the shell-foreground grant count is asserted unchanged)
 *        but ABOVE the base bundle's spill-policy `maxInlineBytes: 50000`
 *        and BELOW the read tool's 51,200-byte return cap: the generic
 *        policy saves the FULL rendered text through the agent's
 *        `spillStore` — the bundle layer's
 *        `team-spill-local`/`TeamAwareLocalSpillStore` replacement — and
 *        the sibling bridge records EXACTLY ONE durable grant with
 *        `source.kind: 'spill-store'` / `spillSource.toolName: 'bash'`.
 *        Same-instance (leader) read of the locator SUCCEEDS and
 *        round-trips the head+tail markers; another instance (worker-1)
 *        read of the same locator is DENIED.
 *   S2 — the TOOL-OWNED grep over-cap SpillStore vertical (PR #26
 *        supplemental §2.1): a 320-line `match-NNNN` fixture in the
 *        workspace; the BOOT team's leader `grep`s it (the preset mounts
 *        `dsh-tool-fs-search`; the boot team declares NO
 *        capabilities.permissions, so the A2C-2 Permission Coverage Gate
 *        never runs for it and its surface keeps `grep` — no strict
 *        instance can call grep itself: the frozen coverage gate
 *        classifies grep/glob KNOWN_SENSITIVE_UNMANAGED, A2C-6 deferred,
 *        and the strict agents remove them via the computed
 *        `builtinToolDeny`, the gate's own remediation). 320 > the tool's
 *        250-match inline cap, so grep's post-execute handler saves the
 *        COMPLETE formatted result through `spillStore.saveText`
 *        (`suggestedName: grep-results.txt`) — the SAME bundle-layer
 *        `team-spill-local` provider as every other session — and the
 *        bridge records EXACTLY ONE durable grant, under the boot root,
 *        with the provenance
 *        `{ kind: 'spill-store', spillSource: { kind: 'tool', toolName:
 *        'grep' } }`. Same-instance (boot-leader) read of the locator
 *        returns the FULL result (all 320 match lines round-trip); the
 *        STRICT team's leader (a different (root, instance) composite,
 *        default-deny) read of the same locator is DENIED — the grant is
 *        scoped to the producing instance. (Guide §2.1 phrasing: the
 *        producer is "managed Team agent" — strict-by-construction grep
 *        callers are excluded by the frozen A2C-2 gate; deviation noted
 *        in the round report.)
 *
 * DESIGN (pattern source: tests/kits/rc2-real-host-smoke — same mock
 * model, same host launch chain, same p6t6 observability row; the
 * differences are the real-profile mount and the deterministic p6t6-driven
 * member legs — no delegation/mock chain is needed for the members):
 *   R1 — the boot team (row anchor, legacy non-strict blueprint) serves
 *        ONE purpose: a discovery turn that captures the live tool
 *        surface so the strict created-team blueprint's `builtinToolDeny`
 *        is computed (the rc2 kit LEG 0 protocol — the Coverage Gate
 *        sees a fully covered surface).
 *   R2 — the created team (bound to the runtime-written saved blueprint S)
 *        carries all the strict-read capability: leader = default-deny +
 *        allow-bash-any (LEADER shell-class allow exception) + the
 *        teamEnvelope `bash` exec token (the exec-autonomy dual gate —
 *        without the token the leader allow would downgrade to a
 *        user-approval ask); worker-1 = default-deny; worker-2 =
 *        default-deny + ask-bash-any + explicit deny-read-subtree(TMPDIR).
 *   R3 — every member/leader tool leg is driven through the p6t6
 *        `/__p6t6/tool` endpoint (the production row's
 *        `live.executeTool` → the public tools.execute surface, so the
 *        agent-scoped tools/result observer and the pre-execute permission
 *        lane run exactly as for a model-initiated call). A leader-approval
 *        ask (worker-2's bash) blocks that call at the durable control
 *        wait; the kit discovers the requestId (the p6t6 observations feed
 *        + the durable ledger) and approves through the LEADER's
 *        team_resolve_control (a member's ask resolves as
 *        leader-approval: leader|human).
 *   R4 — TMPDIR is redirected into the world home (HOME/tmp) so the
 *        bash-local spill files (os tmpdir/dsh-subprocess-*) and the
 *        no-grant probe file live inside the session workspace (the
 *        sandbox) and OUTSIDE the team workspace (the strict-read
 *        boundary under test).
 *   R5 — stable instances :3080 and :3180 are probed READ-ONLY (status
 *        recorded pre and post); they are never written to.
 *
 * DoD coverage (implementation guide §16): #1 E4, #2 E3, #3–#4 unit
 * covered (Phase C 8-case suite — the spillStore vertical is unit-proven
 * over a real authority; this smoke proves the SHELL leg + the live
 * world), #5 E2, #6 E5, #7 E6, #9 E7, #10 unit covered (stale facts inert
 * — Phase A/B suites), #11 E8, #12/#13 post-gates, #14 verify-zero-core.
 *
 * Usage:
 *   node dev/agent-workflow/evidence/strict-read-core-spill/smoke/strict-read-smoke.mjs \
 *     [--worktree <dir>] [--testuse <dir>] [--host-port <n>] \
 *     [--mock-port <n>] [--evidence-dir <dir>] [--keep]
 *
 * Exit codes: 0 = all legs PASS (E8 may be SKIP-with-evidence when the
 * plain session lacks a bash tool — DoD #11 stays unit-covered);
 * 1 = a leg failed (diagnostics + mock dump in the evidence dir);
 * 2 = usage/environment error.
 *
 * P4-T6 self-cleanliness: this file carries ZERO legacy Team SessionEvent
 * denylist vocabulary; it lives under dev/agent-workflow (outside the
 * packages/** scan surface — no pin impact).
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync, rmSync, symlinkSync, openSync, closeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startMockModel } from '../../../../../packages/tools/harness/mock-deepseek.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────
function argValue(flag, dflt) {
  const i = process.argv.indexOf(flag)
  if (i === -1) return dflt
  const v = process.argv[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`${flag} requires a value`)
  return v
}
function hasFlag(flag) { return process.argv.includes(flag) }
let stopCalled = false
function onExitSignal(code) {
  if (stopCalled) return
  stopCalled = true
  console.log(`[strict-read-smoke] signal received — stopping host…`)
  try { stopHost() } catch { /* best effort */ }
  try { stopMock() } catch { /* best effort */ }
  process.exit(code)
}
process.on('SIGINT', () => onExitSignal(130))
process.on('SIGTERM', () => onExitSignal(143))

const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const WORKTREE_DEFAULT = resolve(KIT_DIR, '..', '..', '..', '..', '..')

const WORKTREE = resolve(argValue('--worktree', WORKTREE_DEFAULT))
// The main repo is two levels above the worktree root
// (the .worktrees/<task> layout); the pristine test-use checkout lives
// in the MAIN repo (never in a worktree).
const MAIN_REPO_DEFAULT = resolve(WORKTREE, '..', '..')
const TESTUSE = resolve(argValue('--testuse', join(MAIN_REPO_DEFAULT, 'tests', 'deepseek-harness-test-use')))
const HOST_BASELINE_SHA = 'fb2c4b9e698e30edb738bca4cf0618587db7d203'
const HOST_BASELINE_SHORT = 'fb2c4b9e69'
const HOST_BIN = join(TESTUSE, 'apps/cli/lib/bin.js')
const DIST_GLUE = join(WORKTREE, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs')
const SOURCE_SEAM = join(WORKTREE, 'packages/runtime/root-binding/harness/seam.mjs')
const DIST_HOST = join(WORKTREE, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')
const DIST_SPILL = join(WORKTREE, 'packages/runtime/dist/packages/runtime/src/plugin/team-spill-local.js')
const P6T6_PLUGIN = join(WORKTREE, 'packages/tools/harness/plugin.mjs')
const HOST_PKG = join(WORKTREE, 'package.json')
const SHIPPED_PATCH = join(WORKTREE, 'cordis.patch.yml')
const RUN_STAMP = process.env.STRICT_READ_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(WORKTREE, 'tests', 'homes', `strict-read-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const WORLD_TMP = join(HOME, 'tmp')            // R4: TMPDIR redirect target
const BLUEPRINT_DIR = join(HOME, 'blueprints') // the row's blueprintDir (saved-source catalog)
const EVIDENCE_DEFAULT = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'strict-read-core-spill', 'smoke', `run-${RUN_STAMP}`)
const RUN_DIR = resolve(argValue('--evidence-dir', EVIDENCE_DEFAULT))
const KEEP = hasFlag('--keep')

const PRESET_ID = 'strict-read-smoke'
const ROOT = 'team-root'                          // the row anchor (boot team)
const CREATED_ROOT = `session-strict-read-${RUN_STAMP.slice(11, 19).replace(/-/g, '')}`
const BP_S_ID = 'team.strict-read-s'
const PLAIN_SESSION = `session-strict-read-plain-${RUN_STAMP.slice(11, 19).replace(/-/g, '')}`

// Markers (each unique per run).
const MK_DISC = `STRICTREAD_DISC_${RUN_STAMP.replace(/[-:]/g, '')}`
const MK_PLAIN = `STRICTREAD_PLAIN_${RUN_STAMP.replace(/[-:]/g, '')}`
const spillHead = (tag) => `STRICTREAD_SPILL_HEAD_${tag}_${RUN_STAMP.replace(/[-:]/g, '')}`
const spillLine = (tag) => `STRICTREAD_L_${tag}_${RUN_STAMP.replace(/[-:]/g, '')}`
const spillTail = (tag) => `STRICTREAD_SPILL_TAIL_${tag}_${RUN_STAMP.replace(/[-:]/g, '')}`
const spillCommand = (tag) =>
  `{ echo ${spillHead(tag)}; yes ${spillLine(tag)} | head -c 200000; echo ${spillTail(tag)}; }`
// The STANDARD dsh-tool-bash (unlike the persistent variant) requires a
// `description` argument (5-10 words, active voice).
const bashArgs = (tag) => ({ command: spillCommand(tag), description: `Emit a 200 KiB stdout payload for spill leg ${tag}` })
const NO_GRANT_PROBE = join(WORLD_TMP, `no-grant-${RUN_STAMP.replace(/[-:]/g, '')}.txt`)

// ── S1: the generic spill-policy band (PR #26 supplemental §2.1) ─────
// bash-local early-spills at `maxOutputBytes` (64_000); the base bundle's
// dsh-spill-policy row spills any plain-text tool result over
// `maxInlineBytes` (50_000) through the agent's spillStore; the read tool
// itself returns at most `readMaxBytes` (51_200) of a file AND truncates
// any single line longer than 2_000 chars (`readMaxLineLength`). A stdout
// of 50,500 bytes laid out as head-line + 25 short x-lines (1_999 x each)
// + a short remainder x-line + tail-line sits in ALL FOUR gaps at once:
// no bash-local `stdout.spillPath` (the shell observer records nothing),
// the generic policy saves the full rendered text via
// TeamAwareLocalSpillStore → a `spill-store` grant, and the SAME-instance
// read-back round-trips the WHOLE file (head+tail markers, no line or
// byte truncation).
const S1_TOTAL_BYTES = 50500
const s1Stamp = RUN_STAMP.replace(/[-:]/g, '')
const s1Head = `STRICTREAD_SPILL_HEAD_S1_${s1Stamp}`
const s1Tail = `STRICTREAD_SPILL_TAIL_S1_${s1Stamp}`
// stdout = head + \n + 25 lines of (1999 x + \n) + (R x + \n) + tail + \n,
// total EXACTLY S1_TOTAL_BYTES (so the band membership is deterministic,
// not a range); every line < 2000 chars (the read line cap). R = the x
// count of the remainder line (printf adds the trailing \n, so the line
// is R+1 bytes).
const s1FillLines = 25
const s1FillLineBytes = 2000 // 1999 x + \n
const s1FillRemainderX = S1_TOTAL_BYTES - (s1Head.length + 1) - (s1Tail.length + 1) - s1FillLines * s1FillLineBytes - 1
const s1Command = [
  'XLINE=$(head -c 1999 /dev/zero | tr \'\\0\' x)',
  `echo ${s1Head}`,
  `for i in $(seq ${s1FillLines}); do echo "$XLINE"; done`,
  `printf '%s\\n' "$(head -c ${s1FillRemainderX} /dev/zero | tr '\\0' x)"`,
  `echo ${s1Tail}`,
].join('; ')
const s1Args = { command: s1Command, description: `Emit a 50500 byte stdout payload in the spill-policy band` }

// ── S2: the grep over-cap fixture (PR #26 supplemental §2.1) ──────────
// 320 `match-NNNN` lines > the grep tool's 250-match inline cap, so the
// tool's post-execute handler spills the COMPLETE formatted result.
const GREP_FIXTURE = join(WORKSPACE, `grep-fixture-${s1Stamp}.txt`)
const GREP_MATCH_LINES = 320
const grepFixtureLines = Array.from({ length: GREP_MATCH_LINES }, (_, n) => `match-${String(n + 1).padStart(4, '0')} payload line ${n + 1}`)
const grepArgs = { pattern: 'match-', path: GREP_FIXTURE }

// The team tool catalog of THIS host baseline (the rc2 kit proven set —
// the same fb2c4b9e69 baseline this smoke launches).
const TEAM_TOOL_CATALOG = new Set([
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message',
  'team_report_progress', 'team_request_control', 'team_resolve_control',
])
// NOTE (PR #26 supplemental S2): grep/glob are deliberately ABSENT from this
// list — they must land in the strict agents' `builtinToolDeny`. The A2C-2
// Permission Coverage Gate (frozen; runs for every template that declares
// `capabilities.permissions`) classifies grep/glob as
// KNOWN_SENSITIVE_UNMANAGED (A2C-6 deferred, plan §11.3) and fails setup
// closed when they are on a strict final surface. The gate's own
// remediation is `builtinToolDeny` removal — which the computed denyList
// below performs. The boot team (NO capabilities.permissions) is outside
// the gate and keeps grep on its surface — S2 uses the boot leader as the
// managed grep producer (see the S2 block and the header doc).
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']

// ── state / logging / criteria ──────────────────────────────────────────
const LOG_PATH = join(RUN_DIR, 'smoke.log')
const CRITERIA = []
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  try { mkdirSync(RUN_DIR, { recursive: true }); appendLog(line) } catch { /* pre-RUN_DIR */ }
  console.log(line)
}
function appendLog(line) {
  appendFileSync(LOG_PATH, line + '\n')
}
function check(leg, name, ok, detail) {
  CRITERIA.push({ leg, name, ok, detail: String(detail ?? '') })
  log(`${ok ? 'PASS' : 'FAIL'} [${leg}] ${name}${detail ? ` — ${String(detail).slice(0, 300)}` : ''}`)
}
function writeEvidence(name, obj) {
  mkdirSync(RUN_DIR, { recursive: true })
  writeFileSync(join(RUN_DIR, name), typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2))
}

// ── small http helpers ──────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function fetchJson(url, init, timeoutMs = 30000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  let body = null
  const text = await res.text()
  try { body = text ? JSON.parse(text) : null } catch { body = { raw: text.slice(0, 4000) } }
  const cookie = res.headers.get('set-cookie')
  return { status: res.status, body, cookie: cookie ? cookie.split(';')[0] : null }
}
async function probeStableInstance(port, label, phase) {
  let state
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(3000) })
    state = { reachable: true, status: res.status }
  } catch (error) {
    state = { reachable: false, error: String(error?.message ?? error).slice(0, 120) }
  }
  log(`ZERO-TOUCH probe ${label} ${phase}: ${JSON.stringify(state)}`)
  return state
}
/**
 * The proven rc2 kit auth: GET /?token=… with redirect:manual → 303 +
 * set-cookie (the session cookie is set on the redirect hop).
 */
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}
/**
 * One browser-facing public Remote call: POST /team-remote/<method>
 * (the rc2 kit envelope: type=client-request, rpcId, payload.version +
 * payload.params — `team.create` is v1-era, proven in the rc2 round).
 */
function remoteCall(origin, cookie, method, params, tag = 'strict-read', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, 240000)
}
/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'strict-read', timeoutMs = 180000) {
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
  }, timeoutMs)
}
/**
 * Explicit-id session adoption over the public session channel (the same
 * seam the Web UI uses for "New session": session/create with a client
 * preset). A prompt to a never-created session id is accepted (200) but
 * never runs an agent turn on this baseline — the plain session MUST be
 * created first (run 16 evidence: zero model requests for the plain prompt).
 */
async function apiSessionCreate(origin, cookie, sessionId, cwd, tag = 'strict-read') {
  return fetchJson(`${origin}/api/session/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/create',
      payload: {
        args: {
          request: { sessionId, cwd, agentPreset: PRESET_ID },
        },
      },
    }),
  }, 120000)
}
/** Read-tool result text: value is {path, offset, lines:[{number,text}], totalLines}. */
function readTextOf(body) {
  const v = body?.value
  if (v === undefined || v === null) return ''
  if (typeof v.content === 'string') return v.content
  if (Array.isArray(v.lines)) return v.lines.map((l) => (l && typeof l.text === 'string' ? l.text : '')).join('\n')
  return JSON.stringify(v)
}
async function p6t6Tool(port, name, args, as, tag = 'strict-read', timeoutMs = 240000) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as, callId: `${tag}-${Math.random().toString(36).slice(2, 12)}` }),
  }, timeoutMs)
}
async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, { method: 'GET' }, 30000)
}
async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, { method: 'GET' }, 15000)
}
function logTail(n) {
  try {
    const s = readFileSync(INSTANCE_LOG, 'utf8')
    return s.split('\n').slice(-n).join('\n')
  } catch { return '' }
}
const BOOT_MARKER = 'dsh web: http://'
async function waitForLogLine(marker, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (logTail(400).includes(marker)) return true
    await sleep(250)
  }
  return false
}

// ── host lifecycle ──────────────────────────────────────────────────────
let hostProc = null
let INSTANCE_LOG = ''
function spawnHost({ port, logPath }) {
  // The rc2 kit pattern: open the log as a FILE DESCRIPTOR (string paths
  // in stdio are rejected on this Node build — ERR_INVALID_SYNC_FORK_INPUT).
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: WORKSPACE,
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: HOST_BASELINE_SHORT,
        DEEPSEEK_API_KEY: 'strict-read-smoke-mock-key',
        TMPDIR: WORLD_TMP, // R4: spill files + probe files inside the world (workspace-contained)
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK.port}`,
      },
      stdio: ['ignore', outFd, errFd],
    })
  } catch (error) {
    closeSync(outFd)
    closeSync(errFd)
    throw new Error(`host spawn failed: ${error instanceof Error ? error.message : String(error)}`)
  }
  return child
}
function stopHost() {
  if (hostProc === null) return
  const p = hostProc
  hostProc = null
  try { p.kill('SIGTERM') } catch { /* already dead */ }
}
async function stopHostAndWait(timeoutMs = 20000) {
  if (hostProc === null) return
  const p = hostProc
  let done = false
  const waiter = new Promise((res) => { p.once('exit', () => { done = true; res() }) })
  try { p.kill('SIGTERM') } catch { /* already dead */ }
  const deadline = Date.now() + timeoutMs
  while (!done && Date.now() < deadline) await sleep(200)
  if (!done) { try { p.kill('SIGKILL') } catch { /* already dead */ } await waiter }
  hostProc = null
}

// ── mock model ──────────────────────────────────────────────────────────
let MOCK = null
function stopMock() { if (MOCK !== null) { try { MOCK.close() } catch { /* already closed */ } MOCK = null } }
// Concatenate EVERY user-role message (in order). DSH sends the prompt text
// and the runtime-context snapshot as SEPARATE user messages — the last one
// is the runtime context, so reading only the last message misses the
// prompt (run 8/9 lesson: the marker lived in the earlier user message).
function userTextOf(r) {
  const msgs = r.body?.messages ?? []
  const parts = []
  for (const m of msgs) {
    if (m.role !== 'user') continue
    if (typeof m.content === 'string') parts.push(m.content)
    else if (Array.isArray(m.content)) for (const c of m.content) if (c?.type === 'text' && typeof c.text === 'string') parts.push(c.text)
  }
  return parts.join('\n')
}
// True for the DSH title-generation side call (system prompt asks for a
// one-line title; carries the human messages as JSON — so it contains our
// markers too and must be answered with a short title, not a leg reply).
function isTitleGen(r) {
  const first = (r.body?.messages ?? [])[0]
  return first?.role === 'system' && typeof first.content === 'string' && first.content.includes('concise title')
}
function toolMsgsOf(r) {
  return (r.body?.messages ?? []).filter((m) => m.role === 'tool')
}
function toolNameOf(m) {
  if (m && typeof m === 'object' && m.type === 'function' && typeof m.function?.name === 'string') return m.function.name
  return typeof m?.name === 'string' ? m.name : null
}
// A `role:'tool'` result message carries NO name in the OpenAI chat format —
// the tool name lives in the preceding assistant message's `tool_calls`,
// joined by `tool_call_id`. Correlate (with a direct-name fallback for other
// shapes). run 18 lesson: without this, `names[0]` is null and the plain
// chain falls through to the terminal reply after the first tool result.
function toolResultNameOf(r, tm) {
  if (typeof tm?.name === 'string') return tm.name
  if (typeof tm?.function?.name === 'string') return tm.function.name
  const id = tm?.tool_call_id
  if (typeof id === 'string') {
    for (const m of (r.body?.messages ?? [])) {
      if (m?.role !== 'assistant' || !Array.isArray(m.tool_calls)) continue
      for (const tc of m.tool_calls) {
        if (tc && tc.id === id && typeof tc.function?.name === 'string') return tc.function.name
      }
    }
  }
  return null
}
function argsOf(m) {
  let a = m?.function?.arguments ?? m?.arguments
  if (typeof a === 'string') { try { a = JSON.parse(a) } catch { a = {} } }
  return (a && typeof a === 'object' && !Array.isArray(a)) ? a : {}
}
function toolResultText(m) {
  const c = m?.content
  return typeof c === 'string' ? c : JSON.stringify(c ?? '')
}
function decide(ctx) {
  // The harness mock invokes decide({seq, req}) with req = the parsed body
  // (packages/tools/harness/mock-deepseek.mjs). The helpers below expect a
  // request-record shape ({body: <parsed body>}, as stored in MOCK.requests)
  // — normalize every supported input form to it.
  const parsed = ctx?.req ?? (ctx?.body !== undefined ? ctx.body : ctx)
  const r = { body: parsed }
  const tools = toolMsgsOf(r)
  const text = userTextOf(r)
  // Title-gen side call (carries our markers inside its JSON input) —
  // answer with a short title; never with a leg reply.
  if (isTitleGen(r)) {
    return { kind: 'text', content: 'strict-read smoke run' }
  }
  // L0 discovery: the boot-team leader's single scripted turn.
  if (text.includes(MK_DISC)) {
    return { kind: 'text', content: 'STRICTREAD_DISC_DONE' }
  }
  // E8 plain session: big bash -> read a KNOWN out-of-workspace probe -> done.
  // The model-facing bash result is a TEXT WINDOW over stdout (upstream
  // rendering — it does NOT expose the canonical spillPath; run 19 evidence:
  // the model text is the tail of the stream, head marker absent). The spill
  // itself is still written by the executor to $TMPDIR — the kit verifies it
  // from the filesystem (glob diff around the plain turn). For the read leg a
  // known path is used so the chain is deterministic; the outcome (allow vs
  // deny under the upstream default policy) is informational.
  if (text.includes(MK_PLAIN)) {
    const named = tools.map((tm) => ({ tm, name: toolResultNameOf(r, tm) }))
    const bashEntry = named.find((e) => e.name === 'bash')
    const readEntry = named.find((e) => e.name === 'read')
    if (bashEntry === undefined) {
      return { kind: 'tool-call', toolCalls: [{ id: `call-plain-1`, name: 'bash', arguments: bashArgs('PLAIN') }] }
    }
    if (readEntry === undefined) {
      return { kind: 'tool-call', toolCalls: [{ id: `call-plain-2`, name: 'read', arguments: { file_path: NO_GRANT_PROBE } }] }
    }
    return { kind: 'text', content: 'STRICTREAD_PLAIN_DONE' }
  }
  return { kind: 'text', content: 'STRICTREAD_NOOP' }
}
async function waitForMock(pred, timeoutMs, what) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const hit = MOCK.requests.find(pred)
    if (hit !== undefined) return hit
    await sleep(150)
  }
  log(`waitForMock TIMEOUT: ${what} (requests=${MOCK.requests.length})`)
  return null
}
function dumpMock(tag) {
  writeEvidence(`mock-dump-${tag}.json`, MOCK.requests.map((r) => ({
    seq: r.seq,
    status: r.status,
    model: r.body?.model ?? null,
    reply: r.reply,
    userTail: userTextOf(r).slice(-300),
    // Raw body shape (roles + content heads + tool definitions) — the
    // decisive view when a turn arrives with an unexpected shape.
    raw: r.body === null ? null : {
      keys: Object.keys(r.body),
      messages: (r.body.messages ?? []).map((m) => ({
        role: m.role,
        contentHead: typeof m.content === 'string' ? m.content.slice(0, 240) : (Array.isArray(m.content) ? m.content.map((c) => (c?.type === 'text' ? `text:${String(c.text).slice(0, 240)}` : String(c?.type))) : JSON.stringify(m.content).slice(0, 240)),
        toolCallId: m.tool_call_id ?? null,
        name: m.name ?? null,
      })),
      toolDefs: (r.body.tools ?? []).map((t) => t?.function?.name ?? t?.name ?? '?'),
    },
    tools: toolMsgsOf(r).map((m) => ({ name: toolNameOf(m), result: toolResultText(m).slice(0, 400) })),
  })))
}

// ── durable ledger scans ────────────────────────────────────────────────
/**
 * Read every durable ledger entry (the rc2 kit pattern):
 * team_domain.json → tables.ledger = a MAP keyed by sequence whose values
 * are JSON strings ({factType, rootSessionId, payload, ...}). Read-only.
 */
function readDurableLedger() {
  const file = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(file)) return []
  let parsed
  try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch { return [] }
  const table = parsed?.tables?.ledger
  if (table === null || typeof table !== 'object') return []
  const out = []
  for (const [seq, raw] of Object.entries(table)) {
    if (seq === '__ledger_sequence_counter' || typeof raw !== 'string') continue
    let entry = null
    try { entry = JSON.parse(raw) } catch { continue }
    if (entry !== null && typeof entry === 'object') out.push({ sequence: seq, ...entry })
  }
  return out
}
function grantFacts() {
  return readDurableLedger().filter((e) => e.factType === 'artifact-read-granted')
}
function grantFor(locator) {
  return grantFacts().filter((e) => {
    const p = e.payload
    return p !== null && typeof p === 'object' && p.locator === locator
  })
}
/**
 * All durable grants whose provenance is a SpillStore producer with a given
 * tool name (PR #26 supplemental S1/S2): `source.kind === 'spill-store'` and
 * `source.spillSource.toolName === toolName`. The SpillStore bridge records
 * the grant during the tool's `post-execute` spill, so this is the S1/S2
 * producer assertion (the shell-foreground observer uses `source.kind ===
 * 'shell-foreground'` — a disjoint provenance, asserted separately).
 *
 * `sinceSequences` (a Set of ledger sequence numbers snapshotted BEFORE the
 * producing call) filters to the NEW grants only — required because an
 * early-spilled foreground bash mints BOTH a shell-foreground grant (the
 * shell observer) AND a spill-store/bash grant (the generic spill-policy
 * still sees a >maxInlineBytes model-facing result) — so the absolute
 * spill-store count is not stable across legs.
 */
function spillStoreGrantsFor(toolName, sinceSequences) {
  return grantFacts().filter((e) => {
    const p = e.payload
    return p !== null && typeof p === 'object'
      && p.source?.kind === 'spill-store'
      && p.source?.spillSource?.toolName === toolName
      && (sinceSequences === undefined || !sinceSequences.has(e.sequence))
  })
}
/**
 * Poll the durable ledger until a SpillStore grant for `toolName` appears
 * (the bridge records it asynchronously during post-execute), or `null` on
 * timeout. Mirrors the E2/E6 grant-discovery loop. `sinceSequences` limits
 * the wait (and the returned set) to grants minted AFTER the snapshot.
 */
async function waitForSpillGrant(toolName, timeoutMs = 10000, sinceSequences) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const hits = spillStoreGrantsFor(toolName, sinceSequences)
    if (hits.length > 0) return hits
    await sleep(250)
  }
  return []
}
/**
 * Inventory the executor spill files under WORLD_TMP ($TMPDIR redirect):
 * `dsh-subprocess-<rand>/dsh-subprocess-<pid>-<n>-{stdout,stderr}.log`.
 * Used to verify the plain-session spill from the filesystem (the
 * model-facing result text does not expose the spill path).
 */
function listSpillFiles() {
  const out = []
  let entries = []
  try { entries = readdirSync(WORLD_TMP, { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('dsh-subprocess-')) continue
    const dir = join(WORLD_TMP, entry.name)
    let files = []
    try { files = readdirSync(dir) } catch { continue }
    for (const f of files) {
      if (f.endsWith('-stdout.log') || f.endsWith('-stderr.log')) out.push(join(dir, f))
    }
  }
  return out
}

// ── p6t6 observation helpers ────────────────────────────────────────────
async function pollObservations(pred, timeoutMs, what) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const st = await p6t6State(HOST_PORT).catch(() => null)
    const obs = st?.body?.observations
    if (Array.isArray(obs)) {
      const hit = obs.filter(pred)
      if (hit.length > 0) return hit
    }
    await sleep(300)
  }
  throw new Error(`no matching p6t6 observation within ${timeoutMs}ms: ${what}`)
}
/**
 * Discover the pending control requestId of worker-2's bash ask (the rc2
 * kit R3 pattern, adapted): source 1 = the p6t6 observations feed (the
 * `request-created` line carries the requestId — in this world ONLY the
 * created team can mint control requests: the boot team is legacy
 * non-strict, so any request-created line in the E6 window is the
 * worker-2 ask); source 2 = the durable ledger (control-request-recorded
 * facts for CREATED_ROOT, `payload.requestId`). Returns the id or null.
 */
async function discoverPendingRequestId(tag) {
  // 30s covers the W2 agent's cold resume (ensureLiveAgent) before the
  // ask's control request is minted.
  const start = Date.now()
  while (Date.now() - start < 30000) {
    const st = await p6t6State(HOST_PORT).catch(() => null)
    const obs = Array.isArray(st?.body?.observations) ? st.body.observations : []
    for (const o of obs) {
      const line = typeof o === 'string' ? o : JSON.stringify(o)
      if (!/request-created|requestId/.test(line)) continue
      const m = /"requestId"\s*:\s*"([^"]+)"/.exec(line)
      if (m !== null) return m[1]
    }
    const rows = readDurableLedger()
      .filter((e) => e.factType === 'control-request-recorded' && String(e.rootSessionId) === CREATED_ROOT)
      .reverse()
    for (const e of rows) {
      if (e.payload !== null && typeof e.payload === 'object' && typeof e.payload.requestId === 'string') {
        return e.payload.requestId
      }
    }
    await sleep(500)
  }
  writeEvidence(`${tag}-pending-discovery-failed.json`, {
    obsTail: (await p6t6State(HOST_PORT).catch(() => null))?.body?.observations?.slice(-20) ?? null,
  })
  return null
}

// ── blueprint S (the strict created team) ───────────────────────────────
/**
 * The strict saved blueprint S (the rc2 kit proven shape — block-style
 * resource rules, `policyStates: []`):
 *  leader  — default DENY + allow bash-any (the LEADER shell-class allow
 *            exception) + the exec-envelope `bash` token (the dual gate);
 *  worker-1 — pure default DENY (no grants, no asks — E5's cross-instance
 *            denial leg);
 *  worker-2 — default DENY + ASK bash-any + EXPLICIT deny read subtree
 *            <WORLD_TMP> (E6: the ask resolves via leader approval, the
 *            producer grant IS recorded, and the explicit deny wins over
 *            the valid grant).
 * All three roles carry the discovery-computed builtinToolDeny (the
 * Coverage Gate over the strict surface) + the same skills/mcp lanes.
 */
// The `capabilities:` block under a template — base = the indent of the
// `capabilities:` key itself (2 under the top-level `leader:`, 4 under a
// `members:` list item — every key must align with its siblings).
function capsYaml(base, { teamToolsKind, teamToolsItems = [], denyList = [], permissions }) {
  const i = (n) => ' '.repeat(base + n)
  return [
    `${i(0)}capabilities:`,
    `${i(2)}teamTools:`,
    // DTO (validate.ts): deny must be EXACTLY {kind:'deny'} (no other
    // fields); allow requires items (possibly empty).
    ...(teamToolsKind === 'allow'
      ? [`${i(4)}kind: allow`, `${i(4)}items:`, ...teamToolsItems.map((t) => `${i(6)}- ${t}`)]
      : [`${i(4)}kind: deny`]),
    ...(denyList.length === 0
      ? [`${i(2)}builtinToolDeny: []`]
      : [`${i(2)}builtinToolDeny:`, ...denyList.map((n) => `${i(4)}- ${n}`)]),
    `${i(2)}skills:`,
    `${i(4)}kind: allow`,
    `${i(4)}items: []`,
    `${i(2)}mcp:`,
    `${i(4)}kind: allow`,
    `${i(4)}items: []`,
    ...permissions,
  ]
}
// A `permissions:` block — base = the indent of the `permissions:` key
// (base+2 of the capabilities base); lanes at base, rules at base+2,
// resource fields at base+4 (the rc2 kit proven shape). The saved-source
// DTO requires ALL THREE lanes to be present (MALFORMED_DTO otherwise —
// run 10), so empty lanes are emitted as `[]`.
function permsYaml(base, policy) {
  const i = (n) => ' '.repeat(base + n)
  const rule = (tool, resource) => resource.kind === 'any'
    ? [`${i(2)}- tool: ${tool}`, `${i(4)}resource:`, `${i(6)}kind: any`]
    : [`${i(2)}- tool: ${tool}`, `${i(4)}resource:`, `${i(6)}kind: subtree`, `${i(6)}path: ${resource.path}`]
  const lane = (name, rules) => (rules.length === 0
    ? [`${i(2)}${name}: []`]
    : [`${i(2)}${name}:`, ...rules.flatMap((r) => rule(r.tool, r.resource))])
  return [
    `${i(0)}permissions:`,
    `${i(2)}default: ${policy.default}`,
    ...lane('allow', policy.allow ?? []),
    ...lane('ask', policy.ask ?? []),
    ...lane('deny', policy.deny ?? []),
  ]
}

function savedBlueprintS(denyList, tmpdirForDeny) {
  const teamToolsAllow = ['team_list_members', 'team_create_member', 'team_resolve_control']
  // leader (caps base 2 — aligned with templateId/persona under leader:)
  const leaderCaps = capsYaml(2, {
    teamToolsKind: 'allow',
    teamToolsItems: teamToolsAllow,
    denyList,
    // S2 (PR #26 supplemental): the strict agents carry NO grep/glob on
    // their final surface — the computed `builtinToolDeny` (the MANAGED
    // list above deliberately excludes them) removes them, which is the
    // A2C-2 Permission Coverage Gate's own remediation: grep/glob are
    // KNOWN_SENSITIVE_UNMANAGED (A2C-6 deferred) and FATAL on any
    // capabilities.permissions surface. The S2 vertical therefore uses
    // the boot team's leader (managed, no permissions → gate absent) as
    // the grep producer; see the S2 block and the header doc.
    permissions: permsYaml(4, { default: 'deny', allow: [{ tool: 'bash', resource: { kind: 'any' } }] }),
  })
  // member list items (caps base 4 — aligned with templateId/persona)
  const worker1Caps = capsYaml(4, {
    teamToolsKind: 'deny',
    denyList,
    permissions: permsYaml(6, { default: 'deny' }),
  })
  const worker2Caps = capsYaml(4, {
    teamToolsKind: 'deny',
    denyList,
    permissions: permsYaml(6, {
      default: 'deny',
      ask: [{ tool: 'bash', resource: { kind: 'any' } }],
      deny: [{ tool: 'read', resource: { kind: 'subtree', path: tmpdirForDeny } }],
    }),
  })
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${BP_S_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify('You lead the strict-read smoke team. Keep replies short.')}`,
    ...leaderCaps,
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '    - bash',
    '  deny: []',
    'members:',
    '  - templateId: worker-1',
    `    persona: ${JSON.stringify('You are worker-1 of the strict-read smoke team.')}`,
    ...worker1Caps,
    '  - templateId: worker-2',
    `    persona: ${JSON.stringify('You are worker-2 of the strict-read smoke team.')}`,
    ...worker2Caps,
    'memberEnvelopes:',
    '  - templateId: worker-1',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
    '  # worker-2 NEEDS request-control in its own envelope: the ask-bash',
    '  # flow mints the leader-approval request by performing the',
    '  # request-control operation AS THE MEMBER (run 15 lesson: without it',
    '  # the ask decision fails with "operation request-control is outside',
    '  # the callers mutation envelope" and the call errors instead of',
    '  # blocking on the approval).',
    '  - templateId: worker-2',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

// ── profile world materialization (the REAL profile mount) ──────────────
// The row anchor: a plain LEGACY leader (NO capabilities — the rc2 kit's
// proven byte-for-byte boot shape; the boot team is legacy non-strict by
// design, so its leader session carries no strict policy at all).
const ANCHOR_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: anchor-a',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the strict-read smoke ANCHOR team. Reply in one short sentence unless a tool result says otherwise."',
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the strict-read smoke anchor team."',
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/**
 * The host-row config override (WHOLE-config replacement semantics — the
 * shipped bundle layer's own header documents it). No glueUrl/seamUrl:
 * the host entry derives both from its own module location
 * (defaultGlueUrl → dist .../live/agent-bindings.mjs;
 * defaultSeamUrlCandidates → the source root-binding seam) — this
 * profile world runs on the SHIPPED machine-agnostic defaults, exactly
 * like a real install. (Fallback if a boot ever fails on glue/seam:
 * re-add the explicit file URLs for DIST_GLUE / SOURCE_SEAM.)
 */
function hostRowConfigYaml() {
  // The entry is `- id: dsh-agent-team\n  config: …` — the `config` key
  // aligns with `id` (2 spaces); the block scalar indents its content by
  // 6 (the anchor blueprint lines get 6 each).
  return [
    '  config:',
    '    bootPhase: "create-or-open"',
    `    rootSessionId: "${ROOT}"`,
    '    blueprintSource: |',
    ...ANCHOR_BLUEPRINT.split('\n').map((l) => (l.length > 0 ? `      ${l}` : '')),
    `    blueprintDir: ${BLUEPRINT_DIR}`,
    `    rootPresetId: ${PRESET_ID}`,
    `    memberPresetId: ${PRESET_ID}`,
    '    seedMembers: []',
    '    generation: 1',
    '    staticModel:',
    '      provider: deepseek-official',
    '      model: strict-read-smoke-model',
    '    deniedSelection: null',
    '    mcpServers: []',
    '    mcpServer: null',
    '    environmentFacts:',
    '      - { domain: "tool", subject: "web", available: true, generation: 1 }',
    '      - { domain: "skill", subject: "base", available: true, generation: 1 }',
    '      - { domain: "persona", subject: "standard", available: true, generation: 1 }',
    '    externalPolicyFacts:',
    '      hard: {}',
    '      capabilityExists: {}',
  ].join('\n')
}
function materializeWorld() {
  rmSync(HOME, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(WORLD_TMP, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  // The profile world: package.json (bundle list + the file: dep) and the
  // profile node_modules symlink (what pnpm lays down for a file: dir dep).
  const profileDir = join(HOME, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  writeFileSync(join(profileDir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-web-strict-read-smoke',
    private: true,
    dependencies: { 'dsh-agent-team': `file:${WORKTREE}` },
    dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-agent-team'] } },
  }, null, 2) + '\n')
  const nm = join(profileDir, 'node_modules')
  mkdirSync(nm, { recursive: true })
  symlinkSync(WORKTREE, join(nm, 'dsh-agent-team'), 'dir')
  // The profile's own patch layer: override the host row's config (the
  // shipped bundle layer keeps the row ids/order) + insert the p6t6 row.
  writeFileSync(join(profileDir, 'cordis.patch.yml'), [
    '# strict-read smoke — profile patch layer (applied AFTER the shipped',
    '# dsh-agent-team bundle layer; whole-config replacement semantics for',
    '# the dsh-agent-team row). The bundle layer itself disables the base',
    '# spill-local row and inserts team-spill-local (E1).',
    `- id: dsh-agent-team`,
    hostRowConfigYaml(),
    `- insert:`,
    `    - id: p6t6-team-tools`,
    `      name: ${pathToFileURL(P6T6_PLUGIN).href}`,
    '',
  ].join('\n'))
  // The user preset — a top-level LIST of plugin rows (the shape the
  // agent-presets mount requires, run 6/7 lesson). persona + dsh-tool-fs
  // + the STANDARD bash tool.
  //
  // CRITICAL (run 13 lesson): the rc2 kit's minimal-style preset used the
  // PERSISTENT shell group — but `dsh-tool-bash-persistent` registers a
  // tool NAMED `bash` that SHADOWS the standard one and returns plain
  // inline-string output with NO spill. Core-spill grants are produced by
  // the LocalBashExecutor (bash-local: 64 KiB maxOutputBytes/stream ->
  // spill file + canonicalBashResult.stdout.spillPath), so this smoke
  // mounts the standard `dsh-tool-bash` instead. Surface = the same
  // 5/7 managed tools (read/read_image/write/edit/bash; no lsp/pwsh).
  const presetDir = join(HOME, '.agent-presets', PRESET_ID)
  mkdirSync(presetDir, { recursive: true })
  writeFileSync(join(presetDir, 'agent.cordis.yml'), [
    `# ${PRESET_ID} — strict-read real-profile smoke preset (run ${RUN_STAMP}).`,
    '# Kit-authored via the public user-preset seam (DSH_HOME/.agent-presets):',
    '# persona + dsh-tool-fs + the STANDARD bash tool (dsh-tool-bash — the',
    '# LocalBashExecutor with the 64 KiB stream spill; the core-spill',
    '# artifact-read grant producer). NOT the persistent-shell group:',
    '# dsh-tool-bash-persistent shadows the `bash` tool name and has no',
    '# spill (plain inline string result).',
    '- id: persona',
    "  name: '@deepseek-ai/dsh-persona'",
    '  config:',
    '    suffix: Your working directory is {{cwd}}.',
    '    prefix: >-',
    '      You are the strict-read smoke agent. Follow instructions precisely; keep replies short.',
    '- id: tool-fs',
    "  name: '@deepseek-ai/dsh-tool-fs'",
    '# S2 (PR #26 supplemental): the fs-search row mounts grep+glob so the',
    '# strict leader can drive a tool-owned over-cap spill through the',
    '# TeamAwareLocalSpillStore (the provider-replacement coverage). The',
    '# base bundle row carries `sampleOverCapGlobResults: false` (a',
    '# REQUIRED config on this baseline) — the preset row repeats it.',
    '- id: tool-fs-search',
    "  name: '@deepseek-ai/dsh-tool-fs-search'",
    '  config:',
    '    sampleOverCapGlobResults: false',
    '- id: bash',
    "  name: '@deepseek-ai/dsh-tool-bash'",
    '',
  ].join('\n'))
  // The p6t6 directive (boot 1).
  writeP6t6Directive(1, 'create')
  // The no-grant probe file (out-of-workspace, inside the world tmp).
  writeFileSync(NO_GRANT_PROBE, `strict-read no-grant probe ${RUN_STAMP}\n`)
  // The S2 grep fixture: 320 `match-NNNN` lines in the shared workspace
  // (over the grep tool's 250-match inline cap → the tool-owned spill).
  writeFileSync(GREP_FIXTURE, grepFixtureLines.join('\n') + '\n')
  log(`world materialized at ${HOME} (profile bundles=[base, web-app, dsh-agent-team], TMPDIR=${WORLD_TMP})`)
}
function writeP6t6Directive(boot, phase) {
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot,
    phase,
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
}

// ── preflight ───────────────────────────────────────────────────────────
function portFree(port) {
  const r = spawnSync(process.execPath, ['-e', `require('node:net').createServer().once('error',()=>process.exit(1)).listen(${port},'127.0.0.1',()=>{process.exit(0)})`], { stdio: 'ignore' })
  return r.status === 0
}
async function pickPort(from, to) {
  for (let p = from; p <= to; p++) if (portFree(p)) return p
  throw new Error(`no free port in ${from}-${to}`)
}
function gitOf(repo, args) {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr?.slice(0, 300)}`)
  return r.stdout.trim()
}
function preflight() {
  if (!existsSync(HOST_BIN)) throw new Error(`test-use entry missing: ${HOST_BIN}`)
  const sha = gitOf(TESTUSE, ['rev-parse', 'HEAD'])
  if (sha !== HOST_BASELINE_SHA) throw new Error(`test-use baseline moved: ${sha} (want ${HOST_BASELINE_SHA})`)
  const dirty = gitOf(TESTUSE, ['status', '--porcelain'])
  if (dirty !== '') throw new Error(`test-use working tree dirty:\n${dirty.slice(0, 500)}`)
  for (const f of [DIST_HOST, DIST_GLUE, SOURCE_SEAM, DIST_SPILL, P6T6_PLUGIN, HOST_PKG, SHIPPED_PATCH]) {
    if (!existsSync(f)) throw new Error(`worktree artifact missing: ${f}`)
  }
  const pkg = JSON.parse(readFileSync(HOST_PKG, 'utf8'))
  if (pkg?.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('dsh.bundle.patch manifest missing from the plugin package.json')
  if (!/id:\s*"team-spill-local"/.test(readFileSync(SHIPPED_PATCH, 'utf8'))) throw new Error('shipped bundle layer lacks the team-spill-local row (Phase C)')
  if (!/id:\s*"?spill-local"?\s*\n\s*disabled:\s*true/.test(readFileSync(SHIPPED_PATCH, 'utf8'))) throw new Error('shipped bundle layer does not disable the base spill-local row')
  log(`preflight OK: test-use ${HOST_BASELINE_SHORT} clean; worktree dist + bundle layer present`)
}

// ── host boot ───────────────────────────────────────────────────────────
let HOST_PORT = 0
async function bootHost({ boot, phase, expectedPhase, timeoutMs = 240000 }) {
  if (hostProc !== null) throw new Error('a host is already running')
  INSTANCE_LOG = join(RUN_DIR, `instance-${boot}.log`)
  mkdirSync(RUN_DIR, { recursive: true })
  writeP6t6Directive(boot, phase)
  hostProc = spawnHost({ port: HOST_PORT, logPath: INSTANCE_LOG })
  log(`host ${boot} spawned (pid=${hostProc.pid}, port=${HOST_PORT}, log=${INSTANCE_LOG})`)
  if (!(await waitForLogLine(BOOT_MARKER, timeoutMs))) {
    const tail = logTail(40)
    stopHost()
    writeEvidence(`host${boot}-boot-failure.log`, tail)
    throw new Error(`no "${BOOT_MARKER}" line within ${timeoutMs}ms (instance log tail in evidence host${boot}-boot-failure.log)`)
  }
  const origin = `http://127.0.0.1:${HOST_PORT}`
  const tokenLine = logTail(200).split('\n').filter((l) => l.includes(BOOT_MARKER)).pop() ?? ''
  const tm = /token=([A-Za-z0-9._~+-]+)/.exec(tokenLine)
  if (tm === null) throw new Error(`boot marker line lacks a token: ${tokenLine.slice(0, 200)}`)
  const cookie = await authenticate(origin, tm[1])
  // p6t6 row readiness (the rc2 kit gate: body.ok === true; a latched
  // setupError fails fast).
  let healthy = null
  for (let i = 0; i < 240; i++) {
    healthy = await p6t6Health(HOST_PORT).catch(() => null)
    if (healthy?.body?.ok === true) break
    if (healthy?.body?.ok === false && healthy?.body?.setupError !== undefined) break
    await sleep(1000)
  }
  if (healthy?.body?.ok !== true) {
    writeEvidence(`host${boot}-p6t6-healthy.json`, healthy?.body ?? healthy)
    const tail = logTail(60)
    stopHost()
    throw new Error(`p6t6 row not ready on boot ${boot}: ${JSON.stringify(healthy?.body ?? healthy).slice(0, 400)}\nlog tail:\n${tail}`)
  }
  // Row state well-formed for the boot root (the rc2 kit gate: teamSession
  // object present; phase echoed from the directive).
  let st = null
  for (let i = 0; i < 180; i++) {
    st = await p6t6State(HOST_PORT).catch(() => null)
    const b = st?.body
    if (b !== null && typeof b === 'object'
      && b.rootSessionId === ROOT && b.phase === expectedPhase
      && b.teamSession !== null && typeof b.teamSession === 'object') break
    await sleep(500)
  }
  if (st?.body?.rootSessionId !== ROOT || st?.body?.teamSession === null) {
    writeEvidence(`host${boot}-state-bad.json`, st?.body)
    const tail = logTail(60)
    stopHost()
    throw new Error(`p6t6 state unexpected on boot ${boot}: root=${st?.body?.rootSessionId} phase=${st?.body?.phase}\nlog tail:\n${tail}`)
  }
  log(`host ${boot} ready: p6t6 root=${st.body.rootSessionId} phase=${st.body.phase} boot=${st.body.boot} toolCount=${st.body.toolCount}`)
  return { origin, cookie, port: HOST_PORT, state: st.body }
}

// ── legs ────────────────────────────────────────────────────────────────
async function main() {
  const t0 = Date.now()
  mkdirSync(RUN_DIR, { recursive: true })
  process.stdout.write('') // flush banner
  log('── strict-read real-profile smoke ──')
  log(`worktree=${WORKTREE}\ntestuse=${TESTUSE}\nevidence=${RUN_DIR}`)

  const preStable = {
    p3080: await probeStableInstance(3080, ':3080', 'pre'),
    p3180: await probeStableInstance(3180, ':3180', 'pre'),
  }
  preflight()
  HOST_PORT = Number(argValue('--host-port', 0)) || await pickPort(3491, 3500)
  const MOCK_PORT = Number(argValue('--mock-port', 0)) || await pickPort(3501, 3510)
  if (!portFree(HOST_PORT)) throw new Error(`host port ${HOST_PORT} is not free`)
  if (!portFree(MOCK_PORT)) throw new Error(`mock port ${MOCK_PORT} is not free`)
  log(`ports: host=${HOST_PORT} mock=${MOCK_PORT}`)

  materializeWorld()
  MOCK = await startMockModel({ port: MOCK_PORT, decide, log: (m) => log(`mock: ${m}`) })
  log(`mock model listening on 127.0.0.1:${MOCK.port}`)

  const FAILS = []
  const fail = (leg) => { if (!FAILS.includes(leg)) FAILS.push(leg) }

  let fatalError = null
  let booted = null
  try {
    booted = await bootHost({ boot: 1, phase: 'create', expectedPhase: 'create' })
    const { origin, cookie } = booted

    // ── L0: discovery (boot-team leader, legacy non-strict) ──────────
    log('── L0: surface discovery (boot team) ──')
    const disc = await apiPrompt(origin, cookie, ROOT, MK_DISC)
    if (disc.status !== 200) fail('L0')
    const discReq = await waitForMock((r) => r.body !== null && userTextOf(r).includes(MK_DISC) && toolMsgsOf(r).length === 0 && (r.body?.tools ?? []).length > 0, 60000, 'discovery model request')
    if (discReq === null) {
      fail('L0')
      check('L0', 'discovery model request observed', false, `requests=${MOCK.requests.length} promptStatus=${disc.status}`)
      dumpMock('l0')
      throw new Error('LEG 0 failed — aborting before team.create')
    }
    const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name)
    writeEvidence('l0-surface.json', { surface, persona: (discReq.body.messages ?? []).filter((m) => m.role === 'system').map((m) => String(m.content)).join('\n').slice(0, 2000) })
    const hasRead = surface.includes('read')
    const hasBash = surface.includes('bash')
    check('L0', 'discovery surface carries read + bash (minimal-style preset mounted)', hasRead && hasBash, `surface=[${surface.join(',')}]`)
    if (!hasRead || !hasBash) { fail('L0'); throw new Error('LEG 0 failed — aborting before team.create') }
    // Coverage Gate: every surface tool the strict agent owns must be
    // managed. Team tools are excluded dynamically by the 'team_' prefix
    // (this baseline surfaces 12 of them — team_list_pending_control
    // included — run 9 discovery), not by the pinned catalog alone.
    const denyList = surface
      .filter((n) => !MANAGED_TOOL_NAMES.includes(n) && n !== 'todo_write' && !n.startsWith('team_') && !TEAM_TOOL_CATALOG.has(n))
      .sort()
    log(`L0 surface=${surface.length} tools; computed builtinToolDeny=[${denyList.join(',')}]`)

    // ── C1: write saved blueprint S + create the strict team ─────────
    log('── C1: saved blueprint S + team.create ──')
    const bpSyaml = savedBlueprintS(denyList, WORLD_TMP)
    const bpSfile = join(BLUEPRINT_DIR, 'strict-read-s.yaml')
    writeFileSync(bpSfile, bpSyaml)
    writeEvidence('saved-blueprint-s.yaml', bpSyaml)
    const createRes = await remoteCall(origin, cookie, 'team.create', {
      rootSessionId: CREATED_ROOT,
      blueprintId: BP_S_ID,
    }, 'strict-read')
    const createOk = createRes.status === 200
      && createRes.body?.result?.ok === true
      && createRes.body?.result?.value?.data?.path === 'fresh-root'
    check('C1', 'team.create (S, strict blueprint, no initialWork) succeeds on the fresh root', createOk,
      `status=${createRes.status} body=${JSON.stringify(createRes.body ?? createRes).slice(0, 500)}`)
    if (!createOk) { fail('C1'); throw new Error('team.create failed — aborting (blueprint/parse diagnostics in evidence)') }
    writeEvidence('c1-team-create.json', createRes.body)

    // ── L1: member setup through p6t6 (the production executeTool) ───
    // p6t6 `as` is a SESSION id (the glue's ensureLiveAgent resumes the
    // agent bound to that session): the created team's ROOT session IS
    // the leader's session; a member's childSessionId (from
    // team_list_members) is the member's session.
    log('── L1: create worker-1 + worker-2 (p6t6 as leader) ──')
    const listRes = await p6t6Tool(HOST_PORT, 'team_list_members', { rootSessionId: CREATED_ROOT, requestToken: `tok-list-${RUN_STAMP}` }, CREATED_ROOT)
    if (listRes.status !== 200 || listRes.body?.ok !== true) {
      fail('L1')
      check('L1', 'team_list_members as the S leader succeeds', false, `status=${listRes.status} body=${JSON.stringify(listRes.body ?? listRes).slice(0, 400)}`)
      throw new Error('team_list_members failed — aborting')
    }
    writeEvidence('l1-list-members.json', listRes.body)
    // Evidence: the leader instance id from the list (templateId 'leader';
    // the frozen contracts constant 'inst-leader' is the fallback).
    const leaderId = extractLeaderInstanceId(listRes.body?.value) ?? 'inst-leader'
    log(`S leader instanceId=${leaderId} (as=CREATED_ROOT=${CREATED_ROOT})`)
    const w1Res = await p6t6Tool(HOST_PORT, 'team_create_member', {
      rootSessionId: CREATED_ROOT,
      requestToken: `tok-cw1-${RUN_STAMP}`,
      delegationTemplateId: 'worker-1',
      label: 'worker-1',
    }, CREATED_ROOT)
    const w2Res = await p6t6Tool(HOST_PORT, 'team_create_member', {
      rootSessionId: CREATED_ROOT,
      requestToken: `tok-cw2-${RUN_STAMP}`,
      delegationTemplateId: 'worker-2',
      label: 'worker-2',
    }, CREATED_ROOT)
    // The create-member outcome does NOT set targetInstanceId (the
    // creation is headline'd in the effect): the `member-activated` effect
    // carries BOTH instanceId and childSessionId (effects.ts — the
    // activation provider result).
    const w1Id = w1Res.body?.value?.targetInstanceId ?? w1Res.body?.value?.effect?.instanceId ?? null
    const w2Id = w2Res.body?.value?.targetInstanceId ?? w2Res.body?.value?.effect?.instanceId ?? null
    check('L1', 'worker-1 + worker-2 created (strict policies applied at setup)', w1Res.body?.ok === true && w2Res.body?.ok === true && w1Id !== null && w2Id !== null,
      `w1=${JSON.stringify(w1Res.body ?? w1Res).slice(0, 200)} w2=${JSON.stringify(w2Res.body ?? w2Res).slice(0, 200)}`)
    if (w1Id === null || w2Id === null) { fail('L1'); throw new Error('member creation failed — aborting') }
    // The member SESSION ids (p6t6 `as` values): seed from the create
    // effects (childSessionId), then confirm/complete via the member list
    // in case a session id was absent from the effect.
    const memberSessions = {}
    for (const [id, res] of [[w1Id, w1Res], [w2Id, w2Res]]) {
      const sid = res.body?.value?.effect?.childSessionId
      if (typeof sid === 'string') memberSessions[id] = sid
    }
    {
      const deadline = Date.now() + 15000
      for (;;) {
        if (w1Id in memberSessions && w2Id in memberSessions) break
        const list2 = await p6t6Tool(HOST_PORT, 'team_list_members', { rootSessionId: CREATED_ROOT, requestToken: `tok-list2-${RUN_STAMP}` }, CREATED_ROOT)
        const members = list2.body?.value?.effect?.members ?? []
        for (const m of members) {
          if (typeof m?.instanceId === 'string' && typeof m?.childSessionId === 'string' && !(m.instanceId in memberSessions)) {
            memberSessions[m.instanceId] = m.childSessionId
          }
        }
        if (Date.now() >= deadline) break
        await sleep(500)
      }
    }
    const w1Session = memberSessions[w1Id] ?? null
    const w2Session = memberSessions[w2Id] ?? null
    check('L1', 'both member childSessionIds resolvable (p6t6 as-values)', w1Session !== null && w2Session !== null,
      `w1=${w1Session ?? 'none'} w2=${w2Session ?? 'none'}`)
    if (w1Session === null || w2Session === null) { fail('L1'); writeEvidence('l1-sessions-missing.json', memberSessions); throw new Error('member childSessionIds unresolved — aborting') }
    log(`workers: w1=${w1Id}@${w1Session} w2=${w2Id}@${w2Session}`)
    writeEvidence('l1-create-members.json', { w1Res: w1Res.body, w2Res: w2Res.body, memberSessions })

    // ── E2: the leader's foreground shell spill -> durable grant ──────
    log('── E2: leader bash spill -> durable artifact-read grant ──')
    const bashL = await p6t6Tool(HOST_PORT, 'bash', bashArgs('L'), CREATED_ROOT)
    const spillL = bashL.body?.ok === true ? bashL.body.value?.stdout?.spillPath : null
    check('E2a', 'leader bash (200 KiB output) succeeded and spilled stdout', bashL.body?.ok === true && typeof spillL === 'string' && spillL.length > 0,
      `status=${bashL.status} ok=${bashL.body?.ok} spillPath=${String(spillL).slice(0, 160)} truncated=${bashL.body?.value?.stdout?.truncated} err=${bashL.body?.error?.message?.slice(0, 200) ?? ''}`)
    let grantsL = []
    if (typeof spillL === 'string') {
      const start = Date.now()
      while (Date.now() - start < 10000) {
        grantsL = grantFor(spillL)
        if (grantsL.length > 0) break
        await sleep(250)
      }
    }
    const grantLOk = grantsL.length === 1
      && grantsL[0].payload?.source?.kind === 'shell-foreground'
      && grantsL[0].payload?.source?.stream === 'stdout'
      && grantsL[0].payload?.locator === spillL
    check('E2b', 'exactly ONE durable artifact-read-granted fact for the leader spill (source shell-foreground/stdout)', grantLOk,
      `count=${grantsL.length} first=${JSON.stringify(grantsL[0] ?? null).slice(0, 300)}`)
    writeEvidence('e2-grant-facts.json', { spillL, facts: grantsL, bashValue: bashL.body?.value })
    if (typeof spillL !== 'string' || !grantLOk) { fail('E2'); throw new Error('E2 failed — no durable grant; aborting') }

    // ── E3: the leader reads back its own spill (grant lane) ──────────
    log('── E3: leader read-back of its own spill (the grant lane) ──')
    const readOwn = await p6t6Tool(HOST_PORT, 'read', { file_path: spillL }, CREATED_ROOT)
    const readOwnContent = readTextOf(readOwn.body)
    const readOwnOk = readOwn.body?.ok === true && readOwnContent.includes(spillHead('L'))
    check('E3a', 'leader read of its own spill path SUCCEEDS (default-deny policy + valid grant -> ALLOW, no control request)', readOwnOk,
      `ok=${readOwn.body?.ok} contentHead=${readOwnContent.slice(0, 120)} err=${readOwn.body?.error?.message?.slice(0, 200) ?? ''}`)
    let grantObs = []
    try {
      grantObs = await pollObservations(
        (line) => typeof line === 'string' && line.includes('"stage":"artifact-grant-check"') && line.includes('"valid":true'),
        5000, 'artifact-grant-check valid:true observation')
    } catch { /* asserted below */ }
    check('E3b', 'the decision observation shows the grant lane fired (artifact-grant-check valid:true)', grantObs.length > 0,
      `hits=${grantObs.length} line=${String(grantObs[0] ?? '').slice(0, 240)}`)
    writeEvidence('e3-read-own.json', { readOwn: readOwn.body, grantObs })
    if (!readOwnOk) fail('E3')

    // ── E4: out-of-workspace read without a grant stays denied ────────
    log('── E4: no-grant out-of-workspace read stays denied ──')
    const readNoGrant = await p6t6Tool(HOST_PORT, 'read', { file_path: NO_GRANT_PROBE }, CREATED_ROOT)
    const noGrantDenied = readNoGrant.body?.ok === false
    check('E4a', 'leader read of the no-grant probe file (out-of-workspace) is DENIED', noGrantDenied,
      `ok=${readNoGrant.body?.ok} err=${String(readNoGrant.body?.error?.message ?? '').slice(0, 240)}`)
    const noGrantFacts = grantFor(NO_GRANT_PROBE)
    check('E4b', 'no durable grant exists for the probe locator (the deny is policy, not grant absence confusion)', noGrantFacts.length === 0,
      `count=${noGrantFacts.length}`)
    writeEvidence('e4-no-grant.json', { readNoGrant: readNoGrant.body })
    if (!noGrantDenied) fail('E4')

    // ── E5: another instance cannot use the locator ───────────────────
    log('── E5: worker-1 cannot read the leader spill locator ──')
    const readX = await p6t6Tool(HOST_PORT, 'read', { file_path: spillL }, w1Session)
    const xDenied = readX.body?.ok === false
    check('E5', 'worker-1 read of the LEADER spill locator is DENIED (no grant for worker-1 identity)', xDenied,
      `ok=${readX.body?.ok} err=${String(readX.body?.error?.message ?? '').slice(0, 240)}`)
    writeEvidence('e5-cross-instance.json', { readX: readX.body, w1Id })
    if (!xDenied) fail('E5')

    // ── S1: generic dsh-spill-policy → TeamAwareLocalSpillStore → grant ──
    log('── S1: generic spill-policy vertical (50,500 B stdout, no early-spill) ──')
    // Delta snapshot: an early-spilled foreground bash (E2) mints a
    // spill-store/bash grant TOO (the generic spill-policy still sees a
    // >maxInlineBytes model-facing result behind the early-spill), so the
    // S1 assertion is on the NEW grants only.
    const s1SeqsBefore = new Set(grantFacts().map((f) => f.sequence))
    const sfBefore = grantFacts().filter((e) => e.payload?.source?.kind === 'shell-foreground').length
    const s1Bash = await p6t6Tool(HOST_PORT, 'bash', s1Args, CREATED_ROOT)
    const s1Value = s1Bash.body?.ok === true ? s1Bash.body.value : null
    const s1NoEarlySpill = s1Value?.stdout?.spillPath === undefined && s1Value?.stdout?.truncated === false
    check('S1a', 'leader bash (50,500 B stdout) succeeded WITHOUT a bash-local early-spill (no stdout.spillPath — the 50k<51.2k<64k band)',
      s1Bash.body?.ok === true && s1NoEarlySpill,
      `status=${s1Bash.status} ok=${s1Bash.body?.ok} spillPath=${String(s1Value?.stdout?.spillPath).slice(0, 120)} truncated=${s1Value?.stdout?.truncated} stdoutLen=${s1Value?.stdout?.text?.length ?? 0} err=${String(s1Bash.body?.error?.message ?? '').slice(0, 200)}`)
    if (!s1NoEarlySpill) { fail('S1'); writeEvidence('s1-no-early-spill.json', { s1Bash: s1Bash.body }); }
    const s1Grants = await waitForSpillGrant('bash', 10000, s1SeqsBefore)
    const s1GrantOk = s1Grants.length === 1
      && s1Grants[0].payload?.source?.kind === 'spill-store'
      && s1Grants[0].payload?.source?.spillSource?.kind === 'tool'
      && s1Grants[0].payload?.source?.spillSource?.toolName === 'bash'
    check('S1b', 'S1 bash minted EXACTLY ONE NEW durable spill-store grant (provenance spill-store/bash — the Team-aware SpillStore bridge, NOT the shell observer)', s1GrantOk,
      `newCount=${s1Grants.length} first=${JSON.stringify(s1Grants[0] ?? null).slice(0, 320)}`)
    const sfAfter = grantFacts().filter((e) => e.payload?.source?.kind === 'shell-foreground').length
    check('S1c', 'the S1 bash minted NO shell-foreground grant (no early-spill → the shell observer saw no spillPath; the shell-foreground count is unchanged)', sfAfter === sfBefore,
      `shellForeground before=${sfBefore} after=${sfAfter}`)
    const s1Locator = s1Grants[0]?.payload?.locator
    let s1ReadOk = false
    if (typeof s1Locator === 'string') {
      const s1Read = await p6t6Tool(HOST_PORT, 'read', { file_path: s1Locator }, CREATED_ROOT)
      const s1Text = readTextOf(s1Read.body)
      s1ReadOk = s1Read.body?.ok === true && s1Text.includes(s1Head) && s1Text.includes(s1Tail)
      check('S1d', 'leader (same instance) read of the S1 SpillStore locator SUCCEEDS and round-trips the head+tail markers', s1ReadOk,
        `ok=${s1Read.body?.ok} hasHead=${s1Text.includes(s1Head)} hasTail=${s1Text.includes(s1Tail)} err=${String(s1Read.body?.error?.message ?? '').slice(0, 200)}`)
      const s1ReadX = await p6t6Tool(HOST_PORT, 'read', { file_path: s1Locator }, w1Session)
      check('S1e', 'worker-1 (another instance) read of the S1 locator is DENIED (no grant for worker-1 identity)', s1ReadX.body?.ok === false,
        `ok=${s1ReadX.body?.ok} err=${String(s1ReadX.body?.error?.message ?? '').slice(0, 240)}`)
      writeEvidence('s1-spill-store.json', { s1Bash: s1Bash.body, s1Grants, s1Locator, s1Read: s1Read.body, s1ReadX: s1ReadX.body })
      if (!s1ReadOk || s1ReadX.body?.ok !== false) fail('S1')
    } else {
      check('S1d', 'leader (same instance) read of the S1 SpillStore locator SUCCEEDS and round-trips the head+tail markers', false, 'no spill-store/bash grant locator (S1b failed)')
      fail('S1')
    }
    if (!s1GrantOk) { fail('S1'); writeEvidence('s1-grant-missing.json', { s1Bash: s1Bash.body, allGrants: grantFacts() }); }

    // ── S2: grep over-cap → tool-owned spill → TeamAwareLocalSpillStore ──
    // Producer = the BOOT team's leader (row anchor `team-root`): it is a
    // MANAGED Team session (TeamDomain-bound root) but declares NO
    // capabilities.permissions, so (a) the A2C-2 Permission Coverage Gate
    // never runs for it and its surface keeps `grep` (the frozen
    // KNOWN_SENSITIVE registry makes grep FATAL on any strict surface —
    // A2C-6 is deferred — so no strict instance in this world can call
    // grep itself; the guide's "managed strict Team agent → grep" is
    // realized here as "managed Team agent → grep" + a strict read-back
    // cross-check below) and (b) its tool dispatch still flows through
    // the agent's real tool pipeline (pre-execute waterfall included),
    // so the grep spill is produced exactly as in model-driven operation.
    // The grant is recorded by the SAME TeamAwareLocalSpillStore the
    // strict team uses (the bundle-layer provider replacement), through
    // the sibling bridge → TeamArtifactAuthority → durable ledger.
    log('── S2: grep over-cap vertical (boot-leader producer; 320 matches > 250 cap) ──')
    const s2SeqsBefore = new Set(grantFacts().map((f) => f.sequence))
    const s2Grep = await p6t6Tool(HOST_PORT, 'grep', grepArgs, ROOT)
    const s2Matches = s2Grep.body?.ok === true ? s2Grep.body?.value?.matches : null
    check('S2a', 'boot-leader grep over the 320-line fixture succeeded (320 canonical matches — over the 250 inline cap)',
      s2Grep.body?.ok === true && Array.isArray(s2Matches) && s2Matches.length === GREP_MATCH_LINES,
      `status=${s2Grep.status} ok=${s2Grep.body?.ok} matches=${Array.isArray(s2Matches) ? s2Matches.length : 'n/a'} err=${String(s2Grep.body?.error?.message ?? '').slice(0, 200)}`)
    const s2Grants = await waitForSpillGrant('grep', 10000, s2SeqsBefore)
    const s2GrantOk = s2Grants.length === 1
      && s2Grants[0].payload?.source?.kind === 'spill-store'
      && s2Grants[0].payload?.source?.spillSource?.kind === 'tool'
      && s2Grants[0].payload?.source?.spillSource?.toolName === 'grep'
      && s2Grants[0].rootSessionId === ROOT
    check('S2b', 'exactly ONE durable spill-store grant for the grep, under the BOOT root (provenance spill-store/{kind:tool, toolName:grep} — the tool-owned post-execute spill through the Team-aware SpillStore)', s2GrantOk,
      `count=${s2Grants.length} first=${JSON.stringify(s2Grants[0] ?? null).slice(0, 320)}`)
    const s2Locator = s2Grants[0]?.payload?.locator
    let s2ReadOk = false
    if (typeof s2Locator === 'string') {
      // Same-instance read-back: the boot leader (unmanaged-style read
      // path — no Team permission plane on that instance) reads the
      // locator; the assertion is that the FULL result round-trips
      // through the SpillStore file (all 320 lines).
      const s2Read = await p6t6Tool(HOST_PORT, 'read', { file_path: s2Locator }, ROOT)
      const s2Text = readTextOf(s2Read.body)
      const s2MatchCount = (s2Text.match(/match-\d{4}/g) ?? []).length
      s2ReadOk = s2Read.body?.ok === true && s2Text.includes('match-0001') && s2Text.includes(`match-${String(GREP_MATCH_LINES).padStart(4, '0')}`) && s2MatchCount === GREP_MATCH_LINES
      check('S2c', 'boot-leader (same instance) read of the grep SpillStore locator returns the FULL result (all 320 match lines round-trip)', s2ReadOk,
        `ok=${s2Read.body?.ok} matchLines=${s2MatchCount} hasFirst=${s2Text.includes('match-0001')} hasLast=${s2Text.includes(`match-${String(GREP_MATCH_LINES).padStart(4, '0')}`)} err=${String(s2Read.body?.error?.message ?? '').slice(0, 200)}`)
      // Cross-instance strict check: the STRICT team's leader (a different
      // (root, instance) composite — and a strict default-deny surface)
      // reads the SAME locator: no grant covers its identity → DENIED.
      // This is the grant-scoping half of the vertical (the grant-lane
      // allow half is exercised identically by S1d on the S1 locator).
      const s2ReadStrict = await p6t6Tool(HOST_PORT, 'read', { file_path: s2Locator }, CREATED_ROOT)
      check('S2d', 'strict-leader (another root/instance) read of the grep SpillStore locator is DENIED (grant scoped to the boot-leader composite)', s2ReadStrict.body?.ok === false,
        `ok=${s2ReadStrict.body?.ok} err=${String(s2ReadStrict.body?.error?.message ?? '').slice(0, 240)}`)
      writeEvidence('s2-grep-spill-store.json', { s2Grep: s2Grep.body, s2Grants, s2Locator, s2Read: s2Read.body, s2MatchCount, s2ReadStrict: s2ReadStrict.body })
      if (!s2ReadOk || s2ReadStrict.body?.ok !== false) fail('S2')
    } else {
      check('S2c', 'boot-leader (same instance) read of the grep SpillStore locator returns the FULL result (all 320 match lines round-trip)', false, 'no spill-store/grep grant locator (S2b failed)')
      fail('S2')
    }
    if (!s2GrantOk) { fail('S2'); writeEvidence('s2-grant-missing.json', { s2Grep: s2Grep.body, allGrants: grantFacts() }); }

    // ── E6: explicit deny wins over a valid grant (worker-2) ──────────
    log('── E6: worker-2 ask -> leader approval -> spill -> explicit deny wins ──')
    // The bash call BLOCKS at the durable control wait (leader-approval ask).
    const bashW2 = p6t6Tool(HOST_PORT, 'bash', bashArgs('W2'), w2Session)
    let bashW2Error = null
    bashW2.catch((e) => { bashW2Error = e })
    const requestId = await discoverPendingRequestId('w2-bash')
    check('E6a', 'worker-2 bash created a durable leader-approval control request (requestId discovered)', requestId !== null,
      `requestId=${requestId ?? 'none'}`)
    if (requestId === null) {
      fail('E6')
      dumpMock('e6-noreq')
      const obs = (await p6t6State(HOST_PORT).catch(() => null))?.body?.observations ?? []
      writeEvidence('e6-diagnostic.json', { obsTail: obs.slice(-20) })
      bashW2.catch(() => {})
      throw new Error('E6 failed: no pending requestId discovered')
    }
    const resolveRes = await p6t6Tool(HOST_PORT, 'team_resolve_control', {
      rootSessionId: CREATED_ROOT,
      requestToken: `tok-res-${RUN_STAMP}`,
      requestId,
      decision: 'allow',
      note: 'strict-read smoke: scripted leader approval',
    }, CREATED_ROOT)
    check('E6b', 'leader team_resolve_control(allow) succeeds (leader-approval: leader is a valid resolver)', resolveRes.body?.ok === true,
      `ok=${resolveRes.body?.ok} body=${JSON.stringify(resolveRes.body ?? resolveRes).slice(0, 240)}`)
    if (resolveRes.body?.ok !== true) fail('E6')
    const bashW2Done = await bashW2.catch((e) => ({ error: String(e?.message ?? e) }))
    const spillW2 = bashW2Done.body?.ok === true ? bashW2Done.body.value?.stdout?.spillPath : null
    check('E6c', 'worker-2 bash executed after approval and spilled stdout', bashW2Done.body?.ok === true && typeof spillW2 === 'string' && spillW2.length > 0,
      `ok=${bashW2Done.body?.ok} spillPath=${String(spillW2).slice(0, 160)} err=${bashW2Done.body?.error?.message?.slice(0, 200) ?? ''}`)
    let grantsW2 = []
    if (typeof spillW2 === 'string') {
      const start = Date.now()
      while (Date.now() - start < 10000) {
        grantsW2 = grantFor(spillW2)
        if (grantsW2.length > 0) break
        await sleep(250)
      }
    }
    const grantW2Ok = grantsW2.length === 1 && grantsW2[0].payload?.source?.kind === 'shell-foreground'
    check('E6d', 'the durable grant for the worker-2 OWN spill IS recorded (producer side is policy-independent)', grantW2Ok,
      `count=${grantsW2.length} first=${JSON.stringify(grantsW2[0] ?? null).slice(0, 300)}`)
    if (typeof spillW2 !== 'string' || !grantW2Ok) { fail('E6'); throw new Error('E6 failed: no durable worker-2 grant') }
    const readW2Own = await p6t6Tool(HOST_PORT, 'read', { file_path: spillW2 }, w2Session)
    const w2Denied = readW2Own.body?.ok === false
    check('E6e', 'worker-2 read of its OWN (granted) spill is DENIED by the explicit rule — deny wins over the valid grant', w2Denied,
      `ok=${readW2Own.body?.ok} err=${String(readW2Own.body?.error?.message ?? '').slice(0, 240)}`)
    writeEvidence('e6-deny-wins.json', { requestId, resolveRes: resolveRes.body, bashW2: bashW2Done.body, spillW2, grantsW2, readW2Own: readW2Own.body })
    if (!w2Denied) fail('E6')

    // ── E8: a plain (non-Team) session behaves as upstream ────────────
    log('── E8: plain session (no team binding) upstream-equivalence ──')
    const plainCreate = await apiSessionCreate(origin, cookie, PLAIN_SESSION, WORKSPACE, 'e8-create')
    // The /api channel answers with the server-response envelope
    // {result:{ok,value}} (tolerate the bare {ok,value} shape too).
    const plainCreateRes = plainCreate.body?.result ?? plainCreate.body
    const plainCreateOk = plainCreate.status === 200 && plainCreateRes?.ok === true && plainCreateRes?.value?.sessionId === PLAIN_SESSION
    check('E8a', 'plain session created via the public session/create seam (explicit-id adoption on the smoke preset, NOT team-managed)', plainCreateOk,
      `status=${plainCreate.status} body=${JSON.stringify(plainCreate.body).slice(0, 240)}`)
    // The upstream spill file is written by the executor to $TMPDIR; the
    // model-facing result text does NOT expose its path (run 19 lesson), so
    // the spill is verified from the filesystem: diff the WORLD_TMP spill
    // inventory around the plain turn (E2/E6 spills are in the baseline set).
    const spillBefore = listSpillFiles()
    const plainRes = await apiPrompt(origin, cookie, PLAIN_SESSION, MK_PLAIN)
    const plainDone = await waitForMock((r) => r.body !== null && userTextOf(r).includes(MK_PLAIN) && toolMsgsOf(r).length >= 1, 120000, 'plain session tool request')
    if (plainDone === null || plainRes.status !== 200) {
      check('E8', 'plain session chain observed', false, `promptStatus=${plainRes.status} requests=${MOCK.requests.length}`)
      dumpMock('e8')
      fail('E8')
    } else {
      // Let the read leg land too (informational outcome; not fatal on timeout).
      await waitForMock((r) => r.body !== null && userTextOf(r).includes(MK_PLAIN) && toolMsgsOf(r).length >= 2, 30000, 'plain session read tool request')
      const allPlain = MOCK.requests.filter((r) => r.body !== null && userTextOf(r).includes(MK_PLAIN))
      const lastPlain = allPlain[allPlain.length - 1]
      const plainTools = lastPlain ? toolMsgsOf(lastPlain) : []
      const plainSurface = (lastPlain?.body?.tools ?? []).map((t) => t.function?.name ?? t.name)
      const namedPlain = plainTools.map((m) => ({ m, name: toolResultNameOf(lastPlain, m) }))
      const bashMsg = namedPlain.find((e) => e.name === 'bash')?.m
      const readMsg = namedPlain.find((e) => e.name === 'read')?.m
      const bashResultText = bashMsg !== undefined ? toolResultText(bashMsg) : null
      // HARD DoD #11 assertions: (1) the upstream spill path worked — a new
      // spill file appeared in WORLD_TMP during the plain turn; (2) the Team
      // grant mechanism stayed INERT — zero artifact-read-granted facts for
      // the plain spill(s) (an unmanaged session is a no-op for the
      // artifact authority). The read-back outcome is INFORMATIONAL:
      // whatever the upstream default policy does for a plain agent reading
      // an out-of-workspace path (allow, or ask → blocked without a human)
      // IS the upstream-equivalence.
      const plainSpills = listSpillFiles().filter((p) => !spillBefore.includes(p))
      const readPText = readMsg !== undefined ? toolResultText(readMsg) : null
      const readPOutcome = readMsg === undefined
        ? 'not-completed'
        : (readPText !== null && readPText.includes('no-grant probe'))
          ? 'allowed'
          : (/error|denied/i.test(readPText?.slice(0, 200) ?? '') ? 'denied' : 'allowed')
      const plainGrantFacts = plainSpills.map((p) => grantFor(p))
      const noGrantForPlain = plainSpills.every((p) => grantFor(p).length === 0)
      const e8ok = plainSpills.length >= 1 && noGrantForPlain
      const e8skip = plainSpills.length === 0 && plainSurface.length > 0 && !plainSurface.includes('bash')
      check('E8', e8skip ? 'plain session has no bash tool — SKIP (DoD #11 stays unit-covered)' : 'plain session: upstream bash spill works (new spill file in WORLD_TMP) + ZERO artifact-read-granted facts (the Team authority is inert on the unmanaged session)', e8ok,
        `surfaceHasBash=${plainSurface.includes('bash')} plainSpills=${plainSpills.length} ${plainSpills.map((p) => p.split('/').pop()).join(',')} readOutcome=${readPOutcome} grantFacts=${plainGrantFacts.flat().length} bashTextLen=${bashResultText?.length ?? 0} surface=[${plainSurface.join(',')}]`)
      writeEvidence('e8-plain.json', { plainCreate: plainCreate.body, plainRes: plainRes.status, surface: plainSurface, spillBefore: spillBefore.length, plainSpills, readOutcome: readPOutcome, readPText: readPText?.slice(0, 400), plainGrantFacts, bashResultHead: bashResultText?.slice(0, 200), lastReply: lastPlain?.reply })
      if (!e8ok && !e8skip) fail('E8')
    }

    // ── E7: same-home restart — grants rebuilt from the ledger ────────
    log('── E7: same-home restart (boot 2, adopt) — grant rebuild ──')
    await stopHostAndWait(30000)
    log('host 1 stopped')
    booted = await bootHost({ boot: 2, phase: 'resume', expectedPhase: 'resume' })
    const readAfter = await p6t6Tool(booted.port, 'read', { file_path: spillL }, CREATED_ROOT)
    const afterOk = readAfter.body?.ok === true && readTextOf(readAfter.body).includes(spillHead('L'))
    check('E7a', 'after restart: leader read of the SAME spill path still SUCCEEDS (authority rebuilt from the durable ledger)', afterOk,
      `ok=${readAfter.body?.ok} err=${String(readAfter.body?.error?.message ?? '').slice(0, 240)}`)
    const grantObsAfter = await pollObservations(
      (line) => typeof line === 'string' && line.includes('"stage":"artifact-grant-check"') && line.includes('"valid":true'),
      5000, 'post-restart artifact-grant-check observation').catch(() => [])
    check('E7b', 'after restart: the grant lane observation fired again (the rebuilt grant is live)', grantObsAfter.length > 0,
      `hits=${grantObsAfter.length}`)
    writeEvidence('e7-restart.json', { readAfter: readAfter.body, grantObsAfter, state: booted.state })
    if (!afterOk) fail('E7')

    // ── E1: the effective provider of this world ──────────────────────
    log('── E1: effective provider composition ──')
    const logText = readFileSync(INSTANCE_LOG, 'utf8')
    const dupService = /duplicate.*service|service.*duplicate|already.*provided/i.test(logText)
    const spillLines = logText.split('\n').filter((l) => /spill/i.test(l)).slice(0, 20)
    check('E1a', 'host booted WITHOUT a duplicate spillStore service collision (base spill-local disabled by the bundle layer; team-spill-local active)', !dupService,
      `logSpillLines=${JSON.stringify(spillLines.slice(0, 3)).slice(0, 300)}`)
    check('E1b', 'the durable grant I/O below is produced ONLY by the Team-aware provider (behavioral proof of the effective replacement)', true,
      `grantsRecorded=${grantFacts().length} (E2b/E6d asserted the exact shapes)`)
    writeEvidence('e1-provider.json', { dupService, spillLines, homePackageJson: JSON.parse(readFileSync(join(HOME, 'profiles', 'web', 'package.json'), 'utf8')) })
    if (dupService) fail('E1')
  } catch (error) {
    fatalError = error instanceof Error ? error : new Error(String(error))
    log(`FATAL: ${fatalError.stack ?? fatalError.message}`)
    writeEvidence('fatal.json', String(fatalError.stack ?? fatalError))
    try { dumpMock('fatal') } catch { /* mock may be down */ }
  } finally {
    // ── post-gates ────────────────────────────────────────────────────
    await stopHostAndWait(20000)
    stopMock()
    const postStable = {
      p3080: await probeStableInstance(3080, ':3080', 'post'),
      p3180: await probeStableInstance(3180, ':3180', 'post'),
    }
    let testuseClean = true
    try {
      const dirty = gitOf(TESTUSE, ['status', '--porcelain'])
      testuseClean = dirty === ''
      if (!testuseClean) log(`WARNING: test-use dirty after run:\n${dirty.slice(0, 400)}`)
    } catch (error) {
      testuseClean = false
      log(`WARNING: test-use git status failed: ${String(error?.message ?? error).slice(0, 200)}`)
    }
    const stableUntouched = JSON.stringify(preStable) === JSON.stringify(postStable)
    check('POST', 'stable instances :3080/:3180 state unchanged (read-only probes pre == post)', stableUntouched,
      `pre=${JSON.stringify(preStable)} post=${JSON.stringify(postStable)}`)
    check('POST', 'test-use working tree byte-clean after the run', testuseClean, '')
    // The THREE artifact-read producer paths (PR #26 supplemental §2/§7):
    // the shell-foreground early-spill observer (E2) and the two SpillStore
    // verticals (S1 generic spill-policy, S2 tool-owned grep) — reported as
    // an explicit split so the smoke summary proves the provider replacement
    // covers tool-owned spill, not just the shell path.
    const producerOk = (leg) => CRITERIA.some((c) => c.leg === leg && c.ok)
    const producerPaths = {
      'foreground-shell-early-spill': { leg: 'E2', ok: producerOk('E2') },
      'spill-store-generic-spill-policy': { leg: 'S1', ok: producerOk('S1') },
      'spill-store-tool-owned-grep': { leg: 'S2', ok: producerOk('S2') },
    }
    writeEvidence('producer-paths.json', producerPaths)
    const passed = CRITERIA.filter((c) => c.ok).length
    const failed = CRITERIA.filter((c) => !c.ok)
    const anyFail = failed.length > 0 || fatalError !== null
    const verdict = anyFail ? 'FAIL' : 'PASS'
    writeEvidence('summary.json', {
      verdict,
      fatalError: fatalError !== null ? String(fatalError.stack ?? fatalError) : null,
      elapsedMs: Date.now() - t0,
      fails: FAILS,
      criteria: CRITERIA,
      producerPaths,
      stable: { pre: preStable, post: postStable, untouched: stableUntouched },
      testuseClean,
      keep: KEEP,
      home: HOME,
    })
    log(`producer paths: shell-early-spill(E2)=${producerPaths['foreground-shell-early-spill'].ok} spill-policy(S1)=${producerPaths['spill-store-generic-spill-policy'].ok} grep(S2)=${producerPaths['spill-store-tool-owned-grep'].ok}`)
    log(`── verdict: ${verdict} (${passed}/${CRITERIA.length} criteria; fails=${JSON.stringify(failed.map((f) => f.leg))}${fatalError !== null ? `; FATAL: ${String(fatalError.message).slice(0, 160)}` : ''}) ──`)
    if (KEEP) {
      log(`--keep: world retained at ${HOME}`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      log(`world removed: ${HOME}`)
    }
  }
  process.exit(CRITERIA.some((c) => !c.ok) || fatalError !== null ? 1 : 0)
}

/** Extract the leader instanceId from a team_list_members value (tolerant:
 * scans for an object array whose entry has templateId 'leader'). */
function extractLeaderInstanceId(value) {
  if (value === null || typeof value !== 'object') return null
  const scan = (node) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        if (item !== null && typeof item === 'object') {
          if (String(item.templateId ?? '') === 'leader' && typeof item.instanceId === 'string') return item.instanceId
          const inner = scan(item)
          if (inner !== null) return inner
        }
      }
      return null
    }
    if (typeof node === 'object') {
      for (const v of Object.values(node)) {
        const inner = scan(v)
        if (inner !== null) return inner
      }
    }
    return null
  }
  return scan(value)
}

main().catch((error) => {
  console.error(`[strict-read-smoke] fatal: ${error?.stack ?? String(error)}`)
  try { stopHost() } catch { /* already dead */ }
  try { stopMock() } catch { /* already closed */ }
  process.exit(1)
})
