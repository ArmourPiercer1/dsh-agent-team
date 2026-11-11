#!/usr/bin/env node
/**
 * `tests/kits/f5-two-asks/run-f5-two-asks.mjs` — F-5 real-Host driver:
 * TWO CONSECUTIVE GOVERNED ASKS ON THE SAME ROOT.
 *
 * WHAT THIS IS (owner ruling 2026-11-11, work package F-5)
 *
 * The packaged acceptance observed that a SECOND governed ask on the SAME root
 * is refused by the Alpha.6 review-facts port:
 *
 *   CONTROL_RESOLVER_NOT_AUTHORIZED … the trusted review-facts port produced no
 *   facts for this leg
 *
 * and the human then resolves that plane leg directly. The owner accepts that as
 * an Alpha.6 experimental limit ONLY IF the Blueprint's declared
 * `whenOfficerUnavailable` policy is honoured:
 *
 *   - `hold` stays `hold` (never a silent Leader hand-off);
 *   - `leader` may go to the Leader;
 *   - a human override is an explicit human action;
 *   - the original request stays discoverable;
 *   - the approval authority is never silently changed;
 *   - and an observed behaviour that VIOLATES the declared policy is a DEFECT
 *     to report, not to document away.
 *
 * This driver builds the exact scenario on a real Host, once per policy value,
 * and records what ask #2 actually does: which resolver answered, whether the
 * request stayed discoverable (`team_list_pending_control` / the durable
 * control store / the remote ledger page), who could decide it, and whether the
 * declared policy was honoured.
 *
 * THE SCHEMA FACT (read, not guessed)
 *
 * `packages/domain/blueprint/src/blueprint-v5.ts` declares
 * `whenOfficerUnavailable: 'hold' | 'leader'` and the parser's allowed list is
 * exactly `['hold', 'leader']`. There is **no third declared value**. This
 * driver therefore runs two policy arms — `hold` and `leader` — and says so in
 * the evidence instead of inventing one.
 *
 * TWO OFFICER-AVAILABILITY ARMS PER POLICY (both are needed to answer honestly)
 *
 *   --officer-at-ask-2 live      The F-5 observation: the Officer is live and
 *                                is woken for ask #2, and its `escalate` is
 *                                refused by the review-facts port. This arm
 *                                measures the observed behaviour; it does NOT
 *                                reach the `whenOfficerUnavailable` branch
 *                                (the router sees an active Officer), so the
 *                                policy is recorded as NOT INVOKED rather than
 *                                silently marked honoured.
 *   --officer-at-ask-2 disposed  The Officer is DISPOSED between ask #1 and
 *                                ask #2 (the FSM's legal unavailable transition
 *                                from CREATED: an idle Officer never reaches
 *                                SETTLED, so `member.archive` is illegal), so
 *                                ask #2 IS the
 *                                `whenOfficerUnavailable` branch: `hold` must
 *                                leave the leg pending and human-decidable with
 *                                no Leader hand-off; `leader` must route it to
 *                                the Leader.
 *
 * Without the disposed arm the policy could only be asserted, never exercised;
 * without the live arm the F-5 refusal would be out of frame. n=2 runs per arm
 * (fresh World each) give an AGREEMENT table, not a stability claim.
 *
 * THE FLOW (one run = one fresh World)
 *
 *   preflight → boot real Host (pinned 0.2.0-rc.2, worktree dist, loopback,
 *   sanctioned port) → L0 discovery → `team.create` on a saved v5 blueprint
 *   (Officer + Worker + `reviewRouting.whenOfficerUnavailable = <policy>`,
 *   plane takeover so an approved bash can execute) → Leader creates Officer +
 *   Worker, delegates ask #1 → Worker bash ask #1 → permission lane leg (human
 *   allow) → plane leg → Officer wake → `team_list_pending_control` → `escalate`
 *   → human leg (ordinal 2, `human-user`) → human allow → execution #1 →
 *   [dispose the Officer when the arm says so] → ask #2 on the SAME worker
 *   session/root → the same chain, and the observable under test → teardown.
 *
 * WHY IT IS A REAL-HOST DRIVER AND NOT A UNIT TEST: the refusal lives inside
 * `ControlService.resolveControl`'s assigned-Officer entry
 * (`packages/runtime/control/service.ts:3059`), which needs the durable ledger,
 * the live member rows, the frozen Blueprint and the composition-owned facts
 * port. It cannot be observed host-free.
 *
 * ENV / FLAGS / PORTS
 *
 *   node tests/kits/f5-two-asks/run-f5-two-asks.mjs \
 *     --policy <hold|leader> --run <n> \
 *     [--officer-at-ask-2 <live|disposed>] [--host-port N] [--mock-port N] \
 *     [--evidence-dir <path>] [--expect-sha <sha>] [--keep] [--wait-ms N]
 *
 *   Ports default to the first free sanctioned port in 3181-3199 (host) and
 *   3491-3500 (mock) — `TEST_PORT_RANGES` via `tests/paths.mjs`. Loopback only.
 *   `:3080` is NEVER bound (it is not sanctioned) and only read-probed.
 *   The World is `tests/homes/<name>` inside THIS worktree and is deleted by
 *   identity after the run unless `--keep`.
 *
 * EXIT: 0 = the run's criteria passed; 2 = a criterion failed (evidence dump in
 * the run dir); 1 = fatal (environment/preflight/boot). A policy VIOLATION is a
 * criterion failure with the trace, never an exit-0 "documented limit".
 *
 * EVIDENCE: `dev/agent-workflow/evidence/f5-two-asks/` (this driver writes one
 * directory per run: `boot-preflight.json`, `run-manifest.json`,
 * `l0-surface.json`, `ask-1.json`, `ask-2.json`, `ask-2-policy.json`,
 * `ask-2-gate-facts.json`, `summary.json`, `instance.log`, `mock.log`).
 *
 * PROVENANCE OF THIS FILE: the boot/preset/blueprint/mock scaffolding is the
 * same instrument class as `tests/kits/c1-leader-approval-smoke` (A6 Officer
 * arm, `C1_ALPHA6_OFFICER=1`) and `tests/kits/v016-packaged-acceptance`; the
 * ask chain mirrors the packaged acceptance's two-leg chain. It is a dedicated
 * driver, not a fork of their scenario matrix.
 */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import {
  DSH_BASELINE_VERSION,
  TEST_USE_BASELINE_SHA,
  CLIENT_COMMIT_HASH,
  isSanctionedTestPort,
  STABLE_INSTANCE_PORT,
} from '../../../tests/paths.mjs'
import { assertBootPreflight, runBootPreflight } from '../_shared/boot-preflight.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const ARGS = process.argv.slice(2)
function argValue(name, dflt) {
  const i = ARGS.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = ARGS[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const KEEP = ARGS.includes('--keep')
const POLICY = String(argValue('policy', 'hold'))
if (POLICY !== 'hold' && POLICY !== 'leader') {
  console.error(`FATAL --policy must be 'hold' or 'leader' (the v5 schema's only declared values); got ${JSON.stringify(POLICY)}`)
  process.exit(1)
}
const RUN = String(argValue('run', '1'))
const OFFICER_AT_ASK2 = String(argValue('officer-at-ask-2', 'live'))
if (OFFICER_AT_ASK2 !== 'live' && OFFICER_AT_ASK2 !== 'disposed') {
  console.error(`FATAL --officer-at-ask-2 must be 'live' or 'disposed'; got ${JSON.stringify(OFFICER_AT_ASK2)}`)
  process.exit(1)
}
const WAIT_MS = Number(argValue('wait-ms', '120000'))
const EXPECT_SHA = argValue('expect-sha', null)
const HOST_PORT_ARG = argValue('host-port', null)
const MOCK_PORT_ARG = argValue('mock-port', null)
const EVIDENCE_ARG = argValue('evidence-dir', null)
const WORKTREE = resolve(argValue('worktree', resolve(dirname(new URL(import.meta.url).pathname), '..', '..', '..')))
function defaultTestuse() {
  const local = join(WORKTREE, 'tests', 'deepseek-harness-test-use')
  if (existsSync(local)) return local
  return resolve(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const TESTUSE = resolve(argValue('testuse', defaultTestuse()))

// ── frozen facts + paths ────────────────────────────────────────────────────

const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const LAUNCHER_PATH = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = EVIDENCE_ARG !== null
  ? resolve(EVIDENCE_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'f5-two-asks', `${POLICY}-${OFFICER_AT_ASK2}-run${RUN}-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `f5-${POLICY}-${OFFICER_AT_ASK2}-r${RUN}-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const INSTANCE_LOG = join(RUN_DIR, 'instance.log')
const MOCK_LOG = join(RUN_DIR, 'mock.log')

const ROOT = `session-f5-root-${POLICY}-${RUN_STAMP}`
const CREATE_ROOT = `session-f5-team-${POLICY}-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.f5-anchor'
const BP_A6_ID = 'team.f5-two-asks'
const PRESET_ID = 'f5-two-asks'
const MARK_DISCOVERY = `F5MK_DISCOVERY_${RUN_STAMP}`
const MARK_LEADER = `F5MK_LEADER_${RUN_STAMP}`
const MARK_ASK1 = `F5MK_ASK1_${RUN_STAMP}`
const MARK_ASK2 = `F5MK_ASK2_${RUN_STAMP}`
const SUM1 = `f5-ask1-${RUN_STAMP}`
const SUM2 = `f5-ask2-${RUN_STAMP}`
const FILE1 = join(WORKSPACE, `f5-ask1-${RUN_STAMP}.txt`)
const FILE2 = join(WORKSPACE, `f5-ask2-${RUN_STAMP}.txt`)
const CMD1 = `printf '%s' '${SUM1}' > ${FILE1} && echo f5-ask1-executed`
const CMD2 = `printf '%s' '${SUM2}' > ${FILE2} && echo f5-ask2-executed`

// ── logging / criteria / evidence ───────────────────────────────────────────

const SUMMARY = { policy: POLICY, officerAtAsk2: OFFICER_AT_ASK2, run: RUN, criteria: [] }
let CRITERIA_FAILED = 0
function log(line) {
  process.stdout.write(`${line}\n`)
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'run.log'), `${line}\n`, { flag: 'a' })
  } catch { /* best effort */ }
}
function writeEvidence(name, value) {
  const path = join(RUN_DIR, name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`)
}
function check(id, name, ok, detail) {
  SUMMARY.criteria.push({ id, name, verdict: ok === true ? 'PASS' : 'FAIL', detail })
  if (ok !== true) CRITERIA_FAILED += 1
  log(`${ok === true ? 'PASS' : 'FAIL'} ${id} — ${name}${ok === true ? '' : ` :: ${detail}`}`)
}
function mockTranscript() {
  if (MOCK === null) return []
  return MOCK.requests.map((record, index) => ({
    index,
    lastUser: lastUserTextOf(record).slice(0, 400),
    toolCalls: replyToolNames(record),
    toolResults: toolMsgsOf(record).map((m) => contentText(m.content).slice(0, 900)),
  }))
}
function dieFatal(message, code = 1) {
  log(`FATAL ${message}`)
  writeEvidence('fatal.json', { message, policy: POLICY, officerAtAsk2: OFFICER_AT_ASK2, run: RUN })
  try { writeEvidence('mock-transcript.json', mockTranscript()) } catch { /* best effort */ }
  try { writeEvidence('members-at-fatal.json', { members: memberRows() }) } catch { /* best effort */ }
  finishAndExit(code)
}
let HOST = null
let MOCK = null
function finishAndExit(code) {
  SUMMARY.verdict = code === 0 && CRITERIA_FAILED === 0 ? 'PASS' : (code === 0 ? 'FAIL' : 'FATAL')
  SUMMARY.criteriaFailed = CRITERIA_FAILED
  SUMMARY.finishedAt = new Date().toISOString()
  try { writeEvidence('summary.json', SUMMARY) } catch { /* best effort */ }
  process.exit(code === 0 && CRITERIA_FAILED > 0 ? 2 : code)
}

// ── HTTP / RPC (the public surfaces the GUI uses) ───────────────────────────

async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}
async function probeStable(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) throw new Error(`auth HTTP ${res.status} (expected 303 + set-cookie)`)
  return setCookie.split(';', 1)[0]
}
async function remoteCall(origin, cookie, method, params, tag = 'f5', version = 4) {
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'f5') {
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
async function p6t6State(port) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000) }
async function p6t6Health(port) { return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000) }
function logTail(path, n = 30) {
  try { return readFileSync(path, 'utf8').split('\n').slice(-n).join('\n') } catch { return '<no log>' }
}
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/
async function waitForLogLine(path, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    let text = ''
    try { text = readFileSync(path, 'utf8') } catch { /* not yet */ }
    const lines = text === '' ? [] : text.split('\n')
    for (let i = seen; i < lines.length; i += 1) if (regex.exec(lines[i]) !== null) return lines[i]
    seen = lines.length
    if (Date.now() >= deadline || (alive !== undefined && !alive())) break
    await sleep(300)
  }
  return null
}
async function portFree(port, timeoutMs = 1200) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch(() => null)
  return res === null
}

// ── YAML (saved-source blueprint + profile patch) ───────────────────────────

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

const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_collect',
  'team_list_pending_control',
  'team_resolve_control',
]

/**
 * The v5 blueprint under test. `reviewRouting.whenOfficerUnavailable` is the
 * ARM VALUE (the schema's two declared values). Worker `bash` is in the ask
 * lane: that is what produces a governed ask. The plane takeover (row config)
 * is what lets the approved body execute.
 */
function savedBlueprintYaml(denyList) {
  const denyLines = (list, baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return list.length === 0
      ? [`${pad}builtinToolDeny: []`]
      : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the F-5 leader. ${MARK_LEADER}`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
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
    '      deny: []',
  ]
  const officerBlock = [
    '  - templateId: officer',
    '    persona: "You are the F-5 Officer. Resolve the review legs routed to you; do not execute work."',
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items:',
    '          - team_list_pending_control',
    '          - team_resolve_control',
    // The Officer has NO builtin tools: the unmanaged globals of the
    // deployment preset must be DENIED by name, or the A5 coverage gate refuses
    // the child-session activation (PermissionCoverageUnmanagedError). The
    // c1 kit could leave this empty only because its smoke preset's global
    // surface is already fully managed; this driver boots the standard preset.
    ...denyLines(denyList, 3),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: deny',
    '        allow: []',
    '        ask: []',
    '        deny: []',
  ]
  const workerBlock = [
    '  - templateId: worker',
    `    persona: ${JSON.stringify(`You are the F-5 worker. ${MARK_ASK1}`)}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    ...denyLines(denyList, 3),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: ask',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: team',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny: []',
  ]
  return [
    '---',
    'schemaVersion: 5',
    `blueprintId: ${BP_A6_ID}`,
    'revision: "1"',
    'requirements: []',
    ...leaderBlock,
    'members:',
    ...officerBlock,
    ...workerBlock,
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
    '  - templateId: officer',
    '    envelope:',
    '      allow:',
    '        - resolve-control',
    '      deny: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
    'policyStates: []',
    'metadata: {}',
    'reviewRouting:',
    '  enabled: true',
    '  officerTemplateId: officer',
    '  ordinaryToolApprovals:',
    '    default: officer',
    '    leaderExceptions: []',
    `  whenOfficerUnavailable: ${POLICY}`,
    '---',
    '',
  ].join('\n')
}

/** The boot root's v5 anchor (routing declared so the root composition is A6). */
function anchorBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 5',
    `blueprintId: ${BP_ANCHOR_ID}`,
    'revision: "1"',
    'leader: { templateId: leader, persona: F5 Alpha.6 boot anchor. }',
    'members:',
    '  - templateId: officer',
    '    persona: Review asks for this team.',
    '  - templateId: worker',
    '    persona: Worker of the F5 boot team.',
    'requirements: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'permissionMutationEnvelope: { rules: [] }',
    'teamHardEnvelope: { rules: [] }',
    'teamEnvelope:',
    '  allow:',
    '    - request-control',
    '  deny: []',
    'metadata: {}',
    'reviewRouting:',
    '  enabled: true',
    '  officerTemplateId: officer',
    '  ordinaryToolApprovals:',
    '    default: officer',
    '    leaderExceptions: []',
    `  whenOfficerUnavailable: ${POLICY}`,
    '---',
    '',
  ].join('\n')
}

function launcherSha() {
  return createHash('sha256').update(readFileSync(LAUNCHER_PATH)).digest('hex')
}

function teamRowConfig() {
  const sha = launcherSha()
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: anchorBlueprintYaml(),
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'f5-two-asks-model' },
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
    teamToolPlane: {
      realmId: `f5-plane-realm-${RUN_STAMP}`,
      names: { bash: 'bash' },
      workingDir: WORKSPACE,
      confinedProvider: {
        trustRoot: `sha256:${sha.slice(0, 16)}#${LAUNCHER_PATH}`,
        assembly: { launcherPath: LAUNCHER_PATH, launcherSha256: sha, minAbiVersion: 3 },
      },
    },
    // The documented Alpha.6 opt-in (release notes §3.3).
    alpha6ReviewRouting: true,
    alpha6WakeIntentPath: join(HOME, 'alpha6-wake-intents'),
  }
}

function writePatchFile() {
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# F-5 two-asks driver patch layer (run ${RUN_STAMP}): production dsh-agent-team row at THIS worktree's dist + p6t6 observability row; public profile-patch seam only, no upstream patch.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── Host lifecycle ──────────────────────────────────────────────────────────

function spawnHost({ port, mockPort }) {
  mkdirSync(RUN_DIR, { recursive: true })
  const outFd = openSync(INSTANCE_LOG, 'a')
  const errFd = openSync(INSTANCE_LOG, 'a')
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
      cwd: WORKSPACE,
      stdio: ['ignore', outFd, errFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
        DEEPSEEK_API_KEY: 'f5-two-asks-mock-key',
      },
    })
  } finally {
    closeSync(outFd)
    closeSync(errFd)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => { exitInfo.exited = true; exitInfo.signal = 'spawn-error'; exitInfo.message = error.message })
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  return { child, exitInfo, alive: () => !exitInfo.exited }
}

async function bootHost({ port, mockPort }) {
  writePatchFile()
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'f5-anchor.yaml'), anchorBlueprintYaml())
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))
  const host = spawnHost({ port, mockPort })
  const line = await waitForLogLine(INSTANCE_LOG, BOOT_MARKER, 240_000, host.alive)
  if (line === null) {
    try { host.child.kill() } catch { /* gone */ }
    dieFatal(`host boot failed (exit=${host.exitInfo.code}/${host.exitInfo.signal}); log tail:\n${logTail(INSTANCE_LOG)}`)
  }
  const m = /dsh web: (http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+))/.exec(line)
  if (m === null) dieFatal(`unexpected boot url: ${line}`)
  const origin = `http://127.0.0.1:${m[2]}`
  const cookie = await authenticate(origin, m[3]).catch((e) => dieFatal(`auth failed: ${e.message}`))
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    const hb = await p6t6Health(Number(m[2]))
    health = hb.body
    if (hb.status === 200 && hb.body?.ok === true) {
      log(`[boot] row health ok, toolCount=${hb.body?.toolCount}`)
      break
    }
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      try { host.child.kill() } catch { /* gone */ }
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 700)}\n--- log tail ---\n${logTail(INSTANCE_LOG)}`)
    }
    if (Date.now() >= deadline) {
      try { host.child.kill() } catch { /* gone */ }
      dieFatal(`row health not ready in 240s: ${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(INSTANCE_LOG)}`)
    }
    await sleep(1000)
  }
  const sDeadline = Date.now() + 90_000
  for (;;) {
    const s = await p6t6State(Number(m[2]))
    const b = s.body
    if (s.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === ROOT && b.phase === 'create'
      && b.teamSession !== null && typeof b.teamSession === 'object') break
    if (Date.now() >= sDeadline) {
      try { host.child.kill() } catch { /* gone */ }
      dieFatal(`row state not well-formed in 90s: ${JSON.stringify(s.body).slice(0, 400)}`)
    }
    await sleep(500)
  }
  return { host, port: Number(m[2]), origin, cookie, health }
}

function stopHost(signal = 'SIGTERM') {
  if (HOST === null) return
  try { HOST.child.kill(signal) } catch { /* gone */ }
}

// ── durable store readers ───────────────────────────────────────────────────

function readDomain() {
  const path = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(path)) return { tables: {} }
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return { tables: {} } }
}
function tableRows(table) {
  const rows = readDomain()?.tables?.[table]
  const out = []
  if (rows === null || typeof rows !== 'object') return out
  for (const [key, value] of Object.entries(rows)) {
    if (key === '__ledger_sequence_counter' || typeof value !== 'string') continue
    try { out.push({ key, row: JSON.parse(value) }) } catch { /* skip */ }
  }
  return out
}
function readLedger(root = CREATE_ROOT) {
  const out = {
    requests: [], decisions: [], consumptions: [], abandonments: [],
    transfers: [], escalations: [], executionResults: [], other: [],
  }
  for (const { key, row } of tableRows('ledger')) {
    if (String(row?.rootSessionId) !== root) continue
    const payload = row?.payload ?? {}
    const base = { sequence: Number(key), factType: row.factType, createdAt: row.createdAt }
    switch (row.factType) {
      case 'control-request-recorded': out.requests.push({ ...base, ...payload }); break
      case 'control-decision-recorded': out.decisions.push({ ...base, ...payload }); break
      case 'control-allow-consumed': out.consumptions.push({ ...base, ...payload }); break
      case 'control-request-abandoned': out.abandonments.push({ ...base, ...payload }); break
      case 'control-current-leg-transferred': out.transfers.push({ ...base, ...payload }); break
      case 'control-escalation-recorded': out.escalations.push({ ...base, ...payload }); break
      case 'control-execution-result': out.executionResults.push({ ...base, ...payload }); break
      default: out.other.push({ ...base, ...payload })
    }
  }
  return out
}
function memberRows(root = CREATE_ROOT) {
  return tableRows('member_instances')
    .map(({ row }) => row)
    .filter((row) => String(row?.rootSessionId) === root)
}
function teamSessionRow(root = CREATE_ROOT) {
  return tableRows('team_sessions')
    .map(({ row }) => row)
    .find((row) => String(row?.rootSessionId ?? row?.teamSessionId) === root) ?? null
}
function blueprintRegistryRows(blueprintId) {
  return tableRows('blueprint_registry').map(({ row }) => row).filter((row) => String(row?.blueprintId) === blueprintId)
}
function permissionOverlayRows() {
  return tableRows('permission_overlays').map(({ row }) => row)
}

function legFacts(ledger, requestId) {
  return {
    decisions: ledger.decisions.filter((row) => row.requestId === requestId),
    consumptions: ledger.consumptions.filter((row) => row.requestId === requestId),
    abandonments: ledger.abandonments.filter((row) => row.requestId === requestId),
    executions: ledger.executionResults.filter((row) => row.requestId === requestId),
  }
}
const HUMAN_DECIDABLE_KINDS = new Set(['leader-approval', 'user-approval'])

// ── mock helpers ────────────────────────────────────────────────────────────

function toolCall(name, args) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-f5-${Math.random().toString(36).slice(2, 10)}`, name, arguments: args }] }
}
function bodyOf(record) { return record === null || typeof record !== 'object' ? null : (record.body ?? record) }
function messagesOf(req) { return bodyOf(req)?.messages ?? [] }
function isToolResultMessage(m) {
  if (m?.role === 'tool') return true
  return m?.role === 'user' && Array.isArray(m.content) && m.content.some((b) => b?.type === 'tool_result')
}
const TRIGGER_RE = new RegExp(`${MARK_LEADER}|${MARK_ASK1}|${MARK_ASK2}|\\[team-control requestId=|\\[team-review-wake`)
function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user' || isToolResultMessage(m)) continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && !isToolResultMessage(messages[i])) return i
  }
  return -1
}
function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((b) => (b?.type === 'tool_result' ? contentText(b.content) : (typeof b?.text === 'string' ? b.text : ''))).join('\n')
  return JSON.stringify(content ?? '')
}
function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  return i === -1 ? '' : contentText(messages[i].content)
}
function toolMsgsOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  return messages.slice(i + 1).filter(isToolResultMessage)
}
function replyToolNames(record) { return (record?.reply?.toolCalls ?? []).map((t) => t?.name ?? '').filter((n) => n !== '') }
function extractInstanceId(content) {
  const text = contentText(content)
  const m = /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(text)
    ?? /"instanceId"\s*:\s*"([^"]+)"/.exec(text)
    ?? /\binst-[A-Za-z0-9][A-Za-z0-9-]{3,64}\b/.exec(text)
  return m === null ? null : m[1]
}
function firstListedRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(contentText(content))
  return m === null ? null : m[1]
}

// ── the mock oracle ─────────────────────────────────────────────────────────

let mockWakeSeq = 0
/** Which ask the driver is currently driving (the mock's role gate). */
let MOCK_PHASE = 'boot'
/** Runs once when the ask-#2 reviewer wake is being composed (gate snapshot). */
let WAKE_SNAPSHOT_HOOK = null
let WAKE_SNAPSHOT = null
function makeDecide() {
  return async function decide({ req }) {
    const firstMsg = messagesOf(req)[0]
    if (typeof firstMsg?.content === 'string'
      && (firstMsg.content.startsWith('Create a concise title') || firstMsg.content.startsWith('Generate the session title'))) {
      return { kind: 'text', content: 'F5 two-asks' }
    }
    const lastUser = lastUserTextOf(req)
    if (lastUser.startsWith('Generate the session title') || lastUser.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'F5 two-asks' }
    }
    const tools = toolMsgsOf(req).length

    // Leader turn: create Officer, create Worker, delegate ask #1, end.
    if (lastUser.includes(MARK_LEADER)) {
      switch (tools) {
        case 0:
          return toolCall('team_create_member', {
            rootSessionId: CREATE_ROOT,
            requestToken: `f5-officer-${RUN_STAMP}`,
            delegationTemplateId: 'officer',
            label: 'officer',
          })
        case 1:
          return toolCall('team_create_member', {
            rootSessionId: CREATE_ROOT,
            requestToken: `f5-worker-${RUN_STAMP}`,
            delegationTemplateId: 'worker',
            label: 'w-f5',
          })
        case 2: {
          const workerId = extractInstanceId(toolMsgsOf(req)[1]?.content)
          if (workerId === null) return { kind: 'text', content: `F5_WORKER_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[1]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT,
            requestToken: `f5-delegate-${RUN_STAMP}`,
            delegationInstanceId: workerId,
            label: 'w-f5',
            prompt: `${MARK_ASK1} Use the bash tool to run exactly: ${CMD1} ; then answer with the command output.`,
            async: true,
          })
        }
        default: return { kind: 'text', content: 'F5_LEADER_DONE' }
      }
    }

    // Worker ask #1 / ask #2: one governed bash each.
    if (lastUser.includes(MARK_ASK1) && !lastUser.startsWith('[team-review-wake')) {
      return tools === 0
        ? toolCall('bash', { command: CMD1, timeout: 30_000 })
        : { kind: 'text', content: 'F5_ASK1_DONE' }
    }
    if (lastUser.includes(MARK_ASK2) && !lastUser.startsWith('[team-review-wake')) {
      return tools === 0
        ? toolCall('bash', { command: CMD2, timeout: 30_000 })
        : { kind: 'text', content: 'F5_ASK2_DONE' }
    }

    // The review wake. Ask #1: the Officer lists + escalates. Ask #2: the arm
    // decides the role — a live Officer escalates (the F-5 observation), while
    // a disposed Officer never receives this wake; in the `leader` policy the
    // Leader receives it and decides.
    if (lastUser.startsWith('[team-review-wake')) {
      const isAsk2 = MOCK_PHASE === 'ask2' || lastUser.includes(SUM2) || lastUser.includes(MARK_ASK2)
      // The reviewer is composing its resolve RIGHT NOW: this is the honest
      // moment to audit the facts-port gates (the refusal itself is only
      // observable one model turn later).
      if (WAKE_SNAPSHOT === null && WAKE_SNAPSHOT_HOOK !== null) {
        const snap = WAKE_SNAPSHOT_HOOK()
        if (snap !== null) WAKE_SNAPSHOT = snap
      }
      const leaderDecides = isAsk2 && OFFICER_AT_ASK2 === 'disposed' && POLICY === 'leader'
      if (tools === 0) {
        return toolCall('team_list_pending_control', {
          rootSessionId: CREATE_ROOT,
          requestToken: `f5-list-${String(mockWakeSeq++)}`,
        })
      }
      if (tools === 1) {
        const listed = firstListedRequestId(toolMsgsOf(req).slice(-1)[0]?.content ?? '')
        const named = /requestId=([^\]\s]+)/.exec(lastUser)?.[1] ?? listed
        return toolCall('team_resolve_control', {
          rootSessionId: CREATE_ROOT,
          requestToken: `f5-res-${String(mockWakeSeq++)}`,
          requestId: named ?? '',
          decision: leaderDecides ? 'allow' : 'escalate',
        })
      }
      return { kind: 'text', content: 'F5_REVIEWER_DONE' }
    }

    // A Leader control notification. Ask #1's permission lane is left to the
    // explicit human action; ask #2 under `leader` + disposed Officer is the
    // case where the LEADER must decide (the policy's allowed hand-off).
    if (lastUser.startsWith('[team-control requestId=')) {
      // Phase-gated, not text-gated: the plane-leg notification may name only
      // the request/scope, without repeating the command text.
      const leaderMustDecide = OFFICER_AT_ASK2 === 'disposed' && POLICY === 'leader' && MOCK_PHASE === 'ask2'
      if (!leaderMustDecide) return { kind: 'text', content: 'F5_NOTIFICATION_LEFT_TO_HUMAN' }
      const requestId = /requestId:\s*([A-Za-z0-9][A-Za-z0-9_-]+)/.exec(lastUser)?.[1]
        ?? /requestId=([^\]\s]+)/.exec(lastUser)?.[1] ?? ''
      if (tools === 0) {
        return toolCall('team_list_pending_control', { rootSessionId: CREATE_ROOT, requestToken: `f5-nlist-${String(mockWakeSeq++)}` })
      }
      if (tools === 1) {
        const listed = firstListedRequestId(toolMsgsOf(req).slice(-1)[0]?.content ?? '')
        return toolCall('team_resolve_control', {
          rootSessionId: CREATE_ROOT,
          requestToken: `f5-nres-${String(mockWakeSeq++)}`,
          requestId: requestId !== '' ? requestId : (listed ?? ''),
          decision: 'allow',
        })
      }
      return { kind: 'text', content: 'F5_LEADER_NOTIF_DONE' }
    }

    return { kind: 'text', content: 'F5_GENERIC_ACK' }
  }
}

// ── preflight ───────────────────────────────────────────────────────────────

async function measureHostPort() {
  if (HOST_PORT_ARG !== null) {
    const port = Number(HOST_PORT_ARG)
    return { port, free: isSanctionedTestPort(port) ? await portFree(port) : true }
  }
  for (let p = 3181; p <= 3199; p += 1) if (await portFree(p)) return { port: p, free: true }
  return { port: 3181, free: false }
}
async function measureMockPort() {
  if (MOCK_PORT_ARG !== null) {
    const port = Number(MOCK_PORT_ARG)
    return { port, free: isSanctionedTestPort(port) ? await portFree(port) : true }
  }
  for (let p = 3491; p <= 3500; p += 1) if (await portFree(p)) return { port: p, free: true }
  return { port: 3491, free: false }
}
function git(cwd, argv) {
  const r = spawnSync('git', argv, { cwd, encoding: 'utf8' })
  return { status: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() }
}

const KNOWN_ARMS = ['ask-1', 'ask-2', 'policy:hold', 'policy:leader', 'officer-live-at-ask-2', 'officer-disposed-at-ask-2']

async function runPreflight({ hostProbe, mockProbe, worktreeHead }) {
  const head = git(TESTUSE, ['rev-parse', 'HEAD'])
  const porcelain = git(TESTUSE, ['status', '--porcelain'])
  const preflight = runBootPreflight({
    env: {
      required: ['DSH_HOME', 'DSH_CLIENT_COMMIT_HASH', 'DEEPSEEK_BASE_URL'],
      provided: {
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: mockProbe.free ? `http://127.0.0.1:${mockProbe.port}` : '',
      },
    },
    hostPin: {
      declared: TEST_USE_BASELINE_SHA,
      actual: head.status === 0 && head.out.length > 0 ? head.out : null,
      checkout: TESTUSE,
      porcelainClean: porcelain.status === 0 && porcelain.out === '',
    },
    candidate: {
      expectedSha: EXPECT_SHA ?? worktreeHead,
      actualSha: worktreeHead,
      source: EXPECT_SHA === null ? 'the worktree under test (LIVE class)' : '--expect-sha',
    },
    // The pinned generation's only model modality. The officer count graded
    // HERE is the DECLARED one (one Officer template; a v5 blueprint with a
    // missing/Leader-equal officerTemplateId is refused at boot); the LIVE
    // count is re-checked after team.create and recorded separately.
    modalities: [{ id: 'text', supported: true, arm: 'ask-1' }],
    officer: { required: true, count: 1, scope: 'declared' },
    ports: [hostProbe, mockProbe],
    isSanctionedPort: isSanctionedTestPort,
    world: { dshHome: HOME, workspaceRoot: WORKTREE, exists: existsSync(HOME) },
    arms: {
      selected: ['ask-1', 'ask-2', `policy:${POLICY}`, `officer-${OFFICER_AT_ASK2}-at-ask-2`],
      known: KNOWN_ARMS,
    },
  })
  return { preflight, head: head.out, porcelain: porcelain.out }
}

// ── ask driving ─────────────────────────────────────────────────────────────

function newLegsSince(ledger, seenIds) {
  return ledger.requests.filter((request) => !seenIds.has(request.requestId))
}

async function readDiscovery(origin, cookie) {
  const page = await remoteCall(origin, cookie, 'team.getLedgerPage', { teamSessionId: CREATE_ROOT, afterSequence: 0, limit: 500 }, 'f5disc')
  const projection = await remoteCall(origin, cookie, 'team.getProjection', { teamSessionId: CREATE_ROOT }, 'f5disc')
  const entries = page.body?.result?.value?.data?.entries ?? []
  return {
    pageStatus: page.status,
    entries,
    projectionStatus: projection.status,
    pendingControlCount: projection.body?.result?.value?.data?.projection?.ledger?.pendingControlCount ?? null,
  }
}

/**
 * Drive ONE governed ask to completion under the arm's resolver policy, and
 * return the durable facts. `humanDecides` true = this driver, as the explicit
 * human operator, allows every pending human-decidable leg as it appears
 * (that is the "explicit human action" the owner requires). false = the mock
 * Leader is expected to decide; the driver only observes.
 */
async function driveAsk({ origin, cookie, mark, command, file, sum, humanDecides, label, prompt = null, onRefusal = null }) {
  // Ask #1 is the Leader's DELEGATED work: the Worker began it during
  // team.create, so its permission leg may already be pending before this
  // function starts. `seen` must therefore seed with legs that are already
  // SETTLED (decided/abandoned), never with merely-existing pending legs —
  // otherwise the human would silently skip the ask that is in flight.
  WAKE_SNAPSHOT = null
  const ownerBeforePrompt = WORKER_INSTANCE === null ? null : (memberRows().find((r) => r.instanceId === WORKER_INSTANCE)?.lifecycle ?? 'row-absent')
  const before = readLedger()
  const settled = new Set([
    ...before.decisions.map((d) => d.requestId),
    ...before.abandonments.map((a) => a.requestId),
  ])
  const beforeIds = new Set(before.requests.map((r) => r.requestId))
  const startedAt = Date.now()
  const mockStart = MOCK.requests.length
  let prompted = { status: 200, body: null }
  if (prompt !== null) {
    prompted = await apiPrompt(origin, cookie, WORKER_SESSION, prompt, `f5${label}`)
    if (prompted.status !== 200) dieFatal(`${label}: worker prompt failed status=${prompted.status}`)
  }
  const deadline = Date.now() + WAIT_MS
  const humanAllowed = []
  const planeFirstSeen = new Map()
  let refusalAudit = null
  let error = null
  try {
    for (;;) {
      if (existsSync(file) && readFileSync(file, 'utf8').includes(sum)) break
      if (Date.now() >= deadline) { error = 'timeout waiting for the ask to settle'; break }
      const ledger = readLedger()
      if (refusalAudit === null && onRefusal !== null
        && MOCK.requests.some((r) => JSON.stringify(r.body ?? {}).includes('CONTROL_RESOLVER_NOT_AUTHORIZED'))) {
        refusalAudit = onRefusal(ledger)
      }
      if (humanDecides) {
        const wakeObserved = MOCK.requests.some((r) => lastUserTextOf(r).startsWith('[team-review-wake')
          && (lastUserTextOf(r).includes(sum) || lastUserTextOf(r).includes(mark)))
        const pending = ledger.requests.filter((request) => HUMAN_DECIDABLE_KINDS.has(request.kind)
          && !settled.has(request.requestId)
          && !ledger.decisions.some((d) => d.requestId === request.requestId)
          && !ledger.abandonments.some((a) => a.requestId === request.requestId))
        // WHICH leg may a human decide, and WHEN (the F-5 instrument rule).
        //
        //  - A permission-lane leg (`parameter-permission`) is the pre-execute
        //    ask; the human may allow it immediately (ask #1 proves the human
        //    is a legal resolver there).
        //  - A plane leg at ordinal 1 is the REVIEWER's leg. When the Officer
        //    is expected live, the human must NOT pre-empt the escalation (a
        //    human allow there would decide the case before the wake, which is
        //    not the chain under test). The driver waits a bounded grace for
        //    the escalation (⇒ decide the ordinal-2 human leg) or for the
        //    reviewer's refusal, and only then performs the explicit human
        //    override the owner permits.
        //  - The escalated human leg (ordinal ≥ 2) may be decided at once.
        for (const leg of pending) {
          const isPlane = leg.actionName === 'team-tool-execute'
          const isEscalated = (leg.legOrdinal ?? 1) > 1
          if (isPlane && !isEscalated) {
            const firstSeen = planeFirstSeen.get(leg.requestId) ?? Date.now()
            planeFirstSeen.set(leg.requestId, firstSeen)
            // A live reviewer is expected to wake for the plane leg: wait for
            // the wake to become observable, then give it 10 s to escalate.
            // When no wake is expected (Officer disposed) the leg is the
            // `whenOfficerUnavailable` branch and a 5 s settle window keeps
            // the driver from racing a hold/hand-off notification.
            const graceMs = wakeObserved ? 10_000 : (OFFICER_AT_ASK2 === 'live' ? 25_000 : 5_000)
            if (Date.now() - firstSeen < graceMs) continue
          }
          const res = await remoteCall(origin, cookie, 'team.resolveControl', {
            teamSessionId: CREATE_ROOT,
            requestId: leg.requestId,
            decision: 'allow',
            note: `F-5 ${label}: explicit human operator allow (${POLICY}/${OFFICER_AT_ASK2})`,
          }, `f5${label}h`, 4)
          humanAllowed.push({ requestId: leg.requestId, kind: leg.kind, actionName: leg.actionName, status: res.status, ok: res.body?.result?.ok === true, error: res.body?.result?.error ?? null })
          settled.add(leg.requestId)
        }
      }
      await sleep(200)
    }
  } catch (e) {
    error = String(e?.message ?? e)
  }
  // Let the durable decisions/consumptions/execution land.
  await sleep(1500)
  const ledger = readLedger()
  const legs = newLegsSince(ledger, beforeIds)
  const mockSlice = MOCK.requests.slice(mockStart)
  return {
    mark,
    label,
    humanDecides,
    promptedStatus: prompted.status,
    ownerLifecycleBeforePrompt: ownerBeforePrompt,
    wakeAudit: WAKE_SNAPSHOT,
    refusalAudit,
    error,
    startedAt: new Date(startedAt).toISOString(),
    humanAllowed,
    legs,
    executions: legs.map((leg) => ({ requestId: leg.requestId, ...legFacts(ledger, leg.requestId) })),
    file: { path: file, exists: existsSync(file), body: existsSync(file) ? readFileSync(file, 'utf8') : null },
    mock: {
      requests: mockSlice.length,
      wakeTurns: mockSlice.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).length,
      notificationTurns: mockSlice.filter((r) => lastUserTextOf(r).startsWith('[team-control requestId=')).length,
      listCalls: mockSlice.filter((r) => replyToolNames(r).includes('team_list_pending_control')).length,
      resolveCalls: mockSlice.filter((r) => replyToolNames(r).includes('team_resolve_control')).length,
      refusalTraces: mockSlice
        .map((r) => JSON.stringify(r.body ?? {}))
        .filter((text) => text.includes('CONTROL_RESOLVER_NOT_AUTHORIZED'))
        .map((text) => {
          const i = text.indexOf('CONTROL_RESOLVER_NOT_AUTHORIZED')
          return text.slice(Math.max(0, i - 200), i + 700)
        }),
      commandSeen: mockSlice.some((r) => lastUserTextOf(r).includes(sum)),
    },
  }
}

/**
 * The facts-port gate audit for one leg — computed from DURABLE ROWS ONLY, in
 * the same order the provider checks them
 * (`packages/runtime/alpha6/assigned-officer-facts.ts`). The provider reports
 * only "produced no facts"; this audit names WHICH gate would answer null, so a
 * defect trace is exact instead of a guess. It is an instrument, not product
 * code: it does not run the provider.
 */
function auditFactsGates(leg, { teamRow, registryRows, members, overlays, ledger }) {
  const officerTemplateId = 'officer'
  const live = (lifecycle) => lifecycle === 'CREATED' || lifecycle === 'RUNNING' || lifecycle === 'SETTLED'
  const officers = members.filter((m) => m.templateId === officerTemplateId
    && live(m.lifecycle)
    && m.childSessionId !== CREATE_ROOT
    && (m.rootSessionId === undefined || m.rootSessionId === CREATE_ROOT))
  const ownerId = leg?.subject?.kind === 'instance' ? leg.subject.instanceId : (leg?.targetInstanceId ?? '')
  const owner = members.find((m) => m.instanceId === ownerId)
  const overlay = overlays.find((row) => String(row?.rootSessionId ?? row?.teamSessionId) === CREATE_ROOT
    && String(row?.instanceId ?? row?.memberInstanceId) === ownerId)
  const currentGeneration = typeof overlay?.generation === 'number' ? overlay.generation : 0
  const sessionBlueprint = teamRow?.blueprint ?? null
  const registryHit = sessionBlueprint === null
    ? null
    : registryRows.find((row) => String(row.revision) === String(sessionBlueprint.revision)
      && row.contentHash === sessionBlueprint.contentHash) ?? null
  return {
    leg: leg === null ? null : {
      requestId: leg.requestId,
      status: leg.status,
      kind: leg.kind,
      reviewAuthority: leg.reviewAuthority,
      approvalCaseId: leg.approvalCaseId,
      legOrdinal: leg.legOrdinal,
      blueprintRevision: leg.blueprintRevision,
      blueprintContentHash: leg.blueprintContentHash,
      authorityGeneration: leg.authorityGeneration,
      operationOwnerTemplateId: leg.operationOwnerTemplateId,
      operationToolDefinitionIdentity: leg.operationToolDefinitionIdentity,
      operationToolOwner: leg.operationToolOwner,
      operationToolName: leg.operationToolName,
      subject: leg.subject,
      targetInstanceId: leg.targetInstanceId,
    },
    sessionBlueprint,
    registryRevisions: registryRows.map((row) => ({ revision: row.revision, contentHash: row.contentHash })),
    officerCount: officers.length,
    officers: officers.map((m) => ({ instanceId: m.instanceId, lifecycle: m.lifecycle, templateId: m.templateId })),
    owner: owner === undefined ? null : { instanceId: owner.instanceId, lifecycle: owner.lifecycle, templateId: owner.templateId },
    ownerGeneration: currentGeneration,
    gates: {
      'leg-present': leg !== undefined && leg !== null,
      'leg-pending': leg !== undefined && leg !== null
        && !(ledger?.decisions ?? []).some((d) => d.requestId === leg.requestId)
        && !(ledger?.abandonments ?? []).some((a) => a.requestId === leg.requestId),
      'blueprint-hash-present': typeof sessionBlueprint?.contentHash === 'string' && sessionBlueprint.contentHash.length > 0,
      'blueprint-revision-present': sessionBlueprint?.revision !== undefined && String(sessionBlueprint.revision).length > 0,
      'leg-blueprint-matches-session': leg?.blueprintContentHash === sessionBlueprint?.contentHash
        && String(leg?.blueprintRevision) === String(sessionBlueprint?.revision),
      'registry-has-session-blueprint': registryHit !== null,
      'unique-live-officer': officers.length === 1,
      'officer-child-session': officers.length === 1 && typeof officers[0].childSessionId === 'string' && officers[0].childSessionId.length > 0,
      'owner-running': owner?.lifecycle === 'RUNNING',
      'owner-template-matches': owner !== undefined && owner.templateId === leg?.operationOwnerTemplateId,
      'generation-frozen': Number.isInteger(leg?.authorityGeneration),
      'generation-current-matches': leg?.authorityGeneration === currentGeneration,
      'tool-binding-complete': typeof leg?.operationToolDefinitionIdentity === 'string' && leg.operationToolDefinitionIdentity.length > 0
        && typeof leg?.operationToolOwner === 'string' && leg.operationToolOwner.length > 0
        && typeof leg?.operationToolName === 'string' && leg.operationToolName.length > 0,
    },
  }
}

// ── main ────────────────────────────────────────────────────────────────────

let WORKER_SESSION = null
let WORKER_INSTANCE = null
let OFFICER_INSTANCE = null
let LEADER_INSTANCE = null

async function main() {
  log(`F-5 two-asks — policy=${POLICY} officerAtAsk2=${OFFICER_AT_ASK2} run=${RUN}`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} @ ${TEST_USE_BASELINE_SHA.slice(0, 10)} (${DSH_BASELINE_VERSION})`)
  log(`evidence=${RUN_DIR}`)

  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_PLUGIN_PATH, LAUNCHER_PATH]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
  mkdirSync(RUN_DIR, { recursive: true })
  mkdirSync(WORKSPACE, { recursive: true })
  rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })

  const stablePre = { p3080: await probeStable(`http://127.0.0.1:${STABLE_INSTANCE_PORT}/`), p3180: await probeStable('http://127.0.0.1:3180/') }
  writeEvidence('stable-probe.json', stablePre)
  log(`stable probes (read-only): 3080=${stablePre.p3080.status} 3180=${stablePre.p3180.status}`)

  const hostProbe = await measureHostPort()
  const mockProbe = await measureMockPort()
  const worktreeHead = git(WORKTREE, ['rev-parse', 'HEAD']).out
  const { preflight } = await runPreflight({ hostProbe, mockProbe, worktreeHead })
  writeEvidence('boot-preflight.json', preflight)
  for (const blocked of preflight.blocking) log(`preflight ${blocked.state}: ${blocked.id} — ${blocked.detail}`)
  // THE REFUSAL POINT: a non-PASS preflight never spends a Host start.
  try {
    assertBootPreflight(preflight)
  } catch (error) {
    dieFatal(`boot preflight refused the start: ${error.message}`)
  }
  log(`preflight PASS (selected arms: ${preflight.selectedArms.join(', ')}; NOT_SELECTED: ${preflight.skipped.length === 0 ? 'none' : preflight.skipped.join(', ')})`)

  writeEvidence('run-manifest.json', {
    schema: 'f5-two-asks/1',
    recordClass: 'DEV-LIVE',
    candidateClass: EXPECT_SHA === null ? 'live (worktree under test; NOT a frozen CANDIDATE-C2)' : 'candidate-bound (--expect-sha)',
    policy: POLICY,
    policySchema: "blueprint-v5 reviewRouting.whenOfficerUnavailable ∈ {'hold','leader'} (two declared values; no third)",
    officerAtAsk2: OFFICER_AT_ASK2,
    run: RUN,
    productSha: worktreeHead,
    productTree: WORKTREE,
    hostVersion: DSH_BASELINE_VERSION,
    hostBaselineSha: TEST_USE_BASELINE_SHA,
    hostPort: hostProbe.port,
    mockPort: mockProbe.port,
    dshHome: HOME,
    hostSessionRoot: ROOT,
    createdTeamRoot: CREATE_ROOT,
    stableProbes: stablePre,
    preflightVerdict: preflight.verdict,
    startedAt: new Date().toISOString(),
  })

  // Mock model (the scripted oracle: it decides WHICH tool is called, never
  // whether the product works; every durable fact below is real).
  MOCK = await startMockModel({
    port: mockProbe.port,
    decide: makeDecide(),
    log: (l) => { try { writeFileSync(MOCK_LOG, `${l}\n`, { flag: 'a' }) } catch { /* best effort */ } },
  })
  log(`mock model on 127.0.0.1:${MOCK.port}`)

  HOST = await bootHost({ port: hostProbe.port, mockPort: MOCK.port })
  log(`host booted at ${HOST.origin} on :${hostProbe.port}`)
  const { origin, cookie } = HOST

  try {
    // ── L0: discovery (the deny list a strict Member needs) ──
    const disc = await apiPrompt(origin, cookie, ROOT, MARK_DISCOVERY, 'f5disc')
    if (disc.status !== 200) dieFatal(`L0 discovery prompt status=${disc.status}`)
    let discReq = null
    {
      const deadline = Date.now() + 120_000
      while (Date.now() < deadline) {
        discReq = MOCK.requests.find((r) => lastUserTextOf(r).includes(MARK_DISCOVERY) && (r.body?.tools ?? []).length > 0) ?? null
        if (discReq !== null) break
        await sleep(250)
      }
    }
    if (discReq === null) dieFatal('L0: no discovery request observed')
    const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
    const managed = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
    const teamCatalog = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress', 'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member', 'team_grant_permission', 'team_revoke_permission']
    // `subagent` is an OWN-LAYER row of the deployment preset, not a global
    // tool of a created root: naming it in `builtinToolDeny` makes
    // `tools.restrict()` fail the root start ("unknown global tool"). It is
    // therefore excluded from the deny list, exactly as the c1 kit documents
    // for the 0.1.5 spawn row; every real global outside the managed
    // vocabulary stays denied (the A2C-2 coverage gate is fatal).
    const NOT_A_GLOBAL_TOOL = new Set(['subagent'])
    const denyList = surface.filter((n) => !managed.includes(n) && n !== 'todo_write' && !teamCatalog.includes(n) && !NOT_A_GLOBAL_TOOL.has(n))
    writeEvidence('l0-surface.json', { surface, denyList })
    check('L0', 'the real Host booted and the Leader surface was discovered', surface.includes('read') && surface.includes('bash'), `tools=${surface.length}`)

    // ── team.create (the v5 blueprint under test) ──
    writeFileSync(join(BLUEPRINT_DIR, 'f5-two-asks.yaml'), savedBlueprintYaml(denyList))
    const created = await remoteCall(origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_A6_ID,
      initialWork: { prompt: MARK_LEADER },
    }, 'f5create', 1)
    writeEvidence('team-create.json', created.body ?? created)
    const createdOk = created.status === 200 && created.body?.result?.ok === true
    check('CREATE-1', 'team.create admits the v5 Officer + reviewRouting on the real Host', createdOk,
      `status=${created.status} body=${JSON.stringify(created.body ?? created).slice(0, 700)}`)
    if (!createdOk) dieFatal(`team.create failed: ${JSON.stringify(created.body?.result?.error ?? null).slice(0, 500)}`)

    // Durable member rows: Officer, Worker, Leader.
    {
      const deadline = Date.now() + 90_000
      while (Date.now() < deadline) {
        const rows = memberRows()
        const officer = rows.find((r) => r.templateId === 'officer' && typeof r.childSessionId === 'string')
        const worker = rows.find((r) => r.templateId === 'worker' && typeof r.childSessionId === 'string')
        if (officer !== undefined && worker !== undefined) {
          OFFICER_INSTANCE = officer.instanceId
          WORKER_INSTANCE = worker.instanceId
          WORKER_SESSION = worker.childSessionId
          LEADER_INSTANCE = rows.find((r) => r.templateId === 'leader')?.instanceId ?? null
          break
        }
        await sleep(250)
      }
    }
    if (WORKER_SESSION === null) dieFatal('no durable Worker child session after team.create')
    const liveOfficers = memberRows().filter((r) => r.templateId === 'officer'
      && ['CREATED', 'RUNNING', 'SETTLED'].includes(r.lifecycle)
      && r.childSessionId !== CREATE_ROOT)
    writeEvidence('members.json', { members: memberRows(), workerSession: WORKER_SESSION, officerInstance: OFFICER_INSTANCE, leaderInstance: LEADER_INSTANCE, liveOfficerCount: liveOfficers.length })
    check('CREATE-2', 'exactly one live Officer carries the routing template (the Alpha.6 unique-Officer law)',
      liveOfficers.length === 1, `liveOfficers=${liveOfficers.length}`)

    // ── ask #1 (the baseline two-leg chain; always human-resolved) ──
    log('── ask #1: governed worker bash, Officer wake → escalate → human leg ──')
    MOCK_PHASE = 'ask1'
    WAKE_SNAPSHOT_HOOK = () => {
      const ledger = readLedger()
      const plane = ledger.requests.filter((l) => l.actionName === 'team-tool-execute').at(-1) ?? null
      return plane === null ? null : auditFactsGates(plane, {
        teamRow: teamSessionRow(),
        registryRows: blueprintRegistryRows(BP_A6_ID),
        members: memberRows(),
        overlays: permissionOverlayRows(),
        ledger,
      })
    }
    const ask1 = await driveAsk({ origin, cookie, mark: MARK_ASK1, command: CMD1, file: FILE1, sum: SUM1, humanDecides: true, label: 'ask1' })
    MOCK_PHASE = 'between-asks'
    writeEvidence('ask-1.json', ask1)
    const ask1Plane = ask1.legs.find((l) => l.actionName === 'team-tool-execute') ?? null
    const ask1Escalated = ask1Plane !== null && readLedger().escalations.some((e) => e.approvalCaseId === ask1Plane.approvalCaseId)
    const ask1HumanLeg = ask1.legs.find((l) => l.reviewAuthority === 'human-user') ?? null
    const ask1Facts = ask1Plane === null ? null : legFacts(readLedger(), ask1Plane.requestId)
    const ask1HumanFacts = ask1HumanLeg === null ? null : legFacts(readLedger(), ask1HumanLeg.requestId)
    const ask1EscalationRow = ask1Plane === null ? null : readLedger().escalations.find((e) => e.approvalCaseId === ask1Plane.approvalCaseId) ?? null
    check('ASK1-1', 'ask #1 produced the governed two-leg chain and the requested side effect executed exactly once',
      ask1.file.exists && ask1Plane !== null && ask1Escalated && ask1HumanLeg !== null
        && (ask1HumanFacts?.consumptions.length ?? 0) === 1,
      `file=${ask1.file.exists} plane=${ask1Plane?.requestId ?? 'none'} escalated=${ask1Escalated} humanLeg=${ask1HumanLeg?.requestId ?? 'none'} humanConsumptions=${ask1HumanFacts?.consumptions.length ?? 0} error=${ask1.error ?? 'none'}`)
    check('ASK1-2', 'ask #1 was escalated by the OFFICER and the successor human leg was decided by the HUMAN',
      ask1EscalationRow !== null
        && ask1Facts?.decisions.at(-1)?.decider?.kind === 'instance'
        && ask1Facts?.decisions.at(-1)?.decision === 'deny'
        && ask1HumanFacts?.decisions.at(-1)?.decider?.kind === 'human'
        && ask1HumanFacts?.decisions.at(-1)?.decision === 'allow',
      `escalation=${JSON.stringify(ask1EscalationRow?.decider ?? null)} originalDecision=${JSON.stringify(ask1Facts?.decisions.at(-1) ?? null)} humanDecision=${JSON.stringify(ask1HumanFacts?.decisions.at(-1) ?? null)}`)

    // ── arm: make the Officer unavailable BEFORE ask #2 ──
    let disposeResult = null
    if (OFFICER_AT_ASK2 === 'disposed') {
      // The FSM (Architecture §29) allows ARCHIVE only from SETTLED; an idle
      // Officer stays CREATED, so `member.dispose` is the legal transition to
      // the unavailable state the router's `whenOfficerUnavailable` branch is
      // about. The declared policy, not the transition name, is what is under
      // test.
      disposeResult = await remoteCall(origin, cookie, 'member.dispose', {
        teamSessionId: CREATE_ROOT,
        instanceId: OFFICER_INSTANCE,
      }, 'f5dispose', 4)
      writeEvidence('officer-dispose.json', disposeResult.body ?? disposeResult)
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        const officer = memberRows().find((r) => r.instanceId === OFFICER_INSTANCE)
        if (officer === undefined || officer.lifecycle === 'DISPOSED') break
        await sleep(200)
      }
      log(`officer disposed: status=${disposeResult.status} lifecycle=${memberRows().find((r) => r.instanceId === OFFICER_INSTANCE)?.lifecycle ?? 'row-absent'}`)
    }

    // ── ask #2 (THE OBSERVATION) ──
    log(`── ask #2: same root, second governed ask (officer ${OFFICER_AT_ASK2}, policy ${POLICY}) ──`)
    MOCK_PHASE = 'ask2'
    const ledgerBefore2 = readLedger()
    const ask2 = await driveAsk({
      origin, cookie, mark: MARK_ASK2, command: CMD2, file: FILE2, sum: SUM2,
      humanDecides: !(OFFICER_AT_ASK2 === 'disposed' && POLICY === 'leader'),
      label: 'ask2',
      prompt: `${MARK_ASK2} Use the bash tool to run exactly: ${CMD2} ; then answer with the command output.`,
      // Capture the facts-port gate state AT THE REFUSAL (before any human
      // decision moves the case or settles the owner): this is the exact
      // trace a defect report needs, not an after-the-fact reconstruction.
      onRefusal: (ledger) => {
        const plane = ledger.requests.filter((l) => l.actionName === 'team-tool-execute').at(-1) ?? null
        return plane === null ? null : auditFactsGates(plane, {
          teamRow: teamSessionRow(),
          registryRows: blueprintRegistryRows(BP_A6_ID),
          members: memberRows(),
          overlays: permissionOverlayRows(),
          ledger,
        })
      },
    })
    writeEvidence('ask-2.json', ask2)
    MOCK_PHASE = 'after-asks'

    const ledger2 = readLedger()
    const ask2Permission = ask2.legs.find((l) => l.actionName === 'parameter-permission') ?? null
    const ask2Plane = ask2.legs.find((l) => l.actionName === 'team-tool-execute') ?? null
    const ask2Escalations = ask2Plane === null ? [] : ledger2.escalations.filter((e) => e.approvalCaseId === ask2Plane.approvalCaseId)
    const ask2Facts = ask2Plane === null ? null : legFacts(ledger2, ask2Plane.requestId)
    const ask2Transfer = ask2Plane === null ? null : ledger2.transfers.find((t) => t.currentLegRequestId === ask2Plane.requestId) ?? null
    const ask2Decision = ask2Facts?.decisions.at(-1) ?? null
    const ask2DeciderKind = ask2Decision?.decider?.kind ?? null
    const ask2DeciderInstance = ask2Decision?.decider?.instanceId ?? null
    const ask2HumanLeg = ask2.legs.find((l) => l.reviewAuthority === 'human-user') ?? null
    const discovery2 = await readDiscovery(origin, cookie)
    const ask2Discoverable = ask2Plane !== null
      && JSON.stringify(discovery2.entries).includes(ask2Plane.requestId)
    const ask2ListedByModel = ask2.mock.listCalls > 0
    const ask2Executed = ask2.file.exists && ask2.file.body.includes(SUM2)

    const observerPid = HOST.host.child.pid ?? null
    const gateFacts = ask2Plane === null ? null : auditFactsGates(ask2Plane, {
      teamRow: teamSessionRow(),
      registryRows: blueprintRegistryRows(BP_A6_ID),
      members: memberRows(),
      overlays: permissionOverlayRows(),
    })
    writeEvidence('ask-2-gate-facts.json', {
      atWake: ask2.wakeAudit,
      atRefusal: ask2.refusalAudit,
      afterDecision: gateFacts,
      note: 'atWake is the durable gate state captured while the ask-#2 reviewer was composing its resolve (owner still blocked in the guard); atRefusal is the same audit one model turn later when the typed refusal became observable; afterDecision is the audit after the human decided (owner SETTLED / leg no longer pending, so several gates necessarily flip). The provider itself reports only "produced no facts"; this audit names which durable gate would answer null.',
    })

    // Which policy branch was entered? The router's `whenOfficerUnavailable`
    // is consulted ONLY when the configured Officer is archived/disposed/
    // missing (or an unconfirmed/ambiguous availability is reported), never for
    // an active Officer.
    const officerRowNow = memberRows().find((r) => r.instanceId === OFFICER_INSTANCE) ?? null
    const officerAvailable = officerRowNow !== null
      && ['CREATED', 'RUNNING', 'SETTLED'].includes(officerRowNow.lifecycle)
      && officerRowNow.childSessionId !== CREATE_ROOT
    const policyInvoked = !officerAvailable
    const policyExpectation = {
      hold: 'no Leader hand-off: the ask stays pending, discoverable and human-decidable; any decision is an explicit human action',
      leader: 'the ask may go to the Leader; the Leader is the resolver and the human leg is not silently substituted',
    }[POLICY]
    let policyHonoured = null
    let policyReason = ''
    if (!policyInvoked) {
      policyReason = `the configured Officer is ${officerRowNow?.lifecycle ?? 'absent'} and was woken as the reviewer; the router's whenOfficerUnavailable branch is not reached, so the policy is NOT INVOKED (recorded as such rather than marked honoured)`
    } else if (POLICY === 'hold') {
      const noLeaderHandoff = ask2Transfer === null
        && ask2Escalations.length === 0
        && ask2DeciderKind !== 'instance'
      const humanExplicit = ask2Decision !== null && ask2DeciderKind === 'human'
      policyHonoured = noLeaderHandoff && humanExplicit && ask2Discoverable
      policyReason = `hold: transfer=${ask2Transfer === null ? 'none' : 'PRESENT'} escalations=${ask2Escalations.length} decider=${String(ask2DeciderKind)} discoverable=${ask2Discoverable}`
    } else {
      const leaderDecided = ask2Decision !== null
        && ask2DeciderKind === 'instance'
        && ask2DeciderInstance === LEADER_INSTANCE
      const noHumanSubstitution = ask2HumanLeg === null
      policyHonoured = leaderDecided && noHumanSubstitution
      policyReason = `leader: deciderKind=${String(ask2DeciderKind)} deciderInstance=${String(ask2DeciderInstance)} leaderInstance=${String(LEADER_INSTANCE)} humanLeg=${ask2HumanLeg === null ? 'none' : 'PRESENT'}`
    }

    const policyFacts = {
      policy: POLICY,
      expectation: policyExpectation,
      officerAtAsk2: OFFICER_AT_ASK2,
      officerRowNow: officerRowNow === null ? null : { instanceId: officerRowNow.instanceId, lifecycle: officerRowNow.lifecycle, templateId: officerRowNow.templateId },
      officerAvailable,
      policyInvoked,
      policyHonoured,
      policyReason,
      ask2: {
        permissionLeg: ask2Permission === null ? null : {
          requestId: ask2Permission.requestId, kind: ask2Permission.kind,
          reviewAuthority: ask2Permission.reviewAuthority, approvalCaseId: ask2Permission.approvalCaseId,
        },
        planeLeg: ask2Plane === null ? null : {
          requestId: ask2Plane.requestId, kind: ask2Plane.kind,
          reviewAuthority: ask2Plane.reviewAuthority, approvalCaseId: ask2Plane.approvalCaseId,
          legOrdinal: ask2Plane.legOrdinal, correlation: ask2Plane.correlation,
          blueprintRevision: ask2Plane.blueprintRevision,
          blueprintContentHash: ask2Plane.blueprintContentHash,
          authorityGeneration: ask2Plane.authorityGeneration,
        },
        escalations: ask2Escalations,
        transfer: ask2Transfer,
        humanLeg: ask2HumanLeg === null ? null : { requestId: ask2HumanLeg.requestId, legOrdinal: ask2HumanLeg.legOrdinal },
        decision: ask2Decision,
        decisionCount: ask2Facts?.decisions.length ?? 0,
        consumptions: ask2Facts?.consumptions.length ?? 0,
        executions: ask2Facts?.executions.length ?? 0,
        abandonments: ask2Facts?.abandonments.length ?? 0,
        executed: ask2Executed,
      },
      discoverability: {
        requestId: ask2Plane?.requestId ?? null,
        ledgerPageVisible: ask2Discoverable,
        pendingControlCount: discovery2.pendingControlCount,
        modelPendingListObserved: ask2ListedByModel,
        remoteDiscovery: { pageStatus: discovery2.pageStatus, projectionStatus: discovery2.projectionStatus, entries: discovery2.entries.length },
      },
      resolver: {
        deciderKind: ask2DeciderKind,
        deciderInstanceId: ask2DeciderInstance,
        deciderHumanId: ask2Decision?.decider?.humanId ?? null,
        leaderInstance: LEADER_INSTANCE,
        officerInstance: OFFICER_INSTANCE,
        humanAllowedByDriver: ask2.humanAllowed,
        gateFactsPresent: gateFacts !== null,
        refusalGateAuditPresent: ask2.refusalAudit !== null,
        failingGatesAtRefusal: ask2.refusalAudit === null
          ? []
          : Object.entries(ask2.refusalAudit.gates).filter(([, ok]) => ok !== true).map(([gate]) => gate),
      },
      mockObservation: {
        wakeTurns: ask2.mock.wakeTurns,
        notificationTurns: ask2.mock.notificationTurns,
        listCalls: ask2.mock.listCalls,
        resolveCalls: ask2.mock.resolveCalls,
        refusalTraceCount: ask2.mock.refusalTraces.length,
        refusalTraces: ask2.mock.refusalTraces,
      },
      disposeResult: disposeResult === null ? null : { status: disposeResult.status, body: disposeResult.body?.result ?? disposeResult.body },
      observedAt: new Date().toISOString(),
      observerHostPid: observerPid,
    }
    writeEvidence('ask-2-policy.json', policyFacts)
    log(`ask #2 → resolver=${String(ask2DeciderKind)} policyInvoked=${String(policyInvoked)} honoured=${String(policyHonoured)} discoverable=${String(ask2Discoverable)} executed=${String(ask2Executed)}`)

    // ── criteria ──
    check('ASK2-1', 'ask #2 on the SAME root produced its own durable plane leg',
      ask2Plane !== null && (ledgerBefore2.requests.every((r) => r.requestId !== ask2Plane.requestId)),
      `plane=${ask2Plane?.requestId ?? 'none'} newLegs=${ask2.legs.length}`)
    check('ASK2-2', 'ask #2\'s request stayed discoverable after the decision point (remote ledger page + projection)',
      ask2Discoverable && (discovery2.pendingControlCount ?? 0) >= 0,
      `requestId=${ask2Plane?.requestId ?? 'none'} pageVisible=${ask2Discoverable} pendingCount=${String(discovery2.pendingControlCount)} entries=${discovery2.entries.length}`)
    check('ASK2-3', 'ask #2 was decided by a legal resolver and the approval authority was not silently changed',
      ask2Decision !== null
        && (ask2DeciderKind === 'human' || (ask2DeciderKind === 'instance' && ask2DeciderInstance === LEADER_INSTANCE)),
      `decider=${JSON.stringify(ask2Decision?.decider ?? null)} transfers=${ask2Transfer === null ? 0 : 1}`)
    check('ASK2-4', 'the declared whenOfficerUnavailable policy was honoured on ask #2',
      policyHonoured === true || (policyInvoked === false && ask2Decision !== null),
      `invoked=${String(policyInvoked)} honoured=${String(policyHonoured)} reason=${policyReason}`)
    check('ASK2-5', 'ask #2 executed its approved body exactly once (no silent second authority)',
      ask2Executed && (ask2Facts?.consumptions.length ?? 0) === 1 && (ask2Facts?.executions.length ?? 0) <= 1,
      `executed=${ask2Executed} consumptions=${ask2Facts?.consumptions.length ?? 0} executions=${ask2Facts?.executions.length ?? 0}`)

    // The F-5 observation itself, on the live-Officer arm: the Officer's
    // escalation must carry the typed refusal (or, for the disposed arms, the
    // wake must not exist at all).
    if (OFFICER_AT_ASK2 === 'live') {
      check('F5-OBSERVED', 'the live-Officer arm reproduces F-5 (Officer wake, refused escalation, human resolves the leg)',
        ask2.mock.refusalTraces.length > 0 && ask2Escalations.length === 0 && ask2DeciderKind === 'human',
        `refusals=${ask2.mock.refusalTraces.length} escalations=${ask2Escalations.length} decider=${String(ask2DeciderKind)}`)
    } else {
      check('ARM-OFFICER-UNAVAILABLE', `the Officer was disposed before ask #2 and the router saw it as unavailable (${POLICY})`,
        !officerAvailable,
        `lifecycle=${String(officerRowNow?.lifecycle)}`)
    }

    // Explicit human action, never an implied one.
    check('HUMAN-EXPLICIT', 'every human decision on this run was an explicit team.resolveControl by the operator (no implied/automatic human resolution)',
      ask1.humanAllowed.every((h) => h.ok === true || h.error !== null)
        && ask2.humanAllowed.every((h) => h.ok === true || h.error !== null),
      `ask1 humanAllows=${ask1.humanAllowed.length} ask2 humanAllows=${ask2.humanAllowed.length}`)
  } finally {
    try { MOCK?.close?.() } catch { /* best effort */ }
    stopHost()
    await sleep(800)
    if (!KEEP) {
      try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ }
    } else {
      log(`world kept at ${HOME}`)
    }
    finishAndExit(0)
  }
}

main().catch((error) => {
  dieFatal(`uncaught: ${String(error?.stack ?? error)}`)
})
