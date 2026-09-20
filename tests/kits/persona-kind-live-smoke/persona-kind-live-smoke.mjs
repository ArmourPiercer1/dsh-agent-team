#!/usr/bin/env node
/**
 * persona-kind-live-smoke.mjs — the real-host live smoke for the
 * persona-requirement-preset-id fix (persona KIND convention, direction B).
 *
 * WHAT THIS PROVES (two worlds, two host instances, sequential):
 *
 * WORLD A (the fix, the full vertical):
 *   A1 — the UI pre-create probe (intent.probe) with the caller's persona
 *        fact keyed by a composable NON-STANDARD preset id (`ptc` — the
 *        live user's world: any preset id other than `standard`) against a
 *        blueprint requiring the persona kind `standard` returns
 *        **OPEN/PASS** (pre-fix: structural FATAL
 *        TEAM_PERSONA_COMPLETE_PRESET_CONFLICT with a copy falsely
 *        claiming "完整的系统人格"; the user could not self-rescue).
 *        The host resolved `ptc`'s effective persona kind from the preset's
 *        own composition (the `dsh-persona` row config — no `complete`
 *        flag) and rewrote the caller fact before the U5 merge.
 *   A2 — backward compatibility: the same probe with the `standard`
 *        preset id (a preset id that is also a kind) still returns OPEN.
 *   A3 — team.create on the same blueprint (bound via the saved-source
 *        catalog) succeeds on a fresh root: the post-creation admission
 *        gate consumes the row facts (persona/standard available) and
 *        admits.
 *   A4 — member activation: the created Leader's initial-work turn
 *        (scripted mock) creates a worker member from the blueprint
 *        template and delegates work to it; the member's model request
 *        carries the blueprint worker persona (root-scoped resolution) —
 *        the created team runs on the standard preset's composable
 *        persona + the blueprint identity.
 *
 * WORLD B (the honest lanes, probes only — nothing is created):
 *   B1 — the probe with the `minimal` preset (its persona section IS
 *        `complete: true`) returns BLOCKED_FATAL with the FROZEN code
 *        TEAM_PERSONA_COMPLETE_PRESET_CONFLICT and the honest detail
 *        (world kind `complete (unavailable)`) — the §13.5 conflict is
 *        preserved, and the caller's own wire claim (available: true) is
 *        discarded in favor of the host-resolved kind.
 *   B2 — the probe with a user preset carrying NO persona section
 *        (`pkfix-bare`, dropped via the public user-preset seam) returns
 *        BLOCKED_FATAL with the HONEST-LANE code PERSONA_INCOMPATIBLE
 *        (NOT the frozen code — the world provides no `complete` kind;
 *        the copy no longer lies about a "complete preset").
 *   B3 — the probe with a DELETED preset id (unresolvable) returns
 *        BLOCKED_FATAL PERSONA_INCOMPATIBLE with the raw id visible in
 *        the detail (fail-loud: the fact passes through unchanged —
 *        never a silent kind guess).
 *
 * DESIGN (pattern source: tests/kits/rc2-real-host-smoke):
 *   - host = the pristine test-use checkout (DSH 0.1.5-rc.2 @
 *     fb2c4b9e69) launched as `node <testuse>/apps/cli/lib/bin.js web`
 *     with cwd = a scratch session workspace (the frozen checkout is
 *     never touched).
 *   - env: DSH_HOME=<world home>, DSH_CLIENT_COMMIT_HASH=fb2c4b9e69,
 *     DEEPSEEK_BASE_URL=<in-process mock model — mock-deepseek.mjs>.
 *   - the production row is mounted ONLY through the public profile-patch
 *     seam: <worktree>/packages/runtime/dist/.../host.js (the rebuilt
 *     dist carrying the fix) + the dist glue + the root-binding seam.
 *   - row presets = the SHIPPED `standard` preset (legacy-mode row: the
 *     saved blueprint declares NO capabilities, so the full team-tool
 *     catalog reaches the Leader and no strict Coverage Gate applies).
 *   - world B additionally drops a user preset `pkfix-bare` (no persona
 *     row) through the public user-preset seam (DSH_HOME/.agent-presets).
 *   - the probe world's caller facts mirror the UI wire shape verbatim:
 *     {domain: 'persona', subject: <selected preset id>, available: true,
 *     generation: 0} — exactly what the TeamCreationPanel sends.
 *
 * USAGE:
 *   node tests/kits/persona-kind-live-smoke/persona-kind-live-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] \
 *     [--mock-port N] [--evidence-dir <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (4 levels
 *   up), --testuse = <worktree>/tests/deepseek-harness-test-use, host
 *   ports = first free of 3491–3500 (world A then world B), mock port
 *   = 3496, evidence dir =
 *   dev/agent-workflow/evidence/persona-requirement-kind/smoke-<stamp>/.
 *
 * EXIT: 0 = all criteria pass; 2 = a leg criterion failed (with the full
 * evidence dump); 1 = fatal (environment/boot/row).
 *
 * ZERO-TOUCH: the live instances :3080 and :3180 are probed read-only
 * (status recorded pre/post) and never written to. Worlds are
 * self-cleaned (rm -rf the home + blueprint dir) unless --keep.
 */

import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
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
const FLAG_KEEP = args.includes('--keep')

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
/**
 * The pristine test-use checkout is gitignored: it lives in the MAIN
 * checkout, while this kit may be executed from a task worktree.
 * Resolution order: --testuse override → <worktree>/tests/… (a
 * worktree-local copy, if one exists) → the main checkout's copy
 * (resolved through `git worktree list`).
 */
function resolveTestUse() {
  const explicit = argValue('testuse', null)
  if (explicit !== null) return resolve(explicit)
  const local = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
  if (existsSync(local)) return local
  const list = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: WORKTREE, encoding: 'utf8' })
  const mainLine = (list.stdout ?? '').split('\n').find((l) => l.startsWith('worktree '))
  if (mainLine !== undefined) {
    const main = resolve(mainLine.slice('worktree '.length))
    const candidate = join(main, 'tests', 'deepseek-harness-test-use')
    if (existsSync(candidate)) return candidate
  }
  dieFatal(`cannot locate the test-use checkout: tried ${local} and the main checkout's tests/deepseek-harness-test-use (git worktree list: ${JSON.stringify(list.stdout ?? list.stderr).slice(0, 200)})`)
}
const TESTUSE = resolveTestUse()
const EVIDENCE_DIR_ARG = argValue('evidence-dir', null)

// ── frozen facts ────────────────────────────────────────────────────────────

const HOST_BASELINE_SHA = 'fb2c4b9e698e30edb738bca4cf0618587db7d203' // DSH 0.1.5-rc.2 release point
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'persona-requirement-kind', `smoke-${RUN_STAMP}`)
const HOME_A = join(WORKTREE, 'tests', 'homes', `persona-kind-${RUN_STAMP}-a`)
const HOME_B = join(WORKTREE, 'tests', 'homes', `persona-kind-${RUN_STAMP}-b`)
const BLUEPRINT_DIR_A = join(WORKTREE, `.persona-kind-blueprints-${RUN_STAMP}-a`)
const BLUEPRINT_DIR_B = join(WORKTREE, `.persona-kind-blueprints-${RUN_STAMP}-b`)

const ROOT_A = `session-pkfix-root-a-${RUN_STAMP}`
const CREATE_ROOT_A = `session-pkfix-a-${RUN_STAMP}`
const ROOT_B = `session-pkfix-root-b-${RUN_STAMP}`

const BP_ANCHOR_ID_A = 'team.pkfix-anchor-a'
const BP_ANCHOR_ID_B = 'team.pkfix-anchor-b'
const BP_FIX_ID = 'team.pkfix-bp'

// Persona tokens (substring-asserted in the mock request system prompts).
const P_LEADER_A = `PKFIX_A_LEADER_${RUN_STAMP}`
const P_WORKER_A = `PKFIX_A_WORKER_${RUN_STAMP}`
const P_LEADER_B = `PKFIX_B_LEADER_${RUN_STAMP}`

// Distinct markers (no substring collisions).
const MK_A = `PKFIXMK_A_${RUN_STAMP}`
const MK_AMEM = `PKFIXMK_AMEM_${RUN_STAMP}`

// The UI wire fact shape (verbatim): the selected preset id + available.
const CALLER_FACT = (presetId) => ({ domain: 'persona', subject: presetId, available: true, generation: 0 })

// ── logging / criteria / fatals ─────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  try {
    if (RUN_LOG !== null) writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' })
  } catch { /* best-effort */ }
}

const criteria = []
function check(critId, name, ok, detail) {
  criteria.push({ id: critId, name, ok: Boolean(ok), detail: String(detail ?? '') })
  log(`${ok ? 'PASS' : 'FAIL'} ${critId} ${name}${detail ? ` — ${String(detail).slice(0, 300)}` : ''}`)
}

function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  } catch (e) {
    log(`evidence write failed (${name}): ${e.message}`)
  }
}

function dieFatal(msg, exitCode = 1) {
  log(`FATAL: ${msg}`)
  process.exit(exitCode)
}

// ── http helpers ────────────────────────────────────────────────────────────

async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
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
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

/** One browser-facing public Remote call: POST /team-remote/<method> (v1 wire). */
async function remoteCall(origin, cookie, method, params, tag = 'pkfix') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 240_000)
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'pkfix') {
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

function logTail(logPath, n = 40) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

/**
 * Read the log through a FRESH process (bypasses any per-process view of
 * the file — a WSL 9p page-cache anomaly observed once in this kit's arc:
 * in-process readFileSync returned an empty view of the host log for the
 * full 240s window while the host had already written the boot marker;
 * the FATAL tail read then saw everything).
 */
function readLogFresh(logPath) {
  const r = spawnSync('head', ['-c', '2000000', logPath], { encoding: 'utf8', timeout: 5000 })
  return r.status === 0 ? (r.stdout ?? '') : ''
}

async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  let freshEvery = 0
  for (;;) {
    let text = ''
    try {
      text = readFileSync(logPath, 'utf8')
    } catch { /* not written yet */ }
    if (text === '' && freshEvery % 10 === 0) {
      // The in-process view is empty — cross-check through a fresh process
      // before trusting it (WSL anomaly guard).
      text = readLogFresh(logPath)
    }
    const lines = text === '' ? [] : text.split('\n')
    for (let i = seen; i < lines.length; i += 1) {
      const m = regex.exec(lines[i])
      if (m !== null) return lines[i]
    }
    seen = lines.length
    freshEvery += 1
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  // Timeout diagnostics (forensic: did the host actually write the marker?).
  try {
    const stat = statSync(logPath)
    const tail = readLogFresh(logPath).split('\n').slice(-5).join(' | ')
    log(`waitForLogLine timeout: file=${logPath} size=${stat.size} mtime=${stat.mtime.toISOString()} lines=${stat.size === 0 ? 0 : readLogFresh(logPath).split('\n').length} tail=${tail.slice(0, 400)}`)
  } catch { /* best-effort */ }
  return null
}

async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch(() => ({ error: true }))
  return res.error === true
}

async function pickHostPort(used) {
  if (args.includes('--host-port') && used.length === 0) return Number(argValue('host-port', 0))
  for (const p of [3491, 3492, 3493, 3494, 3495, 3497, 3498, 3499, 3500]) {
    if (!used.includes(p) && await portFree(p)) return p
  }
  dieFatal('no free host port in 3491-3500')
}

/**
 * The mock-model port: the --mock-port override wins; otherwise the first
 * free port of the smoke range (3496 is the historical default — a
 * concurrent kit from another task may hold it, so fall through).
 */
async function pickMockPort(used) {
  if (args.includes('--mock-port')) return Number(argValue('mock-port', 0))
  for (const p of [3496, 3497, 3498, 3490, 3493, 3494, 3495, 3499, 3500]) {
    if (!used.includes(p) && await portFree(p)) return p
  }
  dieFatal('no free mock port')
}

// ── world materialization ───────────────────────────────────────────────────

function teamRowConfig({ root, blueprintSource, blueprintDir, environmentFacts }) {
  return {
    rootSessionId: root,
    bootPhase: 'create',
    // The row ANCHOR: a legacy leader with NO requirements (the boot team
    // is not the test subject — the saved blueprint pkfix-bp is).
    blueprintSource,
    blueprintDir,
    rootPresetId: 'standard',
    memberPresetId: 'standard',
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'pkfix-smoke-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts,
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

/**
 * The row anchor: a plain LEGACY leader, NO requirements, NO capabilities
 * (the boot team is not the test subject).
 */
function anchorYaml(bpId, leaderPersona) {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: "You are the leader of the pkfix smoke boot team. ${leaderPersona}"`,
    'members: []',
    'memberEnvelopes: []',
    'requirements: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/**
 * THE FIX BLUEPRINT (saved source, both worlds): the persona requirement
 * declares the KIND `standard` (the usual team requirement) + a leader and
 * one worker template. NO capabilities block: legacy mode — the full team-
 * tool catalog reaches the Leader and no strict Coverage Gate applies (the
 * row presets are the shipped `standard`).
 */
function fixBlueprintYaml(worldTag) {
  const leader = worldTag === 'a'
    ? `You are the leader of the pkfix smoke A team. ${P_LEADER_A}`
    : `You are the leader of the pkfix smoke B team. ${P_LEADER_B}`
  const worker = `You are a worker of the pkfix smoke A team. ${P_WORKER_A}`
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${BP_FIX_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leader)}`,
    'members:',
    '  - templateId: worker',
    '    displayName: PKFIX Worker',
    `    persona: ${JSON.stringify(worker)}`,
    'requirements:',
    '  - domain: persona',
    '    name: standard',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '  deny: []',
    'memberEnvelopes:',
    '  - templateId: worker',
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

/** The world-B user preset: NO persona row (kind `absent` — the honest lane). */
function writeBarePreset(home) {
  const dir = join(home, '.agent-presets', 'pkfix-bare')
  mkdirSync(dir, { recursive: true })
  const text = [
    '# pkfix-bare — persona-kind smoke preset (world B): NO persona row.',
    '# Dropped via the public user-preset seam (DSH_HOME/.agent-presets).',
    '- id: tool-fs',
    "  name: '@deepseek-ai/dsh-tool-fs'",
    '',
  ].join('\n')
  writeFileSync(join(dir, 'agent.cordis.yml'), text)
}

function writePatchFile(home, rowConfig) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const cfg = rowConfig
  const lines = [
    `# persona-kind smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist carrying the fix) — mounted ONLY through the public profile-patch seam.`,
    '- insert:',
    '  - id: dsh-agent-team',
    `    name: ${PRODUCTION_ROW_NAME}`,
    '    config:',
    `      rootSessionId: ${cfg.rootSessionId}`,
    '      bootPhase: create',
    `      blueprintSource: ${JSON.stringify(cfg.blueprintSource)}`,
    `      blueprintDir: ${cfg.blueprintDir}`,
    "      rootPresetId: standard",
    "      memberPresetId: standard",
    '      seedMembers: []',
    '      generation: 1',
    '      staticModel:',
    "        provider: deepseek-official",
    "        model: pkfix-smoke-model",
    '      deniedSelection: null',
    '      mcpServers: []',
    '      mcpServer: null',
    '      environmentFacts:',
    ...cfg.environmentFacts.map((f) => [
      `        - domain: ${f.domain}`,
      `          subject: ${f.subject}`,
      `          available: ${f.available}`,
      `          generation: ${f.generation}`,
    ]).flat(),
    '      externalPolicyFacts:',
    '        hard: {}',
    '        capabilityExists: {}',
    `      glueUrl: ${GLUE_URL}`,
    `      seamUrl: ${SEAM_URL}`,
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── the real-host boot (test-use bin) ───────────────────────────────────────

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        // The session workspace IS the host cwd (the frozen checkout is
        // never touched).
        cwd: join(home, 'workspace'),
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: 'fb2c4b9e69',
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'pkfix-smoke-mock-key',
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
  try {
    h.child.kill()
  } catch { /* already gone */ }
}

/**
 * Boot one world: patch file + blueprints (+ bare preset) + spawn + wait
 * for the boot URL + authenticate + wait for the remote catalog to serve
 * (row-ready gate without the p6t6 observability row: the catalog reads
 * are readiness-independent by the host's own gate design).
 */
async function bootWorld({ tag, home, blueprintDir, anchorBpId, anchorPersona, port, mockPort, extra }) {
  const workspace = join(home, 'workspace')
  mkdirSync(workspace, { recursive: true })
  mkdirSync(blueprintDir, { recursive: true })
  const rowConfig = teamRowConfig({
    root: tag === 'a' ? ROOT_A : ROOT_B,
    blueprintSource: anchorYaml(anchorBpId, anchorPersona),
    blueprintDir,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
  })
  writePatchFile(home, rowConfig)
  writeFileSync(join(blueprintDir, 'pkfix-bp.yaml'), fixBlueprintYaml(tag))
  if (extra) extra(home)
  const instanceLog = join(RUN_DIR, `instance-${tag}.log`)
  writeFileSync(instanceLog, '', { flag: 'w' })
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, h.alive)
  if (line === null) {
    stopHost(h)
    dieFatal(`world ${tag} boot failed (no boot marker)\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`unexpected boot url shape: ${line}`)
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`world ${tag} auth failed: ${e.message}`))
  // Row-ready gate: the saved fix blueprint RESOLVES through the catalog
  // (the strong parse — the same pre-flight the UI performs).
  const deadline = Date.now() + 240_000
  let cat = null
  for (;;) {
    cat = await remoteCall(origin, cookie, 'catalog.get', { blueprintId: BP_FIX_ID, blueprintRevision: 1 }, `pkfix-${tag}-cat`)
    if (cat.status === 200 && cat.body?.result?.ok === true) break
    if (h.exitInfo.exited) {
      stopHost(h)
      dieFatal(`world ${tag} host exited before catalog ready (code=${h.exitInfo.code})\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) {
      stopHost(h)
      dieFatal(`world ${tag} catalog not ready in 240s — last: status=${cat.status} body=${JSON.stringify(cat.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  // Runtime-ready gate: the catalog reads are servable BEFORE the team
  // runtime is ready (the host's own gate design), but intent.probe is
  // refused with details.reason 'runtime-not-ready' until the live boot
  // (row team) completes. Poll the probe itself until it stops refusing
  // (a real compatibility result — open or fatal — is the ready signal).
  const readyDeadline = Date.now() + 240_000
  let probe = null
  for (;;) {
    probe = await remoteCall(origin, cookie, 'intent.probe', {
      blueprintId: BP_FIX_ID,
      blueprintRevision: 1,
      environmentFacts: [{ domain: 'persona', subject: 'standard', available: true, generation: 0 }],
    }, `pkfix-${tag}-ready`)
    const reason = probe.body?.result?.error?.details?.reason
    if (reason !== 'runtime-not-ready') break
    if (h.exitInfo.exited) {
      stopHost(h)
      dieFatal(`world ${tag} host exited before runtime ready (code=${h.exitInfo.code})\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= readyDeadline) {
      stopHost(h)
      dieFatal(`world ${tag} runtime not ready in 240s — last: ${JSON.stringify(probe.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`world ${tag} booted at ${origin}; catalog resolves ${BP_FIX_ID}; runtime ready`)
  return { host: h, port: Number(m[1]), origin, cookie, instanceLog }
}

// ── mock helpers ────────────────────────────────────────────────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-pkfix-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

/**
 * ALL user message texts, joined (rc2 pattern). The runtime appends a
 * "Current runtime context" USER message after the first model request
 * (c1 LIVE-FOUND #1), so the trigger marker must be matched across the
 * whole user-text view — not the last user message only.
 */
function userTextOf(req) {
  const messages = (req.body?.messages ?? [])
  return messages
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
}

function toolMsgsOf(req) {
  return (req.body?.messages ?? []).filter((m) => m.role === 'tool')
}

/**
 * The instance id from a team_create_member tool result.
 * The `executed` result carries `targetInstanceId` (tools.ts
 * toExecutedResult) — the field name FIRST; the bare `instanceId` and the
 * inst- pattern are forensic fallbacks (rc2 kit pattern).
 */
function extractInstanceId(content) {
  const m =
    /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  return m === null ? null : m[1]
}

async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) {
      log(`mock wait timed out: ${label} (requests=${mock.requests.length})`)
      return null
    }
    await new Promise((r) => setTimeout(r, 400))
  }
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
  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
}

/**
 * One probe over the world: the EXACT UI wire call (version 1, the v1-era
 * method). Returns the parsed compatibility result or null (with the raw
 * envelope kept in `raw` on the returned object).
 */
async function probeWorld(world, presetId, tag) {
  const env = await remoteCall(world.origin, world.cookie, 'intent.probe', {
    blueprintId: BP_FIX_ID,
    blueprintRevision: 1,
    environmentFacts: [CALLER_FACT(presetId)],
  }, `pkfix-${tag}`)
  writeEvidence(`probe-${tag}-${presetId.replace(/[^a-z0-9-]/gi, '_')}.json`, env.body ?? env)
  const compat = env.body?.result?.value?.data?.compatibility ?? env.body?.result?.data?.compatibility
  return { status: env.status, raw: env.body ?? env, compat }
}

function personaRowOf(compat) {
  return (compat?.requirements ?? []).find((r) => String(r.requirementId ?? '').startsWith('req-persona'))
}

// ── the two worlds ──────────────────────────────────────────────────────────

async function runWorldA(usedPorts) {
  log('═══ WORLD A: the fix (probe ptc → PASS, create, member activation) ═══')
  const port = await pickHostPort(usedPorts)
  usedPorts.push(port)
  const mockPort = await pickMockPort(usedPorts)
  usedPorts.push(mockPort)
  const mockLog = join(RUN_DIR, 'mock-a.log')
  // The scripted mock chain for the A Leader's initial-work turn:
  //   step 1 (user text MK_A, no tool msgs yet): team_create_member(worker)
  //          — EXPLICIT creation from the blueprint template
  //   step 2 (after the create result): team_delegate to the NEW instance
  //          (instanceId extracted from the create result's
  //          targetInstanceId — the continue form; SD-GUARD on the instance)
  //   step 3 (after the delegate result): final text PKFIX_A_DONE
  //   Guard (rc2 discipline): the TITLE side-call nests the initial-work
  //   text in its human-messages JSON, so the marker matches it too — but
  //   it carries NO tools; restrict tool-call replies to real model
  //   requests (tools > 0).
  const decide = (ctx) => {
    const req = ctx.req
    if ((req?.tools ?? []).length === 0) {
      return { kind: 'text', content: 'PKFIX_A_NOOP' }
    }
    const text = userTextOf({ body: req })
    const nTool = toolMsgsOf({ body: req }).length
    if (text.includes(MK_A)) {
      if (nTool === 0) {
        return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_A,
          requestToken: `pkfix-a-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: 'pkfix worker',
        })
      }
      if (nTool === 1) {
        const createResult = toolMsgsOf({ body: req })[0]
        const instanceId = extractInstanceId(createResult?.content ?? '')
        return toolCall('team_delegate', {
          rootSessionId: CREATE_ROOT_A,
          requestToken: `pkfix-a-delegate-${RUN_STAMP}`,
          delegationInstanceId: instanceId,
          label: 'ping the worker',
          prompt: `Ping: reply with one word. ${MK_AMEM}`,
        })
      }
      return { kind: 'text', content: 'PKFIX_A_DONE' }
    }
    return { kind: 'text', content: 'PKFIX_A_NOOP' }
  }
  const mock = await startMockModel({
    port: mockPort,
    decide,
    log: (l) => { try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  log(`world A: mock model on ${mock.port}`)
  const booted = await bootWorld({
    tag: 'a',
    home: HOME_A,
    blueprintDir: BLUEPRINT_DIR_A,
    anchorBpId: BP_ANCHOR_ID_A,
    anchorPersona: P_LEADER_A,
    port,
    mockPort: mock.port,
  })
  const FAILS = []
  const fail = (id) => FAILS.push(id)
  try {
    // ── A1: THE BUG FIX — composable NON-STANDARD preset id → OPEN ──
    const a1 = await probeWorld(booted, 'ptc', 'A1')
    const a1row = personaRowOf(a1.compat)
    const a1ok = a1.status === 200
      && a1.compat?.status === 'OPEN'
      && a1row?.outcome === 'PASS'
    check('A1', 'probe (caller fact persona/ptc, the composable non-standard id) ⇒ OPEN — the bug fix (pre-fix: FATAL TEAM_PERSONA_COMPLETE_PRESET_CONFLICT)',
      a1ok,
      `status=${a1.status} compatStatus=${a1.compat?.status} personaRow=${JSON.stringify(a1row)?.slice(0, 200)}`)
    if (!a1ok) fail('A1')

    // ── A2: backward compatibility — the `standard` id (id === kind) ──
    const a2 = await probeWorld(booted, 'standard', 'A2')
    const a2ok = a2.status === 200 && a2.compat?.status === 'OPEN' && personaRowOf(a2.compat)?.outcome === 'PASS'
    check('A2', 'probe (caller fact persona/standard — id doubles as kind) ⇒ OPEN (zero config migration)',
      a2ok,
      `status=${a2.status} compatStatus=${a2.compat?.status}`)
    if (!a2ok) fail('A2')

    // ── A3: team.create on the fix blueprint (fresh root) ──
    const createA = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_A,
      blueprintId: BP_FIX_ID,
      initialWork: { prompt: MK_A },
    }, 'pkfix-a-create')
    writeEvidence('a3-team-create.json', createA.body ?? createA)
    const a3ok = createA.status === 200
      && createA.body?.result?.ok === true
      && createA.body?.result?.value?.data?.path === 'fresh-root'
    check('A3', 'team.create (fix blueprint, initialWork) succeeds on the fresh root (the post-creation admission gate admits)',
      a3ok,
      `status=${createA.status} body=${JSON.stringify(createA.body ?? createA).slice(0, 400)}`)
    if (!a3ok) fail('A3')

    // ── A4: member activation (create + delegate + worker persona) ──
    const aStart = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_A) && toolMsgsOf(r).length === 0 && (r.body?.tools ?? []).length > 0, 180_000, 'A leader turn start')
    const aMember = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_AMEM) && (r.body?.tools ?? []).length > 0, 180_000, 'A member turn')
    const aDone = await waitForMock(mock, (r) => r.body !== null && (r.reply?.kind === 'text' ? r.reply.content : '').includes('PKFIX_A_DONE'), 180_000, 'A chain final text')
    const aMemberSystem = aMember !== null
      ? (aMember.body.messages ?? []).filter((mm) => mm.role === 'system').map((mm) => (typeof mm.content === 'string' ? mm.content : JSON.stringify(mm.content ?? ''))).join('\n')
      : ''
    writeEvidence('a4-member-request.json', aMember !== null ? { seq: aMember.seq, systemPrompt: aMemberSystem.slice(0, 4000) } : { missing: true })
    const a4ok = aStart !== null && aMember !== null && aDone !== null && aMemberSystem.includes(P_WORKER_A)
    check('A4', 'member activation: the Leader created the worker + delegated; the member turn carries the blueprint worker persona (root-scoped resolution)',
      a4ok,
      `start=${aStart?.seq} member=${aMember?.seq} done=${aDone !== null} hasPersona=${aMemberSystem.includes(P_WORKER_A)}`)
    if (!a4ok) fail('A4')
  } finally {
    log('world A teardown')
    stopHost(booted.host)
    try { await mock.close() } catch { /* best-effort */ }
    writeEvidence('mock-a-requests.json', mock.requests.map((r) => ({
      seq: r.seq,
      toolCount: (r.body?.tools ?? []).length,
      userText: userTextOf({ body: r.body }).slice(0, 300),
      toolMessages: toolMsgsOf({ body: r.body }).map((tm) => String(tm.content ?? '').slice(0, 600)),
      reply: r.reply,
    })))
    writeEvidence(`instance-a-tail.txt`, logTail(booted.instanceLog, 120))
    if (FLAG_KEEP) log(`--keep: world A retained at ${HOME_A}`)
    else { rmSync(HOME_A, { recursive: true, force: true }); rmSync(BLUEPRINT_DIR_A, { recursive: true, force: true }) }
  }
  return FAILS
}

async function runWorldB(usedPorts) {
  log('═══ WORLD B: the honest lanes (minimal → frozen FATAL; bare → PERSONA_INCOMPATIBLE; deleted → pass-through) ═══')
  const port = await pickHostPort(usedPorts)
  usedPorts.push(port)
  const mockPort = await pickMockPort(usedPorts)
  usedPorts.push(mockPort)
  const mockLog = join(RUN_DIR, 'mock-b.log')
  const decide = () => ({ kind: 'text', content: 'PKFIX_B_NOOP' })
  const mock = await startMockModel({
    port: mockPort,
    decide,
    log: (l) => { try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  const booted = await bootWorld({
    tag: 'b',
    home: HOME_B,
    blueprintDir: BLUEPRINT_DIR_B,
    anchorBpId: BP_ANCHOR_ID_B,
    anchorPersona: P_LEADER_B,
    port,
    mockPort: mock.port,
    extra: (home) => writeBarePreset(home),
  })
  const FAILS = []
  const fail = (id) => FAILS.push(id)
  try {
    // ── B1: the §13.5 conflict PRESERVED — minimal IS a complete persona ──
    const b1 = await probeWorld(booted, 'minimal', 'B1')
    const b1row = personaRowOf(b1.compat)
    const b1ok = b1.status === 200
      && b1.compat?.status === 'BLOCKED_FATAL'
      && b1row?.outcome === 'FATAL'
      && b1row?.reasonCode === 'TEAM_PERSONA_COMPLETE_PRESET_CONFLICT'
      && String(b1row?.detail ?? '').includes('complete (unavailable)')
    check('B1', 'probe (caller fact persona/minimal — a complete:true preset) ⇒ BLOCKED_FATAL with the FROZEN code + honest detail (the §13.5 conflict preserved; the caller available:true claim is discarded)',
      b1ok,
      `status=${b1.status} compatStatus=${b1.compat?.status} row=${JSON.stringify(b1row)?.slice(0, 300)}`)
    if (!b1ok) fail('B1')

    // ── B2: the honest lane — a no-persona preset ⇒ PERSONA_INCOMPATIBLE ──
    const b2 = await probeWorld(booted, 'pkfix-bare', 'B2')
    const b2row = personaRowOf(b2.compat)
    const b2ok = b2.status === 200
      && b2.compat?.status === 'BLOCKED_FATAL'
      && b2row?.outcome === 'FATAL'
      && b2row?.reasonCode === 'PERSONA_INCOMPATIBLE'
      && String(b2row?.detail ?? '').includes('absent (unavailable)')
    check('B2', 'probe (caller fact persona/pkfix-bare — a preset with NO persona section) ⇒ BLOCKED_FATAL PERSONA_INCOMPATIBLE (the honest lane — NOT the frozen code; the copy no longer lies)',
      b2ok,
      `status=${b2.status} compatStatus=${b2.compat?.status} row=${JSON.stringify(b2row)?.slice(0, 300)}`)
    if (!b2ok) fail('B2')

    // ── B3: fail-loud — a deleted preset id passes through unchanged ──
    const b3 = await probeWorld(booted, 'pkfix-deleted', 'B3')
    const b3row = personaRowOf(b3.compat)
    const b3ok = b3.status === 200
      && b3.compat?.status === 'BLOCKED_FATAL'
      && b3row?.outcome === 'FATAL'
      && b3row?.reasonCode === 'PERSONA_INCOMPATIBLE'
      && String(b3row?.detail ?? '').includes('pkfix-deleted')
    check('B3', 'probe (caller fact persona/pkfix-deleted — an unresolvable id) ⇒ BLOCKED_FATAL PERSONA_INCOMPATIBLE with the raw id visible (fail-loud — never a silent kind guess)',
      b3ok,
      `status=${b3.status} compatStatus=${b3.compat?.status} row=${JSON.stringify(b3row)?.slice(0, 300)}`)
    if (!b3ok) fail('B3')
  } finally {
    log('world B teardown')
    stopHost(booted.host)
    try { await mock.close() } catch { /* best-effort */ }
    writeEvidence(`instance-b-tail.txt`, logTail(booted.instanceLog, 120))
    if (FLAG_KEEP) log(`--keep: world B retained at ${HOME_B}`)
    else { rmSync(HOME_B, { recursive: true, force: true }); rmSync(BLUEPRINT_DIR_B, { recursive: true, force: true }) }
  }
  return FAILS
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'kit.log')
  writeFileSync(RUN_LOG, '', { flag: 'w' })
  log(`persona-kind live smoke — run ${RUN_STAMP} — worktree=${WORKTREE} testuse=${TESTUSE}`)
  preflight()
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  log(`stable instances pre: ${JSON.stringify(preStable)}`)

  const usedPorts = []
  const failsA = await runWorldA(usedPorts)
  const failsB = await runWorldB(usedPorts)
  const FAILS = [...failsA, ...failsB]

  const postStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('post-stable-probe.json', postStable)
  log(`stable instances post: ${JSON.stringify(postStable)}`)

  const passed = criteria.filter((c) => c.ok).length
  const summary = {
    runStamp: RUN_STAMP,
    hostBaseline: HOST_BASELINE_SHA,
    worktree: WORKTREE,
    criteria,
    passed,
    total: criteria.length,
    failed: FAILS,
    stable: { pre: preStable, post: postStable },
    verdict: FAILS.length === 0 ? 'PASS' : 'FAIL',
  }
  writeEvidence('summary.json', summary)
  log(`VERDICT ${summary.verdict} — ${passed}/${criteria.length} criteria passed${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)
  process.exit(FAILS.length === 0 ? 0 : 2)
}

main().catch((e) => {
  try {
    log(`FATAL uncaught: ${e.stack ?? e}`)
    if (RUN_LOG !== null) writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: String(e.message ?? e) })
  } catch { /* best-effort */ }
  process.exit(1)
})
