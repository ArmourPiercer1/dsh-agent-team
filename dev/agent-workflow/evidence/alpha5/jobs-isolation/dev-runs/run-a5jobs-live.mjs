#!/usr/bin/env node
/**
 * run-a5jobs-live.mjs — C3 装面端到端 (B-route Alpha.5 jobs closure, branch
 * a5-jobs-isolation, commits fcf6ef48 C2 + 36f35aaa B-ACT-1-DEP).
 *
 * THE question this kit answers on a REAL host: when the governed `job_*`
 * management trio is MOUNTED (teamToolPlane.jobsEnabled=true through the
 * public profile-patch seam), does the live two-member world behave as the
 * unit face claims —
 *   J3 the owning member reads its OWN real background job THROUGH the
 *      mounted row (no Team attribution record exists for a host-native
 *      start, so the DISCLOSED corded:false pass-through reaches the REAL
 *      host jobs service and returns the job's bytes);
 *   J4 the OTHER member gets the host caller fence VERBATIM
 *      (`belongs to another session`) and the job's token NEVER appears in
 *      the foreign member's transcript (leak-negative); job_list answers
 *      per-identity ('(no background jobs)' with zero rows of the peer);
 *   J5 kill REQUESTS and says so in the two native forms (never collapses);
 *   J7 the Z1 era (the SAME world WITHOUT the key) is the control of
 *      controls: the trio is NOT mounted (placement-feed rows), and the
 *      observable job behaviour is IDENTICAL — the corded:false
 *      pass-through is semantics-invariant under the real service, exactly
 *      as disclosed.
 *
 * Deliberate world shape: planeCfg carries ONLY realmId (+ jobsEnabled for
 * the `jobs` era). No fsInstance/confinedProvider => the plane's shell row
 * lands on its shut alias face under team_* names and the HOST-NATIVE
 * `bash` stays host-owned — which is precisely the producer the governed
 * world otherwise lacks (the confined shell refuses background by name,
 * plane-effect-backends background-not-supported). The trio itself mounts
 * under the NATIVE spellings (the fixed jobsEnabled ledger, same-name
 * same-meaning), masking the host rows only for dispatch.
 *
 * Invariants (TEST_METHODS/ROUTER_RULES): test-use stays pristine
 * (HEAD==baseline, porcelain 0 before/after); worlds live under
 * tests/homes/a5jobs-<era>-<stamp> and are RETAINED (no-delete hold); :3080/:3180 probed
 * read-only only; mock model only, tokens redacted at capture.
 * Ports per the B-route task card: host 3188, mock 3496.
 * Exit: 0 all criteria green; 2 any red; 1 fatal.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, closeSync, writeSync } from 'node:fs'
import { createSanitizingLineSink, evaluateStopOutcome, waitForDrain } from './line-sanitizer.mjs'
import { consumeOnceSecret, raceBoot, runEraLoop } from './kit-lifecycle.mjs'
const fsRead = (p) => readFileSync(p, 'utf8')
import { dirname, join, resolve } from 'node:path'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, homeDir, testUseTree, findTestRepoRoot, isSanctionedTestPort } from '../../../../../../tests/paths.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../../../tests/kits/_shared/preset-seam.mjs'
import { startMockModel } from '../../../../../../packages/tools/harness/mock-deepseek.mjs'

const argv = process.argv.slice(2)
function argValue(name, dflt) {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = argv[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const FLAG_KEEP = argv.includes('--keep')
const ERAS = String(argValue('eras', 'z1,jobs')).split(',').map((e) => e.trim()).filter((e) => e === 'z1' || e === 'jobs')
if (ERAS.length === 0) throw new Error('--eras must list at least one of z1,jobs')

const LEG_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(LEG_DIR, '../../../..', '..', '..')
// the test-use checkout lives at a repo ROOT (the worktree holds no copy of the
// gitignored tree): the nearest-ancestor root law (paths.mjs findTestRepoRoot),
// never a hand-joined path. Worlds stay UNDER THIS worktree (homeDir(WORKTREE)).
const TESTUSE = testUseTree(findTestRepoRoot(WORKTREE) ?? WORKTREE)
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = join(LEG_DIR, 'runs', `live-${RUN_STAMP}`)
// the canonical host test-port family is paths.mjs TEST_PORT_RANGES (3180-3186);
// the task card's 3188 predates the pinned law — the law wins, fail-closed below.
const HOST_PORT = Number(argValue('host-port', 3186))
const MOCK_PORT = Number(argValue('mock-port', 3496))
const SMOKE_PRESET_ID = 'rc2-smoke'

const MK = `A5JOBS_${RUN_STAMP.replace(/[^A-Za-z0-9]/g, '')}`
const TOK_A = 'A5JOBS-TOK-A-OUTPUT'
const TOK_B = 'A5JOBS-TOK-B-NEVER-READ'
const BP_ANCHOR_ID = 'team.a5jobs-anchor'
const BP_MAIN_ID = 'team.a5jobs-main'

// ── logging / criteria / evidence (natexe shapes, token redaction) ─────────
const criteria = []
function log(line) {
  const s = redactTokens(String(line))
  process.stdout.write(s + '\n')
  try { writeFileSync(join(RUN_DIR, 'run.log'), s + '\n', { flag: 'a' }) } catch { /* pre-dir */ }
}
function redactTokens(text) {
  // M1 (reviewer-caught, follow-up commit): the ORIGINAL version only masked
  // the MK stamp and the committed tails were byte-identical raw logs WITH the
  // one-shot :3186 boot token in plaintext - the "redacted tails" claim was
  // FALSE. The tails are scrubbed in the follow-up; from HERE capture is real:
  // every boot/auth token (?token=... and &token=...) is masked at capture,
  // next to the MK stamp. Job OUTPUT tokens stay (world fixtures, not creds).
  return String(text).split(MK).join('MK').replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1REDACTED')
}
function check(era, id, name, ok, detail) {
  criteria.push({ era, id, name, ok: ok === true, detail: redactTokens(String(detail ?? '')) })
  log(`[${era}] ${ok === true ? 'PASS' : 'FAIL'} ${id} — ${name}${detail !== undefined ? ` (${redactTokens(String(detail)).slice(0, 400)})` : ''}`)
}
function writeEvidence(name, content) {
  writeFileSync(join(RUN_DIR, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2))
}
function dieFatal(msg, code = 1) {
  log(`FATAL ${redactTokens(msg)}`)
  try { writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: redactTokens(msg), criteria }) } catch { /* dir gone */ }
  process.exit(code)
}
function logTail(logPath, n = 150) {
  try { return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n') } catch { return '' }
}

// ── wire helpers (natexe shapes) ─────────────────────────────────────────────
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
async function remoteCall(origin, cookie, method, params, tag = 'a5jb', version = 1, timeoutMs = 240_000) {
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
async function waitFor(timeoutMs, probe, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = await Promise.resolve().then(probe).catch(() => false)
    if (v !== false && v !== null) return v
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${label}`)
    await new Promise((r) => setTimeout(r, 500))
  }
}

// ── mock digest (natexe shape) ───────────────────────────────────────────────
function firstUserText(parsed) {
  const first = Array.isArray(parsed?.messages) ? (parsed.messages ?? [])[0] : undefined
  if (!first) return ''
  if (typeof first.content === 'string') return first.content
  if (Array.isArray(first.content)) return first.content.map((b) => String(b?.text ?? '')).join('|')
  return ''
}
function digestRequest(parsed) {
  const msgs = Array.isArray(parsed?.messages) ? parsed.messages : []
  const sys = typeof parsed?.system === 'string' ? parsed.system : Array.isArray(parsed?.system) ? JSON.stringify(parsed.system) : ''
  const toolNames = Array.isArray(parsed?.tools) ? parsed.tools.map((t) => String(t?.name ?? t?.function?.name ?? '')).filter((n) => n !== '') : null
  let text = sys
  const assistantToolNames = []
  const toolResults = []
  for (const m of msgs) {
    if (typeof m?.content === 'string') { text += '|' + m.content; continue }
    if (!Array.isArray(m?.content)) continue
    for (const b of m.content) {
      if (b?.type === 'text') text += '|' + String(b.text ?? '')
      else if (b?.type === 'tool_use') { assistantToolNames.push(String(b.name ?? '')); text += '|tool_use:' + String(b.name ?? '') + JSON.stringify(b.input ?? {}) }
      else if (b?.type === 'tool_result') {
        const rep = typeof b.content === 'string' ? b.content : JSON.stringify(b.content ?? '')
        toolResults.push(rep.slice(0, 2400))
        text += '|tool_result:' + rep
      }
    }
  }
  return { msgCount: msgs.length, toolCount: toolNames === null ? 0 : toolNames.length, toolNames, assistantToolNames, toolResults, _text: text }
}

// ── blueprints: lawful lanes (bash=ask via the approval arc; job_*=allow) ──
function bpAnchorYaml(rootSid) {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: "You are the leader of the a5jobs boot team. ${MK}_DISC is the discovery marker."`,
    'members:', '  - templateId: worker', '    persona: "You are a worker of the a5jobs boot team."',
    'memberEnvelopes: []', 'requirements: []',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}
function mainBlueprintYaml() {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5jobs world. ${MK}_L0 is your directive marker. Follow it exactly, tool call by tool call, in order.`)}`,
    '  capabilities:',
    '    teamTools:', '      kind: allow', '      items:',
    '        - team_list_members', '        - team_list_templates', '        - team_create_member',
    '        - team_delegate', '        - team_collect', '        - team_follow_up',
    '    builtinToolDeny: []',
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: ask', '      allow: []', '      ask: []', '      deny: []',
    'members:',
    '  - templateId: wa', '    displayName: "a5jobs member A (job owner)"',
    `    persona: ${JSON.stringify(`You are member A of the a5jobs world. Follow delegated work exactly, tool by tool, in order. ${MK}_TASK_A`)}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    '      builtinToolDeny: []',
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow: []', // the permission-lane tool vocabulary is closed (read|read_image|write|edit|lsp|bash|pwsh): job_* tools carry NO permission rule and ride their own governance (unit-pinned)
    '        ask:',
    '          - tool: bash', '            resource:', '              kind: any',
    '        deny: []',
    '  - templateId: wb', '    displayName: "a5jobs member B (foreign viewer)"',
    `    persona: ${JSON.stringify(`You are member B of the a5jobs world. Follow delegated work exactly, tool by tool, in order. ${MK}_TASK_B`)}`,
    '    capabilities:', '      teamTools:', '        kind: allow', '        items: []',
    '      builtinToolDeny: []',
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: ask',
    '        allow: []', // the permission-lane tool vocabulary is closed (read|read_image|write|edit|lsp|bash|pwsh): job_* tools carry NO permission rule and ride their own governance (unit-pinned)
    '        ask:',
    '          - tool: bash', '            resource:', '              kind: any',
    '        deny: []',
    'memberEnvelopes:',
    '  - templateId: wa', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    '  - templateId: wb', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []',
    'teamEnvelope:',
    '  allow:',
    '    - create-member', '    - assign-task', '    - send-message', '    - report-progress',
    '    - request-control', '    - resolve-control',
    '  deny: []',
    'requirements:', '  - domain: persona', '    name: standard',
    'permissionMutationEnvelope:', '  rules: []',
    'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

// ── the live patch (public profile-patch seam ONLY) ──────────────────────────
function writePatchFile(home, blueprintDir, rootSid, era) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const cfg = {
    rootSessionId: rootSid,
    bootPhase: 'create',
    blueprintSource: bpAnchorYaml(rootSid),
    blueprintDir,
    rootPresetId: SMOKE_PRESET_ID,
    memberPresetId: SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5jobs-live-model' },
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
    // THE C3 delta: the closed jobs key, consumed ONLY by the plane row.
    // z1: NO teamToolPlane key at all is NOT the shape here (the world needs
    // the plane row to exist for the feed witness) — z1 carries the SAME
    // plane shape with the key ABSENT, which is exactly the zero-flip
    // by-abSENCE law the C2 gate pins at unit level.
    teamToolPlane: era === 'jobs'
      ? { realmId: `a5jobs-realm-${RUN_STAMP.slice(0, 10)}`, jobsEnabled: true }
      : { realmId: `a5jobs-realm-${RUN_STAMP.slice(0, 10)}` },
  }
  const lines = [
    `# a5jobs C3 live patch (run ${RUN_STAMP}, era ${era}): production row + plane jobsEnabled=${String(era === 'jobs')} + p6t6 observability + smoke preset — public profile-patch seam only.`,
    '- insert:',
    ...yamlItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: cfg }, 2),
    ...yamlItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlItem(presetDeclarationRow({
      id: SMOKE_PRESET_ID,
      displayName: 'a5jobs live',
      description: `a5jobs C3 live preset (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
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
function yamlItem(item, indent) { return yamlEmitItem(item, indent) }
function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

// ── the mock oracle (scripted members; opener-marker attribution) ───────────
let CREATE_ROOT = ''
function makeDecide() {
  let issued = 0
  return function decide({ req }) {
    issued += 1
    if (issued > 120) return { kind: 'text', content: 'A5JOBS_CIRCUIT_BREAK' }
    const digest = req.__digest ?? digestRequest(req)
    const firstMsg = digest.msgCount > 0 ? (req.messages ?? [])[0] : undefined
    const firstText = typeof firstMsg?.content === 'string'
      ? firstMsg.content
      : firstMsg?.role === 'user' && Array.isArray(firstMsg?.content)
        ? String(firstMsg.content[0]?.text ?? '')
        : ''
    if (firstMsg?.role === 'user' && (/^Create a concise title/.test(firstText) || /^Generate the session title/.test(firstText))) {
      return { kind: 'text', content: 'a5jobs live session' }
    }
    const opener = firstUserText(req)
    const calls = digest.assistantToolNames
    const idFrom = (text) => (String(text).match(/started background job (\S+)/) ?? [])[1] ?? null
    if (opener.includes(`${MK}_TASK_A`)) {
      if (calls.length === 0) return { kind: 'tool-call', toolCalls: [{ id: `jb-a1-${rnd()}`, name: 'bash', arguments: { command: `sleep 2; echo ${TOK_A}`, run_in_background: true } }] }
      if (calls.length === 1) {
        const id = idFrom(digest.toolResults[0] ?? '') ?? 'A5JOBS-NO-SUCH-JOB'
        return { kind: 'tool-call', toolCalls: [{ id: `jb-a2-${rnd()}`, name: 'job_output', arguments: { job_id: id, timeout_ms: 25_000 } }] }
      }
      if (calls.length === 2) return { kind: 'tool-call', toolCalls: [{ id: `jb-a3-${rnd()}`, name: 'job_list', arguments: {} }] }
      if (calls.length === 3) return { kind: 'tool-call', toolCalls: [{ id: `jb-a4-${rnd()}`, name: 'bash', arguments: { command: `sleep 300; echo ${TOK_B}`, run_in_background: true } }] }
      if (calls.length === 4) {
        const id = idFrom(String(digest.toolResults.at(-1) ?? '')) ?? 'A5JOBS-NO-SUCH-JOB-2'
        return { kind: 'tool-call', toolCalls: [{ id: `jb-a5-${rnd()}`, name: 'job_kill', arguments: { job_id: id, reason: 'a5jobs live kill leg' } }] }
      }
      const idA = idFrom(digest.toolResults[0] ?? '') ?? 'A5JOBS-NO-SUCH-JOB'
      const quote = digest.toolResults.map((r, i) => `r${i}=${r.slice(0, 700).replace(/\s+/g, ' ')}`).join(' | ')
      return { kind: 'text', content: `A5JOBS_A_RESULT id=${idA} ${quote}` }
    }
    if (opener.includes(`${MK}_TASK_B`)) {
      if (calls.length === 0) {
        const aId = (opener.match(/A5JOBS_TARGET=(\S+)/) ?? [])[1] ?? 'A5JOBS-NO-SUCH-JOB'
        return { kind: 'tool-call', toolCalls: [{ id: `jb-b1-${rnd()}`, name: 'job_output', arguments: { job_id: aId, timeout_ms: 1_000 } }] }
      }
      if (calls.length === 1) return { kind: 'tool-call', toolCalls: [{ id: `jb-b2-${rnd()}`, name: 'job_list', arguments: {} }] }
      const quote = digest.toolResults.map((r, i) => `r${i}=${r.slice(0, 700).replace(/\s+/g, ' ')}`).join(' | ')
      return { kind: 'text', content: `A5JOBS_B_RESULT ${quote}` }
    }
    if (opener.includes(`${MK}_L0`) && digest.msgCount > 0 && JSON.stringify((req.messages ?? []).at(-1) ?? '').includes('[team-control requestId=')) return { kind: 'text', content: 'A5JOBS_NOTED' }
    if (opener.includes(`${MK}_L0`)) {
      if (calls.length === 0) return { kind: 'tool-call', toolCalls: [{ id: `jb-l1-${rnd()}`, name: 'team_delegate', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5jb-d-a-${RUN_STAMP}`, delegationTemplateId: 'wa', label: 'jb-a', taskSummary: 'jobs mount face member A', prompt: `${MK}_TASK_A Do the delegated work exactly as instructed, tool by tool, in order.`, async: false } }] }
      if (calls.length === 1) return { kind: 'tool-call', toolCalls: [{ id: `jb-l2-${rnd()}`, name: 'team_collect', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5jb-c-a-${RUN_STAMP}`, requestTokens: [`a5jb-d-a-${RUN_STAMP}`] } }] }
      if (calls.length === 2) {
        const last = String(JSON.stringify((req.messages ?? []).at(-1)?.content ?? ''))
        const aId = (last.match(/A5JOBS_A_RESULT id=(\S+)/) ?? [])[1] ?? 'A5JOBS-NO-SUCH-JOB'
        return { kind: 'tool-call', toolCalls: [{ id: `jb-l3-${rnd()}`, name: 'team_delegate', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5jb-d-b-${RUN_STAMP}`, delegationTemplateId: 'wb', label: 'jb-b', taskSummary: 'jobs mount face member B', prompt: `${MK}_TASK_B A5JOBS_TARGET=${aId} Do the delegated work exactly as instructed, tool by tool, in order.`, async: false } }] }
      }
      if (calls.length === 3) return { kind: 'tool-call', toolCalls: [{ id: `jb-l4-${rnd()}`, name: 'team_collect', arguments: { rootSessionId: CREATE_ROOT, requestToken: `a5jb-c-b-${RUN_STAMP}`, requestTokens: [`a5jb-d-b-${RUN_STAMP}`] } }] }
      return { kind: 'text', content: 'A5JOBS_LEADER_DONE' }
    }
    return { kind: 'text', content: 'A5JOBS_IDLE' }
  }
}
function rnd() { return Math.random().toString(36).slice(2, 8) }

/** The durable control ledger over the world's team_domain store (natexe shape). */
function readControlLedger(home, root) {
  const out = { requests: [], decisions: [], consumptions: [], error: null }
  try {
    const parsed = JSON.parse(fsRead(join(home, 'storages', 'team_domain.json')))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      let entry
      try { entry = JSON.parse(v) } catch { continue }
      if (String(entry?.rootSessionId) !== root) continue
      const payload = entry?.payload ?? {}
      if (entry.factType === 'control-request-recorded') out.requests.push({ requestId: payload.requestId, kind: payload.kind, toolName: payload.toolName, status: payload.status })
      else if (entry.factType === 'control-decision-recorded') out.decisions.push({ requestId: payload.requestId, decision: payload.decision })
      else if (entry.factType === 'control-allow-consumed') out.consumptions.push({ requestId: payload.requestId })
    }
  } catch (error) { out.error = String(error?.message ?? error) }
  return out
}

// ── era runner ────────────────────────────────────────────────────────────────
async function runEra(era, mock, lifecycle = {}) {
  const HOME = homeDir(WORKTREE, `a5jobs-${era}-${RUN_STAMP}`)
  const WORKSPACE = join(HOME, 'workspace')
  const BLUEPRINT_DIR = join(RUN_DIR, `blueprints-${era}`)
  const ROOT = `session-a5jobs-root-${era}-${RUN_STAMP}`
  CREATE_ROOT = `session-a5jobs-team-${era}-${RUN_STAMP}`
  const instanceLog = join(RUN_DIR, `instance-${era}.log`)
  const facts = { era, home: HOME, ok: false }
  writeFileSync(instanceLog, '', { flag: 'w' })
  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writePatchFile(HOME, BLUEPRINT_DIR, ROOT, era)
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: 1, phase: 'create', reportDir: RUN_DIR, runStamp: RUN_STAMP, rootSessionId: ROOT,
  }, null, 2))
  writeFileSync(join(BLUEPRINT_DIR, 'a5jobs-anchor.yaml'), bpAnchorYaml(ROOT))
  // SECURITY (root urgent order, raw-leak fix): the instance stdio NO LONGER
  // rides a raw fd - every LINE passes redactTokens BEFORE it touches the
  // log file (redact-before-write; the earlier shape wrote raw bytes to
  // outFd and only redacted the tail copy, leaking the boot auth URL at L2
  // of the captured logs). The fd stays open for the append path below.
  const outFd = openSync(instanceLog, 'a')
  // ROOT guard-review fix: ONE independent line-buffered sink PER STREAM
  // (cross-chunk split credentials stay in the per-stream carry until the
  // line completes; the trailing partial is redacted and flushed on
  // close). The previously shipped block defined a sink but never consumed
  // the pipes - empty logs and a full-pipe stall; it is RECOVERED here and
  // the behavior is unit-tested with fake credentials only (never raw).
  const sinks = []
  let bootResolve
  const bootSeen = new Promise((res) => { bootResolve = res })
  const mkSink = () => {
    const sink = createSanitizingLineSink({
      write: (line) => { writeSync(outFd, line + '\n') },
      redact: redactTokens,
      onLine: (line) => {
        // ROOT batch (1): the bootstrap line is parsed ONLY from the CURRENT
        // child's COMPLETE stdout lines, IN MEMORY - never by re-reading the
        // already-redacted log file (that whole path could only ever hand
        // authenticate a REDACTED value). Exact expected 127.0.0.1 + our
        // port; the parsed pair feeds authenticate and is discarded right
        // after - never written to disk, never printed.
        const m = BOOT_MARKER.exec(line)
        if (m !== null && m[1] === String(HOST_PORT)) bootResolve({ port: m[1], token: m[2] })
      },
    })
    sinks.push(sink)
    return sink
  }
  let child
  try {
    child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: WORKSPACE,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        DSH_HOME: HOME,
        DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${mock.port}`,
        DEEPSEEK_API_KEY: 'a5jobs-mock-key',
      },
    })
  } catch (error) {
    closeSync(outFd)
    dieFatal(`[${era}] host spawn failed: ${error.message}`)
  }
  // The pipes MUST have consumers the instant the child exists (an
  // unconsumed pipe stalls a chatty child - the exact root BLOCK).
  mkSink().attach(child.stdout)
  mkSink().attach(child.stderr)
  facts.spawnError = null
  child.on('error', (err) => { facts.spawnError = String(err?.message ?? err).slice(0, 300) })
  const stopOnce = () => { try { child.kill() } catch { /* gone */ } }
  try {
    // The ONLY bootstrap source: the in-memory line capture above (a
    // timeout here means the CURRENT child never printed the marker - a
    // hard era failure; there is no file fallback to stale or redacted data).
    // ROOT fifth-pass (1): fail FAST by THROWING into the era finally - the
    // old dieFatal here was process.exit INSIDE the try: it skipped the
    // finally and orphaned the child + listener. process.exit is banned in
    // the owned-resource scope. The race also carries the async spawn
    // error and an early child exit, so a doomed era ends at once.
    const booted = await raceBoot({
      bootSeen,
      errorSeen: new Promise((res) => child.once('error', res)),
      exitSeen: new Promise((res) => child.once('exit', res)),
      budgetMs: 360_000,
      label: `[${era}] boot`,
    })
    const origin = `http://127.0.0.1:${booted.port}`
    // ROOT fifth-pass (3): the boot token is cleared in a FINALLY - a
    // FAILED authenticate must not leave it sitting on the object either.
    const cookie = await consumeOnceSecret(booted, 'token', (tok) => authenticate(origin, tok))
    check(era, 'J1.0', 'real host booted on the production row with the era plane shape (profile-patch seam only)', true, `origin=${origin}`)
    // ROOT third-pass fix (2): the ACTUAL bind + PID are captured while the
    // host is ALIVE (a post-stop ss only proves post-stop absence, and a
    // boot URL's 127.0.0.1 is not proof of the bind). Address only - no
    // credential rides this record; unknown stays 'unconfirmed'.
    facts.hostPid = child?.pid ?? null
    try {
      const ssRun = execFileSync('ss', ['-ltn', `sport = :${HOST_PORT}`], { encoding: 'utf8', timeout: 3000 })
      const line = ssRun.split('\n').find((l) => l.includes(String(HOST_PORT)))
      facts.hostBind = line ? line.trim().split(/\s+/).slice(3, 5).join(' <- ') : 'no-listen-line-while-running'
    } catch { facts.hostBind = 'unconfirmed' }
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

    // BP -> wire
    writeFileSync(join(BLUEPRINT_DIR, 'a5jobs-main.yaml'), mainBlueprintYaml())
    writeEvidence(`bp-${era}-authoring.yaml`, mainBlueprintYaml())
    let rows = []
    await waitFor(90_000, async () => {
      const list = await remoteCall(origin, cookie, 'catalog.list', {})
      rows = list.body?.result?.value?.data?.blueprints ?? []
      return rows.some((r) => r.blueprintId === BP_MAIN_ID)
    }, `[${era}] catalog carries the main BP`)
    check(era, 'J1.1', 'the a5jobs blueprint lists RUNS through the wire catalog', true, `rows=${rows.length}`)

    // team.create with the leader directive; bash ASKS ride the scripted-human
    // approval arc (concurrent resolution, natexe topology): each ask opens as a
    // DURABLE leader-approval, the kit answers allow, execution proceeds.
    let createSettled = null
    const createPromise = remoteCall(origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: `${MK}_L0 Begin your directive.` },
    }, 'a5jbc', 1, 420_000).then((r) => { createSettled = r; return r }, (e) => { createSettled = { status: 0, error: String(e) }; return createSettled })
    const resolvedIds = []
    const arcDeadline = Date.now() + 360_000
    while (Date.now() < arcDeadline) {
      const ledger = readControlLedger(HOME, CREATE_ROOT)
      for (const reqRow of ledger.requests) {
        if (reqRow.kind !== 'leader-approval' && reqRow.kind !== 'user-approval') continue
        if (resolvedIds.includes(reqRow.requestId)) continue
        const resolved = await remoteCall(origin, cookie, 'team.resolveControl', {
          teamSessionId: CREATE_ROOT,
          requestId: reqRow.requestId,
          decision: 'allow',
          note: 'a5jobs live leg: scripted human allow',
        }, 'a5jbres', 4)
        writeEvidence(`resolve-control-${resolvedIds.length + 1}-${era}.json`, resolved.body ?? resolved)
        if (!(resolved.status === 200 && resolved.body?.result?.ok === true)) {
          throw new Error(`[${era}] resolveControl refused: status=${resolved.status} body=${JSON.stringify(resolved.body ?? {}).slice(0, 300)}`)
        }
        resolvedIds.push(reqRow.requestId)
      }
      if (createSettled !== null) {
        const l2 = readControlLedger(HOME, CREATE_ROOT)
        const unresolved = l2.requests.filter((r) => (r.kind === 'leader-approval' || r.kind === 'user-approval') && !l2.consumptions.some((c) => c.requestId === r.requestId) && !resolvedIds.includes(r.requestId))
        if (unresolved.length === 0) break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    const created = await createPromise
    facts.asksResolved = resolvedIds.length
    writeEvidence(`team-create-${era}.json`, created.body ?? created)
    const createOk = created.status === 200 && created.body?.result?.ok === true
    check(era, 'J2.0', 'team.create ran the leader directive to completion (two delegations + collects scripted at the mock)', createOk, `status=${created.status} body=${JSON.stringify(created.body ?? created).slice(0, 220)}`)

    // ── member A witness (from the mock's final conversation state) ──
    const aReqs = mock.requests.filter((r) => r.body !== null && firstUserText(r.body).includes(`${MK}_TASK_A`) && (digestRequest(r.body).toolCount ?? 0) > 0)
    const aLast = aReqs[aReqs.length - 1]
    const aResults = aLast ? digestRequest(aLast.body).toolResults : []
    const aFinal = aReqs.map((r) => JSON.stringify(r.reply ?? '')).find((s) => s.includes('A5JOBS_A_RESULT')) ?? null
    const aJobId = (aFinal?.match(/A5JOBS_A_RESULT id=(\S+)/) ?? [])[1] ?? null
    facts.aResults = aResults.map((r) => r.slice(0, 700))
    facts.aJobId = aJobId
    const GUARD = 'no Team Tool Binding'
    const guarded = (t) => t.includes(GUARD) && t.includes('never executes')
    if (era === 'jobs') {
      const aRo = aResults[1] ?? ''
      // PRODUCER-ABSENCE (recorded law, live in BOTH arms): the governed world has
      // NO background-job producer — the confined shell row refuses background by
      // name, the alias-form plane refuses native bash dispatch by the binding law
      // (r0 below is that refusal), and the host exposes NO job-start tool (钉面+
      // 全树互证). The bytes-positive leg is therefore UNREACHABLE in-world BY LAW;
      // it stays pinned at unit level (fake registry). What THIS kit proves live is
      // the MOUNTED ROW ANSWERING THROUGH TO THE REAL SERVICE (the B-ACT-1-DEP
      // chain): a read of a never-existent id crosses the Team gate (no record =
      // corded:false pass-through, disclosed) and comes back with the REAL
      // registry's own unknown-job refusal — a round trip a shut/masked face
      // cannot fake.
      check(era, 'J3.0', 'the MOUNTED job_output row answers THROUGH TO THE REAL host service: a never-existent id crosses the Team gate (corded:false, disclosed) and returns the real registry\'s own unknown-job refusal VERBATIM through the bridge (the B-ACT-1-DEP chain live; the bytes-positive leg is UNREACHABLE in-world — producer absence, booked at J8, unit-pinned)', aRo.includes('host-jobs-refused') && aRo.includes('unknown job'), `r1=${JSON.stringify(aRo.slice(0, 220))}`)
      const aList = aResults[2] ?? ''
      check(era, 'J6.0', 'job_list THROUGH the mounted row answers with the REAL registry\'s identity-scoped face (bytes present; a world without producers carries zero own rows — a peer row cannot appear)', aList.includes('(no background jobs)') || /\[[a-z]+\]/.test(aList), `r2=${JSON.stringify(aList.slice(0, 200))}`)
      const aKill = aResults[4] ?? ''
      check(era, 'J5.0', 'job_kill THROUGH the mounted row answers through the same real chain (unknown-id refusal passthrough; the two native kill forms are unit-pinned — never collapse)', aKill.includes('host-jobs-refused') && aKill.includes('unknown job'), `r4=${JSON.stringify(aKill.slice(0, 200))}`)
    } else {
      const trioCalls = [aResults[1] ?? '', aResults[2] ?? '', aResults[4] ?? '']
      const allGuarded = trioCalls.every(guarded)
      check(era, 'J3.0', 'KEY-OFF face (stronger than a native fallback): ALL THREE trio calls by the OWNING member are refused by the Team tool guard ("no Team Tool Binding ... an un-governed tool never executes") — jobsEnabled ABSENT = the trio is a hard refusal face, zero execution, zero host touch', allGuarded, `r1=${JSON.stringify(trioCalls[0].slice(0, 140))} r2=${JSON.stringify(trioCalls[1].slice(0, 140))} r4=${JSON.stringify(trioCalls[2].slice(0, 140))}`)
      check(era, 'J6.0', 'z1 face split: asks OPENED and were allowed for bash (the plane does not freeze the world) while the trio stayed hard-closed', String(facts.asksResolved ?? 0) > 0, `asks=${facts.asksResolved}`)
      check(era, 'J5.0', 'kill carries no special path when the trio is closed: guard refusal identical to read/list (one face, no half-open)', guarded(aResults[4] ?? ''), `r4=${JSON.stringify((aResults[4] ?? '').slice(0, 140))}`)
    }

    // ── member B witness (cross-member face + leak-negative) ──
    const bReqs = mock.requests.filter((r) => r.body !== null && firstUserText(r.body).includes(`${MK}_TASK_B`) && (digestRequest(r.body).toolCount ?? 0) > 0)
    const bLast = bReqs[bReqs.length - 1]
    const bResults = bLast ? digestRequest(bLast.body).toolResults : []
    facts.bResults = bResults.map((r) => r.slice(0, 700))
    const bRo = bResults[0] ?? ''
    const noLeak = bResults.length > 0 && !JSON.stringify(bResults).includes(TOK_A)
    if (era === 'jobs') {
      // The host caller fence needs an A-OWNED job — producer absence makes that
      // unconstructible in-world (J8). The live face this kit can measure: B meets
      // the SAME bridge answer for the SAME id (no member-specific widening), the
      // fence itself is unit-pinned verbatim ('belongs to another session').
      check(era, 'J4.0', 'member B job_output(same id) THROUGH the mounted row meets the SAME bridge->real-service refusal face as the owner (no member-specific opening; the caller-fence verbatim arm is unconstructible in-world by J8 and unit-pinned)', bRo.includes('host-jobs-refused') && bRo.includes('unknown job'), `r0=${JSON.stringify(bRo.slice(0, 220))}`)
      const bList = bResults[1] ?? ''
      check(era, 'J4.2', 'member B job_list THROUGH the mounted row answers its OWN identity (bytes required; zero rows of the peer)', bList.length > 0 && !bList.includes(String(aJobId ?? 'NOID')), `r1=${JSON.stringify(bList.slice(0, 200))}`)
    } else {
      check(era, 'J4.0', 'member B meets the same guard refusal (the z1 face is uniform across members — no member-specific opening)', guarded(bRo), `r0=${JSON.stringify(bRo.slice(0, 200))}`)
      check(era, 'J4.2', 'member B job_list: guard refusal identical (uniform closed face)', guarded(bResults[1] ?? ''), `r1=${JSON.stringify((bResults[1] ?? '').slice(0, 160))}`)
    }
    check(era, 'J4.1', 'LEAK-NEGATIVE: the owning job\'s output token appears NOWHERE in member B\'s transcript (tool results)', noLeak, `bResults=${bResults.length}`)

    // ── PRODUCER-ABSENCE law, live (booked, not hidden): no in-world background-job
    // producer exists for the governed member — the bash dispatch refusal below is
    // the native-bash arm (binding law); the confined arm (background-not-supported)
    // and the host arm (no job_start tool) are pinned at unit/pin level. The
    // bytes-positive mount leg's absence is THIS law, not a missing test.
    {
      const aR0 = aResults[0] ?? ''
      const producerRefused = aR0.includes('cannot be verified at dispatch time') || aR0.includes('background-not-supported') || aR0.includes('IO_POLICY_UNSUPPORTED')
      check(era, 'J8.0', 'PRODUCER-ABSENCE live witness: the member\'s background-start attempt is refused at dispatch (native-bash binding arm; the confined-shell arm is by-name unit-pinned, the host arm has no job-start tool) — recorded law, the reason the in-world bytes-positive leg CANNOT exist', producerRefused, `r0=${JSON.stringify(aR0.slice(0, 220))} asks=${facts.asksResolved}`)
    }

    // ── mount-face witness from the host log (placement-feed rows) ──
    const bootLog = (() => { try { return readFileSync(instanceLog, 'utf8') } catch { return '' } })()
    const feedLine = bootLog.split('\n').find((l) => l.includes('placement-feed rows=')) ?? ''
    const feedHasTrio = /rows=\[[^\]]*job_output[^\]]*\]/.test(feedLine)
    // ROOT batch (6): the feed-row WITNESS must EXIST first - an empty log
    // or an absent witness line can never PASS either era (absence of
    // evidence proved nothing before; now it fails).
    const feedWitness = feedLine.includes('placement-feed rows=')
    check(era, 'J7.0', era === 'jobs'
      ? 'MOUNT witness: the placement-feed rows witness line EXISTS and carries the fixed trio names (the jobsEnabled row rode the assembly; the trio is Team-claimed on this world)'
      : 'Z1 control witness: the placement-feed rows witness line EXISTS and does NOT carry the trio names (jobsEnabled ABSENT = zero rows by absence - but the witness itself must be present)',
      feedWitness && feedHasTrio === (era === 'jobs'), `witness=${feedWitness} feed=${JSON.stringify(feedLine.slice(0, 260))}`)
    facts.leaderDone = mock.requests.some((r) => JSON.stringify(r.reply ?? '').includes('A5JOBS_LEADER_DONE'))
    facts.ok = true
    return facts
  } finally {
    stopOnce()
    try {
      // ROOT batch (3): VERIFIED drain then the stop verdict; every failure
      // lands in criteria AND in facts.ok - an incomplete stop can never
      // ride an ALL GREEN, and the era loop refuses the next era on it.
      const drained = await waitForDrain(child, [child.stdout, child.stderr], 15_000)
      facts.drain = drained
        ? { ok: true, note: 'verified drain: child exit + both stream closes observed before closeSync' }
        : { ok: false, note: 'DRAIN-INCOMPLETE: child/stream close not observed within 15000ms of stopOnce; late output may be missing' }
      try {
        const raw = readFileSync(instanceLog, 'utf8')
        writeFileSync(join(RUN_DIR, `instance-${era}.tail.log`), redactTokens(raw.split('\n').slice(-400).join('\n')))
        facts.logObservations = raw.split('\n').filter((l) => /placement-feed|a5-plane|a5-jobs|jobs-bridge|governed/i.test(l)).slice(0, 60).map((l) => redactTokens(l).slice(0, 240))
        writeEvidence(`observations-${era}.json`, facts.logObservations)
      } catch { /* no log */ }
      // (5) sink capture failures are criteria, not silence
      const sinkErrors = sinks.flatMap((sk) => sk.errors)
      check(era, 'JSK.0', 'the stream sinks captured the child output with zero redaction/write failures', sinkErrors.length === 0 && facts.spawnError === null, `sinkErrors=${sinkErrors.length} spawnError=${facts.spawnError ?? 'none'}`)
      let postStopListen = 'unconfirmed'
      try {
        const ssStop = execFileSync('ss', ['-ltn', `sport = :${HOST_PORT}`], { encoding: 'utf8', timeout: 3000 })
        postStopListen = ssStop.split('\n').some((l) => l.includes(String(HOST_PORT))) ? 'STILL-LISTENING' : 'no-listener'
      } catch { /* ss unavailable */ }
      const stop = evaluateStopOutcome({ drained, postStopListen })
      facts.stop = stop
      check(era, 'J9.0', 'the era host actually stopped: verified drain + post-stop listener absence', stop.ok, stop.reasons.join('; ') || 'drain verified; listener absent')
      if (!stop.ok || sinkErrors.length > 0 || facts.spawnError !== null) facts.ok = false
      facts.homesRetained = true // (4) no-delete hold: homes stay COMPLETELY; this kit deletes NOTHING
      writeEvidence(`facts-${era}.json`, { ...facts, home: HOME })
      writeEvidence(`stop-receipt-${era}.json`, { era, hostPid: facts.hostPid ?? null, drain: facts.drain, stop, postStopListen, sinkErrors: sinkErrors.length, stopStamp: new Date().toISOString() })
    } catch (stopErr) {
      // A stop/teardown failure is recorded, then rethrown: the loop halts
      // fail-closed and the lifecycle box still carries what we know.
      lifecycle.stop = { ok: false, reasons: [`stop path threw: ${String(stopErr?.message ?? stopErr).slice(0, 200)}`] }
      throw stopErr
    } finally {
      lifecycle.stop = lifecycle.stop ?? facts.stop ?? { ok: false, reasons: ['no stop verdict was reached'] }
      lifecycle.drain = facts.drain ?? null
      // The fd closes even if everything above threw (nested finally).
      try { closeSync(outFd) } catch { /* already closed */ }
    }
  }
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' }).stdout?.trim()
  if (rev !== TEST_USE_BASELINE_SHA || (dirty ?? 'x') !== '') dieFatal(`test-use not pristine-at-baseline: HEAD=${rev} dirty=${JSON.stringify(dirty)}`)
  if (!isSanctionedTestPort(HOST_PORT) || !isSanctionedTestPort(MOCK_PORT)) dieFatal(`ports outside the canonical test family (paths.mjs TEST_PORT_RANGES): host=${HOST_PORT} mock=${MOCK_PORT}`)
  if (!(await portFree(HOST_PORT))) dieFatal(`host port ${HOST_PORT} not free`)
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} not free (card-fixed)`)
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  check('*', 'H0.0', 'stable :3080/:3180 probed read-only before the run (probe only, never touched)', true, JSON.stringify(preStable))

  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (l) => { try { writeFileSync(join(RUN_DIR, 'mock.log'), String(l) + '\n', { flag: 'a' }) } catch { /* best-effort */ } },
  })
  let seenRequests = 0
  const digestLane = setInterval(() => {
    try {
      while (seenRequests < mock.requests.length) {
        const r = mock.requests[seenRequests]
        seenRequests += 1
        if (r.body === null) continue
        const d = digestRequest(r.body)
        const opener = firstUserText(r.body)
        const convo = opener.includes(`${MK}_TASK_B`) ? 'memberB'
          : opener.includes(`${MK}_TASK_A`) ? 'memberA'
            : opener.includes(`${MK}_L0`) ? 'leader'
              : 'other'
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
    // ROOT fifth-pass (2): ONE fail-closed loop - an era that THROWS keeps
    // its lifecycle facts (the shared lifecycle box the era finally fills)
    // and halts the round; ANY era without a positively confirmed stop
    // (.stop.ok===true) never opens a next era.
    const runEraWrapped = async (era, lifecycle) => {
      const facts = await runEra(era, mock, lifecycle)
      Object.assign(lifecycle, facts)
      return facts
    }
    const loopResults = await runEraLoop({
      eras: ERAS,
      runFn: runEraWrapped,
      onEraError: (era, entry) => {
        check(era, 'EX.0', 'the era completed (an era-level throw fails the round verbatim)', false, entry.eraError)
        log(redactTokens(`[${era}] era error: ${entry.eraError}`))
      },
      onHalt: (era, why) => check(era, 'EX.1', 'no next era without a positively confirmed stop (throws and unproven stops halt fail-closed)', false, why),
    })
    Object.assign(worlds, loopResults)
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
  check('*', 'H3.0', 'stable instances unchanged; test-use pristine AFTER (HEAD==baseline, porcelain 0); every world home RETAINED (no-delete hold)',
    String(preStable.p3080.status) === String(postStable.p3080.status)
    && String(preStable.p3180.status) === String(postStable.p3180.status)
    && revAfter === TEST_USE_BASELINE_SHA && (dirtyAfter ?? 'x') === ''
    && ERAS.every((e) => worlds[e]?.homesRetained === true), // no-delete hold: retention is the law, not a flag
    `porcelain=${dirtyAfter === '' ? 0 : 'DIRTY'}; retained=${ERAS.map((e) => `${e}:${String(worlds[e]?.homesRetained)}`).join(',')}`)

  const failed = criteria.filter((c) => !c.ok)
  writeEvidence('summary.json', {
    runStamp: RUN_STAMP, eras: ERAS, hostPort: HOST_PORT, mockPort: MOCK_PORT,
    total: criteria.length, failed: failed.map((c) => `${c.era}/${c.id}`),
    homesRetained: ERAS.map((e) => worlds[e]?.home), // all homes retained (no-delete hold)
    criteria: criteria.map(({ era, id, ok, name }) => ({ era, id, ok, name })),
  })
  if (failed.length > 0) { log(`FAILED ${failed.length}/${criteria.length}: ${failed.map((c) => `${c.era}/${c.id}`).join(', ')}`); process.exit(2) }
  log(`ALL GREEN: ${criteria.length}/${criteria.length} criteria on eras [${ERAS.join(',')}]`)
  process.exit(0)
}

main().catch((e) => dieFatal(`fatal: ${String(e?.stack ?? e)}`.slice(0, 4000)))
