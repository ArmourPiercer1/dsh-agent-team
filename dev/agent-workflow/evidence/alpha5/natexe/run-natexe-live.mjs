#!/usr/bin/env node
/**
 * a5natexe-live — the NATIVE-EXECUTE-AFTER-APPROVAL leg (natexe round).
 *
 * THE GAP THIS CLOSES (u1 README ④.2, root 02:44/03:05Z): in the governed
 * (plane-fed) worlds the native `bash` ask opens a durable leader-approval,
 * the approval lands and is CONSUMED, and the dispatch still terminated at
 * the Tool Binding verification gate (`TOOL_BINDING_UNVERIFIED`, NOTHING
 * executed) — GLUE-8 assembled A4.4 pinned exactly that landing as the
 * then-correct design. Root 02:44Z ③ registered it as a REAL product-side
 * usability gap: "execute after approval" did not work.
 *
 * THE FIX THIS KIT MEASURES (zero new architecture, zero new semantics):
 * the plane's SHELL ROW takeover-mounted under the native `bash` spelling
 * (`teamToolPlane.names = { bash: 'bash' }` in the row config) — the EXACT
 * pattern the governed `read` row already ships (int-a5b T5, team-tool-plane
 * readName takeover). The placed row rides the SAME #313 placement feed
 * (`placementFeed` -> `bindingFeed` -> install.ts `bindAll` three gates:
 * realm pairing, placement attribution, placement->bind continuity —
 * "placement attribution is the only feed authority"), so the Guard's
 * per-call comparison VERIFIES `bash` against the placement-time identity
 * (def#N) instead of an unattributed native name. The ask lane is UNCHANGED
 * (bash stays permission-ask; the durable approval still gates), the closed
 * world is UNCHANGED (a scope WITHOUT the placement row keeps the verbatim
 * GLUE-8 refusal — the unfed worlds stay byte-for-byte: GLUE-8 two-mode kit
 * re-run per round), and NO identity is minted from any authoring field.
 *
 * LEGS (run for BOTH eras, v3 and v4 — the plane assembly is era-agnostic):
 *   E1  native `bash` (takeover name) opens a DURABLE leader-approval
 *       (ledger request row); while OPEN the world carries ZERO side effect.
 *   E2  the scripted human allows over the production wire; the allow is
 *       durable (decision row) and CONSUMED (consumption row) — ledger
 *       three-line alignment per requestId.
 *   E3  EXECUTE-AFTER-APPROVAL, measured by on-disk side effect: the
 *       sentinel file with its token bytes exists INSIDE the governed root
 *       after the allow (and never before), plus exit=0 + token on the wire.
 *   E4  allow does NOT widen: the SECOND bash call (approved exactly like
 *       the first) tries to write OUTSIDE the governed root and lands on
 *       the kernel refusal — the escape file NEVER exists.
 *   E5  deny-lane arm: a bash-DENYING member answers template-deny-lane
 *       BEFORE any ask, BEFORE any backend; zero extra ledger rows, zero
 *       side effects.
 *   E6  witness rows: the host log carries `bash` in the placement-feed row
 *       list and a `confined-shell ran` execution line; no member result
 *       carries the TOOL_BINDING_UNVERIFIED sentence on the fed world.
 *   E7  era witness: the v4 row is 4/current with the hash-bound family;
 *       the v3 anchor row stays 3/current alongside (zero drift).
 *
 * Discipline (TEST_METHODS): host = tests/deepseek-harness-test-use pristine
 * at the paths.mjs baseline; DSH_HOME inside the workspace; ports from the
 * 318x family; the stable :3080/:3180 instances probed read-only before and
 * after and NEVER touched; launch tokens REDACTED in every artifact; worlds
 * swept at teardown unless --keep (path then registered in the run README).
 *
 * Usage: node run-natexe-live.mjs [--host-port N] [--mock-port N] [--keep]
 *        [--eras v3,v4]
 * Exit: 0 = all criteria PASS; 2 = any criterion failed; 1 = fatal.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync, closeSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, homeDir } from '../../../../../tests/paths.mjs'
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
const ERAS = String(argValue('eras', 'v3,v4')).split(',').map((e) => e.trim()).filter((e) => e === 'v3' || e === 'v4')
if (ERAS.length === 0) throw new Error('--eras must list at least one of v3,v4')

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
const LAUNCHER = join(WORKTREE, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = join(LEG_DIR, 'runs', `live-${RUN_STAMP}`)
const HOST_PORT = Number(argValue('host-port', 3184))
const MOCK_PORT_ARG = argValue('mock-port', '')
const SMOKE_PRESET_ID = 'rc2-smoke'

const MK = `A5NX_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
const TOK_INSIDE = 'A5NX-BASH-TOK'
const TOK_WRITE = 'A5NX-SENTINEL-WROTE'
const TOK_ESCAPE = 'A5NX-ESCAPE-TOK'
const SENTINEL_NAME = 'natexe-sentinel.txt'
const ESCAPE_NAME = 'natexe-escape.txt'
const DENY_SENTINEL = 'natexe-deny-sentinel.txt'

function findInHome(dir, base) {
  try {
    for (const e of readdirSync(dir, { withFileTypes: true, recursive: true })) {
      if (e.name === base) return true
    }
  } catch { /* unreadable = not found */ }
  return false
}

// ── logging / criteria / evidence (glue8 shapes, token redaction) ──────────
const criteria = []
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  try { writeFileSync(join(RUN_DIR, 'run.log'), stamped + '\n', { flag: 'a' }) } catch { /* best-effort */ }
}
function redactTokens(text) {
  return String(text).replace(/token=([A-Za-z0-9_-]{8,})/g, (_m, tok) => {
    const h = createHash('sha256').update(tok).digest('hex').slice(0, 8)
    return `token=REDACTED-${h}`
  })
}
function check(era, id, name, ok, detail) {
  criteria.push({ era, id, name, ok: ok === true, detail: redactTokens(String(detail ?? '')) })
  log(`${ok === true ? 'PASS' : 'FAIL'} [${era}] ${id}: ${name}${detail ? ` — ${redactTokens(String(detail)).slice(0, 400)}` : ''}`)
  return ok === true
}
function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    const body = typeof content === 'string' ? redactTokens(content) : redactTokens(JSON.stringify(content, null, 2))
    writeFileSync(join(RUN_DIR, name), body)
  } catch { /* best-effort */ }
}
function dieFatal(msg, code = 1) {
  log(`FATAL ${redactTokens(msg)}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redactTokens(msg), criteria })
  process.exit(code)
}
function logTail(logPath, n = 150) {
  try { return redactTokens(readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')) } catch { return '<no log>' }
}

// ── http helpers (glue8 shapes) ─────────────────────────────────────────────
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
async function remoteCall(origin, cookie, method, params, tag = 'a5nx', version = 1, timeoutMs = 240_000) {
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
async function apiPrompt(origin, cookie, sessionId, text, tag = 'a5nx') {
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
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/
async function portFree(port) {
  const net = await import('node:net')
  return new Promise((done) => {
    const srv = net.createServer()
    srv.once('error', () => done(false))
    srv.once('listening', () => srv.close(() => done(true)))
    srv.listen(port, '127.0.0.1')
  })
}

// ── mock oracle (digest shape from a5g7-live-kit) ───────────────────────────
/** A conversation belongs to a member leg iff its OPENING prompt (first user
 *  turn) carries the leg marker — the leader transcript also carries the
 *  marker downstream (inside the delegation result), so downstream text is
 *  NOT an attribution witness. */
function firstUserText(parsed) {
  const first = Array.isArray(parsed?.messages) ? (parsed.messages ?? [])[0] : undefined
  if (!first) return ''
  if (typeof first.content === 'string') return first.content
  if (Array.isArray(first.content)) return first.content.map((b) => String(b?.text ?? '')).join('\u0001')
  return ''
}
function digestRequest(parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  const sys = typeof parsed?.system === 'string' ? parsed.system : Array.isArray(parsed?.system) ? JSON.stringify(parsed.system) : ''
  const toolNames = Array.isArray(parsed?.tools) ? parsed.tools.map((t) => String(t?.name ?? '')).filter((n) => n !== '') : null
  let text = sys
  const assistantToolNames = []
  const toolResults = []
  for (const m of msgs) {
    if (typeof m?.content === 'string') { text += '\u0001' + m.content; continue }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'text') text += '\u0001' + String(b.text ?? '')
      else if (b?.type === 'tool_use') { assistantToolNames.push(String(b.name ?? '')); text += '\u0001tool_use:' + String(b.name ?? '') + JSON.stringify(b.input ?? {}) }
      else if (b?.type === 'tool_result') {
        const rep = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        toolResults.push(rep.slice(0, 2400))
        text += '\u0001tool_result:' + rep
      }
    }
  }
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, _text: text }
}

// ── YAML emit (glue8 shapes) ────────────────────────────────────────────────
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
    if (Object.keys(value).length === 0) return [`${pad}${key}: {}`]
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
const BP_ANCHOR_ID = 'team.a5nx-anchor'
const BP_MAIN_ID = 'team.a5nx-main'
function bpAnchorYaml(rootSid) {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the a5nx boot team. ${MK}_DISC is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the a5nx boot team."',
    'memberEnvelopes: []', 'requirements: []',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}
/** The main BP, per era: the SAME authoring face for v3 and v4 (the plane
 *  assembly is era-agnostic); the v4 face adds ONLY the optional hash-bound
 *  toolBindings family (dark family — the natexe execution rides placement,
 *  never the family, per u1 ③ option A = existing law). */
function mainBlueprintYaml(era, denyList) {
  const denyBlock = (pad) => denyList.length === 0
    ? [`${pad}builtinToolDeny: []`]
    : [`${pad}builtinToolDeny:`, ...denyList.map((n) => `${pad}  - ${n}`)]
  const head = era === 'v4'
    ? ['schemaVersion: 4']
    : ['schemaVersion: 3']
  return [
    '---', ...head, `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5nx ${era} team. ${MK}_L0 is your directive marker. Follow it exactly.`)}`,
    '  capabilities:',
    '    teamTools:', '      kind: allow', '      items:',
    '        - team_list_members', '        - team_list_templates', '        - team_create_member',
    '        - team_delegate', '        - team_collect', '        - team_follow_up',
    ...denyBlock('    '),
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5nx worker A (bash ask)"',
    `    persona: ${JSON.stringify(`You are worker A of the a5nx ${era} team. Follow delegated work exactly, tool by tool, in order. ${MK}_TASK_A`)}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask:', '          - tool: bash', '            resource:', '              kind: any',
    '        deny: []',
    '  - templateId: wd', '    displayName: "a5nx worker D (bash denied)"',
    `    persona: ${JSON.stringify(`You are worker D of the a5nx ${era} team. Follow delegated work exactly, tool by tool, in order. ${MK}_TASK_D`)}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    ...denyBlock('      '),
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow:', '          - tool: read', '            resource:', '              kind: any',
    '        ask: []',
    '        deny:', '          - tool: bash', '            resource:', '              kind: any',
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    '  - templateId: wd', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    'teamEnvelope:',
    '  allow:',
    '    - create-member', '    - assign-task', '    - send-message', '    - report-progress',
    '    - request-control', '    - resolve-control',
    '  deny: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}',
    ...(era === 'v4'
      ? [
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
        ]
      : []),
    '---', '',
  ].join('\n')
}

// ── row config: THE natexe face = glue7 assembled + names takeover ─────────
function rowConfig(blueprintDir, world, rootSid) {
  return {
    rootSessionId: rootSid,
    bootPhase: 'create',
    blueprintSource: bpAnchorYaml(rootSid),
    blueprintDir,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5nx-live-model' },
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
    // THE natexe delta (attached by planeCfg below): the GLUE-7 #321
    // assembled shape PLUS the shell row takeover under the native `bash`
    // spelling (`teamToolPlane.names = { bash: 'bash' }`) — the EXACT
    // pattern the governed `read` row already ships (int-a5b T5,
    // team-tool-plane readName takeover). The placed row rides the SAME #313
    // placement feed (a5PlanePlacementFeed -> bindingFeed -> bindAll), which
    // is what closes the "execute after approval" gap for `bash`.
  }
}
function planeCfg(realmId, govRoot) {
  return {
    realmId,
    names: { bash: 'bash' }, // <-- the takeover spelling (read-row pattern, int-a5b T5)
    fsInstance: { fs: 'a5nx-ctl', rootDir: govRoot, realmId, kind: 'absolute-path' },
    confinedProvider: {
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    },
  }
}
function writePatchFile(home, blueprintDir, world, rootSid) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const cfg = rowConfig(blueprintDir, world, rootSid)
  cfg.teamToolPlane = planeCfg(`a5nx-realm-${RUN_STAMP.slice(0, 10)}`, world.governedRoot)
  const lines = [
    `# a5natexe live patch (run ${RUN_STAMP}): production row + takeover plane names + p6t6 observability + smoke preset — public profile-patch seam only.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: cfg }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem(presetDeclarationRow({
      id: SMOKE_PRESET_ID,
      displayName: 'a5nx live',
      description: `a5nx natexe live preset (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
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

// ── the mock oracle ─────────────────────────────────────────────────────────
function makeDecide(HOME) {
  let issued = 0
  return function decide({ req }) {
    issued += 1
    if (issued > 80) return { kind: 'text', content: 'A5NX_CIRCUIT_BREAK' }
    const digest = req.__digest ?? digestRequest(req)
    const text = digest._text
    const firstMsg = digest.msgCount > 0 ? (req.messages ?? [])[0] : undefined
    const firstText = typeof firstMsg?.content === 'string'
      ? firstMsg.content
      : firstMsg?.role === 'user' && Array.isArray(firstMsg?.content)
        ? String(firstMsg.content[0]?.text ?? '')
        : ''
    if (firstMsg?.role === 'user' && (/^Create a concise title/.test(firstText) || /^Generate the session title/.test(firstText))) {
      return { kind: 'text', content: 'a5nx live session' }
    }
    // Attribution is by the conversation's OPENING prompt only: the leader
    // transcript carries the member markers downstream (inside the
    // delegation tool_use JSON), so downstream text is not a witness.
    const opener = firstUserText(req)
    if (text.includes(`${MK}_DISC`) && !opener.includes(`${MK}_L0`)) return { kind: 'text', content: 'A5NX_DISC_DONE' }
    if (opener.includes(`${MK}_TASK_A`)) {
      const calls = digest.assistantToolNames
      if (calls.length === 0) return { kind: 'tool-call', toolCalls: [{ id: `call-nx-a1-${Math.random().toString(36).slice(2, 8)}`, name: 'bash', arguments: { command: `pwd; echo ${TOK_INSIDE}; echo ${TOK_WRITE} > ./${SENTINEL_NAME} && echo SENTINEL-WROTE; cat ./${SENTINEL_NAME}` } }] }
      if (calls.length === 1) return { kind: 'tool-call', toolCalls: [{ id: `call-nx-a2-${Math.random().toString(36).slice(2, 8)}`, name: 'bash', arguments: { command: `echo ${TOK_ESCAPE} > ../${ESCAPE_NAME} && echo ESCAPE-WROTE; ls ../${ESCAPE_NAME}` } }] }
      const quote = digest.toolResults.map((r, i) => `r${i}=${r.slice(0, 700).replace(/\s+/g, ' ')}`).join(' | ')
      return { kind: 'text', content: `A5NX_MEMBER_RESULT ${quote}` }
    }
    if (opener.includes(`${MK}_TASK_D`)) {
      const calls = digest.assistantToolNames
      if (calls.length === 0) return { kind: 'tool-call', toolCalls: [{ id: `call-nx-d1-${Math.random().toString(36).slice(2, 8)}`, name: 'bash', arguments: { command: `touch ./${DENY_SENTINEL}; echo DENY-EXECUTED` } }] }
      return { kind: 'text', content: `A5NX_DENY_RESULT ${String(digest.toolResults[0] ?? '').slice(0, 300).replace(/\s+/g, ' ')}` }
    }
    // Inbox control notifications arriving on the LEADER session arrive as
    // user turns; the scripted human resolves over the wire, so such turns
    // END (never chain-route).
    if (opener.includes(`${MK}_L0`) && digest.msgCount > 0 && JSON.stringify((req.messages ?? []).at(-1) ?? '').includes('[team-control requestId=')) return { kind: 'text', content: 'A5NX_NOTED' }
    if (opener.includes(`${MK}_L0`)) {
      const calls = digest.assistantToolNames
      if (calls.length === 0) return { kind: 'tool-call', toolCalls: [{ id: `call-nx-l1-${Math.random().toString(36).slice(2, 8)}`, name: 'team_delegate', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5nx-d-a-${RUN_STAMP}`, delegationTemplateId: 'wa', label: 'nx-a', taskSummary: 'natexe ask->allow->execute legs (member A)', prompt: `${MK}_TASK_A Do the delegated work exactly as instructed, tool by tool, in order.`, async: false } }] }
      if (calls.length === 1) return { kind: 'tool-call', toolCalls: [{ id: `call-nx-l2-${Math.random().toString(36).slice(2, 8)}`, name: 'team_collect', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5nx-c-a-${RUN_STAMP}`, requestTokens: [`a5nx-d-a-${RUN_STAMP}`] } }] }
      if (calls.length === 2) return { kind: 'tool-call', toolCalls: [{ id: `call-nx-l3-${Math.random().toString(36).slice(2, 8)}`, name: 'team_delegate', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5nx-d-d-${RUN_STAMP}`, delegationTemplateId: 'wd', label: 'nx-d', taskSummary: 'natexe deny-lane leg (member D)', prompt: `${MK}_TASK_D Do the delegated work exactly as instructed, tool by tool, in order.`, async: false } }] }
      if (calls.length === 3) return { kind: 'tool-call', toolCalls: [{ id: `call-nx-l4-${Math.random().toString(36).slice(2, 8)}`, name: 'team_collect', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5nx-c-d-${RUN_STAMP}`, requestTokens: [`a5nx-d-d-${RUN_STAMP}`] } }] }
      return { kind: 'text', content: 'A5NX_LEADER_DONE' }
    }
    return { kind: 'text', content: 'A5NX_IDLE' }
  }
}

/** The durable control ledger over the world's team_domain store (glue8 shape). */
function readControlLedger(home, root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(home, 'storages', 'team_domain.json'), 'utf8'))
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

// ── world runner (one era) ──────────────────────────────────────────────────
let CREATE_ROOT = ''
async function runEra(era, mock) {
  const HOME = homeDir(WORKTREE, `a5natexe-${era}-${RUN_STAMP}`)
  const WORKSPACE = join(HOME, 'workspace')
  const GOV_DIR = join(HOME, 'governed')
  const BLUEPRINT_DIR = join(RUN_DIR, `blueprints-${era}`)
  const ROOT = `session-a5nx-root-${era}-${RUN_STAMP}`
  CREATE_ROOT = `session-a5nx-team-${era}-${RUN_STAMP}`
  const instanceLog = join(RUN_DIR, `instance-${era}.log`)
  const facts = { era, home: HOME, ok: false }
  writeFileSync(instanceLog, '', { flag: 'w' })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(GOV_DIR, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(GOV_DIR, 'a5nx-read.txt'), 'a5nx governed root fixture\n')
  writePatchFile(HOME, BLUEPRINT_DIR, { governedRoot: GOV_DIR }, ROOT)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))
  writeFileSync(join(BLUEPRINT_DIR, 'a5nx-anchor.yaml'), bpAnchorYaml(ROOT))
  const outFd = openSync(instanceLog, 'a')
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: WORKSPACE,
      stdio: ['ignore', outFd, outFd],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
        DEEPSEEK_API_KEY: 'a5nx-mock-key',
      },
    })
  } catch (error) {
    closeSync(outFd)
    dieFatal(`[${era}] host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined }
  child.on('close', (code, signal) => { exitInfo.exited = true; exitInfo.code = code; exitInfo.signal = signal })
  const stopOnce = () => { try { child.kill() } catch { /* gone */ } }
  try {
    // boot
    const boot = await waitFor(360_000, () => {
      try { return BOOT_MARKER.exec(readFileSync(instanceLog, 'utf8')) ?? false } catch { return false }
    }, `[${era}] boot marker`)
    const origin = `http://127.0.0.1:${boot[1]}`
    const cookie = await authenticate(origin, boot[2])
    check(era, 'E1.0', 'real host booted on the production row with the takeover plane (profile-patch seam; v3 anchor alive)', true, `origin=${origin}`)
    // row readiness (p6t6)
    await waitFor(240_000, async () => {
      const hb = await p6t6Get(HOST_PORT, 'health')
      if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
        throw new Error(`[${era}] row setup failed: ${String(hb.body.setupError).slice(0, 600)}\n--- tail ---\n${logTail(instanceLog)}`)
      }
      return hb.status === 200 && hb.body?.ok === true
    }, `[${era}] row health`)
    await waitFor(120_000, async () => {
      const st = await p6t6Get(HOST_PORT, 'state')
      const b = st.body
      return st.status === 200 && b !== null && b.rootSessionId === ROOT && b.phase === 'create' && b.teamSession !== null
    }, `[${era}] row state`)

    // DISC: capture the live tool surface on the boot root (denyList face)
    const reqBase = mock.requests.length
    await apiPrompt(origin, cookie, ROOT, `${MK}_DISC`)
    const discReq = await waitFor(180_000, async () => {
      const hit = mock.requests.slice(reqBase).filter((r) => r.body !== null && digestRequest(r.body).toolCount > 0 && digestRequest(r.body)._text.includes(`${MK}_DISC`)).pop()
      return hit ?? false
    }, `[${era}] DISC model request`)
    const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t))
    const MANAGED = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'todo_write']
    const TEAM_TOOLS = ['team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member', 'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress', 'team_request_control', 'team_resolve_control', 'team_list_pending_control', 'team_archive_member']
    const denyList = surface.filter((n) => !MANAGED.includes(n) && !TEAM_TOOLS.includes(n) && !n.startsWith('team_'))
    facts.denyList = denyList
    check(era, 'E1.1', 'boot surface captured (bash present; unmanaged remainder computed)', surface.includes('bash'), `surface=${surface.length} deny=${denyList.length}`)

    // BP -> wire
    writeFileSync(join(BLUEPRINT_DIR, 'a5nx-main.yaml'), mainBlueprintYaml(era, denyList))
    writeEvidence(`bp-${era}-authoring.yaml`, mainBlueprintYaml(era, denyList))
    let rows = []
    await waitFor(90_000, async () => {
      const list = await remoteCall(origin, cookie, 'catalog.list', {})
      rows = list.body?.result?.value?.data?.blueprints ?? []
      return rows.some((r) => r.blueprintId === BP_MAIN_ID)
    }, `[${era}] catalog carries the main BP`).catch(() => null)
    const mainRow = rows.find((r) => r.blueprintId === BP_MAIN_ID)
    const mainState = (mainRow?.revisionStates ?? []).find((x) => x.revision === 1)
    const eraStamp = era === 'v4' ? 4 : 3
    check(era, 'E2.0', `${era} saved source lists RUNS (${eraStamp}/current) through the wire catalog`, mainState !== undefined && mainState.schemaVersion === eraStamp && mainState.migrationState === 'current', `state=${JSON.stringify(mainState ?? null).slice(0, 200)}`)
    if (mainState === undefined) { writeEvidence(`e2-catalog-rows-${era}.json`, rows); throw new Error(`[${era}] main BP never listed`) }

    // team.create (issued concurrently with the approval arc — glue8 topology)
    let createSettled = null
    const createPromise = remoteCall(origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: `${MK}_L0 Begin your directive.` },
    }, 'a5nxc', 1, 900_000).then((r) => { createSettled = r; return r }, (e) => { createSettled = { status: 0, error: String(e) }; return createSettled })

    // ── THE APPROVAL ARC: resolve EVERY durable leader-approval the members
    // open, one by one, exactly as a human would (allow) ──
    const resolvedIds = []
    const askWitnesses = []
    const arcDeadline = Date.now() + 540_000
    while (Date.now() < arcDeadline) {
      const ledger = readControlLedger(HOME, CREATE_ROOT)
      for (const reqRow of ledger.requests) {
        // Every durable request the world opens gets resolved (the scripted
        // human answers any ask) — kind is WITNESSED separately below.
        if (reqRow.kind !== 'leader-approval' && reqRow.kind !== 'user-approval') continue
        if (resolvedIds.includes(reqRow.requestId)) continue
        // pre-allow ZERO side effect for THIS request, live:
        const preSentinel = existsSync(join(GOV_DIR, SENTINEL_NAME))
        const preEscape = findInHome(HOME, ESCAPE_NAME)
        askWitnesses.push({ requestId: reqRow.requestId, toolName: reqRow.toolName, preSentinel, preEscape, at: new Date().toISOString() })
        writeEvidence(`e2-ask-open-${resolvedIds.length + 1}-${era}.json`, { ledger, preSentinel, preEscape })
        const resolved = await remoteCall(origin, cookie, 'team.resolveControl', {
          teamSessionId: CREATE_ROOT,
          requestId: reqRow.requestId,
          decision: 'allow',
          note: 'a5nx live leg: scripted human allow (execute-after-approval measurement)',
        }, 'a5nxres', 4)
        writeEvidence(`e2-resolve-control-${resolvedIds.length + 1}-${era}.json`, resolved.body ?? resolved)
        if (!(resolved.status === 200 && resolved.body?.result?.ok === true)) {
          throw new Error(`[${era}] resolveControl refused: status=${resolved.status} body=${JSON.stringify(resolved.body ?? {}).slice(0, 300)}`)
        }
        resolvedIds.push(reqRow.requestId)
      }
      const finalLedger = readControlLedger(HOME, CREATE_ROOT)
      if (resolvedIds.length >= 2 && finalLedger.consumptions.filter((c) => resolvedIds.includes(c.requestId)).length >= 2) break
      if (createSettled !== null && resolvedIds.length >= 2) {
        const l2 = readControlLedger(HOME, CREATE_ROOT)
        if (l2.consumptions.filter((c) => resolvedIds.includes(c.requestId)).length >= 2) break
      }
      await new Promise((r) => setTimeout(r, 700))
    }
    const created = await createPromise
    writeEvidence(`e3-team-create-${era}.json`, created.body ?? created)
    const createOk = created.status === 200 && created.body?.result?.ok === true && created.body?.result?.value?.data?.path === 'fresh-root'
    check(era, 'E3.0', `${era} team.create ACCEPTS the blueprint on a fresh root (production create ran; the ask arc resolved DURING it)`, createOk, `status=${created.status} body=${JSON.stringify(created.body ?? created).slice(0, 200)}`)

    // final ledger
    let finalLedger = { requests: [], decisions: [], consumptions: [] }
    await waitFor(120_000, async () => {
      finalLedger = readControlLedger(HOME, CREATE_ROOT)
      return finalLedger.consumptions.length >= 2
    }, `[${era}] ledger consumptions >= 2`).catch(() => null)
    writeEvidence(`e4-control-ledger-final-${era}.json`, finalLedger)
    const aligned = resolvedIds.length >= 2 && resolvedIds.every((id) =>
      finalLedger.requests.some((r) => r.requestId === id)
      && finalLedger.decisions.some((d) => d.requestId === id)
      && finalLedger.consumptions.some((c) => c.requestId === id))
    check(era, 'E4.1', 'the ask(s) opened a DURABLE leader-approval and every approval chain is ledger-ALIGNED (request -> decision -> consumption, one requestId each): the three ledger lines exist for every resolved ask', aligned, `resolved=${JSON.stringify(resolvedIds)} requests=${finalLedger.requests.length} decisions=${finalLedger.decisions.length} consumptions=${finalLedger.consumptions.length}`)
    const preZero = askWitnesses.length >= 2 && askWitnesses[0]?.preSentinel === false && askWitnesses[1]?.preEscape === false
    check(era, 'E4.2', 'refuse-before-side-effect, live: while each approval stood OPEN the world carried ZERO side effect (no sentinel before allow 1; no escape file before allow 2)', preZero, `witnesses=${JSON.stringify(askWitnesses)}`)

    // leader/member completion at the mock
    const memReqs = mock.requests.filter((r) => r.body !== null && firstUserText(r.body).includes(`${MK}_TASK_A`) && (digestRequest(r.body).toolCount ?? 0) > 0)
    const lastMem = memReqs[memReqs.length - 1]
    const memResults = lastMem ? digestRequest(lastMem.body).toolResults : []
    const memFinal = memReqs.map((r) => JSON.stringify(r.reply ?? '')).find((s) => s.includes('A5NX_MEMBER_RESULT')) ?? null
    const denyReqs = mock.requests.filter((r) => r.body !== null && firstUserText(r.body).includes(`${MK}_TASK_D`) && (digestRequest(r.body).toolCount ?? 0) > 0)
    const lastDeny = denyReqs[denyReqs.length - 1]
    const denyResults = lastDeny ? digestRequest(lastDeny.body).toolResults : []
    facts.memResults = memResults.map((r) => r.slice(0, 700))
    facts.denyResults = denyResults.map((r) => r.slice(0, 400))
    facts.askWitnesses = askWitnesses

    // ── E5: EXECUTE AFTER APPROVAL, on-disk witness (the gap this round closes) ──
    const sentinelPath = join(GOV_DIR, SENTINEL_NAME)
    const sentinelBytes = (() => { try { return readFileSync(sentinelPath, 'utf8') } catch { return '' } })()
    const ranInside = memResults[0]?.includes('exit=0') === true
      && memResults[0]?.includes(TOK_INSIDE) === true
      && memResults[0]?.includes('SENTINEL-WROTE') === true
      && sentinelBytes.includes(TOK_WRITE)
    check(era, 'E5.1', 'EXECUTE-AFTER-APPROVAL: after the durable allow was CONSUMED the native-spelling bash RAN for real — exit=0 + token on the wire AND the sentinel file exists INSIDE the governed root carrying its written token bytes (the side effect that GLUE-8 A4.4 measured as NEVER-happening)', ranInside, `r0=${JSON.stringify(memResults[0] ?? 'LEG-MISSING').slice(0, 240)} sentinelBytes=${JSON.stringify(sentinelBytes.slice(0, 80))}`)
    const noBindSentence = !memResults.some((r) => r.includes('cannot be verified at dispatch time'))
    check(era, 'E5.2', 'no member result carries the TOOL_BINDING_UNVERIFIED sentence on the fed takeover world (the GLUE-8 landing is GONE on this row)', noBindSentence, `results=${memResults.length}`)

    // ── E6: allow does NOT widen execution ──
    const escapeAnywhere = findInHome(HOME, ESCAPE_NAME)
    const r1 = memResults[1] ?? ''
    const noWiden = r1 !== '' && !r1.includes('ESCAPE-WROTE') && escapeAnywhere === false
    facts.escapeCheck = { escapeAnywhere, r1Head: r1.slice(0, 300) }
    check(era, 'E6.1', 'the allow does NOT silently widen: the SECOND bash call (approved exactly like the first) tried to write OUTSIDE the governed root and produced NO escape file anywhere under HOME and no ESCAPE-WROTE in its result (kernel/confinement refusal rides the wire)', noWiden, `escape=${String(escapeAnywhere)} r1=${JSON.stringify(r1.slice(0, 240))}`)

    // ── E7: deny-lane arm ──
    // REAL landing on the takeover world (disclosed verbatim, not silently):
    // the DENIED member's native bash is answered by the durable permission
    // LAYER itself — `permission denied: exec fingerprint <fp> answered deny
    // from the layer` (permission-lifecycle/decision-lane.ts:387, the
    // kernel-precedence fold of the template deny) — BEFORE any ask and
    // BEFORE any backend. (The GLUE-7 world's alias shape answered the same
    // law through the plane lane code `template-deny-lane`; both are
    // deny-before-effect; the unit lane pins keep BOTH codes pinned.)
    const denySentinelExists = findInHome(HOME, DENY_SENTINEL)
    const d0 = denyResults[0] ?? ''
    const denyArm = d0.includes('permission denied') && d0.includes('answered deny from the layer') && denySentinelExists === false
    const requestsForEra = finalLedger.requests.length
    check(era, 'E7.1', 'the DENY-lane member was refused BEFORE any ask and BEFORE any backend by the durable permission layer (kernel-precedence fold of the template deny: "answered deny from the layer"); zero deny-sentinel; the ledger keeps EXACTLY the two ask-arm request rows — the deny arm opened none', denyArm && requestsForEra === 2, `r0=${JSON.stringify(d0.slice(0, 200))} denySentinel=${String(denySentinelExists)} requests=${requestsForEra} resolved=${resolvedIds.length}`)

    // ── E8: host-log witnesses (feed row carries the takeover name) ──
    const bootLog = (() => { try { return readFileSync(instanceLog, 'utf8') } catch { return '' } })()
    const feedLine = bootLog.split('\n').find((l) => l.includes('placement-feed rows=')) ?? ''
    const feedHasBash = /rows=\[[^\]]*\bbash\b[^\]]*\]/.test(feedLine)
    const shellRan = bootLog.includes('confined-shell ran')
    check(era, 'E8.1', 'host assembly witnesses: the placement-feed row list carries the takeover name `bash` (row rode the #313 feed; realm-paired) and a confined-shell RAN line exists (real execution through the placed body)', feedHasBash && shellRan, `feed=${JSON.stringify(feedLine.slice(0, 200))} shellRan=${String(shellRan)}`)

    // ── E9: era + v3 zero-drift witness at the wire ──
    const anchorRow = rows.find((r) => r.blueprintId === BP_ANCHOR_ID)
    const anchorState = (anchorRow?.revisionStates ?? []).find((x) => x.revision === 1)
    let eraFace = anchorState !== undefined && anchorState.schemaVersion === 3 && anchorState.migrationState === 'current'
    if (era === 'v4') {
      const got = await remoteCall(origin, cookie, 'catalog.get', { blueprintId: BP_MAIN_ID, blueprintRevision: 1 })
      const gotRow = got.body?.result?.value?.data?.blueprint ?? got.body?.result?.value?.data ?? null
      eraFace = eraFace && gotRow !== null && gotRow.schemaVersion === 4
        && typeof gotRow.contentHash === 'string' && gotRow.contentHash.startsWith('sha256:')
      facts.v4Identity = { schemaVersion: gotRow?.schemaVersion, contentHash: gotRow?.contentHash }
    }
    check(era, 'E9.1', era === 'v4'
      ? 'v4 face: the main row identity returns 4 + contentHash (hash-bound family) and the v3 anchor row still lists RUNS (3/current) alongside — zero drift'
      : 'v3 face: the v3 anchor row still lists RUNS (3/current) alongside the main row — zero drift', eraFace, `anchor=${JSON.stringify(anchorState ?? null).slice(0, 160)} v4=${JSON.stringify(facts.v4Identity ?? null)}`)

    facts.leaderDone = mock.requests.slice(reqBase).some((r) => JSON.stringify(r.reply ?? '').includes('A5NX_LEADER_DONE'))
    facts.memberFinalSeen = memFinal !== null
    facts.ok = true
    return facts
  } finally {
    stopOnce()
    await new Promise((r) => setTimeout(r, 2500))
    writeEvidence(`facts-${era}.json`, { ...facts, home: HOME })
    try {
      const raw = readFileSync(instanceLog, 'utf8')
      writeFileSync(join(RUN_DIR, `instance-${era}.tail.log`), redactTokens(raw.split('\n').slice(-400).join('\n')))
      facts.logObservations = raw.split('\n').filter((l) => /placement-feed|confined-shell|governed-read|a5-plane|a5glb/.test(l)).slice(0, 60).map((l) => redactTokens(l).slice(0, 240))
      writeEvidence(`observations-${era}.json`, facts.logObservations)
    } catch { /* no log */ }
    if (!FLAG_KEEP) { try { rmSync(HOME, { recursive: true, force: true }) } catch { /* best effort */ } }
    facts.swept = !existsSync(HOME)
  }
}

async function waitFor(timeoutMs, probe, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = await Promise.resolve(probe()).catch(() => false)
    if (hit !== false && hit !== null) return hit
    if (Date.now() >= deadline) throw new Error(`timeout waiting for: ${label}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  if (rev !== TEST_USE_BASELINE_SHA || (dirty ?? 'x') !== '') dieFatal(`test-use not pristine-at-baseline: HEAD=${rev} dirty=${JSON.stringify(dirty)}`)
  if (!(await portFree(HOST_PORT))) dieFatal(`host port ${HOST_PORT} not free`)
  let mockPort = MOCK_PORT_ARG === '' ? 0 : Number(MOCK_PORT_ARG)
  if (mockPort === 0) {
    for (const p of [3491, 3492, 3493, 3494, 3495]) { if (await portFree(p)) { mockPort = p; break } }
    if (mockPort === 0) dieFatal('no free mock port from the 349x family')
  }
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  check('*', 'H0.0', 'the stable :3080 and :3180 instances were probed read-only before the run (probe only, never touched)', true, JSON.stringify(preStable))

  const mock = await startMockModel({
    port: mockPort,
    decide: makeDecide(''),
    log: (l) => { try { writeFileSync(join(RUN_DIR, 'mock.log'), String(l) + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  // full per-request conversation digest (forensic lane): which conversation
  // each model turn belongs to and how far its scripted chain advanced.
  let seenRequests = 0
  const digestLane = setInterval(() => {
    try {
      while (seenRequests < mock.requests.length) {
        const r = mock.requests[seenRequests]
        seenRequests += 1
        if (r.body === null) continue
        const d = digestRequest(r.body)
        const t = d._text
        const opener = firstUserText(r.body)
        const convo = opener.includes(`${MK}_TASK_D`) ? 'memberD'
          : opener.includes(`${MK}_TASK_A`) ? 'memberA'
            : opener.includes(`${MK}_L0`) ? 'leader'
              : opener.includes(`${MK}_DISC`) ? 'boot-disc'
                : (t.includes('concise title') || t.includes('Generate the session title') ? 'title' : 'other')
        writeFileSync(join(RUN_DIR, 'mock-digest.jsonl'), JSON.stringify({
          n: seenRequests, convo, msgCount: d.msgCount, calls: d.assistantToolNames,
          results: d.toolResults.length, reply: redactTokens(JSON.stringify(r.reply ?? '')).slice(0, 160),
        }) + '\n', { flag: 'a' })
      }
    } catch { /* forensic lane never breaks the run */ }
  }, 400)
  log(`mock model on ${mock.port}; eras=${ERAS.join(',')}`)

  const worlds = {}
  try {
    for (const era of ERAS) {
      try {
        worlds[era] = await runEra(era, mock)
      } catch (eraError) {
        // an era failing is a RED criterion, not a lost run: record it and
        // finish the round (stable probes + porcelain + sweep still grade).
        worlds[era] = worlds[era] ?? { era, ok: false }
        worlds[era].eraError = String(eraError?.message ?? eraError).slice(0, 900)
        check(era, 'EX.0', `the ${era} era completed (an era-level throw fails the round verbatim)`, false, worlds[era].eraError)
        log(redactTokens(`[${era}] era error: ${String(eraError?.stack ?? eraError).slice(0, 1200)}`))
      }
    }
  } finally {
    clearInterval(digestLane)
    try { await mock.close() } catch { /* gone */ }
  }

  const postStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('post-stable-probe.json', postStable)
  const revAfter = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirtyAfter = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  check('*', 'H3.0', 'stable instances unchanged (same answers before/after); test-use pristine AFTER (HEAD==baseline, porcelain 0); every world swept',
    String(preStable.p3080.status) === String(postStable.p3080.status)
    && String(preStable.p3180.status) === String(postStable.p3180.status)
    && revAfter === TEST_USE_BASELINE_SHA && (dirtyAfter ?? 'x') === ''
    && ERAS.every((e) => worlds[e]?.swept === true || FLAG_KEEP),
    `stable ${JSON.stringify(preStable)} -> ${JSON.stringify(postStable)}; porcelain=${dirtyAfter === '' ? 0 : 'DIRTY'}; swept=${ERAS.map((e) => `${e}:${String(worlds[e]?.swept)}`).join(',')}`)

  const failed = criteria.filter((c) => !c.ok)
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP, eras: ERAS, hostPort: HOST_PORT, mockPort,
    total: criteria.length, failed: failed.map((c) => `${c.era}/${c.id}`),
    kept: FLAG_KEEP ? ERAS.map((e) => worlds[e]?.home) : [],
    criteria: criteria.map(({ era, id, ok, name }) => ({ era, id, ok, name })),
  })
  if (failed.length > 0) { log(`FAILED ${failed.length}/${criteria.length}: ${failed.map((c) => `${c.era}/${c.id}`).join(', ')}`); process.exit(2) }
  log(`ALL GREEN: ${criteria.length}/${criteria.length} criteria on eras [${ERAS.join(',')}]`)
  process.exit(0)
}

main().catch((e) => dieFatal(`fatal: ${String(e?.stack ?? e)}`.slice(0, 4000)))
