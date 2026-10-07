#!/usr/bin/env node
/**
 * rc2-real-host-smoke.mjs — the 0.1.5-rc.2 real-host smoke (S1–S5) for the
 * rc2-repair round (plan §17, docs/plans/active/dsh-agent-team-rc2-repair-plan.md).
 *
 * WHAT THIS PROVES (one world, one host instance, sequential legs):
 *   S1 — a Leader whose bound blueprint declares `allow read subtree team`
 *        EXECUTES the read WITHOUT any control request (static allow on the
 *        canonicalized subtree) — plan §17 S1; A1 allow path.
 *   S2 — the same Leader, `read runtime/...` under `deny read subtree
 *        runtime`, is rejected as an EXPLICIT STATIC DENY (provenance
 *        rule/deny — NOT a canonicalization failure) — plan §17 S2; A1 deny
 *        path.
 *   S3 — the same Leader, `bash echo rc2-smoke` under `ask bash any`,
 *        creates a durable control request, the scripted approval (human
 *        principal — the leader's own asks are kind USER_APPROVAL, resolvers
 *        = human only) resolves allow, and the command EXECUTES on the
 *        last-mile guard (no target-stale) — plan §17 S3; A6 proof.
 *   S4 — a second team on the SAME plugin row: the row's anchor is blueprint
 *        A (no worker-b template), the team is BOUND to blueprint B (worker-b
 *        exists only in B). team.create succeeds, the Leader's persona is
 *        B's, and the first team_create_member(worker-b) + team_delegate
 *        SUCCEED (pre-A2-fix: the binder persona resolved from the row
 *        anchor → the post-commit member create was rejected) — plan §17
 *        S4; A2 proof.
 *   S5 — a THIRD team on the same row, bound to blueprint C (same templateId
 *        `worker-b`, DIFFERENT persona): the C member gets C's persona while
 *        the B member keeps B's — root-scoped blueprint resolution, no
 *        row-global leak — plan §17 S5; A2 multi-team proof.
 *
 * DESIGN (frozen in dev/agent-workflow/briefs/rc2-repair/smoke-kit-design.md;
 * pattern source: dev/agent-workflow/evidence/fix-alpha2-explicit-agent-setup-
 * compat/a2x-real-host-smoke.mjs). Refinements settled at implementation:
 *   R1 — S1–S4 run as ONE continuous Leader turn on the created B team: the
 *        team.create's initialWork (marker MK_B) drives a scripted mock chain
 *        (read team → read runtime → bash → create_member → delegate → final
 *        text). The bash step pauses the turn at the durable control wait;
 *        the kit approves from the outside; the turn resumes. Driving all
 *        permission legs from the same turn maximizes the causal chain and
 *        avoids any dependence on session/prompt to a created team root.
 *   R2 — the S3 approval principal is the boot root (the host-known operator
 *        = human): the leader's own ask is kind USER_APPROVAL (isLeader ?
 *        USER_APPROVAL : LEADER_APPROVAL — pre-execute-adapter), whose
 *        resolvers are human only; the leader principal would be rejected
 *        (CONTROL_RESOLVER_NOT_AUTHORIZED).
 *   R3 — the pending requestId is discovered through the p6t6 observation
 *        feed first, then a read-only DSH_HOME storage scan (the p6t6
 *        `/__p6t6/state` control block is bound to the DIRECTIVE root only —
 *        the created team's control state is not exposed there). If neither
 *        source yields it, S3 fails with a full diagnostic dump (an
 *        infrastructure gap to report, not a silent pass).
 *   R4 — A1 probe reuse: this same kit is the A1 live-repro harness
 *        (plan §10). Run it against the INSTRUMENTED dist (plan §9 probe
 *        commit) to capture the canonicalization/contains observations;
 *        the A1 branch decision (A/B/C) comes from those observations + the
 *        S1/S2 verdicts. Run it again post-fix to close the RED→GREEN arc.
 *
 * WORLD:
 *   - host = the pristine test-use checkout (DSH 0.1.5-rc.2 @
 *     fb2c4b9e69) launched as `node <testuse>/apps/cli/lib/bin.js web` with
 *     cwd = a scratch session workspace (`<home>/workspace`) — probe files
 *     live there and NEVER enter the frozen checkout.
 *   - env: DSH_HOME=<world home>, DSH_CLIENT_COMMIT_HASH=<CLIENT_COMMIT_HASH from tests/paths.mjs>,
 *     DEEPSEEK_BASE_URL=http://127.0.0.1:<mock-port> (the in-process mock
 *     model — packages/tools/harness/mock-deepseek.mjs).
 *   - plugin rows mounted ONLY through the public profile-patch seam:
 *     production row = <worktree>/packages/runtime/dist/.../host.js,
 *     observability row = packages/tools/harness/plugin.mjs (p6t6).
 *   - one row, one boot team (blueprint A anchor, legacy no-capabilities
 *     Leader — the 0.1.0-rc.1 byte shape), two created teams (B, C).
 *   - preset `rc2-smoke` — since 0.2.0-rc.2 an `@deepseek-ai/dsh-agent-preset`
 *     DECLARATION ROW mounted through the public profile-patch seam (the
 *     legacy `DSH_HOME/.agent-presets/<id>/` directory seam is no longer read
 *     by the host): persona + dsh-tool-fs + the minimal-style persistent shell
 *     group (bash stack; NO delegation group — the 0.1.5 deferred own-layer
 *     `subagent` is structurally un-denyable under the Coverage Gate;
 *     followup-backlog item 2).
 *   - LEG 0 discovery: one scripted turn on the boot Leader captures the
 *     model-facing tool surface (the mock request's `tools` array); the
 *     saved blueprints' `builtinToolDeny` is computed as
 *     surface − MANAGED_TOOL_NAMES − {todo_write} − the 11 team tools, so
 *     the strict Coverage Gate sees a fully covered surface.
 *
 * USAGE:
 *   node tests/kits/rc2-real-host-smoke/rc2-real-host-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] \
 *     [--mock-port N] [--evidence-dir <path>] [--raw-evidence-dir <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (4 levels up),
 *   --testuse = <worktree>/tests/deepseek-harness-test-use, host port =
 *   first free of 3491–3500, mock port = 3496, evidence dir =
 *   dev/agent-workflow/evidence/rc2-repair/smoke/rc2-smoke-<stamp>/.
 *   --raw-evidence-dir: the PRIVATE gitignored sink for full RAW strict-
 *   failure captures (dir 0700, files 0600). Without it raw captures are
 *   written NOWHERE — the publishable evidence tree only ever holds the
 *   non-sensitive status references; raw never inherits the evidence-dir
 *   default and a sink equal to the evidence dir is rejected.
 *
 * EXIT: 0 = all criteria pass; 2 = a S-leg criterion failed (with the full
 * evidence dump); 1 = fatal (environment/boot/row).
 *
 * ZERO-TOUCH: the live instances :3080 and :3180 are probed read-only
 * (status recorded pre/post) and never written to.
 */

import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { createRunControl, RunAborted } from './run-control.mjs'
import { stateKeyOf } from './run-budget.mjs'
import {
  assertPurpose,
  assertWireShape,
  isChainTurn,
  systemText as wsSystemText,
  toolResultEntries,
  extractInstanceId as strictExtractInstanceId,
} from './wire-shape.mjs'
import { TEAM_TOOL_CATALOG, deriveBuiltinToolDeny, materializeBcFixtures } from './fixture-invariants.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const FLAG_KEEP = args.includes('--keep')

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
const TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
const MOCK_PORT = Number(argValue('mock-port', 3496))
const EVIDENCE_DIR_ARG = argValue('evidence-dir', null)

// ── frozen facts ────────────────────────────────────────────────────────────

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../tests/paths.mjs'  // canonical test-infrastructure pin (docs/TEST_METHODS.md §1)
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // canonical pin = tests/paths.mjs (moves with the pinned host generation)
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
// The plugin's OWN tool namespace lives in ./fixture-invariants.mjs (one
// source, pinned against the real `createTeamTools` catalog by
// packages/testkit/test/rc2-kit-fixture-invariants.test.ts). These names must
// never reach a blueprint's `builtinToolDeny`: that field denies BUILTIN tools
// the agent INHERITS, and `tools.restrict()` refuses any name outside that
// global vocabulary — a check that is BYTE-IDENTICAL in 0.1.7-rc.1 (46a7f68b)
// and 0.2.0-rc.2 (639ed015), so a stale catalog is pre-existing fixture debt
// (introduced when the tools were added), not a host tightening. The B/C
// pre-flight below refuses to materialize such a fixture at all.
// The B/C Leader teamTools allow list (the smoke needs create + delegate;
// the list is a closed subset of the plugin's team-tool namespace).
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_collect',
]

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'rc2-repair', 'smoke', `rc2-smoke-${RUN_STAMP}`)

// Raw capture sink (review of be57d4b7, finding 1): the FULL raw capture
// (call arguments, result texts, host tail) is written ONLY to an explicit
// private sink — it NEVER inherits RUN_DIR, whose default is a publishable
// evidence path. The operator points --raw-evidence-dir at a gitignored
// private directory; the public evidence tree keeps only the non-sensitive
// per-stage STATUS references (public copies go through sanitize-evidence).
// A sink equal to RUN_DIR is rejected: raw must not leak into the tree that
// is copied out as publishable.
const RAW_EVIDENCE_DIR_ARG = argValue('raw-evidence-dir', null)
const RAW_CAPTURE_SINK_DIR = RAW_EVIDENCE_DIR_ARG === null || resolve(RAW_EVIDENCE_DIR_ARG) === RUN_DIR
  ? null
  : resolve(RAW_EVIDENCE_DIR_ARG)
/** Documented byte cap for one serialized raw capture (finding 4). */
const RAW_CAPTURE_MAX_BYTES = 32 * 1024 * 1024
/** Host-tail window: seek-and-read at most this many bytes (finding 4). */
const HOST_TAIL_WINDOW_BYTES = 64 * 1024
const HOST_TAIL_LINES = 40
const HOME = join(WORKTREE, 'tests', 'homes', `rc2-smoke-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.rc2-smoke-blueprints-${RUN_STAMP}`)

const ROOT = `session-rc2-smoke-root-${RUN_STAMP}`
const CREATE_ROOT_B = `session-rc2-smoke-b-${RUN_STAMP}`
const CREATE_ROOT_C = `session-rc2-smoke-c-${RUN_STAMP}`
const SMOKE_PRESET_ID = 'rc2-smoke'
const BP_ANCHOR_ID = 'team.rc2-anchor-a'
const BP_B_ID = 'team.rc2-b'
const BP_C_ID = 'team.rc2-c'

// Persona tokens (substring-asserted in the mock request system prompts).
const P_LEADER_A = `RC2SMK_A_LEADER_${RUN_STAMP}`
const P_LEADER_B = `RC2SMK_B_LEADER_${RUN_STAMP}`
const P_LEADER_C = `RC2SMK_C_LEADER_${RUN_STAMP}`
const P_WORKER_A = `RC2SMK_A_WORKER_${RUN_STAMP}`
const P_WORKER_B = `RC2SMK_B_WORKER_${RUN_STAMP}`
const P_WORKER_C = `RC2SMK_C_WORKER_${RUN_STAMP}`

// Distinct markers (no substring collisions).
const MK_DISC = `RC2MK_DISC_${RUN_STAMP}`
const MK_B = `RC2MK_B_${RUN_STAMP}`
const MK_BMEM = `RC2MK_BMEM_${RUN_STAMP}`
const MK_C = `RC2MK_C_${RUN_STAMP}`
const MK_CMEM = `RC2MK_CMEM_${RUN_STAMP}`

const PROBE_TEAM_FILE = join(WORKSPACE, 'team', 'test.md')
const PROBE_TEAM_CONTENT = `rc2-smoke-team-probe-${RUN_STAMP}`

// ── logging / criteria / fatals ─────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try {
      writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' })
    } catch { /* evidence best-effort */ }
  }
}

const criteria = []
function check(critId, name, ok, detail) {
  criteria.push({ id: critId, name, ok: ok === true, detail: String(detail ?? '') })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${critId}: ${name}${detail === '' || detail === undefined ? '' : ` — ${String(detail).slice(0, 500)}`}`)
  return ok === true
}

function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  } catch { /* best-effort */ }
}

/**
 * Non-sensitive references to the strict-failure STATUS files this process
 * wrote (finding 3): the module-level recorder survives teardown's own
 * failures, and `strictCaptureReferences()` merges it with what is actually
 * on disk in RUN_DIR. Both the teardown summary and the fatal summary carry
 * this list, so a failed run is never summarized without its capture state.
 */
const STRICT_CAPTURE_REFS = []
export function strictCaptureReferences() {
  const refs = new Set(STRICT_CAPTURE_REFS)
  try {
    for (const name of readdirSync(RUN_DIR)) {
      if (name.startsWith('strict-failure-')) refs.add(name)
    }
  } catch { /* RUN_DIR may be gone; the recorder still reports the refs */ }
  return [...refs].sort()
}

function dieFatal(msg, exitCode = 1) {
  log(`FATAL ${msg}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: msg, criteria })
  if (RC !== undefined && RC.armed()) {
    // main() is on the stack and owns the child host + the mock: UNWIND into its
    // `finally` (awaited owned-child cleanup + mock.close). `process.exit()` here would skip that
    // cleanup and leave this run's host process behind — the defect the
    // independent review of PR #62 found in the first guard version.
    throw new RunAborted(msg, null)
  }
  // Preflight (nothing started yet): a plain exit is safe.
  process.exit(exitCode)
}

/**
 * The FINAL fatal summary (finding 3): the top-level main().catch rewrites
 * summary.json when an error escapes the owner's finally, and that rewrite
 * must not silently drop the strict-failure capture state — one shared
 * builder for both final summaries (teardown and fatal), so the capture
 * references ride through whichever path ends the run. `put` is injectable
 * for regression tests; production calls use the default evidence writer.
 */
export function writeFatalSummary(fatalText, put = writeEvidence) {
  put('summary.json', {
    runStamp: RUN_STAMP,
    fatal: String(fatalText),
    criteria,
    runControl: { aborted: RC.aborted(), violation: RC.violation(), budget: RC.budget.snapshot() },
    strictFailureCaptures: strictCaptureReferences(),
  })
  return strictCaptureReferences()
}

// ── small http helpers (a2x kit shape) ──────────────────────────────────────

async function fetchJson(url, init, timeoutMs = 60_000) {
  if (RC.armed()) RC.check()
  const signal = RC.armed() ? AbortSignal.any([RC.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs)
  const res = await fetch(url, { ...init, signal }).catch((e) => {
    if (RC.armed()) RC.check()
    return { status: 0, body: null, error: e.message }
  })
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}

async function probeStableInstance(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}

async function authenticate(origin, token) {
  RC.check()
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.any([RC.signal, AbortSignal.timeout(30_000)]) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

/**
 * One browser-facing public Remote call: POST /team-remote/<method>.
 * `version` is the remote contract version: 1 for the v1-era methods
 * (team.create — proven in this round), 4 for the v4-only methods
 * (team.resolveControl — a v1 request is typed-rejected
 * `method-version-unsupported` before dispatch, catalog
 * isRemoteMethodAvailableInVersion).
 */
async function remoteCall(origin, cookie, method, params, tag = 'rc2', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, 240_000)
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'rc2') {
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
  }, 240_000)
}

async function p6t6Tool(port, name, argsBody, as, tag = 'rc2') {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: argsBody, as, callId: `${tag}-${Math.random().toString(36).slice(2, 12)}` }),
  }, 240_000)
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

function logTail(logPath, n = 25) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

/**
 * BOUNDED host-log tail (finding 4): never reads the whole file the way
 * `logTail` does — seeks to (size - HOST_TAIL_WINDOW_BYTES) and reads at
 * most that window, then keeps the last HOST_TAIL_LINES lines. A boundary
 * may cut a line mid-way (diagnostic context, and the truncated flag says
 * the window head is partial); unreadable files yield an error string, not
 * a throw.
 */
function boundedLogTail(logPath) {
  if (typeof logPath !== 'string' || logPath === '') return { text: '<no instance log>', truncated: false }
  let fd = null
  try {
    fd = openSync(logPath, 'r')
    const size = fstatSync(fd).size
    const len = Math.min(size, HOST_TAIL_WINDOW_BYTES)
    const start = size - len
    const buf = Buffer.alloc(len)
    let got = 0
    while (got < len) {
      const n = readSync(fd, buf, got, len - got, start + got)
      if (n <= 0) break
      got += n
    }
    const text = buf.subarray(0, got).toString('utf8')
    return { text: text.split('\n').slice(-HOST_TAIL_LINES).join('\n'), truncated: size > len || start > 0 }
  } catch (err) {
    return { text: `<instance log unreadable: ${String(err?.message ?? err)}>`, truncated: false }
  } finally {
    if (fd !== null) {
      try { closeSync(fd) } catch { /* already closed */ }
    }
  }
}

/**
 * STRICT writer for RAW captures (finding 2): unlike the best-effort public
 * `writeEvidence`, it REPORTS the truth. The private sink dir is forced to
 * 0700 and each raw file to 0600 (explicit chmod after create, so umask
 * cannot widen either). Success is only ever claimed when both the write
 * and the mode enforcement actually returned — the caller keys `persisted`
 * off this result and keeps its own error path intact.
 */
function writeRawCaptureStrict(dir, name, text) {
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    chmodSync(dir, 0o700)
  } catch (err) {
    return { ok: false, error: `sink dir unusable: ${String(err?.message ?? err)}` }
  }
  const path = join(dir, name)
  try {
    writeFileSync(path, text, { mode: 0o600 })
  } catch (err) {
    return { ok: false, error: `raw write failed: ${String(err?.message ?? err)}` }
  }
  try {
    chmodSync(path, 0o600)
  } catch (err) {
    return { ok: false, error: `raw chmod failed: ${String(err?.message ?? err)}` }
  }
  return { ok: true, path }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    if (RC.armed()) RC.check()
    let text = ''
    try {
      text = readFileSync(logPath, 'utf8')
    } catch { /* not written yet */ }
    // An empty file splits to [''] — a phantom line that would advance
    // `seen` past index 0 and permanently skip the log's FIRST physical
    // line (latent: the boot marker is usually line 2; a single-line
    // boot log would be missed). Keep `seen` stable until content exists.
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

// ── preflight ───────────────────────────────────────────────────────────────

function preflight() {
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== HOST_BASELINE_SHA) {
    dieFatal(`test-use checkout is not at ${HOST_BASELINE_SHA} (got ${rev.stdout?.trim() ?? rev.stderr})`)
  }
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' })
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') {
    dieFatal(`test-use checkout is not pristine: ${dirty.stdout?.trim().slice(0, 200)}`)
  }
  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_PLUGIN_PATH]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
}

async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ error: e }))
  if (res.error) return true
  return false
}

async function pickHostPort() {
  if (args.includes('--host-port')) return Number(argValue('host-port', 0))
  for (const p of [3491, 3492, 3493, 3494, 3495, 3497, 3498, 3499, 3500]) {
    if (await portFree(p)) return p
  }
  dieFatal('no free host port in 3491-3500')
}

// ── world materialization ───────────────────────────────────────────────────

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}

function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
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

function teamRowConfig() {
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    // Contract (host.ts: blueprintSource must be a non-empty string — the
    // inline YAML source). It is the ROW ANCHOR (blueprint A) and, on the
    // production path with the resolver injected, the no-resolver fallback
    // only — the bound team resolves through the saved-source catalog.
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'rc2-smoke-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    // The production row's LIVE GLUE: the dist agent-bindings.mjs (the
    // a2x contract — the glueUrl IS the glue; seamUrl is the separate
    // root-binding harness seam).
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

/**
 * The row anchor blueprint A: a plain LEGACY leader (NO capabilities — the
 * byte-for-byte 0.1.0-rc.1 boot shape; worker-a exists only here). The A2
 * test hinges on worker-b being ABSENT from A.
 */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the rc2 smoke boot team. ${P_LEADER_A}"`,
  'members:',
  '  - templateId: worker-a',
  `    persona: "You are a worker of the rc2 smoke boot team. ${P_WORKER_A}"`,
  'memberEnvelopes: []',
  'requirements: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/**
 * One saved-source strict blueprint (B or C). The Leader declares the full
 * alpha.1 capability set + alpha.2 permissions (the shape that triggers the
 * strict Coverage Gate): allow read subtree team / deny read subtree runtime
 * / ask bash any / default ask. `builtinToolDeny` (CAPABILITIES-level,
 * discovery-computed) covers the unmanaged surface. worker-b exists ONLY in
 * B and C (persona differs per blueprint — the A2 T3/S5 axis).
 *
 * Mutation envelopes (LIVE-FOUND this round, run 11-02-31): without a
 * teamEnvelope the LEADER cannot perform the `request-control` mutation —
 * the permission ask's control-request creation fails closed with
 * "operation 'request-control' ... is outside the caller's mutation
 * envelope" (the admission envelope check over ALL_MUTATION_OPS). The S3
 * bash-ask leg REQUIRES the leader to hold request-control; assign-task /
 * create-member cover the S4 delegate/create legs; resolve-control covers
 * leader-approval member asks. The worker keeps the standard member set.
 */
function savedBlueprintYaml(bpId, leaderPersona, workerPersona, denyList) {
  const denyLines = denyList.length === 0
    ? ['    builtinToolDeny: []']
    : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines,
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: team',
    '      ask:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      deny:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: runtime',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
    'members:',
    '  - templateId: worker-b',
    `    persona: ${JSON.stringify(workerPersona)}`,
    'memberEnvelopes:',
    '  - templateId: worker-b',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '      deny: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/**
 * The smoke preset's plugin subtree (0.2 host generation).
 *
 * 0.2.0-rc.2 removed the legacy user-preset DIRECTORY seam: `$DSH_HOME/
 * .agent-presets/<id>/{preset.yml,agent.cordis.yml}` is no longer read by the
 * host (upstream `@deepseek-ai/dsh-agent-preset` skill: "Nothing reads that
 * directory any more"), and a preset is now an ordinary
 * `@deepseek-ai/dsh-agent-preset` DECLARATION ROW carried by a patch layer —
 * which is why this kit returns the subtree as data and mounts it through the
 * public profile-patch seam in `writePatchFile()` below (same seam the team
 * row and the p6t6 observability row use; no directory seam, no host patch).
 *
 * Content is unchanged from the 0.1.7 kit: persona + dsh-tool-fs + the
 * minimal-style persistent shell group (bash stack). NO delegation group: the
 * 0.1.5 spawn `subagent` row is a deferred per-agent own-layer install —
 * un-restrictable and KNOWN_SENSITIVE under the Coverage Gate
 * (followup-backlog item 2).
 */
function smokePresetPlugins() {
  return [
    {
      id: 'persona',
      name: '@deepseek-ai/dsh-persona',
      config: {
        suffix: 'Your working directory is {{cwd}}.',
        prefix: 'You are a coding agent powered by the {{model}} model.',
      },
    },
    { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
    {
      id: 'persistent-shell',
      name: 'cordis:group',
      group: true,
      isolate: { terminals: true },
      config: [
        { id: 'pty', name: '@deepseek-ai/dsh-terminal' },
        { id: 'terminal-bash', name: '@deepseek-ai/dsh-terminal-bash', config: { timeoutMs: 300000 } },
        {
          id: 'persistent-bash',
          name: '@deepseek-ai/dsh-tool-bash-persistent',
          config: { timeoutMs: 300000, description: 'Run commands in a bash shell. State is persistent across calls.' },
        },
      ],
    },
  ]
}

/** The 0.2 preset declaration row (roster identity = `config.id`). */
function smokePresetDeclaration() {
  return {
    id: `preset-${SMOKE_PRESET_ID}`,
    name: '@deepseek-ai/dsh-agent-preset',
    config: {
      id: SMOKE_PRESET_ID,
      name: 'rc2 smoke',
      description: `rc2 real-host smoke preset (run ${RUN_STAMP}); kit-authored via the public profile-patch seam.`,
      order: 900,
      plugins: smokePresetPlugins(),
    },
  }
}

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# rc2 real-host smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist) + p6t6 observability row + the rc2-smoke agent-preset DECLARATION ROW — mounted ONLY through the public profile-patch seam.`,
    '# (0.2.0-rc.2: the legacy $DSH_HOME/.agent-presets/<id>/ directory seam is no longer read; a preset is a declaration row.)',
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(smokePresetDeclaration(), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── the real-host boot (test-use bin; the DshInstance pattern) ─────────────

export function spawnHost({ port, home, logPath, mockPort, bin = HOST_BIN, cwd = WORKSPACE, control = RC }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [bin, 'web', '--port', String(port), '--no-open'],
      {
        // The session workspace IS the host cwd: probe files live in the
        // scratch workspace, the frozen checkout is never touched.
        cwd,
        detached: process.platform !== 'win32',
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'rc2-smoke-mock-key',
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
  // Own the process before boot/authentication can await or fail. The detached
  // POSIX group contains only descendants created by this test host.
  control.bindChild(child, { lifetimeMs: CHILD_LIFETIME_MS, processGroup: process.platform !== 'win32' })
  closeSync(outFd)
  closeSync(errFd)
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}

async function bootHost({ port, home, mockPort, instanceLog }) {
  writePatchFile(home)   // carries the team row, the p6t6 row AND the preset declaration row (0.2 seam)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'rc2-anchor-a.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, h.alive)
  if (line === null) {
    await RC.stopChild()
    const detail = h.exitInfo.exited
      ? `process exited (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'}${h.exitInfo.message ? ` msg=${h.exitInfo.message}` : ''})`
      : 'no boot marker within 240s'
    dieFatal(`host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`unexpected boot url shape: ${line}`)
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`auth failed: ${e.message}`))
  // Row health gate (a latched setupError must fail fast).
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    const hb = await p6t6Health(Number(m[1]))
    health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      await RC.stopChild()
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) {
      await RC.stopChild()
      dieFatal(`row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  // Row state well-formed for the boot root.
  const sDeadline = Date.now() + 90_000
  let state = null
  for (;;) {
    const s = await p6t6State(Number(m[1]))
    state = s
    const b = s.body
    if (s.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === ROOT && b.phase === 'create'
      && b.teamSession !== null && typeof b.teamSession === 'object') break
    if (Date.now() >= sDeadline) {
      await RC.stopChild()
      dieFatal(`row state not well-formed in 90s; last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`host booted at ${origin}; row ready — toolCount=${health.body?.toolCount}`)
  return { host: h, port: Number(m[1]), origin, cookie, instanceLog, health, stateBody: state.body }
}

// ── mock decide policy (R1: one continuous B chain, C chain, DISC, members) ─

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-rc2-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

/**
 * The request body, shape-tolerant: the kit's mock RECORD carries the
 * parsed body under `.body`; the mock harness's decide callback receives
 * the parsed body ITSELF (decide({seq, req: parsed}) — req = the body).
 */
function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  if ('body' in recordOrBody) return recordOrBody.body ?? null
  if ('req' in recordOrBody) return recordOrBody.req ?? null
  return recordOrBody
}

/**
 * The kit's readers, each a thin delegate onto the verified decoder in
 * ./wire-shape.mjs (the same code the fixtures + unit tests exercise).
 * They are deliberately LENIENT — never aborting — because they also run in
 * diagnostic paths; the loud failure for an unclassifiable request is the sweep
 * inside `waitForMock`, which aborts through the owner's cleanup.
 *
 * Why the old 0.1.x-only readers were wrong (run 4): on the 0.2 request wire a
 * tool result is a `tool_result` CONTENT PART inside an ordinary user message,
 * so counting `role: 'tool'` messages returned 0 forever — every chain step
 * timed out while `decide` re-issued step 1 (~1 800 requests). Text flattening
 * is shared too: a `text` part contributes its text VERBATIM, which is what
 * lets one instance-id extractor behave identically on both generations.
 */
export function userTextOf(req) {
  const body = bodyOf(req)
  // Route scenarios only by real user text. A leader's assistant tool_use
  // arguments and returned tool_result may quote the worker marker; including
  // those would make the leader impersonate its worker in both policy and waits.
  return (body?.messages ?? [])
    .filter((message) => message?.role === 'user')
    .map((message) => typeof message.content === 'string' ? message.content
      : Array.isArray(message.content) ? message.content
        .filter((part) => part?.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text).join('\n') : '')
    .filter((text) => text !== '')
    .join('\n')
}

/** The INSTRUCTION surface: 0.2 top-level `system`, 0.1.x system messages. */
export function systemTextOf(req) {
  const body = bodyOf(req)
  return body === null ? '' : wsSystemText(body)
}

function toolMsgsOf(req) {
  const body = bodyOf(req)
  if (body === null) return []
  let entries
  try {
    entries = toolResultEntries(body, { label: 'count' })
  } catch {
    // Unrecognized encoding: reported by the sweep; a diagnostic dump must
    // never be the thing that ends a run.
    return []
  }
  return entries.map((e) => e.item)
}

/** Read this sequential smoke step's result, never unrelated transcript text.
 * Both wire generations retain call ids and names. Require one ordered result
 * per call and the expected final tool, so a stale/duplicate result cannot prove
 * progress. In particular, S2's intentional denial must not poison S4, and an
 * earlier `rc2-smoke` string must not prove that S3's bash actually executed. */
export function toolResultTextOf(req, { expectedCount, expectedTool, allowError = false, onStrictFailure = null }) {
  const label = `smoke oracle ${expectedTool} step ${expectedCount}`
  const body = bodyOf(req)
  try {
    const decoded = assertWireShape(body, { label, expectToolResult: true })
    const entries = toolResultEntries(body, { label })
    if (!Number.isInteger(expectedCount) || expectedCount < 1
      || entries.length !== expectedCount || decoded.toolUses.length !== expectedCount) {
      throw new Error(`${label}: expected ${expectedCount} paired calls/results, got ${decoded.toolUses.length}/${entries.length}`)
    }
    const seen = new Set()
    for (let index = 0; index < expectedCount; index++) {
      const call = decoded.toolUses[index]
      if (typeof call.id !== 'string' || call.id.trim() === '' || seen.has(call.id)
        || entries[index].toolUseId !== call.id) {
        throw new Error(`${label}: missing, duplicate, stale or out-of-order call/result id at ${index}`)
      }
      seen.add(call.id)
    }
    const last = entries[expectedCount - 1]
    if (decoded.toolUses[expectedCount - 1].name !== expectedTool) {
      throw new Error(`${label}: the final call is not ${expectedTool}`)
    }
    if (last.isError && !allowError) throw new Error(`${label}: error result cannot prove successful execution`)
    return last.text
  } catch (err) {
    // Capture-before-assert: the strict verdict above is correct and is
    // RE-THROWN unchanged — this hook only copies the associated raw
    // evidence out before the throw unwinds into teardown (run 6 lost the
    // exact bash error text exactly this way). A broken capture can never
    // mask or replace the oracle's error.
    if (typeof onStrictFailure === 'function') {
      try {
        onStrictFailure(strictFailureDiagnostics(body, { label, expectedCount, expectedTool, allowError, err }))
      } catch { /* capture must never mask the strict verdict */ }
    }
    throw err
  }
}

/**
 * Best-effort re-decode of the strict reader's inputs for the raw capture:
 * the paired calls (id/name/arguments) and results (toolUseId/isError/FULL
 * text), plus the oracle error itself. Every decoder failure is recorded as
 * a string on the diagnostics instead of throwing — capture is read-only
 * forensics and must not add new failure modes to the run.
 */
function strictFailureDiagnostics(body, { label, expectedCount, expectedTool, allowError, err }) {
  const diag = {
    label, expectedCount, expectedTool, allowError,
    error: { name: String(err?.name ?? 'Error'), message: String(err?.message ?? err) },
    calls: null, callsError: null,
    results: null, resultsError: null,
  }
  try {
    diag.calls = assertWireShape(body, { label: `${label} (capture)`, expectToolResult: true }).toolUses
      .map((call) => ({
        id: call.id ?? null,
        name: call.name ?? null,
        arguments: call.item?.input ?? call.item?.function?.arguments ?? null,
      }))
  } catch (captureErr) {
    diag.callsError = String(captureErr?.message ?? captureErr)
  }
  try {
    diag.results = toolResultEntries(body, { label: `${label} (capture)` })
      .map((entry) => ({ toolUseId: entry.toolUseId ?? null, isError: entry.isError === true, text: entry.text }))
  } catch (captureErr) {
    diag.resultsError = String(captureErr?.message ?? captureErr)
  }
  return diag
}

/**
 * The kit's capture-before-assert seam (run 6; repaired from the be57d4b7
 * review). When a strict step oracle throws, the exact error text died with
 * the in-memory transcript. This factory returns the `onStrictFailure` hook
 * wired into every strict step call site; BEFORE the throw reaches teardown
 * it captures the associated call (id/name/arguments), result
 * (toolUseId/isError/full text), the oracle error, and a BOUNDED host tail
 * (seek-read ≤ HOST_TAIL_WINDOW_BYTES, last HOST_TAIL_LINES lines, explicit
 * truncated flag) as RAW file `strict-failure-<stage>.json`.
 *   - RAW goes ONLY to the explicit private sink `rawSinkDir` (kit flag
 *     --raw-evidence-dir; never RUN_DIR): dir forced 0700, files 0600, via
 *     the strict writer that reports honestly — `persisted:true` is recorded
 *     only after the write AND the mode enforcement actually succeeded;
 *     with no sink configured the full capture is written NOWHERE.
 *   - A serialized capture larger than rawMaxBytes (default
 *     RAW_CAPTURE_MAX_BYTES = 32 MiB) is marked `capture-incomplete-oversize`
 *     and NOT written — never passed off as complete.
 *   - The PUBLIC evidence tree receives only the non-sensitive
 *     `strict-failure-<stage>-status.json` reference (stage, oracle error,
 *     persisted/status/bytes — never arguments, result texts or log tails).
 * None of this can change the verdict: the oracle re-throws identically and
 * a broken capture still cannot mask its error.
 */
export function makeStrictFailureCapture({ stage, rawSinkDir = null, statusEvidence, log, instanceLog, rawMaxBytes = RAW_CAPTURE_MAX_BYTES }) {
  return function onStrictFailure(diag) {
    const capturedAt = new Date().toISOString()
    const rawName = `strict-failure-${stage}.json`
    const statusName = `strict-failure-${stage}-status.json`
    let status = ''
    let persisted = false
    let rawBytes = null
    let writeError = null
    if (rawSinkDir === null || rawSinkDir === undefined || rawSinkDir === '') {
      status = 'raw-sink-unconfigured'
    } else {
      const tail = boundedLogTail(instanceLog)
      const payload = {
        stage, capturedAt, ...diag,
        hostTail: tail.text,
        hostTailTruncated: tail.truncated,
        hostTailWindowBytes: HOST_TAIL_WINDOW_BYTES,
      }
      const text = JSON.stringify(payload, null, 2)
      rawBytes = Buffer.byteLength(text)
      if (rawBytes > rawMaxBytes) {
        status = 'capture-incomplete-oversize'
      } else {
        const res = writeRawCaptureStrict(rawSinkDir, rawName, text)
        if (res.ok) { persisted = true; status = 'persisted' }
        else { status = 'capture-write-failed'; writeError = res.error }
      }
    }
    // The non-sensitive public reference. The strict writer's honest result
    // is the ONLY source of `persisted`; an IO failure here (public writer
    // is best-effort) must not mask the oracle and only weakens discovery.
    try {
      statusEvidence(statusName, {
        stage, capturedAt,
        oracleLabel: diag.label,
        oracleError: diag.error,
        persisted, status,
        rawEvidenceFile: persisted ? rawName : null,
        rawBytes,
        writeError,
        callsCaptured: Array.isArray(diag.calls) ? diag.calls.length : null,
        resultsCaptured: Array.isArray(diag.results) ? diag.results.length : null,
        decodeNote: { callsError: diag.callsError !== null, resultsError: diag.resultsError !== null },
      })
      STRICT_CAPTURE_REFS.push(statusName)
    } catch { /* best-effort status; the oracle error stays untouched */ }
    log(`strict oracle failure (${stage}): raw capture status=${status}${persisted ? ` -> ${rawName}` : ' (no raw contents in public evidence)'}`)
  }
}

function toolEntriesOf(req, label) {
  try {
    return toolResultEntries(bodyOf(req), { label })
  } catch (err) {
    // An unreadable shape is a fixture fault, not a chain state: abort through
    // the owner's cleanup instead of continuing on a guess.
    RC.requestAbort(`unreadable tool-result surface (${label}): ${err.message}`, { label, decoder: String(err?.name ?? 'Error') })
    return []
  }
}

/**
 * The instance id of a `team_create_member` result at `index` — STRICT, with no
 * fallback that can produce `undefined`. On any problem (missing entry, error
 * result, empty payload, no id) this ABORTS the run through the owner's cleanup
 * and returns null, so the caller cannot issue a `team_delegate` with a missing
 * or fabricated `targetInstanceId`.
 */
function instanceIdFrom(req, index, label) {
  const entries = toolEntriesOf(req, label)
  const entry = entries[index]
  if (entry === undefined) {
    RC.requestAbort(`fixture fault (${label}): the request carries ${entries.length} tool result(s), no entry ${index}`, { label, index, resultCount: entries.length })
    return null
  }
  try {
    return strictExtractInstanceId(entry.item, { label })
  } catch (err) {
    RC.requestAbort(`fixture fault (${label}): ${err.message}`, { label, index, isError: entry.isError, textHead: entry.text.slice(0, 300) })
    return null
  }
}

/** A typed refusal for the host when a fixture fault already aborted the run. */
function abortedReply(what) {
  return { kind: 'error', status: 503, message: `rc2 kit: refusing to continue (${what}); run aborted through the owner's cleanup`, code: 'rc2-fixture-fault' }
}

function makeDecide() {
  return function decide({ req }) {
    const text = userTextOf(req)
    const tools = toolMsgsOf(req).length
    // Member turns (separate sessions, their own marker).
    if (text.includes(MK_BMEM)) return { kind: 'text', content: 'RC2_MEMBER_B_DONE' }
    if (text.includes(MK_CMEM)) return { kind: 'text', content: 'RC2_MEMBER_C_DONE' }
    // LEG 0 discovery on the boot Leader.
    if (text.includes(MK_DISC)) return { kind: 'text', content: 'RC2_DISC_DONE' }
    // The B chain: S1 read team → S2 read runtime → S3 bash (control wait)
    // → S4 create_member(worker-b) → delegate → final.
    // Team-tool args (LIVE-FOUND run 11-02-31): EVERY team tool requires
    // rootSessionId + a fresh per-operation requestToken (the tools.ts
    // makeDefinition gate; the skill's request-token discipline — a fresh
    // token per logical operation), and create/delegate take
    // delegationTemplateId / delegationInstanceId + label.
    if (text.includes(MK_B)) {
      switch (tools) {
        case 0: return toolCall('read', { file_path: 'team/test.md' })
        case 1: return toolCall('read', { file_path: 'runtime/forbidden.txt' })
        case 2: return toolCall('bash', { command: 'echo rc2-smoke' })
        case 3: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_B,
          requestToken: `rc2-b-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker-b',
          label: 'worker-b-1',
        })
        case 4: {
          const id = instanceIdFrom(req, 3, 'B team_create_member result')
          if (id === null) return abortedReply('B create result unreadable')
          // EXPLICIT async: false — the 2026-09-27 ruling flipped the
          // no-argument default to async; this kit exercises blueprint
          // binding/persona, so it pins the sync path explicitly to keep
          // its proven behavior byte-identical.
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_B,
            requestToken: `rc2-b-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: 'worker-b-1',
            prompt: MK_BMEM,
            async: false,
          })
        }
        case 5: return { kind: 'text', content: 'RC2_SMOKE_B_DONE' }
        default: return { kind: 'text', content: `RC2_B_FALLTHROUGH tools=${tools}` }
      }
    }
    // The C chain: create_member(worker-b) → delegate → final.
    if (text.includes(MK_C)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_C,
          requestToken: `rc2-c-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker-b',
          label: 'worker-b-1',
        })
        case 1: {
          const id = instanceIdFrom(req, 0, 'C team_create_member result')
          if (id === null) return abortedReply('C create result unreadable')
          // EXPLICIT async: false (2026-09-27 ruling: sync is now opt-in)
          // — keeps this persona-isolation kit's behavior byte-identical.
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_C,
            requestToken: `rc2-c-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: 'worker-b-1',
            prompt: MK_CMEM,
            async: false,
          })
        }
        case 2: return { kind: 'text', content: 'RC2_SMOKE_C_DONE' }
        default: return { kind: 'text', content: `RC2_C_FALLTHROUGH tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'RC2_NOOP_DONE' }
  }
}

/** Poll the in-process mock request log for the first request matching pred. */
/**
 * Run control + resource budgets.
 *
 * HISTORY. Run 4 of this round produced ~1 800 model requests inside one wait
 * because the chain predicates could not read the host's 0.2 request shape:
 * `decide` kept re-answering with the same scripted branch while every
 * downstream ground its full timeout. The first guard (PR #62 @ 0ff5bbe1)
 * bounded that but was itself defective, and the independent review named the
 * three ways it could be wrong:
 *
 *   1. it called `dieFatal()` → `process.exit(2)` from inside the mock's
 *      `decide` callback, skipping `main()`'s `finally` — the ONLY place that
 *      stops the child host and closes the mock — so a guard trip LEAKED the
 *      host process it was supposed to protect;
 *   2. its total was checked in `waitForMock` AFTER the hit fast-path, so a
 *      storm inside a single wait was counted only when a wait succeeded;
 *   3. its repetition detector was one global streak, so any interleaved title
 *      dispatch or sibling-session turn reset it.
 *
 * The replacement (this block + run-budget.mjs + run-control.mjs):
 *   - every request is counted AT ENTRY in `decide`, before any reply exists
 *     and before any wait can mistake it for progress;
 *   - counters are per session/purpose AND per scenario AND per (state, reply)
 *     streak, so interleaving cannot mask a loop;
 *   - a violation kills ONLY this run's own child, aborts the run signal and
 *     THROWS `RunAborted` into the owner, whose `finally` closes the mock and
 *     writes the forensic corpus (`mock-requests.json`, `instance-tail.txt`,
 *     `run-abort.json`, `summary.json`) before the process exits;
 *   - an independent watchdog bounds the child's wall-clock lifetime
 *     separately from every wait;
 *   - SIGINT/SIGTERM take the same path.
 * Thresholds are sized from the expected successful chain (~20-30 requests,
 * documented in run-budget.mjs) with ~4x headroom, and can only ever FAIL the
 * run — never skip a step or turn a failure into a pass.
 */
const CHILD_LIFETIME_MS = 20 * 60_000
/** Requests the decoder could not classify, and how far the sweep has run. */
const SHAPE_SWEEP = { swept: 0, unknown: [] }
const RC = createRunControl({
  log,
  writeEvidence,
  limits: {
    totalRequests: 120,
    perSessionRequests: 40,
    perScenarioRequests: 25,
    sameStateRepeats: 6,
    consecutiveMisses: 2,
    childLifetimeMs: CHILD_LIFETIME_MS,
  },
})

/** A reply signature that ignores the random tool-call ids. */
function replySig(reply) {
  if (reply === null || typeof reply !== 'object') return String(reply)
  if (reply.kind === 'tool-call') {
    return `tool:${(reply.toolCalls ?? []).map((t) => `${t.name}(${JSON.stringify(t.arguments ?? {})})`).join(',')}`
  }
  return `text:${String(reply.content ?? '').slice(0, 200)}`
}

/** The conversation STATE a request belongs to (run-budget.stateKeyOf). */
export function requestStateKey(req) {
  const body = bodyOf(req)
  const decoded = assertWireShape(body, { label: 'mock entry' })
  const purpose = assertPurpose(body, { label: 'mock entry' }).purpose
  return stateKeyOf({ purpose, systemText: wsSystemText(body), toolResults: decoded.toolResults.length })
}

/** The production mock callback validates the actual {seq, req} envelope
 * before it can issue a scripted tool call. Auxiliary requests cannot enter
 * the agent policy, even when they replay that agent's tools and markers. */
export function guardedDecide(envelope, decideFn, control = RC) {
  const refusal = (message) => ({ kind: 'error', status: 503, message, code: 'rc2-fixture-fault' })
  if (control.aborted()) return refusal('rc2 kit: run already aborted')
  const body = bodyOf(envelope)
  let key
  let purpose
  try {
    key = requestStateKey(body)
    purpose = assertPurpose(body, { label: `mock request #${envelope?.seq ?? '?'}` }).purpose
  } catch (err) {
    // Invalid traffic still consumes the total budget, but never a reply.
    control.budget.observeRequest('invalid|invalid|0')
    control.requestAbort(`unrecognized model request at entry: ${err.message}`, { decoder: err.name, info: err.info ?? null })
    return refusal('rc2 kit: unrecognized request; no scripted reply issued')
  }
  const violation = control.budget.observeRequest(key)
  if (violation !== null) {
    control.reportViolation(violation, { at: 'decide-entry', stateKey: key })
    return refusal(`storm guard: ${violation.detail}`)
  }
  let reply
  try {
    if (purpose === 'title') reply = { kind: 'text', content: 'RC2 smoke session' }
    else if (purpose === 'compaction') {
      // This short deterministic kit cannot reconstruct a scripted chain from
      // a compacted transcript. Diagnose rather than fake progress or authority.
      control.requestAbort('unexpected compaction in bounded smoke chain; no scripted tool call issued', { at: 'decide-entry', stateKey: key })
      return refusal('rc2 kit: compaction requires a separate continuation scenario')
    } else reply = decideFn({ ...envelope, req: body })
  } catch (err) {
    control.requestAbort(`scripted mock reply failed: ${err.message}`, { at: 'decide-reply', stateKey: key })
    return refusal('rc2 kit: scripted reply failed')
  }
  const repeat = control.budget.noteReply(key, replySig(reply))
  if (repeat !== null) {
    control.reportViolation(repeat, { at: 'decide-reply', stateKey: key })
    return refusal(`storm guard: ${repeat.detail}`)
  }
  return reply
}

async function waitForMock(mock, pred, timeoutMs, label) {
  RC.check()
  RC.budget.beginScenario(label)
  try {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      // An abort raised by decide, the watchdog or a signal lands here within
      // one poll instead of after the remaining timeouts.
      RC.check()
      // Loud-shape sweep: a request the decoder cannot classify (unknown role /
      // part type, mixed encodings, or a purpose outside the closed auxiliary
      // list) aborts the run HERE through the owner's cleanup, instead of being
      // read as "zero tool results" and re-asking the model for the same step
      // forever — the exact failure mode of run 4.
      for (const r of mock.requests.slice(SHAPE_SWEEP.swept)) {
        SHAPE_SWEEP.swept += 1
        if (r.body === null) continue
        const label = `request #${r.seq}`
        try {
          assertWireShape(r.body, { label })
          assertPurpose(r.body, { label })
        } catch (err) {
          SHAPE_SWEEP.unknown.push({ seq: r.seq, error: String((err && err.message) ?? err) })
          writeEvidence('unknown-wire-shape.json', { unknown: SHAPE_SWEEP.unknown, waitingFor: label })
          RC.abort(`unrecognized model request (${label}): ${String((err && err.message) ?? err)}`, { seq: r.seq, waitingFor: label })
        }
      }
      const hit = mock.requests.find((r) => {
        if (!pred(r)) return false
        if (r.body === null) return false
        // A title or compaction dispatch REPLAYS the conversation, so it can
        // satisfy a marker/count predicate with the wrong request: only genuine
        // agent turns may advance the scripted chain.
        try {
          return isChainTurn(r.body)
        } catch {
          return false
        }
      })
      if (hit !== undefined) {
        RC.budget.noteWaitHit()
        return hit
      }
      if (Date.now() >= deadline) {
        const miss = RC.budget.noteWaitMiss(label)
        log(`mock wait timed out: ${label} (requests=${mock.requests.length}, consecutiveMisses=${RC.budget.state.consecutiveMisses}, total=${RC.budget.state.totalRequests})`)
        if (miss !== null) RC.reportViolation(miss, { waitingFor: label, lastRequests: mock.requests.slice(-5).map((r) => ({ seq: r.seq, userTextHead: r.body === null ? null : userTextOf(r).slice(0, 200), toolResultCount: r.body === null ? null : toolMsgsOf(r).length })) })
        return null
      }
      await new Promise((r) => setTimeout(r, 400))
    }
  } finally {
    RC.budget.endScenario()
  }
}

// ── S3 requestId discovery (R3) ─────────────────────────────────────────────

/**
 * The B-root control rows from the plugin's durable ledger
 * (storages/team_domain.json → tables.ledger): the control service
 * persists requests/decisions/consumptions as ledger entries with
 * factType `control-request-recorded` / `control-decision-recorded` /
 * `control-consumption-recorded` (control/service.ts), each entry a
 * JSON string {factType, rootSessionId, payload, ...}. Read-only.
 */
function readControlLedger(root) {
  const out = { entries: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      try {
        const entry = JSON.parse(v)
        if (entry?.factType === 'control-request-recorded' && String(entry.rootSessionId) === root) {
          out.entries.push({ sequence: k, entry })
        }
      } catch { /* not a JSON entry — skip */ }
    }
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  return out
}

/**
 * Discover the pending bash-ask control requestId for the created B team.
 * Source 1: the p6t6 observation feed (global across roots). Source 2: the
 * plugin's durable control ledger (team_domain.json). POLLING: the request
 * is created milliseconds AFTER the mock's bash tool-call reply is served
 * (the host executes the tool after answering the mock) — a single read
 * races it (LIVE-FOUND run 11-02-31: S3a candidates=[] ~5 ms after the
 * bash reply). Both dumps are written to the evidence dir for the
 * forensic record.
 */
async function discoverPendingRequestId(port, root, tag) {
  const found = { source: null, requestId: null, row: null, candidates: [] }
  // Source 1: observations. The permission listener emits
  // `alpha2-perm: {"stage":"request-created","callId":...,"requestId":...,"kind":...,"correlation":...}`
  // into the same feed (pre-execute-adapter observe → onObserve) — the
  // authoritative requestId source for the created team's ask.
  const deadline = Date.now() + 20_000
  let st = null
  let ledger = null
  for (;;) {
    st = await p6t6State(port)
    const obs = Array.isArray(st.body?.observations) ? st.body.observations : []
    const obsText = obs.map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
    for (const line of obsText) {
      if (!/request-created|requestId/.test(line)) continue
      const m = /"requestId"\s*:\s*"([^"]+)"/.exec(line)
      if (m !== null) found.candidates.push({ source: 'observations/request-created', line: line.slice(0, 400), requestId: m[1] })
    }
    // A direct structured observation (object rows) carrying the request.
    for (const o of obs) {
      if (o !== null && typeof o === 'object' && JSON.stringify(o).includes('bash')) {
        const s = JSON.stringify(o)
        const m = /"requestId"\s*:\s*"([^"]+)"/.exec(s)
        if (m !== null) found.candidates.push({ source: 'observations-structured', requestId: m[1], row: o })
      }
    }
    // Source 2: the durable control ledger (fresh read each poll).
    ledger = readControlLedger(root)
    for (const { entry } of ledger.entries) {
      found.candidates.push({
        source: 'storage:team_domain.json/ledger',
        requestId: String(entry.payload?.requestId ?? ''),
        row: { factType: entry.factType, rootSessionId: entry.rootSessionId, kind: entry.payload?.kind, toolName: entry.payload?.toolName, createdAt: entry.createdAt },
      })
    }
    if (found.candidates.length > 0) break
    if (Date.now() >= deadline) break
    await new Promise((r) => setTimeout(r, 500))
  }
  writeEvidence(`${tag}-state-pending.json`, st?.body)
  if (ledger !== null) writeEvidence(`${tag}-ledger-control.json`, ledger)
  // Source 3 (forensic): read-only home storage scan (JSON files only).
  const walk = (dir, depth) => {
    if (depth > 8) return
    let entries = []
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch { return }
    for (const e of entries) {
      if (e.name === 'node_modules' || e.name.startsWith('.git')) continue
      const p = join(dir, e.name)
      if (e.isDirectory()) {
        walk(p, depth + 1)
      } else if (e.isFile() && (e.name.endsWith('.json') || e.name.endsWith('.jsonl'))) {
        let text = ''
        try {
          text = readFileSync(p, 'utf8')
        } catch { continue }
        if (!text.includes('bash')) continue
        if (!text.includes('requestId') && !text.includes('"request"')) continue
        try {
          const parsed = JSON.parse(text)
          const hits = collectRequests(parsed, root)
          if (hits.length > 0) found.candidates.push({ source: `storage:${p}`, file: p, hits })
        } catch {
          // JSONL or partial: line-by-line.
          for (const line of text.split('\n')) {
            if (line === '') continue
            try {
              const hits = collectRequests(JSON.parse(line), root)
              if (hits.length > 0) found.candidates.push({ source: `storage-jsonl:${p}`, line: line.slice(0, 300), hits })
            } catch { /* not a JSON line */ }
          }
        }
      }
    }
  }
  walk(HOME, 0)
  writeEvidence(`${tag}-requestid-candidates.json`, found.candidates)
  if (found.candidates.length > 0) {
    found.source = found.candidates[0].source
    found.requestId = found.candidates[0].requestId ?? found.candidates[0].hits?.[0]?.requestId ?? null
  }
  return found
}

/** Collect pending control request ids for `root` from a parsed JSON node. */
function collectRequests(node, root, out = []) {
  if (node === null || typeof node !== "object") return out
  if (Array.isArray(node)) {
    for (const item of node) collectRequests(item, root, out)
    return out
  }
  // A control request row: has a requestId and is the bash ask (or a
  // request-shaped durable row). Accept both the flat shape and the
  // wrapped {payload:{…}} durable shape.
  const flat = node.payload !== null && typeof node.payload === "object" ? { ...node.payload, ...node } : node
  const looksLikeRequest = (
    typeof flat.requestId === "string"
    && (flat.toolName === "bash" || flat.actionName === "bash" || flat.kind === "user-approval" || flat.kind === "leader-approval")
    && (flat.status === undefined || flat.status === "pending")
  )
  if (looksLikeRequest) {
    const rowRoot = flat.rootSessionId ?? flat.payload?.rootSessionId
    if (rowRoot === undefined || rowRoot === root) {
      if (!out.some((o) => o.requestId === flat.requestId)) {
        out.push({ requestId: flat.requestId, status: flat.status ?? "unknown", toolName: flat.toolName ?? flat.actionName, source: "node" })
      }
    }
  }
  for (const v of Object.values(node)) {
    if (v !== null && typeof v === "object") collectRequests(v, root, out)
  }
  return out
}

/** The scripted approval (R2: the boot root is the host-known operator = human). */
/**
 * S3a — the human approval. LIVE-FOUND (run 11-02-31): the bash ask is
 * the LEADER's own ask → kind `user-approval` → resolvable by the HUMAN
 * ONLY (the skill: "Resolving a user-approval request as the Leader" is a
 * listed common mistake). The production human command is the remote
 * `team.resolveControl` (contract v4 — the v4-only method; the host's
 * T12-B4 principal seam stamps the human operator of the addressed root,
 * the wire carries no caller fields). A p6t6 executeTool as the boot
 * leader would resolve as an INSTANCE caller and be role-rejected.
 */
async function scriptedApproval(origin, cookie, requestId) {
  const res = await remoteCall(origin, cookie, 'team.resolveControl', {
    teamSessionId: CREATE_ROOT_B,
    requestId,
    decision: 'allow',
    note: 'rc2 smoke S3 scripted human resolution (plan §17; GUI approve stand-in)',
  }, 'rc2s3', 4)
  writeEvidence('s3-approval-response.json', res.body ?? res)
  return res
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`rc2 real-host smoke — stamp ${RUN_STAMP}`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`evidence=${RUN_DIR}`)

  preflight()
  const hostPort = await pickHostPort()
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} busy`)
  log(`ports: host=${hostPort} mock=${MOCK_PORT}`)

  // Zero-touch record: the live instances (read-only pre probe).
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  log(`stable pre-probe: 3080=${preStable.p3080.status} 3180=${preStable.p3180.status}`)

  // World materialization.
  rmSync(HOME, { recursive: true, force: true })
  rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(dirname(PROBE_TEAM_FILE), { recursive: true })
  writeFileSync(PROBE_TEAM_FILE, `${PROBE_TEAM_CONTENT}\n`)
  // The deny subtree probe file (must NOT be readable; its existence is
  // irrelevant — the rule is static before canonicalization reaches it, but
  // a missing file would make a naive canonicalizer fail-closed deny with a
  // DIFFERENT reason; we keep it present so the ONLY legal outcome is the
  // static subtree deny).
  const PROBE_RUNTIME_FILE = join(WORKSPACE, 'runtime', 'forbidden.txt')
  mkdirSync(dirname(PROBE_RUNTIME_FILE), { recursive: true })
  writeFileSync(PROBE_RUNTIME_FILE, 'rc2-smoke-runtime-probe\n')
  log('world materialized (probe files in scratch workspace)')

  // Mock model.
  const mockLog = join(RUN_DIR, 'mock.log')
  // DIAG (temporary): per-request decide input — the exact body keys +
  // the userTextOf view — so a NOOP-vs-match discrepancy is provable
  // from mock.log alone.
  const diag = (line) => {
    try {
      writeFileSync(mockLog, line + '\n', { flag: 'a' })
    } catch { /* best-effort */ }
  }
  const innerDecide = makeDecide()
  const decideDiag = ({ seq, req }) => {
    const ut = userTextOf(req)
    const keys = req !== null && typeof req === 'object' ? Object.keys(req) : [String(req)]
    // The closure-constant hit bits: if the kit's predicate matches a
    // marker but these bits are all false for the same request, the
    // decide closure captured different constants than the prompt side.
    const bits = ` seesDISC=${ut.includes(MK_DISC)} seesB=${ut.includes(MK_B)} seesCMEM=${ut.includes(MK_CMEM)}`
    diag(`diag: seq=${seq} bodyKeys=${JSON.stringify(keys)} userTextLen=${ut.length} head=${JSON.stringify(ut.slice(0, 120))}${bits}`)
    return innerDecide({ seq, req })
  }
  const dumpMock = (tag) => {
    try {
      const rows = mock.requests.map((r) => ({
        seq: r.seq,
        status: r.status ?? null,
        replyKind: r.reply !== undefined ? r.reply.kind : null,
        replyHead: r.reply !== undefined && typeof r.reply.content === 'string' ? r.reply.content.slice(0, 60) : null,
        userTextHead: r.body !== null ? userTextOf(r).slice(0, 120) : null,
        nToolMsgs: r.body !== null ? toolMsgsOf(r).length : null,
      }))
      writeFileSync(join(RUN_DIR, `mock-dump-${tag}.json`), JSON.stringify(rows, null, 2))
      // Raw body of the first four requests (shape evidence).
      mock.requests.slice(0, 4).forEach((r) => {
        if (r.body !== null) {
          writeFileSync(join(RUN_DIR, `raw-req-${r.seq}.json`), JSON.stringify(r.body, null, 2))
        }
      })
    } catch (e) { diag(`dumpMock(${tag}) failed: ${String(e)}`) }
  }
  // From here on this function OWNS a child host and a listening mock, so every
  // failure path must unwind into the `finally` below. Nothing inside the run
  // may call process.exit (dieFatal throws RunAborted once RC is armed).
  RC.arm()
  const removeSignalHandlers = RC.installSignalHandlers()
  let mock = null
  let booted = null
  const FAILS = []
  const fail = (id) => FAILS.push(id)
  let completed = false

  try {
  mock = await startMockModel({
    port: MOCK_PORT,
    decide: (req) => guardedDecide(req, decideDiag),
    log: (l) => {
      try {
        writeFileSync(mockLog, l + '\n', { flag: 'a' })
      } catch { /* best-effort */ }
    },
  })
  log(`mock model listening on ${mock.port}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })
  booted = await bootHost({ port: hostPort, home: HOME, mockPort: mock.port, instanceLog })
  // Capture-before-assert (run 6): every strict step oracle gets the raw
  // capture hook, so an error result / association failure persists its exact
  // call+result+host tail to the PRIVATE raw sink (never this run's
  // publishable evidence dir) before teardown removes the world. The verdict
  // itself is unchanged (the oracle re-throws).
  const strictCapture = (stage) => makeStrictFailureCapture({ stage, rawSinkDir: RAW_CAPTURE_SINK_DIR, statusEvidence: writeEvidence, log, instanceLog })
  log(`raw capture sink: ${RAW_CAPTURE_SINK_DIR === null ? 'NOT CONFIGURED — raw captures are written nowhere, public evidence keeps status refs only (pass --raw-evidence-dir <private gitignored dir> to enable)' : RAW_CAPTURE_SINK_DIR}`)
  // Independent of every wait: the child this run spawned may not outlive the
  // run budget. Killing is by the bound handle only — never by port or pattern.

    // ── LEG 0: discovery (the boot Leader's model-facing tool surface) ──
    log('── LEG 0: discovery ──')
    const discPrompt = await apiPrompt(booted.origin, booted.cookie, ROOT, MK_DISC)
    if (discPrompt.status !== 200) fail('L0')
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 120_000, 'DISC model request')
    if (discReq === null) {
      fail('L0')
      check('L0', 'discovery model request observed', false, `apiPrompt=${JSON.stringify(discPrompt.body).slice(0, 300)}`)
    } else {
      const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
      writeEvidence('leg0-surface.json', { surface, discRequest: { seq: discReq.seq, tools: surface } })
      log(`discovery surface (${surface.length} tools): ${surface.join(', ')}`)
      const denyList = deriveBuiltinToolDeny({
        surface,
        managed: MANAGED_TOOL_NAMES,
        safeUnmanaged: SAFE_UNMANAGED_TOOL_NAMES,
        teamCatalog: TEAM_TOOL_CATALOG,
      })
      const missingManaged = MANAGED_TOOL_NAMES.filter((n) => !surface.includes(n))
      // LIVE-FOUND (run 11-02-31): the minimal-style preset surface carries
      // 5 of the 7 managed tools (no lsp / no pwsh — the preset group set
      // only mounts the read/write/edit/read_image/bash stack). The smoke
      // legs only need read + bash; the missing managed names stay
      // informational in the evidence (leg0-denylist.json).
      check('L0', 'discovery captured the surface; read + bash present (minimal-style preset: 5/7 managed is the expected shape)',
        surface.includes('read') && surface.includes('bash'),
        `surface=${surface.length} missingManaged=[${missingManaged.join(',')}] denyList=[${denyList.join(',')}]`)
      writeEvidence('leg0-denylist.json', { denyList, missingManaged })
      // L0c + blueprint materialization are ONE ordered pre-flight step
      // (tests/kits/rc2-real-host-smoke/fixture-invariants.mjs). The earlier
      // version recorded a FAIL and then wrote the bad blueprints and called
      // team.create anyway — three more host calls against a fixture already
      // known to be invalid, which buried the cause in downstream failures.
      // Now the invariants run first, the criterion + evidence are recorded,
      // and the run ABORTS through the owner's cleanup (RunAborted → finally →
      // owned-child cleanup + mock.close) before a single B/C artifact exists.
      materializeBcFixtures({
        surface,
        managed: MANAGED_TOOL_NAMES,
        safeUnmanaged: SAFE_UNMANAGED_TOOL_NAMES,
        teamCatalog: TEAM_TOOL_CATALOG,
        leaderTeamTools: LEADER_TEAM_TOOLS_ALLOW,
        blueprints: {
          'rc2-b.yaml': { bpId: BP_B_ID, leaderPersona: `You are the leader of the rc2 smoke B team. ${P_LEADER_B}`, workerPersona: `You are worker-b of the rc2 smoke B team. ${P_WORKER_B}` },
          'rc2-c.yaml': { bpId: BP_C_ID, leaderPersona: `You are the leader of the rc2 smoke C team. ${P_LEADER_C}`, workerPersona: `You are worker-b of the rc2 smoke C team. ${P_WORKER_C}` },
        },
        renderBlueprint: (name, { bpId, leaderPersona, workerPersona, denyList: dl }) => savedBlueprintYaml(bpId, leaderPersona, workerPersona, dl),
        writeBlueprint: (name, yaml) => {
          writeFileSync(join(BLUEPRINT_DIR, name), yaml)
        },
        onViolations: (violations, ctx) => {
          const detail = `${violations.map((v) => `${v.code}=[${v.names.join(',')}]`).join(' ')} surface=${surface.length}`
          check('L0c', 'B/C fixture pre-flight: no team tool reaches builtinToolDeny, no unknown name in the leader allow lane', false, detail)
          fail('L0c')
          writeEvidence('fixture-preflight.json', { violations, denyList: ctx.denyList, surface, leaderTeamTools: LEADER_TEAM_TOOLS_ALLOW })
          RC.abort(`fixture pre-flight failed (${violations.map((v) => v.code).join(',')}) — refusing to materialize B/C blueprints or issue any B/C host call with a known-invalid fixture`, { violations })
        },
      })
      check('L0c', 'B/C fixture pre-flight passed (deny list names only non-team, non-managed tools)', true, `denyList=[${denyList.join(',')}]`)
      log(`saved blueprints B + C written (deny list = ${denyList.length} names)`)
      // DIAG early-exit: the mock MUST have matched the marker here —
      // otherwise every scripted downstream leg stalls (a NOOP reply ends
      // the turn; the tool-call chain never starts). Abort with the full
      // mock evidence instead of a 15-minute timeout cascade.
      if (discReq.reply === undefined || discReq.reply.kind !== 'text' || discReq.reply.content !== 'RC2_DISC_DONE') {
        dumpMock('disc-noop')
        throw new Error(
          `LEG 0 diagnostic abort: the DISC request (seq ${discReq.seq}) got reply ${JSON.stringify(discReq.reply).slice(0, 200)} — the mock did NOT match the marker it was served (see mock.log diag lines + raw-req-*.json + mock-dump-disc-noop.json)`,
        )
      }
    }

    if (FAILS.includes('L0')) {
      throw new Error('LEG 0 failed — aborting before team.create')
    }

    // ── S1–S4: create the B team; one continuous Leader turn ────────────
    log('── S1–S4: team B (bound blueprint) ──')
    // LIVE-FOUND (run 11-16-34): team.create WITH initialWork holds the
    // HTTP response until the initial-work leader turn goes IDLE
    // (the glue's deliverRootInput: followup + whenIdle + materialize) —
    // and the B turn includes the S3 bash ask, which blocks until the
    // HUMAN approval this kit issues. A sequential await here deadlocks
    // the approval for the full fetch timeout (the team creates fine;
    // only the response lags the turn). Issue the create as a PENDING
    // call; the S3 approval runs in-flight; the S4a check reads the
    // response after the turn settles (the bDone step below).
    const createBPending = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_B,
      blueprintId: BP_B_ID,
      initialWork: { prompt: MK_B },
    }, 'rc2b')
    let createBError = null
    createBPending.catch((e) => { createBError = e }) // no unhandled rejection while in flight
    // DIAG (0.2.0-rc.2 upgrade round): a create that settles EARLY — with a
    // rejection or a non-ok body — used to be invisible until the S4a check,
    // i.e. long after the S1/S2 mock waits had already timed out. (A create
    // WITH initialWork legitimately holds its response until the leader turn
    // goes idle, so a LATE settle is normal; an EARLY settle is the failure
    // signal.) Logged only — the S4a check stays the authoritative
    // criterion, nothing is weakened.
    createBPending.then(
      (r) => log(`DIAG team.create(B) settled early: status=${r?.status} body=${JSON.stringify(r?.body ?? r).slice(0, 600)}`),
      (e) => log(`DIAG team.create(B) rejected early: ${String(e?.message ?? e)}`),
    )
    const finishCreateB = async () => {
      const createB = createBError === null
        ? await createBPending
        : { status: 0, body: null, error: String(createBError?.message ?? createBError) }
      writeEvidence('s4-team-create-b.json', createB.body ?? createB)
      const createBOk = createB.status === 200
        && createB.body?.result?.ok === true
        && createB.body?.result?.value?.data?.path === 'fresh-root'
      check('S4a', 'team.create (B, bound blueprint) succeeds on the fresh root', createBOk,
        `status=${createB.status} body=${JSON.stringify(createB.body ?? createB).slice(0, 400)}`)
      if (!createBOk) fail('S4a')
      return createB
    }

    // Step 1: the B Leader turn starts (persona assertion — A2 T2).
    const bStart = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 0 && (r.body?.tools ?? []).length > 0, 180_000, 'B leader turn start')
    if (bStart === null) {
      fail('S1')
      check('S1', 'B leader turn started (model request observed)', false, `requests=${mock.requests.length}`)
    } else {
      const systemPrompt = systemTextOf(bStart)
      writeEvidence('s1-b-leader-request.json', { seq: bStart.seq, systemPrompt: systemPrompt.slice(0, 4000), tools: (bStart.body.tools ?? []).map((t) => t.function?.name ?? t.name) })
      check('S4b', 'B leader model request carries the BOUND blueprint B persona (not the row anchor A)',
        systemPrompt.includes(P_LEADER_B) && !systemPrompt.includes(P_LEADER_A),
        `hasB=${systemPrompt.includes(P_LEADER_B)} hasA=${systemPrompt.includes(P_LEADER_A)}`)
      if (!systemPrompt.includes(P_LEADER_B)) fail('S4b')
    }

    // Step 2: S1 — the allow-subtree read EXECUTED (tool result fed back),
    // and the decision was a static allow (observation), no control request.
    const bS1 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 1, 180_000, 'B chain step 1 (S1 read executed)')
    if (bS1 === null) {
      fail('S1')
      check('S1', 'allow-subtree read executed (tool result returned to the model)', false, `requests=${mock.requests.length}`)
    } else {
      const s1result = toolResultTextOf(bS1, { expectedCount: 1, expectedTool: 'read', onStrictFailure: strictCapture('S1') })
      check('S1a', 'S1: read team/test.md returned the probe content (executed, not blocked)',
        s1result.includes(PROBE_TEAM_CONTENT), `result=${s1result.slice(0, 200)}`)
      if (!s1result.includes(PROBE_TEAM_CONTENT)) fail('S1a')
      const s1state = await p6t6State(booted.port)
      writeEvidence('s1-state-after.json', s1state.body)
      const s1obs = (Array.isArray(s1state.body?.observations) ? s1state.body.observations : [])
        .map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
        .filter((l) => l.includes('alpha2-perm'))
      // The decision row: {"stage":"decision",...,"decision":"allow","provenance":{"source":"rule","effect":"allow","lane":"allow"}}
      const s1AllowDecision = s1obs.some((l) => /"stage":"decision"/.test(l) && /"decision":"allow"/.test(l))
      check('S1b', 'S1: static allow decision observed (decision:allow, rule provenance — subtree hit, no canonicalization failure)',
        s1AllowDecision && !s1obs.some((l) => /canonicalization-failed|containment-undeterminable/.test(l)),
        `obs(${s1obs.length})=[${s1obs.slice(-4).join(' | ').slice(0, 400)}]`)
      if (!s1AllowDecision || s1obs.some((l) => /canonicalization-failed|containment-undeterminable/.test(l))) fail('S1b')
      const s1ControlReq = Array.isArray(s1state.body?.control?.requests) ? s1state.body.control.requests : []
      check('S1c', 'S1: no control request created for the allow-lane read', s1ControlReq.length === 0, `requests=${JSON.stringify(s1ControlReq).slice(0, 200)}`)
      if (s1ControlReq.length > 0) fail('S1c')
    }

    // Step 3: S2 — the deny-subtree read is a static DENY (explicit rule,
    // NOT a canonicalization failure).
    const bS2 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 2, 180_000, 'B chain step 2 (S2 read executed)')
    if (bS2 === null) {
      fail('S2')
      check('S2', 'deny-subtree read reached a decision (tool result returned to the model)', false, `requests=${mock.requests.length}`)
    } else {
      const s2result = toolResultTextOf(bS2, { expectedCount: 2, expectedTool: 'read', allowError: true, onStrictFailure: strictCapture('S2') })
      const s2state = await p6t6State(booted.port)
      writeEvidence('s2-state-after.json', s2state.body)
      const s2obs = (Array.isArray(s2state.body?.observations) ? s2state.body.observations : [])
        .map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
        .filter((l) => l.includes('alpha2-perm'))
      // An EXPLICIT STATIC DENY = a decision row {"stage":"decision",...,"decision":"deny"}
      // with rule provenance — and NOT a canonicalization failure
      // (no "canonicalization-failed" / "containment-undeterminable" /
      // "deny-canonicalization-failure" row for this step).
      const s2StaticDeny = s2obs.some((l) => /"stage":"decision"/.test(l) && /"decision":"deny"/.test(l))
      const s2CanonicalizationFailure = s2obs.some((l) => /canonicalization-failed|containment-undeterminable/.test(l)) || s2result.includes('canonicaliz')
      check('S2a', 'S2: deny-subtree read produced an explicit static deny (decision:deny, NOT a canonicalization failure)', s2StaticDeny && !s2CanonicalizationFailure,
        `result=${s2result.slice(0, 200)} obs(${s2obs.length})=[${s2obs.slice(-4).join(' | ').slice(0, 300)}]`)
      if (!s2StaticDeny || s2CanonicalizationFailure) fail('S2a')
    }

    // Step 4: S3 — bash asks, the durable request is approved (human), the
    // command executes on the guard (no target-stale).
    const bS3Issued = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 2 && JSON.stringify(r.reply ?? '').includes('bash'), 120_000, 'B chain step 3 (bash issued)')
    if (bS3Issued === null) {
      fail('S3')
      check('S3', 'bash issued by the B leader (mock tool-call observed)', false, `requests=${mock.requests.length}`)
    } else {
      log('bash issued — waiting for the durable control request…')
      const disc = await discoverPendingRequestId(booted.port, CREATE_ROOT_B, 's3')
      if (disc.requestId === null) {
        writeEvidence('s3-diagnostic-mock.json', mock.requests.slice(-6).map((r) => ({ seq: r.seq, reply: r.reply })))
        fail('S3')
        check('S3a', 'S3: pending bash control requestId discovered (observations or storage)', false,
          `candidates=${JSON.stringify(disc.candidates).slice(0, 300)}`)
      } else {
        log(`pending requestId=${disc.requestId} (source=${disc.source})`)
        const approval = await scriptedApproval(booted.origin, booted.cookie, disc.requestId)
        const approvalOk = approval.status === 200
          && approval.body?.result?.ok !== false
          && JSON.stringify(approval.body).includes('allow')
        check('S3a', 'S3: scripted approval recorded a durable allow (human principal, boot root)', approvalOk,
          `status=${approval.status} body=${JSON.stringify(approval.body).slice(0, 400)}`)
        if (!approvalOk) fail('S3a')
        // The turn resumes: the bash tool result reaches the model.
        const bS3 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 3, 240_000, 'B chain step 3 complete (bash executed)')
        if (bS3 === null) {
          writeEvidence('s3-diagnostic-state.json', (await p6t6State(booted.port)).body)
          writeEvidence('s3-diagnostic-instance-tail.txt', logTail(booted.instanceLog, 60))
          fail('S3')
          check('S3b', 'S3: bash executed after approval (tool result returned — NO target-stale)', false, `requests=${mock.requests.length}`)
        } else {
          const s3result = toolResultTextOf(bS3, { expectedCount: 3, expectedTool: 'bash', onStrictFailure: strictCapture('S3') })
          check('S3b', 'S3: bash executed after approval — the echo output reached the model (guard passed, no target-stale)',
            s3result.includes('rc2-smoke'), `result=${s3result.slice(0, 200)}`)
          if (!s3result.includes('rc2-smoke')) fail('S3b')
          // S3c — the A6 proof at the guard level: the last-mile verdict
          // row {"stage":"guard-verdict","allowed":true,...,requestId} for
          // the approved request (the unfixed guard returned
          // allowed:false reason:target-stale here).
          const s3state = await p6t6State(booted.port)
          writeEvidence('s3-state-after-allow.json', s3state.body)
          const s3obs = (Array.isArray(s3state.body?.observations) ? s3state.body.observations : [])
            .map((o) => (typeof o === 'string' ? o : JSON.stringify(o)))
            .filter((l) => l.includes('alpha2-perm'))
          const s3GuardAllowed = s3obs.some((l) => /"stage":"guard-verdict"/.test(l) && /"allowed":true/.test(l))
          const s3GuardStale = s3obs.some((l) => /target-stale|target_stale/.test(l))
          check('S3c', 'S3: last-mile guard verdict allowed:true for the approved leader request (NO target-stale — A6 proof)',
            s3GuardAllowed && !s3GuardStale,
            `obs(${s3obs.length}) guardRows=[${s3obs.filter((l) => l.includes('guard-verdict')).slice(-3).join(' | ').slice(0, 300)}]`)
          if (!s3GuardAllowed || s3GuardStale) fail('S3c')
        }
      }
    }

    // Step 5: S4 — team_create_member(worker-b) on the bound blueprint
    // succeeds (pre-fix: row-anchor persona → post-commit reject).
    const bS4 = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 4, 240_000, 'B chain step 4 (create_member executed)')
    if (bS4 === null) {
      fail('S4c')
      check('S4c', 'S4: team_create_member(worker-b) executed (tool result returned)', false, `requests=${mock.requests.length}`)
    } else {
      const s4result = toolResultTextOf(bS4, { expectedCount: 4, expectedTool: 'team_create_member', onStrictFailure: strictCapture('S4') })
      writeEvidence('s4-create-member-result.json', { result: s4result.slice(0, 2000) })
      const s4ok = /member|created|inst-/.test(s4result) && !/reject|denied|error|unavailable|not found/i.test(s4result)
      check('S4c', 'S4: first create of the B-only template worker-b SUCCEEDED (no post-commit reject)', s4ok, `result=${s4result.slice(0, 300)}`)
      if (!s4ok) fail('S4c')
    }

    // Step 6: S4 — delegate to the B member; the member model request
    // carries the B worker persona (A2 binder proof).
    const bS4d = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 5, 240_000, 'B chain step 5 (delegate executed)')
    if (bS4d === null) {
      fail('S4d')
      check('S4d', 'S4: team_delegate executed (tool result returned)', false, `requests=${mock.requests.length}`)
    } else {
      check('S4d', 'S4: team_delegate executed (tool result returned)', true, 'delegate tool result observed')
      const bMember = await waitForMock(mock, (r) => r.body !== null && isChainTurn(r.body) && userTextOf(r).includes(MK_BMEM) && (r.body?.tools ?? []).length > 0, 240_000, 'B member turn')
      if (bMember === null) {
        fail('S4e')
        check('S4e', 'S4: the B member turn started (model request observed)', false, `requests=${mock.requests.length}`)
      } else {
        // Same reader class as S1a/S3b/S4c: the persona lives where the pinned host
        // puts it (systemText() covers both generations), not where role:'system'
        // happened to live in 0.1.x. S4b and S5c already used systemTextOf(), which
        // is why they passed while these two failed.
        const bMemberSystem = systemTextOf(bMember)
        writeEvidence('s4-b-member-request.json', { seq: bMember.seq, systemPrompt: bMemberSystem.slice(0, 4000) })
        check('S4e', 'S4: the B member carries blueprint B worker persona (binder resolved the BOUND blueprint)',
          bMemberSystem.includes(P_WORKER_B) && !bMemberSystem.includes(P_WORKER_A),
          `hasB=${bMemberSystem.includes(P_WORKER_B)} hasA=${bMemberSystem.includes(P_WORKER_A)}`)
        if (!bMemberSystem.includes(P_WORKER_B)) fail('S4e')
      }
    }

    // Step 7: the B chain completes.
    const bDone = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_B) && toolMsgsOf(r).length === 5 && (r.reply?.kind === 'text' ? r.reply.content : '').includes('RC2_SMOKE_B_DONE'), 120_000, 'B chain final text')
    check('S4f', 'S4: the B leader turn completed (final text RC2_SMOKE_B_DONE)', bDone !== null, `requests=${mock.requests.length}`)
    if (bDone === null) fail('S4f')

    // Step 8: the in-flight team.create B response — the turn is idle now,
    // so the delivery (followup + whenIdle) has settled and the response
    // carries the durable fresh-root facts. (LIVE-FOUND run 11-16-34: the
    // sequential await deadlocked the S3 approval 240 s out — the S4a
    // criterion is UNCHANGED, only the read timing moves to after idle.)
    await finishCreateB()

    // ── S5: team C (same row, same templateId, different persona) ────────
    log('── S5: team C (same row, blueprint C) ──')
    const createC = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_C,
      blueprintId: BP_C_ID,
      initialWork: { prompt: MK_C },
    }, 'rc2c')
    writeEvidence('s5-team-create-c.json', createC.body)
    const createCOk = createC.status === 200
      && createC.body?.result?.ok === true
      && createC.body?.result?.value?.data?.path === 'fresh-root'
    check('S5a', 'team.create (C, same row, blueprint C) succeeds', createCOk, `status=${createC.status} body=${JSON.stringify(createC.body).slice(0, 300)}`)
    if (!createCOk) fail('S5a')

    const cMember = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_CMEM) && (r.body?.tools ?? []).length > 0, 300_000, 'C member turn')
    if (cMember === null) {
      fail('S5b')
      check('S5b', 'S5: the C member turn started', false, `requests=${mock.requests.length}`)
    } else {
      const cMemberSystem = systemTextOf(cMember)
      writeEvidence('s5-c-member-request.json', { seq: cMember.seq, systemPrompt: cMemberSystem.slice(0, 4000) })
      check('S5b', 'S5: the C member carries blueprint C worker persona (root-scoped resolution)',
        cMemberSystem.includes(P_WORKER_C) && !cMemberSystem.includes(P_WORKER_B),
        `hasC=${cMemberSystem.includes(P_WORKER_C)} hasB=${cMemberSystem.includes(P_WORKER_B)}`)
      if (!cMemberSystem.includes(P_WORKER_C)) fail('S5b')
      // The B member keeps B's persona (re-assert on the captured request).
      // LIVE-FOUND (run 11-22-46): a bare marker re-scan can land on a TITLE
      // side-call (its human-message JSON nests the delegation prompt, so
      // the marker matches, but the system prompt is the title generator's
      // — no member persona → false S5c failure). Restrict to REAL model
      // requests (tools > 0), the same guard every other predicate uses.
      const bMemberAgain = mock.requests.find(
        (r) => r.body !== null && isChainTurn(r.body) && userTextOf(r).includes(MK_BMEM) && (r.body?.tools ?? []).length > 0,
      )
      const bMemberSystemAgain = systemTextOf(bMemberAgain)
      check('S5c', 'S5: the B member still carries B worker persona (no cross-team leak)',
        bMemberSystemAgain.includes(P_WORKER_B) && !bMemberSystemAgain.includes(P_WORKER_C),
        `requests=${mock.requests.length} memberReq=${bMemberAgain?.seq}`)
      if (!(bMemberSystemAgain.includes(P_WORKER_B) && !bMemberSystemAgain.includes(P_WORKER_C))) fail('S5c')
    }
    const cDone = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_C) && (r.reply?.kind === 'text' ? r.reply.content : '').includes('RC2_SMOKE_C_DONE'), 120_000, 'C chain final text')
    check('S5d', 'S5: the C leader turn completed (final text RC2_SMOKE_C_DONE)', cDone !== null, `requests=${mock.requests.length}`)
    if (cDone === null) fail('S5d')
    RC.check()
    completed = true
  } finally {
    // Teardown (evidence is flushed before the world goes). This now runs for
    // EVERY path out of the run — pass, failed leg, budget violation, unexpected
    // wire shape, throw inside a leg, SIGINT/SIGTERM — because no code below the
    // owner exits the process.
    // Keep ownership/watchdog until exit is actually observed, including a
    // child spawned by a bootHost that never returned. On cleanup failure,
    // preserve the world and fail instead of claiming a clean teardown.
    let cleanupError = null
    try { await RC.stopChild() } catch (err) { cleanupError = err }
    const ctl = RC.dispose()
    if (ctl.watchdogFired) log('teardown: the child-lifetime watchdog fired during this run')
    removeSignalHandlers()
    log('teardown: stopping host + mock')
    if (mock !== null) {
      try {
        await mock.close()
      } catch { /* best-effort */ }
    }
    const postStable = {
      p3080: await probeStableInstance('http://127.0.0.1:3080/'),
      p3180: await probeStableInstance('http://127.0.0.1:3180/'),
    }
    writeEvidence('post-stable-probe.json', postStable)
    // The mock request corpus (the forensic heart of the evidence).
    writeEvidence('mock-requests.json', (mock?.requests ?? []).map((r) => ({
      seq: r.seq,
      receivedAt: r.receivedAt,
      userText: userTextOf(r).slice(0, 300),
      toolMsgCount: toolMsgsOf(r).length,
      reply: r.reply,
    })))
    if (booted !== null) writeEvidence('instance-tail.txt', logTail(booted.instanceLog, 120))
    writeEvidence('run-budget.json', { budget: RC.budget.snapshot(), violation: RC.violation(), limits: RC.budget.limits })
    // Strict-assert captures were written at the assert point (before this
    // teardown); summary.json references ONLY the non-sensitive status files
    // (raw content lives solely in the private sink). Shared with the fatal
    // path via strictCaptureReferences() (finding 3).
    const strictFailureCaptures = strictCaptureReferences()
    if (strictFailureCaptures.length > 0) log(`teardown: strict-failure status references present: ${strictFailureCaptures.join(', ')}`)
    if (FLAG_KEEP || cleanupError !== null) {
      log(`--keep: world retained at ${HOME}`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
      log(`world removed (${HOME})`)
    }
    const passed = criteria.filter((c) => c.ok).length
    const summary = {
      runStamp: RUN_STAMP,
      hostBaseline: HOST_BASELINE_SHA,
      hostPort,
      mockPort: MOCK_PORT,
      worktree: WORKTREE,
      criteria,
      passed,
      total: criteria.length,
      failed: FAILS,
      stable: { pre: preStable, post: postStable },
      verdict: completed && !RC.aborted() && cleanupError === null && FAILS.length === 0 ? 'PASS' : 'FAIL',
      cleanupError: cleanupError === null ? null : String(cleanupError.message ?? cleanupError),
      runControl: { aborted: RC.aborted(), violation: RC.violation(), budget: RC.budget.snapshot() },
      strictFailureCaptures,
    }
    writeEvidence('summary.json', summary)
    log(`VERDICT ${summary.verdict} — ${passed}/${criteria.length} criteria passed${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)
    if (cleanupError !== null) throw cleanupError
  }

  // Exit code: 0 all pass / 2 a leg failed / 1 fatal (dieFatal handles).
  process.exit(FAILS.length === 0 ? 0 : 2)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => {
  try {
    log(`FATAL uncaught: ${e.stack ?? e}`)
    if (RUN_LOG !== null) writeFatalSummary(String(e.message ?? e))
  } catch { /* best-effort */ }
  // An abort means the owner's finally already stopped the child + mock; the
  // exit code only reports WHY the run ended (2 = budget/guard/failure path).
  process.exit(e instanceof RunAborted ? 2 : 1)
})
